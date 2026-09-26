import { WEAPON_SKILL_SPECIFICATIONS } from "./content/weapon-specifications.mjs";
import { weaponSkillNodeKey } from "./weapon-loadout.mjs";
import { weaponSkillPrerequisiteKeys } from "./weapon-progression.mjs";

export const WEAPON_SKILL_PROTOTYPE_WEAPONS = Object.freeze([
  { id: "warhammer", label: "戦槌" },
  { id: "gauntlets", label: "格闘具" },
  { id: "launcher", label: "射出器" },
  { id: "medical_kit", label: "医療具" },
  { id: "tower_shield", label: "大盾" },
  { id: "long_spear", label: "長槍" },
  { id: "grappling_hook", label: "鉤縄" },
  { id: "dual_blades", label: "双刃" },
  { id: "banner", label: "号旗" },
  { id: "heavy_crossbow", label: "重弩" },
]);

export const WEAPON_SKILL_KIND_LABELS = Object.freeze({
  active: "アクティブ",
  reactive: "リアクティブ",
  target: "ターゲット",
  passive: "パッシブ",
});

const POSITIONS = Object.freeze({
  root: ["R"],
  A: ["A1", "A2", "A3"],
  B: ["B1", "B2", "B3"],
  AA: ["AA1", "AA2", "AA3"],
  AB: ["AB1", "AB2", "AB3"],
  BA: ["BA1", "BA2", "BA3"],
  BB: ["BB1", "BB2", "BB3"],
});

const SPECIFICATION_BY_KEY = new Map(WEAPON_SKILL_SPECIFICATIONS.map((specification) => [
  weaponSkillNodeKey(specification.weaponId, specification.position),
  specification,
]));

export function listWeaponSkillPrototypeNodes(weaponId) {
  return WEAPON_SKILL_SPECIFICATIONS
    .filter((specification) => specification.weaponId === weaponId)
    .map((specification) => {
      const key = weaponSkillNodeKey(specification.weaponId, specification.position);
      return {
        ...specification,
        key,
        prerequisiteKeys: weaponSkillPrerequisiteKeys(key),
        implementationStatus: "catalog-only",
        canAcquire: false,
      };
    });
}

export function getWeaponSkillPrototypeNode(key) {
  const specification = SPECIFICATION_BY_KEY.get(key);
  if (!specification) return null;
  const [node] = listWeaponSkillPrototypeNodes(specification.weaponId)
    .filter((entry) => entry.key === key);
  return node ?? null;
}

export function buildWeaponSkillPrototypeTree(weaponId) {
  const nodes = new Map(listWeaponSkillPrototypeNodes(weaponId).map((node) => [node.position, node]));
  const groups = Object.entries(POSITIONS).map(([id, positions]) => ({
    id,
    nodes: positions.map((position) => nodes.get(position)).filter(Boolean),
  }));
  const foundPositions = groups.flatMap((group) => group.nodes.map((node) => node.position));
  if (foundPositions.length !== nodes.size || nodes.size !== 19) {
    throw new Error(`武器技能ツリーが19節ではありません: ${weaponId}`);
  }
  return groups;
}
