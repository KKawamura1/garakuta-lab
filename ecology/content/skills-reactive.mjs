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
};

const reactiveSkills = renamed("reactiveSkills", REACTIVE_SKILL_NAMES);

const SELF_TARGET = { scope: "self", take: 1 };
const SELF_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
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

// R8 §9.1 — 応急処置。被弾と同じ chain 内だけで発火し、実回復量は
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
      query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
    }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "heal",
      target: SELF_TARGET,
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
//   triage … pack_care。被弾後にHP50%以下になった対象へ、より大きな割合を返す。
//            「応急手当」という名の由来どおり、危機的な一撃だけに強く反応する。
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
      // HP半分以下まで削られた一撃にだけ強く反応する。被弾量の1/2を返す。
      amount: { type: "event_value_scaled", key: "amount", numerator: 1, denominator: 2 },
      // "triage" タグは triage_relay（既存）が event_tag 述語で読む。
      tags: ["care", "triage"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "care"],
};

export const REACTIVE_SKILLS = reactiveSkills;
