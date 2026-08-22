// **締めつけの版が、代償を「請求」しているか。**
//
// 代償の版（COST 0.1）には抜け道があった。速く出すと自分が削れるが、
// **遅く行けば無傷でいられる**——実測で48ラン中46完走、平均残HP 30.0。
// つまり代償は、速さを欲しがったときにしか請求されなかった。
//
// 締めつけの版は毎巡回復で遅い方も塞ぐ。だからここで見るのは相関だけではなく、
// **無傷で勝てる並びがそもそも存在しない局面が多いこと**である。

import { measure } from "./pair-check.mjs";
import { tradeoff } from "./tradeoff.mjs";
import { makeSimulate, makeLawRuleset, scaleEnemies, OVERDRIVE, PARTS, SLOT_COUNT, BASE } from "../core/laws.mjs";
import { SQUEEZE_TABLE } from "../core/squeeze-table.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const fail = m => { console.error(`squeeze smoke: ${m}`); process.exit(1); };
if (!Array.isArray(SQUEEZE_TABLE) || SQUEEZE_TABLE.length < 4) fail("表が4組未満で、遊び分けにならない");

function perms(multiset, cap) {
  const out = [], cur = [], used = new Array(multiset.length).fill(false);
  const sorted = [...multiset].sort();
  const walk = () => {
    if (out.length >= cap) return;
    if (cur.length === sorted.length) { out.push([...cur]); return; }
    let last = null;
    for (let i = 0; i < sorted.length; i += 1) {
      if (used[i] || sorted[i] === last) continue;
      last = sorted[i]; used[i] = true; cur.push(sorted[i]); walk(); cur.pop(); used[i] = false;
    }
  };
  walk();
  return out;
}

const v = SQUEEZE_TABLE[0];
const spec = { laws: v.laws, scales: v.scales, atkScales: v.atkScales, modScales: v.modScales,
  cycleCaps: v.cycleCaps, overdrive: OVERDRIVE, regenFrac: v.regenFrac };

// 1. 壊れていないこと。
const m = measure(spec, 6);
if (m.T1 < 0.90) fail(`詰みが多すぎる（詰みなし ${(m.T1 * 100).toFixed(0)}%）`);
if (m.selectionLoose < 0.20) fail(`選べる部品が少なすぎる（${(m.selectionLoose * 100).toFixed(0)}%）`);

// 2. 代償があること（相関が負）。
const t = tradeoff(spec, 6);
if (t.rho > -0.05) fail(`代償が消えている（相関 ${t.rho.toFixed(2)}）`);

// 3. **代償が請求されること。**無傷で抜けられる局面が多すぎないこと。
{
  const sim = makeSimulate(v.laws, { overdrive: OVERDRIVE });
  const enemies = scaleEnemies(v.scales, v.atkScales, v.modScales, v.cycleCaps, v.regenFrac);
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: x => x.filter(y => PARTS[y].line === "strike").length >= 3
      && x.filter(y => PARTS[y].line === "guard").length >= 2
      && x.filter(y => PARTS[y].line === "service").length >= 1 }, { runs: 6 });
  let winnable = 0, flawless = 0;
  enemies.slice(0, 4).forEach((enemy, i) => sets.filter(s => s.index === i).forEach(s => {
    let any = false, flaw = false;
    perms(s.owned.slice(0, SLOT_COUNT), 40).forEach(order => {
      const r = sim({ slots: order.map((tp, k) => ({ id: `x${k}`, type: tp })),
        hp: SAFE_HP, maxHp: 30, enemy, rng: makeRng(1) });
      if (!r.won) return;
      any = true; if (r.hp >= SAFE_HP) flaw = true;
    });
    if (any) { winnable += 1; if (flaw) flawless += 1; }
  }));
  const rate = winnable ? flawless / winnable : 1;
  if (rate > 0.50) {
    fail(`無傷で抜けられる局面が ${(rate * 100).toFixed(0)}%。`
      + "遅く行けば削られないなら、代償は請求されていない（COST 0.1 がそうだった）");
  }
  // 4. 毎巡回復が実際に効いていること。**設定はあるのに 0 に丸められている、を防ぐ。**
  if (!(enemies[0].regen > 0)) fail("敵の毎巡回復が 0 になっている");
  const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps,
    { overdrive: OVERDRIVE, regenFrac: v.regenFrac });
  if (!rules.regenHint) fail("毎巡回復の説明が規則に入っていない");
  if (!/回復/.test(rules.rules)) fail("遊び方の文面に毎巡回復が書かれていない");
  if (rules.id.split(":")[0] !== "squeeze-0.1") fail(`版の名前が ${rules.id.split(":")[0]}`);
  console.log(`squeeze smoke: 相関 ${t.rho.toFixed(2)}、無傷で抜けられる局面 ${(rate * 100).toFixed(0)}%`
    + `、詰みなし ${(m.T1 * 100).toFixed(0)}%、毎巡回復 ${enemies[0].regen} OK`);
}
