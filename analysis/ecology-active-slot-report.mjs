// analysis/ecology-active-slot-report.mjs
//
// **アクティブ技能を2本目・3本目と装着したときに、何が起きるかを測る。**
//
// 作者の報告（2026-09-17）は「アクティブを複数取る価値が低い。無条件を1つ
// 取って Lv10 まで上げるのが一番強く、他は取ってもオフにした方がマシ」。
//
// これは印象ではなく規則から出る算数なので、**印象のまま議論しない。**同じ盤面・
// 同じ seed へ、装着本数と Lv 配分だけを変えた隊を通し、10ラウンドで与えた量を
// 並べる。加えて、ツリー58節のうち「入口技能を育てた本数」を Lv1 で超えられる
// 節が何本あるかを数える。
//
// **これは関門ではない**（check-all.sh に入れていない）。数字を固定すると、
// まだ決めていない設計判断を検査が先に決めてしまう。docs/skill-reboot/
// 10-active-slot-economy.md が読む測定であって、合否は持たない。
//
// 使い方: node analysis/ecology-active-slot-report.mjs

import { simulateBattle } from "../ecology/engine.mjs";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";
import { BATTLE_SCHEMA_VERSION, SKILL_LEVEL_STEP_BPS, MAX_SKILL_LEVEL } from "../ecology/schema.mjs";
import { SKILL_TREE_NODES, skillLevelCostBetweenFor } from "../ecology/content/index.mjs";
import { UNCONDITIONAL_FLAT_LEVELS } from "../ecology/content/skill-levels.mjs";
import { BPS } from "../ecology/values.mjs";

// ================================================================ 測り方
//
// **倒し切ると比較が切れる**ので、的の HP を厚くして殴り続けさせる。的は
// 反撃しない（tactics を空にする）。測るのは「同じ10ラウンドで、味方一人が
// 何点通したか」だけで、勝敗でも生存でもない。
const ROUNDS = 10;
const SEED = "active-slot-report";

function dealtInTenRounds(tacticIds, skillLevels, { guard = 0 } = {}) {
  const enemyActors = structuredClone(PLAYABLE_CONTENT.enemyActors);
  enemyActors.husk = { ...enemyActors.husk, maxHp: 100_000, guard, tactics: [] };
  const characters = structuredClone(PLAYABLE_CONTENT.characters);
  characters.warden = { ...characters.warden, maxHp: 100_000 };
  const content = { ...PLAYABLE_CONTENT, enemyActors, characters };

  const result = simulateBattle({
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "active_slot_report",
    maxRounds: ROUNDS,
    objective: { type: "eliminate_all_enemies" },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      tactics: tacticIds.map((activeSkillId) => ({ activeSkillId, useWhen: [] })),
      reactiveSkillIds: [],
      passiveSkillIds: [],
      equipment: [],
      skillLevels,
    }],
    enemies: [{ instanceId: "e_1", enemyActorId: "husk", position: "front_left" }],
    rngSeed: SEED,
  }, content);

  let dealt = 0;
  const fired = new Map();
  for (const event of result.events) {
    if (event.type === "damage_taken"
      && (event.targetActorIds ?? []).some((id) => String(id).startsWith("e_"))) {
      dealt += Number(event.values?.amount ?? 0);
    }
    if (event.type === "action_declared" && event.sourceActorId === "a_warden") {
      fired.set(event.skillId, (fired.get(event.skillId) ?? 0) + 1);
    }
  }
  return { dealt, fired };
}

function row(label, tacticIds, skillLevels, options, baseline) {
  const { dealt, fired } = dealtInTenRounds(tacticIds, skillLevels, options);
  const share = baseline ? ` ${(dealt / baseline * 100).toFixed(0)}%` : "  100%";
  console.log(
    "  " + label.padEnd(34),
    String(dealt).padStart(5) + share,
    "  " + [...fired].map(([id, count]) => `${id}×${count}`).join(" "),
  );
  return dealt;
}

console.log("");
console.log(`== ゴウ（腕力50）が ${ROUNDS} ラウンド殴り続けた量 ==`);
console.log("  受け0の的");
const base = row("① 踏み込み斬りだけ Lv10", ["steady_cut"], { steady_cut: 10 }, {}, null);
row("② ①へ貫き突きLv1を足す（点を払う）", ["steady_cut", "pierce_thrust"], { steady_cut: 10, pierce_thrust: 1 }, {}, base);
row("③ 同じ点を2本へ分ける（各Lv5）", ["steady_cut", "pierce_thrust"], { steady_cut: 5, pierce_thrust: 5 }, {}, base);
row("④ ①へ3本足す", ["steady_cut", "pierce_thrust", "rapid_cuts", "column_thrust"], { steady_cut: 10 }, {}, base);

