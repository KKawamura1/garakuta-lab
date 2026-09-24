// R27 — 重弩19節。
//
// 準備射は「一発を待つ」こと自体がコストであり、準備中の被弾・対象の
// 変化・次弾の在庫を共有 event へ残す。予約したタイルそのものは現行盤面
// に無いため、着弾印は対象 actor の status として保存する。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ONE_EVENT_TARGET = Object.freeze({ scope: "event_targets", take: 1 });
const ENEMY = Object.freeze({ scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 });
const MAX_HP_ENEMY = Object.freeze({ scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_desc", "position_asc"], take: 1 });
const ROW_ENEMIES = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }, { type: "same_row_as_event_primary_target" }, { type: "not_event_primary_target" }],
  sort: ["position_asc"], take: "all",
});
const EVENT_SOURCE_MARKED = Object.freeze({
  type: "target_exists", query: { scope: "event_source", filters: [{ type: "has_status", statusId: "heavy_crossbow_target_mark", op: "gte", value: 1 }], take: 1 },
});
const EVENT_TARGET_IS_ENEMY = Object.freeze({
  type: "target_exists", query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const PREPARED_EVENT = Object.freeze({ type: "event_tag", tag: "prepared", value: true });
const NOT_EXTRA_HIT = Object.freeze({ type: "event_tag", tag: "extra_hit", value: false });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});

function preparedShot(id, displayName, coefficientBps, displayEffect, flavorText, options = {}) {
  const completionTarget = options.completionTarget ?? ENEMY;
  const completionDamage = {
    type: "deal_damage",
    target: options.damageTarget ?? completionTarget,
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
    rangeClass: "ranged",
    ...(options.targetPattern ? { targetPattern: options.targetPattern } : {}),
    ...(options.hitCount ? { hitCount: options.hitCount } : {}),
    ...(options.guardPierceBps ? { guardPierceBps: options.guardPierceBps } : {}),
    tags: ["attack", "weapon", "heavy_crossbow", "ranged", "prepared"],
  };
  return Object.freeze({
    id, displayName, displayEffect, flavorText,
    weaponId: "heavy_crossbow", treePosition: options.treePosition,
    ...(options.replacesActiveSkillId ? { replacesActiveSkillId: options.replacesActiveSkillId } : {}),
    ...(options.usesPerBattle ? { usesPerBattle: options.usesPerBattle } : {}),
    apCost: 1, actionMode: "channel", intrinsicPredicates: options.intrinsicPredicates ?? [],
    targetQuery: options.targetQuery ?? completionTarget, effects: [],
    preparation: {
      steps: 1,
      completionEffects: [completionDamage, ...(options.afterCompletionEffects ?? [])],
    },
    tags: ["attack", "weapon", "heavy_crossbow", "ranged", "prepared", "playable"],
  });
}

