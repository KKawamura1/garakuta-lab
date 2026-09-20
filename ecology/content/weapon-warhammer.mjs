// R25 — 戦槌19節の縦スライス。
// 非アクティブ節は戦槌IDを条件にせず、hit数・攻撃・防御破壊・状態除去という
// 共有事実だけを読む。他武器へ借りても同じ規則で動く。

const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_TARGETS = Object.freeze({ scope: "event_targets", take: "all" });
const ONE_EVENT_TARGET = Object.freeze({ scope: "event_targets", take: 1 });
const ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
});
const SELF_IS_SOURCE = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const ATTACK_EVENT = Object.freeze({ type: "event_tag", tag: "attack", value: true });
const CHAIN_ONCE = Object.freeze({ owner: "actor-instance + rule", scope: "chain", count: 1 });
const percentOfEvent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});
const exactStatus = (statusId, stacks) => ({
  type: "has_status", subject: "self", statusId, op: "eq", value: stacks,
});
const hitCountIs = (count) => ({ type: "event_value", key: "hitCount", op: "eq", value: count });
const hitIndexIs = (index) => ({ type: "event_value", key: "hitIndex", op: "eq", value: index });

function active(id, displayName, coefficientBps, displayEffect, flavorText, options = {}) {
  const damage = {
    type: "deal_damage",
    target: options.pattern ? ONE_EVENT_TARGET : EVENT_TARGETS,
    amount: options.amount ?? {
      type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps,
    },
    rangeClass: "melee",
    tags: ["attack", "weapon", "warhammer"],
  };
  if (options.pattern) damage.targetPattern = options.pattern;
  return Object.freeze({
    id,
    displayName,
    displayEffect,
    flavorText,
    weaponId: "warhammer",
    treePosition: options.treePosition,
    ...(options.replacesActiveSkillId
      ? { replacesActiveSkillId: options.replacesActiveSkillId }
      : {}),
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: ENEMY,
    effects: [...(options.beforeEffects ?? []), damage, ...(options.afterEffects ?? [])],
    tags: ["attack", "weapon", "warhammer", "playable"],
  });
}

const ACTIVE = {
  warhammer_blow: active("warhammer_blow", "槌打ち", 10_000,
    "敵1体に腕力100%のダメージ。", "振り下ろせば、それで十分だ。", { treePosition: "R" }),
  warhammer_heavy_blow: active("warhammer_heavy_blow", "大槌打ち", 15_000,
    "敵1体に腕力150%のダメージ。", "重さをためらわず振り抜き、敵の芯まで叩き潰す。",
    { treePosition: "A3", replacesActiveSkillId: "warhammer_blow" }),
  warhammer_heaven_blow: active("warhammer_heaven_blow", "震天打ち", 22_000,
    "敵1体に腕力220%のダメージ。",
    "天を震わせる一撃は、地の底まで逃がさない。\n立っているものすべてに、終わりの重さを教えてやる。",
    { treePosition: "AA3", replacesActiveSkillId: "warhammer_heavy_blow" }),
  warhammer_earth_splitter: active("warhammer_earth_splitter", "地割り", 14_000,
    "敵1列に腕力140%のダメージ。",
    "振り下ろした先から、大地そのものが敵へ牙を剥く。\n一列まとめて、立つ場所ごと叩き割れ。",
    { treePosition: "AB3", replacesActiveSkillId: "warhammer_heavy_blow", pattern: "row" }),
  warhammer_siege_blow: active("warhammer_siege_blow", "破城打ち", 13_000,
    "敵1体に腕力130%のダメージを与え、防壁と受け構えをすべて除去。",
    "城壁も構えも、正面から砕けば同じだ。", {
      treePosition: "B3", replacesActiveSkillId: "warhammer_blow",
      afterEffects: [
        { type: "remove_barrier", target: EVENT_TARGETS },
        { type: "remove_block", target: EVENT_TARGETS },
      ],
    }),
  warhammer_dismantler: active("warhammer_dismantler", "解体槌", 17_000,
    "敵1体に腕力170%のダメージを与え、防壁・受け構え・強化をすべて除去。",
    "鎧も構えも、積み上げた守りも関係ない。\n守れるという思い込みから、順番に解体する。", {
      treePosition: "BA3", replacesActiveSkillId: "warhammer_siege_blow",
      afterEffects: [
        { type: "remove_barrier", target: EVENT_TARGETS },
        { type: "remove_block", target: EVENT_TARGETS },
        { type: "remove_statuses", target: EVENT_TARGETS, polarity: "positive" },
      ],
    }),
  warhammer_kingslayer: active("warhammer_kingslayer", "王殺し", 0,
    "敵1体の強化をすべて除去し、腕力130%＋1種類につき腕力60%のダメージ。",
    "奪った守りを鉄へ鍛え、すべてを最後の一打へ。\n王冠ごと沈めてこそ、戦槌の勝ちだ。", {
      treePosition: "BB3", replacesActiveSkillId: "warhammer_siege_blow",
      beforeEffects: [{ type: "remove_statuses", target: EVENT_TARGETS, polarity: "positive" }],
      amount: {
        type: "stat_times_context_scaled",
        subject: "self",
        scalingStat: "might",
        key: "removedStatusTypes",
        flatCoefficientBps: 13_000,
        coefficientBps: 6_000,
      },
    }),
};

