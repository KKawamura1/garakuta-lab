// ecology/fixture-content.mjs
//
// §15 — this is NOT production content. Every entry here exists to witness one
// schema shape or one ordering rule, and the table at the bottom of this file
// says which R5 requirement each one is the witness for. Display names are
// descriptive placeholders; the real cast, numbers and story are decided by the
// design lead afterwards (§20).
//
// The bundle is deep frozen on export. If the engine ever mutated content, the
// mutation would throw instead of quietly poisoning the next battle (§4.2).

import { CONTENT_SCHEMA_VERSION } from "./schema.mjs";

// -- small builders, so the data below reads as data ------------------------

const ALIVE = { type: "alive" };
const constant = (value) => ({ type: "constant", value });

// "this event's primary target is me" and "this event's source is me".
// The second one uses the is_event_source filter added in PREFLIGHT §1.
const SELF_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
};
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
// "the actor this event is about is an enemy of mine" / "... an ally of mine".
const EVENT_TARGET_IS_ENEMY = {
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
};
const EVENT_TARGET_IS_ALLY = {
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "is_event_primary_target" }], take: 1 },
};
const EVENT_SOURCE_IS_ENEMY = {
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_source" }, ALIVE], take: 1 },
};

const SELF_TARGET = { scope: "self", take: 1 };
const WEAKEST_ENEMY = { scope: "enemies", filters: [ALIVE], sort: ["hp_asc"], take: 1 };
const EVENT_SOURCE_ACTOR = { scope: "event_source", filters: [ALIVE], take: 1 };

const characters = {
  // A front-line body. Its signature rule is deliberately empty so that
  // "a character with no signature" is also covered by the schema tests.
  warden: {
    id: "warden",
    displayName: "Warden (fixture)",
    maxHp: 20,
    baseActionPoints: 1,
    baseReactionPoints: 1,
    signatureRules: [],
    tags: ["fixture", "front"],
  },
  // Absolute hp is lower than everyone else's while still being full, which is
  // what makes an hp_asc heal overheal without any special casing (§15.1).
  mender: {
    id: "mender",
    displayName: "Mender (fixture)",
    maxHp: 14,
    baseActionPoints: 1,
    baseReactionPoints: 1,
    signatureRules: [],
    tags: ["fixture", "support"],
  },
  lancer: {
    id: "lancer",
    displayName: "Lancer (fixture)",
    maxHp: 16,
    baseActionPoints: 1,
    baseReactionPoints: 1,
    signatureRules: [],
    tags: ["fixture", "strike"],
  },
  // Carries a signature rule so "rules can come from the character
  // itself, not only from slotted skills" has a witness.
  scout: {
    id: "scout",
    displayName: "Scout (fixture)",
    maxHp: 12,
    baseActionPoints: 1,
    baseReactionPoints: 1,
    signatureRules: [
      {
        id: "scout_reads_the_room",
        listenTo: "round_started",
        timing: "after",
        priority: 200,
        predicates: [{ type: "round_number", op: "eq", value: 1 }],
        costs: [],
        effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: constant(1), duration: "round" }],
        limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
      },
    ],
    tags: ["fixture", "scout"],
  },
  // ---- Gate E (§16 E) --------------------------------------------------------
  // Added after the engine was finished, as data only. "Turn the action points
  // you did not spend into a round barrier."
  pivot: {
    id: "pivot",
    displayName: "Pivot (fixture, Gate E)",
    maxHp: 18,
    baseActionPoints: 2,
    baseReactionPoints: 1,
    signatureRules: [
      {
        id: "pivot_banks_the_rest",
        listenTo: "resource_unused",
        timing: "after",
        priority: 100,
        predicates: [
          SELF_IS_EVENT_TARGET,
          { type: "event_tag", tag: "action_points", value: true },
          { type: "event_value", key: "amount", op: "gte", value: 1 },
        ],
        costs: [],
        effects: [
          {
            type: "gain_barrier",
            target: SELF_TARGET,
            amount: { type: "event_value_scaled", key: "amount" },
            duration: "round",
          },
        ],
        limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      },
    ],
    tags: ["fixture", "gate_e"],
  },
};

