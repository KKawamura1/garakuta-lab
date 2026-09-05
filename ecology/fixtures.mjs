// ecology/fixtures.mjs
//
// Battle inputs for the fixture content. Each export names the requirement it
// exists to pin down; the tests import them by name so a failing check points at
// one situation rather than at "the fixture".

import { BATTLE_SCHEMA_VERSION } from "./schema.mjs";

function ally(instanceId, characterId, position, options = {}) {
  const entry = {
    instanceId,
    characterId,
    position,
    tactics: (options.tactics ?? []).map((skillOrTactic) =>
      typeof skillOrTactic === "string"
        ? { activeSkillId: skillOrTactic, useWhen: [] }
        : skillOrTactic,
    ),
    reactiveSkillIds: options.reactives ?? [],
    equipment: (options.equipment ?? []).map(([instance, equipmentId, durability]) => ({
      instanceId: instance,
      equipmentId,
      durability,
    })),
  };
  if (options.hp !== undefined) entry.hp = options.hp;
  return entry;
}

function enemy(instanceId, enemyActorId, position, options = {}) {
  const entry = { instanceId, enemyActorId, position };
  if (options.hp !== undefined) entry.hp = options.hp;
  return entry;
}

function battle(battleId, fields) {
  return { schemaVersion: BATTLE_SCHEMA_VERSION, battleId, ...fields };
}

const ELIMINATE = { type: "eliminate_all_enemies" };

// §12.1 damage, §12.2 healing with overflow, §15.2 counter, §13 objective.
export const CORE_BATTLE = battle("fixture_core", {
  maxRounds: 6,
  objective: ELIMINATE,
  allies: [
    ally("a_warden", "warden", "front_left", { tactics: ["strike"], equipment: [["e_greaves", "worn_greaves", 2]] }),
    ally("a_mender", "mender", "rear_left", {
      tactics: ["mend", "strike"],
      reactives: ["overflow_care", "counter_blow"],
    }),
    ally("a_lancer", "lancer", "front_right", { tactics: ["strike"], reactives: ["scavenge_ap"], hp: 15 }),
  ],
  enemies: [enemy("e_husk", "husk", "front_left")],
});

