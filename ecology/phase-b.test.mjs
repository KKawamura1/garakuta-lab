// ecology/phase-b.test.mjs — R6 Phase B の遠征と活動資金。
//
// **見るのは「動くこと」ではなく、R6 が固定した不変条件のとおりか。**
// Phase B が壊れる壊れ方は、落ちるのではなく「二度精算する」「retry で稼げる」
// 「難易度が買える」「鍛錬が行動回数を増やす」のように**静かに得をする**方向なので、
// ここは全部その方向を狙って書いてある。

import assert from "node:assert/strict";
import {
  LIMITS,
  MANIFEST_VERSION,
  PROFILE_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
  TRAINABLE_STATS,
} from "./schema.mjs";
import { simulateBattle, validateBattleInput } from "./engine.mjs";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import {
  BOSS_LAWS,
  BASELINE_PASSIVE_SKILL_IDS,
  DIFFICULTIES,
  ENCOUNTERS_PER_RUN,
  ENEMY_MUTATIONS,
  ENEMY_THREAT_COST,
  EXPEDITION_ENCOUNTERS,
  MAX_DIFFICULTY_RANK,
  SKILL_PACKS,
  expeditionEncounter,
  packOfSkill,
  skillIdsForPacks,
} from "./content/index.mjs";
import { SKILL_TREE_NODES, freshLoadout, makeExpeditionBattle } from "./playable-battles.mjs";
import {
  ENCOUNTER_BASE_FUNDS,
  MAX_SUPPLIES,
  SCRAP_PER_SUPPLY,
  SUPPLY_USES,
  availableDifficulties,
  characterStats,
  composeEncounter,
  convertScrap,
  dismantle,
  formatFunds,
  grantRunSkillPointsToAll,
  makeManifest,
  migrateLegacyProfile,
  newProfile,
  newRun,
  normalizeProfile,
  parseFunds,
  purchaseTraining,
  purchaseUpgrade,
  recordEncounterCleared,
  rewardOffer,
  runSkillPoints,
  settleRun,
  slotLimits,
  slotUpgradeId,
  spendSupply,
  trainedStat,
  trainingCost,
  unlockRunSkill,
  upgradeCost,
} from "./progression.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const ROSTER = ["warden", "mender", "lancer", "guardian", "tactician"];
const FORMATION = {
  warden: "front_left", lancer: "front_center", guardian: "front_right",
  mender: "rear_left", tactician: "rear_right",
};

// ---- 版（R6 §16）-------------------------------------------------------------

// R8 Implementation Phase 1 — currentHp / campaignStageSequence / campaignProgress
// を追加したので、profile / run / manifest の版をそれぞれ1つ上げた。
equal(PROFILE_SCHEMA_VERSION, "ecology-profile-2", "profile の版");
equal(RUN_SCHEMA_VERSION, "ecology-run-2", "run の版");
equal(MANIFEST_VERSION, "ecology-manifest-2", "manifest の版");

// ---- 3幕12戦（R6 §5.1）------------------------------------------------------

equal(EXPEDITION_ENCOUNTERS.length, 12, "12戦");
equal(ENCOUNTERS_PER_RUN, 12, "ENCOUNTERS_PER_RUN も12");
for (const index of [4, 8, 12]) {
  equal(expeditionEncounter(index).kind, "boss", index + "戦目はボス");
  check(Boolean(expeditionEncounter(index).bossLawId), index + "戦目のボスに公開法則がある");
}
for (const index of [1, 2, 3, 5, 6, 7, 9, 10, 11]) {
  check(["normal", "elite"].includes(expeditionEncounter(index).kind), index + "戦目は通常か精鋭");
}
equal(new Set(EXPEDITION_ENCOUNTERS.map((e) => e.act)).size, 3, "幕は3つ");
for (const encounter of EXPEDITION_ENCOUNTERS) {
  equal(
    encounter.act, encounter.index <= 4 ? 1 : encounter.index <= 8 ? 2 : 3,
    encounter.index + "戦目の幕",
  );
  check(encounter.enemies.length <= 5, encounter.index + "戦目の敵は5体以下");
  equal(
    new Set(encounter.enemies.map((e) => e.position)).size, encounter.enemies.length,
    encounter.index + "戦目の位置が重複していない",
  );
}

