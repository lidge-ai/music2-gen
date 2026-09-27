/** Public library API of music2-gen (devlog 010 "src/index.ts"). */
export { EXIT, ERROR_CODES, Music2Error, exitFor, isMusic2Error, Fraction } from "./shared/index.ts";
export type { ErrorCode, ExitCode, Music2ErrorOptions } from "./shared/index.ts";
export { parseMini, queryArc, onsets, noteToMidi, midiToName, parseSampleRef } from "./pattern/index.ts";
export type { Atom, Node, Span, Hap, QueryCtx } from "./pattern/index.ts";
export { SONG_JSON_SCHEMA, validateSong, loadSong, arrange, buildTimeline } from "./song/index.ts";
export type { Song, Track, Section, ResolvedSong, ResolvedTrack, ResolvedSection, Placement, TimedEvent, Timeline } from "./song/index.ts";
export { createStereo, peakLinear, truePeakLinear, readWav, writeWav } from "./audio-io/index.ts";
export type { StereoBuffer, WavInfo, WavWriteOptions } from "./audio-io/index.ts";
export { renderSong, VOICES } from "./render/index.ts";
export type { RenderOptions, RenderResult, RenderStem, KitManifest } from "./render/index.ts";
export { discoverFfmpeg, encodeAudio, loudnormWav } from "./probe/index.ts";
export type { FfmpegInfo, DoctorData } from "./probe/index.ts";
