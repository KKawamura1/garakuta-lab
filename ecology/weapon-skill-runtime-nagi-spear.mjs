import { makeWeaponSkillRuntimeRegistry, weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";

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

function longSpearStrike() {
  const id = weaponSkillRuntimeId("long_spear:R");
  return {
    id,
    displayName: "貫き突き",
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
        scalingStat: "might",
        coefficientBps: 11_000,
      },
      hitCount: 1,
      reach: "ranged",
      tags: ["attack", "weapon"],
    }],
    tags: ["attack", "weapon"],
  };
}

function distanceBonus(nodeKey) {
  const id = weaponSkillRuntimeId(nodeKey);
  // The catalog reaches 30 hits; reserve one more slot for the existing
  // single-hit expansion rules. Each hit index needs its own rule ID because
  // the shared engine limits one rule to one firing per chain.
  const rules = Array.from({ length: 31 }, (_, hitIndex) => ({
    id: id + ".distance_hit_" + hitIndex,
    listenTo: "damage_proposed",
    timing: "interrupt",
    predicates: [
      {
        type: "target_exists",
        query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
      },
      { type: "event_tag", tag: "attack", value: true },
      { type: "event_value", key: "distance", op: "gte", value: 2 },
      { type: "event_value", key: "hitIndex", op: "eq", value: hitIndex },
    ],
    costs: [],
    effects: [{
      type: "modify_pending_amount",
      operation: "increase",
      amount: { type: "event_value_scaled", key: "amount", numerator: 15, denominator: 100 },
    }],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    priority: 55,
  }));
  return {
    id,
    displayName: "遠間の読み",
    tags: ["passive", "weapon"],
    rules,
  };
}

export const NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_NODE_KEYS = Object.freeze([
  "long_spear:R",
  "long_spear:A1",
]);

export const NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "long_spear:R": longSpearStrike(),
  "long_spear:A1": distanceBonus("long_spear:A1"),
});
