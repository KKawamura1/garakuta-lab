export const RULESET_ID = "control-0.2";
export const PLAY_VERSION = "control-0.2-play";
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

function validAttackSequence(attacks) {
  return attacks.filter(x => x === 0).length >= 2
    && attacks.filter(x => x >= 6).length >= 2
    && !attacks.some((x, i) => i >= 3 && x === attacks[i - 1] && x === attacks[i - 2] && x === attacks[i - 3]);
}

export function generateEnemies(seed) {
  const rng = makeRng(seed * 17 + 11);
  return Array.from({ length: 3 }, (_, i) => {
    let attacks;
    do {
      attacks = Array.from({ length: MAX_TURNS }, () => Math.floor(rng() * 10));
    } while (!validAttackSequence(attacks));
    return {
      id: `e${i + 1}`,
      name: `制御試験体${i + 1}`,
      hp: 15 + Math.floor(rng() * 18),
      attacks,
      maxTurns: MAX_TURNS
    };
  });
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
  return shuffled(REWARD_POOL.filter(type => !owned.includes(type)), seed * 101 + battleIndex * 997).slice(0, 2);
}

export function replacementLoadouts(loadout, reward) {
  return loadout.flatMap((_, index) => {
    const next = [...loadout];
    const replaced = next[index];
    next[index] = reward;
    return [{ reward, replaced, loadout: next }];
  });
}

function cloneState(state) {
  return {
    ...state,
    disabledUntil: new Map(state.disabledUntil),
    previous: state.previous ? { ...state.previous, effect: { ...state.previous.effect } } : null,
    log: [...state.log]
  };
}

