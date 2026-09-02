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
//   - 名簿（R12 §4.A）: 読める設定が5人ぶんあり、**一度に全部は開かない**。

import assert from "node:assert/strict";
import { simulateBattle } from "./engine.mjs";
import { validateBattleInput } from "./validate.mjs";
import {
  CAMPAIGN_STAGES,
  CHARACTER_DEFINITIONS,
  DOSSIERS,
  DOSSIER_IDS,
  DOSSIER_SECTIONS,
  DOSSIER_SECTION_HEADINGS,
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
  dossierRevealLevel,
  revealedBonds,
  revealedDossierSections,
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
  // R11 §5 — この一戦だけで、武器と技の違いの**両側**を教える。
  // 4通りすべての結果をここで固定する。どれか一つでも動けば、教える内容が変わる。
  //
  //   両方前（既定）… 負ける。ナズナが2ラウンド目に落ちる
  //   ナズナを後列  … **勝つ。誰も落ちない。**これが正解
  //   シキを後列    … 負ける。武器攻撃が後列から40%になり、倒しきれない
  //   両方後列      … 負ける。前で受ける者がいないうえ、武器も落ちる
  const outcome = (formation) => {
    const input = makePrologueBattle(statsFor, formation);
    assert.deepEqual(validateBattleInput(input, PLAYABLE_CONTENT), [], "変更後も BattleInput が通る");
    checks += 1;
    const result = simulateBattle(input, PLAYABLE_CONTENT);
    const allies = result.actors.filter((actor) => actor.instanceId.startsWith("a_"));
    return {
      result: result.result,
      rounds: result.roundsUsed,
      survivors: allies.filter((actor) => actor.alive).length,
    };
  };

  const correct = outcome({ warden: "front_left", mender: "rear_left" });
  equal(correct.result, "win", "ナズナを後列へ下げれば勝てる");
  equal(correct.survivors, 2, "**そのとき誰も落ちない。**これが正解の手");
  check(correct.rounds <= PROLOGUE.maxRounds, "round 上限の中で決着する");

  equal(outcome({ mender: "front_left", warden: "rear_left" }).result, "loss",
    "シキを後列へ下げると勝てない（武器攻撃が後列から40%になる）");
  equal(outcome({ warden: "rear_left", mender: "rear_right" }).result, "loss",
    "二人とも後列でも勝てない（前で受ける者がいないうえ、武器も落ちる）");

  // **既定の配置では、ナズナが2ラウンド目に落ちる。**
  // ecology/app.js はこの拍で再生を打ち切って巻き戻しの会話へ渡すので、
  // 「誰が」「何ラウンド目に」倒れるかは演出の前提そのものである。
  const firstFall = first.events.find((event) => event.type === "actor_defeated"
    && [event.sourceActorId, ...(event.targetActorIds ?? [])].filter(Boolean).includes("a_mender"));
  check(Boolean(firstFall), "既定の配置ではナズナが倒れる");
  check((firstFall?.round ?? 99) <= 2, "ナズナは2ラウンド目までに倒れる（打ち切りの拍）");

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
    // R11 §5 — Stage 0 は「拾う → 倒れる → 巻き戻る → 勝つ」の4拍を持つ。
    // R12 §4.C — どの Stage も、4・8・12戦目の幕の断片を3つ持つ。
    const acts = ["act1", "act2", "act3"];
    const keys = stage.sequence === 0
      ? ["opening", "prologueDefeat", "prologueRewound", "prologueWin", ...acts, "stageEnd"]
      : ["join", ...acts, "stageEnd"];
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
  const placements = new Set(["far_left", "left", "center", "right", "far_right"]);

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
    const keys = stage.sequence === 0
      ? ["opening", "prologueDefeat", "act1", "act2", "act3", "stageEnd"]
      : ["join", "act1", "act2", "act3", "stageEnd"];
    for (const key of keys) {
      const beat = storyBeat(stage.id, key);
      if (!beat) continue;
      check(typeof beat.mood === "string" && beat.mood.length > 0, beat.id + " に背景の色調がある");
      check(beat.cast.length >= 1 && beat.cast.length <= 5, beat.id + " の配役は1〜5人（画面に収まる）");

      const seenPlacements = new Set();
      for (const entry of beat.cast) {
        check(characterIds.has(entry.who), beat.id + ": 配役 " + entry.who + " が実在の仲間");
        check(Boolean(PORTRAITS[entry.who]), beat.id + ": 配役 " + entry.who + " に立ち絵がある");
        check(placements.has(entry.at), beat.id + ": 立ち位置 " + entry.at + " が五枠のどれか");
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

// ---- 加入済みの仲間は場面から消えない（R12）------------------------------------
//
// **途中離脱は無い。**Stage を越えるごとに一人ずつ増えて5人になる。
// だから「新しい仲間が加わる場面」に、既にいる仲間が居ないのはおかしい。
// 立ち位置の枠が3つしか無かったころ、ナズナが Stage 2・3 の join から
// 配役ごと落ちていた（作者判断で修正）。**枠の都合で仲間を消さない。**
//
// 台詞までは求めない。R9 §7 の「1断片2〜6行」を守ったまま、
// 立って表情で応じることを presence とする（R11 §1「投資先は立ち絵の情報量」）。

{
  for (const stage of CAMPAIGN_STAGES) {
    const key = stage.sequence === 0 ? "opening" : "join";
    const beat = storyBeat(stage.id, key);
    if (!beat) continue;
    const onStage = new Set(beat.cast.map((entry) => entry.who));
    for (const characterId of stage.castCharacterIds) {
      check(onStage.has(characterId),
        beat.id + ": この Stage の " + characterId + " が舞台に立っている（加入済みは消えない）");
    }
    equal(beat.cast.length, stage.castCharacterIds.length,
      beat.id + ": 配役の数がその Stage の人数と一致する");
  }
}

// ---- まだ加入していない人物を、会話へ先に出さない（R12）------------------------
//
// **物語が渡していない人物は、どの画面にも出ない。**編成・ギルド投資・Stage 選択
// カードは app.js の metCharacterIds が塞いだが、会話そのものが漏らしては意味がない。
// その Stage の cast の外にいる人物は、配役にも話者にも現れてはいけない。

{
  const actKeys = ["act1", "act2", "act3"];
  for (const stage of CAMPAIGN_STAGES) {
    const allowed = new Set(stage.castCharacterIds);
    const keys = stage.sequence === 0
      ? ["opening", "prologueDefeat", "prologueRewound", "prologueWin", ...actKeys, "stageEnd"]
      : ["join", ...actKeys, "stageEnd"];
    for (const key of keys) {
      const beat = storyBeat(stage.id, key);
      if (!beat) continue;
      for (const entry of beat.cast) {
        check(allowed.has(entry.who),
          beat.id + ": 配役 " + entry.who + " はこの Stage に加入している");
      }
      for (const line of beat.lines) {
        if (!line.who) continue;
        check(allowed.has(line.who),
          beat.id + ": 話者 " + line.who + " はこの Stage に加入している");
      }
    }

    // 幕の断片は短い。**pack の説明ではなく、幕の切れ目の一拍である。**
    for (const key of actKeys) {
      const beat = storyBeat(stage.id, key);
      check(Boolean(beat), stage.id + " に " + key + " の断片がある");
      if (beat) check(beat.lines.length >= 2 && beat.lines.length <= 4,
        beat.id + " は2〜4行（幕の切れ目に長い会話を置かない）");
    }
  }
}

// ---- 初回と再訪（R9 §8）----------------------------------------------------

{
  const firstRun = newRun(profile, {
    runSeed: "tut", runId: "tut", roster: ["lancer", "guardian", "tactician"], campaignStageSequence: 0,
  });
  assert.deepEqual(firstRun.roster, [...campaignStageDef(0).castCharacterIds],
    "初回は Stage の cast がそのまま来る（呼び出し側の選択は効かない）");
  checks += 1;
  equal(firstRun.partySize, 2, "初回 Stage 0 は2人");
  check(firstRun.rosterLocked, "初回は編成を組み替えない");

  const revisit = newRun(profile, {
    runSeed: "tut2", runId: "tut2", roster: ["tactician", "guardian", "warden", "mender", "lancer"],
    campaignStageSequence: 0, freeRoster: true,
  });
  equal(revisit.partySize, 5, "再訪は5人まで使える");
  check(!revisit.rosterLocked, "再訪では編成を自由に組める");
  assert.deepEqual(revisit.roster, ["tactician", "guardian", "warden", "mender", "lancer"],
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



// ---- 名簿 / 読める設定（R12 §4.A）--------------------------------------------
//
// **一度に全部を語らない**のがこの機能の核なので、そこを固定する。
// 中身の良し悪しは測れない（AGENTS.md）。測れるのは開く順と、漏れの有無だけである。

{
  const finalStageSequence = CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1].sequence;
  const partyIds = CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1].castCharacterIds;

  // 本編の5人ぶんある。**余りも欠けも無い。**
  assert.deepEqual([...DOSSIER_IDS].sort(), [...partyIds].sort(),
    "名簿は本編の5人ぶんちょうどある");
  checks += 1;

  for (const characterId of DOSSIER_IDS) {
    const entry = DOSSIERS[characterId];

    // 加入 Stage が Campaign の定義と食い違っていない。
    const joinStage = CAMPAIGN_STAGES.find((stage) => stage.castCharacterIds.includes(characterId));
    equal(entry.joinStageSequence, joinStage.sequence,
      characterId + ": 名簿の加入 Stage が Campaign 側と一致する");

    // 4つの節がすべて書かれている。**空の節を「開いた」と言わない。**
    for (const key of DOSSIER_SECTIONS) {
      check(Array.isArray(entry.sections[key]) && entry.sections[key].length > 0,
        characterId + ": " + key + " の節に本文がある");
      check(Boolean(DOSSIER_SECTION_HEADINGS[key]), key + " に見出しがある");
    }

    // 関係の相手が実在し、自分自身を指していない。
    for (const bond of entry.bonds) {
      check(DOSSIER_IDS.includes(bond.with), characterId + ": 関係の相手 " + bond.with + " が実在する");
      check(bond.with !== characterId, characterId + ": 自分との関係を書いていない");
      check(bond.lines.length > 0, characterId + "⇄" + bond.with + " に本文がある");
    }
  }

  // ---- 開く順。**会っていなければ 0、揃うまで will は出ない。** ----
  const met = new Set(partyIds);
  for (const characterId of DOSSIER_IDS) {
    equal(dossierRevealLevel(characterId, 3, { met: false, finalStageSequence }), 0,
      characterId + ": 会っていない人物の欄は出ない");

    // 加入した直後（その Stage をまだ越えていない）は佇まいだけ。
    const joined = DOSSIERS[characterId].joinStageSequence;
    const atJoin = dossierRevealLevel(characterId, joined - 1, { met: true, finalStageSequence });
    equal(atJoin, 1, characterId + ": 加入した時点では佇まいだけが読める");
    assert.deepEqual(revealedDossierSections(atJoin), ["figure"],
      characterId + ": 加入直後に開くのは figure だけ");
    checks += 1;
  }

  // will は5人が揃うまで開かない。**Stage 3 を越える前に誰の will も読めない。**
  for (let highest = -1; highest < finalStageSequence; highest += 1) {
    for (const characterId of DOSSIER_IDS) {
      const level = dossierRevealLevel(characterId, highest, { met: true, finalStageSequence });
      check(!revealedDossierSections(level).includes("will"),
        characterId + ": Stage " + highest + " 時点では will が開いていない");
    }
  }
  for (const characterId of DOSSIER_IDS) {
    const level = dossierRevealLevel(characterId, finalStageSequence, { met: true, finalStageSequence });
    equal(level, DOSSIER_SECTIONS.length, characterId + ": 5人が揃えば全節が開く");
  }

  // 節は必ず順番に開く。**飛ばして will だけ開くことはない。**
  for (const characterId of DOSSIER_IDS) {
    let previous = 0;
    for (let highest = -1; highest <= finalStageSequence; highest += 1) {
      const level = dossierRevealLevel(characterId, highest, { met: true, finalStageSequence });
      check(level >= previous, characterId + ": 開いた節が閉じ直さない");
      previous = level;
    }
  }

  // ---- 関係。**相手に会う前は出ない。** ----
  for (const characterId of DOSSIER_IDS) {
    equal(revealedBonds(characterId, finalStageSequence, new Set([characterId])).length, 0,
      characterId + ": 相手に会っていなければ関係は出ない");
    for (const bond of DOSSIERS[characterId].bonds) {
      const later = Math.max(DOSSIERS[characterId].joinStageSequence, DOSSIERS[bond.with].joinStageSequence);
      const before = revealedBonds(characterId, later - 1, met).map((row) => row.with);
      check(!before.includes(bond.with),
        characterId + "⇄" + bond.with + ": 遅いほうの Stage を越えるまで出ない");
      const after = revealedBonds(characterId, later, met).map((row) => row.with);
      check(after.includes(bond.with),
        characterId + "⇄" + bond.with + ": 越えたら出る");
    }
  }
}

console.log(`story.test.mjs: ${checks} checks passed`);
