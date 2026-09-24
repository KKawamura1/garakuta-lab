// ecology/values.mjs
//
// §10.3 — effect amounts. Intermediate arithmetic stays integral, the division
// floors once at the end, and the result is never negative. A denominator of 0
// is rejected by validate.mjs, so it cannot reach here.

import { actorStat, resolveSubject, statusStacks } from "./actors.mjs";

// R6 §4.4 — round-half-up, done on integers.
//
// **商と余りに分けてから比べる。** 素直に書くと
// `Math.floor((numerator * 2 + denominator) / (denominator * 2))` だが、
// 分子を2倍した時点で 2^53 を越えて丸めがぶれる（R6 の大整数ケースで確認済み）。
// 余りだけを2倍すれば、余りは必ず分母より小さいので桁が落ちない。
// 負値はこの式では現れない（amount も stat も非負）。
export function roundHalfUpDiv(numerator, denominator) {
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

export const BPS = 10_000;

export function evaluateValue(state, ctx, valueDef) {
  const numerator = valueDef.numerator ?? 1;
  const denominator = valueDef.denominator ?? 1;
  let base = 0;

  switch (valueDef.type) {
    case "constant":
      base = valueDef.value;
      break;
    case "event_value_scaled": {
      const raw = ctx.event ? ctx.event.values[valueDef.key] : undefined;
      base = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      break;
    }
    case "pending_amount_scaled": {
      const pending = ctx.pending?.amount;
      base = typeof pending === "number" && Number.isFinite(pending) ? pending : 0;
      break;
    }
    case "pending_amount_times_status_scaled": {
      const pending = ctx.pending?.amount;
      const actor = resolveSubject(state, ctx, valueDef.subject);
      const snapshot = valueDef.memoryKey ? ctx.pendingAction?.memory?.[valueDef.memoryKey] : undefined;
      const stacks = Number.isSafeInteger(snapshot)
        ? snapshot
        : (actor ? statusStacks(actor, valueDef.statusId) : 0);
      base = typeof pending === "number" && Number.isFinite(pending) ? pending * stacks : 0;
      break;
    }
    case "event_value_times_status_scaled": {
      const raw = ctx.event ? ctx.event.values[valueDef.key] : undefined;
      const actor = resolveSubject(state, ctx, valueDef.subject);
      const snapshot = valueDef.memoryKey ? ctx.pendingAction?.memory?.[valueDef.memoryKey] : undefined;
      const stacks = Number.isSafeInteger(snapshot)
        ? snapshot
        : (actor ? statusStacks(actor, valueDef.statusId) : 0);
      base = typeof raw === "number" && Number.isFinite(raw) ? raw * stacks : 0;
      break;
    }
    case "actor_stat_scaled": {
      const actor = resolveSubject(state, ctx, valueDef.subject);
      base = actor ? actorStat(actor, valueDef.stat) : 0;
      break;
    }
    // R6 §4.4 — flat + roundHalfUp(stat * coefficientBps / 10_000)。
    // basic strike は might 100%、technique は focus。
    case "stat_scaled": {
      const actor = resolveSubject(state, ctx, valueDef.subject);
      const stat = actor ? actorStat(actor, valueDef.scalingStat) : 0;
      const condition = valueDef.statusConditional;
      const memoryCount = condition?.memoryKey
        ? ctx.pendingAction?.memory?.[condition.memoryKey]
        : undefined;
      const hasSnapshot = Number.isSafeInteger(memoryCount);
      const statusCount = hasSnapshot
        ? memoryCount
        : (actor ? statusStacks(actor, condition?.statusId) : 0);
      const conditionMet = condition && actor && statusCount >= condition.minStacks;
      const coefficientBps = conditionMet
        ? condition.coefficientBps
        : (valueDef.coefficientBps ?? 0);
      base = (valueDef.flat ?? 0) + roundHalfUpDiv(stat * coefficientBps, BPS);
      break;
    }
    case "status_stacks_scaled": {
      const actor = resolveSubject(state, ctx, valueDef.subject);
      base = actor ? statusStacks(actor, valueDef.statusId) : 0;
      break;
    }
    case "stat_times_context_scaled": {
      const actor = resolveSubject(state, ctx, valueDef.subject);
      const stat = actor ? actorStat(actor, valueDef.scalingStat) : 0;
      const memory = ctx.pendingAction?.memory ?? ctx.memory;
      const count = Number.isSafeInteger(memory?.[valueDef.key]) ? memory[valueDef.key] : 0;
      const coefficientBps = (valueDef.flatCoefficientBps ?? 0) + count * valueDef.coefficientBps;
      base = roundHalfUpDiv(stat * coefficientBps, BPS);
      break;
    }
    default:
      throw new Error(`unimplemented value type: ${valueDef.type}`);
  }

  const scaled = Math.floor((base * numerator) / denominator);
  return scaled > 0 ? scaled : 0;
}
