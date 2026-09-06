// ecology/engine.test.mjs — Gate C.
//
// Determinism, purity, and the meaning of each event. Numbers alone are not
// enough here: most checks assert that a particular event exists, in a
// particular place, with particular values.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_OPTIONS, RESULT_SCHEMA_VERSION, SKILL_LEVEL_STEP_BPS } from "./schema.mjs";
import { BPS, roundHalfUpDiv } from "./values.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import {
  ALL_FIXTURE_BATTLES,
  BARRIER_PACKET_BATTLE,
  BARRIER_PARTIAL_BATTLE,
  BROKEN_EQUIPMENT_BATTLE,
  BROKEN_KIT_BATTLE,
  CORE_BATTLE,
  COST_CONTEST_BATTLE,
  COVER_BATTLE,
  DEFINITION_BATTLE,
  EXTERNAL_ADVANCE_BATTLE,
  FIELD_KIT_BATTLE,
  FOCUSED_BARRIER_BATTLE,
  FULL_PARTY_BATTLE,
  IMMEDIATE_BATTLE,
  INERT_BATTLE,
  MOVE_BATTLE,
  PREPARATION_BATTLE,
  POSITION_ORDER_BATTLE,
  REGION_BATTLE,
  REQUEUE_BATTLE,
  ROUND_LIMIT_BATTLE,
  SIDE_PHASE_BATTLE,
  STATUS_BATTLE,
  WAITING_TACTIC_BATTLE,
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
const of = (result, type) => result.events.filter((event) => event.type === type);
const first = (result, type) => of(result, type)[0];
const indexOf = (result, predicate) => result.events.findIndex(predicate);

// ---- §4.2 purity -------------------------------------------------------------

for (const file of [
  "engine.mjs",
  "effects.mjs",
  "selectors.mjs",
  "predicates.mjs",
  "values.mjs",
  "event-queue.mjs",
  "validate.mjs",
  "actors.mjs",
  "static-bonuses.mjs",
]) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  check(!source.includes("Math.random"), `${file} must not use Math.random`);
  check(!/\bDate\.now\b|new Date\(/.test(source), `${file} must not read the clock`);
}

{
  // The same arguments produce a JSON deep identical result, event ids and chain
  // ids included, one hundred times over.
  const baseline = JSON.stringify(run(FULL_PARTY_BATTLE));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.equal(JSON.stringify(run(FULL_PARTY_BATTLE)), baseline, `run ${attempt} diverged`);
  }
  checks += 1;

  // Neither the input nor the content bundle is touched.
  const inputBefore = JSON.stringify(FULL_PARTY_BATTLE);
  const contentBefore = JSON.stringify(FIXTURE_CONTENT);
  run(FULL_PARTY_BATTLE);
  equal(JSON.stringify(FULL_PARTY_BATTLE), inputBefore, "battle input was mutated");
  equal(JSON.stringify(FIXTURE_CONTENT), contentBefore, "content bundle was mutated");
}

// ---- §4.1 result shape --------------------------------------------------------

{
  const result = run(CORE_BATTLE);
  equal(result.schemaVersion, RESULT_SCHEMA_VERSION);
  equal(result.contentVersion, "fixture-1");
  equal(result.battleId, "fixture_core");
  equal(result.result, "win");
  equal(result.reason, "objective_met");
  check(Array.isArray(result.actors) && result.actors.length === 4, "actors snapshot");
  check(Array.isArray(result.equipment), "equipment snapshot");
  check(result.metrics.eventCount === result.events.length, "metrics agree with the event list");

  // §7 — ids come from the sequence, and every parent really exists.
  const ids = new Set();
  result.events.forEach((event, index) => {
    equal(event.sequence, index, "sequence is dense and ordered");
    equal(event.id, `evt_${String(index).padStart(4, "0")}`, "id is derived from the sequence");
    check(!ids.has(event.id), "event ids are unique");
    ids.add(event.id);
    if (event.parentEventId !== undefined) {
      check(ids.has(event.parentEventId), `parent ${event.parentEventId} precedes its child`);
    }
    check(!("text" in event.values), "events carry facts, not display text");
  });
}

