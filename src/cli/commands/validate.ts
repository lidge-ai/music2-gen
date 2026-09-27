import { resolve } from "node:path";
import { buildTimeline, loadSong } from "../../song/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export const validate: CommandSpec = {
  name: "validate", summary: "Validate a song and summarize its timeline",
  usage: "music2 validate <song.json> [--json]", options: {},
  async run({ args, cwd }) {
    if (args.length !== 1) throw new Music2Error("E_INPUT", "validate requires one song path");
    const song = await loadSong(resolve(cwd, args[0]!));
    const timeline = buildTimeline(song);
    return { command: "validate", data: {
      title: song.title, bpm: song.bpm, bars: timeline.bars, durationSeconds: timeline.durationSeconds,
      tracks: song.tracks.map((track) => ({ id: track.id, events: timeline.events.filter((event) => event.track === track.id).length })),
    } };
  },
};
