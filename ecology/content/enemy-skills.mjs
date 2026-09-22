// ecology/content/enemy-skills.mjs
//
// Enemy AI owns a separate skill registry. Player weapon skills never enter this
// module, and only skills referenced by enemy actors are kept here.

export const ENEMY_ACTIVE_SKILL_IDS = Object.freeze([
  "barrage_strike",
  "column_thrust",
  "crack_mark",
  "drag_forward",
  "enemy_guard",
  "enemy_heavy",
  "execute_low",
  "finishing_thrust",
  "front_strike",
  "guard_crush",
  "hamstring",
  "hunt_the_slow",
  "mark_spread",
  "mark_target",
  "pierce_thrust",
  "rear_hunt",
  "rear_strike",
  "rend",
  "row_sweep",
  "shield_wall",
  "spread_the_guard",
  "strike"
]);

export const ENEMY_REACTIVE_SKILL_IDS = Object.freeze([
  "cover_ally",
  "counter_blow",
  "mend"
]);

export const ENEMY_ACTIVE_SKILLS = Object.freeze({
  "barrage_strike": {
    "id": "barrage_strike",
    "displayName": "連撃",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "position_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "sort": [
            "position_asc"
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 4500
        },
        "hitCount": 3,
        "tags": [
          "attack",
          "weapon",
          "onhit"
        ],
        "reach": "melee"
      }
    ],
    "tags": [
      "attack",
      "onhit"
    ]
  },
  "column_thrust": {
    "id": "column_thrust",
    "displayName": "突き通し",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "position_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "sort": [
            "position_asc"
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 11000
        },
        "tags": [
          "attack",
          "weapon"
        ],
        "targetPattern": "column",
        "reach": "melee"
      }
    ],
    "tags": [
      "attack"
    ]
  },
  "crack_mark": {
    "id": "crack_mark",
    "displayName": "傷口を開く",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "has_status",
          "statusId": "exposed",
          "op": "eq",
          "value": 0
        }
      ],
      "sort": [
        "position_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "focus",
          "coefficientBps": 9000
        },
        "tags": [
          "attack",
          "debuff",
          "technique"
        ],
        "reach": "melee"
      },
      {
        "type": "add_status",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "statusId": "exposed",
        "stacks": 1
      }
    ],
    "tags": [
      "attack",
      "debuff"
    ]
  },
  "drag_forward": {
    "id": "drag_forward",
    "displayName": "引きずり出す",
    "apCost": 1,
    "actionMode": "utility",
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "row_is",
              "row": "rear"
            }
          ],
          "sort": [
            "hp_asc"
          ],
          "take": "all"
        }
      },
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "row_is",
              "row": "front"
            }
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "row_is",
          "row": "rear"
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "swap_positions",
        "target": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "row_is",
              "row": "rear"
            }
          ],
          "sort": [
            "hp_asc"
          ],
          "take": 1
        },
        "reach": "unrestricted",
        "otherTarget": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "sort": [
            "position_asc"
          ],
          "take": 1
        }
      },
      {
        "type": "add_status",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "statusId": "exposed",
        "stacks": 1
      }
    ],
    "tags": [
      "move",
      "formation",
      "debuff"
    ]
  },
  "enemy_guard": {
    "id": "enemy_guard",
    "displayName": "盾を構える",
    "apCost": 1,
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "self",
      "take": 1
    },
    "effects": [
      {
        "type": "gain_barrier",
        "target": {
          "scope": "self",
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "focus",
          "coefficientBps": 10000
        },
        "duration": "round"
      }
    ],
    "tags": [
      "guard"
    ],
    "actionMode": "utility"
  },
  "enemy_heavy": {
    "id": "enemy_heavy",
    "displayName": "重い一撃",
    "apCost": 1,
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [],
    "preparation": {
      "steps": 1,
      "completionEffects": [
        {
          "type": "deal_damage",
          "target": {
            "scope": "enemies",
            "filters": [
              {
                "type": "alive"
              }
            ],
            "sort": [
              "hp_asc"
            ],
            "take": 1
          },
          "amount": {
            "type": "stat_scaled",
            "subject": "self",
            "scalingStat": "might",
            "coefficientBps": 35000
          },
          "tags": [
            "attack",
            "heavy"
          ],
          "reach": "melee"
        }
      ]
    },
    "tags": [
      "attack",
      "slow"
    ],
    "actionMode": "channel"
  },
  "execute_low": {
    "id": "execute_low",
    "displayName": "首を落とす",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "hp_percent",
              "op": "lte",
              "value": 30
            }
          ],
          "sort": [
            "hp_asc"
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "hp_percent",
          "op": "lte",
          "value": 30
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 22500
        },
        "reach": "melee",
        "tags": [
          "attack",
          "weapon"
        ]
      }
    ],
    "tags": [
      "attack",
      "execute"
    ]
  },
  "finishing_thrust": {
    "id": "finishing_thrust",
    "displayName": "止めの一突き",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "hp_percent",
              "op": "lte",
              "value": 50
            }
          ],
          "sort": [
            "hp_asc"
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "hp_percent",
          "op": "lte",
          "value": 50
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 15000
        },
        "tags": [
          "attack"
        ],
        "reach": "melee"
      }
    ],
    "tags": [
      "attack"
    ]
  },
  "front_strike": {
    "id": "front_strike",
    "displayName": "前列打ち",
    "apCost": 1,
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 10000
        },
        "reach": "melee",
        "tags": [
          "attack"
        ]
      }
    ],
    "tags": [
      "attack"
    ],
    "actionMode": "offense"
  },
  "guard_crush": {
    "id": "guard_crush",
    "displayName": "受け崩し",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "position_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 15000
        },
        "tags": [
          "attack"
        ],
        "guardPierceBps": 10000,
        "reach": "melee"
      }
    ],
    "tags": [
      "attack"
    ]
  },
  "hamstring": {
    "id": "hamstring",
    "displayName": "足を払う",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "position_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 10000
        },
        "reach": "melee",
        "tags": [
          "attack",
          "weapon"
        ]
      },
      {
        "type": "add_status",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "statusId": "staggered",
        "stacks": 1
      }
    ],
    "tags": [
      "attack",
      "debuff"
    ]
  },
  "hunt_the_slow": {
    "id": "hunt_the_slow",
    "displayName": "準備狩り",
    "apCost": 1,
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "is_preparing",
              "value": true
            }
          ],
          "sort": [
            "hp_asc"
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "is_preparing",
          "value": true
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "focus",
          "coefficientBps": 14500
        },
        "tags": [
          "attack",
          "hunt",
          "technique"
        ],
        "reach": "melee"
      }
    ],
    "tags": [
      "attack"
    ],
    "actionMode": "offense"
  },
  "mark_spread": {
    "id": "mark_spread",
    "displayName": "刻印を散らす",
    "apCost": 1,
    "actionMode": "utility",
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "has_status",
              "statusId": "exposed",
              "op": "eq",
              "value": 0
            }
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "has_status",
          "statusId": "exposed",
          "op": "eq",
          "value": 0
        }
      ],
      "take": "all"
    },
    "effects": [
      {
        "type": "add_status",
        "target": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "has_status",
              "statusId": "exposed",
              "op": "eq",
              "value": 0
            }
          ],
          "take": "all"
        },
        "statusId": "exposed",
        "stacks": 1,
        "reach": "unrestricted"
      }
    ],
    "tags": [
      "mark",
      "debuff"
    ]
  },
  "mark_target": {
    "id": "mark_target",
    "displayName": "隙を刻む",
    "apCost": 1,
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "has_status",
              "statusId": "exposed",
              "op": "eq",
              "value": 0
            }
          ],
          "sort": [
            "hp_desc"
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "has_status",
          "statusId": "exposed",
          "op": "eq",
          "value": 0
        }
      ],
      "sort": [
        "hp_desc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "add_status",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "statusId": "exposed",
        "stacks": 1
      }
    ],
    "tags": [
      "debuff"
    ],
    "actionMode": "utility"
  },
  "pierce_thrust": {
    "id": "pierce_thrust",
    "displayName": "貫き突き",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "position_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "sort": [
            "position_asc"
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 12000
        },
        "tags": [
          "attack",
          "weapon"
        ],
        "guardPierceBps": 6000,
        "reach": "melee"
      }
    ],
    "tags": [
      "attack"
    ]
  },
  "rear_hunt": {
    "id": "rear_hunt",
    "displayName": "後衛狩り",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "row_is",
              "row": "rear"
            }
          ],
          "sort": [
            "hp_asc"
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "row_is",
          "row": "rear"
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "focus",
          "coefficientBps": 11000
        },
        "tags": [
          "attack",
          "technique"
        ],
        "reach": "ranged"
      }
    ],
    "tags": [
      "attack"
    ]
  },
  "rear_strike": {
    "id": "rear_strike",
    "displayName": "後列打ち",
    "apCost": 1,
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "row_is",
          "row": "rear"
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "focus",
          "coefficientBps": 10000
        },
        "reach": "ranged",
        "tags": [
          "attack"
        ]
      }
    ],
    "tags": [
      "attack"
    ],
    "actionMode": "offense"
  },
  "rend": {
    "id": "rend",
    "displayName": "抉る",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "position_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 11500
        },
        "reach": "melee",
        "tags": [
          "attack",
          "weapon"
        ]
      },
      {
        "type": "add_status",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "statusId": "bleeding",
        "stacks": 2
      }
    ],
    "tags": [
      "attack",
      "debuff"
    ]
  },
  "row_sweep": {
    "id": "row_sweep",
    "displayName": "薙ぎ払い",
    "apCost": 1,
    "actionMode": "offense",
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 2,
        "query": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "row_is",
              "row": "front"
            }
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        },
        {
          "type": "row_is",
          "row": "front"
        }
      ],
      "sort": [
        "position_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "enemies",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "sort": [
            "position_asc"
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 8000
        },
        "tags": [
          "attack",
          "weapon"
        ],
        "targetPattern": "row",
        "reach": "melee"
      }
    ],
    "tags": [
      "attack"
    ]
  },
  "shield_wall": {
    "id": "shield_wall",
    "displayName": "盾の列",
    "apCost": 1,
    "actionMode": "utility",
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "self",
      "take": 1
    },
    "effects": [
      {
        "type": "gain_barrier",
        "target": {
          "scope": "allies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "row_is",
              "row": "front"
            }
          ],
          "take": "all"
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "focus",
          "coefficientBps": 7000
        },
        "duration": "round"
      }
    ],
    "tags": [
      "guard",
      "formation"
    ]
  },
  "spread_the_guard": {
    "id": "spread_the_guard",
    "displayName": "構えを配る",
    "apCost": 1,
    "actionMode": "utility",
    "intrinsicPredicates": [
      {
        "type": "target_exists",
        "op": "gte",
        "value": 1,
        "query": {
          "scope": "allies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "row_is",
              "row": "front"
            },
            {
              "type": "not_self"
            }
          ],
          "take": "all"
        }
      }
    ],
    "targetQuery": {
      "scope": "self",
      "take": 1
    },
    "effects": [
      {
        "type": "gain_block",
        "target": {
          "scope": "allies",
          "filters": [
            {
              "type": "alive"
            },
            {
              "type": "row_is",
              "row": "front"
            },
            {
              "type": "not_self"
            }
          ],
          "take": "all"
        },
        "amount": {
          "type": "constant",
          "value": 1
        }
      }
    ],
    "tags": [
      "guard",
      "formation"
    ]
  },
  "strike": {
    "id": "strike",
    "displayName": "斬撃",
    "apCost": 1,
    "intrinsicPredicates": [],
    "targetQuery": {
      "scope": "enemies",
      "filters": [
        {
          "type": "alive"
        }
      ],
      "sort": [
        "hp_asc"
      ],
      "take": 1
    },
    "effects": [
      {
        "type": "deal_damage",
        "target": {
          "scope": "event_targets",
          "filters": [
            {
              "type": "alive"
            }
          ],
          "take": 1
        },
        "amount": {
          "type": "stat_scaled",
          "subject": "self",
          "scalingStat": "might",
          "coefficientBps": 12000
        },
        "reach": "melee",
        "tags": [
          "attack"
        ]
      }
    ],
    "tags": [
      "attack"
    ],
    "actionMode": "offense"
  }
});

