import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GAME_VERSION,
  PARTS,
  SCENES,
  SLOT_KEYS,
  offersFor,
  sceneFor,
  useFor,
  evaluateBuild
} from "../kindling/app-runtime.mjs";

assert.equal(GAME_VERSION, "kindling-0.1");
assert.equal(SCENES.length, 6);
assert.equal(SLOT_KEYS.length, 4);
assert.ok(PARTS.length >= 10);

for (const part of PARTS) {
  assert.equal(Object.keys(part.uses).length, SLOT_KEYS.length);
  for (const slotKey of SLOT_KEYS) {
    const use = useFor(part.id, slotKey);
    assert.ok(use && use.stat && use.value > 0, part.id + " / " + slotKey);
  }
}

for (const seed of [6, 12, 20260826]) {
  for (let stage = 0; stage < SCENES.length; stage += 1) {
    const first = sceneFor(stage, seed);
    const second = sceneFor(stage, seed);
    assert.deepEqual(first.options.map((route) => route.id), second.options.map((route) => route.id));
    assert.equal(first.options.length, 2);
    assert.ok(first.options.every((route) => route.req && route.name && route.success));

    for (const route of first.options) {
      const state = {
        stage,
        seed,
        routeChoice: route.id,
        slots: ["button", "nail", null, null]
      };
      const offers = offersFor(state);
      assert.equal(offers.length, 2);
      assert.notEqual(offers[0], offers[1]);
      assert.ok(offers.every((id) => PARTS.some((part) => part.id === id)));
      assert.deepEqual(offers, offersFor(state));
    }
  }
}

const appSource = readFileSync(new URL("../kindling/app.js", import.meta.url), "utf8");
assert.ok(appSource.includes("scene-canvas"));
assert.ok(appSource.includes("send(state)"));
assert.ok(!/\b(alert|prompt|confirm)\s*\(/.test(appSource), "native browser dialogs are not allowed");

let passCount = 0;
let failCount = 0;
let comboCount = 0;
const candidateParts = PARTS.slice(0, 10).map((part) => part.id);
for (let a = 0; a < candidateParts.length; a += 1) {
  for (let b = 0; b < candidateParts.length; b += 1) {
    for (let c = 0; c < candidateParts.length; c += 1) {
      for (let d = 0; d < candidateParts.length; d += 1) {
        const result = evaluateBuild([candidateParts[a], candidateParts[b], candidateParts[c], candidateParts[d]], SCENES[0].routes[0]);
        if (result.passed) passCount += 1;
        else failCount += 1;
        if (result.combos.length) comboCount += 1;
      }
    }
  }
}
assert.ok(passCount > 0, "at least one build must pass");
assert.ok(failCount > 0, "at least one build must fail");
assert.ok(comboCount > 0, "some builds must create visible combos");

console.log("kindling smoke ok", JSON.stringify({
  scenes: SCENES.length,
  parts: PARTS.length,
  candidateBuilds: passCount + failCount,
  passingBuilds: passCount,
  failingBuilds: failCount,
  comboBuilds: comboCount
}));
