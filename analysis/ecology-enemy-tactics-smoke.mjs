// **敵が「一体ずつ殴る的」ではなく、部隊として仕事を分けているか。**
//
// Stage 1（3人が揃う段）から追加した庇護・治療・弱体・多段を、定義の文字列ではなく
// engine が返した event で確かめる。特定の技能名を敵AIへ教える検査ではない。
// 敵はプレイヤーとは別の skill registry を使い、編成として役割を分担する。

import assert from "node:assert/strict";
import {
  composeEncounter,
  newProfile,
  newRun,
} from "../ecology/progression.mjs";
import { freshLoadout, simulateExpeditionBattle } from "../ecology/playable-battles.mjs";
import { PLAYABLE_CONTENT } from "../ecology/content/index.mjs";

function freshStageRun(stageSequence, seed) {
  const profile = newProfile();
  const run = newRun(profile, { runSeed: seed, campaignStageSequence: stageSequence });
  run.loadout = freshLoadout(run.roster);
  return { profile, run };
}

// ---------------------------------------------------------------- Stage 1: 庇う前衛 + 後衛治療

const support = freshStageRun(1, "enemy-support-smoke");
const supportBattle = simulateExpeditionBattle(support.run, support.profile, 3);
const enemyAegis = supportBattle.battleInput.enemies
  .find((enemy) => enemy.enemyActorId === "gray_aegis")?.instanceId;
const enemyMender = supportBattle.battleInput.enemies
  .find((enemy) => enemy.enemyActorId === "gray_mender")?.instanceId;

assert.ok(enemyAegis && enemyMender, "Stage 1 第3戦に庇護役と治療役が並んでいない");
assert.ok(
  PLAYABLE_CONTENT.enemyActors.gray_aegis.reactiveSkillIds.includes("cover_ally"),
  "敵の庇護役が専用reactive registryの技能を持っていない",
);
assert.ok(
  supportBattle.result.events.some((event) => (
    event.type === "healing_applied"
      && event.sourceActorId === enemyMender
      && event.values?.actual > 0
  )),
  "敵の後衛治療役が傷ついた味方を実際に戻していない",
);

// ---------------------------------------------------------------- Stage 1: 全体弱体 + 三段攻撃

const combo = freshStageRun(1, "enemy-combo-smoke");
const comboBattle = simulateExpeditionBattle(combo.run, combo.profile, 6);
const brand = comboBattle.battleInput.enemies
  .find((enemy) => enemy.enemyActorId === "gray_brand")?.instanceId;
const razor = comboBattle.battleInput.enemies
  .find((enemy) => enemy.enemyActorId === "gray_razor")?.instanceId;

assert.ok(brand && razor, "Stage 1 第6戦に弱体役と多段役が並んでいない");
const exposedTargets = new Set(comboBattle.result.events
  .filter((event) => (
    event.type === "status_added"
      && event.sourceActorId === brand
      && event.skillId === "mark_spread"
      && event.values?.statusId === "exposed"
  ))
  .flatMap((event) => event.targetActorIds ?? []));
assert.deepEqual(
  [...exposedTargets].sort(),
  combo.run.roster.map((characterId) => "a_" + characterId).sort(),
  "敵の弱体役が三人全員へ隙を付けていない",
);
const firstBarrage = comboBattle.result.events.find((event) => (
  event.type === "damage_proposed"
    && event.sourceActorId === razor
    && event.skillId === "barrage_strike"
    && event.values?.hitIndex === 0
));
assert.ok(firstBarrage, "敵の多段役が連撃を始めていない");
const barrageHits = comboBattle.result.events.filter((event) => (
  event.type === "damage_proposed"
    && event.sourceActorId === razor
    && event.skillId === "barrage_strike"
    && event.chainId === firstBarrage.chainId
));
assert.deepEqual(
  barrageHits.map((event) => event.values?.hitIndex),
  [0, 1, 2],
  "敵の連撃が三段の damage として解決されていない",
);

console.log("ecology-enemy-tactics smoke: Stage 1 enemy roles resolved");
