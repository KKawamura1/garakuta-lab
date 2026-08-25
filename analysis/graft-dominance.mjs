// 「反動打撃あれば何やっても勝てます」を測る（作者、2026-08-25、GRAFT 0.1）。
//
// 主張は**強い**ではなく**何をしても勝てる**である。だから測るのは
// 最善手の勝率ではなく、**でたらめに打ったときの勝率**にする。
// 適当に押しても勝てるなら、その戦闘に決定は存在しない。
//
//   node analysis/graft-dominance.mjs [試行数]
//
// engine を引数に取るので、`graft-handoff-whatif.mjs` から
// **改変版の engine を渡して同じ物差しで比べられる。**

import * as defaultEngine from "../graft/engine.mjs";

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
function randomBattle(engine, seed, grafts, enemyIndex) {
  const { ACTIONS, ENEMIES, createGame, playAction, actionInfo } = engine;
  const state = createGame(seed);
  // **敵は engine の作り方に合わせる。** ENEMIES の生データをそのまま入れると
  // `attackIndex` が無く、`attacks[undefined % n]` が NaN になって
  // 被害が一切入らなくなる（最初にそれで全部0%になった）。
  const source = ENEMIES[enemyIndex];
  state.enemy = { ...source, attacks: source.attacks.slice(), maxHp: source.hp, attackIndex: 0 };
  state.battleIndex = enemyIndex;
  for (const [actionId, mutationId] of Object.entries(grafts)) {
    if (mutationId) state.actions[actionId] = { mutation: mutationId };
  }
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

// `grafts` は 行動ID → 変異ID の対応。**複数の接ぎ木を同時に載せられる。**
// 一つずつしか載せない測り方だと、変異どうしの噛み合わせは原理的に測れない。
export function measureBuild(engine, grafts, trials) {
  const perEnemy = engine.ENEMIES.map((enemy, ei) => {
    let won = 0;
    for (let t = 0; t < trials; t += 1) if (randomBattle(engine, 1000 + t, grafts, ei)) won += 1;
    return { enemy: enemy.name, rate: won / trials };
  });
  return { grafts, overall: perEnemy.reduce((s, e) => s + e.rate, 0) / perEnemy.length, perEnemy };
}

export function measureAll(engine, trials) {
  const { MUTATIONS, ACTIONS } = engine;
  const combos = [{ mutationId: null, actionId: "—" }];
  for (const m of MUTATIONS) for (const a of ACTIONS) combos.push({ mutationId: m.id, actionId: a.id });
  return combos.map(combo => ({
    ...combo,
    ...measureBuild(engine, combo.mutationId ? { [combo.actionId]: combo.mutationId } : {}, trials)
  }));
}

export function labelOf(engine, r) {
  if (!r.mutationId) return "接ぎ木なし";
  const m = engine.MUTATIONS.find(x => x.id === r.mutationId);
  const a = engine.ACTIONS.find(x => x.id === r.actionId);
  return `${m.name} → ${a.name}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const trials = Number(process.argv[2] || 400);
  const rows = measureAll(defaultEngine, trials).sort((x, y) => y.overall - x.overall);
  const label = r => labelOf(defaultEngine, r);
  console.log(`でたらめな方針の勝率（1戦あたり、${trials}試行 × 敵${defaultEngine.ENEMIES.length}体）\n`);
  const width = Math.max(...rows.map(r => label(r).length));
  for (const r of rows) {
    console.log(`${label(r).padEnd(width)}  ${(r.overall * 100).toFixed(1).padStart(5)}%  ${"█".repeat(Math.round(r.overall * 40))}`);
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
}
