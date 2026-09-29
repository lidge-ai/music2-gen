# Pattern — Structure & Functions

Parse mini-notation into an AST and query deterministic musical events over exact cycle time.

## File Tree

```text
src/pattern/
├── index.ts             # public parser, query, value, rhythm, and type exports
├── ast.schema.ts        # Atom, Node, Span, Hap, QueryCtx types
├── parse.tool.ts        # mini-notation parser and preorder IDs
├── parse.test.ts        # syntax, offsets, limits, and AST cases
├── query.tool.ts        # half-open arc evaluation and onset selection
├── query.test.ts        # timing, transformations, deterministic vectors
├── euclid.tool.ts       # Euclidean slots and left rotation
├── euclid.test.ts       # pulse and rotation vectors
├── values.tool.ts       # note, MIDI, sample, and number conversion
└── values.test.ts       # conversion and invalid-value cases
```

## Module Responsibility

`src/pattern` translates source mini-notation into typed nodes, then evaluates
those nodes across fractional cycle spans. A cycle is one bar. The parser owns
syntax, bounds, source offsets, and stable preorder node IDs. The query engine
owns timing transformations, clipping, event ordering, and seeded choices.
The value helpers interpret individual note, sample, and numeric atoms when
a caller needs those forms. The Euclidean helper produces slot masks used by
the query engine and is also part of the public boundary.

The current folder does not load song files, render audio, or dispatch CLI
commands. It returns `Hap` values with both an uncut `whole` span and an
intersection `part` span. Callers can use `onsets` to omit events that began
before a requested arc.

## Key Function Signatures

These are the exact exported function signatures from the implementation files.
`index.ts` re-exports them and the five types from `ast.schema.ts`.

| Exported signature | Source | Purpose |
|---|---|---|
| `export function parseMini(src: string): Node` | `parse.tool.ts` | Parse one notation string and assign node IDs. |
| `export function queryArc(node: Node, begin: Fraction, end: Fraction, ctx: QueryCtx): Hap[]` | `query.tool.ts` | Return overlapping haps, retaining whole spans. |
| `export function onsets(node: Node, begin: Fraction, end: Fraction, ctx: QueryCtx): Hap[]` | `query.tool.ts` | Return only attacks inside the half-open arc. |
| `export function bjorklund(k: number, n: number): boolean[]` | `euclid.tool.ts` | Spread `k` pulses across `n` slots, anchored at zero. |
| `export function rotateLeft<T>(bits: readonly T[], r: number): T[]` | `euclid.tool.ts` | Rotate a slot sequence left by `r`. |
| `export function noteToMidi(text: string): number` | `values.tool.ts` | Parse a named pitch with octave. |
| `export function midiToName(m: number): string` | `values.tool.ts` | Convert integer MIDI pitch to a name. |
| `export function parseSampleRef(text: string): { name: string; index: number }` | `values.tool.ts` | Split `name[:index]`, defaulting index to zero. |
| `export function parseNumber(text: string): number` | `values.tool.ts` | Parse a finite signed decimal. |

### Public data types

| Export | Exact declaration | Meaning |
|---|---|---|
| `Atom` | `export interface Atom { raw: string; name: string; index: number \| null; num: number \| null; offset: number }` | Lexical atom and source offset. |
| `Node` | `export type Node =` | Discriminated AST union; variants listed below. |
| `Span` | `export interface Span { begin: Fraction; end: Fraction }` | Exact interval boundaries. |
| `Hap` | `export interface Hap { whole: Span; part: Span; atom: Atom; order: number }` | Queried event and stable order. |
| `QueryCtx` | `export interface QueryCtx { seed: number; salt: string }` | Choice address context. |

`Node` variants in `ast.schema.ts` are `atom`, `rest`, `seq`, `stack`,
`alt`, `fast`, `slow`, `euclid`, `degrade`, and `choose`.
Each variant carries `id`; composite variants carry their child nodes and
the parameters relevant to their operation.

### Parser behavior

- `parseMini` rejects source longer than 4000 characters with `E_PARSE`.
- Parsing begins with a nonempty branch; empty source and empty branches fail.
- An atom retains its `raw` spelling, parsed `name`, optional sample `index`,
  optional numeric `num`, and byte-independent string offset.
