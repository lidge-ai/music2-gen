# Shared — Structure & Functions

Common exact-time arithmetic, deterministic choice, errors, and package paths for `src/`.

## File Tree

```text
src/shared/
├── index.ts             # feature boundary exports
├── errors.tool.ts       # error codes and exit mapping
├── errors.test.ts       # mapping and error metadata
├── rational.tool.ts     # exact fractions for pattern time
├── rational.test.ts     # arithmetic, ordering, negative floor, failures
├── ticks.tool.ts        # 960-PPQ conversion and rational quantization
├── ticks.test.ts        # half-up, exactness, overflow and round-trip vectors
├── prng.tool.ts         # stable hash and seeded random draws
├── prng.test.ts         # vectors, bounds, address stability
├── paths.tool.ts        # user home and installed package discovery
└── paths.test.ts        # package metadata and home override
```

## Module Responsibility

`src/shared` supplies contracts needed by multiple features. `errors.tool.ts` owns the
machine-readable `Music2Error` and CLI exit-code mapping. `rational.tool.ts` keeps
pattern times exact as reduced fractions. `prng.tool.ts` provides deterministic
addressed choice without ambient randomness. `paths.tool.ts` locates the package
and the optional user data directory. `index.ts` exposes these as the feature's
public boundary; sibling implementations import each other directly where needed.

`ticks.tool.ts` converts beats, seconds and exact bar fractions to 960-PPQ ticks.
It rounds nonnegative positions half up, checks safe-integer output and reports
programmer misuse as `E_INTERNAL`. Pattern timing remains in rational bars and
float seconds; tick conversion does not alter existing pattern rendering.

The module has no music parsing or command-dispatch logic. Its error categories
are consumed by those boundaries, while `Fraction` and `unitHash` underpin
the pattern query engine. Paths depend on process environment and package
metadata; the arithmetic and random utilities do not.

## Key Function Signatures

Signatures below are copied from exported declarations in `src/shared`; multiline
declarations are shown on one line without changing their types. `index.ts`
re-exports all listed public members.

| Exported signature | Source | Purpose |
|---|---|---|
| `export function exitFor(code: ErrorCode): ExitCode` | `errors.tool.ts` | Map a typed error code to CLI status. |
| `export function isMusic2Error(e: unknown): e is Music2Error` | `errors.tool.ts` | Narrow an unknown thrown value. |
| `constructor(code: ErrorCode, message: string, opts: Music2ErrorOptions = {})` | `Music2Error` | Attach code, details, retryability, fix, and optional cause. |
| `get exit(): ExitCode` | `Music2Error` | Derived status from `code`. |
| `export function fnv1a32(...parts: (string | number)[]): number` | `prng.tool.ts` | Stable 32-bit hash of NUL-separated parts. |
| `export function mulberry32(seed: number): () => number` | `prng.tool.ts` | Seeded stateful generator in `[0, 1)`. |
| `export function unitHash(...parts: (string | number)[]): number` | `prng.tool.ts` | First draw at a stable address. |
| `export function barTicks(numerator: number): number` | `ticks.tool.ts` | Quarter-note meter length at 960 PPQ. |
| `export function beatsToTicks(beats: number): number` | `ticks.tool.ts` | Nonnegative beats, rounded half up. |
| `export function ticksToSeconds(ticks: number, bpm: number): number` | `ticks.tool.ts` | Tick position to seconds. |
| `export function secondsToTicks(seconds: number, bpm: number): number` | `ticks.tool.ts` | Seconds to safe integer ticks. |
| `export function fractionToTicks(bars: Fraction, numerator: number): { ticks: number; exact: boolean }` | `ticks.tool.ts` | Rational bar position and exactness. |
| `export function music2Home(): string` | `paths.tool.ts` | Resolve user data directory. |
| `export function storageDir(kind: StorageKind): string` | `paths.tool.ts` | Default folder for `renders`, `analysis`, `sfx` or `projects` inside the home. |
| `export function packageRoot(): string` | `paths.tool.ts` | Find `music2-gen` package root. |
| `export function packageVersion(): string` | `paths.tool.ts` | Read package version. |
| `constructor(n: number \| bigint, d: number \| bigint = 1)` | `Fraction` | Normalize signed rational parts. |
| `static of(n: number, d = 1): Fraction` | `Fraction` | Construct from integer numbers. |
| `static fromNumber(value: number): Fraction` | `Fraction` | Construct whole-number fraction. |
| `add(o: Fraction): Fraction` | `Fraction` | Exact addition. |
| `sub(o: Fraction): Fraction` | `Fraction` | Exact subtraction. |
| `mul(o: Fraction): Fraction` | `Fraction` | Exact multiplication. |
| `div(o: Fraction): Fraction` | `Fraction` | Exact division. |
| `neg(): Fraction` | `Fraction` | Negate numerator. |
| `cmp(o: Fraction): number` | `Fraction` | Compare using bigint products. |
| `lt(o: Fraction): boolean` | `Fraction` | Strict less-than comparison. |
| `lte(o: Fraction): boolean` | `Fraction` | Inclusive less-than comparison. |
| `gt(o: Fraction): boolean` | `Fraction` | Strict greater-than comparison. |
| `gte(o: Fraction): boolean` | `Fraction` | Inclusive greater-than comparison. |
| `eq(o: Fraction): boolean` | `Fraction` | Exact equality after reduction. |
| `floor(): number` | `Fraction` | Mathematical floor, including negatives. |
| `sam(): Fraction` | `Fraction` | Start of containing cycle. |
| `valueOf(): number` | `Fraction` | Floating-point projection. |
| `toString(): string` | `Fraction` | Integer or `n/d` representation. |
| `export function min(a: Fraction, b: Fraction): Fraction` | `rational.tool.ts` | Earlier/smaller fraction. |
| `export function max(a: Fraction, b: Fraction): Fraction` | `rational.tool.ts` | Later/larger fraction. |

