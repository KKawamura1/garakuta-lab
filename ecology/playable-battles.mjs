import { BATTLE_SCHEMA_VERSION, POSITIONS } from "./schema.mjs";
import { PLAYABLE_CONTENT, DISPLAY_NAMES } from "./playable-content.mjs";

export const RUN_SEED = "frontier-1801";

const clone = (value) => structuredClone(value);

const CHARACTER_DEFINITIONS = [
  {
    id: "warden",
    role: "守護",
    icon: "盾",
    defaultPosition: "front_left",
    summary: "被弾を受け止め、仲間が動く時間を作る。",
    starterTactics: ["bulwark", "strike"],
    starterReactives: ["brace_after_hit", "cover_ally"],
  },
  {
    id: "mender",
    role: "治療",
    icon: "手",
    defaultPosition: "rear_left",
    summary: "傷ついた仲間を立て直し、余った回復も無駄にしない。",
    starterTactics: ["mend", "triage"],
    starterReactives: ["overflow_care", "triage_relay"],
  },
  {
    id: "lancer",
    role: "攻撃",
    icon: "槍",
    defaultPosition: "front_right",
    summary: "弱った敵を仕留め、撃破から次の行動を引き出す。",
    starterTactics: ["strike", "heavy_swing"],
    starterReactives: ["scavenge_ap", "counter_blow"],
  },
  {
    id: "scout",
    role: "機動",
    icon: "目",
    defaultPosition: "rear_right",
    summary: "敵の準備を読み、位置を変えて前線を整える。",
    starterTactics: ["mark_target", "reposition"],
    starterReactives: ["guard_step", "urging"],
  },
  {
    id: "pivot",
    role: "蓄積",
    icon: "環",
    defaultPosition: "rear_left",
    summary: "余った行動権を防壁に変え、長期戦を支える。",
    starterTactics: ["strike", "bulwark"],
    starterReactives: ["guard_step", "scavenge_ap"],
  },
  {
    id: "guardian",
    role: "庇護",
    icon: "庇",
    defaultPosition: "front_right",
    summary: "標的を引き受け、守りを攻撃へつなげる。",
    starterTactics: ["bulwark", "strike"],
    starterReactives: ["cover_ally", "brace_after_hit"],
  },
  {
    id: "arcanist",
    role: "準備攻撃",
    icon: "灯",
    defaultPosition: "rear_right",
    summary: "時間のかかる大技を、仲間の反応で完成させる。",
    starterTactics: ["heavy_swing", "steady_aim"],
    starterReactives: ["urging", "prep_spiral"],
  },
  {
    id: "tactician",
    role: "指揮",
    icon: "旗",
    defaultPosition: "rear_left",
    summary: "仲間へ行動権を渡し、遅い構成にも順番を作る。",
    starterTactics: ["relay_order", "mark_target"],
    starterReactives: ["guard_step", "triage_relay"],
  },
];

export const CHARACTER_OPTIONS = Object.freeze(
  CHARACTER_DEFINITIONS.map((option) => Object.freeze(option)),
);
const characterById = Object.fromEntries(CHARACTER_OPTIONS.map((option) => [option.id, option]));

const activeMeta = {
  strike: ["斬撃", "最も弱った敵へ4ダメージ。", "攻撃"],
  mend: ["手当て", "最も傷ついた味方を5回復。", "支援"],
  bulwark: ["防壁形成", "自分にラウンド防壁3。", "守り"],
  relay_order: ["号令", "前衛の最速の味方へ行動権を1渡す。", "指揮"],
  heavy_swing: ["溜め突き", "準備1回のあと、最も傷ついた敵へ9ダメージ。", "攻撃"],
  reposition: ["位置替え", "後衛なら、最も傷ついた前衛と場所を替える。", "機動"],
  long_swing: ["大溜め", "準備3回のあと、最も傷ついた敵へ9ダメージ。", "攻撃"],
  triage: ["応急手当", "HP半分以下の味方を8回復。", "支援"],
  hunt_the_slow: ["準備狩り", "準備中の敵へ5ダメージ。", "攻撃"],
  idle_shuffle: ["息を整える", "自分に集中を1つ付ける。集中中は使わない。", "準備"],
  mark_target: ["隙を刻む", "最もHPの高い敵に「隙」を1つ付ける。", "指揮"],
  steady_aim: ["狙いを澄ます", "自分に「集中」を1つ付ける。", "準備"],
};

