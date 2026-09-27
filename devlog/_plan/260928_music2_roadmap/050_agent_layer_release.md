# 050 — wp6 Agent layer, examples, dogfood, and public CI

**Summary.** wp6 makes the wp2–wp5 CLI usable by a text-only coding agent without private context: a portable skill, generated genre reference, complete user docs, and runnable song examples. A blind text-only dogfood pass must create a new song that validates, lints, renders, and analyzes. After privacy and local gates pass, create the public GitHub repository, push `main`, and verify every expected hosted CI job on that exact SHA.

Depends on: 003 D1/D6/D11–D13, 010 contracts, 020 render/voice registry, 030 analyze outputs, 040 recipe/lint/critic commands; 002 audio route, 004 mini-notation, 005 DSP, 006 recipe decisions. Consumed by: users and agents installing the skill, release verification, vid2-gen users reading `beats.json`. 020/030/040 are implementation prerequisites; verify their final signatures and flags before editing docs. The PoC `/tmp/music2-poc/render.mjs` is behavior evidence only, not distributable source (it imports AGPL `@strudel/mini`).

## Scope

IN: the file map, CLI `skill path`, example tests, blind dogfood, privacy scan, public repo creation, pushed `main`, exact-SHA CI verification, and archival. OUT: npm publish, package tag/GitHub release, global skill installation or user config writes, bundled samples, browser/Chrome integration, changes to vid2-gen or opencodex, copy of AGPL or vid2-gen code. Runtime dependencies remain zero; Node >=22.18 and erasable TypeScript remain the contract. There is no `Math.random` or `Date` in the audio path; any generated musical choice uses `src/shared/prng.tool.ts` with the song seed.

## File map

`NEW` means create in wp6; `MODIFY` means an existing wp2–wp5 file and the exact new behavior. Paths are repository-relative. Every item in the table is part of the intended diff; `.gitkeep` placeholders under `docs/` and `tests/e2e/` may remain, with no deletion required. No new `*.tool.ts` is introduced in wp6; new logic is a CLI command module and two dependency-free scripts, each with a specified test row.

