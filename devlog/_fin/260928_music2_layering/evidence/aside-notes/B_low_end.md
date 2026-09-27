# Low end: evidence-backed rules for music2-gen

Scope: kick (`bd`), `808`, and `bass`; numbers are starting points and lint thresholds, not mix laws. **V** = stated in fetched source. **I** = implementation inference from V evidence. No snippet-only facts used.

## Facts

- **V** Kick and bass concentrate much of their energy in **20–160 Hz**; overlapping energy masks. Choose which source wins at a given moment, normally kick on its hits. https://www.izotope.com/community/blog/how-to-mix-kick-and-bass
- **V** A classic TR-808 kick is approximately a **50 Hz** sine-like tone with long decay. A cited example places an 808 kick fundamental near **50 Hz**, with harmonics at **100/200 Hz**. https://www.izotope.com/community/blog/how-to-mix-808s ; https://www.izotope.com/community/blog/how-to-mix-kick-and-bass
- **V** Tune the kick to the song key, or alter bass notes/timing around the kick fundamental; short kick decay plus offset bass timing makes room. https://www.izotope.com/community/blog/how-to-mix-kick-and-bass
- **V** For an 808 carrying sustain, shorten the kick so it supplies the initial punch rather than overlapping the 808 tail. https://www.izotope.com/community/blog/how-to-mix-808s
- **V** A punch layer around **80–100 Hz** can supply front-end attack to an 808; gently duck the 808 layer. https://www.musicradar.com/tuition/tech/4-ways-to-process-a-roland-tr-808-bass-drum-633187
- **V** Sub-bass is typically **25–80 Hz**. EDMProd calls **F0–A0** (about **21.8–27.5 Hz**) its sub “power zone”, while noting C0–E0 may not reproduce on all subs. https://www.edmprod.com/sub-bass/
- **I** Because F0–A0 is below 30 Hz yet the same source warns of reproduction limits, use **30 Hz** as a conservative default floor warning, not a hard ban. For 12-TET: E1=41.2 Hz, F1=43.7 Hz, G1=49.0 Hz, A1=55.0 Hz. The most portable 808 roots are roughly **E1–A1**; this is an engineering policy, not a quoted universal range.
- **V** Roll off sub/bass below **30–40 Hz** (example: 12 dB/oct) to reduce mud; another source says electronic mixes commonly cut below **30 Hz**, sometimes **39 Hz**. https://splice.com/blog/mixing-tips-tighter-bass/ ; https://www.musicradar.com/tuition/tech/9-ways-you-can-use-eq-to-slot-your-kick-and-bass-together-639143
- **V** Kick-to-bass sidechain: start at **2:1**, **1 ms** attack, **30 ms** release for subtle clearing. A heavy/pumping example uses about **10:1**. https://www.waves.com/sidechain-compression-explained-fundamental-techniques ; https://www.waves.com/how-to-mix-kick-bass-perfection
- **V** Subtle kick-triggered bass ducking can reach about **6 dB** gain reduction before serious pumping is normally apparent; release should track kick decay and BPM. https://www.attackmagazine.com/technique/tutorials/ten-production-tips-for-better-basslines/4/
- **V** For kick-sub sidechain, use fast but not click-inducing attack and **50–150 ms** release so the bass returns promptly. https://www.edmprod.com/sub-bass/
- **I** Tempo release guide: an eighth-note duration is **30,000/BPM ms** (250 ms at 120 BPM; 187.5 ms at 160 BPM). Since V evidence says release follows BPM/kick decay, flag releases exceeding one eighth note as potentially overlong, rather than invalid.
- **V** Saturation adds harmonic information: iZotope demonstrates 3rd-order content via square-wave blend and 2nd-order content via tube-style saturation; this helps a low 808 translate to more speakers. https://www.izotope.com/community/blog/how-to-mix-808s
- **V** Gentle saturation can emphasize an 808’s low-mid harmonics; consumer-speaker checks are needed because a bass-heavy 808 can disappear there. https://www.musicradar.com/tuition/tech/4-ways-to-process-a-roland-tr-808-bass-drum-633187
- **I** For a 30–60 Hz fundamental, 2nd/3rd harmonics occur at **60–120/90–180 Hz**. Therefore rendered audio should contain controlled 100–300 Hz harmonic energy when the 808/sub is dominant, but no universal dB share is justified by the fetched sources.
- **V** Mono guidance varies by source: EDMProd says mono below **120 Hz** and center below **200 Hz**; iZotope shows side-channel HPF at **100 Hz** centers lows and says to check mono. https://www.edmprod.com/synth-bass/ ; https://www.edmprod.com/mono-vs-stereo/ ; https://www.izotope.com/community/blog/what-is-midside-processing
- **I** Use **120 Hz** as default “no side energy” boundary, with 100–200 Hz as configurable genre tolerance. Do not make `bass pan != 0` a universal error: iZotope explicitly says stereo bass can work if it remains mono-compatible. https://www.izotope.com/community/blog/how-to-eq-bass
- **V** High-pass non-low-end material to make room, but do not apply one cutoff blindly. Examples: overall rumble **20–40 Hz**; vocals often **100 Hz**; dance-mix non-bass elements often **250–500 Hz**; kick/bass may be cut below **30–39 Hz**. https://www.izotope.com/community/blog/6-ways-to-use-a-high-pass-filter-when-mixing ; https://mastering.com/high-pass-filter/ ; https://www.musicradar.com/tuition/tech/9-ways-you-can-use-eq-to-slot-your-kick-and-bass-together-639143
- **V** Bass low-mid muddiness can be addressed around **200–400 Hz**; a 1–3 dB cut at **250–300 Hz** is one cited example. https://www.izotope.com/community/blog/how-to-eq-bass ; https://www.musicradar.com/tuition/tech/9-ways-you-can-use-eq-to-slot-your-kick-and-bass-together-639143
- **V** The 808 article recommends roughly **6 dB headroom** in mixing, but does not provide a kick-versus-808 dB relationship. https://www.izotope.com/community/blog/how-to-mix-808s

