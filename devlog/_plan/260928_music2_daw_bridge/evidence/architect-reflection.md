# 260928 music2 DAW bridge: architect reflection

Scope: read-only comparison of `000_plan.md`, `001_research_synthesis.md`, `010`–`090` and `evidence/main-decisions.md` (D1–D16) against
`evidence/architect-proposal.md` (F1–F29). This is the only file written. References use `<doc>:<line>` within this unit
directory unless a repository path is given. **Accept** means the doc follows the finding, or deviates from it with a stated reason that I agree with.
**Concern** gives the problem, evidence and a concrete fix. Severity tags: [H] blocks a phase gate or creates a cross-phase contract conflict,
[M] a real defect that a later phase will hit, [L] a hygiene or staleness issue.

## Summary of checks requested

- **Legacy byte identity:** no documented decision breaks it. Every new path is gated on field presence or an opt-in option
  (010:120, 010:182, 030:20, 040:51, 050:46, 080:37-38). Two latent risks in the proof harness are items 21 and 22.
  One existing-command behavior change unrelated to D10 digests is item 23.
- **Import cycles:** none. Three docs state import allowlists that contradict each other: song→automation, midi→automation
  and automation→fx.schema (items 13 and 14). All of these edges are acyclic, but the written rules must be reconciled before implementation.
- **Cross-phase conflicts:** the CLI file helpers have conflicting signatures (item 11). `ResolvedLane` and `XmlNode`/`serializeXml` are each defined twice
  (items 12 and 18). The automatable-parameter allowlists differ (item 13). Marker names differ (item 15). Four phases skip required `str_func` docs (item 16).
  The `selectEvents` move is both allowed and forbidden (item 17). The phase dependency table is wrong (item 20).

## Accepted findings and stated deviations

1. **Accept: F1 ticks** (010:67-80). Same five functions and PPQ; the doc adds BigInt rational rounding and explicit guards. This is a faithful refinement.
2. **Accept: F2 render boundary** (000:53, D1 main-decisions:5, 010:11, 010:182). Render never imports ProjectIR, and ticks are shared only for tick-native objects.
   This is recorded as the one change from the user brief, with the correct reason (legacy bytes).
3. **Accept: F3/F4 ProjectIR and quantization** (010:126-156). The types match F3 exactly. 010:156 separates the fraction rounding step from the swing
   rounding step, clamps float noise, and drops notes that collapse to zero length on mono tracks. Each change tightens F4 and none contradicts it.
4. **Accept: F5/F6/F8/F9/F10 Song v1 fields** (010:94-124). The doc adds three things beyond F5/F6/F8: a pitch range check after transpose,
   a `start < body beats` bound on clips, and rejection of `..`/backslash in `file`/`sfz:` references. It also adds an `E_CAPABILITY` render gate until
   wp5/wp6 (010:182). These are stated and sound. Absent-in/absent-out is preserved (010:120, vector 14 at 010:207).
5. **Accept: F28 pattern readers** (010:178-180). The lint-geometry branch and the `applyUseCase` guard follow F28, and 010:45-46 records audited non-readers.
6. **Accept: F14 CLI deviations, each with a stated reason.** These are:
   - `export ir` moved to wp2 (010:7);
   - `import midi` requires `-o` (020:170, D3);
   - `export stems` adds `--no-master` and `--bars` with `barOrigin` (030:66, 030:72);
   - `export als` adds `--bits` and rejects `--bars` (060:204);
   - `render --plugin-host`, `MUSIC2_PLUGIN_HOST` and `doctor --plugins` (080:40-42, D9/D14);
   - `slice --bpm` and new limits (040:155).

   No flag name conflicts across commands. The `--bits` default is 24 for export and 16 for `render`, and both are documented.
7. **Accept: F15 strengthened** (010:174, 030:74, 060:206). The multi-file `--force` path with backup and restore, and the rule that the manifest or `.als` commits last, improve on F15.
8. **Accept: F17 deviations** (020:3, D4). `FF 01 "music2:<instrument>"` replaces `FF 04`; D4 is the authority, so I accept it. The docs give no technical reason, and
   `FF 04` would also have worked. Exact marker alignment with a one-section fallback replaces bar rounding (020:166, override stated). SMPTE and format 2 map to `E_CAPABILITY`
   (020:86). FIFO pairing resolves the R1 conflict explicitly (020:142).
