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
  // 戦闘の手応え（作者要望 2026-09-13）。**演出は拍を増やさず、イベント列だけから出す。**
  // 形が変われば、この節も一緒に直すこと。
  ["浮く数字を盤面の層へ置く", app, 'const host = field.querySelector(".battle-floats");'],
  ["浮く数字の層のCSS", styles, ".battle-floats {"],
  ["一撃の重さを最大HP比で三段にする", app, "function hitLevel(amount, maxHp)"],
  ["重さを盤面の揺れへ渡す", app, "function shakeField(field, level)"],
  ["盤面の揺れのCSS", styles, ".battle-field.shake-3"],
  ["踏み込む向きを列差から出す", app, "function lungeShiftPx(actors, actingId, beat)"],
  ["踏み込む向きを CSS へ渡す", styles, "var(--lunge-x, 0px)"],
  ["踏み込んだ先を線で結ぶ", app, "function spawnStrikeLine(field, fromUnit, toUnit)"],
  ["踏み込んだ先の線のCSS", styles, ".strike-line {"],
  ["手応えの層のDOM", app, 'class=\\"unit-fx\\"'],
  ["手応えの層のCSS", styles, ".unit-fx {"],
  ["幕の帯の言葉", app, "function battleBannerFor(beat)"],
  ["幕の帯のCSS", styles, ".battle-banner {"],
  // 作者試遊 2026-09-13 — **再生は決着の帯で止まり、次の場面へは［次へ］だけが渡す。**
  // 終点を「最後の拍」に戻すと、勝敗を読む間がないまま画面が入れ替わる。
  ["決着の拍を再生の終点にする", app, "function endingBeatIndex(beats = replayBeats())"],
  ["決着で止まっているかの判定", app, "function atReplayEnding("],
  ["決着まで飛ばす操作", app, 'if (action === "replay-verdict") {'],
  ["決着まで飛ばす釦", app, 'button("一気に決着へ ▶▶", "replay-verdict"'],
  ["次の場面へ渡す釦", app, 'button("次へ ▶", "replay-result"'],
  ["決着の帯を残す指定", app, '(spec.hold ? " hold" : "")'],
  ["決着の帯を残すCSS", styles, "@keyframes banner-word-hold"],
  ["決着の帯と拍の行を重ねない", styles, ".battle-field.verdict-hold .beat-text"],
  ["前進の釦を入れ替えるCSS", styles, ".replay-finish > .button[hidden]"],
  ["決着の行を engine の語のまま出さない", app, 'const BATTLE_RESULT_LABELS = { win: "勝利", loss: "敗北", draw: "相打ち" };'],
  ["防壁バーをHPバー上へ配置", styles, "top: -3px"],
  ["装備摩耗ログの残耐久", app, '"の装備が耐久 " + values.before + "→" + values.after'],
  ["装備耐久切れの不発表示", app, '" · 耐久切れ、以後は不発"'],
  // 作者要望 2026-09-13 — ルールは段落から**記号つきの段**（ruleGrid）へ移した。
  // 形が変わったので、見る文字列もその段の綴りへ合わせる。
  ["装備常時効果の耐久説明", app, 'title: "能力値補正", value: "耐久を使わない"'],
  ["技能バッジの表示語", app, 'const kindLabels = { active: "アクティブ", reactive: "リアクティブ", passive: "パッシブ", equipment: "装備" };'],
  ["アクティブ欄の見出し", app, 'active: "アクティブ"'],
  ["リアクティブ欄の見出し", app, 'reactive: "リアクティブ"'],
  ["パッシブ欄の見出し", app, 'passive: "パッシブ"'],
  ["技能取得予約の操作", app, '"reserve-skill"'],
  ["技能点で取得と予約を切り替える判定", app, "canFulfillSkillReservation"],
  ["技能取得予約の取消", app, '"cancel-skill-reservation"'],
  ["予約技能の自動取得", app, "applyAutomaticSkillActions"],
  ["アクティブツリーのラベル", skillTreeLayout, 'label: "アクティブ"'],
  ["リアクティブツリーのラベル", skillTreeLayout, 'label: "リアクティブ"'],
  ["パッシブツリーのラベル", skillTreeLayout, 'label: "パッシブ"'],
  // 作者指摘 2026-09-13 — **説明と取得の釦は、地図の中ではなく操作盤に出す。**
  // 列幅の中に釦を入れると、押す前に横スクロールが要る。
  ["選んだ節の操作盤", app, "function renderSkillSheet(selectedRow, characterId)"],
  ["操作盤を地図の後ろに置く", app, "+ renderSkillSheet(selectedRow, characterId);"],
  ["操作盤を画面の下端へ貼る", styles, ".skill-sheet {\n  position: sticky;\n  bottom: 0;"],
  ["操作盤の閉じる釦", app, 'class=\\"sheet-close\\"'],
  // 作者指摘 2026-09-13 — 盤は短いほど地図と一緒に読める。入切は摘みひとつ、
  // 取得・段上げ・予約は一行、前提と派生は地図に任せる。
  ["入切の摘みを装着行と盤で共有する", app, "function skillToggleSwitch(characterId, skillId, kind, disabled)"],
  ["盤の頭で取得済みを入切する", app, "? skillToggleSwitch(characterId, node.skillId, node.kind, nodeState.disabled)"],
  ["取得・段上げ・予約を一行へ並べる", styles, ".skill-sheet .node-action { display: flex;"],
  ["予約の規則は畳んだヘルプに置く", app, 'title: "取得予約",\n        value: "一人につき一つ"'],
  ["選んだ節へ地図を寄せる", app, "function focusSelectedSkillNode()"],
  ["描画のたびに選んだ節を追う", app, "  focusSelectedSkillNode();"],
  // 反応（issue #237）。**操作と結果を結ぶ層は、申告・見張り・時間の三つで立っている。**
  // 一つでも消えると、画面は静かなまま動き続ける（構文検査も単体試験も通る）。
  ["反応を申告する口", app, "function fx(key, kind)"],
  ["申告した反応を描き終わってから載せる", app, "function applyPendingFx()"],
  ["数の変化は読み値の側で見つける", app, "function pulseChangedReadouts()"],
  ["遠征が替わったら数の記憶を捨てる", app, "function resetFxMemoryIfRunChanged()"],
  ["予測は窓の文字でなく数そのもので見張る", app, "function forecastSignature()"],
  ["反応を載せるのは描画の最後だけ", app, "applyRenderFeedback({ phaseChanged, tabChanged });"],
  ["反応の時間はCSSの一箇所が持つ", styles, "  --fx-accent: "],
  ["押した指への返事", styles, ".button:active:not(:disabled)"],
  ["画面と段の立ち上がり", styles, "@keyframes fx-view-enter"],
  ["得たの反応", styles, "@keyframes fx-gain"],
  ["拒まれたの反応", styles, "@keyframes fx-deny"],
  ["増えた数の反応", styles, "@keyframes fx-up"],
  ["減った数の反応", styles, "@keyframes fx-down"],
  ["予測を読み直す走査", styles, "@keyframes fx-rescan"],
  // 作者指摘 2026-09-13 — 先見機の読み直しは「光る」ではなく**ブラウン管の同期外れ**で出す。
  // 四枚（走査バー・転がる横目・面の左右ブレ・数の色分離と前の値の影）のどれが欠けても、
  // 窓は「一瞬光るだけ」へ戻る。
  ["窓の横目が転がる", styles, "@keyframes fx-crt-roll"],
  ["見出し行の水平同期が外れる", styles, "@keyframes fx-crt-desync"],
  ["盤面の帯が別の拍でずれる", styles, "@keyframes fx-crt-tear"],
  ["変わった数が色分離してブレる", styles, "@keyframes fx-crt-value"],
  ["前の値が横へ千切れて消える", styles, "@keyframes fx-crt-ghost"],
  ["変わった枠そのものがずれる", styles, "@keyframes fx-crt-cell"],
  ["ブラウン管は補間しない", styles, "fx-crt-desync var(--fx-accent) steps(1, end)"],
  ["面そのものに横の目が敷いてある", styles, ".forecaster-scan::before,"],
  ["前の値の影を置くのは先見機の窓の中だけ", app, "function hauntWithPreviousValue(element, before)"],
  ["前の値は読み上げへ出さない", app, "ghost.setAttribute(\"aria-hidden\", \"true\")"],
  ["予測の勝敗とラウンドも読み値として見張る", app, "data-fx-watch=\\\"forecast-verdict\\\""],
  ["危険な予測の脈", styles, "@keyframes forecast-warn"],
  ["reduced-motion で反応を止める", styles, "  .fx-view-enter,\n  .fx-board-enter,"],
  ["キャンプのタブの中身をひとつの箱に入れる", app, 'class=\\"camp-view\\"'],
  // 作者要望 2026-09-13 — 試映と実戦は窓の下段に、指で狙える大きさで置く。
  ["先見機の操作を窓の下段に置く", app, "+ partyBoardNote(mode) + forecasterActions"],
  ["先見機の操作の下段CSS", styles, ".forecaster-actions {"],
  ["先見機の操作が指の的を下回らない", styles, "  min-height: 44px;"],
  ["先見機の操作が何をするか一行で言う", app, "forecaster-action-copy"],
  // 作者要望 2026-09-13 — **文章で説明する画面はダサい。**規則・内訳・状態・因果は
  // 記号・数・目盛り・流れで出す。この共通語彙が一つでも消えると、画面は静かに
  // 段落へ戻る（構文検査も単体試験も通ったまま）。
  ["線画の記号", app, "function glyph(name, className"],
  ["数のタイル", app, "function statTiles(items"],
  ["規則の段", app, "function ruleGrid(items"],
  ["順の帯", app, "function flowStrip(steps"],
  ["段の目盛り", app, "function segmentMeter(value, max"],
  ["内訳の棒", app, "function ledgerRows(rows)"],
  ["残る／消えるの二列", app, "function splitColumns(keep, lose"],
  ["決着の印", app, "function verdictSigil(kind)"],
  ["戦闘の凡例", app, "function battleLegend()"],
  ["遠征の形の帯", app, "function expeditionShapeRail()"],
  ["content の強調を太字にする", app, "function emphasize(value)"],
  ["法則への手の札", app, "function counterChips(lines)"],
  ["区画の覚え書き", app, "function learningNotes(lines)"],
  ["数のタイルのCSS", styles, ".stat-tile {"],
  ["規則の段のCSS", styles, ".rule-cell {"],
  ["順の帯のCSS", styles, ".flow-strip {"],
  ["段の目盛りのCSS", styles, ".meter-pips i {"],
  ["内訳の棒のCSS", styles, ".ledger-bar i {"],
  ["残る／消えるの二列のCSS", styles, ".split-col.lose b"],
  ["決着の印のCSS", styles, ".verdict-sigil {"],
  ["戦闘の凡例のCSS", styles, ".legend-bar .seg.recoverable"],
  ["遠征の形の帯のCSS", styles, ".act-node.kind-boss"],
  ["法則への手の札のCSS", styles, ".counter-chips li"],
  ["active の CSS クラス", styles, ".kind-active"],
  ["reactive の CSS クラス", styles, ".kind-reactive"],
  ["passive の CSS クラス", styles, ".kind-passive"],
];
for (const [label, sourceText, expected] of displayContracts) {
  if (!sourceText.includes(expected)) problems.push(label + "が見つからない");
}
const progressiveContracts = [
  ["先見機の実戦操作", app, "forecaster-action engage"],
  ["先見機の試映操作", app, "forecaster-action simulate"],
  ["結果画面の主操作", app, "primary-action result-primary-action"],
  ["敗北画面の主操作", app, "primary-action defeat-primary-action"],
  ["精算画面の主操作", app, "primary-action settlement-primary-action"],
  ["敵情報の折り畳み", app, "progressive-details enemy-details"],
  ["敵の3列×2行盤面", app, "function expeditionEnemyBoard(encounter)"],
  ["敵セルの選択操作", app, "select-expedition-enemy"],
  ["選択した敵の詳細", app, "enemy-selection-detail"],
  ["技能ツリーの折り畳み", app, "progressive-details skill-tree-details"],
  ["装備一覧の折り畳み", app, "progressive-details equipment-inventory"],
  ["主操作のCSS", styles, ".primary-action"],
  ["折り畳みのCSS", styles, ".progressive-details > summary"],
  ["敵盤面のCSS", styles, ".enemy-board"],
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
if (mapRenderer.includes("enemy-grid")) {
  problems.push("遠征マップが旧い敵カードの2列表示を直接使っている");
}
for (const forbidden of [
  ".map-node.kind-elite { border-color:",
  ".map-node.kind-boss { border-color:",
]) {
  if (styles.includes(forbidden)) problems.push("種別の枠が現在地の枠と競合する定義が残っている: " + forbidden);
}
if (mapRenderer.includes("map-primary-action")) {
  problems.push("実戦操作が先見機と遠征本文に重複している");
}
for (const [label, expected] of [
  ["試映は進行結果へ追加しない", "if (!previewOnly) state.run.results"],
  ["試映は戦闘結果を確定しない", "if (!previewOnly) {\n      if (isCampaignRun())"],
  ["試映の結果は必ず専用画面へ入る", "if (state.simulationMode) return true;"],
  ["試映から先見機へ戻る", 'action === "return-from-simulation"'],
]) {
  if (!app.includes(expected)) problems.push(label + "契約が無い");
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
  // 節の中で説明を開く形（`detail` を tree-cell へ差し込む）へ戻っていないか。
  // 戻ると、押した節だけ背が伸びて地図が組み変わる。
  ["節の中で説明を開く旧構造", app, '+ detail + "</article></div>"'],
  // 盤で前提・派生を繰り返す形（`skillRouteChip`）と、摘みと同じことを言う釦・
  // 説明文へ戻っていないか。
  ["盤で前提と派生を繰り返す旧構造", app, "skillRouteChip"],
  ["摘みと重なる入切の釦", app, 'button(nodeState.disabled ? "オンにする"'],
  // 作者試遊 2026-09-13 — 再生が流れきったら自動で次の場面へ出る形（issue #138）と、
  // 行き先を言わない旧い打ち切り釦へ戻っていないか。
  ["再生の終わりで自動的に次の場面へ出る旧経路", app, "      goToBattleResult();\n    }, beatDurationMs("],
  ["旧い打ち切り釦", app, '"再生をとばす"'],
  ["入切の説明文", app, 'class=\\"node-locked\\">取得状態は変わりません'],
  // 作者要望 2026-09-13 — 試映と実戦を見出し行の右端へ二字で畳んだ旧い形へ戻っていないか。
  // 戻ると、この窓で一番大事な操作が一番小さい釦になる。
  ["先見機の操作を見出し行へ畳んだ旧構造", app, "<small>試映</small>"],
  ["先見機の操作を見出し行へ置く旧構造", app, "formationToggle + forecasterActions"],
  // 作者要望 2026-09-13 — 段落で説明していた旧い形へ戻っていないか。
  // **戻り方は一つずつ違う**ので、消した文そのものを名指しで見る。
  ["敗北画面の説明文", app, "この組み合わせでは届かなかった"],
  ["精算の持ち物説明文", app, "持ち帰るのは活動資金と設計図だけです"],
  ["戦闘表示の説明文", app, "箱の下の帯は緑＝残HP"],
  ["遠征の形の説明文", app, "esc(REGION.summary)"],
  ["設計図の残せる数を綴った旧い文", app, "勝利2件・安全撤退2件・敗北1件"],
  ["鍛錬の効きを綴った旧い文", app, "一段で基礎値の6%"],
  ["補給の用途の箇条書き", app, "<ul class=\\\"supply-uses\\\">"],

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
  ["戦闘画面の見出し", 'sectionHeading("BATTLE", state.simulationMode ? "戦闘予測" : "戦闘"'],
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
  "Image",
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
  for (const expected of ["forecast-member-head", "forecast-info-layer", "forecast-hp-values", "forecast-delta", "forecast-hp-bar", "unit-info-layer"]) {
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
    // 作者要望 2026-09-14 — 四つの札は**一つの組み立て**から出す（見た目も進捗も揃う）。
    ["手取りの札の共通の組み立て", app, "function tutorialNoteCard({"],
    ["手取りの札の共通CSS", styles, ".tutorial-note-card {"],
    ["錠の最中だけ札が貼りつく", styles, ".tutorial-note-card.pinned"],
    ["光る先へ画面を寄せる", app, "function focusTutorialSpot() {"],
    // 作者要望 2026-09-14 — 一戦目の後は技能の取得・予約、二戦目の後が補給。
    ["技能チュートリアルの正本", story, "export const SKILL_LESSON = Object.freeze({"],
    ["技能チュートリアルの段", app, "function skillLessonStep() {"],
    ["技能チュートリアルの錠", app, "function skillLessonLocked() {"],
    ["技能チュートリアルの光らせる先", app, "function skillLessonSpotSelector(step) {"],
    ["技能チュートリアルの手引き", app, "function skillLessonNote() {"],
    ["技能チュートリアルのタブの閉じ込め", app, "if (skillLessonLocked()) return \"skills\";"],
    ["補給を二戦目の後へ送った", app, "const SUPPLY_TUTORIAL_ENCOUNTER_INDEX = SKILL_LESSON_ENCOUNTER_INDEX + 1;"],
    // 作者指摘 2026-09-13 — 補給も**文章を読んで探す型から、光る先を押す型へ**揃える。
    ["補給チュートリアルの段", app, "function supplyTutorialStep() {"],
    ["補給チュートリアルの錠", app, "function supplyTutorialLocked() {"],
    ["補給チュートリアルの光らせる先", app, "function supplyTutorialSpotSelector(step) {"],
    ["補給チュートリアルの手引き", app, "function supplyTutorialNote() {"],
    ["補給チュートリアルの進捗表示", app, "tutorial-progress"],
    // issue #240 — 必殺技の一戦も**同じ錠の形**で掛かる（手取りの型を二通り作らない）。
    ["必殺技チュートリアルの段", app, "function ultimateLessonStep() {"],
    ["必殺技チュートリアルの光らせる先", app, "function ultimateLessonSpotSelector(step) {"],
    ["必殺技チュートリアルの手引き", app, "function ultimateLessonNote() {"],
    ["必殺技の一戦の正本", story, "export const ULTIMATE_LESSON = Object.freeze({"],
    ["必殺技の一戦の敵を画面が差し替える", app, "if (ultimateLessonActive()) return ultimateLessonEncounter();"],
    ["必殺技チュートリアルのCSS", styles, ".ultimate-tutorial .tutorial-steps"],
    ["必殺技チュートリアルの予測の帯のCSS", styles, ".tutorial-forecast {"],
    // 作者指摘 2026-09-13 — 三手目（遠征タブを押す）と、タブの閉じ込めを最初の二手だけに
    // 限る判定。**構えた拍に画面を勝手に跳ばさない**ための二つ。
    ["必殺技チュートリアルの三手目", app, "function ultimateLessonTabLocked() {"],
    ["三手目が遠征タブを光らせる", app, "open: \"nav.tabs [data-tab=\\\"map\\\"]\","],
    // 作者要望 2026-09-13 — 長押しの帯。**長さの正本は JS の定数ひとつ。**
    ["長押しの帯", styles, ".installed-row[data-longpress].pressing::before {"],
    ["長押しの帯の長さを JS から渡す", app, "--long-press-ms"],
    ["長押しの帯の長さを CSS が受け取る", styles, "var(--long-press-ms, 450ms)"],
    // 作者指摘 2026-09-13 — 必殺の残りは人物ごと（隊の合計はやめた）。
    ["必殺の残りは人物ごと", app, "function ultimateCellMark(characterId) {"],
    ["必殺の残りの四段CSS", styles, ".party-ultimate.spent {"],
  ]) {
    if (!sourceText.includes(expected)) problems.push(label + "が見つからない");
  }
  // **やめたものが残っていないこと。**隊全体の合計（菱形の並び）は消したので、
  // 画面にも CSS にも残骸を置かない。
  for (const [label, sourceText, forbidden] of [
    ["必殺の隊合計（画面）", app, "seal-pips"],
    ["必殺の隊合計（CSS）", styles, ".seal-pips"],
    ["必殺を構える釦", app, "toggle-ultimate-armed"],
  ]) {
    if (sourceText.includes(forbidden)) problems.push(label + "が残っている");
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

// 8. 反応の語（issue #237）。**語が一つ欠けると、その操作だけが黙って静かになる。**
//
//    `fx(key, "kind")` は class を足すだけなので、CSS 側に `.fx-kind` が無くても
//    JS は何事もなく通る。押しても何も返ってこないことに気づくのは、その画面を
//    実際に触ったときだけである。申告する語と、CSS が持つ語を、ここで突き合わせる。
const FX_KINDS_FROM_RENDER = [
  // app.js が描画のあとで直接足す語（fx() を通らない）。
  "view-enter", "board-enter", "recalc",
  // 先見機の窓の中だけが着る語（ブラウン管の同期外れ）。
  "crt", "ghost",
  // 読み値の見張り（pulseChangedReadouts）が足す向き。
  "up", "down", "change",
  // 保存できた一行が最初から着ている語。
  "on",
];
const declaredFxKinds = new Set(FX_KINDS_FROM_RENDER);
for (const line of app.split("\n")) {
  const start = line.indexOf("fx(");
  if (start < 0 || /[\w.$]fx\(/.test(line.slice(Math.max(0, start - 1)))) continue;
  const call = line.slice(start + 3);
  const tail = call.slice(call.lastIndexOf(",") + 1);
  for (const match of tail.matchAll(/"([a-z][a-z-]*)"/g)) declaredFxKinds.add(match[1]);
}
if (declaredFxKinds.size < FX_KINDS_FROM_RENDER.length + 8) {
  console.error(`ecology-screens smoke: 反応の語を${declaredFxKinds.size}件しか取り出せなかった。検査の書き方が古い。`);
  process.exit(1);
}
// **止める側だけが残っていても、動いていないことは分からない**し、その逆もある。
// `@media (prefers-reduced-motion: reduce)` の中身と外側を本当に切り分けてから、
// 両方に語があることを見る（片側だけを見ると、もう片方の名前で検査が通る）。
const reducedMotionBlocks = [];
const styleRest = [];
{
  const marker = "@media (prefers-reduced-motion: reduce)";
  let cursor = 0;
  for (let at = styles.indexOf(marker); at >= 0; at = styles.indexOf(marker, cursor)) {
    styleRest.push(styles.slice(cursor, at));
    let depth = 0;
    let index = styles.indexOf("{", at);
    for (; index < styles.length; index += 1) {
      if (styles[index] === "{") depth += 1;
      else if (styles[index] === "}" && (depth -= 1) === 0) break;
    }
    reducedMotionBlocks.push(styles.slice(at, index + 1));
    cursor = index + 1;
  }
  styleRest.push(styles.slice(cursor));
}
if (!reducedMotionBlocks.length) {
  console.error("ecology-screens smoke: prefers-reduced-motion の塊を一つも取り出せなかった。検査の書き方が古い。");
  process.exit(1);
}
const normalStyles = styleRest.join("\n");
const reducedMotionStyles = reducedMotionBlocks.join("\n");
for (const kind of declaredFxKinds) {
  if (!normalStyles.includes(".fx-" + kind)) {
    problems.push(`反応 fx-${kind} の CSS が無い（申告しても押した先が黙る）`);
  }
  if (!reducedMotionStyles.includes(".fx-" + kind)) {
    problems.push(`反応 fx-${kind} を prefers-reduced-motion で止めていない`);
  }
}

if (problems.length) {
  console.error("ecology-screens smoke:\n  " + problems.join("\n  "));
  console.error("\n  画面か行き先が消えている。ブラウザでは真っ白になるが、構文検査では通る。");
  process.exit(1);
}

console.log(`ecology-screens smoke: 画面${mapped}件・ボタン${actions.size}件・data-action ${rawActions.size}件`
  + `・呼び先${callTargets.length}件の行き先がすべて存在する`);
