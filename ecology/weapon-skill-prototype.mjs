import { WEAPON_SKILL_SPECIFICATIONS } from "./content/weapon-specifications.mjs";
import { weaponSkillNodeKey } from "./weapon-loadout.mjs";
import {
  cancelWeaponSkillReservation,
  freshWeaponSkillProgression,
  grantWeaponSkillPointsForClear,
  reserveWeaponSkill,
  weaponSkillPrerequisiteKeys,
} from "./weapon-progression.mjs";
import {
  addWeaponPrioritySkill,
  freshWeaponSkillLoadout,
  selectPrimaryWeaponSkill,
} from "./weapon-loadout.mjs";

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

const CONDITION_LABEL_RULES = Object.freeze([
  [/反応窓/, "反応窓"],
  [/(?:攻撃|行動)(?:の)?開始時|攻撃開始時/, "攻撃開始"],
  [/攻撃後|行動後|攻撃終了後/, "攻撃後"],
  [/最終hit/, "最終hit"],
  [/(?:第?1hit|1hit目|初撃).*命中/, "初撃命中"],
  [/命中/, "命中時"],
  [/攻撃対象.*(?:時|とき)|狙われ/, "対象時"],
  [/HPダメージ.*受けた時|被弾/, "被弾時"],
  [/防壁.*(?:壊|0)|受け構え.*減/, "防御崩し"],
  [/撃破/, "撃破時"],
  [/ラウンド.*開始/, "開始時"],
  [/ラウンド.*終了/, "終了時"],
  [/付与.*(?:時|たび)/, "付与時"],
  [/解除.*(?:時|たび)/, "解除時"],
]);

export function weaponSkillPrototypeSignals(node) {
  const contract = String(node?.implementationContract ?? "");
  const firstSentence = contract.split("。", 1)[0].trim();
  const costs = [];
  const seen = new Set();
  for (const match of contract.matchAll(/\b(AP|RP|HP)\s*(\d+)(?=\s*(?:を(?:一度)?(?:追加)?(?:消費|支払|払)|で))/g)) {
    const label = `${match[1]}${match[2]}`;
    if (!seen.has(label)) {
      seen.add(label);
      costs.push(label);
    }
  }

  const hasTriggerLanguage = /(?:時|とき|場合|たび|につき|反応窓|直後|攻撃後|行動後)/.test(firstSentence);
  const shouldShowCondition = node?.kind === "reactive"
    || ((node?.kind === "passive" || node?.kind === "target") && hasTriggerLanguage);
  let condition = null;
  if (shouldShowCondition && firstSentence) {
    const rule = CONDITION_LABEL_RULES.find(([pattern]) => pattern.test(firstSentence));
    condition = Object.freeze({
      label: rule?.[1] ?? "条件",
      detail: firstSentence,
    });
  }

  return Object.freeze({
    condition,
    costs: Object.freeze(costs),
  });
}




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

export function createWeaponSkillLoadoutPrototypeFixture(weaponId = "warhammer") {
  const nodes = listWeaponSkillPrototypeNodes(weaponId);
  const byKind = (kind) => nodes.filter((node) => node.kind === kind);
  const primaryChoices = byKind("active");
  if (!primaryChoices.length) throw new Error(`主軸の例がありません: ${weaponId}`);
  const characterId = "prototype-character";
  const unlockedSkillKeysByCharacter = { [characterId]: nodes.map((node) => node.key) };
  let loadout = freshWeaponSkillLoadout([characterId]);
  const primary = selectPrimaryWeaponSkill(
    loadout,
    characterId,
    primaryChoices[0].key,
    unlockedSkillKeysByCharacter,
  );
  if (!primary.ok) throw new Error(primary.reason);
  loadout = primary.loadout;
  for (const node of byKind("reactive").slice(0, 2)) {
    const added = addWeaponPrioritySkill(loadout, characterId, node.key, unlockedSkillKeysByCharacter);
    if (!added.ok) throw new Error(added.reason);
    loadout = added.loadout;
  }
  for (const node of byKind("target").slice(0, 2)) {
    const added = addWeaponPrioritySkill(loadout, characterId, node.key, unlockedSkillKeysByCharacter);
    if (!added.ok) throw new Error(added.reason);
    loadout = added.loadout;
  }
  return {
    characterId,
    weaponId,
    loadout,
    unlockedSkillKeysByCharacter,
    primaryChoices,
    reactiveNodes: byKind("reactive"),
    targetNodes: byKind("target"),
    passiveNodes: byKind("passive"),
  };
}

export function createWeaponSkillReservationPrototypeFixture(weaponId = "warhammer") {
  const nodes = listWeaponSkillPrototypeNodes(weaponId);
  const availableSkillNodeKeys = new Set(nodes.map((node) => node.key));
  const characterId = "prototype-character";
  const startingSkillKeys = [weaponSkillNodeKey(weaponId, "R"), weaponSkillNodeKey(weaponId, "A1")];
  return {
    characterId,
    weaponId,
    availableSkillNodeKeys,
    startingSkillKeys,
    rewardCount: 0,
    targetKey: weaponSkillNodeKey(weaponId, "AA1"),
    progression: freshWeaponSkillProgression([characterId], {
      startingSkillKeysByCharacter: { [characterId]: startingSkillKeys },
      startingSkillPointsByCharacter: 0,
      availableSkillNodeKeys,
    }),
  };
}

export function reserveWeaponSkillPrototypeTarget(fixture, skillKey) {
  const result = reserveWeaponSkill(
    fixture.progression,
    fixture.characterId,
    skillKey,
    fixture.availableSkillNodeKeys,
  );
  return result.ok
    ? { ok: true, fixture: { ...fixture, progression: result.progression, targetKey: skillKey }, result }
    : { ok: false, fixture, result };
}

export function grantWeaponSkillPrototypePoint(fixture) {
  const clearKey = `prototype-clear-${fixture.rewardCount + 1}`;
  const result = grantWeaponSkillPointsForClear(
    fixture.progression,
    clearKey,
    1,
    fixture.availableSkillNodeKeys,
  );
  return result.ok
    ? { ok: true, fixture: { ...fixture, progression: result.progression, rewardCount: fixture.rewardCount + 1 }, result }
    : { ok: false, fixture, result };
}

export function cancelWeaponSkillPrototypeTarget(fixture) {
  const result = cancelWeaponSkillReservation(fixture.progression, fixture.characterId);
  return result.ok
    ? { ok: true, fixture: { ...fixture, progression: result.progression }, result }
    : { ok: false, fixture, result };
}

export function getWeaponSkillPrototypePrerequisiteChain(skillKey) {
  if (!SPECIFICATION_BY_KEY.has(skillKey)) return [];
  const chain = [];
  let current = skillKey;
  while (current) {
    if (chain.includes(current)) throw new Error(`武器技能前提に循環があります: ${skillKey}`);
    chain.unshift(current);
    current = weaponSkillPrerequisiteKeys(current)?.[0] ?? null;
  }
  return chain.map((key) => getWeaponSkillPrototypeNode(key));
}

export function createWeaponSkillForecastPrototypeReadout() {
  return Object.freeze({
    connected: false,
    result: null,
    roundsUsed: null,
    allyHpLost: null,
    enemyHpLost: null,
  });
}
