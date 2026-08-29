// ecology/values.mjs
//
// §10.3 — effect amounts. Intermediate arithmetic stays integral, the division
// floors once at the end, and the result is never negative. A denominator of 0
// is rejected by validate.mjs, so it cannot reach here.

import { actorStat, resolveSubject, statusStacks } from "./actors.mjs";

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
    case "actor_stat_scaled": {
      const actor = resolveSubject(state, ctx, valueDef.subject);
      base = actor ? actorStat(actor, valueDef.stat) : 0;
      break;
    }
    case "status_stacks_scaled": {
      const actor = resolveSubject(state, ctx, valueDef.subject);
      base = actor ? statusStacks(actor, valueDef.statusId) : 0;
      break;
    }
    default:
      throw new Error(`unimplemented value type: ${valueDef.type}`);
  }

  const scaled = Math.floor((base * numerator) / denominator);
  return scaled > 0 ? scaled : 0;
}
