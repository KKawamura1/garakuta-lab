import { strict as assert } from "node:assert";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  INITIAL_PARTS, MAX_HP, MAX_TURNS, PARTS, offerFor, replacementLoadouts,
  generateEnemies, simulateBattle, enumerateBattle, bestOutcome, compareOutcomes,
  stateFromActions, legalActions, step
} from "../core/control02.mjs";

export const ACTION_ORDER = ["generator", "nail", "collapse", "deflector", "capacitor", "follow"];
const actionRank = action => ACTION_ORDER.indexOf(action);
const battleCache = new Map();
const suffixCache = new Map();

export function clearCaches() {
  battleCache.clear();
  suffixCache.clear();
}

function battleKey(parts, enemy, hp, energy) {
  return [
    parts.join(","), enemy.hp, enemy.attacks.join(","), enemy.maxTurns || MAX_TURNS,
    hp, energy
  ].join("|");
}

export function enumerateCachedBattle(parts, enemy, hp = MAX_HP, energy = 0) {
  const key = battleKey(parts, enemy, hp, energy);
  if (!battleCache.has(key)) {
    battleCache.set(key, enumerateBattle({ parts, enemy, hp, energy }));
  }
  return battleCache.get(key);
}

function outcomeFromState(state) {
  return {
    won: state.won,
    hp: state.hp,
    enemyHp: state.enemyHp,
    turns: state.turn,
    actions: [],
    log: []
  };
}

function stateKey(state, attackOverride) {
  const previous = state.previous
    ? [state.previous.type, state.previous.effect.kind, state.previous.effect.value]
    : null;
  return JSON.stringify([
    state.parts, state.enemy.hp, state.enemy.attacks, state.turn, state.hp,
    state.enemyHp, state.energy, [...state.disabledUntil.entries()],
    state.nextAttackBonus, previous, Boolean(state.terminal), attackOverride || []
  ]);
}

function prependContinuation(action, next, tail) {
  return {
    ...tail,
    actions: [action, ...tail.actions],
    log: [next.log[next.log.length - 1], ...tail.log]
  };
}

export function bestContinuation(state, attackOverride = null) {
  const key = stateKey(state, attackOverride);
  if (suffixCache.has(key)) return suffixCache.get(key);

  if (state.terminal) {
    const result = {
      state,
      choices: [],
      optimal: [],
      best: outcomeFromState(state)
    };
    suffixCache.set(key, result);
    return result;
  }

  const actions = legalActions(state);
  if (!actions.length) {
    const result = {
      state,
      choices: [],
      optimal: [],
      best: { ...outcomeFromState(state), won: false }
    };
    suffixCache.set(key, result);
    return result;
  }

  const choices = actions.map(action => {
    const next = step(state, action, attackOverride).state;
    const tail = bestContinuation(next, attackOverride);
    return { action, result: prependContinuation(action, next, tail.best) };
  });
  const best = bestOutcome(choices.map(choice => choice.result));
  const optimal = choices
    .filter(choice => best && compareOutcomes(choice.result, best) === 0)
    .map(choice => choice.action);
  const result = { state, choices, optimal, best };
  suffixCache.set(key, result);
  return result;
}

function outcomeSummary(outcome) {
  return {
    won: Boolean(outcome.won),
    timeout: Boolean(outcome.timeout || (!outcome.won && outcome.turns >= MAX_TURNS && outcome.hp > 0)),
    hp: outcome.hp,
    turns: outcome.turns,
    actions: [...outcome.actions]
  };
}

function stateText(state) {
  return {
    hp: state.hp,
    enemyHp: state.enemyHp,
    energy: state.energy,
    parts: [...state.parts],
    disabled: [...state.disabledUntil.entries()],
    bonus: state.nextAttackBonus,
    previous: state.previous?.type ?? null,
    remainingTurns: MAX_TURNS - state.turn,
    turn: state.turn
  };
}

function actionValues(parts, enemy, hp, prefix, attack) {
  const run = stateFromActions({ parts, enemy, actions: prefix, hp });
  const state = run.state;
  if (!run.ok || state.terminal) {
    return { state: stateText(state), choices: [], optimal: [], best: null };
  }
  const override = [...enemy.attacks];
  override[state.turn] = attack;
  const continuation = bestContinuation(state, override);
  return {
    state: stateText(state),
    choices: continuation.choices.map(choice => ({
      action: choice.action,
      result: outcomeSummary(choice.result)
    })),
    optimal: [...continuation.optimal],
    best: continuation.best
  };
}

