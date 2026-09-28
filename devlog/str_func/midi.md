# MIDI — Structure & Functions

Pure Standard MIDI File interchange. The writer emits format 1 at 960 PPQ; the bounded reader accepts format 0/1 with PPQ timing. `projectToSmf` projects ProjectIR events without changing render timing. `smfToSong` produces Song v1 absolute note lists; CLI validates and writes them.

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
| `projectToSmf(project: ProjectIR, options?: { kitMaps? }): MidiProjection` | Project conductor, track identities, programs, static CC and notes. |
| `smfToSong(file: SmfFile, options?: { title?; strict?; kitMaps? }): MidiImport` | Pair notes, convert PPQ, reconstruct Song sections and warnings. |
| `kitMidiMap(names, explicit?): { byName; warnings }` | Deterministic kit note assignment. |
| `keyToSmf(key)` / `smfToKey(sf, mi)` | Circle-of-fifths key-signature mapping. |

`SmfFile` events carry integer absolute ticks; `SmfTrack.endTick` is the EOT position. Writer requires 960 PPQ and format 1. Reader accepts 1..32767 PPQ and format 0/1; format 2 and SMPTE are capability errors. Track count and note-list limits are checked before Song output. `MidiProjection` and `MidiImport` include stable warnings, note counts and dropped-category counts.

## Dependents and Sync Checklist

`src/cli/commands/export.ts` consumes `projectToSmf` and `writeSmf`; `src/cli/commands/import.ts` consumes `readSmf` and `smfToSong`. `src/index.ts` exposes the feature boundary. When changing byte layouts or warning IDs, update `devlog/_plan/260928_music2_daw_bridge/020_midi.md` and the colocated fixtures. When changing kit mapping, keep `src/render/kit.tool.ts`'s optional manifest validation and both CLI directions synchronized. Legacy rendering must remain independent of MIDI and ProjectIR.
