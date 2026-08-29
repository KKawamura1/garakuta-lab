import { FIXTURE_CONTENT } from "./fixture-content.mjs";

const clone = (value) => structuredClone(value);

const sectionNames = {
  characters: {
    warden: "ユウリ — 守る人",
    mender: "ミナ — 手当てする人",
    lancer: "レオン — 切り込む人",
    scout: "スイ — 先を読む人",
    pivot: "カイ — 余りを活かす人",
    guardian: "ナギ — かばう人",
    arcanist: "アオ — 溜める人",
    tactician: "トワ — つなぐ人",
  },
  activeSkills: {
    strike: "斬撃",
    mend: "手当て",
    bulwark: "防壁形成",
    relay_order: "号令",
    heavy_swing: "溜め突き",
    reposition: "位置替え",
    long_swing: "大溜め",
    triage: "応急手当",
    hunt_the_slow: "準備狩り",
    idle_shuffle: "息を整える",
    mark_target: "隙を刻む",
    steady_aim: "狙いを澄ます",
    front_strike: "前列打ち",
    rear_strike: "後列打ち",
    enemy_heavy: "重い一撃",
    enemy_guard: "盾を構える",
  },
  reactiveSkills: {
    counter_blow: "反撃",
    cover_ally: "身代わり",
    overflow_care: "余剰治療",
    scavenge_ap: "拾い直し",
    guard_step: "踏み固め",
    urging: "急かす",
    brace_after_hit: "受け流し",
    triage_relay: "連携治療",
    ap_loop: "行動権の循環",
    damage_echo: "痛みの反響",
    barrier_bloom: "防壁の花",
    relay_front: "前列への号令",
    relay_rear: "後列への号令",
    prep_spiral: "準備の螺旋",
  },
  equipment: {
    worn_greaves: "踏み込みの靴",
    splinter_edge: "棘の刃",
    field_kit: "野営道具",
    standing_plate: "継ぎはぎの盾",
    momentum_rig: "勢いの留め具",
    hungry_plate: "喰らう板",
    guard_lantern: "守り火",
    bastion_shell: "厚い継ぎ板",
    tempo_buckle: "拍子の留め具",
    quickstrap: "軽い締め具",
    reserve_coil: "予備のばね",
    focus_band: "集中の帯",
    anchor_boots: "錨の靴",
    signal_lens: "合図のレンズ",
    thorn_clasp: "返しの留め具",
    shard_hilt: "破片の柄",
    repair_pouch: "修繕袋",
    recovery_satchel: "大きな救急袋",
  },
  statuses: {
    exposed: "隙",
    focused: "集中",
  },
  enemyActors: {
    husk: "灰殻兵",
    husk_warden: "灰殻の見張り",
    still_husk: "動かない灰殻",
    husk_hunter: "灰殻の狩人",
    husk_bulwark: "灰殻の盾兵",
    husk_echo: "灰殻の反響体",
    husk_marker: "灰殻の標定手",
    gray_scrapper: "灰殻の走者",
    gray_marksman: "灰殻の後撃ち",
    gray_guard: "灰殻の守衛",
    gray_hunter: "灰殻の狩人",
    gray_echo: "灰殻の反響体",
    gray_bulwark: "灰殻の盾兵",
    ash_core: "灰の核心",
  },
};

function renamed(section) {
  return Object.fromEntries(
    Object.entries(FIXTURE_CONTENT[section]).map(([id, definition]) => [
      id,
      sectionNames[section]?.[id]
        ? { ...clone(definition), displayName: sectionNames[section][id] }
        : clone(definition),
    ]),
  );
}

function cloneActive(baseId, id, displayName, patch = {}) {
  const definition = clone(FIXTURE_CONTENT.activeSkills[baseId]);
  definition.id = id;
  definition.displayName = displayName;
  Object.assign(definition, patch);
  return definition;
}

