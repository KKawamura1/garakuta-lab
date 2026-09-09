// **画面が丸ごと消えても、構文検査は通る。**
//
// 2026-08-29、戦闘画面を書き直したときに、隣り合っていた
// renderBattleError / renderResult / renderReward / renderComplete の4画面を
// まとめて消してしまった。`node --check` は通る（残りは正しいJSなので）。
// 気づいたのはブラウザで開いて真っ白になったときで、それは通しを走らせるまで来ない。
//
// ここは押すたびに走る安い受け皿。画面の割り当て表と、押せるボタンの行き先が、
// 本当に存在するかだけを見る。
//
// **取り出せなかったら黙らずに落とす。**書き方を変えたらこの検査も直すこと
// （形だけ見る検査は、形が変わった瞬間に何も見なくなる）。

import { readFileSync } from "node:fs";

const app = readFileSync("ecology/app.js", "utf8");
const problems = [];

const skillTreeLayout = readFileSync("ecology/content/skill-tree-layout.mjs", "utf8");
const styles = readFileSync("ecology/styles.css", "utf8");
const displayContracts = [
  ["防壁バーのDOM", app, "unit-barrier-fill"],
  ["防壁比率の計算", app, "function barrierPercent(actor)"],
  ["防壁比率の上限", app, "Math.min(100, (barrier / maxHp) * 100)"],
  ["防壁バーのCSS", styles, ".unit-barrier-fill"],
  ["防壁バーをHPバー上へ配置", styles, "top: -3px"],
  ["装備摩耗ログの残耐久", app, '"の装備が耐久 " + values.before + "→" + values.after'],
  ["装備耐久切れの不発表示", app, '" · 耐久切れ、以後は不発"'],
  ["装備常時効果の耐久説明", app, "能力値補正は装着中の常時効果なので耐久を消費しません"],
  ["技能バッジの表示語", app, 'const kindLabels = { active: "アクティブ", reactive: "リアクティブ", passive: "パッシブ", equipment: "装備" };'],
  ["アクティブ欄の見出し", app, 'active: "アクティブ（順番）"'],
  ["リアクティブ欄の見出し", app, 'reactive: "リアクティブ"'],
  ["パッシブ欄の見出し", app, 'passive: "パッシブ（いつでも効く）"'],
  ["アクティブツリーのラベル", skillTreeLayout, 'label: "アクティブ"'],
  ["リアクティブツリーのラベル", skillTreeLayout, 'label: "リアクティブ"'],
  ["パッシブツリーのラベル", skillTreeLayout, 'label: "パッシブ"'],
  ["active の CSS クラス", styles, ".kind-active"],
  ["reactive の CSS クラス", styles, ".kind-reactive"],
  ["passive の CSS クラス", styles, ".kind-passive"],
];
for (const [label, sourceText, expected] of displayContracts) {
  if (!sourceText.includes(expected)) problems.push(label + "が見つからない");
}

const progressiveContracts = [
  ["戦闘タブの主操作", app, "primary-action map-primary-action"],
  ["結果画面の主操作", app, "primary-action result-primary-action"],
  ["敗北画面の主操作", app, "primary-action defeat-primary-action"],
  ["精算画面の主操作", app, "primary-action settlement-primary-action"],
  ["敵情報の折り畳み", app, "progressive-details enemy-details"],
  ["技能ツリーの折り畳み", app, "progressive-details skill-tree-details"],
  ["装備一覧の折り畳み", app, "progressive-details equipment-inventory"],
  ["主操作のCSS", styles, ".primary-action"],
  ["折り畳みのCSS", styles, ".progressive-details > summary"],
];
for (const [label, sourceText, expected] of progressiveContracts) {
  if (!sourceText.includes(expected)) problems.push(label + "が見つからない");
}
const mapRendererStart = app.indexOf("function renderMap()");
const mapRendererEnd = app.indexOf("\nfunction treatmentTargetIds", mapRendererStart);
if (mapRendererStart < 0 || mapRendererEnd < 0) {
  console.error("ecology-screens smoke: renderMap() の範囲を見つけられなかった。");
  process.exit(1);
}
const mapRenderer = app.slice(mapRendererStart, mapRendererEnd);
if (mapRenderer.indexOf("map-primary-action") > mapRenderer.indexOf("act-line")) {
  problems.push("戦闘タブの主操作が敵の概要より後ろにある");
}
if (!app.includes("status + nextBlock + stateCard")) {
  problems.push("結果画面の主操作が戦闘後詳細より前に配置されていない");
}
for (const [label, sourceText, forbidden] of [
  ["技能バッジの旧表示語", app, 'const kindLabels = { active: "行動"'],
  ["アクティブ欄の旧表示語", app, 'active: "行動（優先順）"'],
  ["リアクティブ欄の旧表示語", app, 'reactive: "反応"'],
  ["パッシブ欄の旧表示語", app, 'passive: "常設（いつでも効く）"'],
  ["アクティブツリーの旧表示語", skillTreeLayout, 'label: "行動"'],
  ["リアクティブツリーの旧表示語", skillTreeLayout, 'label: "反応"'],
  ["パッシブツリーの旧表示語", skillTreeLayout, 'label: "常設"'],
]) {
  if (sourceText.includes(forbidden)) problems.push(label + "が残っている");
}