export function predictionWitness(parts, enemy, hp, requireDeflector = false) {
  for (const outcome of enumerateCachedBattle(parts, enemy, hp)) {
    for (let length = 0; length <= outcome.actions.length; length += 1) {
      const prefix = outcome.actions.slice(0, length);
      const zero = actionValues(parts, enemy, hp, prefix, 0);
      const high = actionValues(parts, enemy, hp, prefix, 7);
      if (!zero.optimal.length || !high.optimal.length) continue;
      const different = zero.optimal.join(",") !== high.optimal.join(",");
      const deflectorUnique = requireDeflector
        && high.optimal.length === 1
        && high.optimal[0] === "deflector"
        && !zero.optimal.includes("deflector");
      if (different && (!requireDeflector || deflectorUnique)) {
        return {
          prefix,
          state: zero.state,
          zero,
          high,
          deflectorUnique
        };
      }
    }
  }
  return null;
}

export function unrestricted(parts, enemy, hp, energy = 0) {
  return bestOutcome(enumerateCachedBattle(parts, enemy, hp, energy));
}

function defaultOfferProvider(seed, battleIndex, owned) {
  return offerFor(seed, battleIndex, owned);
}

function campaignScore(campaignResult) {
  return [campaignResult.defeated, campaignResult.hp, -campaignResult.turns];
}

export function compareCampaigns(a, b) {
  const x = campaignScore(a);
  const y = campaignScore(b);
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}

function campaignBest(results) {
  return [...results].sort((a, b) => (
    compareCampaigns(b, a) || a.tie.localeCompare(b.tie)
  ))[0] || null;
}

export function campaign(seed, chooser, context = {}) {
  const enemies = context.enemies || generateEnemies(seed);
  const rewardProvider = context.offerFor || defaultOfferProvider;

  const visit = (battle, parts, hp, rows, tie) => {
    if (battle === 3) {
      return [{
        seed,
        enemies,
        defeated: 3,
        hp,
        turns: rows.reduce((total, row) => total + row.result.turns, 0),
        rows,
        tie
      }];
    }

    const result = chooser(parts, enemies[battle], hp, battle);
    const row = {
      battle: battle + 1,
      parts: [...parts],
      enemy: enemies[battle],
      hpStart: hp,
      result
    };

    if (!result.won) {
      return [{
        seed,
        enemies,
        defeated: battle,
        hp: result.hp,
        turns: rows.concat(row).reduce((total, item) => total + item.result.turns, 0),
        rows: rows.concat(row),
        tie
      }];
    }

    if (battle === 2) {
      return [{
        seed,
        enemies,
        defeated: 3,
        hp: result.hp,
        turns: rows.concat(row).reduce((total, item) => total + item.result.turns, 0),
        rows: rows.concat(row),
        tie
      }];
    }

    const offers = rewardProvider(seed, battle + 1, parts);
    const next = [];
    for (const reward of offers) {
      for (const option of replacementLoadouts(parts, reward)) {
        const rewardRow = {
          ...row,
          offer: [...offers],
          reward,
          replaced: option.replaced
        };
        next.push(...visit(
          battle + 1,
          option.loadout,
          result.hp,
          rows.concat(rewardRow),
          tie + "|" + reward + ":" + option.replaced
        ));
      }
    }
    return next;
  };

  return campaignBest(visit(0, INITIAL_PARTS, MAX_HP, [], ""));
}

export function optimalCampaign(seed, context = {}) {
  return campaign(seed, (parts, enemy, hp) => unrestricted(parts, enemy, hp), context);
}

