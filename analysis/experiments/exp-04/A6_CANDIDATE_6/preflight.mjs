#!/usr/bin/env node

// EXP-04 R1/R2 preflight only.
// This deliberately contains no search implementation. It demonstrates the
// Gate D quantifier problem with a four-battle, six-turn fixture.

const ACTIONS = Object.freeze({ generate: "generate", attack: "attack" });

function playBattle({ playerHp, enemyHp, attacks, actions }) {
  let hp = playerHp;
  let energy = 0;
  let remaining = enemyHp;
  const trace = [];

  for (let turn = 0; turn < 6; turn += 1) {
    const action = actions[turn];
    trace.push({ turn: turn + 1, action, energyBefore: energy, enemyHpBefore: remaining, playerHpBefore: hp });

    if (action === ACTIONS.generate) {
      energy += 2;
    } else if (action === ACTIONS.attack) {
      if (energy < 1) return { win: false, reason: "illegal-attack", hp, trace };
      energy -= 1;
      remaining -= 5;
    } else {
      return { win: false, reason: "unknown-action", hp, trace };
    }

    if (remaining <= 0) return { win: true, hp, trace };

    hp -= attacks[turn];
    if (hp <= 0) return { win: false, reason: "player-dead", hp, trace };
  }

  return { win: false, reason: "turn-limit", hp, trace };
}

function playRun({ playerHp, battles, actions }) {
  let hp = playerHp;
  const battleResults = [];
  for (let i = 0; i < battles.length; i += 1) {
    const result = playBattle({ ...battles[i], playerHp: hp, actions });
    battleResults.push(result);
    if (!result.win) return { win: false, failedBattle: i + 1, hp: result.hp, battleResults };
    hp = result.hp;
  }
  return { win: true, hp, battleResults };
}

// The fixture intentionally makes a fixed winning sequence and an alternating
// sequence differ while both policies are independent of nextAttack.
const fixture = {
  playerHp: 20,
  battles: Array.from({ length: 4 }, () => ({
    enemyHp: 20,
    attacks: [2, 0, 0, 2, 0, 0],
  })),
};

const fixedWinningSequence = [
  ACTIONS.generate,
  ACTIONS.attack,
  ACTIONS.attack,
  ACTIONS.generate,
  ACTIONS.attack,
  ACTIONS.attack,
];

const alternatingSequence = [
  ACTIONS.generate,
  ACTIONS.attack,
  ACTIONS.generate,
  ACTIONS.attack,
  ACTIONS.generate,
  ACTIONS.attack,
];

const fixedWinning = playRun({ ...fixture, actions: fixedWinningSequence });
const alternating = playRun({ ...fixture, actions: alternatingSequence });

// Neither policy receives the attack array. The array is used only by the
// environment after each action, exactly as a hidden nextAttack would be.
const result = {
  test: "EXP-04 Gate D preflight",
  fixture,
  policies: {
    fixedWinningSequence: {
      readsNextAttack: false,
      actionRule: "emit the fixed action at the current turn index",
      sequence: fixedWinningSequence,
      outcome: fixedWinning,
    },
    alternatingSequence: {
      readsNextAttack: false,
      actionRule: "generate on odd turns and attack on even turns",
      sequence: alternatingSequence,
      outcome: alternating,
    },
  },
  observations: [
    "A no-nextAttack policy can complete the same finite fixture when it emits a fixed winning action sequence.",
    "Another no-nextAttack policy fails on the same fixture.",
    "Therefore the phrase 'no nextAttack policy can complete' has no determinate truth value until the policy class and its information boundary are fixed.",
  ],
  literalGateDImplication: {
    unrestrictedOptimalPathRequired: true,
    anyFiniteWinningSequenceCanBeEncodedAsTurnOnlyPolicy: true,
    literalUniversalNoNextAttackFailureIsIncompatibleWithThatRequirement: true,
  },
};

console.log(JSON.stringify(result, null, 2));
