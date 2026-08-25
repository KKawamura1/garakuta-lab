import {
  ACTIONS,
  MUTATIONS,
  attachMutation,
  battleStart,
  emptyMutations,
  enumerateBattle,
  legalActions,
  optimalOutcomes,
  persistentKey,
  sequenceKey,
  step,
  unmutatedActions,
  withEnemy,
  winningOutcomes,
} from './graft-core.mjs';

const PAIRS = Object.freeze([
  ['recoil', 'echo'],
  ['recoil', 'tinder'],
  ['echo', 'tinder'],
]);

function makeRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function int(rng, lower, upperInclusive) {
  return lower + Math.floor(rng() * (upperInclusive - lower + 1));
}

function shuffled(rng, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = int(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pre-registered candidate generator.
 *
 * Search domain: integer seed 0..999. Every seed maps to one full run:
 * - starting HP 34, 36, 38, 40, or 42;
 * - first enemy HP in 13..15 (the unmodified opening has at most three attacks),
 *   then three enemy HP values in 12..18;
 * - six displayed attacks per enemy, independently in 0..8;
 * - the three distinct mutation pairs, once each, in a seeded order.
 *
 * The generator has no pass/fail feedback and changes no rule in R1.
 */
export function generateSeed(seed) {
  const rng = makeRng(seed);
  const initialHp = int(rng, 17, 21) * 2;
  const enemies = Array.from({ length: 4 }, (_, index) => {
    const attacks = Array.from({ length: 6 }, () => int(rng, 0, 8));
    // Each battle has at least one announced pressure turn. This is a generator
    // constraint, not a balancing reaction to a passing seed.
    attacks[index % 6] = Math.max(attacks[index % 6], 7);
    return { hp: index === 0 ? int(rng, 13, 15) : int(rng, 12, 18), attacks };
  });
  return {
    seed,
    initialHp,
    enemies,
    offers: shuffled(rng, PAIRS),
  };
}

function persistentFromOutcome(persistent, outcome) {
  return { hp: outcome.state.hp, mutations: { ...persistent.mutations } };
}

function distinctWins(outcomes) {
  const byHp = new Map();
  for (const outcome of outcomes) {
    if (outcome.status === 'won' && !byHp.has(outcome.state.hp)) byHp.set(outcome.state.hp, outcome);
  }
  return [...byHp.values()];
}

function witnessSummary(outcome) {
  return {
    hp: outcome.state.hp,
    energy: outcome.state.energy,
    sequence: outcome.sequence,
    turns: outcome.sequence.length,
  };
}

export class GraftSolver {
  constructor(run) {
    this.run = run;
    this.battleCache = new Map();
    this.optimalCache = new Map();
    this.canFightCache = new Map();
    this.canOfferCache = new Map();
    this.offerCheckCache = new Map();
    this.spineCache = new Map();
  }

  battleKey(persistent, fight) {
    return `${fight}|${persistentKey(persistent)}`;
  }

  outcomes(persistent, fight) {
    const key = this.battleKey(persistent, fight);
    if (!this.battleCache.has(key)) {
      this.battleCache.set(key, enumerateBattle(battleStart(persistent, this.run.enemies[fight]), this.run.enemies[fight]));
    }
    return this.battleCache.get(key);
  }

  wins(persistent, fight, requiredAction = null) {
    const all = this.outcomes(persistent, fight);
    return all.filter((outcome) => outcome.status === 'won'
      && (!requiredAction || outcome.sequence.includes(requiredAction)));
  }

  optimal(persistent, fight) {
    const key = this.battleKey(persistent, fight);
    if (!this.optimalCache.has(key)) {
      this.optimalCache.set(key, optimalOutcomes(battleStart(persistent, this.run.enemies[fight]), this.run.enemies[fight]));
    }
    return this.optimalCache.get(key);
  }

  canCompleteBeforeFight(persistent, fight) {
    const key = this.battleKey(persistent, fight);
    if (this.canFightCache.has(key)) return this.canFightCache.get(key);
    // Store a pessimistic provisional value to make accidental cyclic use visible.
    this.canFightCache.set(key, false);
    for (const outcome of distinctWins(this.outcomes(persistent, fight))) {
      if (fight === 3 || this.canCompleteOffer(persistentFromOutcome(persistent, outcome), fight)) {
        this.canFightCache.set(key, true);
        return true;
      }
    }
    return false;
  }

  canCompleteOffer(boundary, offerIndex, forcedMutation = null, forcedAction = null) {
    const key = `${offerIndex}|${persistentKey(boundary)}|${forcedMutation ?? '*'}|${forcedAction ?? '*'}`;
    if (this.canOfferCache.has(key)) return this.canOfferCache.get(key);
    this.canOfferCache.set(key, false);
    const offered = forcedMutation ? [forcedMutation] : this.run.offers[offerIndex];
    for (const mutation of offered) {
      const actions = forcedAction ? [forcedAction] : unmutatedActions(boundary);
      for (const action of actions) {
        if (!unmutatedActions(boundary).includes(action)) continue;
        const next = attachMutation(boundary, action, mutation);
        if (this.canCompleteBeforeFight(next, offerIndex + 1)) {
          this.canOfferCache.set(key, true);
          return true;
        }
      }
    }
    return false;
  }

  findCompletionAttachment(boundary, offerIndex, mutation) {
    for (const action of unmutatedActions(boundary)) {
      const next = attachMutation(boundary, action, mutation);
      if (this.canCompleteBeforeFight(next, offerIndex + 1)) return { action, next };
    }
    return null;
  }

  checkOffer(boundary, offerIndex) {
    const cacheKey = `${offerIndex}|${persistentKey(boundary)}`;
    if (this.offerCheckCache.has(cacheKey)) return this.offerCheckCache.get(cacheKey);
    const nextFight = offerIndex + 1;
    const preOptimal = this.optimal(boundary, nextFight);
    const preOptimalSequences = new Set(preOptimal.map((outcome) => sequenceKey(outcome.sequence)));
    const bWitnesses = {};
    const fWitnesses = {};
    const cWitnesses = [];

    for (const mutation of this.run.offers[offerIndex]) {
      bWitnesses[mutation] = null;
      fWitnesses[mutation] = null;
      for (const action of unmutatedActions(boundary)) {
        const attached = attachMutation(boundary, action, mutation);
        const nextStart = battleStart(attached, this.run.enemies[nextFight]);
        const usesAction = winningOutcomes(nextStart, this.run.enemies[nextFight], action);
        if (!bWitnesses[mutation] && usesAction.length > 0) {
          bWitnesses[mutation] = { action, battle: witnessSummary(usesAction[0]) };
        }
        const fullClear = this.canCompleteBeforeFight(attached, nextFight);
        if (!fWitnesses[mutation] && fullClear) fWitnesses[mutation] = { action };

        // Gate C uses a stronger, tie-safe test: the post-attachment best set
        // must contain a sequence that was not optimal before the attachment;
        // both sides must be winnable, and the same attachment must still clear
        // the full four-battle run (not merely the immediately displayed battle).
        const postOptimal = this.optimal(attached, nextFight);
        const postNew = postOptimal.find((outcome) => !preOptimalSequences.has(sequenceKey(outcome.sequence)));
        if (preOptimal.some((outcome) => outcome.status === 'won') && postNew && fullClear) {
          cWitnesses.push({
            mutation,
            action,
            before: witnessSummary(preOptimal[0]),
            after: witnessSummary(postNew),
          });
        }
      }
    }
    const result = {
      gateB: this.run.offers[offerIndex].every((mutation) => bWitnesses[mutation] !== null),
      gateC: cWitnesses.length > 0,
      gateF: this.run.offers[offerIndex].every((mutation) => fWitnesses[mutation] !== null),
      bWitnesses,
      fWitnesses,
      cWitnesses,
    };
    this.offerCheckCache.set(cacheKey, result);
    return result;
  }

  /**
   * A single run spine is required to satisfy B/C/F at every actual offer.
   * Each C witness also has a full-run completion, so the recorded reward path
   * is not a disconnected collection of per-gate examples.
   */
  findCertifiedSpine(persistent, fight = 0) {
    const key = this.battleKey(persistent, fight);
    if (this.spineCache.has(key)) return this.spineCache.get(key);
    this.spineCache.set(key, null);
    for (const outcome of distinctWins(this.outcomes(persistent, fight))) {
      if (fight === 3) {
        const done = { fight, battle: witnessSummary(outcome), terminalHp: outcome.state.hp };
        this.spineCache.set(key, done);
        return done;
      }
      const boundary = persistentFromOutcome(persistent, outcome);
      const gate = this.checkOffer(boundary, fight);
      if (!gate.gateB || !gate.gateC || !gate.gateF) continue;
      for (const choice of gate.cWitnesses) {
        const afterAttachment = attachMutation(boundary, choice.action, choice.mutation);
        const tail = this.findCertifiedSpine(afterAttachment, fight + 1);
        if (tail) {
          const node = {
            fight,
            battle: witnessSummary(outcome),
            offer: this.run.offers[fight],
            boundaryHp: boundary.hp,
            gate,
            chosenForSpine: { mutation: choice.mutation, action: choice.action },
            next: tail,
          };
          this.spineCache.set(key, node);
          return node;
        }
      }
    }
    return null;
  }

  viableBoundaries(offerIndex) {
    let beforeFight = [{ hp: this.run.initialHp, mutations: emptyMutations() }];
    for (let fight = 0; fight <= offerIndex; fight += 1) {
      const boundaries = [];
      const after = new Map();
      for (const persistent of beforeFight) {
        for (const outcome of distinctWins(this.outcomes(persistent, fight))) {
          const boundary = persistentFromOutcome(persistent, outcome);
          if (fight === offerIndex) {
            if (this.canCompleteOffer(boundary, fight)) boundaries.push({ boundary, outcome });
          } else {
            for (const mutation of this.run.offers[fight]) {
              for (const action of unmutatedActions(boundary)) {
                const next = attachMutation(boundary, action, mutation);
                if (this.canCompleteBeforeFight(next, fight + 1)) after.set(persistentKey(next), next);
              }
            }
          }
        }
      }
      if (fight === offerIndex) return boundaries;
      beforeFight = [...after.values()];
    }
    return [];
  }

  gateE() {
    const useful = Object.fromEntries(MUTATIONS.map((mutation) => [mutation, new Map()]));
    const examined = [];
    for (let offerIndex = 0; offerIndex < 3; offerIndex += 1) {
      const boundaries = this.viableBoundaries(offerIndex);
      examined.push({ offerIndex, count: boundaries.length });
      for (const { boundary } of boundaries) {
        for (const mutation of this.run.offers[offerIndex]) {
          for (const action of unmutatedActions(boundary)) {
            const attached = attachMutation(boundary, action, mutation);
            if (this.canCompleteBeforeFight(attached, offerIndex + 1) && !useful[mutation].has(action)) {
              useful[mutation].set(action, {
                offerIndex,
                boundaryHp: boundary.hp,
                mutationsBefore: { ...boundary.mutations },
              });
            }
          }
        }
      }
    }
    const witnesses = Object.fromEntries(MUTATIONS.map((mutation) => [
      mutation,
      Object.fromEntries(useful[mutation].entries()),
    ]));
    return {
      pass: gateEPassFromUsefulTargets(useful),
      witnesses,
      examined,
    };
  }
}

function chooseFallback(state, preferred) {
  const legal = legalActions(state);
  if (legal.includes(preferred)) return preferred;
  return legal.find((action) => ['generate', 'attack', 'defend'].includes(action)) ?? null;
}

function policyAction(policy, state) {
  const legal = legalActions(state);
  if (legal.length === 0) return null;
  if (policy === 'charge-then-attack') return chooseFallback(state, state.energy >= 1 ? 'attack' : 'generate');
  if (policy === 'strict-generate-attack') return chooseFallback(state, state.turn % 2 === 0 ? 'generate' : 'attack');
  if (policy === 'defense-priority') {
    const incoming = state.enemy.attacks[state.turn];
    return chooseFallback(state, incoming > 0 && legal.includes('defend') ? 'defend' : (state.energy >= 1 ? 'attack' : 'generate'));
  }
  if (policy === 'max-immediate-damage') return chooseFallback(state, legal.includes('attack') ? 'attack' : 'generate');
  if (policy === 'ignore-next-attack') return chooseFallback(state, ['generate', 'defend', 'attack'][state.turn % 3]);
  throw new Error(`unknown policy ${policy}`);
}

function policyBattle(persistent, enemy, policy) {
  let state = withEnemy(battleStart(persistent, enemy), enemy);
  const sequence = [];
  while (state.turn < 6) {
    const action = policyAction(policy, state);
    if (!action) return null;
    const result = step(state, action);
    sequence.push(action);
    if (result.status === 'won') return { hp: result.state.hp, sequence };
    if (result.status === 'lost') return null;
    state = result.state;
  }
  return null;
}

function policyCanClear(run, policy) {
  const memo = new Map();
  const visit = (persistent, fight) => {
    const key = `${fight}|${persistentKey(persistent)}`;
    if (memo.has(key)) return memo.get(key);
    memo.set(key, false);
    const won = policyBattle(persistent, run.enemies[fight], policy);
    if (!won) return false;
    if (fight === 3) {
      memo.set(key, true);
      return true;
    }
    const boundary = { hp: won.hp, mutations: { ...persistent.mutations } };
    for (const mutation of run.offers[fight]) {
      for (const action of unmutatedActions(boundary)) {
        if (visit(attachMutation(boundary, action, mutation), fight + 1)) {
          memo.set(key, true);
          return true;
        }
      }
    }
    return false;
  };
  return visit({ hp: run.initialHp, mutations: emptyMutations() }, 0);
}

export const FIXED_POLICIES = Object.freeze([
  'charge-then-attack',
  'strict-generate-attack',
  'defense-priority',
  'max-immediate-damage',
  'ignore-next-attack',
]);

export function gateEPassFromUsefulTargets(useful) {
  return MUTATIONS.every((mutation) => useful[mutation].size >= 2);
}

export function evaluateSeed(seed) {
  const run = generateSeed(seed);
  const solver = new GraftSolver(run);
  const initial = { hp: run.initialHp, mutations: emptyMutations() };
  const spine = solver.findCertifiedSpine(initial);
  const fixedPolicies = Object.fromEntries(FIXED_POLICIES.map((policy) => [policy, policyCanClear(run, policy)]));
  const gateD = Object.values(fixedPolicies).every((canClear) => !canClear);
  // Evaluate E independently of D so every negative fixture exercises its own
  // predicate rather than inheriting failure from an earlier gate.
  const gateE = spine ? solver.gateE() : { pass: false, witnesses: {}, examined: [] };
  return {
    seed,
    run,
    gateA: null, // Gate A is a cross-seed semantics/fixture check in graft-fixtures.mjs.
    gateB: Boolean(spine),
    gateC: Boolean(spine),
    gateD,
    gateE,
    gateF: Boolean(spine),
    fixedPolicies,
    spine,
    cache: {
      battles: solver.battleCache.size,
      optimal: solver.optimalCache.size,
      completions: solver.canFightCache.size,
    },
  };
}

export function findFirstPassingSeed({ first = 0, last = 999, onProgress = null } = {}) {
  const started = Date.now();
  const aggregate = {
    evaluated: 0,
    gateB: 0,
    gateC: 0,
    gateD: 0,
    gateE: 0,
    gateF: 0,
    passed: 0,
  };
  for (let seed = first; seed <= last; seed += 1) {
    const result = evaluateSeed(seed);
    aggregate.evaluated += 1;
    if (result.gateB) aggregate.gateB += 1;
    if (result.gateC) aggregate.gateC += 1;
    if (result.gateD) aggregate.gateD += 1;
    if (result.gateE.pass) aggregate.gateE += 1;
    if (result.gateF) aggregate.gateF += 1;
    if (result.gateB && result.gateC && result.gateD && result.gateE.pass && result.gateF) {
      aggregate.passed += 1;
      return { result, aggregate, elapsedMs: Date.now() - started };
    }
    if (onProgress && (seed - first + 1) % 25 === 0) onProgress({ seed, aggregate, elapsedMs: Date.now() - started });
  }
  return { result: null, aggregate, elapsedMs: Date.now() - started };
}
