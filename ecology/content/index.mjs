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
import { skillLevelCaps } from "./skill-levels.mjs";
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
// affix family、装備の rule 文法を content 語彙として公開した。manifest の
// enabledAffixFamilyIds が空配列固定から「その遠征で引ける affix family」へ
// 意味を持った。**語彙が増え、既存欄の意味が変わったので上げる。**
// R9（初期4Stageのチュートリアル化）— 導入 pack の接続面と常設
// （whetted_by_pain / shield_handoff / patient_step / shield_the_wounded /
// first_blood / held_breath / steady_hands）を追加し、pack へ core / full の
// 二段を足した。manifest に packDepths / partySize / castCharacterIds が増え、
// composeEncounter が partySize を読むようになった。**語彙が増えたので上げる。**
// R15 — triage が自分以外の味方だけを対象にする `not_self` フィルタを追加し、
// Stage 0 のツグミに「前衛をつなぐ人」という別の仕事を明示した。
// R16（技能の大量追加）— 状態を3つ（怯み staggered / 守勢 warded / 裂傷 bleeding）、
// 技能を54本（active 29・reactive 19・passive 6）足した。**engine と schema の語彙は
// 1つも増やしていない**（既存の event・effect・predicate・target だけで書けている）。
// R17 — `focus` の表示語彙を「技術」へ統一した。内部 ID と状態 `focused` の表示「集中」は変えない。
// R19（issue #137）— 技能レベルを足し、ツリーの節を組み替えた。**技能も pack も
// 1本たりとも増減していない**（節数は `SKILL_TREE_NODES.length`、内訳と予算は
// `analysis/ecology-canonical-numbers-smoke.mjs` / `analysis/ecology-skill-catalog-smoke.mjs` の
// 出力を参照）が、(1) 既存の技能が Lv1〜Lv10 を持ち、
// `skillLevelCaps` を公開した。battle input が `skillLevels` を受ける。
// (2) 節が `tier`（0/1/2）ではなく `x`（前提からの深さ、1〜10）を持ち、`requires` が
// 「tier ごとの箱」から「一本の道」へ並び替わった。**既存欄の意味が変わったので上げる。**
// R20 — 速度能力値と速度依存の対象選択を削除し、隊列を使う対象選択へ置き換えた。
// R21 — EquipmentDef に装着中だけ加算する statBonus を追加し、すべての新規生成品が
// item rarity と同格の無条件基礎効果を持つようにした。
// issue #148 — 技能の表示文が、**そのまま出せる文字列ではなくなった。**レベルで伸びる
// 量（変動量）は本文に書かず `{amount}` / `{total}` / `{hits}` で定義を指し、表示の直前に
// `skillTextAtLevel` が埋める。数字を二箇所に書かないので「係数を変えたのに説明文が旧値の
// まま」が起こらない。**既存欄（*_META の説明文）の読み方が変わったので上げる。**
// Issue #175 — resource cycles, refiring, self-cost damage, overflow lineage,
// and finite rule limits are now part of the checked content contract.
// Issue #210 — generated equipment rules now carry a mandatory durability cost;
// repair is the documented finite-cost exception and statBonus stays outside rules.
export const CONTENT_CONTRACT_VERSION = "ecology-content-contract-18";

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
  foundation_speed: {
    since: "ecology-content-contract-13",
    reason: "速度能力値を削除し、隊列順を行動順と対象選択の基準にしたため",
  },
  ap_loop: {
    since: "issue-130",
    reason: "R5 termination fixture は無限イベント連鎖の検証専用であり、本編コンテンツから除外した",
  },
  damage_echo: {
    since: "issue-130",
    reason: "R5 termination fixture は無限イベント連鎖の検証専用であり、本編コンテンツから除外した",
  },
  barrier_bloom: {
    since: "issue-130",
    reason: "R5 termination fixture は無限イベント連鎖の検証専用であり、本編コンテンツから除外した",
  },
  relay_front: {
    since: "issue-130",
    reason: "R5 termination fixture は無限イベント連鎖の検証専用であり、本編コンテンツから除外した",
  },
  relay_rear: {
    since: "issue-130",
    reason: "R5 termination fixture は無限イベント連鎖の検証専用であり、本編コンテンツから除外した",
  },
  prep_spiral: {
    since: "issue-130",
    reason: "R5 termination fixture は無限イベント連鎖の検証専用であり、本編コンテンツから除外した",
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
  // R16 で技能54本・状態3つを足した。R20 で速度能力値を削除し、R21 で装備の
  // 無条件 statBonus を追加した。
  //
  // issue #176（#165 段階2）で 0.15 へ上げた。**公開済み ID の意味が変わったから**である
  // （AGENTS.md「version の不一致を黙って無視しない」）。技能も装備も ID は一つも
  // 増減していないが、次の二つで同じ入力から違う結果が出る。
  //
  //   1. 「最も傷ついた味方」を選ぶ query が、残りHPの小ささ（hp_asc）から
  //      傷の割合（hp_percent_asc）へ変わった。庇護・防壁・守勢・回復の宛先が動く。
  //   2. 敵の攻撃の狙い先が「行の先頭」から「届く範囲で最も HP の低い味方」へ変わった
  //      （content/skills-active.mjs の front_strike / rear_strike / enemy_heavy）。
  //      以前は前列左と後列左しか殴られず、主火力の既定位置が安全地帯だった。
  //
  // 0.14 で保存した replay・Blueprint・遠征記録は、この build では同じ列を再生しない。
  contentVersion: "ecology-playable-full-0.15",
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

// R19（issue #137）— 技能レベルの上限。**PLAYABLE_CONTENT が組み上がってから引く**
// ので、定義を書き換えれば上限もついてくる（手書きの表がずれることがない）。
export const SKILL_LEVEL_CAPS = skillLevelCaps(PLAYABLE_CONTENT);
export {
  SKILL_LEVEL_COST,
  skillLevelCap,
  // issue #148 — 変動量は定義側にあり、説明文は {amount} でそこを指す。
  leveledAmountOf,
  // issue #177 — 「誰の何で伸びるのか」と、その人物が使ったときの実数。
  leveledEffectOf,
  leveledValueAt,
  skillLevelValueSteps,
  skillTextAtLevel,
  skillTextIssues,
} from "./skill-levels.mjs";

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
export {
  ACTIVE_META,
  REACTIVE_META,
  PASSIVE_META,
  EQUIPMENT_META,
  SKILL_TREE_NODES,
  // issue #168 — 前提は `{ skillId, minLv }`。判定と ID 取り出しは一箇所を通る。
  prerequisitesMet,
  requiredSkillIds,
  unmetPrerequisites,
} from "./skill-tree.mjs";
// R19（issue #137）— 節の座標。`requires` から組んだ森なので、ここを読めば
// 「どの節がどの節から生えるのか」が線として引ける。
export {
  BRANCH_BUILDS,
  BRANCH_ORDER,
  SCOPE_LABELS,
  SKILL_TREE_GROUPS,
  SKILL_TREE_LAYOUT,
  TRIGGER_LABELS,
  buildSkillTreeLayout,
  validateSkillTreeLayout,
} from "./skill-tree-layout.mjs";
export { ENEMY_CODEX, ENEMY_LORE, ENEMY_TARGETING } from "./encounters.mjs";
// issue #176 — 状態（バフ・デバフ）の意味。**定義の隣に一度だけ書いたものを画面が読む。**
export { STATUS_GLOSSARY } from "./statuses.mjs";
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
  // issue #172 — 改名前 Stage ID の displayName 引き当て。
  RETIRED_CAMPAIGN_STAGE_IDS,
  TUTORIAL_MAX_SEQUENCE,
  activePackCountForSequence,
  auditCampaignManifestLadder,
  campaignManifestForStage,
  campaignStageDef,
  campaignStageDisplayNameFor,
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
// R8 Implementation Phase 4（Phase C）— 装備の affix 目録。
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
  EFFECT_RARITY_LABEL,
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
