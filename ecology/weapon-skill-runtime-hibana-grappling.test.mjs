import assert from "node:assert/strict";
import { CORE_BATTLE } from "./fixtures.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { STATUSES } from "./content/statuses.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import {
  compileWeaponSkillRuntimeContent,
  makeWeaponSkillRuntimeRegistry,
  weaponSkillRuntimeId,
} from "./weapon-skill-runtime.mjs";
import {
  WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-warden.mjs";
import {
  TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-tsugumi.mjs";
import {
  NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-nagi-spear.mjs";
import {
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-nagi-shield.mjs";
import {
  HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_NODE_KEYS,
  HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-hibana-grappling.mjs";

const definitions = [
  ...Object.values(WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
].map((entry) => [entry.nodeKey, entry.definition]);
const registry = makeWeaponSkillRuntimeRegistry(Object.fromEntries(definitions));
assert.equal(Object.keys(registry.entries).length, 14);
assert.deepEqual(
  Object.keys(HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_NODE_KEYS,
);
assert.equal(registry.entries["grappling_hook:R"].definition.displayName, "引き打ち");
assert.equal(registry.entries["grappling_hook:A1"].definition.displayName, "鉄鉤");

const HOOK_R = weaponSkillRuntimeId("grappling_hook:R");
const HOOK_A1 = weaponSkillRuntimeId("grappling_hook:A1");
const HOOK_DEFINITION = registry.entries["grappling_hook:R"].definition;
const BLOCKED_MULTI_HIT_PROBE = {
  ...structuredClone(HOOK_DEFINITION),
  id: "stage5e_blocked_multi_hit_probe",
  displayName: "blocked two-hit forced move probe",
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "row_is", row: "rear" }],
    sort: ["distance_asc"],
    take: 1,
  },
  effects: HOOK_DEFINITION.effects.map((effect) => effect.type === "deal_damage"
    ? { ...effect, hitCount: 2 }
    : effect),
};

function contentFor(extraActiveSkills = {}) {
  const projected = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
  const content = {
    ...projected,
    activeSkills: Object.freeze({ ...projected.activeSkills, ...extraActiveSkills }),
    statuses: Object.freeze({ ...projected.statuses, lured: STATUSES.lured }),
    enemyActors: Object.freeze({
      ...projected.enemyActors,
      husk: {
        ...projected.enemyActors.husk,
        maxHp: 500,
        tactics: [{ activeSkillId: "foe_action_strike", useWhen: [] }],
      },
    }),
  };
  assert.deepEqual(validateContentBundle(content), []);
  return content;
}

function run(activeSkillId, allyPosition, enemyPositions, {
  passiveSkillIds = [HOOK_A1],
  extraActiveSkills = {},
} = {}) {
  const input = {
    ...structuredClone(CORE_BATTLE),
    battleId: "stage5e_" + activeSkillId + "_" + allyPosition,
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [{
      instanceId: "a_hibana_stage5e",
      characterId: "warden",
      position: allyPosition,
      hp: 120,
      tactics: [{ activeSkillId, useWhen: [] }],
      reactiveSkillIds: [],
      passiveSkillIds,
      equipment: [],
      stats: { might: 20, focus: 40 },
    }],
    enemies: enemyPositions.map(([instanceId, position]) => ({
      ...CORE_BATTLE.enemies[0],
      instanceId,
      position,
      hp: 500,
    })),
  };
  return simulateBattle(input, contentFor(extraActiveSkills));
}

function damageProposals(result, skillId) {
  return result.events.filter((event) =>
    event.type === "damage_proposed" && event.skillId === skillId);
}

function passiveModifications(result) {
  return result.events.filter((event) =>
    event.type === "pending_amount_modified" && event.sourceDefinitionId === HOOK_A1);
}

const nearest = run(HOOK_R, "front_left", [
  ["e_stage5e_far", "front_right"],
  ["e_stage5e_near", "rear_left"],
]);
const nearestHit = damageProposals(nearest, HOOK_R)[0];
assert.ok(nearestHit, "grappling hook resolves an attack against a living enemy");
assert.deepEqual(nearestHit.targetActorIds, ["e_stage5e_near"],
  "the hook chooses the enemy with the shortest grid distance before position order");
const nearestBonus = passiveModifications(nearest);
assert.equal(nearestBonus.length, 1, "A1 boosts the forced-movement attack");
assert.equal(nearestBonus[0].values.before, 32);
assert.equal(nearestBonus[0].values.after, 36);
const pulled = nearest.events.find((event) =>
  event.type === "actor_moved" && event.skillId === HOOK_R);
assert.ok(pulled, "the hook pulls its target after dealing damage");
assert.deepEqual(pulled.targetActorIds, ["e_stage5e_near"]);
assert.equal(pulled.values.from, "rear_left");
assert.equal(pulled.values.to, "front_left");
assert.deepEqual(pulled.tags, ["forced_move"]);

const blocked = run(BLOCKED_MULTI_HIT_PROBE.id, "front_left", [
  ["e_stage5e_blocker", "front_left"],
  ["e_stage5e_blocked_target", "rear_left"],
], {
  extraActiveSkills: { [BLOCKED_MULTI_HIT_PROBE.id]: BLOCKED_MULTI_HIT_PROBE },
});
const blockedHits = damageProposals(blocked, BLOCKED_MULTI_HIT_PROBE.id);
assert.deepEqual(blockedHits.map((event) => event.targetActorIds[0]),
  ["e_stage5e_blocked_target", "e_stage5e_blocked_target"]);
assert.deepEqual(blockedHits.map((event) => event.values.hitIndex), [0, 1]);
assert.equal(blocked.events.filter((event) =>
  event.type === "actor_moved" && event.skillId === BLOCKED_MULTI_HIT_PROBE.id).length, 0,
"the hook does not move the target when its only closer cell is occupied");
const blockedBonuses = passiveModifications(blocked);
assert.equal(blockedBonuses.length, 2,
  "A1 boosts each forced-movement hit even when the destination is blocked");
assert.deepEqual(blockedBonuses.map((event) => [event.values.before, event.values.after]),
  [[32, 36], [32, 36]]);

console.log("weapon runtime Hibana grappling hook starters: distance targeting, pull, and blocked-movement bonus pass");
