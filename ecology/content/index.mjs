// ecology/content/index.mjs
//
// **content bundle の組み立てだけを行う。** 定義そのものは種類別ファイルにある。
// 種類を増やすときは、ここへ一行足して registry へ載せる。
//
// R7 の content contract：ここが公開する意味（ID、event、effect、target、単位）は
// 一度出したら変えない。変えるときは schema version を上げ、migration を書く。

import { CONTENT_SCHEMA_VERSION } from "../schema.mjs";
import { CHARACTERS } from "./characters.mjs";
import { CHARACTER_LORE, CHARACTER_NAMES, characterLoreFor } from "./character-lore.mjs";
import { HOMESTEAD_FIXTURE_LORE, REGION_LORE, WORLD_LORE } from "./world-lore.mjs";
import { FIXED_EQUIPMENT, EQUIPMENT_NAMES } from "./equipment-fixed.mjs";
import { STATUSES, STATUS_NAMES } from "./statuses.mjs";
import { ENEMY_ACTORS, ENEMY_NAMES } from "./enemies.mjs";
import {
  ENEMY_ACTIVE_SKILLS,
  ENEMY_ACTIVE_SKILL_IDS,
  ENEMY_REACTIVE_SKILLS,
  ENEMY_REACTIVE_SKILL_IDS,
  ENEMY_PASSIVE_SKILLS,
} from "./enemy-skills.mjs";
import {
  WARHAMMER_ACTIVE_SKILLS,
  WARHAMMER_PASSIVE_SKILLS,
  WARHAMMER_REACTIVE_SKILLS,
  WARHAMMER_TARGET_SKILLS,
  WARHAMMER_TREE,
} from "./weapon-warhammer.mjs";
import {
  DUAL_BLADES_ACTIVE_SKILLS,
  DUAL_BLADES_PASSIVE_SKILLS,
  DUAL_BLADES_REACTIVE_SKILLS,
  DUAL_BLADES_TARGET_SKILLS,
  DUAL_BLADES_TREE,
} from "./weapon-dual-blades.mjs";
import {
  GAUNTLETS_ACTIVE_SKILLS,
  GAUNTLETS_PASSIVE_SKILLS,
  GAUNTLETS_REACTIVE_SKILLS,
  GAUNTLETS_TARGET_SKILLS,
  GAUNTLETS_TREE,
} from "./weapon-gauntlets.mjs";
import {
  LAUNCHER_ACTIVE_SKILLS,
  LAUNCHER_PASSIVE_SKILLS,
  LAUNCHER_REACTIVE_SKILLS,
  LAUNCHER_TARGET_SKILLS,
  LAUNCHER_TREE,
} from "./weapon-launcher.mjs";
import {
  TOWER_SHIELD_ACTIVE_SKILLS,
  TOWER_SHIELD_PASSIVE_SKILLS,
  TOWER_SHIELD_REACTIVE_SKILLS,
  TOWER_SHIELD_TARGET_SKILLS,
  TOWER_SHIELD_TREE,
} from "./weapon-tower-shield.mjs";
import {
  LONG_SPEAR_ACTIVE_SKILLS,
  LONG_SPEAR_PASSIVE_SKILLS,
  LONG_SPEAR_REACTIVE_SKILLS,
  LONG_SPEAR_TARGET_SKILLS,
  LONG_SPEAR_TREE,
} from "./weapon-long-spear.mjs";
import {
  MEDICAL_KIT_ACTIVE_SKILLS,
  MEDICAL_KIT_PASSIVE_SKILLS,
  MEDICAL_KIT_REACTIVE_SKILLS,
  MEDICAL_KIT_TARGET_SKILLS,
  MEDICAL_KIT_TREE,
} from "./weapon-medical-kit.mjs";
import {
  GRAPPLING_HOOK_ACTIVE_SKILLS,
  GRAPPLING_HOOK_PASSIVE_SKILLS,
  GRAPPLING_HOOK_REACTIVE_SKILLS,
  GRAPPLING_HOOK_TARGET_SKILLS,
  GRAPPLING_HOOK_TREE,
} from "./weapon-grappling-hook.mjs";
import {
  BANNER_ACTIVE_SKILLS,
  BANNER_PASSIVE_SKILLS,
  BANNER_REACTIVE_SKILLS,
  BANNER_TARGET_SKILLS,
  BANNER_TREE,
} from "./weapon-banner.mjs";
import {
  HEAVY_CROSSBOW_ACTIVE_SKILLS,
  HEAVY_CROSSBOW_PASSIVE_SKILLS,
  HEAVY_CROSSBOW_REACTIVE_SKILLS,
  HEAVY_CROSSBOW_TARGET_SKILLS,
  HEAVY_CROSSBOW_TREE,
} from "./weapon-heavy-crossbow.mjs";
import {
  IMPLEMENTED_WEAPON_IDS,
  WEAPONS,
  WEAPON_IDS_BY_CHARACTER,
  WEAPON_SKILL_NODE_BY_ID,
  WEAPON_SKILL_TREE_NODES,
  weaponSkillNode,
  weaponSkillNodes,
  weaponIdsForCharacterIds,
} from "./weapon-trees.mjs";
import { WEAPON_SKILL_SPECIFICATIONS } from "./weapon-specifications.mjs";

