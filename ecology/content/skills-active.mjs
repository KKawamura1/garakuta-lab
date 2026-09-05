// ecology/content/skills-active.mjs
//
// **行動技能（active skill）の定義。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。Wave 1 の追加と、その後の倍率・条件バランスもここで管理する。
//
// engine・schema・共通registryは変更しない。

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
  // R11 §5 — Stage 0 の安定攻撃。武器と技を一つずつ、同じ形で置く。
  steady_cut: "確かな斬り",
  aimed_shot: "狙い撃ち",
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
  // R11 — 後列から撃つ敵の一撃は technique 扱い。**後列の武器減衰を受けない。**
  // 敵の might と focus はどちらも同じ値なので、威力は動かない（enemies.mjs）。
  rear_strike: { stat: "focus", bps: 10_000 },
  enemy_heavy: { stat: "might", bps: bpsForLegacyAmount(14) },
  enemy_guard: { stat: "focus", bps: bpsForLegacyAmount(4) },
};

for (const [id, scaling] of Object.entries(ACTIVE_SCALING)) {
  scaleDefinitionAmounts(activeSkills[id], scaling);
}

// R6 §6.4 — 攻撃テンポを保証する中核の行動。**技能欄とは別に必ず出る。**
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
//   basic   … 技能欄を使わない通常攻撃（might 100%、単発）
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

// R11 §5 — **Stage 0 の「安定」二本。**条件も準備も持たない。
//
// 教えたいのは威力の差ではなく、**どこから出すかで結果が変わる**ことである。
// 確かな斬りは武器なので後列から出すと 40% になり、狙い撃ちは技なので落ちない。
// 同じ盤面で二つを見比べれば、might と focus の違いが説明文なしで分かる。
activeSkills.steady_cut = archetype("steady_cut", ACTIVE_SKILL_NAMES.steady_cut, 13_000);
activeSkills.aimed_shot = archetype("aimed_shot", ACTIVE_SKILL_NAMES.aimed_shot, 12_500, {
  // 弱った相手から確実に減らす。前列が生きていても後列へ通る（技だから）。
  targetQuery: { scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
  effectPatch: {
    target: { scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
    reach: "ranged",
  },
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
// R11 §5 — 技は後列からでも届く。**この一行が「狙い撃ち」を技たらしめている。**
setDamageReach(activeSkills.aimed_shot, "ranged");

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
// Stage 3 の新パック `pack_barrage`（連撃と刻印）。
// Implementation Phase 1 では `barrage_strike` / `mark_strike` の2 active だけの
// 最小限で止めていた（system migration と content 追加を混ぜない §19.4）。
// ここは Implementation Phase 2（Stage 0〜3 probe content、1 probe batch）で、
// R8 §6.4 の密度契約（active 4〜6、offense 3以上、発生源・変換器・利得先を
// 各1つ以上）へ近づける。probe batch上限（active 5）を使い切る。
//
//   発生源: barrage_strike（多段 hit）、mark_strike（隙の付与）
//   変換器: sweeping_barrage / piercing_barrage（行・列で対象数を稼ぐ多段）
//   利得先: mark_break（隙を消費する高倍率の一撃）
//
// 新しい engine/schema 語彙は使わない（hitCount、add_status、remove_status、
// targetPattern はすべて既存語彙）。
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
// 利得先。隙（exposed）を持つ敵だけを狙い、消費して高倍率で返す
// （mark_strikeが作った隙をmark_breakが刈り取る、pack内で閉じた1本道）。
activeSkills.mark_break = {
  id: "mark_break",
  displayName: "刻印砕き",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [{
    type: "target_exists",
    op: "gte",
    value: 1,
    query: {
      scope: "enemies",
      filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "gte", value: 1 }],
      take: "all",
    },
  }],
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "gte", value: 1 }],
    sort: ["position_asc"],
    take: 1,
  },
  effects: [
    {
      type: "deal_damage",
      target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 },
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 13_000 },
      tags: ["attack", "weapon", "mark", "execute"],
    },
    { type: "remove_status", target: { scope: "event_targets", filters: [{ type: "alive" }], take: 1 }, statusId: "exposed", stacks: "all" },
  ],
  tags: ["attack", "mark", "execute"],
};
// 変換器。前列が2体以上いるときだけ、行を1hitずつ2回薙ぐ。対象がいなければ
// 通常攻撃へ戻る（row_sweepと同じ契約）。Wの隊列操作が対象数を左右する。
activeSkills.sweeping_barrage = {
  id: "sweeping_barrage",
  displayName: "連ぎ払い",
  apCost: 1,
  actionMode: "offense",
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
  effects: [{
    type: "deal_damage",
    target: {
      scope: "enemies",
      filters: [{ type: "alive" }, { type: "row_is", row: "front" }],
      sort: ["position_asc"],
      take: 1,
    },
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 4_000 },
    hitCount: 2,
    targetPattern: "row",
    tags: ["attack", "weapon", "onhit"],
  }],
  tags: ["attack", "onhit"],
};
// 変換器。同じ列の前後へ1hitずつ2回。後列を庇う列を多段で崩す。
activeSkills.piercing_barrage = {
  id: "piercing_barrage",
  displayName: "貫き連撃",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [],
  targetQuery: { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
  effects: [{
    type: "deal_damage",
    target: { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 },
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 4_800 },
    hitCount: 2,
    targetPattern: "column",
    tags: ["attack", "weapon", "onhit"],
  }],
  tags: ["attack", "onhit"],
};

