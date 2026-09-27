// Persistent, run-scoped values that shape each generated BattleInput.
// This is intentionally separate from the combat engine's per-battle state.

import { LIMITS, POSITIONS, isSafeCount, isValidId } from "./schema.mjs";
import { CHARACTER_DEFINITIONS } from "./content/roster.mjs";

export const WEAPON_RUN_BATTLE_STATE_SCHEMA_VERSION = "ecology-weapon-run-battle-state-1";

const POSITION_SET = new Set(POSITIONS);
const DEFAULT_POSITION_BY_CHARACTER = Object.freeze(Object.fromEntries(
  CHARACTER_DEFINITIONS.map(({ id, defaultPosition }) => [id, defaultPosition]),
));
const FALLBACK_POSITION_ORDER = Object.freeze([
  "front_left", "rear_right", "front_center", "rear_center", "rear_left", "front_right",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function emptyEquipmentByCharacter(characterIds, supplied = {}) {
  return Object.fromEntries(characterIds.map((characterId) => [
    characterId,
    (supplied?.[characterId] ?? []).map((item) => ({ ...item })),
  ]));
}

function defaultFormation(characterIds, supplied = {}) {
  const result = {};
  const used = new Set();
  for (const characterId of characterIds) {
    const requested = supplied?.[characterId];
    const preferred = POSITION_SET.has(requested)
      ? requested
      : DEFAULT_POSITION_BY_CHARACTER[characterId];
    const position = preferred && !used.has(preferred)
      ? preferred
      : FALLBACK_POSITION_ORDER.find((candidate) => !used.has(candidate));
    if (!position) throw new TypeError("編成に配置できる位置が足りません。");
    result[characterId] = position;
    used.add(position);
  }
  return result;
}

export function freshWeaponRunBattleState(characterIds, {
  formationByCharacter,
  equipmentByCharacter = {},
  currentHpByCharacter = {},
} = {}) {
  const state = {
    schemaVersion: WEAPON_RUN_BATTLE_STATE_SCHEMA_VERSION,
    formationByCharacter: defaultFormation(characterIds, formationByCharacter),
    equipmentByCharacter: emptyEquipmentByCharacter(characterIds, equipmentByCharacter),
    currentHpByCharacter: Object.fromEntries(characterIds.map((characterId) => [
      characterId,
      currentHpByCharacter?.[characterId] ?? null,
    ])),
  };
  const validation = validateWeaponRunBattleState(state, { characterIds });
  if (!validation.valid) throw new TypeError(validation.errors[0].message);
  return state;
}

export function validateWeaponRunBattleState(state, { characterIds } = {}) {
  const errors = [];
  if (!isRecord(state)) {
    addError(errors, "invalid_battle_state", "$", "戦闘状態はオブジェクトである必要があります。");
    return { valid: false, errors };
  }
  if (state.schemaVersion !== WEAPON_RUN_BATTLE_STATE_SCHEMA_VERSION) {
    addError(errors, "unsupported_version", "schemaVersion", "対応していない戦闘状態形式です。");
  }
  const allowedFields = new Set([
    "schemaVersion", "formationByCharacter", "equipmentByCharacter", "currentHpByCharacter",
  ]);
  for (const field of Object.keys(state)) {
    if (!allowedFields.has(field)) addError(errors, "unknown_battle_state_field", field, "この戦闘状態形式にない欄です。");
  }
  const ids = characterIds ?? Object.keys(state.formationByCharacter ?? {});
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string" || !id.trim())
    || new Set(ids).size !== ids.length) {
    addError(errors, "invalid_character_ids", "characterIds", "人物IDは重複のない文字列配列である必要があります。");
    return { valid: false, errors };
  }
  for (const field of ["formationByCharacter", "equipmentByCharacter", "currentHpByCharacter"]) {
    if (!isRecord(state[field])) {
      addError(errors, "invalid_battle_state_map", field, `${field}はオブジェクトである必要があります。`);
      continue;
    }
    const actual = Object.keys(state[field]).sort();
    if (JSON.stringify(actual) !== JSON.stringify([...ids].sort())) {
      addError(errors, "roster_mismatch", field, `${field}の人物がRun rosterと一致しません。`);
    }
  }
  if (!isRecord(state.formationByCharacter)
    || !isRecord(state.equipmentByCharacter)
    || !isRecord(state.currentHpByCharacter)) return { valid: false, errors };

  const positions = new Set();
  for (const characterId of ids) {
    const position = state.formationByCharacter[characterId];
    if (!POSITION_SET.has(position)) {
      addError(errors, "invalid_formation_position", `formationByCharacter.${characterId}`, "編成位置が正しくありません。");
    } else if (positions.has(position)) {
      addError(errors, "duplicate_formation_position", `formationByCharacter.${characterId}`, "同じ位置に複数の人物を置けません。");
    } else {
      positions.add(position);
    }

    const equipment = state.equipmentByCharacter[characterId];
    if (!Array.isArray(equipment) || equipment.length > LIMITS.maxEquipment) {
      addError(errors, "invalid_equipment_list", `equipmentByCharacter.${characterId}`, "装備は2つまでの配列である必要があります。");
    } else {
      equipment.forEach((item, index) => {
        const path = `equipmentByCharacter.${characterId}[${index}]`;
        if (!isRecord(item)) {
          addError(errors, "invalid_equipment_instance", path, "装備instanceはオブジェクトである必要があります。");
          return;
        }
        for (const field of Object.keys(item)) {
          if (!["instanceId", "equipmentId", "durability"].includes(field)) {
            addError(errors, "unknown_equipment_instance_field", `${path}.${field}`, "装備instanceにない欄です。");
          }
        }
        if (!isValidId(item.instanceId)) addError(errors, "invalid_equipment_instance_id", `${path}.instanceId`, "instanceIdが正しくありません。");
        if (!isValidId(item.equipmentId)) addError(errors, "invalid_equipment_id", `${path}.equipmentId`, "equipmentIdが正しくありません。");
        if (!isSafeCount(item.durability)) addError(errors, "invalid_equipment_durability", `${path}.durability`, "耐久は0以上の整数である必要があります。");
      });
    }
    const hp = state.currentHpByCharacter[characterId];
    if (hp !== null && !isSafeCount(hp)) {
      addError(errors, "invalid_current_hp", `currentHpByCharacter.${characterId}`, "現在HPはnullまたは0以上の整数である必要があります。");
    }
  }
  const instanceIds = ids.flatMap((characterId) => Array.isArray(state.equipmentByCharacter[characterId])
    ? state.equipmentByCharacter[characterId].map((item) => item?.instanceId).filter(isValidId)
    : []);
  if (new Set(instanceIds).size !== instanceIds.length) {
    addError(errors, "duplicate_equipment_instance_id", "equipmentByCharacter", "装備instanceIdはRun内で一意である必要があります。");
  }
  return { valid: errors.length === 0, errors };
}
