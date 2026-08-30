// ecology/content/enemies.mjs
//
// **敵 unit の定義と、その狙いの説明文。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 敵・encounter 担当だけ。engine・schema・共通registryは変更しない。

import { cloneEnemy, renamed } from "./base.mjs";

export const ENEMY_NAMES = {
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
};

const enemyActors = renamed("enemyActors", ENEMY_NAMES);
enemyActors.gray_scrapper = cloneEnemy("husk", "gray_scrapper", ENEMY_NAMES.gray_scrapper, {
  maxHp: 10,
  speed: 6,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
});
enemyActors.gray_marksman = cloneEnemy("husk", "gray_marksman", ENEMY_NAMES.gray_marksman, {
  maxHp: 12,
  speed: 7,
  tactics: [{ activeSkillId: "rear_strike", useWhen: [] }],
});
enemyActors.gray_guard = cloneEnemy("husk_warden", "gray_guard", ENEMY_NAMES.gray_guard, {
  maxHp: 18,
  speed: 3,
  tactics: [
    { activeSkillId: "enemy_guard", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_hunter = cloneEnemy("husk_hunter", "gray_hunter", ENEMY_NAMES.gray_hunter, {
  maxHp: 20,
  speed: 8,
  tactics: [
    { activeSkillId: "hunt_the_slow", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_echo = cloneEnemy("husk_echo", "gray_echo", ENEMY_NAMES.gray_echo, {
  maxHp: 20,
  speed: 5,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
});
enemyActors.gray_bulwark = cloneEnemy("husk_bulwark", "gray_bulwark", ENEMY_NAMES.gray_bulwark, {
  maxHp: 32,
  speed: 4,
  tactics: [
    { activeSkillId: "enemy_guard", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.ash_core = cloneEnemy("husk_bulwark", "ash_core", ENEMY_NAMES.ash_core, {
  maxHp: 54,
  speed: 4,
  tactics: [
    { activeSkillId: "enemy_heavy", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});

export const ENEMY_ACTORS = enemyActors;
