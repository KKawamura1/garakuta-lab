// ecology/story.test.mjs — R9（初期4Stageのチュートリアル化）。
//
// **見るのはチュートリアルの構造であり、面白さではない。**
//   - 序盤の敗北（R9 §2.1）: 既定の配置は**本当に負け**、一手変えると**本当に勝つ**。
//     演出で敗北を差し込んでいないことを、決定的 engine を走らせて確かめる。
//   - 加入（R9 §2.1）: 2人から始まり、Stage ごとに1人ずつ増え、Stage 3 で5人。
//   - 累積（R9 §3.1）: 前の Stage の pack と仲間が引き上げられない。
//   - core / full（R9 §3.1）: 新 pack は入口だけ、以前の pack は全体。
//   - 会話（R9 §7）: 各 Stage に断片があり、話者が実在の人物である。
//   - 敵の規模（R9 §3.2）: 少人数 Stage では数・boss の体力・受けが人数へ合う。
//   - 再訪（R9 §8）: 一度クリアした Stage は5人・自由編成で遊べる。

import assert from "node:assert/strict";
import { simulateBattle } from "./engine.mjs";
import { validateBattleInput } from "./validate.mjs";
import {
  CAMPAIGN_STAGES,
  CHARACTER_DEFINITIONS,
  EXPRESSIONS,
  PACK_BY_ID,
  PLAYABLE_CONTENT,
  PORTRAITS,
  PORTRAIT_IDS,
  PROLOGUE,
  SECTION_NAMES,
  campaignStageDef,
  castOnStage,
  packSkillIds,
  portraitAccent,
  portraitSvg,
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
  //
  // R11 — 人物の数値を作り直したので、教える内容が一段具体的になった。
  // **前後へ散らせば勝てる。固めれば、前でも後ろでも負ける。**
  // 「後列を狙う敵がいるから前に固まるな。ただし後列も安全ではない」を、
  // 4通りの配置の結果そのもので示す。
  const split = [
    { lancer: "rear_left", warden: "front_left" },
    { lancer: "front_left", warden: "rear_left" },
  ];
  for (const formation of split) {
    const fixed = makePrologueBattle(statsFor, formation);
    assert.deepEqual(validateBattleInput(fixed, PLAYABLE_CONTENT), [], "変更後も BattleInput が通る");
    checks += 1;
    const result = simulateBattle(fixed, PLAYABLE_CONTENT);
    equal(result.result, "win", JSON.stringify(formation) + "（前後に散らす）なら勝てる");
    check(result.roundsUsed <= PROLOGUE.maxRounds, "round 上限の中で決着する");
  }

  // **後列へ固めても勝てない。**前で受ける者がいなくなる。
  const bothRear = simulateBattle(
    makePrologueBattle(statsFor, { lancer: "rear_left", warden: "rear_right" }),
    PLAYABLE_CONTENT,
  );
  equal(bothRear.result, "loss", "二人とも後列でも勝てない（前で受ける者がいない）");

  // **最良手は「シキを後ろ」だけ。**カイを後ろへ下げても勝てるが、彼が落ちる。
  // 勝敗の裏に「誰が生きて帰ったか」の差があることを、ここで固定しておく。
  const survivors = (formation) => simulateBattle(makePrologueBattle(statsFor, formation), PLAYABLE_CONTENT)
    .actors.filter((actor) => actor.instanceId.startsWith("a_") && actor.alive).length;
  equal(survivors({ lancer: "front_left", warden: "rear_left" }), 2, "シキを後列にすると二人とも生き残る");
  equal(survivors({ lancer: "rear_left", warden: "front_left" }), 1, "カイを後列にすると勝てるが彼が落ちる");

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
      // **立ち絵を足しても行数は増やさない。**R9 §7 の「説明文にしない」を保つ。
      check(beat.lines.length <= 6, beat.id + " は6行以下（説明文にしない）");
      for (const line of beat.lines) {
        check(typeof line.text === "string" && line.text.length > 0, beat.id + " の行に本文がある");
        if (line.speaker === null) {
          check(line.who === null, beat.id + ": 地の文は話者を持たない");
          continue;
        }
        check(names.has(line.speaker), beat.id + ": 話者 " + line.speaker + " が実在の仲間");
      }
    }
  }
}

// ---- 立ち絵と演出（会話画面）------------------------------------------------
//
// **立ち絵は engine ではなく見た目だが、欠けると会話画面が壊れる。**
// 話者・配役・表情がすべて実在の語彙を指していることを、ここで見る。

