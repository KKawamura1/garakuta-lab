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
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
const ATTACK_EVENT = { type: "event_tag", tag: "attack", value: true };

function activeSkill(nodeKey, displayName, coefficientBps) {
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
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
      hitCount: 1,
      reach: "melee",
      tags: ["attack", "weapon"],
    }],
    tags: ["attack", "weapon"],
  };
}

function hitBonusRule(definitionId, hitIndex, percent) {
  return {
    id: definitionId + ".hit_" + hitIndex,
    listenTo: "damage_proposed",
    timing: "interrupt",
    predicates: [
      SELF_IS_EVENT_SOURCE,
      ATTACK_EVENT,
      { type: "event_value", key: "hitIndex", op: "eq", value: hitIndex },
    ],
    costs: [],
    effects: [{
      type: "modify_pending_amount",
      operation: "increase",
      amount: { type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100 },
    }],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    priority: 55,
  };
}

function passiveSkill(nodeKey, displayName, hitIndices, percent) {
  const id = weaponSkillRuntimeId(nodeKey);
  const rules = hitIndices.map((hitIndex) => hitBonusRule(id, hitIndex, percent));
  return {
    id,
    displayName,
    tags: ["passive", "weapon"],
    ...(rules.length === 1 ? { rule: rules[0] } : { rules }),
  };
}

export const WARDEN_STARTER_WEAPON_SKILL_NODE_KEYS = Object.freeze([
  "warhammer:R",
  "warhammer:A1",
  "gauntlets:R",
  "gauntlets:A1",
]);

export const WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "warhammer:R": activeSkill("warhammer:R", "槌打ち", 10_000),
  "warhammer:A1": passiveSkill("warhammer:A1", "重い頭", [0], 15),
  "gauntlets:R": activeSkill("gauntlets:R", "正拳", 9_000),
  "gauntlets:A1": passiveSkill("gauntlets:A1", "握り込み", [1, 2, 3, 4, 5, 6, 7], 10),
});
