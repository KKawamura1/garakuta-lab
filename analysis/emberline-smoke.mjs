import assert from "node:assert/strict";
import {
  MAX_STAGES,
  SLOT_COUNT,
  createGame,
  currentChallenge,
  currentOffers,
  installModule,
  moveSlot,
  runStage,
  skipOffer,
  simulateStage
} from "../emberline/engine.mjs";

const first = createGame(12);
const same = createGame(12);
assert.deepEqual(first, same, "same seed must create the same questions and offers");
assert.equal(first.challenges.length, MAX_STAGES);
assert.equal(first.slots.length, SLOT_COUNT);
assert.equal(currentOffers(first).length, 3);
assert.equal(currentChallenge(first).id, "fog");

let state = first;
let placed = installModule(state, currentOffers(state)[0].id, 1);
assert.equal(placed.result.ok, true);
state = placed.state;
assert.equal(state.ready, true);
const moved = moveSlot(state, 0, 1);
assert.equal(moved.result.ok, true);
state = moved.state;
const battle = runStage(state);
assert.equal(battle.result.ok, true);
state = battle.state;
assert.equal(state.history.length, 1);
assert.ok(state.stageResult.log.length >= 2);
assert.equal(state.phase, "battle");

const next = skipOffer(state);
assert.equal(next.result.ok, false, "cannot choose before leaving the battle report");
console.log("emberline smoke passed");
