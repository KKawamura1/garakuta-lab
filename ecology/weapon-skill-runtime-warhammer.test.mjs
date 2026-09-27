import assert from "node:assert/strict";
import { CORE_BATTLE } from "./fixtures.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { STATUSES } from "./content/statuses.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import { resolveTargets } from "./selectors.mjs";
import {
  STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS,
  STAGE_6_IMPLEMENTED_WEAPON_SKILL_NODE_KEYS,
  compileWeaponSkillRuntimeContent,
  availableExecutableWeaponSkillNodeKeys,
  weaponSkillRuntimeId,
} from "./weapon-skill-runtime.mjs";
import { freshWeaponPackProfile, makeWeaponPackManifest } from "./weapon-pack-manifest.mjs";
import { STAGE_6_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-stage6.mjs";

const registry = STAGE_6_WEAPON_SKILL_RUNTIME_REGISTRY;
assert.equal(Object.keys(registry.entries).length, 37);
assert.equal(STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS.length, 20);
assert.equal(STAGE_6_IMPLEMENTED_WEAPON_SKILL_NODE_KEYS.length, 37);
assert.deepEqual(Object.keys(registry.entries).sort(), [...STAGE_6_IMPLEMENTED_WEAPON_SKILL_NODE_KEYS].sort());
assert.deepEqual(validateContentBundle(compileWeaponSkillRuntimeContent({ ...FIXTURE_CONTENT, statuses: STATUSES }, registry)), []);

const WARHAMMER_A2 = weaponSkillRuntimeId("warhammer:A2");
const WARHAMMER_A3 = weaponSkillRuntimeId("warhammer:A3");
const WARHAMMER_AA1 = weaponSkillRuntimeId("warhammer:AA1");
const WARHAMMER_AA2 = weaponSkillRuntimeId("warhammer:AA2");
const WARHAMMER_AB1 = weaponSkillRuntimeId("warhammer:AB1");
const WARHAMMER_AB2 = weaponSkillRuntimeId("warhammer:AB2");
const WARHAMMER_B1 = weaponSkillRuntimeId("warhammer:B1");
const WARHAMMER_B2 = weaponSkillRuntimeId("warhammer:B2");
const WARHAMMER_B3 = weaponSkillRuntimeId("warhammer:B3");
const WARHAMMER_BA1 = weaponSkillRuntimeId("warhammer:BA1");
const WARHAMMER_BA2 = weaponSkillRuntimeId("warhammer:BA2");
const WARHAMMER_BB1 = weaponSkillRuntimeId("warhammer:BB1");
const WARHAMMER_BB2 = weaponSkillRuntimeId("warhammer:BB2");
const WARHAMMER_BB3 = weaponSkillRuntimeId("warhammer:BB3");
const THREE_HIT_PROBE = "stage6_warhammer_three_hit_probe";
const MULTI_TARGET_PROBE = "stage6_warhammer_multi_target_probe";
const SINGLE_TARGET_PROBE = "stage6_warhammer_single_target_probe";
const ENEMY_STRIKE = "stage6_warhammer_enemy_strike";
const TEST_FORTIFY_START = "stage6_warhammer_test_fortify_start";
const TEST_BOON = "stage6_warhammer_test_boon";

function probeSkill(id, { hitCount = 1, targetPattern } = {}) {
  return {
    id,
    displayName: id,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: {
      scope: "enemies",
      filters: [{ type: "alive" }],
      sort: ["distance_asc"],
      take: 1,
    },
    effects: [{
      type: "deal_damage",
      target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 9_000 },
      hitCount,
      ...(targetPattern ? { targetPattern } : {}),
      reach: "melee",
      tags: ["attack", "weapon"],
    }],
    tags: ["attack", "weapon"],
  };
}

function enemySetupEffects({ block = 0, barrier = 0, statusId = null, stacks = 1 } = {}) {
  const effects = [];
  if (block > 0) effects.push({ type: "gain_block", target: { scope: "self", take: 1 }, amount: { type: "constant", value: block } });
  if (barrier > 0) effects.push({ type: "gain_barrier", target: { scope: "self", take: 1 }, amount: { type: "constant", value: barrier }, duration: "battle" });
  if (statusId) effects.push({ type: "add_status", target: { scope: "self", take: 1 }, statusId, stacks });
  if (effects.length === 0) return [];
  return [{
    id: "stage6_warhammer_test_enemy_round_setup",
    listenTo: "round_started",
    timing: "after",
    predicates: [],
    costs: [],
    effects,
    limit: { scope: "round", count: 1 },
    priority: 20,
  }];
}

