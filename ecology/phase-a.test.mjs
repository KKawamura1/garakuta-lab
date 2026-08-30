// ecology/phase-a.test.mjs — R6 Phase A の戦闘基盤。
//
// **足したばかりの機構は、足した本人が一番信じている。**
// block・guard・多段・row/column・reach・stat_scaled は既存 content が
// 一つも使っていないので、既存のどの suite も踏まない。ここが唯一の踏み場。
//
// 見るのは「動くこと」ではなく **R6 が固定した順と式のとおりか**。

import assert from "node:assert/strict";
import { CONTENT_SCHEMA_VERSION, BATTLE_SCHEMA_VERSION, POSITIONS, POSITION_ROW } from "./schema.mjs";
import { simulateBattle, validateContentBundle, validateBattleInput } from "./engine.mjs";
import { roundHalfUpDiv } from "./values.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

// ---- round-half-up（R6 §4.4）-------------------------------------------------

equal(roundHalfUpDiv(5, 10), 1, "0.5 は切り上げ");
equal(roundHalfUpDiv(4, 10), 0, "0.4 は切り捨て");
equal(roundHalfUpDiv(15, 10), 2, "1.5 は切り上げ");
equal(roundHalfUpDiv(0, 10), 0, "0 は 0");
equal(roundHalfUpDiv(10, 10), 1, "割り切れる");
// **浮動小数を通していないこと。** Math.floor(x + 0.5) だと桁が落ちる大きさで確かめる。
equal(roundHalfUpDiv(2 ** 53 - 1, 1), 2 ** 53 - 1, "大きな数でも壊れない");

// ---- content -----------------------------------------------------------------

const guard = (id, displayName, patch = {}) => ({
  id,
  displayName,
  maxHp: 200,
  speed: 5,
  might: 40,
  focus: 40,
  guard: 0,
  baseActionPoints: 1,
  baseReactionPoints: 0,
  signatureRules: [],
  tags: ["test"],
  ...patch,
});

const single = { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 };
const selfTarget = { scope: "self", take: 1 };

const CONTENT = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  contentVersion: "phase-a-test-1",
  characters: {
    striker: guard("striker", "撃つ人"),
    // R6 §4.4 — guard は hit ごとの固定軽減。
    warder: guard("warder", "受ける人", { guard: 30, baseActionPoints: 0 }),
    soft: guard("soft", "受ける人（無防備）", { guard: 0, baseActionPoints: 0 }),
  },
  activeSkills: {
    // might 100% の basic strike。
    basic: {
      id: "basic", displayName: "基本打撃", apCost: 1, targetQuery: single, intrinsicPredicates: [],
      effects: [{
        type: "deal_damage", target: single, tags: ["weapon"],
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 10_000 },
      }],
      tags: ["attack"],
    },
    // 同じ総係数を4hitへ割る。**guard に弱くなるはず。**
    rapid: {
      id: "rapid", displayName: "連撃", apCost: 1, targetQuery: single, intrinsicPredicates: [],
      effects: [{
        type: "deal_damage", target: single, tags: ["weapon"], hitCount: 4,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 2_500 },
      }],
      tags: ["attack"],
    },
    // guard を半分無視する。
    pierce: {
      id: "pierce", displayName: "貫き", apCost: 1, targetQuery: single, intrinsicPredicates: [],
      effects: [{
        type: "deal_damage", target: single, tags: ["weapon"], guardPierceBps: 5_000,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 10_000 },
      }],
      tags: ["attack"],
    },
    row_sweep: {
      id: "row_sweep", displayName: "薙ぎ", apCost: 1, targetQuery: single, intrinsicPredicates: [],
      effects: [{
        type: "deal_damage", target: single, tags: ["weapon"], targetPattern: "row",
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 5_000 },
      }],
      tags: ["attack"],
    },
    column_thrust: {
      id: "column_thrust", displayName: "突き通し", apCost: 1, targetQuery: single, intrinsicPredicates: [],
      effects: [{
        type: "deal_damage", target: single, tags: ["weapon"], targetPattern: "column",
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 5_000 },
      }],
      tags: ["attack"],
    },
    // melee は前列が生きている間 後列へ届かない。
    melee_poke: {
      id: "melee_poke", displayName: "近接", apCost: 1, targetQuery: single, intrinsicPredicates: [],
      effects: [{
        type: "deal_damage", target: single, tags: ["weapon"], reach: "melee",
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 10_000 },
      }],
      tags: ["attack"],
    },
    ranged_poke: {
      id: "ranged_poke", displayName: "遠隔", apCost: 1,
      targetQuery: { scope: "enemies", filters: [{ type: "alive" }, { type: "row_is", row: "rear" }], sort: ["position_asc"], take: 1 },
      intrinsicPredicates: [],
      effects: [{
        type: "deal_damage", tags: ["weapon"], reach: "ranged",
        target: { scope: "enemies", filters: [{ type: "alive" }, { type: "row_is", row: "rear" }], sort: ["position_asc"], take: 1 },
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 10_000 },
      }],
      tags: ["attack"],
    },
    raise_block: {
      id: "raise_block", displayName: "構え", apCost: 1, targetQuery: selfTarget, intrinsicPredicates: [],
      effects: [{ type: "gain_block", target: selfTarget, amount: { type: "constant", value: 1 } }],
      tags: ["defend"],
    },
  },
  reactiveSkills: {},
  passiveSkills: {},
  equipment: {},
  statuses: {},
  enemyActors: {
    dummy: {
      id: "dummy", displayName: "的", maxHp: 400, speed: 1, guard: 0,
      baseActionPoints: 0, baseReactionPoints: 0,
      tactics: [], reactiveSkillIds: [], intrinsicRules: [], tags: ["test"],
    },
    warded: {
      id: "warded", displayName: "硬い的", maxHp: 400, speed: 1, guard: 30,
      baseActionPoints: 0, baseReactionPoints: 0,
      tactics: [], reactiveSkillIds: [], intrinsicRules: [], tags: ["test"],
    },
  },
  regionRules: [],
});

