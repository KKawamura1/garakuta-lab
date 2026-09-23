// ecology/validate.mjs
//
// Gate B. Content is data, so every mistake a designer can make in data has to
// be caught here rather than at 2am inside a battle: unknown names, dangling
// references, duplicate ids, loadout limits, interrupt-only effects on after
// rules, and any number that is negative, fractional or non-finite.
//
// Both functions return an array of { path, code, message }. An empty array
// means valid. engine.mjs turns a non-empty array into a thrown
// EcologyValidationError, so no caller can accidentally simulate bad content.

import {
  ACTION_MODES,
  ACTOR_STATS,
  PASSIVE_STAT_BONUSES,
  REACHES,
  RANGE_CLASSES,
  SCALING_STATS,
  TARGET_PATTERNS,
  BARRIER_DURATIONS,
  BATTLE_SCHEMA_VERSION,
  COMPARISON_OPS,
  CONTENT_SCHEMA_VERSION,
  COST_TYPES,
  DURATIONS,
  EFFECT_TYPES,
  EVENT_TYPES,
  HIT_DISTRIBUTIONS,
  INTERRUPTIBLE_EVENT_TYPES,
  INTERRUPT_ONLY_EFFECT_TYPES,
  LIMITS,
  LIMIT_SCOPES,
  NON_LISTENABLE_EVENT_TYPES,
  OBJECTIVE_TYPES,
  OVERRIDABLE_STATS,
  TRAINABLE_STATS,
  PENDING_ACTION_EFFECT_TYPES,
  PENDING_ACTION_EVENT_TYPES,
  PENDING_AMOUNT_EFFECT_TYPES,
  PENDING_AMOUNT_EVENT_TYPES,
  PENDING_AMOUNT_OPERATIONS,
  POSITIONS,
  PREDICATE_TYPES,
  RESERVED_EVENT_TYPES,
  RESOURCE_NAMES,
  ROWS,
  RULE_TIMINGS,
  STATUS_POLARITIES,
  SUBJECTS,
  TAKE_VALUES,
  TARGET_FILTER_TYPES,
  TARGET_SCOPES,
  TARGET_SORT_TYPES,
  USE_WHEN_PREDICATE_TYPES,
  USE_WHEN_SUBJECTS,
  VALUE_TYPES,
  isValidId,
} from "./schema.mjs";
import { maxHpWithStaticBonuses } from "./static-bonuses.mjs";

class ErrorBag {
  constructor() {
    this.list = [];
  }

