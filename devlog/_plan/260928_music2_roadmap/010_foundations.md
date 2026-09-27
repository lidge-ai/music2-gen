# 010 — wp2 Foundations: package, CLI contract, song schema v1, mini-notation

**Summary.** wp2 turns the empty repo into an installable `music2` CLI whose contracts every later phase consumes:
the error/exit contract, the rational-time pattern engine (our MIT mini-notation from 004), the song schema v1 with a
strict hand-written validator, the section/arrangement timeline, and four commands (`version`, `help`, `schema`,
`validate`, `events`). It closes with typecheck, lint, build, unit tests and a CI workflow file. No audio yet.

Depends on: 003 (D1–D4, D6, D11), 004 (conformance vectors). Consumed by: 020 (timeline events), 030 (song + events
for piano roll and beats), 040 (recipes/lint read songs and events), 050 (docs, examples, CI, release).

## Scope

IN: everything in the file map below. OUT: audio, voices, ffmpeg, analysis, recipes, critic (later phases);
polymeter `{ }`; decimal `*1.5` factors; tempo or meter changes inside a song.

## Global conventions

- Node ≥ 22.18, ESM, TypeScript run directly by Node type stripping; only erasable syntax (no enums, namespaces,
  parameter properties). Relative imports carry `.ts`; `tsc -p tsconfig.build.json` rewrites them into `dist/`.
- Runtime dependencies: **none**. Dev: typescript ^5.9.3, @types/node ^22.20.1, eslint 10.11.0, @eslint/js 10.0.1,
  typescript-eslint 8.70.1, globals 17.12.0 (same pins as vid2-gen package.json).
- Lidge Standard: logic in `*.tool.ts`, types/validators in `*.schema.ts`, colocated `<base>.test.ts` for every
  `<base>.tool.ts` (scaffold-audit colocation rule), `index.ts` barrel per feature; files under ~400 lines.
- Tests: `node --test` via scripts/test.mjs (copy of vid2-gen scripts/test.mjs with VID2→MUSIC2 names;
  `MUSIC2_HOME` temp dir).

## File map