// **条件付きの2本目だけは、輪番の割り算に入らない。**条件が成立しない拍は
// カーソルを進めずに読み飛ばすので、出番を奪わない（engine の chooseTactic）。
// 的は常にHP満タンなので、止めの一突き（HP50%以下が条件）は一度も出ない。
row("⑥ ①へ条件付き（止めの一突き）を足す", ["steady_cut", "finishing_thrust"], { steady_cut: 10, finishing_thrust: 1 }, {}, base);

console.log("  受け20の的（貫き突きが「刺さる」はずの相手）");
const hard = row("① 踏み込み斬りだけ Lv10", ["steady_cut"], { steady_cut: 10 }, { guard: 20 }, null);
row("⑤ 貫き突きだけ Lv10", ["pierce_thrust"], { pierce_thrust: 10 }, { guard: 20 }, hard);
row("② ①へ貫き突きLv1を足す", ["steady_cut", "pierce_thrust"], { steady_cut: 10, pierce_thrust: 1 }, { guard: 20 }, hard);

// ================================================================ 損益分岐
//
// 輪番なので、**2本目は「1本目の代わりに出る」**。だから2本目がLv1で釣り合う
// には、1本目の「いまのLvでの係数」を超えている必要がある。入口の踏み込み斬り
// （腕130%）が何Lvのとき、ツリーの何本がそれを超えられるかを数える。
const activeSkills = PLAYABLE_CONTENT.activeSkills;
const nodeBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));
const activeNodes = SKILL_TREE_NODES.filter((node) => node.kind === "active");

function totalCoefficientBps(skillId) {
  const skill = activeSkills[skillId];
  if (!skill) return 0;
  const effects = [...(skill.effects ?? []), ...(skill.preparation?.completionEffects ?? [])];
  return effects
    .filter((effect) => effect.type === "deal_damage")
    .reduce((total, effect) => total + (effect.amount?.coefficientBps ?? 0) * (effect.hitCount ?? 1), 0);
}

const atLevel = (bps, level) => Math.round(bps * (BPS + (level - 1) * SKILL_LEVEL_STEP_BPS) / BPS);

// 解禁までに払う技能点。前提の前提まで閉包を取り、必要 Lv の差分も足す
// （analysis/ecology-skill-balance-smoke.mjs の unlockBudget と同じ数え方）。
function unlockBudget(skillId) {
  const needed = new Map();
  const pending = [];
  const demand = (id, level = 1) => {
    if (level <= (needed.get(id) ?? 0)) return;
    needed.set(id, level);
    pending.push(id);
  };
  demand(skillId);
  while (pending.length) {
    const current = nodeBySkill[pending.pop()];
    for (const required of current?.requires ?? []) demand(required.skillId, required.minLv);
  }
  return [...needed].reduce((total, [id, level]) => total + (nodeBySkill[id]?.cost ?? 0) + level - 1, 0);
}

const entryBps = totalCoefficientBps("steady_cut");
console.log("");
console.log("== 2本目がLv1で1本目に釣り合うための係数 ==");
console.log(`  1本目は入口の踏み込み斬り（腕${entryBps / 100}%）とする。`);
console.log(`  無条件は Lv${UNCONDITIONAL_FLAT_LEVELS} までが1点、そこから先は1段2点`
  + `（Lv${MAX_SKILL_LEVEL} まで通すと ${skillLevelCostBetweenFor("steady_cut", 1, MAX_SKILL_LEVEL)}点、`
  + `条件つきなら ${skillLevelCostBetweenFor("finishing_thrust", 1, MAX_SKILL_LEVEL)}点）。`);
for (const level of [1, 3, 5, 8, MAX_SKILL_LEVEL]) {
  const threshold = atLevel(entryBps, level);
  const beats = activeNodes.filter((node) => totalCoefficientBps(node.skillId) > threshold);
  console.log(
    `  1本目Lv${String(level).padStart(2)}（${String(skillLevelCostBetweenFor("steady_cut", 1, level)).padStart(2)}点）`
    + ` = 腕${String(threshold / 100).padStart(3)}%`,
    `→ Lv1で超える節は ${String(beats.length).padStart(2)} / ${activeNodes.length} 本`,
    beats.length && beats.length <= 6
      ? "（" + beats.map((node) => activeSkills[node.skillId].displayName).join("・") + "）"
      : "",
  );
}