// R6 §11.2 — base budget は12段階へ**単調増加**。
for (let index = 2; index <= 12; index += 1) {
  check(
    expeditionEncounter(index).threatBudget > expeditionEncounter(index - 1).threatBudget,
    index + "戦目の threat budget が前より重い",
  );
}

// budget は編成から算出する。**手で書いた数と編成がずれない。**
for (const encounter of EXPEDITION_ENCOUNTERS) {
  const sum = encounter.enemies.reduce((total, enemy) =>
    total + ENEMY_THREAT_COST[enemy.enemyActorId]
    + (enemy.boss && encounter.bossLawId ? BOSS_LAWS[encounter.bossLawId].threatCost : 0), 0);
  equal(encounter.threatBudget, sum, encounter.index + "戦目の budget = 編成の合計");
}

// ---- 難易度（R6 §13.2 / §9.6）-----------------------------------------------

equal(DIFFICULTIES.length, 6, "Phase B は rank 0〜5 だけ");
equal(MAX_DIFFICULTY_RANK, 5, "上限 rank");
equal(DIFFICULTIES[0].threatBudgetDelta, 0, "rank 0 は基準");
equal(DIFFICULTIES[0].startingSupplies, 3, "rank 0 の開始補給は3");
equal(DIFFICULTIES[5].startingSupplies, 2, "rank 5 の開始補給は2");
for (let rank = 1; rank <= MAX_DIFFICULTY_RANK; rank += 1) {
  check(
    DIFFICULTIES[rank].encounterModifiers.length >= DIFFICULTIES[rank - 1].encounterModifiers.length,
    "rank " + rank + " の変更は前の rank を含む",
  );
}

// **rank 0 は budget をちょうど使い切る**ので、増援も余り変異も出ない
// （R7 §8 の「まず Difficulty 0 の reference encounter を固定する」）。
for (const encounter of EXPEDITION_ENCOUNTERS) {
  const composed = composeEncounter(encounter.index, 0);
  equal(composed.enemies.length, encounter.enemies.length, encounter.index + "戦目 rank 0 に増援は無い");
  for (const enemy of composed.enemies) {
    if (enemy.boss) continue;
    equal(enemy.mutations.length, 0, encounter.index + "戦目 rank 0 の非ボスに変異は無い");
  }
}

// rank を上げると、**どの戦闘でも何かが増える**（増援か変異か round 制限）。
for (let rank = 1; rank <= MAX_DIFFICULTY_RANK; rank += 1) {
  for (const encounter of EXPEDITION_ENCOUNTERS) {
    const base = composeEncounter(encounter.index, 0);
    const raised = composeEncounter(encounter.index, rank);
    const grew = raised.enemies.length > base.enemies.length
      || raised.enemies.reduce((n, e) => n + e.mutations.length, 0)
        > base.enemies.reduce((n, e) => n + e.mutations.length, 0)
      || raised.maxRounds < base.maxRounds;
    check(grew, "rank " + rank + " の " + encounter.index + "戦目で何かが増えている");
  }
}

// **同じ入力なら同じ編成**（R6 §16）。
assert.deepEqual(composeEncounter(7, 3), composeEncounter(7, 3));
checks += 1;

// ボスの法則は rank 0 でも載る。**難易度で初めて現れる法則にしない。**
for (const index of [4, 8, 12]) {
  const composed = composeEncounter(index, 0);
  const boss = composed.enemies.find((enemy) => enemy.boss);
  const law = BOSS_LAWS[composed.bossLawId];
  check(boss.stats.maxHp > boss.baseStats.maxHp, index + "戦目のボスは法則ぶん厚い");
  check(law.counters.length >= 3, index + "戦目の法則に対応方法が3つ以上ある（R6 §11.3）");
}

// 変異は stat しか動かさない。**Phase B で rule を足す変異は作らない。**
for (const mutation of Object.values(ENEMY_MUTATIONS)) {
  for (const stat of Object.keys(mutation.patch)) {
    check(["maxHp", "might", "focus", "guard"].includes(stat), mutation.id + " は連続量だけを動かす");
  }
  check(!("ruleIds" in mutation) && !("tacticPatch" in mutation), mutation.id + " は rule を足さない");
}

