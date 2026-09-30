/** Public library API of music2-gen (devlog 010 "src/index.ts"). */
export { EXIT, ERROR_CODES, Music2Error, exitFor, isMusic2Error, Fraction } from "./shared/index.ts";
export type { ErrorCode, ExitCode, Music2ErrorOptions } from "./shared/index.ts";
export { parseMini, queryArc, onsets, noteToMidi, midiToName, parseSampleRef } from "./pattern/index.ts";
export type { Atom, Node, Span, Hap, QueryCtx } from "./pattern/index.ts";
export { SONG_JSON_SCHEMA, validateSong, loadSong, arrange, buildTimeline } from "./song/index.ts";
export type { Song, Track, Section, ResolvedSong, ResolvedTrack, ResolvedSection, Placement, TimedEvent, Timeline, Layer, ResolvedLayer } from "./song/index.ts";
export { buildProject } from "./project/index.ts";
export type { ProjectIR, ProjectMarker, ProjectBus, ProjectTrackBase, ProjectInstrument,
  ProjectNoteTrack, ProjectAudioTrack, ProjectTrack, ProjectNote, ProjectClip, ProjectSample } from "./project/index.ts";
export { writeSmf, readSmf, projectToSmf, smfToSong, GM_PROGRAMS, DRUM_NOTES, SFX_NOTES,
  programForInstrument, instrumentForProgram, drumNoteFor, drumNameFor, sfxNoteFor, sfxNameFor,
  kitMidiMap, keyToSmf, smfToKey } from "./midi/index.ts";
export type { SmfFile, SmfTrack, SmfEvent, SmfChannelEvent, MidiProjection, ImportedSong, MidiImport } from "./midi/index.ts";
export { createStereo, peakLinear, truePeakLinear, readWav, writeWav } from "./audio-io/index.ts";
export type { StereoBuffer, WavInfo, WavWriteOptions } from "./audio-io/index.ts";
export { renderSong, VOICES } from "./render/index.ts";
export type { RenderOptions, RenderResult, RenderStem, KitManifest, LayerTap } from "./render/index.ts";
export { discoverFfmpeg, encodeAudio, loudnormWav } from "./probe/index.ts";
export type { FfmpegInfo, DoctorData } from "./probe/index.ts";
export { RECIPE_IDS, listRecipes, getRecipe, newSong, lintSong } from "./recipes/index.ts";
export type { RecipeCard, RecipeRole, RecipePaletteEntry, RecipeProgression, RecipeArrangementBlock, RecipeArrangement, RecipeMixTargets, NewSongOptions, LintOptions, LintResult, LintReport } from "./recipes/index.ts";
export { USE_CASE_IDS, USE_CASES, isUseCaseId, recommendedArrangement, applyUseCase } from "./usecases/index.ts";
export type { UseCaseId, UseCasePreset } from "./usecases/index.ts";
export { critique } from "./critic/index.ts";
export type { CritiqueOptions, CriticReview, CritiqueReport } from "./critic/index.ts";
export { analyzeAudio, analyzeFile } from "./analyze/index.ts";
export type { AnalysisJson, AnalysisArtifacts, BeatMap, FlowAnalysis } from "./analyze/index.ts";

export { parseTarget, gatedLevel, resolveWindow, measureSong, planChanges, applyChanges, balanceSong } from "./balance/index.ts";
export type { BalanceTarget, BalanceWindow, BalanceRow, BalanceChange, BalanceReport, BalanceOptions } from "./balance/index.ts";
