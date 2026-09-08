// Issue #175 — red-team cases for the chain-safety audit.
//
// These definitions are deliberately schema-valid but ill-formed: they can create
// or distribute AP without a finite payment and must be rejected by the
// chain-safety audit. The expectations below are red until that enforcement exists.

import assert from "node:assert/strict";
import { validateContentBundle } from "../ecology/validate.mjs";
import { PLAYABLE_CONTENT } from "../ecology/content/index.mjs";
import {
  auditResourceDefinitions,
  auditResourceTrace,
} from "./ecology-chain-safety-audit.mjs";

const SELF_TARGET = { scope: "self", take: 1 };
const FRONT_ALLY_TARGET = {
  scope: "allies",
  filters: [{ type: "alive" }],
  sort: ["position_asc"],
  take: 1,
};

function makeFreeReactiveSkill(baseId, id, listenTo, target, amount, scope) {
  const skill = structuredClone(PLAYABLE_CONTENT.reactiveSkills[baseId]);
  assert.ok(skill, "patient_step is available as the valid rule template");
  skill.id = id;
  skill.displayName = "ill-formed " + id;
  skill.tags = [...(skill.tags ?? []), "audit-blind-spot"];
  skill.rule = {
    ...skill.rule,
    id: id + "_rule",
    listenTo,
    costs: [],
    effects: [{
      type: "gain_resource",
      target,
      resource: "action_points",
      amount: { type: "constant", value: amount },
    }],
    limit: { owner: "actor-instance + rule", scope, count: 99 },
  };
  return skill;
}

const candidateBundle = structuredClone(PLAYABLE_CONTENT);
const skillCases = [
  {
    id: "free_action_relay",
    kind: "reactive",
    reason: "action_resolved -> ally AP with no cost",
    definition: makeFreeReactiveSkill(
      "patient_step",
      "free_action_relay",
      "action_resolved",
      FRONT_ALLY_TARGET,
      1,
      "round",
    ),
  },
  {
    id: "free_preparation_ap",
    kind: "reactive",
    reason: "preparation_advanced -> self AP with no cost",
    definition: makeFreeReactiveSkill(
      "patient_step",
      "free_preparation_ap",
      "preparation_advanced",
      SELF_TARGET,
      1,
      "round",
    ),
  },
  {
    id: "free_defeat_ap",
    kind: "reactive",
    reason: "actor_defeated without enemy guard or one-shot bound -> self AP",
    definition: makeFreeReactiveSkill(
      "patient_step",
      "free_defeat_ap",
      "actor_defeated",
      SELF_TARGET,
      1,
      "battle",
    ),
  },
  {
    id: "active_overgrant",
    kind: "active",
    reason: "1 AP action -> 99 AP to an ally",
    definition: (() => {
      const skill = structuredClone(PLAYABLE_CONTENT.activeSkills.strike);
      skill.id = "active_overgrant";
      skill.displayName = "ill-formed active_overgrant";
      skill.apCost = 1;
      skill.tags = [...(skill.tags ?? []), "audit-blind-spot"];
      skill.effects = [{
        type: "gain_resource",
        target: FRONT_ALLY_TARGET,
        resource: "action_points",
        amount: { type: "constant", value: 99 },
      }];
      return skill;
    })(),
  },
];

for (const item of skillCases) {
  if (item.kind === "reactive") {
    candidateBundle.reactiveSkills[item.id] = item.definition;
  } else {
    candidateBundle.activeSkills[item.id] = item.definition;
  }
}

const schemaErrors = validateContentBundle(candidateBundle);
assert.deepEqual(
  schemaErrors,
  [],
  "the malformed skill definitions are accepted by the content schema",
);

let checks = 1;
for (const item of skillCases) {
  const activeSkills = item.kind === "active"
    ? [{
      path: "activeSkills." + item.id,
      definition: item.definition,
    }]
    : [];
  const rules = item.kind === "reactive"
    ? [{
      path: "reactiveSkills." + item.id + ".rule",
      rule: item.definition.rule,
    }]
    : [];
  const audit = auditResourceDefinitions(activeSkills, rules);
  assert.ok(
    audit.violations.length > 0,
    item.id + " must be rejected by the resource audit: " + item.reason,
  );
  checks += 1;
}

const unbackedCrossActorTrace = [{
  id: "unbacked_cross_actor_gain",
  type: "resource_gained",
  chainId: "issue-175-blind-spot",
  round: 1,
  sequence: 1,
  sourceActorId: "source",
  targetActorIds: ["ally"],
  values: {
    resource: "action_points",
    amount: 1,
    before: 0,
    after: 1,
  },
}];
const traceAudit = auditResourceTrace(unbackedCrossActorTrace);
assert.ok(
  traceAudit.violations.length > 0,
  "an unbacked cross-actor resource gain must be rejected",
);
assert.equal(traceAudit.creationEvents, 1, "the unbacked gain reaches the creation branch");
checks += 2;


const allowedResourceCases = [
  {
    id: "foundation_ap",
    path: "passiveSkills.foundation_ap.rule",
    rule: PLAYABLE_CONTENT.passiveSkills.foundation_ap.rule,
    reason: "round_started + battle/1 one-shot",
  },
  {
    id: "foundation_rp",
    path: "passiveSkills.foundation_rp.rule",
    rule: PLAYABLE_CONTENT.passiveSkills.foundation_rp.rule,
    reason: "round_started + battle/1 one-shot",
  },
  {
    id: "first_order",
    path: "passiveSkills.first_order.rule",
    rule: PLAYABLE_CONTENT.passiveSkills.first_order.rule,
    reason: "round_started + battle/1 + round 1 + front ally",
  },
  {
    id: "scavenge_ap",
    path: "reactiveSkills.scavenge_ap.rule",
    rule: PLAYABLE_CONTENT.reactiveSkills.scavenge_ap.rule,
    reason: "enemy actor_defeated + round/1",
  },
  {
    id: "worn_greaves",
    path: "equipment.worn_greaves.rules[0]",
    rule: PLAYABLE_CONTENT.equipment.worn_greaves.rules[0],
    reason: "actor_activated + round/1",
  },
  {
    id: "patient_step",
    path: "reactiveSkills.patient_step.rule",
    rule: PLAYABLE_CONTENT.reactiveSkills.patient_step.rule,
    reason: "finite reaction-point cost",
  },
  {
    id: "rescue_sachet",
    path: "equipment.rescue_sachet.rules[0]",
    rule: PLAYABLE_CONTENT.equipment.rescue_sachet.rules[0],
    reason: "finite wear-equipment cost",
  },
];

for (const item of allowedResourceCases) {
  assert.ok(item.rule, item.id + " is present in playable content");
  const audit = auditResourceDefinitions([], [{
    path: item.path,
    rule: item.rule,
  }]);
  assert.deepEqual(
    audit.violations,
    [],
    item.id + " is an allowed resource reward: " + item.reason,
  );
  checks += 1;
}

console.log("chain-safety blind spots: PASS (" + checks + " checks: " + skillCases.length + " rejected, " + allowedResourceCases.length + " allowed)");
for (const item of skillCases) {
  console.log("  " + item.id + ": " + item.reason);
}
console.log("  unbacked_cross_actor_gain: rejected without a spend parent");
console.log("  allowed resource rewards:");
for (const item of allowedResourceCases) {
  console.log("    " + item.id + ": " + item.reason);
}
