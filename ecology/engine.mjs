// ecology/engine.mjs
//
// The deterministic battle engine. It knows event types, resources, ordering and
// safety limits. It does not know a single character, skill, equipment or enemy
// id: every one of those lives in a content bundle and reaches the engine as
// data. That is the whole point of R5 — content can be added later without
// adding a branch here.
//
// Public API (§4):
//   simulateBattle(input, contentBundle, options)
//   validateBattleInput(input, contentBundle)

import {
  DEFAULT_OPTIONS,
  NON_LISTENABLE_EVENT_TYPES,
  POSITION_ORDER,
  RESULT_SCHEMA_VERSION,
} from "./schema.mjs";
import {
  allActors,
  bumpHistory,
  getActor,
  livingOnSide,
  newHistory,
  recordTargeted,
  resetHistoryWindow,
  statusStacks,
  totalBarrier,
} from "./actors.mjs";
import { beginChain, endChain, pushEvent, runtimeError } from "./event-queue.mjs";
import { evaluatePredicates } from "./predicates.mjs";
import { resolveTargets } from "./selectors.mjs";
import {
  advancePreparationOn,
  applyEffects,
  canPayCosts,
  payCosts,
  startPreparationOn,
} from "./effects.mjs";
import { validateBattleInput as validateInput, validateContentBundle } from "./validate.mjs";
import { EcologyValidationError, formatValidationErrors } from "./errors.mjs";
import { withStaticStatBonuses } from "./static-bonuses.mjs";

export { validateContentBundle };

export function validateBattleInput(input, contentBundle) {
  return validateInput(input, contentBundle);
}

export function simulateBattle(input, contentBundle, options = {}) {
  const contentErrors = validateContentBundle(contentBundle);
  if (contentErrors.length > 0) {
    throw new EcologyValidationError(
      `invalid content bundle:\n${formatValidationErrors(contentErrors)}`,
      contentErrors,
    );
  }
  const inputErrors = validateInput(input, contentBundle);
  if (inputErrors.length > 0) {
    throw new EcologyValidationError(
      `invalid battle input ${input && input.battleId}:\n${formatValidationErrors(inputErrors)}`,
      inputErrors,
    );
  }

  const state = buildState(input, contentBundle, options);
  runBattle(state);
  return buildResult(state, contentBundle);
}

// ----------------------------------------------------------------- state setup

function buildState(input, content, options) {
  const state = {
    battleId: input.battleId,
    options: { ...DEFAULT_OPTIONS, ...options },
    content,
    objective: input.objective,
    maxRounds: input.maxRounds,
    regionRules: input.regionRules ?? [],
    round: 0,
    roundsCompleted: 0,
    sequence: 0,
    chainSequence: 0,
    chain: null,
    parentEventId: undefined,
    events: [],
    eventsById: new Map(),
    replaySnapshots: [],
    actors: new Map(),
    actorOrder: [],
    tacticCursorByActor: new Map(),
    queue: [],
    phaseSide: null,
    phaseVisited: new Set(),
    ruleStack: [],
    currentActorId: null,
    currentPendingAction: null,
    recoveryWindows: new Map(),
    roundFirings: new Map(),
    battleFirings: new Map(),
    roundEndStartSequence: 0,
    finished: false,
    result: null,
    reason: null,
  };

  for (const ally of input.allies) {
    const definition = content.characters[ally.characterId];
    // R6 §9.5 — PHASE B. Permanent training arrives already rounded, per
    // instance. **The engine does not know what training is**: it reads a stat
    // override and keeps the levels only as a record for the causal log.
    const allyStats = statsOf(definition, ally.stats);
    const allyEquipment = ally.equipment.map((item) => ({
      instanceId: item.instanceId,
      equipmentId: item.equipmentId,
      durability: item.durability,
      maxDurability: content.equipment[item.equipmentId].maxDurability,
      broken: item.durability === 0 && options.equipmentBreaks !== false,
    }));
    addActor(state, withStaticStatBonuses(content, {
      instanceId: ally.instanceId,
      side: "ally",
      definitionId: ally.characterId,
      displayName: definition.displayName,
      maxHp: allyStats.maxHp,
      hp: ally.hp ?? allyStats.maxHp,
      might: allyStats.might,
      focus: allyStats.focus,
      guard: allyStats.guard,
      baseStats: baseStatsOf(definition),
      training: ally.training ? { ...ally.training } : null,
      // R19（issue #137）— 技能レベル。**engine は「どの技能か」で分岐しない**：
      // この表に載っている技能の連続量へ、段数ぶんの係数を掛けるだけである
      // （effects.mjs の afterSkillLevel）。載っていなければ掛け算も起きない。
      skillLevels: ally.skillLevels ? { ...ally.skillLevels } : null,
      baseActionPoints: definition.baseActionPoints,
      baseReactionPoints: definition.baseReactionPoints,
      position: ally.position,
      tactics: ally.tactics.map((tactic) => ({ ...tactic })),
      reactiveSkillIds: [...ally.reactiveSkillIds],
      passiveSkillIds: [...(ally.passiveSkillIds ?? [])],
      equipment: allyEquipment,
    }, ally.passiveSkillIds, allyEquipment));
  }

  for (const enemy of input.enemies) {
    const definition = content.enemyActors[enemy.enemyActorId];
    // R6 §11.2 / §13.2 — PHASE B. A difficulty mutation is the same mechanism
    // from the other side: a visible, pre-battle stat override plus the ids that
    // produced it. No engine branch on an individual enemy id.
    const enemyStats = statsOf(definition, enemy.stats);
    addActor(state, withStaticStatBonuses(content, {
      instanceId: enemy.instanceId,
      side: "enemy",
      definitionId: enemy.enemyActorId,
      displayName: definition.displayName,
      maxHp: enemyStats.maxHp,
      hp: enemy.hp ?? enemyStats.maxHp,
      might: enemyStats.might,
      focus: enemyStats.focus,
      guard: enemyStats.guard,
      baseStats: baseStatsOf(definition),
      mutations: [...(enemy.mutations ?? [])],
      baseActionPoints: definition.baseActionPoints,
      baseReactionPoints: definition.baseReactionPoints,
      position: enemy.position,
      tactics: definition.tactics.map((tactic) => ({ ...tactic })),
      reactiveSkillIds: [...definition.reactiveSkillIds],
      passiveSkillIds: [...(definition.passiveSkillIds ?? [])],
      equipment: [],
    }, definition.passiveSkillIds, []));
  }

  return state;
}