| Path | Op | Exact content/change |
|---|---|---|
| `AGENTS.md` | MODIFY | Replace wp2 stub with: purpose/entry points; Node >=22.18, ESM TS type stripping, no runtime deps; `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; `*.tool.ts` + colocated `*.test.ts`, schema `*.schema.ts`, feature `index.ts` boundary; update `devlog/str_func` with changed exports; preserve `devlog/_plan` → `_fin` unit history; deterministic seed policy; no AGPL or source copying (004 clean-room parser); keep private files/absolute personal paths out; conventional commits; push/release only within explicit task scope. Distinguish repository agent development rules from end-user `skills/music2/SKILL.md`. |
| `skills/music2/SKILL.md` | NEW | Self-contained, model-neutral composition workflow defined below. Include description/triggers, prerequisites (`node bin/music2.js`, optional ffmpeg for MP3, optional audio route), exact commands, failure branches, and links to five local references (mini-notation, instruments, genres, mixing, prompts). No global install instruction that writes config; `music2 skill path` gives a path the host may choose to load. |
| `skills/music2/references/mini-notation.md` | NEW | Cheat sheet: one cycle = one bar; whitespace sequence, `[ ]` subdivision, `~`, `< >` alternate bars, `,` simultaneous tones, `*n`, `/n`, `!n`, `@n`, `(k,n,r)`, `?p`, `\|`; note `c4`/`eb3`/`f#2`, numeric MIDI, drum `bd:3`. Include 004 onset examples (`bd sd` at 0,1/2; `bd [hh hh] sd` at 0,1/3,1/2,2/3); valid suffix order and bounds from 010; explicitly reject `{ }` polymeter and mixed `,`/`\|` group. State that implementation is music2's clean-room subset, not full Strudel compatibility. |
| `skills/music2/references/instruments.md` | NEW | Generate a manually reviewed table from 020's final voice registry: each synth voice ID, `Track.kind`, accepted atom/sample names, every numeric `params` key with type/range/default, `gain`/`pan`/`gate`/`mono`/`glide`/`sends`/`duck` controls, and one valid JSON track snippet per voice family. Cover kick, snare/clap, closed/open hats, 808, bass, bell, keys, pluck, pad, lead, plus `kit:<relative kit.json>` PCM WAV manifest and license ownership. Do not invent parameters that the registry rejects; test snippets through `music2 validate`. |
| `skills/music2/references/genres.md` | NEW | Generated file only, never hand-edited. Header says `node scripts/gen-genre-docs.mjs` is source; cards are authoritative. One section each for `drill_uk`, `drill_ny`, `trap`, `boom_bap`, `lofi_hiphop`, `house`, `techno`: BPM/feel, key starter, drum grid, bass/harmony/palette, arrangement, mix target, lint rule IDs and one-bar examples. Sort by recipe id; stable LF, UTF-8, no timestamp/path. |
| `skills/music2/references/mixing.md` | NEW | Explain metrics and actions: streaming-oriented starting point ~-14 LUFS and <=-1 dBTP is guidance, not a required exact target; if louder, consider <=-2 dBTP per 006. Map six 005 band shares to audible symptoms, without treating fixed band ratios as universal pass/fail; protect sub/kick separation, trim 808/keys low mids, tame harsh hats/metallic bell, keep stereo sub centered, use gain/sends/duck before master gain, and remeasure after edits. `truePeakEstimate` is an estimate at 44.1 kHz; under-60 s LRA is provisional. |
| `skills/music2/references/prompts.md` | NEW | Decision worksheet: extract tempo, genre, key/mode, mood, length, required instruments; map unknown genre to closest card but retain user constraint explicitly; choose original patterns/sections, then instrument/palette, arrangement, mix; check conflicting demands via `validate`/`lint`. Worked `140 BPM hip-hop drill` → `drill_uk`, 140, 4/4, C minor default if unspecified, half-time snare step 9, sparse kick, subdivided hats, tuned 808, dark keys; identify key choice as default, not user instruction. Worked `90 BPM boom bap in D minor with dusty keys` → `boom_bap`, 90, D minor, beat-2/4 snare, swing hats, keys loop, rounded bass. |
| `scripts/gen-genre-docs.mjs` | NEW | `renderGenreDocs(cards: readonly RecipeCard[]): string` and `main(argv: string[]): Promise<number>` (JSDoc types in JS); call `listRecipes()` through Node TS type stripping from `src/recipes/index.ts`, sort by id, render card fields with escaped Markdown pipes/backticks and LF final newline. `--check` compares generated bytes with `skills/music2/references/genres.md`, prints only mismatched path and exits 1; default writes atomically only if bytes differ. `--out path` targets a test file; unknown flags exit 2; no clock, environment, random input or external dependencies. |
| `tests/e2e/genre-docs.test.ts` | NEW | Spawn `node scripts/gen-genre-docs.mjs --check`: committed file passes; temporary altered copy (test-only path supplied through `--out`) exits 1; running generator twice yields identical bytes; all seven recipe IDs and lint IDs appear exactly once. No repo file mutation in tests. |
| `tests/e2e/skill-docs.test.ts` | NEW | Load `SKILL.md` and all five references through the printed `skill path`; assert their relative links resolve, CLI command examples use `new --genre`, `render -o`, `critique --excerpt`, and instrument `json` snippets each form a `Track` that validates when placed into a minimal Song. A missing reference, obsolete flag, or undocumented registry voice fails. |
| `src/cli/commands/skill-path.ts` | NEW | `export const skillPath: CommandSpec`; name `skill`, usage `music2 skill path [--json]`, zero options beyond global `--json`; require sole positional `path`, otherwise `Music2Error("E_INPUT", ...)` exit 2. Resolve `skills/music2` from `packageRoot()`, return absolute `path` only when `SKILL.md` exists; absent asset → `E_NOT_FOUND` exit 2 with source-install fix. Return `{command:"skill",data:{path}}`; human mode prints path only. No config writes or install. |
| `src/cli/registry.ts` | MODIFY | Import `skillPath` from `./commands/skill-path.ts` and add exactly one `register(skillPath)` entry in the existing registration list; `help` then discovers command from registry. |
| `src/cli/commands/help.ts` | MODIFY | Add one `skill path [--json]` usage/description row to the existing help text; keep render/analyze/new/lint/critique flags exactly as defined in 020/030/040. |
| `src/cli/output.ts` | MODIFY | Add human-mode `skill` case to `renderSuccess`: return `String(result.data["path"])`; retain existing JSON envelope `{ok,command,data,artifacts,warnings,meta:{music2}}`. |
| `src/cli/main.test.ts` | MODIFY | Add `skill path --json` test: `ok:true`, `data.path` absolute and ends in `skills/music2`, file exists; `skill path` is exactly one path line and makes no files; `skill install` and `skill` exit 2 with `E_INPUT`. |
| `package.json` | MODIFY | Add npm scripts `docs:genres`: `node scripts/gen-genre-docs.mjs`, `docs:genres:check`: `node scripts/gen-genre-docs.mjs --check`, `privacy:scan`: `node scripts/privacy-scan.mjs`; add `skills` to npm `files` so `music2 skill path` works from an installed package. Keep `dependencies` absent or `{}` and existing `bin`/engines/build scripts. |
| `.github/workflows/ci.yml` | MODIFY | In `checks` after build add `npm run docs:genres:check` and `npm run privacy:scan` before pack dry-run. Retain `checks`, matrix `test` (ubuntu/macos/windows x Node 22/24), and `ci` aggregate needing both. The genre check may not rewrite source. |
| `README.md` | MODIFY | Replace wp2 stub with what/why and constraints; install from source; 60-second 140 BPM drill command sequence using `examples/drill-140.song.json`; text-only uses `analysis.json` and `analysis.md`, vision also opens two PNGs, audio model may use `critique`; command reference incl. `skill path`; song format link/schema, examples, deterministic promise (same Node major/platform/seed), ffmpeg optional, contribution/test commands, MIT and clean-room/no AGPL notice. Keep examples and output names in lockstep with 020/030/040 CLI. |
| `docs/song-format.md` | NEW | Field table transcribed from `Song`, `Track`, `Section`, `ResolvedSong` in 010 plus defaults/ranges and a complete small song; arrangement repeats and section-pattern override/null mute; timing (`Fraction`, one bar/cycle, swing); instrument/velocity/kit semantics; JSON schema link; unknown keys and invalid patterns yield `E_SCHEMA` issues. No undocumented fields. |
| `docs/cli.md` | NEW | Every command from 010/020/030/040 plus `skill path`: positional args, flags/defaults/output paths, JSON success/failure envelopes, exit-code map 0–7 and error code map, ffmpeg and critic environment variables, no network for offline commands, command examples. Explicitly distinguish WAV analysis (no piano roll without `--song`) from song-backed analysis. |
| `CHANGELOG.md` | MODIFY | Replace `0.1.0 — unreleased` with `## 0.1.0` entry: clean-room song/pattern engine; offline deterministic WAV render, optional ffmpeg MP3/OGG; DSP/PNG analysis and beats; recipes/new/lint; optional advisory critique; model-neutral skill/docs/examples; CI. No release date, npm publication, tag, or hosted-release claim. |
| `examples/drill-140.song.json` | MODIFY | Preserve 020 demo's `genre:"drill_uk"`, 140 BPM, C minor, seed 140, 4/4 and 4-bar intro + 8-bar hook + 4-bar verse. Tune only patterns/voice params needed for zero 040 lint warnings: half-time snare step 9 in hook/verse, sparse kick, `sub` 808 pitch moves/glide, hat subdivision, dark bell/pad motif. Keep original tracked JSON; do not transcribe PoC's AGPL import. |
| `examples/trap-150.song.json` | NEW | Valid `genre:"trap"`, 150 BPM, A minor, fixed seed, half-time snare, eighth hats plus sparse burst, short kick/808, intro/verse/hook/outro. |
| `examples/boom-bap-90.song.json` | NEW | Valid `genre:"boom_bap"`, 90 BPM, C minor, fixed seed, 0.58 song swing applied to hat track, snares steps 5/13, keys loop, bass, intro/verse/hook/outro. |
| `examples/lofi-75.song.json` | NEW | Valid `genre:"lofi_hiphop"`, 75 BPM, A minor, fixed seed, 0.60 hat swing, soft kick/snare, keys/bass, restrained send and short arrangement. |
| `examples/house-124.song.json` | NEW | Valid `genre:"house"`, 124 BPM, A minor, fixed seed, kicks steps 1/5/9/13, clap 5/13, offbeat open hats 3/7/11/15, bass/pad, groove/breakdown/outro. |
| `examples/dogfood/boom-bap-dogfood.song.json` | NEW | Written by blind text-only agent, not copied from `examples/boom-bap-90.song.json`; valid D minor, 90 BPM, fixed seed, dusty keys and named drum/bass tracks, original patterns. Keep source JSON only, no rendered binary. |
| `tests/e2e/examples.test.ts` | NEW | Spawn public `node bin/music2.js` in temp dir for all five curated examples and dogfood: `validate --json` ok, `lint --json` has `data.results.length===0` for target card after tuning, `render -o <tmp>.wav --json` yields nonempty PCM WAV, `analyze <tmp>.wav --song <example> --out <tmpdir> --json` yields finite `data.summary` metrics and valid PNG signatures/dimensions. Drill: two WAV renders byte-identical, independent `estimatedBpm` in [138,142], two PNGs named correctly; intentional `genre:"house"` on drill copy produces named `house/*` `data.results` warnings and `lint --strict` exits 6 with `error.details.report`. These assertions are c-2/c-3/c-4/c-6 proof, not snapshots of implementation text. |
| `scripts/privacy-scan.mjs` | NEW | `export function scanText(text: string, source: string): PrivacyFinding[]`; `export async function main(argv: string[]): Promise<number>`. Scan staged/tracked/untracked intended files plus every text blob reachable from proposed `main` push (`git rev-list --objects main` + `git cat-file`; exclude binaries by NUL/size), and commit messages; catch token/password/API-key assignments, `ghp_`/`github_pat_`/`sk-` secrets, PEM private keys, personal absolute paths such as `/Users/`, `/home/<name>/`, Windows user paths, and project-specific private identifiers collected before push. Report path/line/category only, redact matched value. Exit 1 on findings, 0 clean, 2 on scan failure or unknown flags; no network or dependencies. `--path <dir>` scans only fixtures for tests; default scans whole push candidate. Public source example `MUSIC2_CRITIC_API_KEY=` with empty value is allowed. |
| `tests/e2e/privacy-scan.test.ts` | NEW | Use temp fixture directory and `node scripts/privacy-scan.mjs --path`: ordinary code/docs and empty `.env.example` pass; synthetic GitHub token, API-key value, PEM header and macOS/Windows personal path each fail with category+source but no secret bytes in output; binary PNG signature skipped; unknown flag exits 2. Repository-wide scan itself runs through `npm run privacy:scan` before push/CI. |
| `tests/e2e/package-boundary.test.ts` | NEW | Read `package.json`, lock root, `LICENSE`, npm pack file list, and tracked source: `dependencies` absent/empty, no production lock packages, MIT text present, `skills/music2/SKILL.md` included in pack, no `@strudel/*` or AGPL source/import in shipped runtime files. A contrived package with a runtime dependency fails the helper assertion. |
| `devlog/str_func/cli.md` | MODIFY | Add `skill-path.ts` file-tree row, `skillPath: CommandSpec` signature, output and registry registration, consumers/help, and sync check. |
| `devlog/str_func/recipes.md` | MODIFY | Add generated genre-doc consumer and `scripts/gen-genre-docs.mjs` signature, card-to-doc dependency and CI drift check. |
| `devlog/_plan/260928_music2_roadmap/evidence/dogfood-summary.md` | NEW | Date, exact prompt, model route/capabilities (text-only), supplied files (`skills/music2/**` only), generated song path and high-level transcript summary without raw private conversations, all commands/results, any revisions, and independent reviewer observations. No audio or secrets committed. |

