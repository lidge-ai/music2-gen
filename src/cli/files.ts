import { randomUUID } from "node:crypto";
import { link, lstat, realpath, rename, rm, unlink } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { Music2Error } from "../shared/index.ts";

export interface StagedFile { temporary: string; final: string }

function inputError(path: string): Music2Error {
  return new Music2Error("E_INPUT", `input/output path collision: ${path}`);
}

function accessError(path: string, cause: unknown): Music2Error {
  if ((cause as NodeJS.ErrnoException).code === "EEXIST") {
    return new Music2Error("E_ACCESS", `output already exists: ${path}`, { details: { path }, cause });
  }
  return new Music2Error("E_ACCESS", `cannot write output: ${path}`, { details: { path }, cause });
}

async function canonical(path: string): Promise<string> {
  const absolute = resolve(path);
  try { return await realpath(absolute); } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw accessError(path, cause);
  }
  const parent = dirname(absolute);
  if (parent === absolute) return absolute;
  return join(await canonical(parent), basename(absolute));
}

/** Reject aliases before any output is staged, including symlinked parent directories. */
export async function assertDistinct(inputs: string[], outputs: string[]): Promise<void> {
  const seen = new Set<string>();
  for (const path of inputs) seen.add(await canonical(path));
  for (const path of outputs) {
    const key = await canonical(path);
    if (seen.has(key)) throw inputError(path);
    seen.add(key);
  }
}

export function stage(final: string): StagedFile {
  const extension = extname(final);
  return {
    temporary: join(dirname(final), `.${basename(final, extension)}.${randomUUID()}.tmp${extension}`),
    final,
  };
}

/** Publish with link so even a destination created after preflight is preserved. */
export async function commitNoReplace(staged: StagedFile[]): Promise<void> {
  const created: string[] = [];
  try {
    for (const item of staged) {
      try { await link(item.temporary, item.final); } catch (cause) { throw accessError(item.final, cause); }
      created.push(item.final);
    }
  } catch (cause) {
    for (const path of created.reverse()) await unlink(path).catch(() => undefined);
    throw cause;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (info.isDirectory()) throw new Music2Error("E_ACCESS", `cannot write output: ${path}`, { details: { path } });
    return true;
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw cause;
  }
}

/** Replace a batch, restoring old destinations if any later rename fails. */
export async function commitReplace(staged: StagedFile[]): Promise<void> {
  // A single rename retains the original render command's replacement behavior.
  if (staged.length === 1) {
    const item = staged[0]!;
    try { await rename(item.temporary, item.final); } catch (cause) { throw accessError(item.final, cause); }
    return;
  }
  const committed: { final: string; backup?: string; published: boolean }[] = [];
  let currentPath = staged[0]?.final ?? "";
  try {
    for (const item of staged) {
      currentPath = item.final;
      const entry: { final: string; backup?: string; published: boolean } = { final: item.final, published: false };
      committed.push(entry);
      if (await exists(item.final)) {
        entry.backup = stage(item.final).temporary;
        await rename(item.final, entry.backup);
      }
      await rename(item.temporary, item.final);
      entry.published = true;
    }
  } catch (cause) {
    for (const entry of committed.reverse()) {
      if (entry.backup !== undefined) {
        await rename(entry.backup, entry.final);
      } else if (entry.published) {
        await unlink(entry.final);
      }
    }
    throw accessError(currentPath, cause);
  }
  for (const entry of committed) {
    if (entry.backup !== undefined) await rm(entry.backup, { force: true });
  }
}
