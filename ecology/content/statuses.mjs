// ecology/content/statuses.mjs
//
// **状態異常の表示名と規則。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。fixture 由来の2つ（隙・集中）も production では割合効果へ
// 上書きする。fixture content 自体は engine の固定値 witness として残す。
//
// R16 — **状態を3つ足した。**技能を大量に増やすとき、既存の「隙」「集中」だけを
// 相方にすると、どの新技能も「隙を付ける／集中を得る」の言い換えになる。
// 足したのは**軸の違う3つ**で、どれも engine 語彙を増やさない
// （damage_proposed への interrupt と round_ended への after だけで書けている）。
//
//   怯み staggered … **持ち主が出す**ダメージが減る。守りを攻めの手で作る軸。
//   守勢 warded   … **持ち主が受ける**各hitを割合で減らす。防壁（総量）でも
//                   受け構え（回数）でもない三つ目の守り。
//   裂傷 bleeding … ラウンド終わりに段数ぶん最大HPに応じた固定ダメージ。
//                   受けを無視し、段数は終了時に切り捨て半減する。
//
// issue #238 — **記録だけの状態を一つ足した（必殺 ultimate_spent）。**規則を持たず、
// 「この戦闘でもう放った」ことだけを覚える。積み上がらない（maxStacks 1）ので
// anti-stall の対象にならない。
//
// PR287では持続状態の段数をラウンド終了時に半減する。

import { renamed, scaleFlatAmounts } from "./base.mjs";

export const STATUS_NAMES = {
  exposed: "隙",
  focused: "集中",
  staggered: "怯み",
  warded: "守勢",
  bleeding: "裂傷",
  armor_broken: "砕けた鎧",
  warhammer_fragment: "戦利の破片",
  breached: "砕け目",
  taunted: "誘引",
  dual_blades_reserved_blade: "仕込み",
  gauntlets_momentum: "踏み込み",
  gauntlets_form: "見取りの型",
  launcher_observed: "観測済み",
  launcher_order_mark: "射順表",
  launcher_signal: "合図弾",
  tower_shield_guard_stance: "守勢",
  tower_shield_redirected: "引受け",
  tower_shield_line_status: "盾の列",
  tower_shield_mirror: "鏡",
  tower_shield_castle: "鏡城",
  tower_shield_sanctuary_status: "聖域",
  long_spear_pinned: "縫い留め",
  long_spear_delayed: "足止め",
  long_spear_gate: "関所",
  long_spear_order_mark_status: "順番標",
  medical_kit_stimulant: "活性剤",
  medical_kit_surplus: "余剰包帯",
  medical_kit_regeneration: "再生薬",
  medical_kit_reserve_blood: "予備血",
  grappling_hook_rush: "走れの合図",
  grappling_hook_mark: "鉤縄の印",
  grappling_hook_anchor: "二点固定",
  banner_commanded: "号旗の鼓舞",
  banner_debt: "借り札",
  banner_time_sand: "砂時計",
  banner_line_step: "揃い足",
  heavy_crossbow_target_mark: "着弾印",
  heavy_crossbow_ammo: "次弾装填",
  heavy_crossbow_steady: "装填維持",
  heavy_crossbow_detonation: "時限矢",
  ultimate_spent: "必殺",
};

const statuses = renamed("statuses", STATUS_NAMES);

// fixture 由来の値を production の10倍尺度へ一度そろえる。直後に隙・集中を
// 割合効果として上書きするが、fixture content 自体は engine の固定値 witness として残す。
for (const definition of Object.values(statuses)) scaleFlatAmounts(definition);

const SELF_TARGET = { scope: "self", take: 1 };
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
const SELF_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
};

const statusStacksAre = (statusId, stacks) => ({
  type: "has_status", subject: "self", statusId, op: "eq", value: stacks,
});
const pendingPercent = (percent) => ({
  type: "event_value_scaled", key: "amount", numerator: percent, denominator: 100,
});

