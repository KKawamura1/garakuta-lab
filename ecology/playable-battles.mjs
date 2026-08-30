import { BATTLE_SCHEMA_VERSION, POSITIONS } from "./schema.mjs";
import {
  ACTIVE_META,
  CHARACTER_DEFINITIONS,
  DISPLAY_NAMES,
  ENCOUNTERS,
  ENEMY_TARGETING,
  EQUIPMENT_META,
  PLAYABLE_CONTENT,
  REACTIVE_META,
  SKILL_TREE_NODES,
} from "./content/index.mjs";

export const RUN_SEED = "frontier-1801";

const clone = (value) => structuredClone(value);


export const CHARACTER_OPTIONS = Object.freeze(
  CHARACTER_DEFINITIONS.map((option) => Object.freeze(option)),
);
const characterById = Object.fromEntries(CHARACTER_OPTIONS.map((option) => [option.id, option]));




function metadata(source, kind) {
  return Object.fromEntries(
    Object.entries(source).map(([id, values]) => [
      id,
      {
        id,
        kind,
        definitionId: id,
        label: values[0],
        effect: values[1],
        grammar: values[2],
        ...(kind === "equipment" ? { maxDurability: values[3] } : {}),
      },
    ]),
  );
}

export const SKILLS = Object.freeze({
  active: Object.freeze(metadata(ACTIVE_META, "active")),
  reactive: Object.freeze(metadata(REACTIVE_META, "reactive")),
});
export const EQUIPMENT = Object.freeze(metadata(EQUIPMENT_META, "equipment"));
export const COMPONENTS = Object.freeze({
  ...SKILLS.active,
  ...SKILLS.reactive,
  ...EQUIPMENT,
});
export const COMPONENT_ORDER = Object.freeze(Object.keys(COMPONENTS));


const nodeBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));

export function characterInfo(characterId) {
  return characterById[characterId] ?? null;
}

export function componentInfo(componentId) {
  return COMPONENTS[componentId] ?? null;
}

export function componentLabel(componentId) {
  return COMPONENTS[componentId]?.label ?? DISPLAY_NAMES[componentId] ?? componentId;
}

export function skillNode(skillId) {
  return nodeBySkill[skillId] ?? null;
}

export function initialUnlockedSkills(characterId) {
  const character = characterById[characterId];
  if (!character) return [];
  return [...new Set([
    "strike",
    "mend",
    "bulwark",
    ...character.starterTactics,
    ...character.starterReactives,
  ])];
}

export function freshLoadout(rosterIds) {
  const tactics = {};
  const reactives = {};
  const equipment = {};
  for (const characterId of rosterIds) {
    const option = characterById[characterId];
    if (!option) continue;
    tactics[characterId] = [...option.starterTactics];
    reactives[characterId] = [...option.starterReactives];
    equipment[characterId] = [];
  }
  return { tactics, reactives, equipment };
}

function normalizeLoadout(loadout, rosterIds) {
  const next = clone(loadout ?? freshLoadout(rosterIds));
  for (const characterId of rosterIds) {
    next.tactics[characterId] = [...new Set(next.tactics?.[characterId] ?? [])].slice(0, 2);
    next.reactives[characterId] = [...new Set(next.reactives?.[characterId] ?? [])].slice(0, 2);
    next.equipment[characterId] = [...new Set(next.equipment?.[characterId] ?? [])].slice(0, 2);
  }
  return next;
}

export function equipSkill(loadout, characterId, skillId, kind) {
  const component = COMPONENTS[skillId];
  if (!component || component.kind !== kind || !characterById[characterId]) {
    return { ok: false, reason: "技能か仲間が見つかりません。" };
  }
  const next = normalizeLoadout(loadout, [characterId]);
  const listKey = kind === "active" ? "tactics" : "reactives";
  const list = next[listKey][characterId] ?? [];
  if (list.includes(skillId)) return { ok: false, reason: "その技能はすでに装着されています。" };
  if (list.length >= 2) return { ok: false, reason: "その枠は埋まっています。先に技能を外してください。" };
  next[listKey][characterId] = [skillId, ...list];
  return { ok: true, loadout: next };
}

export function removeSkill(loadout, characterId, skillId, kind) {
  const next = normalizeLoadout(loadout, [characterId]);
  const listKey = kind === "active" ? "tactics" : "reactives";
  const list = next[listKey][characterId] ?? [];
  if (list.length <= 1) return { ok: false, reason: "各仲間には最低1つの技能を残してください。" };
  next[listKey][characterId] = list.filter((id) => id !== skillId);
  return { ok: true, loadout: next };
}

export function equipEquipment(loadout, characterId, equipmentId, slot = 0) {
  const component = COMPONENTS[equipmentId];
  if (!component || component.kind !== "equipment" || !characterById[characterId]) {
    return { ok: false, reason: "装備か仲間が見つかりません。" };
  }
  const next = normalizeLoadout(loadout, Object.keys(loadout?.tactics ?? {}));
  for (const id of Object.keys(next.equipment)) {
    next.equipment[id] = (next.equipment[id] ?? []).filter((item) => item !== equipmentId);
  }
  next.equipment[characterId] ??= [];
  next.equipment[characterId][Math.max(0, Math.min(1, slot))] = equipmentId;
  next.equipment[characterId] = next.equipment[characterId].filter(Boolean).slice(0, 2);
  return { ok: true, loadout: next };
}

export function removeEquipment(loadout, characterId, equipmentId) {
  const next = normalizeLoadout(loadout, Object.keys(loadout?.tactics ?? {}));
  next.equipment[characterId] = (next.equipment[characterId] ?? []).filter((id) => id !== equipmentId);
  return next;
}

