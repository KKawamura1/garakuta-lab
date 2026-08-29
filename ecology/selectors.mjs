// ecology/selectors.mjs
//
// §9 — target queries. Every query ends with position_asc then instance_id_asc,
// so `take: 1` can never depend on array order coming out of a Map or a filter.

import { IMPLICIT_SORTS, compareOp } from "./schema.mjs";
import {
  actorsOnSide,
  compareActorsDefault,
  getActor,
  opposingSide,
  positionIndex,
  statusStacks,
  totalBarrier,
} from "./actors.mjs";

function scopePool(state, ctx, scope) {
  switch (scope) {
    case "self":
      return ctx.owner ? [ctx.owner] : [];
    case "allies":
      // A region rule has no owner; "allies" then means the ally side and
      // "enemies" the enemy side (PREFLIGHT §7).
      return actorsOnSide(state, ctx.owner ? ctx.owner.side : "ally");
    case "enemies":
      return actorsOnSide(state, ctx.owner ? opposingSide(ctx.owner.side) : "enemy");
    case "event_source": {
      if (!ctx.event) return [];
      const actor = getActor(state, ctx.event.sourceActorId);
      return actor ? [actor] : [];
    }
    case "event_targets": {
      if (!ctx.event) return [];
      return ctx.event.targetActorIds
        .map((instanceId) => getActor(state, instanceId))
        .filter((actor) => actor !== null);
    }
    default:
      throw new Error(`unimplemented target scope: ${scope}`);
  }
}

function passesFilter(state, ctx, filter, actor) {
  switch (filter.type) {
    case "alive":
      return actor.alive === (filter.value ?? true);
    case "row_is": {
      const row = actor.position.startsWith("front") ? "front" : "rear";
      return row === filter.row;
    }
    case "hp_percent":
      return compareOp(filter.op, actor.hp * 100, actor.maxHp * filter.value);
    case "has_status":
      return compareOp(filter.op ?? "gte", statusStacks(actor, filter.statusId), filter.value ?? 1);
    case "is_preparing":
      return (actor.preparation !== null) === filter.value;
    case "not_previous_target":
      // "previous" is the target set of the most recent effect resolution in
      // this chain, which is what makes an overflow rule hand its leftover to
      // somebody else (README §not_previous_target).
      return !state.chain.lastResolvedTargets.includes(actor.instanceId);
    case "is_event_primary_target":
      return Boolean(ctx.event) && ctx.event.targetActorIds[0] === actor.instanceId;
    case "is_event_source":
      // DEVIATION (PREFLIGHT §1).
      return Boolean(ctx.event) && ctx.event.sourceActorId === actor.instanceId;
    default:
      throw new Error(`unimplemented target filter: ${filter.type}`);
  }
}

function sortValue(actor, sortType) {
  switch (sortType) {
    case "hp_asc": return actor.hp;
    case "hp_desc": return -actor.hp;
    case "barrier_asc": return totalBarrier(actor);
    case "barrier_desc": return -totalBarrier(actor);
    case "speed_asc": return actor.speed;
    case "speed_desc": return -actor.speed;
    case "position_asc": return positionIndex(actor);
    default: return 0;
  }
}

export function resolveTargets(state, ctx, query) {
  let pool = scopePool(state, ctx, query.scope);
  for (const filter of query.filters ?? []) {
    pool = pool.filter((actor) => passesFilter(state, ctx, filter, actor));
  }
  const sorts = [...(query.sort ?? []).map((entry) => entry.type ?? entry), ...IMPLICIT_SORTS];
  const sorted = [...pool].sort((a, b) => {
    for (const sortType of sorts) {
      if (sortType === "instance_id_asc") {
        if (a.instanceId !== b.instanceId) return a.instanceId < b.instanceId ? -1 : 1;
        continue;
      }
      const difference = sortValue(a, sortType) - sortValue(b, sortType);
      if (difference !== 0) return difference;
    }
    return compareActorsDefault(a, b);
  });
  return query.take === 1 ? sorted.slice(0, 1) : sorted;
}
