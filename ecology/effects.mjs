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

import { POSITION_COLUMN, POSITION_ROW, SKILL_LEVEL_STEP_BPS } from "./schema.mjs";
import {
  actorsOnSide,
  bumpHistory,
  compareActorsDefault,
  getActor,
  positionIndex,
  statusStacks,
  totalBarrier,
} from "./actors.mjs";
import { resolveTargets } from "./selectors.mjs";
import { BPS, evaluateValue, roundHalfUpDiv } from "./values.mjs";

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

function selectTargets(rt, ctx, query, options) {
  const targets = resolveTargets(rt.state, ctx, query, options);
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
    case "gain_block": return gainBlock(rt, ctx, effect);
    case "gain_resource": return gainResource(rt, ctx, effect);
    case "add_status": return addStatus(rt, ctx, effect);
    case "remove_status": return removeStatus(rt, ctx, effect);
    case "swap_positions": return swapPositions(rt, ctx, effect);
    case "start_preparation": return startPreparation(rt, ctx, effect);
    case "advance_preparation": return advancePreparation(rt, ctx, effect);
    case "interrupt_preparation": return interruptPreparation(rt, ctx, effect);
    case "wear_equipment": return wearEquipmentEffect(rt, ctx, effect);
    case "repair_equipment": return repairEquipmentEffect(rt, ctx, effect);
    case "modify_pending_amount": return modifyPendingAmount(rt, ctx, effect);
    case "redirect_pending_target": return redirectPendingTarget(rt, ctx, effect);
    case "cancel_pending_action": return cancelPendingAction(rt, ctx, effect);
    default:
      // §4.1 — an unimplemented effect throws instead of silently doing nothing.
      throw new Error(`unimplemented effect type: ${effect.type}`);
  }
}

// R6 §6.7 — block charge を与える。**次の damage instance を丸ごと止める。**
// barrier が「総量を受ける」のに対し、block は「回数を止める」ので、
// 単発大威力に強く、多段に弱い。同じ防御でも問われるものが違う。
function gainBlock(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.alive) continue;
    const proposed = evaluateValue(rt.state, ctx, effect.amount);
    if (proposed <= 0) continue;
    const event = rt.emit({
      type: "block_proposed",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: effect.tags ?? [],
      values: { amount: proposed },
    });
    const before = target.block ?? 0;
    target.block = before + proposed;
    rt.emit({
      type: "block_gained",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [target.instanceId],
      tags: effect.tags ?? [],
      values: { amount: proposed, before, after: target.block },
    });
  }
}

// §12.1 / R6 §6.7 — damage.
//
// **一 damage instance の順は block → guard → barrier → HP。**
// R6 §6.7 が固定した順で、途中で変えると同じ構成が別の結果になる。
//
//   1. 対象列は action 開始時に一度だけ確定し、position 順に並べる
//   2. hitIndex を外側、対象順を内側にする
//   3. 一 instance ごとに damage_proposed → block → guard → barrier →
//      damage_taken / damage_blocked を完了する
//   4. その instance の after reaction を処理してから次の対象へ進む
//   5. 途中で倒れた対象への残り hit は**失われる。別対象へ自動 retarget しない**
function dealDamage(rt, ctx, effect) {
  const hitCount = effect.hitCount ?? 1;
  // 1. 一度だけ確定する。hit の途中で対象が変わらないのが multi-hit の前提。
  const targetIds = expandPattern(rt, ctx, effect).map((actor) => actor.instanceId);
  for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
    for (const instanceId of targetIds) {
      const target = getActor(rt.state, instanceId);
      // 5. 倒れていたらこの hit は失われる。別の相手へ回さない。
      if (!target || !target.alive) continue;
      dealOneInstance(rt, ctx, effect, target, hitIndex, hitCount);
    }
  }
}

// R6 §5.4 — targetPattern は「最初に選ばれた相手」から広げる。
// row は同じ行、column は同じ列の前後。空き枠は actor ではないので数に入らない。
function expandPattern(rt, ctx, effect) {
  const primary = selectTargets(rt, ctx, effect.target, { reach: effect.reach });
  const pattern = effect.targetPattern ?? "single";
  if (pattern === "single" || primary.length === 0) return primary;
  const anchor = primary[0];
  const pool = actorsOnSide(rt.state, anchor.side).filter((actor) => actor.alive);
  const spread = pattern === "row"
    ? pool.filter((actor) => POSITION_ROW[actor.position] === POSITION_ROW[anchor.position])
    : pool.filter((actor) => POSITION_COLUMN[actor.position] === POSITION_COLUMN[anchor.position]);
  const chosen = spread.length > 0 ? spread : primary;
  const ordered = [...chosen].sort(compareActorsDefault);
  rt.state.chain.lastResolvedTargets = ordered.map((actor) => actor.instanceId);
  return ordered;
}

