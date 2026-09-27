# 040 — wp5 Genre recipes, new/lint, audio critic

wp5 makes the seven researched styles executable as typed recipe cards, deterministic starter songs, and static timeline lint. It adds an advisory audio critic that uses the verified Responses audio route, rejects replies that did not hear audio, and pairs descriptive feedback with music2 DSP measurements. No genre warning claims to define a genre or to prove rendered audio quality.

Depends on: 010 song/timeline/CLI contracts; 020 `renderSong`, `StereoBuffer`, `readWav`/`writeWav`, `discoverFfmpeg`/`encodeAudio`; 030 `analyzeAudio`/`AnalysisJson`; 002 audio probe; 006 recipe research. Consumed by: 050 user docs, dogfood, CI and release. PCM type is 020's `StereoBuffer` everywhere.

## Scope

IN: seven cards, `recipes`, `new`, `lint`, `critique`, a wrong-genre fixture, tests, public/CLI exports, and three `str_func` documents. OUT: automatic song repair, model-generated music, audio-dependent lint, AGPL code, bundled samples, new runtime dependencies, and changes to the v1 song schema. Use Node built-ins, type-erased TypeScript, `.ts` relative imports, and the 010 single-object CLI envelope.

## Contracts and decisions

The cards own genre knowledge; lint owns formulas; critic owns untrusted HTTP/JSON parsing. All seven `starterSong` values are complete, independently editable `Song` objects, not live references to card data. `listRecipes()` returns cards sorted by `id`; `getRecipe()` throws `E_NOT_FOUND` exit 2 for unknown ids. A card's sources are attribution links, not executable inputs.

```ts
// src/recipes/recipe.schema.ts; import type { Song, Section } from '../song/song.schema.ts'
export type RecipeRole = 'kick' | 'snare' | 'hats' | 'bass' | 'melody' | 'chords' | 'percussion';
export interface RecipePaletteEntry { role: RecipeRole; instrument: string; params: Record<string, number> }
export interface RecipeProgression { roman: string; example: string }
export interface RecipeArrangementBlock { role: NonNullable<Section['role']>; bars: number }
export interface RecipeMixTargets { lufs: number; truePeak: number; notes: string }
export interface RecipeCard {
  id: 'drill_uk' | 'drill_ny' | 'trap' | 'boom_bap' | 'lofi_hiphop' | 'house' | 'techno';
  title: string; version: 1; bpm: { min: number; max: number; default: number };
  meter: { numerator: 4; denominator: 4 }; swing: { min: number; max: number; default: number };
  keyDefaults: string[]; scales: string[]; progressions: RecipeProgression[];
  roles: RecipeRole[]; gridRules: string; bassRules: string;
  palette: RecipePaletteEntry[]; arrangement: RecipeArrangementBlock[];
  mixTargets: RecipeMixTargets; lintRules: string[]; starterSong: Song; sources: string[];
}
```

Card fields use the exact table values below. All cards use `version:1`, `meter:{numerator:4,denominator:4}`, `mixTargets:{lufs:-14,truePeak:-1,notes:<genre text>}`, and `roles:['kick','snare','hats','bass','melody']`. `palette` has one entry per required role, with actual 020 voice ids: kick/snare/hats=`drums`, bass=`808` for drill/trap or `bass` otherwise, melody=`bell` for drill, `pluck` for trap, `keys` for boom_bap/lofi/house, `lead` for techno; `params:{}` except validated 020 voice params explicitly chosen by that card. A card must not name an unregistered instrument or parameter. `gridRules` and `bassRules` are concise prose restating the formulas below, not a second rule interpreter.

| id/title | bpm min/default/max | swing min/default/max | keyDefaults; scales | progressions `roman` = `example` | mix notes |
|---|---|---|---|---|---|
| drill_uk / UK Drill | 138/140/145 | .50/.50/.53 | C minor; natural minor, phrygian | i-bVI-bVII = Cm-Ab-Bb; i-bII = Cm-Db | Center sub; preserve kick transient and vocal space. |
| drill_ny / Brooklyn Drill | 138/142/145 | .50/.50/.53 | F minor; natural minor | i-bVI = Fm-Db; i-bVII-bVI = Fm-Eb-Db | Keep 808 audible with controlled harmonics. |
| trap / Trap | 130/140/170 | .50/.50/.53 | A minor; natural minor | i-bVI-bVII = Am-F-G; i-bVII = Am-G | Short kick and controlled sub. |
| boom_bap / Boom Bap | 80/90/100 | .55/.58/.62 | C minor; natural minor | i7-iv7 = Cm7-Fm7; iiø7-V7-i7 = Dø7-G7-Cm7 | Foreground kick/snare; leave bass space. |
| lofi_hiphop / Lo-fi Hip-Hop | 60/75/90 | .56/.60/.64 | C major, A minor; major, natural minor | ii7-V7-Imaj7 = Dm7-G7-Cmaj7; vi7-ii7 = Am7-Dm7 | Preserve dynamics and keep texture quiet. |
| house / House | 120/124/130 | .50/.50/.58 | A minor, C major; natural minor, major | i-bVI-bIII-bVII = Am-F-C-G; I-vi-IV-V = C-Am-F-G | Duck or separate bass from four-on-floor kick. |
| techno / Techno | 126/130/140 | .50/.50/.54 | E minor; natural minor | i pedal = Em; i-bVI = Em-C | Protect kick low end from cumulative bass. |

`sources` per card are the exact URLs in 006's matching Sources paragraph, including their original order. The fixed URL lists are:

