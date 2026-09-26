import assert from "node:assert/strict";
import { weaponSkillNodeKey } from "./weapon-loadout.mjs";
import {
  freshWeaponProfile,
  freshWeaponRun,
  deserializeWeaponProfile,
  deserializeWeaponRun,
  serializeWeaponProfile,
  serializeWeaponRun,
  validateWeaponProfile,
  validateWeaponRun,
  WEAPON_PROFILE_SCHEMA_VERSION,
  WEAPON_RUN_SCHEMA_VERSION,
} from "./weapon-save.mjs";
import { WEAPON_SKILL_PACKS } from "./weapon-pack-manifest.mjs";
import { selectPrimaryWeaponSkill, addWeaponPrioritySkill } from "./weapon-loadout.mjs";
import { availableWeaponSkillNodeKeys } from "./weapon-pack-manifest.mjs";
import { unlockWeaponSkill } from "./weapon-progression.mjs";

const profile = freshWeaponProfile({
  profileId: "profile-stage-3d",
  unlockedSkillPackIds: ["skill:warhammer"],
  unlockedEquipmentPackIds: ["equipment:family_edge"],
});
assert.equal(WEAPON_PROFILE_SCHEMA_VERSION, "ecology-weapon-profile-1");
assert.equal(WEAPON_RUN_SCHEMA_VERSION, "ecology-weapon-run-2");
assert.equal(WEAPON_SKILL_PACKS.length, 10);
assert.equal(validateWeaponProfile(profile).valid, true);

const profileRoundTrip = serializeWeaponProfile(profile);
assert.equal(profileRoundTrip.ok, true);
assert.deepEqual(deserializeWeaponProfile(profileRoundTrip.json), { ok: true, profile });
assert.equal(deserializeWeaponProfile("{").code, "invalid_json");
assert.equal(deserializeWeaponProfile({ schemaVersion: WEAPON_PROFILE_SCHEMA_VERSION }).code, "invalid_serialized_value");
assert.equal(deserializeWeaponProfile(JSON.stringify({
  ...profile,
  schemaVersion: "ecology-weapon-profile-0",
})).code, "unsupported_version");
assert.ok(validateWeaponProfile({ ...profile, unlockedPackIds: ["pack_edge"] })
  .errors.some((error) => error.code === "unknown_profile_field"));

const characterIds = ["gou", "tsugumi"];
const starters = [weaponSkillNodeKey("warhammer", "R"), weaponSkillNodeKey("warhammer", "A1")];
const run = freshWeaponRun({
  runId: "run-stage-3d",
  profile,
  characterIds,
  seed: "save-roundtrip",
  startingSkillKeysByCharacter: { gou: starters, tsugumi: starters },
  startingSkillPointsByCharacter: 1,
});
const acquiredA2 = unlockWeaponSkill(
  run.skillProgression,
  "gou",
  weaponSkillNodeKey("warhammer", "A2"),
  availableWeaponSkillNodeKeys(run.manifest),
);
assert.equal(acquiredA2.ok, true);
run.skillProgression = acquiredA2.progression;
let selected = selectPrimaryWeaponSkill(
  run.loadout, "gou", weaponSkillNodeKey("warhammer", "R"), run.skillProgression.unlockedSkillKeysByCharacter,
);
assert.equal(selected.ok, true);
selected = addWeaponPrioritySkill(
  selected.loadout, "gou", weaponSkillNodeKey("warhammer", "A2"), run.skillProgression.unlockedSkillKeysByCharacter,
);
assert.equal(selected.ok, true);
run.loadout = selected.loadout;
assert.equal(validateWeaponRun(run, { profile }).valid, true);

const runRoundTrip = serializeWeaponRun(run, { profile });
assert.equal(runRoundTrip.ok, true);
assert.deepEqual(deserializeWeaponRun(runRoundTrip.json, { profile }), { ok: true, run });
assert.deepEqual(run.battleState.formationByCharacter, { gou: "front_left", tsugumi: "rear_right" });
assert.deepEqual(run.battleState.equipmentByCharacter, { gou: [], tsugumi: [] });
assert.deepEqual(run.battleState.currentHpByCharacter, { gou: null, tsugumi: null });
assert.equal(serializeWeaponRun(run).code, "missing_profile_context");
assert.equal(deserializeWeaponRun(runRoundTrip.json).code, "missing_profile_context");

const unsupportedRun = { ...run, schemaVersion: "ecology-weapon-run-0" };
assert.equal(deserializeWeaponRun(JSON.stringify(unsupportedRun), { profile }).code, "unsupported_version");
const previousRunSchema = { ...run, schemaVersion: "ecology-weapon-run-1" };
assert.equal(deserializeWeaponRun(JSON.stringify(previousRunSchema), { profile }).code, "unsupported_version");
const legacyRun = { ...run, skillLevels: { gou: { legacy_skill_id: 4 } } };
assert.ok(validateWeaponRun(legacyRun, { profile }).errors.some((error) => error.code === "unknown_run_field"));
const wrongProfileId = { ...run, profileId: "another-profile" };
assert.ok(validateWeaponRun(wrongProfileId, { profile }).errors.some((error) => error.code === "profile_mismatch"));
const wrongRoster = { ...run, characterIds: ["gou"] };
assert.ok(validateWeaponRun(wrongRoster, { profile }).errors.some((error) => error.code === "roster_mismatch"));
const duplicatePosition = {
  ...run,
  battleState: {
    ...run.battleState,
    formationByCharacter: { gou: "front_left", tsugumi: "front_left" },
  },
};
assert.ok(validateWeaponRun(duplicatePosition, { profile }).errors
  .some((error) => error.code === "duplicate_formation_position"));
const forbiddenSkill = {
  ...run,
  skillProgression: {
    ...run.skillProgression,
    unlockedSkillKeysByCharacter: {
      ...run.skillProgression.unlockedSkillKeysByCharacter,
      gou: [...run.skillProgression.unlockedSkillKeysByCharacter.gou, weaponSkillNodeKey("dual_blades", "R")],
    },
  },
};
assert.ok(validateWeaponRun(forbiddenSkill, { profile }).errors.some((error) => error.code === "skill_not_available"));
const mismatchedProfile = freshWeaponProfile({
  profileId: "profile-stage-3d",
  unlockedSkillPackIds: ["skill:dual_blades"],
  unlockedEquipmentPackIds: ["equipment:family_edge"],
});
assert.ok(validateWeaponRun(run, { profile: mismatchedProfile }).errors.some((error) => error.code === "pack_not_unlocked"));

console.log("weapon save: Profile and Run round-trip with strict independent versions and integrity checks");
