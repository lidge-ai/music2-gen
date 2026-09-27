#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { encodeRgbPng } from "../src/analyze/png.tool.ts";
import { buildTimeline, loadSong } from "../src/song/index.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORE_CASES = ["drill-140", "trap-150", "boom-bap-90", "house-124"];
const IMAGE_SIDES = [1600, 1280, 1024];
const KINDS = ["overview", "spectrogram"];
const MODEL = "gpt-6-sol";
const TIE_LU = 0.1;
const BAR_TOLERANCE = 1;
const PASS_CASES = 3;
export const PROMPT = `Read only the attached image. Report the section occurrences in left-to-right order, including their printed IDs. Boundary bars are the start of the first section, every section change, and the end boundary after the final section. Bar numbers are 1-based. Identify the section with the highest printed SECTION LUFS value, and the first bar of a section whose role is HOOK. If there is no hook, use null. Do not infer unheard audio. If a value cannot be read, use an empty list or null. Return only JSON with exactly these keys:
{"section_order":["id#occurrence"],"boundary_bars":[1],"loudest_section":"id#occurrence","hook_start_bar":null}`;
export const PROMPT_SHA256 = sha256(Buffer.from(PROMPT));

/** @typedef {{schemaVersion:1,caseId:string,corpus:'core'|'use_case',sourceSha256:string,analysisSha256:string,imageSha256:{overview:string,spectrogram:string},preparedImageSha256:{overview:Record<string,string>,spectrogram:Record<string,string>},sectionOrder:string[],boundaryBars:number[],sectionIntegratedLufs:Record<string,number|null>,loudestSection:string|null,loudestMarginLu:number|null,firstHookBar:number|null,excluded:'loudest_tie'|'null_section_lufs'|null}} GroundTruth */
/** @typedef {{schemaVersion:1,caseId:string,imageKind:'overview'|'spectrogram',longSide:1600|1280|1024,repetition:number,model?:'gpt-6-sol',modelId?:'gpt-6-sol',requestedModelId?:'gpt-6-sol',servedModelId?:'gpt-6-sol',promptSha256:string,imageSha256:string,rawResponse:string}} CapturedAnswer */
/** @typedef {{caseId:string,imageKind:string,longSide:number,repetition:number,validSchema:boolean,orderExact:boolean,boundaryHitFraction:number,allBoundariesWithinOne:boolean,loudestExact:boolean,hookWithinOneOrNull:boolean,fourWayCorrect:boolean,c3CaseCorrect:boolean,error:string|null,sourceSha256?:string,analysisSha256?:string,imageSha256?:string}} AnswerScore */
/** @typedef {{schemaVersion:1,model:'gpt-6-sol',promptSha256:string,coreCases:4,nativeOverviewPasses:number,c3Complete:boolean,c3Pass:boolean,exclusions:Record<string,string|null>,scores:AnswerScore[],conditions:Record<string,{passes:number,total:number}>}} EvalSummary */

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function jsonBytes(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function inside(parent, child) {
  const rel = relative(parent, child);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
function caseId(path) { return basename(path).replace(/\.song\.json$/, ""); }

/** Core examples first, then lexically sorted explicit examples; rejects missing or duplicate stems. */
export function selectCases(extraPaths) {
  const core = CORE_CASES.map((name) => `examples/${name}.song.json`);
  const extras = extraPaths.map((input) => {
    const absolute = resolve(ROOT, input);
    if (!inside(join(ROOT, "examples"), absolute) || !absolute.endsWith(".song.json") || !existsSync(absolute)) {
      throw new Error(`case must be an existing examples/*.song.json: ${input}`);
    }
    return relative(ROOT, absolute).split(sep).join("/");
  }).sort();
  const paths = [...core, ...extras];
  const seen = new Set();
  for (const path of paths) {
    if (!existsSync(join(ROOT, path))) throw new Error(`missing case: ${path}`);
    const id = caseId(path);
    if (seen.has(id)) throw new Error(`duplicate case stem: ${id}`);
    seen.add(id);
  }
  return paths;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** Decode only RGB8/filter-0 PNGs emitted by music2; verify every chunk and row. */
export function decodeRgbPng(bytes) {
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("invalid PNG signature");
  let offset = 8, width, height, ended = false, seenIhdr = false, seenIdat = false;
  const idats = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error("truncated PNG chunk");
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("truncated PNG payload");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) throw new Error(`PNG ${type} CRC mismatch`);
    if (type === "IHDR") {
      if (seenIhdr || offset !== 8 || length !== 13) throw new Error("invalid PNG IHDR");
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      if (!width || !height || width > 4096 || height > 4096 || payload[8] !== 8 || payload[9] !== 2 ||
          payload[10] !== 0 || payload[11] !== 0 || payload[12] !== 0) throw new Error("PNG must be RGB8/filter-0 compatible");
      seenIhdr = true;
    } else if (type === "IDAT") {
      if (!seenIhdr) throw new Error("PNG IDAT before IHDR");
      idats.push(payload); seenIdat = true;
    } else if (type === "IEND") {
      if (length || !seenIdat || end !== bytes.length) throw new Error("invalid PNG end");
      ended = true;
    } else throw new Error(`unsupported PNG chunk: ${type}`);
    offset = end;
  }
  if (!ended) throw new Error("missing PNG IEND");
  const stride = width * 3;
  const raw = inflateSync(Buffer.concat(idats), { maxOutputLength: (stride + 1) * height });
  if (raw.length !== (stride + 1) * height) throw new Error("PNG row length mismatch");
  const rgb = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    if (raw[start] !== 0) throw new Error("PNG requires filter 0");
    rgb.set(raw.subarray(start + 1, start + 1 + stride), y * stride);
  }
  return { width, height, rgb };
}

