import assert from "node:assert/strict";
import test from "node:test";
import { element, formatAlsNumber, serialize, serializeXml, value } from "./xml.tool.ts";

test("ordered XML attributes, five entities, LF and numeric precision", () => {
  const root = element("Root", [["Second", 2], ["First", `A & <B> "C" 'D'`]], [value("Beat", 1 / 960), "x & y"]);
  const output = serialize(root, { declaration: true });
  assert.equal(output, '<?xml version="1.0" encoding="UTF-8"?>\n<Root Second="2" First="A &amp; &lt;B&gt; &quot;C&quot; &apos;D&apos;">\n  <Beat Value="0.0010416666666666667" />\n  x &amp; y\n</Root>\n');
  assert.deepEqual(serializeXml(root), Buffer.from(output));
  assert.equal(formatAlsNumber(-0), "0");
  assert.equal(formatAlsNumber(1e-7), "0.0000001");
});
test("XML rejects invalid characters, names, duplicate attributes and nonfinite numbers", () => {
  for (const bad of ["\0", "\ud800", "\udc00", "a\u0001b"]) assert.throws(() => serialize(element("A", { Value: bad })));
  assert.throws(() => element("1Bad"));
  assert.throws(() => element("A", [["Id", 1], ["Id", 2]]));
  for (const number of [NaN, Infinity, -Infinity]) assert.throws(() => element("A", { Value: number }));
});