// 一つの status rule で「event amount × status 段数」を直接は書けず、同じruleは
// chain安全契約により1回しか発火しない。そこで段数とhit番号の排他的な組ごとにruleを
// 展開する。現行の最大は刻み止め5hit＋連撃affix1hitの6。有限本のまま各hitへ効かせる。
const MAX_CONTENT_HITS = 6;
function pendingPercentRules({ statusId, maxStacks, subjectPredicate, operation, percentPerStack }) {
  return Array.from({ length: maxStacks }, (_, stackIndex) => (
    Array.from({ length: MAX_CONTENT_HITS }, (_, hitIndex) => {
      const stacks = stackIndex + 1;
      return {
        id: stacks === 1 && hitIndex === 0
          ? statusId + "_rule"
          : `${statusId}_${stacks}_${hitIndex}_rule`,
        listenTo: "damage_proposed",
        timing: "interrupt",
        priority: 45,
        predicates: [
          subjectPredicate,
          statusStacksAre(statusId, stacks),
          { type: "event_value", key: "hitIndex", op: "eq", value: hitIndex },
        ],
        costs: [],
        effects: [{
          type: "modify_pending_amount",
          operation,
          amount: pendingPercent(percentPerStack * stacks),
        }],
        limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
      };
    })
  )).flat();
}

// 隙 — 受ける各hitを1段20%ずつ太くする。固定+10では、50〜100の一撃にも
// 多段にも同じ一度しか効かず、深い刻印技能の利得先にならなかった。
statuses.exposed = {
  id: "exposed",
  displayName: STATUS_NAMES.exposed,
  polarity: "negative",
  maxStacks: 2,
  duration: "round",
  rules: pendingPercentRules({
    statusId: "exposed", maxStacks: 2, subjectPredicate: SELF_IS_EVENT_TARGET,
    operation: "increase", percentPerStack: 20,
  }),
  tags: ["playable", "debuff"],
};

// 集中 — 次の damage / heal / barrier を50%太くして消える。
// 一律+10では小技ほど相対的に得で、大溜めや厚い防壁へ合わせる理由がなかった。
statuses.focused = {
  id: "focused",
  displayName: STATUS_NAMES.focused,
  polarity: "positive",
  maxStacks: 1,
  duration: "battle",
  rules: [
    ["damage_proposed", "focused_damage_rule", SELF_IS_EVENT_SOURCE],
    ["healing_proposed", "focused_healing_rule", SELF_IS_EVENT_SOURCE],
    ["barrier_proposed", "focused_barrier_rule", SELF_IS_EVENT_SOURCE],
  ].map(([listenTo, id, predicate]) => ({
    id,
    listenTo,
    timing: "interrupt",
    priority: 40,
    predicates: [predicate],
    costs: [],
    effects: [
      { type: "modify_pending_amount", operation: "increase", amount: pendingPercent(50) },
      { type: "remove_status", target: SELF_TARGET, statusId: "focused", stacks: "all" },
    ],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  })),
  tags: ["playable", "buff"],
};

// 怯み — 持ち主が出す各hitを、1段につき15%軽くする。R25の武器横断
// コンボで3段まで積めるため、旧20%×2より上限は少し強く、1段は暴れにくい。
// **「殴られる前に殴る」以外の止め方**を、攻め手側の語彙で作るためにある。
statuses.staggered = {
  id: "staggered",
  displayName: STATUS_NAMES.staggered,
  polarity: "negative",
  maxStacks: 3,
  duration: "round",
  rules: pendingPercentRules({
    statusId: "staggered", maxStacks: 3, subjectPredicate: SELF_IS_EVENT_SOURCE,
    operation: "decrease", percentPerStack: 15,
  }),
  tags: ["playable", "debuff"],
};

// 守勢 — 持ち主が受ける各hitを、1段につき20%軽くする。
// **防壁・受け構えと三つ巴になる。**防壁は総量を、受け構えは回数を、
// 守勢はラウンド中の全hitへ割合で追従する、削り切られない軽減を引き受ける。
statuses.warded = {
  id: "warded",
  displayName: STATUS_NAMES.warded,
  polarity: "positive",
  maxStacks: 2,
  duration: "round",
  rules: pendingPercentRules({
    statusId: "warded", maxStacks: 2, subjectPredicate: SELF_IS_EVENT_TARGET,
    operation: "decrease", percentPerStack: 20,
  }),
  tags: ["playable", "guard"],
};

