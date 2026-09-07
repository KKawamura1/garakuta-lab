// Issue #175 — 反応・連鎖を、技能と装備を増やす前に固定する smoke。
//
// battle / chain cap に到達したことを「停止性の証拠」にしない。現行の
// player-facing content を静的に読み、代表的な event trace も調べ、さらに
// 意図的に壊した定義・trace を検出できることをこの一枚で確認する。

import assert from "node:assert/strict";
import {
  CORE_BATTLE,
  AP_LOOP_BATTLE,
  BARRIER_BLOOM_BATTLE,
  DAMAGE_ECHO_BATTLE,
  PREP_SPIRAL_BATTLE,
  TRIAGE_BATTLE,
} from "../ecology/fixtures.mjs";
import { DEFAULT_OPTIONS } from "../ecology/schema.mjs";
import { simulateBattle } from "../ecology/engine.mjs";
import { FIXTURE_CONTENT } from "../ecology/fixture-content.mjs";
import { generateEquipment } from "../ecology/equipment-gen.mjs";
import { composeEncounter } from "../ecology/progression.mjs";
import {
  freshLoadout,
  makeExpeditionBattle,
} from "../ecology/playable-battles.mjs";
import {
  PLAYABLE_CONTENT,
  SKILL_PACKS,
  SKILL_TREE_NODES,
} from "../ecology/content/index.mjs";
assert.ok(PLAYABLE_CONTENT.coreActions, "content core actions are exported");

const FINITE_COSTS = new Set([
  "lose_hp",
  "wear_equipment",
  "consume_barrier",
  "spend_reaction_points",
]);
const RESOURCE_TYPES = new Set(["action_points", "reaction_points"]);
const RESOURCE_EFFECT = "gain_resource";
const HEAL_EFFECT = "heal";
const DAMAGE_EVENT = "damage_taken";
const EXCESS_HEALING_EVENT = "excess_healing";
const TERMINATION_TAG = "termination";
const NOT_COST_DAMAGE = Object.freeze({ type: "event_tag", tag: "cost", value: false });
const LIMIT_OWNER_BASES = new Set(["actor-instance + rule", "party/region + rule"]);

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

function effectsOf(definition) {
  const effects = [];
  walk(definition, (node) => {
    if (typeof node.type === "string" && node.type === RESOURCE_EFFECT) effects.push(node);
    if (typeof node.type === "string" && node.type === HEAL_EFFECT) effects.push(node);
  });
  return effects;
}

function ruleRecordsFrom(section, definitions, include = () => true) {
  const records = [];
  for (const [definitionId, definition] of Object.entries(definitions ?? {})) {
    if (!include(section, definitionId, definition)) continue;
    const rules = section === "equipment" ? definition.rules ?? [] : definition.rule ? [definition.rule] : [];
    for (const rule of rules) {
      records.push({
        section,
        definitionId,
        path: `${section}.${definitionId}.${rule.id ?? "<missing-id>"}`,
        ownerBasis: rule.limit?.owner ?? null,
        rule,
      });
    }
  }
  return records;
}

function activeRecordsFrom(definitions, include = () => true) {
  const records = [];
  for (const [definitionId, definition] of Object.entries(definitions ?? {})) {
    if (!include("activeSkills", definitionId, definition)) continue;
    records.push({
      definitionId,
      path: `activeSkills.${definitionId}`,
      definition,
    });
  }
  return records;
}

function collectReachableSkillIds(bundle) {
  const ids = new Set(SKILL_TREE_NODES.map((node) => node.skillId));

  function collect(value, key = "") {
    if (typeof value === "string") {
      if (key === "skillId" || key.endsWith("SkillId") || key.endsWith("SkillIds")) ids.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item, key);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (key.endsWith("SkillIds") && Array.isArray(value)) {
      for (const item of value) if (typeof item === "string") ids.add(item);
    }
    for (const [childKey, child] of Object.entries(value)) collect(child, childKey);
  }

  collect(SKILL_PACKS, "packs");
  collect(bundle.characters, "characters");
  collect(bundle.enemyActors, "enemyActors");
  return ids;
}

