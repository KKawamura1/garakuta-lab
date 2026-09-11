// ecology/ultimate.test.mjs — 必殺技（issue #238）
//
// **見るのは有限性と一貫性であって、強さではない。**
//
//   - 変換規則が「何も変わらない技能」を必殺にしない（画面の印が嘘にならない）。
//   - 1戦闘に1回。同じ戦闘で二度は出ない。
//   - 回数は人物ごとに一遠征1回。構えただけでは減らず、**放ったときだけ**減る。
//   - 負けた一戦では減らない（retry で二重に取られない）。
//   - Stage 0 では出ない（導入の回に必殺技まで載せない）。
//   - 隊の誰かが削られるまで出ない（1ラウンド目にいきなり出ない）。
//   - 予測と本番が同じ結果を返す（構えても preview の契約は変わらない）。
//   - AP・RP・行動回数は増えない（手数を増やす必殺を作らない）。
//   - engine と schema の語彙を増やしていない。

import assert from "node:assert/strict";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import { validateBattleInput } from "./validate.mjs";
import {
  ULTIMATE_AMOUNT_MULTIPLIER,
  ULTIMATE_MIN_STAGE_SEQUENCE,
  ULTIMATE_READY_HP_PERCENT,
  ULTIMATE_SPENT_STATUS_ID,
  ULTIMATE_USES_PER_CHARACTER,
  ascendSkill,
  baseSkillIdOf,
  isUltimateId,
  ultimateFirings,
  ultimateIdFor,
  ultimateTraitLabels,
  withUltimates,
} from "./ultimates.mjs";
import {
  armedUltimates,
  commitBattleResult,
  designatedUltimate,
  newProfile,
  newRun,
  runContentBundle,
  ultimateUsesLeft,
  ultimateUsesLeftInParty,
  ultimatesFiredBy,
  ultimatesUnlocked,
} from "./progression.mjs";
import {
  freshLoadout,
  previewNextBattle,
  setUltimate,
  simulateExpeditionBattle,
  toggleUltimateArmed,
  ultimateCandidates,
} from "./playable-battles.mjs";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

const ACTIVE_IDS = Object.keys(PLAYABLE_CONTENT.activeSkills);
const REACTIVE_IDS = Object.keys(PLAYABLE_CONTENT.reactiveSkills);
const ALL_SKILL_IDS = [...ACTIVE_IDS, ...REACTIVE_IDS];

// ---------------------------------------------------------------- 変換規則

