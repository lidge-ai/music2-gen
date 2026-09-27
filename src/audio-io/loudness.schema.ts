/** BS.1770 / EBU R128 measurement result (devlog 030); produced by loudness.tool.ts, consumed by render and analyze. */
export interface LoudnessMetrics {
  integratedLufs: number | null; lraLu: number | null; lraProvisional: boolean;
  samplePeakDbfs: number | null; truePeakEstimateDbtp: number | null;
  truePeakOversample: 4;
}
