# 030 — wp4 Overview evaluation, agent docs, and hosted release proof

wp4 tests whether a vision-only agent can read the new `overview.png` as a section map, then teaches users how to interpret it and closes the release evidence. The evaluation ground truth is derived before model calls from each song's timeline and its freshly generated `analysis.json`; no expected answer is copied from the image or the draft table in 003. The default four examples form the c-3 gate, while wp3 use-case examples extend the diagnostic corpus.

Depends on: 002 flow metrics, 003 exact image-only prompt and scoring rules, 004 architecture dispositions, wp1 measurement and wp2 overview artifact, wp3 use-case songs. Consumed by: the composition skill, README/CLI readers, the 0.2.0 release record, and final exact-SHA hosted CI evidence.

## Scope

IN: a deterministic local evaluation harness, ground-truth and scored evidence, one-image-per-call vision evaluation coordinated by main, overview reading instructions, artifact lists, the 0.2.0 changelog entry, privacy and public-identity checks, push to `main`, exact-SHA hosted CI verification, and unit archival. OUT: a runtime model dependency, network/model calls inside music2, changing measurement formulas or the Song schema, using audio or song metadata in vision prompts, treating a spectrogram score as a release gate, npm publish, or tags. The harness uses Node built-ins plus this repository's CLI/PNG encoder; package runtime dependencies remain zero. Rendering and scoring order must be deterministic under one Node major/platform; model responses are observations, not deterministic program output.

## Evaluation contract and precedence

> **Amendment after the first capture pass (main).** The first pass returned the correct order and boundaries for every readable overview but used uppercase IDs (the 5×7 font has no lowercase), sometimes with the rail index (`01 INTRO#0`), and read house `return#0` as `GROOVE RETURN#0` because labels printed the role before the ID. Fixes, applied before any rescoring: labels now print exactly `NN ID#N` with a differing role moved to rail line two; the scorer compares IDs after `normalizeId` (uppercase, strip one leading `NN ` index) and nothing else. All first-pass captures (several also failed with HTTP 429) are superseded, and every case, kind and size is captured again with fresh agents against the new image hashes.

- The four fixed c-3 cases are `drill-140`, `trap-150`, `boom-bap-90`, and `house-124`. `prepare` accepts repeatable `--case examples/<name>.song.json` paths for every use-case example delivered in wp3; main passes the final wp3 paths explicitly. A missing or duplicate path is an error. Extra cases appear in the report but do not change the denominator of four.
- Prepare each case with `render` to a task-owned work directory, then `analyze <wav> --song <song> --out <work>/<case>/analysis --json`. This exercises the public song-backed route in `src/analyze/analyze.tool.ts:173-211`, including the alignment check; it is not a call to `analyzeAudio` that bypasses artifact writing. Require `overview.png`, `spectrogram.png`, and `analysis.json` from the same render.
- Load/validate the song and use `buildTimeline(song)` (`src/song/timeline.tool.ts:31-34,76-77`). Each `placement` produces `${section}#${occurrence}` in placement order, matching `src/analyze/analyze.tool.ts:70-85`. This suffix is the source occurrence value, initially `#0`; **only bar labels are 1-based**. Boundaries are `[1, ...placements after the first mapped as startBar+1, timeline.bars+1]`, length `placements.length+1`. Assert adjacent placements are contiguous and the last end equals `timeline.bars`; never include render tail.
- Independently read `analysis.json.sections` and match its `id` sequence exactly against the timeline IDs. Derive loudest only from each section's gated `SectionMetrics.integratedLufs` (`src/analyze/analysis.schema.ts:36-39`). Require every section value finite, then sort descending by full parsed numeric value, stable ID as a diagnostic tie-break. If the highest two differ by **≤0.1 LU**, mark the case `excluded: "loudest_tie"` and do not dispatch it; no replacement or denominator shrink silently satisfies c-3. A null section LUFS also blocks the case until investigated. Do not use ungated flow interval LUFS or the image label as truth.
- First hook is the first placement whose `role === "hook"`, returned as `startBar+1`, or `null`. A missing hook such as house is valid. Record the SHA-256 of song JSON, analysis JSON, overview PNG and control PNG in ground truth; the score step refuses responses paired with different hashes. Keep the binary images and rendered WAV in the task-owned work directory; committed evidence contains hashes and scores, not binary media or personal absolute paths.
- Follow 003's JSON validation: the model answer must parse to an object with exactly `section_order`, `boundary_bars`, `loudest_section`, and `hook_start_bar`; arrays/integers/nulls must have the stated types, with no extra keys. Exact whole-array order is required. Only when order is exact, compare equal-length boundaries positionally; each boundary hits at `abs(predicted-actual) <= 1`, otherwise boundary score is zero. Loudest requires exact ID. Hook is exact `null` or ±1 bar. Also report per-boundary hit fraction and the four-way full-correct result from 003.
- The release c-3 predicate is deliberately narrower than 003's four-way diagnostic: at the **native long-side-1600** condition, at least **3 of the 4 fixed cases** must have exact order, every boundary within one bar, and exact loudest ID. Hook correctness is reported and can drive a layout fix, but does not change that predicate. All four fixed cases must be eligible and have valid overview responses; an excluded, missing, or malformed fixed case makes the gate incomplete. The spectrogram control and 1280/1024 conditions are reported, never used to waive a failed overview gate. This is evidence for these examples, not a general VLM accuracy claim.