{
  const characterIds = new Set(CHARACTER_DEFINITIONS.map((option) => option.id));
  const placements = new Set(["left", "center", "right"]);

  // 仲間は全員ぶんの立ち絵を持つ。**会話に出す前に欠けを見つける。**
  for (const option of CHARACTER_DEFINITIONS) {
    check(Boolean(PORTRAITS[option.id]), option.id + " の立ち絵がある");
  }
  equal(PORTRAIT_IDS.length, CHARACTER_DEFINITIONS.length, "立ち絵の数が仲間の数と揃う");

  // 表情差分は同じ骨格から作る。**同じ引数からは同じ markup。**
  for (const characterId of PORTRAIT_IDS) {
    for (const expression of Object.keys(EXPRESSIONS)) {
      const svg = portraitSvg(characterId, expression);
      check(svg.startsWith("<svg") && svg.endsWith("</svg>"), characterId + "/" + expression + " が SVG を返す");
      equal(portraitSvg(characterId, expression), svg, characterId + "/" + expression + " は決定的");
      check(!svg.includes("undefined") && !svg.includes("NaN"),
        characterId + "/" + expression + " に未解決の値が残っていない");
    }
    check(/^#[0-9a-f]{6}$/i.test(portraitAccent(characterId)), characterId + " の差し色が色として読める");
  }
  equal(portraitSvg("no_such_character"), "", "知らない人物では立ち絵を作らない");

  for (const stage of CAMPAIGN_STAGES) {
    const keys = stage.sequence === 0 ? ["opening", "prologueDefeat", "stageEnd"] : ["join", "stageEnd"];
    for (const key of keys) {
      const beat = storyBeat(stage.id, key);
      if (!beat) continue;
      check(typeof beat.mood === "string" && beat.mood.length > 0, beat.id + " に背景の色調がある");
      check(beat.cast.length >= 1 && beat.cast.length <= 3, beat.id + " の配役は1〜3人（画面に収まる）");

      const seenPlacements = new Set();
      for (const entry of beat.cast) {
        check(characterIds.has(entry.who), beat.id + ": 配役 " + entry.who + " が実在の仲間");
        check(Boolean(PORTRAITS[entry.who]), beat.id + ": 配役 " + entry.who + " に立ち絵がある");
        check(placements.has(entry.at), beat.id + ": 立ち位置 " + entry.at + " が left/center/right");
        check(!seenPlacements.has(entry.at), beat.id + ": 立ち位置 " + entry.at + " が重なっていない");
        seenPlacements.add(entry.at);
        check(Number.isInteger(entry.since) && entry.since >= 0 && entry.since < beat.lines.length,
          beat.id + ": " + entry.who + " の登場行が断片の中にある");
      }

      const cast = new Set(beat.cast.map((entry) => entry.who));
      for (const [index, line] of beat.lines.entries()) {
        if (line.who === null) {
          equal(line.emotion, null, beat.id + " 行" + index + ": 地の文は表情を持たない");
          continue;
        }
        // **喋る人は必ず舞台に立っている。**名前だけ出て絵が無い行を作らない。
        check(cast.has(line.who), beat.id + " 行" + index + ": 話者 " + line.who + " が配役にいる");
        check(Boolean(EXPRESSIONS[line.emotion]), beat.id + " 行" + index + ": 表情 " + line.emotion + " が実在する");
        const entry = beat.cast.find((member) => member.who === line.who);
        check((entry?.since ?? 0) <= index, beat.id + " 行" + index + ": 登場前に喋らない");
        check(line.fx === null || line.fx === "impact", beat.id + " 行" + index + ": 演出 id が既知");
      }

      // 一行目の時点で舞台に立つのは since 0 の配役だけ。
      const opening = castOnStage(beat, 0);
      for (const entry of opening) equal(entry.since, 0, beat.id + ": 一行目の配役は since 0");
      equal(castOnStage(beat).length, beat.cast.length, beat.id + ": 最後には配役が全員そろう");
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
      // boss は数を減らせないので、体力を人数へ合わせる。
      const smallBoss = small.enemies.find((enemy) => enemy.boss);
      const fullBoss = full.enemies.find((enemy) => enemy.boss);
      check(smallBoss.stats.maxHp < fullBoss.stats.maxHp,
        "第" + index + "戦: 2人 Stage の boss は体力が下がる");
    }
    // 受けは一撃ごとの定額なので、手数が減るぶんだけ下げる。
    for (const enemy of small.enemies) {
      const same = full.enemies.find((entry) => entry.enemyActorId === enemy.enemyActorId);
      if (!same || same.stats.guard === 0) continue;
      check(enemy.stats.guard <= same.stats.guard,
        "第" + index + "戦: 少人数のほうが受けが厚くない（" + enemy.enemyActorId + "）");
    }
  }
}

console.log(`story.test.mjs: ${checks} checks passed`);
