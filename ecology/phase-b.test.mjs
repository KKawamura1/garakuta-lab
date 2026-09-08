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
  skillLevelCap,
  // issue #168 — 前提（技能IDと必要Lv）の判定。
  prerequisitesMet,
  requiredSkillIds,
  unmetPrerequisites,
  // issue #148 — 説明文の数字を、いまのレベルの値で読む。
  skillLevelValueSteps,
  skillTextAtLevel,
  skillTextIssues,
  ACTIVE_META,
  REACTIVE_META,
  PASSIVE_META,
} from "./content/index.mjs";
import {
  CHARACTER_OPTIONS,
  SKILL_TREE_NODES,
  freshLoadout,
  // issue #168 — 加入時の無償閉包と、そこへ無償で付く Lv。
  initialSkillLevels,
  initialUnlockedSkills,
  makeExpeditionBattle,
  reorderSkill,
  simulateExpeditionBattle,
  simulateNextBattle,
  toggleSkill,
} from "./playable-battles.mjs";
import {
  ENCOUNTER_BASE_FUNDS,
  MAX_SUPPLIES,
  META_UPGRADES,
  SCRAP_PER_SUPPLY,
  SUPPLY_USES,
  availableDifficulties,
  characterStats,
  composeEncounter,
  convertScrap,
  dismantle,
  formatFunds,
  grantRunSkillPointsToAll,
  // issue #168 — 勝利ごとの技能点。量と冪等の鍵は progression の一箇所。
  grantRunSkillPointsForClear,
  skillPointsForClear,
  SKILL_POINTS_PER_CLEAR,
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
  startingSkillPoints,
  STARTING_RUN_SKILL_POINTS,
  STARTING_SKILL_POINTS_UPGRADE_ID,
  runSkillLevel,
  levelUpRunSkill,
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
equal(RUN_SCHEMA_VERSION, "ecology-run-3", "run の版");
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
  // パッシブ fallback は詰み防止なのでパックに属さず、常に取れる（R6 §6.8）。
  // **総数ではなく「7種が必ず含まれる」ことを見る**——R9 §4.1 で導入 pack が
  // それぞれパッシブを1つ持つようになったので、pack 由来のパッシブが上に乗る。
  for (const id of BASELINE_PASSIVE_SKILL_IDS) {
    check(ids.passive.includes(id), id + " はパッシブ fallback として常に取れる");
  }
  const packPassives = ids.passive.filter((id) => !BASELINE_PASSIVE_SKILL_IDS.includes(id));
  for (const id of packPassives) {
    check(manifest.enabledPackIds.includes(packOfSkill(id)),
      id + " は有効パック由来のパッシブ（外れたパックの常設は出ない）");
  }
  const excluded = SKILL_PACKS.find((pack) => !manifest.enabledPackIds.includes(pack.id));
  for (const id of excluded.activeSkillIds) {
    check(!ids.all.includes(id), id + " は外れたパックなので出ない");
  }
}

// ---- 技能点は遠征内（R6 §5.3）----------------------------------------------

{
  const profile = newProfile();
  const upgrade = META_UPGRADES.find((entry) => entry.id === STARTING_SKILL_POINTS_UPGRADE_ID);
  check(upgrade !== undefined, "初期SPアップが永続強化カタログにある");
  equal(startingSkillPoints(profile), STARTING_RUN_SKILL_POINTS, "未購入の開始SPは基礎値");
  if (upgrade) {
    equal(upgrade.maxLevel, upgrade.costs.length, "初期SPアップの段数と費用の数が一致する");
    let upgraded = { ...profile, activityFunds: "1000000" };
    for (let level = 0; level < upgrade.maxLevel; level += 1) {
      const purchased = purchaseUpgrade(upgraded, STARTING_SKILL_POINTS_UPGRADE_ID);
      equal(purchased.ok, true, "初期SPアップを購入できる");
      upgraded = purchased.profile;
    }
    equal(
      startingSkillPoints(upgraded),
      STARTING_RUN_SKILL_POINTS + upgrade.maxLevel,
      "購入済みの初期SPアップが新規遠征の開始SPへ反映される",
    );
    const upgradedRun = newRun(upgraded, { runSeed: "initial-sp", runId: "initial-sp", roster: ROSTER });
    equal(
      runSkillPoints(upgradedRun, "warden"),
      startingSkillPoints(upgraded),
      "newRun は初期SPアップ後の点数で開始する",
    );
    equal(upgradeCost(upgraded, STARTING_SKILL_POINTS_UPGRADE_ID), null, "初期SPアップは上限で買い切りになる");
    const restored = normalizeProfile(JSON.parse(JSON.stringify(upgraded)));
    equal(startingSkillPoints(restored), startingSkillPoints(upgraded), "保存・読込後も初期SPアップを維持する");
  }
}

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