| id | `sources` URLs in order |
|---|---|
| drill_uk | `https://www.attackmagazine.com/technique/beat-dissected/uk-drill/`, `https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24/`, `https://splice.com/blog/drum-patterns-different-genres/` |
| drill_ny | `https://www.complex.com/music/brooklyn-drill-the-new-sound-of-new-york/`, `https://djmag.com/longreads/these-are-most-exciting-uk-drill-producers-right-now`, `https://splice.com/blog/drum-patterns-different-genres/` |
| trap | `https://splice.com/blog/how-to-make-trap-beat-fl-studio/`, `https://splice.com/blog/the-sound-atl-trap/` |
| boom_bap | `https://blog.native-instruments.com/what-is-boom-bap/`, `https://www.attackmagazine.com/technique/beat-dissected/90s-boom-bap-hip-hop/` |
| lofi_hiphop | `https://blog.native-instruments.com/lo-fi-hip-hop-beats/`, `https://splice.com/blog/lo-fi-beat-origin-sound/`, `https://splice.com/blog/lo-fi-chord-progressions/` |
| house | `https://blog.native-instruments.com/house-music-101/`, `https://www.attackmagazine.com/technique/beat-dissected/90s-jersey-garage-house/` |
| techno | `https://www.beatportal.com/articles/783088-step-by-step-guide-to-producing-techno-peak-time-driving-in-the-style-of-layton-giordani-eli-brown-and-adam-beyer`, `https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells/`, `https://www.attackmagazine.com/technique/beat-dissected/spastik-style-percussive-techno/` |

Use these exact card strings for `gridRules` and `bassRules` (step numbers are one-based):

| id | `gridRules` | `bassRules` |
|---|---|---|
| drill_uk | `16 steps/bar; snare on 9, sparse syncopated kick, 3+3+2 hat accents and occasional subdivisions.` | `Mono tuned 808 around C1-C3; sustain roots, answer kick, and add occasional pitch transitions.` |
| drill_ny | `16 steps/bar; clap on 9, syncopated kick, bouncing hats and optional rim reply.` | `Mono tuned 808 around F1-F3; hook carries pitch movement and kick-aligned attacks.` |
| trap | `16 steps/bar; snare on 9, sparse kick, eighth hats with brief subdivisions.` | `Mono tuned 808 around A1-A3; follow roots and separate long bass from kick.` |
| boom_bap | `16 steps/bar; snares on 5 and 13, syncopated kick, swung eighth hats.` | `Rounded bass around E1-E3; short root notes and pickups converse with kick.` |
| lofi_hiphop | `16 steps/bar; snares on 5 and 13, soft kick and sparse swung offbeat hats.` | `Soft bass around C2-C4; follow roots without long distorted glides.` |
| house | `16 steps/bar; kicks on 1,5,9,13, claps on 5,13, offbeat hats on 3,7,11,15.` | `Rounded bass around E1-E3; syncopate or duck under each kick.` |
| techno | `16 steps/bar; kicks on 1,5,9,13 and offbeat hats; layers change by section.` | `Short repeating bass around E1-E3; separate the pulse from kick.` |

Do not add sample/chord-symbol fields absent from Song v1.

### Complete starter-song construction

Each card exports a literal `RecipeCard`; its `starterSong` is a literal `Song` with `version:1,title:<title> Starter,genre:<id>,bpm:<default>,meter:4/4,key:<first keyDefaults>,seed:1,swing:<default>,sampleRate:44100,tailSeconds:2,master:{ceilingDb:-1,targetLufs:-14},tracks,sections,arrangement`. Every track literal includes `id,kind,instrument,pattern,velocity,gain,pan,gate,mono,glide,swing,sends,params`; use `{}` for params and `{reverb:0,delay:0}` unless specified below. Track IDs are `kick`,`snare`,`hats`,`bass`,`melody`; their kinds are drums,drums,drums,notes,notes, respectively. The `kick/snare/hats` instruments are `drums`; `bass/melody` use the palette. Drums use velocity .8, gate .9, mono false; bass uses velocity .75, gain -3, pan 0, mono true, gate .9, glide 60 ms for drill/trap and 0 otherwise; melody uses velocity .65, gain -6, mono false, gate .8, sends reverb .25. Other numeric track defaults are gain 0, pan 0, glide 0. Set `hats.swing:true` only for boom_bap/lofi; all other track swing flags false (house swing default .50). All drum patterns are 16-step bars copied exactly from 006; use `~` for a muted track in section overrides, never an empty string.

| id | kick pattern | snare pattern | hats pattern | bass pattern | melody pattern |
|---|---|---|---|---|---|
| drill_uk | `bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~` | `~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~` | `hh ~ ~ hh ~ ~ hh ~ hh ~ ~ hh ~ ~ hh ~` | `c2 ~ ~ ~ ~ ~ c2 ~ ~ ~ eb2 ~ ~ ~ ~ ~` | `c5 ~ eb5 ~ g5 ~ ~ ~ ab5 ~ g5 ~ eb5 ~ ~ ~` |
| drill_ny | `bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~` | `~ ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~` | `hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~` | `f2 ~ ~ ~ ~ ~ f2 ~ ~ ~ ab2 ~ ~ ~ ~ ~` | `f5 ~ ab5 ~ c6 ~ ~ ~ db6 ~ c6 ~ ab5 ~ ~ ~` |
| trap | `bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~` | `~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~` | `hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~` | `a1 ~ ~ ~ ~ ~ a1 ~ ~ ~ c2 ~ ~ ~ ~ ~` | `a4 ~ c5 ~ e5 ~ ~ ~ g5 ~ e5 ~ c5 ~ ~ ~` |
| boom_bap | `bd ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~ ~ ~` | `~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~` | `hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~` | `c2 ~ ~ ~ ~ ~ g2 ~ c2 ~ ~ ~ ~ ~ ~ ~` | `c4 ~ eb4 ~ g4 ~ ~ ~ bb4 ~ g4 ~ eb4 ~ ~ ~` |
| lofi_hiphop | `bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~` | `~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~` | `~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~` | `c2 ~ ~ ~ ~ ~ g2 ~ c2 ~ ~ ~ ~ ~ ~ ~` | `c4 ~ e4 ~ g4 ~ ~ ~ b4 ~ g4 ~ e4 ~ ~ ~` |
| house | `bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~` | `~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~` | `~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~` | `a1 ~ ~ ~ ~ ~ e2 ~ a1 ~ ~ ~ ~ ~ e2 ~` | `a4 ~ c5 ~ e5 ~ ~ ~ g5 ~ e5 ~ c5 ~ ~ ~` |
| techno | `bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~` | `~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~` | `~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~` | `e2 ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~` | `e4 ~ ~ ~ g4 ~ ~ ~ e4 ~ ~ ~ b4 ~ ~ ~` |

