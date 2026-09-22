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