assert.deepEqual(validateContentBundle(CONTENT), [], "Phase A の語彙が validator を通る");
checks += 1;

// ---- 戦闘の組み立て ------------------------------------------------------------

function run(skillId, enemies, { allyPosition = "front_left" } = {}) {
  const input = {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "phase_a_" + skillId,
    maxRounds: 1,
    objective: { type: "eliminate_all_enemies" },
    allies: [{
      instanceId: "a1", characterId: "striker", position: allyPosition,
      tactics: [{ activeSkillId: skillId, useWhen: [] }], reactiveSkillIds: [], equipment: [],
    }],
    enemies,
  };
  assert.deepEqual(validateBattleInput(input, CONTENT), [], skillId + " の入力が通る");
  checks += 1;
  return simulateBattle(input, CONTENT, { captureReplaySnapshots: false });
}

const hp = (result, id) => result.actors.find((a) => a.instanceId === id).hp;
const dummies = (...positions) => positions.map((position, index) =>
  ({ instanceId: "e" + index, enemyActorId: "dummy", position }));

// ---- guard は hit ごと（R6 §4.4）-----------------------------------------------

{
  // might 40 × 100% = 40。guard 30 → 40 - 30 = 10。最低保証 roundHalfUp(40*0.1)=4 より大きい。
  const result = run("basic", [{ instanceId: "e0", enemyActorId: "warded", position: "front_left" }]);
  equal(400 - hp(result, "e0"), 10, "単発 40 は guard 30 を引いて 10 通る");
}
{
  // 同じ総係数を4hitへ。1hit = roundHalfUp(40*2500/10000) = 10。guard 30 で全部止まる
  // → 最低保証 roundHalfUp(10*1000/10000) = 1 が4回。
  const result = run("rapid", [{ instanceId: "e0", enemyActorId: "warded", position: "front_left" }]);
  equal(400 - hp(result, "e0"), 4, "**多段は guard に弱い**。同じ総係数でも 10 対 4");
}
{
  // guard を半分無視： effectiveGuard = roundHalfUp(30 * 5000/10000) = 15 → 40-15 = 25。
  const result = run("pierce", [{ instanceId: "e0", enemyActorId: "warded", position: "front_left" }]);
  equal(400 - hp(result, "e0"), 25, "貫通は guard を半分だけ無視する");
}
{
  // guard 0 なら素通り。多段と単発が同じになる（差は guard が作っている）。
  const flat = run("basic", dummies("front_left"));
  const many = run("rapid", dummies("front_left"));
  equal(400 - hp(flat, "e0"), 40, "guard 0 では単発 40");
  equal(400 - hp(many, "e0"), 40, "guard 0 では多段も 40。**差は guard が作る**");
}

