// **噛み合わせの多さ**を測る。閃きの余地を数字にする試み。
//
// 作者の良かった瞬間はほぼ全部「閃き」だった。実例：
//   「そうか、一撃99の制限は2回攻撃なら198までいけるのか。知識アンロック！」
// これは**機構どうしの噛み合わせに気づくこと**である（敵の命中上限 × 部品の多段攻撃）。
//
// 測り方：ある並びの結果が、**法則を単独で使ったときの結果から予測できるか。**
//   予測できる（加法的）＝ 部品ごとに足し算すれば分かる ＝ 閃きの余地が小さい
//   予測できない（非加法的）＝ 組み合わせて初めて分かる ＝ 閃きの余地がある
//
// 具体的には、法則2つの組で出た与ダメージを、
//   法則なし・法則Aだけ・法則Bだけ の3つから予測した値と比べる。
//   予測: 法則なし + (Aだけ - なし) + (Bだけ - なし)  ← 効果が独立に足されるという仮定
// **実測がこれから離れるほど、噛み合っている。**

import { makeSimulate, scaleEnemies, LAW_IDS, LAWS, PARTS, SLOT_COUNT, BASE } from "../core/laws.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const CAP = 120;
function arrangementsOf(types, rng) {
  const counts = new Map(); types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()]; const out = [], cur = [];
  const walk = d => { if (out.length > 60000) return;
    if (d === SLOT_COUNT) { out.push([...cur]); return; }
    kinds.forEach(k => { if (!counts.get(k)) return;
      counts.set(k, counts.get(k) - 1); cur.push(k); walk(d + 1); cur.pop(); counts.set(k, counts.get(k) + 1); }); };
  walk(0);
  if (out.length <= CAP) return out;
  const picked = []; for (let i = 0; i < CAP; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
  return picked;
}

// 12巡ぶんの与ダメージ合計（HPを大きくして打ち切られないようにする）
function damageOf(sim, order, enemy) {
  const big = { ...enemy, hp: 1e9 };
  const r = sim({ slots: order.map((t, i) => ({ id: `x${i}`, type: t })),
    hp: SAFE_HP, maxHp: 30, enemy: big, rng: makeRng(1) });
  return 1e9 - r.enemyHp;
}

export function interaction(lawA, lawB, runs = 8) {
  const none = makeSimulate([]), onlyA = makeSimulate([lawA]), onlyB = makeSimulate([lawB]);
  const both = makeSimulate([lawA, lawB]);
  const enemies = scaleEnemies(1, 1, 1);
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
      && t.filter(x => PARTS[x].line === "guard").length >= 2
      && t.filter(x => PARTS[x].line === "service").length >= 1 }, { runs });
  let sumGap = 0, n = 0;
  enemies.forEach((enemy, i) => sets.filter(s => s.index === i).forEach(s =>
    arrangementsOf(s.owned, makeRng(s.run * 977 + i)).forEach(o => {
      const d0 = damageOf(none, o, enemy);
      const dA = damageOf(onlyA, o, enemy);
      const dB = damageOf(onlyB, o, enemy);
      const dAB = damageOf(both, o, enemy);
      const predicted = d0 + (dA - d0) + (dB - d0);
      if (predicted <= 0) return;
      // 予測からの外れを、予測に対する割合で見る（大きさに引きずられないように）
      sumGap += Math.abs(dAB - predicted) / predicted;
      n += 1;
    })));
  return n ? sumGap / n : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pairs = [];
  for (let i = 0; i < LAW_IDS.length; i += 1)
    for (let j = i + 1; j < LAW_IDS.length; j += 1) pairs.push([LAW_IDS[i], LAW_IDS[j]]);
  const rows = pairs.map(([a, b]) => ({ a, b, gap: interaction(a, b, 5) }));
  rows.sort((x, y) => y.gap - x.gap);
  const name = id => LAWS[id].name;
  console.log("法則2つの噛み合わせ（単独の効果を足した予測から、どれだけ外れるか）\n");
  console.log("■ 噛み合いが強い（閃きの余地が大きい）");
  rows.slice(0, 8).forEach(r => console.log(`  ${(name(r.a) + "＋" + name(r.b)).padEnd(12)} ${(r.gap * 100).toFixed(1)}%`));
  console.log("\n■ 噛み合いが弱い（足し算で分かる）");
  rows.slice(-8).forEach(r => console.log(`  ${(name(r.a) + "＋" + name(r.b)).padEnd(12)} ${(r.gap * 100).toFixed(1)}%`));
}