### New TypeScript contract

No new public library type is needed; `Song`, `ResolvedSong`, `Track`, `Section`, `TimedEvent`, `Timeline`, `Fraction`, `Music2Error`, `CommandSpec`, and `CommandResult` come from 010. The only new typed CLI data and e2e case shape are:

```ts
// src/cli/commands/skill-path.ts (local response shape)
interface SkillPathData { path: string } // absolute directory; SKILL.md must exist

// tests/e2e/examples.test.ts (test table, not exported)
interface ExampleCase {
  path: string;
  genre: "drill_uk" | "trap" | "boom_bap" | "lofi_hiphop" | "house";
  bpm: number;
  key: string;
}

// scripts/privacy-scan.mjs (JSDoc equivalent in actual JS)
interface PrivacyFinding {
  source: string;
  line: number;
  category: string;
}
```

`PrivacyFinding` is a JS object in `scripts/privacy-scan.mjs`, documented with JSDoc `@typedef {{source:string,line:number,category:string}} PrivacyFinding`; no `match` or secret value is held in its report. `renderGenreDocs(cards)` consumes the existing recipe-card type from 040, and its output is a string; no duplicate card schema is introduced.

### Exact script and command implementation contract

The signatures below are TypeScript notation for the implementation contracts; `.mjs` files use equivalent JSDoc and plain JS syntax. Do not add a production TS module just to house script types.

