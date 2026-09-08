// ecology/replay-beats.test.mjs — Issue #192.
//
// The battle log and the board replay must consume the same known event
// vocabulary. This is deliberately a projection test, not just an engine
// fixture: it catches a UI-only whitelist drifting away from the schema.

import assert from "node:assert/strict";
import { EVENT_TYPES } from "./schema.mjs";
import { buildBeats, filterReplayEvents } from "./replay-beats.mjs";

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

const canceled = buildBeats([
  event("action_declared", { skillId: "strike", targetActorIds: [] }),
  event("action_canceled", { skillId: "strike", values: { reason: "no_target" } }),
]);
assert.equal(canceled.at(-1).kind, "skipped", "a canceled action gets a visible skipped beat");

console.log("replay-beats checks ok", JSON.stringify({ knownEvents: allKnown.length, beats: beats.length }));
