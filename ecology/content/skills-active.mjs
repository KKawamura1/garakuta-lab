// ecology/content/skills-active.mjs
//
// **行動技能（active skill）の定義。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 技能 担当だけ。engine・schema・共通registryは変更しない。

import { bpsForLegacyAmount, cloneActive, renamed, scaleDefinitionAmounts } from "./base.mjs";

export const ACTIVE_SKILL_NAMES = {
  strike: "斬撃",
  mend: "手当て",
  bulwark: "防壁形成",
  relay_order: "号令",
  heavy_swing: "溜め突き",
  reposition: "位置替え",
  long_swing: "大溜め",
  triage: "応急手当",
  hunt_the_slow: "準備狩り",
  idle_shuffle: "息を整える",
  mark_target: "隙を刻む",
  steady_aim: "狙いを澄ます",
  front_strike: "前列打ち",
  rear_strike: "後列打ち",
  enemy_heavy: "重い一撃",
  enemy_guard: "盾を構える",
  guard_crush: "受け崩し",
  rear_hunt: "後衛狩り",
  finishing_thrust: "止めの一突き",
  crack_mark: "傷口を開く",
  brace_for_impact: "衝撃に備える",
};

const activeSkills = renamed("activeSkills", ACTIVE_SKILL_NAMES);
// The R5 fixture's idle_shuffle is intentionally a zero-cost infinite-loop
// witness. It must not leak into player-facing content, including old saves
// that may already contain the id. Keep the id as a safe compatibility alias.
activeSkills.idle_shuffle = cloneActive("steady_aim", "idle_shuffle", "息を整える", {
  tags: ["buff", "playable"],
});
activeSkills.front_strike = cloneActive("strike", "front_strike", ACTIVE_SKILL_NAMES.front_strike, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: 1,
  },
});
activeSkills.rear_strike = cloneActive("strike", "rear_strike", ACTIVE_SKILL_NAMES.rear_strike, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "row_is", row: "rear" }],
    sort: ["position_asc"],
    take: 1,
  },
});
activeSkills.enemy_heavy = cloneActive("heavy_swing", "enemy_heavy", ACTIVE_SKILL_NAMES.enemy_heavy, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: 1,
  },
  preparation: {
    steps: 1,
    completionEffects: [{
      type: "deal_damage",
      target: {
        scope: "enemies",
        filters: [{ type: "alive" }],
        sort: ["position_asc"],
        take: 1,
      },
      amount: { type: "constant", value: 8 },
      tags: ["attack", "heavy"],
    }],
  },
});
activeSkills.enemy_guard = cloneActive("bulwark", "enemy_guard", ACTIVE_SKILL_NAMES.enemy_guard, {
  effects: [{
    type: "gain_barrier",
    target: { scope: "self", take: 1 },
    amount: { type: "constant", value: 4 },
    duration: "round",
  }],
});

// R6 §4.4 — Phase A の係数。**技能ごとに weapon(might) か technique(focus) かを決める。**
// R6 が名指しした3つは名指しの値、それ以外は中立 parameter 40 で
// 現行の相対効果量を保つ係数（現行値 × 2500 bps）から始める。
export const ACTIVE_SCALING = {
  // R6 §4.4 が名指し
  strike: { stat: "might", bps: 10_000 },          // 斬撃 might 100%
  mend: { stat: "focus", bps: 8_000 },             // 手当て focus 80%
  bulwark: { stat: "focus", bps: 6_000 },          // 防壁形成 focus 60%
  // 攻撃系 → might。溜めや条件を持つので中立則で始める
  heavy_swing: { stat: "might", bps: bpsForLegacyAmount(9) },
  long_swing: { stat: "might", bps: bpsForLegacyAmount(9) },
  hunt_the_slow: { stat: "might", bps: bpsForLegacyAmount(5) },
  // 支援系 → focus
  triage: { stat: "focus", bps: bpsForLegacyAmount(8) },
  // 敵の技能。basic strike は might 100%、重い一撃は中立則
  front_strike: { stat: "might", bps: 10_000 },
  rear_strike: { stat: "might", bps: 10_000 },
  enemy_heavy: { stat: "might", bps: bpsForLegacyAmount(8) },
  enemy_guard: { stat: "focus", bps: bpsForLegacyAmount(4) },
};

