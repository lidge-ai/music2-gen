import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { metadataXml } from "./metadata-xml.tool.ts";
import type { ProjectIR } from "../../project/index.ts";

const project = (title: string) => ({ title }) as ProjectIR;
test("metadata is stable UTF-8, schema ordered and XML escaped", () => {
  const title = '한글 A & <B> "C"';
  const first = metadataXml(project(title));
  assert.deepEqual(first, metadataXml(project(title)));
  const xml = Buffer.from(first).toString("utf8");
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'));
  assert.ok(xml.includes('<Title>한글 A &amp; &lt;B&gt; &quot;C&quot;</Title>'));
  assert.ok(xml.indexOf("<Title>") < xml.indexOf("<Comment>"));
  assert.ok(xml.endsWith("\n"));
  assert.ok(!xml.includes("\r"));
  assert.ok(Buffer.from(metadataXml(project(""))).toString("utf8").includes("<Title />"));
  assert.throws(() => metadataXml(project("bad\u0001title")), /XML 1.0/);
});

test("metadata validates against pinned MetaData.xsd", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-metadata-xsd-"));
  try {
    const xml = join(dir, "metadata.xml");
    await writeFile(xml, metadataXml(project("A & <B>")));
    const xsd = fileURLToPath(new URL("../../../tests/fixtures/dawproject/MetaData.xsd", import.meta.url));
    const result = spawnSync("xmllint", ["--noout", "--schema", xsd, xml], { encoding: "utf8" });
    if ((result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      if (process.env["MUSIC2_REQUIRE_XMLLINT"] === "1") assert.fail("xmllint required");
      t.skip("SKIP DAWproject XSD (xmllint not found)"); return;
    }
    assert.equal(result.status, 0, result.stderr);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
