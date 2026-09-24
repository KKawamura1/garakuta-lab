// R26 — 長槍19節。
//
// 長槍は「遠い敵を一本の線で読む」武器。射程・準備・移動・行動順を
// 個別の敵IDではなく、既存の target filter と共有 event へ接続する。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ONE_EVENT_TARGET = Object.freeze({ scope: "event_targets", take: 1 });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});
const FARTHEST_ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_desc"], take: 1,
});
const PREPARING_ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }, { type: "is_preparing", value: true }],
  sort: ["position_asc"], take: 1,
});
const NOT_ACTED_PRIMARY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "is_event_primary_target" }, { type: "not_acted_this_round" }],
  sort: ["position_asc"], take: 1,
});
const ACTED_PRIMARY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "is_event_primary_target" }, { type: "not_acted_this_round", value: false }],
  sort: ["position_asc"], take: 1,
});
const COLUMN_FRONT_TARGET = Object.freeze({
  scope: "enemies",
  filters: [
    { type: "alive" },
    { type: "same_column_as_event_primary_target" },
    { type: "not_event_primary_target" },
  ],
  sort: ["position_asc"], take: 1,
});
const ROW_ENEMIES = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "same_row_as_event_primary_target" }],
  sort: ["position_asc"], take: "all",
});
const ENEMY_EVENT_TARGET = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_primary_target" }], take: 1,
});
const ENEMY_EVENT_TARGET_EXISTS = Object.freeze({
  type: "target_exists", query: ENEMY_EVENT_TARGET,
});
const ENEMY_EVENT_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_source" }], take: 1 },
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const LONG_EVENT = Object.freeze({ type: "event_tag", tag: "long", value: true });
const MOVE_EVENT = Object.freeze({ type: "event_tag", tag: "move", value: true });
const NOT_EXTRA_HIT = Object.freeze({ type: "event_tag", tag: "extra_hit", value: false });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const ROUND_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "round", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});
const hitCountIs = (count) => ({ type: "event_value", key: "hitCount", op: "eq", value: count });
const hitIndexIs = (index) => ({ type: "event_value", key: "hitIndex", op: "eq", value: index });
const eventTargetIsNotPreparing = Object.freeze({
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_primary_target" }, { type: "is_preparing", value: false }], take: 1 },
});

