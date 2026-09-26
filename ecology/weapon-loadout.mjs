// Stage 3a — declarative loadout state for the weapon-skill system.
//
// Skills are addressed by their catalogue slot (`weaponId:position`) here.
// This deliberately does not import PR #288's legacy skill IDs or its runtime
// registry. The 190 specification rows are the only source for node kind.

import { WEAPON_SKILL_SPECIFICATIONS } from "./content/weapon-specifications.mjs";

export const WEAPON_LOADOUT_SCHEMA_VERSION = "ecology-weapon-loadout-1";

export function weaponSkillNodeKey(weaponId, position) {
  if (typeof weaponId !== "string" || !weaponId || typeof position !== "string" || !position) {
    throw new TypeError("weaponId と position は空でない文字列が必要です。");
  }
  return `${weaponId}:${position}`;
}

const nodeEntries = WEAPON_SKILL_SPECIFICATIONS.map((definition) => {
  const key = weaponSkillNodeKey(definition.weaponId, definition.position);
  return [key, Object.freeze({ ...definition, key })];
});

if (new Set(nodeEntries.map(([key]) => key)).size !== nodeEntries.length) {
  throw new Error("weapon skill specification に重複した weaponId/position があります。");
}

export const WEAPON_SKILL_NODES = Object.freeze(Object.fromEntries(nodeEntries));