For each card, define section literals with unique ids `intro`,`hook`,`verse`,`groove`,`build`,`breakdown`,`outro` as needed by the template below. `bars` equals its template block length; reuse a section id for repeated blocks of the same length via arrangement repeats at separate positions. `patterns` is `{bass:null,melody:null}` in intro/outro, `{melody:null}` in breakdown, and `{}` otherwise; techno `build` uses `{melody:null}`. `arrangement` enumerates every block as `{section:<id>,repeats:1}`. For repeated `hook`/`verse` of the same length, reference the existing section; for house's second groove/return use `groove` and the same 16-bar section. The card's `arrangement` field is the role/bars sequence, while `starterSong.arrangement` references section ids. This yields a complete renderable song without external kits.

| id | `arrangement` role:bars sequence | starter section ids in order |
|---|---|---|
| drill_uk | intro:4, hook:8, verse:16, hook:8, verse:16, hook:8, outro:4 | intro,hook,verse,hook,verse,hook,outro |
| drill_ny | intro:4, hook:8, verse:16, hook:8, verse:16, hook:8, outro:4 | intro,hook,verse,hook,verse,hook,outro |
| trap | intro:4, verse:16, hook:8, verse:16, hook:8, outro:4 | intro,verse,hook,verse,hook,outro |
| boom_bap | intro:4, verse:16, hook:8, verse:16, hook:8, outro:4 | intro,verse,hook,verse,hook,outro |
| lofi_hiphop | intro:4, groove:16, breakdown:8, groove:16, outro:4 | intro,groove,breakdown,groove,outro |
| house | intro:16, groove:16, hook:16, breakdown:8, groove:16, outro:16 | intro,groove,hook,breakdown,groove,outro |
| techno | intro:16, build:16, groove:32, breakdown:16, groove:32, outro:16 | intro,build,groove,breakdown,groove,outro |

The example patterns intentionally remain simple; card lint warnings expose absent rolls, fills, and density changes where the template does not implement them. Starter validity is a schema/renderability promise, not a promise of zero advisory warnings.

```ts
// src/recipes/new.tool.ts
export interface NewSongOptions { genre: RecipeCard['id']; bpm?: number; key?: string; seed?: number; title?: string }
export function newSong(options: NewSongOptions): Song;
// src/recipes/lint.tool.ts
export interface LintResult { id: string; severity: 'error' | 'warning'; path: string; observed: string | number; expected: string | number; fix: string }
export interface LintReport { genre: string | null; barsChecked: number; results: LintResult[]; errors: number; warnings: number }
export interface LintOptions { genre?: string }
export function lintSong(input: unknown, options?: LintOptions): LintReport;
// src/critic/critic.tool.ts
export interface CriticReview {
  heard_audio: boolean; overall: string; timbre: string[]; groove: string[]; mix: string[];
  arrangement: string[]; genre_fit: { score: 1 | 2 | 3 | 4 | 5; notes: string }; top_fixes: string[];
}
export interface CritiqueOptions { model?: string; baseUrl?: string; excerpt?: number; apiKey?: string; timeoutMs?: number }
export interface CritiqueReport { review: CriticReview; dsp: AnalysisJson; audio: { format: 'mp3' | 'wav'; excerptSeconds: number; source: string }; model: string }
export async function critique(inputPath: string, options?: CritiqueOptions): Promise<CritiqueReport>;
```

`AnalysisJson` is imported from 030's public analyze boundary and includes its measured LUFS/true peak/BPM/key fields; use `analyzeAudio(pcm).analysis` so PNG Buffers do not enter the CLI JSON. `timeoutMs` is an API/test option (default 120000), not a CLI flag. `newSong` JSON-clones the card literal, changes title/genre/bpm/key/seed, calls `validateSong(clone)` only as a gate (any issue → E_INPUT naming the card, a bug in the card) and returns the authoring `Song` clone itself, so `music2 new` writes a file in the input shape that `validate` accepts; resolved objects stay inside consumers. No call in this phase uses `Date` or `Math.random` in an audio path; existing randomized patterns remain seeded through `src/shared/prng.tool.ts` and `buildTimeline`.

Transposition: parse keys with 010's `^[A-G](#|b)? (major|minor)$`; convert roots to pitch class using C=0,D=2,E=4,F=5,G=7,A=9,B=11 plus accidental, `delta = ((requestedRoot - defaultRoot + 18) % 12) - 6` (tie at +6 resolves to -6). Require the same mode as the card's first `keyDefaults` entry; incompatible mode is `E_INPUT` with a fix naming that mode. Parse every note-track pattern to AST, shift each note/numeric MIDI atom by `delta`, and replace only atom raw spans at their 010 `Atom.offset` positions, right-to-left; `midiToName` spells shifted note names, while numeric atoms stay numeric. This preserves stacks, alternation, rests, and suffixes byte-for-byte. Reject out-of-range MIDI (<0 or >127) with `E_INPUT`; drum patterns and velocity patterns never transpose. Validate bpm integer within both 40-240 schema and card min/max, seed uint32, title <=120; invalid flag values are `E_INPUT` exit 2. The returned song's defaults are independent of the stored card.

