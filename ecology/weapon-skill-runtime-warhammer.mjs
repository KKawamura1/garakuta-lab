// Stage 6 — the complete warhammer track after the Stage 5 R/A1 starters.
// Skill behavior remains declarative; the shared runtime owns hit planning,
// target selection, status proposals, guard changes, and per-event limits.

import { makeWeaponSkillRuntimeRegistry, weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";

const ENEMY_TARGET = {
  scope: "enemies",
  filters: [{ type: "alive" }],
  sort: ["distance_asc"],
  take: 1,
};
const EVENT_TARGET = {
  scope: "event_targets",
  filters: [{ type: "alive" }],
  take: 1,
};
const EVENT_SOURCE = {
  scope: "event_source",
  filters: [{ type: "alive" }],
  take: 1,
};
const SELF = { scope: "self", take: 1 };
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
const ATTACK_EVENT = { type: "event_tag", tag: "attack", value: true };
const EVENT_PRIMARY_ENEMY = {
  type: "target_exists",
  query: {
    scope: "enemies",
    filters: [{ type: "is_event_primary_target" }, { type: "alive" }],
    take: 1,
  },
};
const EVENT_SOURCE_ENEMY = {
  type: "target_exists",
  query: {
    scope: "enemies",
    filters: [{ type: "is_event_source" }, { type: "alive" }],
    take: 1,
  },
};
const OTHER_ALLY_WAS_HIT = {
  type: "target_exists",
  query: {
    scope: "allies",
    filters: [
      { type: "is_event_primary_target" },
      { type: "not_self" },
    ],
    take: 1,
  },
};
const EVENT_SCOPE = { owner: "actor-instance + rule", scope: "event", count: 1 };
const CHAIN_SCOPE = { owner: "actor-instance + rule", scope: "chain", count: 1 };

function activeAttack(nodeKey, displayName, coefficientBps, {
  targetPattern,
  beforeDamage = [],
} = {}) {
  const id = weaponSkillRuntimeId(nodeKey);
  return {
    id,
    displayName,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: ENEMY_TARGET,
    effects: [
      ...beforeDamage,
      {
        type: "deal_damage",
        target: EVENT_TARGET,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
        hitCount: 1,
        ...(targetPattern ? { targetPattern } : {}),
        reach: "melee",
        tags: ["attack", "weapon"],
      },
    ],
    tags: ["attack", "weapon", "playable"],
  };
}

function firstHitBonus(nodeKey, displayName, percent) {
  const id = weaponSkillRuntimeId(nodeKey);
  return {
    id,
    displayName,
    tags: ["passive", "weapon", "playable"],
    rule: {
      id: id + ".first_hit",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [
        SELF_IS_EVENT_SOURCE,
        ATTACK_EVENT,
        { type: "event_value", key: "actionHitOrdinal", op: "eq", value: 0 },
      ],
      costs: [],
      effects: [{
        type: "modify_pending_amount",
        operation: "increase",
        amount: { type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100 },
      }],
      limit: EVENT_SCOPE,
      priority: 55,
    },
  };
}

const warhammerA2 = {
  id: weaponSkillRuntimeId("warhammer:A2"),
  displayName: "響く鉄",
  tags: ["reaction", "weapon", "playable"],
  rules: [
    {
      id: "weapon.warhammer.a2.first_hit",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [
        SELF_IS_EVENT_SOURCE,
        EVENT_PRIMARY_ENEMY,
        ATTACK_EVENT,
        { type: "event_value", key: "actionHitOrdinal", op: "eq", value: 0 },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [
        { type: "add_status", target: EVENT_TARGET, statusId: "staggered", stacks: 1 },
        { type: "add_status", target: SELF, statusId: "echoing_iron_armed", stacks: 1 },
      ],
      limit: CHAIN_SCOPE,
      priority: 60,
    },
    {
      id: "weapon.warhammer.a2.follow_up_hit",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [
        SELF_IS_EVENT_SOURCE,
        EVENT_PRIMARY_ENEMY,
        ATTACK_EVENT,
        { type: "event_value", key: "actionHitOrdinal", op: "eq", value: 1 },
        { type: "has_status", subject: "self", statusId: "echoing_iron_armed", op: "gte", value: 1 },
      ],
      costs: [],
      effects: [
        { type: "add_status", target: EVENT_TARGET, statusId: "staggered", stacks: 1 },
        { type: "remove_status", target: SELF, statusId: "echoing_iron_armed", stacks: "all" },
      ],
      limit: CHAIN_SCOPE,
      priority: 60,
    },
    {
      id: "weapon.warhammer.a2.action_cleanup",
      listenTo: "action_resolved",
      timing: "after",
      predicates: [SELF_IS_EVENT_SOURCE, { type: "has_status", subject: "self", statusId: "echoing_iron_armed", op: "gte", value: 1 }],
      costs: [],
      effects: [{ type: "remove_status", target: SELF, statusId: "echoing_iron_armed", stacks: "all" }],
      limit: CHAIN_SCOPE,
      priority: 60,
    },
  ],
};

const warhammerAB1 = {
  id: weaponSkillRuntimeId("warhammer:AB1"),
  displayName: "振り幅",
  tags: ["reaction", "weapon", "playable"],
  rule: {
    id: "weapon.warhammer.ab1.adjacent_expansion",
    listenTo: "action_targets_expanding",
    timing: "interrupt",
    predicates: [
      SELF_IS_EVENT_SOURCE,
      ATTACK_EVENT,
      { type: "event_value", key: "baseTargetCount", op: "eq", value: 1 },
    ],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "add_action_damage",
      target: { scope: "enemies", filters: [{ type: "alive" }], take: "all" },
      targetPattern: "adjacent",
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 3_500 },
      tags: ["attack", "weapon", "secondary_target"],
    }],
    limit: CHAIN_SCOPE,
    priority: 58,
  },
};