{
  const ascendable = ALL_SKILL_IDS.filter((id) => ascendSkill(PLAYABLE_CONTENT, id));
  ok(ascendable.length > 0, "必殺技にできる技能がある");
  ok(
    ascendable.length < ALL_SKILL_IDS.length,
    "必殺技にできない技能も残っている（量も状態も動かさない技能）",
  );

  for (const skillId of ascendable) {
    const ascended = ascendSkill(PLAYABLE_CONTENT, skillId);
    const definition = ascended.definition;
    equal(definition.id, ultimateIdFor(skillId), skillId + " の必殺は元の ID から導ける");
    equal(baseSkillIdOf(definition.id), skillId, skillId + " の必殺から元の技能へ戻れる");
    ok(isUltimateId(definition.id), skillId + " の必殺は必殺として読める");
    ok(
      ultimateTraitLabels(ascended.traits).length > 0,
      skillId + " の必殺には、画面へ出せる変換の印が最低一つある",
    );

    // **手数は増やさない。**AP / RP / hit 数 / 耐久は元のまま。
    if (ascended.kind === "active") {
      equal(
        definition.apCost, PLAYABLE_CONTENT.activeSkills[skillId].apCost,
        skillId + " の必殺は行動点を変えない",
      );
      ok(definition.preparation === undefined, skillId + " の必殺は溜めを持たない");
      ok(
        definition.intrinsicPredicates.some((predicate) => (
          predicate.type === "has_status" && predicate.statusId === ULTIMATE_SPENT_STATUS_ID
        )),
        skillId + " の必殺は「まだ放っていないこと」を発動条件に持つ",
      );
      ok(
        definition.intrinsicPredicates.some((predicate) => (
          predicate.type === "target_exists"
            && predicate.query?.filters?.some((filter) => (
              filter.type === "hp_percent" && filter.value === ULTIMATE_READY_HP_PERCENT
            ))
        )),
        skillId + " の必殺は「隊の誰かが削られていること」を発動条件に持つ",
      );
      ok(
        definition.effects.some((effect) => (
          effect.type === "add_status" && effect.statusId === ULTIMATE_SPENT_STATUS_ID
        )),
        skillId + " の必殺は放った印を自分へ付ける",
      );
      ok(
        definition.effects.some((effect) => (
          effect.type === "add_status" && effect.statusId === "exposed"
            && effect.target?.scope === "self"
        )),
        skillId + " の必殺は代償に自分へ「隙」を付ける",
      );
    } else {
      const base = PLAYABLE_CONTENT.reactiveSkills[skillId].rule;
      // **反応点は払わない。**一戦に一度きりの一手が、点の取り合いで消えないようにする。
      ok(
        !definition.rule.costs.some((cost) => cost.type === "spend_reaction_points"),
        skillId + " の必殺は反応点を払わない",
      );
      assert.deepEqual(
        definition.rule.costs,
        (base.costs ?? []).filter((cost) => cost.type !== "spend_reaction_points"),
        skillId + " の必殺が外すのは反応点だけ（他の代償は残る）",
      );
      checks += 1;
      ok(
        definition.rule.predicates.some((predicate) => (
          predicate.type === "target_exists"
            && predicate.query?.filters?.some((filter) => (
              filter.type === "hp_percent" && filter.value === ULTIMATE_READY_HP_PERCENT
            ))
        )),
        skillId + " の必殺は「隊の誰かが削られていること」を発動条件に持つ",
      );
      equal(definition.rule.limit.scope, "battle", skillId + " の必殺は戦闘に1回");
      equal(definition.rule.limit.count, 1, skillId + " の必殺は戦闘に1回");
      ok(definition.rule.id !== base.id, skillId + " の必殺は元の rule と発火回数を共有しない");
    }
  }

  // 量も状態も動かさない技能は候補に出さない。**「必殺にしたのに何も変わらない」を作らない。**
  equal(ascendSkill(PLAYABLE_CONTENT, "relay_order"), null, "行動権を渡すだけの技能は必殺にできない");
  equal(ascendSkill(PLAYABLE_CONTENT, "reposition"), null, "位置を替えるだけの技能は必殺にできない");
  equal(ascendSkill(PLAYABLE_CONTENT, "ult_steady_cut"), null, "必殺をさらに必殺にはできない");
}

