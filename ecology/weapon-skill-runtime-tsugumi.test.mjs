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
  TSUGUMI_STARTER_WEAPON_SKILL_NODE_KEYS,
  TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-tsugumi.mjs";

const tsugumiRegistry = TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY;
assert.deepEqual(Object.keys(tsugumiRegistry.entries), TSUGUMI_STARTER_WEAPON_SKILL_NODE_KEYS);
assert.equal(tsugumiRegistry.entries["launcher:R"].definition.displayName, "射出");
assert.equal(tsugumiRegistry.entries["launcher:A1"].definition.displayName, "高圧筒");
assert.equal(tsugumiRegistry.entries["medical_kit:R"].definition.displayName, "応急防壁");
assert.equal(tsugumiRegistry.entries["medical_kit:A1"].definition.displayName, "応急手当");

const allDefinitions = Object.fromEntries([
  ...Object.values(WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(tsugumiRegistry.entries),
].map((entry) => [entry.nodeKey, entry.definition]));
const registry = makeWeaponSkillRuntimeRegistry(allDefinitions);
assert.equal(Object.keys(registry.entries).length, 8,
  "the first two character groups expose only their eight initial R/A1 nodes");

const content = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
assert.deepEqual(validateContentBundle(content), [],
  "the launcher active/passive and medical active/reactive definitions validate through the common engine schema");

const LAUNCHER_R = weaponSkillRuntimeId("launcher:R");
const LAUNCHER_A1 = weaponSkillRuntimeId("launcher:A1");
const MEDICAL_R = weaponSkillRuntimeId("medical_kit:R");
const MEDICAL_A1 = weaponSkillRuntimeId("medical_kit:A1");
const GAUNTLETS_R = weaponSkillRuntimeId("gauntlets:R");

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
const RANGED_SEQUENCE_PROBE = {
  id: "stage5c_ranged_sequence_probe",
  displayName: "three-hit ranged probe",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: ENEMY_TARGET,
  effects: [{
    type: "deal_damage",
    target: EVENT_TARGET,
    amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 9_000 },
    hitCount: 3,
    reach: "ranged",
    tags: ["attack", "technique", "ranged"],
  }],
  tags: ["attack", "technique"],
};

function contentFor(extraActiveSkills = {}) {
  const projected = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
  const next = {
    ...projected,
    activeSkills: Object.freeze({ ...projected.activeSkills, ...extraActiveSkills }),
    enemyActors: Object.freeze({
      ...projected.enemyActors,
      husk: { ...projected.enemyActors.husk, maxHp: 500 },
    }),
  };
  assert.deepEqual(validateContentBundle(next), []);
  return next;
}

function ally(instanceId, characterId, position, options = {}) {
  return {
    instanceId,
    characterId,
    position,
    ...(options.hp !== undefined ? { hp: options.hp } : {}),
    tactics: options.tactics ?? [],
    reactiveSkillIds: options.reactiveSkillIds ?? [],
    passiveSkillIds: options.passiveSkillIds ?? [],
    equipment: [],
    ...(options.stats ? { stats: options.stats } : {}),
  };
}

function battle(battleId, allies) {
  return {
    ...structuredClone(CORE_BATTLE),
    battleId,
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies,
    enemies: [{
      ...CORE_BATTLE.enemies[0],
      instanceId: "e_stage5c",
      position: "front_left",
    }],
  };
}

