# 010 — wp1: issue #1 lint and analyze accuracy

Consumes 001 dispositions D1–D5. Stale check at wp1 P: re-read every cited line before editing; earlier phases do not touch these files.

## File change map

| Path | Op | Change |
|---|---|---|
| `src/recipes/lint-roles.tool.ts` | NEW | Shared voice roles: `FOCAL_VOICES`, `BED_VOICES`, `isFocalInstrument`, `isBedInstrument`, `isBassInstrument`, `melodyTrackIds(g)` |
| `src/recipes/lint-roles.test.ts` | NEW | focal/bed/bass classification; order independence; fallback |
| `src/recipes/lint-layering-harmony.tool.ts` | MODIFY | import `isFocalInstrument`; 16th `slot`; unique slot sets; new expected/fix text |
| `src/recipes/lint-rules-phrase.tool.ts` | MODIFY | delete `melodyId`; `motifIn` and `sectionMotifChange` take `string[]` and pass if any id passes |
| `src/recipes/lint-rules.tool.ts` | MODIFY | use `melodyTrackIds`; drill_ny/5 per hook placement; drill_uk/6 per contiguous run; lofi_hiphop/6 text from `CLIP_RISK_SUM` |
| `src/recipes/lint-geometry.tool.ts` | MODIFY | `transitions(g, groups: number[][])`; new `contiguousRuns(bars)` |
| `src/recipes/lint-generic.tool.ts` | MODIFY | export `CLIP_RISK_SUM = 2`; per-track √n chord weighting; slow-attack weighting table |
| `src/analyze/tempo.tool.ts` | MODIFY | label 2:3 and 3:2 related candidates |
| `src/analyze/analysis.schema.ts` | MODIFY | `TempoCandidate.relation` adds `"two_thirds" \| "three_halves"`; `AnalysisJson.tempoDeclaredMatch: TempoCandidate \| null` |
| `src/analyze/analyze.tool.ts` | MODIFY | compute `tempoDeclaredMatch` when a song is supplied |
| `src/analyze/report.tool.ts` | MODIFY | BPM line names the declared match |
| `src/analyze/overview/panels.top.tool.ts` | MODIFY | header prefers the declared match, e.g. `BPM 142 (DECLARED 142, AUDIO TOP 95 2:3)` |
| tests next to each file | MODIFY | see Tests |
| `docs/cli.md` | MODIFY | clipping_risk threshold 2.0; register_collision wording; analyze field |
| `devlog/str_func/recipes.md`, `analyze.md` | MODIFY | new exports and fields |

## Diffs

### lint-roles.tool.ts (NEW)

```ts
import { libraryInstrument } from "../sampler/index.ts";
import type { LintGeometry } from "./lint-geometry.tool.ts";

/** Synth voices that carry a line; moved unchanged from lint-layering-harmony. */
export const FOCAL_VOICES = new Set(["lead", "bell", "pluck", "keys", "piano", "epiano", "guitar", "flute",
  "brass", "marimba", "vibraphone", "glockenspiel", "kalimba"]);
/** Sustained beds that never count as the melody. */
export const BED_VOICES = new Set(["strings", "pad", "choir"]);
const library = (instrument: string) => instrument.startsWith("lib:") ? libraryInstrument(instrument.slice(4)) : null;
export const isFocalInstrument = (instrument: string): boolean => library(instrument)?.role === "focal" || FOCAL_VOICES.has(instrument);
export const isBedInstrument = (instrument: string): boolean => library(instrument)?.role === "bed" || BED_VOICES.has(instrument);
export const isBassInstrument = (instrument: string): boolean => instrument === "bass" || instrument === "808";
/** Every track that may carry the melody, in track order. Focal voices first; if none, any non-bass non-bed notes track. */
export function melodyTrackIds(g: LintGeometry): string[] {
  const notes = g.song.tracks.filter((track) => track.kind === "notes" && !isBassInstrument(track.instrument));
  const focal = notes.filter((track) => isFocalInstrument(track.instrument));
  return (focal.length ? focal : notes.filter((track) => !isBedInstrument(track.instrument))).map((track) => track.id);
}
```

`libraryInstrument` throws on an unknown name today? Check at B: if it throws, guard with the same call site behavior the harmony lint already relies on (it calls it unguarded at `lint-layering-harmony.tool.ts:12-13`).

### lint-rules-phrase.tool.ts

