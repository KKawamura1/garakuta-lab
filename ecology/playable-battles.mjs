import { BATTLE_SCHEMA_VERSION, POSITIONS, POSITION_ROW } from "./schema.mjs";
import { seededShuffle } from "./seeded.mjs";
import {
  ACTIVE_META,
  CHARACTER_DEFINITIONS,
  DISPLAY_NAMES,
  ENCOUNTERS,
  ENEMY_TARGETING,
  EQUIPMENT_META,
  PLAYABLE_CONTENT,
  PASSIVE_META,
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
  passive: Object.freeze(metadata(PASSIVE_META, "passive")),
});
export const EQUIPMENT = Object.freeze(metadata(EQUIPMENT_META, "equipment"));
export const COMPONENTS = Object.freeze({
  ...SKILLS.active,
  ...SKILLS.reactive,
  ...SKILLS.passive,
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

// R6 §6.6 — 基本 3 active / 3 reactive / 2 passive。
// **PHASE B: 第4枠は人物ごとの永続購入**なので、実際の上限は人物ごとに違う。
// 呼び出し側は progression.slotLimits(profile, characterId) を渡す。
// 渡さなかったときは基本値で、Phase A と同じ振る舞いになる。
export const SLOT_LIMITS = Object.freeze({ active: 3, reactive: 3, passive: 2, equipment: 2 });
const LOADOUT_KEYS = Object.freeze({ active: "tactics", reactive: "reactives", passive: "passives" });

export function freshLoadout(rosterIds) {
  const tactics = {};
  const reactives = {};
  const passives = {};
  const equipment = {};
  for (const characterId of rosterIds) {
    const option = characterById[characterId];
    if (!option) continue;
    tactics[characterId] = [...option.starterTactics];
    reactives[characterId] = [...option.starterReactives];
    // **常設は空から始める。**基礎訓練は詰み防止であって、既定の答えではない
    // （最初から入れておくと「他に欲しいものが無かった」の信号が消える）。
    passives[characterId] = [];
    equipment[characterId] = [];
  }
  return { tactics, reactives, passives, equipment };
}

function normalizeLoadout(loadout, rosterIds, limitsFor) {
  const next = clone(loadout ?? freshLoadout(rosterIds));
  // 旧 save には passives が無い。**足りない鍵はここで生やす**
  // （呼び出し側それぞれで面倒を見ると、いつか一箇所が忘れる）。
  next.passives = next.passives ?? {};
  for (const characterId of rosterIds) {
    const limits = limitsOf(limitsFor, characterId);
    next.tactics[characterId] = [...new Set(next.tactics?.[characterId] ?? [])].slice(0, limits.active);
    next.reactives[characterId] = [...new Set(next.reactives?.[characterId] ?? [])].slice(0, limits.reactive);
    next.passives[characterId] = [...new Set(next.passives?.[characterId] ?? [])].slice(0, limits.passive);
    next.equipment[characterId] = [...new Set(next.equipment?.[characterId] ?? [])].slice(0, limits.equipment);
  }
  return next;
}

// 枠の上限をここ一箇所で解く。関数でも表でも渡せる（人物ごとに違うので）。
function limitsOf(limitsFor, characterId) {
  if (typeof limitsFor === "function") return { ...SLOT_LIMITS, ...limitsFor(characterId) };
  if (limitsFor && typeof limitsFor === "object") return { ...SLOT_LIMITS, ...limitsFor };
  return SLOT_LIMITS;
}

export function equipSkill(loadout, characterId, skillId, kind, limitsFor) {
  const component = COMPONENTS[skillId];
  if (!component || component.kind !== kind || !characterById[characterId]) {
    return { ok: false, reason: "技能か仲間が見つかりません。" };
  }
  const next = normalizeLoadout(loadout, [characterId], limitsFor);
  const listKey = LOADOUT_KEYS[kind];
  if (!listKey) return { ok: false, reason: "その枠はありません。" };
  const list = next[listKey][characterId] ?? [];
  if (list.includes(skillId)) return { ok: false, reason: "その技能はすでに装着されています。" };
  if (list.length >= limitsOf(limitsFor, characterId)[kind]) {
    return { ok: false, reason: "その枠は埋まっています。先に技能を外してください。" };
  }
  next[listKey][characterId] = [skillId, ...list];
  return { ok: true, loadout: next };
}

export function removeSkill(loadout, characterId, skillId, kind, limitsFor) {
  const next = normalizeLoadout(loadout, [characterId], limitsFor);
  const listKey = LOADOUT_KEYS[kind];
  if (!listKey) return { ok: false, reason: "その枠はありません。" };
  const list = next[listKey][characterId] ?? [];
  // どの種類の技能も0個まで外せる。行動が空でも、engine が通常攻撃へ戻す。
  // 反応・常設が空なら、その種類の追加効果なしとして解決する。
  next[listKey][characterId] = list.filter((id) => id !== skillId);
  return { ok: true, loadout: next };
}

export function equipEquipment(loadout, characterId, equipmentId, slot = 0, limitsFor) {
  const component = COMPONENTS[equipmentId];
  if (!component || component.kind !== "equipment" || !characterById[characterId]) {
    return { ok: false, reason: "装備か仲間が見つかりません。" };
  }
  const next = normalizeLoadout(loadout, Object.keys(loadout?.tactics ?? {}), limitsFor);
  for (const id of Object.keys(next.equipment)) {
    next.equipment[id] = (next.equipment[id] ?? []).filter((item) => item !== equipmentId);
  }
  next.equipment[characterId] ??= [];
  next.equipment[characterId][Math.max(0, Math.min(1, slot))] = equipmentId;
  next.equipment[characterId] = next.equipment[characterId].filter(Boolean).slice(0, 2);
  return { ok: true, loadout: next };
}

export function removeEquipment(loadout, characterId, equipmentId, limitsFor) {
  const next = normalizeLoadout(loadout, Object.keys(loadout?.tactics ?? {}), limitsFor);
  next.equipment[characterId] = (next.equipment[characterId] ?? []).filter((id) => id !== equipmentId);
  return next;
}

export function installComponent(loadout, componentId, characterId, limitsFor) {
  const component = COMPONENTS[componentId];
  if (!component) return { ok: false, reason: "部材が見つかりません。" };
  if (component.kind === "equipment") return equipEquipment(loadout, characterId, componentId, 0, limitsFor);
  return equipSkill(loadout, characterId, componentId, component.kind, limitsFor);
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

export function reorderTactic(loadout, characterId, index, direction, limitsFor) {
  const next = normalizeLoadout(loadout, [characterId], limitsFor);
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

// **装着した行動枠を、そのまま戦闘へ渡す。**
//
// ここは長く `slice(0, 2)` だった。v1 の枠数が2だった頃の名残で、Phase A が
// 枠を3へ増やしたあとも残っていたため、**3つ目に置いた行動が戦闘に入らず
// 黙って消えていた**（画面には装着済みと出る）。Phase B で第4枠を売る前に直す。
// 上限は validate.mjs の LIMITS.maxTactics が拒否する。
function usableTactics(ids, limit = SLOT_LIMITS.active) {
  return ids.filter((id) => PLAYABLE_CONTENT.activeSkills[id]).slice(0, limit).map((activeSkillId) => ({
    activeSkillId,
    useWhen: TACTIC_USE_WHEN[activeSkillId] ?? [],
  }));
}

// 味方1人ぶんの battle input。**編成・技能・装備・鍛錬をここでだけ組む。**
// 7区画の試作（makeBattle）と12戦の遠征（makeExpeditionBattle）が同じ関数を通る。
function allyInput(characterId, position, loadout, options = {}) {
  const limits = options.limitsFor
    ? { ...SLOT_LIMITS, ...(typeof options.limitsFor === "function" ? options.limitsFor(characterId) : options.limitsFor) }
    : SLOT_LIMITS;
  const option = characterById[characterId];
  const tactics = loadout.tactics?.[characterId] ?? option.starterTactics;
  const reactives = loadout.reactives?.[characterId] ?? option.starterReactives;
  const ally = {
    instanceId: "a_" + characterId,
    characterId,
    position,
    tactics: usableTactics(tactics, limits.active),
    reactiveSkillIds: reactives.filter((id) => PLAYABLE_CONTENT.reactiveSkills[id]).slice(0, limits.reactive),
    passiveSkillIds: (loadout.passives?.[characterId] ?? [])
      .filter((id) => PLAYABLE_CONTENT.passiveSkills[id]).slice(0, limits.passive),
    equipment: equipmentInput(characterId, loadout.equipment?.[characterId] ?? [], options.equipmentDurability ?? {}),
  };
  // R6 §9.5 — PHASE B. 鍛錬後の stat と、その level。**engine は鍛錬を知らない**
  // ので、丸め済みの値と記録の両方をここで渡す。
  const trained = options.statsFor?.(characterId) ?? null;
  if (trained) {
    ally.stats = { ...trained.stats };
    ally.training = { ...trained.training };
  }
  const hp = options.hp?.[characterId];
  const ceiling = ally.stats?.maxHp ?? PLAYABLE_CONTENT.characters[characterId].maxHp;
  if (Number.isFinite(hp)) ally.hp = Math.max(0, Math.min(ceiling, hp));
  return ally;
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
  const allies = selected.map((characterId) => allyInput(
    characterId,
    placed[characterId] ?? characterById[characterId].defaultPosition,
    loadout,
    { hp: persistent.hp, equipmentDurability: persistent.equipmentDurability, limitsFor: persistent.limitsFor, statsFor: persistent.statsFor },
  ));
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "frontier_" + String(seed).replace(/[^a-z0-9_]/gi, "_") + "_stage_" + stage,
    maxRounds: encounter.maxRounds,
    objective: { type: "eliminate_all_enemies" },
    allies,
    enemies: clone(encounter.enemies),
  };
}

// R6 §5.1 / §11 — PHASE B. 12戦の遠征の一戦。
//
// **敵は composeEncounter が決めた形をそのまま渡す。**難易度で増える増援と変異は
// 既に stat と mutation 名になっていて、ここでは何も足さない
// （難易度の三層を同じ場所で動かさないため。R7 §8）。
export function makeExpeditionBattle(composed, rosterIds, loadout, seed, formation = {}, options = {}) {
  const selected = rosterIds.filter((characterId) => characterById[characterId]).slice(0, PARTY_SIZE);
  const placed = normalizeFormation(formation, selected);
  const allies = selected.map((characterId) => allyInput(
    characterId,
    placed[characterId] ?? characterById[characterId].defaultPosition,
    loadout,
    options,
  ));
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "expedition_" + String(seed).replace(/[^a-z0-9_]/gi, "_") + "_e" + composed.index,
    maxRounds: composed.maxRounds,
    objective: { type: "eliminate_all_enemies" },
    allies,
    enemies: composed.enemies.map((enemy) => ({
      instanceId: enemy.instanceId,
      enemyActorId: enemy.enemyActorId,
      position: enemy.position,
      stats: { ...enemy.stats },
      ...(enemy.mutations.length ? { mutations: [...enemy.mutations] } : {}),
    })),
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

