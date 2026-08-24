import { strict as assert } from "node:assert";
import {
  INITIAL_PARTS, MAX_HP, MAX_TURNS, PARTS, evaluateBattle, evaluateReferences,
  evaluateRewardChoice, evaluateSeed, generateEnemies, offerFor, replacementLoadouts,
  simulateBattle, bestWinningOutcome, enumerateBattle, simplePolicy
} from "../core/control.mjs";

function runGateA() {
  const tests = [];
  const check = (name, fn) => {
    fn(); tests.push(name);
  };

  check("same input is deterministic", () => {
    const enemy = { hp: 30, atk: 4, maxTurns: MAX_TURNS };
    const a = simulateBattle({ parts: INITIAL_PARTS, enemy, actions: ["generator", "nail", "deflector"] });
    const b = simulateBattle({ parts: INITIAL_PARTS, enemy, actions: ["generator", "nail", "deflector"] });
    assert.deepEqual(a, b);
  });
  check("energy shortage blocks a part", () => {
    const r = simulateBattle({ parts: ["nail"], enemy: { hp: 5, atk: 0 }, actions: ["nail"] });
    assert.equal(r.legal, false);
  });
  check("collapse is unavailable on the next turn", () => {
    const r = simulateBattle({ parts: ["collapse", "generator"], enemy: { hp: 999, atk: 0 }, actions: ["collapse", "collapse"] });
    assert.equal(r.legal, false);
  });
  check("capacitor bonus is consumed by one next attack", () => {
    const r = simulateBattle({ parts: ["generator", "capacitor", "nail"], enemy: { hp: 999, atk: 0 }, actions: ["generator", "capacitor", "nail", "generator", "nail"] });
    assert.equal(r.legal, true);
    assert.equal(r.log.filter(x => x.action === "nail")[0].damage, 10);
    assert.equal(r.log.filter(x => x.action === "nail")[1].damage, 5);
  });
  check("follow is half effect and cannot follow itself", () => {
    const r = simulateBattle({ parts: ["generator", "follow"], enemy: { hp: 999, atk: 0 }, actions: ["generator", "follow", "follow"] });
    assert.equal(r.legal, false);
    const first = simulateBattle({ parts: ["generator", "follow"], enemy: { hp: 999, atk: 0 }, actions: ["generator", "follow"] });
    assert.equal(first.log[1].energy, 1);
  });
  check("log state agrees with returned state", () => {
    const r = simulateBattle({ parts: INITIAL_PARTS, enemy: { hp: 5, atk: 0 }, actions: ["generator", "nail"] });
    const last = r.log.at(-1);
    assert.equal(last.hpAfter, r.hp);
    assert.equal(last.enemyHpAfter, r.enemyHp);
    assert.ok(r.log.every(x => Number.isInteger(x.hpAfter) && Number.isInteger(x.enemyHpAfter)));
  });
  check("replay is the calculation-level reload contract", () => {
    const request = { parts: INITIAL_PARTS, enemy: { hp: 25, atk: 3 }, actions: ["generator", "deflector", "generator", "nail"] };
    assert.deepEqual(simulateBattle(request), simulateBattle(request));
  });
  return { pass: true, tests, count: tests.length };
}

function runGateB(seed) {
  const result = evaluateSeed(seed);
  const battles = result.path.battles.map(b => ({
    battle: b.battleIndex,
    parts: b.loadout,
    enemy: b.enemy,
    hpStart: b.hpStart,
    totalSequences: b.metrics.total,
    winningSequences: b.metrics.wins,
    randomWinRate: Number(b.metrics.randomWinRate.toFixed(6)),
    usesTwoTypes: b.metrics.usesTwoTypes,
    initialActionChanges: b.metrics.initialActionChanges,
    best: b.metrics.best ? { actions: b.metrics.best.actions, hp: b.metrics.best.hp, turns: b.metrics.best.turns } : null
  }));
  return { pass: result.gateB, seed, complete: result.path.complete, battles };
}

function runGateC(seed) {
  const result = evaluateSeed(seed);
  const choices = result.path.battles.slice(0, 2).map(b => ({
    battle: b.battleIndex,
    offer: offerFor(seed, b.battleIndex, b.loadout),
    choices: evaluateRewardChoice(seed, b.battleIndex, b.loadout, b.metrics.best?.hp ?? b.hpStart, result.path.enemies[b.battleIndex]).map(choice => ({
      reward: choice.reward,
      viableLoadouts: choice.options.filter(x => x.metrics.best?.won).map(x => ({ loadout: x.loadout, hp: x.metrics.best.hp, actions: x.metrics.best.actions })),
      selected: choice.best ? { loadout: choice.best.loadout, hp: choice.best.metrics.best.hp, actions: choice.best.actions } : null
    }))
  }));
  return { pass: result.gateC, seed, choices };
}

function main() {
  const gateA = runGateA();
  const references = evaluateReferences();
  let selected = null;
  let tested = 0;
  for (let seed = 1; seed <= 10000; seed += 1) {
    tested = seed;
    const result = evaluateSeed(seed);
    if (result.pass) { selected = result; break; }
  }
  const gateB = selected ? runGateB(selected.seed) : { pass: false, seed: null, complete: false, battles: [] };
  const gateC = selected ? runGateC(selected.seed) : { pass: false, seed: null, choices: [] };
  const referencesPass = Object.values(references).every(x => x.rejected);
  const gateD = {
    pass: referencesPass && Boolean(selected),
    referencePoints: references,
    scannedSeeds: tested,
    selectedSeed: selected?.seed ?? null,
    selectedCondition: selected ? { gateB: selected.gateB, gateC: selected.gateC } : null
  };
  const result = {
    ruleset: "control-0.1-calc",
    generatedAt: new Date().toISOString(),
    gateA, gateB, gateC, gateD,
    overallPass: gateA.pass && gateB.pass && gateC.pass && gateD.pass,
    uiDeploymentAllowed: gateA.pass && gateB.pass && gateC.pass && gateD.pass
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