for (const [id, scaling] of Object.entries(ACTIVE_SCALING)) {
  scaleDefinitionAmounts(activeSkills[id], scaling);
}

// R6 §6.4 — 攻撃テンポを保証する中核の行動。**skill slot を消費しない。**
// 技能を持たない、全部が不発、有効対象なしのときに basic、
// utility の解決後に fallback が一度だけ走る。
//
// 届き方は人物ごとなので melee / ranged の2つずつ持つ。**同じ技能に
// engine が reach を注入するのではなく、content が両方を持って選ばせる。**
function coreStrike(id, displayName, coefficientBps, apCost, reach) {
  return {
    id,
    displayName,
    apCost,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
    effects: [{
      type: "deal_damage",
      target: { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
      reach,
      tags: ["attack", "weapon", "core"],
    }],
    tags: ["attack", "core"],
  };
}

for (const reach of ["melee", "ranged"]) {
  // 基準威力は might 100%（R6 §6.4）。
  activeSkills["basic_strike_" + reach] = coreStrike(
    "basic_strike_" + reach, reach === "melee" ? "通常攻撃" : "通常射撃", 10_000, 1, reach,
  );
  // 追撃は50%。**行動権は払わない**（支援に添える一撃なので）。
  activeSkills["fallback_strike_" + reach] = coreStrike(
    "fallback_strike_" + reach, reach === "melee" ? "追い打ち" : "追い射ち", 5_000, 0, reach,
  );
}

// R6 §6.7 / §17.1 — Phase A の6 archetype。**同じ名前の係数違いを量産しない。**
// それぞれが guard / block / formation / risk の少なくとも一軸で評価を変える。
//
//   basic   … 既存の斬撃（might 100%、単発）
//   heavy   … 既存の溜め突き（溜めが代償）
//   rapid   … 多段。総係数は basic 以上だが **guard に弱い**
//   pierce  … guard を半分無視。総係数は basic 以下
//   row     … 選んだ一行。一体あたりの係数を下げる
//   column  … 同じ列の前後。前列の後ろに誰が居るかを問う
function archetype(id, displayName, coefficientBps, patch = {}) {
  const single = { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 };
  const { effectPatch = {}, ...rest } = patch;
  return {
    id,
    displayName,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: single,
    effects: [{
      type: "deal_damage",
      target: single,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
      tags: ["attack", "weapon"],
      ...effectPatch,
    }],
    tags: ["attack"],
    ...rest,
  };
}

// 多段。1hit あたり 40%×3 = 総120%。guard を3回引かれるので、
// **硬い相手には basic より弱くなる。**
activeSkills.rapid_cuts = archetype("rapid_cuts", "刻み斬り", 4_000, {
  effectPatch: { hitCount: 3 },
});
// 貫き。総80% と引き換えに guard を6割無視する。
activeSkills.pierce_thrust = archetype("pierce_thrust", "貫き突き", 8_000, {
  effectPatch: { guardPierceBps: 6_000 },
});
// 薙ぎ。選んだ一行へ 60% ずつ。**前3の隊列を選んだ相手ほど刺さる。**
activeSkills.row_sweep = archetype("row_sweep", "薙ぎ払い", 6_000, {
  effectPatch: { targetPattern: "row" },
});
// 突き通し。同じ列の前後へ 70% ずつ。後列を庇う列を貫く。
activeSkills.column_thrust = archetype("column_thrust", "突き通し", 7_000, {
  effectPatch: { targetPattern: "column" },
});

// Content Wave 1 — existing Phase A vocabulary only. Each skill changes the
// answer to a different board question; none is a character-specific key.
const EVENT_TARGET = { scope: "event_targets", filters: [{ type: "alive" }], take: 1 };
const REAR_ENEMY = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "row_is", row: "rear" }],
  sort: ["hp_asc"],
  take: 1,
};

