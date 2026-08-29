import { FIXTURE_CONTENT } from "./fixture-content.mjs";

// This is the replaceable content layer for the first playable slice. The R5
// engine remains content-blind; only the names below are prototype fiction.
// The mechanics are deliberately drawn from the validated fixture bundle until
// the real production content pack is authored.
const names = {
  characters: {
    warden: "ユウリ — 受け止める人",
    mender: "ミナ — 手当てする人",
    lancer: "レオン — 切り込む人",
    scout: "スイ — 先を読む人",
    pivot: "カイ — 余りを蓄える人",
  },
  activeSkills: {
    strike: "斬撃",
    mend: "手当て",
    bulwark: "防壁形成",
    relay_order: "号令",
    heavy_swing: "溜め突き",
    reposition: "位置替え",
    triage: "応急手当",
    hunt_the_slow: "準備狩り",
    long_swing: "長い溜め突き",
    idle_shuffle: "空回り",
    mark_target: "隙を刻む",
    steady_aim: "狙いを澄ます",
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
    relay_front: "前列送り",
    relay_rear: "後列送り",
    prep_spiral: "準備の螺旋",
  },
  equipment: {
    worn_greaves: "踏み込みの靴",
    standing_plate: "継ぎはぎの盾",
    splinter_edge: "棘の刃",
    field_kit: "野営道具",
    momentum_rig: "勢いの留め具",
    hungry_plate: "喰らう板",
  },
  statuses: {
    exposed: "隙",
    focused: "集中",
  },
  enemyActors: {
    husk: "灰殻兵",
    husk_warden: "灰殻の見張り",
    husk_bulwark: "灰殻の盾兵",
    husk_hunter: "灰殻の狩人",
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
  contentVersion: "ecology-playable-slice-0.2",
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
