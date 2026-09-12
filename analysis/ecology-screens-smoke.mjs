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
// R11 §5 改 — 序盤の手取りチュートリアルが教える一手は content が持つ（app.js には無い）。
const story = readFileSync("ecology/content/story.mjs", "utf8");
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
  ["アクティブ欄の見出し", app, 'active: "アクティブ"'],
  ["リアクティブ欄の見出し", app, 'reactive: "リアクティブ"'],
  ["パッシブ欄の見出し", app, 'passive: "パッシブ"'],
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

// PR #244 — ゲーム画面では拡大と文字選択を操作にしない。
// ただし通常の会話本文・履歴は読み返しのために選択を許す。許可を `.vn-text` の
// ような汎用クラスへ掛けると、巻き戻し演出や新しいモーダルで同じクラスを使った
// ときに選択が漏れるので、会話専用の `story-copy` だけを例外にする。
for (const [label, sourceText, expected] of [
  ["ゲームDOM全体の拡大抑止", styles, "#app,\n#app * {\n  touch-action: pan-x pan-y;"],
  ["ゲームDOM全体の文字選択抑止", styles, "#app,\n#app * {\n  -webkit-user-select: none;"],
  ["会話本文だけを選択許可", styles, "#app .story-copy,\n#app .story-copy *"],
  ["会話本文の選択許可を専用クラスで指定", app, 'class=\\"vn-text story-copy\\"'],
  ["会話履歴の選択許可を専用クラスで指定", app, 'class=\\"vn-log-body story-copy\\"'],
  ["長押し行内の通常操作を優先", app, 'target?.closest("button, input, textarea, select, a, [data-action]")'],
]) {
  if (!sourceText.includes(expected)) problems.push(label + "が無い");
}
for (const [label, sourceText, forbidden] of [
  ["汎用vn-textの選択許可", styles, "#app .vn-text"],
  ["汎用vn-noteの選択許可", styles, "#app .vn-note"],
  ["汎用vn-log-bodyの選択許可", styles, "#app .vn-log-body"],
]) {
  if (sourceText.includes(forbidden)) problems.push(label + "が残っている（新しい画面へ選択が漏れる）");
}
const mapRendererStart = app.indexOf("function renderMap()");
const mapRendererEnd = app.indexOf("\nfunction treatmentTargetIds", mapRendererStart);
if (mapRendererStart < 0 || mapRendererEnd < 0) {
  console.error("ecology-screens smoke: renderMap() の範囲を見つけられなかった。");
  process.exit(1);
}
const mapRenderer = app.slice(mapRendererStart, mapRendererEnd);
for (const [label, expected] of [
  ["マップのノード番号", "data-map-index"],
  ["マップの戦闘種別", "data-map-kind"],
  ["マップの進行状態", "data-map-status"],
  ["マップノードのアクセシブルな状態", "aria-label"],
  ["マップの現在地指定", "aria-current"],
  ["マップの精鋭・ボス記号", "map-kind-badge"],
  ["マップの凡例", "map-legend"],
  ["マップの未到達状態", "unreached"],
]) {
  if (!mapRenderer.includes(expected)) problems.push(label + "が無い");
}
for (const forbidden of [
  ".map-node.kind-elite { border-color:",
  ".map-node.kind-boss { border-color:",
]) {
  if (styles.includes(forbidden)) problems.push("種別の枠が現在地の枠と競合する定義が残っている: " + forbidden);
}
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
const shellStart = app.indexOf("function shell(body, options = {})");
const titleShellStartForDiagnostics = app.indexOf("function titleShell(title, subtitle, body)", shellStart);
const shellSource = shellStart >= 0 && titleShellStartForDiagnostics > shellStart
  ? [app.slice(shellStart, titleShellStartForDiagnostics)]
  : null;
