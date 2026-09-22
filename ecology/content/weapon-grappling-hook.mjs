// R27 — 鉤縄19節。
//
// engine の位置語彙は「空いた行へ移す」と「同じ側を交換する」までを
// 持つ。鉤縄はその共有 event（actor_moved）を印・追撃・防壁へ渡し、
// タイル座標そのものを保存しない。全入れ替えや起点印は、現在の2×3盤面
// で再現可能な行移動／移動者印として明示的に近似している。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ONE_EVENT_TARGET = Object.freeze({ scope: "event_targets", take: 1 });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});
const OTHER_ALLY = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }, { type: "not_self" }],
  sort: ["position_desc"], take: 1,
});
const RESCUE_TARGET = Object.freeze({
  scope: "allies",
  filters: [{ type: "alive" }, { type: "row_is", row: "front" }, { type: "hp_percent", op: "lte", value: 35 }],
  sort: ["hp_percent_asc"], take: 1,
});
const EVENT_SOURCE_ALLY = Object.freeze({
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "is_event_source" }], take: 1 },
});
const EVENT_SOURCE_ENEMY = Object.freeze({
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_source" }], take: 1 },
});
const EVENT_SOURCE_OTHER_ALLY = Object.freeze({
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "is_event_source" }, { type: "not_self" }], take: 1 },
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const EVENT_TARGET_IS_ENEMY = Object.freeze({
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const LONG_EVENT = Object.freeze({ type: "event_tag", tag: "long", value: true });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});

function hookAttack(id, displayName, coefficientBps, displayEffect, flavorText, options = {}) {
  return Object.freeze({
    id, displayName, displayEffect, flavorText,
    weaponId: "grappling_hook", treePosition: options.treePosition,
    ...(options.replacesActiveSkillId ? { replacesActiveSkillId: options.replacesActiveSkillId } : {}),
    apCost: 1, actionMode: options.actionMode ?? "offense", intrinsicPredicates: options.intrinsicPredicates ?? [],
    targetQuery: options.targetQuery ?? ENEMY,
    effects: [
      ...(options.beforeEffects ?? []),
      {
        type: "deal_damage", target: EVENT_TARGETS,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps },
        rangeClass: "long", tags: ["attack", "weapon", "grappling_hook", "long"],
      },
      ...(options.afterEffects ?? []),
    ],
    tags: ["attack", "weapon", "grappling_hook", "long", "playable"],
  });
}

