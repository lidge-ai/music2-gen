#!/usr/bin/env node
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listRecipes } from "../src/recipes/index.ts";

/** @typedef {import('../src/recipes/recipe.schema.ts').RecipeCard} RecipeCard */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOC_PATH = "skills/music2/references/genres.md";
const GENRE_IDS = ["boom_bap", "drill_ny", "drill_uk", "house", "lofi_hiphop", "techno", "trap"];

// Meanings follow the executable thresholds and proxies in 040 and src/recipes/lint-rules*.tool.ts.
const RULE_MEANINGS = {
  "boom_bap/1": "BPM is outside 80–100.",
  "boom_bap/2": "Fewer than 75% of full-drum bars have snares on steps 5 and 13.",
  "boom_bap/3": "Song swing is at most 0.5 or no hat/percussion track uses swing.",
  "boom_bap/4": "More than half of full-drum bars contain a 32nd-note hat roll.",
  "boom_bap/5": "A bass note falls outside the declared key.",
  "boom_bap/6": "No repeated two- or four-bar melodic motif is found where comparable bars exist.",
  "boom_bap/7": "Sections have neither an audible mute change nor a melodic motif change.",
  "drill_ny/1": "BPM is outside 138–145.",
  "drill_ny/2": "Fewer than 75% of full-drum bars have a snare or clap on step 9.",
  "drill_ny/3": "A hook lacks a kick or 808 onset.",
  "drill_ny/4": "An 808 track is absent or has overlapping 808 notes.",
  "drill_ny/5": "Hooks have fewer than one 808 pitch transition per eight bars (rounded up).",
  "drill_ny/6": "A hook of at least two bars lacks a repeated one-bar melodic motif.",
  "drill_ny/7": "A hook or verse of at least 16 bars lacks an eight-bar density or track-motif change.",
  "drill_uk/1": "BPM is outside 138–145.",
  "drill_uk/2": "Fewer than 75% of full-drum bars have a snare or clap on step 9.",
  "drill_uk/3": "Fewer than 75% of full-drum bars have a kick onset.",
  "drill_uk/4": "Full-drum bars have fewer than one short hat event per two bars (rounded up).",
  "drill_uk/5": "An 808 track is absent or has overlapping 808 notes.",
  "drill_uk/6": "Full-drum bars have fewer than one 808 pitch transition per eight bars (rounded up).",
  "drill_uk/7": "Selected 808 or melody notes fall outside the declared key.",
  "house/1": "BPM is outside 120–130.",
  "house/2": "Fewer than 90% of groove bars have kicks on steps 1, 5, 9 and 13.",
  "house/3": "Fewer than 75% of groove bars have claps or snares on steps 5 and 13.",
  "house/4": "Fewer than 75% of groove bars have hats on steps 3, 7, 11 and 15.",
  "house/5": "A bass or melody note falls outside the declared key.",
  "house/6": "Adjacent eight-bar groove, hook or breakdown windows lack a density change.",
  "house/7": "The outro has at least as many active layers on average as the final groove or hook.",
  "lofi_hiphop/1": "BPM is outside 60–90.",
  "lofi_hiphop/2": "Fewer than 70% of full-drum bars have snares on steps 5 and 13.",
  "lofi_hiphop/3": "Song swing is at most 0.5 or no hat/percussion track uses swing.",
  "lofi_hiphop/4": "No repeated two-, four- or eight-bar melodic loop is found where comparable bars exist.",
  "lofi_hiphop/5": "More than half of full-drum bars contain a 32nd-note hat roll.",
  "lofi_hiphop/6": "Static onset-gain sum exceeds 2 (chord tones and slow attacks weighted); rendered clipping is not implied.",
  "techno/1": "BPM is outside 126–140.",
  "techno/2": "Fewer than 90% of groove bars have kicks on steps 1, 5, 9 and 13.",
  "techno/3": "No repeated one- or two-bar bass motif, or percussion motif when bass is absent.",
  "techno/4": "Compared eight- or 16-bar build/groove windows keep identical layers and median density.",
  "techno/5": "A breakdown has at least as many active layers on average as the main groove.",
  "techno/6": "Static onset-gain sum exceeds 2 (chord tones and slow attacks weighted); rendered clipping is not implied.",
  "trap/1": "BPM is outside 130–170.",
  "trap/2": "Fewer than 75% of full-drum bars have a snare or clap on step 9.",
  "trap/3": "Fewer than 75% of full-drum bars have a hat onset.",
  "trap/4": "Full-drum bars have fewer than one short hat event per four bars (rounded up).",
  "trap/5": "An 808 note falls outside the declared key.",
  "trap/6": "An 808 track is absent or has overlapping 808 notes.",
  "trap/7": "A hook has fewer active layers on average than an adjacent verse.",
};

function required(value, name) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) {
    throw new Error(`missing required card field: ${name}`);
  }
  return value;
}

