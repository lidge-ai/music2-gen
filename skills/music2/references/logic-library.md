# Logic Pro and GarageBand sample content

Logic Pro and GarageBand install recorded instruments and drum kits on the Mac. music2 can play them through `sfz:` and `kit:` after the files are copied into your song directory, converted to WAV, and (for pitched instruments) given a checked pitch centre. Everything below was run on one machine with music2 0.2.0, the Logic content folders and GarageBand installed (the Logic Pro app itself was not). The content is absent on other machines, so a song that uses it renders only where you keep your own copy of the samples. Re-run the checks on your install before relying on a number.

## Where the content lives and what is usable

| Content | Location | What it is (observed) | Usable as-is? |
| --- | --- | --- | --- |
| Alchemy Samples | `/Library/Application Support/Logic/Alchemy Samples/<category>/<group>/<instrument>/` | 669 WAV, mostly 44.1 kHz 16-bit mono or stereo; 583 carry a `smpl` chunk (unity note) and 476 of those a loop. Also 102 `.aaz` files, which are presets, not audio. | Yes, as `sfz:` regions, after the octave check below. Rewrite the WAV only if it fails to decode. |
| Ultrabeat Samples | `/Library/Application Support/Logic/Ultrabeat Samples/` (`Drum Machine Designer/<kit> GB/Kick_1_…`, older kits beside it) | 490 AIFF, some 24-bit. | No. Convert to WAV, then use as `kit:` one-shots. |
| EXS Factory Samples and Sampler Instruments | `…/Logic/EXS Factory Samples/`, `…/Logic/Sampler Instruments/` | 21 CAF files named `…_consolidated`; 20 of them run longer than 30 s. 60 `.exs` files hold the zone maps. | No. music2 does not read `.exs`, so a consolidated file has no note map; use `music2 slice` only if you want chopped material. |
| Apple Loops | `/Library/Audio/Apple Loops/Apple/<style>/` | 1745 CAF, AAC-encoded (lossy). | No. Convert to WAV, then `music2 slice` or a `kit:` one-shot. |
| GarageBand | `/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Files/<instrument>/` | 518 WAV (44.1 kHz 16-bit stereo, 516 with `smpl`), 116 `.aif`, 124 AIFF files with no extension, 6 `.exs`. | The WAV files, as `sfz:`. Convert the AIFF files. |

The Logic `Samples/Quicksampler` folder was not inspected. Folder names change between Logic versions, so list the directories on your machine first.

**Licence.** Apple content is licensed for use in your own music, not for redistribution as a library. I read the GarageBand licence PDF on this machine (`GarageBand.app/Contents/Resources/GarageBand License Agreement.pdf`). It allows royalty-free use of the included samples and loops to create your own original soundtracks, and lets you distribute those soundtracks. It forbids distributing the content on a standalone basis, repackaging it as samples or sound libraries, using it outside its intended use as part of the Apple software, and using it to train or test software such as sound generators. Whether rendering through music2 is inside that intent is your decision, so read the licence text that came with your own install and decide before you build on it. Renders and stems are your music. Never commit the copied WAV files, the SFZ or `kit.json` folders built from them, or a package that contains them; keep them in an ignored directory or outside the repository.

## Which route to use