// ---- 前提の必要Lvと、勝利ごとの技能点（issue #168 / #174 案b）---------------
//
// **静かに得をする方向を狙って書く。**同じ一戦から二度技能点が出る、前提 Lv を
// 見ないまま解禁できる、無償閉包に入った節が前提 Lv 不足のまま置かれる、の三つ。
{
  const profile = newProfile();
  let run = newRun(profile, { runSeed: "sp", runId: "sp", roster: ROSTER });

  // issue #176（#165 段階2）— **前提 Lv が実データで使われるようになった。**
  // #168 で書ける形にしただけだった `needsParentLv` を、Stage 0 の
  // 「傷へ盾を Lv3 → 長く守る」が実際に使っている。ここでは形の側だけを見る
  //（どの節がそれを使い、いつ取り切れるかは analysis/ecology-stage0-builds.mjs）。
  check(
    SKILL_TREE_NODES.some((node) => node.requires.some((required) => required.minLv > 1)),
    "親 Lv を要求する節が実データに存在する",
  );
  check(
    SKILL_TREE_NODES.every((node) => node.requires.every((required) => required.minLv >= 1)),
    "必要Lvは1以上（取得そのものを表す Lv1 が下限）",
  );
  check(
    SKILL_TREE_NODES.every((node) => node.requires.every((required) => {
      const parent = SKILL_TREE_NODES.find((entry) => entry.skillId === required.skillId);
      return parent && required.minLv <= parent.maxLv;
    })),
    "必要Lvはどれも前提技能の上限以内（永久に開かない節が無い）",
  );

  // 判定そのもの。取得していなければ 0、Lv が足りなければ不足として返る。
  const twoDeep = { skillId: "child", requires: [{ skillId: "parent", minLv: 3 }] };
  equal(prerequisitesMet(twoDeep, () => 0), false, "未取得の前提は満たさない");
  equal(prerequisitesMet(twoDeep, () => 2), false, "Lv2 では Lv3 の前提を満たさない");
  equal(prerequisitesMet(twoDeep, () => 3), true, "Lv3 まで上げれば満たす");
  equal(unmetPrerequisites(twoDeep, () => 1)[0].minLv, 3, "足りない前提は必要Lvごと返る");
  equal(requiredSkillIds(twoDeep)[0], "parent", "ID だけの取り出し口がある");

  // 解禁 API も同じ判定を通る。**Lv を要求する節を実データへ足さずに確かめる**
  // （足すとバランスが動く。ここで見たいのは判定の側だけ）。
  const strike = SKILL_TREE_NODES.find((node) => node.skillId === "strike");
  const levelled = { ...strike, skillId: "steady_cut", cost: 1, requires: [{ skillId: "strike", minLv: 3 }] };
  run = grantRunSkillPointsToAll(run, 5);
  run.runUnlockedSkills = { warden: ["strike"] };
  const denied = unlockRunSkill(run, "warden", levelled);
  equal(denied.ok, false, "前提 Lv が足りなければ解禁できない");
  equal(denied.reason, "前提技能のレベルが足りません。", "理由は「解禁されていない」と区別される");
  run.runSkillLevels = { warden: { strike: 3 } };
  const allowed = unlockRunSkill(run, "warden", levelled);
  equal(allowed.ok, true, "前提を Lv3 まで上げれば解禁できる");
}

