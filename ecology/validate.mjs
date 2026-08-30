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
  INTERRUPTIBLE_EVENT_TYPES,
  INTERRUPT_ONLY_EFFECT_TYPES,
  LIMITS,
  LIMIT_SCOPES,
  NON_LISTENABLE_EVENT_TYPES,
  OBJECTIVE_TYPES,
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
      break;
    case "status_stacks_scaled":
      validateSubject(bag, `${path}.subject`, value.subject, ctx);
      requireStatusReference(bag, `${path}.statusId`, value.statusId, ctx);
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
      requireOneOf(bag, `${path}.sort[${index}]`, sort, TARGET_SORT_TYPES, "unknown_target_sort");
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
    case "hp_percent":
      requireOneOf(bag, `${path}.op`, filter.op, COMPARISON_OPS, "unknown_operator");
      requireCount(bag, `${path}.value`, filter.value, { min: 0, max: 100 });
      break;
    case "has_status":
      requireStatusReference(bag, `${path}.statusId`, filter.statusId, ctx);
      if (filter.op !== undefined) requireOneOf(bag, `${path}.op`, filter.op, COMPARISON_OPS, "unknown_operator");
      if (filter.value !== undefined) requireCount(bag, `${path}.value`, filter.value, { min: 0 });
      break;
    case "is_preparing":
      if (typeof filter.value !== "boolean") {
        bag.add(`${path}.value`, "bad_boolean", "is_preparing.value must be a boolean");
      }
      break;
    case "not_previous_target":
    case "is_event_primary_target":
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
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      if (effect.tags !== undefined) requireTags(bag, `${path}.tags`, effect.tags);
      // R6 §6.7 — PHASE A. 省略時は hit 1・貫通0・single・unrestricted で、
      // それは v1 の挙動そのもの。**既存定義は書き換えなくてよい。**
      if (effect.hitCount !== undefined) {
        requireCount(bag, `${path}.hitCount`, effect.hitCount, { min: 1, max: 8 });
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
      // **範囲攻撃は take: 1 から広げる。** take: "all" と組み合わせると、
      // どの一体を基点に広げたのかが決まらない。
      if (effect.targetPattern && effect.targetPattern !== "single" && effect.target?.take !== 1) {
        bag.add(`${path}.targetPattern`, "pattern_needs_single_anchor",
          `${effect.targetPattern} spreads from one anchor, so target.take must be 1`);
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
      break;
    // R6 §6.7 — PHASE A. block は charge（回数）なので離散量。
    case "gain_block":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      break;
    case "gain_resource":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx);
      validateValue(bag, `${path}.amount`, effect.amount, ctx);
      requireOneOf(bag, `${path}.resource`, effect.resource, RESOURCE_NAMES, "unknown_resource");
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
      break;
    case "swap_positions":
      validateTargetQuery(bag, `${path}.target`, effect.target, ctx, { take: 1 });
      validateTargetQuery(bag, `${path}.otherTarget`, effect.otherTarget, ctx, { take: 1 });
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
}

