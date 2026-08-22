// 「閃き」の対の片方を、もう片方に**揃える**。
//
// 操作したい変数は**噛み合わせの多さ**（`analysis/interaction.mjs`）。
// 作者の良かった瞬間はほぼ全部「閃き」で、その中身は
// 「一撃99の制限は2回攻撃なら198までいける」のような**機構どうしの噛み合わせへの気づき**だった。
// 噛み合わせが強い法則の組と、足し算で分かる法則の組を並べて、選ばせる。
//
// **揃えるべき量に「順序が効く」を入れる。**
// t3 で3組とも位相ありが選ばれている。順序が効くかは既に知覚される差だと分かっているので、
// ここが揃っていないと、選ばれた理由が噛み合わせなのか順序なのか言えない。
// 揃える：詰みなし・選択に勝目・並びの当り・順序が効く。離す：噛み合わせだけ。

import { measure } from "./pair-check.mjs";
import { interaction } from "./interaction.mjs";
import { BASE, LAWS } from "../core/laws.mjs";

const FLAT = BASE.map(() => 1);
const base = { atkScales: FLAT, modScales: FLAT,
  cycleCaps: BASE.map(e => Math.max(4, Math.round(e.hp / 3))) };
const RUNS = 8;
const shape = (laws, k) => ({ ...base, laws, phaseless: false, scales: FLAT.map(v => v * k) });
const name = ids => ids.map(i => LAWS[i].name).join("＋");

// 噛み合わせの強い側の候補と、弱い側の候補（`interaction.mjs` の上位・下位から）。
// 既に使っている組は避ける（t3=蓄積＋過負荷、t2=継電＋先陣）。
const HIGH = [["overload", "fade"], ["haste", "overload"], ["buildup", "haste"]];
const LOW = [["reflect", "monotony"], ["counter", "monotony"], ["vanguard", "monotony"], ["balance", "monotony"]];
const SCALES = [0.5, 0.7, 0.85, 1.0, 1.25, 1.5];

const row = (label, k, m, gap) => console.log(
  `  ${label.padEnd(14)} ${k.toFixed(2)}  ${(m.T1 * 100).toFixed(0).padStart(5)}%`
  + ` ${(m.selectionLoose * 100).toFixed(0).padStart(8)}% ${(m.permTight * 100).toFixed(0).padStart(8)}%`
  + ` ${(m.T3 * 100).toFixed(0).padStart(8)}%   ${(gap * 100).toFixed(0).padStart(4)}%`);

const distance = (m, t) =>
  Math.abs(m.T1 - t.T1) * 2 + Math.abs(m.selectionLoose - t.selectionLoose)
  + Math.abs(m.permTight - t.permTight) * 0.5 + Math.abs(m.T3 - t.T3) * 2;

console.log("噛み合わせの対を揃える（揃える：詰みなし・選択に勝目・並びの当り・順序が効く）\n");
console.log("  組             倍率  詰みなし 選択に勝目 並びの当り 順序が効く  噛み合わせ");

const highs = [];
for (const laws of HIGH) {
  const gap = interaction(laws[0], laws[1], 5);
  for (const k of SCALES) { const m = measure(shape(laws, k), RUNS); row(name(laws), k, m, gap); highs.push({ laws, k, m, gap }); }
}
console.log("");
const lows = [];
for (const laws of LOW) {
  const gap = interaction(laws[0], laws[1], 5);
  for (const k of SCALES) { const m = measure(shape(laws, k), RUNS); row(name(laws), k, m, gap); lows.push({ laws, k, m, gap }); }
}

// **どの高×低の組み合わせが一番よく揃うか。**噛み合わせの差は大きいほどよい。
let best = null;
highs.forEach(h => lows.forEach(l => {
  if (h.m.T1 < 0.85 || l.m.T1 < 0.85) return;          // どちらも詰みだらけでは壊れたゲーム
  const d = distance(l.m, h.m);
  const sep = h.gap - l.gap;
  if (sep < 0.25) return;                               // 離したい量が十分離れていること
  const score = d - sep * 0.2;
  if (!best || score < best.score) best = { h, l, d, sep, score };
}));

if (!best) { console.log("\n揃う組み合わせが見つからなかった"); process.exit(1); }
console.log(`\n一番よく揃うのは`);
console.log(`  噛み合う側 : ${name(best.h.laws)}（倍率 ${best.h.k}）  噛み合わせ ${(best.h.gap * 100).toFixed(0)}%`);
console.log(`  足し算の側 : ${name(best.l.laws)}（倍率 ${best.l.k}）  噛み合わせ ${(best.l.gap * 100).toFixed(0)}%`);
const f = (a, b) => `${(a * 100).toFixed(0)}% 対 ${(b * 100).toFixed(0)}%`;
console.log(`  揃った量   : 詰みなし ${f(best.h.m.T1, best.l.m.T1)} / 選択に勝目 ${f(best.h.m.selectionLoose, best.l.m.selectionLoose)}`
  + ` / 並びの当り ${f(best.h.m.permTight, best.l.m.permTight)} / 順序が効く ${f(best.h.m.T3, best.l.m.T3)}`);
console.log(`  離れた量   : 噛み合わせ ${f(best.h.gap, best.l.gap)}  ← これが操作したかった差`);
console.log(`  laws: ${JSON.stringify(best.h.laws)} hpScale ${best.h.k} / ${JSON.stringify(best.l.laws)} hpScale ${best.l.k}`);
