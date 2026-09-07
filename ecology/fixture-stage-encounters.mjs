// ecology/fixture-stage-encounters.mjs
//
// issue #173 — this is a test fixture, not the expedition's canonical
// encounter list. The one正本 is `content/expedition.mjs`'s
// `EXPEDITION_ENCOUNTERS`（3幕12戦）; every play path (`composeEncounter` →
// `makeExpeditionBattle`) reads that, never this file.
//
// These 7 legacy stages exist only to give `ecology/termination.test.mjs`
// and `analysis/ecology-equipment-gen-smoke.mjs` a fixed, varied board
// (enemy count / position / role mix) to run real `PLAYABLE_CONTENT` skills
// against. `termination.test.mjs` checks that battles finish in finite time;
// wiring that check to the expedition's own composition would make it track
// expedition tuning instead of termination, so this list stays independent.
//
// Read through `ecology/playable-battles.mjs`'s `makeBattle` / `encounterInfo`
// / `allEncounters`, which build BattleInput objects from this list via the
// same `allyInput` path `makeExpeditionBattle` uses for the real 12 戦.

import { LEGACY_COMBAT_SCALE } from "./content/base.mjs";
import { SHIPPED_DIFFICULTY } from "./content/enemies.mjs";

export const STAGE_FIXTURE_ENCOUNTERS = [
  {
    stage: 1,
    name: "灰の入口",
    description: "速い走り手が正面から来る二体。前列が受け、攻撃役が一体ずつ落とす。",
    enemies: [
      { instanceId: "e_runner_1", enemyActorId: "gray_runner", position: "front_left", hp: 12 },
      { instanceId: "e_runner_2", enemyActorId: "gray_runner", position: "front_right", hp: 12 },
    ],
    maxRounds: 6,
  },
  {
    stage: 2,
    name: "狩りの路地",
    description: "準備中の味方を追う追い手と、後列へ潜む潜み手。狙われる順番を読む。",
    enemies: [
      { instanceId: "e_harrower", enemyActorId: "gray_harrower", position: "front_left", hp: 18 },
      { instanceId: "e_stalker", enemyActorId: "gray_stalker", position: "rear_left", hp: 13 },
    ],
    maxRounds: 7,
  },
  {
    stage: 3,
    name: "崩れた盾列",
    description: "防壁で粘る籠り手と、重い一撃を準備する砕き手。受けるか先に崩すかを選ぶ。",
    enemies: [
      { instanceId: "e_shelter", enemyActorId: "gray_shelter", position: "front_left", hp: 20 },
      { instanceId: "e_breaker", enemyActorId: "gray_breaker", position: "front_right", hp: 22 },
    ],
    maxRounds: 8,
  },
  {
    stage: 4,
    name: "反響の坑道",
    description: "反響体と潜み手が別の列から圧をかける。単発の大打撃と回復を使い分ける。",
    enemies: [
      { instanceId: "e_echo", enemyActorId: "gray_echo", position: "front_left", hp: 20 },
      { instanceId: "e_stalker", enemyActorId: "gray_stalker", position: "rear_left", hp: 13 },
      { instanceId: "e_runner", enemyActorId: "gray_runner", position: "front_right", hp: 12 },
    ],
    maxRounds: 8,
  },
  {
    stage: 5,
    name: "灰の圧力",
    description: "重い盾、後衛を追う追い手、速い走り手。どの役割を厚くするかが問われる。",
    enemies: [
      { instanceId: "e_bulwark", enemyActorId: "gray_bulwark", position: "front_left", hp: 32 },
      { instanceId: "e_harrower", enemyActorId: "gray_harrower", position: "front_center", hp: 18 },
      { instanceId: "e_runner", enemyActorId: "gray_runner", position: "rear_right", hp: 12 },
    ],
    maxRounds: 9,
  },
  {
    stage: 6,
    name: "二つの狙い",
    description: "籠り手と反響体が前列を削り、潜み手と群れが後列を揺さぶる。配置そのものが防御になる。",
    enemies: [
      { instanceId: "e_shelter", enemyActorId: "gray_shelter", position: "front_left", hp: 20 },
      { instanceId: "e_stalker", enemyActorId: "gray_stalker", position: "rear_left", hp: 13 },
      { instanceId: "e_echo", enemyActorId: "gray_echo", position: "front_right", hp: 20 },
      { instanceId: "e_swarm", enemyActorId: "gray_swarm", position: "rear_right", hp: 8 },
    ],
    maxRounds: 10,
  },
  {
    stage: 7,
    name: "灰の核心",
    description: "準備する核心を止めながら、砕き手と籠り手を突破し、後列の潜み手と群れも抑える最終戦。",
    enemies: [
      { instanceId: "e_core", enemyActorId: "ash_core", position: "front_left", hp: 54 },
      { instanceId: "e_breaker", enemyActorId: "gray_breaker", position: "front_center", hp: 22 },
      { instanceId: "e_shelter", enemyActorId: "gray_shelter", position: "front_right", hp: 20 },
      { instanceId: "e_stalker", enemyActorId: "gray_stalker", position: "rear_left", hp: 13 },
      { instanceId: "e_swarm", enemyActorId: "gray_swarm", position: "rear_right", hp: 8 },
    ],
    maxRounds: 12,
  },
];

// R6 §4.4 — encounter が持つ hp も連続量なので10倍する。
// **敵定義の maxHp と同じ倍率**でないと、区画ごとに強さがずれる。
// **出荷難度も同じ倍率で掛ける**（enemies.mjs の SHIPPED_DIFFICULTY）。
// 定義の maxHp と初期hpがずれると、敵が上限より低いHPで湧く。
for (const encounter of STAGE_FIXTURE_ENCOUNTERS) {
  for (const enemy of encounter.enemies) {
    if (typeof enemy.hp === "number") enemy.hp = Math.round(enemy.hp * LEGACY_COMBAT_SCALE * SHIPPED_DIFFICULTY);
  }
}