// issue #205 — internal diagnostics must not occupy normal screen chrome.
// shell() wraps title, camp, battle, result and settlement, so checking this
// shared renderer covers every normal screen without duplicating assertions.
const shellSource = app.match(/function shell\([\s\S]*?\n\}\n\nfunction diagnosticStamp/);
if (!shellSource) {
  console.error("ecology-screens smoke: shell() / diagnosticStamp() を見つけられなかった。検査の書き方が古い。");
  process.exit(1);
}
for (const [label, forbidden] of [
  ["通常画面左上の内部版数", '<p class="kicker">'],
  ["通常画面下部の内部診断 footer", "<footer>遠征 "],
]) {
  if (shellSource[0].includes(forbidden)) problems.push(label + "が残っている");
}
if (!shellSource[0].includes("build-stamp") || !shellSource[0].includes(" hidden aria-hidden=")) {
  problems.push("E2E用build stampが視覚的に非表示になっていない");
}

// issue #222 — normal screens no longer inherit a generic title/subtitle chrome.
// The normal shell has no title parameters and never renders a header. The title
// screen uses a separate titleShell, so the exception is structural rather than
// a caller convention repeated across every normal screen.
const normalShellStart = app.indexOf("function shell(body, options = {})");
const titleShellStart = app.indexOf("function titleShell(title, subtitle, body)");
const diagnosticStampStart = app.indexOf("\nfunction diagnosticStamp", titleShellStart);
if (normalShellStart < 0 || titleShellStart < 0 || diagnosticStampStart < 0) {
  console.error("ecology-screens smoke: shell()/titleShell() の構造を見つけられなかった。検査の書き方が古い。");
  process.exit(1);
}
const normalShellSource = app.slice(normalShellStart, titleShellStart);
const titleShellSource = app.slice(titleShellStart, diagnosticStampStart);
if (normalShellSource.includes("<header")) {
  problems.push("通常画面用 shell() がヘッダーを生成している");
}
if (!titleShellSource.includes("<header") || !titleShellSource.includes("title-header")) {
  problems.push("タイトル画面用 titleShell() がタイトルヘッダーを生成していない");
}
if (app.includes("titleScreen:") || app.includes("shell(title, subtitle")) {
  problems.push("通常画面用 shell() にタイトル画面用の分岐または引数が戻っている");
}
if (!app.includes('return titleShell("One Battle Ahead", "",')) {
  problems.push("タイトル画面が titleShell() を使っていない");
}

// 画面固有の文脈は、共通ヘッダーを消しても失わない。
for (const [label, expected] of [
  ["戦闘画面の遭遇名", 'sectionHeading("BATTLE", "戦闘"'],
  ["結果画面の遭遇・ラウンド", "verdict-context"],
  ["キャンプ予測の遭遇名", "const encounterName = currentEncounter()?.name"],
]) {
  if (!app.includes(expected)) problems.push(label + "が見つからない");
}

for (const copy of [
  "この構成のままなら、この通りに終わります。",
  "装備は付け替え自由。",
]) {
  if (app.includes(copy)) problems.push("戦闘予測の冗長文が残っている: " + copy);
}