// ---- 技能パック（R6 §5.2 / §6.2）--------------------------------------------

// R8 Implementation Phase 1 — pack_barrage を追加して5パック。
// R9 §5 — 横断pack「余波と受け渡し」（pack_relay）の試作を足して6パック。
// **Campaign Stage 0〜3 には入れていない**（Free / Endless からだけ引ける）。
equal(SKILL_PACKS.length, 6, "技能を6パックへ分けた");
{
  const seen = new Map();
  for (const pack of SKILL_PACKS) {
    for (const id of [...pack.activeSkillIds, ...pack.reactiveSkillIds]) {
      check(!seen.has(id), id + " は一つのパックにだけ属する");
      seen.set(id, pack.id);
    }
  }
  // **どのパックにも baseline にも属さない技能は、どの遠征でも出ない。**
  for (const node of SKILL_TREE_NODES) {
    check(packOfSkill(node.skillId) !== null, node.skillId + " に行き先のパックがある");
  }
}
{
  const manifest = makeManifest("seed-1", newProfile());
  equal(manifest.enabledPackIds.length, 3, "一遠征で有効なパックは3つ");
  assert.deepEqual(makeManifest("seed-1", newProfile()), manifest);
  checks += 1;
  const ids = skillIdsForPacks(manifest.enabledPackIds);
  // baseline は必ず入る（R6 §5.2「行動不能な人物を作らない」）。
  for (const id of ["strike", "bulwark"]) check(ids.active.includes(id), id + " は baseline active");
  // R8 Implementation Phase 1（続き）— mend は anti-stall 安全な reactive へ
  // 作り替えたので baseline reactive になった。
  check(ids.reactive.includes("mend"), "mend は baseline reactive");
  // 常設 fallback は詰み防止なのでパックに属さず、常に取れる（R6 §6.8）。
  // **総数ではなく「7種が必ず含まれる」ことを見る**——R9 §4.1 で導入 pack が
  // それぞれ常設を1つ持つようになったので、pack 由来の常設が上に乗る。
  for (const id of BASELINE_PASSIVE_SKILL_IDS) {
    check(ids.passive.includes(id), id + " は常設 fallback として常に取れる");
  }
  const packPassives = ids.passive.filter((id) => !BASELINE_PASSIVE_SKILL_IDS.includes(id));
  for (const id of packPassives) {
    check(manifest.enabledPackIds.includes(packOfSkill(id)),
      id + " は有効パック由来の常設（外れたパックの常設は出ない）");
  }
  const excluded = SKILL_PACKS.find((pack) => !manifest.enabledPackIds.includes(pack.id));
  for (const id of excluded.activeSkillIds) {
    check(!ids.all.includes(id), id + " は外れたパックなので出ない");
  }
}

// ---- 技能点は遠征内（R6 §5.3）----------------------------------------------

{
  const profile = newProfile();
  let run = newRun(profile, { runSeed: "s", runId: "r", roster: ROSTER });
  check(!("skillPoints" in profile), "profile が技能点を持たない");
  check(!("unlocked" in profile), "profile が解禁を持たない");
  check(!("inventory" in profile), "profile が装備を持たない");
  equal(runSkillPoints(run, "warden"), 0, "遠征開始時の技能点");
  equal(run.inventory.length, 0, "遠征開始時の装備");
  run = grantRunSkillPointsToAll(run);
  for (const id of ROSTER) equal(runSkillPoints(run, id), 1, id + "へ勝利報酬の技能点");

  // manifest に無い技能は解禁できない。
  const outside = SKILL_PACKS.find((pack) => !run.manifest.enabledPackIds.includes(pack.id));
  const outsideNode = SKILL_TREE_NODES.find((node) => outside.activeSkillIds.includes(node.skillId)
    || outside.reactiveSkillIds.includes(node.skillId));
  equal(unlockRunSkill(run, "warden", outsideNode).ok, false, "外れたパックの技能は解禁できない");

  // 前提と点数の両方を見る。
  const heavy = SKILL_TREE_NODES.find((node) => node.skillId === "heavy_swing");
  if (run.manifest.enabledPackIds.includes("pack_edge")) {
    run.runUnlockedSkills = { warden: ["strike"] };
    const ok = unlockRunSkill(run, "warden", heavy);
    equal(ok.ok, true, "前提と点数が揃えば解禁できる");
    run = ok.run;
    equal(runSkillPoints(run, "warden"), 1, "点数が減っている");
    // R14 §2 — 解禁は取り消せない。**払い戻しの経路そのものが無い。**
    equal(unlockRunSkill(run, "warden", heavy).ok, false, "同じ技能を二度は解禁できない");
    assert.deepEqual(run.runUnlockedSkills.warden, ["strike", "heavy_swing"]);
    checks += 1;
  }
}

