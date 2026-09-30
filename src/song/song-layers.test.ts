import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { Music2Error } from "../shared/index.ts";
import { renderSong } from "../render/render.tool.ts";
import { checkLayers, MAX_LAYERS, MAX_LAYER_INSERTS, resolveLayers } from "./song-layers.schema.ts";
import { validateSong } from "./song.schema.ts";
import type { Layer } from "./song-layers.schema.ts";

function source(layers?: unknown, kind: "notes" | "drums" = "notes", instrument = kind === "notes" ? "lead" : "drums") {
  return { version: 1, bpm: 120, tailSeconds: 0,
    tracks: [{ id: "track", kind, instrument, pattern: kind === "notes" ? "c4" : "bd sd",
      ...(layers === undefined ? {} : { layers }) }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] };
}
function schemaIssue(error: unknown, path: string): boolean {
  assert.ok(error instanceof Music2Error);
  assert.equal(error.code, "E_SCHEMA");
  const issues = error.details?.["issues"] as { path: string; message: string }[];
  assert.ok(issues.some((issue) => issue.path === path && issue.message.length > 0), JSON.stringify(issues));
  return true;
}
const layer = { id: "sub", instrument: "lead" };

test("valid layers resolve explicit params and independent insert defaults", () => {
  const input = [
    { ...layer, transpose: -12, gain: -4, params: { wave: 2 } },
    { id: "growl", instrument: "supersaw", transpose: 12, gain: -10,
      fx: [{ type: "drive", amount: 3 }, { type: "filter", mode: "highpass", cutoffHz: 300 }] },
  ];
  const song = validateSong(source(input));
  assert.deepEqual(song.tracks[0]!.layers?.[0], { ...input[0], pan: 0, velocity: 1, fx: [], only: null });
  assert.deepEqual(song.tracks[0]!.layers?.[1]?.params, {});
  assert.deepEqual(song.tracks[0]!.layers?.[1]?.fx[0], { type: "drive", amount: 3, toneHz: 8000, mix: 1 });
  assert.equal(song.tracks[0]!.layers?.[1]?.fx[1]?.type, "filter");
  const drums = validateSong(source([{ id: "sub", instrument: "drums", only: ["bd"], params: { kit: 1 }, gain: -6 }], "drums", "user:dsx-kit"));
  assert.deepEqual(drums.tracks[0]!.layers?.[0]?.only, ["bd"]);
  assert.deepEqual(drums.tracks[0]!.layers?.[0]?.params, { kit: 1 });
});

test("absent and empty layers preserve the exact legacy resolved JSON", () => {
  const absent = validateSong(source());
  const empty = validateSong(source([]));
  assert.equal(JSON.stringify(empty), JSON.stringify(absent));
  assert.equal(Object.hasOwn(absent.tracks[0]!, "layers"), false);
  assert.equal(Object.hasOwn(empty.tracks[0]!, "layers"), false);
  assert.deepEqual(absent.tracks[0], { id: "track", kind: "notes", instrument: "lead", pattern: "c4",
    velocity: 0.8, gain: 0, pan: 0, gate: 0.9, mono: false, glide: 0, transpose: 0, swing: false,
    sends: { reverb: 0, delay: 0 }, fx: [], duck: null, params: {} });
  assert.equal(resolveLayers({ id: "track", kind: "notes", instrument: "lead" }), undefined);
  assert.equal(resolveLayers({ id: "track", kind: "notes", instrument: "lead", layers: [] }), undefined);
});