| Route | Use it for | Needs | Errors seen with the wrong input |
| --- | --- | --- | --- |
| `kit:<dir>` | Drum one-shots, FX hits, a single pitched sample | `kit.json` in the kit directory; a drums or notes track; WAV files inside the kit directory | AIFF or CAF file: E_SCHEMA "cannot decode sample" (exit 2). Absolute path or path outside the kit: E_ACCESS (exit 4). Pattern atom missing from the manifest: E_SCHEMA "missing sample". Unknown manifest key: E_SCHEMA "unknown field". |
| `sfz:<file>.sfz` | Pitched multisamples with loops and envelopes | A notes track; `.sfz` inside the song directory; WAV files inside the `.sfz` directory | `.aif` or `.caf` region: E_CAPABILITY "SFZ has no playable regions" (exit 3), after the region is disabled with a warning. AIFF renamed `.wav`: E_INPUT "invalid SFZ sample WAV". Extensible, 3-channel or unpadded WAV: E_INPUT. Sample outside the `.sfz` directory, absolute, or symlinked out of the tree: E_ACCESS. `.sfz` outside the song directory: E_SCHEMA "invalid sfz reference". Drums track: E_SCHEMA. Uppercase opcode: region disabled, then E_CAPABILITY if none remain. Any `params`: E_SCHEMA "unknown parameter". |
| `lib:<id>` | The packaged recorded strings, brass and piano (see [instruments](instruments.md)) | A notes track | Unknown id: E_SCHEMA listing valid ids. Drums track: E_SCHEMA "requires notes track". Needs no local copies; licences are in `THIRD_PARTY_NOTICES.md`. |
| `sfx` voice | Risers, impacts, downlifters from built-in synthesis | A drums track | Notes track: E_SCHEMA "requires drums track". Unknown atom: E_SCHEMA. Out-of-range parameter: E_SCHEMA. See [sfx](sfx.md). |

Choose `kit:` for anything triggered as a hit, `sfz:` when the sound must follow the melody, and `lib:` when the packaged instrument is good enough, since it needs no local content. Automatable voice parameters (`pad.cutoffHz`, `bass.cutoffHz`, `lead.vibratoCents`) do not exist on `sfz:`, `lib:` or `kit:`; gain, pan, sends and `fx` automation still work. The rest of the caps (32 tracks, 12 track effects) apply to sample tracks as usual.

## Check the pitch centre before you trust an instrument

Alchemy file names and `smpl` unity notes are unreliable. In the folders checked, the note in the name was off by whole octaves, and the unity note was often off too:

| Alchemy instrument | Name vs measured pitch | `pitch_keycenter=sample` |
| --- | --- | --- |
| Pads/Analog/Lush Bright Pad | name is 24 semitones high (file `C4` sounds as C2) | 12 semitones high |
| Synth/Analog/Huge Saw | name is 12 low | not checked |
| Bass/Analog Bass/Mini 2 Saw Bass | name is 12 high | not checked |
| GarageBand Clarinet_stac_mp1 (one folder) | correct | correct |

Other folders varied inside one instrument: Holy Ghost measured 0 or +12 per file, Formant Ah +12 with two files at +24 and +36, Bell Attack Pad −12 or −24, and Grungy Spike anywhere from 0 to −72 (low bass notes are beyond what this measurement resolves, so audition that one). Measure every instrument, and use per-file offsets when the list is not constant. The measurement picks the octave of the named pitch class with the strongest harmonic series, inside the `smpl` loop region (the steady part). `wavlib.mjs` is shared by the snippets below.

```js
// wavlib.mjs: PCM16/24/float32 WAV reader (also returns smpl unity note and first loop) + pitch helpers
import fs from "node:fs";
export function readWav(file) {
  const b = fs.readFileSync(file); let fmt, data, smpl = null;
  for (let o = 12; o + 8 <= b.length;) {
    const id = b.toString("latin1", o, o + 4), size = Math.min(b.readUInt32LE(o + 4), b.length - o - 8);
    if (id === "fmt ") fmt = { tag: b.readUInt16LE(o + 8), ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === "data") data = { at: o + 8, size };
    if (id === "smpl") smpl = { unity: b.readUInt32LE(o + 20), loop: b.readUInt32LE(o + 36) ? [b.readUInt32LE(o + 52), b.readUInt32LE(o + 56)] : null };
    o += 8 + size + (size & 1);
  }
  const w = fmt.bits / 8, n = Math.floor(data.size / w / fmt.ch);
  const ch = Array.from({ length: fmt.ch }, (_, c) => Float64Array.from({ length: n }, (_, i) => {
    const p = data.at + (i * fmt.ch + c) * w;
    return fmt.tag === 3 ? b.readFloatLE(p) : fmt.bits === 16 ? b.readInt16LE(p) / 32768 : b.readIntLE(p, 3) / 8388608;
  }));
  return { ch, sr: fmt.sr, smpl, mono: fmt.ch === 1 ? ch[0] : ch[0].map((v, i) => (v + ch[1][i]) / 2) };
}
function goertzel(x, a, n, f, sr) {
  const c = 2 * Math.cos(2 * Math.PI * f / sr); let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const s0 = x[a + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))) + c * s1 - s2; s2 = s1; s1 = s0; }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2));
}
// best candidate MIDI note by harmonic product (octave errors score low); harm=1 for a pure sine
export function pitchOf(x, sr, a, n, cands, harm = 4) {
  let best = { m: 0, h: -1 };
  for (const m of cands) { let h = 1; for (let k = 1; k <= harm; k++) h *= goertzel(x, a, n, k * 440 * 2 ** ((m - 69) / 12), sr); if (h > best.h) best = { m, h }; }
  return best.m;
}
```

