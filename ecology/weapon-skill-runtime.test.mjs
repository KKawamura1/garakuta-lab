import assert from "node:assert/strict";
import { WEAPON_SKILL_NODES } from "./weapon-loadout.mjs";
import {
  availableWeaponSkillNodeKeys,
  freshWeaponPackProfile,
  makeWeaponPackManifest,
} from "./weapon-pack-manifest.mjs";
import {
  EMPTY_WEAPON_SKILL_RUNTIME_REGISTRY,
  STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS,
  WEAPON_SKILL_RUNTIME_REGISTRY_SCHEMA_VERSION,
  availableExecutableWeaponSkillNodeKeys,
  makeWeaponSkillRuntimeRegistry,
  validateWeaponSkillRuntimeRegistry,
  weaponSkillNodeKeyFromRuntimeId,
  weaponSkillRuntimeId,
} from "./weapon-skill-runtime.mjs";

assert.equal(WEAPON_SKILL_RUNTIME_REGISTRY_SCHEMA_VERSION, "ecology-weapon-skill-runtime-1");
assert.equal(validateWeaponSkillRuntimeRegistry(EMPTY_WEAPON_SKILL_RUNTIME_REGISTRY).valid, true);

const allNodeKeys = Object.keys(WEAPON_SKILL_NODES);
const allRuntimeIds = allNodeKeys.map((nodeKey) => weaponSkillRuntimeId(nodeKey));
assert.equal(new Set(allRuntimeIds).size, allNodeKeys.length, "all catalog nodes have a unique runtime skill ID");
for (const nodeKey of allNodeKeys) {
  assert.equal(weaponSkillNodeKeyFromRuntimeId(weaponSkillRuntimeId(nodeKey)), nodeKey,
    `${nodeKey} round-trips through its engine-safe ID`);
}
assert.equal(weaponSkillNodeKeyFromRuntimeId("steady_cut"), null, "legacy skill IDs do not map to weapon nodes");
assert.throws(() => weaponSkillRuntimeId("legacy_skill_id"), /unknown weapon skill node/);
assert.throws(() => weaponSkillRuntimeId("toString"), /unknown weapon skill node/);

const profile = freshWeaponPackProfile({
  unlockedSkillPackIds: ["skill:warhammer"],
  unlockedEquipmentPackIds: [],
});
const manifest = makeWeaponPackManifest("runtime-registry-gate", profile, {
  skillPackCount: 1,
  equipmentPackCount: 0,
});
const manifestNodeKeys = availableWeaponSkillNodeKeys(manifest);
assert.equal(manifestNodeKeys.length, 19);

assert.equal(STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS.length, 20);
assert.equal(new Set(STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS).size, 20);
assert.ok(STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS.every((nodeKey) => Object.hasOwn(WEAPON_SKILL_NODES, nodeKey)));

function executableFixture(nodeKey) {
  const node = WEAPON_SKILL_NODES[nodeKey];
  const id = weaponSkillRuntimeId(nodeKey);
  const common = { id, displayName: node.displayName };
  if (node.kind === "active") {
    const target = {
      scope: "enemies",
      filters: [{ type: "alive" }],
      sort: ["position_asc"],
      take: 1,
    };
    return {
      ...common,
      apCost: 1,
      actionMode: "offense",
      intrinsicPredicates: [],
      targetQuery: target,
      tags: ["attack", "weapon", "playable"],
      effects: [{
        type: "deal_damage",
        target,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 10_000 },
        reach: "melee",
        tags: ["attack", "weapon"],
      }],
    };
  }
  if (node.kind === "reactive") {
    return {
      ...common,
      tags: ["reaction", "playable"],
      rule: {
        id: `${id}.rule`,
        listenTo: "round_started",
        timing: "after",
        predicates: [],
        costs: [],
        effects: [{
          type: "add_status",
          target: { scope: "self", take: 1 },
          statusId: "warded",
          stacks: 1,
        }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
        priority: 100,
      },
    };
  }
  if (node.kind === "passive") {
    return { ...common, tags: ["passive", "playable"], statBonus: { might: 1 } };
  }
  return {
    ...common,
    query: {
      scope: "enemies",
      filters: [{ type: "alive" }],
      sort: ["position_asc"],
      take: 1,
    },
  };
}

const implementedNodeKeys = STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS
  .filter((nodeKey) => manifestNodeKeys.includes(nodeKey));
assert.deepEqual(implementedNodeKeys, ["warhammer:R", "warhammer:A1"]);
const definitions = Object.fromEntries(implementedNodeKeys.map((nodeKey) => [
  nodeKey,
  executableFixture(nodeKey),
]));
const registry = makeWeaponSkillRuntimeRegistry(definitions);
assert.equal(validateWeaponSkillRuntimeRegistry(registry).valid, true);
assert.deepEqual(availableExecutableWeaponSkillNodeKeys(manifest, registry), implementedNodeKeys,
  "only initial-scope catalog nodes with valid runtime definitions and unlocked packs are available for acquisition");