export function installComponent(loadout, componentId, characterId) {
  const component = COMPONENTS[componentId];
  if (!component) return { ok: false, reason: "部材が見つかりません。" };
  if (component.kind === "equipment") return equipEquipment(loadout, characterId, componentId, 0);
  return equipSkill(loadout, characterId, componentId, component.kind);
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle(values, seed) {
  const result = [...values];
  let state = hashSeed(seed) || 1;
  const next = () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function rewardOffer(seed, stage, ownedEquipment = [], count = 3) {
  const owned = new Set(ownedEquipment);
  const candidates = Object.keys(EQUIPMENT).filter((id) => !owned.has(id) && id !== "hungry_plate");
  return seededShuffle(candidates, seed + ":reward:" + stage).slice(0, count);
}



export function encounterInfo(stage) {
  return ENCOUNTERS[Math.max(0, Math.min(ENCOUNTERS.length - 1, stage - 1))];
}

export function encounterLabel(stage) {
  return encounterInfo(stage).name;
}

export function stageRule(stage) {
  if (stage <= 1) return "初期構成を組んで、敵の狙いを確認する";
  if (stage <= 3) return "報酬を一つ拾い、技能と装備を再配置する";
  return "傷と装備消耗を抱えたまま、次の問いに答える";
}

export function enemyTargetingText(enemyActorId) {
  return ENEMY_TARGETING[enemyActorId] ?? "前列を優先して狙う。";
}

export function enemyInfo(enemyActorId) {
  const definition = PLAYABLE_CONTENT.enemyActors[enemyActorId];
  return {
    id: enemyActorId,
    label: DISPLAY_NAMES[enemyActorId] ?? definition?.displayName ?? enemyActorId,
    targeting: enemyTargetingText(enemyActorId),
  };
}

export function reorderTactic(loadout, characterId, index, direction) {
  const next = normalizeLoadout(loadout, [characterId]);
  const tactics = next.tactics[characterId] ?? [];
  const otherIndex = index + direction;
  if (index < 0 || index >= tactics.length || otherIndex < 0 || otherIndex >= tactics.length) return next;
  [tactics[index], tactics[otherIndex]] = [tactics[otherIndex], tactics[index]];
  return next;
}

const TACTIC_USE_WHEN = Object.freeze({
  relay_order: [{ type: "history_count", subject: "self", metric: "active_actions", window: "round", op: "eq", value: 0 }],
});

function equipmentInput(characterId, equipmentIds, durability = {}) {
  return equipmentIds.filter((id) => PLAYABLE_CONTENT.equipment[id]).map((equipmentId, index) => ({
    instanceId: "e_" + characterId + "_" + equipmentId + "_" + index,
    equipmentId,
    durability: Math.max(0, durability[equipmentId] ?? PLAYABLE_CONTENT.equipment[equipmentId].maxDurability ?? 1),
  }));
}

function usableTactics(ids) {
  return ids.filter((id) => PLAYABLE_CONTENT.activeSkills[id]).slice(0, 2).map((activeSkillId) => ({
    activeSkillId,
    useWhen: TACTIC_USE_WHEN[activeSkillId] ?? [],
  }));
}

export function makeBattle(
  stage,
  rosterIds = ["warden", "mender", "lancer", "scout"],
  loadout = freshLoadout(rosterIds),
  seed = RUN_SEED,
  formation = {},
  persistent = {},
) {
  const encounter = encounterInfo(stage);
  const selected = rosterIds.filter((characterId) => characterById[characterId]).slice(0, 4);
  const usedPositions = new Set();
  const allies = selected.map((characterId, index) => {
    const option = characterById[characterId];
    let position = formation[characterId] ?? option.defaultPosition;
    if (!POSITIONS.includes(position) || usedPositions.has(position)) {
      position = POSITIONS.find((candidate) => !usedPositions.has(candidate)) ?? POSITIONS[index];
    }
    usedPositions.add(position);
    const tactics = loadout.tactics?.[characterId] ?? option.starterTactics;
    const reactives = loadout.reactives?.[characterId] ?? option.starterReactives;
    const ally = {
      instanceId: "a_" + characterId,
      characterId,
      position,
      tactics: usableTactics(tactics),
      reactiveSkillIds: reactives.filter((id) => PLAYABLE_CONTENT.reactiveSkills[id]).slice(0, 2),
      equipment: equipmentInput(characterId, loadout.equipment?.[characterId] ?? [], persistent.equipmentDurability ?? {}),
    };
    const hp = persistent.hp?.[characterId];
    if (Number.isFinite(hp)) ally.hp = Math.max(0, Math.min(PLAYABLE_CONTENT.characters[characterId].maxHp, hp));
    return ally;
  });
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "frontier_" + String(seed).replace(/[^a-z0-9_]/gi, "_") + "_stage_" + stage,
    maxRounds: encounter.maxRounds,
    objective: { type: "eliminate_all_enemies" },
    allies,
    enemies: clone(encounter.enemies),
  };
}

export function loadoutSummary(loadout, rosterIds) {
  return rosterIds.map((characterId) => ({
    characterId,
    tactics: loadout.tactics?.[characterId] ?? [],
    reactives: loadout.reactives?.[characterId] ?? [],
    equipment: loadout.equipment?.[characterId] ?? [],
  }));
}

export function allEncounters() {
  return clone(ENCOUNTERS);
}

// 分離前の公開名を保つ。content/ 側が正で、ここは通り道。
export { ENEMY_TARGETING as enemyTargeting, SKILL_TREE_NODES, CHARACTER_DEFINITIONS };
