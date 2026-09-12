// ecology/replay-beats.test.mjs — Issue #192.
//
// The battle log and the board replay must consume the same known event
// vocabulary. This is deliberately a projection test, not just an engine
// fixture: it catches a UI-only whitelist drifting away from the schema.

import assert from "node:assert/strict";
import { EVENT_TYPES } from "./schema.mjs";
import { beatHasStrikeImpact, buildBeats, filterReplayEvents } from "./replay-beats.mjs";

const event = (type, fields = {}) => ({
  type,
  chainId: "chain_0001",
  round: 1,
  sourceActorId: "e_husk",
  targetActorIds: ["a_warden"],
  ...fields,
});

const allKnown = filterReplayEvents([
  ...EVENT_TYPES.map((type) => event(type)),
  event("event_added_after_schema"),
]);
assert.equal(allKnown.length, EVENT_TYPES.length, "known schema events all reach replay projection");
assert.equal(allKnown.at(-1).type, EVENT_TYPES.at(-1), "unknown events stay out of replay");

const enemyAction = filterReplayEvents([
  event("action_declared", { skillId: "strike", targetActorIds: [] }),
  event("target_selected", { skillId: "strike" }),
  event("action_cost_paid", { skillId: "strike", values: { apCost: 1 } }),
  event("action_started", { skillId: "strike" }),
  event("damage_proposed", { skillId: "strike", values: { amount: 4 } }),
  event("barrier_damaged", { skillId: "strike", values: { amount: 4 } }),
  event("barrier_broken", { skillId: "strike" }),
  event("damage_absorbed", {
    skillId: "strike",
    values: { amount: 4, finalDamage: 0, fullyAbsorbed: true },
  }),
  event("action_resolved", { skillId: "strike" }),
]);
const beats = buildBeats(enemyAction);
const declaration = beats.find((beat) => beat.kind === "declare");
const impact = beats.find((beat) => beat.kind === "impact");
assert.ok(declaration?.events.some((entry) => entry.type === "action_declared"), "enemy action declaration is a beat");
assert.ok(impact?.events.some((entry) => entry.type === "damage_absorbed"), "zero-damage absorption is an impact event");
assert.ok(impact?.events.some((entry) => entry.type === "barrier_damaged"), "barrier consumption stays with the impact");

const preparedAttack = buildBeats([
  event("action_started", { skillId: "enemy_heavy", targetActorIds: ["a_warden"] }),
  event("preparation_started", { skillId: "enemy_heavy", targetActorIds: ["e_husk"] }),
  event("preparation_advanced", { skillId: "enemy_heavy", targetActorIds: ["e_husk"] }),
  event("preparation_completed", { skillId: "enemy_heavy", targetActorIds: ["e_husk"] }),
  event("damage_proposed", { skillId: "enemy_heavy", targetActorIds: ["a_warden"], values: { amount: 8 } }),
  event("damage_taken", { skillId: "enemy_heavy", targetActorIds: ["a_warden"], values: { amount: 8 } }),
]);
assert.deepEqual(
  preparedAttack.map((beat) => beat.kind),
  ["impact", "prepare", "prepare", "prepare", "impact"],
  "a prepared attack separates completion from its landing",
);
assert.ok(
  !beatHasStrikeImpact(preparedAttack[0]),
  "starting a prepared action does not look like a landing",
);
assert.ok(
  !beatHasStrikeImpact(preparedAttack[3]),
  "preparation completion does not look like a landing",
);
assert.ok(
  beatHasStrikeImpact(preparedAttack[4]),
  "the prepared attack lands in an impact beat",
);

const reaction = buildBeats([
  event("status_added", { ruleId: "reactive_rule", targetActorIds: ["a_warden"] }),
]);
assert.ok(!beatHasStrikeImpact(reaction[0]), "a sub reaction does not trigger a strike lunge");

