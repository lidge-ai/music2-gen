import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

interface PackageManifest {
  dependencies?: Record<string, string>;
  license?: string;
}

function assertNoRuntimeDependencies(manifest: PackageManifest): void {
  assert.deepEqual(manifest.dependencies ?? {}, {});
}

test("manifest and lock contain no production dependencies", () => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageManifest;
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")) as {
    packages: Record<string, PackageManifest & { dev?: boolean }>;
  };
  assertNoRuntimeDependencies(manifest);
  assertNoRuntimeDependencies(lock.packages[""] ?? {});
  for (const [name, metadata] of Object.entries(lock.packages)) {
    if (name) assert.equal(metadata.dev, true, `${name} is a production lock package`);
  }
  assert.equal(manifest.license, "MIT");
  // Windows checkouts may convert LICENSE to CRLF (.gitattributes text=auto).
  assert.match(readFileSync(join(root, "LICENSE"), "utf8"), /^MIT License\r?\n/);
});

test("runtime dependency assertion rejects a contrived package", () => {
  assert.throws(() => assertNoRuntimeDependencies({ dependencies: { "forbidden-runtime": "1.0.0" } }));
});

test("npm package includes the skill and shipped runtime has no forbidden imports", () => {
  // npm is a .cmd shim on Windows, which Node only spawns through a shell.
  const pack = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: root, encoding: "utf8", maxBuffer: 8_000_000, shell: process.platform === "win32",
  });
  assert.equal(pack.status, 0, pack.stderr);
  const output = JSON.parse(pack.stdout) as { files: { path: string }[] }[];
  const files = new Set(output[0]?.files.map((file) => file.path));
  assert.ok(files.has("skills/music2/SKILL.md"), "skill missing from npm package");
  for (const file of ["skills/music2/references/daw-bridge.md", "skills/music2/references/ableton-als.md"])
    assert.ok(files.has(file), `${file} missing from npm package`);
  assert.equal([...files].filter((file) => file === "scripts/music2-plugin-bridge.py").length, 1,
    "optional plugin bridge must be packaged once");
  assert.ok([...files].every((file) => !file.startsWith("scripts/") || file === "scripts/music2-plugin-bridge.py"));
  assert.ok([...files].every((file) => !file.startsWith("tests/fixtures/dawproject/") &&
    (!/\.(?:wav|mp3|ogg)$/i.test(file) || /^instruments\/.+\.wav$/i.test(file))));
  assert.ok(files.has("instruments/index.json"));
  assert.ok(files.has("THIRD_PARTY_NOTICES.md"));
  const library = JSON.parse(readFileSync(join(root, "instruments/index.json"), "utf8")) as {
    instruments: { sfz: string }[];
  };
  for (const instrument of library.instruments) {
    assert.ok(files.has(`instruments/${instrument.sfz}`), instrument.sfz);
    const folder = instrument.sfz.split("/")[0];
    assert.ok([...files].some((file) => file.startsWith(`instruments/${folder}/`) && /\.wav$/i.test(file)),
      `${folder} samples missing`);
  }
  assert.ok(files.has("LICENSE"), "MIT license missing from npm package");

  const tracked = spawnSync("git", ["ls-files", "-z", "--", "src"], {
    cwd: root, encoding: "buffer",
  });
  assert.equal(tracked.status, 0);
  for (const file of tracked.stdout.toString("utf8").split("\0").filter(Boolean)) {
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(source, /@strudel\//, `${file} imports @strudel`);
    assert.doesNotMatch(source, /GNU (?:AFFERO )?GENERAL PUBLIC LICENSE/, `${file} contains GPL text`);
  }
  for (const file of files) {
    if (!file.startsWith("dist/") || !/\.(?:js|mjs)$/.test(file)) continue;
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(source, /@strudel\//, `${file} imports @strudel`);
    assert.doesNotMatch(source, /GNU (?:AFFERO )?GENERAL PUBLIC LICENSE/, `${file} contains GPL text`);
  }
});
