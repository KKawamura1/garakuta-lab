import { strict as assert } from "node:assert";
import {
  INITIAL_PARTS, MAX_HP, MAX_TURNS, PARTS, offerFor, replacementLoadouts,
  simulateBattle, stateFromActions, legalActions, step, bestOutcome,
  compareOutcomes
} from "../core/control02.mjs";
import {
  clearCaches, enumerateCachedBattle, optimalCampaign, campaign, gateA, gateB,
  gateC, gateD, gateE, gateF, evaluateSeed, policyAction, ACTION_ORDER,
  validateTrace
} from "./gate-control02.mjs";

const failures = [];

function check(name, condition, detail = null) {
  if (!condition) failures.push({ name, detail });
  return Boolean(condition);
}

function naiveOutcome(state) {
  return {
    won: state.won,
    hp: state.hp,
    enemyHp: state.enemyHp,
    turns: state.turn,
    actions: [],
    log: []
  };
}

function prepend(action, next, tail) {
  return {
    ...tail,
    actions: [action, ...tail.actions],
    log: [next.log[next.log.length - 1], ...tail.log]
  };
}

export function naiveEnumerate(parts, enemy, hp = MAX_HP, energy = 0, attackOverride = null) {
  const start = stateFromActions({ parts, enemy, hp, energy }).state;
  const outcomes = [];
  const visit = state => {
    if (state.terminal) {
      outcomes.push({
        ...naiveOutcome(state),
        actions: state.log.map(event => event.action),
        log: state.log
      });
      return;
    }
    const actions = legalActions(state);
    if (!actions.length) {
      outcomes.push({
        ...naiveOutcome(state),
        won: false,
        actions: state.log.map(event => event.action),
        log: state.log
      });
      return;
    }
    for (const action of actions) {
      visit(step(state, action, attackOverride).state);
    }
  };
  visit(start);
  return outcomes;
}

function naiveBestContinuation(state, attackOverride = null) {
  if (state.terminal || !legalActions(state).length) {
    return { best: naiveOutcome(state), optimal: [], choices: [] };
  }
  const choices = legalActions(state).map(action => {
    const next = step(state, action, attackOverride).state;
    const tail = naiveBestContinuation(next, attackOverride);
    return { action, result: prepend(action, next, tail.best) };
  });
  const best = bestOutcome(choices.map(choice => choice.result));
  return {
    best,
    choices,
    optimal: choices
      .filter(choice => best && compareOutcomes(choice.result, best) === 0)
      .map(choice => choice.action)
  };
}

function naiveActionValues(parts, enemy, hp, prefix, attack) {
  const state = stateFromActions({ parts, enemy, actions: prefix, hp }).state;
  if (state.terminal) return { state, choices: [], optimal: [], best: null };
  const override = [...enemy.attacks];
  override[state.turn] = attack;
  const continuation = naiveBestContinuation(state, override);
  return {
    state,
    choices: continuation.choices,
    optimal: continuation.optimal,
    best: continuation.best
  };
}

function naivePredictionWitness(parts, enemy, hp, requireDeflector = false) {
  for (const outcome of naiveEnumerate(parts, enemy, hp)) {
    for (let length = 0; length <= outcome.actions.length; length += 1) {
      const prefix = outcome.actions.slice(0, length);
      const zero = naiveActionValues(parts, enemy, hp, prefix, 0);
      const high = naiveActionValues(parts, enemy, hp, prefix, 7);
      const different = zero.optimal.join(",") !== high.optimal.join(",");
      const deflectorUnique = requireDeflector
        && high.optimal.length === 1
        && high.optimal[0] === "deflector"
        && !zero.optimal.includes("deflector");
      if (zero.optimal.length && high.optimal.length
        && different && (!requireDeflector || deflectorUnique)) {
        return { prefix, zero, high };
      }
    }
  }
  return null;
}

