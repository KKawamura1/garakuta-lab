export const ACTIONS = Object.freeze(["generate", "attack", "defend"]);
export const MUTATIONS = Object.freeze(["recoil", "echo", "kindling"]);

const BASE_EFFECT = Object.freeze({ generate: 2, attack: 5, defend: 7 });

export function roundEffect(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`effect must be a finite non-negative number: ${value}`);
  }
  return Math.round(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function makeState(overrides = {}) {
  const state = {
    hp: 20,
    energy: 0,
    enemyHp: 20,
    enemyAttacks: [0, 0, 0, 0, 0, 0],
    turn: 0,
    maxTurns: 6,
    mutations: { generate: null, attack: null, defend: null },
    blockedAction: null,
    pendingEcho: null,
    pendingKindling: null,
    status: "active",
    actions: [],
    trace: [],
    ...clone(overrides),
  };
  state.mutations = {
    generate: null,
    attack: null,
    defend: null,
    ...(overrides.mutations ?? {}),
  };
  return state;
}

export function legalActions(state) {
  if (state.status !== "active") return [];
  return ACTIONS.filter((action) => {
    if (state.blockedAction === action) return false;
    if ((action === "attack" || action === "defend") && state.energy < 1) return false;
    return true;
  });
}

function applyBenefit(state, action, amount, source, defenseBox) {
  if (action === "generate") state.energy += amount;
  if (action === "attack") state.enemyHp = Math.max(0, state.enemyHp - amount);
  if (action === "defend") defenseBox.value += amount;
  state.trace.push({
    event: "effect",
    source,
    action,
    amount,
    energy: state.energy,
    enemyHp: state.enemyHp,
  });
}

function manualMultiplier(state, action) {
  let multiplier = 1;
  if (state.mutations[action] === "recoil") multiplier *= 2;
  if (state.pendingKindling !== null && state.pendingKindling !== action) multiplier *= 1.5;
  return multiplier;
}

export function step(inputState, action) {
  const state = clone(inputState);
  if (state.status !== "active") throw new Error(`battle is ${state.status}`);

  const defense = { value: 0 };
  state.trace.push({ event: "turn-start", turn: state.turn + 1 });

  if (state.pendingEcho !== null) {
    const echo = state.pendingEcho;
    state.pendingEcho = null;
    applyBenefit(state, echo.action, echo.amount, "echo", defense);
    if (state.enemyHp === 0) {
      state.status = "won";
      state.trace.push({ event: "echo-victory" });
      return state;
    }
  }

  const legal = legalActions(state);
  if (!legal.includes(action)) {
    throw new Error(`illegal action ${action}; legal=${legal.join(",")}`);
  }

  const oldKindling = state.pendingKindling;
  const mutation = state.mutations[action];
  const multiplier = manualMultiplier(state, action);
  const amount = roundEffect(BASE_EFFECT[action] * multiplier);

  if (action === "attack" || action === "defend") state.energy -= 1;
  applyBenefit(state, action, amount, "manual", defense);
  state.actions.push(action);

  if (state.enemyHp > 0) {
    const attack = state.enemyAttacks[state.turn] ?? 0;
    const damage = Math.max(0, attack - defense.value);
    state.hp = Math.max(0, state.hp - damage);
    state.trace.push({ event: "enemy", attack, defense: defense.value, damage, hp: state.hp });
    if (state.hp === 0) state.status = "lost";
  }

  // The previous recoil prohibition expires after exactly this manual turn.
  state.blockedAction = mutation === "recoil" ? action : null;

  // An echo records half of the resolved manual benefit. It has no cost and cannot chain.
  state.pendingEcho = mutation === "echo"
    ? { action, amount: roundEffect(amount * 0.5) }
    : null;

  // A different manual action consumes an existing kindling. A kindling action then arms
  // (or refreshes) its own one-slot pending effect.
  let nextKindling = oldKindling;
  if (oldKindling !== null && oldKindling !== action) nextKindling = null;
  if (mutation === "kindling") nextKindling = action;
  state.pendingKindling = nextKindling;

  state.turn += 1;
  if (state.enemyHp === 0) state.status = "won";
  else if (state.status === "active" && state.turn >= state.maxTurns) state.status = "timeout";
  return state;
}

export function enumerateBattle(initialState) {
  const terminal = [];
  const visit = (state) => {
    if (state.status !== "active") {
      terminal.push(state);
      return;
    }
    for (const action of legalActions(state)) visit(step(state, action));
  };
  visit(makeState(initialState));
  return terminal;
}

export function winningOutcomes(initialState) {
  return enumerateBattle(initialState).filter((state) => state.status === "won");
}

export function objectiveVector(state, objective) {
  if (objective === "turns-first") return [-state.turn, state.hp, state.energy];
  if (objective === "hp-first") return [state.hp, -state.turn, state.energy];
  throw new Error(`unknown objective: ${objective}`);
}

function compareVector(left, right) {
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

export function optimalOutcomes(initialState, objective) {
  const wins = winningOutcomes(initialState);
  if (wins.length === 0) return [];
  let best = objectiveVector(wins[0], objective);
  for (const win of wins.slice(1)) {
    const vector = objectiveVector(win, objective);
    if (compareVector(vector, best) > 0) best = vector;
  }
  return wins.filter((win) => compareVector(objectiveVector(win, objective), best) === 0);
}

export function actionSequenceSet(outcomes) {
  return [...new Set(outcomes.map((outcome) => outcome.actions.join(">")))].sort();
}