function effectiveDefinitionFilter(bundle) {
  const reachableSkillIds = collectReachableSkillIds(bundle);
  const excluded = [];
  const include = (section, definitionId, definition) => {
    // The termination witnesses are deliberately retained in fixture content.
    // They are audited by the self-check below, but only a witness referenced by
    // a pack/tree/actor is part of the current player-facing contract.
    if (!definition.tags?.includes(TERMINATION_TAG)) return true;
    if (section !== "activeSkills" && section !== "reactiveSkills" && section !== "passiveSkills" && section !== "equipment") {
      return true;
    }
    const reachable = section === "equipment"
      ? false
      : reachableSkillIds.has(definitionId);
    if (!reachable) excluded.push(`${section}.${definitionId}`);
    return reachable;
  };
  return { include, excluded, reachableSkillIds };
}

function collectContent(bundle) {
  const { include, excluded, reachableSkillIds } = effectiveDefinitionFilter(bundle);
  const rules = [
    ...ruleRecordsFrom("activeSkills", bundle.activeSkills, include),
    ...ruleRecordsFrom("reactiveSkills", bundle.reactiveSkills, include),
    ...ruleRecordsFrom("passiveSkills", bundle.passiveSkills, include),
    ...ruleRecordsFrom("equipment", bundle.equipment, include),
    ...ruleRecordsFrom("statuses", bundle.statuses),
    ...ruleRecordsFrom("characters", bundle.characters),
    ...ruleRecordsFrom("enemyActors", bundle.enemyActors),
  ];
  const activeSkills = activeRecordsFrom(bundle.activeSkills, include);
  return { rules, activeSkills, excluded, reachableSkillIds };
}

function isFiniteLimit(limit) {
  return Boolean(limit)
    && LIMIT_OWNER_BASES.has(limit.owner)
    && ["chain", "round", "battle"].includes(limit.scope)
    && Number.isSafeInteger(limit.count)
    && limit.count >= 1;
}

function hasFiniteCost(rule) {
  return (rule.costs ?? []).some((cost) => FINITE_COSTS.has(cost.type));
}

function targetClass(target) {
  if (!target || typeof target !== "object") return "unknown";
  if (target.scope === "self") return "self";
  if (target.scope === "allies") return "ally-transfer";
  if (target.scope === "enemies") return "enemy-target";
  return target.scope ?? "unknown";
}

function resourceFlowKind(target) {
  if (target?.scope === "self") return "creation";
  if (target?.scope === "allies") return "transfer";
  return "other";
}

function auditResourceDefinitions(activeSkills, rules) {
  const violations = [];
  const rows = [];
  const flowCounts = { creation: 0, transfer: 0, other: 0 };
  for (const record of activeSkills) {
    for (const effect of effectsOf(record.definition).filter((item) => item.type === RESOURCE_EFFECT)) {
      const flow = resourceFlowKind(effect.target);
      flowCounts[flow] += 1;
      rows.push({ path: record.path, kind: "active", flow, target: targetClass(effect.target) });
      if (!(Number.isSafeInteger(record.definition.apCost) && record.definition.apCost >= 1)) {
        violations.push(`${record.path}: resource creation must pay at least 1 AP`);
      }
    }
  }
  for (const record of rules) {
    const resourceEffects = effectsOf(record.rule).filter((item) => item.type === RESOURCE_EFFECT);
    for (const effect of resourceEffects) {
      const flow = resourceFlowKind(effect.target);
      flowCounts[flow] += 1;
      rows.push({ path: record.path, kind: "reaction", flow, target: targetClass(effect.target) });
      if (!isFiniteLimit(record.rule.limit)) {
        violations.push(`${record.path}: resource output has no finite chain/round/battle limit`);
      }
      if (record.rule.listenTo === "resource_gained") {
        const safePaidLoop = hasFiniteCost(record.rule)
          && record.rule.limit.scope === "battle"
          && record.rule.limit.count === 1;
        if (!safePaidLoop) {
          violations.push(`${record.path}: resource_gained -> gain_resource needs finite cost + battle/1 limit`);
        }
      }
    }
  }
  return { rows, flowCounts, violations };
}