const warhammerAB2 = {
  id: weaponSkillRuntimeId("warhammer:AB2"),
  displayName: "横薙ぎ",
  tags: ["passive", "weapon", "playable"],
  rule: {
    id: "weapon.warhammer.ab2.multi_target_bonus",
    listenTo: "damage_proposed",
    timing: "interrupt",
    predicates: [
      SELF_IS_EVENT_SOURCE,
      ATTACK_EVENT,
      { type: "event_value", key: "plannedTargetCount", op: "gte", value: 2 },
    ],
    costs: [],
    effects: [{
      type: "modify_pending_amount",
      operation: "increase",
      amount: { type: "event_value_scaled", key: "amount", numerator: 15, denominator: 100 },
    }],
    limit: EVENT_SCOPE,
    priority: 56,
  },
};

const warhammerB1 = {
  id: weaponSkillRuntimeId("warhammer:B1"),
  displayName: "鎧を指す",
  query: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["defense_priority_desc", "block_desc", "distance_asc"],
    take: 1,
  },
};

const warhammerB2 = {
  id: weaponSkillRuntimeId("warhammer:B2"),
  displayName: "打ち返し",
  tags: ["reaction", "weapon", "playable"],
  rule: {
    id: "weapon.warhammer.b2.ally_counter",
    listenTo: "damage_taken",
    timing: "after",
    predicates: [
      ATTACK_EVENT,
      { type: "event_value", key: "amount", op: "gte", value: 1 },
      OTHER_ALLY_WAS_HIT,
      EVENT_SOURCE_ENEMY,
    ],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [
      { type: "add_status", target: EVENT_SOURCE, statusId: "staggered", stacks: 1 },
      {
        type: "deal_damage",
        target: EVENT_SOURCE,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 7_000 },
        reach: "unrestricted",
        tags: ["counter"],
      },
    ],
    limit: CHAIN_SCOPE,
    priority: 62,
  },
};

