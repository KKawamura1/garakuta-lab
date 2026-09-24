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
  COLUMNS,
  POSITIONS,
  POSITION_COLUMN,
  POSITION_ROW,
} from "./schema.mjs";
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
    case "mark_attack_flag": return markAttackFlag(rt, ctx, effect);
    case "gain_resource": return gainResource(rt, ctx, effect);
    case "reduce_resource": return reduceResource(rt, ctx, effect);
    case "add_status": return addStatus(rt, ctx, effect);
    case "copy_status_from_event": return copyStatusFromEvent(rt, ctx, effect);
    case "remove_status": return removeStatus(rt, ctx, effect);
    case "remove_statuses": return removeStatuses(rt, ctx, effect);
    case "remove_barrier": return removeBarrier(rt, ctx, effect);
    case "remove_block": return removeBlock(rt, ctx, effect);
    case "swap_positions": return swapPositions(rt, ctx, effect);
    case "move_to_open_row": return moveToOpenRow(rt, ctx, effect);
    case "start_preparation": return startPreparation(rt, ctx, effect);
    case "advance_preparation": return advancePreparation(rt, ctx, effect);
    case "interrupt_preparation": return interruptPreparation(rt, ctx, effect);
    case "revive": return revive(rt, ctx, effect);
    case "wear_equipment": return wearEquipmentEffect(rt, ctx, effect);
    case "repair_equipment": return repairEquipmentEffect(rt, ctx, effect);
    case "modify_pending_amount": return modifyPendingAmount(rt, ctx, effect);
    case "modify_pending_guard": return modifyPendingGuard(rt, ctx, effect);
    case "split_pending_damage": return splitPendingDamage(rt, ctx, effect);
    case "redirect_pending_target": return redirectPendingTarget(rt, ctx, effect);
    case "cancel_pending_action": return cancelPendingAction(rt, ctx, effect);
    case "modify_attack_plan": return modifyAttackPlan(rt, ctx, effect);
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
      tags: ["positive", ...(effect.tags ?? [])],
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
function hitCountOfEffect(rt, ctx, effect) {
  if (!effect.hitCountFromStatus) return effect.hitCount ?? 1;
  const { statusId, max, fallback = 1, base, memoryKey } = effect.hitCountFromStatus;
  const snapshot = memoryKey ? ctx.pendingAction?.memory?.[memoryKey] : undefined;
  const stacks = Number.isSafeInteger(snapshot)
    ? snapshot
    : (ctx.owner ? statusStacks(ctx.owner, statusId) : 0);
  if (base !== undefined) return base + Math.min(max, stacks);
  return Math.min(max, Math.max(fallback, stacks));
}

function dealDamage(rt, ctx, effect) {
  if (effect.independentAttack && ctx.pendingAction?.kind === "action") {
    // Follow-up packets keep the owner's loadout and attack-start memory but
    // begin a clean plan, so the parent's sweep / bonus hits cannot leak in.
    ctx = {
      ...ctx,
      pendingAction: {
        ...ctx.pendingAction,
        attackId: ctx.event?.id ?? ctx.pendingAction.attackId,
        attackPlan: {},
        previousAttackTargetActorId: null,
        rootActionFrame: ctx.pendingAction.rootActionFrame ?? ctx.pendingAction,
      },
    };
  }
  const equippedHitBonus = (effect.hitCountBonusBySkill ?? []).reduce((sum, entry) => (
    ctx.owner?.passiveSkillIds?.includes(entry.skillId) ? sum + entry.bonus : sum
  ), 0);
  const baseHitCount = hitCountOfEffect(rt, ctx, effect) + equippedHitBonus;
  const attackPlan = effect.independentAttack ? undefined : ctx.pendingAction?.attackPlan;
  const isAttack = (effect.tags ?? []).includes("attack");
  const extraHitCount = isAttack ? (attackPlan?.hitCountBonus ?? 0) : 0;
  const requestedHitCount = baseHitCount + extraHitCount;
  const hitCount = Math.min(attackPlan?.maxHitCount ?? Number.MAX_SAFE_INTEGER, requestedHitCount);
  // 1. 一度だけ確定する。hit の途中で対象が変わらないのが multi-hit の前提。
  const targetIds = (attackPlan?.targetActorIds
    ? attackPlan.targetActorIds.map((instanceId) => getActor(rt.state, instanceId)).filter(Boolean)
    : expandPattern(rt, ctx, effect)).map((actor) => actor.instanceId);
  const extraTargetIds = isAttack ? (attackPlan?.extraTargetActorIds ?? []) : [];
  const plannedTargetCount = new Set([...targetIds, ...extraTargetIds]).size;
  for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
    const distribution = attackPlan?.hitDistribution ?? effect.hitDistribution;
    const instances = distribution === "round_robin" && targetIds.length > 0
      ? [targetIds[hitIndex % targetIds.length]]
      : targetIds;
    for (const instanceId of instances) {
      const target = getActor(rt.state, instanceId);
      const previousTargetActorId = ctx.pendingAction?.previousAttackTargetActorId ?? null;
      if (ctx.pendingAction) ctx.pendingAction.previousAttackTargetActorId = instanceId;
      // 5. 倒れていたらこの hit は失われる。別の相手へ回さない。
      if (!target || !target.alive) {
        // Keep the packet amount on the observable skip event so content can
        // opt into an explicit overflow rule (dual-blades AB2). The default
        // engine path still loses the hit; no automatic retargeting is added.
        const skippedAmount = target
          ? afterPositionModifier(
            evaluateValue(rt.state, ctx, effect.amount), rt, ctx, effect, target,
          )
          : undefined;
        rt.emit({
          type: "damage_skipped",
          ...sourceFields(ctx),
          targetActorIds: [instanceId],
          tags: effect.tags ?? [],
          values: {
            amount: skippedAmount,
            hitIndex,
            hitCount,
            reason: target ? "target_defeated" : "target_unavailable",
          },
        });
        continue;
      }
      const extraHit = hitIndex >= baseHitCount && attackPlan?.extraHitBps;
      const rawAmount = extraHit
        ? roundHalfUpDiv(evaluateValue(rt.state, ctx, effect.amount) * attackPlan.extraHitBps, BPS)
        : undefined;
      const hitEvent = dealOneInstance(
        rt, ctx, effect, target, hitIndex, hitCount, rawAmount, previousTargetActorId,
        false, Boolean(extraHit), plannedTargetCount,
      );
      resolveDamageHit(rt, ctx, effect, hitEvent);
    }
  }
  if (extraTargetIds.length > 0 && attackPlan?.extraTargetDamageBps > 0) {
    let extraTargetBaseAmount = evaluateValue(rt.state, ctx, effect.amount);
    if (attackPlan.extraTargetDamageFromAttackStat) {
      if (!attackPlan.extraTargetDamageStat) {
        throw new Error("attack-stat extra target damage is missing the attack scaling stat");
      }
      extraTargetBaseAmount = evaluateValue(rt.state, ctx, {
        type: "actor_stat_scaled",
        subject: attackPlan.extraTargetDamageSubject,
        stat: attackPlan.extraTargetDamageStat,
      });
    }
    const amount = roundHalfUpDiv(
      extraTargetBaseAmount * attackPlan.extraTargetDamageBps,
      BPS,
    );
    const derivedEffect = { ...effect, onHitEffects: undefined };
    for (const instanceId of extraTargetIds) {
      const target = getActor(rt.state, instanceId);
      if (!target || !target.alive) {
        rt.emit({
          type: "damage_skipped",
          ...sourceFields(ctx),
          targetActorIds: [instanceId],
          tags: [...(effect.tags ?? []), "plan_extra_damage"],
          values: {
            amount,
            hitIndex: null,
            hitCount,
            plannedTargetCount,
            attackId: ctx.pendingAction?.attackId ?? ctx.event?.values?.attackId,
            reason: target ? "target_defeated" : "target_unavailable",
          },
        });
        continue;
      }
      const hitEvent = dealOneInstance(
        rt, ctx, derivedEffect, target, null, hitCount, amount, null,
        false, false, plannedTargetCount, true,
      );
      resolveDamageHit(rt, ctx, effect, hitEvent);
    }
  }
}