export function policyAction(kind, state) {
  const legal = legalActions(state);
  if (!legal.length) return null;

  if (kind === "accumulate-then-attack") {
    return state.energy < 1
      ? legal.find(action => ["generator", "capacitor"].includes(action)) || legal[0]
      : legal.find(action => ["collapse", "nail"].includes(action)) || legal[0];
  }
  if (kind === "alternate") {
    return legal.find(action => ["generator", "nail"].includes(action)) || legal[0];
  }
  if (kind === "no-deflector") {
    return legal.find(action => action !== "deflector") || legal[0];
  }
  if (kind === "max-damage") {
    const damage = {
      collapse: 10, nail: 5, generator: 0, deflector: 0, capacitor: 0, follow: 0
    };
    return [...legal].sort((a, b) => damage[b] - damage[a] || actionRank(a) - actionRank(b))[0];
  }
  if (kind === "ignore-next-attack") {
    const neutralAttacks = Array(MAX_TURNS).fill(0);
    const planned = bestContinuation(state, neutralAttacks);
    return [...planned.optimal].sort((a, b) => actionRank(a) - actionRank(b))[0] || legal[0];
  }
  throw new Error("unknown fixed policy: " + kind);
}

export function playPolicy(parts, enemy, hp, kind) {
  let state = stateFromActions({ parts, enemy, hp }).state;
  const actions = [];
  while (!state.terminal) {
    const action = policyAction(kind, state);
    if (!action) break;
    actions.push(action);
    state = step(state, action).state;
  }
  return {
    won: state.won,
    hp: state.hp,
    turns: state.turn,
    actions,
    log: state.log
  };
}

export function gateB(campaignResult) {
  const witnesses = (campaignResult?.rows || []).map(row => {
    const hp = row.hpStart ?? row.result?.log?.[0]?.hpBefore ?? MAX_HP;
    return {
      battle: row.battle,
      any: predictionWitness(row.parts, row.enemy, hp),
      def: row.parts.includes("deflector")
        ? predictionWitness(row.parts, row.enemy, hp, true)
        : null
    };
  });
  const pass = campaignResult?.defeated === 3
    && witnesses.length === 3
    && witnesses.every(item => item.any
      && (!campaignResult.rows.find(row => row.battle === item.battle).parts.includes("deflector")
        || item.def));
  return { pass, witnesses };
}

export function gateC(seed, optimal, context = {}) {
  const enemies = context.enemies || optimal?.enemies || generateEnemies(seed);
  const offerProvider = context.offerFor || defaultOfferProvider;
  const kinds = [
    "accumulate-then-attack",
    "alternate",
    "ignore-next-attack",
    "no-deflector",
    "max-damage"
  ];
  const fixed = Object.fromEntries(kinds.map(kind => [
    kind,
    campaign(
      seed,
      (parts, enemy, hp) => playPolicy(parts, enemy, hp, kind),
      { enemies, offerFor: offerProvider }
    )
  ]));
  const optimalRevisit = (optimal?.rows || []).some(row => {
    const actions = row.result.actions;
    return actions.some((action, index) => (
      ["nail", "collapse", "deflector"].includes(action)
      && actions.slice(0, index).some(item => ["generator", "capacitor"].includes(item))
      && actions.slice(index + 1).some(item => ["generator", "capacitor"].includes(item))
    ));
  });
  const rejected = Object.values(fixed).every(result => (
    result.defeated < 3
    && compareCampaigns(result, optimal) < 0
  ));
  return {
    pass: Boolean(optimal && optimal.defeated === 3 && optimalRevisit && rejected),
    fixed,
    revisit: optimalRevisit
  };
}

export function gateD(row) {
  if (!row) return { pass: false };
  const hpStart = row.hpStart ?? MAX_HP;
  const outcomes = enumerateCachedBattle(row.parts, row.enemy, hpStart);
  const winners = outcomes.filter(outcome => outcome.won);
  if (!winners.length) return { pass: false, winners: [] };

  const maxHp = Math.max(...winners.map(outcome => outcome.hp));
  const maxWinners = winners.filter(outcome => outcome.hp === maxHp);
  const overuse = outcomes.find(outcome => (
    outcome.actions.filter(action => action === "deflector").length >= 2
    && (!outcome.won || outcome.hp < maxHp)
  ));
  const highAttacks = outcome => outcome.log.filter(item => item.enemyActualAttack >= 7);
  const allDeflect = winners.find(outcome => {
    const high = highAttacks(outcome);
    return high.length > 0
      && high.every(item => item.action === "deflector" && item.damageTaken === 0);
  });
  const takeDamage = winners.find(outcome => {
    const high = highAttacks(outcome);
    return high.some(item => item.action !== "deflector" && item.damageTaken > 0)
      && outcome.turns < (allDeflect?.turns ?? Infinity);
  });

  return {
    pass: maxWinners.length > 0
      && maxWinners.every(outcome => outcome.actions.includes("deflector"))
      && Boolean(overuse && allDeflect && takeDamage
        && (allDeflect.hp !== takeDamage.hp || allDeflect.turns !== takeDamage.turns)),
    maxHp,
    maxWinners,
    overuse,
    allDeflect,
    takeDamage
  };
}

