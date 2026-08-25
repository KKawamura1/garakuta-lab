// 「反動打撃あれば何やっても勝てます」を測る（作者、2026-08-25、GRAFT 0.1）。
//
// 主張は**強い**ではなく**何をしても勝てる**である。だから測るのは
// 最善手の勝率ではなく、**でたらめに打ったときの勝率**にする。
// 適当に押しても勝てるなら、その戦闘に決定は存在しない。
//
//   node analysis/graft-dominance.mjs [試行数]

import { MUTATIONS, ACTIONS, ENEMIES, createGame, playAction, actionInfo } from "../graft/engine.mjs";

const TRIALS = Number(process.argv[2] || 400);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1戦だけを、でたらめな方針で戦う。接ぎ木は最初から付いている状態にする。
function randomBattle(seed, mutationId, actionId, enemyIndex) {
  const state = createGame(seed);
  // **敵は engine の作り方に合わせる。** ENEMIES の生データをそのまま入れると
  // `attackIndex` が無く、`attacks[undefined % n]` が NaN になって
  // 被害が一切入らなくなる（最初にそれで全部0%になった）。
  const source = ENEMIES[enemyIndex];
  state.enemy = { ...source, attacks: source.attacks.slice(), maxHp: source.hp, attackIndex: 0 };
  state.battleIndex = enemyIndex;
  if (mutationId) state.actions[actionId] = { mutation: mutationId };
  let s = state;
  const pick = rng(seed * 7919 + enemyIndex);
  let guard = 0;
  while (!s.done && s.phase === "battle" && guard < 40) {
    guard += 1;
    const legal = ACTIONS.map(a => a.id).filter(id => actionInfo(s, id).legal);
    if (!legal.length) break;
    const r = playAction(s, legal[Math.floor(pick() * legal.length)]);
    if (!r.ok) break;
    s = r.state;
  }
  return s.lastBattle?.won === true;
}

const rows = [];
const combos = [{ mutationId: null, actionId: "—" }];
for (const m of MUTATIONS) for (const a of ACTIONS) combos.push({ mutationId: m.id, actionId: a.id });

for (const combo of combos) {
  const perEnemy = ENEMIES.map((enemy, ei) => {
    let won = 0;
    for (let t = 0; t < TRIALS; t += 1) if (randomBattle(1000 + t, combo.mutationId, combo.actionId, ei)) won += 1;
    return { enemy: enemy.name, rate: won / TRIALS };
  });
  const overall = perEnemy.reduce((s, e) => s + e.rate, 0) / perEnemy.length;
  rows.push({ ...combo, overall, perEnemy });
}

const label = r => {
  if (!r.mutationId) return "接ぎ木なし";
  const m = MUTATIONS.find(x => x.id === r.mutationId);
  const a = ACTIONS.find(x => x.id === r.actionId);
  return `${m.name} → ${a.name}`;
};

rows.sort((x, y) => y.overall - x.overall);
console.log(`でたらめな方針の勝率（1戦あたり、${TRIALS}試行 × 敵${ENEMIES.length}体）\n`);
const width = Math.max(...rows.map(r => label(r).length));
for (const r of rows) {
  const bar = "█".repeat(Math.round(r.overall * 40));
  console.log(`${label(r).padEnd(width)}  ${(r.overall * 100).toFixed(1).padStart(5)}%  ${bar}`);
}

const base = rows.find(r => !r.mutationId);
console.log(`\n接ぎ木なしを基準にした差:`);
for (const r of rows) {
  if (!r.mutationId) continue;
  const d = (r.overall - base.overall) * 100;
  console.log(`  ${label(r).padEnd(width)}  ${d >= 0 ? "+" : ""}${d.toFixed(1)}pt`);
}

console.log(`\n敵ごとの内訳（上位3つ）:`);
for (const r of rows.slice(0, 3)) {
  console.log(`  ${label(r)}: ${r.perEnemy.map(e => `${e.enemy} ${(e.rate * 100).toFixed(0)}%`).join(" / ")}`);
}
