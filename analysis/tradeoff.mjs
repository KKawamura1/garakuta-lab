// **代償があるか**を測る。「全部は守れない」かどうか。
//
// Into the Breach は完全情報・決定的で、敵は攻撃を予告する。それでもつまらなくない。
// 不確実なのは結果ではなく、**何を諦めるかの正解**である
// （建物を守るか、次の手の位置を取るか。`analysis/KNOWLEDGE_SURVEY.md`）。
//
// うちの実測：**20ラン中15ランが失点0。** 諦めるものが何も無い。
//
// **天井の対と混同しないこと。** 天井（P12-b）は「無傷が**珍しい**か」を動かして、
// 2組とも気づかれずに終わった。珍しさは代償ではない。
// 敵が強いだけなら無傷は珍しくなるが、**選んではいない。**
//
// 代償とは、**速い並びと安全な並びが別物である**ことである。
// だから測るのは、並びごとの「速さの順位」と「安全さの順位」の**相関**：
//
//   正の相関 … 最良の並びが速さも安全も兼ねる ＝ **選ばなくていい ＝ 代償なし**
//   負の相関 … 速くすると削られ、守ると遅くなる ＝ **どちらかを諦める ＝ 代償あり**

import { makeSimulate, scaleEnemies, PARTS, SLOT_COUNT, BASE, LAWS } from "../core/laws.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const MAX_HP = 30;

function permutationsOf(multiset, cap) {
  const out = [], cur = [], used = new Array(multiset.length).fill(false);
  const sorted = [...multiset].sort();
  const walk = () => {
    if (out.length >= cap) return;
    if (cur.length === sorted.length) { out.push([...cur]); return; }
    let last = null;
    for (let i = 0; i < sorted.length; i += 1) {
      if (used[i] || sorted[i] === last) continue;
      last = sorted[i]; used[i] = true; cur.push(sorted[i]);
      walk(); cur.pop(); used[i] = false;
    }
  };
  walk();
  return out;
}

// スピアマンの順位相関。同順位は平均順位で扱う。
function spearman(xs, ys) {
  const rank = a => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    let i = 0;
    while (i < idx.length) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys), n = xs.length;
  if (n < 3) return null;
  const mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

export function tradeoff({ laws, scales, atkScales, modScales, cycleCaps, phaseless = false, overdrive = null }, runs = 10) {
  const sim = makeSimulate(laws, { phaseless, overdrive });
  const enemies = scaleEnemies(scales, atkScales, modScales, cycleCaps);
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
      && t.filter(x => PARTS[x].line === "guard").length >= 2
      && t.filter(x => PARTS[x].line === "service").length >= 1 }, { runs });

  const rhos = [];
  let winFlawless = 0, wins = 0;
  enemies.forEach((enemy, index) => sets.filter(s => s.index === index).forEach(s => {
    // 勝てた並びだけを見る。**負けた並びに代償の話は無い。**
    const fast = [], safe = [];
    permutationsOf(s.owned.slice(0, SLOT_COUNT), 120).forEach(order => {
      const r = sim({ slots: order.map((t, i) => ({ id: `x${i}`, type: t })),
        hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1) });
      if (!r.won) return;
      wins += 1; if (r.hp >= SAFE_HP) winFlawless += 1;
      fast.push(-r.cycles);   // 速いほど大きい
      safe.push(r.hp);        // 削られていないほど大きい
    });
    const rho = spearman(fast, safe);
    if (rho !== null) rhos.push(rho);
  }));
  return {
    rho: rhos.length ? rhos.reduce((n, x) => n + x, 0) / rhos.length : 0,
    situations: rhos.length,
    // **勝てた並びのうち、無傷だった割合。**天井と混同しないために両方出す
    costFree: wins ? winFlawless / wins : 0
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const FLAT = BASE.map(() => 1);
  const CAPS = BASE.map(e => Math.max(4, Math.round(e.hp / 3)));
  const name = ids => ids.map(i => LAWS[i].name).join("＋");
  const cases = [
    // いまの対で使っている法則の組を、敵の強さを振って見る
    ["蓄積＋過負荷", ["buildup", "overload"], 1, 1],
    ["蓄積＋過負荷 攻2倍", ["buildup", "overload"], 1, 2],
    ["蓄積＋過負荷 攻3倍HP半分", ["buildup", "overload"], 0.5, 3],
    ["継電＋先陣", ["relay", "vanguard"], 1, 1],
    ["継電＋先陣 攻3倍HP半分", ["relay", "vanguard"], 0.5, 3],
    ["過負荷＋減衰", ["overload", "fade"], 0.5, 1],
    ["過負荷＋減衰 攻3倍", ["overload", "fade"], 0.5, 3],
    ["共鳴＋減衰 攻3.2倍", ["resonance", "fade"], 0.5, 3.2]
  ];
  console.log("代償があるか（速さの順位と安全さの順位の相関）\n");
  console.log("  正 = 最良の並びが全部兼ねる（代償なし） / 負 = どちらかを諦める（代償あり）\n");
  console.log("  版                          相関   勝ちのうち無傷  局面数");
  for (const [label, laws, hp, atk] of cases) {
    const m = tradeoff({ laws, scales: FLAT.map(v => v * hp), atkScales: FLAT.map(v => v * atk),
      modScales: FLAT, cycleCaps: CAPS, phaseless: false }, 8);
    console.log(`  ${label.padEnd(24)} ${m.rho.toFixed(2).padStart(6)}   ${(m.costFree * 100).toFixed(0).padStart(10)}%   ${String(m.situations).padStart(5)}`);
  }
}
