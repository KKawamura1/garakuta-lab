// ecology/campaign-stage.test.mjs — R8 Implementation Phase 1 / Gate 1.
//
// **見るのは system の不変条件であり、fun ではない。**
//   - manifest ラダー（R8 §16.1）: Stage 0〜3 の固定 manifest が契約を満たす。
//   - HP 持ち越し（R8 §8, §10）: 勝利時だけ commit、敗北時は commit しない、
//     4/8戦目 boss 勝利後だけ全回復。
//   - 野営治療（R8 §9.2）: 補給を消費し、治療できない対象へは空撃ちしない。
//   - 安全撤退（R8 §10.3）: 完走・初clear bonus が付かず、Blueprint 保存上限が
//     won/lost と異なる。
//   - exact preview（R8 §11）: preview と実行が同じ経路（simulateNextBattle）を
//     通るので、同じ引数なら同じ結果になる。
//
// **round を稼ぐと carry HP が伸びるか**という本来の anti-stall 機械検査
// （R8 §16.6）は、ここには**まだ入れていない**。現行の `mend`/`triage` が
// その検査に通らないことは analysis/ecology-anti-stall-smoke.mjs が既に
// 診断していて（意図的に非ゼロ終了、check-all.sh の fast path 対象外）、
// 直すまでは push ごとに走るこのファイルを赤くしない
// （analysis/experiments/exp-18/R8_IMPLEMENTATION_PHASE0_FREEZE.md §3）。

import assert from "node:assert/strict";
import { PLAYABLE_CONTENT, REGION } from "./content/index.mjs";
import {
  CAMPAIGN_STAGES,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  activePackCountForSequence,
  auditCampaignManifestLadder,
  campaignManifestForStage,
  campaignStageDef,
} from "./content/campaign-stages.mjs";
import {
  BLUEPRINT_SAVE_LIMIT,
  CAMP_TREATMENTS,
  MAX_SUPPLIES,
  availableCampaignStages,
  availableCharacterIds,
  campTreat,
  characterStats,
  commitBattleResult,
  isActBossFullHealIndex,
  isCampaignStageUnlocked,
  newProfile,
  newRun,
  normalizeProfile,
  purchaseTraining,
  purchaseUpgrade,
  settleRun,
  slotUpgradeId,
} from "./progression.mjs";
import { freshLoadout, previewNextBattle, simulateNextBattle } from "./playable-battles.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const ROSTER = ["warden", "mender", "lancer", "scout", "guardian"];

function campaignCompleteProfile() {
  const profile = newProfile();
  profile.campaignProgress[REGION.id] = {
    highestClearedStageSequence: MAX_CAMPAIGN_STAGE_SEQUENCE,
    clearedStageSequences: Array.from({ length: MAX_CAMPAIGN_STAGE_SEQUENCE + 1 }, (_, index) => index),
  };
  profile.unlockedCharacterIds = availableCharacterIds(profile);
  return profile;
}

// ---- 登場済み人物だけをギルド対象にする ------------------------------

{
  const profile = newProfile();
  profile.activityFunds = "1000000";
  assert.deepEqual(availableCharacterIds(profile), ["warden", "mender"], "最初は登場済みの2人だけ");
  checks += 1;
  check(!purchaseTraining(profile, "mender", "might").ok, "未登場の人物は鍛錬できない");
  check(!purchaseUpgrade(profile, slotUpgradeId("active", "mender")).ok, "未登場の人物は枠を買えない");

  profile.campaignProgress[REGION.id] = {
    highestClearedStageSequence: 2,
    clearedStageSequences: [0, 1, 2],
  };
  profile.unlockedCharacterIds = availableCharacterIds(profile);
  assert.deepEqual(profile.unlockedCharacterIds, ["warden", "mender", "lancer", "guardian", "tactician"],
    "Stage 2 までで5人が登場済み");
  checks += 1;
  check(purchaseTraining(profile, "mender", "might").ok, "登場済みの人物は鍛錬できる");
  check(!purchaseTraining(profile, "scout", "might").ok, "残りの未登場人物は鍛錬できない");
  equal(availableCharacterIds(profile).length, 5, "最大でも8人中5人だけがギルド対象");
  const reloaded = normalizeProfile({
    ...JSON.parse(JSON.stringify(profile)),
    unlockedCharacterIds: ["scout", "pivot", "arcanist"],
  });
  assert.deepEqual(reloaded.unlockedCharacterIds, profile.unlockedCharacterIds,
    "セーブ内の解放欄が水増しされても進行から再構成する");
  checks += 1;
}

