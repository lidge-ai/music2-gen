import { getRecipe, listRecipes } from "../../recipes/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export const recipes: CommandSpec = {
  name: "recipes", summary: "List genre recipes or inspect one card",
  usage: "music2 recipes [id] [--json] (unknown id exits 2)", options: {},
  async run({ args }) {
    if (args.length > 1) throw new Music2Error("E_INPUT", "recipes accepts zero or one id");
    if (args.length === 0) {
      const summaries = listRecipes().map(({ id, title, bpm, keyDefaults, roles }) => ({ id, title, bpm, keyDefaults, roles }));
      const rows = summaries.map(({ id, title, bpm, keyDefaults }) =>
        `${id.padEnd(14)} ${title.padEnd(16)} ${String(bpm.min).padStart(3)}-${String(bpm.max).padEnd(3)} ${keyDefaults[0] ?? ""}`);
      return { command: "recipes", data: { recipes: summaries }, text: ["ID             TITLE            BPM      DEFAULT KEY", ...rows].join("\n") };
    }
    const card = getRecipe(args[0]!);
    const lines = [
      `${card.title} (${card.id})`,
      `BPM: ${card.bpm.min}-${card.bpm.max} (default ${card.bpm.default})`,
      `Swing: ${card.swing.min}-${card.swing.max} (default ${card.swing.default})`,
      `Keys: ${card.keyDefaults.join(", ")}`,
      `Progressions: ${card.progressions.map((p) => `${p.roman} = ${p.example}`).join("; ")}`,
      `Grid: ${card.gridRules}`, `Bass: ${card.bassRules}`,
      `Palette: ${card.palette.map((p) => `${p.role}: ${p.instrument}`).join(", ")}`,
      `Arrangement: ${card.arrangement.map((a) => `${a.role} ${a.bars} bars`).join(" → ")}`,
      `Mix: ${card.mixTargets.lufs} LUFS, ${card.mixTargets.truePeak} dB true peak; ${card.mixTargets.notes}`,
      `Sources:\n${card.sources.map((source) => `  ${source}`).join("\n")}`,
    ];
    return { command: "recipes", data: { recipe: card }, text: lines.join("\n") };
  },
};