| Path | Op | Content |
|---|---|---|
| package.json | NEW | name `music2-gen`, version 0.1.0, type module, license MIT, bin `{"music2":"bin/music2.js"}`, exports `.` → dist/index.js + types, `./schema/song.v1.json`, files [bin, dist, schema, README.md, LICENSE, CHANGELOG.md], engines node >=22.18, scripts: build `tsc -p tsconfig.build.json`, typecheck `tsc -p tsconfig.json --noEmit`, lint `eslint .`, test `node scripts/test.mjs`, `schema:json` `node bin/music2.js schema --out schema/song.v1.json`, prepack `npm run build`, music2 `node src/cli/index.ts`; repository/homepage/bugs → github.com/lidge-ai/music2-gen; keywords music, audio, cli, agents, codex, claude-code, strudel, mini-notation, synth, beats |
| package-lock.json | NEW | from `npm install` |
| tsconfig.json, tsconfig.build.json, eslint.config.js | NEW | identical to vid2-gen (quoted in 003 evidence; include adds `bin`) |
| .editorconfig, .gitattributes | NEW | identical to vid2-gen; .gitattributes adds `*.wav binary`, `*.png binary` |
| LICENSE | NEW | MIT, "Copyright (c) 2026 lidge-ai" |
| AGENTS.md | NEW | what music2 is, stack, commands (`npm run typecheck/lint/test/build`), Lidge Standard rules, devlog rules, "no runtime deps, no AGPL code, clean-room mini-notation (004)", commit style (conventional commits) |
| README.md | NEW | stub: one paragraph + install from source + `music2 validate` example; completed in 050 |
| CHANGELOG.md | NEW | "## 0.1.0 — unreleased" |
| .env.example | NEW | `MUSIC2_CRITIC_BASE_URL=http://127.0.0.1:10100`, `MUSIC2_CRITIC_MODEL=google-antigravity/gemini-3.8-flash`, `MUSIC2_CRITIC_API_KEY=` (comments; used from 040) |
| config/.gitkeep, docs/.gitkeep, tests/e2e/.gitkeep | NEW | skeleton |
| bin/music2.js | NEW | vid2-gen bin/vid2.js with names changed (dist first, else src/cli/index.ts) |
| scripts/test.mjs | NEW | vid2-gen scripts/test.mjs with `MUSIC2_HOME`, message prefix `music2 test` |
| .github/workflows/ci.yml | NEW | jobs: `checks` (ubuntu, node 22: npm ci, typecheck, lint, build, `npm run audit:structure`, `npm pack --dry-run`; schema drift is checked byte-for-byte by song.test.ts inside `npm test`), `test` matrix ubuntu/macos/windows × node 22/24 (`npm ci && npm test`; ubuntu installs ffmpeg and sets `MUSIC2_REQUIRE_FFMPEG=1` from 020 on), `ci` aggregate requiring both (vid2-gen ci.yml pattern). Actions pinned `actions/checkout@v7`, `actions/setup-node@v7` |
| .github/dependabot.yml | NEW | github-actions weekly, grouped (as vid2-gen) |
| src/shared/errors.tool.ts + errors.test.ts | NEW | `EXIT` {OK 0, INTERNAL 1, INPUT 2, CAPABILITY 3, ACCESS 4, RENDER 5, QA 6, INTERRUPTED 7}; `ErrorCode` = E_INPUT, E_SCHEMA, E_PARSE, E_NOT_FOUND, E_CAPABILITY, E_FFMPEG_MISSING, E_ACCESS, E_PROVIDER, E_RENDER, E_QA, E_TIMEOUT, E_INTERRUPTED, E_INTERNAL with exits E_INPUT/E_SCHEMA/E_PARSE/E_NOT_FOUND → 2, E_CAPABILITY/E_FFMPEG_MISSING → 3, E_ACCESS/E_PROVIDER → 4, E_RENDER → 5, E_QA → 6, E_TIMEOUT/E_INTERRUPTED → 7, E_INTERNAL → 1; `class Music2Error` {code, details, retryable, fix, get exit}; `isMusic2Error`. Test: every ErrorCode maps to an exit; E_PARSE → 2 |
| src/shared/rational.tool.ts + rational.test.ts | NEW | `class Fraction` (fields `n`, `d` numbers, always reduced, d > 0; constructor throws E_INTERNAL if |n| or d exceeds 2^40 after reduction); statics `of(n, d = 1)`, `fromNumber(int)`; methods add, sub, mul, div, neg, cmp, lt, lte, gt, gte, eq, floor (→ number), sam (= Fraction of floor), valueOf (→ number), toString ("n/d" or "n"). Also `min`, `max`. Test: 1/3+1/6 = 1/2; (−1/4).floor() = −1; reduction; comparison; overflow throw |
| src/shared/prng.tool.ts + prng.test.ts | NEW | `fnv1a32(...parts: (string|number)[]): number` (parts joined by "\u0000"), `mulberry32(seed): () => number` in [0,1), `unitHash(...parts): number` = first mulberry32 draw of fnv1a32(parts). Test: fixed vectors (record the values the implementation produces for ("a"), ("a","b") and assert they stay stable), distribution sanity (10 000 draws mean within 0.5±0.02) |
| src/shared/paths.tool.ts + paths.test.ts | NEW | `music2Home()` (`MUSIC2_HOME` or ~/.music2), `packageRoot()` (walks to package.json with name music2-gen), `packageVersion()`. Test: version equals package.json |
| src/shared/index.ts | NEW | barrel |
| src/pattern/ast.schema.ts | NEW | types below |
| src/pattern/parse.tool.ts + parse.test.ts | NEW | `parseMini(src: string): Node` recursive descent; errors are Music2Error E_PARSE with `details {src, offset, expected}` and a `fix` showing a caret line |
| src/pattern/query.tool.ts + query.test.ts | NEW | `queryArc(node, begin: Fraction, end: Fraction, ctx: QueryCtx): Hap[]`, `onsets(node, begin, end, ctx)` (haps whose whole.begin ∈ [begin,end), sorted by begin then order) |
| src/pattern/euclid.tool.ts + euclid.test.ts | NEW | `bjorklund(k, n): boolean[]`, `rotateLeft(bits, r)` |
| src/pattern/values.tool.ts + values.test.ts | NEW | `noteToMidi(text): number` (regex `^([a-gA-G])(#|b|s)?(-?\d)$`; C4 = 60; error E_PARSE when octave missing), `midiToName(m)`, `parseSampleRef(text): {name, index}` (`name:index`, default index 0), `parseNumber(text)` |
| src/pattern/index.ts | NEW | barrel |
| src/song/song.schema.ts + song.test.ts | NEW | types, `SONG_JSON_SCHEMA` (draft 2020-12 object, the published contract), `validateSong(input: unknown): ResolvedSong` |
| src/song/arrange.tool.ts + arrange.test.ts | NEW | `arrange(song: ResolvedSong): Placement[]` |
| src/song/timeline.tool.ts + timeline.test.ts | NEW | `buildTimeline(song: ResolvedSong): Timeline` |
| src/song/load.tool.ts + load.test.ts | NEW | `loadSong(path: string): Promise<ResolvedSong>` (read, JSON.parse → E_INPUT with position, validate) |
| src/song/index.ts | NEW | barrel |
| src/cli/index.ts, main.ts, args.ts, output.ts, registry.ts | NEW | vid2-gen equivalents with Music2Error, env `MUSIC2_JSON=1`, meta `{music2: version}`; registry contract pinned below (CommandSpec) |
| src/cli/commands/version.ts, help.ts, schema.ts, validate.ts, events.ts | NEW | see Commands |
| src/cli/main.test.ts | NEW | in-process `main()` tests with captured streams |
| src/index.ts | NEW | public API: shared errors, Fraction, parseMini, queryArc, onsets, noteToMidi, validateSong, SONG_JSON_SCHEMA, loadSong, buildTimeline, types |
| schema/song.v1.json | NEW | generated by `npm run schema:json` |
| examples/minimal.song.json | NEW | 2-bar kick/snare/hat + 808 song used by tests and docs |
| devlog/str_func/{shared,pattern,song,cli}.md | NEW | str_func docs per template |
| devlog/str_func/AGENTS.md | MODIFY | created in wp1 with an empty index table; add rows `shared`, `pattern`, `song`, `cli` (document, status active). Later phases append their rows |
| scripts/structure-audit.mjs | NEW | repo-local Lidge Standard check (replaces the external scaffold-audit.sh): every `src/**/X.tool.ts` has `X.test.ts` beside it; every `src/<feature>/` has `index.ts`; no `src/{controllers,models,services,views,helpers}`; `devlog/_plan`, `devlog/_fin`, `devlog/str_func/AGENTS.md`, `AGENTS.md` exist; no tracked `.env`; no `src` file over 500 lines; each feature folder has a `devlog/str_func/<feature>.md`. Prints one line per failure, exit 1 on any, 0 clean |
| scripts/structure-audit.test.mjs | NEW | runs the audit against temp trees: clean tree passes; missing test, missing index.ts, 501-line file each fail with the named rule |
| package.json scripts | (part of NEW) | add `audit:structure`: `node scripts/structure-audit.mjs`; ci.yml `checks` runs it |

