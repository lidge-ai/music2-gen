import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { writeWav } from "../audio-io/index.ts";
import { renderSong } from "../render/index.ts";
import { Music2Error } from "../shared/index.ts";
import { loadSong } from "../song/index.ts";
import { critique } from "./critic.tool.ts";

const REVIEW = { heard_audio: true, overall: "Clear rhythmic pulse.", timbre: ["Bright hats."],
  groove: ["Steady kick."], mix: ["Bass is prominent."], arrangement: ["Short phrase repeats."],
  genre_fit: { score: 3, notes: "Partly fits." }, top_fixes: ["Soften the bell."] };
const response = (review: unknown = REVIEW): string => JSON.stringify({ output: [
  { content: [{ type: "output_text", text: JSON.stringify(review) }] },
] });
let dir: string;
let wav: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "music2-critic-test-"));
  wav = join(dir, "clip.wav");
  const sampleRate = 8000;
  const left = new Float32Array(sampleRate);
  for (let i = 0; i < left.length; i++) left[i] = 0.2 * Math.sin(2 * Math.PI * 220 * i / sampleRate);
  await writeWav(wav, { sampleRate, left, right: left, sourceChannels: 2 }, { bits: 16, seed: 1 });
});
after(async () => { await rm(dir, { recursive: true, force: true }); });

async function withServer<T>(handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void,
  run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer((req, res) => { void Promise.resolve(handler(req, res)).catch(() => { res.destroy(); }); });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { return await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((done) => server.close(() => done())); }
}
async function requestBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Uint8Array));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}
function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "application/json" }); res.end(body);
}
async function missingFfmpeg<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.MUSIC2_FFMPEG;
  process.env.MUSIC2_FFMPEG = join(dir, "missing-ffmpeg");
  try { return await run(); }
  finally { if (previous === undefined) delete process.env.MUSIC2_FFMPEG; else process.env.MUSIC2_FFMPEG = previous; }
}
function errorCode(code: string, exit: number, retryable?: boolean): (error: unknown) => boolean {
  return (error) => error instanceof Music2Error && error.code === code && error.exit === exit
    && (retryable === undefined || error.retryable === retryable);
}

test("normal response sends MP3 input_file, auth, strict prompt and keeps local DSP separate", async () => {
  await withServer(async (req, res) => {
    assert.equal(req.url, "/v1/responses");
    assert.equal(req.method, "POST");
    assert.equal(req.headers.authorization, "Bearer test-key");
    assert.match(req.headers["content-type"] ?? "", /application\/json/);
    const body = await requestBody(req);
    assert.equal(body.model, "test-model"); assert.equal(body.stream, false);
    const content = (body.input as { content: Record<string, string>[] }[])[0]!.content;
    assert.equal(content[0]!.type, "input_text");
    assert.match(content[0]!.text ?? "", /do not supply BPM, key, LUFS, peak/);
    assert.equal(content[1]!.type, "input_file");
    assert.equal(content[1]!.filename, "excerpt.mp3");
    assert.match(content[1]!.file_data ?? "", /^data:audio\/mpeg;base64,/);
    send(res, 200, response({ ...REVIEW, bpm: 999, genre_fit: { ...REVIEW.genre_fit, score: 3 } }));
  }, async (baseUrl) => {
    const result = await critique(wav, { baseUrl, model: "test-model", apiKey: "test-key", excerpt: 1 });
    assert.equal(result.audio.format, "mp3");
    assert.equal(result.audio.excerptSeconds, 1);
    assert.equal(result.dsp.source, "wav");
    assert.equal(result.dsp.declaredBpm, null);
    assert.deepEqual(result.dsp.sections, []);
    assert.equal(result.review.heard_audio, true);
    assert.equal("bpm" in result.review, false);
  });
});

test("WAV fallback and one surrounding json fence are accepted", async () => {
  await missingFfmpeg(() => withServer(async (req, res) => {
    const body = await requestBody(req);
    const content = (body.input as { content: Record<string, string>[] }[])[0]!.content;
    assert.equal(content[1]!.filename, "excerpt.wav");
    assert.match(content[1]!.file_data ?? "", /^data:audio\/wav;base64,/);
    send(res, 200, JSON.stringify({ output: [{ content: [{ type: "output_text",
      text: `\`\`\`json\n${JSON.stringify(REVIEW)}\n\`\`\`` }] }] }));
  }, async (baseUrl) => {
    const result = await critique(wav, { baseUrl });
    assert.equal(result.audio.format, "wav");
    assert.deepEqual(result.review, REVIEW);
  }));
});

test("song JSON renders locally and sends declared genre only as a hint", async () => {
  await missingFfmpeg(() => withServer(async (req, res) => {
    const body = await requestBody(req);
    const content = (body.input as { content: Record<string, string>[] }[])[0]!.content;
    assert.match(content[0]!.text ?? "", /Declared genre hint: drill_uk\./);
    assert.match(content[1]!.file_data ?? "", /^data:audio\/wav;base64,/);
    send(res, 200, response());
  }, async (baseUrl) => {
    const songPath = resolve("examples/drill-140.song.json");
    const result = await critique(songPath, { baseUrl, excerpt: 1 });
    assert.equal(result.audio.source, songPath);
    assert.equal(result.audio.excerptSeconds, 1);
    assert.equal(result.dsp.source, "wav");
    assert.equal(result.dsp.declaredBpm, null);
    assert.deepEqual(result.dsp.sections, []);
  }));
});