## Static lint rule definitions

`lintSong` receives parsed JSON, calls `validateSong`, then `buildTimeline` for valid input. If validation throws E_SCHEMA, recheck every string at `tracks[i].pattern` and `sections[i].patterns.<id>` with `parseMini` plus the 010 atom value parser for that track kind: if every schema issue path matches a caught E_PARSE, return one `generic/pattern_parse` error per bad path, with offsets, `barsChecked:0`, and CLI exit 6; if any other issue remains, rethrow E_SCHEMA/2 because a timeline cannot be trusted. No timeline-based rules run in the parse-only case. Unknown `song.genre` produces `generic/unknown_genre` warning, with only generic rules; explicit `--genre` overrides song.genre and unknown explicit ids are `E_NOT_FOUND` exit 2. Rule results are sorted by severity (error first), id, path. One aggregate result per id except separate parse paths; observed includes the numerator/denominator or bar list when useful. If a denominator is zero, omit that advisory result; do not report a fabricated 0%.

Event geometry: `B` is an absolute bar from `Timeline.placements`; `E(B)` filters events with `event.bar === B`. Use `event.cycleBegin` parsed as `Fraction`, and `phase = fractionalPart(cycleBegin)`, for unswung 16-step positions; swing changes seconds but never a rule's grid. `at(q,e)` means `|phase(e)-q/16| <= 1/64`, where q is zero-based. For bars near a placement boundary, derive B from placement startBar; do not count tails as new onsets. A kick is a drums-track atom `bd`; backbeat is drums atom `sd` or `cp`; hats are drums atoms `hh`,`oh`,`sh`; 808 is a notes track whose instrument is `808`. Lint never imports card data (wp5 P amendment): roles come only from song events and track identity (atom names, `kind`, `instrument`), plus the declared genre id checked against `RECIPE_IDS`. Full bars F are placements with role hook, verse or groove, whose effective kick and snare patterns are non-null; techno additionally includes build only when both patterns active. Hook bars H are role hook; groove bars G are role groove or hook. `ratio(P,S)=count(P in S)/|S|`. `kick(B)` means >=1 bd; `snare9(B)` means >=1 backbeat with `at(8,e)`; `snare5and13(B)` requires backbeats at q=4 and q=12. At minimum one event means count >=1. A short slot means `event.slot < secondsPerBar/16 - 1e-6`, and a 32nd roll means `event.slot <= secondsPerBar/32 + 1e-6` on a hat. `active(B)` is the number of distinct track ids with onsets in B.

Generic rules (all warnings except parse):

| id | Exact trigger and observation | fix |
|---|---|---|
| generic/pattern_parse | Any pattern E_PARSE issue; error with issue path and offset | Correct mini-notation at caret. |
| generic/empty_track | Any track has zero timeline onsets across arrangement | Add onsets or remove the track. |
| generic/unknown_genre | song.genre present but not a card id, absent explicit override | Choose `music2 recipes` id or pass `--genre`. |
| generic/out_of_key | With declared key, any note event pitch class outside major {0,2,4,5,7,9,11} or natural minor {0,2,3,5,7,8,10} rotated by root; observation is count/total and first track/bar | Change notes/key; document intentional chromatic notes in arrangement metadata later. |
| generic/808_polyphony | 808 track has `mono:false` OR any simultaneous distinct-pitch 808 onsets OR intervals `[time,time+duration)` overlap by >1 ms within an 808 track | Set mono true; shorten/revoice overlaps. |
| generic/clipping_risk | At any same-bar onset group within 1/64 bar, sum `velocity * 10^(track.gain/20)` > 1.5; report max sum (static proxy, never call it measured clipping) | Lower gains/velocities, then verify with analyze. |

Genre rule ids are exactly `<id>/<n>` and all have severity warning. Add every listed id to its card's `lintRules` in numeric order. `bpm` checks are inclusive. Rounding is not used to decide thresholds; reports display percentages to one decimal. Define `kick(B)`, `snare9(B)`, `snare5and13(B)`, `fourKick(B)`, `offhat(B)` by the event geometry above; `fourKick` requires bd at q=0,4,8,12 and `offhat` requires oh/hh at q=2,6,10,14. A `transition(S)` is adjacent 808 notes in S with distinct MIDI; `motif(k,S,track)` means a pair of consecutive k-bar blocks has identical sorted sequences of `(phase,midi or atom.name)` on that track, ignoring absolute time. `densityChange(S,window)` means two adjacent windows of `window` bars differ by >=1 in median `active(B)`. `muteChange` means a section overrides >=1 effective pattern to null relative to adjacent full section. These definitions make phrase rules testable without unavailable chord symbols or text labels.

