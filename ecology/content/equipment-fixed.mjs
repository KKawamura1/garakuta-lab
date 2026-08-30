// ecology/content/equipment-fixed.mjs
//
// **固定装備の定義。生成装備は Phase C まで作らない。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 装備 担当だけ。engine・schema・共通registryは変更しない。

import { cloneEquipment, renamed, scaleFlatAmounts, setRuleEffectAmount } from "./base.mjs";

export const EQUIPMENT_NAMES = {
  worn_greaves: "踏み込みの靴",
  splinter_edge: "棘の刃",
  field_kit: "野営道具",
  standing_plate: "継ぎはぎの盾",
  momentum_rig: "勢いの留め具",
  hungry_plate: "喰らう板",
  guard_lantern: "守り火",
  bastion_shell: "厚い継ぎ板",
  tempo_buckle: "拍子の留め具",
  quickstrap: "軽い締め具",
  reserve_coil: "予備のばね",
  focus_band: "集中の帯",
  anchor_boots: "錨の靴",
  signal_lens: "合図のレンズ",
  thorn_clasp: "返しの留め具",
  shard_hilt: "破片の柄",
  repair_pouch: "修繕袋",
  recovery_satchel: "大きな救急袋",
  block_latch: "受け止め金具",
  impact_spring: "衝撃ばね",
  wound_thread: "傷縫い糸",
  quiet_lens: "静観レンズ",
  rescue_sachet: "救急の小袋",
  last_bell: "仕留めの鈴",
};

const equipment = renamed("equipment", EQUIPMENT_NAMES);
const SELF_TARGET = { scope: "self", take: 1 };
const SELF_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
};
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
const EVENT_TARGET_IS_ENEMY = {
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
};
equipment.guard_lantern = setRuleEffectAmount(
  cloneEquipment("standing_plate", "guard_lantern", EQUIPMENT_NAMES.guard_lantern, { maxDurability: 2 }),
  1,
  "gain_barrier",
);
equipment.bastion_shell = setRuleEffectAmount(
  cloneEquipment("standing_plate", "bastion_shell", EQUIPMENT_NAMES.bastion_shell, { maxDurability: 3 }),
  3,
  "gain_barrier",
);
equipment.tempo_buckle = cloneEquipment("worn_greaves", "tempo_buckle", EQUIPMENT_NAMES.tempo_buckle, { maxDurability: 1 });
equipment.quickstrap = cloneEquipment("worn_greaves", "quickstrap", EQUIPMENT_NAMES.quickstrap, { maxDurability: 3 });
equipment.reserve_coil = cloneEquipment("worn_greaves", "reserve_coil", EQUIPMENT_NAMES.reserve_coil, { maxDurability: 4 });
equipment.focus_band = cloneEquipment("momentum_rig", "focus_band", EQUIPMENT_NAMES.focus_band, { maxDurability: 1 });
equipment.anchor_boots = cloneEquipment("momentum_rig", "anchor_boots", EQUIPMENT_NAMES.anchor_boots, { maxDurability: 3 });
equipment.signal_lens = cloneEquipment("momentum_rig", "signal_lens", EQUIPMENT_NAMES.signal_lens, { maxDurability: 4 });
equipment.thorn_clasp = cloneEquipment("splinter_edge", "thorn_clasp", EQUIPMENT_NAMES.thorn_clasp, { maxDurability: 1 });
equipment.shard_hilt = cloneEquipment("splinter_edge", "shard_hilt", EQUIPMENT_NAMES.shard_hilt, { maxDurability: 3 });
equipment.repair_pouch = cloneEquipment("field_kit", "repair_pouch", EQUIPMENT_NAMES.repair_pouch, { maxDurability: 1 });
equipment.recovery_satchel = setRuleEffectAmount(
  cloneEquipment("field_kit", "recovery_satchel", EQUIPMENT_NAMES.recovery_satchel, { maxDurability: 4 }),
  2,
  "repair_equipment",
);
equipment.block_latch = setRuleEffectAmount(cloneEquipment(
  "standing_plate",
  "block_latch",
  EQUIPMENT_NAMES.block_latch,
  { maxDurability: 2 },
), 1, "gain_barrier");
equipment.impact_spring = cloneEquipment(
  "standing_plate",
  "impact_spring",
  EQUIPMENT_NAMES.impact_spring,
  { maxDurability: 1 },
);
equipment.impact_spring.rules[0] = {
  ...equipment.impact_spring.rules[0],
  id: "impact_spring_rule",
  listenTo: "block_spent",
  predicates: [SELF_IS_EVENT_TARGET],
  costs: [{ type: "wear_equipment", amount: 1 }],
  effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: { type: "constant", value: 1 }, duration: "round" }],
  limit: { scope: "battle", count: 1 },
};
equipment.wound_thread = cloneEquipment(
  "momentum_rig",
  "wound_thread",
  EQUIPMENT_NAMES.wound_thread,
  { maxDurability: 2 },
);
equipment.wound_thread.rules[0] = {
  ...equipment.wound_thread.rules[0],
  id: "wound_thread_rule",
  listenTo: "damage_taken",
  predicates: [SELF_IS_EVENT_TARGET],
  costs: [{ type: "wear_equipment", amount: 1 }],
  effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
  limit: { scope: "round", count: 1 },
};
equipment.quiet_lens = cloneEquipment(
  "field_kit",
  "quiet_lens",
  EQUIPMENT_NAMES.quiet_lens,
  { maxDurability: 2 },
);
equipment.quiet_lens.rules[0] = {
  ...equipment.quiet_lens.rules[0],
  id: "quiet_lens_rule",
  listenTo: "resource_unused",
  predicates: [
    SELF_IS_EVENT_TARGET,
    { type: "event_tag", tag: "action_points", value: true },
    { type: "event_value", key: "amount", op: "gte", value: 1 },
  ],
  costs: [{ type: "wear_equipment", amount: 1 }],
  effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: { type: "constant", value: 1 }, duration: "round" }],
  limit: { scope: "round", count: 1 },
};
equipment.rescue_sachet = cloneEquipment(
  "field_kit",
  "rescue_sachet",
  EQUIPMENT_NAMES.rescue_sachet,
  { maxDurability: 2 },
);
equipment.rescue_sachet.rules[0] = {
  ...equipment.rescue_sachet.rules[0],
  id: "rescue_sachet_rule",
  listenTo: "healing_applied",
  predicates: [SELF_IS_EVENT_SOURCE],
  costs: [{ type: "wear_equipment", amount: 1 }],
  effects: [{ type: "gain_resource", target: SELF_TARGET, resource: "reaction_points", amount: { type: "constant", value: 1 } }],
  limit: { scope: "round", count: 1 },
};
equipment.last_bell = cloneEquipment(
  "worn_greaves",
  "last_bell",
  EQUIPMENT_NAMES.last_bell,
  { maxDurability: 1 },
);
equipment.last_bell.rules[0] = {
  ...equipment.last_bell.rules[0],
  id: "last_bell_rule",
  listenTo: "actor_defeated",
  predicates: [EVENT_TARGET_IS_ENEMY],
  costs: [{ type: "wear_equipment", amount: 1 }],
  effects: [{ type: "gain_resource", target: SELF_TARGET, resource: "action_points", amount: { type: "constant", value: 1 } }],
  limit: { scope: "battle", count: 1 },
};