// ---------------------------------------------------------------- R9 §4.1 — pack_care の主行動
//
// **手当ての pack に、HP を戻さない主行動を一つ置く。**v1 schema では active に
// 有限コストを書けないので、heal を持つ active は round を稼ぐだけで撃ち放題に
// なる（analysis/ecology-anti-stall-audit.mjs）。だから care の active は
// 「傷を戻す」ではなく「これ以上の傷を止める」側へ置く。
// 防壁は round で消えるので、待っても carry HP は増えない。
activeSkills.shield_the_wounded = {
  id: "shield_the_wounded",
  displayName: "傷へ盾を",
  apCost: 1,
  actionMode: "utility",
  intrinsicPredicates: [],
  targetQuery: { scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
  effects: [{
    type: "gain_barrier",
    target: { scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
    amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 15_000 },
    duration: "round",
  }],
  tags: ["guard", "care", "playable"],
};

// ---------------------------------------------------------------- R9 §5 — 横断pack「余波と受け渡し」
//
// **5人が揃った後の、役割を越境させる pack の試作（probe）。**
// Campaign Stage 0〜3 には入れていない（R9 §10「このGateを通過する前に...
// 大量の高次packを追加しない」）。Free / Endless からだけ引ける。
//
// R9 §5.1 の設計条件のうち、active が担うのは
// 「既存の通常技能でも一部参加できる」と「条件不成立時に行動を塞がない」の二つ。
// どちらも単独で価値があり、A＋B の固定レシピを要求しない。

// 発生源。庇護を「防いだ」event の作り手にする。受けた人が誰であれ、
// pack_relay の反応はその event を読める。
activeSkills.hand_off = {
  id: "hand_off",
  displayName: "引き継ぐ",
  apCost: 1,
  actionMode: "utility",
  intrinsicPredicates: [],
  targetQuery: { scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
  effects: [{
    type: "gain_block",
    target: { scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
    amount: { type: "constant", value: 1 },
  }],
  tags: ["guard", "handoff", "playable"],
};

// 条件付きの強打。**条件が成立しないときは、ただ出せないのではなく
// 別の行動が回ってくる**（engine が offense の代替を保証する。R6 §6.4）。
activeSkills.overreach = {
  id: "overreach",
  displayName: "無理を通す",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [{ type: "hp_percent", subject: "self", op: "gte", value: 60 }],
  targetQuery: { scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
  effects: [{
    type: "deal_damage",
    target: { scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
    amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 16_500 },
    tags: ["attack", "weapon"],
  }],
  tags: ["attack", "playable"],
};

setDamageReach(activeSkills.steady_cut, "melee");
setDamageReach(activeSkills.overreach, "melee");
setDamageReach(activeSkills.barrage_strike, "melee");
setDamageReach(activeSkills.mark_strike, "melee");
setDamageReach(activeSkills.mark_break, "melee");
setDamageReach(activeSkills.sweeping_barrage, "melee");
setDamageReach(activeSkills.piercing_barrage, "melee");

// ---------------------------------------------------------------- R16 — 技能の大量追加（行動）
//
// **狙いは数ではなく、問いの本数を増やすこと。**
// ここまでの行動技能は「どこへ、どれだけ強く当てるか」に寄っていた。R16 で足す
// 29 本は、既存の event・effect・predicate だけを使って、**まだ一度も問われて
// いなかった軸**を一つずつ持たせてある。
//
//   履歴を読む     … 同じ相手を続けたか／散らしたか／このラウンド殴られたか
//                    （history_count。これまで content で1回しか使っていなかった）
//   相手を動かす   … 敵同士の位置を入れ替える（swap_positions は味方にしか
//                    使っていなかった。後列を引きずり出せば刃が届く）
//   一撃ごとの守り … 守勢（warded）。防壁＝総量、受け構え＝回数 に続く三つ目
//   相手の出力     … 怯み（staggered）。相手を殺さずに相手の攻撃を細くする
//   細く長い傷     … 裂傷（bleeding）。受けを無視してラウンド終わりに刻む
//   自分への代償   … 隙（exposed）を**自分に**付けて上振れを買う
//
// **完全上位互換を作らない**（AGENTS.md）。強い数字には必ず、条件・代償・
// 対象の狭さのどれかを付けてある。バランスの数字は soft data なので、遊んだ
// あとに動かしてよい（動かしたら build の印が変わる）。
//
// 説明文は content/skill-tree.mjs の ACTIVE_META にあり、係数との一致を
// analysis/ecology-readout-smoke.mjs が押すたびに機械で照合する。

const SELF = { scope: "self", take: 1 };
const ALIVE_ONLY = [{ type: "alive" }];
const ENEMY_FRONT_FIRST = { scope: "enemies", filters: ALIVE_ONLY, sort: ["position_asc"], take: 1 };
const ENEMY_WEAKEST = { scope: "enemies", filters: ALIVE_ONLY, sort: ["hp_asc"], take: 1 };
const ALLY_WEAKEST = { scope: "allies", filters: ALIVE_ONLY, sort: ["hp_asc"], take: 1 };
const ALLY_LATEST = { scope: "allies", filters: ALIVE_ONLY, sort: ["position_desc"], take: 1 };
const ALLY_FRONT_ALL = {
  scope: "allies", filters: [{ type: "alive" }, { type: "row_is", row: "front" }], take: "all",
};
const ALLY_REAR_ALL = {
  scope: "allies", filters: [{ type: "alive" }, { type: "row_is", row: "rear" }], take: "all",
};
const ALLY_FRONT_FIRST = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "row_is", row: "front" }],
  sort: ["position_asc"],
  take: 1,
};

const might = (coefficientBps) => ({
  type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps,
});
const focusAmount = (coefficientBps) => ({
  type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps,
});
// **窓は battle。**行動権が1しかない人物は、同じラウンド内に二度は狙えない
// （round 窓にすると二の太刀は事実上発火しない。実測して直した）。
const streakIs = (op, value) => ({
  type: "history_count", subject: "self", metric: "same_target_streak", window: "battle", op, value,
});

// 攻撃1本＋副作用0〜1本の共通形。**副作用は当たった相手（event_targets）へ出す**ので、
// 庇いなどで対象が変わっても、実際に当たった相手に付く。
function strikeWith(id, displayName, coefficientBps, extraEffects = [], patch = {}) {
  const { tags = ["attack"], ...rest } = patch;
  return {
    id,
    displayName,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: ENEMY_FRONT_FIRST,
    effects: [
      {
        type: "deal_damage",
        target: EVENT_TARGET,
        amount: might(coefficientBps),
        reach: "melee",
        tags: ["attack", "weapon"],
      },
      ...extraEffects,
    ],
    tags,
    ...rest,
  };
}

// 支援1本の共通形。utility なので、解決後に 50% の追い打ちが一度だけ入る
// （R6 §6.4）。**支援を選んでも攻撃テンポが止まらない。**
function support(id, displayName, effects, patch = {}) {
  const { tags = ["support"], ...rest } = patch;
  return {
    id, displayName, apCost: 1, actionMode: "utility",
    intrinsicPredicates: [], targetQuery: SELF, effects, tags, ...rest,
  };
}

// ---- 刃と撃破（pack_edge）— 履歴・代償・状態で、同じ「殴る」を8通りに割る ----

// 上振れを、自分の隙で買う。**次に受ける一撃が重くなる**ので、
// 受けられる場面かどうかを先に読ませる。
activeSkills.reckless_swing = strikeWith(
  "reckless_swing", "捨て身の一振り", 20_000,
  [{ type: "add_status", target: SELF, statusId: "exposed", stacks: 1 }],
  { tags: ["attack", "risk"] },
);

// 同じ相手を続けて狙っていたら伸びる。**集中砲火の対価。**
activeSkills.double_back = strikeWith("double_back", "二の太刀", 16_500);
activeSkills.double_back.intrinsicPredicates = [streakIs("gte", 2)];

// 続けて同じ相手を狙っていないときだけ伸びる。**二の太刀の裏。**
// どちらか片方しか成立しないので、二本挿しは択の放棄になる。
activeSkills.spread_cut = strikeWith("spread_cut", "散らし斬り", 13_500);
activeSkills.spread_cut.intrinsicPredicates = [streakIs("lte", 1)];

// 1ラウンド目だけ。**先手を取れる編成にだけ意味がある。**
activeSkills.opening_stab = strikeWith("opening_stab", "先の一刺し", 18_500);
activeSkills.opening_stab.intrinsicPredicates = [{ type: "round_number", op: "eq", value: 1 }];

// 自分が半分以下のときだけ。「無理を通す」（HP60%以上）の鏡。
// **どちらも単独で価値があり、条件が重ならない。**
activeSkills.bloodied_charge = strikeWith("bloodied_charge", "手負いの突撃", 20_500);
activeSkills.bloodied_charge.intrinsicPredicates = [
  { type: "hp_percent", subject: "self", op: "lte", value: 50 },
];

// 威力を捨てて、相手の出力を削る。**倒さずに軽くする**攻め手。
activeSkills.hamstring = strikeWith(
  "hamstring", "足を払う", 8_500,
  [{ type: "add_status", target: EVENT_TARGET, statusId: "staggered", stacks: 1 }],
  { tags: ["attack", "debuff"] },
);

// HP30%以下だけを狙う。止めの一突き（50%以下・140%）より狭く、強い。
const NEAR_DEAD_ENEMY = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "hp_percent", op: "lte", value: 30 }],
  sort: ["hp_asc"],
  take: 1,
};
activeSkills.execute_low = strikeWith("execute_low", "首を落とす", 20_000, [], {
  targetQuery: NEAR_DEAD_ENEMY,
  tags: ["attack", "execute"],
});
activeSkills.execute_low.intrinsicPredicates = [hasEligibleTarget(NEAR_DEAD_ENEMY)];