```ts
// scripts/gen-genre-docs.mjs
export function renderGenreDocs(cards: readonly RecipeCard[]): string;
export async function main(argv: string[]): Promise<number>;
// scripts/privacy-scan.mjs
export function scanText(text: string, source: string): PrivacyFinding[];
export async function main(argv: string[]): Promise<number>;
// src/cli/commands/skill-path.ts
export const skillPath: CommandSpec;
```

`RecipeCard` is the existing 040 type; `PrivacyFinding` is the JSDoc shape above. Genre-doc constants: `GENRE_IDS = ["boom_bap","drill_ny","drill_uk","house","lofi_hiphop","techno","trap"] as const` is the expected 0.1.0 set; card list equality with this set is checked before rendering, so adding a future card requires consciously updating the docs contract. `DOC_PATH = "skills/music2/references/genres.md"`. The fixed header is:

```text
# Genre recipes

Generated by node scripts/gen-genre-docs.mjs from src/recipes/cards/. Do not edit by hand.
```

Render with sorted cards and sorted rule IDs; no Date, locale-dependent sort, or platform newline conversion. Output ends with exactly one LF.

`gen-genre-docs` parses exactly `--check` (boolean, default false) and `--out <path>` (default `DOC_PATH`). It imports the existing `listRecipes(): RecipeCard[]` from `src/recipes/index.ts`. For each card, render keys in this fixed order: `id/title/version`, `bpm`, `meter/swing`, `keyDefaults/scales/progressions`, `roles/gridRules/bassRules`, `palette`, `arrangement`, `mixTargets`, `lintRules`, `starterSong` one-bar patterns, `sources`. `lintRules` is an array of IDs from 040; do not invent severity/expected/fix fields on the card (those belong to `LintResult`). Never serialize incidental source-file order. Escape pipes as `\|`, backticks as code spans, normalize embedded newlines. A missing required card field is a hard exit 2, not an empty documentation cell. In write mode, write temp file in destination directory and rename atomically; in `--check`, read and byte-compare without writing. `--out` lets tests operate wholly in a temp directory.

Privacy scan constants: `MAX_TEXT_BYTES = 2_000_000` per blob/file (larger files are reported as unscanned, not silently accepted); `TOKEN_MIN_LENGTH = 20`; `EXIT_CLEAN = 0`, `EXIT_FINDING = 1`, `EXIT_SCAN_ERROR = 2`. Source paths are normalized to forward slashes. A personal-path finding needs a user-name segment after `/Users/` or `/home/`, avoiding a false positive for this document's generic example. Detect `C:\Users\<name>\` too. Secret assignments require non-empty values of at least 8 non-placeholder characters; an empty `MUSIC2_CRITIC_API_KEY=` is safe. A private-key header alone is sufficient to fail. Include the names/identifiers discovered in the pre-push privacy review as an ephemeral `--deny <literal>` option (repeatable), and print only its category, never the identifier. Avoid embedding real secrets or private names in tests or this plan.

Default scan algorithm:

1. Resolve the repository root and `main` with `git rev-parse`; failure exits 2. Gather current candidate files with `git ls-files --cached --others --exclude-standard`; reject unreadable files and skip binary content after a NUL check, while reporting the skip count.
2. Enumerate every blob reachable from `main` using `git rev-list --objects main`; inspect each unique text blob with `git cat-file blob <oid>`, retaining the path associated with its first occurrence. This finds a secret deleted from the tip but still present in first-push history. Inspect commit messages with `git log --format=%B main` too. Enforce a bounded per-blob read and a total scan cap; exceeding either exits 2, never a false clean.
3. Apply named detectors to each line; retain only `{source,line,category}`. Deduplicate by source+line+category, sort bytewise, emit JSON/text summaries without the line contents, and exit 1 for any finding. In `--path <dir>` fixture mode, scan that directory only (no git history) and refuse a path outside the caller's chosen root only if it cannot be read. `--deny` applies in both modes.
4. Before push, run the scan after the final commit so the exact objects to be pushed are included. If a hit is in a prior commit, repair history under the coordinator's release process, then rerun all release checks on the new SHA. CI reruns the scan on checkout, catching current-tree drift.

`skillPath` uses `packageRoot()` from `src/shared/paths.tool.ts`, appends `skills/music2`, checks the regular file `SKILL.md`, and returns the directory. The `CommandSpec.run` signature is the existing `run(ctx: {args:string[];values:Record<string,unknown>;json:boolean;cwd:string;stderr:NodeJS.WritableStream}): Promise<CommandResult>`; no new CLI parser type or subcommand framework. `music2 skill path --json` has `data` matching `SkillPathData` and `artifacts:[]`; no symlink creation, copy, or user-home write.

### Committed example fixture contract

Each example is JSON formatted with two-space indent and final newline, with a numeric `seed` and no external kit/sample requirement. Use the recipe starter from 040, then make the listed original edits and validate against the 010 schema; voice params must be selected from 020's accepted registry. `Section.patterns` overrides or null mutes create the density differences, and `Section.role` scopes lint; do not encode a role string unknown to 010.

