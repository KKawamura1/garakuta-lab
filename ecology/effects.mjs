// ecology/effects.mjs
//
// §10.1 costs and §12 atomic effects. Everything in this file is driven by the
// effect's own data; there is no branch on a character, skill, equipment or
// enemy id anywhere below, which is what lets Gate E add content without
// touching engine code.
//
// `rt` is the runtime handed in by engine.mjs: { state, emit, onResourceGained }.
// emit(spec, pendingFrame) records the event and, when a pending frame is given,
// runs the interrupt window for it before returning.

import {
  bumpHistory,
  getActor,
  positionIndex,
  statusStacks,
  totalBarrier,
} from "./actors.mjs";
import { resolveTargets } from "./selectors.mjs";
import { evaluateValue } from "./values.mjs";

const DURATION_RANK = { round: 0, battle: 1 };

function sourceFields(ctx) {
  return {
    sourceActorId: ctx.owner ? ctx.owner.instanceId : undefined,
    sourceDefinitionId: ctx.sourceDefinitionId,
    ruleId: ctx.ruleId,
    skillId: ctx.skillId,
    equipmentInstanceId: ctx.equipmentInstanceId,
  };
}

function selectTargets(rt, ctx, query) {
  const targets = resolveTargets(rt.state, ctx, query);
  rt.state.chain.lastResolvedTargets = targets.map((actor) => actor.instanceId);
  return targets;
}

function equipmentInstance(rt, ctx) {
  if (!ctx.owner || !ctx.equipmentInstanceId) return null;
  return ctx.owner.equipment.find((item) => item.instanceId === ctx.equipmentInstanceId) ?? null;
}

// ---------------------------------------------------------------- costs (§10.1)

export function canPayCosts(rt, ctx, costs) {
  if (!ctx.owner) return costs.length === 0;
  for (const cost of costs) {
    switch (cost.type) {
      case "spend_action_points":
        if (ctx.owner.actionPoints < cost.amount) return false;
        break;
      case "spend_reaction_points":
        if (ctx.owner.reactionPoints < cost.amount) return false;
        break;
      case "lose_hp":
        // §10.1 — a cost never kills its payer in v1.
        if (ctx.owner.hp <= cost.amount) return false;
        break;
      case "consume_barrier":
        if (totalBarrier(ctx.owner) < cost.amount) return false;
        break;
      case "wear_equipment": {
        const item = equipmentInstance(rt, ctx);
        if (!item || item.broken || item.durability < cost.amount) return false;
        break;
      }
      default:
        throw new Error(`unimplemented cost type: ${cost.type}`);
    }
  }
  return true;
}

// §10.1 — all or nothing. canPayCosts has already said yes, so nothing here can
// half-pay and roll back.
export function payCosts(rt, ctx, costs) {
  for (const cost of costs) {
    switch (cost.type) {
      case "spend_action_points":
      case "spend_reaction_points": {
        const resource = cost.type === "spend_action_points" ? "action_points" : "reaction_points";
        spendResource(rt, ctx, ctx.owner, resource, cost.amount);
        break;
      }
      case "lose_hp": {
        const before = ctx.owner.hp;
        ctx.owner.hp -= cost.amount;
        bumpHistory(ctx.owner, "damage_taken", cost.amount);
        rt.emit({
          type: "damage_taken",
          ...sourceFields(ctx),
          targetActorIds: [ctx.owner.instanceId],
          tags: ["cost"],
          values: { amount: cost.amount, hpBefore: before, hpAfter: ctx.owner.hp, proposed: cost.amount },
        });
        break;
      }
      case "consume_barrier":
        absorbBarrier(rt, ctx, ctx.owner, cost.amount, ["cost"]);
        break;
      case "wear_equipment":
        wearEquipmentInstance(rt, ctx, equipmentInstance(rt, ctx), cost.amount, ["cost"]);
        break;
      default:
        throw new Error(`unimplemented cost type: ${cost.type}`);
    }
  }
}

function spendResource(rt, ctx, actor, resource, amount) {
  const key = resource === "action_points" ? "actionPoints" : "reactionPoints";
  const before = actor[key];
  actor[key] = before - amount;
  rt.emit({
    type: "resource_spent",
    ...sourceFields(ctx),
    targetActorIds: [actor.instanceId],
    tags: [resource],
    values: { resource, amount, before, after: actor[key] },
  });
}

