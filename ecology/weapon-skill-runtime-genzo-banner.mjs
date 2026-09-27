import { makeWeaponSkillRuntimeRegistry, weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";

const LOWEST_AP_ALLY = {
  scope: "allies",
  filters: [
    { type: "alive" },
    { type: "not_self" },
  ],
  sort: ["action_points_asc", "is_preparing_desc", "position_asc"],
  take: 1,
};
const EVENT_TARGET = {
  scope: "event_targets",
  filters: [{ type: "alive" }],
  take: 1,
};
const SELF = { scope: "self", take: 1 };
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};

function bannerOrder() {
  const id = weaponSkillRuntimeId("banner:R");
  return {
    id,
    displayName: "号令",
    apCost: 1,
    actionMode: "utility",
    intrinsicPredicates: [{
      type: "has_status",
      subject: "self",
      statusId: "banner_order_used",
      op: "eq",
      value: 0,
    }],
    targetQuery: LOWEST_AP_ALLY,
    effects: [
      {
        type: "gain_resource",
        target: EVENT_TARGET,
        resource: "action_points",
        amount: { type: "constant", value: 1 },
        tags: ["banner_main_action"],
      },
      { type: "add_status", target: SELF, statusId: "banner_order_used", stacks: 1 },
    ],
    tags: ["support", "banner"],
  };
}

function focusTransferredAlly() {
  const id = weaponSkillRuntimeId("banner:A1");
  return {
    id,
    displayName: "声を通す",
    tags: ["passive", "weapon"],
    rule: {
      id: `${id}.banner_ap_focus`,
      listenTo: "resource_gained",
      timing: "after",
      priority: 55,
      predicates: [
        SELF_IS_EVENT_SOURCE,
        { type: "event_tag", tag: "action_points", value: true },
        { type: "event_tag", tag: "banner_main_action", value: true },
      ],
      costs: [],
      effects: [{ type: "add_status", target: EVENT_TARGET, statusId: "focused", stacks: 1 }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  };
}

export const GENZO_BANNER_STARTER_WEAPON_SKILL_NODE_KEYS = Object.freeze([
  "banner:R",
  "banner:A1",
]);

export const GENZO_BANNER_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY = makeWeaponSkillRuntimeRegistry({
  "banner:R": bannerOrder(),
  "banner:A1": focusTransferredAlly(),
});
