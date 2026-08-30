// ecology/schema.mjs
//
// The whole v1 vocabulary lives here as frozen lists. Content may only use names
// that appear below; validate.mjs rejects everything else, and the engine never
// branches on an individual character, skill, equipment or enemy id.
//
// R5 sections: §5 (content schema), §6 (event types), §8 (predicates),
// §9 (target queries), §10 (costs, effects, values), §14 (limits).

const freeze = (value) => Object.freeze(value);

export const CONTENT_SCHEMA_VERSION = "ecology-content-2";
export const BATTLE_SCHEMA_VERSION = "ecology-battle-2";
export const RESULT_SCHEMA_VERSION = "ecology-result-1";
export const MINING_VERSION = "ecology-mining-1";

// R6 §5.4 — the six positions of the 2x3 field. The listed order is also the
// deterministic tie-break order, so nothing else may sort positions.
//
// PHASE A: this grew from four to six. **The two v1 rows kept their relative
// order** (front_left < front_right < rear_left < rear_right), so every existing
// position_asc sort resolves exactly as before; only the indices shifted, and no
// index is persisted anywhere — save, D1 and content all store the string id.
export const POSITIONS = freeze([
  "front_left", "front_center", "front_right",
  "rear_left", "rear_center", "rear_right",
]);
export const POSITION_ORDER = freeze(
  Object.fromEntries(POSITIONS.map((position, index) => [position, index])),
);
export const POSITION_ROW = freeze({
  front_left: "front",
  front_center: "front",
  front_right: "front",
  rear_left: "rear",
  rear_center: "rear",
  rear_right: "rear",
});
// R6 §5.4 — column attacks hit the same column front and rear, so the column of
// a position is vocabulary, not something a caller may derive from the id text.
export const POSITION_COLUMN = freeze({
  front_left: "left",
  front_center: "center",
  front_right: "right",
  rear_left: "left",
  rear_center: "center",
  rear_right: "right",
});
export const ROWS = freeze(["front", "rear"]);
export const COLUMNS = freeze(["left", "center", "right"]);

export const SIDES = freeze(["ally", "enemy"]);

// §6 — implemented event types. Anything outside this list is unknown.
export const EVENT_TYPES = freeze([
  // §6.1 battle and round
  "battle_started",
  "round_started",
  "actor_activated",
  "round_ended",
  "battle_ended",
  // §6.2 action
  "action_declared",
  "target_selected",
  "target_changed",
  "action_cost_paid",
  "action_started",
  "action_resolved",
  "action_skipped",
  "action_canceled",
  // §6.3 preparation
  "preparation_started",
  "preparation_advanced",
  "preparation_completed",
  "preparation_interrupted",
  // §6.4 hp and barrier
  "damage_proposed",
  "barrier_damaged",
  "barrier_broken",
  "damage_taken",
  "excess_damage",
  "healing_proposed",
  "healing_applied",
  "excess_healing",
  "barrier_proposed",
  "barrier_gained",
  "barrier_expired",
  "actor_defeated",
  // §6.5 resources, position, status, equipment
  "resource_refreshed",
  "resource_spent",
  "resource_gained",
  "resource_unused",
  "actor_moved",
  "status_added",
  "status_removed",
  "equipment_worn",
  "equipment_broken",
  "equipment_repaired",
  // R6 §6.7 — block. A charge stops one whole damage instance and is spent.
  // PHASE A: added with the mechanic, not reserved ahead of it.
  "block_proposed",
  "block_gained",
  "damage_blocked",
  "block_spent",
  // Emitted when an interrupt rule changes a pending damage, healing or barrier
  // amount. It is a record, not a hook: nothing may listen to it (see below).
  "pending_amount_modified",
]);

// §6 — reserved for later mechanics packs. Referencing one is a validator error,
// not a silent no-op, so a rule written against a future event cannot sit dead.
export const RESERVED_EVENT_TYPES = freeze([
  "wave_started",
  "defeat_prevented",
  "actor_revived",
  "action_repeated",
  "frontline_opened",
]);

// §11.2-3 — the refresh is recorded but is not a reaction hook in v1. A rule that
// listens to it could never fire, so the validator rejects it (PREFLIGHT §11).
// A rule that listened to pending_amount_modified would react inside somebody
// else's interrupt window, so it stays a record only, like the refresh.
export const NON_LISTENABLE_EVENT_TYPES = freeze(["resource_refreshed", "pending_amount_modified"]);