console.log("");
console.log("== 深い節へ通うのと、入口を育てるのは、同じ点で同じ強さか ==");
const deepest = [...activeNodes]
  .map((node) => ({ node, bps: totalCoefficientBps(node.skillId), budget: unlockBudget(node.skillId) }))
  .filter((entry) => entry.bps > 0)
  .sort((a, b) => b.bps - a.bps)
  .slice(0, 6);
// 同じ点を入口へ注いだら何 Lv まで届くか。**値段は段ごとに違う**（issue #286）。
function levelReachedWith(skillId, points) {
  let level = 1;
  let left = points;
  while (level < MAX_SKILL_LEVEL) {
    const price = skillLevelCostBetweenFor(skillId, level, level + 1);
    if (left < price) break;
    left -= price;
    level += 1;
  }
  return level;
}
for (const { node, bps, budget } of deepest) {
  const rivalLevel = levelReachedWith("steady_cut", budget);
  // **溜める技は一手あたりで見る。**溜めに1手使うので、放つ一撃の係数をそのまま
  // 並べると、行動枠の話（何本装着するか）と単位が合わない。
  const turns = 1 + (activeSkills[node.skillId].preparation?.steps ?? 0);
  const perTurn = Math.round(bps / turns);
  console.log(
    "  " + activeSkills[node.skillId].displayName.padEnd(10),
    `解禁まで${String(budget).padStart(2)}点`,
    `Lv1で腕${String(bps / 100).padStart(3)}%`,
    (turns > 1 ? `(${turns}手ぶん = 一手${perTurn / 100}%)` : "").padEnd(20),
    `／同じ点を入口へ注ぐと Lv${rivalLevel} = 腕${atLevel(entryBps, rivalLevel) / 100}%`,
  );
}
console.log("");

// ================================================================ 条件という器
//
// **条件付きの技能は、輪番の割り算に入らない**（上の⑥）。つまり「複数取る価値」を
// 乱数も資源も足さずに作れる器は、すでにある。問題は器ではなく中身なので、
// 「条件を満たす手間に対して、いくら上乗せされているか」を数える。
const perTurnBps = (skillId) => {
  const skill = activeSkills[skillId];
  if (!skill) return 0;
  const effects = [...(skill.effects ?? []), ...(skill.preparation?.completionEffects ?? [])];
  const total = effects
    .filter((effect) => effect.type === "deal_damage")
    .reduce((sum, effect) => sum + (effect.amount?.coefficientBps ?? 0) * (effect.hitCount ?? 1), 0);
  // 溜める技は一手あたりで見る（溜めにも一手使うので、出番の話と単位を合わせる）。
  return Math.round(total / (1 + (activeSkills[skillId].preparation?.steps ?? 0)));
};

const damaging = activeNodes
  .map((node) => ({
    name: activeSkills[node.skillId]?.displayName ?? node.skillId,
    conditional: (activeSkills[node.skillId]?.intrinsicPredicates ?? []).length > 0,
    bps: perTurnBps(node.skillId),
  }))
  .filter((entry) => entry.bps > 0);
const median = (list) => [...list].sort((a, b) => a.bps - b.bps)[Math.floor(list.length / 2)].bps;
const unconditional = damaging.filter((entry) => !entry.conditional);
const conditional = damaging.filter((entry) => entry.conditional);
const entryTop = atLevel(entryBps, MAX_SKILL_LEVEL);

console.log("== 条件を満たす手間に、いくら払われているか ==");
console.log(`  攻撃節 ${damaging.length}（無条件 ${unconditional.length}・条件付き ${conditional.length}）`);
console.log(`  一手あたり係数の中央値 — 無条件 腕${median(unconditional) / 100}%`
  + ` ／ 条件付き 腕${median(conditional) / 100}%`);
// **比べる相手は「据え置き価格で届く上限」**（issue #286）。Lv6 以降は1段2点なので、
// そこから先は「他を全部諦める」宣言になる。
const entryFlatTop = atLevel(entryBps, UNCONDITIONAL_FLAT_LEVELS);
console.log(`  条件付きのうち、Lv1で入口Lv${UNCONDITIONAL_FLAT_LEVELS}（腕${entryFlatTop / 100}%・`
  + `${skillLevelCostBetweenFor("steady_cut", 1, UNCONDITIONAL_FLAT_LEVELS)}点）を超えるのは`
  + ` ${conditional.filter((entry) => entry.bps > entryFlatTop).length} / ${conditional.length} 本`);
console.log(`  （参考）入口Lv${MAX_SKILL_LEVEL}（腕${entryTop / 100}%・`
  + `${skillLevelCostBetweenFor("steady_cut", 1, MAX_SKILL_LEVEL)}点）を超えるのは`
  + ` ${conditional.filter((entry) => entry.bps > entryTop).length} / ${conditional.length} 本`);
console.log("");