const PLAYER_SKILL_DEFINITIONS = Object.freeze({
  ...WARHAMMER_ACTIVE_SKILLS, ...WARHAMMER_TARGET_SKILLS,
  ...WARHAMMER_REACTIVE_SKILLS, ...WARHAMMER_PASSIVE_SKILLS,
  ...DUAL_BLADES_ACTIVE_SKILLS, ...DUAL_BLADES_TARGET_SKILLS,
  ...DUAL_BLADES_REACTIVE_SKILLS, ...DUAL_BLADES_PASSIVE_SKILLS,
  ...GAUNTLETS_ACTIVE_SKILLS, ...GAUNTLETS_TARGET_SKILLS,
  ...GAUNTLETS_REACTIVE_SKILLS, ...GAUNTLETS_PASSIVE_SKILLS,
  ...LAUNCHER_ACTIVE_SKILLS, ...LAUNCHER_TARGET_SKILLS,
  ...LAUNCHER_REACTIVE_SKILLS, ...LAUNCHER_PASSIVE_SKILLS,
  ...MEDICAL_KIT_ACTIVE_SKILLS, ...MEDICAL_KIT_TARGET_SKILLS,
  ...MEDICAL_KIT_REACTIVE_SKILLS, ...MEDICAL_KIT_PASSIVE_SKILLS,
  ...TOWER_SHIELD_ACTIVE_SKILLS, ...TOWER_SHIELD_TARGET_SKILLS,
  ...TOWER_SHIELD_REACTIVE_SKILLS, ...TOWER_SHIELD_PASSIVE_SKILLS,
  ...LONG_SPEAR_ACTIVE_SKILLS, ...LONG_SPEAR_TARGET_SKILLS,
  ...LONG_SPEAR_REACTIVE_SKILLS, ...LONG_SPEAR_PASSIVE_SKILLS,
  ...GRAPPLING_HOOK_ACTIVE_SKILLS, ...GRAPPLING_HOOK_TARGET_SKILLS,
  ...GRAPPLING_HOOK_REACTIVE_SKILLS, ...GRAPPLING_HOOK_PASSIVE_SKILLS,
  ...BANNER_ACTIVE_SKILLS, ...BANNER_TARGET_SKILLS,
  ...BANNER_REACTIVE_SKILLS, ...BANNER_PASSIVE_SKILLS,
  ...HEAVY_CROSSBOW_ACTIVE_SKILLS, ...HEAVY_CROSSBOW_TARGET_SKILLS,
  ...HEAVY_CROSSBOW_REACTIVE_SKILLS, ...HEAVY_CROSSBOW_PASSIVE_SKILLS,
});

function playerSkillsOfKind(kind) {
  const passiveSkillIds = new Set(WEAPON_SKILL_TREE_NODES
    .filter((node) => node.kind === "passive")
    .map((node) => node.skillId));
  return Object.freeze(Object.fromEntries(WEAPON_SKILL_TREE_NODES
    .filter((node) => node.kind === kind)
    .map((node) => {
      const implementation = PLAYER_SKILL_DEFINITIONS[node.skillId];
      if (!implementation) throw new Error(`Missing skill implementation: ${node.skillId}`);
      const classificationTags = new Set(["active", "target", "reactive", "reaction", "passive"]);
      const tags = (implementation.tags ?? []).filter((tag) => !classificationTags.has(tag));
      const kindTags = kind === "reactive" ? ["reactive", "reaction"] : [kind];
      const skill = {
        ...implementation,
        weaponId: node.weaponId,
        treePosition: node.position,
        kind,
        displayName: node.displayName,
        displayEffect: node.displayEffect,
        flavorText: node.flavorText,
        implementationContract: node.implementationContract,
        catalogPosition: node.position,
        tags: [...new Set([...tags, ...kindTags, "weapon", "playable"])],
      };
      if (kind !== "passive") delete skill.replacesPassiveSkillIds;
      else if (skill.replacesPassiveSkillIds) {
        skill.replacesPassiveSkillIds = skill.replacesPassiveSkillIds.filter((id) => passiveSkillIds.has(id));
        if (skill.replacesPassiveSkillIds.length === 0) delete skill.replacesPassiveSkillIds;
      }
      return [node.skillId, Object.freeze(skill)];
    })));
}

