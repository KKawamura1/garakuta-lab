// Stage 5 — the complete executable registry for the initial twenty nodes.
// The catalog remains 190 nodes wide; this allowlist is deliberately only the
// R/A1 starters used by the five playable characters.

import { STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS, makeWeaponSkillRuntimeRegistry } from "./weapon-skill-runtime.mjs";
import { WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-warden.mjs";
import { TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-tsugumi.mjs";
import { NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-nagi-spear.mjs";
import { NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-nagi-shield.mjs";
import { HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-hibana-grappling.mjs";
import { HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-hibana-dual-blades.mjs";
import { GENZO_BANNER_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-genzo-banner.mjs";
import { GENZO_HEAVY_CROSSBOW_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-genzo-heavy-crossbow.mjs";

const sourceRegistries = [
  WARDEN_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  TSUGUMI_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  NAGI_TOWER_SHIELD_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  NAGI_LONG_SPEAR_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  HIBANA_GRAPPLING_HOOK_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  HIBANA_DUAL_BLADES_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  GENZO_BANNER_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
  GENZO_HEAVY_CROSSBOW_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
];

const definitions = {};
for (const registry of sourceRegistries) {
  for (const entry of Object.values(registry.entries)) {
    if (Object.hasOwn(definitions, entry.nodeKey)) {
      throw new Error(`Stage 5 starter runtime node is registered twice: ${entry.nodeKey}`);
    }
    definitions[entry.nodeKey] = entry.definition;
  }
}

const actualKeys = Object.keys(definitions).sort();
const expectedKeys = [...STAGE_5_INITIAL_WEAPON_SKILL_NODE_KEYS].sort();
if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
  throw new Error("Stage 5 starter runtime registry must cover exactly the initial twenty nodes.");
}

export const STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry(definitions);

// Engine character IDs are stable save keys. The Japanese names and the
// Stage 3 prototype IDs are not used to resolve a battle actor.
export const STAGE_5_STARTER_SKILL_KEYS_BY_CHARACTER = Object.freeze({
  warden: Object.freeze(["warhammer:R", "warhammer:A1", "gauntlets:R", "gauntlets:A1"]),
  mender: Object.freeze(["launcher:R", "launcher:A1", "medical_kit:R", "medical_kit:A1"]),
  lancer: Object.freeze(["tower_shield:R", "tower_shield:A1", "long_spear:R", "long_spear:A1"]),
  guardian: Object.freeze(["grappling_hook:R", "grappling_hook:A1", "dual_blades:R", "dual_blades:A1"]),
  tactician: Object.freeze(["banner:R", "banner:A1", "heavy_crossbow:R", "heavy_crossbow:A1"]),
});

export const STAGE_5_DEFAULT_PRIMARY_SKILL_BY_CHARACTER = Object.freeze({
  warden: "warhammer:R",
  mender: "launcher:R",
  lancer: "tower_shield:R",
  guardian: "grappling_hook:R",
  tactician: "banner:R",
});
