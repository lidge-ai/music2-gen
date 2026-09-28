# R1: MIDI, automation, stems (music2 DAW bridge research)

Prepared 2026-09-28 for music2 (github.com/lidge-ai/music2-gen, MIT, zero-dependency TypeScript).
Tagging: **V** = verified on a fetched page (URL given, source keys resolve in the Sources section). **I** = my inference / recommendation.
No GPL/AGPL/LGPL source code was read. DAWproject (MIT) was read only as its XSD/README.

Section order: 1 SMF bytes, 3 CC conventions (kept next to SMF), 2 DAW import, 4 automation, 5 stems, 6 implementation contract, 7 fixtures, 8 open items, Sources.

Source keys used inline: [SMF] Standard MIDI Files 1.0 (RP-001, MMA, rev. Feb 1996), [M1] Complete MIDI 1.0 Detailed Specification 96.1, [CC] midi.org CC table, [MSG] midi.org message summary. Full URLs in the Sources section.

---

## 1. Standard MIDI File 1.0: byte layout

### 1.1 Chunks (V, [SMF] p.2)
- Every chunk = 4-byte ASCII type + 32-bit **big-endian** length + data. Length excludes the 8 header bytes ("a chunk with a length of 6 would actually occupy 14 bytes"). V [SMF]
- Chunks are not padded to even length; there are no nested chunks. V [SMF]
- Readers must skip unknown chunk types ("Your programs should expect alien chunks and treat them as if they weren't there"). V [SMF]
- File = one `MThd` followed by one or more `MTrk`. V [SMF]

### 1.2 MThd (V, [SMF] pp.3-4)
```
offset size  field
0      4     "MThd" = 4D 54 68 64
4      4     length = 00 00 00 06   (readers MUST honor a larger length and skip extra bytes)
8      2     format  (uint16 BE)  0 | 1 | 2
10     2     ntrks   (uint16 BE)  always 1 for format 0
12     2     division (uint16 BE)
```
- format 0: "a single multi-channel track"; format 1: "one or more simultaneous tracks ... of a sequence"; format 2: "one or more sequentially independent single-track patterns". V [SMF]
- "it is important to read and honor the length, even if it is longer than 6." V [SMF]
- An unknown format may be read "as format 1 or 2" if meaningful. V [SMF]

**division** (V, [SMF] p.4):
- bit 15 = 0: bits 14..0 = ticks per quarter note (PPQ, max 32767). Example: division 96 means an eighth note = 48 ticks. V
- bit 15 = 1: SMPTE. High byte = negative frames/sec in two's complement: -24 (0xE8), -25 (0xE7), -29 (0xE3, = 30 drop-frame), -30 (0xE2). Low byte = ticks per frame (typical 4, 8, 10, 80, 100). V
- "millisecond-based tracks by specifying 25 frames/sec and a resolution of 40 units per frame" -> division `E7 28`. V
- "bit resolution of thirty-frame time code, the division word would be E250 hex" (-30, 80 ticks/frame). V
- SMPTE tick duration = 1 / (fps * ticksPerFrame) s; for 29 (drop-frame) the real rate is 29.97 fps. I (standard SMPTE knowledge; the SMF text only says "-29 corresponds to 30 drop frame").

### 1.3 Formats and tempo map placement (V, [SMF] p.5)
- "for a format 1 file, the tempo map must be stored as the first track." V
- "All MIDI Files should specify tempo and time signature. If they don't, the time signature is assumed to be 4/4, and the tempo 120 beats per minute." In format 1 "these meta-events should be contained in the first track." In format 2 every pattern should carry initial time sig and tempo. V
- SMPTE Offset (FF 54) in a format-1 file "must be stored with the tempo map, and has no meaning in any of the other tracks." V [SMF] p.9

### 1.4 MTrk and events (V, [SMF] pp.5-7)
```
<Track Chunk> = "MTrk"(4D 54 72 6B) <uint32 BE length> <MTrk event>+
<MTrk event>  = <delta-time VLQ> <event>
<event>       = <MIDI channel event> | <sysex event> | <meta-event>
```
- Delta-times are always present (0 for simultaneous events), in ticks of the header division. V
- At least one event per track; End of Track must be last. V
- Sysex: `F0 <VLQ len> <bytes after F0 ... F7>`; example: transmitted `F0 43 12 00 07 F7` stored as `F0 05 43 12 00 07 F7`. Escape form: `F7 <VLQ len> <raw bytes>`. V
- Meta: `FF <type 00..7F> <VLQ len> <data>`. Unknown meta types must be skipped by length; known types may be longer than expected (ignore the tail); writers must not append private data to standard metas. V

### 1.5 Variable-length quantity (VLQ) (V, [SMF] p.2)
- 7 bits per byte, most significant group first; every byte except the last has bit 7 set. Max value 0x0FFFFFFF (4 bytes). V
- Official table (V, [SMF]):

| value (hex) | VLQ bytes |
|---|---|
| 00000000 | 00 |
| 00000040 | 40 |
| 0000007F | 7F |
| 00000080 | 81 00 |
| 00002000 | C0 00 |
| 00003FFF | FF 7F |
| 00004000 | 81 80 00 |
| 00100000 | C0 80 00 |
| 001FFFFF | FF FF 7F |
| 00200000 | 81 80 80 00 |
| 08000000 | C0 80 80 00 |
| 0FFFFFFF | FF FF FF 7F |

- Extra worked values for PPQ 960 (I, computed with a VLQ encoder that reproduces all 12 official rows above):

| ticks | meaning at PPQ 960 | VLQ |
|---|---|---|
| 96 | 1/40 beat | 60 |
| 200 | (spec sysex example) | 81 48 |
| 240 | 16th note | 81 70 |
| 480 | 8th note | 83 60 |
| 960 | quarter | 87 40 |
| 1920 | half | 8F 00 |
| 3840 | 4/4 bar | 9E 00 |
| 7680 | 2 bars | BC 00 |
| 15360 | 4 bars | F8 00 |
| 30720 | 8 bars | 81 F0 00 |

