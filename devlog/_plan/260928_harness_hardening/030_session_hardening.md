# 030 — wp3: session hardening (WAV, validate, declick, kit trim, skill guidance)

Consumes 001 D7–D10 and the session findings. Independent of wp1/wp2 code; the skill text cites rule ids from wp1/wp2, so it runs after them. Stale check at wp3 P: re-read each cited span.

## File change map

| Path | Op | Change |
|---|---|---|
| `src/audio-io/wav.tool.ts` | MODIFY | final chunk may omit its pad byte (both RIFF-size variants) |
| `src/audio-io/wav.test.ts` | MODIFY | odd 24-bit mono data chunk without pad, RIFF size with and without pad; mid-file missing pad still fails |
| `src/cli/commands/validate.ts` | MODIFY | call `validateVoiceParams` and `validateDawVoiceLanes` after `buildTimeline` |
| `src/cli/main.test.ts` (or a new `src/cli/commands/validate.test.ts`) | MODIFY/NEW | `epiano` `releaseMs: 600` → exit 2, E_SCHEMA, path `tracks[0].params.releaseMs` |
| `src/sfx/transition.tool.ts` | MODIFY | drop the `revcymbal` taper exemption |
| `src/sfx/transition.test.ts` | MODIFY | revcymbal last sample is 0 and last 5 ms is monotone toward 0; swell shape assertions unchanged |
| `src/render/kit.tool.ts` | MODIFY | `KIT_RELEASE_MS = 5` fade before `stopFrame` on notes tracks; `startMs` manifest parse and per-name trim |
| `src/render/render.schema.ts` | MODIFY | `KitManifest.startMs?: Record<string, number>` |
| `src/render/kit.test.ts` | MODIFY | cut note ends at 0 with no step; drum kit output unchanged; `startMs` trims; invalid `startMs` names/values rejected; trim past end rejected |
| `docs/song-format.md` | MODIFY | validate now checks voice parameters; kit `startMs` |
| `docs/cli.md` | MODIFY | validate description |
| `skills/music2/references/instruments.md` | MODIFY | user-owned kit: `startMs`, note-kit release fade, mono fold note |
| `skills/music2/references/sfx.md` | MODIFY | revcymbal ends with a 5 ms taper; place it so it ends on the downbeat |
| `skills/music2/references/mixing.md` | MODIFY | new sections: open the top end; limiter headroom at phrase ends; sampled melodies and timing |
| `skills/music2/SKILL.md` | MODIFY | revision cues point to the new mixing sections |
| `devlog/str_func/audio-io.md`, `cli.md`, `render.md`, `sfx.md` | MODIFY | behavior notes |

## Diffs

### wav.tool.ts

```diff
-  const end = bytes.readUInt32LE(4) + 8;
-  if (end > bytes.length || end < 12) invalid(path, "RIFF", "truncated RIFF payload");
+  let end = bytes.readUInt32LE(4) + 8;
+  // Some writers count a final pad byte in the RIFF size but never write it.
+  if (end === bytes.length + 1) end = bytes.length;
+  if (end > bytes.length || end < 12) invalid(path, "RIFF", "truncated RIFF payload");
 ...
     const next = payload + size + (size & 1);
-    if (payload + size > end || next > end) invalid(path, chunk, "truncated chunk payload or pad byte");
+    // A final odd-sized chunk may omit its pad byte; anywhere else the pad is required.
+    const unpaddedFinal = (size & 1) === 1 && payload + size === end;
+    if (payload + size > end || (next > end && !unpaddedFinal)) invalid(path, chunk, "truncated chunk payload or pad byte");
 ...
-    offset = next;
+    offset = unpaddedFinal ? end : next;
```

### validate.ts

```diff
+import { validateDawVoiceLanes, validateVoiceParams } from "../../render/voices/registry.tool.ts";
 ...
     const timeline = buildTimeline(song);
+    // Same voice checks as render, so bad parameters fail here with exit 2 instead of at render time.
+    validateVoiceParams(song);
+    validateDawVoiceLanes(song);
```

Import through `../../render/index.ts` if it re-exports these (export.ts imports the registry file directly at `export.ts:17`, so either is consistent; prefer the index when it exports them). Docs: `docs/song-format.md:98` sentence "`validate` checks the song and pattern syntax; `render` resolves the voice and its parameters" becomes "`validate` checks the song, pattern syntax, and voice parameter names and bounds; `render` additionally loads kits and samples."

### transition.tool.ts

```diff
-    const taper = atom === "revcymbal" ? 1 : Math.min(1, (frames - n - 1) / Math.max(1, .005 * rate));
+    const taper = Math.min(1, (frames - n - 1) / Math.max(1, .005 * rate));
```

### kit.tool.ts