// 単体は全体へ、量は倍に。**規則そのものを一つずつ確かめる。**
{
  const base = PLAYABLE_CONTENT.activeSkills.steady_cut;
  const ascended = ascendSkill(PLAYABLE_CONTENT, "steady_cut");
  const baseDamage = base.effects.find((effect) => effect.type === "deal_damage");
  const ultDamage = ascended.definition.effects.find((effect) => effect.type === "deal_damage");
  equal(ultDamage.target.take, "all", "単体が全体になる");
  equal(ascended.definition.targetQuery.take, "all", "宣言する狙い先も一緒に広がる");
  equal(
    (ultDamage.amount.numerator ?? 1),
    (baseDamage.amount.numerator ?? 1) * ULTIMATE_AMOUNT_MULTIPLIER,
    "全体へ広がっても量は倍になる（広さと太さは両立する）",
  );
  equal(
    ultDamage.amount.coefficientBps, baseDamage.amount.coefficientBps,
    "係数そのものは動かさない（分子だけを倍にするので整数のまま）",
  );

  // 広がらない効果も同じ倍率で太くなる。
  const counter = ascendSkill(PLAYABLE_CONTENT, "counter_blow");
  const baseCounter = PLAYABLE_CONTENT.reactiveSkills.counter_blow.rule.effects
    .find((effect) => effect.type === "deal_damage");
  const ultCounter = counter.definition.rule.effects.find((effect) => effect.type === "deal_damage");
  equal(
    (ultCounter.amount.numerator ?? 1),
    (baseCounter.amount.numerator ?? 1) * ULTIMATE_AMOUNT_MULTIPLIER,
    "広がれない効果の量も倍になる",
  );
  ok(counter.traits.amplified && !counter.traits.widened, "反撃は太くなるだけで広がらない");

  // **防壁は戦闘のあいだ残る。**守りの必殺が「そのラウンドだけ厚い」で終わらない。
  const bulwark = ascendSkill(PLAYABLE_CONTENT, "bulwark");
  const baseBarrier = PLAYABLE_CONTENT.activeSkills.bulwark.effects
    .find((effect) => effect.type === "gain_barrier");
  const ultBarrier = bulwark.definition.effects.find((effect) => effect.type === "gain_barrier");
  equal(baseBarrier.duration, "round", "元の防壁はラウンドで消える");
  equal(ultBarrier.duration, "battle", "必殺の防壁は戦闘のあいだ残る");
  ok(bulwark.traits.lasting, "その変換が画面の印として記録される");
  equal(ultBarrier.target.scope, "allies", "自分だけを守る技能は味方全員へ広がる");

  const prepared = ascendSkill(PLAYABLE_CONTENT, "heavy_swing");
  ok(PLAYABLE_CONTENT.activeSkills.heavy_swing.preparation, "元の技能は溜めを持っている");
  ok(prepared.traits.instant, "溜めのある技能の必殺は「溜め不要」の印を持つ");
  ok(
    prepared.definition.effects.some((effect) => effect.type === "deal_damage"),
    "溜めの完了効果が、その場の効果へ移っている",
  );
}

// 生成した定義は、engine が読む前に validator を通る。
{
  const bundle = withUltimates(PLAYABLE_CONTENT, ALL_SKILL_IDS);
  assert.deepEqual(validateContentBundle(bundle), [], "必殺を混ぜた content bundle は妥当である");
  checks += 1;
  ok(
    Object.keys(bundle.activeSkills).length > ACTIVE_IDS.length,
    "必殺の定義は bundle へ足される（固定 content は増えない）",
  );
  equal(
    Object.keys(PLAYABLE_CONTENT.activeSkills).length, ACTIVE_IDS.length,
    "固定 content そのものは書き換えられていない",
  );
}

// ---------------------------------------------------------------- 遠征のなかで

// **必殺が本当に出る一戦。**序盤の数戦は隊が削られないので、必殺の条件が揃わない
// （それ自体は仕様である。要らなかった一戦では回数も減らない）。
const FIGHT_INDEX = 6;

function armedRun(designations, options = {}) {
  const profile = newProfile();
  const run = newRun(profile, { runSeed: "ultimate-test", campaignStageSequence: 3, ...options });
  run.loadout = freshLoadout(run.roster);
  run.loadout.ultimates = { ...designations };
  run.loadout.ultimateArmed = Object.fromEntries(
    Object.keys(designations).map((characterId) => [characterId, true]),
  );
  return { profile, run };
}

