import assert from "node:assert/strict";
import { BATTLE_SCHEMA_VERSION } from "./schema.mjs";
import { CORE_BATTLE } from "./fixtures.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { STATUSES } from "./content/statuses.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import {
  compileWeaponSkillRuntimeContent,
  makeWeaponSkillRuntimeRegistry,
  weaponSkillRuntimeId,
} from "./weapon-skill-runtime.mjs";
import { WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-warden.mjs";
import { TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-tsugumi.mjs";
import { NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-nagi-spear.mjs";
import { NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-nagi-shield.mjs";
import { HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-hibana-grappling.mjs";
import { HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-hibana-dual-blades.mjs";
import { GENZO_BANNER_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-genzo-banner.mjs";
import { GENZO_HEAVY_CROSSBOW_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-genzo-heavy-crossbow.mjs";

const registries = [
  WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  GENZO_BANNER_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  GENZO_HEAVY_CROSSBOW_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
];
const allDefinitions = Object.fromEntries(registries
  .flatMap((registry) => Object.values(registry.entries))
  .map((entry) => [entry.nodeKey, entry.definition]));
const registry = makeWeaponSkillRuntimeRegistry(allDefinitions);
assert.equal(Object.keys(registry.entries).length, 20,
  "the first playable set registers all five characters' representative R/A1 nodes");

const DUAL_R = weaponSkillRuntimeId("dual_blades:R");
const DUAL_A1 = weaponSkillRuntimeId("dual_blades:A1");
const HOOK_R = weaponSkillRuntimeId("grappling_hook:R");
const BANNER_R = weaponSkillRuntimeId("banner:R");
const BANNER_A1 = weaponSkillRuntimeId("banner:A1");
const CROSSBOW_R = weaponSkillRuntimeId("heavy_crossbow:R");
const CROSSBOW_A1 = weaponSkillRuntimeId("heavy_crossbow:A1");

function contentFor({ characterAp = {}, extraActiveSkills = {} } = {}) {
  const projected = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
  const characters = { ...projected.characters };
  for (const [characterId, baseActionPoints] of Object.entries(characterAp)) {
    characters[characterId] = { ...characters[characterId], baseActionPoints };
  }
  const content = {
    ...projected,
    characters: Object.freeze(characters),
    activeSkills: Object.freeze({ ...projected.activeSkills, ...extraActiveSkills }),
    statuses: Object.freeze({ ...projected.statuses, ...STATUSES }),
    enemyActors: Object.freeze({
      ...projected.enemyActors,
      husk: {
        ...projected.enemyActors.husk,
        maxHp: 5_000,
        tactics: [{ activeSkillId: "foe_action_strike", useWhen: [] }],
      },
    }),
  };
  assert.deepEqual(validateContentBundle(content), []);
  return content;
}

function ally(instanceId, characterId, position, activeSkillId, passiveSkillIds = [], stats = undefined) {
  return {
    instanceId,
    characterId,
    position,
    tactics: activeSkillId ? [{ activeSkillId, useWhen: [] }] : [],
    reactiveSkillIds: [],
    passiveSkillIds,
    equipment: [],
    ...(stats ? { stats } : {}),
  };
}

function battle(battleId, allies, maxRounds = 1) {
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId,
    maxRounds,
    objective: { type: "survive_rounds", rounds: maxRounds },
    allies,
    enemies: [{ ...CORE_BATTLE.enemies[0], instanceId: "e_stage5f", hp: 5_000 }],
  };
}

// Dual-blade R is 55% might for two hits. Its passive applies to every hit only
// when the ActionPlan's base hit count is at least two.
const dualBladeBattle = simulateBattle(battle("stage5f_dual_blades", [
  ally("a_hibana", "warden", "front_left", DUAL_R, [DUAL_A1], { might: 50 }),
]), contentFor());
const dualDamage = dualBladeBattle.events.filter((event) =>
  event.type === "damage_proposed" && event.skillId === DUAL_R);
assert.deepEqual(dualDamage.map((event) => event.values.baseHitCount), [2, 2]);
const dualBonuses = dualBladeBattle.events.filter((event) =>
  event.type === "pending_amount_modified" && event.sourceDefinitionId === DUAL_A1);
assert.equal(dualBonuses.length, 2, "研ぎ分け boosts both base hits");
assert.ok(dualBonuses.every((event) => event.values.after > event.values.before));

// The multi-hit passive is weapon-neutral, but it must not be triggered by a
// one-hit attack just because another weapon is equipped in the same loadout.
const oneHitBattle = simulateBattle(battle("stage5f_dual_a1_one_hit", [
  ally("a_hibana", "warden", "front_left", HOOK_R, [DUAL_A1]),
]), contentFor());
assert.equal(oneHitBattle.events.filter((event) =>
  event.type === "pending_amount_modified" && event.sourceDefinitionId === DUAL_A1).length, 0);

// Genzou gives the living ally with the fewest AP one point. 声を通す is
// scoped to this action's AP transfer and marks that recipient with focus.
const bannerBattle = simulateBattle(battle("stage5f_banner_lowest_ap", [
  ally("a_genzo", "mender", "front_left", BANNER_R, [BANNER_A1]),
  ally("a_low_ap", "warden", "front_center", null),
  ally("a_more_ap", "lancer", "front_right", null),
]), contentFor({ characterAp: { warden: 0, lancer: 1 } }));
const bannerGrant = bannerBattle.events.find((event) =>
  event.type === "resource_gained" && event.skillId === BANNER_R);
assert.deepEqual(bannerGrant?.targetActorIds, ["a_low_ap"]);
assert.ok(bannerGrant.tags.includes("banner_main_action"));
assert.ok(bannerBattle.events.some((event) =>
  event.type === "status_added"
  && event.ruleId === `${BANNER_A1}.banner_ap_focus`
  && event.targetActorIds.includes("a_low_ap")
  && event.values.statusId === "focused"),
"声を通す applies focus to the ally who received the banner AP");

// A higher base AP and an extra activation cannot turn 号令 into an AP loop:
// the actor may execute this banner main action once per round.
const bannerRoundLimitBattle = simulateBattle(battle("stage5f_banner_once_per_round", [
  ally("a_genzo", "mender", "front_left", BANNER_R),
  ally("a_ally", "warden", "front_center", null),
]), contentFor({ characterAp: { mender: 2 } }), { maxActivationsPerActorPerRound: 2 });
assert.equal(bannerRoundLimitBattle.events.filter((event) =>
  event.type === "resource_gained" && event.skillId === BANNER_R).length, 1,
"号令 can grant AP only once in a round even when the actor has another activation");

// When AP ties, a preparing ally wins before formation order. The one-action
// round limit leaves its preparation pending until the banner's next turn.
const prepPriorityBattle = simulateBattle(battle("stage5f_banner_prep_priority", [
  ally("a_genzo", "mender", "front_left", BANNER_R, [BANNER_A1]),
  ally("a_preparing", "warden", "front_center", CROSSBOW_R),
  ally("a_not_preparing", "lancer", "front_right", null),
], 2), contentFor(), { maxActivationsPerActorPerRound: 1 });
const roundTwoGrant = prepPriorityBattle.events.find((event) =>
  event.type === "resource_gained" && event.skillId === BANNER_R && event.round === 2);
assert.deepEqual(roundTwoGrant?.targetActorIds, ["a_preparing"]);

// Heavy crossbow R waits for one activation, then fires the nearest living
// target for 200% might. A1 boosts prepared damage regardless of weapon.
const crossbowBattle = simulateBattle(battle("stage5f_heavy_crossbow", [
  ally("a_genzo", "mender", "front_left", CROSSBOW_R, [CROSSBOW_A1], { might: 50 }),
], 2), contentFor());
assert.ok(crossbowBattle.events.some((event) =>
  event.type === "preparation_started" && event.skillId === CROSSBOW_R
  && event.values.steps === 1));
assert.ok(crossbowBattle.events.some((event) =>
  event.type === "preparation_completed" && event.skillId === CROSSBOW_R));
const loadedShot = crossbowBattle.events.find((event) =>
  event.type === "damage_proposed" && event.skillId === CROSSBOW_R);
assert.ok(loadedShot?.tags.includes("prepared_attack"));
const loadedShotBonus = crossbowBattle.events.find((event) =>
  event.type === "pending_amount_modified" && event.sourceDefinitionId === CROSSBOW_A1);
assert.ok(loadedShotBonus && loadedShotBonus.values.after > loadedShotBonus.values.before,
  "強弦 boosts damage completed from preparation");

console.log("weapon runtime Stage 5f starters: dual blades, banner, and heavy crossbow pass");
