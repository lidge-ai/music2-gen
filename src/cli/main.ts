import { Music2Error } from "../shared/index.ts";
import { commandHint, parseCommand, wantsJson } from "./args.ts";
import { renderFailure, renderSuccess } from "./output.ts";
import { commands } from "./registry.ts";

export interface CliIO {
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  cwd?: string;
}

export async function main(argv: string[], io: CliIO = {}): Promise<number> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cwd = io.cwd ?? process.cwd();
  let command = "help";
  let json = wantsJson(argv);
  try {
    const parsed = parseCommand(argv, commands);
    command = parsed.command;
    json = parsed.json;
    const spec = commands.get(command);
    if (!spec) throw new Music2Error("E_INTERNAL", `unregistered command: ${command}`);
    const result = parsed.help && command !== "help"
      ? { command: "help", data: { usage: spec.usage, command, options: spec.options } }
      : await spec.run({ args: parsed.args, values: parsed.values, json, cwd, stderr });
    stdout.write(`${renderSuccess(result, json)}\n`);
    return 0;
  } catch (error) {
    const rendered = renderFailure(error, json, command === "help" ? commandHint(argv) : command);
    (json ? stdout : stderr).write(`${rendered.text}\n`);
    return rendered.exit;
  }
}
