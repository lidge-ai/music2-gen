import { mkdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { measureLoudness, readWav } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { renderSong } from "../render/index.ts";
import { Music2Error } from "../shared/index.ts";
import { buildTimeline, loadSong } from "../song/index.ts";
import type { ResolvedSong, Timeline } from "../song/index.ts";
import { ANALYSIS_VERSION } from "./analysis.schema.ts";
import type { AnalysisArtifacts, AnalysisJson, AnalysisResult, AnalysisWarning, SectionMetrics, TrackDensity } from "./analysis.schema.ts";
import { measureBands } from "./bands.tool.ts";
import { makeBeatMap } from "./beats.tool.ts";
import { analyzeFlow } from "./flow/flow.tool.ts";
import { flowAnnotations } from "./flow/annotate.tool.ts";
import { estimateKey } from "./key.tool.ts";
import { loopSeam } from "./loop-seam.tool.ts";
import { renderOverview } from "./overview/overview.tool.ts";
import { renderPianoRoll } from "./pianoroll.tool.ts";
import { renderAnalysisReport } from "./report.tool.ts";
import { renderSpectrogram } from "./spectrogram.tool.ts";
import { estimateTempoFromEnvelopes, onsetEnvelopes } from "./tempo.tool.ts";

let temporaryCounter = 0;
const db = (linear: number): number | null => linear > 0 ? 20 * Math.log10(linear) : null;
const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

function validatePcm(pcm: StereoBuffer): void {
  if (!pcm || !Number.isFinite(pcm.sampleRate) || pcm.sampleRate <= 4000 ||
      !(pcm.left instanceof Float32Array) || !(pcm.right instanceof Float32Array) ||
      pcm.left.length === 0 || pcm.left.length !== pcm.right.length ||
      (pcm.sourceChannels !== 1 && pcm.sourceChannels !== 2)) {
    throw new Music2Error("E_INPUT", "invalid or empty PCM for analysis");
  }
  for (let i = 0; i < pcm.left.length; i++) {
    if (!Number.isFinite(pcm.left[i]) || !Number.isFinite(pcm.right[i])) {
      throw new Music2Error("E_INPUT", `nonfinite PCM sample at frame ${i}`);
    }
  }
}

function amplitude(pcm: StereoBuffer): { peak: number; clipped: number; rms: number | null } {
  let peak = 0, clipped = 0, power = 0;
  const channels = pcm.sourceChannels === 1 ? [pcm.left] : [pcm.left, pcm.right];
  for (const channel of channels) for (const value of channel) {
    const abs = Math.abs(value);
    peak = Math.max(peak, abs);
    if (abs >= 1) clipped++;
    power += value * value;
  }
  return { peak, clipped, rms: db(Math.sqrt(power / (pcm.left.length * channels.length))) };
}

/** The shared LUFS and tempo meters accept integer sample rates in 8..192 kHz. */
function meterPcm(pcm: StereoBuffer): StereoBuffer {
  const rate = Math.max(8000, Math.min(192000, Math.round(pcm.sampleRate)));
  if (rate === pcm.sampleRate) return pcm;
  const frames = Math.round(pcm.left.length * rate / pcm.sampleRate);
  if (!Number.isSafeInteger(frames) || frames < 1) throw new Music2Error("E_INPUT", "resampled PCM is too large");
  const resample = (input: Float32Array): Float32Array => {
    const output = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      const at = Math.min(input.length - 1, i * pcm.sampleRate / rate);
      const lo = Math.floor(at);
      const a = input[lo]!;
      output[i] = a + ((input[Math.min(lo + 1, input.length - 1)] ?? a) - a) * (at - lo);
    }
    return output;
  };
  const left = resample(pcm.left);
  return { sampleRate: rate, left, right: pcm.sourceChannels === 1 ? left : resample(pcm.right),
    sourceChannels: pcm.sourceChannels };
}

