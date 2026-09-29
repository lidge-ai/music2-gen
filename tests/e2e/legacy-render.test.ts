import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packageRoot, pinnedBunVersion } from "../../src/shared/index.ts";

// Digests were produced by the pre-effects renderer (commit 0737e13) on Node 24 / macOS and are replayed on the
// pinned Bun, which renders the same bytes. Songs without track.fx, song.fx or master.fx must keep rendering these
// exact bytes on the pinned Bun and platform.
const root = packageRoot();
const cli = (args: string[]): void => { execFileSync(process.execPath, [join(root, "src/cli/index.ts"), ...args, "--json"], { cwd: root, stdio: "pipe" }); };
const sha = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");
const legacyPlatform = process.platform === "darwin" && process.versions.bun === pinnedBunVersion();

test("no-FX renders keep the pre-effects bytes for loop, --bars, stems and peak mastering", { skip: !legacyPlatform && "digests are pinned to the recording platform" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "music2-legacy-"));
  try {
    cli(["render", "examples/game-loop-16bar.song.json", "-o", join(dir, "loop.wav")]);
    cli(["render", "examples/trap-150.song.json", "-o", join(dir, "bars.wav"), "--bars", "4:12"]);
    cli(["render", "examples/house-124.song.json", "-o", join(dir, "stems.wav"), "--stems", join(dir, "stems")]);
    const peak = JSON.parse(readFileSync(join(root, "examples/lofi-75.song.json"), "utf8")) as { master: Record<string, unknown> };
    delete peak.master["targetLufs"];
    writeFileSync(join(dir, "peak.song.json"), JSON.stringify(peak));
    cli(["render", join(dir, "peak.song.json"), "-o", join(dir, "peak.wav")]);
    assert.equal(sha(join(dir, "loop.wav")), "e589f8abe4e818992f1ea31b70293110a5af5f336e7b9999c118996bc49ddab3");
    assert.equal(sha(join(dir, "bars.wav")), "ccd67d8699d5412b96ddfa4a418015087ca77870146ff39d293cf9caec583ec6");
    assert.equal(sha(join(dir, "stems.wav")), "80b0eb982f4437d711de690b74f6320b55c2f7687248f88a810ba9646e99be58");
    assert.equal(sha(join(dir, "peak.wav")), "410137ad8c21a9230890419da229e4e9e69f370cb6d96eea7ff7e517a3f21fc3");
    const stems = Object.fromEntries(readdirSync(join(dir, "stems")).sort().map((name) => [name, sha(join(dir, "stems", name))]));
    assert.deepEqual(stems, {
      "bass.wav": "88f07230665a8e72d50dc41fea30044e18526890e29dfc78ac321928000d151e",
      "clap.wav": "45e87fbf57a4f7c3a6c30f46644b2316eb64a82070a70965cca7978489b3abee",
      "hats.wav": "6bbc4fb8437add72072efd567faebd120d247ce35297dadce962eca9cd883b70",
      "kick.wav": "a6d14b02c48fe612c65d1f7bf2f6071b39ea3dc975ee02c3ed26df9b0d8bdb89",
      "lead.wav": "91340f075ba78cccd2018a8415333c47a94d7db3a1fa056531b06d03fc6da1cc",
      "pad.wav": "7d577891779a8a9093ae6174ee79e83ebd5d5c43bc83958caf6b4d448f9f748b",
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