| Song | Fixed fields | Full-drum or groove proof | Arrangement and tonal proof |
|---|---|---|---|
| drill-140 | `version:1`, `genre:drill_uk`, `bpm:140`, `key:"C minor"`, `seed:140`, `swing:0.5` | Snare on 16th step 9 in >=75% of hook/verse bars; kick present, >=1 subdivided hat event per 2 bars; 808 track mono with at least one pitch move per 8 bars. | Preserve 020's 4-bar intro, 8-bar hook, 4-bar verse; minor-key motif and intro/verse mutes. |
| trap-150 | `genre:trap`, `bpm:150`, `key:"A minor"`, `seed:15001`, `swing:0.5` | Half-time snare, hats in >=75% full-drum bars, short roll every <=4 bars, tuned 808. | 4 intro, 8 verse, 8 hook, 4 outro; hook has at least as many active layers as verse. |
| boom-bap-90 | `genre:boom_bap`, `bpm:90`, `key:"C minor"`, `seed:9001`, `swing:0.58` | Snare steps 5 and 13, swinging hat track, no recurring 32nd roll. | 4 intro, 8 verse, 8 hook, 4 outro; 2- or 4-bar keys motif and section mute. |
| lofi-75 | `genre:lofi_hiphop`, `bpm:75`, `key:"A minor"`, `seed:7501`, `swing:0.60` | Soft backbeat steps 5/13, hat swing, no clipping. | 4 intro, 8 main, 4 lighter breakdown, 4 outro; repeated keys/bass loop. |
| house-124 | `genre:house`, `bpm:124`, `key:"A minor"`, `seed:12401`, `swing:0.5` | Kick steps 1/5/9/13 in >=90% groove bars, clap 5/13, open hat 3/7/11/15. | 8 groove, 4 breakdown, 8 return, 4 outro; breakdown removes layers and outro thins. |
| dogfood/boom-bap-dogfood | `genre:boom_bap`, `bpm:90`, `key:"D minor"`, agent-chosen fixed seed | Agent must make beat-2/4 snare and swung hats from the skill alone. | Original dusty-keys loop and bass, >=2 section roles; exact bars/patterns are the agent's choice. |

The five curated examples must lint with **zero** `LintReport.results` in non-strict mode after tuning. If a card rule is unrepresentable in the 010 schema, document its advisory omission in 040 rather than filling a bogus field here. The blind dogfood source is independently judged for the prompt; its non-strict lint report must likewise have zero results for c-6. `tests/e2e/examples.test.ts` checks values, not this table's prose: one expected BPM/key/genre tuple per file, finite render frames, nonzero WAV data length, PNG signature `89 50 4e 47 0d 0a 1a 0a`, positive IHDR width/height, and analysis paths confined to the temp directory.

The 020 voice registry fixes the `instruments.md` parameter table; list every key, default and inclusive range exactly:

| Voice | `Track.kind` | `params` default [min,max] |
|---|---|---|
| `drums` | drums | `tone .5 [0,1]`, `decayMs 180 [20,1000]`, `noise .5 [0,1]`; atoms `bd sd cp hh oh rim perc tom`, variant `:index` wraps four timbres. |
| `808` | notes | `drive 2.2 [1,8]`, `decayMs 1100 [100,5000]`, `attackMs 3 [0,50]`; mono default. |
| `bass` | notes | `wave 0 [0,1]` integer, `cutoffHz 600 [40,8000]`, `resonance .15 [0,.9]`, `releaseMs 80 [5,1000]`; mono default. |
| `bell` | notes | `ratio 3.5 [1,12]`, `index 2.2 [0,10]`, `decayMs 450 [50,5000]`. |
| `keys` | notes | `ratio 2 [1,8]`, `index 1.4 [0,8]`, `attackMs 8 [0,200]`, `releaseMs 220 [20,2000]`. |
| `pluck` | notes | `damping .992 [.8,.9999]`, `decayMs 900 [50,5000]`, `brightness .7 [0,1]`; seed drives excitation. |
| `pad` | notes | `detuneCents 11 [0,50]`, `cutoffHz 1800 [80,12000]`, `attackMs 400 [10,5000]`, `releaseMs 700 [20,5000]`. |
| `lead` | notes | `wave 1 [0,1]` integer, `vibratoHz 5 [0,12]`, `vibratoCents 12 [0,100]`, `releaseMs 120 [5,2000]`. |

`kit:<relative kit.json>` is a user-supplied sample instrument from 020, with no bundled sample files. Document 16/24/32-bit PCM or float32 WAV input, manifest path confinement, `rootMidi`, and caller-owned licensing; distinguish it from the eight synth IDs. Document `Track` common controls from 010 without widening any ranges.

### Documentation cross-checks

README quick start must fit one runnable sequence after `npm ci`: `node bin/music2.js recipes drill_uk --json`, `node bin/music2.js new --genre drill_uk -o /tmp/music2-demo.song.json --json`, `node bin/music2.js validate /tmp/music2-demo.song.json --json`, `node bin/music2.js render examples/drill-140.song.json -o /tmp/music2-drill.wav --json`, and `node bin/music2.js analyze /tmp/music2-drill.wav --song examples/drill-140.song.json --out /tmp/music2-analysis --json`. Show the generated `analysis.md` and two PNG filenames as outputs, then link to the skill and full CLI docs. The quick start must state which paths are illustrative temp outputs; it must not claim a 60-second *render time* guarantee on every machine.

For `docs/cli.md`, derive command spellings from `music2 help --json`/registry and code, and use one checked example for each command. Document `--json` as one stdout JSON object even on error, with diagnostics on stderr only if the 010 contract allows them. For `docs/song-format.md`, derive ranges/defaults from `SONG_JSON_SCHEMA` and validator, not from recipe prose. `references/instruments.md` is derived from 020 registry; a test validates each snippet, and a reviewer compares the parameter table to the registry. If these contracts disagree, fix the authoritative implementation or schema in its owning phase and then regenerate/docs-sync before release; do not hide drift with vague wording.

## Agent skill workflow and revision rules

