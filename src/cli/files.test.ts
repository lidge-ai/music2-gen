import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Music2Error } from "../shared/index.ts";
import { assertDistinct, commitNoReplace, commitReplace, stage } from "./files.ts";
import type { StagedFile } from "./files.ts";

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "music2-files-test-"));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

function isCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof Music2Error && error.code === code;
}

async function clean(staged: StagedFile[]): Promise<void> {
  for (const item of staged) await rm(item.temporary, { force: true });
}

test("assertDistinct resolves existing file aliases and new paths below symlinked parents", async () => {
  await withDir(async (dir) => {
    const input = join(dir, "song.json");
    await writeFile(input, "song");
    await symlink(input, join(dir, "alias.json"));
    await symlink(dir, join(dir, "alias-dir"));
    await assert.rejects(assertDistinct([input], [join(dir, "alias.json")]), isCode("E_INPUT"));
    await assert.rejects(assertDistinct([input], [join(dir, "alias-dir", "song.json")]), isCode("E_INPUT"));
    await assert.rejects(assertDistinct([], [join(dir, "new.wav"), join(dir, "alias-dir", "new.wav")]), isCode("E_INPUT"));
    await assertDistinct([input, join(dir, "alias.json")], [join(dir, "new.wav")]);
    await assertDistinct([input], [join(dir, "new.wav"), join(dir, "other.wav")]);
  });
});

test("stage uses destination directory and commitNoReplace preserves a late occupant", async () => {
  await withDir(async (dir) => {
    const final = join(dir, "out.wav");
    const item = stage(final);
    assert.equal(item.final, final);
    assert.match(item.temporary, /^.*\/\.out\.[\da-f-]+\.tmp\.wav$/);
    try {
      await writeFile(item.temporary, "new");
      await writeFile(final, "late");
      await assert.rejects(commitNoReplace([item]), isCode("E_ACCESS"));
      assert.equal(await readFile(final, "utf8"), "late");
    } finally { await clean([item]); }
    assert.deepEqual((await readdir(dir)).sort(), ["out.wav"]);
  });
});

test("commitNoReplace rolls back only files linked by this invocation", async () => {
  await withDir(async (dir) => {
    const first = stage(join(dir, "first.wav"));
    const second = stage(join(dir, "second.wav"));
    try {
      await writeFile(first.temporary, "ours");
      await writeFile(second.temporary, "ours");
      await writeFile(second.final, "theirs");
      await assert.rejects(commitNoReplace([first, second]), isCode("E_ACCESS"));
      await assert.rejects(readFile(first.final), { code: "ENOENT" });
      assert.equal(await readFile(second.final, "utf8"), "theirs");
    } finally { await clean([first, second]); }
    assert.deepEqual(await readdir(dir), ["second.wav"]);
  });
});

test("commitReplace replaces outputs and removes destination-local backups", async () => {
  await withDir(async (dir) => {
    const first = stage(join(dir, "first.wav"));
    const second = stage(join(dir, "second.wav"));
    try {
      await writeFile(first.final, "old one");
      await writeFile(second.final, "old two");
      await writeFile(first.temporary, "new one");
      await writeFile(second.temporary, "new two");
      await commitReplace([first, second]);
      assert.equal(await readFile(first.final, "utf8"), "new one");
      assert.equal(await readFile(second.final, "utf8"), "new two");
    } finally { await clean([first, second]); }
    assert.deepEqual((await readdir(dir)).sort(), ["first.wav", "second.wav"]);
  });
});

test("commitReplace restores prior bytes and removes newly published files on later failure", async () => {
  await withDir(async (dir) => {
    const first = stage(join(dir, "first.wav"));
    const second = stage(join(dir, "second.wav"));
    const third = stage(join(dir, "third.wav"));
    try {
      await writeFile(first.final, "old one");
      await writeFile(first.temporary, "new one");
      await writeFile(second.temporary, "new two");
      await writeFile(third.final, "old three");
      // A missing third temp makes the last rename fail after both prior outputs publish.
      await assert.rejects(commitReplace([first, second, third]), isCode("E_ACCESS"));
      assert.equal(await readFile(first.final, "utf8"), "old one");
      await assert.rejects(readFile(second.final), { code: "ENOENT" });
      assert.equal(await readFile(third.final, "utf8"), "old three");
    } finally { await clean([first, second, third]); }
    assert.deepEqual((await readdir(dir)).sort(), ["first.wav", "third.wav"]);
  });
});