// ------------------------------------------------------------- effects (§10.2)

export function applyEffects(rt, ctx, effects) {
  for (const effect of effects) {
    applyEffect(rt, ctx, effect);
  }
}

export function applyEffect(rt, ctx, effect) {
  switch (effect.type) {
    case "deal_damage": return dealDamage(rt, ctx, effect);
    case "heal": return applyHealing(rt, ctx, effect);
    case "gain_barrier": return gainBarrier(rt, ctx, effect);
    case "gain_resource": return gainResource(rt, ctx, effect);
    case "add_status": return addStatus(rt, ctx, effect);
    case "remove_status": return removeStatus(rt, ctx, effect);
    case "swap_positions": return swapPositions(rt, ctx, effect);
    case "start_preparation": return startPreparation(rt, ctx, effect);
    case "advance_preparation": return advancePreparation(rt, ctx, effect);
    case "interrupt_preparation": return interruptPreparation(rt, ctx, effect);
    case "wear_equipment": return wearEquipmentEffect(rt, ctx, effect);
    case "modify_pending_amount": return modifyPendingAmount(rt, ctx, effect);
    case "redirect_pending_target": return redirectPendingTarget(rt, ctx, effect);
    case "cancel_pending_action": return cancelPendingAction(rt, ctx, effect);
    default:
      // §4.1 — an unimplemented effect throws instead of silently doing nothing.
      throw new Error(`unimplemented effect type: ${effect.type}`);
  }
}

// §12.1 — damage.
function dealDamage(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.alive) continue;
    const proposed = evaluateValue(rt.state, ctx, effect.amount);
    const frame = { kind: "amount", amount: proposed, targetActorIds: [target.instanceId] };
    const event = rt.emit(
      {
        type: "damage_proposed",
        ...sourceFields(ctx),
        targetActorIds: [target.instanceId],
        tags: effect.tags ?? [],
        values: { amount: proposed },
      },
      frame,
    );
    const finalTarget = getActor(rt.state, frame.targetActorIds[0]);
    if (!finalTarget || !finalTarget.alive) continue;
    const amount = frame.amount;
    const absorbed = absorbBarrier(rt, ctx, finalTarget, amount, []);
    const remaining = amount - absorbed;
    const hpBefore = finalTarget.hp;
    const hpDamage = Math.min(hpBefore, remaining);
    if (hpDamage > 0) {
      finalTarget.hp = hpBefore - hpDamage;
      bumpHistory(finalTarget, "damage_taken", hpDamage);
      if (ctx.owner) bumpHistory(ctx.owner, "damage_dealt", hpDamage);
      rt.emit({
        type: "damage_taken",
        ...sourceFields(ctx),
        parentEventId: event.id,
        targetActorIds: [finalTarget.instanceId],
        tags: effect.tags ?? [],
        values: {
          amount: hpDamage,
          hpBefore,
          hpAfter: finalTarget.hp,
          proposed: amount,
          barrierAbsorbed: absorbed,
        },
      });
    }
    if (finalTarget.hp === 0 && finalTarget.alive) {
      defeatActor(rt, ctx, finalTarget, event.id);
    }
    // §12.1 — max(0, proposedAfterInterrupt - barrierAbsorbed - hpBefore)
    const excess = Math.max(0, amount - absorbed - hpBefore);
    if (excess > 0) {
      if (ctx.owner) bumpHistory(ctx.owner, "excess_damage", excess);
      rt.emit({
        type: "excess_damage",
        ...sourceFields(ctx),
        parentEventId: event.id,
        targetActorIds: [finalTarget.instanceId],
        tags: effect.tags ?? [],
        values: { amount: excess, proposed: amount, barrierAbsorbed: absorbed, hpBefore },
      });
    }
  }
}

