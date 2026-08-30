// ecology/schema.test.mjs — Gate B.
//
// Every check below is "the validator refuses this", because content is data and
// a designer will eventually write each one of these by accident.

import assert from "node:assert/strict";
import {
  PREDICATE_TYPES,
  TARGET_FILTER_TYPES,
  SUBJECTS,
  USE_WHEN_PREDICATE_TYPES,
  USE_WHEN_SUBJECTS,
} from "./schema.mjs";
import { validateBattleInput, validateContentBundle } from "./validate.mjs";
import { FIXTURE_CONTENT, FIXTURE_COVERAGE } from "./fixture-content.mjs";
import { ALL_FIXTURE_BATTLES, CORE_BATTLE } from "./fixtures.mjs";

let checks = 0;

function expectValid(errors, label) {
  assert.deepEqual(errors, [], `${label} should validate cleanly`);
  checks += 1;
}

function expectRejected(errors, code, label) {
  assert.ok(errors.length > 0, `${label} should have been rejected`);
  assert.ok(
    errors.some((error) => error.code === code),
    `${label} should report code ${code}, got ${JSON.stringify(errors)}`,
  );
  checks += 1;
}

function content(mutate) {
  const clone = structuredClone(FIXTURE_CONTENT);
  mutate(clone);
  return validateContentBundle(clone);
}

function input(mutate) {
  const clone = structuredClone(CORE_BATTLE);
  mutate(clone);
  return validateBattleInput(clone, FIXTURE_CONTENT);
}

// ---- the fixtures themselves are valid ------------------------------------

expectValid(validateContentBundle(FIXTURE_CONTENT), "fixture content bundle");
for (const battle of ALL_FIXTURE_BATTLES) {
  expectValid(validateBattleInput(battle, FIXTURE_CONTENT), `battle ${battle.battleId}`);
}

// Every fixture definition says which requirement it witnesses (§15).
for (const section of ["activeSkills", "reactiveSkills", "equipment", "statuses"]) {
  for (const id of Object.keys(FIXTURE_CONTENT[section])) {
    assert.ok(FIXTURE_COVERAGE[id], `fixture ${section}.${id} has no coverage note`);
    checks += 1;
  }
}

// ---- unknown vocabulary ----------------------------------------------------

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.listenTo = "actor_sneezed";
  }),
  "unknown_event_type",
  "unknown event type",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.listenTo = "actor_revived";
  }),
  "reserved_event_type",
  "reserved event type",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.listenTo = "resource_refreshed";
  }),
  "non_listenable_event",
  "listening to the refresh that has no reaction window",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.effects[0].type = "delete_actor";
  }),
  "unknown_effect",
  "unknown effect",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.intrinsicPredicates = [{ type: "vibes_are_good" }];
  }),
  "unknown_predicate",
  "unknown predicate",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.targetQuery.filters = [{ type: "is_named" }];
  }),
  "unknown_target_filter",
  "unknown target filter",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.targetQuery.sort = ["hp_random"];
  }),
  "unknown_target_sort",
  "unknown target sort",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.costs = [{ type: "spend_sanity", amount: 1 }];
  }),
  "unknown_cost",
  "unknown cost",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.effects[0].amount = { type: "dice_roll", sides: 6 };
  }),
  "unknown_value_type",
  "unknown value type",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.targetQuery.scope = "everyone";
  }),
  "unknown_target_scope",
  "unknown target scope",
);

// ---- dangling references ---------------------------------------------------

expectRejected(
  content((bundle) => {
    bundle.activeSkills.mark_target.effects[0].statusId = "no_such_status";
  }),
  "dangling_reference",
  "effect naming a status that does not exist",
);

expectRejected(
  content((bundle) => {
    bundle.enemyActors.husk.tactics[0].activeSkillId = "no_such_skill";
  }),
  "dangling_reference",
  "enemy tactic naming a skill that does not exist",
);

expectRejected(
  input((battle) => {
    battle.allies[0].characterId = "no_such_character";
  }),
  "dangling_reference",
  "ally naming a character that does not exist",
);

