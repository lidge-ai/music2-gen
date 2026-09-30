# 011 — wp2 stale check and dispatch split

Previous D (wp1): roadmap locked after four audit rounds; next is wp2 per 010 including folds B1–B3, B6, B8, B10, R2-1, R2-2. Direction unchanged. Stale check: HEAD is `origin/dev` + roadmap commits only; every anchor in 010 still resolves (`paths.tool.ts` `StorageKind`, `instrument.tool.ts`, `kit.tool.ts` `loadKit`/`loadKitMidiMap`, `project.schema.ts` `ProjectInstrument`, `export.ts` subcommand dispatch, `lint-geometry.tool.ts` `kitRoleSample`, `lint-roles.tool.ts` `isSampledMelody`).

## Shared interfaces (fixed before dispatch so three workers can run in parallel)

`src/shared/paths.tool.ts`: `StorageKind` gains `"library" | "instruments"`.

`src/audio-io/wav-meta.tool.ts`: `readWavSmpl(bytes: Buffer): { unityNote: number | null; pitchFraction: number; loop: { start: number; end: number } | null; warnings: string[] }` (moved from `sfz-render.tool.ts`; sfz-render maps warnings to its own `SfzWarning`).
`src/audio-io/aiff.tool.ts`: `decodeAiff(bytes: Buffer): { sampleRate: number; channels: Float32Array[]; bits: number; baseNote: number | null; loop: { start: number; end: number } | null }`.
Both exported from `src/audio-io/index.ts`.

`src/sampler/user-instrument.tool.ts` (exported from `src/sampler/index.ts`):
```ts
export const USER_ID_PATTERN: RegExp; // /^[a-z0-9][a-z0-9-]{0,47}$/
export interface UserZone { file: string; named: number | null; measured: number; offset: number; confidence: number; lokey: number; hikey: number }
export interface UserInstrumentManifest { version: 1; id: string; kind: "sfz" | "kit"; entry: string; role?: string;
  source: { folder: string }; zones?: UserZone[]; variants?: Record<string, string[]>; warnings: string[] }
export function userInstrumentsDir(): string; // storageDir("instruments")
export function parseUserManifest(input: unknown, id: string): UserInstrumentManifest; // E_SCHEMA on bad shape
export async function readUserManifest(id: string): Promise<{ root: string; entryPath: string; manifest: UserInstrumentManifest }>; // E_SCHEMA bad id, E_CAPABILITY "user instrument <id> is not imported" when missing, E_ACCESS on escape
export async function listUserInstruments(): Promise<UserInstrumentManifest[]>; // sorted by id, skips dirs starting with "."
```

`src/library/index.ts`:
```ts
export function defaultSampleRoots(): string[]; // darwin list or MUSIC2_SAMPLE_ROOTS; only existing dirs
export async function scanLibrary(roots: string[]): Promise<LibraryIndex>; // throws E_CAPABILITY when roots is empty
export async function writeLibraryIndex(index: LibraryIndex): Promise<string>; async function readLibraryIndex(): Promise<LibraryIndex | null>;
export function findCandidates(index: LibraryIndex, words: string[], kind?: "instrument" | "kit", limit?: number): CandidateFolder[];
export async function importFolder(folder: string, options: ImportOptions): Promise<ImportReport>;
export async function verifyInstrument(id: string, notes?: number[]): Promise<VerifyReport>;
export function measureRoot(...); measureAny(...);
```
`ImportOptions { id: string; as?: "instrument" | "kit" (default: kit when drum words dominate, else instrument); filter?: string; octave?: "auto" | "none" | number; attackSeconds?: number; releaseSeconds?: number; force?: boolean }`; `ImportReport { id, kind, instrument: "user:<id>", dir, files: { source: string /* basename */, named, measured, offset, confidence, atom?, variant? }[], warnings }`; `VerifyReport { id, notes: { want, got, cents, ok }[], ok }`.

## Workers (sol, disjoint write scopes)

