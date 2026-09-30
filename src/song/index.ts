export { SONG_JSON_SCHEMA, USE_CASE_IDS, validateSong } from "./song.schema.ts";
export type { Song, Track, Section, ResolvedSong, ResolvedTrack, ResolvedSection, UseCaseId } from "./song.schema.ts";
export { arrange } from "./arrange.tool.ts";
export type { Placement } from "./arrange.tool.ts";
export { buildTimeline } from "./timeline.tool.ts";
export type { TimedEvent, Timeline } from "./timeline.tool.ts";
export { parseTarget, resolveLanes, validateDawFields, resolveDawTrack, resolveAudioTracks } from "./song-daw.schema.ts";
export type { NoteInput, ResolvedNote, PointInput, LaneInput, ResolvedPoint, ResolvedLane, AutomationTarget,
  StretchInput, ResolvedStretch, ClipInput, ResolvedClip, AudioTrackInput, ResolvedAudioTrack } from "./song-daw.schema.ts";
export type { ResolvedInsert } from "../render/fx/fx.schema.ts";
export { appendListEvents } from "./timeline-notes.tool.ts";
export { loadSong } from "./load.tool.ts";
export { jsonErrorLocation, jsonErrorOffset } from "./json-location.tool.ts";
export { checkLayers, resolveLayers, LAYER_JSON_SCHEMA, MAX_LAYERS, MAX_LAYER_INSERTS } from "./song-layers.schema.ts";
export type { Layer, ResolvedLayer } from "./song-layers.schema.ts";
