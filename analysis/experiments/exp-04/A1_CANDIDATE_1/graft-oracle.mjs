// A deliberately independent, small reference interpreter used only by fixtures.
// It does not import the production transition function.

const base = { generate: 2, attack: 5, defend: 7 };

export function simulateOracle({ hp, enemyHp, attacks, mutations, actions }) {
  let energy = 0;
  let lock = null;
  let tinder = null;
  let delayed = null;
  const trace = [];

  for (let turn = 0; turn < 6; turn += 1) {
    let carriedGuard = 0;
    if (delayed) {
      if (delayed.action === 'generate') energy += delayed.amount;
      if (delayed.action === 'attack') enemyHp -= delayed.amount;
      if (delayed.action === 'defend') carriedGuard = delayed.amount;
      trace.push({ kind: 'echo', turn: turn + 1, ...delayed });
      delayed = null;
      if (enemyHp <= 0) return { status: 'won', hp, enemyHp, energy, trace };
    }

    const action = actions[turn];
    if (!action) return { status: 'incomplete', hp, enemyHp, energy, trace };
    if (action === lock || ((action === 'attack' || action === 'defend') && energy < 1)) {
      return { status: 'illegal', hp, enemyHp, energy, trace };
    }

    const consumes = tinder !== null && tinder !== action;
    const factor = (mutations[action] === 'recoil' ? 2 : 1) * (consumes ? 1.5 : 1);
    const amount = Math.round(base[action] * factor);
    let guard = carriedGuard;
    if (action === 'generate') energy += amount;
    if (action === 'attack') {
      energy -= 1;
      enemyHp -= amount;
    }
    if (action === 'defend') {
      energy -= 1;
      guard += amount;
    }

    if (consumes) tinder = null;
    if (mutations[action] === 'tinder') tinder = action;
    lock = mutations[action] === 'recoil' ? action : null;
    delayed = mutations[action] === 'echo' ? { action, amount: Math.round(amount * 0.5) } : null;
    trace.push({ kind: 'manual', turn: turn + 1, action, amount, guard, enemyHp, energy, lock, tinder, delayed });

    if (enemyHp <= 0) return { status: 'won', hp, enemyHp, energy, trace };
    hp -= Math.max(0, attacks[turn] - guard);
    if (hp <= 0) return { status: 'lost', hp, enemyHp, energy, trace };
  }
  return { status: 'lost', hp, enemyHp, energy, trace, timeout: true };
}
