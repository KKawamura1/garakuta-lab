import { PLAYABLE_CONTENT } from "./content/index.mjs";

// Keep legacy player skills out of Stage 5, but preserve engine-declared basic
// and fallback actions. Content validation requires every core action to resolve.
export function stage5ContentBundle(run, content = PLAYABLE_CONTENT) {
  const equipment = { ...content.equipment };
  for (const item of Object.values(run?.generatedEquipment ?? {})) {
    if (item?.definition?.id) equipment[item.definition.id] = item.definition;
  }

  const activeSkills = {};
  const coreActionIds = new Set(
    Object.values(content.coreActions ?? {}).flatMap((byReach) => Object.values(byReach ?? {})),
  );
  for (const skillId of coreActionIds) {
    const definition = content.activeSkills?.[skillId];
    if (!definition) throw new TypeError(`missing core active skill: ${skillId}`);
    activeSkills[skillId] = definition;
  }

  return {
    ...content,
    activeSkills,
    reactiveSkills: {},
    passiveSkills: {},
    equipment,
  };
}
