// ecology/selectors.mjs
//
// §9 — target queries. Every query ends with position_asc then instance_id_asc,
// so `take: 1` can never depend on array order coming out of a Map or a filter.

import { COLUMNS, IMPLICIT_SORTS, POSITION_COLUMN, POSITION_ROW, compareOp } from "./schema.mjs";
import {
  actorsOnSide,
  compareActorsDefault,
  getActor,
  opposingSide,
  positionIndex,
  statusStacks,
  totalBarrier,
} from "./actors.mjs";
import { BPS } from "./values.mjs";

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
    case "row_is":
      // **id の文字列から導かない。**語彙表を引く（POSITION_ROW）。
      // 前は startsWith("front") で見ていたが、行の判定は schema の持ち物で、
      // id の綴りに依存させると position を足したときに黙って壊れる。
      return POSITION_ROW[actor.position] === filter.row;
    case "hp_percent":
      return compareOp(filter.op, actor.hp * 100, actor.maxHp * filter.value);
    case "has_status":
      return compareOp(filter.op ?? "gte", statusStacks(actor, filter.statusId), filter.value ?? 1);
    case "has_defense":
      return totalBarrier(actor) > 0 || (actor.block ?? 0) > 0;
    case "has_block":
      return (actor.block ?? 0) > 0;
    case "has_defense_or_status":
      return totalBarrier(actor) > 0 || (actor.block ?? 0) > 0
        || statusStacks(actor, filter.statusId) > 0;
    case "is_preparing":
      return (actor.preparation !== null) === filter.value;
    case "previous_target":
      // Target continuity crosses action chains, so read the owner's
      // deterministic battle history. `lastResolvedTargets` remains chain-local
      // for overflow rules and must not be used for a target skill here.
      return Boolean(ctx.owner?.history?.battle)
        && ctx.owner.history.battle.lastTarget === actor.instanceId;
    case "not_previous_target":
      // "previous" is the target set of the most recent effect resolution in
      // this chain, which is what makes an overflow rule hand its leftover to
      // somebody else.
      return !state.chain.lastResolvedTargets.includes(actor.instanceId);
    case "not_self":
      // Ownerless region rules have no self, so the filter is a no-op there.
      return !ctx.owner || actor.instanceId !== ctx.owner.instanceId;
    case "has_open_position_in_row": {
      const occupied = new Set(actorsOnSide(state, actor.side)
        .filter((candidate) => candidate.alive && candidate.instanceId !== actor.instanceId)
        .map((candidate) => candidate.position));
      return COLUMNS.some((column) => !occupied.has(`${filter.row}_${column}`));
    }
    case "is_event_primary_target":
      return Boolean(ctx.event) && ctx.event.targetActorIds[0] === actor.instanceId;
    case "is_event_target":
      return Boolean(ctx.event) && ctx.event.targetActorIds.includes(actor.instanceId);
    case "not_event_primary_target":
      return Boolean(ctx.event) && ctx.event.targetActorIds[0] !== actor.instanceId;
    case "same_row_as_event_primary_target": {
      const primary = ctx.event ? getActor(state, ctx.event.targetActorIds[0]) : null;
      return Boolean(primary) && POSITION_ROW[primary.position] === POSITION_ROW[actor.position];
    }
    case "same_column_as_event_primary_target": {
      const primary = ctx.event ? getActor(state, ctx.event.targetActorIds[0]) : null;
      return Boolean(primary) && POSITION_COLUMN[primary.position] === POSITION_COLUMN[actor.position];
    }
    case "horizontal_adjacent_to_event_primary_target": {
      const primary = ctx.event ? getActor(state, ctx.event.targetActorIds[0]) : null;
      if (!primary || POSITION_ROW[primary.position] !== POSITION_ROW[actor.position]) return false;
      const primaryColumn = COLUMNS.indexOf(POSITION_COLUMN[primary.position]);
      const actorColumn = COLUMNS.indexOf(POSITION_COLUMN[actor.position]);
      return Math.abs(primaryColumn - actorColumn) === 1;
    }
    case "adjacent_to_event_primary_target": {
      const primary = ctx.event ? getActor(state, ctx.event.targetActorIds[0]) : null;
      if (!primary) return false;
      const rowDistance = POSITION_ROW[primary.position] === POSITION_ROW[actor.position] ? 0 : 1;
      const columnDistance = Math.abs(
        COLUMNS.indexOf(POSITION_COLUMN[primary.position])
          - COLUMNS.indexOf(POSITION_COLUMN[actor.position]),
      );
      return rowDistance + columnDistance === 1;
    }
    case "not_acted_this_round":
      return (actor.activationsThisRound === 0) === (filter.value ?? true);
    case "is_event_source":
      // DEVIATION (PREFLIGHT §1).
      return Boolean(ctx.event) && ctx.event.sourceActorId === actor.instanceId;
    default:
      throw new Error(`unimplemented target filter: ${filter.type}`);
  }
}

