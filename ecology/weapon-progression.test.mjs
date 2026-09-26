import assert from "node:assert/strict";
import { WEAPON_SKILL_NODES, weaponSkillNodeKey } from "./weapon-loadout.mjs";
import {
  WEAPON_PROGRESSION_SCHEMA_VERSION,
  canFulfillWeaponSkillReservation,
  cancelWeaponSkillReservation,
  freshWeaponSkillProgression,
  grantWeaponSkillPointsForClear,
  reserveWeaponSkill,
  unlockWeaponSkill,
  validateWeaponSkillProgression,
  weaponSkillPrerequisiteKeys,
} from "./weapon-progression.mjs";

const available = Object.keys(WEAPON_SKILL_NODES);
const key = (position, weaponId = "warhammer") => weaponSkillNodeKey(weaponId, position);
const starter = [key("R"), key("A1")];
const progress = (points = 0) => freshWeaponSkillProgression(
  ["gou", "tsugumi"],
  {
    startingSkillKeysByCharacter: { gou: starter, tsugumi: starter },
    startingSkillPointsByCharacter: points,
    availableSkillNodeKeys: available,
  },
);

assert.equal(WEAPON_PROGRESSION_SCHEMA_VERSION, "ecology-weapon-progression-1");
assert.equal(available.length, 190, "取得対象はカタログの全190 node");
assert.deepEqual(weaponSkillPrerequisiteKeys(key("R")), []);
assert.deepEqual(weaponSkillPrerequisiteKeys(key("A1")), [key("R")]);
assert.deepEqual(weaponSkillPrerequisiteKeys(key("A2")), [key("A1")]);
assert.deepEqual(weaponSkillPrerequisiteKeys(key("AA1")), [key("A3")]);
assert.deepEqual(weaponSkillPrerequisiteKeys(key("BB1")), [key("B3")]);
assert.deepEqual(weaponSkillPrerequisiteKeys("legacy_skill_id"), null);
for (const node of Object.values(WEAPON_SKILL_NODES)) {
  const seen = new Set();
  let current = node.key;
  while (true) {
    assert.equal(seen.has(current), false, `${node.key} の前提が循環しない`);
    seen.add(current);
    const [parent] = weaponSkillPrerequisiteKeys(current) ?? [];
    if (!parent) {
      assert.equal(WEAPON_SKILL_NODES[current].position, "R", `${node.key} はRへつながる`);
      break;
    }
    assert.ok(WEAPON_SKILL_NODES[parent], `${parent} がカタログにある`);
    current = parent;
  }
}

let state = progress();
assert.deepEqual(state.unlockedSkillKeysByCharacter.gou, starter, "初期nodeだけを無料取得する");
assert.equal(state.skillPointsByCharacter.gou, 0);
assert.equal(state.skillReservationByCharacter.gou, null);
assert.equal("runSkillLevels" in state, false, "新しい技能進行はレベル値を持たない");
assert.equal("skillLevels" in state, false);
assert.equal(validateWeaponSkillProgression(state, { availableSkillNodeKeys: available }).valid, true);

assert.equal(unlockWeaponSkill(state, "gou", key("A3"), available).code, "missing_prerequisite");
assert.equal(unlockWeaponSkill(state, "gou", key("A2"), available).code, "not_enough_skill_points");
assert.equal(unlockWeaponSkill(state, "nagi", key("A2"), available).code, "unknown_character");
assert.equal(unlockWeaponSkill(state, "gou", key("A2"), [key("R"), key("A1")]).code, "skill_not_available");

const firstPoint = grantWeaponSkillPointsForClear(state, "stage_3:encounter_1", 1, available);
assert.equal(firstPoint.ok, true);
assert.equal(firstPoint.granted, true);
assert.equal(firstPoint.progression.skillPointsByCharacter.gou, 1);
assert.equal(firstPoint.progression.skillPointsByCharacter.tsugumi, 1);
const acquiredA2 = unlockWeaponSkill(firstPoint.progression, "gou", key("A2"), available);
assert.equal(acquiredA2.ok, true);
assert.equal(acquiredA2.progression.skillPointsByCharacter.gou, 0);
assert.equal(firstPoint.progression.unlockedSkillKeysByCharacter.gou.includes(key("A2")), false, "取得関数は入力を変更しない");
assert.equal(unlockWeaponSkill(acquiredA2.progression, "gou", key("A2"), available).code, "already_unlocked");
const acquiredOtherRoot = unlockWeaponSkill(progress(1), "gou", key("R", "dual_blades"), available);
assert.equal(acquiredOtherRoot.ok, true, "別武器の入口nodeも1点で取得できる");
assert.equal(acquiredOtherRoot.progression.skillPointsByCharacter.gou, 0);

