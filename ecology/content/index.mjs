// ecology/content/index.mjs
//
// **content bundle の組み立てだけを行う。** 定義そのものは種類別ファイルにある。
// 種類を増やすときは、ここへ一行足して registry へ載せる。
//
// R7 の content contract：ここが公開する意味（ID、event、effect、target、単位）は
// 一度出したら変えない。変えるときは schema version を上げ、migration を書く。

import { FIXTURE_CONTENT } from "../fixture-content.mjs";
import { CHARACTERS, CHARACTER_NAMES } from "./characters.mjs";
import { ACTIVE_SKILLS, ACTIVE_SKILL_NAMES } from "./skills-active.mjs";
import { REACTIVE_SKILLS, REACTIVE_SKILL_NAMES } from "./skills-reactive.mjs";
import { PASSIVE_SKILLS } from "./skills-passive.mjs";
import { FIXED_EQUIPMENT, EQUIPMENT_NAMES } from "./equipment-fixed.mjs";
import { STATUSES, STATUS_NAMES } from "./statuses.mjs";
import { ENEMY_ACTORS, ENEMY_NAMES } from "./enemies.mjs";

// **content contract の版。** ID・event・effect・target・単位の意味を変えたら上げる。
// 係数や maxHp のような soft data の変更では上げない（build の印で分かれる）。
export const CONTENT_CONTRACT_VERSION = "ecology-content-contract-2";

// **公開したあとに引退させた ID。** 保存済みの run、D1 の行、Blueprint が
// この ID を持っているので、黙って消すと過去の記録が読めなくなる。
// 消すときはここへ理由と行き先を書く。**別内容への再利用は禁止**
// （同じ ID が別の意味になると、古い記録が嘘になる）。
//
//   retired_skill_id: { since: "0.4", reason: "…", replacedBy: "new_skill_id" }
//
// analysis/ecology-contract-smoke.mjs が、凍結済み ID との差をここで照合する。
export const RETIRED_IDS = Object.freeze({});

// 表示名を持つ節。DISPLAY_NAMES の作り方をここ一箇所に閉じる。
export const NAMED_SECTIONS = Object.freeze([
  "characters",
  "activeSkills",
  "reactiveSkills",
  "equipment",
  "statuses",
  "enemyActors",
]);

export const PLAYABLE_CONTENT = Object.freeze({
  ...FIXTURE_CONTENT,
  // Phase A で戦闘量と人物 parameter が変わった。**記録を分けるために上げる**
  // （0.2 の遠征と 0.3 の遠征は別のゲームで、同じ入れ物に混ぜられない）。
  contentVersion: "ecology-playable-full-0.3",
  characters: CHARACTERS,
  activeSkills: ACTIVE_SKILLS,
  reactiveSkills: REACTIVE_SKILLS,
  passiveSkills: PASSIVE_SKILLS,
  equipment: FIXED_EQUIPMENT,
  statuses: STATUSES,
  enemyActors: ENEMY_ACTORS,
});

export const DISPLAY_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT).flatMap(([section, definitions]) =>
      NAMED_SECTIONS.includes(section)
        ? Object.entries(definitions).map(([id, definition]) => [id, definition.displayName])
        : [],
    ),
  ),
);

// 種類別の表示名表。分離の前後で名前が落ちていないことを contract.test が見る。
export const SECTION_NAMES = Object.freeze({
  characters: CHARACTER_NAMES,
  activeSkills: ACTIVE_SKILL_NAMES,
  reactiveSkills: REACTIVE_SKILL_NAMES,
  equipment: EQUIPMENT_NAMES,
  statuses: STATUS_NAMES,
  enemyActors: ENEMY_NAMES,
});

export { CHARACTER_DEFINITIONS } from "./roster.mjs";
export { ACTIVE_META, REACTIVE_META, PASSIVE_META, EQUIPMENT_META, SKILL_TREE_NODES } from "./skill-tree.mjs";
export { ENCOUNTERS, ENEMY_TARGETING } from "./encounters.mjs";