```diff
-export function melodyId(g: LintGeometry): string | null {
-  return g.song.tracks.find((track) => track.kind === "notes" && track.instrument !== "808" && track.id !== "bass")?.id ?? null;
-}
 export function bassId(...)            // unchanged
-export function motifIn(g, bars, sizes, track: string | null): boolean {
-  return track !== null && sizes.some((size) => motif(g, bars, size, track));
+export function motifIn(g: LintGeometry, bars: number[], sizes: number[], tracks: readonly string[]): boolean {
+  return tracks.some((track) => sizes.some((size) => motif(g, bars, size, track)));
 }
-export function sectionMotifChange(g, track: string | null): boolean {
-  if (track === null) return false;
+export function sectionMotifChange(g: LintGeometry, tracks: readonly string[]): boolean {
+  return tracks.some((track) => sectionMotifChangeFor(g, track));
+}
+function sectionMotifChangeFor(g: LintGeometry, track: string): boolean {
   for (...) // body unchanged
```

`motifIn` is also called from `lint-rules-dance.tool.ts:35-` with `bassId(g)` (`string | null`); that call becomes `motifIn(g, bars, sizes, bass === null ? [] : [bass])`.

### lint-rules.tool.ts

```diff
-  const melody = melodyId(g);
+  const melodies = melodyTrackIds(g);
+  const melodyPath = `tracks.${melodies[0] ?? "melody"}`;
 ...drill_uk/6:
-transitions(g, g.full)
+transitions(g, contiguousRuns(g.full))
 ...drill_ny/5:
-transitions(g, g.hooks)
+transitions(g, g.placements.filter((p) => p.role === "hook").map(barsOf))
 ...drill_ny/6, boom_bap/6, boom_bap/7, lofi_hiphop/4: pass `melodies` instead of `melody`; paths use `melodyPath`
 ...lofi_hiphop/6:
-"onset sum <=1.5"
+`onset sum <=${CLIP_RISK_SUM}`
```

The minimum-transition threshold stays `Math.ceil(g.hooks.length / 8)` (bars, not groups).

### lint-geometry.tool.ts

```diff
-export function transitions(g: LintGeometry, bars: number[]): number {
-  const allowed = new Set(bars);
-  const notes = g.timeline.events.filter((e) => allowed.has(e.bar) && is808(g, e) && e.midi !== null);
-  let count = 0;
-  for (let i = 1; i < notes.length; i++) if (notes[i - 1]!.midi !== notes[i]!.midi) count++;
-  return count;
-}
+/** Count 808 pitch changes inside each bar group; a jump between groups is not a transition. */
+export function transitions(g: LintGeometry, groups: readonly number[][]): number {
+  let count = 0;
+  for (const bars of groups) {
+    const allowed = new Set(bars);
+    const notes = g.timeline.events.filter((e) => allowed.has(e.bar) && is808(g, e) && e.midi !== null);
+    for (let i = 1; i < notes.length; i++) if (notes[i - 1]!.midi !== notes[i]!.midi) count++;
+  }
+  return count;
+}
+/** Split sorted bar indexes into runs of consecutive bars. */
+export function contiguousRuns(bars: readonly number[]): number[][] {
+  const runs: number[][] = [];
+  for (const bar of [...bars].sort((a, b) => a - b)) {
+    const run = runs.at(-1);
+    if (run && bar === run.at(-1)! + 1) run.push(bar); else runs.push([bar]);
+  }
+  return runs;
+}
```

### lint-generic.tool.ts

```diff
-const CLIP_RISK_SUM = 1.5;
+/** Static onset-sum ceiling; calibrated so a default kick+808 downbeat (1.6) passes and 3 unity hits + 808 fail. */
+export const CLIP_RISK_SUM = 2;
+const ONSET_MS = 10;
+/** Default attack of slow voices (parity-tested against render voice specs); lib bed voices use a heuristic 250 ms. */
+export const SLOW_ATTACK_MS: Readonly<Record<string, number>> = { strings: 300, pad: 400, choir: 300 };
+function onsetWeight(track: ResolvedTrack): number {
+  const attack = track.params["attackMs"] ?? SLOW_ATTACK_MS[track.instrument] ??
+    (isBedInstrument(track.instrument) && track.instrument.startsWith("lib:") ? 250 : 0);
+  return attack > ONSET_MS ? ONSET_MS / attack : 1;
+}
 export function clippingRisk(g: LintGeometry): number {
   let maximum = 0;
   for (const events of g.events.values()) {
-    const ordered = ...
-    for (const event of ordered) {
-      const position = phase(event);
-      const sum = ordered.filter(...).reduce((total, other) => total + other.velocity * 10 ** (gain / 20), 0);
-      maximum = Math.max(maximum, sum);
-    }
+    for (const event of events) {
+      const position = phase(event);
+      const byTrack = new Map<number, { velocity: number; count: number }>();
+      for (const other of events) {
+        if (Math.abs(phase(other) - position) > GRID_TOLERANCE) continue;
+        const entry = byTrack.get(other.trackIndex) ?? { velocity: 0, count: 0 };
+        entry.velocity = Math.max(entry.velocity, other.velocity); entry.count++;
+        byTrack.set(other.trackIndex, entry);
+      }
+      let sum = 0;
+      for (const [index, { velocity, count }] of byTrack) {
+        const track = g.song.tracks[index]!;
+        sum += velocity * Math.sqrt(count) * 10 ** (track.gain / 20) * onsetWeight(track);
+      }
+      maximum = Math.max(maximum, sum);
+    }
   }
   return maximum;
 }
```