function sectionMetrics(pcm: StereoBuffer, timeline: Timeline, metered: StereoBuffer): SectionMetrics[] {
  return timeline.placements.map((placement) => {
    const startSeconds = placement.startBar * timeline.secondsPerBar;
    const endSeconds = Math.min(timeline.durationSeconds, (placement.startBar + placement.bars) * timeline.secondsPerBar);
    const start = Math.min(pcm.left.length, Math.round(startSeconds * pcm.sampleRate));
    const end = Math.min(pcm.left.length, Math.round(endSeconds * pcm.sampleRate));
    const slice: StereoBuffer = { sampleRate: pcm.sampleRate, sourceChannels: pcm.sourceChannels,
      left: pcm.left.subarray(start, end), right: pcm.right.subarray(start, end) };
    const meterStart = Math.min(metered.left.length, Math.round(startSeconds * metered.sampleRate));
    const meterEnd = Math.min(metered.left.length, Math.round(endSeconds * metered.sampleRate));
    const meterSlice: StereoBuffer = { sampleRate: metered.sampleRate, sourceChannels: metered.sourceChannels,
      left: metered.left.subarray(meterStart, meterEnd), right: metered.right.subarray(meterStart, meterEnd) };
    return { id: `${placement.section}#${placement.occurrence}`, role: placement.role,
      startSeconds, endSeconds, rmsDbfs: end > start ? amplitude(slice).rms : null,
      integratedLufs: meterEnd > meterStart ? measureLoudness(meterSlice).integratedLufs : null };
  });
}

function trackDensity(song: ResolvedSong, timeline: Timeline): TrackDensity[] {
  const counts = new Array<number>(song.tracks.length).fill(0);
  for (const event of timeline.events) counts[event.trackIndex] = counts[event.trackIndex]! + 1;
  return song.tracks.map((track, index) => ({ id: track.id, kind: track.kind,
    eventCount: counts[index]!, eventsPerBar: counts[index]! / timeline.bars,
    eventsPerSecond: counts[index]! / timeline.durationSeconds }));
}

function warnings(a: Pick<AnalysisJson, "clippedSamples" | "targetLufs" | "integratedLufs" | "bands" | "keyConfidence">,
  beatSource: "song" | "audio" | null): AnalysisWarning[] {
  const result: AnalysisWarning[] = [];
  const push = (code: AnalysisWarning["code"], observed: number | null, threshold: number | null, message: string): void => {
    result.push({ code, observed, threshold, message });
  };
  if (a.clippedSamples > 0) push("CLIPPING", a.clippedSamples, 0, "One or more PCM samples reached full scale.");
  if (a.targetLufs !== null && a.integratedLufs !== null && Math.abs(a.integratedLufs - a.targetLufs) > 3) {
    push("LUFS_OFF_TARGET", Math.abs(a.integratedLufs - a.targetLufs), 3, "Integrated loudness differs from the target by over 3 LU.");
  }
  const low = a.bands[0]!.share + a.bands[1]!.share;
  if (low > .55) push("LOW_END_DOMINANCE", low, .55, "Sub and low bands dominate in-range spectral energy.");
  if (a.bands.some((band) => band.share > 0) && a.bands[5]!.share < .001) {
    push("EMPTY_HIGH_BAND", a.bands[5]!.share, .001, "Air band contains very little in-range energy.");
  }
  if (!beatSource) push("NO_BEATS", null, null, "No reliable beat map was measured.");
  if (beatSource === "audio") push("METER_ASSUMED", 4, null, "Audio-only beat map assumes 4/4 meter.");
  if (a.keyConfidence < .2) push("KEY_UNCERTAIN", a.keyConfidence, .2, "Estimated key has low confidence.");
  return result;
}

function songWarnings(song: ResolvedSong, flow: AnalysisJson["flow"], pcm: StereoBuffer): AnalysisWarning[] {
  const result: AnalysisWarning[] = [];
  const dance = song.genre === "house" || song.genre === "techno";
  if (song.genre && ["trap", "drill_ny", "drill_uk", "boom_bap", "house", "techno"].includes(song.genre)) {
    const loudRole = dance ? "hook-or-groove" : "hook";
    const quietRole = dance ? "breakdown" : "verse";
    const loud = flow.sectionMeans.filter((row) => row.meanLufs !== null && Number.isFinite(row.meanLufs) && (dance ? row.role === "hook" || row.role === "groove" : row.role === "hook"))
      .map((row) => row.meanLufs!);
    const quiet = flow.sectionMeans.filter((row) => row.meanLufs !== null && Number.isFinite(row.meanLufs) && row.role === quietRole)
      .map((row) => row.meanLufs!);
    const threshold = dance ? 3 : 1;
    if (loud.length && quiet.length) {
      const observed = Math.max(...loud) - Math.min(...quiet);
      if (observed < threshold) result.push({ code: "SECTION_LOUDNESS_FLAT", observed, threshold,
        message: "Section loudness contrast is below the genre guide.",
        fix: "Change section layers or gain, then rerender and compare ungated section means.",
        details: { loudRole, quietRole } });
    }
  }
  if (song.loop) {
    const seam = loopSeam(pcm);
    if (seam.threshold !== null) result.push({ code: "LOOP_SEAM_DISCONTINUITY", observed: seam.observed,
      threshold: seam.threshold, message: "Loop seam has a click, level step, or spectral change.",
      fix: "Shorten the final release or return harmony to bar 1; rerender and inspect the seam.",
      details: seam.metrics });
  }
  return result;
}

