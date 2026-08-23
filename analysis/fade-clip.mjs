// **減衰（1巡目3倍・以後1割ずつ）は、1巡上限に食われていないか。**
//
// 作者の報告（2026-08-23、共鳴＋減衰のラン、第1戦で敗退）：
//   「減衰ルールがつまらない（わからない）」
//   「減衰とダメージ上限のルール相性が悪く、理不尽に感じる」
//
// 疑い：**上がる側（1巡目3倍）だけが上限で切り落とされ、下がる側（毎巡1割減）は残る。**
// そうなら減衰は「下がるだけの法則」＝ハズレ法則になっている。
// 表から外した偏食のときと同じ形なので、**測ってから決める**（`DESIGN_LEARNINGS.md`）。
//
// 測り方：勝てる並びを集め、巡回ごとに「素で出した合計」と「実際に通った合計」を比べる。
// 切り落とされた割合を、1巡目とそれ以降で分けて出す。

import { makeLawRuleset, SLOT_COUNT, LAWS } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { allArrangements } from "../core/best-possible.mjs";
import { makeRng } from "../core/rng.mjs";

const SAMPLE = 400;

// **無作為な並びで測ると、上限にそもそも届かない。**
// 遊ぶ側が作るのは「その戦闘に勝てる並び」なので、そちらだけを見る。
// 勝てる並びが無いときは、素の火力が大きい上位1割で代える。
function winners(rules, enemy) {
  const types = Object.keys(rules.PARTS);
  const rng = makeRng(11);
  const all = [];
  for (let n = 0; n < SAMPLE * 6; n += 1) {
    const order = Array.from({ length: SLOT_COUNT }, () => types[Math.floor(rng() * types.length)]);
    const r = rules.simulateBattle({
      slots: order.map((type, i) => ({ id: `x${i}`, type })),
      hp: rules.MAX_HP, maxHp: rules.MAX_HP, enemy, rng: makeRng(1)
    });
    all.push({ order, won: r.won, power: enemy.hp - r.enemyHp });
  }
  const won = all.filter(x => x.won);
  if (won.length >= 20) return won.slice(0, SAMPLE).map(x => x.order);
  return all.sort((a, b) => b.power - a.power).slice(0, SAMPLE).map(x => x.order);
}

// 何を測るか：**その巡回に通った合計が、1巡上限に張り付いているか。**
//
// 記録に残る `damage` は**上限を通したあとの値**なので、「素で何を出したか」は読めない。
// 読めない量を推定するより、読める量で言えることを言う：
// 上限に張り付いた巡回は、**それ以上出しても1も増えない巡回**である。
// 減衰の 3倍 が意味を持つのは1巡目なので、そこが張り付いていれば倍率は捨てられている。
function saturation(rules, enemy) {
  const capacity = enemy.cycleCap || enemy.hp;
  let firstHit = 0, firstTotal = 0, restHit = 0, restTotal = 0;
  for (const order of winners(rules, enemy)) {
    const r = rules.simulateBattle({
      slots: order.map((type, i) => ({ id: `x${i}`, type })),
      hp: rules.MAX_HP, maxHp: rules.MAX_HP, enemy, rng: makeRng(1)
    });
    const per = new Map();
    let prev = enemy.hp;
    (r.log || []).forEach(e => {
      if (!e.after) return;
      per.set(e.cycle, (per.get(e.cycle) || 0) + Math.max(0, prev - e.after.enemyHp));
      prev = e.after.enemyHp;
    });
    per.forEach((through, cycle) => {
      const saturated = through >= capacity;
      if (cycle === 1) { firstTotal += 1; if (saturated) firstHit += 1; }
      else { restTotal += 1; if (saturated) restHit += 1; }
    });
  }
  return {
    first: firstTotal ? firstHit / firstTotal : 0,
    rest: restTotal ? restHit / restTotal : 0
  };
}

const rows = [];
LAW_TABLE.forEach(v => {
  const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps,
    v.regenFrac ? { regenFrac: v.regenFrac } : {});
  const enemy = rules.ENEMIES[2];
  const c = saturation(rules, enemy);
  rows.push({ laws: v.laws.join("+"), name: v.laws.map(id => LAWS[id].name).join("＋"),
    fade: v.laws.includes("fade"), ...c });
});

rows.sort((a, b) => b.first - a.first);
console.log("組                 1巡目が上限張付き  2巡目以降");
rows.forEach(r => console.log(
  `  ${r.name.padEnd(12)}${r.fade ? "★" : " "} ${(r.first * 100).toFixed(1).padStart(8)}%  ${(r.rest * 100).toFixed(1).padStart(8)}%`));

const avg = (list, key) => (list.length ? list.reduce((s, x) => s + x[key], 0) / list.length : 0);
const withFade = rows.filter(r => r.fade), without = rows.filter(r => !r.fade);
console.log(`\n減衰あり(${withFade.length}組) 1巡目 ${(avg(withFade, "first") * 100).toFixed(1)}% / 以降 ${(avg(withFade, "rest") * 100).toFixed(1)}%`);
console.log(`減衰なし(${without.length}組) 1巡目 ${(avg(without, "first") * 100).toFixed(1)}% / 以降 ${(avg(without, "rest") * 100).toFixed(1)}%`);
console.log("\n★＝減衰を含む組。1巡目の張り付きが減衰ありで目立って高ければ、3倍が上限に食われている。");