function initialState(parts, enemy, hp = MAX_HP, energy = 0) {
  return {
    parts: [...parts], enemy, turn: 0, hp, enemyHp: enemy.hp, energy,
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

function half(value) { return Math.floor(value * 0.5); }

function originalEffect(state, type) {
  if (type === "generator") return { kind: "energy", value: 2 };
  if (type === "nail") return { kind: "damage", value: 5 };
  if (type === "collapse") return { kind: "damage", value: 10 };
  if (type === "deflector") return { kind: "shield", value: 7 };
  if (type === "capacitor") return state.energy >= 2 ? { kind: "bonus", value: 5 } : { kind: "energy", value: 1 };
  return null;
}

function applyEffect(state, effect, source, bits) {
  const value = effect.value;
  bits.effect = { kind: effect.kind, value, source };
  if (effect.kind === "energy") state.energy += value;
  if (effect.kind === "bonus") state.nextAttackBonus += value;
  if (effect.kind === "damage") {
    const bonus = state.nextAttackBonus;
    const damage = value + bonus;
    state.nextAttackBonus = 0;
    state.enemyHp = Math.max(0, state.enemyHp - damage);
    bits.damage = damage;
    bits.consumedBonus = bonus;
  }
  if (effect.kind === "shield") bits.shield = value;
}

export function stateFromActions({ parts, enemy, actions = [], hp = MAX_HP, energy = 0, attackOverride = null }) {
  let state = initialState(parts, enemy, hp, energy);
  for (const action of actions) {
    const result = step(state, action, attackOverride);
    if (!result.ok) return { ...result, actions: [...actions], state };
    state = result.state;
    if (state.terminal) break;
  }
  return { ok: true, state, actions: [...actions] };
}

export function step(state, action, attackOverride = null) {
  if (state.terminal) return { ok: false, error: "battle already ended", state };
  if (!legal(state, action)) return { ok: false, error: `illegal action: ${action}`, state };
  const next = cloneState(state);
  next.turn += 1;
  next.energy -= PARTS[action].cost;
  const scheduledAttack = attackOverride?.[next.turn - 1] ?? next.enemy.attacks[next.turn - 1] ?? 0;
  const bits = {
    turn: next.turn,
    action,
    hpBefore: next.hp,
    enemyHpBefore: next.enemyHp,
    energyBefore: next.energy + PARTS[action].cost,
    energyAfterEffect: null,
    nextAttack: scheduledAttack,
    disabledBefore: [...next.disabledUntil.entries()],
    bonusBefore: next.nextAttackBonus
  };
  let effect;
  let source = action;
  if (action === "follow") {
    effect = { ...next.previous.effect, value: half(next.previous.effect.value) };
    source = `follow:${next.previous.type}`;
  } else {
    effect = originalEffect(next, action);
  }
  applyEffect(next, effect, source, bits);
  bits.energyAfterEffect = next.energy;
  if (action === "collapse") next.disabledUntil.set("collapse", next.turn + 1);
  next.previous = { type: action, effect: { ...effect } };

  if (next.enemyHp <= 0) {
    next.terminal = true; next.won = true;
    bits.enemyPlannedAttack = scheduledAttack;
    bits.enemyActualAttack = 0;
    bits.shield = bits.shield || 0;
    bits.damage = bits.damage || 0;
    bits.hpAfter = next.hp; bits.enemyHpAfter = next.enemyHp;
    bits.energyAfter = next.energy;
    bits.disabledAfter = [...next.disabledUntil.entries()];
    bits.bonusAfter = next.nextAttackBonus;
    bits.result = "win";
    next.log.push(bits);
    return { ok: true, state: next };
  }

  const shield = bits.shield || 0;
  const actualAttack = scheduledAttack;
  const damage = Math.max(0, actualAttack - shield);
  next.hp = Math.max(0, next.hp - damage);
  bits.enemyPlannedAttack = scheduledAttack;
  bits.enemyActualAttack = actualAttack;
  bits.damageTaken = damage;
  bits.shieldUsed = Math.min(shield, actualAttack);
  bits.hpAfter = next.hp; bits.enemyHpAfter = next.enemyHp;
  bits.energyAfter = next.energy;
  bits.disabledAfter = [...next.disabledUntil.entries()];
  bits.bonusAfter = next.nextAttackBonus;
  if (next.hp <= 0) {
    next.terminal = true; next.lost = true; bits.result = "loss";
  } else if (next.turn >= MAX_TURNS) {
    next.terminal = true; next.lost = true; bits.result = "timeout";
  } else {
    bits.result = "continue";
  }
  next.log.push(bits);
  return { ok: true, state: next };
}

export function simulateBattle({ parts, enemy, actions = [], hp = MAX_HP, energy = 0, attackOverride = null }) {
  const run = stateFromActions({ parts, enemy, actions, hp, energy, attackOverride });
  if (!run.ok) return { legal: false, error: run.error, actions, hp: run.state.hp, enemyHp: run.state.enemyHp, energy: run.state.energy, log: run.state.log };
  const s = run.state;
  return {
    legal: true, won: s.won, lost: s.lost, terminal: s.terminal,
    timeout: s.terminal && !s.won && s.turn >= MAX_TURNS && s.hp > 0,
    turns: s.turn, hp: s.hp, enemyHp: s.enemyHp, energy: s.energy,
    actions: [...actions], log: s.log
  };
}

export function enumerateBattle({ parts, enemy, hp = MAX_HP, energy = 0, attackOverride = null }) {
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
    for (const action of actions) visit(step(state, action, attackOverride).state);
  };
  visit(initialState(parts, enemy, hp, energy));
  return outcomes;
}

function score(outcome) {
  return [outcome.won ? 1 : 0, outcome.hp, -outcome.turns];
}

export function compareOutcomes(a, b) {
  const x = score(a), y = score(b);
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

export function bestOutcome(outcomes) {
  return [...outcomes].sort((a, b) => compareOutcomes(b, a) || a.actions.join(",").localeCompare(b.actions.join(",")))[0] || null;
}

export function bestWinningOutcome(outcomes) { return bestOutcome(outcomes.filter(x => x.won)); }

export function randomWinProbability({ parts, enemy, hp = MAX_HP, energy = 0, attackOverride = null }) {
  const wins = enumerateBattle({ parts, enemy, hp, energy, attackOverride }).filter(x => x.won).length;
  const total = enumerateBattle({ parts, enemy, hp, energy, attackOverride }).length;
  return total ? wins / total : 0;
}

export function evaluateBattle(parts, enemy, hp = MAX_HP, energy = 0) {
  const outcomes = enumerateBattle({ parts, enemy, hp, energy });
  const wins = outcomes.filter(x => x.won);
  const best = bestWinningOutcome(outcomes);
  return {
    parts: [...parts], enemy, hp, total: outcomes.length, wins: wins.length,
    randomWinRate: randomWinProbability({ parts, enemy, hp, energy }), best,
    outcomes
  };
}

function hasCategory(actions, cat) {
  return actions.some(type => cat === "accumulate" ? ["generator", "capacitor"].includes(type) : cat === "attack" ? ["nail", "collapse"].includes(type) : type === "deflector");
}

export function usesRevisitPattern(actions) {
  for (let i = 1; i < actions.length - 1; i += 1) {
    if (hasCategory(actions.slice(0, i), "accumulate") && hasCategory(actions.slice(i, i + 1), "attack") && hasCategory(actions.slice(i + 1), "accumulate")) return true;
  }
  return false;
}

export function replaceEnemyAttack(enemy, value) { return { ...enemy, attacks: Array(MAX_TURNS).fill(value) }; }

export function actionSetForState({ parts, enemy, actions, hp, energy, nextAttack }) {
  const state = stateFromActions({ parts, enemy, actions, hp, energy }).state;
  if (state.terminal) return { state, choices: [] };
  const override = [...enemy.attacks]; override[state.turn] = nextAttack;
  const enumerateFrom = current => {
    if (current.terminal) return [{ won: current.won, hp: current.hp, enemyHp: current.enemyHp, turns: current.turn, actions: current.log.map(x => x.action), log: current.log }];
    const actionsNow = legalActions(current);
    if (!actionsNow.length) return [{ won: false, hp: current.hp, enemyHp: current.enemyHp, turns: current.turn, actions: current.log.map(x => x.action), log: current.log }];
    return actionsNow.flatMap(type => enumerateFrom(step(current, type, override).state));
  };
  const choices = legalActions(state).map(action => {
    const next = step(state, action, override).state;
    return { action, result: bestOutcome(enumerateFrom(next)) };
  });
  const bestResult = bestOutcome(choices.map(x => x.result));
  const optimal = choices.filter(x => bestResult && compareOutcomes(x.result, bestResult) === 0).map(x => x.action);
  return { state, choices, optimal, best: bestResult };
}

export function findPredictionWitness(parts, enemy, hp) {
  const outcomes = enumerateBattle({ parts, enemy, hp });
  for (const outcome of outcomes.filter(x => x.actions.length > 0)) {
    const prefix = outcome.actions.slice(0, -1);
    const state = stateFromActions({ parts, enemy, actions: prefix, hp }).state;
    if (state.terminal) continue;
    const zero = actionSetForState({ parts, enemy, actions: prefix, hp, nextAttack: 0 });
    const high = actionSetForState({ parts, enemy, actions: prefix, hp, nextAttack: 7 });
    if (zero.optimal?.length && high.optimal?.length && zero.optimal.join(",") !== high.optimal.join(",")) return { prefix, zero, high };
  }
  return null;
}

export function replacementOptions(loadout, reward) { return replacementLoadouts(loadout, reward); }

export function evaluateRewardChoice(seed, battleIndex, loadout, hp, enemy) {
  return offerFor(seed, battleIndex, loadout).map(reward => {
    const options = replacementOptions(loadout, reward).map(option => ({ ...option, metrics: evaluateBattle(option.loadout, enemy, hp) }));
    const all = options.flatMap(x => x.metrics.outcomes.filter(y => y.won).map(outcome => ({ ...outcome, loadout: x.loadout, replaced: x.replaced })));
    const best = bestOutcome(all);
    const byOption = options.map(option => {
      const wins = option.metrics.outcomes.filter(x => x.won).map(x => ({ ...x, loadout: option.loadout, replaced: option.replaced }));
      return {
        option,
        used: bestOutcome(wins.filter(x => x.actions.includes(reward))),
        no: bestOutcome(wins.filter(x => !x.actions.includes(reward)))
      };
    });
    const strict = byOption.find(x => x.used && x.no && compareOutcomes(x.used, x.no) > 0) || null;
    const rewardUsed = strict?.used || bestOutcome(byOption.map(x => x.used).filter(Boolean));
    const withoutReward = strict?.no || bestOutcome(byOption.map(x => x.no).filter(Boolean));
    const selected = options.find(x => x.loadout.join(",") === best?.loadout?.join(",")) || null;
    return { reward, options, best: selected ? { ...selected, best: selected.metrics.best } : null, rewardUsed, withoutReward, strict: Boolean(strict) };
  });
}

export function runPathFor(seed) {
  const enemies = generateEnemies(seed);
  let loadout = [...INITIAL_PARTS];
  let hp = MAX_HP;
  const battles = [];
  for (let i = 0; i < enemies.length; i += 1) {
    const metrics = evaluateBattle(loadout, enemies[i], hp);
    const battle = { battle: i + 1, loadout: [...loadout], enemy: enemies[i], hpStart: hp, metrics };
    battles.push(battle);
    if (!metrics.best) break;
    hp = metrics.best.hp;
    if (i < 2) {
      const offers = evaluateRewardChoice(seed, i + 1, loadout, hp, enemies[i + 1]);
      const selected = offers.flatMap(x => x.best ? [{ ...x.best, reward: x.reward }] : []).sort((a, b) => compareOutcomes(b.best, a.best))[0];
      if (!selected) break;
      battle.offer = offers.map(x => x.reward);
      battle.chosenReward = selected;
      loadout = [...selected.loadout];
    }
  }
  return { seed, enemies, battles, complete: battles.length === 3 && battles.every(x => x.metrics.best?.won) };
}

export function fixedPolicy(parts, enemy, hp, kind) {
  let state = initialState(parts, enemy, hp);
  const actions = [];
  while (!state.terminal) {
    const legalTypes = legalActions(state);
    if (!legalTypes.length) break;
    let action;
    if (kind === "no-deflector") action = legalTypes.find(x => x !== "deflector") || legalTypes[0];
    else if (kind === "max-damage") action = [...legalTypes].sort((a, b) => ({ collapse: 10, nail: 5, generator: 0, capacitor: 0, deflector: 0, follow: 0 }[b] - ({ collapse: 10, nail: 5, generator: 0, capacitor: 0, deflector: 0, follow: 0 }[a])))[0];
    else if (kind === "alternate") action = legalTypes.find(x => ["generator", "nail"].includes(x)) || legalTypes[0];
    else if (kind === "accumulate-then-attack") action = state.energy < 1 ? (legalTypes.find(x => ["generator", "capacitor"].includes(x)) || legalTypes[0]) : (legalTypes.find(x => ["collapse", "nail"].includes(x)) || legalTypes[0]);
    else if (kind === "defend-only") action = legalTypes.find(x => x === "deflector") || legalTypes[0];
    else action = legalTypes[0];
    actions.push(action);
    state = step(state, action).state;
  }
  return { won: state.won, hp: state.hp, turns: state.turn, actions, log: state.log };
}

export function evaluateSeed(seed) {
  const path = runPathFor(seed);
  const gateB = path.complete && path.battles.every(b => Boolean(findPredictionWitness(b.loadout, b.enemy, b.hpStart)));
  const gateC = path.complete && (() => {
    const hasRevisit = path.battles.some(b => usesRevisitPattern(b.metrics.best.actions));
    const macrosRejected = ["accumulate-then-attack", "alternate", "no-deflector", "max-damage"].every(kind => {
      const results = path.battles.map(b => fixedPolicy(b.loadout, b.enemy, b.hpStart, kind));
      return results.some((x, i) => !x.won || x.hp !== path.battles[i].metrics.best.hp);
    });
    return hasRevisit && macrosRejected;
  })();
  const gateD = path.complete && (() => {
    const b = path.battles[0];
    const winners = b.metrics.outcomes.filter(x => x.won);
    const withShield = winners.filter(x => x.actions.includes("deflector"));
    const withoutShield = winners.filter(x => !x.actions.includes("deflector"));
    const overuse = b.metrics.outcomes.find(x => x.actions.filter(a => a === "deflector").length >= 2 && !x.won);
    const shieldAndAccept = withShield.length && withoutShield.length && withShield[0].hp !== withoutShield[0].hp;
    return Boolean(withShield.length && overuse && shieldAndAccept);
  })();
  const gateE = path.complete && path.battles.slice(0, 2).every(b => {
    const choices = evaluateRewardChoice(seed, b.battle, b.loadout, b.metrics.best.hp, path.enemies[b.battle]);
    if (choices.length !== 2 || choices.some(x => !x.best)) return false;
    return choices.every(x => x.strict && x.rewardUsed?.won && x.withoutReward?.won && compareOutcomes(x.rewardUsed, x.withoutReward) > 0)
      && choices[0].rewardUsed.actions.join(",") !== choices[1].rewardUsed.actions.join(",");
  });
  return { seed, path, gateB, gateC, gateD, gateE, pass: gateB && gateC && gateD && gateE };
}

export function evaluateReferences() {
  const base = { hp: 20, attacks: Array(MAX_TURNS).fill(0), maxTurns: MAX_TURNS };
  const allZero = evaluateBattle(INITIAL_PARTS, { ...base, name: "all-zero" });
  const allOne = evaluateBattle(INITIAL_PARTS, { ...base, name: "all-one", attacks: Array(MAX_TURNS).fill(1) });
  const attackOnly = evaluateBattle(["generator", "nail", "nail"], { ...base, name: "attack-only", hp: 15 });
  const defendSafeEnemy = { ...base, name: "defend-safe", attacks: Array(MAX_TURNS).fill(0) };
  const defendSafe = fixedPolicy(INITIAL_PARTS, defendSafeEnemy, MAX_HP, "defend-only");
  const rewardIrrelevant = evaluateBattle(INITIAL_PARTS, { ...base, name: "reward-irrelevant", hp: 10 });
  const rewardBaseline = bestWinningOutcome(enumerateBattle({ parts: INITIAL_PARTS, enemy: rewardIrrelevant.enemy }));
  return {
    allZero: { rejected: !validAttackSequence(allZero.enemy.attacks), detail: { wins: allZero.wins, total: allZero.total, attacks: allZero.enemy.attacks } },
    allOne: { rejected: !validAttackSequence(allOne.enemy.attacks), detail: { wins: allOne.wins, total: allOne.total, attacks: allOne.enemy.attacks } },
    attackOnly: { rejected: Boolean(attackOnly.best?.won && attackOnly.best.actions.every(x => ["generator", "nail"].includes(x))), detail: { best: attackOnly.best } },
    defendSafe: { rejected: Boolean(defendSafeEnemy.attacks.every(x => x <= 1)), detail: { policy: defendSafe, attacks: defendSafeEnemy.attacks } },
    rewardIrrelevant: { rejected: Boolean(rewardBaseline?.won && !rewardBaseline.actions.some(x => ["collapse", "capacitor", "follow"].includes(x))), detail: { best: rewardBaseline } }
  };
}