function naivePolicyAction(kind, state) {
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
    return [...legal].sort((a, b) => (
      damage[b] - damage[a] || ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b)
    ))[0];
  }
  if (kind === "ignore-next-attack") {
    const planned = naiveBestContinuation(state, Array(MAX_TURNS).fill(0));
    return [...planned.optimal].sort((a, b) => (
      ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b)
    ))[0] || legal[0];
  }
  throw new Error("unknown policy: " + kind);
}

function naivePlayPolicy(parts, enemy, hp, kind) {
  let state = stateFromActions({ parts, enemy, hp }).state;
  const actions = [];
  while (!state.terminal) {
    const action = naivePolicyAction(kind, state);
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

function naiveCampaign(seed, chooser, context = {}) {
  const enemies = context.enemies || optimalCampaign(seed).enemies;
  const rewardProvider = context.offerFor || offerFor;
  const score = result => [result.defeated, result.hp, -result.turns];
  const compare = (a, b) => {
    const x = score(a);
    const y = score(b);
    for (let i = 0; i < x.length; i += 1) {
      if (x[i] !== y[i]) return x[i] - y[i];
    }
    return 0;
  };
  const bestCampaign = results => [...results].sort((a, b) => (
    compare(b, a) || a.tie.localeCompare(b.tie)
  ))[0];

  const visit = (battle, parts, hp, rows, tie) => {
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
        seed, enemies, defeated: battle, hp: result.hp,
        turns: rows.concat(row).reduce((total, item) => total + item.result.turns, 0),
        rows: rows.concat(row), tie
      }];
    }
    if (battle === 2) {
      return [{
        seed, enemies, defeated: 3, hp: result.hp,
        turns: rows.concat(row).reduce((total, item) => total + item.result.turns, 0),
        rows: rows.concat(row), tie
      }];
    }
    const offers = rewardProvider(seed, battle + 1, parts);
    const results = [];
    for (const reward of offers) {
      for (const option of replacementLoadouts(parts, reward)) {
        results.push(...visit(
          battle + 1,
          option.loadout,
          result.hp,
          rows.concat({
            ...row,
            offer: [...offers],
            reward,
            replaced: option.replaced
          }),
          tie + "|" + reward + ":" + option.replaced
        ));
      }
    }
    return results;
  };
  return bestCampaign(visit(0, INITIAL_PARTS, MAX_HP, [], ""));
}

function signature(result) {
  return {
    defeated: result.defeated,
    hp: result.hp,
    turns: result.turns,
    rows: result.rows.map(row => ({
      battle: row.battle,
      parts: row.parts,
      hpStart: row.hpStart,
      reward: row.reward || null,
      replaced: row.replaced || null,
      result: {
        won: row.result.won,
        hp: row.result.hp,
        enemyHp: row.result.enemyHp,
        turns: row.result.turns,
        actions: row.result.actions
      }
    }))
  };
}

