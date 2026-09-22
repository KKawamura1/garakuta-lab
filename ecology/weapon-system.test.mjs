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
equal(WARHAMMER_TREE.length, 19, "warhammer has the complete 19-node shape");
assert.deepEqual(
  Object.fromEntries(Object.keys(sections).map((kind) => [
    kind, WARHAMMER_TREE.filter((node) => node.kind === kind).length,
  ])),
  { active: 7, reactive: 2, target: 1, passive: 9 },
);
checks += 1;
for (const node of WARHAMMER_TREE) {
  const definition = PLAYABLE_CONTENT[sections[node.kind]][node.skillId];
  ok(definition, `${node.position} points to a real ${node.kind} skill`);
  ok(definition.displayEffect?.length > 0, `${node.position} has player-facing effect text`);
  ok(definition.flavorText?.length > 0, `${node.position} has flavor text`);
  if (node.position.endsWith("3") && node.position.length === 3) {
    ok(definition.flavorText.includes("\n"), `${node.position} terminal flavor uses two lines`);
  }
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

for (const [weaponId, tree, expectedCounts] of [
  ["gauntlets", GAUNTLETS_TREE, { active: 7, reactive: 3, target: 1, passive: 8 }],
  ["launcher", LAUNCHER_TREE, { active: 7, reactive: 2, target: 2, passive: 8 }],
  ["tower_shield", TOWER_SHIELD_TREE, { active: 7, reactive: 3, target: 0, passive: 9 }],
  ["long_spear", LONG_SPEAR_TREE, { active: 7, reactive: 2, target: 1, passive: 9 }],
  ["medical_kit", MEDICAL_KIT_TREE, { active: 7, reactive: 3, target: 0, passive: 9 }],
  ["grappling_hook", GRAPPLING_HOOK_TREE, { active: 7, reactive: 2, target: 1, passive: 9 }],
  ["banner", BANNER_TREE, { active: 7, reactive: 5, target: 1, passive: 6 }],
  ["heavy_crossbow", HEAVY_CROSSBOW_TREE, { active: 7, reactive: 2, target: 1, passive: 9 }],
]) {
  equal(tree.length, 19, `${weaponId} has the complete 19-node shape`);
  assert.deepEqual(
    Object.fromEntries(Object.keys(sections).map((kind) => [
      kind, tree.filter((node) => node.kind === kind).length,
    ])),
    expectedCounts,
    `${weaponId} keeps its active/reactive/target/passive contract`,
  );
  checks += 1;
  for (const node of tree) {
    const definition = PLAYABLE_CONTENT[sections[node.kind]][node.skillId];
    ok(definition, `${node.position} points to a real ${weaponId} ${node.kind} skill`);
    ok(definition.displayEffect?.length > 0, `${weaponId} ${node.position} has effect text`);
    ok(definition.flavorText?.length > 0, `${weaponId} ${node.position} has flavor text`);
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
content.enemyActors.weapon_test_heavy = {
  ...content.enemyActors.weapon_test_dummy,
  id: "weapon_test_heavy",
  displayName: "重い試験台",
  baseActionPoints: 1,
  might: 200,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
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
    passiveSkillIds: ["tower_shield_thick_plate", "tower_shield_visible"],
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
    passiveSkillIds: ["long_spear_double_thrust", "long_spear_penetration"],
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
    passiveSkillIds: ["long_spear_foot_stop"],
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
        passiveSkillIds: ["medical_kit_clean_tools"],
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
    passiveSkillIds: ["grappling_hook_movement_marks"],
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
    characterId: "tactician",
    activeSkillId: "borrowed_four_hit",
    reactiveSkillIds: ["warhammer_ringing_iron"],
    passiveSkillIds: ["warhammer_deep_impact"],
  }), content);
  equal(result.events.filter((event) => (
    event.type === "resource_spent" && event.values.resource === "reaction_points"
  )).length, 2, "ringing iron spends RP on the first and fourth hit of another weapon");
  const dummy = result.actors.find((actor) => actor.instanceId === "e_dummy");
  equal(dummy.statuses.find((status) => status.statusId === "staggered")?.stacks, 3,
    "deep impact strengthens the first stagger and the fourth hit reaches stack three");
}

