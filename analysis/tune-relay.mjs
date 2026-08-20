import { writeFileSync } from "node:fs";
import { createRun } from "../core/run.mjs";
import { POLICIES } from "../agents/policies.mjs";
import { RELAY, ENEMIES as TUNED } from "../core/relay.mjs";
import { readFileSync as read } from "node:fs";

// 調律は素の数値から始める。調律済みの数値を土台にすると倍率が二重にかかる。
const BASE = JSON.parse(read(new URL("./relay-base-enemies.json", import.meta.url), "utf8"));
import { makeRng } from "../core/rng.mjs";
import { reachableSets, HP_POINTS, SAFE_HP } from "./sets.mjs";

// 敵の数値を、P10 の目標（勝てる並びの割合の中央値を各戦 5〜15% に）へ合わせて探索する。
// 手で振るのをやめる：第5回で「評価器が赤なのに読まなかった」失敗をしたので、
// **合格条件そのものを目的関数にして生成する。** これが企画の本題（評価器から作る）でもある。
//
// 手順：候補の敵数値で実際にプレイして局面（所持部品とHP）を集め、
// その局面で並びを全列挙し、勝てる割合の中央値を測り、二分探索で倍率を決める。

const { SLOT_COUNT, MAX_HP, PARTS } = RELAY;
const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [item, true];
}));
const seeds = Number(args.seeds || 12);
const cap = Number(args.cap || 2500);
const target = Number(args.target || 0.10);

function scaled(enemies, scales) {
  return enemies.map((e, i) => ({
    ...e,
    hp: Math.round(e.hp * scales[i].hp),
    atk: Math.round(e.atk * scales[i].atk),
    cap: e.cap >= 99 ? e.cap : Math.max(1, Math.round(e.cap * scales[i].atk)),
    floor: e.floor ? Math.max(1, Math.round(e.floor * scales[i].atk)) : e.floor,
    regen: e.regen ? Math.max(1, Math.round(e.regen * scales[i].hp)) : e.regen
  }));
}

function rulesWith(enemies) {
  return { ...RELAY, ENEMIES: enemies };
}

// 局面は難易度から独立に作る（analysis/sets.mjs の理由書きを参照）。
const SITUATIONS = reachableSets(RELAY, { runs: seeds * 4 });

function arrangementsOf(types, rng) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [];
  const current = [];
  const walk = depth => {
    if (out.length > 400000) return;
    if (depth === SLOT_COUNT) { out.push([...current]); return; }
    kinds.forEach(kind => {
      if (counts.get(kind) === 0) return;
      counts.set(kind, counts.get(kind) - 1);
      current.push(kind);
      walk(depth + 1);
      current.pop();
      counts.set(kind, counts.get(kind) + 1);
    });
  };
  walk(0);
  if (out.length <= cap) return out;
  const picked = [];
  for (let i = 0; i < cap; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
  return picked;
}

function winRate(situation, enemy) {
  const rng = makeRng(11);
  const list = arrangementsOf(situation.owned, rng);
  let won = 0;
  list.forEach(order => {
    const slots = order.map((type, i) => ({ id: `x${i}`, type }));
    if (RELAY.simulateBattle({ slots, hp: situation.hp, maxHp: MAX_HP, enemy, rng: makeRng(1) }).won) won += 1;
  });
  return { rate: won / list.length, any: won > 0 };
}

// 敵ごとに独立に締める。局面は難易度に依存しないので、順序の効果を気にしなくてよい。
//
// **敵HPだけを動かし、攻撃力は素のままにする。** 理由は測定から出た。
// 攻撃力を上げると「低HPで到達した局面が詰む」形で T1 が落ち、
// 一方で満タンHPの局面は緩いままなので T2 が通らない。つまり T1 と T2 が HP を挟んで反目する。
// 敵HPを上げた場合の敗因は「12巡で削り切れない」であり、これは**自分のHPに依存しない**。
// 難易度の軸を耐久から時間へ移すと、二つの条件は同時に満たせるようになる。
//
// 二つの条件を別々に探すのが要点である。以前は一つの二分探索に両方を詰め込み、
// 「締めすぎ」と「緩すぎ」を同じ枝で扱ったせいで、**緩い端を選んで合格したつもりになっていた。**
//   Smax = 詰みを作らない最大の倍率（T1の上限）
//   Smin = 中央値が目標以下になる最小の倍率（T2の下限）
// Smin ≤ Smax なら Smin を採る。逆なら**両立しない**ので、敵の数値では解けないと報告する。

const median = list => {
  const sorted = [...list].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};

function evaluate(index, scale) {
  const enemy = scaled(BASE, BASE.map((_, i) => (i === index ? { hp: scale, atk: 1 } : { hp: 1, atk: 1 })))[index];
  const rates = [];
  let dead = 0;
  let safeChecks = 0;
  SITUATIONS.filter(s => s.index === index).forEach(s => {
    HP_POINTS.forEach(hp => {
      const r = winRate({ ...s, hp }, enemy);
      rates.push(r.rate);
      // 詰みの判定は満タンでのみ行う（瀕死は負けていてよい）。
      if (hp === SAFE_HP) { safeChecks += 1; if (!r.any) dead += 1; }
    });
  });
  return { median: median(rates), safe: 1 - dead / Math.max(1, safeChecks) >= 0.99 };
}

const scales = BASE.map(() => ({ hp: 1, atk: 1 }));
const conflicts = [];
for (let index = 0; index < BASE.length; index += 1) {
  // Smax: 詰みが出ない最大倍率
  let lo = 1;
  let hi = 16;
  if (!evaluate(index, lo).safe) { conflicts.push(`${BASE[index].name}: 等倍でも詰みが出る`); continue; }
  for (let step = 0; step < 12; step += 1) {
    const mid = (lo + hi) / 2;
    if (evaluate(index, mid).safe) lo = mid; else hi = mid;
  }
  const smax = lo;
  // Smin: 中央値が目標以下になる最小倍率
  lo = 1; hi = 14;
  for (let step = 0; step < 10; step += 1) {
    const mid = (lo + hi) / 2;
    if (evaluate(index, mid).median > target) lo = mid; else hi = mid;
  }
  const smin = hi;
  if (smin > smax) {
    conflicts.push(`${BASE[index].name}: 締めると詰み（Smin ${smin.toFixed(2)} > Smax ${smax.toFixed(2)}）`);
    scales[index] = { hp: smax, atk: 1 };
  } else {
    scales[index] = { hp: smin, atk: 1 };
  }
  const e = scaled(BASE, scales)[index];
  const chosen = scales[index].hp;
  console.log(`${index + 1}戦目 ${BASE[index].name}: Smin ${smin.toFixed(2)} / Smax ${smax.toFixed(2)} → hp×${chosen.toFixed(2)} HP${e.hp} 攻${e.atk}${smin > smax ? "  ← 両立せず" : ""}`);
}
if (conflicts.length) {
  console.log("\n両立しなかった戦闘（敵の数値では解けない。引きの側の条件を疑う）:");
  conflicts.forEach(c => console.log(`  - ${c}`));
}

const finalEnemies = scaled(BASE, scales);
console.log("\n最終案:");
finalEnemies.forEach(e => console.log(`  ${e.name}: hp ${e.hp}, atk ${e.atk}, period ${e.atkPeriod}, cap ${e.cap}, floor ${e.floor}, regen ${e.regen || 0}`));
writeFileSync("analysis/relay-tuned-enemies.json", `${JSON.stringify(finalEnemies, null, 2)}\n`);
console.log("\n→ analysis/relay-tuned-enemies.json に書き出した");