// ---- §11.1 the opening and the closing ---------------------------------------

for (const battle of ALL_FIXTURE_BATTLES) {
  const result = run(battle);
  equal(result.events[0].type, "battle_started", `${battle.battleId} opens with battle_started`);
  equal(result.events.at(-1).type, "battle_ended", `${battle.battleId} closes with battle_ended`);
  equal(of(result, "battle_ended").length, 1, `${battle.battleId} ends once`);
}

{
  // §11.1-6 — already decided at the start, and still recorded in order.
  const result = run(IMMEDIATE_BATTLE);
  assert.deepEqual(result.events.map((event) => event.type), ["battle_started", "battle_ended"]);
  equal(result.result, "win");
  equal(result.roundsUsed, 0);
  checks += 1;
}

// ---- §12.1 damage, barrier and overkill --------------------------------------

{
  const result = run(BARRIER_PARTIAL_BATTLE);
  const proposed = first(result, "damage_proposed");
  const absorbed = first(result, "barrier_damaged");
  const broken = first(result, "barrier_broken");
  const taken = of(result, "damage_taken").find(
    (event) => event.sourceActorId === "e_husk" && event.targetActorIds[0] === "a_warden",
  );
  equal(proposed.values.amount, 4);
  equal(absorbed.values.amount, 2, "the barrier ate what it could");
  check(broken.sequence > absorbed.sequence, "the packet breaks after it is emptied");
  equal(taken.values.amount, 2, "the rest reached hp");
  equal(taken.values.barrierAbsorbed, 2);
  equal(taken.values.proposed, 4);
  equal(of(result, "excess_damage").length, 0, "no overkill when the target survives");
}

{
  // §12.3 — earliest expiry first, oldest first inside one expiry, and a fully
  // absorbed hit records no damage_taken at all (§12.1-9).
  const result = run(BARRIER_PACKET_BATTLE);
  const absorbed = of(result, "barrier_damaged").filter((event) => event.round === 1);
  equal(absorbed.length, 2, "two packets were touched");
  equal(absorbed[0].values.duration, "round");
  equal(absorbed[1].values.duration, "round");
  equal(absorbed[0].values.amount, 1, "the older round packet went first");
  equal(absorbed[1].values.amount, 3);
  equal(of(result, "damage_taken").filter((event) => event.round === 1).length, 0, "nothing reached hp");
  equal(of(result, "damage_proposed").filter((event) => event.round === 1).length, 1, "the proposal is still recorded");
  const secondRound = of(result, "barrier_damaged").filter((event) => event.round === 2);
  equal(secondRound.at(-1).values.duration, "battle", "the battle packet is spent last");
}

{
  // §12.1 — excess is max(0, proposed - absorbed - hpBefore).
  const result = run(BROKEN_EQUIPMENT_BATTLE);
  const excess = first(result, "excess_damage");
  equal(excess.values.amount, 3);
  equal(excess.values.proposed, 4);
  equal(excess.values.hpBefore, 1);
  const defeated = first(result, "actor_defeated");
  check(defeated.sequence < excess.sequence, "the defeat is recorded before the overkill");
}

// ---- §12.2 healing and overflow ----------------------------------------------

{
  // Keep this witness focused on the healing pipeline: the mender is placed
  // before the enemy, so formation initiative cannot damage the actor before
  // its full-health mend produces the intended overflow.
  const healingBattle = structuredClone(CORE_BATTLE);
  healingBattle.allies.find((actor) => actor.instanceId === "a_mender").position = "front_left";
  healingBattle.allies.find((actor) => actor.instanceId === "a_warden").position = "rear_left";
  const result = run(healingBattle);
  const proposed = first(result, "healing_proposed");
  const applied = first(result, "healing_applied");
  const excess = first(result, "excess_healing");
  equal(proposed.values.amount, 5);
  equal(applied.values.requested, 5);
  equal(applied.values.actual, 0, "a full actor takes none of it");
  equal(excess.values.amount, 5);

  // §15.2 — the overflow rule hands the leftover to somebody else, and
  // not_previous_target is what keeps it off the actor just healed.
  const overflow = of(result, "healing_applied").find((event) => event.ruleId === "overflow_care_rule");
  check(overflow !== undefined, "the overflow rule healed someone");
  equal(overflow.targetActorIds[0], "a_lancer");
  equal(overflow.values.actual, 1, "the lancer was one point down");
  check(
    of(result, "healing_applied").filter((event) => event.ruleId === "overflow_care_rule").length === 1,
    "the overflow rule fires once per chain",
  );
}

