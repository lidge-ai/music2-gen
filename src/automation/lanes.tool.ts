import type { ResolvedLane } from "../song/song-daw.schema.ts";

export function findLane(lanes: readonly ResolvedLane[] | undefined, target: string): ResolvedLane | undefined {
  return lanes?.find((lane) => lane.target === target);
}
