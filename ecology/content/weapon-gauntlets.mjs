// R25 — 格闘具の入口スライス。
//
// 19節の全棚卸しは後続の縦スライスで追加する。まずはStage 0で解禁される
// 攻撃武器を、manifest・ツリーUI・BattleInputまで同じ定義で通す。

const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});

export const GAUNTLETS_ACTIVE_SKILLS = Object.freeze({
  gauntlets_punch: Object.freeze({
    id: "gauntlets_punch",
    displayName: "正拳",
    displayEffect: "敵1体に腕力90%のダメージ。",
    flavorText: "余計な道具はいらない。",
    weaponId: "gauntlets",
    treePosition: "R",
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: ENEMY,
    effects: [{
      type: "deal_damage",
      target: EVENT_TARGETS,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 9_000 },
      rangeClass: "melee",
      tags: ["attack", "weapon", "gauntlets"],
    }],
    tags: ["attack", "weapon", "gauntlets", "playable"],
  }),
});

export const GAUNTLETS_PASSIVE_SKILLS = Object.freeze({});
export const GAUNTLETS_REACTIVE_SKILLS = Object.freeze({});
export const GAUNTLETS_TARGET_SKILLS = Object.freeze({});

export const GAUNTLETS_TREE = Object.freeze([
  Object.freeze({
    weaponId: "gauntlets", position: "R", kind: "active", skillId: "gauntlets_punch",
    requires: Object.freeze([]),
  }),
]);
