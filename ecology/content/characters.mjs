// ecology/content/characters.mjs
//
// **仲間の engine 定義。編成画面向けの役割・図像は roster.mjs。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 人物 担当だけ。engine・schema・共通registryは変更しない。

import { renamed, scaleDefinitionAmounts } from "./base.mjs";

// R11 — 本編5人を作り直した（経緯は docs/HISTORY.md §3.3）。
// **仲間はこの5人だけである。**R12 で、本編に出ない同業者3人（トキ/ヨリ/アカリ）と
// Free / Endless を削除した。来歴を持たない人物を編成画面に並べておくと、
// 「後で加入する仲間」として未公開の加入者と区別できず、物語の先が割れる（R12 §4.E-1、作者判断）。
export const CHARACTER_NAMES = {
  warden: "シキ — 受けて返す人",
  mender: "ナズナ — 止める人",
  lancer: "カイ — 抜ける人",
  guardian: "スミ — 受け止める人",
  tactician: "レイ — 渡す人",
};

// R12 — fixture の characters は engine 用の骨格なので、本編に居ない人物
// （fixture 側の scout / pivot）まで運んでくる。**CHARACTER_NAMES に無い者は
// ここで落とす。**落とさないと編成画面と契約 snapshot に、来歴の無い人物が残る。
const characters = Object.fromEntries(
  Object.entries(renamed("characters", CHARACTER_NAMES))
    .filter(([id]) => Object.hasOwn(CHARACTER_NAMES, id)),
);
Object.assign(characters.warden, { maxHp: 28, speed: 5, baseReactionPoints: 2 });
Object.assign(characters.mender, { maxHp: 18, speed: 6, baseReactionPoints: 2 });
Object.assign(characters.lancer, { maxHp: 17, speed: 9, baseReactionPoints: 2 });
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
// R12 — 同業者3人を削除したので、この表は本編5人だけを持つ。
export const CHARACTER_STATS = {
  // ---- Campaign 本編の5人。加入順に並べてある ----
  // シキ … 落ちない前衛。武器攻撃なので前に置いて初めて火力が出る
  warden:    { maxHp: 280, might: 38, focus: 20, guard: 7,  speed: 5,  baseActionPoints: 1, baseReactionPoints: 2 },
  // ナズナ … やや脆いが、技も回復も同じ集中で伸びる。後列でも火力が落ちない万能
  mender:    { maxHp: 180, might: 14, focus: 48, guard: 4,  speed: 6,  baseActionPoints: 1, baseReactionPoints: 2 },
  // カイ … 隊の火力そのもの。**紙。**前に置けば落ち、後ろに置けば武器が40%になる
  lancer:    { maxHp: 130, might: 52, focus: 14, guard: 1,  speed: 9,  baseActionPoints: 1, baseReactionPoints: 2 },
  // スミ … HPは低いが受けが桁違い。生半可な多段は最低保証まで落ちて通らない
  guardian:  { maxHp: 180, might: 16, focus: 26, guard: 26, speed: 2,  baseActionPoints: 1, baseReactionPoints: 2 },
  // レイ … 攻守とも低いが、**行動権も反応点も一つ多い。**何をさせても形になる
  tactician: { maxHp: 150, might: 18, focus: 26, guard: 3,  speed: 11, baseActionPoints: 2, baseReactionPoints: 3 },
};
// R6 §6.4 — 届き方は技能側の effect.reach で決める。
// playable の通常攻撃は全員 melee とし、後衛の仲間だから自動的に遠隔にはしない。
// 後衛へ届く能力は `rear_hunt` など、技能定義が `reach: "ranged"` を持つものだけ。

for (const [id, stats] of Object.entries(CHARACTER_STATS)) {
  Object.assign(characters[id], stats);
}

// 固有の性質が持つ量も、その人の focus で伸びるようにする
// （固有規則が量を持つ場合）。持ち主が育てば固有も伸びる。
for (const definition of Object.values(characters)) {
  scaleDefinitionAmounts(definition, { stat: "focus" });
}

export const CHARACTERS = characters;
