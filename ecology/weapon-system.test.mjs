import assert from "node:assert/strict";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import { BATTLE_SCHEMA_VERSION } from "./schema.mjs";
import {
  IMPLEMENTED_WEAPON_IDS,
  PLAYABLE_CONTENT,
  WARHAMMER_TREE,
  WEAPONS,
  WEAPON_IDS_BY_CHARACTER,
  WEAPON_SKILL_TREE_NODES,
} from "./content/index.mjs";
import {
  manifestWeaponIds,
  newProfile,
  newRun,
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
equal(IMPLEMENTED_WEAPON_IDS.length, 2, "only content-backed weapon trees are exposed to the UI for now");
ok(IMPLEMENTED_WEAPON_IDS.includes("warhammer") && IMPLEMENTED_WEAPON_IDS.includes("dual_blades"),
  "the two implemented weapon trees remain UI-visible");

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
assert.deepEqual(validateContentBundle(content), []);
checks += 1;

function battle({
  characterId = "warden",
  position = "front_center",
  activeSkillId = "warhammer_blow",
  reactiveSkillIds = [],
  targetSkillIds = [],
  passiveSkillIds = [],
  enemies = [{ instanceId: "e_dummy", enemyActorId: "weapon_test_dummy", position: "front_left" }],
}) {
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "weapon_system_test",
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [{
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
  const warhammerNodes = WEAPON_SKILL_TREE_NODES.filter((node) => node.weaponId === "warhammer");
  equal(warhammerNodes.length, 19, "acquisition registry exposes all warhammer nodes");
  ok(warhammerNodes.every((node) => node.cost === 1),
    "weapon entry and each following node use the level-free 1 SP cost");
  ok(warhammerNodes.every((node) => (
    node.requires.every((required) => required.minLv === 1)
  )), "weapon prerequisites require acquisition only, never legacy skill levels");

  let run = newRun(newProfile(), { campaignStageSequence: 0, runSeed: "weapon-tree-test" });
  run = {
    ...run,
    runSkillPoints: { ...run.runSkillPoints, warden: 4 },
  };
  equal(manifestWeaponIds(run.manifest)[0], "warhammer", "campaign manifest exposes warhammer at start");
  equal(manifestWeaponIds({})[0], "warhammer", "manifest-2 saves migrate to the implemented weapon");
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
  equal(dualNodes.length, 7, "dual blades exposes the complete A to AA movement slice");
  equal(dualNodes[0].position, "R", "dual blades acquisition starts at its own root");

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

console.log(`weapon-system.test.mjs: ${checks} checks passed`);
