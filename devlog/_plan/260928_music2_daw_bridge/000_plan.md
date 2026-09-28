# 000 — DAW bridge: project exchange, sampling and automation (master plan)

**Summary.** music2 can write, render, analyze and lint a song, but the result stops at a WAV. A producer who wants to finish the track in FL Studio, Ableton Live, Bitwig, Studio One or Cubase has to rebuild it by hand, and music2 cannot use recorded audio, sample libraries or automation. This unit adds a tick-based project model shared by every exporter, backward-compatible song fields for note lists, audio-clip tracks, automation lanes and SFZ instruments, MIDI import and export, a stem bundle with bus returns and a manifest, a pure-TypeScript sampler with pitch shifting, time stretching and slicing, Ableton `.als` and DAWproject exports, and an optional external plugin bridge. Songs that use none of it render byte-identically.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | Satisfy-spec, multi-cycle HOTL (cxc-loop), one PABCD per work-phase wp1..wp10 |
| Trigger | User request 2026-09-28: build the DAW-bridge roadmap to completion with cxc-loop; research with Aside and official documentation because the agent cannot hear; unlimited gpt-6-sol lanes; inherited-model agents for design and exploration |
| Goal | All ten work-phases implemented with tests, docs, skill guidance and examples; criteria c-1..c-11 met with fresh evidence |
| Non-goals | Real-time playback, GUI, vocal generation, writing FL `.flp`, bundling third-party audio or plug-ins, runtime dependencies, npm publish, tags, releases |
| Verifier | typecheck, lint, test, build, audit:structure, docs:genres:check, privacy:scan; per-phase oracle tests; xmllint against the official DAWproject XSD; SMF byte fixtures; hosted CI only if push is authorized |
| Stop condition | Criteria met with fresh evidence, or an exact BLOCKED / NEEDS_HUMAN record |
| Memory artifact | This unit and the goalplan `.codexclaw/goalplans/extend-lidge-ai-music2-gen-music2-cli-repo-users/` in the session's native directory (outside the repository) |
| Terminal outcomes | DONE; BLOCKED (push or access denied); NEEDS_HUMAN (Live-open confirmation, installs); UNSAFE (private data in a push range) |
| Escalation | A breaking Song v1 change, a runtime dependency, reading or copying GPL/AGPL/LGPL source, vendoring Ableton-owned content |

HOTL bounds: the user granted unlimited time and tokens, unlimited sol lanes, inherited-model exploration and Aside research. Write scope is this repository, scratch under `/tmp/music2-daw`, and the Aside artifact directory `music2-daw-bridge-260928`. Push, package installation and DAW use are not granted by HOTL; the user was asked about push and a pedalboard venv.

## Research

| Track | Output |
|---|---|
| Aside R1: SMF 1.0, DAW MIDI import, CC conventions, automation semantics, stem conventions | evidence/aside-notes/R1_midi_automation_stems.md |
| Aside R2: SFZ format, player support, free libraries, SF2 | evidence/aside-notes/R2_sfz.md |
| Aside R3: Ableton `.als` structure from permissively licensed files, DAWproject container, XSD and support | evidence/aside-notes/R3_als_dawproject.md |
| Aside R4: resampling, time-scale modification, onset detection and slicing, warping, pedalboard | evidence/aside-notes/R4_dsp_bridge.md |
| Inherited-model architect: code map, contracts, compatibility | evidence/architect-proposal.md (F1–F29) |
| Main | evidence/main-decisions.md (D1–D16, binding), 001_research_synthesis.md |

No GPL, AGPL or LGPL source code is read or copied. The research agents cited DawVert, pedalboard, DawDreamer and Rubber Band by their documentation only. The MIT TSM Toolbox and the MIT DAWproject reference library were read.

## Work-phase map (dependency order)

| Work-phase | Doc | Depends on | Builds | Proves |
|---|---|---|---|---|
| wp1 | 000–001, evidence/, 010–090 | — | research synthesis and diff-level roadmap | audited docs |
| wp2 | 010_project_ir.md | wp1 | ticks, song extensions, list-note timeline, ProjectIR, `export ir`, legacy baseline harness | c-2 |
| wp3 | 020_midi.md | wp2 | SMF writer and reader, GM map, `export midi`, `import midi` | c-3 |
| wp4 | 030_stems_bundle.md | wp3 | bus-return capture, stem bundle and manifest, `export stems` | c-4 |
| wp5 | 040_sampler.md | wp4 | SFZ instruments, audio-clip tracks, resampling, time stretch, onsets, `slice` | c-5 |
| wp6 | 050_automation.md | wp3 MIDI CC event model; wp4 return capture; wp5 audio-track mixing path | automation lanes, curves, automated mixing, CC mapping | c-6 |
| wp7 | 060_ableton_als.md | wp3, wp4, wp5, wp6 | authored Live 12 skeleton, `.als` writer, round-trip reader | c-7 |
| wp8 | 070_dawproject.md | wp3, wp4, wp5, wp6 | DAWproject writer, STORE zip, XSD validation | c-8 |
| wp9 | 080_plugin_bridge.md | wp2 contract; serialized after wp8 | subprocess contract, stub host, `render --allow-plugins`, doctor | c-9 |
| wp10 | 090_examples_release.md | wp9 | examples, docs, skill, final gates, archive, conditional push | c-1, c-10, c-11 |

Contract dependencies are wp2 → {wp3, wp4} → wp5 → wp6 → {wp7, wp8}; wp9 needs wp2 but is serialized after wp8 by choice. Execution order is strictly wp2→wp3→wp4→wp5→wp6→wp7→wp8→wp9→wp10, one PABCD cycle per phase. The later phases consume earlier contracts even where their core algorithms could be planned in parallel.

## Architect consultation

Architect F1–F29 are accepted as recorded in evidence/main-decisions.md D1. The one change from the brief is F2: render does not consume ProjectIR, because re-timing swung or tuplet pattern events on a 960-PPQ grid would change legacy bytes. Ticks are shared only by the new tick-native objects.

## Audit log

| Round | Reviewer | Verdict | Findings and disposition |
|---|---|---|---|
| 1 | two independent sol auditors (read-only) + same-architect reflection | FAIL, FAIL; reflection aligned-with-concerns | 5 BLOCKER, 9 MAJOR, 3 MINOR (phase dependencies, MIDI EOT fixture, export/files ownership, automation list, CC lanes, manifest symlink, SFZ control scope, plugin export opt-in, host output bound, DAWproject EOF clips, XSD pin, bridge packaging) and 20 reflection concerns (ResolvedLane owner, import table, str_func per phase, marker names, selectEvents move, shared XML serializer, stretch ratio, key signatures, sfz+tapestop, digest normalization, doctor) → all fixed. |
| 2 | two independent sol auditors | FAIL, FAIL | 7 MAJOR, 1 MINOR (resolved start ticks, usecase guard, MIDI automation omission warnings, CC clamping, slice snippet per bar, smpl pitchFraction and rt_decay, source sample rates, rounding vector) → all fixed. |
| 3 | independent sol auditor, whole unit | FAIL | 2 MAJOR (zero-tick clips, SFZ decay oracle time), 1 MINOR (ALS id wording) → fixed. |
| 4 | independent sol auditor, confirmation | NEAR-PASS | 1 residual (release oracle omitted the 0.5 sustain factor) → fixed after verdict: `0.5·exp(−8)=0.00016773`. |

## Attestation log

| Edge | Work-phase | Evidence |
|---|---|---|