## Pattern engine

```ts
// src/pattern/ast.schema.ts
export interface Atom { raw: string; name: string; index: number | null; num: number | null; offset: number }
export type Node =
  | { type: "atom"; atom: Atom; id: number }
  | { type: "rest"; id: number }
  | { type: "seq"; steps: { node: Node; weight: number }[]; id: number }
  | { type: "stack"; branches: Node[]; id: number }
  | { type: "alt"; items: Node[]; id: number }
  | { type: "fast"; node: Node; factor: number; id: number }
  | { type: "slow"; node: Node; factor: number; id: number }
  | { type: "euclid"; node: Node; k: number; n: number; r: number; id: number }
  | { type: "degrade"; node: Node; prob: number; id: number }
  | { type: "choose"; options: Node[]; id: number };
export interface Span { begin: Fraction; end: Fraction }
export interface Hap { whole: Span; part: Span; atom: Atom; order: number }
export interface QueryCtx { seed: number; salt: string }   // salt = track id; ids make random choices stable
```

Grammar (whitespace-separated steps; `,` splits a group into stack branches; `|` splits into choose options,
lower precedence than `,` is **not** allowed: mixing `,` and `|` in one group is E_PARSE):

```
group    := branch ( "," branch )*  |  branch ( "|" branch )*
branch   := step+
step     := term suffix* ( "!" INT? )*          // "!" alone repeats once; "!n" gives n copies
term     := ATOM | "~" | "[" group "]" | "<" group ">"
suffix   := "*" INT | "/" INT | "@" INT | "?" PROB? | "(" INT "," INT ( "," INT )? ")"
ATOM     := [A-Za-z0-9#.\-]+ ( ":" INT )?          // "-" only as leading sign of numbers
PROB     := 0 < decimal ≤ 1, default 0.5
```