## Proposed checks

| id | surface | rule / threshold | rationale | source |
|---|---|---|---|---|
| low.owner.concurrent | lint | Per section, warn when `808` and `bass` both have sustained notes in 20–160 Hz unless one has `duck` from `bd` or an explicit `lowEndOwner` override. | One low-end owner avoids masking. | iZotope kick/bass |
| low.kick808.coincidence | lint | Warn if `bd` and `808` onsets coincide on **>50%** of kick hits and no `808.duck: bd`. | Coincidence is okay only with deliberate transient/sustain split. **50% I.** | iZotope kick/bass, 808 |
| low.kick808.layering | lint | If coincident, require/advise `bd` gate/decay shorter than 808 note duration; info if kick gate is >=50% of 808 sustain. | Kick punch, 808 tail. **50% I.** | iZotope 808 |
| low.kick.tuning | lint | Warn if detected/specified kick root is >50 cents from section key root/5th, or from a declared compatible 808 root. | Tune kick to key or arrange around its fundamental. **50 cents I.** | iZotope kick/bass; MusicRadar 808 |
| low.808.floor | lint | Warn 808/bass notes below **30 Hz**; stronger warning below C#1 (34.6 Hz), except explicit `allowSubsonic`. | Translation/headroom policy. | EDMProd sub; Splice; MusicRadar |
| low.808.portable | lint | Info if most 808 roots fall outside **E1–A1 (41–55 Hz)**. | Portable practical range is inferred. | EDMProd sub |
| low.808.overlap | lint | Warn same-voice 808 note overlaps >20 ms without mono/legato intent. | Long tails muddy the low end. **20 ms I.** | iZotope 808 |
| low.duck.required | lint | When coincidence warning fires, require `808.duck: bd` or explicit staggered onset >30 ms. | Arrangement or ducking must allocate space. **30 ms I.** | iZotope kick/bass |
| low.duck.release | lint | If duck exposes release, info when outside **50–150 ms** for tight electronic/trap defaults; warning only if > `30000/BPM` ms. | Evidence-based start range; eighth-note cap is I. | EDMProd sub; Attack |
| low.duck.style | lint | Default `ratio=2:1`, `attack=1 ms`, `release=30 ms` for subtle; label >=`10:1` as audible/pumping. | Makes house/techno-style audible pump an explicit decision; trap default can remain tight/subtle. | Waves sidechain |
| low.duck.depth | analyze | On kick hits, estimate 808/bass 20–160 Hz reduction. Info at **>6 dB** for “subtle” profile; do not cap “pump” profile. | 6 dB cited subtle ceiling. | Attack |
| low.mono.sub | analyze | Error if side energy below **120 Hz** exceeds -20 dB relative to mid, unless `wideLowEnd` override; report 100/120/200 Hz views. | Conservative mono policy, configurable. **-20 dB I.** | EDMProd; iZotope M/S |
| low.pan | lint | Warn, not error, when 808/bass `pan != 0`; error only if pan plus no mono-compatible low band. | Stereo bass is not categorically wrong. | iZotope bass EQ |
| low.subsonic | analyze | Warn if 20–30 Hz share is >10% of total 20–250 Hz energy, or 20–40 Hz dominates limiter input. **10% I.** | Rumble/headroom evidence. | iZotope HPF; Splice |
| low.harmonic.translation | analyze | If 30–60 Hz is dominant and 100–300 Hz share is <5% of 20–500 Hz, info: add harmonic layer/saturation and test small speakers. **5% I.** | Harmonics support translation. | iZotope 808; MusicRadar 808 |
| low.lowmid.mud | analyze | Warn if 200–400 Hz share is anomalously high versus reference/profile; suggest dynamic cut, not automatic removal. | Low-mid mud range. | iZotope bass EQ |
| low.hpf.nonowners | lint | For pad/keys/pluck/lead, warn notes below C3 (130.8 Hz) unless `lowEndRole`; for reverb/effects suggest HPF. This is a conservative note proxy, not an audio EQ assertion. | Preserve low-end space. **C3 I.** | iZotope HPF; MusicRadar |
| low.mix.headroom | analyze | Pre-master info when true peak leaves <**6 dB** headroom during mix stage. | Published 808 mixing guideline; final-master target is separate. | iZotope 808 |