{
  // 勝利ごとの技能点。**同じ encounter からは一度きり。**
  const profile = newProfile();
  let run = newRun(profile, { runSeed: "grant", runId: "grant", roster: ROSTER });
  equal(run.grantedSkillPointKeys.length, 0, "開始時は誰の勝利も数えていない");

  const first = grantRunSkillPointsForClear(run, 1);
  equal(first.granted, true, "1戦目の勝利で配る");
  equal(runSkillPoints(first.run, "warden"), skillPointsForClear(expeditionEncounter(1).kind), "配った量");
  const again = grantRunSkillPointsForClear(first.run, 1);
  equal(again.granted, false, "同じ encounter は二度配らない");
  equal(runSkillPoints(again.run, "warden"), runSkillPoints(first.run, "warden"), "retry で技能点は増えない");

  const second = grantRunSkillPointsForClear(again.run, 2);
  equal(second.granted, true, "次の encounter は配る");
  check(runSkillPoints(second.run, "warden") > runSkillPoints(first.run, "warden"), "別の一戦では増える");

  // 12戦を通した合計。**画面の説明と実際に配る量が同じ表から出る。**
  let full = newRun(profile, { runSeed: "full", runId: "full", roster: ROSTER });
  let expected = 0;
  for (let index = 1; index <= ENCOUNTERS_PER_RUN; index += 1) {
    full = grantRunSkillPointsForClear(full, index).run;
    expected += skillPointsForClear(expeditionEncounter(index).kind);
  }
  equal(runSkillPoints(full, "warden"), expected, "12戦ぶんの合計は表の総和と一致する");
  equal(SKILL_POINTS_PER_CLEAR.normal, 1, "通常戦は1点");
  equal(SKILL_POINTS_PER_CLEAR.elite, 1, "精鋭戦は通常戦と同じ1点");
  equal(SKILL_POINTS_PER_CLEAR.boss, 2, "boss戦は2点");
  const encounterCounts = Object.fromEntries(
    Object.keys(SKILL_POINTS_PER_CLEAR).map((kind) => [
      kind,
      EXPEDITION_ENCOUNTERS.filter((encounter) => encounter.kind === kind).length,
    ]),
  );
  const tableExpected = Object.entries(encounterCounts)
    .reduce((total, [kind, count]) => total + count * skillPointsForClear(kind), 0);
  equal(expected, tableExpected, "12戦ぶんの合計が種別ごとの表の総和と一致する");
  equal(expected, 15, "案bの12戦合計は15点");
}

{
  // 加入時の無償閉包（issue #168）。**閉包に入れた節が、閉包の中だけで前提を満たす。**
  // 前提が Lv を要求するようになったので、「節は配ったが Lv は Lv1 のまま」だと
  // 加入直後から前提 Lv 不足で子が取れない形が生まれる。無償で付く Lv も一緒に見る。
  for (const option of CHARACTER_OPTIONS) {
    const unlocked = new Set(initialUnlockedSkills(option.id));
    const levels = initialSkillLevels(option.id);
    const levelOf = (skillId) => (unlocked.has(skillId) ? (levels[skillId] ?? 1) : 0);
    for (const skillId of unlocked) {
      const node = SKILL_TREE_NODES.find((entry) => entry.skillId === skillId);
      check(
        node !== undefined && prerequisitesMet(node, levelOf),
        option.id + " の無償閉包は " + skillId + " の前提を Lv まで満たしている",
      );
    }
    // 無償で付く Lv は、閉包が実際に要求するぶんだけ。**ついでに強くしない。**
    for (const [skillId, level] of Object.entries(levels)) {
      const needed = SKILL_TREE_NODES
        .filter((entry) => unlocked.has(entry.skillId))
        .flatMap((entry) => entry.requires)
        .filter((required) => required.skillId === skillId)
        .reduce((max, required) => Math.max(max, required.minLv), 1);
      equal(level, needed, option.id + " の " + skillId + " へ無償で付く Lv は要求ぶんだけ");
    }
  }
}

// ---- 技能の装着・順番・一時停止（R18）---------------------------------------

{
  const profile = newProfile();
  assert.deepEqual(slotLimits(profile, "warden"), {
    active: Number.MAX_SAFE_INTEGER,
    reactive: Number.MAX_SAFE_INTEGER,
    passive: Number.MAX_SAFE_INTEGER,
    equipment: 2,
  });
  checks += 1;
  equal(LIMITS.maxTactics, Number.MAX_SAFE_INTEGER, "アクティブ技能は人数制限なし");
  equal(LIMITS.maxReactiveSkills, Number.MAX_SAFE_INTEGER, "リアクティブ技能は人数制限なし");
  equal(LIMITS.maxPassiveSkills, Number.MAX_SAFE_INTEGER, "パッシブ技能は人数制限なし");

  equal(upgradeCost(profile, slotUpgradeId("active", "warden")), null, "旧第4枠投資は新規購入できない");
  check(!purchaseUpgrade(
    { ...profile, activityFunds: "100000" }, slotUpgradeId("active", "warden"),
  ).ok, "旧第4枠投資の購入導線が閉じている");
}