{
  const result = simulateBattle(battle({
    activeSkillId: "warhammer_siege_blow",
    targetSkillIds: ["warhammer_point_at_armor"],
    passiveSkillIds: ["warhammer_broken_armor"],
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
  equal(armored.statuses.find((status) => status.statusId === "armor_broken")?.stacks, 1,
    "breaking a defense applies the generic two-round guard penalty");
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
  equal(proposed.values.amount, 156,
    "kingslayer converts two removed positive status types into +120% might before melee position scaling");
  equal(result.events.filter((event) => (
    event.type === "status_removed" && event.targetActorIds[0] === "e_blessed"
      && event.tags.includes("positive")
  )).length, 2, "kingslayer removes both positive status types");
  const user = result.actors.find((actor) => actor.instanceId === "a_user");
  equal(user.statuses.find((status) => status.statusId === "warhammer_fragment")?.stacks, 2,
    "trophy fragment gains one stack for each removed positive status type");
}

{
  const gauntletsCombo = simulateBattle(battle({
    activeSkillId: "gauntlets_double_punch",
    passiveSkillIds: ["gauntlets_combo_fists"],
  }), content);
  equal(gauntletsCombo.events.filter((event) => (
    event.type === "damage_proposed" && event.sourceActorId === "a_user"
  )).length, 3, "gauntlets adds one follow-up hit after a two-hit action");
  ok(gauntletsCombo.events.some((event) => (
    event.type === "damage_proposed" && event.tags.includes("extra_hit")
  )), "gauntlets follow-up hit is explicitly marked as an extra hit");
}

{
  const gauntletsFootwork = simulateBattle(battle({
    position: "rear_center",
    activeSkillId: "gauntlets_punch",
    passiveSkillIds: ["gauntlets_footwork"],
  }), content);
  ok(gauntletsFootwork.events.some((event) => event.type === "actor_moved"
    && event.tags[0] === "move"),
  "gauntlets footwork advances a rear-row melee action before damage");
  equal(gauntletsFootwork.actors.find((actor) => actor.instanceId === "a_user").position,
    "front_center", "gauntlets footwork keeps the attacker in the front row");
  ok(gauntletsFootwork.events.some((event) => (
    event.type === "pending_amount_modified"
      && event.ruleId === "gauntlets_footwork_momentum_damage_1_rule"
  )), "gauntlets footwork converts the movement into momentum damage");
}

{
  const gauntletsGuard = simulateBattle(battle({
    activeSkillId: "gauntlets_punch",
    reactiveSkillIds: ["gauntlets_strike_guard"],
  }), content);
  ok(gauntletsGuard.events.some((event) => (
    event.type === "barrier_gained" && event.ruleId === "gauntlets_strike_guard_rule"
      && event.values.amount === 20
  )), "gauntlets reactive guard grants its post-attack barrier");
}

{
  const launcherMulti = simulateBattle(battle({
    characterId: "mender",
    activeSkillId: "launcher_shot",
    passiveSkillIds: ["launcher_multi_barrel", "launcher_separate_caliber"],
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
    passiveSkillIds: ["launcher_observation_hole"],
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
  equal(target.effect, "防壁か受け構えを持つ敵を優先。",
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
  assert.deepEqual(
    Object.fromEntries(Object.keys(sections).map((kind) => [
      kind, dualNodes.filter((node) => node.kind === kind).length,
    ])),
    { active: 7, reactive: 2, target: 1, passive: 9 },
  );
  checks += 1;
  for (const node of dualNodes) {
    const definition = PLAYABLE_CONTENT[sections[node.kind]][node.skillId];
    ok(definition, `${node.position} points to a real dual-blades ${node.kind} skill`);
    ok(definition.displayEffect?.length > 0, `${node.position} has player-facing effect text`);
    ok(definition.flavorText?.length > 0, `${node.position} has flavor text`);
  }

  const stranded = simulateBattle(battle({
    position: "rear_center",
    activeSkillId: "dual_blades_two_cut",
    passiveSkillIds: ["dual_blades_dash_in"],
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
    passiveSkillIds: ["dual_blades_retreat"],
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
    enemies: [
      { instanceId: "e_left", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_right", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  assert.deepEqual(
    distributed.events
      .filter((event) => event.type === "damage_proposed" && event.skillId === "dual_blades_dancing_cut")
      .map((event) => event.targetActorIds[0]),
    ["e_left", "e_right", "e_left", "e_right"],
    "dancing cut distributes four hits in fixed tile order",
  );
  checks += 1;

  const wasted = simulateBattle(battle({
    activeSkillId: "dual_blades_three_cut",
    passiveSkillIds: ["dual_blades_no_waste"],
    enemies: [
      { instanceId: "e_weak", enemyActorId: "weapon_test_weak", position: "front_left" },
      { instanceId: "e_next", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(wasted.events.filter((event) => event.tags.includes("overflow_hit")).length, 4,
    "no waste carries both remaining hits through proposal and resolution");
  equal(wasted.events.filter((event) => (
    event.type === "damage_proposed" && event.tags.includes("overflow_hit")
  )).every((event) => event.targetActorIds[0] === "e_next"), true,
  "no waste sends each replacement hit to the next living enemy");

  const wound = simulateBattle(battle({
    activeSkillId: "dual_blades_wound_mark",
    reactiveSkillIds: ["dual_blades_lacerating_edge"],
    enemies: [{ instanceId: "e_wound", enemyActorId: "weapon_test_dummy", position: "front_left" }],
  }), content);
  equal(wound.actors.find((actor) => actor.instanceId === "e_wound")
    .statuses.find((status) => status.statusId === "bleeding")?.stacks, 3,
  "wound mark and the second-hit reaction cap the target at three bleeding");

  const hunted = simulateBattle(battle({
    activeSkillId: "dual_blades_two_cut",
    targetSkillIds: ["dual_blades_blood_scent"],
    passiveSkillIds: ["dual_blades_wound_expansion"],
    enemies: [
      { instanceId: "e_plain", enemyActorId: "weapon_test_dummy", position: "front_left" },
      { instanceId: "e_bleeding", enemyActorId: "weapon_test_bleeding", position: "front_right" },
    ],
  }), content);
  const huntedSelection = hunted.events.find(
    (event) => event.type === "target_selected" && event.skillId === "dual_blades_two_cut",
  );
  equal(huntedSelection.targetActorIds[0], "e_bleeding", "blood scent follows the bleeding legal target");
  equal(hunted.events.filter((event) => event.ruleId === "dual_blades_wound_expansion_rule").length, 1,
    "wound expansion adds its fixed opening damage once per action");

  const spray = simulateBattle(battle({
    activeSkillId: "dual_blades_two_cut",
    passiveSkillIds: ["dual_blades_blood_spray"],
    enemies: [
      { instanceId: "e_weak", enemyActorId: "weapon_test_weak", position: "front_left" },
      { instanceId: "e_next", enemyActorId: "weapon_test_dummy", position: "front_right" },
    ],
  }), content);
  equal(spray.actors.find((actor) => actor.instanceId === "e_next")
    .statuses.find((status) => status.statusId === "bleeding")?.stacks, 1,
  "blood spray passes one wound stack to the surviving enemy in the row");

  const reserved = simulateBattle(battle({
    activeSkillId: "weapon_test_utility",
    passiveSkillIds: ["dual_blades_blade_reservation"],
  }), content);
  equal(reserved.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade")?.stacks, 1,
  "blade reservation records a non-attack main action");

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
  )).length, 3, "many guests uses the held reserve-blade count as hit count");
  equal(guests.actors.find((actor) => actor.instanceId === "a_user")
    .statuses.find((status) => status.statusId === "dual_blades_reserved_blade"), undefined,
  "many guests consumes all reserve blades after resolving its hits");
}

console.log(`weapon-system.test.mjs: ${checks} checks passed`);