// 裂傷 — ラウンド終わりに1段につき最大HPの5%。受けを無視し、段数はその後半減する。
statuses.bleeding = {
  id: "bleeding",
  displayName: STATUS_NAMES.bleeding,
  polarity: "negative",
  maxStacks: "unbounded",
  duration: "battle",
  decayAtRoundEnd: true,
  rules: [{
    id: "bleeding_rule",
    listenTo: "round_ended",
    timing: "after",
    priority: 60,
    predicates: [{ type: "has_status", subject: "self", statusId: "bleeding", op: "gte", value: 1 }],
    costs: [],
    effects: [{
      type: "deal_damage",
      target: SELF_TARGET,
      amount: {
        type: "status_stacks_scaled", subject: "self", statusId: "bleeding",
        numerator: 5, denominator: 100,
      },
      guardPierceBps: 10_000,
      tags: ["bleed"],
    }],
    limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
  }],
  tags: ["playable", "debuff"],
};

// R25 戦槌の共有語彙。どれも技能IDを読まず、状態を付けた別武器でも同じように働く。
statuses.armor_broken = {
  id: "armor_broken",
  displayName: STATUS_NAMES.armor_broken,
  polarity: "negative",
  maxStacks: 1,
  duration: "round",
  durationRounds: 2,
  guardBonusPerStack: -10,
  rules: [],
  tags: ["playable", "debuff", "guard"],
};

statuses.warhammer_fragment = {
  id: "warhammer_fragment",
  displayName: STATUS_NAMES.warhammer_fragment,
  polarity: "positive",
  maxStacks: 5,
  duration: "battle",
  guardBonusPerStack: 6,
  rules: [],
  tags: ["playable", "buff", "guard"],
};

statuses.breached = {
  id: "breached",
  displayName: STATUS_NAMES.breached,
  polarity: "negative",
  maxStacks: 1,
  duration: "round",
  rules: [{
    id: "breached_damage_rule",
    listenTo: "damage_proposed",
    timing: "interrupt",
    priority: 24,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [],
    effects: [
      { type: "modify_pending_amount", operation: "increase", amount: pendingPercent(50) },
      { type: "remove_status", target: SELF_TARGET, statusId: "breached", stacks: "all" },
    ],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }],
  tags: ["playable", "debuff", "attack"],
};

// R25 大盾R — **誘引は対象選択を一段だけ書き換える状態**。敵の単体攻撃が
// この持ち主を優先し、対象に選ばれた時点で1段消費する。範囲攻撃や味方の
// 支援対象選択は横取りしない。
const EVENT_SOURCE_IS_ENEMY = {
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_source" }, { type: "alive" }], take: 1 },
};
statuses.taunted = {
  id: "taunted",
  displayName: STATUS_NAMES.taunted,
  polarity: "positive",
  maxStacks: 6,
  duration: "round",
  rules: [{
    id: "taunted_consume_rule",
    listenTo: "target_selected",
    timing: "after",
    priority: 90,
    predicates: [
      SELF_IS_EVENT_TARGET,
      EVENT_SOURCE_IS_ENEMY,
      { type: "event_tag", tag: "attack", value: true },
    ],
    costs: [],
    effects: [{ type: "remove_status", target: SELF_TARGET, statusId: "taunted", stacks: 1 }],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }],
  tags: ["playable", "buff", "guard", "taunt"],
};

// 双刃BB1と重弩の共有記録状態。味方の非攻撃主行動を仕込みとして貯め、
// どちらかの武器技能で消費する。
statuses.dual_blades_reserved_blade = {
  id: "dual_blades_reserved_blade",
  displayName: STATUS_NAMES.dual_blades_reserved_blade,
  polarity: "positive",
  maxStacks: 6,
  duration: "battle",
  rules: [],
  tags: ["playable", "buff", "weapon_setup"],
};

// Stage 0の格闘具／射出器が共有する記録状態。いずれも技能IDではなく、
// 移動・攻撃・対象選択で観測できる事実を次の行動へ渡す。
statuses.gauntlets_momentum = {
  id: "gauntlets_momentum",
  displayName: STATUS_NAMES.gauntlets_momentum,
  polarity: "positive",
  maxStacks: 2,
  duration: "turn",
  rules: [],
  tags: ["playable", "buff", "gauntlets"],
};

statuses.gauntlets_form = {
  id: "gauntlets_form",
  displayName: STATUS_NAMES.gauntlets_form,
  polarity: "positive",
  maxStacks: 3,
  duration: "battle",
  rules: [],
  tags: ["playable", "buff", "gauntlets"],
};

statuses.launcher_observed = {
  id: "launcher_observed",
  displayName: STATUS_NAMES.launcher_observed,
  polarity: "negative",
  maxStacks: 3,
  duration: "round",
  rules: [],
  tags: ["playable", "debuff", "launcher"],
};

