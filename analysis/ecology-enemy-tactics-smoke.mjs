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
      && event.sourceDefinitionId === "foe_reaction_cover_ally"
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
      && event.skillId === "foe_action_mark_spread"
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
    && event.skillId === "foe_action_barrage_strike"
    && event.values?.hitIndex === 0
));
assert.ok(firstBarrage, "敵の多段役が連撃を始めていない");
const barrageHits = comboBattle.result.events.filter((event) => (
  event.type === "damage_taken"
    && event.sourceActorId === razor
    && event.skillId === "foe_action_barrage_strike"
    && event.chainId === firstBarrage.chainId
));
assert.deepEqual(
  barrageHits.map((event) => event.values?.hitIndex),
  [0, 1, 2],
  "敵の連撃が三段の damage として解決されていない",
);

// ---------------------------------------------------------------- Stage 9: 五人の必殺を全部切る最終戦

const FINAL_ROSTER = Object.freeze(["warden", "mender", "lancer", "guardian", "tactician"]);
const FINAL_TACTICS = Object.freeze({
  warden: "guard_crush",
  mender: "aimed_shot",
  lancer: "heavy_swing",
  // 守りの必殺にも席を作る。全体へ残る防壁が、長期戦を越える五本目になる。
  guardian: "bulwark",
  tactician: "aimed_shot",
});
const FINAL_REACTIVES = Object.freeze({
  warden: Object.freeze(["mend", "emergency_treatment"]),
  mender: Object.freeze(["triage", "emergency_treatment"]),
  lancer: Object.freeze(["cover_ally", "triage", "brace_after_hit"]),
  guardian: Object.freeze(["brace_after_hit", "emergency_treatment"]),
  tactician: Object.freeze(["mend", "brace_after_hit", "block_focus"]),
});

function finalRun(armedIds) {
  const profile = newProfile();
  for (const characterId of FINAL_ROSTER) {
    profile.characters[characterId].trainingLevels = {
      might: 12, focus: 12, guard: 12, vitality: 12,
    };
  }

  const unlockedSkills = {};
  const skillLevels = {};
  for (const characterId of FINAL_ROSTER) {
    unlockedSkills[characterId] = [
      ...new Set([FINAL_TACTICS[characterId], ...FINAL_REACTIVES[characterId]]),
    ];
    skillLevels[characterId] = Object.fromEntries(
      unlockedSkills[characterId].map((skillId) => [skillId, 10]),
    );
  }

  const run = newRun(profile, {
    runSeed: "final-boss-five-ultimates",
    campaignStageSequence: 9,
    unlockedSkills,
    skillLevels,
  });
  run.loadout = freshLoadout(run.roster);
  for (const characterId of FINAL_ROSTER) {
    run.loadout.tactics[characterId] = [FINAL_TACTICS[characterId]];
    run.loadout.reactives[characterId] = [...FINAL_REACTIVES[characterId]];
    run.loadout.ultimates[characterId] = FINAL_TACTICS[characterId];
  }
  run.loadout.ultimateArmed = Object.fromEntries(armedIds.map((id) => [id, true]));

  // 第11戦までを越えて来た隊の固定入口。69%なら必殺条件を満たしつつ、
  // 失っているのは隊全体のHPの約5%だけなので、負傷そのものを勝因にはしない。
  run.currentHp.mender = Math.floor(run.currentHp.mender * 69 / 100);
  return { profile, run };
}

function fightFinal(armedIds) {
  const { profile, run } = finalRun(armedIds);
  const battle = simulateExpeditionBattle(run, profile, 12);
  return {
    result: battle.result,
    fired: ultimateFirings(battle.result).map((id) => id.replace(/^a_/, "")),
  };
}

const finalEncounter = composeEncounter(12, 0, { partySize: 5, stageSequence: 9 });
assert.deepEqual(
  finalEncounter.enemies.map((enemy) => enemy.enemyActorId),
  ["ash_furnace_heart", "forge_aegis", "weave_hand", "dust_maw", "forge_mender"],
  "最終戦の本体・庇護・状態異常・高火力・治療の五役が崩れている",
);

const allFive = fightFinal(FINAL_ROSTER);
assert.equal(allFive.result.result, "win", "五人全員の必殺を切った上限鍛錬隊が最終戦を越えられない");
assert.deepEqual(
  [...allFive.fired].sort(), [...FINAL_ROSTER].sort(),
  "最終戦で構えた五人全員の必殺が発動していない",
);

const none = fightFinal([]);
assert.equal(none.result.result, "loss", "必殺を温存した上限鍛錬隊が最終戦を越えてしまう");
for (const missing of FINAL_ROSTER) {
  const armed = FINAL_ROSTER.filter((characterId) => characterId !== missing);
  const four = fightFinal(armed);
  assert.equal(four.fired.length, 4, `${missing} 以外の四人の必殺が全部発動していない`);
  assert.equal(four.result.result, "loss", `${missing} の必殺を温存しても最終戦を越えてしまう`);
}

const finalSurvivors = allFive.result.actors.filter((actor) => actor.side === "ally" && actor.alive).length;
console.log("enemy tactics smoke: ok");
console.log(`support events: cover + mend / exposed ${exposedTargets.size} allies / barrage ${barrageHits.length} hits`);
console.log(`final boss: 5 ultimates -> win in ${allFive.result.roundsUsed} rounds (${finalSurvivors}/5 alive); 0 or any 4 -> loss`);
