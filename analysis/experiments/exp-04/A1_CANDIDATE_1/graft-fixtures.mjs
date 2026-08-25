import assert from 'node:assert/strict';
import {
  ACTIONS,
  MUTATIONS,
  battleStart,
  emptyMutations,
  step,
  withEnemy,
} from './graft-core.mjs';
import { GraftSolver, evaluateSeed, gateEPassFromUsefulTargets } from './graft-evaluator.mjs';
import { simulateOracle } from './graft-oracle.mjs';

function mutationMap(action, mutation) {
  const map = emptyMutations();
  map[action] = mutation;
  return map;
}

function simulateCore({ hp, enemyHp, attacks, mutations, actions }) {
  const enemy = { hp: enemyHp, attacks };
  let state = withEnemy(battleStart({ hp, mutations }, enemy), enemy);
  const records = [];
  for (const action of actions) {
    const result = step(state, action);
    records.push(result.record);
    if (result.status !== 'ongoing') {
      return { status: result.status, hp: result.state.hp, enemyHp: result.state.enemyHp, energy: result.state.energy, records };
    }
    state = result.state;
  }
  return { status: 'incomplete', hp: state.hp, enemyHp: state.enemyHp, energy: state.energy, records, state };
}

function manualRecords(result) {
  return result.records.filter((record) => record.action !== null);
}

function testNineAttachmentsAndOracle() {
  const fixture = [];
  for (const action of ACTIONS) {
    for (const mutation of MUTATIONS) {
      const actions = action === 'generate'
        ? (mutation === 'recoil' ? ['generate', 'attack', 'generate'] : ['generate', 'generate', 'attack'])
        : action === 'attack'
          ? ['generate', 'attack', 'defend']
          : ['generate', 'defend', 'attack'];
      const input = {
        hp: 50,
        enemyHp: 100,
        attacks: [0, 0, 0, 0, 0, 0],
        mutations: mutationMap(action, mutation),
        actions,
      };
      const core = simulateCore(input);
      const oracle = simulateOracle(input);
      assert.equal(core.status, oracle.status, `${mutation}/${action} status`);
      assert.equal(core.hp, oracle.hp, `${mutation}/${action} hp`);
      assert.equal(core.enemyHp, oracle.enemyHp, `${mutation}/${action} enemy HP`);
      assert.equal(core.energy, oracle.energy, `${mutation}/${action} energy`);
      fixture.push({ mutation, action, core, oracle });
    }
  }

  const expectedRecoil = { generate: 4, attack: 10, defend: 14 };
  const expectedEcho = { generate: [2, 1], attack: [5, 3], defend: [7, 4] };
  const expectedTinderFollowUp = { generate: 8, attack: 11, defend: 8 };
  for (const row of fixture) {
    const manual = manualRecords(row.core);
    const firstTargetUse = manual.find((record) => record.action === row.action);
    if (row.mutation === 'recoil') assert.equal(firstTargetUse.amount, expectedRecoil[row.action], `recoil ${row.action}`);
    if (row.mutation === 'echo') {
      assert.equal(firstTargetUse.amount, expectedEcho[row.action][0], `echo manual ${row.action}`);
      const echo = row.core.records.find((record) => record.echo?.action === row.action);
      assert.equal(echo.echo.amount, expectedEcho[row.action][1], `echo amount ${row.action}`);
    }
    if (row.mutation === 'tinder') {
      const targetIndex = manual.findIndex((record) => record.action === row.action);
      const later = manual.slice(targetIndex + 1).find((record) => record.action !== row.action);
      assert.equal(later.amount, expectedTinderFollowUp[row.action], `tinder follow-up ${row.action}`);
    }
  }
}

function testTimingAndNonChain() {
  const recoil = simulateCore({
    hp: 50, enemyHp: 100, attacks: [0, 0, 0, 0, 0, 0],
    mutations: mutationMap('generate', 'recoil'), actions: ['generate', 'attack', 'generate'],
  });
  assert.equal(manualRecords(recoil)[0].amount, 4);
  assert.equal(manualRecords(recoil)[1].action, 'attack', 'recoil blocks only the immediately following generate');
  assert.equal(manualRecords(recoil)[2].action, 'generate', 'the block is cleared after one turn');

  const tinder = simulateCore({
    hp: 50, enemyHp: 100, attacks: [0, 0, 0, 0, 0, 0],
    mutations: mutationMap('generate', 'tinder'), actions: ['generate', 'generate', 'attack'],
  });
  const tinderManual = manualRecords(tinder);
  assert.equal(tinderManual[2].amount, 8, 'repeating tinder neither consumes nor stacks it');

  const echo = simulateCore({
    hp: 50, enemyHp: 100, attacks: [0, 0, 0, 0, 0, 0],
    mutations: mutationMap('attack', 'echo'), actions: ['generate', 'attack', 'generate'],
  });
  assert.equal(echo.records.filter((record) => record.echo?.action === 'attack').length, 1, 'one manual echo schedules one start-of-turn effect');
  assert.equal(echo.state.echo, null, 'the automatic attack echo did not schedule another echo');
}

