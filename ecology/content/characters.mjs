// ecology/content/characters.mjs
//
// **仲間の engine 定義。編成画面向けの役割・図像は roster.mjs。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 人物 担当だけ。engine・schema・共通registryは変更しない。

import { renamed } from "./base.mjs";

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

export const CHARACTERS = characters;