statuses.launcher_order_mark = {
  id: "launcher_order_mark",
  displayName: STATUS_NAMES.launcher_order_mark,
  polarity: "positive",
  maxStacks: 3,
  duration: "round",
  rules: [],
  tags: ["playable", "buff", "launcher"],
};

statuses.launcher_signal = {
  id: "launcher_signal",
  displayName: STATUS_NAMES.launcher_signal,
  polarity: "positive",
  maxStacks: 1,
  duration: "turn",
  rules: [{
    id: "launcher_signal_rule",
    listenTo: "damage_proposed",
    timing: "interrupt",
    priority: 39,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [],
    effects: [
      { type: "modify_pending_amount", operation: "increase", amount: pendingPercent(30) },
      { type: "remove_status", target: SELF_TARGET, statusId: "launcher_signal", stacks: "all" },
    ],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }],
  tags: ["playable", "buff", "launcher"],
};

// R26 大盾／長槍の記録状態。防壁・誘引・直線・行動順を、武器IDではなく
// shared event へ残す。大盾の軽減規則は各 passive が所有し、BB3で得る鏡が
// passive未装着時に勝手に軽減を始めないよう、ここでは規則を持たせない。
const towerShieldMarker = (id, polarity, maxStacks, duration, tags = ["playable", "buff", "tower_shield"]) => ({
  id,
  displayName: STATUS_NAMES[id],
  polarity,
  maxStacks,
  duration,
  rules: [],
  tags,
});

statuses.tower_shield_guard_stance = towerShieldMarker(
  "tower_shield_guard_stance", "positive", 3, "round", ["playable", "buff", "guard", "tower_shield"],
);
statuses.tower_shield_redirected = towerShieldMarker(
  "tower_shield_redirected", "positive", 1, "turn", ["playable", "buff", "guard", "tower_shield"],
);
statuses.tower_shield_line_status = towerShieldMarker(
  "tower_shield_line_status", "positive", 1, "round", ["playable", "buff", "guard", "tower_shield"],
);
statuses.tower_shield_mirror = towerShieldMarker(
  "tower_shield_mirror", "positive", 3, "battle", ["playable", "buff", "guard", "tower_shield"],
);
statuses.tower_shield_castle = towerShieldMarker(
  "tower_shield_castle", "positive", 1, "round", ["playable", "buff", "guard", "tower_shield"],
);