// §11.5 — interrupt rules may only listen to events that carry a pending frame.
export const PENDING_ACTION_EVENT_TYPES = freeze(["action_declared", "target_selected"]);
export const PENDING_AMOUNT_EVENT_TYPES = freeze([
  "damage_proposed",
  "healing_proposed",
  // DEVIATION (PREFLIGHT §14): §6 does not list a barrier proposal, but §15.4
  // requires a status that raises "the next damage, healing or barrier amount".
  // Without this event the barrier third of that fixture cannot exist.
  "barrier_proposed",
]);
export const INTERRUPTIBLE_EVENT_TYPES = freeze([
  ...PENDING_ACTION_EVENT_TYPES,
  ...PENDING_AMOUNT_EVENT_TYPES,
]);

export const RULE_TIMINGS = freeze(["interrupt", "after"]);
export const LIMIT_SCOPES = freeze(["chain", "round", "battle"]);

// §8 — predicates.
export const PREDICATE_TYPES = freeze([
  "always",
  "hp_percent",
  "resource",
  "position",
  "has_status",
  "is_preparing",
  "event_tag",
  "event_value",
  "history_count",
  "target_exists",
  "round_number",
]);

export const COMPARISON_OPS = freeze(["eq", "ne", "lt", "lte", "gt", "gte"]);

export const SUBJECTS = freeze([
  "self",
  "event_source",
  "event_primary_target",
  "selected_target",
  "candidate_target",
]);

// §8 — the subset a player may write inside TacticDef.useWhen. Event-scoped
// subjects stay content-only, so a loadout can never read another actor's event.
export const USE_WHEN_PREDICATE_TYPES = freeze([
  "hp_percent",
  "resource",
  "position",
  "has_status",
  "is_preparing",
  "history_count",
  "round_number",
]);
export const USE_WHEN_SUBJECTS = freeze(["self"]);

export const RESOURCE_NAMES = freeze(["action_points", "reaction_points"]);

// §8 — history_count.
export const HISTORY_METRICS = freeze([
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
]);
export const HISTORY_WINDOWS = freeze(["chain", "round", "battle"]);

// §9 — target queries.
export const TARGET_SCOPES = freeze([
  "self",
  "allies",
  "enemies",
  "event_source",
  "event_targets",
]);
export const TARGET_FILTER_TYPES = freeze([
  "alive",
  "row_is",
  "hp_percent",
  "has_status",
  "is_preparing",
  "not_previous_target",
  "is_event_primary_target",
  // DEVIATION (PREFLIGHT §1): symmetric partner of is_event_primary_target.
  // Without it, "the actor who caused this event is me" is unwritable in v1 and
  // the §15.4 empowering status double-applies when two actors hold it.
  "is_event_source",
]);
export const TARGET_SORT_TYPES = freeze([
  "hp_asc",
  "hp_desc",
  "barrier_asc",
  "barrier_desc",
  "speed_asc",
  "speed_desc",
  "position_asc",
  "instance_id_asc",
]);
// §9 — appended to every sort so no tie survives into take: 1.
export const IMPLICIT_SORTS = freeze(["position_asc", "instance_id_asc"]);
export const TAKE_VALUES = freeze([1, "all"]);

// §10.1 — costs.
export const COST_TYPES = freeze([
  "spend_action_points",
  "spend_reaction_points",
  "lose_hp",
  "consume_barrier",
  "wear_equipment",
]);

// §10.2 — effects.
export const EFFECT_TYPES = freeze([
  "deal_damage",
  "heal",
  "gain_barrier",
  "gain_resource",
  "add_status",
  "remove_status",
  "swap_positions",
  "start_preparation",
  "advance_preparation",
  "interrupt_preparation",
  "wear_equipment",
  // DEVIATION (PREFLIGHT §16): the partner of wear_equipment. §15.3 asks for an
  // item that repairs itself and §10.2 has no way to raise durability.
  "repair_equipment",
  "modify_pending_amount",
  "redirect_pending_target",
  "cancel_pending_action",
  // R6 §6.7 — PHASE A. Block charges are a small integer, not a pool of points.
  "gain_block",
]);

