import { writeFileSync } from "node:fs";
import { makeSimulate, scaleEnemies, BASE, LAW_IDS, LAWS, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

// **評価器をゲームの部品にする。**
//
// 法則の組ごとに、敵の強さを合わせ、生成条件（P10のT1〜T3）と天井の条件（P12-b）を検証し、
// 通った組だけを表に書き出す。遊ぶ側はこの表からしか引かない。
// つまり「出してよい問題かどうか」の判定が、設計時の作業ではなく機械の一部になる。
//
// 第10回の失敗を繰り返さないため、**天井は「1試行あたりの率」ではなく
// 「探索者が1戦で到達する率」で見る**（#48）。実測の探索効率は無作為の約7倍、試行は1戦10回。

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [item, true];
}));
const setRuns = Number(args.sets || 8);
const cap = Number(args.cap || 120);
const target = Number(args.target || 0.15);
const EFFICIENCY = 7;
const TRIES = 10;
const reachable = p => 1 - (1 - Math.min(1, p * EFFICIENCY)) ** TRIES;

const MAX_HP = 30;

// 詰みの判定は標本では行えない。
// 90通りを抜き出して1つも勝てなくても、全体では1%が勝てるかもしれない（実際これで45組すべてを落とした）。
// **存在の判定は全列挙で、最初の勝ちで打ち切る。** 勝ち筋があれば早く終わり、
// 無いときだけ全部を見るので、確実性が要るところにだけ費用がかかる。
function hasAnyWin(types, simulate, enemy) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const cur = [];
  let found = false;
  const walk = d => {
    if (found) return;
    if (d === SLOT_COUNT) {
      const result = simulate({
        slots: cur.map((type, i) => ({ id: `x${i}`, type })),
        hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1)
      });
      if (result.won) found = true;
      return;
    }
    for (const k of kinds) {
      if (found) return;
      if (!counts.get(k)) continue;
      counts.set(k, counts.get(k) - 1);
      cur.push(k);
      walk(d + 1);
      cur.pop();
      counts.set(k, counts.get(k) + 1);
    }
  };
  walk(0);
  return found;
}

// 本当に全通り勝てるのか。負けが1つ見つかれば打ち切る。
function allWin(types, simulate, enemy) {
  const probe = makeRng(8181);
  for (let i = 0; i < 600; i += 1) {
    const pool = [...types];
    const pick = [];
    for (let k = 0; k < SLOT_COUNT; k += 1) pick.push(pool.splice(Math.floor(probe() * pool.length), 1)[0]);
    const result = simulate({
      slots: pick.map((type, n) => ({ id: `q${n}`, type })),
      hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1)
    });
    if (!result.won) return false;
  }
  return true;
}

function arrangements(types, rng) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [];
  const cur = [];
  const walk = d => {
    if (out.length > 60000) return;
    if (d === SLOT_COUNT) { out.push([...cur]); return; }
    kinds.forEach(k => {
      if (!counts.get(k)) return;
      counts.set(k, counts.get(k) - 1);
      cur.push(k);
      walk(d + 1);
      cur.pop();
      counts.set(k, counts.get(k) + 1);
    });
  };
  walk(0);
  if (out.length <= cap) return out;
  const picked = [];
  for (let i = 0; i < cap; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
  return picked;
}

// sets.mjs は ruleset の形を要求するので、法則の組ごとに最小限の姿を渡す。
const skeleton = { PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
  startContract: types => {
    const count = line => types.filter(t => PARTS[t].line === line).length;
    return count("strike") >= 3 && count("guard") >= 2;
  } };
const SETS = reachableSets(skeleton, { runs: setRuns });

function evaluate(simulate, enemies) {
  const winRates = [];
  const flawlessRates = [];
  const suspects = [];
  let dead = 0;
  let decided = 0;      // 0%でも100%でもない局面（順序が効く）
  let situations = 0;
  const shapes = [];
  SETS.forEach(situation => {
    const enemy = enemies[Math.min(situation.index, enemies.length - 1)];
    const rng = makeRng(situation.run * 977 + situation.index);
    const list = arrangements(situation.owned, rng);
    let won = 0;
    let flawless = 0;
    let best = null;
    list.forEach(order => {
      const result = simulate({
        slots: order.map((type, i) => ({ id: `x${i}`, type })),
        hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1)
      });
      if (!result.won) return;
      won += 1;
      if (result.hp >= SAFE_HP) flawless += 1;
      if (!best || result.hp > best.hp || (result.hp === best.hp && result.cycles < best.cycles)) {
        best = { hp: result.hp, cycles: result.cycles, order };
      }
    });
    situations += 1;
    const rate = won / list.length;
    winRates.push(rate);
    flawlessRates.push(flawless / list.length);
    // 探索中は標本だけで判定する。**正確な詰みの判定は、決めた倍率で一度だけ行う。**
    // 全列挙を探索の内側に置くと、探索が詰みの領域を探るたびに走って終わらない（実測で止まらなかった）。
    if (won === 0) { dead += 1; suspects.push({ situation, enemy }); }
    if (won > 0 && rate < 1) decided += 1;
    if (best) shapes.push(best.order);
  });
  const median = list => {
    const s = [...list].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const mean = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  return {
    winMedian: median(winRates),
    flawlessMean: mean(flawlessRates),
    safe: 1 - dead / situations,
    decided: decided / situations,
    suspects, shapes
  };
}