function sameOutcome(a, b) {
  return Boolean(a && b)
    && a.won === b.won
    && a.hp === b.hp
    && a.enemyHp === b.enemyHp
    && a.turns === b.turns
    && a.actions.join(",") === b.actions.join(",");
}

function optionOutcomeSet(loadout, enemy, hp) {
  return enumerateCachedBattle(loadout, enemy, hp);
}

function rewardEvidenceFor(row, enemy, offers) {
  return offers.map(reward => {
    const options = replacementLoadouts(row.parts, reward).map(option => {
      const outcomes = optionOutcomeSet(option.loadout, enemy, row.result.hp);
      const used = bestOutcome(outcomes.filter(outcome => outcome.actions.includes(reward)));
      const no = bestOutcome(outcomes.filter(outcome => !outcome.actions.includes(reward)));
      const overall = {
        best: bestOutcome(outcomes),
        all: []
      };
      if (overall.best) {
        overall.all = outcomes.filter(outcome => compareOutcomes(outcome, overall.best) === 0);
      }
      const usedIsOverall = Boolean(
        used
        && overall.all.some(outcome => sameOutcome(outcome, used))
      );
      const strict = Boolean(
        used
        && no
        && usedIsOverall
        && compareOutcomes(used, no) > 0
      );
      return {
        option,
        used,
        no,
        overall,
        strict,
        exchangeWitness: null
      };
    });
    return {
      reward,
      options,
      usefulOptions: options.filter(option => option.strict && option.used.won)
    };
  });
}

export function findExchangeWitness(beforeParts, afterParts, enemy, hp) {
  const beforeOutcomes = enumerateCachedBattle(beforeParts, enemy, hp);
  const prefixes = new Map([["", []]]);
  for (const outcome of beforeOutcomes) {
    for (let length = 0; length <= outcome.actions.length; length += 1) {
      const prefix = outcome.actions.slice(0, length);
      prefixes.set(prefix.join(","), prefix);
    }
  }
  const ordered = [...prefixes.values()].sort((a, b) => a.length - b.length);
  for (const prefix of ordered) {
    const beforeRun = stateFromActions({ parts: beforeParts, enemy, actions: prefix, hp });
    const afterRun = stateFromActions({ parts: afterParts, enemy, actions: prefix, hp });
    if (!beforeRun.ok || !afterRun.ok || beforeRun.state.terminal || afterRun.state.terminal) continue;
    const before = bestContinuation(beforeRun.state);
    const after = bestContinuation(afterRun.state);
    if (before.optimal.join(",") !== after.optimal.join(",")) {
      return {
        prefix,
        state: stateText(beforeRun.state),
        before: {
          state: stateText(beforeRun.state),
          optimal: [...before.optimal],
          best: before.best
        },
        after: {
          state: stateText(afterRun.state),
          optimal: [...after.optimal],
          best: after.best
        }
      };
    }
  }
  return null;
}

export function gateE(seed, optimal, context = {}) {
  const enemies = context.enemies || optimal?.enemies || generateEnemies(seed);
  const offerProvider = context.offerFor || defaultOfferProvider;
  const groups = (optimal?.rows || []).slice(0, 2).map(row => {
    const offers = offerProvider(seed, row.battle, row.parts);
    const evidence = rewardEvidenceFor(row, enemies[row.battle], offers);
    for (const reward of evidence) {
      for (const option of reward.options) {
        option.exchangeWitness = findExchangeWitness(
          row.parts,
          option.option.loadout,
          enemies[row.battle],
          row.result.hp
        );
      }
    }
    return evidence;
  });

  const valid = groups.length === 2
    && groups.every(group => group.length === 2
      && group.every(reward => reward.usefulOptions.length > 0));

  const changed = groups.length === 2
    && groups.every(group => group.length === 2
      && group[0].options.some(left => group[1].options.some(right => (
        left.overall.best
        && right.overall.best
        && left.overall.best.actions.join(",") !== right.overall.best.actions.join(",")
      ))));

  const exchange = groups.length === 2
    && groups.every(group => group.length === 2
      && group.every(reward => reward.options.some(option => option.exchangeWitness)));

  return {
    pass: Boolean(valid && changed && exchange),
    valid,
    changed,
    exchange,
    evidence: groups
  };
}

