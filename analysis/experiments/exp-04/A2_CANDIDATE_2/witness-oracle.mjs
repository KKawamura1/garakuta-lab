import assert from "node:assert/strict";

// Independent, witness-specific enumerator. It intentionally imports nothing from the
// candidate core so a shared transition bug cannot manufacture the ambiguity witness.
const CONTEXT = Object.freeze({
  hp: 8,
  energy: 3,
  enemyHp: 8,
  attacks: [2, 8, 2, 8, 2, 8],
  maxTurns: 6,
});

function enumerate(withEchoDefense) {
  const wins = [];
  const walk = (state) => {
    if (state.enemyHp <= 0) {
      wins.push(state);
      return;
    }
    if (state.hp <= 0 || state.turn >= CONTEXT.maxTurns) return;

    const legal = state.energy > 0
      ? ["generate", "attack", "defend"]
      : ["generate"];

    for (const action of legal) {
      let hp = state.hp;
      let energy = state.energy;
      let enemyHp = state.enemyHp;
      let defense = state.echoDefensePending ? 4 : 0;
      let echoDefensePending = false;

      if (action === "generate") energy += 2;
      if (action === "attack") {
        energy -= 1;
        enemyHp = Math.max(0, enemyHp - 5);
      }
      if (action === "defend") {
        energy -= 1;
        defense += 7;
        echoDefensePending = withEchoDefense;
      }

      if (enemyHp > 0) hp = Math.max(0, hp - Math.max(0, CONTEXT.attacks[state.turn] - defense));

      walk({
        hp,
        energy,
        enemyHp,
        turn: state.turn + 1,
        echoDefensePending,
        actions: [...state.actions, action],
      });
    }
  };

  walk({ ...CONTEXT, turn: 0, echoDefensePending: false, actions: [] });
  return wins;
}

function sequence(outcome) {
  return outcome.actions.join(">");
}

function select(wins, objective) {
  const ordered = [...wins].sort((left, right) => {
    const leftVector = objective === "turns-first"
      ? [left.turn, -left.hp, -left.energy]
      : [-left.hp, left.turn, -left.energy];
    const rightVector = objective === "turns-first"
      ? [right.turn, -right.hp, -right.energy]
      : [-right.hp, right.turn, -right.energy];
    for (let index = 0; index < leftVector.length; index += 1) {
      if (leftVector[index] !== rightVector[index]) return leftVector[index] - rightVector[index];
    }
    return sequence(left).localeCompare(sequence(right));
  });
  const first = ordered[0];
  return { sequence: sequence(first), turns: first.turn, hp: first.hp, energy: first.energy };
}

const withoutGraft = enumerate(false);
const withEchoDefense = enumerate(true);

const observed = {
  "turns-first": {
    before: select(withoutGraft, "turns-first"),
    after: select(withEchoDefense, "turns-first"),
  },
  "hp-first": {
    before: select(withoutGraft, "hp-first"),
    after: select(withEchoDefense, "hp-first"),
  },
};

assert.deepEqual(observed, {
  "turns-first": {
    before: { sequence: "attack>attack", turns: 2, hp: 6, energy: 1 },
    after: { sequence: "attack>attack", turns: 2, hp: 6, energy: 1 },
  },
  "hp-first": {
    before: { sequence: "attack>attack", turns: 2, hp: 6, energy: 1 },
    after: { sequence: "defend>defend>generate>defend>attack>attack", turns: 6, hp: 7, energy: 0 },
  },
});

console.log(JSON.stringify({ independentOracle: "PASS", observed }, null, 2));

