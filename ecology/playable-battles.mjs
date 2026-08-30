import { BATTLE_SCHEMA_VERSION, POSITIONS, POSITION_ROW } from "./schema.mjs";
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

// R6 §5.4 — 5人編成、2×3、空きは必ず一枠。
export const PARTY_SIZE = 5;
export const ROW_CAPACITY = 3;

// 有効な隊列は**前3後2 か 前2後3 だけ**。前1後4 と前4後1 は作れない。
// 前3は single melee を分散しやすいが front-row attack が3人へ当たる。
// 前2は後列を3人置けるが、前列一人あたりの被弾が増える。**そこが選択になる。**
export function isValidRowSplit(frontCount, partySize = PARTY_SIZE) {
  return frontCount >= partySize - ROW_CAPACITY && frontCount <= ROW_CAPACITY;
}

// 隊列を必ず有効な形へ落とす。**置き場所の規則はここ一箇所にしかない**
// （画面側にもう一つ持つと、いつか片方だけが直る）。
export function normalizeFormation(formation, rosterIds) {
  const members = (rosterIds ?? []).filter((id) => characterById[id]).slice(0, PARTY_SIZE);
  const next = {};
  const used = new Set();

  // 1. 希望どおりに置けるものを置く（既存の save はここで全部決まる）。
  for (const id of members) {
    const requested = formation?.[id];
    if (POSITIONS.includes(requested) && !used.has(requested)) {
      next[id] = requested;
      used.add(requested);
    }
  }
  // 2. 残りは既定位置を優先し、埋まっていれば空きの先頭へ。
  for (const id of members) {
    if (next[id]) continue;
    const preferred = characterById[id]?.defaultPosition;
    const slot = POSITIONS.includes(preferred) && !used.has(preferred)
      ? preferred
      : POSITIONS.find((candidate) => !used.has(candidate));
    if (!slot) break;
    next[id] = slot;
    used.add(slot);
  }
  // 3. 行の偏りを直す。**ここが無いと、旧 save から前4後1 が生まれる。**
  const rowMembers = (row) => members.filter((id) => next[id] && POSITION_ROW[next[id]] === row);
  const freeIn = (row) => POSITIONS.filter((p) => POSITION_ROW[p] === row && !used.has(p));
  for (let guard = 0; guard <= PARTY_SIZE; guard += 1) {
    const front = rowMembers("front");
    if (isValidRowSplit(front.length, members.length)) break;
    const from = front.length > ROW_CAPACITY ? "front" : "rear";
    const movers = rowMembers(from);
    const mover = movers[movers.length - 1];
    const slot = freeIn(from === "front" ? "rear" : "front")[0];
    if (!mover || !slot) break;
    used.delete(next[mover]);
    next[mover] = slot;
    used.add(slot);
  }
  return next;
}

// 旧 save は4人。**5人目を決定的に足す**（並び順の先頭から、まだ居ない人）。
export function ensurePartySize(rosterIds) {
  const roster = (rosterIds ?? []).filter((id) => characterById[id]).slice(0, PARTY_SIZE);
  for (const option of CHARACTER_OPTIONS) {
    if (roster.length >= PARTY_SIZE) break;
    if (!roster.includes(option.id)) roster.push(option.id);
  }
  return roster;
}

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
  rosterIds = ["warden", "mender", "lancer", "scout", "guardian"],
  loadout = freshLoadout(rosterIds),
  seed = RUN_SEED,
  formation = {},
  persistent = {},
) {
  const encounter = encounterInfo(stage);
  const selected = rosterIds.filter((characterId) => characterById[characterId]).slice(0, PARTY_SIZE);
  // **置き場所の規則は normalizeFormation にしかない。**ここで別に決めると、
  // 画面が見せている隊列と戦闘に入る隊列がずれる。
  const placed = normalizeFormation(formation, selected);
  const allies = selected.map((characterId) => {
    const option = characterById[characterId];
    const position = placed[characterId] ?? option.defaultPosition;
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