const PLAYER_SKILLS_BY_KIND = Object.freeze({
  activeSkills: playerSkillsOfKind("active"),
  targetSkills: playerSkillsOfKind("target"),
  reactiveSkills: playerSkillsOfKind("reactive"),
  passiveSkills: playerSkillsOfKind("passive"),
});

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
// 二段を足した。manifest に equipmentPackDepths / partySize / castCharacterIds が増え、
// composeEncounter が partySize を読むようになった。**語彙が増えたので上げる。**
// R15 — triage が自分以外の味方だけを対象にする `not_self` フィルタを追加し、
// Stage 0 のツグミに「前衛をつなぐ人」という別の仕事を明示した。
// R16（技能の大量追加）— 状態を3つ（怯み staggered / 守勢 warded / 裂傷 bleeding）、
// 技能を54本（active 29・reactive 19・passive 6）足した。**engine と schema の語彙は
// 1つも増やしていない**（既存の event・effect・predicate・target だけで書けている）。
// R17 — `focus` の表示語彙を「技術」へ統一した。内部 ID と状態 `focused` の表示「集中」は変えない。
// R19（issue #137）の旧技能レベル・共通 pack ツリーは PR #288 で廃止した。
// 現行のプレイヤー技能は武器ツリーだけを正本にし、前提は取得済みIDの有無だけを見る。
// R20 — 速度能力値と速度依存の対象選択を削除し、隊列を使う対象選択へ置き換えた。
// R21 — EquipmentDef に装着中だけ加算する statBonus を追加し、すべての新規生成品が
// item rarity と同格の無条件基礎効果を持つようにした。
// issue #148 のレベル埋め込み表示も廃止し、技能説明は定義済みの固定値をそのまま表示する。
// Issue #175 — resource cycles, refiring, self-cost damage, overflow lineage,
// and finite rule limits are now part of the checked content contract.
// Issue #210 — generated equipment rules now carry a mandatory durability cost;
// repair is the documented finite-cost exception and statBonus stays outside rules.
// issue #238 — 状態の語彙が一つ増えた（必殺 ultimate_spent）。規則を持たない記録だけの
// 状態だが、**保存済みの戦闘記録に出てこない ID が出るようになる**ので版を上げる。
// 必殺技そのものの定義は固定 content に入れない（取得済み技能から毎回作る）ので、
// ここの ID 表は増えない。
// R22 — 直接回復を被弾量比例から技術40%の固定量へ変更し、同じ攻撃／反応 chain の
// 隊全体で受けたHPダメージを回復総量の上限にした。
// R23 — shared_pain を回復から damage_proposed の分散へ変更した。軽減量は固定とし、
// 所有者へ移す4割も通常の防御・被弾イベントを通す。
// PR #255 / #151 — 装備の語彙が増え（与ダメージを読む trigger、ダメージ増加、
// 全体への隙、裂傷を読む条件と払い先、ダメージを太らせる keystone）、回復の
// 基準値が上がった。報酬候補から補給が外れ、候補を出す戦闘がボス戦だけになった。
// **保存済みの遠征・Blueprint に出てこない affix ID が出るようになる**ので版を上げる。
// PR #255 続き — 生成装備の readout が rule ごとの構造（いつ・何を払い・何回）を
// 持つようになった。**保存済みの Blueprint は `lines` しか持たない**ので、画面は
// どちらでも壊れないように読む。欄が増えたので版を上げる。
// R23 — 第一部10 Stage 化。**語彙を足しただけで、公開済み ID の意味は変えていない。**
//   足した ID … 敵19体（灰塵7・灰織6・灰炉6）、boss law 9件、
//                ギルド投資2件（装備枠・野営の手当て）、Stage 6件（stage_4〜stage_9）
//   変えた値 … 敵の三能力と threat cost、活動資金の入り、鍛錬の段と費用
//   変えていない … effect / predicate / event の語彙、engine、schema
// 2026-09-13 — `cover_ally` を pack_edge の core へ移し、ナギ加入の Stage 1 で
// 身代わりを解禁する。`shield_handoff` は pack_wall の Stage 2 に残る。
// パック構成が変わるため、旧 manifest と混同しないよう contract version を上げる。
// issue #189 / #190 / #128 — 固定値だった状態を割合へ変え、移動・身代わり・
// AP受け渡しの発動条件と結果も変えた。同じ入力の戦闘結果が変わるため版を上げる。
// R24 — 6packへRP0の条件付き反応を2本ずつ、条件付き常設を2本ずつ追加した。
// R25 — Stage 1以降の敵を部隊化する7体（庇護・治療・弱体・多段と最終主心）と
// 最終boss lawを追加した。既存のengine/schema語彙だけだが、公開IDが増えるため上げる。
// R25 engine vocabulary: migrated weapon actions can opt into explicit
// melee/long/ranged/support positioning, and actions can move to an empty row
// then return at action end. Existing skill definitions retain legacy behavior.
// R25 weapon acquisition: manifests now freeze enabledWeaponIds independently
// from packs. The dual-blades A→AA slice also establishes pre-action movement
// that keys off the shared resolved reach class, never a particular active ID.
// Stage 0 の攻撃系として格闘具・射出器・医療具をR〜BBの19節へ接続し、
// Stage 1 の大盾・長槍、Stage 2 の鉤縄、Stage 3 の号旗・重弩も同じ
// registryへ接続した。
// R25 dual-blades completion: AB/B/BA/BB branches, reserve-blade status,
// round-robin hit distribution, and explicit skipped-hit packet amounts.
// R27 weapon completion: the remaining four weapons expose their full trees.
// 医療具の主行動は防壁中心、蘇生は有限RPの反応へ置く。
export const CONTENT_CONTRACT_VERSION = "ecology-content-contract-40";

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
  "targetSkills",
  "reactiveSkills",
  "passiveSkills",
  "enemyActiveSkills",
  "enemyReactiveSkills",
  "enemyPassiveSkills",
  "equipment",
  "statuses",
  "enemyActors",
]);