// §16 C cover and target_changed: the enemy picks the mender, the warden takes
// it instead, and a second interrupt on the same event has to wait its turn.
export const COVER_BATTLE = battle("fixture_cover", {
  maxRounds: 3,
  objective: ELIMINATE,
  allies: [
    ally("a_warden", "warden", "front_left", { tactics: ["bulwark"], reactives: ["cover_ally"] }),
    ally("a_lancer", "lancer", "front_right", { tactics: ["bulwark"], reactives: ["cover_ally"] }),
    ally("a_mender", "mender", "rear_left", { tactics: ["mend"] }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §16 C an earlier reaction spending the reaction point the later one needed.
export const COST_CONTEST_BATTLE = battle("fixture_cost_contest", {
  maxRounds: 2,
  objective: ELIMINATE,
  allies: [
    ally("a_warden", "warden", "front_left", {
      tactics: ["bulwark"],
      reactives: ["counter_blow", "brace_after_hit"],
    }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §12.4 both completion paths: the lancer finishes its own preparation on its
// next activation, and the mender's urging finishes it from outside.
export const PREPARATION_BATTLE = battle("fixture_preparation", {
  maxRounds: 4,
  objective: ELIMINATE,
  allies: [
    ally("a_lancer", "lancer", "front_left", { tactics: ["heavy_swing"] }),
    ally("a_warden", "warden", "front_right", { tactics: ["strike"] }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

export const EXTERNAL_ADVANCE_BATTLE = battle("fixture_external_advance", {
  maxRounds: 3,
  objective: ELIMINATE,
  allies: [
    ally("a_lancer", "lancer", "front_left", { tactics: ["heavy_swing"] }),
    ally("a_mender", "mender", "rear_left", { tactics: ["mend"], reactives: ["urging"] }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §11.3 an actor that gains an action point after its activation goes back to
// the tail of the queue exactly once.
export const REQUEUE_BATTLE = battle("fixture_requeue", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [
    ally("a_lancer", "lancer", "front_left", { tactics: ["strike"] }),
    ally("a_mender", "mender", "rear_left", { tactics: ["relay_order"] }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §12.1 and §12.3 boundaries: a battle barrier, a round barrier, overkill.
export const BOUNDARY_BATTLE = battle("fixture_boundary", {
  maxRounds: 3,
  objective: ELIMINATE,
  allies: [
    ally("a_warden", "warden", "front_left", {
      tactics: ["bulwark"],
      equipment: [["e_plate", "standing_plate", 3]],
    }),
    ally("a_lancer", "lancer", "front_right", {
      tactics: ["strike"],
      equipment: [["e_edge", "splinter_edge", 2]],
    }),
  ],
  enemies: [enemy("e_husk", "husk", "front_left", { hp: 2 }), enemy("e_husk_b", "husk", "front_right", { hp: 10 })],
});

// §12.3 packets are spent earliest expiry first: the round barrier goes before
// the battle barrier, and a fully absorbed hit records no damage_taken at all.
export const BARRIER_PACKET_BATTLE = battle("fixture_barrier_packet", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [
    ally("a_scout", "scout", "front_left", {
      tactics: ["bulwark"],
      equipment: [["e_plate", "standing_plate", 3]],
    }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §12.1 a hit larger than the barrier: part absorbed, the rest reaches hp.
export const BARRIER_PARTIAL_BATTLE = battle("fixture_barrier_partial", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [
    ally("a_warden", "warden", "front_left", {
      tactics: ["strike"],
      equipment: [["e_plate", "standing_plate", 3]],
    }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §5.6 a broken item stops supplying its rule for the rest of the battle.
export const BROKEN_EQUIPMENT_BATTLE = battle("fixture_broken_equipment", {
  maxRounds: 4,
  objective: ELIMINATE,
  allies: [
    ally("a_lancer", "lancer", "front_left", {
      tactics: ["strike"],
      equipment: [["e_edge", "splinter_edge", 1]],
    }),
  ],
  enemies: [
    enemy("e_husk", "husk", "front_left", { hp: 1 }),
    enemy("e_husk_b", "husk", "front_right", { hp: 3 }),
    enemy("e_husk_c", "husk_bulwark", "rear_left"),
  ],
});

// §12.5 swap, and §15.2 the barrier that answers actor_moved.
export const MOVE_BATTLE = battle("fixture_move", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [
    ally("a_scout", "scout", "rear_left", { tactics: ["reposition"], reactives: ["guard_step"] }),
    ally("a_warden", "warden", "front_left", { tactics: ["bulwark"], reactives: ["guard_step"] }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §15.4 both statuses, applied by content rather than seeded by the input.
export const STATUS_BATTLE = battle("fixture_status", {
  maxRounds: 3,
  objective: ELIMINATE,
  allies: [
    ally("a_lancer", "lancer", "front_left", { tactics: ["steady_aim", "strike"] }),
  ],
  enemies: [
    enemy("e_marker", "husk_marker", "front_left"),
    // Acts after the marker in the same round, so the negative status has a
    // damage proposal to raise before it expires at the round end.
    enemy("e_husk", "husk", "front_right"),
  ],
});

// §15.3 the field kit spends an unused reaction point at the end of the round.
// It starts one point of durability down, so the first round has something to
// repair and the second round runs into the maxDurability clamp.
export const FIELD_KIT_BATTLE = battle("fixture_field_kit", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [
    ally("a_warden", "warden", "front_left", {
      tactics: ["bulwark"],
      equipment: [["e_kit", "field_kit", 1]],
      hp: 15,
    }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §5.6 — a kit that is already broken supplies no rules, so it cannot mend
// itself back into the battle.
export const BROKEN_KIT_BATTLE = battle("fixture_broken_kit", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [
    ally("a_warden", "warden", "front_left", {
      tactics: ["bulwark"],
      equipment: [["e_kit", "field_kit", 0]],
    }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §15.4 — the positive status raises a barrier as well as damage and healing.
export const FOCUSED_BARRIER_BATTLE = battle("fixture_focused_barrier", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [ally("a_warden", "warden", "front_left", { tactics: ["steady_aim", "bulwark"] })],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// §11.1-6 the outcome is already decided at battle_started, and the engine still
// records battle_started before battle_ended.
export const IMMEDIATE_BATTLE = battle("fixture_immediate", {
  maxRounds: 3,
  objective: ELIMINATE,
  allies: [ally("a_warden", "warden", "front_left", { tactics: ["strike"] })],
  enemies: [enemy("e_husk", "husk", "front_left", { hp: 0 })],
});

// Nothing on either side can change any state. v1 does not call this a
// stalemate (see engine.mjs, endRound): the round limit ends it.
export const INERT_BATTLE = battle("fixture_inert", {
  maxRounds: 4,
  objective: ELIMINATE,
  allies: [ally("a_warden", "warden", "front_left", { tactics: [] })],
  enemies: [enemy("e_still", "still_husk", "front_left")],
});

// §11.2 the action queue is formation-driven, not speed-driven. Every actor
// occupies a distinct position and has no usable action, so this fixture only
// observes the first activation order.
export const POSITION_ORDER_BATTLE = battle("fixture_position_order", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [
    ally("a_front_center", "warden", "front_center", { tactics: [] }),
    ally("a_front_right", "warden", "front_right", { tactics: [] }),
    ally("a_rear_left", "warden", "rear_left", { tactics: [] }),
  ],
  enemies: [
    enemy("e_front_left", "still_husk", "front_left"),
    enemy("e_rear_center", "still_husk", "rear_center"),
    enemy("e_rear_right", "still_husk", "rear_right"),
  ],
});

// The counter-example that removed the stalemate rule. Waiting is a legal
// tactic: nothing changes for two rounds and then the skill becomes usable. A
// stalemate check over hp, barrier, preparation, status and durability would
// have called this a draw on round two and the strike would never have landed.
export const WAITING_TACTIC_BATTLE = battle("fixture_waiting_tactic", {
  maxRounds: 6,
  objective: ELIMINATE,
  allies: [
    ally("a_lancer", "lancer", "front_left", {
      tactics: [{ activeSkillId: "strike", useWhen: [{ type: "round_number", op: "gte", value: 3 }] }],
    }),
  ],
  enemies: [enemy("e_still", "still_husk", "front_left")],
});

// §13 defeat_definition names a definition, never an instance.
export const DEFINITION_BATTLE = battle("fixture_definition", {
  maxRounds: 6,
  objective: { type: "defeat_definition", enemyActorId: "husk_warden", count: 1 },
  allies: [ally("a_lancer", "lancer", "front_left", { tactics: ["strike"] })],
  enemies: [
    enemy("e_warden", "husk_warden", "rear_left", { hp: 4 }),
    enemy("e_husk", "husk_bulwark", "front_left"),
  ],
});

// PREFLIGHT §8 the round limit ends an unfinished battle as a loss.
export const ROUND_LIMIT_BATTLE = battle("fixture_round_limit", {
  maxRounds: 2,
  objective: ELIMINATE,
  allies: [ally("a_warden", "warden", "front_left", { tactics: ["strike"] })],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// PREFLIGHT §7 a region rule has no owner: allies and enemies mean the two
// sides, and it may not pay a cost or speak of itself.
export const REGION_BATTLE = battle("fixture_region", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [ally("a_warden", "warden", "front_left", { tactics: ["bulwark"] })],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
  regionRules: [
    {
      id: "region_dust",
      listenTo: "round_started",
      timing: "after",
      priority: 100,
      predicates: [{ type: "round_number", op: "eq", value: 1 }],
      costs: [],
      effects: [
        {
          type: "deal_damage",
          target: { scope: "allies", filters: [{ type: "alive" }], sort: ["hp_desc"], take: 1 },
          amount: { type: "constant", value: 2 },
          tags: ["region"],
        },
      ],
      limit: { scope: "battle", count: 1 },
    },
  ],
});

// §5.3 the campaign cap is four allies; the engine also has to run that boundary.
export const FULL_PARTY_BATTLE = battle("fixture_full_party", {
  maxRounds: 8,
  objective: ELIMINATE,
  allies: [
    ally("a_warden", "warden", "front_left", { tactics: ["strike"], reactives: ["counter_blow"] }),
    ally("a_lancer", "lancer", "front_right", { tactics: ["strike"], equipment: [["e_edge", "splinter_edge", 2]] }),
    ally("a_mender", "mender", "rear_left", { tactics: ["mend", "strike"], reactives: ["overflow_care"] }),
    ally("a_scout", "scout", "rear_right", { tactics: ["strike"], reactives: ["scavenge_ap"] }),
  ],
  enemies: [
    enemy("e_husk", "husk", "front_left"),
    enemy("e_husk_b", "husk", "front_right"),
    enemy("e_marker", "husk_marker", "rear_left"),
    enemy("e_warden", "husk_warden", "rear_right"),
  ],
});

// ---- §14 termination witnesses ------------------------------------------------
//
// The first five stop on a safety constraint and return a normal result. The
// last two are real non termination and must throw with diagnostics.

export const AP_LOOP_BATTLE = battle("fixture_ap_loop", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [
    ally("a_mender", "mender", "rear_left", { tactics: ["relay_order"], reactives: ["ap_loop"] }),
    ally("a_warden", "warden", "front_left", { tactics: ["bulwark"], reactives: ["ap_loop"] }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

export const DAMAGE_ECHO_BATTLE = battle("fixture_damage_echo", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [ally("a_lancer", "lancer", "front_left", { tactics: ["strike"], reactives: ["damage_echo"] })],
  enemies: [enemy("e_echo", "husk_echo", "front_left")],
});

export const BARRIER_BLOOM_BATTLE = battle("fixture_barrier_bloom", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [ally("a_warden", "warden", "front_left", { tactics: ["bulwark"], reactives: ["barrier_bloom"] })],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

export const PREP_SPIRAL_BATTLE = battle("fixture_prep_spiral", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [ally("a_lancer", "lancer", "front_left", { tactics: ["long_swing"], reactives: ["prep_spiral"] })],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

export const SELF_WEAR_BATTLE = battle("fixture_self_wear", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [
    ally("a_warden", "warden", "front_left", {
      tactics: ["bulwark"],
      equipment: [["e_plate", "hungry_plate", 3]],
    }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// PREFLIGHT §5 — the two relays hand the action point back and forth until the
// eight activations per round ceiling stops them.
export const ACTIVATION_CAP_BATTLE = battle("fixture_activation_cap", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [
    ally("a_lancer", "lancer", "front_left", { tactics: ["bulwark"], reactives: ["relay_rear"] }),
    ally("a_warden", "warden", "rear_left", { tactics: ["bulwark"], reactives: ["relay_front"] }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

// PREFLIGHT §6 — a free, always usable action. §11.3 puts no ceiling on the
// number of actions inside one activation, so only the event cap stops this.
export const FREE_ACTION_BATTLE = battle("fixture_free_action", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [ally("a_scout", "scout", "front_left", { tactics: ["idle_shuffle"] })],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

export const TERMINATION_BATTLES = [
  AP_LOOP_BATTLE,
  DAMAGE_ECHO_BATTLE,
  BARRIER_BLOOM_BATTLE,
  PREP_SPIRAL_BATTLE,
  SELF_WEAR_BATTLE,
  ACTIVATION_CAP_BATTLE,
];

// ---- Gate E (§16 E) ------------------------------------------------------------
//
// Battle inputs for the four content items added after the engine was finished.
// Everything these need already existed in the v1 vocabulary.

export const TRIAGE_BATTLE = battle("fixture_triage", {
  maxRounds: 1,
  objective: { type: "survive_rounds", rounds: 1 },
  allies: [
    // Exactly half health, and short of a full heal, so the skill both finds it
    // and overflows on it.
    ally("a_mender", "mender", "rear_left", {
      tactics: ["triage"],
      reactives: ["triage_relay"],
      hp: 7,
    }),
    ally("a_lancer", "lancer", "front_left", { tactics: ["strike"], hp: 15 }),
  ],
  // Keep the enemy after the healer in the formation queue so this fixture
  // remains a pure healing-overflow witness.
  enemies: [enemy("e_husk", "husk_bulwark", "rear_right")],
});

export const MOMENTUM_BATTLE = battle("fixture_momentum", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [
    ally("a_scout", "scout", "rear_left", {
      tactics: ["reposition", "strike"],
      equipment: [["e_rig", "momentum_rig", 2]],
    }),
    ally("a_warden", "warden", "front_left", { tactics: ["bulwark"] }),
  ],
  enemies: [enemy("e_husk", "husk_bulwark", "front_left")],
});

export const PIVOT_BATTLE = battle("fixture_pivot", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [
    // The tactic needs the rear row, so this front row actor never spends its
    // two action points and the signature has something to bank.
    ally("a_pivot", "pivot", "front_left", { tactics: ["reposition"] }),
  ],
  enemies: [enemy("e_husk", "husk", "front_left")],
});

export const HUNTER_BATTLE = battle("fixture_hunter", {
  maxRounds: 2,
  objective: { type: "survive_rounds", rounds: 2 },
  allies: [
    ally("a_lancer", "lancer", "front_left", { tactics: ["heavy_swing"] }),
    ally("a_warden", "warden", "front_right", { tactics: ["bulwark"] }),
  ],
  enemies: [enemy("e_hunter", "husk_hunter", "front_left")],
});

export const GATE_E_BATTLES = [TRIAGE_BATTLE, MOMENTUM_BATTLE, PIVOT_BATTLE, HUNTER_BATTLE];

// §16 F — a small mining pool. It is deliberately tiny: mining exists to show
// that the same input gives the same chains and that data additions change the
// shapes, not to search for anything.
export const MINING_POOL = {
  schemaVersion: "ecology-mining-1",
  poolId: "fixture_pool_1",
  characterIds: ["warden", "lancer", "mender"],
  activeSkillIds: ["strike", "mend", "bulwark"],
  reactiveSkillIds: ["counter_blow", "guard_step", "scavenge_ap"],
  equipmentIds: ["worn_greaves", "splinter_edge", "standing_plate"],
  battles: [
    {
      battleId: "mine_single",
      maxRounds: 4,
      objective: ELIMINATE,
      allyPosition: "front_left",
      durability: 2,
      enemies: [enemy("m_husk", "husk", "front_left", { hp: 6 })],
    },
    {
      battleId: "mine_pair",
      maxRounds: 4,
      objective: ELIMINATE,
      allyPosition: "front_left",
      durability: 2,
      enemies: [
        enemy("m_husk", "husk", "front_left", { hp: 3 }),
        enemy("m_marker", "husk_marker", "rear_left"),
      ],
    },
  ],
};

export const ALL_FIXTURE_BATTLES = [
  CORE_BATTLE,
  COVER_BATTLE,
  COST_CONTEST_BATTLE,
  PREPARATION_BATTLE,
  EXTERNAL_ADVANCE_BATTLE,
  REQUEUE_BATTLE,
  BOUNDARY_BATTLE,
  BARRIER_PACKET_BATTLE,
  BARRIER_PARTIAL_BATTLE,
  BROKEN_EQUIPMENT_BATTLE,
  MOVE_BATTLE,
  STATUS_BATTLE,
  FIELD_KIT_BATTLE,
  IMMEDIATE_BATTLE,
  INERT_BATTLE,
  POSITION_ORDER_BATTLE,
  WAITING_TACTIC_BATTLE,
  BROKEN_KIT_BATTLE,
  FOCUSED_BARRIER_BATTLE,
  DEFINITION_BATTLE,
  ROUND_LIMIT_BATTLE,
  REGION_BATTLE,
  FULL_PARTY_BATTLE,
  ...GATE_E_BATTLES,
];

