# 260928 music2 home storage

## Change

music2 had a `music2Home()` helper (`MUSIC2_HOME` or `~/.music2`) that no command used. Default outputs now live there:

| Command | Without an explicit path |
| --- | --- |
| `render` | `$MUSIC2_HOME/renders/<song>.wav` (was beside the song) |
| `analyze` | `$MUSIC2_HOME/analysis/<name>/` (was `<name>.analysis` beside the input) |
| `sfx` | `$MUSIC2_HOME/sfx/<preset>-<seed>.wav`, then `-2`, `-3`… (`-o` was required) |
| `doctor` | Adds `data.home` |

Explicit paths behave as before. An empty `MUSIC2_HOME` falls back to `~/.music2`. `storageDir(kind)` in `src/shared/paths.tool.ts` names the `renders`, `analysis`, `sfx` and `projects` folders; commands create a default folder only when they write there. `new` without `-o` still prints the song, because callers read it from stdout.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` (610 tests: 607 pass, 3 skipped, 0 fail), `npm run build`, `npm run audit:structure`: pass.
- After the doc edits: `node --test` on `tests/e2e/{skill-docs,privacy-scan,package-boundary,genre-docs}.test.ts` and the changed command tests with a temporary `MUSIC2_HOME`: 31/31 pass.
- New tests cover the render, analyze and sfx defaults (including the `-2` suffix), `storageDir`, the empty-home fallback and `doctor.home`.