- `~` is a rest and emits no hap.
- Whitespace sequences steps; `,` stacks branches; `|` chooses one branch.
- Square groups nest sequences; angle groups alternate items by cycle.
- `*n` speeds and `/n` slows; factors must be integers in `1..64`.
- `(k,n[,r])` applies Euclidean pulses, with `0 <= k <= n <= 64`.
- `?` defaults to probability `0.5`; `?p` accepts `0..1`.
- `@n` weights a step in its sequence; weight range is `1..64`.
- `!` repeats twice by default; `!n` repeats `n` times.
- Suffix stages must appear in speed, Euclidean, probability, weight order.
- Repeated `!` can multiply copies, capped at 20000 expanded copies.
- Nested groups are bounded to depth 32.
- Errors carry `E_PARSE`, expected text, source offset, and a caret `fix`.
- `assignIds` numbers the completed tree in preorder from zero.

### Query behavior

- `queryArc` takes a half-open `[begin,end)` arc and sorts results by whole
  begin time, then `order`.
- `onsets` filters that result to whole begins inside the requested arc.
- `whole` remains the event's full span; `part` is clipped to the query.
- Sequences divide a cycle by step weights, then map child haps back.
- Stacks concatenate branch haps before final sorting.
- Angle alternation chooses a branch by cycle, including negative cycles.
- `choose` addresses a deterministic pick by seed, salt, node ID, and cycle.
- `fast` and `slow` transform time using `Fraction`, preserving exact spans.
- `euclid` turns pulse bits into equally weighted slots.
- `degrade` filters child haps by a stable hash of the whole begin.
- Empty or reversed arcs yield no haps through `queryNode`.
- Query tests cover partition invariance for addressed random choices.

### Value and rhythm behavior

- `noteToMidi` requires a pitch letter, optional `#`, `b`, or `s`, and
  an explicit single-digit signed octave, such as `c4` or `fs2`.
- `midiToName` requires an integer and uses canonical sharp/flat spellings.
- `parseSampleRef` accepts a letter-led name with optional nonnegative index.
- `parseNumber` accepts a finite signed decimal without exponent notation.
- Invalid values raise `E_PARSE` with a zero-offset source diagnostic.
- `bjorklund` accepts `n` in `1..64` and `k` in `0..n`.
- Its first active pulse is slot zero; `k = 0` returns all false.
- `rotateLeft` handles negative rotations and empty input.
- The value helpers do not interpret an entire pattern expression.

## Dependencies

| Dependency | Import path | Used by |
|---|---|---|
| Shared error | `../shared/index.ts` | Parser, value, and Euclidean validation. |
| Shared exact time | `../shared/index.ts` | Span type and query arithmetic. |
| Shared addressed hash | `../shared/index.ts` | Choice and degradation in query. |
| AST schema | `./ast.schema.ts` | Parser, query, and type boundary. |
| Euclidean helper | `./euclid.tool.ts` | Query engine slot expansion. |

The only runtime package dependency is the pinned `bun` runtime. Tests use `node:test` under `bun test`.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/pattern/query.test.ts` | `./parse.tool.ts`, `./query.tool.ts` | Parse and compare event timing vectors. |
| `src/pattern/parse.test.ts` | `./parse.tool.ts` | Verify AST and parser errors. |
| `src/pattern/euclid.test.ts` | `./euclid.tool.ts` | Verify rhythm slots. |
| `src/pattern/values.test.ts` | `./values.tool.ts` | Verify conversions. |

At this source snapshot, no other feature folder imports `src/pattern/index.ts`.
The barrel is the intended feature boundary for future consumers.

## Sync Checklist

- [ ] Update this document for AST variants, syntax, exports, or query semantics.
- [ ] Keep `src/pattern/index.ts` aligned with implementation exports.
- [ ] Update `devlog/str_func/AGENTS.md` index when adding or moving this document.
- [ ] Check `devlog/_fin/260928_music2_roadmap/004_mini_notation_spec.md` when notation semantics change.
- [ ] Update parser offset and syntax cases in `src/pattern/parse.test.ts`.
- [ ] Update event vectors and partition cases in `src/pattern/query.test.ts`.
- [ ] Update value and Euclidean tests when their accepted forms change.
- [ ] Check callers before changing `Hap.whole`, `Hap.part`, or `QueryCtx`.