const label = { strike: "撃", guard: "守", service: "整" };
const shapeOf = order => {
  const lines = order.map(t => PARTS[t].line);
  return {
    composition: ["strike", "guard", "service"].map(l => `${label[l]}${lines.filter(x => x === l).length}`).join(""),
    periods: order.map(t => PARTS[t].period).join(",")
  };
};

const pairs = [];
for (let i = 0; i < LAW_IDS.length; i += 1) {
  for (let j = i + 1; j < LAW_IDS.length; j += 1) pairs.push([LAW_IDS[i], LAW_IDS[j]]);
}

const table = [];
const rejected = [];

// #33 の作法：詰みを作らない最大の倍率 Smax と、十分に締まる最小の倍率 Smin を**別々に**探す。
// 一つの探索に両方を詰め込むと、緩い端を選んで合格したつもりになる（今回もそれで45組すべてを落とした）。
// **敵ごとに別々の倍率を探す。**
// 全体を一つの倍率で動かすと、45組すべてで「締めると詰み」になった（Smax 0.6〜1.0 / Smin 1.0〜5.1）。
// RELAY 0.1 が通ったのは、敵ごとに倍率を振っていたからである（実測の比は 9.6/3.4/3.7/3.7/3.3/1.6 で、
// まったく一様ではない）。敵ごとなら1体ぶんの局面しか見ないので、探索は6倍ではなく逆に安くなる。
function evaluateEnemy(simulate, enemy, index) {
  const winRates = [];
  const flawlessRates = [];
  const suspects = [];
  const shapes = [];
  let decided = 0;
  let count = 0;
  SETS.filter(s => s.index === index).forEach(situation => {
    const rng = makeRng(situation.run * 977 + index);
    const list = arrangements(situation.owned, rng);
    let won = 0;
    let flawless = 0;
    let best = null;
    list.forEach(order => {
      const result = simulate({
        slots: order.map((type, i) => ({ id: `x${i}`, type })),
        hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1)
      });
      if (!result.won) return;
      won += 1;
      if (result.hp >= SAFE_HP) flawless += 1;
      if (!best || result.hp > best.hp || (result.hp === best.hp && result.cycles < best.cycles)) {
        best = { hp: result.hp, cycles: result.cycles, order };
      }
    });
    count += 1;
    const rate = won / list.length;
    winRates.push(rate);
    flawlessRates.push(flawless / list.length);
    if (won === 0) suspects.push(situation);
    if (won > 0 && rate < 1) decided += 1;
    if (best) shapes.push(best.order);
  });
  const median = list => { const t = [...list].sort((x, y) => x - y); return t.length ? t[Math.floor(t.length / 2)] : 0; };
  const mean = list => (list.length ? list.reduce((x, y) => x + y, 0) / list.length : 0);
  return {
    winMedian: median(winRates), flawlessMean: mean(flawlessRates),
    decided: count ? decided / count : 0, suspects, shapes, count
  };
}

// 敵HPは「勝てるかどうか」を、敵の攻撃力は「無傷で勝てるかどうか」を動かす。
// **目標が二つあるのだから、つまみも二つ要る。**
// HPだけで締めていたときは、20組が「天井が近い（無傷の到達率97〜100%）」だけで落ちた。
// 難易度が削り切りの競争になっているので、勝てる並びはたいてい無傷でも勝ってしまう。
// 攻撃力を上げると差がつく。T1（詰み）の判定は満タンでしか行わないので、以前恐れたほど危なくない。
function tuneEnemy(simulate, index) {
  const at = (scale, atkScale = 1) => {
    const enemy = { ...BASE[index] };
    enemy.hp = Math.max(20, Math.round(enemy.hp * scale));
    enemy.atk = Math.max(1, Math.round(enemy.atk * atkScale));
    if (enemy.floor) enemy.floor = Math.max(1, Math.round(enemy.floor));
    if (enemy.regen) enemy.regen = Math.max(1, Math.round(enemy.regen * scale));
    return { enemy, atkScale, ...evaluateEnemy(simulate, enemy, index) };
  };
  const isSafe = probe => !probe.suspects.some(s => !hasAnyWin(s.owned, simulate, probe.enemy));

  let lo = 0.5;
  let hi = 14;
  if (!isSafe(at(lo))) return { conflict: "最弱の敵でも詰みが出る" };
  for (let step = 0; step < 8; step += 1) {
    const mid = (lo + hi) / 2;
    if (isSafe(at(mid))) lo = mid; else hi = mid;
  }
  const smax = lo;

  lo = 0.5; hi = 14;
  for (let step = 0; step < 8; step += 1) {
    const mid = (lo + hi) / 2;
    if (at(mid).winMedian > target) lo = mid; else hi = mid;
  }
  const smin = hi;

  const scale = Math.min(smin, smax);

  // 攻撃力で天井を遠ざける。小さい方から試し、条件を満たした最初の値を採る。
  let best = at(scale);
  let atkScale = 1;
  for (const candidate of [1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6.5]) {
    const probe = at(scale, candidate);
    const safe = !probe.suspects.some(sp => !hasAnyWin(sp.owned, simulate, probe.enemy));
    if (!safe) break;
    best = probe;
    atkScale = candidate;
    if (reachable(probe.flawlessMean) <= 0.45 && probe.winMedian <= 0.30) break;
  }
  return { scale, atkScale, smin, smax, tight: smin <= smax, ...best };
}

