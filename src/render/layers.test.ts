import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStereo, writeWav } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Song, Track } from "../song/index.ts";
import { mixTracks } from "./mixer.tool.ts";
import type { LayerTap, RenderOptions, VoiceEvent } from "./render.schema.ts";
import { hasLayers, layerEvents, layerTrack } from "./layers.tool.ts";

function fixture(track: Partial<Track> = {}, overrides: Partial<Song> = {}): Song {
  return { version: 1, bpm: 120, sampleRate: 44100, tailSeconds: 0, seed: 7,
    tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~",
      params: { wave: 2, vibratoCents: 0 }, ...track }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }], ...overrides };
}
async function render(raw: Song, options: RenderOptions = {}, path = "fixture.song.json") {
  if (raw.tracks[0]?.notes) delete raw.tracks[0].pattern;
  const song = validateSong(raw);
  return mixTracks(song, buildTimeline(song), path, { stems: true, ...options });
}
function rms(audio: Float32Array): number {
  let total = 0;
  for (const sample of audio) total += sample * sample;
  return Math.sqrt(total / audio.length);
}
function near(actual: Float32Array, expected: Float32Array, tolerance = 1e-6): void {
  assert.equal(actual.length, expected.length);
  let error = 0;
  for (let frame = 0; frame < actual.length; frame++) error = Math.max(error, Math.abs(actual[frame]! - expected[frame]!));
  assert.ok(error <= tolerance, `maximum sample error ${error}`);
}
function compareStereo(actual: StereoBuffer, expected: StereoBuffer): void {
  near(actual.left, expected.left); near(actual.right, expected.right);
}

test("absent and empty layers stay identical and do not emit source taps", async () => {
  const taps: LayerTap[] = [];
  const plain = await render(fixture(), { layerTaps: (tap) => taps.push(tap) });
  const empty = await render(fixture({ layers: [] }), { layerTaps: (tap) => taps.push(tap) });
  assert.deepEqual(plain.audio, empty.audio);
  assert.deepEqual(plain.stems, empty.stems);
  assert.deepEqual(taps, []);
  assert.equal(hasLayers(validateSong(fixture({ layers: [] })).tracks[0]!), false);
});

test("layer events own release, filter and velocity without mutating main events", () => {
  const track = validateSong(fixture({ layers: [{ id: "long", instrument: "lead", transpose: 12,
    velocity: 2, params: { releaseMs: 1000 } }] })).tracks[0]!;
  const event: VoiceEvent = { midi: 60, sample: null, velocity: .8, startFrame: 0,
    gateFrames: 100, stopFrame: 150, eventIndex: 4, seed: 9, params: { vibratoCents: 100 } };
  const events = layerEvents([event, { ...event, midi: 120 }], track, track.layers![0]!, 0, 100000, 44100);
  assert.equal(events.length, 1);
  const expected = { ...event }; delete expected.params;
  assert.deepEqual(events[0], { ...expected, midi: 72, velocity: 1, stopFrame: 88300 });
  assert.equal(Object.hasOwn(events[0], "params"), false);
  assert.equal(event.stopFrame, 150);
  assert.deepEqual(event.params, { vibratoCents: 100 });
  const layer = layerTrack(track, track.layers![0]!);
  assert.deepEqual(layer.params, { releaseMs: 1000 });
  assert.equal(layer.layers, undefined); assert.equal(layer.automation, undefined);
  assert.equal(layer.plugins, undefined); assert.equal(layer.duck, null);
});

test("out-of-range layer pitches drop and report one warning per layer", async () => {
  const result = await render(fixture({ pattern: "b8 b8 c4 ~", layers: [
    { id: "high", instrument: "lead", transpose: 36 },
    { id: "safe", instrument: "lead", transpose: -12 },
  ] }));
  assert.deepEqual(result.warnings, ["LAYER_NOTES_DROPPED:lead.high:2"]);
  assert.equal(result.stems.length, 1);
});