function escapeMd(value) {
  return String(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/`/g, "\\`");
}

function code(value) {
  const content = String(value).replace(/\r?\n/g, " ");
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const delimiter = "`".repeat(longestRun + 1);
  const padded = content.startsWith("`") || content.endsWith("`") ? ` ${content} ` : content;
  return `${delimiter}${padded}${delimiter}`;
}

function renderCard(card) {
  const id = required(card.id, "id");
  const lines = [
    `## ${escapeMd(id)} — ${escapeMd(required(card.title, `${id}.title`))}`,
    "",
    `- Version: ${escapeMd(required(card.version, `${id}.version`))}`,
    `- BPM: ${required(card.bpm?.min, `${id}.bpm.min`)}–${required(card.bpm?.max, `${id}.bpm.max`)}; default ${required(card.bpm?.default, `${id}.bpm.default`)}.`,
    `- Meter: ${required(card.meter?.numerator, `${id}.meter.numerator`)}/${required(card.meter?.denominator, `${id}.meter.denominator`)}; swing ${required(card.swing?.min, `${id}.swing.min`)}–${required(card.swing?.max, `${id}.swing.max`)}; default ${required(card.swing?.default, `${id}.swing.default`)}.`,
    `- Starter keys: ${required(card.keyDefaults, `${id}.keyDefaults`).map(escapeMd).join(", ")}. Scales: ${required(card.scales, `${id}.scales`).map(escapeMd).join(", ")}.`,
    `- Progressions: ${required(card.progressions, `${id}.progressions`).map((p) => `${escapeMd(required(p.roman, `${id}.progressions.roman`))} (${escapeMd(required(p.example, `${id}.progressions.example`))})`).join("; ")}.`,
    `- Roles: ${required(card.roles, `${id}.roles`).map(escapeMd).join(", ")}.`,
    `- Drum grid: ${escapeMd(required(card.gridRules, `${id}.gridRules`))}`,
    `- Bass: ${escapeMd(required(card.bassRules, `${id}.bassRules`))}`,
    `- Palette: ${required(card.palette, `${id}.palette`).map((p) => `${escapeMd(required(p.role, `${id}.palette.role`))} ${code(required(p.instrument, `${id}.palette.instrument`))}${Object.entries(required(p.params, `${id}.palette.params`)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => ` ${code(key)}=${value}`).join("")}`).join("; ")}.`,
    `- Arrangement: ${required(card.arrangement, `${id}.arrangement`).map((b) => `${escapeMd(required(b.role, `${id}.arrangement.role`))} ${required(b.bars, `${id}.arrangement.bars`)} bars`).join(" → ")}.`,
    `- Mix target: ${required(card.mixTargets?.lufs, `${id}.mixTargets.lufs`)} LUFS, ${required(card.mixTargets?.truePeak, `${id}.mixTargets.truePeak`)} dBTP; ${escapeMd(required(card.mixTargets?.notes, `${id}.mixTargets.notes`))}`,
    "",
    "Lint rules:",
    "",
  ];
  for (const rule of [...required(card.lintRules, `${id}.lintRules`)].sort()) {
    const meaning = RULE_MEANINGS[rule];
    if (!meaning) throw new Error(`missing lint rule meaning: ${rule}`);
    lines.push(`- ${code(rule)}: ${escapeMd(meaning)}`);
  }
  lines.push("", "Starter song, one-bar track patterns:", "");
  for (const track of required(card.starterSong?.tracks, `${id}.starterSong.tracks`)) {
    lines.push(`- ${code(required(track.id, `${id}.starterSong.tracks.id`))} (${code(required(track.instrument, `${id}.starterSong.tracks.instrument`))}): ${code(required(track.pattern, `${id}.starterSong.tracks.pattern`))}`);
  }
  lines.push("", "Sources:", "");
  for (const source of required(card.sources, `${id}.sources`)) lines.push(`- ${escapeMd(source)}`);
  return lines.join("\n");
}

/** @param {readonly RecipeCard[]} cards @returns {string} */
export function renderGenreDocs(cards) {
  const sorted = [...cards].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (sorted.length !== GENRE_IDS.length || sorted.some((card, index) => card.id !== GENRE_IDS[index])) {
    throw new Error(`recipe IDs differ from the documented set: expected ${GENRE_IDS.join(", ")}`);
  }
  const usedRules = new Set(sorted.flatMap((card) => required(card.lintRules, `${card.id}.lintRules`)));
  if (Object.keys(RULE_MEANINGS).some((id) => !usedRules.has(id))) throw new Error("lint rule meaning table contains an unused ID");
  return [
    "# Genre recipes",
    "",
    "Generated by bun scripts/gen-genre-docs.mjs from src/recipes/cards/. Do not edit by hand.",
    "",
    "Cards provide starting points; a user's tempo, key and artistic constraints take priority. Mix targets are guidance. Audio key estimates can be uncertain: check the declared key and `lint` out-of-key results. Tempo estimates may have half/double or 2:3 alternatives; with a song, analyze also reports the candidate that matches the declared BPM. The optional audio critic cannot hear sub-bass; inspect low-end metrics or listen separately. Static clipping-risk lint ignores master normalization, so confirm with rendered measurements.",
    "",
    ...sorted.flatMap((card) => [renderCard(card), ""]),
  ].join("\n").replace(/\n+$/, "\n");
}

/** @param {string[]} argv @returns {Promise<number>} */
export async function main(argv) {
  let check = false;
  let out = resolve(ROOT, DOC_PATH);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check" && !check) check = true;
    else if (argv[i] === "--out" && argv[i + 1] && !argv[i + 1].startsWith("--")) out = resolve(argv[++i]);
    else {
      console.error(`unknown or incomplete option: ${argv[i]}`);
      return 2;
    }
  }
  let expected;
  try {
    expected = renderGenreDocs(listRecipes());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  let current;
  try {
    current = await readFile(out);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
  }
  const bytes = Buffer.from(expected, "utf8");
  if (current?.equals(bytes)) return 0;
  if (check) {
    console.error(out);
    return 1;
  }
  for (let attempt = 0; ; attempt++) {
    const temp = `${out}.tmp-${attempt}`;
    try {
      await writeFile(temp, bytes, { flag: "wx" });
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
    try {
      await rename(temp, out);
      return 0;
    } catch (error) {
      await unlink(temp);
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