### Prepare algorithm, in execution order

1. Parse `prepare --work-dir <dir> [--case <song>]...`; require a non-root work directory outside the tracked repository and create only task-owned descendants. Resolve the four fixed paths from `examples/` plus explicit extras, preserving core order and sorting extra paths lexically.
2. For each case, call the public `render` CLI with an explicit WAV path under the work directory. Parse its single JSON result and require success; if the command fails, stop and retain its exit code/stderr in a local, untracked error log.
3. Call `analyze` on that WAV with the source song and explicit output directory. Parse its single JSON result, require success, and read the paths from `data`, not from guessed filenames. Assert `data.overviewPng`, `data.spectrogramPng`, and `data.analysisJson` exist inside the work directory.
4. Read/validate the song with the repo's loader, build its timeline, and compare placement count/order with `analysis.json.sections` before computing any truth. Validate source `version`, all finite LUFS values, positive bar lengths, contiguous start bars, and `timeline.durationSeconds` excluding tail.
5. Compute the occurrence IDs from placements, boundary array, first hook, maximum gated section LUFS and top-two margin. A single section has no runner-up, so its margin is `null` and it is eligible if its LUFS is finite. Mark a tie only when two or more sections differ by at most 0.1 LU at the top.
6. Validate both PNGs as RGB8/filter-0 with PNG signature, dimensions, row length and CRC. Use `node:zlib` to inflate IDAT and a fixed area-average resampler; for each target side set `scale = target / max(width,height)` and output dimensions by rounded scaling, minimum one pixel. Apply the exact algorithm to overview and spectrogram, including upscaling when needed to reach the requested side.
7. Encode each size with the existing PNG encoder, except the unchanged native 1600 overview. Hash the exact bytes the agent will see, and put them under `<work>/<case>/<kind>-<side>.png`; keep the original artifacts too. Ground truth records both original and prepared hashes, so `score` can reject stale or swapped images without needing a personal path.
8. Write one truth JSON atomically: temporary sibling file, then rename. Never print the truth alongside the dispatch path manifest. A second identical `prepare` run yields byte-identical truth JSON and PNG bytes under the same Node major/platform. Do not use current time, random names or host paths in tracked JSON.

### Score algorithm, in execution order

1. Load all truth files and `r1` answer files; expect one answer for every eligible case, kind and side. Preserve missing/invalid entries as failed diagnostic rows. Only a missing or invalid **core overview/1600/r1** answer makes `c3Complete=false`; a missing control or scaled diagnostic is reported but never changes c-3.
2. Check `caseId`, kind, side, positive repetition, requested/served model ID, prompt SHA-256 and prepared image hash before parsing model text. A mismatch is an evidence-integrity error, not a wrong musical answer.
3. Parse the raw response as JSON with no Markdown fence. Enforce the four-key schema exactly, finite safe integer bars, and `string[]` IDs. A model's additional explanation makes the row invalid. Preserve the raw text in its answer file for inspection.
4. Compare the whole order array. Only if it matches exactly and boundary lengths match, compute hit count and hit fraction; `allBoundariesWithinOne` requires every element within one bar. Else both the hit fraction and all-boundary flag are zero/false.
5. Compare loudest occurrence ID exactly. Compare hook as exact `null` or integer within one bar. Set `fourWayCorrect` from all four metrics, and `c3CaseCorrect` from only order, all boundaries and loudest. An invalid schema yields both false.
6. Count the four `overview`/1600/r1 core rows; require four eligible and valid rows, then apply `nativeOverviewPasses >= 3`. Never substitute a use-case row, control row, 1280/1024 row or later repetition for one of these four.
7. Write `summary.json` and Markdown table in stable sorted order; report numerator/denominator for overview and control separately at each size, and list excluded extra cases with reasons. The process exits 0 only for a complete passing c-3; it still writes diagnostic files on a failed gate.

