// ecology/content/characters.mjs
//
// **仲間の engine 定義。編成画面向けの役割・図像は roster.mjs。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 人物 担当だけ。engine・schema・共通registryは変更しない。

import { renamed, scaleDefinitionAmounts } from "./base.mjs";

export const CHARACTER_NAMES = {
  warden: "ユウリ — 守る人",
  mender: "ミナ — 手当てする人",
  lancer: "レオン — 切り込む人",
  scout: "スイ — 先を読む人",
  pivot: "カイ — 余りを活かす人",
  guardian: "ナギ — かばう人",
  arcanist: "アオ — 溜める人",
  tactician: "トワ — つなぐ人",
};

const characters = renamed("characters", CHARACTER_NAMES);
Object.assign(characters.warden, { maxHp: 26, speed: 4, baseReactionPoints: 2 });
Object.assign(characters.mender, { maxHp: 18, speed: 6, baseReactionPoints: 2 });
Object.assign(characters.lancer, { maxHp: 20, speed: 8, baseReactionPoints: 2 });
Object.assign(characters.scout, { maxHp: 16, speed: 10, baseReactionPoints: 2 });
Object.assign(characters.pivot, { maxHp: 22, speed: 5, baseActionPoints: 2, baseReactionPoints: 2 });
characters.guardian = {
  id: "guardian",
  displayName: CHARACTER_NAMES.guardian,
  maxHp: 26,
  speed: 3,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "front", "guard"],
};
characters.arcanist = {
  id: "arcanist",
  displayName: CHARACTER_NAMES.arcanist,
  maxHp: 16,
  speed: 5,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "rear", "attack"],
};
characters.tactician = {
  id: "tactician",
  displayName: CHARACTER_NAMES.tactician,
  maxHp: 17,
  speed: 7,
  baseActionPoints: 1,
  baseReactionPoints: 2,
  signatureRules: [],
  tags: ["playable", "rear", "tempo"],
};

// R6 §4.4 — Phase A の人物 parameter。**この表は R6 が明示した仮値**で、
// 実装側で勝手に動かさない（R6 §21）。名前ごとの engine 分岐ではなく、
// CharacterDef の data として持つ。
//
// 全員が might と focus を持つ。だから weapon 役にも支援技能を、
// 支援役にも technique 攻撃を付けられる。
export const CHARACTER_STATS = {
  warden:    { maxHp: 260, might: 32, focus: 24, guard: 10, speed: 4,  baseActionPoints: 1, baseReactionPoints: 2 },
  mender:    { maxHp: 180, might: 18, focus: 44, guard: 3,  speed: 6,  baseActionPoints: 1, baseReactionPoints: 2 },
  lancer:    { maxHp: 200, might: 46, focus: 18, guard: 4,  speed: 8,  baseActionPoints: 1, baseReactionPoints: 2 },
  scout:     { maxHp: 160, might: 36, focus: 26, guard: 2,  speed: 10, baseActionPoints: 1, baseReactionPoints: 2 },
  pivot:     { maxHp: 220, might: 32, focus: 32, guard: 6,  speed: 5,  baseActionPoints: 2, baseReactionPoints: 2 },
  guardian:  { maxHp: 260, might: 26, focus: 24, guard: 12, speed: 3,  baseActionPoints: 1, baseReactionPoints: 2 },
  arcanist:  { maxHp: 160, might: 16, focus: 50, guard: 2,  speed: 5,  baseActionPoints: 1, baseReactionPoints: 2 },
  tactician: { maxHp: 170, might: 24, focus: 40, guard: 3,  speed: 7,  baseActionPoints: 1, baseReactionPoints: 2 },
};

for (const [id, stats] of Object.entries(CHARACTER_STATS)) {
  Object.assign(characters[id], stats);
}

// 固有の性質が持つ量も、その人の focus で伸びるようにする
// （scout の「先を読む」防壁など）。持ち主が育てば固有も伸びる。
for (const definition of Object.values(characters)) {
  scaleDefinitionAmounts(definition, { stat: "focus" });
}

export const CHARACTERS = characters;
