// analysis/ecology-active-slot-smoke.mjs
//
// **アクティブの装着枠の規約。**issue #286。ここは難度の検査ではない——
// 「取った技能が死なないか」「技能点の逃げ場が塞がっているか」という**仕組みの検査**で、
// 敵の強さや12戦の勝敗には触れない（作者判断 2026-09-18: 難度は最後、システムは最初）。
//
// 実測の道具は analysis/ecology-active-slot-report.mjs にある（関門ではない）。

import assert from "node:assert/strict";
import {
  MAX_SKILL_LEVEL, MIN_SKILL_LEVEL, SKILL_LEVEL_STEP_BPS,
} from "../ecology/schema.mjs";
import {
  SKILL_LEVEL_CAPS,
  SKILL_TREE_NODES,
} from "../ecology/content/index.mjs";
import {
  SKILL_LEVEL_COST, SKILL_LEVEL_COST_STEEP, UNCONDITIONAL_FLAT_LEVELS, skillLevelCost,
} from "../ecology/content/skill-levels.mjs";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";
import { BPS } from "../ecology/values.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const nodeBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));

// 解禁までに払う技能点（前提の閉包と必要 Lv の差分を含む）。
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

// ============================================================ 出番と報酬（issue #286）
//
// **いつでも出せるものは伸びない。場面を選ぶものが伸びる。**
//
// アクティブは1ラウンドに1本しか出ないので、装着した無条件の技能は輪番で出番を
// 分け合う（DESIGN 8.7.5）。条件つきは条件が成立しない拍で読み飛ばされるだけなので、
// 出番を奪わない。この非対称を放っておくと、技能点は必ず「毎ラウンド出る無条件の
// 1本」へ集まり、**2本目を装着すると弱くなる**（analysis/ecology-active-slot-report.mjs
// が 72% と実測した）。規約は二つで、どちらも content 側だけで閉じている。
//
//   1. 上限は出番の逆（content/skill-levels.mjs）… 無条件のアクティブは Lv5、
//      条件つきは Lv10。ここでは「実際にそうなっているか」を数える。
//   2. 条件の報酬 … 条件つきの攻撃節は、**同じ能力値・同じ予算で取れる
//      「その拍で出せる素の無条件」の上限 Lv を、Lv1 で上回る。**
//      上回らないなら、条件を満たす手間に対して何も払われていない。
//
// 免除は二つだけ。**量以外で報われているもの**（状態・位置・資源を動かす）と、
// **対象数で報われているもの**（行・列・全体へ届く）。どちらも「量で上回れ」と
// 言うと、範囲技や刻印技を無意味に太らせることになる。
//
// 比べる相手から**溜め技を外す**。溜めは一撃へ集約する代わりに拍を先に払うので、
// 「その拍で出せる一撃」ではない（大溜めの一手あたり平均と、いま出せる一撃を
// 並べると、選択の話にならない）。
const activeNodes = SKILL_TREE_NODES.filter((node) => node.kind === "active");
const definitionOf = (skillId) => PLAYABLE_CONTENT.activeSkills[skillId];
const allEffectsOf = (skill) => [
  ...(skill?.effects ?? []), ...(skill?.preparation?.completionEffects ?? []),
];
const damageEffectsOf = (skill) => allEffectsOf(skill).filter((effect) => effect.type === "deal_damage");

// 技能欄の「無条件／条件つき」と同じ根拠（app.js の skillConditionLabel）。
// プレイヤーが付けた useWhen は run ごとに変わるので、ここでは数えない。
const isConditional = (skill) => (skill?.intrinsicPredicates ?? []).length > 0
  || (skill?.targetQuery?.filters ?? []).some((filter) => filter.type !== "alive");
const spreadsAcrossTargets = (skill) => allEffectsOf(skill)
  .some((effect) => effect.targetPattern && effect.targetPattern !== "single");
const paysInSomethingElse = (skill) => allEffectsOf(skill)
  .some((effect) => effect.type !== "deal_damage");
const isPlainDamage = (skill) => {
  const effects = allEffectsOf(skill);
  return effects.length > 0 && effects.every((effect) => effect.type === "deal_damage");
};
// 一手あたりの総係数。多段は足し、溜めは拍で割る。
const perActionBps = (skill) => Math.round(
  damageEffectsOf(skill).reduce(
    (total, effect) => total + (effect.amount?.coefficientBps ?? 0) * (effect.hitCount ?? 1), 0,
  ) / (1 + (skill?.preparation?.steps ?? 0)),
);
const scalingStatOf = (skill) => damageEffectsOf(skill)[0]?.amount?.scalingStat ?? null;
// **比べる相手は「据え置き価格で届く上限」。**Lv6 以降は1段2点なので、
// そこから先は「他を全部諦める」宣言になる。条件つきはその宣言をしていない
// 相手（＝Lv5 の無条件）を Lv1 で上回っていればよい。
const atFlatCeiling = (skill, skillId) => Math.round(
  perActionBps(skill)
    * (BPS + (Math.min(SKILL_LEVEL_CAPS[skillId], UNCONDITIONAL_FLAT_LEVELS) - MIN_SKILL_LEVEL)
      * SKILL_LEVEL_STEP_BPS) / BPS,
);