function longDamage(id, displayName, coefficientBps, displayEffect, flavorText, options = {}) {
  const damage = {
    type: "deal_damage",
    target: options.damageTarget ?? EVENT_TARGETS,
    amount: options.amount ?? { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
    rangeClass: "long",
    ...(options.targetPattern ? { targetPattern: options.targetPattern } : {}),
    ...(options.hitCount ? { hitCount: options.hitCount } : {}),
    tags: ["attack", "weapon", "long_spear", "long"],
  };
  return Object.freeze({
    id,
    displayName,
    displayEffect,
    flavorText,
    weaponId: "long_spear",
    treePosition: options.treePosition,
    ...(options.replacesActiveSkillId ? { replacesActiveSkillId: options.replacesActiveSkillId } : {}),
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: options.targetQuery ?? FARTHEST_ENEMY,
    effects: [damage, ...(options.afterEffects ?? [])],
    tags: ["attack", "weapon", "long_spear", "long", "playable"],
  });
}

const ACTIVE = {
  long_spear_pierce: longDamage(
    "long_spear_pierce", "貫き突き", 11_000,
    "直線上で最も遠い敵に腕力110%のダメージ。", "遠いほど、穂先は真っ直ぐ届く。",
    { treePosition: "R" },
  ),
  long_spear_deep_thrust: longDamage(
    "long_spear_deep_thrust", "深突き", 16_500,
    "直線上で最も遠い敵に腕力165%のダメージ。", "一歩ぶん深く踏み込み、逃げ場の奥まで穂先を通す。",
    { treePosition: "A3", replacesActiveSkillId: "long_spear_pierce" },
  ),
  long_spear_sky_pierce: longDamage(
    "long_spear_sky_pierce", "天穿ち", 23_000,
    "直線上の最遠の敵に腕力230%、手前の敵に腕力115%。",
    "天へ伸びる一筋の穂先が、列の果てまで敵を貫く。\nこの間合いに並んだ以上、逃げ場などない。",
    {
      treePosition: "AA3", replacesActiveSkillId: "long_spear_deep_thrust",
      afterEffects: [{
        type: "deal_damage", target: COLUMN_FRONT_TARGET,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 11_500 },
        rangeClass: "long", tags: ["attack", "weapon", "long_spear", "long", "pierce"],
      }],
    },
  ),
  long_spear_impale: longDamage(
    "long_spear_impale", "串刺し", 13_000,
    "直線上の敵全員に腕力130%のダメージ。", "並んだ敵も、重ねた守りも、一息にひとつの線へ縫う。\n穂先が止まるのは、最後の一人を抜いた後だ。",
    {
      treePosition: "AB3", replacesActiveSkillId: "long_spear_deep_thrust",
      targetPattern: "column", damageTarget: ONE_EVENT_TARGET,
    },
  ),
  long_spear_first_thrust: Object.freeze({
    id: "long_spear_first_thrust",
    displayName: "先制突き",
    displayEffect: "敵1体に腕力100%のダメージ。未行動なら180%。",
    flavorText: "動く兆しを先に射抜けば、相手の一手は始まらない。",
    weaponId: "long_spear",
    treePosition: "B3",
    replacesActiveSkillId: "long_spear_pierce",
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: FARTHEST_ENEMY,
    effects: [
      {
        type: "deal_damage", target: NOT_ACTED_PRIMARY,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 18_000 },
        rangeClass: "long", tags: ["attack", "weapon", "long_spear", "long", "preemptive"],
      },
      {
        type: "deal_damage", target: ACTED_PRIMARY,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 10_000 },
        rangeClass: "long", tags: ["attack", "weapon", "long_spear", "long", "preemptive"],
      },
    ],
    tags: ["attack", "weapon", "long_spear", "long", "playable"],
  }),
  long_spear_checkpoint: Object.freeze({
    id: "long_spear_checkpoint",
    displayName: "関所",
    displayEffect: "敵1列に腕力120%。命中した敵を次の移動不能にする。",
    flavorText: "この槍を立てた場所から先は、誰の道でもない。\n越えようとした足は、その一歩ごと地へ縫い止める。",
    weaponId: "long_spear",
    treePosition: "BA3",
    replacesActiveSkillId: "long_spear_first_thrust",
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: FARTHEST_ENEMY,
    effects: [
      {
        type: "deal_damage", target: ONE_EVENT_TARGET,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 12_000 },
        targetPattern: "row", rangeClass: "long", tags: ["attack", "weapon", "long_spear", "long", "checkpoint"],
      },
      { type: "add_status", target: ROW_ENEMIES, statusId: "long_spear_gate", stacks: 1 },
    ],
    tags: ["attack", "weapon", "long_spear", "long", "playable"],
  }),
  long_spear_time_thrust: Object.freeze({
    id: "long_spear_time_thrust",
    displayName: "時穿ち",
    displayEffect: "敵1体に腕力160%のダメージ。対象と自分の次の行動順を交換する。戦闘3回。",
    flavorText: "狙うのは身体ではない。敵が動き出す、その瞬間だ。\n未来へ差し込んだ穂先で、戦場の順番を書き換える。",
    weaponId: "long_spear",
    treePosition: "BB3",
    replacesActiveSkillId: "long_spear_first_thrust",
    usesPerBattle: 3,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: FARTHEST_ENEMY,
    effects: [{
      type: "deal_damage", target: EVENT_TARGETS,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 16_000 },
      rangeClass: "long", tags: ["attack", "weapon", "long_spear", "long", "time_pierce"],
    }, { type: "add_status", target: EVENT_TARGETS, statusId: "long_spear_order_mark_status", stacks: 1 }],
    tags: ["attack", "weapon", "long_spear", "long", "playable"],
  }),
};

