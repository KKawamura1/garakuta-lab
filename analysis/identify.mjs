// **同定は可能か。**伏せた法則を、遊んで当てられるか。
//
// 同定ゲーム（NetHack 型、`analysis/KNOWLEDGE_SURVEY.md` の型2）が成り立つのは、
// **確かめる手段があるとき**だけである。手段が無ければ、それは当てずっぽうで、
// 13件から選ばせるのは知識ではなく運を試していることになる。
//
// 測り方：並びをK通り試したとして、**観測と矛盾しない法則の組が何通り残るか。**
//   1通りまで絞れる  … 同定できる。当てるのは知識である
//   何通りも残る      … 絞れない。当てさせるのは不当である
//
// 観測できるのは、遊ぶ側が実際に見られるものだけにする。
// **ただし「見られるもの」を狭く見積もっていた。**
//
// 位相表は、実機のログから各枠・各巡回の値を描いていて、
// **法則が掛けた倍率を `×2` のように出している**（`play/app.js` の cell-gain）。
// つまり遊ぶ側は勝敗と巡回数だけでなく、**どの枠のどの巡回に何倍が掛かったか**を見ている。
// それは法則の条件そのものなので、伏せる意味を大きく削る。
//
// `--gains` を付けると、その倍率まで観測に入れて測る。両方を出して比べること。
//
// **これは上限であって、人が当てられるかではない。**
// ここでの絞り込みは、91通り全部を完全な記憶と完全な再現で突き合わせている。
// 人はそんなことはしない。**「情報が盤面に載っているか」までしか言えていない。**
// 載っていなければ当てさせるのは不当だが、載っていても難しすぎることはあり得る。
// そこは遊んでもらって測る（`answers.guesses` に何回言ったかが残る）。

import { makeSimulate, scaleEnemies, LAW_IDS, LAWS, PARTS, SLOT_COUNT, BASE } from "../core/laws.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";

const MAX_HP = 30;
const ALL_PAIRS = [];
for (let i = 0; i < LAW_IDS.length; i += 1)
  for (let j = i + 1; j < LAW_IDS.length; j += 1) ALL_PAIRS.push([LAW_IDS[i], LAW_IDS[j]]);

// 遊ぶ側が見られるものだけを並べた指紋。
const WITH_GAINS = process.argv.includes("--gains");
// 倍率の札（×2）を伏せても、位相表は**枠ごと巡回ごとの実際の値**を出している。
// そこまでで絞れるのかを別に測る。
const WITH_CELLS = process.argv.includes("--cells");
const signature = (sim, orders, enemy) => orders.map(order => {
  const r = sim({ slots: order.map((t, i) => ({ id: `x${i}`, type: t })),
    hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1) });
  const base = `${r.won ? 1 : 0}/${r.cycles}/${r.hp}`;
  if (WITH_CELLS) {
    const cells = (r.log || []).filter(e => e.slot !== null && e.slot !== undefined)
      .map(e => `${e.slot}:${e.cycle}:${e.damage || 0}:${e.shieldGained || 0}`).join(",");
    return `${base}#${cells}`;
  }
  if (!WITH_GAINS) return base;
  // 位相表に出ている倍率（枠・巡回・倍率）。**画面に出ている以上、観測できている。**
  const gains = (r.log || []).filter(e => e.slot !== null && e.slot !== undefined && e.gain !== undefined)
    .map(e => `${e.slot}:${e.cycle}:${e.gain}`).join(",");
  return `${base}#${gains}`;
}).join("|");

export function identifiability(truth, spec, tries) {
  const enemy = scaleEnemies(spec.scales, spec.atkScales, spec.modScales, spec.cycleCaps)[0];
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
      && t.filter(x => PARTS[x].line === "guard").length >= 2
      && t.filter(x => PARTS[x].line === "service").length >= 1 }, { runs: 1 });
  const owned = (sets[0] || { owned: [] }).owned;
  if (owned.length < SLOT_COUNT) return null;

  // 試す並びは、**適当に並べ替えたもの**にする（遊ぶ側の最初の数手に近い）。
  const rng = makeRng(41);
  const orders = Array.from({ length: Math.max(...tries) }, () => {
    const pool = [...owned];
    const pick = [];
    for (let i = 0; i < SLOT_COUNT; i += 1) pick.push(...pool.splice(Math.floor(rng() * pool.length), 1));
    return pick;
  });

  const out = {};
  for (const k of tries) {
    const use = orders.slice(0, k);
    const want = signature(makeSimulate(truth), use, enemy);
    let survivors = 0;
    for (const pair of ALL_PAIRS) {
      if (signature(makeSimulate(pair), use, enemy) === want) survivors += 1;
    }
    out[k] = survivors;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const TRIES = [1, 3, 6, 12];
  console.log(`伏せた法則を、遊んで絞れるか（91通り中、観測と矛盾しない組の数）`
    + `${WITH_GAINS ? "　※位相表の倍率まで見た場合"
      : WITH_CELLS ? "　※位相表の枠ごとの値まで見た場合（倍率の札は伏せる）"
      : "　※勝敗・巡回・残HPだけ見た場合"}\n`);
  console.log(`  法則             ${TRIES.map(k => `${k}通り試す`.padStart(9)).join("")}`);
  const totals = {};
  TRIES.forEach(k => { totals[k] = []; });
  for (const v of LAW_TABLE) {
    const r = identifiability(v.laws, v, TRIES);
    if (!r) continue;
    TRIES.forEach(k => totals[k].push(r[k]));
    console.log(`  ${v.name.padEnd(14)} ${TRIES.map(k => String(r[k]).padStart(9)).join("")}`);
  }
  const mean = a => a.reduce((n, x) => n + x, 0) / a.length;
  console.log(`\n  平均           ${TRIES.map(k => mean(totals[k]).toFixed(1).padStart(9)).join("")}`);
  const solved = totals[TRIES[TRIES.length - 1]].filter(x => x === 1).length;
  console.log(`  ${TRIES[TRIES.length - 1]}通り試して1つに絞れた組: ${solved} / ${totals[TRIES[TRIES.length - 1]].length}`);
}