expectRejected(
  input((battle) => {
    battle.allies[0].equipment = [{ instanceId: "e_x", equipmentId: "no_such_item", durability: 1 }];
  }),
  "dangling_reference",
  "equipment that does not exist",
);

expectRejected(
  input((battle) => {
    battle.allies[0].reactiveSkillIds = ["no_such_reaction"];
  }),
  "dangling_reference",
  "reactive skill that does not exist",
);

expectRejected(
  input((battle) => {
    battle.objective = { type: "defeat_definition", enemyActorId: "no_such_enemy", count: 1 };
  }),
  "dangling_reference",
  "objective naming an enemy definition that does not exist",
);

// ---- duplicate ids and positions -------------------------------------------

expectRejected(
  content((bundle) => {
    bundle.statuses.strike = { ...bundle.statuses.exposed, id: "strike" };
  }),
  "duplicate_id",
  "a status reusing an active skill id",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.guard_step.rule.id = "counter_blow_rule";
  }),
  "duplicate_id",
  "two rules sharing an id",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.id = "strikes";
  }),
  "key_id_mismatch",
  "record key not matching the definition id",
);

expectRejected(
  input((battle) => {
    battle.allies[1].instanceId = battle.allies[0].instanceId;
  }),
  "duplicate_instance_id",
  "two allies sharing an instance id",
);

expectRejected(
  input((battle) => {
    battle.allies[0].equipment = [
      { instanceId: "e_same", equipmentId: "worn_greaves", durability: 1 },
      { instanceId: "e_same", equipmentId: "field_kit", durability: 1 },
    ];
  }),
  "duplicate_instance_id",
  "two equipment instances sharing an id",
);

expectRejected(
  input((battle) => {
    battle.allies[1].position = battle.allies[0].position;
  }),
  "duplicate_position",
  "two allies on one position",
);

expectRejected(
  input((battle) => {
    battle.enemies = [
      { instanceId: "e_a", enemyActorId: "husk", position: "front_left" },
      { instanceId: "e_b", enemyActorId: "husk", position: "front_left" },
    ];
  }),
  "duplicate_position",
  "two enemies on one position",
);

// ---- loadout limits (§5.3) --------------------------------------------------

expectRejected(
  input((battle) => {
    // PHASE A: 行動枠は 2 → 3（R6 §17.1）。拒否されるのは4つ目から。
    battle.allies[0].tactics = [
      { activeSkillId: "strike", useWhen: [] },
      { activeSkillId: "mend", useWhen: [] },
      { activeSkillId: "bulwark", useWhen: [] },
      { activeSkillId: "triage", useWhen: [] },
    ];
  }),
  "too_many",
  "four active tactics",
);

expectRejected(
  input((battle) => {
    battle.allies[0].tactics = [
      {
        activeSkillId: "strike",
        useWhen: [
          { type: "round_number", op: "gte", value: 1 },
          { type: "round_number", op: "gte", value: 2 },
          { type: "round_number", op: "gte", value: 3 },
        ],
      },
    ];
  }),
  "too_many",
  "three useWhen conditions",
);

expectRejected(
  input((battle) => {
    // PHASE A: 反応枠も 2 → 3。
    battle.allies[0].reactiveSkillIds = ["counter_blow", "guard_step", "scavenge_ap", "urging"];
  }),
  "too_many",
  "four reactive skills",
);

expectRejected(
  input((battle) => {
    battle.allies[0].equipment = [
      { instanceId: "e_1", equipmentId: "worn_greaves", durability: 1 },
      { instanceId: "e_2", equipmentId: "field_kit", durability: 1 },
      { instanceId: "e_3", equipmentId: "standing_plate", durability: 1 },
    ];
  }),
  "too_many",
  "three equipment slots",
);

expectRejected(
  input((battle) => {
    // PHASE A: 編成は 4 → 5（R6 §5.4）。6人目から拒否される。
    battle.allies = [...battle.allies,
      { ...battle.allies[0], instanceId: "a_x", position: "rear_right" },
      { ...battle.allies[0], instanceId: "a_y", position: "front_right" },
      { ...battle.allies[0], instanceId: "a_z", position: "front_center" },
      { ...battle.allies[0], instanceId: "a_w", position: "rear_center" }];
  }),
  "too_many",
  "six allies",
);

