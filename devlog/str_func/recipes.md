# Recipes — Structure & Functions

Provide immutable genre cards, validated starter songs, and deterministic static song lint.

## File Tree

```text
src/recipes/
├── index.ts                    # public recipe, starter, and lint boundary
├── recipe.schema.ts            # card types, IDs, and ID guard
├── recipes.tool.ts             # frozen registry and defensive copies
├── recipes.test.ts             # registry and card contract cases
├── new.tool.ts                 # named-form builder and key transposition
├── new.test.ts                 # defaults, overrides, and invalid input
├── lint.tool.ts                # validation, orchestration, report sorting
├── lint.test.ts                # lint report and parse error cases
├── lint-generic.tool.ts        # generic static warnings
├── lint-generic.test.ts        # generic warning vectors
├── lint-geometry.tool.ts       # bar/step predicates and geometry
├── lint-geometry.test.ts       # timing and geometry vectors
├── lint-layering-low.tool.ts   # low overlap, pan, and sub floor warnings
├── lint-layering-low.test.ts   # low-layer boundary vectors
├── lint-layering-harmony.tool.ts # low chord spacing and focal register collision
├── lint-layering-harmony.test.ts # harmony boundary vectors
├── lint-layering-rhythm.tool.ts # house/techno kick-bass duck warning
├── lint-layering-rhythm.test.ts # rhythm boundary vectors
├── lint-rules.tool.ts          # hip-hop and drill genre rules
├── lint-rules.test.ts          # genre rule vectors
├── lint-rules-dance.tool.ts    # house and techno rules
├── lint-rules-dance.test.ts    # dance rule vectors
├── lint-automation.tool.ts     # gain/send lane jump warnings
├── lint-automation.test.ts     # issue #2 lane vectors
├── lint-roles.tool.ts          # focal, bed and bass voice roles; melody track selection
├── lint-roles.test.ts          # role and order-independence vectors
├── lint-rules-phrase.tool.ts   # motif, density, and section helpers
├── lint-rules-phrase.test.ts   # phrase helper vectors
└── cards/
    ├── boom_bap.ts             # one frozen-at-registry recipe source
    ├── drill_ny.ts
    ├── drill_uk.ts
    ├── house.ts
    ├── lofi_hiphop.ts
    ├── techno.ts
    └── trap.ts                 # each card has a colocated .test.ts
```

## Module Responsibility

`src/recipes` owns genre defaults and static heuristics. Cards contain musical
guidance, palettes, arrangements, mix targets, source references, and a complete
starter song. The registry deep-clones, freezes, and sorts those cards internally;
public reads return fresh clones so callers cannot change the registry.
`scripts/gen-genre-docs.mjs` consumes those reads to generate
`skills/music2/references/genres.md` from the recipe cards.

`newSong` copies a card's starter, selects a named arrangement, rebuilds sections and
arrangement from the same block list, applies bounded overrides, transposes note
patterns when the key changes, and validates the result. Lint first validates
the song and builds its timeline, then checks generic rules and recognized
genre rules. It reports static evidence; it does not render or listen to audio.

### Card catalogue

The BPM column is `min..max (default)`. Palette entries are `role:instrument`.
The first key listed is the starter's default.

| ID | BPM | Key defaults | Palette |
|---|---|---|---|
| `boom_bap` | 80..100 (90) | C minor | kick:drums, snare:drums, hats:drums, bass:bass, melody:keys |
| `drill_ny` | 138..145 (142) | F minor | kick:drums, snare:drums, hats:drums, bass:808, melody:bell |
| `drill_uk` | 138..146 (140) | C minor | kick:drums, snare:drums, hats:drums, bass:808, melody:bell |
| `house` | 120..130 (124) | A minor, C major | kick:drums, snare:drums, hats:drums, bass:bass, melody:keys |
| `lofi_hiphop` | 60..95 (75) | C major, A minor | kick:drums, snare:drums, hats:drums, bass:bass, melody:keys |
| `techno` | 126..140 (130) | E minor | kick:drums, snare:drums, hats:drums, bass:bass, melody:lead |
| `trap` | 130..170 (140) | A minor | kick:drums, snare:drums, hats:drums, bass:808, melody:pluck |

Each card also declares 4/4 meter, a swing range, scales, progressions,
grid and bass guidance, section arrangement, target LUFS and true peak,
card-facing `lintRules`, and `sources`. The executable lint formulas below
live in the lint tools; card text does not execute a rule.

## Key Function Signatures

The signatures below are exported by implementation files. `index.ts`
re-exports public card, starter, and lint functions and types.