// R6 §4.4 — 装備の flat roll は parameter 非依存のまま10倍する。
// **持ち主が強くなっても装備は同じだけ効く。**耐久や行動権は離散量なので触らない。
for (const definition of Object.values(equipment)) scaleFlatAmounts(definition);

export const FIXED_EQUIPMENT = equipment;

// R6 §9.3 — PHASE B. 報酬 pool は群単位で増える。**購入は pool を増やすだけで、
// 全遠征へ必ず出現させない**（買った瞬間に強くなる買い物にしない）。
// 群の切り方は表示文の「役割」欄（守り・速度・機動・攻撃・修理）と同じ。
//
// **買える群を1つだけにしてある。** 固定装備は全部で18品しかなく、
// 一遠征で報酬を選べる機会は11回ある。群を後ろに残しすぎると、
// 遠征の後半で「拾える装備がもう無い」状態になる（実測で第5戦だった）。
// 品数そのものが増えるのは Phase C の生成装備で、R6 §17.3 がそこへ置いている。
//
// `hungry_plate` はどの群にも入れない。摩耗を誘発するだけの品で、
// 報酬として出すと「拾わない」以外の答えが無い（Phase A から報酬 pool 外）。
export const EQUIPMENT_GROUPS = Object.freeze([
  Object.freeze({
    id: "group_guard", displayName: "守りの品", startsUnlocked: true, cost: "0",
    equipmentIds: Object.freeze(["standing_plate", "guard_lantern", "bastion_shell"]),
  }),
  Object.freeze({
    id: "group_tempo", displayName: "速さの品", startsUnlocked: true, cost: "0",
    equipmentIds: Object.freeze(["worn_greaves", "tempo_buckle", "quickstrap", "reserve_coil"]),
  }),
  Object.freeze({
    id: "group_edge", displayName: "刃の品", startsUnlocked: true, cost: "0",
    equipmentIds: Object.freeze(["splinter_edge", "thorn_clasp", "shard_hilt"]),
  }),
  Object.freeze({
    id: "group_mobility", displayName: "機動の品", startsUnlocked: true, cost: "0",
    equipmentIds: Object.freeze(["momentum_rig", "focus_band", "anchor_boots", "signal_lens"]),
  }),
  Object.freeze({
    id: "group_repair", displayName: "修理の品", startsUnlocked: false, cost: "12000",
    equipmentIds: Object.freeze(["field_kit", "repair_pouch", "recovery_satchel"]),
  }),
]);

// 遠征開始時に手元にある品。**買い物の対象ではなく、初期条件**。
// 5人が2枠ずつ持てるので、最初から10枠を埋められる量は渡さない。
export const STARTER_EQUIPMENT_IDS = Object.freeze([
  "standing_plate", "worn_greaves", "guard_lantern", "tempo_buckle",
]);