// ---- useWhen is restricted to the actor's own state (§8) --------------------

expectRejected(
  input((battle) => {
    battle.allies[0].tactics = [
      { activeSkillId: "strike", useWhen: [{ type: "event_tag", tag: "attack", value: true }] },
    ];
  }),
  "unknown_predicate",
  "an event predicate inside useWhen",
);

expectRejected(
  input((battle) => {
    battle.allies[0].tactics = [
      {
        activeSkillId: "strike",
        useWhen: [{ type: "hp_percent", subject: "event_source", op: "lt", value: 50 }],
      },
    ];
  }),
  "unknown_subject",
  "an event subject inside useWhen",
);

assert.ok(
  USE_WHEN_PREDICATE_TYPES.every((type) => PREDICATE_TYPES.includes(type)),
  "useWhen predicates must be a subset of the v1 predicates",
);
assert.deepEqual(USE_WHEN_SUBJECTS, ["self"]);
checks += 2;

// ---- interrupt-only effects and pending frames (§11.4, §11.5) ---------------

expectRejected(
  content((bundle) => {
    bundle.statuses.exposed.rules[0].timing = "after";
  }),
  "interrupt_only_effect",
  "modify_pending_amount on an after rule",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.timing = "interrupt";
  }),
  "no_pending_frame",
  "an interrupt rule on an event with no pending frame",
);

expectRejected(
  content((bundle) => {
    bundle.statuses.exposed.rules[0].listenTo = "action_declared";
  }),
  "no_pending_amount",
  "modify_pending_amount on an action frame",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.cover_ally.rule.effects = [{ type: "cancel_pending_action" }];
    bundle.reactiveSkills.cover_ally.rule.listenTo = "damage_proposed";
  }),
  "no_pending_action",
  "cancel_pending_action on a damage frame",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.effects.push({ type: "cancel_pending_action" });
  }),
  "interrupt_only_effect",
  "an active skill using an interrupt-only effect",
);

// ---- numbers (§5.2, §10.3) --------------------------------------------------

expectRejected(
  content((bundle) => {
    bundle.characters.warden.maxHp = -1;
  }),
  "out_of_range",
  "negative max hp",
);

expectRejected(
  content((bundle) => {
    bundle.characters.warden.speed = 1.5;
  }),
  "not_an_integer",
  "fractional speed",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.effects[0].amount = { type: "constant", value: Number.NaN };
  }),
  "not_a_number",
  "NaN damage",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.effects[0].amount = { type: "constant", value: Number.POSITIVE_INFINITY };
  }),
  "not_a_number",
  "infinite damage",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.strike.effects[0].amount = {
      type: "actor_stat_scaled",
      subject: "self",
      stat: "max_hp",
      numerator: 1,
      denominator: 0,
    };
  }),
  "division_by_zero",
  "a zero denominator",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.priority = 1001;
  }),
  "out_of_range",
  "a priority outside 0..1000",
);

expectRejected(
  content((bundle) => {
    bundle.activeSkills.heavy_swing.preparation.steps = 4;
  }),
  "out_of_range",
  "four preparation steps",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.limit = { scope: "chain", count: 0 };
  }),
  "out_of_range",
  "a limit count of zero",
);

expectRejected(
  input((battle) => {
    battle.allies[0].equipment = [{ instanceId: "e_x", equipmentId: "worn_greaves", durability: 99 }];
  }),
  "out_of_range",
  "durability above the item maximum",
);

expectRejected(
  input((battle) => {
    battle.allies[0].hp = 999;
  }),
  "out_of_range",
  "hp above the character maximum",
);

expectRejected(
  input((battle) => {
    battle.maxRounds = 0;
  }),
  "out_of_range",
  "a battle with no rounds",
);

// ---- ids ---------------------------------------------------------------------

expectRejected(
  content((bundle) => {
    bundle.characters.warden.signatureRules = [
      { ...structuredClone(FIXTURE_CONTENT.reactiveSkills.guard_step.rule), id: "Guard-Step" },
    ];
  }),
  "bad_id",
  "an id that is not lower_snake_case",
);