function defenseBreakRules(nodeKey, displayName) {
  const id = weaponSkillRuntimeId(nodeKey);
  const base = [SELF_IS_EVENT_SOURCE, ATTACK_EVENT, EVENT_PRIMARY_ENEMY];
  const makeRule = (suffix, extraPredicate) => ({
    id: id + "." + suffix,
    listenTo: "defense_reduced",
    timing: "after",
    predicates: [...base, extraPredicate],
    costs: [],
    effects: [{ type: "add_status", target: EVENT_TARGET, statusId: "armor_broken", stacks: 2 }],
    limit: EVENT_SCOPE,
    priority: 54,
  });
  return {
    id,
    displayName,
    tags: ["reaction", "weapon", "playable"],
    rules: [
      makeRule("block_removed", { type: "event_value", key: "blockRemoved", op: "gte", value: 1 }),
      makeRule("barrier_broken", { type: "event_value", key: "barrierAfter", op: "eq", value: 0 }),
    ],
  };
}

const warhammerBA2 = {
  id: weaponSkillRuntimeId("warhammer:BA2"),
  displayName: "砕け音",
  tags: ["reaction", "weapon", "playable"],
  rule: {
    id: "weapon.warhammer.ba2.clear_remaining_block",
    listenTo: "defense_reduced",
    timing: "after",
    predicates: [
      SELF_IS_EVENT_SOURCE,
      ATTACK_EVENT,
      EVENT_PRIMARY_ENEMY,
      { type: "event_value", key: "cause", op: "eq", value: "damage" },
      { type: "event_value", key: "blockRemoved", op: "gte", value: 1 },
      { type: "event_value", key: "blockAfter", op: "gte", value: 1 },
    ],
    costs: [],
    effects: [{
      type: "reduce_defenses",
      target: EVENT_TARGET,
      clearBlock: true,
      tags: ["warhammer_guard_collapse"],
    }],
    limit: EVENT_SCOPE,
    priority: 53,
  },
};

const warhammerBB1 = {
  id: weaponSkillRuntimeId("warhammer:BB1"),
  displayName: "戦利の破片",
  tags: ["passive", "weapon", "playable"],
  rules: [
    {
      id: "weapon.warhammer.bb1.buff_removed",
      listenTo: "status_removed",
      timing: "after",
      predicates: [
        SELF_IS_EVENT_SOURCE,
        ATTACK_EVENT,
        EVENT_PRIMARY_ENEMY,
        { type: "event_tag", tag: "buff", value: true },
      ],
      costs: [],
      effects: [{
        type: "add_status",
        target: SELF,
        statusId: "fortified",
        stacks: { type: "event_value_scaled", key: "removed", numerator: 2, denominator: 1 },
      }],
      limit: EVENT_SCOPE,
      priority: 52,
    },
    {
      id: "weapon.warhammer.bb1.guard_removed",
      listenTo: "defense_reduced",
      timing: "after",
      predicates: [
        SELF_IS_EVENT_SOURCE,
        ATTACK_EVENT,
        EVENT_PRIMARY_ENEMY,
        { type: "event_value", key: "blockRemoved", op: "gte", value: 1 },
      ],
      costs: [],
      effects: [{
        type: "add_status",
        target: SELF,
        statusId: "fortified",
        stacks: { type: "event_value_scaled", key: "blockRemoved", numerator: 2, denominator: 1 },
      }],
      limit: EVENT_SCOPE,
      priority: 52,
    },
  ],
};