Top level of a string is a `group` parsed as if inside `[ ]`. `<a b, c d>` stacks two alternations. Allowed
suffix combinations in v0.1: at most one of `*`/`/`, then optional euclid, then optional `?`, then optional `@`;
any other order is E_PARSE with the offset of the offending suffix. Limits: depth ≤ 32, INT ≤ 64 for `*` `/` `!`
`@`, euclid n ≤ 64, pattern length ≤ 4000 chars. Node ids are assigned in pre-order starting at 0.

Query semantics (node-local time, one cycle = one bar):

- `atom`: for each cycle c overlapping the span: whole [c, c+1), part = whole ∩ span.
- `rest`: none.
- `seq` with weights wᵢ, W = Σw: step i occupies [c + Sᵢ/W, c + Sᵢ₊₁/W). The child's cycle c is compressed into that
  region: child time u ↦ parent time c + Sᵢ/W + (u − c)·wᵢ/W. Query each child on the preimage of span ∩ region, map
  haps back.
- `stack`: union of branches (order = branch order).
- `alt` (n items): in cycle c, item (c mod n) is queried at cycle floor(c / n) of its own time, shifted so that its
  cycle maps onto [c, c+1) (Tidal/Strudel slowcat: each item keeps its own cycle counter).
- `fast k`: query child on span·k, divide hap times by k. `slow k`: query on span/k, multiply by k.
- `euclid(k,n,r)`: equivalent to a seq of n equal steps where bit i of rotateLeft(bjorklund(k,n), r) is the child
  (true) or rest (false).
- `degrade p` (id): drop a hap when unitHash(seed, salt, id, whole.begin.toString()) < p.
- `choose` (id, m options): in cycle c pick option floor(unitHash(seed, salt, id, c) · m).
- Hap `order` = pre-order position of the producing atom node × 1000 + copy index, used only for stable sorting.

Conformance tests (parse.test.ts / query.test.ts) are every event list in 004 plus:
drill hat line `hh hh hh [hh hh hh] hh hh [hh hh hh hh] hh` (13 onsets in cycle 0 at 0,1/8,2/8,3/8,3/8+1/24,3/8+2/24,
4/8,5/8,6/8,6/8+1/32,6/8+2/32,6/8+3/32,7/8); alternation restart property (query [1,2) alone equals the cycle-1 part of
query [0,2)); random determinism (same seed → same haps; seed+1 → at least one difference over 16 cycles for
`hh*16?0.5`); error cases `[bd`, `bd*0`, `bd,sd|cp`, `c` in a note track, `bd?2`, `bd@2*2` each E_PARSE with offset.

## Song schema v1

