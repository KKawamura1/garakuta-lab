// R25 — 双刃19節。
// 駆け込み／引き足は active ID でなく、action_declared の melee tagを読む。
// AB枝は多段の対象変更、B/BA枝は裂傷、BB枝は予約刃を共有語彙だけで読む。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ONE_EVENT_TARGET = Object.freeze({ scope: "event_targets", take: 1 });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});
const ENEMIES = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: "all",
});
const ALTERNATE_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "not_previous_target" }],
  sort: ["position_asc"],
  take: 1,
});
const NEXT_LIVING_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "not_event_primary_target" }],
  sort: ["position_asc"],
  take: 1,
});
const BLEEDING_ENEMY = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "has_status", statusId: "bleeding", op: "gte", value: 1 }],
  sort: ["position_asc"],
  take: 1,
});
const ROW_ENEMIES = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "same_row_as_event_primary_target" }],
  sort: ["position_asc"],
  take: "all",
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const EVENT_SOURCE_IS_ALLY = Object.freeze({
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "is_event_source" }], take: 1 },
});
const EVENT_TARGET_IS_ENEMY = Object.freeze({
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const MELEE_EVENT = Object.freeze({ type: "event_tag", tag: "melee", value: true });
const NOT_EXTRA_HIT = Object.freeze({ type: "event_tag", tag: "extra_hit", value: false });
const NOT_COST_DAMAGE = Object.freeze({ type: "event_tag", tag: "cost", value: false });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});
const hitCountIs = (count) => ({ type: "event_value", key: "hitCount", op: "eq", value: count });
const hitIndexIs = (index) => ({ type: "event_value", key: "hitIndex", op: "eq", value: index });
const exactStatus = (statusId, stacks) => ({
  type: "has_status", subject: "self", statusId, op: "eq", value: stacks,
});
const eventEnemyHasStatus = (statusId, alive = true) => ({
  type: "target_exists",
  query: {
    scope: "enemies",
    filters: [
      ...(alive ? [{ type: "alive" }] : []),
      { type: "is_event_primary_target" },
      { type: "has_status", statusId, op: "gte", value: 1 },
    ],
    take: 1,
  },
});
const RESERVED_BLADE_STATUS = "dual_blades_reserved_blade";