if (!shellSource) {
  console.error("ecology-screens smoke: 通常用 shell() / titleShell() の境界を見つけられなかった。検査の書き方が古い。");
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

// 6b. 仲間の共通盤面（issue #159）。**キャンプで仲間を選ぶ経路は一つしかない。**
//
//     以前は同じ仲間を選ぶ表示が四つあった（上端の予測チップ・編成タブの隊列盤と
//     キャラクターカード・技能タブの仲間タブ・装備タブの仲間タブ）。**二つ目が
//     戻ってきても構文検査は通る**ので、ここで片側検査として塞ぐ。
//     ブラウザでの実挙動（隊列交換・対象切替・治療の対象選択）は
//     analysis/ecology-tutorial-trial.mjs が踏む。
{
  const campStart = app.indexOf("function renderCamp() {");
  const boardStart = app.indexOf("function partyCellRole(mode, position, characterId) {");
  const barStart = app.indexOf("function partyBar(tab) {");
  if (campStart < 0 || boardStart < 0 || barStart < 0) {
    console.error("ecology-screens smoke: 共通盤面（partyBar / partyCellRole）を見つけられなかった。"
      + "検査の書き方が古い。");
    process.exit(1);
  }
  for (const [label, expected] of [
    ["キャンプ上端が共通盤面を出している", "partyBar(activeTab) + campNav()"],
    ["盤面の並びが POSITIONS から出ている", "POSITIONS.filter((position) => position.startsWith(row"],
    // issue #235 — 盤面の役はタブではなく boardMode が決める。編成タブは廃止した。
    ["盤面の役が boardMode から出ている", "function boardMode(tab)"],
    ["隊列モードのセルが隊列操作", 'action: "place-character"'],
    ["通常のセルが人物選択", 'action: "select-character"'],
    ["治療中のセルが対象選択", 'action: "select-treatment-target"'],
    ["どのタブからも隊列へ入れる", 'data-action=\\"toggle-formation-mode\\"'],
    ["予測の勝敗・ラウンド数", "forecast.roundsUsed"],
  ]) {
    if (!app.includes(expected)) problems.push(label + "が見つからない");
  }
  // 予測が読む DOM。**通しの検査（ecology-trial）がこの名前で数字を取り出す。**
  for (const expected of ["forecast-member-head", "forecast-hp-values", "forecast-delta", "forecast-hp-bar"]) {
    if (!app.includes(expected) || !styles.includes("." + expected)) {
      problems.push(`予測セルの ${expected} が画面かCSSから消えている`);
    }
  }
  // 補給タブは、治療を選んでいないあいだセルを押せない（誰を選ぶ場面でもない）。
  // issue #235 — この判定は boardMode へ移した（役はタブではなく盤面の状態で決まる）。
  const modeStart = app.indexOf("function boardMode(tab) {");
  const roleBody = app.slice(modeStart, barStart);
  if (!roleBody.includes('return tab === "supplies" ? "none" : "select";')) {
    problems.push("補給タブのセルが、治療を選んでいなくても押せる形になっている");
  }
  if (!roleBody.includes("treatmentTargetIds(treatment).includes(characterId)")) {
    problems.push("治療の対象外セルが押せない状態で残る判定が無い");
  }
  // 二つ目の仲間選択がキャンプへ戻っていないこと。**guild 画面の仲間タブは対象外**
  // （あちらには共通盤面が無い）ので、camp のレンダラーだけを見る。
  const campRenderers = [
    ["rosterSwapSection", "function rosterSwapSection() {", "\nconst SLOT_KEYS"],
    ["renderSkills", "function renderSkills() {", "\nfunction equipmentSlotHtml"],
    ["renderEquipment", "function renderEquipment() {", "\nfunction renderEnemy"],
    ["campTreatmentBlock", "function campTreatmentBlock() {", "\n// R8 §11 — exact preview"],
  ];
  for (const [name, from, to] of campRenderers) {
    const begin = app.indexOf(from);
    const finish = app.indexOf(to, begin);
    if (begin < 0 || finish < 0) {
      console.error(`ecology-screens smoke: ${name}() の範囲を見つけられなかった。検査の書き方が古い。`);
      process.exit(1);
    }
    const body = app.slice(begin, finish);
    for (const forbidden of ["memberTabs(", "formation-board", "formation-slot", "treatment-target-picker"]) {
      if (body.includes(forbidden)) {
        problems.push(`${name}() に二つ目の仲間選択（${forbidden}）が戻っている`);
      }
    }
  }
  // issue #236 — **「取得済みだが未装着」は復活させない。**技能枠は無制限なので、
  // この状態は「オフ」と同じことを二通りに表しているだけだった。取得したものは
  // 必ず装着欄へ入り、出すか出さないかは オン／オフ だけが決める。
  for (const [label, forbidden] of [
    ["装着する釦", '"装着する", "equip-skill"'],
    ["equip-skill の handler", 'action === "equip-skill"'],
    ["未装着だけの節の見た目", ".skill-node.unlocked {"],
  ]) {
    const haystack = forbidden.startsWith(".") ? styles : app;
    if (haystack.includes(forbidden)) {
      problems.push(`取得と装着を分ける経路（${label}）が戻っている`);
    }
  }
  for (const [label, expected] of [
    ["加入時に取得済みを装着欄へ揃える", "next.loadout = installUnlockedSkills("],
    ["保存から戻すときも揃える", "next.run.loadout = installUnlockedSkills("],
    ["解禁したらその場で装着する", "const equipped = equipSkill(state.run.loadout, characterId, skillId, node.kind"],
  ]) {
    if (!app.includes(expected)) problems.push(label + "経路が見つからない");
  }
  // issue #236 — 技能ツリーの要約帯は、画面の上端ではなく**キャンプの固定帯の下**へ貼る。
  // `top: 8px` に戻すと、固定帯の上に乗って盤面を隠す。
  if (!styles.includes("top: calc(var(--camp-top-h, 215px) + 6px);")) {
    problems.push("技能要約帯が固定帯の高さを見て貼りついていない");
  }
  if (!app.includes("function publishCampTopHeight()") || !app.includes("--camp-top-h")) {
    problems.push("固定帯の高さを CSS へ渡す経路が無い");
  }

  // 作者試遊 2026-09-11 — **「時間が巻き戻る」は会話の門にしか置かない。**
  // 結果画面の一項目へ戻すと、物語の出来事がシステム画面の操作になる。
  {
    const resultStart = app.indexOf("function renderResult() {");
    const resultEnd = app.indexOf("\nfunction renderDefeat()", resultStart);
    const resultBody = resultStart >= 0 && resultEnd >= 0 ? app.slice(resultStart, resultEnd) : "";
    if (!resultBody) problems.push("renderResult() の範囲を見つけられなかった");
    else if (resultBody.includes("時間が巻き戻る")) {
      problems.push("結果画面に「時間が巻き戻る」が戻っている（会話の門が持つ）");
    }
  }
  if (app.includes('after === "prologueResult"')) {
    problems.push("倒れた会話のあとに結果画面を挟む経路が戻っている");
  }
  for (const [label, expected] of [
    ["会話の門の表", "const STORY_GATES = Object.freeze({"],
    ["門の判定", "function storyGate() {"],
    ["門の拍では舞台を叩いても進まない", "if (storyGate()) return;"],
    ["倒れた会話がそのまま巻き戻しへ渡る", 'enterStory([storyBeat("stage_0", "prologueDefeat")], "prologueRewind")'],
    ["門の釦とスキップが同じ道を通る", "function rewindPrologue() {"],
  ]) {
    if (!app.includes(expected)) problems.push(label + "が見つからない");
  }
  if (!styles.includes(".vn.typed .vn-gate { opacity: 1; pointer-events: auto; }")) {
    problems.push("会話の門が、文字送りの終わりを待って出る指定になっていない");
  }

  // issue #200 — **押した瞬間に次の会話へ遷移してはいけない。**門の釦は逆走の演出を
  // 通って会話へ渡る。演出が消えると「巻き戻っている感覚が無い」状態へ戻るので、
  // 経路をここで留める（ブラウザの通しは analysis/ecology-tutorial-trial.mjs）。
  for (const [label, expected] of [
    ["巻き戻しの演出の画面", "function renderRewind() {"],
    ["演出を進める経路", "function mountRewindView() {"],
    ["演出の終わり（叩いて追い越すときも通る）", "function finishRewind() {"],
    ["逆走に使う行を読んだ履歴から取る", "function rewindTrackFromLog() {"],
    ["演出を叩いて追い越す受け皿", 'action === "rewind-skip"'],
    ["スキップの行き先（門で止まる）", "function storySkipStop() {"],
    ["門まで飛ばして履歴へ積む", "function skipStoryToGate(stop) {"],
    ["スキップが門を見てから飛ぶ", "const stop = storySkipStop();"],
    ["会話の手前へ場面を一度だけ挟む口", "function enterStory(beats, after, { via = null } = {}) {"],
    ["巻き戻しの会話が演出を通って始まる",
      'enterStory([storyBeat("stage_0", "prologueRewound")], "camp", { via: scene ? "rewind" : null })'],
    ["演出を保存の再開先にしない", 'if (state.phase === "rewind") persisted.phase = "story";'],
    ["演出の時計を画面の切り替えで止める", "stopRewindTimers();"],
  ]) {
    if (!app.includes(expected)) problems.push(label + "が見つからない");
  }
  if (!app.includes("rewind: renderRewind,")) {
    problems.push("巻き戻しの演出が画面の割り当て表に無い（phase rewind が題名画面へ落ちる）");
  }
  // issue #200 — **門の釦は、その下の舞台（story-advance）も鳴らしてしまう。**止めないと、
  // 一押しで巻き戻しと「叩いて進む」が続けて起き、巻き戻し後の一行目（「同じ朝。同じ光。」）
  // が読み飛ばされる。
  if (!app.includes('if (element.closest?.(".vn-gate")) event.stopPropagation?.();')) {
    problems.push("会話の門の押しが、下の舞台へ落ちるのを止めていない");
  }
  // 作者試遊 2026-09-11（issue #200 の続き）— **スキップは門を越えない。**越えると、
  // 押して決める拍がスキップだけ素通りになり、逆走の材料（読んだ行）も空になる。
  {
    const skipStart = app.indexOf('if (action === "story-skip") {');
    const gateLookup = app.indexOf("const stop = storySkipStop();", skipStart);
    const skipRecord = app.indexOf('record("story_skipped"', skipStart);
    if (skipStart < 0 || gateLookup < 0 || skipRecord < 0) {
      problems.push("スキップの受け皿と門の判定を見つけられなかった");
    } else if (gateLookup > skipRecord) {
      problems.push("スキップが門を見る前に会話を丸ごと飛ばしている");
    }
  }
  // issue #200 — **巻き戻しの枝は、finishStory() が履歴を消すより前に無ければならない。**
  // 逆走は読んだ行を使うので、後ろに置くと（会話をスキップして巻き戻したときに）
  // 逆走させるものが空になり、演出が黙って消える。
  {
    const finishStart = app.indexOf("function finishStory() {");
    const rewindBranch = app.indexOf('if (after === "prologueRewind") {', finishStart);
    const logReset = app.indexOf("state.story = { queue: [], after: \"camp\"", finishStart);
    if (finishStart < 0 || rewindBranch < 0 || logReset < 0) {
      problems.push("finishStory() の巻き戻しの枝と履歴の初期化を見つけられなかった");
    } else if (rewindBranch > logReset) {
      problems.push("巻き戻しの枝が履歴の初期化より後ろにある（逆走させる行が消える）");
    }
  }
  for (const [label, expected] of [
    ["逆走の揺れ", "@keyframes rewind-shudder"],
    ["逆走の走査線", "@keyframes rewind-bands"],
    ["杭の閃光", "@keyframes rewind-fire"],
    ["白へ抜ける", "@keyframes rewind-out"],
  ]) {
    if (!styles.includes(expected)) problems.push("巻き戻しの演出の" + label + "が無い");
  }
  // **動きを止める人にも、逆走そのものは残す。**止めるのは揺れ・帯・筋・閃光だけ。
  const reducedRewind = styles.slice(styles.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .rewind-stage,"));
  if (!reducedRewind.startsWith("@media") || !reducedRewind.includes(".rewind-bands, .rewind-streaks { display: none; }")) {
    problems.push("巻き戻しの演出に prefers-reduced-motion の短縮が無い");
  }

  // R11 §5 改 / DESIGN.md §6.4.4（作者指摘 2026-09-12）— **並べ替えは手取りの型。**
  // 押す場所が光り、そこしか押せない。ブラウザでの通し（三手・錠・光の位置）は
  // analysis/ecology-tutorial-trial.mjs が踏むので、ここでは**構造が消えていない**
  // ことだけを見る。教える一手そのものは content（PROLOGUE.tutorial）が持つ。
  for (const [label, sourceText, expected] of [
    ["教える一手の正本", story, "tutorial: Object.freeze({ characterId:"],
    ["チュートリアルの段", app, "function formationTutorialStep() {"],
    ["錠が並べ替えの三手だけに掛かる", app, 'return step !== null && step !== "done";'],
    ["光らせる先の表", app, "function formationTutorialSpotSelector(step) {"],
    ["錠と光を描画のあとに掛ける", app, "applyTutorialGate();"],
    ["経路側の二重の塞ぎ", app, "if (!tutorialAllows(element)) return;"],
    ["段ごとの手引き", app, "function formationTutorialNote() {"],
    ["タブの閉じ込めが一本化されている", app, "function campTutorialTab() {"],
    ["光のCSS", styles, ".tutorial-spot {"],
    ["錠のCSS", styles, ".tutorial-blocked {"],
    ["手順の一覧のCSS", styles, ".tutorial-steps li.current"],
    // issue #240 — 必殺技の一戦も**同じ錠の形**で掛かる（手取りの型を二通り作らない）。
    ["必殺技チュートリアルの段", app, "function ultimateLessonStep() {"],
    ["必殺技チュートリアルの光らせる先", app, "function ultimateLessonSpotSelector(step) {"],
    ["必殺技チュートリアルの手引き", app, "function ultimateLessonNote() {"],
    ["必殺技の一戦の正本", story, "export const ULTIMATE_LESSON = Object.freeze({"],
    ["必殺技の一戦の敵を画面が差し替える", app, "if (ultimateLessonActive()) return ultimateLessonEncounter();"],
    ["必殺技チュートリアルのCSS", styles, ".ultimate-tutorial {"],
    ["必殺技チュートリアルの予測の帯のCSS", styles, ".tutorial-forecast {"],
  ]) {
    if (!sourceText.includes(expected)) problems.push(label + "が見つからない");
  }
  // **光と錠は一つの形から出す**（片方だけ直ると「光るのに押せない」枠が生まれる）。
  // 錠は二つあるが、掛ける側は `tutorialGate()` 一つしか読まない。
  for (const expected of [
    "function tutorialGate() {",
    "const gate = tutorialGate();",
    "return Boolean(gate.selector && element?.closest?.(gate.selector));",
  ]) {
    if (!app.includes(expected)) problems.push("錠の判定が、光らせる先と別の選択子を持っている");
  }
  // 錠の最中も盤面の数字は読ませる（この一手の理由はそこに出ている）。
  if (!styles.includes(".party-cell.tutorial-blocked")) {
    problems.push("錠の最中に盤面のセルまで沈める指定になっている");
  }
  // **動きを止める人にも、光そのものは残す。**止めるのは脈だけ。
  if (!/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.tutorial-spot \{ animation: none;/.test(styles)) {
    problems.push("隊列チュートリアルの光に prefers-reduced-motion の短縮が無い");
  }

  // 盤面は誰も選んでいない状態で開く（先頭が最初から光っていると、一手目を
  // 打ったあとに見える）。
  if (/formationSelection:\s*run\.roster\[0\]/.test(app) || /formationSelection = state\.run\.roster\[0\]/.test(app)) {
    problems.push("隊列の選択が先頭の仲間で初期化されている（誰も選んでいない状態で開かない）");
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