// 受けの厚い相手へ通る細い線。**裂傷は受けを無視する**ので、
// guard の高い敵ほど、直接の一撃より裂傷のほうが効く。
activeSkills.rend = strikeWith(
  "rend", "抉る", 9_500,
  [{ type: "add_status", target: EVENT_TARGET, statusId: "bleeding", stacks: 2 }],
  { tags: ["attack", "debuff"] },
);

// ---- 防壁と隊列（pack_wall）— 隊列を「相手の側でも」動かす ----

// **敵の前後を入れ替える。**後列を引きずり出せば、届かなかった刃が届く。
// swap_positions を敵に使う唯一の技能で、隊列の話を相手側へ広げる。
const ENEMY_REAR_WEAKEST = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "row_is", row: "rear" }],
  sort: ["hp_asc"],
  take: 1,
};
activeSkills.drag_forward = support("drag_forward", "引きずり出す", [{
  type: "swap_positions",
  target: ENEMY_REAR_WEAKEST,
  // **前列で止まらない**と宣言する。engine の actionReach() は effect の reach を
  // 読むので、これが無いと targetQuery が melee 扱いになり後列を選べない（実測）。
  reach: "unrestricted",
  otherTarget: ENEMY_FRONT_FIRST,
}], { tags: ["move", "formation"], targetQuery: ENEMY_REAR_WEAKEST });
activeSkills.drag_forward.intrinsicPredicates = [
  hasEligibleTarget(ENEMY_REAR_WEAKEST),
  hasEligibleTarget({ scope: "enemies", filters: [{ type: "alive" }, { type: "row_is", row: "front" }] }),
];

