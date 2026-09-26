import assert from "node:assert/strict";
import { CORE_BATTLE } from "./fixtures.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { enemyActionIdFor } from "./content/enemy-skill-ids.mjs";
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
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_NODE_KEYS,
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-nagi-shield.mjs";

const definitions = [
  ...Object.values(WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
].map((entry) => [entry.nodeKey, entry.definition]);
const registry = makeWeaponSkillRuntimeRegistry(Object.fromEntries(definitions));
assert.equal(Object.keys(registry.entries).length, 12);
assert.deepEqual(
  Object.keys(NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_NODE_KEYS,
);
assert.equal(registry.entries["tower_shield:R"].definition.displayName, "守りを引く");
assert.equal(registry.entries["tower_shield:A1"].definition.displayName, "厚板");

const SHIELD_R = weaponSkillRuntimeId("tower_shield:R");
const SHIELD_A1 = weaponSkillRuntimeId("tower_shield:A1");
const BARRIER_PROBE = {
  id: "stage5d_barrier_receiver_probe",
  displayName: "ally barrier probe",
  apCost: 1,
  actionMode: "utility",
  intrinsicPredicates: [],
  targetQuery: {
    scope: "allies",
    filters: [{ type: "alive" }],
    sort: ["hp_percent_asc", "position_asc"],
    take: 1,
  },
  effects: [{
    type: "gain_barrier",
    target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
    amount: { type: "constant", value: 20 },
    duration: "round",
  }],
  tags: ["support"],
};
const ENEMY_SINGLE_ATTACK = {
  id: "stage5d_enemy_single_multihit",
  displayName: "single-target multihit probe",
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
    amount: { type: "constant", value: 3 },
    hitCount: 2,
    reach: "melee",
    tags: ["attack", "weapon"],
  }],
  tags: ["attack", "weapon"],
};
const ENEMY_AREA_ATTACK = {
  ...ENEMY_SINGLE_ATTACK,
  id: "stage5d_enemy_area_attack",
  displayName: "area attack probe",
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: "all",
  },
  effects: [{
    ...ENEMY_SINGLE_ATTACK.effects[0],
    hitCount: 1,
    reach: "ranged",
  }],
};

function contentFor({
  extraActiveSkills = {},
  extraEnemyActiveSkills = {},
  enemyTacticSkillId = "foe_action_strike",
} = {}) {
  const projected = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
  const content = {
    ...projected,
    activeSkills: Object.freeze({ ...projected.activeSkills, ...extraActiveSkills }),
    enemyActiveSkills: Object.freeze({ ...projected.enemyActiveSkills, ...extraEnemyActiveSkills }),
    statuses: Object.freeze({ ...projected.statuses, lured: STATUSES.lured }),
    enemyActors: Object.freeze({
      ...projected.enemyActors,
      husk: {
        ...projected.enemyActors.husk,
        maxHp: 500,
        tactics: [{ activeSkillId: enemyTacticSkillId, useWhen: [] }],
      },
    }),
  };
  assert.deepEqual(validateContentBundle(content), []);
  return content;
}

function baseBattle(battleId, allies) {
  return {
    ...structuredClone(CORE_BATTLE),
    battleId,
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies,
    enemies: [{
      ...CORE_BATTLE.enemies[0],
      instanceId: "e_stage5d_shield",
      position: "front_center",
    }],
  };
}

const barrierInput = baseBattle("stage5d_nagi_tower_shield_a1", [
  {
    instanceId: "a_nagi_stage5d_shield",
    characterId: "warden",
    position: "front_right",
    hp: 8,
    tactics: [],
    reactiveSkillIds: [],
    passiveSkillIds: [SHIELD_A1],
    equipment: [],
    stats: { might: 20, focus: 20 },
  },
  {
    instanceId: "a_tsugumi_stage5d_shield",
    characterId: "mender",
    position: "rear_left",
    hp: 14,
    tactics: [{ activeSkillId: BARRIER_PROBE.id, useWhen: [] }],
    reactiveSkillIds: [],
    passiveSkillIds: [],
    equipment: [],
    stats: { might: 20, focus: 20 },
  },
]);
const barrierResult = simulateBattle(barrierInput, contentFor({
  extraActiveSkills: { [BARRIER_PROBE.id]: BARRIER_PROBE },
}));
const barrierProposal = barrierResult.events.find((event) =>
  event.type === "barrier_proposed" && event.skillId === BARRIER_PROBE.id);
assert.ok(barrierProposal, "the ally-targeted barrier enters the shared interrupt window");
assert.deepEqual(barrierProposal.targetActorIds, ["a_nagi_stage5d_shield"]);
assert.equal(barrierProposal.values.amount, 20);