function validateRules(bag, path, rules, ctx) {
  if (!requireArray(bag, path, rules)) return;
  rules.forEach((rule, index) => validateRule(bag, `${path}[${index}]`, rule, ctx));
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
  const sections = ["characters", "activeSkills", "reactiveSkills", "passiveSkills", "equipment", "statuses", "enemyActors"];
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
    requireDisplayName(bag, `${path}.displayName`, character.displayName);
    requireCount(bag, `${path}.maxHp`, character.maxHp, { min: 1 });
    requireCount(bag, `${path}.speed`, character.speed, { min: 0 });
    requireCount(bag, `${path}.baseActionPoints`, character.baseActionPoints, { min: 0 });
    requireCount(bag, `${path}.baseReactionPoints`, character.baseReactionPoints, { min: 0 });
    // R6 §6.4 — basic strike の届き方は人物ごと。省略時は unrestricted。
    if (character.basicStrikeReach !== undefined) {
      requireOneOf(bag, `${path}.basicStrikeReach`, character.basicStrikeReach, REACHES, "unknown_reach");
    }
    requireTags(bag, `${path}.tags`, character.tags);
    validateRules(bag, `${path}.signatureRules`, character.signatureRules, baseCtx);
  }

  for (const [id, skill] of Object.entries(bundle.activeSkills)) {
    const path = `activeSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireCount(bag, `${path}.apCost`, skill.apCost, { min: 0 });
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
          if (!Object.hasOwn(bundle.activeSkills, skillId)) {
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
    validateRule(bag, `${path}.rule`, skill.rule, baseCtx);
  }

  // R6 §6.8 — PHASE A. passive は「定数で押し上げる」か「常時ある rule」の
  // どちらか、あるいは両方。**どちらも無い passive は装着しても何も起きない**ので拒否する。
  for (const [id, skill] of Object.entries(bundle.passiveSkills)) {
    const path = `passiveSkills.${id}`;
    requireDisplayName(bag, `${path}.displayName`, skill.displayName);
    requireTags(bag, `${path}.tags`, skill.tags);
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
    if (skill.rule !== undefined) validateRule(bag, `${path}.rule`, skill.rule, baseCtx);
    if (skill.statBonus === undefined && skill.rule === undefined) {
      bag.add(path, "inert_passive", "a passive needs a statBonus, a rule, or both");
    }
  }

  for (const [id, item] of Object.entries(bundle.equipment)) {
    const path = `equipment.${id}`;
    requireDisplayName(bag, `${path}.displayName`, item.displayName);
    requireCount(bag, `${path}.maxDurability`, item.maxDurability, { min: 1 });
    requireTags(bag, `${path}.tags`, item.tags);
    validateRules(bag, `${path}.rules`, item.rules, { ...baseCtx, fromEquipment: true });
  }

  for (const [id, status] of Object.entries(bundle.statuses)) {
    const path = `statuses.${id}`;
    requireDisplayName(bag, `${path}.displayName`, status.displayName);
    requireOneOf(bag, `${path}.polarity`, status.polarity, STATUS_POLARITIES, "unknown_polarity");
    requireCount(bag, `${path}.maxStacks`, status.maxStacks, { min: 1 });
    requireOneOf(bag, `${path}.duration`, status.duration, DURATIONS, "unknown_duration");
    requireTags(bag, `${path}.tags`, status.tags);
    validateRules(bag, `${path}.rules`, status.rules, baseCtx);
  }

  for (const [id, enemy] of Object.entries(bundle.enemyActors)) {
    const path = `enemyActors.${id}`;
    requireDisplayName(bag, `${path}.displayName`, enemy.displayName);
    requireCount(bag, `${path}.maxHp`, enemy.maxHp, { min: 1 });
    requireCount(bag, `${path}.speed`, enemy.speed, { min: 0 });
    requireCount(bag, `${path}.baseActionPoints`, enemy.baseActionPoints, { min: 0 });
    requireCount(bag, `${path}.baseReactionPoints`, enemy.baseReactionPoints, { min: 0 });
    requireTags(bag, `${path}.tags`, enemy.tags);
    validateTactics(bag, `${path}.tactics`, enemy.tactics, bundle, baseCtx);
    validateReactiveSkillIds(bag, `${path}.reactiveSkillIds`, enemy.reactiveSkillIds, bundle);
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
function validateTactics(bag, path, tactics, bundle, ctx) {
  if (!requireArray(bag, path, tactics, { max: LIMITS.maxTactics })) return;
  tactics.forEach((tactic, index) => {
    const tacticPath = `${path}[${index}]`;
    if (!isPlainObject(tactic)) {
      bag.add(tacticPath, "not_an_object", "expected a tactic object");
      return;
    }
    if (!isValidId(tactic.activeSkillId)) {
      bag.add(`${tacticPath}.activeSkillId`, "bad_id", "not a valid id");
    } else if (!Object.hasOwn(bundle.activeSkills, tactic.activeSkillId)) {
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

function validateReactiveSkillIds(bag, path, ids, bundle) {
  if (!requireArray(bag, path, ids, { max: LIMITS.maxReactiveSkills })) return;
  const seen = new Set();
  ids.forEach((id, index) => {
    const idPath = `${path}[${index}]`;
    if (!isValidId(id)) {
      bag.add(idPath, "bad_id", "not a valid id");
      return;
    }
    if (!Object.hasOwn(bundle.reactiveSkills, id)) {
      bag.add(idPath, "dangling_reference", `no such reactive skill: ${id}`);
    }
    if (seen.has(id)) bag.add(idPath, "duplicate_reference", `reactive skill listed twice: ${id}`);
    seen.add(id);
  });
}

// -------------------------------------------------------------- battle input

export function validateBattleInput(input, bundle) {
  const bag = new ErrorBag();
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
      if (ally.hp !== undefined && character) {
        requireCount(bag, `${path}.hp`, ally.hp, { min: 0, max: character.maxHp });
      }
      validateTactics(bag, `${path}.tactics`, ally.tactics, bundle, ctx);
      validateReactiveSkillIds(bag, `${path}.reactiveSkillIds`, ally.reactiveSkillIds, bundle);
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
      if (enemy.hp !== undefined && definition) {
        requireCount(bag, `${path}.hp`, enemy.hp, { min: 0, max: definition.maxHp });
      }
    });
  }

  if (input.regionRules !== undefined) {
    validateRules(bag, "battleInput.regionRules", input.regionRules, { ...ctx, ownerless: true, seenIds: new Set() });
  }

  return bag.list;
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