// ---- 枠（R6 §6.6）-----------------------------------------------------------

{
  const profile = newProfile();
  assert.deepEqual(slotLimits(profile, "warden"), { active: 3, reactive: 3, passive: 2, equipment: 2 });
  checks += 1;
  equal(LIMITS.maxTactics, 4, "構造上限は4");
  equal(LIMITS.maxReactiveSkills, 4, "反応の構造上限も4");
  equal(LIMITS.maxPassiveSkills, 2, "常設の第3枠は R6 では追加しない");

  const bought = purchaseUpgrade(
    { ...profile, activityFunds: "100000" }, slotUpgradeId("active", "warden"),
  );
  equal(bought.ok, true, "第4枠を買える");
  equal(slotLimits(bought.profile, "warden").active, 4, "買った人だけ4枠");
  equal(slotLimits(bought.profile, "lancer").active, 3, "**買っていない人は3枠のまま**");
  equal(upgradeCost(bought.profile, slotUpgradeId("active", "warden")), null, "二度は買えない");
  equal(bought.purchase.balanceBefore, "100000", "購入前の残高が残る");
  equal(bought.purchase.balanceAfter, "70000", "購入後の残高が残る");
}

// 装着した3枠が**戦闘へ届く**こと。Phase A では slice(0, 2) で3つ目が消えていた。
{
  const loadout = freshLoadout(ROSTER);
  loadout.tactics.warden = ["bulwark", "strike", "pierce_thrust"];
  const battle = makeExpeditionBattle(composeEncounter(1, 0), ROSTER, loadout, "s", FORMATION, {});
  const warden = battle.allies.find((ally) => ally.characterId === "warden");
  equal(warden.tactics.length, 3, "3つ目の行動が戦闘へ届く");
  assert.deepEqual(validateBattleInput(battle, PLAYABLE_CONTENT), []);
  checks += 1;
}

// 4枠を買った人は4つ届く。
{
  const loadout = freshLoadout(ROSTER);
  loadout.tactics.warden = ["bulwark", "strike", "pierce_thrust", "rapid_cuts"];
  const battle = makeExpeditionBattle(composeEncounter(1, 0), ROSTER, loadout, "s", FORMATION, {
    limitsFor: (id) => (id === "warden" ? { active: 4 } : {}),
  });
  equal(battle.allies.find((a) => a.characterId === "warden").tactics.length, 4, "第4枠も届く");
  assert.deepEqual(validateBattleInput(battle, PLAYABLE_CONTENT), []);
  checks += 1;
}

// ---- 鍛錬（R6 §9.5）---------------------------------------------------------

equal(trainingCost(0).toString(), "2000", "level 0 の一段");
equal(trainingCost(10).toString(), "2100", "R6 の表：level 10 で 2,100");
equal(trainingCost(100).toString(), "3000", "R6 の表：level 100 で 3,000");
equal(trainingCost(300).toString(), "5000", "R6 の表：level 300 で 5,000");
equal(trainingCost(1000).toString(), "12000", "R6 の表：level 1,000 で 12,000");
{
  let total = 0n;
  for (let level = 0; level < 10; level += 1) total += trainingCost(level);
  equal(total.toString(), "20000", "R6 の表：level 10 までの累計 20,000");
}
equal(trainedStat(100, 100), 110, "level 100 で +10%");
equal(trainedStat(100, 1000), 200, "level 1,000 で +100%");
equal(trainedStat(3, 1), 3, "小さい stat は一段では整数が動かない");

