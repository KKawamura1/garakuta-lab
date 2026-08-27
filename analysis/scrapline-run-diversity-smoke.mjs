import assert from "node:assert/strict";
import {
  MAX_STAGES,
  createGame,
  continueFromReport,
  installCar,
  runBattle,
  skipReward,
} from "../scrapline/engine.mjs";

function playPath(orders, rewards) {
  let state = createGame(0);
  for (let stage = 0; stage < orders.length; stage += 1) {
    const result = runBattle({ ...state, activeCars: orders[stage], phase: "build" });
    assert.equal(result.report.won, true, `witness path clears stage ${stage + 1}`);
    state = result.state;
    if (state.done) break;
    state = continueFromReport(state);
    const reward = rewards[stage];
    if (reward === "skip") {
      state = skipReward(state);
    } else {
      assert.ok(state.offers.some((offer) => offer.id === reward), `witness reward ${reward} is offered at stage ${stage + 1}`);
      state = installCar(state, reward);
    }
  }
  return state;
}

const sharedOrders = [
  ["charge"],
  ["charge", "magnet"],
  ["charge", "magnet", "melt"],
  ["charge", "melt", "armor", "magnet"],
  ["charge", "melt", "armor", "accelerator"],
  ["charge", "melt", "armor", "accelerator"],
];
const rewards = ["magnet", "melt", "armor", "accelerator", "skip", "magnet"];
const first = playPath([...sharedOrders, ["accelerator", "magnet", "melt", "charge", "armor"]], rewards);
const second = playPath([...sharedOrders, ["accelerator", "magnet", "melt", "armor", "charge"]], rewards);

assert.equal(first.done && first.won && first.stage, MAX_STAGES);
assert.equal(second.done && second.won && second.stage, MAX_STAGES);
assert.notDeepEqual(first.activeCars, second.activeCars, "two different final train arrangements are reachable");

console.log("scrapline run diversity smoke ok", JSON.stringify({
  seed: 0,
  first: first.activeCars,
  second: second.activeCars,
}));
