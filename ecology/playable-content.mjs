import { FIXTURE_CONTENT } from "./fixture-content.mjs";

// Prototype content pack. The engine stays content-blind; this file is the
// replaceable layer for the first UI pass. Fixture mechanics are reused only
// until the UI direction is approved.
const names = {
  characters: {
    warden: "ユウリ — 守る人",
    mender: "ミナ — 手当てする人",
    lancer: "レオン — 突き進む人",
  },
  activeSkills: {
    strike: "斬撃",
    mend: "手当て",
    bulwark: "防壁形成",
    heavy_swing: "溜め突き",
  },
  reactiveSkills: {
    counter_blow: "反撃",
    overflow_care: "余剰治療",
    scavenge_ap: "拾い直し",
    urging: "急かす",
  },
  equipment: {
    worn_greaves: "踏み込みの靴",
    standing_plate: "継ぎはぎの盾",
    splinter_edge: "棘の刃",
    field_kit: "野営道具",
    momentum_rig: "勢いの留め具",
  },
  statuses: {
    exposed: "隙",
    focused: "集中",
  },
  enemyActors: {
    husk: "灰殻兵",
    husk_warden: "灰殻の見張り",
    husk_bulwark: "灰殻の盾兵",
  },
};

function renamed(section) {
  return Object.fromEntries(
    Object.entries(FIXTURE_CONTENT[section]).map(([id, definition]) => [
      id,
      names[section]?.[id] ? { ...definition, displayName: names[section][id] } : definition,
    ]),
  );
}

export const PLAYABLE_CONTENT = Object.freeze({
  ...FIXTURE_CONTENT,
  contentVersion: "ecology-playable-slice-0.1",
  characters: renamed("characters"),
  activeSkills: renamed("activeSkills"),
  reactiveSkills: renamed("reactiveSkills"),
  equipment: renamed("equipment"),
  statuses: renamed("statuses"),
  enemyActors: renamed("enemyActors"),
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
