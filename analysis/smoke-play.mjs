import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// 遊ぶ画面そのものの約束事。
// 版を画面に出していなかったせいで、保存済みセッションが古いルールのまま残り、
// 作者が「新しいゲームを開いたつもりで前のゲームを遊ぶ」状態になった。
// 版の表示と、画面からの切り替えは、機能ではなく事故防止なので固定する。

const html = readFileSync("play/index.html", "utf8");
const app = readFileSync("play/app.js", "utf8");

assert.match(html, /id="gameButton"/, "版を出すチップが要る");
assert.match(html, /id="gameDialog"/, "画面からゲームを切り替えられる必要がある");
assert.match(app, /\$\("#gameButton"\)\.textContent = rules\.id/, "チップにはルールセットの版を出す");
assert.match(app, /document\.title = /, "タブ名も版に追随させる");

// URL の ?ruleset= は進行中のランを乗っ取らない。ただし黙って無視もしない。
assert.match(app, /session\.actions\.length && urlRuleset/, "食い違いを検出している");
assert.match(app, /上のバージョン表示から切り替えられます/, "食い違いを画面で伝えている");

// ルールセット表に載っていないと、切り替えの選択肢に出てこない。
["relay: RELAY", "phase: PHASE", "arc: ARC"].forEach(entry => {
  assert.ok(app.includes(entry), `RULESETS に ${entry} が無い`);
});

// 既定は現時点の本命。ここを変えたら README の案内も変える。
assert.match(app, /params\.get\("ruleset"\) \|\| "relay"/, "新規セッションの既定は relay");

// 報酬を選ぶ画面に手持ちが出ていること。
// 作者が2ラン続けて「相変わらず今の手持ちが見えない」と書いた。継電は系統の並びで効くので、
// 何を持っているかが見えないと報酬を選べない。記憶ではなく情報の欠落である。
assert.match(app, /function holdingsCard\(/, "手持ちカードが要る");
assert.match(app, /out\.push\(holdingsCard\(o\)\);/, "報酬画面に手持ちを出す");
assert.match(app, /系統の内訳/, "系統の内訳を出す（継電の判断材料）");

// 法則機関は、まだ記録の無い組を優先して引く。
// これが「更新できる記録が尽きない」の実体であり、第10回で継続が止まった原因への対策である。
assert.match(app, /function pickVariant\(/, "法則の組を引く仕組みが要る");
assert.match(app, /const fresh = lawVariants\.filter\(v => !played\.has/, "未挑戦の組を優先する");

// 勝ち方の水準はルールセット側の判定を使う。画面の言葉と記録の水準がずれないように。
assert.match(app, /rules\.outcomeLevel\(result\.won, result\.hp, result\.cycles\)/, "巡回込みの判定を使う");

// 等級は罰ではなく志（P11）。外しても勝ちは勝ちで、ランは続く。
assert.match(app, /function recordBest\(/, "自己最高を残す");
assert.match(app, /localStorage\.setItem\(BEST_KEY/, "自己最高はランをまたいで残る");
assert.match(app, /この敵の自己最高/, "敵カードに自己最高を出す（狙う的）");
assert.ok(!/敗北.*罰|ペナルティ/.test(app), "等級に罰を紐づけない");

// 探索そのものの記録。これまで最終的な並びしか観測できていなかった。
assert.match(app, /function notePreview\(/, "試した並びを記録する");
assert.match(app, /type: "preview"/, "preview 行動として記録する");
assert.match(app, /session\.actions\.push\(\{ \.\.\.action, at: new Date\(\)\.toISOString\(\) \}\);/,
  "再生で消えないよう actions に入れる");

console.log("play smoke: 版の表示・ゲーム切り替え・食い違い通知・手持ち・等級と試行の記録 OK");