/** Exact area-overlap average for either downscaling or upscaling; rounds half up. */
export function resizeRgbArea({ width, height, rgb }, outWidth, outHeight) {
  if (![width, height, outWidth, outHeight].every((n) => Number.isSafeInteger(n) && n > 0) || rgb.length !== width * height * 3) throw new Error("invalid RGB dimensions");
  const output = new Uint8Array(outWidth * outHeight * 3);
  for (let y = 0; y < outHeight; y++) {
    const y0 = y * height / outHeight, y1 = (y + 1) * height / outHeight;
    for (let x = 0; x < outWidth; x++) {
      const x0 = x * width / outWidth, x1 = (x + 1) * width / outWidth;
      const sum = [0, 0, 0];
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const weight = wy * (Math.min(x1, sx + 1) - Math.max(x0, sx));
          const at = (sy * width + sx) * 3;
          for (let channel = 0; channel < 3; channel++) sum[channel] += rgb[at + channel] * weight;
        }
      }
      const at = (y * outWidth + x) * 3, area = (x1 - x0) * (y1 - y0);
      for (let channel = 0; channel < 3; channel++) output[at + channel] = Math.round(sum[channel] / area);
    }
  }
  return { width: outWidth, height: outHeight, rgb: output };
}

/** Produce all three exact agent-visible variants, preserving a native image unchanged. */
export function prepareImages(bytes) {
  const decoded = decodeRgbPng(bytes);
  const result = {};
  for (const side of IMAGE_SIDES) {
    const scale = side / Math.max(decoded.width, decoded.height);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const image = width === decoded.width && height === decoded.height ? bytes :
      encodeRgbPng(width, height, resizeRgbArea(decoded, width, height).rgb);
    result[side] = image;
  }
  return result;
}

