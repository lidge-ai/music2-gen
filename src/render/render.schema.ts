import type { ResolvedTrack } from "../song/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";

export interface RenderOptions { bars?: { start: number; end: number }; stems?: boolean; mastering?: "peak" | "loudnorm" }
export interface RenderStem { trackId: string; audio: StereoBuffer }
export interface RenderResult { audio: StereoBuffer; stems: RenderStem[]; bars: number; durationSeconds: number; peakDbfs: number; truePeakDbtp: number; ceilingDb: number; events: number }
export interface VoiceEvent { midi: number | null; sample: { name: string; index: number } | null; velocity: number; startFrame: number; gateFrames: number; stopFrame: number; eventIndex: number; seed: number }
export interface VoiceContext { sampleRate: number; frames: number; track: ResolvedTrack; events: VoiceEvent[] }
export interface ParamSpec { default: number; min: number; max: number; integer?: boolean }
export interface VoiceSpec { id: string; kind: "drums" | "notes"; monoDefault: boolean; params: Readonly<Record<string, ParamSpec>>; render(ctx: VoiceContext, params: Readonly<Record<string, number>>): Float32Array }
export interface KitManifest { version: 1; samples: Record<string, string[]>; gainDb?: number; rootMidi?: number }
export interface LoadedKit { manifest: KitManifest; samples: Readonly<Record<string, Float32Array[]>>; sampleRate: number }

export interface DrumsParams { tone: number; decayMs: number; noise: number }
export interface EightOhEightParams { drive: number; decayMs: number; attackMs: number }
export interface BassParams { wave: number; cutoffHz: number; resonance: number; releaseMs: number }
export interface BellParams { ratio: number; index: number; decayMs: number }
export interface KeysParams { ratio: number; index: number; attackMs: number; releaseMs: number }
export interface PluckParams { damping: number; decayMs: number; brightness: number }
export interface PadParams { detuneCents: number; cutoffHz: number; attackMs: number; releaseMs: number }
export interface LeadParams { wave: number; vibratoHz: number; vibratoCents: number; releaseMs: number }

export interface RenderData { wav: string; mp3?: string; ogg?: string; stems?: string[]; bars: number; sampleRate: number; frames: number; durationSeconds: number; peakDbfs: number | null; truePeakDbtp: number | null; ceilingDb: number; events: number }
