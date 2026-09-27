# 004 — Mini-notation clean-room specification

Source: read-only research subagent (gpt-6-sol, handle 01a0e37e-3917-7e53-9a91-2e262d4c7821, 2026-09-28) working from public
documentation only (strudel.cc learn pages, tidalcycles.org reference). No Strudel or Tidal source code was read.
music2 implements this spec under MIT; the event lists below are the v0.1 conformance tests (see 010).

Main dispositions: v0.1 implements sequence, rest, subdivision, alternation, comma stacks, `*n`, `/n`, `!n`,
`@n`, note names with **explicit octave required**, numbers, and `name:index`. Euclid `(k,n,r)` and seeded
`?p` / `|` are promoted into v0.1 because trap and drill hat/perc programming uses them (010 covers them with
the Bjorklund rule and the seed-address rule stated below). Polymeter `{ }` stays deferred. Mixed suffix
combinations outside the tested list are rejected with a location-bearing parse error.

---


This specification is derived from public documentation only. Event lists below are **expected behavior for a new `music2` implementation**, not a claim that undocumented Strudel edge cases behave identically. No Strudel or Tidal source code was consulted.

An event is written `value@[begin,end)`, using rational fractions of a cycle. All lists are for cycle 0. Unless a cycle 1 list is shown, cycle 1 repeats the same local spans with 1 added to each absolute time. Rests produce no event. A renderer may shorten a sound’s audible duration, but pattern spans remain as listed. One cycle may represent one bar; tempo conversion belongs outside this parser.