function easyRun(overrides = {}) {
  return {
    initialHp: 50,
    enemies: Array.from({ length: 4 }, () => ({ hp: 5, attacks: [0, 0, 0, 0, 0, 0] })),
    offers: [['recoil', 'echo'], ['recoil', 'tinder'], ['echo', 'tinder']],
    ...overrides,
  };
}

function firstBoundary(run) {
  const solver = new GraftSolver(run);
  const persistent = { hp: run.initialHp, mutations: emptyMutations() };
  const outcome = solver.outcomes(persistent, 0).find((candidate) => candidate.status === 'won');
  return { solver, boundary: { hp: outcome.state.hp, mutations: { ...persistent.mutations } } };
}

function testNegativeGateFixtures() {
  // Gate A: an intentionally wrong implementation of echo-attack rounding must
  // disagree with the checked semantic fixture (5 * 0.5 rounds to 3, not 2).
  const echoAttack = simulateCore({
    hp: 50, enemyHp: 100, attacks: [0, 0, 0, 0, 0, 0],
    mutations: mutationMap('attack', 'echo'), actions: ['generate', 'attack', 'generate'],
  });
  const storedEcho = echoAttack.records.find((record) => record.echo?.action === 'attack').echo.amount;
  assert.notEqual(storedEcho, 2, 'Gate A negative: truncating echo attack must be rejected');

  // Gate B: both offered mutations have no target that can win the next battle.
  const deadNext = easyRun({
    enemies: [
      { hp: 5, attacks: [0, 0, 0, 0, 0, 0] },
      { hp: 31, attacks: [0, 0, 0, 0, 0, 0] },
      { hp: 5, attacks: [0, 0, 0, 0, 0, 0] },
      { hp: 5, attacks: [0, 0, 0, 0, 0, 0] },
    ],
    offers: [['echo', 'tinder'], ['recoil', 'tinder'], ['recoil', 'echo']],
  });
  const bDead = firstBoundary(deadNext).solver.checkOffer(firstBoundary(deadNext).boundary, 0);
  assert.equal(bDead.gateB, false, 'Gate B negative: dead reward offer is rejected');

  // Gate C: when every attachment only raises unused numbers, the optimal action
  // sequence remains generate>attack; no reward is accepted as a C witness.
  const flat = firstBoundary(easyRun());
  const flatCheck = flat.solver.checkOffer(flat.boundary, 0);
  assert.equal(flatCheck.gateB, true);
  assert.equal(flatCheck.gateF, true);
  assert.equal(flatCheck.gateC, false, 'Gate C negative: a numeric-only upgrade is rejected');

  // Gate D: a generated reference that a fixed policy can complete is rejected.
  const policyBad = evaluateSeed(15);
  assert.equal(policyBad.gateD, false, 'Gate D negative: fixed charge/attack clears this run');
  assert.equal(policyBad.fixedPolicies['charge-then-attack'], true);

  // Gate E: a fixed one-target mapping is rejected by the same threshold used
  // by the reachability evaluator. This isolates E rather than inheriting a
  // prior B/C/D failure from an unrelated bad run.
  const fixedMapping = Object.fromEntries(['recoil', 'echo', 'tinder'].map((mutation) => [
    mutation,
    new Map([['attack', { forced: true }]]),
  ]));
  assert.equal(gateEPassFromUsefulTargets(fixedMapping), false, 'Gate E negative: fixed attachment mapping is rejected');

  // Gate F: both current mutations can win the immediately displayed battle, but
  // a later 60-HP battle makes every continuation impossible.
  const hiddenTrap = easyRun({
    enemies: [
      { hp: 5, attacks: [0, 0, 0, 0, 0, 0] },
      { hp: 5, attacks: [0, 0, 0, 0, 0, 0] },
      { hp: 60, attacks: [0, 0, 0, 0, 0, 0] },
      { hp: 5, attacks: [0, 0, 0, 0, 0, 0] },
    ],
    offers: [['echo', 'tinder'], ['recoil', 'tinder'], ['recoil', 'echo']],
  });
  const trap = firstBoundary(hiddenTrap);
  const trapCheck = trap.solver.checkOffer(trap.boundary, 0);
  assert.equal(trapCheck.gateB, true);
  assert.equal(trapCheck.gateF, false, 'Gate F negative: a hidden future dead end is rejected');
}

function testDeterminism() {
  const left = evaluateSeed(3);
  const right = evaluateSeed(3);
  assert.deepEqual(left, right, 'same seed and choices must produce the same certificate');
}

testNineAttachmentsAndOracle();
testTimingAndNonChain();
testNegativeGateFixtures();
testDeterminism();

console.log(JSON.stringify({
  fixture: 'pass',
  checks: [
    'all 9 mutation/action pairs',
    'rounding/timing/lock/non-chain',
    'independent oracle comparison',
    'negative Gate A-F fixtures',
    'deterministic seed certificate',
  ],
}, null, 2));