// **買った順や save/load で複利差を作らない。**常に base へ合計倍率を掛ける。
{
  let profile = newProfile();
  profile.activityFunds = "1000000";
  for (let n = 0; n < 50; n += 1) {
    const result = purchaseTraining(profile, "warden", "might");
    check(result.ok, "鍛錬を買えた " + n);
    profile = result.profile;
  }
  const stats = characterStats(profile, "warden");
  equal(stats.detail.might.level, 50, "50段ぶん");
  equal(stats.stats.might, trainedStat(stats.base.might, 50), "常に base から計算する");
  // 途中で保存して読み直しても同じ。
  const reloaded = normalizeProfile(JSON.parse(JSON.stringify(profile)));
  equal(characterStats(reloaded, "warden").stats.might, stats.stats.might, "save/load で差が出ない");

  // **鍛錬は行動回数を上げない。**speed / AP / RP は base のまま。
  const definition = PLAYABLE_CONTENT.characters.warden;
  for (const axis of TRAINABLE_STATS) check(["might", "focus", "guard", "vitality"].includes(axis), axis);
  const battle = makeExpeditionBattle(composeEncounter(1, 0), ROSTER, freshLoadout(ROSTER), "s", FORMATION, {
    statsFor: (id) => characterStats(profile, id),
  });
  const warden = battle.allies.find((ally) => ally.characterId === "warden");
  equal(warden.stats.might, stats.stats.might, "鍛錬後の腕力が BattleInput に載る");
  equal(warden.training.might, 50, "鍛錬 level も載る（R6 §9.5 の因果 log 要件）");
  check(!("speed" in warden.stats), "speed は上書きできない");
  check(!("baseActionPoints" in warden.stats), "AP は上書きできない");
  assert.deepEqual(validateBattleInput(battle, PLAYABLE_CONTENT), []);
  checks += 1;
  const result = simulateBattle(battle, PLAYABLE_CONTENT, { equipmentBreaks: false });
  const actor = result.actors.find((a) => a.definitionId === "warden");
  equal(actor.might, stats.stats.might, "engine が鍛錬後の値で戦う");
  equal(actor.baseStats.might, definition.might, "結果 log に base が残る");
  equal(actor.speed, definition.speed, "速度は動かない");
}

// validator は鍛錬できない stat の上書きを拒否する。
{
  const battle = makeExpeditionBattle(composeEncounter(1, 0), ROSTER, freshLoadout(ROSTER), "s", FORMATION, {});
  battle.allies[0].stats = { speed: 99 };
  const errors = validateBattleInput(battle, PLAYABLE_CONTENT);
  check(errors.some((error) => error.code === "unknown_stat"), "speed の上書きは拒否される");
  battle.allies[0].stats = { might: 40 };
  battle.allies[0].nonsense = 1;
  check(
    validateBattleInput(battle, PLAYABLE_CONTENT).some((error) => error.code === "unknown_key"),
    "未知の欄は黙って無視せず拒否する（R7 §4.3）",
  );
}

// ---- 活動資金（R6 §9.1 / §9.2）----------------------------------------------

equal(formatFunds("3560"), "3,560", "桁区切り");
equal(formatFunds("1000000"), "1,000,000", "K / M へ省略しない");
// safe integer を超えても壊れない（永続化は10進文字列、計算は bigint）。
equal(parseFunds("9007199254740993").toString(), "9007199254740993", "2^53 を超えても落ちない");
equal(parseFunds("-5").toString(), "0", "負の残高は作らない");
equal(parseFunds("abc").toString(), "0", "壊れた値は 0");

equal(ENCOUNTER_BASE_FUNDS.normal, 100, "通常戦の base");
equal(ENCOUNTER_BASE_FUNDS.elite, 180, "精鋭戦の base");
equal(ENCOUNTER_BASE_FUNDS.boss, 320, "ボスの base");

// R6 §9.2 が数字で書いた例：rank 0 の12戦を通常9・boss 3 として初回クリアすると 3,560。
{
  const raw = 9 * 100 + 3 * 320 + 12 * 25 + 600 + 800;
  equal(raw, 3560, "R6 §9.2 の 3,560 と式が一致する");
}

// **retry しても同じ encounter の撃破 base は一度だけ。**
{
  const profile = newProfile();
  let run = newRun(profile, { runSeed: "s", runId: "r1", roster: ROSTER });
  run = recordEncounterCleared(run, 1);
  const once = run.fundLedger.clearedEncounterBase;
  run = recordEncounterCleared(run, 1);
  equal(run.fundLedger.clearedEncounterBase, once, "同じ戦闘を二度数えない");
  equal(run.fundLedger.highestClearedEncounter, 1, "到達距離も動かない");
  run = recordEncounterCleared(run, 2);
  equal(run.fundLedger.clearedEncounterBase, once + 100, "別の戦闘は数える");
}

