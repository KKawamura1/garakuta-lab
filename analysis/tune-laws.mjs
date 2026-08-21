import { writeFileSync } from "node:fs";
import { makeSimulate, scaleEnemies, BASE, LAW_IDS, LAWS, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

// 法則の組ごとに敵の数値を決める調律器（作り直し）。
//
// 前の版は敵HPの二分探索の各段で全局面を測り直していた。精度を上げると100分かかる。
// **やり方を変える：敵HPは、結果を「いつ何ダメージ届いたか」に読み替えれば、測り直さなくてよい。**
//
// 各並びを一度だけ「HPが無限の的」と戦わせ、巡回ごとの累計ダメージと自HPを記録する。
// すると敵HP=h に対する勝敗は、**累計ダメージが h を超える巡回が12巡以内にあり、
// その時点で自分が生きているか**を見るだけで分かる。二分探索が計算ゼロになる。
//
// 攻撃力は自分の生死を変えるので読み替えできない。候補を少数に絞って測り直す。
// **敵HPは「勝てるか」を、攻撃力は「無傷で勝てるか」を動かす**（第11回の知見）。

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [item, true];
}));
const setRuns = Number(args.sets || 20);
const cap = Number(args.cap || 300);
const TARGET = 0.15;          // T2：勝てる並びの割合の中央値をここへ寄せる
const MAX_HP = 30;
const DUMMY_HP = 1e9;
// 合格した6組はほぼ全部が上限の3.2を使っていた。**探索の端に張り付いているのは、
// 範囲が足りていない印である。** 上を伸ばす（閾値ではなく探索範囲の話なので、後出しの緩和ではない）。
const ATK_CANDIDATES = [1, 1.5, 2.2, 3.2, 4.5, 6];
const EFFICIENCY = 7;         // 実測の探索効率（無作為の何倍か）
const TRIES = 10;             // 1戦あたりの試行回数の実測中央値
const reachable = p => 1 - (1 - Math.min(1, p * EFFICIENCY)) ** TRIES;

// 登録した閾値（agents/PROTOCOL.md と analysis/smoke-gate.mjs で突き合わせている）
const T1_SAFE = 0.98;
// 登録文は「中央値が 5〜15%。全戦闘で 30% を超えない」の**二本立て**である。
// ここでは上限しか見ていなかった（T1・T3 と同じ、登録と実装の食い違い）。
const T2_BAND = [0.05, 0.15];
const T2_MAX = 0.30;
const T3_DECIDED = 0.95;
const CEILING = 0.50;

const skeleton = {
  PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
  startContract: types => {
    const count = line => types.filter(t => PARTS[t].line === line).length;
    return count("strike") >= 3 && count("guard") >= 2;
  }
};
const SETS = reachableSets(skeleton, { runs: setRuns });

if (setRuns < Math.ceil(1 / (1 - T3_DECIDED))) {
  console.error(`標本不足：敵1体あたり${setRuns}局面では「順序が効く${T3_DECIDED * 100}%以上」を判定できない。`);
  process.exit(2);
}

function arrangementsOf(types, rng) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [];
  const cur = [];
  const walk = d => {
    if (out.length > 200000) return;
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

// 一度の戦闘から、あらゆる敵HPに対する答えを引き出せる形にする。
// 返り値：killHp[c] = c巡目までに届いた累計ダメージ、aliveHp[c] = c巡目終了時の自HP。
function capacity(simulate, order, enemyTemplate) {
  const enemy = { ...enemyTemplate, hp: DUMMY_HP };
  const result = simulate({
    slots: order.map((type, i) => ({ id: `x${i}`, type })),
    hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1)
  });
  const dealt = [];
  const hp = [];
  let lastHp = SAFE_HP;
  result.log.forEach(entry => {
    if (!entry.after) return;
    const c = entry.cycle;
    dealt[c] = DUMMY_HP - entry.after.enemyHp;
    hp[c] = entry.after.hp;
    lastHp = entry.after.hp;
  });
  // 何も起きなかった巡回を埋める。
  for (let c = 1; c <= 12; c += 1) {
    if (dealt[c] === undefined) dealt[c] = c > 1 ? dealt[c - 1] : 0;
    if (hp[c] === undefined) hp[c] = c > 1 ? hp[c - 1] : SAFE_HP;
  }
  void lastHp;
  return { dealt, hp };
}

