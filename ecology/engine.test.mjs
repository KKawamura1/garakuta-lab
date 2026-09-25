// ecology/engine.test.mjs — Gate C.
//
// Determinism, purity, and the meaning of each event. Numbers alone are not
// enough here: most checks assert that a particular event exists, in a
// particular place, with particular values.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RESULT_SCHEMA_VERSION, SKILL_LEVEL_STEP_BPS } from "./schema.mjs";
import { BPS, roundHalfUpDiv } from "./values.mjs";
import { simulateBattle, validateContentBundle } from "./engine.mjs";
import { resolveTargets } from "./selectors.mjs";
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
  const absorbedResult = first(result, "damage_absorbed");
  const taken = of(result, "damage_taken").find(
    (event) => event.sourceActorId === "e_husk" && event.targetActorIds[0] === "a_warden",
  );
  equal(proposed.values.amount, 4);
  equal(absorbed.values.amount, 2, "the barrier ate what it could");
  check(broken.sequence > absorbed.sequence, "the packet breaks after it is emptied");
  equal(absorbedResult.values.amount, 2, "the aggregate absorption is recorded");
  equal(absorbedResult.values.finalDamage, 2, "the remainder is explicit");
  equal(absorbedResult.values.fullyAbsorbed, false, "partial absorption is not called full");
  check(absorbedResult.sequence < taken.sequence, "absorption precedes hp damage");
  equal(taken.values.amount, 2, "the rest reached hp");
  equal(taken.values.barrierAbsorbed, 2);
  equal(taken.values.proposed, 4);
  equal(of(result, "excess_damage").length, 0, "no overkill when the target survives");
}

{
  // §12.3 — earliest expiry first, oldest first inside one expiry. A fully
  // absorbed hit has no damage_taken, but its zero-damage outcome is explicit.
  const result = run(BARRIER_PACKET_BATTLE);
  const absorbed = of(result, "barrier_damaged").filter((event) => event.round === 1);
  equal(absorbed.length, 2, "two packets were touched");
  equal(absorbed[0].values.duration, "round");
  equal(absorbed[1].values.duration, "round");
  equal(absorbed[0].values.amount, 1, "the older round packet went first");
  equal(absorbed[1].values.amount, 3);
  equal(of(result, "damage_taken").filter((event) => event.round === 1).length, 0, "nothing reached hp");
  const absorbedResult = of(result, "damage_absorbed").filter((event) => event.round === 1);
  equal(absorbedResult.length, 1, "the fully absorbed hit has a result record");
  equal(absorbedResult[0].values.amount, 4);
  equal(absorbedResult[0].values.finalDamage, 0);
  equal(absorbedResult[0].values.fullyAbsorbed, true);
  equal(of(result, "damage_proposed").filter((event) => event.round === 1).length, 1, "the proposal is still recorded");
  const secondRound = of(result, "barrier_damaged").filter((event) => event.round === 2);
  equal(secondRound.at(-1).values.duration, "battle", "the battle packet is spent last");
}

{
  // Issue #192 — a later hit in one action does not retarget after its original
  // target is defeated, but it must still explain why that hit did not happen.
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.activeSkills.double_strike = structuredClone(bundle.activeSkills.strike);
  bundle.activeSkills.double_strike.id = "double_strike";
  bundle.activeSkills.double_strike.displayName = "Double Strike (fixture)";
  bundle.activeSkills.double_strike.effects[0].hitCount = 2;
  bundle.activeSkills.double_strike.effects[0].amount = { type: "constant", value: 6 };
  const battle = {
    schemaVersion: BARRIER_PACKET_BATTLE.schemaVersion,
    battleId: "issue192_damage_skip",
    maxRounds: 1,
    objective: { type: "eliminate_all_enemies" },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      tactics: [{ activeSkillId: "double_strike", useWhen: [] }],
      reactiveSkillIds: [],
      equipment: [],
    }],
    enemies: [{ instanceId: "e_husk", enemyActorId: "husk", position: "front_left", hp: 4 }],
  };
  const result = simulateBattle(battle, bundle);
  const skipped = of(result, "damage_skipped");
  equal(skipped.length, 1, "the defeated target's second hit is logged as skipped");
  equal(skipped[0].targetActorIds[0], "e_husk");
  equal(skipped[0].values.hitIndex, 1);
  equal(skipped[0].values.reason, "target_defeated");
}

{
  // One action plan spans every direct-damage effect in the active skill. The
  // first effect defeats the weakest enemy and adds a status between effects;
  // the later hit slots keep their target and their pre-hit base amount.
  const bundle = structuredClone(FIXTURE_CONTENT);
  const weakestEnemy = {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["hp_asc"],
    take: 1,
  };
  bundle.activeSkills.multi_effect_plan = {
    ...structuredClone(bundle.activeSkills.strike),
    id: "multi_effect_plan",
    displayName: "Multi-effect Plan (fixture)",
    targetQuery: structuredClone(weakestEnemy),
    effects: [
      {
        type: "deal_damage",
        target: structuredClone(weakestEnemy),
        amount: { type: "constant", value: 4 },
        reach: "unrestricted",
        tags: ["attack", "fixture"],
      },
      { type: "add_status", target: { scope: "self", take: 1 }, statusId: "exposed", stacks: 1 },
      {
        type: "deal_damage",
        target: structuredClone(weakestEnemy),
        amount: { type: "status_stacks_scaled", subject: "self", statusId: "exposed" },
        hitCount: 2,
        reach: "unrestricted",
        tags: ["attack", "fixture"],
      },
    ],
  };
  const battle = {
    schemaVersion: CORE_BATTLE.schemaVersion,
    battleId: "action_plan_spans_damage_effects",
    maxRounds: 1,
    objective: { type: "eliminate_all_enemies" },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      tactics: [{ activeSkillId: "multi_effect_plan", useWhen: [] }],
      reactiveSkillIds: [],
      equipment: [],
    }],
    enemies: [
      { instanceId: "e_first", enemyActorId: "husk", position: "front_left", hp: 3 },
      { instanceId: "e_second", enemyActorId: "husk", position: "front_right", hp: 10 },
    ],
  };

  const result = simulateBattle(battle, bundle);
  const planEvents = result.events.filter((event) => (
    ["damage_proposed", "damage_skipped"].includes(event.type)
      && event.sourceActorId === "a_warden"
      && event.skillId === "multi_effect_plan"
  ));
  const firstEffectHit = planEvents.find((event) => event.values.effectIndex === 0);
  const laterEffectSlots = planEvents.filter((event) => event.values.effectIndex === 2);
  check(firstEffectHit, "the first planned damage effect fires");
  equal(firstEffectHit.targetActorIds[0], "e_first");
  equal(laterEffectSlots.length, 2, "the later effect keeps both planned hit slots");
  check(
    laterEffectSlots.every((event) => (
      event.type === "damage_skipped"
        && event.targetActorIds[0] === "e_first"
        && event.values.reason === "target_defeated"
        && event.values.plannedAmount === 0
    )),
    "later hits keep the defeated target and the zero base amount from before the new status",
  );
  check(
    planEvents.every((event) => event.values.actionPlanId === firstEffectHit.values.actionPlanId),
    "all damage effects carry the same action plan id",
  );
  equal(firstEffectHit.values.actionTargetCount, 1, "the plan retains the selected action target count");
  equal(firstEffectHit.values.plannedTargetCount, 1, "the action plan counts distinct recipients once");
  equal(firstEffectHit.values.baseHitCount, 1);
  equal(laterEffectSlots[0].values.baseHitCount, 2);
  check(
    result.actors.find((actor) => actor.instanceId === "a_warden").statuses.some((status) => (
      status.statusId === "exposed" && status.stacks === 1
    )),
    "the intervening status effect really applied after the plan was fixed",
  );
  equal(result.actors.find((actor) => actor.instanceId === "e_second").hp, 10);
}