// ---- manifestラダー（R8 §16.1）----------------------------------------------

{
  const problems = auditCampaignManifestLadder(CAMPAIGN_STAGES);
  assert.deepEqual(problems, [], "Stage 0〜3 の manifest ラダーに違反が無い");
  checks += 1;

  equal(MAX_CAMPAIGN_STAGE_SEQUENCE, 3, "Stage 0〜3 の4段だけを固定している");
  // R9 §3 — 初期4 Stage は累積（1,2,3,4）。R8 §4.2 の回転式（1,2,2,3）は
  // Stage 4 以降のために残してある。**どちらの式も、名乗った mode で引く。**
  equal(activePackCountForSequence(0, "tutorial"), 1, "Stage 0 の有効パック数");
  equal(activePackCountForSequence(1, "tutorial"), 2, "Stage 1 の有効パック数");
  equal(activePackCountForSequence(2, "tutorial"), 3, "Stage 2 の有効パック数");
  equal(activePackCountForSequence(3, "tutorial"), 4, "Stage 3 の有効パック数");
  equal(activePackCountForSequence(2, "rotation"), 2, "R8 §4.2 の回転式も残っている");
  equal(activePackCountForSequence(3, "rotation"), 3, "R8 §4.2 の回転式も残っている");

  // R11 §5 — ラダーを組み替えた。**導入は「構えと手当て」で、刃は次の Stage。**
  // 問題（紙の火力をどこに置くか）を出してから、その解決（庇う手）を渡す順にしてある。
  assert.deepEqual(campaignStageDef(0).enabledPackIds, ["pack_care"], "Stage 0 = C");
  assert.deepEqual(campaignStageDef(1).enabledPackIds, ["pack_care", "pack_edge"], "Stage 1 = C + E");
  assert.deepEqual(campaignStageDef(2).enabledPackIds, ["pack_care", "pack_edge", "pack_wall"], "Stage 2 = C + E + W");
  assert.deepEqual(
    campaignStageDef(3).enabledPackIds,
    ["pack_care", "pack_edge", "pack_wall", "pack_tempo"],
    "Stage 3 = C + E + W + T",
  );
  checks += 4;

  // R9 §2.1 — 2人から始めて、Stage ごとに1人ずつ増え、Stage 3 で5人が揃う。
  for (const stage of CAMPAIGN_STAGES) {
    equal(stage.partySize, stage.sequence + 2, stage.id + " の人数");
    equal(stage.castCharacterIds.length, stage.partySize, stage.id + " の cast 人数");
    if (stage.sequence === 0) {
      equal(stage.joiningCharacterId, null, "Stage 0 は誰も加入しない（最初の2人）");
    } else {
      const previous = campaignStageDef(stage.sequence - 1);
      const added = stage.castCharacterIds.filter((id) => !previous.castCharacterIds.includes(id));
      assert.deepEqual(added, [stage.joiningCharacterId], stage.id + " は1人だけ加わる");
      checks += 1;
    }
  }

  // R9 §3.1 — 新 pack は core（入口）で入り、前 Stage の pack は full になる。
  for (const stage of CAMPAIGN_STAGES) {
    equal(stage.packDepths[stage.newPackId], "core", stage.id + " の新 pack は core");
    for (const packId of stage.returningPackIds) {
      equal(stage.packDepths[packId], "full", stage.id + " の過去 pack " + packId + " は full");
    }
  }

  // 同Stage・異seedでpack構成が一致する。seed は敵順・報酬用にしか使わない。
  const a = campaignManifestForStage(2, "seed-alpha");
  const b = campaignManifestForStage(2, "seed-beta");
  assert.deepEqual(a.enabledPackIds, b.enabledPackIds, "campaign manifest は seed で pack 構成が変わらない");
  check(a.seed !== b.seed, "ただし seed 自体は記録される（敵順・報酬用）");
}

// ---- Campaign Stage 解禁（R8 §3.1）------------------------------------------