const activeSkills = {
  // §15.1 — single target damage.
  strike: {
    id: "strike",
    displayName: "Strike (fixture)",
    apCost: 1,
    intrinsicPredicates: [],
    targetQuery: WEAKEST_ENEMY,
    effects: [
      {
        type: "deal_damage",
        target: { scope: "event_targets", filters: [ALIVE], take: 1 },
        amount: constant(4),
        // Fixture content predates the playable formation rule. Keep this
        // witness explicitly unrestricted so its cover test continues to
        // start from the rear mender and exercise two redirects.
        reach: "unrestricted",
        tags: ["attack"],
      },
    ],
    tags: ["attack"],
  },
  // §15.1 — heal, and the excess that comes with it.
  mend: {
    id: "mend",
    displayName: "Mend (fixture)",
    apCost: 1,
    intrinsicPredicates: [],
    targetQuery: { scope: "allies", filters: [ALIVE], sort: ["hp_asc"], take: 1 },
    effects: [
      {
        type: "heal",
        target: { scope: "event_targets", filters: [ALIVE], take: 1 },
        amount: constant(5),
        tags: ["care"],
      },
    ],
    tags: ["care"],
  },
  // §15.1 — a round barrier.
  bulwark: {
    id: "bulwark",
    displayName: "Bulwark (fixture)",
    apCost: 1,
    intrinsicPredicates: [],
    targetQuery: SELF_TARGET,
    effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: constant(3), duration: "round" }],
    tags: ["guard"],
  },
  // §15.1 — hand an action point to a front row ally. Together with §11.3 this
  // is the base mechanism behind "act again"; the engine has no such rule.
  relay_order: {
    id: "relay_order",
    displayName: "Relay Order (fixture)",
    apCost: 1,
    intrinsicPredicates: [],
    targetQuery: { scope: "allies", filters: [ALIVE, { type: "row_is", row: "front" }], sort: ["position_asc"], take: 1 },
    effects: [
      {
        type: "gain_resource",
        target: { scope: "event_targets", filters: [ALIVE], take: 1 },
        resource: "action_points",
        amount: constant(1),
      },
    ],
    tags: ["order"],
  },
  // §15.1 — one preparation step, then a large hit.
  heavy_swing: {
    id: "heavy_swing",
    displayName: "Heavy Swing (fixture)",
    apCost: 1,
    intrinsicPredicates: [],
    targetQuery: WEAKEST_ENEMY,
    effects: [],
    preparation: {
      steps: 1,
      completionEffects: [
        {
          type: "deal_damage",
          target: { scope: "enemies", filters: [ALIVE], sort: ["hp_desc"], take: 1 },
          amount: constant(9),
          tags: ["attack", "heavy"],
        },
      ],
    },
    tags: ["attack", "slow"],
  },
  // §15.1 — swap two living actors on the same side.
  reposition: {
    id: "reposition",
    displayName: "Reposition (fixture)",
    apCost: 1,
    intrinsicPredicates: [{ type: "position", subject: "self", op: "eq", row: "rear" }],
    targetQuery: { scope: "allies", filters: [ALIVE, { type: "row_is", row: "front" }], sort: ["hp_asc"], take: 1 },
    effects: [
      {
        type: "swap_positions",
        target: SELF_TARGET,
        otherTarget: { scope: "event_targets", filters: [ALIVE], take: 1 },
      },
    ],
    tags: ["move"],
  },
  // §14 — three preparation steps, so a rule that answers preparation_advanced
  // has room to try to advance it again inside the same chain.
  long_swing: {
    id: "long_swing",
    displayName: "Long Swing (termination fixture)",
    apCost: 1,
    intrinsicPredicates: [],
    targetQuery: WEAKEST_ENEMY,
    effects: [],
    preparation: {
      steps: 3,
      completionEffects: [
        {
          type: "deal_damage",
          target: { scope: "enemies", filters: [ALIVE], sort: ["hp_desc"], take: 1 },
          amount: constant(9),
          tags: ["attack", "heavy"],
        },
      ],
    },
    tags: ["attack", "slow", "termination"],
  },
  // ---- Gate E (§16 E) --------------------------------------------------------
  // "Heal an ally at or below half health, and let the overflow reach someone
  // else." The half health part is the target query; the overflow part is the
  // reactive skill triage_relay below.
  triage: {
    id: "triage",
    displayName: "Triage (fixture, Gate E)",
    apCost: 1,
    intrinsicPredicates: [],
    targetQuery: {
      scope: "allies",
      filters: [ALIVE, { type: "hp_percent", op: "lte", value: 50 }],
      sort: ["hp_asc"],
      take: 1,
    },
    effects: [
      {
        type: "heal",
        target: { scope: "event_targets", filters: [ALIVE], take: 1 },
        amount: constant(8),
        tags: ["care", "triage"],
      },
    ],
    tags: ["care"],
  },
  // "Hit whoever is winding something up." Priority comes from tactic order:
  // when nobody is preparing the query is empty, the tactic is unusable, and
  // the enemy falls through to its next tactic.
  hunt_the_slow: {
    id: "hunt_the_slow",
    displayName: "Hunt The Slow (fixture, Gate E)",
    apCost: 1,
    intrinsicPredicates: [],
    targetQuery: {
      scope: "enemies",
      filters: [ALIVE, { type: "is_preparing", value: true }],
      sort: ["hp_asc"],
      take: 1,
    },
    effects: [
      {
        type: "deal_damage",
        target: { scope: "event_targets", filters: [ALIVE], take: 1 },
        amount: constant(5),
        tags: ["attack", "hunt"],
      },
    ],
    tags: ["attack"],
  },
  // PREFLIGHT §6 — a真の無限ループ: costs nothing, is always usable, and the
  // activation loop in §11.3 has no action cap of its own. Only the event cap
  // stops it, and it must stop it loudly.
  idle_shuffle: {
    id: "idle_shuffle",
    displayName: "Idle Shuffle (termination fixture)",
    apCost: 0,
    intrinsicPredicates: [],
    targetQuery: SELF_TARGET,
    effects: [{ type: "gain_resource", target: SELF_TARGET, resource: "reaction_points", amount: constant(1) }],
    tags: ["termination"],
  },
};