{
  const { profile, run } = armedRun({ warden: "steady_cut" });
  equal(
    ultimateUsesLeft(run, "warden"), ULTIMATE_USES_PER_CHARACTER,
    "遠征の頭では、誰もまだ放っていない",
  );
  equal(
    ultimateUsesLeftInParty(run), run.roster.length,
    "隊の残り回数は人数ぶん（隊で分け合う枠ではない）",
  );
  equal(designatedUltimate(run, "warden"), "steady_cut", "指定した技能が読める");
  equal(designatedUltimate(run, "mender"), null, "指定していない仲間は必殺を持たない");

  const bundle = runContentBundle(run);
  ok(bundle.activeSkills.ult_steady_cut, "構えた必殺の定義が遠征の bundle に入る");
  ok(!bundle.activeSkills.ult_aimed_shot, "構えていない必殺の定義は入らない");

  // **第1戦では出ない。**隊が無傷のまま終わる一戦には、必殺の出番そのものが無い。
  const easy = previewNextBattle(run, profile, 1);
  assert.deepEqual(easy.ultimateFiredBy, [], "無傷で終わる一戦では必殺が出ない");
  checks += 1;

  const { battleInput, result } = simulateExpeditionBattle(run, profile, FIGHT_INDEX);
  assert.deepEqual(
    validateBattleInput(battleInput, bundle), [],
    "必殺を持ち込んだ battle input は妥当である",
  );
  checks += 1;
  const warden = battleInput.allies.find((ally) => ally.characterId === "warden");
  assert.deepEqual(
    warden.tactics.map((tactic) => tactic.activeSkillId), ["ult_steady_cut", "steady_cut"],
    "必殺は元の技能の一つ前に入る（同じ条件で、同じ場面に出る）",
  );
  checks += 1;

  const fired = ultimateFirings(result);
  assert.deepEqual(fired, ["a_warden"], "構えた本人だけが放つ");
  checks += 1;

  const starts = result.events.filter((event) => (
    event.type === "action_started" && event.skillId === "ult_steady_cut"
  ));
  equal(starts.length, 1, "同じ戦闘で二度は出ない");
  ok(starts[0].targetActorIds.length >= 2, "全体化した必殺は複数の相手を宣言して狙う");

  const spent = ultimatesFiredBy(run, result);
  assert.deepEqual(spent, ["warden"], "回数を使ったのは放った本人");
  checks += 1;

  const committed = commitBattleResult(profile, run, FIGHT_INDEX, result);
  equal(ultimateUsesLeft(committed.run, "warden"), 0, "勝つと放った本人の回数が尽きる");
  equal(
    ultimateUsesLeft(committed.run, "mender"), ULTIMATE_USES_PER_CHARACTER,
    "他の仲間の回数は減らない（隊で分け合う枠ではない）",
  );
  equal(
    committed.run.loadout.ultimateArmed.warden, undefined,
    "放った者の構えは解ける（次の一戦へ黙って持ち越さない）",
  );
  assert.deepEqual(committed.snapshot.ultimateFiredBy, ["warden"], "放った者が snapshot に残る");
  checks += 1;

  // 使い切った人物は、構え直しても持ち込めない。
  const rearmed = {
    ...committed.run,
    loadout: { ...committed.run.loadout, ultimateArmed: { warden: true } },
  };
  assert.deepEqual(armedUltimates(rearmed), [], "放ち終えた仲間は二度と構えられない");
  checks += 1;
  const refused = toggleUltimateArmed(committed.run.loadout, "warden", undefined, { uses: 0 });
  equal(refused.ok, false, "回数を使い切った仲間の構えは断る");
}

// 構えても出なければ回数を使わない。**予測がそれを先に見せている。**
{
  const { profile, run } = armedRun({ mender: "triage" });
  const preview = previewNextBattle(run, profile, 1);
  assert.deepEqual(preview.ultimateFiredBy, [], "予測が「この一戦では出ない」と言っている");
  checks += 1;
  const { result } = simulateExpeditionBattle(run, profile, 1);
  equal(ultimateFirings(result).length, 0, "予測どおり出ない");
  const committed = commitBattleResult(profile, run, 1, result);
  equal(
    ultimateUsesLeft(committed.run, "mender"), ULTIMATE_USES_PER_CHARACTER,
    "条件が揃わず出なかった必殺は、回数を使わない",
  );
}

// 予測が「出る」と言った一戦では、本当に出る。**構える前に読める。**
{
  const { profile, run } = armedRun({ warden: "steady_cut" });
  const preview = previewNextBattle(run, profile, FIGHT_INDEX);
  assert.deepEqual(preview.ultimateFiredBy, ["warden"], "予測が誰の必殺が出るかを言う");
  checks += 1;
  const { result } = simulateExpeditionBattle(run, profile, FIGHT_INDEX);
  assert.deepEqual(
    ultimatesFiredBy(run, result), preview.ultimateFiredBy,
    "本番で出た顔ぶれが予測と一致する",
  );
  checks += 1;
}