| id | Failure formula over eligible bars/sections |
|---|---|
| drill_uk/1 | bpm outside [138,145]. |
| drill_uk/2 | `ratio(snare9,F) < .75` (main snare step 9, beat 3). |
| drill_uk/3 | `ratio(kick,F) < .75`. |
| drill_uk/4 | short hat event count in F `< ceil(|F|/2)`. |
| drill_uk/5 | `generic/808_polyphony` exists or no 808 track; warning when no 808. |
| drill_uk/6 | 808 transitions in F `< ceil(|F|/8)`. |
| drill_uk/7 | Same pitch-class computation as generic/out_of_key, restricted to 808+melody; emit if count >0, but suppress duplicate generic warning in CLI display only if identical event set. |
| drill_ny/1 | bpm outside [138,145]. |
| drill_ny/2 | `ratio(snare9,F) < .75`. |
| drill_ny/3 | In any hook section, no kick or no 808 onset. |
| drill_ny/4 | `generic/808_polyphony` exists or no 808 track. |
| drill_ny/5 | 808 transitions in H `< ceil(|H|/8)`; octave moves and glide are not inferable from events, so note transitions are the executable proxy. |
| drill_ny/6 | No `motif(1,H,melody)` in each hook of >=2 bars. |
| drill_ny/7 | In any hook/verse section >=16 bars, no `densityChange(section,8)` and no change in per-bar note/atom motif between its first and second 8-bar blocks. |
| trap/1 | bpm outside [130,170]. |
| trap/2 | `ratio(snare9,F) < .75`. |
| trap/3 | `ratio(B has >=1 hat,F) < .75`. |
| trap/4 | short hat event count in F `< ceil(|F|/4)`. |
| trap/5 | Any 808 note outside declared scale; omit when no key, but generic/out_of_key covers it. |
| trap/6 | `generic/808_polyphony` exists or no 808 track. |
| trap/7 | For any hook adjacent to verse, mean `active(B)` in hook < mean in verse; omit if no such pair. |
| boom_bap/1 | bpm outside [80,100]. |
| boom_bap/2 | `ratio(snare5and13,F) < .75`. |
| boom_bap/3 | song.swing <= .5 OR no hat/perc track with `swing:true`; v1 has no per-event offset field. |
| boom_bap/4 | `ratio(B has a 32nd hat roll,F) > .5`. |
| boom_bap/5 | Any bass note outside declared key; omit absent key. |
| boom_bap/6 | No `motif(2,F,melody)` and no `motif(4,F,melody)` where enough contiguous bars exist. |
| boom_bap/7 | No `muteChange` and no section-to-section melody motif change. |
| lofi_hiphop/1 | bpm outside [60,90]. |
| lofi_hiphop/2 | `ratio(snare5and13,F) < .70`. |
| lofi_hiphop/3 | song.swing <= .5 OR no hat/perc track with `swing:true`. |
| lofi_hiphop/4 | No `motif(k,F,melody)` for k in {2,4,8} where enough contiguous bars exist; seventh-chord check omitted because v1 has no chord symbols. |
| lofi_hiphop/5 | `ratio(B has a 32nd hat roll,F) > .5`. |
| lofi_hiphop/6 | `generic/clipping_risk` exists; this is static risk, not measured clipping. |
| house/1 | bpm outside [120,130]. |
| house/2 | `ratio(fourKick,G) < .90`. |
| house/3 | `ratio(snare5and13,G) < .75`. |
| house/4 | `ratio(offhat,G) < .75`. |
| house/5 | Any bass/melody note outside declared key; omit absent key. |
| house/6 | No `densityChange` between any adjacent 8-bar windows of groove/hook/breakdown. |
| house/7 | Mean `active(B)` in outro >= mean in final groove/hook section; omit if either absent. |
| techno/1 | bpm outside [126,140]. |
| techno/2 | `ratio(fourKick,G) < .90`. |
| techno/3 | No `motif(1,G,bass)` and no `motif(2,G,bass)`; use percussion if bass absent. |
| techno/4 | Every adjacent 8- or 16-bar window in build/groove has identical active-track sets and equal median density. |
| techno/5 | Mean `active(B)` in breakdown >= mean in main groove; omit absent breakdown. |
| techno/6 | `generic/clipping_risk` exists; no chord-change requirement. |

Thresholds in 006 that require unrepresented facts are deliberately not inferred: explicit chromatic intent, true glide use, harmony/chord roots, seventh chords, and measured clipping. Their nearest observable proxies above are named as proxies. `path` for a genre result is `bpm`, `tracks.<id>`, or `sections.<id>`/`arrangement` as appropriate; `observed` is the measured count/ratio; `expected` is the threshold; `fix` names a concrete pattern, track, or section change. Avoid one result per bar flood.

## Critic transport and trust boundary

For `song.json`, `loadSong(inputPath)`, then `renderSong(song,inputPath)` and take `.audio`; for WAV, call `readWav(inputPath)`. Slice that `StereoBuffer` to the first `min(excerpt,availableDuration)` seconds at frame boundaries; call `analyzeAudio(slicedPcm).analysis` in both cases. The excerpt is analyzed as audio-only (`dsp.source:'wav'`), so its BPM/key/LUFS/peak are independent measurements and no full-song section data is asserted for a short clip. `excerpt` is finite in [1,120], default 30. `writeWav(tempPath,slicedPcm,{bits:16,seed:song.seed})` (seed 1 for WAV input); if `discoverFfmpeg()` returns an object with `encoders.libmp3lame`, call `encodeAudio(tempPath,mp3Path,ffmpeg,{format:'mp3',bitrateKbps:64})`, otherwise send WAV. Do not mistake missing ffmpeg/encoder for a critique failure: WAV is the supported fallback. Use `data:audio/mpeg;base64,` and filename `excerpt.mp3`, or `data:audio/wav;base64,` and `excerpt.wav`.

POST `${baseUrl without trailing slash}/v1/responses` with JSON `{model,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_file',filename,file_data:dataUrl}]}],stream:false}`. Resolve `model` flag > `MUSIC2_CRITIC_MODEL` > `google-antigravity/gemini-3.8-flash`; `baseUrl` flag > `MUSIC2_CRITIC_BASE_URL` > `http://127.0.0.1:10100`; `apiKey` option > `MUSIC2_CRITIC_API_KEY` > `local`. Send `Authorization: Bearer <key>` and JSON content type; redact key and data URL in errors. Abort after 120 s by default; timeout is `E_TIMEOUT` exit 7, retryable true. Network errors and HTTP 5xx are `E_PROVIDER` exit 4, retryable true; other unrecognized HTTP failures are `E_PROVIDER` exit 4 with status/body excerpt, retryable false.

