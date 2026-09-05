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

// ---------------------------------------------------------------- R16 — 常設の追加
//
// **常設は「数値を押し上げるもの」と「出来事を別の結果へ変えるもの」の二種類がある。**
// 基礎訓練（地力・膂力…）が前者で、R9 以降に足しているのは後者である。
// R16 の6本も全部が後者で、**手数は一つも増やさない**（R6 §6.8）。
// 増えるのは、既に起きている出来事の行き先だけ。
//
// どれも反応権を払わない代わりに、round か battle で一度に止まる。
Object.assign(PASSIVE_SKILLS, {
  // pack_edge — 倒した拍で刃が研がれる。拾い直し（行動権）と同じ出来事の別の出口。
  edge_honed: {
    id: "edge_honed",
    displayName: "研ぎ澄ます",
    tags: ["passive", "playable", "attack"],
    rule: {
      id: "edge_honed_rule",
      listenTo: "actor_defeated",
      timing: "after",
      predicates: [
        { type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 } },
        { type: "target_exists", query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 } },
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { scope: "round", count: 1 },
      priority: 100,
    },
  },
  // pack_wall — **使われずに消えた防壁**が、次の受け構えになる。
  // 張りすぎた防壁が完全な無駄にならない、という一点だけを変える。
  wall_reader: {
    id: "wall_reader",
    displayName: "崩れを読む",
    tags: ["passive", "playable", "guard"],
    rule: {
      id: "wall_reader_rule",
      listenTo: "barrier_expired",
      timing: "after",
      predicates: [{
        type: "target_exists",
        query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
      }],
      costs: [],
      effects: [{ type: "gain_block", target: self, amount: { type: "constant", value: 1 } }],
      limit: { scope: "round", count: 1 },
      priority: 100,
    },
  },
  // pack_care — 開幕、一番傷ついている者へ守勢。**遠征の途中から始まる戦闘**
  // （前の戦闘の傷を持ち越している）ほど効く。
  patient_hands: {
    id: "patient_hands",
    displayName: "先に手を打つ",
    tags: ["passive", "playable", "care"],
    rule: {
      id: "patient_hands_rule",
      listenTo: "round_started",
      timing: "after",
      predicates: [{ type: "round_number", op: "eq", value: 1 }],
      costs: [],
      effects: [{
        type: "add_status",
        target: { scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
        statusId: "warded",
        stacks: 1,
      }],
      limit: { scope: "battle", count: 1 },
      priority: 100,
    },
  },
  // pack_tempo — 出足（自分に行動権）の、他人向け版。**毎ラウンドではない。**
  first_order: {
    id: "first_order",
    displayName: "初手の号令",
    tags: ["passive", "playable", "tempo"],
    rule: {
      id: "first_order_rule",
      listenTo: "round_started",
      timing: "after",
      predicates: [{ type: "round_number", op: "eq", value: 1 }],
      costs: [],
      effects: [{
        type: "gain_resource",
        target: {
          scope: "allies",
          filters: [{ type: "alive" }, { type: "not_self" }, { type: "row_is", row: "front" }],
          sort: ["speed_desc"],
          take: 1,
        },
        resource: "action_points",
        amount: { type: "constant", value: 1 },
      }],
      limit: { scope: "battle", count: 1 },
      priority: 100,
    },
  },
  // pack_barrage — 自分が隙を付けた拍で集中を得る。刻印を配る手が、次の一撃を研ぐ。
  mark_reader: {
    id: "mark_reader",
    displayName: "刻印を読む",
    tags: ["passive", "playable", "mark"],
    rule: {
      id: "mark_reader_rule",
      listenTo: "status_added",
      timing: "after",
      predicates: [
        { type: "event_value", key: "statusId", op: "eq", value: "exposed" },
        { type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 } },
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { scope: "round", count: 1 },
      priority: 100,
    },
  },
  // pack_relay — 防壁を**受け取った**拍を、次の一手の集中へ。
  // 防壁の花（さらに防壁）と同じ出来事から、守り以外の出口を作る。
  relay_reader: {
    id: "relay_reader",
    displayName: "渡りを読む",
    tags: ["passive", "playable", "relay"],
    rule: {
      id: "relay_reader_rule",
      listenTo: "barrier_gained",
      timing: "after",
      predicates: [{
        type: "target_exists",
        query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
      }],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { scope: "round", count: 1 },
      priority: 100,
    },
  },
});
