import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectIR } from "../../project/index.ts";
import { buildProjectXml, dawNumber } from "./project-xml.tool.ts";

function fixture(): ProjectIR {
  return { version: 1, ppq: 960, title: "A & B", seed: 1, sampleRate: 48000, tailSeconds: 0,
    loop: false, lengthTicks: 3840, tempo: [{ tick: 0, bpm: 120 }],
    meter: [{ tick: 0, numerator: 4, denominator: 4 }], key: null,
    markers: [{ tick: 0, lengthTicks: 3840, name: "intro", section: "intro", role: null, ordinal: 0, occurrence: 0 }],
    tracks: [{ id: "lead", index: 0, type: "notes", instrument: { kind: "voice", id: "piano", params: {} },
      mono: false, gainDb: -6, pan: -1, sends: { reverb: 0.25, delay: 0 }, inserts: [], duck: null,
      automation: [{ target: "gain", points: [{ tick: 0, value: 0, curve: "linear" },
        { tick: 960, value: -6, curve: "hold" }] }],
      notes: [{ tick: 960, lengthTicks: 480, pitch: 60, sample: null, velocity: 100 / 127,
        eventIndex: 0, source: "list", errorTicks: 0 }] }],
    buses: { reverb: { kind: "reverb", legacy: true, params: null }, delay: null },
    master: { gainDb: 0, ceilingDb: -1, targetLufs: null, inserts: [] }, samples: [],
    quantization: { events: 0, inexact: 0, maxErrorTicks: 0 } };
}

test("ordered structure, typed references, note and automation values", () => {
  const result = buildProjectXml(fixture(), { content: "midi", media: [], regions: [] });
  const xml = Buffer.from(result.bytes).toString("utf8");
  assert.deepEqual(result, buildProjectXml(fixture(), { content: "midi", media: [], regions: [] }));
  assert.match(xml, /<Tempo id="id0"/);
  assert.match(xml, /<TimeSignature id="id1"/);
  assert.ok(xml.indexOf("<Transport>") < xml.indexOf("<Structure>"));
  assert.ok(xml.indexOf("<Structure>") < xml.indexOf("<Arrangement"));
  assert.ok(xml.indexOf("<Mute") < xml.indexOf("<Pan") && xml.indexOf("<Pan") < xml.indexOf("<Sends") &&
    xml.indexOf("<Sends") < xml.indexOf("<Volume"));
  assert.match(xml, /<Note time="1.000000" duration="0.500000" channel="0" key="60" vel="0.787402"/);
  assert.match(xml, /<Marker time="0.000000" name="intro"/);
  assert.match(xml, /value="0.501187"/);
  assert.ok(xml.indexOf("<Target") < xml.indexOf("<RealPoint"));
  const ids = [...xml.matchAll(/\bid="(id\d+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of xml.matchAll(/(?:destination|track|parameter)="(id\d+)"/g)) assert.ok(ids.includes(match[1]));
  assert.ok(!xml.includes("@master"));
});

test("project validates against pinned Project.xsd", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-project-xsd-"));
  try {
    const xml = join(dir, "project.xml");
    await writeFile(xml, buildProjectXml(fixture(), { content: "midi", media: [], regions: [] }).bytes);
    const xsd = fileURLToPath(new URL("../../../tests/fixtures/dawproject/Project.xsd", import.meta.url));
    const result = spawnSync("xmllint", ["--noout", "--schema", xsd, xml], { encoding: "utf8" });
    if ((result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      if (process.env["MUSIC2_REQUIRE_XMLLINT"] === "1") assert.fail("xmllint required");
      t.skip("SKIP DAWproject XSD (xmllint not found)"); return;
    }
    assert.equal(result.status, 0, result.stderr);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("fixed DAW numbers and unsupported tempo map", () => {
  assert.equal(dawNumber(-0), "0.000000");
  assert.equal(dawNumber(-0.0000001), "0.000000");
  assert.equal(dawNumber(1 / 960), "0.001042");
  assert.throws(() => dawNumber(Infinity), /nonfinite/);
  const project = fixture(); project.tempo.push({ tick: 960, bpm: 100 });
  assert.throws(() => buildProjectXml(project, { content: "midi", media: [], regions: [] }), /tick-zero tempo/);
});