1. Parse the user prompt with `references/prompts.md`; choose a card with `node bin/music2.js recipes --json` and read `references/genres.md` for its defaults. The prompt overrides card defaults; record unspecified key/instrument choices as assumptions.
2. `node bin/music2.js new --genre <recipe-id> -o <song>.song.json --json`. Edit that JSON directly using the skill's compact Song v1 field map plus `references/mini-notation.md` and `references/instruments.md`; set a fixed numeric seed and distinct section roles. `docs/song-format.md` is optional extended reading, not required for the blind dogfood agent. Never copy another song's entire pattern without changing it to satisfy the request.
3. `node bin/music2.js validate <song> --json` then `node bin/music2.js events <song> --json`. Correct every `E_SCHEMA`/`E_PARSE` issue; inspect times/track IDs to confirm snare/grid/bass placement before rendering. `events` is the text-only view of the arrangement.
4. `node bin/music2.js lint <song> --json`; clear errors and warnings tied to the explicit user request. Advisory genre warnings can be consciously retained only when the user constraint or a documented artistic choice explains them. For dogfood and curated examples, require zero warnings.
5. `node bin/music2.js render <song> -o <work>/song.wav --json`; then `node bin/music2.js analyze <work>/song.wav --song <song> --out <work>/analysis --json`. Read `analysis.md` and `analysis.json`; if the model has vision, inspect `spectrogram.png` and `pianoroll.png`. Text-only models rely on metrics and the prose report. Never claim to have heard audio from a PNG or numeric metric.
6. Revise and rerun validate/events/lint/render/analyze until requested tempo/key/grid and measurable output are coherent. Use the warning/action table below and compare each edit's new metrics. Avoid automatic "fix" of a musical choice based on one advisory statistic.
7. If an audio-capable Responses route is available, optionally call `node bin/music2.js critique <work>/song.wav --json`; heed timbre/groove/genre-fit suggestions only after `data.review.heard_audio === true`. `E_CAPABILITY` or `E_PROVIDER` means skip audio critique and continue with DSP/visuals; do not invent feedback. Export MP3 with `node bin/music2.js render <song> -o <work>/final.wav --mp3 --json` only if ffmpeg is available (`doctor`); 020 writes both `<work>/final.wav` and `<work>/final.mp3`. Otherwise deliver WAV and state the `E_FFMPEG_MISSING` capability boundary.

| Analysis signal (030) | Concrete edit to try | Confirm after rerender |
|---|---|---|
| `CLIPPING` (`clippedSamples>0`) or true peak above ceiling | Lower the loudest track gain 2–3 dB; shorten overlapping kick/808; inspect `master.ceilingDb` before reducing every track. | `clippedSamples===0`, true peak at/below intended ceiling. |
| `LUFS_OFF_TARGET` (declared target and >3 LU delta) | If quiet, adjust `master.gainDb` modestly only after checking peak headroom; if loud, reduce dense layers/limiting. | LUFS moves toward target while true peak stays safe; target is advisory. |
| `LOW_END_DOMINANCE` (sub+low share >.55) | Reduce `808`/bass gain or duration, add `duck.by:"kick"`, high-pass or raise keys register where voice controls permit. | Sub+low share and kick transient improve; do not demand a universal band ratio. |
| `EMPTY_HIGH_BAND` (air share <.001 on non-silent audio) | Raise quiet hats, choose brighter drum/keys params within 020 ranges, or unmute an intentional top layer. | Air share increases without harshness/clipping. |
| `KEY_UNCERTAIN` (confidence <.2), off-scale notes, or half/double BPM candidate | Check `events` pitches, key declaration, section mutes and onset grid first; fix mistaken note names/transpose or missing rhythmic accents, preserving intentional approach tones. | Declared and estimated summaries become plausible; never treat estimated key/BPM as infallible. |
| Piano roll crowded verse / sparse hook, or metallic bell spike in spectrogram | Remove one verse layer or add hook contrast; lower `bell.index`, bell gain, hat velocity, or send level. | Section density and band plot reflect the intended contrast; listen if an audio route exists. |

## CLI command contract

All rows use the global `--json` flag (default false) and wp2 envelope. Success JSON: `{ok:true,command,data,artifacts:[],warnings:[],meta:{music2:string}}`; failure JSON: `{ok:false,command,error:{code,message,fix,details,retryable},meta:{music2:string}}`. Human mode may format data, except `skill path` prints one absolute path. Exit 0 success; 1 internal; 2 input/schema/parse/not-found; 3 capability/ffmpeg; 4 access/provider; 5 render; 6 QA/strict lint; 7 interrupted. The table pins wp6's documentation and required flags; reconcile with final 020/030/040 command definitions before implementation, preserving those phases' API where already fixed.

