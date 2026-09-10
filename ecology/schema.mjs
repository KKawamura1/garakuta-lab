// ecology/schema.mjs
//
// The whole v1 vocabulary lives here as frozen lists. Content may only use names
// that appear below; validate.mjs rejects everything else, and the engine never
// branches on an individual character, skill, equipment or enemy id.
//
// R5 sections: §5 (content schema), §6 (event types), §8 (predicates),
// §9 (target queries), §10 (costs, effects, values), §14 (limits).

const freeze = (value) => Object.freeze(value);

export const CONTENT_SCHEMA_VERSION = "ecology-content-4";
// PHASE B: battle input gained an optional `stats` override on both sides
// (permanent training on allies, difficulty mutations on enemies). The addition
// is additive — an input without it resolves exactly as ecology-battle-2 did —
// but a reader that does not know the field would silently drop the training,
// so the version says out loud that the shape grew.
// R19（issue #137）— battle input gained an optional `skillLevels` map on allies
// (skill id -> level). It is additive: an input without it, or one whose every
// level is 1, resolves byte-for-byte as ecology-battle-3 did. A reader that does
// not know the field would silently drop the levels — which changes damage — so
// the version says out loud that the shape grew.
export const BATTLE_SCHEMA_VERSION = "ecology-battle-4";
// Issue #192 — result event streams now distinguish barrier absorption and a
// damage instance that lost its target. These are additive records, but a
// reader that only understands the old result shape would hide why an attack
// produced no HP loss, so the result version moves with the vocabulary.
export const RESULT_SCHEMA_VERSION = "ecology-result-3";
export const MINING_VERSION = "ecology-mining-1";

