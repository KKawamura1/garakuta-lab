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
  HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-hibana-grappling.mjs";
import {
  HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_NODE_KEYS,
  HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-hibana-dual-blades.mjs";

const definitions = [
  ...Object.values(WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
].map((entry) => [entry.nodeKey, entry.definition]);
const registry = makeWeaponSkillRuntimeRegistry(Object.fromEntries(definitions));
assert.equal(Object.keys(registry.entries).length, 16);
assert.deepEqual(
  Object.keys(HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_NODE_KEYS,
);
assert.equal(registry.entries["dual_blades:R"].definition.displayName, "二連斬り");
assert.equal(registry.entries["dual_blades:A1"].definition.displayName, "研ぎ分け");

const DUAL_R = weaponSkillRuntimeId("dual_blades:R");
const DUAL_A1 = weaponSkillRuntimeId("dual_blades:A1");
const EVENT_TARGET = {
  scope: "event_targets",
  filters: [{ type: "alive" }],
  take: 1,
};
const TWO_HIT_PROBE = {
  id: "stage5e_non_blade_two_hit_probe",
  displayName: "two-hit attack probe",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["distance_asc"],
    take: 1,
  },
  effects: [{
    type: "deal_damage",
    target: EVENT_TARGET,
    amount: {
      type: "stat_scaled",
      subject: "self",
      scalingStat: "might",
      coefficientBps: 5_000,
    },
    hitCount: 2,
    reach: "melee",
    tags: ["attack", "weapon"],
  }],
  tags: ["attack", "weapon"],
};
const SINGLE_HIT_PROBE = {
  ...structuredClone(TWO_HIT_PROBE),
  id: "stage5e_single_hit_probe",
  displayName: "single-hit attack probe",
  effects: TWO_HIT_PROBE.effects.map((effect) => ({ ...effect, hitCount: 1 })),
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

function run(activeSkillId, extraActiveSkills = {}) {
  const input = {
    ...structuredClone(CORE_BATTLE),
    battleId: "stage5e_dual_" + activeSkillId,
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [{
      instanceId: "a_hibana_dual_stage5e",
      characterId: "warden",
      position: "front_right",
      hp: 20,
      tactics: [{ activeSkillId, useWhen: [] }],
      reactiveSkillIds: [],
      passiveSkillIds: [DUAL_A1],
      equipment: [],
      stats: { might: 100, focus: 40 },
    }],
    enemies: [
      { ...CORE_BATTLE.enemies[0], instanceId: "e_stage5e_far", position: "front_left", hp: 500 },
      { ...CORE_BATTLE.enemies[0], instanceId: "e_stage5e_near", position: "front_center", hp: 500 },
    ],
  };
  return simulateBattle(input, contentFor(extraActiveSkills));
}

function damageProposals(result, skillId) {
  return result.events.filter((event) =>
    event.type === "damage_proposed" && event.skillId === skillId);
}

function passiveModifications(result) {
  return result.events.filter((event) =>
    event.type === "pending_amount_modified" && event.sourceDefinitionId === DUAL_A1);
}

const twinStrike = run(DUAL_R);
const twinHits = damageProposals(twinStrike, DUAL_R);
assert.equal(twinHits.length, 2, "R resolves two damage instances");
assert.deepEqual(twinHits.map((event) => event.targetActorIds[0]),
  ["e_stage5e_near", "e_stage5e_near"],
  "melee targeting chooses the nearest living enemy before position order");
assert.deepEqual(twinHits.map((event) => event.values.hitIndex), [0, 1]);
assert.deepEqual(twinHits.map((event) => event.values.hitCount), [2, 2]);
assert.deepEqual(twinHits.map((event) => event.values.amount), [55, 55]);
const twinBonuses = passiveModifications(twinStrike);
assert.equal(twinBonuses.length, 2, "A1 applies to both hits of the base attack");
assert.deepEqual(twinBonuses.map((event) => [event.values.before, event.values.after]),
  [[55, 60], [55, 60]]);

const nonBladeResult = run(TWO_HIT_PROBE.id, { [TWO_HIT_PROBE.id]: TWO_HIT_PROBE });
const nonBladeBonuses = passiveModifications(nonBladeResult);
assert.equal(nonBladeBonuses.length, 2,
  "the passive also increases a two-hit attack from another weapon");
assert.deepEqual(nonBladeBonuses.map((event) => [event.values.before, event.values.after]),
  [[50, 55], [50, 55]]);

const singleHitResult = run(SINGLE_HIT_PROBE.id, { [SINGLE_HIT_PROBE.id]: SINGLE_HIT_PROBE });
assert.equal(damageProposals(singleHitResult, SINGLE_HIT_PROBE.id).length, 1);
assert.equal(passiveModifications(singleHitResult).length, 0,
  "the passive does not increase a single-hit attack");

console.log("weapon runtime Hibana dual blades starters: nearest-target two-hit attack and weapon-agnostic passive pass");
