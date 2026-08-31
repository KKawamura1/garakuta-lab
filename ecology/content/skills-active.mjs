// ecology/content/skills-active.mjs
//
// **行動技能（active skill）の定義。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。Wave 1 の追加と、その後の倍率・条件バランスもここで管理する。
//
// ここを触ってよいのは 技能 担当だけ。engine・schema・共通registryは変更しない。

import { bpsForLegacyAmount, cloneActive, renamed, scaleDefinitionAmounts } from "./base.mjs";

export const ACTIVE_SKILL_NAMES = {
  strike: "斬撃",
  bulwark: "防壁形成",
  relay_order: "号令",
  heavy_swing: "溜め突き",
  reposition: "位置替え",
  long_swing: "大溜め",
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
// R8 Implementation Phase 1（続き）— mend/triage は anti-stall 安全な reactive
// （content/skills-reactive.mjs）へ作り替えたので、fixture 由来の active 版を
// production content から外す。fixture-content.mjs 自体は変更しない
// （engine/schema の witness として §15.1 が引き続き使う）。
delete activeSkills.mend;
delete activeSkills.triage;
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

// Likewise, marking an already exposed target has no tactical value. Keep the
// effect strong on a fresh target and let the normal attack handle repeats.
activeSkills.mark_target.targetQuery = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "eq", value: 0 }],
  sort: ["hp_desc"],
  take: 1,
};

// R6 §4.4 — Phase A の係数。**技能ごとに weapon(might) か technique(focus) かを決める。**
// ここでは「通常攻撃 = might 100%」を基準に、攻撃技能は条件を満たした
// 場合に明確な上振れになるようにする。条件を満たせない技能は targetQuery
// が空になり、engine の basic fallback へ戻る。
export const ACTIVE_SCALING = {
  // R6 §4.4 が名指し
  strike: { stat: "might", bps: 12_000 },          // 斬撃 might 120%
  bulwark: { stat: "focus", bps: bpsForLegacyAmount(8) }, // 防壁形成 focus 80%
  // 攻撃系 → might。溜めや条件を持つので、成立時は通常攻撃を上回る
  heavy_swing: { stat: "might", bps: bpsForLegacyAmount(22) },
  long_swing: { stat: "might", bps: bpsForLegacyAmount(40) },
  hunt_the_slow: { stat: "might", bps: bpsForLegacyAmount(12) },
  // 敵の技能。basic strike は might 100%、重い一撃は might 140%
  front_strike: { stat: "might", bps: 10_000 },
  rear_strike: { stat: "might", bps: 10_000 },
  enemy_heavy: { stat: "might", bps: bpsForLegacyAmount(14) },
  enemy_guard: { stat: "focus", bps: bpsForLegacyAmount(4) },
};

for (const [id, scaling] of Object.entries(ACTIVE_SCALING)) {
  scaleDefinitionAmounts(activeSkills[id], scaling);
}

// R6 §6.4 — 攻撃テンポを保証する中核の行動。**skill slot を消費しない。**
// 技能を持たない、全部が不発、有効対象なしのときに basic、
// utility の解決後に fallback が一度だけ走る。
//
// 通常攻撃の届き方も技能側の effect.reach で決める。playable では全員が
// melee の core を使い、後衛へ届く技能だけが ranged を明示する。
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
//   basic   … 技能枠を使わない通常攻撃（might 100%、単発）
//   heavy   … 既存の溜め突き（溜めが代償）
//   rapid   … 多段。総係数は basic 以上だが **guard に弱い**
//   pierce  … guard を半分無視。単発係数も basic を上回る
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