for (const [name, layers, suffix] of [
  ["non-array", {}, ""], ["null array", null, ""], ["null layer", [null], "[0]"],
  ["missing id", [{ instrument: "lead" }], "[0].id"],
  ["missing instrument", [{ id: "sub" }], "[0].instrument"],
  ["bad id", [{ ...layer, id: "UPPER" }], "[0].id"],
  ["long id", [{ ...layer, id: "a".repeat(33) }], "[0].id"],
  ["reserved id", [{ ...layer, id: "main" }], "[0].id"],
  ["duplicate id", [layer, layer], "[1].id"],
  ["unknown property", [{ ...layer, mystery: 1 }], "[0].mystery"],
  ["inherited property", [{ ...layer, constructor: 1 }], "[0].constructor"],
  ["unknown instrument", [{ ...layer, instrument: "not-a-voice" }], "[0].instrument"],
  ["kind mismatch", [{ ...layer, instrument: "drums" }], "[0].instrument"],
  ["transpose fractional", [layer, { ...layer, id: "b", transpose: 1.5 }], "[1].transpose"],
  ["transpose low", [{ ...layer, transpose: -37 }], "[0].transpose"],
  ["transpose high", [{ ...layer, transpose: 37 }], "[0].transpose"],
  ["velocity low", [{ ...layer, velocity: -0.1 }], "[0].velocity"],
  ["velocity high", [{ ...layer, velocity: 2.1 }], "[0].velocity"],
  ["velocity nonfinite", [{ ...layer, velocity: Infinity }], "[0].velocity"],
  ["gain low", [{ ...layer, gain: -61 }], "[0].gain"],
  ["gain high", [{ ...layer, gain: 13 }], "[0].gain"],
  ["pan low", [{ ...layer, pan: -1.1 }], "[0].pan"],
  ["pan high", [{ ...layer, pan: 1.1 }], "[0].pan"],
  ["notes only", [{ ...layer, only: ["bd"] }], "[0].only"],
  ["params non-object", [{ ...layer, params: [] }], "[0].params"],
  ["unknown voice param", [{ ...layer, params: { kit: 1 } }], "[0].params.kit"],
  ["wrong param type", [{ ...layer, params: { wave: "2" } }], "[0].params.wave"],
  ["param nonfinite", [{ ...layer, params: { wave: NaN } }], "[0].params.wave"],
  ["param range", [{ ...layer, params: { wave: 3 } }], "[0].params.wave"],
  ["param integer", [{ ...layer, params: { wave: 0.5 } }], "[0].params.wave"],
  ["voice-specific param", [{ ...layer, instrument: "vibraphone", params: { tremoloHz: 1 } }], "[0].params.tremoloHz"],
  ["too many layers", Array.from({ length: MAX_LAYERS + 1 }, (_, i) => ({ ...layer, id: `l${i}` })), ""],
  ["too many inserts", [{ ...layer, fx: Array.from({ length: MAX_LAYER_INSERTS + 1 }, () => ({ type: "width" })) }], "[0].fx"],
  ["invalid SFZ reference", [{ ...layer, instrument: "sfz:../tone.sfz" }], "[0].instrument"],
  ["invalid library id", [{ ...layer, instrument: "lib:no-such-library" }], "[0].instrument"],
  ["invalid user id", [{ ...layer, instrument: "user:../escape" }], "[0].instrument"],
  ["empty kit ref", [{ ...layer, instrument: "kit:" }], "[0].instrument"],
] as const) {
  test(`layer schema rejects ${name} with an indexed E_SCHEMA issue`, () => {
    assert.throws(() => validateSong(source(layers)), (error: unknown) => schemaIssue(error, `$.tracks[0].layers${suffix}`));
  });
}

test("layer ids, scalar limits and maximum counts accept their inclusive boundaries", () => {
  const inputs = Array.from({ length: 8 }, (_, i) => ({ id: i === 0 ? "0" : i === 1 ? "a".repeat(32) : `l_${i}-x`,
    instrument: "lead", transpose: i % 2 ? 36 : -36, gain: i % 2 ? 12 : -60,
    pan: i % 2 ? 1 : -1, velocity: i % 2 ? 2 : 0,
    fx: Array.from({ length: 6 }, () => ({ type: "tapestop" })) }));
  assert.equal(validateSong(source(inputs)).tracks[0]!.layers?.length, 8);
  assert.equal(MAX_LAYERS, 8); assert.equal(MAX_LAYER_INSERTS, 6);
});