## File map

| Path | Op | Exact content |
|---|---|---|
| `scripts/eval-overview.mjs` | NEW | Node ESM script with `prepare` and `score` subcommands; no model API. Both subcommands take a required `--evidence-dir <dir>` (repo-relative); the script hard-codes no devlog unit path, so the same command works before and after the unit moves to `_fin`. `const CORE_CASES = ["drill-140","trap-150","boom-bap-90","house-124"]`, `const IMAGE_SIDES = [1600,1280,1024]`, `const TIE_LU = 0.1`, `const BAR_TOLERANCE = 1`, `const PASS_CASES = 3`. Export `selectCases(extraPaths: readonly string[]): string[]`, `deriveGroundTruth(songPath: string, analysisPath: string, imagePaths: {overview: string; spectrogram: string}): Promise<GroundTruth>`, `scoreAnswer(truth: GroundTruth, captured: CapturedAnswer): AnswerScore`, and `scoreCorpus(truths: readonly GroundTruth[], captures: readonly CapturedAnswer[]): EvalSummary` for focused tests; CLI guard runs only when invoked directly. JSDoc typedefs mirror the interfaces below. Validate args and paths inside repo examples, stable sort extras, reject duplicate stems and missing files. `prepare` uses `execFileSync(process.execPath, ["bin/music2.js", "render", song, "-o", wav, "--json"])` then `analyze wav --song song --out analysisDir --json`; check exit status and one JSON object. Decode only this project's RGB8/filter-0 PNG format, resize both images by the same deterministic area-average algorithm to long sides 1600, 1280, 1024, and encode with `encodeRgbPng` from `src/analyze/png.tool.ts`; never send an image embedded in JSON. Leave 1600 overview bytes unchanged when already 1600 wide. Hash prepared image bytes. Write per-case truth JSON under `<evidence-dir>/ground-truth/` in stable key order, with 2-space indentation/newline and no absolute work paths. Emit to stdout a dispatch manifest of local image paths and hashes for main; do not commit this path-bearing manifest. `score` loads the committed truth/answer JSON, verifies case/variant/size/hash/model fields, rejects duplicates and stale hashes, computes all conditions, writes `<evidence-dir>/summary.json` and the sibling Markdown `<evidence-dir>.md` (for this unit, `evidence/overview-eval/summary.json` and `evidence/overview-eval.md`), exits nonzero when c-3 is incomplete or false. |
| `tests/e2e/overview-eval.test.ts` | NEW | Import the pure harness exports and use synthetic song/analysis/image data under a temporary directory. Two placements `intro#0` at bars 0–3 and `hook#0` at 4–7 yield order `["intro#0","hook#0"]`, boundaries `[1,5,9]`, first hook `5`; section LUFS `-20,-14` yields `hook#0`. Scores: `[1,6,9]` hits all boundaries; `[1,7,9]` misses one and fails case; swapped order zeroes boundary score; wrong array length, extra key, string bar, malformed JSON fail schema. `-14.00` versus `-14.05` triggers `loudest_tie`; `-14.00` versus `-14.11` is eligible. Four valid overview captures with exactly three passing satisfy c-3; two passing, a missing fourth, or a tie exclusion do not. Control failures never alter c-3. Hash mismatch and duplicate captures fail. RGB8 2×2 downscale vector `[(0,0,0),(100,0,0),(0,100,0),(100,100,0)]` to 1×1 gives `(50,50,0)`; three sizes and image-kind pairing are asserted. Scoring the same truth/answer fixtures after copying the evidence directory to a different relative path yields byte-identical `summary.json` (archive-move vector). This test is discovered by `npm test` (`scripts/test.mjs:74-77`). |
| `devlog/_plan/260928_music2_flow_practice/evidence/overview-eval/ground-truth/<case>.json` | NEW | One file for each four core and each wp3 use-case song: `GroundTruth` below, including source hashes, ordered IDs, 1-based inclusive start/change/end boundary bars, first hook bar, section LUFS map and unrounded loudest margin. Never hard-code the provisional 003 table as the expected value. The generated files are evidence, not model input. |
| `devlog/_plan/260928_music2_flow_practice/evidence/overview-eval/answers/<case>.<kind>.<side>.r1.json` | NEW | Main saves one `CapturedAnswer` for each case, `kind` (`overview` or `spectrogram`), and side (`1600`, `1280`, `1024`), preserving the raw response string verbatim; the scorer parses it and records any parse failure. `r1` is the required first repetition; additional repetitions use `r2`, etc. Store image hash, model ID, `promptSha256`, and preprocessing side. No song path, analysis JSON, audio, or second image enters the subagent input. |
| `devlog/_plan/260928_music2_flow_practice/evidence/overview-eval/summary.json` | NEW | `EvalSummary` below, deterministic score rows sorted core-case order then extras, kind, side, repetition; include eligibility/exclusion, each 003 metric, 3-part c-3 result, control result, and model/prompt/hash provenance. |
| `devlog/_plan/260928_music2_flow_practice/evidence/overview-eval.md` | NEW | Human scoring table: case, image kind, side, repetition, order, boundary fraction and all-boundary flag, loudest, hook, four-way 003 result, c-3 result, exclusion/invalid reason. State `native overview core pass X/4`, threshold `>=3`, control outcome, 1280/1024 outcomes, model ID and prompt digest. Include the exact commands, work directory convention, generated SHA, and a link to answer JSON; omit personal absolute paths and the image binaries. |
| `skills/music2/SKILL.md` | MODIFY | At `skills/music2/SKILL.md:10`, link `references/overview.md`; at `:18-20`, after analyze add the step: open `overview.png`, read numbered section table left-to-right, compare boundary bars with bar/time axis, identify `LOUDEST` by `SECTION LUFS` and first orange `HOOK`, then correlate warning/verdict with `analysis.json`/`analysis.md`; WAV-only uses beat/0.5 s axis and makes no declared section claim. At `:60`, add overview to the section-change recheck. Preserve the no-hearing caveat. |
| `skills/music2/references/overview.md` | NEW | Explain each panel in the accepted 004 order and exact label semantics: header BPM/key/whole-file LUFS/true peak; three verdict slots and fallback strings; numbered section rail/table with `id#occurrence`, 1-based starts and end boundary; per-bar ungated LUFS versus table's gated `SECTION LUFS`; three event-density lanes; music2 RGB three-band waveform with 200/2000 Hz crossovers and overlapping bands; novelty boundary hit/miss; spectral centroid brightness; non-time global six-band share; 256-px similarity matrix and off-diagonal repeats; legend. Define `LOUDEST`, orange hook outline, matched/missed declared boundary, and repeat ranges. Explain that a WAV-only axis says beats or 0.5 s and has no declared sections/hook; a render tail is outside the song bar axis. Images and metrics cannot prove that an agent heard the audio. Cross-link `mixing.md` for actionable adjustments. |
| `skills/music2/references/mixing.md` | MODIFY | After `skills/music2/references/mixing.md:3`, add `overview.png` as the first arrangement/flow reading surface; distinguish gated `SECTION LUFS` from ungated bar curve, explain adjacent section gap in LU, point to `overview.md`, and say RGB bands overlap rather than sum to exact full-band energy. Keep six-band advice at `:7-18`. |
| `README.md` | MODIFY | At `README.md:20`, add `overview.png` to the vision artifact list and a sentence that it shows labeled section order, boundary bars, loudness flow, density, and warnings; at `:33`, name the overview in analyze's purpose. Preserve the conditional `pianoroll.png` and hearing caveat. |
| `docs/cli.md` | MODIFY | At `docs/cli.md:20`, insert required `overview.png` after `spectrogram.png` in analyze's returned artifact list, describe WAV-only overview axis and song-only section labels; at `:25`, say WAV-only still emits overview. Preserve the one-object JSON envelope at `:27-35`, updating the illustrative version at `:32` to the released version. |
| `CHANGELOG.md` | MODIFY | Insert `## 0.2.0` above `CHANGELOG.md:3`; bullets for deterministic flow measurements and `overview.png`, text/image-only section reading, revised skill/docs and evaluation evidence, with no claim of model success until the table proves it. Retain 0.1.0 history. Version change in `package.json`/lockfile belongs to the parent release lane, not this writer's scope; the implementer must align the actual release version before push. |
| `package.json` | MODIFY | In the parent release lane, update only `package.json:3` from `"version": "0.1.0"` to `"version": "0.2.0"` after the implementation and c-3 gate pass; keep dependencies/engine/scripts unchanged. This file is listed for release completeness, not edited by this docs writer. |
| `package-lock.json` | MODIFY | In the parent release lane, update root versions at `package-lock.json:3,9` from `0.1.0` to `0.2.0` in the same commit as `package.json`; no dependency resolution churn. This file is listed for release completeness, not edited by this docs writer. |
| `devlog/str_func/analyze.md` | MODIFY | Update file tree at `devlog/str_func/analyze.md:23-24`, responsibility/artifact list at `:45-46`, and artifact writer section at `:106-120` to include flow, overview, and evaluation ownership; document the existing wp1/wp2 exact exports after source lands, `overviewPng` required in result/artifacts, and the CLI path position. State that the evaluation harness consumes artifacts but does not sit inside the runtime module. |
| `devlog/str_func/audio-io.md` | MODIFY | Update file tree at `devlog/str_func/audio-io.md:13-16`, module responsibility at `:31-33`, and signatures at `:43-52` for wp1's shared K-weighted power scanner and its test; retain the gated `measureLoudness` semantics and state that flow consumes ungated interval power. Reconcile exact wp1 export names with source; do not invent a second meter. |
| `tests/e2e/examples.test.ts` | MODIFY | At `tests/e2e/examples.test.ts:20-27`, add wp3's finalized public use-case fixtures to the e2e example set. At `:101-114` and `:116-121`, **verify the wp2-owned changes in 010** already assert overview basename, PNG signature/IHDR, path containment and repeated drill overview bytes; do not implement those assertions a second time. Add only any missing use-case assertion after wp2 lands. The e2e test cannot claim vision accuracy. |
| `devlog/_plan/260928_music2_flow_practice/` → `devlog/_fin/260928_music2_flow_practice/` | MODIFY | After evidence and first exact-SHA CI pass, archive the whole numbered unit by a tracked move with its report/JSON evidence. After the move, rerun `score --evidence-dir devlog/_fin/260928_music2_flow_practice/evidence/overview-eval` and require byte-identical `summary.json`. This changes HEAD, so push and reverify the **new final SHA** before calling the release complete. Update any relative evidence links if the move changes their targets. |

