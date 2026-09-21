// R25 — 格闘具19節。
//
// 格闘具は、近接の多段・移動・同一対象の継続を共有イベントで読む。
// 「どの格闘技だったか」ではなく、hit数・行・直前対象・移動という
// engineがすでに発行している事実を条件にする。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});
const PREVIOUS_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "previous_target" }],
  sort: ["position_asc"],
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
const EVENT_SOURCE_IS_OTHER_ALLY = Object.freeze({
  type: "target_exists",
  query: {
    scope: "allies",
    filters: [{ type: "is_event_source" }, { type: "not_self" }],
    take: 1,
  },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const MELEE_EVENT = Object.freeze({ type: "event_tag", tag: "melee", value: true });
const NOT_EXTRA_HIT = Object.freeze({ type: "event_tag", tag: "extra_hit", value: false });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});
const hitCountAtLeast = (count) => ({
  type: "event_value", key: "hitCount", op: "gte", value: count,
});
const hitCountIs = (count) => ({ type: "event_value", key: "hitCount", op: "eq", value: count });
const hitIndexIs = (index) => ({ type: "event_value", key: "hitIndex", op: "eq", value: index });
const exactStatus = (statusId, stacks) => ({
  type: "has_status", subject: "self", statusId, op: "eq", value: stacks,
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
    "gauntlets_hundred_fists", "百裂", 5_500,
    "同じ敵に腕力55%のダメージを4hit。", "数え終わる前に、拳が先に届く。",
    { treePosition: "AA3", replacesActiveSkillId: "gauntlets_double_punch", hitCount: 4 },
  ),
  gauntlets_iron_body: active(
    "gauntlets_iron_body", "鉄身打ち", 12_000,
    "敵1体に腕力120%のダメージを与え、自分に防壁24。", "打ち終わった場所を、守れる場所に変える。",
    {
      treePosition: "AB3",
      replacesActiveSkillId: "gauntlets_double_punch",
      afterEffects: [{
        type: "gain_barrier", target: SELF, amount: { type: "constant", value: 24 }, duration: "round",
      }],
    },
  ),
  gauntlets_barrage: active(
    "gauntlets_barrage", "畳み掛け", 10_000,
    "敵1体に腕力100%のダメージ。同じ敵への連続攻撃ほど強くなる。",
    "相手が崩れるまで、拳順を崩さない。",
    { treePosition: "B3", replacesActiveSkillId: "gauntlets_punch" },
  ),
  gauntlets_flying_knee: active(
    "gauntlets_flying_knee", "飛び込み膝", 11_000,
    "敵1体に腕力110%のダメージ。踏み込みの勢いを消費して強化する。",
    "勢いは足に残し、最後は膝で距離を消す。",
    { treePosition: "BA3", replacesActiveSkillId: "gauntlets_barrage" },
  ),
  gauntlets_empty_hand: active(
    "gauntlets_empty_hand", "無手", 10_000,
    "見取った型があればそれを再現し、なければ畳み掛けを放つ。",
    "借りた構えも、最後に残るのは自分の拳だ。",
    {
      treePosition: "BB3",
      replacesActiveSkillId: "gauntlets_barrage",
      afterEffects: [{ type: "remove_status", target: SELF, statusId: "gauntlets_form", stacks: "all" }],
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
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "attack", "gauntlets", "playable"],
  });
}