```js
// octave.mjs <sample-folder>: measured pitch minus the note in each file name (C4 = 60)
import fs from "node:fs";
import { readWav, pitchOf } from "./wavlib.mjs";
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, offsets = [], dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".wav")).sort()) {
  const m = /([A-G])([#b]?)(-?\d)\.wav$/.exec(f); if (!m) continue;
  const pc = (PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12, named = 12 * (Number(m[3]) + 1) + pc;
  const { mono, sr, smpl } = readWav(dir + "/" + f), loop = smpl?.loop && smpl.loop[1] - smpl.loop[0] > 8192 ? smpl.loop : null;
  const a = loop ? loop[0] : 2205, n = Math.min(32768, loop ? loop[1] - loop[0] : mono.length - a), cands = [];
  for (let k = pc + 12; k <= 96; k += 12) cands.push(k);
  const midi = pitchOf(mono, sr, a, n, cands); offsets.push(midi - named);
  console.log(f, "named", named, "measured", midi, "offset", midi - named, "smpl unity", smpl?.unity ?? "-");
}
offsets.sort((x, y) => x - y); console.log("median offset", offsets[offsets.length >> 1]);
```

On the Lush Bright Pad folder this prints an offset of -24 for all 11 files, with `smpl unity` 12 above the measured pitch. Set `pitch_keycenter` to the named note plus the median offset, per file when a file is an outlier. There is also a one-line alternative: `<control> octave_offset=2` shifts the incoming note by 24 semitones for both region lookup and pitch, so keep the *named* keycenters and key ranges. Both fixes rendered the correct scale in my test; `octave_offset` moves the key ranges you wrote, so an explicit `pitch_keycenter` is easier to reason about.

**Verify by rendering a scale.** Render a short scale on the instrument (one note per bar-fraction, sustained), then confirm each note's pitch in the file, not only the SFZ text:

```js
// detect.mjs <render.wav> <slot-seconds> <expected,midi,list> [start-in-slot=0.4] [harmonics=4]
import { readWav, pitchOf } from "./wavlib.mjs";
const [file, slot, list, start = "0.4", harm = "4"] = process.argv.slice(2);
const { mono, sr } = readWav(file), cands = []; let bad = 0;
for (let m = 24; m <= 96; m += 0.25) cands.push(m);
list.split(",").map(Number).forEach((want, k) => {
  const a = Math.round((k * Number(slot) + Number(start)) * sr), got = pitchOf(mono, sr, a, 16384, cands, Number(harm)), ok = Math.abs(got - want) <= 0.35;
  if (!ok) bad++; console.log("want", want, "got", got.toFixed(2), ok ? "ok" : "WRONG");
});
process.exit(bad ? 1 : 0);
```

```sh
# song has one notes track: "instrument": "sfz:inst/pad/pad.sfz", "pattern": "c3 e3 g3 c4", "gate": 0.7, bpm 60 (one note per second)
music2 render scale.song.json -o scale.wav --bits 16
node detect.mjs scale.wav 1 48,52,55,60      # exit 0 and four "ok" lines when the instrument is in tune
```