// §12.3 — packets are consumed earliest-expiry first, then oldest first.
function absorbBarrier(rt, ctx, target, amount, tags) {
  let remaining = amount;
  let absorbed = 0;
  const packets = [...target.barriers].sort((a, b) => {
    const byDuration = DURATION_RANK[a.duration] - DURATION_RANK[b.duration];
    if (byDuration !== 0) return byDuration;
    return a.createdSequence - b.createdSequence;
  });
  for (const packet of packets) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, packet.amount);
    if (take <= 0) continue;
    packet.amount -= take;
    remaining -= take;
    absorbed += take;
    rt.emit({
      type: "barrier_damaged",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags,
      values: { amount: take, packetRemaining: packet.amount, duration: packet.duration },
    });
    if (packet.amount === 0) {
      target.barriers = target.barriers.filter((entry) => entry !== packet);
      rt.emit({
        type: "barrier_broken",
        ...sourceFields(ctx),
        targetActorIds: [target.instanceId],
        tags,
        values: { duration: packet.duration, barrierTotal: totalBarrier(target) },
      });
    }
  }
  return absorbed;
}

function defeatActor(rt, ctx, target, parentEventId) {
  target.alive = false;
  target.inQueue = false;
  rt.emit({
    type: "actor_defeated",
    ...sourceFields(ctx),
    parentEventId,
    targetActorIds: [target.instanceId],
    tags: [target.side],
    values: { definitionId: target.definitionId, side: target.side },
  });
  // §12.4 — a defeated actor loses its pending preparation, and the event says why.
  if (target.preparation) {
    const steps = target.preparation.stepsRemaining;
    target.preparation = null;
    rt.emit({
      type: "preparation_interrupted",
      targetActorIds: [target.instanceId],
      tags: ["actor_defeated"],
      values: { cause: "actor_defeated", stepsRemaining: steps },
    });
  }
}

// §12.2 — healing.
function applyHealing(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    // §12.2-6 — a 0 HP actor is not a healing target in v1; revival is not implemented.
    if (!target.alive) continue;
    const proposed = evaluateValue(rt.state, ctx, effect.amount);
    const frame = { kind: "amount", amount: proposed, targetActorIds: [target.instanceId] };
    const event = rt.emit(
      {
        type: "healing_proposed",
        ...sourceFields(ctx),
        targetActorIds: [target.instanceId],
        tags: effect.tags ?? [],
        values: { amount: proposed },
      },
      frame,
    );
    const finalTarget = getActor(rt.state, frame.targetActorIds[0]);
    if (!finalTarget || !finalTarget.alive) continue;
    const requested = frame.amount;
    const actual = Math.min(requested, finalTarget.maxHp - finalTarget.hp);
    finalTarget.hp += actual;
    if (ctx.owner) bumpHistory(ctx.owner, "healing_done", actual);
    rt.emit({
      type: "healing_applied",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags: effect.tags ?? [],
      values: { requested, actual, hpAfter: finalTarget.hp },
    });
    const excess = requested - actual;
    if (excess > 0) {
      if (ctx.owner) bumpHistory(ctx.owner, "excess_healing", excess);
      rt.emit({
        type: "excess_healing",
        ...sourceFields(ctx),
        parentEventId: event.id,
        targetActorIds: [finalTarget.instanceId],
        tags: effect.tags ?? [],
        values: { amount: excess, requested, actual },
      });
    }
  }
}

// §12.3 — barrier packets. v1 puts no cap on the total: dominance is a content
// question, and the engine must not quietly truncate it.
function gainBarrier(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.alive) continue;
    const amount = evaluateValue(rt.state, ctx, effect.amount);
    if (amount <= 0) continue;
    target.barriers.push({
      amount,
      duration: effect.duration,
      createdSequence: rt.state.sequence,
      sourceActorId: ctx.owner ? ctx.owner.instanceId : undefined,
      sourceDefinitionId: ctx.sourceDefinitionId,
    });
    rt.emit({
      type: "barrier_gained",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: [effect.duration],
      values: { amount, duration: effect.duration, barrierTotal: totalBarrier(target) },
    });
  }
}

function gainResource(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.alive) continue;
    const amount = evaluateValue(rt.state, ctx, effect.amount);
    if (amount <= 0) continue;
    const key = effect.resource === "action_points" ? "actionPoints" : "reactionPoints";
    const before = target[key];
    target[key] = before + amount;
    rt.emit({
      type: "resource_gained",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: [effect.resource],
      values: { resource: effect.resource, amount, before, after: target[key] },
    });
    // §11.3 — gaining action points after an activation can put an actor back in
    // the queue. engine.mjs owns that rule; effects only report the gain.
    if (effect.resource === "action_points") rt.onResourceGained(target);
  }
}

