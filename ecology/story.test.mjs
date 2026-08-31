// ecology/story.test.mjs — R9（初期4Stageのチュートリアル化）。
//
// **見るのはチュートリアルの構造であり、面白さではない。**
//   - 序盤の敗北（R9 §2.1）: 既定の配置は**本当に負け**、一手変えると**本当に勝つ**。
//     演出で敗北を差し込んでいないことを、決定的 engine を走らせて確かめる。
//   - 加入（R9 §2.1）: 2人から始まり、Stage ごとに1人ずつ増え、Stage 3 で5人。
//   - 累積（R9 §3.1）: 前の Stage の pack と仲間が引き上げられない。
//   - core / full（R9 §3.1）: 新 pack は入口だけ、以前の pack は全体。
//   - 会話（R9 §7）: 各 Stage に断片があり、話者が実在の人物である。
//   - 再訪（R9 §8）: 一度クリアした Stage は5人・自由編成で遊べる。

import assert from "node:assert/strict";
import { simulateBattle } from "./engine.mjs";
import { validateBattleInput } from "./validate.mjs";
import {
  CAMPAIGN_STAGES,
  CHARACTER_DEFINITIONS,
  PACK_BY_ID,
  PLAYABLE_CONTENT,
  PROLOGUE,
  SECTION_NAMES,
  campaignStageDef,
  packSkillIds,
  storyBeat,
} from "./content/index.mjs";
import { makePrologueBattle, prologueEncounter } from "./playable-battles.mjs";
import { characterStats, manifestSkillIds, newProfile, newRun } from "./progression.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const profile = newProfile();
const statsFor = (characterId) => characterStats(profile, characterId);

// ---- 序盤の敗北と巻き戻し（R9 §2.1）----------------------------------------

{
  const battle = makePrologueBattle(statsFor);
  assert.deepEqual(validateBattleInput(battle, PLAYABLE_CONTENT), [], "prologue の BattleInput が通る");
  checks += 1;
  equal(battle.allies.length, 2, "prologue は2人で戦う");

  const first = simulateBattle(battle, PLAYABLE_CONTENT);
  const again = simulateBattle(makePrologueBattle(statsFor), PLAYABLE_CONTENT);
  assert.deepEqual(first.events, again.events, "prologue は決定的");
  checks += 1;

  // **既定の配置は本当に負ける。**演出ではない。
  equal(first.result, "loss", "既定の配置（前列に二人並ぶ）では勝てない");

  // **一手変えると本当に勝つ。**R9 §2.1「編成を変え、予測どおりに勝利する」。
  const fixes = [
    { lancer: "rear_left", warden: "front_left" },
    { lancer: "front_left", warden: "rear_left" },
    { lancer: "rear_left", warden: "rear_right" },
  ];
  for (const formation of fixes) {
    const fixed = makePrologueBattle(statsFor, formation);
    assert.deepEqual(validateBattleInput(fixed, PLAYABLE_CONTENT), [], "変更後も BattleInput が通る");
    checks += 1;
    const result = simulateBattle(fixed, PLAYABLE_CONTENT);
    equal(result.result, "win", JSON.stringify(formation) + " なら勝てる");
    check(result.roundsUsed <= PROLOGUE.maxRounds, "round 上限の中で決着する");
  }

  // prologue の敵は12戦の梯子に属さない（index 0）。
  const encounter = prologueEncounter();
  equal(encounter.index, 0, "prologue は第0戦（遠征の外）");
  equal(encounter.enemies.length, PROLOGUE.enemies.length, "prologue の敵数は content が決める");
  for (const enemy of encounter.enemies) {
    check(Boolean(PLAYABLE_CONTENT.enemyActors[enemy.enemyActorId]), enemy.enemyActorId + " は実在の敵");
  }
}

// ---- 加入と累積（R9 §2.1, §3.1）--------------------------------------------

{
  const knownCharacters = new Set(CHARACTER_DEFINITIONS.map((option) => option.id));
  let previous = null;
  for (const stage of CAMPAIGN_STAGES) {
    equal(stage.partySize, stage.sequence + 2, stage.id + " の人数は sequence + 2");
    equal(stage.castCharacterIds.length, stage.partySize, stage.id + " の cast が人数ぶんある");
    for (const characterId of stage.castCharacterIds) {
      check(knownCharacters.has(characterId), characterId + " は実在の仲間");
    }
    if (previous) {
      for (const characterId of previous.castCharacterIds) {
        check(stage.castCharacterIds.includes(characterId), characterId + " は " + stage.id + " でも同行する");
      }
      for (const packId of previous.enabledPackIds) {
        check(stage.enabledPackIds.includes(packId), packId + " は " + stage.id + " でも有効（累積）");
      }
    }
    previous = stage;
  }
  equal(campaignStageDef(3).partySize, 5, "Stage 3 で5人が揃う");
}

// ---- core / full（R9 §3.1, §4）---------------------------------------------