const ACTIVE = {
  heavy_crossbow_loaded_shot: Object.freeze({
    id: "heavy_crossbow_loaded_shot", displayName: "装填射",
    displayEffect: "準備1の後、最も近い敵1体に腕力200%のダメージ。",
    flavorText: "重い一矢には、待つ価値がある。",
    weaponId: "heavy_crossbow", treePosition: "R", apCost: 1, actionMode: "channel",
    intrinsicPredicates: [], targetQuery: ENEMY, effects: [],
    preparation: { steps: 1, completionEffects: [{ type: "deal_damage", target: ENEMY, amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 20_000 }, rangeClass: "long", tags: ["attack", "weapon", "heavy_crossbow", "ranged", "prepared"] }] },
    tags: ["attack", "weapon", "heavy_crossbow", "ranged", "prepared", "playable"],
  }),
  heavy_crossbow_heavy_loaded_shot: preparedShot(
    "heavy_crossbow_heavy_loaded_shot", "重装填射", 28_000,
    "準備1の後、最も近い敵1体に腕力280%のダメージ。", "弦を引く音を、着弾の前奏にする。",
    { treePosition: "A3", replacesActiveSkillId: "heavy_crossbow_loaded_shot" },
  ),
  heavy_crossbow_siege_breaker: preparedShot(
    "heavy_crossbow_siege_breaker", "城砕き", 40_000,
    "準備1の後、最も近い敵1体に腕力400%のダメージ。防御を16無視する。", "城門の厚みごと、一発の理由にする。",
    { treePosition: "AA3", replacesActiveSkillId: "heavy_crossbow_heavy_loaded_shot", guardPierceBps: 1_600 },
  ),
  heavy_crossbow_burst_bolt: preparedShot(
    "heavy_crossbow_burst_bolt", "破裂矢", 22_000,
    "準備1の後、対象と同じ列の敵全員に腕力220%。", "一つの着弾を、列の圧力へ割る。",
    { treePosition: "AB3", replacesActiveSkillId: "heavy_crossbow_heavy_loaded_shot", targetQuery: ENEMY, completionTarget: ENEMY, damageTarget: ENEMY, targetPattern: "row" },
  ),
  heavy_crossbow_reserved_shot: preparedShot(
    "heavy_crossbow_reserved_shot", "予約射", 32_000,
    "最大HPの敵を予約し、準備1の後に腕力320%のダメージ。", "大物を先に決めれば、準備の時間も照準になる。",
    { treePosition: "B3", replacesActiveSkillId: "heavy_crossbow_loaded_shot", targetQuery: MAX_HP_ENEMY, completionTarget: MAX_HP_ENEMY },
  ),
  heavy_crossbow_timed_bolt: preparedShot(
    "heavy_crossbow_timed_bolt", "時限矢", 30_000,
    "準備1の後、最大HPの敵に腕力300%のダメージと時限印3。", "矢を放つ前から、踏んだ後の時間まで決めておく。",
    {
      treePosition: "BA3", replacesActiveSkillId: "heavy_crossbow_reserved_shot", targetQuery: MAX_HP_ENEMY, completionTarget: MAX_HP_ENEMY,
      afterCompletionEffects: [{ type: "add_status", target: MAX_HP_ENEMY, statusId: "heavy_crossbow_detonation", stacks: 3 }],
    },
  ),
  heavy_crossbow_three_time_shot: preparedShot(
    "heavy_crossbow_three_time_shot", "三時射", 26_000,
    "準備1の後、同じ敵へ腕力260%の矢を3hit。次弾を2段使い切る。", "三つの未来を一つの標的へ重ねる。",
    { treePosition: "BB3", replacesActiveSkillId: "heavy_crossbow_reserved_shot", targetQuery: MAX_HP_ENEMY, completionTarget: MAX_HP_ENEMY, hitCount: 3 },
  ),
};

function preparedDamagePassive(id, displayName, percent, treePosition, displayEffect, flavorText, predicates = []) {
  return Object.freeze({
    id, displayName, weaponId: "heavy_crossbow", treePosition, displayEffect, flavorText,
    rules: [{
      id: id + "_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 43,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, PREPARED_EVENT, ...predicates], costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(percent) }],
      allowRepeatInChain: true, limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }], tags: ["passive", "attack", "heavy_crossbow", "playable"],
  });
}

