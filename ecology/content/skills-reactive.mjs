// ecology/content/skills-reactive.mjs
//
// **反応技能（reactive skill）の定義。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 技能 担当だけ。engine・schema・共通registryは変更しない。

import { bpsForLegacyAmount, renamed, scaleDefinitionAmounts } from "./base.mjs";

export const REACTIVE_SKILL_NAMES = {
  counter_blow: "反撃",
  cover_ally: "身代わり",
  overflow_care: "余剰治療",
  scavenge_ap: "拾い直し",
  guard_step: "踏み固め",
  urging: "急かす",
  brace_after_hit: "受け流し",
  triage_relay: "連携治療",
  ap_loop: "行動権の循環",
  damage_echo: "痛みの反響",
  barrier_bloom: "防壁の花",
  relay_front: "前列への号令",
  relay_rear: "後列への号令",
  prep_spiral: "準備の螺旋",
  block_focus: "受け返しの集中",
  barrier_stitch: "防壁の縫い直し",
  emergency_treatment: "応急処置",
  mend: "手当て",
  triage: "応急手当",
  whetted_by_pain: "痛みで研ぐ",
  shield_handoff: "受けの受け渡し",
  patient_step: "溜めの次手",
  spill_forward: "余波を回す",
  blocked_into_step: "受けを順番へ",
  mercy_into_guard: "手当てを備えへ",
  stride_into_reach: "歩みを間合いへ",
  readied_relay: "支度を渡す",
  wake_of_the_fallen: "倒したあと",
  guarded_opening: "受け止めの隙",
  seize_the_opening: "機を逃さず",
};

const reactiveSkills = renamed("reactiveSkills", REACTIVE_SKILL_NAMES);

const SELF_TARGET = { scope: "self", take: 1 };
const SELF_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
};
const OTHER_ALLY_IS_EVENT_TARGET = {
  type: "target_exists",
  query: {
    scope: "allies",
    filters: [{ type: "alive" }, { type: "not_self" }, { type: "is_event_primary_target" }],
    take: 1,
  },
};
const OTHER_ALLY_TARGET = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "not_self" }, { type: "is_event_primary_target" }],
  take: 1,
};

// R6 §4.4 — Phase A の係数。反応技能も同じ決め方。
// 反撃は殴られた側の might、防壁と治療は focus。
export const REACTIVE_SCALING = {
  counter_blow: { stat: "might", bps: bpsForLegacyAmount(2) },
  damage_echo: { stat: "might", bps: bpsForLegacyAmount(1) },
  guard_step: { stat: "focus", bps: bpsForLegacyAmount(2) },
  brace_after_hit: { stat: "focus", bps: bpsForLegacyAmount(2) },
  barrier_bloom: { stat: "focus", bps: bpsForLegacyAmount(1) },
};

for (const [id, scaling] of Object.entries(REACTIVE_SCALING)) {
  scaleDefinitionAmounts(reactiveSkills[id], scaling);
}

// 余剰治療は汎用、連携治療は応急手当専用。汎用側を無償にすると
// 後者の完全な上位互換になるため、両方ともRP1を払い、専用側だけ
// 余剰量を増幅する。これで「広く薄く」と「狭く強く」の選択になる。
reactiveSkills.overflow_care.rule.costs = [{ type: "spend_reaction_points", amount: 1 }];
for (const effect of reactiveSkills.triage_relay.rule.effects ?? []) {
  if (effect.type === "heal" && effect.amount?.type === "event_value_scaled") {
    effect.amount = { ...effect.amount, numerator: 5, denominator: 4 };
  }
}

// Content Wave 1 — connect two existing defensive events to two different
// follow-up resources. Both spend RP, so the answer is not free durability.
reactiveSkills.block_focus = {
  id: "block_focus",
  displayName: REACTIVE_SKILL_NAMES.block_focus,
  rule: {
    id: "block_focus_rule",
    listenTo: "damage_blocked",
    timing: "after",
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
    limit: { scope: "round", count: 1 },
    priority: 100,
  },
  tags: ["reaction", "tempo"],
};
reactiveSkills.barrier_stitch = {
  id: "barrier_stitch",
  displayName: REACTIVE_SKILL_NAMES.barrier_stitch,
  rule: {
    id: "barrier_stitch_rule",
    listenTo: "barrier_broken",
    timing: "after",
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "gain_block", target: SELF_TARGET, amount: { type: "constant", value: 1 } }],
    limit: { scope: "round", count: 1 },
    priority: 100,
  },
  tags: ["reaction", "guard"],
};