```diff
-  const allowed = new Set(["version", "samples", "gainDb", "rootMidi", "midi"]);
+  const allowed = new Set(["version", "samples", "gainDb", "rootMidi", "midi", "startMs"]);
 ...after the midi block:
+  const startMs = manifest["startMs"];
+  if (startMs !== undefined) {
+    if (startMs === null || typeof startMs !== "object" || Array.isArray(startMs)) throw schemaError(kitPath, "startMs must be an object");
+    for (const [name, value] of Object.entries(startMs)) {
+      if (!Object.hasOwn(samples, name) || typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000)
+        throw schemaError(kitPath, `invalid startMs.${name}: unknown sample or value outside [0,10000]`, name);
+    }
+  }
 ...loadKit, after the decode cache lookup:
-      loaded.push(mono);
+      const trim = Math.round((manifest.startMs?.[name] ?? 0) * sampleRate / 1000);
+      if (trim >= mono.length) throw schemaError(kitPath, `startMs.${name} is past the end of ${source}`, name);
+      loaded.push(trim > 0 ? mono.subarray(trim) : mono);
 ...renderKit:
+/** Short fade before a notes-track stop so a cut sample does not end in a step. */
+export const KIT_RELEASE_MS = 5;
 ...inside the event loop:
+    const cut = ctx.track.kind === "notes" && limit < event.startFrame + sample.length / ratio;
+    const fade = cut ? Math.min(Math.round(KIT_RELEASE_MS * ctx.sampleRate / 1000), limit - Math.max(0, event.startFrame)) : 0;
 ...
-      output[frame] = (output[frame] ?? 0) + value * amplitude;
+      const release = fade > 0 && frame >= limit - fade ? (limit - frame - 1) / fade : 1;
+      output[frame] = (output[frame] ?? 0) + value * amplitude * Math.max(0, release);
```

`ctx.sampleRate` is on `VoiceContext` (`render.schema.ts:12`). Drum tracks keep `limit = ctx.frames`, so `cut` is false only when the sample runs past the song end; that case ends at the file end as today (acceptable: the mixer tail handles it). DAW exports: `src/export/als/clips.tool.ts` maps kit names to MIDI pitches and does not copy kit media (rg found no `loadKit`/`kit:` media copy in `src/export`), so `startMs` is render-only; the instruments reference says so.

## Skill guidance (mixing.md new sections, prose to write at B)

- **Open the top end.** What makes a pop mix sound open: sources that actually carry energy above 8 kHz (real cymbal, shaker, tambourine and open-hat samples; breathy choir), lowpass filters on melodic tracks set high (9 kHz or off) instead of 5–6 kHz, a plate or room return with `highCutHz` near 16–17 kHz and `lowCutHz` 300–450 Hz instead of a dark hall, a small `eq` high shelf (+2–4 dB at 9–12 kHz) on the parts that should sparkle, width on upper layers with `monoBelowHz` keeping lows centered, and a low end that does not take most of the energy (`analyze` band shares: an 808 track above ~60% of total with air under 2% reads closed). Measured example from the session: band shares moved from low 64% / air 1.6% to low 55% / air 5.9% at the same LUFS.
- **Limiter headroom at phrase ends.** Summed peaks cluster where snare rolls, choir or chant hits, risers and crashes land together on the last beats of a phrase. Ramp roll velocities, lower the riser under the hit, keep one downbeat marker (crash or impact, not both), and leave 1 LU between `targetLufs` and what the limiter can hold. Use `render --stems` over the phrase to find which stems sum to the peak.
- **Sampled melodies and timing.** When a melody is sampled or transcribed, keep its original rhythm grid and tempo; place notes on the source's steps rather than re-quantizing. Loop-sliced samples often have a slow attack and sound late: trim with kit `startMs`, and keep reversed swells ending exactly on the downbeat.

These sections reference rule and field names only; no song content from the session goes into the repository.

## Tests and verifier

Hosted CI (checks + test matrix) on the pushed head; no local suite. CLI: `node bin/music2.js validate` on an epiano `releaseMs: 600` song exits 2 with the voice issue (before: exit 0; recorded in evidence/wp3-checks.md). A 24-bit mono odd-frame WAV written without pad loads through a one-sample kit and renders.


## Reflection amendments (binding for B)

- R3: `wav.test.ts:78-82` "pad" fixture (final 1-byte `JUNK`, no pad, RIFF size `length - 8`) is exactly the tolerated case: move it to an accept test. Add a rejection fixture with an odd `JUNK` chunk missing its pad followed by a `data` chunk.
- R11: `fade = cut ? Math.min(releaseFrames, Math.floor((limit - start) / 2)) : 0`, so notes shorter than 10 ms fade over half their length.
- R12: comment reads "Only notes tracks cut a sample at stopFrame; drum samples play to their end." `kit.test.ts:92` (8-frame sample, stop 16) is unaffected.
- Resolved: epiano `releaseMs` max is 400 (`epiano.tool.ts:11`), so 600 exits 2; ALS export maps kit names to MIDI pitches only (`clips.tool.ts:13,31`), so `startMs` is render-only.

Verification: hosted CI only (see 010 "Verification constraint"); local evidence is `node bin/music2.js validate` on the epiano repro.


## Audit round 1 folds (binding for B)

- Validate now enforces everything `validateVoiceParams` checks: parameter names and bounds, `mono:true` for bass/808, track kind and known instrument (`registry.tool.ts:83-88`). Docs sentence: "`validate` checks the song, pattern syntax and the voice rules `render` applies (known instrument, track kind, `mono` for bass/808, parameter names and bounds); `render` additionally loads kits and samples." PLAN-BYPASS-NAMED-01: tier E3 CLI check; surface `music2 validate` and `render`; known bypass: none inside music2 (both commands call the same function), a caller can skip `validate`; residual risk: none new; wording: "validate rejects", not "enforced".
- R11 short-note fade activation test: a notes kit track with a 2 ms note (shorter than 10 ms) ends at 0 and the fade spans half the note.
- Digest recapture split: wp1 B recaptures only `lint` digests (clipping and rule changes); wp3 B recaptures `examples/cinematic-cue.song.json` `render` and stem digests after the revcymbal taper, with the 010 F3 procedure.