{
  const profile = newProfile();
  assert.deepEqual(availableCampaignStages(profile), [0], "最初は Stage 0 だけ解禁");
  check(isCampaignStageUnlocked(profile, 0), "Stage 0 は解禁済み");
  check(!isCampaignStageUnlocked(profile, 1), "Stage 1 はまだ解禁されていない");
  checks += 2;

  const run = newRun(profile, { runSeed: "s", runId: "camp-r0", roster: ROSTER, campaignStageSequence: 0 });
  equal(run.campaignStageSequence, 0, "run が campaign stage を記録する");
  assert.deepEqual(run.manifest.enabledPackIds, ["pack_care"], "Stage 0 の run manifest");
  checks += 1;
  // R9 §2.1 — Stage 0 は2人。5人渡しても切り詰める。
  equal(run.roster.length, 2, "Stage 0 の遠征は2人で始まる");
  equal(run.partySize, 2, "run が Stage の人数を持つ");
  check(run.rosterLocked, "初回のチュートリアル Stage では編成を組み替えない");

  const settled = settleRun(profile, { ...run, fundLedger: { ...run.fundLedger, settled: false } }, "won");
  check(settled.ok, "campaign run を精算できる");
  assert.deepEqual(availableCampaignStages(settled.profile), [0, 1], "Stage 0 クリアで Stage 1 が開く");
  equal(settled.settlement.unlockedCampaignStage, 1, "settlement が解禁した Stage を報告する");
  checks += 2;
}

// ---- HP持ち越し（R8 §8, §10）-------------------------------------------------

function syntheticResult(result, allyHpById) {
  return {
    result,
    reason: result === "win" ? "objective_met" : "all_allies_defeated",
    roundsUsed: 3,
    actors: ROSTER.map((characterId) => ({
      instanceId: "a_" + characterId,
      side: "ally",
      hp: allyHpById[characterId] ?? 0,
      alive: (allyHpById[characterId] ?? 0) > 0,
    })),
  };
}

// **人数を5人で固定して見る。**ここで見たいのは HP の持ち越しであって、
// R9 のチュートリアル人数ではない（`freeRoster` は一度クリアした Stage の
// 遊び直しと同じ扱いで、Stage の人数制限を外す）。
{
  const profile = campaignCompleteProfile();
  const run = newRun(profile, { runSeed: "s", runId: "hp-r1", roster: ROSTER, campaignStageSequence: 0, freeRoster: true });
  const fullHp = { ...run.currentHp };
  for (const id of ROSTER) check(fullHp[id] > 0, id + " は遠征開始時に満タン");

  // 通常戦（index 1）勝利: ダメージを負ったまま持ち越す。
  const damaged = Object.fromEntries(ROSTER.map((id) => [id, Math.max(1, Math.floor(fullHp[id] * 0.4))]));
  const win1 = commitBattleResult(profile, run, 1, syntheticResult("win", damaged));
  check(win1.snapshot.committed, "勝利は commit される");
  assert.deepEqual(win1.run.currentHp, damaged, "通常戦後は終了HPをそのまま持ち越す");
  checks += 1;

  // 同じ戦闘に負けたら、開始前 snapshot から何も変えない（retry safe）。
  const loss1 = commitBattleResult(profile, run, 1, syntheticResult("loss", { warden: 0, mender: 5, lancer: 0, scout: 3, guardian: 0 }));
  check(!loss1.snapshot.committed, "敗北は commit されない");
  assert.deepEqual(loss1.run.currentHp, run.currentHp, "敗北後は run が変更されない（そのまま retry できる）");
  checks += 1;

  // 4戦目（act boss）勝利は、途中でどれだけ削れていても全回復する。
  check(isActBossFullHealIndex(4), "4戦目は全回復対象");
  check(isActBossFullHealIndex(8), "8戦目は全回復対象");
  check(!isActBossFullHealIndex(1) && !isActBossFullHealIndex(12), "1戦目・12戦目は全回復対象ではない");
  const nearDeath = Object.fromEntries(ROSTER.map((id) => [id, 1]));
  const bossWin = commitBattleResult(profile, win1.run, 4, syntheticResult("win", nearDeath));
  for (const id of ROSTER) {
    equal(bossWin.run.currentHp[id], characterStats(profile, id).stats.maxHp, id + " は4戦目boss後に全回復する");
  }
}

// ---- 野営治療（R8 §9.2）------------------------------------------------------