// ---- §11.5 interrupt ordering, cover, and re-evaluation ----------------------

{
  const result = run(COVER_BATTLE);
  const changes = of(result, "target_changed").filter((event) => event.round === 1);
  equal(changes.length, 2, "both covers fired on one action");
  // Equal priority, so the tie-break follows formation order: the warden is
  // in front_left, before the lancer in front_right.
  equal(changes[0].sourceActorId, "a_warden");
  equal(changes[1].sourceActorId, "a_lancer");
  equal(changes[0].values.from, "a_mender");
  equal(changes[1].values.from, "a_warden");
  const started = of(result, "action_started").find((event) => event.sourceActorId === "e_husk");
  equal(started.targetActorIds[0], "a_lancer", "the action resolves against the final target");
  const taken = of(result, "damage_taken").find((event) => event.sourceActorId === "e_husk");
  equal(taken.targetActorIds[0], "a_lancer");
  const declared = of(result, "action_declared").find((event) => event.sourceActorId === "e_husk");
  check(changes[0].sequence > declared.sequence, "the redirect happens inside the action");
  check(changes[1].sequence < started.sequence, "and before the action starts");
}

{
  // §5.7 — an earlier reaction spent the only reaction point, so the later one
  // is re-checked and does not fire.
  const result = run(COST_CONTEST_BATTLE);
  const counters = of(result, "damage_proposed").filter((event) => event.ruleId === "counter_blow_rule");
  const braces = of(result, "barrier_gained").filter((event) => event.ruleId === "brace_after_hit_rule");
  equal(counters.length, 2, "the cheaper priority fired in both rounds");
  equal(braces.length, 0, "the later rule could not pay and did not fire");
}

{
  // R18 — the player's reactive order is stronger than content priority for
  // two reactions owned by the same actor and listening to the same trigger.
  // Reversing the fixture list must make the former lower-priority counter wait.
  const reversed = structuredClone(COST_CONTEST_BATTLE);
  reversed.allies[0].reactiveSkillIds.reverse();
  const result = run(reversed);
  const ordered = result.events.filter((event) =>
    event.ruleId === "brace_after_hit_rule" || event.ruleId === "counter_blow_rule");
  equal(ordered[0]?.ruleId, "brace_after_hit_rule", "reactive skills fire from top to bottom");
  equal(
    of(result, "damage_proposed").filter((event) => event.ruleId === "counter_blow_rule").length,
    0,
    "the lower reactive skill waits after the first one spends RP",
  );
}

// ---- §12.4 preparation --------------------------------------------------------

{
  // Completed on the preparing actor's own next activation.
  const result = run(PREPARATION_BATTLE);
  const started = first(result, "preparation_started");
  const advanced = first(result, "preparation_advanced");
  const completed = first(result, "preparation_completed");
  equal(started.round, 1);
  equal(advanced.round, 2, "the activation advances it a step");
  equal(completed.chainId, advanced.chainId, "completion happens in the same chain");
  const heavy = of(result, "damage_taken").find((event) => event.skillId === "heavy_swing");
  equal(heavy.values.amount, 9);
  // The activation that completes a preparation does not go on to a normal action.
  const activationChain = advanced.chainId;
  check(
    !result.events.some((event) => event.chainId === activationChain && event.type === "action_declared"),
    "no ordinary action follows the completion in that activation",
  );
}