function addStatus(rt, ctx, effect) {
  const definition = rt.state.content.statuses[effect.statusId];
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.alive) continue;
    const stacks = effect.stacks ?? 1;
    const existing = target.statuses.find((entry) => entry.statusId === effect.statusId);
    const before = existing ? existing.stacks : 0;
    const after = Math.min(definition.maxStacks, before + stacks);
    if (after === before) continue;
    if (existing) existing.stacks = after;
    else {
      target.statuses.push({
        statusId: effect.statusId,
        stacks: after,
        duration: definition.duration,
        addedSequence: rt.state.sequence,
      });
    }
    rt.emit({
      type: "status_added",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: [definition.polarity, definition.duration],
      values: { statusId: effect.statusId, added: after - before, stacks: after, duration: definition.duration },
    });
  }
}

function removeStatus(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    const existing = target.statuses.find((entry) => entry.statusId === effect.statusId);
    if (!existing) continue;
    const before = existing.stacks;
    const removed = effect.stacks === "all" ? before : Math.min(before, effect.stacks ?? 1);
    existing.stacks = before - removed;
    if (existing.stacks === 0) {
      target.statuses = target.statuses.filter((entry) => entry !== existing);
    }
    rt.emit({
      type: "status_removed",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: ["effect"],
      values: { statusId: effect.statusId, removed, remaining: before - removed, cause: "effect" },
    });
  }
}

// §12.5 — the swap is atomic: no event ever shows two actors on one position.
function swapPositions(rt, ctx, effect) {
  const first = selectTargets(rt, ctx, effect.target)[0];
  const second = selectTargets(rt, ctx, effect.otherTarget)[0];
  if (!first || !second) return;
  if (first === second || first.side !== second.side) return;
  if (!first.alive || !second.alive) return;
  const firstFrom = first.position;
  const secondFrom = second.position;
  first.position = secondFrom;
  second.position = firstFrom;
  bumpHistory(first, "times_moved", 1);
  bumpHistory(second, "times_moved", 1);
  for (const [actor, from, to] of [[first, firstFrom, secondFrom], [second, secondFrom, firstFrom]]) {
    rt.emit({
      type: "actor_moved",
      ...sourceFields(ctx),
      targetActorIds: [actor.instanceId],
      tags: ["swap"],
      values: { from, to, rowChanged: from.startsWith("front") !== to.startsWith("front") },
    });
  }
}

// §12.4 — preparation.
export function startPreparationOn(rt, ctx, actor, steps, completionEffects, meta) {
  if (!actor.alive || actor.preparation) return;
  actor.preparation = {
    steps,
    stepsRemaining: steps,
    completionEffects,
    skillId: meta.skillId,
    sourceDefinitionId: meta.sourceDefinitionId,
    ruleId: meta.ruleId,
    equipmentInstanceId: meta.equipmentInstanceId,
  };
  rt.emit({
    type: "preparation_started",
    sourceActorId: actor.instanceId,
    targetActorIds: [actor.instanceId],
    sourceDefinitionId: meta.sourceDefinitionId,
    ruleId: meta.ruleId,
    skillId: meta.skillId,
    equipmentInstanceId: meta.equipmentInstanceId,
    tags: [],
    values: { steps, stepsRemaining: steps },
  });
}

function startPreparation(rt, ctx, effect) {
  const targets = effect.target ? selectTargets(rt, ctx, effect.target) : ctx.owner ? [ctx.owner] : [];
  for (const target of targets) {
    startPreparationOn(rt, ctx, target, effect.steps, effect.completionEffects, {
      skillId: ctx.skillId,
      sourceDefinitionId: ctx.sourceDefinitionId,
      ruleId: ctx.ruleId,
      equipmentInstanceId: ctx.equipmentInstanceId,
    });
  }
}

export function advancePreparationOn(rt, ctx, actor, amount) {
  if (!actor.preparation || !actor.alive) return false;
  const before = actor.preparation.stepsRemaining;
  const after = Math.max(0, before - amount);
  actor.preparation.stepsRemaining = after;
  rt.emit({
    type: "preparation_advanced",
    ...sourceFields(ctx),
    targetActorIds: [actor.instanceId],
    tags: [],
    values: { before, amount: before - after, after },
  });
  if (after === 0) {
    completePreparation(rt, actor);
    return true;
  }
  return false;
}

