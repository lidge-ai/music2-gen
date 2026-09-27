/** Deterministic hashing and PRNG (devlog 003 D6): no Math.random or Date anywhere in audio paths. */

/** 32-bit FNV-1a over the parts joined by NUL. */
export function fnv1a32(...parts: (string | number)[]): number {
  const text = parts.map(String).join("\u0000");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h ^= c & 0xff;
    h = Math.imul(h, 0x01000193);
    if (c > 0xff) {
      h ^= c >>> 8;
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

/** mulberry32: returns a generator of floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** First draw of mulberry32 seeded by fnv1a32(parts): a stable pseudo-random number in [0, 1) per address. */
export function unitHash(...parts: (string | number)[]): number {
  return mulberry32(fnv1a32(...parts))();
}