// 前列全員へ薄い防壁。**一人へ厚く置く「傷へ盾を」の対。**
activeSkills.shield_wall = support("shield_wall", "盾の列", [{
  type: "gain_barrier", target: ALLY_FRONT_ALL, amount: focusAmount(7_000), duration: "round",
}], { tags: ["guard", "formation"] });

// **自分ではなく、仲間同士を入れ替える。**位置替え（自分が入る）と違い、
// 前へ出す人と下げる人を別々に選べる。
const ALLY_FRONT_WEAKEST = {
  scope: "allies", filters: [{ type: "alive" }, { type: "row_is", row: "front" }], sort: ["hp_asc"], take: 1,
};
const ALLY_REAR_HEALTHIEST = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "row_is", row: "rear" }, { type: "not_self" }],
  sort: ["hp_desc"],
  take: 1,
};
activeSkills.rally_line = support("rally_line", "陣を組み直す", [{
  type: "swap_positions", target: ALLY_FRONT_WEAKEST, otherTarget: ALLY_REAR_HEALTHIEST,
}], { tags: ["move", "formation"], targetQuery: ALLY_FRONT_WEAKEST });
activeSkills.rally_line.intrinsicPredicates = [
  hasEligibleTarget(ALLY_FRONT_WEAKEST),
  hasEligibleTarget(ALLY_REAR_HEALTHIEST),
];