{
  // Completed from outside, in the same chain the preparation started in.
  const result = run(EXTERNAL_ADVANCE_BATTLE);
  const started = first(result, "preparation_started");
  const advanced = first(result, "preparation_advanced");
  const completed = first(result, "preparation_completed");
  equal(advanced.ruleId, "urging_rule");
  equal(advanced.chainId, started.chainId, "the external advance is part of the same chain");
  equal(completed.chainId, started.chainId);
  equal(completed.round, 1, "it finished in the round it started");
}

// ---- §11.3 requeue on an action point --------------------------------------

{
  const result = run(REQUEUE_BATTLE);
  const activations = of(result, "actor_activated").filter(
    (event) => event.sourceActorId === "a_lancer" && event.round === 1,
  );
  equal(activations.length, 2, "the lancer acted twice after being handed a point");
  equal(activations[1].values.activation, 2);
  const gain = of(result, "resource_gained").find((event) => event.skillId === "relay_order");
  check(gain.sequence < activations[1].sequence, "the requeue follows the gain");
  // The gain happens after the ally phase, so the enemy phase comes in between.
  const husk = of(result, "actor_activated").find(
    (event) => event.sourceActorId === "e_husk" && event.round === 1,
  );
  check(husk.sequence < activations[1].sequence, "the gained point waits for the next ally phase");
}

// ---- §5.6 a broken item stops supplying its rule ------------------------------

{
  const result = run(BROKEN_EQUIPMENT_BATTLE);
  const broken = first(result, "equipment_broken");
  const splinters = of(result, "damage_proposed").filter((event) => event.ruleId === "splinter_edge_rule");
  const overkills = of(result, "excess_damage");
  equal(splinters.length, 1, "the item fired once before breaking");
  check(overkills.length >= 2, "a later overkill happened");
  check(overkills[1].sequence > broken.sequence, "and it is after the break");
  // §12.6 — a rule already running is not cancelled mid way, so its own damage
  // still lands after the break; what stops is every later firing.
  check(
    result.events.some((event) => event.ruleId === "splinter_edge_rule" && event.sequence > broken.sequence),
    "the firing that broke the item still finished",
  );
  check(
    !result.events.some(
      (event) => event.ruleId === "splinter_edge_rule" && event.sequence > overkills[1].sequence,
    ),
    "the broken item supplies nothing to any later event",
  );
  equal(result.equipment[0].durability, 0);
  equal(result.equipment[0].broken, true);
}

// ---- §13 objectives -----------------------------------------------------------

{
  // The reaction to actor_defeated is resolved before the battle can end.
  const result = run(CORE_BATTLE);
  const defeated = first(result, "actor_defeated");
  const scavenge = of(result, "resource_gained").find((event) => event.ruleId === "scavenge_ap_rule");
  const ended = first(result, "battle_ended");
  check(scavenge !== undefined, "the defeat reaction fired");
  check(defeated.sequence < scavenge.sequence, "reaction after the defeat");
  check(scavenge.sequence < ended.sequence, "and before the battle ends");
}

{
  const result = run(DEFINITION_BATTLE);
  equal(result.result, "win");
  equal(result.reason, "objective_met");
  // The objective named a definition; the other enemy is still standing.
  const survivors = result.actors.filter((actor) => actor.side === "enemy" && actor.alive);
  equal(survivors.length, 1);
  equal(survivors[0].definitionId, "husk_bulwark");
}

{
  const result = run(ROUND_LIMIT_BATTLE);
  equal(result.result, "loss");
  equal(result.reason, "round_limit");
  equal(result.roundsUsed, 2);
}

{
  // A battle where nothing can change runs to the round limit. v1 has no
  // stalemate shortcut, on purpose: see the next check.
  const result = run(INERT_BATTLE);
  equal(result.result, "loss");
  equal(result.reason, "round_limit");
  equal(result.roundsUsed, INERT_BATTLE.maxRounds);
  equal(
    of(result, "action_skipped").filter((event) => event.sourceActorId === "a_warden").length,
    INERT_BATTLE.maxRounds,
    "the idle ally recorded one skip per round",
  );
}

