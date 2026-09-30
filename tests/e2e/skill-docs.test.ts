import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { commands } from "../../src/cli/registry.ts";
import { VOICES } from "../../src/render/index.ts";
import { DRUM_NAMES } from "../../src/render/voices/drums.tool.ts";
import { validateVoiceParams } from "../../src/render/voices/registry.tool.ts";
import { validateSong } from "../../src/song/index.ts";

// Resolve from this test's location; the CLI's skill-path registration is owned separately.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const skillDir = resolve(repoRoot, "skills/music2");
const documents = [
  "SKILL.md", "references/mini-notation.md", "references/instruments.md",
  "references/genres.md", "references/mixing.md", "references/prompts.md",
  "references/daw-bridge.md", "references/ableton-als.md",
  "references/layering.md", "references/logic-library.md",
] as const;

test("skill relative links resolve", async () => {
  for (const name of documents) {
    const file = resolve(skillDir, name);
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const destination = match[1]!.split("#", 1)[0]!;
      if (!destination || /^[a-z]+:\/\//i.test(destination)) continue;
      const linked = resolve(dirname(file), destination);
      assert.ok((await stat(linked)).isFile(), `${name}: ${destination} is not a file`);
    }
  }
});

test("skill path JSON resolves the shipped skill directory", () => {
  const result = spawnSync(process.execPath, ["src/cli/index.ts", "skill", "path", "--json"],
    { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout) as { ok: boolean; data: { path: string } };
  assert.equal(parsed.ok, true);
  assert.equal(resolve(parsed.data.path), skillDir);
});

test("documented CLI examples use current CommandSpec flags", async () => {
  const examples: { command: string; flags: string[] }[] = [];
  for (const name of documents) {
    if (name === "references/genres.md") continue;
    const source = await readFile(resolve(skillDir, name), "utf8");
    for (const match of source.matchAll(/bun bin\/music2\.js ([^\n`]+)/g)) {
      const line = match[1]!;
      const command = line.split(/\s+/, 1)[0]!;
      const spec = commands.get(command);
      assert.ok(spec, `${name}: unknown command ${command}`);
      const flags = [...line.matchAll(/--[a-z][a-z0-9-]*|-o\b/g)].map((item) => item[0]);
      for (const flag of flags) {
        const registered = flag === "--json" || flag === "-o"
          ? flag === "--json" || Object.values(spec.options).some((option) => option.short === "o")
          : Object.hasOwn(spec.options, flag.slice(2));
        assert.ok(registered, `${name}: ${command} does not accept ${flag}`);
      }
      examples.push({ command, flags });
    }
  }
  assert.ok(examples.some((example) => example.command === "new" && example.flags.includes("--genre")));
  assert.ok(examples.some((example) => example.command === "render" && example.flags.includes("-o")));
  assert.ok(examples.some((example) => example.command === "critique" && example.flags.includes("--excerpt")));
});

test("each documented built-in voice has a validating track and exact parameter rules", async () => {
  const source = await readFile(resolve(skillDir, "references/instruments.md"), "utf8");
  // Voice rows: id | kind | atoms | params | trailing columns such as source (optional).
  const rows = [...source.matchAll(/^\| `([^`]+)` \| `([^`]+)` \| ([^|]*) \| ([^|]*) \|(?: [^|]* \|)*$/gm)];
  assert.deepEqual(rows.map((row) => row[1]).sort(), Object.keys(VOICES).sort());
  for (const row of rows) {
    const voice = row[1]!;
    const spec = VOICES[voice]!;
    assert.equal(row[2], spec.kind, `${voice} kind`);
    const documented = [...row[4]!.matchAll(/`([^`]+)`: ([0-9.]+) \[([0-9.]+), ([0-9.]+)\]/g)];
    assert.deepEqual(documented.map((item) => item[1]), Object.keys(spec.params), `${voice} parameter keys`);
    for (const item of documented) {
      const rule = spec.params[item[1]!]!;
      assert.deepEqual([Number(item[2]), Number(item[3]), Number(item[4])],
        [rule.default, rule.min, rule.max], `${voice}.${item[1]} bounds/default`);
      if (rule.integer) assert.match(row[4]!, /integer/, `${voice}.${item[1]} integer`);
    }
    if (voice === "drums") assert.deepEqual(row[3]!.match(/`([^`]+)`/)?.[1]?.split(" "), DRUM_NAMES);
  }

  const tracks = [...source.matchAll(/```json\n(\{[\s\S]*?\})\n```/g)]
    .map((match) => JSON.parse(match[1]!) as unknown)
    .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) && "instrument" in value);
  // Every built-in voice has an example; bundled lib: examples are validated too but are not voices.
  assert.deepEqual(tracks.map((track) => track["instrument"]).filter((id) => !String(id).startsWith("lib:")).sort(), Object.keys(VOICES).sort());
  for (const track of tracks) {
    const song = validateSong({ version: 1, bpm: 120, tracks: [track],
      sections: [{ id: "main", bars: 1 }], arrangement: [{ section: "main" }] });
    assert.doesNotThrow(() => validateVoiceParams(song), `${String(track["instrument"])} track`);
  }
});

test("layering and Logic library JSON examples parse and song examples validate", async () => {
  for (const name of ["references/layering.md", "references/logic-library.md"]) {
    const source = await readFile(resolve(skillDir, name), "utf8");
    const examples = [...source.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
    assert.ok(examples.length > 0, `${name}: no JSON examples`);
    for (const [index, match] of examples.entries()) {
      const value: unknown = JSON.parse(match[1]!);
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const example = value as Record<string, unknown>;
      // CLI result envelopes are parsed above; full songs and standalone tracks also use the real validators.
      const input = "tracks" in example ? example : "instrument" in example
        ? { version: 1, bpm: 120, tracks: [example], sections: [{ id: "main", bars: 1 }], arrangement: [{ section: "main" }] }
        : null;
      if (input) assert.doesNotThrow(() => validateVoiceParams(validateSong(input)), `${name}: JSON example ${index + 1}`);
    }
  }
});