// ---- block は instance を丸ごと止める（R6 §6.7）--------------------------------

{
  const input = {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "phase_a_block",
    maxRounds: 2,
    objective: { type: "eliminate_all_enemies" },
    allies: [
      { instanceId: "a1", characterId: "striker", position: "front_left",
        tactics: [{ activeSkillId: "basic", useWhen: [] }], reactiveSkillIds: [], equipment: [] },
      { instanceId: "a2", characterId: "soft", position: "front_right",
        tactics: [], reactiveSkillIds: [], equipment: [] },
    ],
    enemies: [{ instanceId: "e0", enemyActorId: "dummy", position: "front_left" }],
  };
  const result = simulateBattle(input, CONTENT, { captureReplaySnapshots: false });
  const blocked = result.events.filter((e) => e.type === "damage_blocked");
  equal(blocked.length, 0, "block を持たない相手では damage_blocked は出ない");
}
{
  // 自分に block を1つ張ってから殴られる側を作る。
  const input = {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "phase_a_block_hit",
    maxRounds: 1,
    objective: { type: "eliminate_all_enemies" },
    allies: [{ instanceId: "a1", characterId: "striker", position: "front_left",
      tactics: [{ activeSkillId: "raise_block", useWhen: [] }], reactiveSkillIds: [], equipment: [] }],
    enemies: dummies("front_left"),
  };
  const result = simulateBattle(input, CONTENT, { captureReplaySnapshots: false });
  const gained = result.events.filter((e) => e.type === "block_gained");
  equal(gained.length, 1, "block_gained が1件出る");
  equal(gained[0].values.after, 1, "charge が1になる");
}

// ---- 範囲（R6 §5.4）-----------------------------------------------------------

{
  const result = run("row_sweep", dummies("front_left", "front_center", "rear_left"));
  equal(400 - hp(result, "e0"), 20, "row は同じ行の1体目");
  equal(400 - hp(result, "e1"), 20, "row は同じ行の2体目にも当たる");
  equal(400 - hp(result, "e2"), 0, "**row は別の行へは当たらない**");
}
{
  const result = run("column_thrust", dummies("front_left", "front_center", "rear_left"));
  equal(400 - hp(result, "e0"), 20, "column は前列");
  equal(400 - hp(result, "e2"), 20, "column は同じ列の後列へ通る");
  equal(400 - hp(result, "e1"), 0, "**column は別の列へは当たらない**");
}

// ---- reach（R6 §5.4）----------------------------------------------------------

{
  const result = run("melee_poke", dummies("front_left", "rear_left"));
  equal(400 - hp(result, "e0"), 40, "melee は前列を狙う");
  equal(400 - hp(result, "e1"), 0, "**前列が生きている間、melee は後列へ届かない**");
}
{
  const result = run("melee_poke", [{ instanceId: "e1", enemyActorId: "dummy", position: "rear_left" }]);
  equal(400 - hp(result, "e1"), 40, "前列が居なければ melee も後列へ届く");
}
{
  const result = run("ranged_poke", dummies("front_left", "rear_left"));
  equal(400 - hp(result, "e1"), 40, "ranged は前列を越えて後列を狙える");
  equal(400 - hp(result, "e0"), 0, "ranged は狙った相手だけを撃つ");
}

// ---- 2×3 の語彙 ---------------------------------------------------------------

equal(POSITIONS.length, 6, "position は6つ");
for (const position of POSITIONS) {
  check(POSITION_ROW[position] === "front" || POSITION_ROW[position] === "rear", position + " に行がある");
}
{
  // 中央列も本当に使える（語彙にあるだけでなく、戦闘が成立する）。
  const result = run("basic", [{ instanceId: "e0", enemyActorId: "dummy", position: "rear_center" }]);
  equal(400 - hp(result, "e0"), 40, "中央後列の相手を殴れる");
}