// 敵HP h に対する結果を、記録から読み出す。
function outcomeAt(cap0, h) {
  for (let c = 1; c <= 12; c += 1) {
    // その巡回に届いたなら、直前の巡回を生き延びていれば勝ち。
    if (cap0.dealt[c] >= h) {
      const aliveBefore = c === 1 ? true : cap0.hp[c - 1] > 0;
      if (!aliveBefore) return { won: false, hp: 0, cycles: c };
      return { won: true, hp: Math.max(0, cap0.hp[c]), cycles: c };
    }
    if (cap0.hp[c] <= 0) return { won: false, hp: 0, cycles: c };
  }
  return { won: false, hp: Math.max(0, cap0.hp[12]), cycles: 12 };
}

function measureEnemy(caps, hpScale, base) {
  const h = Math.max(20, Math.round(base.hp * hpScale));
  const rates = [];
  const flawlessRates = [];
  let dead = 0;
  let decided = 0;
  caps.forEach(list => {
    let won = 0;
    let flawless = 0;
    let all = true;
    list.forEach(c => {
      const r = outcomeAt(c, h);
      if (r.won) { won += 1; if (r.hp >= SAFE_HP) flawless += 1; } else all = false;
    });
    rates.push(won / list.length);
    flawlessRates.push(flawless / list.length);
    if (won === 0) dead += 1;
    else if (!all) decided += 1;
  });
  const median = a => { const t = [...a].sort((x, y) => x - y); return t[Math.floor(t.length / 2)]; };
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    hp: h,
    winMedian: median(rates), flawlessMean: mean(flawlessRates),
    safeRate: 1 - dead / caps.length, decidedRate: decided / caps.length
  };
}

function tuneEnemy(simulate, index) {
  const base = BASE[index];
  const situations = SETS.filter(s => s.index === index);
  const candidates = [];

  // **攻撃力の候補は全部試して、条件をいくつ満たすかで選ぶ。**
  // 早く抜けると、後の候補の方が良かった場合を取り逃す（前の版はそれで帯を外していた）。
  for (const atkScale of ATK_CANDIDATES) {
    const template = { ...base, atk: Math.max(1, Math.round(base.atk * atkScale)) };
    const caps = situations.map(s => {
      const rng = makeRng(s.run * 977 + index);
      return arrangementsOf(s.owned, rng).map(order => capacity(simulate, order, template));
    });

    let lo = 0.2;
    let hi = 40;
    for (let step = 0; step < 20; step += 1) {
      const mid = (lo + hi) / 2;
      if (measureEnemy(caps, mid, base).safeRate >= T1_SAFE) lo = mid; else hi = mid;
    }
    const smax = lo;
    lo = 0.2; hi = 40;
    for (let step = 0; step < 20; step += 1) {
      const mid = (lo + hi) / 2;
      if (measureEnemy(caps, mid, base).winMedian > T2_BAND[1]) lo = mid; else hi = mid;
    }
    const smin = hi;

    // 帯の中に収まる倍率を探す。詰みを作らない範囲で、いちばん締まるところ。
    const scale = Math.min(smin, smax);
    const found = { ...measureEnemy(caps, scale, base), atkScale, scale, smin, smax };
    found.score =
      (found.safeRate >= T1_SAFE ? 8 : 0)
      + (found.winMedian <= T2_BAND[1] && found.winMedian >= T2_BAND[0] ? 4 : 0)
      + (found.decidedRate >= T3_DECIDED ? 2 : 0)
      + (reachable(found.flawlessMean) <= CEILING ? 1 : 0);
    candidates.push(found);
  }
  candidates.sort((a, b) => b.score - a.score || a.winMedian - b.winMedian);
  return candidates[0];
}