// 取得済み技能を何本でも装着でき、オフにした技能だけが BattleInput から外れる。
{
  const loadout = freshLoadout(ROSTER);
  const active = Object.keys(PLAYABLE_CONTENT.activeSkills).slice(0, 6);
  const reactive = Object.keys(PLAYABLE_CONTENT.reactiveSkills).slice(0, 6);
  const passive = Object.keys(PLAYABLE_CONTENT.passiveSkills).slice(0, 3);
  loadout.tactics.warden = active;
  loadout.reactives.warden = reactive;
  loadout.passives.warden = passive;
  const battle = makeExpeditionBattle(composeEncounter(1, 0), ROSTER, loadout, "s", FORMATION, {});
  const warden = battle.allies.find((ally) => ally.characterId === "warden");
  equal(warden.tactics.length, active.length, "上限なしのアクティブ技能が戦闘へ届く");
  equal(warden.reactiveSkillIds.length, reactive.length, "上限なしのリアクティブ技能が戦闘へ届く");
  equal(warden.passiveSkillIds.length, passive.length, "上限なしのパッシブ技能が戦闘へ届く");
  assert.deepEqual(validateBattleInput(battle, PLAYABLE_CONTENT), []);
  checks += 1;

  const reversedActive = reorderSkill(loadout, "warden", "active", 0, 1);
  equal(reversedActive.tactics.warden[0], active[1], "行動の上から順を入れ替えられる");
  const reversedReactive = reorderSkill(loadout, "warden", "reactive", 0, 1);
  equal(reversedReactive.reactives.warden[0], reactive[1], "反応の上から順を入れ替えられる");

  const off = toggleSkill(loadout, "warden", active[0]);
  equal(off.ok, true, "装着済み技能をオフにできる");
  equal(off.enabled, false, "オフ状態が返る");
  equal(off.loadout.disabled.warden[0], active[0], "オフ状態を保存する");
  const offBattle = makeExpeditionBattle(composeEncounter(1, 0), ROSTER, off.loadout, "s", FORMATION, {});
  equal(offBattle.allies.find((ally) => ally.characterId === "warden").tactics.length, active.length - 1,
    "オフにした行動の効果だけ戦闘から外れる");
  const on = toggleSkill(off.loadout, "warden", active[0]);
  equal(on.enabled, true, "同じトグルで再びオンにできる");
  check(!on.loadout.disabled, "オンに戻すと不要なオフ欄を残さない");
}