{
  for (const stage of CAMPAIGN_STAGES) {
    const manifest = { enabledPackIds: stage.enabledPackIds, packDepths: stage.packDepths };
    const ids = manifestSkillIds(manifest);
    const newPack = PACK_BY_ID[stage.newPackId];
    const core = packSkillIds(newPack, "core");
    const full = packSkillIds(newPack, "full");

    // 新 pack は入口だけが出る。
    for (const id of core.active) check(ids.active.includes(id), stage.id + ": core active " + id + " が出る");
    for (const id of core.reactive) check(ids.reactive.includes(id), stage.id + ": core reactive " + id + " が出る");
    const hidden = full.active.filter((id) => !core.active.includes(id));
    for (const id of hidden) {
      check(!ids.active.includes(id), stage.id + ": " + id + " はまだ出ない（新 pack は入口だけ）");
    }

    // 以前の pack は全体が出る。**前に覚えた技能は消えない。**
    for (const packId of stage.returningPackIds) {
      const returning = packSkillIds(PACK_BY_ID[packId], "full");
      for (const id of returning.active) {
        check(ids.active.includes(id), stage.id + ": 過去 pack の " + id + " が使える");
      }
    }

    // R9 §4 — 導入 pack の技能数は7〜10を目安にする。
    const coreCount = core.active.length + core.reactive.length + core.passive.length;
    check(coreCount >= 7 && coreCount <= 10,
      stage.id + ": 新 pack の入口は " + coreCount + " 技能（目安 7〜10）");

    // R9 §9.2 — 導入 pack には、別の役割が使う接続面が最低一つある。
    check(core.reactive.length >= 2, stage.id + ": 入口に反応技能が2つ以上ある");
    check(core.passive.length >= 1, stage.id + ": 入口に常設が1つある");
  }
}

// ---- 会話（R9 §7）----------------------------------------------------------

{
  const names = new Set(Object.values(SECTION_NAMES.characters).map((name) => name.split(" ")[0]));
  const seenBeatIds = new Set();
  for (const stage of CAMPAIGN_STAGES) {
    const keys = stage.sequence === 0 ? ["opening", "prologueDefeat", "stageEnd"] : ["join", "stageEnd"];
    for (const key of keys) {
      const beat = storyBeat(stage.id, key);
      check(Boolean(beat), stage.id + " に " + key + " の断片がある");
      if (!beat) continue;
      check(!seenBeatIds.has(beat.id), beat.id + " は一意");
      seenBeatIds.add(beat.id);
      check(beat.lines.length >= 2, beat.id + " は2行以上");
      check(beat.lines.length <= 6, beat.id + " は6行以下（説明文にしない）");
      for (const line of beat.lines) {
        check(typeof line.text === "string" && line.text.length > 0, beat.id + " の行に本文がある");
        if (line.speaker === null) continue;
        check(names.has(line.speaker), beat.id + ": 話者 " + line.speaker + " が実在の仲間");
      }
    }
  }
}

// ---- 初回と再訪（R9 §8）----------------------------------------------------

{
  const firstRun = newRun(profile, {
    runSeed: "tut", runId: "tut", roster: ["scout", "pivot", "arcanist"], campaignStageSequence: 0,
  });
  assert.deepEqual(firstRun.roster, [...campaignStageDef(0).castCharacterIds],
    "初回は Stage の cast がそのまま来る（呼び出し側の選択は効かない）");
  checks += 1;
  equal(firstRun.partySize, 2, "初回 Stage 0 は2人");
  check(firstRun.rosterLocked, "初回は編成を組み替えない");

  const revisit = newRun(profile, {
    runSeed: "tut2", runId: "tut2", roster: ["scout", "pivot", "arcanist", "mender", "lancer"],
    campaignStageSequence: 0, freeRoster: true,
  });
  equal(revisit.partySize, 5, "再訪は5人まで使える");
  check(!revisit.rosterLocked, "再訪では編成を自由に組める");
  assert.deepEqual(revisit.roster, ["scout", "pivot", "arcanist", "mender", "lancer"],
    "再訪では呼び出し側の選択がそのまま通る");
  checks += 1;

  // R9 §3.2 — 少人数 Stage では敵の数も人数に合わせる。
  const { composeEncounter } = await import("./progression.mjs");
  for (let index = 1; index <= 12; index += 1) {
    const small = composeEncounter(index, 0, { partySize: 2 });
    const full = composeEncounter(index, 0, { partySize: 5 });
    check(small.enemies.length <= 2, "第" + index + "戦: 2人 Stage の敵は2体以下");
    check(small.enemies.length <= full.enemies.length, "第" + index + "戦: 少人数のほうが敵が多くない");
    check(small.budget <= full.budget, "第" + index + "戦: 少人数のほうが threat budget が高くない");
    if (full.enemies.some((enemy) => enemy.boss)) {
      check(small.enemies.some((enemy) => enemy.boss), "第" + index + "戦: boss は必ず残る");
    }
  }
}

console.log(`story.test.mjs: ${checks} checks passed`);
