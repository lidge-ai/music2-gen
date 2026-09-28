import { Music2Error } from "../shared/index.ts";
import type { Song } from "../song/index.ts";
import { validateSong } from "../song/index.ts";
import { buildSongArrangement } from "../recipes/new.tool.ts";
import { getRecipe } from "../recipes/recipes.tool.ts";
import type { RecipeArrangementBlock, RecipeId } from "../recipes/recipe.schema.ts";
import { USE_CASES } from "./usecase.schema.ts";
import type { UseCaseId } from "./usecase.schema.ts";

const TAIL_CHOICES = [0, 0.5, 1] as const;
const SHORT_RECOMMENDATIONS: Record<RecipeId, string> = {
  trap: "hook_first", drill_uk: "default", drill_ny: "pre_hook", boom_bap: "verse_led",
  house: "radio", lofi_hiphop: "default", techno: "detroit_linear",
};
function input(message: string): never { throw new Music2Error("E_INPUT", message); }

export function recommendedArrangement(id: UseCaseId, genre: RecipeId): string {
  const preset = USE_CASES.find((entry) => entry.id === id);
  if (!preset) input(`unknown preset ${id}; valid choices: ${USE_CASES.map((entry) => entry.id).join(", ")}`);
  if (preset.allowedGenres && !preset.allowedGenres.includes(genre))
    input(`${id} supports genres: ${preset.allowedGenres.join(", ")}`);
  if (id.startsWith("short_")) return SHORT_RECOMMENDATIONS[genre];
  if (id === "study_lofi") return "vignette";
  if (id === "game_loop" && (genre === "drill_uk" || genre === "lofi_hiphop")) return "default";
  return getRecipe(genre).defaultArrangement;
}

interface DurationChoice { bpm: number; bars: number; tail: number }
function exactDuration(song: Song, seconds: number, lockedBpm: number | undefined, preferTail: boolean): DurationChoice {
  const card = getRecipe(song.genre ?? "");
  const rate = song.sampleRate ?? 44100;
  const targetFrames = seconds * rate;
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isSafeInteger(targetFrames) || targetFrames < 1)
    input("seconds must be positive and exactly representable in sample frames");
  if (lockedBpm !== undefined && (!Number.isInteger(lockedBpm) || lockedBpm < card.bpm.min || lockedBpm > card.bpm.max))
    input(`locked BPM must be in ${card.bpm.min}..${card.bpm.max}`);
  const meter = song.meter?.numerator ?? 4;
  const originalBars = song.arrangement.reduce((total, entry) => total + (song.sections.find((section) => section.id === entry.section)?.bars ?? 0) * (entry.repeats ?? 1), 0);
  const choices: DurationChoice[] = [];
  for (let bpm = lockedBpm ?? card.bpm.min; bpm <= (lockedBpm ?? card.bpm.max); bpm++) {
    for (const tail of TAIL_CHOICES) {
      const approx = (seconds - tail) * bpm / (meter * 60);
      for (const bars of new Set([Math.floor(approx), Math.ceil(approx), Math.round(approx)])) {
        if (bars > 0 && Math.ceil((bars * meter * 60 / bpm + tail) * rate) === targetFrames)
          choices.push({ bpm, bars, tail });
      }
    }
  }
  choices.sort((a, b) => Math.abs(a.bpm - card.bpm.default) - Math.abs(b.bpm - card.bpm.default)
    || a.bpm - b.bpm
    || (preferTail ? (a.tail === 0 ? 3 : a.tail) - (b.tail === 0 ? 3 : b.tail) : a.tail - b.tail)
    || Math.abs(a.bars - originalBars) - Math.abs(b.bars - originalBars));
  if (!choices[0]) input(`no exact duration for ${card.id}: ${seconds}s, BPM ${lockedBpm ?? `${card.bpm.min}..${card.bpm.max}`}, tails 0/0.5/1s`);
  return choices[0];
}

function blocksForDuration(id: UseCaseId, bars: number): RecipeArrangementBlock[] {
  if (id.startsWith("short_")) {
    if (bars === 1) return [{ role: "hook", bars }];
    const hook = Math.min(8, bars - 1);
    const middle = bars - hook - 1;
    return [{ role: "hook", bars: hook }, ...(middle ? [{ role: "verse" as const, bars: middle }] : []), { role: "outro", bars: 1 }];
  }
  if (id === "vo_bed" || id === "study_lofi") return [{ role: "groove", bars }];
  return bars > 1 ? [{ role: "hook", bars: bars - 1 }, { role: "outro", bars: 1 }] : [{ role: "hook", bars }];
}