// **同じ run を二度精算しない。**
{
  const profile = newProfile();
  let run = newRun(profile, { runSeed: "s", runId: "r2", roster: ROSTER });
  for (let index = 1; index <= 12; index += 1) run = recordEncounterCleared(run, index);
  const first = settleRun(profile, run, "won");
  equal(first.ok, true, "一度目は通る");
  const expected = 6 * 100 + 3 * 180 + 3 * 320 + 12 * 25 + 600 + 800;
  equal(first.settlement.earned, expected, "内訳が式のとおり");
  equal(first.profile.activityFunds, String(expected), "残高が増える");
  const second = settleRun(first.profile, first.run, "won");
  equal(second.ok, false, "二度目は通らない");
  equal(second.profile.activityFunds, first.profile.activityFunds, "二度目で残高が動かない");
  // 同じ runId を別の run オブジェクトで持ち込んでも通さない。
  const forged = settleRun(first.profile, { ...run, fundLedger: { ...run.fundLedger, settled: false } }, "won");
  equal(forged.ok, false, "**同じ runId は profile 側でも弾く**");
}

// 負けても、確定した撃破 base と到達距離は持ち帰る（R6 §9.2）。
{
  const profile = newProfile();
  let run = newRun(profile, { runSeed: "s", runId: "r3", roster: ROSTER });
  for (let index = 1; index <= 7; index += 1) run = recordEncounterCleared(run, index);
  const lost = settleRun(profile, run, "lost");
  equal(lost.settlement.breakdown.outcomeBonus, 0, "完走 bonus は付かない");
  equal(lost.settlement.breakdown.firstClearBonus, 0, "初回クリア bonus も付かない");
  check(lost.settlement.earned > 0, "それでも持ち帰る");
  equal(lost.settlement.breakdown.distance, 7 * 25, "到達距離ぶん");
}

// 戦闘を1つも撃破していない放棄には資金を与えない（R6 §9.2）。
{
  const profile = newProfile();
  const run = newRun(profile, { runSeed: "s", runId: "r4", roster: ROSTER });
  equal(settleRun(profile, run, "abandoned").settlement.earned, 0, "直後の放棄は0");
}

// 難易度倍率 +10% / rank。
{
  const profile = newProfile();
  profile.regionProgress.ash_frontier.highestClearedDifficulty = 4;
  let run = newRun(profile, { runSeed: "s", runId: "r5", roster: ROSTER, difficulty: 5 });
  equal(run.fundLedger.difficultyMultiplierBps, 15_000, "rank 5 は ×1.5");
  run = recordEncounterCleared(run, 1);
  equal(run.fundLedger.provisionalTotal, Math.floor((100 + 25) * 1.5), "仮計上にも倍率が乗る");
}

// ---- 難易度の解禁（R6 §9.6）------------------------------------------------

{
  const profile = newProfile();
  assert.deepEqual(availableDifficulties(profile), [0], "最初は rank 0 だけ");
  checks += 1;
  // **活動資金では買えない。**購入表に難易度が無いことを見る。
  check(upgradeCost({ ...profile, activityFunds: "999999999" }, "difficulty") === null, "難易度は買えない");

  let run = newRun(profile, { runSeed: "s", runId: "r6", roster: ROSTER, difficulty: 0 });
  for (let index = 1; index <= 12; index += 1) run = recordEncounterCleared(run, index);
  const settled = settleRun(profile, run, "won");
  assert.deepEqual(availableDifficulties(settled.profile), [0, 1], "クリアで次が1つだけ開く");
  checks += 1;
  equal(settled.settlement.unlockedDifficulty, 1, "開いた rank を結果画面へ渡す");

  // rank を飛ばせない。
  let run2 = newRun(settled.profile, { runSeed: "s", runId: "r7", roster: ROSTER, difficulty: 1 });
  for (let index = 1; index <= 12; index += 1) run2 = recordEncounterCleared(run2, index);
  const settled2 = settleRun(settled.profile, run2, "won");
  assert.deepEqual(availableDifficulties(settled2.profile), [0, 1, 2], "1つずつしか開かない");
  checks += 1;
  // 同じ rank をもう一度クリアしても、初回クリア bonus は付かない。
  let run3 = newRun(settled2.profile, { runSeed: "s", runId: "r8", roster: ROSTER, difficulty: 1 });
  for (let index = 1; index <= 12; index += 1) run3 = recordEncounterCleared(run3, index);
  equal(settleRun(settled2.profile, run3, "won").settlement.breakdown.firstClearBonus, 0,
    "二度目の同じ rank に初回 bonus は無い");
}