```ts
// src/song/song.schema.ts
export interface Song {
  version: 1;
  title?: string;                 // ≤ 120 chars
  genre?: string;                 // recipe id (050 lint); free text allowed, unknown ids only warn
  bpm: number;                    // 40–240
  meter?: { numerator: number; denominator: 4 };   // numerator 2–12, default 4/4
  key?: string;                   // /^[A-G](#|b)? (major|minor)$/  e.g. "C minor"
  seed?: number;                  // uint32, default 1
  swing?: number;                 // 0.5–0.75, default 0.5 (straight); applies to tracks with swing: true
  sampleRate?: 44100 | 48000;     // default 44100
  tailSeconds?: number;           // 0–10, default 2
  master?: { gainDb?: number; ceilingDb?: number; targetLufs?: number };   // -24..12, -6..0 (default -1), -30..-6
  tracks: Track[];                // 1–32
  sections: Section[];            // 1–64
  arrangement: { section: string; repeats?: number }[];   // 1–256 items, repeats 1–64 default 1
}
export interface Track {
  id: string;                     // /^[a-z][a-z0-9_-]{0,31}$/, unique
  kind: "drums" | "notes";
  instrument: string;             // voice id from 020 (e.g. "drums", "808", "bass", "bell", "keys", "pluck", "pad", "lead") or "kit:<relative path to kit.json>"
  pattern?: string;               // default pattern used by sections that do not mention this track
  velocity?: number | string;     // 0–1 constant or numeric mini-notation sampled at each onset; default 0.8
  gain?: number;                  // dB -60..12, default 0
  pan?: number;                   // -1..1, default 0
  gate?: number;                  // 0.05–1 of the slot, default 0.9 (ignored by mono voices)
  mono?: boolean;                 // default true for "808" and "bass", false otherwise
  glide?: number;                 // ms 0–500, portamento for mono voices, default 0 (808 recipe cards use 40–80)
  transpose?: number;             // semitones -24..24
  swing?: boolean;                // default false
  sends?: { reverb?: number; delay?: number };      // 0–1 each
  duck?: { by: string; amount: number; releaseMs?: number };   // sidechain from another track's onsets
  params?: Record<string, number>; // voice-specific, validated by 020's voice registry
}
export interface Section {
  id: string;                     // same id regex, unique
  bars: number;                   // 1–256
  role?: "intro" | "verse" | "hook" | "build" | "breakdown" | "groove" | "outro" | "bridge";
  patterns?: Record<string, string | null>;         // track id → pattern; null mutes; absent → track.pattern
}
```

`validateSong` rejects unknown keys at every level (keys derived from `SONG_JSON_SCHEMA.properties` so the schema
and validator cannot drift; song.test.ts asserts every schema property is handled), collects **all** issues (not
first only) into E_SCHEMA `details.issues: {path, message}[]`, checks cross-references (arrangement → sections,
section.patterns keys → tracks, duck.by → tracks and not self), parses every pattern string (E_PARSE issues are
folded into the same issue list with their path), checks note tracks contain only notes/numbers and drum tracks
only names/sample refs, and returns a new object with defaults applied (`ResolvedSong` type with all optional fields
filled). Voice ids are checked in 020 (the validator accepts any non-empty instrument string in wp2).

```ts
// resolved form returned by validateSong/loadSong and consumed by timeline, render, analyze, lint
export interface ResolvedTrack {
  id: string; kind: "drums" | "notes"; instrument: string;
  pattern: string | null; velocity: number | string; gain: number; pan: number; gate: number;
  mono: boolean; glide: number; transpose: number; swing: boolean;
  sends: { reverb: number; delay: number };
  duck: { by: string; amount: number; releaseMs: number } | null;   // releaseMs default 180
  params: Record<string, number>;                                  // raw; 020 fills voice defaults
}
export interface ResolvedSection { id: string; bars: number; role: Section["role"] | null; patterns: Record<string, string | null> }
export interface ResolvedSong {
  version: 1; title: string; genre: string | null; bpm: number;
  meter: { numerator: number; denominator: 4 }; key: string | null; seed: number; swing: number;
  sampleRate: 44100 | 48000; tailSeconds: number;
  master: { gainDb: number; ceilingDb: number; targetLufs: number | null };   // defaults 0, -1, null
  tracks: ResolvedTrack[]; sections: ResolvedSection[];
  arrangement: { section: string; repeats: number }[];
}
```

Defaults: title "untitled", meter 4/4, seed 1, swing 0.5, sampleRate 44100, tailSeconds 2, velocity 0.8, gain 0,
pan 0, gate 0.9, mono true only for instruments "808" and "bass", glide 0, transpose 0, sends 0, repeats 1.
`validateSong` and `loadSong` return `ResolvedSong`; `arrange`, `buildTimeline` and every later consumer take
`ResolvedSong`. `Song` is only the authoring (input) shape.

## Arrangement and timeline

```ts
export interface Placement {
  section: string; entry: number; repeat: number;       // arrangement entry index, repeat index within that entry
  ordinal: number; occurrence: number;                   // global placement index; nth time this section id is placed (0-based, counted across all entries)
  startBar: number; bars: number; role: Section["role"] | null;
}
export interface TimedEvent {
  track: string; trackIndex: number; bar: number;          // absolute bar index
  time: number; duration: number;                          // seconds (onset, slot length × gate for poly voices)
  slot: number;                                            // seconds of the pattern slot (whole span)
  cycleBegin: string;                                      // Fraction string of the section-local onset, for debugging
  atom: Atom; midi: number | null; sample: { name: string; index: number } | null;
  velocity: number; order: number;
}
export interface Timeline { bars: number; secondsPerBar: number; durationSeconds: number; placements: Placement[]; events: TimedEvent[] }
```

