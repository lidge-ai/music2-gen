import type { RecipeId } from "./recipe.schema.ts";
import { barsOf, comparableBlocks, densityChange, has, is808, isHat, kick, snare5and13, snare9, transitions } from "./lint-geometry.tool.ts";
import type { LintGeometry } from "./lint-geometry.tool.ts";
import { has808, outsideKey } from "./lint-generic.tool.ts";
import { meanActive, melodyId, motifIn, muteChange, phraseChange, sectionMotifChange } from "./lint-rules-phrase.tool.ts";
import { danceRules } from "./lint-rules-dance.tool.ts";
import type { LintResult } from "./lint.tool.ts";

const trackPath = (g: LintGeometry, test: (id: string, kind: string, instrument: string) => boolean, fallback: string): string =>
  `tracks.${g.song.tracks.find((track) => test(track.id, track.kind, track.instrument))?.id ?? fallback}`;
const sectionPath = (id: string): string => `sections.${id}`;
const pct = (count: number, total: number): string => `${(count / total * 100).toFixed(1)}% (${count}/${total})`;
const warning = (id: string, path: string, observed: string | number, expected: string | number, fix: string): LintResult =>
  ({ id, severity: "warning", path, observed, expected, fix });
function addRatio(out: LintResult[], id: string, g: LintGeometry, bars: number[], threshold: number,
  predicate: (bar: number) => boolean, fix: string): void {
  if (!bars.length) return;
  const count = bars.filter(predicate).length;
  if (count / bars.length < threshold) out.push(warning(id, "arrangement", pct(count, bars.length), `${(threshold * 100).toFixed(1)}%`, fix));
}
function bpm(out: LintResult[], genre: string, value: number, min: number, max: number): void {
  if (value < min || value > max) out.push(warning(`${genre}/1`, "bpm", value, `${min}..${max}`, `Set bpm between ${min} and ${max}.`));
}
function beat(out: LintResult[], genre: string, g: LintGeometry, threshold: number, which: "9" | "5and13"): void {
  addRatio(out, `${genre}/2`, g, g.full, threshold,
    (bar) => which === "9" ? snare9(g, bar) : snare5and13(g, bar),
    which === "9" ? "Place a snare/clap on step 9 in full-drum bars." : "Place snares on steps 5 and 13 in full-drum bars.");
}
function poly(out: LintResult[], genre: string, generic: LintResult[], g: LintGeometry, number: number): void {
  if (!has808(g) || generic.some((result) => result.id === "generic/808_polyphony"))
    out.push(warning(`${genre}/${number}`, trackPath(g, (_id, kind, instrument) => kind === "notes" && instrument === "808", "808"), has808(g) ? "polyphonic 808" : "no 808 track", "monophonic 808 track", "Add a mono 808 track or shorten/revoice overlaps."));
}
function shortHats(g: LintGeometry): number {
  const bars = new Set(g.full);
  return g.timeline.events.filter((event) => bars.has(event.bar) && isHat(g, event) && event.slot < g.timeline.secondsPerBar / 16 - 1e-6).length;
}
function rollBars(g: LintGeometry): number {
  return g.full.filter((bar) => has(g, bar, (e) => isHat(g, e) && e.slot <= g.timeline.secondsPerBar / 32 + 1e-6)).length;
}
function swingRule(out: LintResult[], genre: string, g: LintGeometry): void {
  const swungHat = g.song.tracks.some((track) => track.kind === "drums" && track.swing &&
    g.timeline.events.some((event) => event.track === track.id && isHat(g, event)));
  if (g.song.swing <= .5 || !swungHat) out.push(warning(`${genre}/3`, "tracks", `song swing ${g.song.swing}; swung hats ${swungHat}`,
    "song swing > 0.5 and swung hat/percussion", "Raise song swing and enable swing on a hat/percussion track."));
}
function outOfKeyRule(out: LintResult[], id: string, g: LintGeometry, select: (trackId: string, instrument: string) => boolean): void {
  if (!g.song.key) return;
  const outside = outsideKey(g, (event) => {
    const track = g.song.tracks[event.trackIndex]!;
    return select(track.id, track.instrument);
  });
  if (outside.length) out.push(warning(id, `tracks.${outside[0]!.track}`, `${outside.length} notes; first bar ${outside[0]!.bar}`,
    `all selected notes in ${g.song.key}`, "Retune bass/melody notes or correct the declared key."));
}
export function genreRules(g: LintGeometry, genre: RecipeId, generic: LintResult[]): LintResult[] {
  if (genre === "house" || genre === "techno") return danceRules(g, genre, generic);
  const out: LintResult[] = [];
  const melody = melodyId(g);
  if (genre === "drill_uk") {
    bpm(out, genre, g.song.bpm, 138, 145); beat(out, genre, g, .75, "9");
    addRatio(out, "drill_uk/3", g, g.full, .75, (bar) => kick(g, bar), "Add a kick onset to full-drum bars.");
    if (g.full.length && shortHats(g) < Math.ceil(g.full.length / 2)) out.push(warning("drill_uk/4", trackPath(g, (id) => g.timeline.events.some((event) => event.track === id && isHat(g, event)), "hats"), shortHats(g), `>=${Math.ceil(g.full.length / 2)} short hat events`, "Add brief hat subdivisions in full-drum bars."));
    poly(out, genre, generic, g, 5);
    if (g.full.length && transitions(g, g.full) < Math.ceil(g.full.length / 8)) out.push(warning("drill_uk/6", trackPath(g, (_id, kind, instrument) => kind === "notes" && instrument === "808", "808"), transitions(g, g.full), `>=${Math.ceil(g.full.length / 8)} 808 transitions`, "Add occasional 808 pitch transitions."));
    outOfKeyRule(out, "drill_uk/7", g, (_id, instrument) => instrument !== "bass");
  } else if (genre === "drill_ny") {
    bpm(out, genre, g.song.bpm, 138, 145); beat(out, genre, g, .75, "9");
    const failed = g.placements.filter((p) => p.role === "hook" && (!barsOf(p).some((bar) => kick(g, bar)) ||
      !barsOf(p).some((bar) => has(g, bar, (event) => is808(g, event)))));
    if (failed.length) out.push(warning("drill_ny/3", sectionPath(failed[0]!.section), failed.map((p) => p.section).join(","), "kick and 808 in every hook", "Add kick and 808 onsets to each hook."));
    poly(out, genre, generic, g, 4);
    if (g.hooks.length && transitions(g, g.hooks) < Math.ceil(g.hooks.length / 8)) out.push(warning("drill_ny/5", trackPath(g, (_id, kind, instrument) => kind === "notes" && instrument === "808", "808"), transitions(g, g.hooks), `>=${Math.ceil(g.hooks.length / 8)} hook 808 transitions`, "Vary 808 pitch in the hook."));
    const noMotif = g.placements.filter((p) => p.role === "hook" && p.bars >= 2 && !motifIn(g, barsOf(p), [1], melody));
    if (noMotif.length) out.push(warning("drill_ny/6", sectionPath(noMotif[0]!.section), noMotif.map((p) => p.section).join(","), "repeated one-bar hook melody", "Repeat a one-bar melodic motif in each hook."));
    const noPhrase = g.placements.filter((p) => ["hook", "verse"].includes(p.role ?? "") && p.bars >= 16 &&
      !densityChange(g, barsOf(p), 8) && !g.song.tracks.some((track) => phraseChange(g, barsOf(p), 8, track.id)));
    if (noPhrase.length) out.push(warning("drill_ny/7", sectionPath(noPhrase[0]!.section), noPhrase.map((p) => p.section).join(","), "8-bar density or motif change", "Change active layers or melody in the second 8-bar phrase."));
  } else if (genre === "trap") {
    bpm(out, genre, g.song.bpm, 130, 170); beat(out, genre, g, .75, "9");
    addRatio(out, "trap/3", g, g.full, .75, (bar) => has(g, bar, (e) => isHat(g, e)), "Add hats to full-drum bars.");
    if (g.full.length && shortHats(g) < Math.ceil(g.full.length / 4)) out.push(warning("trap/4", trackPath(g, (id) => g.timeline.events.some((event) => event.track === id && isHat(g, event)), "hats"), shortHats(g), `>=${Math.ceil(g.full.length / 4)} short hat events`, "Add brief hat subdivisions."));
    outOfKeyRule(out, "trap/5", g, (_id, instrument) => instrument === "808");
    poly(out, genre, generic, g, 6);
    const pairs = g.placements.flatMap((p, i) => p.role === "hook" ? [g.placements[i - 1], g.placements[i + 1]]
      .filter((v): v is NonNullable<typeof v> => v?.role === "verse").map((verse) => [p, verse] as const) : []);
    const failed = pairs.filter(([hook, verse]) => meanActive(g, barsOf(hook)) < meanActive(g, barsOf(verse)));
    if (failed.length) out.push(warning("trap/7", sectionPath(failed[0]![0].section), `${failed.length}/${pairs.length} hook/verse pairs thinner`, "hook mean layers >= adjacent verse", "Add a hook layer or thin the adjacent verse."));
  } else if (genre === "boom_bap") {
    bpm(out, genre, g.song.bpm, 80, 100); beat(out, genre, g, .75, "5and13"); swingRule(out, genre, g);
    if (g.full.length && rollBars(g) / g.full.length > .5) out.push(warning("boom_bap/4", trackPath(g, (id) => g.timeline.events.some((event) => event.track === id && isHat(g, event)), "hats"), pct(rollBars(g), g.full.length), "<=50.0% full bars with 32nd hats", "Reserve fast hat rolls for occasional fills."));
    outOfKeyRule(out, "boom_bap/5", g, (id, instrument) => id === "bass" || instrument === "bass" || instrument === "808");
    if ([2, 4].some((size) => comparableBlocks(g.full, size)) && !motifIn(g, g.full, [2, 4], melody)) out.push(warning("boom_bap/6", `tracks.${melody ?? "melody"}`, "no repeated 2/4-bar melody", "repeated melodic phrase", "Repeat a two- or four-bar melody phrase."));
    if (!muteChange(g) && !sectionMotifChange(g, melody)) out.push(warning("boom_bap/7", "arrangement", "no mute or melody change", "section variation", "Mute a layer or change the melody between sections."));
  } else {
    bpm(out, genre, g.song.bpm, 60, 90); beat(out, genre, g, .70, "5and13"); swingRule(out, genre, g);
    if ([2, 4, 8].some((size) => comparableBlocks(g.full, size)) && !motifIn(g, g.full, [2, 4, 8], melody)) out.push(warning("lofi_hiphop/4", `tracks.${melody ?? "melody"}`, "no repeated 2/4/8-bar melody", "repeated harmonic loop proxy", "Repeat a short melodic loop."));
    if (g.full.length && rollBars(g) / g.full.length > .5) out.push(warning("lofi_hiphop/5", trackPath(g, (id) => g.timeline.events.some((event) => event.track === id && isHat(g, event)), "hats"), pct(rollBars(g), g.full.length), "<=50.0% full bars with 32nd hats", "Reduce recurring fast hat rolls."));
    if (generic.some((r) => r.id === "generic/clipping_risk")) out.push(warning("lofi_hiphop/6", "arrangement", "static clipping risk", "onset sum <=1.5", "Lower gains or velocities and inspect rendered audio."));
  }
  return out;
}
