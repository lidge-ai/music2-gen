import { parseArgs } from "node:util";
import { Music2Error } from "../shared/index.ts";
import type { CommandSpec } from "./registry.ts";

export interface ParsedCommand {
  command: string;
  args: string[];
  values: Record<string, unknown>;
  json: boolean;
  help: boolean;
}

function parseOptions(argv: string[], spec: CommandSpec): { values: Record<string, unknown>; positionals: string[] } {
  try {
    return parseArgs({
      args: argv,
      options: {
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        ...spec.options,
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw new Music2Error("E_INPUT", error instanceof Error ? error.message : "invalid arguments", {
      fix: `run music2 ${spec.name} --help`,
    });
  }
}

export function parseCommand(argv: string[], registry: Map<string, CommandSpec>): ParsedCommand {
  let scan: ReturnType<typeof parseArgs>;
  try {
    scan = parseArgs({ args: argv, options: {}, allowPositionals: true, strict: false, tokens: true });
  } catch (error) {
    throw new Music2Error("E_INPUT", error instanceof Error ? error.message : "invalid arguments", {
      fix: "run music2 help",
    });
  }

  const first = scan.tokens?.find((token) => token.kind === "positional");
  const command = first?.kind === "positional" ? first.value : "help";
  const spec = registry.get(command);
  if (!spec) throw new Music2Error("E_INPUT", `unknown command: ${command}`, {
    details: { command, commands: [...registry.keys()] },
    fix: "run music2 help",
  });

  const remaining = first ? argv.filter((_, index) => index !== first.index) : argv;
  const parsed = parseOptions(remaining, spec);
  return {
    command,
    args: parsed.positionals,
    values: parsed.values,
    json: parsed.values["json"] === true || process.env["MUSIC2_JSON"] === "1",
    help: parsed.values["help"] === true,
  };
}

export function wantsJson(argv: string[]): boolean {
  return argv.includes("--json") || process.env["MUSIC2_JSON"] === "1";
}

export function commandHint(argv: string[]): string {
  return argv.find((arg) => !arg.startsWith("-")) ?? "help";
}
