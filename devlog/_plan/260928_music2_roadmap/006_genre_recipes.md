# 006 — Genre recipe research

Source: read-only research subagent (gpt-6-sol, handle 01a0e37e-4500-74e1-81b2-f309b1e78e49, 2026-09-28). Patterns are original starter
examples in mini-notation (16 steps per bar; steps 1/5/9/13 are beats 1–4). Numbers are defaults, not definitions.

Main dispositions for 050: every genre becomes a card in `src/recipes/cards/<id>.ts` with the fields listed in
003 D12. Lint checks map to rules with ids `<genre>/<n>`; all genre rules are **warnings**, while schema, parse,
range and clipping problems are **errors**. `music2 lint --strict` turns warnings into a failing exit (6), which is
how the "deliberately wrong-genre song fails" criterion is proven. Rules needing data v1 does not carry (chord
symbols, explicit swing per event) are dropped in v0.1 or computed from events (e.g. "808 pitch transition" =
consecutive 808 onsets with different MIDI notes). Sections carry an optional `role` tag
(`intro|hook|verse|breakdown|build|outro|groove`) so lint can scope core-grid rules to full-drum sections.
Swing: song-level `swing` (0.5–0.75, default 0.5) plus per-track `swing: true|false` applies to 16th off-steps.

---

The patterns below are **one 4/4 bar on a 16-step grid**: steps 1, 5, 9, and 13 are beats 1–4. Each quoted string is a separate track; `~` is a rest, and a bracket subdivides one step. Swing percentages mean the position of the second note in a pair: **50% is straight**. BPM ranges, arrangements, and lint thresholds are useful defaults, not genre definitions. The patterns are original starter examples derived from the cited conventions.