// R6 §4.1-4.2 — PHASE B. The three state layers are persisted separately, so
// each one carries its own version and its own migration.
// R8 Implementation Phase 1 — ProfileState gained `campaignProgress`; RunState
// gained `currentHp` and `campaignStageSequence`; manifests gained
// `campaignStageId`/`campaignStageSequence` provenance and a fixed (non-random)
// construction path for campaign mode. All three versions move up one.
export const PROFILE_SCHEMA_VERSION = "ecology-profile-2";
// issue #238 — RunState gained `ultimateSeals` (the party-wide, non-refilling pool
// that pays for 必殺技) and its loadout gained `ultimates` / `ultimateArmed`. A save
// without them would silently start the expedition with a full pool and no armed
// ultimate, so the version says out loud that the shape grew.
export const RUN_SCHEMA_VERSION = "ecology-run-4";
export const MANIFEST_VERSION = "ecology-manifest-2";

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
  // Issue #192 — a proposed packet can be fully absorbed without producing
  // damage_taken. The explicit result keeps that outcome observable.
  "damage_absorbed",
  // Issue #192 — a later hit in a multi-hit action may have lost its target.
  "damage_skipped",
  "barrier_damaged",
  "barrier_broken",
  "damage_taken",
  "recovery_window_closed",
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
export const NON_LISTENABLE_EVENT_TYPES = freeze([
  "resource_refreshed",
  "pending_amount_modified",
  "damage_absorbed",
  "damage_skipped",
  "recovery_window_closed",
]);

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
  // A rule owner can target an event ally without selecting itself.
  "not_self",
]);
export const TARGET_SORT_TYPES = freeze([
  "hp_asc",
  "hp_desc",
  // issue #176 — **「最も傷ついた味方」は、残りHPの小ささではない。**
  // 最大HPが 110〜300 まで開いている隊では、hp_asc は「最大HPの小さい人」を
  // 指し続ける（ツグミ 100/110 とゴウ 150/300 なら、無傷に近いツグミが選ばれる）。
  // 割合で並べる鍵をここに足して、庇護の対象を**傷の深さ**で選べるようにする。
  // 値は selectors.mjs が整数 bps（hp * 10000 / maxHp の切り捨て）で作るので、
  // 浮動小数は経路に入らない。
  "hp_percent_asc",
  "hp_percent_desc",
  "barrier_asc",
  "barrier_desc",
  "position_asc",
  "position_desc",
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

// R6 §6.4 — PHASE A. active 技能の静的な種別。攻撃テンポの保証がこれで決まる。
//   offense … 使えると判定されたら、生存敵へ direct damage を必ず作る
//   utility … 解決後に、同じ actor が威力50%の追撃を一度だけ行う
//   channel … 追撃を行わない明示的例外。溜めること自体が代償のもの
export const ACTION_MODES = freeze(["offense", "utility", "channel"]);
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

// R6 §9.5 — PHASE B. The four axes permanent training may raise, and the actor
// stat each one lands on. **AP, RP, slot counts, firing limits and target
// priority are deliberately absent**: training must not buy extra turns.
export const TRAINABLE_STATS = freeze(["might", "focus", "guard", "vitality"]);
export const TRAINING_STAT_TARGET = freeze({
  might: "might",
  focus: "focus",
  guard: "guard",
  vitality: "maxHp",
});

// R6 §4.3 / §11 — PHASE B. The stats a battle input may override per instance.
// Allies use it for permanent training, enemies for the difficulty mutations.
// AP, RP, tactics and rules stay with the definition, so an override can change
// how hard a hit lands but never how often anyone acts.
export const OVERRIDABLE_STATS = freeze(["maxHp", "might", "focus", "guard"]);

// R6 §5.1 / §11.2 — PHASE B. What one encounter of an expedition is.
export const ENCOUNTER_KINDS = freeze(["normal", "elite", "boss"]);

// R6 §6.8 — PHASE A. passive が定数で押し上げてよい stat。
// **行動回数（AP/RP）はここに無い。**毎 round の行動回数を恒常的に増やす効果は、
// 多くの面白い skill より強くなりやすい（R6 §6.8）。開始時1回だけなら
// gain_resource の rule で書けるので、語彙を増やさずに済む。
export const PASSIVE_STAT_BONUSES = freeze(["max_hp", "might", "focus", "guard"]);

// R19（issue #137）— 技能レベル。**同じ効果の上位互換を別技能として増やさず、
// 一つの技能を段階的に強くする。**
//
// レベルが上げるのは**連続量だけ**である（damage / heal / barrier と、その増減）。
// AP・RP・行動権・段数・回数・耐久は離散量なので触らない。「1段上げたら手数が
// 増える」は、多くの面白い技能より強くなりやすい（R6 §6.8 の passive と同じ理由）。
//
// Lv1 は係数 1.0 ちょうどで、**掛け算そのものが起きない**。レベルを知らない
// 入力・保存・replay は、これまでと1バイトも変わらない結果を出す。
export const MIN_SKILL_LEVEL = 1;
export const MAX_SKILL_LEVEL = 10;
// 1段ごとに +12%。Lv10 で 2.08 倍になる。**上位互換を別技能で作るより緩やかにする**
// （別技能なら装着枠を食うが、レベルは食わないので、同じ倍率だと強すぎる）。
export const SKILL_LEVEL_STEP_BPS = 1_200;

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
  // R6 §5.4 — PHASE A. 5人編成、2×3、敵も最大5。
  maxAlliesInCampaign: 5,
  maxAlliesInBattle: 5,
  minAlliesInBattle: 1,
  maxEnemiesInBattle: 5,
  minEnemiesInBattle: 1,
  // R18 — 技能の装着数にゲーム上の上限は設けない。ここは配列を壊すような
  // 極端な入力を早期に止めるための構造上限で、画面や loadout の枠数ではない。
  maxTactics: Number.MAX_SAFE_INTEGER,
  maxUseWhen: 2,
  maxReactiveSkills: Number.MAX_SAFE_INTEGER,
  maxPassiveSkills: Number.MAX_SAFE_INTEGER,
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