// 負けた一戦では減らない。**retry で二重に取られない。**
{
  const { profile, run } = armedRun({ mender: "triage" });
  const { result } = simulateExpeditionBattle(run, profile, 12);
  equal(result.result, "loss", "満足に育てていない隊は第12戦で負ける（この検査の前提）");
  ok(ultimateFirings(result).length > 0, "負けた戦闘でも必殺そのものは出ている");
  const committed = commitBattleResult(profile, run, 12, result);
  equal(
    ultimateUsesLeft(committed.run, "mender"), ULTIMATE_USES_PER_CHARACTER,
    "負けた一戦は無かったことになる（回数も戻る）",
  );
  assert.deepEqual(committed.snapshot.ultimateFiredBy, [], "負けた一戦は回数を使っていない");
  checks += 1;
}

// **枠は人物ごと。**全員が同じ一戦で構えてよく、使い切った人物だけが外れる。
{
  const { run } = armedRun({
    warden: "steady_cut",
    mender: "aimed_shot",
    lancer: "heavy_swing",
    guardian: "column_thrust",
    tactician: "mark_target",
  });
  equal(
    armedUltimates(run).length, run.roster.length,
    "5人が指定して構えれば、5人ぶんが同じ一戦へ入る（隊で分け合う枠ではない）",
  );
  assert.deepEqual(
    armedUltimates(run).map((entry) => entry.characterId), run.roster,
    "順は隊の順で決まる（予測と本番で同じ組になる）",
  );
  checks += 1;

  const halfUsed = { ...run, ultimatesUsed: ["warden", "lancer"] };
  assert.deepEqual(
    armedUltimates(halfUsed).map((entry) => entry.characterId),
    run.roster.filter((id) => id !== "warden" && id !== "lancer"),
    "放ち終えた仲間だけが外れる",
  );
  checks += 1;
  equal(ultimateUsesLeftInParty(halfUsed), run.roster.length - 2, "隊の残り回数がそのぶん減る");

  const spent = { ...run, ultimatesUsed: [...run.roster] };
  assert.deepEqual(armedUltimates(spent), [], "全員が放ち終えたら誰も構えられない");
  checks += 1;

  const disarmed = toggleUltimateArmed(run.loadout, "guardian", undefined, { uses: 0 });
  equal(disarmed.armed, false, "構えを解くのは回数が無くてもできる");
  const attempt = toggleUltimateArmed(disarmed.loadout, "guardian", undefined, { uses: 0 });
  equal(attempt.ok, false, "回数が無いのに構えようとしたら断る");
}

// Stage 0（2人の導入）では必殺技そのものが開いていない。
{
  const profile = newProfile();
  const stage0 = newRun(profile, { runSeed: "ultimate-test", campaignStageSequence: 0 });
  stage0.loadout = freshLoadout(stage0.roster);
  stage0.loadout.ultimates = { warden: "steady_cut" };
  stage0.loadout.ultimateArmed = { warden: true };
  equal(ultimatesUnlocked(stage0), false, "Stage 0 では必殺技が開いていない");
  equal(designatedUltimate(stage0, "warden"), null, "Stage 0 では指定が効かない");
  assert.deepEqual(armedUltimates(stage0), [], "Stage 0 では誰も構えられない");
  checks += 1;
  equal(ultimateUsesLeft(stage0, "warden"), 0, "Stage 0 では回数を持たない");
  equal(ultimateUsesLeftInParty(stage0), 0, "Stage 0 では隊の残りも 0");

  const bundle = runContentBundle(stage0);
  ok(!bundle.activeSkills.ult_steady_cut, "Stage 0 の bundle に必殺の定義は入らない");

  const stage1 = newRun(profile, { runSeed: "ultimate-test", campaignStageSequence: ULTIMATE_MIN_STAGE_SEQUENCE });
  equal(ultimatesUnlocked(stage1), true, "解禁 Stage から開く");
}