// R6 §4.4 — direct damage の軽減。**最低10%は通す。**
// guard は hit ごとに引くので、同じ総係数なら多段は guard に弱く、単発大威力は強い。
function afterGuard(rawAmount, target, guardPierceBps) {
  const effectiveGuard = roundHalfUpDiv(
    (target.guard ?? 0) * (BPS - (guardPierceBps ?? 0)),
    BPS,
  );
  const floor = roundHalfUpDiv(rawAmount * 1_000, BPS);
  return Math.max(floor, rawAmount - effectiveGuard);
}

// R11 §5 — **武器は後列から届かない。技は届く。**
//
// might で伸びる攻撃を後列から出すと、この係数まで落ちる。focus で伸びる攻撃は
// 落ちない。これが might と focus の違いを、説明文ではなく**隊列の話**にする。
//
//   前列に置く … 武器攻撃が全力で出る。代わりに殴られる
//   後列に置く … 殴られにくい。代わりに武器攻撃が 40% になる
//
// **どちらの側にも同じように掛かる。**味方だけ得をする規則にはしない。
// 後列から撃つ敵（灰殻の後撃ち）は rear_strike が technique なので落ちない。
//
// 対象の届き方（reach: melee が前列しか狙えないこと）とは別の軸である。
// あちらは「誰を狙えるか」、こちらは「どこから出したか」。
export const REAR_WEAPON_BPS = 4_000;

// R19（issue #137）— 技能レベル。**同じ効果の上位互換を別技能で増やさず、
// 一つの技能を段階的に強くする。**
//
// 掛かるのは連続量（damage / heal / barrier とその増減）だけで、AP・RP・段数・
// 回数・耐久といった離散量には掛からない（schema.mjs の SKILL_LEVEL_STEP_BPS を見よ）。
// **engine は技能 ID で分岐しない。**掛かるかどうかは「その actor がその技能に
// レベルを持っているか」だけで決まり、持っていなければ掛け算そのものが起きない。
//
// 装備の rule は対象外である。装備は持ち主の技能レベルで強くならない
// （R6 §4.4「装備の flat roll は parameter 非依存」と同じ理由）。
function afterSkillLevel(rawAmount, ctx) {
  const owner = ctx.owner;
  if (!owner || !owner.skillLevels) return rawAmount;
  if (ctx.equipmentInstanceId) return rawAmount;
  const skillId = ctx.skillId ?? ctx.sourceDefinitionId;
  const level = owner.skillLevels[skillId];
  if (!Number.isInteger(level) || level <= 1) return rawAmount;
  return roundHalfUpDiv(rawAmount * (BPS + (level - 1) * SKILL_LEVEL_STEP_BPS), BPS);
}

function afterRearFalloff(rawAmount, ctx, effect) {
  if (effect.amount?.scalingStat !== "might") return rawAmount;
  const owner = ctx.owner;
  if (!owner || POSITION_ROW[owner.position] !== "rear") return rawAmount;
  return roundHalfUpDiv(rawAmount * REAR_WEAPON_BPS, BPS);
}

