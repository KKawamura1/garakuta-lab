import assert from "node:assert/strict";
import { AFFIX_FAMILIES } from "./content/affixes.mjs";
import { WEAPON_SKILL_NODES, weaponSkillNodeKey } from "./weapon-loadout.mjs";
import {
  EQUIPMENT_PACKS,
  EQUIPMENT_PACK_PREFIX,
  WEAPON_PACK_MANIFEST_SCHEMA_VERSION,
  WEAPON_PACK_PROFILE_SCHEMA_VERSION,
  WEAPON_SKILL_PACKS,
  WEAPON_SKILL_PACK_PREFIX,
  availableWeaponSkillNodeKeys,
  enabledEquipmentAffixFamilyIds,
  equipmentPackIdForFamilyId,
  freshWeaponPackProfile,
  makeWeaponPackManifest,
  skillPackIdForWeaponId,
  validateWeaponPackManifest,
  validateWeaponPackProfile,
} from "./weapon-pack-manifest.mjs";
import { freshWeaponSkillProgression, unlockWeaponSkill } from "./weapon-progression.mjs";

assert.equal(WEAPON_PACK_PROFILE_SCHEMA_VERSION, "ecology-weapon-pack-profile-1");
assert.equal(WEAPON_PACK_MANIFEST_SCHEMA_VERSION, "ecology-weapon-pack-manifest-1");
assert.equal(WEAPON_SKILL_PACKS.length, 10);
assert.equal(EQUIPMENT_PACKS.length, AFFIX_FAMILIES.filter(({ packId }) => packId !== null).length);
assert.ok(WEAPON_SKILL_PACKS.every(({ id }) => id.startsWith(WEAPON_SKILL_PACK_PREFIX)));
assert.ok(EQUIPMENT_PACKS.every(({ id }) => id.startsWith(EQUIPMENT_PACK_PREFIX)));
assert.equal(new Set([...WEAPON_SKILL_PACKS, ...EQUIPMENT_PACKS].map(({ id }) => id)).size,
  WEAPON_SKILL_PACKS.length + EQUIPMENT_PACKS.length);

const allSkillPackIds = WEAPON_SKILL_PACKS.map(({ id }) => id);
const allEquipmentPackIds = EQUIPMENT_PACKS.map(({ id }) => id);
const profile = freshWeaponPackProfile({
  unlockedSkillPackIds: allSkillPackIds,
  unlockedEquipmentPackIds: allEquipmentPackIds,
});
assert.equal(validateWeaponPackProfile(profile).valid, true);

const manifest = makeWeaponPackManifest("pack-separation-seed", profile);
assert.equal(manifest.enabledSkillPackIds.length, 3);
assert.equal(manifest.enabledEquipmentPackIds.length, 3);
assert.equal(validateWeaponPackManifest(manifest).valid, true);
assert.deepEqual(manifest, makeWeaponPackManifest("pack-separation-seed", profile), "同じseedは同じpackを選ぶ");
assert.equal(manifest.enabledSkillPackIds.every((id) => id in Object.fromEntries(WEAPON_SKILL_PACKS.map((pack) => [pack.id, true]))), true);
assert.equal(manifest.enabledEquipmentPackIds.every((id) => id in Object.fromEntries(EQUIPMENT_PACKS.map((pack) => [pack.id, true]))), true);

const selectedProfileVariant = freshWeaponPackProfile({
  unlockedSkillPackIds: profile.unlockedSkillPackIds,
  unlockedEquipmentPackIds: [allEquipmentPackIds[0]],
});
const selectedVariantManifest = makeWeaponPackManifest("pack-separation-seed", selectedProfileVariant);
assert.deepEqual(selectedVariantManifest.enabledSkillPackIds, manifest.enabledSkillPackIds,
  "装備pack poolの変化で技能pack抽選を動かさない");
assert.deepEqual(selectedVariantManifest.enabledEquipmentPackIds, [allEquipmentPackIds[0]]);

const selectedSkillPackIds = [skillPackIdForWeaponId("warhammer")];
const selectedEquipmentPackIds = [equipmentPackIdForFamilyId("family_edge")];
const focusedProfile = freshWeaponPackProfile({
  unlockedSkillPackIds: selectedSkillPackIds,
  unlockedEquipmentPackIds: selectedEquipmentPackIds,
});
const focusedManifest = makeWeaponPackManifest("focused", focusedProfile);
const availableKeys = availableWeaponSkillNodeKeys(focusedManifest);
assert.equal(availableKeys.length, 19);
assert.ok(availableKeys.every((key) => key.startsWith("warhammer:")));
assert.deepEqual(enabledEquipmentAffixFamilyIds(focusedManifest), ["family_edge", "family_scar"]);
assert.ok(!availableKeys.some((key) => AFFIX_FAMILIES.some(({ id }) => id === key)));

const starterKeys = [weaponSkillNodeKey("warhammer", "R"), weaponSkillNodeKey("warhammer", "A1")];
const progression = freshWeaponSkillProgression(["gou"], {
  startingSkillKeysByCharacter: { gou: starterKeys },
  startingSkillPointsByCharacter: 1,
  availableSkillNodeKeys: availableKeys,
});
const availableAcquire = unlockWeaponSkill(progression, "gou", weaponSkillNodeKey("warhammer", "A2"), availableKeys);
const unavailableAcquire = unlockWeaponSkill(progression, "gou", weaponSkillNodeKey("dual_blades", "R"), availableKeys);
assert.equal(availableAcquire.ok, true, "武器技能Manifestが選んだ武器の節は取得できる");
assert.equal(unavailableAcquire.code, "skill_not_available", "選ばれていない武器の節は取得できない");

const wrongProfileKind = {
  ...profile,
  unlockedEquipmentPackIds: [allSkillPackIds[0]],
};
assert.ok(validateWeaponPackProfile(wrongProfileKind).errors.some((error) => error.code === "wrong_pack_kind"));
const oldMixedProfile = { ...profile, unlockedPackIds: ["pack_edge"] };
assert.ok(validateWeaponPackProfile(oldMixedProfile).errors.some((error) => error.code === "unknown_profile_field"));
assert.ok(validateWeaponPackProfile({ ...profile, schemaVersion: "ecology-weapon-pack-profile-0" })
  .errors.some((error) => error.code === "unsupported_version"));

const wrongManifestKind = { ...manifest, enabledSkillPackIds: [allEquipmentPackIds[0]] };
assert.ok(validateWeaponPackManifest(wrongManifestKind).errors.some((error) => error.code === "wrong_pack_kind"));
assert.throws(() => availableWeaponSkillNodeKeys(wrongManifestKind), /種別/);
assert.throws(() => enabledEquipmentAffixFamilyIds({
  ...manifest, enabledEquipmentPackIds: [allSkillPackIds[0]],
}), /種別/);
assert.throws(() => makeWeaponPackManifest("seed", profile, { skillPackCount: -1 }), /整数/);
assert.equal(skillPackIdForWeaponId("missing_weapon"), null);
assert.equal(equipmentPackIdForFamilyId("family_scar"), null, "共有familyは選択式packにしない");

console.log("weapon pack manifest: independent profile registries, random draws, available skills, and affix families");