const PASSIVE = {
  heavy_crossbow_strong_string: preparedDamagePassive(
    "heavy_crossbow_strong_string", "強弦", 20, "A1", "準備射の合計ダメージ+20%。", "引き絞る時間を、弦の強さへ変える。",
  ),
  heavy_crossbow_armor_piercing: preparedDamagePassive(
    "heavy_crossbow_armor_piercing", "徹甲矢", 8, "A2", "準備射の防御を合計8無視する（現行語彙では貫通打相当）。", "鎧の表面ではなく、芯を予約する。",
  ),
  heavy_crossbow_thick_bolt: preparedDamagePassive(
    "heavy_crossbow_thick_bolt", "極太矢", 25, "AA1", "準備射の基本hitダメージ+25%。", "太い矢は、待った時間を裏切らない。",
  ),
  heavy_crossbow_siege_piercer: preparedDamagePassive(
    "heavy_crossbow_siege_piercer", "城抜き", 8, "AA2", "準備射の貫通打相当をさらに+8%。", "壁の枚数を数える前に、抜ける芯を作る。",
  ),
  heavy_crossbow_explosive_canister: Object.freeze({
    id: "heavy_crossbow_explosive_canister", displayName: "炸裂筒", weaponId: "heavy_crossbow", treePosition: "AB1",
    displayEffect: "準備射が同じ列の他の敵へ腕力35%の追加hitを作る。", flavorText: "一つの着弾を、列全体の揺れへ広げる。",
    rules: [{
      id: "heavy_crossbow_explosive_canister_rule", listenTo: "damage_proposed", timing: "after", priority: 84,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, PREPARED_EVENT, NOT_EXTRA_HIT], costs: [],
      effects: [{ type: "deal_damage", target: ROW_ENEMIES, amount: percentOfEvent(35), rangeClass: "ranged", tags: ["attack", "weapon", "heavy_crossbow", "ranged", "extra_hit"] }],
      limit: CHAIN_ONCE,
    }], tags: ["passive", "attack", "heavy_crossbow", "playable"],
  }),
  heavy_crossbow_blast_pressure: Object.freeze({
    id: "heavy_crossbow_blast_pressure", displayName: "爆圧", weaponId: "heavy_crossbow", treePosition: "AB2",
    displayEffect: "準備射が同じ列の敵全員へ怯み2を付ける。", flavorText: "炸裂の圧は、ダメージの外側へも残る。",
    rules: [{
      id: "heavy_crossbow_blast_pressure_rule", listenTo: "damage_proposed", timing: "after", priority: 83,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, PREPARED_EVENT, NOT_EXTRA_HIT], costs: [],
      effects: [{ type: "add_status", target: ROW_ENEMIES, statusId: "staggered", stacks: 2 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "debuff", "heavy_crossbow", "playable"],
  }),
  heavy_crossbow_loading_hold: Object.freeze({
    id: "heavy_crossbow_loading_hold", displayName: "装填維持", weaponId: "heavy_crossbow", treePosition: "B2",
    displayEffect: "準備中に受けたダメージで準備を失わず、予約対象が動いても追い続ける。",
    flavorText: "揺さぶられても、弦を戻さない。",
    rules: [{
      id: "heavy_crossbow_loading_hold_rule", listenTo: "action_started", timing: "after", priority: 72,
      predicates: [SELF_IS_SOURCE, PREPARED_EVENT], costs: [],
      effects: [{ type: "add_status", target: SELF, statusId: "heavy_crossbow_steady", stacks: 1 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "utility", "heavy_crossbow", "playable"],
  }),
  heavy_crossbow_impact_mark: Object.freeze({
    id: "heavy_crossbow_impact_mark", displayName: "着弾印", weaponId: "heavy_crossbow", treePosition: "BA1",
    displayEffect: "準備射の対象へ着弾印を残す。対象が移動しても印は残る。", flavorText: "狙った場所を、敵が動いた後にも覚えている。",
    rules: [{
      id: "heavy_crossbow_impact_mark_rule", listenTo: "target_selected", timing: "after", priority: 71,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, EVENT_TARGET_IS_ENEMY], costs: [],
      effects: [{ type: "add_status", target: ONE_EVENT_TARGET, statusId: "heavy_crossbow_target_mark", stacks: 1 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "utility", "heavy_crossbow", "playable"],
  }),
  heavy_crossbow_next_ammo: Object.freeze({
    id: "heavy_crossbow_next_ammo", displayName: "次弾装填", weaponId: "heavy_crossbow", treePosition: "BB1",
    displayEffect: "通常の準備射を解決するたび次弾を1段装填。次の準備射を1段8%ずつ強める（最大3）。",
    flavorText: "撃ち終わった後に、次の一発の重さを先に作る。",
    rules: [
      {
        id: "heavy_crossbow_next_ammo_load_rule", listenTo: "action_resolved", timing: "after", priority: 70,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT, PREPARED_EVENT], costs: [],
        effects: [{ type: "add_status", target: SELF, statusId: "heavy_crossbow_ammo", stacks: 1 }], limit: { owner: "actor-instance + rule", scope: "battle", count: 3 },
      },
      ...[1, 2, 3].map((stacks) => ({
        id: `heavy_crossbow_next_ammo_boost_${stacks}_rule`, listenTo: "damage_proposed", timing: "interrupt", priority: 41,
        predicates: [SELF_IS_SOURCE, ATTACK_EVENT, PREPARED_EVENT, { type: "has_status", subject: "self", statusId: "heavy_crossbow_ammo", op: "eq", value: stacks }], costs: [],
        effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(8 * stacks) }], allowRepeatInChain: true,
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      })),
    ], tags: ["passive", "attack", "heavy_crossbow", "playable"],
  }),
};

const REACTIVE = {
  heavy_crossbow_trigger_detonation: Object.freeze({
    id: "heavy_crossbow_trigger_detonation", displayName: "起爆", weaponId: "heavy_crossbow", treePosition: "BA2",
    displayEffect: "着弾印のある対象が移動した時、RP1で技術120%の起爆hitを与え、印を消す。",
    flavorText: "踏んだ瞬間に、予約していた一発を返す。",
    rules: [{
      id: "heavy_crossbow_detonation_rule", listenTo: "actor_moved", timing: "after", priority: 91,
      predicates: [EVENT_SOURCE_MARKED], costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [
        { type: "deal_damage", target: { scope: "event_source", take: 1 }, amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 12_000 }, rangeClass: "long", tags: ["attack", "weapon", "heavy_crossbow", "detonation"] },
        { type: "remove_status", target: { scope: "event_source", take: 1 }, statusId: "heavy_crossbow_target_mark", stacks: "all" },
      ], limit: CHAIN_ONCE,
    }], tags: ["reaction", "attack", "heavy_crossbow", "playable"],
  }),
  heavy_crossbow_future_shot: Object.freeze({
    id: "heavy_crossbow_future_shot", displayName: "未来撃ち", weaponId: "heavy_crossbow", treePosition: "BB2",
    displayEffect: "準備射の解決時、RP2と次弾1段で次のラウンドへAP1を持ち越す。",
    flavorText: "今の着弾の中へ、次の一発の影を重ねる。",
    rules: [{
      id: "heavy_crossbow_future_shot_rule", listenTo: "action_resolved", timing: "after", priority: 90,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, PREPARED_EVENT], costs: [{ type: "spend_reaction_points", amount: 2 }],
      effects: [
        { type: "gain_resource", target: SELF, resource: "action_points", amount: { type: "constant", value: 1 }, tags: ["support", "heavy_crossbow", "future"] },
        { type: "remove_status", target: SELF, statusId: "heavy_crossbow_ammo", stacks: 1 },
      ], limit: CHAIN_ONCE,
    }], tags: ["reaction", "attack", "heavy_crossbow", "playable"],
  }),
};

const TARGET = {
  heavy_crossbow_large_game: Object.freeze({
    id: "heavy_crossbow_large_game", displayName: "大物を狙う", weaponId: "heavy_crossbow", treePosition: "B1",
    displayEffect: "最大HPの敵を優先対象にする。", flavorText: "大きいものから崩せば、残りの列は軽くなる。",
    targetQuery: MAX_HP_ENEMY, tags: ["target", "attack", "heavy_crossbow", "playable"],
  }),
};

export const HEAVY_CROSSBOW_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const HEAVY_CROSSBOW_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const HEAVY_CROSSBOW_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const HEAVY_CROSSBOW_TARGET_SKILLS = Object.freeze(TARGET);

export const HEAVY_CROSSBOW_TREE = Object.freeze([
  ["R", "active", "heavy_crossbow_loaded_shot", []],
  ["A1", "passive", "heavy_crossbow_strong_string", ["heavy_crossbow_loaded_shot"]],
  ["A2", "passive", "heavy_crossbow_armor_piercing", ["heavy_crossbow_strong_string"]],
  ["A3", "active", "heavy_crossbow_heavy_loaded_shot", ["heavy_crossbow_armor_piercing"]],
  ["AA1", "passive", "heavy_crossbow_thick_bolt", ["heavy_crossbow_heavy_loaded_shot"]],
  ["AA2", "passive", "heavy_crossbow_siege_piercer", ["heavy_crossbow_thick_bolt"]],
  ["AA3", "active", "heavy_crossbow_siege_breaker", ["heavy_crossbow_siege_piercer"]],
  ["AB1", "passive", "heavy_crossbow_explosive_canister", ["heavy_crossbow_heavy_loaded_shot"]],
  ["AB2", "passive", "heavy_crossbow_blast_pressure", ["heavy_crossbow_explosive_canister"]],
  ["AB3", "active", "heavy_crossbow_burst_bolt", ["heavy_crossbow_blast_pressure"]],
  ["B1", "target", "heavy_crossbow_large_game", ["heavy_crossbow_loaded_shot"]],
  ["B2", "passive", "heavy_crossbow_loading_hold", ["heavy_crossbow_large_game"]],
  ["B3", "active", "heavy_crossbow_reserved_shot", ["heavy_crossbow_loading_hold"]],
  ["BA1", "passive", "heavy_crossbow_impact_mark", ["heavy_crossbow_reserved_shot"]],
  ["BA2", "reactive", "heavy_crossbow_trigger_detonation", ["heavy_crossbow_impact_mark"]],
  ["BA3", "active", "heavy_crossbow_timed_bolt", ["heavy_crossbow_trigger_detonation"]],
  ["BB1", "passive", "heavy_crossbow_next_ammo", ["heavy_crossbow_reserved_shot"]],
  ["BB2", "reactive", "heavy_crossbow_future_shot", ["heavy_crossbow_next_ammo"]],
  ["BB3", "active", "heavy_crossbow_three_time_shot", ["heavy_crossbow_future_shot"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "heavy_crossbow", position, kind, skillId, requires: Object.freeze(requires),
})));
