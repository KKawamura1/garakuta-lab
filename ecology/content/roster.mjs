// ecology/content/roster.mjs
//
// **編成画面から見た仲間。役割、図像、既定位置、初期の技能。人物紹介本文は character-lore.mjs。**
// R7 Milestone 0 で playable-battles.mjs から分離した。**挙動は変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// engine・schema・共通registryは変更しない。
import { CHARACTER_LORE } from "./character-lore.mjs";
import { WEAPON_IDS_BY_CHARACTER, weaponSkillNodes } from "./weapon-trees.mjs";
// R13 — 新5人（ゴウ／ツグミ／ナギ／ヒバナ／ゲンゾウ）へ差し替えた。**engine の id は
// 据え置きなので、id の語義と中身は一致しない**（`lancer` が受け役、`guardian` が遊撃役）。
// id は技能・pack・contract の対応を保つ鍵であって役割名ではない（characters.mjs 参照）。
//
// PR #288 — 初期技能は人物ごとの代表武器2本から、各武器の R と A1 を一つずつ
// 無料で持たせる。技能の種類（active / reactive / passive）は武器ツリーの定義から
// 導出し、別の pack や旧 baseline 技能を初期ロードアウトへ混ぜない。
// 以後の解禁も同じ武器ツリーを正本にするため、初期値と解禁可能なIDがずれない。
const starterWeaponSkills = (characterId, position, kind) => (WEAPON_IDS_BY_CHARACTER[characterId] ?? [])
  .flatMap((weaponId) => weaponSkillNodes(weaponId))
  .filter((node) => node.position === position && node.kind === kind)
  .map((node) => node.skillId);

export const CHARACTER_DEFINITIONS = [
  {
    id: "warden",
    role: "強打",
    icon: "拳",
    defaultPosition: "front_left",
    summary: CHARACTER_LORE.warden.summary,
    // ゴウの初期技能は、代表武器2本の R / A1 から自動で決まる。
    starterTactics: starterWeaponSkills("warden", "R", "active"),
    starterReactives: [],
    starterPassives: starterWeaponSkills("warden", "A1", "passive"),
  },
  {
    id: "mender",
    role: "医術",
    icon: "手",
    defaultPosition: "rear_right",
    summary: CHARACTER_LORE.mender.summary,
    starterTactics: starterWeaponSkills("mender", "R", "active"),
    starterReactives: starterWeaponSkills("mender", "A1", "reactive"),
    starterPassives: starterWeaponSkills("mender", "A1", "passive"),
  },
  {
    id: "lancer",
    role: "庇護",
    icon: "盾",
    defaultPosition: "front_center",
    summary: CHARACTER_LORE.lancer.summary,
    starterTactics: starterWeaponSkills("lancer", "R", "active"),
    starterReactives: [],
    starterPassives: starterWeaponSkills("lancer", "A1", "passive"),
  },
  {
    id: "guardian",
    role: "遊撃",
    icon: "風",
    defaultPosition: "rear_center",
    summary: CHARACTER_LORE.guardian.summary,
    starterTactics: starterWeaponSkills("guardian", "R", "active"),
    starterReactives: [],
    starterPassives: starterWeaponSkills("guardian", "A1", "passive"),
  },
  {
    id: "tactician",
    role: "指揮",
    icon: "筆",
    defaultPosition: "rear_left",
    summary: CHARACTER_LORE.tactician.summary,
    starterTactics: starterWeaponSkills("tactician", "R", "active"),
    starterReactives: [],
    starterPassives: starterWeaponSkills("tactician", "A1", "passive"),
  },
];