9. **Accept: F18 plus shared-channel honesty** (020:128-132). The tables match F18. `DRUM_MIX_LOSS`/`DAW_CHANNEL_MERGE` add the loss reporting that F18 lacked.
10. **Accept: F19/F20/F21/F22/F23/F24 overrides, each with a stated reason.**
    - Stems: folding happens only in export, and `render --stems` is untouched (030:60). The float additive oracle is stated (030:128).
    - Sampler: D15 replaces Hermite with windowed sinc, adds a phase vocoder and replaces my onset parameters (040:133-153). D7 makes release triggers render (040:91). Fades are 10 ms (040:153).
    - Automation: the 5 ms smoother applies only to DSP (050:101).
    - ALS: Live 12 target and authored skeleton (D12, 060:63). `--content both` mutes the MIDI tracks to avoid doubled playback (060:104).
      060:59 correctly weakens my F25 claim: deflate bytes can differ across Node/zlib versions, so only the header and a round trip are cross-platform.
    - DAWproject: STORE zip and D13 entry order (070:3, 070:130).
    - Plugins: the f32 JSON+WAV protocol (080:85, D9/D14).
    - Baseline harness: 010:57-60 and 010:186 go beyond F27 with a pristine-checkout recorder and a Linux fixture.

## Concerns

11. **[H] `src/cli/files.ts` is created three times with incompatible signatures.**
    - 010:51 and 010:167-171: `stage(final): StagedFile`, `commitNoReplace(staged: StagedFile[])`, `assertDistinct(inputs: string[], outputs)`.
    - 020:43 and 020:175-178: `stagePath(final): string`, `commitNoReplace(temporary, finalPath)`, `assertDistinct(input: string, outputs)`.
    - 030:29 says "extend it"; 040:59 and 060:38 reuse it.

    `src/cli/commands/export.ts` is marked NEW in 010:49, 020:39 and 030:27. The `export` registration is claimed in 010:54, 020:47 and 030:30.
    **Fix:** 010 is the owner, because wp2 lands first. Change 020/030 rows to MODIFY/extend and replace 020:175-178 with 010's signatures, or record
    the 020 per-file variants as thin wrappers over 010's batch API. The `export` dispatcher and registration belong to wp2 only.

12. **[H] `ResolvedLane` is defined twice.** 010:107-109 defines `ResolvedPoint`/`ResolvedLane` in `song-daw.schema.ts`. 050:79-81 defines
    `AutoPoint`/`ResolvedLane` plus `resolveLanes`/`parseTarget` in `src/automation` (050:21), and 050:26 marks `song-daw.schema.ts` as NO CHANGE while assuming
    wp2 already calls `resolveLanes`. 010's dependency rule (010:158) says `song → shared/pattern` only, so wp2 cannot call automation.
    060:5, 060:179 and 070:5 consume "wp6 `ResolvedLane`". If both barrels are re-exported from `src/index.ts`, the names collide.
    **Fix:** follow F12/F13. wp2 creates a minimal `src/automation` (`automation.schema.ts` with lane and point types, `parseTarget`, structural lane validation)
    plus `devlog/str_func/automation.md`, and `song-daw.schema.ts` imports it (`song → automation → shared`). wp6 adds `curve.tool.ts` and `cc.tool.ts`.
    Remove the duplicate types from 010:107-109, or declare them as re-exports.

