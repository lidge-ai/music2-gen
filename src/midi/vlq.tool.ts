import { Music2Error } from "../shared/errors.tool.ts";
import { MAX_VLQ } from "./smf.schema.ts";

export function writeVlq(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > MAX_VLQ) {
    throw new Music2Error("E_INPUT", "VLQ value must be 0..0x0FFFFFFF");
  }
  const result = [value & 0x7f];
  let remaining = Math.floor(value / 128);
  while (remaining > 0) {
    result.unshift((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  return Uint8Array.from(result);
}

export function readVlq(bytes: Uint8Array, offset: number, end: number): { value: number; next: number } {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end > bytes.length || offset >= end) {
    throw new Music2Error("E_PARSE", "truncated VLQ", { details: { offset } });
  }
  let value = 0;
  for (let count = 0; count < 4; count++) {
    const at = offset + count;
    if (at >= end) throw new Music2Error("E_PARSE", "truncated VLQ", { details: { offset: at } });
    const byte = bytes[at]!;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: at + 1 };
  }
  throw new Music2Error("E_PARSE", "VLQ exceeds four bytes", { details: { offset: offset + 4 } });
}