// **最大HPで伸びる唯一の量。**技術の低い前衛でも、体そのもので壁になれる。
// 戦闘防壁なのでラウンドで消えない代わりに、量は小さい。
//
// **開幕2ラウンドに限る。**戦闘防壁はラウンドで消えないので、条件を付けないと
// 「敵を一体残して張り続ける」だけで持ち越しHPが改善する（AGENTS.md の anti-stall）。
// active skill は limit を持てない（v1 schema）ので、代わりに round で閉じる。
const OPENING_ROUNDS = { type: "round_number", op: "lte", value: 2 };
activeSkills.bulwark_of_will = support("bulwark_of_will", "意地の壁", [{
  type: "gain_barrier",
  target: SELF,
  amount: { type: "stat_scaled", subject: "self", scalingStat: "max_hp", coefficientBps: 1_000 },
  duration: "battle",
}], { tags: ["guard"] });
activeSkills.bulwark_of_will.intrinsicPredicates = [OPENING_ROUNDS];

// 受け構えを前列へ配る。**一人で構える「衝撃に備える」の面展開。**
activeSkills.spread_the_guard = support("spread_the_guard", "構えを配る", [{
  type: "gain_block", target: ALLY_FRONT_ALL, amount: { type: "constant", value: 1 },
}], { tags: ["guard", "formation"] });