test("a -60 dB layer is almost silent and two identical layers plus main sum to three voices", async () => {
  const plain = await render(fixture());
  const quiet = await render(fixture({ layers: [{ id: "quiet", instrument: "lead", gain: -60,
    params: { wave: 2, vibratoCents: 0 } }] }));
  const delta = quiet.stems[0]!.audio.left.map((sample, frame) => sample - plain.stems[0]!.audio.left[frame]!);
  assert.ok(20 * Math.log10(rms(delta) / rms(plain.stems[0]!.audio.left)) < -54);
  const summed = await render(fixture({ layers: ["a", "b"].map((id) => ({ id, instrument: "lead",
    params: { wave: 2, vibratoCents: 0 } })) }));
  assert.equal(summed.stems.length, 1);
  assert.ok(Math.abs(rms(summed.stems[0]!.audio.left) / rms(plain.stems[0]!.audio.left) - 3) < 1e-6);
  near(summed.stems[0]!.audio.left, plain.stems[0]!.audio.left.map((value) => value * 3));
});

test("transpose +12 doubles the layer fundamental", async () => {
  const taps: LayerTap[] = [];
  await render(fixture({ pattern: "a4", layers: [{ id: "octave", instrument: "lead", transpose: 12,
    params: { wave: 2, vibratoCents: 0 } }] }), { layerTaps: (tap) => taps.push(tap) });
  const frequency = (audio: Float32Array): number => {
    const crossings: number[] = [];
    for (let frame = 1000; frame < 20000; frame++) {
      if (audio[frame - 1]! <= 0 && audio[frame]! > 0) crossings.push(frame);
    }
    return 44100 * (crossings.length - 1) / (crossings.at(-1)! - crossings[0]!);
  };
  const mainHz = frequency(taps[0]!.audio.left), layerHz = frequency(taps[1]!.audio.left);
  assert.ok(Math.abs(mainHz - 440) < 1);
  assert.ok(Math.abs(layerHz - 880) < 1);
  assert.ok(Math.abs(layerHz / mainHz - 2) < .005);
});

test("only filters drum atoms before rendering, retaining their original event seeds", async () => {
  const taps: LayerTap[] = [];
  const song = fixture({ kind: "drums", instrument: "drums", params: {}, pattern: "bd sd hh cp",
    layers: [{ id: "kick", instrument: "drums", only: ["bd"] }] });
  await render(song, { layerTaps: (tap) => taps.push(tap) });
  const kick = await render(fixture({ kind: "drums", instrument: "drums", params: {}, pattern: "bd ~ ~ ~" }));
  compareStereo(taps[1]!.audio, kick.stems[0]!.audio);
  assert.ok(rms(taps[0]!.audio.left.subarray(22050, 23050)) > .001);
  assert.equal(rms(taps[1]!.audio.left.subarray(22050)), 0);
});

test("a long-release layer continues after the short main voice stops", async () => {
  const taps: LayerTap[] = [];
  await render(fixture({ params: { wave: 2, releaseMs: 5 },
    notes: [{ start: 0, length: .1, pitch: 60 }],
    layers: [{ id: "long", instrument: "lead", params: { wave: 2, releaseMs: 1000 } }] }),
  { layerTaps: (tap) => taps.push(tap) });
  assert.equal(rms(taps[0]!.audio.left.subarray(4410, 8820)), 0);
  assert.ok(rms(taps[1]!.audio.left.subarray(4410, 8820)) > .01);
});

test("layer params do not inherit main param automation or enhanced-synth opt-ins", async () => {
  const taps: LayerTap[] = [], automatedTaps: LayerTap[] = [];
  const track = { pattern: "a4", params: { wave: 2, unison: 3, detuneCents: 20, vibratoCents: 0 },
    layers: [{ id: "plain", instrument: "lead", params: { wave: 2, vibratoCents: 0 } }] };
  await render(fixture(track), { layerTaps: (tap) => taps.push(tap) });
  await render(fixture({ ...track, automation: [{ target: "param.vibratoCents",
    points: [{ at: 0, value: 100 }] }] }), { layerTaps: (tap) => automatedTaps.push(tap) });
  assert.notDeepEqual(taps[0]!.audio.left, automatedTaps[0]!.audio.left);
  assert.deepEqual(taps[1]!.audio, automatedTaps[1]!.audio);
  const plain = await render(fixture({ pattern: "a4" }));
  compareStereo(taps[1]!.audio, plain.stems[0]!.audio);
});

