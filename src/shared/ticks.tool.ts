import { Music2Error } from "./errors.tool.ts";
import type { Fraction } from "./rational.tool.ts";

export const PPQ = 960;

function nonnegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Music2Error("E_INTERNAL", `invalid ${label}`);
}
function safeTick(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Music2Error("E_INTERNAL", "tick overflow");
  return value;
}
function tempo(bpm: number): void {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Music2Error("E_INTERNAL", "invalid bpm");
}

export function barTicks(numerator: number): number {
  if (!Number.isSafeInteger(numerator) || numerator < 2 || numerator > 12) throw new Music2Error("E_INTERNAL", "invalid meter numerator");
  return numerator * PPQ;
}
export function beatsToTicks(beats: number): number {
  nonnegative(beats, "beats");
  return safeTick(Math.floor(beats * PPQ + 0.5));
}
export function ticksToSeconds(ticks: number, bpm: number): number {
  safeTick(ticks); tempo(bpm);
  const seconds = ticks * 60 / (bpm * PPQ);
  if (!Number.isFinite(seconds)) throw new Music2Error("E_INTERNAL", "seconds overflow");
  return seconds;
}
export function secondsToTicks(seconds: number, bpm: number): number {
  nonnegative(seconds, "seconds"); tempo(bpm);
  return safeTick(Math.floor(seconds * bpm * PPQ / 60 + 0.5));
}
export function fractionToTicks(bars: Fraction, numerator: number): { ticks: number; exact: boolean } {
  const perBar = barTicks(numerator);
  if (!Number.isSafeInteger(bars.n) || !Number.isSafeInteger(bars.d) || bars.n < 0 || bars.d <= 0)
    throw new Music2Error("E_INTERNAL", "invalid bar fraction");
  const scaled = BigInt(bars.n) * BigInt(perBar);
  const divisor = BigInt(bars.d);
  const quotient = (scaled * 2n + divisor) / (divisor * 2n);
  if (quotient > BigInt(Number.MAX_SAFE_INTEGER)) throw new Music2Error("E_INTERNAL", "tick overflow");
  return { ticks: Number(quotient), exact: scaled % divisor === 0n };
}
