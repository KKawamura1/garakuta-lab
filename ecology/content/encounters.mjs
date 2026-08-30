// ecology/content/encounters.mjs
//
// **区画ごとの敵の配置。threat budget は Phase B まで入れない。**
// R7 Milestone 0 で playable-battles.mjs から分離した。**挙動は変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 敵・encounter 担当だけ。engine・schema・共通registryは変更しない。

import { LEGACY_COMBAT_SCALE } from "./base.mjs";

export const ENCOUNTERS = [
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

// R6 §4.4 — encounter が持つ hp も連続量なので10倍する。
// **敵定義の maxHp と同じ倍率**でないと、区画ごとに強さがずれる。
for (const encounter of ENCOUNTERS) {
  for (const enemy of encounter.enemies) {
    if (typeof enemy.hp === "number") enemy.hp *= LEGACY_COMBAT_SCALE;
  }
}

// 敵ごとの狙いの説明文。engine の targetQuery を人の言葉へ写したもので、
// **規則そのものではない**（ずれたら enemies.mjs 側の定義が正）。
export const ENEMY_TARGETING = {
  gray_scrapper: "前列の生存者を、左から狙う。",
  gray_runner: "前列の生存者を、速い順に狙う。",
  gray_marksman: "後列の生存者を優先して狙う。",
  gray_stalker: "まず後列を狙い、後列がいなければ前列を狙う。",
  gray_guard: "前列を狙い、最初の行動で防壁を張る。",
  gray_breaker: "重い一撃を準備して前列へ放ち、その後は前列を狙う。",
  gray_shelter: "最初に防壁を張り、その後は前列を狙う。",
  gray_hunter: "準備中の味方を見つければ先に狙う。いなければ前列。",
  gray_harrower: "準備中の味方を追い、後列、前列の順に狙う。",
  gray_echo: "前列を殴り、受けたダメージを反響する。",
  gray_bulwark: "防壁を張り直しながら前列を狙う。",
  gray_swarm: "速く動き、前列の生存者を狙う。",
  ash_core: "重い一撃を準備し、完成したら前列へ放つ。",
};
