# MIDI — Structure & Functions

Pure Standard MIDI File interchange. The writer emits format 1 at 960 PPQ; the bounded reader accepts format 0/1 with PPQ timing. `projectToSmf` projects ProjectIR events without changing render timing. Gain/pan lanes become CC7/CC10 at tick zero, changed 120-tick grid values, and exact point ticks. `smfToSong` imports multiple retained CC changes as Song v1 hold lanes; a sole tick-zero CC stays static. CLI validates and writes the result.

## File Tree

```text
src/midi/
├── smf.schema.ts       # event types and writer input guards
├── vlq.tool.ts          # bounded four-byte VLQ read/write
├── write.tool.ts        # deterministic format-1 byte writer
├── read.tool.ts         # bounded format-0/1 parser
├── gm.tool.ts           # GM, percussion, SFX, kit and key mappings
├── from-project.tool.ts # ProjectIR projection, channels and warnings
├── to-song.tool.ts      # note pairing and Song v1 reconstruction
└── index.ts             # public feature boundary
```

Every tool and schema has a colocated test file. All feature files import only local modules, `project` or `shared`; `from-project` consumes ProjectIR types but never changes them. `to-song` returns a structural Song v1 object and does not import the song validator. CLI is the filesystem and validation boundary.

## Key Function Signatures

| Export | Role |
|---|---|
| `writeSmf(file: SmfFile): Uint8Array` | Write deterministic type-1 SMF with explicit EOT and statuses. |
| `readSmf(bytes: Uint8Array): SmfFile` | Read format-0/1 SMF with 16 MiB input bound and chunk-local cursors. |
| `writeVlq(value: number): Uint8Array` / `readVlq(bytes, offset, end)` | Encode/decode MIDI VLQ up to `0x0FFFFFFF`. |
| `projectToSmf(project: ProjectIR, options?: { kitMaps? }): MidiProjection` | Project conductor, track identities, programs, static and automated CC7/CC10, and notes. |
| `smfToSong(file: SmfFile, options?: { title?; strict?; kitMaps? }): MidiImport` | Pair notes, convert PPQ, reconstruct Song sections, hold CC lanes and warnings. |
| `kitMidiMap(names, explicit?): { byName; warnings }` | Deterministic kit note assignment. |
| `keyToSmf(key)` / `smfToKey(sf, mi)` | Circle-of-fifths key-signature mapping. |

`SmfFile` events carry integer absolute ticks; `SmfTrack.endTick` is the EOT position. Writer requires 960 PPQ and format 1. Reader accepts 1..32767 PPQ and format 0/1; format 2 and SMPTE are capability errors. Track count and note-list limits are checked before Song output. `MidiProjection` and `MidiImport` include stable warnings, note counts and dropped-category counts.

## Dependents and Sync Checklist

`src/cli/commands/export.ts` consumes `projectToSmf` and `writeSmf`; `src/cli/commands/import.ts` consumes `readSmf` and `smfToSong`. `src/index.ts` exposes the feature boundary. When changing byte layouts or warning IDs, update `devlog/_fin/260928_music2_daw_bridge/020_midi.md` and the colocated fixtures. When changing kit mapping, keep `src/render/kit.tool.ts`'s optional manifest validation and both CLI directions synchronized. Legacy rendering must remain independent of MIDI and ProjectIR.

CC7 uses `round(127×10^(dB/40))`; CC10 uses `round(64+63×pan)`. Incoming CC7 0..3 and CC10 0 clamp to Song bounds with `MIDI_CC_CLAMPED`. Positive gain saturates CC7 and emits `gainCcClipped`. Send, insert and voice lanes retain named MIDI omission warnings. Only the first shared channel-10 drum track emits independent CCs.