// 攻めながら自分に守勢。**攻守のどちらかを捨てないぶん、威力は控えめ。**
activeSkills.bracing_thrust = strikeWith(
  "bracing_thrust", "受けながらの突き", 10_500,
  [{ type: "add_status", target: SELF, statusId: "warded", stacks: 1 }],
  { tags: ["attack", "guard"] },
);

// ---- 構えと手当て（pack_care）— 傷を「戻す」以外のやり方を増やす ----

// 半分以下の者**全員**へ薄い防壁。散った傷をまとめて止める。
const ALLY_WOUNDED_ALL = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "hp_percent", op: "lte", value: 50 }],
  take: "all",
};
activeSkills.field_dressing = support("field_dressing", "まとめて手当て", [{
  type: "gain_barrier", target: ALLY_WOUNDED_ALL, amount: focusAmount(6_000), duration: "round",
}], { tags: ["care", "guard"] });
activeSkills.field_dressing.intrinsicPredicates = [hasEligibleTarget(ALLY_WOUNDED_ALL)];

// 集中を**自分ではなく、隊列の最後の仲間へ**。狙いを澄ますの逆向き。
activeSkills.steady_breath = support("steady_breath", "息を合わせる", [{
  type: "add_status", target: ALLY_LATEST, statusId: "focused", stacks: 1,
}], { tags: ["care", "buff"] });

// 一撃ごとに薄くする守り。**防壁と違い、削り切られない。**
activeSkills.ward_ally = support("ward_ally", "守勢を渡す", [{
  type: "add_status", target: ALLY_WEAKEST, statusId: "warded", stacks: 1,
}], { tags: ["care", "guard"] });

// **このラウンド一度も殴られていないときだけ。**後ろで静かにしていた者の一手。
activeSkills.precise_cut = {
  id: "precise_cut",
  displayName: "静かな一手",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [{
    type: "history_count", subject: "self", metric: "damage_taken", window: "round", op: "eq", value: 0,
  }],
  targetQuery: ENEMY_WEAKEST,
  effects: [{
    type: "deal_damage",
    target: EVENT_TARGET,
    amount: focusAmount(15_000),
    reach: "ranged",
    tags: ["attack", "technique"],
  }],
  tags: ["attack", "care"],
};

// 戦闘のあいだ消えない防壁。**薄いが、待っても減らない。**
// 意地の壁と同じ理由で開幕2ラウンドに限る（積み上げを round で閉じる）。
activeSkills.sustaining_ward = support("sustaining_ward", "長く守る", [{
  type: "gain_barrier", target: ALLY_WEAKEST, amount: focusAmount(9_000), duration: "battle",
}], { tags: ["care", "guard"] });
activeSkills.sustaining_ward.intrinsicPredicates = [OPENING_ROUNDS];

// 自分に付いた隙を払って、代わりに守勢を得る。**状態を消す唯一の行動。**
activeSkills.cleansing_step = support("cleansing_step", "払いのける", [
  { type: "remove_status", target: SELF, statusId: "exposed", stacks: "all" },
  { type: "add_status", target: SELF, statusId: "warded", stacks: 1 },
], { tags: ["care", "guard"] });

// ---- 行動権と準備（pack_tempo）— 順番の触り方を増やす ----

// 号令は前列の先頭へ渡す。こちらは**一番遅い者へ**。まだ動いていない側を押す。
activeSkills.hasten_ally = support("hasten_ally", "背を押す", [{
  type: "gain_resource", target: ALLY_LATEST, resource: "action_points",
  amount: { type: "constant", value: 1 },
}], { tags: ["tempo"] });

