import assert from "node:assert/strict";
import { CORE_BATTLE } from "./fixtures.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { STATUSES } from "./content/statuses.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import {
  STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS,
  STAGE_6_IMPLEMENTED_WEAPON_SKILL_NODE_KEYS,
  compileWeaponSkillRuntimeContent,
  availableExecutableWeaponSkillNodeKeys,
  weaponSkillRuntimeId,
} from "./weapon-skill-runtime.mjs";
import { freshWeaponPackProfile, makeWeaponPackManifest } from "./weapon-pack-manifest.mjs";
import { STAGE_6_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-stage6.mjs";

const registry = STAGE_6_WEAPON_SKILL_RUNTIME_REGISTRY;
assert.equal(Object.keys(registry.entries).length, 22);
assert.equal(STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS.length, 20);
assert.deepEqual(Object.keys(registry.entries).sort(), [...STAGE_6_IMPLEMENTED_WEAPON_SKILL_NODE_KEYS].sort());
assert.deepEqual(validateContentBundle(compileWeaponSkillRuntimeContent({ ...FIXTURE_CONTENT, statuses: STATUSES }, registry)), []);

const WARHAMMER_A2 = weaponSkillRuntimeId("warhammer:A2");
const WARHAMMER_A3 = weaponSkillRuntimeId("warhammer:A3");
const THREE_HIT_PROBE = "stage6a_three_hit_probe";
const TWO_TARGET_PROBE = "stage6a_two_target_probe";

function probeSkill(id, { hitCount = 3, targetPattern } = {}) {
  return {
    id,
    displayName: id,
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
      hitCount,
      ...(targetPattern ? { targetPattern } : {}),
      reach: "melee",
      tags: ["attack", "weapon"],
    }],
    tags: ["attack", "weapon"],
  };
}

function contentFor(activeSkills = {}, { baseReactionPoints } = {}) {
  const baseContentBundle = { ...FIXTURE_CONTENT, statuses: STATUSES };
  const base = compileWeaponSkillRuntimeContent(baseContentBundle, registry);
  const characters = { ...base.characters };
  if (baseReactionPoints !== undefined) {
    characters.warden = { ...characters.warden, baseReactionPoints };
  }
  const content = {
    ...base,
    characters: Object.freeze(characters),
    activeSkills: Object.freeze({ ...base.activeSkills, ...activeSkills }),
    enemyActors: Object.freeze({
      ...base.enemyActors,
      husk: { ...base.enemyActors.husk, maxHp: 500 },
    }),
  };
  assert.deepEqual(validateContentBundle(content), []);
  return content;
}

function runSkill(activeSkillId, {
  reactiveSkillIds = [],
  skillDefinitions = {},
  enemies = [{ instanceId: "e_near", enemyActorId: "husk", position: "front_center" }],
  baseReactionPoints,
} = {}) {
  const battle = structuredClone(CORE_BATTLE);
  battle.battleId = "stage6a_" + activeSkillId;
  battle.maxRounds = 1;
  battle.objective = { type: "survive_rounds", rounds: 1 };
  battle.allies = [{
    ...CORE_BATTLE.allies[0],
    instanceId: "a_stage6a",
    position: "front_left",
    tactics: [{ activeSkillId, useWhen: [] }],
    reactiveSkillIds,
    passiveSkillIds: [],
    equipment: [],
    stats: { might: 100 },
  }];
  battle.enemies = enemies;
  return simulateBattle(battle, contentFor(skillDefinitions, { baseReactionPoints }));
}

function a2StatusEvents(result, statusId) {
  return result.events.filter((event) => event.type === "status_added"
    && event.sourceDefinitionId === WARHAMMER_A2
    && event.values.statusId === statusId);
}

const threeHitResult = runSkill(THREE_HIT_PROBE, {
  reactiveSkillIds: [WARHAMMER_A2],
  skillDefinitions: { [THREE_HIT_PROBE]: probeSkill(THREE_HIT_PROBE) },
});
const threeHitProposals = threeHitResult.events.filter((event) =>
  event.type === "damage_proposed" && event.skillId === THREE_HIT_PROBE);
