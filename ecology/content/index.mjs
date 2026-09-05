// ecology/content/index.mjs
//
// **content bundle の組み立てだけを行う。** 定義そのものは種類別ファイルにある。
// 種類を増やすときは、ここへ一行足して registry へ載せる。
//
// R7 の content contract：ここが公開する意味（ID、event、effect、target、単位）は
// 一度出したら変えない。変えるときは schema version を上げ、migration を書く。

import { FIXTURE_CONTENT } from "../fixture-content.mjs";
import { CHARACTERS } from "./characters.mjs";
import { CHARACTER_LORE, CHARACTER_NAMES, characterLoreFor } from "./character-lore.mjs";
import { HOMESTEAD_FIXTURE_LORE, REGION_LORE, WORLD_LORE } from "./world-lore.mjs";
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
// R8 Implementation Phase 1（続き）— mend/triage を active から reactive へ
// 作り替えた（意味が変わったので追加ではなく上げる。§3.9「一度公開した意味を
// 黙って変えない」への対応。ID と表示名はそのままで、kind だけ active から
// reactiveSkills へ移った。ecology-contract-smoke.mjs の「別内容への再利用は
// 禁止」検査に引っかかるので、下の RETIRED_IDS へ理由と行き先を明記する）。
// R8 Implementation Phase 2 — pack_barrage の probe content
// （mark_break / sweeping_barrage / piercing_barrage / guarded_opening /
// seize_the_opening）を追加した。語彙が増えたので上げる。
// R8 Implementation Phase 4（Phase C）— affix 目録（content/affixes.mjs）、
// affix family、生成装備の rule 文法を content 語彙として公開した。manifest の
// enabledAffixFamilyIds が空配列固定から「その遠征で引ける affix family」へ
// 意味を持った。**語彙が増え、既存欄の意味が変わったので上げる。**
// R9（初期4Stageのチュートリアル化）— 導入 pack の接続面と常設
// （whetted_by_pain / shield_handoff / patient_step / shield_the_wounded /
// first_blood / held_breath / steady_hands）を追加し、pack へ core / full の
// 二段を足した。manifest に packDepths / partySize / castCharacterIds が増え、
// composeEncounter が partySize を読むようになった。**語彙が増えたので上げる。**
// R15 — triage が自分以外の味方だけを対象にする `not_self` フィルタを追加し、
// Stage 0 のツグミを「自分を治す人」から「前衛をつなぐ人」へ明示した。
export const CONTENT_CONTRACT_VERSION = "ecology-content-contract-9";

// **公開したあとに引退させた ID。** 保存済みの run、D1 の行、Blueprint が
// この ID を持っているので、黙って消すと過去の記録が読めなくなる。
// 消すときはここへ理由と行き先を書く。**別内容への再利用は禁止**
// （同じ ID が別の意味になると、古い記録が嘘になる）。
//
//   retired_skill_id: { since: "0.4", reason: "…", replacedBy: "new_skill_id" }
//
// analysis/ecology-contract-smoke.mjs が、凍結済み ID との差をここで照合する。
export const RETIRED_IDS = Object.freeze({
  // R8 Implementation Phase 1（続き）— activeSkills.mend / activeSkills.triage を
  // 引退させた。**別内容への再利用ではない**——同じ意味・同じ表示名の技能を
  // reactiveSkills.mend / reactiveSkills.triage として作り替えたので、ID・
  // 表示名はそのまま、content section だけが変わった。理由は
  // anti-stall 契約は docs/DESIGN.md §4。
  mend: {
    since: "ecology-content-contract-5",
    reason: "AP専用のactiveがHP持ち越し下でanti-stall不変条件に違反した"
      + "（analysis/ecology-anti-stall-audit.mjs）。damage_taken反応・chain限定の"
      + "reactiveへ作り替えた。",
    replacedBy: "reactiveSkills.mend",
  },
  triage: {
    since: "ecology-content-contract-5",
    reason: "mend と同じ理由。",
    replacedBy: "reactiveSkills.triage",
  },
});

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
  contentVersion: "ecology-playable-full-0.8",
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