function auditSelfDamageRules(rules) {
  return rules
    .filter(({ rule }) => rule.listenTo === DAMAGE_EVENT)
    .filter(({ rule }) => !(rule.predicates ?? []).some((predicate) => (
      predicate.type === "event_tag" && predicate.tag === "cost" && predicate.value === false
    )))
    .map(({ path }) => `${path}: damage_taken must exclude tags.cost`);
}

function isEventAmount(effect) {
  return effect.amount?.type === "event_value_scaled" && effect.amount.key === "amount";
}

function auditExcessHealingDefinitions(rules) {
  const violations = [];
  const rows = [];
  for (const record of rules.filter(({ rule }) => rule.listenTo === EXCESS_HEALING_EVENT)) {
    const healing = effectsOf(record.rule).filter((effect) => effect.type === HEAL_EFFECT);
    for (const effect of healing) {
      rows.push(record.path);
      if (!isEventAmount(effect)) {
        violations.push(`${record.path}: excess healing must derive from event.values.amount`);
      }
      if (record.rule.limit?.scope !== "chain" || record.rule.limit?.count !== 1) {
        violations.push(`${record.path}: excess healing reaction must be chain/1`);
      }
    }
  }
  return { rows, violations };
}

function auditLimits(rules) {
  const violations = [];
  const rows = [];
  const scopeCounts = { chain: 0, round: 0, battle: 0 };
  for (const record of rules) {
    rows.push({ path: record.path, owner: record.ownerBasis, scope: record.rule.limit?.scope });
    if (!LIMIT_OWNER_BASES.has(record.ownerBasis)) {
      violations.push(`${record.path}: limit owner basis is missing or unreadable`);
    }
    if (record.rule.limit?.owner !== record.ownerBasis) {
      violations.push(`${record.path}: limit.owner must explicitly declare ${record.ownerBasis ?? "<missing>"}`);
    }
    if (LIMIT_OWNER_BASES.has(record.ownerBasis)
      && scopeCounts[record.rule.limit?.scope] !== undefined) {
      scopeCounts[record.rule.limit.scope] += 1;
    }
    if (!isFiniteLimit(record.rule.limit)) {
      violations.push(`${record.path}: limit must declare owner=${record.ownerBasis}, unit, and finite count`);
    }
  }
  return { rows, scopeCounts, violations };
}

