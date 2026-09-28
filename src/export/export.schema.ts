import type { StereoBuffer } from "../audio-io/index.ts";

export type ExportFile =
  | { path: string; wav: StereoBuffer; bits: 16 | 24; seed: number }
  | { path: string; bytes: Uint8Array };

export interface ExportPlan<D> { files: ExportFile[]; data: D }
