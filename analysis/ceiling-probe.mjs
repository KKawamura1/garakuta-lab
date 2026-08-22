// 天井（無傷の到達率）が、敵の数値でどこまで下がるのかを調べる**診断**。閾値は動かさない。
//
// とどめの巡回の修正後、91組すべてが天井で落ちた（93〜100%、要50%以下）。
// 「調律が粗い」のか「この設計では届かない」のかを切り分ける。
//
// 学び#52の最後の規則：**関門が満たせないとき、まず「既に良いと分かっているもの」を同じ関門にかける。**
// 参照点は RELAY 0.1（作者評価5・企画の記録）。RELAY も同じ天井で落ちるなら、
// 落ちているのは組ではなく**天井の条件と、それを動かす手段の対応**である。

import { makeSimulate, scaleEnemies, BASE, LAWS, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { PARTS as RPARTS, ENEMIES as RENEMIES, SLOT_COUNT as RSLOTS, simulateBattle as rsim,
  START_PARTS, RARE_RATE } from "../core/relay.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const MAX_HP = 30, DUMMY_HP = 1e9, CAP = 400;
const EFFICIENCY = 7, TRIES = 10;
const reachable = p => 1 - (1 - Math.min(1, p * EFFICIENCY)) ** TRIES;

function arrangementsOf(types, rng, slotCount) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [], cur = [];
  const walk = d => {
    if (out.length > 200000) return;
    if (d === slotCount) { out.push([...cur]); return; }
    kinds.forEach(k => {
      if (!counts.get(k)) return;
      counts.set(k, counts.get(k) - 1); cur.push(k);
      walk(d + 1);
      cur.pop(); counts.set(k, counts.get(k) + 1);
    });
  };
  walk(0);
  if (out.length <= CAP) return out;
  const picked = [];
  for (let i = 0; i < CAP; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
  return picked;
}

function capacity(simulate, order, enemyTemplate, parts) {
  const enemy = { ...enemyTemplate, hp: DUMMY_HP };
  const result = simulate({
    slots: order.map((type, i) => ({ id: `x${i}`, type })),
    hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1), parts
  });
  const events = [];
  result.log.forEach(e => { if (e.after) events.push({ dealt: DUMMY_HP - e.after.enemyHp, hp: e.after.hp }); });
  return events;
}
function outcomeAt(events, h) {
  for (const e of events) {
    if (e.dealt >= h) return { won: true, hp: Math.max(0, e.hp) };
    if (e.hp <= 0) return { won: false, hp: 0 };
  }
  return { won: false, hp: 0 };
}

// 一つの敵について、敵HPと攻撃力を振ったときの「無傷で勝てる並びの割合」を見る。
function sweep(label, simulate, parts, enemies, slotCount, sets, index, atkScales, hpScales) {
  const base = enemies[index];
  const situations = sets.filter(s => s.index === index);
  const rows = [];
  atkScales.forEach(atkScale => {
    const template = { ...base, atk: Math.max(1, Math.round(base.atk * atkScale)) };
    const caps = situations.map(s =>
      arrangementsOf(s.owned, makeRng(s.run * 977 + index), slotCount)
        .map(o => capacity(simulate, o, template, parts)));
    hpScales.forEach(hpScale => {
      const h = Math.max(20, Math.round(base.hp * hpScale));
      let winSum = 0, flawSum = 0, dead = 0;
      caps.forEach(list => {
        let won = 0, flaw = 0;
        list.forEach(c => { const r = outcomeAt(c, h); if (r.won) { won += 1; if (r.hp >= SAFE_HP) flaw += 1; } });
        winSum += won / list.length; flawSum += flaw / list.length;
        if (won === 0) dead += 1;
      });
      rows.push({ atkScale, hpScale, hp: h, atk: template.atk,
        win: winSum / caps.length, flawless: flawSum / caps.length,
        safe: 1 - dead / caps.length });
    });
  });
  console.log(`\n## ${label} / 敵${index + 1} ${base.name}（素 HP${base.hp} 攻${base.atk} 周期${base.atkPeriod}）`);
  console.log("  攻×   敵HP  攻   勝てる並び  無傷の並び  天井(換算)  詰みなし");
  rows.forEach(r => console.log(
    `  ${String(r.atkScale).padStart(4)}  ${String(r.hp).padStart(5)} ${String(r.atk).padStart(3)}`
    + `   ${(r.win * 100).toFixed(1).padStart(6)}%   ${(r.flawless * 100).toFixed(2).padStart(7)}%`
    + `   ${(reachable(r.flawless) * 100).toFixed(0).padStart(6)}%   ${(r.safe * 100).toFixed(1).padStart(6)}%`));
  return rows;
}

const HP_SCALES = [1, 1.5, 2, 3];
const ATKS = [1, 2, 3.2, 6, 10, 16];

// 1) 参照点：RELAY 0.1
const rskeleton = { PARTS: RPARTS, START_PARTS, RARE_RATE, ENEMIES: RENEMIES,
  startContract: t => t.filter(x => RPARTS[x].line === "strike").length >= 3
    && t.filter(x => RPARTS[x].line === "guard").length >= 2 };
const rsets = reachableSets(rskeleton, { runs: 12 });
[2, 4].forEach(i => sweep("RELAY 0.1（作者評価5）", rsim, RPARTS, RENEMIES, RSLOTS, rsets, i, ATKS, HP_SCALES));

// 2) 法則機関の一組
const skeleton = { PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
  startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
    && t.filter(x => PARTS[x].line === "guard").length >= 2 };
const sets = reachableSets(skeleton, { runs: 12 });
[2, 4].forEach(i =>
  sweep("LAWS / 単調＋偏食（落ちた中で天井が最も低い組）", makeSimulate(["monotony", "bias"]),
    PARTS, BASE, SLOT_COUNT, sets, i, ATKS, HP_SCALES));