function auditResourceTrace(events) {
  const ordered = [...events].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const byId = new Map(ordered.map((event) => [event.id, event]));
  const violations = [];
  const balances = new Map();
  const transferDeltas = new Map();
  let resourceEvents = 0;
  let transferEvents = 0;
  let creationEvents = 0;

  const actorIdOf = (event) => event.targetActorIds?.length === 1
    ? event.targetActorIds[0]
    : null;
  const balanceKey = (event, resource, actorId) => (
    `${event.round ?? 0}|${resource}|${actorId ?? "~actor"}`
  );
  const transferKey = (event, resource) => (
    `${event.chainId ?? "~chain"}|${event.round ?? 0}|${resource}|${event.sourceActorId ?? "~source"}`
  );

  for (const event of ordered) {
    if (event.type !== "resource_spent" && event.type !== "resource_gained") continue;
    resourceEvents += 1;
    const resource = event.values?.resource;
    const amount = event.values?.amount;
    const before = event.values?.before;
    const after = event.values?.after;
    const targetActorId = actorIdOf(event);
    const validAmount = event.type === "resource_spent"
      ? Number.isFinite(amount) && amount >= 0
      : Number.isFinite(amount) && amount > 0;
    if (!RESOURCE_TYPES.has(resource) || !validAmount) {
      violations.push(`${event.id}: malformed resource event`);
      continue;
    }
    if (!Number.isFinite(after)) {
      violations.push(`${event.id}: resource event must expose after balance`);
    } else if (event.type === "resource_gained" && !Number.isFinite(before)) {
      violations.push(`${event.id}: resource_gained must expose before balance`);
    } else {
      const expectedAfter = event.type === "resource_spent"
        ? (Number.isFinite(before) ? before - amount : after)
        : before + amount;
      if (event.type === "resource_spent" && Number.isFinite(before) && after !== expectedAfter) {
        violations.push(`${event.id}: resource before/after does not match amount`);
      }
      if (event.type === "resource_gained" && after !== expectedAfter) {
        violations.push(`${event.id}: resource before/after does not match amount`);
      }
    }
    if (!targetActorId) {
      violations.push(`${event.id}: resource event must have exactly one target actor`);
    }

    const key = balanceKey(event, resource, targetActorId);
    balances.set(key, (balances.get(key) ?? 0)
      + (event.type === "resource_spent" ? -amount : amount));

    if (event.type === "resource_spent") continue;
    const parent = byId.get(event.parentEventId);
    if (parent?.type === "resource_gained" && parent.chainId === event.chainId) {
      const hasSpendBetween = ordered.some((candidate) => (
        candidate.chainId === event.chainId
        && candidate.type === "resource_spent"
        && candidate.values?.resource === resource
        && candidate.sequence > parent.sequence
        && candidate.sequence < event.sequence
      ));
      if (!hasSpendBetween) {
        violations.push(`${event.id}: resource_gained directly re-created resource without an intervening spend`);
      }
    }

    const sourceActorId = event.sourceActorId ?? null;
    const matchingSpend = ordered
      .filter((candidate) => (
        candidate.chainId === event.chainId
        && candidate.type === "resource_spent"
        && candidate.values?.resource === resource
        && candidate.sourceActorId === sourceActorId
        && candidate.sequence < event.sequence
      ))
      .reduce((total, candidate) => total + (candidate.values?.amount ?? 0), 0);

    const isTransfer = sourceActorId
      && targetActorId
      && sourceActorId !== targetActorId
      && matchingSpend >= amount;
    if (isTransfer) {
      transferEvents += 1;
      const key = transferKey(event, resource);
      transferDeltas.set(key, (transferDeltas.get(key) ?? 0) + amount);
    } else {
      creationEvents += 1;
      if (sourceActorId && targetActorId && sourceActorId !== targetActorId
        && matchingSpend > 0 && matchingSpend < amount) {
        violations.push(`${event.id}: resource transfer exceeds the source spend (${matchingSpend} < ${amount})`);
      }
    }
  }

  for (const [key, amount] of transferDeltas) {
    if (!(amount > 0)) violations.push(`${key}: resource transfer total is not positive`);
  }
  return {
    resourceEvents,
    transferEvents,
    creationEvents,
    actorResourceRoundDeltas: Object.fromEntries(balances),
    violations,
  };
}
function auditRefiring(events) {
  const byId = new Map(events.map((event) => [event.id, event]));
  const groups = new Map();
  for (const event of events) {
    if (!event.ruleId) continue;
    const key = `${event.chainId}|${event.sourceActorId ?? "~region"}|${event.ruleId}`;
    const group = groups.get(key) ?? { triggers: new Set(), events: [] };
    // One firing can emit several events (damage_proposed -> damage_taken).
    // Collapse the contiguous child events that retain the same rule and owner
    // back to the first event whose parent belongs to the trigger, then count
    // those roots rather than counting every emitted event.
    let parent = byId.get(event.parentEventId);
    while (parent && parent.ruleId === event.ruleId && parent.sourceActorId === event.sourceActorId) {
      parent = byId.get(parent.parentEventId);
    }
    // Costs and effects are siblings under the same trigger event. Use that
    // external parent as the firing key, rather than the first output event.
    group.triggers.add(parent?.id ?? `root:${event.id}`);
    group.events.push(event.id);
    groups.set(key, group);
  }
  const violations = [];
  for (const [key, group] of groups) {
    if (group.triggers.size > 1) {
      violations.push(`${key}: same owner/rule re-fired for ${group.triggers.size} trigger events in one chain`);
    }
  }
  return { groups, violations };
}