function active(id, displayName, coefficientBps, hitCount, displayEffect, flavorText, options = {}) {
  const damage = {
    type: "deal_damage",
    target: options.target ?? EVENT_TARGETS,
    amount: options.amount ?? { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
    rangeClass: "melee",
    tags: ["attack", "weapon", "dual_blades"],
    ...(options.hitCountFromStatus ? { hitCountFromStatus: options.hitCountFromStatus } : { hitCount }),
    ...(options.hitDistribution ? { hitDistribution: options.hitDistribution } : {}),
    ...(options.targetPattern ? { targetPattern: options.targetPattern } : {}),
  };
  return Object.freeze({
    id,
    displayName,
    displayEffect,
    flavorText,
    weaponId: "dual_blades",
    treePosition: options.treePosition,
    ...(options.replacesActiveSkillId
      ? { replacesActiveSkillId: options.replacesActiveSkillId }
      : {}),
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: options.targetQuery ?? ENEMY,
    effects: [...(options.beforeEffects ?? []), damage, ...(options.afterEffects ?? [])],
    tags: ["attack", "weapon", "dual_blades", "playable"],
  });
}

const ACTIVE = {
  dual_blades_two_cut: active(
    "dual_blades_two_cut", "二連斬り", 5_500, 2,
    "敵1体に腕力55%のダメージを2hit。", "二本あるなら、二度斬る。", { treePosition: "R" },
  ),
  dual_blades_three_cut: active(
    "dual_blades_three_cut", "三連斬り", 5_000, 3,
    "敵1体に腕力50%のダメージを3hit。",
    "二本の刃へもう一拍を重ね、逃げる隙ごと刻み取る。",
    { treePosition: "A3", replacesActiveSkillId: "dual_blades_two_cut" },
  ),
  dual_blades_six_petals: active(
    "dual_blades_six_petals", "六花", 4_000, 6,
    "敵1体に腕力40%のダメージを6hit。",
    "六つの斬光が重なり、血煙の中に一輪の花を結ぶ。\n咲いたと気づく頃には、刃はもう鞘へ戻っている。",
    { treePosition: "AA3", replacesActiveSkillId: "dual_blades_three_cut" },
  ),
  dual_blades_dancing_cut: active(
    "dual_blades_dancing_cut", "舞い斬り", 4_500, 4,
    "近接範囲の敵へ腕力45%の斬撃を4hit。対象を固定順で分配する。",
    "一人を選んで斬るのではない。刃の届く場所すべてを、舞台にする。\n四つの軌道が交差し、立つ場所そのものが逃げ道を失う。",
    {
      treePosition: "AB3",
      replacesActiveSkillId: "dual_blades_three_cut",
      targetQuery: ENEMIES,
      hitDistribution: "round_robin",
    },
  ),
  dual_blades_wound_mark: active(
    "dual_blades_wound_mark", "傷刻み", 5_000, 2,
    "敵1体に腕力50%のダメージを2hit。裂傷を2段付ける。",
    "深く刻めば、傷は刃の続きを覚えている。",
    {
      treePosition: "B3",
      replacesActiveSkillId: "dual_blades_two_cut",
      afterEffects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "bleeding", stacks: 2 }],
    },
  ),
  dual_blades_blood_path: active(
    "dual_blades_blood_path", "血路", 7_000, 1,
    "選んだ敵と同じ列の敵へ腕力70%のダメージ。裂傷を深める。",
    "傷のついた場所を、道に変える。\nひとりの血が、同じ列にいる全員の足元まで続いていく。",
    {
      treePosition: "BA3",
      replacesActiveSkillId: "dual_blades_wound_mark",
      target: ONE_EVENT_TARGET,
      targetPattern: "row",
      afterEffects: [{ type: "add_status", target: ROW_ENEMIES, statusId: "bleeding", stacks: 1 }],
    },
  ),
  dual_blades_many_guests: active(
    "dual_blades_many_guests", "千客万来", 5_000, 2,
    "予約刃の数だけ近接範囲へ腕力50%の追撃。予約刃0なら傷刻みへ戻る。",
    "刃を招く。一本ずつ、空いた場所へ。\n誰かひとりを選ぶのではなく、来たものすべてへ返礼する。",
    {
      treePosition: "BB3",
      replacesActiveSkillId: "dual_blades_wound_mark",
      targetQuery: ENEMIES,
      hitCountFromStatus: { statusId: RESERVED_BLADE_STATUS, max: 6, fallback: 2 },
      hitDistribution: "round_robin",
      afterEffects: [{
        type: "remove_status", target: SELF, statusId: RESERVED_BLADE_STATUS, stacks: "all",
      }],
    },
  ),
};