function resolveDamageHit(rt, ctx, effect, hitEvent) {
  if (!hitEvent) return;
  const actionFrame = ctx.pendingAction?.rootActionFrame ?? ctx.pendingAction;
  if (hitEvent.type === "damage_resolved" && actionFrame?.kind === "action") {
    actionFrame.resolvedDamageTargetActorIds ??= [];
    for (const actorId of hitEvent.targetActorIds) {
      if (!actionFrame.resolvedDamageTargetActorIds.includes(actorId)) {
        actionFrame.resolvedDamageTargetActorIds.push(actorId);
      }
    }
    actionFrame.resolvedAttackIds ??= [];
    const attackId = hitEvent.values?.attackId;
    if (typeof attackId === "string" && !actionFrame.resolvedAttackIds.includes(attackId)) {
      actionFrame.resolvedAttackIds.push(attackId);
    }
  }
  if (effect.onHitEffects?.length) {
    applyEffects(rt, { ...ctx, event: hitEvent }, effect.onHitEffects);
  }
  // Hit-result reactions resolve before the next hit in a multi-hit action.
  // Their non-recursive after hooks still use the engine's normal rule ordering.
  if (hitEvent.type === "damage_resolved") rt.dispatchAfter(hitEvent);
}

// R6 §5.4 — targetPattern は「最初に選ばれた相手」から広げる。
// row は同じ行、column は同じ列の前後。空き枠は actor ではないので数に入らない。
function expandPattern(rt, ctx, effect) {
  const primary = selectTargets(rt, ctx, effect.target, { reach: reachOfEffect(effect) });
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
function effectiveGuardOf(content, target) {
  return Math.max(0, (target.guard ?? 0) + target.statuses.reduce((sum, status) => (
    sum + (content.statuses[status.statusId]?.guardBonusPerStack ?? 0) * status.stacks
  ), 0));
}

function afterGuard(rawAmount, target, guardPierceBps, flatGuardIgnore, content) {
  const guardAfterFlatIgnore = Math.max(0, effectiveGuardOf(content, target) - (flatGuardIgnore ?? 0));
  const effectiveGuard = roundHalfUpDiv(
    guardAfterFlatIgnore * (BPS - (guardPierceBps ?? 0)),
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
export const FRONT_MELEE_BPS = 12_500;
export const RANGED_COVER_BPS = 7_500;

// `rangeClass` is the R25 contract. Legacy content continues to use `reach`
// and the might/focus falloff until each weapon is migrated, so the staged
// rollout cannot silently retune every published encounter at once.
export function reachOfEffect(effect) {
  switch (effect.rangeClass) {
    case "melee": return "melee";
    case "long":
    case "ranged": return "ranged";
    case "support": return "unrestricted";
    default: return effect.reach;
  }
}

function afterRearFalloff(rawAmount, ctx, effect) {
  if (effect.amount?.scalingStat !== "might") return rawAmount;
  const owner = ctx.owner;
  if (!owner || POSITION_ROW[owner.position] !== "rear") return rawAmount;
  return roundHalfUpDiv(rawAmount * REAR_WEAPON_BPS, BPS);
}

function afterPositionModifier(rawAmount, rt, ctx, effect, target) {
  if (effect.rangeClass === undefined) return afterRearFalloff(rawAmount, ctx, effect);
  const owner = ctx.owner;
  if (!owner) return rawAmount;
  if (effect.rangeClass === "melee") {
    const bps = POSITION_ROW[owner.position] === "front" ? FRONT_MELEE_BPS : REAR_WEAPON_BPS;
    return roundHalfUpDiv(rawAmount * bps, BPS);
  }
  if ((effect.rangeClass === "long" || effect.rangeClass === "ranged")
      && POSITION_ROW[target.position] === "rear") {
    const covered = actorsOnSide(rt.state, target.side).some(
      (actor) => actor.alive && POSITION_ROW[actor.position] === "front",
    );
    if (covered) return roundHalfUpDiv(rawAmount * RANGED_COVER_BPS, BPS);
  }
  return rawAmount;
}

function dealOneInstance(
  rt, ctx, effect, target, hitIndex, hitCount, rawAmountOverride, previousTargetActorId = null,
  amountIsFinal = false, isExtraHit = false, plannedTargetCount = null, planExtraDamage = false,
) {
  const rawAmount = rawAmountOverride === undefined
    ? evaluateValue(rt.state, ctx, effect.amount)
    : rawAmountOverride;
  const proposed = amountIsFinal ? Math.max(0, rawAmount)
    : afterPositionModifier(rawAmount, rt, ctx, effect, target);
  const primaryTargetActorId = ctx.pendingAction?.attackPlan?.targetActorIds?.[0]
    ?? ctx.pendingAction?.targetActorIds?.[0]
    ?? null;
  const tags = [
    ...(effect.tags ?? []),
    ...(effect.rangeClass ? [effect.rangeClass] : []),
    ...(isExtraHit ? ["extra_hit"] : []),
    ...(planExtraDamage ? ["plan_extra_damage"] : []),
    ...(ctx.pendingAction?.redirected ? ["redirect"] : []),
  ];
  const frame = { kind: "amount", amount: proposed, guardIgnore: 0, targetActorIds: [target.instanceId] };
  const event = rt.emit(
    {
      type: "damage_proposed",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags,
      values: {
        amount: proposed,
        hitIndex,
        hitCount,
        previousTargetActorId,
        primaryTargetActorId,
        attackId: ctx.pendingAction?.attackId ?? ctx.event?.values?.attackId,
        plannedTargetCount,
      },
    },
    frame,
  );
  const finalTarget = getActor(rt.state, frame.targetActorIds[0]);
  if (!finalTarget || !finalTarget.alive) {
    rt.emit({
      type: "damage_skipped",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: frame.targetActorIds,
      tags,
      values: { amount: frame.amount, hitIndex, hitCount, reason: finalTarget ? "target_defeated" : "target_unavailable" },
    });
    return null;
  }
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
      tags: [...tags, "positive"],
      values: {
        amount: 1, before, after: finalTarget.block,
        attackId: ctx.pendingAction?.attackId ?? ctx.event?.values?.attackId,
      },
    });
    emitDefenseBreak(rt, ctx, finalTarget, "block", before, finalTarget.block,
      "hit", hitIndex, event.id);
    return rt.emit({
      type: "damage_resolved",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags,
      values: {
        result: "blocked",
        amount: 0,
        hpDamage: 0,
        proposed: amount,
        afterGuard: 0,
        guardApplied: 0,
        barrierAbsorbed: 0,
        hitIndex,
        hitCount,
        previousTargetActorId,
        primaryTargetActorId,
        attackId: ctx.pendingAction?.attackId ?? ctx.event?.values?.attackId,
        plannedTargetCount,
        blockBefore: before,
        blockAfter: finalTarget.block,
      },
    }, null, { enqueueAfter: false });
  }

  // guard — hit ごとの固定軽減。heal と barrier には掛からない。
  const guarded = afterGuard(amount, finalTarget, effect.guardPierceBps, frame.guardIgnore, rt.state.content);

  // barrier — 位置は v1 から動かしていないので、barrier だけを使う定義は挙動不変。
  const barrierBefore = totalBarrier(finalTarget);
  const absorbed = absorbBarrier(rt, ctx, finalTarget, guarded, tags);
  const remaining = guarded - absorbed;
  const hpBefore = finalTarget.hp;
  const hpDamage = Math.min(hpBefore, remaining);
  if (absorbed > 0) {
    rt.emit({
      type: "damage_absorbed",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags,
      values: {
        amount: absorbed,
        proposed: amount,
        afterGuard: guarded,
        finalDamage: hpDamage,
        fullyAbsorbed: hpDamage === 0 && remaining === 0,
        barrierRemaining: totalBarrier(finalTarget),
        hitIndex,
        hitCount,
        previousTargetActorId,
        primaryTargetActorId,
      },
    });
  }
  if (hpDamage > 0) {
    const recoveredBefore = Math.min(hpBefore, Math.max(0, finalTarget.recoveredDamage ?? 0));
    const greenBefore = Math.max(0, hpBefore - recoveredBefore);
    const recoveredLost = Math.max(0, hpDamage - greenBefore);
    finalTarget.recoveredDamage = Math.max(0, recoveredBefore - recoveredLost);
    finalTarget.hp = hpBefore - hpDamage;
    // Only actual HP damage from this path seeds the recovery budget. A
    // lose_hp cost emits a cost-tagged damage_taken event, but it is not an
    // attack wound and must not create healing capacity.
    const side = finalTarget.side;
    if (rt.state.chain?.damageTakenBySide?.[side] !== undefined) {
      rt.state.chain.damageTakenBySide[side] += hpDamage;
      rt.state.chain.recoveryBudgetBySide[side] += hpDamage;
    }
    const existing = rt.state.recoveryWindows.get(finalTarget.instanceId);
    const window = existing && existing.chainId === rt.state.chain.id
      ? existing
      : { chainId: rt.state.chain.id, attackEventId: event.id, remaining: 0 };
    window.remaining += hpDamage;
    rt.state.recoveryWindows.set(finalTarget.instanceId, window);
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
        previousTargetActorId,
        primaryTargetActorId,
        attackId: ctx.pendingAction?.attackId ?? ctx.event?.values?.attackId,
        plannedTargetCount,
        recoveredDamage: finalTarget.recoveredDamage,
        unrecoverableDamage: Math.max(0, finalTarget.maxHp - finalTarget.hp - window.remaining),
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
  if (barrierBefore > 0 && totalBarrier(finalTarget) === 0) {
    emitDefenseBreak(rt, ctx, finalTarget, "barrier", barrierBefore, 0,
      "hit", hitIndex, event.id);
  }
  return rt.emit({
    type: "damage_resolved",
    ...sourceFields(ctx),
    parentEventId: event.id,
    targetActorIds: [finalTarget.instanceId],
    tags,
    values: {
      result: hpDamage > 0 ? "hp_damage" : absorbed > 0 ? "barrier_absorbed" : "reduced",
      amount: hpDamage,
      hpDamage,
      proposed: amount,
      afterGuard: guarded,
      guardApplied: amount - guarded,
      barrierAbsorbed: absorbed,
      hitIndex,
      hitCount,
      previousTargetActorId,
      primaryTargetActorId,
      attackId: ctx.pendingAction?.attackId ?? ctx.event?.values?.attackId,
      plannedTargetCount,
      hpBefore,
      hpAfter: finalTarget.hp,
    },
  }, null, { enqueueAfter: false });
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
        values: {
          duration: packet.duration,
          barrierTotal: totalBarrier(target),
          attackId: ctx.pendingAction?.attackId ?? ctx.event?.values?.attackId,
        },
      });
    }
  }
  return absorbed;
}

