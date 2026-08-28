import assert from "node:assert/strict";
import {
  MAX_STAGES,
  continueFromReport,
  createGame,
  installCar,
  moveCar,
  revealReport,
  runBattle,
  skipReward,
} from "../scrapline/engine.mjs";

const seed = 6;

const heavyMoltenPlan = {
  name: "重弾・溶解型",
  orders: [
    ["charge"],
    ["charge", "accelerator"],
    ["charge", "accelerator", "armor"],
    ["charge", "armor", "press", "accelerator"],
    ["charge", "melt", "armor", "press", "accelerator"],
    ["charge", "melt", "armor", "press", "accelerator"],
    ["charge", "melt", "armor", "press", "accelerator"],
  ],
  rewards: [
    { id: "accelerator" },
    { id: "armor" },
    { id: "press" },
    { id: "melt" },
    { id: "skip" },
    { id: "skip" },
  ],
};

const splitReturnPlan = {
  name: "分裂・帰還型",
  orders: [
    ["charge"],
    ["charge", "accelerator"],
    ["charge", "accelerator", "cut"],
    ["charge", "accelerator", "magnet"],
    ["charge", "accelerator", "magnet", "reverse"],
    ["charge", "accelerator", "magnet", "reverse", "cut"],
    ["collector", "magnet", "reverse", "cut", "accelerator"],
  ],
  rewards: [
    { id: "accelerator" },
    { id: "cut" },
    { id: "magnet" },
    { id: "reverse" },
    { id: "cut" },
    { id: "collector", slot: 0 },
  ],
};

function arrange(state, order) {
  assert.deepEqual(new Set(state.activeCars), new Set(order), `stage ${state.stage + 1} uses only owned cars`);
  assert.equal(state.activeCars.length, order.length);
  let next = state;
  for (let target = 0; target < order.length; target += 1) {
    const from = next.activeCars.indexOf(order[target]);
    if (from !== target) next = moveCar(next, from, target);
  }
  assert.deepEqual(next.activeCars, order);
  return next;
}

function mechanisms(reports) {
  const events = reports.flatMap((report) => report.events);
  return new Set([
    ...(events.some((event) => event.projectile?.compressed && event.damage > 0) ? ["heavy"] : []),
    ...(events.some((event) => ["impact", "impact_splash"].includes(event.type) && event.projectile?.mode === "molten" && event.damage > 0) ? ["molten"] : []),
    ...(events.some((event) => event.type === "car" && event.carId === "cut" && event.afterProjectiles?.length > event.beforeProjectiles?.length) ? ["split"] : []),
    ...(events.some((event) => event.type === "return_reprocess" && event.projectiles?.length) ? ["return"] : []),
  ]);
}

function play(plan) {
  let state = createGame(seed);
  const reports = [];
  for (let stage = 0; stage < MAX_STAGES; stage += 1) {
    state = arrange(state, plan.orders[stage]);
    const battle = runBattle(state);
    assert.equal(battle.report.won, true, `${plan.name} clears stage ${stage + 1}`);
    reports.push(battle.report);
    state = battle.state;
    if (state.done) break;

    state = continueFromReport(revealReport(state));
    const reward = plan.rewards[stage];
    if (reward.id === "skip") {
      state = skipReward(state);
    } else {
      assert.ok(state.offers.some((offer) => offer.id === reward.id), `${reward.id} was actually offered at stage ${stage + 1}`);
      state = installCar(state, reward.id, reward.slot ?? null);
    }
  }
  return { state, reports, mechanisms: mechanisms(reports) };
}

const heavy = play(heavyMoltenPlan);
const returning = play(splitReturnPlan);

assert.equal(heavy.state.done && heavy.state.won && heavy.state.stage, MAX_STAGES);
assert.equal(returning.state.done && returning.state.won && returning.state.stage, MAX_STAGES);
assert.deepEqual(
  heavy.state.battleHistory.map((entry) => entry.challenge),
  returning.state.battleHistory.map((entry) => entry.challenge),
  "both runs face the same seeded encounter order",
);
assert.ok(heavy.mechanisms.has("heavy") && heavy.mechanisms.has("molten"));
assert.ok(!heavy.mechanisms.has("return"));
assert.ok(returning.mechanisms.has("split") && returning.mechanisms.has("return"));
assert.ok(!returning.mechanisms.has("heavy") && !returning.mechanisms.has("molten"));

const adopted = (state) => state.carHistory.filter((entry) => ["append", "replace"].includes(entry.action)).map((entry) => entry.carId);
const moves = (state) => state.carHistory.filter((entry) => entry.action === "move").map((entry) => `${entry.stage}:${entry.carId}:${entry.from}>${entry.to}`);
assert.notDeepEqual(adopted(heavy.state), adopted(returning.state), "the two paths adopt different salvage");
assert.ok(moves(heavy.state).length > 0 && moves(returning.state).length > 0, "both complete runs contain authored rearrangement");
assert.notDeepEqual(moves(heavy.state), moves(returning.state), "the rearrangement histories are qualitatively different");
assert.notDeepEqual(heavy.state.activeCars, returning.state.activeCars);

console.log("scrapline run diversity smoke ok", JSON.stringify({
  seed,
  heavy: { train: heavy.state.activeCars, mechanisms: [...heavy.mechanisms], rewards: adopted(heavy.state), moves: moves(heavy.state).length },
  returning: { train: returning.state.activeCars, mechanisms: [...returning.mechanisms], rewards: adopted(returning.state), moves: moves(returning.state).length },
}));