function longDamagePassive(id, displayName, percent, treePosition, displayEffect, flavorText, predicates = []) {
  return Object.freeze({
    id, displayName, weaponId: "long_spear", treePosition, displayEffect, flavorText,
    rules: [{
      id: id + "_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 42,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, LONG_EVENT, ...predicates], costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(percent) }],
      allowRepeatInChain: true,
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "attack", "long_spear", "playable"],
  });
}

const PASSIVE = {
  long_spear_long_shaft: longDamagePassive(
    "long_spear_long_shaft", "長柄", 15, "A1",
    "距離2以上の敵への攻撃ダメージ+15%。", "間合いの外から、こちらだけが届く。",
  ),
  long_spear_armor_pierce: longDamagePassive(
    "long_spear_armor_pierce", "鎧抜き", 8, "A2",
    "距離2以上の敵への攻撃は、防御を合計8無視する。",
    "長い助走が、鎧の継ぎ目を抜く。",
  ),
  long_spear_butt_end: longDamagePassive(
    "long_spear_butt_end", "石突き", 20, "AA1",
    "距離2以上の敵への攻撃ダメージがさらに+20%。", "柄の端まで、力を余さない。",
  ),
  long_spear_penetration: Object.freeze({
    id: "long_spear_penetration", displayName: "貫通", weaponId: "long_spear", treePosition: "AA2",
    displayEffect: "単体攻撃が、主対象との同じ列上にいる手前の敵にも40%のダメージ。",
    flavorText: "最初の一人を抜いた穂先は勢いを失わず、その奥の敵まで貫く。",
    rules: [{
      id: "long_spear_penetration_rule", listenTo: "damage_proposed", timing: "after", priority: 89,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, NOT_EXTRA_HIT, hitCountIs(1), hitIndexIs(0)], costs: [],
      effects: [{
        type: "deal_damage", target: COLUMN_FRONT_TARGET, amount: percentOfEvent(40),
        rangeClass: "long", tags: ["attack", "weapon", "long_spear", "long", "extra_hit", "pierce"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "attack", "long_spear", "playable"],
  }),
  long_spear_double_thrust: Object.freeze({
    id: "long_spear_double_thrust", displayName: "二段突き", weaponId: "long_spear", treePosition: "AB1",
    displayEffect: "1hit長射程攻撃に、同じ敵への50%追撃を追加。",
    flavorText: "引いた穂先は、もう一度伸びる。",
    rules: [{
      id: "long_spear_double_thrust_rule", listenTo: "damage_proposed", timing: "after", priority: 88,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, LONG_EVENT, NOT_EXTRA_HIT, hitCountIs(1), hitIndexIs(0)],
      costs: [],
      effects: [{
        type: "deal_damage", target: EVENT_TARGETS, amount: percentOfEvent(50),
        rangeClass: "long", tags: ["attack", "weapon", "long_spear", "long", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "attack", "long_spear", "playable"],
  }),
  long_spear_pin: Object.freeze({
    id: "long_spear_pin", displayName: "縫い留め", weaponId: "long_spear", treePosition: "AB2",
    displayEffect: "長槍攻撃の最後のhitで、対象へ移動不能1。1行動1回。",
    flavorText: "連ねた突きの最後に穂先を残し、逃げる足を地面へ縫い止める。",
    rules: [{
      id: "long_spear_pin_rule", listenTo: "action_resolved", timing: "after", priority: 83,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, LONG_EVENT], costs: [],
      effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "long_spear_pinned", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "control", "long_spear", "playable"],
  }),
  long_spear_first_mover: longDamagePassive(
    "long_spear_first_mover", "先の先", 40, "B2",
    "未行動の敵へのダメージ+40%。", "相手の一手目より、こちらの穂先が早い。",
    [{ type: "target_exists", query: NOT_ACTED_PRIMARY }],
  ),
  long_spear_foot_stop: Object.freeze({
    id: "long_spear_foot_stop", displayName: "足を止める", weaponId: "long_spear", treePosition: "BA1",
    displayEffect: "未行動か準備中の敵へ命中すると、次行動のAP-1。ラウンド1回。",
    flavorText: "足元を払えば、次の手は遅れる。",
    rules: [
      {
        id: "long_spear_foot_stop_unacted_rule", listenTo: "damage_proposed", timing: "after", priority: 78,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT, LONG_EVENT, { type: "target_exists", query: NOT_ACTED_PRIMARY }],
        costs: [], effects: [{ type: "add_status", target: ENEMY_EVENT_TARGET, statusId: "long_spear_delayed", stacks: 1 }],
        limit: ROUND_ONCE,
      },
      {
        id: "long_spear_foot_stop_preparing_rule", listenTo: "damage_proposed", timing: "after", priority: 78,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT, LONG_EVENT, { type: "target_exists", query: {
          scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_primary_target" }, { type: "is_preparing", value: true }], take: 1,
        } }],
        costs: [], effects: [{ type: "add_status", target: ENEMY_EVENT_TARGET, statusId: "long_spear_delayed", stacks: 1 }],
        limit: ROUND_ONCE,
      },
    ],
    tags: ["passive", "control", "long_spear", "playable"],
  }),
  long_spear_order_mark: Object.freeze({
    id: "long_spear_order_mark", displayName: "順番標", weaponId: "long_spear", treePosition: "BB1",
    displayEffect: "攻撃した敵の次の行動順を1つ後ろへ送る。ラウンド1回。",
    flavorText: "穂先一つで、戦場の順をずらす。",
    rules: [{
      id: "long_spear_order_mark_rule", listenTo: "action_resolved", timing: "after", priority: 84,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, LONG_EVENT], costs: [],
      effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "long_spear_order_mark_status", stacks: 1 }],
      limit: ROUND_ONCE,
    }],
    tags: ["passive", "tempo", "long_spear", "playable"],
  }),
};

const REACTIVE = {
  long_spear_cross_thrust: Object.freeze({
    id: "long_spear_cross_thrust", displayName: "横槍", weaponId: "long_spear", treePosition: "BA2",
    displayEffect: "敵が移動した時、RP1で移動後の敵へ腕力80%の追撃。",
    flavorText: "敵が動いた先へ先回りし、次の一歩が始まる場所に穂先を置く。",
    rules: [{
      id: "long_spear_cross_thrust_rule", listenTo: "actor_moved", timing: "after", priority: 56,
      predicates: [ENEMY_EVENT_TARGET_EXISTS, MOVE_EVENT],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "deal_damage", target: ONE_EVENT_TARGET,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 8_000 },
        rangeClass: "long", tags: ["attack", "weapon", "long_spear", "long", "reaction"],
      }],
      limit: ROUND_ONCE,
    }],
    tags: ["reaction", "attack", "long_spear", "playable"],
  }),
  long_spear_interrupt: Object.freeze({
    id: "long_spear_interrupt", displayName: "割り込み槍", weaponId: "long_spear", treePosition: "BB2",
    displayEffect: "敵が行動を宣言した時、RP2で自分の次のAP行動を前倒しする。",
    flavorText: "敵が手を出す、そのわずかな前へ穂先を差し込み、戦場の拍を奪う。",
    rules: [{
      id: "long_spear_interrupt_rule", listenTo: "action_declared", timing: "after", priority: 53,
      predicates: [ENEMY_EVENT_SOURCE, ATTACK_EVENT],
      costs: [{ type: "spend_reaction_points", amount: 2 }],
      effects: [{ type: "gain_resource", target: SELF, resource: "action_points", amount: { type: "constant", value: 1 } }],
      limit: ROUND_ONCE,
    }],
    tags: ["reaction", "tempo", "long_spear", "playable"],
  }),
};

