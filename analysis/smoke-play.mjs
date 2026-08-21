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

console.log("play smoke: 版の表示・ゲーム切り替え・URLの食い違い通知 OK");
