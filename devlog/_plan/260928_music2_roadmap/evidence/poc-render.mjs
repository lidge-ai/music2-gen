import { mini } from '@strudel/mini';
import { writeFileSync } from 'node:fs';

const BPM = 140, SR = 44100, BARS = 8;
const SPC = 4 * 60 / BPM;                 // seconds per cycle (= one bar)
const N = Math.ceil((BARS * SPC + 2.5) * SR);
const L = new Float32Array(N), R = new Float32Array(N), SEND = new Float32Array(N);

// ---- Strudel mini-notation: drill arrangement (C minor, half-time snare on 3) ----
const P = {
  hats:  mini('<[hh hh hh hh hh hh hh hh] [hh hh hh [hh hh hh] hh hh [hh hh hh hh] hh] [hh hh [hh hh hh] hh hh hh hh [hh hh hh]] [hh hh hh hh [hh hh hh hh] hh [hh hh hh] [hh hh hh hh hh hh]]>'),
  snare: mini('<[~ ~ sd ~] [~ ~ sd [~ ~ ~ sd]] [~ ~ sd ~] [~ ~ sd [~ sd ~ ~]]>'),
  kick:  mini('<[bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]>'),
  b808:  mini('<[c2 ~ ~ ~ ~ ~ c2 ~ ~ ~ eb2 ~ ~ ~ ~ ~] [c2 ~ ~ ~ ~ ~ ~ ~ ~ ~ g1 ~ ~ ~ bb1 c2] [ab1 ~ ~ ~ ~ ~ ab1 ~ ~ ~ c2 ~ ~ ~ ~ ~] [g1 ~ ~ ~ ~ ~ ~ ~ ~ ~ g2 ~ f2 ~ d2 ~]>'),
  bell:  mini('<[c5 ~ eb5 ~ g5 ~ ~ ~ ab5 ~ g5 ~ eb5 ~ ~ ~] [c5 ~ eb5 ~ g5 ~ ~ ~ b4 ~ ~ ~ d5 ~ ~ ~] [c5 ~ eb5 ~ g5 ~ ~ ~ ab5 ~ g5 ~ eb5 ~ f5 ~] [d5 ~ ~ ~ b4 ~ ~ ~ g4 ~ ~ ~ b4 ~ d5 ~]>'),
  pad:   mini('<[c3,eb3,g3] [c3,eb3,g3] [ab2,c3,eb3] [g2,b2,d3]>'),
};
const ev = (p) => p.queryArc(0, BARS).filter(e => e.whole && e.hasOnset())
  .map(e => ({ t: e.whole.begin.valueOf() * SPC, d: (e.whole.end.valueOf() - e.whole.begin.valueOf()) * SPC, v: e.value }));

