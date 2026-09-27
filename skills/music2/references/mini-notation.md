# Mini-notation: one bar at a time

music2 implements a clean-room subset of mini-notation, not full Strudel compatibility. A pattern cycle is one song bar. Spaces sequence steps evenly; `[ ]` divides a single parent step; `~` occupies a step with no event. Nesting is limited to 32 groups, and a pattern to 4,000 characters. Use `node bin/music2.js events <song.json> --json` to see the timed result.

| Pattern | Onsets within bar 0 |
| --- | --- |
| `bd sd` | `bd` at 0; `sd` at 1/2. |
| `bd ~ sd` | `bd` at 0; `sd` at 2/3. |
| `bd [hh hh] sd` | `bd` at 0; hats at 1/3 and 1/2; `sd` at 2/3. |
| `[bd sd,hh hh hh hh]` | Kick at 0, snare at 1/2, and hats at 0, 1/4, 1/2, 3/4. |
| `<bd sd>` | `bd` fills bar 0; `sd` fills bar 1; then alternates. |
| `c4,eb4,g4` | Three note onsets together at 0. |

`,` has the lowest precedence: it splits the whole group into parallel branches that each span the full group. At the top level `d4,f4 a4` therefore means `d4` held for the whole bar, stacked with `f4 a4`. To play a chord as one step inside a line, bracket it: `~ [d4,f4,a4] ~ a4`. Check note lengths with `events` (`duration`). `|` chooses one branch deterministically from the song seed. `[bd|sd] hh` chooses kick or snare in the first half, then a hat in the second. Do not mix `,` and `|` inside one group. `< >` alternates its items across bars. Grouping and suffixes work on the immediately preceding atom or group.

| Suffix | Effect | Bounds |
| --- | --- | --- |
| `*n` | Repeat within the same span: `hh*2` hits at 0 and 1/2. | Integer `n` from 1 to 64. |
| `/n` | Slow across `n` spans: `[bd sd]/2` puts kick in bar 0 and snare in bar 1. | Integer `n` from 1 to 64. |
| `(k,n,r)` | Euclidean pulses: `bd(3,8)` hits at 0, 3/8, 3/4; optional `r` rotates left. | `0 <= k <= n <= 64`; `r` defaults to 0 and is 0–64. |
| `?p` | Remove an onset with probability `p`; `?` means 0.5, `?0` keeps, `?1` removes. | Decimal `p` from 0 to 1. |
| `@n` | Weight one step: `bd@2 sd` gives spans 0–2/3 and 2/3–1. | Integer `n` from 1 to 64. |
| `!n` | Copy a parent step: `bd!2 sd` hits at 0, 1/3, and 2/3. Bare `!` means 2. | Each count 1–64; at most 20,000 expanded copies. |

Allowed suffix order is **one speed** (`*n` or `/n`), then Euclidean `(k,n,r)`, then probability `?p`, then weight `@n`, then zero or more copies `!n`. Omit stages you do not need. Repeating a stage or moving backward in this order is rejected; for example `bd*2/2` fails. Decimal speed factors, `{ }` polymeter, a mixed `,`/`|` group, empty groups, and malformed brackets are rejected with an offset. Validated note tracks use explicit-octave names such as `c4`, `eb3`, `f#2`, or integer MIDI pitches 0–127. Bare `c` is invalid. Drum tracks use sample names such as `bd:3`; the zero-based variant is optional (`sd` means `sd:0`). Numeric patterns are also used for a track's `velocity`; velocity values must be 0–1 at onsets.

Seeded `?` and `|` choices are deterministic for a fixed song seed, track, section, and bar. Their result can vary across bars; inspect `events` rather than assuming every bar repeats identically.
