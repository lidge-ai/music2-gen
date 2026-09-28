# Export — Structure & Functions

`src/export` builds deterministic, relative-path artifact plans. It does not render audio or write files.

## File Tree

```text
src/export/
├── export.schema.ts   # generic ExportPlan<D> and file descriptors
├── manifest.schema.ts # ordered stem manifest and validation
├── stems.tool.ts      # pure stem bundle planner and float sum proof
├── stems.test.ts      # contract vectors
└── index.ts           # public feature boundary
```

## Module Responsibility

`planStems` matches captured renderer stems by track ID, orders track/return/master WAV descriptors, projects section placements into crop-relative markers, and appends `stems.json` last. The manifest uses relative POSIX paths and stable insertion order. `validateStemsManifest` checks path uniqueness, alignment, sample finiteness, and marker positions. The renderer checks the Float32 component sum against its pre-master buffer before master processing. When a pre-master buffer is exposed, the planner checks it again.

The CLI owns rendering once, directory policy, per-file staging, WAV writing, and atomic batch commit through `src/cli/files.ts`. Default bit depth is 24; `--premaster`, `--no-master`, `--bars a:b`, and `--force` select the bundle shape. Legacy `render --stems` remains on its existing path.

## Key Function Signatures

| Export | Signature | Role |
|---|---|---|
| `ExportPlan<D>` | `{ files: ExportFile[]; data: D }` | Generic ordered artifact plan for later DAW exporters. |
| `planStems` | `(song: ResolvedSong, timeline: Timeline, result: RenderResult, options: StemsOptions): ExportPlan<StemsData>` | Pure stem bundle planning. |
| `serializeStemsManifest` | `(manifest: StemsManifest): Uint8Array` | Stable UTF-8 JSON plus LF. |
| `validateStemsManifest` | `(manifest: StemsManifest, files: ExportFile[]): void` | Relative path and PCM alignment gate. |

## Dependencies

Song and Timeline provide tracks, bus parameters and placements; RenderResult provides captured Float32 audio; audio-io supplies `StereoBuffer`; shared supplies deterministic hash seeds and typed errors. There are no filesystem imports or runtime package dependencies in this feature.

## Dependents

`src/cli/commands/export.ts` writes stem, ALS, and DAWproject plans through the shared `ExportPlan<D>` contract.

## Sync Checklist

- [ ] Keep descriptor order, manifest keys and CLI output order aligned.
- [ ] Recheck track/return IDs and frame alignment when audio-track rendering changes.
- [ ] Recheck float summation and legacy render digests when the mixer changes.
- [ ] Keep `src/export/index.ts` and this document aligned.

## Experimental Ableton Live 12 export

`planAls(project, rendered, {content,bits})` is a pure planner. `src/export/als.tool.ts` validates one tick-zero tempo/meter and aligned captured stems, then emits deterministic gzip XML plus portable `Samples/Imported` WAV descriptors. The authored skeleton is in `als/skeleton.tool.ts`; `clips.tool.ts`, `automation.tool.ts`, and `tracks.tool.ts` own arrangement clips, native mixer envelopes, and audible/muted track policy. Shared `xml.tool.ts` and `gzip.tool.ts` provide ordered XML and a fixed gzip header; the XML writer is reusable by DAWproject.

The set is experimental until a human opens it in Ableton Live 12. MIDI content has editable notes with empty instruments; audio content has frozen premaster playback; both mutes MIDI to avoid doubling. Frozen audio omits music2 mastering, and the empty Live return tracks do not reproduce effects. `planAls` always starts warnings with `ALS_EXPERIMENTAL`. Structural reader tests prove only self-consistency, not Ableton acceptance.

For MIDI content, `planAls` emits `PLUGIN_NOT_PORTABLE:<trackId>` once for every ProjectIR track with a nonempty plugin chain. Its existing empty-instrument warning still applies. Frozen audio is required to retain external plugin sound; plugin device state is not serialized into ALS. Any ProjectIR path-sanitization warnings are carried into the plan.

## DAWproject 1.0 export

`planDawproject(project, media, regions, {content, outputName, kitMaps?})` accepts validated ProjectIR plus supplied WAV bytes and resolved source regions. It returns one `ExportPlan<DawData>` ZIP descriptor and mapping warnings. `src/export/dawproject/project-xml.tool.ts` builds transport, mixer, editable/frozen tracks, notes, original and frozen audio warps, markers, and raw gain/pan automation. It assigns IDs in XML document order, resolves typed references, and uses the shared `xml.tool.ts` serializer. `metadata-xml.tool.ts` emits schema-ordered title/comment. The planner validates embedded RIFF headers against media descriptors, then calls the zero-dependency `writeStoreZip` with `metadata.xml`, `project.xml`, and lexically sorted WAV entries. No filesystem path, clock or output filename enters ZIP bytes.

`midi` keeps editable tracks; `audio` uses frozen dry stems and effect returns; `both` adds muted editable tracks beside active frozen playback. Instrument/effect device state and mastering are not portable, and warnings identify omitted/approximate mappings. Official D16 Bitwig XSDs and license are pinned by SHA-256 in `tests/fixtures/dawproject/`; `tests/e2e/dawproject.test.ts` validates both XML files with xmllint when present. Linux CI installs `libxml2-utils` and requires that validator. A named DAW import remains unverified.

For MIDI content, `planDawproject` emits `PLUGIN_NOT_PORTABLE:<trackId>` once per nonempty ProjectIR plugin chain alongside its general sound-portability warning. Frozen audio is required to retain plugin processing. ProjectIR path-sanitization warnings also pass through to the plan.

## Built-in sampled instruments and voice policy

ALS MIDI clip planning and DAWproject XML add a sound portability warning for `lib:` tracks. Their editable notes and frozen-audio modes retain the existing contracts.
