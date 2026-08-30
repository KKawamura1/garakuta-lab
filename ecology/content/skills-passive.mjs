// ecology/content/skills-passive.mjs
//
// **常設 fallback passive（R6 §6.8）。**
// manifest に関係なく、どの人物も常に取得候補として持つ基礎訓練。
// 詰み防止であって、完成 build の主役ではない。
//
// **行動回数を毎 round 増やす passive は作らない。**恒常的に手数が増える効果は、
// 多くの面白い skill より強くなりやすい（R6 §6.8）。開始時1回だけにする。
//
// ここを触ってよいのは 技能 担当だけ。engine・schema・共通registryは変更しない。

import { LEGACY_COMBAT_SCALE } from "./base.mjs";

const self = { scope: "self", take: 1 };

// R6 §6.8 の表。maxHp だけは連続量なので Phase A の 10 倍尺度へ合わせる
// （表の +5 は移行前の尺度で書かれている）。
const VITALITY_BONUS = 5 * LEGACY_COMBAT_SCALE;

export const PASSIVE_SKILLS = {
  foundation_vitality: {
    id: "foundation_vitality",
    displayName: "地力",
    statBonus: { max_hp: VITALITY_BONUS },
    tags: ["foundation", "playable"],
  },
  foundation_might: {
    id: "foundation_might",
    displayName: "膂力",
    statBonus: { might: 2 },
    tags: ["foundation", "playable"],
  },
  foundation_focus: {
    id: "foundation_focus",
    displayName: "集中力",
    statBonus: { focus: 2 },
    tags: ["foundation", "playable"],
  },
  foundation_guard: {
    id: "foundation_guard",
    displayName: "受け",
    statBonus: { guard: 1 },
    tags: ["foundation", "playable"],
  },
  foundation_speed: {
    id: "foundation_speed",
    displayName: "速さ",
    statBonus: { speed: 1 },
    tags: ["foundation", "playable"],
  },
  // **開始時に一度だけ。**毎 round ではない。
  //
  // listenTo は battle_started ではなく round_started。**battle_started で足すと、
  // その直後のラウンド頭の補充（actionPoints = baseActionPoints）に上書きされて
  // 何も起きない**（実測した）。round_started は補充の後に出るので、
  // battle 一回だけの limit と組み合わせれば「開始時に一度」になる。
  foundation_ap: {
    id: "foundation_ap",
    displayName: "出足",
    tags: ["foundation", "playable"],
    rule: {
      id: "foundation_ap_rule",
      listenTo: "round_started",
      timing: "after",
      predicates: [],
      costs: [],
      effects: [{
        type: "gain_resource",
        target: self,
        resource: "action_points",
        amount: { type: "constant", value: 1 },
      }],
      limit: { scope: "battle", count: 1 },
      priority: 100,
    },
  },
  foundation_rp: {
    id: "foundation_rp",
    displayName: "備え",
    tags: ["foundation", "playable"],
    rule: {
      id: "foundation_rp_rule",
      listenTo: "round_started",
      timing: "after",
      predicates: [],
      costs: [],
      effects: [{
        type: "gain_resource",
        target: self,
        resource: "reaction_points",
        amount: { type: "constant", value: 1 },
      }],
      limit: { scope: "battle", count: 1 },
      priority: 100,
    },
  },
  opening_guard: {
    id: "opening_guard",
    displayName: "初手の構え",
    tags: ["passive", "playable", "guard"],
    rule: {
      id: "opening_guard_rule",
      listenTo: "round_started",
      timing: "after",
      predicates: [{ type: "round_number", op: "eq", value: 1 }],
      costs: [],
      effects: [{
        type: "gain_block",
        target: self,
        amount: { type: "constant", value: 1 },
      }],
      limit: { scope: "battle", count: 1 },
      priority: 100,
    },
  },
};
