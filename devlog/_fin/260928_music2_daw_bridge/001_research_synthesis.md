# 001 — Research synthesis

This document condenses the four Aside research notes into the facts the decade docs rely on. Each line cites the note section; the notes cite their primary sources. V marks a fact verified on a fetched page or file, I an inference. Design choices live in the decade docs, not here.

## MIDI (R1)

- V SMF chunks are `MThd` (length 6: format, ntrks, division) and `MTrk`; a positive division is ticks per quarter note, so music2 writes 960 (R1 §1).
- V Delta times and meta lengths use variable-length quantities of 7 bits per byte with the high bit as continuation, at most four bytes (R1 §1).
- V Meta events: track name `FF 03`, marker `FF 06`, tempo `FF 51 03` in microseconds per quarter, time signature `FF 58 04 nn dd cc bb` with dd as a power of two, key signature `FF 59 02 sf mi`, end of track `FF 2F 00` (R1 §1).
- V A note-on with velocity 0 is a note-off; running status may omit a repeated status byte for channel messages but not across meta or SysEx events (R1 §1).
- V Type-1 convention puts the tempo map in the first track; DAWs read tempo and time signature from it, and General MIDI drums use channel 10 (R1 §1–§2).
- V DAW import behavior differs: FL Studio, Ableton Live, Bitwig and GarageBand each place tracks and read tempo and markers in their own way; the note gives the manual pages (R1 §2).
- V Standard CCs: 1 modulation, 7 volume, 10 pan, 11 expression, 64 sustain, 71 and 74 brightness (R1 §3).

## Automation and stems (R1)

- V FL automation clips, Ableton breakpoint envelopes and DAWproject points all store time/value points with an interpolation rule; a portable subset is linear and hold segments (R1 §4).
- V Ableton's "Export All Individual Tracks" and FL's split mixer render export per-track stems aligned to the start; return tracks are exported as their own stems, and producers expect stems that sum to the mix (R1 §5).

## SFZ (R2)

- V SFZ is a text format of headers (`<control>`, `<global>`, `<master>`, `<group>`, `<region>`) and `opcode=value` pairs; lower scopes inherit and override higher ones (R2 §1.1–§1.2).
- V Core opcodes and defaults include `lokey`/`hikey` 0/127, `lovel`/`hivel` 1/127, `pitch_keycenter` 60, `pitch_keytrack` 100 cents per key, `tune` in cents, `transpose` in semitones, `volume` in dB, loop modes, `trigger`, DAHDSR amplitude envelope, `group`/`off_by` choke, `seq_length`/`seq_position` round robin and `lorand`/`hirand` (R2 §2).
- V sforzando and sfizz support the core subset; R2 §3.2 recommends the subset music2 implements (R2 §3).
- V Redistributable free libraries (for documentation only, never bundled) are listed with licenses (R2 §4).
- I Oracle: a 440 Hz sample with `pitch_keycenter=69` played at key 81 must sound at 880 Hz (R2 §6.6).

## Ableton Live Set and DAWproject (R3)

- V An `.als` file is gzip-compressed UTF-8 XML with a root `<Ableton>` element whose `MajorVersion`, `MinorVersion` and `Creator` identify the Live version; Live 12 files use MajorVersion 5 and MinorVersion `12.0_*` (R3 §1.1–§1.2).
- V Arrangement MIDI clips live under `DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/Events`; clip times are in beats; notes are grouped by key under `KeyTracks` (R3 §1.4–§1.5).
- V Pointee ids referenced across the set (for example automation targets) must be unique and below `NextPointeeId`; many other `Id` attributes are local to their container (for example list entries) and only need to be unique among siblings (R3 §1.10; see 060 for the allocation rule).
- V No public schema exists; Live 10 rejects a single unknown attribute, and every permissive writer clones a Live-saved template (R3 §1.11). Opening in Live could not be tested (R3 §1.11).
- V DAWproject is a ZIP with `project.xml` and `metadata.xml`, MIT-licensed, with published `Project.xsd` and `MetaData.xsd`; times default to beats (R3 §2.1–§2.5).
- V xmllint validates DAWproject structure but not dangling IDREFs or semantics (R3 §2.8).
- V Bitwig Studio, Studio One and Cubase support DAWproject; Ableton Live and FL Studio do not natively (R3 §2.9).

## Sampler DSP and plug-ins (R4)

- V Band-limited (windowed-sinc) interpolation avoids the aliasing and high-frequency loss of linear interpolation when pitching samples; R4 measures kernel choices to calibrate test thresholds (R4 §1).
- V Time-scale modification methods: OLA, WSOLA (Verhelst and Roelands 1993), phase vocoder with identity phase locking (Laroche and Dolson 1999) and harmonic-percussive TSM; WSOLA suits percussive and mixed material, the phase vocoder tonal material (R4 §2.3, citing Driedger and Müller 2016).
- V Stretch-factor conventions are inverted between libraries, so music2 must single-source its convention (R4 §2.2).
- V Onset detection uses spectral flux or complex-domain detection functions with adaptive peak picking (Bello et al. 2005; R4 §3.1–§3.2); DAW slicers are described from their manuals (R4 §3.3).
- V Spotify pedalboard hosts VST3 and AU plug-ins, renders instrument plug-ins from MIDI since 0.7.4, and is GPLv3 (R4 §5.1).
- I An MIT tool stays separate from GPL code by running a user-installed bridge as a separate process and exchanging only JSON and WAV (R4 §5.3, GNU GPL FAQ).
