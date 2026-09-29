class JsonSyntaxAt extends Error {
  readonly offset: number;
  constructor(offset: number) { super("json syntax"); this.offset = offset; }
}

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const HEX4 = /^[0-9a-fA-F]{4}$/;
const MAX_DEPTH = 10_000;

/**
 * Offset of the first RFC 8259 syntax error, or null for valid JSON. JavaScriptCore's JSON.parse message carries
 * no position, so load errors locate the problem with this scanner instead of parsing an engine message.
 */
export function jsonErrorOffset(source: string): number | null {
  let i = 0;
  const fail = (at = i): never => { throw new JsonSyntaxAt(at); };
  const ws = (): void => { while (i < source.length && WHITESPACE.has(source[i]!)) i++; };
  const string = (): void => {
    i++;
    while (i < source.length) {
      const code = source.charCodeAt(i);
      if (code === 34) { i++; return; }
      if (code < 32) fail();
      if (code !== 92) { i++; continue; }
      const next = source[i + 1];
      if (next === "u") {
        if (!HEX4.test(source.slice(i + 2, i + 6))) fail(i + 1);
        i += 6;
      } else if (next !== undefined && "\"\\/bfnrt".includes(next)) i += 2;
      else fail(i + 1);
    }
    fail();
  };
  const value = (depth: number): void => {
    if (depth > MAX_DEPTH) fail();
    ws();
    const c = source[i];
    if (c === "{") {
      i++; ws();
      if (source[i] === "}") { i++; return; }
      for (;;) {
        ws();
        if (source[i] !== "\"") fail();
        string(); ws();
        if (source[i] !== ":") fail();
        i++;
        value(depth + 1); ws();
        if (source[i] === ",") { i++; continue; }
        if (source[i] === "}") { i++; return; }
        fail();
      }
    }
    if (c === "[") {
      i++; ws();
      if (source[i] === "]") { i++; return; }
      for (;;) {
        value(depth + 1); ws();
        if (source[i] === ",") { i++; continue; }
        if (source[i] === "]") { i++; return; }
        fail();
      }
    }
    if (c === "\"") return string();
    for (const word of ["true", "false", "null"]) {
      if (source.startsWith(word, i)) { i += word.length; return; }
    }
    NUMBER.lastIndex = i;
    const match = NUMBER.exec(source);
    if (!match || match[0] === "-") fail();
    i += match![0].length;
  };
  try {
    value(0);
    ws();
    return i === source.length ? null : i;
  } catch (error) {
    if (error instanceof JsonSyntaxAt) return error.offset;
    throw error;
  }
}

/** One-based line and column of the first JSON syntax error; empty for valid JSON. */
export function jsonErrorLocation(source: string): { line?: number; column?: number; offset?: number } {
  const offset = jsonErrorOffset(source);
  if (offset === null) return {};
  const lines = source.slice(0, offset).split(/\r\n|\r|\n/);
  return { offset, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}
