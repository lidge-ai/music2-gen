import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStereo, writeWav } from "../audio-io/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import { mixAudioTracks } from "./audio-tracks.tool.ts";

function buses(frames: number) { return { master: createStereo(44100, frames),
  reverb: createStereo(44100, frames), delay: createStereo(44100, frames) }; }

test("audio clip preserves left-only stereo through stem, gain and sends", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-audio-track-"));
  try {
    const source = createStereo(44100, 44100);
    source.left.fill(.25);
    await writeWav(join(dir, "clip.wav"), source, { bits: 24, seed: 2 });
    const song = validateSong({ version: 1, bpm: 120, sampleRate: 44100,
      tracks: [{ id: "lead", kind: "notes", instrument: "piano", pattern: "~" }],
      audioTracks: [{ id: "audio", gain: -6, sends: { reverb: .5, delay: .25 },
        clips: [{ file: "clip.wav", start: 0, length: 1, fadeIn: 0, fadeOut: 0 }] }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
    const mixed = buses(22050); const stems: { trackId: string; audio: typeof source }[] = [];
    const flags = await mixAudioTracks(song, join(dir, "song.json"), { startFrame: 0, frames: 22050 }, mixed, stems, undefined, true);
    assert.deepEqual(flags, { reverbActive: true, delayActive: true });
    assert.equal(stems[0]?.trackId, "audio");
    assert.equal(mixed.master.left[100], stems[0].audio.left[100]);
    assert.equal(mixed.master.right[100], 0);
    assert.ok(Math.abs((mixed.reverb.left[100] ?? 0) - (mixed.master.left[100] ?? 0) * .5) < 1e-7);
    assert.ok(Math.abs((mixed.delay.left[100] ?? 0) - (mixed.master.left[100] ?? 0) * .25) < 1e-7);
    const partial = buses(11025);
    await mixAudioTracks(song, join(dir, "song.json"), { startFrame: 11025, frames: 11025 }, partial, []);
    assert.deepEqual(partial.master.left, mixed.master.left.subarray(11025, 22050));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("automated audio ducking crop retains a trigger before its start", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-audio-duck-crop-"));
  try {
    const source = createStereo(44100, 176400);
    source.left.fill(.25); source.right.fill(.25);
    await writeWav(join(dir, "clip.wav"), source, { bits: 24, seed: 2 });
    const song = validateSong({ version: 1, bpm: 120, sampleRate: 44100, tailSeconds: 0,
      tracks: [{ id: "kick", kind: "drums", instrument: "drums", notes: [
        { start: 3.99, length: .01, sample: "bd" }] }],
      audioTracks: [{ id: "audio", clips: [{ file: "clip.wav", start: 0, length: 8 }],
        duck: { by: "kick", amount: .8, releaseMs: 1000 },
        automation: [{ target: "gain", points: [{ at: 0, value: 0 }] }] }],
      sections: [{ id: "one", bars: 2 }], arrangement: [{ section: "one" }] });
    const timeline = buildTimeline(song);
    const full = buses(176400), crop = buses(88200);
    await mixAudioTracks(song, join(dir, "song.json"), { startFrame: 0, frames: 176400 }, full, [], timeline);
    await mixAudioTracks(song, join(dir, "song.json"), { startFrame: 88200, frames: 88200 }, crop, [], timeline);
    assert.deepEqual(crop.master.left.subarray(0, 1000), full.master.left.subarray(88200, 89200));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