// R8 §9.1 — 応急処置。自分以外の味方の被弾にだけ反応し、同じ chain 内で発火する。実回復量は
// その被弾量の1/3を超えない。古い損傷へは効かない
// （新しい damage_taken が起きない限り発火しようがない）ので、
// round を稼いで待つだけでは carry HP が改善しない
// （analysis/ecology-anti-stall-smoke.mjs が検査する不変条件）。
// worked example は R8 §9.1 と一致させてある: 被弾36 → 応急処置12 → 残り損傷24。
reactiveSkills.emergency_treatment = {
  id: "emergency_treatment",
  displayName: REACTIVE_SKILL_NAMES.emergency_treatment,
  rule: {
    id: "emergency_treatment_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 150,
    predicates: [{
      type: "target_exists",
      query: OTHER_ALLY_IS_EVENT_TARGET.query,
    }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "heal",
      target: OTHER_ALLY_TARGET,
      amount: { type: "event_value_scaled", key: "amount", numerator: 1, denominator: 3 },
      tags: ["care", "emergency"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "care", "emergency"],
};

// R8 Implementation Phase 1（続き）— mend / triage を anti-stall 安全な reactive
// へ作り替える（analysis/ecology-anti-stall-audit.mjs が是正前の active 版を
// 検出していた。R8_IMPLEMENTATION_PHASE0_FREEZE.md §3、作者承認済み）。
//
// どちらも emergency_treatment と同じ理由で安全: `damage_taken` にだけ反応し、
// 実回復量はその被弾量の一部（event_value_scaled）に固定される。**古い損傷へは
// 効かない**——新しい damage_taken が起きない限り発火しようがないので、round を
// 稼いで待つだけでは carry HP が改善しない。
//
//   mend   … baseline。誰の被弾でも（自分自身も含む）少量を返す安全弁。
//   triage … pack_care。被弾後にHP50%以下になった自分以外の味方へ、より大きな割合を返す。
//            自分は対象にせず、後列の支援役が前衛をつなぐための応急手当。
const ALLY_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "alive" }, { type: "is_event_primary_target" }], take: 1 },
};
const HIT_ALLY_TARGET = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "is_event_primary_target" }],
  take: 1,
};
const HIT_ALLY_BELOW_HALF_QUERY = {
  scope: "allies",
  filters: [
    { type: "alive" },
    { type: "not_self" },
    { type: "is_event_primary_target" },
    { type: "hp_percent", op: "lte", value: 50 },
  ],
  take: 1,
};

reactiveSkills.mend = {
  id: "mend",
  displayName: REACTIVE_SKILL_NAMES.mend,
  rule: {
    id: "mend_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 160,
    predicates: [ALLY_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "heal",
      target: HIT_ALLY_TARGET,
      // 被弾量の1/4だけを返す。R8 §9.1 の worked example（被弾36→応急処置12）と
      // 同じ形の、baseline 向けに控えめな比率。
      amount: { type: "event_value_scaled", key: "amount", numerator: 1, denominator: 4 },
      tags: ["care"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "care"],
};

reactiveSkills.triage = {
  id: "triage",
  displayName: REACTIVE_SKILL_NAMES.triage,
  rule: {
    id: "triage_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 140,
    predicates: [{ type: "target_exists", query: HIT_ALLY_BELOW_HALF_QUERY }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "heal",
      target: HIT_ALLY_BELOW_HALF_QUERY,
      // 自分以外の味方がHP半分以下まで削られた一撃にだけ強く反応する。被弾量の1/2を返す。
      amount: { type: "event_value_scaled", key: "amount", numerator: 1, denominator: 2 },
      // "triage" タグは triage_relay（既存）が event_tag 述語で読む。
      tags: ["care", "triage"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "care"],
};

// ---------------------------------------------------------------- pack_barrage（R8 §5.4、続き）
//
// R8 §6.2「新パックは昔のeventを読む」— pack_barrageが選ばれた過去パック
// （W: 防壁と隊列、T: 行動権と準備）が既に発生させているeventを最低2種類読む。
// どちらも「隙（exposed）を付ける」という同じ利得先へつながる、異なる発生源
// （R8 §6.3「一つの利得先へ到達する発生源を2つ以上」）。
const RANDOM_EXPOSABLE_ENEMY = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "eq", value: 0 }],
  sort: ["hp_desc"],
  take: 1,
};

// 発生源: damage_blocked（Wのblock/barrier防御が実際に一撃を止めたとき）。
// 受け止めた側が、隙を作る側へ回る。
reactiveSkills.guarded_opening = {
  id: "guarded_opening",
  displayName: REACTIVE_SKILL_NAMES.guarded_opening,
  rule: {
    id: "guarded_opening_rule",
    listenTo: "damage_blocked",
    timing: "after",
    priority: 130,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: RANDOM_EXPOSABLE_ENEMY, statusId: "exposed", stacks: 1 }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "mark"],
};