13. **[H] The automatable allowlists differ between wp2 and wp6, and both phases edit the same constant.**
    - 010:39/98 (wp2, taken from F21) allow filter `cutoffHz/q/mix`, drive `amount/mix`, EQ `*GainDb`, tremolo `depth`, chorus/phaser/crush/delay `mix` and width `amount`.
    - 050:110-114 (wp6) allow only filter `cutoffHz`, EQ gains, drive `amount`, tremolo `depth`, delay `mix` and width `amount`, and give no reason for dropping the rest.
    - Voices: 010:41 opts in `pad/bass.cutoffHz`; 050:123 adds `lead.vibratoCents`.

    As written, songs using `fx.0.q` or `fx.1.mix` on chorus pass `validate`/`export ir` in wp2, then fail with `E_SCHEMA` after wp6. That narrows a published contract. 050 also
    adds rules that wp2 never implements: at most 32 lanes (050:66), and rejection of distinct `at` values that round to the same tick (050:70, vector 8 at 050:165).
    These are unowned because 050:26-27 marks the song files NO CHANGE. A related declared-rule conflict: `lanes.tool.ts` must validate the insert whitelist and
    ranges, yet claims "no import from song/render" (050:21), while the data lives in `src/render/fx/fx.schema.ts`.
    **Fix:** freeze the wp6 allowlist (050:110-113) and the three voice opt-ins in wp2's single edit of `AUTOMATABLE_INSERT_PARAMS`/`VoiceSpec.automatable`.
    Move the 32-lane cap and tick-collision rule into 010 §2 and its vectors. Either pass insert specs into `lanes.tool.ts` as a parameter or allow the declarative
    `automation → render/fx/fx.schema.ts` edge. That edge is acyclic, and `song` already has it at `src/song/song.schema.ts:4-5`.

14. **[L] Declared import allowlists need updating, though none creates a cycle.** 020:57 says `src/midi` imports only `project`, `shared` and local files. 050:48 then
    requires `from-project`/`to-song` to call `src/automation/cc.tool.ts`, which adds a `midi → automation` edge. 040:145 has `sampler` take
    `ResolvedClip`/`ResolvedAudioTrack` from `song`, a type-only `sampler → song` edge not listed in F13. Both are acyclic: `automation` imports only `shared`,
    and `song` never reaches `sampler`. **Fix:** amend 020:57 and 040's dependency sentence (040:127), and have the planned import-direction lint (F13) encode these edges.

15. **[M] Marker names differ.** 010:154 and F3 use `<section> (<occurrence>)` (`hook (1)`), and so do 060:171 and 070:145. 030:124 uses
    `<id> (<occurrence+1>)` (`hook (2)`). The stems manifest would disagree with ProjectIR, MIDI `FF 06`, ALS locators and DAWproject markers for the same song.
    **Fix:** 030 should read `ProjectIR.markers[].name` (or use the same rule) and change 030:124.

16. **[H] Missing `devlog/str_func` docs make phase gates fail.** `scripts/structure-audit.mjs:45-47` fails when any `src/<feature>` lacks
    `devlog/str_func/<feature>.md`, and `AGENTS.md:15` requires same-change doc updates. 010 creates `project.md` (010:63), 020 `midi.md` (020:50) and 080
    `plugin-host.md` (080:47). However, 030 creates `src/export` with no `export.md` (the file map at 030:17-34 omits it, yet 060:43 says "wp4 creates"). 040:61 defers
    `sampler.md`, and 050:50 defers `automation.md`, to wp10 (090:32). The `audit:structure` gates at 040:193, 050:191 and 070:165 therefore cannot pass.
    **Fix:** add NEW `devlog/str_func/export.md` plus an AGENTS index row to 030, `sampler.md` to 040 and `automation.md` to 050 (or to wp2 under item 12). Leave wp10 to finalize them only.

17. **[M] The `selectEvents` move is both forbidden and allowed.** 010:188 says "do not move `selectEvents`", while 030:15, 040:51/53, 050:15/42 and 080:38 allow a
    verbatim extraction to `src/render/select.tool.ts`. F11/F27 allowed a verbatim move. `mixer.tool.ts` is 366 lines, and wp4 capture, wp5 audio and sfz gates, wp6
    automation gates and wp9 plugin gates all add lines, so reaching 400 is likely. **Fix:** change 010:188 to "move only verbatim, as its own commit, with
    the D10 digests re-run before and after". Make the first phase that crosses about 390 lines own the move.

18. **[M] Two XML serializers exist in `src/export`.** 060:19 and 060:50-54 create `src/export/xml.tool.ts` (`XmlNode` with optional attrs and element-only children, shortest
    round-trip numbers). 070:21 and 070:68-70 create a second `XmlNode`/`serializeXml` inside `src/export/dawproject/project-xml.tool.ts` (required attrs, text
    children, six-decimal numbers). The duplicated escaping and invalid-character logic is a correctness risk, and the shared names invite collisions.
    **Fix:** have 070 reuse `export/xml.tool.ts`, extended with text children and an injected number formatter (`formatAlsNumber` or `dawNumber`). 070 should also state why it uses six decimals.
    The reason is sound, because XSD `xs:double` accepts both formats, but it is not written down. Similarly, `ExportPlan.data` is stems-specific at 030:99-104, while 060:193 uses `Omit<…,"data">`
    and 070:56-61 defines an unrelated `DawprojectPlan`. **Fix:** declare `ExportPlan<D>` once in `src/export/export.schema.ts` (F12).