// ---- R19（issue #137）技能レベルが、取得・技能点・予測の一本道を通る ------------
//
// **上位互換を別技能として増やさない**代わりに、一つの技能を段階的に上げる。
// 取得＝Lv1、そこから 1点ずつ。払い戻しは解禁と同じで無い。
{
  const profile = newProfile();
  const base = newRun(profile, { seed: "frontier-1801", roster: ROSTER });
  base.loadout = freshLoadout(ROSTER);
  base.formation = { ...FORMATION };
  base.runUnlockedSkills = { warden: ["steady_cut"] };
  base.runSkillPoints = { ...base.runSkillPoints, warden: 3 };

  equal(runSkillLevel(base, "warden", "steady_cut"), 1, "取得した技能は Lv1 から始まる");
  equal(runSkillLevel(base, "warden", "execute_low"), 0, "未取得の技能はレベルを持たない");

  // 連続する量を持たない技能は上げられない。**払わせておいて何も返さない、を作らない。**
  equal(skillLevelCap("relay_order" in PLAYABLE_CONTENT.activeSkills
    ? PLAYABLE_CONTENT.activeSkills.relay_order : {}), 1, "号令のような技能はレベルを持たない");
  const refused = levelUpRunSkill(base, "warden", "steady_cut", 1);
  equal(refused.ok, false, "上限が Lv1 の技能は上げられない");

  const before = runSkillPoints(base, "warden");
  const up = levelUpRunSkill(base, "warden", "steady_cut", 10);
  equal(up.ok, true, "取得済みの技能を1段上げられる");
  equal(up.level, 2, "1段だけ上がる");
  equal(runSkillPoints(up.run, "warden"), before - 1, "1段につき技能点を1点払う");
  check(runSkillPoints(base, "warden") === before, "元の run を書き換えない");

  const capped = { ...base, runSkillLevels: { warden: { steady_cut: 10 } } };
  equal(levelUpRunSkill(capped, "warden", "steady_cut", 10).ok, false, "最大レベルからは上げられない");
  const broke = { ...base, runSkillPoints: { ...base.runSkillPoints, warden: 0 } };
  equal(levelUpRunSkill(broke, "warden", "steady_cut", 10).ok, false, "技能点が無ければ上げられない");

  // **予測と本番は同じ経路**なので、レベルは exact preview にもそのまま乗る。
  const lifted = { ...base, runSkillLevels: { warden: { steady_cut: 7 } } };
  const plain = simulateNextBattle(base, profile, 1);
  const strong = simulateNextBattle(lifted, profile, 1);
  const production = simulateExpeditionBattle(lifted, profile, 1, {
    composed: strong.composed,
    hp: lifted.currentHp,
    simulationOptions: { captureReplaySnapshots: true },
  });
  assert.deepEqual(production.battleInput, strong.battleInput, "予測と本番の BattleInput が一致する");
  assert.deepEqual(production.result.events, strong.result.events, "予測と本番のイベント列が一致する");
  checks += 2;
  const wardenInput = strong.battleInput.allies.find((ally) => ally.characterId === "warden");
  assert.deepEqual(wardenInput.skillLevels, { steady_cut: 7 }, "レベルが戦闘入力へ届く");
  check(
    !plain.battleInput.allies.find((ally) => ally.characterId === "warden").skillLevels,
    "Lv1 だけの編成は skillLevels の欄そのものを持たない",
  );
  assert.deepEqual(validateBattleInput(strong.battleInput, PLAYABLE_CONTENT), []);
  const firstDamage = (outcome) => outcome.result.events
    .filter((event) => event.type === "damage_proposed" && event.sourceActorId === "a_warden")
    .map((event) => event.values.amount)[0];
  check(
    firstDamage(strong) > firstDamage(plain),
    `Lv7 の予測が Lv1 より重い（${firstDamage(plain)} → ${firstDamage(strong)}）`,
  );
  checks += 1;
}