// ---- 補給（R6 §12.1）-------------------------------------------------------

{
  const profile = newProfile();
  const run = newRun(profile, { runSeed: "s", runId: "r9", roster: ROSTER });
  equal(run.supplies, 3, "開始補給3");
  equal(MAX_SUPPLIES, 5, "上限5");
  // R14 §3 — 偵察は消えた。**補給の用途は三つだけ**で、その三つが同じ数を取り合う。
  assert.deepEqual(Object.keys(SUPPLY_USES), ["retry", "reroll", "camp"]);
  equal(spendSupply(run, "scout").ok, false, "偵察という用途はもう無い");
  checks += 1;
  const retry = spendSupply(run, "retry");
  equal(retry.run.supplies, 2, "再挑戦で1減る");
  equal(spendSupply({ ...run, supplies: 0 }, "retry").ok, false, "0では使えない");
  equal(spendSupply(run, "nonsense").ok, false, "知らない用途は拒否する");
  // 3用途が同じ数を取り合う（R6 §12.1 のトレードオフ）。
  const rerolled = spendSupply(retry.run, "reroll");
  equal(rerolled.run.supplies, 1, "引き直しは再挑戦の余地を減らす");
  equal(spendSupply(rerolled.run, "camp").run.supplies, 0, "野営治療も同じ数から引く");

  // 開始補給の購入は上限5を超えない。
  let rich = { ...profile, activityFunds: "1000000" };
  rich = purchaseUpgrade(rich, "starting_supplies").profile;
  rich = purchaseUpgrade(rich, "starting_supplies").profile;
  equal(newRun(rich, { runSeed: "s", runId: "ra", roster: ROSTER }).supplies, 5, "買い切って5");
  equal(upgradeCost(rich, "starting_supplies"), null, "3段目は無い");
  // rank 5 は開始補給を2へ下げるので、買っていても上限には届かない側で効く。
  equal(newRun(profile, { runSeed: "s", runId: "rb", roster: ROSTER, difficulty: 5 }).supplies, 2,
    "rank 5 の開始補給");
}

// ---- inventory と分解（R6 §10）---------------------------------------------

{
  const profile = newProfile();
  const run = {
    ...newRun(profile, { runSeed: "s", runId: "rc", roster: ROSTER }),
    inventory: ["standing_plate", "worn_greaves"],
  };
  const held = run.inventory[0];
  const broken = dismantle(run, held);
  equal(broken.ok, true, "持っている品は分解できる");
  equal(broken.run.scrap, 1, "分解で scrap 1");
  check(!broken.run.inventory.includes(held), "持ち物から消える");
  equal(dismantle(run, "no_such_item").ok, false, "持っていない品は分解できない");
  equal(convertScrap(broken.run).ok, false, "scrap 1 では替えられない");
  const twice = dismantle(broken.run, broken.run.inventory[0]);
  const converted = convertScrap(twice.run);
  equal(converted.ok, true, "scrap " + SCRAP_PER_SUPPLY + " で補給1");
  equal(converted.run.supplies, run.supplies + 1, "補給が増える");
  equal(converted.run.scrap, 0, "scrap を使い切る");
}

// ---- 報酬（R6 §5.3）--------------------------------------------------------

