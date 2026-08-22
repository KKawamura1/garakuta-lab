// 締めつけの版（暴走＋毎巡回復）の表を、**直に測って**作る。
//
// **`tune-laws.mjs` の近道は使えない。** あちらは巨大HPの身代わりに1回だけ戦わせ、
// 累計ダメージからあらゆる敵HPの結果を読み出す。速いが、**毎巡回復とは両立しない**——
// 回復は「その敵の最大HP」で頭打ちになるので、身代わりの敵では頭打ちが起きず、
// 本物の敵の結果とずれる。**ずれた表は、静かに間違った実験を作る。**
// （この企画は一度それをやっている：とどめの巡回の敵の攻撃を数えていた誤り。）
//
// ここでは候補ごとに本物の敵で測る。遅いが、13組×数点なので数分で終わる。
//
// 通す条件：
//   1. 詰みなし ≥ 90%（**壊れた版はつまらなくて当たり前で、検証にならない**）
//   2. 選択に勝目 ≥ 20%（選べなさすぎない）
//   3. 速さと安全さの相関 ≤ −0.05（**代償があること**）
//   4. **無傷で勝てる並びが存在する局面 ≤ 40%（代償が「請求される」こと）**
//      ← これが COST 0.1 に足りなかった。遅く行けば無傷でいられた（実測：平均残HP 30.0）

import { writeFileSync } from "node:fs";
import { measure } from "./pair-check.mjs";
import { tradeoff } from "./tradeoff.mjs";
import { makeSimulate, scaleEnemies, OVERDRIVE, PARTS, SLOT_COUNT, BASE, LAWS } from "../core/laws.mjs";
import { COST_TABLE } from "../core/cost-table.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const RUNS = 6;
const HP_SCALES = [1.0, 0.8, 0.65];
const REGENS = [0.015, 0.025, 0.04];

function perms(multiset, cap) {
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

// **無傷で勝てる並びが存在する局面の割合。**代償が請求されるかは、ここで決まる。
function flawlessAvailability(laws, scales, atkScales, modScales, cycleCaps, regenFrac) {
  const sim = makeSimulate(laws, { overdrive: OVERDRIVE });
  const enemies = scaleEnemies(scales, atkScales, modScales, cycleCaps, regenFrac);
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
      && t.filter(x => PARTS[x].line === "guard").length >= 2
      && t.filter(x => PARTS[x].line === "service").length >= 1 }, { runs: RUNS });
  let winnable = 0, flawless = 0;
  enemies.slice(0, 4).forEach((enemy, i) => sets.filter(s => s.index === i).forEach(s => {
    let any = false, flaw = false;
    perms(s.owned.slice(0, SLOT_COUNT), 40).forEach(order => {
      const r = sim({ slots: order.map((t, k) => ({ id: `x${k}`, type: t })),
        hp: SAFE_HP, maxHp: 30, enemy, rng: makeRng(1) });
      if (!r.won) return;
      any = true;
      if (r.hp >= SAFE_HP) flaw = true;
    });
    if (any) { winnable += 1; if (flaw) flawless += 1; }
  }));
  return winnable ? flawless / winnable : 1;
}

const table = [];
const rejected = [];
console.log("締めつけの表を直に測って作る（暴走＋毎巡回復）\n");
console.log("  法則           HP倍率 回復   詰みなし 選択に勝目  相関  無傷が残る");

for (const v of COST_TABLE) {
  let best = null;
  for (const hp of HP_SCALES) {
    for (const regenFrac of REGENS) {
      const scales = v.scales.map(x => x * hp);
      const spec = { laws: v.laws, scales, atkScales: v.atkScales, modScales: v.modScales,
        cycleCaps: v.cycleCaps, overdrive: OVERDRIVE, regenFrac };
      const m = measure(spec, RUNS);
      if (m.T1 < 0.90 || m.selectionLoose < 0.20) continue;
      const t = tradeoff(spec, RUNS);
      if (t.rho > -0.05) continue;
      const flaw = flawlessAvailability(v.laws, scales, v.atkScales, v.modScales, v.cycleCaps, regenFrac);
      if (flaw > 0.40) continue;
      const row = { hp, regenFrac, m, t, flaw };
      // 無傷が残りにくいものを優先し、同点なら相関が強い方。
      if (!best || flaw < best.flaw || (flaw === best.flaw && row.t.rho < best.t.rho)) best = row;
    }
  }
  if (!best) { rejected.push(v.name); continue; }
  console.log(`  ${v.name.padEnd(12)} ${best.hp.toFixed(2)}  ${(best.regenFrac * 100).toFixed(1)}%`
    + ` ${(best.m.T1 * 100).toFixed(0).padStart(8)}% ${(best.m.selectionLoose * 100).toFixed(0).padStart(9)}%`
    + ` ${best.t.rho.toFixed(2).padStart(6)} ${(best.flaw * 100).toFixed(0).padStart(9)}%`);
  table.push({ laws: v.laws, name: v.name, scales: v.scales.map(x => Number((x * best.hp).toFixed(3))),
    atkScales: v.atkScales, modScales: v.modScales, cycleCaps: v.cycleCaps,
    regenFrac: best.regenFrac, rho: Number(best.t.rho.toFixed(3)), flawless: Number(best.flaw.toFixed(3)) });
}

console.log(`\n  通った組: ${table.length} / ${COST_TABLE.length}`);
if (rejected.length) console.log(`  落ちた組: ${rejected.join("、")}`);

if (table.length >= 4) {
  writeFileSync("core/squeeze-table.mjs",
    "// 締めつけの版の表。**analysis/tune-squeeze.mjs が生成する。手で編集しない。**\n"
    + "//\n// 暴走（速く出すと自分が削れる）と毎巡回復（遅いと削り切れない）で両側から挟む。\n"
    + "// 通す条件：詰みなし90%以上・選択に勝目20%以上・相関が負・**無傷が残る局面が40%以下**。\n\n"
    + `export const SQUEEZE_TABLE = ${JSON.stringify(table, null, 1)};\n\nexport default SQUEEZE_TABLE;\n`);
  console.log("\n  core/squeeze-table.mjs に書き出した。");
} else {
  console.log("\n  **表として成立しない（4組未満）。出さない。**");
}
