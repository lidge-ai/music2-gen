import { fnv1a32, mulberry32, Music2Error } from "../../shared/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { polyBlepSquare } from "./osc.tool.ts";

type DrumName = "bd" | "sd" | "cp" | "hh" | "oh" | "rim" | "perc" | "tom";
type Kit = 1 | 2 | 3;

const NAMES = new Set<DrumName>(["bd", "sd", "cp", "hh", "oh", "rim", "perc", "tom"]);
const HAT_HZ = [205.3, 304.4, 369.6, 522.7, 540, 800] as const;
const VARIANT_PITCH = [1, .9, 1.1, .96] as const;
const VARIANT_LENGTH = [1, .8, 1.18, 1.38] as const;
const VARIANT_COLOR = [1, 1.18, 1.32, .78] as const;
const T60_EXPONENT = Math.log(1000);

function nameFor(ctx: VoiceContext, event: VoiceEvent): DrumName {
  const name = event.sample?.name;
  if (NAMES.has(name as DrumName)) return name as DrumName;
  throw new Music2Error("E_SCHEMA", `unknown drum sample ${String(name)} on track ${ctx.track.id}`, {
    details: { issues: [{ path: `tracks.${ctx.track.id}.pattern`, message: `unknown drum sample ${String(name)}` }] },
  });
}

function t60For(name: DrumName, kit: Kit): number {
  if (name === "bd") return kit === 1 ? .7 : kit === 2 ? .85 : .48;
  if (name === "sd") return kit === 3 ? .32 : .23;
  if (name === "cp") return .16;
  if (name === "hh") return kit === 2 ? .05 : kit === 3 ? .12 : .075;
  if (name === "oh") return kit === 2 ? .45 : kit === 3 ? .75 : .36;
  if (name === "rim") return .12;
  if (name === "perc") return .28;
  return kit === 3 ? .55 : .35;
}

function openHatChoke(ctx: VoiceContext, event: VoiceEvent): number {
  let next = ctx.frames;
  for (const other of ctx.events) {
    if (other.startFrame > event.startFrame && other.startFrame < next && other.sample?.name === "hh") {
      next = other.startFrame;
    }
  }
  return next;
}