function auditHealingTrace(events) {
  const byId = new Map(events.map((event) => [event.id, event]));
  const violations = [];
  let applied = 0;
  let excess = 0;
  for (const event of events) {
    if (event.type === "healing_applied") {
      applied += 1;
      const requested = event.values?.requested;
      const actual = event.values?.actual;
      if (!(Number.isFinite(requested) && Number.isFinite(actual) && requested >= 0 && actual >= 0 && actual <= requested)) {
        violations.push(`${event.id}: healing actual must be within [0, requested]`);
      }
      const proposed = byId.get(event.parentEventId);
      if (proposed?.type !== "healing_proposed") {
        violations.push(`${event.id}: healing_applied must retain its healing_proposed parent`);
      }
      // The engine emits excess_healing as a sibling of healing_applied under
      // the original healing_proposed event, so the provenance survives even
      // when a follow-up consumes the overflow.
      const children = events.filter((candidate) => candidate.parentEventId === proposed?.id && candidate.type === EXCESS_HEALING_EVENT);
      const expected = requested - actual;
      if (expected > 0 && (children.length !== 1 || children[0].values?.amount !== expected)) {
        violations.push(`${event.id}: excess healing amount/lineage was not preserved`);
      }
      if (expected === 0 && children.length > 0) {
        violations.push(`${event.id}: zero overflow emitted excess_healing`);
      }
    }
    if (event.type === EXCESS_HEALING_EVENT) {
      excess += 1;
      const parent = byId.get(event.parentEventId);
      if (parent?.type !== "healing_proposed") violations.push(`${event.id}: excess_healing parent is not healing_proposed`);
      const children = events.filter((candidate) => candidate.parentEventId === event.id && candidate.type === "healing_proposed");
      if (children.length > 1) violations.push(`${event.id}: one excess amount was consumed more than once`);
    }
  }
  return { applied, excess, violations };
}

function traceWithDuplicateRuleTrigger(events) {
  const copy = structuredClone(events);
  const ruleEvents = copy.filter((event) => event.ruleId);
  if (ruleEvents.length < 2) return copy;
  const first = ruleEvents[0];
  const second = ruleEvents.find((event) => event.chainId === first.chainId && event.ruleId === first.ruleId && event.id !== first.id);
  if (second) {
    // The AP fixture legitimately fires once for two different owners. Make
    // the second output pretend to belong to the first owner, then give it a
    // different trigger root: that is the malformed trace we want to catch.
    second.sourceActorId = first.sourceActorId;
    second.parentEventId = `deliberately-different-trigger-${second.id}`;
  }
  return copy;
}

function traceWithDuplicateOverflow(events) {
  const copy = structuredClone(events);
  const overflow = copy.find((event) => event.type === EXCESS_HEALING_EVENT);
  if (!overflow) return copy;
  copy.push({
    ...structuredClone(copy.find((event) => event.type === "healing_proposed")),
    id: "deliberate_duplicate_overflow_child",
    sequence: Number.MAX_SAFE_INTEGER,
    parentEventId: overflow.id,
  });
  return copy;
}

function addCostGuard(rule) {
  rule.predicates = [...(rule.predicates ?? []), NOT_COST_DAMAGE];
}