function addStudyLayerChanges(song: Song, bars: number): void {
  const base = song.sections.find((section) => section.role === "groove");
  if (!base) input("study_lofi needs a groove section");
  const melody = song.tracks.find((track) => track.id === "melody");
  const sections: Song["sections"] = [];
  const arrangement: Song["arrangement"] = [];
  let remaining = bars;
  let index = 0;
  while (remaining > 0) {
    const length = Math.min(8, remaining);
    const muted = index % 2 === 1;
    const id = `groove_${muted ? "soft" : "full"}_${length}`;
    if (!sections.some((section) => section.id === id)) {
      const section = structuredClone(base);
      section.id = id;
      section.bars = length;
      if (muted && melody) (section.patterns ??= {})[melody.id] = null;
      sections.push(section);
    }
    arrangement.push({ section: id, repeats: 1 });
    remaining -= length;
    index++;
  }
  song.sections = sections;
  song.arrangement = arrangement;
}

export function applyUseCase(song: Song, id: UseCaseId, opts: { seconds?: number; lockedBpm?: number } = {}): Song {
  const features: string[] = [];
  if (song.tracks.some((track) => track.notes !== undefined)) features.push("note lists");
  if (song.audioTracks?.length) features.push("audioTracks");
  if (song.tracks.some((track) => track.automation?.length) || song.audioTracks?.some((track) => track.automation?.length))
    features.push("automation");
  if (features.length) input(`use case cannot rearrange a song with ${features.join(", ")}`);
  const preset = USE_CASES.find((entry) => entry.id === id);
  if (!preset) input(`unknown preset ${id}; valid choices: ${USE_CASES.map((entry) => entry.id).join(", ")}`);
  const card = getRecipe(song.genre ?? "");
  if (preset.allowedGenres && !preset.allowedGenres.includes(card.id))
    input(`${id} supports genres: ${preset.allowedGenres.join(", ")}`);
  const copy = structuredClone(song);
  const fixed = id.startsWith("short_") || id === "podcast_sting" || id === "podcast_theme";
  if (fixed && opts.seconds !== undefined && opts.seconds !== preset.defaultSeconds)
    input(`${id} requires exactly ${preset.defaultSeconds} seconds`);
  if (opts.seconds !== undefined && !["vo_bed", "study_lofi"].includes(id) && !fixed)
    input(`--seconds is unavailable for ${id}`);
  if (opts.seconds !== undefined && (!Number.isFinite(opts.seconds) || opts.seconds <= 0)) input("seconds must be positive and finite");
  if (id === "study_lofi" && opts.seconds !== undefined && (opts.seconds < 90 || opts.seconds > 150))
    input("study_lofi seconds must be in 90..150");
  const duration = opts.seconds ?? preset.defaultSeconds;
  if (duration !== undefined && (fixed || opts.seconds !== undefined || id === "study_lofi")) {
    const choice = exactDuration(copy, duration, opts.lockedBpm, id.startsWith("podcast_"));
    copy.bpm = choice.bpm;
    copy.tailSeconds = choice.tail;
    buildSongArrangement(copy, blocksForDuration(id, choice.bars));
    if (id === "study_lofi") addStudyLayerChanges(copy, choice.bars);
    if (id.startsWith("short_") || id.startsWith("podcast_")) {
      const lastId = copy.arrangement.at(-1)?.section;
      const ending = copy.sections.find((section) => section.id === lastId && section.role === "outro");
      if (ending) {
        const kick = copy.tracks.find((track) => track.id === "kick");
        if (kick) (ending.patterns ??= {})[kick.id] = `bd ${Array(15).fill("~").join(" ")}`;
        for (const track of copy.tracks.filter((track) => track.id === "hats")) (ending.patterns ??= {})[track.id] = null;
      }
    }
  } else if (id === "game_loop") {
    buildSongArrangement(copy, [{ role: "groove", bars: 16 }]);
    copy.loop = true;
  } else if (id === "vo_bed") {
    buildSongArrangement(copy, [{ role: "groove", bars: 16 }]);
  } else if (id === "type_beat") {
    buildSongArrangement(copy, [
      { role: "intro", bars: 8 }, { role: "hook", bars: 8 }, { role: "verse", bars: 16 },
      { role: "hook", bars: 8 }, { role: "verse", bars: 16 }, { role: "hook", bars: 8 },
      { role: "verse", bars: 8 }, { role: "outro", bars: 8 },
    ]);
    const intro = copy.sections.find((section) => section.role === "intro");
    if (intro) for (const track of copy.tracks.filter((track) => track.id === "kick" || track.id === "bass" || track.instrument === "808"))
      (intro.patterns ??= {})[track.id] = null;
    for (const verse of copy.sections.filter((section) => section.role === "verse"))
      for (const track of copy.tracks.filter((track) => track.id === "melody")) (verse.patterns ??= {})[track.id] = null;
  }
  if (id === "vo_bed") {
    for (const track of copy.tracks.filter((track) => track.kind === "notes" && track.id !== "bass" && track.instrument !== "808")) {
      track.gain = (track.gain ?? 0) - 6;
      for (const section of copy.sections) (section.patterns ??= {})[track.id] = null;
    }
  }
  copy.master = { ...copy.master, targetLufs: preset.targetLufs, ceilingDb: preset.ceilingDb };
  copy.useCase = id;
  validateSong(copy);
  return copy;
}