| Exported signature | Source | Purpose |
|---|---|---|
| `export function isRecipeId(value: string): value is RecipeId` | `recipe.schema.ts` | Recognize a supported ID. |
| `export function listRecipes(): RecipeCard[]` | `recipes.tool.ts` | Return sorted defensive card copies. |
| `export function getRecipe(id: string): RecipeCard` | `recipes.tool.ts` | Copy one card or raise `E_NOT_FOUND`. |
| `export function newSong(options: NewSongOptions): Song` | `new.tool.ts` | Build and validate a starter. |
| `export function buildSongArrangement(song: Song, blocks: RecipeArrangementBlock[]): Song` | `new.tool.ts` | Derive song sections and arrangement from one block list. |
| `export function transposePattern(pattern: string, delta: number): string` | `new.tool.ts` | Shift note atoms; intentionally absent from barrel. |
| `export function lintSong(input: unknown, options: LintOptions = {}): LintReport` | `lint.tool.ts` | Produce sorted findings. |
| `export function createGeometry(song: ResolvedSong, timeline: Timeline, genre: string \| null = song.genre): LintGeometry` | `lint-geometry.tool.ts` | Address events by bar and role. |
| `export function genericRules(g: LintGeometry, unknownGenre: boolean): LintResult[]` | `lint-generic.tool.ts` | Apply shared warnings. |
| `export function genreRules(g: LintGeometry, genre: RecipeId, generic: LintResult[]): LintResult[]` | `lint-rules.tool.ts` | Dispatch genre formulas. |
| `export function danceRules(g: LintGeometry, genre: "house" \| "techno", generic: LintResult[]): LintResult[]` | `lint-rules-dance.tool.ts` | Apply dance formulas. |
| `export function lowLayeringRules(g: LintGeometry): LintResult[]` | `lint-layering-low.tool.ts` | Apply L1, L3, and L6 from expanded notes. |
| `export function harmonyLayeringRules(g: LintGeometry): LintResult[]` | `lint-layering-harmony.tool.ts` | Apply L2 and L5 in placements. |
| `export function rhythmLayeringRules(g: LintGeometry): LintResult[]` | `lint-layering-rhythm.tool.ts` | Apply L4 for club genres. |
| `export function renderGenreDocs(cards)` (JSDoc: `readonly RecipeCard[]` → `string`) | `scripts/gen-genre-docs.mjs` | Render the generated genre reference. |
| `export async function main(argv)` (JSDoc: `string[]` → `Promise<number>`) | `scripts/gen-genre-docs.mjs` | Generate or check the reference file. |

`NewSongOptions` requires `genre`; `arrangement`, `bpm`, `key`, `seed`, and `title` are
optional. `LintOptions` contains optional `genre`. `LintResult` has `id`,
`severity`, `path`, `observed`, `expected`, and `fix`. `LintReport` has
`genre`, `barsChecked`, sorted `results`, and error/warning counts.

### Starter construction

- `arrangement` defaults to `card.defaultArrangement`; unknown IDs report sorted valid choices.
- Each variant has unique ID, title, positive-bar blocks, and evidence `basis` IDs. Legacy `card.arrangement` equals the default blocks.
- The common builder reuses matching role/length sections and derives `<role>_<bars>` otherwise; NY drill `prehook` is a four-bar `build` with bass muted.
- `bpm` defaults to the card value and must be an integer in its range.
- `seed` defaults to 1 and must fit an unsigned 32-bit integer.
- `title` defaults to the starter title and is at most 120 characters.
- `key` defaults to the card's first key and must retain its major/minor mode.
- The shortest chromatic shift transposes note atoms and section overrides.
- Drum patterns and unrelated card fields are copied without transposition.
- The final song passes `validateSong`; bad overrides raise `E_INPUT`.

### Lint geometry

- List tracks have no effective pattern text. Their drum activity comes from
  Timeline events within each placement; pitch and rhythm rules use those same
  events. The raw parse-only path still examines actual pattern strings.
- `full` bars come from hook, verse, and groove placements with active kick
  and snare patterns; techno also admits build placements.
- Kick, backbeat, and hat events count only parsed sample events on built-in
  `drums` or `kit:` tracks. The legacy `kick`/`snare`/`clap` track-ID hints for
  full-bar eligibility also apply only to those tracks. SFX can still add to
  general onset density, but never supplies a kit rhythm role.
- `hooks` includes hook bars; `grooves` includes hook and groove bars.
- Step predicates use sixteenth positions with `1/64` cycle tolerance.
- A step-9 backbeat means zero-based step 8; steps 5/13 mean 4/12.
- Four-kick bars require kicks at zero-based 0, 4, 8, and 12.
- Offbeat-hat bars require hats at zero-based 2, 6, 10, and 14.
- Density is the number of distinct tracks with onsets in a bar.
- A motif compares event phase and atom/pitch signatures in adjacent blocks.
- Static clipping risk sums coincident velocity times linear track gain.

### Lint rule catalogue

