export interface FfmpegInfo {
  path: string;
  version: string;
  encoders: { libmp3lame: boolean; libvorbis: boolean };
}

export interface DoctorData { ffmpeg: FfmpegInfo | null; required: boolean; ready: boolean }
export interface EncodeOptions { format: "mp3" | "ogg"; bitrateKbps?: number }
export interface LoudnormOptions { targetLufs: number; ceilingDb: number }