function defeatActor(rt, ctx, target, parentEventId) {
  target.alive = false;
  target.inQueue = false;
  // 倒れた表示拍では、回復済み区分も通常の緑／黒へ確定する。
  target.recoveredDamage = 0;
  const window = rt.state.recoveryWindows.get(target.instanceId);
  if (window && window.remaining > 0) {
    rt.state.recoveryWindows.delete(target.instanceId);
    rt.emit({
      type: "recovery_window_closed",
      targetActorIds: [target.instanceId],
      tags: ["recovery_window", "actor_defeated"],
      values: {
        remaining: window.remaining,
        cause: "actor_defeated",
        attackChainId: window.chainId,
        recoveredDamage: target.recoveredDamage ?? 0,
        // 窓を閉じた残量も、倒れた時点では回復不能分に含める。
        unrecoverableDamage: Math.max(0, target.maxHp - target.hp),
      },
    });
  }
  const defeated = rt.emit({
    type: "actor_defeated",
    ...sourceFields(ctx),
    parentEventId,
    targetActorIds: [target.instanceId],
    tags: [target.side],
    values: { definitionId: target.definitionId, side: target.side },
  });
  for (const holder of rt.state.actors.values()) {
    for (const status of [...holder.statuses]) {
      const definition = rt.state.content.statuses[status.statusId];
      if (!definition?.clearWhenLinkedTargetDefeated
          || status.linkedTargetActorId !== target.instanceId) continue;
      holder.statuses = holder.statuses.filter((entry) => entry !== status);
      rt.emit({
        type: "status_removed",
        ...sourceFields(ctx),
        parentEventId: defeated.id,
        targetActorIds: [holder.instanceId],
        tags: ["actor_defeated", definition.polarity],
        values: {
          statusId: status.statusId,
          removed: status.stacks,
          remaining: 0,
          cause: "linked_target_defeated",
        },
      });
    }
  }
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

// A finite rescue effect is intentionally generic: content chooses when it is
// paid for and how much HP returns. A defeated actor remains in the actor
// registry, so the effect can target it through event_targets or an
// `alive: false` query without introducing a weapon-specific branch here.
function revive(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (target.alive) continue;
    const requested = evaluateValue(rt.state, ctx, effect.amount);
    const amount = Math.min(target.maxHp, Math.max(1, requested));
    const hpBefore = target.hp;
    target.hp = amount;
    target.alive = true;
    target.inQueue = false;
    target.recoveredDamage = 0;
    target.preparation = null;
    target.actionPoints = target.baseActionPoints;
    target.reactionPoints = target.baseReactionPoints;
    rt.emit({
      type: "actor_revived",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: effect.tags ?? ["revive"],
      values: { requested, amount, hpBefore, hpAfter: target.hp },
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
    const window = rt.state.recoveryWindows.get(finalTarget.instanceId);
    const inCurrentRecoveryWindow = window?.chainId === rt.state.chain.id;
    // Reactive healing is attack-bound. Active/utility healing may still treat
    // older HP loss, but that amount is not shown as recovery of this attack.
    const recoverable = inCurrentRecoveryWindow
      ? window.remaining
      : (ctx.ruleId && ctx.event?.type !== "excess_healing"
        ? 0
        : finalTarget.maxHp - finalTarget.hp);
    // A chain may contain several damage packets and several heal sources.
    // The per-actor window remains the UI-facing attribution, while this
    // aggregate budget makes the party-wide ceiling explicit. A chain with no
    // HP damage keeps the fixture/utility behavior for non-attack healing.
    const side = finalTarget.side;
    const chain = rt.state.chain;
    const hasDamageForSide = (chain?.damageTakenBySide?.[side] ?? 0) > 0;
    const partyRecoverable = hasDamageForSide
      ? Math.max(0, chain.recoveryBudgetBySide[side])
      : Number.POSITIVE_INFINITY;
    const actual = Math.min(
      requested,
      finalTarget.maxHp - finalTarget.hp,
      recoverable,
      partyRecoverable,
    );
    finalTarget.hp += actual;
    if (hasDamageForSide) {
      chain.recoveryBudgetBySide[side] = Math.max(0, chain.recoveryBudgetBySide[side] - actual);
    }
    if (inCurrentRecoveryWindow) {
      finalTarget.recoveredDamage = Math.min(
        finalTarget.hp,
        Math.max(0, finalTarget.recoveredDamage ?? 0) + actual,
      );
      window.remaining -= actual;
      if (window.remaining <= 0) rt.state.recoveryWindows.delete(finalTarget.instanceId);
    }
    const recoverableAfter = inCurrentRecoveryWindow ? (window?.remaining ?? 0) : 0;
    if (ctx.owner) bumpHistory(ctx.owner, "healing_done", actual);
    rt.emit({
      type: "healing_applied",
      ...sourceFields(ctx),
      parentEventId: event.id,
      targetActorIds: [finalTarget.instanceId],
      tags: effect.tags ?? [],
      values: {
        requested,
        actual,
        hpAfter: finalTarget.hp,
        recoverableBefore: recoverable,
        recoverableAfter,
        recoveredDamage: finalTarget.recoveredDamage,
        unrecoverableDamage: Math.max(
          0,
          finalTarget.maxHp - finalTarget.hp - recoverableAfter,
        ),
      },
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
    const proposed = evaluateValue(rt.state, ctx, effect.amount);
    const frame = { kind: "amount", amount: proposed, targetActorIds: [target.instanceId] };
    const event = rt.emit(
      {
        type: "barrier_proposed",
        ...sourceFields(ctx),
        targetActorIds: [target.instanceId],
        tags: [effect.duration, ...(effect.tags ?? [])],
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
      tags: [effect.duration, ...(effect.tags ?? [])],
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
      tags: [effect.resource, ...(effect.tags ?? [])],
      values: { resource: effect.resource, amount, before, after: target[key] },
    });
    // §11.3 — engine.mjs makes a gained action point available on the next
    // eligible side phase; effects only report the gain.
    if (effect.resource === "action_points") rt.onResourceGained(target);
  }
}

// R26 — a control effect may remove a finite amount of AP/RP from a target.
// This is deliberately an effect, not a cost: long-spear's foot-stop changes
// the next enemy activation and therefore cannot be paid by the spear holder.
// The result is still the ordinary resource_spent event so replay and audits
// do not need a second resource vocabulary.
function reduceResource(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.alive) continue;
    const requested = evaluateValue(rt.state, ctx, effect.amount);
    const key = effect.resource === "action_points" ? "actionPoints" : "reactionPoints";
    const before = target[key];
    const amount = Math.min(before, requested);
    if (amount <= 0) continue;
    target[key] = before - amount;
    rt.emit({
      type: "resource_spent",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: [effect.resource, "effect"],
      values: { resource: effect.resource, amount, before, after: target[key] },
    });
  }
}

function markAttackFlag(rt, ctx, effect) {
  const attackId = ctx.event?.values?.attackId;
  if (typeof attackId !== "string" || !rt.state.chain || !ctx.owner) return;
  const ownerKey = `${attackId}:${ctx.owner.instanceId}`;
  const flags = rt.state.chain.attackFlags.get(ownerKey) ?? new Set();
  flags.add(effect.key);
  rt.state.chain.attackFlags.set(ownerKey, flags);
}

function addStatus(rt, ctx, effect) {
  const definition = rt.state.content.statuses[effect.statusId];
  for (const target of selectTargets(rt, ctx, effect.target)) {
    if (!target.alive) continue;
    if (effect.onlyIfStatusLinkedToEventTarget) {
      const linked = target.statuses.find((entry) => (
        entry.statusId === effect.onlyIfStatusLinkedToEventTarget
      ));
      if (!linked || linked.linkedTargetActorId !== ctx.event?.targetActorIds?.[0]) continue;
    }
    const eventStackCount = effect.stacksFromEvent
      ? ctx.event?.values?.[effect.stacksFromEvent.key]
      : undefined;
    const stacks = effect.stacksFromEvent
      ? (Number.isSafeInteger(eventStackCount) ? eventStackCount * effect.stacksFromEvent.multiplier : 0)
      : (effect.stacks ?? 1);
    if (!Number.isSafeInteger(stacks) || stacks <= 0) continue;
    let existing = target.statuses.find((entry) => entry.statusId === effect.statusId);
    const linkedTargetActorId = effect.linkToEventTarget ? ctx.event?.targetActorIds?.[0] : undefined;
    if (existing && linkedTargetActorId && existing.linkedTargetActorId
        && existing.linkedTargetActorId !== linkedTargetActorId) {
      const removed = existing.stacks;
      target.statuses = target.statuses.filter((entry) => entry !== existing);
      rt.emit({
        type: "status_removed",
        ...sourceFields(ctx),
        targetActorIds: [target.instanceId],
        tags: ["effect", definition.polarity],
        values: { statusId: effect.statusId, removed, remaining: 0, cause: "target_changed" },
      });
      existing = undefined;
    }
    const before = existing ? existing.stacks : 0;
      const after = definition.maxStacks === "unbounded"
        ? before + stacks
        : Math.min(definition.maxStacks, before + stacks);
    if (after === before) continue;
    if (existing) {
      existing.stacks = after;
      if (linkedTargetActorId) existing.linkedTargetActorId = linkedTargetActorId;
      if (definition.durationRounds !== undefined) {
        existing.expiresAtRound = rt.state.round + definition.durationRounds;
      }
    } else {
      target.statuses.push({
        statusId: effect.statusId,
        stacks: after,
        duration: definition.duration,
        addedSequence: rt.state.sequence,
        ...(linkedTargetActorId ? { linkedTargetActorId } : {}),
        expiresAtRound: definition.durationRounds === undefined
          ? undefined
          : rt.state.round + definition.durationRounds,
      });
    }
    const currentStatus = target.statuses.find((entry) => entry.statusId === effect.statusId);
    rt.emit({
      type: "status_added",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: [definition.polarity, definition.duration, ...(effect.tags ?? [])],
      values: {
        statusId: effect.statusId,
        added: after - before,
        stacks: after,
        ...(currentStatus?.linkedTargetActorId
          ? { linkedTargetActorId: currentStatus.linkedTargetActorId }
          : {}),
        duration: definition.duration,
        durationRounds: definition.durationRounds,
      },
    });
  }
}

function copyStatusFromEvent(rt, ctx, effect) {
  if (ctx.event?.type !== "status_added" || !ctx.event.tags.includes("positive")) return;
  const statusId = ctx.event.values?.statusId;
  const definition = rt.state.content.statuses[statusId];
  if (!definition || definition.polarity !== "positive") return;
  const stacks = effect.stacksFromEvent ? ctx.event.values?.added : 1;
  if (!Number.isSafeInteger(stacks) || stacks <= 0) return;
  applyEffect(rt, ctx, {
    type: "add_status",
    target: effect.target,
    statusId,
    stacks,
    tags: ["copied", "copy_suppressed"],
  });
}

function removeStatus(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    const existing = target.statuses.find((entry) => entry.statusId === effect.statusId);
    const before = existing?.stacks ?? 0;
    const requested = effect.stacks === "all" ? before : Math.min(before, effect.stacks ?? 1);
    const removed = Math.min(requested, effect.maxStacks ?? Number.MAX_SAFE_INTEGER);
    if (effect.storeAs && ctx.pendingAction) {
      ctx.pendingAction.memory ??= {};
      ctx.pendingAction.memory[effect.storeAs] = removed;
    }
    if (!existing || removed === 0) continue;
    existing.stacks = before - removed;
    if (existing.stacks === 0) {
      target.statuses = target.statuses.filter((entry) => entry !== existing);
    }
    rt.emit({
      type: "status_removed",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: ["effect", rt.state.content.statuses[effect.statusId].polarity],
      values: { statusId: effect.statusId, removed, remaining: before - removed, cause: "effect" },
    });
  }
}

function removeStatuses(rt, ctx, effect) {
  ctx.memory ??= {};
  ctx.memory.removedStatusTypes ??= 0;
  for (const target of selectTargets(rt, ctx, effect.target)) {
    const removing = target.statuses.filter(
      (status) => rt.state.content.statuses[status.statusId]?.polarity === effect.polarity,
    );
    ctx.memory.removedStatusTypes += removing.length;
    for (const status of removing) {
      target.statuses = target.statuses.filter((entry) => entry !== status);
      rt.emit({
        type: "status_removed",
        ...sourceFields(ctx),
        targetActorIds: [target.instanceId],
        tags: ["effect", effect.polarity],
        values: { statusId: status.statusId, removed: status.stacks, remaining: 0, cause: "effect" },
      });
    }
  }
}

function removeBarrier(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    const before = totalBarrier(target);
    absorbBarrier(rt, ctx, target, before, ["effect"]);
    if (before > 0 && totalBarrier(target) === 0 && ctx.event?.type !== "defense_break") {
      emitDefenseBreak(rt, ctx, target, "barrier", before, 0, "pre_hit");
    }
  }
}