statuses.tower_shield_sanctuary_status = {
  id: "tower_shield_sanctuary_status",
  displayName: STATUS_NAMES.tower_shield_sanctuary_status,
  polarity: "positive",
  maxStacks: 1,
  duration: "round",
  rules: [{
    id: "tower_shield_sanctuary_rule",
    listenTo: "target_selected",
    timing: "interrupt",
    priority: 86,
    predicates: [
      {
        type: "target_exists",
        query: {
          scope: "allies",
          filters: [{ type: "alive" }, { type: "is_event_primary_target" }, { type: "not_self" }],
          take: 1,
        },
      },
      {
        type: "target_exists",
        query: { scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_source" }], take: 1 },
      },
      { type: "event_tag", tag: "attack", value: true },
      { type: "event_value", key: "targetCount", op: "eq", value: 1 },
    ],
    costs: [],
    effects: [{ type: "redirect_pending_target", target: { scope: "self", take: 1 } }],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }],
  tags: ["playable", "buff", "guard", "tower_shield"],
};

statuses.long_spear_pinned = towerShieldMarker(
  "long_spear_pinned", "negative", 1, "round", ["playable", "debuff", "long_spear"],
);
statuses.long_spear_gate = towerShieldMarker(
  "long_spear_gate", "negative", 1, "round", ["playable", "debuff", "long_spear"],
);
statuses.long_spear_order_mark_status = towerShieldMarker(
  "long_spear_order_mark_status", "negative", 1, "round", ["playable", "debuff", "long_spear"],
);
statuses.long_spear_delayed = {
  id: "long_spear_delayed",
  displayName: STATUS_NAMES.long_spear_delayed,
  polarity: "negative",
  maxStacks: 1,
  duration: "round",
  rules: [{
    id: "long_spear_delayed_rule",
    listenTo: "actor_activated",
    timing: "after",
    priority: 48,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [],
    effects: [
      { type: "reduce_resource", target: SELF_TARGET, resource: "action_points", amount: { type: "constant", value: 1 } },
      { type: "remove_status", target: SELF_TARGET, statusId: "long_spear_delayed", stacks: "all" },
    ],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }],
  tags: ["playable", "debuff", "long_spear"],
};

// R27 — the remaining weapon trees use small, shared event markers. The
// markers deliberately describe a battlefield fact (a supported ally, a move,
// an ammunition reserve), so another content definition can consume them too.
const eventDamageRules = ({ statusId, maxStacks, percentPerStack, subjectPredicate, tags }) => (
  pendingPercentRules({
    statusId,
    maxStacks,
    subjectPredicate,
    operation: "increase",
    percentPerStack,
  }).map((rule) => ({
    ...rule,
    predicates: [...rule.predicates, { type: "event_tag", tag: "attack", value: true }],
    priority: 37,
    tags,
  }))
);

statuses.medical_kit_stimulant = {
  id: "medical_kit_stimulant",
  displayName: STATUS_NAMES.medical_kit_stimulant,
  polarity: "positive",
  maxStacks: 1,
  duration: "round",
  rules: eventDamageRules({
    statusId: "medical_kit_stimulant", maxStacks: 1, percentPerStack: 20,
    subjectPredicate: SELF_IS_EVENT_SOURCE, tags: ["playable", "buff", "medical_kit"],
  }),
  tags: ["playable", "buff", "medical_kit"],
};

statuses.medical_kit_surplus = {
  id: "medical_kit_surplus",
  displayName: STATUS_NAMES.medical_kit_surplus,
  polarity: "positive",
  maxStacks: 1,
  duration: "round",
  rules: [],
  tags: ["playable", "buff", "medical_kit"],
};

statuses.medical_kit_regeneration = {
  id: "medical_kit_regeneration",
  displayName: STATUS_NAMES.medical_kit_regeneration,
  polarity: "positive",
  maxStacks: 3,
  duration: "battle",
  rules: Array.from({ length: 3 }, (_, index) => {
    const stacks = index + 1;
    return {
      id: `medical_kit_regeneration_${stacks}_rule`,
      listenTo: "round_started",
      timing: "after",
      priority: 52,
      predicates: [statusStacksAre("medical_kit_regeneration", stacks)],
      costs: [],
      effects: [
        {
          type: "gain_barrier",
          target: SELF_TARGET,
          amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 4_000 },
          duration: "round",
          tags: ["support", "medical_kit", "regeneration"],
        },
        { type: "remove_status", target: SELF_TARGET, statusId: "medical_kit_regeneration", stacks: 1 },
      ],
      limit: { owner: "actor-instance + rule", scope: "round", count: 1 },
    };
  }),
  tags: ["playable", "buff", "medical_kit"],
};

statuses.medical_kit_reserve_blood = {
  id: "medical_kit_reserve_blood",
  displayName: STATUS_NAMES.medical_kit_reserve_blood,
  polarity: "positive",
  maxStacks: 1,
  duration: "battle",
  rules: [{
    id: "medical_kit_reserve_blood_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 53,
    predicates: [SELF_IS_EVENT_TARGET, { type: "event_tag", tag: "cost", value: false }, statusStacksAre("medical_kit_reserve_blood", 1)],
    costs: [],
    effects: [
      {
        type: "gain_barrier",
        target: SELF_TARGET,
        amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 5_000 },
        duration: "round",
        tags: ["support", "medical_kit", "reserve"],
      },
      { type: "remove_status", target: SELF_TARGET, statusId: "medical_kit_reserve_blood", stacks: "all" },
    ],
    limit: { owner: "actor-instance + rule", scope: "chain", count: 1 },
  }],
  tags: ["playable", "buff", "medical_kit"],
};

statuses.grappling_hook_rush = {
  id: "grappling_hook_rush",
  displayName: STATUS_NAMES.grappling_hook_rush,
  polarity: "positive",
  maxStacks: 1,
  duration: "turn",
  rules: eventDamageRules({
    statusId: "grappling_hook_rush", maxStacks: 1, percentPerStack: 25,
    subjectPredicate: SELF_IS_EVENT_SOURCE, tags: ["playable", "buff", "grappling_hook"],
  }),
  tags: ["playable", "buff", "grappling_hook"],
};

const neutralMarker = (id, polarity, maxStacks, duration, tags) => ({
  id,
  displayName: STATUS_NAMES[id],
  polarity,
  maxStacks,
  duration,
  rules: [],
  tags,
});

