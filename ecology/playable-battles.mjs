import { BATTLE_SCHEMA_VERSION } from "./schema.mjs";
import { PLAYABLE_CONTENT, DISPLAY_NAMES } from "./playable-content.mjs";

// The browser slice uses a fixed grammar and a per-run seed. The engine is
// deterministic; the seed only decides which material is offered and is saved
// with the run so a result can be replayed later.
export const RUN_SEED = "slice-1801";

const objective = { type: "eliminate_all_enemies" };

const CHARACTER_DEFINITIONS = [
  {
    id: "warden",
    role: "前衛",
    icon: "盾",
    position: "front_left",
    summary: "被弾を防壁に変え、時間を買う",
    starterTactics: ["bulwark"],
    starterReactives: ["brace_after_hit"],
  },
  {
    id: "mender",
    role: "後衛",
    icon: "手",
    position: "rear_left",
    summary: "傷を見つけ、余った回復をつなぐ",
    starterTactics: ["mend"],
    starterReactives: ["overflow_care"],
  },
  {
    id: "lancer",
    role: "遊撃",
    icon: "槍",
    position: "front_right",
    summary: "敵を削り、倒した相手の行動権を拾う",
    starterTactics: ["strike"],
    starterReactives: ["scavenge_ap"],
  },
  {
    id: "pivot",
    role: "蓄積",
    icon: "環",
    position: "rear_right",
    summary: "使わなかった行動権を防壁へ変える",
    starterTactics: ["strike"],
    starterReactives: ["guard_step"],
  },
];

export const CHARACTER_OPTIONS = Object.freeze(CHARACTER_DEFINITIONS.map((option) => Object.freeze(option)));
const characterById = Object.fromEntries(CHARACTER_OPTIONS.map((option) => [option.id, option]));

// A component is a real R5 definition, not a theme label. Active tactics are
// inserted before the starter tactic, while reactive skills are inserted before
// the starter reaction. Each actor has two tactic slots, two reactive slots and
// one equipment slot in this slice.
const COMPONENT_DEFINITIONS = {
  heavy_swing: {
    id: "heavy_swing",
    kind: "active",
    definitionId: "heavy_swing",
    label: "溜め突き",
    effect: "準備1回のあと、9ダメージ。",
    grammar: "準備 → 大打撃",
  },
  relay_order: {
    id: "relay_order",
    kind: "active",
    definitionId: "relay_order",
    label: "号令",
    effect: "前衛の最速の味方に行動権を1渡す。",
    grammar: "行動権 → 前衛",
  },
  reposition: {
    id: "reposition",
    kind: "active",
    definitionId: "reposition",
    label: "位置替え",
    effect: "後衛なら、最も傷ついた前衛と場所を替える。",
    grammar: "位置 → 入れ替え",
  },
  triage: {
    id: "triage",
    kind: "active",
    definitionId: "triage",
    label: "応急手当",
    effect: "HP半分以下の味方を8回復する。",
    grammar: "負傷 → 回復",
  },
  hunt_the_slow: {
    id: "hunt_the_slow",
    kind: "active",
    definitionId: "hunt_the_slow",
    label: "準備狩り",
    effect: "準備中の敵を見つけたら5ダメージ。",
    grammar: "準備中 → 追撃",
  },
  counter_blow: {
    id: "counter_blow",
    kind: "reactive",
    definitionId: "counter_blow",
    label: "反撃",
    effect: "敵に殴られたあと、RP1で攻撃者へ2反撃する。",
    grammar: "被弾 → 反撃",
  },
  cover_ally: {
    id: "cover_ally",
    kind: "reactive",
    definitionId: "cover_ally",
    label: "身代わり",
    effect: "敵が味方を狙った瞬間、RP1で自分へ引き受ける。",
    grammar: "狙い → 引き受け",
  },
  overflow_care: {
    id: "overflow_care",
    kind: "reactive",
    definitionId: "overflow_care",
    label: "余剰治療",
    effect: "余った回復を、別の負傷者へ回す。",
    grammar: "余剰 → 回復",
  },
  urging: {
    id: "urging",
    kind: "reactive",
    definitionId: "urging",
    label: "急かす",
    effect: "味方が準備を始めたら、RP1で1段階進める。",
    grammar: "準備開始 → 短縮",
  },
  guard_step: {
    id: "guard_step",
    kind: "reactive",
    definitionId: "guard_step",
    label: "踏み固め",
    effect: "移動したあと、ラウンド防壁2を得る。",
    grammar: "移動 → 防壁",
  },
  triage_relay: {
    id: "triage_relay",
    kind: "reactive",
    definitionId: "triage_relay",
    label: "連携治療",
    effect: "応急手当の余剰を、RP1で別の負傷者へ回す。",
    grammar: "応急手当の余剰 → 回復",
  },
  brace_after_hit: {
    id: "brace_after_hit",
    kind: "reactive",
    definitionId: "brace_after_hit",
    label: "受け流し",
    effect: "被弾後、RP1でラウンド防壁2を得る。",
    grammar: "被弾 → 防壁",
  },
  worn_greaves: {
    id: "worn_greaves",
    kind: "equipment",
    definitionId: "worn_greaves",
    label: "踏み込みの靴",
    effect: "ラウンド最初の発動後、行動権を1得る。",
    grammar: "発動 → 行動権",
  },
  standing_plate: {
    id: "standing_plate",
    kind: "equipment",
    definitionId: "standing_plate",
    label: "継ぎはぎの盾",
    effect: "戦闘開始時、戦闘中防壁2を得る。",
    grammar: "開始 → 防壁",
  },
  splinter_edge: {
    id: "splinter_edge",
    kind: "equipment",
    definitionId: "splinter_edge",
    label: "棘の刃",
    effect: "攻撃の余剰が出ると、耐久1で1ダメージを追加する。",
    grammar: "余剰ダメージ → 追加攻撃",
  },
  field_kit: {
    id: "field_kit",
    kind: "equipment",
    definitionId: "field_kit",
    label: "野営道具",
    effect: "余ったRPを使い、ラウンド1回だけ耐久を1修理する。",
    grammar: "余ったRP → 修理",
  },
  momentum_rig: {
    id: "momentum_rig",
    kind: "equipment",
    definitionId: "momentum_rig",
    label: "勢いの留め具",
    effect: "移動後、耐久1で次の攻撃/回復を強化する。",
    grammar: "移動 → 集中",
  },
};