function hpPercentBps(actor) {
  const ceiling = Math.max(1, actor.maxHp ?? 1);
  return Math.floor(actor.hp * BPS / ceiling);
}

function sortValue(actor, sort, ctx) {
  const sortType = typeof sort === "string" ? sort : sort.type;
  switch (sortType) {
    case "hp_asc": return actor.hp;
    case "hp_desc": return -actor.hp;
    // issue #176 — 傷の深さで並べる。**整数 bps で作るので浮動小数を通さない。**
    // 上限が 0 の actor は作られない（schema が maxHp >= 1 を要求する）。
    case "hp_percent_asc": return hpPercentBps(actor);
    case "hp_percent_desc": return -hpPercentBps(actor);
    case "barrier_asc": return totalBarrier(actor);
    case "barrier_desc": return -totalBarrier(actor);
    case "block_desc": return -(actor.block ?? 0);
    case "has_block_desc": return (actor.block ?? 0) > 0 ? -1 : 0;
    case "guard_desc": return -(actor.guard ?? 0);
    case "position_asc": return positionIndex(actor);
    case "position_desc": return -positionIndex(actor);
    case "status_stacks_desc": return -statusStacks(actor, sort.statusId);
    case "distance_to_self_asc": {
      if (!ctx.owner) return 0;
      const rowDistance = POSITION_ROW[actor.position] === POSITION_ROW[ctx.owner.position] ? 0 : 1;
      const columnDistance = Math.abs(COLUMNS.indexOf(POSITION_COLUMN[actor.position])
        - COLUMNS.indexOf(POSITION_COLUMN[ctx.owner.position]));
      return rowDistance + columnDistance;
    }
    default: return 0;
  }
}

export function resolveTargets(state, ctx, query, { reach = "unrestricted" } = {}) {
  let pool = scopePool(state, ctx, query.scope);
  // R6 §5.4 — melee は、生存する前列が一人でもいる間は前列だけを狙える。
  // 前列が全滅して初めて後列へ届く。**これが前3後2と前2後3の選択を意味あるものにする。**
  if (reach === "melee") {
    const living = pool.filter((actor) => actor.alive);
    if (living.some((actor) => POSITION_ROW[actor.position] === "front")) {
      pool = pool.filter((actor) => POSITION_ROW[actor.position] === "front");
    }
  }
  for (const filter of query.filters ?? []) {
    pool = pool.filter((actor) => passesFilter(state, ctx, filter, actor));
  }
  // R25 大盾R — a round-scoped taunt only redirects enemy single-target
  // choices. Keep the legal pool and reach restriction intact first, so a
  // taunted actor behind an unreachable front line is not selected through it.
  if (ctx.owner?.side === "enemy" && query.scope === "enemies" && query.take === 1) {
    const tauntStatusIds = new Set(Object.entries(state.content.statuses ?? {})
      .filter(([, definition]) => (definition.tags ?? []).includes("taunt"))
      .map(([statusId]) => statusId));
    const taunted = pool.filter((actor) => actor.statuses.some((status) => (
      status.stacks > 0 && tauntStatusIds.has(status.statusId)
    )));
    if (taunted.length > 0) pool = taunted;
  }
  const sorts = [...(query.sort ?? []), ...IMPLICIT_SORTS];
  const sorted = [...pool].sort((a, b) => {
    for (const sort of sorts) {
      const sortType = typeof sort === "string" ? sort : sort.type;
      if (sortType === "instance_id_asc") {
        if (a.instanceId !== b.instanceId) return a.instanceId < b.instanceId ? -1 : 1;
        continue;
      }
      const difference = sortValue(a, sort, ctx) - sortValue(b, sort, ctx);
      if (difference !== 0) return difference;
    }
    return compareActorsDefault(a, b);
  });
  return query.take === 1 ? sorted.slice(0, 1) : sorted;
}