test("commitReplace leaves an unrelated destination directory intact", async () => {
  await withDir(async (dir) => {
    const first = stage(join(dir, "first.wav"));
    const occupied = stage(join(dir, "occupied.wav"));
    try {
      await writeFile(first.final, "old");
      await writeFile(first.temporary, "new");
      await writeFile(occupied.temporary, "new");
      await mkdir(occupied.final);
      await writeFile(join(occupied.final, "keep"), "theirs");
      await assert.rejects(commitReplace([first, occupied]), isCode("E_ACCESS"));
      assert.equal(await readFile(first.final, "utf8"), "old");
      assert.equal(await readFile(join(occupied.final, "keep"), "utf8"), "theirs");
    } finally { await clean([first, occupied]); }
  });
});

void test("an output path through a non-directory is an access error", async () => {
  await assert.rejects(assertDistinct([], ["/dev/null/out.json"]), (error: unknown) =>
    error instanceof Music2Error && error.code === "E_ACCESS");
});

test("MIDI caller uses staging for late .mid collision, force and alias safety", async () => {
  await withDir(async (dir) => {
    const input = join(dir, "input.mid");
    await writeFile(input, Uint8Array.of(0x4d, 0x54, 0x68, 0x64));
    await symlink(input, join(dir, "alias.mid"));
    await assert.rejects(assertDistinct([input], [join(dir, "alias.mid")]), isCode("E_INPUT"));
    const item = stage(join(dir, "out.mid"));
    try {
      await writeFile(item.temporary, Uint8Array.of(1, 2, 3));
      await writeFile(item.final, Uint8Array.of(9));
      await assert.rejects(commitNoReplace([item]), isCode("E_ACCESS"));
      assert.deepEqual(await readFile(item.final), Buffer.from([9]));
      await commitReplace([item]);
      assert.deepEqual(await readFile(item.final), Buffer.from([1, 2, 3]));
    } finally { await clean([item]); }
    assert.deepEqual((await readdir(dir)).sort(), ["alias.mid", "input.mid", "out.mid"]);
  });
});

test("stems batch commits manifest last and rolls back only new files on late collision", async () => {
  await withDir(async (dir) => {
    const files = ["tracks/lead.wav", "returns/reverb.wav", "stems.json"];
    await mkdir(join(dir, "tracks")); await mkdir(join(dir, "returns"));
    const batch = files.map((path) => stage(join(dir, path)));
    try {
      for (const item of batch) await writeFile(item.temporary, `new ${item.final}`);
      await writeFile(batch[2]!.final, "late manifest");
      await assert.rejects(commitNoReplace(batch), isCode("E_ACCESS"));
      await assert.rejects(readFile(batch[0]!.final), { code: "ENOENT" });
      await assert.rejects(readFile(batch[1]!.final), { code: "ENOENT" });
      assert.equal(await readFile(batch[2]!.final, "utf8"), "late manifest");
    } finally { await clean(batch); }
  });
});

test("stems force batch restores old manifest and track on missing last staged file", async () => {
  await withDir(async (dir) => {
    await mkdir(join(dir, "tracks"));
    const batch = [stage(join(dir, "tracks", "lead.wav")), stage(join(dir, "stems.json"))];
    try {
      await writeFile(batch[0]!.final, "old track");
      await writeFile(batch[1]!.final, "old manifest");
      await writeFile(batch[0]!.temporary, "new track");
      await assert.rejects(commitReplace(batch), isCode("E_ACCESS"));
      assert.equal(await readFile(batch[0]!.final, "utf8"), "old track");
      assert.equal(await readFile(batch[1]!.final, "utf8"), "old manifest");
    } finally { await clean(batch); }
  });
});
