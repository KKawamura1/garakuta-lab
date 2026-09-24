// 武器スキル用 pack registry。
//
// 装備pack（packs.mjs）とスキルpackは同じ「遠征で見える箱」でも、解禁対象と
// 収益経路が違う。IDを分け、manifestでは両方を明示的に保持する。

import { WEAPONS } from "./weapon-trees.mjs";

export const WEAPON_SKILL_PACKS = Object.freeze(
  Object.values(WEAPONS).map((weapon) => Object.freeze({
    id: weapon.id,
    displayName: `${weapon.displayName}スキル`,
    summary: weapon.summary,
    weaponId: weapon.id,
    kind: "skill",
  })),
);

export const WEAPON_SKILL_PACK_BY_ID = Object.freeze(
  Object.fromEntries(WEAPON_SKILL_PACKS.map((pack) => [pack.id, pack])),
);

export function skillPackIdsForWeaponIds(weaponIds = []) {
  return [...new Set(weaponIds)].filter((id) => Object.hasOwn(WEAPON_SKILL_PACK_BY_ID, id));
}

export function weaponIdsForSkillPackIds(packIds = []) {
  return [...new Set(packIds)]
    .map((id) => WEAPON_SKILL_PACK_BY_ID[id]?.weaponId)
    .filter(Boolean);
}