function damageBoostPassive(id, displayName, percent, predicates, displayEffect, flavorText, treePosition) {
  return Object.freeze({
    id, displayName, displayEffect, flavorText, weaponId: "warhammer", treePosition,
    rules: [{
      id: id + "_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      priority: 42,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, ...predicates],
      allowRepeatInChain: true,
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(percent) }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "attack", "warhammer", "playable"],
  });
}

const PASSIVE = {
  warhammer_heavy_head: damageBoostPassive("warhammer_heavy_head", "重い頭", 15,
    [hitCountIs(1)], "1hit攻撃の合計ダメージ+15%。", "一撃の重みは、数では測れない。", "A1"),
  warhammer_iron_mass: damageBoostPassive("warhammer_iron_mass", "鉄塊", 20,
    [hitCountIs(1)], "1hit攻撃の合計ダメージがさらに+20%。", "振るうのではない。落とすのだ。", "AA1"),
  warhammer_deep_impact: Object.freeze({
    id: "warhammer_deep_impact", displayName: "深い衝撃", weaponId: "warhammer", treePosition: "AA2",
    displayEffect: "各行動で最初に与える怯み+1。",
    flavorText: "表面で止まった音は、肉と骨の奥で二度目の衝撃になる。",
    rules: [{
      id: "warhammer_deep_impact_rule", listenTo: "status_added", timing: "after", priority: 70,
      predicates: [SELF_IS_SOURCE, { type: "event_value", key: "statusId", op: "eq", value: "staggered" }],
      costs: [], effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "staggered", stacks: 1 }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "debuff", "warhammer", "playable"],
  }),
  warhammer_wide_swing: Object.freeze({
    id: "warhammer_wide_swing", displayName: "振り幅", weaponId: "warhammer", treePosition: "AB1",
    displayEffect: "1hit単体攻撃が、同じ列の別の敵1体にも35%のダメージ。",
    flavorText: "大振りは、隣まで巻き込む。",
    rules: [{
      id: "warhammer_wide_swing_rule", listenTo: "damage_proposed", timing: "after", priority: 90,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, hitCountIs(1)], costs: [],
      effects: [{
        type: "deal_damage",
        target: {
          scope: "enemies",
          filters: [
            { type: "alive" }, { type: "not_event_primary_target" },
            { type: "same_row_as_event_primary_target" },
          ],
          sort: ["position_asc"], take: 1,
        },
        amount: percentOfEvent(35), tags: ["splash"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "area", "warhammer", "playable"],
  }),
  warhammer_sweep: Object.freeze({
    id: "warhammer_sweep", displayName: "横薙ぎ", weaponId: "warhammer", treePosition: "AB2",
    displayEffect: "「振り幅」の追加対象+1、追加ダメージを60%に強化。",
    flavorText: "槌の軌道をさらに広げ、逃げた隣までまとめて薙ぎ払う。",
    replacesPassiveSkillIds: ["warhammer_wide_swing"],
    rules: [{
      id: "warhammer_sweep_rule", listenTo: "damage_proposed", timing: "after", priority: 90,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, hitCountIs(1)], costs: [],
      effects: [{
        type: "deal_damage",
        target: {
          scope: "enemies",
          filters: [
            { type: "alive" }, { type: "not_event_primary_target" },
            { type: "same_row_as_event_primary_target" },
          ],
          sort: ["position_asc"], take: "all",
        },
        amount: percentOfEvent(60), tags: ["splash"],
      }],
      limit: CHAIN_ONCE,
    }],
    tags: ["passive", "area", "warhammer", "playable"],
  }),
  warhammer_break_point: damageBoostPassive("warhammer_break_point", "崩れ目", 30, [{
    type: "target_exists",
    query: {
      scope: "enemies",
      filters: [
        { type: "alive" }, { type: "is_event_primary_target" },
        { type: "has_defense_or_status", statusId: "staggered" },
      ],
      take: 1,
    },
  }], "防壁・受け構え・怯み中の敵へのダメージ+30%。", "崩れた一瞬を逃さない。", "B2"),
  warhammer_broken_armor: Object.freeze({
    id: "warhammer_broken_armor", displayName: "砕けた鎧", weaponId: "warhammer", treePosition: "BA1",
    displayEffect: "自分が防壁か受け構えを除去した敵は、2ラウンド防御-10。",
    flavorText: "砕けた鎧は、もう守りにならない。",
    rules: ["barrier_broken", "block_spent"].map((listenTo) => ({
      id: "warhammer_broken_armor_" + listenTo + "_rule", listenTo, timing: "after", priority: 80,
      predicates: [SELF_IS_SOURCE, { type: "event_tag", tag: "effect", value: true }], costs: [],
      effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "armor_broken", stacks: 1 }],
      limit: CHAIN_ONCE,
    })),
    tags: ["passive", "debuff", "warhammer", "playable"],
  }),
  warhammer_trophy_fragment: Object.freeze({
    id: "warhammer_trophy_fragment", displayName: "戦利の破片", weaponId: "warhammer", treePosition: "BB1",
    displayEffect: "敵の強化を除去するたび破片1。破片1につき防御+6、最大5個。",
    flavorText: "敵の守りは、こちらの鎧になる。",
    rules: [{
      id: "warhammer_trophy_fragment_rule", listenTo: "status_removed", timing: "after", priority: 85,
      predicates: [SELF_IS_SOURCE, { type: "event_tag", tag: "positive", value: true }], costs: [],
      allowRepeatInChain: true,
      effects: [{ type: "add_status", target: SELF, statusId: "warhammer_fragment", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
    }],
    tags: ["passive", "guard", "warhammer", "playable"],
  }),
  warhammer_reverse_forging: Object.freeze({
    id: "warhammer_reverse_forging", displayName: "逆鍛造", weaponId: "warhammer", treePosition: "BB2",
    displayEffect: "攻撃ダメージが破片1につき+15%。攻撃後、破片を全消費。",
    flavorText: "拾い集めた敵の守りを、次に振り下ろす鉄へ鍛え直す。",
    rules: [
      ...Array.from({ length: 5 }, (_, index) => {
        const stacks = index + 1;
        return {
          id: "warhammer_reverse_forging_" + stacks + "_rule",
          listenTo: "damage_proposed", timing: "interrupt", priority: 43,
          predicates: [SELF_IS_SOURCE, ATTACK_EVENT, exactStatus("warhammer_fragment", stacks)], costs: [],
          allowRepeatInChain: true,
          effects: [{
            type: "modify_pending_amount", operation: "increase", amount: percentOfEvent(15 * stacks),
          }],
          limit: { owner: "actor-instance + rule", scope: "chain", count: 8 },
        };
      }),
      {
        id: "warhammer_reverse_forging_spend_rule",
        listenTo: "action_resolved", timing: "after", priority: 95,
        predicates: [SELF_IS_SOURCE, {
          type: "has_status", subject: "self", statusId: "warhammer_fragment", op: "gte", value: 1,
        }],
        costs: [],
        effects: [{ type: "remove_status", target: SELF, statusId: "warhammer_fragment", stacks: "all" }],
        limit: CHAIN_ONCE,
      },
    ],
    tags: ["passive", "attack", "warhammer", "playable"],
  }),
};

const REACTIVE = {
  warhammer_ringing_iron: Object.freeze({
    id: "warhammer_ringing_iron", displayName: "響く鉄", weaponId: "warhammer", treePosition: "A2",
    displayEffect: "攻撃の1・4hit目に、RP1で怯み1。1行動2回まで。",
    flavorText: "鉄の音が、膝を折る。",
    rules: [0, 3].map((hitIndex) => ({
      id: "warhammer_ringing_iron_hit_" + (hitIndex + 1) + "_rule",
      listenTo: "damage_proposed", timing: "after", priority: 60,
      predicates: [SELF_IS_SOURCE, ATTACK_EVENT, hitIndexIs(hitIndex)],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "staggered", stacks: 1 }],
      limit: CHAIN_ONCE,
    })),
    tags: ["reaction", "debuff", "warhammer", "playable"],
  }),
  warhammer_breaking_sound: Object.freeze({
    id: "warhammer_breaking_sound", displayName: "砕け音", weaponId: "warhammer", treePosition: "BA2",
    displayEffect: "敵の防壁を破壊した時、RP1で次の味方攻撃のダメージ+50%。",
    flavorText: "鎧の砕ける音が合図となり、次の一撃を割れ目へ導く。",
    rule: {
      id: "warhammer_breaking_sound_rule", listenTo: "barrier_broken", timing: "after", priority: 55,
      predicates: [SELF_IS_SOURCE], costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "add_status", target: EVENT_TARGETS, statusId: "breached", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
    },
    tags: ["reaction", "debuff", "warhammer", "playable"],
  }),
};