const reactiveSkills = {
  // §15.2 — counter after taking damage. It reads its own history rather than
  // the event's source, so it also witnesses history_count(window: "chain").
  counter_blow: {
    id: "counter_blow",
    displayName: "Counter Blow (fixture)",
    rule: {
      id: "counter_blow_rule",
      listenTo: "damage_taken",
      timing: "after",
      priority: 100,
      predicates: [SELF_IS_EVENT_TARGET, EVENT_SOURCE_IS_ENEMY],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "deal_damage", target: EVENT_SOURCE_ACTOR, amount: constant(2), tags: ["counter"] }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
    tags: ["reaction", "counter"],
  },
  // §15.2 — cover: an interrupt on target_selected that redirects an enemy's
  // action onto the coverer.
  cover_ally: {
    id: "cover_ally",
    displayName: "Cover Ally (fixture)",
    rule: {
      id: "cover_ally_rule",
      listenTo: "target_selected",
      timing: "interrupt",
      priority: 10,
      predicates: [EVENT_SOURCE_IS_ENEMY, EVENT_TARGET_IS_ALLY],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "redirect_pending_target", target: SELF_TARGET }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
    tags: ["reaction", "guard"],
  },
  // §15.2 — hand the overflow of my own healing to somebody else.
  overflow_care: {
    id: "overflow_care",
    displayName: "Overflow Care (fixture)",
    rule: {
      id: "overflow_care_rule",
      listenTo: "excess_healing",
      timing: "after",
      priority: 100,
      predicates: [SELF_IS_EVENT_SOURCE],
      costs: [],
      effects: [
        {
          type: "heal",
          target: {
            scope: "allies",
            filters: [ALIVE, { type: "not_previous_target" }, { type: "hp_percent", op: "lt", value: 100 }],
            sort: ["hp_asc"],
            take: 1,
          },
          amount: { type: "event_value_scaled", key: "amount" },
          tags: ["care", "overflow"],
        },
      ],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
    tags: ["reaction", "care"],
  },
  // §15.2 — an action point when an enemy goes down.
  scavenge_ap: {
    id: "scavenge_ap",
    displayName: "Scavenge (fixture)",
    rule: {
      id: "scavenge_ap_rule",
      listenTo: "actor_defeated",
      timing: "after",
      priority: 100,
      predicates: [EVENT_TARGET_IS_ENEMY],
      costs: [],
      effects: [{ type: "gain_resource", target: SELF_TARGET, resource: "action_points", amount: constant(1) }],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
    },
    tags: ["reaction", "tempo"],
  },
  // §15.2 — barrier after moving.
  guard_step: {
    id: "guard_step",
    displayName: "Guard Step (fixture)",
    rule: {
      id: "guard_step_rule",
      listenTo: "actor_moved",
      timing: "after",
      priority: 100,
      predicates: [SELF_IS_EVENT_TARGET],
      costs: [],
      effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: constant(2), duration: "round" }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
    tags: ["reaction", "guard"],
  },
  // §15.2 — push an ally's preparation forward. R5 calls this a technical
  // fixture for ordering, not a recommended combo, and it is not carried into
  // production content by the implementer.
  urging: {
    id: "urging",
    displayName: "Urging (fixture, ordering witness only)",
    rule: {
      id: "urging_rule",
      listenTo: "preparation_started",
      timing: "after",
      priority: 100,
      // **まだ準備中の味方にしか反応しない。**
      // predicate が「味方が対象か」しか見ていなかったので、同じ準備開始に対して
      // 急かすを持つ全員が発火し、最初の一人で完了したあとも反応権を払っていた
      // （準備1段の溜め突きで、9点払って進んだのは3段。**6回が無駄撃ち**）。
      // 効果側の target は is_preparing を見ていたが、costs はその前に払われる。
      predicates: [
        EVENT_TARGET_IS_ALLY,
        {
          type: "target_exists",
          query: {
            scope: "allies",
            filters: [{ type: "is_event_primary_target" }, ALIVE, { type: "is_preparing", value: true }],
            take: 1,
          },
        },
      ],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [
        {
          type: "advance_preparation",
          target: { scope: "event_targets", filters: [ALIVE, { type: "is_preparing", value: true }], take: 1 },
          amount: constant(1),
        },
      ],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
    tags: ["reaction", "tempo"],
  },
  // §16 C — a second reaction on the same event. The default fixture lists
  // counter_blow first, while engine.test.mjs reverses the list to witness that
  // the player's same-actor loadout order wins over content priority.
  brace_after_hit: {
    id: "brace_after_hit",
    displayName: "Brace After Hit (fixture)",
    rule: {
      id: "brace_after_hit_rule",
      listenTo: "damage_taken",
      timing: "after",
      priority: 200,
      predicates: [SELF_IS_EVENT_TARGET],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: constant(2), duration: "round" }],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
    tags: ["reaction", "guard"],
  },

  // ---- Gate E (§16 E) --------------------------------------------------------
  triage_relay: {
    id: "triage_relay",
    displayName: "Triage Relay (fixture, Gate E)",
    rule: {
      id: "triage_relay_rule",
      listenTo: "excess_healing",
      timing: "after",
      priority: 90,
      predicates: [SELF_IS_EVENT_SOURCE, { type: "event_tag", tag: "triage", value: true }],
      costs: [{ type: "spend_reaction_points", amount: 1 }],
      effects: [
        {
          type: "heal",
          target: {
            scope: "allies",
            filters: [ALIVE, { type: "not_previous_target" }, { type: "hp_percent", op: "lt", value: 100 }],
            sort: ["hp_asc"],
            take: 1,
          },
          amount: { type: "event_value_scaled", key: "amount" },
          tags: ["care", "overflow"],
        },
      ],
      limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
    },
    tags: ["reaction", "care"],
  },

  // ---- §14 termination witnesses. All five stop on the "same owner, same rule,
  // once per chain" safety constraint rather than on an error (PREFLIGHT §6).
  ap_loop: {
    id: "ap_loop",
    displayName: "AP Loop (termination fixture)",
    rule: {
      id: "ap_loop_rule",
      listenTo: "resource_gained",
      timing: "after",
      priority: 100,
      predicates: [{ type: "event_tag", tag: "action_points", value: true }],
      costs: [],
      effects: [
        {
          type: "gain_resource",
          target: { scope: "allies", filters: [ALIVE, { type: "row_is", row: "front" }], take: 1 },
          resource: "action_points",
          amount: constant(1),
        },
      ],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 99 },
    },
    tags: ["termination"],
  },
  damage_echo: {
    id: "damage_echo",
    displayName: "Damage Echo (termination fixture)",
    rule: {
      id: "damage_echo_rule",
      listenTo: "damage_taken",
      timing: "after",
      priority: 100,
      predicates: [SELF_IS_EVENT_TARGET],
      costs: [],
      effects: [{ type: "deal_damage", target: EVENT_SOURCE_ACTOR, amount: constant(1), tags: ["echo"] }],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 99 },
    },
    tags: ["termination"],
  },
  barrier_bloom: {
    id: "barrier_bloom",
    displayName: "Barrier Bloom (termination fixture)",
    rule: {
      id: "barrier_bloom_rule",
      listenTo: "barrier_gained",
      timing: "after",
      priority: 100,
      predicates: [SELF_IS_EVENT_TARGET],
      costs: [],
      effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: constant(1), duration: "round" }],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 99 },
    },
    tags: ["termination"],
  },
  // PREFLIGHT §5 — a pair that hands the action point back and forth, so the
  // "eight activations per actor per round" ceiling actually gets reached.
  relay_front: {
    id: "relay_front",
    displayName: "Relay Front (termination fixture)",
    rule: {
      id: "relay_front_rule",
      listenTo: "action_resolved",
      timing: "after",
      priority: 100,
      predicates: [SELF_IS_EVENT_SOURCE],
      costs: [],
      effects: [
        {
          type: "gain_resource",
          target: { scope: "allies", filters: [ALIVE, { type: "row_is", row: "front" }], take: 1 },
          resource: "action_points",
          amount: constant(1),
        },
      ],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 99 },
    },
    tags: ["termination"],
  },
  relay_rear: {
    id: "relay_rear",
    displayName: "Relay Rear (termination fixture)",
    rule: {
      id: "relay_rear_rule",
      listenTo: "action_resolved",
      timing: "after",
      priority: 100,
      predicates: [SELF_IS_EVENT_SOURCE],
      costs: [],
      effects: [
        {
          type: "gain_resource",
          target: { scope: "allies", filters: [ALIVE, { type: "row_is", row: "rear" }], take: 1 },
          resource: "action_points",
          amount: constant(1),
        },
      ],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 99 },
    },
    tags: ["termination"],
  },
  prep_spiral: {
    id: "prep_spiral",
    displayName: "Preparation Spiral (termination fixture)",
    rule: {
      id: "prep_spiral_rule",
      listenTo: "preparation_advanced",
      timing: "after",
      priority: 100,
      predicates: [SELF_IS_EVENT_TARGET],
      costs: [],
      effects: [
        {
          type: "advance_preparation",
          target: { scope: "self", filters: [{ type: "is_preparing", value: true }], take: 1 },
          amount: constant(1),
        },
      ],
      limit: { owner: "actor-instance + rule", scope: "battle", count: 99 },
    },
    tags: ["termination"],
  },
};

