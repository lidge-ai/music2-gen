# 020 — wp3: render mastering skips the unused true-peak measurement

Consumes 001 D7. Stale check at wp3 P: re-read the cited lines on the wp2 tip. Branch `codex/render-loudness` from `codex/bun-runtime`.

## Why

`masterAudio` (`src/render/mixer.tool.ts:129-131`) calls `measureLoudness(audio)` only for `integratedLufs` when the song has `master.targetLufs`. `measureLoudness` (`src/audio-io/loudness.tool.ts:90-117`) also runs `truePeakOf` on both channels (48 taps × 4 phases per frame), and masterAudio then computes its own true peak with `truePeakBounded`. On a 120-bar song that unused estimate was 26.5% of render CPU. Song-backed analysis meters every section the same way (`src/analyze/analyze.tool.ts:89`) and also reads only `integratedLufs`.

## File change map

| Path | Op | Change |
|---|---|---|
| `src/audio-io/loudness.tool.ts` | MODIFY | private `kWeightedPrefix`; new `integratedLoudness`; `measureLoudness` uses the helper |
| `src/audio-io/index.ts:5` | MODIFY | export `integratedLoudness` |
| `src/render/mixer.tool.ts:1,131` | MODIFY | use `integratedLoudness(audio)` |
| `src/analyze/analyze.tool.ts:3,89` | MODIFY | use `integratedLoudness(meterSlice)` |
| `src/audio-io/loudness.test.ts` | MODIFY | equality with `measureLoudness(x).integratedLufs` |
| `devlog/str_func/audio-io.md` | MODIFY | new export |

## Diffs

```diff
+interface WeightedPrefix { prefix: Float64Array; samplePeak: number }
+
+/** Validates PCM and returns the K-weighted power prefix sum plus the sample peak. */
+function kWeightedPrefix(pcm: StereoBuffer): WeightedPrefix {
+  const { sampleRate, left, right, sourceChannels } = pcm;
+  if (<unchanged validation from measureLoudness>) throw new Music2Error("E_INPUT", "invalid PCM for loudness measurement");
+  const prefix = new Float64Array(left.length + 1);
+  let samplePeak = 0;
+  kWeightedPower(pcm, (frame, power) => { <unchanged body> });
+  return { prefix, samplePeak };
+}
+
+/** BS.1770 gated integrated loudness only; same arithmetic as measureLoudness(pcm).integratedLufs. */
+export function integratedLoudness(pcm: StereoBuffer): number | null {
+  const power = gatedMean(blockPowers(kWeightedPrefix(pcm).prefix, pcm.sampleRate, .4), 10);
+  return power === null ? null : loudness(power);
+}

 export function measureLoudness(pcm: StereoBuffer): LoudnessMetrics {
-  <validation, prefix loop>
+  const { sampleRate, left, right, sourceChannels } = pcm;
+  const { prefix, samplePeak } = kWeightedPrefix(pcm);
   const integratedPower = gatedMean(blockPowers(prefix, sampleRate, .4), 10);
```

```diff
-import { createStereo, measureLoudness, peakLinear } from "../audio-io/index.ts";
+import { createStereo, integratedLoudness, peakLinear } from "../audio-io/index.ts";
-  const measured = mode === "lufs" && song.master.targetLufs !== null ? measureLoudness(audio).integratedLufs : null;
+  const measured = mode === "lufs" && song.master.targetLufs !== null ? integratedLoudness(audio) : null;
```

`analyze.tool.ts`: import `integratedLoudness` beside `measureLoudness` (line 167 keeps the full measurement) and change line 89 to `integratedLoudness(meterSlice)`.

## Tests

`loudness.test.ts` adds one test: for a 1 kHz stereo tone, a mono source, silence, a 0.3 s buffer (no 400 ms block) and a tone with a −80 dB tail (gating), `Object.is(integratedLoudness(x), measureLoudness(x).integratedLufs)`; invalid PCM throws `E_INPUT` from both.

## Acceptance (wp3)

| Check | Command | Reads the change |
|---|---|---|
| Unit | `bun test ./src/audio-io/loudness.test.ts` | new test |
| Bytes | the Bun-keyed digest and legacy tests pass (15 examples set `targetLufs`, so the changed branch runs) and the 030 sha256 script matches the wp2 tip | render |
| Speed | 120-bar render time before/after under Bun, reported in the PR (the song is private and stays out of the repo) | render |
| Suite | full wp2 acceptance set again at the wp3 tip | all |