export function completePreparation(rt, actor) {
  const preparation = actor.preparation;
  actor.preparation = null;
  rt.emit({
    type: "preparation_completed",
    sourceActorId: actor.instanceId,
    targetActorIds: [actor.instanceId],
    sourceDefinitionId: preparation.sourceDefinitionId,
    ruleId: preparation.ruleId,
    skillId: preparation.skillId,
    equipmentInstanceId: preparation.equipmentInstanceId,
    tags: [],
    values: { steps: preparation.steps },
  });
  // §12.4 — no extra cost on completion; only the effects run.
  applyEffects(
    rt,
    {
      owner: actor,
      event: null,
      pending: null,
      pendingAction: null,
      candidate: null,
      sourceDefinitionId: preparation.sourceDefinitionId,
      ruleId: preparation.ruleId,
      skillId: preparation.skillId,
      equipmentInstanceId: preparation.equipmentInstanceId,
    },
    preparation.completionEffects,
  );
}

function advancePreparation(rt, ctx, effect) {
  const amount = effect.amount ? evaluateValue(rt.state, ctx, effect.amount) : 1;
  for (const target of selectTargets(rt, ctx, effect.target)) {
    advancePreparationOn(rt, ctx, target, amount);
  }
}

function interruptPreparation(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.preparation) continue;
    const steps = target.preparation.stepsRemaining;
    target.preparation = null;
    rt.emit({
      type: "preparation_interrupted",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: ["effect"],
      values: { cause: "effect", stepsRemaining: steps },
    });
  }
}

// §12.6 — equipment wear. The instance is always the one the rule came from.
export function wearEquipmentInstance(rt, ctx, item, amount, tags) {
  if (!item || item.broken) return;
  const before = item.durability;
  const worn = Math.min(before, amount);
  item.durability = before - worn;
  rt.emit({
    type: "equipment_worn",
    ...sourceFields(ctx),
    targetActorIds: [ctx.owner ? ctx.owner.instanceId : item.instanceId],
    equipmentInstanceId: item.instanceId,
    tags,
    values: { equipmentId: item.equipmentId, before, amount: worn, after: item.durability },
  });
  if (item.durability === 0) {
    item.broken = true;
    rt.emit({
      type: "equipment_broken",
      ...sourceFields(ctx),
      targetActorIds: [ctx.owner ? ctx.owner.instanceId : item.instanceId],
      equipmentInstanceId: item.instanceId,
      tags,
      values: { equipmentId: item.equipmentId },
    });
  }
}

function wearEquipmentEffect(rt, ctx, effect) {
  const amount = effect.amount ? evaluateValue(rt.state, ctx, effect.amount) : 1;
  wearEquipmentInstance(rt, ctx, equipmentInstance(rt, ctx), amount, []);
}

// §11.4 — interrupt-only effects. validate.mjs guarantees the pending frame that
// each one needs actually exists for the event it listens to.
function modifyPendingAmount(rt, ctx, effect) {
  const frame = ctx.pending;
  if (!frame || frame.kind !== "amount") return;
  const amount = evaluateValue(rt.state, ctx, effect.amount);
  if (effect.operation === "set") frame.amount = amount;
  else if (effect.operation === "decrease") frame.amount = Math.max(0, frame.amount - amount);
  else frame.amount = frame.amount + amount;
}

function redirectPendingTarget(rt, ctx, effect) {
  const frame = ctx.pending;
  if (!frame) return;
  const replacement = selectTargets(rt, ctx, effect.target)[0];
  if (!replacement) return;
  const from = frame.targetActorIds[0] ?? null;
  if (from === replacement.instanceId) return;
  frame.targetActorIds = [replacement.instanceId];
  rt.emit({
    type: "target_changed",
    ...sourceFields(ctx),
    targetActorIds: [replacement.instanceId],
    tags: ["redirect"],
    values: { from, to: replacement.instanceId },
  });
}

function cancelPendingAction(rt, ctx, effect) {
  const frame = ctx.pending;
  if (!frame || frame.kind !== "action") return;
  frame.canceled = true;
  frame.cancelReason = { ruleId: ctx.ruleId ?? null, ownerId: ctx.owner ? ctx.owner.instanceId : null };
}

export { selectTargets, equipmentInstance, statusStacks, positionIndex };
