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

function hookStrike() {
  const id = weaponSkillRuntimeId("grappling_hook:R");
  return {
    id,
    displayName: "引き打ち",
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: CLOSEST_ENEMY,
    effects: [
      {
        type: "deal_damage",
        target: EVENT_TARGET,
        amount: {
          type: "stat_scaled",
          subject: "self",
          scalingStat: "focus",
          coefficientBps: 8_000,
        },
        hitCount: 1,
        reach: "unrestricted",
        tags: ["attack", "technique", "forced_move"],
      },
      { type: "pull_toward_source", target: EVENT_TARGET },
    ],
    tags: ["attack", "technique", "forced_move", "move"],
  };
}

function forcedMovementBonus() {
  const id = weaponSkillRuntimeId("grappling_hook:A1");
  const rules = Array.from({ length: 31 }, (_, hitIndex) => ({
    id: id + ".forced_move_hit_" + hitIndex,
    listenTo: "damage_proposed",
    timing: "interrupt",
    priority: 55,
    predicates: [
      SELF_IS_EVENT_SOURCE,
      { type: "event_tag", tag: "attack", value: true },
      { type: "event_tag", tag: "forced_move", value: true },
      { type: "event_value", key: "hitIndex", op: "eq", value: hitIndex },
    ],
    costs: [],
    effects: [{
      type: "modify_pending_amount",
      operation: "increase",
      amount: { type: "event_value_scaled", key: "amount", numerator: 15, denominator: 100 },
    }],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }));
  return { id, displayName: "鉄鉤", tags: ["passive", "weapon"], rules };
}

export const HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_NODE_KEYS = Object.freeze([
  "grappling_hook:R",
  "grappling_hook:A1",
]);

export const HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "grappling_hook:R": hookStrike(),
  "grappling_hook:A1": forcedMovementBonus(),
});