// ---- 変動量と固定量（issue #148）--------------------------------------------------
//
// **技能が持つ数のうち、レベルで伸びるのは一つだけ。**説明文はその数を書かず、
// `{amount}` と書いて定義を指す。だから「係数を変えたのに説明文が旧値のまま」も
// 「伸びない数（発動条件・後列減衰）まで一緒に伸ばす」も、起こしようがない。
{
  const definitionOf = (id) => PLAYABLE_CONTENT.activeSkills[id]
    ?? PLAYABLE_CONTENT.reactiveSkills[id] ?? PLAYABLE_CONTENT.passiveSkills[id];
  const metaOf = (id) => ACTIVE_META[id] ?? REACTIVE_META[id] ?? PASSIVE_META[id];
  const textOf = (id, level) => skillTextAtLevel(metaOf(id)[1], definitionOf(id), level);

  // 変動量は定義側にただ一つ。**本文には数字が無い。**
  check(
    ACTIVE_META.steady_cut[1].includes("{amount}") && !/130/.test(ACTIVE_META.steady_cut[1]),
    `説明文は変動量を数字で持たない（${ACTIVE_META.steady_cut[1]}）`,
  );
  equal(
    textOf("steady_cut", 1),
    "条件も準備もない、腕力130%の一撃。武器なので後列から出すと40%まで落ちる。",
    "Lv1 は定義の係数がそのまま入る",
  );
  equal(
    textOf("steady_cut", 2),
    "条件も準備もない、腕力146%の一撃。武器なので後列から出すと40%まで落ちる。",
    "Lv2 で変動量だけが 130% → 146% になり、後列減衰の 40% は動かない",
  );
  check(textOf("execute_low", 3).includes("HP30%以下"), "発動条件の閾値は固定量なので動かない");

  // 多段は「1段ぶんを丸めてから段数を掛ける」。段数も定義から引くので食い違わない。
  const barrage = textOf("barrage_strike", 2);
  check(
    barrage.includes("50%を3回") && barrage.includes("合計150%"),
    `多段の1段ぶん・段数・合計が食い違わない（${barrage}）`,
  );

  // 単位は定義の amount 型が決める。**本文は % を書かない。**
  check(textOf("absorb_shock", 2).includes("13減らす"), "固定量の amount は % を付けずに入る");
  check(textOf("emergency_treatment", 2).includes("37%"), "被弾量に対する割合も同じ差し込み口で入る");

  // 「1点で何がどうなるか」も、同じ変動量から出す。
  assert.deepEqual(
    skillLevelValueSteps(ACTIVE_META.steady_cut[1], definitionOf("steady_cut"), 1),
    [{ from: "130%", to: "146%" }],
    "1点ぶんの変化を数字で出せる",
  );
  checks += 1;

  // **全技能ぶんの不変条件。**差し込み口がそのまま画面へ出る／レベルで伸びる量が
  // 本文のどこにも出ない／伸びる量を数字で直接書いた、のどれも通さない。
  const broken = [];
  for (const [section, meta] of [
    ["activeSkills", ACTIVE_META], ["reactiveSkills", REACTIVE_META], ["passiveSkills", PASSIVE_META],
  ]) {
    for (const [id, definition] of Object.entries(PLAYABLE_CONTENT[section] ?? {})) {
      if (!meta[id]) continue;
      const issues = skillTextIssues(String(meta[id][1]), definition);
      if (issues.length) broken.push(id + ": " + issues.join(" / "));
      // 差し込み口が残ったまま画面に出ることは無い。
      if (/\{(amount|total|hits)\}/.test(skillTextAtLevel(meta[id][1], definition, 3))) {
        broken.push(id + ": 差し込み口が埋まらないまま表示される");
      }
    }
  }
  assert.deepEqual(broken, [], "説明文と定義の対応が壊れている技能:\n  " + broken.join("\n  "));
  checks += 1;

  // レベルを持つ技能は、必ず本文が動く。**点を払って何も変わらない技能を作らない。**
  const inert = [];
  for (const [section, meta] of [
    ["activeSkills", ACTIVE_META], ["reactiveSkills", REACTIVE_META], ["passiveSkills", PASSIVE_META],
  ]) {
    for (const [id, definition] of Object.entries(PLAYABLE_CONTENT[section] ?? {})) {
      if (!meta[id] || skillLevelCap(definition) <= 1) continue;
      if (skillTextAtLevel(meta[id][1], definition, 2) === skillTextAtLevel(meta[id][1], definition, 1)) {
        inert.push(id);
      }
    }
  }
  assert.deepEqual(inert, [], "Lv を上げても説明文が動かない技能: " + inert.join(", "));
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

  // **鍛錬は行動回数を上げない。**AP / RP は base のまま。
  const definition = PLAYABLE_CONTENT.characters.warden;
  for (const axis of TRAINABLE_STATS) check(["might", "focus", "guard", "vitality"].includes(axis), axis);
  const battle = makeExpeditionBattle(composeEncounter(1, 0), ROSTER, freshLoadout(ROSTER), "s", FORMATION, {
    statsFor: (id) => characterStats(profile, id),
  });
  const warden = battle.allies.find((ally) => ally.characterId === "warden");
  equal(warden.stats.might, stats.stats.might, "鍛錬後の腕力が BattleInput に載る");
  equal(warden.training.might, 50, "鍛錬 level も載る（R6 §9.5 の因果 log 要件）");
  check(!("speed" in warden.stats), "削除済みの速度は上書きできない");
  check(!("baseActionPoints" in warden.stats), "AP は上書きできない");
  assert.deepEqual(validateBattleInput(battle, PLAYABLE_CONTENT), []);
  checks += 1;
  const result = simulateBattle(battle, PLAYABLE_CONTENT, { equipmentBreaks: false });
  const actor = result.actors.find((a) => a.definitionId === "warden");
  equal(actor.might, stats.stats.might, "engine が鍛錬後の値で戦う");
  equal(actor.baseStats.might, definition.might, "結果 log に base が残る");
  check(!("speed" in actor), "結果に速度を含めない");
}

// validator は削除済み／鍛錬できない stat の上書きを拒否する。
{
  const battle = makeExpeditionBattle(composeEncounter(1, 0), ROSTER, freshLoadout(ROSTER), "s", FORMATION, {});
  battle.allies[0].stats = { speed: 99 };
  const errors = validateBattleInput(battle, PLAYABLE_CONTENT);
  check(errors.some((error) => error.code === "unknown_stat"), "削除済みの速度上書きは拒否される");
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