With the uncorrected name-based keycenters the same scale reported every note 24 semitones low (exit 1). With the fix all four read within 0.25 semitone. Measure the sustained part (the default 0.4 s into the slot), keep notes mono and separate, and use `harmonics=1` for a pure sine, since the harmonic product needs overtones. On the packaged `lib:strings`, one note read an octave high while the window still covered the slow attack, and was correct once the window moved, so move the window before blaming an instrument for a single "WRONG".

## Clean and convert files into WAV that music2 decodes

The WAV reader accepts PCM 16/24/32-bit or float32, 1 or 2 channels, 8–192 kHz. It rejects with E_INPUT: `WAVE_FORMAT_EXTENSIBLE` (tag 65534), 8-bit, 64-bit float, three or more channels, RF64, and a non-final odd-sized chunk that lacks its pad byte. On this machine all 669 Alchemy and all 518 GarageBand WAV files decoded unchanged. A hand-made file with an unpadded odd chunk failed as `E_INPUT invalid SFZ sample WAV` and worked after this rewrite, which keeps only `fmt`, `smpl` and `data` and restores padding:

```js
// cleanwav.mjs <in.wav> <out.wav>
import fs from "node:fs";
const b = fs.readFileSync(process.argv[2]), keep = {};
const isId = (p) => p + 8 <= b.length && /^[ -~]{4}$/.test(b.toString("latin1", p, p + 4));
for (let o = 12; o + 8 <= b.length;) {
  const id = b.toString("latin1", o, o + 4), size = Math.min(b.readUInt32LE(o + 4), b.length - o - 8);
  if (["fmt ", "smpl", "data"].includes(id)) keep[id] = b.subarray(o + 8, o + 8 + size);
  const next = o + 8 + size; o = size & 1 && !isId(next) ? next + 1 : next; // a correct file has a zero pad byte here
}
const parts = [];
for (const id of ["fmt ", "smpl", "data"]) { const body = keep[id]; if (!body) continue;
  const head = Buffer.alloc(8); head.write(id, 0, "latin1"); head.writeUInt32LE(body.length, 4); parts.push(head, body); if (body.length & 1) parts.push(Buffer.alloc(1)); }
const payload = Buffer.concat(parts), riff = Buffer.alloc(12);
riff.write("RIFF", 0, "latin1"); riff.writeUInt32LE(payload.length + 4, 4); riff.write("WAVE", 8, "latin1");
fs.writeFileSync(process.argv[3], Buffer.concat([riff, payload]));
```

For AIFF, CAF and extensionless AIFF, convert with ffmpeg to 16-bit PCM (or float32):

```sh
ffmpeg -v error -y -i "Kick_1_PileDriver_GB.aif" -c:a pcm_s16le kick.wav     # pcm_f32le also decodes and keeps 24-bit detail
```

| Converter and codec | Result on the 490 Ultrabeat AIFF files |
| --- | --- |
| `ffmpeg -c:a pcm_s16le` | 490 of 490 decode |
| `ffmpeg -c:a pcm_f32le` | 490 of 490 decode (format tag 3) |
| `ffmpeg -c:a pcm_s24le` | 0 of 490: written as tag 65534, rejected |
| `afconvert -f WAVE -d LEI16@44100` and `LEI24@44100` | 468 of 490; 22 files with a channel layout come out as 65534 and are rejected |

Also decoded after `-c:a pcm_s16le`: all 21 EXS CAF files, all 124 extensionless GarageBand AIFF files, and the first 300 Apple Loops. The conversion drops the loop and unity information (a converted file holds only `fmt`, `LIST` and `data`), so converted material needs explicit `pitch_keycenter`, `loop_start` and `loop_end` if it should sustain. Renaming an AIFF to `.wav` does not work (E_INPUT, chunk `RIFF`). Copy or convert into your song directory: a symlink into `/Library` fails with E_ACCESS.

