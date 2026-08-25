export const RULESET_ID = "control-0.1";
export const MAX_HP = 30;
export const MAX_TURNS = 8;

export const INITIAL_PARTS = ["generator", "nail", "deflector"];
export const REWARD_POOL = ["collapse", "capacitor", "follow"];
export const PARTS = Object.freeze({
  generator: { name: "手回し発電機", cost: 0 },
  nail: { name: "釘打ち砲", cost: 1 },
  collapse: { name: "崩落砲", cost: 2 },
  deflector: { name: "偏向板", cost: 1 },
  capacitor: { name: "蓄電輪", cost: 0 },
  follow: { name: "追従軸", cost: 1 }
});

export function makeRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateEnemies(seed) {
  const rng = makeRng(seed * 17 + 11);
  return Array.from({ length: 3 }, (_, i) => ({
    id: `e${i + 1}`,
    name: `制御試験体${i + 1}`,
    // Gate未通過時に敵側だけを、実験票の許容範囲内で狭める。
    // 低HP・低攻撃だけには固定せず、HP18〜26・攻撃0〜4の範囲でseed差を残す。
    hp: 18 + Math.floor(rng() * 9),
    atk: Math.floor(rng() * 5),
    maxTurns: MAX_TURNS
  }));
}

function shuffled(items, seed) {
  const out = [...items];
  const rng = makeRng(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function offerFor(seed, battleIndex, owned) {
  const available = REWARD_POOL.filter(type => !owned.includes(type));
  return shuffled(available, seed * 101 + battleIndex * 997).slice(0, 2);
}

export function replacementLoadouts(loadout, reward) {
  return loadout.flatMap((_, index) => {
    const next = [...loadout];
    next[index] = reward;
    return [{ reward, replaced: loadout[index], loadout: next }];
  });
}

function cloneState(state) {
  return {
    ...state,
    previous: state.previous ? { ...state.previous, effect: { ...state.previous.effect } } : null,
    log: [...state.log]
  };
}

function initialState(parts, enemy, hp = MAX_HP, energy = 0) {
  return {
    parts: [...parts], enemy,
    turn: 0, hp, enemyHp: enemy.hp, energy,
    disabledUntil: new Map(), nextAttackBonus: 0, previous: null,
    log: [], terminal: false, won: false, lost: false
  };
}

function legal(state, type) {
  if (!state.parts.includes(type)) return false;
  if ((state.disabledUntil.get(type) || 0) >= state.turn + 1) return false;
  if (PARTS[type].cost > state.energy) return false;
  if (type === "follow" && (!state.previous || state.previous.type === "follow")) return false;
  return true;
}

export function legalActions(state) {
  return state.parts.filter(type => legal(state, type));
}

function integerHalf(value) {
  return Math.floor(value * 0.5);
}

function applyEffect(state, effect, multiplier, source, logBits) {
  const value = Math.floor(effect.value * multiplier);
  if (effect.kind === "energy") {
    state.energy += value;
    logBits.energy = value;
  } else if (effect.kind === "bonus") {
    state.nextAttackBonus += value;
    logBits.nextAttackBonus = value;
  } else if (effect.kind === "damage") {
    const bonus = state.nextAttackBonus;
    const damage = value + bonus;
    state.nextAttackBonus = 0;
    state.enemyHp = Math.max(0, state.enemyHp - damage);
    logBits.damage = damage;
    logBits.consumedBonus = bonus;
  } else if (effect.kind === "shield") {
    logBits.shield = value;
  }
  logBits.source = source;
}

function originalEffect(state, type) {
  if (type === "generator") return { kind: "energy", value: 2 };
  if (type === "nail") return { kind: "damage", value: 5 };
  if (type === "collapse") return { kind: "damage", value: 10 };
  if (type === "deflector") return { kind: "shield", value: 7 };
  if (type === "capacitor") {
    return state.energy >= 2 ? { kind: "bonus", value: 5 } : { kind: "energy", value: 1 };
  }
  return null;
}

export function step(state, action) {
  if (state.terminal) return { ok: false, error: "battle already ended", state };
  if (!legal(state, action)) return { ok: false, error: `illegal action: ${action}`, state };
  const next = cloneState(state);
  next.turn += 1;
  next.energy -= PARTS[action].cost;
  const bits = { turn: next.turn, action, hpBefore: next.hp, enemyHpBefore: next.enemyHp };
  let effect;

  if (action === "follow") {
    effect = { ...next.previous.effect, value: integerHalf(next.previous.effect.value) };
    applyEffect(next, effect, 1, `follow:${next.previous.type}`, bits);
  } else {
    effect = originalEffect(next, action);
    applyEffect(next, effect, 1, action, bits);
    if (action === "collapse") next.disabledUntil.set("collapse", next.turn + 1);
  }

  next.previous = { type: action, effect: { ...effect } };
  if (next.enemyHp <= 0) {
    next.terminal = true; next.won = true;
    bits.result = "win"; bits.hpAfter = next.hp; bits.enemyHpAfter = next.enemyHp;
    next.log.push(bits);
    return { ok: true, state: next };
  }

  const shield = bits.shield || 0;
  const damage = Math.max(0, next.enemy.atk - shield);
  next.hp -= damage;
  bits.enemyDamage = damage; bits.shieldUsed = Math.min(shield, next.enemy.atk);
  bits.hpAfter = next.hp; bits.enemyHpAfter = next.enemyHp;
  if (next.hp <= 0) {
    next.hp = 0; next.terminal = true; next.lost = true; bits.result = "loss";
  } else if (next.turn >= MAX_TURNS) {
    next.terminal = true; next.lost = true; bits.result = "timeout";
  } else {
    bits.result = "continue";
  }
  next.log.push(bits);
  return { ok: true, state: next };
}

export function simulateBattle({ parts, enemy, actions = [], hp = MAX_HP, energy = 0 }) {
  let state = initialState(parts, enemy, hp, energy);
  for (const action of actions) {
    const result = step(state, action);
    if (!result.ok) return { legal: false, error: result.error, actions, hp: state.hp, enemyHp: state.enemyHp, log: state.log };
    state = result.state;
    if (state.terminal) break;
  }
  return {
    legal: true, won: state.won, lost: state.lost, terminal: state.terminal,
    timeout: state.terminal && !state.won && state.turn >= MAX_TURNS && state.hp > 0,
    turns: state.turn, hp: state.hp, enemyHp: state.enemyHp,
    energy: state.energy, actions: [...actions], log: state.log
  };
}

export function enumerateBattle({ parts, enemy, hp = MAX_HP, energy = 0 }) {
  const outcomes = [];
  const visit = state => {
    if (state.terminal) {
      outcomes.push({ won: state.won, hp: state.hp, enemyHp: state.enemyHp, turns: state.turn, actions: state.log.map(x => x.action), log: state.log });
      return;
    }
    const actions = legalActions(state);
    if (!actions.length) {
      outcomes.push({ won: false, hp: state.hp, enemyHp: state.enemyHp, turns: state.turn, actions: state.log.map(x => x.action), log: state.log });
      return;
    }
    for (const action of actions) visit(step(state, action).state);
  };
  visit(initialState(parts, enemy, hp, energy));
  return outcomes;
}

export function randomWinProbability({ parts, enemy, hp = MAX_HP, energy = 0 }) {
  const memo = new Map();
  const keyFor = state => JSON.stringify([
    state.turn, state.hp, state.enemyHp, state.energy, state.nextAttackBonus,
    [...state.disabledUntil.entries()], state.previous
  ]);
  const visit = state => {
    if (state.terminal) return state.won ? 1 : 0;
    const key = keyFor(state);
    if (memo.has(key)) return memo.get(key);
    const actions = legalActions(state);
    const value = actions.reduce((sum, action) => sum + visit(step(state, action).state), 0) / actions.length;
    memo.set(key, value);
    return value;
  };
  return visit(initialState(parts, enemy, hp, energy));
}

function outcomeScore(outcome) {
  return [outcome.won ? 1 : 0, outcome.hp, -outcome.turns, -outcome.actions.join(",").length];
}

export function bestOutcome(outcomes) {
  return [...outcomes].sort((a, b) => {
    const x = outcomeScore(a), y = outcomeScore(b);
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return y[i] - x[i];
    return a.actions.join(",").localeCompare(b.actions.join(","));
  })[0] || null;
}

export function bestWinningOutcome(outcomes) {
  return bestOutcome(outcomes.filter(outcome => outcome.won));
}

export function simplePolicy(parts, enemy, preferred, hp = MAX_HP) {
  let state = initialState(parts, enemy, hp);
  const actions = [];
  while (!state.terminal) {
    const choices = legalActions(state);
    // 「同じ部品を可能な限り繰り返す」は、別部品で帳尻を合わせない固定方策。
    // 好みの部品が作動不能になった時点で、その単純方策は失敗とする。
    if (!choices.includes(preferred)) return { won: false, hp: state.hp, turns: state.turn, actions };
    const action = preferred;
    const result = step(state, action);
    state = result.state; actions.push(action);
  }
  return { won: state.won, hp: state.hp, turns: state.turn, actions };
}

export function chooseBestLoadout(loadoutOptions, enemy, hp) {
  const evaluated = loadoutOptions.map(option => {
    const outcomes = enumerateBattle({ parts: option.loadout, enemy, hp });
    return { ...option, best: bestWinningOutcome(outcomes), outcomes };
  });
  return evaluated.sort((a, b) => {
    const ax = a.best ? [1, a.best.hp, -a.best.turns] : [0, -1, -999];
    const bx = b.best ? [1, b.best.hp, -b.best.turns] : [0, -1, -999];
    for (let i = 0; i < ax.length; i += 1) if (ax[i] !== bx[i]) return bx[i] - ax[i];
    return a.loadout.join(",").localeCompare(b.loadout.join(","));
  })[0];
}

export function evaluateBattle(parts, enemy, hp = MAX_HP, energy = 0) {
  const outcomes = enumerateBattle({ parts, enemy, hp, energy });
  const wins = outcomes.filter(x => x.won);
  const best = bestWinningOutcome(outcomes);
  const usesTwoTypes = Boolean(wins.find(x => new Set(x.actions).size >= 2));
  const initialActionEffects = new Map();
  outcomes.forEach(outcome => {
    const first = outcome.actions[0];
    if (!initialActionEffects.has(first)) initialActionEffects.set(first, outcome);
  });
  const initialActionChanges = best && [...initialActionEffects.values()].some(x => x.won !== best.won || x.hp !== best.hp);
  return {
    parts, enemy, hp, total: outcomes.length, wins: wins.length,
    randomWinRate: randomWinProbability({ parts, enemy, hp, energy }),
    best, usesTwoTypes, initialActionChanges
  };
}

export function runPathFor(seed) {
  const enemies = generateEnemies(seed);
  let loadout = [...INITIAL_PARTS];
  let hp = MAX_HP;
  const battles = [];
  for (let battleIndex = 0; battleIndex < enemies.length; battleIndex += 1) {
    const metrics = evaluateBattle(loadout, enemies[battleIndex], hp);
    battles.push({ battleIndex: battleIndex + 1, loadout, hpStart: hp, enemy: enemies[battleIndex], metrics });
    if (!metrics.best?.won) break;
    hp = metrics.best.hp;
    if (battleIndex < 2) {
      const offer = offerFor(seed, battleIndex + 1, loadout);
      const options = offer.flatMap(reward => replacementLoadouts(loadout, reward));
      const chosen = chooseBestLoadout(options, enemies[battleIndex + 1], hp);
      if (!chosen) break;
      loadout = chosen.loadout;
      battles[battles.length - 1].offer = offer;
      battles[battles.length - 1].chosenReward = chosen;
    }
  }
  return { seed, enemies, battles, complete: battles.length === 3 && battles.every(b => b.metrics.best?.won) };
}

export function evaluateRewardChoice(seed, battleIndex, loadout, hp, enemy) {
  const offer = offerFor(seed, battleIndex, loadout);
  return offer.map(reward => {
    const options = replacementLoadouts(loadout, reward);
    const evaluated = options.map(option => ({
      ...option,
      metrics: evaluateBattle(option.loadout, enemy, hp)
    }));
    const viable = evaluated.filter(option => option.metrics.best?.won);
    const best = viable.sort((a, b) => {
      const ah = a.metrics.best?.hp ?? -1, bh = b.metrics.best?.hp ?? -1;
      return bh - ah || a.loadout.join(",").localeCompare(b.loadout.join(","));
    })[0] || null;
    return { reward, options: evaluated, best };
  });
}

export function evaluateSeed(seed) {
  const path = runPathFor(seed);
  const gateB = path.complete && path.battles.every(b => {
    const m = b.metrics;
    const simpleAll = b.loadout.some(type => simplePolicy(b.loadout, b.enemy, type, b.hpStart).won);
    return m.wins > 0 && m.randomWinRate > 0.05 && m.randomWinRate < 0.8
      && !simpleAll && m.usesTwoTypes && m.initialActionChanges;
  });
  const gateC = path.complete && path.battles.slice(0, 2).every(b => {
    const choices = evaluateRewardChoice(seed, b.battleIndex, b.loadout, b.metrics.best.hp, path.enemies[b.battleIndex]);
    if (choices.length !== 2 || choices.some(choice => !choice.best)) return false;
    const sig = choices.map(choice => [choice.best.loadout.join(","), choice.best.metrics.best.actions.join(","), choice.best.metrics.best.hp].join("|"));
    return sig[0] !== sig[1];
  });
  return { seed, path, gateB, gateC, pass: gateB && gateC };
}

export function evaluateReferences() {
  const trivial = evaluateBattle(INITIAL_PARTS, { name: "自明", hp: 5, atk: 0, maxTurns: MAX_TURNS });
  const impossible = evaluateBattle(INITIAL_PARTS, { name: "不可能", hp: 999, atk: 10, maxTurns: MAX_TURNS });
  const nailOnly = evaluateBattle(["nail", "nail", "nail"], { name: "釘打ち専用", hp: 15, atk: 0, maxTurns: MAX_TURNS }, MAX_HP, 5);
  return {
    trivial: { ...trivial, rejected: trivial.randomWinRate >= 0.8 },
    impossible: { ...impossible, rejected: impossible.wins === 0 },
    nailOnly: { ...nailOnly, rejected: nailOnly.usesTwoTypes === false || nailOnly.wins > 0 }
  };
}
