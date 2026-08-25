import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  actionSequenceSet,
  makeState,
  optimalOutcomes,
} from "./graft-core.mjs";

const actions = ["generate", "attack", "defend"];
const mutations = ["recoil", "echo", "kindling"];

function intersect(left, right) {
  const lookup = new Set(right);
  return left.some((item) => lookup.has(item));
}

function changed(before, after) {
  // A conservative reading: acquisition changes the optimum only when no optimal manual
  // sequence is shared before and after. This avoids manufacturing change by tie-breaking.
  return !intersect(before, after);
}

function outcomeSummary(outcomes, objective) {
  const first = outcomes[0];
  return {
    objective,
    vector: first ? (objective === "turns-first"
      ? { turns: first.turn, hp: first.hp, energy: first.energy }
      : { hp: first.hp, turns: first.turn, energy: first.energy }) : null,
    sequences: actionSequenceSet(outcomes),
  };
}

let witness = null;
let contextsChecked = 0;

outer:
for (let hp = 8; hp <= 20; hp += 2) {
  for (let energy = 0; energy <= 3; energy += 1) {
    for (let enemyHp = 8; enemyHp <= 30; enemyHp += 1) {
      for (let low = 0; low <= 8; low += 2) {
        for (let high = 8; high <= 18; high += 2) {
          const enemyAttacks = [low, high, low, high, low, high];
          for (const action of actions) {
            for (const mutation of mutations) {
              contextsChecked += 1;
              const base = { hp, energy, enemyHp, enemyAttacks, maxTurns: 6 };
              const grafted = {
                ...base,
                mutations: { generate: null, attack: null, defend: null, [action]: mutation },
              };
              const beforeTurns = optimalOutcomes(makeState(base), "turns-first");
              const afterTurns = optimalOutcomes(makeState(grafted), "turns-first");
              const beforeHp = optimalOutcomes(makeState(base), "hp-first");
              const afterHp = optimalOutcomes(makeState(grafted), "hp-first");
              if ([beforeTurns, afterTurns, beforeHp, afterHp].some((outcomes) => outcomes.length === 0)) continue;

              const turnChange = changed(actionSequenceSet(beforeTurns), actionSequenceSet(afterTurns));
              const hpChange = changed(actionSequenceSet(beforeHp), actionSequenceSet(afterHp));
              if (turnChange === hpChange) continue;

              witness = {
                context: base,
                graft: { action, mutation },
                judgments: {
                  "turns-first": {
                    gateC: turnChange,
                    before: outcomeSummary(beforeTurns, "turns-first"),
                    after: outcomeSummary(afterTurns, "turns-first"),
                  },
                  "hp-first": {
                    gateC: hpChange,
                    before: outcomeSummary(beforeHp, "hp-first"),
                    after: outcomeSummary(afterHp, "hp-first"),
                  },
                },
              };
              break outer;
            }
          }
        }
      }
    }
  }
}

if (witness === null) {
  console.error("No ambiguity witness found in the registered diagnostic range.");
  process.exit(1);
}

const result = {
  diagnosticRange: {
    hp: "8..20 step 2",
    energy: "0..3",
    enemyHp: "8..30",
    enemyAttackPattern: "[low, high] repeated; low=0..8 step 2; high=8..18 step 2",
    grafts: "3 actions x 3 mutations",
    stopRule: "first judgment-changing witness",
    contextsChecked,
  },
  witness,
};

const committed = JSON.parse(readFileSync(new URL("./ambiguity-witness.json", import.meta.url), "utf8"));
assert.deepEqual(committed.diagnosticRange, result.diagnosticRange);
assert.deepEqual(committed.witness.context, witness.context);
assert.deepEqual(committed.witness.graft, witness.graft);
assert.equal(committed.witness.turnsFirst.gateC, witness.judgments["turns-first"].gateC);
assert.equal(committed.witness.hpFirst.gateC, witness.judgments["hp-first"].gateC);
assert.deepEqual(
  committed.witness.turnsFirst.before.optimalSequences,
  witness.judgments["turns-first"].before.sequences,
);
assert.deepEqual(
  committed.witness.turnsFirst.after.optimalSequences,
  witness.judgments["turns-first"].after.sequences,
);
assert.deepEqual(
  committed.witness.hpFirst.before.optimalSequences,
  witness.judgments["hp-first"].before.sequences,
);
assert.deepEqual(
  committed.witness.hpFirst.after.optimalSequences,
  witness.judgments["hp-first"].after.sequences,
);

console.log(JSON.stringify({ ...result, committedEvidence: "PASS" }, null, 2));
