import assert from "node:assert/strict";
import { makeState, step } from "./graft-core.mjs";

function run(overrides, actions) {
  let state = makeState(overrides);
  for (const action of actions) {
    if (state.status !== "active") break;
    state = step(state, action);
  }
  return state;
}

function manualAmounts(state, action) {
  return state.trace
    .filter((event) => event.event === "effect" && event.source === "manual" && event.action === action)
    .map((event) => event.amount);
}

function echoAmounts(state, action) {
  return state.trace
    .filter((event) => event.event === "effect" && event.source === "echo" && event.action === action)
    .map((event) => event.amount);
}

// Recoil: benefit doubles, the input cost stays one, and only the immediately following
// turn prohibits the same action.
{
  const generated = run({ mutations: { generate: "recoil" }, enemyHp: 99 }, ["generate", "attack", "generate"]);
  assert.deepEqual(manualAmounts(generated, "generate"), [4, 4]);
  assert.equal(generated.energy, 7);

  const justGenerated = run({ mutations: { generate: "recoil" }, enemyHp: 99 }, ["generate"]);
  assert.throws(() => step(justGenerated, "generate"), /illegal action generate/);

  const attacked = run({ energy: 3, mutations: { attack: "recoil" }, enemyHp: 99 }, ["attack", "defend", "attack"]);
  assert.deepEqual(manualAmounts(attacked, "attack"), [10, 10]);
  assert.equal(attacked.energy, 0);

  const defended = run({ energy: 2, mutations: { defend: "recoil" }, enemyHp: 99, enemyAttacks: [20, 5] }, ["defend", "attack"]);
  assert.deepEqual(manualAmounts(defended, "defend"), [14]);
  assert.equal(defended.hp, 9);
}

// Negative legality fixture: an energy-consuming action cannot be selected at zero energy.
{
  assert.throws(() => step(makeState({ energy: 0 }), "attack"), /illegal action attack/);
  assert.throws(() => step(makeState({ energy: 0 }), "defend"), /illegal action defend/);
}

// Echo: 50% uses half-up integer rounding (5 -> 3, 7 -> 4), is automatic and free,
// and never schedules a second echo.
{
  const generated = run({ mutations: { generate: "echo" }, enemyHp: 99 }, ["generate", "attack"]);
  assert.deepEqual(echoAmounts(generated, "generate"), [1]);
  assert.equal(generated.pendingEcho, null);

  const attacked = run({ energy: 1, mutations: { attack: "echo" }, enemyHp: 99 }, ["attack", "generate"]);
  assert.deepEqual(echoAmounts(attacked, "attack"), [3]);
  assert.equal(attacked.energy, 2);

  const defended = run({ energy: 1, mutations: { defend: "echo" }, enemyHp: 99, enemyAttacks: [10, 10] }, ["defend", "generate"]);
  assert.deepEqual(echoAmounts(defended, "defend"), [4]);
  assert.equal(defended.hp, 11);
}

// Kindling: the same action leaves the one-slot effect armed; the next different manual
// action consumes it. All three receiving effects use the specified 150% rounding.
{
  const boostGenerate = run({ mutations: { attack: "kindling" }, energy: 1, enemyHp: 99 }, ["attack", "generate"]);
  assert.deepEqual(manualAmounts(boostGenerate, "generate"), [3]);

  const boostAttack = run({ mutations: { generate: "kindling" }, energy: 0, enemyHp: 99 }, ["generate", "attack"]);
  assert.deepEqual(manualAmounts(boostAttack, "attack"), [8]);

  const boostDefend = run({ mutations: { generate: "kindling" }, enemyHp: 99, enemyAttacks: [0, 20] }, ["generate", "defend"]);
  assert.deepEqual(manualAmounts(boostDefend, "defend"), [11]);

  const sameThenDifferent = run({ mutations: { generate: "kindling" }, enemyHp: 99 }, ["generate", "generate", "attack"]);
  assert.deepEqual(manualAmounts(sameThenDifferent, "attack"), [8]);
  assert.equal(sameThenDifferent.pendingKindling, null);
}

// An echo attack that kills at turn start skips both the manual action and enemy attack.
{
  const state = run({
    energy: 1,
    enemyHp: 8,
    hp: 20,
    enemyAttacks: [0, 99],
    mutations: { attack: "echo" },
  }, ["attack", "generate"]);
  assert.equal(state.status, "won");
  assert.deepEqual(state.actions, ["attack"]);
  assert.equal(state.hp, 20);
}

// Determinism: identical state and actions produce byte-identical state and trace.
{
  const input = {
    energy: 1,
    enemyHp: 40,
    enemyAttacks: [4, 9, 3, 12, 2, 8],
    mutations: { generate: "kindling", attack: "echo", defend: "recoil" },
  };
  assert.deepEqual(run(input, ["generate", "attack", "generate"]), run(input, ["generate", "attack", "generate"]));
}

console.log("preflight: PASS (9 attachment effects, timing, rounding, cooldown, non-chain, determinism)");