Rules emit a finding when the stated target fails. Ratios use the named bar
set; a missing eligible set usually skips the ratio check. All listed genre
and generic findings are warnings unless noted otherwise.

| Rule ID | Formula or condition |
|---|---|
| `generic/pattern_parse` | Error: mini-notation fails parsing at a track or section pattern offset while the other schema issues are those pattern failures. |
| `generic/empty_track` | At least one onset must exist per track. |
| `generic/unknown_genre` | Declared genre must match a recipe ID when no override is supplied. |
| `generic/out_of_key` | Every pitched onset must fit the declared major/minor scale. |
| `generic/808_polyphony` | 808 tracks need `mono=true`; overlapping or simultaneous conflicting 808 pitches warn. |
| `generic/clipping_risk` | Maximum coincident onset sum must be ≤2 (`CLIP_RISK_SUM`). Per track: drums add every hit; a notes track adds max velocity × √(chord size); each is × 10^(gain/20) × min(1, 10 ms / attack), with `SLOW_ATTACK_MS` (strings 300, pad 400, choir 300), 250 ms for `lib:` beds and `params.attackMs` overriding. |
| `generic/low_end_overlap` | In one placement, two distinct audible pitched tracks at MIDI ≤46 overlap for ≥25% of its duration; gain must exceed −24 dB. Mono notes stop at the next same-track onset. |
| `generic/low_chord_spacing` | Simultaneous same-track 1–11 semitone chord pairs below the interval-specific lower-MIDI floor (52, 51, 48, 46, 46, 47, 34, 43, 41, 41, 41); bass/808 excluded. |
| `generic/low_pan` | Bass/808, or a pitched track with ≥25% MIDI ≤46 notes, has `abs(pan)>0.1`. |
| `generic/kick_bass_unducked` | In house/techno, ≥50% of actual `bd` onsets coincide with a bass/808 note sounding or attacking within ±30 ms, without duck by a `bd` source of amount ≥0.1. A mixed drum source ducks on every event. |
| `generic/automation_gain_jump` | A music or audio track gain lane point is more than 12 dB (`GAIN_LANE_MARGIN_DB`) above the static `gain`; lanes replace the static value. |
| `generic/automation_send_jump` | A send lane point is more than 12 dB (`SEND_LANE_MARGIN_DB`) above a nonzero static send. |
| `generic/register_collision` | Two focal tracks (lead/bell/pluck/keys/piano/epiano/guitar/flute/brass/marimba/vibraphone/glockenspiel/kalimba) in a ≥2-bar placement have median MIDI distance ≤7 and ≥75% of the sparser track's unique 16th-note onsets shared (a chord counts once). Strings, choir, and organ remain bed voices outside this check. |
| `generic/sub_floor` | A pitched note at MIDI ≤22 occurs. |
| `drill_uk/1` | BPM must be 138..146. |
| `drill_uk/2` | At least 75% of full bars need a snare/clap on step 9, or step 13 without a step-5 backbeat (the alternate-bar moving snare). |
| `drill_uk/3` | At least 75% of full bars need a kick. |
| `drill_uk/4` | Short hat events in full bars must number at least `ceil(full bars / 2)`. |
| `drill_uk/5` | A monophonic 808 track must exist. |
| `drill_uk/6` | 808 pitch transitions inside each contiguous run of full bars must total at least `ceil(full bars / 8)`. |
| `drill_uk/7` | Selected non-bass notes must fit the declared key. |
| `drill_ny/1` | BPM must be 138..145. |
| `drill_ny/2` | At least 75% of full bars need a step-9 snare/clap. |
| `drill_ny/3` | Every hook placement needs at least one kick and one 808 onset. |
| `drill_ny/4` | A monophonic 808 track must exist. |
| `drill_ny/5` | 808 pitch transitions counted inside each hook placement must total at least `ceil(hook bars / 8)`; a jump between hooks does not count. |
| `drill_ny/6` | Every hook of at least two bars needs a repeated one-bar motif on any melody track (`melodyTrackIds`). |
| `drill_ny/7` | Every hook/verse of at least 16 bars needs an 8-bar density or pattern change. |
| `trap/1` | BPM must be 130..170. |
| `trap/2` | At least 75% of full bars need a step-9 snare/clap. |
| `trap/3` | At least 75% of full bars need a hat onset. |
| `trap/4` | Short hat events in full bars must number at least `ceil(full bars / 4)`. |
| `trap/5` | 808 notes must fit the declared key. |
| `trap/6` | A monophonic 808 track must exist. |
| `trap/7` | Each adjacent hook/verse pair needs hook mean active layers ≥ verse mean. |
| `boom_bap/1` | BPM must be 80..100. |
| `boom_bap/2` | At least 75% of full bars need snares/claps on steps 5 and 13. |
| `boom_bap/3` | Song swing must exceed 0.5 and a hat/percussion track must enable swing. |
| `boom_bap/4` | At most 50% of full bars may contain a 32nd-note hat onset. |
| `boom_bap/5` | Bass/808 notes must fit the declared key. |
| `boom_bap/6` | If comparable blocks exist, repeat a 2- or 4-bar melody motif. |
| `boom_bap/7` | Show an adjacent-section mute or melody-signature change. |
| `lofi_hiphop/1` | BPM must be 60..95. |
| `lofi_hiphop/2` | At least 70% of full bars need snares/claps on steps 5 and 13. |
| `lofi_hiphop/3` | Song swing must exceed 0.5 and a hat/percussion track must enable swing. |
| `lofi_hiphop/4` | If comparable blocks exist, repeat a 2-, 4-, or 8-bar melody motif. |
| `lofi_hiphop/5` | At most 50% of full bars may contain a 32nd-note hat onset. |
| `lofi_hiphop/6` | Static onset sum must be ≤2; mirrors generic clipping risk. |
| `house/1` | BPM must be 120..130. |
| `house/2` | At least 90% of groove bars need kicks on steps 1/5/9/13. |
| `house/3` | At least 75% of groove bars need snares/claps on steps 5/13. |
| `house/4` | At least 75% of groove bars need hats on steps 3/7/11/15. |
| `house/5` | Pitched onsets must fit the declared key. |
| `house/6` | Adjacent eligible 8-bar windows need median active-layer change ≥1. |
| `house/7` | Last outro mean layers must be below last groove/hook mean. |
| `techno/1` | BPM must be 126..140. |
| `techno/2` | At least 90% of groove bars need kicks on steps 1/5/9/13. |
| `techno/3` | If comparable blocks exist, repeat a 1- or 2-bar bass/percussion motif. |
| `techno/4` | Comparable build/groove 8- or 16-bar windows need a track-set or median-layer change. |
| `techno/5` | Every breakdown mean must be below the first groove mean. |
| `techno/6` | Static onset sum must be ≤2; mirrors generic clipping risk. |

