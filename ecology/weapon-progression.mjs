// Stage 3b — run-scoped acquisition for the finite weapon-skill catalogue.
//
// This state stores acquired node keys and unspent points only. It intentionally
// has no legacy skill IDs, skill-level map, runtime registry, or UI dependency.

import { WEAPON_SKILL_NODES, weaponSkillNodeKey } from "./weapon-loadout.mjs";

export const WEAPON_PROGRESSION_SCHEMA_VERSION = "ecology-weapon-progression-1";
export const WEAPON_SKILL_NODE_COST = 1;

const PARENT_POSITION = Object.freeze({
  A1: "R", A2: "A1", A3: "A2", AA1: "A3", AA2: "AA1", AA3: "AA2",
  AB1: "A3", AB2: "AB1", AB3: "AB2",
  B1: "R", B2: "B1", B3: "B2", BA1: "B3", BA2: "BA1", BA3: "BA2",
  BB1: "B3", BB2: "BB1", BB3: "BB2",
});

for (const node of Object.values(WEAPON_SKILL_NODES)) {
  if (node.position !== "R" && !Object.hasOwn(PARENT_POSITION, node.position)) {
    throw new Error(`武器技能treeに前提定義のないpositionがあります: ${node.key}`);
  }
  const parentPosition = PARENT_POSITION[node.position];
  if (parentPosition && !WEAPON_SKILL_NODES[weaponSkillNodeKey(node.weaponId, parentPosition)]) {
    throw new Error(`武器技能treeの前提nodeがありません: ${node.key}`);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(reason, code = "invalid_progression") {
  return { ok: false, code, reason };
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function idsFromAvailable(availableSkillNodeKeys) {
  if (availableSkillNodeKeys instanceof Set) return availableSkillNodeKeys;
  return new Set(Array.isArray(availableSkillNodeKeys) ? availableSkillNodeKeys : []);
}

function nodeFor(nodeKey) {
  return typeof nodeKey === "string" ? WEAPON_SKILL_NODES[nodeKey] ?? null : null;
}

export function weaponSkillPrerequisiteKeys(nodeKey) {
  const node = nodeFor(nodeKey);
  if (!node) return null;
  const parentPosition = PARENT_POSITION[node.position];
  return parentPosition ? [weaponSkillNodeKey(node.weaponId, parentPosition)] : [];
}

function prerequisiteChain(nodeKey) {
  if (!nodeFor(nodeKey)) return null;
  const chain = [];
  let current = nodeKey;
  while (current) {
    if (chain.includes(current)) throw new Error(`武器技能treeに循環があります: ${nodeKey}`);
    chain.push(current);
    const prerequisites = weaponSkillPrerequisiteKeys(current);
    current = prerequisites?.[0] ?? null;
  }
  return chain.reverse();
}

function uniqueCharacterIds(characterIds) {
  if (!Array.isArray(characterIds)
    || characterIds.some((id) => typeof id !== "string" || !id.trim())
    || new Set(characterIds).size !== characterIds.length) {
    throw new TypeError("characterIds は重複のない、空でない文字列の配列が必要です。");
  }
  return characterIds;
}

function skillKeysFor(value, characterId) {
  const entry = value?.[characterId];
  return Array.isArray(entry) ? entry : [];
}

function startingPointsFor(value, characterId) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  const entry = value?.[characterId];
  return Number.isSafeInteger(entry) && entry >= 0 ? entry : null;
}

function cloneProgression(progression) {
  return {
    schemaVersion: progression.schemaVersion,
    unlockedSkillKeysByCharacter: Object.fromEntries(
      Object.entries(progression.unlockedSkillKeysByCharacter).map(([id, keys]) => [id, [...keys]]),
    ),
    skillPointsByCharacter: { ...progression.skillPointsByCharacter },
    skillReservationByCharacter: { ...progression.skillReservationByCharacter },
    grantedSkillPointRewardKeys: [...progression.grantedSkillPointRewardKeys],
  };
}

export function freshWeaponSkillProgression(
  characterIds,
  {
    startingSkillKeysByCharacter = {},
    startingSkillPointsByCharacter = 0,
    availableSkillNodeKeys,
  } = {},
) {
  const ids = uniqueCharacterIds(characterIds);
  const available = idsFromAvailable(availableSkillNodeKeys);
  const unlockedSkillKeysByCharacter = {};
  const skillPointsByCharacter = {};
  const skillReservationByCharacter = {};
  for (const characterId of ids) {
    const suppliedStartingKeys = startingSkillKeysByCharacter?.[characterId];
    if (suppliedStartingKeys !== undefined && !Array.isArray(suppliedStartingKeys)) {
      throw new TypeError(`${characterId} の初期技能は配列である必要があります。`);
    }
    const startingKeys = skillKeysFor(startingSkillKeysByCharacter, characterId);
    if (startingKeys.length !== new Set(startingKeys).size) {
      throw new TypeError(`${characterId} の初期技能に重複があります。`);
    }
    for (const key of startingKeys) {
      if (!nodeFor(key)) throw new TypeError(`${characterId} の未知の初期技能です: ${key}`);
      if (!available.has(key)) throw new TypeError(`${characterId} の初期技能が遠征で利用できません: ${key}`);
    }
    const initial = new Set(startingKeys);
    for (const key of initial) {
      const prerequisites = weaponSkillPrerequisiteKeys(key) ?? [];
      if (prerequisites.some((parent) => !initial.has(parent))) {
        throw new TypeError(`${characterId} の初期技能に前提が足りません: ${key}`);
      }
    }
    const points = startingPointsFor(startingSkillPointsByCharacter, characterId);
    if (points === null) throw new TypeError(`${characterId} の初期技能点が不正です。`);
    unlockedSkillKeysByCharacter[characterId] = [...startingKeys];
    skillPointsByCharacter[characterId] = points;
    skillReservationByCharacter[characterId] = null;
  }
  return {
    schemaVersion: WEAPON_PROGRESSION_SCHEMA_VERSION,
    unlockedSkillKeysByCharacter,
    skillPointsByCharacter,
    skillReservationByCharacter,
    grantedSkillPointRewardKeys: [],
  };
}

export function validateWeaponSkillProgression(progression, options = {}) {
  const errors = [];
  if (!isRecord(progression)) {
    addError(errors, "invalid_progression", "$", "技能進行状態はオブジェクトである必要があります。");
    return { valid: false, errors };
  }
  if (progression.schemaVersion !== WEAPON_PROGRESSION_SCHEMA_VERSION) {
    addError(errors, "unsupported_version", "schemaVersion", "対応していない技能進行形式です。");
  }
  const allowed = new Set([
    "schemaVersion",
    "unlockedSkillKeysByCharacter",
    "skillPointsByCharacter",
    "skillReservationByCharacter",
    "grantedSkillPointRewardKeys",
  ]);
  for (const field of Object.keys(progression)) {
    if (!allowed.has(field)) addError(errors, "unknown_progression_field", field, "この形式にない欄です。");
  }
  for (const field of ["unlockedSkillKeysByCharacter", "skillPointsByCharacter", "skillReservationByCharacter"]) {
    if (!isRecord(progression[field])) {
      addError(errors, "invalid_progression_map", field, `${field} はオブジェクトである必要があります。`);
    }
  }
  if (errors.some((error) => error.code === "invalid_progression_map")) return { valid: false, errors };

  const mapNames = ["unlockedSkillKeysByCharacter", "skillPointsByCharacter", "skillReservationByCharacter"];
  const ids = options.characterIds === undefined
    ? Object.keys(progression.unlockedSkillKeysByCharacter)
    : uniqueCharacterIds(options.characterIds);
  for (const field of mapNames) {
    const actual = Object.keys(progression[field]).sort();
    const expected = [...ids].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      addError(errors, "roster_mismatch", field, `${field} の人物が遠征 roster と一致しません。`);
    }
  }

  const available = options.availableSkillNodeKeys === undefined
    ? null
    : idsFromAvailable(options.availableSkillNodeKeys);
  for (const characterId of ids) {
    const unlocked = progression.unlockedSkillKeysByCharacter[characterId];
    if (!Array.isArray(unlocked)) {
      addError(errors, "invalid_unlocked_skills", `unlockedSkillKeysByCharacter.${characterId}`, "取得技能は配列である必要があります。");
      continue;
    }
    const unlockedSet = new Set();
    unlocked.forEach((key, index) => {
      const path = `unlockedSkillKeysByCharacter.${characterId}[${index}]`;
      if (!nodeFor(key)) {
        addError(errors, "unknown_skill", path, "カタログにない技能です。");
        return;
      }
      if (unlockedSet.has(key)) addError(errors, "duplicate_skill", path, "同じ技能が重複しています。");
      unlockedSet.add(key);
      for (const prerequisite of weaponSkillPrerequisiteKeys(key) ?? []) {
        if (!unlocked.includes(prerequisite)) {
          addError(errors, "missing_prerequisite", path, `前提 ${prerequisite} を取得していません。`);
        }
      }
      if (available && !available.has(key)) {
        addError(errors, "skill_not_available", path, "遠征で利用できない技能です。");
      }
    });

    const points = progression.skillPointsByCharacter[characterId];
    if (!Number.isSafeInteger(points) || points < 0) {
      addError(errors, "invalid_skill_points", `skillPointsByCharacter.${characterId}`, "技能点は0以上の安全な整数である必要があります。");
    }
    const reservation = progression.skillReservationByCharacter[characterId];
    if (reservation !== null) {
      if (!nodeFor(reservation)) {
        addError(errors, "unknown_reservation", `skillReservationByCharacter.${characterId}`, "予約先がカタログにありません。");
      } else {
        if (unlockedSet.has(reservation)) {
          addError(errors, "reservation_already_unlocked", `skillReservationByCharacter.${characterId}`, "取得済み技能を予約できません。");
        }
        if (available) {
          const chain = prerequisiteChain(reservation) ?? [];
          if (chain.some((key) => !available.has(key))) {
            addError(errors, "reservation_not_available", `skillReservationByCharacter.${characterId}`, "予約先の前提が遠征で利用できません。");
          }
        }
      }
    }
  }
  const rewardKeys = progression.grantedSkillPointRewardKeys;
  if (!Array.isArray(rewardKeys)
    || rewardKeys.some((key) => typeof key !== "string" || !key.trim())
    || new Set(rewardKeys).size !== rewardKeys.length) {
    addError(errors, "invalid_reward_keys", "grantedSkillPointRewardKeys", "技能点の報酬keyは一意な文字列の配列である必要があります。");
  }
  return { valid: errors.length === 0, errors };
}

function requireValid(progression, availableSkillNodeKeys) {
  const validation = validateWeaponSkillProgression(progression, { availableSkillNodeKeys });
  return validation.valid ? null : validation.errors[0];
}

function hasCharacter(progression, characterId) {
  return typeof characterId === "string"
    && Object.hasOwn(progression.unlockedSkillKeysByCharacter, characterId);
}

export function unlockWeaponSkill(progression, characterId, skillKey, availableSkillNodeKeys = []) {
  const invalid = requireValid(progression, availableSkillNodeKeys);
  if (invalid) return fail(invalid.message, invalid.code);
  if (!hasCharacter(progression, characterId)) return fail("その人物はこの遠征にいません。", "unknown_character");
  const node = nodeFor(skillKey);
  if (!node) return fail("その技能が見つかりません。", "unknown_skill");
  const available = idsFromAvailable(availableSkillNodeKeys);
  if (!available.has(skillKey)) return fail("この遠征の技能packでは使えません。", "skill_not_available");
  const unlocked = progression.unlockedSkillKeysByCharacter[characterId];
  if (unlocked.includes(skillKey)) return fail("すでに取得しています。", "already_unlocked");
  const prerequisites = weaponSkillPrerequisiteKeys(skillKey) ?? [];
  if (prerequisites.some((key) => !available.has(key))) {
    return fail("前提技能がこの遠征では使えません。", "prerequisite_not_available");
  }
  if (prerequisites.some((key) => !unlocked.includes(key))) {
    return fail("前提技能がまだ取得されていません。", "missing_prerequisite");
  }
  if (progression.skillPointsByCharacter[characterId] < WEAPON_SKILL_NODE_COST) {
    return fail("技能点が足りません。", "not_enough_skill_points");
  }
  const next = cloneProgression(progression);
  next.skillPointsByCharacter[characterId] -= WEAPON_SKILL_NODE_COST;
  next.unlockedSkillKeysByCharacter[characterId].push(skillKey);
  return { ok: true, progression: next };
}

export function cancelWeaponSkillReservation(progression, characterId) {
  const invalid = requireValid(progression);
  if (invalid) return fail(invalid.message, invalid.code);
  if (!hasCharacter(progression, characterId)) return fail("その人物はこの遠征にいません。", "unknown_character");
  if (progression.skillReservationByCharacter[characterId] === null) {
    return { ok: true, progression, cancelled: false };
  }
  const next = cloneProgression(progression);
  next.skillReservationByCharacter[characterId] = null;
  return { ok: true, progression: next, cancelled: true };
}

export function fulfillWeaponSkillReservations(progression, availableSkillNodeKeys = []) {
  const invalid = requireValid(progression, availableSkillNodeKeys);
  if (invalid) return { ok: false, ...fail(invalid.message, invalid.code), progression };
  const available = idsFromAvailable(availableSkillNodeKeys);
  const next = cloneProgression(progression);
  const actions = [];
  const completed = [];
  for (const characterId of Object.keys(next.unlockedSkillKeysByCharacter)) {
    const target = next.skillReservationByCharacter[characterId];
    if (target === null) continue;
    const chain = prerequisiteChain(target) ?? [];
    for (const skillKey of chain) {
      if (next.unlockedSkillKeysByCharacter[characterId].includes(skillKey)) continue;
      if (!available.has(skillKey)
        || next.skillPointsByCharacter[characterId] < WEAPON_SKILL_NODE_COST) break;
      const unlocked = unlockWeaponSkill(next, characterId, skillKey, availableSkillNodeKeys);
      if (!unlocked.ok) break;
      next.unlockedSkillKeysByCharacter[characterId] = unlocked.progression.unlockedSkillKeysByCharacter[characterId];
      next.skillPointsByCharacter[characterId] = unlocked.progression.skillPointsByCharacter[characterId];
      actions.push({ characterId, skillKey, target: skillKey === target });
    }
    if (next.unlockedSkillKeysByCharacter[characterId].includes(target)) {
      next.skillReservationByCharacter[characterId] = null;
      completed.push({ characterId, skillKey: target });
    }
  }
  return { ok: true, progression: next, actions, completed };
}

export function reserveWeaponSkill(progression, characterId, skillKey, availableSkillNodeKeys = []) {
  const invalid = requireValid(progression, availableSkillNodeKeys);
  if (invalid) return fail(invalid.message, invalid.code);
  if (!hasCharacter(progression, characterId)) return fail("その人物はこの遠征にいません。", "unknown_character");
  if (!nodeFor(skillKey)) return fail("その技能が見つかりません。", "unknown_skill");
  const available = idsFromAvailable(availableSkillNodeKeys);
  if (!available.has(skillKey)) return fail("この遠征の技能packでは使えません。", "skill_not_available");
  if (progression.unlockedSkillKeysByCharacter[characterId].includes(skillKey)) {
    return fail("その技能はすでに取得しています。", "already_unlocked");
  }
  const chain = prerequisiteChain(skillKey) ?? [];
  if (chain.some((key) => !available.has(key))) {
    return fail("予約先の前提技能がこの遠征では使えません。", "prerequisite_not_available");
  }
  const next = cloneProgression(progression);
  next.skillReservationByCharacter[characterId] = skillKey;
  const fulfilled = fulfillWeaponSkillReservations(next, availableSkillNodeKeys);
  if (!fulfilled.ok) return fulfilled;
  return { ok: true, progression: fulfilled.progression, actions: fulfilled.actions, completed: fulfilled.completed };
}

export function canFulfillWeaponSkillReservation(
  progression, characterId, skillKey, availableSkillNodeKeys = [],
) {
  const reservation = reserveWeaponSkill(progression, characterId, skillKey, availableSkillNodeKeys);
  return reservation.ok && reservation.completed.some((entry) => entry.characterId === characterId
    && entry.skillKey === skillKey);
}

export function grantWeaponSkillPointsForClear(
  progression, clearKey, amount = 1, availableSkillNodeKeys = [],
) {
  const invalid = requireValid(progression, availableSkillNodeKeys);
  if (invalid) return { ok: false, ...fail(invalid.message, invalid.code), progression };
  if (typeof clearKey !== "string" || !clearKey.trim()) return fail("クリア報酬keyが不正です。", "invalid_reward_key");
  if (!Number.isSafeInteger(amount) || amount < 1) return fail("技能点の付与量が不正です。", "invalid_skill_point_amount");
  if (progression.grantedSkillPointRewardKeys.includes(clearKey)) {
    return { ok: true, progression, amount, granted: false, actions: [], completed: [] };
  }
  const next = cloneProgression(progression);
  for (const characterId of Object.keys(next.skillPointsByCharacter)) {
    next.skillPointsByCharacter[characterId] += amount;
    if (!Number.isSafeInteger(next.skillPointsByCharacter[characterId])) {
      return fail("技能点が上限を超えました。", "skill_point_overflow");
    }
  }
  next.grantedSkillPointRewardKeys.push(clearKey);
  const fulfilled = fulfillWeaponSkillReservations(next, availableSkillNodeKeys);
  if (!fulfilled.ok) return fulfilled;
  return {
    ok: true,
    progression: fulfilled.progression,
    amount,
    granted: true,
    actions: fulfilled.actions,
    completed: fulfilled.completed,
  };
}
