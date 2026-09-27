import { Music2Error } from "../shared/index.ts";

/** Evenly spaced Euclidean pulses, anchored at slot zero. */
export function bjorklund(k: number, n: number): boolean[] {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n < 1 || n > 64 || k < 0 || k > n) {
    throw new Music2Error("E_PARSE", "euclidean pulses must satisfy 0 <= k <= n <= 64");
  }
  const bits = Array<boolean>(n).fill(false);
  if (k === 0) return bits;
  // Successive ceil boundaries give Euclidean gaps and place the first pulse at zero.
  for (let pulse = 0; pulse < k; pulse++) bits[Math.ceil(pulse * n / k)] = true;
  return bits;
}

export function rotateLeft<T>(bits: readonly T[], r: number): T[] {
  if (bits.length === 0) return [];
  const offset = ((r % bits.length) + bits.length) % bits.length;
  return [...bits.slice(offset), ...bits.slice(0, offset)];
}