// R6 §9.5 / §11.2 — PHASE B. The definition is the base; the input may raise the
// four continuous stats. validate.mjs has already refused every other key, so
// this is a merge, not a filter.
function statsOf(definition, override) {
  return {
    maxHp: override?.maxHp ?? definition.maxHp,
    might: override?.might ?? definition.might,
    focus: override?.focus ?? definition.focus,
    guard: override?.guard ?? definition.guard,
  };
}

// R6 §9.5 — "UI、BattleInput、結果 log へ人物ごとの base stat、鍛錬 level、
// 合計 bps、丸め後 stat を残す". The rounded stat is on the actor; the base is
// only knowable here, so it rides along and comes back out in the result.
function baseStatsOf(definition) {
  return {
    maxHp: definition.maxHp,
    might: definition.might ?? 0,
    focus: definition.focus ?? 0,
    guard: definition.guard ?? 0,
  };
}

function addActor(state, fields) {
  const actor = {
    ...fields,
    alive: fields.hp > 0,
    // R14 §1 — 戦闘に入った時点の HP。**passive の max_hp 補正を足したあとの値**
    // なので、開始 HP を知りたい側が withPassiveBonuses を再現しなくてよい
    // （画面の戦闘予測が「いくつ減るか」を出すのに使う）。
    startingHp: fields.hp,
    // 回復済み量は現在HPの内訳として保持し、replay の各スナップショットへ渡す。
    recoveredDamage: 0,
    actionPoints: 0,
    reactionPoints: 0,
    // R6 §4.4 / §6.7 — PHASE A. 定義が持たなければ 0。
    // **既存 content は持たないので、guard 0 = 軽減なし＝v1 と同じ挙動になる。**
    might: fields.might ?? 0,
    focus: fields.focus ?? 0,
    guard: fields.guard ?? 0,
    // block charge は戦闘開始時 0。持続は round ではなく「使うまで」。
    block: 0,
    barriers: [],
    statuses: [],
    preparation: null,
    activationsThisRound: 0,
    inQueue: false,
    isActivating: false,
    initiativeRank: 0,
    history: newHistory(),
  };
  state.actors.set(actor.instanceId, actor);
  state.actorOrder.push(actor.instanceId);
}

// --------------------------------------------------------------- event plumbing

function makeRuntime(state) {
  return {
    state,
    emit: (spec, pendingFrame = null) => emit(state, spec, pendingFrame),
    onResourceGained: (actor) => requeueOnResourceGain(state, actor),
  };
}

function emit(state, spec, pendingFrame = null) {
  if (["action_started", "round_ended", "battle_ended"].includes(spec.type)) {
    closeRecoveryWindows(state, spec.type === "action_started" ? "next_action" : "phase_boundary");
  }
  const event = pushEvent(state, spec);
  // §11.5 — the interrupt window for this event closes before the caller sees
  // the pending frame again, so every interrupt for it runs here and now.
  if (pendingFrame) dispatchRules(state, event, "interrupt", pendingFrame);
  if (state.chain && !NON_LISTENABLE_EVENT_TYPES.includes(event.type)) {
    state.chain.afterQueue.push(event.id);
  }
  return event;
}

// HP damage is recoverable only until the next action/phase boundary. Keeping
// this in the engine (rather than in individual healing skills) makes stacked
// reactive heals obey the same rule and keeps preview/replay deterministic.
function closeRecoveryWindow(state, actorId, cause) {
  const window = state.recoveryWindows.get(actorId);
  if (!window) return;
  state.recoveryWindows.delete(actorId);
  const actor = getActor(state, actorId);
  const remaining = Math.max(0, window.remaining);
  const unrecoverable = actor
    ? Math.max(0, actor.maxHp - actor.hp - remaining)
    : 0;
  if (remaining <= 0) return;
  pushEvent(state, {
    type: "recovery_window_closed",
    targetActorIds: [actorId],
    tags: ["recovery_window"],
    values: {
      remaining,
      cause,
      attackChainId: window.chainId,
      recoveredDamage: actor?.recoveredDamage ?? 0,
      unrecoverableDamage: unrecoverable,
    },
  });
}

function closeRecoveryWindows(state, cause) {
  for (const actorId of [...state.recoveryWindows.keys()]) {
    closeRecoveryWindow(state, actorId, cause);
  }
}

// §7 — one chain per active action, per round event, per outside effect.
function runChain(state, rootType, body, { checkOutcomeAfter = true } = {}) {
  beginChain(state, rootType);
  for (const actor of allActors(state)) resetHistoryWindow(actor, "chain");
  try {
    body();
    drainAfterQueue(state);
  } finally {
    endChain(state);
    state.parentEventId = undefined;
  }
  // §13 — the outcome is only read once the chain is empty, so a reaction to
  // actor_defeated always gets to run before the battle can end.
  if (checkOutcomeAfter) checkOutcome(state);
}

function drainAfterQueue(state) {
  while (state.chain.afterQueue.length > 0) {
    const eventId = state.chain.afterQueue.shift();
    dispatchRules(state, state.eventsById.get(eventId), "after", null);
  }
}

// ------------------------------------------------------------ rules (§5.7 §11.5)

