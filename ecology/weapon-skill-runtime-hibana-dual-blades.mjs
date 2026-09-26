import { makeWeaponSkillRuntimeRegistry, weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";

const CLOSEST_ENEMY = {
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
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};

function twinSlash() {
  const id = weaponSkillRuntimeId("dual_blades:R");
  return {
    id,
    displayName: "二連斬り",
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: CLOSEST_ENEMY,
    effects: [{
      type: "deal_damage",
      target: EVENT_TARGET,
      amount: {
        type: "stat_scaled",
        subject: "self",
        scalingStat: "might",
        coefficientBps: 5_500,
      },
      hitCount: 2,
      reach: "melee",
      tags: ["attack", "weapon"],
    }],
    tags: ["attack", "weapon"],
  };
}

function twoHitDamageBonus() {
  const id = weaponSkillRuntimeId("dual_blades:A1");
  const rules = Array.from({ length: 31 }, (_, hitIndex) => ({
    id: id + ".two_hit_attack_hit_" + hitIndex,
    listenTo: "damage_proposed",
    timing: "interrupt",
    priority: 55,
    predicates: [
      SELF_IS_EVENT_SOURCE,
      { type: "event_tag", tag: "attack", value: true },
      { type: "event_value", key: "hitCount", op: "gte", value: 2 },
      { type: "event_value", key: "hitIndex", op: "eq", value: hitIndex },
    ],
    costs: [],
    effects: [{
      type: "modify_pending_amount",
      operation: "increase",
      amount: { type: "event_value_scaled", key: "amount", numerator: 10, denominator: 100 },
    }],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }));
  return { id, displayName: "研ぎ分け", tags: ["passive", "weapon"], rules };
}

export const HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_NODE_KEYS = Object.freeze([
  "dual_blades:R",
  "dual_blades:A1",
]);

export const HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "dual_blades:R": twinSlash(),
  "dual_blades:A1": twoHitDamageBonus(),
});