### Exported constants and types

| Export | Declaration or shape | Contract |
|---|---|---|
| `EXIT` | `export const EXIT = { OK: 0, INTERNAL: 1, INPUT: 2, CAPABILITY: 3, ACCESS: 4, RENDER: 5, QA: 6, INTERRUPTED: 7 } as const` | Numeric CLI statuses. |
| `ExitCode` | `export type ExitCode = (typeof EXIT)[keyof typeof EXIT]` | Union of statuses. |
| `ErrorCode` | `export type ErrorCode = ...` | Thirteen `E_*` strings in `errors.tool.ts`. |
| `ERROR_CODES` | `export const ERROR_CODES = Object.keys(EXIT_BY_CODE) as ErrorCode[]` | Enumerates mapped codes. |
| `Music2ErrorOptions` | `export interface Music2ErrorOptions` | Optional `details`, `retryable`, `fix`, `cause`. |
| `Music2Error` | `export class Music2Error extends Error` | Typed, status-bearing error. |
| `FRACTION_LIMIT` | `export const FRACTION_LIMIT = 2 ** 40` | Maximum reduced part magnitude. |
| `PPQ` | `export const PPQ = 960` | Ticks per quarter note. |
| `Fraction` | `export class Fraction` | Reduced `n`, `d`, with `d > 0`. |

### Error and time behavior

- `E_INPUT`, `E_SCHEMA`, `E_PARSE`, and `E_NOT_FOUND` map to exit `2`.
- `E_CAPABILITY` and `E_FFMPEG_MISSING` map to exit `3`.
- `E_ACCESS` and `E_PROVIDER` map to exit `4`.
- `E_RENDER` maps to `5`; `E_QA` maps to `6`.
- `E_TIMEOUT` and `E_INTERRUPTED` map to `7`; `E_INTERNAL` maps to `1`.
- `Music2Error` preserves structured `details`; absent `retryable` is `false`.
- The fraction constructor reduces through bigint GCD and normalizes sign.
- A zero denominator, division by zero, noninteger `Fraction.of` input, or
  reduced part beyond `FRACTION_LIMIT` raises `E_INTERNAL`.
- `floor()` floors negative nonintegers toward negative infinity.
- `sam()` returns the whole-cycle start derived from `floor()`.
- `fnv1a32` hashes UTF-16 code units, handling high bytes explicitly.
- `unitHash` combines the address parts, seeds `mulberry32`, and draws once.
- The PRNG is repeatable for the same inputs; it is not cryptographic.
- `packageRoot()` walks parents from the current module and caches the match.
- A matching root requires `package.json` with name `music2-gen`.
- `packageVersion()` reads that package's `version` on each call.
- `music2Home()` uses a nonempty `MUSIC2_HOME` or the OS home plus `.music2`.
- Neither helper creates a directory; `render`, `analyze` and `sfx` create their default folder when they write there.
- `packageRoot()` throws a plain `Error` if no matching parent exists.
- Fraction comparison uses cross-products, avoiding floating-point ordering.

## Dependencies

| Dependency | Import path | Used by |
|---|---|---|
| Node filesystem | `node:fs` | `paths.tool.ts` checks and reads `package.json`. |
| Node OS | `node:os` | `paths.tool.ts` gets the home directory. |
| Node path | `node:path` | `paths.tool.ts` walks and joins paths. |
| Node URL | `node:url` | `paths.tool.ts` resolves module URL. |
| Shared error implementation | `./errors.tool.ts` | `rational.tool.ts` reports internal arithmetic failures. |

No runtime package dependency is imported by these files.
The colocated tests use `node:test` and `node:assert/strict`.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/pattern/ast.schema.ts` | `../shared/index.ts` | `Fraction` type for spans. |
| `src/pattern/parse.tool.ts` | `../shared/index.ts` | `Music2Error` for parser diagnostics. |
| `src/pattern/query.tool.ts` | `../shared/index.ts` | `Fraction`, `min`, `max`, `unitHash`. |
| `src/pattern/euclid.tool.ts` | `../shared/index.ts` | `Music2Error` on invalid pulse counts. |
| `src/pattern/values.tool.ts` | `../shared/index.ts` | `Music2Error` for invalid values. |
| `src/cli/args.ts` | `../shared/index.ts` | `Music2Error` for arguments. |
| `src/cli/main.ts` | `../shared/index.ts` | `Music2Error` for impossible registry state. |
| `src/cli/output.ts` | `../shared/index.ts` | Error rendering and package version. |
| `src/cli/commands/help.ts` | `../../shared/index.ts` | `Music2Error` for invalid topics. |
| `src/cli/commands/version.ts` | `../../shared/index.ts` | `Music2Error`, `packageVersion`. |

Shared tests import their colocated implementation files directly.
Pattern and CLI tests also import the public shared boundary for fixtures and assertions.

## Sync Checklist

- [ ] Update this document with any shared file, export, or contract change.
- [ ] Keep `src/shared/index.ts` aligned with actual public declarations.
- [ ] Update `devlog/str_func/AGENTS.md` index when adding or moving the feature document.
- [ ] Update `src/shared/errors.test.ts` when adding an error or exit mapping.
- [ ] Check `src/cli/output.ts` and CLI JSON/error expectations when error metadata changes.
- [ ] Check `src/shared/rational.test.ts` and `src/pattern/query.test.ts` when time arithmetic changes.
- [ ] Check `src/shared/prng.test.ts` and deterministic pattern vectors when hashing changes.
- [ ] Check `src/shared/paths.test.ts` and CLI version behavior when package lookup changes.
