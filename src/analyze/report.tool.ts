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
    "## Flow",
    `Axis: ${a.flow.axisKind}${a.flow.axisKind === "bars" ? " (declared song timeline)" : a.flow.axisKind === "beats" ? " (measured audio beats)" : " (fixed audio frames)"}`,
    "| Interval | Start (s) | End (s) | Ungated LUFS | Onsets | Onsets/s | Centroid (Hz) |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...a.flow.intervals.map((row) => `| ${row.barNumber === null ? row.beatNumber === null ? row.index + 1 : `beat ${row.beatNumber}` : `bar ${row.barNumber}`} | ${number(row.startSeconds)} | ${number(row.endSeconds)} | ${number(row.lufs)} | ${row.onsetCount} | ${number(row.onsetsPerSecond)} | ${number(row.centroidHz, 0)} |`),
    "",
    `Short-term LUFS (1 Hz): ${a.flow.shortTermLufs1Hz.length ? a.flow.shortTermLufs1Hz.map((point) => `${number(point.timeSeconds, 0)}s ${number(point.lufs)}`).join(", ") : "n/a"}`,
    "Section deltas:",
    ...(a.flow.sectionDeltas.length ? a.flow.sectionDeltas.map((delta) => `- ${delta.fromId} → ${delta.toId} at ${number(delta.atSeconds)}s: ${delta.deltaLu !== null && delta.deltaLu > 0 ? "+" : ""}${number(delta.deltaLu)} LU`) : ["- n/a"]),
    "Novelty peaks:",
    ...(a.flow.noveltyPeaks.length ? a.flow.noveltyPeaks.map((peak) => `- ${peak.atBar === null ? `${number(peak.atSeconds)}s` : `B${String(peak.atBar).padStart(2, "0")}`}: ${number(peak.score)}${peak.declaredHit === null ? "" : peak.declaredHit ? " matched" : " missed"}`) : ["- n/a"]),
    "Repeats:",
    ...(a.flow.repeats.length ? a.flow.repeats.map((repeat) => `- ${repeat.firstStartBar === null ? `${number(repeat.firstStartSeconds)}–${number(repeat.firstEndSeconds)}s` : `bars ${repeat.firstStartBar}–${repeat.firstEndBar}`} repeat ${repeat.secondStartBar === null ? `${number(repeat.secondStartSeconds)}–${number(repeat.secondEndSeconds)}s` : `bars ${repeat.secondStartBar}–${repeat.secondEndBar}`}; similarity ${number(repeat.meanSimilarity)}`) : ["- n/a"]),
    "Verdicts:",
    ...a.flow.verdicts.map((verdict) => `- ${verdict}`),
    "Annotations:",
    ...a.flow.annotations.map((annotation) => `- ${annotation}`),
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
  lines.push("## Images", "- spectrogram.png", "- overview.png", ...(a.sections.length ? ["- pianoroll.png"] : []), "",
    "Audio estimates are provisional; song labels reflect the supplied timeline.", "");
  return lines.join("\n");
}
