// ecology/content/skills-passive.mjs
//
// **常設 fallback passive（R6 §6.8）。**
// manifest に関係なく、どの人物も常に取得候補として持つ基礎訓練。
// 詰み防止であって、完成 build の主役ではない。
//
// **行動回数を毎 round 増やす passive は作らない。**恒常的に手数が増える効果は、
// 多くの面白い skill より強くなりやすい（R6 §6.8）。開始時1回だけにする。
//
// engine・schema・共通registryは変更しない。

import { LEGACY_COMBAT_SCALE, NOT_COST_DAMAGE } from "./base.mjs";

const self = { scope: "self", take: 1 };
const selfIsEventSource = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
const selfIsEventTarget = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
};
const selfIsNotEventSource = {
  type: "target_exists",
  op: "eq",
  value: 0,
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
const selfNotFocused = {
  type: "has_status", subject: "self", statusId: "focused", op: "eq", value: 0,
};
const attackEvent = { type: "event_tag", tag: "attack", value: true };
const hasReservedRp = {
  type: "resource", subject: "self", resource: "reaction_points", op: "gte", value: 1,
};
const eventEnemyWithStatus = (statusId) => ({
  type: "target_exists",
  query: {
    scope: "enemies",
    filters: [
      { type: "alive" },
      { type: "is_event_primary_target" },
      { type: "has_status", statusId, op: "gte", value: 1 },
    ],
    take: 1,
  },
});
const woundedEventAlly = {
  type: "target_exists",
  query: {
    scope: "allies",
    filters: [
      { type: "alive" }, { type: "is_event_primary_target" },
      { type: "hp_percent", op: "lte", value: 50 },
    ],
    take: 1,
  },
};
const freePercent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});
const chainOnce = { owner: "actor-instance + rule", scope: "chain", count: 1 };

// R6 §6.8 のLv1を保ったまま、R24から4能力ともLv10まで伸ばす。
// maxHp はPhase Aの10倍尺度なので、旧+5は現在+50。Lv2以降の増分は小さく、
// 完成ビルドの主役ではなく、余った技能点を確実性へ替える逃げ道である。
const VITALITY_BONUS = 5 * LEGACY_COMBAT_SCALE;

export const PASSIVE_SKILLS = {
  foundation_vitality: {
    id: "foundation_vitality",
    displayName: "地力",
    statBonus: { max_hp: VITALITY_BONUS },
    statBonusPerLevel: { max_hp: LEGACY_COMBAT_SCALE },
    tags: ["foundation", "playable"],
  },
  foundation_might: {
    id: "foundation_might",
    displayName: "膂力",
    statBonus: { might: 2 },
    statBonusPerLevel: { might: 1 },
    tags: ["foundation", "playable"],
  },
  foundation_focus: {
    id: "foundation_focus",
    displayName: "技術",
    statBonus: { focus: 2 },
    statBonusPerLevel: { focus: 1 },
    tags: ["foundation", "playable"],
  },
  foundation_guard: {
    id: "foundation_guard",
    displayName: "受け",
    statBonus: { guard: 1 },
    statBonusPerLevel: { guard: 1 },
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
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
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
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
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
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
      priority: 100,
    },
  },
  // pack_tempo — 1回動いても行動権が残る者の、次の一手を集中へ変える。
  // round末の resource_unused までAPが残ることは通常ない（行動可能なら次の巡で
  // 必ず使う）ため、action_resolved の直後に「まだ1以上ある」を読む。
  held_breath: {
    id: "held_breath",
    displayName: "余りを溜める",
    tags: ["passive", "playable", "tempo"],
    rule: {
      id: "held_breath_rule",
      listenTo: "action_resolved",
      timing: "after",
      predicates: [
        selfIsEventSource,
        { type: "resource", subject: "self", resource: "action_points", op: "gte", value: 1 },
        selfNotFocused,
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
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
      predicates: [selfIsEventSource, selfNotFocused],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
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
      predicates: [selfIsEventSource, selfNotFocused],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
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
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
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
        selfIsEventSource,
        { type: "target_exists", query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 } },
        selfNotFocused,
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
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
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
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
        // issue #176 — 宛先は傷の割合で選ぶ（docs/DESIGN.md 8.7.1）。
        target: { scope: "allies", filters: [{ type: "alive" }], sort: ["hp_percent_asc"], take: 1 },
        statusId: "warded",
        stacks: 1,
      }],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
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
          sort: ["position_asc"],
          take: 1,
        },
        resource: "action_points",
        amount: { type: "constant", value: 1 },
      }],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
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
        selfIsEventSource,
        selfNotFocused,
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
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
      }, selfNotFocused],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      priority: 100,
    },
  },
});