Type import: `ResolvedTrack` from `../song/index.ts` (verify the exported name at B; `song.tracks[i]` type is the target). `track.params` exists on resolved tracks (`registry.tool.ts:88` iterates it).

### lint-layering-harmony.tool.ts

```diff
-const FOCAL = new Set([...]);
-const focal = (instrument: string): boolean => ...;
+import { isFocalInstrument as focal } from "./lint-roles.tool.ts";
 function slot(g, placement, event): number {
   const { start } = placementSpan(g, placement);
-  const eighth = 30 / g.song.bpm;
-  return Math.round((event.time - start) / eighth);
+  const sixteenth = 15 / g.song.bpm;
+  return Math.round((event.time - start) / sixteenth);
 }
 ...registerCollision:
-      const sparse = a.notes.length <= b.notes.length ? a : b;
-      const dense = sparse === a ? b : a;
-      const occupied = new Set(dense.notes.map((note) => slot(g, placement, note)));
-      const matches = sparse.notes.filter((note) => occupied.has(slot(g, placement, note))).length;
-      const share = matches / sparse.notes.length;
+      const slotsA = new Set(a.notes.map((note) => slot(g, placement, note)));
+      const slotsB = new Set(b.notes.map((note) => slot(g, placement, note)));
+      const [sparse, dense] = slotsA.size <= slotsB.size ? [slotsA, slotsB] : [slotsB, slotsA];
+      const matches = [...sparse].filter((value) => dense.has(value)).length;
+      const share = matches / sparse.size;
 ...observed: `shared ${matches}/${sparse.size}` (unique 16th onsets)
-        `median distance > ${REGISTER_DISTANCE} or shared slots < ${SLOT_SHARE}`,
-        "Move one focal line to another register or stagger its onsets."));
+        `median distance > ${REGISTER_DISTANCE} or shared 16th onsets < ${SLOT_SHARE}`,
+        "Move one focal line at least an octave away, or put its onsets on 16th steps the other line leaves empty."));
```

### tempo.tool.ts (candidate labels)

At the `candidateScores` map, after `chosen` is final:

```diff
-    return { ...candidate, selection };
+    const ratio = candidate.bpm / chosen.bpm;
+    const relation = candidate.relation !== "primary" || candidate === chosen ? candidate.relation
+      : Math.abs(ratio - 2 / 3) <= .02 * 2 / 3 ? "two_thirds" : Math.abs(ratio - 1.5) <= .02 * 1.5 ? "three_halves" : "primary";
+    return { ...candidate, relation, selection };
```

Tempo selection and scores are unchanged, so existing tempo tests keep their expectations.

### analyze.tool.ts, analysis.schema.ts, report, overview

```ts
// analysis.schema.ts
export interface TempoCandidate { bpm: number; score: number; relation: "primary" | "half" | "double" | "two_thirds" | "three_halves" }
// AnalysisJson: after tempoCandidates
  /** Highest-scoring candidate within ±1.5 BPM of the declared tempo with score >= 0.9; null without a song. */
  tempoDeclaredMatch: TempoCandidate | null;
// analyze.tool.ts
export const DECLARED_MATCH_BPM = 1.5, DECLARED_MATCH_SCORE = .9;
export function declaredTempoMatch(candidates: readonly TempoCandidate[], declared: number | null): TempoCandidate | null {
  if (declared === null) return null;
  return candidates.filter((c) => Math.abs(c.bpm - declared) <= DECLARED_MATCH_BPM && c.score >= DECLARED_MATCH_SCORE)
    .sort((a, b) => b.score - a.score)[0] ?? null;
}
// report.tool.ts BPM line appends: ` · declared match ${number(match.bpm)} (${number(match.score)})` when present
// panels.top.tool.ts: when match !== null and |estimated - declared| > 1.5, headline BPM uses match.bpm and adds
// `AUDIO TOP <estimated> <relation of the estimated vs match, 2:3 | 1:2 | 2:1 | 3:2>`
```