/** Analyze finite PCM; song metadata never enters the audio estimators. */
export function analyzeAudio(pcm: StereoBuffer, opts: { song?: ResolvedSong; timeline?: Timeline; targetLufs?: number; source?: "wav" | "song" } = {}): AnalysisResult {
  validatePcm(pcm);
  if (opts.timeline && !opts.song) throw new Music2Error("E_INPUT", "timeline requires a song");
  if (opts.targetLufs !== undefined && !Number.isFinite(opts.targetLufs)) throw new Music2Error("E_INPUT", "target LUFS must be finite");
  const timeline = opts.song ? opts.timeline ?? buildTimeline(opts.song) : undefined;
  const stats = amplitude(pcm);
  const metered = meterPcm(pcm);
  const loudness = measureLoudness(metered);
  const onset = onsetEnvelopes(metered);
  const tempo = estimateTempoFromEnvelopes(metered, onset, opts.song?.meter.numerator ?? 4);
  const key = estimateKey(pcm);
  const bands = measureBands(pcm);
  const beatMap = makeBeatMap(tempo, pcm.left.length / pcm.sampleRate, opts.song, timeline);
  const sections = timeline ? sectionMetrics(pcm, timeline, metered) : [];
  const tracks = opts.song && timeline ? trackDensity(opts.song, timeline) : [];
  const targetLufs = opts.targetLufs ?? opts.song?.master.targetLufs ?? null;
  const warningRows = warnings({ clippedSamples: stats.clipped, targetLufs,
    integratedLufs: loudness.integratedLufs, bands: bands.bands, keyConfidence: key.confidence }, beatMap?.source ?? null);
  const flow = analyzeFlow(pcm, { beatMap, onset, warnings: warningRows, sections, bands: bands.bands, metered,
    ...(opts.song ? { song: opts.song } : {}), ...(timeline ? { timeline } : {}) });
  if (opts.song) warningRows.push(...songWarnings(opts.song, flow.analysis, pcm));
  const annotations = flowAnnotations(flow.analysis, warningRows, sections, timeline);
  flow.analysis.verdicts = annotations.verdicts;
  flow.analysis.annotations = annotations.annotations;
  const analysis: AnalysisJson = {
    version: ANALYSIS_VERSION, source: opts.source ?? (opts.song ? "song" : "wav"), sampleRate: pcm.sampleRate,
    channels: pcm.sourceChannels, durationSeconds: pcm.left.length / pcm.sampleRate,
    tailSeconds: opts.song ? opts.song.tailSeconds : null,
    samplePeakDbfs: db(stats.peak), samplePeakLinear: stats.peak, clippedSamples: stats.clipped,
    rmsDbfs: stats.rms, integratedLufs: loudness.integratedLufs, lraLu: loudness.lraLu,
    lraProvisional: loudness.lraProvisional, truePeakEstimateDbtp: loudness.truePeakEstimateDbtp,
    truePeakOversample: loudness.truePeakOversample,
    declaredBpm: opts.song?.bpm ?? null, estimatedBpm: tempo.bpm,
    tempoConfidence: tempo.confidence, tempoCandidates: tempo.candidates,
    declaredKey: opts.song?.key ?? null, estimatedKey: key.key, keyConfidence: key.confidence,
    keyCandidates: key.candidates, chroma: key.chroma, bands: bands.bands, flow: flow.analysis,
    sections, tracks, targetLufs, warnings: warningRows,
  };
  return { analysis, reportMarkdown: renderAnalysisReport(analysis, beatMap ?? undefined),
    spectrogramPng: renderSpectrogram(pcm, timeline),
    overviewPng: renderOverview(analysis, flow, opts.song, timeline),
    ...(opts.song && timeline ? { pianoRollPng: renderPianoRoll(opts.song, timeline) } : {}),
    ...(beatMap ? { beatMap } : {}) };
}

function roundedJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "number" && Number.isFinite(item) ? round(item) : item, 2) + "\n";
}

async function sameFile(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const physical = async (path: string): Promise<string> => {
    try { return await realpath(path); } catch { return path; }
  };
  return await physical(a) === await physical(b);
}

async function writableInput(path: string): Promise<void> {
  try { await stat(path); }
  catch (cause) {
    const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
    throw new Music2Error(code === "ENOENT" ? "E_NOT_FOUND" : "E_ACCESS", `cannot read input: ${path}`, { cause });
  }
}