const ACTIVE = {
  grappling_hook_pull: Object.freeze({
    id: "grappling_hook_pull", displayName: "引き打ち",
    displayEffect: "敵1体に技術80%のダメージを与え、敵前列の空きへ引く。",
    flavorText: "届かないなら、届く場所へ引けばいい。",
    weaponId: "grappling_hook", treePosition: "R", apCost: 1, actionMode: "offense",
    intrinsicPredicates: [], targetQuery: ENEMY,
    effects: [
      { type: "deal_damage", target: EVENT_TARGETS, amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 8_000 }, rangeClass: "long", tags: ["attack", "weapon", "grappling_hook", "long"] },
      { type: "move_to_open_row", target: ONE_EVENT_TARGET, row: "front" },
    ],
    tags: ["attack", "weapon", "grappling_hook", "long", "playable"],
  }),
  grappling_hook_strong_pull: hookAttack(
    "grappling_hook_strong_pull", "強引き", 13_000,
    "敵1体に技術130%のダメージを与え、前列の空きへ引く。",
    "縄が軋む音の方が、敵の足音より早い。",
    { treePosition: "A3", replacesActiveSkillId: "grappling_hook_pull", afterEffects: [{ type: "move_to_open_row", target: ONE_EVENT_TARGET, row: "front" }] },
  ),
  grappling_hook_capture: hookAttack(
    "grappling_hook_capture", "捕縛", 19_000,
    "敵1体に技術190%のダメージを与え、敵後列の空きへ移す。",
    "引き寄せるだけでは足りない。逃げる先まで縄で決める。",
    { treePosition: "AA3", replacesActiveSkillId: "grappling_hook_strong_pull", afterEffects: [{ type: "move_to_open_row", target: ONE_EVENT_TARGET, row: "rear" }] },
  ),
  grappling_hook_throw_lasso: hookAttack(
    "grappling_hook_throw_lasso", "投げ縄", 10_000,
    "敵1体に技術100%のダメージを与え、前列へ投げて隙1。",
    "足元を取れば、相手の一歩は味方の一手へ変わる。",
    { treePosition: "B3", replacesActiveSkillId: "grappling_hook_pull", afterEffects: [
      { type: "move_to_open_row", target: ONE_EVENT_TARGET, row: "front" },
      { type: "add_status", target: ONE_EVENT_TARGET, statusId: "exposed", stacks: 1 },
    ] },
  ),
  grappling_hook_rescue: Object.freeze({
    id: "grappling_hook_rescue", displayName: "救出",
    displayEffect: "HP35%以下の前列味方を後列の空きへ移し、防壁50を作る。対象がなければ最も傷ついた味方へ防壁50。",
    flavorText: "引く先は敵だけではない。戻れる場所も縄で作る。",
    weaponId: "grappling_hook", treePosition: "AB3", replacesActiveSkillId: "grappling_hook_pull",
    apCost: 1, actionMode: "channel",
    intrinsicPredicates: [{ type: "target_exists", query: RESCUE_TARGET }], targetQuery: RESCUE_TARGET,
    effects: [
      { type: "move_to_open_row", target: ONE_EVENT_TARGET, row: "front" },
      { type: "gain_barrier", target: EVENT_TARGETS, amount: { type: "constant", value: 50 }, duration: "round", tags: ["support", "grappling_hook", "rescue"] },
    ],
    tags: ["support", "weapon", "grappling_hook", "playable"],
  }),
  grappling_hook_net_field: hookAttack(
    "grappling_hook_net_field", "網場", 12_000,
    "敵1体に技術120%のダメージを与え、縄印を置いて前列へ落とす。",
    "地面に残った印が、次の引き先を決める。",
    { treePosition: "BA3", replacesActiveSkillId: "grappling_hook_throw_lasso", afterEffects: [
      { type: "move_to_open_row", target: ONE_EVENT_TARGET, row: "front" },
      { type: "add_status", target: ONE_EVENT_TARGET, statusId: "grappling_hook_mark", stacks: 1 },
    ] },
  ),
  grappling_hook_total_swap: Object.freeze({
    id: "grappling_hook_total_swap", displayName: "総入れ替え",
    displayEffect: "自分と別の味方の前後を交換し、移動した味方に防壁20を作る。戦闘1回。",
    flavorText: "隊列を一人ずつ直すのではなく、二人の帰る場所を同時に交換する。",
    weaponId: "grappling_hook", treePosition: "BB3", replacesActiveSkillId: "grappling_hook_throw_lasso",
    usesPerBattle: 1, apCost: 1, actionMode: "channel", intrinsicPredicates: [{ type: "target_exists", query: OTHER_ALLY }], targetQuery: OTHER_ALLY,
    effects: [
      { type: "swap_positions", target: SELF, otherTarget: ONE_EVENT_TARGET },
      { type: "gain_barrier", target: EVENT_TARGETS, amount: { type: "constant", value: 20 }, duration: "round", tags: ["support", "grappling_hook", "swap"] },
    ],
    tags: ["support", "weapon", "grappling_hook", "playable"],
  }),
};

function damagePassive(id, displayName, percent, treePosition, displayEffect, flavorText, predicates = []) {
  return Object.freeze({
    id, displayName, weaponId: "grappling_hook", treePosition, displayEffect, flavorText,
    rules: [{
      id: id + "_rule", listenTo: "damage_proposed", timing: "interrupt", priority: 42,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, LONG_EVENT, ...predicates], costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(percent) }],
      allowRepeatInChain: true, limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "attack", "grappling_hook", "playable"],
  });
}