All consumers that construct `AnalysisJson` literally must add the field (search `tempoCandidates:` across src and tests at B).

## Tests

| Test | Proves | Activation |
|---|---|---|
| `lint-roles.test.ts`: repro 1 with guitar-before-bell and bell-before-guitar | drill_ny/6 result equal for both orders (no warning: the bell repeats) | issue #1 repro 1 JSON inline |
| `lint-roles.test.ts`: strings listed first + bell | strings never chosen | bed voice first |
| `lint-roles.test.ts`: `sub` track with `instrument:"bass"` | excluded from melodies | id is not `bass` |
| `lint-geometry.test.ts`: contiguousRuns | [[0,1],[4,5]] from [5,0,4,1] | |
| `cards/drill_ny.test.ts` or `lint.test.ts`: repro 2 | drill_ny/5 warns (0 transitions) | two non-adjacent static hooks |
| `lint-generic.test.ts`: repro 3 | no clipping_risk; risk = 1.6 ± 0.01 | default kick+808 downbeat |
| `lint-generic.test.ts`: 3 unity drum hits + 808 on one onset | warns | stacked onset |
| `lint-generic.test.ts`: three-note strings chord | weight uses √3 and 10/300 | slow bed chord |
| `lint-generic.test.ts`: SLOW_ATTACK_MS parity | equals `voiceFor(id).params.attackMs.default` for each key | imports render registry in test only |
| `lint-layering-harmony.test.ts`: repro 4 | brass on second 16th no longer collides | 16th stagger |
| `lint-layering-harmony.test.ts`: existing collision fixtures | still warn when onsets coincide | |
| `tempo.test.ts`: synthetic candidates 142 chosen vs 94.7 | labelled `two_thirds` | unit on the relabel helper |
| `analyze.test.ts`: `declaredTempoMatch` | picks 142.2 (0.968) over nothing; null without declared | |

Verifier (PLAN-VERIFIER-REAL-01, superseded by the verification constraint below): hosted CI `npm test` runs `node --test` over `src/**/*.test.ts` (check the `test` script glob at B and quote it); `npm run typecheck` covers every changed `.ts`. CLI check: save the four issue repros to `/tmp` and run `node bin/music2.js lint <file> --json`; outputs recorded in evidence/wp1-repros.md.


## Reflection amendments (binding for B)

Architect reflection returned ALIGNED with fixes; each is folded here and supersedes the diff above where they differ.

- R1 (`lint-rules-dance.tool.ts:38`): the techno motif call is `motifIn(g, g.grooves, [1, 2], bass ?? percussion)`. Convert as `const id = bass ?? percussion; motifIn(g, g.grooves, [1, 2], id === null ? [] : [id])`.
- R4: the parity test reads `VOICES[id].params.attackMs.default` from `src/render/index.ts` (`voiceFor` is private).
- R5: extract `export function relateToChosen(bpm: number, chosenBpm: number, relation: TempoCandidate["relation"]): TempoCandidate["relation"]` in `tempo.tool.ts`; the inline map calls it and the unit test calls it directly. Schema comment on `relation`: "half/double are relative to the source peak; two_thirds/three_halves are relative to the chosen tempo."
- R6: √n chord weighting applies only when `track.kind === "notes"`; drum tracks keep `velocity · count` (transients add). Test "stacked onset" uses three separate unity drum tracks plus an 808 on the same step.
- R7: `src/analyze/report.test.ts:12` literal adds `tempoDeclaredMatch: null`.
- R8: `melodyTrackIds` focal branch also includes `kit:` and `sfz:` notes tracks (sampled melodies); `isFocalInstrument` itself is unchanged so the harmony collision rule is unaffected.
- R9: `BED_VOICES = new Set(["strings", "pad", "choir", "organ"])`, matching `lint-layering-harmony.test.ts:65`.
- R10: drill_ny/5 uses one `const hookMoves = transitions(g, g.placements.filter((p) => p.role === "hook").map(barsOf))` for both the condition and `observed`; drill_uk/6 likewise with `contiguousRuns(g.full)`.