// 設定本文の正本。表示・開示ロジックから直接参照できるよう公開する。
export { CHARACTER_LORE, CHARACTER_NAMES, characterLoreFor };
export { HOMESTEAD_FIXTURE_LORE, REGION_LORE, WORLD_LORE };

export { CHARACTER_DEFINITIONS } from "./roster.mjs";
export { ACTIVE_META, REACTIVE_META, PASSIVE_META, EQUIPMENT_META, SKILL_TREE_NODES } from "./skill-tree.mjs";
export { ENCOUNTERS, ENEMY_CODEX, ENEMY_LORE, ENEMY_TARGETING } from "./encounters.mjs";
// R12 §4.A — 読める設定（ギルドカード）。engine には出ない、表示だけの content。
export {
  DOSSIERS,
  DOSSIER_IDS,
  DOSSIER_SECTIONS,
  DOSSIER_SECTION_HEADINGS,
  dossierFor,
  dossierName,
  dossierRevealLevel,
  revealedBonds,
  revealedDossierSections,
} from "./dossiers.mjs";
export { EQUIPMENT_GROUPS, STARTER_EQUIPMENT_IDS } from "./equipment-fixed.mjs";
// R7 Milestone 4（Phase B）— 遠征、技能パック、難易度。
export {
  BASELINE_ACTIVE_SKILL_IDS,
  BASELINE_PASSIVE_SKILL_IDS,
  BASELINE_REACTIVE_SKILL_IDS,
  PACKS_PER_MANIFEST,
  PACK_BY_ID,
  PACK_COMBAT_ROLES,
  PACK_DEPTHS,
  SKILL_PACKS,
  packOfSkill,
  packSkillIds,
  skillIdsForPacks,
} from "./packs.mjs";
// R8 Implementation Phase 1 — Campaign Stage 0〜3 の固定 manifest。
export {
  CAMPAIGN_STAGES,
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_BY_SEQUENCE,
  LADDER_MODES,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  TUTORIAL_MAX_SEQUENCE,
  activePackCountForSequence,
  auditCampaignManifestLadder,
  campaignManifestForStage,
  campaignStageDef,
  partySizeForStage,
} from "./campaign-stages.mjs";
// 会話本文はここから一箇所で参照できる。文言の編集先は dialogue.mjs。
export { DIALOGUE, DIALOGUE_IDS, castFor, dialogueFor } from "./dialogue.mjs";
// R9 §2 / §7 — 初期4 Stage のチュートリアル物語。
export { PROLOGUE, STORY_BEATS, castOnStage, storyBeat, storyBeatsForStage } from "./story.mjs";
// 会話の断片を組み立てる道具。**story と homestead が同じ定義を使う。**
export { beat, narrate, say, stand } from "./beat.mjs";
// R11 §2.4 / §9.4 — 根城。遠征と遠征のあいだの、日常の場面と家にあるもの。
export {
  HOMESTEAD_FIXTURES,
  HOMESTEAD_FLAG_PREFIX,
  HOMESTEAD_SCENES,
  homesteadFlag,
  homesteadScene,
  nextHomesteadScene,
  revealedFixtures,
  seenHomesteadIds,
  seenHomesteadScenes,
} from "./homestead.mjs";
// 会話画面の立ち絵。**見た目だけを持つ**（engine・schema には出ない）。
export {
  DEFAULT_EXPRESSION,
  EXPRESSIONS,
  EXPRESSION_KEYS,
  PORTRAITS,
  PORTRAIT_IDS,
  PORTRAIT_VIEWBOX,
  portraitAccent,
  portraitDef,
  portraitName,
  portraitSvg,
} from "./portraits.mjs";
// R8 Implementation Phase 4（Phase C）— 生成装備の affix 目録。
export {
  AFFIXES,
  AFFIX_BY_ID,
  AFFIXES_BY_ROLE,
  AFFIX_FAMILIES,
  AFFIX_FAMILY_BY_ID,
  AFFIX_FAMILY_IDS,
  AFFIX_ROLES,
  RARITIES,
  RARITY_BUDGET,
  RARITY_LABEL,
  RETIRED_AFFIX_IDS,
} from "./affixes.mjs";
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
