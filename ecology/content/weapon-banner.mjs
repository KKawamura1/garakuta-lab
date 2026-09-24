// R27 — 号旗19節。
//
// 号旗は攻撃力を直接配る武器ではなく、AP/RP・準備・次の一手へ
// 「支援した」という共有 event を渡す。時間砂と借り札は有限の記録として
// status に置き、ラウンドを待つだけで資源が増えないようにする。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ONE_EVENT_TARGET = Object.freeze({ scope: "event_targets", take: 1 });
const OTHER_ALLY = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }, { type: "not_self" }], sort: ["position_desc"], take: 1,
});
const OTHER_ALLIES = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }, { type: "not_self" }], sort: ["position_asc"], take: "all",
});
const REAR_ALLIES = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }, { type: "not_self" }, { type: "row_is", row: "rear" }], sort: ["position_asc"], take: "all",
});
const PREPARING_ALLY = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }, { type: "not_self" }, { type: "is_preparing", value: true }], sort: ["position_asc"], take: 1,
});
const LIVING_ENEMIES = Object.freeze({ scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_percent_asc"], take: 1 });
const EVENT_TARGET_IS_ALLY = Object.freeze({
  type: "target_exists", query: { scope: "allies", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const EVENT_SOURCE_OTHER_ALLY = Object.freeze({
  type: "target_exists", query: { scope: "allies", filters: [{ type: "is_event_source" }, { type: "not_self" }], take: 1 },
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const SUPPORT_EVENT = Object.freeze({ type: "event_tag", tag: "support", value: true });
const AP_EVENT = Object.freeze({ type: "event_value", key: "resource", op: "eq", value: "action_points" });
const RP_EVENT = Object.freeze({ type: "event_value", key: "resource", op: "eq", value: "reaction_points" });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });

const commandEffect = (target = EVENT_TARGETS, stacks = 1) => ({
  type: "add_status", target, statusId: "banner_commanded", stacks,
});

const ACTIVE = {
  banner_command: Object.freeze({
    id: "banner_command", displayName: "号令",
    displayEffect: "自分以外の味方で位置順が最後の1人にAP1。",
    flavorText: "老兵の一声が、もう一歩を生む。",
    weaponId: "banner", treePosition: "R", apCost: 1, actionMode: "channel",
    intrinsicPredicates: [{ type: "target_exists", query: OTHER_ALLY }], targetQuery: OTHER_ALLY,
    effects: [{ type: "gain_resource", target: EVENT_TARGETS, resource: "action_points", amount: { type: "constant", value: 1 }, tags: ["support", "banner"] }],
    tags: ["support", "tempo", "weapon", "banner", "playable"],
  }),
  banner_advance: Object.freeze({
    id: "banner_advance", displayName: "進め",
    displayEffect: "味方1人にAP1と、次の攻撃+10%。支援の声が通れば合計+25%。",
    flavorText: "旗を上げる。今いる場所から、次の一歩だけ前へ。",
    weaponId: "banner", treePosition: "A3", replacesActiveSkillId: "banner_command", apCost: 1, actionMode: "channel",
    intrinsicPredicates: [{ type: "target_exists", query: OTHER_ALLY }], targetQuery: OTHER_ALLY,
    effects: [
      { type: "gain_resource", target: EVENT_TARGETS, resource: "action_points", amount: { type: "constant", value: 1 }, tags: ["support", "banner"] },
      commandEffect(),
    ], tags: ["support", "tempo", "weapon", "banner", "playable"],
  }),
  banner_total_assault: Object.freeze({
    id: "banner_total_assault", displayName: "総進撃",
    displayEffect: "自分以外の味方全員にAP1と、次の2行動を強める号旗の鼓舞2。",
    flavorText: "一人の足を押す声を、隊全体の進撃へ広げる。",
    weaponId: "banner", treePosition: "AA3", replacesActiveSkillId: "banner_advance", apCost: 1, actionMode: "channel",
    intrinsicPredicates: [{ type: "target_exists", query: OTHER_ALLIES }], targetQuery: OTHER_ALLIES,
    effects: [
      { type: "gain_resource", target: EVENT_TARGETS, resource: "action_points", amount: { type: "constant", value: 1 }, tags: ["support", "banner", "grand"] },
      commandEffect(EVENT_TARGETS, 2),
    ], tags: ["support", "tempo", "weapon", "banner", "playable"],
  }),
  banner_line_advance: Object.freeze({
    id: "banner_line_advance", displayName: "列進",
    displayEffect: "後列の味方全員へAP1と次の攻撃+15%。前列へ揃い足を置く。",
    flavorText: "列を一つ前へ揃えれば、支援の声が届く距離も揃う。",
    weaponId: "banner", treePosition: "AB3", replacesActiveSkillId: "banner_advance", apCost: 1, actionMode: "channel",
    intrinsicPredicates: [{ type: "target_exists", query: REAR_ALLIES }], targetQuery: REAR_ALLIES,
    effects: [
      { type: "gain_resource", target: EVENT_TARGETS, resource: "action_points", amount: { type: "constant", value: 1 }, tags: ["support", "banner", "line"] },
      commandEffect(EVENT_TARGETS, 1),
      { type: "add_status", target: EVENT_TARGETS, statusId: "banner_line_step", stacks: 1 },
    ], tags: ["support", "tempo", "weapon", "banner", "playable"],
  }),
  banner_hurry: Object.freeze({
    id: "banner_hurry", displayName: "急かす",
    displayEffect: "味方1人の準備を1段進め、AP1と次の攻撃+10%。",
    flavorText: "待つ時間を、待てという命令で終わらせる。",
    weaponId: "banner", treePosition: "B3", replacesActiveSkillId: "banner_command", apCost: 1, actionMode: "channel",
    intrinsicPredicates: [{ type: "target_exists", query: OTHER_ALLY }], targetQuery: OTHER_ALLY,
    effects: [
      { type: "advance_preparation", target: ONE_EVENT_TARGET, amount: { type: "constant", value: 1 } },
      { type: "gain_resource", target: EVENT_TARGETS, resource: "action_points", amount: { type: "constant", value: 1 }, tags: ["support", "banner", "hurry"] },
      commandEffect(),
    ], tags: ["support", "tempo", "weapon", "banner", "playable"],
  }),
  banner_borrowed_command: Object.freeze({
    id: "banner_borrowed_command", displayName: "前借り命令",
    displayEffect: "味方1人にAP3と号旗の鼓舞2を渡し、借り札3を残す。",
    flavorText: "今の三歩を借りるなら、返す場所まで旗に書く。",
    weaponId: "banner", treePosition: "BA3", replacesActiveSkillId: "banner_hurry", apCost: 1, actionMode: "channel",
    intrinsicPredicates: [{ type: "target_exists", query: OTHER_ALLY }], targetQuery: OTHER_ALLY,
    effects: [
      { type: "gain_resource", target: EVENT_TARGETS, resource: "action_points", amount: { type: "constant", value: 3 }, tags: ["support", "banner", "borrow"] },
      commandEffect(EVENT_TARGETS, 2),
      { type: "add_status", target: EVENT_TARGETS, statusId: "banner_debt", stacks: 3 },
    ], tags: ["support", "tempo", "weapon", "banner", "playable"],
  }),
  banner_last_command: Object.freeze({
    id: "banner_last_command", displayName: "最後の号令",
    displayEffect: "戦闘1回。自分以外の味方全員にAP1と号旗の鼓舞2。",
    flavorText: "最後の一拍だけは、全員のために同じ方向へ倒す。",
    weaponId: "banner", treePosition: "BB3", replacesActiveSkillId: "banner_borrowed_command", usesPerBattle: 1,
    apCost: 1, actionMode: "channel", intrinsicPredicates: [{ type: "target_exists", query: LIVING_ENEMIES }], targetQuery: OTHER_ALLIES,
    effects: [
      { type: "gain_resource", target: EVENT_TARGETS, resource: "action_points", amount: { type: "constant", value: 1 }, tags: ["support", "banner", "last"] },
      commandEffect(EVENT_TARGETS, 2),
    ], tags: ["support", "tempo", "weapon", "banner", "playable"],
  }),
};

const PASSIVE = {
  banner_clear_voice: Object.freeze({
    id: "banner_clear_voice", displayName: "声を通す", weaponId: "banner", treePosition: "A1",
    displayEffect: "号旗のAP支援を受けた味方の次の攻撃+15%。", flavorText: "声が通れば、支援はただの数字で終わらない。",
    rules: [{
      id: "banner_clear_voice_rule", listenTo: "resource_gained", timing: "after", priority: 78,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, AP_EVENT, EVENT_TARGET_IS_ALLY], costs: [],
      effects: [commandEffect()], limit: CHAIN_ONCE,
    }], tags: ["passive", "support", "banner", "playable"],
  }),
  banner_great_command: Object.freeze({
    id: "banner_great_command", displayName: "大号令", weaponId: "banner", treePosition: "AA1",
    displayEffect: "AP支援を受けた味方への号旗の鼓舞をさらに1段付ける。", flavorText: "一度届いた声を、もう一度だけ太くする。",
    rules: [{
      id: "banner_great_command_rule", listenTo: "resource_gained", timing: "after", priority: 77,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, AP_EVENT, EVENT_TARGET_IS_ALLY], costs: [],
      effects: [commandEffect(ONE_EVENT_TARGET, 1)], limit: CHAIN_ONCE,
    }], tags: ["passive", "support", "banner", "playable"],
  }),
  banner_line_delivery: Object.freeze({
    id: "banner_line_delivery", displayName: "列へ届ける", weaponId: "banner", treePosition: "AB1",
    displayEffect: "味方1人への号旗の肯定的な支援を、その味方へもう一度届ける。",
    flavorText: "列の端へ届いた声を、同じ列の足元へ返す。",
    rules: [{
      id: "banner_line_delivery_rule", listenTo: "status_added", timing: "after", priority: 76,
      predicates: [SELF_IS_SOURCE, { type: "event_tag", tag: "positive", value: true }, { type: "event_value", key: "statusId", op: "eq", value: "banner_commanded" }], costs: [],
      effects: [commandEffect(ONE_EVENT_TARGET, 1)], limit: CHAIN_ONCE,
    }], tags: ["passive", "support", "banner", "playable"],
  }),
  banner_synced_steps: Object.freeze({
    id: "banner_synced_steps", displayName: "揃い足", weaponId: "banner", treePosition: "AB2",
    displayEffect: "後列味方を支援した時、次の主行動まで前列へ揃い足を記録する。",
    flavorText: "足を揃えれば、同じ声を同じ距離で聞ける。",
    rules: [{
      id: "banner_synced_steps_rule", listenTo: "target_selected", timing: "after", priority: 75,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, EVENT_TARGET_IS_ALLY], costs: [],
      effects: [{ type: "add_status", target: ONE_EVENT_TARGET, statusId: "banner_line_step", stacks: 1 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "support", "banner", "playable"],
  }),
  banner_debt_token: Object.freeze({
    id: "banner_debt_token", displayName: "借り札", weaponId: "banner", treePosition: "BA1",
    displayEffect: "自分以外の味方へ与えたAP1ごとに、その味方へ借り札を1段残す。",
    flavorText: "借りた一拍は、忘れないよう札にして持たせる。",
    rules: [{
      id: "banner_debt_token_rule", listenTo: "resource_gained", timing: "after", priority: 74,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, AP_EVENT, EVENT_TARGET_IS_ALLY], costs: [],
      effects: [{ type: "add_status", target: ONE_EVENT_TARGET, statusId: "banner_debt", stacks: 1 }], limit: CHAIN_ONCE,
    }], tags: ["passive", "support", "banner", "playable"],
  }),
  banner_hourglass: Object.freeze({
    id: "banner_hourglass", displayName: "砂時計", weaponId: "banner", treePosition: "BB1",
    displayEffect: "味方へAP/RPを与えるたび、時間砂を1段蓄える（最大5）。",
    flavorText: "配った一拍を、最後に買い戻すための砂へ変える。",
    rules: [{
      id: "banner_hourglass_rule", listenTo: "resource_gained", timing: "after", priority: 73,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, EVENT_TARGET_IS_ALLY], costs: [],
      effects: [{ type: "add_status", target: SELF, statusId: "banner_time_sand", stacks: 1 }], limit: { owner: "actor-instance + rule", scope: "battle", count: 5 },
    }], tags: ["passive", "support", "banner", "playable"],
  }),
};

const REACTIVE = {
  banner_breathe_together: Object.freeze({
    id: "banner_breathe_together", displayName: "息を合わせる", weaponId: "banner", treePosition: "A2",
    displayEffect: "非攻撃のAP支援後、RP1で対象へ号旗の鼓舞を追加する。",
    flavorText: "一人の声を、受け取った人の呼吸へ合わせる。",
    rules: [{
      id: "banner_breathe_together_rule", listenTo: "resource_gained", timing: "after", priority: 90,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, AP_EVENT, EVENT_TARGET_IS_ALLY], costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [commandEffect()], limit: CHAIN_ONCE,
    }], tags: ["reaction", "support", "banner", "playable"],
  }),
  banner_two_beats: Object.freeze({
    id: "banner_two_beats", displayName: "二拍先", weaponId: "banner", treePosition: "AA2",
    displayEffect: "非攻撃のAP支援時、RP1で対象へ号旗の鼓舞を2段付ける。",
    flavorText: "一拍先ではなく、二拍先の足場まで先に置く。",
    rules: [{
      id: "banner_two_beats_rule", listenTo: "resource_gained", timing: "after", priority: 89,
      predicates: [SELF_IS_SOURCE, SUPPORT_EVENT, AP_EVENT, EVENT_TARGET_IS_ALLY], costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [commandEffect(ONE_EVENT_TARGET, 2)], limit: CHAIN_ONCE,
    }], tags: ["reaction", "support", "banner", "playable"],
  }),
  banner_push_forward: Object.freeze({
    id: "banner_push_forward", displayName: "背を押す", weaponId: "banner", treePosition: "B2",
    displayEffect: "味方の行動開始時、RP1で準備を1段進め、次の攻撃+20%。",
    flavorText: "行動を始めた背中へ、旗の端をもう一度当てる。",
    rules: [{
      id: "banner_push_forward_rule", listenTo: "actor_activated", timing: "after", priority: 88,
      predicates: [EVENT_SOURCE_OTHER_ALLY], costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [
        { type: "advance_preparation", target: { scope: "event_source", take: 1 }, amount: { type: "constant", value: 1 } },
        { type: "add_status", target: { scope: "event_source", take: 1 }, statusId: "banner_commanded", stacks: 1 },
      ], limit: CHAIN_ONCE,
    }], tags: ["reaction", "support", "banner", "playable"],
  }),
  banner_debt_grace: Object.freeze({
    id: "banner_debt_grace", displayName: "返済猶予", weaponId: "banner", treePosition: "BA2",
    displayEffect: "ラウンド開始時、RP2で自分の借り札を1段免除する。",
    flavorText: "返す日を一拍だけ、旗の影へ移す。",
    rules: [{
      id: "banner_debt_grace_rule", listenTo: "round_started", timing: "after", priority: 87,
      predicates: [{ type: "has_status", subject: "self", statusId: "banner_debt", op: "gte", value: 1 }], costs: [{ type: "spend_reaction_points", amount: 2 }],
      effects: [{ type: "remove_status", target: SELF, statusId: "banner_debt", stacks: 1 }], limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
    }], tags: ["reaction", "support", "banner", "playable"],
  }),
  banner_buy_second: Object.freeze({
    id: "banner_buy_second", displayName: "一秒を買う", weaponId: "banner", treePosition: "BB2",
    displayEffect: "時間砂5段の時、RP2で砂をすべて使い、自分にAP1を返す。",
    flavorText: "配った時間を、一秒だけ自分の手へ戻す。",
    rules: [{
      id: "banner_buy_second_rule", listenTo: "round_ended", timing: "after", priority: 86,
      predicates: [{ type: "has_status", subject: "self", statusId: "banner_time_sand", op: "gte", value: 5 }], costs: [{ type: "spend_reaction_points", amount: 2 }],
      effects: [
        { type: "remove_status", target: SELF, statusId: "banner_time_sand", stacks: "all" },
        { type: "gain_resource", target: SELF, resource: "action_points", amount: { type: "constant", value: 1 }, tags: ["support", "banner", "time"] },
      ], limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
    }], tags: ["reaction", "support", "banner", "playable"],
  }),
};

const TARGET = {
  banner_next_target: Object.freeze({
    id: "banner_next_target", displayName: "次は誰だ", weaponId: "banner", treePosition: "B1",
    displayEffect: "準備中の味方を優先し、いなければ位置順の味方を選ぶ。",
    flavorText: "旗を振る前に、次に必要な一人を見つける。",
    targetQuery: PREPARING_ALLY, tags: ["target", "support", "banner", "playable"],
  }),
};

export const BANNER_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const BANNER_PASSIVE_SKILLS = Object.freeze(PASSIVE);
export const BANNER_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const BANNER_TARGET_SKILLS = Object.freeze(TARGET);

export const BANNER_TREE = Object.freeze([
  ["R", "active", "banner_command", []],
  ["A1", "passive", "banner_clear_voice", ["banner_command"]],
  ["A2", "reactive", "banner_breathe_together", ["banner_clear_voice"]],
  ["A3", "active", "banner_advance", ["banner_breathe_together"]],
  ["AA1", "passive", "banner_great_command", ["banner_advance"]],
  ["AA2", "reactive", "banner_two_beats", ["banner_great_command"]],
  ["AA3", "active", "banner_total_assault", ["banner_two_beats"]],
  ["AB1", "passive", "banner_line_delivery", ["banner_advance"]],
  ["AB2", "passive", "banner_synced_steps", ["banner_line_delivery"]],
  ["AB3", "active", "banner_line_advance", ["banner_synced_steps"]],
  ["B1", "target", "banner_next_target", ["banner_command"]],
  ["B2", "reactive", "banner_push_forward", ["banner_next_target"]],
  ["B3", "active", "banner_hurry", ["banner_push_forward"]],
  ["BA1", "passive", "banner_debt_token", ["banner_hurry"]],
  ["BA2", "reactive", "banner_debt_grace", ["banner_debt_token"]],
  ["BA3", "active", "banner_borrowed_command", ["banner_debt_grace"]],
  ["BB1", "passive", "banner_hourglass", ["banner_hurry"]],
  ["BB2", "reactive", "banner_buy_second", ["banner_hourglass"]],
  ["BB3", "active", "banner_last_command", ["banner_buy_second"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "banner", position, kind, skillId, requires: Object.freeze(requires),
})));