function fortifyOnBattleStart(stacks) {
  return {
    id: TEST_FORTIFY_START,
    displayName: "test fortify at battle start",
    tags: ["passive"],
    rule: {
      id: TEST_FORTIFY_START + ".rule",
      listenTo: "battle_started",
      timing: "after",
      predicates: [],
      costs: [],
      effects: [{ type: "add_status", target: { scope: "self", take: 1 }, statusId: "fortified", stacks }],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
      priority: 30,
    },
  };
}

function removeFortificationAtActionStart() {
  return {
    id: "stage6_warhammer_test_remove_fortification",
    displayName: "test remove fortification at action start",
    tags: ["passive"],
    rule: {
      id: "stage6_warhammer_test_remove_fortification.rule",
      listenTo: "action_started",
      timing: "after",
      predicates: [{
        type: "target_exists",
        query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
      }],
      costs: [],
      effects: [{ type: "remove_status", target: { scope: "self", take: 1 }, statusId: "fortified", stacks: "all" }],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
      priority: 65,
    },
  };
}

function contentFor(skillDefinitions = {}, {
  baseReactionPoints,
  baseActionPoints,
  enemySetup = null,
  enemyGuard,
  enemyActiveSkills = {},
  enemyTactics,
  passiveDefinitions = {},
  statuses = STATUSES,
} = {}) {
  const baseContentBundle = { ...FIXTURE_CONTENT, statuses };
  const base = compileWeaponSkillRuntimeContent(baseContentBundle, registry);
  const characters = { ...base.characters };
  if (baseReactionPoints !== undefined || baseActionPoints !== undefined) {
    characters.warden = {
      ...characters.warden,
      ...(baseReactionPoints === undefined ? {} : { baseReactionPoints }),
      ...(baseActionPoints === undefined ? {} : { baseActionPoints }),
    };
  }
  const husk = {
    ...base.enemyActors.husk,
    maxHp: 500,
    ...(enemyGuard === undefined ? {} : { guard: enemyGuard }),
    ...(enemySetup ? { intrinsicRules: enemySetupEffects(enemySetup) } : {}),
    ...(enemyTactics ? { tactics: enemyTactics } : {}),
  };
  const content = {
    ...base,
    characters: Object.freeze(characters),
    activeSkills: Object.freeze({ ...base.activeSkills, ...skillDefinitions }),
    passiveSkills: Object.freeze({ ...base.passiveSkills, ...passiveDefinitions }),
    enemyActiveSkills: Object.freeze({ ...base.enemyActiveSkills, ...enemyActiveSkills }),
    enemyActors: Object.freeze({ ...base.enemyActors, husk }),
  };
  assert.deepEqual(validateContentBundle(content), []);
  return content;
}

function runSkill(activeSkillId, {
  reactiveSkillIds = [],
  passiveSkillIds = [],
  skillDefinitions = {},
  passiveDefinitions = {},
  enemies = [{ instanceId: "e_near", enemyActorId: "husk", position: "front_center" }],
  allies,
  baseReactionPoints,
  baseActionPoints,
  enemySetup,
  enemyGuard,
  enemyActiveSkills = {},
  enemyTactics,
  statuses = STATUSES,
} = {}) {
  const battle = structuredClone(CORE_BATTLE);
  battle.battleId = "stage6_warhammer_" + activeSkillId;
  battle.maxRounds = 1;
  battle.objective = { type: "survive_rounds", rounds: 1 };
  battle.allies = allies ?? [{
    ...CORE_BATTLE.allies[0],
    instanceId: "a_stage6",
    position: "front_center",
    tactics: [{ activeSkillId, useWhen: [] }],
    reactiveSkillIds,
    passiveSkillIds,
    equipment: [],
    stats: { might: 100 },
  }];
  battle.enemies = enemies;
  return simulateBattle(battle, contentFor(skillDefinitions, {
    baseReactionPoints,
    baseActionPoints,
    enemySetup,
    enemyGuard,
    enemyActiveSkills,
    enemyTactics,
    passiveDefinitions,
    statuses,
  }));
}

function proposals(result, skillId) {
  return result.events.filter((event) => event.type === "damage_proposed" && event.skillId === skillId);
}

function resolvedProposalAmounts(result, skillId) {
  return result.events.filter((event) => event.type === "damage_taken" && event.skillId === skillId)
    .map((event) => event.values.proposed);
}

