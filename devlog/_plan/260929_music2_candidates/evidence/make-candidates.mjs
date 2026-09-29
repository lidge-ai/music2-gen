
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const base = JSON.parse(readFileSync("examples/drill-140.song.json", "utf8"));
const cands = {
  a_original: base.tracks.find(t => t.id === "bell").pattern,
  b_bounce: "<[c5 ~ ~ eb5 ~ g5 ~ c6 ~ ~ ab5 ~ g5 ~ eb5 ~] [c5 ~ ~ eb5 ~ g5 ~ bb5 ~ ~ ~ g5 d5 ~ ~ ~]>",
  c_space: "<[c5 ~ ~ ~ ~ ~ ~ ~ ab5 ~ g5 eb5 ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ ~ bb4 ~ c5 d5 ~ ~ ~ ~]>",
  d_highrun: "<[g5 ~ ab5 g5 ~ eb5 ~ ~ c6 ~ bb5 ~ ab5 ~ g5 ~] [g5 ~ ab5 g5 ~ eb5 ~ ~ d5 ~ eb5 ~ f5 ~ d5 ~]>",
};
const manifest = [];
for (const [id, pattern] of Object.entries(cands)) {
  const song = structuredClone(base);
  song.title = "candidate " + id;
  song.tracks.find(t => t.id === "bell").pattern = pattern;
  song.arrangement = [{ section: "hook" }];
  const file = out + "/" + id + ".song.json";
  writeFileSync(file, JSON.stringify(song, null, 2) + "\n");
  manifest.push({ id, pattern, song: file });
}
writeFileSync(out + "/candidates.json", JSON.stringify({ base: "examples/drill-140.song.json", target: { track: "bell", section: "hook" }, request: "bell melody bouncier", candidates: manifest }, null, 2) + "\n");
console.log(JSON.stringify(manifest.map(m => m.id)));

