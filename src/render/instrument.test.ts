import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStereo, writeWav } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
import { validateSong } from "../song/index.ts";
import { renderKit } from "./kit.tool.ts";
import { isSampleInstrument, loadSampleInstrument, renderSampleInstrument } from "./instrument.tool.ts";

const track = (instrument: string) => validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "voice", kind: "notes", instrument, pattern: "a4" }],
  sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }).tracks[0]!;

test("bundled piano loads from package root regardless of song location", async () => {
  const resolved = track("lib:grand-piano");
  assert.equal(isSampleInstrument(resolved.instrument), true);
  const loaded = await loadSampleInstrument(join(tmpdir(), "music2-library-song.json"), resolved, 44100);
  assert.equal(loaded?.kind, "sfz");
  if (loaded?.kind !== "sfz") return;
  const rendered = renderSampleInstrument({ sampleRate: 44100, frames: 22050, track: resolved,
    events: [{ midi: 69, sample: null, velocity: 1, startFrame: 0, gateFrames: 16000,
      stopFrame: 22050, eventIndex: 0, seed: 1 }] }, loaded);
  assert.ok(rendered.left.some((value) => Math.abs(value) > 0.001));
});

test("sample adapter preserves SFZ stereo and rejects escaped sources", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-instrument-"));
  const outside = await mkdtemp(join(tmpdir(), "music2-instrument-outside-"));
  try {
    const audio = createStereo(44100, 44100);
    for (let i = 0; i < audio.left.length; i++) audio.left[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * .5;
    await writeWav(join(dir, "tone.wav"), audio, { bits: 24, seed: 1 });
    await writeFile(join(dir, "tone.sfz"), "<region> sample=tone.wav key=69 pitch_keycenter=69\n");
    assert.equal(isSampleInstrument("sfz:tone.sfz"), true);
    assert.equal(isSampleInstrument("kit:drums"), true);
    assert.equal(isSampleInstrument("piano"), false);
    const resolved = track("sfz:tone.sfz");
    const loaded = await loadSampleInstrument(join(dir, "song.json"), resolved, 44100);
    assert.equal(loaded?.kind, "sfz");
    const rendered = renderSampleInstrument({ sampleRate: 44100, frames: 22050, track: resolved,
      events: [{ midi: 69, sample: null, velocity: 1, startFrame: 0, gateFrames: 22050,
        stopFrame: 22050, eventIndex: 0, seed: 1 }] }, loaded);
    assert.ok(rendered.left.some((value) => Math.abs(value) > .1));
    assert.ok(rendered.right.every((value) => value === 0));
    await assert.rejects(loadSampleInstrument(join(dir, "song.json"), track("sfz:missing.sfz"), 44100),
      (error: unknown) => error instanceof Music2Error && error.code === "E_ACCESS");
    await writeFile(join(outside, "outside.wav"), new Uint8Array([0]));
    await symlink(join(outside, "outside.wav"), join(dir, "escape.wav"));
    await writeFile(join(dir, "escape.sfz"), "<region> sample=escape.wav key=69\n");
    await assert.rejects(loadSampleInstrument(join(dir, "song.json"), track("sfz:escape.sfz"), 44100),
      (error: unknown) => error instanceof Music2Error && error.code === "E_ACCESS");
  } finally { await rm(dir, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test("kit adapter duplicates the unchanged direct mono render", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-kit-adapter-"));
  try {
    const audio = createStereo(44100, 1024);
    audio.left.fill(.25); audio.right.fill(.25);
    await writeWav(join(dir, "hit.wav"), audio, { bits: 16, seed: 1 });
    await writeFile(join(dir, "kit.json"), JSON.stringify({ version: 1, samples: { hit: ["hit.wav"] } }));
    const resolved = validateSong({ version: 1, bpm: 120,
      tracks: [{ id: "kit", kind: "drums", instrument: "kit:.", pattern: "~" }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }).tracks[0]!;
    const loaded = await loadSampleInstrument(join(dir, "song.json"), resolved, 44100);
    assert.equal(loaded?.kind, "kit");
    const ctx = { sampleRate: 44100, frames: 2048, track: resolved,
      events: [{ midi: null, sample: { name: "hit", index: 0 }, velocity: 1,
        startFrame: 0, gateFrames: 1024, stopFrame: 2048, eventIndex: 0, seed: 1 }] };
    const stereo = renderSampleInstrument(ctx, loaded);
    assert.deepEqual(stereo.left, stereo.right);
    if (loaded?.kind !== "kit") throw new Error("expected kit resource");
    assert.deepEqual(stereo.left, renderKit(ctx, loaded.resource));
    assert.ok(stereo.left.some((value) => value !== 0));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
