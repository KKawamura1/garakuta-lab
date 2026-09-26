import { makeWeaponSkillRuntimeRegistry, weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";

const BARRIER_RECIPIENT = {
  scope: "allies",
  filters: [{ type: "alive" }],
  sort: ["hp_percent_asc", "position_asc"],
  take: 1,
};
const SELF_IS_BARRIER_RECIPIENT = {
  type: "target_exists",
  query: {
    scope: "self",
    filters: [{ type: "is_event_primary_target" }],
    take: 1,
  },
};

function barrierBonus() {
  const id = weaponSkillRuntimeId("tower_shield:A1");
  return {
    id,
    displayName: "厚板",
    tags: ["passive", "weapon"],
    rule: {
      id: id + ".self_barrier",
      listenTo: "barrier_proposed",
      timing: "interrupt",
      predicates: [SELF_IS_BARRIER_RECIPIENT],
      costs: [],
      effects: [{
        type: "modify_pending_amount",
        operation: "increase",
        amount: { type: "constant", value: 15 },
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      priority: 55,
    },
  };
}

export const NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_NODE_KEYS = Object.freeze([
  "tower_shield:A1",
]);

export const NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "tower_shield:A1": barrierBonus(),
});
