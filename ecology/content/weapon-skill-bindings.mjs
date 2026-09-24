// Stage 0 migration metadata only. This file is deliberately not imported by the runtime.
// IDs and prerequisites are copied from PR #288's tree declarations at the pinned source commit.
// The old tree kinds below are evidence for discrepancy checks, not runtime classification.

export const WEAPON_SKILL_BINDING_SOURCE = Object.freeze({
  repository: "KKawamura1/garakuta-lab",
  pullRequest: 288,
  commit: "1d3855cac3da825a0c470a411d316f86abd0633b",
  sourceModules: Object.freeze([
    "ecology/content/weapon-warhammer.mjs",
    "ecology/content/weapon-gauntlets.mjs",
    "ecology/content/weapon-launcher.mjs",
    "ecology/content/weapon-medical-kit.mjs",
    "ecology/content/weapon-tower-shield.mjs",
    "ecology/content/weapon-long-spear.mjs",
    "ecology/content/weapon-grappling-hook.mjs",
    "ecology/content/weapon-dual-blades.mjs",
    "ecology/content/weapon-banner.mjs",
    "ecology/content/weapon-heavy-crossbow.mjs"
  ]),
  startingWeaponsSourceModule: "ecology/content/weapon-trees.mjs",
  auditDocument: "https://github.com/KKawamura1/garakuta-lab/blob/1d3855cac3da825a0c470a411d316f86abd0633b/docs/skill-reboot/14-pr288-implementation-audit-2026-09-24.md",
});