{
  const profile = newProfile();
  const run = newRun(profile, { runSeed: "seed-x", runId: "rd", roster: ROSTER });
  const offer = rewardOffer(run, profile, 1, 0);
  equal(offer.length, 3, "3候補");
  equal(offer.filter((o) => o.type === "equipment").length, 2, "装備2");
  equal(offer.filter((o) => o.type === "skill_points").length, 0, "技能点は自動付与");
  equal(offer.filter((o) => o.type === "supplies").length, 1, "補給1");
  check(!offer.some((o) => o.type === "activity_funds"), "**活動資金は報酬候補に入らない**");
  check(offer.filter((o) => o.type === "equipment").every((o) => o.generated && o.item),
    "装備候補はすべて遠征ごとの手続き生成品");
  for (const entry of offer.filter((o) => o.type === "equipment")) {
    check(!run.inventory.includes(entry.equipmentId), "既に持っている品は出ない");
  }
  // 同じ鍵なら同じ、引き直すと変わる（R6 §16 の鍵の分離）。
  assert.deepEqual(rewardOffer(run, profile, 1, 0), offer);
  checks += 1;
  const nextEncounterBefore = composeEncounter(2, 0);
  const rerolled = rewardOffer(run, profile, 1, 1);
  check(
    JSON.stringify(rerolled) !== JSON.stringify(offer) || rerolled.length < 3,
    "引き直すと候補が変わる",
  );
  // **報酬の引き直しは後続の敵を動かさない。**
  const nextEncounterAfter = composeEncounter(2, 0);
  assert.deepEqual(
    nextEncounterAfter,
    nextEncounterBefore,
    "報酬の引き直しは後続の敵編成を動かさない",
  );
  checks += 1;
  // 通常戦の勝利報酬は、現在の編成全員へ一律に入る。
  const granted = grantRunSkillPointsToAll(run);
  for (const id of ROSTER) equal(runSkillPoints(granted, id), 1, id + "が増える");
}

// ---- 旧 save の移行（R6 §17.2）---------------------------------------------

{
  const legacy = { skillPoints: { warden: 4, mender: 2, lancer: 0 }, ownedEquipment: ["standing_plate"] };
  const migrated = migrateLegacyProfile(legacy);
  equal(migrated.converted.toString(), "300", "技能点6点 → 活動資金 300");
  equal(migrated.profile.activityFunds, "300", "残高に入る");
  check(migrated.note !== null, "何をしたかを画面へ出す文がある");
  equal(migrated.profile.schemaVersion, PROFILE_SCHEMA_VERSION, "新しい版で作る");
  // 壊れた入力でも落とさない。
  equal(migrateLegacyProfile(null).profile.activityFunds, "0", "meta が無くても落ちない");
  equal(migrateLegacyProfile({ skillPoints: { warden: "abc" } }).profile.activityFunds, "0", "壊れた値は 0");
}

// 未知の upgrade id は読み込みで落とす（R7 §4.3）。
{
  const saved = { ...newProfile(), metaUpgradeLevels: { starting_supplies: 1, ghost_upgrade: 3 } };
  const loaded = normalizeProfile(saved);
  equal(loaded.metaUpgradeLevels.starting_supplies, 1, "知っている id は残る");
  check(!("ghost_upgrade" in loaded.metaUpgradeLevels), "知らない id は落とす");
}

// ---- 12戦が実際に走る -------------------------------------------------------
//
// **編成が組めるかではなく、12戦とも engine が受け取って決着するか。**
{
  const profile = newProfile();
  const loadout = freshLoadout(ROSTER);
  for (let index = 1; index <= 12; index += 1) {
    for (const rank of [0, 5]) {
      const composed = composeEncounter(index, rank);
      const battle = makeExpeditionBattle(composed, ROSTER, loadout, "s", FORMATION, {
        statsFor: (id) => characterStats(profile, id),
      });
      assert.deepEqual(validateBattleInput(battle, PLAYABLE_CONTENT), [],
        index + "戦目 rank " + rank + " の入力が通る");
      checks += 1;
      const result = simulateBattle(battle, PLAYABLE_CONTENT, { equipmentBreaks: false });
      check(["win", "loss", "draw"].includes(result.result), index + "戦目 rank " + rank + " が決着する");
      // 敵の変異が実際に stat へ載っていること。
      for (const enemy of composed.enemies) {
        if (!enemy.mutations.length && !enemy.boss) {
          assert.deepEqual(enemy.stats, enemy.baseStats);
          checks += 1;
        }
      }
    }
  }
}

console.log(`phase-b.test.mjs: ${checks} checks passed`);
