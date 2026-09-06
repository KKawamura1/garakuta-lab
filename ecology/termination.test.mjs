// ecology/termination.test.mjs — Gate D.
//
// §14 asks for two different things and R5 wants them told apart:
//
//   * a safety constraint stop — the battle finishes normally because a rule
//     may only fire once per chain for one owner, or because an actor has used
//     its eight activations for the round. Nothing is dropped; the leftovers
//     show up in the event列.
//   * a diagnostic error — the engine genuinely cannot finish, or a free action
//     reaches its safety cap, so it throws with enough state to find the loop.
//
// PREFLIGHT §6 keeps a free, always usable action as the diagnostic witness;
// with one action per side phase it reaches the per-round activation cap.

import assert from "node:assert/strict";
import { DEFAULT_OPTIONS } from "./schema.mjs";
import { EcologyRuntimeError, EcologyValidationError } from "./errors.mjs";
import { simulateBattle } from "./engine.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import { freshLoadout, makeBattle } from "./playable-battles.mjs";
import {
  ACTIVATION_CAP_BATTLE,
  AP_LOOP_BATTLE,
  BARRIER_BLOOM_BATTLE,
  CORE_BATTLE,
  DAMAGE_ECHO_BATTLE,
  FREE_ACTION_BATTLE,
  FULL_PARTY_BATTLE,
  PREP_SPIRAL_BATTLE,
  PREP_SPIRAL_BATTLE as PREP,
  SELF_WEAR_BATTLE,
  TERMINATION_BATTLES,
} from "./fixtures.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const run = (battle, options) => simulateBattle(battle, FIXTURE_CONTENT, options);

function issue130StressBattle() {
  const roster = ["warden", "mender", "lancer", "guardian", "tactician"];
  const loadout = freshLoadout(roster);
  const reactiveIds = ["relay_front", "relay_rear", "ap_loop", "damage_echo"];
  for (const characterId of roster) loadout.reactives[characterId] = [...reactiveIds];

  const battle = makeBattle(
    7,
    roster,
    loadout,
    "issue_130_event_budget",
    {},
    {
      statsFor: () => ({
        stats: { maxHp: 10000, might: 20, focus: 20, guard: 0 },
        training: {},
      }),
    },
  );
  battle.maxRounds = 11;
  battle.objective = { type: "survive_rounds", rounds: 11 };
  for (const enemy of battle.enemies) {
    enemy.stats = { maxHp: 10000, might: 0, focus: 0, guard: 0 };
    enemy.hp = 10000;
  }
  return battle;
}