Algorithm (I, restated from the spec's description, not transcribed):
```ts
function writeVlq(n: number): number[] {           // 0 <= n <= 0x0FFFFFFF, integer
  const out = [n & 0x7f]; n >>>= 7;
  while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>>= 7; }
  return out;
}
function readVlq(b: Uint8Array, i: number): [value: number, next: number] {
  let v = 0, c = 0, k = 0;
  do { if (++k > 4) throw new Error('VLQ > 4 bytes'); c = b[i++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80);
  return [v >>> 0, i];
}
```

### 1.6 Running status (V)
- "status bytes of MIDI channel messages may be omitted if the preceding event is a MIDI channel message with the same status. The first event in each MTrk chunk must specify status ... running status occurs across delta-times." V [SMF] p.6
- "Sysex events and meta-events cancel any running status which was in effect. Running status does not apply to and may not be used for these messages." V [SMF] p.7
- On the wire: running status is "For Voice and Mode messages only"; "Running Status will be stopped when any other Status byte intervenes. Real-Time messages should not affect Running Status." V [M1] (Running Status section)
- Reader rule (I): a byte < 0x80 where a status is expected -> reuse last channel status; if there is none (track start, or after FF/F0/F7), throw a parse error. Reset running status at each new MTrk.

### 1.7 Channel voice messages (V, [MSG]; [M1])
Channel nibble n = 0..15 = MIDI channels 1..16. All data bytes are 0..127.

| message | status | data bytes | notes |
|---|---|---|---|
| Note Off | 8n | key, release velocity | V [MSG] |
| Note On | 9n | key, velocity | velocity 0 == Note Off (below) |
| Poly Key Pressure | An | key, pressure | V [MSG] |
| Control Change | Bn | controller 0..119, value | 120..127 = Channel Mode msgs V [MSG] |
| Program Change | Cn | program 0..127 | one data byte; GM names programs 1..128, so wire = GM number - 1 V [M1] |
| Channel Pressure | Dn | pressure | one data byte V [MSG] |
| Pitch Bend | En | LSB (7 bits), MSB (7 bits) | LSB first V [MSG] |

- Velocity-0 equivalence: "A note may be turned off either by sending a Note-Off message ... or by sending a Note-On message for that note and channel with a velocity value of zero ... A receiver must be capable of recognizing either method of turning off a note, and should treat them identically." Recommended release velocity when unused: 64 (40H). V [M1] Note-Off section
- Pitch bend: 14-bit, "Center (no pitch change) is 2000H" (= 8192). V [MSG]. Max negative `00 00`, center `00 40`, max positive `7F 7F` (data byte order LSB, MSB). "always transmitted with both data bytes." V [M1]
  - Encoding (I): `v = clamp(round(8192 + bend * 8192), 0, 16383)` for bend in [-1, +1) (note: +1.0 maps to 16384 so clamp to 16383); `lsb = v & 0x7F; msb = v >> 7`. Semitones = bend * range; range default is receiver-defined, commonly +-2 (RPN 0,0) (I; spec: "Sensitivity is a function of the receiver, but may be set using RPN 0" V [MSG]).
  - RPN 0,0 Pitch Bend Sensitivity: Data Entry MSB = semitones, LSB = cents; "MSB=01, LSB=00 means +/- one semitone". V [M1]. Byte sequence to set +-12 st on ch1 (I): `B0 65 00  B0 64 00  B0 06 0C  B0 26 00  B0 65 7F  B0 64 7F` (last two = RPN null 7F 7F, recommended so later CC6 does not retarget, V [CC] "Null Function Number for RPN/NRPN").
- Program change example from the spec: "C0 05" = Ch. 1 program 5 (wire value). V [SMF] p.12

### 1.8 Meta events required by music2 (V, [SMF] pp.8-10)
| bytes | name | semantics |
|---|---|---|
| `FF 00 02 ssss` | Sequence Number | optional, time 0 only |
| `FF 01 len text` | Text | |
| `FF 02 len text` | Copyright | first event of first track, time 0 |
| `FF 03 len text` | Sequence/Track Name | "If in a format 0 track, or the first track in a format 1 file, the name of the sequence. Otherwise, the name of the track." Must be at time 0. V |
| `FF 04 len text` | Instrument Name | |
| `FF 05 len text` | Lyric | |
| `FF 06 len text` | Marker | "Normally in a format 0 track, or the first track in a format 1 file ... rehearsal letter or section name" V |
| `FF 07 len text` | Cue Point | description of on-screen/stage action V |
| `FF 20 01 cc` | MIDI Channel Prefix | cc = 0..15 |
| `FF 2F 00` | End of Track | "not optional"; must be last V |
| `FF 51 03 tt tt tt` | Set Tempo | microseconds per quarter note, 24-bit BE V |
| `FF 54 05 hr mn se fr ff` | SMPTE Offset | tempo track only in format 1 |
| `FF 58 04 nn dd cc bb` | Time Signature | see below |
| `FF 59 02 sf mi` | Key Signature | sf int8 -7..+7 (flats negative), mi 0 major / 1 minor V |
| `FF 7F len data` | Sequencer-specific | manufacturer ID first |

- Text encoding: "should be printable ASCII characters for maximum interchange." V [SMF]. I: music2 should write ASCII only (replace non-ASCII with `?` or transliterate) and read bytes as latin1 fallback; UTF-8 is common in practice but unspecified.
- Set Tempo: `usPerQuarter = round(60_000_000 / bpm)`. Spec example `FF 51 03 07 A1 20` = 500000 us = 120 BPM. V [SMF]. Computed (I):

| BPM | us/qn | bytes | round-trip BPM |
|---|---|---|---|
| 60 | 1000000 | 0F 42 40 | 60.000000 |
| 90 | 666667 | 0A 2C 2B | 89.999955 |
| 120 | 500000 | 07 A1 20 | 120.000000 |
| 128 | 468750 | 07 27 0E | 128.000000 |
| 140 | 428571 | 06 8A 1B | 140.000140 |
| 174 | 344828 | 05 42 FC | 173.999791 |

  Valid range 1..16777215 us (0x000001..0xFFFFFF) -> about 3.58 BPM .. 60,000,000 BPM; I recommend clamping BPM to [20, 999].
- Time signature `nn dd cc bb`: dd = log2(denominator) (2 = quarter, 3 = eighth); cc = MIDI clocks per metronome click (24 clocks = 1 quarter); bb = 32nd notes per MIDI quarter (normally 8). Spec examples: 4/4 = `FF 58 04 04 02 18 08`; 6/8 = `FF 58 04 06 03 24 08` (click every dotted quarter = 36 clocks). V [SMF]. Writer rule (I): `cc = 24` for x/4 and x/2 (x/2: 48) simple meters; for compound x/8 with nn % 3 == 0 and nn > 3, `cc = 36`; else `cc = 24 * 4 / denominator`. `bb = 8` always.
- Key signature examples (I): C major `FF 59 02 00 00`; A minor `FF 59 02 00 01`; E-flat major `FF 59 02 FD 00` (sf = -3 as int8 0xFD); E major `FF 59 02 04 00`.
- Tick -> seconds: `ms = ticks * (usPerQn / division) / 1000`; example 6144 ticks at 500000 us, division 96 -> 32000 ms; multiple tempo events need a running (piecewise) sum. V [SMF] p.14

### 1.9 Official example file (oracle) (V, [SMF] pp.12-14)
Format 0, division 96, 4/4, 120 BPM, three channels; total file = 14 + 8 + 59 = 81 bytes:
```
4D 54 68 64 00 00 00 06 00 00 00 01 00 60
4D 54 72 6B 00 00 00 3B
00 FF 58 04 04 02 18 08
00 FF 51 03 07 A1 20
00 C0 05
00 C1 2E
00 C2 46
00 92 30 60
00 3C 60            (running status)
60 91 43 40
60 90 4C 20
81 40 82 30 40      (two-byte delta = 192)
00 3C 40            (running status)
00 81 43 40
00 80 4C 40
00 FF 2F 00
```
Decoded absolute ticks (verified with an independent parser in this session): 58@0, 51@0, C0/C1/C2@0, 92 30@0, 92 3C@0, 91@96, 90@192, four note-offs@384, EOT@384. Format-1 version of the same file: tempo track length 0x14 (20) ending `83 00 FF 2F 00` (EOT at 384); music tracks use Note On vel 0 via running status (`81 40 4C 00`). V [SMF]

### 1.10 Recommended conventions for type-1 files (V/I)
- Track 0 = conductor/tempo map: FF 03 (song title), FF 58, FF 59, FF 51 events, FF 06 markers, FF 54 if any; no channel events. V for tempo/time-sig/marker placement [SMF]; I for "no channel events" (widely followed convention).
- Tracks 1..N: one instrument each, FF 03 track name at time 0, one MIDI channel per track (I).
- End every track with FF 2F 00 at the song end tick so all tracks share the same length (I; spec only says EOT defines exact length V).
- Channel 10 (nibble 9) = GM key-based percussion: "The General MIDI percussion sounds are set on Channel 10" and "Key-based Percussion is always on channel 10." V [M1]. GM drum map excerpt: 35 Acoustic Bass Drum, 36 Bass Drum 1, 37 Side Stick, 38 Acoustic Snare, 39 Hand Clap, 40 Electric Snare, 42 Closed Hi Hat, 44 Pedal Hi-Hat, 46 Open Hi-Hat, 49 Crash Cymbal 1, 51 Ride Cymbal 1 (range 35..81). V [M1] GM Percussion Map.

---

## 3. Standard CC conventions (V, [CC], [M1])

| CC | hex | name | range / semantics |
|---|---|---|---|
| 0 / 32 | 00 / 20 | Bank Select MSB / LSB | |
| 1 / 33 | 01 / 21 | Modulation Wheel MSB / LSB | 0 = no effect |
| 2 | 02 | Breath | |
| 7 / 39 | 07 / 27 | Channel Volume MSB / LSB | GM default 100 on GM System On V [M1] |
| 8 | 08 | Balance | 0 left, 64 equal, 127 right V [M1] |
| 10 / 42 | 0A / 2A | Pan MSB / LSB | "00 = hard left, 64 (40H) = center, and 127 (7FH) = hard right" V [M1] |
| 11 / 43 | 0B / 2B | Expression MSB / LSB | "a form of volume accent above the programmed or main volume"; GM reset value 127 V [M1] |
| 64 | 40 | Damper/Sustain | "<=63 off, >=64 on" V [CC] |
| 65..69 | 41..45 | Portamento sw, Sostenuto, Soft, Legato, Hold 2 | switches, same threshold V [CC] |
| 71 | 47 | Sound Controller 2 | "default: Timbre/Harmonic Intens." (commonly resonance) V [CC] |
| 74 | 4A | Sound Controller 5 | "default: Brightness" (commonly filter cutoff) V [CC] |
| 72 / 73 | 48 / 49 | Release Time / Attack Time | V [CC] |
| 91 / 93 | 5B / 5D | Effects 1 (Reverb send) / Effects 3 (Chorus send) | V [CC] |
| 98/99, 100/101, 6/38 | | NRPN LSB/MSB, RPN LSB/MSB, Data Entry MSB/LSB | V [CC] |
| 120..127 | 78..7F | Channel Mode (All Sound Off, Reset All Controllers, ..., All Notes Off) | not CCs V [CC] |

- "All transmitters should send a value of 00 to represent minimum and 127 (7FH) to represent maximum"; exceptions with a centre: Balance, Pan, Expression. V [M1]
- GM "Reset All Controllers" recommended response: Mod 0, Expression 127, pedals 0, RPN/NRPN null, pitch bend centre (64/0), pressures 0; AMEI proposed NOT resetting Program, Bank, Volume, Pan, CC91-95, CC70-79. V [M1]. I: music2 should therefore explicitly write CC7/CC10/CC11 at tick 0 rather than rely on defaults.
- CC71/74 mapping to "resonance"/"cutoff" is a convention (e.g. GM2/many synths); MIDI 1.0 only names them Timbre and Brightness. I

### 3.1 14-bit CC pairs (V, [M1] Control Change section)
- CC 0..31 carry MSBs; CC 32..63 are the optional LSBs of CC 0..31 ("controller number 39, the corresponding LSB number to controller number 7 ... 14-bit resolution ... 16,384 steps"). V
- "If both the MSB and LSB are sent initially, a subsequent fine adjustment only requires the sending of the LSB ... When an MSB is received, the receiver should set its concept of the LSB to zero." V
- "All controller numbers 64 and above have single-byte values only." V
- Writer rule (I): for a 14-bit value v in 0..16383 send MSB (`v >> 7`) then LSB (`v & 0x7F`) at the same tick, in that order (because MSB resets LSB to 0). Example CC1 = 8192 on ch1: `00 B0 01 40 00 21 00` (with running status) or `00 B0 01 40 00 B0 21 00`.
- Reader rule (I): when a pair is detected (LSB CC n+32 following CC n on same channel), value14 = msb*128 + lsb; a lone MSB = msb*128.
- Normalized mapping (I): 7-bit `x = v / 127`; 14-bit `x = v / 16383`; writer `v = round(x * 127)`. For bipolar (pan): `pan = (v - 64) / 63` clamped to [-1, 1] so 0 -> -1.0159 clamps to -1, 64 -> 0, 127 -> +1.

### 3.2 How DAWs map MIDI CC to automation (V/I)
- Ableton Live: MIDI controller data in clips (including data "imported as part of your MIDI files") is shown/edited as clip envelopes under the **MIDI Ctrl** entry of the clip's Device chooser; this is separate from mixer/device parameter automation. V [LIVE-CLIPENV]
- Bitwig: imported MIDI clips get MIDI automation lanes; "CC channel information is now preserved" (3.2.8). A MIDI lane is defined by MIDI Channel + Type (Pitch Bend, Ch. Pressure, Control Change) + Controller Number, and is distinct from device and mixer parameters. V [BW-RN328], [BW-AUTO]
- FL Studio: CC data is imported into a plugin parameter's **event editor** (Browse Parameters -> Edit events -> Event Editor Menu > Options > Edit > Import MIDI File), loaded separately into the pattern with the notes; not an automatic Automation Clip. The manual warns 'Realign events' "should not be used as the MIDI note and CC automation will probably end up out of sync." V [FL-MIDIIMP]
- GarageBand: Piano Roll region automation covers "MIDI controller value changes over time"; the import page does not say imported CCs land there. V/I [GB-AUTO], [GB-IMPORT]
- No fetched manual says CC7/CC10 in an SMF are converted to the DAW's **mixer** volume/pan automation. I: treat CC7/10/11 as instrument-side (they reach the synth), not as mixer-fader automation. For mixer automation interchange use DAWproject or an ALS path (R3), not SMF.

---

## 2. How DAWs import MIDI

### 2.1 FL Studio (V, [FL-MIDIIMP], [FL-PRMIDI])
- Entry points: File menu import, Piano roll menu import, Browser drag-and-drop onto Channel Rack / Piano roll / desktop. On drop, Shift suppresses the dialog, Alt forces it. "only imports .mid format not .midi". V
- Import MIDI data dialog controls (vary by entry point): Which Tracks to Import, Which Channels to Import, Channel type (FLEX, MIDI Out, ...), Blend with existing data, Start new project, **Create one channel per track** ("Imports each MIDI channel (1 to 16 possible) in the MIDI file as a separate Instrument channel"), Set mixer tracks for new channels, **Realign events** ("Removes any empty-space at the start of the file"), **Import time signatures** ("Add time signatures from the MIDI file to the Pattern / Piano roll"), **Import zero velocity notes** ("Treat notes with a velocity of zero as 'Note ON', instead of, the default, 'Note Off' messages"). V
- Note: FL's "one channel per track" is keyed on **MIDI channel**, not SMF track. V (quote above). I: therefore music2 must give every instrument its **own MIDI channel** (max 16 incl. drums); two SMF tracks sharing a channel will merge into one FL instrument.
- The import page does not document tempo import, marker import, or program-change mapping (searched the page text for "tempo": no hits). I: do not promise FL reads FF 51 / FF 06; write them anyway (harmless) and state tempo in the CLI output/README.
- Realign events would shift everything if the first note is late. I: music2 should never rely on leading silence to position material; bar 1 = tick 0 and a DAW user should leave Realign off.

### 2.2 Ableton Live 12 (V)
- Accepts SMF 0/1/2 as `.mid` or `.smf`. SMF0 -> all data in **one** Live track even with multiple channels; SMF1 tracks -> **separate** Live tracks. Drag from browser / Finder / Explorer or Create > Import MIDI File... V [ABL-MIDIFILES]
- Create-menu import lands at the Insert Marker (Arrangement) or selected clip slot (Session); resulting clips lose reference to the file. V [LIVE-FILES]
- Arrangement import offers "an option to import any time signature information" -> time-signature markers. V [LIVE-ARR]
- Tempo map: importing a MIDI file with tempo changes into an Arrangement track and answering Yes to the prompt writes Song Tempo automation on the Main track; Ableton notes the file needs note(s) spanning the tempo changes. V [ABL-TEMPOMAP]. I: because the tempo prompt is triggered by importing a track with notes, keep FF 51 in track 0 (spec-required) but expect Live users to import the whole multi-track file; do not rely on marker (FF 06) -> locator conversion (not documented).
- CC data -> MIDI Ctrl clip envelopes (see 3.2). V
- Live's own Export MIDI Clip writes one clip as SMF0 at 96 PPQ. V [ABL-MIDIFILES]. I: a music2 reader must accept PPQ 96 and format 0 as round-trip input from Live.

### 2.3 Bitwig Studio (V)
- Browser recognises MIDI files (and DAWPROJECT). V [BW-BROWSER]
- 5.2.5 release notes: "MIDI file import: Time signature and tempo changes are no longer ignored". V [BW-RN525]. I: older Bitwig ignored them; tempo import is version dependent.
- Imported CC/pitch bend -> MIDI automation lanes (see 3.2). V

### 2.4 GarageBand for Mac (V/I)
- Drag a MIDI file from Finder onto a software instrument track or the empty area below tracks; it appears on "one or more software instrument tracks". V [GB-IMPORT]
- The fetched Apple page is silent on tempo, time signature, markers and CC handling. I: unverified; do not claim GarageBand adopts the file tempo.

### 2.5 Cross-DAW conclusions (I)
- Safest common denominator: format 1, track 0 = conductor, one instrument per track **and** per channel, tick 0 = bar 1 beat 1, notes quantised to integer ticks, velocity-1..127 Note On + explicit 8n Note Off.
- Anything beyond notes/CC/pitch bend/tempo/time signature (markers, key sig, program change) is best-effort metadata.

---

## 4. Automation semantics and a portable curve model

### 4.1 FL Studio automation clips (V, [FL-AUTOCLIP])
- Automation Clip = Playlist graph linked to one or more controls; point values typed in are "from 0 to 1"; clip Min/Max "is a scaling factor that re-ranges the output". V
- Segment shape is set on the **right-most point** of a segment. Modes: Single curve (default; straight or curved by tension), Double curve (S), Alt single curve, Alt double curve, Hold (one step), Stairs (multiple steps, tension = step frequency), Smooth stairs, Pulse (square), Wave (sine pulse), Half sine, Smooth. Right-click the tension handle resets it. V
- No numeric tension range or curve equation is published in the manual. I (explicitly unverified): do not claim exact FL curve reproduction; densify.

### 4.2 Ableton Live (V, [LIVE-AUTO], [LIVE-CLIPENV])
- Breakpoint envelopes; vertical axis = the control's own value range. Draw Mode creates steps as wide as the visible grid. Alt/Option-drag a segment curves it; Alt/Option double-click straightens it. "Simplify Envelope" removes redundant breakpoints. V
- No numeric curvature parameter/equation is documented in the manual. I
- Holds are expressed as two breakpoints at (nearly) the same time; I: when writing ALS (R3) represent hold as a point pair `t-epsilon, a` / `t, b`.

### 4.3 DAWproject (V, [DP-XSD], [DP-README]; MIT)
- `<Points>` has a required `<Target>` then point elements `RealPoint | EnumPoint | BoolPoint | IntegerPoint | TimeSignaturePoint`; `unit` enum = `linear, normalized, percent, decibel, hertz, semitones, seconds, beats, bpm`; `timeUnit` = `beats | seconds`. V
- Every point requires `time`. `RealPoint` has `value` and optional `interpolation` with only `hold` or `linear`. `TimeSignaturePoint` has `numerator`, `denominator`. V
- `<Target>` attributes: `parameter` (IDREF), `expression`, `channel`, `key`, `controller`; `expression` enum: `gain, pan, transpose, timbre, formant, pressure, channelController, channelPressure, polyPressure, pitchBend, programChange`. V
- Arrangement carries `<TempoAutomation>` and `<TimeSignatureAutomation>` point lists. V
- The XSD does not define the default when `interpolation` is omitted. I: always write it explicitly.

### 4.4 REAPER and Web Audio references
- REAPER envelopes have six shapes: Linear, Square, Slow Start/End, Fast Start, Fast End, Bezier; ReaScript `SetEnvelopePoint` takes separate `shape` and `tension`. V [REAPER-UG], [REASCRIPT]. The integer mapping 0..5 and the tension range -1..1 were not found in fetched official text. I
- Web Audio AudioParam (V, [WEBAUDIO]):
  - linear: `v(t) = V0 + (V1 - V0) * (t - T0) / (T1 - T0)`
  - exponential: `v(t) = V0 * (V1 / V0) ^ ((t - T0) / (T1 - T0))`; V1 = 0 throws RangeError; if V0 = 0 or signs differ, v(t) = V0 until T1.
  - setTarget: `v(t) = V1 + (V0 - V1) * exp(-(t - T0) / timeConstant)`
  - setValueCurve: N equally spaced values over duration D, linear interpolation, index `x = (N - 1)(t - T)/D`.

### 4.5 Proposed portable curve model (I)
```ts
type CurveShape = 'hold' | 'linear' | 'power';   // shape of the segment LEAVING this point
interface AutoPoint { beat: number; value: number; shape: CurveShape; tension?: number } // tension in [-1, 1], only for 'power'
interface AutoLane {
  target: { kind: 'cc'; channel: number; cc: number } | { kind: 'pitchBend'; channel: number }
        | { kind: 'param'; id: string } | { kind: 'tempo' };
  unit: 'normalized' | 'bpm' | 'decibel' | 'semitones';  // DAWproject-compatible names
  min: number; max: number;                                // for normalized<->unit mapping
  points: AutoPoint[];                                     // strictly increasing beat; last point's shape ignored
}
```
Segment evaluation between point i (time t0, value a) and i+1 (t1, b), `u = (t - t0)/(t1 - t0)` in [0,1):
- hold: `y = a` for u < 1, jumps to b at t1.
- linear: `y = a + (b - a) * u`.
- power ("exponential with tension"): `p = 4 ^ |q|`; `f(u) = u^p` if q >= 0 else `1 - (1 - u)^p`; `y = a + (b - a) * f(u)`. q = 0 is linear; q > 0 = slow start (ease-in), q < 0 = fast start (ease-out). Deliberately simple, monotone, exactly invertible, deterministic across JS engines (only `Math.pow`).

Numeric oracles for power shape, a = 0, b = 1 (computed):

| q | p | f(0.25) | f(0.5) | f(0.75) |
|---|---|---|---|---|
| 0 | 1 | 0.25 | 0.5 | 0.75 |
| 0.5 | 2 | 0.0625 | 0.25 | 0.5625 |
| 1 | 4 | 0.00390625 | 0.0625 | 0.31640625 |
| -0.5 | 2 | 0.4375 | 0.75 | 0.9375 |
| -1 | 4 | 0.68359375 | 0.9375 | 0.99609375 |

(These use p = 4^|q|; for q = -0.5, f(u) = 1 - (1-u)^2.)

Conversion rules (I):
- **To SMF CC (7-bit):** sample the lane on a fixed grid of `ccGridTicks = PPQ/16 = 60` ticks (1/64 note) at PPQ 960; `v = clamp(round(norm * 127), 0, 127)`; emit only when v changes; always emit the exact values at every point time (so holds are sharp and endpoints exact); hold segments emit just 2 messages (at t0 and t1). A 0->127 linear ramp over any length yields exactly 128 messages at most. Bipolar pan: `v = clamp(round(64 + pan * 63), 0, 127)` -> -1 = 1, 0 = 64, +1 = 127 (I; spec defines 0 = hard left, so optionally map -1 to 0).
- **To SMF 14-bit CC / pitch bend:** same grid, `v14 = clamp(round(norm * 16383), 0, 16383)`; pitch bend `v14 = clamp(round(8192 + bend * 8192), 0, 16383)`; oracles: bend -1 -> `00 00`, -0.5 -> `00 20`, 0 -> `00 40`, +0.5 -> `00 60`, +1 -> `7F 7F` (LSB, MSB).
- **From SMF CC:** each CC event becomes a `hold` point (the MIDI value holds until the next message). Optional simplification: merge runs into `linear` points when the max deviation of the linear fit from the stepped values is <= 1 LSB (1/127).
- **To DAWproject:** hold -> `interpolation="hold"`, linear -> `"linear"`, power -> densify into linear points every 1/32 note (0.125 beat) then drop interior points whose removal keeps max error <= 0.001 normalized; always write `interpolation` explicitly.
- **To Ableton:** hold -> two breakpoints (t1 - 1 tick, a) and (t1, b); linear -> breakpoints; power -> densified breakpoints (curve parameter undocumented).
- **To FL automation clip (if ever written):** hold -> Hold, linear -> Single curve with tension 0 (reset), power -> densified Single-curve points.
- **Tempo lanes:** SMF tempo is piecewise constant; a linear/power tempo ramp must be stepped: emit one FF 51 per 1/16 note (240 ticks) with the tempo evaluated at the step start. Keep the render engine using the same stepped map so audio and MIDI agree exactly.
- **Web Audio (preview only):** hold -> setValueAtTime; linear -> linearRampToValueAtTime; power -> setValueCurveAtTime with >= 64 samples.

---

## 5. Stem export conventions

### 5.1 FL Studio (V, [FL-EXPORT])
- "Split Mixer Tracks - Each Mixer track is exported as a separate .wav file." Include: Master, Current (optional stems). Not available for flac/mp3/ogg. Muted mixer tracks (incl. Master) are not exported. "Master FX are only included on the Master Track export." Mixer tracks not routed (directly or indirectly) to the Master are not rendered. V
- "Enable master effects ... has no effect on 'Split mixer tracks' rendering as they bypass the Master." V
- Tail: Leave remainder (default; extends to capture decay), Wrap remainder (wraps tail to start, for loops), Cut remainder. V
- WAV bit depth options: 16-bit int, 24-bit int, 32-bit float; "Sample rate - The output (Mixer) sample rate is set in the Audio Settings window." V
- "Trim PDC silence - The default is ON" (removes plugin-delay-compensation silence at the start). V
- Returns: FL has no separate "return" concept; a reverb/delay bus is just another mixer track and renders as its own file; the dry source file does not contain the send's wet signal. I (manual silent on sends; follows from per-mixer-track rendering).
- File naming: the export filename is used as a prefix plus the mixer track name (forum report, e.g. `ProjectName_Kick.wav`). V (user forum, not manual) [FL-FORUM]; exact separator unspecified. I

### 5.2 Ableton Live 12 (V, [LIVE-FILES])
- Rendered Track options: Main, All Individual Tracks, Selected Tracks Only, (individual track names). V
- "All Individual Tracks - The post-fader signal at the output of each individual track, including Group Tracks, return tracks and the Main track ... Live creates a separate audio file for each track." MIDI tracks without instrument or audio effects are skipped. "All exported files will have the same length, which makes it easy to align them." V (quoted from the fetched Live 12 manual; so **yes, return and Main tracks are included** as separate files).
- "Include Return and Main Effects - When exporting individual or selected tracks, you can enable this option to also include the signal from any return tracks used by the tracks, as well as any effects used on the Main track." (off = dry-of-returns stems, returns delivered separately). V
- Group tracks render with group effects; their child tracks also render (without group FX). V [ABL-STEMS]
- Render Start / Render Length default to the entire Set. V
- Bit Depth: 16, 24 or 32; Dither: No Dither, Rectangular, Triangular (default), POW-r 1/2/3; dithering only below 32-bit. Sample rate chooser; no single default documented beyond the Set's rate. V. Ableton's stem guide recommends whole-arrangement range, Normalize/Mono/Loop off, WAV/AIFF, 32-bit. V [ABL-STEMS]
- Naming: track name appended to the name given in Save As (12.4.3 notes). V [LIVE-RN]

### 5.3 Logic Pro / GarageBand / Bitwig (V)
- Logic: File > Export > All Tracks as Audio Files: one file per audio/software-instrument/Drummer track; filename Pattern builder; options Bypass Effect Plug-ins, Include Audio Tail, Include Volume/Pan Automation, bit depth, Normalize. V [LOGIC-EXPORT]
- GarageBand: Share > Export Song to Disk = one stereo file; no batch per-track export documented. V [GB-EXPORT]
- Bitwig: File > Export Audio selects tracks/groups/Project Master; sample rate defaults to "Current"; Pre-fader option ignores mixer volume automation, described as useful for stems. V [BW-EXPORT]

### 5.4 What producers/mixers expect (V/I)
- Every file starts at the same session start and ends at the same end. V [KOBY], [IZ-STEMMASTER]
- Same sample rate and bit depth as the session; WAV. V [KOBY]. 24-bit/48 kHz is a practical recording recommendation, not a universal delivery rule. V [LANDR]
- Descriptive names, optionally zero-padded order prefix (`01_Kick`). V [KOBY]
- Print sound-design-critical FX; optionally provide clean (dry) versions; reverbs/delays sometimes delivered as their own stems. V [KOBY], [IZ-STEMS]. No master-bus limiting on stems. V [IZ-STEMMASTER]
- Terminology: "stems" = mixed groups; individual parts = multitracks. V [IZ-STEMS]. NI "Stems" (`.stem.mp4`) is a distinct 4-part container (e.g. drums, bass, synths, vocals). V [NI-STEMS]
- Sum check (I): with no master processing and returns delivered separately, `sum(all stems) == master mix` sample-for-sample (within float rounding). This is the key test oracle for music2.

---

## 6. Implementation contract suggestions (I unless marked)

### 6.1 SMF writer
1. **Format 1**, PPQ **960** (`division = 03 C0`). Also offer `--format 0` (merge all tracks, stable sort) for simple players.
2. **Track 0 (conductor)**, in this order at tick 0: `FF 03` song title; `FF 58 04 nn dd cc 08`; `FF 59 02 sf mi` (only if key known); `FF 51 03 tttttt`; then `FF 06` markers for each section (e.g. "Intro", "Verse 1") at their start ticks; later tempo/time-signature changes at their ticks; `FF 2F 00` at song end tick. No channel events in track 0.
3. **Tracks 1..N**: one per instrument; `FF 03` track name at tick 0; optional `FF 04` instrument name; `Cn` program (GM program - 1) at tick 0; `Bn 07 vol`, `Bn 0A pan`, `Bn 0B 7F` at tick 0; notes; automation CCs; `FF 2F 00` at the **same song end tick** as track 0.
4. **Channels**: drums = channel 10 (status nibble 9: `99`/`89`); melodic tracks get channels 1..9, 11..16 in track order (max 15 melodic tracks); if more, error out or share channels deliberately with a warning. Never put two instruments on one channel (FL merges by channel).
5. **Notes**: Note On `9n kk vv` with vv in 1..127 (clamp velocity 0 -> 1); Note Off as explicit `8n kk 40` (release velocity 64). Rationale: FL imports vel-0 as Note Off by default, but explicit 8n is unambiguous.
6. **No running status on write** (bigger files, simpler, byte-identical diffs); **reader must support it**.
7. **Deterministic ordering** at equal ticks: metas (03, 58, 59, 51, 06, 07) -> program change -> CC (ascending controller number, MSB before LSB) -> pitch bend -> Note Off -> Note On. Note Off before Note On at the same tick prevents re-triggered same-pitch notes from being cut.
8. **Tick rounding**: `tick = Math.round(beat * 960)`; durations: `offTick = max(onTick + 1, round(endBeat * 960))`.
9. **Tempo**: `usPerQn = Math.round(60_000_000 / bpm)`; clamp bpm to [20, 999]; ramps stepped every 240 ticks (see 4.5).
10. **Text**: ASCII only; non-ASCII -> `?`; max 255 bytes per text meta (keeps VLQ length to 1..2 bytes, simple tests).
11. Do not emit `FF 21` (MIDI port; not defined in SMF 1.0 RP-001), `FF 54` (SMPTE offset) or `FF 20` (channel prefix). Reader skips them by length.

### 6.2 SMF reader
- Accept formats 0/1 (reject 2 with a clear error or treat as format 1), any PPQ 1..32767; for SMPTE division compute seconds directly: `sec = ticks / (fps * tpf)` with fps 24/25/29.97/30.
- Honor MThd length > 6; skip unknown chunks; skip unknown metas by length; allow longer-than-expected known metas.
- Running status; reset at each MTrk and after any FF/F0/F7; error on data byte with no running status.
- `9n kk 00` == Note Off; pair notes FIFO per (channel, key); a Note On on an already-sounding (ch,key) closes the previous one (I: common practice); unterminated notes end at End of Track.
- Tempo map: collect FF 51 from track 0 (and, leniently, from any track in format 1 with a warning); default 500000 us (120 BPM) and 4/4 if absent (V [SMF]).
- Guard: VLQ > 4 bytes -> error; chunk length past EOF -> error; missing FF 2F -> warn and accept.

### 6.3 Stem export (music2 renderer)
- One WAV per instrument track, **plus** one per FX return bus, **plus** `00_Master.wav`; all start at sample 0 = bar 1 beat 1 and have identical length = song end + tail (default tail 2.0 s, or until all buses fall below -90 dBFS, whichever is longer, then rounded up to a whole sample count shared by all files).
- Defaults: 48000 Hz, 24-bit PCM (option `--bit-depth 32f`); no dither on 32-bit float; if 16/24-bit, deterministic TPDF dither with a fixed seed or no dither (default: none, documented).
- Stems are **post-insert, post-fader, pre-master, dry of sends**; returns are separate files (Ableton default behaviour with "Include Return and Main Effects" off). Optional `--wet-stems` prints each track's send contribution into its own file (Ableton "Include Return and Main Effects" analogue, minus master FX).
- Naming: `NN_<TrackName>.wav` (NN zero-padded in track order, `00_Master`), ASCII `[A-Za-z0-9_-]`, returns as `RNN_<ReturnName>.wav` sorted after tracks.
- Master processing (limiter etc.) only on `00_Master.wav`. Test oracle: `sum(stems + returns)` equals the pre-master-FX master bus within 1e-6 (float) / 1 LSB (24-bit).

---

## 7. Byte-level test fixtures

All fixtures below were generated with a writer following section 6 and decoded by an independent parser in this session (event counts and absolute ticks checked). Hex is space-separated, uppercase.

**F0 spec oracle** (V, [SMF]): the 81-byte format-0 example in section 1.9. Reader must yield ticks 0,0,0,0,0,0,0,96,192,384,384,384,384,384 and 7 notes-on/offs as listed.

**F1 empty format-0 file, PPQ 960** (26 bytes):
```
4D 54 68 64 00 00 00 06 00 00 00 01 03 C0 4D 54 72 6B 00 00 00 04 00 FF 2F 00
```

**F2 format-1, conductor + bass, 2 bars 4/4, 120 -> 140 BPM at bar 2, markers** (133 bytes):
```
4D 54 68 64 00 00 00 06 00 01 00 02 03 C0
4D 54 72 6B 00 00 00 3C
00 FF 03 04 44 65 6D 6F            name "Demo"
00 FF 58 04 04 02 18 08            4/4
00 FF 59 02 00 00                  C major
00 FF 51 03 07 A1 20               120 BPM
00 FF 06 05 49 6E 74 72 6F         marker "Intro" @0
9E 00 FF 06 05 56 65 72 73 65      marker "Verse" @3840
00 FF 51 03 06 8A 1B               140 BPM @3840
9E 00 FF 2F 00                     EOT @7680
4D 54 72 6B 00 00 00 2B
00 FF 03 04 42 61 73 73            name "Bass"
00 C0 21                           program wire value 33 = GM program 34 (Electric Bass, finger)
00 B0 07 64                        CC7 = 100
00 B0 0A 40                        CC10 = 64
00 90 24 64                        C2(36) on vel 100 @0
87 40 80 24 40                     off @960
96 40 90 2B 5A                     G2(43) on vel 90 @3840
83 60 80 2B 40                     off @4320
9A 20 FF 2F 00                     EOT @7680
```
Timing oracle: tick 3840 = 2.000000 s; tick 4320 = 2 + 480/960 * 0.428571 = 2.2142855 s; tick 7680 = 3.714284 s.

**F3 drums on channel 10** (91 bytes): kick 36 + closed hat 42 at 0 (off at 240), snare 38 at 960 (off at 1200), EOT at 3840:
```
4D 54 68 64 00 00 00 06 00 01 00 02 03 C0
4D 54 72 6B 00 00 00 14 00 FF 51 03 07 A1 20 00 FF 58 04 04 02 18 08 9E 00 FF 2F 00
4D 54 72 6B 00 00 00 29 00 FF 03 05 44 72 75 6D 73 00 99 24 6E 00 99 2A 50 81 70 89 24 40 00 89 2A 40 85 50 99 26 69 81 70 89 26 40 94 50 FF 2F 00
```

**F4 controllers, format 0, ch 1** (69 bytes): pitch bend centre, 14-bit CC1 = 8192 (MSB 40, LSB 00), CC74 = 64, bend max @240, bend min + channel pressure 100 @480, sustain on @720, sustain off + bend centre @960:
```
4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
4D 54 72 6B 00 00 00 2F
00 E0 00 40  00 B0 01 40  00 B0 21 00  00 B0 4A 40
81 70 E0 7F 7F
81 70 E0 00 00  00 D0 64
81 70 B0 40 7F
81 70 B0 40 00  00 E0 00 40
00 FF 2F 00
```

**F5 reader-only: running status + velocity-0 note-off, PPQ 96** (39 bytes):
```
4D 54 68 64 00 00 00 06 00 00 00 01 00 60 4D 54 72 6B 00 00 00 11 00 90 3C 64 60 3C 00 00 40 64 60 40 00 00 FF 2F 00
```
Expected: C4(60) on @0, off @96 (vel-0), E4(64) on @96, off @192, EOT @192.

**F6 SMPTE division** (26 bytes): 25 fps x 40 ticks/frame = 1 ms per tick (division `E7 28`):
```
4D 54 68 64 00 00 00 06 00 00 00 01 E7 28 4D 54 72 6B 00 00 00 04 00 FF 2F 00
```

**Negative/robustness fixtures (hex, expected error):**
- MThd length 8 with 2 extra bytes: `4D 54 68 64 00 00 00 08 00 00 00 01 03 C0 AB CD` + F1's MTrk -> must parse (ignore `AB CD`).
- Alien chunk between tracks: insert `58 58 58 58 00 00 00 02 00 00` before an MTrk -> must be skipped.
- Running status at track start: `4D 54 72 6B 00 00 00 04 00 3C 64 00` -> error "running status without status".
- Running status after meta: `... 00 FF 06 01 41 00 3C 00 ...` -> error (metas cancel running status, V [SMF]).
- 5-byte VLQ `80 80 80 80 00` -> error.
- Truncated chunk: MTrk length larger than remaining bytes -> error.

**VLQ unit table**: the 12 official rows in 1.5 plus the PPQ-960 table.

**Tempo unit table**: the BPM table in 1.8.

---

## 8. Open items / blockers
- FL Studio: tempo and marker import behaviour for .mid is not documented in the fetched manual pages (unverified; needs a hands-on test).
- GarageBand: tempo/time-signature/CC handling on MIDI import not documented on fetched pages.
- FL automation tension numeric range/equation and REAPER shape integer mapping + tension range: not found in official text.
- The MIDI Association hosts the official SMF PDF behind a member download; the text used here is the identical RP-001 (rev. Feb 1996) filed publicly as a USPTO exhibit, plus the archive.org copy of the Complete MIDI 1.0 Detailed Specification 96.1.

---
## Sources

Specifications
- [SMF] Standard MIDI Files 1.0, RP-001, MMA, revised Feb 1996 (public USPTO exhibit copy, full text read): https://ptacts.uspto.gov/ptacts/public-informations/petitions/1553981/download-documents?artifactId=UKOIcYw1v1hCY2BnlK9WfmIw_cYCiIXB2wU8BJ4DRF7tsWghy2DfCl8
- MIDI Association SMF landing page (official, member download): https://midi.org/standard-midi-files-specification
- [M1] Complete MIDI 1.0 Detailed Specification 96.1 (archive.org, full text read): https://archive.org/details/Complete_MIDI_1.0_Detailed_Specification_96-1-3 (text: https://archive.org/download/Complete_MIDI_1.0_Detailed_Specification_96-1-3/Complete_MIDI_1.0_Detailed_Specification_96-1-3_djvu.txt)
- MIDI Association MIDI 1.0 Detailed Spec landing page: https://midi.org/midi-1-0-detailed-specification
- [CC] MIDI 1.0 Control Change Messages table: https://midi.org/midi-1-0-control-change-messages
- [MSG] Summary of MIDI 1.0 Messages: https://midi.org/summary-of-midi-1-0-messages
- [DP-XSD] DAWproject schema (MIT): https://github.com/bitwig/dawproject/blob/main/Project.xsd
- [DP-README] DAWproject README: https://github.com/bitwig/dawproject/blob/main/README.md (repo: https://github.com/bitwig/dawproject; Reference.html fetched but not relied on: https://github.com/bitwig/dawproject/blob/main/Reference.html)
- [WEBAUDIO] W3C Web Audio API 1.1: https://www.w3.org/TR/webaudio-1.1/ ; historical equations: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html ; changelog: https://www.w3.org/TR/2015/WD-webaudio-20151208/changelog.html ; MDN: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setValueCurveAtTime

FL Studio (Image-Line manual)
- [FL-MIDIIMP] https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/automation_midiimport.htm (also https://cluster.image-line.com/fl-studio-learning/fl-studio-online-manual/html/automation_midiimport.htm)
- [FL-PRMIDI] https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_midi.htm
- [FL-AUTOCLIP] https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/playlist_automationclip.htm (beta manual: https://www.image-line.com/fl-studio-learning/fl-studio-beta-online-manual/html/playlist_automationclip.htm)
- [FL-EXPORT] https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/fformats_save_export.htm
- [FL-FORUM] https://forum.image-line.com/viewtopic.php?t=342316 (user report)

Ableton
- [LIVE-FILES] https://www.ableton.com/en/live-manual/12/managing-files-and-sets/
- [LIVE-ARR] https://www.ableton.com/en/live-manual/12/arrangement-view
- [LIVE-AUTO] https://www.ableton.com/en/manual/automation-and-editing-envelopes/
- [LIVE-CLIPENV] https://www.ableton.com/en/manual/clip-envelopes/
- [ABL-MIDIFILES] https://help.ableton.com/hc/en-us/articles/209068169-Understanding-MIDI-files
- [ABL-TEMPOMAP] https://help.ableton.com/hc/en-us/articles/360003387979-Importing-a-tempo-map
- [ABL-STEMS] https://help.ableton.com/hc/en-us/articles/360000843404-Importing-and-exporting-stems
- [LIVE-RN] https://www.ableton.com/en/release-notes/live-12/
- https://forum.ableton.com/viewtopic.php?t=253571 (consulted, not relied on)

Bitwig
- [BW-AUTO] https://www.bitwig.com/userguide/latest/automation
- [BW-BROWSER] https://www.bitwig.com/userguide/latest/browsers
- https://www.bitwig.com/userguide/latest/midi_controllers
- [BW-EXPORT] https://www.bitwig.com/userguide/latest/exporting_audio
- [BW-RN328] https://downloads.bitwig.com/stable/3.2.8/Release-Notes-3.2.8.html
- [BW-RN525] https://www.bitwig.com/dl/Bitwig%20Studio/5.2.5/release_notes/
- Consulted: https://downloads.bitwig.com/4.3.8/Release-Notes-4.3.8.html ; https://downloads.bitwig.com/5.0.9/Release-Notes-5.0.9.html ; https://downloads.bitwig.com/stable/1.1.11/Release-Notes-1.1.11.html ; https://www.bitwig.com/support/technical_support/dawproject-file-format-faqs-62/

Apple
- [GB-IMPORT] https://support.apple.com/guide/garageband/import-audio-and-midi-files-gbndd01649ed/mac
- [GB-AUTO] https://support.apple.com/guide/garageband/use-automation-in-the-piano-roll-editor-gbnd0fa9da54/mac
- [GB-EXPORT] https://support.apple.com/guide/garageband/export-songs-to-disk-or-icloud-gbnd7cbf5ed9/mac
- [LOGIC-EXPORT] https://support.apple.com/guide/logicpro/export-tracks-as-audio-files-lgcpb27f70f9/mac

REAPER
- [REAPER-UG] https://www.reaper.fm/userguide/ReaperUserGuide779a.pdf
- [REASCRIPT] https://www.reaper.fm/sdk/reascript/reascripthelp.html

Stem delivery practice
- [IZ-STEMS] https://www.izotope.com/community/blog/stems-and-multitracks
- [IZ-STEMMASTER] https://www.izotope.com/community/blog/stem-mastering
- [KOBY] https://kobynelson.com/preparing-tracks-for-mixing-the-ultimate-guide/
- [LANDR] https://blog.landr.com/sample-rate-bit-depth/ ; https://support.landr.com/hc/en-us/articles/115009556747-What-are-LANDR-s-track-upload-guidelines
- [NI-STEMS] https://www.native-instruments.com/ni-tech-manuals/traktor-play-user-guide/en/working-with-stems
- https://www.stems-music.com/stems-is-for-producers (fetch failed, certificate mismatch; not used)

Method note: DAW-manual sections were gathered by three parallel gpt-6-sol subagents (read-only web). The load-bearing claims (Ableton "All Individual Tracks" wording, "Include Return and Main Effects", bit depth/dither; FL import options, Split Mixer Tracks, Trim PDC, sample-rate note) were re-read directly from the fetched pages in the parent session. GM program name in fixture F2's comment is from general knowledge (I). No GPL/AGPL/LGPL source code was read.
