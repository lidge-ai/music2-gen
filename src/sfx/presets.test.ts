import test from "node:test";
import assert from "node:assert/strict";
import { GAME_PARAMS, GAME_PRESETS, SFX_PRESETS, TRANSITION_ATOMS, drawPreset } from "./presets.tool.ts";
import { resolveSfx } from "./sfx.schema.ts";

test("preset order and randomized physical-unit ranges", () => {
  assert.deepEqual(SFX_PRESETS, [...TRANSITION_ATOMS, ...GAME_PRESETS]);
  assert.equal(SFX_PRESETS.length, 21);
  for (const preset of GAME_PRESETS) {
    for (const seed of [0, 1, 271828, 0xffffffff]) {
      const result = resolveSfx({ preset, seed });
      for (const [key, value] of Object.entries(result.params)) {
        const spec = GAME_PARAMS[key]!;
        assert.ok(value >= (preset === "laser" && key === "slide" ? -14 : spec.min) &&
          value <= spec.max, `${preset}.${key}=${value}`);
      }
      assert.deepEqual(result.params, resolveSfx({ preset, seed }).params);
    }
    assert.notDeepEqual(drawPreset(preset, 1), drawPreset(preset, 2), preset);
  }
});

test("overrides do not advance preset PRNG or reorder keys", () => {
  const base = resolveSfx({ preset: "pickup", seed: 17 });
  const changed = resolveSfx({ preset: "pickup", seed: 17, params: { jump: 7 } });
  assert.equal(changed.params.fstart, base.params.fstart);
  assert.equal(changed.params.slide, base.params.slide);
  assert.equal(changed.params.jump, 7);
  assert.deepEqual(Object.keys(changed.params), Object.keys(base.params));
});

test("version-1 seeded draw-order vector", () => {
  assert.deepEqual(drawPreset("pickup", 1), {
    wave: 0, fstart: 755.3127208724618, slide: 3.5787124515045434,
    sustain: .06827177664265036, decay: .12089700065087527,
    punch: .12202129177749158, jump: 5.469024925027043,
    tArp: .06702211007941514,
  });
});
