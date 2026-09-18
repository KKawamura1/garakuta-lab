// **敵が「一体ずつ殴る的」ではなく、部隊として仕事を分けているか。**
//
// Stage 1（3人が揃う段）から追加した庇護・治療・弱体・多段を、定義の文字列ではなく
// engine が返した event で確かめる。最終戦は、上限鍛錬・技能Lv10・装備なしという
// 強い固定隊を使い、五人全員の必殺を切れば勝ち、誰か一人でも温存すれば負ける境界を
// 見る。特定の技能名を敵AIへ教える検査ではない。敵も味方と同じ共有語彙だけを使う。

import assert from "node:assert/strict";
import {
  composeEncounter,
  newProfile,
  newRun,
} from "../ecology/progression.mjs";
import { freshLoadout, simulateExpeditionBattle } from "../ecology/playable-battles.mjs";
import { ultimateFirings } from "../ecology/ultimates.mjs";

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
  supportBattle.result.events.some((event) => (
    event.type === "target_changed"
      && event.sourceActorId === enemyAegis
      && event.sourceDefinitionId === "cover_ally"
      && event.values?.from !== event.values?.to
  )),
  "敵の庇護役が味方への攻撃を実際に引き受けていない",
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
  event.type === "damage_taken"
    && event.sourceActorId === razor
    && event.skillId === "barrage_strike"
    && event.values?.hitIndex === 0
));
assert.ok(firstBarrage, "敵の多段役が連撃を始めていない");
const barrageHits = comboBattle.result.events.filter((event) => (
  event.type === "damage_taken"
    && event.sourceActorId === razor
    && event.skillId === "barrage_strike"
    && event.chainId === firstBarrage.chainId
));
assert.deepEqual(
  barrageHits.map((event) => event.values?.hitIndex),
  [0, 1, 2],
  "敵の連撃が三段の damage として解決されていない",
);

// ---------------------------------------------------------------- 最終戦の境界は落とした
//
// **難度は最後に調整するもので、システムは最初に調整するもの**（作者判断 2026-09-18）。
// ここには「上限鍛錬・技能Lv10・装備なしの固定隊で、五人全員の必殺を切れば勝ち、
// 誰か一人でも温存すれば負ける」という境界の検査があった。境界そのものは面白いが、
// **技能の規則を一つ動かすたびに、技能とは無関係な理由で鳴る。**実際、無条件の技能の
// レベル上限を下げる案は、この検査が落ちることを理由に取り下げかけた（issue #286）。
//
// 敵の火力と必殺の本数は、システムが固まってから合わせる。それまでこの境界は置かない。
// 上の Stage 1 の検査（庇護・治療・弱体・多段が event に出るか）は**振る舞いの検査**
// なので残す。

console.log("enemy tactics smoke: ok");
console.log(`support events: cover + mend / exposed ${exposedTargets.size} allies / barrage ${barrageHits.length} hits`);