export const COMPONENTS = Object.freeze(
  Object.fromEntries(Object.entries(COMPONENT_DEFINITIONS).map(([id, component]) => [id, Object.freeze(component)])),
);
export const COMPONENT_ORDER = Object.freeze(Object.keys(COMPONENTS));

const OFFER_POOLS = Object.freeze({
  1: ["heavy_swing", "relay_order", "reposition", "counter_blow", "cover_ally", "standing_plate", "worn_greaves", "field_kit"],
  2: ["triage", "hunt_the_slow", "overflow_care", "urging", "triage_relay", "splinter_edge", "momentum_rig", "standing_plate"],
  3: ["heavy_swing", "relay_order", "triage", "counter_blow", "guard_step", "brace_after_hit", "splinter_edge", "worn_greaves", "momentum_rig"],
});

const encounters = [
  {
    name: "崩れた見張り所",
    enemies: [{ instanceId: "e_husk", enemyActorId: "husk", position: "front_left", hp: 10 }],
    maxRounds: 5,
  },
  {
    name: "二つの足音",
    enemies: [
      { instanceId: "e_husk", enemyActorId: "husk", position: "front_left", hp: 10 },
      { instanceId: "e_warden", enemyActorId: "husk_warden", position: "front_right", hp: 8 },
    ],
    maxRounds: 7,
  },
  {
    name: "灰殻の門",
    enemies: [{ instanceId: "e_bulwark", enemyActorId: "husk_bulwark", position: "front_left", hp: 24 }],
    maxRounds: 8,
  },
];