No new `*.tool.ts` is introduced in wp4, so the colocated-tool-test rule is vacuous here. `tests/e2e/overview-eval.test.ts` is the harness's concrete test row; wp1/wp2 tools and their colocated tests are owned by those units. The e2e overview assertions in `tests/e2e/examples.test.ts` belong to wp2's 010; wp4 verifies them and extends the list for wp3 examples only.

## Reader-facing copy contract

The new skill reference describes the rendered image in this reading order, matching 004 rather than the shorter draft in 003:

1. Header: declared/estimated BPM, key, whole-file integrated LUFS and true-peak estimate; these describe the full analyzed render.
2. Verdict strip: highest-priority warning, largest adjacent section loudness gap, and first hook. If missing, quote the actual fallback text from wp2, including `NO FLAGS`, `SECTION GAP N/A`, or `NO HOOK DECLARED`.
3. Section flow: the ordered numbered blocks and right table share occurrence IDs; `#0` is the first occurrence, while `B01` is the first bar. The final printed boundary is `bars+1`.
4. Per-bar loudness: the time trace is an ungated interval mean; the table's `SECTION LUFS` is independently gated over each section. The vertical axis is LUFS, while an adjacent-section *difference* is LU.
5. Density: drums, bass/808 and other notes use events per bar. This is an arrangement/event measure, not a timbre or perceived-intensity score.
6. Three-band waveform: low below 200 Hz, mid 200–2,000 Hz, high above 2,000 Hz use music2 RGB. Crossover filters overlap, so the displayed band powers are not an exact partition of full-band energy.
7. Novelty and brightness: peaks can match or miss declared boundaries, and centroid indicates spectral balance. Neither guarantees a musical transition or subjective brightness.
8. Global six-band share and self-similarity inset: the global bars have no time axis; an off-diagonal stripe means similar interval features and is not proof of identical notes.
9. Legend and caveat: text, position, bar height and outlines carry meaning beyond color; no view or metric means the agent has listened to the audio.

