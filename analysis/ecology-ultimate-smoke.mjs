// **必殺技（issue #238）を、遠征の長さで測る。**
//
// 単体の不変条件は ecology/ultimate.test.mjs が見ている。ここで見るのは
// 「有限資源として成立しているか」と「実際どれだけ動かすのか」である。
//
//   1. **目録。**取得済み技能のうち、どれが必殺になれてどれがなれないか。
//      なれない技能が残っていることそのものが、必殺化の規則が「全部を一律に強くする
//      装置」になっていない証拠である。
//   2. **有限性。**12戦を通しで走らせて、放たれた回数が必殺印の数を超えないこと。
//      同じ戦闘で二度出ないこと。印が負にならないこと。
//   3. **効き。**同じ盤面を「構える／構えない」で走らせ、ラウンド数と隊のHP損失が
//      どれだけ動くかを一戦ずつ出す。**判定はしない**——強すぎ／弱すぎを決めるのは
//      作者で、ここは数を並べるところまで。
//   4. **切り方の差。**同じ3つの印を「序盤から順に切る」「幕ボスへ集める」で
//      使い分けたとき、通しの到達点が変わること。変わらないなら、
//      「どこで切るか」という問い自体が成立していない。

import assert from "node:assert/strict";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";
import { ULTIMATE_SEALS_PER_RUN, ascendSkill, ultimateTraitLabels } from "../ecology/ultimates.mjs";
import {
  ENCOUNTERS_PER_RUN,
  armedUltimates,
  commitBattleResult,
  newProfile,
  newRun,
  ultimateSealsLeft,
  ultimateSealsSpent,
} from "../ecology/progression.mjs";
import { freshLoadout, simulateExpeditionBattle } from "../ecology/playable-battles.mjs";

const STAGE_SEQUENCE = 3;
const SEED = "ultimate-smoke";
const ACT_BOSSES = [4, 8, 12];

// ---------------------------------------------------------------- 1. 目録

const skillIds = [
  ...Object.keys(PLAYABLE_CONTENT.activeSkills),
  ...Object.keys(PLAYABLE_CONTENT.reactiveSkills),
];
const ascendable = [];
const plain = [];
for (const skillId of skillIds) {
  const ascended = ascendSkill(PLAYABLE_CONTENT, skillId);
  if (ascended) ascendable.push({ skillId, labels: ultimateTraitLabels(ascended.traits) });
  else plain.push(skillId);
}

assert.ok(ascendable.length > 0, "必殺にできる技能が一つも無い");
assert.ok(plain.length > 0, "全部の技能が必殺になれてしまう（規則が一律の強化になっている）");
const byLabel = {};
for (const entry of ascendable) {
  const key = entry.labels.join("+");
  byLabel[key] = (byLabel[key] ?? 0) + 1;
}
// 変換の形が一種類しか無いなら、必殺は「全部同じ強化」でしかない。
assert.ok(Object.keys(byLabel).length >= 2, "必殺の変わり方が一種類しか無い");

// ---------------------------------------------------------------- 走らせる道具

function baseRun() {
  const profile = newProfile();
  const run = newRun(profile, { runSeed: SEED, campaignStageSequence: STAGE_SEQUENCE });
  run.loadout = freshLoadout(run.roster);
  return { profile, run };
}

// **指定は「装着していて必殺にできる技能のうち、最初の一本」で決め打つ。**
// 誰がどれを選ぶかを人手で並べると、その並べ方の良し悪しを測ることになる。
function designateAll(run) {
  const ultimates = {};
  for (const characterId of run.roster) {
    const installed = [
      ...(run.loadout.tactics[characterId] ?? []),
      ...(run.loadout.reactives[characterId] ?? []),
    ];
    const pick = installed.find((skillId) => ascendSkill(PLAYABLE_CONTENT, skillId));
    if (pick) ultimates[characterId] = pick;
  }
  return { ...run, loadout: { ...run.loadout, ultimates } };
}

function armFor(run, characterIds) {
  return {
    ...run,
    loadout: {
      ...run.loadout,
      ultimateArmed: Object.fromEntries(characterIds.map((id) => [id, true])),
    },
  };
}

function hpLostIn(result) {
  return result.actors
    .filter((actor) => actor.side === "ally")
    .reduce((total, actor) => total + (actor.startingHp - actor.hp), 0);
}

// ---------------------------------------------------------------- 3. 効き