## Build an SFZ multisample

Copy the instrument folder into the song tree, for example `inst/pad/` (spaces and `#` in sample names rendered fine, but shorter names are easier to script). A generator that writes one region per file, with keycenter = name + offset and key ranges split halfway between neighbours:

```js
// build-sfz.mjs <folder> <offset> <out.sfz>
import fs from "node:fs";
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, [dir, off, out] = process.argv.slice(2);
const rows = fs.readdirSync(dir).flatMap((f) => { const m = /([A-G])([#b]?)(-?\d)\.wav$/.exec(f);
  return m ? [{ f, root: 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + Number(off) }] : []; }).sort((a, b) => a.root - b.root);
const lines = ["<group> ampeg_attack=0.02 ampeg_release=0.3"];
rows.forEach((r, i) => { const lo = i ? Math.floor((rows[i - 1].root + r.root) / 2) + 1 : 0, hi = i < rows.length - 1 ? Math.floor((r.root + rows[i + 1].root) / 2) : 127;
  lines.push("<region> sample=" + r.f + " pitch_keycenter=" + r.root + " lokey=" + lo + " hikey=" + hi); });
fs.writeFileSync(out, lines.join("\n") + "\n");
```

Opcodes are lowercase only, notes use C4 = 60, and a sample path is relative to the `.sfz`. I measured the loop and envelope behaviour on one 4-second looped pad (loop 1.5 s to 3.05 s), playing `c4` from a keycenter 24 semitones lower for 6 s at 40 bpm, then reading RMS in windows:

| Opcodes on the region | Measured |
| --- | --- |
| none for the loop | The `smpl` forward loop is used automatically; level stayed near -12 dB through 5.5 s. |
| `loop_mode=no_loop` or `one_shot` | Silent once the transposed sample ended (about 1 s at +24 semitones). |
| `loop_mode=loop_continuous loop_start=70000 loop_end=130000` | Sustained with the explicit points. |
| `ampeg_release` default | 0.001 s: silent within 50 ms of the note end. Set 0.2–2 for pads: with 2 the tail read -15 dB 0.05–0.2 s after the note end and -33 dB at 0.5–0.7 s. |
| `ampeg_attack=1.5` | -24 dB at 0.2–0.4 s against -10 dB with 0.01. |
| `ampeg_decay=0.3 ampeg_sustain=25` | Held level fell by about 7.5 dB, not the 12 dB a 25% amplitude would suggest, so measure it. |

Only forward loops (`smpl` loop type 0) are read. `pitch_keycenter=sample` uses the `smpl` unity note and falls back to 60 with a warning when it is missing. The SFZ is decoded within a 512 MiB budget per render (about 8 bytes per frame after decoding), so a large orchestral folder can fail with E_CAPABILITY "decoded PCM exceeds render budget"; a single 30-minute mono sample reproduced it, and `kit:` did not hit that limit. Keep regions to the notes and layers you use.

## Build a drum kit

Convert each one-shot into the kit directory and map names to the atoms you will write in patterns. Ultrabeat "Drum Machine Designer" kits share names (`Kick_1`, `Snare_1`, `Clap_1`, `Hi-Hat_1`, `Hi-Hat_Open`), so different kits can supply the same slots.

```sh
mkdir -p kit
ffmpeg -v error -y -i "…/Kick_1_PileDriver_GB.aif"    -c:a pcm_s16le kit/bd.wav
ffmpeg -v error -y -i "…/Kick_2_PileDriver_GB.aif"    -c:a pcm_s16le kit/bd-alt.wav
ffmpeg -v error -y -i "…/Snare_1_PileDriver_GB.aif"   -c:a pcm_s16le kit/sd.wav
ffmpeg -v error -y -i "…/Hi-Hat_1_PileDriver_GB.aif"  -c:a pcm_s16le kit/hh.wav
```

