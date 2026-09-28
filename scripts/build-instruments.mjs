#!/usr/bin/env node
// Builds the bundled sample instruments under instruments/ from pinned public sources.
// Dev-only: node scripts/build-instruments.mjs [--cache <dir>]. Not shipped in the npm package.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readWav } from "../src/audio-io/index.ts";
import { resample } from "../src/sampler/resample.tool.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "instruments");
const argCache = process.argv.indexOf("--cache");
const CACHE = argCache > 0 ? resolve(process.argv[argCache + 1]) : join(homedir(), ".cache", "music2-instruments");
const RATE = 32000;

const SALAMANDER = {
  url: "https://freepats.zenvoid.org/Piano/SalamanderGrandPiano/SalamanderGrandPianoV3+20161209_44khz16bit.tar.xz",
  sha256: "58750eb1366761e187f71ddb9b932355ea894d28ec4331e74ab8acb44c819936",
  dir: "SalamanderGrandPianoV3_44.1khz16bit",
};
const VSCO = { repo: "sgossner/VSCO-2-CE", commit: "440300901dfe9275fd84e0b7763af1f8443ae62e" };

function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function fetchTo(url, path) {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) execFileSync("curl", ["-fL", "-sS", "-o", path, url], { stdio: "inherit" });
}

let seed = 0x6d757332;
function tpdf() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const a = seed / 4294967296;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return a - seed / 4294967296; }
/** Minimal deterministic 16-bit PCM writer for mono or stereo. */
function writePcm16(path, channels, rate) {
  const frames = channels[0].length, n = channels.length;
  const data = Buffer.alloc(frames * n * 2);
  for (let i = 0; i < frames; i++) for (let c = 0; c < n; c++) {
    const v = Math.max(-1, Math.min(1, channels[c][i] + tpdf() / 32768));
    data.writeInt16LE(Math.round(v * 32767), (i * n + c) * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(n, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * n * 2, 28); h.writeUInt16LE(n * 2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([h, data]));
}
/** Trim to seconds with a cosine fade, resample to RATE, optionally fold to mono. */
async function convert(src, dst, { seconds, fade = 0.35, mono }) {
  const a = await readWav(src);
  const n = Math.min(a.left.length, Math.round(seconds * a.sampleRate)), f = Math.min(n, Math.round(fade * a.sampleRate));
  const left = a.left.slice(0, n), right = a.right.slice(0, n);
  for (let i = n - f; i < n; i++) { const g = 0.5 + 0.5 * Math.cos(Math.PI * (i - (n - f)) / f); left[i] *= g; right[i] *= g; }
  const r = resample({ sampleRate: a.sampleRate, left, right, sourceChannels: 2 }, a.sampleRate / RATE, { mode: "sinc" });
  writePcm16(dst, mono ? [r.left.map((v, i) => (v + r.right[i]) / 2)] : [r.left, r.right], RATE);
}
const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const safe = (name) => name.replace("#", "s");

async function grandPiano() {
  const tar = join(CACHE, "salamander.tar.xz");
  fetchTo(SALAMANDER.url, tar);
  if (sha256(tar) !== SALAMANDER.sha256) throw new Error("Salamander tarball checksum mismatch");
  const base = join(CACHE, SALAMANDER.dir);
  if (!existsSync(base)) execFileSync("tar", ["-xJf", tar, "-C", CACHE]);
  const lines = readFileSync(join(base, "SalamanderGrandPianoV3.sfz"), "utf8").split(/\r?\n/);
  const end = lines.findIndex((l) => l.startsWith("//Release string resonances"));
  const layers = { 7: [1, 76], 13: [77, 127] };
  let sfz = "// grand-piano: Salamander Grand Piano V3 by Alexander Holm (CC-BY 3.0), trimmed by scripts/build-instruments.mjs\n<group> amp_veltrack=73 ampeg_release=0.8\n";
  for (const line of lines.slice(0, end)) {
    const m = /sample=44\.1khz16bit\\(\S+?)v(\d+)\.wav.*?lokey=(\d+) hikey=(\d+)/.exec(line); if (!m || !layers[m[2]]) continue;
    const [, note, layer, lo, hi] = m; const key = /pitch_keycenter=(\d+)/.exec(line)?.[1] ?? String(+lo + 1);
    const seconds = +key < 48 ? 3 : +key < 72 ? 2.5 : +key < 90 ? 1.6 : 1;
    const file = "samples/" + safe(note) + "v" + layer + ".wav";
    await convert(join(base, "44.1khz16bit", note + "v" + layer + ".wav"), join(OUT, "grand-piano", file), { seconds, mono: false });
    sfz += "<region> sample=" + file + " lokey=" + lo + " hikey=" + hi + " lovel=" + layers[layer][0] + " hivel=" + layers[layer][1] + " pitch_keycenter=" + key + "\n";
  }
  writeFileSync(join(OUT, "grand-piano", "grand-piano.sfz"), sfz);
}

// VSCO names use Yamaha octaves (middle C = C3): midi = 12 * (octave + 2) + pitch class.
function vscoMidi(name, oct) { return 12 * (Number(oct) + 2) + NAMES.indexOf(name); }
function vscoUrl(path) { return "https://raw.githubusercontent.com/" + VSCO.repo + "/" + VSCO.commit + "/" + path.split("/").map(encodeURIComponent).join("/"); }
function zones(roots) { // contiguous key zones around sorted roots
  return roots.map((r, i) => ({ root: r, lo: i === 0 ? r - 4 : Math.floor((roots[i - 1] + r) / 2) + 1, hi: i === roots.length - 1 ? r + 4 : Math.floor((r + roots[i + 1]) / 2) }));
}
async function vscoSet({ id, sources, split, seconds, header, rr }) {
  const picked = [];
  for (const s of sources) for (const f of s.files) {
    const m = s.re.exec(f); if (!m) continue;
    const midi = vscoMidi(m[1], m[2]); if (s.use(midi)) picked.push({ dir: s.dir, f, midi, layer: m[3], rr: m[4] ?? "1" });
  }
  const roots = [...new Set(picked.map((p) => p.midi))].sort((a, b) => a - b);
  const z = new Map(zones(roots).map((x) => [x.root, x]));
  let sfz = header;
  for (const p of picked.sort((a, b) => a.midi - b.midi || a.layer.localeCompare(b.layer) || a.rr.localeCompare(b.rr))) {
    const cache = join(CACHE, "vsco", p.dir, p.f);
    fetchTo(vscoUrl(p.dir + "/" + p.f), cache);
    const file = "samples/" + safe(p.f.replace(/\.wav$/i, "")) + ".wav";
    await convert(cache, join(OUT, id, file), { seconds, fade: seconds > 1.5 ? 0.4 : 0.08, mono: true });
    const vel = split[p.layer];
    sfz += "<region> sample=" + file + " lokey=" + z.get(p.midi).lo + " hikey=" + z.get(p.midi).hi + " lovel=" + vel[0] + " hivel=" + vel[1] + " pitch_keycenter=" + p.midi
      + (rr ? " seq_length=2 seq_position=" + p.rr : "") + "\n";
  }
  writeFileSync(join(OUT, id, id + ".sfz"), sfz);
}
function listing(dir) {
  const tree = JSON.parse(execFileSync("curl", ["-fsSL", "https://api.github.com/repos/" + VSCO.repo + "/git/trees/" + VSCO.commit + "?recursive=1"], { maxBuffer: 1 << 26 }).toString());
  return tree.tree.filter((x) => x.type === "blob" && x.path.startsWith(dir + "/")).map((x) => x.path.slice(dir.length + 1));
}
async function strings() {
  const cello = listing("Strings/Cello Section/susvib"), violin = listing("Strings/Violin Section/susVib");
  await vscoSet({ id: "strings", seconds: 3, rr: false, split: { 1: [1, 80], 2: [81, 127], 3: [81, 127] },
    header: "// strings: VSCO 2 Community Edition (CC0), cello + violin sections, sustain with vibrato\n<group> amp_veltrack=80 ampeg_attack=0.03 ampeg_release=0.3\n",
    sources: [
      { dir: "Strings/Cello Section/susvib", files: cello.filter((f) => /_1\.wav$/.test(f)), re: /susvib_([A-G]#?)(\d)_v([13])_1\.wav$/, use: (m) => m <= 54 },
      { dir: "Strings/Violin Section/susVib", files: violin, re: /susVib_([A-G]#?)(\d)_v([12])\.wav$/, use: (m) => m >= 55 },
    ] });
  const cs = listing("Strings/Cello Section/spic"), vs = listing("Strings/Violin Section/Spic");
  await vscoSet({ id: "strings-staccato", seconds: 1.2, rr: true, split: { 1: [1, 80], 2: [81, 127] },
    header: "// strings-staccato: VSCO 2 Community Edition (CC0), cello + violin sections, spiccato with two round robins\n<group> amp_veltrack=85 ampeg_release=0.12\n",
    sources: [
      { dir: "Strings/Cello Section/spic", files: cs, re: /spic_([A-G]#?)(\d)_v([12])_RR([12])\.wav$/, use: (m) => m <= 54 },
      { dir: "Strings/Violin Section/Spic", files: vs, re: /Spic_([A-G]#?)(\d)_v([12])_rr([12])\.wav$/, use: (m) => m >= 55 },
    ] });
}

const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
if (!only || only === "grand-piano") await grandPiano();
if (!only || only === "strings") await strings();
console.log("instruments written to", OUT);

