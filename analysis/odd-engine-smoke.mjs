import { strict as assert } from "node:assert";
import {
  COMMANDS,
  MAX_STAGES,
  SLOT_COUNT,
  chooseCommand,
  createGame,
  installOffer,
  preview,
  selectOffer,
  summary
} from "../odd-engine/engine.mjs";

for (const seed of [1, 12, 42, 20260826, 999999]) {
  let state = createGame(seed);
  assert.equal(state.stages.length, MAX_STAGES);
  assert.equal(state.parts.length, SLOT_COUNT);
  assert.equal(state.offer.length, 2);

  for (const command of COMMANDS) {
    const item = preview(state, command.id);
    assert.equal(item.evaluation.passed, item.evaluation.value >= item.evaluation.required);
    assert.ok(Array.isArray(item.output.trace));
  }

  state = selectOffer(state, 0).state;
  state = installOffer(state, 0).state;
  state = chooseCommand(state, "steady").state;
  assert.equal(state.stage, 1);
  assert.equal(summary(state).parts.length, SLOT_COUNT);
}

console.log("odd-engine smoke: seed / offer / preview / install / command OK");