  add(path, code, message) {
    this.list.push({ path, code, message });
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositive(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function requireCount(bag, path, value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    bag.add(path, "not_a_number", `expected a finite number, got ${JSON.stringify(value)}`);
    return false;
  }
  if (!Number.isSafeInteger(value)) {
    bag.add(path, "not_an_integer", `expected a safe integer, got ${value}`);
    return false;
  }
  if (value < min || value > max) {
    bag.add(path, "out_of_range", `expected ${min}..${max}, got ${value}`);
    return false;
  }
  return true;
}

function requireOneOf(bag, path, value, allowed, code = "unknown_value") {
  if (!allowed.includes(value)) {
    bag.add(path, code, `${JSON.stringify(value)} is not one of: ${allowed.join(", ")}`);
    return false;
  }
  return true;
}

function requireArray(bag, path, value, { max } = {}) {
  if (!Array.isArray(value)) {
    bag.add(path, "not_an_array", `expected an array, got ${JSON.stringify(value)}`);
    return false;
  }
  if (max !== undefined && value.length > max) {
    bag.add(path, "too_many", `at most ${max} entries, got ${value.length}`);
    return false;
  }
  return true;
}

function requireTags(bag, path, tags) {
  if (!requireArray(bag, path, tags)) return;
  tags.forEach((tag, index) => {
    if (typeof tag !== "string" || tag.length === 0) {
      bag.add(`${path}[${index}]`, "bad_tag", "tags must be non-empty strings");
    }
  });
}

function requireDisplayName(bag, path, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    bag.add(path, "bad_display_name", "displayName must be a non-empty string");
  }
}

// ------------------------------------------------------------------- values

function validateValue(bag, path, value, ctx) {
  if (!isPlainObject(value)) {
    bag.add(path, "not_an_object", "expected a value definition object");
    return;
  }
  if (!requireOneOf(bag, `${path}.type`, value.type, VALUE_TYPES, "unknown_value_type")) return;

  if (value.numerator !== undefined && !requireCount(bag, `${path}.numerator`, value.numerator, { min: 0 })) return;
  if (value.denominator !== undefined) {
    if (!requireCount(bag, `${path}.denominator`, value.denominator, { min: 0 })) return;
    // §10.3 — division by zero is rejected in data, never at runtime.
    if (value.denominator === 0) {
      bag.add(`${path}.denominator`, "division_by_zero", "denominator must not be 0");
      return;
    }
  }

  switch (value.type) {
    case "constant":
      requireCount(bag, `${path}.value`, value.value, { min: 0 });
      break;
    case "event_value_scaled":
      if (typeof value.key !== "string" || value.key.length === 0) {
        bag.add(`${path}.key`, "bad_key", "event_value_scaled needs a values key");
      }
      break;
    case "actor_stat_scaled":
      validateSubject(bag, `${path}.subject`, value.subject, ctx);
      requireOneOf(bag, `${path}.stat`, value.stat, ACTOR_STATS, "unknown_actor_stat");
      break;
    // R6 §4.4 — PHASE A. flat + roundHalfUp(stat * coefficientBps / 10_000)
    case "stat_scaled":
      validateSubject(bag, `${path}.subject`, value.subject, ctx);
      requireOneOf(bag, `${path}.scalingStat`, value.scalingStat, SCALING_STATS, "unknown_scaling_stat");
      if (value.flat !== undefined) requireCount(bag, `${path}.flat`, value.flat, { max: 100_000 });
      requireCount(bag, `${path}.coefficientBps`, value.coefficientBps, { max: 100_000 });
      if (value.statusConditional !== undefined) {
        if (!isPlainObject(value.statusConditional)) {
          bag.add(`${path}.statusConditional`, "not_an_object", "expected a status conditional coefficient");
        } else {
          requireStatusReference(bag, `${path}.statusConditional.statusId`, value.statusConditional.statusId, ctx);
          requireCount(bag, `${path}.statusConditional.minStacks`, value.statusConditional.minStacks, { min: 1 });
          requireCount(bag, `${path}.statusConditional.coefficientBps`, value.statusConditional.coefficientBps,
            { max: 100_000 });
          if (value.statusConditional.memoryKey !== undefined
              && (typeof value.statusConditional.memoryKey !== "string"
                || value.statusConditional.memoryKey.length === 0)) {
            bag.add(`${path}.statusConditional.memoryKey`, "bad_key", "memoryKey must be a non-empty string");
          }
        }
      }
      break;
    case "status_stacks_scaled":
      validateSubject(bag, `${path}.subject`, value.subject, ctx);
      requireStatusReference(bag, `${path}.statusId`, value.statusId, ctx);
      break;
    case "stat_times_context_scaled":
      validateSubject(bag, `${path}.subject`, value.subject, ctx);
      requireOneOf(bag, `${path}.scalingStat`, value.scalingStat, SCALING_STATS, "unknown_scaling_stat");
      if (typeof value.key !== "string" || value.key.length === 0) {
        bag.add(`${path}.key`, "bad_key", "stat_times_context_scaled needs a context key");
      }
      requireCount(bag, `${path}.flatCoefficientBps`, value.flatCoefficientBps ?? 0, { max: 100_000 });
      requireCount(bag, `${path}.coefficientBps`, value.coefficientBps, { max: 100_000 });
      break;
    default:
      break;
  }
}

function validateSubject(bag, path, subject, ctx) {
  const allowed = ctx.allowedSubjects ?? SUBJECTS;
  if (!requireOneOf(bag, path, subject, allowed, "unknown_subject")) return;
  // A region rule has no owner instance, so "self" has no referent (PREFLIGHT §7).
  if (ctx.ownerless && subject === "self") {
    bag.add(path, "ownerless_self", "a region rule has no self; use allies or enemies");
  }
}

function requireStatusReference(bag, path, statusId, ctx) {
  if (!isValidId(statusId)) {
    bag.add(path, "bad_id", `${JSON.stringify(statusId)} is not a valid id`);
    return;
  }
  if (ctx.bundle && !Object.hasOwn(ctx.bundle.statuses ?? {}, statusId)) {
    bag.add(path, "dangling_reference", `no such status: ${statusId}`);
  }
}

// ------------------------------------------------------------ target queries

function validateTargetQuery(bag, path, query, ctx, { take } = {}) {
  if (!isPlainObject(query)) {
    bag.add(path, "not_an_object", "expected a target query object");
    return;
  }
  if (requireOneOf(bag, `${path}.scope`, query.scope, TARGET_SCOPES, "unknown_target_scope")) {
    if (ctx.ownerless && query.scope === "self") {
      bag.add(`${path}.scope`, "ownerless_self", "a region rule has no self scope");
    }
  }
  if (query.filters !== undefined && requireArray(bag, `${path}.filters`, query.filters)) {
    query.filters.forEach((filter, index) => {
      validateTargetFilter(bag, `${path}.filters[${index}]`, filter, ctx);
    });
  }
  if (query.sort !== undefined && requireArray(bag, `${path}.sort`, query.sort)) {
    query.sort.forEach((sort, index) => {
      const sortPath = `${path}.sort[${index}]`;
      const type = isPlainObject(sort) ? sort.type : sort;
      if (!requireOneOf(bag, isPlainObject(sort) ? `${sortPath}.type` : sortPath,
        type, TARGET_SORT_TYPES, "unknown_target_sort")) return;
      if (isPlainObject(sort) && type === "status_stacks_desc") {
        requireStatusReference(bag, `${sortPath}.statusId`, sort.statusId, ctx);
      } else if (isPlainObject(sort) && type !== "distance_to_self_asc") {
        bag.add(sortPath, "unexpected_sort_options", `${type} does not take sort options`);
      }
    });
  }
  if (!requireOneOf(bag, `${path}.take`, query.take, TAKE_VALUES, "unknown_take")) return;
  if (take !== undefined && query.take !== take) {
    bag.add(`${path}.take`, "bad_take", `this position requires take: ${JSON.stringify(take)}`);
  }
}

function validateTargetFilter(bag, path, filter, ctx) {
  if (!isPlainObject(filter)) {
    bag.add(path, "not_an_object", "expected a filter object");
    return;
  }
  if (!requireOneOf(bag, `${path}.type`, filter.type, TARGET_FILTER_TYPES, "unknown_target_filter")) return;
  switch (filter.type) {
    case "alive":
      if (filter.value !== undefined && typeof filter.value !== "boolean") {
        bag.add(`${path}.value`, "bad_boolean", "alive.value must be a boolean");
      }
      break;
    case "row_is":
      requireOneOf(bag, `${path}.row`, filter.row, ROWS, "unknown_row");
      break;
    case "has_open_position_in_row":
      requireOneOf(bag, `${path}.row`, filter.row, ROWS, "unknown_row");
      break;
    case "hp_percent":
      requireOneOf(bag, `${path}.op`, filter.op, COMPARISON_OPS, "unknown_operator");
      requireCount(bag, `${path}.value`, filter.value, { min: 0, max: 100 });
      break;
    case "has_status":
      requireStatusReference(bag, `${path}.statusId`, filter.statusId, ctx);
      if (filter.op !== undefined) requireOneOf(bag, `${path}.op`, filter.op, COMPARISON_OPS, "unknown_operator");
      if (filter.value !== undefined) requireCount(bag, `${path}.value`, filter.value, { min: 0 });
      break;
    case "has_defense":
      break;
    case "has_defense_or_status":
      requireStatusReference(bag, `${path}.statusId`, filter.statusId, ctx);
      break;
    case "is_preparing":
      if (typeof filter.value !== "boolean") {
        bag.add(`${path}.value`, "bad_boolean", "is_preparing.value must be a boolean");
      }
      break;
    case "not_acted_this_round":
      if (filter.value !== undefined && typeof filter.value !== "boolean") {
        bag.add(`${path}.value`, "bad_boolean", "not_acted_this_round.value must be a boolean");
      }
      break;
    case "not_previous_target":
    case "not_self":
    case "is_event_primary_target":
    case "not_event_primary_target":
    case "same_row_as_event_primary_target":
    case "same_column_as_event_primary_target":
    case "is_event_source":
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- predicates

function validatePredicates(bag, path, predicates, ctx, { max } = {}) {
  if (!requireArray(bag, path, predicates, { max })) return;
  predicates.forEach((predicate, index) => {
    validatePredicate(bag, `${path}[${index}]`, predicate, ctx);
  });
}

function validatePredicate(bag, path, predicate, ctx) {
  if (!isPlainObject(predicate)) {
    bag.add(path, "not_an_object", "expected a predicate object");
    return;
  }
  const allowedTypes = ctx.allowedPredicateTypes ?? PREDICATE_TYPES;
  if (!requireOneOf(bag, `${path}.type`, predicate.type, allowedTypes, "unknown_predicate")) return;

  switch (predicate.type) {
    case "always":
      break;
    case "hp_percent":
      validateSubject(bag, `${path}.subject`, predicate.subject, ctx);
      requireOneOf(bag, `${path}.op`, predicate.op, COMPARISON_OPS, "unknown_operator");
      requireCount(bag, `${path}.value`, predicate.value, { min: 0, max: 100 });
      break;
    case "resource":
      validateSubject(bag, `${path}.subject`, predicate.subject, ctx);
      requireOneOf(bag, `${path}.resource`, predicate.resource, RESOURCE_NAMES, "unknown_resource");
      requireOneOf(bag, `${path}.op`, predicate.op, COMPARISON_OPS, "unknown_operator");
      requireCount(bag, `${path}.value`, predicate.value, { min: 0 });
      break;
    case "position": {
      validateSubject(bag, `${path}.subject`, predicate.subject, ctx);
      requireOneOf(bag, `${path}.op`, predicate.op, ["eq", "ne"], "unknown_operator");
      const hasValue = predicate.value !== undefined;
      const hasRow = predicate.row !== undefined;
      if (hasValue === hasRow) {
        bag.add(path, "bad_position_predicate", "give exactly one of value (a position) or row");
        break;
      }
      if (hasValue) requireOneOf(bag, `${path}.value`, predicate.value, POSITIONS, "unknown_position");
      else requireOneOf(bag, `${path}.row`, predicate.row, ROWS, "unknown_row");
      break;
    }
    case "has_status":
      validateSubject(bag, `${path}.subject`, predicate.subject, ctx);
      requireStatusReference(bag, `${path}.statusId`, predicate.statusId, ctx);
      if (predicate.op !== undefined) {
        requireOneOf(bag, `${path}.op`, predicate.op, COMPARISON_OPS, "unknown_operator");
      }
      if (predicate.value !== undefined) requireCount(bag, `${path}.value`, predicate.value, { min: 0 });
      break;
    case "is_preparing":
      validateSubject(bag, `${path}.subject`, predicate.subject, ctx);
      if (typeof predicate.value !== "boolean") {
        bag.add(`${path}.value`, "bad_boolean", "is_preparing.value must be a boolean");
      }
      break;
    case "event_tag":
      if (typeof predicate.tag !== "string" || predicate.tag.length === 0) {
        bag.add(`${path}.tag`, "bad_tag", "event_tag needs a tag string");
      }
      if (predicate.value !== undefined && typeof predicate.value !== "boolean") {
        bag.add(`${path}.value`, "bad_boolean", "event_tag.value must be a boolean");
      }
      break;
    case "event_value":
      if (typeof predicate.key !== "string" || predicate.key.length === 0) {
        bag.add(`${path}.key`, "bad_key", "event_value needs a values key");
      }
      requireOneOf(bag, `${path}.op`, predicate.op, COMPARISON_OPS, "unknown_operator");
      if (!["number", "string", "boolean"].includes(typeof predicate.value)) {
        bag.add(`${path}.value`, "bad_value", "event_value.value must be a number, string or boolean");
      } else if (typeof predicate.value === "number" && !Number.isFinite(predicate.value)) {
        bag.add(`${path}.value`, "not_a_number", "event_value.value must be finite");
      }
      break;
    case "history_count":
      validateSubject(bag, `${path}.subject`, predicate.subject, ctx);
      requireOneOf(bag, `${path}.metric`, predicate.metric, ctx.historyMetrics, "unknown_history_metric");
      requireOneOf(bag, `${path}.window`, predicate.window, ctx.historyWindows, "unknown_history_window");
      requireOneOf(bag, `${path}.op`, predicate.op, COMPARISON_OPS, "unknown_operator");
      requireCount(bag, `${path}.value`, predicate.value, { min: 0 });
      break;
    case "target_exists":
      validateTargetQuery(bag, `${path}.query`, predicate.query, ctx);
      if (predicate.op !== undefined) {
        requireOneOf(bag, `${path}.op`, predicate.op, COMPARISON_OPS, "unknown_operator");
      }
      if (predicate.value !== undefined) requireCount(bag, `${path}.value`, predicate.value, { min: 0 });
      break;
    case "hit_target_comparison":
      requireOneOf(bag, `${path}.relation`, predicate.relation, ["same", "different"], "unknown_relation");
      break;
    case "round_number":
      requireOneOf(bag, `${path}.op`, predicate.op, COMPARISON_OPS, "unknown_operator");
      requireCount(bag, `${path}.value`, predicate.value, { min: 0 });
      break;
    default:
      break;
  }
}

// -------------------------------------------------------------- costs, effects

function validateCosts(bag, path, costs, ctx) {
  if (!requireArray(bag, path, costs)) return;
  if (ctx.ownerless && costs.length > 0) {
    bag.add(path, "ownerless_cost", "a region rule has nobody to pay a cost");
    return;
  }
  costs.forEach((cost, index) => {
    const costPath = `${path}[${index}]`;
    if (!isPlainObject(cost)) {
      bag.add(costPath, "not_an_object", "expected a cost object");
      return;
    }
    if (!requireOneOf(bag, `${costPath}.type`, cost.type, COST_TYPES, "unknown_cost")) return;
    requireCount(bag, `${costPath}.amount`, cost.amount, { min: 1 });
    if (cost.type === "wear_equipment" && !ctx.fromEquipment) {
      bag.add(costPath, "not_equipment_rule", "wear_equipment is only payable by an equipment rule");
    }
  });
}

function validateEffects(bag, path, effects, ctx) {
  if (!requireArray(bag, path, effects)) return;
  effects.forEach((effect, index) => {
    validateEffect(bag, `${path}[${index}]`, effect, ctx);
  });
}

function validateEffect(bag, path, effect, ctx) {
  if (!isPlainObject(effect)) {
    bag.add(path, "not_an_object", "expected an effect object");
    return;
  }
  if (!requireOneOf(bag, `${path}.type`, effect.type, EFFECT_TYPES, "unknown_effect")) return;

  // §11.4 — the three pending-frame effects only exist inside an interrupt rule,
  // and only for an event that actually carries the frame they need.
  if (INTERRUPT_ONLY_EFFECT_TYPES.includes(effect.type)) {
    if (ctx.timing !== "interrupt") {
      bag.add(path, "interrupt_only_effect", `${effect.type} requires timing: "interrupt"`);
      return;
    }
    if (PENDING_AMOUNT_EFFECT_TYPES.includes(effect.type) && PENDING_ACTION_EFFECT_TYPES.includes(effect.type)) {
      if (!INTERRUPTIBLE_EVENT_TYPES.includes(ctx.listenTo)) {
        bag.add(path, "no_pending_frame", `${effect.type} needs a pending frame`);
        return;
      }
    } else if (PENDING_AMOUNT_EFFECT_TYPES.includes(effect.type)) {
      if (!PENDING_AMOUNT_EVENT_TYPES.includes(ctx.listenTo)) {
        bag.add(path, "no_pending_amount", `${effect.type} needs damage_proposed or healing_proposed`);
        return;
      }
    } else if (!PENDING_ACTION_EVENT_TYPES.includes(ctx.listenTo)) {
      bag.add(path, "no_pending_action", `${effect.type} needs action_declared or target_selected`);
      return;
    }
  }

  switch (effect.type) {
    case "deal_damage":
      if (ctx.insideHitEffects) {
        bag.add(path, "nested_hit_attack", "onHitEffects may not start another attack");
      }
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      if (effect.tags !== undefined) requireTags(bag, `${path}.tags`, effect.tags);
      // R6 §6.7 — PHASE A. 省略時は hit 1・貫通0・single・unrestricted で、
      // それは v1 の挙動そのもの。**既存定義は書き換えなくてよい。**
      if (effect.hitCount !== undefined) {
        requireCount(bag, `${path}.hitCount`, effect.hitCount, { min: 1, max: 8 });
      }
      if (effect.hitCount !== undefined && effect.hitCountFromStatus !== undefined) {
        bag.add(path, "ambiguous_hit_count", "use hitCount or hitCountFromStatus, not both");
      }
      if (effect.hitCountFromStatus !== undefined) {
        if (!isPlainObject(effect.hitCountFromStatus)) {
          bag.add(`${path}.hitCountFromStatus`, "not_an_object", "expected a hitCountFromStatus object");
        } else {
          requireStatusReference(
            bag,
            `${path}.hitCountFromStatus.statusId`,
            effect.hitCountFromStatus.statusId,
            ctx,
          );
          requireCount(bag, `${path}.hitCountFromStatus.max`, effect.hitCountFromStatus.max, { min: 1, max: 8 });
          if (effect.hitCountFromStatus.fallback !== undefined) {
            requireCount(bag, `${path}.hitCountFromStatus.fallback`, effect.hitCountFromStatus.fallback,
              { min: 0, max: 8 });
          }
          if (effect.hitCountFromStatus.base !== undefined) {
            requireCount(bag, `${path}.hitCountFromStatus.base`, effect.hitCountFromStatus.base, { min: 1, max: 8 });
          }
          if (effect.hitCountFromStatus.memoryKey !== undefined
              && (typeof effect.hitCountFromStatus.memoryKey !== "string"
                || effect.hitCountFromStatus.memoryKey.length === 0)) {
            bag.add(`${path}.hitCountFromStatus.memoryKey`, "bad_key", "memoryKey must be a non-empty string");
          }
        }
      }
      if (effect.hitDistribution !== undefined) {
        requireOneOf(
          bag,
          `${path}.hitDistribution`,
          effect.hitDistribution,
          HIT_DISTRIBUTIONS,
          "unknown_hit_distribution",
        );
      }
      if (effect.guardPierceBps !== undefined) {
        requireCount(bag, `${path}.guardPierceBps`, effect.guardPierceBps, { min: 0, max: 10_000 });
      }
      if (effect.targetPattern !== undefined) {
        requireOneOf(bag, `${path}.targetPattern`, effect.targetPattern, TARGET_PATTERNS, "unknown_target_pattern");
      }
      if (effect.reach !== undefined) {
        requireOneOf(bag, `${path}.reach`, effect.reach, REACHES, "unknown_reach");
      }
      if (effect.rangeClass !== undefined) {
        requireOneOf(
          bag,
          `${path}.rangeClass`,
          effect.rangeClass,
          RANGE_CLASSES,
          "unknown_range_class",
        );
      }
      if (effect.reach !== undefined && effect.rangeClass !== undefined) {
        bag.add(path, "ambiguous_range", "use rangeClass or legacy reach, not both");
      }
      // **範囲攻撃は take: 1 から広げる。** take: "all" と組み合わせると、
      // どの一体を基点に広げたのかが決まらない。
      if (effect.targetPattern && effect.targetPattern !== "single" && effect.target?.take !== 1) {
        bag.add(`${path}.targetPattern`, "pattern_needs_single_anchor",
          `${effect.targetPattern} spreads from one anchor, so target.take must be 1`);
      }
      if (effect.onHitEffects !== undefined) {
        validateEffects(bag, `${path}.onHitEffects`, effect.onHitEffects, { ...ctx, insideHitEffects: true });
      }
      break;
    case "heal":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      if (effect.tags !== undefined) requireTags(bag, `${path}.tags`, effect.tags);
      break;
    case "gain_barrier":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      requireOneOf(bag, `${path}.duration`, effect.duration, BARRIER_DURATIONS, "unknown_duration");
      if (effect.tags !== undefined) requireTags(bag, `${path}.tags`, effect.tags);
      break;
    // R6 §6.7 — PHASE A. block は charge（回数）なので離散量。
    case "gain_block":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      break;
    case "gain_resource":
    case "reduce_resource":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      requireOneOf(bag, `${path}.resource`, effect.resource, RESOURCE_NAMES, "unknown_resource");
      if (effect.tags !== undefined) requireTags(bag, `${path}.tags`, effect.tags);
      break;
    case "add_status":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      requireStatusReference(bag, `${path}.statusId`, effect.statusId, ctx);
      if (effect.stacks !== undefined) requireCount(bag, `${path}.stacks`, effect.stacks, { min: 1 });
      break;
    case "remove_status":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      requireStatusReference(bag, `${path}.statusId`, effect.statusId, ctx);
      if (effect.stacks !== undefined && effect.stacks !== "all") {
        requireCount(bag, `${path}.stacks`, effect.stacks, { min: 1 });
      }
      if (effect.maxStacks !== undefined) requireCount(bag, `${path}.maxStacks`, effect.maxStacks, { min: 1 });
      if (effect.storeAs !== undefined) {
        if (typeof effect.storeAs !== "string" || effect.storeAs.length === 0) {
          bag.add(`${path}.storeAs`, "bad_key", "storeAs must be a non-empty string");
        }
        if (ctx.timing !== "action" || effect.target?.scope !== "self" || effect.target?.take !== 1) {
          bag.add(`${path}.storeAs`, "status_snapshot_outside_action",
            "storeAs is only valid for a single self target during an active action");
        }
      }
      break;
    case "remove_statuses":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      requireOneOf(bag, `${path}.polarity`, effect.polarity, STATUS_POLARITIES, "unknown_polarity");
      break;
    case "remove_barrier":
    case "remove_block":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      break;
    case "swap_positions":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx, { take: 1 });
      validateTargetQuery(bag, `${path}.otherTarget`, effect.otherTarget, ctx, { take: 1 });
      break;
    case "move_to_open_row":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx, { take: 1 });
      requireOneOf(bag, `${path}.row`, effect.row, ROWS, "unknown_row");
      if (effect.returnAfterAction !== undefined && typeof effect.returnAfterAction !== "boolean") {
        bag.add(`${path}.returnAfterAction`, "bad_boolean", "returnAfterAction must be a boolean");
      }
      if (effect.returnAfterAction === true
          && ctx.timing !== "action" && ctx.listenTo !== "action_declared") {
        bag.add(
          `${path}.returnAfterAction`,
          "action_return_outside_action",
          "returnAfterAction is only valid during an active action",
        );
      }
      if (effect.returnRow !== undefined) {
        requireOneOf(bag, `${path}.returnRow`, effect.returnRow, ROWS, "unknown_row");
        if (effect.returnAfterAction !== true) {
          bag.add(`${path}.returnRow`, "return_row_without_return", "returnRow requires returnAfterAction");
        }
      }
      if (effect.cancelIfOutOfReach !== undefined && typeof effect.cancelIfOutOfReach !== "boolean") {
        bag.add(`${path}.cancelIfOutOfReach`, "bad_boolean", "cancelIfOutOfReach must be a boolean");
      }
      break;
    case "modify_attack_plan":
      if (ctx.timing !== "interrupt" || ctx.listenTo !== "action_declared") {
        bag.add(path, "attack_plan_window", "modify_attack_plan requires an action_declared interrupt");
      }
      if (effect.hitCountBonus !== undefined) {
        requireCount(bag, `${path}.hitCountBonus`, effect.hitCountBonus, { min: 1, max: 8 });
      }
      if (effect.extraHitBps !== undefined) {
        requireCount(bag, `${path}.extraHitBps`, effect.extraHitBps, { min: 1, max: 10_000 });
        if (effect.hitCountBonus === undefined) {
          bag.add(`${path}.extraHitBps`, "missing_hit_count_bonus", "extraHitBps needs hitCountBonus");
        }
      }
      if (effect.minHitCount !== undefined) {
        requireCount(bag, `${path}.minHitCount`, effect.minHitCount, { min: 1, max: 8 });
      }
      if (effect.minTargetCount !== undefined) {
        requireCount(bag, `${path}.minTargetCount`, effect.minTargetCount, { min: 1, max: 5 });
      }
      if (effect.maxHitCount !== undefined) {
        requireCount(bag, `${path}.maxHitCount`, effect.maxHitCount, { min: 1, max: 9 });
      }
      if (effect.snapshotLegalTargets !== undefined && typeof effect.snapshotLegalTargets !== "boolean") {
        bag.add(`${path}.snapshotLegalTargets`, "bad_boolean", "snapshotLegalTargets must be a boolean");
      }
      if (effect.hitDistribution !== undefined) {
        requireOneOf(bag, `${path}.hitDistribution`, effect.hitDistribution, HIT_DISTRIBUTIONS, "unknown_hit_distribution");
      }
      if (effect.hitCountBonus === undefined && effect.snapshotLegalTargets !== true) {
        bag.add(path, "empty_attack_plan_modifier", "give a hit or target plan change");
      }
      break;
    case "start_preparation":
      if (ctx.insidePreparation) {
        bag.add(path, "nested_preparation", "completionEffects must not start another preparation");
        break;
      }
      if (effect.target !== undefined) validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      requireCount(bag, `${path}.steps`, effect.steps, {
        min: LIMITS.minPreparationSteps,
        max: LIMITS.maxPreparationSteps,
      });
      validateEffects(bag, `${path}.completionEffects`, effect.completionEffects, {
        ...ctx,
        insidePreparation: true,
      });
      break;
    case "advance_preparation":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      if (effect.amount !== undefined) validateValue(bag, `${path}.amount`, effect.amount, ctx);
      break;
    case "interrupt_preparation":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      break;
    case "revive":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      if (effect.tags !== undefined) requireTags(bag, `${path}.tags`, effect.tags);
      break;
    case "wear_equipment":
    case "repair_equipment":
      if (!ctx.fromEquipment) {
        bag.add(path, "not_equipment_rule", `${effect.type} is only usable by an equipment rule`);
      }
      if (effect.amount !== undefined) validateValue(bag, `${path}.amount`, effect.amount, ctx);
      break;
    case "modify_pending_amount":
      requireOneOf(bag, `${path}.operation`, effect.operation, PENDING_AMOUNT_OPERATIONS, "unknown_operation");
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      break;
    case "split_pending_damage":
      // The transferred packet is a single, explicit target so the amount is
      // not multiplied accidentally by a broad query.
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx, { take: 1 });
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      validateValue(bag, `${path}.share`, effect.share, ctx);
      if (effect.tags !== undefined) requireTags(bag, `${path}.tags`, effect.tags);
      break;
    case "redirect_pending_target":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx, { take: 1 });
      break;
    case "cancel_pending_action":
      break;
    default:
      break;
  }
}