// **隊の誰かが削られるまで出ない。**1ラウンド目にいきなり必殺は出ない。
{
  const { profile, run } = armedRun({ warden: "steady_cut" });
  const healthy = simulateExpeditionBattle(run, profile, FIGHT_INDEX);
  const firstRoundUltimate = healthy.result.events.find((event) => (
    event.type === "action_started" && String(event.skillId ?? "").startsWith("ult_")
      && Number(event.round) === 1
  ));
  const hurtInRoundOne = healthy.result.events.some((event) => (
    event.type === "damage_taken" && String(event.targetActorIds?.[0] ?? "").startsWith("a_")
      && Number(event.round) === 1
  ));
  ok(
    !firstRoundUltimate || hurtInRoundOne,
    "1ラウンド目に必殺が出るのは、その前に隊が削られたときだけ",
  );
}

// 装着していない技能の指定は効かない。
{
  const { run } = armedRun({ warden: "steady_cut" });
  const stripped = {
    ...run,
    loadout: { ...run.loadout, tactics: { ...run.loadout.tactics, warden: [] } },
  };
  equal(designatedUltimate(stripped, "warden"), null, "外した技能の指定は効かない");
  assert.deepEqual(armedUltimates(stripped), [], "効かない指定は構えにもならない");
  checks += 1;

  const disabled = {
    ...run,
    loadout: { ...run.loadout, disabled: { warden: ["steady_cut"] } },
  };
  equal(designatedUltimate(disabled, "warden"), null, "オフにした技能の指定は効かない");
}

// 指定の操作。**払うものが無いので、いつでも変えられる。**
{
  const { run } = armedRun({});
  const candidates = ultimateCandidates(run.loadout, "warden");
  ok(candidates.length > 0, "装着している技能から候補が出る");
  ok(
    candidates.every((entry) => run.loadout.tactics.warden.includes(entry.skillId)
      || run.loadout.reactives.warden.includes(entry.skillId)),
    "候補は装着している技能だけ",
  );

  const first = setUltimate(run.loadout, "warden", candidates[0].skillId);
  equal(first.ok, true, "候補は指定できる");
  equal(first.loadout.ultimates.warden, candidates[0].skillId, "指定が入る");
  const again = setUltimate(first.loadout, "warden", candidates[0].skillId);
  equal(again.loadout.ultimates.warden, undefined, "同じ技能をもう一度選ぶと指定が外れる");
  const bad = setUltimate(run.loadout, "warden", "relay_order");
  equal(bad.ok, false, "必殺にできない技能は指定できない");

  const armedOnce = toggleUltimateArmed(first.loadout, "warden", undefined, { uses: 1 });
  equal(armedOnce.armed, true, "指定してあれば構えられる");
  const disarmedAgain = toggleUltimateArmed(armedOnce.loadout, "warden", undefined, { uses: 1 });
  equal(disarmedAgain.armed, false, "もう一度押すと構えを解く");
  const noDesignation = toggleUltimateArmed(run.loadout, "mender", undefined, { uses: 1 });
  equal(noDesignation.ok, false, "指定していない仲間は構えられない");
}

// 予測と本番は同じ。**構えても preview の契約は変わらない。**
{
  const { profile, run } = armedRun({ warden: "steady_cut", lancer: "heavy_swing" });
  const preview = previewNextBattle(run, profile, 3);
  const { result } = simulateExpeditionBattle(run, profile, 3);
  equal(preview.result, result.result, "予測と本番の勝敗が一致する");
  equal(preview.roundsUsed, result.roundsUsed, "予測と本番のラウンド数が一致する");
  for (const entry of preview.perCharacter) {
    const actor = result.actors.find((candidate) => candidate.instanceId === "a_" + entry.characterId);
    equal(entry.endingHp, actor.hp, entry.characterId + " の終了HPが一致する");
  }
  // 同じ入力なら二度目も同じ。
  const twice = simulateExpeditionBattle(run, profile, 3);
  assert.deepEqual(
    twice.result.events.map((event) => event.type),
    result.events.map((event) => event.type),
    "同じ入力から同じイベント列が出る",
  );
  checks += 1;
}

