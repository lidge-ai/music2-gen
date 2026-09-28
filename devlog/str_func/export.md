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

`src/cli/commands/export.ts` writes stem plans. Future ALS and DAWproject exporters may reuse `ExportPlan<D>` without changing the stem manifest.

## Sync Checklist

- [ ] Keep descriptor order, manifest keys and CLI output order aligned.
- [ ] Recheck track/return IDs and frame alignment when audio-track rendering changes.
- [ ] Recheck float summation and legacy render digests when the mixer changes.
- [ ] Keep `src/export/index.ts` and this document aligned.

## Experimental Ableton Live 12 export

`planAls(project, rendered, {content,bits})` is a pure planner. `src/export/als.tool.ts` validates one tick-zero tempo/meter and aligned captured stems, then emits deterministic gzip XML plus portable `Samples/Imported` WAV descriptors. The authored skeleton is in `als/skeleton.tool.ts`; `clips.tool.ts`, `automation.tool.ts`, and `tracks.tool.ts` own arrangement clips, native mixer envelopes, and audible/muted track policy. Shared `xml.tool.ts` and `gzip.tool.ts` provide ordered XML and a fixed gzip header; the XML writer is reusable by DAWproject.

The set is experimental until a human opens it in Ableton Live 12. MIDI content has editable notes with empty instruments; audio content has frozen premaster playback; both mutes MIDI to avoid doubling. Frozen audio omits music2 mastering, and the empty Live return tracks do not reproduce effects. `planAls` always starts warnings with `ALS_EXPERIMENTAL`. Structural reader tests prove only self-consistency, not Ableton acceptance.
