// Stage 3c — isolated registries and manifest selection for weapon skills and gear.
//
// The live game still uses the legacy pack manifest. This migration contract
// gives each domain a separate ID namespace, profile list, random draw, and
// manifest field so later runtime work cannot accidentally mix the pools.

import { AFFIX_FAMILIES } from "./content/affixes.mjs";
import { WEAPON_SKILL_NODES } from "./weapon-loadout.mjs";
import { WEAPON_SKILL_SPECIFICATIONS } from "./content/weapon-specifications.mjs";
import { seededShuffle, seedKey } from "./seeded.mjs";

export const WEAPON_PACK_PROFILE_SCHEMA_VERSION = "ecology-weapon-pack-profile-1";
export const WEAPON_PACK_MANIFEST_SCHEMA_VERSION = "ecology-weapon-pack-manifest-1";
export const WEAPON_SKILL_PACK_PREFIX = "skill:";
export const EQUIPMENT_PACK_PREFIX = "equipment:";
export const WEAPON_SKILL_PACKS_PER_MANIFEST = 3;
export const EQUIPMENT_PACKS_PER_MANIFEST = 3;

const weaponIds = [...new Set(WEAPON_SKILL_SPECIFICATIONS.map(({ weaponId }) => weaponId))];

export const WEAPON_SKILL_PACKS = Object.freeze(weaponIds.map((weaponId) => Object.freeze({
  id: `${WEAPON_SKILL_PACK_PREFIX}${weaponId}`,
  kind: "skill",
  weaponId,
  nodeKeys: Object.freeze(Object.values(WEAPON_SKILL_NODES)
    .filter((node) => node.weaponId === weaponId)
    .map((node) => node.key)),
})));

// Equipment packs are affix-family pools. family_scar is shared gear vocabulary
// and remains available in every manifest, so it does not need a selectable pack.
export const EQUIPMENT_PACKS = Object.freeze(AFFIX_FAMILIES
  .filter((family) => family.packId !== null)
  .map((family) => Object.freeze({
    id: `${EQUIPMENT_PACK_PREFIX}${family.id}`,
    kind: "equipment",
    familyId: family.id,
    displayName: family.displayName,
  })));

export const WEAPON_SKILL_PACK_BY_ID = Object.freeze(
  Object.fromEntries(WEAPON_SKILL_PACKS.map((pack) => [pack.id, pack])),
);
export const EQUIPMENT_PACK_BY_ID = Object.freeze(
  Object.fromEntries(EQUIPMENT_PACKS.map((pack) => [pack.id, pack])),
);

const SKILL_PACK_IDS = new Set(WEAPON_SKILL_PACKS.map((pack) => pack.id));
const EQUIPMENT_PACK_IDS = new Set(EQUIPMENT_PACKS.map((pack) => pack.id));
const ALL_PACK_IDS = new Set([...SKILL_PACK_IDS, ...EQUIPMENT_PACK_IDS]);
const EQUIPMENT_FAMILY_IDS = new Set(AFFIX_FAMILIES.map((family) => family.id));
const UNIVERSAL_EQUIPMENT_FAMILY_ID = "family_scar";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function validateIdList(value, allowedIds, path, errors) {
  if (!Array.isArray(value)) {
    addError(errors, "invalid_pack_list", path, "pack一覧は配列である必要があります。");
    return;
  }
  const seen = new Set();
  value.forEach((id, index) => {
    const entryPath = `${path}[${index}]`;
    if (typeof id !== "string" || !allowedIds.has(id)) {
      addError(errors, "wrong_pack_kind", entryPath, "このpack種別に属する既知のIDではありません。");
      return;
    }
    if (seen.has(id)) addError(errors, "duplicate_pack", entryPath, "同じpackが重複しています。");
    seen.add(id);
  });
}

export function freshWeaponPackProfile({
  unlockedSkillPackIds = [],
  unlockedEquipmentPackIds = [],
} = {}) {
  const profile = {
    schemaVersion: WEAPON_PACK_PROFILE_SCHEMA_VERSION,
    unlockedSkillPackIds: [...unlockedSkillPackIds],
    unlockedEquipmentPackIds: [...unlockedEquipmentPackIds],
  };
  const validation = validateWeaponPackProfile(profile);
  if (!validation.valid) throw new TypeError(validation.errors[0].message);
  return profile;
}

export function validateWeaponPackProfile(profile) {
  const errors = [];
  if (!isRecord(profile)) {
    addError(errors, "invalid_pack_profile", "$", "pack Profileはオブジェクトである必要があります。");
    return { valid: false, errors };
  }
  if (profile.schemaVersion !== WEAPON_PACK_PROFILE_SCHEMA_VERSION) {
    addError(errors, "unsupported_version", "schemaVersion", "対応していないpack Profile形式です。");
  }
  const allowedFields = new Set([
    "schemaVersion", "unlockedSkillPackIds", "unlockedEquipmentPackIds",
  ]);
  for (const field of Object.keys(profile)) {
    if (!allowedFields.has(field)) addError(errors, "unknown_profile_field", field, "このProfile形式にない欄です。");
  }
  validateIdList(profile.unlockedSkillPackIds, SKILL_PACK_IDS, "unlockedSkillPackIds", errors);
  validateIdList(profile.unlockedEquipmentPackIds, EQUIPMENT_PACK_IDS, "unlockedEquipmentPackIds", errors);
  return { valid: errors.length === 0, errors };
}

