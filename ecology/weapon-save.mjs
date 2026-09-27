// Stage 3d — versioned save boundaries for the new weapon-skill Profile and Run.
//
// These documents intentionally contain only the Stage 3 migration state. They
// do not adapt legacy saves: unknown fields and unsupported versions are errors.

import {
  freshWeaponPackProfile,
  validateWeaponPackManifest,
  validateWeaponPackProfile,
  availableWeaponSkillNodeKeys,
  makeWeaponPackManifest,
} from "./weapon-pack-manifest.mjs";
import { freshWeaponSkillLoadout, validateWeaponSkillLoadout } from "./weapon-loadout.mjs";
import {
  freshWeaponSkillProgression,
  validateWeaponSkillProgression,
} from "./weapon-progression.mjs";
import {
  freshWeaponRunBattleState,
  validateWeaponRunBattleState,
} from "./weapon-run-battle-state.mjs";

export const WEAPON_PROFILE_SCHEMA_VERSION = "ecology-weapon-profile-1";
export const WEAPON_RUN_SCHEMA_VERSION = "ecology-weapon-run-2";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function validIdentifier(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUniqueRoster(characterIds) {
  return Array.isArray(characterIds)
    && characterIds.length > 0
    && characterIds.every(validIdentifier)
    && new Set(characterIds).size === characterIds.length;
}

function firstFailure(errors, fallbackCode) {
  const error = errors[0];
  return { ok: false, code: error?.code ?? fallbackCode, reason: error?.message ?? "保存状態が不正です。", errors };
}

export function freshWeaponProfile({ profileId, unlockedSkillPackIds = [], unlockedEquipmentPackIds = [] } = {}) {
  if (!validIdentifier(profileId)) throw new TypeError("profileIdは空でない文字列が必要です。");
  const packUnlocks = freshWeaponPackProfile({ unlockedSkillPackIds, unlockedEquipmentPackIds });
  return {
    schemaVersion: WEAPON_PROFILE_SCHEMA_VERSION,
    profileId,
    packUnlocks,
  };
}

export function validateWeaponProfile(profile) {
  const errors = [];
  if (!isRecord(profile)) {
    addError(errors, "invalid_profile", "$", "weapon Profileはオブジェクトである必要があります。");
    return { valid: false, errors };
  }
  if (profile.schemaVersion !== WEAPON_PROFILE_SCHEMA_VERSION) {
    addError(errors, "unsupported_version", "schemaVersion", "対応していないweapon Profile形式です。");
  }
  const allowedFields = new Set(["schemaVersion", "profileId", "packUnlocks"]);
  for (const field of Object.keys(profile)) {
    if (!allowedFields.has(field)) addError(errors, "unknown_profile_field", field, "このweapon Profile形式にない欄です。");
  }
  if (!validIdentifier(profile.profileId)) {
    addError(errors, "invalid_profile_id", "profileId", "profileIdは空でない文字列である必要があります。");
  }
  const packValidation = validateWeaponPackProfile(profile.packUnlocks);
  for (const error of packValidation.errors) {
    errors.push({ ...error, path: `packUnlocks.${error.path}` });
  }
  return { valid: errors.length === 0, errors };
}

export function freshWeaponRun({
  runId,
  profile,
  characterIds,
  seed,
  manifest,
  startingSkillKeysByCharacter = {},
  startingSkillPointsByCharacter = 0,
  battleState,
  formationByCharacter,
  equipmentByCharacter,
  currentHpByCharacter,
} = {}) {
  const profileValidation = validateWeaponProfile(profile);
  if (!profileValidation.valid) throw new TypeError(profileValidation.errors[0].message);
  if (!validIdentifier(runId)) throw new TypeError("runIdは空でない文字列が必要です。");
  if (!hasUniqueRoster(characterIds)) throw new TypeError("characterIdsは重複のない人物IDを1件以上含む配列が必要です。");

  const runManifest = manifest ?? createManifest(seed, profile);
  const manifestValidation = validateWeaponPackManifest(runManifest);
  if (!manifestValidation.valid) throw new TypeError(manifestValidation.errors[0].message);
  assertManifestUnlocked(runManifest, profile);
  const available = availableWeaponSkillNodeKeys(runManifest);
  const skillProgression = freshWeaponSkillProgression(characterIds, {
    startingSkillKeysByCharacter,
    startingSkillPointsByCharacter,
    availableSkillNodeKeys: available,
  });
  const runBattleState = battleState ?? freshWeaponRunBattleState(characterIds, {
    formationByCharacter,
    equipmentByCharacter,
    currentHpByCharacter,
  });
  const battleStateValidation = validateWeaponRunBattleState(runBattleState, { characterIds });
  if (!battleStateValidation.valid) throw new TypeError(battleStateValidation.errors[0].message);
  return {
    schemaVersion: WEAPON_RUN_SCHEMA_VERSION,
    runId,
    profileId: profile.profileId,
    characterIds: [...characterIds],
    manifest: runManifest,
    skillProgression,
    loadout: freshWeaponSkillLoadout(characterIds),
    battleState: runBattleState,
  };
}

function createManifest(seed, profile) {
  if (typeof seed !== "string" && !(typeof seed === "number" && Number.isFinite(seed))) {
    throw new TypeError("Manifest作成には有限数か文字列のseedが必要です。");
  }
  // A new expedition snapshots the profile's unlocked packs. Counts are bounded
  // by the unlocked lists in makeWeaponPackManifest.
  return makeWeaponPackManifest(String(seed), profile.packUnlocks);
}

function assertManifestUnlocked(manifest, profile) {
  const skillPacks = new Set(profile.packUnlocks.unlockedSkillPackIds);
  const equipmentPacks = new Set(profile.packUnlocks.unlockedEquipmentPackIds);
  if (manifest.enabledSkillPackIds.some((id) => !skillPacks.has(id))) {
    throw new TypeError("ManifestにProfile未解禁のskill packが含まれています。");
  }
  if (manifest.enabledEquipmentPackIds.some((id) => !equipmentPacks.has(id))) {
    throw new TypeError("ManifestにProfile未解禁のequipment packが含まれています。");
  }
}

export function validateWeaponRun(run, { profile } = {}) {
  const errors = [];
  if (!isRecord(run)) {
    addError(errors, "invalid_run", "$", "weapon Runはオブジェクトである必要があります。");
    return { valid: false, errors };
  }
  if (run.schemaVersion !== WEAPON_RUN_SCHEMA_VERSION) {
    addError(errors, "unsupported_version", "schemaVersion", "対応していないweapon Run形式です。");
  }
  const allowedFields = new Set([
    "schemaVersion", "runId", "profileId", "characterIds", "manifest", "skillProgression", "loadout",
    "battleState",
  ]);
  for (const field of Object.keys(run)) {
    if (!allowedFields.has(field)) addError(errors, "unknown_run_field", field, "このweapon Run形式にない欄です。");
  }
  if (!validIdentifier(run.runId)) addError(errors, "invalid_run_id", "runId", "runIdは空でない文字列である必要があります。");
  if (!validIdentifier(run.profileId)) addError(errors, "invalid_profile_id", "profileId", "profileIdは空でない文字列である必要があります。");
  if (!hasUniqueRoster(run.characterIds)) {
    addError(errors, "invalid_roster", "characterIds", "人物IDは重複のない、空でない文字列を1件以上含む配列が必要です。");
  }

  const profileValidation = profile === undefined ? null : validateWeaponProfile(profile);
  if (profileValidation && !profileValidation.valid) {
    errors.push(...profileValidation.errors.map((error) => ({ ...error, path: `profile.${error.path}` })));
  } else if (profile && run.profileId !== profile.profileId) {
    addError(errors, "profile_mismatch", "profileId", "Runが参照するProfileと一致しません。");
  }

  const manifestValidation = validateWeaponPackManifest(run.manifest);
  errors.push(...manifestValidation.errors.map((error) => ({ ...error, path: `manifest.${error.path}` })));
  if (manifestValidation.valid && profileValidation?.valid) {
    const unlockedSkillPacks = new Set(profile.packUnlocks.unlockedSkillPackIds);
    const unlockedEquipmentPacks = new Set(profile.packUnlocks.unlockedEquipmentPackIds);
    if (run.manifest.enabledSkillPackIds.some((id) => !unlockedSkillPacks.has(id))) {
      addError(errors, "pack_not_unlocked", "manifest.enabledSkillPackIds", "ManifestにProfile未解禁のskill packがあります。");
    }
    if (run.manifest.enabledEquipmentPackIds.some((id) => !unlockedEquipmentPacks.has(id))) {
      addError(errors, "pack_not_unlocked", "manifest.enabledEquipmentPackIds", "ManifestにProfile未解禁のequipment packがあります。");
    }
  }

  if (hasUniqueRoster(run.characterIds) && manifestValidation.valid) {
    const battleStateValidation = validateWeaponRunBattleState(run.battleState, {
      characterIds: run.characterIds,
    });
    errors.push(...battleStateValidation.errors.map((error) => ({
      ...error,
      path: `battleState.${error.path}`,
    })));
    const available = availableWeaponSkillNodeKeys(run.manifest);
    const progressionValidation = validateWeaponSkillProgression(run.skillProgression, {
      characterIds: run.characterIds,
      availableSkillNodeKeys: available,
    });
    errors.push(...progressionValidation.errors.map((error) => ({ ...error, path: `skillProgression.${error.path}` })));
    const unlocked = progressionValidation.valid
      ? run.skillProgression.unlockedSkillKeysByCharacter
      : undefined;
    const loadoutValidation = validateWeaponSkillLoadout(run.loadout, {
      characterIds: run.characterIds,
      unlockedSkillKeysByCharacter: unlocked,
    });
    errors.push(...loadoutValidation.errors.map((error) => ({ ...error, path: `loadout.${error.path}` })));
  }
  return { valid: errors.length === 0, errors };
}

export function serializeWeaponProfile(profile) {
  const validation = validateWeaponProfile(profile);
  return validation.valid
    ? { ok: true, json: JSON.stringify(profile) }
    : firstFailure(validation.errors, "invalid_profile");
}

export function deserializeWeaponProfile(serialized) {
  const parsed = parseSerialized(serialized);
  if (!parsed.ok) return parsed;
  const validation = validateWeaponProfile(parsed.value);
  return validation.valid
    ? { ok: true, profile: parsed.value }
    : firstFailure(validation.errors, "invalid_profile");
}

export function serializeWeaponRun(run, { profile } = {}) {
  if (profile === undefined) {
    return { ok: false, code: "missing_profile_context", reason: "Runを検証するProfileが必要です。", errors: [] };
  }
  const validation = validateWeaponRun(run, { profile });
  return validation.valid
    ? { ok: true, json: JSON.stringify(run) }
    : firstFailure(validation.errors, "invalid_run");
}

export function deserializeWeaponRun(serialized, { profile } = {}) {
  if (profile === undefined) {
    return { ok: false, code: "missing_profile_context", reason: "Runを検証するProfileが必要です。", errors: [] };
  }
  const parsed = parseSerialized(serialized);
  if (!parsed.ok) return parsed;
  const validation = validateWeaponRun(parsed.value, { profile });
  return validation.valid
    ? { ok: true, run: parsed.value }
    : firstFailure(validation.errors, "invalid_run");
}

function parseSerialized(serialized) {
  if (typeof serialized !== "string") {
    return { ok: false, code: "invalid_serialized_value", reason: "保存データはJSON文字列である必要があります。", errors: [] };
  }
  try {
    return { ok: true, value: JSON.parse(serialized) };
  } catch {
    return { ok: false, code: "invalid_json", reason: "保存データをJSONとして読めません。", errors: [] };
  }
}
