// ecology/actors.mjs
//
// Read-only helpers over battle state. Everything here is content-blind: no
// helper knows the id of any particular character, skill, equipment or enemy.

import { HISTORY_METRICS, HISTORY_WINDOWS, POSITION_ORDER, POSITION_ROW } from "./schema.mjs";

export function newHistory() {
  const window = () => ({
    counters: Object.fromEntries(HISTORY_METRICS.map((metric) => [metric, 0])),
    targetsSeen: [],
    lastTarget: null,
    streak: 0,
  });
  return Object.fromEntries(HISTORY_WINDOWS.map((name) => [name, window()]));
}

export function resetHistoryWindow(actor, windowName) {
  const fresh = newHistory()[windowName];
  actor.history[windowName] = fresh;
}

export function bumpHistory(actor, metric, amount = 1) {
  if (amount === 0) return;
  for (const windowName of HISTORY_WINDOWS) {
    actor.history[windowName].counters[metric] += amount;
  }
}

export function recordTargeted(actor, targetInstanceId) {
  for (const windowName of HISTORY_WINDOWS) {
    const window = actor.history[windowName];
    if (!window.targetsSeen.includes(targetInstanceId)) window.targetsSeen.push(targetInstanceId);
    if (window.lastTarget === targetInstanceId) window.streak += 1;
    else {
      window.lastTarget = targetInstanceId;
      window.streak = 1;
    }
  }
}

export function historyValue(actor, metric, windowName) {
  const window = actor.history[windowName];
  if (metric === "different_targets") return window.targetsSeen.length;
  if (metric === "same_target_streak") return window.streak;
  return window.counters[metric];
}

export function getActor(state, instanceId) {
  if (typeof instanceId !== "string") return null;
  return state.actors.get(instanceId) ?? null;
}

export function allActors(state) {
  return state.actorOrder.map((instanceId) => state.actors.get(instanceId));
}

export function actorsOnSide(state, side) {
  return allActors(state).filter((actor) => actor.side === side);
}

export function livingOnSide(state, side) {
  return actorsOnSide(state, side).filter((actor) => actor.alive);
}

export function opposingSide(side) {
  return side === "ally" ? "enemy" : "ally";
}

export function totalBarrier(actor) {
  return actor.barriers.reduce((sum, packet) => sum + packet.amount, 0);
}

export function statusStacks(actor, statusId) {
  const status = actor.statuses.find((entry) => entry.statusId === statusId);
  return status ? status.stacks : 0;
}

export function rowOf(actor) {
  return POSITION_ROW[actor.position];
}

export function positionIndex(actor) {
  return POSITION_ORDER[actor.position];
}

export function actorStat(actor, stat) {
  switch (stat) {
    case "max_hp": return actor.maxHp;
    case "current_hp": return actor.hp;
    case "barrier": return totalBarrier(actor);
    case "action_points": return actor.actionPoints;
    case "reaction_points": return actor.reactionPoints;
    // R6 §4.4 / §6.7 — PHASE A.
    case "might": return actor.might ?? 0;
    case "focus": return actor.focus ?? 0;
    case "guard": return actor.guard ?? 0;
    case "block": return actor.block ?? 0;
    default: return 0;
  }
}

// §8 — subjects. A missing subject resolves to null and every predicate that
// needs an actor then evaluates to false; it is never an error, so a rule whose
// subject died simply does not fire.
export function resolveSubject(state, ctx, subject) {
  switch (subject) {
    case "self":
      return ctx.owner ?? null;
    case "event_source":
      return ctx.event ? getActor(state, ctx.event.sourceActorId) : null;
    case "event_primary_target":
      return ctx.event ? getActor(state, ctx.event.targetActorIds[0]) : null;
    case "selected_target":
      return ctx.pendingAction ? getActor(state, ctx.pendingAction.targetActorIds[0]) : null;
    case "candidate_target":
      return ctx.candidate ?? null;
    default:
      return null;
  }
}

// §8 — integer comparison only. hp * 100 against maxHp * threshold keeps the
// engine free of floating point.
export function hpPercentSatisfied(actor, op, threshold, compare) {
  return compare(op, actor.hp * 100, actor.maxHp * threshold);
}

// Deterministic sort key used wherever two actors would otherwise tie.
export function compareActorsDefault(a, b) {
  const byPosition = positionIndex(a) - positionIndex(b);
  if (byPosition !== 0) return byPosition;
  return a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0;
}