// issue #212 follow-up — stageEnd は精算カードへ複製せず、勝利するたびに通常の
// enterStory() へ入り、SKIP / AUTO / 再読み込み後も保存済みの精算へ戻る。
if (app.includes("function stageEndStorySection")) {
  problems.push("Stage終了会話の精算用story-cardレンダラーが残っている");
}
for (const [label, expected] of [
  ["Stage終了会話の通常レンダラー入口", 'enterStory([stageEndBeat], "settlement")'],
  ["Stage終了会話の常時表示判定", "const stageEndBeat = won && stage"],
  ["会話終了後の精算復帰", 'if (after === "settlement")'],
]) {
  if (!app.includes(expected)) problems.push(label + "が見つからない");
}
for (const [label, forbidden] of [
  ["開始会話の再訪省略", 'if (isCampaignStageCleared(state.profile, sequence)) return { beats: [], after: "camp" };'],
  ["幕間会話の再訪省略", "if (isCampaignStageCleared(state.profile, sequence)) return null;"],
  ["stageEndの再訪省略", "&& !isCampaignStageCleared(state.profile, state.run.campaignStageSequence)"],
  ["開始会話の既読省略", 'if (seen) return { beats: [], after: "camp" };'],
]) {
  if (app.includes(forbidden)) problems.push(label + "が残っている");
}
// issue #211 — ギルドへ入るたび最新の解禁Stageを選び、再訪もStage定義の
// 人数・同行者を保つ。旧「5人・自由編成」の表示とproduction経路を戻さない。
for (const [label, expected] of [
  ["最新の解禁Stageを初期選択", "const campaignStage = campaignStages[campaignStages.length - 1];"],
  ["再訪カードのStage人数", 'stage.partySize + "人・"'],
  ["再訪カードのStage同行者", 'stage.castCharacterIds.map(characterName).join("＋")'],
]) {
  if (!app.includes(expected)) problems.push(label + "が見つからない");
}
for (const forbidden of ["5人・自由編成で再訪", "ensureCampaignPartySize", "freeRoster:"]) {
  if (app.includes(forbidden)) problems.push("旧再訪経路が残っている: " + forbidden);
}

if (!app.includes("+ diagnosticStamp()")) {
  problems.push("build情報の診断先（技術ログ）が無い");
}

