import assert from "node:assert/strict";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import { BATTLE_SCHEMA_VERSION } from "./schema.mjs";
import {
  IMPLEMENTED_WEAPON_IDS,
  BANNER_TREE,
  GAUNTLETS_TREE,
  GRAPPLING_HOOK_TREE,
  HEAVY_CROSSBOW_TREE,
  LAUNCHER_TREE,
  LONG_SPEAR_TREE,
  MEDICAL_KIT_TREE,
  PLAYABLE_CONTENT,
  TOWER_SHIELD_TREE,
  WARHAMMER_TREE,
  WEAPONS,
  WEAPON_IDS_BY_CHARACTER,
  WEAPON_SKILL_SPECIFICATIONS,
  WEAPON_SKILL_TREE_NODES,
} from "./content/index.mjs";
import {
  canFulfillSkillReservation,
  fulfillSkillReservations,
  manifestWeaponIds,
  newProfile,
  newRun,
  reserveRunSkill,
  skillReservationFor,
  unlockRunSkill,
} from "./progression.mjs";
import {
  componentInfo,
  freshLoadout,
  installUnlockedSkills,
  selectActiveSkill,
} from "./playable-battles.mjs";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

const sections = {
  active: "activeSkills",
  reactive: "reactiveSkills",
  target: "targetSkills",
  passive: "passiveSkills",
};
const expectedPositions = ["R", "A1", "A2", "A3", "AA1", "AA2", "AA3", "AB1", "AB2", "AB3",
  "B1", "B2", "B3", "BA1", "BA2", "BA3", "BB1", "BB2", "BB3"];
equal(WEAPON_SKILL_SPECIFICATIONS.length, 190, "PR #287 defines all 190 weapon skills");
equal(WEAPON_SKILL_TREE_NODES.length, 190, "all 190 specified skills are present in the acquisition trees");
const nodesByPosition = new Map(WEAPON_SKILL_TREE_NODES.map((node) => [`${node.weaponId}:${node.position}`, node]));
const expectedCountByKind = Object.fromEntries(Object.keys(sections).map((kind) => [
  kind,
  WEAPON_SKILL_SPECIFICATIONS.filter((specification) => specification.kind === kind).length,
]));
for (const specification of WEAPON_SKILL_SPECIFICATIONS) {
  const node = nodesByPosition.get(`${specification.weaponId}:${specification.position}`);
  ok(node, `${specification.weaponId} ${specification.position} exists in the tree`);
  equal(node.kind, specification.kind, `${specification.weaponId} ${specification.position} has catalog classification`);
  equal(node.displayName, specification.displayName, `${specification.weaponId} ${specification.position} has catalog name`);
  equal(node.implementationContract, specification.implementationContract,
    `${specification.weaponId} ${specification.position} has catalog implementation contract`);
  equal(node.displayEffect, specification.displayEffect, `${specification.weaponId} ${specification.position} has catalog effect text`);
  equal(node.flavorText, specification.flavorText, `${specification.weaponId} ${specification.position} has catalog flavor text`);
  const definition = PLAYABLE_CONTENT[sections[specification.kind]][node.skillId];
  ok(definition, `${specification.weaponId} ${specification.position} is registered as ${specification.kind}`);
  equal(definition.displayName, specification.displayName, `${node.skillId} uses the catalog name`);
  equal(definition.displayEffect, specification.displayEffect, `${node.skillId} uses the catalog effect`);
  equal(definition.flavorText, specification.flavorText, `${node.skillId} uses the catalog flavor`);
  equal(definition.implementationContract, specification.implementationContract,
    `${node.skillId} exposes its catalog implementation contract`);
}
assert.deepEqual(
  Object.fromEntries(Object.keys(sections).map((kind) => [kind, Object.keys(PLAYABLE_CONTENT[sections[kind]]).length])),
  expectedCountByKind,
  "playable registries contain exactly the catalog skills in each category",
);
checks += 1;
for (const weaponId of IMPLEMENTED_WEAPON_IDS) {
  const nodes = WEAPON_SKILL_TREE_NODES.filter((node) => node.weaponId === weaponId);
  equal(nodes.length, 19, `${weaponId} has 19 catalog positions`);
  assert.deepEqual(nodes.map((node) => node.position), expectedPositions, `${weaponId} keeps the catalog position order`);
  checks += 1;
}

assert.deepEqual(WEAPON_IDS_BY_CHARACTER, {
  warden: ["warhammer", "gauntlets"],
  mender: ["launcher", "medical_kit"],
  lancer: ["tower_shield", "long_spear"],
  guardian: ["grappling_hook", "dual_blades"],
  tactician: ["banner", "heavy_crossbow"],
}, "each character has the signature weapon and secondary weapon from the design catalog");
checks += 1;
equal(Object.keys(WEAPONS).length, 10, "weapon registry contains all ten scenario weapons");
equal(IMPLEMENTED_WEAPON_IDS.length, 10, "all ten root weapon trees are exposed to the UI");
ok(["warhammer", "dual_blades", "gauntlets", "launcher", "medical_kit", "tower_shield",
  "long_spear", "grappling_hook", "banner", "heavy_crossbow"].every((id) => (
  IMPLEMENTED_WEAPON_IDS.includes(id)
)), "all ten weapon roots remain UI-visible");
for (const [weaponId, tree, skillId, expectedLength] of [
  ["gauntlets", GAUNTLETS_TREE, "gauntlets_punch", 19],
  ["launcher", LAUNCHER_TREE, "launcher_shot", 19],
  ["medical_kit", MEDICAL_KIT_TREE, "medical_kit_treatment", 19],
  ["grappling_hook", GRAPPLING_HOOK_TREE, "grappling_hook_pull", 19],
  ["banner", BANNER_TREE, "banner_command", 19],
  ["heavy_crossbow", HEAVY_CROSSBOW_TREE, "heavy_crossbow_loaded_shot", 19],
]) {
  equal(tree.length, expectedLength, `${weaponId} exposes its expected tree slice`);
  equal(tree[0].skillId, skillId, `${weaponId} root points to its active skill`);
  ok(PLAYABLE_CONTENT.activeSkills[skillId], `${weaponId} root is in playable active content`);
}

for (const [weaponId, tree] of [
  ["gauntlets", GAUNTLETS_TREE],
  ["launcher", LAUNCHER_TREE],
  ["tower_shield", TOWER_SHIELD_TREE],
  ["long_spear", LONG_SPEAR_TREE],
  ["medical_kit", MEDICAL_KIT_TREE],
  ["grappling_hook", GRAPPLING_HOOK_TREE],
  ["banner", BANNER_TREE],
  ["heavy_crossbow", HEAVY_CROSSBOW_TREE],
]) {
  equal(tree.length, 19, `${weaponId} has the complete 19-node shape`);
  for (const node of WEAPON_SKILL_TREE_NODES.filter((entry) => entry.weaponId === weaponId)) {
    const definition = PLAYABLE_CONTENT[sections[node.kind]][node.skillId];
    ok(definition, `${node.position} points to a real ${weaponId} ${node.kind} skill`);
    equal(definition.displayEffect, node.displayEffect, `${weaponId} ${node.position} has catalog effect text`);
    equal(definition.flavorText, node.flavorText, `${weaponId} ${node.position} has catalog flavor text`);
  }
}