| Worker | Writes | Reads |
|---|---|---|
| L1 core | `src/audio-io/{aiff,wav-meta}.tool.ts`+tests, `src/audio-io/index.ts`, `src/sampler/sfz-render.tool.ts` (import move only), `src/sampler/user-instrument.tool.ts`+test, `src/sampler/index.ts`, `src/shared/paths.tool.ts`, `src/library/**` | everything |
| L2 integration | `src/render/{instrument,kit}.tool.ts`+tests, `src/song/{song-daw,song}.schema.ts`, `src/render/voices/registry.tool.ts`, `src/recipes/{lint-geometry,lint-roles}.tool.ts`+tests, `src/project/{project.schema,build.tool}.ts`+tests, `src/midi/from-project.tool.ts`, `src/export/**`, `src/cli/commands/{export,instruments,doctor}.ts`+tests | L1 interfaces above |
| L3 CLI and gates | `src/cli/commands/library.ts`+test, `src/cli/registry.ts`, `tests/e2e/library-flow.test.ts`, `scripts/asset-audit.mjs`, `scripts/asset-allowlist.json`, `scripts/asset-audit.test.ts` (or under tests/), `package.json` scripts entry `audit:assets`, `.github/workflows/ci.yml` (one step), `docs/cli.md`, `devlog/str_func/{library,audio-io,sampler,render,cli,shared,export,project,recipes}.md` | L1 interfaces above |

Workers do not run git commands that change state; the coordinator integrates, runs the full gates and commits.

## Reflection fixes (architect: ALIGNED with fixes)

1. **Frozen L1 types** (`src/library/library.schema.ts`, exported from `src/library/index.ts`):
```ts
export interface CandidateFolder { path: string; name: string; category: string[]; root: string; kind: "instrument" | "kit"; files: number; pitched: number; drumHits: number; formats: Record<string, number> }
export interface LibraryIndex { version: 1; roots: string[]; instruments: CandidateFolder[]; kits: CandidateFolder[]; skipped: { caf: number; exs: number; aaz: number; other: number } }
export interface PitchEstimate { midi: number; confidence: number } // confidence 0..1 (best / (best + runner-up) harmonic product)
export function measureRoot(mono: Float32Array, rate: number, namedMidi: number | null, loop: { start: number; end: number } | null): PitchEstimate & { offset: number };
export function measureAny(mono: Float32Array, rate: number, start: number, length: number, lowMidi?: number, highMidi?: number): PitchEstimate; // quarter-tone grid
export async function readLibraryIndex(): Promise<LibraryIndex | null>; // null when the cache file is absent
```
`verifyInstrument` never throws for pitch misses; it returns `ok:false` and L3 maps that to `E_QA` exit 6. `library find` without a cache runs a scan of the default roots first. `--root` replaces default roots (not additive).

2. **Export metadata.** L1 owns `export type UserInstrumentKinds = Readonly<Record<string /* user id */, "sfz" | "kit">>` in `src/sampler/user-instrument.tool.ts`. The export CLI builds it with `readUserManifest` for every `user:` id in the ProjectIR. `user` kits additionally get their MIDI map loaded into the existing track-keyed kit maps. Consumers treat `{kind:"user"}` as `kit` when the map says kit and as `sfz` otherwise; a missing entry throws `E_CAPABILITY "user instrument <id> is not imported"`. Pitched-kit channel policy is the same as today's `kit:` on a notes track.

3. **Kit loader signature.** `loadKit(songPath, instrument, rate, root?: string)` and `loadKitMidiMap(songPath, instrument, root?: string)`: when `root` is given, `instrument` is ignored for path resolution and the kit manifest is `<root>/kit.json` (confined to `root`, samples confined to `root`). `user:` callers pass `readUserManifest(id).root`. Manifest `entry` is validated by `parseUserManifest`: relative, no `..`, extension `.sfz` (kind sfz) or the literal `kit.json` (kind kit).

4. **Tests and docs ownership.** L2 also owns `src/song/*.test.ts` touched by `user:`, `src/render/voices/registry.test.ts`, `src/midi/from-project.test.ts`, `src/export/**/*.test.ts`. L1 owns `src/sampler/sfz-render.test.ts` (parity after the move). L3 also owns `devlog/str_func/{song,midi}.md`.

5. **Asset audit tests.** `tests/e2e/asset-audit.test.ts` (runner picks up `tests/e2e`). CI step: `bun run audit:assets` = `bun scripts/asset-audit.mjs --tree --pack`; no arguments means `--tree`.

6. **Gates and staging.** Workers run only read-only checks (`bun run typecheck`, targeted `bun test <files>` via the repo runner) and never `build`, `pack` or git mutations. Import stages into `<instruments>/.staging-<id>-<pid>-<counter>`; `--force` renames the old dir to `.trash-<id>-<pid>`, renames staging into place, then removes trash; on failure staging is removed and trash restored.
