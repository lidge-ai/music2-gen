# 000 — Candidate snippets: human audition and pick (proposal)

**Summary.** The agent keeps doing the base composition. When a person reacts ("make the bell bouncier", "bar 17 feels empty"), the agent writes 2–4 candidate edits for a narrow target, music2 renders each one as a short snippet with a piano roll, and the person listens, picks one, and optionally comments. The pick is written back as data the agent applies. This gives music2 the one thing an agent lacks, human hearing, without building a DAW.

Status: proposal on branch `dev`; not an approved plan.

## Why this and not a small DAW

| Option | Fit |
|---|---|
| Real-time DAW (browser engine, mixer, note editing) | Poor. Needs a second DSP engine that breaks the byte-identical render promise, creates two writers for song JSON, and fights mini-notation as the source. The roadmap and DAW-bridge units list GUI, browser/Web Audio runtime and real-time playback as non-goals, and `export als/dawproject/midi` already hands off to real DAWs. |
| Candidate audition (this proposal) | Good. Uses the existing offline renderer, keeps song JSON as the single source written by the agent, and the human only listens and chooses. |

## Feasibility evidence (2026-09-29, Node 24, macOS arm64)

| Measurement | Result |
|---|---|
| `render` full drill example, 16 bars / 29 s | 1.4 s |
| `render --bars 8:12`, 4 bars | 0.5 s |
| `render` 120-bar hard-trance song, 5089 events | 20.9 s |
| `render --bars 32:40` on the same song, 8 bars | 2.5 s |
| 4 candidates (render + mp3 + analyze + piano roll), parallel | 4.8 s total |

The prototype `evidence/make-candidates.mjs` rewrites one track pattern in one section four ways, and every candidate passed `lint`. Two gaps showed up:

1. **Piano-roll pitch range is auto-scaled per image**, so candidates do not line up when viewed side by side.
2. **The changed track is not highlighted**; the eye has to find the bell among pad, 808 and drums.

## Proposed flow

1. Human: "the hook bell needs more bounce".
2. Agent writes `candidates.json`: base song, target (`track`, `section` or `bars`), the request text, and N candidates, each a small patch (track pattern/notes, section override, gain).
3. `music2 candidates render candidates.json` renders every candidate with the same seed, adds one bar of context before the target, matches loudness across candidates so a louder take does not win by default, and writes a snippet (wav/mp3), a solo stem of the target track, and a piano roll with a shared pitch range and the target track highlighted.
4. Audition surface:
   - Phase 1: the agent shows the snippets and piano rolls inline in the Codex chat (audio and images already render there); the person answers "2" or "2, but less high".
   - Phase 2: `music2 audition candidates.json` serves a local zero-dependency page (`node:http`) with synced A/B switching at the same playhead, loop, solo target, pick and comment.
5. The pick is written to `choice.json` (`{ picked, comment }`); `music2 candidates apply` patches the base song, and the agent keeps working from there.

## Contracts to keep

- Song JSON stays the only source; candidates are patches against a base with a recorded digest, and `apply` refuses a base that changed since render.
- Deterministic: same seed, `src/shared/prng.tool.ts` for any generated variants, no `Math.random`/`Date` in pattern or audio logic.
- Zero runtime dependencies; the audition page is optional and never required by `render`.
- `--json` prints one object; errors use the existing exit codes.

## Open questions

- Should music2 also generate mechanical variants itself (seed, degrade, octave, rhythmic shift), or leave all candidate writing to the agent?
- Loop songs cannot be cropped with `--bars`; candidates on a loop song need a whole-loop render or a crop mode for audition only.
- Where the pick history lives: next to the song in `~/.music2/projects/<name>/candidates/` is the natural place, and it doubles as a record of the person's taste for later sessions.

## Phases

| Phase | Builds | Proves |
|---|---|---|
| 010 | candidate set schema, `candidates render`, shared-range and focus-track piano roll, loudness match | fixture set renders deterministically; pitch range shared |
| 020 | `choice.json`, `candidates apply`, digest guard, skill guidance for the chat loop | apply round-trip; stale base rejected |
| 030 | `music2 audition` local page with synced A/B | manual listening check |
