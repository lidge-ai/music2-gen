import type { ResolvedSong, Timeline, TimedEvent } from "../song/index.ts";
import { fnv1a32, Music2Error } from "../shared/index.ts";
import { drawText } from "./font.tool.ts";
import { encodeRgbPng } from "./png.tool.ts";

const LEFT = 80;
const TOP = 24;
const BOTTOM = 24;
const PITCH_HEIGHT = 10;
const DRUM_HEIGHT = 18;
const TEXT = [226, 236, 245] as const;
const GRID = [50, 65, 79] as const;

function paint(rgb: Uint8Array, width: number, x: number, y: number, color: readonly number[]): void {
  const i = (y * width + x) * 3;
  rgb[i] = color[0]!; rgb[i + 1] = color[1]!; rgb[i + 2] = color[2]!;
}

function rect(rgb: Uint8Array, width: number, height: number, x0: number, y0: number,
  x1: number, y1: number, color: readonly number[]): void {
  for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) paint(rgb, width, x, y, color);
  }
}

function trackColor(id: string): readonly [number, number, number] {
  const hue = fnv1a32(id) % 360;
  const chroma = 0.72;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs(sector % 2 - 1));
  const rgb = sector < 1 ? [chroma, x, 0] : sector < 2 ? [x, chroma, 0] :
    sector < 3 ? [0, chroma, x] : sector < 4 ? [0, x, chroma] :
      sector < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return [Math.round((rgb[0]! + 0.28) * 255), Math.round((rgb[1]! + 0.28) * 255),
    Math.round((rgb[2]! + 0.28) * 255)];
}

/** Exact song note times and pitches, plus separate onset lanes for drum tracks. */
export function renderPianoRoll(song: ResolvedSong, timeline: Timeline): Buffer {
  if (!Number.isFinite(timeline.durationSeconds) || timeline.durationSeconds <= 0 ||
      !Number.isFinite(timeline.secondsPerBar) || timeline.secondsPerBar <= 0) {
    throw new Music2Error("E_INPUT", "invalid timeline for piano roll");
  }
  const notes = timeline.events.filter((event) => event.midi !== null);
  const drumTracks = song.tracks.filter((track) => track.kind === "drums");
  let minimum = 127, maximum = 0;
  for (const note of notes) { minimum = Math.min(minimum, note.midi!); maximum = Math.max(maximum, note.midi!); }
  const low = notes.length ? Math.max(0, minimum - 2) : 48;
  const high = notes.length ? Math.min(127, maximum + 2) : 72;
  const pitchArea = (high - low + 1) * PITCH_HEIGHT;
  const dataWidth = Math.min(2400, Math.max(640, Math.ceil(timeline.durationSeconds * 80)));
  const width = LEFT + dataWidth;
  const height = TOP + pitchArea + drumTracks.length * DRUM_HEIGHT + BOTTOM;
  const rgb = new Uint8Array(width * height * 3);
  const xAt = (time: number): number => LEFT + Math.round(time / timeline.durationSeconds * dataWidth);
  const rowAt = (midi: number): number => TOP + (high - midi) * PITCH_HEIGHT;
  const drumTop = TOP + pitchArea;

  rect(rgb, width, height, 0, 0, width, height, [15, 23, 34]);
  rect(rgb, width, height, LEFT, TOP, width, TOP + pitchArea, [24, 34, 48]);
  for (let midi = low; midi <= high; midi++) {
    const y = rowAt(midi);
    if (midi % 12 === 0) {
      rect(rgb, width, height, LEFT, y, width, y + 1, GRID);
      drawText(rgb, width, height, 5, y + 1, `C${midi / 12 - 1}`, TEXT);
    }
  }
  drumTracks.forEach((track, index) => {
    const y = drumTop + index * DRUM_HEIGHT;
    rect(rgb, width, height, LEFT, y, width, y + DRUM_HEIGHT, index % 2 ? [27, 40, 53] : [32, 45, 57]);
    drawText(rgb, width, height, 5, y + 5, track.id.slice(0, 12), TEXT);
  });
  if (!notes.length) drawText(rgb, width, height, LEFT + 12, TOP + pitchArea / 2 - 3, "NO NOTES", TEXT);

  const events = timeline.events.map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.trackIndex - b.event.trackIndex || a.event.order - b.event.order || a.index - b.index);
  const drumIndex = new Map(drumTracks.map((track, index) => [track.id, index]));
  // Mono voices (808, bass) sustain until the next onset of the same track, as the renderer plays them.
  const monoEnd = new Map<TimedEvent, number>();
  const lastByTrack = new Map<number, TimedEvent>();
  for (const event of [...timeline.events].sort((a, b) => a.time - b.time || a.order - b.order)) {
    if (!song.tracks[event.trackIndex]?.mono || event.midi === null) continue;
    const previous = lastByTrack.get(event.trackIndex);
    if (previous && event.time > previous.time) monoEnd.set(previous, event.time);
    lastByTrack.set(event.trackIndex, event);
  }
  for (const last of lastByTrack.values()) monoEnd.set(last, timeline.durationSeconds);
  for (const { event } of events) drawEvent(event);
  function drawEvent(event: TimedEvent): void {
    if (event.time >= timeline.durationSeconds || event.time + event.duration <= 0) return;
    const x0 = Math.max(LEFT, Math.min(width - 1, xAt(event.time)));
    const track = song.tracks[event.trackIndex];
    if (!track) return;
    const color = trackColor(track.id);
    if (event.midi !== null && event.midi >= low && event.midi <= high) {
      const end = monoEnd.get(event) ?? event.time + event.duration;
      const x1 = Math.max(x0 + 1, Math.min(width, xAt(end)));
      const y = rowAt(event.midi);
      rect(rgb, width, height, x0, y + 1, x1, y + PITCH_HEIGHT - 1, color);
    } else if (track.kind === "drums") {
      const lane = drumIndex.get(track.id);
      if (lane === undefined) return;
      const y = drumTop + lane * DRUM_HEIGHT;
      rect(rgb, width, height, x0, y + 3, x0 + 3, y + DRUM_HEIGHT - 3, color);
    }
  }

  for (let bar = 0; bar <= timeline.bars; bar++) {
    const x = xAt(bar * timeline.secondsPerBar);
    if (x >= width) continue;
    rect(rgb, width, height, x, TOP, x + 1, height - BOTTOM, [82, 93, 105]);
    if (bar < timeline.bars) drawText(rgb, width, height, x + 2, height - BOTTOM + 7, `${bar + 1}`, TEXT);
  }
  for (const placement of timeline.placements) {
    const x = xAt(placement.startBar * timeline.secondsPerBar);
    if (x >= width) continue;
    rect(rgb, width, height, x, TOP, x + 2, height - BOTTOM, [246, 197, 91]);
    drawText(rgb, width, height, x + 3, 8, (placement.role === null || placement.role === placement.section ? placement.section : `${placement.section} (${placement.role})`).slice(0, 24), TEXT);
  }
  drawText(rgb, width, height, 3, height - BOTTOM + 7, "BAR", TEXT);
  return encodeRgbPng(width, height, rgb);
}
