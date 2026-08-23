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

// 3. **飛ばしたことが通報に載ること。**
// 載っていなければ、遊んでもらっても「1ランに1回くらい飛ぶ」という登録済みの予測を
// 記録から確かめられない。**測れない予測を登録しても、作者の時間を使うだけである。**
{
  // 通報の組み立てはブラウザの持ち物を触るので、最小限を用意する（smoke-sync と同じ形）。
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v))
  };
  Object.defineProperty(globalThis, "navigator", { value: { language: "ja-JP" }, configurable: true });
  globalThis.innerWidth = 390; globalThis.innerHeight = 844;
  globalThis.matchMedia = () => ({ matches: false });
  const { buildPayload } = await import("../agent-view/sync.js");
  // 通報の組み立てには進行の記録が要る。第1戦を1つ通した最小の形を作る。
  const v0 = LAW_TABLE[0];
  const rules0 = makeLawRuleset(v0.laws, v0.scales, v0.atkScales, v0.modScales, v0.cycleCaps, { skipWins: true });
  const probe = createRun({ seed: 5, playerId: "p", ruleset: rules0 });
  probe.observe().inventory.slice(0, SLOT_COUNT)
    .forEach((part, i) => probe.act({ type: "place", partId: part.id, slot: i + 1 }));
  probe.act({ type: "battle", prediction: "圧勝", worry: "なし", worryText: "手応え:only" });
  const fake = { runId: "r1", seed: 5, playerId: "p", ruleset: "skip", head: "play",
    startedAt: new Date(Date.now() - 6e4).toISOString(), endedAt: new Date().toISOString(),
    actions: [], trace: probe.trace(),
    // **最後に手で戦って連鎖が切れたラン**を模す。届いた最長は 3 だが、いまは 0 である。
    streak: 0, bestStreak: 3,
    skipLog: [{ enemy: "標的機", cycles: 5, hpAfter: 28, grade: "無傷", battleNumber: 2 }] };
  const payload = buildPayload(fake);
  if (!payload.answers || payload.answers.bestStreak !== 3) fail("届いた最長の連鎖が通報に載っていない");
  if (!payload.answers.skips || payload.answers.skips.length !== 1) fail("飛ばした戦闘が通報に載っていない");
  if (!/^skip-/.test(payload.gameVersion)) fail(`通報の版が ${payload.gameVersion}`);
}

// **連勝が「得点」になっていること**（SKIP 0.3、2026-08-23）。
//
// 飛ばしは元々「おまけ」で、ゲーム内の見返りが無い代わりに時間が浮く、という形だった。
// 記録がそれをひっくり返した：作者が5点を付けた唯一のランがこれで、
// 最良の瞬間も2ランとも strike そのものだった。**おまけを主菜にする。**
// ここでは、主菜になっていることを画面と規則の側から見る。
{
  const { readFileSync } = await import("node:fs");
  const app = readFileSync("play/app.js", "utf8");
  const v = LAW_TABLE[0];
  const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps, { skipWins: true });
  if (!/この版の得点は「連勝」である/.test(rules.rules)) fail("遊び方に「連勝が得点」と書いていない");
  if (!/伸ばすか、強くするか/.test(rules.rules)) fail("遊び方に取引（強くなる／続ける）が書いていない");
  if (!/構築画面に「飛ばす」が出る/.test(rules.rules)) fail("遊び方に、飛ばすのが自分の決定だと書いていない");
  // 記録は**組ごと**。敵ごとの等級と違って上が詰まっていないことが、この値の存在理由である。
  if (!/function streakKeyFor/.test(app)) fail("連勝の自己最高を残す口が無い");
  if (!/\$\{variant\}:連勝/.test(app)) fail("連勝の記録が組ごとに分かれていない");
  if (!/連勝 \$\{session\.streak \|\| 0\}/.test(app)) fail("帯に連勝が出ていない（見えない得点は狙えない）");
  if (!/最長連勝 \$\{reached\}/.test(app)) fail("ラン終わりに最長連勝が出ていない");
}

// **連勝が、狙って取る目標の大きさであること。**
//
// 全部の並びが2戦続くなら目標にならないし、一つも続かないなら目標にならない。
// 実測（`analysis/streak-space.mjs`）は「勝てる並びのうち2戦続くのは26%、
// その持ち物で届く最長は平均3.4戦」。ここでは端（0%と100%）だけを弾く。
{
  const v = LAW_TABLE[0];
  const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps, { skipWins: true });
  const run = createRun({ seed: 29, playerId: "smoke", ruleset: rules });
  const owned = run.observe().inventory.map(p => p.type);
  let wins = 0, chained = 0;
  allArrangements(owned, SLOT_COUNT).forEach(order => {
    const slots = order.map((type, i) => ({ id: `x${i}`, type }));
    const a = rules.simulateBattle({ slots, hp: rules.MAX_HP, maxHp: rules.MAX_HP, enemy: rules.ENEMIES[0], rng: makeRng(1) });
    if (!a.won) return;
    wins += 1;
    const b = rules.simulateBattle({ slots, hp: a.hp, maxHp: rules.MAX_HP, enemy: rules.ENEMIES[1], rng: makeRng(1) });
    if (b.won) chained += 1;
  });
  if (!wins) fail("第1戦に勝てる並びが一つも無い");
  const share = chained / wins;
  if (share === 0) fail("2戦続く並びが一つも無い（連勝が目標にならない）");
  if (share === 1) fail("勝てる並びが全部2戦続く（連勝が目標にならない）");
  console.log(`skip smoke: 勝てる並び${wins}通りのうち2戦続くのは ${(share * 100).toFixed(0)}%`);
}

const rate = carried / checked;
if (rate > 0.9) fail(`そのまま勝てる局面が ${(rate * 100).toFixed(0)}% で、遊ぶところが残らない`);
console.log(`skip smoke: そのままで次も勝てる局面は ${carried}/${checked}（${(rate * 100).toFixed(0)}%） OK`);