export const PLAYABLE_CONTENT = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  // PR #288 — player は武器技能、enemy は enemy-skills、pack は equipment / skill
  // の二つの registry を使う。旧セーブと旧共通技能ツリーはこの build では読まない。
  // Content Wave 1 のスキル追加・バランス調整と、Phase B の3幕12戦も含む。
  // R16 で技能54本・状態3つを足した。R20 で速度能力値を削除し、R21 で装備の
  // 無条件 statBonus を追加した。R22 で直接回復量の意味を変更し、R23 で
  // shared_pain の回復を damage 分散へ変更した。
  //
  // issue #176（#165 段階2）で 0.15 へ上げた。R22 の意味変更で 0.16 へ上げ、
  // R23 の shared_pain の意味変更で 0.17、状態・移動・技能収支の見直しで 0.18、
  // R24 の無料反応・条件付き常設で 0.19 へ上げる。
  // **公開済み ID の意味が変わったから**である
  // （AGENTS.md「version の不一致を黙って無視しない」）。技能も装備も ID は一つも
  // 増減していないが、次の二つで同じ入力から違う結果が出る。
  //
  //   1. 「最も傷ついた味方」を選ぶ query が、残りHPの小ささ（hp_asc）から
  //      傷の割合（hp_percent_asc）へ変わった。庇護・防壁・守勢・回復の宛先が動く。
  //   2. 敵の攻撃の狙い先が「行の先頭」から「届く範囲で最も HP の低い味方」へ変わった
  //      （content/enemy-skills.mjs の front_strike / rear_strike / enemy_heavy）。
  //      以前は前列左と後列左しか殴られず、主火力の既定位置が安全地帯だった。
  //
  // 0.15 で保存した replay・Blueprint・遠征記録は、この build では同じ列を再生しない。
  contentVersion: "ecology-playable-full-0.30",
  characters: CHARACTERS,
  // Player skills are weapon-owned only. Enemy skills are registered separately
  // below and never leak into the player catalog.
  activeSkills: PLAYER_SKILLS_BY_KIND.activeSkills,
  // All ten weapon trees are now content-backed. Fixture-only selectors must
  // never leak into playable content.
  targetSkills: PLAYER_SKILLS_BY_KIND.targetSkills,
  reactiveSkills: PLAYER_SKILLS_BY_KIND.reactiveSkills,
  passiveSkills: PLAYER_SKILLS_BY_KIND.passiveSkills,
  enemyActiveSkills: ENEMY_ACTIVE_SKILLS,
  enemyReactiveSkills: ENEMY_REACTIVE_SKILLS,
  enemyPassiveSkills: ENEMY_PASSIVE_SKILLS,
  equipment: FIXED_EQUIPMENT,
  statuses: STATUSES,
  enemyActors: ENEMY_ACTORS,
  // R6 §6.4 — 攻撃テンポの保証に使う行動を、content が名指しする。
  // **engine は個別 ID で分岐せず、この宣言を読むだけ。**
  coreActions: Object.freeze({
    basicStrike: Object.freeze({ melee: "warhammer_blow", ranged: "launcher_shot" }),
    fallbackStrike: Object.freeze({ melee: "warhammer_blow", ranged: "launcher_shot" }),
    enemyBasicStrike: Object.freeze({ melee: "front_strike", ranged: "rear_strike" }),
    enemyFallbackStrike: Object.freeze({ melee: "front_strike", ranged: "rear_strike" }),
  }),
});

