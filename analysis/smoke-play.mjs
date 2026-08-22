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
// 通った法則の組が無いときは遊べないので、その場合だけ RELAY に落ちること。
assert.match(app, /params\.get\("ruleset"\) \|\| defaultRuleset\(\)/, "新規セッションの既定は defaultRuleset");
assert.match(app, /return lawVariants\.length \? "laws" : "relay";/, "表が空なら遊べる版に落ちる");

// 報酬を選ぶ画面に手持ちが出ていること。
// 作者が2ラン続けて「相変わらず今の手持ちが見えない」と書いた。継電は系統の並びで効くので、
// 何を持っているかが見えないと報酬を選べない。記憶ではなく情報の欠落である。
assert.match(app, /function holdingsCard\(/, "手持ちカードが要る");
assert.match(app, /out\.push\(holdingsCard\(o\)\);/, "報酬画面に手持ちを出す");
assert.match(app, /系統の内訳/, "系統の内訳を出す（継電の判断材料）");

// 法則機関は、まだ記録の無い組を優先して引く。
// これが「更新できる記録が尽きない」の実体であり、第10回で継続が止まった原因への対策である。
assert.match(app, /function pickVariant\(/, "法則の組を引く仕組みが要る");
// **変数名ではなく、意味を見る。**以前は `lawVariants` という名前ごと書いてあったので、
// 引く表を版ごとに切り替えられるようにした（代償の版は別の表を使う）だけで落ちた。
// 検査が形を見ていると、形が変わっただけで黙るか、無関係に落ちる。
assert.match(app, /filter\(v => !played\.has\(v\.laws\.join/, "未挑戦の組を優先する");
// 版ごとに引く表が分かれていること。素の表を代償の版で使うと、実測で16組中15組が壊れる。
assert.match(app, /function variantsOf\(/, "版ごとに引く表を分ける");
assert.match(app, /COST_TABLE/, "代償の版の表を読み込む");
// **?ruleset= が保存済みセッションに負けないこと。**
// 対（?trial=）で同じ事故が起きている：URLで指したのに前のゲームが続き、
// 作者は3組ぶん、遊んだつもりのないものを遊んだ。版でも同じ形の穴が空いていた。
assert.match(app, /const wantedRuleset = params\.get\("ruleset"\)/, "URLの版を見る");
assert.match(app, /String\(saved\.ruleset\)\.toLowerCase\(\) !== wantedRuleset\.toLowerCase\(\)/,
  "保存済みと違う版を指されたら、指された方を始める");

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

// build の印が画面に出ていること。
// **規則の版だけでは「公開したものが届いたか」を作者が確かめられない**
// （規則を変えない公開では版が動かないので、古いキャッシュと見分けがつかない）。
{
  const head = readFileSync("play/app.js", "utf8");
  const html = readFileSync("play/index.html", "utf8");
  if (!/BUILD/.test(head)) { console.error("play smoke: build の印が画面に出ていない"); process.exit(1); }
  if (!/id="build"/.test(html)) { console.error("play smoke: build を出す場所が無い"); process.exit(1); }
  const { BUILD } = await import("../core/build.mjs");
  if (!/^[0-9a-f]{7,} \/ /.test(BUILD)) { console.error(`play smoke: build の印の形が違う（${BUILD}）`); process.exit(1); }
}

// **画面は、規則を自前で計算してはいけない。**
//
// 位相を外した版（T3のRecallテスト）で、数字は実機どおり1・3・5巡なのに
// **枠の色だけが位相ありの規則で塗られていた**（作者の報告、2026-08-22）。
// 画面が `core/project.mjs` の既定の `firesOn` を直接呼んでいて、
// ルールセットが別の判定を持っていることを知らなかった。
// **表示が規則と別の計算を持つと、静かにずれる。**（説明文と実装がずれるのと同じ形）
{
  const head = readFileSync("play/app.js", "utf8");
  const proj = readFileSync("core/project.mjs", "utf8");
  // 画面から既定の firesOn を直接呼んでいないこと。
  const bare = head.match(/[^a-zA-Z]firesOn\s*\(/g) || [];
  if (bare.length) {
    console.error(`play smoke: 画面が既定の firesOn を直接呼んでいる（${bare.length}箇所）。`
      + "ルールセットの判定（firesOfRuleset）を使うこと");
    process.exit(1);
  }
  if (!/firesOfRuleset/.test(head)) { console.error("play smoke: 画面が規則から作動判定を取っていない"); process.exit(1); }
  // 見積りの側も同じ。
  if (!/const fires = firesOfRuleset\(ruleset\)/.test(proj)) {
    console.error("play smoke: projectCycles が規則から作動判定を取っていない");
    process.exit(1);
  }
}

// **URL が指した対が、保存済みセッションに無視されないこと。**
//
// load() が保存済みをそのまま返していたので、t3 のセッションが残った状態で
// ?trial=t2 を開くと t3 が続いた。作者は t2 を遊ぶつもりで3組とも t3 を遊んだ（2026-08-22）。
// **実験の取り違えは、記録を汚すだけでなく、作者の時間を丸ごと無駄にする。**
{
  const head = readFileSync("play/app.js", "utf8");
  if (!/saved\.trial\?\.id !== wanted/.test(head)) {
    console.error("play smoke: ?trial= が保存済みセッションと食い違うときの分岐が無い");
    process.exit(1);
  }
  // 捨てる前に控えを取っていること。
  const load = head.slice(head.indexOf("function load()"), head.indexOf("function fresh("));
  if (!/ARCHIVE_KEY/.test(load)) {
    console.error("play smoke: 対を切り替えるとき、遊んだセッションを控えずに捨てている");
    process.exit(1);
  }
}

// **どの対を検証しているかを、遊ぶ側に見せない。**
//
// リンクで ?trial=t2 と指定していたので、作者にどの仮説を試しているか分かってしまい、
// 目隠しが壊れていた。1本のリンク（?study）にして、機械が割り振る。
{
  const head = readFileSync("play/app.js", "utf8");
  if (!/pickTrial/.test(head)) { console.error("play smoke: 対を機械が割り振っていない"); process.exit(1); }
  if (!/params\.has\("study"\)/.test(head)) { console.error("play smoke: ?study の入口が無い"); process.exit(1); }
  // 割り振りは、遊んだ組数の少ない対から。偏ると n が伸びない対ができる。
  const trial = readFileSync("core/trial.mjs", "utf8");
  if (!/Math\.min\(\.\.\.ids\.map/.test(trial)) {
    console.error("play smoke: 割り振りが「組数の少ない対から」になっていない");
    process.exit(1);
  }
  // 終わった組を続けないこと（続けると同じ対ばかり貯まる）。
  if (!/unfinished/.test(head)) { console.error("play smoke: 終わった組を続けない分岐が無い"); process.exit(1); }
}

console.log("play smoke: 版の表示・ゲーム切り替え・食い違い通知・手持ち・等級と試行の記録 OK");