function validAttackSequence(attacks) {
  return attacks.filter(value => value === 0).length >= 2
    && attacks.filter(value => value >= 6).length >= 2
    && !attacks.some((value, index) => (
      index >= 3
      && value === attacks[index - 1]
      && value === attacks[index - 2]
      && value === attacks[index - 3]
    ));
}

export function validateTrace(result, enemy, initialHp = MAX_HP, initialEnergy = 0) {
  const required = [
    "hpBefore", "enemyHpBefore", "energyBefore", "nextAttack",
    "disabledBefore", "bonusBefore", "effect", "enemyPlannedAttack",
    "enemyActualAttack", "hpAfter", "enemyHpAfter", "energyAfter",
    "disabledAfter", "bonusAfter", "result"
  ];
  const errors = [];
  let hp = initialHp;
  let enemyHp = enemy.hp;
  let energy = initialEnergy;
  let bonus = 0;
  let disabled = [];
  for (const [index, event] of result.log.entries()) {
    for (const key of required) {
      if (!(key in event)) errors.push("missing:" + key + "@" + index);
    }
    if (event.turn !== index + 1) errors.push("turn@" + index);
    if (event.hpBefore !== hp) errors.push("hpBefore@" + index);
    if (event.enemyHpBefore !== enemyHp) errors.push("enemyHpBefore@" + index);
    if (event.energyBefore !== energy) errors.push("energyBefore@" + index);
    if (event.nextAttack !== enemy.attacks[index]) errors.push("nextAttack@" + index);
    if (event.enemyPlannedAttack !== event.nextAttack) errors.push("planned@" + index);

    const cost = PARTS[event.action]?.cost;
    if (cost === undefined) {
      errors.push("unknown-action@" + index);
      continue;
    }
    const afterCost = energy - cost;
    const effect = event.effect || {};
    const effectKind = effect.kind;
    const effectValue = effect.value || 0;
    const bonusBefore = bonus;
    const expectedEnergy = afterCost + (effectKind === "energy" ? effectValue : 0);
    const expectedEnemyHp = effectKind === "damage"
      ? Math.max(0, enemyHp - effectValue - bonusBefore)
      : enemyHp;
    const expectedBonus = effectKind === "bonus"
      ? bonus + effectValue
      : effectKind === "damage" ? 0 : bonus;
    if (event.bonusBefore !== bonusBefore) errors.push("bonusBefore@" + index);
    if (event.energyAfterEffect !== expectedEnergy) errors.push("energyAfterEffect@" + index);
    if (event.enemyHpAfter !== expectedEnemyHp) errors.push("enemyHpAfter@" + index);
    if (event.bonusAfter !== expectedBonus) errors.push("bonusAfter@" + index);

    if (expectedEnemyHp <= 0) {
      if (event.enemyActualAttack !== 0) errors.push("dead-attack@" + index);
    } else if (event.enemyActualAttack !== event.nextAttack) {
      errors.push("actual-attack@" + index);
    }
    const shield = effectKind === "shield" ? effectValue : 0;
    const expectedDamage = expectedEnemyHp <= 0
      ? 0
      : Math.max(0, event.enemyActualAttack - shield);
    const expectedHp = Math.max(0, hp - expectedDamage);
    if (event.damageTaken !== undefined && event.damageTaken !== expectedDamage) {
      errors.push("damage@" + index);
    }
    if (event.hpAfter !== expectedHp) errors.push("hpAfter@" + index);
    if (event.energyAfter !== expectedEnergy) errors.push("energyAfter@" + index);
    if (event.enemyActualAttack !== event.enemyPlannedAttack && expectedEnemyHp > 0) {
      errors.push("attack-plan-mismatch@" + index);
    }

    const expectedResult = expectedEnemyHp <= 0
      ? "win"
      : expectedHp <= 0
        ? "loss"
        : index + 1 >= MAX_TURNS
          ? "timeout"
          : "continue";
    if (event.result !== expectedResult) errors.push("result@" + index);

    const nextDisabled = event.action === "collapse"
      ? [["collapse", index + 2]]
      : disabled;
    if (JSON.stringify(event.disabledBefore) !== JSON.stringify(disabled)) {
      errors.push("disabledBefore@" + index);
    }
    if (JSON.stringify(event.disabledAfter) !== JSON.stringify(nextDisabled)) {
      errors.push("disabledAfter@" + index);
    }

    hp = expectedHp;
    enemyHp = expectedEnemyHp;
    energy = expectedEnergy;
    bonus = expectedBonus;
    disabled = nextDisabled;
  }
  if (result.hp !== hp) errors.push("final-hp");
  if (result.enemyHp !== enemyHp) errors.push("final-enemy-hp");
  if (result.energy !== energy) errors.push("final-energy");
  return { pass: errors.length === 0, errors };
}

