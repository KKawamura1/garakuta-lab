import { BATTLE_SCHEMA_VERSION } from "./schema.mjs";

const objective = { type: "eliminate_all_enemies" };

const PACKAGES = {
  guard: {
    name: "守る",
    short: "受け止めて、次へ渡す",
    detail: "ユウリが防壁を張る。長く耐えることで、反応の余地を作る。",
    setTactics: { warden: ["bulwark", "strike"] },
    addReactives: [],
    equipment: [{ characterId: "warden", equipmentId: "standing_plate", instanceId: "pack_plate" }],
  },
  rhythm: {
    name: "溜める",
    short: "一手を遅らせて、大きく返す",
    detail: "レオンが溜め突きを使う。ミナの急かしが準備を短くする。",
    setTactics: { lancer: ["heavy_swing", "strike"] },
    setReactives: { mender: ["counter_blow", "urging"] },
    addReactives: [{ characterId: "mender", skillId: "urging" }],
    equipment: [{ characterId: "lancer", equipmentId: "momentum_rig", instanceId: "pack_momentum" }],
  },
  overflow: {
    name: "循環させる",
    short: "余ったものを、次の一手へ",
    detail: "ミナの手当てとレオンの棘の刃で、余剰を無駄にしない。",
    setTactics: { mender: ["mend", "strike"] },
    addReactives: [],
    equipment: [
      { characterId: "mender", equipmentId: "field_kit", instanceId: "pack_kit" },
      { characterId: "lancer", equipmentId: "splinter_edge", instanceId: "pack_edge" },
    ],
  },
};

export const DOCTRINES = Object.freeze(PACKAGES);

const baseAllies = [
  {
    instanceId: "a_warden",
    characterId: "warden",
    position: "front_left",
    tactics: [{ activeSkillId: "strike", useWhen: [] }],
    reactiveSkillIds: [],
    equipment: [{ instanceId: "e_greaves", equipmentId: "worn_greaves", durability: 2 }],
  },
  {
    instanceId: "a_mender",
    characterId: "mender",
    position: "rear_left",
    tactics: [
      { activeSkillId: "mend", useWhen: [] },
      { activeSkillId: "strike", useWhen: [] },
    ],
    reactiveSkillIds: ["overflow_care", "counter_blow"],
    equipment: [],
  },
  {
    instanceId: "a_lancer",
    characterId: "lancer",
    position: "front_right",
    tactics: [{ activeSkillId: "strike", useWhen: [] }],
    reactiveSkillIds: ["scavenge_ap"],
    equipment: [],
  },
];

const encounters = [
  { name: "崩れた見張り所", enemies: [{ instanceId: "e_husk", enemyActorId: "husk", position: "front_left", hp: 10 }], maxRounds: 5 },
  {
    name: "二つの足音",
    enemies: [
      { instanceId: "e_husk", enemyActorId: "husk", position: "front_left", hp: 10 },
      { instanceId: "e_warden", enemyActorId: "husk_warden", position: "front_right", hp: 8 },
    ],
    maxRounds: 7,
  },
  { name: "灰殻の門", enemies: [{ instanceId: "e_bulwark", enemyActorId: "husk_bulwark", position: "front_left", hp: 24 }], maxRounds: 8 },
];

function clone(value) {
  return structuredClone(value);
}

function applyPackage(allies, packageId) {
  const pack = PACKAGES[packageId];
  if (!pack) return;
  for (const ally of allies) {
    const tactics = pack.setTactics[ally.characterId];
    if (tactics) ally.tactics = tactics.map((activeSkillId) => ({ activeSkillId, useWhen: [] }));
    const reactives = pack.setReactives?.[ally.characterId];
    if (reactives) ally.reactiveSkillIds = [...reactives];
    for (const addition of pack.addReactives) {
      if (addition.characterId === ally.characterId && !ally.reactiveSkillIds.includes(addition.skillId)) {
        ally.reactiveSkillIds.push(addition.skillId);
      }
    }
    for (const item of pack.equipment) {
      if (item.characterId !== ally.characterId || ally.equipment.some((entry) => entry.equipmentId === item.equipmentId)) continue;
      const maxDurability = ["field_kit", "momentum_rig", "splinter_edge"].includes(item.equipmentId) ? 2 : 3;
      ally.equipment.push({ instanceId: item.instanceId, equipmentId: item.equipmentId, durability: maxDurability });
    }
  }
}

export function makeBattle(stage, packageIds = []) {
  const encounter = encounters[Math.max(0, Math.min(encounters.length - 1, stage - 1))];
  const allies = clone(baseAllies);
  packageIds.forEach((packageId) => applyPackage(allies, packageId));
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: `playable_slice_stage_${stage}`,
    maxRounds: encounter.maxRounds,
    objective,
    allies,
    enemies: clone(encounter.enemies),
  };
}

export function encounterLabel(stage) {
  return encounters[Math.max(0, Math.min(encounters.length - 1, stage - 1))].name;
}

export function packageLabel(packageId) {
  return PACKAGES[packageId]?.name ?? packageId;
}

export function packageDetail(packageId) {
  return PACKAGES[packageId]?.detail ?? "";
}