// issue #242 — 必殺の一拍。**新しい event を足さずに、ID の形だけで拍が増える。**
const ultimateActive = buildBeats([
  event("action_declared", { skillId: "ult_sure_cut", sourceActorId: "a_warden", targetActorIds: [] }),
  event("action_cost_paid", { skillId: "ult_sure_cut", sourceActorId: "a_warden" }),
  event("action_started", { skillId: "ult_sure_cut", sourceActorId: "a_warden", targetActorIds: ["e_husk"] }),
  event("damage_proposed", { skillId: "ult_sure_cut", sourceActorId: "a_warden", values: { amount: 12 } }),
  event("damage_taken", {
    skillId: "ult_sure_cut", sourceActorId: "a_warden", targetActorIds: ["e_husk"], values: { amount: 12 },
  }),
  event("status_added", {
    skillId: "ult_sure_cut",
    sourceActorId: "a_warden",
    targetActorIds: ["a_warden"],
    values: { statusId: "ultimate_spent" },
  }),
]);
assert.deepEqual(
  ultimateActive.map((beat) => beat.kind),
  ["declare", "ultimate", "impact"],
  "an active ultimate gets one cut-in beat between its declaration and its landing",
);
assert.equal(ultimateActive[1].ultimateId, "ult_sure_cut", "the cut-in beat names the ultimate");
assert.equal(ultimateActive[1].events[0].type, "action_started", "the cut-in rides the announcement event");
assert.ok(
  ultimateActive[1].ms > ultimateActive[2].ms,
  "the cut-in holds longer than the landing it precedes",
);
assert.ok(
  !beatHasStrikeImpact(ultimateActive[1]),
  "the cut-in itself is not a landing",
);
assert.ok(
  beatHasStrikeImpact(ultimateActive[2]),
  "the ultimate still lands in its own impact beat",
);
assert.equal(
  ultimateActive.filter((beat) => beat.kind === "ultimate").length, 1,
  "the seal status does not open a second cut-in",
);

// 普通の技能は拍を増やさない（`ult_` で始まらない）。
assert.equal(
  buildBeats([
    event("action_started", { skillId: "sure_cut", sourceActorId: "a_warden", targetActorIds: ["e_husk"] }),
  ]).filter((beat) => beat.kind === "ultimate").length,
  0,
  "an ordinary skill gets no cut-in",
);

// リアクティブは宣言の event を持たないので、最初の効果でカットインを開き、
// **その効果より前の盤面**を見せる（to が一つ前を指す）。
const ultimateReactive = buildBeats([
  event("action_started", { skillId: "strike", sourceActorId: "e_husk", targetActorIds: ["a_warden"] }),
  event("damage_taken", { skillId: "strike", sourceActorId: "e_husk", values: { amount: 5 } }),
  event("healing_applied", {
    ruleId: "ult_mend_reflex",
    sourceDefinitionId: "ult_mend_reflex",
    sourceActorId: "a_mender",
    targetActorIds: ["a_warden"],
    values: { amount: 9 },
  }),
  event("status_added", {
    ruleId: "ult_mend_reflex",
    sourceDefinitionId: "ult_mend_reflex",
    sourceActorId: "a_mender",
    targetActorIds: ["a_mender"],
    values: { statusId: "ultimate_spent" },
  }),
]);
const reactiveCutIn = ultimateReactive.findIndex((beat) => beat.kind === "ultimate");
assert.ok(reactiveCutIn > 0, "a reactive ultimate also gets a cut-in beat");
assert.equal(ultimateReactive[reactiveCutIn].ultimateId, "ult_mend_reflex", "the cut-in names the reactive ultimate");
assert.equal(
  ultimateReactive[reactiveCutIn].to, ultimateReactive[reactiveCutIn].from - 1,
  "the reactive cut-in shows the board before its own effect",
);
assert.ok(
  ultimateReactive[reactiveCutIn + 1]?.events.some((entry) => entry.type === "healing_applied"),
  "the reactive ultimate's effect lands in the beat after the cut-in",
);
assert.equal(
  ultimateReactive.filter((beat) => beat.kind === "ultimate").length, 1,
  "several effects from one reactive firing share one cut-in",
);

const canceled = buildBeats([
  event("action_declared", { skillId: "strike", targetActorIds: [] }),
  event("action_canceled", { skillId: "strike", values: { reason: "no_target" } }),
]);
assert.equal(canceled.at(-1).kind, "skipped", "a canceled action gets a visible skipped beat");

console.log("replay-beats checks ok", JSON.stringify({
  knownEvents: allKnown.length,
  beats: beats.length,
  ultimateCutIns: ultimateActive.filter((beat) => beat.kind === "ultimate").length
    + ultimateReactive.filter((beat) => beat.kind === "ultimate").length,
}));