export function gateA() {
  const enemy = { hp: 20, attacks: [0, 7, 1, 8, 0, 6, 2, 9], maxTurns: MAX_TURNS };
  const result = simulateBattle({
    parts: INITIAL_PARTS,
    enemy,
    actions: ["generator", "deflector", "generator", "nail"]
  });
  assert(result.legal);
  const trace = validateTrace(result, enemy, MAX_HP, 0);
  return {
    pass: trace.pass,
    scope: "A-calc only; UI and persistent-event three-way agreement not executed",
    trace
  };
}

function referenceEnemies(name, hp, attacks) {
  return Array.from({ length: 3 }, (_, index) => ({
    id: name + "-" + (index + 1),
    name: name + "-" + (index + 1),
    hp,
    attacks: [...attacks],
    maxTurns: MAX_TURNS
  }));
}

function referenceSummary(reference, optimal, gates) {
  return {
    name: reference.name,
    target: reference.target,
    reason: reference.reason,
    rejected: !gates[reference.target].pass,
    complete: optimal?.defeated === 3,
    semantic: {
      B: gates.B.pass,
      C: gates.C.pass,
      D: gates.D.pass,
      E: gates.E.pass
    },
    input: {
      hp: reference.enemies[0].hp,
      attacks: reference.enemies[0].attacks,
      validAttackSequence: validAttackSequence(reference.enemies[0].attacks)
    }
  };
}

export function gateF() {
  const references = [
    {
      name: "all-zero",
      target: "D",
      reason: "高攻撃を含まないため、防御の使い所と代償を意味的に作れない",
      enemies: referenceEnemies("all-zero", 20, Array(MAX_TURNS).fill(0))
    },
    {
      name: "all-one",
      target: "D",
      reason: "高攻撃を含まないため、偏向板の選択差を意味的に作れない",
      enemies: referenceEnemies("all-one", 20, Array(MAX_TURNS).fill(1))
    },
    {
      name: "attack-only",
      target: "C",
      reason: "蓄積後の攻撃連打が最適で、再訪と固定マクロ拒否を満たさない",
      enemies: referenceEnemies("attack-only", 15, [0, 0, 1, 1, 0, 1, 0, 1])
    },
    {
      name: "defend-safe",
      target: "D",
      reason: "防御していればほぼ無傷で、受けて早く倒す代償を作れない",
      enemies: referenceEnemies("defend-safe", 20, Array(MAX_TURNS).fill(1))
    },
    {
      name: "reward-irrelevant",
      target: "E",
      reason: "次戦HPが低く、報酬を使わない初期部品だけの勝利が最適",
      enemies: referenceEnemies("reward-irrelevant", 5, [0, 0, 9, 0, 0, 9, 1, 1]),
      offerFor: () => ["collapse", "capacitor"]
    }
  ];

  const results = [];
  for (const reference of references) {
    clearCaches();
    const context = { enemies: reference.enemies, offerFor: reference.offerFor };
    const optimal = optimalCampaign(0, context);
    const gates = {
      B: gateB(optimal),
      C: gateC(0, optimal, context),
      D: gateD(optimal?.rows?.[0]),
      E: gateE(0, optimal, context)
    };
    results.push(referenceSummary(reference, optimal, gates));
  }
  return {
    pass: results.every(result => result.rejected),
    references: results
  };
}