const pairs = [];
for (let i = 0; i < LAW_IDS.length; i += 1) {
  for (let j = i + 1; j < LAW_IDS.length; j += 1) pairs.push([LAW_IDS[i], LAW_IDS[j]]);
}

const table = [];
const rejected = [];
pairs.forEach(pair => {
  const simulate = makeSimulate(pair);
  const name = pair.map(id => LAWS[id].name).join("＋");
  const perEnemy = BASE.map((_, index) => tuneEnemy(simulate, index));

  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const safeRate = mean(perEnemy.map(e => e.safeRate));
  const decided = mean(perEnemy.map(e => e.decidedRate));
  const winMedian = mean(perEnemy.map(e => e.winMedian));
  const ceiling = reachable(mean(perEnemy.map(e => e.flawlessMean)));

  const reasons = [];
  if (safeRate < T1_SAFE) reasons.push(`詰みが多い（${(safeRate * 100).toFixed(1)}%、要${T1_SAFE * 100}%）`);
  if (winMedian > T2_MAX) reasons.push(`どこかの戦闘が緩すぎる（${(winMedian * 100).toFixed(0)}%）`);
  else if (winMedian > T2_BAND[1]) reasons.push(`締まりが足りない（中央値 ${(winMedian * 100).toFixed(0)}%、要${T2_BAND[0] * 100}〜${T2_BAND[1] * 100}%）`);
  else if (winMedian < T2_BAND[0]) reasons.push(`締めすぎ（中央値 ${(winMedian * 100).toFixed(1)}%、要${T2_BAND[0] * 100}〜${T2_BAND[1] * 100}%）`);
  if (decided < T3_DECIDED) reasons.push(`順序が効かない（${(decided * 100).toFixed(0)}%、要${T3_DECIDED * 100}%）`);
  if (ceiling > CEILING) reasons.push(`天井が近い（${(ceiling * 100).toFixed(0)}%、要${CEILING * 100}%以下）`);
  if (reasons.length) { rejected.push({ name, why: reasons.join(" / ") }); return; }

  table.push({
    laws: pair, name,
    scales: perEnemy.map(e => Number(e.scale.toFixed(2))),
    atkScales: perEnemy.map(e => e.atkScale),
    enemyHp: perEnemy.map(e => e.hp),
    safeRate: Number(safeRate.toFixed(3)),
    winMedian: Number(winMedian.toFixed(3)),
    decided: Number(decided.toFixed(3)),
    flawlessReach: Number(ceiling.toFixed(3))
  });
});

table.sort((a, b) => a.name.localeCompare(b.name));
// .mjs で書き出す。JSON モジュール（import ... with { type: "json" }）は
// 端末によっては解釈できず、画面が丸ごと出なくなる（作者の iPhone で実際に起きた）。
writeFileSync("core/law-table.mjs",
  `// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**\n`
  + `//\n// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、\n`
  + `// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。\n\n`
  + `export const LAW_TABLE = ${JSON.stringify(table, null, 1)};\n\nexport default LAW_TABLE;\n`);

console.log(`# ${pairs.length}組を検証 → 合格 ${table.length}組 / 不合格 ${rejected.length}組\n`);
table.forEach(row => console.log(
  `  ${row.name.padEnd(11)} 敵HP[${row.enemyHp.join(",")}] 攻×[${row.atkScales.join(",")}]`
  + `  詰みなし ${(row.safeRate * 100).toFixed(1)}%  勝てる並び ${(row.winMedian * 100).toFixed(0)}%`
  + `  順序 ${(row.decided * 100).toFixed(0)}%  天井 ${(row.flawlessReach * 100).toFixed(0)}%`));
if (rejected.length) {
  console.log("\n不合格");
  rejected.forEach(r => console.log(`  ${r.name.padEnd(11)} ${r.why}`));
}
