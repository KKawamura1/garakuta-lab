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
  // ---------------------------------------------------------------- R9 §4.1 — 導入 pack の常設
  //
  // 各導入 pack に、その pack の読み方を助ける常設を一つ置く。
  // **数値だけの上位版は作らない**（R9 §4.2）。どれも rule で、
  // その pack の中心的な出来事を別の結果へ変える。

  // pack_edge — 先手を取った者が、最初の一撃を研いだ状態で始める。
  // opening_guard（守りの初手）と対になる、攻めの初手。
  first_blood: {
    id: "first_blood",
    displayName: "先手の一閃",
    tags: ["passive", "playable", "attack"],
    rule: {
      id: "first_blood_rule",
      listenTo: "round_started",
      timing: "after",
      predicates: [{ type: "round_number", op: "eq", value: 1 }],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { scope: "battle", count: 1 },
      priority: 100,
    },
  },
  // pack_tempo — 使い切れなかった行動権を、次の一手の集中へ変える。
  // **手数は増えない。**余りの行き先が一つ増えるだけ。
  held_breath: {
    id: "held_breath",
    displayName: "余りを溜める",
    tags: ["passive", "playable", "tempo"],
    rule: {
      id: "held_breath_rule",
      listenTo: "resource_unused",
      timing: "after",
      predicates: [
        { type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 } },
        { type: "event_tag", tag: "action_points", value: true },
        { type: "event_value", key: "amount", op: "gte", value: 1 },
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { scope: "round", count: 1 },
      priority: 100,
    },
  },
  // pack_care — 手当てをした手が、そのまま次の仕事へ移る。
  // 回復役を「HPを戻すだけの人」にしないための出口（R9 §5）。
  steady_hands: {
    id: "steady_hands",
    displayName: "慣れた手つき",
    tags: ["passive", "playable", "care"],
    rule: {
      id: "steady_hands_rule",
      listenTo: "healing_applied",
      timing: "after",
      predicates: [{
        type: "target_exists",
        query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
      }],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { scope: "round", count: 1 },
      priority: 100,
    },
  },
  // R9 §5 — 横断pack「余波と受け渡し」の常設。過剰ダメージを次の一手の
  // 集中へ変える。**手数は増えない。**余波の行き先が一つ増えるだけ。
  wake_reader: {
    id: "wake_reader",
    displayName: "余波を読む",
    tags: ["passive", "playable", "relay"],
    rule: {
      id: "wake_reader_rule",
      listenTo: "excess_damage",
      timing: "after",
      predicates: [{
        type: "target_exists",
        query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
      }],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { scope: "round", count: 1 },
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
