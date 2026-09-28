import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSfz } from "./sfz-parse.tool.ts";

test("include expansion, definitions, scope inheritance and control snapshots", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-"));
  try {
    await writeFile(join(root, "main.sfz"), [
      "#define $K 36", "#define $K_RIM 40", "<control> default_path=early/ note_offset=1",
      "<global> volume=-6", "<group> ampeg_attack=0.1", "#include \"child.sfz\"",
      "<control> default_path=late/ note_offset=2", "<region> sample=ride bell.wav key=C4 pitch_keycenter=G4",
    ].join("\n"));
    await writeFile(join(root, "child.sfz"), "<region> sample=kick one.wav key=$K\n<region> sample=rim.wav key=$K_RIM\n");
    const parsed = await parseSfz("main.sfz", root);
    assert.equal(parsed.regions.length, 3);
    assert.deepEqual(parsed.regions.map((r) => r.key), [[36, 36], [40, 40], [60, 60]]);
    assert.deepEqual(parsed.regions.map((r) => r.pitchKeycenter), [36, 40, 67]);
    assert.deepEqual(parsed.regions.map((r) => r.control.defaultPath), ["early/", "early/", "late/"]);
    assert.deepEqual(parsed.regions.map((r) => r.control.noteOffset), [1, 1, 2]);
    assert.equal(parsed.regions[2]?.volume, -6);
    assert.equal(parsed.regions[2]?.ampeg.attack, 0.1);
    assert.equal(parsed.regions[0]?.sample, "kick one.wav");
    assert.equal(parsed.regions[0]?.source.file, "child.sfz");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("aliases, unsupported selection and located parse failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-"));
  try {
    await writeFile(join(root, "ok.sfz"), "<region> sample=a.wav pitch=25 polyphony_group=7 loopmode=one_shot offby=2\n<region> sample=b.wav locc1=64\n");
    const parsed = await parseSfz("ok.sfz", root);
    assert.equal(parsed.regions.length, 1);
    assert.equal(parsed.regions[0]?.tune, 25);
    assert.equal(parsed.regions[0]?.group, 7);
    assert.equal(parsed.regions[0]?.loopMode, "one_shot");
    assert.deepEqual(parsed.warnings[0], { file: "ok.sfz", line: 2, opcode: "locc1", message: "unsupported opcode" });
    await writeFile(join(root, "bad.sfz"), "<region> sample=a.wav hivel=x\n");
    await assert.rejects(parseSfz("bad.sfz", root), { code: "E_PARSE", details: { file: "bad.sfz", line: 1, opcode: "hivel" } });
    await writeFile(join(root, "codec.sfz"), "<region> sample=sample.flac\n");
    await assert.rejects(parseSfz("codec.sfz", root), { code: "E_CAPABILITY" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("includes reject cycles and path escapes", async () => {
  const base = await mkdtemp(join(tmpdir(), "music2-sfz-"));
  const root = join(base, "bank");
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(root);
    await writeFile(join(root, "cycle.sfz"), "#include \"cycle.sfz\"\n");
    await assert.rejects(parseSfz("cycle.sfz", root), { code: "E_PARSE" });
    await writeFile(join(base, "outside.sfz"), "<region> sample=a.wav\n");
    await symlink(join(base, "outside.sfz"), join(root, "link.sfz"));
    await writeFile(join(root, "escape.sfz"), "#include \"link.sfz\"\n");
    await assert.rejects(parseSfz("escape.sfz", root), { code: "E_ACCESS" });
  } finally { await rm(base, { recursive: true, force: true }); }
});
