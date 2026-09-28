import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHostArgv, parseStrictJson, validatePluginConfig, validatePluginRequest, validatePluginResponse, validatePluginUse, PLUGIN_PROTOCOL } from "./contract.schema.ts";

function rejects(fn: () => unknown): void { assert.throws(fn, { code: "E_INPUT" }); }

test("strict JSON rejects duplicate keys at nested levels", () => {
  rejects(() => parseStrictJson('{"plugins":{"a":{"path":"/tmp/a","path":"/tmp/b"}}}'));
  rejects(() => parseStrictJson('{"x":1} {"y":2}'));
  assert.deepEqual((parseStrictJson('{"a":[true,null,1.5]}') as { a: unknown[] }).a, [true, null, 1.5]);
});

test("host argv is an absolute executable and never inline code", () => {
  assert.deepEqual(parseHostArgv('["/usr/bin/python3","/tmp/bridge.py"]'), ["/usr/bin/python3", "/tmp/bridge.py"]);
  for (const value of ['"/usr/bin/python3"', '["python3"]', '["/usr/bin/python3","-c","print(1)"]',
    '["/usr/bin/python3","-m","evil"]', '["/usr/bin/python3","a\\u0000b"]']) rejects(() => parseHostArgv(value));
});

test("config uses only trusted allowlisted keys and bounded values", () => {
  const base = { version: 1, plugins: { a: { path: "/tmp/a" } } };
  assert.equal(validatePluginConfig(base).plugins["a"]?.timeoutMs, 60000);
  rejects(() => validatePluginConfig({ ...base, shell: true }));
  rejects(() => validatePluginConfig({ version: 2, plugins: {} }));
  rejects(() => validatePluginConfig({ version: 1, plugins: { a: { path: "relative" } } }));
  rejects(() => validatePluginConfig({ version: 1, plugins: { a: { path: "/tmp/a", timeoutMs: 999 } } }));
});

test("plugin parameters sort deterministically and reject unsafe values", () => {
  const use = validatePluginUse({ id: "a", params: { z: 1, a: false } });
  assert.deepEqual(Object.keys(use.params ?? {}), ["a", "z"]);
  rejects(() => validatePluginUse({ id: "A" }));
  rejects(() => validatePluginUse({ id: "a", command: ["/bin/sh"] }));
  rejects(() => validatePluginUse({ id: "a", params: { x: Infinity } }));
  rejects(() => validatePluginUse({ id: "a", params: { x: "é".repeat(129) } }));
  rejects(() => validatePluginUse({ id: "a", params: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`k${i}`, i])) }));
});

test("response requires an exact protocol, operation and result shape", () => {
  const probe = { protocol: PLUGIN_PROTOCOL, ok: true, op: "probe", hostVersion: "stub/1", capabilities: { audioEffect: true } };
  assert.equal(validatePluginResponse(probe, "probe").ok, true);
  rejects(() => validatePluginResponse({ ...probe, extra: 1 }, "probe"));
  rejects(() => validatePluginResponse({ ...probe, protocol: "bad" }, "probe"));
  rejects(() => validatePluginResponse(probe, "render"));
});

test("requests reject extra fields and unsupported MIDI input", () => {
  assert.equal(validatePluginRequest({ protocol: PLUGIN_PROTOCOL, op: "probe" }).op, "probe");
  rejects(() => validatePluginRequest({ protocol: PLUGIN_PROTOCOL, op: "probe", command: ["/bin/sh"] }));
  rejects(() => validatePluginRequest({ protocol: PLUGIN_PROTOCOL, op: "scan" }));
});
