// **一度の戦闘から、任意の敵HP・任意の毎巡回復に対する勝敗を読み出す。**
//
// 調律器（`analysis/tune-laws.mjs`）の心臓部。敵HPを二分探索するたびに全局面を測り直すと
// 100分かかるので、**HPが無限の的と一度だけ戦い、巡回ごとの与ダメージと自HPを記録して**、
// あとは算術で読み替える。
//
// 成立する理由：**どの部品も法則も敵の残HPを読まない。**（`core/laws.mjs` を確認済み。
// `enemyHp` を見ているのは「まだ生きているか」の判定だけで、的が無限HPなら常に真。）
// だから巡回ごとの与ダメージは、敵HPにも回復量にも依らない定数列になる。
//
// ここを別ファイルに出したのは、**読み替えが一度壊れて、そのまま出荷されたから**である。
// 2026-08-23、的の回復を素の値（10）のままにして測り、出荷時は倍率を掛けた値（18）にしていた。
// 結果、先陣＋倍速の第6戦は「どんな並びでも勝てない」敵として世に出た。
// 読み替えは器の中に埋めておくものではなく、**本物の戦闘と突き合わせて検査するもの**である
// （`analysis/smoke-readout.mjs`）。

import { MAX_CYCLES } from "../core/laws.mjs";

const DUMMY_HP = 1e9;

// 巡回ごとに畳んだ「素の火力と自HPの推移」。的の回復は 0 にする（回復は読み出し側で掛ける）。
export function capacity(simulate, order, enemyTemplate, { hp, maxHp, seedRng }) {
  const enemy = { ...enemyTemplate, hp: DUMMY_HP, regen: 0 };
  const result = simulate({
    slots: order.map((type, i) => ({ id: `x${i}`, type })),
    hp, maxHp, enemy, rng: seedRng()
  });
  const cycles = [];
  let current = null;
  let before = 0;
  result.log.forEach(entry => {
    if (!entry.after) return;
    if (!current || current.cycle !== entry.cycle) {
      before = current ? before + current.gross : 0;
      current = { cycle: entry.cycle, hits: [], gross: 0 };
      cycles.push(current);
    }
    // 巡回のはじめからの累計。巡回をまたぐ分は `before` で引く。
    const dealt = DUMMY_HP - entry.after.enemyHp - before;
    current.gross = dealt;
    current.hits.push({ dealt, hp: entry.after.hp });
  });
  return cycles;
}

// 敵HP h・毎巡回復 regen に対する結果。
export function outcomeAt(cycles, h, regen = 0, fallbackHp = 0) {
  let left = h;
  let last = null;
  for (const c of cycles) {
    for (const e of c.hits) {
      last = e;
      // 敵は命中のたびに死ぬ。**その時点で巡回が終わる**ので、その巡の敵の攻撃は来ない。
      if (left - e.dealt <= 0) return { won: true, hp: Math.max(0, e.hp), cycles: c.cycle };
    }
    // 巡回の終わりに回復する。**最大HPは超えない**（`core/laws.mjs` と同じ形）。
    left = Math.min(h, left - c.gross + regen);
    // **自分の生死は巡回の切れ目でしか見ない。**`core/laws.mjs` の while はそこでしか判定しない。
    // 途中で0を通っても、同じ巡回の回復で戻れば戦闘は続く（過給器の自傷 → 整流器の回復）。
    // ここを「途中で0なら負け」と書いていたため、**勝てる並びを負けと読んでいた。**
    if (last && last.hp <= 0) return { won: false, hp: 0, cycles: c.cycle };
  }
  // ここまで来たら打切りである。**記録の最後の巡回が打切りとは限らない。**
  // 誰も作動せず敵も殴らない巡回は記録に残らないので、末尾の巡回番号は 11 にも 9 にもなる。
  return { won: false, hp: last ? Math.max(0, last.hp) : fallbackHp, cycles: MAX_CYCLES };
}