function makeSelfCostBundle(guarded) {
  const bundle = structuredClone(FIXTURE_CONTENT);
  const targetAlly = {
    type: "target_exists",
    query: { scope: "allies", filters: [{ type: "is_event_primary_target" }], take: 1 },
  };
  const sourceRule = {
    id: "audit_cost_source_rule",
    listenTo: DAMAGE_EVENT,
    timing: "after",
    priority: 200,
    predicates: [targetAlly],
    costs: [{ type: "lose_hp", amount: 3 }],
    effects: [{ type: "gain_barrier", target: { scope: "self", take: 1 }, amount: { type: "constant", value: 1 }, duration: "round" }],
    limit: { scope: "chain", count: 1 },
  };
  const followRule = {
    id: "audit_cost_follow_rule",
    listenTo: DAMAGE_EVENT,
    timing: "after",
    priority: 100,
    predicates: [{ type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 } }],
    costs: [],
    effects: [{ type: "heal", target: { scope: "self", take: 1 }, amount: { type: "constant", value: 1 }, tags: ["audit"] }],
    limit: { scope: "chain", count: 1 },
  };
  if (guarded) {
    addCostGuard(sourceRule);
    addCostGuard(followRule);
  }
  bundle.reactiveSkills.audit_cost_source = { id: "audit_cost_source", displayName: "audit cost source", rule: sourceRule, tags: ["audit"] };
  bundle.reactiveSkills.audit_cost_follow = { id: "audit_cost_follow", displayName: "audit cost follow", rule: followRule, tags: ["audit"] };
  return bundle;
}

function makeSelfCostBattle() {
  const battle = structuredClone(CORE_BATTLE);
  battle.battleId = "audit_self_damage_cost";
  const owner = battle.allies.find((actor) => actor.instanceId === "a_mender");
  const target = battle.allies.find((actor) => actor.instanceId === "a_lancer");
  owner.tactics = [{ activeSkillId: "bulwark", useWhen: [] }];
  owner.reactiveSkillIds = ["audit_cost_source", "audit_cost_follow"];
  target.hp = 8;
  target.tactics = [{ activeSkillId: "bulwark", useWhen: [] }];
  target.reactiveSkillIds = [];
  return battle;
}

const current = collectContent(PLAYABLE_CONTENT);
const resourceAudit = auditResourceDefinitions(current.activeSkills, current.rules);
const selfDamageViolations = auditSelfDamageRules(current.rules);
const excessAudit = auditExcessHealingDefinitions(current.rules);
const limitAudit = auditLimits(current.rules);

check(resourceAudit.violations.length === 0, resourceAudit.violations.join("\n"));
check(selfDamageViolations.length === 0, selfDamageViolations.join("\n"));
check(excessAudit.violations.length === 0, excessAudit.violations.join("\n"));
check(limitAudit.violations.length === 0, limitAudit.violations.join("\n"));

// ---- dynamic traces: current fixtures and event lineage ---------------------

const traceCases = [
  ["damage echo", DAMAGE_ECHO_BATTLE],
  ["barrier bloom", BARRIER_BLOOM_BATTLE],
  ["preparation spiral", PREP_SPIRAL_BATTLE],
];
for (const [label, battle] of traceCases) {
  const result = simulateBattle(battle, FIXTURE_CONTENT);
  check(["win", "loss", "draw"].includes(result.result), `${label}: normal result`);
  check(result.metrics.maxChainEventCount < DEFAULT_OPTIONS.maxEventsPerChain, `${label}: below chain cap`);
  check(result.metrics.eventCount < DEFAULT_OPTIONS.maxEventsPerBattle, `${label}: below battle cap`);
  check(auditRefiring(result.events).violations.length === 0, `${label}: same owner/rule re-fired`);
  check(auditResourceTrace(result.events).violations.length === 0, `${label}: resource ledger is conserved`);
}

