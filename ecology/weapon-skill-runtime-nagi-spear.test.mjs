import assert from "node:assert/strict";
import { CORE_BATTLE } from "./fixtures.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
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
  NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_NODE_KEYS,
  NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-nagi-spear.mjs";

const definitions = [
  ...Object.values(WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
].map((entry) => [entry.nodeKey, entry.definition]);
const registry = makeWeaponSkillRuntimeRegistry(Object.fromEntries(definitions));
assert.equal(Object.keys(registry.entries).length, 10);
assert.deepEqual(
  Object.keys(NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_NODE_KEYS,
);
assert.equal(registry.entries["long_spear:R"].definition.displayName, "貫き突き");
assert.equal(registry.entries["long_spear:A1"].definition.displayName, "遠間の読み");

const SPEAR_R = weaponSkillRuntimeId("long_spear:R");
const SPEAR_A1 = weaponSkillRuntimeId("long_spear:A1");
const SEQUENCE_PROBE = {
  id: "stage5d_distance_sequence_probe",
  displayName: "three-hit distance probe",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: 1,
  },
  effects: [{
    type: "deal_damage",
    target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 9_000 },
    hitCount: 3,
    reach: "ranged",
    tags: ["attack", "weapon"],
  }],
  tags: ["attack", "weapon"],
};

function contentFor(extraActiveSkills = {}) {
  const projected = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
  const content = {
    ...projected,
    activeSkills: Object.freeze({ ...projected.activeSkills, ...extraActiveSkills }),
    enemyActors: Object.freeze({
      ...projected.enemyActors,
      husk: { ...projected.enemyActors.husk, maxHp: 500 },
    }),
  };
  assert.deepEqual(validateContentBundle(content), []);
  return content;
}

function run(activeSkillId, allyPosition, enemyPosition, {
  passiveSkillIds = [],
  extraActiveSkills = {},
} = {}) {
  const input = {
    ...structuredClone(CORE_BATTLE),
    battleId: "stage5d_" + activeSkillId + "_" + allyPosition + "_" + enemyPosition,
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [{
      instanceId: "a_nagi_stage5d",
      characterId: "lancer",
      position: allyPosition,
      hp: 20,
      tactics: [{ activeSkillId, useWhen: [] }],
      reactiveSkillIds: [],
      passiveSkillIds,
      equipment: [],
      stats: { might: 100, focus: 100 },
    }],
    enemies: [{
      ...CORE_BATTLE.enemies[0],
      instanceId: "e_stage5d",
      position: enemyPosition,
    }],
  };
  return simulateBattle(input, contentFor(extraActiveSkills));
}

function proposals(result, skillId) {
  return result.events.filter((event) =>
    event.type === "damage_proposed" && event.skillId === skillId);
}

function passiveModifications(result, skillId) {
  return result.events.filter((event) =>
    event.type === "pending_amount_modified" && event.sourceDefinitionId === skillId);
}

const farStrike = run(SPEAR_R, "rear_center", "front_right");
const farHit = proposals(farStrike, SPEAR_R)[0];
assert.ok(farHit, "long spear can target an enemy in the front row from the rear");
assert.equal(farHit.values.distance, 2,
  "distance uses the row and column of the two board positions");
assert.equal(farHit.values.amount, 110,
  "the long spear keeps its 110% Might strike at long range");

const farBoosted = run(SPEAR_R, "rear_center", "front_right", {
  passiveSkillIds: [SPEAR_A1],
});
const boostedFarHit = proposals(farBoosted, SPEAR_R)[0];
assert.equal(boostedFarHit.values.distance, 2);
const farBonus = passiveModifications(farBoosted, SPEAR_A1);
assert.equal(farBonus.length, 1, "A1 raises attacks against distance-2 targets");
assert.equal(farBonus[0].values.before, 110);
assert.equal(farBonus[0].values.after, 126);

const closeBoosted = run(SPEAR_R, "front_left", "front_center", {
  passiveSkillIds: [SPEAR_A1],
});
const closeHit = proposals(closeBoosted, SPEAR_R)[0];
assert.equal(closeHit.values.distance, 1);
assert.equal(closeHit.values.amount, 110);
assert.equal(passiveModifications(closeBoosted, SPEAR_A1).length, 0,
  "A1 does not raise attacks against distance-1 targets");

const farSequence = run(SEQUENCE_PROBE.id, "rear_center", "front_right", {
  passiveSkillIds: [SPEAR_A1],
  extraActiveSkills: { [SEQUENCE_PROBE.id]: SEQUENCE_PROBE },
});
const sequenceHits = proposals(farSequence, SEQUENCE_PROBE.id);
const sequenceBonuses = passiveModifications(farSequence, SPEAR_A1);
assert.deepEqual(sequenceHits.map((event) => event.values.hitIndex), [0, 1, 2]);
assert.deepEqual(sequenceHits.map((event) => event.values.distance), [2, 2, 2]);
assert.equal(sequenceBonuses.length, 3,
  "A1 applies once to every distance-qualified hit in a multihit action");
assert.deepEqual(sequenceBonuses.map((event) => event.values.after),
  sequenceBonuses.map((event) => event.values.before
    + Math.floor(event.values.before * 15 / 100)));

console.log("weapon runtime Nagi long spear starters: reach, grid distance, and per-hit bonus pass");