Prompt: "Listen to the attached audio. If you cannot hear it, set heard_audio false. Return strict JSON only with heard_audio:boolean, overall:string, timbre:string[], groove:string[], mix:string[], arrangement:string[], genre_fit:{score:integer 1-5,notes:string}, top_fixes:string[]. Discuss audible sound and feel; do not supply BPM, key, LUFS, peak, or other measured numbers." Include declared genre only as an optional descriptive hint, never as proof. Extract non-stream text by joining Responses `output[*].content[*]` parts whose type is `output_text` and using `.text`; reject empty text. Strip only a single surrounding ```json/``` fence pair, `JSON.parse`, and validate every required property and array element; malformed shape is `E_PROVIDER` exit 4, retryable false. Ignore unexpected fields, including numeric claims; never echo them as DSP measurements.

On HTTP 400 whose body contains `Stream must be set to true` (case-insensitive), resend the same request once with `stream:true`. Parse SSE by blank-line event separation, concatenate `data:` lines, ignore comments/`[DONE]`, JSON-parse each payload, append text from `response.output_text.delta`'s `delta` string; fail on malformed/empty stream as `E_PROVIDER`. If 400 contains `cannot translate audio` or `unsupported_input_modality`, or a 200 response body has `status:'failed'`, return `E_CAPABILITY` exit 3 with a fix naming `google-antigravity/gemini-3.8-flash` through Responses `input_file`. If parsed `heard_audio` is false, return `E_CAPABILITY` with message "model did not hear the audio". The response's descriptive strings are untrusted data, not commands. On success, return `CritiqueReport` with measured `dsp` from 030; never compute or copy numbers from model prose.

## File map