const reactiveMeta = {
  counter_blow: ["反撃", "敵に殴られたあと、RP1で攻撃者へ2ダメージ。", "被弾"],
  cover_ally: ["身代わり", "敵が味方を狙った瞬間、RP1で自分へ引き受ける。", "標的"],
  overflow_care: ["余剰治療", "余った回復を別の負傷者へ回す。", "回復"],
  scavenge_ap: ["拾い直し", "敵を倒したとき、行動権を1得る。", "撃破"],
  guard_step: ["踏み固め", "移動したあと、ラウンド防壁2を得る。", "移動"],
  urging: ["急かす", "味方の準備開始時、RP1で準備を1進める。", "準備"],
  brace_after_hit: ["受け流し", "被弾後、RP1でラウンド防壁2を得る。", "被弾"],
  triage_relay: ["連携治療", "応急手当の余剰を別の負傷者へ回す。", "回復"],
  ap_loop: ["行動権の循環", "行動権を得たとき、前衛へもう一度渡す。", "資源"],
  damage_echo: ["痛みの反響", "被弾した敵へ1ダメージを返す。", "被弾"],
  barrier_bloom: ["防壁の花", "防壁を得たとき、さらに防壁1。", "防壁"],
  prep_spiral: ["準備の螺旋", "準備が進むたび、自分の準備をさらに1段進める。", "準備"],
};

const equipmentMeta = {
  worn_greaves: ["踏み込みの靴", "ラウンド最初の発動後、行動権を1得る。", "速度", 2],
  splinter_edge: ["棘の刃", "余ったダメージが出ると、耐久1で1ダメージを追加。", "攻撃", 2],
  field_kit: ["野営道具", "余ったRPを使い、耐久1を修理する。", "修理", 2],
  standing_plate: ["継ぎはぎの盾", "戦闘開始時、戦闘中防壁2を得る。", "防御", 3],
  momentum_rig: ["勢いの留め具", "移動後、耐久1で「集中」を得る。", "機動", 2],
  hungry_plate: ["喰らう板", "戦闘開始時に耐久を使い、後続の摩耗を誘発する。", "消耗", 3],
  guard_lantern: ["守り火", "小さな防壁を長く維持する。", "防御", 2],
  bastion_shell: ["厚い継ぎ板", "戦闘開始時、防壁3。", "防御", 3],
  tempo_buckle: ["拍子の留め具", "ラウンド最初の発動後、行動権を得る。耐久1。", "速度", 1],
  quickstrap: ["軽い締め具", "発動後の行動権を狙う。耐久が高い。", "速度", 3],
  reserve_coil: ["予備のばね", "ラウンド最初の発動後、行動権を得る。", "速度", 4],
  focus_band: ["集中の帯", "移動後、「集中」を得る。耐久1。", "機動", 1],
  anchor_boots: ["錨の靴", "移動後、「集中」を得る。耐久が高い。", "機動", 3],
  signal_lens: ["合図のレンズ", "移動後、「集中」を得る。", "機動", 4],
  thorn_clasp: ["返しの留め具", "余ったダメージから追加攻撃。耐久1。", "攻撃", 1],
  shard_hilt: ["破片の柄", "余ったダメージから追加攻撃。", "攻撃", 3],
  repair_pouch: ["修繕袋", "余ったRPで装備を修理する。耐久1。", "修理", 1],
  recovery_satchel: ["大きな救急袋", "余ったRPで装備を2修理する。", "修理", 4],
};

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
  active: Object.freeze(metadata(activeMeta, "active")),
  reactive: Object.freeze(metadata(reactiveMeta, "reactive")),
});
export const EQUIPMENT = Object.freeze(metadata(equipmentMeta, "equipment"));
export const COMPONENTS = Object.freeze({
  ...SKILLS.active,
  ...SKILLS.reactive,
  ...EQUIPMENT,
});
export const COMPONENT_ORDER = Object.freeze(Object.keys(COMPONENTS));

