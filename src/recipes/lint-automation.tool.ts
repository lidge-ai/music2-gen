import type { ResolvedLane, ResolvedSong } from "../song/index.ts";
import type { LintResult } from "./lint.tool.ts";

/** Gain and send lanes replace the static value; flag lanes that rise far above it. */
export const GAIN_LANE_MARGIN_DB = 12;
export const SEND_LANE_MARGIN_DB = 12;

interface LaneOwner { gain: number; sends: { reverb: number; delay: number }; automation?: readonly ResolvedLane[] }

function checkTrack(track: LaneOwner, prefix: string, results: LintResult[]): void {
  track.automation?.forEach((lane, laneIndex) => {
    let loudest = -1;
    lane.points.forEach((point, index) => { if (loudest < 0 || point.value > lane.points[loudest]!.value) loudest = index; });
    if (loudest < 0) return;
    const value = lane.points[loudest]!.value;
    const path = `${prefix}.automation[${laneIndex}].points[${loudest}].value`;
    if (lane.target === "gain" && value - track.gain > GAIN_LANE_MARGIN_DB) {
      results.push({ id: "generic/automation_gain_jump", severity: "warning", path, observed: value,
        expected: `<= static gain ${track.gain} + ${GAIN_LANE_MARGIN_DB} dB`,
        fix: `Gain lanes are absolute and replace the static gain; write lane values around ${track.gain} dB (ride a few dB either side), not offsets from 0.` });
    }
    const bus = lane.target === "send.reverb" ? "reverb" : lane.target === "send.delay" ? "delay" : null;
    if (bus === null) return;
    const base = track.sends[bus];
    if (base > 0 && value > 0 && 20 * Math.log10(value / base) > SEND_LANE_MARGIN_DB) {
      results.push({ id: "generic/automation_send_jump", severity: "warning", path, observed: value,
        expected: `<= static send ${base} + ${SEND_LANE_MARGIN_DB} dB`,
        fix: "Send lanes are absolute and replace the static send; write values near the static send level." });
    }
  });
}

/** Advisory lane checks for music and audio tracks; an intentional large ride stays a valid song. */
export function automationRules(song: ResolvedSong): LintResult[] {
  const results: LintResult[] = [];
  song.tracks.forEach((track, index) => checkTrack(track, `$.tracks[${index}]`, results));
  song.audioTracks?.forEach((track, index) => checkTrack(track, `$.audioTracks[${index}]`, results));
  return results;
}