function runSolo(activeSkillId, {
  hp = 14,
  reactiveSkillIds = [],
  passiveSkillIds = [],
  extraActiveSkills = {},
} = {}) {
  const input = battle("stage5c_" + (activeSkillId ?? "reaction") + "_" + hp, [
    ally("a_stage5c", "mender", "front_left", {
      hp,
      tactics: activeSkillId ? [{ activeSkillId, useWhen: [] }] : [],
      reactiveSkillIds,
      passiveSkillIds,
      stats: { might: 100, focus: 100 },
    }),
  ]);
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

const baseLauncher = runSolo(LAUNCHER_R);
const boostedLauncher = runSolo(LAUNCHER_R, { passiveSkillIds: [LAUNCHER_A1] });
const launcherHits = proposals(boostedLauncher, LAUNCHER_R);
assert.equal(proposals(baseLauncher, LAUNCHER_R).length, 1);
assert.equal(launcherHits.length, 1);
assert.ok(launcherHits[0].tags.includes("ranged"));
assert.equal(launcherHits[0].values.hitIndex, 0);
const launcherBonus = passiveModifications(boostedLauncher, LAUNCHER_A1);
assert.equal(launcherBonus.length, 1, "launcher A1 applies to the first hit of a ranged attack");
assert.equal(launcherBonus[0].values.before, launcherHits[0].values.amount);
assert.equal(launcherBonus[0].values.after,
  launcherBonus[0].values.before + Math.floor(launcherBonus[0].values.before * 15 / 100));

const unboostedSequence = runSolo(RANGED_SEQUENCE_PROBE.id, {
  extraActiveSkills: { [RANGED_SEQUENCE_PROBE.id]: RANGED_SEQUENCE_PROBE },
});
const boostedSequence = runSolo(RANGED_SEQUENCE_PROBE.id, {
  passiveSkillIds: [LAUNCHER_A1],
  extraActiveSkills: { [RANGED_SEQUENCE_PROBE.id]: RANGED_SEQUENCE_PROBE },
});
const baseHits = proposals(unboostedSequence, RANGED_SEQUENCE_PROBE.id);
const boostedHits = proposals(boostedSequence, RANGED_SEQUENCE_PROBE.id);
assert.deepEqual(baseHits.map((event) => event.values.hitIndex), [0, 1, 2]);
assert.deepEqual(boostedHits.map((event) => event.values.hitIndex), [0, 1, 2]);
const sequenceBonuses = passiveModifications(boostedSequence, LAUNCHER_A1);
assert.equal(sequenceBonuses.length, 1, "the first-hit bonus does not scale with later hits");
assert.equal(sequenceBonuses[0].values.proposalEventId, boostedHits[0].id);
assert.equal(sequenceBonuses[0].values.after,
  sequenceBonuses[0].values.before + Math.floor(sequenceBonuses[0].values.before * 15 / 100));

const meleeWithLauncherPassive = runSolo(GAUNTLETS_R, { passiveSkillIds: [LAUNCHER_A1] });
assert.equal(passiveModifications(meleeWithLauncherPassive, LAUNCHER_A1).length, 0,
  "launcher A1 is shared across weapons but remains limited to ranged attacks");

const barrierBattle = battle("stage5c_medical_barrier", [
  ally("a_gou_stage5c", "warden", "front_left", {
    hp: 12,
    stats: { might: 100, focus: 10 },
  }),
  ally("a_tsugumi_stage5c", "mender", "rear_left", {
    hp: 10,
    tactics: [{ activeSkillId: MEDICAL_R, useWhen: [] }],
    stats: { might: 100, focus: 20 },
  }),
]);
const barrierResult = simulateBattle(barrierBattle, contentFor());
const medicalBarrier = barrierResult.events.find((event) =>
  event.type === "barrier_gained" && event.sourceDefinitionId === MEDICAL_R);
assert.ok(medicalBarrier, "medical R creates a barrier through the shared engine");
assert.deepEqual(medicalBarrier.targetActorIds, ["a_gou_stage5c"],
  "the active chooses the lowest HP percentage, not the lowest absolute HP");
assert.equal(medicalBarrier.values.amount, 20);
assert.equal(medicalBarrier.values.duration, "round");

const lowHpCare = runSolo(null, { hp: 10, reactiveSkillIds: [MEDICAL_A1] });
const appliedCare = lowHpCare.events.filter((event) =>
  event.type === "healing_applied" && event.sourceDefinitionId === MEDICAL_A1);
assert.equal(appliedCare.length, 1, "medical A1 reacts when an enemy hit leaves an ally at or below half HP");
assert.deepEqual(appliedCare[0].targetActorIds, ["a_stage5c"]);
assert.equal(appliedCare[0].values.requested, 50);
assert.equal(appliedCare[0].values.actual, 4,
  "reactive healing is capped by the HP actually lost in this chain");
assert.equal(appliedCare[0].values.hpAfter, 10);
assert.equal(lowHpCare.events.filter((event) =>
  event.type === "resource_spent" && event.sourceDefinitionId === MEDICAL_A1).length, 1);

const highHpCare = runSolo(null, { hp: 14, reactiveSkillIds: [MEDICAL_A1] });
assert.equal(highHpCare.events.filter((event) =>
  event.type === "healing_applied" && event.sourceDefinitionId === MEDICAL_A1).length, 0,
"medical A1 does not heal while the target remains above half HP");
assert.equal(highHpCare.events.filter((event) =>
  event.type === "resource_spent" && event.sourceDefinitionId === MEDICAL_A1).length, 0,
"medical A1 does not spend RP while its threshold is unmet");

console.log("weapon runtime Tsugumi starters: ranged pressure, barrier targeting, and capped first aid pass");
