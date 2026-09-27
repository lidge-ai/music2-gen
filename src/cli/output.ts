import { Music2Error, packageVersion } from "../shared/index.ts";
import type { CommandResult } from "./registry.ts";

export function renderSuccess(result: CommandResult, json: boolean): string {
  if (json) return JSON.stringify({
    ok: true,
    command: result.command,
    data: result.data,
    artifacts: result.artifacts ?? [],
    warnings: result.warnings ?? [],
    meta: { music2: packageVersion() },
  });
  if (result.command === "version") return `music2 ${String(result.data["version"])}`;
  if (result.command === "help") return typeof result.data["usage"] === "string" ? result.data["usage"] : "";
  return JSON.stringify(result.data, null, 2);
}

export function renderFailure(error: unknown, json: boolean, command = "unknown"): { text: string; exit: number } {
  const e = error instanceof Music2Error ? error : new Music2Error("E_INTERNAL", "unexpected internal error", {
    ...(error instanceof Error ? { details: { cause: error.message } } : {}),
    fix: "report this issue to the music2 maintainers",
  });
  if (!json) return { text: `music2: ${e.message}\nFix: ${e.fix ?? "run music2 help"}`, exit: e.exit };
  return {
    text: JSON.stringify({
      ok: false,
      command,
      error: { code: e.code, message: e.message, fix: e.fix ?? null, details: e.details ?? {}, retryable: e.retryable },
      meta: { music2: packageVersion() },
    }),
    exit: e.exit,
  };
}
