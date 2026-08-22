// **回しているのか、狙っているのか。**
//
// 全期間の記録で「ガチャガチャ」は6回出てくる。**面白い側にも退屈な側にも出る。**
//   面白い：「ガチャガチャやりながら**最良を目指した**とき」「位相表を見ながら…わりと楽しい」
//   退屈　：「ガチャガチャやってたら**なんか勝てる**ので飽きてきた」「やっただけだけど、、、」
// 同じ行為で、分けているのは**何に向かって回しているか**だけである。
//
// 学び#46 でその見分け方を書いて、道具まで作ってあった：
//   > **停止規則こそが、考えているのか回しているのかを分ける。**
// `previewsAfterFirstWin`＝**勝てる並びを見つけた後も、まだ試したか。**
//   0 なら「勝てたからやめた」＝当たったら止まる ＝ 回しているだけ
//   多いなら「勝てたけど、もっと上を探した」＝ 狙っている
//
// **作ってから一度も読んでいなかった。**ここで読む。

import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) { console.error("使い方: node analysis/search-stop.mjs <runs.json>"); process.exit(1); }
const runs = JSON.parse(readFileSync(path, "utf8"))
  .filter(r => r.game_version).sort((a, b) => a.started_at.localeCompare(b.started_at));

const mean = a => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : 0);
const rows = [];

runs.forEach(r => {
  const ev = JSON.parse(r.events_json);
  ev.filter(e => e.type === "battle_ended").forEach(e => {
    rows.push({
      at: r.started_at.slice(11, 16),
      side: (r.game_version.split(":")[1] || "?"),
      tried: e.previewCount ?? 0,
      after: e.previewsAfterFirstWin ?? 0,
      won: Boolean(e.won),
      grade: e.grade || "",
      cycles: e.cycles
    });
  });
});

if (!rows.length) { console.log("preview の記録が無い（古い版のランだけかもしれない）"); process.exit(0); }

console.log("探索の停止の仕方（勝てる並びを見つけた後も試したか）\n");
console.log(`  戦闘数 ${rows.length}`);
console.log(`  1戦あたりの試行回数        ${mean(rows.map(r => r.tried)).toFixed(1)}`);
console.log(`  勝ちを見つけた後の試行回数  ${mean(rows.map(r => r.after)).toFixed(1)}`);

const stopped = rows.filter(r => r.after === 0).length;
console.log(`  **勝った瞬間にやめた戦闘    ${stopped} / ${rows.length}（${(stopped / rows.length * 100).toFixed(0)}%）**`);

// 前半と後半で、狙い方が変わったか。**飽きは停止の早さに出るはず。**
const half = Math.floor(rows.length / 2);
const early = rows.slice(0, half), late = rows.slice(half);
console.log("\n  　　　　　　　　　　　前半　　後半");
console.log(`  1戦あたりの試行　　　 ${mean(early.map(r => r.tried)).toFixed(1).padStart(5)} ${mean(late.map(r => r.tried)).toFixed(1).padStart(7)}`);
console.log(`  勝った後の試行　　　 ${mean(early.map(r => r.after)).toFixed(1).padStart(5)} ${mean(late.map(r => r.after)).toFixed(1).padStart(7)}`);
console.log(`  勝った瞬間にやめた率  ${(early.filter(r => r.after === 0).length / early.length * 100).toFixed(0).padStart(4)}% ${(late.filter(r => r.after === 0).length / late.length * 100).toFixed(0).padStart(6)}%`);

// 等級別。**最上位を取った戦闘は、取るまで探しているはず。**
console.log("\n  等級ごとの「勝った後の試行」");
const byGrade = new Map();
rows.filter(r => r.won).forEach(r => {
  if (!byGrade.has(r.grade)) byGrade.set(r.grade, []);
  byGrade.get(r.grade).push(r.after);
});
[...byGrade.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([g, list]) =>
  console.log(`    ${(g || "(無印)").padEnd(6)} ${mean(list).toFixed(1).padStart(5)}  （${list.length}戦）`));
