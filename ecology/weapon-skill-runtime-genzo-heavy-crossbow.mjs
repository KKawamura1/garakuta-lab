import { makeWeaponSkillRuntimeRegistry, weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";

const SELF = {
  scope: "self",
  filters: [{ type: "alive" }],
  take: 1,
};
const CLOSEST_ENEMY = {
  scope: "enemies",
  filters: [{ type: "alive" }],
  sort: ["distance_asc"],
  take: 1,
};
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};

function loadedShot() {
  const id = weaponSkillRuntimeId("heavy_crossbow:R");
  return {
    id,
    displayName: "装填射",
    apCost: 1,
    actionMode: "channel",
    intrinsicPredicates: [],
    targetQuery: SELF,
    effects: [],
    preparation: {
      steps: 1,
      completionEffects: [{
        type: "deal_damage",
        target: CLOSEST_ENEMY,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 20_000 },
        reach: "ranged",
        tags: ["attack", "weapon", "ranged"],
      }],
    },
    tags: ["attack", "weapon", "ranged", "preparation"],
  };
}

function preparedShotBonus() {
  const id = weaponSkillRuntimeId("heavy_crossbow:A1");
  const rules = Array.from({ length: 8 }, (_, hitIndex) => ({
    id: `${id}.prepared_hit_${hitIndex}`,
    listenTo: "damage_proposed",
    timing: "interrupt",
    priority: 55,
    predicates: [
      SELF_IS_EVENT_SOURCE,
      { type: "event_tag", tag: "attack", value: true },
      { type: "event_tag", tag: "prepared_attack", value: true },
      { type: "event_value", key: "hitIndex", op: "eq", value: hitIndex },
    ],
    costs: [],
    effects: [{
      type: "modify_pending_amount",
      operation: "increase",
      amount: { type: "event_value_scaled", key: "amount", numerator: 20, denominator: 100 },
    }],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }));
  return { id, displayName: "強弦", tags: ["passive", "weapon"], rules };
}

export const GENZO_HEAVY_CROSSBOW_STARTER_WEAPON_SKILL_NODE_KEYS = Object.freeze([
  "heavy_crossbow:R",
  "heavy_crossbow:A1",
]);

export const GENZO_HEAVY_CROSSBOW_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "heavy_crossbow:R": loadedShot(),
  "heavy_crossbow:A1": preparedShotBonus(),
});
