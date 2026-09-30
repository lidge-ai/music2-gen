import type { ProjectIR, ProjectInstrument } from "../project/index.ts";
import { readUserManifest, type UserInstrumentKinds } from "../sampler/index.ts";
import { Music2Error } from "../shared/index.ts";
import { loadKitMidiMap } from "../render/kit.tool.ts";
import { kitMidiMap } from "../midi/gm.tool.ts";

/** Resolve imported identity from caller-supplied metadata; planners never read storage. */
export function exportInstrumentKind(instrument: ProjectInstrument, userInstruments: UserInstrumentKinds = {}): Exclude<ProjectInstrument["kind"], "user"> {
  if (instrument.kind !== "user") return instrument.kind;
  const kind = Object.hasOwn(userInstruments, instrument.id) ? userInstruments[instrument.id] : undefined;
  if (!kind) throw new Music2Error("E_CAPABILITY", `user instrument ${instrument.id} is not imported`);
  return kind;
}
export function validateExportUserInstruments(project: ProjectIR, userInstruments: UserInstrumentKinds = {}): void {
  for (const track of project.tracks) if (track.type !== "audio" && track.instrument.kind === "user") {
    if (exportInstrumentKind(track.instrument, userInstruments) === "sfz" && track.type !== "notes")
      throw new Music2Error("E_SCHEMA", `user SFZ ${track.instrument.id} requires notes track`);
  }
}

/** Async CLI boundary: resolve every user manifest and load mappings before any synchronous projection. */
export async function loadExportInstruments(project: ProjectIR, songPath: string, includeKitMaps = true, validateSamples = true): Promise<{
  userInstruments: UserInstrumentKinds; kitMaps: Record<string, Record<string, number>>; warnings: string[];
}> {
  const userInstruments: Record<string, "sfz" | "kit"> = Object.create(null) as Record<string, "sfz" | "kit">;
  const userRoots = new Map<string, string>();
  for (const track of project.tracks) if (track.type !== "audio" && track.instrument.kind === "user" &&
    !userRoots.has(track.instrument.id)) {
    const { root, manifest } = await readUserManifest(track.instrument.id);
    userInstruments[track.instrument.id] = manifest.kind;
    userRoots.set(track.instrument.id, root);
  }
  validateExportUserInstruments(project, userInstruments);
  const kitMaps: Record<string, Record<string, number>> = {};
  const warnings: string[] = [];
  if (includeKitMaps) for (const track of project.tracks) {
    if (track.type === "audio") continue;
    const instrument = track.instrument;
    if (instrument.kind !== "kit" && !(instrument.kind === "user" && userInstruments[instrument.id] === "kit")) continue;
    const metadata = instrument.kind === "user" ?
      await loadKitMidiMap(songPath, `user:${instrument.id}`, userRoots.get(instrument.id)) :
      await loadKitMidiMap(songPath, `kit:${instrument.ref}`);
    const { names, explicit } = metadata;
    const declared = new Set(names);
    if (validateSamples) for (const note of track.notes) if (note.sample && !declared.has(note.sample.name))
      throw new Music2Error("E_SCHEMA", `kit ${track.id} is missing sample ${note.sample.name}`);
    const mapping = kitMidiMap(names, explicit);
    kitMaps[track.id] = mapping.byName;
    warnings.push(...mapping.warnings.map((warning) => `${warning}:${track.id}`));
  }
  return { userInstruments, kitMaps, warnings };
}
