// R25 — 残り6武器の入口スライス。
//
// 解禁順を manifest と UI へ先に通し、各武器のR節を同じ BattleInput 経路へ
// 接続する。19節の深い枝は、各 root の実戦語彙を検証した後に追加する。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const WOUNDED_ALLY = Object.freeze({
  scope: "allies",
  filters: [{ type: "alive" }, { type: "hp_percent", op: "lt", value: 100 }],
  sort: ["hp_percent_asc"],
  take: 1,
});
const OTHER_ALLY = Object.freeze({
  scope: "allies",
  filters: [{ type: "alive" }, { type: "not_self" }],
  sort: ["position_desc"],
  take: 1,
});
const NEAREST_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }],
  sort: ["position_asc"],
  take: 1,
});
const FARTHEST_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }],
  sort: ["position_desc"],
  take: 1,
});

const MEDICAL_TREATMENT = Object.freeze({
  id: "medical_kit_treatment",
  displayName: "応急防壁",
  displayEffect: "HP割合が最も低い味方1人に技術100%の防壁（1ラウンド）。",
  flavorText: "傷を戻すより先に、次の一撃を受け止める壁を作る。",
  weaponId: "medical_kit",
  treePosition: "R",
  apCost: 1,
  actionMode: "channel",
  intrinsicPredicates: [{ type: "target_exists", query: WOUNDED_ALLY }],
  targetQuery: WOUNDED_ALLY,
  effects: [{
    type: "gain_barrier",
    target: EVENT_TARGETS,
    amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 10_000 },
    duration: "round",
    tags: ["support", "weapon", "medical_kit"],
  }],
  tags: ["support", "weapon", "medical_kit", "playable"],
});

const TOWER_SHIELD_DRAW_GUARD = Object.freeze({
  id: "tower_shield_draw_guard",
  displayName: "守りを引く",
  displayEffect: "自分に防壁30と誘引2。誘引は敵の単体攻撃を優先して引き受ける。",
  flavorText: "狙うなら、私を。",
  weaponId: "tower_shield",
  treePosition: "R",
  apCost: 1,
  actionMode: "channel",
  intrinsicPredicates: [],
  targetQuery: SELF,
  effects: [
    {
      type: "gain_barrier",
      target: SELF,
      amount: { type: "constant", value: 30 },
      duration: "round",
    },
    { type: "add_status", target: SELF, statusId: "taunted", stacks: 2 },
  ],
  tags: ["guard", "support", "weapon", "tower_shield", "playable"],
});

const LONG_SPEAR_PIERCE = Object.freeze({
  id: "long_spear_pierce",
  displayName: "貫き突き",
  displayEffect: "直線上で最も遠い敵1体に腕力110%のダメージ。",
  flavorText: "遠いほど、穂先は真っ直ぐ届く。",
  weaponId: "long_spear",
  treePosition: "R",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: FARTHEST_ENEMY,
  effects: [{
    type: "deal_damage",
    target: EVENT_TARGETS,
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 11_000 },
    rangeClass: "long",
    tags: ["attack", "weapon", "long_spear"],
  }],
  tags: ["attack", "weapon", "long_spear", "playable"],
});

const GRAPPLING_HOOK_PULL = Object.freeze({
  id: "grappling_hook_pull",
  displayName: "引き打ち",
  displayEffect: "敵1体に技術80%のダメージを与え、敵前列の空きへ引く。",
  flavorText: "届かないなら、届く場所へ引けばいい。",
  weaponId: "grappling_hook",
  treePosition: "R",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: NEAREST_ENEMY,
  effects: [
    {
      type: "deal_damage",
      target: EVENT_TARGETS,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 8_000 },
      rangeClass: "long",
      tags: ["attack", "weapon", "grappling_hook"],
    },
    {
      type: "move_to_open_row",
      target: { ...EVENT_TARGETS, take: 1 },
      row: "front",
    },
  ],
  tags: ["attack", "weapon", "grappling_hook", "playable"],
});

const BANNER_COMMAND = Object.freeze({
  id: "banner_command",
  displayName: "号令",
  displayEffect: "自分以外の味方で、位置順が最後の1人にAP1。対象がいなければ通常行動へ戻る。",
  flavorText: "老兵の一声が、もう一歩を生む。",
  weaponId: "banner",
  treePosition: "R",
  apCost: 1,
  actionMode: "channel",
  intrinsicPredicates: [{ type: "target_exists", query: OTHER_ALLY }],
  targetQuery: OTHER_ALLY,
  effects: [{
    type: "gain_resource",
    target: EVENT_TARGETS,
    resource: "action_points",
    amount: { type: "constant", value: 1 },
  }],
  tags: ["support", "tempo", "weapon", "banner", "playable"],
});

