import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createStereo, readWav, writeWav } from "../audio-io/index.ts";
import { main } from "../cli/main.ts";
import { buildProject } from "../project/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import { projectToSmf, readSmf } from "../midi/index.ts";
import { planAls, planDawproject } from "./index.ts";
import { loadExportInstruments } from "./user-instruments.tool.ts";

const source = (instrument: string, kind: "notes" | "drums" = "drums") => ({ version: 1, bpm: 120, tailSeconds: 0,
  tracks: [{ id: "sample", kind, instrument, notes: [{ start: 0, length: .25,
    ...(kind === "notes" ? { pitch: 69 } : { sample: "bd" }) }] }],
  sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
const project = (instrument: string, kind: "notes" | "drums" = "drums") => {
  const song = validateSong(source(instrument, kind));
  return buildProject(song, buildTimeline(song));
};

async function setup(t: TestContext): Promise<{ dir: string; root: string }> {
  const dir = await mkdtemp(join(tmpdir(), "music2-user-export-"));
  const home = join(dir, "home");
  const previous = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = home;
  t.after(async () => {
    if (previous === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = previous;
    await rm(dir, { recursive: true, force: true });
  });
  const root = join(home, "instruments", "synthetic");
  await mkdir(root, { recursive: true });
  const audio = createStereo(44100, 4410);
  for (let i = 0; i < audio.left.length; i++) audio.left[i] = audio.right[i] = .4 * Math.sin(2 * Math.PI * 440 * i / 44100);
  await writeWav(join(root, "tone.wav"), audio, { bits: 24, seed: 1 });
  await writeFile(join(root, "kit.json"), JSON.stringify({ version: 1, rootMidi: 69, samples: { bd: ["tone.wav"] }, midi: { bd: 47 } }));
  await writeFile(join(root, "instrument.json"), JSON.stringify({ version: 1, id: "synthetic", kind: "kit", entry: "kit.json",
    source: { folder: "synthetic" }, warnings: [] }));
  return { dir, root };
}
async function invoke(argv: string[], cwd: string) {
  let stdout = ""; let stderr = "";
  const exit = await main(argv, { cwd,
    stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream,
    stderr: { write(chunk: string) { stderr += chunk; return true; } } as NodeJS.WritableStream });
  assert.equal(stdout.trim().split("\n").length, 1);
  assert.equal(stderr, "");
  return { exit, result: JSON.parse(stdout) as { warnings: string[]; error?: { code: string }; data: Record<string, unknown> } };
}

test("synchronous projections require metadata, preserve kit mapping and name user portability warnings", () => {
  const ir = project("user:synthetic");
  const kitMaps = { sample: { bd: 47 } };
  const userInstruments = { synthetic: "kit" as const };
  for (const run of [() => projectToSmf(ir), () => planAls(ir, null, { content: "midi", bits: 24 }),
    () => planDawproject(ir, [], [], { content: "midi", outputName: "one.dawproject" })])
    assert.throws(run, { code: "E_CAPABILITY", message: "user instrument synthetic is not imported" });
  const midi = projectToSmf(ir, { kitMaps, userInstruments });
  assert.deepEqual(midi.file.tracks[1]!.events.flatMap((event) => event.kind === "noteOn" ? [event.key] : []), [47]);
  assert.equal(midi.channels.sample, 10);
  assert.ok(midi.warnings.includes("MIDI_SOUND_NOT_PORTABLE:sample:user:synthetic"));
  const als = planAls(ir, null, { content: "midi", bits: 24, kitMaps, userInstruments });
  assert.ok(als.warnings.includes("ALS_SOUND_NOT_PORTABLE:sample:user:synthetic"));
  assert.match(gunzipSync((als.files[0] as { bytes: Uint8Array }).bytes).toString(), /MidiKey Value="47"/);
  const daw = planDawproject(ir, [], [], { content: "midi", outputName: "one.dawproject", kitMaps, userInstruments });
  assert.ok(daw.warnings.includes("NOTE_SOUND_NOT_PORTABLE:sample:user:synthetic"));
  assert.ok(Buffer.from((daw.files[0] as { bytes: Uint8Array }).bytes).includes(Buffer.from('key="47"')));
  const sfz = project("user:synthetic", "notes");
  assert.equal(projectToSmf(sfz, { userInstruments: { synthetic: "sfz" } }).channels.sample, 1);
  for (const run of [() => projectToSmf(ir, { userInstruments: { synthetic: "sfz" } }),
    () => planAls(ir, null, { content: "midi", bits: 24, userInstruments: { synthetic: "sfz" } }),
    () => planDawproject(ir, [], [], { content: "midi", outputName: "one.dawproject", userInstruments: { synthetic: "sfz" } })])
    assert.throws(run, { code: "E_SCHEMA" });
});

test("export CLI resolves user kit metadata for MIDI, ALS, DAWproject and pitched notes", async (t) => {
  const { dir } = await setup(t);
  for (const kind of ["drums", "notes"] as const) {
    await writeFile(join(dir, "song.json"), JSON.stringify(source("user:synthetic", kind)));
    const midi = await invoke(["export", "midi", "song.json", "-o", `${kind}.mid`, "--json"], dir);
    assert.equal(midi.exit, 0);
    assert.deepEqual(midi.result.data["channels"], { sample: 10 });
    const smf = readSmf(await readFile(join(dir, `${kind}.mid`)));
    assert.deepEqual(smf.tracks[1]!.events.flatMap((event) => event.kind === "noteOn" ? [event.key] : []), [kind === "drums" ? 47 : 69]);
    assert.ok(midi.result.warnings.includes("MIDI_SOUND_NOT_PORTABLE:sample:user:synthetic"));
    for (const format of ["als", "dawproject"] as const) {
      const out = format === "als" ? `${kind}-als` : `${kind}.dawproject`;
      const result = await invoke(["export", format, "song.json", "-o", out, "--content", "midi", "--json"], dir);
      assert.equal(result.exit, 0, JSON.stringify(result.result));
      assert.ok(result.result.warnings.some((warning) => warning.includes("user:synthetic")));
      const bytes = await readFile(format === "als" ? join(dir, out, "untitled.als") : join(dir, out));
      const text = format === "als" ? gunzipSync(bytes).toString() : bytes.toString();
      assert.match(text, format === "als" ? new RegExp(`MidiKey Value="${kind === "drums" ? 47 : 69}"`) :
        new RegExp(`key="${kind === "drums" ? 47 : 69}"`));
    }
  }
});

test("user SFZ export validates kind; missing and escaping imports preserve error codes", async (t) => {
  const { dir, root } = await setup(t);
  await writeFile(join(root, "tone.sfz"), "<region> sample=tone.wav key=69\n");
  await writeFile(join(root, "instrument.json"), JSON.stringify({ version: 1, id: "synthetic", kind: "sfz", entry: "tone.sfz",
    source: { folder: "synthetic" }, warnings: [] }));
  for (const [id, kind, code] of [["missing", "notes", "E_CAPABILITY"], ["synthetic", "drums", "E_SCHEMA"]] as const) {
    await writeFile(join(dir, "song.json"), JSON.stringify(source(`user:${id}`, kind)));
    const result = await invoke(["export", "midi", "song.json", "-o", "error.mid", "--json"], dir);
    assert.equal(result.result.error?.code, code);
    assert.equal(result.exit, code === "E_SCHEMA" ? 2 : 3);
  }
  await writeFile(join(dir, "song.json"), JSON.stringify(source("user:synthetic", "notes")));
  const sfz = await invoke(["export", "midi", "song.json", "-o", "sfz.mid", "--json"], dir);
  assert.equal(sfz.exit, 0);
  assert.deepEqual(sfz.result.data["channels"], { sample: 1 });
  const outside = join(dir, "outside");
  await mkdir(outside);
  await symlink(outside, join(process.env["MUSIC2_HOME"]!, "instruments", "escape"), "dir");
  await assert.rejects(loadExportInstruments(project("user:escape"), join(dir, "song.json")), { code: "E_ACCESS" });
});


test("both DAW exports retain imported sound as frozen audio", async (t) => {
  const { dir } = await setup(t);
  await writeFile(join(dir, "song.json"), JSON.stringify(source("user:synthetic", "notes")));
  const als = await invoke(["export", "als", "song.json", "-o", "frozen", "--content", "both", "--json"], dir);
  assert.equal(als.exit, 0, JSON.stringify(als.result));
  const samples = als.result.data["samples"] as string[];
  assert.equal(samples.length, 1);
  assert.ok((await readWav(samples[0]!)).left.some((value) => Math.abs(value) > .01));
  assert.ok(als.result.warnings.includes("ALS_SOUND_NOT_PORTABLE:sample:user:synthetic"));
  const daw = await invoke(["export", "dawproject", "song.json", "-o", "frozen.dawproject", "--content", "both", "--json"], dir);
  assert.equal(daw.exit, 0, JSON.stringify(daw.result));
  assert.ok((daw.result.data["entries"] as string[]).includes("audio/stem-sample.wav"));
  assert.ok(daw.result.warnings.includes("NOTE_SOUND_NOT_PORTABLE:sample:user:synthetic"));
});
