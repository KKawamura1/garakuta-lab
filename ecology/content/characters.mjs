// ecology/content/characters.mjs
//
// **仲間の engine 定義。編成画面向けの役割・図像は roster.mjs。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 人物 担当だけ。engine・schema・共通registryは変更しない。

import { renamed, scaleDefinitionAmounts } from "./base.mjs";

// R11 — 本編5人を作り直した（analysis/experiments/exp-18/R11_CHARACTER_DESIGN_FIVE.md）。
// Campaign Stage 0〜3 に出るのは warden / lancer / guardian / tactician / mender の5人。
// 残る3人は Free / Endless に残っている同業者で、本編には出ない。
export const CHARACTER_NAMES = {
  warden: "シキ — 受けて返す人",
  mender: "ナズナ — 止める人",
  lancer: "カイ — 抜ける人",
  scout: "トキ — 先を読む人",
  pivot: "ヨリ — 余りを活かす人",
  guardian: "スミ — 受け止める人",
  arcanist: "アカリ — 溜める人",
  tactician: "レイ — 渡す人",
};

const characters = renamed("characters", CHARACTER_NAMES);
Object.assign(characters.warden, { maxHp: 28, speed: 5, baseReactionPoints: 2 });
Object.assign(characters.mender, { maxHp: 18, speed: 6, baseReactionPoints: 2 });
Object.assign(characters.lancer, { maxHp: 17, speed: 9, baseReactionPoints: 2 });
Object.assign(characters.scout, { maxHp: 17, speed: 10, baseReactionPoints: 2 });
Object.assign(characters.pivot, { maxHp: 20, speed: 5, baseActionPoints: 2, baseReactionPoints: 2 });
characters.guardian = {
  id: "guardian",
  displayName: CHARACTER_NAMES.guardian,
  maxHp: 22,
  speed: 2,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "front", "guard"],
};
characters.arcanist = {
  id: "arcanist",
  displayName: CHARACTER_NAMES.arcanist,
  maxHp: 15,
  speed: 4,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "rear", "attack"],
};
characters.tactician = {
  id: "tactician",
  displayName: CHARACTER_NAMES.tactician,
  maxHp: 16,
  speed: 11,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "rear", "tempo"],
};

// R11 §2 — 人物 parameter。**R6 §4.4 の仮値を作り直した。**
//
// R6 は「全員が might と focus を持つので、支援役にも technique 攻撃を付けられる」と
// 書いていたが、実装では攻撃が全部 might だった（skills-active.mjs の TECHNIQUE_SKILL_IDS
// を参照）。**攻めの軸が1本しか無い一方、守りは防壁(focus)と軽減(guard)の2軸**だったので、
// 数値の側が編成を守りへ引っ張っていた。R11 で技攻撃を focus へ移し、軸を 2:2 にした。
//
// **本編5人は、それぞれ別の軸を1本ずつ持つ。**似た二人を作らないための制約である。
//
//   シキ(warden)    … HP 最大。大技を抱えて立てる
//   カイ(lancer)    … 腕力 最大。紙だが誰より削る
//   スミ(guardian)  … 受け 最大・速度 最小。多段が通らない
//   レイ(tactician) … 速度 最大・反応3。順番を配る
//   ナズナ(mender)  … 集中 最大。技で削り、防壁を張る
//
// guard は hit ごとの固定軽減なので（effects.mjs §damage）、**受けの高いスミは多段に強く、
// HP の厚いシキは単発大威力に強い**。同じ「硬い」でも通る攻撃が違う。
//
// 本編に出ない3人（トキ/ヨリ/アカリ）も同じ物差しで置き直した。アカリは集中52で、
// technique 攻撃の主になる（R6 が「準備攻撃」と呼んでいた役が、ここで初めて成立する）。
export const CHARACTER_STATS = {
  // ---- Campaign 本編の5人 ----
  warden:    { maxHp: 280, might: 38, focus: 20, guard: 7,  speed: 5,  baseActionPoints: 1, baseReactionPoints: 2 },
  lancer:    { maxHp: 170, might: 52, focus: 14, guard: 2,  speed: 9,  baseActionPoints: 1, baseReactionPoints: 2 },
  guardian:  { maxHp: 220, might: 16, focus: 26, guard: 18, speed: 2,  baseActionPoints: 1, baseReactionPoints: 2 },
  tactician: { maxHp: 160, might: 20, focus: 30, guard: 3,  speed: 11, baseActionPoints: 1, baseReactionPoints: 3 },
  mender:    { maxHp: 180, might: 14, focus: 48, guard: 4,  speed: 6,  baseActionPoints: 1, baseReactionPoints: 2 },
  // ---- 本編に出ない同業者（Free / Endless） ----
  scout:     { maxHp: 170, might: 34, focus: 24, guard: 3,  speed: 10, baseActionPoints: 1, baseReactionPoints: 2 },
  pivot:     { maxHp: 200, might: 26, focus: 28, guard: 6,  speed: 5,  baseActionPoints: 2, baseReactionPoints: 2 },
  arcanist:  { maxHp: 150, might: 12, focus: 52, guard: 2,  speed: 4,  baseActionPoints: 1, baseReactionPoints: 2 },
};
// R6 §6.4 — 届き方は技能側の effect.reach で決める。
// playable の通常攻撃は全員 melee とし、後衛の仲間だから自動的に遠隔にはしない。
// 後衛へ届く能力は `rear_hunt` など、技能定義が `reach: "ranged"` を持つものだけ。

for (const [id, stats] of Object.entries(CHARACTER_STATS)) {
  Object.assign(characters[id], stats);
}

// 固有の性質が持つ量も、その人の focus で伸びるようにする
// （scout の「先を読む」防壁など）。持ち主が育てば固有も伸びる。
for (const definition of Object.values(characters)) {
  scaleDefinitionAmounts(definition, { stat: "focus" });
}

export const CHARACTERS = characters;
