import type { AnalysisJson, BeatMap } from "./analysis.schema.ts";

const number = (value: number | null, digits = 2): string => value === null ? "n/a" : value.toFixed(digits);

/** Stable text rendering of the same numeric facts written to analysis.json. */
export function renderAnalysisReport(a: AnalysisJson, beatMap?: BeatMap): string {
  const lines = [
    "# Music analysis",
    "",
    `Source: ${a.source} · Duration: ${number(a.durationSeconds)} s · Tail: ${number(a.tailSeconds)} s`,
    `BPM: declared ${number(a.declaredBpm)} · estimated ${number(a.estimatedBpm)} · confidence ${number(a.tempoConfidence)}`,
    `Alternatives: ${a.tempoCandidates.slice(1, 4).map((candidate) => `${number(candidate.bpm)} (${number(candidate.score)})`).join(", ") || "n/a"}`,
    `Key: declared ${a.declaredKey ?? "n/a"} · estimated ${a.estimatedKey ?? "n/a"} · confidence ${number(a.keyConfidence)}`,
    `Top keys: ${a.keyCandidates.map((candidate) => `${candidate.key} (KK ${number(candidate.kkScore)}, Temperley ${number(candidate.temperleyScore)})`).join(", ") || "n/a"}`,
    `Integrated LUFS: ${number(a.integratedLufs)} · LRA: ${number(a.lraLu)}${a.lraProvisional ? " provisional" : ""} · True peak estimate: ${number(a.truePeakEstimateDbtp)} dBTP · Sample peak: ${number(a.samplePeakDbfs)} dBFS`,
    `Beat map: ${beatMap ? `source: ${beatMap.source}, confidence ${number(beatMap.confidence)}` : "n/a"}`,
    "",
    "## Band balance",
    "| Band | Range (Hz) | Share | Relative dB |",
    "| --- | ---: | ---: | ---: |",
    ...a.bands.map((band) => `| ${band.name} | ${number(band.fromHz, 0)}–${number(band.toHz, 0)} | ${number(band.share * 100)}% | ${number(band.dbRelative)} |`),
    "",
    "## Warnings",
    ...(a.warnings.length ? a.warnings.map((warning) => `- ${warning.code}: ${warning.message} (observed ${number(warning.observed)}, threshold ${number(warning.threshold)})`) : ["- None"]),
    "",
  ];
  if (a.source === "wav" && a.sections.length === 0) lines.push("No song timeline supplied", "");
  else {
    lines.push("## Sections", "| Section | Role | Start (s) | End (s) | RMS (dBFS) | LUFS |",
      "| --- | --- | ---: | ---: | ---: | ---: |",
      ...a.sections.map((s) => `| ${s.id} | ${s.role ?? "n/a"} | ${number(s.startSeconds)} | ${number(s.endSeconds)} | ${number(s.rmsDbfs)} | ${number(s.integratedLufs)} |`),
      "", "## Tracks", "| Track | Kind | Events | Events/bar | Events/s |", "| --- | --- | ---: | ---: | ---: |",
      ...a.tracks.map((t) => `| ${t.id} | ${t.kind} | ${t.eventCount} | ${number(t.eventsPerBar)} | ${number(t.eventsPerSecond)} |`), "");
  }
  lines.push("## Images", "- spectrogram.png", ...(a.sections.length ? ["- pianoroll.png"] : []), "",
    "Audio estimates are provisional; song labels reflect the supplied timeline.", "");
  return lines.join("\n");
}
