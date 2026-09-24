// Enemy skills use a disjoint id space so an enemy reference cannot resolve
// through the player skill registry by accident.
const ACTION_PREFIX = "foe_action_";
const REACTIVE_PREFIX = "foe_reaction_";
const PASSIVE_PREFIX = "foe_passive_";

function namespacedId(prefix, id) {
  return typeof id === "string" && id.startsWith(prefix) ? id : prefix + id;
}

function sourceId(prefix, id) {
  return typeof id === "string" && id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

export const enemyActionIdFor = (id) => namespacedId(ACTION_PREFIX, id);
export const sourceActionIdFor = (id) => sourceId(ACTION_PREFIX, id);
export const enemyReactiveIdFor = (id) => namespacedId(REACTIVE_PREFIX, id);
export const sourceReactiveIdFor = (id) => sourceId(REACTIVE_PREFIX, id);
export const enemyPassiveIdFor = (id) => namespacedId(PASSIVE_PREFIX, id);
export const sourcePassiveIdFor = (id) => sourceId(PASSIVE_PREFIX, id);
