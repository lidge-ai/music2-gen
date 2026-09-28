import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import type { ProjectIR } from "../../project/index.ts";
import { planDawproject, type DawMedia } from "./index.ts";

function wav(frames: number): Uint8Array {
  const bytes = Buffer.alloc(44 + frames * 4);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(192000, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(frames * 4, 40);
  return bytes;
}
function fixture(): ProjectIR {
  return { version: 1, ppq: 960, title: "mixed", seed: 1, sampleRate: 48000, tailSeconds: 0,
    loop: false, lengthTicks: 3840, tempo: [{ tick: 0, bpm: 120 }],
    meter: [{ tick: 0, numerator: 4, denominator: 4 }], key: null, markers: [],
    tracks: [{ id: "vox", index: 0, type: "audio", gainDb: 0, pan: 0,
      sends: { reverb: 0, delay: 0 }, inserts: [], duck: null, automation: [],
      clips: [{ tick: 0, lengthTicks: 1920, sample: 0, offsetSeconds: 0, gainDb: 0,
        pitchSemitones: 0, stretch: { mode: "none" }, fadeInSeconds: 0, fadeOutSeconds: 0 }] }],
    buses: { reverb: null, delay: null }, master: { gainDb: 0, ceilingDb: -1, targetLufs: null, inserts: [] },
    samples: [{ role: "clip", ref: "source.wav" }], quantization: { events: 0, inexact: 0, maxErrorTicks: 0 } };
}
test("MIDI DAWproject warns once for a track with external plugins", () => {
  const project = fixture();
  project.tracks[0]!.plugins = [{ id: "softclip" }];
  const source: DawMedia = { path: "audio/source-0000.wav", bytes: wav(48000), frames: 48000,
    sampleRate: 48000, channels: 2, owner: { kind: "source", sampleIndex: 0 } };
  const plan = planDawproject(project, [source],
    [{ trackId: "vox", clipIndex: 0, startSeconds: 0, endSeconds: 1 }],
    { content: "midi", outputName: "plugins.dawproject" });
  assert.equal(plan.warnings.filter((warning) => warning === "PLUGIN_NOT_PORTABLE:vox").length, 1);
});
test("mixed plan embeds one source and stem in fixed order with stable bytes", () => {
  const media: DawMedia[] = [
    { path: "audio/stem-vox.wav", bytes: wav(48000), frames: 48000, sampleRate: 48000, channels: 2,
      owner: { kind: "stem", trackId: "vox" } },
    { path: "audio/source-0000.wav", bytes: wav(48000), frames: 48000, sampleRate: 48000, channels: 2,
      owner: { kind: "source", sampleIndex: 0 } },
  ];
  const options = { content: "both" as const, outputName: "one.dawproject" };
  const regions = [{ trackId: "vox", clipIndex: 0, startSeconds: 0, endSeconds: 1 }];
  const first = planDawproject(fixture(), media, regions, options);
  const second = planDawproject(fixture(), media, regions, { ...options, outputName: "two.dawproject" });
  assert.deepEqual(first.data.entries, ["metadata.xml", "project.xml", "audio/source-0000.wav", "audio/stem-vox.wav"]);
  assert.deepEqual(createHash("sha256").update((first.files[0] as { bytes: Uint8Array }).bytes).digest(),
    createHash("sha256").update((second.files[0] as { bytes: Uint8Array }).bytes).digest());
  assert.equal(first.data.tracks, 2);
  assert.throws(() => planDawproject(fixture(), [{ ...media[0]!, frames: 2 }, media[1]!], regions, options), /descriptor mismatch/);
  const ended = fixture();
  if (ended.tracks[0]?.type !== "audio") throw new Error("fixture track changed");
  ended.tracks[0].clips[0]!.offsetSeconds = 1;
  const omitted = planDawproject(ended, media, [{ trackId: "vox", clipIndex: 0, startSeconds: 1, endSeconds: 2 }], options);
  assert.deepEqual(omitted.data.entries, ["metadata.xml", "project.xml", "audio/stem-vox.wav"]);
  assert.ok(omitted.warnings.includes("NATIVE_AUDIO_CLIP_OMITTED:vox:0"));
});
