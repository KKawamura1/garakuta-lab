import assert from 'node:assert/strict';

// A deliberately tiny, mutation-free battle oracle.  It is not the GRAFT
// evaluator: it isolates the inter-battle energy question before that costly
// evaluator is written.
function legalActions(energy) {
  return energy >= 1 ? ['generate', 'attack', 'defend'] : ['generate'];
}

function step(state, action, enemyAttack) {
  assert(legalActions(state.energy).includes(action));
  const next = { ...state };
  if (action === 'generate') next.energy += 2;
  if (action === 'attack') {
    next.energy -= 1;
    next.enemyHp -= 5;
  }
  if (action === 'defend') next.energy -= 1;
  if (next.enemyHp <= 0) return { ...next, won: true };
  const block = action === 'defend' ? 7 : 0;
  next.hp -= Math.max(0, enemyAttack - block);
  return { ...next, won: false };
}

function canWin(initial) {
  const stack = [{ ...initial, turn: 0 }];
  const seen = new Set();
  while (stack.length) {
    const state = stack.pop();
    const key = `${state.turn}/${state.hp}/${state.energy}/${state.enemyHp}`;
    if (seen.has(key) || state.hp <= 0 || state.turn >= 6) continue;
    seen.add(key);
    for (const action of legalActions(state.energy)) {
      const next = step(state, action, 7);
      if (next.won) return true;
      stack.push({ ...next, turn: state.turn + 1 });
    }
  }
  return false;
}

// Reachable boundary: battle 1 can end with one energy.  For battle 2, at
// HP=7 against HP=5 and first attack=7, retained energy wins immediately;
// reset energy forces generate and death.  Thus Gate B/F witnesses can flip.
assert.equal(canWin({ hp: 7, energy: 1, enemyHp: 5 }), true);
assert.equal(canWin({ hp: 7, energy: 0, enemyHp: 5 }), false);

console.log(JSON.stringify({
  fixture: 'inter-battle-energy-counterexample',
  carry_energy_1: 'WIN',
  reset_energy_0: 'LOSS',
  affected_gates: ['B', 'C', 'D', 'E', 'F'],
}, null, 2));
