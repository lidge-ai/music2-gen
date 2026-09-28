import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { probePluginHost, probeConfiguredPlugins } from "./detect.tool.ts";

const fixture = fileURLToPath(new URL("../../tests/fixtures/plugin-host/stub-host.mjs", import.meta.url));

test("probe accepts the fixed stub capability and rejects stale versions", async () => {
  const good = await probePluginHost([process.execPath, fixture]);
  assert.equal(good.available, true);
  assert.equal(good.hostVersion, "stub/1");
  const old = await probePluginHost([process.execPath, fixture, "old-pedalboard"]);
  assert.deepEqual({ available: old.available, reason: old.reason }, { available: false, reason: "E_CAPABILITY" });
});

test("probe handles invalid protocol, missing host and timeout", async () => {
  assert.equal((await probePluginHost([process.execPath, fixture, "bad-protocol"])).reason, "E_RENDER");
  assert.equal((await probePluginHost(["/missing/music2-host"])).reason, "E_CAPABILITY");
  assert.equal((await probePluginHost([process.execPath, fixture, "delay"], 100)).reason, "E_TIMEOUT");
});

test("configured IDs reuse one per-call probe result", async () => {
  const config = { version: 1 as const, plugins: {
    a: { path: "/tmp/a", pluginName: null, timeoutMs: 1000, command: [process.execPath, fixture] },
    b: { path: "/tmp/b", pluginName: null, timeoutMs: 1000, command: [process.execPath, fixture] },
  } };
  const results = await probeConfiguredPlugins(config);
  assert.equal(results["a"]?.available, true);
  assert.deepEqual(results["a"], results["b"]);
});