test("layered seeded synthesis repeats with identical PCM and stems", async () => {
  const song = fixture({ layers: [{ id: "wide", instrument: "supersaw", pan: .3, gain: -9,
    fx: [{ type: "chorus" }] }, { id: "low", instrument: "lead", transpose: -12,
    params: { unison: 3, detuneCents: 20 }, gain: -6 }] });
  const first = await render(song), second = await render(song);
  assert.deepEqual(first.audio, second.audio);
  assert.deepEqual(first.stems, second.stems);
});

for (const path of ["static", "track-tape", "layer-tape", "automation"] as const) {
  test(`source taps are once per source before the track chain with window coordinates: ${path}`, async () => {
    const taps: LayerTap[] = [], croppedTaps: LayerTap[] = [];
    const layerFx = path === "layer-tape" ? [{ type: "tapestop" as const, startBar: 3, beats: 2 }] : [];
    const song = fixture({ pattern: "c4*4", gain: -9, pan: .3,
      fx: path === "track-tape" ? [{ type: "tapestop", startBar: 3, beats: 2 }] : [{ type: "drive", amount: 3 }],
      ...(path === "automation" ? { automation: [{ target: "gain", points: [{ at: 0, value: -18 }, { at: 8, value: -3 }] }] } : {}),
      layers: [{ id: "side", instrument: "lead", gain: -6, pan: -1, fx: layerFx }] },
    { sections: [{ id: "one", bars: 4 }] });
    const full = await render(song, { layerTaps: (tap) => taps.push(tap) });
    const crop = await render(song, { bars: { start: 1, end: 4 }, layerTaps: (tap) => croppedTaps.push(tap) });
    assert.deepEqual(croppedTaps.map(({ trackId, source, layerId }) => ({ trackId, source, layerId })), [
      { trackId: "lead", source: "main", layerId: undefined },
      { trackId: "lead", source: "layer", layerId: "side" },
    ]);
    assert.equal(croppedTaps[0]!.audio.left.length, crop.audio.left.length);
    assert.equal(croppedTaps[1]!.audio.left.length, crop.audio.left.length);
    assert.equal(rms(croppedTaps[1]!.audio.right), 0);
    assert.notDeepEqual(taps[0]!.audio.left, full.stems[0]!.audio.left);
    if (path !== "static") {
      const offset = 88200;
      for (let i = 0; i < taps.length; i++) for (const channel of ["left", "right"] as const)
        near(croppedTaps[i]!.audio[channel], taps[i]!.audio[channel].subarray(offset));
      for (const channel of ["left", "right"] as const)
        near(crop.stems[0]!.audio[channel], full.stems[0]!.audio[channel].subarray(offset));
    }
  });
}

test("layer taps own snapshots and fire before loop-tail folding", async () => {
  const song = fixture({ pattern: "~ ~ ~ c4", layers: [{ id: "tail", instrument: "lead", params: { releaseMs: 1000 } }] },
    { loop: true, tailSeconds: 1 });
  const taps: LayerTap[] = [];
  const result = await render(song, { layerTaps: (tap) => taps.push(tap) });
  assert.equal(taps[0]!.audio.left.length, result.audio.left.length + 44100);
  assert.ok(rms(taps[1]!.audio.left.subarray(88200)) > 0);
  const mutated = await render(song, { layerTaps: (tap) => { tap.audio.left.fill(100); tap.audio.right.fill(100); } });
  assert.deepEqual(mutated.audio, result.audio);
});

