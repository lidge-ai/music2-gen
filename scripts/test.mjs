#!/usr/bin/env bun
// Runs every src/**/*.test.ts and tests/e2e/*.test.ts with bun test in 4 isolated workers.
import { mkdirSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createStereo, readWav, writeWav } from "../src/audio-io/index.ts";
import { discoverFfmpeg, encodeAudio } from "../src/probe/index.ts";

/** ffmpeg gating (devlog 020): required on CI Linux via MUSIC2_REQUIRE_FFMPEG=1, otherwise optional with a printed SKIP. */
async function checkFfmpeg(home, env) {
  const required = env.MUSIC2_REQUIRE_FFMPEG === "1";
  const ffmpeg = await discoverFfmpeg(env);
  if (!ffmpeg) {
    if (required) throw new Error("E_FFMPEG_MISSING: ffmpeg executable not found");
    console.log("SKIP ffmpeg integration (ffmpeg not found)");
    return;
  }
  if (!ffmpeg.encoders.libmp3lame || !ffmpeg.encoders.libvorbis) {
    if (required) throw new Error("E_CAPABILITY: ffmpeg requires libmp3lame and libvorbis");
    console.log("SKIP ffmpeg integration (required encoders unavailable)");
    return;
  }
  const dir = join(home, "ffmpeg-integration");
  mkdirSync(dir);
  const wav = join(dir, "source.wav");
  const audio = createStereo(44100, 4410);
  for (let i = 0; i < audio.left.length; i++) {
    const sample = 0.1 * Math.sin((2 * Math.PI * 440 * i) / 44100);
    audio.left[i] = sample;
    audio.right[i] = sample;
  }
  await writeWav(wav, audio, { bits: 16, seed: 1 });
  for (const format of ["mp3", "ogg"]) {
    const encoded = join(dir, `encoded.${format}`);
    const decoded = join(dir, `decoded-${format}.wav`);
    await encodeAudio(wav, encoded, ffmpeg, { format });
    const result = spawnSync(ffmpeg.path, ["-nostdin", "-y", "-i", encoded, "-f", "wav", decoded], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
      throw new Error(`E_RENDER: ffmpeg ${format} decode failed: ${result.stderr?.slice(-2000) ?? String(result.error)}`);
    }
    if ((await readWav(decoded)).left.length === 0) throw new Error(`E_RENDER: ffmpeg ${format} decoded empty audio`);
  }
  console.log(`ffmpeg integration ok (${ffmpeg.version}: mp3 + ogg round trip)`);
}

function options(args) {
  const result = { root: resolve(dirname(fileURLToPath(import.meta.url)), ".."), unit: false, e2e: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--root" && args[i + 1]) result.root = resolve(args[++i]);
    else if (arg === "--unit") result.unit = true;
    else if (arg === "--e2e") result.e2e = true;
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  if (result.unit && result.e2e) throw new Error("--unit and --e2e cannot be combined");
  return result;
}

function filesIn(root, subdir, suffix, recursive) {
  const dir = join(root, subdir);
  try {
    return readdirSync(dir, { recursive, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
      .map((entry) => join(entry.parentPath, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

/** Hard limit for the whole bun test run; per-test limits cannot fire while a test blocks in a sync call. */
const RUN_LIMIT_MS = 30 * 60 * 1000;

/**
 * Stream bun test output live and finish when the process exits. Waiting for pipe EOF (spawnSync) can hang
 * forever when a test leaves a grandchild that inherited the pipes.
 */
function runTests(root, env, files) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["test", "--parallel=4", "--timeout=600000", ...files],
      { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; process.stderr.write(chunk); });
    const limit = setTimeout(() => {
      console.error(`music2 test: bun test exceeded ${RUN_LIMIT_MS / 60000} minutes; killing it`);
      child.kill("SIGKILL");
    }, RUN_LIMIT_MS);
    child.on("error", (error) => { clearTimeout(limit); reject(error); });
    child.on("exit", (code, signal) => {
      clearTimeout(limit);
      // Give the pipes a moment to drain, then stop waiting for any process that still holds them.
      setTimeout(() => {
        child.stdout.destroy(); child.stderr.destroy();
        resolvePromise({ status: signal ? null : code, stdout, stderr });
      }, 1000);
    });
  });
}

try {
  const { root, unit, e2e } = options(process.argv.slice(2));
  const files = [
    ...(!e2e ? filesIn(root, "src", ".test.ts", true) : []),
    ...(!unit ? filesIn(root, "tests/e2e", ".test.ts", false) : []),
  ].sort();
  if (files.length === 0) {
    console.error("music2 test: no test files found");
    process.exitCode = 1;
  } else {
    const home = mkdtempSync(join(tmpdir(), "music2-test-"));
    const env = { ...process.env, MUSIC2_HOME: home };
    await checkFfmpeg(home, env);
    const child = await runTests(root, env, files);
    process.exitCode = child.status ?? 1;
    // bun test treats each path as a filter and only notes filters that match nothing, so count what ran.
    const ran = /Ran \d+ tests? across (\d+) files?/.exec(`${child.stdout}\n${child.stderr}`);
    if (!ran || Number(ran[1]) !== files.length) {
      console.error(`music2 test: bun test ran ${ran ? ran[1] : "no"} of ${files.length} files`);
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(`music2 test: ${error.message}`);
  process.exitCode = 1;
}
