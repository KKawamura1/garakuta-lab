// Stage 6a — first catalog-order weapon slice after the Stage 5 starter set.
// The A2 reactive uses the shared actionHitOrdinal event value so its follow-up
// hit applies once per attack even when that attack covers multiple targets.

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
const SELF = { scope: "self", take: 1 };
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
const EVENT_TARGET_IS_ENEMY = {
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }, { type: "alive" }], take: 1 },
};
const ATTACK_EVENT = { type: "event_tag", tag: "attack", value: true };
const MARKER = "echoing_iron_armed";

const firstHitRule = {
  id: "weapon.warhammer.a2.first_hit",
  listenTo: "damage_proposed",
  timing: "interrupt",
  predicates: [
    SELF_IS_EVENT_SOURCE,
    EVENT_TARGET_IS_ENEMY,
    ATTACK_EVENT,
    { type: "event_value", key: "actionHitOrdinal", op: "eq", value: 0 },
  ],
  costs: [{ type: "spend_reaction_points", amount: 1 }],
  effects: [
    { type: "add_status", target: EVENT_TARGET, statusId: "staggered", stacks: 1 },
    { type: "add_status", target: SELF, statusId: MARKER, stacks: 1 },
  ],
  limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  priority: 60,
};

const followUpHitRule = {
  id: "weapon.warhammer.a2.follow_up_hit",
  listenTo: "damage_proposed",
  timing: "interrupt",
  predicates: [
    SELF_IS_EVENT_SOURCE,
    EVENT_TARGET_IS_ENEMY,
    ATTACK_EVENT,
    { type: "event_value", key: "actionHitOrdinal", op: "eq", value: 1 },
    { type: "has_status", subject: "self", statusId: MARKER, op: "gte", value: 1 },
  ],
  costs: [],
  effects: [
    { type: "add_status", target: EVENT_TARGET, statusId: "staggered", stacks: 1 },
    { type: "remove_status", target: SELF, statusId: MARKER, stacks: "all" },
  ],
  limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  priority: 60,
};

const actionCleanupRule = {
  id: "weapon.warhammer.a2.action_cleanup",
  listenTo: "action_resolved",
  timing: "after",
  predicates: [SELF_IS_EVENT_SOURCE, { type: "has_status", subject: "self", statusId: MARKER, op: "gte", value: 1 }],
  costs: [],
  effects: [{ type: "remove_status", target: SELF, statusId: MARKER, stacks: "all" }],
  limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  priority: 60,
};

const warhammerA2 = {
  id: weaponSkillRuntimeId("warhammer:A2"),
  displayName: "響く鉄",
  tags: ["reaction", "weapon", "playable"],
  rules: [firstHitRule, followUpHitRule, actionCleanupRule],
};

const warhammerA3 = {
  id: weaponSkillRuntimeId("warhammer:A3"),
  displayName: "大槌打ち",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: ENEMY_TARGET,
  effects: [{
    type: "deal_damage",
    target: EVENT_TARGET,
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 17_000 },
    hitCount: 1,
    reach: "melee",
    tags: ["attack", "weapon"],
  }],
  tags: ["attack", "weapon", "playable"],
};

export const STAGE_6A_WARHAMMER_SKILL_NODE_KEYS = Object.freeze(["warhammer:A2", "warhammer:A3"]);
export const STAGE_6A_WARHAMMER_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "warhammer:A2": warhammerA2,
  "warhammer:A3": warhammerA3,
});
