// 天井を「前の戦闘の型を持ち込んだプレイヤー」から測る。
//
// 【なぜ作り直すか】いまの関門は、各戦闘で**白紙のプレイヤーが並びを無作為に引く**と仮定し、
// 「無作為の7倍・10試行」で1戦あたりの到達率へ換算していた。予告は無傷26〜44%。
// **実測は50〜83%だった**（作者の4ラン）。しかも seed 43207 は6戦を通じて並べ替えが1回。
//
// 原因は分子ではなく分母だった。**作者は白紙から引いていない。前の戦闘で見つけた並びを
// そのまま持ち込んでいる。** だから試行回数が10でも、1回目がもう当たりである。
// 「1試行あたりの希少さ」を難易度として使う誤りは、第10回・第11回に続いて三度目になる。
//
// 【新しい測り方】プレイヤーの過程をそのまま回す。
//   1戦目：白紙から探す。
//   2戦目以降：**前戦の並びを最初に試す。** それで無傷なら、それ以上は探さない。
//   足りなければ、そこから**近い手**（枠の入れ替え／1個だけ差し替え）を試す。
//
// 探索の形は実測から取る：previewCount 39〜59 / 6戦 ＝ 1戦あたり7〜10試行。
// **自由な係数を実測に合わせて動かすことはしない。** 形だけ決めて、出てきた数字を実測と比べる。
//
// 【結果：これも外れた。記録として残す】
//   旧の測り方 26〜44% ／ この測り方 5〜9% ／ **実測 50〜83%**。
//   旧は過小、新はもっと過小。持ち込み仮説だけでは説明がつかなかった。
//
// 本当の理由は探索の巧拙ではなかった。**作者の戦闘は24戦中20戦が1巡で終わっており、
// 敵は巡回の終わりに殴るので、1巡で倒すと敵は一度も攻撃しない。**
//   1巡決着の20戦：85%が無傷 ／ 2巡以上の4戦：0%が無傷
// つまり無傷は防御で取られていたのではなく、**敵の行動前に殺すことで取られていた。**
// 報酬を一様乱択で引くこの測り方では、その火力の積み上げが再現できないので数字が出ない。
//
// **探索者の模型をいくら精緻にしても届かない。** 直すべきは測り方ではなく核の規則である。
// この道具は「持ち込みだけでは説明できない」ことを示した記録として残す。

import { makeSimulate, makeLawRuleset, PARTS, SLOT_COUNT, BASE } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const MAX_HP = 30;
export const TRIES_PER_BATTLE = 10;   // 実測の中央値（previewCount ÷ 6戦）

// 並びを一つ評価する。無傷 > 勝ち（残HPが多い順）> 負け（敵を削った順）。
function evaluate(simulate, order, enemy, parts) {
  const r = simulate({
    slots: order.map((type, i) => ({ id: `x${i}`, type })),
    hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1), parts
  });
  const flawless = r.won && r.hp >= SAFE_HP;
  const score = r.won ? 1e6 + r.hp * 1000 - r.cycles : -r.enemyHp;
  return { flawless, won: r.won, hp: r.hp, score };
}

// 近い手を作る：枠の入れ替え、または1枠を手持ちの別の部品へ差し替え。
function neighbours(order, owned, rng) {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    for (let j = i + 1; j < SLOT_COUNT; j += 1) {
      const next = [...order];
      [next[i], next[j]] = [next[j], next[i]];
      if (next.join() !== order.join()) out.push(next);
    }
  }
  const pool = [...owned];
  order.forEach(t => { const k = pool.indexOf(t); if (k >= 0) pool.splice(k, 1); });
  [...new Set(pool)].forEach(spare => {
    for (let i = 0; i < SLOT_COUNT; i += 1) out.push(order.map((t, k) => (k === i ? spare : t)));
  });
  // 順番は毎回変える（同じ手ばかり試すのを避ける）。
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const randomOrder = (owned, rng) => {
  const pool = [...owned];
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i += 1) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
};

// 1ランを最後まで回して、戦闘ごとに無傷へ届いたかを返す。
export function playRun(simulate, enemies, ownedByBattle, seed, parts = PARTS, tries = TRIES_PER_BATTLE) {
  const rng = makeRng(seed);
  let current = null;
  const results = [];
  enemies.forEach((enemy, index) => {
    const owned = ownedByBattle[index];
    let best = null;
    let used = 0;

    // **持ち込み。** 前戦の並びをまず試す。ここが今回の変更の核心である。
    if (current && current.every(t => owned.includes(t))) {
      best = { order: current, ...evaluate(simulate, current, enemy, parts) };
      used = 1;
    }
    if (!best) {
      best = { order: randomOrder(owned, rng), ...evaluate(simulate, randomOrder(owned, rng), enemy, parts) };
      best = { order: best.order, ...evaluate(simulate, best.order, enemy, parts) };
      used = 1;
    }

    // 無傷に届いていなければ、近い手を試す。届いたらそこで止める（作者は止めている）。
    while (used < tries && !best.flawless) {
      const cands = neighbours(best.order, owned, rng);
      let improved = null;
      for (const order of cands) {
        if (used >= tries) break;
        used += 1;
        const got = evaluate(simulate, order, enemy, parts);
        if (got.score > best.score) { improved = { order, ...got }; if (got.flawless) break; }
      }
      if (!improved) break;
      best = improved;
    }

    results.push({ flawless: best.flawless, won: best.won, tries: used });
    current = best.order;
  });
  return results;
}

// 表の各組について、持ち込み探索での無傷率を測る。
function measure(row, runs = 60) {
  const rules = makeLawRuleset(row.laws, row.scales, row.atkScales, row.modScales, row.cycleCaps);
  const simulate = makeSimulate(row.laws);
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
      && t.filter(x => PARTS[x].line === "guard").length >= 2 }, { runs });
  const perBattle = BASE.map(() => ({ flawless: 0, won: 0, n: 0 }));
  let runFlawlessRates = [];
  for (let r = 0; r < runs; r += 1) {
    const ownedByBattle = BASE.map((_, i) => sets.find(s => s.run === r && s.index === i).owned);
    const out = playRun(simulate, rules.ENEMIES, ownedByBattle, 5000 + r);
    out.forEach((o, i) => { perBattle[i].n += 1; if (o.flawless) perBattle[i].flawless += 1; if (o.won) perBattle[i].won += 1; });
    runFlawlessRates.push(out.filter(o => o.flawless).length / out.length);
  }
  const rates = perBattle.map(b => b.flawless / b.n);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  return { name: row.name, rates, worst: Math.max(...rates), runMean: mean(runFlawlessRates),
    old: row.flawlessReach };
}

console.log("持ち込み探索での無傷率（作者の実測 50〜83% と比べる）\n");
console.log("組           旧の予告   新の測定(1ランの無傷率)   戦闘ごと");
LAW_TABLE.forEach(row => {
  const m = measure(row);
  console.log(`${m.name.padEnd(9)} ${(m.old * 100).toFixed(0).padStart(6)}%   ${(m.runMean * 100).toFixed(0).padStart(10)}%`
    + `              [${m.rates.map(r => (r * 100).toFixed(0) + "%").join(" ")}]`);
});
