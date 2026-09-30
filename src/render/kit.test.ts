import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { createStereo, writeWav } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ResolvedTrack } from "../song/index.ts";
import type { VoiceContext, VoiceEvent } from "./render.schema.ts";
import { loadKit, loadKitMidiMap, renderKit } from "./kit.tool.ts";

function track(kind: "drums" | "notes", instrument: string): ResolvedTrack {
  return { id: "kit", kind, instrument, pattern: null, velocity: 1, gain: 0, pan: 0, gate: 1,
    mono: false, glide: 0, transpose: 0, swing: false, sends: { reverb: 0, delay: 0 }, duck: null, params: {} };
}

function event(startFrame: number, sample: VoiceEvent["sample"], midi: number | null): VoiceEvent {
  return { midi, sample, velocity: 0.5, startFrame, gateFrames: 16, stopFrame: startFrame + 16, eventIndex: 0, seed: 1 };
}

async function setup(t: TestContext): Promise<{ dir: string; kitDir: string; songPath: string }> {
  const dir = await mkdtemp(join(tmpdir(), "music2-kit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const kitDir = join(dir, "kit");
  await mkdir(kitDir);
  const songPath = join(dir, "song.json");
  const a = createStereo(22050, 4);
  a.left[1] = 0.5; a.right[1] = 0.5;
  const b = createStereo(22050, 4);
  b.left[1] = 1; b.right[1] = 0;
  await writeWav(join(kitDir, "a.wav"), a, { bits: 24, seed: 1 });
  await writeWav(join(kitDir, "b.wav"), b, { bits: 24, seed: 1 });
  return { dir, kitDir, songPath };
}

function errorCode(code: string): (error: unknown) => boolean {
  return (error: unknown) => error instanceof Music2Error && error.code === code;
}

void test("rejects malformed manifests, escaping paths and symlinks", async (t) => {
  const { dir, kitDir, songPath } = await setup(t);
  const manifestPath = join(kitDir, "kit.json");
  for (const invalid of [
    { version: 2, samples: { bd: ["a.wav"] } },
    { version: 1, samples: { bd: [] } },
    { version: 1, samples: { "": ["a.wav"] } },
    { version: 1, samples: { bd: ["a.wav"] }, gainDb: Infinity },
    { version: 1, samples: { bd: ["a.wav"] }, rootMidi: 128 },
    { version: 1, samples: { bd: ["a.wav"] }, surprise: true },
  ]) {
    await writeFile(manifestPath, JSON.stringify(invalid));
    await assert.rejects(loadKit(songPath, "kit:kit", 44100), errorCode("E_SCHEMA"));
  }
  await writeFile(manifestPath, JSON.stringify({ version: 1, samples: { bd: ["../outside.wav"] } }));
  await assert.rejects(loadKit(songPath, "kit:kit", 44100), errorCode("E_ACCESS"));
  await writeWav(join(dir, "outside.wav"), createStereo(22050, 1), { bits: 24, seed: 1 });
  await symlink(join(dir, "outside.wav"), join(kitDir, "linked.wav"));
  await writeFile(manifestPath, JSON.stringify({ version: 1, samples: { bd: ["linked.wav"] } }));
  await assert.rejects(loadKit(songPath, "kit:kit", 44100), errorCode("E_ACCESS"));
  await writeFile(join(dir, "outside.json"), JSON.stringify({ version: 1, samples: { bd: ["outside.wav"] } }));
  await rm(manifestPath);
  await symlink(join(dir, "outside.json"), manifestPath);
  await assert.rejects(loadKit(songPath, "kit:kit", 44100), errorCode("E_ACCESS"));
});

void test("decode errors retain kit and sample context", async (t) => {
  const { kitDir, songPath } = await setup(t);
  await writeFile(join(kitDir, "broken.wav"), "not a WAV");
  await writeFile(join(kitDir, "kit.json"), JSON.stringify({ version: 1, samples: { bd: ["broken.wav"] } }));
  await assert.rejects(loadKit(songPath, "kit:kit", 44100), (error: unknown) =>
    error instanceof Music2Error && error.code === "E_SCHEMA" &&
    error.details?.["kitPath"] === join(kitDir, "kit.json") && error.details?.["sampleName"] === "bd");
});

void test("resamples, wraps variants, folds stereo and reports unknown samples", async (t) => {
  const { kitDir, songPath } = await setup(t);
  await writeFile(join(kitDir, "kit.json"), JSON.stringify({ version: 1, samples: { bd: ["a.wav", "b.wav"], sd: ["a.wav"] }, gainDb: -6 }));
  const kit = await loadKit(songPath, "kit:kit", 44100);
  assert.strictEqual(kit.samples.bd?.[0], kit.samples.sd?.[0]);
  const ctx: VoiceContext = { sampleRate: 44100, frames: 16, track: track("drums", "kit:kit"), events: [event(0, { name: "bd", index: 2 }, null)] };
  const first = renderKit(ctx, kit);
  assert.equal(first[0], 0);
  assert.ok(Math.abs((first[2] ?? 0) - 0.5 * 0.5 * 10 ** (-6 / 20)) < 1e-6);
  ctx.events = [event(0, { name: "bd", index: 1 }, null)];
  const second = renderKit(ctx, kit);
  assert.ok(Math.abs((second[2] ?? 0) - (first[2] ?? 0)) < 1e-6);
  ctx.events = [event(0, { name: "cowbell", index: 0 }, null)];
  assert.throws(() => renderKit(ctx, kit), errorCode("E_SCHEMA"));
});

void test("note kit transposes +12 semitones to double playback speed", async (t) => {
  const { kitDir, songPath } = await setup(t);
  await writeFile(join(kitDir, "kit.json"), JSON.stringify({ version: 1, samples: { note: ["a.wav"] }, rootMidi: 60 }));
  const kit = await loadKit(songPath, "kit:kit", 44100);
  const ctx: VoiceContext = { sampleRate: 44100, frames: 16, track: track("notes", "kit:kit"), events: [event(0, null, 60)] };
  const normal = renderKit(ctx, kit);
  ctx.events = [event(0, null, 72)];
  const high = renderKit(ctx, kit);
  assert.ok(Math.abs((normal[2] ?? 0) - 0.25) < 1e-6);
  assert.ok(Math.abs((high[1] ?? 0) - 0.25) < 1e-6);
});

void test("manifest-only MIDI map validates names, range and duplicate assignments", async (t) => {
  const { kitDir, songPath } = await setup(t);
  const path = join(kitDir, "kit.json");
  const samples = { kick: ["a.wav"], clay: ["b.wav"] };
  await writeFile(path, JSON.stringify({ version: 1, samples, midi: { kick: 36, clay: 62 } }));
  assert.deepEqual(await loadKitMidiMap(songPath, "kit:kit"), { names: ["kick", "clay"], explicit: { kick: 36, clay: 62 } });
  assert.deepEqual((await loadKit(songPath, "kit:kit", 44100)).manifest.midi, { kick: 36, clay: 62 });
  for (const [midi, name] of [
    [{ clay: 128 }, "clay"], [{ clay: 62.5 }, "clay"], [{ kick: 36, clay: 36 }, "clay"],
    [{ missing: 41 }, "missing"],
  ] as const) {
    await writeFile(path, JSON.stringify({ version: 1, samples, midi }));
    await assert.rejects(loadKitMidiMap(songPath, "kit:kit"), (error: unknown) =>
      error instanceof Music2Error && error.code === "E_SCHEMA" && error.message.includes(`$.midi.${name}`));
  }
  await writeFile(path, JSON.stringify({ version: 1, samples }));
  assert.deepEqual(await loadKitMidiMap(songPath, "kit:kit"), { names: ["kick", "clay"], explicit: {} });
});

void test("manifest-only lookup rejects a symlink outside the song directory", async (t) => {
  const { kitDir, songPath } = await setup(t);
  const external = await mkdtemp(join(tmpdir(), "music2-kit-outside-"));
  t.after(() => rm(external, { recursive: true, force: true }));
  await writeFile(join(external, "kit.json"), JSON.stringify({ version: 1, samples: { bd: ["a.wav"] } }));
  await symlink(join(external, "kit.json"), join(kitDir, "kit.json"));
  await assert.rejects(loadKitMidiMap(songPath, "kit:kit"), errorCode("E_ACCESS"));
  await assert.rejects(loadKitMidiMap(songPath, "kit:../kit"), errorCode("E_ACCESS"));
});

void test("optional MIDI metadata leaves legacy kit rendering bytes unchanged", async (t) => {
  const { kitDir, songPath } = await setup(t);
  const path = join(kitDir, "kit.json");
  const base = { version: 1, samples: { bd: ["a.wav"] } };
  await writeFile(path, JSON.stringify(base));
  const plain = await loadKit(songPath, "kit:kit", 44100);
  const ctx: VoiceContext = { sampleRate: 44100, frames: 16, track: track("drums", "kit:kit"),
    events: [event(0, { name: "bd", index: 0 }, null)] };
  const original = renderKit(ctx, plain);
  await writeFile(path, JSON.stringify({ ...base, midi: { bd: 36 } }));
  const mapped = await loadKit(songPath, "kit:kit", 44100);
  assert.deepEqual(renderKit(ctx, mapped), original);
});

async function rampKit(t: TestContext, manifest: Record<string, unknown>): Promise<{ songPath: string; kitPath: string }> {
  const { kitDir, songPath } = await setup(t);
  const ramp = createStereo(44100, 2000);
  for (let i = 0; i < 2000; i++) { ramp.left[i] = 0.5; ramp.right[i] = 0.5; }
  ramp.left[0] = 0; ramp.right[0] = 0;
  for (let i = 1; i < 1000; i++) { ramp.left[i] = i / 2000; ramp.right[i] = i / 2000; }
  await writeWav(join(kitDir, "ramp.wav"), ramp, { bits: 24, seed: 1 });
  const kitPath = join(kitDir, "kit.json");
  await writeFile(kitPath, JSON.stringify({ version: 1, samples: { note: ["ramp.wav"] }, rootMidi: 60, ...manifest }));
  return { songPath, kitPath };
}

void test("a notes kit cut at stopFrame fades over 5 ms and ends at zero", async (t) => {
  const { songPath } = await rampKit(t, {});
  const kit = await loadKit(songPath, "kit:kit", 44100);
  const cutEvent = { ...event(0, null, 60), stopFrame: 1500, gateFrames: 1500 };
  const out = renderKit({ sampleRate: 44100, frames: 2000, track: track("notes", "kit:kit"), events: [cutEvent] }, kit);
  assert.equal(out[1499], 0);
  assert.ok(Math.abs((out[1500 - 221 - 1] ?? 0) - 0.25) < 1e-4, String(out[1278]));
  assert.ok((out[1500 - 111] ?? 0) < 0.14 && (out[1500 - 111] ?? 0) > 0.11, String(out[1389]));
  const shortEvent = { ...event(1000, null, 60), stopFrame: 1088, gateFrames: 88 };
  const short = renderKit({ sampleRate: 44100, frames: 2000, track: track("notes", "kit:kit"), events: [shortEvent] }, kit);
  assert.equal(short[1087], 0);
  // The note plays the start of the ramp (i / 2000 at velocity 0.5); only its last 44 frames fade.
  assert.ok(Math.abs((short[1043] ?? 0) - 43 / 4000) < 1e-4, String(short[1043]));
  assert.ok((short[1066] ?? 1) < 66 / 4000, String(short[1066]));
});

void test("kit startMs trims each sample name and rejects bad values", async (t) => {
  const { songPath, kitPath } = await rampKit(t, { startMs: { note: 10 } });
  const kit = await loadKit(songPath, "kit:kit", 44100);
  assert.ok(Math.abs((kit.samples["note"]![0]![0] ?? 0) - 441 / 2000) < 1e-4);
  assert.equal(kit.samples["note"]![0]!.length, 2000 - 441);
  for (const startMs of [{ other: 5 }, { note: -1 }, { note: 20000 }, [5]]) {
    await writeFile(kitPath, JSON.stringify({ version: 1, samples: { note: ["ramp.wav"] }, startMs }));
    await assert.rejects(loadKit(songPath, "kit:kit", 44100), errorCode("E_SCHEMA"));
  }
  await writeFile(kitPath, JSON.stringify({ version: 1, samples: { note: ["ramp.wav"] }, startMs: { note: 46 } }));
  await assert.rejects(loadKit(songPath, "kit:kit", 44100), errorCode("E_SCHEMA"));
});

void test("explicit kit root ignores the instrument reference and confines manifest and samples", async (t) => {
  const { dir, kitDir } = await setup(t);
  const songPath = join(dir, "absent-song-directory", "song.json");
  const manifest = { version: 1, samples: { bd: ["a.wav"] }, midi: { bd: 47 } };
  await writeFile(join(kitDir, "kit.json"), JSON.stringify(manifest));
  const loaded = await loadKit(songPath, "user:synthetic", 44100, kitDir);
  assert.deepEqual(loaded.manifest, manifest);
  assert.deepEqual(await loadKitMidiMap(songPath, "ignored:anything", kitDir), { names: ["bd"], explicit: { bd: 47 } });
  await rm(join(kitDir, "kit.json"));
  await writeFile(join(dir, "outside.json"), JSON.stringify(manifest));
  await symlink(join(dir, "outside.json"), join(kitDir, "kit.json"));
  await assert.rejects(loadKit(songPath, "user:synthetic", 44100, kitDir), errorCode("E_ACCESS"));
  await assert.rejects(loadKitMidiMap(songPath, "user:synthetic", kitDir), errorCode("E_ACCESS"));
  await rm(join(kitDir, "kit.json"));
  await writeFile(join(kitDir, "kit.json"), JSON.stringify(manifest));
  await symlink(join(dir, "outside.json"), join(kitDir, "escape.wav"));
  await writeFile(join(kitDir, "kit.json"), JSON.stringify({ ...manifest, samples: { bd: ["escape.wav"] } }));
  await assert.rejects(loadKit(songPath, "user:synthetic", 44100, kitDir), errorCode("E_ACCESS"));
});
