// **連勝の版が、実際に飛ばすか。**
//
// 飛ばしは「そのままの並びで次も勝てる」ときだけ起きる。つまり**勝てる盤面でしか起きない。**
// 手持ちを適当に並べた盤面はまず負ける（表は勝てる並びが5〜12%）ので、
// ブラウザで適当に触っても一度も起きない。**起きないものは、通っても何も言っていない。**
// ここでは勝てる並びを探してから、飛ばしの条件を確かめる。
//
// ついでに**頻度**も出す。1割なら演出の出番がほぼ無く、8割なら遊ぶところが残らない。

import { createRun } from "../core/run.mjs";
import { makeLawRuleset, SLOT_COUNT } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { allArrangements } from "../core/best-possible.mjs";
import { makeRng } from "../core/rng.mjs";

const fail = m => { console.error(`skip smoke: ${m}`); process.exit(1); };

// 1. 版として分かれていること。
{
  const v = LAW_TABLE[0];
  const plain = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps, {});
  const skip = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps, { skipWins: true });
  if (!skip.skipWins) fail("skipWins が規則に出ていない");
  if (plain.id.split(":")[0] === skip.id.split(":")[0]) fail("版の名前が素の版と同じ");
}

// 2. 勝てる並びで第1戦を抜けたあと、**そのままで第2戦も勝てる**局面が実際にあること。
let checked = 0, carried = 0;
for (const v of LAW_TABLE.slice(0, 6)) {
  const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps, { skipWins: true });
  for (const seed of [3, 11, 29, 47, 61]) {
    const run = createRun({ seed, playerId: "smoke", ruleset: rules });
    const o = run.observe();
    const owned = o.inventory.map(p => p.type);
    if (owned.length < SLOT_COUNT) continue;
    const enemy1 = rules.ENEMIES[0], enemy2 = rules.ENEMIES[1];
    if (!enemy2) continue;
    // 第1戦に勝てる並びを1つ見つける。
    const win = allArrangements(owned, SLOT_COUNT).find(order => rules.simulateBattle({
      slots: order.map((t, i) => ({ id: `x${i}`, type: t })), hp: o.hp, maxHp: o.maxHp,
      enemy: enemy1, rng: makeRng(1) }).won);
    if (!win) continue;
    const r1 = rules.simulateBattle({ slots: win.map((t, i) => ({ id: `x${i}`, type: t })),
      hp: o.hp, maxHp: o.maxHp, enemy: enemy1, rng: makeRng(1) });
    checked += 1;
    // **飛ばしの条件そのもの**（`trySkip` が見ているのと同じ判定）。
    const r2 = rules.simulateBattle({ slots: win.map((t, i) => ({ id: `x${i}`, type: t })),
      hp: r1.hp, maxHp: o.maxHp, enemy: enemy2, rng: makeRng(1) });
    if (r2.won) carried += 1;
  }
}
if (!checked) fail("勝てる並びを1つも見つけられず、条件を確かめられなかった");
if (!carried) fail("そのままで次も勝てる局面が一つも無い。飛ばしは一度も起きない");

const rate = carried / checked;
if (rate > 0.9) fail(`そのまま勝てる局面が ${(rate * 100).toFixed(0)}% で、遊ぶところが残らない`);
console.log(`skip smoke: そのままで次も勝てる局面は ${carried}/${checked}（${(rate * 100).toFixed(0)}%） OK`);