// ---- 決定性 --------------------------------------------------------------------

{
  const a = run("rapid", dummies("front_left", "front_center"));
  const b = run("rapid", dummies("front_left", "front_center"));
  assert.deepEqual(a.events, b.events, "同じ入力は同じイベント列");
  checks += 1;
}

// ---- 攻撃テンポの保証（R6 §6.4）------------------------------------------------
//
// **これは「支援だけを連打して戦闘が止まらない」ための不変条件。**
// 実装があることではなく、止まらないことを見る。

{
  const { PLAYABLE_CONTENT } = await import("./content/index.mjs");
  const { freshLoadout, makeBattle, RUN_SEED, equipSkill, removeSkill } = await import("./playable-battles.mjs");
  const roster = ["warden", "mender", "lancer", "scout", "guardian"];
  const formation = {
    warden: "front_left", lancer: "front_center", guardian: "front_right",
    mender: "rear_left", scout: "rear_right",
  };

  const play = (loadout) => simulateBattle(
    makeBattle(2, roster, loadout, RUN_SEED, formation),
    PLAYABLE_CONTENT,
    { captureReplaySnapshots: false },
  );

  // 全員を純支援にする。**追撃が無ければ、誰も敵を殴らない。**
  let supportOnly = freshLoadout(roster);
  for (const id of roster) {
    for (const skillId of [...supportOnly.tactics[id]]) {
      const removed = removeSkill(supportOnly, id, skillId, "active");
      if (removed.ok) supportOnly = removed.loadout;
    }
    const equipped = equipSkill(supportOnly, id, "bulwark", "active");
    if (equipped.ok) supportOnly = equipped.loadout;
  }
  const supportRun = play(supportOnly);
  const followUps = supportRun.events.filter(
    (event) => event.type === "action_started" && String(event.skillId ?? "").startsWith("fallback_strike"),
  );
  check(followUps.length > 0, "支援だけの構成でも追撃が出る（R6 §6.4）");
  const damageToEnemies = supportRun.events.filter(
    (event) => event.type === "damage_taken" && String(event.targetActorIds?.[0] ?? "").startsWith("e_"),
  );
  check(damageToEnemies.length > 0, "**支援だけでも敵にダメージが入る。**戦闘が止まらない");

  // 追撃から追撃は生まれない。**行動1回につき、追撃は多くとも1回。**
  const utilityActions = supportRun.events.filter(
    (event) => event.type === "action_started"
      && !String(event.skillId ?? "").startsWith("fallback_strike")
      && (PLAYABLE_CONTENT.activeSkills[event.skillId]?.actionMode === "utility"),
  );
  check(
    followUps.length <= utilityActions.length,
    `追撃(${followUps.length}) が支援行動(${utilityActions.length}) を超えない。**追撃から追撃は生まれない**`,
  );

  // 技能を一つも持たない人物でも basic strike が出る。
  const bare = freshLoadout(roster);
  for (const skillId of [...bare.tactics.lancer]) {
    const removed = removeSkill(bare, "lancer", skillId, "active");
    if (removed.ok) bare.tactics.lancer = removed.loadout.tactics.lancer;
  }
  bare.tactics.lancer = [];
  const bareRun = play(bare);
  const basics = bareRun.events.filter(
    (event) => event.type === "action_started"
      && event.sourceActorId === "a_lancer"
      && String(event.skillId ?? "").startsWith("basic_strike"),
  );
  check(basics.length > 0, "技能を持たない仲間も通常攻撃をする（R6 §6.4）");
  equal(basics[0].skillId, "basic_strike_melee", "レオンは近接なので通常攻撃");

  // 届き方は技能ごと。playable の通常攻撃・追撃は、仲間の位置に関係なく melee。
  const reaches = new Set(supportRun.events
    .filter((event) => event.type === "action_started" && String(event.skillId ?? "").includes("strike_"))
    .map((event) => event.skillId));
  check(!reaches.has("fallback_strike_ranged"), "後衛でも追撃は自動的に遠隔にならない");
  check(reaches.has("fallback_strike_melee"), "通常攻撃・追撃は技能定義の melee を使う");
}

console.log(`phase-a.test.mjs: ${checks} checks passed`);