function fail(reason, code = "invalid_loadout") {
  return { ok: false, code, reason };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function uniqueCharacterIds(characterIds) {
  if (!Array.isArray(characterIds)
    || characterIds.some((id) => typeof id !== "string" || !id.trim())
    || new Set(characterIds).size !== characterIds.length) {
    throw new TypeError("characterIds は重複のない、空でない文字列の配列が必要です。");
  }
  return characterIds;
}

function emptyByCharacter(characterIds, makeValue) {
  return Object.fromEntries(characterIds.map((characterId) => [characterId, makeValue()]));
}

// A character has one selected main action, ordered reactive and target rules,
// and no passive list: acquired passives all apply automatically.
export function freshWeaponSkillLoadout(characterIds = []) {
  const ids = uniqueCharacterIds(characterIds);
  return {
    schemaVersion: WEAPON_LOADOUT_SCHEMA_VERSION,
    primarySkillByCharacter: emptyByCharacter(ids, () => null),
    reactivePriorityByCharacter: emptyByCharacter(ids, () => []),
    targetPriorityByCharacter: emptyByCharacter(ids, () => []),
  };
}

function unlockedSet(unlockedSkillKeysByCharacter, characterId) {
  const value = unlockedSkillKeysByCharacter?.[characterId];
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

function copyLoadout(loadout) {
  return {
    schemaVersion: loadout.schemaVersion,
    primarySkillByCharacter: { ...loadout.primarySkillByCharacter },
    reactivePriorityByCharacter: Object.fromEntries(
      Object.entries(loadout.reactivePriorityByCharacter).map(([id, skills]) => [id, [...skills]]),
    ),
    targetPriorityByCharacter: Object.fromEntries(
      Object.entries(loadout.targetPriorityByCharacter).map(([id, skills]) => [id, [...skills]]),
    ),
  };
}

function checkCurrentLoadout(loadout) {
  const result = validateWeaponSkillLoadout(loadout);
  return result.valid ? null : result.errors[0];
}

function checkCharacter(loadout, characterId) {
  if (typeof characterId !== "string" || !Object.hasOwn(loadout.primarySkillByCharacter, characterId)) {
    return fail("その人物はこのロードアウトにいません。", "unknown_character");
  }
  return null;
}

function checkUnlocked(unlockedSkillKeysByCharacter, characterId, skillKey) {
  if (!unlockedSet(unlockedSkillKeysByCharacter, characterId).has(skillKey)) {
    return fail("その技能はまだ取得していません。", "skill_not_unlocked");
  }
  return null;
}

// Replace the single selected main action. Passing null clears it while a
// character has no usable main action configured.
export function selectPrimaryWeaponSkill(loadout, characterId, skillKey, unlockedSkillKeysByCharacter = {}) {
  const invalid = checkCurrentLoadout(loadout);
  if (invalid) return fail(invalid.reason, invalid.code);
  const unknownCharacter = checkCharacter(loadout, characterId);
  if (unknownCharacter) return unknownCharacter;
  if (skillKey !== null) {
    const definition = WEAPON_SKILL_NODES[skillKey];
    if (!definition) return fail("その技能が見つかりません。", "unknown_skill");
    if (definition.kind !== "active") return fail("主軸にはアクティブ技能だけを選べます。", "wrong_skill_kind");
    const notUnlocked = checkUnlocked(unlockedSkillKeysByCharacter, characterId, skillKey);
    if (notUnlocked) return notUnlocked;
  }
  const next = copyLoadout(loadout);
  next.primarySkillByCharacter[characterId] = skillKey;
  return { ok: true, loadout: next };
}

// Add an acquired reactive or target rule at the end of its priority list.
// The list order is the engine's first-match order once Stage 5 connects it.
export function addWeaponPrioritySkill(loadout, characterId, skillKey, unlockedSkillKeysByCharacter = {}) {
  const invalid = checkCurrentLoadout(loadout);
  if (invalid) return fail(invalid.reason, invalid.code);
  const unknownCharacter = checkCharacter(loadout, characterId);
  if (unknownCharacter) return unknownCharacter;
  const definition = WEAPON_SKILL_NODES[skillKey];
  if (!definition) return fail("その技能が見つかりません。", "unknown_skill");
  const listName = definition.kind === "reactive"
    ? "reactivePriorityByCharacter"
    : definition.kind === "target" ? "targetPriorityByCharacter" : null;
  if (!listName) return fail("優先列にはリアクティブかターゲット技能を選べます。", "wrong_skill_kind");
  const notUnlocked = checkUnlocked(unlockedSkillKeysByCharacter, characterId, skillKey);
  if (notUnlocked) return notUnlocked;
  if (loadout[listName][characterId].includes(skillKey)) {
    return fail("その技能はすでに優先列にあります。", "already_equipped");
  }
  const next = copyLoadout(loadout);
  next[listName][characterId].push(skillKey);
  return { ok: true, loadout: next };
}

export function removeWeaponPrioritySkill(loadout, characterId, skillKey) {
  const invalid = checkCurrentLoadout(loadout);
  if (invalid) return fail(invalid.reason, invalid.code);
  const unknownCharacter = checkCharacter(loadout, characterId);
  if (unknownCharacter) return unknownCharacter;
  const definition = WEAPON_SKILL_NODES[skillKey];
  const listName = definition?.kind === "reactive"
    ? "reactivePriorityByCharacter"
    : definition?.kind === "target" ? "targetPriorityByCharacter" : null;
  if (!listName) return fail("その技能は優先列に登録できません。", "wrong_skill_kind");
  const current = loadout[listName][characterId];
  if (!current.includes(skillKey)) return fail("その技能は優先列にありません。", "not_equipped");
  const next = copyLoadout(loadout);
  next[listName][characterId] = current.filter((entry) => entry !== skillKey);
  return { ok: true, loadout: next };
}

export function moveWeaponPrioritySkill(loadout, characterId, kind, fromIndex, toIndex) {
  const invalid = checkCurrentLoadout(loadout);
  if (invalid) return fail(invalid.reason, invalid.code);
  const unknownCharacter = checkCharacter(loadout, characterId);
  if (unknownCharacter) return unknownCharacter;
  const listName = kind === "reactive"
    ? "reactivePriorityByCharacter"
    : kind === "target" ? "targetPriorityByCharacter" : null;
  if (!listName) return fail("リアクティブかターゲットの優先列を指定してください。", "wrong_skill_kind");
  const current = loadout[listName][characterId];
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)
    || fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
    return fail("優先順位の位置が不正です。", "invalid_priority_index");
  }
  const next = copyLoadout(loadout);
  const [moved] = next[listName][characterId].splice(fromIndex, 1);
  next[listName][characterId].splice(toIndex, 0, moved);
  return { ok: true, loadout: next };
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function validateSkillList(value, kind, characterId, path, errors, unlockedSkillKeysByCharacter) {
  if (!Array.isArray(value)) {
    addError(errors, "invalid_skill_list", path, "技能の優先列は配列である必要があります。");
    return;
  }
  const seen = new Set();
  value.forEach((skillKey, index) => {
    const itemPath = `${path}[${index}]`;
    if (typeof skillKey !== "string" || !WEAPON_SKILL_NODES[skillKey]) {
      addError(errors, "unknown_skill", itemPath, "仕様にない技能です。");
      return;
    }
    if (WEAPON_SKILL_NODES[skillKey].kind !== kind) {
      addError(errors, "wrong_skill_kind", itemPath, `この列には ${kind} 技能だけを置けます。`);
    }
    if (seen.has(skillKey)) addError(errors, "duplicate_skill", itemPath, "同じ技能が重複しています。");
    seen.add(skillKey);
    if (unlockedSkillKeysByCharacter
      && !unlockedSet(unlockedSkillKeysByCharacter, characterId).has(skillKey)) {
      addError(errors, "skill_not_unlocked", itemPath, "取得していない技能です。");
    }
  });
}

export function validateWeaponSkillLoadout(loadout, options = {}) {
  const errors = [];
  if (!isRecord(loadout)) {
    addError(errors, "invalid_loadout", "$", "ロードアウトはオブジェクトである必要があります。");
    return { valid: false, errors };
  }
  if (loadout.schemaVersion !== WEAPON_LOADOUT_SCHEMA_VERSION) {
    addError(errors, "unsupported_version", "schemaVersion", "対応していないロードアウト形式です。");
  }
  const allowedFields = new Set([
    "schemaVersion",
    "primarySkillByCharacter",
    "reactivePriorityByCharacter",
    "targetPriorityByCharacter",
  ]);
  for (const field of Object.keys(loadout)) {
    if (!allowedFields.has(field)) {
      addError(errors, "unknown_loadout_field", field, "このロードアウト形式にない欄です。");
    }
  }
  const fields = [
    "primarySkillByCharacter",
    "reactivePriorityByCharacter",
    "targetPriorityByCharacter",
  ];
  for (const field of fields) {
    if (!isRecord(loadout[field])) {
      addError(errors, "invalid_loadout_map", field, `${field} はオブジェクトである必要があります。`);
    }
  }
  if (errors.some((error) => error.code === "invalid_loadout_map")) {
    return { valid: false, errors };
  }

  const characterIds = options.characterIds === undefined
    ? Object.keys(loadout.primarySkillByCharacter)
    : uniqueCharacterIds(options.characterIds);
  for (const field of fields) {
    const actualIds = Object.keys(loadout[field]).sort();
    const expectedIds = [...characterIds].sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
      addError(errors, "roster_mismatch", field, `${field} の人物が遠征 roster と一致しません。`);
    }
  }

  for (const characterId of characterIds) {
    const primary = loadout.primarySkillByCharacter[characterId];
    if (primary !== null) {
      if (typeof primary !== "string" || !WEAPON_SKILL_NODES[primary]) {
        addError(errors, "unknown_skill", `primarySkillByCharacter.${characterId}`, "仕様にない技能です。");
      } else {
        if (WEAPON_SKILL_NODES[primary].kind !== "active") {
          addError(errors, "wrong_skill_kind", `primarySkillByCharacter.${characterId}`, "主軸にはactive技能だけを置けます。");
        }
        if (options.unlockedSkillKeysByCharacter
          && !unlockedSet(options.unlockedSkillKeysByCharacter, characterId).has(primary)) {
          addError(errors, "skill_not_unlocked", `primarySkillByCharacter.${characterId}`, "取得していない技能です。");
        }
      }
    }
    validateSkillList(
      loadout.reactivePriorityByCharacter[characterId], "reactive", characterId,
      `reactivePriorityByCharacter.${characterId}`, errors, options.unlockedSkillKeysByCharacter,
    );
    validateSkillList(
      loadout.targetPriorityByCharacter[characterId], "target", characterId,
      `targetPriorityByCharacter.${characterId}`, errors, options.unlockedSkillKeysByCharacter,
    );
  }
  return { valid: errors.length === 0, errors };
}