function dealOneInstance(rt, ctx, effect, target, hitIndex, hitCount) {
  const proposed = afterRearFalloff(
    afterSkillLevel(evaluateValue(rt.state, ctx, effect.amount), ctx), ctx, effect,
  );
  const tags = effect.tags ?? [];
  const frame = { kind: "amount", amount: proposed, targetActorIds: [target.instanceId] };
  const event = rt.emit(
    {
      type: "damage_proposed",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags,
      values: { amount: proposed, hitIndex, hitCount },
    },
    frame,
  );
  const finalTarget = getActor(rt.state, frame.targetActorIds[0]);
  if (!finalTarget || !finalTarget.alive) return;
  const amount = frame.amount;

  // block — 一 charge で instance を丸ごと止める。
  // **多段は charge を1つずつ剥がすので、単発より通しやすい。**
  if ((finalTarget.block ?? 0) > 0) {
    const before = finalTarget.block;
    finalTarget.block = before - 1;
    rt.emit({
      type: "damage_blocked",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags,
      values: { proposed: amount, blockBefore: before, blockAfter: finalTarget.block, hitIndex },
    });
    rt.emit({
      type: "block_spent",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags: [],
      values: { amount: 1, before, after: finalTarget.block },
    });
    return;
  }

  // guard — hit ごとの固定軽減。heal と barrier には掛からない。
  const guarded = afterGuard(amount, finalTarget, effect.guardPierceBps);

  // barrier — 位置は v1 から動かしていないので、barrier だけを使う定義は挙動不変。
  const absorbed = absorbBarrier(rt, ctx, finalTarget, guarded, []);
  const remaining = guarded - absorbed;
  const hpBefore = finalTarget.hp;
  const hpDamage = Math.min(hpBefore, remaining);
  if (hpDamage === 0 && absorbed > 0) {
    // A fully absorbed hit is still a terminal damage outcome. Keep it separate
    // from damage_taken (HP reactions) and damage_blocked (block-charge reactions).
    rt.emit({
      type: "damage_absorbed",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags,
      values: {
        amount: 0,
        hpBefore,
        hpAfter: hpBefore,
        proposed: amount,
        afterGuard: guarded,
        guardApplied: amount - guarded,
        barrierAbsorbed: absorbed,
        hitIndex,
        hitCount,
      },
    });
  }
  if (hpDamage > 0) {
    finalTarget.hp = hpBefore - hpDamage;
    bumpHistory(finalTarget, "damage_taken", hpDamage);
    if (ctx.owner) bumpHistory(ctx.owner, "damage_dealt", hpDamage);
    rt.emit({
      type: "damage_taken",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags,
      values: {
        amount: hpDamage,
        hpBefore,
        hpAfter: finalTarget.hp,
        proposed: amount,
        // 因果ログに「適用前・軽減後・吸収」を残す（R6 §4.4）。
        afterGuard: guarded,
        guardApplied: amount - guarded,
        barrierAbsorbed: absorbed,
        hitIndex,
        hitCount,
      },
    });
  }
  if (finalTarget.hp === 0 && finalTarget.alive) {
    defeatActor(rt, ctx, finalTarget, event.id);
  }
  // §12.1 — max(0, guarded - barrierAbsorbed - hpBefore)
  const excess = Math.max(0, guarded - absorbed - hpBefore);
  if (excess > 0) {
    if (ctx.owner) bumpHistory(ctx.owner, "excess_damage", excess);
    rt.emit({
      type: "excess_damage",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags,
      values: { amount: excess, proposed: amount, afterGuard: guarded, barrierAbsorbed: absorbed, hpBefore },
    });
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
    const proposed = afterSkillLevel(evaluateValue(rt.state, ctx, effect.amount), ctx);
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
//
// The proposal step mirrors damage and healing so that an interrupt rule can
// change the amount before the packet exists (PREFLIGHT §14).
function gainBarrier(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.alive) continue;
    const proposed = afterSkillLevel(evaluateValue(rt.state, ctx, effect.amount), ctx);
    const frame = { kind: "amount", amount: proposed, targetActorIds: [target.instanceId] };
    const event = rt.emit(
      {
        type: "barrier_proposed",
        ...sourceFields(ctx),
        targetActorIds: [target.instanceId],
        tags: [effect.duration],
        values: { amount: proposed, duration: effect.duration },
      },
      frame,
    );
    const finalTarget = getActor(rt.state, frame.targetActorIds[0]);
    if (!finalTarget || !finalTarget.alive) continue;
    const amount = frame.amount;
    if (amount <= 0) continue;
    finalTarget.barriers.push({
      amount,
      duration: effect.duration,
      createdSequence: rt.state.sequence,
      sourceActorId: ctx.owner ? ctx.owner.instanceId : undefined,
      sourceDefinitionId: ctx.sourceDefinitionId,
    });
    rt.emit({
      type: "barrier_gained",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags: [effect.duration],
      values: {
        amount,
        proposed,
        duration: effect.duration,
        barrierTotal: totalBarrier(finalTarget),
      },
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
    // §11.3 — engine.mjs makes a gained action point available on the next
    // eligible side phase; effects only report the gain.
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
  if (!item || item.broken || item.durability <= 0) return;
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
  if (item.durability === 0 && rt.state.options.equipmentBreaks !== false) {
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

// §12.6 partner. A repair raises durability up to maxDurability and never
// revives an item that already broke: §5.6 says a broken item supplies no rules
// for the rest of the battle, and a repair must not quietly undo that. In the
// playable no-break mode, a depleted item cannot fire its own repair rule
// because ruleSourceIntact excludes it at zero.
export function repairEquipmentInstance(rt, ctx, item, amount, tags) {
  if (!item || item.broken) return;
  const before = item.durability;
  const repaired = Math.min(amount, item.maxDurability - before);
  if (repaired <= 0) return;
  item.durability = before + repaired;
  rt.emit({
    type: "equipment_repaired",
    ...sourceFields(ctx),
    targetActorIds: [ctx.owner ? ctx.owner.instanceId : item.instanceId],
    equipmentInstanceId: item.instanceId,
    tags,
    values: { equipmentId: item.equipmentId, before, amount: repaired, after: item.durability },
  });
}

function repairEquipmentEffect(rt, ctx, effect) {
  const amount = effect.amount ? evaluateValue(rt.state, ctx, effect.amount) : 1;
  repairEquipmentInstance(rt, ctx, equipmentInstance(rt, ctx), amount, []);
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
  const amount = afterSkillLevel(evaluateValue(rt.state, ctx, effect.amount), ctx);
  const before = frame.amount;
  if (effect.operation === "set") frame.amount = amount;
  else if (effect.operation === "decrease") frame.amount = Math.max(0, before - amount);
  else frame.amount = before + amount;
  if (frame.amount === before) return;
  // §1.2 — every state change is traceable from the event列. Without this the
  // number changes and nothing says whose rule changed it.
  rt.emit({
    type: "pending_amount_modified",
    ...sourceFields(ctx),
    targetActorIds: [...frame.targetActorIds],
    tags: [effect.operation],
    values: {
      operation: effect.operation,
      before,
      after: frame.amount,
      delta: frame.amount - before,
      proposalEventId: ctx.event ? ctx.event.id : null,
    },
  });
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