| Command | Flags/defaults and output data | Error codes |
|---|---|---|
| `skill path` | `--json` optional; `{path:string}` absolute `skills/music2` directory; no file writes. | `E_INPUT`, `E_NOT_FOUND` |
| `recipes [id]` | `--json`; without id `{recipes:{id,title,bpm,keyDefaults,roles}[]}`, with id `{recipe:RecipeCard}` including starterSong and lint rule IDs. | `E_INPUT`, `E_NOT_FOUND` |
| `new --genre <id>` | `--bpm`, `--key`, `--seed`, `--title` default to card; `-o <path>` optional, `--json`; without `-o` `{song:Song}`, with it `{written,genre,bpm,key,seed}`. Existing destination is never overwritten. | `E_INPUT`, `E_SCHEMA`, `E_NOT_FOUND`, `E_ACCESS` |
| `validate <song>` | `--json`; `{title,bpm,bars,durationSeconds,tracks:{id,events}[]}` from 010. | `E_INPUT`, `E_SCHEMA`, `E_PARSE` |
| `events <song>` | `--bars a:b` default all, `--track id` default all, `--json`; `{events:TimedEvent[]}`. | `E_INPUT`, `E_SCHEMA`, `E_PARSE` |
| `lint <song>` | `--genre <id>` defaults to song.genre, `--strict` default false, `--json`; `LintReport {genre,barsChecked,results:{id,severity,path,observed,expected,fix}[],errors,warnings}`; non-strict warnings exit 0, errors or strict warnings exit 6 with `error.details.report`. | `E_INPUT`, `E_SCHEMA`, `E_QA` |
| `render <song>` | `-o <path>` optional (default beside song), `--bits 16\|24` default 16, `--bars a:b` default all, `--stems dir` optional, `--mp3`/`--ogg`/`--loudnorm` default false, `--json`; `RenderData {wav,mp3?,ogg?,stems?,bars,sampleRate,frames,durationSeconds,peakDbfs,truePeakDbtp,ceilingDb,events}`. | `E_INPUT`, `E_SCHEMA`, `E_RENDER`, `E_FFMPEG_MISSING`, `E_CAPABILITY`, `E_ACCESS` |
| `analyze <wav\|song.json>` | `--song <path>` WAV-only, `--out <dir>` optional (default basename.analysis beside input), `--json`; `AnalysisArtifacts {analysisJson,analysisMd,spectrogramPng,pianoRollPng,beatsJson,summary}`; pianoRollPng null without song; beatsJson written from the audio tempo estimate (`source:"audio"`, `METER_ASSUMED`) when a tempo is found, else null with warning `NO_BEATS`. `summary` includes declared/estimated BPM, integrated LUFS, warnings; full `analysis.json` holds `truePeakEstimateDbtp`, key, bands, clipping. | `E_INPUT`, `E_SCHEMA`, `E_NOT_FOUND`, `E_RENDER`, `E_ACCESS` |
| `critique <audio.wav\|song.json>` | `--model` default env `MUSIC2_CRITIC_MODEL`/`google-antigravity/gemini-3.8-flash`, `--base-url` default env `MUSIC2_CRITIC_BASE_URL`/local proxy, `--excerpt` default 30 seconds, `--json`; `CritiqueReport {review,dsp,audio,model}`; `review.heard_audio` must be true. WAV fallback when ffmpeg is absent. | `E_INPUT`, `E_CAPABILITY`, `E_PROVIDER`, `E_TIMEOUT`, `E_RENDER` |
| `doctor` | `--json`; `DoctorData {ffmpeg:FfmpegInfo\|null,required:boolean,ready:boolean}`; absent optional ffmpeg is exit 0 with `ready:false`, `MUSIC2_REQUIRE_FFMPEG=1` makes it an error. | `E_FFMPEG_MISSING`, `E_CAPABILITY` |
| `schema`, `version`, `help` | 010 contracts; document `schema --out` optional, `version` and `help [command]`; no new wp6 behavior. | `E_INPUT`, `E_ACCESS` as applicable |

## Dogfood and release sequence

The coordinator launches a fresh **text-only** subagent, gives it only `skills/music2/SKILL.md` plus the five references and prompt: `Make a 90 BPM boom bap beat in D minor with a dusty keys loop`. The skill must include a minimal Song v1 field map (`version`, `bpm`, `key`, `seed`, `tracks`, `sections`, `arrangement`) and tell the agent to inspect `music2 new` output for full shape. Do not give it recipe source, existing song examples, this plan, prior transcript, vision/audio tools, or a prewritten JSON skeleton. Its only write target is `examples/dogfood/boom-bap-dogfood.song.json`; it may run the documented CLI and read its own outputs. Record concise prompt/command/revision/output evidence in `evidence/dogfood-summary.md`. Independently run the e2e test against the produced file and compare its pattern/arrangement to curated boom-bap to reject a trivial copy.

Before first public push: finish docs and examples; generate genre docs; run all local gates and privacy scan; inspect `git status`/diff and commit only intended project files. The privacy scan must inspect the *entire first-push history* as well as current files. On any hit, remove the offending content from unpushed history (not just a later cleanup commit) and rerun. Do not include WAV/PNG working outputs or raw dogfood transcript.

For a new repository, after checking `gh auth status`, `gh repo view lidge-ai/music2-gen` (must be absent for this creation path), and `git remote -v` (must have no conflicting `origin`), run exactly:

```sh
gh repo create lidge-ai/music2-gen --public -d "Agent-first deterministic music composition CLI"
git remote add origin https://github.com/lidge-ai/music2-gen.git
git push -u origin main
gh repo edit lidge-ai/music2-gen --add-topic music --add-topic typescript --add-topic cli --add-topic generative-music --add-topic coding-agents
```

If the repo or origin already exists, inspect identity and SHA first; reuse matching state instead of recreating. Record `git rev-parse main` and `git ls-remote origin refs/heads/main`, require equal SHA. For hosted CI, select only `push` workflow run(s) on that SHA using `gh run list -R lidge-ai/music2-gen --commit <SHA> --json databaseId,event,headSha,status,conclusion,workflowName`; then `gh run view <RUN_ID> -R lidge-ai/music2-gen --json event,headSha,attempt,status,conclusion,jobs`. Require `status:completed`, `conclusion:success`, `event:push`, same head SHA, `checks` success, all six `test` matrix legs executed and success, and aggregate `ci` success. Missing/skipped/cancelled/pending legs are not success; inspect run/job logs and repair before continuing.

After initial hosted CI success, move the completed unit with `git mv devlog/_plan/260928_music2_roadmap devlog/_fin/260928_music2_roadmap`, preserving this 050 document and dogfood summary, and make final `devlog/str_func` synchronization. Commit that archive/docs-only change, rerun `npm run privacy:scan`, `npm run docs:genres:check`, and any affected checks, then `git push origin main`. The archive commit is the final release SHA; repeat the exact hosted CI job census above and compare `git ls-remote origin refs/heads/main` to it. If a later repair changes `main`, repeat final-SHA proof. No tag/release/npm publish follows.

## Acceptance

Run the commands on final source before the push, except c-7 which is hosted proof after push. `npm test` includes `tests/e2e/*.test.ts` via 010's test runner. Tests make their own temp directories; direct CLI examples below write under `/tmp` and do not write tracked binaries. The 030 `analyze --out` handler creates its output directory recursively.