// 多段。1hit あたり 50%×3 = 総150%。guard を3回引かれるので、
// **硬い相手には basic より弱くなる。**
activeSkills.rapid_cuts = archetype("rapid_cuts", "刻み斬り", 5_000, {
  effectPatch: { hitCount: 3 },
});
// 貫き。単発115%で通常攻撃を上回り、guard を6割無視する。
activeSkills.pierce_thrust = archetype("pierce_thrust", "貫き突き", 11_500, {
  effectPatch: { guardPierceBps: 6_000 },
});
// 薙ぎ。前列の敵が2体以上いるときだけ、同じ行へ80%ずつ。
// 1体しかいない行は通常攻撃へ戻すので、単体時も択の損にならない。
activeSkills.row_sweep = archetype("row_sweep", "薙ぎ払い", 8_000, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "row_is", row: "front" }],
    sort: ["position_asc"],
    take: 1,
  },
  intrinsicPredicates: [{
    type: "target_exists",
    op: "gte",
    value: 2,
    query: {
      scope: "enemies",
      filters: [{ type: "alive" }, { type: "row_is", row: "front" }],
      take: "all",
    },
  }],
  effectPatch: { targetPattern: "row" },
});
// 突き通し。同じ列の前後へ110%ずつ。後列を庇う列を貫く。
activeSkills.column_thrust = archetype("column_thrust", "突き通し", 11_000, {
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

// 対象が存在すること自体が発動条件になる技能は、targetQuery だけでなく
// intrinsicPredicates にも明示する。これで「条件技能」として先に不成立を
// 判定でき、APを払わず次の行動へ進む契約を定義上も共有できる。
function hasEligibleTarget(query) {
  return {
    type: "target_exists",
    op: "gte",
    value: 1,
    query: { ...query, take: "all" },
  };
}

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

// 受け崩しは通常攻撃を上回り、受け構えと受けを完全に無視する。
activeSkills.guard_crush = waveAttack(
  "guard_crush", ACTIVE_SKILL_NAMES.guard_crush,
  { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
  11_500,
  { guardPierceBps: 10_000 },
);
// A ranged, rear-only choice. It becomes unusable when the rear is empty, so
// the actor falls back to its core action instead of wasting an AP.
activeSkills.rear_hunt = waveAttack("rear_hunt", ACTIVE_SKILL_NAMES.rear_hunt, REAR_ENEMY, 12_000, { reach: "ranged" });
activeSkills.rear_hunt.intrinsicPredicates = [hasEligibleTarget(REAR_ENEMY)];
// A conditional finisher: no low-health target means the tactic is skipped.
const LOW_HEALTH_ENEMY = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "hp_percent", op: "lte", value: 50 }],
  sort: ["hp_asc"],
  take: 1,
};
activeSkills.finishing_thrust = waveAttack(
  "finishing_thrust", ACTIVE_SKILL_NAMES.finishing_thrust,
  LOW_HEALTH_ENEMY,
  14_000,
);
activeSkills.finishing_thrust.intrinsicPredicates = [hasEligibleTarget(LOW_HEALTH_ENEMY)];
// Setup is still an attack, but it must not spend an AP for a weak repeat mark:
// an already exposed target is not eligible, so the tactic falls through to basic.
activeSkills.crack_mark = {
  id: "crack_mark",
  displayName: ACTIVE_SKILL_NAMES.crack_mark,
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "eq", value: 0 }],
    sort: ["position_asc"],
    take: 1,
  },
  effects: [
    {
      type: "deal_damage",
      target: EVENT_TARGET,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 11_000 },
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

// These skills encode a board-state requirement in their target query. Keep
// the same requirement as an explicit skill predicate so they are all handled
// uniformly with row_sweep and other conditional tactics.
for (const skillId of ["hunt_the_slow", "mark_target"]) {
  activeSkills[skillId].intrinsicPredicates = [hasEligibleTarget(activeSkills[skillId].targetQuery)];
}

// `reach` is an effect-level contract field. Stamp the default on every
// enemy-damaging skill so both tactic selection and effect resolution agree:
// ordinary attacks stop at the front row while a ranged skill may cross it.
function setDamageReach(skill, reach) {
  for (const effect of [
    ...(skill.effects ?? []),
    ...(skill.preparation?.completionEffects ?? []),
  ]) {
    if (effect.type === "deal_damage") effect.reach = reach;
  }
  return skill;
}

for (const [id, skill] of Object.entries(activeSkills)) {
  if (skill.targetQuery?.scope === "enemies") setDamageReach(skill, "melee");
}
setDamageReach(activeSkills.rear_strike, "ranged");
setDamageReach(activeSkills.rear_hunt, "ranged");

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

// ---------------------------------------------------------------- pack_barrage（R8 §5.4）
//
// Stage 3 の新パック `pack_barrage`（連撃と刻印）の最小限 content。
// R8 Implementation Phase 1 step 1 は Stage 0〜3 を `E`, `W+E`, `T+E`, `B+W+T` へ
// 固定することを求めるが、パックの密度（R8 §6.4: active 4〜6、offense 3以上、
// 発生源・変換器・利得先を各1つ以上）を作り込むのは Implementation Phase 2
// （Stage 0〜3 probe content）の仕事であり、この system migration には含めない
// （R8 §19.4「system変更とcontent追加を同じPRへ混ぜない」）。
//
// ここでは `CampaignStageDef.newPackId` が参照できる、妥当だが最小限の
// primary_offense パックだけを用意する。多段（barrage_strike）と
// 刻印（mark_strike）という2つの軸だけを置き、既存語彙（hitCount、
// add_status）だけで書く。新しい engine/schema 語彙は使わない。
activeSkills.barrage_strike = {
  id: "barrage_strike",
  displayName: "連撃",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
  effects: [{
    type: "deal_damage",
    target: { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 4_500 },
    hitCount: 3,
    tags: ["attack", "weapon", "onhit"],
  }],
  tags: ["attack", "onhit"],
};
activeSkills.mark_strike = {
  id: "mark_strike",
  displayName: "刻印撃ち",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [{
    type: "target_exists",
    op: "gte",
    value: 1,
    query: {
      scope: "enemies",
      filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "eq", value: 0 }],
      take: "all",
    },
  }],
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "eq", value: 0 }],
    sort: ["position_asc"],
    take: 1,
  },
  effects: [
    {
      type: "deal_damage",
      target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 10_000 },
      tags: ["attack", "weapon", "mark"],
    },
    { type: "add_status", target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 }, statusId: "exposed", stacks: 1 },
  ],
  tags: ["attack", "mark"],
};
setDamageReach(activeSkills.barrage_strike, "melee");
setDamageReach(activeSkills.mark_strike, "melee");

export const ACTIVE_SKILLS = activeSkills;