function waveAttack(id, displayName, targetQuery, coefficientBps, effectPatch = {}, tags = ["attack"]) {
  return {
    id,
    displayName,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery,
    effects: [{
      type: "deal_damage",
      target: EVENT_TARGET,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
      tags,
      ...effectPatch,
    }],
    tags,
  };
}

// Raw output is deliberately below basic, but it ignores guard completely.
// It is weaker on unguarded targets and answers a different question than pierce.
activeSkills.guard_crush = waveAttack(
  "guard_crush", ACTIVE_SKILL_NAMES.guard_crush,
  { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
  7_000,
  { guardPierceBps: 10_000 },
);
// A ranged, rear-only choice. It becomes unusable when the rear is empty, so
// the actor falls back to its core action instead of wasting an AP.
activeSkills.rear_hunt = waveAttack("rear_hunt", ACTIVE_SKILL_NAMES.rear_hunt, REAR_ENEMY, 8_500, { reach: "ranged" });
// A conditional finisher: no low-health target means the tactic is skipped.
activeSkills.finishing_thrust = waveAttack(
  "finishing_thrust", ACTIVE_SKILL_NAMES.finishing_thrust,
  { scope: "enemies", filters: [{ type: "alive" }, { type: "hp_percent", op: "lte", value: 50 }], sort: ["hp_asc"], take: 1 },
  12_000,
);
// Setup trades immediate damage for an exposed target. The second effect uses
// the same selected target and therefore cannot mark a different actor.
activeSkills.crack_mark = {
  id: "crack_mark",
  displayName: ACTIVE_SKILL_NAMES.crack_mark,
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
  effects: [
    {
      type: "deal_damage",
      target: EVENT_TARGET,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 6_500 },
      tags: ["attack", "debuff"],
    },
    { type: "add_status", target: EVENT_TARGET, statusId: "exposed", stacks: 1 },
  ],
  tags: ["attack", "debuff"],
};
// Utility still receives the guaranteed 50% core follow-up. Its value is a
// block charge, so it is good into one large hit and poor into many small hits.
activeSkills.brace_for_impact = {
  id: "brace_for_impact",
  displayName: ACTIVE_SKILL_NAMES.brace_for_impact,
  apCost: 1,
  actionMode: "utility",
  intrinsicPredicates: [],
  targetQuery: { scope: "self", take: 1 },
  effects: [{ type: "gain_block", target: { scope: "self", take: 1 }, amount: { type: "constant", value: 1 } }],
  tags: ["guard"],
};

// R6 §6.4 — active 技能の静的な種別。**skill tag だけで分類し、
// 人物 ID や個別敵 ID による例外を作らない。**
// direct damage を保証できるものが offense、純支援が utility、
// 溜めること自体が代償のものが channel。
const ACTION_MODES = {
  strike: "offense",
  rapid_cuts: "offense",
  pierce_thrust: "offense",
  row_sweep: "offense",
  column_thrust: "offense",
  guard_crush: "offense",
  rear_hunt: "offense",
  finishing_thrust: "offense",
  crack_mark: "offense",
  brace_for_impact: "utility",
  heavy_swing: "channel",     // 溜めが代償
  long_swing: "channel",      // 溜めが代償
  hunt_the_slow: "offense",
  front_strike: "offense",
  rear_strike: "offense",
  enemy_heavy: "channel",
  mend: "utility",
  triage: "utility",
  bulwark: "utility",
  enemy_guard: "utility",
  relay_order: "utility",
  reposition: "utility",
  mark_target: "utility",
  steady_aim: "utility",
  idle_shuffle: "utility",
};
for (const [id, mode] of Object.entries(ACTION_MODES)) {
  if (activeSkills[id]) activeSkills[id].actionMode = mode;
}

export const ACTIVE_SKILLS = activeSkills;