// One firing of each of these rules emits exactly one event of the named type,
// so counting those events per chain per owner counts firings.
function firingsPerChain(result, ruleId, eventType) {
  const counts = new Map();
  for (const event of result.events) {
    if (event.ruleId !== ruleId || event.type !== eventType) continue;
    const key = `${event.chainId}|${event.sourceActorId ?? "~region"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// ---- the five loops R5 names all stop on the safety constraint ---------------

const SAFETY_CASES = [
  { battle: AP_LOOP_BATTLE, ruleId: "ap_loop_rule", eventType: "resource_gained" },
  { battle: DAMAGE_ECHO_BATTLE, ruleId: "damage_echo_rule", eventType: "damage_proposed" },
  { battle: BARRIER_BLOOM_BATTLE, ruleId: "barrier_bloom_rule", eventType: "barrier_gained" },
  { battle: PREP_SPIRAL_BATTLE, ruleId: "prep_spiral_rule", eventType: "preparation_advanced" },
  { battle: SELF_WEAR_BATTLE, ruleId: "hungry_plate_rule", eventType: "equipment_worn" },
];

for (const { battle, ruleId, eventType } of SAFETY_CASES) {
  const result = run(battle);
  check(["win", "loss", "draw"].includes(result.result), `${battle.battleId} finished normally`);
  const counts = firingsPerChain(result, ruleId, eventType);
  check(counts.size > 0, `${battle.battleId}: ${ruleId} did fire, so the loop was really attempted`);
  for (const [key, count] of counts) {
    equal(count, 1, `${battle.battleId}: ${ruleId} fired more than once in ${key}`);
  }
  check(
    result.metrics.maxChainEventCount < DEFAULT_OPTIONS.maxEventsPerChain,
    `${battle.battleId} stayed inside the chain cap`,
  );
  check(
    result.metrics.eventCount < DEFAULT_OPTIONS.maxEventsPerBattle,
    `${battle.battleId} stayed inside the battle cap`,
  );
}

// Issue 130 — the old fixture termination witnesses used to be copied into
// playable content as free reactive rules. Five actors carrying those four
// rules can exceed the battle budget across many short chains, even though no
// individual chain reaches its loop cap. Playable copies must spend RP, so the
// same stress input finishes under the original 4096-event diagnostic limit.
{
  const battle = issue130StressBattle();
  const result = simulateBattle(battle, PLAYABLE_CONTENT, {
    maxEventsPerBattle: DEFAULT_OPTIONS.maxEventsPerBattle,
  });
  check(
    battle.allies.every((ally) => ally.reactiveSkillIds.length === 4),
    "issue 130 stress input fills four reactive slots for every ally",
  );
  check(
    result.metrics.eventCount < DEFAULT_OPTIONS.maxEventsPerBattle,
    "issue 130 stress input finishes below the battle cap after the RP guard",
  );
  check(
    result.metrics.maxChainEventCount < DEFAULT_OPTIONS.maxEventsPerChain,
    "issue 130 stress input still stays inside the chain cap",
  );
}

// The echo pair really does bounce: both sides answered a damage_taken.
{
  const result = run(DAMAGE_ECHO_BATTLE);
  const echoes = result.events.filter(
    (event) => event.ruleId === "damage_echo_rule" && event.type === "damage_proposed",
  );
  check(echoes.length >= 2, "the echo went both ways at least once");
  const sources = new Set(echoes.map((event) => event.sourceActorId));
  equal(sources.size, 2, "both actors echoed");
}

// ---- the activation ceiling (PREFLIGHT §5) -----------------------------------

{
  const result = run(ACTIVATION_CAP_BATTLE);
  const highest = new Map();
  for (const event of result.events) {
    if (event.type !== "actor_activated") continue;
    highest.set(event.sourceActorId, Math.max(highest.get(event.sourceActorId) ?? 0, event.values.activation));
  }
  equal(highest.get("a_lancer"), DEFAULT_OPTIONS.maxActivationsPerActorPerRound, "the ceiling was reached");
  equal(highest.get("a_warden"), DEFAULT_OPTIONS.maxActivationsPerActorPerRound);
  for (const [instanceId, count] of highest) {
    check(count <= DEFAULT_OPTIONS.maxActivationsPerActorPerRound, `${instanceId} stayed at or under the ceiling`);
  }
  // §1.2 — the stop is not silent: the action points that could not be used are
  // reported at the end of the round.
  const unused = result.events.filter(
    (event) => event.type === "resource_unused" && event.values.resource === "action_points",
  );
  check(unused.length > 0, "the unusable action points were reported");
  check(unused.some((event) => event.values.amount > 0), "and the amount is visible");
}

// ---- real non termination throws, with diagnostics ---------------------------

function expectRuntimeError(battle, options, expectedLimit, label) {
  let thrown = null;
  let returned;
  try {
    returned = simulateBattle(battle, FIXTURE_CONTENT, options);
  } catch (error) {
    thrown = error;
  }
  check(thrown !== null, `${label} must throw, got ${returned && returned.result}`);
  check(returned === undefined, `${label} must not return a partial result`);
  check(thrown instanceof EcologyRuntimeError, `${label} throws EcologyRuntimeError`);
  equal(thrown.diagnostics.limit, expectedLimit, `${label} names the limit it hit`);

  // §14 — the required contents of the diagnostic.
  const diagnostics = thrown.diagnostics;
  for (const field of [
    "battleId",
    "round",
    "currentActorId",
    "chainId",
    "eventSequence",
    "parentEventId",
    "ruleActivationStack",
    "chainRuleFirings",
    "recentEvents",
  ]) {
    check(field in diagnostics, `${label} diagnostic has ${field}`);
  }
  equal(diagnostics.battleId, battle.battleId);
  check(Array.isArray(diagnostics.recentEvents), `${label} lists recent events`);
  check(diagnostics.recentEvents.length <= 20, `${label} lists at most the last twenty`);
  check(diagnostics.recentEvents.length > 0, `${label} lists at least one`);
  check(typeof diagnostics.chainRuleFirings === "object", `${label} reports per rule chain firings`);
  check(thrown.message.includes(battle.battleId), `${label} message names the battle`);
  return thrown;
}

{
  // PREFLIGHT §6 — apCost 0 with an always usable target: one action is allowed
  // per side pass, so the per-round activation ceiling is now the safety stop.
  const error = expectRuntimeError(
    FREE_ACTION_BATTLE,
    {},
    "maxActivationsPerActorPerRound",
    "a free repeatable action",
  );
  equal(error.diagnostics.currentActorId, "a_scout", "the diagnostic names the actor that is looping");
  check(error.diagnostics.round === 1, "and the round it is looping in");
}

{
  // The chain cap fires on an ordinary fixture once it is tightened, which is
  // also how the per chain diagnostic gets covered.
  const error = expectRuntimeError(
    FULL_PARTY_BATTLE,
    { maxEventsPerChain: 6 },
    "maxEventsPerChain",
    "a tightened chain cap",
  );
  equal(error.diagnostics.limitValue, 6);
  check(error.diagnostics.chainId !== null, "the chain that overflowed is named");
}

{
  const error = expectRuntimeError(
    CORE_BATTLE,
    { maxEventsPerBattle: 12 },
    "maxEventsPerBattle",
    "a tightened battle cap",
  );
  equal(error.diagnostics.limitValue, 12);
}

// A rule that is mid firing when the cap trips leaves its own frame behind, so
// the diagnostic points at the rule rather than only at the event count. The
// ally-first phases make the overflow-care reaction blow the active frame here.
{
  let thrown = null;
  try {
    simulateBattle(CORE_BATTLE, FIXTURE_CONTENT, { maxEventsPerChain: 10 });
  } catch (error) {
    thrown = error;
  }
  check(thrown !== null, "the tightened chain cap throws");
  const stack = thrown.diagnostics.ruleActivationStack;
  equal(stack.length, 1, "the rule that was running is on the stack");
  equal(stack[0].ruleId, "overflow_care_rule");
  equal(stack[0].ownerId, "a_mender");
  equal(stack[0].listenTo, "excess_healing");
  check(stack[0].triggeredByEventId.startsWith("evt_"), "and the event that triggered it");
}

// ---- bad content throws too, and never simulates ----------------------------

{
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.activeSkills.strike.effects[0].type = "obliterate";
  let thrown = null;
  try {
    simulateBattle(CORE_BATTLE, bundle);
  } catch (error) {
    thrown = error;
  }
  check(thrown instanceof EcologyValidationError, "unknown content throws a validation error");
  check(thrown.errors.length > 0, "and carries the list of problems");
}

void PREP;
console.log(`termination.test.mjs: ${checks} checks passed`);
