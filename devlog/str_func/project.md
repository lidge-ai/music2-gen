# Project — Structure & Functions

ProjectIR is a deterministic 960-PPQ projection of a validated song and its full Timeline. The contract is specified in `devlog/_plan/260928_music2_daw_bridge/010_project_ir.md` §3.

## File Tree

```text
src/project/
├── index.ts          # public feature boundary
├── project.schema.ts # IR exchange types
├── build.tool.ts     # pure Song + Timeline projection
└── build.test.ts     # marker, sample, quantization and mono vectors
```

## Module Responsibility

`project.schema.ts` owns the serialized `ProjectIR` shape. `build.tool.ts` maps the full Timeline to tick notes while preserving each event's per-track index, adds arrangement markers, projects clip references into a sorted deduplicated sample table, and reports pattern quantization error. It never reads files or alters render timing. Array order is semantic: song tracks precede audio tracks, markers follow placements, note order follows tick and original event index, and samples sort by role then ref.

Instrument tracks copy an optional resolved plugin chain into `ProjectTrackBase.plugins`, preserving order, ID, supported format/ref identifiers, and resolved parameter values. An absent chain leaves the property absent, so plugin-free IR JSON keeps its previous bytes; an explicit empty chain stays empty. Song v1 currently resolves only ID and parameters. If a future resolved plugin supplies an absolute `ref`, the builder records only its basename and adds `PLUGIN_REF_BASENAME:<trackId>:<pluginId>` to the optional IR warnings. Host commands, configured binary paths and presets do not enter IR.

## Key Function Signatures

| Export | Signature | Role |
|---|---|---|
| `buildProject` | `(song: ResolvedSong, timeline: Timeline): ProjectIR` | Pure IR projection. |
| `ProjectIR` | `interface ProjectIR` | Versioned exchange envelope with tempo, meter, markers, tracks, buses, samples and quantization. |
| `ProjectTrack`, `ProjectPlugin`, `ProjectNote`, `ProjectClip` | Public IR types | Tick-positioned musical/audio lanes and optional plugin metadata. |

Pattern onsets parse `cycleBegin` as an exact fraction and round the bar position and swing shift separately. The `quantization` counters count pattern events, inexact projections, and maximum tick error; list notes copy resolved ticks with zero error. Mono notes stop at the next later tick. Distinct onsets collapsed to the same tick drop the earlier note and add an inexact warning count.

## Dependencies

`src/project` imports only the public `src/song` and `src/shared` boundaries. It has no render, CLI, filesystem, clock or random dependency.

## Dependents

The public library API (`src/index.ts`) and `music2 export ir` use `src/project/index.ts`. Later MIDI, stem and DAW exporters consume ProjectIR without changing the legacy renderer.

## Sync Checklist

- [ ] Keep `project.schema.ts`, builder output key order and export consumers aligned.
- [ ] Recheck fraction/swing quantization, occurrence names, mono clipping and sample indices when Song or Timeline changes.
- [ ] Verify deterministic serialization and legacy render byte identity after projection changes.
