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
// Phase B で battle input へ stats 上書き（鍛錬・変異）が入り、
// slot の構造上限が 3/3 から 4/4 になった。**語彙が増えたので上げる。**
// R8 Implementation Phase 1 — emergency_treatment（reactive skill）、
// pack_barrage（barrage_strike / mark_strike）、CampaignStageDef 語彙を追加した。
export const CONTENT_CONTRACT_VERSION = "ecology-content-contract-4";

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
  // Content Wave 1 のスキル追加・バランス調整と、Phase B の3幕12戦を
  // 反映した build 印。旧7区画とは保存済み記録を混ぜない。
  contentVersion: "ecology-playable-full-0.7",
  characters: CHARACTERS,
  activeSkills: ACTIVE_SKILLS,
  reactiveSkills: REACTIVE_SKILLS,
  passiveSkills: PASSIVE_SKILLS,
  equipment: FIXED_EQUIPMENT,
  statuses: STATUSES,
  enemyActors: ENEMY_ACTORS,
  // R6 §6.4 — 攻撃テンポの保証に使う行動を、content が名指しする。
  // **engine は個別 ID で分岐せず、この宣言を読むだけ。**
  coreActions: Object.freeze({
    basicStrike: Object.freeze({ melee: "basic_strike_melee", ranged: "basic_strike_ranged" }),
    fallbackStrike: Object.freeze({ melee: "fallback_strike_melee", ranged: "fallback_strike_ranged" }),
  }),
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
export { EQUIPMENT_GROUPS, STARTER_EQUIPMENT_IDS } from "./equipment-fixed.mjs";
// R7 Milestone 4（Phase B）— 遠征、技能パック、難易度。
export {
  BASELINE_ACTIVE_SKILL_IDS,
  BASELINE_PASSIVE_SKILL_IDS,
  PACKS_PER_MANIFEST,
  PACK_BY_ID,
  PACK_COMBAT_ROLES,
  SKILL_PACKS,
  packOfSkill,
  skillIdsForPacks,
} from "./packs.mjs";
// R8 Implementation Phase 1 — Campaign Stage 0〜3 の固定 manifest。
export {
  CAMPAIGN_STAGES,
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_BY_SEQUENCE,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  activePackCountForSequence,
  auditCampaignManifestLadder,
  campaignManifestForStage,
  campaignStageDef,
} from "./campaign-stages.mjs";
export {
  ACT_BOSS_INDEXES,
  BOSS_LAWS,
  DIFFICULTIES,
  ENCOUNTERS_PER_RUN,
  ENEMY_MUTATIONS,
  ENEMY_THREAT_COST,
  EXPEDITION_ENCOUNTERS,
  MAX_DIFFICULTY_RANK,
  MAX_MUTATIONS_PER_UNIT,
  MUTATION_SPEND_ORDER,
  REGION,
  actOf,
  difficultyDef,
  expeditionEncounter,
} from "./expedition.mjs";