function canonicalOutcomes(outcomes) {
  return JSON.stringify(outcomes.map(outcome => ({
    won: outcome.won,
    hp: outcome.hp,
    enemyHp: outcome.enemyHp,
    turns: outcome.turns,
    actions: outcome.actions,
    log: outcome.log
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

function naiveGateD(row) {
  if (!row) return { pass: false };
  const outcomes = naiveEnumerate(row.parts, row.enemy, row.hpStart);
  const winners = outcomes.filter(outcome => outcome.won);
  if (!winners.length) return { pass: false };
  const maxHp = Math.max(...winners.map(outcome => outcome.hp));
  const maxWinners = winners.filter(outcome => outcome.hp === maxHp);
  const overuse = outcomes.find(outcome => (
    outcome.actions.filter(action => action === "deflector").length >= 2
    && (!outcome.won || outcome.hp < maxHp)
  ));
  const high = outcome => outcome.log.filter(event => event.enemyActualAttack >= 7);
  const allDeflect = winners.find(outcome => (
    high(outcome).length
    && high(outcome).every(event => event.action === "deflector" && event.damageTaken === 0)
  ));
  const take = winners.find(outcome => (
    high(outcome).some(event => event.action !== "deflector" && event.damageTaken > 0)
    && outcome.turns < (allDeflect?.turns ?? Infinity)
  ));
  return {
    pass: maxWinners.length > 0
      && maxWinners.every(outcome => outcome.actions.includes("deflector"))
      && Boolean(overuse && allDeflect && take
        && (allDeflect.hp !== take.hp || allDeflect.turns !== take.turns))
  };
}

function naiveExchangeWitness(beforeParts, afterParts, enemy, hp) {
  const prefixes = new Map([["", []]]);
  for (const outcome of naiveEnumerate(beforeParts, enemy, hp)) {
    for (let length = 0; length <= outcome.actions.length; length += 1) {
      const prefix = outcome.actions.slice(0, length);
      prefixes.set(prefix.join(","), prefix);
    }
  }
  for (const prefix of [...prefixes.values()].sort((a, b) => a.length - b.length)) {
    const beforeRun = stateFromActions({ parts: beforeParts, enemy, actions: prefix, hp });
    const afterRun = stateFromActions({ parts: afterParts, enemy, actions: prefix, hp });
    if (!beforeRun.ok || !afterRun.ok || beforeRun.state.terminal || afterRun.state.terminal) continue;
    const before = naiveBestContinuation(beforeRun.state);
    const after = naiveBestContinuation(afterRun.state);
    if (before.optimal.join(",") !== after.optimal.join(",")) return true;
  }
  return false;
}

function naiveGateE(seed, optimal, context = {}) {
  const enemies = context.enemies || optimal.enemies;
  const rewardProvider = context.offerFor || offerFor;
  const groups = optimal.rows.slice(0, 2).map(row => (
    rewardProvider(seed, row.battle, row.parts).map(reward => {
      const options = replacementLoadouts(row.parts, reward).map(option => {
        const outcomes = naiveEnumerate(option.loadout, enemies[row.battle], row.result.hp);
        const used = bestOutcome(outcomes.filter(outcome => outcome.actions.includes(reward)));
        const no = bestOutcome(outcomes.filter(outcome => !outcome.actions.includes(reward)));
        const best = bestOutcome(outcomes);
        const all = best ? outcomes.filter(outcome => compareOutcomes(outcome, best) === 0) : [];
        const strict = Boolean(used && no && all.some(outcome => (
          outcome.actions.join(",") === used.actions.join(",")
            && outcome.hp === used.hp
            && outcome.won === used.won
        )) && compareOutcomes(used, no) > 0);
        return {
          option,
          strict,
          used,
          no,
          exchangeWitness: naiveExchangeWitness(row.parts, option.loadout, enemies[row.battle], row.result.hp)
        };
      });
      return {
        reward,
        options,
        usefulOptions: options.filter(option => option.strict && option.used.won)
      };
    })
  ));
  const valid = groups.length === 2 && groups.every(group => (
    group.length === 2 && group.every(reward => reward.usefulOptions.length > 0)
  ));
  const changed = groups.length === 2 && groups.every(group => (
    group.length === 2 && group[0].options.some(left => group[1].options.some(right => (
      left.used && right.used
        && left.used.actions.join(",") !== right.used.actions.join(",")
    )))
  ));
  const exchange = groups.length === 2 && groups.every(group => (
    group.length === 2 && group.every(reward => reward.options.some(option => option.exchangeWitness))
  ));
  return { pass: valid && changed && exchange };
}

function naiveGateB(optimal) {
  if (optimal.defeated !== 3 || optimal.rows.length !== 3) return false;
  return optimal.rows.every(row => {
    const hp = row.hpStart;
    const any = naivePredictionWitness(row.parts, row.enemy, hp);
    const def = row.parts.includes("deflector")
      ? naivePredictionWitness(row.parts, row.enemy, hp, true)
      : null;
    return Boolean(any && (!row.parts.includes("deflector") || def));
  });
}

function naiveGateC(seed, optimal, context = {}) {
  if (optimal.defeated !== 3) return false;
  const enemies = context.enemies || optimal.enemies;
  const offerProvider = context.offerFor || offerFor;
  const kinds = [
    "accumulate-then-attack", "alternate", "ignore-next-attack",
    "no-deflector", "max-damage"
  ];
  const fixed = kinds.map(kind => naiveCampaign(
    seed,
    (parts, enemy, hp) => naivePlayPolicy(parts, enemy, hp, kind),
    { enemies, offerFor: offerProvider }
  ));
  const revisit = optimal.rows.some(row => {
    const actions = row.result.actions;
    return actions.some((action, index) => (
      ["nail", "collapse", "deflector"].includes(action)
      && actions.slice(0, index).some(item => ["generator", "capacitor"].includes(item))
      && actions.slice(index + 1).some(item => ["generator", "capacitor"].includes(item))
    ));
  });
  return revisit && fixed.every(result => (
    result.defeated < 3
    && compareCampaignSignatures(result, optimal) < 0
  ));
}

function compareCampaignSignatures(a, b) {
  const score = result => [result.defeated, result.hp, -result.turns];
  const x = score(a);
  const y = score(b);
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}

function makeEFixture(offerProvider = () => ["collapse", "capacitor"]) {
  const attacks = [0, 0, 9, 0, 0, 9, 1, 1];
  const enemies = [0, 1, 2].map(index => ({
    id: "fixture-" + index,
    hp: 15,
    attacks: [...attacks],
    maxTurns: MAX_TURNS
  }));
  return {
    defeated: 3,
    hp: 30,
    turns: 0,
    enemies,
    rows: [1, 2].map(battle => ({
      battle,
      parts: [...INITIAL_PARTS],
      hpStart: 30,
      result: { won: true, hp: 30, turns: 1, actions: ["generator"] }
    })),
    offerProvider
  };
}

function runFixtures() {
  const enemy = {
    hp: 20,
    attacks: [0, 7, 1, 8, 0, 6, 2, 9],
    maxTurns: MAX_TURNS
  };
  const goodA = simulateBattle({
    parts: INITIAL_PARTS,
    enemy,
    actions: ["generator", "deflector", "generator", "nail"]
  });
  const brokenA = structuredClone(goodA);
  brokenA.log[0].hpAfter += 1;

  const goodB = evaluateSeed(25).b.pass;
  const badB = !gateB({
    defeated: 3,
    rows: Array.from({ length: 3 }, (_, index) => ({
      battle: index + 1,
      parts: [],
      enemy,
      hpStart: MAX_HP,
      result: { won: true, hp: MAX_HP, turns: 1, actions: [] }
    }))
  }).pass;

  const goodC = evaluateSeed(1301).c.pass;
  const cBase = evaluateSeed(1301).optimal;
  const badC = !gateC(1301, {
    ...cBase,
    rows: cBase.rows.map(row => ({
      ...row,
      result: { ...row.result, actions: ["generator", "nail"] }
    }))
  }).pass;

  const goodD = evaluateSeed(22).d.pass;
  const badD = !gateD({
    parts: [...INITIAL_PARTS],
    hpStart: MAX_HP,
    enemy: { ...enemy, attacks: Array(MAX_TURNS).fill(0) }
  }).pass;

  const eFixture = makeEFixture();
  clearCaches();
  const goodE = gateE(0, eFixture, {
    enemies: eFixture.enemies,
    offerFor: eFixture.offerProvider
  });
  const badE = gateE(0, eFixture, {
    enemies: eFixture.enemies,
    offerFor: () => ["collapse", "follow"]
  });
  const hasBadExchange = goodE.evidence[0]?.[0]?.options.some(option => !option.strict);

  const neutralEnemy = {
    hp: 25,
    attacks: [9, 0, 9, 0, 0, 6, 0, 1],
    maxTurns: MAX_TURNS
  };
  const progressed = stateFromActions({
    parts: INITIAL_PARTS,
    enemy: neutralEnemy,
    actions: ["generator", "deflector"]
  }).state;
  const ignoreExpected = naivePolicyAction("ignore-next-attack", progressed);
  const ignoreActual = policyAction("ignore-next-attack", progressed);
  const stateRetained = progressed.turn === 2
    && progressed.enemyHp < neutralEnemy.hp
    || progressed.turn === 2 && progressed.energy !== 0;

  return {
    A: {
      positive: Boolean(goodA.legal && validateTrace(goodA, enemy, MAX_HP).pass),
      negative: !validateTrace(brokenA, enemy, MAX_HP).pass
    },
    B: { positive: goodB, negative: badB },
    C: { positive: goodC, negative: badC },
    D: { positive: goodD, negative: badD },
    E: {
      positive: goodE.pass,
      negative: !badE.pass,
      badExchangeDoesNotVacuouslyFail: Boolean(goodE.pass && hasBadExchange),
      conditions: {
        valid: goodE.valid,
        changed: goodE.changed,
        exchange: goodE.exchange
      }
    },
    F: { positive: gateF().pass },
    ignoreNextAttack: {
      positive: ignoreActual === ignoreExpected,
      stateWasProgressed: stateRetained,
      action: ignoreActual
    }
  };
}

function runEquivalence() {
  const mismatches = [];
  const policyMismatches = [];
  for (let seed = 1; seed <= 10; seed += 1) {
    clearCaches();
    const optimized = evaluateSeed(seed);
    const naiveOptimal = naiveCampaign(
      seed,
      (parts, enemy, hp) => bestOutcome(naiveEnumerate(parts, enemy, hp))
    );
    if (JSON.stringify(signature(optimized.optimal))
      !== JSON.stringify(signature(naiveOptimal))) {
      mismatches.push({ seed, kind: "campaign", optimized: signature(optimized.optimal), naive: signature(naiveOptimal) });
      continue;
    }

    for (const row of optimized.optimal.rows) {
      const cached = enumerateCachedBattle(row.parts, row.enemy, row.hpStart);
      const naive = naiveEnumerate(row.parts, row.enemy, row.hpStart);
      if (canonicalOutcomes(cached) !== canonicalOutcomes(naive)) {
        mismatches.push({ seed, kind: "battle", battle: row.battle });
      }
    }

    const kinds = [
      "accumulate-then-attack", "alternate", "ignore-next-attack",
      "no-deflector", "max-damage"
    ];
    for (const kind of kinds) {
      const optimizedFixed = optimized.c.fixed[kind];
      const naiveFixed = naiveCampaign(
        seed,
        (parts, enemy, hp) => naivePlayPolicy(parts, enemy, hp, kind),
        { enemies: optimized.optimal.enemies }
      );
      if (JSON.stringify(signature(optimizedFixed))
        !== JSON.stringify(signature(naiveFixed))) {
        policyMismatches.push({ seed, kind });
      }
    }

    const naiveFlags = {
      B: naiveGateB(optimized.optimal),
      C: naiveGateC(seed, optimized.optimal, {}),
      D: naiveGateD(optimized.optimal.rows[0]).pass,
      E: naiveGateE(seed, optimized.optimal, {}).pass
    };
    if (JSON.stringify(optimized.flags) !== JSON.stringify(naiveFlags)) {
      mismatches.push({
        seed,
        kind: "gates",
        optimized: optimized.flags,
        naive: naiveFlags
      });
    }
  }
  return {
    passed: mismatches.length === 0 && policyMismatches.length === 0,
    seeds: 10,
    mismatches,
    policyMismatches
  };
}

export function runPreflight() {
  failures.length = 0;
  const fixtures = runFixtures();
  const fixturePassed = Object.entries(fixtures).every(([name, item]) => (
    name === "ignoreNextAttack"
      ? item.positive && item.stateWasProgressed
      : Object.entries(item).filter(([key]) => key === "positive" || key === "negative")
        .every(([, value]) => value)
  ));
  check("fixtures", fixturePassed, fixtures);
  const equivalence = runEquivalence();
  check("naive-vs-optimized", equivalence.passed, equivalence);
  return {
    passed: failures.length === 0,
    failures: [...failures],
    fixtures,
    equivalence
  };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const result = runPreflight();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.passed ? 0 : 1;
}
