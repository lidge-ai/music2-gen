# Use Cases — Structure & Functions

## File Tree

```text
src/usecases/
├── usecase.schema.ts  # IDs, preset metadata and genre constraints
├── usecase.tool.ts    # arrangement recommendation and pure song transformation
├── usecase.test.ts    # exact frames, mix, structure and error vectors
└── index.ts           # feature boundary
```

## Module Responsibility

Use cases turn a validated recipe song into a destination-specific source song. The tool clones the input, chooses exact bar/BPM/tail combinations against the renderer's `ceil` frame rule for duration presets, reshapes sections through the recipe builder, and sets `master`, `useCase`, and whole-song `loop` fields. It performs no I/O and adds no runtime dependency. `src/song/song.schema.ts` owns the canonical `UseCaseId` union so song validation does not import this feature.

Before cloning, `applyUseCase` rejects note lists, nonempty `audioTracks`, and
nonempty automation on music or audio tracks with `E_INPUT`. The error names
present features in that order because rearrangement would move absolute media.

## Key Function Signatures

| Export | Purpose |
| --- | --- |
| `USE_CASES: readonly UseCasePreset[]` | Stable preset metadata and mix targets. |
| `isUseCaseId(value: string): value is UseCaseId` | Validate a CLI preset ID. |
| `recommendedArrangement(id: UseCaseId, genre: RecipeId): string` | Choose a starting form before explicit `--arrangement`. |
| `applyUseCase(song: Song, id: UseCaseId, opts?: {seconds?: number; lockedBpm?: number}): Song` | Clone and transform the already-built song. |

## Dependencies

- `src/song` supplies the song contract and validation.
- `src/recipes` supplies genre card ranges and the shared arrangement builder.
- `src/shared` supplies typed input errors.

## Dependents

- `src/cli/commands/new.ts` chooses the recommendation, builds a source song, then applies a preset.
- `src/index.ts` exports the preset boundary to library callers.

## Sync Checklist

- Keep the preset IDs in `src/song/song.schema.ts` aligned with `USE_CASES`.
- Keep duration choices and sample-frame arithmetic aligned with `src/render/mixer.tool.ts`.
- Update `docs/cli.md`, focused tests and generated genre docs when defaults change.