// 発生源: resource_gained（Tの号令・急かす・拾い直しでAP/RPが動いたとき）。
// 得た行動権を、隙を作る機会へ変える。
reactiveSkills.seize_the_opening = {
  id: "seize_the_opening",
  displayName: REACTIVE_SKILL_NAMES.seize_the_opening,
  rule: {
    id: "seize_the_opening_rule",
    listenTo: "resource_gained",
    timing: "after",
    priority: 130,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: RANDOM_EXPOSABLE_ENEMY, statusId: "exposed", stacks: 1 }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "mark"],
};

// ---------------------------------------------------------------- R9 §4.1, §9.2 — 導入 pack の接続面
//
// R9 §9.2「最低でも各導入packに一つは、別の役割が使う小さな接続面を置く」。
// 攻撃 pack に守り役の入口を、守り pack に受け渡しの出口を、拍子 pack に
// 準備役の次手を置く。**どれも既存の event を読むだけで、新しい語彙は増やさない。**

// pack_edge — 殴られた側が、次の一撃を研ぐ。守り役が攻撃 pack を使う入口。
reactiveSkills.whetted_by_pain = {
  id: "whetted_by_pain",
  displayName: REACTIVE_SKILL_NAMES.whetted_by_pain,
  rule: {
    id: "whetted_by_pain_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 120,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "attack"],
};

// pack_wall — 受け止めた結果を、自分ではなく一番傷ついた味方へ渡す。
// block_focus（自分が集中を得る）と同じ発生源から、別の役割へ出す。
const WEAKEST_ALLY_TARGET = {
  scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1,
};
reactiveSkills.shield_handoff = {
  id: "shield_handoff",
  displayName: REACTIVE_SKILL_NAMES.shield_handoff,
  rule: {
    id: "shield_handoff_rule",
    listenTo: "damage_blocked",
    timing: "after",
    priority: 125,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_barrier",
      target: WEAKEST_ALLY_TARGET,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 7_500 },
      duration: "round",
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "guard", "handoff"],
};

// pack_tempo — 準備を終えた本人が、そのまま次の手番へつなぐ。
// **RP を払って AP を得る。**払わずに得られると、準備するほど手数が増える。
reactiveSkills.patient_step = {
  id: "patient_step",
  displayName: REACTIVE_SKILL_NAMES.patient_step,
  rule: {
    id: "patient_step_rule",
    listenTo: "preparation_completed",
    timing: "after",
    priority: 120,
    predicates: [{
      type: "target_exists",
      query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
    }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_resource", target: SELF_TARGET, resource: "action_points",
      amount: { type: "constant", value: 1 },
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "tempo"],
};

// ---------------------------------------------------------------- R9 §5 — 横断pack「余波と受け渡し」
//
// **同じ出来事を、別の役割が別の結果へ変える。**R9 §5 が挙げた6つの発生源
// （防いだ / 過剰ダメージ / 回復した / 移動した / 準備を完了した / 撃破した）を
// 一つずつ読み、どれも「その役割の中で完結しない出口」へ渡す。
//
// R9 §5.1 の条件で、ここが守っているもの:
//   - 発生源が6種類ある（2種類以上）。
//   - どの発生源も、その出来事を起こせる人なら誰でも読める（人物IDを条件にしない）。
//   - どれも単独で価値があり、A＋B の固定レシピを要求しない。
//   - **待機だけでは何も増えない。**すべて RP1 を払い、round か chain で止まる。
const FASTEST_FRONT_ALLY = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "row_is", row: "front" }],
  sort: ["speed_desc"],
  take: 1,
};
const SLOWEST_ALLY = {
  scope: "allies", filters: [{ type: "alive" }], sort: ["speed_asc"], take: 1,
};
const FRONTMOST_ENEMY = {
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
};
const WEAKEST_ALLY_QUERY = {
  scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1,
};
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};

