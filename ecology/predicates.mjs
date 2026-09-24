// ecology/predicates.mjs
//
// §8 — the eleven v1 predicates. Content never supplies an expression, a string
// to eval, or a callback: a predicate is data, and the engine only reads the
// fields named below.
//
// A predicate whose subject cannot be resolved (dead, absent, not part of this
// event) is false. That is deliberate: §5.7 re-evaluates every rule immediately
// before it fires, and a rule whose subject vanished must simply not fire.

import { compareOp } from "./schema.mjs";
import { getActor, historyValue, resolveSubject, statusStacks } from "./actors.mjs";
import { resolveTargets } from "./selectors.mjs";

export function evaluatePredicates(state, ctx, predicates) {
  for (const predicate of predicates) {
    if (!evaluatePredicate(state, ctx, predicate)) return false;
  }
  return true;
}

export function evaluatePredicate(state, ctx, predicate) {
  switch (predicate.type) {
    case "always":
      return true;

    case "hp_percent": {
      const actor = resolveSubject(state, ctx, predicate.subject);
      if (!actor) return false;
      // Integer comparison, never a float division (§8).
      return compareOp(predicate.op, actor.hp * 100, actor.maxHp * predicate.value);
    }

    case "resource": {
      const actor = resolveSubject(state, ctx, predicate.subject);
      if (!actor) return false;
      const amount = predicate.resource === "action_points" ? actor.actionPoints : actor.reactionPoints;
      return compareOp(predicate.op, amount, predicate.value);
    }

    case "position": {
      const actor = resolveSubject(state, ctx, predicate.subject);
      if (!actor) return false;
      if (predicate.row !== undefined) {
        const row = actor.position.startsWith("front") ? "front" : "rear";
        return compareOp(predicate.op, row, predicate.row);
      }
      return compareOp(predicate.op, actor.position, predicate.value);
    }

    case "has_status": {
      const actor = resolveSubject(state, ctx, predicate.subject);
      if (!actor) return false;
      const stacks = statusStacks(actor, predicate.statusId);
      return compareOp(predicate.op ?? "gte", stacks, predicate.value ?? 1);
    }

    case "is_preparing": {
      const actor = resolveSubject(state, ctx, predicate.subject);
      if (!actor) return false;
      return (actor.preparation !== null) === predicate.value;
    }

    case "event_tag": {
      if (!ctx.event) return false;
      return ctx.event.tags.includes(predicate.tag) === (predicate.value ?? true);
    }

    case "event_value": {
      if (!ctx.event) return false;
      const raw = ctx.event.values[predicate.key];
      if (raw === undefined || raw === null) return false;
      return compareOp(predicate.op, raw, predicate.value);
    }

    case "event_target_is_attack_primary": {
      const targetActorId = ctx.event?.targetActorIds?.[0];
      const primaryTargetActorId = ctx.event?.values?.primaryTargetActorId;
      return Boolean(targetActorId && primaryTargetActorId && targetActorId === primaryTargetActorId);
    }

    case "history_count": {
      const actor = resolveSubject(state, ctx, predicate.subject);
      if (!actor) return false;
      return compareOp(predicate.op, historyValue(actor, predicate.metric, predicate.window), predicate.value);
    }

    case "attack_flag": {
      const attackIds = [ctx.event?.values?.attackId, ...(ctx.event?.values?.attackIds ?? [])]
        .filter((attackId) => typeof attackId === "string");
      if (attackIds.length === 0 || !state.chain || !ctx.owner) return false;
      return attackIds.some((attackId) => state.chain.attackFlags
        .get(`${attackId}:${ctx.owner.instanceId}`)?.has(predicate.key));
    }

    case "target_exists": {
      const reach = predicate.targetReach === "pending_action"
        ? (ctx.pendingAction?.reach ?? "unrestricted")
        : "unrestricted";
      const found = resolveTargets(state, ctx, predicate.query, { reach });
      return compareOp(predicate.op ?? "gte", found.length, predicate.value ?? 1);
    }

    case "hit_target_comparison": {
      const previous = ctx.event?.values?.previousTargetActorId;
      const current = ctx.event?.targetActorIds?.[0];
      if (typeof previous !== "string" || typeof current !== "string") return false;
      return predicate.relation === "same" ? previous === current : previous !== current;
    }

    case "round_number":
      return compareOp(predicate.op, state.round, predicate.value);

    default:
      // validate.mjs rejects unknown types long before this, so reaching here is
      // an engine bug rather than a content bug.
      throw new Error(`unimplemented predicate type: ${predicate.type}`);
  }
}

export { getActor };