function removeBlock(rt, ctx, effect) {
  for (const target of selectTargets(rt, ctx, effect.target)) {
    const before = target.block ?? 0;
    if (before <= 0) continue;
    target.block = 0;
    rt.emit({
      type: "block_spent",
      ...sourceFields(ctx),
      targetActorIds: [target.instanceId],
      tags: ["effect", "positive"],
      values: {
        amount: before, before, after: 0,
        attackId: ctx.pendingAction?.attackId ?? ctx.event?.values?.attackId,
      },
    });
    if (ctx.event?.type !== "defense_break") {
      emitDefenseBreak(rt, ctx, target, "block", before, 0, "pre_hit");
    }
  }
}

function emitDefenseBreak(
  rt, ctx, target, defenseKind, before, remaining, phaseKey, hitIndex = null,
  parentEventId = ctx.event?.id,
) {
  const frame = ctx.pendingAction;
  if (frame?.kind !== "action" || !ctx.event?.tags?.includes("attack")) return;
  frame.attackPlan ??= {};
  frame.attackPlan.defenseBreakWindows ??= new Set();
  const key = `${phaseKey}:${target.instanceId}:${hitIndex ?? ""}`;
  if (frame.attackPlan.defenseBreakWindows.has(key)) return;
  frame.attackPlan.defenseBreakWindows.add(key);
  rt.emit({
    type: "defense_break",
    ...sourceFields(ctx),
    parentEventId,
    targetActorIds: [target.instanceId],
    tags: [...ctx.event.tags, "defense_break"],
    values: {
      defenseKind,
      before,
      remaining,
      hitIndex,
      attackId: frame.attackId ?? ctx.event.values?.attackId,
    },
  }, frame);
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

function emitActorMoved(rt, ctx, actor, from, to, tags) {
  bumpHistory(actor, "times_moved", 1);
  rt.emit({
    type: "actor_moved",
    ...sourceFields(ctx),
    targetActorIds: [actor.instanceId],
    tags,
    values: { from, to, rowChanged: POSITION_ROW[from] !== POSITION_ROW[to] },
  });
}

function nearestOpenPosition(rt, actor, row) {
  const occupied = new Set(
    actorsOnSide(rt.state, actor.side)
      .filter((candidate) => candidate.alive && candidate.instanceId !== actor.instanceId)
      .map((candidate) => candidate.position),
  );
  const fromColumn = COLUMNS.indexOf(POSITION_COLUMN[actor.position]);
  return POSITIONS
    .filter((position) => POSITION_ROW[position] === row && !occupied.has(position))
    .sort((left, right) => {
      const leftDistance = Math.abs(COLUMNS.indexOf(POSITION_COLUMN[left]) - fromColumn);
      const rightDistance = Math.abs(COLUMNS.indexOf(POSITION_COLUMN[right]) - fromColumn);
      return leftDistance - rightDistance || POSITIONS.indexOf(left) - POSITIONS.indexOf(right);
    })[0] ?? null;
}

// R25 — movement to an empty slot is different from swapping two occupants.
// A temporary advance remains in the destination for the whole action, then
// returns only if both the destination and origin still describe the same move.
// Both legs emit actor_moved; initial formation never comes through this path.
function moveToOpenRow(rt, ctx, effect) {
  const actor = selectTargets(rt, ctx, effect.target)[0];
  if (!actor || !actor.alive || POSITION_ROW[actor.position] === effect.row) return;
  const origin = actor.position;
  const destination = nearestOpenPosition(rt, actor, effect.row);
  if (!destination) return;
  actor.position = destination;
  emitActorMoved(rt, ctx, actor, origin, destination, ["move"]);
  if (effect.cancelIfOutOfReach && ctx.pendingAction?.skill) {
    const { skill, reach } = ctx.pendingAction;
    const legal = resolveTargets(rt.state, ctx, { ...skill.targetQuery, take: "all" }, { reach });
    if (!ctx.pendingAction.targetActorIds.some((instanceId) => (
      legal.some((target) => target.instanceId === instanceId)
    ))) {
      ctx.pendingAction.canceled = true;
      ctx.pendingAction.cancelReason = {
        ruleId: ctx.ruleId ?? null,
        ownerId: ctx.owner ? ctx.owner.instanceId : null,
      };
    }
  }
  const scheduled = {
    actorId: actor.instanceId,
    origin,
    destination,
    returnRow: effect.returnRow,
    sourceDefinitionId: ctx.sourceDefinitionId,
    ruleId: ctx.ruleId,
    skillId: ctx.skillId,
    equipmentInstanceId: ctx.equipmentInstanceId,
  };
  if (effect.returnAfterAction && ctx.pendingAction) {
    ctx.pendingAction.scheduledReturns ??= [];
    ctx.pendingAction.scheduledReturns.push(scheduled);
  }
  if (effect.returnAtRoundEnd) rt.state.scheduledRoundReturns.push(scheduled);
}

export function resolveScheduledReturns(rt, ctx, frame) {
  resolveReturnEntries(rt, ctx, [...(frame.scheduledReturns ?? [])].reverse());
  frame.scheduledReturns = [];
}

export function resolveRoundReturns(rt) {
  const scheduled = rt.state.scheduledRoundReturns.splice(0).reverse();
  resolveReturnEntries(rt, { event: null }, scheduled);
}

function resolveReturnEntries(rt, ctx, returns) {
  for (const scheduled of returns) {
    const actor = getActor(rt.state, scheduled.actorId);
    if (!actor || !actor.alive || actor.position !== scheduled.destination) continue;
    const originOccupied = actorsOnSide(rt.state, actor.side).some((candidate) => (
      candidate.alive && candidate.instanceId !== actor.instanceId && candidate.position === scheduled.origin
    ));
    const returnPosition = scheduled.returnRow
      ? (POSITION_ROW[scheduled.origin] === scheduled.returnRow && !originOccupied
        ? scheduled.origin
        : nearestOpenPosition(rt, actor, scheduled.returnRow))
      : (!originOccupied ? scheduled.origin : null);
    if (!returnPosition) continue;
    const from = actor.position;
    actor.position = returnPosition;
    emitActorMoved(rt, {
      ...ctx,
      sourceDefinitionId: scheduled.sourceDefinitionId,
      ruleId: scheduled.ruleId,
      skillId: scheduled.skillId,
      equipmentInstanceId: scheduled.equipmentInstanceId,
    }, actor, from, returnPosition, ["return"]);
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
function modifyAttackPlan(rt, ctx, effect) {
  const frame = ctx.pendingAction;
  const skill = frame?.skill;
  if (!frame || frame.kind !== "action" || !skill) return;
  const attack = (skill.effects ?? []).find((entry) => entry.type === "deal_damage"
    && (entry.tags ?? []).includes("attack"));
  if (!attack) return;
  const baseHitCount = hitCountOfEffect(rt, { ...ctx, owner: frame.owner ?? ctx.owner }, attack);
  if (effect.minHitCount !== undefined && baseHitCount < effect.minHitCount) return;

  const plan = frame.attackPlan ??= {};
  for (const statusId of effect.linkStatusIds ?? []) {
    linkStatusToTarget(rt, ctx, frame, statusId);
  }
  if (effect.snapshotStatusIds?.length) {
    frame.memory ??= {};
    for (const statusId of effect.snapshotStatusIds) {
      frame.memory[`status:${statusId}`] = statusStacks(frame.owner ?? ctx.owner, statusId);
    }
  }
  if (effect.snapshotPositiveStatusStacksKey) {
    frame.memory ??= {};
    const owner = frame.owner ?? ctx.owner;
    frame.memory[effect.snapshotPositiveStatusStacksKey] = owner.statuses.reduce(
      (sum, status) => sum + (rt.state.content.statuses[status.statusId]?.polarity === "positive"
        ? Math.min(6, status.stacks)
        : 0),
      Math.min(6, owner.block ?? 0),
    );
  }
  if (effect.hitCountBonus !== undefined) {
    plan.hitCountBonus = (plan.hitCountBonus ?? 0) + effect.hitCountBonus;
  }
  if (effect.extraHitBps !== undefined) plan.extraHitBps = effect.extraHitBps;
  if (effect.maxHitCount !== undefined) plan.maxHitCount = effect.maxHitCount;

  if (effect.addAdjacentDamageTargets) {
    if ((attack.targetPattern ?? "single") !== "single") return;
    const query = {
      scope: "enemies",
      filters: [{ type: "alive" }, { type: "horizontal_adjacent_to_event_primary_target" }],
      sort: ["position_asc"],
      take: "all",
    };
    const adjacent = resolveTargets(rt.state, ctx, query, { reach: frame.reach });
    const excluded = new Set(frame.targetActorIds);
    const recipients = adjacent.filter((actor) => !excluded.has(actor.instanceId));
    if (recipients.length > 0) {
      plan.extraTargetActorIds = recipients.map((actor) => actor.instanceId);
      plan.extraTargetDamageBps = effect.extraTargetDamageBps;
      if (effect.extraTargetDamageFromAttackStat) {
        if (attack.amount?.type !== "stat_scaled") {
          throw new Error("attack-stat extra target damage requires a stat-scaled attack amount");
        }
        plan.extraTargetDamageFromAttackStat = true;
        plan.extraTargetDamageSubject = attack.amount.subject;
        plan.extraTargetDamageStat = attack.amount.scalingStat;
      }
    }
  }

  if (effect.snapshotLegalTargets) {
    const query = { ...skill.targetQuery, take: "all" };
    const legal = resolveTargets(rt.state, ctx, query, { reach: frame.reach });
    const firstId = frame.targetActorIds[0];
    const legalIds = new Set(legal.map((actor) => actor.instanceId));
    if (!firstId || !legalIds.has(firstId)) return;
    const ids = [firstId, ...legal
      .map((actor) => actor.instanceId)
      .filter((id) => id !== firstId)];
    if (ids.length < (effect.minTargetCount ?? 2)) return;
    plan.targetActorIds = ids;
    plan.hitDistribution = effect.hitDistribution ?? "round_robin";
    frame.targetActorIds = ids;
  }
}

function linkStatusToTarget(rt, ctx, frame, statusId) {
  const actor = frame.owner ?? ctx.owner;
  const targetActorId = frame.targetActorIds?.[0];
  if (!actor || !targetActorId) return;
  const entry = actor.statuses.find((status) => status.statusId === statusId);
  if (!entry) return;
  const beforeTargetActorId = entry.linkedTargetActorId ?? null;
  if (beforeTargetActorId === targetActorId) return;
  if (beforeTargetActorId !== null) {
    const definition = rt.state.content.statuses[statusId];
    actor.statuses = actor.statuses.filter((status) => status !== entry);
    rt.emit({
      type: "status_removed",
      ...sourceFields(ctx),
      targetActorIds: [actor.instanceId],
      tags: ["effect", definition.polarity],
      values: { statusId, removed: entry.stacks, remaining: 0, cause: "target_changed" },
    });
    return;
  }
  entry.linkedTargetActorId = targetActorId;
  rt.emit({
    type: "status_linked",
    ...sourceFields(ctx),
    targetActorIds: [actor.instanceId],
    tags: ["link"],
    values: { statusId, beforeTargetActorId, afterTargetActorId: targetActorId, stacks: entry.stacks },
  });
}

function modifyPendingAmount(rt, ctx, effect) {
  const frame = ctx.pending;
  if (!frame || frame.kind !== "amount") return;
  const amount = evaluateValue(rt.state, ctx, effect.amount);
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

function modifyPendingGuard(rt, ctx, effect) {
  const frame = ctx.pending;
  if (!frame || frame.kind !== "amount" || ctx.event?.type !== "damage_proposed") return;
  const amount = evaluateValue(rt.state, ctx, effect.amount);
  if (amount <= 0) return;
  const before = frame.guardIgnore ?? 0;
  frame.guardIgnore = before + amount;
  rt.emit({
    type: "pending_guard_modified",
    ...sourceFields(ctx),
    targetActorIds: [...frame.targetActorIds],
    tags: ["ignore"],
    values: {
      before,
      after: frame.guardIgnore,
      delta: amount,
      proposalEventId: ctx.event?.id ?? null,
    },
  });
}

// A damage split is one atomic interrupt: reduce the current pending packet,
// then send a fixed share of the packet currently pending to the chosen transfer target.
// `amount` is the mitigation amount; `share` is the fixed transferred portion.
function evaluatePendingAmount(rt, ctx, valueDef, pendingAmount) {
  // event_value_scaled is normally based on the proposal event's immutable
  // values. For this effect, the meaningful "received damage" is the amount
  // still pending after earlier proposal interrupts, so the amount ratio is
  // applied to the live frame instead.
  if (valueDef?.type === "event_value_scaled" && valueDef.key === "amount") {
    const numerator = valueDef.numerator ?? 1;
    const denominator = valueDef.denominator ?? 1;
    const scaled = Math.floor((pendingAmount * numerator) / denominator);
    return scaled > 0 ? scaled : 0;
  }
  return evaluateValue(rt.state, ctx, valueDef);
}

function splitPendingDamage(rt, ctx, effect) {
  const frame = ctx.pending;
  if (!frame || frame.kind !== "amount") return;
  const before = Math.max(0, frame.amount);
  if (before <= 0) return;

  const mitigation = Math.min(
    before,
    evaluatePendingAmount(rt, ctx, effect.amount, before),
  );
  const transfer = Math.min(before, evaluatePendingAmount(rt, ctx, effect.share, before));

  if (mitigation > 0) {
    frame.amount = before - mitigation;
    rt.emit({
      type: "pending_amount_modified",
      ...sourceFields(ctx),
      targetActorIds: [...frame.targetActorIds],
      tags: [...new Set([...(effect.tags ?? []), "split", "decrease"])],
      values: {
        operation: "decrease",
        before,
        after: frame.amount,
        delta: frame.amount - before,
        proposalEventId: ctx.event ? ctx.event.id : null,
        splitMitigation: mitigation,
        transferredDamage: transfer,
      },
    });
  }

  if (transfer <= 0) return;
  const transferEffect = {
    type: "deal_damage",
    target: effect.target,
    amount: { type: "constant", value: transfer },
    reach: "unrestricted",
    tags: [...new Set([...(effect.tags ?? []), "shared_damage"])],
  };
  for (const target of selectTargets(rt, ctx, transferEffect.target)) {
    if (!target.alive) continue;
    // The amount was already evaluated from the current proposal frame. Passing
    // it through explicitly avoids applying the amount a second time,
    // while still letting this normal damage instance use guard/barrier and the
    // usual damage_proposed -> damage_taken event path.
    dealOneInstance(rt, ctx, transferEffect, target, 0, 1, transfer, null, true);
  }
}

function redirectPendingTarget(rt, ctx, effect) {
  const frame = ctx.pending;
  if (!frame) return;
  const targetCount = frame.targetActorIds.length;
  const replacement = selectTargets(rt, ctx, effect.target)[0];
  if (!replacement) return;
  const from = frame.targetActorIds[0] ?? null;
  if (from === replacement.instanceId) return;
  frame.targetActorIds = [replacement.instanceId];
  frame.redirected = true;
  rt.emit({
    type: "target_changed",
    ...sourceFields(ctx),
    targetActorIds: [replacement.instanceId],
    tags: ["redirect"],
    values: { from, to: replacement.instanceId, targetCount },
  });
}

function cancelPendingAction(rt, ctx, effect) {
  const frame = ctx.pending;
  if (!frame || frame.kind !== "action") return;
  frame.canceled = true;
  frame.cancelReason = { ruleId: ctx.ruleId ?? null, ownerId: ctx.owner ? ctx.owner.instanceId : null };
}

export { selectTargets, equipmentInstance, statusStacks, positionIndex };
