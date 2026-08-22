// 対の片方を、もう片方に**揃える**。
//
// Recall テストは「1つの条件だけが違う」ことが命である。
// B（位相なし・順序非依存）は素のままだと、狙った「順序が効かない」以外に
// **詰みなし率と選択の緩さまで違ってしまう**（実測：詰みなし 100%→79%、選択に勝目 50%→24%）。
// それでは差が出ても、どの違いのせいか言えない。
//
// 敵のHPだけを動かして、**揃えるべき量（詰みなし率・選択に勝目・並びの当り）を A に寄せる。**
// 動かしてはいけない量（順序が効くか）は、そのまま離れていること。

import { measure } from "./pair-check.mjs";
import { BASE } from "../core/laws.mjs";

const FLAT = BASE.map(() => 1);
const base = { scales: FLAT, atkScales: FLAT, modScales: FLAT,
  cycleCaps: BASE.map(e => Math.max(4, Math.round(e.hp / 3))) };
const LAWS_BOTH = ["buildup", "overload"];
const A = { ...base, laws: LAWS_BOTH, phaseless: false };
const RUNS = 12;

const target = measure(A, RUNS);
console.log("A（位相あり）— 法則は両側とも 蓄積＋過負荷");
console.log(`  詰みなし ${(target.T1 * 100).toFixed(1)}%  選択に勝目 ${(target.selectionLoose * 100).toFixed(1)}%`
  + `  並びの当り ${(target.permTight * 100).toFixed(1)}%  順序が効く ${(target.T3 * 100).toFixed(1)}%`);

// B の敵HPを一様に振って、A に一番近いところを探す。
// **揃える対象に「順序が効く」は入れない。**そこは離れていてほしい量である。
const distance = m =>
  Math.abs(m.T1 - target.T1) * 2
  + Math.abs(m.selectionLoose - target.selectionLoose)
  + Math.abs(m.permTight - target.permTight) * 0.5;

console.log("\nB（位相なし）の敵HPを振る");
console.log("  倍率   詰みなし  選択に勝目  並びの当り  順序が効く   Aとの隔たり");
let best = null;
for (const k of [0.35, 0.45, 0.55, 0.65, 0.8, 1.0]) {
  const B = { ...base, laws: LAWS_BOTH, phaseless: true,
    scales: base.scales.map(s => s * k) };
  const m = measure(B, RUNS);
  const d = distance(m);
  console.log(`  ${k.toFixed(2)}  ${(m.T1 * 100).toFixed(1).padStart(7)}% ${(m.selectionLoose * 100).toFixed(1).padStart(10)}%`
    + ` ${(m.permTight * 100).toFixed(1).padStart(10)}% ${(m.T3 * 100).toFixed(1).padStart(10)}%   ${d.toFixed(3)}`);
  if (!best || d < best.d) best = { k, d, m, B };
}
console.log(`\n一番近いのは 倍率${best.k}（隔たり ${best.d.toFixed(3)}）`);
console.log("  揃った量  : 詰みなし " + (target.T1 * 100).toFixed(0) + "% 対 " + (best.m.T1 * 100).toFixed(0)
  + "% / 選択に勝目 " + (target.selectionLoose * 100).toFixed(0) + "% 対 " + (best.m.selectionLoose * 100).toFixed(0) + "%");
console.log("  離れた量  : 順序が効く " + (target.T3 * 100).toFixed(0) + "% 対 " + (best.m.T3 * 100).toFixed(0) + "%  ← これが操作したかった差");