export {
  IMPLEMENTED_WEAPON_IDS,
  WEAPONS,
  WEAPON_IDS_BY_CHARACTER,
  WEAPON_SKILL_NODE_BY_ID,
  WEAPON_SKILL_TREE_NODES,
  WEAPON_SKILL_SPECIFICATIONS,
  weaponSkillNode,
  weaponSkillNodes,
  weaponIdsForCharacterIds,
  DUAL_BLADES_TREE,
  GAUNTLETS_TREE,
  LAUNCHER_TREE,
  MEDICAL_KIT_TREE,
  TOWER_SHIELD_TREE,
  LONG_SPEAR_TREE,
  GRAPPLING_HOOK_TREE,
  BANNER_TREE,
  HEAVY_CROSSBOW_TREE,
};

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
  activeSkills: Object.freeze(Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT.activeSkills).map(([id, definition]) => [id, definition.displayName]),
  )),
  targetSkills: Object.freeze(Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT.targetSkills).map(([id, definition]) => [id, definition.displayName]),
  )),
  reactiveSkills: Object.freeze(Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT.reactiveSkills).map(([id, definition]) => [id, definition.displayName]),
  )),
  passiveSkills: Object.freeze(Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT.passiveSkills).map(([id, definition]) => [id, definition.displayName]),
  )),
  enemyActiveSkills: Object.freeze(Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT.enemyActiveSkills).map(([id, definition]) => [id, definition.displayName]),
  )),
  enemyReactiveSkills: Object.freeze(Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT.enemyReactiveSkills).map(([id, definition]) => [id, definition.displayName]),
  )),
  enemyPassiveSkills: Object.freeze(Object.fromEntries(
    Object.entries(PLAYABLE_CONTENT.enemyPassiveSkills).map(([id, definition]) => [id, definition.displayName]),
  )),
  equipment: EQUIPMENT_NAMES,
  statuses: STATUS_NAMES,
  enemyActors: ENEMY_NAMES,
});

// 設定本文の正本。表示・開示ロジックから直接参照できるよう公開する。
export { CHARACTER_LORE, CHARACTER_NAMES, characterLoreFor };
export { WARHAMMER_TREE };
export { HOMESTEAD_FIXTURE_LORE, REGION_LORE, WORLD_LORE };

export { CHARACTER_DEFINITIONS } from "./roster.mjs";
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
  EQUIPMENT_PACKS,
  EQUIPMENT_PACK_BY_ID,
  PACK_BY_ID,
  PACK_COMBAT_ROLES,
  PACK_DEPTHS,
} from "./packs.mjs";
export {
  WEAPON_SKILL_PACKS,
  WEAPON_SKILL_PACK_BY_ID,
  skillPackIdsForWeaponIds,
  weaponIdsForSkillPackIds,
} from "./skill-packs.mjs";
export {
  ENEMY_ACTIVE_SKILL_IDS,
  ENEMY_REACTIVE_SKILL_IDS,
  ENEMY_ACTIVE_SKILLS,
  ENEMY_REACTIVE_SKILLS,
  ENEMY_PASSIVE_SKILLS,
} from "./enemy-skills.mjs";
// R8 Implementation Phase 1 — Campaign Stage 0〜3 の固定 manifest。
export {
  CAMPAIGN_STAGES,
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_BY_SEQUENCE,
  LADDER_MODES,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  DOSSIER_FINAL_STAGE_SEQUENCE,
  FULL_PARTY_STAGE_SEQUENCE,
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
export { PROLOGUE, SKILL_LESSON, STORY_BEATS, ULTIMATE_LESSON, castOnStage, storyBeat, storyBeatsForStage } from "./story.mjs";
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
  PORTRAIT_FACE_VIEWBOX,
  PORTRAIT_IDS,
  PORTRAIT_IMAGE_URLS,
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
