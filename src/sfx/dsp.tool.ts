/** Local W3C Audio EQ Cookbook biquad, with coefficients refreshed by the caller. */
export type FilterKind = "lowpass" | "highpass" | "bandpass";
export class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0;
  private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  configure(kind: FilterKind, hz: number, rate: number, q = .707): void {
    const w = 2 * Math.PI * Math.max(20, Math.min(hz, rate * .45)) / rate;
    const c = Math.cos(w); const a = Math.sin(w) / (2 * q); const d = 1 + a;
    if (kind === "bandpass") { this.b0 = a / d; this.b1 = 0; this.b2 = -a / d; }
    else if (kind === "lowpass") {
      this.b0 = (1 - c) / (2 * d); this.b1 = (1 - c) / d; this.b2 = this.b0;
    } else {
      this.b0 = (1 + c) / (2 * d); this.b1 = -(1 + c) / d; this.b2 = this.b0;
    }
    this.a1 = -2 * c / d; this.a2 = (1 - a) / d;
  }
  sample(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

export function polyBlep(t: number, dt: number): number {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
export function saw(t: number, dt: number): number { return 2 * t - 1 - polyBlep(t, dt); }
export function pulse(t: number, dt: number, duty: number): number {
  const t2 = (t - duty + 1) % 1;
  return (t < duty ? 1 : -1) + polyBlep(t, dt) - polyBlep(t2, dt);
}
export function bounded(x: number): number { return Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0; }

export class PinkNoise {
  private rows = new Float64Array(8);
  private count = 0;
  next(white: number, draw: () => number): number {
    this.count++;
    const bit = this.count & -this.count;
    const row = Math.min(7, Math.log2(bit));
    this.rows[row] = 2 * draw() - 1;
    let sum = white;
    for (const value of this.rows) sum += value;
    return sum / 4;
  }
}