```json
{
  "version": 1,
  "gainDb": 0,
  "samples": { "bd": ["bd.wav", "bd-alt.wav"], "sd": ["sd.wav"], "hh": ["hh.wav"] },
  "midi": { "bd": 36, "sd": 38, "hh": 42 }
}
```

The track is `{ "id": "kick", "kind": "drums", "instrument": "kit:kit", "pattern": "bd ~ bd:1 ~" }`; `bd:1` picks the second variant. The `midi` map decides the note numbers in `export midi` (my export wrote exactly the mapped numbers on channel 10 and dropped the variant choice, reporting `drumVariantsDropped`). Keys allowed in `kit.json`: `version`, `samples`, `gainDb`, `rootMidi`, `midi` (0–127, no duplicates), `startMs` (0–10000). Kits fold stereo to mono and pitch by resampling. A note kit (`samples: { "note": […] }`, `rootMidi`) transposed a sine correctly, but the sample plays to its end regardless of `gate`; with the default polyphony consecutive notes overlap, so set `"mono": true` on the track to have each note cut the previous one (all four scale notes then read correctly). `music2 slice loop.wav -o dir` writes a `kit.json` and a song from a converted loop; a converted Apple Loop produced 44 slices.

## Layer and calibrate

Do this before adding more layers, after the pitch check passes.

1. Export the stems once through the CLI: `music2 export stems song.json -o stems --premaster --bits 24`. The bundle holds `tracks/<id>.wav`, `premaster.wav`, `master.wav` and `stems.json`. Track gain and ducking are already in each stem; reverb and delay come out as separate `returns/` files.
2. Measure every stem's gated loudness. `music2 analyze <stem> --out <dir>` reports `integratedLufs` but also writes spectrograms; on a 34-second file it took 1.9 s against 0.06 s for the meter below, which stayed within 0.1 dB. Always pass `--out`; without it `analyze` writes into your `~/.music2` directory.
3. Set each track's `gain` to `gain + target − measured` (clamped to −60…+12). Loudness moves one-to-one with gain when the track has no dynamics effect, so one pass landed all four test stems on target (−22, −30, −24, −26 LUFS); re-export once to confirm.
4. Give the low owner and the kick a ducking relationship (see [layering](layering.md)). `duck.by` names one track and reads that track's note onsets, not its audio, so a kick track set to `"gain": -60` ducked a pad by exactly the same amount as an audible one. Use one quiet trigger track that repeats the kick pattern to duck every layer of a kick group. Ducking is baked into the stems: the same pad measured -22.3 LUFS without a duck and -24.0 with it at equal gain, so calibrate with the final duck settings.

```js
// lufs.mjs <wav...>: gated integrated loudness (RBJ K-weighting, 400 ms blocks, -70 / -10 LU gates)
import { readWav } from "./wavlib.mjs";
function biquad(type, f, q, gainDb, sr) {
  const A = 10 ** (gainDb / 40), w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q); let b0, b1, b2, a0, a1, a2;
  if (type === "highpass") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cs + s); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s);
    a0 = (A + 1) - (A - 1) * cs + s; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s; }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function run(x, [b0, b1, b2, a1, a2]) { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
export function lufs(file) {
  const { ch, sr } = readWav(file), hop = Math.round(0.1 * sr), n = ch[0].length, seg = new Float64Array(Math.ceil(n / hop));
  for (const x of ch) { const y = run(run(x, biquad("highshelf", 1681.97, 0.7072, 4, sr)), biquad("highpass", 38.135, 0.5003, 0, sr));
    for (let i = 0; i < n; i++) seg[(i / hop) | 0] += y[i] * y[i]; }
  const L = (z) => -0.691 + 10 * Math.log10(z), blocks = [];
  for (let k = 0; k + 4 <= seg.length; k++) blocks.push((seg[k] + seg[k + 1] + seg[k + 2] + seg[k + 3]) / (4 * hop));
  const above = blocks.filter((z) => z > 0 && L(z) > -70); if (!above.length) return null;
  const rel = L(above.reduce((s, z) => s + z, 0) / above.length) - 10, kept = above.filter((z) => L(z) > rel);
  return L(kept.reduce((s, z) => s + z, 0) / kept.length);
}
if (process.argv[1]?.endsWith("lufs.mjs")) for (const f of process.argv.slice(2)) console.log(f, (lufs(f) ?? NaN).toFixed(2), "LUFS");
```