/** Derive musical truth independently from the rendered image. */
export async function deriveGroundTruth(songPath, analysisPath, imagePaths) {
  const songBytes = readFileSync(songPath), analysisBytes = readFileSync(analysisPath);
  const source = JSON.parse(songBytes.toString("utf8"));
  const analysis = JSON.parse(analysisBytes.toString("utf8"));
  if (source.version !== 1 || analysis.version !== 1 || analysis.source !== "wav") throw new Error("song/analysis version or source mismatch");
  const song = await loadSong(songPath), timeline = buildTimeline(song);
  const placements = timeline.placements;
  if (!placements.length || !Number.isFinite(timeline.durationSeconds) || timeline.durationSeconds <= 0 ||
      timeline.durationSeconds !== timeline.bars * timeline.secondsPerBar) throw new Error("invalid timeline duration");
  let endBar = 0;
  for (const placement of placements) {
    if (!Number.isSafeInteger(placement.startBar) || placement.startBar !== endBar ||
        !Number.isSafeInteger(placement.bars) || placement.bars <= 0) throw new Error("noncontiguous timeline placement");
    endBar += placement.bars;
  }
  if (endBar !== timeline.bars) throw new Error("timeline final bar mismatch");
  const ids = placements.map((placement) => `${placement.section}#${placement.occurrence}`);
  if (!Array.isArray(analysis.sections) || analysis.sections.length !== ids.length ||
      analysis.sections.some((section, index) => section.id !== ids[index])) throw new Error("analysis sections differ from timeline");
  const values = Object.fromEntries(analysis.sections.map((section) => [section.id, section.integratedLufs]));
  if (analysis.sections.some((section) => section.integratedLufs !== null && !Number.isFinite(section.integratedLufs))) throw new Error("nonfinite section LUFS");
  const ranked = analysis.sections.filter((section) => section.integratedLufs !== null)
    .sort((a, b) => b.integratedLufs - a.integratedLufs || a.id.localeCompare(b.id));
  const margin = ranked.length > 1 ? ranked[0].integratedLufs - ranked[1].integratedLufs : null;
  const excluded = ranked.length !== ids.length ? "null_section_lufs" : margin !== null && margin <= TIE_LU ? "loudest_tie" : null;
  const imageBytes = Object.fromEntries(KINDS.map((kind) => [kind, readFileSync(imagePaths[kind])]));
  const prepared = Object.fromEntries(KINDS.map((kind) => [kind, prepareImages(imageBytes[kind])]));
  return {
    schemaVersion: 1, caseId: caseId(songPath), corpus: CORE_CASES.includes(caseId(songPath)) ? "core" : "use_case",
    sourceSha256: sha256(songBytes), analysisSha256: sha256(analysisBytes),
    imageSha256: Object.fromEntries(KINDS.map((kind) => [kind, sha256(imageBytes[kind])])),
    preparedImageSha256: Object.fromEntries(KINDS.map((kind) => [kind,
      Object.fromEntries(IMAGE_SIDES.map((side) => [side, sha256(prepared[kind][side])]))])),
    sectionOrder: ids, boundaryBars: [1, ...placements.slice(1).map((placement) => placement.startBar + 1), timeline.bars + 1],
    sectionIntegratedLufs: values, loudestSection: ranked[0]?.id ?? null, loudestMarginLu: margin,
    firstHookBar: placements.find((placement) => placement.role === "hook")?.startBar + 1 || null, excluded,
  };
}

/**
 * The overview font has only uppercase glyphs and the rail prefixes each occurrence with a two-digit index, so a printed
 * ID can never match a lowercase song ID byte for byte. Compare IDs case-insensitively and ignore a leading "NN " index.
 * Nothing else is normalized: a role prefix, an underscore for a space, or a different occurrence number still fails.
 */
export function normalizeId(id) {
  return typeof id === "string" ? id.trim().toUpperCase().replace(/^\d{1,2}\s+/, "") : id;
}

function validModelAnswer(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.join("|") !== "boundary_bars|hook_start_bar|loudest_section|section_order") return false;
  const bar = (n) => Number.isSafeInteger(n) && n >= 1;
  return Array.isArray(value.section_order) && value.section_order.every((id) => typeof id === "string") &&
    Array.isArray(value.boundary_bars) && value.boundary_bars.every(bar) &&
    (value.loudest_section === null || typeof value.loudest_section === "string") &&
    (value.hook_start_bar === null || bar(value.hook_start_bar));
}
function emptyScore(captured, error) {
  return { caseId: captured.caseId, imageKind: captured.imageKind, longSide: captured.longSide,
    repetition: captured.repetition, validSchema: false, orderExact: false, boundaryHitFraction: 0,
    allBoundariesWithinOne: false, loudestExact: false, hookWithinOneOrNull: false,
    fourWayCorrect: false, c3CaseCorrect: false, error };
}