let reserved = reserveWeaponSkill(state, "gou", key("AB3"), available);
assert.equal(reserved.ok, true);
assert.deepEqual(reserved.actions, []);
assert.equal(reserved.progression.skillReservationByCharacter.gou, key("AB3"));
assert.equal(reserved.progression.skillReservationByCharacter.tsugumi, null, "予約は人物ごとに独立する");
assert.equal(canFulfillWeaponSkillReservation(state, "gou", key("AB3"), available), false);
assert.equal(state.skillReservationByCharacter.gou, null, "充足予測で入力runを変更しない");

const partial = grantWeaponSkillPointsForClear(reserved.progression, "stage_3:encounter_2", 2, available);
assert.equal(partial.ok, true);
assert.deepEqual(partial.actions.map((entry) => entry.skillKey), [key("A2"), key("A3")]);
assert.equal(partial.progression.skillReservationByCharacter.gou, key("AB3"));
assert.deepEqual(partial.progression.unlockedSkillKeysByCharacter.gou, [...starter, key("A2"), key("A3")]);
assert.equal(partial.progression.skillPointsByCharacter.gou, 0);

const repeated = grantWeaponSkillPointsForClear(partial.progression, "stage_3:encounter_2", 3, available);
assert.equal(repeated.granted, false, "同一clearから技能点を二重付与しない");
assert.equal(repeated.progression.skillPointsByCharacter.gou, 0);
assert.deepEqual(repeated.actions, []);

const complete = grantWeaponSkillPointsForClear(partial.progression, "stage_3:encounter_3", 3, available);
assert.equal(complete.ok, true);
assert.deepEqual(complete.actions.map((entry) => entry.skillKey), [key("AB1"), key("AB2"), key("AB3")]);
assert.equal(complete.actions.every((entry) => entry.characterId === "gou"), true);
assert.equal(complete.progression.skillReservationByCharacter.gou, null);
assert.ok(complete.progression.unlockedSkillKeysByCharacter.gou.includes(key("AB3")));
assert.equal(complete.progression.skillPointsByCharacter.gou, 0);
assert.equal(canFulfillWeaponSkillReservation(progress(5), "gou", key("AB3"), available), true);
assert.equal(canFulfillWeaponSkillReservation(partial.progression, "gou", key("AB3"), available), false);

const cancelled = reserveWeaponSkill(state, "gou", key("A3"), available);
assert.equal(cancelled.ok, true);
assert.equal(cancelled.progression.skillReservationByCharacter.gou, key("A3"));
const cancelResult = cancelWeaponSkillReservation(cancelled.progression, "gou");
assert.equal(cancelResult.cancelled, true);
assert.equal(cancelResult.progression.skillReservationByCharacter.gou, null);
const replacement = reserveWeaponSkill(cancelled.progression, "gou", key("B3"), available);
assert.equal(replacement.ok, true);
assert.equal(replacement.progression.skillReservationByCharacter.gou, key("B3"), "予約は一人一件で差し替え可能");
assert.equal(reserveWeaponSkill(state, "gou", key("A3"), [key("R"), key("A1"), key("A3")]).code, "prerequisite_not_available");
assert.equal(reserveWeaponSkill(state, "gou", key("A3"), available).completed.length, 0);
assert.equal(reserveWeaponSkill(state, "gou", key("A3"), available).progression.skillReservationByCharacter.gou, key("A3"));
assert.equal(reserveWeaponSkill(state, "gou", key("R"), available).code, "already_unlocked");

const affordableState = progress(4);
const autoAcquired = reserveWeaponSkill(affordableState, "gou", key("AA2"), available);
assert.equal(autoAcquired.ok, true);
assert.deepEqual(autoAcquired.actions.map((entry) => entry.skillKey), [key("A2"), key("A3"), key("AA1"), key("AA2")]);
assert.equal(autoAcquired.completed[0].skillKey, key("AA2"));
assert.equal(autoAcquired.progression.skillPointsByCharacter.gou, 0);
assert.equal(autoAcquired.progression.skillReservationByCharacter.gou, null);

assert.throws(() => freshWeaponSkillProgression(["gou"], {
  startingSkillKeysByCharacter: { gou: [key("A1")] },
  availableSkillNodeKeys: available,
}), /前提/);
const invalidVersion = { ...state, schemaVersion: "ecology-weapon-progression-0" };
assert.ok(validateWeaponSkillProgression(invalidVersion).errors.some((error) => error.code === "unsupported_version"));
const legacyLevelField = { ...state, skillLevels: { gou: { legacy_skill_id: 10 } } };
assert.ok(validateWeaponSkillProgression(legacyLevelField).errors.some((error) => error.code === "unknown_progression_field"));
const wrongRoster = validateWeaponSkillProgression(state, { characterIds: ["gou"] });
assert.ok(wrongRoster.errors.some((error) => error.code === "roster_mismatch"));
const brokenClosure = {
  ...state,
  unlockedSkillKeysByCharacter: { ...state.unlockedSkillKeysByCharacter, gou: [key("A1")] },
};
assert.ok(validateWeaponSkillProgression(brokenClosure).errors.some((error) => error.code === "missing_prerequisite"));

console.log(`weapon progression: ${available.length} node DAG, no-level acquisition, one-target reservations and idempotent SP pass`);