function cloneEnemy(baseId, id, displayName, patch = {}) {
  const definition = clone(FIXTURE_CONTENT.enemyActors[baseId]);
  definition.id = id;
  definition.displayName = displayName;
  Object.assign(definition, patch);
  definition.tags = [...new Set([...(definition.tags ?? []), "playable"])];
  return definition;
}

function cloneEquipment(baseId, id, displayName, patch = {}) {
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

function setRuleEffectAmount(definition, value, effectType) {
  for (const rule of definition.rules ?? []) {
    for (const effect of rule.effects ?? []) {
      if (effectType && effect.type !== effectType) continue;
      if (effect.amount?.type === "constant") effect.amount.value = value;
    }
  }
  return definition;
}

const activeSkills = renamed("activeSkills");
// The R5 fixture's idle_shuffle is intentionally a zero-cost infinite-loop
// witness. It must not leak into player-facing content, including old saves
// that may already contain the id. Keep the id as a safe compatibility alias.
activeSkills.idle_shuffle = cloneActive("steady_aim", "idle_shuffle", "息を整える", {
  tags: ["buff", "playable"],
});
activeSkills.front_strike = cloneActive("strike", "front_strike", sectionNames.activeSkills.front_strike, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: 1,
  },
});
activeSkills.rear_strike = cloneActive("strike", "rear_strike", sectionNames.activeSkills.rear_strike, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "row_is", row: "rear" }],
    sort: ["position_asc"],
    take: 1,
  },
});
activeSkills.enemy_heavy = cloneActive("heavy_swing", "enemy_heavy", sectionNames.activeSkills.enemy_heavy, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: 1,
  },
  preparation: {
    steps: 1,
    completionEffects: [{
      type: "deal_damage",
      target: {
        scope: "enemies",
        filters: [{ type: "alive" }],
        sort: ["position_asc"],
        take: 1,
      },
      amount: { type: "constant", value: 8 },
      tags: ["attack", "heavy"],
    }],
  },
});
activeSkills.enemy_guard = cloneActive("bulwark", "enemy_guard", sectionNames.activeSkills.enemy_guard, {
  effects: [{
    type: "gain_barrier",
    target: { scope: "self", take: 1 },
    amount: { type: "constant", value: 4 },
    duration: "round",
  }],
});

const reactiveSkills = renamed("reactiveSkills");

const equipment = renamed("equipment");
equipment.guard_lantern = setRuleEffectAmount(
  cloneEquipment("standing_plate", "guard_lantern", sectionNames.equipment.guard_lantern, { maxDurability: 2 }),
  1,
  "gain_barrier",
);
equipment.bastion_shell = setRuleEffectAmount(
  cloneEquipment("standing_plate", "bastion_shell", sectionNames.equipment.bastion_shell, { maxDurability: 3 }),
  3,
  "gain_barrier",
);
equipment.tempo_buckle = cloneEquipment("worn_greaves", "tempo_buckle", sectionNames.equipment.tempo_buckle, { maxDurability: 1 });
equipment.quickstrap = cloneEquipment("worn_greaves", "quickstrap", sectionNames.equipment.quickstrap, { maxDurability: 3 });
equipment.reserve_coil = cloneEquipment("worn_greaves", "reserve_coil", sectionNames.equipment.reserve_coil, { maxDurability: 4 });
equipment.focus_band = cloneEquipment("momentum_rig", "focus_band", sectionNames.equipment.focus_band, { maxDurability: 1 });
equipment.anchor_boots = cloneEquipment("momentum_rig", "anchor_boots", sectionNames.equipment.anchor_boots, { maxDurability: 3 });
equipment.signal_lens = cloneEquipment("momentum_rig", "signal_lens", sectionNames.equipment.signal_lens, { maxDurability: 4 });
equipment.thorn_clasp = cloneEquipment("splinter_edge", "thorn_clasp", sectionNames.equipment.thorn_clasp, { maxDurability: 1 });
equipment.shard_hilt = cloneEquipment("splinter_edge", "shard_hilt", sectionNames.equipment.shard_hilt, { maxDurability: 3 });
equipment.repair_pouch = cloneEquipment("field_kit", "repair_pouch", sectionNames.equipment.repair_pouch, { maxDurability: 1 });
equipment.recovery_satchel = setRuleEffectAmount(
  cloneEquipment("field_kit", "recovery_satchel", sectionNames.equipment.recovery_satchel, { maxDurability: 4 }),
  2,
  "repair_equipment",
);

