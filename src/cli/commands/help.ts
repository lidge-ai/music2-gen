import { Music2Error } from "../../shared/index.ts";
import { commands } from "../registry.ts";
import type { CommandSpec } from "../registry.ts";

function usageFor(name?: string): string {
  if (name) return commands.get(name)?.usage ?? "";
  return `music2 <command> [options]\n\nCommands:\n${[...commands.values()]
    .map((command) => `  ${command.name.padEnd(10)} ${command.summary}`)
    .join("\n")}\n\nRun music2 help <command> for command usage.`;
}

export const help: CommandSpec = {
  name: "help",
  summary: "List commands and options",
  usage: "music2 help [command] [--json]",
  options: {},
  run({ args }) {
    if (args.length > 1 || (args[0] && !commands.has(args[0]))) {
      throw new Music2Error("E_INPUT", `unknown help topic: ${args.join(" ")}`, {
        details: { commands: [...commands.keys()] },
        fix: "run music2 help",
      });
    }
    const name = args[0];
    const selected = name ? [commands.get(name)!] : [...commands.values()];
    return Promise.resolve({
      command: "help",
      data: {
        usage: usageFor(name),
        commands: selected.map(({ name: commandName, summary, usage, options }) => ({
          name: commandName, summary, usage, options,
        })),
      },
    });
  },
};
