import { Music2Error } from "../shared/index.ts";

export interface BalanceTarget { track: string; layer?: string; db: number }
export interface BalanceWindow { startBar: number; endBar: number; section?: string; occurrence?: number }
export interface BalanceRow {
  id: string; kind: "track" | "main" | "layer"; track: string; layer?: string;
  rmsDb: number | null; peakDb: number | null; activeRatio: number;
  targetDb?: number; deltaDb?: number; applied?: boolean; skipped?: string;
}
export interface BalanceChange { track: string; layer?: string; path: string; before: number; after: number }
export interface BalanceReport {
  window: BalanceWindow; reference?: string; rows: BalanceRow[]; changes: BalanceChange[];
  after?: BalanceRow[]; warnings: string[];
}
export interface BalanceOptions {
  section?: string; occurrence?: number; bars?: string; targets: BalanceTarget[];
  reference?: string; maxStep?: number; apply?: boolean;
}

export function parseTarget(text: string): BalanceTarget {
  const match = /^([a-z][a-z0-9_-]{0,31})(?:\.([a-z0-9][a-z0-9_-]{0,31}))?=([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/.exec(text);
  if (!match || !Number.isFinite(Number(match[3])) || match[2] === "main")
    throw new Music2Error("E_INPUT", "target must be track=dB or track.layer=dB; .main is read-only");
  return { track: match[1]!, ...(match[2] === undefined ? {} : { layer: match[2] }), db: Number(match[3]) };
}
