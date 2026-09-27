export interface StereoBuffer {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  sourceChannels: 1 | 2;
}

export interface WavInfo {
  sampleRate: number;
  channels: 1 | 2;
  frames: number;
  bitsPerSample: 16 | 24 | 32;
  format: "pcm" | "float";
}

export interface WavWriteOptions { bits: 16 | 24; seed: number }
