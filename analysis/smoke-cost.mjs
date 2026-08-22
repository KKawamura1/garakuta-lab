// **代償の版が、代償のある版のままか。**
//
// 出荷しているのは「速く倒すと自分が削れる」版である。その主張は数字で言える：
// 勝てた並びの**速さの順位と安全さの順位の相関が負**であること。
// 正に戻っていたら、それは調律の事故ではなく**主張の消滅**なので、ここで落とす。
//
// 天井（珍しさ）と取り違えないこと。敵を強くすれば無傷は珍しくなるが、
// **相関は動かない**（実測：0.30→0.35）。珍しさは代償ではない（`analysis/TRADEOFF.md`）。

import { makeSimulate, makeLawRuleset, OVERDRIVE, BASE, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { measure } from "./pair-check.mjs";
import { tradeoff } from "./tradeoff.mjs";
import { makeRng } from "../core/rng.mjs";

const fail = m => { console.error(`cost smoke: ${m}`); process.exit(1); };
const FLAT = BASE.map(() => 1);
const CAPS = BASE.map(e => Math.max(4, Math.round(e.hp / 3)));
const LAWS_USED = ["buildup", "overload"];
const spec = over => ({ laws: LAWS_USED, scales: FLAT, atkScales: FLAT, modScales: FLAT,
  cycleCaps: CAPS, phaseless: false, overdrive: over });

// 1. 暴走ありで、相関が負であること。**これが版の主張そのもの。**
const withCost = tradeoff(spec(OVERDRIVE), 8);
if (!(withCost.rho <= -0.15)) {
  fail(`代償が消えている（相関 ${withCost.rho.toFixed(2)}、要 −0.15 以下）。`
    + "速い並びが安全な並びのままなら、諦めるものが無い");
}

// 2. 暴走なしでは正であること。**対の反対側が成立していないと、比べられない。**
const noCost = tradeoff(spec(null), 8);
if (!(noCost.rho > 0.1)) {
  fail(`代償なしの側の相関が ${noCost.rho.toFixed(2)}。対の反対側が反対になっていない`);
}

// 3. 壊れたゲームになっていないこと。**壊れたものがつまらないのは当たり前で、検証にならない。**
const m = measure(spec(OVERDRIVE), 8);
if (m.T1 < 0.90) fail(`詰みが多すぎる（詰みなし ${(m.T1 * 100).toFixed(0)}%）`);
if (m.selectionLoose < 0.20) fail(`選べる部品が少なすぎる（${(m.selectionLoose * 100).toFixed(0)}%）`);

// 4. 暴走が実際に発火すること。**設定はあるのに一度も鳴らない、を防ぐ。**
{
  const sim = makeSimulate(LAWS_USED, { overdrive: OVERDRIVE });
  const rules = makeLawRuleset(LAWS_USED, FLAT, FLAT, FLAT, CAPS, { overdrive: OVERDRIVE });
  const strike = Object.keys(PARTS).filter(t => PARTS[t].line === "strike");
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => ({ id: `x${i}`, type: strike[i % strike.length] }));
  const r = sim({ slots, hp: 30, maxHp: 30, enemy: rules.ENEMIES[0], rng: makeRng(1) });
  if (!(r.log || []).some(e => e.part === "暴走")) fail("撃部品だけで固めても暴走が一度も鳴らない");
  // 予告に出せること。**見えない代償は代償ではなく事故である。**
  if (!rules.overdriveHint) fail("暴走の説明（overdriveHint）が規則に入っていない");
}

// 5. 版の名前が分かれていること。**同じ名前で中身が違うのが一番たちが悪い。**
{
  const plain = makeLawRuleset(LAWS_USED, FLAT, FLAT, FLAT, CAPS, {}).id.split(":")[0];
  const cost = makeLawRuleset(LAWS_USED, FLAT, FLAT, FLAT, CAPS, { overdrive: OVERDRIVE }).id.split(":")[0];
  if (plain === cost) fail(`版の名前が同じ（${plain}）`);
}

console.log(`cost smoke: 代償あり ${withCost.rho.toFixed(2)} / なし ${noCost.rho.toFixed(2)}`
  + `（詰みなし ${(m.T1 * 100).toFixed(0)}%、勝ちのうち無傷 ${(withCost.costFree * 100).toFixed(0)}%） OK`);
