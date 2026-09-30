import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { pinnedBunVersion } from "../shared/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { mixTracks } from "./mixer.tool.ts";

// Digests recorded on the pre-layer mixer (commit 38e00bc, pinned Bun, darwin). Songs without layers must keep them.
const digestPlatform = process.platform === "darwin" && process.versions.bun === pinnedBunVersion();
const base = { version: 1 as const, bpm: 120, sampleRate: 44100 as const, tailSeconds: 0.5, seed: 7,
  sections: [{ id: "a", bars: 2 }, { id: "b", bars: 2 }], arrangement: [{ section: "a" }, { section: "b" }] };
const FIXTURES: Record<string, unknown> = {
  sfz: { ...base, tracks: [{ id: "keys", kind: "notes", instrument: "sfz:inst/sine.sfz", pattern: "c4 e4 g4 c5", gain: -6,
    fx: [{ type: "filter", mode: "lowpass", cutoffHz: 3000 }] }] },
  automation: { ...base, tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ e4 g4", pan: 0.2,
    automation: [{ target: "gain", points: [{ at: 0, value: -12, curve: "linear" }, { at: 8, value: -3 }] }],
    fx: [{ type: "drive", amount: 2 }] }, { id: "kick", kind: "drums", instrument: "drums", pattern: "bd*4" }] },
  tapestop: { ...base, tracks: [{ id: "bass", kind: "notes", instrument: "bass", pattern: "c2*4",
    fx: [{ type: "tapestop", startBar: 3, beats: 2 }] }, { id: "hats", kind: "drums", instrument: "drums", pattern: "hh*8", gain: -9 }] },
  inserts: { ...base, tracks: [{ id: "pad", kind: "notes", instrument: "pad", pattern: "[c4,e4,g4]", sends: { reverb: 0.2 },
    fx: [{ type: "eq", highGainDb: 3 }, { type: "chorus" }] }, { id: "kit", kind: "drums", instrument: "drums", pattern: "bd sd bd sd" }] },
};
const EXPECTED: Record<string, { audio: string; stems: Record<string, string> }> = {
  "sfz": {
    "audio": "c1dd7aad2406595be1024596af8eb8377f75a6bb14e6bca3d71ce93463e81ba4",
    "stems": {
      "keys": "d1ab73f55d710d1d4a3fb76e5b3ce4a1a8196b23bc558c33485876bd29d454f2"
    }
  },
  "sfz:1-4": {
    "audio": "754b7a5831b6fe976c22b50765c76e2d6bf4c4a23843aa09950a7917b3f9dc31",
    "stems": {
      "keys": "8bc27b8994fd8f54140406790112fac096888799ac9fe417531577f79c9b5987"
    }
  },
  "automation": {
    "audio": "84175c6dde0d7cd2173443c5994e5e88533a4cd7069024d0d67747d00acf696c",
    "stems": {
      "lead": "8a508dc6ea3b42388e8646a7c017d5410b392916873b3141c79eb8f1a2b2efc2",
      "kick": "17bd6bfce10adda989181e134a2d3797af284f1c5f1e1d50fe06541fa0312d2b"
    }
  },
  "automation:1-4": {
    "audio": "088b014e75e7cf06a2dc17f3adfbca3abf25f945fe3f6fd263537ca9366fbb0d",
    "stems": {
      "lead": "c4e75927510f42b8a1e22cd2e5100bf8426c29ab433339a490a023c0b20bfc86",
      "kick": "28e92d594ade79579d9d7e1dfd337d23b01f721f63551e5a6b948bcd7ff877e5"
    }
  },
  "tapestop": {
    "audio": "0baf879f0b3570d1dc4ff2cd979d883545cdbcba4ae65b422083fe33a32d78fc",
    "stems": {
      "bass": "c99d6810e8c9feb87dc4892b3790d9a31b9a60321a6ba0f3b19ff1d019df79c6",
      "hats": "72d880d26e988b95840a52b27a0e5f6d73d283bcede12ccd0795ba9a830f8048"
    }
  },
  "tapestop:1-4": {
    "audio": "fbbc9076899f80027be75a50fde1747b61c417f552970a6fc9095a62d1519903",
    "stems": {
      "bass": "e22a9d0b71497c8c4404d42dedfc737871737cba2d09fa4af2810ec54b424d3b",
      "hats": "9ceacf97f9b5b8bf1cf07eb345ebe7a2afdf6274ed0346a133069dc6ffbe70ec"
    }
  },
  "inserts": {
    "audio": "70adb6b6e4f6c322b007afcfeedc4dcdbf2852a0e4c8a6870b5b04244c83fe3f",
    "stems": {
      "pad": "e57577bdd10bfad32148f6407730af9a2f6022199fb719aa939bc520793a46b5",
      "kit": "bd3b11fb7f7626fd005fdd3e91a1c966beb768de6975543808280ced332dfd7b"
    }
  },
  "inserts:1-4": {
    "audio": "bf64c7a8c8c5d95767a7c191b86a1d31f2ba6d7875b3193a12ef3f4513ce20a9",
    "stems": {
      "pad": "9314d0f20821c5f853f22d29860cf32b773301c647a0da5190d4e8bd32042955",
      "kit": "26de9781bd24cfe99b91dfa4ab3893199998a48ef983d201770bc75c32d1771e"
    }
  }
};
const digest = (buffer: StereoBuffer): string => createHash("sha256")
  .update(Buffer.from(buffer.left.buffer, buffer.left.byteOffset, buffer.left.byteLength))
  .update(Buffer.from(buffer.right.buffer, buffer.right.byteOffset, buffer.right.byteLength)).digest("hex");

test("songs without layers keep their pre-layer mix and stem digests on every mixer path", { skip: !digestPlatform && "digests are pinned to the recording platform" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-layer-baseline-"));
  try {
    await mkdir(join(dir, "inst"), { recursive: true });
    await writeFile(join(dir, "inst", "sine.sfz"), "<region> sample=*sine pitch_keycenter=60 ampeg_release=0.2\n");
    for (const [name, raw] of Object.entries(FIXTURES)) {
      for (const variant of [""]) { // wp3 adds "empty-layers"
        const input = structuredClone(raw) as { tracks: Record<string, unknown>[] };
        if (variant) for (const track of input.tracks) track["layers"] = [];
        const song = validateSong(input);
        for (const bars of [undefined, { start: 1, end: 4 }]) {
          const key = name + (bars ? ":1-4" : "");
          const result = await mixTracks(song, buildTimeline(song), join(dir, `${name}.song.json`), { stems: true, ...(bars ? { bars } : {}) });
          assert.equal(digest(result.audio), EXPECTED[key]!.audio, `${key} ${variant} mix`);
          assert.deepEqual(Object.fromEntries(result.stems.map((stem) => [stem.trackId, digest(stem.audio)])), EXPECTED[key]!.stems, `${key} ${variant} stems`);
        }
      }
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