test("drum-only rules reject transpose, empty/long only lists and indexed sample references", () => {
  for (const [change, suffix] of [
    [{ transpose: 0 }, "transpose"], [{ only: [] }, "only"],
    [{ only: Array.from({ length: 17 }, () => "bd") }, "only"],
    [{ only: ["bd:1"] }, "only[0]"], [{ only: [3] }, "only[0]"],
    [{ instrument: "lead" }, "instrument"], [{ instrument: "sfz:tone.sfz" }, "instrument"],
    [{ instrument: "lib:grand-piano" }, "instrument"],
  ] as const) {
    assert.throws(() => validateSong(source([{ id: "d", instrument: "drums", ...change }], "drums")),
      (error: unknown) => schemaIssue(error, `$.tracks[0].layers[0].${suffix}`));
  }
});

test("sampled layers accept each reference family and reject even explicitly empty params", () => {
  for (const instrument of ["kit:kit", "sfz:tone.sfz", "lib:grand-piano", "user:custom-kit"]) {
    assert.equal(validateSong(source([{ ...layer, instrument }])).tracks[0]!.layers?.[0]?.instrument, instrument);
    assert.throws(() => validateSong(source([{ ...layer, instrument, params: {} }])),
      (error: unknown) => schemaIssue(error, "$.tracks[0].layers[0].params"));
    assert.throws(() => validateSong(source([{ ...layer, instrument, params: { wave: 0 } }])),
      (error: unknown) => schemaIssue(error, "$.tracks[0].layers[0].params.wave"));
  }
});

test("public checkLayers collects shape, id and kind issues without throwing", () => {
  const issues: { path: string; message: string }[] = [];
  checkLayers([{ id: "main", instrument: "lead", transpose: 0, extra: true }], "$.tracks[2].layers", "drums", issues);
  for (const field of ["id", "instrument", "transpose", "extra"])
    assert.ok(issues.some(({ path }) => path === `$.tracks[2].layers[0].${field}`));
});

test("layer transposes beyond MIDI range remain valid for renderer drop-and-warn", () => {
  const raw = source([{ ...layer, transpose: 36 }]);
  raw.tracks[0]!.pattern = "127";
  assert.doesNotThrow(() => validateSong(raw));
});

test("resolved layer arrays and params are independent of the raw source", () => {
  const raw: Layer[] = [{ id: "d", instrument: "drums", only: ["bd"], params: { kit: 1 } }];
  const resolved = validateSong(source(raw, "drums")).tracks[0]!.layers![0]!;
  raw[0]!.only!.push("sd"); raw[0]!.params!["kit"] = 0;
  assert.deepEqual(resolved.only, ["bd"]); assert.deepEqual(resolved.params, { kit: 1 });
});

test("render checks only names against the layer vocabulary even when unused in the pattern", async () => {
  const song = validateSong(source([{ id: "d", instrument: "drums", only: ["riser"] }], "drums"));
  await assert.rejects(renderSong(song, "fixture.song.json"),
    (error: unknown) => schemaIssue(error, "$.tracks[0].layers[0].only[0]"));
});

test("render checks all selected base and section atoms against each layer instrument", async () => {
  const song = validateSong(source([{ id: "effects", instrument: "sfx" }], "drums"));
  await assert.rejects(renderSong(song, "fixture.song.json"),
    (error: unknown) => schemaIssue(error, "$.tracks[0].layers[0].instrument"));
  const filtered = source([{ id: "effects", instrument: "sfx", only: ["impact"] }], "drums", "kit:missing");
  filtered.sections.push({ id: "unused", bars: 1 });
  Object.assign(filtered.sections[1]!, { patterns: { track: "bd [impact|sd]" } });
  // Unselected atoms are ignored, so validation reaches the separate main-kit access boundary.
  await assert.rejects(renderSong(validateSong(filtered), "fixture.song.json"),
    (error: unknown) => error instanceof Music2Error && error.code === "E_ACCESS");
  const rejected = source([{ id: "d", instrument: "drums" }], "drums");
  rejected.sections.push({ id: "unused", bars: 1 });
  Object.assign(rejected.sections[1]!, { patterns: { track: "[bd|riser]" } });
  // Make the main source a sampled kit so its built-in vocabulary does not consume the error first.
  rejected.tracks[0]!.instrument = "kit:missing";
  await assert.rejects(renderSong(validateSong(rejected), "fixture.song.json"),
    (error: unknown) => schemaIssue(error, "$.tracks[0].layers[0].instrument"));
});

