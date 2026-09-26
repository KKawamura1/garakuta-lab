import { weaponSkillRuntimeId, makeWeaponSkillRuntimeRegistry } from "./weapon-skill-runtime.mjs";

const ENEMY_TARGET = {
  scope: "enemies",
  filters: [{ type: "alive" }],
  sort: ["position_asc"],
  take: 1,
};
const EVENT_TARGET = {
  scope: "event_targets",
  filters: [{ type: "alive" }],
  take: 1,
};
const LOWEST_HP_ALLY = {
  scope: "allies",
  filters: [{ type: "alive" }],
  sort: ["hp_percent_asc", "position_asc"],
  take: 1,
};

function rangedAttackSkill(nodeKey, displayName, coefficientBps) {
  const id = weaponSkillRuntimeId(nodeKey);
  return {
    id,
    displayName,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: ENEMY_TARGET,
    effects: [{
      type: "deal_damage",
      target: EVENT_TARGET,
      amount: {
        type: "stat_scaled",
        subject: "self",
        scalingStat: "focus",
        coefficientBps,
      },
      hitCount: 1,
      reach: "ranged",
      tags: ["attack", "technique", "ranged"],
    }],
    tags: ["attack", "technique"],
  };
}

function firstRangedHitBonus(nodeKey, displayName) {
  const id = weaponSkillRuntimeId(nodeKey);
  return {
    id,
    displayName,
    tags: ["passive", "weapon"],
    rule: {
      id: id + ".first_ranged_hit",
      listenTo: "damage_proposed",
      timing: "interrupt",
      predicates: [
        {
          type: "target_exists",
          query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
        },
        { type: "event_tag", tag: "attack", value: true },
        { type: "event_tag", tag: "ranged", value: true },
        { type: "event_value", key: "hitIndex", op: "eq", value: 0 },
      ],
      costs: [],
      effects: [{
        type: "modify_pending_amount",
        operation: "increase",
        amount: { type: "event_value_scaled", key: "amount", numerator: 15, denominator: 100 },
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      priority: 55,
    },
  };
}

function emergencyCare(nodeKey, displayName) {
  const id = weaponSkillRuntimeId(nodeKey);
  return {
    id,
    displayName,
    tags: ["reaction", "care"],
    rule: {
      id: id + ".rule",
      listenTo: "damage_taken",
      timing: "after",
      predicates: [
        {
          type: "target_exists",
          query: { scope: "enemies", filters: [{ type: "is_event_source" }], take: 1 },
        },
        {
          type: "target_exists",
          query: { scope: "allies", filters: [{ type: "is_event_primary_target" }, { type: "alive" }], take: 1 },
        },
        { type: "event_tag", tag: "attack", value: true },
        {
          type: "target_exists",
          query: {
            scope: "allies",
            filters: [
              { type: "is_event_primary_target" },
              { type: "alive" },
              { type: "hp_percent", op: "lte", value: 50 },
            ],
            take: 1,
          },
        },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "heal",
        target: {
          scope: "event_targets",
          filters: [{ type: "is_event_primary_target" }, { type: "alive" }],
          take: 1,
        },
        amount: {
          type: "stat_scaled",
          subject: "self",
          scalingStat: "focus",
          coefficientBps: 5_000,
        },
        tags: ["care"],
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      priority: 100,
    },
  };
}

export const TSUGUMI_STARTER_WEAPON_SKILL_NODE_KEYS = Object.freeze([
  "launcher:R",
  "launcher:A1",
  "medical_kit:R",
  "medical_kit:A1",
]);

export const TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "launcher:R": rangedAttackSkill("launcher:R", "射出", 10_000),
  "launcher:A1": firstRangedHitBonus("launcher:A1", "高圧筒"),
  "medical_kit:R": {
    id: weaponSkillRuntimeId("medical_kit:R"),
    displayName: "応急防壁",
    apCost: 1,
    actionMode: "utility",
    intrinsicPredicates: [],
    targetQuery: LOWEST_HP_ALLY,
    effects: [{
      type: "gain_barrier",
      target: EVENT_TARGET,
      amount: {
        type: "stat_scaled",
        subject: "self",
        scalingStat: "focus",
        coefficientBps: 10_000,
      },
      duration: "round",
    }],
    tags: ["support", "technique"],
  },
  "medical_kit:A1": emergencyCare("medical_kit:A1", "応急手当"),
});