// ---- region rules have no owner (PREFLIGHT §7) ------------------------------

expectRejected(
  input((battle) => {
    battle.regionRules = [
      {
        id: "region_bad_self",
        listenTo: "round_started",
        timing: "after",
        priority: 100,
        predicates: [{ type: "hp_percent", subject: "self", op: "lt", value: 50 }],
        costs: [],
        effects: [],
        limit: { scope: "battle", count: 1 },
      },
    ];
  }),
  "ownerless_self",
  "a region rule speaking of itself",
);

expectRejected(
  input((battle) => {
    battle.regionRules = [
      {
        id: "region_bad_cost",
        listenTo: "round_started",
        timing: "after",
        priority: 100,
        predicates: [],
        costs: [{ type: "spend_action_points", amount: 1 }],
        effects: [],
        limit: { scope: "battle", count: 1 },
      },
    ];
  }),
  "ownerless_cost",
  "a region rule paying a cost",
);

// ---- equipment-only vocabulary ----------------------------------------------

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.costs = [{ type: "wear_equipment", amount: 1 }];
  }),
  "not_equipment_rule",
  "a non equipment rule wearing equipment",
);

expectRejected(
  content((bundle) => {
    bundle.reactiveSkills.counter_blow.rule.effects = [
      { type: "repair_equipment", amount: { type: "constant", value: 1 } },
    ];
  }),
  "not_equipment_rule",
  "a non equipment rule repairing equipment",
);

// §5.7 budgets a rule per owner per chain, so two copies of one item would
// share it and the array order would decide which copy wears out.
expectRejected(
  input((battle) => {
    battle.allies[0].equipment = [
      { instanceId: "e_1", equipmentId: "worn_greaves", durability: 1 },
      { instanceId: "e_2", equipmentId: "worn_greaves", durability: 2 },
    ];
  }),
  "duplicate_equipment",
  "two copies of one item on one actor",
);

// The non-listenable records refuse a listener rather than sitting dead.
for (const eventType of ["resource_refreshed", "pending_amount_modified"]) {
  expectRejected(
    content((bundle) => {
      bundle.reactiveSkills.counter_blow.rule.listenTo = eventType;
    }),
    "non_listenable_event",
    `a rule listening to ${eventType}`,
  );
}

// ---- no vocabulary can name a person or a partner (§1.2, Gate B) ------------
//
// This is the structural check: there is no predicate, filter or subject that
// takes a character id, an instance id or a display name, so no skill or item
// can ever be written to work only with one specific team mate.
{
  const relationalOnly = ["self", "event_source", "event_primary_target", "selected_target", "candidate_target"];
  assert.deepEqual(SUBJECTS, relationalOnly, "subjects must stay relational");
  assert.ok(!PREDICATE_TYPES.includes("actor_is"), "no predicate may name an actor");
  assert.ok(!PREDICATE_TYPES.includes("character_is"), "no predicate may name a character");
  assert.ok(!TARGET_FILTER_TYPES.includes("instance_id_is"), "no filter may name an instance");
  assert.ok(!TARGET_FILTER_TYPES.includes("character_is"), "no filter may name a character");
  checks += 5;

  // And an attempt to invent one is refused rather than ignored.
  expectRejected(
    content((bundle) => {
      bundle.activeSkills.strike.targetQuery.filters = [{ type: "instance_id_is", value: "a_warden" }];
    }),
    "unknown_target_filter",
    "a filter naming an instance",
  );
  expectRejected(
    content((bundle) => {
      bundle.activeSkills.strike.intrinsicPredicates = [{ type: "character_is", value: "warden" }];
    }),
    "unknown_predicate",
    "a predicate naming a character",
  );
}

// ---- schema versions ---------------------------------------------------------

expectRejected(
  content((bundle) => {
    bundle.schemaVersion = "ecology-content-0";
  }),
  "bad_schema_version",
  "an old content schema version",
);

expectRejected(
  input((battle) => {
    battle.schemaVersion = "ecology-battle-0";
  }),
  "bad_schema_version",
  "an old battle schema version",
);

console.log(`schema.test.mjs: ${checks} checks passed`);
