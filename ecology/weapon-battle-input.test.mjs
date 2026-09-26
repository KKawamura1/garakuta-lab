import assert from "node:assert/strict";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import { prologueEncounter } from "./playable-battles.mjs";
import { WEAPON_SKILL_NODES, weaponSkillNodeKey } from "./weapon-loadout.mjs";
import { WEAPON_SKILL_PACKS, makeWeaponPackManifest } from "./weapon-pack-manifest.mjs";
import { freshWeaponProfile, freshWeaponRun, serializeWeaponRun, deserializeWeaponRun } from "./weapon-save.mjs";
import { addWeaponPrioritySkill, selectPrimaryWeaponSkill } from "./weapon-loadout.mjs";
import { unlockWeaponSkill } from "./weapon-progression.mjs";
import {
  STAGE_5_DEFAULT_PRIMARY_SKILL_BY_CHARACTER,
  STAGE_5_STARTER_SKILL_KEYS_BY_CHARACTER,
  STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-stage5.mjs";
import { buildWeaponBattleInput, forecastWeaponBattle, simulateWeaponBattle } from "./weapon-battle-input.mjs";
import { weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";

const characterIds = Object.keys(STAGE_5_STARTER_SKILL_KEYS_BY_CHARACTER);
const profile = freshWeaponProfile({
  profileId: "profile_stage5g",
  unlockedSkillPackIds: WEAPON_SKILL_PACKS.map(({ id }) => id),
});
const manifest = makeWeaponPackManifest("stage5g_seed", profile.packUnlocks, {
  skillPackCount: WEAPON_SKILL_PACKS.length,
  equipmentPackCount: 0,
});
let run = freshWeaponRun({
  runId: "run_stage5g",
  profile,
  characterIds,
  seed: manifest.seed,
  manifest,
  startingSkillKeysByCharacter: STAGE_5_STARTER_SKILL_KEYS_BY_CHARACTER,
});

for (const characterId of characterIds) {
  const selection = selectPrimaryWeaponSkill(
    run.loadout,
    characterId,
    STAGE_5_DEFAULT_PRIMARY_SKILL_BY_CHARACTER[characterId],
    run.skillProgression.unlockedSkillKeysByCharacter,
  );
  assert.equal(selection.ok, true);
  run.loadout = selection.loadout;
}
const medicalReactive = addWeaponPrioritySkill(
  run.loadout,
  "mender",
  "medical_kit:A1",
  run.skillProgression.unlockedSkillKeysByCharacter,
);
assert.equal(medicalReactive.ok, true);
run.loadout = medicalReactive.loadout;

run.battleState.equipmentByCharacter.warden = [
  { instanceId: "gear_warden_splinter", equipmentId: "splinter_edge", durability: 1 },
];
run.battleState.equipmentByCharacter.mender = [
  { instanceId: "gear_mender_worn", equipmentId: "worn_greaves", durability: 0 },
];
run.battleState.formationByCharacter = {
  warden: "front_left",
  mender: "rear_right",
  lancer: "front_center",
  guardian: "rear_center",
  tactician: "rear_left",
};
run.battleState.currentHpByCharacter.warden = PLAYABLE_CONTENT.characters.warden.maxHp - 1;

const roundTrip = serializeWeaponRun(run, { profile });
assert.equal(roundTrip.ok, true, roundTrip.reason);
assert.deepEqual(deserializeWeaponRun(roundTrip.json, { profile }), { ok: true, run });

const built = buildWeaponBattleInput({ run, profile, composed: prologueEncounter() });
assert.deepEqual(built.battleInput.allies.map(({ characterId, position }) => [characterId, position]), [
  ["warden", "front_left"],
  ["mender", "rear_right"],
  ["lancer", "front_center"],
  ["guardian", "rear_center"],
  ["tactician", "rear_left"],
]);
assert.deepEqual(built.battleInput.allies[0].equipment, [
  { instanceId: "gear_warden_splinter", equipmentId: "splinter_edge", durability: 1 },
]);
assert.deepEqual(built.battleInput.allies[1].equipment, [
  { instanceId: "gear_mender_worn", equipmentId: "worn_greaves", durability: 0 },
]);
assert.equal(built.battleInput.allies[0].hp, PLAYABLE_CONTENT.characters.warden.maxHp - 1);
assert.deepEqual(built.battleInput.allies[1].reactiveSkillIds, [weaponSkillRuntimeId("medical_kit:A1")]);
assert.ok(built.battleInput.allies.every((ally) =>
  [...ally.tactics.map(({ activeSkillId }) => activeSkillId), ...ally.reactiveSkillIds, ...ally.passiveSkillIds]
    .every((id) => id.startsWith("weapon."))));
assert.ok(built.battleInput.allies.every((ally) => !Object.hasOwn(ally, "skillLevels")));

const firstLive = simulateWeaponBattle({ run, profile, composed: prologueEncounter() });
const secondLive = simulateWeaponBattle({ run, profile, composed: prologueEncounter() });
const forecast = forecastWeaponBattle({ run, profile, composed: prologueEncounter() });
assert.deepEqual(firstLive.battleInput, forecast.battleInput);
assert.deepEqual(firstLive.result, forecast.result);
assert.deepEqual(firstLive.result, secondLive.result, "same Run/Encounter gives the same result and event stream");

const lockedButManifestAvailable = unlockWeaponSkill(
  {
    ...run.skillProgression,
    skillPointsByCharacter: { ...run.skillProgression.skillPointsByCharacter, warden: 1 },
  },
  "warden",
  weaponSkillNodeKey("warhammer", "A2"),
  Object.keys(WEAPON_SKILL_NODES),
);
assert.equal(lockedButManifestAvailable.ok, true);
const leakedRun = {
  ...run,
  skillProgression: lockedButManifestAvailable.progression,
};
assert.throws(() => buildWeaponBattleInput({ run: leakedRun, profile, composed: prologueEncounter() }), /未実装.*BattleInput/);

const mismatchedEquipment = structuredClone(run);
mismatchedEquipment.battleState.equipmentByCharacter.warden[0].equipmentId = "not_in_content";
assert.throws(() => buildWeaponBattleInput({ run: mismatchedEquipment, profile, composed: prologueEncounter() }), /装備の定義がBattle contentにありません/);

const badDefault = structuredClone(run);
badDefault.loadout.primarySkillByCharacter.tactician = null;
assert.throws(() => buildWeaponBattleInput({ run: badDefault, profile, composed: prologueEncounter() }), /主軸技能を選んでください/);

assert.equal(Object.keys(STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries).length, 20);
console.log("weapon battle input: strict new Run → exact Stage 5 registry → shared deterministic engine path");