// Fixture content above is intentionally unsafe. Production content uses
// ordinary playable battles instead: the termination witnesses are filtered
// from the player bundle, so replaying those fixture inputs against production
// would test a skill that players cannot equip.
const productionRoster = ["warden", "mender", "lancer"];
const productionTraceCases = Array.from({ length: 12 }, (_, index) => [
  `playable battle ${index + 1}`,
  makeExpeditionBattle(
    composeEncounter(index + 1, 0, { partySize: productionRoster.length }),
    productionRoster,
    freshLoadout(productionRoster),
    `issue-175-${index + 1}`,
  ),
]);
for (const [label, battle] of productionTraceCases) {
  const result = simulateBattle(battle, PLAYABLE_CONTENT);
  check(["win", "loss", "draw"].includes(result.result), `${label}: player bundle normal result`);
  check(result.metrics.maxChainEventCount < DEFAULT_OPTIONS.maxEventsPerChain, `${label}: player bundle below chain cap`);
  check(result.metrics.eventCount < DEFAULT_OPTIONS.maxEventsPerBattle, `${label}: player bundle below battle cap`);
  check(auditRefiring(result.events).violations.length === 0, `${label}: player bundle same owner/rule re-fired`);
  const playerResourceTraceAudit = auditResourceTrace(result.events);
  check(
    playerResourceTraceAudit.violations.length === 0,
    `${label}: player bundle resource trace is bounded: ${playerResourceTraceAudit.violations.join(" | ")}`,
  );
}

const triageResult = simulateBattle(TRIAGE_BATTLE, FIXTURE_CONTENT);
const healingTrace = auditHealingTrace(triageResult.events);
check(healingTrace.applied > 0 && healingTrace.excess > 0, "triage trace contains applied and excess healing");
check(healingTrace.violations.length === 0, healingTrace.violations.join("\n"));
check(auditHealingTrace(traceWithDuplicateOverflow(triageResult.events)).violations.length > 0, "duplicate overflow child is detected");

// AP loop is a deliberate bad fixture: it demonstrates the trace shape that
// must be rejected when a resource output has no intervening spend.
const apTrace = simulateBattle(AP_LOOP_BATTLE, FIXTURE_CONTENT);
const apTraceAudit = auditResourceTrace(apTrace.events);
check(apTraceAudit.resourceEvents > 0, "AP loop witness emitted resource events");
check(apTraceAudit.violations.length > 0, "free resource relay is detected from its trace");
check(auditRefiring(apTrace.events).violations.length === 0, "AP loop still obeys one trigger per owner/rule/chain");
check(auditRefiring(traceWithDuplicateRuleTrigger(apTrace.events)).violations.length > 0, "duplicate rule trigger is detected");

const validTransferTrace = [
  {
    id: "valid_spend", type: "resource_spent", chainId: "valid-transfer",
    round: 1, sequence: 1, sourceActorId: "source", targetActorIds: ["source"],
    values: { resource: "action_points", amount: 1, before: 1, after: 0 },
  },
  {
    id: "valid_gain", type: "resource_gained", chainId: "valid-transfer",
    round: 1, sequence: 2, sourceActorId: "source", targetActorIds: ["ally"],
    values: { resource: "action_points", amount: 1, before: 0, after: 1 },
    parentEventId: "valid_spend",
  },
];
check(auditResourceTrace(validTransferTrace).violations.length === 0, "conserving resource transfer is accepted");

const invalidTransferTrace = structuredClone(validTransferTrace);
invalidTransferTrace[1] = {
  ...invalidTransferTrace[1],
  values: { resource: "action_points", amount: 2, before: 0, after: 2 },
};
check(auditResourceTrace(invalidTransferTrace).violations.length > 0, "net-positive resource transfer is detected");

// Self-damage must not be a hidden hit. The bad bundle is expected to heal from
// its own lose_hp event; the guarded bundle must keep that reaction silent.
const selfCostBattle = makeSelfCostBattle();
const badCostResult = simulateBattle(selfCostBattle, makeSelfCostBundle(false));
const guardedCostResult = simulateBattle(selfCostBattle, makeSelfCostBundle(true));
const badCostEvents = badCostResult.events.filter((event) => event.type === DAMAGE_EVENT && event.tags?.includes("cost"));
const badCostReaction = badCostResult.events.some((event) => event.ruleId === "audit_cost_follow_rule" && event.type === "healing_applied");
const guardedCostReaction = guardedCostResult.events.some((event) => event.ruleId === "audit_cost_follow_rule" && event.type === "healing_applied");
check(badCostEvents.length > 0 && badCostReaction, "self-cost fixture really re-fired the unguarded reaction");
check(!guardedCostReaction, "event_tag(cost=false) blocks self-cost re-fire");
check(auditSelfDamageRules([{
  path: "audit.bad_cost_rule",
  rule: makeSelfCostBundle(false).reactiveSkills.audit_cost_follow.rule,
}]).length > 0, "missing self-cost exclusion is detected statically");