/** Render one proposed synthetic hit. tone tunes/brightens; decayMs scales T60; noise sets transient/noise balance. */
function renderHit(out: Float32Array, ctx: VoiceContext, event: VoiceEvent, name: DrumName,
  kit: Kit, params: Readonly<Record<string, number>>): void {
  const rate = ctx.sampleRate;
  const index = ((event.sample!.index % 4) + 4) % 4;
  const tone = params["tone"] ?? .5;
  const noise = params["noise"] ?? .5;
  const pitch = VARIANT_PITCH[index]! * (.85 + .3 * tone);
  const color = VARIANT_COLOR[index]! * (.75 + .5 * tone);
  const duration = t60For(name, kit) * VARIANT_LENGTH[index]! *
    Math.max(.35, Math.min(2.5, Math.sqrt((params["decayMs"] ?? 180) / 180)));
  const maximum = Math.min(ctx.frames, event.stopFrame,
    event.startFrame + Math.ceil(rate * duration * 1.7));
  const start = Math.max(0, event.startFrame);
  if (maximum <= start) return;
  const random = mulberry32(fnv1a32(event.seed, name, index, kit));
  const envelopeStep = Math.exp(-T60_EXPONENT / (duration * rate));
  let envelope = Math.exp(-T60_EXPONENT * (start - event.startFrame) / (duration * rate));
  const snareNoiseDuration = duration * (kit === 3 ? .75 : .6);
  const snareNoiseStep = Math.exp(-T60_EXPONENT / (snareNoiseDuration * rate));
  let snareNoiseEnvelope = Math.exp(-T60_EXPONENT * (start - event.startFrame) /
    (snareNoiseDuration * rate));
  const hpCoefficient = Math.exp(-2 * Math.PI * (name === "sd" ? 1800 : 2800) * color / rate);
  const hatHpCoefficient = Math.exp(-2 * Math.PI * 3000 * color / rate);
  const hatLpCoefficient = Math.exp(-2 * Math.PI * Math.min(10000 * color, .4 * rate) / rate);
  const hatSteps = HAT_HZ.map((hz) => hz * pitch / rate);
  const hatPhases = new Float64Array(HAT_HZ.length);
  const chokeFrame = kit === 2 && name === "oh" ? openHatChoke(ctx, event) : ctx.frames;
  const chokeStep = Math.exp(-T60_EXPONENT / (.02 * rate));
  let chokeGain = 1;
  let phase = 0;
  let secondPhase = 0;
  let thirdPhase = 0;
  let pitchEnvelope = 1;
  const pitchStep = Math.exp(-1 / (rate * (kit === 1 ? .03 : kit === 2 ? .045 : .065)));
  let highpassLow = 0;
  let hatHighpassLow = 0;
  let hatLowpass = 0;
  const clapSpacing = Math.round(.012 * rate);

  for (let frame = start; frame < maximum; frame++) {
    const age = frame - event.startFrame;
    const white = random() * 2 - 1;
    highpassLow += (1 - hpCoefficient) * (white - highpassLow);
    const hiss = white - highpassLow;
    let sample = 0;
    let separateNoise = 0;
    if (name === "bd" || name === "tom") {
      const bottom = name === "bd" ? kit === 1 ? 50 : kit === 2 ? 53 : 62 :
        kit === 3 ? 112 : 95;
      const sweep = name === "bd" ? kit === 1 ? 150 : kit === 2 ? 52 : 52 : 55;
      phase += 2 * Math.PI * (bottom + sweep * pitchEnvelope) * pitch / rate;
      sample = .76 * Math.sin(phase);
      if (kit === 3) {
        secondPhase += 2 * Math.PI * (bottom * 1.59 + sweep * .28 * pitchEnvelope) * pitch / rate;
        thirdPhase += 2 * Math.PI * bottom * 2.37 * pitch / rate;
        sample += .13 * Math.sin(secondPhase) + .07 * Math.sin(thirdPhase);
      }
      sample += hiss * noise * .22 * Math.exp(-age / (rate * .003));
    } else if (name === "sd" || name === "cp") {
      const drop = 1 + .055 * pitchEnvelope;
      phase += 2 * Math.PI * 180 * pitch * drop / rate;
      secondPhase += 2 * Math.PI * (kit === 3 ? 314 : 330) * pitch * drop / rate;
      const burst = name === "cp" ? (age < 3 * clapSpacing ?
        Math.exp(-(age % clapSpacing) / (rate * .003)) : 0) : 1;
      sample = .21 * Math.sin(phase) + .15 * Math.sin(secondPhase);
      separateNoise = hiss * (.3 + .55 * noise) * snareNoiseEnvelope * burst;
    } else if (name === "hh" || name === "oh") {
      if (kit === 2) {
        let metallic = 0;
        for (let i = 0; i < hatPhases.length; i++) {
          const oscillatorPhase = hatPhases[i]!;
          const step = hatSteps[i]!;
          metallic += polyBlepSquare(oscillatorPhase, step);
          let next = oscillatorPhase + step;
          if (next >= 1) next -= 1;
          hatPhases[i] = next;
        }
        metallic /= hatPhases.length;
        hatHighpassLow += (1 - hatHpCoefficient) * (metallic - hatHighpassLow);
        hatLowpass += (1 - hatLpCoefficient) * ((metallic - hatHighpassLow) - hatLowpass);
        sample = hatLowpass * 2.2 + hiss * noise * .14;
      } else {
        secondPhase += 2 * Math.PI * (kit === 3 ? 4311 : 5720) * pitch / rate;
        sample = hiss * (.35 + noise * .5) + .13 * Math.sin(secondPhase);
        if (kit === 3) {
          thirdPhase += 2 * Math.PI * 6817 * pitch / rate;
          sample += .09 * Math.sin(thirdPhase);
        }
      }
      if (frame >= chokeFrame) chokeGain *= chokeStep;
      sample *= chokeGain;
    } else {
      const fundamental = name === "rim" ? 810 : 340;
      phase += 2 * Math.PI * fundamental * pitch / rate;
      secondPhase += 2 * Math.PI * fundamental * (kit === 3 ? 1.67 : 1.43) * pitch / rate;
      sample = .46 * Math.sin(phase) + .21 * Math.sin(secondPhase) +
        hiss * noise * (name === "rim" ? .22 : .16) * Math.exp(-age / (rate * .015));
    }
    out[frame] = (out[frame] ?? 0) + (sample * envelope + separateNoise) * event.velocity;
    envelope *= envelopeStep;
    snareNoiseEnvelope *= snareNoiseStep;
    pitchEnvelope *= pitchStep;
  }
}

function renderAnalog(ctx: VoiceContext, params: Readonly<Record<string, number>>, kit: Kit): Float32Array {
  const out = new Float32Array(ctx.frames);
  for (const event of ctx.events) renderHit(out, ctx, event, nameFor(ctx, event), kit, params);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]!));
  return out;
}

/** Whole-kit 11-kHz hold and 8-bit quantization. Filtering precedes reduction to soften aliasing. */
function crush(source: Float32Array, rate: number): Float32Array {
  const out = new Float32Array(source.length);
  const reductionRate = 11025;
  const lowpassCoefficient = Math.exp(-2 * Math.PI * 4000 / rate);
  const levels = 127;
  let filtered = 0;
  let filteredAgain = 0;
  let held = 0;
  let position = 0;
  for (let frame = 0; frame < source.length; frame++) {
    filtered += (1 - lowpassCoefficient) * (source[frame]! - filtered);
    filteredAgain += (1 - lowpassCoefficient) * (filtered - filteredAgain);
    if (frame === 0 || position >= rate) {
      held = Math.round(filteredAgain * levels) / levels;
      position -= rate;
    }
    out[frame] = held;
    position += reductionRate;
  }
  return out;
}

export function renderDrumKit(ctx: VoiceContext, params: Readonly<Record<string, number>>): Float32Array {
  const kit = params["kit"] ?? 0;
  if (kit === 4) return crush(renderAnalog(ctx, params, 1), ctx.sampleRate);
  return renderAnalog(ctx, params, kit as Kit);
}
