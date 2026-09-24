// R25 — 格闘具19節。
//
// 格闘具は、近接の多段・移動・同一対象の継続を共有イベントで読む。
// 「どの格闘技だったか」ではなく、hit数・行・直前対象・移動という
// engineがすでに発行している事実を条件にする。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["distance_to_self_asc"], take: 1,
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const SELF_IS_TARGET = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const SELF_IS_EVENT_TARGET = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_target" }], take: 1 },
});
const SELF_IS_ALIVE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "alive" }], take: 1 },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const MELEE_EVENT = Object.freeze({ type: "event_tag", tag: "melee", value: true });
const NOT_EXTRA_HIT = Object.freeze({ type: "event_tag", tag: "extra_hit", value: false });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});
const hitIndexIs = (index) => ({ type: "event_value", key: "hitIndex", op: "eq", value: index });
const hitIndexAtLeast = (index) => ({ type: "event_value", key: "hitIndex", op: "gte", value: index });
const plannedTargetCountIs = (count) => ({
  type: "event_value", key: "plannedTargetCount", op: "eq", value: count,
});
function active(id, displayName, coefficientBps, displayEffect, flavorText, options = {}) {
  const damage = {
    type: "deal_damage",
    target: EVENT_TARGETS,
    amount: options.amount ?? {
      type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps,
    },
    rangeClass: "melee",
    ...(options.hitCount ? { hitCount: options.hitCount } : {}),
    ...(options.guardPierceBps ? { guardPierceBps: options.guardPierceBps } : {}),
    tags: ["attack", "weapon", "gauntlets", "melee"],
    ...(options.onHitEffects?.length ? { onHitEffects: options.onHitEffects } : {}),
  };
  return Object.freeze({
    id,
    displayName,
    displayEffect,
    flavorText,
    weaponId: "gauntlets",
    treePosition: options.treePosition,
    ...(options.replacesActiveSkillId
      ? { replacesActiveSkillId: options.replacesActiveSkillId }
      : {}),
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: ENEMY,
    effects: [...(options.beforeEffects ?? []), damage, ...(options.afterEffects ?? [])],
    ...(options.attackPlanModifiers?.length ? { attackPlanModifiers: options.attackPlanModifiers } : {}),
    tags: ["attack", "weapon", "gauntlets", "melee", "playable"],
  });
}

const ACTIVE = {
  gauntlets_punch: active(
    "gauntlets_punch", "正拳", 9_000,
    "敵1体に腕力90%のダメージ。", "余計な道具はいらない。",
    { treePosition: "R" },
  ),
  gauntlets_double_punch: active(
    "gauntlets_double_punch", "二連拳", 6_500,
    "同じ敵に腕力65%のダメージを2hit。", "一度で足りないなら、同じ軌道をもう一度。",
    { treePosition: "A3", replacesActiveSkillId: "gauntlets_punch", hitCount: 2 },
  ),
  gauntlets_hundred_fists: active(
    "gauntlets_hundred_fists", "百裂", 6_500,
    "同じ敵に腕力65%のダメージを4hit。", "一打を見切った頃には、百の拳が身体を通り過ぎている。",
    { treePosition: "AA3", replacesActiveSkillId: "gauntlets_double_punch", hitCount: 4 },
  ),
  gauntlets_iron_body: active(
    "gauntlets_iron_body", "鉄身打ち", 14_000,
    "敵1体に腕力140%のダメージ。与えたHPダメージと同量の防壁を得る。", "打ち抜いた手応えを、そのまま己の鎧へ変える。",
    {
      treePosition: "AB3",
      replacesActiveSkillId: "gauntlets_double_punch",
      onHitEffects: [{
        type: "gain_barrier", target: SELF,
        amount: { type: "event_value_scaled", key: "hpDamage" }, duration: "round",
      }],
    },
  ),
  gauntlets_barrage: active(
    "gauntlets_barrage", "畳み掛け", 12_000,
    "敵1体に腕力120%＋攻撃開始時の連携1につき腕力1.5%。",
    "相手が崩れるまで、拳順を崩さない。",
    {
      treePosition: "B3", replacesActiveSkillId: "gauntlets_punch",
      amount: {
        type: "stat_times_context_scaled", subject: "self", scalingStat: "might",
        key: "status:gauntlets_combo", flatCoefficientBps: 12_000, coefficientBps: 150,
      },
    },
  ),
  gauntlets_flying_knee: active(
    "gauntlets_flying_knee", "飛び込み膝", 17_000,
    "敵1体に腕力170%＋攻撃開始時の連携1につき腕力2%。",
    "勢いは足に残し、最後は膝で距離を消す。",
    {
      treePosition: "BA3", replacesActiveSkillId: "gauntlets_barrage",
      amount: {
        type: "stat_times_context_scaled", subject: "self", scalingStat: "might",
        key: "status:gauntlets_combo", flatCoefficientBps: 17_000, coefficientBps: 200,
      },
    },
  ),
  gauntlets_empty_hand: active(
    "gauntlets_empty_hand", "無手", 16_000,
    "敵1体に腕力160%＋各強化の段数（種類ごと最大6）につき腕力20%。連携中の敵への命中後に連携+2。",
    "積み上げた型を、殴った後ではなく最後の一打へ。",
    {
      treePosition: "BB3",
      replacesActiveSkillId: "gauntlets_barrage",
      amount: {
        type: "stat_times_context_scaled", subject: "self", scalingStat: "might",
        key: "positiveStatusStacks", flatCoefficientBps: 16_000, coefficientBps: 2_000,
      },
      attackPlanModifiers: [{
        type: "modify_attack_plan", snapshotPositiveStatusStacksKey: "positiveStatusStacks",
      }],
      onHitEffects: [{
        type: "add_status", target: SELF, statusId: "gauntlets_combo", stacks: 2,
        linkToEventTarget: true, onlyIfStatusLinkedToEventTarget: "gauntlets_combo",
      }],
    },
  ),
};