// ---------------------------------------------------------------- R24 — 各packの条件付き常設
//
// 一律に能力を上げるのではなく、「状態を付けた」「前へ出た」「RPを残した」など、
// 既存の弱い行動を選んだ結果だけを太くする。割合は小さく、手数と資源は増やさない。
// pending amount を読む規則は一つの行動chainで1回、状態変換はround 1回で止める。
Object.assign(PASSIVE_SKILLS, {
  // pack_edge — RPを使い切らない構成と、手負いでしか出ない攻撃を別々に支える。
  reserve_edge: {
    id: "reserve_edge",
    displayName: "残心",
    tags: ["passive", "playable", "attack", "reserve"],
    rule: {
      id: "reserve_edge_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [selfIsEventSource, attackEvent, hasReservedRp],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: freePercent(5) }],
      limit: chainOnce,
      priority: 55,
    },
  },
  bloodied_edge: {
    id: "bloodied_edge",
    displayName: "窮地の力",
    tags: ["passive", "playable", "attack", "risk"],
    rule: {
      id: "bloodied_edge_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [
        selfIsEventSource,
        attackEvent,
        { type: "hp_percent", subject: "self", op: "lte", value: 50 },
      ],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: freePercent(8) }],
      limit: chainOnce,
      priority: 56,
    },
  },

  // pack_wall — 前列と守勢を選んだときだけ、同じ守りを少し厚くする。
  frontline_stance: {
    id: "frontline_stance",
    displayName: "前衛の型",
    tags: ["passive", "playable", "guard", "formation"],
    rule: {
      id: "frontline_stance_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [
        selfIsEventTarget,
        { type: "position", subject: "self", row: "front", op: "eq" },
      ],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "decrease", amount: freePercent(5) }],
      limit: chainOnce,
      priority: 55,
    },
  },
  warded_barrier: {
    id: "warded_barrier",
    displayName: "守勢の壁",
    tags: ["passive", "playable", "guard", "status"],
    rule: {
      id: "warded_barrier_rule",
      listenTo: "barrier_proposed",
      timing: "interrupt",
      predicates: [
        selfIsEventTarget,
        { type: "has_status", subject: "self", statusId: "warded", op: "gte", value: 1 },
      ],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: freePercent(8) }],
      limit: chainOnce,
      priority: 55,
    },
  },

  // pack_care — RPを残した治療と、瀕死者へ向けた防壁だけを強める。
  reserve_care: {
    id: "reserve_care",
    displayName: "備えた手",
    tags: ["passive", "playable", "care", "reserve"],
    rule: {
      id: "reserve_care_rule",
      listenTo: "healing_proposed",
      timing: "interrupt",
      predicates: [selfIsEventSource, hasReservedRp],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: freePercent(8) }],
      limit: chainOnce,
      priority: 55,
    },
  },
  wounded_guard: {
    id: "wounded_guard",
    displayName: "傷を測る",
    tags: ["passive", "playable", "care", "guard"],
    rule: {
      id: "wounded_guard_rule",
      listenTo: "barrier_proposed",
      timing: "interrupt",
      predicates: [selfIsEventSource, woundedEventAlly],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: freePercent(10) }],
      limit: chainOnce,
      priority: 56,
    },
  },

  // pack_tempo — 余ったRPを次roundへ持ち越す一度きりの備えと、溜め技専用の倍率。
  reserve_rhythm: {
    id: "reserve_rhythm",
    displayName: "一拍残す",
    tags: ["passive", "playable", "tempo", "reserve"],
    rule: {
      id: "reserve_rhythm_rule",
      listenTo: "resource_unused",
      timing: "after",
      predicates: [
        selfIsEventTarget,
        { type: "event_tag", tag: "reaction_points", value: true },
        { type: "event_value", key: "amount", op: "gte", value: 1 },
        selfNotFocused,
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
      priority: 100,
    },
  },
  prepared_power: {
    id: "prepared_power",
    displayName: "溜めの勘所",
    tags: ["passive", "playable", "tempo", "preparation", "attack"],
    rule: {
      id: "prepared_power_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [selfIsEventSource, attackEvent, { type: "event_tag", tag: "heavy", value: true }],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: freePercent(10) }],
      limit: chainOnce,
      priority: 55,
    },
  },

  // pack_barrage — 刻印相手と三段目以降を、多段側の利得へ変える。
  marked_assault: {
    id: "marked_assault",
    displayName: "刻印攻め",
    tags: ["passive", "playable", "attack", "mark"],
    rule: {
      id: "marked_assault_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [selfIsEventSource, attackEvent, eventEnemyWithStatus("exposed")],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: freePercent(8) }],
      limit: chainOnce,
      priority: 56,
    },
  },
  three_count: {
    id: "three_count",
    displayName: "三つ数える",
    tags: ["passive", "playable", "attack", "onhit"],
    rule: {
      id: "three_count_rule",
      listenTo: "damage_taken",
      timing: "after",
      predicates: [
        selfIsEventSource,
        eventEnemyWithStatus("exposed"),
        { type: "event_value", key: "hitIndex", op: "eq", value: 2 },
        selfNotFocused,
        NOT_COST_DAMAGE,
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      priority: 100,
    },
  },

  // pack_relay — 他人から受け取った集中と、誰かが刻んだ裂傷を別の役割へ渡す。
  borrowed_focus: {
    id: "borrowed_focus",
    displayName: "借りた勢い",
    tags: ["passive", "playable", "relay", "guard"],
    rule: {
      id: "borrowed_focus_rule",
      listenTo: "status_added",
      timing: "after",
      predicates: [
        { type: "event_value", key: "statusId", op: "eq", value: "focused" },
        selfIsEventTarget,
        selfIsNotEventSource,
        { type: "has_status", subject: "self", statusId: "warded", op: "lt", value: 2 },
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "warded", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      priority: 100,
    },
  },
  bleed_memory: {
    id: "bleed_memory",
    displayName: "傷を覚える",
    tags: ["passive", "playable", "relay", "attack", "status"],
    rule: {
      id: "bleed_memory_rule",
      listenTo: "status_added",
      timing: "after",
      predicates: [
        { type: "event_value", key: "statusId", op: "eq", value: "bleeding" },
        eventEnemyWithStatus("bleeding"),
        selfNotFocused,
      ],
      costs: [],
      effects: [{ type: "add_status", target: self, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      priority: 100,
    },
  },
});