19. **[M] The clip stretch bounds in the schema do not match the renderer's range.** 010:96 accepts `tempo.sourceBpm` 40..300 and `fit.sourceSeconds > 0` independently of song bpm
    and clip length. 040:137 defines `alpha = sourceBpm/bpm` (or target/source seconds) with a hard range of 0.25..4. For example, sourceBpm 300 at song bpm 40 gives alpha 7.5.
    No doc says which error that raises or on which path. **Fix:** add a wp2 cross-field check `$.audioTracks[i].clips[k].stretch` → `stretch ratio
    outside 0.25..4` (`E_SCHEMA`), computed from resolved values. 040 should keep the warning band 0.5..2.

20. **[M] The phase dependency table is incorrect.** 000:49 says "wp3, wp4, wp5 and wp6 depend only on wp2", "wp7 and wp8 consume wp3 and wp6" and
    "wp9 consumes wp3". The docs themselves state other dependencies:
    - wp6 depends on wp3's event model and wp5's audio-track mix path (050:5);
    - wp6's bus-gate fix is assigned to wp5 (050:121);
    - wp7 and wp8 also need wp4 stems and wp5 audio (060:5, 070:5);
    - wp9 needs no MIDI (080:5).

    F29 had wp6 after wp5. **Fix:** rewrite 000:49 as wp2 → {wp3, wp4} → wp5 → wp6 → {wp7, wp8}, with wp9 after wp2 (serialized last by choice).
    Related: 050:121 hands "automated send rising from static zero must open the bus gate" to wp5 integration. Instrument tracks hit the same gate
    (`src/render/mixer.tool.ts:338`, `:343`) and 030:56 conditions returns on static sends only. **Fix:** wp6 owns the bus-presence predicate
    (static send > 0 OR a send lane with max > 0) for both track kinds and for 030's return-null rule.

21. **[M] Proof harness: stdout digests include the package version.** 010:186 hashes the exact stdout bytes of `validate/events/lint --json`. Every envelope carries
    `meta:{music2: packageVersion()}` (`src/cli/output.ts:11`, `:30`), so any version bump during the unit falsely fails the byte gate. The failure is not from bytes that changed for legacy reasons.
    **Fix:** either record and assert `package.json` version unchanged at every phase, or hash `data`/`error` with `meta` removed, keeping one separate test for the envelope shape.

22. **[L] Proof harness: example enumeration.** 010:186 records "the 18 currently enumerated" examples, and 090:19 adds the top-level
    `examples/daw-notes-automation.song.json`. If `daw-legacy.test.ts` globs `examples/*.song.json`, the new song has no baseline and fails. If it iterates the
    manifest, a deleted legacy example would pass silently. **Fix:** iterate manifest keys, and assert that every manifest key still exists. New examples go in 090's own tests.