function clone(value) {
  return structuredClone(value);
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

export function characterInfo(characterId) {
  return characterById[characterId] ?? null;
}

export function componentInfo(componentId) {
  return COMPONENTS[componentId] ?? null;
}

export function componentLabel(componentId) {
  return COMPONENTS[componentId]?.label ?? DISPLAY_NAMES[componentId] ?? componentId;
}

export function componentOffer(seed, stage, ownedComponents = [], count = stage === 1 ? 5 : 3) {
  const owned = new Set(ownedComponents);
  const pool = OFFER_POOLS[stage] ?? COMPONENT_ORDER;
  const candidates = [...new Set([...pool, ...COMPONENT_ORDER])].filter((id) => !owned.has(id));
  const shuffled = seededShuffle(candidates, `${seed}:offer:${stage}`);
  const chosen = [];
  // Every offer is readable as a combination surface: when available, show at
  // least one action, one reaction and one piece of equipment before filling
  // the remaining slots from the seeded order.
  for (const kind of ["active", "reactive", "equipment"]) {
    const match = shuffled.find((id) => COMPONENTS[id]?.kind === kind && !chosen.includes(id));
    if (match) chosen.push(match);
  }
  for (const id of shuffled) {
    if (chosen.length >= count) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen.slice(0, count);
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
    equipment[characterId] = null;
  }
  return { tactics, reactives, equipment };
}

// Install is pure so the UI can use the same slot rules as tests and future
// non-browser clients. Equipment replaces the current item; active/reactive
// components occupy a free second slot and become the first priority.
export function installComponent(loadout, componentId, characterId) {
  const component = COMPONENTS[componentId];
  if (!component || !characterById[characterId]) return { ok: false, reason: "部材か仲間が見つかりません。" };
  const next = clone(loadout);
  next.tactics[characterId] ??= [];
  next.reactives[characterId] ??= [];
  next.equipment[characterId] ??= null;

  if (component.kind === "active") {
    if (next.tactics[characterId].includes(component.definitionId)) return { ok: false, reason: "その行動はすでに装着されています。" };
    if (next.tactics[characterId].length >= 2) return { ok: false, reason: "行動枠が埋まっています。" };
    next.tactics[characterId].unshift(component.definitionId);
  } else if (component.kind === "reactive") {
    if (next.reactives[characterId].includes(component.definitionId)) return { ok: false, reason: "その反応はすでに装着されています。" };
    if (next.reactives[characterId].length >= 2) return { ok: false, reason: "リアクティブ枠が埋まっています。" };
    next.reactives[characterId].unshift(component.definitionId);
  } else {
    next.equipment[characterId] = component.definitionId;
  }
  return { ok: true, loadout: next };
}

export function reorderTactic(loadout, characterId, index, direction) {
  const next = clone(loadout);
  const tactics = next.tactics[characterId] ?? [];
  const otherIndex = index + direction;
  if (index < 0 || index >= tactics.length || otherIndex < 0 || otherIndex >= tactics.length) return next;
  [tactics[index], tactics[otherIndex]] = [tactics[otherIndex], tactics[index]];
  return next;
}

function equipmentInput(characterId, equipmentId) {
  if (!equipmentId) return [];
  const definition = PLAYABLE_CONTENT.equipment[equipmentId];
  return [{
    instanceId: `e_${characterId}_${equipmentId}`,
    equipmentId,
    durability: definition?.maxDurability ?? 1,
  }];
}

export function makeBattle(stage, rosterIds = ["warden", "mender", "lancer"], loadout = freshLoadout(rosterIds), seed = RUN_SEED) {
  const encounter = encounters[Math.max(0, Math.min(encounters.length - 1, stage - 1))];
  const selected = rosterIds.filter((characterId) => characterById[characterId]).slice(0, 4);
  const allies = selected.map((characterId) => {
    const option = characterById[characterId];
    const tactics = loadout.tactics?.[characterId] ?? option.starterTactics;
    const reactives = loadout.reactives?.[characterId] ?? option.starterReactives;
    return {
      instanceId: `a_${characterId}`,
      characterId,
      position: option.position,
      tactics: tactics.map((activeSkillId) => ({ activeSkillId, useWhen: [] })),
      reactiveSkillIds: [...reactives],
      equipment: equipmentInput(characterId, loadout.equipment?.[characterId]),
    };
  });
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: `playable_slice_${String(seed).replace(/[^a-z0-9_]/gi, "_")}_stage_${stage}`,
    maxRounds: encounter.maxRounds,
    objective,
    allies,
    enemies: clone(encounter.enemies),
  };
}

export function encounterLabel(stage) {
  return encounters[Math.max(0, Math.min(encounters.length - 1, stage - 1))].name;
}

export function stageRule(stage) {
  return stage === 1 ? "初期部材を2〜3個装着" : "戦闘後の部材を1個だけ装着";
}

export function loadoutSummary(loadout, rosterIds) {
  return rosterIds.map((characterId) => ({
    characterId,
    tactics: loadout.tactics?.[characterId] ?? [],
    reactives: loadout.reactives?.[characterId] ?? [],
    equipment: loadout.equipment?.[characterId] ?? null,
  }));
}
