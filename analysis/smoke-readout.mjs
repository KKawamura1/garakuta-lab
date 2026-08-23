// **読み替えが、本物の戦闘と一致すること。**
//
// 調律器は「HP無限の的と一度戦った記録」から、任意の敵HP・任意の毎巡回復に対する
// 勝敗・残HP・巡回数を読み出す（`analysis/readout.mjs`）。速いが、**嘘をついても誰も気づかない。**
// 実際 2026-08-23 に嘘をつき、勝てない敵を出荷した。
//
// ここでは同じ盤面を **読み替えと本物の `simulateBattle` の両方で解いて、突き合わせる。**
// 回復のある敵（再生炉）を必ず含める——壊れたのはそこだったので。

import { makeSimulate, scaleEnemies, BASE, LAW_IDS, PARTS, SLOT_COUNT, MAX_CYCLES } from "../core/laws.mjs";
import { makeRng } from "../core/rng.mjs";
import { capacity, outcomeAt } from "./readout.mjs";

const fail = m => { console.error(`readout smoke: ${m}`); process.exit(1); };

const MAX_HP = 30;
const HP = 30;
const TYPES = Object.keys(PARTS);
const PAIRS = [["vanguard", "haste"], ["silence", "buildup"], ["relay", "reflect"], ["resonance", "overload"]];
PAIRS.forEach(pair => pair.forEach(id => { if (!LAW_IDS.includes(id)) fail(`知らない法則 ${id}`); }));

let compared = 0;
for (const laws of PAIRS) {
  const simulate = makeSimulate(laws, {});
  const rng = makeRng(7);
  for (let index = 0; index < BASE.length; index += 1) {
    for (let trial = 0; trial < 6; trial += 1) {
      const order = Array.from({ length: SLOT_COUNT }, () => TYPES[Math.floor(rng() * TYPES.length)]);
      // 敵の数値は「表に載りそうな範囲」で振る。上限は素のHPの1/5〜1/3。
      for (const hpScale of [0.8, 1.4, 2.2, 3.5]) {
        for (const capFrac of [1 / 5, 1 / 3]) {
          const base = BASE[index];
          const cycleCap = Math.max(4, Math.round(base.hp * capFrac));
          const template = { ...base, cycleCap };
          const shape = capacity(simulate, order, template, { hp: HP, maxHp: MAX_HP, seedRng: () => makeRng(1) });

          const h = Math.max(20, Math.round(base.hp * hpScale));
          const regen = base.regen ? Math.max(1, Math.round(base.regen * hpScale)) : 0;
          const read = outcomeAt(shape, h, regen, HP);

          const truth = simulate({
            slots: order.map((type, i) => ({ id: `x${i}`, type })),
            hp: HP, maxHp: MAX_HP, enemy: { ...template, hp: h, regen }, rng: makeRng(1)
          });
          compared += 1;
          const where = `${laws.join("+")} ${base.name} HP${h} 回復${regen} 上限${cycleCap} [${order.join(",")}]`;
          if (read.won !== truth.won) fail(`${where}：勝敗が違う（読み${read.won} 実機${truth.won}）`);
          if (read.cycles !== truth.cycles) fail(`${where}：巡回数が違う（読み${read.cycles} 実機${truth.cycles}）`);
          if (truth.won && read.hp !== Math.max(0, truth.hp)) fail(`${where}：残HPが違う（読み${read.hp} 実機${truth.hp}）`);
        }
      }
    }
  }
}

// 打切りの扱い。**12巡で終わる前提が崩れたら、上界の計算（smoke-feasible）も崩れる。**
if (MAX_CYCLES !== 12) fail(`打切りが ${MAX_CYCLES} 巡に変わっている。上界の検査を見直すこと`);

console.log(`readout smoke: 読み替えと実機が ${compared} 局面で一致 OK`);
