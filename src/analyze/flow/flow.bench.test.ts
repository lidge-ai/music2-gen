import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import test from "node:test";

const child = String.raw`
  import { measureLoudness } from './src/audio-io/loudness.tool.ts';
  import { onsetEnvelopes, estimateTempoFromEnvelopes } from './src/analyze/tempo.tool.ts';
  import { estimateKey } from './src/analyze/key.tool.ts';
  import { measureBands } from './src/analyze/bands.tool.ts';
  import { renderSpectrogram } from './src/analyze/spectrogram.tool.ts';
  import { analyzeAudio } from './src/analyze/analyze.tool.ts';
  const mode = process.argv[1];
  const make = (seconds) => {
    const rate = 48000, frames = rate * seconds;
    const left = new Float32Array(frames), right = new Float32Array(frames);
    let state = 123456789;
    for (let i = 0; i < frames; i++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      const value = (state >>> 0) / 4294967296 - .5;
      left[i] = value * .02; right[i] = value * .02;
    }
    return { sampleRate: rate, left, right, sourceChannels: 2 };
  };
  const baseline = (pcm) => {
    measureLoudness(pcm);
    const onset = onsetEnvelopes(pcm);
    estimateTempoFromEnvelopes(pcm, onset);
    estimateKey(pcm); measureBands(pcm); renderSpectrogram(pcm);
  };
  const run = mode === 'baseline' ? baseline : analyzeAudio;
  run(make(1));
  const pcm = make(180);
  const start = process.hrtime.bigint();
  run(pcm);
  const wallSeconds = Number(process.hrtime.bigint() - start) / 1e9;
  const rss = process.resourceUsage().maxRSS / 1024;
  process.stdout.write(JSON.stringify({ wallSeconds, rssMb: rss, runtime: "bun " + process.versions.bun, platform: process.platform }));
`;

test("three-minute flow and overview incremental budget", { skip: process.env.MUSIC2_BENCH !== "1" }, () => {
  const measure = (mode: string): { wallSeconds: number; rssMb: number; runtime: string; platform: string } => {
    const run = spawnSync(process.execPath, ["-e", child, mode],
      { cwd: process.cwd(), encoding: "utf8", maxBuffer: 1024 * 1024 });
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout) as { wallSeconds: number; rssMb: number; runtime: string; platform: string };
  };
  const baseline = measure("baseline");
  const added = measure("added");
  const wallDelta = added.wallSeconds - baseline.wallSeconds;
  const rssDelta = added.rssMb - baseline.rssMb;
  console.log(JSON.stringify({ host: hostname(), runtime: added.runtime, platform: added.platform,
    baseline, added, wallDelta, rssDelta }));
  assert.ok(wallDelta <= 15, `added wall ${wallDelta.toFixed(2)} s`);
  assert.ok(rssDelta <= 100, `added peak RSS ${rssDelta.toFixed(2)} MB`);
});