function statusesFor(result, actorId) {
  return result.actors.find((actor) => actor.instanceId === actorId)?.statuses ?? [];
}

const threeHitResult = runSkill(THREE_HIT_PROBE, {
  reactiveSkillIds: [WARHAMMER_A2],
  skillDefinitions: { [THREE_HIT_PROBE]: probeSkill(THREE_HIT_PROBE, { hitCount: 3 }) },
});
const threeHitProposals = proposals(threeHitResult, THREE_HIT_PROBE);
assert.deepEqual(threeHitProposals.map((event) => event.values.actionHitOrdinal), [0, 1, 2]);
assert.equal(threeHitResult.events.filter((event) => event.type === "resource_spent"
  && event.sourceDefinitionId === WARHAMMER_A2 && event.values.resource === "reaction_points").length, 1);
assert.equal(threeHitResult.events.filter((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_A2 && event.values.statusId === "staggered").length, 2);
assert.equal(statusesFor(threeHitResult, "a_stage6").some(({ statusId }) => statusId === "echoing_iron_armed"), false);

const multiTargetResult = runSkill(MULTI_TARGET_PROBE, {
  reactiveSkillIds: [WARHAMMER_A2],
  skillDefinitions: { [MULTI_TARGET_PROBE]: probeSkill(MULTI_TARGET_PROBE, { targetPattern: "row" }) },
  enemies: [
    { instanceId: "e_primary", enemyActorId: "husk", position: "front_center" },
    { instanceId: "e_side", enemyActorId: "husk", position: "front_right" },
  ],
});
assert.deepEqual(proposals(multiTargetResult, MULTI_TARGET_PROBE).map((event) => event.values.actionHitOrdinal), [0, 1]);
assert.deepEqual(multiTargetResult.events.filter((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_A2 && event.values.statusId === "staggered")
  .map((event) => event.targetActorIds[0]), ["e_primary", "e_side"]);

const noRpResult = runSkill(THREE_HIT_PROBE, {
  reactiveSkillIds: [WARHAMMER_A2],
  skillDefinitions: { [THREE_HIT_PROBE]: probeSkill(THREE_HIT_PROBE, { hitCount: 3 }) },
  baseReactionPoints: 0,
});
assert.equal(noRpResult.events.filter((event) => event.type === "resource_spent"
  && event.sourceDefinitionId === WARHAMMER_A2 && event.values.resource === "reaction_points").length, 0);
assert.equal(noRpResult.events.filter((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_A2 && event.values.statusId === "staggered").length, 0);

const bigHammerResult = runSkill(WARHAMMER_A3, {
  enemies: [
    { instanceId: "e_near", enemyActorId: "husk", position: "front_center" },
    { instanceId: "e_far", enemyActorId: "husk", position: "front_right" },
  ],
});
assert.equal(proposals(bigHammerResult, WARHAMMER_A3)[0].targetActorIds[0], "e_near");
assert.equal(proposals(bigHammerResult, WARHAMMER_A3)[0].values.amount, 170);

const firstHitBonus = runSkill(WARHAMMER_A3, { passiveSkillIds: [WARHAMMER_AA1] });
assert.deepEqual(resolvedProposalAmounts(firstHitBonus, WARHAMMER_A3), [204],
  "鉄塊 adds 20% to each target's first hit");
const firstActionHitOnly = runSkill(THREE_HIT_PROBE, {
  passiveSkillIds: [WARHAMMER_AA1],
  skillDefinitions: { [THREE_HIT_PROBE]: probeSkill(THREE_HIT_PROBE, { hitCount: 3 }) },
});
assert.deepEqual(resolvedProposalAmounts(firstActionHitOnly, THREE_HIT_PROBE), [108, 90, 90],
  "鉄塊 applies only to the first hit across the full action");

const deeperStagger = runSkill(THREE_HIT_PROBE, {
  reactiveSkillIds: [WARHAMMER_A2],
  passiveSkillIds: [WARHAMMER_AA2],
  skillDefinitions: { [THREE_HIT_PROBE]: probeSkill(THREE_HIT_PROBE, { hitCount: 3 }) },
});
assert.deepEqual(deeperStagger.events.filter((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_A2 && event.values.statusId === "staggered")
  .map((event) => event.values.stacks), [2]);
assert.equal(deeperStagger.events.filter((event) => event.type === "pending_amount_modified"
  && event.sourceDefinitionId === WARHAMMER_AA2).length, 2,
"深い衝撃 adds one requested stack to each of 響く鉄's two status proposals");

const expansion = runSkill(SINGLE_TARGET_PROBE, {
  reactiveSkillIds: [WARHAMMER_AB1],
  passiveSkillIds: [WARHAMMER_AB2],
  skillDefinitions: { [SINGLE_TARGET_PROBE]: probeSkill(SINGLE_TARGET_PROBE) },
  enemies: [
    { instanceId: "e_left", enemyActorId: "husk", position: "front_left" },
    { instanceId: "e_center", enemyActorId: "husk", position: "front_center" },
    { instanceId: "e_right", enemyActorId: "husk", position: "front_right" },
  ],
});
assert.equal(expansion.events.filter((event) => event.type === "resource_spent"
  && event.sourceDefinitionId === WARHAMMER_AB1 && event.values.resource === "reaction_points").length, 1);
assert.deepEqual(resolvedProposalAmounts(expansion, SINGLE_TARGET_PROBE), [103, 40, 40],
  "振り幅 adds both adjacent targets to one ActionPlan and 横薙ぎ boosts all planned recipients");
assert.ok(proposals(expansion, SINGLE_TARGET_PROBE).every((event) => event.values.plannedTargetCount === 3));

const rowAttack = runSkill(weaponSkillRuntimeId("warhammer:AB3"), {
  enemies: [
    { instanceId: "e_center", enemyActorId: "husk", position: "front_center" },
    { instanceId: "e_left", enemyActorId: "husk", position: "front_left" },
    { instanceId: "e_right", enemyActorId: "husk", position: "front_right" },
  ],
});
assert.deepEqual(proposals(rowAttack, weaponSkillRuntimeId("warhammer:AB3")).map((event) => event.values.amount), [160, 160, 160]);

const targetQuery = registry.entries["warhammer:B1"].definition.query;
const targetOwner = { instanceId: "a_owner", side: "ally", position: "front_center" };
const targetActors = [
  targetOwner,
  { instanceId: "e_barrier", side: "enemy", alive: true, position: "front_center", block: 0, barriers: [{ amount: 20 }], statuses: [] },
  { instanceId: "e_low_block", side: "enemy", alive: true, position: "front_left", block: 1, barriers: [], statuses: [] },
  { instanceId: "e_high_block", side: "enemy", alive: true, position: "front_right", block: 3, barriers: [{ amount: 10 }], statuses: [] },
  { instanceId: "e_none", side: "enemy", alive: true, position: "front_center", block: 0, barriers: [], statuses: [] },
];
const targetState = {
  actors: new Map(targetActors.map((actor) => [actor.instanceId, actor])),
  actorOrder: targetActors.map((actor) => actor.instanceId),
  chain: { lastResolvedTargets: [] },
};
assert.deepEqual(resolveTargets(targetState, { owner: targetOwner, event: null }, { ...targetQuery, take: "all" })
  .map((actor) => actor.instanceId), ["e_high_block", "e_low_block", "e_barrier", "e_none"],
"鎧を指す prioritizes guard, then barrier, then block count and distance");

const counterEnemyAttack = {
  id: ENEMY_STRIKE,
  displayName: "test enemy strike",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "row_is", row: "rear" }],
    sort: ["position_asc"],
    take: 1,
  },
  effects: [{
    type: "deal_damage",
    target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
    amount: { type: "constant", value: 40 },
    reach: "unrestricted",
    tags: ["attack"],
  }],
  tags: ["attack"],
};
const counterBattle = runSkill("strike", {
  reactiveSkillIds: [WARHAMMER_B2],
  allies: [
    {
      ...CORE_BATTLE.allies[0], instanceId: "a_counter", position: "front_left",
      tactics: [{ activeSkillId: "strike", useWhen: [] }],
      reactiveSkillIds: [WARHAMMER_B2], passiveSkillIds: [], equipment: [], stats: { might: 100 },
    },
    {
      ...CORE_BATTLE.allies[1], instanceId: "a_other", characterId: "mender", position: "rear_right",
      tactics: [{ activeSkillId: "strike", useWhen: [] }], reactiveSkillIds: [], passiveSkillIds: [], equipment: [],
    },
  ],
  skillDefinitions: { strike: probeSkill("strike") },
  enemyActiveSkills: { [ENEMY_STRIKE]: counterEnemyAttack },
  enemyTactics: [{ activeSkillId: ENEMY_STRIKE, useWhen: [] }],
  enemies: [{ instanceId: "e_attacker", enemyActorId: "husk", position: "front_center" }],
  baseReactionPoints: 1,
});
assert.equal(counterBattle.events.filter((event) => event.type === "resource_spent"
  && event.sourceDefinitionId === WARHAMMER_B2 && event.values.resource === "reaction_points").length, 1);
assert.equal(counterBattle.events.find((event) => event.type === "damage_proposed"
  && event.sourceDefinitionId === WARHAMMER_B2 && event.tags.includes("counter")).values.amount, 70);
assert.ok(counterBattle.events.some((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_B2 && event.targetActorIds[0] === "e_attacker"
  && event.values.statusId === "staggered"));

const defenseStrip = runSkill(WARHAMMER_B3, {
  reactiveSkillIds: [WARHAMMER_BA1],
  enemies: [{ instanceId: "e_defended", enemyActorId: "husk", position: "front_center" }],
  enemySetup: { block: 2, barrier: 50 },
  enemyGuard: 5,
});
assert.ok(defenseStrip.events.some((event) => event.type === "defense_reduced"
  && event.values.cause === "effect" && event.values.blockRemoved === 2 && event.values.barrierRemoved === 50));
assert.ok(defenseStrip.events.some((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_BA1 && event.values.statusId === "armor_broken"
  && event.values.stacks === 2));
assert.equal(proposals(defenseStrip, WARHAMMER_B3)[0].values.amount, 130);
assert.equal(defenseStrip.events.find((event) => event.type === "damage_taken"
  && event.skillId === WARHAMMER_B3).values.afterGuard, 127,
"砕けた鎧 reduces effective guard by two before the same action's damage");
assert.ok(statusesFor(defenseStrip, "e_defended").some(({ statusId, stacks }) => statusId === "armor_broken" && stacks === 1),
"armor break loses half its stacks at round end");

const fortifiedGuard = runSkill(WARHAMMER_A3, {
  enemies: [{ instanceId: "e_fortified_guard", enemyActorId: "husk", position: "front_center" }],
  enemySetup: { statusId: "fortified", stacks: 3 },
  enemyGuard: 5,
});
const fortifiedGuardHit = fortifiedGuard.events.find((event) => event.type === "damage_taken"
  && event.skillId === WARHAMMER_A3);
assert.equal(fortifiedGuardHit?.values.afterGuard, 159,
  "堅牢 adds two guard per stack: 170 damage minus (5 base guard + 3×2)");

const disassemble = runSkill(weaponSkillRuntimeId("warhammer:BA3"), {
  passiveSkillIds: [WARHAMMER_BB1],
  enemies: [{ instanceId: "e_fortified", enemyActorId: "husk", position: "front_center" }],
  enemySetup: { block: 2, statusId: "fortified", stacks: 3 },
  enemyGuard: 5,
});
assert.ok(disassemble.events.some((event) => event.type === "status_removed"
  && event.targetActorIds[0] === "e_fortified" && event.values.statusId === "fortified" && event.values.removed === 3),
"解体槌 strips 堅牢 after defense removal");
assert.equal(disassemble.events.find((event) => event.type === "damage_taken"
  && event.skillId === weaponSkillRuntimeId("warhammer:BA3")).values.afterGuard, 165,
"堅牢 has been removed before 解体槌's damage resolves");
assert.deepEqual(disassemble.events.filter((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_BB1 && event.values.statusId === "fortified")
  .map((event) => event.values.added), [4, 6],
"戦利の破片 converts both removed enemy fortification and guard stacks into 堅牢");

const blockReward = runSkill(WARHAMMER_A3, {
  passiveSkillIds: [WARHAMMER_BB1],
  enemySetup: { block: 1 },
});
assert.equal(blockReward.events.filter((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_BB1 && event.values.statusId === "fortified"
  && event.values.added === 2).length, 1,
"戦利の破片 also converts an enemy block stack spent by a normal hit");

const blockBreak = runSkill(THREE_HIT_PROBE, {
  reactiveSkillIds: [WARHAMMER_BA2],
  skillDefinitions: { [THREE_HIT_PROBE]: probeSkill(THREE_HIT_PROBE, { hitCount: 2 }) },
  enemies: [{ instanceId: "e_blocked", enemyActorId: "husk", position: "front_center" }],
  enemySetup: { block: 3 },
});
assert.equal(blockBreak.events.filter((event) => event.type === "damage_blocked" && event.targetActorIds[0] === "e_blocked").length, 1);
assert.ok(blockBreak.events.some((event) => event.type === "defense_reduced"
  && event.values.cause === "effect" && event.values.blockRemoved === 2),
"砕け音 removes the remaining guard without reopening its own break response");
assert.ok(blockBreak.events.some((event) => event.type === "damage_taken"
  && event.skillId === THREE_HIT_PROBE && event.targetActorIds[0] === "e_blocked"));

const testStatuses = {
  ...STATUSES,
  [TEST_BOON]: {
    id: TEST_BOON, displayName: "test boon", polarity: "positive", maxStacks: 3,
    duration: "battle", rules: [], tags: ["playable", "buff"],
  },
};
const bb3 = runSkill(WARHAMMER_BB3, {
  passiveSkillIds: [WARHAMMER_BB1],
  enemies: [{ instanceId: "e_booned", enemyActorId: "husk", position: "front_center" }],
  enemySetup: { block: 2, statusId: TEST_BOON, stacks: 2 },
  statuses: testStatuses,
});
assert.ok(bb3.events.some((event) => event.type === "status_removed"
  && event.values.statusId === TEST_BOON && event.values.removed === 2 && event.tags.includes("buff")));
assert.deepEqual(bb3.events.filter((event) => event.type === "status_added"
  && event.sourceDefinitionId === WARHAMMER_BB1 && event.values.statusId === "fortified")
  .map((event) => event.values.stacks), [4, 8],
"戦利の破片 gains two fortification stacks per enemy buff or guard stack removed");
assert.equal(proposals(bb3, WARHAMMER_BB3)[0].values.amount, 180);
assert.ok(statusesFor(bb3, "e_booned").every(({ statusId }) => statusId !== TEST_BOON));
assert.ok(statusesFor(bb3, "a_stage6").some(({ statusId, stacks }) => statusId === "fortified" && stacks === 4));

const reverseForge = runSkill(WARHAMMER_A3, {
  passiveSkillIds: [WARHAMMER_BB2, TEST_FORTIFY_START],
  passiveDefinitions: { [TEST_FORTIFY_START]: fortifyOnBattleStart(2) },
});
assert.equal(reverseForge.events.find((event) => event.type === "action_started"
  && event.sourceActorId === "a_stage6").values.startingStatusStacks.fortified, 2);
assert.equal(proposals(reverseForge, WARHAMMER_A3)[0].values.startingStatusStacks.fortified, 2);
assert.deepEqual(resolvedProposalAmounts(reverseForge, WARHAMMER_A3), [221],
"逆鍛造 adds 15% per starting fortification stack to every attack hit");
assert.equal(statusesFor(reverseForge, "a_stage6").some(({ statusId }) => statusId === "fortified"), false,
"逆鍛造 consumes all fortification after the attack");

const reverseForgeSnapshot = runSkill(WARHAMMER_A3, {
  passiveSkillIds: [WARHAMMER_BB2, TEST_FORTIFY_START, "stage6_warhammer_test_remove_fortification"],
  passiveDefinitions: {
    [TEST_FORTIFY_START]: fortifyOnBattleStart(2),
    stage6_warhammer_test_remove_fortification: removeFortificationAtActionStart(),
  },
});
assert.ok(reverseForgeSnapshot.events.some((event) => event.type === "status_removed"
  && event.values.statusId === "fortified" && event.values.removed === 2
  && event.sourceDefinitionId === "stage6_warhammer_test_remove_fortification"));
assert.deepEqual(resolvedProposalAmounts(reverseForgeSnapshot, WARHAMMER_A3), [221],
"逆鍛造 uses the immutable 堅牢 count captured at action start");

const allWeaponSkills = makeWeaponPackManifest("stage6-warhammer-runtime-gate", {
  ...freshWeaponPackProfile({ unlockedSkillPackIds: ["skill:warhammer"], unlockedEquipmentPackIds: [] }),
}, { skillPackCount: 1, equipmentPackCount: 0 });
assert.equal(availableExecutableWeaponSkillNodeKeys(allWeaponSkills, registry).length, 19,
  "the entire warhammer tree, and only its 19 nodes, is executable with its pack");
assert.ok(availableExecutableWeaponSkillNodeKeys(allWeaponSkills, registry).includes("warhammer:B1"));

console.log("Stage 6 warhammer: all 17 remaining nodes, shared guard/status events, target priority, battle effects pass");