const equipment = {
  // §15.3 asks for "the first active action of the round costs one less action
  // point". v1 has no cost-modifying effect, and an extra action point is NOT
  // the same thing: a point that goes unused can be banked by a rule such as
  // the pivot signature, while a discount that is never taken buys nothing
  // (PREFLIGHT §3). So this item is not a stand-in for a discount. It is what
  // it says: one extra action point when its holder activates.
  worn_greaves: {
    id: "worn_greaves",
    displayName: "Worn Greaves — an extra action point on activation (fixture)",
    maxDurability: 2,
    rules: [
      {
        id: "worn_greaves_rule",
        listenTo: "actor_activated",
        timing: "after",
        priority: 50,
        predicates: [SELF_IS_EVENT_TARGET],
        costs: [],
        effects: [{ type: "gain_resource", target: SELF_TARGET, resource: "action_points", amount: constant(1) }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      },
    ],
    tags: ["fixture"],
  },
  // §15.3 — read excess_damage and turn it into a small hit, wearing itself out.
  splinter_edge: {
    id: "splinter_edge",
    displayName: "Splinter Edge (fixture)",
    maxDurability: 2,
    rules: [
      {
        id: "splinter_edge_rule",
        listenTo: "excess_damage",
        timing: "after",
        priority: 100,
        predicates: [SELF_IS_EVENT_SOURCE],
        costs: [{ type: "wear_equipment", amount: 1 }],
        effects: [{ type: "deal_damage", target: WEAKEST_ENEMY, amount: constant(1), tags: ["splinter"] }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      },
    ],
    tags: ["fixture"],
  },
  // §15.3 — spend an unused reaction point at the end of the round to repair
  // itself by one. The repair stops at maxDurability and never revives an item
  // that already broke (§5.6), so a kit that reached zero stays dead for the
  // rest of the battle and cannot mend itself back into play.
  field_kit: {
    id: "field_kit",
    displayName: "Field Kit (fixture)",
    maxDurability: 2,
    rules: [
      {
        id: "field_kit_rule",
        listenTo: "resource_unused",
        timing: "after",
        priority: 100,
        predicates: [
          SELF_IS_EVENT_TARGET,
          { type: "event_tag", tag: "reaction_points", value: true },
          { type: "event_value", key: "amount", op: "gte", value: 1 },
        ],
        costs: [{ type: "spend_reaction_points", amount: 1 }],
        effects: [{ type: "repair_equipment", amount: constant(1) }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      },
    ],
    tags: ["fixture"],
  },
  // §15.3 — a battle duration barrier from the opening event.
  standing_plate: {
    id: "standing_plate",
    displayName: "Standing Plate (fixture)",
    maxDurability: 3,
    rules: [
      {
        id: "standing_plate_rule",
        listenTo: "battle_started",
        timing: "after",
        priority: 100,
        predicates: [{ type: "always" }],
        costs: [],
        effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: constant(2), duration: "battle" }],
        limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
      },
    ],
    tags: ["fixture"],
  },
  // ---- Gate E (§16 E) --------------------------------------------------------
  // "Strengthen the action after a move." The focused status already means
  // "your next damage or healing is one larger", so the item only has to hand
  // it over on actor_moved.
  momentum_rig: {
    id: "momentum_rig",
    displayName: "Momentum Rig (fixture, Gate E)",
    maxDurability: 2,
    rules: [
      {
        id: "momentum_rig_rule",
        listenTo: "actor_moved",
        timing: "after",
        priority: 90,
        predicates: [SELF_IS_EVENT_TARGET],
        costs: [{ type: "wear_equipment", amount: 1 }],
        effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
        limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
      },
    ],
    tags: ["fixture", "gate_e"],
  },
  // §14 — an item that reacts to its own wear.
  hungry_plate: {
    id: "hungry_plate",
    displayName: "Hungry Plate (termination fixture)",
    maxDurability: 3,
    rules: [
      {
        id: "hungry_plate_open_rule",
        listenTo: "battle_started",
        timing: "after",
        priority: 100,
        predicates: [{ type: "always" }],
        costs: [{ type: "wear_equipment", amount: 1 }],
        effects: [],
        limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
      },
      {
        id: "hungry_plate_rule",
        listenTo: "equipment_worn",
        timing: "after",
        priority: 100,
        predicates: [SELF_IS_EVENT_TARGET],
        costs: [{ type: "wear_equipment", amount: 1 }],
        effects: [],
        limit: { owner: "actor-instance + rule", scope: "battle", count: 99 },
      },
    ],
    tags: ["termination"],
  },
};

const statuses = {
  // §15.4 — the holder takes one more from every damage proposal.
  exposed: {
    id: "exposed",
    displayName: "Exposed (fixture)",
    polarity: "negative",
    maxStacks: 2,
    duration: "round",
    rules: [
      {
        id: "exposed_rule",
        listenTo: "damage_proposed",
        timing: "interrupt",
        priority: 50,
        predicates: [SELF_IS_EVENT_TARGET],
        costs: [],
        effects: [{ type: "modify_pending_amount", operation: "increase", amount: constant(1) }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      },
    ],
    tags: ["fixture"],
  },
  // §15.4 — the holder's next damage, healing or barrier is one larger, then
  // the status is gone. The barrier third needs the barrier_proposed event
  // added in PREFLIGHT §14; without it that third of this fixture is unwritable.
  focused: {
    id: "focused",
    displayName: "Focused (fixture)",
    polarity: "positive",
    maxStacks: 1,
    duration: "battle",
    rules: [
      {
        id: "focused_damage_rule",
        listenTo: "damage_proposed",
        timing: "interrupt",
        priority: 40,
        predicates: [SELF_IS_EVENT_SOURCE],
        costs: [],
        effects: [
          { type: "modify_pending_amount", operation: "increase", amount: constant(1) },
          { type: "remove_status", target: SELF_TARGET, statusId: "focused", stacks: "all" },
        ],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      },
      {
        id: "focused_healing_rule",
        listenTo: "healing_proposed",
        timing: "interrupt",
        priority: 40,
        predicates: [SELF_IS_EVENT_SOURCE],
        costs: [],
        effects: [
          { type: "modify_pending_amount", operation: "increase", amount: constant(1) },
          { type: "remove_status", target: SELF_TARGET, statusId: "focused", stacks: "all" },
        ],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      },
      {
        id: "focused_barrier_rule",
        listenTo: "barrier_proposed",
        timing: "interrupt",
        priority: 40,
        predicates: [SELF_IS_EVENT_SOURCE],
        costs: [],
        effects: [
          { type: "modify_pending_amount", operation: "increase", amount: constant(1) },
          { type: "remove_status", target: SELF_TARGET, statusId: "focused", stacks: "all" },
        ],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      },
    ],
    tags: ["fixture"],
  },
};

const enemyActors = {
  husk: {
    id: "husk",
    displayName: "Husk (fixture)",
    maxHp: 10,
    baseActionPoints: 1,
    baseReactionPoints: 0,
    tactics: [{ activeSkillId: "strike", useWhen: [] }],
    reactiveSkillIds: [],
    intrinsicRules: [],
    tags: ["fixture"],
  },
  // A named definition so defeat_definition has something to point at that is
  // not an instance id (§13).
  husk_warden: {
    id: "husk_warden",
    displayName: "Husk Warden (fixture)",
    maxHp: 8,
    baseActionPoints: 1,
    baseReactionPoints: 0,
    tactics: [{ activeSkillId: "strike", useWhen: [] }],
    reactiveSkillIds: [],
    intrinsicRules: [],
    tags: ["fixture", "objective"],
  },
  // No tactics, no rules: nothing about it can change any state, which is what
  // the stalemate fixture needs (§11.6).
  still_husk: {
    id: "still_husk",
    displayName: "Still Husk (fixture)",
    maxHp: 10,
    baseActionPoints: 0,
    baseReactionPoints: 0,
    tactics: [],
    reactiveSkillIds: [],
    intrinsicRules: [],
    tags: ["fixture", "inert"],
  },
  // ---- Gate E (§16 E) --------------------------------------------------------
  husk_hunter: {
    id: "husk_hunter",
    displayName: "Husk Hunter (fixture, Gate E)",
    maxHp: 26,
    baseActionPoints: 1,
    baseReactionPoints: 0,
    tactics: [
      { activeSkillId: "hunt_the_slow", useWhen: [] },
      { activeSkillId: "strike", useWhen: [] },
    ],
    reactiveSkillIds: [],
    intrinsicRules: [],
    tags: ["fixture", "gate_e"],
  },
  // A durable body, so a fixture that needs several rounds to observe an
  // ordering rule does not end early by accident.
  husk_bulwark: {
    id: "husk_bulwark",
    displayName: "Husk Bulwark (fixture)",
    maxHp: 40,
    baseActionPoints: 1,
    baseReactionPoints: 0,
    tactics: [{ activeSkillId: "strike", useWhen: [] }],
    reactiveSkillIds: [],
    intrinsicRules: [],
    tags: ["fixture", "durable"],
  },
  // Carries the echo reaction, so damage_taken can bounce between two sides.
  husk_echo: {
    id: "husk_echo",
    displayName: "Husk Echo (termination fixture)",
    maxHp: 30,
    baseActionPoints: 1,
    baseReactionPoints: 0,
    tactics: [{ activeSkillId: "strike", useWhen: [] }],
    reactiveSkillIds: ["damage_echo"],
    intrinsicRules: [],
    tags: ["termination"],
  },
  // An enemy that applies the negative status, so a status reaching the field
  // is data driven rather than pre-seeded by the battle input.
  husk_marker: {
    id: "husk_marker",
    displayName: "Husk Marker (fixture)",
    maxHp: 30,
    baseActionPoints: 1,
    baseReactionPoints: 0,
    tactics: [{ activeSkillId: "mark_target", useWhen: [] }],
    reactiveSkillIds: [],
    intrinsicRules: [],
    tags: ["fixture"],
  },
};

// The marker's skill lives with the other active skills; declared after the
// enemy table only because it is the only skill no ally uses.
activeSkills.mark_target = {
  id: "mark_target",
  displayName: "Mark Target (fixture)",
  apCost: 1,
  intrinsicPredicates: [],
  targetQuery: { scope: "enemies", filters: [ALIVE], sort: ["hp_desc"], take: 1 },
  effects: [
    {
      type: "add_status",
      target: { scope: "event_targets", filters: [ALIVE], take: 1 },
      statusId: "exposed",
      stacks: 1,
    },
  ],
  tags: ["debuff"],
};

// Puts the positive status on its user, so `focused` has a data driven way onto
// the field. Nothing in the engine knows this skill exists.
activeSkills.steady_aim = {
  id: "steady_aim",
  displayName: "Steady Aim (fixture)",
  apCost: 1,
  intrinsicPredicates: [{ type: "has_status", subject: "self", statusId: "focused", op: "eq", value: 0 }],
  targetQuery: SELF_TARGET,
  effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
  tags: ["buff"],
};

export const FIXTURE_CONTENT = deepFreeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  contentVersion: "fixture-1",
  characters,
  activeSkills,
  reactiveSkills,
  // PHASE A: fixture は passive を使わないが、節そのものは必ず在る
  // （空の節と、節が無いことは別。validator は後者を拒否する）。
  passiveSkills: {},
  equipment,
  statuses,
  enemyActors,
});

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

