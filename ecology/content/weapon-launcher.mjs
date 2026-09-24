// R25 — 射出器19節。PR #287 の射出器契約を、共有 target/status/action event へ接続する。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const EVENT_SOURCE = Object.freeze({ scope: "event_source", take: 1 });
const BASE_TARGET = Object.freeze({ scope: "action_base_targets", take: "all" });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["distance_to_self_asc"], take: 1,
});
const ENEMIES = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["distance_to_self_asc"], take: "all",
});
const HEALER_OR_BARRIER = Object.freeze({
  scope: "enemies",
  filters: [
    { type: "alive" },
    { type: "has_any_skill_effect", effectTypes: ["heal", "gain_barrier"] },
  ],
  sort: [
    { type: "skill_effect_priority_asc", effectTypes: ["heal", "gain_barrier"] },
    "distance_to_self_asc",
  ],
  take: 1,
});
const PREPARING_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "is_preparing", value: true }],
  sort: ["preparation_steps_desc", "distance_to_self_asc"],
  take: 1,
});

const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const EVENT_SOURCE_IS_ALLY = Object.freeze({
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "is_event_source" }], take: 1 },
});
const EVENT_SOURCE_IS_ENEMY = Object.freeze({
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_source" }, { type: "alive" }], take: 1 },
});
const EVENT_TARGET_IS_OTHER_ALLY = Object.freeze({
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "is_event_target" }, { type: "not_self" }], take: 1 },
});
const EVENT_TARGET_IS_LIVING_OBSERVED = Object.freeze({
  type: "target_exists",
  query: {
    scope: "event_targets",
    filters: [
      { type: "alive" },
      { type: "has_status", statusId: "launcher_observed", op: "gte", value: 1 },
    ],
    take: 1,
  },
});
const EVENT_TARGET_IS_LIVING_EXPOSED = Object.freeze({
  type: "target_exists",
  query: {
    scope: "event_targets",
    filters: [
      { type: "alive" },
      { type: "has_status", statusId: "launcher_exposed", op: "gte", value: 1 },
    ],
    take: 1,
  },
});
const BASE_TARGET_IS_LIVING = Object.freeze({
  type: "target_exists",
  query: { ...BASE_TARGET, filters: [{ type: "alive" }] },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const RANGED_EVENT = Object.freeze({ type: "event_tag", tag: "ranged", value: true });
const NOT_EXTRA_HIT = Object.freeze({ type: "event_tag", tag: "extra_hit", value: false });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent, key = "amount") => ({
  type: "event_value_scaled", key, numerator: percent, denominator: 100,
});
const hitIndexIs = (index) => ({ type: "event_value", key: "hitIndex", op: "eq", value: index });

function active(id, displayName, coefficientBps, displayEffect, flavorText, options = {}) {
  const damage = {
    type: "deal_damage",
    target: options.targetPattern ? { scope: "event_targets", take: 1 } : EVENT_TARGETS,
    amount: options.amount ?? {
      type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps,
    },
    rangeClass: "ranged",
    ...(options.hitCount ? { hitCount: options.hitCount } : {}),
    ...(options.targetPattern ? { targetPattern: options.targetPattern } : {}),
    tags: ["attack", "weapon", "launcher", "ranged"],
  };
  return Object.freeze({
    id,
    displayName,
    displayEffect,
    flavorText,
    weaponId: "launcher",
    treePosition: options.treePosition,
    ...(options.replacesActiveSkillId
      ? { replacesActiveSkillId: options.replacesActiveSkillId }
      : {}),
    ...(options.preserveStatusIdsOnResolve
      ? { preserveStatusIdsOnResolve: options.preserveStatusIdsOnResolve }
      : {}),
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: options.targetQuery ?? ENEMY,
    effects: [damage, ...(options.afterEffects ?? [])],
    tags: ["attack", "weapon", "launcher", "ranged", "playable"],
  });
}

const ACTIVE = {
  launcher_shot: active(
    "launcher_shot", "射出", 10_000,
    "敵1体に技術100%のダメージ。", "必要な一本だけ、正しく通す。",
    { treePosition: "R" },
  ),
  launcher_large_shot: active(
    "launcher_large_shot", "大口径射出", 15_000,
    "敵1体に技術150%のダメージ。", "一発へ詰めた圧を、逃げ道のない線にする。",
    { treePosition: "A3", replacesActiveSkillId: "launcher_shot" },
  ),
  launcher_siege_shot: active(
    "launcher_siege_shot", "穿城射", 22_000,
    "敵1体に技術220%のダメージ。", "壁を撃つなら、壁の向こうまで届く芯を選ぶ。",
    { treePosition: "AA3", replacesActiveSkillId: "launcher_large_shot" },
  ),
  launcher_double_shot: active(
    "launcher_double_shot", "二連射", 9_000,
    "同じ敵に技術90%のダメージを2hit。", "二つの弾が、別々の逃げ道を同時に塞ぐ。",
    { treePosition: "AB3", replacesActiveSkillId: "launcher_large_shot", hitCount: 2 },
  ),
  launcher_designated_shot: active(
    "launcher_designated_shot", "指定射", 16_000,
    "敵1体に技術160%。準備中またはHP回復を行う敵なら技術230%。",
    "狙う理由も落とす順番も、引き金の前に決めてあります。",
    {
      treePosition: "B3",
      replacesActiveSkillId: "launcher_shot",
      amount: {
        type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 16_000,
        targetConditionalCoefficient: {
          memoryKey: "launcher_designated_bonus",
          bonusBps: 7_000,
          mode: "any",
          conditions: [
            { type: "is_preparing" },
            { type: "has_skill_effect", effectType: "heal" },
          ],
        },
      },
    },
  ),
  launcher_volley_aim: active(
    "launcher_volley_aim", "一斉照準", 16_000,
    "選んだ敵のいる一列に技術160%のダメージ。基準対象に観測2。",
    "私が開けた一点へ、全員の狙いを重ねてください。",
    {
      treePosition: "BA3",
      replacesActiveSkillId: "launcher_designated_shot",
      targetPattern: "row",
      preserveStatusIdsOnResolve: ["launcher_observed"],
      afterEffects: [{ type: "add_status", target: BASE_TARGET, statusId: "launcher_observed", stacks: 2 }],
    },
  ),
  launcher_three_point: active(
    "launcher_three_point", "一点集中射", 12_000,
    "敵1体に技術120%。攻撃開始時に露呈があれば200%になり、攻撃後に露呈を全消費。",
    "一点へ圧を集め、そこだけを撃ち抜きます。",
    {
      treePosition: "BB3",
      replacesActiveSkillId: "launcher_designated_shot",
      amount: {
        type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 12_000,
        targetConditionalCoefficient: {
          memoryKey: "launcher_concentrated_bonus",
          bonusBps: 8_000,
          mode: "any",
          conditions: [{ type: "has_status", statusId: "launcher_exposed", value: 1 }],
        },
      },
      afterEffects: [{
        type: "remove_status", target: BASE_TARGET, statusId: "launcher_exposed", stacks: "all",
      }],
    },
  ),
};

function damageBoostPassive(id, displayName, percent, predicates, displayEffect, flavorText, treePosition) {
  return Object.freeze({
    id, displayName, displayEffect, flavorText, weaponId: "launcher", treePosition,
    rules: [{
      id: id + "_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      priority: 42,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, RANGED_EVENT, ...predicates],
      allowRepeatInChain: true,
      costs: [],
      effects: [{
        type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(percent),
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }],
    tags: ["passive", "attack", "launcher", "playable"],
  });
}

function flatGuardIgnorePassive(id, displayName, amount, predicates, displayEffect, flavorText, treePosition) {
  return Object.freeze({
    id, displayName, displayEffect, flavorText, weaponId: "launcher", treePosition,
    rules: [{
      id: id + "_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      priority: 51,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, RANGED_EVENT, ...predicates],
      allowRepeatInChain: true,
      costs: [],
      effects: [{ type: "modify_pending_guard", amount: { type: "constant", value: amount } }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }],
    tags: ["passive", "attack", "launcher", "playable"],
  });
}

const PASSIVE = {
  launcher_high_pressure: damageBoostPassive(
    "launcher_high_pressure", "高圧筒", 15, [hitIndexIs(0)],
    "自分の遠隔攻撃の第1hitのダメージ+15%。", "圧を逃がさず、一点へ。", "A1",
  ),
  launcher_piercing_needle: flatGuardIgnorePassive(
    "launcher_piercing_needle", "穿孔針", 8, [],
    "自分の遠隔攻撃は対象の受けを8無視する。", "細い針ほど、守りの隙を通る。", "A2",
  ),
  launcher_compressed_charge: damageBoostPassive(
    "launcher_compressed_charge", "圧縮薬", 15, [hitIndexIs(0)],
    "自分の遠隔攻撃の第1hitのダメージ+15%。", "一滴に、もう一滴ぶんを詰める。", "AA1",
  ),
  launcher_hard_core: damageBoostPassive(
    "launcher_hard_core", "硬芯", 20,
    [{ type: "pending_base_target_has_negative_status" }],
    "自分の遠隔攻撃は基礎対象に弱体があればダメージ+20%。",
    "折れない芯が圧を逃がさず、守りのさらに奥へ処置を運ぶ。", "AA2",
  ),
  launcher_rangefinder: damageBoostPassive(
    "launcher_rangefinder", "測距", 20,
    [{ type: "target_exists", query: {
      scope: "event_targets", filters: [{ type: "has_status", statusId: "launcher_observed", op: "gte", value: 1 }], take: 1,
    } }],
    "自分が観測中の敵へ与える攻撃ダメージ+20%。",
    "開いた穴を測り直せば、次の一発は迷わない。", "BA2",
  ),
};

const REACTIVE = {
  launcher_multi_barrel: Object.freeze({
    id: "launcher_multi_barrel", displayName: "連装筒", weaponId: "launcher", treePosition: "AB1",
    displayEffect: "遠隔攻撃の1hit目命中時、RP1で同じ敵へ基礎量50%の追撃。1行動1回。",
    flavorText: "一本で足りないなら、筒を増やす。",
    rules: [{
      id: "launcher_multi_barrel_rule",
      listenTo: "damage_resolved", timing: "after", priority: 82,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT, RANGED_EVENT, NOT_EXTRA_HIT, hitIndexIs(0),
        { type: "target_exists", query: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 } },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "deal_damage", target: EVENT_TARGETS, amount: percentOfEvent(50, "proposed"),
        independentAttack: true,
        tags: ["attack", "weapon", "launcher", "ranged", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "attack", "launcher", "playable"],
  }),
  launcher_support_shell: Object.freeze({
    id: "launcher_support_shell", displayName: "援護弾", weaponId: "launcher", treePosition: "AB2",
    displayEffect: "敵の攻撃で別の味方がHPダメージを受けた時、RP1で攻撃者へ技術60%の援護射撃。1チェイン1回。",
    flavorText: "仲間へ向いた一撃へ、こちらから先に正確な返事を送る。",
    rules: [{
      id: "launcher_support_shell_rule",
      listenTo: "damage_taken", timing: "after", priority: 64,
      predicates: [EVENT_SOURCE_IS_ENEMY, EVENT_TARGET_IS_OTHER_ALLY, ATTACK_EVENT],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "deal_damage", target: EVENT_SOURCE,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 6_000 },
        independentAttack: true, rangeClass: "ranged",
        tags: ["attack", "weapon", "launcher", "ranged", "support", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "attack", "launcher", "playable"],
  }),
  launcher_observation_hole: Object.freeze({
    id: "launcher_observation_hole", displayName: "観測孔", weaponId: "launcher", treePosition: "BA1",
    displayEffect: "攻撃後、基準対象へ観測3。味方が観測対象へ攻撃を命中させると、自分が技術30%で追撃（ラウンド1回）。",
    flavorText: "見える穴を開ければ、皆がそこを狙える。",
    rules: [
      {
        id: "launcher_observation_hole_mark_rule",
        listenTo: "action_resolved", timing: "after", priority: 84,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT, BASE_TARGET_IS_LIVING],
        allowRepeatInChain: true,
        costs: [],
        effects: [{ type: "add_status", target: BASE_TARGET, statusId: "launcher_observed", stacks: 3 }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      },
      {
        id: "launcher_observation_hole_followup_rule",
        listenTo: "damage_resolved", timing: "after", priority: 56,
        predicates: [EVENT_SOURCE_IS_ALLY, ATTACK_EVENT, NOT_EXTRA_HIT, EVENT_TARGET_IS_LIVING_OBSERVED],
        costs: [],
        effects: [{
          type: "deal_damage", target: EVENT_TARGETS,
          amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 3_000 },
          independentAttack: true, rangeClass: "ranged",
          tags: ["attack", "weapon", "launcher", "ranged", "extra_hit"],
        }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      },
    ],
    tags: ["reaction", "attack", "launcher", "playable"],
  }),
  launcher_order_table: Object.freeze({
    id: "launcher_order_table", displayName: "弱点標", weaponId: "launcher", treePosition: "BB1",
    displayEffect: "自分の攻撃後、基準対象が生存していればRP1で露呈2。",
    flavorText: "三手先ではなく、今撃つ一体だけを見ればいい。",
    rules: [{
      id: "launcher_weakpoint_mark_rule",
      listenTo: "action_resolved", timing: "after", priority: 45,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, BASE_TARGET_IS_LIVING],
      allowRepeatInChain: true,
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "add_status", target: BASE_TARGET, statusId: "launcher_exposed", stacks: 2 }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["reaction", "attack", "launcher", "playable"],
  }),
  launcher_order_check: Object.freeze({
    id: "launcher_order_check", displayName: "合点射", weaponId: "launcher", treePosition: "BB2",
    displayEffect: "味方の攻撃が露呈中の生存敵へ命中した時、RP1で技術50%の追撃。1チェイン1回。",
    flavorText: "小さな合図が敵の隙を照らし、味方の狙いを揃える。",
    rules: [{
      id: "launcher_agreement_shot_rule",
      listenTo: "damage_resolved", timing: "after", priority: 62,
      predicates: [EVENT_SOURCE_IS_ALLY, ATTACK_EVENT, NOT_EXTRA_HIT, EVENT_TARGET_IS_LIVING_EXPOSED],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "deal_damage", target: EVENT_TARGETS,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 5_000 },
        independentAttack: true, rangeClass: "ranged",
        tags: ["attack", "weapon", "launcher", "ranged", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "attack", "launcher", "playable"],
  }),
};

const TARGET = {
  launcher_pull_healer: Object.freeze({
    id: "launcher_pull_healer", displayName: "医療役を抜く", weaponId: "launcher", treePosition: "B1",
    displayEffect: "HP回復を行う敵を優先し、いなければ防壁を付与する敵を優先。",
    flavorText: "治す手から止めるのが合理的です。",
    targetQuery: HEALER_OR_BARRIER,
    tags: ["target", "attack", "launcher", "playable"],
  }),
  launcher_skip_preparation: Object.freeze({
    id: "launcher_skip_preparation", displayName: "準備を抜く", weaponId: "launcher", treePosition: "B2",
    displayEffect: "準備中の敵を優先。準備値が高い敵から選ぶ。",
    flavorText: "完成する前なら、ただの隙です。",
    targetQuery: PREPARING_ENEMY,
    tags: ["target", "attack", "launcher", "playable"],
  }),
};

export const LAUNCHER_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const LAUNCHER_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const LAUNCHER_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const LAUNCHER_TARGET_SKILLS = Object.freeze(TARGET);

export const LAUNCHER_TREE = Object.freeze([
  ["R", "active", "launcher_shot", []],
  ["A1", "passive", "launcher_high_pressure", ["launcher_shot"]],
  ["A2", "passive", "launcher_piercing_needle", ["launcher_high_pressure"]],
  ["A3", "active", "launcher_large_shot", ["launcher_piercing_needle"]],
  ["AA1", "passive", "launcher_compressed_charge", ["launcher_large_shot"]],
  ["AA2", "passive", "launcher_hard_core", ["launcher_compressed_charge"]],
  ["AA3", "active", "launcher_siege_shot", ["launcher_hard_core"]],
  ["AB1", "reactive", "launcher_multi_barrel", ["launcher_large_shot"]],
  ["AB2", "reactive", "launcher_support_shell", ["launcher_multi_barrel"]],
  ["AB3", "active", "launcher_double_shot", ["launcher_support_shell"]],
  ["B1", "target", "launcher_pull_healer", ["launcher_shot"]],
  ["B2", "target", "launcher_skip_preparation", ["launcher_pull_healer"]],
  ["B3", "active", "launcher_designated_shot", ["launcher_skip_preparation"]],
  ["BA1", "reactive", "launcher_observation_hole", ["launcher_designated_shot"]],
  ["BA2", "passive", "launcher_rangefinder", ["launcher_observation_hole"]],
  ["BA3", "active", "launcher_volley_aim", ["launcher_rangefinder"]],
  ["BB1", "reactive", "launcher_order_table", ["launcher_designated_shot"]],
  ["BB2", "reactive", "launcher_order_check", ["launcher_order_table"]],
  ["BB3", "active", "launcher_three_point", ["launcher_order_check"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "launcher", position, kind, skillId, requires: Object.freeze(requires),
})));