const PASSIVE = {
  grappling_hook_iron_hook: damagePassive(
    "grappling_hook_iron_hook", "鉄鉤", 15, "A1", "鉤縄の強制移動攻撃ダメージ+15%。", "鉄の鉤は、引く前から傷を深くする。",
  ),
  grappling_hook_long_rope: Object.freeze({
    id: "grappling_hook_long_rope", displayName: "長縄", weaponId: "grappling_hook", treePosition: "A2",
    displayEffect: "鉤縄を使うたび、長縄の固定印を自分へ残す。", flavorText: "遠くへ届く縄は、引き終わった後も手元に残る。",
    rules: [{
      id: "grappling_hook_long_rope_rule", listenTo: "action_started", timing: "after", priority: 70,
      predicates: [SELF_IS_SOURCE, { type: "event_tag", tag: "grappling_hook", value: true }], costs: [],
      effects: [{ type: "add_status", target: SELF, statusId: "grappling_hook_anchor", stacks: 1 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "utility", "grappling_hook", "playable"],
  }),
  grappling_hook_winch: damagePassive(
    "grappling_hook_winch", "巻き上げ", 20, "AA1", "鉤縄の強制移動攻撃ダメージがさらに+20%。", "巻き上げる手に、もう一段の力を込める。",
  ),
  grappling_hook_wall_strike: damagePassive(
    "grappling_hook_wall_strike", "壁打ち", 50, "AA2", "縄印のある敵への鉤縄攻撃ダメージ+50%。", "逃げ場が印で塞がれていれば、壁そのものへ叩きつける。",
    [{ type: "target_exists", query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }, { type: "has_status", statusId: "grappling_hook_mark", op: "gte", value: 1 }], take: 1 } }],
  ),
  grappling_hook_raise: Object.freeze({
    id: "grappling_hook_raise", displayName: "引き上げ", weaponId: "grappling_hook", treePosition: "AB2",
    displayEffect: "鉤縄で味方を移動させると、その味方に防壁30。", flavorText: "引き上げた身体に、もう一度立てる厚みを添える。",
    rules: [{
      id: "grappling_hook_raise_rule", listenTo: "actor_moved", timing: "after", priority: 74,
      predicates: [EVENT_SOURCE_ALLY], costs: [],
      effects: [{ type: "gain_barrier", target: { scope: "event_source", take: 1 }, amount: { type: "constant", value: 30 }, duration: "round", tags: ["support", "grappling_hook", "raise"] }], limit: CHAIN_ONCE,
    }], tags: ["passive", "support", "grappling_hook", "playable"],
  }),
  grappling_hook_break_step: Object.freeze({
    id: "grappling_hook_break_step", displayName: "崩し足", weaponId: "grappling_hook", treePosition: "B1",
    displayEffect: "敵を1マス相当以上動かすと、敵に隙1。", flavorText: "足の下から道を抜けば、次の攻撃は深く入る。",
    rules: [{
      id: "grappling_hook_break_step_rule", listenTo: "actor_moved", timing: "after", priority: 73,
      predicates: [EVENT_SOURCE_ENEMY], costs: [],
      effects: [{ type: "add_status", target: { scope: "event_source", take: 1 }, statusId: "exposed", stacks: 1 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "attack", "grappling_hook", "playable"],
  }),
  grappling_hook_run_signal: Object.freeze({
    id: "grappling_hook_run_signal", displayName: "走れの合図", weaponId: "grappling_hook", treePosition: "B2",
    displayEffect: "味方が移動すると、その味方の次の攻撃ダメージ+25%。", flavorText: "動いたなら、次の一歩まで止まらない。",
    rules: [{
      id: "grappling_hook_run_signal_rule", listenTo: "actor_moved", timing: "after", priority: 72,
      predicates: [EVENT_SOURCE_ALLY], costs: [],
      effects: [{ type: "add_status", target: { scope: "event_source", take: 1 }, statusId: "grappling_hook_rush", stacks: 1 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "attack", "grappling_hook", "playable"],
  }),
  grappling_hook_movement_marks: Object.freeze({
    id: "grappling_hook_movement_marks", displayName: "動いた印", weaponId: "grappling_hook", treePosition: "BA1",
    displayEffect: "強制移動した対象に、ラウンド中の縄印を残す。", flavorText: "足跡を残せば、次に引く場所が読める。",
    rules: [{
      id: "grappling_hook_movement_marks_rule", listenTo: "actor_moved", timing: "after", priority: 71,
      predicates: [{ type: "event_tag", tag: "move", value: true }], costs: [],
      effects: [{ type: "add_status", target: { scope: "event_targets", take: 1 }, statusId: "grappling_hook_mark", stacks: 1 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "utility", "grappling_hook", "playable"],
  }),
  grappling_hook_two_point_anchor: Object.freeze({
    id: "grappling_hook_two_point_anchor", displayName: "二点固定", weaponId: "grappling_hook", treePosition: "BB1",
    displayEffect: "各ラウンド最初の移動記録2つに、味方なら防壁15、敵なら隙1を付ける。",
    flavorText: "始点と終点を二つだけ固定し、動いた結果を残す。",
    rules: [
      {
        id: "grappling_hook_two_point_anchor_ally_rule", listenTo: "actor_moved", timing: "after", priority: 70,
        predicates: [EVENT_SOURCE_ALLY], costs: [],
        effects: [{ type: "gain_barrier", target: { scope: "event_source", take: 1 }, amount: { type: "constant", value: 15 }, duration: "round", tags: ["support", "grappling_hook", "anchor"] }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 2 },
      },
      {
        id: "grappling_hook_two_point_anchor_enemy_rule", listenTo: "actor_moved", timing: "after", priority: 69,
        predicates: [EVENT_SOURCE_ENEMY], costs: [],
        effects: [{ type: "add_status", target: { scope: "event_source", take: 1 }, statusId: "exposed", stacks: 1 }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 2 },
      },
    ], tags: ["passive", "support", "grappling_hook", "playable"],
  }),
};

const REACTIVE = {
  grappling_hook_mark_step: Object.freeze({
    id: "grappling_hook_mark_step", displayName: "印を踏む", weaponId: "grappling_hook", treePosition: "BA2",
    displayEffect: "縄印を持つ対象が移動した時、RP1で敵に隙2、味方に集中1を付けて印を消費する。",
    flavorText: "印を踏んだ瞬間を、次の一手の合図にする。",
    rules: [
      {
        id: "grappling_hook_mark_step_enemy_rule", listenTo: "actor_moved", timing: "after", priority: 90,
        predicates: [EVENT_SOURCE_ENEMY, { type: "has_status", subject: "event_source", statusId: "grappling_hook_mark", op: "gte", value: 1 }],
        costs: [{ type: "spend_reaction_points", amount: 1 }],
        effects: [
          { type: "add_status", target: { scope: "event_source", take: 1 }, statusId: "exposed", stacks: 2 },
          { type: "remove_status", target: { scope: "event_source", take: 1 }, statusId: "grappling_hook_mark", stacks: "all" },
        ], limit: CHAIN_ONCE,
      },
      {
        id: "grappling_hook_mark_step_ally_rule", listenTo: "actor_moved", timing: "after", priority: 89,
        predicates: [EVENT_SOURCE_ALLY, { type: "has_status", subject: "event_source", statusId: "grappling_hook_mark", op: "gte", value: 1 }],
        costs: [{ type: "spend_reaction_points", amount: 1 }],
        effects: [
          { type: "add_status", target: { scope: "event_source", take: 1 }, statusId: "focused", stacks: 1 },
          { type: "remove_status", target: { scope: "event_source", take: 1 }, statusId: "grappling_hook_mark", stacks: "all" },
        ], limit: CHAIN_ONCE,
      },
    ], tags: ["reaction", "utility", "grappling_hook", "playable"],
  }),
  grappling_hook_rope_return: Object.freeze({
    id: "grappling_hook_rope_return", displayName: "縄返し", weaponId: "grappling_hook", treePosition: "BB2",
    displayEffect: "敵が移動した時、RP2でその敵を後列の空きへ戻し、対象を再評価する。",
    flavorText: "引かれた結果さえ、もう一度こちらの縄へ返す。",
    rules: [{
      id: "grappling_hook_rope_return_rule", listenTo: "actor_moved", timing: "after", priority: 88,
      predicates: [EVENT_SOURCE_ENEMY], costs: [{ type: "spend_reaction_points", amount: 2 }],
      effects: [
        { type: "move_to_open_row", target: { scope: "event_source", take: 1 }, row: "rear" },
        { type: "add_status", target: { scope: "event_source", take: 1 }, statusId: "grappling_hook_anchor", stacks: 1 },
      ], limit: CHAIN_ONCE,
    }], tags: ["reaction", "utility", "grappling_hook", "playable"],
  }),
};

const TARGET = {
  grappling_hook_rescue_line: Object.freeze({
    id: "grappling_hook_rescue_line", displayName: "救助索", weaponId: "grappling_hook", treePosition: "AB1",
    displayEffect: "HP35%以下の前列味方を優先対象にする。", flavorText: "助ける相手を先に見つければ、縄は迷わない。",
    targetQuery: RESCUE_TARGET, tags: ["target", "support", "grappling_hook", "playable"],
  }),
};

export const GRAPPLING_HOOK_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const GRAPPLING_HOOK_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const GRAPPLING_HOOK_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const GRAPPLING_HOOK_TARGET_SKILLS = Object.freeze(TARGET);

export const GRAPPLING_HOOK_TREE = Object.freeze([
  ["R", "active", "grappling_hook_pull", []],
  ["A1", "passive", "grappling_hook_iron_hook", ["grappling_hook_pull"]],
  ["A2", "passive", "grappling_hook_long_rope", ["grappling_hook_iron_hook"]],
  ["A3", "active", "grappling_hook_strong_pull", ["grappling_hook_long_rope"]],
  ["AA1", "passive", "grappling_hook_winch", ["grappling_hook_strong_pull"]],
  ["AA2", "passive", "grappling_hook_wall_strike", ["grappling_hook_winch"]],
  ["AA3", "active", "grappling_hook_capture", ["grappling_hook_wall_strike"]],
  ["AB1", "target", "grappling_hook_rescue_line", ["grappling_hook_strong_pull"]],
  ["AB2", "passive", "grappling_hook_raise", ["grappling_hook_rescue_line"]],
  ["AB3", "active", "grappling_hook_rescue", ["grappling_hook_raise"]],
  ["B1", "passive", "grappling_hook_break_step", ["grappling_hook_pull"]],
  ["B2", "passive", "grappling_hook_run_signal", ["grappling_hook_break_step"]],
  ["B3", "active", "grappling_hook_throw_lasso", ["grappling_hook_run_signal"]],
  ["BA1", "passive", "grappling_hook_movement_marks", ["grappling_hook_throw_lasso"]],
  ["BA2", "reactive", "grappling_hook_mark_step", ["grappling_hook_movement_marks"]],
  ["BA3", "active", "grappling_hook_net_field", ["grappling_hook_mark_step"]],
  ["BB1", "passive", "grappling_hook_two_point_anchor", ["grappling_hook_throw_lasso"]],
  ["BB2", "reactive", "grappling_hook_rope_return", ["grappling_hook_two_point_anchor"]],
  ["BB3", "active", "grappling_hook_total_swap", ["grappling_hook_rope_return"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "grappling_hook", position, kind, skillId, requires: Object.freeze(requires),
})));