function ruleEntriesFor(state, actor) {
  const entries = [];
  const definition = actor.side === "ally"
    ? state.content.characters[actor.definitionId]
    : state.content.enemyActors[actor.definitionId];
  const intrinsic = actor.side === "ally" ? definition.signatureRules : definition.intrinsicRules;
  for (const rule of intrinsic) {
    entries.push({ rule, owner: actor, sourceDefinitionId: actor.definitionId, ruleSource: "signature" });
  }
  for (const [skillOrder, skillId] of actor.reactiveSkillIds.entries()) {
    entries.push({
      rule: state.content.reactiveSkills[skillId].rule,
      owner: actor,
      sourceDefinitionId: skillId,
      ruleSource: "reactive_skill",
      skillOrder,
    });
  }
  // R6 §6.8 — PHASE A. passive の rule は常時ある。reactive と違って
  // **反応権を払わない**ので、costs は content 側で空にしてある
  // （validator は rule として同じ検査を通す）。
  for (const skillId of actor.passiveSkillIds ?? []) {
    const rule = state.content.passiveSkills?.[skillId]?.rule;
    if (!rule) continue;
    entries.push({
      rule,
      owner: actor,
      sourceDefinitionId: skillId,
      ruleSource: "passive_skill",
    });
  }
  for (const item of actor.equipment) {
    // §5.6 — a broken or depleted item stops supplying rules for the rest of
    // the battle. The playable mode may deplete without emitting a permanent
    // break; the durability check keeps that mode from firing at zero.
    if (item.broken || item.durability <= 0) continue;
    for (const rule of state.content.equipment[item.equipmentId].rules) {
      entries.push({
        rule,
        owner: actor,
        sourceDefinitionId: item.equipmentId,
        equipmentInstanceId: item.instanceId,
        ruleSource: "equipment",
      });
    }
  }
  for (const status of actor.statuses) {
    for (const rule of state.content.statuses[status.statusId].rules) {
      entries.push({
        rule,
        owner: actor,
        sourceDefinitionId: status.statusId,
        statusId: status.statusId,
        ruleSource: "status",
      });
    }
  }
  return entries;
}

function allRuleEntries(state) {
  const entries = [];
  for (const actor of allActors(state)) {
    if (!actor.alive) continue;
    entries.push(...ruleEntriesFor(state, actor));
  }
  for (const rule of state.regionRules) {
    entries.push({ rule, owner: null, sourceDefinitionId: "region", ruleSource: "region" });
  }
  return entries;
}

function firingKey(entry) {
  // §5.7 — "the same rule of the same owner instance fires at most once per
  // chain". Two copies of one item therefore share the budget on purpose.
  const ownerId = entry.owner ? entry.owner.instanceId : "~region";
  return `${ownerId}|${entry.rule.id}`;
}

function firedCount(map, key) {
  return map.get(key) ?? 0;
}

function ruleAvailable(state, entry) {
  const key = firingKey(entry);
  if (firedCount(state.chain.ruleFirings, key) >= 1) return false;
  const limit = entry.rule.limit;
  if (limit.scope === "round" && firedCount(state.roundFirings, key) >= limit.count) return false;
  if (limit.scope === "battle" && firedCount(state.battleFirings, key) >= limit.count) return false;
  if (limit.scope === "chain" && firedCount(state.chain.ruleFirings, key) >= limit.count) return false;
  return true;
}

function ruleSourceIntact(state, entry) {
  if (entry.owner && !entry.owner.alive) return false;
  if (entry.equipmentInstanceId) {
    const item = entry.owner.equipment.find((candidate) => candidate.instanceId === entry.equipmentInstanceId);
    if (!item || item.broken || item.durability <= 0) return false;
  }
  if (entry.statusId && statusStacks(entry.owner, entry.statusId) === 0) return false;
  return true;
}

// §5.7 — the five step tie-break. Nothing below it may depend on Map iteration
// order, array order or side.
function compareRuleEntries(a, b) {
  if (a.rule.priority !== b.rule.priority) return a.rule.priority - b.rule.priority;
  if (a.initiativeRank !== b.initiativeRank) return a.initiativeRank - b.initiativeRank;
  if (a.positionRank !== b.positionRank) return a.positionRank - b.positionRank;
  if (a.ownerId !== b.ownerId) return a.ownerId < b.ownerId ? -1 : 1;
  if (a.rule.id !== b.rule.id) return a.rule.id < b.rule.id ? -1 : 1;
  // Two rule entries can still share every key above when they come from two
  // equipment instances. validate.mjs refuses two copies of one item on one
  // actor, so this is unreachable today; it is here so the order can never fall
  // back to whatever order the equipment array happened to have.
  const equipmentA = a.equipmentInstanceId ?? "";
  const equipmentB = b.equipmentInstanceId ?? "";
  if (equipmentA !== equipmentB) return equipmentA < equipmentB ? -1 : 1;
  return 0;
}

// A dispatch call already narrows candidates to one event type and timing.
// Use that trigger window as the grouping key so all reactive skills owned by
// one actor are kept together, then impose the player's top-to-bottom order
// inside that block. This is deliberately a post-sort pass: a pairwise
// comparator that sometimes ignores priority for reactive entries is not
// transitive when signature/equipment rules are mixed in the same actor.
function reactiveGroupKey(entry) {
  if (entry.ruleSource !== "reactive_skill" || !entry.ownerId) return null;
  return entry.ownerId + "\u0000" + entry.rule.listenTo + "\u0000" + entry.rule.timing;
}