function damageBoostPassive(id, displayName, percent, predicates, displayEffect, flavorText, treePosition) {
  return Object.freeze({
    id, displayName, displayEffect, flavorText, weaponId: "gauntlets", treePosition,
    rules: [{
      id: id + "_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      priority: 42,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, ...predicates],
      allowRepeatInChain: true,
      costs: [],
      effects: [{
        type: "modify_pending_amount",
        operation: "increase",
        amount: percentOfEvent(percent),
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }],
    tags: ["passive", "attack", "gauntlets", "playable"],
  });
}

function flatGuardIgnorePassive(id, displayName, amount, eventTag, displayEffect, flavorText, treePosition) {
  return Object.freeze({
    id, displayName, displayEffect, flavorText, weaponId: "gauntlets", treePosition,
    rules: [{
      id: id + "_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      priority: 42,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, eventTag],
      allowRepeatInChain: true,
      costs: [],
      effects: [{ type: "modify_pending_guard", amount: { type: "constant", value: amount } }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }],
    tags: ["passive", "attack", "gauntlets", "playable"],
  });
}

const PASSIVE = {
  gauntlets_grip: damageBoostPassive(
    "gauntlets_grip", "握り込み", 10, [hitIndexAtLeast(1)],
    "自分の攻撃の2hit目以降の各hitのダメージ+10%。", "拳を握れば、力は逃げない。", "A1",
  ),
  gauntlets_combo_fists: Object.freeze({
    id: "gauntlets_combo_fists", displayName: "連打", weaponId: "gauntlets", treePosition: "AA1",
    displayEffect: "「追い拳」の追撃を1hit増やす。",
    flavorText: "拍が続く限り、拳も続く。",
    rules: [],
    tags: ["passive", "attack", "gauntlets", "playable"],
  }),
  gauntlets_pressure: flatGuardIgnorePassive(
    "gauntlets_pressure", "拳圧", 6, MELEE_EVENT,
    "自分の近接攻撃は対象の受けを6無視する。複数hitなら各hitに適用し、他の受け無視とも合算する。",
    "連なる拳の圧が守りを押し潰し、身体の奥から息を奪う。", "AA2",
  ),
  gauntlets_strike_guard: Object.freeze({
    id: "gauntlets_strike_guard", displayName: "打って守る", weaponId: "gauntlets", treePosition: "AB2",
    displayEffect: "自分の攻撃が1hit命中するたび、自分に防壁4。",
    flavorText: "振り抜いた腕を引かず、そのまま次の衝撃を受ける盾に変える。",
    rules: [{
      id: "gauntlets_strike_guard_rule",
      listenTo: "damage_resolved", timing: "after", priority: 58,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT],
      allowRepeatInChain: true,
      costs: [],
      effects: [{ type: "gain_barrier", target: SELF, amount: { type: "constant", value: 4 }, duration: "round" }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }],
    tags: ["passive", "guard", "gauntlets", "playable"],
  }),
  gauntlets_streak: Object.freeze({
    id: "gauntlets_streak", displayName: "拳順", weaponId: "gauntlets", treePosition: "B2",
    displayEffect: "同じ敵への命中ごとに連携+1、最大300。連携1段につきその敵への与ダメージ+0.5%。対象変更・撃破で0。",
    flavorText: "同じ相手なら、癖が読める。",
    rules: [
      {
        id: "gauntlets_streak_link_rule",
        listenTo: "attack_plan_opened", timing: "interrupt", priority: 41,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT],
        costs: [],
        effects: [{
          type: "modify_attack_plan",
          linkStatusIds: ["gauntlets_combo"],
          snapshotStatusIds: ["gauntlets_combo"],
        }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      },
      {
        id: "gauntlets_streak_hit_rule",
        listenTo: "damage_resolved", timing: "after", priority: 44,
        predicates: [
          SELF_IS_SOURCE, ATTACK_EVENT,
          { type: "event_target_is_attack_primary" },
          { type: "target_exists", query: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 } },
        ],
        costs: [],
        effects: [{
          type: "add_status", target: SELF, statusId: "gauntlets_combo", stacks: 1,
          linkToEventTarget: true,
        }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
        allowRepeatInChain: true,
      },
      {
        id: "gauntlets_streak_damage_rule",
        listenTo: "damage_proposed", timing: "interrupt", priority: 42,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT, { type: "event_target_is_attack_primary" }],
        allowRepeatInChain: true,
        costs: [],
        effects: [{
          type: "modify_pending_amount", operation: "increase",
          amount: {
            type: "pending_amount_times_status_scaled", subject: "self", statusId: "gauntlets_combo",
            memoryKey: "status:gauntlets_combo", numerator: 5, denominator: 1_000,
          },
        }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
      },
    ],
    tags: ["passive", "attack", "gauntlets", "playable"],
  }),
};

const REACTIVE = {
  gauntlets_chasing_fist: Object.freeze({
    id: "gauntlets_chasing_fist", displayName: "追い拳", weaponId: "gauntlets", treePosition: "A2",
    displayEffect: "単体近接攻撃の1hit目が命中した時、RP1で腕力50%を1hit追撃。1行動1回。",
    flavorText: "一発で止めるから、次が見えない。",
    rules: [{
      id: "gauntlets_chasing_fist_rule",
      listenTo: "damage_resolved", timing: "after", priority: 82,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT, MELEE_EVENT, NOT_EXTRA_HIT,
        hitIndexIs(0), plannedTargetCountIs(1),
        { type: "event_target_is_attack_primary" },
        { type: "target_exists", query: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 } },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "deal_damage",
        target: { scope: "event_targets", take: "all" },
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 5_000 },
        hitCount: 1,
        hitCountBonusBySkill: [{ skillId: "gauntlets_combo_fists", bonus: 1 }],
        independentAttack: true,
        rangeClass: "melee",
        tags: ["attack", "weapon", "gauntlets", "melee", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "attack", "gauntlets", "playable"],
  }),
  gauntlets_knuckle_guard: Object.freeze({
    id: "gauntlets_knuckle_guard", displayName: "流し身", weaponId: "gauntlets", treePosition: "AB1",
    displayEffect: "RP1。自分が攻撃対象になった時、ダメージ-35%。生存し後列に空きがあれば攻撃後に後退。ラウンド終了時に前列へ戻る。",
    flavorText: "まともに受ける理由がなければ、拳も身体もそこには置かない。",
    rules: [
      {
        id: "gauntlets_knuckle_guard_reduce_rule",
        listenTo: "damage_proposed", timing: "interrupt", priority: 60,
        predicates: [SELF_IS_TARGET, ATTACK_EVENT],
        allowRepeatInChain: true,
        costs: [{ type: "spend_reaction_points", amount: 1 }],
        effects: [
          {
            type: "modify_pending_amount", operation: "decrease",
            amount: { type: "pending_amount_scaled", numerator: 35, denominator: 100 },
          },
          { type: "mark_attack_flag", key: "gauntlets_flowing_body" },
        ],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
      },
      {
        id: "gauntlets_knuckle_guard_retreat_rule",
        listenTo: "action_resolved", timing: "after", priority: 62,
        predicates: [
          SELF_IS_EVENT_TARGET, SELF_IS_ALIVE, ATTACK_EVENT,
          { type: "attack_flag", key: "gauntlets_flowing_body" },
          { type: "position", subject: "self", row: "front", op: "eq" },
        ],
        costs: [],
        effects: [{
          type: "move_to_open_row", target: SELF, row: "rear", returnAtRoundEnd: true,
        }],
        limit: CHAIN_ONCE,
      },
    ],
    tags: ["reaction", "guard", "movement", "gauntlets", "playable"],
  }),
  gauntlets_footwork: Object.freeze({
    id: "gauntlets_footwork", displayName: "歩法", weaponId: "gauntlets", treePosition: "BA1",
    displayEffect: "後列から近接攻撃する時、RP0で空き前列へ前進。",
    flavorText: "足が運んだ力を、拳へ通す。",
    rules: [{
      id: "gauntlets_footwork_move_rule",
      listenTo: "action_declared", timing: "interrupt", priority: 20,
      predicates: [
        SELF_IS_SOURCE, MELEE_EVENT,
        { type: "position", subject: "self", row: "rear", op: "eq" },
        {
          type: "target_exists", op: "eq", value: 0,
          query: { scope: "allies", filters: [{ type: "alive" }, { type: "row_is", row: "front" }], take: "all" },
        },
      ],
      costs: [],
      effects: [{ type: "move_to_open_row", target: SELF, row: "front" }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "movement", "gauntlets", "playable"],
  }),
  gauntlets_empty_pocket: Object.freeze({
    id: "gauntlets_empty_pocket", displayName: "空いた懐", weaponId: "gauntlets", treePosition: "BA2",
    displayEffect: "自分が1マス以上移動するたび連携+1、最大300。連携対象がなければ次の攻撃相手へ結びつく。",
    flavorText: "空いた間合いを見逃さず、次に生きる場所へ滑り込む。",
    rules: [{
      id: "gauntlets_empty_pocket_rule",
      listenTo: "actor_moved", timing: "after", priority: 59,
      predicates: [{ type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 } }],
      allowRepeatInChain: true,
      costs: [],
      effects: [{ type: "add_status", target: SELF, statusId: "gauntlets_combo", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }],
    tags: ["reaction", "movement", "gauntlets", "playable"],
  }),
  gauntlets_borrowed_stance: Object.freeze({
    id: "gauntlets_borrowed_stance", displayName: "重ね構え", weaponId: "gauntlets", treePosition: "BB2",
    displayEffect: "RP1。自分が強化を得た時、同じ強化を1段追加。",
    flavorText: "借りた型を、もう一度だけ自分の骨格へ重ねる。",
    rules: [{
      id: "gauntlets_borrowed_stance_rule",
      listenTo: "status_added", timing: "after", priority: 60,
      predicates: [SELF_IS_TARGET, { type: "event_tag", tag: "positive", value: true },
        { type: "event_tag", tag: "copy_suppressed", value: false }],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "copy_status_from_event", target: SELF }],
      allowRepeatInChain: true,
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }, {
      id: "gauntlets_borrowed_stance_block_rule",
      listenTo: "block_gained", timing: "after", priority: 60,
      predicates: [SELF_IS_TARGET, { type: "event_tag", tag: "positive", value: true },
        { type: "event_tag", tag: "copy_suppressed", value: false }],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "gain_block", target: SELF, amount: { type: "constant", value: 1 }, tags: ["copy_suppressed"] }],
      allowRepeatInChain: true,
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }],
    tags: ["reaction", "attack", "gauntlets", "playable"],
  }),
  gauntlets_form_record: Object.freeze({
    id: "gauntlets_form_record", displayName: "見取り", weaponId: "gauntlets", treePosition: "BB1",
    displayEffect: "RP1。隣接味方が強化を得た時、同じ強化を同じ段数得る。",
    flavorText: "一度見た技は、身体が覚える。",
    rules: [{
      id: "gauntlets_form_record_rule",
      listenTo: "status_added", timing: "after", priority: 59,
      predicates: [
        { type: "target_exists", query: { scope: "allies", filters: [{ type: "is_event_primary_target" }], take: 1 } },
        { type: "target_exists", query: { scope: "self", filters: [{ type: "adjacent_to_event_primary_target" }], take: 1 } },
        { type: "event_tag", tag: "positive", value: true },
        { type: "event_tag", tag: "copy_suppressed", value: false },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "copy_status_from_event", target: SELF, stacksFromEvent: true }],
      allowRepeatInChain: true,
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }, {
      id: "gauntlets_form_record_block_rule",
      listenTo: "block_gained", timing: "after", priority: 59,
      predicates: [
        { type: "target_exists", query: { scope: "allies", filters: [{ type: "is_event_primary_target" }], take: 1 } },
        { type: "target_exists", query: { scope: "self", filters: [{ type: "adjacent_to_event_primary_target" }], take: 1 } },
        { type: "event_tag", tag: "positive", value: true },
        { type: "event_tag", tag: "copy_suppressed", value: false },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "gain_block", target: SELF, amount: { type: "event_value_scaled", key: "amount" }, tags: ["copy_suppressed"] }],
      allowRepeatInChain: true,
      limit: { owner: "actor-instance + rule", scope: "chain", count: 128 },
    }],
    tags: ["reaction", "support", "gauntlets", "playable"],
  }),
};