// 後列全員へ反応権。**手数ではなく、割り込みの権利を配る。**
activeSkills.call_the_slow = support("call_the_slow", "後詰めを呼ぶ", [{
  type: "gain_resource", target: ALLY_REAR_ALL, resource: "reaction_points",
  amount: { type: "constant", value: 1 },
}], { tags: ["tempo"] });
activeSkills.call_the_slow.intrinsicPredicates = [hasEligibleTarget(ALLY_REAR_ALL)];

// 最前の敵に怯みを付ける。**先に動く相手ほど、軽くする価値がある。**
activeSkills.feint = support("feint", "誘い", [{
  type: "add_status", target: ENEMY_FRONT_FIRST, statusId: "staggered", stacks: 1, reach: "unrestricted",
}], { tags: ["tempo", "debuff"], targetQuery: ENEMY_FRONT_FIRST });
activeSkills.feint.intrinsicPredicates = [hasEligibleTarget(ENEMY_FRONT_FIRST)];

// 準備を1回挟んで、行動権と集中を取り戻す。**手数は増えない**
// （開始と準備で2つ払い、1つ返る）。増えるのは次の一手の質。
activeSkills.set_the_pace = {
  id: "set_the_pace",
  displayName: "拍を作る",
  apCost: 1,
  actionMode: "channel",
  intrinsicPredicates: [],
  targetQuery: SELF,
  effects: [],
  preparation: {
    steps: 1,
    completionEffects: [
      { type: "gain_resource", target: SELF, resource: "action_points", amount: { type: "constant", value: 1 } },
      { type: "add_status", target: SELF, statusId: "focused", stacks: 1 },
    ],
  },
  tags: ["tempo", "preparation"],
};

// ---- 連撃と刻印（pack_barrage）— 刻印を「数」として読む ----

// 5回刻む。**受け構えを剥がしやすく、受けの厚い相手には最も弱い。**
activeSkills.flurry_finish = strikeWith("flurry_finish", "刻み止め", 3_000, [], {
  targetQuery: ENEMY_WEAKEST,
  tags: ["attack", "onhit"],
});
activeSkills.flurry_finish.effects[0].hitCount = 5;

// 隙を持たない敵**全員**へ隙を配る。刻印撃ちが一人ずつ付けるのに対し、面で撒く。
const ENEMY_UNEXPOSED_ALL = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "eq", value: 0 }],
  take: "all",
};
activeSkills.mark_spread = support("mark_spread", "刻印を散らす", [{
  type: "add_status", target: ENEMY_UNEXPOSED_ALL, statusId: "exposed", stacks: 1, reach: "unrestricted",
}], { tags: ["mark", "debuff"], targetQuery: ENEMY_UNEXPOSED_ALL });
activeSkills.mark_spread.intrinsicPredicates = [hasEligibleTarget(ENEMY_UNEXPOSED_ALL)];

// **隙の段数そのものがダメージになる。**parameter を読まないので、
// 誰が撃っても同じ量が出る。刻印を貯めた回数だけが答えになる技能。
const ENEMY_MOST_EXPOSED = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "gte", value: 1 }],
  sort: ["hp_asc"],
  take: 1,
};
activeSkills.shatter_point = {
  id: "shatter_point",
  displayName: "積もる刻印",
  apCost: 1,
  actionMode: "offense",
  intrinsicPredicates: [hasEligibleTarget(ENEMY_MOST_EXPOSED)],
  targetQuery: ENEMY_MOST_EXPOSED,
  effects: [
    {
      type: "deal_damage",
      target: EVENT_TARGET,
      amount: {
        type: "status_stacks_scaled", subject: "selected_target", statusId: "exposed",
        numerator: 45, denominator: 1,
      },
      reach: "melee",
      guardPierceBps: 10_000,
      tags: ["attack", "mark"],
    },
    { type: "remove_status", target: EVENT_TARGET, statusId: "exposed", stacks: "all" },
  ],
  tags: ["attack", "mark"],
};

// ---- 余波と受け渡し（pack_relay）— 自分の不利で他人の有利を買う ----

