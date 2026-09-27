import { Music2Error } from "./errors.tool.ts";

/** Largest reduced numerator/denominator magnitude accepted (devlog 010: overflow is an internal error). */
export const FRACTION_LIMIT = 2 ** 40;

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** Exact rational number used for pattern time (one cycle = one bar). Always reduced with d > 0. */
export class Fraction {
  readonly n: number;
  readonly d: number;

  constructor(n: number | bigint, d: number | bigint = 1) {
    let bn = BigInt(n);
    let bd = BigInt(d);
    if (bd === 0n) throw new Music2Error("E_INTERNAL", "fraction with zero denominator");
    if (bd < 0n) { bn = -bn; bd = -bd; }
    const g = gcd(bn, bd) || 1n;
    bn /= g;
    bd /= g;
    const limit = BigInt(FRACTION_LIMIT);
    if (bn > limit || -bn > limit || bd > limit) {
      throw new Music2Error("E_INTERNAL", "fraction overflow", { details: { n: bn.toString(), d: bd.toString() } });
    }
    this.n = Number(bn);
    this.d = Number(bd);
  }

  static of(n: number, d = 1): Fraction {
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Music2Error("E_INTERNAL", "fraction parts must be integers");
    return new Fraction(n, d);
  }

  static fromNumber(value: number): Fraction {
    return Fraction.of(value, 1);
  }

  add(o: Fraction): Fraction {
    return new Fraction(BigInt(this.n) * BigInt(o.d) + BigInt(o.n) * BigInt(this.d), BigInt(this.d) * BigInt(o.d));
  }

  sub(o: Fraction): Fraction {
    return new Fraction(BigInt(this.n) * BigInt(o.d) - BigInt(o.n) * BigInt(this.d), BigInt(this.d) * BigInt(o.d));
  }

  mul(o: Fraction): Fraction {
    return new Fraction(BigInt(this.n) * BigInt(o.n), BigInt(this.d) * BigInt(o.d));
  }

  div(o: Fraction): Fraction {
    if (o.n === 0) throw new Music2Error("E_INTERNAL", "fraction division by zero");
    return new Fraction(BigInt(this.n) * BigInt(o.d), BigInt(this.d) * BigInt(o.n));
  }

  neg(): Fraction {
    return new Fraction(-this.n, this.d);
  }

  cmp(o: Fraction): number {
    const l = BigInt(this.n) * BigInt(o.d);
    const r = BigInt(o.n) * BigInt(this.d);
    return l < r ? -1 : l > r ? 1 : 0;
  }

  lt(o: Fraction): boolean { return this.cmp(o) < 0; }
  lte(o: Fraction): boolean { return this.cmp(o) <= 0; }
  gt(o: Fraction): boolean { return this.cmp(o) > 0; }
  gte(o: Fraction): boolean { return this.cmp(o) >= 0; }
  eq(o: Fraction): boolean { return this.cmp(o) === 0; }

  /** Largest integer <= this value. */
  floor(): number {
    return Math.floor(this.n / this.d) === this.n / this.d ? this.n / this.d : Number(floorDiv(BigInt(this.n), BigInt(this.d)));
  }

  /** Start of the cycle containing this time. */
  sam(): Fraction {
    return Fraction.of(this.floor());
  }

  valueOf(): number {
    return this.n / this.d;
  }

  toString(): string {
    return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
  }
}

function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q;
}

export function min(a: Fraction, b: Fraction): Fraction {
  return a.lte(b) ? a : b;
}

export function max(a: Fraction, b: Fraction): Fraction {
  return a.gte(b) ? a : b;
}
