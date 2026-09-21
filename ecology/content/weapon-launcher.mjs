// R25 — 射出器の入口スライス。
//
// 19節の全棚卸しは後続の縦スライスで追加する。遠隔の代表アクションを
// 先にcontent contractへ接続し、格闘具と同じmanifest/UI経路で検証する。

const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});

export const LAUNCHER_ACTIVE_SKILLS = Object.freeze({
  launcher_shot: Object.freeze({
    id: "launcher_shot",
    displayName: "射出",
    displayEffect: "敵1体に技術100%のダメージ。",
    flavorText: "必要な一本だけ、正しく通す。",
    weaponId: "launcher",
    treePosition: "R",
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: ENEMY,
    effects: [{
      type: "deal_damage",
      target: EVENT_TARGETS,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 10_000 },
      rangeClass: "ranged",
      tags: ["attack", "weapon", "launcher"],
    }],
    tags: ["attack", "weapon", "launcher", "playable"],
  }),
});

export const LAUNCHER_PASSIVE_SKILLS = Object.freeze({});
export const LAUNCHER_REACTIVE_SKILLS = Object.freeze({});
export const LAUNCHER_TARGET_SKILLS = Object.freeze({});

export const LAUNCHER_TREE = Object.freeze([
  Object.freeze({
    weaponId: "launcher", position: "R", kind: "active", skillId: "launcher_shot",
    requires: Object.freeze([]),
  }),
]);