function checkedProfile(profile) {
  const validation = validateWeaponPackProfile(profile);
  if (!validation.valid) throw new TypeError(validation.errors[0].message);
}

export function makeWeaponPackManifest(seed, profile, {
  skillPackCount = WEAPON_SKILL_PACKS_PER_MANIFEST,
  equipmentPackCount = EQUIPMENT_PACKS_PER_MANIFEST,
} = {}) {
  checkedProfile(profile);
  if (!Number.isSafeInteger(skillPackCount) || skillPackCount < 0
    || !Number.isSafeInteger(equipmentPackCount) || equipmentPackCount < 0) {
    throw new TypeError("skillPackCountとequipmentPackCountは0以上の整数が必要です。");
  }
  const seedText = String(seed);
  const enabledSkillPackIds = seededShuffle(
    profile.unlockedSkillPackIds,
    seedKey(seedText, "weapon-skill-pack-manifest", 0),
  ).slice(0, skillPackCount);
  const enabledEquipmentPackIds = seededShuffle(
    profile.unlockedEquipmentPackIds,
    seedKey(seedText, "equipment-pack-manifest", 0),
  ).slice(0, equipmentPackCount);
  return {
    schemaVersion: WEAPON_PACK_MANIFEST_SCHEMA_VERSION,
    seed: seedText,
    enabledSkillPackIds,
    enabledEquipmentPackIds,
  };
}

export function validateWeaponPackManifest(manifest) {
  const errors = [];
  if (!isRecord(manifest)) {
    addError(errors, "invalid_pack_manifest", "$", "pack Manifestはオブジェクトである必要があります。");
    return { valid: false, errors };
  }
  if (manifest.schemaVersion !== WEAPON_PACK_MANIFEST_SCHEMA_VERSION) {
    addError(errors, "unsupported_version", "schemaVersion", "対応していないpack Manifest形式です。");
  }
  const allowedFields = new Set([
    "schemaVersion", "seed", "enabledSkillPackIds", "enabledEquipmentPackIds",
  ]);
  for (const field of Object.keys(manifest)) {
    if (!allowedFields.has(field)) addError(errors, "unknown_manifest_field", field, "このManifest形式にない欄です。");
  }
  if (typeof manifest.seed !== "string") {
    addError(errors, "invalid_manifest_seed", "seed", "seedは文字列である必要があります。");
  }
  validateIdList(manifest.enabledSkillPackIds, SKILL_PACK_IDS, "enabledSkillPackIds", errors);
  validateIdList(manifest.enabledEquipmentPackIds, EQUIPMENT_PACK_IDS, "enabledEquipmentPackIds", errors);
  return { valid: errors.length === 0, errors };
}

function checkedManifest(manifest) {
  const validation = validateWeaponPackManifest(manifest);
  if (!validation.valid) throw new TypeError(validation.errors[0].message);
}

export function availableWeaponSkillNodeKeys(manifest) {
  checkedManifest(manifest);
  return manifest.enabledSkillPackIds.flatMap((packId) => WEAPON_SKILL_PACK_BY_ID[packId].nodeKeys);
}

export function enabledEquipmentAffixFamilyIds(manifest) {
  checkedManifest(manifest);
  const enabled = new Set([UNIVERSAL_EQUIPMENT_FAMILY_ID]);
  for (const packId of manifest.enabledEquipmentPackIds) {
    const familyId = EQUIPMENT_PACK_BY_ID[packId].familyId;
    if (!EQUIPMENT_FAMILY_IDS.has(familyId)) throw new Error(`Unknown equipment family: ${familyId}`);
    enabled.add(familyId);
  }
  return AFFIX_FAMILIES.filter((family) => enabled.has(family.id)).map((family) => family.id);
}

export function skillPackIdForWeaponId(weaponId) {
  const id = `${WEAPON_SKILL_PACK_PREFIX}${weaponId}`;
  return Object.hasOwn(WEAPON_SKILL_PACK_BY_ID, id) ? id : null;
}

export function equipmentPackIdForFamilyId(familyId) {
  const id = `${EQUIPMENT_PACK_PREFIX}${familyId}`;
  return Object.hasOwn(EQUIPMENT_PACK_BY_ID, id) ? id : null;
}

if (ALL_PACK_IDS.size !== WEAPON_SKILL_PACKS.length + EQUIPMENT_PACKS.length) {
  throw new Error("Skill pack and equipment pack identifiers must be unique across registries.");
}