{
  // The counter-example that removed the stalemate rule. Rounds 1 and 2 change
  // no hp, barrier, preparation, status or durability, and the tactic is meant
  // to wait for round 3. A stalemate check over those five would have declared
  // a draw before the strike could ever happen.
  const result = run(WAITING_TACTIC_BATTLE);
  const declared = of(result, "action_declared");
  check(declared.length > 0, "the waiting tactic eventually fired");
  equal(declared[0].round, 3, "on the round its condition allows");
  equal(result.result, "win", "and the battle was winnable after the wait");
  check(result.roundsUsed > 2, "which needs more than the two quiet rounds");
  check(
    !result.events.some((event) => event.values.reason === "stalemate"),
    "v1 never reports a stalemate",
  );
}

// ---- §11.6 round end ordering (PREFLIGHT §4) ---------------------------------

{
  // Let the enemy act before the warden in this witness, leaving the round
  // barrier intact so the expiry phase has an observable packet to remove.
  const fieldKitBattle = structuredClone(FIELD_KIT_BATTLE);
  fieldKitBattle.allies[0].position = "front_right";
  const result = run(fieldKitBattle);
  const unused = of(result, "resource_unused").find((event) => event.values.resource === "reaction_points");
  const spent = of(result, "resource_spent").find((event) => event.ruleId === "field_kit_rule");
  const repaired = of(result, "equipment_repaired").find((event) => event.ruleId === "field_kit_rule");
  check(unused !== undefined, "the unused reaction point was reported");
  check(spent.sequence > unused.sequence, "the rule paid after the report");
  equal(spent.values.before, 1, "the point was still there to pay with");
  equal(repaired.values.before, 1, "the kit was one point down");
  equal(repaired.values.amount, 1);
  equal(repaired.values.after, 2, "and it came back to its maximum");
  equal(
    of(result, "equipment_repaired").length,
    1,
    "the second round found nothing to repair: the clamp is maxDurability",
  );
  equal(result.equipment[0].durability, 2);

  const ended = of(result, "round_ended")[0];
  const expired = of(result, "barrier_expired")[0];
  check(ended.sequence < unused.sequence, "round_ended, then the unused report");
  check(unused.sequence < expired.sequence, "then the barrier expiry");
}

{
  // A round barrier created during the round end phase belongs to the round
  // about to start, not to the one being closed. Otherwise "turn the unused
  // action points into a barrier" would expire one step after it was granted.
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.characters.warden.signatureRules = [
    {
      id: "warden_banks_the_rest",
      listenTo: "resource_unused",
      timing: "after",
      priority: 100,
      predicates: [
        { type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 } },
        { type: "event_tag", tag: "action_points", value: true },
      ],
      costs: [],
      effects: [
        {
          type: "gain_barrier",
          target: { scope: "self", take: 1 },
          amount: { type: "event_value_scaled", key: "amount" },
          duration: "round",
        },
      ],
      limit: { scope: "round", count: 1 },
    },
  ];
  const battle = structuredClone(FIELD_KIT_BATTLE);
  battle.allies[0].equipment = [{ instanceId: "e_greaves", equipmentId: "worn_greaves", durability: 2 }];
  // A tactic the front row warden can never use, so the action points are left
  // over for the signature rule to bank.
  battle.allies[0].tactics = [{ activeSkillId: "reposition", useWhen: [] }];
  const result = simulateBattle(battle, bundle);
  const banked = of(result, "barrier_gained").find((event) => event.ruleId === "warden_banks_the_rest");
  check(banked !== undefined, "the leftover action point became a barrier");
  const expiries = of(result, "barrier_expired").filter((event) => event.sequence > banked.sequence);
  check(
    expiries.length === 0 || expiries[0].round > banked.round,
    "and it survived the round end that created it",
  );
}