const content = structuredClone(PLAYABLE_CONTENT);
content.activeSkills.borrowed_four_hit = {
  id: "borrowed_four_hit",
  displayName: "借りた四連撃",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: { scope: "enemies", filters: [{ type: "alive" }], take: 1 },
  effects: [{
    type: "deal_damage",
    target: { scope: "event_targets", take: "all" },
    amount: { type: "constant", value: 10 },
    hitCount: 4,
    rangeClass: "melee",
    tags: ["attack", "borrowed_weapon"],
  }],
  tags: ["attack", "playable"],
};
content.enemyActors.weapon_test_dummy = {
  id: "weapon_test_dummy",
  displayName: "試し台",
  maxHp: 10_000,
  baseActionPoints: 0,
  baseReactionPoints: 0,
  tactics: [],
  reactiveSkillIds: [],
  intrinsicRules: [],
  tags: ["test"],
  might: 0,
  focus: 0,
  guard: 0,
};
content.enemyActors.weapon_test_guard_20 = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_guard_20",
  displayName: "高受け試し台",
  guard: 20,
};
content.enemyActiveSkills.weapon_test_row_strike = {
  id: "weapon_test_row_strike",
  displayName: "横列打撃試験",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: { scope: "enemies", filters: [{ type: "alive" }], take: 1 },
  effects: [{
    type: "deal_damage",
    target: { scope: "event_targets", take: 1 },
    targetPattern: "row",
    amount: { type: "constant", value: 80 },
    hitCount: 2,
    rangeClass: "melee",
    tags: ["attack", "weapon", "melee"],
  }],
  tags: ["attack", "weapon", "melee"],
};
content.enemyActors.weapon_test_heavy = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_heavy",
  displayName: "重い試験台",
  baseActionPoints: 1,
  might: 200,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
};
content.enemyActors.weapon_test_row_attacker = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_row_attacker",
  displayName: "横列攻撃試験台",
  baseActionPoints: 1,
  tactics: [{ activeSkillId: "weapon_test_row_strike", useWhen: [] }],
};
content.enemyActors.weapon_test_armored = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_armored",
  displayName: "装甲試し台",
  intrinsicRules: [{
    id: "weapon_test_armored_opening_rule",
    listenTo: "round_started",
    timing: "after",
    priority: 1,
    predicates: [],
    costs: [],
    effects: [{
      type: "gain_barrier",
      target: { scope: "self", take: 1 },
      amount: { type: "constant", value: 200 },
      duration: "battle",
    }],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.enemyActors.weapon_test_low_barrier = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_low_barrier",
  displayName: "薄防壁試し台",
  intrinsicRules: [{
    id: "weapon_test_low_barrier_opening_rule",
    listenTo: "round_started",
    timing: "after",
    priority: 1,
    predicates: [],
    costs: [],
    effects: [{
      type: "gain_barrier",
      target: { scope: "self", take: 1 },
      amount: { type: "constant", value: 1 },
      duration: "battle",
    }],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.enemyActors.weapon_test_blocked = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_blocked",
  displayName: "受け試し台",
  intrinsicRules: [{
    id: "weapon_test_blocked_opening_rule",
    listenTo: "round_started",
    timing: "after",
    priority: 1,
    predicates: [],
    costs: [],
    effects: [{
      type: "gain_block",
      target: { scope: "self", take: 1 },
      amount: { type: "constant", value: 2 },
    }],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.enemyActors.weapon_test_blocked_one_guard_30 = {
  ...content.enemyActors.weapon_test_blocked,
  id: "weapon_test_blocked_one_guard_30",
  displayName: "高受け一枚構え試し台",
  guard: 30,
  intrinsicRules: content.enemyActors.weapon_test_blocked.intrinsicRules.map((rule) => ({
    ...rule,
    id: "weapon_test_blocked_one_guard_30_opening_rule",
    effects: rule.effects.map((effect) => ({
      ...effect,
      amount: { ...effect.amount, value: 1 },
    })),
  })),
};
content.enemyActors.weapon_test_barrier_guard_200 = {
  ...content.enemyActors.weapon_test_armored,
  id: "weapon_test_barrier_guard_200",
  displayName: "高受け防壁試し台",
  guard: 200,
  intrinsicRules: content.enemyActors.weapon_test_armored.intrinsicRules.map((rule) => ({
    ...rule,
    id: "weapon_test_barrier_guard_200_opening_rule",
  })),
};
content.enemyActors.weapon_test_salvage_target = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_salvage_target",
  displayName: "解体試験台",
  guard: 20,
  intrinsicRules: [{
    id: "weapon_test_salvage_target_opening_rule",
    listenTo: "round_started",
    timing: "after",
    priority: 1,
    predicates: [],
    costs: [],
    effects: [
      { type: "gain_barrier", target: { scope: "self", take: 1 }, amount: { type: "constant", value: 40 }, duration: "battle" },
      { type: "gain_block", target: { scope: "self", take: 1 }, amount: { type: "constant", value: 3 } },
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "focused", stacks: 1 },
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "warded", stacks: 1 },
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "fortified", stacks: 1 },
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "armor_broken", stacks: 1 },
    ],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.enemyActors.weapon_test_blessed = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_blessed",
  displayName: "強化試し台",
  intrinsicRules: [{
    id: "weapon_test_blessed_opening_rule",
    listenTo: "round_started",
    timing: "after",
    priority: 1,
    predicates: [],
    costs: [],
    effects: [
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "focused", stacks: 1 },
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "warded", stacks: 1 },
    ],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.enemyActors.weapon_test_bleeding = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_bleeding",
  displayName: "裂傷試し台",
  intrinsicRules: [{
    id: "weapon_test_bleeding_opening_rule",
    listenTo: "round_started",
    timing: "after",
    priority: 1,
    predicates: [],
    costs: [],
    effects: [{
      type: "add_status",
      target: { scope: "self", take: 1 },
      statusId: "bleeding",
      stacks: 2,
    }],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.enemyActors.weapon_test_bleeding_three = {
  ...content.enemyActors.weapon_test_bleeding,
  id: "weapon_test_bleeding_three",
  intrinsicRules: content.enemyActors.weapon_test_bleeding.intrinsicRules.map((rule) => ({
    ...rule,
    id: "weapon_test_bleeding_three_opening_rule",
    effects: rule.effects.map((effect) => ({ ...effect, stacks: 3 })),
  })),
};
content.enemyActors.weapon_test_weak = {
  ...content.enemyActors.weapon_test_bleeding,
  id: "weapon_test_weak",
  displayName: "弱い裂傷試し台",
  maxHp: 1,
  intrinsicRules: content.enemyActors.weapon_test_bleeding.intrinsicRules.map((rule) => ({
    ...rule,
    id: "weapon_test_weak_opening_rule",
  })),
};
content.activeSkills.weapon_test_utility = {
  id: "weapon_test_utility",
  displayName: "非攻撃試験",
  apCost: 1,
  actionMode: "utility",
  intrinsicPredicates: [],
  targetQuery: { scope: "self", take: 1 },
  effects: [{
    type: "gain_barrier",
    target: { scope: "self", take: 1 },
    amount: { type: "constant", value: 1 },
    duration: "round",
  }],
  tags: ["utility", "playable"],
};
content.activeSkills.weapon_test_first_shot = {
  id: "weapon_test_first_shot",
  displayName: "直前対象試験射",
  displayEffect: "最も後ろの敵へ1ダメージ（戦闘1回）。",
  flavorText: "次の対象選択に直前対象を残すための試験射。",
  weaponId: "weapon_test",
  treePosition: "R",
  usesPerBattle: 1,
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_desc"], take: 1 },
  effects: [{
    type: "deal_damage",
    target: { scope: "event_targets", take: "all" },
    amount: { type: "constant", value: 1 },
    rangeClass: "melee",
    tags: ["attack", "weapon", "melee"],
  }],
  tags: ["attack", "weapon", "melee", "playable"],
};
content.characters.weapon_test_reserver = {
  ...content.characters.warden,
  id: "weapon_test_reserver",
  displayName: "予約刃試験員",
  might: 40,
  signatureRules: [{
    id: "weapon_test_reserver_opening_rule",
    listenTo: "round_started",
    timing: "after",
    priority: 1,
    predicates: [],
    costs: [],
    effects: [{
      type: "add_status",
      target: { scope: "self", take: 1 },
      statusId: "dual_blades_reserved_blade",
      stacks: 3,
    }],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.characters.weapon_test_buff_giver = {
  ...content.characters.warden,
  id: "weapon_test_buff_giver",
  displayName: "強化付与試験員",
  signatureRules: [{
    id: "weapon_test_buff_giver_opening_rule",
    listenTo: "round_started", timing: "after", priority: 1,
    predicates: [], costs: [],
    effects: [{ type: "add_status", target: { scope: "self", take: 1 }, statusId: "fortified", stacks: 3 }],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.passiveSkills.weapon_test_consume_fortified_after_target = {
  id: "weapon_test_consume_fortified_after_target",
  displayName: "照準後の堅牢消費試験",
  displayEffect: "対象決定後、攻撃者自身の堅牢をすべて解除する。",
  flavorText: "攻撃開始時の記録と現在値を分ける試験。",
  rules: [{
    id: "weapon_test_consume_fortified_after_target_rule",
    listenTo: "target_selected",
    timing: "interrupt",
    priority: 80,
    predicates: [{
      type: "target_exists",
      query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
    }],
    costs: [],
    effects: [{ type: "remove_status", target: { scope: "self", take: 1 }, statusId: "fortified", stacks: "all" }],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }],
  tags: ["passive", "test"],
};
content.characters.weapon_test_block_giver = {
  ...content.characters.warden,
  id: "weapon_test_block_giver",
  displayName: "受け付与試験員",
  signatureRules: [{
    id: "weapon_test_block_giver_opening_rule",
    listenTo: "round_started", timing: "after", priority: 1,
    predicates: [], costs: [],
    effects: [{ type: "gain_block", target: { scope: "self", take: 1 }, amount: { type: "constant", value: 3 } }],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.characters.weapon_test_gauntlet_stacks = {
  ...content.characters.warden,
  id: "weapon_test_gauntlet_stacks",
  displayName: "連携段数試験員",
  might: 200,
  signatureRules: [{
    id: "weapon_test_gauntlet_stacks_opening_rule",
    listenTo: "round_started", timing: "after", priority: 1,
    predicates: [], costs: [],
    effects: [
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "gauntlets_combo", stacks: 2 },
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "fortified", stacks: 8 },
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "dual_blades_reserved_blade", stacks: 5 },
      { type: "gain_block", target: { scope: "self", take: 1 }, amount: { type: "constant", value: 4 } },
    ],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.characters.weapon_test_gauntlet_combo_cap = {
  ...content.characters.warden,
  id: "weapon_test_gauntlet_combo_cap",
  displayName: "連携上限試験員",
  might: 200,
  signatureRules: [{
    id: "weapon_test_gauntlet_combo_cap_opening_rule",
    listenTo: "round_started", timing: "after", priority: 1,
    predicates: [], costs: [],
    effects: [{ type: "add_status", target: { scope: "self", take: 1 }, statusId: "gauntlets_combo", stacks: 300 }],
    limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
  }],
};
content.characters.weapon_test_high_might = {
  ...content.characters.warden,
  id: "weapon_test_high_might",
  displayName: "高腕力試験員",
  might: 200,
  signatureRules: [],
};
content.characters.weapon_test_no_rp = {
  ...content.characters.warden,
  id: "weapon_test_no_rp",
  displayName: "無反応点試験員",
  baseReactionPoints: 0,
  signatureRules: [],
};
assert.deepEqual(validateContentBundle(content), []);
checks += 1;

function battle({
  maxRounds = 1,
  objective = { type: "survive_rounds", rounds: maxRounds },
  characterId = "warden",
  position = "front_center",
  activeSkillId = "warhammer_blow",
  reactiveSkillIds = [],
  targetSkillIds = [],
  passiveSkillIds = [],
  allies = null,
  enemies = [{ instanceId: "e_dummy", enemyActorId: "weapon_test_dummy", position: "front_left" }],
}) {
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "weapon_system_test",
    maxRounds,
    objective,
    allies: allies ?? [{
      instanceId: "a_user",
      characterId,
      position,
      activeSkillId,
      reactiveSkillIds,
      targetSkillIds,
      passiveSkillIds,
      reactiveReserveBySkill: {},
      equipment: [],
    }],
    enemies,
  };
}

const allyInput = (instanceId, characterId, activeSkillId, position, extra = {}) => ({
  instanceId,
  characterId,
  activeSkillId,
  position,
  reactiveSkillIds: [],
  targetSkillIds: [],
  passiveSkillIds: [],
  reactiveReserveBySkill: {},
  equipment: [],
  ...extra,
});

{
  const result = simulateBattle(battle({
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [
      allyInput("a_mender", "mender", "medical_kit_treatment", "rear_left"),
      allyInput("a_wounded", "warden", "warhammer_blow", "front_left", { hp: 50 }),
    ],
  }), content);
  const barrier = result.events.find((event) => event.type === "barrier_gained"
    && event.skillId === "medical_kit_treatment" && event.targetActorIds[0] === "a_wounded");
  ok(barrier, "medical kit shields the lowest-HP-percent ally");
  equal(barrier.values.duration, "round", "medical kit barrier lasts for the current round");
  ok(barrier.values.amount > 0, "medical kit barrier scales from the user's focus");
  equal(result.actors.find((actor) => actor.instanceId === "a_mender")
    .skillUses.medical_kit_treatment, undefined, "medical kit has no battle-use counter");
}

{
  const result = simulateBattle(battle({
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    characterId: "lancer",
    activeSkillId: "tower_shield_draw_guard",
    enemies: [{ instanceId: "e_scrapper", enemyActorId: "gray_scrapper", position: "front_right" }],
  }), content);
  ok(result.events.some((event) => event.type === "status_added"
    && event.values.statusId === "taunted" && event.values.stacks === 2),
  "tower shield root grants two taunt stacks");
  equal(result.events.find((event) => event.type === "target_selected"
    && event.sourceActorId === "e_scrapper")?.targetActorIds[0], "a_user",
  "taunt redirects an enemy single-target attack");
}

{
  const result = simulateBattle(battle({
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    characterId: "lancer",
    activeSkillId: "long_spear_pierce",
    position: "rear_left",
    enemies: [
      { instanceId: "e_front", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_rear", enemyActorId: "weapon_test_dummy", position: "rear_right" },
    ],
  }), content);
  equal(result.events.find((event) => event.type === "target_selected"
    && event.skillId === "long_spear_pierce")?.targetActorIds[0], "e_rear",
  "long spear root chooses the farthest legal enemy");
}

{
  const result = simulateBattle(battle({
    characterId: "lancer",
    activeSkillId: "tower_shield_draw_guard",
    passiveSkillIds: ["tower_shield_thick_plate"],
    reactiveSkillIds: ["tower_shield_visible"],
  }), content);
  equal(result.events.find((event) => event.type === "barrier_gained"
    && event.skillId === "tower_shield_draw_guard")?.values.amount, 45,
  "tower shield thick plate adds 15 to the root barrier");
  ok(result.events.some((event) => event.type === "status_added"
    && event.ruleId === "tower_shield_visible_rule"
    && event.values.statusId === "taunted" && event.values.stacks === 3),
  "tower shield visible shield adds one taunt to every guard action");
}

{
  const result = simulateBattle(battle({
    characterId: "lancer",
    allies: [
      allyInput("a_shield", "lancer", "warhammer_blow", "front_center", {
        reactiveSkillIds: ["tower_shield_interpose"],
        passiveSkillIds: ["tower_shield_shock_absorption"],
      }),
      allyInput("a_wounded", "warden", "warhammer_blow", "front_left", { hp: 100 }),
    ],
    enemies: [{ instanceId: "e_attacker", enemyActorId: "gray_scrapper", position: "front_right" }],
  }), content);
  equal(result.events.find((event) => event.type === "target_changed"
    && event.ruleId === "tower_shield_interpose_rule")?.targetActorIds[0], "a_shield",
  "tower shield interpose redirects an ally attack to the shield");
  ok(result.events.some((event) => event.type === "pending_amount_modified"
    && event.ruleId === "tower_shield_shock_absorption_damage_rule"),
  "tower shield shock absorption reduces redirected damage before the hit resolves");
}

{
  const result = simulateBattle(battle({
    characterId: "lancer",
    activeSkillId: "tower_shield_sanctuary",
    allies: [
      allyInput("a_shield", "lancer", "tower_shield_sanctuary", "front_center"),
      allyInput("a_wounded", "warden", "warhammer_blow", "front_left", { hp: 100 }),
    ],
    enemies: [{ instanceId: "e_attacker", enemyActorId: "gray_scrapper", position: "front_right" }],
  }), content);
  equal(result.events.find((event) => event.type === "target_changed"
    && event.ruleId === "tower_shield_sanctuary_rule")?.targetActorIds[0], "a_shield",
  "tower shield sanctuary redirects a single enemy attack");
  ok(result.events.some((event) => event.type === "damage_proposed"
    && event.sourceActorId === "e_attacker" && event.tags.includes("redirect")),
  "redirected damage keeps a shared redirect tag for downstream passives");
}

{
  const result = simulateBattle(battle({
    characterId: "lancer",
    activeSkillId: "tower_shield_draw_guard",
    reactiveSkillIds: ["tower_shield_relief_voice"],
    passiveSkillIds: ["tower_shield_spread_guard"],
    allies: [
      allyInput("a_shield", "lancer", "tower_shield_draw_guard", "front_center", {
        reactiveSkillIds: ["tower_shield_relief_voice"],
        passiveSkillIds: ["tower_shield_spread_guard"],
      }),
      allyInput("a_wounded", "warden", "warhammer_blow", "front_left", { hp: 100 }),
    ],
    enemies: [{ instanceId: "e_heavy", enemyActorId: "weapon_test_heavy", position: "front_right" }],
  }), content);
  ok(result.events.some((event) => event.type === "healing_applied"
    && event.ruleId === "tower_shield_relief_voice_rule"
    && event.values.actual === 30),
  "tower shield relief voice converts absorbed damage into recovery");
  ok(result.events.some((event) => event.type === "barrier_gained"
    && event.ruleId === "tower_shield_spread_guard_rule"
    && event.targetActorIds[0] === "a_wounded" && event.values.amount === 15),
  "tower shield spread guard shares half the absorbed packet");
}

{
  const result = simulateBattle(battle({
    characterId: "lancer",
    activeSkillId: "long_spear_pierce",
    passiveSkillIds: ["long_spear_double_thrust"],
    reactiveSkillIds: ["long_spear_penetration"],
    enemies: [
      { instanceId: "e_front", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_rear", enemyActorId: "weapon_test_dummy", position: "rear_left" },
    ],
  }), content);
  equal(result.events.filter((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_user").length, 3,
  "long spear double thrust and penetration add two explicit follow-up hits");
  ok(result.events.some((event) => event.type === "damage_proposed"
    && event.tags.includes("extra_hit") && event.targetActorIds[0] === "e_front"),
  "long spear penetration uses the shared same-column filter");
}

{
  const result = simulateBattle(battle({
    characterId: "lancer",
    activeSkillId: "long_spear_pierce",
    reactiveSkillIds: ["long_spear_foot_stop"],
    enemies: [{ instanceId: "e_delayed", enemyActorId: "weapon_test_heavy", position: "front_left" }],
  }), content);
  ok(result.events.some((event) => event.type === "resource_spent"
    && event.ruleId === "long_spear_delayed_rule"
    && event.targetActorIds[0] === "e_delayed"
    && event.values.resource === "action_points"),
  "long spear foot stop reduces the next enemy activation AP");
}

{
  const result = simulateBattle(battle({
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    characterId: "guardian",
    activeSkillId: "grappling_hook_pull",
    position: "rear_left",
    enemies: [{ instanceId: "e_hook", enemyActorId: "weapon_test_dummy", position: "rear_right" }],
  }), content);
  ok(result.events.some((event) => event.type === "actor_moved"
    && event.skillId === "grappling_hook_pull" && event.targetActorIds[0] === "e_hook"),
  "grappling hook root emits a pull movement");
}

{
  const result = simulateBattle(battle({
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [
      allyInput("a_banner", "tactician", "banner_command", "rear_left"),
      allyInput("a_recipient", "warden", "warhammer_blow", "front_left"),
    ],
  }), content);
  ok(result.events.some((event) => event.type === "resource_gained"
    && event.skillId === "banner_command" && event.targetActorIds[0] === "a_recipient"
    && event.values.resource === "action_points"),
  "banner root gives AP to another ally");
}

{
  const result = simulateBattle(battle({
    maxRounds: 2,
    objective: { type: "survive_rounds", rounds: 2 },
    characterId: "tactician",
    activeSkillId: "heavy_crossbow_loaded_shot",
    position: "rear_left",
    enemies: [{ instanceId: "e_crossbow", enemyActorId: "weapon_test_dummy", position: "front_left" }],
  }), content);
  ok(result.events.some((event) => event.type === "preparation_started"
    && event.skillId === "heavy_crossbow_loaded_shot"),
  "heavy crossbow root enters preparation");
  ok(result.events.some((event) => event.type === "damage_taken"
    && event.skillId === "heavy_crossbow_loaded_shot"),
  "heavy crossbow root resolves its loaded shot");
}

{
  const result = simulateBattle(battle({
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [
      allyInput("a_mender", "mender", "medical_kit_major_treatment", "rear_left", {
        reactiveSkillIds: ["medical_kit_clean_tools"],
      }),
      allyInput("a_wounded", "warden", "warhammer_blow", "front_left", { hp: 50 }),
    ],
  }), content);
  ok(result.events.some((event) => event.type === "barrier_gained"
    && event.skillId === "medical_kit_major_treatment"
    && event.tags.includes("medical_kit")
    && event.values.amount > 0),
  "medical kit deep treatment keeps support tags through the barrier event");
}

{
  const result = simulateBattle(battle({
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [
      allyInput("a_mender", "mender", "warhammer_blow", "rear_left", {
        reactiveSkillIds: ["medical_kit_emergency_revive"],
      }),
      allyInput("a_wounded", "warden", "warhammer_blow", "front_left", { hp: 1 }),
    ],
    enemies: [{ instanceId: "e_heavy", enemyActorId: "weapon_test_heavy", position: "front_left" }],
  }), content);
  ok(result.events.some((event) => event.type === "actor_revived"
    && event.ruleId === "medical_kit_emergency_revive_rule"
    && event.targetActorIds[0] === "a_wounded"),
  "medical kit emergency reaction revives a defeated ally inside the defeat event");
}

{
  const result = simulateBattle(battle({
    characterId: "guardian",
    activeSkillId: "grappling_hook_net_field",
    reactiveSkillIds: ["grappling_hook_movement_marks"],
    position: "rear_left",
    enemies: [{ instanceId: "e_hook", enemyActorId: "weapon_test_dummy", position: "rear_right" }],
  }), content);
  ok(result.events.some((event) => event.type === "actor_moved"
    && event.skillId === "grappling_hook_net_field" && event.tags.includes("move")),
  "grappling hook deep action emits the shared movement event");
  equal(result.actors.find((actor) => actor.instanceId === "e_hook")
    .statuses.find((status) => status.statusId === "grappling_hook_mark")?.stacks, 1,
  "grappling hook movement mark is stored on the moved actor");
}

{
  const result = simulateBattle(battle({
    allies: [
      allyInput("a_banner", "tactician", "banner_total_assault", "rear_left"),
      allyInput("a_recipient", "warden", "warhammer_blow", "front_left"),
    ],
  }), content);
  ok(result.events.some((event) => event.type === "resource_gained"
    && event.skillId === "banner_total_assault"
    && event.values.resource === "action_points"
    && event.values.amount === 1),
  "banner deep command keeps AP support visible as a tagged resource event");
  ok(result.events.some((event) => event.type === "status_added"
    && event.targetActorIds[0] === "a_recipient"
    && event.values.statusId === "banner_commanded"),
  "banner command records the recipient's next-action buff");
}

{
  const result = simulateBattle(battle({
    maxRounds: 2,
    objective: { type: "survive_rounds", rounds: 2 },
    characterId: "tactician",
    activeSkillId: "heavy_crossbow_burst_bolt",
    position: "rear_left",
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(result.events.filter((event) => event.type === "damage_taken"
    && event.skillId === "heavy_crossbow_burst_bolt").length, 2,
  "heavy crossbow burst preparation resolves across the anchored enemy row");
}

{
  const result = simulateBattle(battle({
    passiveSkillIds: ["warhammer_heavy_head", "warhammer_iron_mass"],
  }), content);
  const proposed = result.events.find(
    (event) => event.type === "damage_proposed" && event.skillId === "warhammer_blow",
  );
  equal(proposed.values.amount, 63, "front melee applies 125% before passive modifiers");
  const changes = result.events.filter(
    (event) => event.type === "pending_amount_modified" && event.values.proposalEventId === proposed.id,
  );
  assert.deepEqual(changes.map((event) => event.values.after), [72, 84]);
  checks += 1;
}

{
  const result = simulateBattle(battle({
    activeSkillId: "warhammer_heavy_blow",
    reactiveSkillIds: ["warhammer_wide_swing"],
    enemies: [
      { instanceId: "e_primary", enemyActorId: "weapon_test_dummy", position: "front_center" },
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_adjacent", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  const extraHits = result.events.filter((event) => event.type === "damage_proposed"
    && event.tags.includes("plan_extra_damage"));
  assert.deepEqual(extraHits.map((event) => event.targetActorIds[0]).sort(), ["e_adjacent", "e_left"],
    "wide swing adds every valid horizontal neighbor to the fixed plan");
  ok(extraHits.every((event) => event.values.amount === 23),
    "wide swing scales each 35% extra hit from might, not the active skill coefficient");
  equal(result.events.filter((event) => event.type === "resource_spent"
    && event.values.resource === "reaction_points").length, 1,
  "wide swing pays RP once for all added adjacent targets");
  checks += 1;
}

{
  const result = simulateBattle(battle({
    activeSkillId: "warhammer_earth_splitter",
    reactiveSkillIds: ["warhammer_broken_armor"],
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_low_barrier", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_low_barrier", position: "front_right" },
    ],
  }), content);
  const armorAdded = result.events.filter((event) => event.type === "status_added"
    && event.ruleId === "warhammer_broken_armor_rule"
    && event.values.statusId === "armor_broken");
  assert.deepEqual(armorAdded.map((event) => event.targetActorIds[0]), ["e_left", "e_right"]);
  checks += 1;
}

{
  const result = simulateBattle(battle({
    activeSkillId: "warhammer_earth_splitter",
    reactiveSkillIds: ["warhammer_breaking_sound", "warhammer_broken_armor"],
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_blocked", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_blocked", position: "front_right" },
    ],
  }), content);
  const clearedBlock = result.events.filter((event) => event.type === "block_spent"
    && event.targetActorIds.some((id) => id === "e_left" || id === "e_right")
    && event.tags.includes("effect"));
  assert.deepEqual(clearedBlock.map((event) => event.targetActorIds[0]), ["e_left", "e_right"]);
  equal(result.events.filter((event) => event.type === "defense_break"
    && event.targetActorIds.some((id) => id === "e_left" || id === "e_right")).length, 2,
  "clearing the remaining block does not reopen the current hit's defense-break window");
  equal(result.events.filter((event) => event.type === "status_added"
    && event.ruleId === "warhammer_broken_armor_rule").length, 0,
  "the lower-priority defense-break reaction does not run again inside the same hit");
}

{
  const result = simulateBattle(battle({
    characterId: "tactician",
    activeSkillId: "borrowed_four_hit",
    reactiveSkillIds: ["warhammer_ringing_iron"],
    passiveSkillIds: ["warhammer_deep_impact"],
  }), content);
  equal(result.events.filter((event) => (
    event.type === "resource_spent" && event.values.resource === "reaction_points"
  )).length, 1, "ringing iron pays once on the first hit of another weapon");
  equal(result.events.filter((event) => event.type === "status_added"
    && ["warhammer_ringing_iron_first_hit_rule", "warhammer_ringing_iron_followup_hit_rule"].includes(event.ruleId)
    && event.values.statusId === "staggered").length, 2,
  "A2 applies at most two stagger instances across the whole borrowed attack");
  const dummy = result.actors.find((actor) => actor.instanceId === "e_dummy");
  equal(dummy.statuses.find((status) => status.statusId === "staggered")?.stacks, 3,
    "deep impact strengthens the first stagger and the fourth hit reaches stack three");
}

{
  const result = simulateBattle(battle({
    activeSkillId: "warhammer_siege_blow",
    targetSkillIds: ["warhammer_point_at_armor"],
    reactiveSkillIds: ["warhammer_broken_armor"],
    enemies: [
      { instanceId: "e_plain", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_armored", enemyActorId: "weapon_test_armored", position: "front_right" },
    ],
  }), content);
  const selected = result.events.find(
    (event) => event.type === "target_selected" && event.skillId === "warhammer_siege_blow",
  );
  equal(selected.targetActorIds[0], "e_armored", "armor targeting reorders only legal active targets");
  ok(result.events.some((event) => (
    event.type === "barrier_broken" && event.targetActorIds[0] === "e_armored"
      && event.tags.includes("effect")
  )), "siege blow removes the barrier left after damage");
  const armored = result.actors.find((actor) => actor.instanceId === "e_armored");
  equal(result.events.find((event) => (
    event.type === "status_added" && event.values.statusId === "armor_broken"
  ))?.values.added, 2, "breaking a defense applies two unbounded armor-broken stacks");
  equal(armored.statuses.find((status) => status.statusId === "armor_broken")?.stacks, 1,
    "armor-broken stacks halve at round end");
}

{
  const result = simulateBattle(battle({
    activeSkillId: "warhammer_kingslayer",
    passiveSkillIds: ["warhammer_trophy_fragment"],
    enemies: [{ instanceId: "e_blessed", enemyActorId: "weapon_test_blessed", position: "front_left" }],
  }), content);
  const proposed = result.events.find(
    (event) => event.type === "damage_proposed" && event.skillId === "warhammer_kingslayer",
  );
  equal(proposed.values.amount, 113,
    "kingslayer removes defenses before its fixed 180% might hit");
  equal(result.events.filter((event) => (
    event.type === "status_removed" && event.targetActorIds[0] === "e_blessed"
      && event.tags.includes("positive")
  )).length, 2, "kingslayer removes both positive status types");
  const user = result.actors.find((actor) => actor.instanceId === "a_user");
  equal(result.events.filter((event) => (
    event.type === "status_added" && event.values.statusId === "fortified"
  )).reduce((sum, event) => sum + event.values.added, 0), 4,
  "trophy fragment gains fortified two for each removed positive status stack");
  equal(user.statuses.find((status) => status.statusId === "fortified")?.stacks, 2,
    "fortified stacks halve at round end");
}

{
  const nearest = simulateBattle(battle({
    enemies: [
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
      { instanceId: "e_rear", enemyActorId: "weapon_test_dummy", position: "rear_center" },
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
    ],
  }), content);
  const proposal = nearest.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_blow");
  equal(proposal?.targetActorIds[0], "e_left",
    "R chooses the nearest legal enemy and resolves an equal-distance tie by fixed position");
  equal(proposal?.values.amount, 63, "R deals the 100% might coefficient at front melee range");
}

{
  const borrowed = simulateBattle(battle({
    characterId: "tactician",
    activeSkillId: "borrowed_four_hit",
    passiveSkillIds: ["warhammer_heavy_head", "warhammer_iron_mass"],
  }), content);
  const firstHitBoosts = borrowed.events.filter((event) => event.type === "pending_amount_modified"
    && ["warhammer_heavy_head_rule", "warhammer_iron_mass_rule"].includes(event.ruleId));
  equal(firstHitBoosts.filter((event) => event.ruleId === "warhammer_heavy_head_rule").length, 1,
    "A1 boosts only the first hit of a non-warhammer attack");
  equal(firstHitBoosts.filter((event) => event.ruleId === "warhammer_iron_mass_rule").length, 1,
    "AA1 boosts only the first hit of a non-warhammer attack");
  ok(firstHitBoosts.every((event) => event.values.delta > 0),
    "A1 and AA1 both increase the first hit when the owner uses another weapon");
}

{
  const blockedFirstHit = simulateBattle(battle({
    reactiveSkillIds: ["warhammer_ringing_iron"],
    enemies: [{ instanceId: "e_block", enemyActorId: "weapon_test_blocked", position: "front_left" }],
  }), content);
  ok(blockedFirstHit.events.some((event) => event.type === "damage_resolved"
    && event.values.result === "blocked" && event.targetActorIds[0] === "e_block"),
  "A2 sees the first hit resolve even when block prevents HP damage");
  equal(blockedFirstHit.events.filter((event) => event.type === "damage_taken"
    && event.sourceActorId === "a_user").length, 0,
  "A2 does not depend on an HP-damage-only event");
  equal(blockedFirstHit.events.filter((event) => event.type === "resource_spent"
    && event.values.resource === "reaction_points").length, 1,
  "A2 spends RP once after a blocked first hit");
  ok(blockedFirstHit.events.some((event) => event.type === "status_added"
    && event.ruleId === "warhammer_ringing_iron_first_hit_rule"
    && event.targetActorIds[0] === "e_block" && event.values.statusId === "staggered"),
  "A2 applies its first stagger to the target of a blocked hit");
}

{
  const base = simulateBattle(battle({}), content);
  const heavy = simulateBattle(battle({ activeSkillId: "warhammer_heavy_blow" }), content);
  const heaven = simulateBattle(battle({
    activeSkillId: "warhammer_heaven_blow",
    enemies: [
      { instanceId: "e_far", enemyActorId: "weapon_test_dummy", position: "front_right" },
      { instanceId: "e_near", enemyActorId: "weapon_test_dummy", position: "front_left" },
    ],
  }), content);
  const baseAmount = base.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_blow").values.amount;
  const heavyAmount = heavy.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_heavy_blow").values.amount;
  const heavenAmount = heaven.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_heaven_blow").values.amount;
  ok(Math.abs(heavyAmount * 100 - baseAmount * 170) <= baseAmount * 2,
    "A3 replaces R with a 170% might attack");
  ok(Math.abs(heavenAmount * 100 - baseAmount * 220) <= baseAmount * 2,
    "AA3 replaces A3 with a 220% nearest-target attack");
  equal(heaven.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_heaven_blow")?.targetActorIds[0], "e_near",
  "AA3 chooses the nearest enemy from its fixed legal target set");

  const targetedA3 = simulateBattle(battle({
    activeSkillId: "warhammer_heavy_blow",
    targetSkillIds: ["warhammer_point_at_armor"],
    enemies: [
      { instanceId: "e_plain", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_armored", enemyActorId: "weapon_test_armored", position: "front_right" },
    ],
  }), content);
  equal(targetedA3.events.find((event) => event.type === "target_selected"
    && event.skillId === "warhammer_heavy_blow")?.targetActorIds[0], "e_armored",
  "A3 follows the target priority column when it replaces R");
}

{
  const noNeighbor = simulateBattle(battle({
    reactiveSkillIds: ["warhammer_wide_swing"],
  }), content);
  equal(noNeighbor.events.filter((event) => event.type === "resource_spent"
    && event.values.resource === "reaction_points").length, 0,
  "AB1 does not spend RP when no adjacent valid enemy can be added");
  equal(noNeighbor.events.filter((event) => event.type === "damage_proposed"
    && event.tags.includes("plan_extra_damage")).length, 0,
  "AB1 leaves a single-target plan unchanged when its condition fails");
}

{
  const swept = simulateBattle(battle({
    reactiveSkillIds: ["warhammer_wide_swing"],
    passiveSkillIds: ["warhammer_sweep"],
    enemies: [
      { instanceId: "e_primary", enemyActorId: "weapon_test_dummy", position: "front_center" },
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_adjacent", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  const sweepChanges = swept.events.filter((event) => event.type === "pending_amount_modified"
    && event.ruleId === "warhammer_sweep_rule");
  equal(sweepChanges.length, 3, "AB2 increases the primary and every AB1 extra-target hit");
  ok(sweepChanges.every((event) => event.values.delta === Math.floor(event.values.before * 15 / 100)),
    "AB2 applies 15% to each planned target before hit resolution");
  ok(swept.events.filter((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_user").every((event) => event.values.plannedTargetCount === 3),
  "AB2 counts distinct planned enemy IDs across both AB1 extra targets");

  const manyHitsOneTarget = simulateBattle(battle({
    characterId: "tactician",
    activeSkillId: "borrowed_four_hit",
    passiveSkillIds: ["warhammer_sweep"],
  }), content);
  equal(manyHitsOneTarget.events.filter((event) => event.type === "pending_amount_modified"
    && event.ruleId === "warhammer_sweep_rule").length, 0,
  "AB2 does not mistake repeated hits on one enemy for a multi-target plan");
}

{
  const row = simulateBattle(battle({
    activeSkillId: "warhammer_earth_splitter",
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
      { instanceId: "e_rear", enemyActorId: "weapon_test_dummy", position: "rear_center" },
    ],
  }), content);
  const proposals = row.events.filter((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_earth_splitter");
  assert.deepEqual(proposals.map((event) => event.targetActorIds[0]).sort(), ["e_left", "e_right"]);
  const rootAmount = simulateBattle(battle({}), content).events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_blow").values.amount;
  ok(proposals.every((event) => Math.abs(event.values.amount * 100 - rootAmount * 160) <= rootAmount * 2),
    "AB3 hits the anchored enemy row for 160% might and does not reach the rear row");
  checks += 1;
}

{
  const armorTarget = simulateBattle(battle({
    position: "rear_left",
    targetSkillIds: ["warhammer_point_at_armor"],
    enemies: [
      { instanceId: "e_many_blocks", enemyActorId: "weapon_test_blocked", position: "front_left" },
      { instanceId: "e_one_block_high_guard", enemyActorId: "weapon_test_blocked_one_guard_30", position: "front_center" },
      { instanceId: "e_barrier_high_guard", enemyActorId: "weapon_test_barrier_guard_200", position: "front_right" },
    ],
  }), content);
  const selected = armorTarget.events.find((event) => event.type === "target_selected"
    && event.skillId === "warhammer_blow");
  equal(selected?.targetActorIds[0], "e_one_block_high_guard",
    "B1 prioritizes block presence, then guard, before block count, distance, and barrier-only targets");

  const fallback = simulateBattle(battle({
    targetSkillIds: ["warhammer_point_at_armor"],
    enemies: [
      { instanceId: "e_near", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_far", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(fallback.events.find((event) => event.type === "target_selected"
    && event.skillId === "warhammer_blow")?.targetActorIds[0], "e_near",
  "B1 returns no candidate without defense so the active falls through to its normal nearest target");
}

{
  const counter = simulateBattle(battle({
    allies: [
      allyInput("a_counter", "warden", "weapon_test_utility", "rear_left", {
        reactiveSkillIds: ["warhammer_break_point", "warhammer_ringing_iron"],
        passiveSkillIds: ["warhammer_deep_impact"],
      }),
      allyInput("a_wounded", "warden", "weapon_test_utility", "front_left", { hp: 250 }),
    ],
    enemies: [{ instanceId: "e_row", enemyActorId: "weapon_test_row_attacker", position: "front_center" }],
  }), content);
  equal(counter.events.filter((event) => event.type === "damage_taken"
    && event.sourceActorId === "e_row" && event.targetActorIds[0] === "a_wounded").length, 2,
  "B2 waits for actual HP damage from the enemy's two-hit attack");
  const counterHit = counter.events.filter((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_counter" && event.tags.includes("counter"));
  equal(counterHit.length, 1, "B2 retaliates once per chain against a different ally's attacker");
  ok(counterHit.every((event) => !event.tags.includes("attack")),
    "B2 retaliation is not treated as an attack action");
  equal(counter.events.filter((event) => event.type === "resource_spent"
    && event.values.resource === "reaction_points").length, 1,
  "B2 pays once, and its counter does not recursively trigger A2");
  ok(counter.events.some((event) => event.type === "status_added"
    && event.ruleId === "warhammer_break_point_rule"
    && event.targetActorIds[0] === "e_row" && event.values.statusId === "staggered"),
  "B2 staggers the living attacker after the counter damage");
  ok(counter.events.some((event) => event.type === "status_added"
    && event.ruleId === "warhammer_deep_impact_rule"
    && event.targetActorIds[0] === "e_row" && event.values.statusId === "staggered"),
  "AA2 strengthens B2's cross-weapon stagger");
}

{
  const siege = simulateBattle(battle({
    activeSkillId: "warhammer_siege_blow",
    passiveSkillIds: ["warhammer_trophy_fragment"],
    enemies: [{ instanceId: "e_salvage", enemyActorId: "weapon_test_salvage_target", position: "front_left" }],
  }), content);
  const proposalIndex = siege.events.findIndex((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_siege_blow");
  const defenseRemovalIndices = siege.events.map((event, index) => (
    ["barrier_broken", "block_spent"].includes(event.type)
      && event.targetActorIds[0] === "e_salvage" && event.tags.includes("effect") ? index : -1
  )).filter((index) => index >= 0);
  ok(defenseRemovalIndices.length >= 2 && defenseRemovalIndices.every((index) => index < proposalIndex),
    "B3 removes barrier and block before its 130% hit");
  const siegeAmount = siege.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_siege_blow").values.amount;
  const rootAmount = simulateBattle(battle({}), content).events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_blow").values.amount;
  ok(Math.abs(siegeAmount * 100 - rootAmount * 130) <= rootAmount * 2,
    "B3 applies its 130% might coefficient");
  equal(siege.events.filter((event) => event.type === "block_spent"
    && event.targetActorIds[0] === "e_salvage" && event.tags.includes("effect")).at(-1)?.values.after, 0,
  "B3 removes every block charge");
  equal(siege.events.filter((event) => event.type === "status_added"
    && event.ruleId === "warhammer_trophy_fragment_block_rule"
    && event.targetActorIds[0] === "a_user").reduce((sum, event) => sum + event.values.added, 0), 6,
  "BB1 gains fortified two for each of B3's three removed block charges, while barrier gives none");
}

{
  for (const [skillId, coefficient] of [
    ["warhammer_dismantler", 170],
    ["warhammer_kingslayer", 180],
  ]) {
    const dismantled = simulateBattle(battle({
      activeSkillId: skillId,
      enemies: [{ instanceId: "e_salvage", enemyActorId: "weapon_test_salvage_target", position: "front_left" }],
    }), content);
    const proposal = dismantled.events.find((event) => event.type === "damage_proposed"
      && event.skillId === skillId);
    const baseline = simulateBattle(battle({}), content).events.find((event) => event.type === "damage_proposed"
      && event.skillId === "warhammer_blow").values.amount;
    ok(Math.abs(proposal.values.amount * 100 - baseline * coefficient) <= baseline * 2,
      `${skillId} uses its catalog ${coefficient}% might coefficient`);
    const target = dismantled.actors.find((actor) => actor.instanceId === "e_salvage");
    equal(dismantled.events.filter((event) => event.type === "block_spent"
      && event.targetActorIds[0] === "e_salvage" && event.tags.includes("effect")).at(-1)?.values.after, 0,
    `${skillId} removes all block charges before damage`);
    equal(target.barriers.length, 0, `${skillId} removes barrier before damage`);
    equal(target.guard, 20, `${skillId} preserves the target's base guard`);
    const negativeStatusRemovedBeforeHit = dismantled.events.some((event, index) => (
      event.type === "status_removed" && event.targetActorIds[0] === "e_salvage"
        && event.values.statusId === "armor_broken"
        && index < dismantled.events.findIndex((entry) => entry.type === "damage_proposed"
          && entry.skillId === skillId)
    ));
    ok(!negativeStatusRemovedBeforeHit,
      `${skillId} preserves negative armor-broken through damage calculation`);
    const hpDamage = dismantled.events.find((event) => event.type === "damage_taken"
      && event.skillId === skillId && event.targetActorIds[0] === "e_salvage");
    equal(hpDamage?.values.guardApplied, target.guard - 1,
      `${skillId} keeps negative armor-broken effective while preserving base guard`);
    ok(!target.statuses.some((status) => ["focused", "warded", "fortified"].includes(status.statusId)),
      `${skillId} removes every positive buff`);
    ok(dismantled.events.findIndex((event) => event.type === "damage_proposed"
      && event.skillId === skillId) > dismantled.events.findLastIndex((event) => (
      ["barrier_broken", "block_spent", "status_removed"].includes(event.type)
        && event.targetActorIds[0] === "e_salvage" && event.tags.includes("effect")
    )), `${skillId} resolves all removals before its hit`);
  }
}

{
  const reverseForging = simulateBattle(battle({
    characterId: "weapon_test_buff_giver",
    activeSkillId: "borrowed_four_hit",
    passiveSkillIds: ["warhammer_reverse_forging"],
  }), content);
  const proposals = reverseForging.events.filter((event) => event.type === "damage_proposed"
    && event.skillId === "borrowed_four_hit");
  const boosts = reverseForging.events.filter((event) => event.type === "pending_amount_modified"
    && event.ruleId === "warhammer_reverse_forging_damage_rule");
  equal(boosts.length, 4, "BB2 applies its attack-start snapshot to every hit in the attack");
  ok(boosts.every((event) => event.values.delta === Math.floor(
    proposals.find((proposal) => proposal.id === event.values.proposalEventId).values.amount * 45 / 100,
  )), "BB2 uses the same three-stack snapshot even as the attack resolves");
  const lastHit = Math.max(...reverseForging.events.map((event, index) => (
    event.type === "damage_resolved" && event.sourceActorId === "a_user" ? index : -1
  )));
  const spent = reverseForging.events.findIndex((event) => event.type === "status_removed"
    && event.ruleId === "warhammer_reverse_forging_spend_rule"
    && event.values.statusId === "fortified");
  ok(spent > lastHit, "BB2 consumes all fortified after its attack has resolved");
  equal(reverseForging.events[spent].values.removed, 3, "BB2 consumes every starting fortified stack");

  const removedAfterSnapshot = simulateBattle(battle({
    characterId: "weapon_test_buff_giver",
    activeSkillId: "warhammer_blow",
    passiveSkillIds: [
      "warhammer_reverse_forging",
      "weapon_test_consume_fortified_after_target",
    ],
  }), content);
  const proposal = removedAfterSnapshot.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "warhammer_blow");
  const snapshotBoost = removedAfterSnapshot.events.find((event) => event.type === "pending_amount_modified"
    && event.ruleId === "warhammer_reverse_forging_damage_rule");
  equal(removedAfterSnapshot.events.find((event) => event.type === "status_removed"
    && event.ruleId === "weapon_test_consume_fortified_after_target_rule")?.values.removed, 3,
  "test reaction removes fortified after the attack-start snapshot");
  equal(snapshotBoost?.values.delta, Math.floor(proposal.values.amount * 45 / 100),
    "BB2 still uses the saved attack-start fortified after a mid-plan removal");

  const utility = simulateBattle(battle({
    characterId: "weapon_test_buff_giver",
    activeSkillId: "weapon_test_utility",
    passiveSkillIds: ["warhammer_reverse_forging"],
  }), content);
  equal(utility.events.filter((event) => event.type === "status_removed"
    && event.ruleId === "warhammer_reverse_forging_spend_rule").length, 0,
  "BB2 does not consume fortified after a non-attack utility action");
}

{
  const gauntletsCombo = simulateBattle(battle({
    activeSkillId: "gauntlets_punch",
    reactiveSkillIds: ["gauntlets_chasing_fist"],
    passiveSkillIds: ["gauntlets_combo_fists"],
  }), content);
  equal(gauntletsCombo.events.filter((event) => (
    event.type === "damage_proposed" && event.sourceActorId === "a_user"
  )).length, 3, "AA1 adds one hit to A2's two-hit follow-up");
  const followUps = gauntletsCombo.events.filter((event) => event.type === "damage_proposed"
    && event.tags.includes("extra_hit"));
  equal(followUps.length, 2, "AA1 makes A2's follow-up two hits");
  const primary = gauntletsCombo.events.find((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_user" && !event.tags.includes("extra_hit"));
  ok(followUps.every((event) => event.tags.includes("attack")
    && Math.abs(event.values.amount * 90 - primary.values.amount * 50) <= primary.values.amount * 2),
  "AA1 preserves the 50% coefficient and non-recursive extra-hit tag on both follow-ups");
}

{
  const gauntletsFootwork = simulateBattle(battle({
    position: "rear_center",
    activeSkillId: "gauntlets_punch",
    reactiveSkillIds: ["gauntlets_footwork", "gauntlets_empty_pocket"],
  }), content);
  ok(gauntletsFootwork.events.some((event) => event.type === "actor_moved"
    && event.tags[0] === "move"),
  "gauntlets footwork advances a rear-row melee action before damage");
  equal(gauntletsFootwork.actors.find((actor) => actor.instanceId === "a_user").position,
    "front_center", "BA1 advances the attacker before a melee action");
  ok(gauntletsFootwork.events.some((event) => (
    event.type === "status_added"
      && event.ruleId === "gauntlets_empty_pocket_rule"
      && event.values.statusId === "gauntlets_combo"
  )), "BA2 adds one unlinked combo after BA1's movement");
  equal(gauntletsFootwork.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "gauntlets_combo")?.stacks, 1,
  "BA2 grants exactly one combo without B2 hit stacking");
}

{
  const gauntletsGuard = simulateBattle(battle({
    activeSkillId: "gauntlets_double_punch",
    passiveSkillIds: ["gauntlets_strike_guard"],
  }), content);
  const earnedBarrier = gauntletsGuard.events.filter((event) => (
    event.type === "barrier_gained" && event.ruleId === "gauntlets_strike_guard_rule"
  ));
  equal(earnedBarrier.length, 2, "AB2 grants barrier once after each resolved hit");
  equal(earnedBarrier.reduce((sum, event) => sum + event.values.amount, 0), 8,
    "AB2 grants barrier 4 per hit rather than a fixed post-action amount");

  const blockedHits = simulateBattle(battle({
    activeSkillId: "gauntlets_double_punch",
    passiveSkillIds: ["gauntlets_strike_guard", "gauntlets_streak"],
    enemies: [{ instanceId: "e_block", enemyActorId: "weapon_test_blocked", position: "front_left" }],
  }), content);
  equal(blockedHits.events.filter((event) => event.type === "damage_resolved"
    && event.skillId === "gauntlets_double_punch" && event.values.result === "blocked").length, 2,
  "B2 and AB2 receive both block-resolved hits, even with no HP damage");
  equal(blockedHits.events.filter((event) => event.type === "status_added"
    && event.ruleId === "gauntlets_streak_hit_rule"
    && event.values.statusId === "gauntlets_combo").length, 2,
  "B2 adds one combo per resolved hit through block");
  equal(blockedHits.events.filter((event) => event.type === "barrier_gained"
    && event.ruleId === "gauntlets_strike_guard_rule").length, 2,
  "AB2 grants barrier after each block-resolved hit");
}

{
  const nearest = simulateBattle(battle({
    activeSkillId: "gauntlets_punch",
    enemies: [
      { instanceId: "e_nearest", enemyActorId: "weapon_test_dummy", position: "front_center" },
      { instanceId: "e_farther", enemyActorId: "weapon_test_dummy", position: "front_left" },
    ],
  }), content);
  equal(nearest.events.find((event) => event.type === "target_selected"
    && event.skillId === "gauntlets_punch").targetActorIds[0], "e_nearest",
  "R selects the nearest valid enemy before fixed position order");
  const punchAmount = nearest.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "gauntlets_punch").values.amount;
  const warhammerAmount = simulateBattle(battle({ activeSkillId: "warhammer_blow" }), content)
    .events.find((event) => event.type === "damage_proposed"
      && event.skillId === "warhammer_blow").values.amount;
  ok(Math.abs(punchAmount * 100 - warhammerAmount * 90) <= warhammerAmount * 2,
    "R applies its 90% might coefficient");
}

{
  const followUp = simulateBattle(battle({
    activeSkillId: "gauntlets_punch",
    reactiveSkillIds: ["gauntlets_chasing_fist"],
  }), content);
  const hits = followUp.events.filter((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_user");
  equal(hits.length, 2, "A2 adds exactly one follow-up hit to a one-hit melee attack");
  equal(hits.filter((event) => event.tags.includes("extra_hit")).length, 1,
    "A2's follow-up is marked to prevent recursion");
  const primaryAmount = hits.find((event) => !event.tags.includes("extra_hit")).values.amount;
  const followUpAmount = hits.find((event) => event.tags.includes("extra_hit")).values.amount;
  ok(Math.abs(followUpAmount * 90 - primaryAmount * 50) <= primaryAmount * 2,
    "A2 deals 50% might on its follow-up hit");
  equal(followUp.events.filter((event) => event.type === "resource_spent"
    && event.values.resource === "reaction_points").length, 1,
  "A2 spends one RP once for the action");

  const blockedFollowUp = simulateBattle(battle({
    activeSkillId: "gauntlets_punch",
    reactiveSkillIds: ["gauntlets_chasing_fist"],
    enemies: [{ instanceId: "e_block", enemyActorId: "weapon_test_blocked", position: "front_left" }],
  }), content);
  ok(blockedFollowUp.events.some((event) => event.type === "damage_resolved"
    && event.values.result === "blocked" && event.targetActorIds[0] === "e_block"),
  "A2 recognizes a first hit resolved by block");
  equal(blockedFollowUp.events.filter((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_user").length, 2,
  "A2 still creates its one follow-up from a blocked first hit");
  equal(blockedFollowUp.events.filter((event) => event.type === "resource_spent"
    && event.values.resource === "reaction_points").length, 1,
  "A2 pays once for its blocked-hit follow-up");

  const expandedPlan = simulateBattle(battle({
    activeSkillId: "warhammer_heavy_blow",
    reactiveSkillIds: ["gauntlets_chasing_fist", "warhammer_wide_swing"],
    enemies: [
      { instanceId: "e_primary", enemyActorId: "weapon_test_dummy", position: "front_center" },
      { instanceId: "e_adjacent", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(expandedPlan.events.filter((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_user" && event.tags.includes("extra_hit")).length, 0,
  "A2 does not add a follow-up when the original single-target attack has an expanded target plan");
  equal(expandedPlan.events.filter((event) => event.type === "resource_spent"
    && event.values.resource === "reaction_points").length, 1,
  "only the wide-swing target expansion spends RP on the multi-target plan");
}

{
  const grip = simulateBattle(battle({
    activeSkillId: "gauntlets_double_punch",
    passiveSkillIds: ["gauntlets_grip"],
  }), content);
  const gripChanges = grip.events.filter((event) => event.type === "pending_amount_modified"
    && event.ruleId === "gauntlets_grip_rule");
  equal(gripChanges.length, 1, "A1 affects every hit after hit 1, not the first hit");
  ok(gripChanges[0].values.delta > 0, "A1 adds 10% of the later hit's damage proposal");
  const twoPunches = grip.events.filter((event) => event.type === "damage_proposed"
    && event.skillId === "gauntlets_double_punch");
  const rootPunch = simulateBattle(battle({ activeSkillId: "gauntlets_punch" }), content)
    .events.find((event) => event.type === "damage_proposed"
      && event.skillId === "gauntlets_punch").values.amount;
  equal(twoPunches.length, 2, "A3 makes exactly two hits against the selected enemy");
  ok(twoPunches.every((event) => Math.abs(event.values.amount * 90 - rootPunch * 65) <= rootPunch * 2),
    "A3 applies the 65% might coefficient to each hit");
}

{
  const pressure = simulateBattle(battle({
    activeSkillId: "gauntlets_double_punch",
    passiveSkillIds: ["gauntlets_pressure"],
    enemies: [{ instanceId: "e_guard", enemyActorId: "weapon_test_guard_20", position: "front_left" }],
  }), content);
  const ignored = pressure.events.filter((event) => event.type === "pending_guard_modified"
    && event.ruleId === "gauntlets_pressure_rule");
  equal(ignored.length, 2, "AA2 ignores guard separately on both hits");
  ok(ignored.every((event) => event.values.delta === 6), "AA2 adds six flat guard ignore per hit");
  ok(pressure.events.filter((event) => event.type === "damage_taken"
    && event.sourceActorId === "a_user").every((event) => event.values.guardApplied === 14),
  "AA2's six ignore combines with the target's 20 guard on each hit");
}

{
  const sharedMelee = simulateBattle(battle({
    activeSkillId: "warhammer_blow",
    reactiveSkillIds: ["gauntlets_chasing_fist"],
    passiveSkillIds: ["gauntlets_pressure"],
    enemies: [{ instanceId: "e_guard", enemyActorId: "weapon_test_guard_20", position: "front_left" }],
  }), content);
  equal(sharedMelee.events.filter((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_user").length, 2,
  "A2 recognizes another weapon's rangeClass melee tag and follows its first hit");
  equal(sharedMelee.events.filter((event) => event.type === "pending_guard_modified"
    && event.ruleId === "gauntlets_pressure_rule").length, 2,
  "AA2 applies to another weapon's melee hits through the shared range class");
}

{
  const fourFists = simulateBattle(battle({
    activeSkillId: "gauntlets_hundred_fists",
    reactiveSkillIds: ["gauntlets_chasing_fist"],
  }), content);
  equal(fourFists.events.filter((event) => event.type === "damage_proposed"
    && event.sourceActorId === "a_user").length, 5,
  "AA3 makes four primary hits and A2 checks the primary first hit once");
  equal(fourFists.events.filter((event) => event.type === "resource_spent"
    && event.values.resource === "reaction_points").length, 1,
  "AA3's four-hit plan does not multiply A2's RP cost");
  const fourPrimaryHits = fourFists.events.filter((event) => event.type === "damage_proposed"
    && event.skillId === "gauntlets_hundred_fists" && !event.tags.includes("extra_hit"));
  const rootPunch = simulateBattle(battle({ activeSkillId: "gauntlets_punch" }), content)
    .events.find((event) => event.type === "damage_proposed"
      && event.skillId === "gauntlets_punch").values.amount;
  equal(fourPrimaryHits.length, 4, "AA3 keeps four primary hits separate from the A2 follow-up");
  ok(fourPrimaryHits.every((event) => Math.abs(event.values.amount * 90 - rootPunch * 65) <= rootPunch * 2),
    "AA3 applies the 65% might coefficient to all four primary hits");
}

{
  const flowing = simulateBattle(battle({
    activeSkillId: "weapon_test_utility",
    reactiveSkillIds: ["gauntlets_knuckle_guard"],
    enemies: [{ instanceId: "e_heavy", enemyActorId: "weapon_test_heavy", position: "front_left" }],
  }), content);
  const reduced = flowing.events.find((event) => event.type === "pending_amount_modified"
    && event.ruleId === "gauntlets_knuckle_guard_reduce_rule");
  ok(reduced && reduced.values.delta < 0
    && reduced.values.after === Math.round(reduced.values.before * 0.65),
  "AB1 reduces the incoming proposal by 35%");
  ok(flowing.events.some((event) => event.type === "actor_moved" && event.tags.includes("move")
    && event.targetActorIds[0] === "a_user"
    && event.values.from === "front_center" && event.values.to === "rear_center"),
  "AB1 steps a surviving front-line wearer into an open rear slot");
  ok(flowing.events.some((event) => event.type === "actor_moved" && event.tags.includes("return")
    && event.targetActorIds[0] === "a_user"), "AB1 returns to the original front slot at round end");
  equal(flowing.actors.find((actor) => actor.instanceId === "a_user").position, "front_center",
    "AB1 finishes in its original position when that slot is open");
}

{
  const scopedFlowing = simulateBattle(battle({
    allies: [
      allyInput("a_guard", "warden", "weapon_test_utility", "front_left", {
        reactiveSkillIds: ["gauntlets_knuckle_guard"],
      }),
      allyInput("a_no_rp", "weapon_test_no_rp", "weapon_test_utility", "front_center", {
        reactiveSkillIds: ["gauntlets_knuckle_guard"],
      }),
    ],
    enemies: [{ instanceId: "e_row", enemyActorId: "weapon_test_row_attacker", position: "front_center" }],
  }), content);
  const reductions = scopedFlowing.events.filter((event) => event.type === "pending_amount_modified"
    && event.ruleId === "gauntlets_knuckle_guard_reduce_rule"
    && event.targetActorIds[0] === "a_guard");
  equal(reductions.length, 2, "AB1 spends RP and reduces each incoming hit while RP remains");
  ok(!scopedFlowing.events.some((event) => event.type === "actor_moved"
    && event.ruleId === "gauntlets_knuckle_guard_retreat_rule"
    && event.targetActorIds[0] === "a_no_rp"),
  "AB1's attack flag cannot make a second wearer retreat without paying RP");
  const lastDamageIndex = Math.max(...scopedFlowing.events.map((event, index) => (
    event.type === "damage_resolved" && event.sourceActorId === "e_row" ? index : -1
  )));
  const retreatIndex = scopedFlowing.events.findIndex((event) => event.type === "actor_moved"
    && event.ruleId === "gauntlets_knuckle_guard_retreat_rule"
    && event.targetActorIds[0] === "a_guard" && event.tags.includes("move"));
  ok(retreatIndex > lastDamageIndex,
    "AB1 retreats after the entire multi-target, multi-hit attack has resolved");
}

{
  const ironBody = simulateBattle(battle({
    activeSkillId: "gauntlets_iron_body",
    enemies: [{ instanceId: "e_barrier", enemyActorId: "weapon_test_low_barrier", position: "front_left" }],
  }), content);
  const dealt = ironBody.events.find((event) => event.type === "damage_resolved"
    && event.skillId === "gauntlets_iron_body");
  const gained = ironBody.events.find((event) => event.type === "barrier_gained"
    && event.skillId === "gauntlets_iron_body");
  equal(gained?.values.amount, dealt?.values.hpDamage,
    "AB3's barrier equals actual HP damage after the enemy's existing barrier");
  const ironBodyAmount = ironBody.events.find((event) => event.type === "damage_proposed"
    && event.skillId === "gauntlets_iron_body").values.amount;
  const rootPunch = simulateBattle(battle({ activeSkillId: "gauntlets_punch" }), content)
    .events.find((event) => event.type === "damage_proposed"
      && event.skillId === "gauntlets_punch").values.amount;
  ok(Math.abs(ironBodyAmount * 90 - rootPunch * 140) <= rootPunch * 2,
    "AB3 applies its 140% might coefficient before converting actual HP damage to barrier");
}

{
  const priority = simulateBattle(battle({
    activeSkillId: "gauntlets_punch",
    targetSkillIds: ["gauntlets_watch_target"],
    enemies: [
      { instanceId: "e_70", enemyActorId: "weapon_test_dummy", position: "front_center", hp: 7_000 },
      { instanceId: "e_60", enemyActorId: "weapon_test_dummy", position: "front_left", hp: 6_000 },
    ],
  }), content);
  equal(priority.events.find((event) => event.type === "target_selected"
    && event.skillId === "gauntlets_punch").targetActorIds[0], "e_60",
  "B1 selects the lowest injured HP percentage even when the target is farther away");
  const full = simulateBattle(battle({
    activeSkillId: "gauntlets_punch",
    targetSkillIds: ["gauntlets_watch_target"],
    enemies: [
      { instanceId: "e_far", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_near", enemyActorId: "weapon_test_dummy", position: "front_center" },
    ],
  }), content);
  equal(full.events.find((event) => event.type === "target_selected"
    && event.skillId === "gauntlets_punch").targetActorIds[0], "e_near",
  "B1 falls through to the normal nearest target when all enemies are at full HP");
  const tied = simulateBattle(battle({
    activeSkillId: "gauntlets_punch",
    targetSkillIds: ["gauntlets_watch_target"],
    enemies: [
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right", hp: 8_000 },
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left", hp: 8_000 },
    ],
  }), content);
  equal(tied.events.find((event) => event.type === "target_selected"
    && event.skillId === "gauntlets_punch").targetActorIds[0], "e_left",
  "B1 resolves equal HP percentage and distance with the fixed position order");
}

{
  const streak = simulateBattle(battle({
    maxRounds: 2,
    objective: { type: "survive_rounds", rounds: 2 },
    characterId: "weapon_test_high_might",
    activeSkillId: "gauntlets_double_punch",
    passiveSkillIds: ["gauntlets_streak"],
  }), content);
  const user = streak.actors.find((actor) => actor.instanceId === "a_user");
  equal(user.statuses.find((status) => status.statusId === "gauntlets_combo")?.stacks, 4,
    "B2 adds one linked combo for each of two hits in each of two actions");
  const secondActionBonus = streak.events.filter((event) => event.type === "pending_amount_modified"
    && event.ruleId === "gauntlets_streak_damage_rule" && event.round === 2);
  equal(streak.events.filter((event) => event.type === "pending_amount_modified"
    && event.ruleId === "gauntlets_streak_damage_rule" && event.round === 1).length, 0,
  "B2 does not apply stacks gained during an action to that same action");
  equal(secondActionBonus.length, 2, "B2 applies its attack-start snapshot to each second-action hit");
  ok(secondActionBonus.every((event) => event.values.delta > 0),
    "B2's linked combo increases damage by 0.5% per starting stack on later attacks");

  const defeatedTarget = simulateBattle(battle({
    characterId: "weapon_test_high_might",
    activeSkillId: "gauntlets_double_punch",
    passiveSkillIds: ["gauntlets_streak"],
    enemies: [{ instanceId: "e_dies", enemyActorId: "weapon_test_dummy", position: "front_left", hp: 300 }],
  }), content);
  equal(defeatedTarget.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "gauntlets_combo"), undefined,
  "B2 clears its target-linked stacks when that target is defeated mid-action");

  const capped = simulateBattle(battle({
    characterId: "weapon_test_gauntlet_combo_cap",
    activeSkillId: "gauntlets_punch",
    passiveSkillIds: ["gauntlets_streak"],
  }), content);
  equal(capped.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "gauntlets_combo")?.stacks, 300,
  "B2 never exceeds the shared 300-stack combo cap");
}

{
  const barrage = simulateBattle(battle({
    characterId: "weapon_test_gauntlet_stacks",
    activeSkillId: "gauntlets_barrage",
    passiveSkillIds: ["gauntlets_streak"],
  }), content);
  equal(barrage.events.find((event) => event.type === "damage_taken"
    && event.skillId === "gauntlets_barrage")?.values.amount, 311,
  "B3 combines 120% + 1.5% per attack-start combo with B2's 0.5% damage bonus");
  const knee = simulateBattle(battle({
    characterId: "weapon_test_gauntlet_stacks",
    activeSkillId: "gauntlets_flying_knee",
    passiveSkillIds: ["gauntlets_streak"],
  }), content);
  equal(knee.events.find((event) => event.type === "damage_taken"
    && event.skillId === "gauntlets_flying_knee")?.values.amount, 439,
  "BA3 combines 170% + 2% per attack-start combo with B2's 0.5% damage bonus");
}

{
  const copiedStatus = simulateBattle(battle({
    allies: [
      allyInput("a_user", "warden", "weapon_test_utility", "front_center", {
        reactiveSkillIds: ["gauntlets_form_record", "gauntlets_borrowed_stance"],
      }),
      allyInput("a_friend", "weapon_test_buff_giver", "weapon_test_utility", "front_left"),
    ],
  }), content);
  const copied = copiedStatus.events.find((event) => event.type === "status_added"
    && event.ruleId === "gauntlets_form_record_rule" && event.targetActorIds[0] === "a_user");
  equal(copied?.values.statusId, "fortified", "BB1 copies a neighboring ally's positive status type");
  equal(copied?.values.added, 3, "BB1 copies the same number of status stacks");
  equal(copiedStatus.events.filter((event) => event.type === "resource_spent"
    && event.sourceDefinitionId === "gauntlets_form_record").length, 1,
  "BB1 spends RP once for the copied status");
  ok(!copiedStatus.events.some((event) => event.type === "status_added"
    && event.ruleId === "gauntlets_borrowed_stance_rule"),
  "BB1's copy does not retrigger BB2");

  const copiedSelf = simulateBattle(battle({
    characterId: "weapon_test_buff_giver",
    activeSkillId: "weapon_test_utility",
    reactiveSkillIds: ["gauntlets_borrowed_stance"],
  }), content);
  const selfCopies = copiedSelf.events.filter((event) => event.type === "status_added"
    && event.ruleId === "gauntlets_borrowed_stance_rule");
  equal(selfCopies.length, 1, "BB2 adds exactly one copied stack without recursively firing itself");
  equal(selfCopies[0].values.added, 1, "BB2 adds one stack of the received status");
}

{
  const copiedBlock = simulateBattle(battle({
    allies: [
      allyInput("a_user", "warden", "weapon_test_utility", "front_center", {
        reactiveSkillIds: ["gauntlets_form_record", "gauntlets_borrowed_stance"],
      }),
      allyInput("a_friend", "weapon_test_block_giver", "weapon_test_utility", "front_left"),
    ],
  }), content);
  const copiedCharge = copiedBlock.events.find((event) => event.type === "block_gained"
    && event.ruleId === "gauntlets_form_record_block_rule"
    && event.targetActorIds[0] === "a_user");
  equal(copiedCharge?.values.amount, 3, "BB1 copies the same number of positive block charges");
  ok(copiedCharge?.tags.includes("copy_suppressed"),
    "BB1 marks copied block charges so BB1 and BB2 do not recurse");
  ok(!copiedBlock.events.some((event) => event.type === "block_gained"
    && event.ruleId === "gauntlets_borrowed_stance_block_rule"),
  "BB1's block copy does not retrigger BB2");

  const copiedOwnBlock = simulateBattle(battle({
    characterId: "weapon_test_block_giver",
    activeSkillId: "weapon_test_utility",
    reactiveSkillIds: ["gauntlets_borrowed_stance"],
  }), content);
  const extraCharge = copiedOwnBlock.events.find((event) => event.type === "block_gained"
    && event.ruleId === "gauntlets_borrowed_stance_block_rule");
  equal(extraCharge?.values.amount, 1, "BB2 adds one block charge when its owner gains a positive block charge");
}

{
  const emptyHand = simulateBattle(battle({
    characterId: "weapon_test_gauntlet_stacks",
    activeSkillId: "gauntlets_empty_hand",
    passiveSkillIds: ["gauntlets_streak"],
  }), content);
  const user = emptyHand.actors.find((actor) => actor.instanceId === "a_user");
  equal(emptyHand.events.find((event) => event.type === "damage_taken"
    && event.skillId === "gauntlets_empty_hand")?.values.amount, 1_262,
  "BB3 counts each positive status type up to six, including four block charges");
  equal(user.statuses.find((status) => status.statusId === "gauntlets_combo")?.stacks, 5,
    "BB3 adds two linked combo stacks after hit, in addition to B2's one per hit");
  ok(!emptyHand.events.some((event) => event.type === "block_spent"
    && event.targetActorIds[0] === "a_user"), "BB3 counts block charges without consuming them");

  const unlinked = simulateBattle(battle({
    characterId: "weapon_test_gauntlet_stacks",
    activeSkillId: "gauntlets_empty_hand",
  }), content);
  equal(unlinked.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "gauntlets_combo")?.stacks, 2,
  "BB3 grants its extra combo only after hitting its linked enemy");
}

{
  const launcherMulti = simulateBattle(battle({
    characterId: "mender",
    activeSkillId: "launcher_shot",
    reactiveSkillIds: ["launcher_multi_barrel", "launcher_separate_caliber"],
  }), content);
  equal(launcherMulti.events.filter((event) => (
    event.type === "damage_proposed" && event.sourceActorId === "a_user"
  )).length, 2, "launcher multi-barrel adds one hit to a one-hit shot");
  ok(launcherMulti.events.some((event) => (
    event.type === "damage_proposed" && event.tags.includes("extra_hit")
  )), "launcher extra barrel is marked as an extra hit");
}

{
  const launcherObservation = simulateBattle(battle({
    characterId: "mender",
    activeSkillId: "launcher_shot",
    reactiveSkillIds: ["launcher_observation_hole"],
  }), content);
  equal(launcherObservation.actors.find((actor) => actor.instanceId === "e_dummy")
    .statuses.find((status) => status.statusId === "launcher_observed")?.stacks, 1,
  "launcher observation records the selected enemy for the round");
}

{
  const continuity = simulateBattle(battle({
    maxRounds: 2,
    objective: { type: "survive_rounds", rounds: 2 },
    allies: [allyInput("a_user", "warden", "gauntlets_punch", "front_center", {
      activeOverrideSkillId: "weapon_test_first_shot",
      targetSkillIds: ["gauntlets_watch_target"],
    })],
    enemies: [
      { instanceId: "e_near", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_previous", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  const secondAction = continuity.events.filter((event) => (
    event.type === "target_selected" && event.sourceActorId === "a_user"
  ))[1];
  equal(secondAction.targetActorIds[0], "e_previous",
    "previous-target filter carries the owner's last target into the next action chain");
}

{
  const warhammerNodes = WEAPON_SKILL_TREE_NODES.filter((node) => node.weaponId === "warhammer");
  equal(warhammerNodes.length, 19, "acquisition registry exposes all warhammer nodes");
  ok(warhammerNodes.every((node) => node.cost === 1),
    "weapon entry and each following node use the level-free 1 SP cost");
  ok(warhammerNodes.every((node) => (
    node.requires.every((required) => Object.keys(required).length === 1
      && typeof required.skillId === "string")
  )), "weapon prerequisites require acquisition only, never legacy skill levels");

  let run = newRun(newProfile(), { campaignStageSequence: 0, runSeed: "weapon-tree-test" });
  run = {
    ...run,
    runSkillPoints: { ...run.runSkillPoints, warden: 4 },
  };
  equal(manifestWeaponIds(run.manifest)[0], "warhammer", "campaign manifest exposes warhammer at start");
  equal(manifestWeaponIds({}).length, 0, "旧manifestは武器へ自動移行しない");
  const root = WEAPON_SKILL_TREE_NODES.find((node) => node.position === "R");
  const a1 = WEAPON_SKILL_TREE_NODES.find((node) => node.position === "A1");
  const tooEarly = unlockRunSkill(run, "warden", a1);
  equal(tooEarly.ok, false, "a weapon branch cannot skip its root prerequisite");
  const rootResult = unlockRunSkill(run, "warden", root);
  equal(rootResult.ok, true, "weapon root can be bought through the shared unlock boundary");
  equal(rootResult.run.runSkillPoints.warden, 3, "weapon unlock spends exactly one run SP");
  const a1Result = unlockRunSkill(rootResult.run, "warden", a1);
  equal(a1Result.ok, true, "the next weapon node opens after its direct prerequisite");
  const unavailable = unlockRunSkill({
    ...run, manifest: { ...run.manifest, enabledWeaponIds: [] },
  }, "warden", root);
  equal(unavailable.ok, false, "a weapon omitted by the manifest cannot be bought");

  const reservedTarget = warhammerNodes.find((node) => node.position === "AA2");
  let reservationRun = newRun(newProfile(), { runSeed: "weapon-reservation", roster: ["warden"] });
  reservationRun = {
    ...reservationRun,
    runSkillPoints: { warden: 0 },
    runUnlockedSkills: { warden: [] },
    skillReservations: {},
  };
  const reservation = reserveRunSkill(
    reservationRun, "warden", reservedTarget.skillId,
  );
  equal(reservation.ok, true, "a weapon node can be reserved before its prerequisites are bought");
  equal(skillReservationFor(reservation.run, "warden"), reservedTarget.skillId,
    "weapon reservation stores the target node");
  equal(canFulfillSkillReservation(reservation.run, "warden", reservedTarget.skillId), false,
    "weapon reservation waits while the path exceeds the current SP");
  const fundedReservation = {
    ...reservation.run,
    runSkillPoints: { warden: 6 },
  };
  equal(canFulfillSkillReservation(fundedReservation, "warden", reservedTarget.skillId), true,
    "weapon reservation becomes fulfillable when the full path is funded");
  const fulfilledReservation = fulfillSkillReservations(fundedReservation);
  equal(skillReservationFor(fulfilledReservation.run, "warden"), null,
    "weapon reservation clears after reaching its target");
  equal(fulfilledReservation.run.runSkillPoints.warden, 0,
    "weapon reservation spends one SP per prerequisite and target node");
  ok(["warhammer_blow", "warhammer_heavy_head", "warhammer_ringing_iron",
    "warhammer_heavy_blow", "warhammer_iron_mass", "warhammer_deep_impact"].every((skillId) => (
    fulfilledReservation.run.runUnlockedSkills.warden.includes(skillId)
  )), "weapon reservation acquires the complete prerequisite path");
  equal(fulfilledReservation.actions.filter((action) => action.type === "unlock").length, 6,
    "weapon reservation exposes each automatic unlock step");

  const target = componentInfo("warhammer_point_at_armor");
  equal(target.kind, "target", "weapon target metadata comes from playable content");
  equal(target.effect, WEAPON_SKILL_TREE_NODES.find((node) => node.skillId === "warhammer_point_at_armor").displayEffect,
    "weapon component metadata uses the player-facing effect text");

  let loadout = installUnlockedSkills(freshLoadout(["warden"]), "warden", ["warhammer_blow"]);
  loadout = selectActiveSkill(loadout, "warden", "warhammer_blow").loadout;
  loadout = installUnlockedSkills(loadout, "warden", ["warhammer_heavy_blow"]);
  equal(loadout.actives.warden, "warhammer_heavy_blow",
    "an acquired active upgrade replaces the selected parent in place");
  equal(loadout.tactics.warden.includes("warhammer_blow"), false,
    "the replaced parent active no longer remains as a second main-action choice");
  loadout = installUnlockedSkills(loadout, "warden", ["warhammer_wide_swing"]);
  loadout = installUnlockedSkills(loadout, "warden", ["warhammer_sweep"]);
  equal(loadout.passives.warden.includes("warhammer_wide_swing"), false,
    "a passive upgrade hides its replaced lower form from the always-on list");
  equal(loadout.passives.warden.includes("warhammer_sweep"), true,
    "the upgraded passive remains always on");
}

{
  const dualNodes = WEAPON_SKILL_TREE_NODES.filter((node) => node.weaponId === "dual_blades");
  equal(dualNodes.length, 19, "dual blades exposes the complete 19-node tree");
  equal(dualNodes[0].position, "R", "dual blades acquisition starts at its own root");
  for (const node of dualNodes) {
    const definition = PLAYABLE_CONTENT[sections[node.kind]][node.skillId];
    ok(definition, `${node.position} points to a real dual-blades ${node.kind} skill`);
    ok(definition.displayEffect?.length > 0, `${node.position} has player-facing effect text`);
    ok(definition.flavorText?.length > 0, `${node.position} has flavor text`);
  }

  const stranded = simulateBattle(battle({
    position: "rear_center",
    activeSkillId: "dual_blades_two_cut",
    reactiveSkillIds: ["dual_blades_dash_in"],
  }), content);
  const strandedMoves = stranded.events.filter((event) => event.type === "actor_moved");
  equal(strandedMoves.length, 1, "dash-in advances once and deliberately remains in front");
  equal(stranded.actors.find((actor) => actor.instanceId === "a_user").position, "front_center",
    "dash-in alone pays for melee power by staying exposed in front");
  const strandedHits = stranded.events.filter((event) => (
    event.type === "damage_proposed" && event.skillId === "dual_blades_two_cut"
  ));
  equal(strandedHits.length, 2, "the root action deals two hits after moving");
  ok(strandedHits.every((event) => event.values.amount === 35),
    "dash-in receives the front-row 125% melee modifier on every hit");

  const returningInput = battle({
    position: "rear_center",
    activeSkillId: "dual_blades_three_cut",
    reactiveSkillIds: ["dual_blades_retreat"],
  });
  returningInput.maxRounds = 2;
  returningInput.objective = { type: "survive_rounds", rounds: 2 };
  const returning = simulateBattle(returningInput, content);
  const returningMoves = returning.events.filter((event) => event.type === "actor_moved");
  equal(returningMoves.length, 4, "retreat repeats advance and return in both rounds");
  assert.deepEqual(returningMoves.map((event) => event.tags[0]), ["move", "return", "move", "return"]);
  checks += 1;
  equal(returning.actors.find((actor) => actor.instanceId === "a_user").position, "rear_center",
    "retreat ends each action in the original safe rear slot");

  const sharpened = simulateBattle(battle({
    characterId: "tactician",
    activeSkillId: "borrowed_four_hit",
    passiveSkillIds: ["dual_blades_split_sharpening"],
  }), content);
  equal(sharpened.events.filter((event) => (
    event.type === "pending_amount_modified"
      && event.ruleId === "dual_blades_split_sharpening_rule"
  )).length, 4, "split sharpening boosts every hit of another multi-hit weapon");

  const extra = simulateBattle(battle({
    activeSkillId: "dual_blades_three_cut",
    passiveSkillIds: ["dual_blades_more_hands"],
  }), content);
  equal(extra.events.filter((event) => (
    event.type === "damage_proposed" && event.tags.includes("extra_hit")
  )).length, 1, "more hands adds exactly one generic extra hit after a three-hit action");
}

{
  const distributed = simulateBattle(battle({
    activeSkillId: "dual_blades_dancing_cut",
    passiveSkillIds: ["dual_blades_edge_pass"],
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  assert.deepEqual(
    distributed.events
      .filter((event) => event.type === "damage_proposed" && event.skillId === "dual_blades_dancing_cut")
      .map((event) => event.targetActorIds[0]),
    ["e_left", "e_right", "e_left", "e_right", "e_left"],
    "AB1 gives the primary target hit one and balances the remaining five hits",
  );
  checks += 1;

  const noDistribution = simulateBattle(battle({
    activeSkillId: "dual_blades_dancing_cut",
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  assert.deepEqual(
    noDistribution.events
      .filter((event) => event.type === "damage_proposed" && event.skillId === "dual_blades_dancing_cut")
      .map((event) => event.targetActorIds[0]),
    Array(5).fill("e_left"),
    "AB3 keeps every hit on the primary target when AB1 is absent",
  );
  checks += 1;

  const noRedistribution = simulateBattle(battle({
    activeSkillId: "dual_blades_dancing_cut",
    passiveSkillIds: ["dual_blades_edge_pass"],
    enemies: [
      { instanceId: "e_weak", enemyActorId: "weapon_test_weak", position: "front_left" },
      { instanceId: "e_next", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(noRedistribution.events.filter((event) => (
    event.type === "damage_proposed" && event.skillId === "dual_blades_dancing_cut"
      && event.targetActorIds[0] === "e_next"
  )).length, 2, "AB1 snapshots targets and does not reassign hits after the primary dies");
  equal(noRedistribution.events.filter((event) => (
    event.type === "damage_skipped" && event.targetActorIds[0] === "e_weak"
  )).length, 2, "remaining hits for the defeated snapshot target are lost");

  const alternation = simulateBattle(battle({
    activeSkillId: "dual_blades_dancing_cut",
    passiveSkillIds: ["dual_blades_edge_pass", "dual_blades_no_waste"],
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(alternation.events.filter((event) => (
    event.type === "pending_amount_modified" && event.ruleId === "dual_blades_no_waste_rule"
  )).length, 4, "AB2 boosts every hit that changes targets, but not the first hit");

  const wound = simulateBattle(battle({
    activeSkillId: "dual_blades_wound_mark",
    reactiveSkillIds: ["dual_blades_lacerating_edge"],
    enemies: [{ instanceId: "e_wound", enemyActorId: "weapon_test_dummy", position: "front_left" }],
  }), content);
  equal(wound.events.filter((event) => (
    event.type === "status_added" && event.ruleId === "dual_blades_lacerating_edge_rule"
      && event.values.statusId === "bleeding"
  ))[0]?.values.added, 4, "B1 adds four bleed stacks on the second hit");
  equal(wound.events.filter((event) => (
    event.type === "status_added" && event.targetActorIds[0] === "e_wound"
      && event.values.statusId === "bleeding"
  )).at(-1)?.values.stacks, 6, "B3 and B1 can build six bleed stacks before round-end decay");

  const hunted = simulateBattle(battle({
    activeSkillId: "dual_blades_two_cut",
    targetSkillIds: ["dual_blades_blood_scent"],
    reactiveSkillIds: ["dual_blades_wound_expansion"],
    enemies: [
      { instanceId: "e_plain", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_bleeding", enemyActorId: "weapon_test_bleeding", position: "front_right" },
    ],
  }), content);
  const huntedSelection = hunted.events.find(
    (event) => event.type === "target_selected" && event.skillId === "dual_blades_two_cut",
  );
  equal(huntedSelection.targetActorIds[0], "e_bleeding", "blood scent follows the bleeding legal target");
  equal(hunted.events.filter((event) => event.ruleId === "dual_blades_wound_expansion_rule").length, 2,
    "wound expansion adds fixed damage on each hit against a bleeding target");

  const bloodPriority = simulateBattle(battle({
    position: "rear_right",
    activeSkillId: "dual_blades_two_cut",
    targetSkillIds: ["dual_blades_blood_scent"],
    enemies: [
      { instanceId: "e_far_bloody", enemyActorId: "weapon_test_bleeding_three", position: "front_left" },
      { instanceId: "e_near_bloody", enemyActorId: "weapon_test_bleeding", position: "front_right" },
    ],
  }), content);
  equal(bloodPriority.events.find((event) => (
    event.type === "target_selected" && event.skillId === "dual_blades_two_cut"
  ))?.targetActorIds[0], "e_far_bloody", "B2 ranks bleed stacks before distance");

  const bloodDistance = simulateBattle(battle({
    position: "rear_right",
    activeSkillId: "dual_blades_two_cut",
    targetSkillIds: ["dual_blades_blood_scent"],
    enemies: [
      { instanceId: "e_far_bloody", enemyActorId: "weapon_test_bleeding", position: "front_left" },
      { instanceId: "e_near_bloody", enemyActorId: "weapon_test_bleeding", position: "front_right" },
    ],
  }), content);
  equal(bloodDistance.events.find((event) => (
    event.type === "target_selected" && event.skillId === "dual_blades_two_cut"
  ))?.targetActorIds[0], "e_near_bloody", "B2 breaks equal bleed stacks by distance to the user");

  const bloodFallback = simulateBattle(battle({
    activeSkillId: "dual_blades_two_cut",
    targetSkillIds: ["dual_blades_blood_scent"],
    enemies: [
      { instanceId: "e_plain_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_plain_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(bloodFallback.events.find((event) => (
    event.type === "target_selected" && event.skillId === "dual_blades_two_cut"
  ))?.targetActorIds[0], "e_plain_left", "B2 falls back to the normal legal target when no enemy bleeds");

  const spray = simulateBattle(battle({
    allies: [
      allyInput("a_user", "warden", "weapon_test_utility", "front_center", {
        reactiveSkillIds: ["dual_blades_blood_spray"],
      }),
      allyInput("a_friend", "warden", "weapon_test_utility", "front_left", { hp: 1 }),
    ],
    enemies: [{ instanceId: "e_attacker", enemyActorId: "gray_scrapper", position: "front_right" }],
  }), content);
  equal(spray.events.filter((event) => (
    event.ruleId === "dual_blades_blood_spray_rule" && event.type === "damage_proposed"
  )).length, 1, "BA2 counters an enemy attack that damages another ally");
  equal(spray.events.find((event) => event.type === "status_added"
    && event.ruleId === "dual_blades_blood_spray_rule" && event.values.statusId === "bleeding")
    ?.values.stacks, 2, "BA2 adds two bleed stacks to the surviving attacker");

  const reserved = simulateBattle(battle({
    allies: [
      allyInput("a_user", "warden", "weapon_test_utility", "rear_center", {
        reactiveSkillIds: ["dual_blades_blade_reservation"],
      }),
      allyInput("a_helper", "warden", "weapon_test_utility", "front_left"),
    ],
  }), content);
  equal(reserved.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade")?.stacks, 1,
  "BB1 records another ally's non-attack main action, not the owner's action");

  const cappedContent = structuredClone(content);
  cappedContent.characters.weapon_test_reserver.signatureRules = [];
  const capped = simulateBattle(battle({
    maxRounds: 2,
    objective: { type: "survive_rounds", rounds: 2 },
    allies: [
      allyInput("a_user", "weapon_test_reserver", "weapon_test_utility", "rear_center", {
        reactiveSkillIds: ["dual_blades_blade_reservation"],
      }),
      ...["left", "center", "right", "rear"].map((label, index) => allyInput(
        `a_helper_${label}`, "warden", "weapon_test_utility", ["front_left", "front_center", "front_right", "rear_left"][index],
      )),
    ],
  }), cappedContent);
  equal(capped.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade")?.stacks, 6,
  "BB1 can build the shared setup to six with no three-per-round limit");

  const noAttackSetup = simulateBattle(battle({
    allies: [
      allyInput("a_user", "warden", "weapon_test_utility", "rear_center", {
        reactiveSkillIds: ["dual_blades_blade_reservation"],
      }),
      allyInput("a_attacker", "warden", "warhammer_blow", "front_left"),
    ],
  }), content);
  equal(noAttackSetup.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade"), undefined,
  "BB1 does not record another ally's attack action");

  const insert = simulateBattle(battle({
    allies: [
      allyInput("a_user", "weapon_test_reserver", "weapon_test_utility", "rear_center", {
        reactiveSkillIds: ["dual_blades_insert_blade"],
      }),
      allyInput("a_friend", "warden", "dual_blades_three_cut", "front_left"),
    ],
    enemies: [{ instanceId: "e_target", enemyActorId: "weapon_test_dummy", position: "front_left" }],
  }), content);
  equal(insert.events.filter((event) => (
    event.type === "damage_proposed" && event.ruleId === "dual_blades_insert_blade_rule"
  )).length, 1, "BB2 triggers once during a multi-hit ally action and cannot retrigger itself");
  equal(insert.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade")?.stacks, 2,
  "BB2 spends one setup for its single extra hit");

  const insertKilledTarget = simulateBattle(battle({
    allies: [
      allyInput("a_user", "weapon_test_reserver", "weapon_test_utility", "rear_center", {
        reactiveSkillIds: ["dual_blades_insert_blade"],
      }),
      allyInput("a_friend", "warden", "dual_blades_three_cut", "front_left"),
    ],
    enemies: [{ instanceId: "e_target", enemyActorId: "weapon_test_weak", position: "front_left" }],
  }), content);
  equal(insertKilledTarget.events.filter((event) => event.ruleId === "dual_blades_insert_blade_rule").length, 0,
    "BB2 does not spend RP or setup when the ally's hit defeats the target");
  equal(insertKilledTarget.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade")?.stacks, 3,
  "BB2 preserves setup when the target is no longer alive");

  const guests = simulateBattle(battle({
    characterId: "weapon_test_reserver",
    activeSkillId: "dual_blades_many_guests",
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(guests.events.filter((event) => (
    event.type === "damage_proposed" && event.skillId === "dual_blades_many_guests"
  )).length, 5, "BB3 uses two base hits plus the three setup stacks at 80 percent");
  equal(guests.events.filter((event) => (
    event.type === "status_added" && event.targetActorIds[0] === "e_left"
      && event.values.statusId === "bleeding"
  )).at(-1)?.values.stacks, 5, "BB3 applies one bleed stack after every hit on the primary target");
  equal(guests.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade"), undefined,
  "BB3 consumes the setup before resolving its hits");

  const guestsFallback = simulateBattle(battle({
    activeSkillId: "dual_blades_many_guests",
    enemies: [{ instanceId: "e_target", enemyActorId: "weapon_test_dummy", position: "front_left" }],
  }), content);
  equal(guestsFallback.events.filter((event) => (
    event.type === "damage_proposed" && event.skillId === "dual_blades_many_guests"
  )).length, 2, "BB3 falls back to two 50-percent hits when setup is empty");

  const fullSetupContent = structuredClone(content);
  fullSetupContent.characters.weapon_test_reserver.signatureRules[0].effects[0].stacks = 8;
  const guestsFull = simulateBattle(battle({
    characterId: "weapon_test_reserver",
    activeSkillId: "dual_blades_many_guests",
    reactiveSkillIds: ["dual_blades_insert_blade"],
    passiveSkillIds: ["dual_blades_more_hands", "dual_blades_edge_pass"],
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), fullSetupContent);
  const fullHits = guestsFull.events.filter((event) => (
    event.type === "damage_proposed" && event.skillId === "dual_blades_many_guests"
  ));
  equal(fullHits.length, 9, "BB3 caps setup consumption at six and AA1 adds its ninth hit");
  assert.deepEqual(fullHits.map((event) => event.targetActorIds[0]),
    ["e_left", "e_right", "e_left", "e_right", "e_left", "e_right", "e_left", "e_right", "e_left"],
    "AB1 balances all BB3 hits, including AA1's extra hit");
  checks += 1;
  equal(guestsFull.events.filter((event) => event.ruleId === "dual_blades_insert_blade_rule").length, 0,
    "BB3's spent setup cannot pay for BB2 during that same action");
  equal(guestsFull.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade"), undefined,
  "BB3 consumes no more than the shared status maximum");
}

console.log(`weapon-system.test.mjs: ${checks} checks passed`);