test("stream-only 400 resends exactly once and assembles deltas", async () => {
  let count = 0;
  await missingFfmpeg(() => withServer(async (req, res) => {
    count++;
    const body = await requestBody(req);
    if (count === 1) { assert.equal(body.stream, false); send(res, 400, "Stream must be set to true"); return; }
    assert.equal(body.stream, true);
    const raw = JSON.stringify(REVIEW);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(`: keepalive\n\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: raw.slice(0, 35) })}\n\n`);
    res.end(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: raw.slice(35) })}\n\ndata: [DONE]\n\n`);
  }, async (baseUrl) => {
    assert.deepEqual((await critique(wav, { baseUrl })).review, REVIEW);
    assert.equal(count, 2);
  }));
});

test("unsupported audio 400 variants and failed response status map to capability", async () => {
  for (const body of ["cannot translate audio", "unsupported_input_modality"]) {
    await missingFfmpeg(() => withServer((_req, res) => { send(res, 400, body); }, async (baseUrl) => {
      await assert.rejects(critique(wav, { baseUrl }), (error: unknown) => errorCode("E_CAPABILITY", 3)(error)
        && (error as Music2Error).fix?.includes("google-antigravity/gemini-3.8-flash") === true);
    }));
  }
  await missingFfmpeg(() => withServer((_req, res) => { send(res, 200, '{"status":"failed"}'); }, async (baseUrl) => {
    await assert.rejects(critique(wav, { baseUrl }), errorCode("E_CAPABILITY", 3));
  }));
});

test("heard_audio false is capability failure", async () => {
  await missingFfmpeg(() => withServer((_req, res) => { send(res, 200, response({ ...REVIEW, heard_audio: false })); },
    async (baseUrl) => assert.rejects(critique(wav, { baseUrl }),
      (error: unknown) => errorCode("E_CAPABILITY", 3)(error)
        && (error as Music2Error).message === "model did not hear the audio")));
});

test("500 and network refusal are retryable provider failures", async () => {
  await missingFfmpeg(() => withServer((_req, res) => { send(res, 500, "unavailable"); }, async (baseUrl) => {
    await assert.rejects(critique(wav, { baseUrl }), errorCode("E_PROVIDER", 4, true));
  }));
  await missingFfmpeg(async () => {
    await assert.rejects(critique(wav, { baseUrl: "http://127.0.0.1:1" }), errorCode("E_PROVIDER", 4, true));
  });
});

test("malformed response shape and SSE payload are nonretryable provider failures", async () => {
  await missingFfmpeg(() => withServer((_req, res) => { send(res, 200, response({ ...REVIEW, mix: [4] })); },
    async (baseUrl) => assert.rejects(critique(wav, { baseUrl }), errorCode("E_PROVIDER", 4, false))));
  await missingFfmpeg(() => withServer(async (req, res) => {
    const body = await requestBody(req);
    if (body.stream === false) { send(res, 400, "stream must be set to true"); return; }
    res.writeHead(200, { "Content-Type": "text/event-stream" }); res.end("data: {bad json}\n\n");
  }, async (baseUrl) => assert.rejects(critique(wav, { baseUrl }), errorCode("E_PROVIDER", 4, false))));
});

test("provider errors redact API key and audio data URL", async () => {
  await missingFfmpeg(() => withServer(async (req, res) => {
    const body = await requestBody(req);
    const content = (body.input as { content: Record<string, string>[] }[])[0]!.content;
    send(res, 400, `bad key secret-123 and ${content[1]!.file_data}`);
  }, async (baseUrl) => {
    await assert.rejects(critique(wav, { baseUrl, apiKey: "secret-123" }), (error: unknown) =>
      errorCode("E_PROVIDER", 4, false)(error) && !(error as Error).message.includes("secret-123")
      && !(error as Error).message.includes("data:audio/") && (error as Error).message.includes("[audio redacted]"));
  }));
});

test("delayed response aborts with retryable timeout", async () => {
  await missingFfmpeg(() => withServer((_req, res) => { setTimeout(() => send(res, 200, response()), 200); }, async (baseUrl) => {
    await assert.rejects(critique(wav, { baseUrl, timeoutMs: 20 }), errorCode("E_TIMEOUT", 7, true));
  }));
});

test("invalid excerpt is input error before transport", async () => {
  for (const excerpt of [0, 121, Number.NaN]) {
    await assert.rejects(critique(wav, { excerpt }), errorCode("E_INPUT", 2));
  }
});

test("live opencodex critique of bars 4:8", { skip: process.env.MUSIC2_LIVE_CRITIC !== "1" }, async () => {
  const songPath = resolve("examples/drill-140.song.json");
  const song = await loadSong(songPath);
  const rendered = await renderSong(song, songPath, { bars: { start: 4, end: 8 } });
  const liveWav = join(dir, "live-excerpt.wav");
  await writeWav(liveWav, rendered.audio, { bits: 16, seed: song.seed });
  const report = await critique(liveWav, { baseUrl: "http://127.0.0.1:10100", model: "google-antigravity/gemini-3.8-flash" });
  assert.equal(report.review.heard_audio, true);
  assert.equal(report.dsp.source, "wav");
  console.log(`LIVE CRITIC ${JSON.stringify({ model: report.model, review: report.review, dsp: {
    estimatedBpm: report.dsp.estimatedBpm, estimatedKey: report.dsp.estimatedKey,
    integratedLufs: report.dsp.integratedLufs, truePeakEstimateDbtp: report.dsp.truePeakEstimateDbtp,
  } })}`);
});