/** Read and analyze a WAV or song, then atomically replace named artifacts. */
export async function analyzeFile(inputPath: string, opts: { songPath?: string; outDir?: string } = {}): Promise<AnalysisArtifacts> {
  const input = resolve(inputPath);
  const extension = extname(input).toLowerCase();
  if (extension !== ".wav" && extension !== ".json") throw new Music2Error("E_INPUT", "analyze input must be .wav or .json");
  if (extension === ".json" && opts.songPath) throw new Music2Error("E_INPUT", "--song is only valid with WAV input");
  await writableInput(input);
  const stem = basename(input, extension).replace(/\.song$/i, "");
  const dir = resolve(opts.outDir ?? join(dirname(input), `${stem}.analysis`));
  for (const name of ["analysis.json", "analysis.md", "spectrogram.png", "overview.png", "pianoroll.png", "beats.json"]) {
    const output = join(dir, name);
    if (await sameFile(output, input) || (opts.songPath && await sameFile(output, resolve(opts.songPath)))) {
      throw new Music2Error("E_INPUT", `analysis output would overwrite an input: ${output}`);
    }
  }
  try { await mkdir(dir, { recursive: true }); }
  catch (cause) { throw new Music2Error("E_ACCESS", `cannot write analysis output: ${dir}`, { cause, details: { path: dir } }); }
  let song: ResolvedSong | undefined;
  let timeline: Timeline | undefined;
  let pcm: StereoBuffer;
  if (extension === ".json") {
    song = await loadSong(input);
    timeline = buildTimeline(song);
    pcm = (await renderSong(song, input, { mastering: song.master.targetLufs === null ? "peak" : "lufs" })).audio;
  } else {
    pcm = await readWav(input);
    if (opts.songPath) {
      song = await loadSong(resolve(opts.songPath));
      timeline = buildTimeline(song);
      const expected = Math.ceil((timeline.durationSeconds + (song.loop ? 0 : song.tailSeconds)) * pcm.sampleRate);
      if (pcm.sampleRate !== song.sampleRate || (song.loop ? pcm.left.length !== expected : Math.abs(pcm.left.length - expected) > 1)) {
        throw new Music2Error("E_INPUT", "WAV does not align with the supplied song", {
          fix: "render the full song without --bars, then analyze that WAV",
          details: { expectedFrames: expected, actualFrames: pcm.left.length, sampleRate: pcm.sampleRate, songSampleRate: song.sampleRate },
        });
      }
    }
  }
  const result = analyzeAudio(pcm, { ...(song ? { song } : {}), ...(timeline ? { timeline } : {}),
    source: extension === ".json" ? "song" : "wav" });
  const artifacts: AnalysisArtifacts = {
    analysisJson: join(dir, "analysis.json"), analysisMd: join(dir, "analysis.md"),
    spectrogramPng: join(dir, "spectrogram.png"),
    overviewPng: join(dir, "overview.png"),
    pianoRollPng: result.pianoRollPng ? join(dir, "pianoroll.png") : null,
    beatsJson: result.beatMap ? join(dir, "beats.json") : null,
    summary: { declaredBpm: result.analysis.declaredBpm, estimatedBpm: result.analysis.estimatedBpm,
      integratedLufs: result.analysis.integratedLufs, warnings: result.analysis.warnings },
  };
  const files: { path: string; content: string | Buffer }[] = [
    { path: artifacts.analysisJson, content: roundedJson(result.analysis) },
    { path: artifacts.analysisMd, content: result.reportMarkdown },
    { path: artifacts.spectrogramPng, content: result.spectrogramPng },
    { path: artifacts.overviewPng, content: result.overviewPng },
  ];
  if (artifacts.pianoRollPng && result.pianoRollPng) files.push({ path: artifacts.pianoRollPng, content: result.pianoRollPng });
  if (artifacts.beatsJson && result.beatMap) files.push({ path: artifacts.beatsJson, content: roundedJson(result.beatMap) });
  const temporary: string[] = [];
  try {
    for (const file of files) {
      const path = join(dir, `.${basename(file.path)}.${process.pid}.${++temporaryCounter}.tmp`);
      temporary.push(path);
      await writeFile(path, file.content, { flag: "wx" });
      await rename(path, file.path);
    }
  } catch (cause) {
    throw new Music2Error("E_ACCESS", `cannot write analysis output: ${dir}`, { cause, details: { path: dir } });
  } finally {
    for (const path of temporary) await rm(path, { force: true });
  }
  return artifacts;
}
