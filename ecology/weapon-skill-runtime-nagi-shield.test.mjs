import assert from "node:assert/strict";
import { CORE_BATTLE } from "./fixtures.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import {
  compileWeaponSkillRuntimeContent,
  makeWeaponSkillRuntimeRegistry,
  weaponSkillRuntimeId,
} from "./weapon-skill-runtime.mjs";
import {
  WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-warden.mjs";
import {
  TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-tsugumi.mjs";
import {
  NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-nagi-spear.mjs";
import {
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_NODE_KEYS,
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-nagi-shield.mjs";

const definitions = [
  ...Object.values(WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  ...Object.values(NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
].map((entry) => [entry.nodeKey, entry.definition]);
const registry = makeWeaponSkillRuntimeRegistry(Object.fromEntries(definitions));
assert.equal(Object.keys(registry.entries).length, 11);
assert.deepEqual(
  Object.keys(NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY.entries),
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_NODE_KEYS,
);
assert.equal(registry.entries["tower_shield:A1"].definition.displayName, "厚板");

const SHIELD_A1 = weaponSkillRuntimeId("tower_shield:A1");
const BARRIER_PROBE = {
  id: "stage5d_barrier_receiver_probe",
  displayName: "ally barrier probe",
  apCost: 1,
  actionMode: "utility",
  intrinsicPredicates: [],
  targetQuery: {
    scope: "allies",
    filters: [{ type: "alive" }],
    sort: ["hp_percent_asc", "position_asc"],
    take: 1,
  },
  effects: [{
    type: "gain_barrier",
    target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
    amount: { type: "constant", value: 20 },
    duration: "round",
  }],
  tags: ["support"],
};

const contentBundle = compileWeaponSkillRuntimeContent(FIXTURE_CONTENT, registry);
const content = {
  ...contentBundle,
  activeSkills: Object.freeze({
    ...contentBundle.activeSkills,
    [BARRIER_PROBE.id]: BARRIER_PROBE,
  }),
  enemyActors: Object.freeze({
    ...contentBundle.enemyActors,
    husk: { ...contentBundle.enemyActors.husk, maxHp: 500 },
  }),
};
assert.deepEqual(validateContentBundle(content), []);

const input = {
  ...structuredClone(CORE_BATTLE),
  battleId: "stage5d_nagi_tower_shield_a1",
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [
    {
      instanceId: "a_nagi_stage5d_shield",
      characterId: "warden",
      position: "front_right",
      hp: 8,
      tactics: [],
      reactiveSkillIds: [],
      passiveSkillIds: [SHIELD_A1],
      equipment: [],
      stats: { might: 20, focus: 20 },
    },
    {
      instanceId: "a_tsugumi_stage5d_shield",
      characterId: "mender",
      position: "rear_left",
      hp: 14,
      tactics: [{ activeSkillId: BARRIER_PROBE.id, useWhen: [] }],
      reactiveSkillIds: [],
      passiveSkillIds: [],
      equipment: [],
      stats: { might: 20, focus: 20 },
    },
  ],
  enemies: [{
    ...CORE_BATTLE.enemies[0],
    instanceId: "e_stage5d_shield",
    position: "front_center",
  }],
};
const result = simulateBattle(input, content);
const barrierProposal = result.events.find((event) =>
  event.type === "barrier_proposed" && event.skillId === BARRIER_PROBE.id);
assert.ok(barrierProposal, "the ally-targeted barrier enters the shared interrupt window");
assert.deepEqual(barrierProposal.targetActorIds, ["a_nagi_stage5d_shield"]);
assert.equal(barrierProposal.values.amount, 20);

const barrier = result.events.find((event) =>
  event.type === "barrier_gained" && event.skillId === BARRIER_PROBE.id);
assert.ok(barrier, "the barrier is granted after the passive adjustment");
assert.deepEqual(barrier.targetActorIds, ["a_nagi_stage5d_shield"]);
assert.equal(barrier.values.amount, 35,
  "tower shield A1 adds 15 to a barrier received from another ally");

const bonus = result.events.filter((event) =>
  event.type === "pending_amount_modified" && event.sourceDefinitionId === SHIELD_A1);
assert.equal(bonus.length, 1);
assert.equal(bonus[0].values.before, 20);
assert.equal(bonus[0].values.after, 35);

console.log("weapon runtime Nagi tower shield A1: receiver-side barrier bonus passes");
