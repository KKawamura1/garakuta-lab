// **どの敵も、そもそも倒せること。**
//
// 2026-08-23、作者が引いた盤面（連勝機関／先陣＋倍速、第6戦 再生炉）は
// **どんな並びでも勝てなかった。**手持ち13個・16650通りを全列挙して勝ち 0 である。
// 作者の言葉：「最終戦、どうやっても勝てないようになっていましたね？？」
// 「無理ゲーがあったため」（面白さ 2）。
//
// 原因は調律器が敵の毎巡回復を**素の値のまま**測っていたこと（`analysis/tune-laws.mjs`）。
// そちらは直したが、**直した器そのものを信じる検査**では同じ穴をまた見落とす。
// ここでは器を通さず、算術だけで言える必要条件を課す。
//
//   1巡に通る合計の上限 × 打切り巡回 − 毎巡回復 × (打切り − 1) ≧ 敵HP
//
// 左辺は「毎巡いちばん強い並びが、上限いっぱいまで通し続けた」場合の到達点である。
// これを下回る敵は、部品にも並びにも関係なく**倒せない。**
// 必要条件なので、通っても「遊べる」とは言っていない（それは調律器の T1 の仕事）。

import { makeLawRuleset, MAX_CYCLES } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { COST_TABLE } from "../core/cost-table.mjs";
import { SQUEEZE_TABLE } from "../core/squeeze-table.mjs";

const fail = m => { console.error(`feasible smoke: ${m}`); process.exit(1); };

const TABLES = [
  ["法則機関（連勝・同定も同じ表）", LAW_TABLE, {}],
  ["代償機関", COST_TABLE, {}],
  ["締付機関", SQUEEZE_TABLE, {}]
];

let checked = 0;
let thinnest = { slack: Infinity };
TABLES.forEach(([label, table, extra]) => {
  if (!Array.isArray(table)) fail(`${label} の表が配列でない`);
  if (!table.length) fail(`${label} の表が空。調律器の出力が壊れている`);
  table.forEach(row => {
    const rules = makeLawRuleset(row.laws, row.scales, row.atkScales, row.modScales, row.cycleCaps,
      row.regenFrac ? { ...extra, regenFrac: row.regenFrac } : extra);
    rules.ENEMIES.forEach((enemy, i) => {
      checked += 1;
      const cap = enemy.cycleCap || enemy.hp;
      const ceiling = MAX_CYCLES * cap - (MAX_CYCLES - 1) * (enemy.regen || 0);
      const slack = ceiling - enemy.hp;
      if (slack < 0) fail(
        `${label} ${row.laws.join("+")} 第${i + 1}戦 ${enemy.name}：`
        + `上限${cap}×${MAX_CYCLES}巡 − 回復${enemy.regen || 0}×${MAX_CYCLES - 1} = ${ceiling} < HP${enemy.hp}。`
        + `**どんな並びでも勝てない。**`);
      if (slack < thinnest.slack) thinnest = { slack, label, laws: row.laws.join("+"), enemy: enemy.name, ceiling, hp: enemy.hp };
    });
  });
});

console.log(`feasible smoke: ${checked}戦すべてに勝ち筋の余地あり`
  + `（いちばん薄いのは ${thinnest.label} ${thinnest.laws} の ${thinnest.enemy}：上界${thinnest.ceiling} 対 HP${thinnest.hp}、余裕${thinnest.slack}） OK`);
