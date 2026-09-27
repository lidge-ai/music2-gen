import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { analyzeAudio } from "../analyze/index.ts";
import type { AnalysisJson } from "../analyze/index.ts";
import { readWav, writeWav } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { discoverFfmpeg, encodeAudio } from "../probe/index.ts";
import { renderSong } from "../render/index.ts";
import { Music2Error } from "../shared/index.ts";
import { loadSong } from "../song/index.ts";

export interface CriticReview {
  heard_audio: boolean;
  overall: string;
  timbre: string[];
  groove: string[];
  mix: string[];
  arrangement: string[];
  genre_fit: { score: 1 | 2 | 3 | 4 | 5; notes: string };
  top_fixes: string[];
}
export interface CritiqueOptions { model?: string; baseUrl?: string; excerpt?: number; apiKey?: string; timeoutMs?: number }
export interface CritiqueReport {
  review: CriticReview;
  dsp: AnalysisJson;
  audio: { format: "mp3" | "wav"; excerptSeconds: number; source: string };
  model: string;
}

const DEFAULT_MODEL = "google-antigravity/gemini-3.8-flash";
const DEFAULT_BASE_URL = "http://127.0.0.1:10100";
const DEFAULT_EXCERPT = 30;
const DEFAULT_TIMEOUT_MS = 120_000;
const CAPABILITY_FIX = `Use ${DEFAULT_MODEL} through Responses input_file.`;
const PROMPT = "Listen to the attached audio. If you cannot hear it, set heard_audio false. "
  + "Return strict JSON only with heard_audio:boolean, overall:string, timbre:string[], groove:string[], "
  + "mix:string[], arrangement:string[], genre_fit:{score:integer 1-5,notes:string}, top_fixes:string[]. "
  + "Discuss audible sound and feel; do not supply BPM, key, LUFS, peak, or other measured numbers.";

