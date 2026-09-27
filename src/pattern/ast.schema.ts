import type { Fraction } from "../shared/index.ts";

export interface Atom { raw: string; name: string; index: number | null; num: number | null; offset: number }
export type Node =
  | { type: "atom"; atom: Atom; id: number }
  | { type: "rest"; id: number }
  | { type: "seq"; steps: { node: Node; weight: number }[]; id: number }
  | { type: "stack"; branches: Node[]; id: number }
  | { type: "alt"; items: Node[]; id: number }
  | { type: "fast"; node: Node; factor: number; id: number }
  | { type: "slow"; node: Node; factor: number; id: number }
  | { type: "euclid"; node: Node; k: number; n: number; r: number; id: number }
  | { type: "degrade"; node: Node; prob: number; id: number }
  | { type: "choose"; options: Node[]; id: number };
export interface Span { begin: Fraction; end: Fraction }
export interface Hap { whole: Span; part: Span; atom: Atom; order: number }
export interface QueryCtx { seed: number; salt: string }
