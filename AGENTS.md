# music2-gen

music2 is a source-first music CLI for coding agents. Songs are JSON files with mini-notation patterns; the project will validate, arrange, render, and inspect them offline as the roadmap is implemented.

## Stack and commands

- Node.js >=22.18, ESM TypeScript executed with native type stripping. Use erasable TypeScript syntax and `.ts` endings on relative imports.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run audit:structure` are the project checks.

## Lidge Standard

- Organize source by feature folder. Put logic in `*.tool.ts` with a colocated `*.test.ts`, types and validators in `*.schema.ts`, and a public `index.ts` barrel at each feature boundary.
- Keep files under approximately 400 lines; split by responsibility as they grow.
- Keep numbered plans in `devlog/_plan/YYMMDD_slug/`, completed work in `devlog/_fin/`, and a `devlog/str_func/<feature>.md` document for each feature.

## Hard rules

- Keep runtime dependencies at zero.
- Do not read or copy AGPL/GPL source. Implement mini-notation clean-room from public documentation and the conformance work in `devlog/_plan/260928_music2_roadmap/004_mini_notation_spec.md`.
- Audio and pattern logic must be deterministic: no `Math.random` or `Date` in those paths.
- CLI JSON mode emits exactly one JSON object. Exit codes are 0 (success), 1 (internal), 2 (input), 3 (capability), 4 (access/provider), 5 (render), 6 (QA), and 7 (interrupted/timeout).
- Use conventional commits. Do not place personal filesystem paths in committed files.