- secondsPerBar = numerator · 60 / bpm (quarter-note beats).
- Each placement queries the section's pattern for each track with `onsets(node, c, c+1)` for local cycles
  c = 0..bars−1 (patterns restart at each repeat), with ctx {seed: song.seed, salt: track.id + "@" + section.id}.
- time = (startBar + onset) · secondsPerBar, plus swing shift: if song.swing > 0.5 and track.swing and the onset's
  position p = frac(onset)·16 is an odd integer, add (song.swing − 0.5) · 2 · (secondsPerBar / 16).
- midi = noteToMidi(atom) + transpose for note tracks; numbers are taken as MIDI.
- velocity = constant, or the value of the velocity pattern's hap whose whole contains the onset (default 0.8 when
  none), clamped 0–1.
- Events sorted by time, then trackIndex, then order (D6 determinism).

## Commands
```ts
// src/cli/registry.ts (pinned; every later phase registers a CommandSpec object)
export interface CommandOption { type: "string" | "boolean"; short?: string; multiple?: boolean; description: string }
export interface CommandContext { args: string[]; values: Record<string, unknown>; json: boolean; cwd: string; stderr: NodeJS.WritableStream }
export interface CommandResult { command: string; data: Record<string, unknown>; artifacts?: string[]; warnings?: string[] }
export interface CommandSpec { name: string; summary: string; usage: string; options: Record<string, CommandOption>; run(ctx: CommandContext): Promise<CommandResult> }
export function register(spec: CommandSpec): void;   // duplicate name throws
```

Each command file exports one `CommandSpec` constant (e.g. `export const validate: CommandSpec`) and registry.ts
registers it in a single `for (const spec of [...]) register(spec)` list.


| Command | Behaviour | Output data |
|---|---|---|
| `music2 version` | package version | `{version}` |
| `music2 help [command]` | usage | `{usage, commands}` |
| `music2 schema [--out file]` | prints SONG_JSON_SCHEMA or writes it (2-space JSON + newline) | `{schema}` or `{written}` |
| `music2 validate <song.json>` | loadSong + buildTimeline | `{title, bpm, bars, durationSeconds, tracks: {id, events}[] }`; errors E_INPUT/E_SCHEMA/E_PARSE exit 2 |
| `music2 events <song.json> [--bars a:b] [--track id]` | timeline dump for agents (bars are 0-based half-open `start:end`) | `{events: TimedEvent[] (cycleBegin, atom.raw, midi, time rounded to 1e-6)}` |

## Acceptance (wp2)

| Check | Command | Observes |
|---|---|---|
| Types | `npm run typecheck` exit 0 | all src, scripts, tests (tsconfig include) |
| Lint | `npm run lint` exit 0 | eslint over repo |
| Unit tests | `npm test` exit 0, ≥ 60 tests, 0 fail | src/**/*.test.ts via scripts/test.mjs |
| Build | `npm run build` exit 0 and `node bin/music2.js version --json` prints ok:true from dist | dist |
| Schema drift | `npm test` (song.test.ts compares `readFileSync("schema/song.v1.json","utf8")` byte-for-byte with `JSON.stringify(SONG_JSON_SCHEMA, null, 2) + "\n"`) | schema/song.v1.json vs the in-code schema |
| CLI contract | main.test.ts: unknown command exit 2 with JSON error; `validate examples/minimal.song.json --json` ok; broken song lists ≥ 2 issues; parse error carries offset | cli |
| Structure | `npm run audit:structure` exit 0 (and `node --test scripts/structure-audit.test.mjs`) | layout rules over src/, devlog/ |

Activation scenarios for conditional paths: E_PARSE (bad pattern in examples inside the test), E_SCHEMA with multiple
issues (song with bad bpm and unknown key), unknown-key rejection (extra `foo` field), cross-reference failure
(arrangement names a missing section), Fraction overflow (constructed in rational.test.ts), dist-vs-src bin branch
(build then run bin; before build run `node src/cli/index.ts`).