// §15 — what each fixture is the witness for. engine.test.mjs asserts this table
// stays in step with the bundle, so a fixture cannot quietly lose its reason.
export const FIXTURE_COVERAGE = deepFreeze({
  strike: "§15.1 single target damage; §12.1 damage pipeline",
  mend: "§15.1 healing and excess_healing; §12.2",
  bulwark: "§15.1 round barrier; §12.3",
  relay_order: "§15.1 giving an ally action points; §11.3 requeue",
  heavy_swing: "§15.1 one step preparation then a large hit; §12.4",
  reposition: "§15.1 same side position swap; §12.5",
  mark_target: "status arriving from content rather than from the battle input",
  steady_aim: "§15.4 a data driven way to put the positive status on an actor",
  long_swing: "§14 a three step preparation for the advance loop",
  idle_shuffle: "PREFLIGHT §6 free action loop; §14 event cap must error",
  counter_blow: "§15.2 counter after damage_taken; history_count(chain)",
  cover_ally: "§15.2 cover and redirect on target_selected; §16C target_changed",
  overflow_care: "§15.2 excess_healing handed to another ally; not_previous_target",
  scavenge_ap: "§15.2 action point on actor_defeated; §13 outcome after the reaction",
  guard_step: "§15.2 barrier after actor_moved",
  urging: "§15.2 external preparation advance (ordering witness only)",
  brace_after_hit: "§16C same-actor reactive order wins over content priority",
  ap_loop: "§14 two rules feeding each other action points",
  damage_echo: "§14 two rules answering damage_taken with damage",
  barrier_bloom: "§14 a rule answering barrier_gained with barrier",
  prep_spiral: "§14 a rule re-firing preparation_advanced on itself",
  relay_front: "PREFLIGHT §5 activation ceiling, half of the ping pong",
  relay_rear: "PREFLIGHT §5 activation ceiling, the other half",
  worn_greaves: "§15.3 an extra action point on activation (PREFLIGHT §3, not a cost discount)",
  splinter_edge: "§15.3 excess_damage read by equipment; §5.6 broken stops supplying",
  field_kit: "§15.3 spends an unused reaction point to repair itself; clamps at maxDurability",
  standing_plate: "§15.3 battle duration barrier",
  hungry_plate: "§14 equipment reacting to its own wear",
  triage: "Gate E: heal an ally at or below half health",
  triage_relay: "Gate E: hand the overflow of that heal to somebody else",
  hunt_the_slow: "Gate E: an enemy tactic that prefers a preparing target",
  momentum_rig: "Gate E: equipment that strengthens the action after a move",
  exposed: "§15.4 negative status raising incoming damage proposals",
  focused: "§15.4 positive status raising the holder's next damage, healing or barrier",
});
