import { resolve } from "node:path";
import { buildTimeline, loadSong } from "../../song/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export const events: CommandSpec = {
  name: "events", summary: "List timed song events",
  usage: "music2 events <song.json> [--bars start:end] [--track id] [--json]",
  options: {
    bars: { type: "string", description: "Zero-based half-open bar range" },
    track: { type: "string", description: "Only events from this track id" },
  },
  async run({ args, values, cwd }) {
    if (args.length !== 1) throw new Music2Error("E_INPUT", "events requires one song path");
    const song = await loadSong(resolve(cwd, args[0]!));
    const timeline = buildTimeline(song);
    const selected = values["track"];
    if (typeof selected === "string" && !song.tracks.some((track) => track.id === selected)) {
      throw new Music2Error("E_INPUT", `unknown track: ${selected}`);
    }
    let start = 0;
    let end = timeline.bars;
    const bars = values["bars"];
    if (typeof bars === "string") {
      const match = /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(bars);
      if (!match) throw new Music2Error("E_INPUT", "bars must be start:end");
      start = Number(match[1]); end = Number(match[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= end || end > timeline.bars) {
        throw new Music2Error("E_INPUT", `bar range must be within 0:${timeline.bars}`);
      }
    }
    return { command: "events", data: { events: timeline.events
      .filter((event) => event.bar >= start && event.bar < end && (selected === undefined || event.track === selected))
      .map((event) => ({ ...event, time: Math.round(event.time * 1e6) / 1e6,
        duration: Math.round(event.duration * 1e6) / 1e6, slot: Math.round(event.slot * 1e6) / 1e6 })) } };
  },
};
