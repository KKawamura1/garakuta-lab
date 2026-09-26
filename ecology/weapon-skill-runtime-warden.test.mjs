import assert from "node:assert/strict";
import { CORE_BATTLE } from "./fixtures.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import {
  compileWeaponSkillRuntimeContent,
  WEAPON_SKILL_RUNTIME_CONTENT_VERSION,
  weaponSkillRuntimeId,
} from "./weapon-skill-runtime.mjs";
import {
  WARDEN_STARTER_WEAPON_SKILL_NODE_KEYS,
  WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-warden.mjs";

const registry = WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY;
assert.deepEqual(Object.keys(registry.entries), WARDEN_STARTER_WEAPON_SKILL_NODE_KEYS);
assert.equal(registry.entries["warhammer:R"].definition.displayName, "槌打ち");
assert.equal(registry.entries["warhammer:A1"].definition.displayName, "重い頭");
assert.equal(registry.entries["gauntlets:R"].definition.displayName, "正拳");
assert.equal(registry.entries["gauntlets:A1"].definition.displayName, "握り込み");
assert.equal(registry.entries["gauntlets:A1"].definition.rules.length, 7,
  "the later-hit passive has one once-per-chain rule for each legal follow-up hit");

const projected = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
assert.equal(projected.contentVersion, FIXTURE_CONTENT.contentVersion + "+" + WEAPON_SKILL_RUNTIME_CONTENT_VERSION);
assert.deepEqual(validateContentBundle(projected), [],
  "starter definitions materialize as valid active and passive engine content");

const WARHAMMER_R = weaponSkillRuntimeId("warhammer:R");
const WARHAMMER_A1 = weaponSkillRuntimeId("warhammer:A1");
const GAUNTLETS_R = weaponSkillRuntimeId("gauntlets:R");
const GAUNTLETS_A1 = weaponSkillRuntimeId("gauntlets:A1");

const ENEMY_TARGET = {
  scope: "enemies",
  filters: [{ type: "alive" }],
  sort: ["position_asc"],
  take: 1,
};
const EVENT_TARGET = {
  scope: "event_targets",
  filters: [{ type: "alive" }],
  take: 1,
};
const THREE_HIT_PROBE = {
  id: "stage5b_three_hit_probe",
  displayName: "three-hit probe",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: ENEMY_TARGET,
  effects: [{
    type: "deal_damage",
    target: EVENT_TARGET,
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 9_000 },
    hitCount: 3,
    reach: "melee",
    tags: ["attack", "weapon"],
  }],
  tags: ["attack", "weapon"],
};

function runSkill(activeSkillId, passiveSkillIds = [], extraActiveSkill = null) {
  const baseContent = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
  const activeSkills = { ...baseContent.activeSkills };
  if (extraActiveSkill) activeSkills[extraActiveSkill.id] = extraActiveSkill;
  const content = {
    ...baseContent,
    activeSkills: Object.freeze(activeSkills),
    enemyActors: Object.freeze({
      ...baseContent.enemyActors,
      husk: { ...baseContent.enemyActors.husk, maxHp: 500 },
    }),
  };
  assert.deepEqual(validateContentBundle(content), []);

  const battle = structuredClone(CORE_BATTLE);
  battle.battleId = "stage5b_" + activeSkillId.replaceAll(".", "_");
  battle.maxRounds = 1;
  battle.objective = { type: "survive_rounds", rounds: 1 };
  battle.allies = [{
    ...CORE_BATTLE.allies[0],
    instanceId: "a_stage5b",
    tactics: [{ activeSkillId, useWhen: [] }],
    reactiveSkillIds: [],
    passiveSkillIds,
    equipment: [],
    stats: { might: 100 },
  }];
  battle.enemies = [{
    ...CORE_BATTLE.enemies[0],
    instanceId: "e_stage5b",
  }];
  return simulateBattle(battle, content);
}

function attackProposals(result, activeSkillId) {
  return result.events.filter((event) =>
    event.type === "damage_proposed" && event.skillId === activeSkillId);
}

function passiveModifications(result, passiveSkillId) {
  return result.events.filter((event) =>
    event.type === "pending_amount_modified" && event.sourceDefinitionId === passiveSkillId);
}

const unboostedHammer = runSkill(WARHAMMER_R);
const boostedHammer = runSkill(WARHAMMER_R, [WARHAMMER_A1]);
const hammerProposal = attackProposals(boostedHammer, WARHAMMER_R);
assert.equal(attackProposals(unboostedHammer, WARHAMMER_R).length, 1);
assert.equal(hammerProposal.length, 1);
assert.equal(hammerProposal[0].values.hitIndex, 1);
const hammerBonus = passiveModifications(boostedHammer, WARHAMMER_A1);
assert.equal(hammerBonus.length, 1, "warhammer A1 fires on the first hit");
assert.equal(hammerBonus[0].values.before, hammerProposal[0].values.amount);
assert.equal(hammerBonus[0].values.after,
  hammerBonus[0].values.before + Math.floor(hammerBonus[0].values.before * 15 / 100));

const singleHitGauntlets = runSkill(GAUNTLETS_R, [GAUNTLETS_A1]);
assert.equal(attackProposals(singleHitGauntlets, GAUNTLETS_R).length, 1);
assert.equal(passiveModifications(singleHitGauntlets, GAUNTLETS_A1).length, 0,
  "gauntlets A1 leaves the first hit unchanged");

const unboostedSequence = runSkill(THREE_HIT_PROBE.id, [], THREE_HIT_PROBE);
const boostedSequence = runSkill(THREE_HIT_PROBE.id, [GAUNTLETS_A1], THREE_HIT_PROBE);
const baseHits = attackProposals(unboostedSequence, THREE_HIT_PROBE.id);
const boostedHits = attackProposals(boostedSequence, THREE_HIT_PROBE.id);
assert.deepEqual(baseHits.map((event) => event.values.hitIndex), [1, 2, 3]);
assert.deepEqual(boostedHits.map((event) => event.values.hitIndex), [1, 2, 3]);
const gauntletBonuses = passiveModifications(boostedSequence, GAUNTLETS_A1);
assert.equal(gauntletBonuses.length, 2, "each later hit gets its own bonus");
const hitByProposalId = new Map(boostedHits.map((event) => [event.id, event.values.hitIndex]));
assert.deepEqual(gauntletBonuses.map((event) => hitByProposalId.get(event.values.proposalEventId)), [2, 3]);
const baseAmountByHit = new Map(baseHits.map((event) => [event.values.hitIndex, event.values.amount]));
for (const bonus of gauntletBonuses) {
  assert.equal(bonus.values.after, bonus.values.before + Math.floor(bonus.values.before * 10 / 100));
  assert.equal(bonus.values.before, baseAmountByHit.get(hitByProposalId.get(bonus.values.proposalEventId)));
}

console.log("weapon runtime warden starters: active damage and per-hit passive events match the catalog");