// 一番傷ついた者へ守勢を2つ。**代償は自分の隙。**庇うのではなく、
// 自分が狙われやすくなることで前を通す。
activeSkills.take_the_wound = support("take_the_wound", "傷を引き受ける", [
  { type: "add_status", target: ALLY_WEAKEST, statusId: "warded", stacks: 2 },
  { type: "add_status", target: SELF, statusId: "exposed", stacks: 1 },
], { tags: ["handoff", "guard", "risk"] });

// 前列の最速へ集中を渡す。**自分の一手を、他人の一手に変える。**
activeSkills.pass_the_edge = support("pass_the_edge", "刃を渡す", [{
  type: "add_status", target: ALLY_FRONT_FIRST, statusId: "focused", stacks: 1,
}], { tags: ["handoff", "buff"] });
activeSkills.pass_the_edge.intrinsicPredicates = [hasEligibleTarget(ALLY_FRONT_FIRST)];

// ---------------------------------------------------------------- 武器と技
//
// R11 — **攻めの軸を2本にする。**
//
// R6 §4.4 は「全員が might と focus を持つ。だから weapon 役にも支援技能を、
// 支援役にも technique 攻撃を付けられる」と宣言していた。だが実装は片側しか
// 作っていない。数えると、ダメージ28件が全部 might で、focus は防壁8件にしか
// 効かない（回復は被ダメージ量でスケールするので focus と無関係）。
//
// **攻めの軸が1本しか無いと、攻撃役は「might が高い人」しか作れない。**
// 守りには防壁(focus)と軽減(guard)の2軸があるので、編成は必ず守りへ偏る。
// arcanist が「準備攻撃」役でありながら might 16（全体最下位）なのも、
// mender の focus 44 が初期構成で一切読まれないのも、同じ穴から出ている。
//
// 効果の tag には最初から "weapon" が入っている。ここでは、その対になる
// "technique" を実際に働かせる。**分け方は威力ではなく、成立のさせ方で決める。**
//
//   weapon    … 直接当てる。刃と力で、前から。         → might
//   technique … 準備・条件・届きを使う。後ろからでも効く。→ focus
//
// engine は触らない。scalingStat を読むのは effects.mjs の既存経路のままである。
export const TECHNIQUE_SKILL_IDS = Object.freeze([
  "heavy_swing",   // 溜め突き — 準備1回を代償にする
  "long_swing",    // 大溜め   — 準備3回を代償にする
  "hunt_the_slow", // 準備狩り — 敵の準備を読んで割り込む
  "rear_hunt",     // 後衛狩り — 後列へ届かせる（reach: ranged）
  "crack_mark",    // 傷口を開く — 隙を刻む
  "mark_strike",   // 刻印撃ち
  "mark_break",    // 刻印砕き
  "aimed_shot",    // 狙い撃ち — Stage 0 の安定した技
]);

// 敵側の技能（enemy_heavy など）は対象にしない。**敵の攻撃は might のままである。**
// 味方の focus を上げても敵が強くならないようにしておく。
function retuneAsTechnique(node, counter) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const entry of node) retuneAsTechnique(entry, counter);
    return;
  }
  if (node.type === "deal_damage" && node.amount?.type === "stat_scaled") {
    node.amount = { ...node.amount, scalingStat: "focus" };
    node.tags = [...(node.tags ?? []).filter((tag) => tag !== "weapon"), "technique"];
    counter.converted += 1;
  }
  for (const value of Object.values(node)) retuneAsTechnique(value, counter);
}

for (const id of TECHNIQUE_SKILL_IDS) {
  const definition = activeSkills[id];
  if (!definition) throw new Error("technique: 未知の技能 " + id);
  const counter = { converted: 0 };
  retuneAsTechnique(definition, counter);
  // **黙って何もしないのを許さない。**係数の持ち方が変わったら、ここで落ちる。
  if (counter.converted === 0) throw new Error("technique: " + id + " に stat_scaled な damage が無い");
}

export const ACTIVE_SKILLS = activeSkills;