statuses.grappling_hook_mark = neutralMarker(
  "grappling_hook_mark", "neutral", 1, "round", ["playable", "mark", "grappling_hook"],
);
statuses.grappling_hook_anchor = neutralMarker(
  "grappling_hook_anchor", "neutral", 2, "round", ["playable", "mark", "grappling_hook"],
);

statuses.banner_commanded = {
  id: "banner_commanded",
  displayName: STATUS_NAMES.banner_commanded,
  polarity: "positive",
  maxStacks: 2,
  duration: "turn",
  rules: eventDamageRules({
    statusId: "banner_commanded", maxStacks: 2, percentPerStack: 15,
    subjectPredicate: SELF_IS_EVENT_SOURCE, tags: ["playable", "buff", "banner"],
  }),
  tags: ["playable", "buff", "banner"],
};
statuses.banner_debt = neutralMarker(
  "banner_debt", "negative", 3, "battle", ["playable", "debt", "banner"],
);
statuses.banner_time_sand = neutralMarker(
  "banner_time_sand", "positive", 5, "battle", ["playable", "resource", "banner"],
);
statuses.banner_line_step = neutralMarker(
  "banner_line_step", "positive", 1, "turn", ["playable", "buff", "banner"],
);

statuses.heavy_crossbow_target_mark = neutralMarker(
  "heavy_crossbow_target_mark", "negative", 1, "battle", ["playable", "mark", "heavy_crossbow"],
);
statuses.heavy_crossbow_ammo = neutralMarker(
  "heavy_crossbow_ammo", "positive", 3, "battle", ["playable", "resource", "heavy_crossbow"],
);
statuses.heavy_crossbow_steady = neutralMarker(
  "heavy_crossbow_steady", "positive", 1, "turn", ["playable", "buff", "heavy_crossbow"],
);
statuses.heavy_crossbow_detonation = neutralMarker(
  "heavy_crossbow_detonation", "negative", 3, "round", ["playable", "mark", "heavy_crossbow"],
);

// 必殺（issue #238）— **放った印。**規則を一つも持たない、記録だけの状態である。
// 必殺技は「この状態が付いていないこと」を発動条件にし、放つと自分へ付ける。
// これで「1戦闘に1回」が engine・schema の語彙を増やさずに書ける。
//
// **戦闘のあいだ残る。**ラウンドで消えると同じ戦闘で二度出てしまう。
statuses.ultimate_spent = {
  id: "ultimate_spent",
  displayName: STATUS_NAMES.ultimate_spent,
  polarity: "neutral",
  maxStacks: 1,
  duration: "battle",
  rules: [],
  tags: ["playable", "mark"],
};

export const STATUSES = statuses;

