// **1ラン通して終われるか。**戦闘ごとに勝てても、ランとして成立するとは限らない。
//
// 代償の版は「速く倒すと自分が削れる」ので、**失点がランをまたいで積み上がる。**
// 回復は勝利ごとに +3 しかない。局面ごとの測定（`smoke-cost.mjs`）は
// **1戦ずつしか見ていない**ので、6戦を通したときにHPが尽きることは捕まえられない。
//
// ここでは、作者に近い方針で通しで遊ばせる：
//   勝てる並びのうち、**まず失点が少ないもの**（等級が失点で決まるので作者はこれを狙う）、
//   同点なら速いもの。
//
// 使い方： node analysis/run-viability.mjs

import { createRun } from "../core/run.mjs";
import { makeLawRuleset, OVERDRIVE, SLOT_COUNT } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { COST_TABLE } from "../core/cost-table.mjs";
import { allArrangements } from "../core/best-possible.mjs";
import { makeRng } from "../core/rng.mjs";

const SEEDS = [3, 11, 29, 47, 61, 83, 97, 131];

function playRun(rules, seed) {
  const run = createRun({ seed, playerId: "viability", ruleset: rules });
  for (let guard = 0; guard < 40; guard += 1) {
    const o = run.observe();
    if (o.phase === "end") break;
    if (o.phase === "reward") {
      const first = (o.offer || [])[0];
      if (!first) break;
      const r = run.act({ type: "take", choice: first.choice, reason: "", update: "confirmed", updateText: "" });
      if (!r.ok) break;
      continue;
    }
    // 構築：手持ちから、失点が最小の勝ち筋を選ぶ。
    const owned = [...o.slots.filter(x => x.part).map(x => x.part.type), ...o.inventory.map(p => p.type)];
    const enemy = rules.ENEMIES[o.battleNumber - 1];
    if (!enemy || owned.length < SLOT_COUNT) break;
    let best = null;
    for (const order of allArrangements(owned, SLOT_COUNT)) {
      const res = rules.simulateBattle({ slots: order.map((t, i) => ({ id: `x${i}`, type: t })),
        hp: o.hp, maxHp: o.maxHp, enemy, rng: makeRng(1) });
      if (!res.won) continue;
      if (!best || res.hp > best.res.hp || (res.hp === best.res.hp && res.cycles < best.res.cycles)) {
        best = { order, res };
      }
    }
    if (!best) return { reached: o.battleNumber, won: false, hp: o.hp, reason: "勝てる並びが無い" };
    // 盤面をその並びにする。
    o.slots.forEach((slot, i) => { if (slot.part) run.act({ type: "remove", slot: i + 1 }); });
    const after = run.observe();
    best.order.forEach((type, i) => {
      const part = run.observe().inventory.find(p => p.type === type);
      if (part) run.act({ type: "place", partId: part.id, slot: i + 1 });
    });
    void after;
    const b = run.act({ type: "battle", prediction: "圧勝", worry: "なし", worryText: "手応え:only" });
    if (!b.ok) return { reached: o.battleNumber, won: false, hp: o.hp, reason: b.error };
    if (!b.battle.won) return { reached: o.battleNumber, won: false, hp: b.battle.hpAfter, reason: "敗北" };
  }
  const end = run.observe();
  return { reached: end.battleNumber, won: end.phase === "end" && end.hp > 0, hp: end.hp, reason: "" };
}

function report(label, table, over) {
  const rows = [];
  for (const v of table.slice(0, 6)) {
    const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps,
      over ? { overdrive: over } : {});
    SEEDS.forEach(seed => rows.push(playRun(rules, seed)));
  }
  const cleared = rows.filter(r => r.won).length;
  const meanReach = rows.reduce((n, r) => n + r.reached, 0) / rows.length;
  const meanHp = rows.reduce((n, r) => n + r.hp, 0) / rows.length;
  console.log(`  ${label.padEnd(10)} 完走 ${cleared}/${rows.length}  平均到達 第${meanReach.toFixed(1)}戦  平均残HP ${meanHp.toFixed(1)}`);
  const why = {};
  rows.filter(r => !r.won).forEach(r => { why[r.reason] = (why[r.reason] || 0) + 1; });
  if (Object.keys(why).length) console.log(`             止まった理由: ${JSON.stringify(why)}`);
  return cleared / rows.length;
}

console.log("最善手で通したとき、1ランを終えられるか\n");
report("laws-0.3", LAW_TABLE, null);
report("COST 0.1", COST_TABLE, OVERDRIVE);
