import { help } from "./commands/help.ts";
import { version } from "./commands/version.ts";
import { schema } from "./commands/schema.ts";
import { validate } from "./commands/validate.ts";
import { events } from "./commands/events.ts";
import { render } from "./commands/render.ts";
import { doctor } from "./commands/doctor.ts";
import { analyze } from "./commands/analyze.ts";
import { lint } from "./commands/lint.ts";
import { critiqueCommand } from "./commands/critique.ts";
import { recipes } from "./commands/recipes.ts";
import { newCommand } from "./commands/new.ts";
import { skillPath } from "./commands/skill-path.ts";
import { sfx } from "./commands/sfx.ts";

export interface CommandOption {
  type: "string" | "boolean";
  short?: string;
  multiple?: boolean;
  description: string;
}

export interface CommandContext {
  args: string[];
  values: Record<string, unknown>;
  json: boolean;
  cwd: string;
  stderr: NodeJS.WritableStream;
}

export interface CommandResult {
  command: string;
  data: Record<string, unknown>;
  artifacts?: string[];
  warnings?: string[];
  /** Human-mode rendering; ignored in --json mode. */
  text?: string;
}

export interface CommandSpec {
  name: string;
  summary: string;
  usage: string;
  options: Record<string, CommandOption>;
  run(ctx: CommandContext): Promise<CommandResult>;
}

export const commands = new Map<string, CommandSpec>();

export function register(spec: CommandSpec): void {
  if (commands.has(spec.name)) throw new Error(`duplicate command: ${spec.name}`);
  commands.set(spec.name, spec);
}

for (const spec of [version, help, schema, validate, events, render, doctor, analyze, recipes, newCommand, lint, critiqueCommand, skillPath, sfx]) register(spec);
