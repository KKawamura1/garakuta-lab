// R25 — 双刃 A→AA 縦スライス。
// 駆け込み／引き足は active ID でなく、action_declared の melee tagを読む。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const MELEE_EVENT = Object.freeze({ type: "event_tag", tag: "melee", value: true });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});

function active(id, displayName, coefficientBps, hitCount, displayEffect, flavorText, options = {}) {
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
    targetQuery: ENEMY,
    effects: [{
      type: "deal_damage",
      target: EVENT_TARGETS,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
      hitCount,
      rangeClass: "melee",
      tags: ["attack", "weapon", "dual_blades"],
    }],
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
};

export const DUAL_BLADES_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const DUAL_BLADES_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const DUAL_BLADES_REACTIVE_SKILLS = Object.freeze({});
export const DUAL_BLADES_TARGET_SKILLS = Object.freeze({});

export const DUAL_BLADES_TREE = Object.freeze([
  ["R", "active", "dual_blades_two_cut", []],
  ["A1", "passive", "dual_blades_split_sharpening", ["dual_blades_two_cut"]],
  ["A2", "passive", "dual_blades_dash_in", ["dual_blades_split_sharpening"]],
  ["A3", "active", "dual_blades_three_cut", ["dual_blades_dash_in"]],
  ["AA1", "passive", "dual_blades_more_hands", ["dual_blades_three_cut"]],
  ["AA2", "passive", "dual_blades_retreat", ["dual_blades_more_hands"]],
  ["AA3", "active", "dual_blades_six_petals", ["dual_blades_retreat"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "dual_blades", position, kind, skillId, requires: Object.freeze(requires),
})));