const TARGET = {
  long_spear_ready_target: Object.freeze({
    id: "long_spear_ready_target", displayName: "構えを刺す", weaponId: "long_spear", treePosition: "B1",
    displayEffect: "準備が最も進んだ敵を優先。", flavorText: "構えが固まる、その前を刺す。",
    targetQuery: PREPARING_ENEMY,
    tags: ["target", "tempo", "long_spear", "playable"],
  }),
};

export const LONG_SPEAR_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const LONG_SPEAR_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const LONG_SPEAR_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const LONG_SPEAR_TARGET_SKILLS = Object.freeze(TARGET);

export const LONG_SPEAR_TREE = Object.freeze([
  ["R", "active", "long_spear_pierce", []],
  ["A1", "passive", "long_spear_long_shaft", ["long_spear_pierce"]],
  ["A2", "passive", "long_spear_armor_pierce", ["long_spear_long_shaft"]],
  ["A3", "active", "long_spear_deep_thrust", ["long_spear_armor_pierce"]],
  ["AA1", "passive", "long_spear_butt_end", ["long_spear_deep_thrust"]],
  ["AA2", "passive", "long_spear_penetration", ["long_spear_butt_end"]],
  ["AA3", "active", "long_spear_sky_pierce", ["long_spear_penetration"]],
  ["AB1", "passive", "long_spear_double_thrust", ["long_spear_deep_thrust"]],
  ["AB2", "passive", "long_spear_pin", ["long_spear_double_thrust"]],
  ["AB3", "active", "long_spear_impale", ["long_spear_pin"]],
  ["B1", "target", "long_spear_ready_target", ["long_spear_pierce"]],
  ["B2", "passive", "long_spear_first_mover", ["long_spear_ready_target"]],
  ["B3", "active", "long_spear_first_thrust", ["long_spear_first_mover"]],
  ["BA1", "passive", "long_spear_foot_stop", ["long_spear_first_thrust"]],
  ["BA2", "reactive", "long_spear_cross_thrust", ["long_spear_foot_stop"]],
  ["BA3", "active", "long_spear_checkpoint", ["long_spear_cross_thrust"]],
  ["BB1", "passive", "long_spear_order_mark", ["long_spear_first_thrust"]],
  ["BB2", "reactive", "long_spear_interrupt", ["long_spear_order_mark"]],
  ["BB3", "active", "long_spear_time_thrust", ["long_spear_interrupt"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "long_spear", position, kind, skillId, requires: Object.freeze(requires),
})));