## Sources list

Fetched and inspected: 18 pages.

1. https://www.izotope.com/community/blog/how-to-mix-808s
2. https://www.izotope.com/community/blog/how-to-mix-kick-and-bass
3. https://www.attackmagazine.com/technique/tutorials/ten-production-tips-for-better-basslines/4/
4. https://www.edmprod.com/sub-bass/
5. https://www.edmprod.com/eq-kick-drums/
6. https://splice.com/blog/mixing-tips-tighter-bass/
7. https://www.musicradar.com/tuition/tech/9-ways-you-can-use-eq-to-slot-your-kick-and-bass-together-639143
8. https://www.musicradar.com/tuition/tech/4-ways-to-process-a-roland-tr-808-bass-drum-633187
9. https://www.waves.com/sidechain-compression-explained-fundamental-techniques
10. https://www.waves.com/how-to-mix-kick-bass-perfection
11. https://www.fabfilter.com/learn/compression/side-chain-compression
12. https://www.waves.com/how-to-mix-kick-bass-together-5-tips
13. https://www.edmprod.com/synth-bass/
14. https://www.izotope.com/community/blog/what-is-midside-processing
15. https://www.izotope.com/community/blog/6-ways-to-use-a-high-pass-filter-when-mixing
16. https://mastering.com/high-pass-filter/
17. https://www.masteringthemix.com/blogs/learn/creating-space-in-your-mix-using-eq
18. https://www.izotope.com/community/blog/how-to-eq-bass

## Open gaps

- No credible fetched source gave a universal numeric **808-vs-kick gain difference**, a genre-specific trap versus house/techno target, or a fixed kick decay in milliseconds. Keep level checks relative/reference-based and expose genre profiles.
- The JSON described has `gain/pan/gate/glide/duck`, but no stated compressor fields for ratio, attack, release, or gain reduction. The sidechain checks require either extending `duck` metadata or estimating rendered envelope reduction.
- A proper high-pass matrix for pads, keys, guitars, vocals, hats, snare, and reverbs needs dedicated sources or an internal, explicitly heuristic profile. Do not present `pad below C3` as a sourced HPF fact.
- Need a separate audio-analysis specification for band-share baselines, LUFS, true peak, mono correlation, and genre reference sets before hard failures are defensible.