function provider(message: string, retryable = false): Music2Error {
  return new Music2Error("E_PROVIDER", message, { retryable });
}
function capability(message: string): Music2Error {
  return new Music2Error("E_CAPABILITY", message, { fix: CAPABILITY_FIX });
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
}
function parseJson(value: string, label: string): unknown {
  try { return JSON.parse(value) as unknown; }
  catch { throw provider(`malformed ${label}`); }
}
function reviewFrom(text: string): CriticReview {
  const trimmed = text.trim();
  const fenced = /^```json\s*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  const value = parseJson(fenced?.[1] ?? trimmed, "critic review JSON");
  if (!record(value) || typeof value.heard_audio !== "boolean" || typeof value.overall !== "string"
    || !strings(value.timbre) || !strings(value.groove) || !strings(value.mix)
    || !strings(value.arrangement) || !strings(value.top_fixes) || !record(value.genre_fit)
    || !Number.isInteger(value.genre_fit.score) || typeof value.genre_fit.score !== "number"
    || value.genre_fit.score < 1 || value.genre_fit.score > 5 || typeof value.genre_fit.notes !== "string") {
    throw provider("malformed critic review shape");
  }
  return {
    heard_audio: value.heard_audio, overall: value.overall, timbre: value.timbre,
    groove: value.groove, mix: value.mix, arrangement: value.arrangement,
    genre_fit: { score: value.genre_fit.score as CriticReview["genre_fit"]["score"], notes: value.genre_fit.notes },
    top_fixes: value.top_fixes,
  };
}
function responseText(body: unknown): string {
  if (!record(body) || !Array.isArray(body.output)) throw provider("Responses output is missing");
  const text: string[] = [];
  for (const item of body.output) {
    if (!record(item) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (record(part) && part.type === "output_text" && typeof part.text === "string") text.push(part.text);
    }
  }
  if (text.join("").trim().length === 0) throw provider("Responses output text is empty");
  return text.join("");
}
function streamText(body: string): string {
  const chunks: string[] = [];
  for (const event of body.replace(/\r\n/g, "\n").split(/\n\n+/)) {
    const data = event.split("\n").filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, "")).join("\n");
    if (!data || data === "[DONE]") continue;
    const payload = parseJson(data, "Responses stream event");
    if (!record(payload)) throw provider("malformed Responses stream event");
    if (payload.type === "response.failed") throw capability("audio response failed");
    if (payload.type === "response.output_text.delta") {
      if (typeof payload.delta !== "string") throw provider("malformed Responses text delta");
      chunks.push(payload.delta);
    }
  }
  const text = chunks.join("");
  if (!text.trim()) throw provider("Responses stream text is empty");
  return text;
}
function safeExcerpt(body: string, apiKey: string): string {
  let result = body.replace(/data:audio\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/gi, "[audio redacted]");
  if (apiKey) result = result.split(apiKey).join("[key redacted]");
  return result.slice(0, 500);
}
function failed(body: unknown): boolean { return record(body) && body.status === "failed"; }

async function postReview(url: string, model: string, apiKey: string, fileData: string,
  filename: string, prompt: string, timeoutMs: number): Promise<CriticReview> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const request = async (stream: boolean): Promise<Response> => {
    const payload = { model, input: [{ role: "user", content: [
      { type: "input_text", text: prompt }, { type: "input_file", filename, file_data: fileData },
    ] }], stream };
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload), signal: controller.signal });
  };
  try {
    let response = await request(false);
    let body = await response.text();
    let stream = false;
    if (response.status === 400 && /stream must be set to true/i.test(body)) {
      response = await request(true);
      body = await response.text();
      stream = true;
    }
    if (response.status === 400 && /cannot translate audio|unsupported_input_modality/i.test(body)) {
      throw capability("audio input is unsupported on this route");
    }
    if (!response.ok) {
      throw provider(`Responses HTTP ${response.status}: ${safeExcerpt(body, apiKey)}`, response.status >= 500);
    }
    let text: string;
    if (stream) {
      text = streamText(body);
    } else {
      const parsed = parseJson(body, "Responses JSON");
      if (failed(parsed)) throw capability("audio response failed");
      text = responseText(parsed);
    }
    const review = reviewFrom(text);
    if (!review.heard_audio) throw capability("model did not hear the audio");
    return review;
  } catch (error) {
    if (error instanceof Music2Error) throw error;
    if (controller.signal.aborted) throw new Music2Error("E_TIMEOUT", "critic request timed out", { retryable: true });
    throw provider("critic provider unreachable", true);
  } finally { clearTimeout(timer); }
}

function bounded(value: number, min: number, max: number, name: string): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Music2Error("E_INPUT", `${name} must be finite and between ${min} and ${max}`);
  }
  return value;
}
function endpoint(base: string): string {
  try {
    const url = new URL(base);
    if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password || url.search || url.hash) {
      throw new Error("unsupported URL");
    }
    return `${base.replace(/\/+$/, "")}/v1/responses`;
  } catch { throw new Music2Error("E_INPUT", "base-url must be an HTTP(S) URL without credentials or query"); }
}
function slicePcm(pcm: StereoBuffer, seconds: number): StereoBuffer {
  const frames = Math.min(pcm.left.length, Math.floor(seconds * pcm.sampleRate));
  if (frames === 0) throw new Music2Error("E_INPUT", "audio input is empty");
  return { sampleRate: pcm.sampleRate, left: pcm.left.subarray(0, frames),
    right: pcm.right.subarray(0, frames), sourceChannels: pcm.sourceChannels };
}

/** Critique a bounded local excerpt; model prose never supplies DSP measurements. */
export async function critique(inputPath: string, options: CritiqueOptions = {}): Promise<CritiqueReport> {
  const extension = extname(inputPath).toLowerCase();
  if (extension !== ".wav" && extension !== ".json") {
    throw new Music2Error("E_INPUT", "critique input must be .wav or .json");
  }
  const excerpt = bounded(options.excerpt ?? DEFAULT_EXCERPT, 1, 120, "excerpt");
  const timeoutMs = bounded(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1, Number.MAX_SAFE_INTEGER, "timeoutMs");
  const model = options.model ?? process.env.MUSIC2_CRITIC_MODEL ?? DEFAULT_MODEL;
  const apiKey = options.apiKey ?? process.env.MUSIC2_CRITIC_API_KEY ?? "local";
  const url = endpoint(options.baseUrl ?? process.env.MUSIC2_CRITIC_BASE_URL ?? DEFAULT_BASE_URL);
  if (!model || !apiKey) throw new Music2Error("E_INPUT", "model and API key must be nonempty");
  const song = extension === ".json" ? await loadSong(inputPath) : undefined;
  const pcm = song ? (await renderSong(song, inputPath)).audio : await readWav(inputPath);
  const sliced = slicePcm(pcm, excerpt);
  const dsp = analyzeAudio(sliced).analysis;
  const temp = await mkdtemp(join(tmpdir(), "music2-critic-"));
  try {
    const wav = join(temp, "excerpt.wav");
    await writeWav(wav, sliced, { bits: 16, seed: song?.seed ?? 1 });
    let format: "mp3" | "wav" = "wav";
    let file = wav;
    let ffmpeg = null;
    try { ffmpeg = await discoverFfmpeg(); }
    catch (error) { if (!(error instanceof Music2Error && error.code === "E_CAPABILITY")) throw error; }
    if (ffmpeg?.encoders.libmp3lame) {
      file = join(temp, "excerpt.mp3");
      await encodeAudio(wav, file, ffmpeg, { format: "mp3", bitrateKbps: 64 });
      format = "mp3";
    }
    const fileData = `data:audio/${format === "mp3" ? "mpeg" : "wav"};base64,${(await readFile(file)).toString("base64")}`;
    const prompt = song?.genre ? `${PROMPT} Declared genre hint: ${song.genre}.` : PROMPT;
    const review = await postReview(url, model, apiKey, fileData, `excerpt.${format}`, prompt, timeoutMs);
    return { review, dsp, audio: { format, excerptSeconds: dsp.durationSeconds, source: inputPath }, model };
  } finally { await rm(temp, { recursive: true, force: true }); }
}
