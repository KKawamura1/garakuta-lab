// Compatibility barrel for callers that still import the staged root path.
// The four trees now live beside the other weapon modules; keeping this barrel
// avoids breaking tooling that imported the R-slice during the migration.

export {
  MEDICAL_KIT_ACTIVE_SKILLS,
  MEDICAL_KIT_PASSIVE_SKILLS,
  MEDICAL_KIT_REACTIVE_SKILLS,
  MEDICAL_KIT_TARGET_SKILLS,
  MEDICAL_KIT_TREE,
} from "./weapon-medical-kit.mjs";
export {
  GRAPPLING_HOOK_ACTIVE_SKILLS,
  GRAPPLING_HOOK_PASSIVE_SKILLS,
  GRAPPLING_HOOK_REACTIVE_SKILLS,
  GRAPPLING_HOOK_TARGET_SKILLS,
  GRAPPLING_HOOK_TREE,
} from "./weapon-grappling-hook.mjs";
export {
  BANNER_ACTIVE_SKILLS,
  BANNER_PASSIVE_SKILLS,
  BANNER_REACTIVE_SKILLS,
  BANNER_TARGET_SKILLS,
  BANNER_TREE,
} from "./weapon-banner.mjs";
export {
  HEAVY_CROSSBOW_ACTIVE_SKILLS,
  HEAVY_CROSSBOW_PASSIVE_SKILLS,
  HEAVY_CROSSBOW_REACTIVE_SKILLS,
  HEAVY_CROSSBOW_TARGET_SKILLS,
  HEAVY_CROSSBOW_TREE,
} from "./weapon-heavy-crossbow.mjs";