// R6 §5.4 / §6.7 — PHASE A. How a damage effect spreads and how far it reaches.
// Absent means single / unrestricted, which is exactly v1 behaviour.
// PHASE A implements three of R6's five. splash and all arrive with their
// implementation in a later phase; listing them here now would let content
// reference a pattern the engine silently treats as single.
export const TARGET_PATTERNS = freeze(["single", "row", "column"]);
export const REACHES = freeze(["melee", "ranged", "unrestricted"]);

// §11.4 — usable only from interrupt-timing rules.
export const INTERRUPT_ONLY_EFFECT_TYPES = freeze([
  "modify_pending_amount",
  "redirect_pending_target",
  "cancel_pending_action",
]);
// Which pending frame each interrupt-only effect needs.
export const PENDING_ACTION_EFFECT_TYPES = freeze([
  "redirect_pending_target",
  "cancel_pending_action",
]);
export const PENDING_AMOUNT_EFFECT_TYPES = freeze([
  "modify_pending_amount",
  "redirect_pending_target",
]);

export const PENDING_AMOUNT_OPERATIONS = freeze(["increase", "decrease", "set"]);

// §10.3 — value definitions.
export const VALUE_TYPES = freeze([
  "constant",
  "event_value_scaled",
  "actor_stat_scaled",
  "status_stacks_scaled",
  // R6 §4.4 — PHASE A. flat + roundHalfUp(stat * coefficientBps / 10_000).
  // Kept separate from actor_stat_scaled because that one floors and has no
  // flat term; changing it would move every existing fixture amount.
  "stat_scaled",
]);
export const ACTOR_STATS = freeze([
  "max_hp",
  "current_hp",
  "barrier",
  "action_points",
  "reaction_points",
  "speed",
  // R6 §4.4 — PHASE A. might drives weapon damage, focus drives technique
  // damage, healing and barrier, guard is flat per-hit reduction of direct
  // damage. Every actor carries all three, so a support role still has an
  // attack axis and a weapon role still has support scaling.
  "might",
  "focus",
  "guard",
  "block",
]);

// R6 §4.4 — the stats an amount may scale from. Deliberately narrower than
// ACTOR_STATS: scaling off current_hp or barrier makes an amount that swings
// mid-chain, which the causal log cannot explain.
export const SCALING_STATS = freeze(["might", "focus", "max_hp"]);

export const DURATIONS = freeze(["turn", "round", "battle"]);
export const BARRIER_DURATIONS = freeze(["round", "battle"]);
export const STATUS_POLARITIES = freeze(["positive", "negative", "neutral"]);

// §13 — objectives.
export const OBJECTIVE_TYPES = freeze([
  "eliminate_all_enemies",
  "defeat_definition",
  "survive_rounds",
]);

export const BATTLE_RESULTS = freeze(["win", "loss", "draw"]);
export const BATTLE_REASONS = freeze([
  "objective_met",
  "all_allies_defeated",
  "round_limit",
  "stalemate",
]);

// §5.3, §5.5, §5.7 — structural limits that content may not exceed.
export const LIMITS = freeze({
  maxAlliesInCampaign: 4,
  maxAlliesInBattle: 4,
  minAlliesInBattle: 1,
  maxEnemiesInBattle: 4,
  minEnemiesInBattle: 1,
  maxTactics: 2,
  maxUseWhen: 2,
  maxReactiveSkills: 2,
  maxEquipment: 2,
  minPreparationSteps: 1,
  maxPreparationSteps: 3,
  minPriority: 0,
  maxPriority: 1000,
});

// §14 — default safety options.
export const DEFAULT_OPTIONS = freeze({
  maxEventsPerChain: 256,
  maxEventsPerBattle: 4096,
  maxActivationsPerActorPerRound: 8,
});

// §5.1 — ids are ASCII lower_snake_case, optionally dot separated.
export const ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export function isValidId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 64 && ID_PATTERN.test(value);
}

export function isSafeCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function comparePosition(a, b) {
  return POSITION_ORDER[a] - POSITION_ORDER[b];
}

export function compareOp(op, left, right) {
  switch (op) {
    case "eq": return left === right;
    case "ne": return left !== right;
    case "lt": return left < right;
    case "lte": return left <= right;
    case "gt": return left > right;
    case "gte": return left >= right;
    default: throw new Error(`unknown comparison operator: ${op}`);
  }
}