The skill's quick workflow points to that reference after the `analyze` call. README names `overview.png` before optional `pianoroll.png`; CLI docs list its `data.overviewPng` path and explain that WAV-only analysis still emits the overview with an inferred beat or 0.5 s axis. `mixing.md` uses a specific section-gap observation to suggest comparing the two sections' instruments/gains, then rerendering and remeasuring; it does not turn a gap into an automatic failure. This text keeps the current advisory role of key, tempo and critique results.

## New TypeScript-shaped evidence contracts

The `.mjs` harness declares matching JSDoc shapes and validates parsed JSON at its file boundary. These interfaces specify every new persistent or exchanged type; they are **not** a new package runtime API.

```ts
export interface GroundTruth {
  schemaVersion: 1;
  caseId: string;
  corpus: "core" | "use_case";
  sourceSha256: string;
  analysisSha256: string;
  imageSha256: { overview: string; spectrogram: string };
  preparedImageSha256: {
    overview: Record<"1600" | "1280" | "1024", string>;
    spectrogram: Record<"1600" | "1280" | "1024", string>;
  };
  sectionOrder: string[];           // placement.section#placement.occurrence
  boundaryBars: number[];           // 1-based, includes final bars+1
  sectionIntegratedLufs: Record<string, number | null>; // gated SectionMetrics
  loudestSection: string | null;
  loudestMarginLu: number | null;    // highest minus runner-up, unrounded
  firstHookBar: number | null;
  excluded: "loudest_tie" | "null_section_lufs" | null;
}

export interface ModelAnswer {
  section_order: string[];
  boundary_bars: number[];
  loudest_section: string | null;
  hook_start_bar: number | null;
}

export interface CapturedAnswer {
  schemaVersion: 1;
  caseId: string;
  imageKind: "overview" | "spectrogram";
  longSide: 1600 | 1280 | 1024;
  repetition: number;              // 1 for required first call
  model: "gpt-6-sol";
  promptSha256: string;
  imageSha256: string;
  rawResponse: string;             // exact model text; parsed by scorer
}

export interface AnswerScore {
  caseId: string;
  imageKind: CapturedAnswer["imageKind"];
  longSide: CapturedAnswer["longSide"];
  repetition: number;
  validSchema: boolean;
  orderExact: boolean;
  boundaryHitFraction: number;     // 0 when order/length wrong
  allBoundariesWithinOne: boolean;
  loudestExact: boolean;
  hookWithinOneOrNull: boolean;
  fourWayCorrect: boolean;         // 003 diagnostic
  c3CaseCorrect: boolean;          // order + all boundaries + loudest
  error: string | null;
}

export interface EvalSummary {
  schemaVersion: 1;
  model: "gpt-6-sol";
  promptSha256: string;
  coreCases: 4;
  nativeOverviewPasses: number;
  c3Complete: boolean;
  c3Pass: boolean;                  // complete && passes >= 3
  exclusions: Record<string, GroundTruth["excluded"]>;
  scores: AnswerScore[];
}
```

