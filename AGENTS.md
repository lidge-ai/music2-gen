# music2-gen repository agent rules

music2 is a source-first music CLI. `bin/music2.js` is the user entry point; `src/cli/index.ts` is the source entry point. Songs, patterns, rendering, analysis, recipes, and optional critique live in feature folders under `src/`. This file governs repository development. The end-user composition workflow lives in `skills/music2/SKILL.md`.

## Stack and checks

- Use Bun 1.4.0 (pinned in `package.json` as the `bun` dependency and `packageManager`), ESM TypeScript with erasable syntax, and `.ts` endings on relative imports. Node is supported only as the host of the npm launcher `bin/music2.js`.
- The only runtime dependency is the pinned `bun` package; add no others. Keep `src` on `node:*` APIs.
- Run `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, and `bun run audit:structure` for affected source changes. Check generated genre docs with `bun run docs:genres:check` when recipe cards change.

## Source and documentation layout

- Organize code by feature. Put logic in `*.tool.ts`, colocate `*.test.ts`, keep types and validators in `*.schema.ts`, and expose feature boundaries through `index.ts`.
- Keep files near 400 lines or fewer; split by responsibility when they grow.
- Update `devlog/str_func/<feature>.md` when exports or feature responsibilities change. Keep active numbered units in `devlog/_plan/YYMMDD_slug/` and preserve completed history in `devlog/_fin/`.

## Correctness and boundaries

- Use a fixed song seed and `src/shared/prng.tool.ts` for generated musical choices. Do not use `Math.random` or `Date` in pattern or audio logic. Check deterministic output under the pinned Bun version and the same platform; the golden-digest tests run on darwin with that Bun.
- Implement mini-notation clean-room from public documentation and `devlog/_fin/260928_music2_roadmap/004_mini_notation_spec.md`. Do not read or copy AGPL/GPL source.
- CLI `--json` prints exactly one JSON object. Exit codes: 0 success, 1 internal, 2 input, 3 capability, 4 access/provider, 5 render, 6 QA, 7 interrupted/timeout.
- Keep private material and personal absolute paths out of committed files. Use conventional commits. Push, publish, and release only within the explicit task scope.
