// Enemy combat references live in their own registries. Shared behavior is
// copied into namespaced entries while the player registry is being migrated;
// only definitions used by current enemies and their core actions are copied.
import { ACTIVE_SKILLS, CORE_ACTIONS } from "./skills-active.mjs";
import { REACTIVE_SKILLS } from "./skills-reactive.mjs";
import { PASSIVE_SKILLS } from "./skills-passive.mjs";
import { ENEMY_ACTORS as SOURCE_ENEMY_ACTORS } from "./enemies.mjs";
import { bpsForLegacyAmount, cloneActive, scaleDefinitionAmounts } from "./base.mjs";
import {
  enemyActionIdFor,
  enemyPassiveIdFor,
  enemyReactiveIdFor,
  sourceActionIdFor,
  sourcePassiveIdFor,
  sourceReactiveIdFor,
} from "./enemy-skill-ids.mjs";

const LOWEST_HP_TARGET = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }],
  sort: ["hp_asc"],
  take: 1,
});
const LOWEST_HP_REAR_TARGET = Object.freeze({
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "row_is", row: "rear" }],
  sort: ["hp_asc"],
  take: 1,
});

function setDamageReach(skill, reach) {
  for (const effect of [
    ...(skill.effects ?? []),
    ...(skill.preparation?.completionEffects ?? []),
  ]) {
    if (effect.type === "deal_damage") effect.reach = reach;
  }
  return skill;
}

function legacyEnemySkill(sourceId) {
  if (sourceId === "front_strike") {
    return setDamageReach(scaleDefinitionAmounts(
      cloneActive("strike", enemyActionIdFor(sourceId), "前列打ち", {
        targetQuery: { ...LOWEST_HP_TARGET },
      }),
      { stat: "might", bps: 10_000 },
    ), "melee");
  }
  if (sourceId === "rear_strike") {
    return setDamageReach(scaleDefinitionAmounts(
      cloneActive("strike", enemyActionIdFor(sourceId), "後列打ち", {
        targetQuery: { ...LOWEST_HP_REAR_TARGET },
      }),
      { stat: "focus", bps: 10_000 },
    ), "ranged");
  }
  if (sourceId === "enemy_heavy") {
    return setDamageReach(scaleDefinitionAmounts(
      cloneActive("heavy_swing", enemyActionIdFor(sourceId), "重い一撃", {
        targetQuery: { ...LOWEST_HP_TARGET },
        preparation: {
          steps: 1,
          completionEffects: [{
            type: "deal_damage",
            target: { ...LOWEST_HP_TARGET },
            amount: { type: "constant", value: 8 },
            tags: ["attack", "heavy"],
          }],
        },
      }),
      { stat: "might", bps: bpsForLegacyAmount(14) },
    ), "melee");
  }
  if (sourceId === "enemy_guard") {
    return scaleDefinitionAmounts(
      cloneActive("bulwark", enemyActionIdFor(sourceId), "盾を構える", {
        effects: [{
          type: "gain_barrier",
          target: { scope: "self", take: 1 },
          amount: { type: "constant", value: 4 },
          duration: "round",
        }],
      }),
      { stat: "focus", bps: bpsForLegacyAmount(4) },
    );
  }
  return null;
}

function rekeyDefinition(source, id, rulePrefix) {
  const definition = structuredClone(source);
  definition.id = id;
  if (definition.rule?.id) definition.rule.id = `${rulePrefix}_${definition.rule.id}`;
  return definition;
}

export const ENEMY_ACTORS = Object.freeze(Object.fromEntries(
  Object.entries(SOURCE_ENEMY_ACTORS).map(([id, source]) => {
    const actor = {
      ...structuredClone(source),
      tactics: (source.tactics ?? []).map((tactic) => ({
        ...tactic,
        activeSkillId: enemyActionIdFor(sourceActionIdFor(tactic.activeSkillId)),
      })),
      reactiveSkillIds: (source.reactiveSkillIds ?? [])
        .map((skillId) => enemyReactiveIdFor(sourceReactiveIdFor(skillId))),
    };
    if (source.passiveSkillIds !== undefined) {
      actor.passiveSkillIds = source.passiveSkillIds
        .map((skillId) => enemyPassiveIdFor(sourcePassiveIdFor(skillId)));
    }
    return [id, actor];
  }),
));