export function evaluateSeed(seed, context = {}) {
  clearCaches();
  const optimal = optimalCampaign(seed, context);
  const b = gateB(optimal);
  const c = gateC(seed, optimal, context);
  const d = optimal?.rows?.[0] ? gateD(optimal.rows[0]) : { pass: false };
  const e = gateE(seed, optimal, context);
  const flags = { B: b.pass, C: c.pass, D: d.pass, E: e.pass };
  return {
    seed,
    flags,
    optimal,
    b,
    c,
    d,
    e
  };
}

function initialCounts() {
  return {
    B: 0, C: 0, D: 0, E: 0,
    BC: 0, BD: 0, CD: 0, BCD: 0, BCDE: 0, all: 0
  };
}

function updateCounts(counts, first, flags, seed) {
  for (const key of ["B", "C", "D", "E"]) {
    if (flags[key]) {
      counts[key] += 1;
      first[key] ??= seed;
    }
  }
  const intersections = {
    BC: flags.B && flags.C,
    BD: flags.B && flags.D,
    CD: flags.C && flags.D,
    BCD: flags.B && flags.C && flags.D,
    BCDE: flags.B && flags.C && flags.D && flags.E,
    all: flags.B && flags.C && flags.D && flags.E
  };
  for (const [key, value] of Object.entries(intersections)) {
    if (value) {
      counts[key] += 1;
      first[key] ??= seed;
    }
  }
}

function pushTop(top, evaluation) {
  top.push({
    seed: evaluation.seed,
    score: Object.values(evaluation.flags).filter(Boolean).length,
    flags: evaluation.flags,
    optimal: evaluation.optimal,
    b: evaluation.b,
    c: evaluation.c,
    d: evaluation.d,
    e: evaluation.e
  });
  top.sort((a, b) => b.score - a.score || a.seed - b.seed);
  top.length = Math.min(top.length, 5);
}

export function runSearch({ limit = 10000, checkpoint = null } = {}) {
  const preflight = { gateA: gateA(), gateF: gateF() };
  if (!preflight.gateA.pass || !preflight.gateF.pass) {
    return {
      ruleset: "control-0.2-calc-audit",
      limit,
      preflight,
      aborted: true,
      reason: "preflight-failed",
      uiDeploymentAllowed: false
    };
  }

  const saved = checkpoint
    && existsSync(checkpoint)
    && statSync(checkpoint).size
    ? JSON.parse(readFileSync(checkpoint, "utf8"))
    : null;
  const counts = saved?.counts || initialCounts();
  const first = saved?.first || {};
  const top = saved?.top || [];
  for (let seed = saved?.nextSeed || 1; seed <= limit; seed += 1) {
    const evaluation = evaluateSeed(seed);
    updateCounts(counts, first, evaluation.flags, seed);
    pushTop(top, evaluation);
    if (checkpoint && seed % 100 === 0) {
      writeFileSync(checkpoint, JSON.stringify({
        nextSeed: seed + 1, counts, first, top
      }));
    }
    if (evaluation.flags.B && evaluation.flags.C
      && evaluation.flags.D && evaluation.flags.E) {
      if (checkpoint) {
        writeFileSync(checkpoint, JSON.stringify({
          nextSeed: seed + 1, counts, first, top, complete: true,
          firstPass: seed
        }));
      }
      return {
        ruleset: "control-0.2-calc-audit",
        limit: seed,
        preflight,
        counts,
        first,
        top,
        firstPass: seed,
        overallPass: true,
        uiDeploymentAllowed: false
      };
    }
  }

  if (checkpoint) {
    writeFileSync(checkpoint, JSON.stringify({
      nextSeed: limit + 1, counts, first, top, complete: true
    }));
  }
  return {
    ruleset: "control-0.2-calc-audit",
    limit,
    preflight,
    counts,
    first,
    top,
    overallPass: counts.all > 0,
    uiDeploymentAllowed: false
  };
}

function main() {
  const limit = Number(process.env.SEED_LIMIT || 10000);
  const checkpoint = process.env.CHECKPOINT || null;
  const result = runSearch({ limit, checkpoint });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.aborted ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
