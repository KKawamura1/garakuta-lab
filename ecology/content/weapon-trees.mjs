// R25 — 武器別技能ツリーの取得用registry。
// 戦闘定義は各 weapon-*.mjs に置き、ここでは「どの武器に、どの順で、何点で入るか」だけを扱う。

import { WARHAMMER_TREE } from "./weapon-warhammer.mjs";
import { DUAL_BLADES_TREE } from "./weapon-dual-blades.mjs";
import { GAUNTLETS_TREE } from "./weapon-gauntlets.mjs";
import { LAUNCHER_TREE } from "./weapon-launcher.mjs";
import {
  MEDICAL_KIT_TREE,
  TOWER_SHIELD_TREE,
  LONG_SPEAR_TREE,
  GRAPPLING_HOOK_TREE,
  BANNER_TREE,
  HEAVY_CROSSBOW_TREE,
} from "./weapon-root-slices.mjs";

// R25設計PR #287 §8・§12 — 五人は署名武器と副武器を一つずつ導入する。
// CampaignのStageは加入済み人物を累積して持つため、manifestの武器も同じ順で累積する。
// ここには未実装武器も含めた「解禁計画」を置く。実際にツリーを表示できるかは、
// 下の IMPLEMENTED_WEAPON_IDS（content moduleの存在）で別に判定する。
const WEAPON_CATALOG = Object.freeze([
  {
    id: "warhammer",
    displayName: "戦槌",
    introducedByCharacterId: "warden",
    signatureCharacterId: "warden",
    role: "signature",
    summary: "近い敵を重く叩き、防御を砕いて次の一打へ変える。",
  },
  {
    id: "gauntlets",
    displayName: "格闘具",
    introducedByCharacterId: "warden",
    signatureCharacterId: null,
    role: "secondary",
    summary: "拍と型を盗み、倒せた時だけ安全な位置へ戻る。",
  },
  {
    id: "launcher",
    displayName: "射出器",
    introducedByCharacterId: "mender",
    signatureCharacterId: "mender",
    role: "signature",
    summary: "必要な相手へ、必要な一本を通して順番を組み替える。",
  },
  {
    id: "medical_kit",
    displayName: "医療具",
    introducedByCharacterId: "mender",
    signatureCharacterId: null,
    role: "secondary",
    summary: "傷を直接戻し、時間と命を支払って生存を延ばす。",
  },
  {
    id: "tower_shield",
    displayName: "大盾",
    introducedByCharacterId: "lancer",
    signatureCharacterId: "lancer",
    role: "signature",
    summary: "狙いを引き受け、受けた痛みを隊の生存へ変える。",
  },
  {
    id: "long_spear",
    displayName: "長槍",
    introducedByCharacterId: "lancer",
    signatureCharacterId: null,
    role: "secondary",
    summary: "一本の直線と、敵味方の行動順へ割り込む。",
  },
  {
    id: "grappling_hook",
    displayName: "鉤縄",
    introducedByCharacterId: "guardian",
    signatureCharacterId: "guardian",
    role: "signature",
    summary: "引っ張る結果を確定し、敵味方の陣形を組み替える。",
  },
  {
    id: "dual_blades",
    displayName: "双刃",
    introducedByCharacterId: "guardian",
    signatureCharacterId: null,
    role: "secondary",
    summary: "前へ駆け込み、hitを刻み、引き足で安全な後列へ戻る。",
  },
  {
    id: "banner",
    displayName: "号旗",
    introducedByCharacterId: "tactician",
    signatureCharacterId: "tactician",
    role: "signature",
    summary: "自分の一拍を、隊の最良の一拍へ変える。",
  },
  {
    id: "heavy_crossbow",
    displayName: "重弩",
    introducedByCharacterId: "tactician",
    signatureCharacterId: null,
    role: "secondary",
    summary: "準備した一発で、列と次の拍を消す。",
  },
]);

export const WEAPONS = Object.freeze(Object.fromEntries(
  WEAPON_CATALOG.map((weapon) => [weapon.id, Object.freeze({ ...weapon })]),
));

export const WEAPON_IDS_BY_CHARACTER = Object.freeze(Object.fromEntries(
  [...new Set(WEAPON_CATALOG.map((weapon) => weapon.introducedByCharacterId))]
    .map((characterId) => [
      characterId,
      Object.freeze(WEAPON_CATALOG
        .filter((weapon) => weapon.introducedByCharacterId === characterId)
        .map((weapon) => weapon.id)),
    ]),
));

const branchOf = (position) => position === "R" ? "入口" : position.replace(/[123]$/, "");
const depthOf = (position) => position === "R" ? 1 : position.length + 1;

const ALL_TREES = [
  ...WARHAMMER_TREE,
  ...DUAL_BLADES_TREE,
  ...GAUNTLETS_TREE,
  ...LAUNCHER_TREE,
  ...MEDICAL_KIT_TREE,
  ...TOWER_SHIELD_TREE,
  ...LONG_SPEAR_TREE,
  ...GRAPPLING_HOOK_TREE,
  ...BANNER_TREE,
  ...HEAVY_CROSSBOW_TREE,
];

// 「catalogに載っている」ことと「今UIへ出せる」ことを混同しない。
// R25では戦槌・双刃に続いてStage 0の格闘具・射出器も19節まで実装し、
// Stage 1〜3の6武器はR節の入口を持つ。未実装の深い枝は各武器のmanifest行に
// 「準備中」として残し、空の技能ツリーは作らない。
export const IMPLEMENTED_WEAPON_IDS = Object.freeze(
  [...new Set(ALL_TREES.map((node) => node.weaponId))],
);

export function weaponIdsForCharacterIds(characterIds = []) {
  const result = [];
  const seen = new Set();
  for (const characterId of characterIds) {
    for (const weaponId of WEAPON_IDS_BY_CHARACTER[characterId] ?? []) {
      if (seen.has(weaponId)) continue;
      seen.add(weaponId);
      result.push(weaponId);
    }
  }
  return result;
}

export const WEAPON_SKILL_TREE_NODES = Object.freeze(ALL_TREES.map((node) => Object.freeze({
  ...node,
  cost: 1,
  branch: branchOf(node.position),
  x: depthOf(node.position),
  requires: Object.freeze(node.requires.map((skillId) => Object.freeze({ skillId, minLv: 1 }))),
})));

export const WEAPON_SKILL_NODE_BY_ID = Object.freeze(Object.fromEntries(
  WEAPON_SKILL_TREE_NODES.map((node) => [node.skillId, node]),
));

export function weaponSkillNodes(weaponId) {
  return WEAPON_SKILL_TREE_NODES.filter((node) => node.weaponId === weaponId);
}

export function weaponSkillNode(skillId) {
  return WEAPON_SKILL_NODE_BY_ID[skillId] ?? null;
}