const HEAVY_CROSSBOW_LOADED_SHOT = Object.freeze({
  id: "heavy_crossbow_loaded_shot",
  displayName: "装填射",
  displayEffect: "準備1の後、最も近い敵1体に腕力200%のダメージ。",
  flavorText: "重い一矢には、待つ価値がある。",
  weaponId: "heavy_crossbow",
  treePosition: "R",
  apCost: 1,
  actionMode: "channel",
  intrinsicPredicates: [],
  targetQuery: NEAREST_ENEMY,
  effects: [],
  preparation: {
    steps: 1,
    completionEffects: [{
      type: "deal_damage",
      target: NEAREST_ENEMY,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 20_000 },
      rangeClass: "long",
      tags: ["attack", "weapon", "heavy_crossbow", "prepared"],
    }],
  },
  tags: ["attack", "weapon", "heavy_crossbow", "prepared", "playable"],
});

export const MEDICAL_KIT_ACTIVE_SKILLS = Object.freeze({
  [MEDICAL_TREATMENT.id]: MEDICAL_TREATMENT,
});
export const TOWER_SHIELD_ACTIVE_SKILLS = Object.freeze({
  [TOWER_SHIELD_DRAW_GUARD.id]: TOWER_SHIELD_DRAW_GUARD,
});
export const LONG_SPEAR_ACTIVE_SKILLS = Object.freeze({
  [LONG_SPEAR_PIERCE.id]: LONG_SPEAR_PIERCE,
});
export const GRAPPLING_HOOK_ACTIVE_SKILLS = Object.freeze({
  [GRAPPLING_HOOK_PULL.id]: GRAPPLING_HOOK_PULL,
});
export const BANNER_ACTIVE_SKILLS = Object.freeze({
  [BANNER_COMMAND.id]: BANNER_COMMAND,
});
export const HEAVY_CROSSBOW_ACTIVE_SKILLS = Object.freeze({
  [HEAVY_CROSSBOW_LOADED_SHOT.id]: HEAVY_CROSSBOW_LOADED_SHOT,
});

export const MEDICAL_KIT_PASSIVE_SKILLS = Object.freeze({});
export const MEDICAL_KIT_REACTIVE_SKILLS = Object.freeze({});
export const MEDICAL_KIT_TARGET_SKILLS = Object.freeze({});
export const TOWER_SHIELD_PASSIVE_SKILLS = Object.freeze({});
export const TOWER_SHIELD_REACTIVE_SKILLS = Object.freeze({});
export const TOWER_SHIELD_TARGET_SKILLS = Object.freeze({});
export const LONG_SPEAR_PASSIVE_SKILLS = Object.freeze({});
export const LONG_SPEAR_REACTIVE_SKILLS = Object.freeze({});
export const LONG_SPEAR_TARGET_SKILLS = Object.freeze({});
export const GRAPPLING_HOOK_PASSIVE_SKILLS = Object.freeze({});
export const GRAPPLING_HOOK_REACTIVE_SKILLS = Object.freeze({});
export const GRAPPLING_HOOK_TARGET_SKILLS = Object.freeze({});
export const BANNER_PASSIVE_SKILLS = Object.freeze({});
export const BANNER_REACTIVE_SKILLS = Object.freeze({});
export const BANNER_TARGET_SKILLS = Object.freeze({});
export const HEAVY_CROSSBOW_PASSIVE_SKILLS = Object.freeze({});
export const HEAVY_CROSSBOW_REACTIVE_SKILLS = Object.freeze({});
export const HEAVY_CROSSBOW_TARGET_SKILLS = Object.freeze({});

const root = (weaponId, skillId) => Object.freeze({
  weaponId,
  position: "R",
  kind: "active",
  skillId,
  requires: Object.freeze([]),
});

export const MEDICAL_KIT_TREE = Object.freeze([root("medical_kit", MEDICAL_TREATMENT.id)]);
export const TOWER_SHIELD_TREE = Object.freeze([root("tower_shield", TOWER_SHIELD_DRAW_GUARD.id)]);
export const LONG_SPEAR_TREE = Object.freeze([root("long_spear", LONG_SPEAR_PIERCE.id)]);
export const GRAPPLING_HOOK_TREE = Object.freeze([root("grappling_hook", GRAPPLING_HOOK_PULL.id)]);
export const BANNER_TREE = Object.freeze([root("banner", BANNER_COMMAND.id)]);
export const HEAVY_CROSSBOW_TREE = Object.freeze([root("heavy_crossbow", HEAVY_CROSSBOW_LOADED_SHOT.id)]);