const defined = new Set([...app.matchAll(/^function ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
if (defined.size < 40) {
  console.error("ecology-screens smoke: 関数定義をほとんど取り出せなかった。検査の書き方が古い。");
  process.exit(1);
}

// 1. 画面の割り当て表。`render()` と `renderCamp()` が名前で画面を引いている。
const tables = [...app.matchAll(/const (views|view) = \{([\s\S]*?)\}\[?/g)];
if (tables.length < 2) {
  console.error("ecology-screens smoke: 画面の割り当て表を見つけられなかった。検査の書き方が古い。");
  process.exit(1);
}
let mapped = 0;
for (const [, name, body] of tables) {
  for (const [, key, target] of body.matchAll(/(\w+):\s*([A-Za-z_$][\w$]*)/g)) {
    mapped += 1;
    if (!defined.has(target)) problems.push(`${name} の ${key} が指す ${target}() が無い`);
  }
}
if (mapped < 10) {
  console.error(`ecology-screens smoke: 割り当てを${mapped}件しか取り出せなかった。検査の書き方が古い。`);
  process.exit(1);
}

// 2. 押せるボタンの行き先。button(ラベル, 行き先, ...) の行き先が
//    handleAction のどこかで受けられているか。受け手が無いボタンは黙って何もしない。
const actions = new Set([...app.matchAll(/\bbutton\(\s*(?:"[^"]*"|[^,]+),\s*"([a-z0-9-]+)"/g)].map((m) => m[1]));
const handled = new Set([...app.matchAll(/action === "([a-z0-9-]+)"/g)].map((m) => m[1]));
if (actions.size < 10 || handled.size < 10) {
  console.error(`ecology-screens smoke: ボタン${actions.size}件・受け手${handled.size}件しか取り出せなかった。`
    + "検査の書き方が古い。");
  process.exit(1);
}
for (const action of actions) {
  if (!handled.has(action)) problems.push(`ボタン "${action}" を受ける handleAction が無い（押しても何も起きない）`);
}

// 2b. button() を通さず data-action を直接書いた要素も同じ受け皿へ。
//     会話画面の「舞台を叩いて進む」のように、押せるのがボタンとは限らない。
const rawActions = new Set([...app.matchAll(/data-action=\\"([a-z0-9-]+)\\"/g)].map((m) => m[1]));
if (rawActions.size < 5) {
  console.error(`ecology-screens smoke: data-action を${rawActions.size}件しか取り出せなかった。検査の書き方が古い。`);
  process.exit(1);
}
for (const action of rawActions) {
  if (!handled.has(action)) problems.push(`data-action "${action}" を受ける handleAction が無い（触っても何も起きない）`);
}

// 3. 呼び先の実在。**「呼んでいるが、どこにも無い名前」を見る。**
//
//    140aa36 で isRecoverableStorageError が消え、呼び出しだけが2箇所残った。
//    保存枠が尽きたときにしか踏まれないので `node --check` も単体テストも通り、
//    公開先の通しが長い遠征のときだけ ReferenceError で落ちていた。
//    **黙って消えるのを防ぐのが、ここの仕事である。**
const source = app
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/"(?:[^"\\]|\\.)*"/g, '"S"')
  .replace(/'(?:[^'\\]|\\.)*'/g, "'S'")
  .replace(/`(?:[^`\\]|\\.)*`/g, "`S`");
const names = (pattern, pick = (m) => [m[1]]) => [...source.matchAll(pattern)].flatMap(pick);
const splitList = (m) => m[1].split(",").map((part) => part.trim().split(/[=:\s.[\]{}]/)[0]).filter(Boolean);
const known = new Set([
  ...names(/function\s+([A-Za-z_$][\w$]*)/g),
  ...names(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g),
  ...names(/import\s*\{([^}]*)\}/g, (m) => m[1].split(",")
    .map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean)),
  ...names(/\(([^()]*)\)\s*=>/g, splitList),
  ...names(/function\s*[A-Za-z_$\w]*\s*\(([^()]*)\)/g, splitList),
]);
// 言語と実行環境が用意している名前。**足りなければここへ足す。**
const ambient = new Set([
  "Object", "Array", "JSON", "Math", "Number", "String", "Boolean", "Date", "Map", "Set", "WeakMap",
  "Error", "Promise", "RegExp", "Symbol", "BigInt", "Intl", "TextEncoder",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
  "parseInt", "parseFloat", "isNaN", "isFinite", "structuredClone",
  "encodeURIComponent", "decodeURIComponent",
  "localStorage", "document", "window", "console", "fetch", "crypto", "navigator", "alert", "confirm",
  "if", "for", "while", "switch", "catch", "return", "typeof", "function", "await", "new",
  "case", "do", "else", "of", "in", "delete", "void", "yield", "throw", "super", "import",
]);
const callTargets = [...new Set(names(/(?<![.\w$?])([a-zA-Z_$][\w$]*)\s*\(/g))];
if (callTargets.length < 100) {
  console.error(`ecology-screens smoke: 呼び先を${callTargets.length}件しか取り出せなかった。検査の書き方が古い。`);
  process.exit(1);
}
for (const target of callTargets) {
  if (known.has(target) || ambient.has(target)) continue;
  problems.push(`${target}() を呼んでいるが、定義も import もどこにも無い（踏んだ瞬間に ReferenceError）`);
}

// 4. 予測と本番の入力が、同じ一箇所から出ていること（issue #148）。
//
//    engine を共有していても、**呼び出し側が違う options を渡せば予測と本番はずれる。**
//    実際に起きた壊れ方がそれで、本番だけ技能レベル（skillLevelsFor）を渡していない
//    期間があり、「予測どおりに強くならない」「予測と結果が合わない」が同時に出た
//    （PR #156）。engine 側の単体テストは両方とも通る——ずれは app.js の
//    **呼び出し2箇所のあいだ**にあるからである。だからここで、その2箇所が同じ
//    options 組み立てを通っていることだけを見る。
const forecastCall = source.match(/previewNextBattle\s*\(([\s\S]*?)\);/);
const productionCall = source.match(/simulateExpeditionBattle\s*\(([\s\S]*?)\);/);
if (!forecastCall || !productionCall) {
  console.error("ecology-screens smoke: 予測と本番の呼び出しを見つけられなかった。検査の書き方が古い。");
  process.exit(1);
}
const OPTIONS_BUILDER = "expeditionBattleOptions";
if (!source.includes("function " + OPTIONS_BUILDER)) {
  problems.push(`予測と本番が共有する options 組み立て ${OPTIONS_BUILDER}() が無い`);
}
if (!forecastCall[1].includes(OPTIONS_BUILDER)) {
  problems.push(`戦闘予測（previewNextBattle）が ${OPTIONS_BUILDER}() を通っていない`
    + "（予測だけ違う入力で走る）");
}
if (!productionCall[1].includes(OPTIONS_BUILDER)) {
  problems.push(`本番（simulateExpeditionBattle）が ${OPTIONS_BUILDER}() を通っていない`
    + "（本番だけ違う入力で走る）");
}
// 本番が足してよいのは、結果を変えない再生用オプションだけ。
const extraInProduction = productionCall[1]
  .replace(/[\s\S]*expeditionBattleOptions\s*\([^)]*\),/, "")
  .replace(/[{})\s,]/g, "");
if (extraInProduction && extraInProduction !== "simulationOptions:captureReplaySnapshots:true") {
  problems.push("本番だけが余分な戦闘入力を渡している: " + extraInProduction);
}

// 5. 予測 cache の鍵が、戦闘が読む欄を数え落としていないこと。
//    数え落とすと「変えたのに予測が動かない」になり、予測が壊れているのか
//    変わらないのかを画面から区別できない。
const forecastKeyBody = source.match(/function forecastKey\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
if (!forecastKeyBody) {
  console.error("ecology-screens smoke: forecastKey() を見つけられなかった。検査の書き方が古い。");
  process.exit(1);
}
for (const field of [
  "runSeed", "difficulty", "roster", "formation", "loadout", "currentHp",
  "runSkillLevels", "runUnlockedSkills", "equipmentDurability", "partySize",
]) {
  if (!forecastKeyBody[1].includes(field)) {
    problems.push(`forecastKey() が ${field} を数えていない（変えても予測が古いまま残る）`);
  }
}

// 6. 一時導線（issue #176）。**消す前提で入っているものを、消し忘れないための片側検査。**
//    `ecology/app.js` の TEMPORARY_DEBUG_ENTRIES と docs/OPERATIONS.md §3.1 の表を
//    突き合わせる。片方だけ消すとここで落ちるので、**宣言だけが残ることも、
//    導線だけが残ることも起きない。**
{
  const operations = readFileSync("docs/OPERATIONS.md", "utf8");
  const declared = [...app.matchAll(/id: "([a-z0-9-]+)",\n\s*label: "[^"]*",\n\s*reason:/g)]
    .map((match) => match[1]);
  const documented = [...operations.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((match) => match[1]);
  for (const id of declared) {
    if (!documented.includes(id)) {
      problems.push(`一時導線 "${id}" が TEMPORARY_DEBUG_ENTRIES にあるのに docs/OPERATIONS.md §3.1 の表に無い`);
    }
    if (!actions.has(id) && !rawActions.has(id)) {
      problems.push(`一時導線 "${id}" の宣言だけが残っている（画面の導線は既に消えている）`);
    }
  }
  for (const id of documented) {
    if (!declared.includes(id)) {
      problems.push(`docs/OPERATIONS.md §3.1 の "${id}" が app.js の TEMPORARY_DEBUG_ENTRIES に無い`);
    }
  }
}

// 7. 参照点。**片側だけでなく、鳴ることも確かめられる形にしておく。**
//    存在しない名前を混ぜたら必ず引っかかることを、ここで自己確認する。
if (defined.has("__surely_missing__")) {
  console.error("ecology-screens smoke: 参照点が壊れている。");
  process.exit(1);
}

if (problems.length) {
  console.error("ecology-screens smoke:\n  " + problems.join("\n  "));
  console.error("\n  画面か行き先が消えている。ブラウザでは真っ白になるが、構文検査では通る。");
  process.exit(1);
}

console.log(`ecology-screens smoke: 画面${mapped}件・ボタン${actions.size}件・data-action ${rawActions.size}件`
  + `・呼び先${callTargets.length}件の行き先がすべて存在する`);
