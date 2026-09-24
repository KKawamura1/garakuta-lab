// R27 — 医療具19節。
//
// 医療具は「古い傷をAPだけで戻す」武器ではない。主行動はすべて防壁を
// 作り、被弾中の反応だけが回復窓／蘇生へ触れる。これで医療役の仕事を
// 「次の一撃を受け止める」「倒れる瞬間を拾う」「支援を攻撃へ渡す」に
// 分けつつ、anti-stall の境界を越えない。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ONE_EVENT_TARGET = Object.freeze({ scope: "event_targets", take: 1 });
const ALL_ALLIES = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }], sort: ["hp_percent_asc"], take: "all",
});
const WOUNDED_ALLY = Object.freeze({
  scope: "allies",
  filters: [{ type: "alive" }, { type: "hp_percent", op: "lt", value: 100 }],
  sort: ["hp_percent_asc"], take: 1,
});
const OTHER_ALLY = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }, { type: "not_self" }],
  sort: ["position_desc"], take: 1,
});
const OTHER_WOUNDED_ALLY = Object.freeze({
  scope: "allies",
  filters: [{ type: "alive" }, { type: "not_self" }, { type: "hp_percent", op: "lt", value: 100 }],
  sort: ["hp_percent_asc"], take: 1,
});
const DEFEATED_ALLY = Object.freeze({
  scope: "allies", filters: [{ type: "alive", value: false }, { type: "not_self" }],
  sort: ["position_asc"], take: 1,
});

const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const SELF_IS_TARGET = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const EVENT_TARGET_IS_ALLY = Object.freeze({
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const SUPPORT_EVENT = Object.freeze({ type: "event_tag", tag: "support", value: true });
const MEDICAL_EVENT = Object.freeze({ type: "event_tag", tag: "medical_kit", value: true });
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const NOT_COST_DAMAGE = Object.freeze({ type: "event_tag", tag: "cost", value: false });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });

const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});

const medicalBarrier = (id, displayName, coefficientBps, displayEffect, flavorText, options = {}) => Object.freeze({
  id,
  displayName,
  displayEffect,
  flavorText,
  weaponId: "medical_kit",
  treePosition: options.treePosition,
  ...(options.replacesActiveSkillId ? { replacesActiveSkillId: options.replacesActiveSkillId } : {}),
  ...(options.usesPerBattle ? { usesPerBattle: options.usesPerBattle } : {}),
  apCost: 1,
  actionMode: "channel",
  intrinsicPredicates: options.intrinsicPredicates ?? [],
  targetQuery: options.targetQuery ?? WOUNDED_ALLY,
  effects: [
    ...(options.beforeEffects ?? []),
    {
      type: "gain_barrier",
      target: options.barrierTarget ?? EVENT_TARGETS,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps },
      duration: "round",
      tags: ["support", "weapon", "medical_kit"],
    },
    ...(options.afterEffects ?? []),
  ],
  tags: ["support", "weapon", "medical_kit", "playable"],
});

