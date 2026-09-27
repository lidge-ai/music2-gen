import { fnv1a32, mulberry32, Music2Error } from "../../shared/index.ts";
import type { VoiceContext, VoiceEvent, VoiceSpec } from "../render.schema.ts";

type DrumName = "bd" | "sd" | "cp" | "hh" | "oh" | "rim" | "perc" | "tom";
type Preset = readonly [pitch: number, length: number, color: number];

// Each named drum has four stable timbre presets: pitch, envelope length, and brightness.
const PRESETS: Record<DrumName, readonly [Preset, Preset, Preset, Preset]> = {
  bd: [[1, 1, .5], [.88, .86, .35], [1.12, 1.16, .7], [.96, 1.3, .2]],
  sd: [[1, 1, .5], [.93, .83, .65], [1.08, 1.1, .8], [.85, 1.25, .3]],
  cp: [[1, 1, .5], [.96, .9, .7], [1.06, 1.1, .85], [.9, 1.2, .35]],
  hh: [[1, 1, .5], [.9, .8, .7], [1.1, 1.2, .85], [.95, 1.4, .3]],
  oh: [[1, 1, .5], [.9, .8, .7], [1.1, 1.2, .85], [.95, 1.4, .3]],
  rim: [[1, 1, .5], [.9, .8, .7], [1.1, 1.2, .85], [.95, 1.4, .3]],
  perc: [[1, 1, .5], [.9, .8, .7], [1.1, 1.2, .85], [.95, 1.4, .3]],
  tom: [[1, 1, .5], [.9, .8, .7], [1.1, 1.2, .85], [.95, 1.4, .3]],
};

export const DRUM_NAMES: readonly string[] = Object.freeze(Object.keys(PRESETS));

function drumName(ctx: VoiceContext, event: VoiceEvent): DrumName {
  const name = event.sample?.name;
  if (name !== undefined && Object.hasOwn(PRESETS, name)) return name as DrumName;
  throw new Music2Error("E_SCHEMA", `unknown drum sample ${String(name)} on track ${ctx.track.id}`, {
    details: { issues: [{ path: `tracks.${ctx.track.id}.pattern`, message: `unknown drum sample ${String(name)}` }] },
  });
}

function renderDrum(out: Float32Array, ctx: VoiceContext, event: VoiceEvent,
  name: DrumName, preset: Preset, tone: number, decayMs: number, noiseMix: number,
  variant: number): void {
  const rate = ctx.sampleRate;
  const [pitch, length, color] = preset;
  const baseDuration = name === "hh" ? .035 : name === "oh" ? .3 : decayMs / 1000;
  const duration = baseDuration * length;
  const maximum = Math.min(ctx.frames, event.startFrame + Math.ceil(rate * duration * 1.5));
  const start = Math.max(0, event.startFrame);
  if (maximum <= start) return;
  const rng = mulberry32(fnv1a32(event.seed, name, variant));
  const decay = Math.exp(-6.907755 / (duration * rate));
  const highpassAlpha = Math.exp(-2 * Math.PI * (1800 + color * 4200) / rate);
  let envelope = Math.exp(-6.907755 * (start - event.startFrame) / (duration * rate));
  let phase = 0;
  let low = 0;
  const bodyHz = (name === "sd" || name === "cp" ? 190 : name === "rim" ? 800 : 400) * pitch;
  const cpSpacing = Math.max(1, Math.round(.016 * rate));
  for (let frame = start; frame < maximum; frame++) {
    const offset = frame - event.startFrame;
    const t = offset / rate;
    const white = rng() * 2 - 1;
    low = (1 - highpassAlpha) * white + highpassAlpha * low;
    const hiss = white - low;
    let sample: number;
    if (name === "bd" || name === "tom") {
      const top = name === "bd" ? 160 : 210;
      const bottom = name === "bd" ? 48 : 90;
      const hz = (bottom + (top - bottom) * Math.exp(-t / .025)) * pitch * (0.85 + tone * .3);
      phase += 2 * Math.PI * hz / rate;
      sample = Math.sin(phase) * (1 - noiseMix * .1) + hiss * noiseMix * .22 * Math.exp(-t / .004);
    } else if (name === "sd" || name === "cp") {
      phase += 2 * Math.PI * bodyHz / rate;
      const burst = name === "cp" ?
        Math.exp(-Math.max(0, offset % cpSpacing) / (rate * .003)) * (offset < 3 * cpSpacing ? 1 : 0) : 1;
      sample = Math.sin(phase) * (.5 + tone * .2) + hiss * noiseMix * (1.1 + color * .4) * burst;
    } else if (name === "hh" || name === "oh") {
      sample = hiss * (.45 + noiseMix * .7) * (1 + .12 * Math.sin(2 * Math.PI * 8200 * t * pitch));
    } else {
      phase += 2 * Math.PI * bodyHz / rate;
      sample = Math.sin(phase) * (name === "rim" ? .65 : .8) +
        hiss * noiseMix * (name === "rim" ? .7 * Math.exp(-t / .003) : .25);
    }
    out[frame] = (out[frame] ?? 0) + sample * envelope * event.velocity;
    envelope *= decay;
  }
}

export const drumsVoice: VoiceSpec = {
  id: "drums", kind: "drums", monoDefault: false,
  params: {
    tone: { default: .5, min: 0, max: 1 },
    decayMs: { default: 180, min: 20, max: 1000 },
    noise: { default: .5, min: 0, max: 1 },
  },
  render(ctx, params) {
    const out = new Float32Array(ctx.frames);
    for (const event of ctx.events) {
      const name = drumName(ctx, event);
      const index = ((event.sample!.index % 4) + 4) % 4;
      const preset = PRESETS[name][index]!;
      renderDrum(out, ctx, event, name, preset,
        params["tone"] ?? .5, params["decayMs"] ?? 180, params["noise"] ?? .5, index);
    }
    return out;
  },
};
