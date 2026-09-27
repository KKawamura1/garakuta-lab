import { makeWeaponSkillRuntimeRegistry, weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";

const SELF = {
  scope: "self",
  filters: [{ type: "alive" }],
  take: 1,
};
const EVENT_TARGET = {
  scope: "event_targets",
  filters: [{ type: "alive" }],
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

function drawGuard() {
  const id = weaponSkillRuntimeId("tower_shield:R");
  return {
    id,
    displayName: "守りを引く",
    apCost: 1,
    actionMode: "utility",
    intrinsicPredicates: [],
    targetQuery: SELF,
    effects: [
      {
        type: "gain_barrier",
        target: EVENT_TARGET,
        amount: { type: "constant", value: 30 },
        duration: "round",
      },
      {
        type: "add_status",
        target: EVENT_TARGET,
        statusId: "lured",
        stacks: 2,
      },
    ],
    tags: ["support", "shield"],
  };
}

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
  "tower_shield:R",
  "tower_shield:A1",
]);

export const NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "tower_shield:R": drawGuard(),
  "tower_shield:A1": barrierBonus(),
});