export const WEAPON_SKILL_BINDINGS = Object.freeze([
  {
    "weaponId": "warhammer",
    "position": "R",
    "skillId": "warhammer_blow",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "A1",
    "skillId": "warhammer_heavy_head",
    "prerequisiteSkillIds": [
      "warhammer_blow"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "A2",
    "skillId": "warhammer_ringing_iron",
    "prerequisiteSkillIds": [
      "warhammer_heavy_head"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "A3",
    "skillId": "warhammer_heavy_blow",
    "prerequisiteSkillIds": [
      "warhammer_ringing_iron"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "AA1",
    "skillId": "warhammer_iron_mass",
    "prerequisiteSkillIds": [
      "warhammer_heavy_blow"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "AA2",
    "skillId": "warhammer_deep_impact",
    "prerequisiteSkillIds": [
      "warhammer_iron_mass"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "AA3",
    "skillId": "warhammer_heaven_blow",
    "prerequisiteSkillIds": [
      "warhammer_deep_impact"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "AB1",
    "skillId": "warhammer_wide_swing",
    "prerequisiteSkillIds": [
      "warhammer_heavy_blow"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "AB2",
    "skillId": "warhammer_sweep",
    "prerequisiteSkillIds": [
      "warhammer_wide_swing"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "AB3",
    "skillId": "warhammer_earth_splitter",
    "prerequisiteSkillIds": [
      "warhammer_sweep"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "B1",
    "skillId": "warhammer_point_at_armor",
    "prerequisiteSkillIds": [
      "warhammer_blow"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "B2",
    "skillId": "warhammer_break_point",
    "prerequisiteSkillIds": [
      "warhammer_point_at_armor"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "B3",
    "skillId": "warhammer_siege_blow",
    "prerequisiteSkillIds": [
      "warhammer_break_point"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "BA1",
    "skillId": "warhammer_broken_armor",
    "prerequisiteSkillIds": [
      "warhammer_siege_blow"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "BA2",
    "skillId": "warhammer_breaking_sound",
    "prerequisiteSkillIds": [
      "warhammer_broken_armor"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "BA3",
    "skillId": "warhammer_dismantler",
    "prerequisiteSkillIds": [
      "warhammer_breaking_sound"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "BB1",
    "skillId": "warhammer_trophy_fragment",
    "prerequisiteSkillIds": [
      "warhammer_siege_blow"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "BB2",
    "skillId": "warhammer_reverse_forging",
    "prerequisiteSkillIds": [
      "warhammer_trophy_fragment"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "warhammer",
    "position": "BB3",
    "skillId": "warhammer_kingslayer",
    "prerequisiteSkillIds": [
      "warhammer_reverse_forging"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-warhammer.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "R",
    "skillId": "gauntlets_punch",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "A1",
    "skillId": "gauntlets_grip",
    "prerequisiteSkillIds": [
      "gauntlets_punch"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "A2",
    "skillId": "gauntlets_chasing_fist",
    "prerequisiteSkillIds": [
      "gauntlets_grip"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "A3",
    "skillId": "gauntlets_double_punch",
    "prerequisiteSkillIds": [
      "gauntlets_chasing_fist"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "AA1",
    "skillId": "gauntlets_combo_fists",
    "prerequisiteSkillIds": [
      "gauntlets_double_punch"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "AA2",
    "skillId": "gauntlets_pressure",
    "prerequisiteSkillIds": [
      "gauntlets_combo_fists"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "AA3",
    "skillId": "gauntlets_hundred_fists",
    "prerequisiteSkillIds": [
      "gauntlets_pressure"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "AB1",
    "skillId": "gauntlets_knuckle_guard",
    "prerequisiteSkillIds": [
      "gauntlets_double_punch"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "AB2",
    "skillId": "gauntlets_strike_guard",
    "prerequisiteSkillIds": [
      "gauntlets_knuckle_guard"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "AB3",
    "skillId": "gauntlets_iron_body",
    "prerequisiteSkillIds": [
      "gauntlets_strike_guard"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "B1",
    "skillId": "gauntlets_watch_target",
    "prerequisiteSkillIds": [
      "gauntlets_punch"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "B2",
    "skillId": "gauntlets_streak",
    "prerequisiteSkillIds": [
      "gauntlets_watch_target"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "B3",
    "skillId": "gauntlets_barrage",
    "prerequisiteSkillIds": [
      "gauntlets_streak"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "BA1",
    "skillId": "gauntlets_footwork",
    "prerequisiteSkillIds": [
      "gauntlets_barrage"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "BA2",
    "skillId": "gauntlets_empty_pocket",
    "prerequisiteSkillIds": [
      "gauntlets_footwork"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "BA3",
    "skillId": "gauntlets_flying_knee",
    "prerequisiteSkillIds": [
      "gauntlets_empty_pocket"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "BB1",
    "skillId": "gauntlets_form_record",
    "prerequisiteSkillIds": [
      "gauntlets_barrage"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "BB2",
    "skillId": "gauntlets_borrowed_stance",
    "prerequisiteSkillIds": [
      "gauntlets_form_record"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "gauntlets",
    "position": "BB3",
    "skillId": "gauntlets_empty_hand",
    "prerequisiteSkillIds": [
      "gauntlets_borrowed_stance"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-gauntlets.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "R",
    "skillId": "launcher_shot",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "A1",
    "skillId": "launcher_high_pressure",
    "prerequisiteSkillIds": [
      "launcher_shot"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "A2",
    "skillId": "launcher_piercing_needle",
    "prerequisiteSkillIds": [
      "launcher_high_pressure"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "A3",
    "skillId": "launcher_large_shot",
    "prerequisiteSkillIds": [
      "launcher_piercing_needle"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "AA1",
    "skillId": "launcher_compressed_charge",
    "prerequisiteSkillIds": [
      "launcher_large_shot"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "AA2",
    "skillId": "launcher_hard_core",
    "prerequisiteSkillIds": [
      "launcher_compressed_charge"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "AA3",
    "skillId": "launcher_siege_shot",
    "prerequisiteSkillIds": [
      "launcher_hard_core"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "AB1",
    "skillId": "launcher_multi_barrel",
    "prerequisiteSkillIds": [
      "launcher_large_shot"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "AB2",
    "skillId": "launcher_support_shell",
    "prerequisiteSkillIds": [
      "launcher_multi_barrel"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "AB3",
    "skillId": "launcher_double_shot",
    "prerequisiteSkillIds": [
      "launcher_support_shell"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "B1",
    "skillId": "launcher_pull_healer",
    "prerequisiteSkillIds": [
      "launcher_shot"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "B2",
    "skillId": "launcher_skip_preparation",
    "prerequisiteSkillIds": [
      "launcher_pull_healer"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "B3",
    "skillId": "launcher_designated_shot",
    "prerequisiteSkillIds": [
      "launcher_skip_preparation"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "BA1",
    "skillId": "launcher_observation_hole",
    "prerequisiteSkillIds": [
      "launcher_designated_shot"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "BA2",
    "skillId": "launcher_rangefinder",
    "prerequisiteSkillIds": [
      "launcher_observation_hole"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "BA3",
    "skillId": "launcher_volley_aim",
    "prerequisiteSkillIds": [
      "launcher_rangefinder"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "BB1",
    "skillId": "launcher_order_table",
    "prerequisiteSkillIds": [
      "launcher_designated_shot"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "BB2",
    "skillId": "launcher_order_check",
    "prerequisiteSkillIds": [
      "launcher_order_table"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "launcher",
    "position": "BB3",
    "skillId": "launcher_three_point",
    "prerequisiteSkillIds": [
      "launcher_order_check"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "audited",
    "sourceModule": "ecology/content/weapon-launcher.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "R",
    "skillId": "medical_kit_treatment",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "A1",
    "skillId": "medical_kit_clean_tools",
    "prerequisiteSkillIds": [
      "medical_kit_treatment"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "A2",
    "skillId": "medical_kit_wash",
    "prerequisiteSkillIds": [
      "medical_kit_clean_tools"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "A3",
    "skillId": "medical_kit_major_treatment",
    "prerequisiteSkillIds": [
      "medical_kit_wash"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "AA1",
    "skillId": "medical_kit_stimulant_protocol",
    "prerequisiteSkillIds": [
      "medical_kit_major_treatment"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "AA2",
    "skillId": "medical_kit_surplus_bandage",
    "prerequisiteSkillIds": [
      "medical_kit_stimulant_protocol"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "AA3",
    "skillId": "medical_kit_full_procedure",
    "prerequisiteSkillIds": [
      "medical_kit_surplus_bandage"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "AB1",
    "skillId": "medical_kit_wide_spray",
    "prerequisiteSkillIds": [
      "medical_kit_major_treatment"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "AB2",
    "skillId": "medical_kit_equal_dose",
    "prerequisiteSkillIds": [
      "medical_kit_wide_spray"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "AB3",
    "skillId": "medical_kit_field_treatment",
    "prerequisiteSkillIds": [
      "medical_kit_equal_dose"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "B1",
    "skillId": "medical_kit_danger_zone",
    "prerequisiteSkillIds": [
      "medical_kit_treatment"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "B2",
    "skillId": "medical_kit_emergency_revive",
    "prerequisiteSkillIds": [
      "medical_kit_danger_zone"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "B3",
    "skillId": "medical_kit_transfusion",
    "prerequisiteSkillIds": [
      "medical_kit_emergency_revive"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "BA1",
    "skillId": "medical_kit_active_agent",
    "prerequisiteSkillIds": [
      "medical_kit_transfusion"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "BA2",
    "skillId": "medical_kit_regenerative_drug",
    "prerequisiteSkillIds": [
      "medical_kit_active_agent"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "BA3",
    "skillId": "medical_kit_regenerative_procedure",
    "prerequisiteSkillIds": [
      "medical_kit_regenerative_drug"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "BB1",
    "skillId": "medical_kit_reserve_blood_protocol",
    "prerequisiteSkillIds": [
      "medical_kit_transfusion"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "BB2",
    "skillId": "medical_kit_life_collateral",
    "prerequisiteSkillIds": [
      "medical_kit_reserve_blood_protocol"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "medical_kit",
    "position": "BB3",
    "skillId": "medical_kit_time_surgery",
    "prerequisiteSkillIds": [
      "medical_kit_life_collateral"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-medical-kit.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "R",
    "skillId": "tower_shield_draw_guard",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "A1",
    "skillId": "tower_shield_thick_plate",
    "prerequisiteSkillIds": [
      "tower_shield_draw_guard"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "A2",
    "skillId": "tower_shield_visible",
    "prerequisiteSkillIds": [
      "tower_shield_thick_plate"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "A3",
    "skillId": "tower_shield_hold_fast",
    "prerequisiteSkillIds": [
      "tower_shield_visible"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "AA1",
    "skillId": "tower_shield_shock_absorption",
    "prerequisiteSkillIds": [
      "tower_shield_hold_fast"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "AA2",
    "skillId": "tower_shield_wall_frame",
    "prerequisiteSkillIds": [
      "tower_shield_shock_absorption"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "AA3",
    "skillId": "tower_shield_gate",
    "prerequisiteSkillIds": [
      "tower_shield_wall_frame"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "AB1",
    "skillId": "tower_shield_side_plate",
    "prerequisiteSkillIds": [
      "tower_shield_hold_fast"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "AB2",
    "skillId": "tower_shield_line",
    "prerequisiteSkillIds": [
      "tower_shield_side_plate"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "AB3",
    "skillId": "tower_shield_line_guard",
    "prerequisiteSkillIds": [
      "tower_shield_line"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "B1",
    "skillId": "tower_shield_take_role",
    "prerequisiteSkillIds": [
      "tower_shield_draw_guard"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "B2",
    "skillId": "tower_shield_interpose",
    "prerequisiteSkillIds": [
      "tower_shield_take_role"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "B3",
    "skillId": "tower_shield_bash",
    "prerequisiteSkillIds": [
      "tower_shield_interpose"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "BA1",
    "skillId": "tower_shield_spread_guard",
    "prerequisiteSkillIds": [
      "tower_shield_bash"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "BA2",
    "skillId": "tower_shield_relief_voice",
    "prerequisiteSkillIds": [
      "tower_shield_spread_guard"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "BA3",
    "skillId": "tower_shield_sanctuary",
    "prerequisiteSkillIds": [
      "tower_shield_relief_voice"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "BB1",
    "skillId": "tower_shield_mirror_film",
    "prerequisiteSkillIds": [
      "tower_shield_bash"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "BB2",
    "skillId": "tower_shield_turn_back",
    "prerequisiteSkillIds": [
      "tower_shield_mirror_film"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "tower_shield",
    "position": "BB3",
    "skillId": "tower_shield_mirror_castle",
    "prerequisiteSkillIds": [
      "tower_shield_turn_back"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-tower-shield.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "R",
    "skillId": "long_spear_pierce",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "A1",
    "skillId": "long_spear_long_shaft",
    "prerequisiteSkillIds": [
      "long_spear_pierce"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "A2",
    "skillId": "long_spear_armor_pierce",
    "prerequisiteSkillIds": [
      "long_spear_long_shaft"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "A3",
    "skillId": "long_spear_deep_thrust",
    "prerequisiteSkillIds": [
      "long_spear_armor_pierce"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "AA1",
    "skillId": "long_spear_butt_end",
    "prerequisiteSkillIds": [
      "long_spear_deep_thrust"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "AA2",
    "skillId": "long_spear_penetration",
    "prerequisiteSkillIds": [
      "long_spear_butt_end"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "AA3",
    "skillId": "long_spear_sky_pierce",
    "prerequisiteSkillIds": [
      "long_spear_penetration"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "AB1",
    "skillId": "long_spear_double_thrust",
    "prerequisiteSkillIds": [
      "long_spear_deep_thrust"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "AB2",
    "skillId": "long_spear_pin",
    "prerequisiteSkillIds": [
      "long_spear_double_thrust"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "AB3",
    "skillId": "long_spear_impale",
    "prerequisiteSkillIds": [
      "long_spear_pin"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "B1",
    "skillId": "long_spear_ready_target",
    "prerequisiteSkillIds": [
      "long_spear_pierce"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "B2",
    "skillId": "long_spear_first_mover",
    "prerequisiteSkillIds": [
      "long_spear_ready_target"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "B3",
    "skillId": "long_spear_first_thrust",
    "prerequisiteSkillIds": [
      "long_spear_first_mover"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "BA1",
    "skillId": "long_spear_foot_stop",
    "prerequisiteSkillIds": [
      "long_spear_first_thrust"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "BA2",
    "skillId": "long_spear_cross_thrust",
    "prerequisiteSkillIds": [
      "long_spear_foot_stop"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "BA3",
    "skillId": "long_spear_checkpoint",
    "prerequisiteSkillIds": [
      "long_spear_cross_thrust"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "BB1",
    "skillId": "long_spear_order_mark",
    "prerequisiteSkillIds": [
      "long_spear_first_thrust"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "BB2",
    "skillId": "long_spear_interrupt",
    "prerequisiteSkillIds": [
      "long_spear_order_mark"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "long_spear",
    "position": "BB3",
    "skillId": "long_spear_time_thrust",
    "prerequisiteSkillIds": [
      "long_spear_interrupt"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-long-spear.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "R",
    "skillId": "grappling_hook_pull",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "A1",
    "skillId": "grappling_hook_iron_hook",
    "prerequisiteSkillIds": [
      "grappling_hook_pull"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "A2",
    "skillId": "grappling_hook_long_rope",
    "prerequisiteSkillIds": [
      "grappling_hook_iron_hook"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "A3",
    "skillId": "grappling_hook_strong_pull",
    "prerequisiteSkillIds": [
      "grappling_hook_long_rope"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AA1",
    "skillId": "grappling_hook_winch",
    "prerequisiteSkillIds": [
      "grappling_hook_strong_pull"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AA2",
    "skillId": "grappling_hook_wall_strike",
    "prerequisiteSkillIds": [
      "grappling_hook_winch"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AA3",
    "skillId": "grappling_hook_capture",
    "prerequisiteSkillIds": [
      "grappling_hook_wall_strike"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AB1",
    "skillId": "grappling_hook_rescue_line",
    "prerequisiteSkillIds": [
      "grappling_hook_strong_pull"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AB2",
    "skillId": "grappling_hook_raise",
    "prerequisiteSkillIds": [
      "grappling_hook_rescue_line"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AB3",
    "skillId": "grappling_hook_rescue",
    "prerequisiteSkillIds": [
      "grappling_hook_raise"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "B1",
    "skillId": "grappling_hook_break_step",
    "prerequisiteSkillIds": [
      "grappling_hook_pull"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "B2",
    "skillId": "grappling_hook_run_signal",
    "prerequisiteSkillIds": [
      "grappling_hook_break_step"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "B3",
    "skillId": "grappling_hook_throw_lasso",
    "prerequisiteSkillIds": [
      "grappling_hook_run_signal"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BA1",
    "skillId": "grappling_hook_movement_marks",
    "prerequisiteSkillIds": [
      "grappling_hook_throw_lasso"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BA2",
    "skillId": "grappling_hook_mark_step",
    "prerequisiteSkillIds": [
      "grappling_hook_movement_marks"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BA3",
    "skillId": "grappling_hook_net_field",
    "prerequisiteSkillIds": [
      "grappling_hook_mark_step"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BB1",
    "skillId": "grappling_hook_two_point_anchor",
    "prerequisiteSkillIds": [
      "grappling_hook_throw_lasso"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BB2",
    "skillId": "grappling_hook_rope_return",
    "prerequisiteSkillIds": [
      "grappling_hook_two_point_anchor"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BB3",
    "skillId": "grappling_hook_total_swap",
    "prerequisiteSkillIds": [
      "grappling_hook_rope_return"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-grappling-hook.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "R",
    "skillId": "dual_blades_two_cut",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "A1",
    "skillId": "dual_blades_split_sharpening",
    "prerequisiteSkillIds": [
      "dual_blades_two_cut"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "A2",
    "skillId": "dual_blades_dash_in",
    "prerequisiteSkillIds": [
      "dual_blades_split_sharpening"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "A3",
    "skillId": "dual_blades_three_cut",
    "prerequisiteSkillIds": [
      "dual_blades_dash_in"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "AA1",
    "skillId": "dual_blades_more_hands",
    "prerequisiteSkillIds": [
      "dual_blades_three_cut"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "AA2",
    "skillId": "dual_blades_retreat",
    "prerequisiteSkillIds": [
      "dual_blades_more_hands"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "AA3",
    "skillId": "dual_blades_six_petals",
    "prerequisiteSkillIds": [
      "dual_blades_retreat"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "AB1",
    "skillId": "dual_blades_edge_pass",
    "prerequisiteSkillIds": [
      "dual_blades_three_cut"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "AB2",
    "skillId": "dual_blades_no_waste",
    "prerequisiteSkillIds": [
      "dual_blades_edge_pass"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "AB3",
    "skillId": "dual_blades_dancing_cut",
    "prerequisiteSkillIds": [
      "dual_blades_no_waste"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "B1",
    "skillId": "dual_blades_lacerating_edge",
    "prerequisiteSkillIds": [
      "dual_blades_two_cut"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "B2",
    "skillId": "dual_blades_blood_scent",
    "prerequisiteSkillIds": [
      "dual_blades_lacerating_edge"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "B3",
    "skillId": "dual_blades_wound_mark",
    "prerequisiteSkillIds": [
      "dual_blades_blood_scent"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "BA1",
    "skillId": "dual_blades_wound_expansion",
    "prerequisiteSkillIds": [
      "dual_blades_wound_mark"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "BA2",
    "skillId": "dual_blades_blood_spray",
    "prerequisiteSkillIds": [
      "dual_blades_wound_expansion"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "BA3",
    "skillId": "dual_blades_blood_path",
    "prerequisiteSkillIds": [
      "dual_blades_blood_spray"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "BB1",
    "skillId": "dual_blades_blade_reservation",
    "prerequisiteSkillIds": [
      "dual_blades_wound_mark"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "BB2",
    "skillId": "dual_blades_insert_blade",
    "prerequisiteSkillIds": [
      "dual_blades_blade_reservation"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "dual_blades",
    "position": "BB3",
    "skillId": "dual_blades_many_guests",
    "prerequisiteSkillIds": [
      "dual_blades_insert_blade"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-dual-blades.mjs"
  },
  {
    "weaponId": "banner",
    "position": "R",
    "skillId": "banner_command",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "A1",
    "skillId": "banner_clear_voice",
    "prerequisiteSkillIds": [
      "banner_command"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "A2",
    "skillId": "banner_breathe_together",
    "prerequisiteSkillIds": [
      "banner_clear_voice"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "A3",
    "skillId": "banner_advance",
    "prerequisiteSkillIds": [
      "banner_breathe_together"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "AA1",
    "skillId": "banner_great_command",
    "prerequisiteSkillIds": [
      "banner_advance"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "AA2",
    "skillId": "banner_two_beats",
    "prerequisiteSkillIds": [
      "banner_great_command"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "AA3",
    "skillId": "banner_total_assault",
    "prerequisiteSkillIds": [
      "banner_two_beats"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "AB1",
    "skillId": "banner_line_delivery",
    "prerequisiteSkillIds": [
      "banner_advance"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "AB2",
    "skillId": "banner_synced_steps",
    "prerequisiteSkillIds": [
      "banner_line_delivery"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "AB3",
    "skillId": "banner_line_advance",
    "prerequisiteSkillIds": [
      "banner_synced_steps"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "B1",
    "skillId": "banner_next_target",
    "prerequisiteSkillIds": [
      "banner_command"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "B2",
    "skillId": "banner_push_forward",
    "prerequisiteSkillIds": [
      "banner_next_target"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "B3",
    "skillId": "banner_hurry",
    "prerequisiteSkillIds": [
      "banner_push_forward"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "BA1",
    "skillId": "banner_debt_token",
    "prerequisiteSkillIds": [
      "banner_hurry"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "BA2",
    "skillId": "banner_debt_grace",
    "prerequisiteSkillIds": [
      "banner_debt_token"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "BA3",
    "skillId": "banner_borrowed_command",
    "prerequisiteSkillIds": [
      "banner_debt_grace"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "BB1",
    "skillId": "banner_hourglass",
    "prerequisiteSkillIds": [
      "banner_hurry"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "BB2",
    "skillId": "banner_buy_second",
    "prerequisiteSkillIds": [
      "banner_hourglass"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "banner",
    "position": "BB3",
    "skillId": "banner_last_command",
    "prerequisiteSkillIds": [
      "banner_buy_second"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-banner.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "R",
    "skillId": "heavy_crossbow_loaded_shot",
    "prerequisiteSkillIds": [],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "A1",
    "skillId": "heavy_crossbow_strong_string",
    "prerequisiteSkillIds": [
      "heavy_crossbow_loaded_shot"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "A2",
    "skillId": "heavy_crossbow_armor_piercing",
    "prerequisiteSkillIds": [
      "heavy_crossbow_strong_string"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "A3",
    "skillId": "heavy_crossbow_heavy_loaded_shot",
    "prerequisiteSkillIds": [
      "heavy_crossbow_armor_piercing"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AA1",
    "skillId": "heavy_crossbow_thick_bolt",
    "prerequisiteSkillIds": [
      "heavy_crossbow_heavy_loaded_shot"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AA2",
    "skillId": "heavy_crossbow_siege_piercer",
    "prerequisiteSkillIds": [
      "heavy_crossbow_thick_bolt"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AA3",
    "skillId": "heavy_crossbow_siege_breaker",
    "prerequisiteSkillIds": [
      "heavy_crossbow_siege_piercer"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AB1",
    "skillId": "heavy_crossbow_explosive_canister",
    "prerequisiteSkillIds": [
      "heavy_crossbow_heavy_loaded_shot"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AB2",
    "skillId": "heavy_crossbow_blast_pressure",
    "prerequisiteSkillIds": [
      "heavy_crossbow_explosive_canister"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AB3",
    "skillId": "heavy_crossbow_burst_bolt",
    "prerequisiteSkillIds": [
      "heavy_crossbow_blast_pressure"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "B1",
    "skillId": "heavy_crossbow_large_game",
    "prerequisiteSkillIds": [
      "heavy_crossbow_loaded_shot"
    ],
    "sourceDeclaredKind": "target",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "B2",
    "skillId": "heavy_crossbow_loading_hold",
    "prerequisiteSkillIds": [
      "heavy_crossbow_large_game"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "B3",
    "skillId": "heavy_crossbow_reserved_shot",
    "prerequisiteSkillIds": [
      "heavy_crossbow_loading_hold"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BA1",
    "skillId": "heavy_crossbow_impact_mark",
    "prerequisiteSkillIds": [
      "heavy_crossbow_reserved_shot"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BA2",
    "skillId": "heavy_crossbow_trigger_detonation",
    "prerequisiteSkillIds": [
      "heavy_crossbow_impact_mark"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BA3",
    "skillId": "heavy_crossbow_timed_bolt",
    "prerequisiteSkillIds": [
      "heavy_crossbow_trigger_detonation"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BB1",
    "skillId": "heavy_crossbow_next_ammo",
    "prerequisiteSkillIds": [
      "heavy_crossbow_reserved_shot"
    ],
    "sourceDeclaredKind": "passive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BB2",
    "skillId": "heavy_crossbow_future_shot",
    "prerequisiteSkillIds": [
      "heavy_crossbow_next_ammo"
    ],
    "sourceDeclaredKind": "reactive",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BB3",
    "skillId": "heavy_crossbow_three_time_shot",
    "prerequisiteSkillIds": [
      "heavy_crossbow_future_shot"
    ],
    "sourceDeclaredKind": "active",
    "auditStatus": "pending",
    "sourceModule": "ecology/content/weapon-heavy-crossbow.mjs"
  }
].map((binding) => Object.freeze({
  ...binding,
  prerequisiteSkillIds: Object.freeze(binding.prerequisiteSkillIds),
})));

export const STARTING_WEAPONS_BY_CHARACTER = Object.freeze({
  // Signature and secondary weapon pairs from PR #288's weapon catalog.
  warden: Object.freeze(["warhammer", "gauntlets"]),
  mender: Object.freeze(["launcher", "medical_kit"]),
  lancer: Object.freeze(["tower_shield", "long_spear"]),
  guardian: Object.freeze(["grappling_hook", "dual_blades"]),
  tactician: Object.freeze(["banner", "heavy_crossbow"]),
});