{
  const profile = campaignCompleteProfile();
  let run = newRun(profile, { runSeed: "s", runId: "camp-treat", roster: ROSTER, campaignStageSequence: 0, freeRoster: true });
  const maxHp = characterStats(profile, "warden").stats.maxHp;
  run = { ...run, currentHp: { ...run.currentHp, warden: Math.floor(maxHp * 0.3) } };
  const before = run.supplies;

  const treated = campTreat(run, profile, "concentrated", ["warden"]);
  check(treated.ok, "集中治療が成功する");
  equal(treated.run.supplies, before - 1, "野営治療は補給を1消費する");
  const expected = Math.min(maxHp, Math.floor(maxHp * 0.3) + Math.round(maxHp * CAMP_TREATMENTS.concentrated.healBps / 10_000));
  check(treated.run.currentHp.warden > Math.floor(maxHp * 0.3) && treated.run.currentHp.warden <= maxHp,
    "集中治療で対象のHPが増え、maxHpを超えない");
  checks += 1;
  void expected;

  // 満タンの対象へは空撃ちしない（補給を消費しない）。
  const fullHpRun = { ...run, currentHp: Object.fromEntries(ROSTER.map((id) => [id, characterStats(profile, id).stats.maxHp])) };
  const wasted = campTreat(fullHpRun, profile, "concentrated", ["warden"]);
  check(!wasted.ok, "満タンの対象への集中治療は空撃ちしない");

  // 蘇生は生存者へは効かない。
  const reviveOnAlive = campTreat(run, profile, "revive", ["warden"]);
  check(!reviveOnAlive.ok, "蘇生は生存者には使えない");

  // 補給0なら治療できない。
  const drained = { ...run, supplies: 0, currentHp: { ...run.currentHp, warden: 1 } };
  const noSupply = campTreat(drained, profile, "concentrated", ["warden"]);
  check(!noSupply.ok, "補給が無ければ野営治療できない");
  check(MAX_SUPPLIES >= 1, "MAX_SUPPLIES が有限資源として存在する");
}

// ---- 安全撤退（R8 §10.3）------------------------------------------------------

{
  const profile = campaignCompleteProfile();
  const run = newRun(profile, { runSeed: "s", runId: "retreat-r1", roster: ROSTER, campaignStageSequence: 0, freeRoster: true });
  const retreated = settleRun(profile, run, "retreat");
  check(retreated.ok, "安全撤退を精算できる");
  equal(retreated.settlement.breakdown.outcomeBonus, 0, "安全撤退には完走ボーナスが付かない");
  equal(retreated.settlement.firstClear, false, "安全撤退には初clearボーナスが付かない");
  equal(retreated.settlement.blueprintSaveLimit, BLUEPRINT_SAVE_LIMIT.retreat, "安全撤退のBlueprint保存上限");
  check(BLUEPRINT_SAVE_LIMIT.retreat > BLUEPRINT_SAVE_LIMIT.lost, "安全撤退は敗北より保存上限が高い");
  check(BLUEPRINT_SAVE_LIMIT.retreat === BLUEPRINT_SAVE_LIMIT.won, "安全撤退と勝利の保存上限は同じ");

  const lostRun = newRun(profile, { runSeed: "s", runId: "lost-r1", roster: ROSTER, campaignStageSequence: 0, freeRoster: true });
  const lost = settleRun(profile, lostRun, "lost");
  equal(lost.settlement.blueprintSaveLimit, 1, "敗北のBlueprint保存上限は1");
}

// ---- exact preview（R8 §11）---------------------------------------------------

{
  const profile = campaignCompleteProfile();
  const run = newRun(profile, { runSeed: "preview-seed", runId: "preview-r1", roster: ROSTER, campaignStageSequence: 0, freeRoster: true });
  const runWithLoadout = { ...run, loadout: freshLoadout(ROSTER) };

  const preview = previewNextBattle(runWithLoadout, profile, 1);
  const { result: executed } = simulateNextBattle(runWithLoadout, profile, 1);
  const executedSummary = {
    result: executed.result,
    reason: executed.reason,
    roundsUsed: executed.roundsUsed,
    perCharacter: ROSTER.map((characterId) => {
      const actor = executed.actors.find((entry) => entry.instanceId === "a_" + characterId);
      return {
        characterId,
        startingHp: runWithLoadout.currentHp[characterId] ?? 0,
        endingHp: actor ? actor.hp : 0,
        defeated: actor ? !actor.alive : true,
      };
    }),
    metrics: executed.metrics,
  };
  assert.deepEqual(preview, executedSummary, "previewは正式実行と完全一致する（同じ経路を通るため）");
  checks += 1;

  // previewはRunStateを変更しない。
  const before = JSON.stringify(runWithLoadout);
  previewNextBattle(runWithLoadout, profile, 1);
  previewNextBattle(runWithLoadout, profile, 1);
  equal(JSON.stringify(runWithLoadout), before, "preview を連打してもRunStateは変わらない");

  // 同じ入力なら preview は決定的（何度呼んでも同じ）。
  const previewAgain = previewNextBattle(runWithLoadout, profile, 1);
  assert.deepEqual(preview, previewAgain, "preview は同じ入力に対して決定的");
  checks += 1;
}

console.log(`campaign-stage.test.mjs: ${checks} checks passed`);