{
  // §5.6 — a kit that already broke supplies no rules at all, so it cannot mend
  // itself back into the battle.
  const result = run(BROKEN_KIT_BATTLE);
  equal(of(result, "equipment_repaired").length, 0, "a broken item stays broken");
  check(
    !result.events.some((event) => event.ruleId === "field_kit_rule"),
    "and its rule never fires",
  );
  equal(result.equipment[0].durability, 0);
  equal(result.equipment[0].broken, true);
}

// ---- §12.5 movement ------------------------------------------------------------

{
  const result = run(MOVE_BATTLE);
  const moves = of(result, "actor_moved");
  equal(moves.length, 2, "a swap records one event per actor");
  equal(moves[0].chainId, moves[1].chainId, "both in the same chain");
  equal(moves[0].values.from, "rear_left");
  equal(moves[0].values.to, "front_left");
  equal(moves[1].values.from, "front_left");
  equal(moves[1].values.to, "rear_left");
  // No event ever shows two actors on one position: the swap is atomic.
  equal(moves[0].sequence + 1, moves[1].sequence);
  const barriers = of(result, "barrier_gained").filter((event) => event.ruleId === "guard_step_rule");
  equal(barriers.length, 2, "both movers answered their own actor_moved");
  assert.deepEqual(barriers.map((event) => event.targetActorIds[0]), ["a_scout", "a_warden"]);
  checks += 1;
}

// ---- §15.4 statuses -------------------------------------------------------------

{
  const result = run(STATUS_BATTLE);
  // The negative status raises what its holder is about to take.
  const raised = of(result, "damage_taken").find(
    (event) => event.sourceActorId === "e_husk" && event.round === 1,
  );
  equal(raised.values.proposed, 5, "4 proposed plus 1 from the status");
  equal(first(result, "damage_proposed").values.amount, 4, "the event keeps the fact it recorded");

  // The positive status raises the holder's own damage and then removes itself.
  const empowered = of(result, "damage_taken").find((event) => event.sourceActorId === "a_lancer");
  equal(empowered.values.proposed, 5);
  const removal = of(result, "status_removed").find((event) => event.ruleId === "focused_damage_rule");
  check(removal !== undefined, "the positive status consumed itself");
  equal(removal.values.cause, "effect");

  // A round duration status is gone by the next round.
  const expiry = of(result, "status_removed").find((event) => event.values.cause === "duration");
  equal(expiry.values.statusId, "exposed");
}

{
  // §15.4 — the positive status raises a barrier too, which needs the barrier
  // proposal event (PREFLIGHT §14).
  const result = run(FOCUSED_BARRIER_BATTLE);
  const proposed = of(result, "barrier_proposed").find((event) => event.skillId === "bulwark");
  const gained = of(result, "barrier_gained").find((event) => event.skillId === "bulwark");
  equal(proposed.values.amount, 3, "the proposal keeps the fact it recorded");
  equal(gained.values.amount, 4, "the packet carries the raised amount");
  equal(gained.values.proposed, 3);
  const removal = of(result, "status_removed").find((event) => event.ruleId === "focused_barrier_rule");
  check(removal !== undefined, "and the status consumed itself");
}

{
  // §1.2 — a rule that changes a pending amount has to be findable in the
  // event列. The number alone does not say whose rule moved it.
  for (const [battle, ruleId, before, after] of [
    [STATUS_BATTLE, "exposed_rule", 4, 5],
    [FOCUSED_BARRIER_BATTLE, "focused_barrier_rule", 3, 4],
  ]) {
    const result = run(battle);
    const record = of(result, "pending_amount_modified").find((event) => event.ruleId === ruleId);
    check(record !== undefined, `${ruleId} left a record of the change`);
    equal(record.values.before, before);
    equal(record.values.after, after);
    equal(record.values.delta, after - before);
    equal(record.values.operation, "increase");
    check(record.sourceDefinitionId !== undefined, "and says which definition it came from");
    const proposal = result.events.find((event) => event.id === record.values.proposalEventId);
    check(proposal !== undefined, "and points at the proposal it changed");
    equal(proposal.values.amount, before);
  }

  // Nothing may listen to it: a reaction there would fire inside somebody
  // else's interrupt window.
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.reactiveSkills.counter_blow.rule.listenTo = "pending_amount_modified";
  const errors = validateContentBundle(bundle);
  check(
    errors.some((error) => error.code === "non_listenable_event"),
    "pending_amount_modified is a record, not a hook",
  );
}