const ACTIVE = {
  medical_kit_treatment: Object.freeze({
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
  }),
  medical_kit_major_treatment: medicalBarrier(
    "medical_kit_major_treatment", "大治療", 16_000,
    "HP割合が最も低い味方1人に技術160%の防壁。",
    "包帯の数ではなく、受け止める厚みを選ぶ。",
    { treePosition: "A3", replacesActiveSkillId: "medical_kit_treatment" },
  ),
  medical_kit_full_procedure: medicalBarrier(
    "medical_kit_full_procedure", "全快処置", 25_000,
    "HP割合が最も低い味方1人に技術250%の防壁。負の状態をすべて除く。",
    "戻せないものを戻す代わりに、これから来るものを全部受ける。",
    {
      treePosition: "AA3", replacesActiveSkillId: "medical_kit_major_treatment",
      afterEffects: [{ type: "remove_statuses", target: EVENT_TARGETS, polarity: "negative" }],
    },
  ),
  medical_kit_field_treatment: medicalBarrier(
    "medical_kit_field_treatment", "野戦治療", 10_000,
    "生存している味方全員に技術100%の防壁。",
    "一人を完璧にするより、全員を次の一拍まで残す。",
    {
      treePosition: "AB3", replacesActiveSkillId: "medical_kit_major_treatment",
      targetQuery: ALL_ALLIES, barrierTarget: EVENT_TARGETS,
      intrinsicPredicates: [{ type: "target_exists", query: ALL_ALLIES }],
    },
  ),
  medical_kit_transfusion: Object.freeze({
    id: "medical_kit_transfusion",
    displayName: "輸血",
    displayEffect: "他の味方1人に技術220%の防壁を作り、自分のHPを最大値の20%失う。",
    flavorText: "命を分けるなら、こちらの分も同じ針へ通す。",
    weaponId: "medical_kit",
    treePosition: "B3",
    replacesActiveSkillId: "medical_kit_treatment",
    apCost: 1,
    actionMode: "channel",
    intrinsicPredicates: [{ type: "target_exists", query: OTHER_ALLY }, { type: "hp_percent", subject: "self", op: "gt", value: 20 }],
    targetQuery: OTHER_ALLY,
    effects: [
      {
        type: "deal_damage", target: SELF,
        amount: { type: "actor_stat_scaled", subject: "self", stat: "max_hp", numerator: 20, denominator: 100 },
        guardPierceBps: 10_000,
        tags: ["cost", "medical_kit"],
      },
      {
        type: "gain_barrier", target: EVENT_TARGETS,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 22_000 },
        duration: "round",
        tags: ["support", "weapon", "medical_kit", "transfusion"],
      },
    ],
    tags: ["support", "weapon", "medical_kit", "playable"],
  }),
  medical_kit_regenerative_procedure: medicalBarrier(
    "medical_kit_regenerative_procedure", "再生処置", 18_000,
    "味方1人に技術180%の防壁と再生薬3。",
    "いまの壁が消えても、次のラウンドの入口へ薬を置く。",
    {
      treePosition: "BA3", replacesActiveSkillId: "medical_kit_transfusion",
      afterEffects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "medical_kit_regeneration", stacks: 3 }],
    },
  ),
  medical_kit_time_surgery: medicalBarrier(
    "medical_kit_time_surgery", "時間外手術", 25_000,
    "戦闘中1回、倒れた味方を最大HP50%で蘇生。倒れた味方がいなければ不発。",
    "倒れる時間を消せないなら、倒れる前の一拍を長くする。",
    {
      treePosition: "BB3", replacesActiveSkillId: "medical_kit_transfusion", usesPerBattle: 1,
      targetQuery: DEFEATED_ALLY,
      intrinsicPredicates: [
        { type: "target_exists", query: DEFEATED_ALLY },
        { type: "hp_percent", subject: "self", op: "gt", value: 25 },
      ],
      beforeEffects: [{
        type: "deal_damage", target: SELF,
        amount: { type: "actor_stat_scaled", subject: "self", stat: "max_hp", numerator: 25, denominator: 100 },
        guardPierceBps: 10_000, tags: ["cost", "medical_kit", "time_surgery"],
      }],
      afterEffects: [
        {
          type: "revive", target: EVENT_TARGETS,
          amount: { type: "actor_stat_scaled", subject: "event_primary_target", stat: "max_hp", numerator: 50, denominator: 100 },
          tags: ["support", "medical_kit", "surgery"],
        },
        { type: "remove_statuses", target: EVENT_TARGETS, polarity: "negative" },
      ],
    },
  ),
};

