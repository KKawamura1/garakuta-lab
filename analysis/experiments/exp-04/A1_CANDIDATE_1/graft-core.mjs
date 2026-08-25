// EXP-04 GRAFT 0.1 -- deterministic, UI-free combat semantics.
// This file intentionally has no dependency on the existing game core.

export const ACTIONS = Object.freeze(['generate', 'attack', 'defend']);
export const MUTATIONS = Object.freeze(['recoil', 'echo', 'tinder']);
export const EFFECT_KIND = Object.freeze({
  generate: 'energy',
  attack: 'damage',
  defend: 'guard',
});

const BASE_EFFECT = Object.freeze({ generate: 2, attack: 5, defend: 7 });

export function roundEffect(value) {
  // JavaScript Math.round is half-up for the non-negative quantities in this game.
  return Math.round(value);
}

export function emptyMutations() {
  return { generate: null, attack: null, defend: null };
}

export function clonePersistent(persistent) {
  return { hp: persistent.hp, mutations: { ...persistent.mutations } };
}

export function attachMutation(persistent, action, mutation) {
  if (!ACTIONS.includes(action) || !MUTATIONS.includes(mutation)) {
    throw new Error(`unknown attachment: ${action}/${mutation}`);
  }
  if (persistent.mutations[action] !== null) {
    throw new Error(`action already mutated: ${action}`);
  }
  const next = clonePersistent(persistent);
  next.mutations[action] = mutation;
  return next;
}

export function unmutatedActions(persistent) {
  return ACTIONS.filter((action) => persistent.mutations[action] === null);
}

export function persistentKey(persistent) {
  return `${persistent.hp}|${ACTIONS.map((a) => persistent.mutations[a] ?? '-').join(',')}`;
}

export function battleStart(persistent, enemy) {
  // R1 explicitly says only HP carries between battles. Energy and every temporary
  // timing state therefore start empty for each battle.
  return {
    hp: persistent.hp,
    enemyHp: enemy.hp,
    energy: 0,
    turn: 0,
    disabled: null,
    pendingTinder: null,
    echo: null,
    mutations: { ...persistent.mutations },
  };
}

export function legalActions(state) {
  return ACTIONS.filter((action) => {
    if (state.disabled === action) return false;
    if ((action === 'attack' || action === 'defend') && state.energy < 1) return false;
    return true;
  });
}

function applyEffect(state, action, amount) {
  if (action === 'generate') return { ...state, energy: state.energy + amount };
  if (action === 'attack') return { ...state, enemyHp: state.enemyHp - amount };
  return state;
}

function processEcho(state) {
  if (!state.echo) return { state, guard: 0, echoLog: null };
  const { action, amount } = state.echo;
  let next = { ...state, echo: null };
  let guard = 0;
  if (action === 'defend') {
    guard = amount;
  } else {
    next = applyEffect(next, action, amount);
  }
  return { state: next, guard, echoLog: { type: 'echo', action, amount } };
}

/**
 * Resolve one turn. The caller may invoke it only while state.turn < 6.
 * An echo is the stored, already-rounded half of the resolved manual effect;
 * it never evaluates a mutation or a pending tinder trigger of its own.
 */
