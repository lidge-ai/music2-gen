# Library — Structure & Functions

Discover local sample folders, import them into user storage, and verify instrument pitch. Source content stays outside the checkout; tests synthesize their audio at runtime.

## File Tree

```text
src/library/
├── index.ts              # public library boundary
├── library.schema.ts     # candidate, index, pitch, import and verification contracts
├── roots.tool.ts         # available default or environment sample roots
├── scan.tool.ts          # bounded deterministic discovery and index cache
├── catalog.tool.ts       # ranked case-insensitive AND search
├── names.tool.ts         # note suffixes and drum filename atoms
├── pitch.tool.ts         # harmonic pitch measurement
├── import.tool.ts        # transactional instrument/kit materialization
├── verify.tool.ts        # rendered-note pitch checks
└── *.test.ts             # generated audio and isolated storage tests
```

## Module Responsibility

Scan uses existing roots, a depth/file bound and stable ordering, recognizes pitched folders and drum one-shots, and records unsupported CAF/EXS/AAZ counts. Index version 1 contains no timestamp. Import decodes supported WAV/AIFF PCM, measures roots, writes 24-bit WAV with no `smpl`, and retains frame-exact loops in SFZ with `tune=0`. Named and measured notes, offsets and confidence are reported per source basename. `--octave auto` measures each file; `none` trusts names; integer N applies `named+12N`.

Kits map drum words to atoms and numbered files to explicit variants (`bd:0`, `bd:1`, …); plain `bd` selects variant 0. Import writes `instrument.json` alongside SFZ or `kit.json` under `$MUSIC2_HOME/instruments/<id>`. Staging is confined to user storage; forced replacement restores the prior directory on failure. `source.folder` is a basename. Verification renders requested notes, measures cents error, and returns `ok:false` for errors above 50 cents; the CLI maps that result to `E_QA` with the report in error details.

## Key Function Signatures

| Export | Contract |
|---|---|
| `defaultSampleRoots(): string[]` | Existing platform defaults or `MUSIC2_SAMPLE_ROOTS` roots. |
| `scanLibrary(roots: string[]): Promise<LibraryIndex>` | Deterministic candidates; no available roots raises `E_CAPABILITY`. |
| `parseLibraryIndex(input: unknown): LibraryIndex` | Validate version, roots, candidate counts/formats and skipped counts at the cache boundary. |
| `writeLibraryIndex(index): Promise<string>` / `readLibraryIndex(): Promise<LibraryIndex \| null>` | Cache at `$MUSIC2_HOME/library/index.json`; absent cache returns null. |
| `findCandidates(index, words, kind?, limit?): CandidateFolder[]` | AND search over paths and filenames; kind is instrument or kit. |
| `importFolder(folder: string, options: ImportOptions): Promise<ImportReport>` | ID, optional as/filter/octave/attackSeconds/releaseSeconds/force. |
| `verifyInstrument(id: string, notes?: number[]): Promise<VerifyReport>` | Defaults C3 E3 G3 C4; per-note want/got/cents/ok. |
| `measureRoot(mono, rate, namedMidi, loop): PitchEstimate & {offset:number}` | Search octave candidates, using loop or sustained portion. |
| `measureAny(mono, rate, start, length, lowMidi?, highMidi?): PitchEstimate` | Quarter-tone grid measurement for verification. |

`CandidateFolder` exposes path, name, category segments, root, kind, file count, pitched count, drum-hit count and format counts. `LibraryIndex` exposes roots, instrument/kit candidates and skipped counts. Import and verification reports are JSON-ready; pitch/import offsets are expressed in octaves. `InstrumentManifest` and `ImportedZone` are aliases of sampler's shared user types.

## Dependencies

Audio-io owns WAV/AIFF decoding and metadata; sampler owns shared user manifests, confinement and SFZ playback; shared owns storage paths, errors and deterministic primitives. Library does not import CLI or export planners. Render resolves the same sampler manifests without depending on library, avoiding a render/library cycle.

## Dependents

`src/cli/commands/library.ts` dispatches scan/find/import/verify/list and validates flags. Doctor consumes root availability. Render and export consume user identity through sampler. `scripts/asset-audit.mjs` separately gates tracked, packaged and historical audio against path plus SHA-256 provenance in `scripts/asset-allowlist.json`.

## Sync Checklist

- [ ] Keep index exports, schemas, CLI options and `docs/cli.md` aligned.
- [ ] Preserve deterministic order and basename-only provenance in import manifests.
- [ ] Keep WAV metadata removal, loop endpoints and SFZ tuning consistent.
- [ ] Keep pitch verification and CLI exit 6/report behavior aligned.
- [ ] Keep synthetic fixtures under temporary directories with fresh `MUSIC2_HOME`.
- [ ] Update the asset allowlist only for reviewed bundled assets; imported user content stays in user storage.
