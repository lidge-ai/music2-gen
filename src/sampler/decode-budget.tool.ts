import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { Music2Error } from "../shared/errors.tool.ts";

const DEFAULT_LIMIT_BYTES = 512 * 1024 * 1024;

/** One render invocation owns this cache and its decoded stereo PCM allowance. */
export class DecodeBudget {
  private usedBytes = 0;
  private readonly cache = new Map<string, Promise<StereoBuffer>>();
  readonly limitBytes: number;

  constructor(limitBytes: number = DEFAULT_LIMIT_BYTES) {
    if (!Number.isSafeInteger(limitBytes) || limitBytes < 0) {
      throw new Music2Error("E_INPUT", "invalid decode budget");
    }
    this.limitBytes = limitBytes;
  }

  /** The canonical path identifies immutable WAV bytes and therefore their source rate. */
  load(path: string, estimatedBytes: () => Promise<number | null>, decode: () => Promise<StereoBuffer>): Promise<StereoBuffer> {
    const cached = this.cache.get(path);
    if (cached) return cached;
    const pending = (async () => {
      let reserved = 0;
      try {
        const estimate = await estimatedBytes();
        if (estimate !== null) {
          if (!Number.isSafeInteger(estimate) || estimate < 0 || this.usedBytes + estimate > this.limitBytes)
            throw new Music2Error("E_CAPABILITY", "decoded PCM exceeds render budget");
          this.usedBytes += estimate;
          reserved = estimate;
        }
        const audio = await decode();
        const actual = audio.left.byteLength + audio.right.byteLength;
        if (this.usedBytes - reserved + actual > this.limitBytes)
          throw new Music2Error("E_CAPABILITY", "decoded PCM exceeds render budget");
        this.usedBytes += actual - reserved;
        return audio;
      } catch (cause) {
        this.usedBytes -= reserved;
        this.cache.delete(path);
        throw cause;
      }
    })();
    this.cache.set(path, pending);
    return pending;
  }
}

export function createDecodeBudget(limitBytes?: number): DecodeBudget {
  return new DecodeBudget(limitBytes);
}
