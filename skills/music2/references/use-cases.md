# Music2 by delivery use case

Choose a genre and a delivery preset separately. The planned command is `music2 new --genre <id> --use <preset> [--seconds n] [--arrangement <id>]`; `--genre` is required, and an explicit arrangement overrides the preset's recommendation ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). Presets set an authored starting structure and `master` request. Measure the rendered WAV before delivery: `targetLufs` is a request, not proof of output loudness ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

## Loudness reference (B.0)

LUFS/LKFS numbers below describe different destinations. **Official** means a platform or standards-body publication; **third-party** means an estimate or production convention, not a platform guarantee. True-peak guidance is shown as dBTP, except Apple's stated dBFS true-peak wording.

| Destination | Integrated loudness | True peak | Authority and practical behavior |
| --- | --- | --- | --- |
| Spotify music | Normal −14 LUFS; Loud −11; Quiet −19 | ≤−1 dBTP; ≤−2 dBTP if the master is louder than −14 LUFS | **Official** [Spotify](https://support.spotify.com/us/artists/article/loudness-normalization): loud tracks turn down; quiet tracks rise only while preserving peak headroom; album play uses album normalization; web player does not normalize. |
| YouTube | Rough −14 LUFS reference | Common ≤−1 dBTP guidance | **Third-party** [MeterPlugs](https://www.meterplugs.com/blog/2019/09/18/youtube-changes-loudness-reference-to-14-lufs.html), [iZotope](https://www.izotope.com/community/blog/mastering-for-streaming-platforms); reported down-only behavior is not a formal delivery target. |
| Apple Music | Rough −16 LUFS with Sound Check | Common ≤−1 dBTP guidance | **Third-party** [MeterPlugs](https://www.meterplugs.com/blog/2022/03/23/apple-switch-to-lufs.html), [iZotope](https://www.izotope.com/community/blog/mastering-for-streaming-platforms); peak headroom can limit upward gain. |
| Amazon / Tidal / Deezer | Rough −14 / −14 / −15 LUFS | Common ≤−1 dBTP guidance | **Third-party** [iZotope comparison](https://www.izotope.com/community/blog/mastering-for-streaming-platforms); check the current destination specification before delivery. |
| Apple Podcasts | −16 LKFS ±1 dB | ≤−1 dBFS true peak | **Official** [Apple Podcasts audio requirements](https://podcasters.apple.com/support/893-audio-requirements); balance music with the episode voice. |
| AES TD1008 guidance | Speech −18 LUFS dialog-gated; music track −16; album loudest track −14; interstitial −18; mixed stream −17 | ≤−1 dBTP at codec input | **Standard recommendation** [AES TD1008](https://www.aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf); use the category that matches the delivery. |
| Mono podcast | Convention: −19 LUFS mono corresponds to −16 stereo dual-mono | ≤−1 dBTP convention | **Third-party** [Auphonic](https://auphonic.com/blog/2020/06/09/loudness-normalization-mono-productions); the 3 LU offset is a dual-mono calculation, not a platform rule. |
| TikTok / Instagram Reels | No official target found in the [research pass](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md); −14 LUFS is a third-party starting estimate | Rough ≤−1 dBTP | **Third-party**, for example [Media Strategy Lab](https://mediastrategylab.com/guides/audio-ducking); never label this a TikTok or Instagram requirement. |
| Broadcast, when requested | −23 LUFS EBU-style estimate in the report | Rough −1 to −2 dBTP | **Third-party summary** [Media Strategy Lab](https://mediastrategylab.com/guides/audio-ducking); obtain the broadcaster's actual specification. |

For a standalone music upload, −14 LUFS / −1 dBTP is a Spotify-oriented start ([Spotify](https://support.spotify.com/us/artists/article/loudness-normalization)). A bed under voice should be delivered lower; the proposed `vo_bed` request is −22 LUFS / −1 dBTP, with the lead muted ([music2 preset plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md), [voice ducking guide](https://mediastrategylab.com/guides/audio-ducking)).

## Short-form beds: Shorts, Reels, TikTok (B.1)

**Deliverable.** Make one exact 15, 30, or 60 s cue with an immediate recognizable event and an intentional final accent. The [stock-music Adapt workflow](https://www.epidemicsound.com/tools/adapt/tutorial) uses these cut lengths; [YouTube's Shorts help](https://support.google.com/youtube/answer/15424877) separately describes upload duration, which is not a loudness specification. Choose `short_15`, `short_30`, or `short_60` with the desired genre. Example: `music2 new --genre drill_uk --use short_30` ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Structure.** Put the hook at B01, then a compact middle and a final-bar ending; the plan searches BPM, integer bars, and a 0/0.5/1 s tail for an exact output frame count. If an explicit BPM cannot yield that duration, expect an input error rather than a stretched file ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Level.** The short presets request −14 LUFS / −1 dBTP as standalone music. For a voiced edit, author a separate bed version near −22 LUFS / −1 dBTP, mute the lead, and duck during speech; third-party editors suggest roughly 6 LU separation and careful attack/release settings ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md), [Media Strategy Lab](https://mediastrategylab.com/guides/audio-ducking), [Adobe auto duck](https://helpx.adobe.com/premiere/desktop/add-audio-effects/adjust-volume-and-levels/automatically-duck-audio.html)).

**Avoid.** A long lead-in or a dense 1–4 kHz melodic line can compete with speech; transient-heavy music can make automatic ducking pump ([VividSpark](https://www.vividspark.ai/blog/how-to-optimize-music-volume-for-voiceover-and-dialogue), [CapCut](https://www.capcut.com/create/audio-ducking-for-clear-dialogue-in-video)). The CLI has one `--use` value, so a voiced 30 s example combines `short_30` structure with hand-authored lead mutes and bed gain; it does not stack two presets ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

## Product and demo videos (B.2)

**Deliverable.** Compose a 30–120 s cue with stable tempo/key, obvious hits or gaps, and a resolved ending. [Sound On Sound's library-work guidance](https://www.soundonsound.com/techniques/library-work) recommends useful edit points and warns that tempo/key changes hinder picture editing. Use `short_30` or `short_60` for an exact cut, or `vo_bed --seconds n` when narration is central ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Structure.** Mark a small pattern change, break, or accent every 4–8 bars so the editor has cut choices. A clean opening, repeating middle, and true ending suit [Premiere Remix](https://helpx.adobe.com/premiere/desktop/add-audio-effects/apply-audio-effects/remix-in-premiere.html), which edits between compatible points to approach a target duration; the planned music2 presets do not snap accents to arbitrary video timestamps ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Level / avoid.** Use −14 LUFS / −1 dBTP for standalone music or the `vo_bed` −22 LUFS / −1 dBTP starting request under narration; keep the middle register less busy and let the editor automate ducking ([Spotify](https://support.spotify.com/us/artists/article/loudness-normalization), [Adobe auto duck](https://helpx.adobe.com/premiere/desktop/add-audio-effects/adjust-volume-and-levels/automatically-duck-audio.html), [music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). Avoid an unresolved repeat or fade-only ending when a video needs a hard cut ([Sound On Sound](https://www.soundonsound.com/techniques/library-work)).

## Podcast sting and theme (B.3)

**Deliverable.** Use `podcast_sting` for one short musical logo of about 4 s, or `podcast_theme` for one about 10 s cue. A longer 15–30 s intro is a separate editorial option; [Mubert](https://mubert.com/blog/podcast-intro-music-how-to-create-a-theme-listeners-remember) describes shorter cold-open stings, and [Music Radio Creative](https://producer.musicradiocreative.com/podcast-intro-music-length/) discusses intro duration. Each music2 invocation produces one song; there is no automatic shared-motif theme/sting/bed pack ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Structure.** Put the motif or hit immediately, resolve the ending, and fit any 0.5/1 s release inside the requested time. [Library-work practice](https://www.soundonsound.com/techniques/library-work) treats a sting as a self-contained fragment, with a good ending instead of an arbitrary chorus fade. The plan asks for an exact 4 s sting or 10 s theme only when the genre can fit exact frames; impossible cases are input errors ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Level / avoid.** Request −16 LUFS / −1 dBTP, then compare the rendered cue with the voice-led episode so the transition does not jump in level. [Apple Podcasts](https://podcasters.apple.com/support/893-audio-requirements) recommends −16 LKFS ±1 and ≤−1 dBFS true peak for the episode; [AES TD1008](https://www.aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf) gives a speech-oriented alternative. Avoid a long intro, late motif, or reverb tail that spills beyond the asset ([Sound On Sound](https://www.soundonsound.com/techniques/library-work)).

## Game loops (B.4)

**Deliverable.** Use `game_loop` for one 16-bar body at an integer bar boundary. The whole song is the loop body: no separate one-shot intro file, nonzero loop start, or engine cue export. Post-FX tail is wrapped onto the start before mastering; the reported start sample is 0 and the end sample is exclusive ([music2 implementation](../../../src/usecases/usecase.tool.ts)). Example: `music2 new --genre lofi_hiphop --use game_loop`.

**Structure.** Write the last bar to lead harmonically and rhythmically into B01. [FMOD](https://qa.fmod.com/t/how-to-setup-loops-with-intro-and-reverb-tail/18193) and [Wwise](https://www.audiokinetic.com/en/library/edge?id=working_with_cues&source=Help) document region/cue approaches with tails across transitions; music2's proposed single-file wrapped-tail form is a narrower deliverable. Check the seam for a sample jump, level step, or spectral mismatch, and listen for low-end buildup ([OCRemix loop discussion](https://ocremix.org/community/topic/41570-creating-seamless-loops-for-video-games), [music2 check plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Level / avoid.** The −16 LUFS / −1 dBTP game preset is advisory, since the report found no game-platform LUFS standard; the game mixes music at runtime ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md), [research report](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md)). Avoid long final releases clashing with the first chord, a seam click, or limiter pumping after the tail wrap ([OCRemix](https://ocremix.org/community/topic/41570-creating-seamless-loops-for-video-games)).

## Livestream background (B.5)

**Deliverable.** Generate individual low-contrast cues, then assemble and level-match them in the stream workflow. The proposed music2 unit has no `stream_playlist` batch renderer or automatic loudness matching; `study_lofi` is the closest single-song preset, and `vo_bed` is useful under a microphone ([music2 disposition](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/001_real_world_practice.md), [music2 preset plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Structure.** Favor a steady groove with one-layer changes every 4–8 bars and endings that can chain without hard silence. [NI's lo-fi guide](https://blog.native-instruments.com/lo-fi-hip-hop-beats/) supports small periodic changes; the report recommends level matching successive tracks to roughly 1 LU as editorial guidance, not a music2 guarantee ([research report](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md)).

**Level / avoid.** Start with `study_lofi` −14 LUFS / −1 dBTP for standalone music or `vo_bed` −22 LUFS / −1 dBTP under speech, then adjust the stream mix ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md), [voice ducking guide](https://mediastrategylab.com/guides/audio-ducking)). Avoid abrupt drops and unlicensed source material; [Twitch's music guidelines](https://legal.twitch.com/en/legal/music) require ownership or appropriate rights, and [Lofi Girl's terms](https://www.lofigirl.com/terms) constrain reuse of its recordings.

## Type beats (B.6)

**Deliverable.** Use `type_beat` for a vocal-ready song of about 72–88 bars, default 80. The planned preset requests −12 LUFS with a −2 dBTP ceiling, following [Spotify's louder-than−14 guidance](https://support.spotify.com/us/artists/article/loudness-normalization) as a safe starting point ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). Example: `music2 new --genre trap --use type_beat` ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Structure.** Try an 8-bar intro with kick muted, an early full-energy hook, then 8-bar hook / 16-bar verse alternation. [BeatPass](https://blog.beatpass.ca/how-to-make-a-type-beat/) gives the common intro/verse/hook template; [Cole Mize Studios](https://colemizestudios.com/the-quickest-method-to-determining-where-your-rap-verse-should-go/) notes drum-light intros. Make verses thinner than hooks and leave room for a voice; the `type_beat` fixture does this through section pattern overrides rather than a section-gain field ([music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

**Delivery / avoid.** [BeatStars](https://blog.beatstars.com/posts/what-you-need-to-know-about-track-creation) describes tagged previews, untagged WAVs, and stems as different commercial deliverables; music2 does not make producer tags or a finished lease package. Existing `render --stems` is dry per-track WAV output, not an automatic grouped trackout pack ([research report](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md), [music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). Avoid a busy lead in the verse vocal range or claiming the requested master target has been measured without analyzing the WAV ([Output checklist](https://output.com/blog/type-beat), [music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

## Study and sleep lo-fi (B.7)

**Deliverable.** Use `study_lofi` with `--genre lofi_hiphop` for one 90–150 s cue, chosen near 120 s, at −14 LUFS / −1 dBTP. The CLI initially selects `vignette`, then fits the duration by rebuilding a groove and alternating one muted melody layer every eight bars ([music2 implementation](../../../src/usecases/usecase.tool.ts), [NI lo-fi](https://blog.native-instruments.com/lo-fi-hip-hop-beats/)). Example: `music2 new --genre lofi_hiphop --use study_lofi`.

**Structure.** Keep a repeatable motif and soft texture; vary one element rather than staging a large build. The short-track model is informed by [Spotify's 30-second stream count](https://support.spotify.com/us/artists/article/how-your-streams-are-counted) and [lo-fi playlist commentary](https://medium.com/@tomdupreeiii/how-lo-fi-producers-are-winning-the-streaming-game-1757149dc3d1), which are different kinds of evidence and not a requirement to make a track 30 s long. [Lofi Girl](https://lofigirl.com/) illustrates longer continuous study-stream programming.

**Level / avoid.** Keep consecutive tracks reasonably even when playlisting; use [Spotify's −14 LUFS normalization](https://support.spotify.com/us/artists/article/loudness-normalization) or a destination-specific target, then measure each render. Avoid sudden full stops, aggressive hat rolls, and bright peaks for a low-fatigue study cue ([NI lo-fi](https://blog.native-instruments.com/lo-fi-hip-hop-beats/), [music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). A dedicated drumless 55–70 BPM sleep/meditation preset is deferred; `study_lofi` is a starting point, not a sleep specification ([research report](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md), [music2 disposition](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/001_real_world_practice.md)).

## Quick preset choice

| Need | Use | Requested loudness / ceiling | Limit |
| --- | --- | --- | --- |
| Exact short edit | `short_15`, `short_30`, `short_60` | −14 LUFS / −1 dBTP | One preset per invocation; make a separate voiced-bed edit ([plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). |
| Narration bed or demo | `vo_bed [--seconds n]` | −22 / −1 | No automatic ducking against an imported voice ([plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md), [Adobe ducking](https://helpx.adobe.com/premiere/desktop/add-audio-effects/adjust-volume-and-levels/automatically-duck-audio.html)). |
| Podcast logo / theme | `podcast_sting`, `podcast_theme` | −16 / −1 | One song each, no theme pack ([plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). |
| Repeating game body | `game_loop` | −16 advisory / −1 | Whole-song loop, start sample 0 ([plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). |
| Rap instrumental | `type_beat` | −12 / −2 | No producer tag or automatic sales pack ([plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). |
| Study or stream cue | `study_lofi` | −14 / −1 | One cue, no batch playlist or sleep-specific preset ([plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)). |

## Review the rendered result for its destination

These are editorial checks, not automatic music2 verdicts. The planned automatic checks cover first-hook timing, section density, section loudness contrast, and loop seams; the other candidates remain deferred ([check plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md), [disposition](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/001_real_world_practice.md)).

### Short edit

- Confirm the exported frame count matches the selected 15/30/60 s preset; the [plan's exact-frame search](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md) includes any release tail inside the duration.
- Check that the first sound and hook arrive immediately; the [short-form report](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md) treats long intros as unsuitable for this use.
- Listen to the last beat against a picture cut; [library-work guidance](https://www.soundonsound.com/techniques/library-work) favors a composed ending over a chorus cut off mid-phrase.
- If a voice enters, recheck the authored lead mute and the editor's ducking behavior ([CapCut ducking guide](https://www.capcut.com/create/audio-ducking-for-clear-dialogue-in-video), [music2 plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md)).

### Product/demo picture

- Locate section starts and any clear hits before cutting; [Sound On Sound](https://www.soundonsound.com/techniques/library-work) recommends edit points on hits, breaks, and silences.
- Check the same cue under narration and without it; [Premiere's ducking workflow](https://helpx.adobe.com/premiere/desktop/add-audio-effects/adjust-volume-and-levels/automatically-duck-audio.html) depends on how the clips are classified and keyed.
- Keep the opening and ending strong if the editor will use [Premiere Remix](https://helpx.adobe.com/premiere/desktop/add-audio-effects/apply-audio-effects/remix-in-premiere.html); its middle cuts preserve those ends.
- Avoid promising cut-point snapping: the [plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md) defers timestamp-to-hit-list generation.

### Podcast cue

- Measure the sting or theme in context with the episode voice; [Apple Podcasts](https://podcasters.apple.com/support/893-audio-requirements) sets the episode-level loudness and true-peak recommendation.
- Check the final reverb release stays inside the file's duration, as required by the [preset plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md).
- Make the motif recognizable without a long build; [Mubert's podcast discussion](https://mubert.com/blog/podcast-intro-music-how-to-create-a-theme-listeners-remember) describes short stings after a cold open.
- If a full, short, sting, and bed family is required, author separate invocations and compare the motif yourself; the [theme-pack idea is deferred](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/001_real_world_practice.md).

### Game loop

- Check that the output starts at sample 0 and ends at the reported exclusive loop-end sample; this is the [whole-song loop contract](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md).
- Audition several repetitions, not just one pass; [OCRemix's loop discussion](https://ocremix.org/community/topic/41570-creating-seamless-loops-for-video-games) highlights harmonic clashes and low-end buildup at the seam.
- Inspect the planned seam metrics for endpoint jump, 50 ms level step, and band-energy change; [music2's check plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md) makes these advisory warnings.
- If an engine needs separate entry/exit cues or a one-shot intro, prepare them outside this preset; [Wwise](https://www.audiokinetic.com/en/library/edge?id=working_with_cues&source=Help) and [FMOD](https://qa.fmod.com/t/how-to-setup-loops-with-intro-and-reverb-tail/18193) describe richer engine arrangements than the planned music2 file.

### Livestream sequence

- Compare each rendered cue's measured loudness before sequencing; the [report](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md) suggests roughly 1 LU matching as an editorial goal.
- Play through transitions under microphone audio; a bed around 6 LU below dialogue is one [ducking guide's](https://mediastrategylab.com/guides/audio-ducking) starting point, not a fixed platform target.
- Avoid sudden breakdowns or stops across a long set; [NI's lo-fi arrangement guide](https://blog.native-instruments.com/lo-fi-hip-hop-beats/) supports gradual one-layer changes.
- Review rights for any outside recording; [Twitch](https://legal.twitch.com/en/legal/music) explains when music may be used on a stream.

### Type beat

- Preview the first 10–20 s and verify the first full-energy section is obvious; the [type-beat research](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md) uses this as a buyer-preview constraint.
- Test a vocal over the verse and reduce competing lead notes; [BeatPass](https://blog.beatpass.ca/how-to-make-a-type-beat/) describes the verse/hook template and [Output](https://output.com/blog/type-beat) recommends mix checks.
- Check the WAV's measured LUFS and true peak before sending it; the [Spotify rule](https://support.spotify.com/us/artists/article/loudness-normalization) is relevant if the master is louder than −14 LUFS.
- Build any tagged preview or grouped stems as separate delivery work; [BeatStars](https://blog.beatstars.com/posts/what-you-need-to-know-about-track-creation) lists those assets, while [music2's plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md) does not generate tags or a pack.

### Study/sleep cue

- Listen for a steady motif and low-fatigue texture across the full cue; [NI's lo-fi guide](https://blog.native-instruments.com/lo-fi-hip-hop-beats/) recommends small additions and removals over a loop.
- Inspect the section boundaries for one-layer changes rather than a large drop; this is the [study preset's planned structure](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md).
- Compare loudness with adjacent playlist items; [Spotify's normalization behavior](https://support.spotify.com/us/artists/article/loudness-normalization) may differ between track and album play.
- For drumless or slow sleep material, make a separate composition decision; the [report's sleep variant](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md) was not adopted as a music2 preset ([disposition](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/001_real_world_practice.md)).