const TARGET = {
  gauntlets_watch_target: Object.freeze({
    id: "gauntlets_watch_target", displayName: "目を離さない", weaponId: "gauntlets", treePosition: "B1",
    displayEffect: "HPが減っている敵のうち、HP割合が最も低い敵を優先。",
    flavorText: "倒れるまで、視線は切らない。",
    targetQuery: {
      scope: "enemies",
      filters: [{ type: "alive" }, { type: "hp_percent", op: "lt", value: 100 }],
      sort: ["hp_percent_asc", "distance_to_self_asc"],
      take: 1,
    },
    tags: ["target", "attack", "gauntlets", "playable"],
  }),
};

export const GAUNTLETS_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const GAUNTLETS_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const GAUNTLETS_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const GAUNTLETS_TARGET_SKILLS = Object.freeze(TARGET);

export const GAUNTLETS_TREE = Object.freeze([
  ["R", "active", "gauntlets_punch", []],
  ["A1", "passive", "gauntlets_grip", ["gauntlets_punch"]],
  ["A2", "reactive", "gauntlets_chasing_fist", ["gauntlets_grip"]],
  ["A3", "active", "gauntlets_double_punch", ["gauntlets_chasing_fist"]],
  ["AA1", "passive", "gauntlets_combo_fists", ["gauntlets_double_punch"]],
  ["AA2", "passive", "gauntlets_pressure", ["gauntlets_combo_fists"]],
  ["AA3", "active", "gauntlets_hundred_fists", ["gauntlets_pressure"]],
  ["AB1", "reactive", "gauntlets_knuckle_guard", ["gauntlets_double_punch"]],
  ["AB2", "passive", "gauntlets_strike_guard", ["gauntlets_knuckle_guard"]],
  ["AB3", "active", "gauntlets_iron_body", ["gauntlets_strike_guard"]],
  ["B1", "target", "gauntlets_watch_target", ["gauntlets_punch"]],
  ["B2", "passive", "gauntlets_streak", ["gauntlets_watch_target"]],
  ["B3", "active", "gauntlets_barrage", ["gauntlets_streak"]],
  ["BA1", "reactive", "gauntlets_footwork", ["gauntlets_barrage"]],
  ["BA2", "reactive", "gauntlets_empty_pocket", ["gauntlets_footwork"]],
  ["BA3", "active", "gauntlets_flying_knee", ["gauntlets_empty_pocket"]],
  ["BB1", "reactive", "gauntlets_form_record", ["gauntlets_barrage"]],
  ["BB2", "reactive", "gauntlets_borrowed_stance", ["gauntlets_form_record"]],
  ["BB3", "active", "gauntlets_empty_hand", ["gauntlets_borrowed_stance"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "gauntlets", position, kind, skillId, requires: Object.freeze(requires),
})));