const activeEntries = activeNodes.map((node) => {
  const skill = definitionOf(node.skillId);
  return {
    skillId: node.skillId,
    displayName: skill?.displayName ?? node.skillId,
    budget: unlockBudget(node.skillId),
    conditional: isConditional(skill),
    prepares: (skill?.preparation?.steps ?? 0) > 0,
    plain: isPlainDamage(skill),
    spread: spreadsAcrossTargets(skill),
    other: paysInSomethingElse(skill),
    bps: perActionBps(skill),
    stat: scalingStatOf(skill),
    cap: SKILL_LEVEL_CAPS[node.skillId],
  };
});

// 1. 値段が出番の逆になっている。**天井（Lv10）は動かさない。**
for (const entry of activeEntries) {
  if (entry.cap === MIN_SKILL_LEVEL) continue;  // 連続量を持たない技能
  const definition = definitionOf(entry.skillId);
  equal(entry.cap, MAX_SKILL_LEVEL, `${entry.displayName} の上限は Lv10 のまま`);
  equal(skillLevelCost(definition, UNCONDITIONAL_FLAT_LEVELS), SKILL_LEVEL_COST,
    `${entry.displayName} は Lv${UNCONDITIONAL_FLAT_LEVELS} までなら1点`);
  equal(skillLevelCost(definition, UNCONDITIONAL_FLAT_LEVELS + 1),
    entry.conditional ? SKILL_LEVEL_COST : SKILL_LEVEL_COST_STEEP,
    `${entry.displayName}（${entry.conditional ? "条件つき" : "無条件"}）の`
    + `Lv${UNCONDITIONAL_FLAT_LEVELS + 1} の値段が出番と対応する`);
}
check(activeEntries.some((entry) => entry.cap > MIN_SKILL_LEVEL && !entry.conditional),
  "値上がりする無条件のアクティブが実際にある（規約が空振りしていない）");
check(activeEntries.some((entry) => entry.cap > MIN_SKILL_LEVEL && entry.conditional),
  "据え置きのまま伸びる条件つきが実際にある");

// 2. 条件の報酬。
const plainRivals = activeEntries.filter((entry) => (
  !entry.conditional && entry.plain && !entry.spread && !entry.prepares && entry.bps > 0
));
// **敵も使う技能は、味方の側だけを直せない**（AGENTS.md: 敵も味方と同じ共有語彙を使う）。
// 倍率を上げると同じ技能を持つ敵がそのまま強くなり、難度曲線が動く
// （実測: 後衛狩りを上げると第6段の刻みが 24% → 32% になった）。
// **敵の側とセットで直すまでの保留**で、この表は増やさない。減らすだけにする。
const SHARED_WITH_ENEMIES = Object.freeze({
  rear_hunt: "灰織の遠手（weave_reach）の主攻撃",
  finishing_thrust: "灰炉の熾（forge_ember）の主攻撃",
  execute_low: "灰炉の熾（forge_ember）の主攻撃",
});
for (const [skillId, reason] of Object.entries(SHARED_WITH_ENEMIES)) {
  check(Object.values(PLAYABLE_CONTENT.enemyActors).some((actor) => (
    (actor.tactics ?? []).some((tactic) => tactic.activeSkillId === skillId)
  )), `${skillId} の保留理由（${reason}）が実際の敵と合っている`);
}

for (const entry of activeEntries) {
  if (!entry.conditional || entry.bps === 0) continue;
  if (entry.other || entry.spread) continue;  // 量以外／対象数で報われている
  if (SHARED_WITH_ENEMIES[entry.skillId]) continue;  // 敵の再調整とセットで直す
  const rivals = plainRivals.filter((rival) => rival.budget <= entry.budget && rival.stat === entry.stat);
  const ceiling = rivals.reduce(
    (top, rival) => Math.max(top, atFlatCeiling(definitionOf(rival.skillId), rival.skillId)), 0,
  );
  check(entry.bps > ceiling,
    `${entry.displayName}（予算${entry.budget}・${entry.bps / 100}%）は`
    + `同格の無条件が据え置き価格で届く ${ceiling / 100}% を Lv1 で上回る`);
}

console.log(`ecology active slot smoke: ${checks} checks passed`);
