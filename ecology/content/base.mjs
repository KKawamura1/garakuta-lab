// ecology/content/base.mjs
//
// **種類別ファイルが共有する道具だけを置く。** ここに定義そのものを置かない。
// R5 fixture を土台に、表示名の差し替えと部分改変で本番定義を作る。

import { FIXTURE_CONTENT } from "../fixture-content.mjs";

export const clone = (value) => structuredClone(value);

// fixture の一節を、渡した表示名で置き換えて複製する。
export function renamed(section, displayNames = {}) {
  return Object.fromEntries(
    Object.entries(FIXTURE_CONTENT[section]).map(([id, definition]) => [
      id,
      displayNames[id]
        ? { ...clone(definition), displayName: displayNames[id] }
        : clone(definition),
    ]),
  );
}

export function cloneActive(baseId, id, displayName, patch = {}) {
  const definition = clone(FIXTURE_CONTENT.activeSkills[baseId]);
  definition.id = id;
  definition.displayName = displayName;
  Object.assign(definition, patch);
  return definition;
}

export function cloneEnemy(baseId, id, displayName, patch = {}) {
  const definition = clone(FIXTURE_CONTENT.enemyActors[baseId]);
  definition.id = id;
  definition.displayName = displayName;
  Object.assign(definition, patch);
  definition.tags = [...new Set([...(definition.tags ?? []), "playable"])];
  return definition;
}

export function cloneEquipment(baseId, id, displayName, patch = {}) {
  const definition = clone(FIXTURE_CONTENT.equipment[baseId]);
  definition.id = id;
  definition.displayName = displayName;
  definition.rules = definition.rules.map((rule, index) => ({
    ...rule,
    id: id + "_rule_" + index,
  }));
  Object.assign(definition, patch);
  return definition;
}

export function setRuleEffectAmount(definition, value, effectType) {
  for (const rule of definition.rules ?? []) {
    for (const effect of rule.effects ?? []) {
      if (effectType && effect.type !== effectType) continue;
      if (effect.amount?.type === "constant") effect.amount.value = value;
    }
  }
  return definition;
}