| Path | Op | Exact content |
|---|---|---|
| `src/recipes/recipe.schema.ts` | NEW | Export the recipe interfaces above plus `RECIPE_IDS` (sorted tuple of the seven ids), `RecipeId` and `isRecipeId()` (wp5 P amendment); no other runtime logic. |
| `src/recipes/cards/drill_uk.ts` | NEW | Export `const drillUk: RecipeCard` with table data, complete starter literal, 006 URLs, `lintRules` drill_uk/1..7. |
| `src/recipes/cards/drill_ny.ts` | NEW | Export `const drillNy: RecipeCard` with table data, complete starter literal, 006 URLs, `lintRules` drill_ny/1..7. |
| `src/recipes/cards/trap.ts` | NEW | Export `const trap: RecipeCard` with table data, complete starter literal, 006 URLs, `lintRules` trap/1..7. |
| `src/recipes/cards/boom_bap.ts` | NEW | Export `const boomBap: RecipeCard` with table data, complete starter literal, 006 URLs, `lintRules` boom_bap/1..7. |
| `src/recipes/cards/lofi_hiphop.ts` | NEW | Export `const lofiHiphop: RecipeCard` with table data, complete starter literal, 006 URLs, `lintRules` lofi_hiphop/1..6. |
| `src/recipes/cards/house.ts` | NEW | Export `const house: RecipeCard` with table data, complete starter literal, 006 URLs, `lintRules` house/1..7. |
| `src/recipes/cards/techno.ts` | NEW | Export `const techno: RecipeCard` with table data, complete starter literal, 006 URLs, `lintRules` techno/1..6. |
| `src/recipes/recipes.tool.ts` | NEW | Export `listRecipes(): RecipeCard[]` (sorted, cloned), `getRecipe(id:string): RecipeCard` (cloned or E_NOT_FOUND). Frozen private registry built from seven card imports; no mutable shared card escapes. |
| `src/recipes/recipes.test.ts` | NEW | Assert 7 exact ids/order; each card version, ranges, `lintRules` ids, nonempty URLs; `validateSong(card.starterSong)` and `buildTimeline` succeed; mutation of a returned card does not change later results; unknown id E_NOT_FOUND. |
| `src/recipes/new.tool.ts` | NEW | Export `NewSongOptions`, `newSong(options): Song`; clone literal, parse/transpose note AST, assign overrides, validate. Constants key pitch-class table and MIDI [0,127] bound live here. |
| `src/recipes/new.test.ts` | NEW | `newSong({genre:'drill_uk'})` is 140 BPM/C minor/seed 1; key D minor shifts C2=36 to D2=38 and snare text unchanged; F minor to E minor uses -1 not +11; same input deep-equal twice; invalid key mode/bpm/seed/title/MIDI bound E_INPUT; card remains unchanged. |
| `src/recipes/lint.tool.ts` | NEW | Export `LintResult`, `LintReport`, `LintOptions`, `lintSong`; constants `GRID_TOLERANCE=1/64`, `CLIP_RISK_SUM=1.5`; generic + genre rule functions as formulas above; deterministic stable result ordering. |
| `src/recipes/lint.test.ts` | NEW | One fixture per 7 genre BPM boundaries; per-rule synthetic timeline/song cases including step-9 3/4 pass vs 2/4 fail, house four-kick 9/10 pass vs 8/10 fail, snare 5+13, roll count, transitions, motif/density; zero-eligible skip; parse error becomes result; empty track; out-of-key C minor E natural; 808 same-time notes; clipping sum 1.6 warning; wrong-genre fixture names drill_uk/1 and /2. |
| `src/recipes/index.ts` | NEW | Public feature boundary exports recipe interfaces and `listRecipes`, `getRecipe`, `newSong`, `lintSong`; no internal card barrel. |
| `src/critic/critic.tool.ts` | NEW | Export critic interfaces and `critique`; helpers for excerpt/encoding, Responses POST, SSE assembly, JSON shape check; use `fetch`, `AbortController`, Node temp dir cleanup in `finally`; no runtime package. |
| `src/critic/critic.test.ts` | NEW | Local `node:http` mock only: normal success, fenced JSON, streaming fallback after exact 400, capability 400 variants, failed status, `heard_audio:false`, 500 E_PROVIDER retryable, malformed shape nonretryable, timeout via `timeoutMs:20`, WAV fallback when ffmpeg missing, request file_data/filename/auth assertions; optional live test only if `MUSIC2_LIVE_CRITIC=1` (real opencodex, expects heard_audio true on short fixture). |
| `src/critic/index.ts` | NEW | Public feature boundary exports `critique` and critic types. |
| `src/cli/commands/recipes.ts` | NEW | Export `const recipes: CommandSpec` with `options:{}` and `async run(ctx): Promise<CommandResult>`; zero/one positional lists/gets, serializes metadata plus starterSong only for `recipes <id>`. |
| `src/cli/commands/new.ts` | NEW | Export `const newCommand: CommandSpec` with string options `genre,bpm,key,seed,title,out` (`out.short:'o'`); `async run(ctx): Promise<CommandResult>` calls `newSong`, writes 2-space JSON + newline for `-o`, refuses existing path, returns `{song}` or `{written,genre,bpm,key,seed}`. |
| `src/cli/commands/lint.ts` | NEW | Export `const lint: CommandSpec` with string option `genre`, boolean `strict`; `async run(ctx): Promise<CommandResult>` reads/JSON-parses file (E_INPUT on malformed JSON), calls `lintSong(raw, typeof ctx.values.genre === "string" ? { genre: ctx.values.genre } : {})`; the CLI alone decides the exit (errors > 0 → E_QA; `--strict` and warnings > 0 → E_QA), `lintSong` never reads strict (the `--genre` flag overrides `song.genre`; main.test.ts: drill-140 with `--genre house --strict` exits 6 naming `house/*` rules), returns `LintReport` or throws E_QA with `details.report`. Do not call `loadSong` first, since it would mask parse-rule output. |
| `src/cli/commands/critique.ts` | NEW | Export `const critiqueCommand: CommandSpec` with string options `model,base-url,excerpt`; `async run(ctx): Promise<CommandResult>` calls `critique`, returns `CritiqueReport`. |
| `src/cli/registry.ts` | MODIFY | Import the four `CommandSpec` constants above and append them to the existing `for (const spec of [...]) register(spec)` array; keep existing commands/order. |
| `src/cli/args.ts` | MODIFY | Keep shared `parseCommand` and `--json`; add duplicate scalar-flag detection before `parseArgs`, returning E_INPUT with the offending flag. The command-specific flag specs live in each `CommandSpec.options`. |
| `src/cli/commands/help.ts` | NO CHANGE | Help is generated from the registry (each CommandSpec's `summary`/`usage`/`options`); the four commands' usage strings carry their flags and exit notes (wp5 P amendment). |
| `src/cli/main.test.ts` | MODIFY | Add cases for all four registrations, JSON envelope, new file write, strict warning exit 6, parse result exit 6, provider/capability exit mappings. |
| `src/index.ts` | MODIFY | Add named exports for `RecipeRole`, `RecipePaletteEntry`, `RecipeProgression`, `RecipeArrangementBlock`, `RecipeMixTargets`, `RecipeCard`, `NewSongOptions`, `LintOptions`, `LintResult`, `LintReport`, `CritiqueOptions`, `CriticReview`, `CritiqueReport`, `listRecipes`, `getRecipe`, `newSong`, `lintSong`, `critique` from feature boundaries. |
| `examples/wrong-genre.song.json` | NEW | Full valid Song: genre drill_uk, bpm 124, key A minor, 4/4, seed 1; five tracks using house row above, one 4-bar `groove` section, arrangement once. Four-on-floor bd on steps 1/5/9/13 and clap on 5/13; `--strict` emits drill_uk/1, /2 and exits 6. |
| `devlog/str_func/recipes.md` | NEW | File Tree, Module Responsibility, Key Function Signatures, Dependencies, Dependents, Sync Checklist for cards/new/lint. |
| `devlog/str_func/critic.md` | NEW | Same sections for transport, excerpt, DSP merge and error mapping. |
| `devlog/str_func/cli.md` | MODIFY | Add rows for four handlers, their flags and result shapes in existing CLI feature document. |
| `devlog/str_func/AGENTS.md` | MODIFY | Add index rows `recipes -> recipes.md` and `critic -> critic.md`; preserve existing entries. |

Each new `*.tool.ts` has its colocated `*.test.ts` row above. Each new feature folder has one public `index.ts`; do not create a `cards/index.ts` convenience barrel.

## CLI contract

All success stdout uses 010 `{ok:true,data:<shape>,meta:{music2:<version>}}` with one JSON object under `--json`/`MUSIC2_JSON=1`; failures use `Music2Error`'s `{ok:false,error,...}` envelope and exit code. For lint E_QA, put the complete `LintReport` under `error.details.report`, so strict failures retain every finding in that one object. Human output may format the same data but may not hide rule ids or error fixes.

| Command | Flags/defaults | Output `data` | Errors / exit |
|---|---|---|---|
| `music2 recipes [id] [--json]` | id omitted lists all | list `{recipes:[{id,title,bpm,keyDefaults,roles}]}`; id `{recipe:RecipeCard}` | unknown id E_NOT_FOUND/2 |
| `music2 new --genre <id> [--bpm n] [--key "C minor"] [--seed n] [--title text] [-o song.json] [--json]` | bpm/key/seed/title from card; no output path prints song | `{song:Song}` or `{written,genre,bpm,key,seed}` | E_INPUT, E_NOT_FOUND, E_SCHEMA/2; existing destination E_ACCESS/4 |
| `music2 lint <song> [--genre id] [--strict] [--json]` | genre from song; strict false | `LintReport` with ids/results/counts | 0 if no errors (warnings allowed absent strict); E_QA/6 for any errors or strict+warnings; E_SCHEMA/2 for unbuildable schema |
| `music2 critique <audio.wav|song.json> [--model id] [--base-url url] [--excerpt s] [--json]` | model/base env then 002 defaults; excerpt 30 s | `CritiqueReport` `{review,dsp,audio,model}` | E_INPUT/2; E_CAPABILITY/3; E_PROVIDER/4; E_TIMEOUT/7; render input E_RENDER/5 |

## Acceptance

| Check | Command | What it observes |
|---|---|---|
| Types | `npm run typecheck` | Card literals, public types, transport parser and CLI flags typecheck. |
| Lint | `npm run lint` | No lint errors across source/tests/docs-linked code. |
| Tests | `npm test` | Colocated recipe/new/lint/critic and CLI mock-server cases run, 0 failures; live case skips unless gated. |
| Build | `npm run build` | Dist output and 010 bin fallback remain runnable. |
| Recipe list | `node bin/music2.js recipes --json` | Seven sorted ids in one success envelope. |
| Starter | `node bin/music2.js new --genre drill_uk --key "D minor" --seed 7 --json` | Valid song, 140 BPM, D minor, seed 7, bass D2 onset. |
| Wrong genre | `node bin/music2.js lint examples/wrong-genre.song.json --strict --json` | Exit 6/E_QA and named drill_uk/1,/2 warnings. |
| Critic live (manual, gated) | `MUSIC2_LIVE_CRITIC=1 node bin/music2.js critique examples/wrong-genre.song.json --model google-antigravity/gemini-3.8-flash --json` | On available opencodex, `heard_audio:true`, DSP metrics present, no model BPM/key numbers; document exact model/status. |

## Activation scenarios

- `recipes.test.ts` unknown id triggers E_NOT_FOUND; mutate returned card, then re-read to prove clone isolation. Every card validates and produces nonzero timeline events.
- `new.test.ts` same seed/inputs produce deep-equal Song and identical seeded event timing; D minor shifts note semitones but preserves drum atoms; invalid bpm/key mode/seed/MIDI bound trigger E_INPUT with fix.
- `lint.test.ts` intentionally invalid pattern yields `generic/pattern_parse` error and CLI exit 6; schema-invalid non-pattern field yields E_SCHEMA/2. Muted intro excludes its empty drum grid from F.
- `lint.test.ts` threshold pairs hit both sides of 75%, 70%, 90%, roll-rate and transition thresholds; zero eligible bars suppress fraction rules. `generic/empty_track`, `/out_of_key`, `/808_polyphony`, `/clipping_risk` each has a one-condition fixture and named observation.
- Wrong-genre fixture triggers drill_uk/1 and /2 (124 BPM, beat-2/4 clap), while `--strict` changes warning-only exit from 0 to E_QA/6. `--genre house` override instead checks house rules.
- `critic.test.ts` mock reads request JSON and verifies `input_text`, `input_file` data URL, filename, Bearer header; ffmpeg-found path sends mp3 and forced-missing path sends WAV. The 400 stream-only mock receives exactly two requests and assembled deltas form one valid review.
- Critic mock `cannot translate audio`, `unsupported_input_modality`, failed status, and `heard_audio:false` each produce E_CAPABILITY/3 with working route fix; 500/network produce retryable E_PROVIDER/4; malformed review produces nonretryable E_PROVIDER/4; delayed response aborts at test `timeoutMs` as E_TIMEOUT/7.
- Optional live gate exercises the one verified route against a short locally rendered clip; keep it outside default `npm test` and record heard_audio plus DSP fields without trusting model numerical guesses.


## Execution lanes (wp5 P, 2026-09-28)

Stale check against wp4 code (cb24b75): `analyzeAudio(pcm, opts)` returns `AnalysisResult` whose `.analysis` is `AnalysisJson`
(src/analyze/analyze.tool.ts:117), `renderSong(song, path, options)` defaults to peak mastering or `"lufs"` when targetLufs is set
(src/render/render.tool.ts), `discoverFfmpeg`/`encodeAudio` exist (src/probe/index.ts), `CommandSpec`/`CommandResult.text`
(src/cli/registry.ts). No row needs amendment. Addition: recipe.schema.ts also exports `RECIPE_IDS` (the seven ids, sorted) so lint can
recognise genres without importing card data.

| Lane | Write scope (exclusive) | Starts after |
|---|---|---|
| W0 | main: src/recipes/recipe.schema.ts (interfaces + RECIPE_IDS) | — |
| RA | src/recipes/cards/{drill_uk,drill_ny,trap,boom_bap}.ts | W0 |
| RB | src/recipes/cards/{lofi_hiphop,house,techno}.ts | W0 |
| LT | src/recipes/lint.tool.ts + lint.test.ts (split rule helpers into src/recipes/lint-rules.tool.ts + test if large), examples/wrong-genre.song.json, src/cli/commands/lint.ts + lint.test.ts | W0 |
| CR | src/critic/** (critic.tool.ts + test, index.ts), src/cli/commands/critique.ts + critique.test.ts | W0 |
| NW | src/recipes/recipes.tool.ts + test, src/recipes/new.tool.ts + test, src/recipes/index.ts, src/cli/commands/{recipes,new}.ts + tests | RA, RB, LT (index.ts exports lintSong) |
| L9 | main: registry list (handoff as each command file lands), args.ts duplicate-flag check, src/index.ts, main.test.ts cases, str_func (delegated), acceptance | all |