The following signatures are script exports, not music2 public exports:

```ts
export function selectCases(extraPaths: readonly string[]): string[];
export async function deriveGroundTruth(
  songPath: string, analysisPath: string,
  imagePaths: { overview: string; spectrogram: string },
): Promise<GroundTruth>;
export function scoreAnswer(truth: GroundTruth, captured: CapturedAnswer): AnswerScore;
export function scoreCorpus(
  truths: readonly GroundTruth[], captures: readonly CapturedAnswer[],
): EvalSummary;
```

## Vision dispatch and capture procedure

1. Main runs `node scripts/eval-overview.mjs prepare --evidence-dir devlog/_plan/260928_music2_flow_practice/evidence/overview-eval --work-dir /tmp/music2-overview-eval` plus one `--case` for every wp3 use-case example. Review the ground-truth JSON and hashes **before** dispatch. If a core case has a null section LUFS or ≤0.1 LU loudest margin, repair the source/artifact or select a documented replacement in a new agreed gate; this plan cannot silently count only three songs.
2. Use exactly the prompt below from 003, byte for byte. Compute/store its SHA-256. For each eligible case, size and kind, main creates a **fresh vision-capable `gpt-6-sol` subagent** with only one `items` entry of type `local_image` containing that prepared image and the prompt text. No filename, case ID, JSON, WAV, second image, chat history, or ground truth appears in the agent request. Use the same model and image preprocessing for overview and control. A fresh subagent means no prior image/answer context leaks across calls.
3. Capture the raw reply into the `CapturedAnswer` JSON path in the file map, including model ID, image hash, size and repetition. A failed or non-JSON model reply is still captured verbatim and scores invalid. Do not hand-edit an answer. Planned `r1` calls cover both overview and control at 1600, 1280, and 1024; later repetitions are optional diagnostics and cannot replace a missing native overview `r1` gate row.
4. Run `node scripts/eval-overview.mjs score --evidence-dir devlog/_plan/260928_music2_flow_practice/evidence/overview-eval` (after archival: `--evidence-dir devlog/_fin/260928_music2_flow_practice/evidence/overview-eval`). Inspect `overview-eval.md`, individual raw answers, exclusions, and the native c-3 count. If under 3/4, the wp2 owner fixes labels/layout and main repeats evaluation with new image hashes and fresh agents; retain prior scored evidence under a separate dated attempt instead of silently overwriting it.

