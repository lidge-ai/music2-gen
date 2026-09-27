import { help } from "./commands/help.ts";
import { version } from "./commands/version.ts";
import { schema } from "./commands/schema.ts";
import { validate } from "./commands/validate.ts";
import { events } from "./commands/events.ts";

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

for (const spec of [version, help, schema, validate, events]) register(spec);