test("user and kit layer instruments load generated WAVs alongside a built-in main", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-layer-kits-"));
  const previous = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = join(dir, "home");
  try {
    const homeKit = join(dir, "home", "instruments", "layer-kit"), kit = join(dir, "kit");
    const source = createStereo(44100, 4410);
    for (let frame = 0; frame < source.left.length; frame++)
      source.left[frame] = source.right[frame] = .3 * Math.sin(2 * Math.PI * 440 * frame / 44100);
    for (const root of [kit, homeKit]) {
      await mkdir(root, { recursive: true });
      await writeWav(join(root, "hit.wav"), source, { bits: 24, seed: 1 });
      await writeFile(join(root, "kit.json"), JSON.stringify({ version: 1, samples: { bd: ["hit.wav"] } }));
    }
    await writeFile(join(homeKit, "instrument.json"), JSON.stringify({ version: 1, id: "layer-kit", kind: "kit",
      entry: "kit.json", source: { folder: "synthetic" }, warnings: [] }));
    const taps: LayerTap[] = [];
    const song = fixture({ kind: "drums", instrument: "drums", params: {}, pattern: "bd ~ ~ ~",
      layers: [{ id: "local", instrument: "kit:kit" }, { id: "user", instrument: "user:layer-kit" }] });
    const result = await render(song, { layerTaps: (tap) => taps.push(tap) }, join(dir, "song.json"));
    assert.equal(taps.length, 3);
    assert.ok(rms(taps[1]!.audio.left) > .01);
    assert.deepEqual(taps[1]!.audio, taps[2]!.audio);
    assert.equal(result.stems.length, 1);
  } finally {
    if (previous === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = previous;
    await rm(dir, { recursive: true, force: true });
  }
});


for (const automated of [false, true]) {
  test(`layer tapestop crop preserves a note starting before the window (automation=${automated})`, async () => {
    const song = fixture({ notes: [{ start: 0, length: 16, pitch: 60 }],
      layers: [{ id: "held", instrument: "pad", fx: [{ type: "tapestop", startBar: 3, beats: 2 }] }],
      ...(automated ? { automation: [{ target: "pan", points: [{ at: 0, value: -.4 }, { at: 12, value: .4 }] }] } : {}),
    }, { sections: [{ id: "one", bars: 4 }] });
    const taps: LayerTap[] = [], cropTaps: LayerTap[] = [];
    const full = await render(song, { layerTaps: (tap) => taps.push(tap) });
    const crop = await render(song, { bars: { start: 1, end: 4 }, layerTaps: (tap) => cropTaps.push(tap) });
    assert.ok(rms(cropTaps[1]!.audio.left.subarray(0, 4410)) > .01);
    assert.equal(rms(cropTaps[1]!.audio.left.subarray(3 * 44100)), 0);
    for (const channel of ["left", "right"] as const) {
      near(crop.stems[0]!.audio[channel], full.stems[0]!.audio[channel].subarray(88200));
      for (let i = 0; i < taps.length; i++) near(cropTaps[i]!.audio[channel], taps[i]!.audio[channel].subarray(88200));
    }
  });
}

test("sampled stereo main and layer feed one summed source to the unchanged track controls", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-layer-sfz-"));
  try {
    await writeFile(join(dir, "tone.sfz"), "<region> sample=*sine pitch_keycenter=60 ampeg_release=0.2 unsupported_layer_opcode=1\n");
    const taps: LayerTap[] = [];
    const song = fixture({ instrument: "sfz:tone.sfz", params: {}, pattern: "c4",
      gain: -12, pan: .5, layers: [{ id: "sfz", instrument: "sfz:tone.sfz", transpose: 12, pan: -1 }],
      fx: [{ type: "drive", amount: 2 }], sends: { reverb: .2, delay: .1 },
      plugins: [{ id: "double" }] });
    let calls = 0;
    const result = await render(song, { returns: true, premaster: true, layerTaps: (tap) => taps.push(tap),
      external: { async process(trackId, plugins, audio) {
        assert.equal(trackId, "lead"); assert.equal(plugins.length, 1); calls++;
        for (let i = 0; i < audio.left.length; i++) { audio.left[i]! *= 2; audio.right[i]! *= 2; }
        return audio;
      } } }, join(dir, "song.json"));
    assert.equal(calls, 1); assert.equal(result.stems.length, 1);
    assert.equal(taps.length, 2); assert.ok(rms(taps[1]!.audio.left) > .01);
    assert.ok(result.returns?.reverb && result.returns.delay && result.premaster);
    for (const channel of ["left", "right"] as const)
      near(result.premaster[channel], result.stems[0]!.audio[channel].map((sample, frame) =>
        sample + result.returns!.reverb![channel][frame]! + result.returns!.delay![channel][frame]!));
    assert.ok(result.warnings?.filter((warning) => warning.includes("unsupported_layer_opcode")).length === 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