/** Validate capture provenance before parsing its raw model answer. */
export function scoreAnswer(truth, captured) {
  const modelIds = [captured?.model, captured?.modelId, captured?.requestedModelId, captured?.servedModelId].filter((id) => id !== undefined);
  const pairedIds = (captured?.requestedModelId === undefined) === (captured?.servedModelId === undefined);
  if (!truth || !captured || captured.schemaVersion !== 1 || captured.caseId !== truth.caseId ||
      !KINDS.includes(captured.imageKind) || !IMAGE_SIDES.includes(captured.longSide) ||
      !Number.isSafeInteger(captured.repetition) || captured.repetition < 1 ||
      !modelIds.length || modelIds.some((id) => id !== MODEL) || !pairedIds ||
      captured.promptSha256 !== PROMPT_SHA256 ||
      (captured.fileName !== undefined && captured.fileName !== `${captured.caseId}.${captured.imageKind}.${captured.longSide}.r${captured.repetition}.json`) ||
      captured.imageSha256 !== truth.preparedImageSha256?.[captured.imageKind]?.[captured.longSide] ||
      typeof captured.rawResponse !== "string") return emptyScore(captured, "evidence_integrity");
  let answer;
  try { answer = JSON.parse(captured.rawResponse); } catch { return emptyScore(captured, "invalid_json"); }
  if (!validModelAnswer(answer) || answer.boundary_bars.length !== truth.boundaryBars.length) return emptyScore(captured, "invalid_schema");
  const orderExact = JSON.stringify(answer.section_order.map(normalizeId)) === JSON.stringify(truth.sectionOrder.map(normalizeId));
  const comparable = orderExact && answer.boundary_bars.length === truth.boundaryBars.length;
  const hits = comparable ? answer.boundary_bars.filter((bar, index) => Math.abs(bar - truth.boundaryBars[index]) <= BAR_TOLERANCE).length : 0;
  const boundaryHitFraction = comparable ? hits / truth.boundaryBars.length : 0;
  const allBoundariesWithinOne = comparable && hits === truth.boundaryBars.length;
  const loudestExact = answer.loudest_section !== null && normalizeId(answer.loudest_section) === normalizeId(truth.loudestSection);
  const hookWithinOneOrNull = answer.hook_start_bar === null ? truth.firstHookBar === null :
    truth.firstHookBar !== null && Math.abs(answer.hook_start_bar - truth.firstHookBar) <= BAR_TOLERANCE;
  const c3CaseCorrect = orderExact && allBoundariesWithinOne && loudestExact;
  return { ...emptyScore(captured, null), validSchema: true, orderExact, boundaryHitFraction,
    allBoundariesWithinOne, loudestExact, hookWithinOneOrNull,
    fourWayCorrect: c3CaseCorrect && hookWithinOneOrNull, c3CaseCorrect };
}

function rowOrder(row) {
  const index = CORE_CASES.indexOf(row.caseId);
  return [index < 0 ? CORE_CASES.length : index, index < 0 ? row.caseId : "", KINDS.indexOf(row.imageKind),
    IMAGE_SIDES.indexOf(row.longSide), row.repetition];
}
function compareRows(a, b) {
  const x = rowOrder(a), y = rowOrder(b);
  for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; }
  return 0;
}

/** Score every eligible case/variant; duplicates and missing captures stay visible as invalid rows. */
export function scoreCorpus(truths, captures) {
  const seenTruth = new Set(), truthById = new Map();
  for (const truth of truths) {
    if (seenTruth.has(truth.caseId)) throw new Error(`duplicate truth: ${truth.caseId}`);
    seenTruth.add(truth.caseId); truthById.set(truth.caseId, truth);
  }
  const captureMap = new Map();
  for (const capture of captures) {
    const key = `${capture.caseId}|${capture.imageKind}|${capture.longSide}|${capture.repetition}`;
    if (!captureMap.has(key)) captureMap.set(key, []);
    captureMap.get(key).push(capture);
  }
  const scores = [];
  for (const truth of truths) {
    if (truth.excluded) continue;
    for (const kind of KINDS) for (const side of IMAGE_SIDES) {
      const key = `${truth.caseId}|${kind}|${side}|1`;
      const found = captureMap.get(key) ?? [];
      scores.push(found.length === 0 ? emptyScore({ caseId: truth.caseId, imageKind: kind, longSide: side, repetition: 1 }, "missing_capture") :
        found.length > 1 ? emptyScore(found[0], "duplicate_capture") : scoreAnswer(truth, found[0]));
    }
  }
  for (const group of captureMap.values()) {
    const capture = group[0], truth = truthById.get(capture.caseId);
    if (capture.repetition === 1 && KINDS.includes(capture.imageKind) && IMAGE_SIDES.includes(capture.longSide) && truth && !truth.excluded) continue;
    if (!truth || truth.excluded) continue;
    scores.push(group.length > 1 ? emptyScore(capture, "duplicate_capture") : scoreAnswer(truth, capture));
  }
  scores.sort(compareRows);
  const core = CORE_CASES.map((id) => scores.find((row) => row.caseId === id && row.imageKind === "overview" && row.longSide === 1600 && row.repetition === 1));
  const c3Complete = CORE_CASES.every((id, index) => truthById.has(id) && !truthById.get(id).excluded && core[index]?.validSchema);
  const nativeOverviewPasses = core.filter((row) => row?.c3CaseCorrect).length;
  const exclusions = Object.fromEntries([...truths].sort((a, b) => compareRows({ ...a, imageKind: "overview", longSide: 1600, repetition: 1 }, { ...b, imageKind: "overview", longSide: 1600, repetition: 1 }))
    .map((truth) => [truth.caseId, truth.excluded]));
  const conditions = Object.fromEntries(KINDS.flatMap((kind) => IMAGE_SIDES.map((side) => {
    const rows = scores.filter((row) => row.imageKind === kind && row.longSide === side && row.repetition === 1);
    return [`${kind}-${side}`, { passes: rows.filter((row) => row.fourWayCorrect).length, total: rows.length }];
  })));
  const provenancedScores = scores.map((row) => {
    const truth = truthById.get(row.caseId);
    return { ...row, sourceSha256: truth?.sourceSha256 ?? null, analysisSha256: truth?.analysisSha256 ?? null,
      imageSha256: truth?.preparedImageSha256?.[row.imageKind]?.[row.longSide] ?? null };
  });
  return { schemaVersion: 1, model: MODEL, promptSha256: PROMPT_SHA256, coreCases: 4,
    nativeOverviewPasses, c3Complete: Boolean(c3Complete), c3Pass: Boolean(c3Complete && nativeOverviewPasses >= PASS_CASES),
    exclusions, scores: provenancedScores, conditions };
}

function atomicWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const pending = `${path}.tmp`;
  writeFileSync(pending, contents);
  renameSync(pending, path);
}
function cliJson(args, workDir, label) {
  try {
    const output = execFileSync(process.execPath, ["bin/music2.js", ...args, "--json"], {
      cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    });
    const lines = output.trim().split(/\r?\n/);
    if (lines.length !== 1) throw new Error(`${label} emitted multiple lines`);
    const result = JSON.parse(lines[0]);
    if (result.ok !== true || !result.data || typeof result.data !== "object") throw new Error(`${label} failed: ${output}`);
    return result.data;
  } catch (error) {
    writeFileSync(join(workDir, "error.log"), `${label}: ${error.message}\nexit: ${error.status ?? "unknown"}\nstderr: ${error.stderr?.toString() ?? ""}\n`);
    throw error;
  }
}
function artifact(data, key, workDir) {
  const path = data[key];
  if (typeof path !== "string" || !inside(workDir, resolve(path)) || !existsSync(path)) throw new Error(`missing/out-of-work ${key} artifact`);
  return resolve(path);
}
function options(args) {
  const command = args.shift();
  if (command !== "prepare" && command !== "score") throw new Error("usage: eval-overview.mjs prepare|score --evidence-dir DIR [--work-dir DIR] [--case SONG]...");
  const result = { command, cases: [] };
  while (args.length) {
    const flag = args.shift(), value = args.shift();
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${flag}`);
    if (flag === "--case" && command === "prepare") result.cases.push(value);
    else if (flag === "--evidence-dir" && !result.evidenceDir) result.evidenceDir = value;
    else if (flag === "--work-dir" && command === "prepare" && !result.workDir) result.workDir = value;
    else throw new Error(`unknown or duplicate option: ${flag}`);
  }
  if (!result.evidenceDir || (command === "prepare" && !result.workDir)) throw new Error("--evidence-dir and prepare --work-dir are required");
  return result;
}
async function prepare({ evidenceDir, workDir, cases }) {
  const evidence = resolve(evidenceDir), work = resolve(workDir);
  if (work === resolve(sep) || work === ROOT || inside(ROOT, work) || inside(work, ROOT) ||
      evidence === work || inside(work, evidence) || inside(evidence, work)) throw new Error("work directory must be separate and outside repository/evidence");
  mkdirSync(work, { recursive: true });
  const manifest = [];
  for (const song of selectCases(cases)) {
    const id = caseId(song), directory = join(work, id), wav = join(directory, `${id}.wav`);
    mkdirSync(directory, { recursive: true });
    const rendered = cliJson(["render", song, "-o", wav], directory, "render");
    if (artifact(rendered, "wav", work) !== wav) throw new Error("render WAV path mismatch");
    const analyzed = cliJson(["analyze", wav, "--song", song, "--out", join(directory, "analysis")], directory, "analyze");
    const analysisPath = artifact(analyzed, "analysisJson", work);
    const images = { overview: artifact(analyzed, "overviewPng", work), spectrogram: artifact(analyzed, "spectrogramPng", work) };
    const truth = await deriveGroundTruth(join(ROOT, song), analysisPath, images);
    atomicWrite(join(evidence, "ground-truth", `${id}.json`), jsonBytes(truth));
    if (truth.excluded) continue;
    for (const kind of KINDS) {
      const variants = prepareImages(readFileSync(images[kind]));
      for (const side of IMAGE_SIDES) {
        const path = join(directory, `${kind}-${side}.png`);
        writeFileSync(path, variants[side]);
        manifest.push({ caseId: id, imageKind: kind, longSide: side, imagePath: path,
          imageSha256: truth.preparedImageSha256[kind][side], promptSha256: PROMPT_SHA256, model: MODEL, modelId: MODEL });
      }
    }
  }
  process.stdout.write(jsonBytes({ dispatch: manifest }));
}
function markdown(summary, evidenceDir) {
  const rows = ["# Overview evaluation", "", `Native overview core pass ${summary.nativeOverviewPasses}/4; threshold >=${PASS_CASES}; complete: ${summary.c3Complete}; pass: ${summary.c3Pass}.`,
    `Model: ${summary.model}; prompt SHA-256: ${summary.promptSha256}.`, "", "| Case | Image | Side | r | Order | Boundaries | All | Loudest | Hook | Four-way | c-3 | Error | Answer |",
    "| --- | --- | ---: | ---: | --- | ---: | --- | --- | --- | --- | --- | --- | --- |"]; 
  for (const row of summary.scores) {
    const answer = `answers/${row.caseId}.${row.imageKind}.${row.longSide}.r${row.repetition}.json`;
    rows.push(`| ${row.caseId} | ${row.imageKind} | ${row.longSide} | ${row.repetition} | ${row.orderExact} | ${row.boundaryHitFraction} | ${row.allBoundariesWithinOne} | ${row.loudestExact} | ${row.hookWithinOneOrNull} | ${row.fourWayCorrect} | ${row.c3CaseCorrect} | ${row.error ?? ""} | [JSON](${basename(evidenceDir)}/${answer}) |`);
  }
  rows.push("", "## Conditions", "", ...Object.entries(summary.conditions).map(([key, value]) => `- ${key}: ${value.passes}/${value.total} four-way correct`),
    "", "## Exclusions", "", ...Object.entries(summary.exclusions).filter(([, reason]) => reason).map(([id, reason]) => `- ${id}: ${reason}`),
    "", "Prepare: `node scripts/eval-overview.mjs prepare --evidence-dir <evidence-dir> --work-dir <external-task-work-dir>`.",
    "Score: `node scripts/eval-overview.mjs score --evidence-dir <evidence-dir>`.",
    "Keep WAV/PNG files in the external work directory. Generated SHA: see each ground-truth JSON.\n");
  return rows.join("\n");
}
function score({ evidenceDir }) {
  const evidence = resolve(evidenceDir);
  const truthDir = join(evidence, "ground-truth"), answerDir = join(evidence, "answers");
  const truths = readdirSync(truthDir).filter((name) => name.endsWith(".json")).sort()
    .map((name) => JSON.parse(readFileSync(join(truthDir, name), "utf8")));
  const captures = existsSync(answerDir) ? readdirSync(answerDir).filter((name) => name.endsWith(".json")).sort()
    .map((name) => ({ ...JSON.parse(readFileSync(join(answerDir, name), "utf8")), fileName: name })) : [];
  const summary = scoreCorpus(truths, captures);
  atomicWrite(join(evidence, "summary.json"), jsonBytes(summary));
  atomicWrite(`${evidence}.md`, markdown(summary, evidence));
  process.stdout.write(jsonBytes({ nativeOverviewPasses: summary.nativeOverviewPasses, c3Complete: summary.c3Complete, c3Pass: summary.c3Pass }));
  if (!summary.c3Pass) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const parsed = options(process.argv.slice(2));
    if (parsed.command === "prepare") await prepare(parsed);
    else score(parsed);
  } catch (error) {
    console.error(`overview evaluation: ${error.message}`);
    process.exitCode = 1;
  }
}