| Check | Exact final verification command | What it observes |
|---|---|---|
| c-1 fresh gates | `npm run typecheck && npm run lint && npm test && npm run build && npm run docs:genres:check && npm run privacy:scan` | All four required gates exit 0; generated docs match recipe cards; push candidate contains no detected private material. |
| c-2 deterministic drill | `npm test -- --e2e` | `examples.test.ts` renders the drill twice to separate temp paths and compares byte buffers/SHA-256; same Node major/platform. |
| c-3 drill analyze | `node bin/music2.js render examples/drill-140.song.json -o /tmp/music2-acceptance-drill.wav --json && node bin/music2.js analyze /tmp/music2-acceptance-drill.wav --song examples/drill-140.song.json --out /tmp/music2-acceptance-analysis --json && npm test -- --e2e` | Independent estimated BPM in [138,142] and both PNG signatures/dimensions verified in e2e; CLI `data` names the five analysis artifacts. |
| c-4 lint contrast | `node bin/music2.js lint examples/drill-140.song.json --json && npm test -- --e2e` | Drill has zero violations; e2e mutates a temp song's genre to house and asserts named `house/*` violations plus strict exit 6. |
| c-5 critique transport | `npm test` | Mock Responses unit test from 040 proves structured `review.heard_audio:true` feedback; unsupported audio route yields `E_CAPABILITY` exit 3 with model name and fix. If local opencodex is available, additionally run `node bin/music2.js critique /tmp/music2-acceptance-drill.wav --json` and record actual route result without claiming a live success when absent. |
| c-6 blind text-only agent | `node bin/music2.js validate examples/dogfood/boom-bap-dogfood.song.json --json && node bin/music2.js lint examples/dogfood/boom-bap-dogfood.song.json --json && npm test -- --e2e` | Produced song is D minor/90, lint clean non-strict, e2e render/analyze succeeds, and dogfood summary proves input isolation and original revisions. |
| c-7 hosted CI | `gh run list -R lidge-ai/music2-gen --commit <SHA> --json databaseId,event,headSha,status,conclusion,workflowName` then `gh run view <RUN_ID> -R lidge-ai/music2-gen --json event,headSha,attempt,status,conclusion,jobs` | Exact pushed `main` SHA has completed successful `push` run with `checks`, six test jobs, `ci` aggregate all executed and success; compare with `git ls-remote origin refs/heads/main`. |
| c-8 license/dependency boundary | `npm run privacy:scan && npm run build && npm test` | `package.json`/lock have zero runtime dependencies, `LICENSE` MIT, repository/pack contents have no `@strudel/*` or AGPL source; e2e boundary test checks manifest/license/import graph and privacy scan checks push history. |
| Skill path and docs drift | `node bin/music2.js skill path --json && npm run docs:genres:check && npm test` | Path resolves to shipped `SKILL.md`; all card fields/IDs appear in generated docs; help/docs/tests use same command names. |

### Release receipt to attach to wp6 completion

Record local Node major/platform, final `main` SHA, `git status --short`, gate command exit codes, e2e test count, drill WAV pair hashes, estimated BPM, PNG width/height and signatures, lint rule IDs from the negative fixture, and dogfood song path. Record the exact `npm run privacy:scan` result after final commit, including scanned file/blob/commit counts and zero findings; do not paste private search terms or matched lines. For critique, record model route, whether the response was `heard_audio:true` or the exact capability/provider code, and whether it was live or mocked. For hosted CI, record repository URL, remote/main SHA comparison, workflow event, run ID, attempt, each expected job's name/status/conclusion, and the aggregate conclusion. These are observations, not a promise that a `gh` command's exit code alone proves success.

Keep the receipt in the existing work-phase devlog after the implementation gate and before archival, with source paths and command output locations. If docs or examples change after any gate, rerun the affected local checks; if a commit changes after push, rebind all hosted proof to the new SHA. Close wp6 only when all c-1 through c-8 evidence refers to the final pushed commit.

## Activation scenarios

- Bad mini-notation in a temp example (`[bd`) triggers `validate` `E_SCHEMA` issue containing the `E_PARSE` offset; `events`/render are not run on invalid source.
- Unknown recipe ID triggers `new --genre` `E_NOT_FOUND`; an existing `-o` path triggers `E_ACCESS` without overwriting the file. `skill path` absent asset triggers `E_NOT_FOUND`; `skill install` triggers `E_INPUT` and no config file.
- Wrong `genre:"house"` on drill yields named `house/*` warnings; non-strict `lint` returns data and exit 0, `--strict` returns `E_QA` exit 6. A full-groove `role` activates grid thresholds; intro/breakdown role excludes those grid counts.
- Drill BPM at 140 and repeated strong onsets exercises the independent tempo estimate; half/double candidates remain visible when ambiguity exists. Analyze without `--song` writes spectrogram/metrics and an audio-sourced beats.json (no piano roll); with song writes both PNGs and beats.
- Render same seeded drill twice activates deterministic noise/random paths and produces equal bytes; changing the seed in a temp copy changes at least one stochastic part. No `Date`/`Math.random` affects audio bytes.
- Request `--mp3` with ffmpeg hidden from PATH triggers `E_FFMPEG_MISSING` exit 3; default WAV still renders. `doctor` reports ffmpeg unavailable. Text-only skill branch delivers WAV when this occurs.
- Mock critique with `heard_audio:false` or `unsupported_input_modality` triggers `E_CAPABILITY` exit 3 and no fabricated feedback; network refusal triggers `E_PROVIDER` exit 4; `Stream must be set to true` 400 triggers one streaming retry and structured feedback if the stream succeeds.
- A synthetic token or personal path fixture triggers privacy-scan exit 1 with redacted category and source; a changed recipe card without regenerating `genres.md` triggers `docs:genres:check` exit 1; clean fixtures pass both checks.
- CI aggregate success with a skipped/cancelled matrix leg is rejected by the explicit job census; a run for a different SHA or `workflow_dispatch` event cannot satisfy c-7.