function search(simulate) {
  const perEnemy = BASE.map((_, index) => tuneEnemy(simulate, index));
  if (perEnemy.some(e => e.conflict)) return { conflict: perEnemy.find(e => e.conflict).conflict };
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  return {
    scales: perEnemy.map(e => Number(e.scale.toFixed(2))),
    atkScales: perEnemy.map(e => e.atkScale),
    winMedian: mean(perEnemy.map(e => e.winMedian)),
    flawlessMean: mean(perEnemy.map(e => e.flawlessMean)),
    decided: mean(perEnemy.map(e => e.decided)),
    looseCount: perEnemy.filter(e => !e.tight).length,
    shapes: perEnemy.flatMap(e => e.shapes)
  };
}

pairs.forEach(pair => {
  const simulate = makeSimulate(pair);
  const name = pair.map(id => LAWS[id].name).join("＋");
  const found = search(simulate);
  if (found.conflict) { rejected.push({ pair, name, why: found.conflict }); return; }
  if (found.looseCount > 2) {
    rejected.push({ pair, name, why: `${found.looseCount}体で締めると詰みになる` });
    return;
  }

  const ceiling = reachable(found.flawlessMean);
  const reasons = [];
  if (found.winMedian > 0.30) reasons.push(`緩すぎる（勝てる並び ${(found.winMedian * 100).toFixed(0)}%）`);
  if (found.decided < 0.90) reasons.push(`順序が効かない（${(found.decided * 100).toFixed(0)}%）`);
  if (ceiling > 0.50) reasons.push(`天井が近い（無傷の到達率 ${(ceiling * 100).toFixed(0)}%）`);
  if (reasons.length) { rejected.push({ pair, name, why: reasons.join(" / ") }); return; }

  const shapes = found.shapes.map(shapeOf);
  const top = shapes.reduce((acc, sh) => { acc.set(sh.composition, (acc.get(sh.composition) || 0) + 1); return acc; }, new Map());
  const topShape = [...top.entries()].sort((a, b) => b[1] - a[1])[0];
  table.push({
    laws: pair, name, scales: found.scales, atkScales: found.atkScales,
    winMedian: Number(found.winMedian.toFixed(3)),
    flawlessReach: Number(ceiling.toFixed(3)),
    decided: Number(found.decided.toFixed(3)),
    topComposition: topShape ? topShape[0] : null,
    topCompositionShare: topShape ? Number((topShape[1] / shapes.length).toFixed(2)) : null
  });
});

table.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync("core/law-table.json", `${JSON.stringify(table, null, 1)}\n`);

console.log(`# ${pairs.length}組を検証 → 合格 ${table.length}組 / 不合格 ${rejected.length}組\n`);
console.log("合格した組");
table.forEach(row => console.log(
  `  ${row.name.padEnd(11)} HP×[${row.scales.join(",")}] 攻×[${row.atkScales.join(",")}]  勝てる並び ${(row.winMedian * 100).toFixed(1)}%`
  + `  無傷の到達 ${(row.flawlessReach * 100).toFixed(0)}%  順序が効く ${(row.decided * 100).toFixed(0)}%`
  + `  最頻のかたち ${row.topComposition}(${(row.topCompositionShare * 100).toFixed(0)}%)`));
console.log("\n不合格");
rejected.forEach(r => console.log(`  ${r.name.padEnd(11)} ${r.why}`));

const comps = new Map();
table.forEach(row => comps.set(row.topComposition, (comps.get(row.topComposition) || 0) + 1));
const best = [...comps.entries()].sort((a, b) => b[1] - a[1])[0];
if (best) {
  console.log(`\n## P12-a 型の転移`);
  console.log(`  合格した組の中で最頻の系統構成: ${best[0]}  ${(best[1] / table.length * 100).toFixed(0)}%`);
  console.log(`  （RELAY 0.1 の実測は60%。40%未満なら型が転移していない）`);
}
