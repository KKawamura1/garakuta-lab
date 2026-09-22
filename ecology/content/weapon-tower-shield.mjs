// R26 — 大盾19節。
//
// 大盾は「敵の攻撃を自分へ寄せる」だけで終わらせず、誘引で受けた
// damage・防壁・位置交換を共有 event と状態へ渡す。盾の名前や特定の
// 敵技能は読まず、target_selected / target_changed / barrier_gained の
// 公開された戦場事実だけを読む。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});
const ALL_ALLIES = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }], sort: ["position_asc"], take: "all",
});
const LOWEST_HP_ALLY = Object.freeze({
  scope: "allies",
  filters: [{ type: "alive" }],
  sort: ["hp_percent_asc"],
  take: 1,
});
const LOWEST_BARRIER_OTHER_ALLY = Object.freeze({
  scope: "allies",
  filters: [{ type: "alive" }, { type: "not_event_primary_target" }],
  sort: ["barrier_asc"],
  take: 1,
});
const OTHER_ALLY_EVENT_TARGET = Object.freeze({
  scope: "allies",
  filters: [{ type: "alive" }, { type: "is_event_primary_target" }, { type: "not_self" }],
  take: 1,
});
const ENEMY_EVENT_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_source" }], take: 1 },
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const SELF_IS_TARGET = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const EVENT_TARGET_HAS_LINE = Object.freeze({
  type: "has_status", subject: "event_primary_target", statusId: "tower_shield_line_status", op: "gte", value: 1,
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const NOT_COST_DAMAGE = Object.freeze({ type: "event_tag", tag: "cost", value: false });
const REDIRECT_EVENT = Object.freeze({ type: "event_tag", tag: "redirect", value: true });
const EFFECT_EVENT = Object.freeze({ type: "event_tag", tag: "effect", value: true });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent, key = "amount") => ({
  type: "event_value_scaled", key, numerator: percent, denominator: 100,
});
const exactStatus = (statusId, stacks) => ({
  type: "has_status", subject: "self", statusId, op: "eq", value: stacks,
});
const eventValueAtLeast = (key, value) => ({
  type: "event_value", key, op: "gte", value,
});

function barrierActive(id, displayName, amount, displayEffect, flavorText, options = {}) {
  return Object.freeze({
    id,
    displayName,
    displayEffect,
    flavorText,
    weaponId: "tower_shield",
    treePosition: options.treePosition,
    ...(options.replacesActiveSkillId
      ? { replacesActiveSkillId: options.replacesActiveSkillId }
      : {}),
    apCost: 1,
    actionMode: "channel",
    intrinsicPredicates: [],
    targetQuery: SELF,
    effects: [
      {
        type: "gain_barrier",
        target: options.barrierTarget ?? SELF,
        amount: { type: "constant", value: amount },
        duration: "round",
      },
      ...(options.extraEffects ?? []),
    ],
    tags: ["guard", "support", "weapon", "tower_shield", "playable"],
  });
}

function shieldAttack(id, displayName, coefficientBps, displayEffect, flavorText, options = {}) {
  return Object.freeze({
    id,
    displayName,
    displayEffect,
    flavorText,
    weaponId: "tower_shield",
    treePosition: options.treePosition,
    replacesActiveSkillId: options.replacesActiveSkillId,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: ENEMY,
    effects: [
      {
        type: "deal_damage",
        target: EVENT_TARGETS,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
        rangeClass: "melee",
        tags: ["attack", "weapon", "tower_shield", "melee"],
      },
      ...(options.extraEffects ?? []),
    ],
    tags: ["guard", "attack", "weapon", "tower_shield", "playable"],
  });
}

const ACTIVE = {
  tower_shield_draw_guard: Object.freeze({
    id: "tower_shield_draw_guard",
    displayName: "守りを引く",
    displayEffect: "自分に防壁30と誘引2。誘引は敵の単体攻撃を優先して引き受ける。",
    flavorText: "狙うなら、私を。",
    weaponId: "tower_shield",
    treePosition: "R",
    apCost: 1,
    actionMode: "channel",
    intrinsicPredicates: [],
    targetQuery: SELF,
    effects: [
      { type: "gain_barrier", target: SELF, amount: { type: "constant", value: 30 }, duration: "round" },
      { type: "add_status", target: SELF, statusId: "taunted", stacks: 2 },
    ],
    tags: ["guard", "support", "weapon", "tower_shield", "playable"],
  }),
  tower_shield_hold_fast: barrierActive(
    "tower_shield_hold_fast", "堅守", 60,
    "自分に防壁60と誘引3。", "ここから先へは通さない。この盾が、皆の城壁になる。",
    { treePosition: "A3", replacesActiveSkillId: "tower_shield_draw_guard", extraEffects: [
      { type: "add_status", target: SELF, statusId: "taunted", stacks: 3 },
    ] },
  ),
  tower_shield_gate: barrierActive(
    "tower_shield_gate", "城門", 100,
    "自分に防壁100と誘引5。", "この身体を門とし、この盾を閉ざされた城壁とする。\n私が立つ限り、誰一人ここから先へは通さない。",
    { treePosition: "AA3", replacesActiveSkillId: "tower_shield_hold_fast", extraEffects: [
      { type: "add_status", target: SELF, statusId: "taunted", stacks: 5 },
    ] },
  ),
  tower_shield_bash: shieldAttack(
    "tower_shield_bash", "盾撃", 10_000,
    "最も近い敵に腕力100%のダメージ後、自分に防壁25と誘引1。",
    "受けるだけが守りじゃない。押し返して道を空ける。",
    {
      treePosition: "B3", replacesActiveSkillId: "tower_shield_draw_guard",
      extraEffects: [
        { type: "gain_barrier", target: SELF, amount: { type: "constant", value: 25 }, duration: "round" },
        { type: "add_status", target: SELF, statusId: "taunted", stacks: 1 },
      ],
    },
  ),
  tower_shield_line_guard: Object.freeze({
    id: "tower_shield_line_guard",
    displayName: "防護線",
    displayEffect: "味方全員に防壁35。自分にはさらに誘引3。",
    flavorText: "盾を連ねたその線が、仲間のための前線になる。\n一歩も退かず、全員の帰る場所を守り抜く。",
    weaponId: "tower_shield",
    treePosition: "AB3",
    replacesActiveSkillId: "tower_shield_hold_fast",
    apCost: 1,
    actionMode: "channel",
    intrinsicPredicates: [],
    targetQuery: SELF,
    effects: [
      { type: "gain_barrier", target: ALL_ALLIES, amount: { type: "constant", value: 35 }, duration: "round" },
      { type: "add_status", target: SELF, statusId: "taunted", stacks: 3 },
    ],
    tags: ["guard", "support", "weapon", "tower_shield", "playable"],
  }),
  tower_shield_sanctuary: Object.freeze({
    id: "tower_shield_sanctuary",
    displayName: "聖域",
    displayEffect: "味方全員に防壁40。次のラウンド開始まで、敵の単体攻撃を自分へ引き受ける。",
    flavorText: "この盾の内側だけは、痛みも恐怖も踏み込ませない。\nここにいる限り、誰一人傷つけさせない。",
    weaponId: "tower_shield",
    treePosition: "BA3",
    replacesActiveSkillId: "tower_shield_bash",
    apCost: 1,
    actionMode: "channel",
    intrinsicPredicates: [],
    targetQuery: SELF,
    effects: [
      { type: "gain_barrier", target: ALL_ALLIES, amount: { type: "constant", value: 40 }, duration: "round" },
      { type: "add_status", target: SELF, statusId: "tower_shield_sanctuary_status", stacks: 1 },
    ],
    tags: ["guard", "support", "weapon", "tower_shield", "playable"],
  }),
  tower_shield_mirror_castle: Object.freeze({
    id: "tower_shield_mirror_castle",
    displayName: "鏡城",
    displayEffect: "自分の防壁を0にし、誘引3と鏡3を得る。鏡が尽きるまで通常の軽減を無効にする。",
    flavorText: "受けた痛みを鏡へ沈め、命として仲間へ返していく。\n守るだけの城ではない。すべてを生へ反転する城だ。",
    weaponId: "tower_shield",
    treePosition: "BB3",
    replacesActiveSkillId: "tower_shield_bash",
    apCost: 1,
    actionMode: "channel",
    intrinsicPredicates: [],
    targetQuery: SELF,
    effects: [
      { type: "remove_barrier", target: SELF },
      { type: "add_status", target: SELF, statusId: "taunted", stacks: 3 },
      { type: "add_status", target: SELF, statusId: "tower_shield_mirror", stacks: 3 },
      { type: "add_status", target: SELF, statusId: "tower_shield_castle", stacks: 1 },
    ],
    tags: ["guard", "support", "weapon", "tower_shield", "playable"],
  }),
};

const PASSIVE = {
  tower_shield_thick_plate: Object.freeze({
    id: "tower_shield_thick_plate", displayName: "厚板", weaponId: "tower_shield", treePosition: "A1",
    displayEffect: "主軸が付与する防壁+15。", flavorText: "厚みは、裏切らない。",
    rules: [{
      id: "tower_shield_thick_plate_rule", listenTo: "barrier_proposed", timing: "interrupt", priority: 41,
      predicates: [SELF_IS_SOURCE], costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: { type: "constant", value: 15 } }],
      allowRepeatInChain: true,
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "guard", "tower_shield", "playable"],
  }),
  tower_shield_visible: Object.freeze({
    id: "tower_shield_visible", displayName: "目立つ盾", weaponId: "tower_shield", treePosition: "A2",
    displayEffect: "主軸が付与する誘引+1。", flavorText: "隠すより、見せた方が守れる。",
    rules: [{
      id: "tower_shield_visible_rule", listenTo: "status_added", timing: "after", priority: 82,
      predicates: [SELF_IS_SOURCE, { type: "event_value", key: "statusId", op: "eq", value: "taunted" }],
      costs: [], effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "taunted", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "guard", "tower_shield", "playable"],
  }),
  tower_shield_shock_absorption: Object.freeze({
    id: "tower_shield_shock_absorption", displayName: "衝撃吸収", weaponId: "tower_shield", treePosition: "AA1",
    displayEffect: "誘引で引き受けた攻撃のダメージ-20%。", flavorText: "受ける角度で、重さは変わる。",
    rules: [
      {
        id: "tower_shield_shock_absorption_target_rule", listenTo: "target_changed", timing: "after", priority: 81,
        predicates: [SELF_IS_TARGET, REDIRECT_EVENT, { type: "event_value", key: "targetCount", op: "eq", value: 1 }], costs: [],
        effects: [{ type: "add_status", target: SELF, statusId: "tower_shield_redirected", stacks: 1 }],
        limit: CHAIN_ONCE,
      },
      {
        id: "tower_shield_shock_absorption_damage_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 38,
        predicates: [SELF_IS_TARGET, ATTACK_EVENT, REDIRECT_EVENT], costs: [],
        effects: [{ type: "modify_pending_amount", operation: "decrease", amount: percentOfEvent(20) }],
        allowRepeatInChain: true,
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      },
      {
        id: "tower_shield_shock_absorption_taunt_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 38,
        predicates: [
          SELF_IS_TARGET,
          ATTACK_EVENT,
          { type: "has_status", subject: "self", statusId: "taunted", op: "gte", value: 1 },
        ], costs: [],
        effects: [{ type: "modify_pending_amount", operation: "decrease", amount: percentOfEvent(20) }],
        allowRepeatInChain: true,
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      },
      {
        id: "tower_shield_shock_absorption_clear_rule", listenTo: "action_resolved", timing: "after", priority: 91,
        predicates: [SELF_IS_TARGET, ENEMY_EVENT_SOURCE, ATTACK_EVENT], costs: [],
        effects: [{ type: "remove_status", target: SELF, statusId: "tower_shield_redirected", stacks: "all" }],
        limit: CHAIN_ONCE,
      },
    ],
    tags: ["passive", "guard", "tower_shield", "playable"],
  }),
  tower_shield_wall_frame: Object.freeze({
    id: "tower_shield_wall_frame", displayName: "城壁骨格", weaponId: "tower_shield", treePosition: "AA2",
    // maxHp is the integer projection of the catalog's 15% conditional bonus.
    // The current static-bonus path is intentionally unconditional once the
    // passive is installed; the battle input has no selected-active context.
    statBonus: { max_hp: 32 },
    displayEffect: "防壁か誘引を与える主軸を選択中、最大HP+15%。",
    flavorText: "受け止め続ける覚悟が骨を柱へ変え、身体そのものを城壁にする。",
    tags: ["passive", "guard", "tower_shield", "playable"],
  }),
  tower_shield_side_plate: Object.freeze({
    id: "tower_shield_side_plate", displayName: "横板", weaponId: "tower_shield", treePosition: "AB1",
    displayEffect: "単体へ防壁を与える主軸が、防壁の最も少ない別の味方にも届く。",
    flavorText: "盾は横へ広げられる。",
    rules: [{
      id: "tower_shield_side_plate_rule", listenTo: "barrier_gained", timing: "after", priority: 87,
      predicates: [SELF_IS_SOURCE], costs: [],
      effects: [{
        type: "gain_barrier", target: LOWEST_BARRIER_OTHER_ALLY,
        amount: percentOfEvent(100), duration: "round",
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "support", "tower_shield", "playable"],
  }),
  tower_shield_line: Object.freeze({
    id: "tower_shield_line", displayName: "盾の列", weaponId: "tower_shield", treePosition: "AB2",
    displayEffect: "主軸から防壁を得た味方は、1ラウンド被ダメージ-15%。",
    flavorText: "一枚ずつ重ねた盾が、仲間全員を覆う切れ目のない線になる。",
    rules: [
      {
        id: "tower_shield_line_mark_rule", listenTo: "barrier_gained", timing: "after", priority: 86,
        predicates: [SELF_IS_SOURCE], costs: [],
        effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "tower_shield_line_status", stacks: 1 }],
        allowRepeatInChain: true,
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      },
      ...[1].map((stacks) => ({
        id: "tower_shield_line_damage_" + stacks + "_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 44,
        predicates: [EVENT_TARGET_HAS_LINE, {
          type: "has_status", subject: "event_primary_target", statusId: "tower_shield_line_status", op: "eq", value: stacks,
        }], costs: [],
        effects: [{ type: "modify_pending_amount", operation: "decrease", amount: percentOfEvent(15 * stacks) }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      })),
    ],
    tags: ["passive", "guard", "tower_shield", "playable"],
  }),
  tower_shield_take_role: Object.freeze({
    id: "tower_shield_take_role", displayName: "引き受け役", weaponId: "tower_shield", treePosition: "B1",
    displayEffect: "誘引を消費するたび守勢1。1につき被ダメージ-10%、最大3。",
    flavorText: "受けるほど、足は地に沈む。",
    rules: [
      {
        id: "tower_shield_take_role_mark_rule", listenTo: "status_removed", timing: "after", priority: 83,
        predicates: [SELF_IS_TARGET, EFFECT_EVENT, { type: "event_value", key: "statusId", op: "eq", value: "taunted" }],
        costs: [], effects: [{ type: "add_status", target: SELF, statusId: "tower_shield_guard_stance", stacks: 1 }],
        limit: CHAIN_ONCE,
      },
      ...[1, 2, 3].map((stacks) => ({
        id: "tower_shield_take_role_damage_" + stacks + "_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 43,
        predicates: [SELF_IS_TARGET, exactStatus("tower_shield_guard_stance", stacks)], costs: [],
        effects: [{ type: "modify_pending_amount", operation: "decrease", amount: percentOfEvent(10 * stacks) }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      })),
    ],
    tags: ["passive", "guard", "tower_shield", "playable"],
  }),
  tower_shield_spread_guard: Object.freeze({
    id: "tower_shield_spread_guard", displayName: "守り分け", weaponId: "tower_shield", treePosition: "BA1",
    displayEffect: "自分の防壁が止めたダメージの50%を、防壁の最も少ない味方へ与える。",
    flavorText: "受け止めた力を、隣へ回す。",
    rules: [{
      id: "tower_shield_spread_guard_rule", listenTo: "damage_taken", timing: "after", priority: 88,
      predicates: [SELF_IS_TARGET, NOT_COST_DAMAGE, eventValueAtLeast("barrierAbsorbed", 1)], costs: [],
      effects: [{
        type: "gain_barrier", target: LOWEST_BARRIER_OTHER_ALLY,
        amount: percentOfEvent(50, "barrierAbsorbed"), duration: "round",
      }],
      allowRepeatInChain: true,
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "support", "tower_shield", "playable"],
  }),
  tower_shield_mirror_film: Object.freeze({
    id: "tower_shield_mirror_film", displayName: "反転膜", weaponId: "tower_shield", treePosition: "BB1",
    displayEffect: "誘引を消費するたび鏡1。鏡1につき被ダメージ-8%、最大3。「鏡城」中は無効。",
    flavorText: "受けた圧を、鏡の裏へ逃がす。",
    rules: [
      {
        id: "tower_shield_mirror_film_mark_rule", listenTo: "status_removed", timing: "after", priority: 84,
        predicates: [SELF_IS_TARGET, EFFECT_EVENT, { type: "event_value", key: "statusId", op: "eq", value: "taunted" }],
        costs: [], effects: [{ type: "add_status", target: SELF, statusId: "tower_shield_mirror", stacks: 1 }],
        limit: CHAIN_ONCE,
      },
      ...[1, 2, 3].map((stacks) => ({
        id: "tower_shield_mirror_film_damage_" + stacks + "_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 37,
        predicates: [SELF_IS_TARGET, exactStatus("tower_shield_mirror", stacks), {
          type: "has_status", subject: "self", statusId: "tower_shield_castle", op: "eq", value: 0,
        }], costs: [],
        effects: [{ type: "modify_pending_amount", operation: "decrease", amount: percentOfEvent(8 * stacks) }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
      })),
    ],
    tags: ["passive", "guard", "tower_shield", "playable"],
  }),
};

const REACTIVE = {
  tower_shield_interpose: Object.freeze({
    id: "tower_shield_interpose", displayName: "盾を差す", weaponId: "tower_shield", treePosition: "B2",
    displayEffect: "味方が単体攻撃に狙われた時、RP1で位置を交換して攻撃を引き受ける。",
    flavorText: "間に合うなら、迷う理由はない。",
    rules: [{
      id: "tower_shield_interpose_rule", listenTo: "target_selected", timing: "interrupt", priority: 52,
      predicates: [
        { type: "target_exists", query: OTHER_ALLY_EVENT_TARGET },
        ENEMY_EVENT_SOURCE,
        ATTACK_EVENT,
        { type: "event_value", key: "targetCount", op: "eq", value: 1 },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [
        { type: "swap_positions", target: { scope: "event_targets", take: 1 }, otherTarget: SELF },
        { type: "redirect_pending_target", target: SELF },
      ],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "guard", "tower_shield", "playable"],
  }),
  tower_shield_relief_voice: Object.freeze({
    id: "tower_shield_relief_voice", displayName: "安堵の声", weaponId: "tower_shield", treePosition: "BA2",
    displayEffect: "防壁がダメージを止めた時、RP1でHP割合最低の味方を止めた量だけ回復。",
    flavorText: "盾の向こうから届く一言が、傷ついた仲間の足をもう一度立たせる。",
    rules: [{
      id: "tower_shield_relief_voice_rule", listenTo: "damage_taken", timing: "after", priority: 54,
      predicates: [SELF_IS_TARGET, NOT_COST_DAMAGE, eventValueAtLeast("barrierAbsorbed", 1)],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "heal", target: LOWEST_HP_ALLY, amount: percentOfEvent(100, "barrierAbsorbed") }],
      limit: CHAIN_ONCE,
    }],
    tags: ["reaction", "support", "tower_shield", "playable"],
  }),
  tower_shield_turn_back: Object.freeze({
    id: "tower_shield_turn_back", displayName: "裏返す", weaponId: "tower_shield", treePosition: "BB2",
    displayEffect: "自分がダメージを受ける時、RP2と鏡1で無効化し、同量を回復する。",
    flavorText: "鏡に沈めた痛みを裏返し、傷になる前の力を命へ戻していく。",
    rules: [1, 2, 3].map((stacks) => ({
      id: "tower_shield_turn_back_" + stacks + "_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 25,
      predicates: [SELF_IS_TARGET, exactStatus("tower_shield_mirror", stacks), ATTACK_EVENT],
      costs: [{ type: "spend_reaction_points", amount: 2 }],
      effects: [
        { type: "modify_pending_amount", operation: "set", amount: { type: "constant", value: 0 } },
        { type: "heal", target: SELF, amount: percentOfEvent(100) },
        { type: "remove_status", target: SELF, statusId: "tower_shield_mirror", stacks: 1 },
      ],
      limit: CHAIN_ONCE,
    })),
    tags: ["reaction", "guard", "tower_shield", "playable"],
  }),
};

const TARGET = {};

export const TOWER_SHIELD_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const TOWER_SHIELD_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const TOWER_SHIELD_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const TOWER_SHIELD_TARGET_SKILLS = Object.freeze(TARGET);

export const TOWER_SHIELD_TREE = Object.freeze([
  ["R", "active", "tower_shield_draw_guard", []],
  ["A1", "passive", "tower_shield_thick_plate", ["tower_shield_draw_guard"]],
  ["A2", "passive", "tower_shield_visible", ["tower_shield_thick_plate"]],
  ["A3", "active", "tower_shield_hold_fast", ["tower_shield_visible"]],
  ["AA1", "passive", "tower_shield_shock_absorption", ["tower_shield_hold_fast"]],
  ["AA2", "passive", "tower_shield_wall_frame", ["tower_shield_shock_absorption"]],
  ["AA3", "active", "tower_shield_gate", ["tower_shield_wall_frame"]],
  ["AB1", "passive", "tower_shield_side_plate", ["tower_shield_hold_fast"]],
  ["AB2", "passive", "tower_shield_line", ["tower_shield_side_plate"]],
  ["AB3", "active", "tower_shield_line_guard", ["tower_shield_line"]],
  ["B1", "passive", "tower_shield_take_role", ["tower_shield_draw_guard"]],
  ["B2", "reactive", "tower_shield_interpose", ["tower_shield_take_role"]],
  ["B3", "active", "tower_shield_bash", ["tower_shield_interpose"]],
  ["BA1", "passive", "tower_shield_spread_guard", ["tower_shield_bash"]],
  ["BA2", "reactive", "tower_shield_relief_voice", ["tower_shield_spread_guard"]],
  ["BA3", "active", "tower_shield_sanctuary", ["tower_shield_relief_voice"]],
  ["BB1", "passive", "tower_shield_mirror_film", ["tower_shield_bash"]],
  ["BB2", "reactive", "tower_shield_turn_back", ["tower_shield_mirror_film"]],
  ["BB3", "active", "tower_shield_mirror_castle", ["tower_shield_turn_back"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "tower_shield", position, kind, skillId, requires: Object.freeze(requires),
})));