// --------------------------------------------------------------------- rules

function validateRule(bag, path, rule, ctx) {
  if (!isPlainObject(rule)) {
    bag.add(path, "not_an_object", "expected a rule object");
    return;
  }
  if (!isValidId(rule.id)) {
    bag.add(`${path}.id`, "bad_id", `${JSON.stringify(rule.id)} is not a valid id`);
  } else if (ctx.seenIds) {
    if (ctx.seenIds.has(rule.id)) {
      bag.add(`${path}.id`, "duplicate_id", `id already used: ${rule.id}`);
    } else {
      ctx.seenIds.add(rule.id);
    }
  }

  if (RESERVED_EVENT_TYPES.includes(rule.listenTo)) {
    // §6 — reserved vocabulary is not implemented in v1, and a rule written
    // against it would sit dead forever.
    bag.add(`${path}.listenTo`, "reserved_event_type", `${rule.listenTo} is reserved for a later version`);
  } else if (requireOneOf(bag, `${path}.listenTo`, rule.listenTo, EVENT_TYPES, "unknown_event_type")) {
    if (NON_LISTENABLE_EVENT_TYPES.includes(rule.listenTo)) {
      bag.add(`${path}.listenTo`, "non_listenable_event", `${rule.listenTo} is not a reaction hook in v1`);
    }
  }

  if (requireOneOf(bag, `${path}.timing`, rule.timing, RULE_TIMINGS, "unknown_timing")) {
    if (rule.timing === "interrupt" && !INTERRUPTIBLE_EVENT_TYPES.includes(rule.listenTo)) {
      bag.add(
        `${path}.timing`,
        "no_pending_frame",
        `interrupt rules may only listen to: ${INTERRUPTIBLE_EVENT_TYPES.join(", ")}`,
      );
    }
  }

  requireCount(bag, `${path}.priority`, rule.priority, { min: LIMITS.minPriority, max: LIMITS.maxPriority });

  const ruleCtx = { ...ctx, timing: rule.timing, listenTo: rule.listenTo };
  validatePredicates(bag, `${path}.predicates`, rule.predicates, ruleCtx);
  validateCosts(bag, `${path}.costs`, rule.costs, ruleCtx);
  validateEffects(bag, `${path}.effects`, rule.effects, ruleCtx);

  if (!isPlainObject(rule.limit)) {
    bag.add(`${path}.limit`, "not_an_object", "expected a limit object");
    return;
  }
  requireOneOf(bag, `${path}.limit.scope`, rule.limit.scope, LIMIT_SCOPES, "unknown_limit_scope");
  requireCount(bag, `${path}.limit.count`, rule.limit.count, { min: 1 });
  if (rule.allowRepeatInChain !== undefined && typeof rule.allowRepeatInChain !== "boolean") {
    bag.add(`${path}.allowRepeatInChain`, "bad_boolean", "allowRepeatInChain must be a boolean");
  }
  if (rule.allowRepeatInChain === true
    && (rule.limit.scope !== "chain" || rule.limit.count <= 1)) {
    bag.add(`${path}.allowRepeatInChain`, "unbounded_chain_repeat",
      "allowRepeatInChain needs a chain limit greater than 1");
  }
}

