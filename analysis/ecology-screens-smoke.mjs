// 画面ソースの軽量契約。ブラウザを起動しなくても、主要な表示入口・操作・
// 戦闘演出・チュートリアルが同時に消えていないことを確認する。

import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const app = read("ecology/app.js");
const styles = read("ecology/styles.css");
const battleFx = read("ecology/battle-fx.mjs");
const fxTest = read("ecology/fx-test.js");
const fxTestHtml = read("ecology/fx-test.html");
const story = read("ecology/content/story.mjs");
const problems = [];

const required = [
  ["防壁バーのDOM", app, "unit-barrier-fill"],
  ["防壁比率の計算", app, "function barrierPercent(actor)"],
  ["浮く数字の層", app, "battle-floats"],
  ["浮く数字のCSS", styles, ".battle-floats {"],
  ["攻撃の型", app, "const strikeStyle = beatAttackStyle(ATTACK_STYLE_INDEX, beat);"],
  ["踏み込む線", battleFx, "export function spawnStrikeLine(field, fromUnit, toUnit, style)"],
  ["着弾の印", battleFx, "export function spawnImpactMark(field, unit, style)"],
  ["戦闘の見本", fxTest, 'from "./battle-fx.mjs"'],
  ["戦闘の見本入口", fxTestHtml, "./fx-test.js"],
  ["決着まで飛ばす操作", app, "replay-verdict"],
  ["次の場面へ渡す操作", app, "replay-result"],
  ["戦闘結果の表示語", app, "const BATTLE_RESULT_LABELS = { win: \"勝利\", loss: \"敗北\", draw: \"相打ち\" };"],
  ["武器別技能ツリー", app, "function renderWeaponSkillTree(characterId)"],
  ["技能ツリーの武器入口", app, "return renderWeaponSkillTree(characterId);"],
  ["武器技能の地図", app, "weapon-skill-map"],
  ["武器技能の一覧", app, "weapon-skill-list"],
  ["武器技能の操作盤", app, "weapon-skill-sheet"],
  ["武器技能の見方切替", app, '"select-weapon-skill-view"'],
  ["武器技能の前提線", app, "function layoutWeaponSkillTreeConnectors()"],
  ["武器一覧の前提線", app, "function weaponListGuide(layout)"],
  ["前提込みの残り技能点", app, "function remainingWeaponSkillCost(node, characterId)"],
  ["武器技能の効果バッジ", app, "function weaponEffectBadges(node, characterId, limit = 3)"],
  ["武器技能の条件バッジ", app, "function weaponConditionBadge(node)"],
  ["武器技能のコストバッジ", app, "function weaponCostBadges(node)"],
  ["増減方向の効果札", app, "damageChange"],
  ["追加hit倍率の効果札", app, "追撃×"],
  ["防御無視の効果札", app, "貫通"],
  ["武器技能の左右バッジ仕切り", app, "weapon-signal-divider"],
  ["役割の丸い記号", app, "function weaponKindIcon(kind)"],
  ["一覧で子を持つ節の線", app, "hasChildren: next.length > 0"],
  ["長い節名の2行表示", styles, "-webkit-line-clamp: 2;"],
  ["地図を保った技能選択", app, "function refreshWeaponSkillSelection()"],
  ["event IDの表示語", app, "条件を満たしたとき"],
  ["役割記号の表示", styles, ".weapon-kind-icon {"],
  ["節の解禁／予約ボタン", app, "weapon-node-action"],
  ["選択節の効果全文", app, "weapon-detail-effect"],
  ["効果全文の直接表示", styles, ".weapon-detail-effect { width: 100%;"],
  ["人物ごとの閲覧位置", app, "weaponSkillMemory"],
  ["選択節への縦寄せ", app, "window.scrollBy({ top: selectedRect.top - want, behavior })"],
  ["武器タブの横送り", styles, ".weapon-tree-tabs {"],
  ["武器地図の横送り", styles, ".weapon-tree-scroll {"],
  ["武器操作盤の固定", styles, ".weapon-skill-sheet {"],
  ["武器技能の解禁", app, '"unlock-weapon-skill"'],
  ["武器技能の予約", app, '"reserve-weapon-skill"'],
  ["武器技能の予約取消", app, '"cancel-weapon-skill-reservation"'],
  ["アクティブ選択", app, '"select-active-skill"'],
  ["リアクティブ温存量", app, '"change-reactive-reserve"'],
  ["役割別ロードアウト", app, "role-loadout"],
  ["チュートリアルの錠", app, "function tutorialGate() {"],
  ["チュートリアルの入口", app, "function tutorialOpenings(gate) {"],
  ["チュートリアルの光", styles, ".tutorial-spot"],
  ["チュートリアルの被覆", styles, ".party-cell.tutorial-blocked"],
  ["チュートリアルの初期選択なし", app, "formationSelection: null"],
  ["チュートリアルで教える技能", story, "tower_shield_draw_guard"],
];
for (const [label, source, expected] of required) {
  if (!source.includes(expected)) problems.push(label + "が見つからない");
}