assert.deepEqual(threeHitProposals.map((event) => event.values.actionHitOrdinal), [0, 1, 2],
  "the engine records a zero-based hit order across one action plan");
assert.equal(threeHitResult.events.filter((event) => event.type === "resource_spent"
  && event.sourceDefinitionId === WARHAMMER_A2
  && event.values.resource === "reaction_points").length, 1,
"響く鉄 spends exactly one RP for the attack");
assert.equal(a2StatusEvents(threeHitResult, "staggered").length, 2,
  "響く鉄 staggers only the first two hits of a three-hit attack");
assert.deepEqual(a2StatusEvents(threeHitResult, "staggered").map((event) => event.values.stacks), [1, 2]);
assert.equal(threeHitResult.actors.find((actor) => actor.instanceId === "a_stage6a").statuses
  .some(({ statusId }) => statusId === "echoing_iron_armed"), false,
"the one-hit marker is gone when its action resolves");

const twoTargetResult = runSkill(TWO_TARGET_PROBE, {
  reactiveSkillIds: [WARHAMMER_A2],
  skillDefinitions: { [TWO_TARGET_PROBE]: probeSkill(TWO_TARGET_PROBE, { hitCount: 1, targetPattern: "row" }) },
  enemies: [
    { instanceId: "e_left", enemyActorId: "husk", position: "front_center" },
    { instanceId: "e_right", enemyActorId: "husk", position: "front_right" },
  ],
});
const twoTargetProposals = twoTargetResult.events.filter((event) =>
  event.type === "damage_proposed" && event.skillId === TWO_TARGET_PROBE);
assert.deepEqual(twoTargetProposals.map((event) => event.values.actionHitOrdinal), [0, 1],
  "multi-target damage packets use one action-wide hit order");
assert.deepEqual(a2StatusEvents(twoTargetResult, "staggered").map((event) => event.targetActorIds[0]), ["e_left", "e_right"],
  "響く鉄 applies to the first two target hits, not twice to one target");
assert.equal(twoTargetResult.events.filter((event) => event.type === "resource_spent"
  && event.sourceDefinitionId === WARHAMMER_A2
  && event.values.resource === "reaction_points").length, 1);

const noRpResult = runSkill(THREE_HIT_PROBE, {
  reactiveSkillIds: [WARHAMMER_A2],
  skillDefinitions: { [THREE_HIT_PROBE]: probeSkill(THREE_HIT_PROBE) },
  baseReactionPoints: 0,
});
assert.equal(noRpResult.events.filter((event) => event.type === "resource_spent"
  && event.sourceDefinitionId === WARHAMMER_A2
  && event.values.resource === "reaction_points").length, 0,
"響く鉄 cannot fire or partially apply without RP");
assert.equal(a2StatusEvents(noRpResult, "staggered").length, 0);

const bigHammerResult = runSkill(WARHAMMER_A3, {
  skillDefinitions: {},
  enemies: [
    { instanceId: "e_near", enemyActorId: "husk", position: "front_center" },
    { instanceId: "e_far", enemyActorId: "husk", position: "front_right" },
  ],
});
const bigHammerProposal = bigHammerResult.events.find((event) =>
  event.type === "damage_proposed" && event.skillId === WARHAMMER_A3);
assert.equal(bigHammerProposal.targetActorIds[0], "e_near", "大槌打ち chooses the nearest valid target");
assert.equal(bigHammerProposal.values.amount, 170, "大槌打ち deals 170% of might");

const allWeaponSkills = makeWeaponPackManifest("stage6a-runtime-gate", {
  ...freshWeaponPackProfile({
    unlockedSkillPackIds: ["skill:warhammer"],
    unlockedEquipmentPackIds: [],
  }),
}, { skillPackCount: 1, equipmentPackCount: 0 });
assert.deepEqual(availableExecutableWeaponSkillNodeKeys(allWeaponSkills, registry), [
  "warhammer:R", "warhammer:A1", "warhammer:A2", "warhammer:A3",
], "only implemented warhammer nodes within its unlocked pack are executable");

console.log("Stage 6a warhammer A2/A3: per-action hit order, RP, stagger, nearest-target damage pass");
