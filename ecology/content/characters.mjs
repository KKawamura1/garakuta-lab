// ecology/content/characters.mjs
//
// **仲間の engine 定義。人物設定は character-lore.mjs、編成画面向けの役割・図像は roster.mjs。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// engine・schema・共通registryは変更しない。

import { renamed, scaleDefinitionAmounts } from "./base.mjs";
import { CHARACTER_NAMES } from "./character-lore.mjs";
// R11 — 本編5人を作り直した（経緯は docs/HISTORY.md §3.3）。
// **仲間はこの5人だけである。**R12 で、本編に出ない同業者3人（トキ/ヨリ/アカリ）と
// Free / Endless を削除した。来歴を持たない人物を編成画面に並べておくと、
// 「後で加入する仲間」として未公開の加入者と区別できず、物語の先が割れる（R12 §4.E-1、作者判断）。
export { CHARACTER_NAMES };







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

// R13 §11 — 人物 parameter。**R11 の5人を作り直した**
// （設計は `analysis/CAST_REBOOT_TWELVE_TOMORROWS.md` §11）。
//
// **engine の id は変えていない。**名前と役割だけが変わったので、id の語義と中身は
// 一致しなくなっている（`lancer` が受け役、`guardian` が遊撃役）。id は技能・pack・
// contract の対応を保つための鍵であって、役割名ではない。改名すると公開済み ID の
// 引っ越しになるため、あえて据え置く。
//
// **5人が別々の軸を1本ずつ持つ。**似た二人を作らないための制約である。
//
//   ゴウ(warden)      … HP 最大 ＋ 腕力 最大。ただし受け最低・技術ゼロ
//   ツグミ(mender)    … 技術 最大。隊の主火力かつ治療役。HP 最低
//   ナギ(lancer)      … 受け 最大。多段を止め、治療も出す
//   ヒバナ(guardian)  … AP2。一撃は最弱だが、一巡に二度動いて位置を変える
//   ゲンゾウ(tactician)… 反応点 最大。自分からは動かず、割り込んで防壁を置く
//
// guard は hit ごとの固定軽減なので（effects.mjs §damage）、**受けの高いナギは多段に強く、
// HP の厚いゴウは単発大威力に強い**。同じ「硬い」でも通る攻撃が違う。
// そして**ゴウは受けが1なので、細かい攻撃が全部素通りする。**HP と腕力を両取りしている
// 代償はここにある（AGENTS.md「完全上位互換を作らない。作る場合は明確な代償を付ける」）。
//
// **未検証の数値である。**`analysis/ecology-trial.mjs` で通しの調整が要る。
export const CHARACTER_STATS = {
  // ---- Campaign 本編の5人。加入順に並べてある ----
  // ゴウ … 落ちない前衛かつ最大火力。武器攻撃なので前に置いて初めて火力が出る
  warden:    { maxHp: 300, might: 50, focus: 6,  guard: 1,  speed: 4,  baseActionPoints: 1, baseReactionPoints: 2 },
  // ツグミ … 隊の主火力。技攻撃なので後列でも威力が落ちない。**紙。**
  mender:    { maxHp: 110, might: 8,  focus: 52, guard: 2,  speed: 8,  baseActionPoints: 1, baseReactionPoints: 2 },
  // ナギ … 受けが桁違い。生半可な多段は最低保証まで落ちて通らない。治療も出す
  lancer:    { maxHp: 210, might: 16, focus: 30, guard: 24, speed: 5,  baseActionPoints: 1, baseReactionPoints: 2 },
  // ヒバナ … 一撃は隊で最弱。**行動権が一つ多い。**入って、戻れるのはこの人だけ
  guardian:  { maxHp: 120, might: 14, focus: 14, guard: 3,  speed: 9,  baseActionPoints: 2, baseReactionPoints: 2 },
  // ゲンゾウ … 攻守とも中庸。**反応点が二つ多い。**一巡に何度も割り込める
  tactician: { maxHp: 160, might: 20, focus: 22, guard: 10, speed: 7,  baseActionPoints: 1, baseReactionPoints: 4 },
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
