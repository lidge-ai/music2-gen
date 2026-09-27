import { Music2Error, packageVersion } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export const version: CommandSpec = {
  name: "version",
  summary: "Print the installed music2 version",
  usage: "music2 version [--json]",
  options: {},
  run({ args }) {
    if (args.length) throw new Music2Error("E_INPUT", "version takes no positional arguments", {
      fix: "run music2 version --help",
    });
    return Promise.resolve({ command: "version", data: { version: packageVersion() } });
  },
};