function dashPassive(id, displayName, returnAfterAction, displayEffect, flavorText, treePosition) {
  return Object.freeze({
    id, displayName, displayEffect, flavorText, weaponId: "dual_blades", treePosition,
    ...(returnAfterAction ? { replacesPassiveSkillIds: ["dual_blades_dash_in"] } : {}),
    rules: [{
      id: id + "_rule",
      listenTo: "action_declared",
      // This must be an interrupt: `after` rules drain only once the complete
      // action chain ends, which would move the actor after dealing damage.
      timing: "interrupt",
      priority: 20,
      predicates: [
        SELF_IS_SOURCE,
        MELEE_EVENT,
        { type: "position", subject: "self", row: "rear", op: "eq" },
      ],
      costs: [],
      effects: [{
        type: "move_to_open_row", target: SELF, row: "front", returnAfterAction,
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "movement", "dual_blades", "playable"],
  });
}

const PASSIVE = {
  dual_blades_split_sharpening: Object.freeze({
    id: "dual_blades_split_sharpening", displayName: "研ぎ分け", weaponId: "dual_blades", treePosition: "A1",
    displayEffect: "2〜6hit攻撃の合計ダメージ+10%。",
    flavorText: "刃ごとに、違う角度で研ぐ。",
    rules: [{
      id: "dual_blades_split_sharpening_rule",
      listenTo: "damage_proposed", timing: "interrupt", priority: 42,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT,
        { type: "event_value", key: "hitCount", op: "gte", value: 2 },
      ],
      costs: [], allowRepeatInChain: true,
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(10) }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 6 },
    }],
    tags: ["passive", "attack", "dual_blades", "playable"],
  }),
  dual_blades_dash_in: dashPassive(
    "dual_blades_dash_in", "駆け込み", false,
    "後列から近接攻撃する時、空き前列へ移動してから攻撃する。攻撃後も前列に残る。",
    "届かない距離は、走って消す。", "A2",
  ),
  dual_blades_more_hands: Object.freeze({
    id: "dual_blades_more_hands", displayName: "手数", weaponId: "dual_blades", treePosition: "AA1",
    displayEffect: "3〜5hit攻撃に35%追撃を追加。最大6hit。",
    flavorText: "空いた一瞬にも、刃を差し込む。",
    rules: [3, 4, 5].map((hitCount) => ({
      id: "dual_blades_more_hands_" + hitCount + "_rule",
      listenTo: "damage_proposed", timing: "after", priority: 92,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT,
        { type: "event_value", key: "hitCount", op: "eq", value: hitCount },
        { type: "event_value", key: "hitIndex", op: "eq", value: hitCount - 1 },
      ],
      costs: [],
      effects: [{
        type: "deal_damage", target: EVENT_TARGETS, amount: percentOfEvent(35),
        tags: ["attack", "extra_hit"],
      }],
      limit: CHAIN_ONCE,
    })),
    tags: ["passive", "attack", "dual_blades", "playable"],
  }),
  dual_blades_retreat: dashPassive(
    "dual_blades_retreat", "引き足", true,
    "「駆け込み」で前進した攻撃後、元の後列が空いていれば戻る。",
    "斬るために危地へ踏み込み、刃の余韻が消える前に生きる場所へ戻る。", "AA2",
  ),
  dual_blades_edge_pass: Object.freeze({
    id: "dual_blades_edge_pass", displayName: "刃渡し", weaponId: "dual_blades", treePosition: "AB1",
    displayEffect: "2hit以上の攻撃は、hitごとに別の敵を選べる。",
    flavorText: "一つの傷へ、刃を重ね続ける必要はない。",
    rules: [{
      id: "dual_blades_edge_pass_rule",
      listenTo: "damage_proposed", timing: "interrupt", priority: 34,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT, NOT_EXTRA_HIT,
        { type: "event_value", key: "hitCount", op: "gte", value: 2 },
        {
          type: "target_exists",
          query: ALTERNATE_ENEMY,
        },
      ],
      costs: [], allowRepeatInChain: true,
      effects: [{ type: "redirect_pending_target", target: ALTERNATE_ENEMY }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "target", "dual_blades", "playable"],
  }),
  dual_blades_no_waste: Object.freeze({
    id: "dual_blades_no_waste", displayName: "無駄なし", weaponId: "dual_blades", treePosition: "AB2",
    displayEffect: "多段攻撃で対象が倒れた時、残りhitを次の敵へ回す。追加hitは回さない。",
    flavorText: "刃の数ではなく、残った隙を数える。",
    rules: [{
      id: "dual_blades_no_waste_rule",
      listenTo: "damage_skipped", timing: "after", priority: 91,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT, NOT_EXTRA_HIT,
        { type: "event_value", key: "reason", op: "eq", value: "target_defeated" },
        { type: "event_value", key: "hitCount", op: "gte", value: 2 },
        { type: "target_exists", query: NEXT_LIVING_ENEMY },
      ],
      costs: [], allowRepeatInChain: true,
      effects: [{
        type: "deal_damage",
        target: NEXT_LIVING_ENEMY,
        amount: { type: "event_value_scaled", key: "amount" },
        reach: "unrestricted",
        tags: ["attack", "dual_blades", "overflow_hit"],
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "attack", "dual_blades", "playable"],
  }),
  dual_blades_wound_expansion: Object.freeze({
    id: "dual_blades_wound_expansion", displayName: "傷口拡大", weaponId: "dual_blades", treePosition: "BA1",
    displayEffect: "裂傷のある敵へ行動の最初のhitを当てる時、固定ダメージ+5。",
    flavorText: "開いた傷口は、刃の重さをそのまま受け入れる。",
    rules: [{
      id: "dual_blades_wound_expansion_rule",
      listenTo: "damage_proposed", timing: "interrupt", priority: 44,
      predicates: [
        SELF_IS_SOURCE, ATTACK_EVENT, hitIndexIs(0), eventEnemyHasStatus("bleeding"),
      ],
      costs: [],
      effects: [{
        type: "modify_pending_amount", operation: "increase", amount: { type: "constant", value: 5 },
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "attack", "bleeding", "dual_blades", "playable"],
  }),
  dual_blades_blood_spray: Object.freeze({
    id: "dual_blades_blood_spray", displayName: "血飛沫", weaponId: "dual_blades", treePosition: "BA2",
    displayEffect: "裂傷の敵を倒すと、同じ列の生存敵へ裂傷を1段ずつ配る。",
    flavorText: "倒れた傷は、終わりではなく次の印になる。",
    rules: [{
      id: "dual_blades_blood_spray_rule",
      listenTo: "actor_defeated", timing: "after", priority: 82,
      predicates: [SELF_IS_SOURCE, eventEnemyHasStatus("bleeding", false)],
      costs: [],
      effects: [{ type: "add_status", target: ROW_ENEMIES, statusId: "bleeding", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "bleeding", "dual_blades", "playable"],
  }),
  dual_blades_blade_reservation: Object.freeze({
    id: "dual_blades_blade_reservation", displayName: "刃の予約", weaponId: "dual_blades", treePosition: "BB1",
    displayEffect: "味方の非攻撃主行動ごとに予約刃+1（最大6、1ラウンド3回）。予約刃1段につき攻撃+5%。",
    flavorText: "攻めない一拍も、次の刃を空振りにはしない。",
    rules: [
      {
        id: "dual_blades_reserved_blade_gain_rule",
        listenTo: "action_resolved", timing: "after", priority: 88,
        predicates: [EVENT_SOURCE_IS_ALLY, { type: "event_tag", tag: "attack", value: false }],
        costs: [],
        effects: [{ type: "add_status", target: SELF, statusId: RESERVED_BLADE_STATUS, stacks: 1 }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 3 },
      },
      ...Array.from({ length: 6 }, (_, index) => {
        const stacks = index + 1;
        return {
          id: `dual_blades_reserved_blade_${stacks}_rule`,
          listenTo: "damage_proposed", timing: "interrupt", priority: 43,
          predicates: [SELF_IS_SOURCE, ATTACK_EVENT, exactStatus(RESERVED_BLADE_STATUS, stacks)],
          costs: [], allowRepeatInChain: true,
          effects: [{
            type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(5 * stacks),
          }],
          limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
        };
      }),
    ],
    tags: ["passive", "attack", "dual_blades", "playable"],
  }),
};

const REACTIVE = {
  dual_blades_lacerating_edge: Object.freeze({
    id: "dual_blades_lacerating_edge", displayName: "裂き傷", weaponId: "dual_blades", treePosition: "B1",
    displayEffect: "同じ敵への2hit目でRP1。裂傷を1段付ける。1行動1回。",
    flavorText: "二度目の刃は、傷の深さを変える。",
    rules: [{
      id: "dual_blades_lacerating_edge_rule",
      listenTo: "damage_proposed", timing: "after", priority: 62,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, hitIndexIs(1)],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "bleeding", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "bleeding", "dual_blades", "playable"],
  }),
  dual_blades_insert_blade: Object.freeze({
    id: "dual_blades_insert_blade", displayName: "差し刃", weaponId: "dual_blades", treePosition: "BB2",
    displayEffect: "味方の攻撃hit後、予約刃1とRP1で同じ敵へ腕力35%の追撃。",
    flavorText: "味方の刃が作った隙へ、もう一本を差し込む。",
    rules: [{
      id: "dual_blades_insert_blade_rule",
      listenTo: "damage_taken", timing: "after", priority: 64,
      predicates: [
        EVENT_SOURCE_IS_ALLY, EVENT_TARGET_IS_ENEMY, ATTACK_EVENT, NOT_EXTRA_HIT,
        NOT_COST_DAMAGE, exactStatus(RESERVED_BLADE_STATUS, 1),
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [
        { type: "remove_status", target: SELF, statusId: RESERVED_BLADE_STATUS, stacks: 1 },
        {
          type: "deal_damage",
          target: ONE_EVENT_TARGET,
          amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 3_500 },
          rangeClass: "melee",
          tags: ["attack", "weapon", "dual_blades", "extra_hit"],
        },
      ],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "attack", "dual_blades", "playable"],
  }),
};

const TARGET = {
  dual_blades_blood_scent: Object.freeze({
    id: "dual_blades_blood_scent", displayName: "血を追う", weaponId: "dual_blades", treePosition: "B2",
    displayEffect: "裂傷を持つ、近接範囲内の敵を優先。なければ通常の合法対象。",
    flavorText: "血の匂いは、刃より先に道を選ぶ。",
    targetQuery: BLEEDING_ENEMY,
    tags: ["target", "bleeding", "dual_blades", "playable"],
  }),
};

export const DUAL_BLADES_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const DUAL_BLADES_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const DUAL_BLADES_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const DUAL_BLADES_TARGET_SKILLS = Object.freeze(TARGET);

export const DUAL_BLADES_TREE = Object.freeze([
  ["R", "active", "dual_blades_two_cut", []],
  ["A1", "passive", "dual_blades_split_sharpening", ["dual_blades_two_cut"]],
  ["A2", "passive", "dual_blades_dash_in", ["dual_blades_split_sharpening"]],
  ["A3", "active", "dual_blades_three_cut", ["dual_blades_dash_in"]],
  ["AA1", "passive", "dual_blades_more_hands", ["dual_blades_three_cut"]],
  ["AA2", "passive", "dual_blades_retreat", ["dual_blades_more_hands"]],
  ["AA3", "active", "dual_blades_six_petals", ["dual_blades_retreat"]],
  ["AB1", "passive", "dual_blades_edge_pass", ["dual_blades_three_cut"]],
  ["AB2", "passive", "dual_blades_no_waste", ["dual_blades_edge_pass"]],
  ["AB3", "active", "dual_blades_dancing_cut", ["dual_blades_no_waste"]],
  ["B1", "reactive", "dual_blades_lacerating_edge", ["dual_blades_two_cut"]],
  ["B2", "target", "dual_blades_blood_scent", ["dual_blades_lacerating_edge"]],
  ["B3", "active", "dual_blades_wound_mark", ["dual_blades_blood_scent"]],
  ["BA1", "passive", "dual_blades_wound_expansion", ["dual_blades_wound_mark"]],
  ["BA2", "passive", "dual_blades_blood_spray", ["dual_blades_wound_expansion"]],
  ["BA3", "active", "dual_blades_blood_path", ["dual_blades_blood_spray"]],
  ["BB1", "passive", "dual_blades_blade_reservation", ["dual_blades_wound_mark"]],
  ["BB2", "reactive", "dual_blades_insert_blade", ["dual_blades_blade_reservation"]],
  ["BB3", "active", "dual_blades_many_guests", ["dual_blades_insert_blade"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "dual_blades", position, kind, skillId, requires: Object.freeze(requires),
})));
