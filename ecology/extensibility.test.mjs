// ecology/extensibility.test.mjs — Gate E.
//
// The four content items R5 §16 E asks for were added after the engine was
// finished, as data in fixture-content.mjs and battle inputs in fixtures.mjs.
// No file the engine runs on changed while adding them: between ab83135 and
// ea27f90, engine.mjs, effects.mjs, predicates.mjs, selectors.mjs, values.mjs,
// event-queue.mjs, schema.mjs, validate.mjs and actors.mjs are byte identical.
// GATE_RESULTS.md carries that diff. (Engine files did change later, for the
// audit fixes in PREFLIGHT §14 to §19; the Gate E evidence is those two
// commits, and this file re-checks that the four items still behave.)

import assert from "node:assert/strict";
import { simulateBattle } from "./engine.mjs";
import { validateContentBundle } from "./validate.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { GATE_E_BATTLES, HUNTER_BATTLE, MOMENTUM_BATTLE, PIVOT_BATTLE, TRIAGE_BATTLE } from "./fixtures.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const run = (battle) => simulateBattle(battle, FIXTURE_CONTENT);
const of = (result, type) => result.events.filter((event) => event.type === type);

// The additions did not break the bundle, and they still run deterministically.
equal(validateContentBundle(FIXTURE_CONTENT).length, 0, "the extended bundle is still valid");
for (const battle of GATE_E_BATTLES) {
  equal(
    JSON.stringify(run(battle)),
    JSON.stringify(run(battle)),
    `${battle.battleId} is still deterministic`,
  );
}

// ---- 1. heal an ally at or below half health, overflow to somebody else -------

{
  const result = run(TRIAGE_BATTLE);
  const selected = of(result, "target_selected").find((event) => event.skillId === "triage");
  equal(selected.targetActorIds[0], "a_mender", "the half health ally was chosen");
  check(
    !of(result, "target_selected").some(
      (event) => event.skillId === "triage" && event.targetActorIds[0] === "a_lancer",
    ),
    "the ally above half health was not chosen",
  );
  const applied = of(result, "healing_applied").find((event) => event.skillId === "triage");
  equal(applied.values.requested, 8);
  equal(applied.values.actual, 7, "capped by the missing hp");
  const excess = of(result, "excess_healing").find((event) => event.skillId === "triage");
  equal(excess.values.amount, 1);
  const relayed = of(result, "healing_applied").find((event) => event.ruleId === "triage_relay_rule");
  check(relayed !== undefined, "the overflow reached someone");
  equal(relayed.targetActorIds[0], "a_lancer", "and it was somebody else");
  equal(relayed.values.actual, 1, "with exactly the overflow amount");
}

// ---- 2. equipment that strengthens the action after a move --------------------

{
  const result = run(MOMENTUM_BATTLE);
  const moved = of(result, "actor_moved").find((event) => event.targetActorIds[0] === "a_scout");
  const buff = of(result, "status_added").find((event) => event.ruleId === "momentum_rig_rule");
  check(buff !== undefined, "the rig answered the move");
  check(buff.sequence > moved.sequence, "after the move");
  equal(buff.targetActorIds[0], "a_scout");

  const strike = of(result, "damage_taken").find(
    (event) => event.sourceActorId === "a_scout" && event.skillId === "strike",
  );
  equal(strike.values.proposed, 5, "the next attack was one larger than the plain four");
  const worn = of(result, "equipment_worn").find((event) => event.ruleId === "momentum_rig_rule");
  equal(worn.values.after, 1, "and the rig paid a point of durability for it");
}

// ---- 3. a signature that turns unused action points into a round barrier ------

{
  const result = run(PIVOT_BATTLE);
  const unused = of(result, "resource_unused").find(
    (event) => event.values.resource === "action_points" && event.round === 1,
  );
  equal(unused.values.amount, 2, "both points went unspent");
  const banked = of(result, "barrier_gained").find((event) => event.ruleId === "pivot_banks_the_rest");
  check(banked !== undefined, "the signature banked them");
  equal(banked.values.amount, 2, "one barrier point per unused action point");
  equal(banked.values.duration, "round");

  // And the packet survives the round end that created it, into the next round.
  const absorbed = of(result, "barrier_damaged").find((event) => event.round === 2);
  check(absorbed !== undefined, "the banked barrier was still there next round");
  equal(absorbed.values.amount, 2);
  const hit = of(result, "damage_taken").find((event) => event.round === 2);
  equal(hit.values.barrierAbsorbed, 2);
  equal(hit.values.amount, 2, "and only the remainder reached hp");
}

// ---- 4. an enemy tactic that prefers a preparing target -----------------------

{
  const result = run(HUNTER_BATTLE);
  const hunted = of(result, "target_selected").find((event) => event.skillId === "hunt_the_slow");
  check(hunted !== undefined, "the hunter used its first tactic");
  equal(hunted.targetActorIds[0], "a_lancer", "on the actor that was preparing");
  const started = of(result, "preparation_started")[0];
  check(started.sequence < hunted.sequence, "the preparation was already visible");

  // With nobody preparing, the query is empty, the tactic is unusable, and the
  // enemy falls through to its second tactic. Priority is tactic order alone.
  const fallback = of(result, "target_selected").find(
    (event) => event.skillId === "strike" && event.sourceActorId === "e_hunter",
  );
  check(fallback !== undefined, "it fell back to its plain attack");
  check(fallback.round > hunted.round, "in a later round");
}

console.log(`extensibility.test.mjs: ${checks} checks passed`);