assert.equal(availableExecutableWeaponSkillNodeKeys(manifest, EMPTY_WEAPON_SKILL_RUNTIME_REGISTRY).length, 0,
  "catalog entries without runtime definitions are not exposed as executable");

const nonInitialNodeKey = "warhammer:A2";
assert.ok(!STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS.includes(nonInitialNodeKey));
assert.throws(
  () => makeWeaponSkillRuntimeRegistry({ [nonInitialNodeKey]: executableFixture(nonInitialNodeKey) }),
  /outside the Stage 5 initial node scope/,
  "out-of-scope nodes cannot be registered even when their pack is enabled",
);
const outOfScopeRegistry = {
  ...registry,
  entries: {
    ...registry.entries,
    [nonInitialNodeKey]: {
      nodeKey: nonInitialNodeKey,
      runtimeSkillId: weaponSkillRuntimeId(nonInitialNodeKey),
      kind: WEAPON_SKILL_NODES[nonInitialNodeKey].kind,
      definition: executableFixture(nonInitialNodeKey),
    },
  },
};
assert.ok(validateWeaponSkillRuntimeRegistry(outOfScopeRegistry).errors
  .some((error) => error.code === "runtime_node_outside_initial_scope"));

const medicalProfile = freshWeaponPackProfile({
  unlockedSkillPackIds: ["skill:medical_kit"],
  unlockedEquipmentPackIds: [],
});
const medicalManifest = makeWeaponPackManifest("runtime-registry-medical-reactive", medicalProfile, {
  skillPackCount: 1,
  equipmentPackCount: 0,
});
const medicalA1 = "medical_kit:A1";
const medicalRegistry = makeWeaponSkillRuntimeRegistry({ [medicalA1]: executableFixture(medicalA1) });
assert.deepEqual(availableExecutableWeaponSkillNodeKeys(medicalManifest, medicalRegistry), [medicalA1],
  "reactive A1 definitions are validated against the shared content schema");

const withUnselectedPack = makeWeaponSkillRuntimeRegistry({
  ...definitions,
  "gauntlets:R": executableFixture("gauntlets:R"),
});
assert.deepEqual(availableExecutableWeaponSkillNodeKeys(manifest, withUnselectedPack), implementedNodeKeys,
  "a runtime definition remains unavailable when its skill pack is absent from the manifest");

const firstNodeKey = implementedNodeKeys[0];
const firstEntry = registry.entries[firstNodeKey];
const wrongIdRegistry = {
  ...registry,
  entries: {
    ...registry.entries,
    [firstNodeKey]: {
      ...firstEntry,
      definition: { ...firstEntry.definition, id: "legacy_skill_id" },
    },
  },
};
assert.ok(validateWeaponSkillRuntimeRegistry(wrongIdRegistry).errors
  .some((error) => error.code === "runtime_definition_id_mismatch"));
const unsupportedEffectRegistry = {
  ...registry,
  entries: {
    ...registry.entries,
    [implementedNodeKeys[0]]: {
      ...registry.entries[implementedNodeKeys[0]],
      definition: {
        ...registry.entries[implementedNodeKeys[0]].definition,
        effects: [{ type: "not_an_engine_effect" }],
      },
    },
  },
};
assert.ok(validateWeaponSkillRuntimeRegistry(unsupportedEffectRegistry).errors
  .some((error) => error.code === "invalid_runtime_definition" && error.message.includes("unknown_effect")));
const leveledRegistry = {
  ...registry,
  entries: {
    ...registry.entries,
    [firstNodeKey]: {
      ...firstEntry,
      definition: { ...firstEntry.definition, skillLevel: 1 },
    },
  },
};
assert.ok(validateWeaponSkillRuntimeRegistry(leveledRegistry).errors
  .some((error) => error.code === "skill_level_field_forbidden"));
const metadataOnly = {
  ...registry,
  entries: {
    ...registry.entries,
    [firstNodeKey]: {
      ...firstEntry,
      definition: { id: firstEntry.runtimeSkillId, displayName: WEAPON_SKILL_NODES[firstNodeKey].displayName },
    },
  },
};
assert.ok(validateWeaponSkillRuntimeRegistry(metadataOnly).errors
  .some((error) => error.code === "missing_executable_payload"));
const unknownNodeRegistry = {
  ...registry,
  entries: {
    ...registry.entries,
    "legacy:node": { nodeKey: "legacy:node", runtimeSkillId: "legacy", kind: "active", definition: {} },
  },
};
assert.ok(validateWeaponSkillRuntimeRegistry(unknownNodeRegistry).errors
  .some((error) => error.code === "unknown_runtime_node"));

console.log("weapon skill runtime: stable engine IDs and executable-node manifest gating");