## Verification constraint (user, 2026-09-28)

The user forbade running the local suite. No `npm test`, `npm run typecheck|lint|build|audit:structure` or `node --test` on this machine. Verification is hosted CI (`.github/workflows/ci.yml`: checks job runs typecheck, lint, build, audit:structure, docs:genres:check, privacy:scan, pack; test job runs `npm test` on ubuntu/macos/windows × Node 22/24; `ci` aggregates) on the pushed branch head of the work PR. Local evidence is limited to `node bin/music2.js lint|validate` on the issue repro JSONs. The C>D receipt runs a read-only `gh` script that exits 0 only when every CI job for the exact head SHA completed with success.


## Audit round 1 folds (binding for B)

Reviewer round 1: FAIL with 6 blockers; synthesis and dispositions:

- F1 (High, accepted): `src/recipes/lint-generic.test.ts:20-27` fixture (`bd` + 808 `[c2,e2]`) drops to 0.8+0.8·√2 ≈ 1.93 under √n. Change the fixture to add a second unity drum track hit on the same step (sum ≈ 2.93) and keep the expectation; add the Tests row.
- F2 (High, accepted): `src/recipes/lint-rules-phrase.test.ts:14` passes `"melody"`; change to `["melody"]`.
- F3 (High, accepted): `tests/e2e/daw-legacy.test.ts` replays `tests/fixtures/daw-legacy/darwin-node24.json` on the macos × Node 24 CI leg. Recapture procedure (not the test suite; same CLI calls the test makes, run on this darwin/Node 24 host after B): for every example in the manifest run `node src/cli/index.ts lint <song> --json` with `MUSIC2_JSON=0`, canonicalize exactly as `jsonDigest` does (delete `meta.music2`, `sha256(JSON.stringify(envelope)+"\n")`, record exit), and compare to the manifest; update only changed `lint` entries. For `examples/cinematic-cue.song.json` (the only example with `revcymbal` or `kit:`; `rg -l "revcymbal|kit:" examples`) also run `render -o master.wav` and `render --stems` and update `render` and changed stem digests. Validate and events digests are recomputed for the same examples and must be unchanged. Extend the comment at `daw-legacy.test.ts:121-122` to name the recaptured entries and the reason (revcymbal taper, clipping_risk calibration). `sourceSha` stays the pre-wp2 capture source. The recapture script lives in the task workspace, not the repository.
- F4 (Medium, accepted): `lint-rules-dance.tool.ts:51` techno/6 text uses `CLIP_RISK_SUM`; `scripts/gen-genre-docs.mjs:48,54` and generated `skills/music2/references/genres.md:178,215` say "exceeds 2 (chords and slow attacks weighted)"; edited by hand in both so `docs:genres:check` (CI) still sees them agree.
- F5 (Medium, accepted): 000 verifier row, receipt commands and privacy order fixed (see 000 "Audit round 1 folds").
- F6 (Medium, accepted): added activation tests:

| Test | Activation |
|---|---|
| `report.test.ts`: BPM line shows declared match | analysis with `tempoDeclaredMatch` set |
| `panels.top.test.ts`: header uses match when estimate differs by > 1.5 and falls back when the field is missing | guard is `match != null` (covers casted partial objects at `panels.top.test.ts:11`, `overview.test.ts:26`) |
| `tempo.test.ts`: `relateToChosen(213, 142, "primary")` → `three_halves`; `(94.7,142)` → `two_thirds`; `("half")` passes through | helper |
| `lint-geometry.test.ts` / `cards/drill_uk.test.ts`: drill_uk full bars in two non-adjacent runs, each static → transition count 0 | non-contiguous `g.full` |
| `lint-roles.test.ts`: no focal voice, supersaw + strings → `[supersaw]`; bell + `kit:` notes track → both | fallback and R8 branch |
| `lint-generic.test.ts`: `lib:` bed voice uses 250 ms; `params.attackMs: 10` on pad restores full weight | slow-attack table and override |

- Non-blocking notes folded: stale wording updated in `skills/music2/references/layering.md:38,69` (16th onsets), `mixing.md:24` and `skills/music2/SKILL.md:69` (clipping 2, weighted), `docs/cli.md:21`, `SKILL.md:26`, `README.md:48` (tempo relations and declared match). Behavior change stated: a song whose only melodic tracks are beds (strings, pad, choir, organ) now warns on drill_ny/6, boom_bap/6, boom_bap/7 and lofi_hiphop/4 because beds no longer count as the melody; 001 wording corrected accordingly.