const PASSIVE = {
  gauntlets_grip: damageBoostPassive(
    "gauntlets_grip", "握り込み", 10, [hitCountAtLeast(2)],
    "2hit以上の攻撃の合計ダメージ+10%。", "拳を握る時間まで、打撃へ変える。", "A1",
  ),
  gauntlets_chasing_fist: Object.freeze({
    id: "gauntlets_chasing_fist", displayName: "追い拳", weaponId: "gauntlets", treePosition: "A2",
    displayEffect: "1hit近接攻撃の最初のhit後、同じ敵へ40%の追加hit。",
    flavorText: "逃げる余地を、二つ目の拳で塞ぐ。",
    rules: [{
      id: "gauntlets_chasing_fist_rule",
      listenTo: "damage_proposed", timing: "after", priority: 82,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, MELEE_EVENT, NOT_EXTRA_HIT, hitCountIs(1), hitIndexIs(0)],
      costs: [],
      effects: [{
        type: "deal_damage",
        target: { scope: "event_targets", take: "all" },
        amount: percentOfEvent(40),
        rangeClass: "melee",
        tags: ["attack", "weapon", "gauntlets", "melee", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "attack", "gauntlets", "playable"],
  }),
  gauntlets_combo_fists: Object.freeze({
    id: "gauntlets_combo_fists", displayName: "連打", weaponId: "gauntlets", treePosition: "AA1",
    displayEffect: "2〜3hit攻撃の最後に35%の追加hit。追加後も最大4hitまで。",
    flavorText: "一撃の終点を、次の始点にする。",
    rules: [2, 3].map((hitCount) => ({
      id: "gauntlets_combo_fists_" + hitCount + "_rule",
      listenTo: "damage_proposed", timing: "after", priority: 83,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT, MELEE_EVENT, NOT_EXTRA_HIT,
        hitCountIs(hitCount), hitIndexIs(hitCount - 1),
      ],
      costs: [],
      effects: [{
        type: "deal_damage",
        target: { scope: "event_targets", take: "all" },
        amount: percentOfEvent(35),
        rangeClass: "melee",
        tags: ["attack", "weapon", "gauntlets", "melee", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    })),
    tags: ["passive", "attack", "gauntlets", "playable"],
  }),
  gauntlets_pressure: damageBoostPassive(
    "gauntlets_pressure", "拳圧", 6, [hitCountAtLeast(2)],
    "2hit以上の攻撃は防御を6無視する（現行防御境界では追加の貫通打として表現）。",
    "拳が重なるほど、受けの芯まで届く。", "AA2",
  ),
  gauntlets_knuckle_guard: Object.freeze({
    id: "gauntlets_knuckle_guard", displayName: "拳甲", weaponId: "gauntlets", treePosition: "AB1",
    displayEffect: "前列開始時に防壁10。移動で前列へ入った時は防壁20。各ラウンド1回。",
    flavorText: "守りは構えるものではなく、踏み込んだ場所に残す。",
    rules: [
      {
        id: "gauntlets_knuckle_guard_round_rule",
        listenTo: "round_started", timing: "after", priority: 42,
        predicates: [{ type: "position", subject: "self", row: "front", op: "eq" }],
        costs: [],
        effects: [{ type: "gain_barrier", target: SELF, amount: { type: "constant", value: 10 }, duration: "round" }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      },
      {
        id: "gauntlets_knuckle_guard_move_rule",
        listenTo: "actor_moved", timing: "after", priority: 43,
        predicates: [
          SELF_IS_SOURCE,
          { type: "event_value", key: "rowChanged", op: "eq", value: true },
          { type: "position", subject: "self", row: "front", op: "eq" },
        ],
        costs: [],
        effects: [{ type: "gain_barrier", target: SELF, amount: { type: "constant", value: 20 }, duration: "round" }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      },
    ],
    tags: ["passive", "guard", "gauntlets", "playable"],
  }),
  gauntlets_streak: damageBoostPassive(
    "gauntlets_streak", "拳順", 25,
    [{ type: "history_count", subject: "self", metric: "same_target_streak", window: "battle", op: "gte", value: 2 }],
    "同じ敵への連続攻撃でダメージ+25%。対象を変えると連続は切れる。",
    "拳順は相手の足元まで覚えている。", "B2",
  ),
  gauntlets_footwork: Object.freeze({
    id: "gauntlets_footwork", displayName: "歩法", weaponId: "gauntlets", treePosition: "BA1",
    displayEffect: "後列から近接攻撃する時、空いた前列へ移動。移動の勢い1につき、その攻撃+20%。",
    flavorText: "拳を届かせるのは腕ではなく、足の順番だ。",
    rules: [
      {
        id: "gauntlets_footwork_move_rule",
        listenTo: "action_declared", timing: "interrupt", priority: 20,
        predicates: [
          SELF_IS_SOURCE, MELEE_EVENT,
          { type: "position", subject: "self", row: "rear", op: "eq" },
          {
            type: "target_exists",
            op: "eq",
            value: 0,
            query: { scope: "allies", filters: [{ type: "alive" }, { type: "row_is", row: "front" }], take: "all" },
          },
        ],
        costs: [],
        effects: [
          { type: "add_status", target: SELF, statusId: "gauntlets_momentum", stacks: 1 },
          { type: "move_to_open_row", target: SELF, row: "front", returnAfterAction: false },
        ],
        limit: CHAIN_ONCE,
      },
      ...[1, 2].map((stacks) => ({
        id: "gauntlets_footwork_momentum_damage_" + stacks + "_rule",
        listenTo: "damage_proposed", timing: "interrupt", priority: 40,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT, exactStatus("gauntlets_momentum", stacks)],
        allowRepeatInChain: true,
        costs: [],
        effects: [{
          type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(20 * stacks),
        }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      })),
    ],
    tags: ["passive", "movement", "attack", "gauntlets", "playable"],
  }),
  gauntlets_form_record: Object.freeze({
    id: "gauntlets_form_record", displayName: "見取り", weaponId: "gauntlets", treePosition: "BB1",
    displayEffect: "味方の攻撃を記録し、記録1つにつき自分の攻撃+8%。最大3つ。",
    flavorText: "見たものは、次の拳の中で一度だけ形になる。",
    rules: [
      {
        id: "gauntlets_form_record_rule",
        listenTo: "action_resolved", timing: "after", priority: 86,
        predicates: [EVENT_SOURCE_IS_OTHER_ALLY, ATTACK_EVENT],
        costs: [],
        effects: [{ type: "add_status", target: SELF, statusId: "gauntlets_form", stacks: 1 }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 3 },
      },
      ...[1, 2, 3].map((stacks) => ({
        id: "gauntlets_form_boost_" + stacks + "_rule",
        listenTo: "damage_proposed", timing: "interrupt", priority: 41,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT, exactStatus("gauntlets_form", stacks)],
        allowRepeatInChain: true,
        costs: [],
        effects: [{
          type: "modify_pending_amount",
          operation: "increase",
          amount: percentOfEvent(8 * stacks),
        }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      })),
    ],
    tags: ["passive", "attack", "gauntlets", "playable"],
  }),
};

const REACTIVE = {
  gauntlets_strike_guard: Object.freeze({
    id: "gauntlets_strike_guard", displayName: "打って守る", weaponId: "gauntlets", treePosition: "AB2",
    displayEffect: "自分の攻撃後、RP1で自分に防壁20。",
    flavorText: "打った手を戻さず、そのまま守りへつなぐ。",
    rules: [{
      id: "gauntlets_strike_guard_rule",
      listenTo: "action_resolved", timing: "after", priority: 58,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "gain_barrier", target: SELF, amount: { type: "constant", value: 20 }, duration: "round" }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "guard", "gauntlets", "playable"],
  }),
  gauntlets_empty_pocket: Object.freeze({
    id: "gauntlets_empty_pocket", displayName: "空いた懐", weaponId: "gauntlets", treePosition: "BA2",
    displayEffect: "敵を倒した時、RP1で空いた反対列へ移動。",
    flavorText: "ひとつ空いたなら、次の間合いへ先に入る。",
    rules: [
      ["front", "rear"],
      ["rear", "front"],
    ].map(([from, to]) => ({
      id: "gauntlets_empty_pocket_" + from + "_rule",
      listenTo: "actor_defeated", timing: "after", priority: 59,
      predicates: [
        { type: "event_tag", tag: "enemy", value: true },
        { type: "position", subject: "self", row: from, op: "eq" },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "move_to_open_row", target: SELF, row: to, returnAfterAction: false }],
      limit: CHAIN_ONCE,
    })),
    tags: ["reaction", "movement", "gauntlets", "playable"],
  }),
  gauntlets_borrowed_stance: Object.freeze({
    id: "gauntlets_borrowed_stance", displayName: "借り構え", weaponId: "gauntlets", treePosition: "BB2",
    displayEffect: "味方の攻撃後、RP2で集中を得る。",
    flavorText: "誰かの構えを借りても、返すのは自分の一撃だ。",
    rules: [{
      id: "gauntlets_borrowed_stance_rule",
      listenTo: "action_resolved", timing: "after", priority: 60,
      predicates: [EVENT_SOURCE_IS_OTHER_ALLY, ATTACK_EVENT],
      costs: [{ type: "spend_reaction_points", amount: 2 }],
      effects: [{ type: "add_status", target: SELF, statusId: "focused", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "attack", "gauntlets", "playable"],
  }),
};

const TARGET = {
  gauntlets_watch_target: Object.freeze({
    id: "gauntlets_watch_target", displayName: "目を離さない", weaponId: "gauntlets", treePosition: "B1",
    displayEffect: "直前に攻撃した敵が生きていれば、その敵を優先。",
    flavorText: "拳を向けた相手から、目を外さない。",
    targetQuery: PREVIOUS_ENEMY,
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
  ["A2", "passive", "gauntlets_chasing_fist", ["gauntlets_grip"]],
  ["A3", "active", "gauntlets_double_punch", ["gauntlets_chasing_fist"]],
  ["AA1", "passive", "gauntlets_combo_fists", ["gauntlets_double_punch"]],
  ["AA2", "passive", "gauntlets_pressure", ["gauntlets_combo_fists"]],
  ["AA3", "active", "gauntlets_hundred_fists", ["gauntlets_pressure"]],
  ["AB1", "passive", "gauntlets_knuckle_guard", ["gauntlets_double_punch"]],
  ["AB2", "reactive", "gauntlets_strike_guard", ["gauntlets_knuckle_guard"]],
  ["AB3", "active", "gauntlets_iron_body", ["gauntlets_strike_guard"]],
  ["B1", "target", "gauntlets_watch_target", ["gauntlets_punch"]],
  ["B2", "passive", "gauntlets_streak", ["gauntlets_watch_target"]],
  ["B3", "active", "gauntlets_barrage", ["gauntlets_streak"]],
  ["BA1", "passive", "gauntlets_footwork", ["gauntlets_barrage"]],
  ["BA2", "reactive", "gauntlets_empty_pocket", ["gauntlets_footwork"]],
  ["BA3", "active", "gauntlets_flying_knee", ["gauntlets_empty_pocket"]],
  ["BB1", "passive", "gauntlets_form_record", ["gauntlets_barrage"]],
  ["BB2", "reactive", "gauntlets_borrowed_stance", ["gauntlets_form_record"]],
  ["BB3", "active", "gauntlets_empty_hand", ["gauntlets_borrowed_stance"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "gauntlets", position, kind, skillId, requires: Object.freeze(requires),
})));