export const ENEMY_REACTIVE_SKILLS = Object.freeze({
  "cover_ally": {
    "id": "cover_ally",
    "displayName": "身代わり",
    "rule": {
      "id": "cover_ally_rule",
      "listenTo": "target_selected",
      "timing": "interrupt",
      "priority": 10,
      "predicates": [
        {
          "type": "target_exists",
          "query": {
            "scope": "enemies",
            "filters": [
              {
                "type": "is_event_source"
              },
              {
                "type": "alive"
              }
            ],
            "take": 1
          }
        },
        {
          "type": "target_exists",
          "query": {
            "scope": "allies",
            "filters": [
              {
                "type": "is_event_primary_target"
              }
            ],
            "take": 1
          }
        },
        {
          "type": "target_exists",
          "query": {
            "scope": "allies",
            "filters": [
              {
                "type": "alive"
              },
              {
                "type": "not_self"
              },
              {
                "type": "is_event_primary_target"
              }
            ],
            "take": 1
          }
        }
      ],
      "costs": [
        {
          "type": "spend_reaction_points",
          "amount": 1
        }
      ],
      "effects": [
        {
          "type": "redirect_pending_target",
          "target": {
            "scope": "self",
            "take": 1
          }
        }
      ],
      "limit": {
        "owner": "actor-instance + rule",
        "scope": "chain",
        "count": 1
      }
    },
    "tags": [
      "reaction",
      "guard"
    ]
  },
  "counter_blow": {
    "id": "counter_blow",
    "displayName": "反撃",
    "rule": {
      "id": "counter_blow_rule",
      "listenTo": "damage_taken",
      "timing": "after",
      "priority": 100,
      "predicates": [
        {
          "type": "target_exists",
          "query": {
            "scope": "self",
            "filters": [
              {
                "type": "is_event_primary_target"
              }
            ],
            "take": 1
          }
        },
        {
          "type": "target_exists",
          "query": {
            "scope": "enemies",
            "filters": [
              {
                "type": "is_event_source"
              },
              {
                "type": "alive"
              }
            ],
            "take": 1
          }
        },
        {
          "type": "event_tag",
          "tag": "cost",
          "value": false
        }
      ],
      "costs": [
        {
          "type": "spend_reaction_points",
          "amount": 1
        }
      ],
      "effects": [
        {
          "type": "deal_damage",
          "target": {
            "scope": "event_source",
            "filters": [
              {
                "type": "alive"
              }
            ],
            "take": 1
          },
          "amount": {
            "type": "stat_scaled",
            "subject": "self",
            "scalingStat": "might",
            "coefficientBps": 5000
          },
          "tags": [
            "counter"
          ]
        }
      ],
      "limit": {
        "owner": "actor-instance + rule",
        "scope": "chain",
        "count": 1
      }
    },
    "tags": [
      "reaction",
      "counter"
    ]
  },
  "mend": {
    "id": "mend",
    "displayName": "手当て",
    "rule": {
      "id": "mend_rule",
      "listenTo": "damage_taken",
      "timing": "after",
      "priority": 160,
      "predicates": [
        {
          "type": "target_exists",
          "query": {
            "scope": "allies",
            "filters": [
              {
                "type": "alive"
              },
              {
                "type": "is_event_primary_target"
              }
            ],
            "take": 1
          }
        },
        {
          "type": "event_tag",
          "tag": "cost",
          "value": false
        }
      ],
      "costs": [
        {
          "type": "spend_reaction_points",
          "amount": 1
        }
      ],
      "effects": [
        {
          "type": "heal",
          "target": {
            "scope": "allies",
            "filters": [
              {
                "type": "alive"
              },
              {
                "type": "is_event_primary_target"
              }
            ],
            "take": 1
          },
          "amount": {
            "type": "stat_scaled",
            "subject": "self",
            "scalingStat": "focus",
            "coefficientBps": 2500
          },
          "tags": [
            "care"
          ]
        }
      ],
      "limit": {
        "owner": "actor-instance + rule",
        "scope": "chain",
        "count": 1
      }
    },
    "tags": [
      "reaction",
      "care"
    ]
  }
});

export const ENEMY_PASSIVE_SKILLS = Object.freeze({});