// ---- PREFLIGHT §7 region rules --------------------------------------------------

{
  const result = run(REGION_BATTLE);
  const regionDamage = of(result, "damage_proposed").find((event) => event.ruleId === "region_dust");
  check(regionDamage !== undefined, "the region rule fired");
  equal(regionDamage.sourceActorId, undefined, "a region rule has no source actor");
  equal(regionDamage.targetActorIds[0], "a_warden", "allies means the ally side");
  equal(of(result, "damage_proposed").filter((event) => event.ruleId === "region_dust").length, 1);
}

// ---- §9 implicit sort and §8 integer hp_percent ---------------------------------

{
  const result = run(FULL_PARTY_BATTLE);
  const firstStrike = of(result, "target_selected").find((event) => event.skillId === "strike");
  equal(firstStrike.targetActorIds[0], "e_warden", "the lowest hp enemy is chosen first");

  // Two enemies with identical hp: the pick is decided by position, never by the
  // order they happened to be listed in. Reversing the input changes nothing.
  const tieBattle = structuredClone(ROUND_LIMIT_BATTLE);
  tieBattle.enemies = [
    { instanceId: "e_right", enemyActorId: "husk", position: "front_right" },
    { instanceId: "e_left", enemyActorId: "husk", position: "front_left" },
  ];
  const tie = simulateBattle(tieBattle, FIXTURE_CONTENT);
  equal(
    of(tie, "target_selected").find(
      (event) => event.skillId === "strike" && event.sourceActorId === "a_warden",
    ).targetActorIds[0],
    "e_left",
    "front_left wins the tie",
  );
  const reversed = structuredClone(tieBattle);
  reversed.enemies.reverse();
  equal(
    of(simulateBattle(reversed, FIXTURE_CONTENT), "target_selected").find(
      (event) => event.skillId === "strike" && event.sourceActorId === "a_warden",
    ).targetActorIds[0],
    "e_left",
    "and the listing order does not matter",
  );
}

{
  // hp_percent compares hp * 100 with maxHp * threshold, so a 50% threshold on
  // an odd maximum has no float rounding to argue about.
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.activeSkills.strike.intrinsicPredicates = [
    { type: "hp_percent", subject: "self", op: "lte", value: 50 },
  ];
  const battle = structuredClone(ROUND_LIMIT_BATTLE);
  battle.allies[0].hp = 10; // exactly 50% of 20
  const atThreshold = simulateBattle(battle, bundle);
  check(
    of(atThreshold, "action_declared").some((event) => event.skillId === "strike"),
    "hp exactly at the threshold satisfies lte",
  );
  battle.allies[0].hp = 11; // just above
  const above = simulateBattle(battle, bundle);
  check(
    of(above, "action_declared").length === 0,
    "one point above the threshold does not",
  );
}

// ---- §11.2 side phases and formation order ----------------------------------------

{
  const positionOrder = (content) =>
    simulateBattle(POSITION_ORDER_BATTLE, content).events
      .filter((event) => event.type === "actor_activated"
        && event.round === 1
        && event.values.activation === 1)
      .map((event) => event.sourceActorId);
  const expected = [
    "a_front_center",
    "a_front_right",
    "a_rear_left",
    "e_front_left",
    "e_rear_center",
    "e_rear_right",
  ];

  assert.deepEqual(
    positionOrder(FIXTURE_CONTENT),
    expected,
    "formation order is front row, then rear row, left to right",
  );
  checks += 1;

  const result = simulateBattle(POSITION_ORDER_BATTLE, FIXTURE_CONTENT);
  assert.ok(
    result.actors.every((actor) => !Object.hasOwn(actor, "speed")),
    "battle results do not expose the removed speed stat",
  );
  checks += 1;
}