{
  // action_declared reactions may move a frontline actor before a melee
  // action chooses its target. The target_selected window then reacts to that
  // post-movement choice, and action_started uses the redirected final target.
  const bundle = structuredClone(FIXTURE_CONTENT);
  const lowHealthEnemy = {
    scope: "enemies",
    filters: [
      { type: "alive" },
      { type: "hp_percent", op: "lte", value: 50 },
    ],
    sort: ["position_asc"],
    take: 1,
  };
  bundle.activeSkills.strike.targetQuery = structuredClone(lowHealthEnemy);
  bundle.activeSkills.strike.tags = [...bundle.activeSkills.strike.tags, "pretarget_fixture"];
  bundle.activeSkills.strike.effects[0] = {
    ...bundle.activeSkills.strike.effects[0],
    target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
    reach: "melee",
  };
  bundle.enemyReactiveSkills.move_before_target = {
    id: "move_before_target",
    displayName: "Move Before Target (fixture)",
    tags: ["reaction", "fixture"],
    rule: {
      id: "move_before_target_rule",
      listenTo: "action_declared",
      timing: "interrupt",
      priority: 100,
      predicates: [{ type: "event_tag", tag: "pretarget_fixture", value: true }],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "swap_positions",
        target: { scope: "self", filters: [{ type: "alive" }], take: 1 },
        otherTarget: {
          scope: "allies",
          filters: [{ type: "alive" }, { type: "not_self" }],
          sort: ["position_asc"],
          take: 1,
        },
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  };
  bundle.enemyReactiveSkills.cover_after_move = {
    id: "cover_after_move",
    displayName: "Cover After Move (fixture)",
    tags: ["reaction", "fixture"],
    rule: {
      id: "cover_after_move_rule",
      listenTo: "target_selected",
      timing: "interrupt",
      priority: 100,
      predicates: [{ type: "event_tag", tag: "pretarget_fixture", value: true }],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "redirect_pending_target",
        target: { scope: "self", filters: [{ type: "alive" }], take: 1 },
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  };
  bundle.enemyReactiveSkills.mark_front_mover = {
    id: "mark_front_mover",
    displayName: "Mark Front Mover (fixture)",
    tags: ["reaction", "fixture"],
    rule: {
      id: "mark_front_mover_rule",
      listenTo: "actor_moved",
      timing: "after",
      priority: 100,
      predicates: [
        { type: "event_tag", tag: "swap", value: true },
        {
          type: "target_exists",
          query: {
            scope: "event_targets",
            filters: [{ type: "alive" }, { type: "row_is", row: "front" }],
            take: 1,
          },
        },
      ],
      costs: [],
      effects: [{
        type: "add_status",
        target: {
          scope: "event_targets",
          filters: [{ type: "alive" }, { type: "row_is", row: "front" }],
          take: 1,
        },
        statusId: "exposed",
        stacks: 1,
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  };
  bundle.enemyActors.target_shifter = {
    ...structuredClone(bundle.enemyActors.husk),
    id: "target_shifter",
    displayName: "Target Shifter (fixture)",
    baseReactionPoints: 2,
    reactiveSkillIds: ["move_before_target", "cover_after_move", "mark_front_mover"],
  };

  const battle = {
    schemaVersion: CORE_BATTLE.schemaVersion,
    battleId: "action_plan_target_after_movement",
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      tactics: [{ activeSkillId: "strike", useWhen: [] }],
      reactiveSkillIds: [],
      equipment: [],
    }],
    enemies: [
      { instanceId: "e_shifter", enemyActorId: "target_shifter", position: "front_left", hp: 10 },
      { instanceId: "e_low", enemyActorId: "husk", position: "rear_left", hp: 4 },
    ],
  };

  const result = simulateBattle(battle, bundle);
  const declared = of(result, "action_declared").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const moved = of(result, "actor_moved").filter(
    (event) => event.sourceActorId === "e_shifter" && event.parentEventId === declared.id,
  );
  const selected = of(result, "target_selected").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const marked = of(result, "status_added").find(
    (event) => event.sourceActorId === "e_shifter"
      && event.targetActorIds[0] === "e_low"
      && event.values.statusId === "exposed",
  );
  const changed = of(result, "target_changed").find(
    (event) => event.values.from === "e_low" && event.targetActorIds[0] === "e_shifter",
  );
  const started = of(result, "action_started").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const hit = of(result, "damage_proposed").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );

  check(declared, "the melee action is still declared when only an unrestricted target exists");
  equal(declared.values.targetCount, 0, "no target was in melee reach before the movement window");
  equal(moved.length, 2, "the declared-action interrupt moves the front and rear enemies");
  check(moved[1].sequence < selected.sequence, "both move events finish before target selection");
  check(marked.sequence < selected.sequence, "the movement after-reaction resolves before target selection");
  equal(selected.targetActorIds[0], "e_low", "the low-health enemy is selected after moving to the front");
  check(selected.sequence < changed.sequence, "the target reaction follows the post-movement selection");
  equal(changed.values.from, "e_low");
  equal(changed.targetActorIds[0], "e_shifter");
  equal(started.targetActorIds[0], "e_shifter", "the attack starts against the final redirected target");
  equal(hit.targetActorIds[0], "e_shifter", "damage follows the resolved target through ActionPlan");
  check(started.sequence < hit.sequence, "ActionPlan damage is created after target reactions finish");

  const noMovementBundle = structuredClone(bundle);
  noMovementBundle.enemyActors.target_shifter.reactiveSkillIds = [
    "cover_after_move",
    "mark_front_mover",
  ];
  const withoutMovementWindow = simulateBattle(battle, noMovementBundle);
  check(
    !of(withoutMovementWindow, "action_declared").some(
      (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
    ),
    "an out-of-reach target alone does not trigger a phantom action declaration",
  );

  // A swap rule whose selectors cannot find a partner is not an available
  // pre-target movement response. It must not declare the action or spend RP.
  const noSwapPartnerBundle = structuredClone(bundle);
  noSwapPartnerBundle.enemyReactiveSkills.move_before_target.rule.effects[0].otherTarget.filters.push(
    { type: "row_is", row: "front" },
  );
  const withoutSwapPartner = simulateBattle(battle, noSwapPartnerBundle);
  check(
    !of(withoutSwapPartner, "action_declared").some(
      (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
    ),
    "a swap response without a valid partner does not enable a phantom declaration",
  );
  check(
    !of(withoutSwapPartner, "resource_spent").some(
      (event) => event.sourceActorId === "e_shifter" && event.ruleId === "move_before_target_rule",
    ),
    "a swap response without a valid partner spends no reaction point",
  );
}

{
  // Attack-start interrupts run after target/AP fixation and before the main
  // effect list can freeze its ActionPlan.
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.activeSkills.strike.tags = [...bundle.activeSkills.strike.tags, "attack_start_fixture"];
  bundle.activeSkills.strike.effects = [{
    type: "deal_damage",
    target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
    amount: { type: "status_stacks_scaled", subject: "self", statusId: "focused" },
    reach: "unrestricted",
    tags: ["attack", "fixture"],
  }];
  bundle.enemyReactiveSkills.after_target_selected = {
    id: "after_target_selected",
    displayName: "After Target Selected (fixture)",
    tags: ["reaction", "fixture"],
    rule: {
      id: "after_target_selected_rule",
      listenTo: "target_selected",
      timing: "after",
      priority: 100,
      predicates: [{ type: "event_tag", tag: "attack_start_fixture", value: true }],
      costs: [],
      effects: [{
        type: "add_status",
        target: { scope: "event_source", filters: [{ type: "alive" }], take: 1 },
        statusId: "exposed",
        stacks: 1,
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  };
  bundle.enemyReactiveSkills.start_focus = {
    id: "start_focus",
    displayName: "Start Focus (fixture)",
    tags: ["reaction", "fixture"],
    rule: {
      id: "start_focus_rule",
      listenTo: "action_started",
      timing: "interrupt",
      priority: 100,
      predicates: [{ type: "event_tag", tag: "attack_start_fixture", value: true }],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{
        type: "add_status",
        target: { scope: "event_source", filters: [{ type: "alive" }], take: 1 },
        statusId: "focused",
        stacks: 1,
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  };
  bundle.enemyActors.start_focus_enemy = {
    ...structuredClone(bundle.enemyActors.still_husk),
    id: "start_focus_enemy",
    displayName: "Start Focus Enemy (fixture)",
    baseReactionPoints: 1,
    reactiveSkillIds: ["after_target_selected", "start_focus"],
  };
  const battle = {
    schemaVersion: CORE_BATTLE.schemaVersion,
    battleId: "attack_start_reaction_precedes_action_plan",
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      tactics: [{ activeSkillId: "strike", useWhen: [] }],
      reactiveSkillIds: [],
      equipment: [],
    }],
    enemies: [{
      instanceId: "e_start_focus",
      enemyActorId: "start_focus_enemy",
      position: "front_left",
    }],
  };

  const result = simulateBattle(battle, bundle);
  const selected = of(result, "target_selected").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const started = of(result, "action_started").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const prepared = of(result, "status_added").find(
    (event) => event.sourceActorId === "e_start_focus"
      && event.parentEventId === selected?.id
      && event.targetActorIds[0] === "a_warden"
      && event.values.statusId === "exposed",
  );
  const spent = of(result, "resource_spent").find(
    (event) => event.sourceActorId === "e_start_focus" && event.ruleId === "start_focus_rule",
  );
  const focused = of(result, "status_added").find(
    (event) => event.targetActorIds[0] === "a_warden" && event.values.statusId === "focused",
  );
  const proposed = of(result, "damage_proposed").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const taken = of(result, "damage_taken").find(
    (event) => event.sourceActorId === "a_warden" && event.targetActorIds[0] === "e_start_focus",
  );

  check(started && selected && prepared && spent && focused && proposed && taken,
    "target-selection after-reactions settle before the attack-start response and attack");
  check(selected.sequence < prepared.sequence && prepared.sequence < started.sequence
    && started.sequence < spent.sequence,
  "target-selection after-reactions finish before action_started interrupts");
  check(spent.sequence < focused.sequence && focused.sequence < proposed.sequence,
    "RP payment and response status resolve before the main damage proposal");
  equal(proposed.values.amount, 1, "the ActionPlan reads the status added at attack start");
  equal(taken.values.amount, 2, "the status's ordinary damage interrupt still applies");
  check(!result.actors.find((actor) => actor.instanceId === "a_warden").statuses
    .some((status) => status.statusId === "focused"), "the attack consumes the prepared status");

  // A target-selection after-reaction can defeat the attacker. The main action
  // must cancel before AP payment or the later action_started window.
  const lethalBundle = structuredClone(bundle);
  lethalBundle.enemyReactiveSkills.after_target_selected.rule.effects = [{
    type: "deal_damage",
    target: { scope: "event_source", filters: [{ type: "alive" }], take: 1 },
    amount: { type: "constant", value: 2 },
    reach: "unrestricted",
    tags: ["attack", "fixture"],
  }];
  const lethalBattle = structuredClone(battle);
  lethalBattle.battleId = "target_selected_after_reaction_defeats_actor";
  lethalBattle.allies[0].hp = 1;
  const lethalResult = simulateBattle(lethalBattle, lethalBundle);
  const targetSelectionHit = of(lethalResult, "damage_taken").find(
    (event) => event.sourceActorId === "e_start_focus"
      && event.targetActorIds[0] === "a_warden",
  );
  const targetSelectionDefeat = of(lethalResult, "actor_defeated").find(
    (event) => event.targetActorIds[0] === "a_warden",
  );
  const canceledBeforeStart = of(lethalResult, "action_canceled").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  check(targetSelectionHit && targetSelectionDefeat && canceledBeforeStart,
    "a defeated attacker is canceled after target-selection after-reactions");
  check(targetSelectionHit.sequence < targetSelectionDefeat.sequence
    && targetSelectionDefeat.sequence < canceledBeforeStart.sequence,
  "target-selection damage resolves before action cancellation");
  check(!of(lethalResult, "action_started").some(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  ), "a defeated attacker does not enter the attack-start window");
  check(!of(lethalResult, "action_cost_paid").some(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  ), "AP is not paid when the attacker is defeated before action_started");
}

{
  // A failed higher-priority cost leaves the same actor's window open. The
  // successful counter defeats the attacker, so the fixed primary target takes
  // no damage and the already-paid AP is not refunded.
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.activeSkills.strike.tags = [...bundle.activeSkills.strike.tags, "attack_start_ko_fixture"];
  bundle.activeSkills.strike.effects[0] = {
    ...bundle.activeSkills.strike.effects[0],
    target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
    amount: { type: "constant", value: 4 },
    reach: "unrestricted",
  };
  const startRule = (id, costs, effects) => ({
    id,
    displayName: id,
    tags: ["reaction", "fixture"],
    rule: {
      id: `${id}_rule`,
      listenTo: "action_started",
      timing: "interrupt",
      priority: 100,
      predicates: [{ type: "event_tag", tag: "attack_start_ko_fixture", value: true }],
      costs,
      effects,
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  });
  bundle.enemyReactiveSkills.start_counter_too_costly = startRule(
    "start_counter_too_costly",
    [{ type: "spend_reaction_points", amount: 2 }],
    [{ type: "add_status", target: { scope: "self", take: 1 }, statusId: "focused", stacks: 1 }],
  );
  bundle.enemyReactiveSkills.start_counter = startRule(
    "start_counter",
    [{ type: "spend_reaction_points", amount: 1 }],
    [{
      type: "deal_damage",
      target: { scope: "event_source", filters: [{ type: "alive" }], take: 1 },
      amount: { type: "constant", value: 2 },
      reach: "unrestricted",
      tags: ["attack", "counter", "fixture"],
    }],
  );
  bundle.enemyActors.start_counter_enemy = {
    ...structuredClone(bundle.enemyActors.still_husk),
    id: "start_counter_enemy",
    displayName: "Start Counter Enemy (fixture)",
    baseReactionPoints: 1,
    reactiveSkillIds: ["start_counter_too_costly", "start_counter"],
  };
  const battle = {
    schemaVersion: CORE_BATTLE.schemaVersion,
    battleId: "attack_start_counter_defeats_attacker",
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      hp: 1,
      tactics: [{ activeSkillId: "strike", useWhen: [] }],
      reactiveSkillIds: [],
      equipment: [],
    }],
    enemies: [{
      instanceId: "e_start_counter",
      enemyActorId: "start_counter_enemy",
      position: "front_left",
    }],
  };

  const result = simulateBattle(battle, bundle);
  const started = of(result, "action_started").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const counterPayment = of(result, "resource_spent").find(
    (event) => event.sourceActorId === "e_start_counter" && event.ruleId === "start_counter_rule",
  );
  const failedPayment = of(result, "resource_spent").find(
    (event) => event.sourceActorId === "e_start_counter"
      && event.ruleId === "start_counter_too_costly_rule",
  );
  const counterHit = of(result, "damage_taken").find(
    (event) => event.sourceActorId === "e_start_counter" && event.targetActorIds[0] === "a_warden",
  );
  const defeated = of(result, "actor_defeated").find(
    (event) => event.targetActorIds[0] === "a_warden",
  );
  const canceled = of(result, "action_canceled").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );

  check(started && counterPayment && counterHit && defeated && canceled,
    "the attack-start counter defeats the acting ally and cancels the main action");
  check(!failedPayment, "the unaffordable priority candidate spends no RP");
  check(started.sequence < counterPayment.sequence && counterPayment.sequence < counterHit.sequence,
    "the successful fallback counter resolves inside the attack-start window");
  check(counterHit.sequence < defeated.sequence && defeated.sequence < canceled.sequence,
    "the main action is canceled after the counter defeats its source");
  equal(canceled.targetActorIds[0], "e_start_counter", "the already selected target stays fixed");
  equal(canceled.values.reason, "rule", "the response is recorded as a reaction cancellation");
  check(
    !of(result, "damage_proposed").some(
      (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
    ),
    "the primary strike has no damage event after its actor is defeated",
  );
  equal(result.actors.find((actor) => actor.instanceId === "a_warden").actionPoints, 0,
    "action points paid before the attack-start window are not refunded");
}

{
  // A single-target action gets one shared secondary-target window after the
  // attack-start responses and before the ActionPlan fixes its recipients.
  const makeBundle = () => {
    const bundle = structuredClone(FIXTURE_CONTENT);
    bundle.activeSkills.strike.targetQuery = {
      scope: "enemies",
      filters: [{ type: "alive" }],
      sort: ["hp_asc"],
      take: 1,
    };
    bundle.activeSkills.strike.tags = ["attack", "secondary_target_fixture"];
    bundle.activeSkills.strike.effects = [{
      type: "deal_damage",
      target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
      amount: { type: "constant", value: 4 },
      reach: "unrestricted",
      tags: ["attack", "secondary_target_fixture"],
    }];
    const expansion = (id, targetPattern, amount, rpCost) => ({
      id,
      displayName: `${id} (fixture)`,
      tags: ["reaction", "fixture"],
      rule: {
        id: `${id}_rule`,
        listenTo: "action_targets_expanding",
        timing: "interrupt",
        priority: 100,
        predicates: [{ type: "event_tag", tag: "secondary_target_fixture", value: true }],
        costs: [{ type: "spend_reaction_points", amount: rpCost }],
        effects: [{
          type: "add_action_damage",
          target: { scope: "enemies", filters: [{ type: "alive" }], take: "all" },
          targetPattern,
          amount: { type: "constant", value: amount },
          tags: ["attack", "secondary_target_fixture"],
        }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      },
    });
    bundle.reactiveSkills.expand_adjacent = expansion("expand_adjacent", "adjacent", 3, 2);
    bundle.reactiveSkills.expand_row = expansion("expand_row", "row", 2, 1);
    bundle.reactiveSkills.expand_column = expansion("expand_column", "column", 5, 1);
    return bundle;
  };
  const makeBattle = (enemies, reactiveSkillIds = ["expand_adjacent", "expand_row", "expand_column"]) => ({
    schemaVersion: CORE_BATTLE.schemaVersion,
    battleId: "single_target_secondary_expansion",
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      tactics: [{ activeSkillId: "strike", useWhen: [] }],
      reactiveSkillIds,
      equipment: [],
    }],
    enemies,
  });
  const enemy = (instanceId, position, hp = 10) => ({
    instanceId,
    enemyActorId: "still_husk",
    position,
    hp,
  });

  const bundle = makeBundle();
  const battle = makeBattle([
    enemy("e_primary", "front_center", 8),
    enemy("e_left", "front_left"),
    enemy("e_right", "front_right"),
    enemy("e_rear", "rear_center"),
  ]);
  const result = simulateBattle(battle, bundle);
  const started = of(result, "action_started").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const expanding = of(result, "action_targets_expanding").find(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const rowPayment = of(result, "resource_spent").find(
    (event) => event.sourceActorId === "a_warden" && event.ruleId === "expand_row_rule",
  );
  const damage = of(result, "damage_proposed").filter(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  const primaryDamage = damage.find((event) => event.targetActorIds[0] === "e_primary");
  const sideDamage = damage.filter((event) => ["e_left", "e_right"].includes(event.targetActorIds[0]));

  check(started && expanding && rowPayment && primaryDamage,
    "the selected attack reaches the target-expansion response window");
  check(started.sequence < expanding.sequence && expanding.sequence < rowPayment.sequence,
    "attack-start responses settle before secondary-target responses");
  equal(expanding.targetActorIds[0], "e_primary", "the expansion event keeps the fixed primary target");
  equal(expanding.values.baseTargetCount, 1);
  equal(expanding.values.baseHitCount, 1);
  check(!of(result, "resource_spent").some(
    (event) => event.sourceActorId === "a_warden" && event.ruleId === "expand_adjacent_rule",
  ), "an unaffordable higher-priority expansion spends no RP");
  equal(sideDamage.length, 2, "the first affordable row expansion adds both other enemies in the row");
  check(sideDamage.every((event) => event.values.amount === 2), "added packets use their configured fragment amount");
  check(sideDamage.every((event) => event.values.actionPlanId === primaryDamage.values.actionPlanId),
    "primary and expanded damage share one ActionPlan");
  check(damage.every((event) => event.values.plannedTargetCount === 3),
    "the frozen recipient count includes unique secondary targets");
  check(!damage.some((event) => event.targetActorIds[0] === "e_rear"),
    "a later column expansion does not stack onto the same action");

  const noRowResult = simulateBattle(
    makeBattle([enemy("e_primary", "front_center", 8), enemy("e_rear", "rear_center")]),
    bundle,
  );
  const columnPayment = of(noRowResult, "resource_spent").find(
    (event) => event.sourceActorId === "a_warden" && event.ruleId === "expand_column_rule",
  );
  const noRowDamage = of(noRowResult, "damage_proposed").filter(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  check(columnPayment, "a candidate with no eligible adjacent or row target leaves priority open");
  check(!of(noRowResult, "resource_spent").some(
    (event) => event.sourceActorId === "a_warden" && event.ruleId === "expand_row_rule",
  ), "an expansion with no secondary target spends no RP");
  check(noRowDamage.some((event) => event.targetActorIds[0] === "e_rear" && event.values.amount === 5),
    "the next valid column expansion registers its own damage fragment");

  const adjacentResult = simulateBattle(
    makeBattle([
      enemy("e_primary", "front_left", 8),
      enemy("e_adjacent", "front_center"),
      enemy("e_distant", "front_right"),
    ], ["expand_adjacent"]),
    {
      ...bundle,
      reactiveSkills: {
        ...bundle.reactiveSkills,
        expand_adjacent: {
          ...bundle.reactiveSkills.expand_adjacent,
          rule: {
            ...bundle.reactiveSkills.expand_adjacent.rule,
            costs: [{ type: "spend_reaction_points", amount: 1 }],
          },
        },
      },
    },
  );
  const adjacentDamage = of(adjacentResult, "damage_proposed").filter(
    (event) => event.sourceActorId === "a_warden" && event.skillId === "strike",
  );
  check(adjacentDamage.some((event) => event.targetActorIds[0] === "e_adjacent" && event.values.amount === 3),
    "adjacent expansion reaches the neighboring column");
  check(!adjacentDamage.some((event) => event.targetActorIds[0] === "e_distant"),
    "adjacent expansion leaves a non-neighbor in the same row untouched");

  // The additional amount is locked before RP is paid. Warden has one RP, so
  // recomputing this value after the one-point cost would incorrectly produce 0.
  const rpScaledBundle = makeBundle();
  rpScaledBundle.reactiveSkills.expand_adjacent.rule.costs = [
    { type: "spend_reaction_points", amount: 1 },
  ];
  rpScaledBundle.reactiveSkills.expand_adjacent.rule.effects[0].amount = {
    type: "actor_stat_scaled",
    subject: "self",
    stat: "reaction_points",
  };
  const rpScaledResult = simulateBattle(
    makeBattle([
      enemy("e_primary", "front_center", 8),
      enemy("e_adjacent", "front_left"),
    ], ["expand_adjacent"]),
    rpScaledBundle,
  );
  const rpScaledPacket = of(rpScaledResult, "damage_proposed").find(
    (event) => event.sourceActorId === "a_warden"
      && event.skillId === "strike"
      && event.targetActorIds[0] === "e_adjacent",
  );
  check(rpScaledPacket, "an RP-scaled fragment survives the RP payment that powers it");
  equal(rpScaledPacket.values.amount, 1, "the fragment uses the pre-payment RP snapshot");
}

{
  // A reactive damage sequence gets its own target count, not the number of
  // actors selected by the event that triggered it.
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.reactiveSkills.counter_on_target_selection = {
    id: "counter_on_target_selection",
    displayName: "Counter on Target Selection (fixture)",
    rule: {
      id: "counter_on_target_selection_rule",
      listenTo: "target_selected",
      timing: "interrupt",
      priority: 100,
      predicates: [{
        type: "target_exists",
        query: {
          scope: "enemies",
          filters: [{ type: "is_event_source" }, { type: "alive" }],
          take: 1,
        },
      }],
      costs: [],
      effects: [{
        type: "deal_damage",
        target: { scope: "event_source", filters: [{ type: "alive" }], take: 1 },
        amount: { type: "constant", value: 1 },
        tags: ["counter", "fixture"],
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
    tags: ["reaction", "fixture"],
  };

  const battle = structuredClone(CORE_BATTLE);
  battle.battleId = "action_plan_rule_target_count";
  battle.maxRounds = 1;
  battle.objective = { type: "survive_rounds", rounds: 1 };
  for (const ally of battle.allies) {
    ally.tactics = [{ activeSkillId: "bulwark", useWhen: [] }];
    ally.reactiveSkillIds = [];
  }
  battle.allies[0].reactiveSkillIds = ["counter_on_target_selection"];

  const enemySkillId = bundle.enemyActors.husk.tactics[0].activeSkillId;
  bundle.enemyActiveSkills[enemySkillId].targetQuery = {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: "all",
  };

  const result = simulateBattle(battle, bundle);
  const enemyAction = of(result, "target_selected").find((event) => event.sourceActorId === "e_husk");
  const counterDamage = of(result, "damage_proposed").find((event) => (
    event.ruleId === "counter_on_target_selection_rule"
  ));
  check(enemyAction, "the enemy action starts");
  check(enemyAction.targetActorIds.length > 1, "the triggering action selects multiple allies");
  check(counterDamage, "the reactive rule deals damage to the event source");
  equal(counterDamage.values.actionTargetCount, 1, "the reactive plan has one base target");
  equal(counterDamage.values.baseTargetCount, 1);
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

// ---- §12.2 recovery window --------------------------------------------------

{
  const result = run(BARRIER_PARTIAL_BATTLE, { captureReplaySnapshots: true });
  const taken = first(result, "damage_taken");
  const afterDamage = result.replaySnapshots[taken.sequence].find((actor) => actor.instanceId === taken.targetActorIds[0]);
  equal(afterDamage.recoverableDamage, taken.values.amount, "only HP damage opens the recovery window");
  const closed = first(result, "recovery_window_closed");
  equal(closed.values.remaining, taken.values.amount, "the unused window is committed at the next boundary");
  const afterClose = result.replaySnapshots[closed.sequence].find((actor) => actor.instanceId === taken.targetActorIds[0]);
  equal(afterClose.recoverableDamage, 0, "the red recoverable segment disappears when the window closes");
}

{
  const content = structuredClone(FIXTURE_CONTENT);
  content.reactiveSkills.test_recovery = { id: "test_recovery", displayName: "Test Recovery", tags: ["reaction", "care"], rule: {
    id: "test_recovery_rule", listenTo: "damage_taken", timing: "after", priority: 1,
    predicates: [{ type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 } }],
    costs: [], effects: [{ type: "heal", target: { scope: "self", filters: [{ type: "alive" }], take: 1 }, amount: { type: "constant", value: 2 }, tags: ["care"] }], limit: { scope: "chain", count: 1 },
  }};
  const battle = structuredClone(CORE_BATTLE);
  battle.maxRounds = 1; battle.objective = { type: "survive_rounds", rounds: 1 };
  // Start at full HP so unrecoverableDamage measures only this attack's unhealed remainder.
  battle.allies = [{ ...battle.allies.find((actor) => actor.instanceId === "a_mender"), hp: 14, position: "front_left", tactics: [{ activeSkillId: "strike", useWhen: [] }], reactiveSkillIds: ["test_recovery"] }];
  battle.enemies = [{ ...battle.enemies[0], hp: 10, position: "front_left" }];
  const partial = simulateBattle(battle, content, { captureReplaySnapshots: true });
  const partialApplied = of(partial, "healing_applied").find((event) => event.ruleId === "test_recovery_rule");
  equal(partialApplied.values.actual, 2, "a partial recovery records the applied amount");
  const afterPartial = partial.replaySnapshots[partialApplied.sequence]
    .find((actor) => actor.instanceId === "a_mender");
  equal(afterPartial.recoveredDamage, 2, "the healed part is carried separately");
  equal(afterPartial.recoverableDamage, 2, "the remaining red segment is preserved");
  equal(afterPartial.unrecoverableDamage, 0, "no part is black before the recovery window closes");
  const partialClosed = of(partial, "recovery_window_closed")
    .find((event) => event.targetActorIds.includes("a_mender") && event.values.remaining === 2);
  const afterPartialClosed = partial.replaySnapshots[partialClosed.sequence]
    .find((actor) => actor.instanceId === "a_mender");
  equal(partialClosed.values.unrecoverableDamage, 2, "the closure event records the committed black segment");
  equal(afterPartialClosed.recoverableDamage, 0, "the red segment disappears at the boundary");
  equal(afterPartialClosed.recoveredDamage, 0, "the recovered segment merges into green at the boundary");
  equal(afterPartialClosed.unrecoverableDamage, 2, "the unhealed remainder becomes black");

  content.reactiveSkills.test_recovery.rule.effects[0].amount.value = 99;
  const overflow = simulateBattle(battle, content, { captureReplaySnapshots: true });
  const applied = of(overflow, "healing_applied").find((event) => event.ruleId === "test_recovery_rule");
  equal(applied.values.actual, 4, "a recovery larger than the hit stops at the attack damage");
  equal(applied.values.recoverableAfter, 0, "the entire red segment is consumed by the recovery");
  const afterOverflow = overflow.replaySnapshots[applied.sequence]
    .find((actor) => actor.instanceId === "a_mender");
  equal(afterOverflow.recoveredDamage, 4, "the capped recovery is represented in the darker green segment");
  equal(afterOverflow.recoverableDamage, 0, "no red segment remains after a capped recovery");
  const nextPhase = overflow.events.find((event) =>
    event.sequence > applied.sequence
      && (event.type === "action_started" || event.type === "round_ended")
  );
  check(nextPhase, "a later attack phase or boundary exists for the recovery display reset");
  const afterNextPhase = overflow.replaySnapshots[nextPhase.sequence]
    .find((actor) => actor.instanceId === "a_mender");
  equal(afterNextPhase.recoveredDamage, 0, "the recovered segment resets at the next attack phase");
  equal(afterNextPhase.recoverableDamage, 0, "a fully recovered window leaves no red segment");

  // The cap is party-wide, not one allowance per healing source. A large
  // reactive heal consumes the full damage budget, so its overflow cannot
  // heal an older wound on a different ally in the same chain.
  const partyContent = structuredClone(content);
  const partyBattle = structuredClone(CORE_BATTLE);
  partyBattle.maxRounds = 1;
  partyBattle.objective = { type: "survive_rounds", rounds: 1 };
  partyBattle.allies = [
    {
      ...partyBattle.allies.find((actor) => actor.instanceId === "a_mender"),
      hp: 14,
      position: "front_left",
      tactics: [{ activeSkillId: "strike", useWhen: [] }],
      reactiveSkillIds: ["test_recovery", "overflow_care"],
    },
    {
      ...partyBattle.allies.find((actor) => actor.instanceId === "a_warden"),
      hp: 19,
      position: "rear_left",
      tactics: [],
      reactiveSkillIds: [],
    },
  ];
  partyBattle.enemies = [{ ...partyBattle.enemies[0], hp: 10, position: "front_left" }];
  const partyResult = simulateBattle(partyBattle, partyContent);
  const directPartyHeal = of(partyResult, "healing_applied").find(
    (event) => event.ruleId === "test_recovery_rule",
  );
  const partyDamageChain = directPartyHeal?.chainId;
  const partyHeal = of(partyResult, "healing_applied")
    .filter((event) => event.chainId === partyDamageChain);
  const partyDamage = of(partyResult, "damage_taken")
    .filter((event) => event.chainId === partyDamageChain && !event.tags.includes("cost"))
    .reduce((sum, event) => sum + event.values.amount, 0);
  const partyActual = partyHeal.reduce((sum, event) => sum + event.values.actual, 0);
  equal(partyDamage, 4, "party recovery budget is seeded by the received HP damage");
  equal(partyActual, partyDamage, "all recovery in the chain is capped at party damage");
  const relayedPartyHeal = partyHeal.find((event) => event.ruleId === "overflow_care_rule");
  equal(relayedPartyHeal.values.actual, 0, "overflow cannot spend a second party-wide allowance");
}

// A pending damage split runs before the original packet is applied. The
// mitigation amount is leveled, while the transferred share is intentionally
// not; the transferred packet still uses the ordinary damage pipeline.
{
  const content = structuredClone(FIXTURE_CONTENT);
  content.enemyActiveSkills.foe_action_heavy_split = structuredClone(
    content.enemyActiveSkills.foe_action_strike,
  );
  content.enemyActiveSkills.foe_action_heavy_split.id = "foe_action_heavy_split";
  content.enemyActiveSkills.foe_action_heavy_split.displayName = "Heavy Split (fixture)";
  content.enemyActiveSkills.foe_action_heavy_split.effects[0].amount = { type: "constant", value: 20 };
  content.enemyActors.split_husk = structuredClone(content.enemyActors.husk);
  content.enemyActors.split_husk.id = "split_husk";
  content.enemyActors.split_husk.displayName = "Split Husk (fixture)";
  content.enemyActors.split_husk.maxHp = 100;
  content.enemyActors.split_husk.tactics = [{ activeSkillId: "foe_action_heavy_split", useWhen: [] }];

  const otherAlly = {
    type: "target_exists",
    query: {
      scope: "allies",
      filters: [{ type: "alive" }, { type: "not_self" }, { type: "is_event_primary_target" }],
      take: 1,
    },
  };
  content.reactiveSkills.test_split = {
    id: "test_split",
    displayName: "Test Split",
    tags: ["reaction", "guard"],
    rule: {
      id: "test_split_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      priority: 100,
      predicates: [otherAlly, { type: "event_tag", tag: "shared_damage", value: false }],
      costs: [],
      effects: [{
        type: "split_pending_damage",
        target: { scope: "self", take: 1 },
        amount: { type: "event_value_scaled", key: "amount", numerator: 2, denominator: 5 },
        share: { type: "event_value_scaled", key: "amount", numerator: 2, denominator: 5 },
        tags: ["shared_damage"],
      }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  };

  const battle = {
    schemaVersion: CORE_BATTLE.schemaVersion,
    battleId: "issue_shared_pain_split",
    maxRounds: 1,
    objective: { type: "survive_rounds", rounds: 1 },
    allies: [
      {
        instanceId: "a_target",
        characterId: "warden",
        position: "front_left",
        hp: 20,
        tactics: [],
        reactiveSkillIds: [],
        equipment: [],
      },
      {
        instanceId: "a_splitter",
        characterId: "warden",
        position: "rear_left",
        hp: 20,
        tactics: [],
        reactiveSkillIds: ["test_split"],
        equipment: [],
      },
    ],
    enemies: [{
      instanceId: "e_split",
      enemyActorId: "split_husk",
      position: "front_left",
      hp: 100,
    }],
  };

  const levelOne = simulateBattle(battle, content);
  const levelOneModified = of(levelOne, "pending_amount_modified").find(
    (event) => event.ruleId === "test_split_rule",
  );
  const levelOneTransfer = of(levelOne, "damage_taken").find(
    (event) => event.targetActorIds[0] === "a_splitter" && event.tags.includes("shared_damage"),
  );
  const levelOnePrimary = of(levelOne, "damage_taken").find(
    (event) => event.targetActorIds[0] === "a_target" && event.sourceActorId === "e_split",
  );
  equal(levelOneModified.values.before, 20, "分散は元の pending damage を読む");
  equal(levelOneModified.values.after, 12, "Lv1 は元の4割を対象から軽減する");
  equal(levelOneModified.values.splitMitigation, 8);
  equal(levelOneModified.values.transferredDamage, 8, "転送量は元の4割");
  equal(levelOneTransfer.values.amount, 8, "所有者へ4割の通常ダメージを送る");
  equal(levelOnePrimary.values.amount, 12, "対象には残り6割が届く");
  check(levelOneTransfer.sequence < levelOnePrimary.sequence, "転送は元の被弾と回復反応より先に処理される");

  // The split reads the live pending frame, not the proposal's original value.
  // This matters when another incoming-damage reaction has already reduced it.
  content.reactiveSkills.test_pre_reduce = {
    id: "test_pre_reduce",
    displayName: "Test Pre-Reduce",
    tags: ["reaction", "guard"],
    rule: {
      id: "test_pre_reduce_rule",
      listenTo: "damage_proposed",
      timing: "interrupt",
      priority: 50,
      predicates: [{
        type: "target_exists",
        query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
      }],
      costs: [],
      effects: [{ type: "modify_pending_amount", operation: "decrease", amount: { type: "constant", value: 2 } }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
  };
  const adjusted = structuredClone(battle);
  adjusted.allies[0].reactiveSkillIds = ["test_pre_reduce"];
  const adjustedResult = simulateBattle(adjusted, content);
  const adjustedModified = of(adjustedResult, "pending_amount_modified").find(
    (event) => event.ruleId === "test_split_rule",
  );
  equal(adjustedModified.values.before, 18, "分散は先行する軽減後の pending damage を読む");
  equal(adjustedModified.values.splitMitigation, 7, "18の4割は7へ丸める");
  equal(adjustedModified.values.transferredDamage, 7, "転送も現在の pending damage の4割");

  const levelTwo = structuredClone(battle);
  levelTwo.allies[1].skillLevels = { test_split: 2 };
  const levelTwoResult = simulateBattle(levelTwo, content);
  const levelTwoModified = of(levelTwoResult, "pending_amount_modified").find(
    (event) => event.ruleId === "test_split_rule",
  );
  const levelTwoTransfer = of(levelTwoResult, "damage_taken").find(
    (event) => event.targetActorIds[0] === "a_splitter" && event.tags.includes("shared_damage"),
  );
  const levelTwoPrimary = of(levelTwoResult, "damage_taken").find(
    (event) => event.targetActorIds[0] === "a_target" && event.sourceActorId === "e_split",
  );
  equal(levelTwoModified.values.splitMitigation, 9, "Lv2 では軽減量だけが増える");
  equal(levelTwoModified.values.after, 11);
  equal(levelTwoModified.values.transferredDamage, 8, "Lv2 でも転送量は4割のまま");
  equal(levelTwoTransfer.values.amount, 8, "Lv2 の所有者ダメージは増えない");
  equal(levelTwoPrimary.values.amount, 11, "Lv2 の対象ダメージはさらに1減る");
  checks += 1;
}

{
  const defeatedBattle = structuredClone(BARRIER_PARTIAL_BATTLE);
  defeatedBattle.allies[0].hp = 2;
  const defeated = run(defeatedBattle, { captureReplaySnapshots: true });
  const defeatEvent = first(defeated, "actor_defeated");
  const defeatSnapshot = defeated.replaySnapshots[defeatEvent.sequence]
    .find((actor) => actor.instanceId === defeatEvent.targetActorIds[0]);
  equal(defeatSnapshot.recoverableDamage, 0, "a defeated actor has no recoverable red segment");
  equal(defeatSnapshot.unrecoverableDamage, defeatSnapshot.maxHp, "the defeated HP loss is black at the same beat");
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

// ---- Same-actor reactive priority windows ----------------------------------

{
  // The first eligible reactive owns this event window even when a later one
  // could also pay. The selected skill order wins over rule priority.
  const content = structuredClone(FIXTURE_CONTENT);
  content.reactiveSkills.counter_blow.rule.costs = [];
  content.reactiveSkills.brace_after_hit.rule.costs = [];
  const battle = structuredClone(COST_CONTEST_BATTLE);
  battle.allies[0].reactiveSkillIds.reverse();
  const result = simulateBattle(battle, content);
  const counters = of(result, "damage_proposed").filter((event) =>
    event.ruleId === "counter_blow_rule");
  const braces = of(result, "barrier_gained").filter((event) =>
    event.ruleId === "brace_after_hit_rule");
  check(braces.length > 0, "the priority-list first reactive fires despite lower rule priority");
  equal(counters.length, 0, "the later reactive waits even though it could also pay");
}

{
  // An earlier reactive that cannot pay does not consume the window. The
  // affordable lower skill is still checked and can fire.
  const content = structuredClone(FIXTURE_CONTENT);
  content.reactiveSkills.brace_after_hit.rule.costs = [
    { type: "spend_reaction_points", amount: 2 },
  ];
  content.reactiveSkills.counter_blow.rule.costs = [];
  const battle = structuredClone(COST_CONTEST_BATTLE);
  battle.allies[0].reactiveSkillIds.reverse();
  const result = simulateBattle(battle, content);
  const counters = of(result, "damage_proposed").filter((event) =>
    event.ruleId === "counter_blow_rule");
  const braces = of(result, "barrier_gained").filter((event) =>
    event.ruleId === "brace_after_hit_rule");
  check(counters.length > 0, "the affordable lower reactive fires after RP failure");
  equal(braces.length, 0, "the unaffordable higher reactive has no effect");
}

{
  // A false predicate leaves the same actor's window open for the next
  // affordable reactive in priority order.
  const content = structuredClone(FIXTURE_CONTENT);
  content.reactiveSkills.counter_blow.rule.costs = [];
  content.reactiveSkills.brace_after_hit.rule.costs = [];
  content.reactiveSkills.brace_after_hit.rule.predicates.push({
    type: "position",
    subject: "self",
    op: "eq",
    row: "rear",
  });
  const battle = structuredClone(COST_CONTEST_BATTLE);
  battle.allies[0].reactiveSkillIds.reverse();
  const result = simulateBattle(battle, content);
  const counters = of(result, "damage_proposed").filter((event) =>
    event.ruleId === "counter_blow_rule");
  const braces = of(result, "barrier_gained").filter((event) =>
    event.ruleId === "brace_after_hit_rule");
  const incomingHit = of(result, "damage_taken").find((event) =>
    event.sourceActorId === "e_husk" && event.targetActorIds.includes("a_warden"));
  check(incomingHit, "the fixture creates the reactive trigger event");
  check(
    counters.some((event) => event.parentEventId === incomingHit.id),
    "the affordable lower reactive fires from the same event after predicate failure",
  );
  equal(braces.length, 0, "the higher reactive with a false predicate has no effect");
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

{
  // The cursor rotates after the selected tactic, while an unmet conditional
  // tactic is skipped without blocking the later tactics in the circle.
  const bundle = structuredClone(FIXTURE_CONTENT);
  bundle.enemyActors.still_husk.maxHp = 40;
  const battle = structuredClone(INERT_BATTLE);
  battle.maxRounds = 4;
  battle.objective = { type: "survive_rounds", rounds: 4 };
  battle.allies[0].tactics = [
    {
      activeSkillId: "strike",
      useWhen: [{ type: "round_number", op: "gte", value: 3 }],
    },
    { activeSkillId: "bulwark", useWhen: [] },
    { activeSkillId: "strike", useWhen: [] },
  ];
  const result = simulateBattle(battle, bundle);
  const skills = of(result, "action_declared")
    .filter((event) => event.sourceActorId === "a_warden")
    .map((event) => event.skillId);
  assert.deepEqual(
    skills,
    ["bulwark", "strike", "strike", "bulwark"],
    "conditional tactics are skipped and the cursor rotates after each selection",
  );
  checks += 1;
}

// ---- §11.6 round boundary ordering (PREFLIGHT §4) -----------------------------

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
  const nextStarted = of(result, "round_started").find((event) => event.round === 2);
  const expired = of(result, "barrier_expired")[0];
  check(ended.sequence < unused.sequence, "round_ended, then the unused report");
  check(unused.sequence < nextStarted.sequence, "the next round starts after the end-phase reports");
  check(nextStarted.sequence < expired.sequence, "the barrier expires after the next round opens");
  equal(expired.round, 2, "a round barrier expires in the next round, not the previous one");
  check(
    !of(result, "barrier_expired").some((event) => event.round === 1),
    "the last attack's round has no expiry event",
  );
}

{
  // Statuses use the same next-round boundary as barriers. Their removal must
  // not be attached to the final attack or to round_ended either.
  const result = run(STATUS_BATTLE);
  const nextStarted = of(result, "round_started").find((event) => event.round === 2);
  const expiry = of(result, "status_removed").find((event) => event.values.cause === "duration");
  check(nextStarted.sequence < expiry.sequence, "a round status expires after the next round opens");
  equal(expiry.round, 2, "a round status expires in the next round");
}

{
  // A round barrier created during the round end phase belongs to the round
  // about to start, not to the one being closed. It must therefore survive
  // the immediately following round start and expire at the next one.
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
  const nextStart = of(result, "round_started").find((event) => event.round === banked.round + 1);
  check(
    expiries.length === 0
      || (expiries[0].round > banked.round && nextStart.sequence < expiries[0].sequence),
    "and it survived the round end and the immediately following round start",
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
  bundle.enemyActors.husk_bulwark.tactics = [];
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
    !of(above, "action_declared").some((event) =>
      event.skillId === "strike" && event.sourceActorId === "a_warden"),
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

// ---- §9 hp_percent_asc — 「最も傷ついた」は割合で決まる（issue #176）-------------
//
// **最大HPが違う二人が並ぶと、残りHPの小ささと傷の深さは別物になる。**
// 庇護の対象を選ぶ query は割合で並べるので、ここでその意味を固定する。
{
  const state = {
    actorOrder: ["a_big", "a_small"],
    actors: new Map([
      ["a_big", {
        instanceId: "a_big", side: "ally", alive: true, position: "front_left",
        hp: 150, maxHp: 300, barriers: [], statuses: [],
      }],
      ["a_small", {
        instanceId: "a_small", side: "ally", alive: true, position: "rear_left",
        hp: 100, maxHp: 110, barriers: [], statuses: [],
      }],
    ]),
  };
  const pick = (sort) => resolveTargets(state, {}, {
    scope: "allies", filters: [{ type: "alive" }], sort: [sort], take: 1,
  })[0].instanceId;
  equal(pick("hp_asc"), "a_small", "残りHPで並べると、無傷に近い小柄なほうが選ばれる");
  equal(pick("hp_percent_asc"), "a_big", "割合で並べると、半分まで削られたほうが選ばれる");
  equal(pick("hp_percent_desc"), "a_small", "逆順は最も無事なほうを返す");
  // 同率のときは既定の並び（position_asc → instance_id_asc）へ落ちる。**乱れない。**
  state.actors.get("a_small").hp = 55;
  equal(pick("hp_percent_asc"), "a_big", "同率（どちらも50%）は前列から。take: 1 が並び順に依存しない");
}

// ---- §14 the ordinary fixtures stay far below the caps --------------------------

for (const battle of ALL_FIXTURE_BATTLES) {
  const result = run(battle);
  check(
    result.metrics.eventCount < 4096 * 0.1,
    `${battle.battleId} used ${result.metrics.eventCount} events, under 10% of the battle cap`,
  );
  check(
    result.metrics.maxChainEventCount < 256 * 0.1,
    `${battle.battleId} longest chain ${result.metrics.maxChainEventCount}, under 10% of the chain cap`,
  );
}