// 必殺は手数を増やさない。**行動回数は構えても変わらない。**
{
  const { profile, run } = armedRun({ warden: "steady_cut" });
  const plain = { ...run, loadout: { ...run.loadout, ultimateArmed: {} } };
  const countActions = (battle) => battle.result.events.filter((event) => (
    event.type === "action_started" && event.sourceActorId === "a_warden"
  )).length;
  const withUltimate = simulateExpeditionBattle(run, profile, 1);
  const without = simulateExpeditionBattle(plain, profile, 1);
  ok(
    countActions(withUltimate) <= countActions(without) + 0,
    "必殺を構えても、その人物の行動回数は増えない（同じ AP を払う一手である）",
  );
}

// engine と schema は語彙を増やしていない。**必殺だけの分岐を engine に作らない。**
{
  const engineSource = await import("node:fs")
    .then((fs) => fs.readFileSync(new URL("./engine.mjs", import.meta.url), "utf8"));
  ok(!engineSource.includes("ultimate"), "engine は必殺という言葉を知らない");
  const schemaSource = await import("node:fs")
    .then((fs) => fs.readFileSync(new URL("./schema.mjs", import.meta.url), "utf8"));
  ok(
    !schemaSource.includes("ULTIMATE") && !schemaSource.includes("ult_"),
    "schema に必殺のための語彙は増えていない",
  );
}

// 直接組んだ戦闘で、傷の条件と「戦闘に1回だけ」を両方確かめる。
// **同じ盤面を、隊が無傷の場合と削られている場合で走らせる。**
{
  const bundle = withUltimates(PLAYABLE_CONTENT, ["steady_cut"]);
  const maxHp = PLAYABLE_CONTENT.characters.warden.maxHp;
  const battleWith = (hp) => ({
    schemaVersion: "ecology-battle-4",
    battleId: "ultimate_once_" + hp,
    maxRounds: 12,
    objective: { type: "eliminate_all_enemies" },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      hp,
      tactics: [{ activeSkillId: "ult_steady_cut", useWhen: [] }, { activeSkillId: "steady_cut", useWhen: [] }],
      reactiveSkillIds: [],
      passiveSkillIds: [],
      equipment: [],
    }],
    enemies: [{
      instanceId: "e_wall",
      enemyActorId: Object.keys(PLAYABLE_CONTENT.enemyActors)[0],
      position: "front_left",
      // **殴り返してこない壁。**傷の条件が「敵に殴られたから」ではなく
      // 「開始 HP がそこだから」だけで決まるようにする。
      stats: { maxHp: 4000, might: 0, focus: 0, guard: 0 },
    }],
  });
  const startsOf = (battle, skillId) => {
    assert.deepEqual(validateBattleInput(battle, bundle), [], "直接組んだ入力も妥当である");
    checks += 1;
    const result = simulateBattle(battle, bundle, { equipmentBreaks: false });
    return {
      result,
      starts: result.events.filter((event) => (
        event.type === "action_started" && event.skillId === skillId
      )).length,
    };
  };

  const healthy = startsOf(battleWith(maxHp), "ult_steady_cut");
  equal(healthy.starts, 0, "隊が無傷なら、何ラウンド回っても必殺は出ない");
  ok(healthy.result.roundsUsed >= 3, "その盤面は複数ラウンド続いている（出番はあった）");

  const hurt = battleWith(Math.floor(maxHp * (ULTIMATE_READY_HP_PERCENT - 10) / 100));
  const fired = startsOf(hurt, "ult_steady_cut");
  equal(fired.starts, 1, "削られていれば出る。ただし何ラウンド回っても1回だけ");
  const plainStarts = fired.result.events.filter((event) => (
    event.type === "action_started" && event.skillId === "steady_cut"
  ));
  ok(plainStarts.length >= 1, "放ったあとは元の技能が回る");
}

console.log(`ultimate.test.mjs: ${checks} checks passed`);
