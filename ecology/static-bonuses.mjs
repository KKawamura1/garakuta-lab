import { MAX_SKILL_LEVEL, MIN_SKILL_LEVEL } from "./schema.mjs";

// 装着中の常時能力上昇を、技能・装備の定義から同じ経路で合算する。
// engine / BattleInput validator / preview builder / UI が別々に再実装すると、
// 最大HPだけが画面と本戦でずれるため、この小さな純関数へ閉じる。

export const EMPTY_STAT_BONUS = Object.freeze({
  max_hp: 0,
  might: 0,
  focus: 0,
  guard: 0,
});

function skillLevel(skillLevels, skillId) {
  const raw = skillLevels?.[skillId];
  if (!Number.isSafeInteger(raw)) return MIN_SKILL_LEVEL;
  return Math.max(MIN_SKILL_LEVEL, Math.min(MAX_SKILL_LEVEL, raw));
}

function addBonus(total, bonus) {
  if (!bonus || typeof bonus !== "object") return;
  for (const stat of Object.keys(EMPTY_STAT_BONUS)) {
    const value = bonus[stat];
    if (Number.isSafeInteger(value)) {
      total[stat] += value;
    }
  }
}

function addSkillBonus(total, definition, level) {
  addBonus(total, definition?.statBonus);
  const extraLevels = level - MIN_SKILL_LEVEL;
  if (extraLevels <= 0) return;
  for (const stat of Object.keys(EMPTY_STAT_BONUS)) {
    const growth = definition?.statBonusPerLevel?.[stat];
    if (Number.isSafeInteger(growth)) total[stat] += growth * extraLevels;
  }
}

export function staticStatBonuses(content, passiveSkillIds = [], equipment = [], skillLevels = {}) {
  const total = { ...EMPTY_STAT_BONUS };
  for (const id of passiveSkillIds ?? []) {
    const definition = content.passiveSkills?.[id];
    addSkillBonus(total, definition, skillLevel(skillLevels, id));
  }
  for (const entry of equipment ?? []) {
    if (typeof entry === "object" && entry?.broken === true) continue;
    const equipmentId = typeof entry === "string" ? entry : entry?.equipmentId;
    addBonus(total, content.equipment?.[equipmentId]?.statBonus);
  }
  return total;
}

export function maxHpWithStaticBonuses(
  baseMaxHp, content, passiveSkillIds = [], equipment = [], skillLevels = {},
) {
  return baseMaxHp + staticStatBonuses(content, passiveSkillIds, equipment, skillLevels).max_hp;
}

export function withStaticStatBonuses(
  content, fields, passiveSkillIds = [], equipment = [], skillLevels = {},
) {
  const next = { ...fields };
  // 明示HPが補正前上限と同じときだけ「満タンで入った」と扱う。
  // `>=` にすると、前戦から補正込みHPを持ち越した負傷者まで全快してしまう。
  const startedFull = next.hp === next.maxHp;
  const bonus = staticStatBonuses(content, passiveSkillIds, equipment, skillLevels);
  next.maxHp += bonus.max_hp;
  next.might = (next.might ?? 0) + bonus.might;
  next.focus = (next.focus ?? 0) + bonus.focus;
  next.guard = (next.guard ?? 0) + bonus.guard;
  if (startedFull) next.hp = next.maxHp;
  else next.hp = Math.min(next.hp, next.maxHp);
  return next;
}