const TARGET = {
  warhammer_point_at_armor: Object.freeze({
    id: "warhammer_point_at_armor", displayName: "鎧を指す", weaponId: "warhammer", treePosition: "B1",
    displayEffect: "防壁か受け構えを持つ敵を優先。",
    flavorText: "まず、硬いものから壊す。",
    targetQuery: {
      scope: "enemies", filters: [{ type: "alive" }, { type: "has_defense" }],
      sort: ["position_asc"], take: 1,
    },
    tags: ["target", "defense", "warhammer", "playable"],
  }),
};

export const WARHAMMER_ACTIVE_SKILLS = Object.freeze(ACTIVE);
export const WARHAMMER_REACTIVE_SKILLS = Object.freeze(REACTIVE);
export const WARHAMMER_TARGET_SKILLS = Object.freeze(TARGET);
export const WARHAMMER_PASSIVE_SKILLS = Object.freeze(PASSIVE);

export const WARHAMMER_TREE = Object.freeze([
  ["R", "active", "warhammer_blow", []],
  ["A1", "passive", "warhammer_heavy_head", ["warhammer_blow"]],
  ["A2", "reactive", "warhammer_ringing_iron", ["warhammer_heavy_head"]],
  ["A3", "active", "warhammer_heavy_blow", ["warhammer_ringing_iron"]],
  ["AA1", "passive", "warhammer_iron_mass", ["warhammer_heavy_blow"]],
  ["AA2", "passive", "warhammer_deep_impact", ["warhammer_iron_mass"]],
  ["AA3", "active", "warhammer_heaven_blow", ["warhammer_deep_impact"]],
  ["AB1", "passive", "warhammer_wide_swing", ["warhammer_heavy_blow"]],
  ["AB2", "passive", "warhammer_sweep", ["warhammer_wide_swing"]],
  ["AB3", "active", "warhammer_earth_splitter", ["warhammer_sweep"]],
  ["B1", "target", "warhammer_point_at_armor", ["warhammer_blow"]],
  ["B2", "passive", "warhammer_break_point", ["warhammer_point_at_armor"]],
  ["B3", "active", "warhammer_siege_blow", ["warhammer_break_point"]],
  ["BA1", "passive", "warhammer_broken_armor", ["warhammer_siege_blow"]],
  ["BA2", "reactive", "warhammer_breaking_sound", ["warhammer_broken_armor"]],
  ["BA3", "active", "warhammer_dismantler", ["warhammer_breaking_sound"]],
  ["BB1", "passive", "warhammer_trophy_fragment", ["warhammer_siege_blow"]],
  ["BB2", "passive", "warhammer_reverse_forging", ["warhammer_trophy_fragment"]],
  ["BB3", "active", "warhammer_kingslayer", ["warhammer_reverse_forging"]],
].map(([position, kind, skillId, requires]) => Object.freeze({
  weaponId: "warhammer", position, kind, skillId, requires: Object.freeze(requires),
})));
