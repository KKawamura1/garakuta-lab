import assert from "node:assert/strict";
import { simulateBattle, validateBattleInput, validateContentBundle } from "./engine.mjs";
import { PLAYABLE_CONTENT } from "./playable-content.mjs";
import { DOCTRINES, makeBattle } from "./playable-battles.mjs";

const contentErrors = validateContentBundle(PLAYABLE_CONTENT);
assert.deepEqual(contentErrors, [], `content errors: ${JSON.stringify(contentErrors)}`);
assert.deepEqual(Object.keys(DOCTRINES), ["guard", "rhythm", "overflow"]);

for (const stage of [1, 2, 3]) {
  const battle = makeBattle(stage, ["guard", "rhythm", "overflow"]);
  const inputErrors = validateBattleInput(battle, PLAYABLE_CONTENT);
  assert.deepEqual(inputErrors, [], `stage ${stage} errors: ${JSON.stringify(inputErrors)}`);
  const first = simulateBattle(battle, PLAYABLE_CONTENT);
  const second = simulateBattle(battle, PLAYABLE_CONTENT);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "ecology-result-1");
  assert.ok(first.events.length > 0);
}

console.log("playable slice: content, 3 stages, and deterministic replay passed");
