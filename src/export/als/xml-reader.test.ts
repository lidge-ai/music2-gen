import assert from "node:assert/strict";
import test from "node:test";
import { element, serialize } from "../xml.tool.ts";

interface ReadNode { tag: string; attrs: Record<string, string>; children: ReadNode[]; text: string }
const decode = (raw: string): string => raw.replace(/&([^;]+);/g, (_, entity: string) => {
  const known: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  if (!(entity in known)) throw new Error(`unknown XML entity: ${entity}`);
  return known[entity]!;
});
/** Bounded test reader for our own element/attribute subset; rejects non-XML payloads. */
export function readOwnXml(source: string): ReadNode {
  if (source.length > 10_000_000 || /<!|<\?/.test(source.replace(/^<\?xml version="1\.0" encoding="UTF-8"(?: standalone="yes")?\?>\n/, "")))
    throw new Error("unsupported XML construct");
  const body = source.replace(/^<\?xml version="1\.0" encoding="UTF-8"(?: standalone="yes")?\?>\n/, "");
  const stack: ReadNode[] = []; let root: ReadNode | undefined; let at = 0;
  const token = /<\/?[A-Za-z_][A-Za-z0-9_.-]*(?:\s+[A-Za-z_][A-Za-z0-9_.-]*="[^"]*")*\s*\/?>/gy;
  while (at < body.length) {
    if (body[at] !== "<") {
      const next = body.indexOf("<", at); const end = next < 0 ? body.length : next;
      const text = body.slice(at, end);
      if (!stack.length && text.trim()) throw new Error("text outside root");
      if (stack.length) stack.at(-1)!.text += decode(text);
      at = end; continue;
    }
    token.lastIndex = at; const match = token.exec(body);
    if (!match) throw new Error("malformed XML token");
    at = token.lastIndex; const raw = match[0];
    if (raw.startsWith("</")) {
      const tag = raw.slice(2, -1);
      if (stack.pop()?.tag !== tag) throw new Error("XML close mismatch");
      continue;
    }
    const tag = /^<([\w.-]+)/.exec(raw)![1]!;
    const attrs: Record<string, string> = {};
    const attr = /([A-Za-z_][A-Za-z0-9_.-]*)="([^"]*)"/g; let item: RegExpExecArray | null;
    while ((item = attr.exec(raw))) {
      if (Object.hasOwn(attrs, item[1]!)) throw new Error("duplicate XML attribute");
      attrs[item[1]!] = decode(item[2]!);
    }
    const node: ReadNode = { tag, attrs, children: [], text: "" };
    if (stack.length) stack.at(-1)!.children.push(node);
    else if (!root) root = node;
    else throw new Error("multiple XML roots");
    if (!raw.endsWith("/>")) stack.push(node);
  }
  if (stack.length || !root) throw new Error("unclosed XML root");
  return root;
}

test("reader round trips entities and rejects malformed own-output forms", () => {
  const own = serialize(element("A", { Value: `A & <B> "C" 'D'` }));
  assert.equal(readOwnXml(own).attrs.Value, `A & <B> "C" 'D'`);
  for (const bad of ['<A X="1" X="2" />', '<A X="&unknown;" />', '<A></B>', '<!DOCTYPE A><A />'])
    assert.throws(() => readOwnXml(bad));
});
