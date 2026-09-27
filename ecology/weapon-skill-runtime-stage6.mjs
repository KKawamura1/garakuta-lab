// Stage 6a — exact executable set: Stage 5's starter twenty plus the first
// warhammer A2/A3 pair. Unmigrated catalog entries stay fail-closed.

import { STAGE_6_IMPLEMENTED_WEAPON_SKILL_NODE_KEYS, makeWeaponSkillRuntimeRegistry } from "./weapon-skill-runtime.mjs";
import { STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-stage5.mjs";
import { STAGE_6A_WARHAMMER_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-warhammer.mjs";

const definitions = {};
for (const registry of [
  STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  STAGE_6A_WARHAMMER_SKILL_RUNTIME_REGISTRY,
]) {
  for (const entry of Object.values(registry.entries)) {
    if (Object.hasOwn(definitions, entry.nodeKey)) {
      throw new Error(`Stage 6 runtime node is registered twice: ${entry.nodeKey}`);
    }
    definitions[entry.nodeKey] = entry.definition;
  }
}

const actualKeys = Object.keys(definitions).sort();
const expectedKeys = [...STAGE_6_IMPLEMENTED_WEAPON_SKILL_NODE_KEYS].sort();
if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
  throw new Error("Stage 6 runtime registry must cover exactly its implemented node allowlist.");
}

export const STAGE_6_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry(definitions);
