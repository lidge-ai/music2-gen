import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const destination = process.argv[2];
if (!destination) {
  process.stderr.write("usage: node examples/daw-bridge/make-fixtures.mjs <new-directory>\n");
  process.exitCode = 2;
} else {
  const root = resolve(destination);
  const assets = join(root, "assets");
  // Exclusive creation prevents this example utility from replacing user files.
  await mkdir(root);
  await mkdir(assets);
  const rate = 44100;
  function wave(frames, sound) {
    const buffer = Buffer.alloc(44 + frames * 2);
    buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4);
    buffer.write("WAVEfmt ", 8); buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36); buffer.writeUInt32LE(frames * 2, 40);
    for (let i = 0; i < frames; i++) buffer.writeInt16LE(Math.round(32767 * sound(i, i / rate)), 44 + i * 2);
    return buffer;
  }
  const envelope = (t, duration) => Math.min(1, t / 0.02) * Math.min(1, (duration - t) / 0.05);
  await writeFile(join(assets, "tiny.wav"), wave(rate, (_, t) =>
    0.35 * envelope(t, 1) * Math.sin(2 * Math.PI * 523.251131 * t)), { flag: "wx" });
  await writeFile(join(assets, "clip.wav"), wave(rate, (_, t) =>
    0.28 * envelope(t, 1) * (Math.sin(2 * Math.PI * 1760 * t) + 0.35 * Math.sin(2 * Math.PI * 3520 * t))), { flag: "wx" });
  await writeFile(join(assets, "tiny.sfz"), "<region> sample=tiny.wav key=72 pitch_keycenter=72 loop_mode=no_loop ampeg_release=0.02\n", { flag: "wx" });
  await writeFile(join(root, "audio-sfz.song.json"), await readFile(join(here, "audio-sfz.song.json")), { flag: "wx" });
  process.stdout.write(`${join(root, "audio-sfz.song.json")}\n`);
}
