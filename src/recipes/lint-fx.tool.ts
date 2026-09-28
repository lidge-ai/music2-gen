import type { ResolvedSong } from "../song/index.ts";
import type { LintResult } from "./lint.tool.ts";

/** Advisory mix checks; intentional choices remain valid songs. */
export function fxRules(song: ResolvedSong): LintResult[] {
  const results: LintResult[] = [];
  const warn = (id: string, path: string, observed: number, expected: string, fix: string): void => {
    results.push({ id: `generic/${id}`, severity: "warning", path, observed, expected, fix });
  };
  song.tracks.forEach((track, trackIndex) => {
    const low = track.instrument === "808" || track.instrument === "bass";
    if (low && track.sends.reverb > 0.15)
      warn("fx_low_reverb", `$.tracks[${trackIndex}].sends.reverb`, track.sends.reverb, "<= 0.15 on bass/808",
        "Reduce the reverb send or filter the wet return to preserve low-end clarity.");
    track.fx?.forEach((insert, fxIndex) => {
      if (insert.type === "delay" && insert.feedback > 0.9)
        warn("fx_delay_feedback", `$.tracks[${trackIndex}].fx[${fxIndex}].feedback`, insert.feedback, "<= 0.9",
          "Reduce feedback if echoes obscure later notes.");
      if (low && insert.type === "width" && insert.amount > 1)
        warn("fx_width_low", `$.tracks[${trackIndex}].fx[${fxIndex}].amount`, insert.amount, "<= 1 on bass/808",
          "Keep low tracks centered; use width on upper layers.");
    });
  });
  if (song.fx?.delay && song.fx.delay.feedback > 0.9)
    warn("fx_delay_feedback", "$.fx.delay.feedback", song.fx.delay.feedback, "<= 0.9",
      "Reduce feedback if the shared delay obscures later notes.");
  return results;
}
