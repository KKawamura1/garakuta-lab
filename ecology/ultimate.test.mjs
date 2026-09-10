// ecology/ultimate.test.mjs — 必殺技（issue #238）
//
// **見るのは有限性と一貫性であって、強さではない。**
//
//   - 変換規則が「何も変わらない技能」を必殺にしない（画面の印が嘘にならない）。
//   - 1戦闘に1回。同じ戦闘で二度は出ない。
//   - 印は隊で共有し、補充されない。構えただけでは減らず、**放ったときだけ**減る。
//   - 負けた一戦では減らない（retry で二重に取られない）。
//   - 予測と本番が同じ結果を返す（構えても preview の契約は変わらない）。
//   - AP・RP・行動回数は増えない（手数を増やす必殺を作らない）。
//   - engine と schema の語彙を増やしていない。

import assert from "node:assert/strict";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import { validateBattleInput } from "./validate.mjs";
import {
  ULTIMATE_SEALS_PER_RUN,
  ULTIMATE_SPENT_STATUS_ID,
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
  ultimateSealsLeft,
  ultimateSealsSpent,
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
      assert.deepEqual(definition.rule.costs, base.costs, skillId + " の必殺は反応点の代償を変えない");
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

// 単体は全体へ。広がれない効果だけが2倍になる。**規則そのものを一つずつ確かめる。**
{
  const base = PLAYABLE_CONTENT.activeSkills.steady_cut;
  const ascended = ascendSkill(PLAYABLE_CONTENT, "steady_cut");
  const baseDamage = base.effects.find((effect) => effect.type === "deal_damage");
  const ultDamage = ascended.definition.effects.find((effect) => effect.type === "deal_damage");
  equal(ultDamage.target.take, "all", "単体が全体になる");
  equal(ascended.definition.targetQuery.take, "all", "宣言する狙い先も一緒に広がる");
  assert.deepEqual(
    ultDamage.amount, baseDamage.amount,
    "全体へ広がった効果の量は据え置き（広さと太さは両立させない）",
  );
  checks += 1;

  // 広がれない効果は太くなる。**自分だけを狙う攻撃系は広げないので、量が倍になる。**
  const counter = ascendSkill(PLAYABLE_CONTENT, "counter_blow");
  const baseCounter = PLAYABLE_CONTENT.reactiveSkills.counter_blow.rule.effects
    .find((effect) => effect.type === "deal_damage");
  const ultCounter = counter.definition.rule.effects.find((effect) => effect.type === "deal_damage");
  equal(
    (ultCounter.amount.numerator ?? 1), (baseCounter.amount.numerator ?? 1) * 2,
    "広がれない効果の量は2倍になる",
  );
  equal(
    ultCounter.amount.coefficientBps, baseCounter.amount.coefficientBps,
    "係数そのものは動かさない（分子だけを倍にするので整数のまま）",
  );
  ok(counter.traits.amplified && !counter.traits.widened, "反撃は太くなるだけで広がらない");

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
  equal(ultimateSealsLeft(run), ULTIMATE_SEALS_PER_RUN, "遠征は満タンの必殺印で始まる");
  equal(designatedUltimate(run, "warden"), "steady_cut", "指定した技能が読める");
  equal(designatedUltimate(run, "mender"), null, "指定していない仲間は必殺を持たない");

  const bundle = runContentBundle(run);
  ok(bundle.activeSkills.ult_steady_cut, "構えた必殺の定義が遠征の bundle に入る");
  ok(!bundle.activeSkills.ult_aimed_shot, "構えていない必殺の定義は入らない");

  const { battleInput, result } = simulateExpeditionBattle(run, profile, 1);
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

  const spent = ultimateSealsSpent(run, result);
  assert.deepEqual(spent, ["warden"], "印を払ったのは放った本人");
  checks += 1;

  const committed = commitBattleResult(profile, run, 1, result);
  equal(ultimateSealsLeft(committed.run), ULTIMATE_SEALS_PER_RUN - 1, "勝つと印が1つ減る");
  equal(
    committed.run.loadout.ultimateArmed.warden, undefined,
    "放った者の構えは解ける（次の一戦へ黙って持ち越さない）",
  );
  equal(committed.snapshot.ultimateSealsSpent, 1, "払った数が snapshot に残る");
}

// 構えても出なければ払わない。
{
  const { profile, run } = armedRun({ mender: "triage" });
  const { result } = simulateExpeditionBattle(run, profile, 1);
  const fired = ultimateFirings(result);
  if (fired.length === 0) {
    const committed = commitBattleResult(profile, run, 1, result);
    equal(
      ultimateSealsLeft(committed.run), ULTIMATE_SEALS_PER_RUN,
      "条件が揃わず出なかった必殺は、印を払わない",
    );
  } else {
    // この一戦で本当に出たなら、それは「被弾した味方がいた」ということ。
    // どちらの筋でも、払った数と出た数は一致していなければならない。
    equal(
      ultimateSealsSpent(run, result).length, fired.length,
      "払った数と出た数は一致する",
    );
  }
}

// 負けた一戦では減らない。**retry で二重に取られない。**
{
  const { profile, run } = armedRun({ mender: "triage" });
  const { result } = simulateExpeditionBattle(run, profile, 12);
  equal(result.result, "loss", "満足に育てていない隊は第12戦で負ける（この検査の前提）");
  ok(ultimateFirings(result).length > 0, "負けた戦闘でも必殺そのものは出ている");
  const committed = commitBattleResult(profile, run, 12, result);
  equal(
    ultimateSealsLeft(committed.run), ULTIMATE_SEALS_PER_RUN,
    "負けた一戦は無かったことになる（印も戻る）",
  );
  equal(committed.snapshot.ultimateSealsSpent, 0, "負けた一戦は印を払っていない");
}

// 印より多くは構えられない。**残り0では誰も構えられない。**
{
  const { run } = armedRun({
    warden: "steady_cut",
    mender: "aimed_shot",
    lancer: "heavy_swing",
    guardian: "column_thrust",
    tactician: "mark_target",
  });
  equal(
    armedUltimates(run).length, ULTIMATE_SEALS_PER_RUN,
    "構えられるのは残っている印の数まで",
  );
  assert.deepEqual(
    armedUltimates(run).map((entry) => entry.characterId),
    run.roster.slice(0, ULTIMATE_SEALS_PER_RUN),
    "誰が構えるかは隊の順で決まる（予測と本番で同じ組になる）",
  );
  checks += 1;
  const empty = { ...run, ultimateSeals: 0 };
  assert.deepEqual(armedUltimates(empty), [], "印が尽きたら誰も構えられない");
  checks += 1;

  const disarmed = toggleUltimateArmed(run.loadout, "guardian", undefined, { seals: 0 });
  equal(disarmed.armed, false, "構えを解くのは印が無くてもできる");
  const attempt = toggleUltimateArmed(disarmed.loadout, "guardian", undefined, { seals: 0 });
  equal(attempt.ok, false, "印が無いのに構えようとしたら断る");
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

  const armedOnce = toggleUltimateArmed(first.loadout, "warden", undefined, { seals: 3 });
  equal(armedOnce.armed, true, "指定してあれば構えられる");
  const disarmed = toggleUltimateArmed(armedOnce.loadout, "warden", undefined, { seals: 3 });
  equal(disarmed.armed, false, "もう一度押すと構えを解く");
  const noDesignation = toggleUltimateArmed(run.loadout, "mender", undefined, { seals: 3 });
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

// 直接組んだ戦闘でも、必殺は戦闘に1回きり（複数ラウンド走らせて確かめる）。
{
  const bundle = withUltimates(PLAYABLE_CONTENT, ["steady_cut"]);
  const battle = {
    schemaVersion: "ecology-battle-4",
    battleId: "ultimate_once",
    maxRounds: 12,
    objective: { type: "eliminate_all_enemies" },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      tactics: [{ activeSkillId: "ult_steady_cut", useWhen: [] }, { activeSkillId: "steady_cut", useWhen: [] }],
      reactiveSkillIds: [],
      passiveSkillIds: [],
      equipment: [],
    }],
    enemies: [{
      instanceId: "e_wall",
      enemyActorId: Object.keys(PLAYABLE_CONTENT.enemyActors)[0],
      position: "front_left",
      stats: { maxHp: 4000, might: 1, focus: 1, guard: 0 },
    }],
  };
  assert.deepEqual(validateBattleInput(battle, bundle), [], "直接組んだ入力も妥当である");
  checks += 1;
  const result = simulateBattle(battle, bundle, { equipmentBreaks: false });
  const ultimateStarts = result.events.filter((event) => (
    event.type === "action_started" && event.skillId === "ult_steady_cut"
  ));
  const plainStarts = result.events.filter((event) => (
    event.type === "action_started" && event.skillId === "steady_cut"
  ));
  equal(ultimateStarts.length, 1, "何ラウンド回っても必殺は1回だけ");
  ok(plainStarts.length >= 1, "放ったあとは元の技能が回る");
  ok(result.roundsUsed >= 3, "この盤面は複数ラウンド続いている（1回だけ、が意味を持つ）");
}

console.log(`ultimate.test.mjs: ${checks} checks passed`);