export function step(state, action) {
  if (state.turn >= 6) throw new Error('cannot start a seventh turn');
  const before = structuredClone(state);
  const echo = processEcho(state);
  let next = echo.state;
  if (next.enemyHp <= 0) {
    return {
      status: 'won',
      state: next,
      record: { turn: state.turn + 1, before, echo: echo.echoLog, action: null, winAtStart: true },
    };
  }

  if (!legalActions(next).includes(action)) {
    throw new Error(`illegal action ${action} on turn ${state.turn + 1}`);
  }

  const consumesTinder = next.pendingTinder !== null && next.pendingTinder !== action;
  const multiplier = (next.mutations[action] === 'recoil' ? 2 : 1) * (consumesTinder ? 1.5 : 1);
  const amount = roundEffect(BASE_EFFECT[action] * multiplier);
  if (action === 'attack' || action === 'defend') next = { ...next, energy: next.energy - 1 };
  let guard = echo.guard;
  if (action === 'defend') guard += amount;
  else next = applyEffect(next, action, amount);

  const effectAfterManual = amount;
  const oldPending = next.pendingTinder;
  if (consumesTinder) next = { ...next, pendingTinder: null };
  if (next.mutations[action] === 'tinder') {
    // A different tinder action first consumes the prior pending tinder, then
    // becomes the sole pending one. Repeating its own action leaves one pending.
    next = { ...next, pendingTinder: action };
  }

  const disabledNext = next.mutations[action] === 'recoil' ? action : null;
  const echoNext = next.mutations[action] === 'echo'
    ? { action, amount: roundEffect(effectAfterManual * 0.5) }
    : null;
  next = { ...next, disabled: disabledNext, echo: echoNext, turn: next.turn + 1 };

  const record = {
    turn: state.turn + 1,
    before,
    echo: echo.echoLog,
    action,
    mutation: state.mutations[action],
    pendingBefore: oldPending,
    consumedTinder: consumesTinder,
    amount,
    guard,
    enemyAttack: null,
    winAtStart: false,
  };
  if (next.enemyHp <= 0) return { status: 'won', state: next, record };

  const incoming = next.turn <= 6 ? beforeEnemyAttack(state, next) : 0;
  const dealt = Math.max(0, incoming - guard);
  next = { ...next, hp: next.hp - dealt };
  record.enemyAttack = incoming;
  record.damageTaken = dealt;
  if (next.hp <= 0) return { status: 'lost', state: next, record };
  if (next.turn >= 6) return { status: 'lost', state: next, record: { ...record, timeout: true } };
  return { status: 'ongoing', state: next, record };
}

function beforeEnemyAttack(previous, after) {
  // `previous.turn` is the zero-based index of the manual turn just resolved.
  // The enemy's advertised attack is fixed for that same turn.
  const attacks = after.enemy.attacks;
  return attacks[previous.turn];
}

export function withEnemy(state, enemy) {
  return { ...state, enemy };
}

export function describeActionEffect(action, mutation, tinderBoost = false) {
  const multiplier = (mutation === 'recoil' ? 2 : 1) * (tinderBoost ? 1.5 : 1);
  const manual = roundEffect(BASE_EFFECT[action] * multiplier);
  return {
    action,
    mutation,
    base: BASE_EFFECT[action],
    multiplier,
    manual,
    echo: mutation === 'echo' ? roundEffect(manual * 0.5) : null,
    disablesNextTurn: mutation === 'recoil',
  };
}

export function enumerateBattle(start, enemy) {
  const initial = withEnemy(start, enemy);
  const outcomes = [];
  const visit = (state, sequence, log) => {
    if (state.turn >= 6) {
      outcomes.push({ status: 'lost', state, sequence, log, timeout: true });
      return;
    }
    for (const action of legalActions(state)) {
      const result = step(state, action);
      const nextSequence = [...sequence, action];
      const nextLog = [...log, result.record];
      if (result.status === 'ongoing') visit(result.state, nextSequence, nextLog);
      else outcomes.push({ status: result.status, state: result.state, sequence: nextSequence, log: nextLog });
    }
  };
  visit(initial, [], []);
  return outcomes;
}

export function winningOutcomes(start, enemy, requiredAction = null) {
  return enumerateBattle(start, enemy).filter((outcome) =>
    outcome.status === 'won' && (!requiredAction || outcome.sequence.includes(requiredAction)));
}

export function outcomeScore(outcome) {
  // Ordered objective for a battle: win, preserve HP, kill earlier, retain energy.
  // It deliberately contains no random or lexical action-order component.
  return [
    outcome.status === 'won' ? 1 : 0,
    outcome.state.hp,
    -outcome.sequence.length,
    outcome.state.energy,
  ];
}

export function compareScore(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function optimalOutcomes(start, enemy) {
  const outcomes = enumerateBattle(start, enemy);
  let best = null;
  for (const outcome of outcomes) {
    const score = outcomeScore(outcome);
    if (best === null || compareScore(score, best) > 0) best = score;
  }
  return outcomes.filter((outcome) => compareScore(outcomeScore(outcome), best) === 0);
}

export function sequenceKey(sequence) {
  return sequence.join('>');
}
