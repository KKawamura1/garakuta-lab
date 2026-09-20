// R25 — 武器別技能ツリーの取得用registry。
// 戦闘定義は各 weapon-*.mjs に置き、ここでは「どの武器に、どの順で、何点で入るか」だけを扱う。

import { WARHAMMER_TREE } from "./weapon-warhammer.mjs";
import { DUAL_BLADES_TREE } from "./weapon-dual-blades.mjs";

export const WEAPONS = Object.freeze({
  warhammer: Object.freeze({
    id: "warhammer",
    displayName: "戦槌",
    introducedByCharacterId: "warden",
    signatureCharacterId: "warden",
    summary: "近い敵を重く叩き、防御を砕いて次の一打へ変える。",
  }),
  dual_blades: Object.freeze({
    id: "dual_blades",
    displayName: "双刃",
    introducedByCharacterId: "guardian",
    signatureCharacterId: null,
    summary: "前へ駆け込み、hitを刻み、引き足で安全な後列へ戻る。",
  }),
});

export const IMPLEMENTED_WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));

const branchOf = (position) => position === "R" ? "入口" : position.replace(/[123]$/, "");
const depthOf = (position) => position === "R" ? 1 : position.length + 1;

const ALL_TREES = [...WARHAMMER_TREE, ...DUAL_BLADES_TREE];

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
