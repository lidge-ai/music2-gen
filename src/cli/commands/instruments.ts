import { VOICES } from "../../render/voices/registry.tool.ts";
import { libraryManifest } from "../../sampler/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export const VOICE_SOURCES = {
  drums: "noise", "808": "sine", bass: "saw", bell: "fm", keys: "fm", pluck: "physical",
  pad: "saw", lead: "square", supersaw: "saw", sfx: "noise", piano: "sine",
  epiano: "fm", organ: "sine", strings: "saw", brass: "saw", flute: "sine",
  choir: "saw", marimba: "sine", vibraphone: "sine", glockenspiel: "sine",
  kalimba: "sine", guitar: "physical",
} as const;

export const instruments: CommandSpec = {
  name: "instruments",
  summary: "List synth voices and built-in sampled instruments",
  usage: "music2 instruments [--json]",
  options: {},
  async run({ args }) {
    if (args.length) throw new Music2Error("E_INPUT", "instruments takes no positional arguments");
    const voices = Object.values(VOICES).map((voice) => {
      const source = VOICE_SOURCES[voice.id as keyof typeof VOICE_SOURCES];
      if (!source) throw new Music2Error("E_INTERNAL", `unclassified voice source: ${voice.id}`);
      return { id: voice.id, kind: voice.kind, params: voice.params, source };
    });
    const library = libraryManifest().instruments.map(({ id, title, family, range, role, license }) =>
      ({ id, instrument: `lib:${id}`, title, family, range, role, license, source: "sampled" as const }));
    const text = ["SYNTH VOICES", ...voices.map((voice) =>
      `${voice.id.padEnd(16)} ${voice.kind.padEnd(6)} ${voice.source}`), "", "SAMPLED LIBRARY",
    ...library.map((item) => `${item.instrument.padEnd(24)} ${item.role.padEnd(5)} ${item.title} (${item.range.join("–")})`)].join("\n");
    return { command: "instruments", data: { voices, library }, text };
  },
};