export const SKILL_TREE_NODES = Object.freeze([
  { id: "node_strike", skillId: "strike", kind: "active", branch: "攻撃", tier: 0, cost: 0, requires: [] },
  { id: "node_heavy", skillId: "heavy_swing", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_long", skillId: "long_swing", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["heavy_swing"] },
  { id: "node_hunt", skillId: "hunt_the_slow", kind: "active", branch: "攻撃", tier: 2, cost: 2, requires: ["heavy_swing"] },
  { id: "node_relay", skillId: "relay_order", kind: "active", branch: "指揮", tier: 0, cost: 0, requires: [] },
  { id: "node_reposition", skillId: "reposition", kind: "active", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  { id: "node_mark", skillId: "mark_target", kind: "active", branch: "指揮", tier: 2, cost: 1, requires: ["reposition"] },
  { id: "node_aim", skillId: "steady_aim", kind: "active", branch: "指揮", tier: 2, cost: 2, requires: ["mark_target"] },
  { id: "node_mend", skillId: "mend", kind: "active", branch: "支援", tier: 0, cost: 0, requires: [] },
  { id: "node_triage", skillId: "triage", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_idle", skillId: "idle_shuffle", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_bulwark", skillId: "bulwark", kind: "active", branch: "守り", tier: 0, cost: 0, requires: [] },
  { id: "node_counter", skillId: "counter_blow", kind: "reactive", branch: "攻撃", tier: 0, cost: 1, requires: ["strike"] },
  { id: "node_echo", skillId: "damage_echo", kind: "reactive", branch: "攻撃", tier: 1, cost: 2, requires: ["counter_blow"] },
  { id: "node_scavenge", skillId: "scavenge_ap", kind: "reactive", branch: "指揮", tier: 0, cost: 1, requires: ["strike"] },
  { id: "node_step", skillId: "guard_step", kind: "reactive", branch: "指揮", tier: 1, cost: 1, requires: ["scavenge_ap"] },
  { id: "node_cover", skillId: "cover_ally", kind: "reactive", branch: "守り", tier: 0, cost: 1, requires: ["bulwark"] },
  { id: "node_brace", skillId: "brace_after_hit", kind: "reactive", branch: "守り", tier: 1, cost: 1, requires: ["cover_ally"] },
  { id: "node_bloom", skillId: "barrier_bloom", kind: "reactive", branch: "守り", tier: 2, cost: 2, requires: ["brace_after_hit"] },
  { id: "node_overflow", skillId: "overflow_care", kind: "reactive", branch: "支援", tier: 0, cost: 1, requires: ["mend"] },
  { id: "node_triage_relay", skillId: "triage_relay", kind: "reactive", branch: "支援", tier: 1, cost: 1, requires: ["overflow_care"] },
  { id: "node_urging", skillId: "urging", kind: "reactive", branch: "支援", tier: 0, cost: 1, requires: ["mend"] },
  { id: "node_prep_spiral", skillId: "prep_spiral", kind: "reactive", branch: "支援", tier: 1, cost: 2, requires: ["urging"] },
  { id: "node_ap_loop", skillId: "ap_loop", kind: "reactive", branch: "指揮", tier: 1, cost: 2, requires: ["scavenge_ap"] },
]);

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

const encounters = [
  {
    stage: 1,
    name: "灰の入口",
    description: "正面から来る二体。前列が受け、攻撃役が一体ずつ落とす。",
    enemies: [
      { instanceId: "e_scrapper_1", enemyActorId: "gray_scrapper", position: "front_left", hp: 10 },
      { instanceId: "e_scrapper_2", enemyActorId: "gray_scrapper", position: "front_right", hp: 10 },
    ],
    maxRounds: 6,
  },
  {
    stage: 2,
    name: "狩りの路地",
    description: "準備中の味方を狙う狩人と、後列を狙う射手。",
    enemies: [
      { instanceId: "e_hunter", enemyActorId: "gray_hunter", position: "front_left", hp: 20 },
      { instanceId: "e_marksman", enemyActorId: "gray_marksman", position: "rear_left", hp: 12 },
    ],
    maxRounds: 7,
  },
  {
    stage: 3,
    name: "崩れた盾列",
    description: "防壁を張り直す守衛を、印と準備で崩す。",
    enemies: [
      { instanceId: "e_guard", enemyActorId: "gray_guard", position: "front_left", hp: 18 },
      { instanceId: "e_scrapper", enemyActorId: "gray_scrapper", position: "front_right", hp: 10 },
    ],
    maxRounds: 8,
  },
  {
    stage: 4,
    name: "反響の坑道",
    description: "敵を殴るほど返ってくる。単発の大打撃と回復を使い分ける。",
    enemies: [
      { instanceId: "e_echo", enemyActorId: "gray_echo", position: "front_left", hp: 20 },
      { instanceId: "e_marksman", enemyActorId: "gray_marksman", position: "rear_left", hp: 12 },
    ],
    maxRounds: 8,
  },
  {
    stage: 5,
    name: "灰の圧力",
    description: "重い盾、狩人、走者。どの役割を厚くするかが問われる。",
    enemies: [
      { instanceId: "e_bulwark", enemyActorId: "gray_bulwark", position: "front_left", hp: 32 },
      { instanceId: "e_hunter", enemyActorId: "gray_hunter", position: "front_right", hp: 20 },
      { instanceId: "e_scrapper", enemyActorId: "gray_scrapper", position: "rear_left", hp: 10 },
    ],
    maxRounds: 9,
  },
  {
    stage: 6,
    name: "二つの狙い",
    description: "前列を削る守衛と、後列を狙う射手。配置そのものが防御になる。",
    enemies: [
      { instanceId: "e_guard", enemyActorId: "gray_guard", position: "front_left", hp: 18 },
      { instanceId: "e_marksman", enemyActorId: "gray_marksman", position: "rear_left", hp: 12 },
      { instanceId: "e_echo", enemyActorId: "gray_echo", position: "front_right", hp: 20 },
    ],
    maxRounds: 10,
  },
  {
    stage: 7,
    name: "灰の核心",
    description: "準備する核心を止めながら、前列の護衛を突破する最終戦。",
    enemies: [
      { instanceId: "e_core", enemyActorId: "ash_core", position: "front_left", hp: 54 },
      { instanceId: "e_guard", enemyActorId: "gray_guard", position: "front_right", hp: 18 },
      { instanceId: "e_marksman", enemyActorId: "gray_marksman", position: "rear_left", hp: 12 },
    ],
    maxRounds: 12,
  },
];

const enemyTargeting = {
  gray_scrapper: "前列の生存者を、左から狙う。",
  gray_marksman: "後列の生存者を優先して狙う。",
  gray_guard: "前列を狙い、最初の行動で防壁を張る。",
  gray_hunter: "準備中の味方を見つければ先に狙う。いなければ前列。",
  gray_echo: "前列を殴り、受けたダメージを反響する。",
  gray_bulwark: "防壁を張り直しながら前列を狙う。",
  ash_core: "重い一撃を準備し、完成したら前列へ放つ。",
};

export function encounterInfo(stage) {
  return encounters[Math.max(0, Math.min(encounters.length - 1, stage - 1))];
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
  return enemyTargeting[enemyActorId] ?? "前列を優先して狙う。";
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
  return clone(encounters);
}

export { enemyTargeting };
