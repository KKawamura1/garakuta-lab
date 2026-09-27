import { ID_PATTERN } from "./schema.mjs";
import { WEAPON_SKILL_NODES } from "./weapon-loadout.mjs";
import { availableWeaponSkillNodeKeys } from "./weapon-pack-manifest.mjs";

export const WEAPON_SKILL_RUNTIME_REGISTRY_SCHEMA_VERSION = "ecology-weapon-skill-runtime-1";

const RUNTIME_ID_BY_NODE_KEY = Object.freeze(Object.fromEntries(
  Object.entries(WEAPON_SKILL_NODES).map(([nodeKey, node]) => [
    nodeKey,
    `weapon.${node.weaponId}.${node.position.toLowerCase()}`,
  ]),
));
const NODE_KEY_BY_RUNTIME_ID = Object.freeze(Object.fromEntries(
  Object.entries(RUNTIME_ID_BY_NODE_KEY).map(([nodeKey, runtimeId]) => [runtimeId, nodeKey]),
));
const FORBIDDEN_LEVEL_FIELDS = new Set([
  "level",
  "levels",
  "levelCap",
  "levelCaps",
  "skillLevel",
  "skillLevels",
  "statBonusPerLevel",
]);

if (Object.keys(NODE_KEY_BY_RUNTIME_ID).length !== Object.keys(WEAPON_SKILL_NODES).length
  || Object.values(RUNTIME_ID_BY_NODE_KEY).some((runtimeId) => !ID_PATTERN.test(runtimeId))) {
  throw new Error("weapon skill runtime ID mapping is invalid or not unique.");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function hasExecutablePayload(definition) {
  return (Array.isArray(definition.effects) && definition.effects.length > 0)
    || (isRecord(definition.rule)
      && Array.isArray(definition.rule.effects)
      && definition.rule.effects.length > 0)
    || (Array.isArray(definition.rules) && definition.rules.length > 0)
    || (isRecord(definition.statBonus) && Object.keys(definition.statBonus).length > 0)
    || (isRecord(definition.targetQuery) && Object.keys(definition.targetQuery).length > 0)
    || (isRecord(definition.query) && Object.keys(definition.query).length > 0);
}

export function weaponSkillRuntimeId(nodeKey) {
  const runtimeId = Object.hasOwn(RUNTIME_ID_BY_NODE_KEY, nodeKey) ? RUNTIME_ID_BY_NODE_KEY[nodeKey] : null;
  if (!runtimeId) throw new RangeError(`unknown weapon skill node: ${String(nodeKey)}`);
  return runtimeId;
}

export function weaponSkillNodeKeyFromRuntimeId(runtimeId) {
  if (typeof runtimeId !== "string") return null;
  return Object.hasOwn(NODE_KEY_BY_RUNTIME_ID, runtimeId) ? NODE_KEY_BY_RUNTIME_ID[runtimeId] : null;
}

export function makeWeaponSkillRuntimeRegistry(definitions = {}) {
  if (!isRecord(definitions)) {
    throw new TypeError("weapon skill runtime definitions must be an object keyed by node key.");
  }

  const entries = {};
  for (const [nodeKey, definition] of Object.entries(definitions)) {
    const node = Object.hasOwn(WEAPON_SKILL_NODES, nodeKey) ? WEAPON_SKILL_NODES[nodeKey] : null;
    if (!node) throw new TypeError(`unknown weapon skill node: ${nodeKey}`);
    if (!isRecord(definition)) {
      throw new TypeError(`runtime definition for ${nodeKey} must be an object.`);
    }
    entries[nodeKey] = Object.freeze({
      nodeKey,
      runtimeSkillId: weaponSkillRuntimeId(nodeKey),
      kind: node.kind,
      definition: Object.freeze({ ...definition }),
    });
  }

  const registry = Object.freeze({
    schemaVersion: WEAPON_SKILL_RUNTIME_REGISTRY_SCHEMA_VERSION,
    entries: Object.freeze(entries),
  });
  const validation = validateWeaponSkillRuntimeRegistry(registry);
  if (!validation.valid) {
    throw new TypeError(validation.errors.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  }
  return registry;
}

export function validateWeaponSkillRuntimeRegistry(registry) {
  const errors = [];
  if (!isRecord(registry)) {
    addError(errors, "invalid_runtime_registry", "$", "runtime registry must be an object.");
    return { valid: false, errors };
  }
  if (registry.schemaVersion !== WEAPON_SKILL_RUNTIME_REGISTRY_SCHEMA_VERSION) {
    addError(errors, "unsupported_version", "schemaVersion", "unsupported runtime registry version.");
  }
  for (const field of Object.keys(registry)) {
    if (field !== "schemaVersion" && field !== "entries") {
      addError(errors, "unknown_registry_field", field, "unknown runtime registry field.");
    }
  }
  if (!isRecord(registry.entries)) {
    addError(errors, "invalid_runtime_entries", "entries", "entries must be an object keyed by node key.");
    return { valid: false, errors };
  }

  const claimedRuntimeIds = new Set();
  for (const [nodeKey, entry] of Object.entries(registry.entries)) {
    const path = `entries.${nodeKey}`;
    const node = Object.hasOwn(WEAPON_SKILL_NODES, nodeKey) ? WEAPON_SKILL_NODES[nodeKey] : null;
    if (!node) {
      addError(errors, "unknown_runtime_node", path, "node key is not in the weapon catalog.");
      continue;
    }
    if (!isRecord(entry)) {
      addError(errors, "invalid_runtime_entry", path, "runtime entry must be an object.");
      continue;
    }
    for (const field of Object.keys(entry)) {
      if (!["nodeKey", "runtimeSkillId", "kind", "definition"].includes(field)) {
        addError(errors, "unknown_runtime_entry_field", `${path}.${field}`, "unknown runtime entry field.");
      }
    }
    const expectedRuntimeId = weaponSkillRuntimeId(nodeKey);
    if (entry.nodeKey !== nodeKey) {
      addError(errors, "runtime_node_key_mismatch", `${path}.nodeKey`, "entry node key must match its registry key.");
    }
    if (entry.runtimeSkillId !== expectedRuntimeId) {
      addError(errors, "runtime_id_mismatch", `${path}.runtimeSkillId`, "runtime skill ID must be derived from the catalog node key.");
    }
    if (claimedRuntimeIds.has(entry.runtimeSkillId)) {
      addError(errors, "duplicate_runtime_id", `${path}.runtimeSkillId`, "runtime skill ID is already registered.");
    } else {
      claimedRuntimeIds.add(entry.runtimeSkillId);
    }
    if (entry.kind !== node.kind) {
      addError(errors, "runtime_kind_mismatch", `${path}.kind`, "runtime kind must match the catalog.");
    }
    if (!isRecord(entry.definition)) {
      addError(errors, "invalid_runtime_definition", `${path}.definition`, "definition must be an object.");
      continue;
    }
    if (entry.definition.id !== expectedRuntimeId) {
      addError(errors, "runtime_definition_id_mismatch", `${path}.definition.id`, "definition ID must match its runtime node ID.");
    }
    if (entry.definition.displayName !== node.displayName) {
      addError(errors, "runtime_definition_name_mismatch", `${path}.definition.displayName`, "definition name must match the weapon catalog.");
    }
    for (const field of FORBIDDEN_LEVEL_FIELDS) {
      if (Object.hasOwn(entry.definition, field)) {
        addError(errors, "skill_level_field_forbidden", `${path}.definition.${field}`, "weapon skills do not have per-skill levels.");
      }
    }
    if (!hasExecutablePayload(entry.definition)) {
      addError(errors, "missing_executable_payload", `${path}.definition`, "catalog metadata alone cannot make a node executable.");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function availableExecutableWeaponSkillNodeKeys(manifest, registry) {
  const validation = validateWeaponSkillRuntimeRegistry(registry);
  if (!validation.valid) {
    throw new TypeError(validation.errors.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  }
  const availableFromManifest = availableWeaponSkillNodeKeys(manifest);
  return availableFromManifest.filter((nodeKey) => Object.hasOwn(registry.entries, nodeKey));
}

export const WEAPON_SKILL_RUNTIME_CONTENT_VERSION = "weapon-skill-runtime-content-1";

const RUNTIME_CONTENT_SECTION_BY_KIND = Object.freeze({
  active: "activeSkills",
  reactive: "reactiveSkills",
  passive: "passiveSkills",
});

// Stage 5 adapter: materialize registered definitions through the existing
// battle engine's player content sections. Target-priority nodes stay outside
// this adapter until the new BattleInput builder owns their selection semantics.
export function compileWeaponSkillRuntimeContent(contentBundle, registry) {
  const validation = validateWeaponSkillRuntimeRegistry(registry);
  if (!validation.valid) {
    throw new TypeError(validation.errors.map(({ path, message }) => path + ": " + message).join("\n"));
  }
  if (!isRecord(contentBundle) || typeof contentBundle.contentVersion !== "string") {
    throw new TypeError("content bundle must have a contentVersion.");
  }

  const next = { ...contentBundle };
  const projectedSections = {};
  for (const [nodeKey, entry] of Object.entries(registry.entries)) {
    const section = RUNTIME_CONTENT_SECTION_BY_KIND[entry.kind];
    if (!section) {
      throw new TypeError("runtime node kind cannot be projected to engine content yet: " + entry.kind);
    }
    if (!isRecord(contentBundle[section])) {
      throw new TypeError("content bundle section is missing: " + section);
    }
    projectedSections[section] ??= { ...contentBundle[section] };
    if (Object.hasOwn(projectedSections[section], entry.runtimeSkillId)) {
      throw new TypeError("runtime skill ID already exists in " + section + ": " + entry.runtimeSkillId);
    }
    projectedSections[section][entry.runtimeSkillId] = entry.definition;
    if (entry.nodeKey !== nodeKey) {
      throw new TypeError("runtime registry key mismatch: " + nodeKey);
    }
  }

  for (const [section, definitions] of Object.entries(projectedSections)) {
    next[section] = Object.freeze(definitions);
  }
  next.contentVersion = contentBundle.contentVersion + "+" + WEAPON_SKILL_RUNTIME_CONTENT_VERSION;
  return Object.freeze(next);
}

export const EMPTY_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry();
