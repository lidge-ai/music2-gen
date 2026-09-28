/** Bounded circular delay. Read precedes write for each audio frame. */
export class DelayLine {
  private readonly samples: Float64Array;
  private cursor = 0;

  constructor(maxDelaySamples: number) {
    this.samples = new Float64Array(Math.ceil(maxDelaySamples) + 2);
  }

  /** Linear fractional read; delay is at least one sample. */
  read(delaySamples: number): number {
    const delay = Math.max(1, Math.min(delaySamples, this.samples.length - 2));
    const integer = Math.floor(delay);
    const fraction = delay - integer;
    const size = this.samples.length;
    let newer = this.cursor - integer;
    if (newer < 0) newer += size;
    let older = newer - 1;
    if (older < 0) older += size;
    return this.samples[newer]! * (1 - fraction) + this.samples[older]! * fraction;
  }

  write(sample: number): void {
    this.samples[this.cursor] = sample;
    this.cursor++;
    if (this.cursor === this.samples.length) this.cursor = 0;
  }
}
