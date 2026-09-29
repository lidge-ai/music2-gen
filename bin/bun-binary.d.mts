/** Types for the plain-Node launcher helper in bun-binary.mjs. */
export declare const REAL_BUN_MIN_BYTES: number;
export declare const BUN_PATH_ENV: string;
export declare function isRealBunBinary(path: string): boolean;
export declare function resolveBun(options?: {
  env?: Record<string, string | undefined>;
  from?: string;
  warn?: (message: string) => void;
}): { path: string; source: "override" | "bundled" } | { error: string };
