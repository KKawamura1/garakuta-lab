// ecology/content/equipment-fixed.mjs
//
// **固定装備の定義。生成装備は Phase C まで作らない。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 装備 担当だけ。engine・schema・共通registryは変更しない。

import { cloneEquipment, renamed, setRuleEffectAmount } from "./base.mjs";

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
};

const equipment = renamed("equipment", EQUIPMENT_NAMES);
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

export const FIXED_EQUIPMENT = equipment;