const warhammerBB2 = {
  id: weaponSkillRuntimeId("warhammer:BB2"),
  displayName: "逆鍛造",
  tags: ["passive", "weapon", "playable"],
  rules: [
    {
      id: "weapon.warhammer.bb2.fortification_bonus",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [
        SELF_IS_EVENT_SOURCE,
        ATTACK_EVENT,
        { type: "event_status_stacks", key: "startingStatusStacks", statusId: "fortified", op: "gte", value: 1 },
      ],
      costs: [],
      effects: [{
        type: "modify_pending_amount",
        operation: "increase",
        amount: {
          type: "event_status_stacks_percent",
          key: "amount",
          stacksKey: "startingStatusStacks",
          statusId: "fortified",
          percentPerStack: 15,
        },
      }],
      limit: EVENT_SCOPE,
      priority: 57,
    },
    {
      id: "weapon.warhammer.bb2.consume_fortification",
      listenTo: "action_resolved",
      timing: "after",
      predicates: [SELF_IS_EVENT_SOURCE, ATTACK_EVENT],
      costs: [],
      effects: [{ type: "remove_status", target: SELF, statusId: "fortified", stacks: "all" }],
      limit: EVENT_SCOPE,
      priority: 57,
    },
    {
      id: "weapon.warhammer.bb2.consume_on_cancel",
      listenTo: "action_canceled",
      timing: "after",
      predicates: [
        SELF_IS_EVENT_SOURCE,
        ATTACK_EVENT,
        { type: "event_value", key: "actionStarted", op: "eq", value: true },
      ],
      costs: [],
      effects: [{ type: "remove_status", target: SELF, statusId: "fortified", stacks: "all" }],
      limit: EVENT_SCOPE,
      priority: 57,
    },
  ],
};

function defenseStrip(nodeKey, displayName, coefficientBps, stripMode = null) {
  const beforeDamage = [{
    type: "reduce_defenses",
    target: EVENT_TARGET,
    barrierBps: 10_000,
    clearBlock: true,
    tags: ["attack", "weapon"],
  }];
  if (stripMode === "all_buffs") {
    beforeDamage.push({ type: "remove_status_by_tag", target: EVENT_TARGET, tag: "buff" });
  } else if (stripMode === "fortified") {
    beforeDamage.push({ type: "remove_status", target: EVENT_TARGET, statusId: "fortified", stacks: "all" });
  }
  return activeAttack(nodeKey, displayName, coefficientBps, { beforeDamage });
}

export const STAGE_6_WARHAMMER_SKILL_NODE_KEYS = Object.freeze([
  "warhammer:A2", "warhammer:A3",
  "warhammer:AA1", "warhammer:AA2", "warhammer:AA3",
  "warhammer:AB1", "warhammer:AB2", "warhammer:AB3",
  "warhammer:B1", "warhammer:B2", "warhammer:B3",
  "warhammer:BA1", "warhammer:BA2", "warhammer:BA3",
  "warhammer:BB1", "warhammer:BB2", "warhammer:BB3",
]);

export const STAGE_6_WARHAMMER_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "warhammer:A2": warhammerA2,
  "warhammer:A3": activeAttack("warhammer:A3", "大槌打ち", 17_000),
  "warhammer:AA1": firstHitBonus("warhammer:AA1", "鉄塊", 20),
  "warhammer:AA2": {
    id: weaponSkillRuntimeId("warhammer:AA2"),
    displayName: "深い衝撃",
    tags: ["passive", "weapon", "playable"],
    rule: {
      id: "weapon.warhammer.aa2.deeper_stagger",
      listenTo: "status_proposed",
      timing: "interrupt",
      predicates: [
        SELF_IS_EVENT_SOURCE,
        { type: "event_value", key: "statusId", op: "eq", value: "staggered" },
      ],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "increase", amount: { type: "constant", value: 1 } }],
      limit: EVENT_SCOPE,
      priority: 58,
    },
  },
  "warhammer:AA3": activeAttack("warhammer:AA3", "震天打ち", 22_000),
  "warhammer:AB1": warhammerAB1,
  "warhammer:AB2": warhammerAB2,
  "warhammer:AB3": activeAttack("warhammer:AB3", "地割り", 16_000, { targetPattern: "row" }),
  "warhammer:B1": warhammerB1,
  "warhammer:B2": warhammerB2,
  "warhammer:B3": defenseStrip("warhammer:B3", "破城打ち", 13_000, false),
  "warhammer:BA1": defenseBreakRules("warhammer:BA1", "砕けた鎧"),
  "warhammer:BA2": warhammerBA2,
  "warhammer:BA3": defenseStrip("warhammer:BA3", "解体槌", 17_000, "fortified"),
  "warhammer:BB1": warhammerBB1,
  "warhammer:BB2": warhammerBB2,
  "warhammer:BB3": defenseStrip("warhammer:BB3", "王殺し", 18_000, "all_buffs"),
});