const barrier = barrierResult.events.find((event) =>
  event.type === "barrier_gained" && event.skillId === BARRIER_PROBE.id);
assert.ok(barrier, "the barrier is granted after the passive adjustment");
assert.deepEqual(barrier.targetActorIds, ["a_nagi_stage5d_shield"]);
assert.equal(barrier.values.amount, 35,
  "tower shield A1 adds 15 to a barrier received from another ally");

const bonus = barrierResult.events.filter((event) =>
  event.type === "pending_amount_modified" && event.sourceDefinitionId === SHIELD_A1);
assert.equal(bonus.length, 1);
assert.equal(bonus[0].values.before, 20);
assert.equal(bonus[0].values.after, 35);

function simulateShieldGuard(enemyAttack) {
  const skill = enemyAttack;
  const enemySkillId = enemyActionIdFor(skill.id);
  const input = baseBattle("stage5d_nagi_tower_guard_" + skill.id, [
    {
      instanceId: "a_nagi_stage5d_guard",
      characterId: "warden",
      position: "rear_right",
      hp: 16,
      tactics: [{ activeSkillId: SHIELD_R, useWhen: [] }],
      reactiveSkillIds: [],
      passiveSkillIds: [SHIELD_A1],
      equipment: [],
      stats: { might: 20, focus: 20 },
    },
    {
      instanceId: "a_front_stage5d_guard",
      characterId: "lancer",
      position: "front_left",
      hp: 15,
      tactics: [],
      reactiveSkillIds: [],
      passiveSkillIds: [],
      equipment: [],
      stats: { might: 20, focus: 20 },
    },
  ]);
  const content = contentFor({
    extraEnemyActiveSkills: { [enemySkillId]: { ...skill, id: enemySkillId } },
    enemyTacticSkillId: enemySkillId,
  });
  return simulateBattle(input, content);
}

const singleTargetResult = simulateShieldGuard(ENEMY_SINGLE_ATTACK);
const drawnBarrier = singleTargetResult.events.find((event) =>
  event.type === "barrier_gained" && event.skillId === SHIELD_R);
assert.ok(drawnBarrier, "tower shield R grants its barrier");
assert.deepEqual(drawnBarrier.targetActorIds, ["a_nagi_stage5d_guard"]);
assert.equal(drawnBarrier.values.amount, 45,
  "tower shield A1 also strengthens the owner's self barrier");
const lured = singleTargetResult.events.find((event) =>
  event.type === "status_added" && event.skillId === SHIELD_R
  && event.values.statusId === "lured");
assert.ok(lured, "tower shield R adds lure stacks");
assert.equal(lured.values.stacks, 2);

const redirected = singleTargetResult.events.find((event) =>
  event.type === "target_changed" && event.sourceDefinitionId === "lured");
assert.ok(redirected, "lure redirects a single-target enemy action during target selection");
assert.equal(redirected.values.from, "a_front_stage5d_guard");
assert.equal(redirected.values.to, "a_nagi_stage5d_guard");
const incomingHits = singleTargetResult.events.filter((event) =>
  event.type === "damage_proposed" && event.skillId === enemyActionIdFor(ENEMY_SINGLE_ATTACK.id));
assert.deepEqual(incomingHits.map((event) => event.values.hitIndex), [0, 1]);
assert.deepEqual(incomingHits.map((event) => event.targetActorIds[0]), [
  "a_nagi_stage5d_guard",
  "a_nagi_stage5d_guard",
]);
const spentLure = singleTargetResult.events.find((event) =>
  event.type === "status_removed" && event.values.statusId === "lured");
assert.ok(spentLure);
assert.equal(spentLure.values.removed, 1);
assert.equal(spentLure.values.remaining, 1);

const areaResult = simulateShieldGuard(ENEMY_AREA_ATTACK);
const areaSelection = areaResult.events.find((event) =>
  event.type === "target_selected" && event.skillId === enemyActionIdFor(ENEMY_AREA_ATTACK.id));
assert.equal(areaSelection.values.singleTarget, false);
assert.equal(areaSelection.values.targetCount, 2);
assert.equal(areaResult.events.filter((event) =>
  event.type === "target_changed" && event.sourceDefinitionId === "lured").length, 0,
"lure does not redirect an area attack even if its selected recipients include an ally");
const areaHits = areaResult.events.filter((event) =>
  event.type === "damage_proposed" && event.skillId === enemyActionIdFor(ENEMY_AREA_ATTACK.id));
assert.deepEqual(areaHits.map((event) => event.targetActorIds[0]), [
  "a_front_stage5d_guard",
  "a_nagi_stage5d_guard",
]);

console.log("weapon runtime Nagi tower shield starters: barrier bonus and single-target lure pass");