{
  const result = run(SIDE_PHASE_BATTLE);
  const activations = of(result, "actor_activated")
    .filter((event) => event.round === 1)
    .map((event) => event.sourceActorId);
  assert.deepEqual(
    activations,
    ["a_pivot", "a_warden", "e_front", "e_rear", "a_pivot"],
    "AP 2 returns on the next ally pass after the enemy phase",
  );
  checks += 1;
  equal(
    of(result, "actor_activated").filter(
      (event) => event.sourceActorId === "a_pivot" && event.round === 1,
    )[1].values.activation,
    2,
  );
}

// ---- R19（issue #137）技能レベル ------------------------------------------------
//
// **同じ効果の上位互換を別技能として増やさず、一つの技能を段階的に強くする。**
// engine が見るのは ally.skillLevels の表だけで、技能 ID では分岐しない。
{
  const damageOf = (battle) => of(run(battle), "damage_proposed")
    .filter((event) => event.sourceActorId === "a_warden")
    .map((event) => event.values.amount);

  const base = damageOf(CORE_BATTLE);
  check(base.length > 0, "参照の一戦に a_warden の damage が出ている");

  // Lv1 は掛け算そのものが起きない。**レベルを知らない入力と1バイトも変わらない。**
  const atLevelOne = structuredClone(CORE_BATTLE);
  const wardenSkills = atLevelOne.allies
    .find((ally) => ally.instanceId === "a_warden").tactics
    .map((tactic) => tactic.activeSkillId);
  atLevelOne.allies.find((ally) => ally.instanceId === "a_warden").skillLevels =
    Object.fromEntries(wardenSkills.map((skillId) => [skillId, 1]));
  assert.deepEqual(damageOf(atLevelOne), base, "Lv1 は既定と同じ結果になる");
  checks += 1;

  // 段が上がるぶんだけ、連続量だけが上がる。
  const lifted = structuredClone(CORE_BATTLE);
  lifted.allies.find((ally) => ally.instanceId === "a_warden").skillLevels =
    Object.fromEntries(wardenSkills.map((skillId) => [skillId, 5]));
  const raised = damageOf(lifted);
  check(
    raised.length > 0 && raised[0] > base[0],
    `Lv5 で damage が上がる（${base[0]} → ${raised[0]}）`,
  );
  // 係数は 1 + 0.12 × (level - 1)。round-half-up は values.mjs の一箇所だけで行う。
  equal(raised[0], roundHalfUpDiv(base[0] * (BPS + 4 * SKILL_LEVEL_STEP_BPS), BPS));

  // **掛かるのは、その actor が実際に出したその技能だけ。**使っていない技能へ
  // 段を積んでも、出来事の列は1バイトも変わらない（engine が技能 ID で分岐して
  // いないことの witness でもある）。
  const unused = Object.keys(FIXTURE_CONTENT.activeSkills)
    .find((skillId) => !wardenSkills.includes(skillId));
  check(Boolean(unused), "warden が使っていない技能が fixture にある");
  const elsewhere = structuredClone(CORE_BATTLE);
  elsewhere.allies.find((ally) => ally.instanceId === "a_warden").skillLevels = { [unused]: 10 };
  assert.deepEqual(
    run(elsewhere).events, run(CORE_BATTLE).events,
    "使っていない技能のレベルは出来事の列を変えない",
  );
  checks += 1;
}

// ---- §14 the ordinary fixtures stay far below the caps --------------------------

for (const battle of ALL_FIXTURE_BATTLES) {
  const result = run(battle);
  check(
    result.metrics.eventCount < DEFAULT_OPTIONS.maxEventsPerBattle * 0.1,
    `${battle.battleId} used ${result.metrics.eventCount} events, under 10% of the battle cap`,
  );
  check(
    result.metrics.maxChainEventCount < 256 * 0.1,
    `${battle.battleId} longest chain ${result.metrics.maxChainEventCount}, under 10% of the chain cap`,
  );
}

