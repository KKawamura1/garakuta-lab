// **なぜつまらなくなったのか**を、記録から切り分ける。
//
// 作者：「最近ゲームがだいぶつまらなくなってきているので。」
// これは苦情ではなく**結果**である。ただし、原因の候補が2つあって、打つ手が正反対になる。
//
//   (a) **設計が平坦**……どう並べても勝ててしまう。→ ルールの側を変える
//   (b) **解かれた**………作者が型を見つけてしまった。→ 毎ランの問題が違っていない
//
// 見分け方：
//   (a) なら、**盤面の側**が易しい（勝てる並びの割合が高い）
//   (b) なら、盤面は易しくないのに**作者の手が同じ型へ寄る**（構成の収束・編集回数の減少）
//
// 使い方：`node analysis/boredom.mjs <書き出したJSONの道>`
// 書き出しは D1 から取る（`docs/OPERATIONS.md`）。**記録そのものはリポジトリに置かない**
// （公開リポジトリなので、自由記述がそのまま公開物になる）。

import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) { console.error("使い方: node analysis/boredom.mjs <runs.json>"); process.exit(1); }
const runs = JSON.parse(readFileSync(path, "utf8"))
  .filter(r => r.game_version)
  .sort((a, b) => a.started_at.localeCompare(b.started_at));

const pct = x => `${(x * 100).toFixed(0)}%`;
const mean = a => a.length ? a.reduce((n, x) => n + x, 0) / a.length : 0;

const rows = runs.map(r => {
  const s = JSON.parse(r.stats_json);
  const ev = JSON.parse(r.events_json);
  const battles = ev.filter(e => e.type === "battle_ended");
  const preds = ev.filter(e => e.type === "battle_predicted");
  const sur = s.surprise || { better: 0, expected: 0, worse: 0 };
  const surTotal = sur.better + sur.expected + sur.worse;
  const worry = s.worryCounts || {};
  const worryTotal = Object.values(worry).reduce((n, x) => n + x, 0);
  return {
    at: r.started_at.slice(11, 16),
    side: r.game_version.split(":")[1] || "?",
    battles: battles.length,
    // **驚き**：予告と結果が食い違った割合。0 なら、遊ぶ前に結果が分かっている
    surprised: surTotal ? (sur.better + sur.worse) / surTotal : 0,
    // **心配**：戦闘前に挙げた不安。「なし」しか出ないなら、危ないと思っていない
    worried: worryTotal ? 1 - (worry["なし"] || 0) / worryTotal : 0,
    flawless: s.flawlessBattleRate ?? 0,
    hpLost: battles.length ? mean(battles.map(b => (b.hpBefore ?? 0) - (b.hpAfter ?? 0))) : 0,
    // **手数**：1戦あたりの置き換え回数。解けているほど少ない手で決まる
    edits: preds.length ? mean(preds.map(p => p.editsSincePrevious ?? 0)) : 0,
    build: (JSON.parse(r.build_json || "[]") || []),
    top: (s.gateRanking || []).map(g => g.name)
  };
});

console.log("■ 1ランずつ（古い順）\n");
console.log("  時刻   側                 戦  驚き  心配  無傷  失点  手数  最終構成");
rows.forEach(r => console.log(
  `  ${r.at}  ${r.side.padEnd(16)} ${String(r.battles).padStart(2)}`
  + ` ${pct(r.surprised).padStart(5)} ${pct(r.worried).padStart(5)} ${pct(r.flawless).padStart(5)}`
  + ` ${r.hpLost.toFixed(1).padStart(5)} ${r.edits.toFixed(1).padStart(5)}  ${r.build.join("・")}`));

// ── 予告の的中：**押す前に結果が分かっているか**
//
// 標本が端（全部／ゼロ）を指したので、測り方の側を確かめた（`CLAUDE.md` の4規則の1）。
// 天井に張り付いて「上振れ」が測れないだけ、という疑いがあったが、**そうではなかった**：
// 4段階すべてで的中している（負けそう→敗北も、ギリギリ→ギリギリも当てている）。
console.log("\n■ 予告の的中 — 押す前に結果が分かっているか\n");
{
  const cells = new Map();
  let hit = 0, total = 0;
  runs.forEach(r => JSON.parse(r.events_json).filter(e => e.type === "battle_ended").forEach(e => {
    const k = `${e.expectedLevel}→${e.actualLevel}`;
    cells.set(k, (cells.get(k) || 0) + 1);
    total += 1; if (e.expectedLevel === e.actualLevel) hit += 1;
  }));
  console.log(`  ${hit} / ${total} 戦で、予告した水準と実際の水準が一致（${pct(hit / total)}）`);
  [...cells.entries()].sort().forEach(([k, n]) => console.log(`    ${k}  ${n}戦`));
  console.log("  ※ 4段階すべてで的中しているので、天井に張り付いて上振れが測れないだけ、ではない");
}

// ── (a) 平坦さ：勝って当たり前になっていないか
console.log("\n■ (a) 平坦さ — 遊ぶ前に結果が分かっているか\n");
const half = Math.floor(rows.length / 2);
const early = rows.slice(0, half), late = rows.slice(half);
const cmp = (label, f, fmt = pct) =>
  console.log(`  ${label.padEnd(14)} 前半 ${fmt(mean(early.map(f))).padStart(6)}   後半 ${fmt(mean(late.map(f))).padStart(6)}`);
cmp("驚いた割合", r => r.surprised);
cmp("心配した割合", r => r.worried);
cmp("無傷で勝った", r => r.flawless);
cmp("1戦の失点", r => r.hpLost, x => x.toFixed(1));

// ── (b) 収束：違う法則の組でも、同じ型へ寄っていないか
//
// **ここが (a) と (b) を分ける。**盤面が違う（法則も敵も違う）のに構成が同じなら、
// 易しいのではなく**同じ答えが通ってしまう**ということである。
console.log("\n■ (b) 収束 — 違う盤面でも同じ型に寄っていないか\n");
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter(x => B.has(x)).length;
  return inter / (new Set([...a, ...b]).size || 1);
};
const pairs = [];
for (let i = 0; i < rows.length; i += 1)
  for (let j = i + 1; j < rows.length; j += 1)
    if (rows[i].build.length && rows[j].build.length)
      pairs.push({ same: rows[i].side === rows[j].side, sim: jaccard(rows[i].build, rows[j].build) });
const sameSide = pairs.filter(p => p.same).map(p => p.sim);
const diffSide = pairs.filter(p => !p.same).map(p => p.sim);
console.log(`  最終構成の重なり（同じ側どうし） ${pct(mean(sameSide))}  （n=${sameSide.length}）`);
console.log(`  最終構成の重なり（違う側どうし） ${pct(mean(diffSide))}  （n=${diffSide.length}）`);
console.log("  ※ 違う側どうしでも重なるなら、**盤面が変わっても同じ答えが通っている**");

const counts = new Map();
rows.forEach(r => new Set(r.build).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
const used = rows.filter(r => r.build.length).length;
console.log(`\n  最終構成に入った回数（全 ${used} ラン中）`);
[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  .forEach(([t, n]) => console.log(`    ${t.padEnd(6)} ${String(n).padStart(2)}回  ${pct(n / used)}`));

console.log(`\n  1戦あたりの手数  前半 ${mean(early.map(r => r.edits)).toFixed(1)}  後半 ${mean(late.map(r => r.edits)).toFixed(1)}`);