A track that never plays gives null (`NaN` printed); skip it. Thirty stacked sample layers stayed clear when each stem was trimmed toward a role target this way (reported from a real project, not re-run here). Pick targets by role (kick loudest, then bass, then pads, then hats); the absolute values are your taste, and `analyze` on the final render decides the master.

## Render safely and shard honestly

Render one song at a time; several full renders in parallel fight for CPU. A 4-minute, 30-track sample song took about 90 s in one process in a real project (reported, not re-run). In my test a 13-track song (12 SFZ pads and a kick) of 16 bars (34 s) took 38 s, and a 25-track 64-bar version ran past five minutes at about 1 GB resident memory before I stopped it. Each render has its own 512 MiB decoded-sample budget, so shards do not add to one another.

The CLI has no `render --jobs` and no flag that splits work; you can only run several `music2` processes on song files you write yourself. What I tested, using only the CLI plus a summing script:

- Split the tracks over N shard songs, always keeping the kick (or any `duck.by` source) in every shard. Without it validation fails: E_SCHEMA "unknown track" at `duck.by`, and a section `patterns` entry naming a removed track fails the same way, so delete those entries in each shard.
- Write each shard song **next to the original**. Sample paths resolve relative to the song file; a shard written in another directory failed with E_ACCESS "cannot read kit.json".
- Export each shard with `music2 export stems shard-K.song.json -o shards/sK --premaster --no-master --bits 24 --force`. Use 24-bit: 16-bit output is dithered and rounding noise adds when shards are summed.
- Add the shards' `premaster.wav` files, subtracting the kick stem from every shard except one.

```js
// sum-shards.mjs <full-premaster.wav> <shard-dir>...: shard 1 as is, the rest minus their own kick stem; prints the error against the full render
import { readWav } from "./wavlib.mjs";
const [full, ...dirs] = process.argv.slice(2), ref = readWav(full).ch, sum = ref.map((c) => new Float64Array(c.length));
dirs.forEach((d, k) => { const part = readWav(d + "/premaster.wav").ch, kick = k ? readWav(d + "/tracks/kick.wav").ch : null;
  part.forEach((c, i) => c.forEach((v, j) => { sum[i][j] += v - (kick ? kick[i][j] : 0); })); });
let err = 0, peak = 0; ref.forEach((c, i) => c.forEach((v, j) => { err = Math.max(err, Math.abs(v - sum[i][j])); peak = Math.max(peak, Math.abs(v)); }));
console.log("max error", err.toExponential(2), (20 * Math.log10(err / peak || 1e-12)).toFixed(1), "dB re peak; 24-bit step is 1.19e-07");
```

Measured, with the stems and the full pre-master both from the CLI:

| Song | Shards | Result |
| --- | --- | --- |
| 5 tracks, 8 bars, reverb and delay sends, two ducked tracks | 2 and 4 (run one after another) | Sum matched the full pre-master to -127 dB and -124 dB re peak (2–3 steps of 24 bits) |
| 13 tracks, 16 bars, pads with reverb and kick ducking | 4, run at once | 13.9 s wall against 38 s, sum matched to -122 dB re peak |
| Same song at higher gain | 4 | Sum was off by -11 dB re peak: the full `premaster.wav` had clipped at full scale, because stems and pre-master are written as integer PCM |

So sharded stems reproduce the full mix only while nothing clips at full scale; check peaks below 1.0 (lower track gains for the shard run if needed). In the 13-track run the track stems I compared (the kick and five pads) were bit-identical to the full render's stems, so summing stems yourself avoids the pre-master clipping.