```text
Read only the attached image. Report the section occurrences in left-to-right order, including their printed IDs. Boundary bars are the start of the first section, every section change, and the end boundary after the final section. Bar numbers are 1-based. Identify the section with the highest printed SECTION LUFS value, and the first bar of a section whose role is HOOK. If there is no hook, use null. Do not infer unheard audio. If a value cannot be read, use an empty list or null. Return only JSON with exactly these keys:
{"section_order":["id#occurrence"],"boundary_bars":[1],"loudest_section":"id#occurrence","hook_start_bar":null}
```

## Acceptance

| Check | Command | What it observes |
|---|---|---|
| Harness vectors | `node --test tests/e2e/overview-eval.test.ts` | Ground-truth conversion, 0.1 LU exclusion, exact answer schema, ±1 bar rule, missing/duplicate/hash conditions, 3/4 gate and RGB resize vector. |
| Static contract | `npm run typecheck && npm run lint` | New e2e TypeScript and script imports obey repository checks; no new dependency. |
| Full affected suite | `npm test` | Existing analysis/CLI/e2e tests plus overview artifact assertions and harness vectors run with zero failures. |
| Build and structure | `npm run build && npm run audit:structure` | Dist and repository layout remain valid after docs/e2e changes. |
| Genre docs | `npm run docs:genres:check` | Existing generated recipe docs remain synchronized if wp3 changed cards. |
| Ground truth | `node scripts/eval-overview.mjs prepare --evidence-dir devlog/_plan/260928_music2_flow_practice/evidence/overview-eval --work-dir /tmp/music2-overview-eval` | Four fixed songs render and analyze; generated JSON has timeline-derived order/bar boundaries and analysis-derived gated loudest; all image hashes present. Run with explicit `--case` arguments for wp3 extras. |
| Model scoring | `node scripts/eval-overview.mjs score --evidence-dir devlog/_plan/260928_music2_flow_practice/evidence/overview-eval` (after archival: `--evidence-dir devlog/_fin/260928_music2_flow_practice/evidence/overview-eval`) | Paired r1 captures at all three sizes produce raw answers, per-field scores and a control report; only four core native overview rows define the 3/4 c-3 decision. A failed or incomplete gate exits nonzero; a missing control is reported without altering that exit predicate. |
| Public CLI artifact | `node bin/music2.js analyze examples/drill-140.song.json --out /tmp/music2-overview-smoke --json` | One JSON envelope includes `overviewPng` after `spectrogramPng`, file exists, PNG signature/dimensions valid; no source tree output created. |
| Privacy | `npm run privacy:scan` | Tracked evidence/docs contain no private material or personal absolute paths; inspect push range separately for identifiers before remote update. |
| Public identity | `git log -1 origin/main --format='%an <%ae>|%cn <%ce>'` | Established public author/committer identity; compare each release commit using `git log origin/main..HEAD --format='%h %an <%ae>|%cn <%ce>'` before push. A mismatch is corrected on unpushed commits. |
| Hosted exact SHA | `gh run list -R lidge-ai/music2-gen --commit <SHA> --json databaseId,event,headSha,status,conclusion,workflowName` and `gh run view <RUN> -R lidge-ai/music2-gen --json event,headSha,attempt,status,conclusion,jobs` | Match the pushed `main` SHA, `push` event and run attempt; `checks`, all six OS×Node `test` jobs, and aggregate `ci` actually ran and succeeded. Also inspect `gh api 'repos/lidge-ai/music2-gen/commits/<SHA>/check-runs?per_page=100'`; absent/skipped/cancelled/pending jobs are not success. |
| Final archived SHA | `git rev-parse HEAD` then the same exact-SHA `gh` queries | After moving the unit to `_fin` and pushing that commit, the final SHA again has checks + six test jobs + ci green; record SHA/run ID/attempt in release evidence. |

