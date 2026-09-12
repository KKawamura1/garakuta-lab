// ecology/event-queue.mjs
//
// §7 — the causal event列. Event ids come from the sequence number, so two runs
// of the same input produce byte-identical ids. Nothing here knows about rules;
// engine.mjs owns reaction dispatch.
//
// §14 — the caps live here too, because the only honest place to notice a free
// cycle is the moment an event is appended.

import { EcologyRuntimeError } from "./errors.mjs";

export function nextEventId(sequence) {
  return `evt_${String(sequence).padStart(4, "0")}`;
}

export function beginChain(state, rootType) {
  state.chainSequence += 1;
  const frame = {
    id: `chain_${String(state.chainSequence).padStart(4, "0")}`,
    rootType,
    eventCount: 0,
    afterQueue: [],
    ruleFirings: new Map(),
    lastResolvedTargets: [],
    // Recovery is bounded per side so several heal sources cannot add up to
    // more than that side's HP damage in this action/reaction chain.
    damageTakenBySide: { ally: 0, enemy: 0 },
    recoveryBudgetBySide: { ally: 0, enemy: 0 },
  };
  state.chain = frame;
  return frame;
}

export function endChain(state) {
  state.chain = null;
}

function actorSnapshots(state) {
  return state.actorOrder.map((instanceId) => {
    const actor = state.actors.get(instanceId);
    return {
      instanceId: actor.instanceId,
      definitionId: actor.definitionId,
      displayName: actor.displayName,
      side: actor.side,
      position: actor.position,
      hp: actor.hp,
      maxHp: actor.maxHp,
      recoverableDamage: state.recoveryWindows?.get(actor.instanceId)?.remaining ?? 0,
      recoveredDamage: Math.min(actor.hp, actor.recoveredDamage ?? 0),
      unrecoverableDamage: Math.max(
        0,
        actor.maxHp - actor.hp - (state.recoveryWindows?.get(actor.instanceId)?.remaining ?? 0),
      ),
      alive: actor.alive,
      actionPoints: actor.actionPoints,
      reactionPoints: actor.reactionPoints,
      barrier: (actor.barriers || []).reduce((sum, packet) => sum + packet.amount, 0),
      // R6 §4.4 / §6.7 — PHASE A. 盤面が guard と block を出せるように運ぶ。
      // **出せない値は、遊ぶ側にとって無いのと同じ。**
      guard: actor.guard ?? 0,
      block: actor.block ?? 0,
      might: actor.might ?? 0,
      focus: actor.focus ?? 0,
      statuses: (actor.statuses || []).map((status) => ({
        statusId: status.statusId,
        stacks: status.stacks,
      })),
      preparation: actor.preparation
        ? { skillId: actor.preparation.skillId, stepsRemaining: actor.preparation.stepsRemaining }
        : null,
    };
  });
}

// §7 — every event carries the same shape. Display text never goes in: values
// are facts, and the renderer is expected to replay them (§3.1).
export function pushEvent(state, spec) {
  const sequence = state.sequence;
  state.sequence += 1;
  const event = {
    id: nextEventId(sequence),
    sequence,
    type: spec.type,
    round: state.round,
    chainId: state.chain ? state.chain.id : "chain_0000",
    parentEventId: spec.parentEventId ?? state.parentEventId ?? undefined,
    sourceActorId: spec.sourceActorId ?? undefined,
    targetActorIds: spec.targetActorIds ?? [],
    sourceDefinitionId: spec.sourceDefinitionId ?? undefined,
    ruleId: spec.ruleId ?? undefined,
    skillId: spec.skillId ?? undefined,
    equipmentInstanceId: spec.equipmentInstanceId ?? undefined,
    tags: spec.tags ?? [],
    values: spec.values ?? {},
  };
  for (const key of Object.keys(event)) {
    if (event[key] === undefined) delete event[key];
  }
  state.events.push(event);
  state.eventsById.set(event.id, event);
  if (state.chain) {
    state.chain.eventCount += 1;
    if (state.chain.eventCount > state.options.maxEventsPerChain) {
      throw runtimeError(state, "chain event limit reached", {
        limit: "maxEventsPerChain",
        limitValue: state.options.maxEventsPerChain,
      });
    }
  }
  if (state.events.length > state.options.maxEventsPerBattle) {
    throw runtimeError(state, "battle event limit reached", {
      limit: "maxEventsPerBattle",
      limitValue: state.options.maxEventsPerBattle,
    });
  }
  if (state.options.captureReplaySnapshots) {
    state.replaySnapshots.push(actorSnapshots(state));
  }
  return event;
}

// §14 — the diagnostics an implementer needs to find the loop without a rerun.
export function runtimeError(state, message, extra = {}) {
  const recentEvents = state.events.slice(-20).map((event) => ({
    id: event.id,
    sequence: event.sequence,
    type: event.type,
    round: event.round,
    chainId: event.chainId,
    parentEventId: event.parentEventId ?? null,
    sourceActorId: event.sourceActorId ?? null,
    targetActorIds: event.targetActorIds,
    ruleId: event.ruleId ?? null,
    skillId: event.skillId ?? null,
  }));
  const chainRuleFirings = state.chain
    ? Object.fromEntries([...state.chain.ruleFirings.entries()].map(([key, count]) => [key, count]))
    : {};
  const diagnostics = {
    battleId: state.battleId,
    round: state.round,
    currentActorId: state.currentActorId ?? null,
    chainId: state.chain ? state.chain.id : null,
    eventSequence: state.sequence,
    parentEventId: state.parentEventId ?? null,
    ruleActivationStack: state.ruleStack.map((entry) => ({
      ruleId: entry.ruleId,
      ownerId: entry.ownerId,
      listenTo: entry.listenTo,
      timing: entry.timing,
      triggeredByEventId: entry.triggeredByEventId,
    })),
    chainRuleFirings,
    recentEvents,
    ...extra,
  };
  return new EcologyRuntimeError(`${message} (battle ${state.battleId}, round ${state.round})`, diagnostics);
}