const midi = (s) => { const m = /^([a-g])(b|#|s)?(-?\d)$/.exec(s); const b = {c:0,d:2,e:4,f:5,g:7,a:9,b:11}[m[1]];
  return 12 * (+m[3] + 1) + b + (m[2] === 'b' ? -1 : m[2] ? 1 : 0); };
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 1; const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
const add = (i, x, pan = 0, send = 0) => { if (i < 0 || i >= N) return; L[i] += x * (1 - pan) ; R[i] += x * (1 + pan); SEND[i] += x * send; };

// kick: short pitched thump (the 808 carries the sub)
for (const e of ev(P.kick)) { const s0 = Math.round(e.t * SR); let ph = 0;
  for (let k = 0; k < 0.18 * SR; k++) { const t = k / SR; ph += 2 * Math.PI * (48 + 110 * Math.exp(-t / 0.03)) / SR;
    add(s0 + k, 0.55 * Math.sin(ph) * Math.exp(-t / 0.06)); } }

// 808: monophonic sine with glide into each note and tanh drive; sustains to the next note
{ const es = ev(P.b808); let prev = hz(midi(es[0].v)), ph = 0;
  es.forEach((e, i) => { const target = hz(midi(e.v)); const s0 = Math.round(e.t * SR);
    const end = i + 1 < es.length ? es[i + 1].t : e.t + SPC; const len = Math.round((end - e.t) * SR);
    const from = prev;
    for (let k = 0; k < len; k++) { const t = k / SR; const f = target + (from - target) * Math.exp(-t / 0.035);
      ph += 2 * Math.PI * f / SR; const env = Math.min(1, t / 0.003) * Math.exp(-t / 1.1) * Math.min(1, (len - k) / (0.008 * SR));
      add(s0 + k, 0.5 * Math.tanh(2.2 * Math.sin(ph)) * env); }
    prev = target; }); }

// snare/clap: filtered noise burst + tonal body, a little reverb
for (const e of ev(P.snare)) { const s0 = Math.round(e.t * SR); let lp = 0, ph = 0;
  for (let k = 0; k < 0.25 * SR; k++) { const t = k / SR; const n = noise(); lp += 0.35 * (n - lp); const hp = n - lp;
    ph += 2 * Math.PI * 190 / SR;
    const x = 0.32 * hp * Math.exp(-t / 0.07) + 0.18 * Math.sin(ph) * Math.exp(-t / 0.04);
    add(s0 + k, x, 0, 0.15); } }

// hats: highpassed noise ticks; rolls get quieter inside a step, slight L/R movement
ev(P.hats).forEach((e, i) => { const s0 = Math.round(e.t * SR); const roll = e.d < SPC / 8 - 1e-6; let lp = 0;
  const g = (roll ? 0.09 : 0.13) * (i % 2 ? 0.8 : 1), pan = Math.sin(i * 0.9) * 0.25;
  for (let k = 0; k < 0.035 * SR; k++) { const n = noise(); lp += 0.6 * (n - lp); add(s0 + k, g * (n - lp) * Math.exp(-k / SR / 0.012), pan); } });

// bell lead: 2-op FM, decaying index, big reverb send, ping-pong-ish pan
ev(P.bell).forEach((e, i) => { const s0 = Math.round(e.t * SR), f = hz(midi(e.v)); const pan = i % 2 ? 0.3 : -0.3;
  for (let k = 0; k < 1.4 * SR; k++) { const t = k / SR; const idx = 2.2 * Math.exp(-t / 0.25);
    const x = Math.sin(2 * Math.PI * f * t + idx * Math.sin(2 * Math.PI * f * 3.5 * t)) * Math.exp(-t / 0.45);
    add(s0 + k, 0.1 * x, pan, 0.55); } });

// pad: detuned saws through a one-pole lowpass, slow swell (dark bed)
for (const e of ev(P.pad)) { const s0 = Math.round(e.t * SR), f = hz(midi(e.v)); const len = Math.round(e.d * SR); let lp = 0;
  for (let k = 0; k < len + 0.3 * SR; k++) { const t = k / SR; let x = 0;
    for (const dt of [-0.12, 0, 0.11]) x += ((f * (1 + dt / 100) * t) % 1) * 2 - 1;
    lp += 0.03 * (x / 3 - lp); const env = Math.min(1, t / 0.4) * (k < len ? 1 : Math.exp(-(k - len) / SR / 0.1));
    add(s0 + k, 0.05 * lp * env, 0, 0.4); } }

// Schroeder reverb on the send bus
{ const combs = [1557, 1617, 1491, 1422].map(d => ({ b: new Float32Array(d), i: 0 })), aps = [225, 556].map(d => ({ b: new Float32Array(d), i: 0 }));
  for (let n = 0; n < N; n++) { let y = 0; for (const c of combs) { const o = c.b[c.i]; c.b[c.i] = SEND[n] + o * 0.82; c.i = (c.i + 1) % c.b.length; y += o; }
    y /= 4; for (const a of aps) { const o = a.b[a.i]; const v = y + o * 0.5; a.b[a.i] = v; a.i = (a.i + 1) % a.b.length; y = o - v * 0.5; }
    L[n] += 0.35 * y; R[n] += 0.35 * (n > 300 ? y : 0); } }

// master: soft clip, normalize to -1 dBFS, 16-bit stereo WAV
let peak = 0; for (let n = 0; n < N; n++) { L[n] = Math.tanh(L[n] * 1.2); R[n] = Math.tanh(R[n] * 1.2); peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n])); }
const gain = 0.89 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) { buf.writeInt16LE(Math.round(L[n] * gain * 32767), 44 + n * 4); buf.writeInt16LE(Math.round(R[n] * gain * 32767), 46 + n * 4); }
writeFileSync(process.argv[2] ?? 'drill-140.wav', buf);
console.log('events', Object.fromEntries(Object.entries(P).map(([k, p]) => [k, ev(p).length])), 'seconds', (N / SR).toFixed(1));