23. **[M] 080 changes plain `doctor` behavior.** 080:42 adds `plugins:{configured,probed:false}` to every `doctor --json` result, which requires reading
    `plugins.json`. 080:72 makes a malformed or unreadable existing config `E_INPUT`/`E_ACCESS`. That contradicts vector 5 (080:149, "ordinary `doctor --json` stays
    successful") and would make `doctor`, a ffmpeg check today (`src/cli/commands/doctor.ts:6-17`), fail on an unrelated file.
    **Fix:** without `--plugins`, report a config problem inside `data.plugins` (`{configured:null, error:"<code>"}`) and never throw. Only `render --allow-plugins`
    and `doctor --plugins` should fail on config errors.

24. **[M] 020's writer fixture contradicts its own ordering rule.** 020:92 requires an EOT at `max(project.lengthTicks,lastEventTick)` on every MTrk and one `FF 06` per placement.
    The fixture at 020:96-114 and vector 3 (020:209) is described as "one bar", yet ends both tracks at tick 960 and has no marker. No valid song can produce
    that ProjectIR, because the shortest section is 1 bar at numerator ≥ 2, which is ≥ 1920 ticks, and `markers` always has at least one entry (010:154).
    **Fix:** either re-derive the bytes (conductor `00 FF 06 …` marker, EOT deltas totalling 3840, recomputed chunk lengths and total size), or label the fixture as built from a hand-made
    `SmfFile` for `writeSmf` only and add a separate song→ProjectIR→SMF vector.

25. **[M] 020 rejects some valid song keys on export.** 020:92: "Unsupported key spelling fails `E_SCHEMA` at `$.key`". The Song key pattern
    `^[A-G](#|b)? (major|minor)$` (`src/song/song.schema.ts:101`) accepts spellings with no SMF `sf` value (e.g. `Fb major`, `E# minor`). A song that passed `validate` would then fail
    `export midi`. **Fix:** map enharmonics when `|sf| ≤ 7` allows it; otherwise omit `FF 59` with a `KEY_SIGNATURE_OMITTED` warning.

26. **[M] 040 misses the tapestop pre-roll path for sfz.** 040:51 updates kit resolution and the no-FX/FX mix branches. The tapestop pre-roll branch
    (`src/render/mixer.tool.ts:283-289`) still calls `kit ? renderKit : voice!.render` and expects mono. With `voice === null`, an sfz track that has `tapestop` and `--bars` throws a TypeError, surfaced as exit 1.
    **Fix:** route the pre-roll branch through `renderSampleInstrument` (stereo), or reject that combination with `E_CAPABILITY` until it is implemented. Add a vector.

27. **[L] 060's test helper ships in `dist`.** 060:33 adds `src/export/als/xml-reader.test-helper.ts`, but `tsconfig.build.json` excludes only `src/**/*.test.ts`,
    so the helper would be compiled and packaged. **Fix:** put the reader inside `xml-reader.test.ts`, place it under `tests/`, or add `src/**/*.test-helper.ts` to the build exclude list.

28. **[L] 080 bounds plugin output to ±1.** 080:112 rejects host output samples outside [-1,1] with `E_RENDER`. music2 pre-fader track buffers can legitimately exceed 1
    (inserts, drive, summed voices), and gain or saturation plugins may too. The master stage limits later (`src/render/mixer.tool.ts:201-246`). **Fix:** require finite values and
    a generous bound (e.g. |x| ≤ 64), and warn on values above 1.

29. **[L] Staleness and provenance.** 000:30 and 090:3 cite "D1–D15", but D16 exists (main-decisions:20). 070:33 and 070:169 still list the XSD commit and hash as open,
    though D16 pins commit `ee4dcdde…` and three SHA-256 values. 070:73 attributes `confinedRealpath` to wp2, but 040:39 creates it in wp5. 010's file map has no
    `src/shared/paths.tool.ts` row. **Fix:** update those citations. 070 should cite the D16 hashes and the planned hash-assertion test.

30. **[L] Dropped item, with no conflict.** My Q10 (`--straight` to drop swing ticks on export) and Q1 (section-relative notes) are not addressed anywhere. Both were open questions, so dropping them is acceptable.
    090's docs (090:27) should state that note lists are arrangement-absolute and that swung patterns carry quantization warnings in exports. 090:40 and 090:66 partly cover this.

## Reflection verdict

The decade docs keep every structural decision from F1–F29: the render/ProjectIR split, absent-in/absent-out optional fields, the separate
`audioTracks` array, gated render integration, acyclic feature folders, no-replace CLI writes and the digest-based legacy proof. The research-backed overrides are stated
and I accept them (D4, D7, D12–D16). No decision breaks legacy byte identity, and no import cycle exists.

The docs do contain cross-phase contract conflicts that will cause failures or rework if implemented as written: `cli/files.ts` signatures (11), `ResolvedLane` ownership (12),
the automation allowlists and unowned lane rules (13), and `str_func` docs that break `audit:structure` (16). They also have correctness gaps: marker names (15), stretch bounds (19),
the dependency table and bus gate (20), the harness version stamp (21), the MIDI fixture and key handling (24, 25) and the sfz tapestop pre-roll (26). All are fixable by
editing the docs before wp2 starts.

reflection verdict: aligned-with-concerns