test("render validates explicit drum note-list atoms against layers", async () => {
  const raw = source([{ id: "effects", instrument: "sfx" }], "drums");
  const song = validateSong({ ...raw, tracks: [{ id: "track", kind: "drums", instrument: "drums",
    notes: [{ start: 0, length: 1, sample: "bd" }], layers: raw.tracks[0]!.layers }] });
  await assert.rejects(renderSong(song, "fixture.song.json"),
    (error: unknown) => schemaIssue(error, "$.tracks[0].layers[0].instrument"));
});

test("sampled kit layer vocabularies validate only and selected atoms before audio decoding", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-layer-schema-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "kit"));
  await writeFile(join(dir, "kit", "kit.json"), JSON.stringify({ version: 1, samples: { bd: ["missing.wav"] } }));
  const song = validateSong(source([{ id: "kit", instrument: "kit:kit", only: ["sd"] }], "drums"));
  await assert.rejects(renderSong(song, join(dir, "song.json")),
    (error: unknown) => schemaIssue(error, "$.tracks[0].layers[0].only[0]"));
  song.tracks[0]!.layers![0]!.only = null;
  await assert.rejects(renderSong(song, join(dir, "song.json")),
    (error: unknown) => schemaIssue(error, "$.tracks[0].layers[0].instrument"));
});

test("only filters incompatible atoms before a valid layered render", async () => {
  const song = validateSong(source([{ id: "effects", instrument: "sfx", only: ["impact"] }], "drums"));
  const result = await renderSong(song, "fixture.song.json");
  assert.ok(result.audio.left.some((sample) => sample !== 0));
});

test("user layer manifest vocabulary and kind are validated before decoding", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "music2-layer-user-"));
  const previous = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = home;
  t.after(async () => {
    if (previous === undefined) delete process.env["MUSIC2_HOME"];
    else process.env["MUSIC2_HOME"] = previous;
    await rm(home, { recursive: true, force: true });
  });
  for (const kind of ["kit", "sfz"] as const) {
    const root = join(home, "instruments", `schema-${kind}`);
    await mkdir(root, { recursive: true });
    const entry = kind === "kit" ? "kit.json" : "tone.sfz";
    await writeFile(join(root, entry), kind === "kit" ?
      JSON.stringify({ version: 1, samples: { bd: ["missing.wav"] } }) : "<region> sample=missing.wav");
    await writeFile(join(root, "instrument.json"), JSON.stringify({ version: 1, id: `schema-${kind}`,
      kind, entry, source: { folder: "synthetic" }, warnings: [] }));
    const song = validateSong(source([{ id: "user", instrument: `user:schema-${kind}`, only: ["sd"] }], "drums"));
    await assert.rejects(renderSong(song, "fixture.song.json"), (error: unknown) =>
      schemaIssue(error, `$.tracks[0].layers[0].${kind === "kit" ? "only[0]" : "instrument"}`));
  }
});

test("public layer validation includes insert relational rules at the supplied path", () => {
  const issues: { path: string; message: string }[] = [];
  checkLayers([{ ...layer, fx: [{ type: "eq", lowHz: 400, midHz: 300 }] }], "$.tracks[3].layers", "notes", issues);
  assert.ok(issues.some(({ path }) => path === "$.tracks[3].layers[0].fx[0].lowHz"));
});