## Activation scenarios

- `overview-eval.test.ts`'s two-placement vector activates 0-based occurrence IDs and 1-based bar conversion; final boundary `9` proves the end bar is included. Repeated `hook#1` after `hook#0` proves the occurrence suffix comes from placements rather than role text.
- The `-20,-14` LUFS vector selects `hook#0`; a 0.05 LU difference activates exclusion, while 0.11 LU difference stays eligible. Null LUFS activates incomplete-case handling; house activates `firstHookBar:null` and requires model `null` for its hook diagnostic.
- A predicted middle boundary `6` versus truth `5` activates the allowed ±1 path; `7` activates miss. Swapped section IDs activate order failure and force boundary fraction 0 even if numbers match. An extra JSON key, wrong type, malformed reply, missing capture, duplicate capture, and changed image hash each activate distinct invalid/incomplete paths.
- The 2×2 RGB vector activates deterministic resampling; a native 1600 overview exercises no-op byte preservation, while 1280/1024 exercise resizing. Overview/control pairs at each size activate the identical-preprocessing check; control's poor score remains report-only.
- `tests/e2e/examples.test.ts` loops every curated and wp3 example through WAV+song analysis, checks the overview artifact and path containment; drill's second render checks byte identity under the same Node major/platform. Separate WAV-only analysis checks an overview exists without claiming a section/hook.
- The hosted gate is activated by the pushed `main` SHA and `push` workflow event; inspect the aggregate's dependencies. A missing job, `workflow_dispatch` for the same SHA, or a cancelled leg leaves the release unproven. Archival creates a new SHA and deliberately activates the second hosted proof.

## Release sequence and evidence boundary

Finish local gates, model scoring, docs and changelog, then check identity and privacy. Commit the completed implementation/evidence on `main` with the repository's conventional commit style, push the authorized `main` lane, and record its SHA plus exact hosted run ID/attempt after all eight expected jobs succeed (`checks`, six `test`, `ci`). Move the unit from `_plan` to `_fin` only after that proof; commit and push the archive, then repeat the eight-job exact-SHA check for the final HEAD. No npm publish or tag is part of this unit; if any job is absent, skipped, cancelled, pending or failed, report that state without claiming release completion.

The release operator follows these ordered receipts:

1. Confirm that `package.json`, `package-lock.json`, CLI `version`, `docs/cli.md`'s illustrative envelope and `CHANGELOG.md` all say 0.2.0. The version change is a release action; the wp4 harness does not modify package metadata when preparing cases.
2. Check `git status --short` and `git diff --check`. Review the exact staged diff so task-owned JSON evidence contains no generated WAV, binary PNG, prompt leakage, local dispatch manifest, token, or personal absolute path.
3. Compare `git log -1 origin/main --format='%an <%ae>|%cn <%ce>'` against every `origin/main..HEAD` commit's author and committer. Use the already-public repo identity on release commits; if it differs, correct the unpushed commit before a remote receives it.
4. Run `npm run privacy:scan`, then review the push range for client/person/company identifiers relevant to this repo. Private material in an unpushed commit must be removed from that commit's history, not patched with a later commit that leaves the original remotely reachable.
5. Push the completed `main` commit. Save `git rev-parse HEAD`, remote repository identity, CI run ID, attempt, workflow event and each expected job's status/conclusion. The matrix has `ubuntu-latest`, `macos-latest`, `windows-latest` × Node `22`, `24` (`.github/workflows/ci.yml:34-53`); `checks` is `:17-32` and aggregate `ci` is `:54-63`.
6. Inspect the commit check runs and the `CI` push workflow for the same SHA. A `workflow_dispatch` run, aggregate alone, zero failing jobs, or `gh run view --exit-status` alone does not establish the eight successful jobs. If a leg is absent, determine whether it never started, is pending, was cancelled, or was skipped before deciding how to recover.
7. Archive the numbered unit to `_fin` with its evidence intact. Recheck file links, commit and push that move, then collect a second full hosted receipt for the new final SHA. Record both SHA/run/attempt pairs in the release evidence so the archive commit is not mistaken for a previously verified head.
8. Finish with the final HEAD, exact eight-job result, c-3 numerator, control diagnostic, and the no-publish/no-tag boundary. If c-3 or CI remains incomplete, state that precisely and leave the release claim open.
