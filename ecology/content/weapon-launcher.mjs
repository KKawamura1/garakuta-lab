// R25 — 射出器19節。
//
// 射出器は、遠隔の防壁越し・対象観測・射順を共有イベントへ落とす。
// 個別の「回復役ID」や「敵技能ID」を読まず、準備中・状態・対象選択と
// いう公開された戦場事実だけを使う。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});
const ENEMIES = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: "all",
});
const HEALING_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "has_status", statusId: "warded", op: "gte", value: 1 }],
  sort: ["hp_percent_asc", "position_asc"],
  take: 1,
});
const PREPARING_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "is_preparing", value: true }],
  sort: ["position_asc"],
  take: 1,
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const EVENT_SOURCE_IS_ALLY = Object.freeze({
  type: "target_exists",
  query: {
    scope: "allies",
    filters: [{ type: "is_event_source" }, { type: "not_self" }],
    take: 1,
  },
});
const EVENT_TARGET_IS_OBSERVED = Object.freeze({
  type: "target_exists",
  query: {
    scope: "enemies",
    filters: [
      { type: "alive" },
      { type: "is_event_primary_target" },
      { type: "has_status", statusId: "launcher_observed", op: "gte", value: 1 },
    ],
    take: 1,
  },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const RANGED_EVENT = Object.freeze({ type: "event_tag", tag: "ranged", value: true });
const NOT_EXTRA_HIT = Object.freeze({ type: "event_tag", tag: "extra_hit", value: false });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});
const hitCountIs = (count) => ({ type: "event_value", key: "hitCount", op: "eq", value: count });
const hitCountAtLeast = (count) => ({
  type: "event_value", key: "hitCount", op: "gte", value: count,
});
const hitIndexIs = (index) => ({ type: "event_value", key: "hitIndex", op: "eq", value: index });
const exactStatus = (statusId, stacks) => ({
  type: "has_status", subject: "self", statusId, op: "eq", value: stacks,
});

function active(id, displayName, coefficientBps, displayEffect, flavorText, options = {}) {
  const damage = {
    type: "deal_damage",
    target: EVENT_TARGETS,
    amount: options.amount ?? {
      type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps,
    },
    rangeClass: "ranged",
    ...(options.hitCount ? { hitCount: options.hitCount } : {}),
    ...(options.hitDistribution ? { hitDistribution: options.hitDistribution } : {}),
    ...(options.guardPierceBps ? { guardPierceBps: options.guardPierceBps } : {}),
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
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: options.targetQuery ?? ENEMY,
    effects: [...(options.beforeEffects ?? []), damage, ...(options.afterEffects ?? [])],
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
    "敵1体に技術220%のダメージ。防御を12無視する。",
    "壁を撃つなら、壁の向こうまで届く芯を選ぶ。",
    { treePosition: "AA3", replacesActiveSkillId: "launcher_large_shot", guardPierceBps: 1_200 },
  ),
  launcher_double_shot: active(
    "launcher_double_shot", "二剤射出", 9_000,
    "同じ敵に技術90%のダメージを2hit。", "二つの薬筒を、同じ傷口へ順番に送る。",
    { treePosition: "AB3", replacesActiveSkillId: "launcher_large_shot", hitCount: 2 },
  ),
  launcher_designated_shot: active(
    "launcher_designated_shot", "指定射", 18_000,
    "優先対象へ技術180%のダメージ。対象がなければ最寄りを狙う。",
    "指定した線だけを、他の音より太くする。",
    { treePosition: "B3", replacesActiveSkillId: "launcher_shot" },
  ),
  launcher_volley_aim: active(
    "launcher_volley_aim", "一斉照準", 16_000,
    "敵1体に技術160%のダメージ。対象を観測済みにする。",
    "一発の照準を、味方全員の次の一発へ渡す。",
    {
      treePosition: "BA3",
      replacesActiveSkillId: "launcher_designated_shot",
      afterEffects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "launcher_observed", stacks: 3 }],
    },
  ),
  launcher_three_point: active(
    "launcher_three_point", "三点予約射", 8_000,
    "生きている敵へ技術80%の射出を3回。", "三つの点を先に取り、空いた場所へも照準を残す。",
    {
      treePosition: "BB3",
      replacesActiveSkillId: "launcher_designated_shot",
      targetQuery: ENEMIES,
      hitCount: 3,
      hitDistribution: "round_robin",
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
        type: "modify_pending_amount",
        operation: "increase",
        amount: percentOfEvent(percent),
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "attack", "launcher", "playable"],
  });
}