// Deliberately malformed definitions prove that the smoke is not a collection
// of assertions that only pass for the current shape.
const badResourceRule = {
  path: "audit.bad_resource_rule",
  rule: {
    listenTo: "resource_gained",
    costs: [],
    effects: [{ type: RESOURCE_EFFECT, target: { scope: "self", take: 1 }, resource: "action_points", amount: { type: "constant", value: 1 } }],
    limit: { scope: "battle", count: 99 },
  },
};
check(auditResourceDefinitions([], [badResourceRule]).violations.length > 0, "free resource cycle definition is detected");
check(auditLimits([{
  ...badResourceRule,
  ownerBasis: badResourceRule.rule.limit?.owner ?? null,
}]).violations.length > 0, "missing limit.owner declaration is detected");
check(auditLimits([{
  ...badResourceRule,
  ownerBasis: "unknown-owner",
  rule: { ...badResourceRule.rule, limit: { owner: "unknown-owner", scope: "unknown_unit", count: 0 } },
}]).violations.length > 0, "unreadable limit declaration is detected");
check(auditExcessHealingDefinitions([{
  path: "audit.bad_excess_rule",
  rule: {
    listenTo: EXCESS_HEALING_EVENT,
    effects: [{ type: HEAL_EFFECT, target: { scope: "self", take: 1 }, amount: { type: "constant", value: 99 } }],
    limit: { scope: "battle", count: 99 },
  },
}]).violations.length > 0, "constant/double-use excess heal is detected");

// Generated equipment is another definition producer. Sample every rarity and
// apply the same rule audits to the resulting rules, not only fixed equipment.
const generatedRules = [];
for (const [dropIndex, rarity] of RARITY_PROBES()) {
  const item = generateEquipment({ seed: "issue-175-chain-safety", dropIndex, rarity });
  for (const rule of item.definition.rules ?? []) {
    generatedRules.push({
      section: "generatedEquipment",
      definitionId: item.definition.id,
      path: `generatedEquipment.${item.definition.id}.${rule.id}`,
      ownerBasis: rule.limit?.owner ?? null,
      rule,
    });
  }
}
check(generatedRules.length > 0, "generated equipment produced rules for audit");
check(auditResourceDefinitions([], generatedRules).violations.length === 0, "generated equipment resource outputs are finite");
check(auditSelfDamageRules(generatedRules).length === 0, "generated equipment excludes self-cost damage");
check(auditExcessHealingDefinitions(generatedRules).violations.length === 0, "generated equipment preserves excess-healing lineage");
check(auditLimits(generatedRules).violations.length === 0, "generated equipment declares finite rule limits");

function* RARITY_PROBES() {
  yield* [[0, "common"], [1, "rare"], [2, "epic"], [3, "legendary"], [4, "mythic"], [5, "oopart"]];
}

console.log(`chain-safety audit: PASS (${checks} checks)`);
console.log(`  inspected: ${current.activeSkills.length} active skills, ${current.rules.length} reachable rules, ${generatedRules.length} generated rules`);
console.log(`  AP/RP outputs: ${resourceAudit.rows.length} (creation ${resourceAudit.flowCounts.creation}, transfer ${resourceAudit.flowCounts.transfer}); damage_taken guards: ${current.rules.filter(({ rule }) => rule.listenTo === DAMAGE_EVENT).length}; excess-healing reactions: ${excessAudit.rows.length}`);
console.log(`  limit declarations: ${limitAudit.rows.length} (chain ${limitAudit.scopeCounts.chain}, round ${limitAudit.scopeCounts.round}, battle ${limitAudit.scopeCounts.battle}); excluded fixture witnesses: ${current.excluded.join(", ") || "none"}`);