// 過剰ダメージ → 掃除。攻撃特化が「単体火力」から「掃除・追撃」へ広がる。
reactiveSkills.spill_forward = {
  id: "spill_forward",
  displayName: REACTIVE_SKILL_NAMES.spill_forward,
  rule: {
    id: "spill_forward_rule",
    listenTo: "excess_damage",
    timing: "after",
    priority: 110,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "deal_damage",
      target: { scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 3_000 },
      tags: ["attack", "relay"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "relay", "attack"],
};

// 防いだ → 順番。受け役が「受ける人」から「次に動く人を決める人」になる。
reactiveSkills.blocked_into_step = {
  id: "blocked_into_step",
  displayName: REACTIVE_SKILL_NAMES.blocked_into_step,
  rule: {
    id: "blocked_into_step_rule",
    listenTo: "damage_blocked",
    timing: "after",
    priority: 115,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_resource", target: FASTEST_FRONT_ALLY, resource: "action_points",
      amount: { type: "constant", value: 1 },
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "tempo"],
};

// 回復した → 備え。回復役が「HPを戻す人」から「次の被害を止める人」になる。
reactiveSkills.mercy_into_guard = {
  id: "mercy_into_guard",
  displayName: REACTIVE_SKILL_NAMES.mercy_into_guard,
  rule: {
    id: "mercy_into_guard_rule",
    listenTo: "healing_applied",
    timing: "after",
    priority: 115,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "gain_block", target: HIT_ALLY_TARGET, amount: { type: "constant", value: 1 } }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "care"],
};

// 移動した → 相手の崩れ。機動役が「位置を直す人」から「隙を作る人」になる。
reactiveSkills.stride_into_reach = {
  id: "stride_into_reach",
  displayName: REACTIVE_SKILL_NAMES.stride_into_reach,
  rule: {
    id: "stride_into_reach_rule",
    listenTo: "actor_moved",
    timing: "after",
    priority: 115,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: FRONTMOST_ENEMY, statusId: "exposed", stacks: 1 }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "mark"],
};

// 準備を完了した → 遅い仲間の反応。準備役が、自分の外側へ効果を出す。
reactiveSkills.readied_relay = {
  id: "readied_relay",
  displayName: REACTIVE_SKILL_NAMES.readied_relay,
  rule: {
    id: "readied_relay_rule",
    listenTo: "preparation_completed",
    timing: "after",
    priority: 115,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_resource", target: SLOWEST_ALLY, resource: "reaction_points",
      amount: { type: "constant", value: 1 },
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "tempo"],
};

// 撃破した → 傷ついた仲間の盾。撃破の余波を、攻撃以外の出口へ回す。
reactiveSkills.wake_of_the_fallen = {
  id: "wake_of_the_fallen",
  displayName: REACTIVE_SKILL_NAMES.wake_of_the_fallen,
  rule: {
    id: "wake_of_the_fallen_rule",
    listenTo: "actor_defeated",
    timing: "after",
    priority: 115,
    predicates: [{
      type: "target_exists",
      query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
    }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_barrier",
      target: WEAKEST_ALLY_QUERY,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 10_000 },
      duration: "round",
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "guard"],
};

export const REACTIVE_SKILLS = reactiveSkills;
