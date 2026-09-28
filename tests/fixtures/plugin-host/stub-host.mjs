#!/usr/bin/env node
// Deterministic protocol fixture; no third-party plugin is loaded.
import { readFile, writeFile, symlink } from "node:fs/promises";
import { basename } from "node:path";

const protocol = "music2-plugin-bridge/1";
const mode = process.argv[2] ?? "normal";
const source = await new Promise(resolve => {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { input += chunk; });
  process.stdin.on("end", () => resolve(input));
});
const request = JSON.parse(source);
if (request.protocol !== protocol || !["probe", "render", "selftest"].includes(request.op)) process.exit(2);
console.error("stub-host diagnostic");
if (mode === "crash") process.exit(4);
if (mode === "delay") await new Promise(resolve => setTimeout(resolve, 5000));
if (mode === "flood") { process.stdout.write("x".repeat(70000)); process.exit(0); }
if (mode === "invalid-json") { process.stdout.write("{"); process.exit(0); }
if (request.op === "probe") {
  console.log(JSON.stringify({ protocol: mode === "bad-protocol" ? "invalid" : protocol, ok: true, op: "probe",
    hostVersion: "stub/1", capabilities: { audioEffect: true }, ...(mode === "old-pedalboard" ? { pedalboard: "0.7.5" } : {}) }));
  process.exit(0);
}
if (request.op === "selftest") {
  console.log(JSON.stringify({ protocol, ok: true, op: "selftest", hostVersion: "stub/1", frames: 48000,
    sampleRate: 48000, peak: 0.2505936, correlation: 1 }));
  process.exit(0);
}
if (request.input?.kind !== "wav" || request.chain?.length !== 1 || request.output?.format !== "f32") process.exit(2);
const bytes = await readFile(request.input.wavPath);
if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") process.exit(2);
const frames = Math.round(request.durationSec * request.sampleRate);
const out = Buffer.from(bytes);
const name = basename(request.chain[0].path);
const gain = name.startsWith("b") ? 0.25 : 0.5;
let peak = 0, energy = 0;
for (let i = 0; i < frames * 2; i++) {
  const val = out.readFloatLE(58 + i * 4) * gain;
  out.writeFloatLE(val, 58 + i * 4);
  peak = Math.max(peak, Math.abs(val)); energy += val * val;
}
if (mode === "nan") out.writeFloatLE(NaN, 58);
if (mode === "over") out.writeFloatLE(64.125, 58);
if (mode === "headroom") out.writeFloatLE(1.25, 58);
if (mode === "symlink") await symlink(request.input.wavPath, request.output.wavPath);
else await writeFile(request.output.wavPath, out);
console.log(JSON.stringify({ protocol, ok: true, wavPath: mode === "wrong-path" ? request.input.wavPath : request.output.wavPath,
  frames: mode === "wrong-frames" ? frames - 1 : frames, sampleRate: mode === "wrong-rate" ? 44100 : request.sampleRate,
  channels: mode === "wrong-channels" ? 1 : 2, peak, rms: Math.sqrt(energy / (frames * 2)),
  latencySamples: [0], hostVersion: "stub/1", warnings: [] }));