const { profile, run: fresh } = baseRun();
const designated = designateAll(fresh);
const armedAll = armFor(designated, designated.roster);
const perEncounter = [];
for (let index = 1; index <= ENCOUNTERS_PER_RUN; index += 1) {
  const off = simulateExpeditionBattle(designated, profile, index);
  const on = simulateExpeditionBattle(armedAll, profile, index);
  const fired = ultimateSealsSpent(armedAll, on.result);
  perEncounter.push({
    index,
    fired: fired.length,
    rounds: [off.result.roundsUsed, on.result.roundsUsed],
    hpLost: [hpLostIn(off.result), hpLostIn(on.result)],
    result: [off.result.result, on.result.result],
  });
  // **同じ戦闘で二度は出ない。**構えた人数ぶんまでしか出ない。
  assert.ok(
    fired.length <= armedUltimates(armedAll).length,
    `第${index}戦: 構えた人数より多く放っている`,
  );
  const starts = on.result.events.filter((event) => (
    event.type === "action_started" && String(event.skillId ?? "").startsWith("ult_")
  ));
  const perSkill = {};
  for (const event of starts) {
    const key = event.sourceActorId + "/" + event.skillId;
    perSkill[key] = (perSkill[key] ?? 0) + 1;
  }
  for (const [key, count] of Object.entries(perSkill)) {
    assert.equal(count, 1, `第${index}戦: ${key} が同じ戦闘で ${count} 回出ている`);
  }
}

const moved = perEncounter.filter((entry) => (
  entry.fired > 0 && (entry.rounds[0] !== entry.rounds[1] || entry.hpLost[0] !== entry.hpLost[1])
));
assert.ok(moved.length > 0, "必殺が出ているのに、盤面が一つも動いていない");

// ---------------------------------------------------------------- 2 と 4. 通しと切り方

// 印の切り方を二つ。**同じ3つを、序盤から順に切るか、幕ボスへ集めるか。**
const POLICIES = [
  {
    id: "早く切る",
    armedAt: (index, run) => (ultimateSealsLeft(run) > 0 ? run.roster.slice(0, 1) : []),
  },
  {
    id: "幕ボスへ集める",
    armedAt: (index, run) => (
      ACT_BOSSES.includes(index) ? run.roster.slice(0, ultimateSealsLeft(run)) : []
    ),
  },
];

const walks = [];
for (const policy of POLICIES) {
  const start = designateAll(baseRun().run);
  let run = start;
  let reached = 0;
  let fired = 0;
  let rounds = 0;
  for (let index = 1; index <= ENCOUNTERS_PER_RUN; index += 1) {
    run = { ...armFor(run, policy.armedAt(index, run)), encounterIndex: index };
    const { result } = simulateExpeditionBattle(run, profile, index);
    rounds += result.roundsUsed;
    const spent = ultimateSealsSpent(run, result);
    if (result.result !== "win") break;
    fired += spent.length;
    reached = index;
    const commit = commitBattleResult(profile, run, index, result);
    run = commit.run;
    assert.ok(ultimateSealsLeft(run) >= 0, policy.id + ": 必殺印が負になった");
  }
  assert.ok(
    fired <= ULTIMATE_SEALS_PER_RUN,
    `${policy.id}: 12戦で ${fired} 回放っている（印は ${ULTIMATE_SEALS_PER_RUN} つしかない）`,
  );
  walks.push({ id: policy.id, reached, fired, rounds, sealsLeft: ultimateSealsLeft(run) });
}

// 切り方で通しの形が変わらないなら、「どこで切るか」という問いが成立していない。
const shapes = new Set(walks.map((walk) => walk.reached + "/" + walk.rounds));
assert.ok(shapes.size > 1, "切り方を変えても通しの形が変わらない（賭ける先に意味が無い）");

// ---------------------------------------------------------------- 出力

console.log(
  "ecology-ultimate smoke: 必殺にできる技能 " + ascendable.length + "件 / できない "
  + plain.length + "件（" + plain.slice(0, 6).join(" · ")
  + (plain.length > 6 ? " ほか" : "") + "）。変換の形 "
  + Object.entries(byLabel).map(([key, count]) => key + " " + count + "件").join(" · "),
);
console.log(
  "ecology-ultimate smoke 一戦ごとの効き（構えない → 全員構える）: "
  + perEncounter.map((entry) => (
    "第" + entry.index + "戦 " + entry.rounds[0] + "→" + entry.rounds[1] + "R・被害 "
    + entry.hpLost[0] + "→" + entry.hpLost[1]
    + "（放った " + entry.fired + "）"
    + (entry.result[0] === entry.result[1] ? "" : "・" + entry.result[0] + "→" + entry.result[1])
  )).join(" / "),
);
console.log(
  "ecology-ultimate smoke 切り方の差: "
  + walks.map((walk) => (
    walk.id + " 第" + walk.reached + "/" + ENCOUNTERS_PER_RUN + "戦・通算"
    + walk.rounds + "ラウンド・放った " + walk.fired + "・残り印 " + walk.sealsLeft
  )).join(" / "),
);