For every genre, a **Spotify-oriented streaming master** can start around **−14 integrated LUFS and below −1 dB true peak**. That is Spotify’s playback and mastering guidance, not a requirement that every release be mastered to exactly −14 LUFS. If mastering louder, Spotify advises a true peak below −2 dB. Keep kick and bass from masking each other through sound choice, envelope length, or ducking. [Spotify](https://support.spotify.com/mx-en/artists/article/loudness-normalization/), [iZotope](https://www.izotope.com/community/blog/how-to-mix-808s)

### `drill_uk`

- **Tempo/feel:** 138–145 BPM; start at **140**. Half-time backbeat, mostly straight timing (50–53%); create bounce with syncopation and hat velocity.
- **Drum grid:** Short, sparse kicks; main snare/clap on step 9 (beat 3), with occasional ghosts. Closed hats favor a 3+3+2 accent cycle; sparse rim, shaker, open-hat, or triangle replies.
- **One-bar patterns:** kick `"bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~"`; snare `"~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~"`; hat `"hh ~ ~ hh ~ ~ hh ~ hh ~ ~ hh ~ ~ hh ~"`.
- **Rolls/bass:** Add a quiet triplet or 32nd hat burst before beat 3 or at a bar turnaround, for example by replacing one `hh` with `[hh hh hh]`. Tune a monophonic 808 to the harmony; sustain roots, answer the kick, and glide selectively into a fifth or octave. Keep the kick transient clear.
- **Harmony/palette:** C minor or C Phrygian starters: **i–♭VI–♭VII** = Cm–A♭–B♭; **i–♭II** = Cm–D♭. Dark, sparse piano or bell around C4–C6, low strings/pad around C3–C5; leave vocal space.
- **Arrangement:** 4-bar filtered intro → 8-bar hook → 16-bar verse → 8-bar hook → 16-bar verse → 8-bar hook → 4-bar outro. Drop bass or drums briefly at section edges.
- **Mix/lint:** Streaming target above; center the sub and keep melodic low mids clear. Advisory checks: (1) BPM 138–145; (2) main snare on step 9 in ≥75% of full-drum bars; (3) kick present in ≥75% of full-drum bars; (4) at least one subdivided hat event per 2 full-drum bars; (5) 808 mostly monophonic; (6) ≥1 intentional 808 pitch transition per 8 full-drum bars; (7) pitched notes belong to the declared scale except flagged chromatic approaches.
- **Sources:** [Attack Magazine’s UK drill breakdown](https://www.attackmagazine.com/technique/beat-dissected/uk-drill/), [Attack’s 144 BPM drill example](https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24/), [Splice drum-pattern guide](https://splice.com/blog/drum-patterns-different-genres/). The exact swing range and arrangement are proposed defaults.

### `drill_ny` — Brooklyn

- **Tempo/feel:** 138–145 BPM; start at **142**. Half-time, generally straight (50–53%). Brooklyn drill shares substantial production DNA with UK drill; there is **no reliable, exclusive Brooklyn drum grid**.
- **Drum grid:** Beat-3 clap/snare, syncopated heavy kick, bouncing hats; layer a rim or percussive reply more boldly than in the sparse UK starter.
- **One-bar patterns:** kick `"bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"`; clap `"~ ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~"`; hat `"hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~"`.
- **Rolls/bass:** Place short triplet/32nd flourishes before the clap or at the last step of a 2-bar phrase; avoid constant rolls. Make the tuned, monophonic 808 a prominent melodic hook, with occasional octave slides and kick-aligned attacks.
- **Harmony/palette:** F minor starters: **i–♭VI** = Fm–D♭; **i–♭VII–♭VI** = Fm–E♭–D♭. Menacing piano, brass/choir stab, bell, or a licensed/self-made chopped melodic loop around C4–C6; bass around F1–F3.
- **Arrangement:** 4-bar motif intro → 8-bar hook → 16-bar verse → 8-bar hook → 16-bar verse → 8-bar hook → 4-bar outro.
- **Mix/lint:** Streaming target above; make the 808 audible on small speakers with controlled harmonics while retaining kick attack. Advisory checks: (1) BPM 138–145; (2) beat-3 clap/snare in ≥75% of full-drum bars; (3) kick and 808 both appear in hook; (4) 808 monophonic; (5) ≥1 slide or octave move per 8 hook bars; (6) one identifiable repeated melodic motif per hook; (7) phrase-level drum or melody change at least every 8 bars.
- **Sources:** [Complex on Brooklyn drill and 808 Melo](https://www.complex.com/music/brooklyn-drill-the-new-sound-of-new-york/), [DJ Mag on the London–Brooklyn production link](https://djmag.com/longreads/these-are-most-exciting-uk-drill-producers-right-now), [Splice’s shared drill drum conventions](https://splice.com/blog/drum-patterns-different-genres/). The proposed motif and lint frequencies are heuristics.

### `trap`

- **Tempo/feel:** 130–170 BPM; start at **140**. Half-time snare on beat 3; straight main grid (50%) with occasional triplet feel.
- **Drum grid:** Sparse kick and snare/clap, steady eighth-note hats, open hat or rim near phrase accents. Keep room around the vocalist.
- **One-bar patterns:** kick `"bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"`; snare `"~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~"`; hat `"hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~"`.
- **Rolls/bass:** Brief triplet or 32nd hat rolls commonly lead into beat 3 or the next bar. Tune the 808 to chord roots; add passing fifths/octaves or occasional slides. Kick and 808 may coincide or interlock; avoid sustained low-frequency collisions.
- **Harmony/palette:** A minor starters: **i–♭VI–♭VII** = Am–F–G; **i–♭VII** = Am–G. Minor-key synth pad, piano, pluck, bell, or vocal chop around C4–C6; 808 around A1–A3.
- **Arrangement:** 4-bar intro → 16-bar verse → 8-bar hook → 16-bar verse → 8-bar hook → 4-bar outro; vary density by removing elements.
- **Mix/lint:** Streaming target above; short kick plus controlled 808 sub. Advisory checks: (1) BPM 130–170; (2) beat-3 snare/clap in ≥75% of full-drum bars; (3) hats in ≥75% of full-drum bars; (4) ≥1 subdivided hat event per 4 bars; (5) 808 pitched to declared key; (6) 808 monophonic; (7) hook has more or equal active layers than its adjacent verse.
- **Sources:** [Splice trap production guide](https://splice.com/blog/how-to-make-trap-beat-fl-studio/), [Splice on Atlanta trap’s 808s and triplet hats](https://splice.com/blog/the-sound-atl-trap/).

### `boom_bap`

- **Tempo/feel:** 80–100 BPM; start at **90**. Head-nod backbeat; apply moderate swing to hats and selected percussion, roughly **55–62%**, with optional small timing offsets.
- **Drum grid:** Kicks emphasize beat 1 and syncopated replies; snares on beats 2 and 4 (steps 5, 13). Eighth-note hats or a chopped break; ghost snares and shaker can add movement.
- **One-bar patterns:** kick `"bd ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~ ~ ~"`; snare `"~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~"`; hat `"hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~"`.
- **Rolls/bass:** Rolls are occasional snare/hat fills at 4- or 8-bar boundaries, not a recurring trap-style feature. Use an electric/upright-style bass or rounded synth around E1–E3; follow chord roots with short pickups that converse with the kick.
- **Harmony/palette:** C minor/jazz-color starters: **i⁷–iv⁷** = Cm7–Fm7; **iiø⁷–V⁷–i⁷** = Dø7–G7–Cm7. Chopped soul/jazz-style keys, guitar, horn, or self-made sample-like phrases around C3–C5.
- **Arrangement:** 4-bar sample intro → 16-bar verse → 8-bar hook → 16-bar verse → 8-bar hook → 4-bar outro; use mutes and sample changes.
- **Mix/lint:** Streaming target above; foreground kick/snare without covering bass notes. Advisory checks: (1) BPM 80–100; (2) snare on steps 5 and 13 in ≥75% of full-drum bars; (3) nonzero swing or timing offsets on a hat/perc track; (4) no recurring 32nd hat roll in most bars; (5) bass pitched to harmony; (6) repeated 2- or 4-bar melodic phrase; (7) at least one section-level mute or sample change.
- **Sources:** [Native Instruments boom-bap guide](https://blog.native-instruments.com/what-is-boom-bap/), [Attack Magazine boom-bap breakdown](https://www.attackmagazine.com/technique/beat-dissected/90s-boom-bap-hip-hop/).

### `lofi_hiphop`

- **Tempo/feel:** 60–90 BPM; start at **75**. Relaxed backbeat; swing hats/shaker around **56–64%** or use restrained per-track delays. Avoid applying identical timing offsets to every track.
- **Drum grid:** Soft kick, dry snare on beats 2/4, lazy offbeat hats or shaker; optional quiet rim and incidental texture.
- **One-bar patterns:** kick `"bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~"`; snare `"~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~"`; hat `"~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~"`.
- **Rolls/bass:** No required fast rolls; an occasional two-hit pickup is enough. Rounded electric/upright or soft synth bass around C2–C4 follows roots and approaches gently; avoid long, distorted 808 glides.
- **Harmony/palette:** C major/A minor starters: **ii⁷–V⁷–Imaj⁷** = Dm7–G7–Cmaj7; **vi⁷–ii⁷** = Am7–Dm7. Soft electric piano, muted guitar, gentle lead, and subtle tape/noise texture around C3–C6.
- **Arrangement:** 4-bar texture intro → 16-bar main loop → 8-bar lighter variation → 16-bar main loop → 4-bar fade/outro. A seamless loop is also valid.
- **Mix/lint:** Streaming target above, with dynamics preserved; texture must sit below the musical parts and bass must leave room for the kick. Advisory checks: (1) BPM 60–90; (2) beat-2/4 snare in ≥70% of full-drum bars; (3) swing or small track-specific offsets; (4) ≥1 seventh/extended chord if chord symbols are available; (5) repeated 2-, 4-, or 8-bar harmonic loop; (6) no 32nd hat rolls in most bars; (7) no clipping.
- **Sources:** [Native Instruments lo-fi hip-hop guide](https://blog.native-instruments.com/lo-fi-hip-hop-beats/), [Splice lo-fi beat walkthrough](https://splice.com/blog/lo-fi-beat-origin-sound/), [Splice on extended lo-fi harmony](https://splice.com/blog/lo-fi-chord-progressions/).

### `house`

- **Tempo/feel:** 120–130 BPM; start at **124**. Four-on-the-floor. Keep kick straight; apply optional **52–58%** swing to 16th hats/shakers or bass pickups.
- **Drum grid:** Kick on steps 1/5/9/13, clap/snare on 5/13, open hats on offbeat eighths (3/7/11/15); closed hats and percussion supply velocity variation.
- **One-bar patterns:** kick `"bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~"`; clap `"~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~"`; open hat `"~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~"`.
- **Rolls/bass:** No recurring triplet roll; use 16th shaker/hat pickups at phrase ends. Rounded syncopated synth/electric bass around E1–E3 plays chord roots and offbeats; shorten or duck notes under kicks.
- **Harmony/palette:** A minor/C major starters: **i–♭VI–♭III–♭VII** = Am–F–C–G; **I–vi–IV–V** = C–Am–F–G. Piano/organ stabs, pluck, strings, or vocal chops around C3–C6.
- **Arrangement:** 16-bar DJ intro → 16-bar groove → 16-bar main section → 8-bar breakdown → 16-bar return → 16-bar DJ outro. Short-form versions can halve sections.
- **Mix/lint:** Streaming target above; steady kick fundamental, bass ducked or rhythmically separated, tops bright without harshness. Advisory checks: (1) BPM 120–130; (2) four kick beats in ≥90% of full-groove bars; (3) clap/snare on beats 2/4 in ≥75%; (4) offbeat hat in ≥75%; (5) bass/chord pitches match declared harmony; (6) at least one 8-bar density change; (7) outro removes layers.
- **Sources:** [Native Instruments house guide](https://blog.native-instruments.com/house-music-101/), [Attack Magazine’s 909 house grid](https://www.attackmagazine.com/technique/beat-dissected/90s-jersey-garage-house/).

### `techno`

- **Tempo/feel:** **126–140 BPM** starter span; start at **130**. Straight, driving 4/4 (50–54%); this span covers a peak-time guide and faster classic examples, not all techno.
- **Drum grid:** Kick every beat, offbeat open hat, repeating closed-hat or ride pulse; clap/snare, tom, rim, and metallic percussion may enter gradually rather than playing throughout.
- **One-bar patterns:** kick `"bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~"`; open hat `"~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~"`; clap `"~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~"`.
- **Rolls/bass:** Hats may run straight 16ths; reserve 32nd snare/hat rolls for builds. Use a short, repeating sub/synth-bass pulse around E1–E3, tuned to the kick or separated from it by timing and envelope; 808 glides are optional, not a default.
- **Harmony/palette:** E minor starters: **i pedal** = Em throughout; **i–♭VI** = Em–C. One- or two-note acid/synth ostinato, drone, noise, metallic stab, and filter movement around E3–E6 often matter more than chord changes.
- **Arrangement:** 16-bar kick/percussion intro → 16-bar layer build → 32-bar main groove → 16-bar breakdown → 32-bar return/variation → 16-bar outro. Short-form renders may scale each block down.
- **Mix/lint:** Streaming target above; protect the kick’s low-frequency space and avoid excessive cumulative bass from kick, rumble, and synth. Advisory checks: (1) BPM 126–140 for this preset; (2) four kick beats in ≥90% of full-groove bars; (3) repeating 1- or 2-bar bass/percussion motif; (4) ≥1 new or removed layer every 8–16 bars; (5) no requirement for chord changes; (6) a breakdown has fewer active layers than the main groove; (7) no clipping.
- **Sources:** [Beatportal peak-time techno guide](https://www.beatportal.com/articles/783088-step-by-step-guide-to-producing-techno-peak-time-driving-in-the-style-of-layton-giordani-eli-brown-and-adam-beyer), [Attack’s analysis of Jeff Mills’s “The Bells”](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells/), [Attack’s percussive-techno walkthrough](https://www.attackmagazine.com/technique/beat-dissected/spastik-style-percussive-techno/).

For implementation, run lint on **queried onset events**, scoped to tagged `full-drum` or `full-groove` sections; intros and breakdowns intentionally violate core-grid defaults. Checks involving swing, pitch glide, chord symbols, or section names require those properties in the song schema. Treat all genre lint above as warnings unless it tests a declared user constraint.