const PASSIVE = {
  medical_kit_clean_tools: Object.freeze({
    id: "medical_kit_clean_tools", displayName: "清潔な器具", weaponId: "medical_kit", treePosition: "A1",
    displayEffect: "医療具が作る防壁の合計量+15%。", flavorText: "器具の清潔さは、そのまま受け止める厚みになる。",
    rules: [{
      id: "medical_kit_clean_tools_rule", listenTo: "barrier_proposed", timing: "interrupt", priority: 41,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(15) }],
      allowRepeatInChain: true, limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
  medical_kit_wash: Object.freeze({
    id: "medical_kit_wash", displayName: "洗浄", weaponId: "medical_kit", treePosition: "A2",
    displayEffect: "医療具の防壁を受けた味方から、負の状態を1種類除く。",
    flavorText: "傷口の周りに残ったものを、壁の内側へ持ち込まない。",
    rules: [{
      id: "medical_kit_wash_rule", listenTo: "barrier_gained", timing: "after", priority: 82,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [],
      effects: [{ type: "remove_statuses", target: ONE_EVENT_TARGET, polarity: "negative" }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
  medical_kit_stimulant_protocol: Object.freeze({
    id: "medical_kit_stimulant_protocol", displayName: "強心剤", weaponId: "medical_kit", treePosition: "AA1",
    displayEffect: "防壁を受けた味方に、攻撃+20%の活性剤を付ける。",
    flavorText: "守られた一拍を、そのまま打ち返す力へ変える。",
    rules: [{
      id: "medical_kit_stimulant_protocol_rule", listenTo: "barrier_gained", timing: "after", priority: 81,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [],
      effects: [{ type: "add_status", target: ONE_EVENT_TARGET, statusId: "medical_kit_stimulant", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
  medical_kit_surplus_bandage: Object.freeze({
    id: "medical_kit_surplus_bandage", displayName: "余剰包帯", weaponId: "medical_kit", treePosition: "AA2",
    displayEffect: "防壁を受けた味方に、次の被弾を包む予備包帯を残す。",
    flavorText: "余ったものは捨てず、次の穴が開く場所へ折っておく。",
    rules: [{
      id: "medical_kit_surplus_bandage_rule", listenTo: "barrier_gained", timing: "after", priority: 80,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [],
      effects: [{ type: "add_status", target: ONE_EVENT_TARGET, statusId: "medical_kit_surplus", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
  medical_kit_wide_spray: Object.freeze({
    id: "medical_kit_wide_spray", displayName: "広域散布", weaponId: "medical_kit", treePosition: "AB1",
    displayEffect: "単体の医療具支援が、次に傷の深い別の味方にも届く。",
    flavorText: "一人へ吹いた霧が、隣の呼吸まで拾う。",
    rules: [{
      id: "medical_kit_wide_spray_rule", listenTo: "barrier_gained", timing: "after", priority: 78,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [],
      effects: [{
        type: "gain_barrier", target: OTHER_WOUNDED_ALLY,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 5_000 },
        duration: "round", tags: ["support", "medical_kit", "wide_spray"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
  medical_kit_equal_dose: Object.freeze({
    id: "medical_kit_equal_dose", displayName: "同量投与", weaponId: "medical_kit", treePosition: "AB2",
    displayEffect: "複数対象へ作る医療具の防壁に、対象数による減衰を置かない。",
    flavorText: "全員へ配るなら、全員へ同じ厚みで配る。",
    rules: [{
      id: "medical_kit_equal_dose_rule", listenTo: "barrier_proposed", timing: "interrupt", priority: 40,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(10) }],
      allowRepeatInChain: true, limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
  medical_kit_danger_zone: Object.freeze({
    id: "medical_kit_danger_zone", displayName: "危険域", weaponId: "medical_kit", treePosition: "B1",
    displayEffect: "HP25%以下の味方へ作る防壁量+100%。",
    flavorText: "危険域では、包帯より先に厚い壁を置く。",
    rules: [{
      id: "medical_kit_danger_zone_rule", listenTo: "barrier_proposed", timing: "interrupt", priority: 42,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT, { type: "hp_percent", subject: "event_primary_target", op: "lte", value: 25 }], costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(100) }],
      allowRepeatInChain: true, limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
  medical_kit_active_agent: Object.freeze({
    id: "medical_kit_active_agent", displayName: "活性剤", weaponId: "medical_kit", treePosition: "BA1",
    displayEffect: "医療具の防壁を受けた味方へ、攻撃を強める活性剤を渡す。",
    flavorText: "包帯の下で脈が戻ったなら、次の手は早くなる。",
    rules: [{
      id: "medical_kit_active_agent_rule", listenTo: "barrier_gained", timing: "after", priority: 77,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [],
      effects: [{ type: "add_status", target: ONE_EVENT_TARGET, statusId: "medical_kit_stimulant", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
  medical_kit_reserve_blood_protocol: Object.freeze({
    id: "medical_kit_reserve_blood_protocol", displayName: "予備血", weaponId: "medical_kit", treePosition: "BB1",
    displayEffect: "医療具の支援を受けた味方に予備血を残し、次の被弾で防壁へ変える。",
    flavorText: "使う時まで、血は静かに待たせる。",
    rules: [{
      id: "medical_kit_reserve_blood_skill_rule", listenTo: "barrier_gained", timing: "after", priority: 76,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [],
      effects: [{ type: "add_status", target: ONE_EVENT_TARGET, statusId: "medical_kit_reserve_blood", stacks: 1 }],
      limit: CHAIN_ONCE,
    }, {
      id: "medical_kit_reserve_blood_spend_rule", listenTo: "damage_taken", timing: "after", priority: 54,
      predicates: [SELF_IS_TARGET, NOT_COST_DAMAGE, { type: "has_status", subject: "self", statusId: "medical_kit_surplus", op: "gte", value: 1 }], costs: [],
      effects: [
        {
          type: "gain_barrier", target: SELF,
          amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 5_000 },
          duration: "round", tags: ["support", "medical_kit", "reserve"],
        },
        { type: "remove_status", target: SELF, statusId: "medical_kit_surplus", stacks: "all" },
      ],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "support", "medical_kit", "playable"],
  }),
};

const REACTIVE = {
  medical_kit_emergency_revive: Object.freeze({
    id: "medical_kit_emergency_revive", displayName: "緊急蘇生", weaponId: "medical_kit", treePosition: "B2",
    displayEffect: "味方が倒れた時、RP2で技術80%のHPで蘇生する。",
    flavorText: "倒れる音を、戦線から消える合図にはしない。",
    rules: [{
      id: "medical_kit_emergency_revive_rule", listenTo: "actor_defeated", timing: "after", priority: 91,
      predicates: [EVENT_TARGET_IS_ALLY], costs: [{ type: "spend_reaction_points", amount: 2 }],
      effects: [{
        type: "revive", target: ONE_EVENT_TARGET,
        amount: { type: "actor_stat_scaled", subject: "event_primary_target", stat: "max_hp", numerator: 80, denominator: 100 },
        tags: ["support", "medical_kit", "emergency"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "support", "medical_kit", "playable"],
  }),
  medical_kit_regenerative_drug: Object.freeze({
    id: "medical_kit_regenerative_drug", displayName: "再生薬", weaponId: "medical_kit", treePosition: "BA2",
    displayEffect: "味方へ医療具の防壁を作った時、RP1で再生薬3を付ける。",
    flavorText: "壁が壊れた後にも、もう一度だけ入口を作っておく。",
    rules: [{
      id: "medical_kit_regenerative_drug_rule", listenTo: "barrier_gained", timing: "after", priority: 75,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, MEDICAL_EVENT], costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "add_status", target: ONE_EVENT_TARGET, statusId: "medical_kit_regeneration", stacks: 3 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "support", "medical_kit", "playable"],
  }),
  medical_kit_life_collateral: Object.freeze({
    id: "medical_kit_life_collateral", displayName: "生命担保", weaponId: "medical_kit", treePosition: "BB2",
    displayEffect: "予備血がある時、RP1で倒れた味方を技術50%のHPで蘇生し、予備血を使い切る。",
    flavorText: "残していた分を、最後の一人へ全部渡す。",
    rules: [{
      id: "medical_kit_life_collateral_rule", listenTo: "actor_defeated", timing: "after", priority: 92,
      predicates: [EVENT_TARGET_IS_ALLY, { type: "has_status", subject: "self", statusId: "medical_kit_reserve_blood", op: "gte", value: 1 }],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [
        {
          type: "revive", target: ONE_EVENT_TARGET,
          amount: { type: "actor_stat_scaled", subject: "event_primary_target", stat: "max_hp", numerator: 50, denominator: 100 },
          tags: ["support", "medical_kit", "reserve"],
        },
        { type: "remove_status", target: SELF, statusId: "medical_kit_reserve_blood", stacks: "all" },
      ],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "support", "medical_kit", "playable"],
  }),
};

export const MEDICAL_KIT_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const MEDICAL_KIT_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const MEDICAL_KIT_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const MEDICAL_KIT_TARGET_SKILLS = Object.freeze({});

export const MEDICAL_KIT_TREE = Object.freeze([
  ["R", "active", "medical_kit_treatment", []],
  ["A1", "passive", "medical_kit_clean_tools", ["medical_kit_treatment"]],
  ["A2", "passive", "medical_kit_wash", ["medical_kit_clean_tools"]],
  ["A3", "active", "medical_kit_major_treatment", ["medical_kit_wash"]],
  ["AA1", "passive", "medical_kit_stimulant_protocol", ["medical_kit_major_treatment"]],
  ["AA2", "passive", "medical_kit_surplus_bandage", ["medical_kit_stimulant_protocol"]],
  ["AA3", "active", "medical_kit_full_procedure", ["medical_kit_surplus_bandage"]],
  ["AB1", "passive", "medical_kit_wide_spray", ["medical_kit_major_treatment"]],
  ["AB2", "passive", "medical_kit_equal_dose", ["medical_kit_wide_spray"]],
  ["AB3", "active", "medical_kit_field_treatment", ["medical_kit_equal_dose"]],
  ["B1", "passive", "medical_kit_danger_zone", ["medical_kit_treatment"]],
  ["B2", "reactive", "medical_kit_emergency_revive", ["medical_kit_danger_zone"]],
  ["B3", "active", "medical_kit_transfusion", ["medical_kit_emergency_revive"]],
  ["BA1", "passive", "medical_kit_active_agent", ["medical_kit_transfusion"]],
  ["BA2", "reactive", "medical_kit_regenerative_drug", ["medical_kit_active_agent"]],
  ["BA3", "active", "medical_kit_regenerative_procedure", ["medical_kit_regenerative_drug"]],
  ["BB1", "passive", "medical_kit_reserve_blood_protocol", ["medical_kit_transfusion"]],
  ["BB2", "reactive", "medical_kit_life_collateral", ["medical_kit_reserve_blood_protocol"]],
  ["BB3", "active", "medical_kit_time_surgery", ["medical_kit_life_collateral"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "medical_kit", position, kind, skillId, requires: Object.freeze(requires),
})));
