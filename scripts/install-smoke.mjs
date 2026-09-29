#!/usr/bin/env bun
// CI only: install the packed tarball the way users do and check that the Node launcher runs music2 on
// the bundled Bun, including after an install that skipped lifecycle scripts.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pinned = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies.bun;
const tarball = readdirSync(root).find((name) => /^music2-gen-.*\.tgz$/.test(name));
if (!tarball) throw new Error("run npm pack first");
const win = process.platform === "win32";
const quote = (arg) => (win && /[\s"]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg);
const run = (cmd, args) => {
  const result = spawnSync(win ? quote(cmd) : cmd, win ? args.map(quote) : args, { encoding: "utf8", shell: win });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}\n${result.stderr}`);
  return result.stdout;
};
const node = run(win ? "where" : "which", ["node"]).split(/\r?\n/)[0].trim();
if (run(node, ["-p", "typeof process.versions.bun"]).trim() !== "undefined") throw new Error("node on PATH is Bun");

for (const flags of [[], ["--ignore-scripts"]]) {
  const prefix = mkdtempSync(join(tmpdir(), "music2-prefix-"));
  run("npm", ["install", "-g", "--prefix", prefix, ...flags, join(root, tarball)]);
  const bin = win ? join(prefix, "music2.cmd") : join(prefix, "bin", "music2");
  const version = JSON.parse(run(bin, ["version", "--json"]));
  if (!version.ok || version.data.bunSource !== "bundled" || version.data.bun !== pinned)
    throw new Error(`unexpected version output ${JSON.stringify(version)}`);
  const out = mkdtempSync(join(tmpdir(), "music2-smoke-"));
  const song = join(root, "examples", "minimal.song.json");
  run(bin, ["render", song, "-o", join(out, "installed.wav"), "--json"]);
  run(process.execPath, [join(root, "bin", "music2.js"), "render", song, "-o", join(out, "repo.wav"), "--json"]);
  if (!readFileSync(join(out, "installed.wav")).equals(readFileSync(join(out, "repo.wav"))))
    throw new Error("installed render differs from the repository render");
  console.log(`install smoke ok (${flags.join(" ") || "default"}) bun ${version.data.bun}`);
}
