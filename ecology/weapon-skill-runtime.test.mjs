import assert from "node:assert/strict";
import { WEAPON_SKILL_NODES } from "./weapon-loadout.mjs";
import {
  EQUIPMENT_PACKS,
  WEAPON_SKILL_PACKS,
  availableWeaponSkillNodeKeys,
  freshWeaponPackProfile,
  makeWeaponPackManifest,
} from "./weapon-pack-manifest.mjs";
import {
  EMPTY_WEAPON_SKILL_RUNTIME_REGISTRY,
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

function executableFixture(nodeKey) {
  const node = WEAPON_SKILL_NODES[nodeKey];
  const id = weaponSkillRuntimeId(nodeKey);
  const common = { id, displayName: node.displayName };
  if (node.kind === "active") {
    return { ...common, apCost: 1, actionMode: "offense", effects: [{ type: "deal_damage" }] };
  }
  if (node.kind === "reactive") {
    return { ...common, rule: { listenTo: "damage_taken", timing: "after", effects: [{ type: "heal" }] } };
  }
  if (node.kind === "passive") {
    return { ...common, rule: { listenTo: "round_started", timing: "after", effects: [{ type: "add_status" }] } };
  }
  return { ...common, query: { scope: "enemies", take: 1 } };
}

const implementedNodeKeys = manifestNodeKeys.slice(0, -1);
const definitions = Object.fromEntries(implementedNodeKeys.map((nodeKey) => [
  nodeKey,
  executableFixture(nodeKey),
]));
const registry = makeWeaponSkillRuntimeRegistry(definitions);
assert.equal(validateWeaponSkillRuntimeRegistry(registry).valid, true);
assert.deepEqual(availableExecutableWeaponSkillNodeKeys(manifest, registry), implementedNodeKeys,
  "only catalog nodes with registered runtime definitions are available for acquisition");
assert.equal(availableExecutableWeaponSkillNodeKeys(manifest, EMPTY_WEAPON_SKILL_RUNTIME_REGISTRY).length, 0,
  "catalog entries without runtime definitions are not exposed as executable");

const unavailablePackNode = "gauntlets:R";
const withUnselectedPack = makeWeaponSkillRuntimeRegistry({
  ...definitions,
  [unavailablePackNode]: executableFixture(unavailablePackNode),
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

assert.equal(WEAPON_SKILL_PACKS.length, 10);
assert.ok(EQUIPMENT_PACKS.length > 0);

console.log("weapon skill runtime: stable engine IDs and executable-node manifest gating");
