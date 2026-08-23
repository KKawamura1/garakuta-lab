// **「一つの並びで、何戦続けて勝てるか」の分布。**
//
// なぜこれを測るか（2026-08-23）：
//
// 作者の報告は二つある。**「そのまま勝ててしまう」**（つまらない）と、
// **「思いついた手段で3ストライクできたところ」**（面白さ5のランの最良の瞬間）。
// **同じ現象**である。違うのは、それが**目標だったかどうか**だけ。
//
// そして学び#30 は「暗算は面白さではない。**答えを出して、正解を減らす**」と言っている。
// ところが正解は減らせなかった——1戦あたりの無傷率を下げると詰みが出る（T1と両立しない）。
// 天井の条件は16組中13組で満たせていない。
//
// **1戦の中で減らせないなら、戦をまたいで減らす。** 第3戦を無傷で抜ける並びは1.5%あるが、
// 第3戦と第4戦を**続けて**抜ける並びはもっと少ない。
// **どの1戦も易しいまま、答えの数だけが減る。**T1 を壊さずに天井を下げられる唯一の方向である。
//
// ここで測るのは、その「もっと少ない」が本当に少ないか。
// 全部の並びが6戦通してしまうなら目標にならないし、2戦すら続かないなら目標にならない。

import { makeLawRuleset, PARTS, SLOT_COUNT, BASE } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { reachableSets } from "./sets.mjs";
import { allArrangements } from "../core/best-possible.mjs";
import { makeRng } from "../core/rng.mjs";

const RUNS = Number(process.argv[2] || 8);
const CAP = 4000;   // 並びが多い局面は標本を採る（13個で16650通りある）

const skeleton = {
  PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
  startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
    && t.filter(x => PARTS[x].line === "guard").length >= 2
    && t.filter(x => PARTS[x].line === "service").length >= 1
};

// その並びで、第 from 戦から何戦続けて勝てるか。**HPは持ち越す**（実機と同じ）。
function chainFrom(rules, order, from, hp) {
  let current = hp, n = 0;
  for (let i = from; i < rules.ENEMIES.length; i += 1) {
    const r = rules.simulateBattle({
      slots: order.map((type, k) => ({ id: `x${k}`, type })),
      hp: current, maxHp: rules.MAX_HP, enemy: rules.ENEMIES[i], rng: makeRng(1)
    });
    if (!r.won) break;
    current = r.hp; n += 1;
  }
  return n;
}

const rows = [];
LAW_TABLE.forEach(v => {
  const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps, { skipWins: true });
  const sets = reachableSets(skeleton, { runs: RUNS });
  // 各局面で「いちばん長く続く並び」と「勝てる並びのうち2戦以上続く割合」を出す。
  const bests = [];
  const shares = [];
  sets.forEach(s => {
    if (s.index > 3) return;                    // 第5戦以降は残りが短くて頭打ちになる
    const rng = makeRng(s.run * 977 + s.index);
    let all = allArrangements(s.owned, SLOT_COUNT);
    if (all.length > CAP) {
      const picked = [];
      for (let i = 0; i < CAP; i += 1) picked.push(all[Math.floor(rng() * all.length)]);
      all = picked;
    }
    let best = 0, wins = 0, chained = 0;
    all.forEach(order => {
      const n = chainFrom(rules, order, s.index, rules.MAX_HP);
      if (n >= 1) wins += 1;
      if (n >= 2) chained += 1;
      if (n > best) best = n;
    });
    if (wins) { bests.push(best); shares.push(chained / wins); }
  });
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  rows.push({ name: v.laws.join("+"), best: mean(bests), share: mean(shares),
    maxSeen: Math.max(0, ...bests), n: bests.length });
});

console.log("組                いちばん長い連勝(平均)  勝てる並びのうち2戦続く割合  最長");
rows.forEach(r => console.log(
  `  ${r.name.padEnd(18)}${r.best.toFixed(2).padStart(10)}${(r.share * 100).toFixed(1).padStart(23)}%${String(r.maxSeen).padStart(6)}`));
const mean = k => rows.reduce((s, r) => s + r[k], 0) / rows.length;
console.log(`\n平均：いちばん長い連勝 ${mean("best").toFixed(2)} 戦 ／ 勝てる並びのうち2戦続くのは ${(mean("share") * 100).toFixed(1)}%`);
console.log(`\n読み方：2戦続く割合が数%なら、連勝は「狙って取る目標」になる。`);
console.log(`5割を超えるなら、そのまま勝ててしまう側の話であって、目標にはならない。`);