What the CLI cannot do: apply the master chain to a summed file. Passing the summed pre-master back as an `audioTracks` clip through the same master did not match the full master (2.5 LUFS louder; residual -9.9 dB after the best gain), and I did not find why, so do not rely on it. The safe delivery path is the one-process render. If you shard for auditioning, treat the sum as a pre-master preview only.

**`master.targetLufs` and `--bars`.** Normalisation acts on whatever is rendered. With `targetLufs: -14` the full render measured -14.4 LUFS on my meter, shard 0 -15.1 and shard 1 -14.4, so shards rendered with the master on are each normalised on their own and will not sum to the intended level; export them with `--no-master`. A `--bars 4:8` render (zero-based, end exclusive, rejected on loop songs) is normalised as its own file and came out about 2.4 dB louder than the same bars in the full render (-16.8 dB RMS against -19.2 dB). Its voices and effect tails also start empty: against the same span of the full pre-master the largest difference was 9.6e-2 in the first second (-13 dB re peak), 1.9e-3 in the second, 1e-5 in the fourth, and the 24-bit step from the sixth second on. Use `--bars` for auditioning a section, and render the whole song for delivery.

## Traps we hit

| Symptom | Cause | Fix |
| --- | --- | --- |
| Pad plays two octaves low, or bass an octave high | Alchemy file-name notes are off by whole octaves | Measure with `octave.mjs`, set `pitch_keycenter` from the measured offset, verify with `detect.mjs` |
| Instrument is one octave off although `pitch_keycenter=sample` | `smpl` unity note is wrong for that instrument (12 high on Lush Bright Pad) | Use explicit `pitch_keycenter` |
| E_CAPABILITY "SFZ has no playable regions" | Regions point at `.aif` or `.caf`, or use an uppercase opcode | Convert to WAV; write opcodes in lowercase |
| E_SCHEMA "cannot decode sample" in a kit | AIFF, CAF or extensible WAV in the kit | Convert with `ffmpeg -c:a pcm_s16le` |
| E_INPUT "invalid SFZ sample WAV" | Format tag 65534 (`ffmpeg pcm_s24le`, some `afconvert` output), 3+ channels, or an unpadded odd chunk | Use `pcm_s16le` or `pcm_f32le`; run `cleanwav.mjs` for padding |
| E_ACCESS with a path that exists | Symlink into `/Library`, absolute path, or a path outside the `.sfz`/kit directory | Copy or convert into the song tree |
| Pad cuts off with a click at note end | Default `ampeg_release` is 0.001 s | Set `ampeg_release` per instrument |
| Note-kit sample keeps ringing into the next note | Kits ignore `gate` and overlap by default | `"mono": true` on the track |
| E_CAPABILITY "decoded PCM exceeds render budget" | SFZ regions decode to more than 512 MiB | Drop layers or notes you do not use, shorten samples |
| E_ACCESS "cannot read kit.json" from a shard | Shard song saved in another directory | Save shard songs beside the original |
| Shard sum off by many dB | Pre-master clipped, or shards rendered with the master on | Keep peaks under 1.0; export with `--no-master --bits 24` |
| Stem LUFS shifts after adding `duck` | Duck is baked into the stem | Calibrate with final duck settings |
| Files appear under `~/.music2` | `analyze` without `--out` | Pass `--out <dir>` |

## Other libraries

The GarageBand Instrument Library (`…/Sampler/Sampler Files/`) has 518 stereo WAV files with a `smpl` chunk on all but two; in the clarinet folder I checked, the names and unity notes were correct. That folder is the easiest place to start because no conversion is needed. Apple Loops are AAC, so convert them and expect codec artefacts when you stretch or slice them; their tempo and key metadata were not read here. The `.exs` files were not parsed.

## Not implemented

There is no `render --jobs` and no command that imports a sample folder into an SFZ or `kit.json` (`import` handles MIDI only), so the scripts above stand in for both; either would be a reasonable addition for a later change.