// 旧 pack ツリー、技能レベル、旧保存用の技能欄を現行画面へ戻さない。
for (const [label, source, forbidden] of [
  ["技能レベル欄", app, "skillLevels"],
  ["旧ツリーの見方", app, "skillTreeView"],
  ["旧ツリーのレイアウト", app, "skill-tree-layout"],
]) {
  if (source.includes(forbidden)) problems.push(label + "が画面ソースに残っている");
}
if (/(^|[^A-Z_])SKILL_TREE_NODES([^A-Z_]|$)/.test(app)) {
  problems.push("旧ツリー記号が画面ソースに残っている");
}
if (app.includes("class=\"weapon-position\"")) {
  problems.push("内部の武器節位置名が画面に出ている");
}
if (app.includes("class=\"weapon-rule-detail\"")) {
  problems.push("効果全文が情報アイコンの中へ隠れている");
}
if (app.includes("<summary>技能ツリー</summary>")) {
  problems.push("常時表示の技能ツリーが折りたたみ式になっている");
}
const nodeStart = app.indexOf("function renderWeaponSkillNode(node, characterId, mode, index, listLayout = null) {");
const nodeEnd = app.indexOf("function renderWeaponSkillSheet(node, characterId) {", nodeStart);
const nodeSource = app.slice(nodeStart, nodeEnd);
if (nodeSource.includes("weapon-replace") || nodeSource.includes("上位形態") || nodeSource.includes("▲")) {
  problems.push("節カードに上位形態やアクティブ置換の重複記号が出ている");
}
const sheetStart = app.indexOf("function renderWeaponSkillSheet(node, characterId) {");
const sheetEnd = app.indexOf("function renderWeaponTreeViewSwitch(view, characterId) {", sheetStart);
const sheetSource = app.slice(sheetStart, sheetEnd);
if (sheetSource.includes("weaponNodeSignals") || sheetSource.includes("weapon-detail-prerequisite")) {
  problems.push("操作盤に効果バッジまたは前提を重ねている");
}
if (!sheetSource.includes("weapon-sheet-body") || !sheetSource.includes("weapon-detail-effect")) {
  problems.push("操作盤の区切り線より下に効果全文が出ていない");
}
const renderStart = app.indexOf("function render() {");
const horizontalRestore = app.indexOf("nextBand.scrollLeft = preservedWeaponMapScroll.left;", renderStart);
const connectorLayout = app.indexOf("layoutWeaponSkillTreeConnectors();", renderStart);
const selectedNodeFocus = app.indexOf("focusWeaponSkillTree();", renderStart);
if (!(renderStart >= 0 && horizontalRestore > renderStart
  && horizontalRestore < connectorLayout && connectorLayout < selectedNodeFocus)) {
  problems.push("選択節へ寄せる前に地図の横位置を復元していない");
}
if (!styles.includes("top: calc(-50% - 2px);")) {
  problems.push("一覧の分岐線が前の節の中心まで伸びていない");
}

// reduced-motion でも重要な視認性（光・戦闘の状態）は消さない。
if (!/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.tutorial-spot\s*\{[^}]*animation:\s*none/.test(styles)) {
  problems.push("チュートリアルの光に reduced-motion 用の停止指定がない");
}
if (!styles.includes(".impact-mark.weapon") || !styles.includes(".impact-mark.technique")) {
  problems.push("斬撃・技術の着弾表示CSSが揃っていない");
}

if (problems.length) {
  console.error("ecology-screens smoke:\\n  " + problems.join("\\n  "));
  process.exit(1);
}

console.log("ecology-screens smoke: current battle/tutorial/weapon UI contracts are present");