function validateRules(bag, path, rules, ctx) {
  if (!requireArray(bag, path, rules)) return;
  rules.forEach((rule, index) => validateRule(bag, `${path}[${index}]`, rule, ctx));
}

function rejectRemovedSpeedKey(bag, path, definition) {
  if (Object.hasOwn(definition, "speed")) {
    bag.add(`${path}.speed`, "unknown_key", "speed was removed from actor definitions");
  }
}
// ------------------------------------------------------------- content bundle

export function validateContentBundle(bundle) {
  const bag = new ErrorBag();
  if (!isPlainObject(bundle)) {
    bag.add("contentBundle", "not_an_object", "expected a content bundle object");
    return bag.list;
  }
  if (bundle.schemaVersion !== CONTENT_SCHEMA_VERSION) {
    bag.add("contentBundle.schemaVersion", "bad_schema_version", `expected ${CONTENT_SCHEMA_VERSION}`);
  }
  if (typeof bundle.contentVersion !== "string" || bundle.contentVersion.length === 0) {
    bag.add("contentBundle.contentVersion", "bad_content_version", "contentVersion must be a non-empty string");
  }

  // PHASE A: passiveSkills を足した。**古い bundle にも空で存在させる**ので、
  // ここは必須節のままでよい（content/index.mjs が必ず入れる）。
  const sections = [
    "characters", "activeSkills", "targetSkills", "reactiveSkills",
    "passiveSkills", "equipment", "statuses", "enemyActors",
  ];
  if (bundle.enemyActiveSkills !== undefined) sections.push("enemyActiveSkills");
  if (bundle.enemyReactiveSkills !== undefined) sections.push("enemyReactiveSkills");
  if (bundle.enemyPassiveSkills !== undefined) sections.push("enemyPassiveSkills");
  for (const section of sections) {
    if (!isPlainObject(bundle[section])) {
      bag.add(`contentBundle.${section}`, "not_an_object", "expected a record of definitions");
    }
  }
  if (bag.list.length > 0) return bag.list;

  // §5.1 — ids are unique across the whole bundle, rule ids included, so an
  // event or a diagnostic can always be traced back to exactly one definition.
  const seenIds = new Set();
  const claim = (path, id) => {
    if (!isValidId(id)) {
      bag.add(path, "bad_id", `${JSON.stringify(id)} is not a valid lower_snake_case id`);
      return;
    }
    if (seenIds.has(id)) bag.add(path, "duplicate_id", `id already used: ${id}`);
    else seenIds.add(id);
  };

  for (const section of sections) {
    for (const [key, definition] of Object.entries(bundle[section])) {
      if (!isPlainObject(definition)) {
        bag.add(`${section}.${key}`, "not_an_object", "expected a definition object");
        continue;
      }
      if (definition.id !== key) {
        bag.add(`${section}.${key}.id`, "key_id_mismatch", `record key ${key} does not match id ${definition.id}`);
      }
      claim(`${section}.${key}.id`, definition.id);
    }
  }

  const baseCtx = {
    bundle,
    seenIds,
    ownerless: false,
    fromEquipment: false,
    historyMetrics: HISTORY_METRIC_NAMES,
    historyWindows: HISTORY_WINDOW_NAMES,
  };

  for (const [id, character] of Object.entries(bundle.characters)) {
    const path = `characters.${id}`;
    rejectRemovedSpeedKey(bag, path, character);
    requireDisplayName(bag, `${path}.displayName`, character.displayName);
    requireCount(bag, `${path}.maxHp`, character.maxHp, { min: 1 });
    requireCount(bag, `${path}.baseActionPoints`, character.baseActionPoints, { min: 0 });
    requireCount(bag, `${path}.baseReactionPoints`, character.baseReactionPoints, { min: 0 });
    requireTags(bag, `${path}.tags`, character.tags);
    validateRules(bag, `${path}.signatureRules`, character.signatureRules, baseCtx);
  }

  for (const [id, skill] of Object.entries(bundle.activeSkills)) {
    const path = `activeSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireCount(bag, `${path}.apCost`, skill.apCost, { min: 0 });
    if (skill.usesPerBattle !== undefined) {
      requireCount(bag, `${path}.usesPerBattle`, skill.usesPerBattle, { min: 1, max: 99 });
    }
    requireTags(bag, `${path}.tags`, skill.tags);
    validatePredicates(bag, `${path}.intrinsicPredicates`, skill.intrinsicPredicates, baseCtx);
    validateTargetQuery(bag, `${path}.targetQuery`, skill.targetQuery, baseCtx);
    // An active skill is not a rule, so it never has a pending frame to touch.
    validateEffects(bag, `${path}.effects`, skill.effects, { ...baseCtx, timing: "action", listenTo: null });
    if (skill.preparation !== undefined) {
      requireCount(bag, `${path}.preparation.steps`, skill.preparation.steps, {
        min: LIMITS.minPreparationSteps,
        max: LIMITS.maxPreparationSteps,
      });
      validateEffects(bag, `${path}.preparation.completionEffects`, skill.preparation.completionEffects, {
        ...baseCtx,
        timing: "action",
        listenTo: null,
        insidePreparation: true,
      });
    }
  }

  // Enemy AI has its own action vocabulary. Validate it with the same rule
  // grammar, but keep the section separate so player loadouts cannot acquire
  // enemy-only actions by spelling their IDs.
  for (const [id, skill] of Object.entries(bundle.enemyActiveSkills ?? {})) {
    const path = `enemyActiveSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireCount(bag, `${path}.apCost`, skill.apCost, { min: 0 });
    if (skill.usesPerBattle !== undefined) {
      requireCount(bag, `${path}.usesPerBattle`, skill.usesPerBattle, { min: 1, max: 99 });
    }
    requireTags(bag, `${path}.tags`, skill.tags);
    validatePredicates(bag, `${path}.intrinsicPredicates`, skill.intrinsicPredicates, baseCtx);
    validateTargetQuery(bag, `${path}.targetQuery`, skill.targetQuery, baseCtx);
    validateEffects(bag, `${path}.effects`, skill.effects, { ...baseCtx, timing: "action", listenTo: null });
    if (skill.preparation !== undefined) {
      requireCount(bag, `${path}.preparation.steps`, skill.preparation.steps, {
        min: LIMITS.minPreparationSteps,
        max: LIMITS.maxPreparationSteps,
      });
      validateEffects(bag, `${path}.preparation.completionEffects`, skill.preparation.completionEffects, {
        ...baseCtx,
        timing: "action",
        listenTo: null,
        insidePreparation: true,
      });
    }
    if (skill.actionMode !== undefined) {
      requireOneOf(bag, `${path}.actionMode`, skill.actionMode, ACTION_MODES, "unknown_action_mode");
    }
  }

  for (const [id, skill] of Object.entries(bundle.targetSkills)) {
    const path = `targetSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireTags(bag, `${path}.tags`, skill.tags);
    validateTargetQuery(bag, `${path}.targetQuery`, skill.targetQuery, baseCtx, { take: 1 });
  }

  // R6 §6.4 — PHASE A. actionMode は任意（省略時は offense＝追撃なし＝v1 の挙動）。
  // 遊べる版が全技能で宣言していることは analysis/ecology-contract-smoke.mjs が見る。
  for (const [id, skill] of Object.entries(bundle.activeSkills)) {
    if (skill.actionMode !== undefined) {
      requireOneOf(bag, `activeSkills.${id}.actionMode`, skill.actionMode, ACTION_MODES, "unknown_action_mode");
    }
  }

  // R6 §6.4 — 攻撃テンポの保証に使う技能は content が名指しする。
  // **engine は個別 ID で分岐しない**ので、宣言が壊れていればここで落とす。
  if (bundle.coreActions !== undefined) {
    if (!isPlainObject(bundle.coreActions)) {
      bag.add("contentBundle.coreActions", "not_an_object", "expected a record of core action ids");
    } else {
      for (const [key, byReach] of Object.entries(bundle.coreActions)) {
        if (!isPlainObject(byReach)) {
          bag.add(`contentBundle.coreActions.${key}`, "not_an_object", "expected { melee, ranged }");
          continue;
        }
        for (const [reach, skillId] of Object.entries(byReach)) {
          requireOneOf(bag, `contentBundle.coreActions.${key}.${reach}`, reach, REACHES, "unknown_reach");
          const skillSection = key.startsWith("enemy") ? bundle.enemyActiveSkills : bundle.activeSkills;
          if (!Object.hasOwn(skillSection ?? {}, skillId)) {
            bag.add(`contentBundle.coreActions.${key}.${reach}`, "dangling_reference", `no such active skill: ${skillId}`);
          }
        }
      }
    }
  }

  for (const [id, skill] of Object.entries(bundle.reactiveSkills)) {
    const path = `reactiveSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireTags(bag, `${path}.tags`, skill.tags);
    if (skill.replacesReactiveSkillIds !== undefined
      && requireArray(bag, `${path}.replacesReactiveSkillIds`, skill.replacesReactiveSkillIds)) {
      for (const [index, replacedId] of skill.replacesReactiveSkillIds.entries()) {
        if (!Object.hasOwn(bundle.reactiveSkills, replacedId)) {
          bag.add(`${path}.replacesReactiveSkillIds[${index}]`, "dangling_reference",
            `no such reactive skill: ${replacedId}`);
        }
        if (replacedId === id) {
          bag.add(`${path}.replacesReactiveSkillIds[${index}]`, "self_replacement",
            "a reactive skill cannot replace itself");
        }
      }
    }
    const hasRule = skill.rule !== undefined;
    const hasRules = skill.rules !== undefined;
    if (hasRule === hasRules) {
      bag.add(path, "bad_skill_rules", "give exactly one of rule or rules");
    } else if (hasRule) {
      validateRule(bag, `${path}.rule`, skill.rule, baseCtx);
    } else if (requireArray(bag, `${path}.rules`, skill.rules, { min: 1 })) {
      skill.rules.forEach((rule, index) => validateRule(bag, `${path}.rules[${index}]`, rule, baseCtx));
    }
  }

  for (const [id, skill] of Object.entries(bundle.enemyReactiveSkills ?? {})) {
    const path = `enemyReactiveSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireTags(bag, `${path}.tags`, skill.tags);
    const hasRule = skill.rule !== undefined;
    const hasRules = skill.rules !== undefined;
    if (hasRule === hasRules) {
      bag.add(path, "bad_skill_rules", "give exactly one of rule or rules");
    } else if (hasRule) {
      validateRule(bag, `${path}.rule`, skill.rule, baseCtx);
    } else if (requireArray(bag, `${path}.rules`, skill.rules, { min: 1 })) {
      skill.rules.forEach((rule, index) => validateRule(bag, `${path}.rules[${index}]`, rule, baseCtx));
    }
  }

  // Enemy passive skills are intentionally an independent namespace. The
  // current enemy roster has none, but validating the section prevents a
  // future enemy passive from silently resolving through player content.
  for (const [id, skill] of Object.entries(bundle.enemyPassiveSkills ?? {})) {
    const path = `enemyPassiveSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireTags(bag, `${path}.tags`, skill.tags);
    const hasRule = skill.rule !== undefined;
    const hasRules = skill.rules !== undefined;
    if (hasRule && hasRules) {
      bag.add(path, "bad_skill_rules", "give at most one of rule or rules");
    }
    if (hasRule) validateRule(bag, `${path}.rule`, skill.rule, baseCtx);
    if (hasRules && requireArray(bag, `${path}.rules`, skill.rules, { min: 1 })) {
      skill.rules.forEach((rule, index) => validateRule(bag, `${path}.rules[${index}]`, rule, baseCtx));
    }
    if (skill.statBonus === undefined && !hasRule && !hasRules) {
      bag.add(path, "inert_passive", "a passive needs a statBonus, rule, or rules");
    }
  }

  // R6 §6.8 — PHASE A. passive は「定数で押し上げる」か「常時ある rule」の
  // どちらか、あるいは両方。**どちらも無い passive は装着しても何も起きない**ので拒否する。
  for (const [id, skill] of Object.entries(bundle.passiveSkills)) {
    const path = `passiveSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireTags(bag, `${path}.tags`, skill.tags);
    if (skill.replacesPassiveSkillIds !== undefined
      && requireArray(bag, `${path}.replacesPassiveSkillIds`, skill.replacesPassiveSkillIds)) {
      for (const [index, replacedId] of skill.replacesPassiveSkillIds.entries()) {
        if (!Object.hasOwn(bundle.passiveSkills, replacedId)) {
          bag.add(`${path}.replacesPassiveSkillIds[${index}]`, "dangling_reference",
            `no such passive skill: ${replacedId}`);
        }
        if (replacedId === id) {
          bag.add(`${path}.replacesPassiveSkillIds[${index}]`, "self_replacement",
            "a passive cannot replace itself");
        }
      }
    }
    const bonus = skill.statBonus;
    if (bonus !== undefined) {
      if (!isPlainObject(bonus)) {
        bag.add(`${path}.statBonus`, "not_an_object", "expected a stat bonus record");
      } else {
        for (const [stat, value] of Object.entries(bonus)) {
          requireOneOf(bag, `${path}.statBonus.${stat}`, stat, PASSIVE_STAT_BONUSES, "unknown_passive_stat");
          requireCount(bag, `${path}.statBonus.${stat}`, value, { min: 1, max: 1_000 });
        }
      }
    }
    const perLevel = skill.statBonusPerLevel;
    if (perLevel !== undefined) {
      if (!isPlainObject(perLevel)) {
        bag.add(`${path}.statBonusPerLevel`, "not_an_object", "expected a stat bonus growth record");
      } else {
        for (const [stat, value] of Object.entries(perLevel)) {
          requireOneOf(
            bag, `${path}.statBonusPerLevel.${stat}`, stat,
            PASSIVE_STAT_BONUSES, "unknown_passive_stat",
          );
          requireCount(bag, `${path}.statBonusPerLevel.${stat}`, value, { min: 1, max: 1_000 });
          if (!Object.hasOwn(bonus ?? {}, stat)) {
            bag.add(
              `${path}.statBonusPerLevel.${stat}`,
              "missing_base_stat_bonus",
              "a per-level stat bonus needs the same stat in statBonus",
            );
          }
        }
      }
    }
    const hasRule = skill.rule !== undefined;
    const hasRules = skill.rules !== undefined;
    if (hasRule && hasRules) {
      bag.add(path, "bad_skill_rules", "give at most one of rule or rules");
    }
    if (hasRule) validateRule(bag, `${path}.rule`, skill.rule, baseCtx);
    if (hasRules && requireArray(bag, `${path}.rules`, skill.rules, { min: 1 })) {
      skill.rules.forEach((rule, index) => validateRule(bag, `${path}.rules[${index}]`, rule, baseCtx));
    }
    if (skill.statBonus === undefined && !hasRule && !hasRules) {
      bag.add(path, "inert_passive", "a passive needs a statBonus, rule, or rules");
    }
  }

  for (const [id, item] of Object.entries(bundle.equipment)) {
    const path = `equipment.${id}`;
    requireDisplayName(bag, `${path}.displayName`, item.displayName);
    requireCount(bag, `${path}.maxDurability`, item.maxDurability, { min: 1 });
    requireTags(bag, `${path}.tags`, item.tags);
    if (item.statBonus !== undefined) {
      if (!isPlainObject(item.statBonus)) {
        bag.add(`${path}.statBonus`, "not_an_object", "expected a stat bonus record");
      } else {
        for (const [stat, value] of Object.entries(item.statBonus)) {
          requireOneOf(bag, `${path}.statBonus.${stat}`, stat, PASSIVE_STAT_BONUSES, "unknown_equipment_stat");
          requireCount(bag, `${path}.statBonus.${stat}`, value, { min: 1, max: 1_000 });
        }
      }
    }
    validateRules(bag, `${path}.rules`, item.rules, { ...baseCtx, fromEquipment: true });
  }

  for (const [id, status] of Object.entries(bundle.statuses)) {
    const path = `statuses.${id}`;
    requireDisplayName(bag, `${path}.displayName`, status.displayName);
    requireOneOf(bag, `${path}.polarity`, status.polarity, STATUS_POLARITIES, "unknown_polarity");
    if (status.maxStacks !== "unbounded") {
      requireCount(bag, `${path}.maxStacks`, status.maxStacks, { min: 1 });
    }
    requireOneOf(bag, `${path}.duration`, status.duration, DURATIONS, "unknown_duration");
    if (status.decayAtRoundEnd !== undefined && typeof status.decayAtRoundEnd !== "boolean") {
      bag.add(`${path}.decayAtRoundEnd`, "bad_boolean", "decayAtRoundEnd must be a boolean");
    }
    if (status.decayAtRoundEnd && status.duration !== "battle") {
      bag.add(`${path}.decayAtRoundEnd`, "decay_needs_battle_duration",
        "round-end decay statuses use battle duration");
    }
    if (status.durationRounds !== undefined) {
      requireCount(bag, `${path}.durationRounds`, status.durationRounds, { min: 1, max: 99 });
      if (status.duration !== "round") {
        bag.add(`${path}.durationRounds`, "duration_rounds_without_round", "durationRounds needs duration: round");
      }
    }
    if (status.guardBonusPerStack !== undefined
      && (!Number.isSafeInteger(status.guardBonusPerStack)
        || status.guardBonusPerStack < -1_000 || status.guardBonusPerStack > 1_000)) {
      bag.add(`${path}.guardBonusPerStack`, "bad_guard_bonus",
        "guardBonusPerStack must be an integer from -1000 to 1000");
    }
    requireTags(bag, `${path}.tags`, status.tags);
    validateRules(bag, `${path}.rules`, status.rules, baseCtx);
  }

  for (const [id, enemy] of Object.entries(bundle.enemyActors)) {
    const path = `enemyActors.${id}`;
    rejectRemovedSpeedKey(bag, path, enemy);
    requireDisplayName(bag, `${path}.displayName`, enemy.displayName);
    requireCount(bag, `${path}.maxHp`, enemy.maxHp, { min: 1 });
    requireCount(bag, `${path}.baseActionPoints`, enemy.baseActionPoints, { min: 0 });
    requireCount(bag, `${path}.baseReactionPoints`, enemy.baseReactionPoints, { min: 0 });
    requireTags(bag, `${path}.tags`, enemy.tags);
    validateTactics(
      bag,
      `${path}.tactics`,
      enemy.tactics,
      bundle,
      baseCtx,
      bundle.enemyActiveSkills ?? bundle.activeSkills,
    );
    validateReactiveSkillIds(
      bag,
      `${path}.reactiveSkillIds`,
      enemy.reactiveSkillIds,
      bundle,
      bundle.enemyReactiveSkills ?? bundle.reactiveSkills,
    );
    validateRules(bag, `${path}.intrinsicRules`, enemy.intrinsicRules, baseCtx);
  }

  return bag.list;
}

const HISTORY_METRIC_NAMES = [
  "active_actions",
  "reactive_actions",
  "different_targets",
  "same_target_streak",
  "times_moved",
  "damage_dealt",
  "damage_taken",
  "healing_done",
  "excess_damage",
  "excess_healing",
  "unused_action_points",
  "unused_reaction_points",
];
const HISTORY_WINDOW_NAMES = ["chain", "round", "battle"];

// §5.3 — tactics are the player's priority list: at most two, each with at most
// two useWhen conditions, and useWhen may only read the actor's own state.
function validateTactics(bag, path, tactics, bundle, ctx, activeSection = bundle.activeSkills) {
  if (!requireArray(bag, path, tactics, { max: LIMITS.maxTactics })) return;
  tactics.forEach((tactic, index) => {
    const tacticPath = `${path}[${index}]`;
    if (!isPlainObject(tactic)) {
      bag.add(tacticPath, "not_an_object", "expected a tactic object");
      return;
    }
    if (!isValidId(tactic.activeSkillId)) {
      bag.add(`${tacticPath}.activeSkillId`, "bad_id", "not a valid id");
    } else if (!Object.hasOwn(activeSection, tactic.activeSkillId)) {
      bag.add(`${tacticPath}.activeSkillId`, "dangling_reference", `no such active skill: ${tactic.activeSkillId}`);
    }
    validatePredicates(bag, `${tacticPath}.useWhen`, tactic.useWhen, {
      ...ctx,
      allowedPredicateTypes: USE_WHEN_PREDICATE_TYPES,
      allowedSubjects: USE_WHEN_SUBJECTS,
      ownerless: false,
    }, { max: LIMITS.maxUseWhen });
  });
}

function validatePassiveSkillIds(bag, path, ids, bundle) {
  if (ids === undefined) return;
  if (!requireArray(bag, path, ids, { max: LIMITS.maxPassiveSkills })) return;
  const seen = new Set();
  ids.forEach((id, index) => {
    const idPath = `${path}[${index}]`;
    if (!isValidId(id)) {
      bag.add(idPath, "bad_id", "not a valid id");
      return;
    }
    if (!Object.hasOwn(bundle.passiveSkills, id)) {
      bag.add(idPath, "dangling_reference", `no such passive skill: ${id}`);
    }
    if (seen.has(id)) bag.add(idPath, "duplicate_reference", `passive skill listed twice: ${id}`);
    seen.add(id);
  });
}

function validateReactiveSkillIds(bag, path, ids, bundle, reactiveSection = bundle.reactiveSkills) {
  if (!requireArray(bag, path, ids, { max: LIMITS.maxReactiveSkills })) return;
  const seen = new Set();
  ids.forEach((id, index) => {
    const idPath = `${path}[${index}]`;
    if (!isValidId(id)) {
      bag.add(idPath, "bad_id", "not a valid id");
      return;
    }
    if (!Object.hasOwn(reactiveSection, id)) {
      bag.add(idPath, "dangling_reference", `no such reactive skill: ${id}`);
    }
    if (seen.has(id)) bag.add(idPath, "duplicate_reference", `reactive skill listed twice: ${id}`);
    seen.add(id);
  });
}

function validateTargetSkillIds(bag, path, ids, bundle) {
  if (ids === undefined) return;
  if (!requireArray(bag, path, ids, { max: LIMITS.maxTargetSkills })) return;
  const seen = new Set();
  ids.forEach((id, index) => {
    const idPath = `${path}[${index}]`;
    if (!isValidId(id)) {
      bag.add(idPath, "bad_id", "not a valid id");
      return;
    }
    if (!Object.hasOwn(bundle.targetSkills, id)) {
      bag.add(idPath, "dangling_reference", `no such target skill: ${id}`);
    }
    if (seen.has(id)) bag.add(idPath, "duplicate_reference", `target skill listed twice: ${id}`);
    seen.add(id);
  });
}

function validateReactiveReserve(bag, path, reserve, reactiveSkillIds) {
  if (reserve === undefined) return;
  if (!isPlainObject(reserve)) {
    bag.add(path, "not_an_object", "expected a reactive skill id to RP reserve record");
    return;
  }
  const installed = new Set(reactiveSkillIds ?? []);
  for (const [skillId, amount] of Object.entries(reserve)) {
    if (!installed.has(skillId)) {
      bag.add(`${path}.${skillId}`, "dangling_reference", `reactive skill is not equipped: ${skillId}`);
    }
    requireCount(bag, `${path}.${skillId}`, amount, { min: 0, max: 99 });
  }
}

// -------------------------------------------------------------- battle input

export function validateBattleInput(input, bundle) {
  const bag = new ErrorBag();
  const weaponLoadoutBundle = Object.hasOwn(bundle ?? {}, "enemyActiveSkills");
  if (!isPlainObject(input)) {
    bag.add("battleInput", "not_an_object", "expected a battle input object");
    return bag.list;
  }
  if (input.schemaVersion !== BATTLE_SCHEMA_VERSION) {
    bag.add("battleInput.schemaVersion", "bad_schema_version", `expected ${BATTLE_SCHEMA_VERSION}`);
  }
  if (!isValidId(input.battleId)) {
    bag.add("battleInput.battleId", "bad_id", "battleId must be a valid id");
  }
  requireCount(bag, "battleInput.maxRounds", input.maxRounds, { min: 1, max: 1000 });

  validateObjective(bag, "battleInput.objective", input.objective, bundle);

  const ctx = {
    bundle,
    seenIds: null,
    ownerless: false,
    fromEquipment: false,
    historyMetrics: HISTORY_METRIC_NAMES,
    historyWindows: HISTORY_WINDOW_NAMES,
  };

  const instanceIds = new Set();
  const claimInstance = (path, id) => {
    if (!isValidId(id)) {
      bag.add(path, "bad_id", `${JSON.stringify(id)} is not a valid instance id`);
      return;
    }
    if (instanceIds.has(id)) bag.add(path, "duplicate_instance_id", `instance id already used: ${id}`);
    else instanceIds.add(id);
  };

  if (requireArray(bag, "battleInput.allies", input.allies, { max: LIMITS.maxAlliesInBattle })) {
    if (input.allies.length < LIMITS.minAlliesInBattle) {
      bag.add("battleInput.allies", "too_few", `at least ${LIMITS.minAlliesInBattle} ally`);
    }
    const positions = new Set();
    input.allies.forEach((ally, index) => {
      const path = `battleInput.allies[${index}]`;
      if (!isPlainObject(ally)) {
        bag.add(path, "not_an_object", "expected an ally input object");
        return;
      }
      claimInstance(`${path}.instanceId`, ally.instanceId);
      const character = bundle.characters[ally.characterId];
      if (!character) {
        bag.add(`${path}.characterId`, "dangling_reference", `no such character: ${ally.characterId}`);
      }
      if (requireOneOf(bag, `${path}.position`, ally.position, POSITIONS, "unknown_position")) {
        if (positions.has(ally.position)) {
          bag.add(`${path}.position`, "duplicate_position", `two allies on ${ally.position}`);
        }
        positions.add(ally.position);
      }
      // PHASE B: training raises maxHp, so the ceiling on a carried-over hp is
      // the overridden maxHp when there is one — not the definition's.
      const allyBaseMaxHp = validateStatOverride(bag, `${path}.stats`, ally.stats)
        ?? character?.maxHp;
      const allyMaxHp = Number.isFinite(allyBaseMaxHp)
        ? maxHpWithStaticBonuses(
          allyBaseMaxHp,
          bundle,
          ally.passiveSkillIds,
          ally.equipment.map((entry) => ({ ...entry, broken: entry.durability === 0 })),
        )
        : allyBaseMaxHp;
      validateTrainingRecord(bag, `${path}.training`, ally.training);
      if (ally.hp !== undefined && Number.isFinite(allyMaxHp)) {
        requireCount(bag, `${path}.hp`, ally.hp, { min: 0, max: allyMaxHp });
      }
      rejectUnknownKeys(bag, path, ally, ALLY_INPUT_KEYS);
      const hasActiveSkill = ally.activeSkillId !== undefined;
      const hasLegacyTactics = ally.tactics !== undefined;
      if (weaponLoadoutBundle && hasLegacyTactics) {
        bag.add(`${path}.tactics`, "removed_key", "player tactics rotation was removed; use activeSkillId");
      }
      if (hasActiveSkill && hasLegacyTactics) {
        bag.add(path, "ambiguous_active_loadout", "use activeSkillId or legacy tactics, not both");
      } else if (hasActiveSkill) {
        if (!isValidId(ally.activeSkillId)) {
          bag.add(`${path}.activeSkillId`, "bad_id", "not a valid id");
        } else if (!Object.hasOwn(bundle.activeSkills, ally.activeSkillId)) {
          bag.add(`${path}.activeSkillId`, "dangling_reference", `no such active skill: ${ally.activeSkillId}`);
        }
        if (ally.activeOverrideSkillId !== undefined) {
          if (!isValidId(ally.activeOverrideSkillId)) {
            bag.add(`${path}.activeOverrideSkillId`, "bad_id", "not a valid id");
          } else if (!Object.hasOwn(bundle.activeSkills, ally.activeOverrideSkillId)) {
            bag.add(
              `${path}.activeOverrideSkillId`, "dangling_reference",
              `no such active skill: ${ally.activeOverrideSkillId}`,
            );
          }
        }
      } else {
        validateTactics(bag, `${path}.tactics`, ally.tactics, bundle, ctx);
      }
      validateTargetSkillIds(bag, `${path}.targetSkillIds`, ally.targetSkillIds, bundle);
      validateReactiveSkillIds(bag, `${path}.reactiveSkillIds`, ally.reactiveSkillIds, bundle);
      validateReactiveReserve(
        bag, `${path}.reactiveReserveBySkill`, ally.reactiveReserveBySkill, ally.reactiveSkillIds,
      );
      validatePassiveSkillIds(bag, `${path}.passiveSkillIds`, ally.passiveSkillIds, bundle);
      validateEquipmentInputs(bag, `${path}.equipment`, ally.equipment, bundle, claimInstance);
    });
  }

  if (requireArray(bag, "battleInput.enemies", input.enemies, { max: LIMITS.maxEnemiesInBattle })) {
    if (input.enemies.length < LIMITS.minEnemiesInBattle) {
      bag.add("battleInput.enemies", "too_few", `at least ${LIMITS.minEnemiesInBattle} enemy`);
    }
    const positions = new Set();
    input.enemies.forEach((enemy, index) => {
      const path = `battleInput.enemies[${index}]`;
      if (!isPlainObject(enemy)) {
        bag.add(path, "not_an_object", "expected an enemy input object");
        return;
      }
      claimInstance(`${path}.instanceId`, enemy.instanceId);
      const definition = bundle.enemyActors[enemy.enemyActorId];
      if (!definition) {
        bag.add(`${path}.enemyActorId`, "dangling_reference", `no such enemy actor: ${enemy.enemyActorId}`);
      }
      if (requireOneOf(bag, `${path}.position`, enemy.position, POSITIONS, "unknown_position")) {
        if (positions.has(enemy.position)) {
          bag.add(`${path}.position`, "duplicate_position", `two enemies on ${enemy.position}`);
        }
        positions.add(enemy.position);
      }
      const enemyMaxHp = validateStatOverride(bag, `${path}.stats`, enemy.stats)
        ?? definition?.maxHp;
      validateMutationRecord(bag, `${path}.mutations`, enemy.mutations);
      if (enemy.hp !== undefined && Number.isFinite(enemyMaxHp)) {
        requireCount(bag, `${path}.hp`, enemy.hp, { min: 0, max: enemyMaxHp });
      }
      rejectUnknownKeys(bag, path, enemy, ENEMY_INPUT_KEYS);
    });
  }

  if (input.regionRules !== undefined) {
    validateRules(bag, "battleInput.regionRules", input.regionRules, { ...ctx, ownerless: true, seenIds: new Set() });
  }

  return bag.list;
}

// R6 §9.5 / §11 — PHASE B. A per-instance stat override: permanent training on
// an ally, a difficulty mutation on an enemy. **Only the four continuous stats
// may be overridden.** Letting an override reach AP or RP would buy extra turns,
// which R6 §9.5 forbids outright, and letting it reach tactics or rules would put
// content vocabulary in a save file.
//
// Returns the overridden maxHp when there is one, so the caller can use it as
// the ceiling for a carried-over hp.
function validateStatOverride(bag, path, stats) {
  if (stats === undefined) return undefined;
  if (!isPlainObject(stats)) {
    bag.add(path, "not_an_object", "expected a stat override object");
    return undefined;
  }
  for (const key of Object.keys(stats)) {
    if (!OVERRIDABLE_STATS.includes(key)) {
      bag.add(`${path}.${key}`, "unknown_stat", `${key} may not be overridden per instance`);
      continue;
    }
    requireCount(bag, `${path}.${key}`, stats[key], { min: key === "maxHp" ? 1 : 0 });
  }
  return Number.isSafeInteger(stats.maxHp) ? stats.maxHp : undefined;
}

// R6 §9.5 — the training levels that produced the override above. It is a
// record for the causal log, not an input the engine reads: the rounded values
// are already in `stats`, so a reader never has to redo the rounding.
function validateTrainingRecord(bag, path, training) {
  if (training === undefined) return;
  if (!isPlainObject(training)) {
    bag.add(path, "not_an_object", "expected a training record");
    return;
  }
  for (const key of Object.keys(training)) {
    if (!TRAINABLE_STATS.includes(key)) {
      bag.add(`${path}.${key}`, "unknown_training_stat", `${key} is not a trainable axis`);
      continue;
    }
    requireCount(bag, `${path}.${key}`, training[key], { min: 0 });
  }
}

// R6 §11.2 / §13.2 — the visible mutation ids a difficulty rank added to this
// unit. Also a record: the numbers they produced are already in `stats`, and the
// preview text comes from the mutation definition, not from the save.
function validateMutationRecord(bag, path, mutations) {
  if (mutations === undefined) return;
  if (!requireArray(bag, path, mutations, { max: 4 })) return;
  mutations.forEach((id, index) => {
    if (!isValidId(id)) bag.add(`${path}[${index}]`, "bad_id", `${JSON.stringify(id)} is not a valid id`);
  });
}

// R7 §4.3 — "validator が未知語彙を黙って無視せず拒否する". A misspelt key on a
// battle input used to resolve as "no training at all" and look like a balance
// problem. Only the two input objects Phase B grew are checked here.
const ALLY_INPUT_KEYS = Object.freeze([
  "instanceId", "characterId", "position", "hp", "activeSkillId", "activeOverrideSkillId", "tactics",
  "targetSkillIds", "reactiveSkillIds", "reactiveReserveBySkill",
  "passiveSkillIds", "equipment", "stats", "training",
]);
const ENEMY_INPUT_KEYS = Object.freeze([
  "instanceId", "enemyActorId", "position", "hp", "stats", "mutations",
]);

function rejectUnknownKeys(bag, path, value, allowed) {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    bag.add(`${path}.${key}`, "unknown_key", `${key} is not part of this input`);
  }
}

function validateEquipmentInputs(bag, path, equipment, bundle, claimInstance) {
  if (!requireArray(bag, path, equipment, { max: LIMITS.maxEquipment })) return;
  // §5.7 budgets a rule per owner per chain, so two copies of one item on one
  // actor would share a firing budget and it would take the array order to say
  // which physical copy wears out. Refuse the case rather than pick a winner;
  // whether a second copy should act twice is a design question, not an
  // implementation one (R5 §20).
  const equipmentIds = new Set();
  equipment.forEach((item, index) => {
    if (!isPlainObject(item) || !isValidId(item.equipmentId)) return;
    if (equipmentIds.has(item.equipmentId)) {
      bag.add(
        `${path}[${index}].equipmentId`,
        "duplicate_equipment",
        `one actor may not carry two of ${item.equipmentId}`,
      );
    }
    equipmentIds.add(item.equipmentId);
  });
  equipment.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(item)) {
      bag.add(itemPath, "not_an_object", "expected an equipment input object");
      return;
    }
    claimInstance(`${itemPath}.instanceId`, item.instanceId);
    const definition = bundle.equipment[item.equipmentId];
    if (!definition) {
      bag.add(`${itemPath}.equipmentId`, "dangling_reference", `no such equipment: ${item.equipmentId}`);
      return;
    }
    requireCount(bag, `${itemPath}.durability`, item.durability, { min: 0, max: definition.maxDurability });
  });
}

function validateObjective(bag, path, objective, bundle) {
  if (!isPlainObject(objective)) {
    bag.add(path, "not_an_object", "expected an objective object");
    return;
  }
  if (!requireOneOf(bag, `${path}.type`, objective.type, OBJECTIVE_TYPES, "unknown_objective")) return;
  if (objective.type === "defeat_definition") {
    // §13 — the objective names a definition, never an instance.
    if (!isValidId(objective.enemyActorId) || !Object.hasOwn(bundle.enemyActors ?? {}, objective.enemyActorId)) {
      bag.add(`${path}.enemyActorId`, "dangling_reference", `no such enemy actor: ${objective.enemyActorId}`);
    }
    requireCount(bag, `${path}.count`, objective.count, { min: 1 });
  }
  if (objective.type === "survive_rounds") {
    requireCount(bag, `${path}.rounds`, objective.rounds, { min: 1 });
  }
}