| Syntax | Meaning | v0.1 | Public documentation |
|---|---|---|---|
| spaces, `[ ]`, `~` | sequence, subdivision, rest | Yes | [Strudel mini-notation](https://strudel.cc/learn/mini-notation/) |
| `< >` | alternate by cycle | Yes | [Strudel mini-notation](https://strudel.cc/learn/mini-notation/) |
| `,` | parallel patterns or chord tones | Yes | [Strudel mini-notation](https://strudel.cc/learn/mini-notation/) |
| `*n`, `/n` | speed up, slow down | Yes | [Strudel mini-notation](https://strudel.cc/learn/mini-notation/) |
| `!n`, `@n` | replicate steps, weight a step | Yes | [Strudel mini-notation](https://strudel.cc/learn/mini-notation/), [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/) |
| `{ }`, `{ }%n` | polymeter | Later | [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/), [Strudel pattern constructors](https://strudel.cc/learn/factories/) |
| `(k,n,r)` | Euclidean rhythm | Later | [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/), [Strudel mini-notation](https://strudel.cc/learn/mini-notation/) |
| `\|`, `?p` | random choice, event removal | Later | [Strudel mini-notation](https://strudel.cc/learn/mini-notation/) |
| `c4`, `eb3`, `f#2`, numbers | note values | Yes | [Strudel notes](https://strudel.cc/learn/notes/), [Tidal course](https://tidalcycles.org/docs/patternlib/tutorials/course2/) |
| `bd:3` | sample name and zero-based variant | Yes | [Strudel samples](https://strudel.cc/learn/samples/), [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/) |

## Timing and grouping

A space-separated sequence shares one cycle equally. A bracketed sequence occupies **one step of its parent**, then divides that step equally among its children. `~` consumes its full step without emitting an event. These rules recurse. [Strudel mini-notation](https://strudel.cc/learn/mini-notation/)

- `bd sd` → `bd@[0,1/2), sd@[1/2,1)`.
- `bd ~ sd` → `bd@[0,1/3), sd@[2/3,1)`.
- `bd [hh hh] sd` → `bd@[0,1/3), hh@[1/3,1/2), hh@[1/2,2/3), sd@[2/3,1)`.
- `[bd [~ hh]]` → `bd@[0,1/2), hh@[3/4,1)`.

`<a b>` selects `a` for cycle 0 and `b` for cycle 1; each selected item fills its cycle. A selected bracketed sequence divides that cycle. [Strudel mini-notation](https://strudel.cc/learn/mini-notation/), [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/)

- `<bd sd>` → cycle 0 `bd@[0,1)`; cycle 1 `sd@[1,2)`.
- `<[bd ~] [~ sd]>` → cycle 0 `bd@[0,1/2)`; cycle 1 `sd@[3/2,2)`.

A comma stacks its branches in the same span. Thus `c4,eb4,g4` is three simultaneous events; branches may have distinct subdivisions. Brackets are useful when a stacked group must occupy one step in a surrounding sequence. [Strudel mini-notation](https://strudel.cc/learn/mini-notation/), [Strudel pattern constructors](https://strudel.cc/learn/factories/)

- `c4,eb4,g4` → `c4@[0,1), eb4@[0,1), g4@[0,1)`.
- `[bd sd,hh hh hh hh]` → `bd@[0,1/2), sd@[1/2,1), hh@[0,1/4), hh@[1/4,1/2), hh@[1/2,3/4), hh@[3/4,1)`.

## Time modifiers

`*n` fits `n` repetitions into the operand’s allotted span. `/n` stretches the operand over `n` times its span, so a multi-step pattern can cross cycle boundaries. Require positive integers in v0.1; the Strudel page also documents decimal factors, which can follow later. [Strudel mini-notation](https://strudel.cc/learn/mini-notation/)

- `hh*2` → `hh@[0,1/2), hh@[1/2,1)`.
- `[bd sd]*2` → `bd@[0,1/4), sd@[1/4,1/2), bd@[1/2,3/4), sd@[3/4,1)`.
- `[bd sd]/2` → cycle 0 `bd@[0,1)`; cycle 1 `sd@[1,2)`.
- `[bd sd]/4` → cycle 0 `bd@[0,2)` **begins**; cycle 1 has no new onset. A span query must preserve the event’s end beyond the queried cycle.

`!n` creates `n` consecutive copies **at the parent sequence level**; it changes that sequence’s step count. `@n` instead gives one child weight `n` relative to its siblings. Their different treatment of a following event is essential. [Strudel mini-notation](https://strudel.cc/learn/mini-notation/), [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/)

- `bd!2 sd` → `bd@[0,1/3), bd@[1/3,2/3), sd@[2/3,1)`.
- `bd!3 sd` → `bd@[0,1/4), bd@[1/4,1/2), bd@[1/2,3/4), sd@[3/4,1)`.
- `bd@2 sd` → `bd@[0,2/3), sd@[2/3,1)`.
- `bd sd@3` → `bd@[0,1/4), sd@[1/4,1)`.

## Deferred rhythm operators

**Polymeter needs an explicit compatibility decision.** Tidal’s `{bd bd bd bd, cp cp hh}` example uses the first branch’s four steps as the cycle and wraps the second branch. Strudel’s pattern-constructor page describes fitting both branches into a least-common-multiple step count. Those descriptions do not settle one shared default. Defer `{ }` in v0.1; if choosing the **Tidal-style first-branch clock**, the proposed tests are: [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/), [Strudel pattern constructors](https://strudel.cc/learn/factories/)

- `{a b c,d e}` → cycle 0: `a@[0,1/3), b@[1/3,2/3), c@[2/3,1)` and `d@[0,1/3), e@[1/3,2/3), d@[2/3,1)`; cycle 1’s second branch is `e,d,e` in thirds.
- `{a b c,d e}%4` → four equal steps per cycle: cycle 0 branches `a,b,c,a` and `d,e,d,e`; cycle 1 branches `b,c,a,b` and `d,e,d,e`. `%4` specifies the step count; branch positions keep advancing.

`x(k,n,r)` distributes `k` onsets among `n` equal slots of the operand span. `r` is optional and rotates the slot pattern **left** by `r` slots. Tidal publishes the exact `3/8` placement below; use it as the conformance anchor. Bounds, negative offsets, and Euclidean grouping for other `(k,n)` pairs need a separately documented `music2` rule. [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/), [Strudel mini-notation](https://strudel.cc/learn/mini-notation/)

- `bd(3,8)` → `bd@[0,1/8), bd@[3/8,1/2), bd@[3/4,7/8)`.
- `bd(3,8,1)` → `bd@[1/4,3/8), bd@[5/8,3/4), bd@[7/8,1)`.
- `bd(3,8,2)` → `bd@[1/8,1/4), bd@[1/2,5/8), bd@[3/4,7/8)`.

`a|b` chooses a branch with equal probability; `x?` removes an occurrence with probability `1/2`, while `x?p` uses removal probability `p`. The docs establish probabilities, but not a portable seed or PRNG. For offline rendering, specify a song seed and derive each decision from the seed, operator position, and absolute cycle/step address. Querying cycle 1 alone must then match querying cycles 0–1 together. This is a **`music2` design rule**, not documented Strudel parity. [Strudel mini-notation](https://strudel.cc/learn/mini-notation/), [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/)

- `bd?0 sd` → `bd@[0,1/2), sd@[1/2,1)`.
- `bd?1 sd` → `sd@[1/2,1)`.
- `bd|sd` → exactly **one** of `bd@[0,1)` or `sd@[0,1)` per cycle.
- `[bd|sd] hh` → exactly one of `bd@[0,1/2)` or `sd@[0,1/2)`, plus `hh@[1/2,1)`.

## Values, nesting, and parser boundary

Timing syntax is independent of value interpretation. In a note track, `c4=60`, `eb3=51`, and `f#2=42` under MIDI pitch numbering; `60` and `60.5` denote MIDI pitch values. In a sample track, `bd:3` denotes sample name `bd`, zero-based variant `3`; the sample library decides whether an out-of-range index wraps. Bare `c` has **no documented Strudel `note()` default octave on the cited notes page**. Tidal documents octave 5. For v0.1, require an explicit octave on note names, or declare a `music2` default separately rather than silently assuming Strudel parity. [Strudel notes](https://strudel.cc/learn/notes/), [Strudel samples](https://strudel.cc/learn/samples/), [Tidal course](https://tidalcycles.org/docs/patternlib/tutorials/course2/)

- Note track `c4 eb3 f#2` → `60@[0,1/3), 51@[1/3,2/3), 42@[2/3,1)`.
- Note track `60 60.5` → `60@[0,1/2), 60.5@[1/2,1)`.
- Sample track `bd:3 sd` → `bd:3@[0,1/2), sd:0@[1/2,1)`; `sd:0` is the resolved default variant.

Parse balanced `[ ]`, `< >`, and, later, `{ }` as grouped expressions. Parse note accidentals and sample `:index` within atoms. Apply a suffix to the immediately preceding atom or group; comma separates parallel branches, and spaces separate steps within a branch. This yields a useful v0.1 nesting test: `[bd [hh hh]]*2` → `bd@[0,1/4), hh@[1/4,3/8), hh@[3/8,1/2), bd@[1/2,3/4), hh@[3/4,7/8), hh@[7/8,1)`. Another is `[c4,eb4] sd` → both notes `@[0,1/2)`, then `sd@[1/2,1)`.

The public pages give examples, but no complete precedence grammar for **mixed suffixes** such as `bd*2?`, nested random choices, or `/n` inside weighted sequences. For v0.1, reject combinations whose parse is not specified here with a location-bearing error. Add each combination only alongside an explicit event-list test. [Strudel mini-notation](https://strudel.cc/learn/mini-notation/), [Tidal reference](https://tidalcycles.org/docs/reference/mini_notation/)
