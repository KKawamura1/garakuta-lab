// ecology/content/skills-reactive.mjs
//
// **反応技能（reactive skill）の定義。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 技能 担当だけ。engine・schema・共通registryは変更しない。

import { bpsForLegacyAmount, renamed, scaleDefinitionAmounts } from "./base.mjs";

export const REACTIVE_SKILL_NAMES = {
  counter_blow: "反撃",
  cover_ally: "身代わり",
  overflow_care: "余剰治療",
  scavenge_ap: "拾い直し",
  guard_step: "踏み固め",
  urging: "急かす",
  brace_after_hit: "受け流し",
  triage_relay: "連携治療",
  ap_loop: "行動権の循環",
  damage_echo: "痛みの反響",
  barrier_bloom: "防壁の花",
  relay_front: "前列への号令",
  relay_rear: "後列への号令",
  prep_spiral: "準備の螺旋",
};

const reactiveSkills = renamed("reactiveSkills", REACTIVE_SKILL_NAMES);

// R6 §4.4 — Phase A の係数。反応技能も同じ決め方。
// 反撃は殴られた側の might、防壁と治療は focus。
export const REACTIVE_SCALING = {
  counter_blow: { stat: "might", bps: bpsForLegacyAmount(2) },
  damage_echo: { stat: "might", bps: bpsForLegacyAmount(1) },
  guard_step: { stat: "focus", bps: bpsForLegacyAmount(2) },
  brace_after_hit: { stat: "focus", bps: bpsForLegacyAmount(2) },
  barrier_bloom: { stat: "focus", bps: bpsForLegacyAmount(1) },
};

for (const [id, scaling] of Object.entries(REACTIVE_SCALING)) {
  scaleDefinitionAmounts(reactiveSkills[id], scaling);
}

export const REACTIVE_SKILLS = reactiveSkills;