`lintSong` sorts errors first, then ID and path. Unknown `--genre` values
raise `E_NOT_FOUND`; an unknown declared genre gets the generic warning.
Schema failures normally throw, except the isolated pattern-parse report.

## Dependencies

| Dependency | Import path | Current use |
|---|---|---|
| Song boundary | `../song/index.ts` | Card types, validation, timeline, event data. |
| Pattern boundary | `../pattern/index.ts` | Parse and transpose note atoms. |
| Shared boundary | `../shared/index.ts` | Typed errors and exact fractions. |
| Card modules | `./cards/*.ts` | Registry input. |
| Geometry and rule helpers | `./lint-*.tool.ts` | Static lint computation. |

The only runtime package dependency is the pinned `bun` runtime. Tests use `node:test` under `bun test`.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/cli/commands/recipes.ts` | `../../recipes/index.ts` | List and inspect cards. |
| `src/cli/commands/new.ts` | `../../recipes/index.ts` | Generate a starter. |
| `src/cli/commands/lint.ts` | `../../recipes/lint.tool.ts` | Produce a lint report. |
| `src/recipes/*.test.ts` | Local tool paths | Verify defaults, formulas, and invariants. |
| `scripts/gen-genre-docs.mjs` | `../src/recipes/index.ts` | Call `listRecipes(): RecipeCard[]` and render `skills/music2/references/genres.md`. |

The CLI owns file reads, writes, output formatting, and QA exit policy.
The generator validates its expected recipe IDs and lint-rule meanings, then
compares UTF-8 bytes with the generated file. `bun run docs:genres` writes
changes; `bun run docs:genres:check` runs `--check` and exits 1 on drift.
`.github/workflows/ci.yml` runs that check as a CI gate. The generated genre
reference is consumed by `skills/music2/SKILL.md` and should not be edited by
hand.

## Sync Checklist

- [ ] Update the card table when IDs, BPM, keys, or palettes change.
- [ ] Keep `RECIPE_IDS`, card registry, and card tests aligned.
- [ ] Recheck the lint catalogue when rule IDs or thresholds change.
- [ ] Verify the geometry definitions before describing eligible bars.
- [ ] Keep the feature barrel aligned with public exports.
- [ ] Regenerate `skills/music2/references/genres.md` after card changes and run `bun run docs:genres:check`.
- [ ] Update `devlog/str_func/cli.md` when command flags or exit policy change.
- [ ] Update `devlog/str_func/AGENTS.md` index when adding or moving this document.

## Built-in sampled instruments and voice policy

Genre card palettes and starter tracks avoid saw-based voice configurations. Bass cards explicitly use triangle `wave:2`; techno melody uses `pluck`. `lint-layering-harmony.tool.ts` uses manifest roles so bundled piano and spiccato strings count as focal and sustained strings as a bed.