const characters = renamed("characters");
Object.assign(characters.warden, { maxHp: 26, speed: 4, baseReactionPoints: 2 });
Object.assign(characters.mender, { maxHp: 18, speed: 6, baseReactionPoints: 2 });
Object.assign(characters.lancer, { maxHp: 20, speed: 8, baseReactionPoints: 2 });
Object.assign(characters.scout, { maxHp: 16, speed: 10, baseReactionPoints: 2 });
Object.assign(characters.pivot, { maxHp: 22, speed: 5, baseActionPoints: 2, baseReactionPoints: 2 });
characters.guardian = {
  id: "guardian",
  displayName: sectionNames.characters.guardian,
  maxHp: 26,
  speed: 3,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "front", "guard"],
};
characters.arcanist = {
  id: "arcanist",
  displayName: sectionNames.characters.arcanist,
  maxHp: 16,
  speed: 5,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "rear", "attack"],
};
characters.tactician = {
  id: "tactician",
  displayName: sectionNames.characters.tactician,
  maxHp: 17,
  speed: 7,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "rear", "tempo"],
};

const enemyActors = renamed("enemyActors");
enemyActors.gray_scrapper = cloneEnemy("husk", "gray_scrapper", sectionNames.enemyActors.gray_scrapper, {
  maxHp: 10,
  speed: 6,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
});
enemyActors.gray_marksman = cloneEnemy("husk", "gray_marksman", sectionNames.enemyActors.gray_marksman, {
  maxHp: 12,
  speed: 7,
  tactics: [{ activeSkillId: "rear_strike", useWhen: [] }],
});
enemyActors.gray_guard = cloneEnemy("husk_warden", "gray_guard", sectionNames.enemyActors.gray_guard, {
  maxHp: 18,
  speed: 3,
  tactics: [
    { activeSkillId: "enemy_guard", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_hunter = cloneEnemy("husk_hunter", "gray_hunter", sectionNames.enemyActors.gray_hunter, {
  maxHp: 20,
  speed: 8,
  tactics: [
    { activeSkillId: "hunt_the_slow", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_echo = cloneEnemy("husk_echo", "gray_echo", sectionNames.enemyActors.gray_echo, {
  maxHp: 20,
  speed: 5,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
});
enemyActors.gray_bulwark = cloneEnemy("husk_bulwark", "gray_bulwark", sectionNames.enemyActors.gray_bulwark, {
  maxHp: 32,
  speed: 4,
  tactics: [
    { activeSkillId: "enemy_guard", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.ash_core = cloneEnemy("husk_bulwark", "ash_core", sectionNames.enemyActors.ash_core, {
  maxHp: 54,
  speed: 4,
  tactics: [
    { activeSkillId: "enemy_heavy", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});

export const PLAYABLE_CONTENT = Object.freeze({
  ...FIXTURE_CONTENT,
  contentVersion: "ecology-playable-full-0.1",
  characters,
  activeSkills,
  reactiveSkills,
  equipment,
  statuses: renamed("statuses"),
  enemyActors,
});

export const DISPLAY_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT).flatMap(([section, definitions]) =>
      ["characters", "activeSkills", "reactiveSkills", "equipment", "statuses", "enemyActors"].includes(section)
        ? Object.entries(definitions).map(([id, definition]) => [id, definition.displayName])
        : [],
    ),
  ),
);