const usedActionIds = new Set(Object.values(ENEMY_ACTORS).flatMap((actor) => [
  ...(actor.tactics ?? []).map((tactic) => sourceActionIdFor(tactic.activeSkillId)),
]));
const usedReactiveIds = new Set(Object.values(ENEMY_ACTORS).flatMap((actor) =>
  (actor.reactiveSkillIds ?? []).map(sourceReactiveIdFor)));
const usedPassiveIds = new Set(Object.values(ENEMY_ACTORS).flatMap((actor) =>
  (actor.passiveSkillIds ?? []).map(sourcePassiveIdFor)));
export const ENEMY_CORE_ACTIONS = Object.freeze(Object.fromEntries(
  Object.entries(CORE_ACTIONS).map(([key, byReach]) => [key, Object.freeze({
    melee: enemyActionIdFor(byReach.melee),
  })]),
));
for (const byReach of Object.values(ENEMY_CORE_ACTIONS)) {
  for (const id of Object.values(byReach)) usedActionIds.add(sourceActionIdFor(id));
}

const enemyActiveSkills = {};
const ENEMY_ONLY_ACTION_MODES = Object.freeze({
  front_strike: "offense",
  rear_strike: "offense",
  enemy_heavy: "channel",
  enemy_guard: "utility",
});
for (const sourceId of [...usedActionIds].sort()) {
  const definition = legacyEnemySkill(sourceId) ?? ACTIVE_SKILLS[sourceId];
  if (!definition) throw new Error(`enemy skill registry: unknown active skill ${sourceId}`);
  if (ENEMY_ONLY_ACTION_MODES[sourceId]) definition.actionMode = ENEMY_ONLY_ACTION_MODES[sourceId];
  enemyActiveSkills[enemyActionIdFor(sourceId)] = rekeyDefinition(
    definition,
    enemyActionIdFor(sourceId),
    "foe_action_rule",
  );
}

const enemyReactiveSkills = {};
for (const sourceId of [...usedReactiveIds].sort()) {
  const definition = REACTIVE_SKILLS[sourceId];
  if (!definition) throw new Error(`enemy skill registry: unknown reactive skill ${sourceId}`);
  enemyReactiveSkills[enemyReactiveIdFor(sourceId)] = rekeyDefinition(
    definition,
    enemyReactiveIdFor(sourceId),
    "foe_reaction_rule",
  );
}

const enemyPassiveSkills = {};
for (const sourceId of [...usedPassiveIds].sort()) {
  const definition = PASSIVE_SKILLS[sourceId];
  if (!definition) throw new Error(`enemy skill registry: unknown passive skill ${sourceId}`);
  enemyPassiveSkills[enemyPassiveIdFor(sourceId)] = rekeyDefinition(
    definition,
    enemyPassiveIdFor(sourceId),
    "foe_passive_rule",
  );
}

export const ENEMY_ACTIVE_SKILLS = Object.freeze(enemyActiveSkills);
export const ENEMY_REACTIVE_SKILLS = Object.freeze(enemyReactiveSkills);
export const ENEMY_PASSIVE_SKILLS = Object.freeze(enemyPassiveSkills);
export const ENEMY_ACTIVE_SKILL_NAMES = Object.freeze(Object.fromEntries(
  Object.entries(ENEMY_ACTIVE_SKILLS).map(([id, definition]) => [id, definition.displayName]),
));
export const ENEMY_REACTIVE_SKILL_NAMES = Object.freeze(Object.fromEntries(
  Object.entries(ENEMY_REACTIVE_SKILLS).map(([id, definition]) => [id, definition.displayName]),
));
export const ENEMY_PASSIVE_SKILL_NAMES = Object.freeze(Object.fromEntries(
  Object.entries(ENEMY_PASSIVE_SKILLS).map(([id, definition]) => [id, definition.displayName]),
));