const PASSIVE = {
  launcher_high_pressure: damageBoostPassive(
    "launcher_high_pressure", "高圧筒", 15, [hitCountIs(1)],
    "1hit遠隔攻撃の合計ダメージ+15%。", "一本へ詰める圧を、最後まで逃がさない。", "A1",
  ),
  launcher_compressed_charge: damageBoostPassive(
    "launcher_compressed_charge", "圧縮薬", 15, [hitCountIs(1)],
    "1hit遠隔攻撃の合計ダメージをさらに+15%。", "圧縮した薬量は、着弾してから広がる。", "AA1",
  ),
  launcher_hard_core: damageBoostPassive(
    "launcher_hard_core", "硬芯", 6, [hitCountAtLeast(1)],
    "射出の芯が硬くなり、防御を6無視する（現行防御境界では追加の貫通打として表現）。",
    "防壁の表面ではなく、奥の一点を撃つ。", "AA2",
  ),
  launcher_multi_barrel: Object.freeze({
    id: "launcher_multi_barrel", displayName: "連装筒", weaponId: "launcher", treePosition: "AB1",
    displayEffect: "準備なしの1hit遠隔攻撃の後、同じ敵へ60%の追加hit。",
    flavorText: "一つの筒を空ける前に、次の筒を同じ線へ合わせる。",
    rules: [{
      id: "launcher_multi_barrel_rule",
      listenTo: "damage_proposed", timing: "after", priority: 82,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT, RANGED_EVENT, NOT_EXTRA_HIT,
        hitCountIs(1), hitIndexIs(0),
        { type: "event_tag", tag: "prepared", value: false },
      ],
      costs: [],
      effects: [{
        type: "deal_damage",
        target: { scope: "event_targets", take: "all" },
        amount: percentOfEvent(60),
        rangeClass: "ranged",
        tags: ["attack", "weapon", "launcher", "ranged", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "attack", "launcher", "playable"],
  }),
  launcher_separate_caliber: Object.freeze({
    id: "launcher_separate_caliber", displayName: "別口径", weaponId: "launcher", treePosition: "AB2",
    displayEffect: "2hit攻撃の2hit目は防壁を無視する（現行防御境界では追加の貫通打として表現）。",
    flavorText: "同じ薬でも、二つ目は守りの隙間へ通す。",
    rules: [{
      id: "launcher_separate_caliber_rule",
      listenTo: "damage_proposed", timing: "interrupt", priority: 43,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, RANGED_EVENT, hitCountAtLeast(2), hitIndexIs(1)],
      allowRepeatInChain: true,
      costs: [],
      effects: [{
        type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(15),
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "attack", "launcher", "playable"],
  }),
  launcher_observation_hole: Object.freeze({
    id: "launcher_observation_hole", displayName: "観測孔", weaponId: "launcher", treePosition: "BA1",
    displayEffect: "対象を選んだ敵を観測済みにする。観測対象は味方の攻撃で優先される。",
    flavorText: "撃つ前に見たものが、撃った後の味方を導く。",
    rules: [{
      id: "launcher_observation_hole_rule",
      listenTo: "target_selected", timing: "after", priority: 84,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT],
      costs: [],
      effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "launcher_observed", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "target", "launcher", "playable"],
  }),
  launcher_order_table: Object.freeze({
    id: "launcher_order_table", displayName: "射順表", weaponId: "launcher", treePosition: "BB1",
    displayEffect: "ラウンド開始時、射順を評価し、自分の攻撃を1段につき10%強化する。最大3段。",
    flavorText: "順番を先に決めれば、迷いは照準から消える。",
    rules: [{
      id: "launcher_order_table_round_rule",
      listenTo: "round_started", timing: "after", priority: 44,
      predicates: [],
      costs: [],
      effects: [{ type: "add_status", target: SELF, statusId: "launcher_order_mark", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
    }, ...[1, 2, 3].map((stacks) => ({
      id: "launcher_order_table_boost_" + stacks + "_rule",
      listenTo: "damage_proposed", timing: "interrupt", priority: 40,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, exactStatus("launcher_order_mark", stacks)],
      allowRepeatInChain: true,
      costs: [],
      effects: [{
        type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(10 * stacks),
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }))],
    tags: ["passive", "attack", "launcher", "playable"],
  }),
  launcher_order_check: Object.freeze({
    id: "launcher_order_check", displayName: "予定照合", weaponId: "launcher", treePosition: "BB2",
    displayEffect: "射順表の記録に沿って命中した攻撃は、さらにダメージ+10%。",
    flavorText: "予定と着弾が重なった時だけ、次の点が見える。",
    rules: [1, 2, 3].map((stacks) => ({
      id: "launcher_order_check_" + stacks + "_rule",
      listenTo: "damage_proposed", timing: "interrupt", priority: 39,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, exactStatus("launcher_order_mark", stacks)],
      allowRepeatInChain: true,
      costs: [],
      effects: [{
        type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(10),
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    })),
    tags: ["passive", "attack", "launcher", "playable"],
  }),
};

const REACTIVE = {
  launcher_piercing_needle: Object.freeze({
    id: "launcher_piercing_needle", displayName: "穿孔針", weaponId: "launcher", treePosition: "A2",
    displayEffect: "各行動の最初の射出で、RP1を払い防御を6無視する。",
    flavorText: "一番最初に芯を通せば、後は同じ穴を使える。",
    rules: [{
      id: "launcher_piercing_needle_rule",
      listenTo: "damage_proposed", timing: "interrupt", priority: 51,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, RANGED_EVENT, hitIndexIs(0)],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(10),
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "attack", "launcher", "playable"],
  }),
  launcher_signal_round: Object.freeze({
    id: "launcher_signal_round", displayName: "合図弾", weaponId: "launcher", treePosition: "BA2",
    displayEffect: "観測済みの敵へ味方が攻撃を確認した時、RP1でその味方の次の攻撃+30%。",
    flavorText: "観測が共有された瞬間を、次の発射の合図に変える。",
    rules: [{
      id: "launcher_signal_round_rule",
      listenTo: "target_selected", timing: "after", priority: 56,
      predicates: [EVENT_SOURCE_IS_ALLY, ATTACK_EVENT, EVENT_TARGET_IS_OBSERVED],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "add_status", target: { scope: "event_source", take: 1 }, statusId: "launcher_signal", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "attack", "launcher", "playable"],
  }),
};

const TARGET = {
  launcher_pull_healer: Object.freeze({
    id: "launcher_pull_healer", displayName: "医療役を抜く", weaponId: "launcher", treePosition: "B1",
    displayEffect: "守勢を持つ敵（回復役の支援を受けている敵）を優先。",
    flavorText: "回復の線を、回復される前に断つ。",
    targetQuery: HEALING_ENEMY,
    tags: ["target", "attack", "launcher", "playable"],
  }),
  launcher_skip_preparation: Object.freeze({
    id: "launcher_skip_preparation", displayName: "準備を抜く", weaponId: "launcher", treePosition: "B2",
    displayEffect: "準備中の敵を優先。",
    flavorText: "撃つべき瞬間を、相手が作っているなら逃さない。",
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
  ["A2", "reactive", "launcher_piercing_needle", ["launcher_high_pressure"]],
  ["A3", "active", "launcher_large_shot", ["launcher_piercing_needle"]],
  ["AA1", "passive", "launcher_compressed_charge", ["launcher_large_shot"]],
  ["AA2", "passive", "launcher_hard_core", ["launcher_compressed_charge"]],
  ["AA3", "active", "launcher_siege_shot", ["launcher_hard_core"]],
  ["AB1", "passive", "launcher_multi_barrel", ["launcher_large_shot"]],
  ["AB2", "passive", "launcher_separate_caliber", ["launcher_multi_barrel"]],
  ["AB3", "active", "launcher_double_shot", ["launcher_separate_caliber"]],
  ["B1", "target", "launcher_pull_healer", ["launcher_shot"]],
  ["B2", "target", "launcher_skip_preparation", ["launcher_pull_healer"]],
  ["B3", "active", "launcher_designated_shot", ["launcher_skip_preparation"]],
  ["BA1", "passive", "launcher_observation_hole", ["launcher_designated_shot"]],
  ["BA2", "reactive", "launcher_signal_round", ["launcher_observation_hole"]],
  ["BA3", "active", "launcher_volley_aim", ["launcher_signal_round"]],
  ["BB1", "passive", "launcher_order_table", ["launcher_designated_shot"]],
  ["BB2", "passive", "launcher_order_check", ["launcher_order_table"]],
  ["BB3", "active", "launcher_three_point", ["launcher_order_check"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "launcher", position, kind, skillId, requires: Object.freeze(requires),
})));