// ---------------------------------------------------------------- 画面へ出す説明（issue #176）
//
// **状態の意味は、定義の隣に一度だけ書く。**作者から「守勢って何でしたっけ」という
// 問いが出た時点で、これは仕様ではなく欠陥である。技能の説明文には「守勢を1つ」としか
// 書いておらず、守勢そのものが何をするかはコードにしか無かった。
//
// 段数・持続・向きは**定義から引く**（手で書くとずれる）。ここに書くのは一行の意味だけ。
// `analysis/ecology-readout-smoke.mjs` が、STATUSES の全 id にこの一行があることと、
// 書いた数値が定義の数値と一致することを見張る。
const STATUS_SUMMARIES = {
  exposed: "受けるダメージが1段につき20%増える。多段の各hitへ効き、付けるのも払うのも技能でできる。",
  focused: "次に出す damage / heal / barrier が一度だけ50%増え、使うと消える。大きな一手ほど利得も大きい。",
  staggered: "その相手が**出す**ダメージが1段につき15%減る（最大3段）。多段の各hitへ効き、倒さずに攻撃を細くする。",
  warded: "その味方が**受ける**ダメージが1段につき20%減る。多段の各hitへ効く、防壁（総量）でも受け構え（回数）でもない三つ目の守り。",
  bleeding: "ラウンド終わりに1段につき最大HPの5%を**受けを無視して**刻み、段数を切り捨て半減する。",
  armor_broken: "防御が10下がる。付与から2ラウンド後の開始時に消える。",
  warhammer_fragment: "1個につき防御が6上がる。最大5個で、戦闘中は保持する。",
  breached: "次に受ける攻撃ダメージが50%増え、その攻撃後に消える。",
  taunted: "敵の単体攻撃がこの味方を優先する。対象に選ばれると1段消費する。範囲攻撃と味方の選択には効かない。",
  dual_blades_reserved_blade: "自分以外の味方の非攻撃主行動で1段たまる。双刃と重弩の技能が共有し、武器技能で消費する。最大6段。",
  gauntlets_momentum: "移動を伴う格闘で段がたまり、格闘攻撃を強化する。最大2段で手番の終わりに消える。",
  gauntlets_form: "味方の行動を見取った記録。1段につき格闘攻撃のダメージを8%増やし、最大3段。",
  launcher_observed: "射出器が観測した敵。射出器の対象優先と合図弾の条件になる。ラウンドで消える。",
  launcher_order_mark: "射順表を評価した記録。射出器の攻撃を強化する。最大3段でラウンドに消える。",
  launcher_signal: "観測対象への味方の攻撃を確認した合図。次に出す攻撃を30%増やし、使うと消える。",
  tower_shield_guard_stance: "誘引を消費した受け構え。1段につき被ダメージを10%減らし、最大3段でラウンドに消える。",
  tower_shield_redirected: "誘引や割り込みで引き受けた攻撃。大盾の衝撃吸収がこの攻撃を軽くする。",
  tower_shield_line_status: "大盾の防壁を受けた味方。ラウンド中の被ダメージを15%減らす。",
  tower_shield_mirror: "誘引を受け流した鏡。大盾の反転膜と裏返すが消費する。",
  tower_shield_castle: "鏡城の構え。保持中は反転膜の通常軽減を止める。",
  tower_shield_sanctuary_status: "次のラウンド開始まで、敵の単体攻撃を大盾へ寄せる。",
  long_spear_pinned: "長槍の最後のhitで残った縫い留め。移動不能の記録。",
  long_spear_delayed: "長槍で足を止められ、次の起動でAPを1失う。",
  long_spear_gate: "関所の列へ付いた移動不能の記録。",
  long_spear_order_mark_status: "長槍がずらした次の行動順の記録。",
  medical_kit_stimulant: "医療具の防壁を受けた味方が、そのラウンドに出す攻撃を20%強める。",
  medical_kit_surplus: "余った処置を一度ぶんの予備として記録する。次の被弾時に防壁へ変わる。",
  medical_kit_regeneration: "次の3回のラウンド開始時に、技術40%の防壁を作る。",
  medical_kit_reserve_blood: "次に被弾した時、技術50%の防壁を作って記録を消費する。",
  grappling_hook_rush: "移動を受けた味方の次の攻撃ダメージが25%増える。",
  grappling_hook_mark: "鉤縄が移動の起点へ残すラウンド印。",
  grappling_hook_anchor: "鉤縄が二点固定へ記録した移動印。",
  banner_commanded: "号旗のAP支援を受けた味方の次の攻撃を1段15%強める。",
  banner_debt: "前借りしたAPの返済待ち。次の戦闘ラウンドで減る。",
  banner_time_sand: "号旗が支援で蓄えた時間砂。最大5段。",
  banner_line_step: "号旗の揃い足で一時的に前列へ出る記録。",
  heavy_crossbow_target_mark: "重弩が予約した敵の位置へ残る着弾印。",
  heavy_crossbow_ammo: "通常の準備射を解決した回数。次の準備射を8%ずつ強める。",
  heavy_crossbow_steady: "準備中の被弾で準備を失わない記録。",
  heavy_crossbow_detonation: "同じ列へ置いた時限印。移動で踏まれると起爆する。",
  ultimate_spent: "必殺技を放った印。戦闘のあいだ残り、同じ戦闘では二度と放てない。それ自体は何もしない。",
};

const DURATION_TEXT = { round: "次のラウンド開始時に消える", battle: "戦闘のあいだ残る", turn: "次の手番で消える" };

// 状態ひとつぶんの説明。**段数・持続・向きは定義から、意味は上の表から。**
export const STATUS_GLOSSARY = Object.freeze(Object.entries(statuses)
  .map(([id, definition]) => Object.freeze({
    id,
    displayName: definition.displayName,
    polarity: definition.polarity,
    maxStacks: definition.maxStacks,
    duration: definition.duration,
    durationText: DURATION_TEXT[definition.duration] ?? definition.duration,
    summary: STATUS_SUMMARIES[id] ?? "",
  })));