function orderRuleCandidates(candidates) {
  const sorted = [...candidates].sort(compareRuleEntries);
  const groups = new Map();
  for (const entry of sorted) {
    const key = reactiveGroupKey(entry);
    if (key === null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  for (const entries of groups.values()) {
    entries.sort((a, b) => a.skillOrder - b.skillOrder);
  }

  const output = [];
  const emitted = new Set();
  for (const entry of sorted) {
    const key = reactiveGroupKey(entry);
    if (key === null) {
      output.push(entry);
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    output.push(...groups.get(key));
  }
  return output;
}

function dispatchRules(state, event, timing, pendingFrame) {
  const candidates = [];
  for (const entry of allRuleEntries(state)) {
    if (entry.rule.listenTo !== event.type) continue;
    if (entry.rule.timing !== timing) continue;
    if (!ruleSourceIntact(state, entry)) continue;
    if (!ruleAvailable(state, entry)) continue;
    candidates.push({
      ...entry,
      initiativeRank: entry.owner ? entry.owner.initiativeRank : Number.MAX_SAFE_INTEGER,
      positionRank: entry.owner ? POSITION_ORDER[entry.owner.position] : Number.MAX_SAFE_INTEGER,
      ownerId: entry.owner ? entry.owner.instanceId : "~region",
    });
  }
  for (const candidate of orderRuleCandidates(candidates)) {
    fireRule(state, event, candidate, pendingFrame);
  }
}

function fireRule(state, event, entry, pendingFrame) {
  // §5.7 — everything is re-checked immediately before firing, because an
  // earlier reaction in this same window may have removed the reason to fire.
  if (!ruleSourceIntact(state, entry)) return;
  if (!ruleAvailable(state, entry)) return;
  if (pendingFrame && pendingFrame.kind === "action" && pendingFrame.canceled) return;

  const rt = makeRuntime(state);
  const ctx = {
    owner: entry.owner,
    event,
    pending: pendingFrame,
    pendingAction: pendingFrame && pendingFrame.kind === "action" ? pendingFrame : state.currentPendingAction,
    candidate: null,
    sourceDefinitionId: entry.sourceDefinitionId,
    ruleId: entry.rule.id,
    skillId: undefined,
    equipmentInstanceId: entry.equipmentInstanceId,
  };
  if (!evaluatePredicates(state, ctx, entry.rule.predicates)) return;
  if (!canPayCosts(rt, ctx, entry.rule.costs)) return;

  const key = firingKey(entry);
  state.chain.ruleFirings.set(key, firedCount(state.chain.ruleFirings, key) + 1);
  state.roundFirings.set(key, firedCount(state.roundFirings, key) + 1);
  state.battleFirings.set(key, firedCount(state.battleFirings, key) + 1);
  if (entry.owner) bumpHistory(entry.owner, "reactive_actions", 1);

  state.ruleStack.push({
    ruleId: entry.rule.id,
    ownerId: entry.owner ? entry.owner.instanceId : "~region",
    listenTo: entry.rule.listenTo,
    timing: entry.rule.timing,
    triggeredByEventId: event.id,
  });
  const previousParent = state.parentEventId;
  state.parentEventId = event.id;
  try {
    payCosts(rt, ctx, entry.rule.costs);
    applyEffects(rt, ctx, entry.rule.effects);
  } finally {
    state.parentEventId = previousParent;
    state.ruleStack.pop();
  }
}

// -------------------------------------------------------------- battle (§11)

function runBattle(state) {
  runChain(state, "battle_started", () => {
    emit(state, {
      type: "battle_started",
      tags: [],
      values: {
        objective: state.objective.type,
        maxRounds: state.maxRounds,
        allies: livingOnSide(state, "ally").length,
        enemies: livingOnSide(state, "enemy").length,
      },
    });
  });

  while (!state.finished) {
    if (state.round >= state.maxRounds) {
      finish(state, "loss", "round_limit");
      break;
    }
    state.round += 1;
    startRound(state);
    runActivations(state);
    if (state.finished) break;
    endRound(state);
  }

  const rt = makeRuntime(state);
  beginChain(state, "battle_ended");
  closeRecoveryWindows(state, "phase_boundary");
  pushEvent(state, {
    type: "battle_ended",
    tags: [],
    values: { result: state.result, reason: state.reason, roundsUsed: state.roundsCompleted },
  });
  endChain(state);
  void rt;
}

function startRound(state) {
  for (const actor of allActors(state)) {
    actor.activationsThisRound = 0;
    resetHistoryWindow(actor, "round");
    actor.inQueue = false;
  }
  state.queue = [];
  state.phaseSide = null;
  state.phaseVisited = new Set();
  state.roundFirings = new Map();

  runChain(state, "round_started", () => {
    // §11.2 — refresh first, and the refresh is not a reaction hook in v1.
    for (const actor of orderedActors(state)) {
      if (!actor.alive) continue;
      const apBefore = actor.actionPoints;
      const rpBefore = actor.reactionPoints;
      actor.actionPoints = actor.baseActionPoints;
      actor.reactionPoints = actor.baseReactionPoints;
      emit(state, {
        type: "resource_refreshed",
        targetActorIds: [actor.instanceId],
        tags: [],
        values: {
          actionPointsBefore: apBefore,
          actionPoints: actor.actionPoints,
          reactionPointsBefore: rpBefore,
          reactionPoints: actor.reactionPoints,
        },
      });
    }
    emit(state, { type: "round_started", tags: [], values: { round: state.round } });
  });

  // §11.2 — initiative is fixed for the round and gives the ally side the
  // opening phase. Within each side, formation order is front row before rear
  // row, left to right. A shared position is an internal tie only.
  const living = [
    ...actorsInPhaseOrder(state, "ally"),
    ...actorsInPhaseOrder(state, "enemy"),
  ];
  living.forEach((actor, index) => {
    actor.initiativeRank = index;
  });
}

function orderedActors(state) {
  return allActors(state);
}

function compareFormationActors(a, b) {
  const byPosition = POSITION_ORDER[a.position] - POSITION_ORDER[b.position];
  if (byPosition !== 0) return byPosition;
  return a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0;
}

function actorsInPhaseOrder(state, side) {
  return livingOnSide(state, side).sort(compareFormationActors);
}

function runActivations(state) {
  // One pass is one action per living actor on a side. AP 2 therefore means
  // that the actor returns on the next ally/enemy pass, never that it takes two
  // consecutive actions before the opposing side gets a turn.
  do {
    runSidePhase(state, "ally");
    if (state.finished) break;
    runSidePhase(state, "enemy");
  } while (!state.finished && hasUsableActionAnywhere(state));

  state.queue = [];
  state.phaseSide = null;
  state.phaseVisited = new Set();
  for (const actor of allActors(state)) {
    actor.inQueue = false;
  }
}

function runSidePhase(state, side) {
  state.phaseSide = side;
  state.phaseVisited = new Set();
  const phaseActors = actorsInPhaseOrder(state, side);
  state.queue = phaseActors.map((actor) => actor.instanceId);
  phaseActors.forEach((actor) => {
    actor.inQueue = true;
  });

  while (state.queue.length > 0 && !state.finished) {
    const instanceId = state.queue.shift();
    const actor = getActor(state, instanceId);
    if (actor) actor.inQueue = false;
    state.phaseVisited.add(instanceId);
    if (!actor || !actor.alive) continue;
    if (actor.activationsThisRound >= state.options.maxActivationsPerActorPerRound) {
      // A zero-cost action has no AP exhaustion to stop it. Keep the diagnostic
      // behavior for that pathological content instead of silently turning the
      // action into a normal round-end skip.
      if (hasFreeActionAtActivationCap(state, actor)) {
        state.currentActorId = actor.instanceId;
        throw runtimeError(state, "actor activation limit reached", {
          limit: "maxActivationsPerActorPerRound",
          limitValue: state.options.maxActivationsPerActorPerRound,
          actorId: actor.instanceId,
        });
      }
      continue;
    }

    // AP-bearing actors get one activation even when all their tactics are
    // unavailable, so the existing action_skipped event remains observable.
    // A zero-cost action is the only exception: it may activate without AP.
    if (actor.actionPoints > 0 || hasUsableAction(state, actor)) {
      activateActor(state, actor);
    }
  }

  for (const actor of phaseActors) {
    actor.inQueue = false;
  }
  state.queue = [];
}

function hasUsableActionAnywhere(state) {
  return allActors(state).some(
    (actor) => hasUsableAction(state, actor) || hasFreeActionAtActivationCap(state, actor),
  );
}

function hasUsableAction(state, actor) {
  if (!actor.alive) return false;
  if (actor.activationsThisRound >= state.options.maxActivationsPerActorPerRound) return false;
  if (actor.preparation) return actor.actionPoints > 0;
  const choice = findActionChoice(state, actor);
  return choice !== null;
}

function findActionChoice(state, actor) {
  return chooseTactic(state, actor) ?? coreActionChoice(state, actor, "basicStrike");
}

function hasFreeActionAtActivationCap(state, actor) {
  if (!actor.alive || actor.preparation) return false;
  if (actor.activationsThisRound < state.options.maxActivationsPerActorPerRound) return false;
  const choice = findActionChoice(state, actor);
  if (!choice) return false;
  return choice.costs
    .filter((cost) => cost.type === "spend_action_points")
    .reduce((total, cost) => total + cost.amount, 0) === 0;
}

function activateActor(state, actor) {
  if (actor.activationsThisRound >= state.options.maxActivationsPerActorPerRound) {
    // Defensive: the requeue rule below refuses to add an actor at the cap, so
    // reaching here would mean some other path pushed it (PREFLIGHT §5).
    throw runtimeError(state, "actor activation limit reached", {
      limit: "maxActivationsPerActorPerRound",
      limitValue: state.options.maxActivationsPerActorPerRound,
      actorId: actor.instanceId,
    });
  }
  actor.activationsThisRound += 1;
  actor.isActivating = true;
  state.currentActorId = actor.instanceId;

  runChain(state, "actor_activated", () => {
    emit(state, {
      type: "actor_activated",
      sourceActorId: actor.instanceId,
      targetActorIds: [actor.instanceId],
      sourceDefinitionId: actor.definitionId,
      tags: [actor.side],
      values: { activation: actor.activationsThisRound, round: state.round },
    });
  });

  if (!state.finished && actor.alive && actor.preparation) {
    // §11.3 — **準備は行動権で進める。1起動につき1AP、1段だけ。**
    //
    // AP を複数持つ actor でも、残りは次の自軍フェーズまで保持する。
    // これで準備中の人物も、通常行動と同じ「一人一行動」のテンポに入る。
    //
    // 実測（2026-08-30、当時の analysis/ecology-decision-space-smoke.mjs。R12 で削除）:
    // 準備を使う編成は 2.07 → 2.17 倍、準備を使わない素朴な編成4種は不変。
    runChain(state, "preparation", () => {
      const rt = makeRuntime(state);
      if (actor.preparation && actor.actionPoints > 0) {
        actor.actionPoints -= 1;
        emit(state, {
          type: "resource_spent",
          sourceActorId: actor.instanceId,
          targetActorIds: [actor.instanceId],
          tags: [],
          values: { resource: "action_points", amount: 1, after: actor.actionPoints },
        });
        advancePreparationOn(rt, preparationContext(state, actor), actor, 1);
      }
    });
    finishActivation(state, actor);
    return;
  }

  let choice = chooseTactic(state, actor);
  // R6 §6.4 — 技能未装備、全技能が不発、または有効対象なしなら basic strike。
  if (!choice) choice = coreActionChoice(state, actor, "basicStrike");
  // chooseTactic is also used by the phase preflight. Advance only after the
  // real activation has accepted a tactic, so that preflight cannot consume
  // the next slot before the action is performed.
  if (choice && choice.tacticIndex !== undefined) {
    advanceTacticCursor(state, actor, choice.tacticIndex);
  }
  if (!choice) {
    // §11.3-8 — one action_skipped for an activation that produced nothing.
    // The leftover AP is reported at round end.
    runChain(state, "action_skipped", () => {
      emit(state, {
        type: "action_skipped",
        sourceActorId: actor.instanceId,
        targetActorIds: [actor.instanceId],
        sourceDefinitionId: actor.definitionId,
        tags: [],
        values: { actionPoints: actor.actionPoints, reason: "no_usable_tactic" },
      });
    });
  } else {
    const mode = choice.skill.actionMode ?? "offense";
    runChain(state, "action", () => performAction(state, actor, choice));
    // R6 §6.4 — utility の全 rule を解決した後、威力50%の追撃を一度だけ。
    // 追撃は選択した一行動の結果であり、次の通常行動は次の味方フェーズまで待つ。
    if (mode === "utility" && actor.alive && !state.finished) {
      const followUp = coreActionChoice(state, actor, "fallbackStrike");
      if (followUp) runChain(state, "action", () => performAction(state, actor, followUp));
    }
  }

  finishActivation(state, actor);
}

function finishActivation(state, actor) {
  actor.isActivating = false;
  state.currentActorId = null;
  // §12.4 note on duration: a "turn" status lasts until the end of the holder's
  // activation.
  const expiring = actor.statuses.filter((status) => status.duration === "turn");
  if (expiring.length > 0) {
    runChain(state, "status_expiry", () => {
      for (const status of expiring) {
        actor.statuses = actor.statuses.filter((entry) => entry !== status);
        emit(state, {
          type: "status_removed",
          targetActorIds: [actor.instanceId],
          tags: ["turn"],
          values: { statusId: status.statusId, removed: status.stacks, remaining: 0, cause: "duration" },
        });
      }
    });
  }
}

function preparationContext(state, actor) {
  return {
    owner: actor,
    event: null,
    pending: null,
    pendingAction: null,
    candidate: null,
    sourceDefinitionId: actor.preparation ? actor.preparation.sourceDefinitionId : actor.definitionId,
    ruleId: actor.preparation ? actor.preparation.ruleId : undefined,
    skillId: actor.preparation ? actor.preparation.skillId : undefined,
    equipmentInstanceId: actor.preparation ? actor.preparation.equipmentInstanceId : undefined,
  };
}

// R6 §6.4 — 攻撃テンポの保証。**支援だけを連打して戦闘が止まらないようにする。**
// どの技能を使うかは content の coreActions 宣言が決める（engine は個別 ID で
// 分岐しない）。playable の届き方は core skill の effect.reach で決まる。
function actionReach(skill) {
  const effects = [
    ...(skill.effects ?? []),
    ...(skill.preparation?.completionEffects ?? []),
  ];
  const explicit = effects.find((effect) => effect.reach !== undefined);
  if (explicit) return explicit.reach;
  // Enemy-targeting skills without an explicit ranged effect are ordinary
  // melee actions. Ally/self support skills are not restricted by front rows.
  return skill.targetQuery?.scope === "enemies" ? "melee" : "unrestricted";
}
function coreActionChoice(state, actor, key) {
  // Core actions are content-selected, never position- or character-selected.
  // The selected skill's effect.reach is the sole targeting contract. Keep the
  // `melee` entry as the playable default; the first declared entry is a small
  // compatibility fallback for bundles that expose a single core variant.
  const byReach = state.content.coreActions?.[key] ?? {};
  const skillId = byReach.melee ?? Object.values(byReach)[0];
  const skill = skillId ? state.content.activeSkills[skillId] : null;
  if (!skill) return null;
  const rt = makeRuntime(state);
  const ctx = {
    owner: actor,
    event: null,
    pending: null,
    pendingAction: null,
    candidate: null,
    sourceDefinitionId: actor.definitionId,
    ruleId: undefined,
    skillId: skill.id,
    equipmentInstanceId: undefined,
  };
  const targets = resolveTargets(state, ctx, skill.targetQuery, { reach: actionReach(skill) });
  if (targets.length === 0) return null;
  const costs = [{ type: "spend_action_points", amount: skill.apCost }];
  if (!canPayCosts(rt, ctx, costs)) return null;
  return { skill, targets, costs, tactic: { activeSkillId: skill.id, useWhen: [] } };
}

// §11.4-1..4 — tactics are read round-robin from the actor's cursor.
// A tactic whose predicates, useWhen, targets or cost do not hold is skipped;
// the next tactic in the circle gets a chance.
function tacticCursorFor(state, actor) {
  const tactics = actor.tactics ?? [];
  if (tactics.length === 0) return 0;
  const cursor = state.tacticCursorByActor.get(actor.instanceId) ?? 0;
  return Number.isInteger(cursor) && cursor >= 0 && cursor < tactics.length ? cursor : 0;
}

function advanceTacticCursor(state, actor, selectedIndex) {
  const tactics = actor.tactics ?? [];
  if (tactics.length === 0) return;
  state.tacticCursorByActor.set(actor.instanceId, (selectedIndex + 1) % tactics.length);
}

function chooseTactic(state, actor) {
  const rt = makeRuntime(state);
  const tactics = actor.tactics ?? [];
  const start = tacticCursorFor(state, actor);
  for (let offset = 0; offset < tactics.length; offset += 1) {
    const tacticIndex = (start + offset) % tactics.length;
    const tactic = tactics[tacticIndex];
    const skill = state.content.activeSkills[tactic.activeSkillId];
    // §5.5 — one pending preparation per actor.
    if (actor.preparation && skill.preparation) continue;
    const ctx = {
      owner: actor,
      event: null,
      pending: null,
      pendingAction: null,
      candidate: null,
      sourceDefinitionId: actor.definitionId,
      ruleId: undefined,
      skillId: skill.id,
      equipmentInstanceId: undefined,
    };
    if (!evaluatePredicates(state, ctx, skill.intrinsicPredicates)) continue;
    if (!evaluatePredicates(state, ctx, tactic.useWhen)) continue;
    const targets = resolveTargets(state, ctx, skill.targetQuery, { reach: actionReach(skill) });
    if (targets.length === 0) continue;
    const costs = [{ type: "spend_action_points", amount: skill.apCost }];
    if (!canPayCosts(rt, ctx, costs)) continue;
    return { tactic, skill, targets, costs, tacticIndex };
  }
  return null;
}

function performAction(state, actor, choice) {
  const { skill, targets, costs } = choice;
  const rt = makeRuntime(state);
  const frame = {
    kind: "action",
    canceled: false,
    cancelReason: null,
    skillId: skill.id,
    sourceActorId: actor.instanceId,
    targetActorIds: targets.map((target) => target.instanceId),
  };
  state.currentPendingAction = frame;
  const baseCtx = () => ({
    owner: actor,
    event: null,
    pending: null,
    pendingAction: frame,
    candidate: null,
    sourceDefinitionId: actor.definitionId,
    ruleId: undefined,
    skillId: skill.id,
    equipmentInstanceId: undefined,
  });

  try {
    const declared = emit(
      state,
      {
        type: "action_declared",
        sourceActorId: actor.instanceId,
        targetActorIds: [],
        sourceDefinitionId: actor.definitionId,
        skillId: skill.id,
        tags: skill.tags,
        values: { apCost: skill.apCost, targetCount: frame.targetActorIds.length },
      },
      frame,
    );
    state.parentEventId = declared.id;
    if (frame.canceled) return cancelAction(state, actor, skill, frame, "rule");

    emit(
      state,
      {
        type: "target_selected",
        sourceActorId: actor.instanceId,
        targetActorIds: [...frame.targetActorIds],
        sourceDefinitionId: actor.definitionId,
        skillId: skill.id,
        tags: skill.tags,
        values: { targetCount: frame.targetActorIds.length },
      },
      frame,
    );
    if (frame.canceled) return cancelAction(state, actor, skill, frame, "rule");

    // §11.4-8 — cancel, target and cost are all re-checked after the interrupts.
    const finalTargets = frame.targetActorIds
      .map((instanceId) => getActor(state, instanceId))
      .filter((target) => target !== null && target.alive);
    if (finalTargets.length === 0) return cancelAction(state, actor, skill, frame, "no_target");
    if (!canPayCosts(rt, baseCtx(), costs)) return cancelAction(state, actor, skill, frame, "cost");

    payCosts(rt, baseCtx(), costs);
    emit(state, {
      type: "action_cost_paid",
      sourceActorId: actor.instanceId,
      targetActorIds: [...frame.targetActorIds],
      sourceDefinitionId: actor.definitionId,
      skillId: skill.id,
      tags: [],
      values: { apCost: skill.apCost, actionPoints: actor.actionPoints },
    });

    const started = emit(state, {
      type: "action_started",
      sourceActorId: actor.instanceId,
      targetActorIds: [...frame.targetActorIds],
      sourceDefinitionId: actor.definitionId,
      skillId: skill.id,
      tags: skill.tags,
      values: { targetCount: frame.targetActorIds.length },
    });

    bumpHistory(actor, "active_actions", 1);
    recordTargeted(actor, frame.targetActorIds[0]);

    // The skill's own effects resolve against action_started, so a query with
    // scope "event_targets" means "whatever this action actually targets" even
    // after a cover redirected it.
    const effectCtx = { ...baseCtx(), event: started };
    const previousParent = state.parentEventId;
    state.parentEventId = started.id;
    try {
      applyEffects(rt, effectCtx, skill.effects);
      if (skill.preparation) {
        startPreparationOn(rt, effectCtx, actor, skill.preparation.steps, skill.preparation.completionEffects, {
          skillId: skill.id,
          sourceDefinitionId: actor.definitionId,
        });
      }
    } finally {
      state.parentEventId = previousParent;
    }

    emit(state, {
      type: "action_resolved",
      sourceActorId: actor.instanceId,
      targetActorIds: [...frame.targetActorIds],
      sourceDefinitionId: actor.definitionId,
      skillId: skill.id,
      tags: skill.tags,
      values: { targetCount: frame.targetActorIds.length },
    });
  } finally {
    state.currentPendingAction = null;
  }
  return undefined;
}

function cancelAction(state, actor, skill, frame, reason) {
  emit(state, {
    type: "action_canceled",
    sourceActorId: actor.instanceId,
    targetActorIds: [...frame.targetActorIds],
    sourceDefinitionId: actor.definitionId,
    skillId: skill.id,
    tags: [],
    values: {
      reason,
      byRuleId: frame.cancelReason ? frame.cancelReason.ruleId : null,
      byActorId: frame.cancelReason ? frame.cancelReason.ownerId : null,
    },
  });
  return undefined;
}

// §11.3 — gaining action points never grants a second action in the current
// side phase. The next side pass naturally sees the new point. The queue hook
// remains for a gain to an actor that has not yet been visited in this phase.
function requeueOnResourceGain(state, actor) {
  if (!actor.alive) return;
  if (actor.isActivating) return;
  if (actor.inQueue) return;
  if (actor.activationsThisRound >= state.options.maxActivationsPerActorPerRound) return;
  if (state.phaseSide !== actor.side) return;
  if (state.phaseVisited.has(actor.instanceId)) return;
  actor.inQueue = true;
  state.queue.push(actor.instanceId);
}

// §11.6 — round end. The after queue is drained after each sub step, so a rule
// that spends an unused reaction point can still afford it (PREFLIGHT §4).
function endRound(state) {
  // Anything created from here on belongs to the round that is about to start,
  // not to the one being closed. Without this, a rule that turns an unused
  // action point into a round barrier would have the packet expire one step
  // later, in the same phase that created it.
  state.roundEndStartSequence = state.sequence;
  runChain(state, "round_ended", () => {
    emit(state, { type: "round_ended", tags: [], values: { round: state.round } });
  });
  if (state.finished) return;

  runChain(state, "resource_unused", () => {
    for (const actor of orderedActors(state)) {
      if (!actor.alive) continue;
      if (actor.actionPoints > 0) {
        bumpHistory(actor, "unused_action_points", actor.actionPoints);
        emit(state, {
          type: "resource_unused",
          sourceActorId: actor.instanceId,
          targetActorIds: [actor.instanceId],
          tags: ["action_points"],
          values: { resource: "action_points", amount: actor.actionPoints },
        });
      }
      if (actor.reactionPoints > 0) {
        bumpHistory(actor, "unused_reaction_points", actor.reactionPoints);
        emit(state, {
          type: "resource_unused",
          sourceActorId: actor.instanceId,
          targetActorIds: [actor.instanceId],
          tags: ["reaction_points"],
          values: { resource: "reaction_points", amount: actor.reactionPoints },
        });
      }
    }
  });
  if (state.finished) return;

  runChain(state, "barrier_expiry", () => {
    for (const actor of orderedActors(state)) {
      const expiring = actor.barriers
        .filter(
          (packet) => packet.duration === "round" && packet.createdSequence < state.roundEndStartSequence,
        )
        .sort((a, b) => a.createdSequence - b.createdSequence);
      for (const packet of expiring) {
        actor.barriers = actor.barriers.filter((entry) => entry !== packet);
        emit(state, {
          type: "barrier_expired",
          targetActorIds: [actor.instanceId],
          tags: ["round"],
          values: { amount: packet.amount, duration: packet.duration, barrierTotal: totalBarrier(actor) },
        });
      }
    }
  });
  if (state.finished) return;

  runChain(state, "status_expiry", () => {
    for (const actor of orderedActors(state)) {
      const expiring = actor.statuses.filter(
        (status) => status.duration === "round" && status.addedSequence < state.roundEndStartSequence,
      );
      for (const status of expiring) {
        actor.statuses = actor.statuses.filter((entry) => entry !== status);
        emit(state, {
          type: "status_removed",
          targetActorIds: [actor.instanceId],
          tags: ["round"],
          values: { statusId: status.statusId, removed: status.stacks, remaining: 0, cause: "duration" },
        });
      }
    }
  });
  if (state.finished) return;

  for (const actor of allActors(state)) {
    actor.actionPoints = 0;
    actor.reactionPoints = 0;
  }

  state.roundsCompleted = state.round;
  checkOutcome(state);
}

// §11.6 offers an optional stalemate rule: end the battle when two consecutive
// rounds change no hp, barrier, preparation, status or durability. v1 does NOT
// implement it, and the reason is a counter-example rather than a preference.
//
// Waiting is a legal tactic here. v1 gives content both `round_number` and
// `history_count`, so "only from round three" and "once four action points have
// gone unused" are ordinary things to write — and during the wait none of the
// five things the hash covers changes. A battle that used the rule would be
// called a draw on round two and the skill could never fire once. Adding the
// round number or the history to the hash does not save it either: both change
// every round, so the rule would never fire at all.
//
// So the round limit is the only thing that ends a battle where nothing moves.
// `fixture_inert` and `fixture_waiting_tactic` hold that behaviour in place.

function objectiveProgress(state) {
  const objective = state.objective;
  if (objective.type === "defeat_definition") {
    return allActors(state).filter(
      (actor) => actor.side === "enemy" && !actor.alive && actor.definitionId === objective.enemyActorId,
    ).length;
  }
  return livingOnSide(state, "enemy").length;
}

// §13 — objectives.
function objectiveMet(state) {
  const objective = state.objective;
  switch (objective.type) {
    case "eliminate_all_enemies":
      return livingOnSide(state, "enemy").length === 0;
    case "defeat_definition":
      return objectiveProgress(state) >= objective.count;
    case "survive_rounds":
      return state.roundsCompleted >= objective.rounds;
    default:
      throw new Error(`unimplemented objective type: ${objective.type}`);
  }
}

function checkOutcome(state) {
  if (state.finished) return;
  const alliesAlive = livingOnSide(state, "ally").length;
  const enemiesAlive = livingOnSide(state, "enemy").length;
  if (objectiveMet(state)) {
    finish(state, "win", "objective_met");
    return;
  }
  if (alliesAlive === 0) {
    // §13 — both sides wiped and the objective was not met in the same chain is
    // a draw; the reason stays inside the v1 vocabulary (PREFLIGHT §9).
    finish(state, enemiesAlive === 0 ? "draw" : "loss", "all_allies_defeated");
  }
}

function finish(state, result, reason) {
  state.finished = true;
  state.result = result;
  state.reason = reason;
  // A battle that ends in the middle of a round still used that round.
  state.roundsCompleted = reason === "round_limit" ? state.maxRounds : state.round;
}

// ------------------------------------------------------------------- result (§4.1)

function buildResult(state, content) {
  const eventCounts = {};
  for (const event of state.events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }

  const actors = allActors(state).map((actor) => ({
    instanceId: actor.instanceId,
    definitionId: actor.definitionId,
    displayName: actor.displayName,
    side: actor.side,
    position: actor.position,
    hp: actor.hp,
    maxHp: actor.maxHp,
    startingHp: actor.startingHp,
    // R6 §9.5 — PHASE B. The rounded stat, the base it came from and the levels
    // that moved it, so the result can say *why* this ally hits for what it does
    // without the reader redoing the rounding.
    might: actor.might,
    focus: actor.focus,
    guard: actor.guard,
    baseStats: actor.baseStats ?? null,
    training: actor.training ?? null,
    mutations: actor.mutations ?? [],
    alive: actor.alive,
    actionPoints: actor.actionPoints,
    reactionPoints: actor.reactionPoints,
    barrier: totalBarrier(actor),
    recoverableDamage: state.recoveryWindows.get(actor.instanceId)?.remaining ?? 0,
    recoveredDamage: Math.min(actor.hp, actor.recoveredDamage ?? 0),
    unrecoverableDamage: Math.max(
      0,
      actor.maxHp - actor.hp - (state.recoveryWindows.get(actor.instanceId)?.remaining ?? 0),
    ),
    barriers: actor.barriers.map((packet) => ({ amount: packet.amount, duration: packet.duration })),
    statuses: actor.statuses.map((status) => ({ statusId: status.statusId, stacks: status.stacks })),
    preparation: actor.preparation
      ? { skillId: actor.preparation.skillId, stepsRemaining: actor.preparation.stepsRemaining }
      : null,
    history: {
      battle: Object.fromEntries(
        Object.entries(actor.history.battle.counters).map(([metric, value]) => [metric, value]),
      ),
    },
  }));

  const equipment = allActors(state).flatMap((actor) =>
    actor.equipment.map((item) => ({
      instanceId: item.instanceId,
      ownerInstanceId: actor.instanceId,
      equipmentId: item.equipmentId,
      durability: item.durability,
      maxDurability: item.maxDurability,
      broken: item.broken,
    })),
  );

  const allySide = allActors(state).filter((actor) => actor.side === "ally");
  const metrics = {
    eventCount: state.events.length,
    chainCount: state.chainSequence,
    eventCounts,
    reactionsFired: [...state.battleFirings.values()].reduce((sum, count) => sum + count, 0),
    allyHpLost: allySide.reduce((sum, actor) => sum + (actor.maxHp - actor.hp), 0),
    enemyHpLost: allActors(state)
      .filter((actor) => actor.side === "enemy")
      .reduce((sum, actor) => sum + (actor.maxHp - actor.hp), 0),
    equipmentWear: equipment.reduce((sum, item) => sum + (item.maxDurability - item.durability), 0),
    actionPointsUnused: allySide.reduce(
      (sum, actor) => sum + actor.history.battle.counters.unused_action_points,
      0,
    ),
    reactionPointsUnused: allySide.reduce(
      (sum, actor) => sum + actor.history.battle.counters.unused_reaction_points,
      0,
    ),
    excessDamage: allActors(state).reduce((sum, actor) => sum + actor.history.battle.counters.excess_damage, 0),
    excessHealing: allActors(state).reduce((sum, actor) => sum + actor.history.battle.counters.excess_healing, 0),
    maxChainEventCount: maxChainEventCount(state),
  };

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    contentVersion: content.contentVersion,
    battleId: state.battleId,
    result: state.result,
    reason: state.reason,
    roundsUsed: state.roundsCompleted,
    actors,
    equipment,
    events: state.events,
    replaySnapshots: state.replaySnapshots,
    metrics,
  };
}

function maxChainEventCount(state) {
  const counts = new Map();
  for (const event of state.events) {
    counts.set(event.chainId, (counts.get(event.chainId) ?? 0) + 1);
  }
  return counts.size === 0 ? 0 : Math.max(...counts.values());
}
