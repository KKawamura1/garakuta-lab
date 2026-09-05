// ecology/content/skills-reactive.mjs
//
// **反応技能（reactive skill）の定義。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// engine・schema・共通registryは変更しない。

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
  block_focus: "受け返しの集中",
  barrier_stitch: "防壁の縫い直し",
  emergency_treatment: "応急処置",
  mend: "手当て",
  triage: "応急手当",
  whetted_by_pain: "痛みで研ぐ",
  shield_handoff: "受けの受け渡し",
  patient_step: "溜めの次手",
  spill_forward: "余波を回す",
  blocked_into_step: "受けを順番へ",
  mercy_into_guard: "手当てを備えへ",
  stride_into_reach: "歩みを間合いへ",
  readied_relay: "支度を渡す",
  wake_of_the_fallen: "倒したあと",
  guarded_opening: "受け止めの隙",
  seize_the_opening: "機を逃さず",
  // R16 — 大量追加分。**読む出来事ごとに名前を分けてある。**
  opportunist: "隙に応じる",
  vengeful_step: "意趣返し",
  finish_the_wounded: "止めを促す",
  absorb_shock: "衝撃を殺す",
  guard_the_marked: "狙われた者へ",
  last_stand: "背水",
  counterweight: "支え直す",
  shared_pain: "痛みを分ける",
  watchful_care: "目を離さない",
  steady_under_fire: "揺れない手",
  second_wind: "二の息",
  read_the_charge: "溜めを読む",
  break_the_charge: "溜めを崩す",
  counter_order: "差し込む号令",
  stall_the_blow: "出鼻を挫く",
  echo_of_the_mark: "刻印の残響",
  stagger_relay: "怯みを回す",
  warded_into_edge: "守勢を刃へ",
  bleed_into_wake: "裂傷の余波",
};

const reactiveSkills = renamed("reactiveSkills", REACTIVE_SKILL_NAMES);

const SELF_TARGET = { scope: "self", take: 1 };
const SELF_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
};

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

// 余剰治療は汎用、連携治療は応急手当専用。汎用側を無償にすると
// 後者の完全な上位互換になるため、両方ともRP1を払い、専用側だけ
// 余剰量を増幅する。これで「広く薄く」と「狭く強く」の選択になる。
reactiveSkills.overflow_care.rule.costs = [{ type: "spend_reaction_points", amount: 1 }];
for (const effect of reactiveSkills.triage_relay.rule.effects ?? []) {
  if (effect.type === "heal" && effect.amount?.type === "event_value_scaled") {
    effect.amount = { ...effect.amount, numerator: 5, denominator: 4 };
  }
}

// Content Wave 1 — connect two existing defensive events to two different
// follow-up resources. Both spend RP, so the answer is not free durability.
reactiveSkills.block_focus = {
  id: "block_focus",
  displayName: REACTIVE_SKILL_NAMES.block_focus,
  rule: {
    id: "block_focus_rule",
    listenTo: "damage_blocked",
    timing: "after",
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
    limit: { scope: "round", count: 1 },
    priority: 100,
  },
  tags: ["reaction", "tempo"],
};
reactiveSkills.barrier_stitch = {
  id: "barrier_stitch",
  displayName: REACTIVE_SKILL_NAMES.barrier_stitch,
  rule: {
    id: "barrier_stitch_rule",
    listenTo: "barrier_broken",
    timing: "after",
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "gain_block", target: SELF_TARGET, amount: { type: "constant", value: 1 } }],
    limit: { scope: "round", count: 1 },
    priority: 100,
  },
  tags: ["reaction", "guard"],
};

// R8 §9.1 — 応急処置。被弾と同じ chain 内だけで発火し、実回復量は
// その被弾量の1/3を超えない。古い損傷へは効かない
// （新しい damage_taken が起きない限り発火しようがない）ので、
// round を稼いで待つだけでは carry HP が改善しない
// （analysis/ecology-anti-stall-smoke.mjs が検査する不変条件）。
// worked example は R8 §9.1 と一致させてある: 被弾36 → 応急処置12 → 残り損傷24。
reactiveSkills.emergency_treatment = {
  id: "emergency_treatment",
  displayName: REACTIVE_SKILL_NAMES.emergency_treatment,
  rule: {
    id: "emergency_treatment_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 150,
    predicates: [{
      type: "target_exists",
      query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
    }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "heal",
      target: SELF_TARGET,
      amount: { type: "event_value_scaled", key: "amount", numerator: 1, denominator: 3 },
      tags: ["care", "emergency"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "care", "emergency"],
};

// R8 Implementation Phase 1（続き）— mend / triage を anti-stall 安全な reactive
// へ作り替える（analysis/ecology-anti-stall-audit.mjs が是正前の active 版を
// 検出していた。R8_IMPLEMENTATION_PHASE0_FREEZE.md §3、作者承認済み）。
//
// どちらも emergency_treatment と同じ理由で安全: `damage_taken` にだけ反応し、
// 実回復量はその被弾量の一部（event_value_scaled）に固定される。**古い損傷へは
// 効かない**——新しい damage_taken が起きない限り発火しようがないので、round を
// 稼いで待つだけでは carry HP が改善しない。
//
//   mend   … baseline。誰の被弾でも（自分自身も含む）少量を返す安全弁。
//   triage … pack_care。被弾後にHP50%以下になった自分以外の味方へ、より大きな割合を返す。
//            自分は対象にせず、後列の支援役が前衛をつなぐための応急手当。
const ALLY_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "allies", filters: [{ type: "alive" }, { type: "is_event_primary_target" }], take: 1 },
};
const HIT_ALLY_TARGET = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "is_event_primary_target" }],
  take: 1,
};
const HIT_ALLY_BELOW_HALF_QUERY = {
  scope: "allies",
  filters: [
    { type: "alive" },
    { type: "not_self" },
    { type: "is_event_primary_target" },
    { type: "hp_percent", op: "lte", value: 50 },
  ],
  take: 1,
};

reactiveSkills.mend = {
  id: "mend",
  displayName: REACTIVE_SKILL_NAMES.mend,
  rule: {
    id: "mend_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 160,
    predicates: [ALLY_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "heal",
      target: HIT_ALLY_TARGET,
      // 被弾量の1/4だけを返す。R8 §9.1 の worked example（被弾36→応急処置12）と
      // 同じ形の、baseline 向けに控えめな比率。
      amount: { type: "event_value_scaled", key: "amount", numerator: 1, denominator: 4 },
      tags: ["care"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "care"],
};

reactiveSkills.triage = {
  id: "triage",
  displayName: REACTIVE_SKILL_NAMES.triage,
  rule: {
    id: "triage_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 140,
    predicates: [{ type: "target_exists", query: HIT_ALLY_BELOW_HALF_QUERY }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "heal",
      target: HIT_ALLY_BELOW_HALF_QUERY,
      // 自分以外の味方がHP半分以下まで削られた一撃にだけ強く反応する。被弾量の1/2を返す。
      amount: { type: "event_value_scaled", key: "amount", numerator: 1, denominator: 2 },
      // "triage" タグは triage_relay（既存）が event_tag 述語で読む。
      tags: ["care", "triage"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "care"],
};

// ---------------------------------------------------------------- pack_barrage（R8 §5.4、続き）
//
// R8 §6.2「新パックは昔のeventを読む」— pack_barrageが選ばれた過去パック
// （W: 防壁と隊列、T: 行動権と準備）が既に発生させているeventを最低2種類読む。
// どちらも「隙（exposed）を付ける」という同じ利得先へつながる、異なる発生源
// （R8 §6.3「一つの利得先へ到達する発生源を2つ以上」）。
const RANDOM_EXPOSABLE_ENEMY = {
  scope: "enemies",
  filters: [{ type: "alive" }, { type: "has_status", statusId: "exposed", op: "eq", value: 0 }],
  sort: ["hp_desc"],
  take: 1,
};

// 発生源: damage_blocked（Wのblock/barrier防御が実際に一撃を止めたとき）。
// 受け止めた側が、隙を作る側へ回る。
reactiveSkills.guarded_opening = {
  id: "guarded_opening",
  displayName: REACTIVE_SKILL_NAMES.guarded_opening,
  rule: {
    id: "guarded_opening_rule",
    listenTo: "damage_blocked",
    timing: "after",
    priority: 130,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: RANDOM_EXPOSABLE_ENEMY, statusId: "exposed", stacks: 1 }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "mark"],
};

// 発生源: resource_gained（Tの号令・急かす・拾い直しでAP/RPが動いたとき）。
// 得た行動権を、隙を作る機会へ変える。
reactiveSkills.seize_the_opening = {
  id: "seize_the_opening",
  displayName: REACTIVE_SKILL_NAMES.seize_the_opening,
  rule: {
    id: "seize_the_opening_rule",
    listenTo: "resource_gained",
    timing: "after",
    priority: 130,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: RANDOM_EXPOSABLE_ENEMY, statusId: "exposed", stacks: 1 }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "mark"],
};

// ---------------------------------------------------------------- R9 §4.1, §9.2 — 導入 pack の接続面
//
// R9 §9.2「最低でも各導入packに一つは、別の役割が使う小さな接続面を置く」。
// 攻撃 pack に守り役の入口を、守り pack に受け渡しの出口を、拍子 pack に
// 準備役の次手を置く。**どれも既存の event を読むだけで、新しい語彙は増やさない。**

// pack_edge — 殴られた側が、次の一撃を研ぐ。守り役が攻撃 pack を使う入口。
reactiveSkills.whetted_by_pain = {
  id: "whetted_by_pain",
  displayName: REACTIVE_SKILL_NAMES.whetted_by_pain,
  rule: {
    id: "whetted_by_pain_rule",
    listenTo: "damage_taken",
    timing: "after",
    priority: 120,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "attack"],
};

// pack_wall — 受け止めた結果を、自分ではなく一番傷ついた味方へ渡す。
// block_focus（自分が集中を得る）と同じ発生源から、別の役割へ出す。
const WEAKEST_ALLY_TARGET = {
  scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1,
};
reactiveSkills.shield_handoff = {
  id: "shield_handoff",
  displayName: REACTIVE_SKILL_NAMES.shield_handoff,
  rule: {
    id: "shield_handoff_rule",
    listenTo: "damage_blocked",
    timing: "after",
    priority: 125,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_barrier",
      target: WEAKEST_ALLY_TARGET,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 7_500 },
      duration: "round",
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "guard", "handoff"],
};

// pack_tempo — 準備を終えた本人が、そのまま次の手番へつなぐ。
// **RP を払って AP を得る。**払わずに得られると、準備するほど手数が増える。
reactiveSkills.patient_step = {
  id: "patient_step",
  displayName: REACTIVE_SKILL_NAMES.patient_step,
  rule: {
    id: "patient_step_rule",
    listenTo: "preparation_completed",
    timing: "after",
    priority: 120,
    predicates: [{
      type: "target_exists",
      query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
    }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_resource", target: SELF_TARGET, resource: "action_points",
      amount: { type: "constant", value: 1 },
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "tempo"],
};

// ---------------------------------------------------------------- R9 §5 — 横断pack「余波と受け渡し」
//
// **同じ出来事を、別の役割が別の結果へ変える。**R9 §5 が挙げた6つの発生源
// （防いだ / 過剰ダメージ / 回復した / 移動した / 準備を完了した / 撃破した）を
// 一つずつ読み、どれも「その役割の中で完結しない出口」へ渡す。
//
// R9 §5.1 の条件で、ここが守っているもの:
//   - 発生源が6種類ある（2種類以上）。
//   - どの発生源も、その出来事を起こせる人なら誰でも読める（人物IDを条件にしない）。
//   - どれも単独で価値があり、A＋B の固定レシピを要求しない。
//   - **待機だけでは何も増えない。**すべて RP1 を払い、round か chain で止まる。
const FRONTMOST_ALLY = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "row_is", row: "front" }],
  sort: ["position_asc"],
  take: 1,
};
const LAST_IN_FORMATION_ALLY = {
  scope: "allies", filters: [{ type: "alive" }], sort: ["position_desc"], take: 1,
};
const FRONTMOST_ENEMY = {
  scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1,
};
const WEAKEST_ALLY_QUERY = {
  scope: "allies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1,
};
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};

// 過剰ダメージ → 掃除。攻撃特化が「単体火力」から「掃除・追撃」へ広がる。
reactiveSkills.spill_forward = {
  id: "spill_forward",
  displayName: REACTIVE_SKILL_NAMES.spill_forward,
  rule: {
    id: "spill_forward_rule",
    listenTo: "excess_damage",
    timing: "after",
    priority: 110,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "deal_damage",
      target: { scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1 },
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps: 3_000 },
      tags: ["attack", "relay"],
    }],
    limit: { scope: "chain", count: 1 },
  },
  tags: ["reaction", "relay", "attack"],
};

// 防いだ → 順番。受け役が「受ける人」から「次に動く人を決める人」になる。
reactiveSkills.blocked_into_step = {
  id: "blocked_into_step",
  displayName: REACTIVE_SKILL_NAMES.blocked_into_step,
  rule: {
    id: "blocked_into_step_rule",
    listenTo: "damage_blocked",
    timing: "after",
    priority: 115,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_resource", target: FRONTMOST_ALLY, resource: "action_points",
      amount: { type: "constant", value: 1 },
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "tempo"],
};

// 回復した → 備え。回復役が「HPを戻す人」から「次の被害を止める人」になる。
reactiveSkills.mercy_into_guard = {
  id: "mercy_into_guard",
  displayName: REACTIVE_SKILL_NAMES.mercy_into_guard,
  rule: {
    id: "mercy_into_guard_rule",
    listenTo: "healing_applied",
    timing: "after",
    priority: 115,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "gain_block", target: HIT_ALLY_TARGET, amount: { type: "constant", value: 1 } }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "care"],
};

// 移動した → 相手の崩れ。機動役が「位置を直す人」から「隙を作る人」になる。
reactiveSkills.stride_into_reach = {
  id: "stride_into_reach",
  displayName: REACTIVE_SKILL_NAMES.stride_into_reach,
  rule: {
    id: "stride_into_reach_rule",
    listenTo: "actor_moved",
    timing: "after",
    priority: 115,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{ type: "add_status", target: FRONTMOST_ENEMY, statusId: "exposed", stacks: 1 }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "mark"],
};

// 準備を完了した → 隊列の最後の仲間の反応。準備役が、自分の外側へ効果を出す。
reactiveSkills.readied_relay = {
  id: "readied_relay",
  displayName: REACTIVE_SKILL_NAMES.readied_relay,
  rule: {
    id: "readied_relay_rule",
    listenTo: "preparation_completed",
    timing: "after",
    priority: 115,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_resource", target: LAST_IN_FORMATION_ALLY, resource: "reaction_points",
      amount: { type: "constant", value: 1 },
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "tempo"],
};

// 撃破した → 傷ついた仲間の盾。撃破の余波を、攻撃以外の出口へ回す。
reactiveSkills.wake_of_the_fallen = {
  id: "wake_of_the_fallen",
  displayName: REACTIVE_SKILL_NAMES.wake_of_the_fallen,
  rule: {
    id: "wake_of_the_fallen_rule",
    listenTo: "actor_defeated",
    timing: "after",
    priority: 115,
    predicates: [{
      type: "target_exists",
      query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
    }],
    costs: [{ type: "spend_reaction_points", amount: 1 }],
    effects: [{
      type: "gain_barrier",
      target: WEAKEST_ALLY_QUERY,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps: 10_000 },
      duration: "round",
    }],
    limit: { scope: "round", count: 1 },
  },
  tags: ["reaction", "relay", "guard"],
};

// ---------------------------------------------------------------- R16 — 技能の大量追加（反応）
//
// **反応技能は「どの出来事を読むか」で決まる。**R16 の 19 本は、これまで
// player content が一度も読んでいなかった出来事を読みに行く。
//
//   status_added / status_removed … 状態が付いた・消えた瞬間
//   preparation_started / _advanced … **敵の**溜めの始まりと進み
//   action_declared（interrupt）  … 敵が行動を宣言した瞬間（潰す・鈍らせる）
//   damage_proposed（interrupt）  … 自分に飛んでくる数字そのもの
//
// **どれも反応権を払い、round か chain で止まる**（AGENTS.md の anti-stall）。
// 回復を出すものは damage_taken だけを読み、chain 1 に閉じてある
// （analysis/ecology-anti-stall-audit.mjs が形で検査する）。

const EVENT_TARGET_IS_ENEMY = {
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
};
const EVENT_SOURCE_IS_ENEMY = {
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_source" }, { type: "alive" }], take: 1 },
};
const HIT_ENEMY_TARGET = {
  scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_primary_target" }], take: 1,
};
const NEAR_DEAD_HIT_ENEMY = {
  scope: "enemies",
  filters: [
    { type: "alive" }, { type: "is_event_primary_target" }, { type: "hp_percent", op: "lte", value: 25 },
  ],
  take: 1,
};
const HURT_ALLY_NOT_SELF = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "not_self" }, { type: "is_event_primary_target" }],
  take: 1,
};
const MOVED_ALLY = {
  scope: "allies",
  filters: [{ type: "alive" }, { type: "not_self" }, { type: "is_event_primary_target" }],
  take: 1,
};
const EXPOSED_EVENT_ALLY = {
  scope: "allies",
  filters: [
    { type: "alive" }, { type: "is_event_primary_target" },
    { type: "has_status", statusId: "exposed", op: "gte", value: 1 },
  ],
  take: 1,
};

// 「いま付いた（消えた）のはこの状態か」。status_added / status_removed の
// values.statusId を読む。**状態ごとに別の rule を作らずに済む唯一の書き方。**
const statusIs = (statusId) => ({ type: "event_value", key: "statusId", op: "eq", value: statusId });
const spendRp = (amount = 1) => [{ type: "spend_reaction_points", amount }];
const mightDamage = (coefficientBps) => ({
  type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps,
});
const focusBarrier = (coefficientBps) => ({
  type: "stat_scaled", subject: "self", scalingStat: "focus", coefficientBps,
});

function reaction(id, displayName, rule, tags) {
  return { id, displayName, rule: { id: id + "_rule", ...rule }, tags };
}

// ---- 刃と撃破（pack_edge）----

// 隙が付いた瞬間に刺す。**誰が付けたかを問わない**ので、
// 指揮役の「隙を刻む」でも、連撃役の「刻印撃ち」でも、同じように起きる。
reactiveSkills.opportunist = reaction("opportunist", REACTIVE_SKILL_NAMES.opportunist, {
  listenTo: "status_added",
  timing: "after",
  priority: 110,
  predicates: [statusIs("exposed"), EVENT_TARGET_IS_ENEMY],
  costs: spendRp(),
  effects: [{
    type: "deal_damage", target: HIT_ENEMY_TARGET, amount: mightDamage(4_500),
    reach: "unrestricted", tags: ["attack", "mark"],
  }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "attack", "mark"]);

// 仲間が倒れた拍。**戦闘に一度きりではなく二度まで**——立て直しの余地を残す。
reactiveSkills.vengeful_step = reaction("vengeful_step", REACTIVE_SKILL_NAMES.vengeful_step, {
  listenTo: "actor_defeated",
  timing: "after",
  priority: 110,
  predicates: [{
    type: "target_exists",
    query: { scope: "allies", filters: [{ type: "is_event_primary_target" }], take: 1 },
  }],
  costs: spendRp(),
  effects: [{
    type: "deal_damage", target: FRONTMOST_ENEMY, amount: mightDamage(6_000),
    reach: "melee", tags: ["attack"],
  }],
  limit: { scope: "battle", count: 2 },
}, ["reaction", "attack"]);

// 敵が瀕死になった一撃に重ねる。**自分が殴った一撃でなくてもよい**ので、
// 前衛が削り、後衛が止めを促す、という分業になる。
reactiveSkills.finish_the_wounded = reaction(
  "finish_the_wounded", REACTIVE_SKILL_NAMES.finish_the_wounded, {
    listenTo: "damage_taken",
    timing: "after",
    priority: 105,
    predicates: [{ type: "target_exists", query: NEAR_DEAD_HIT_ENEMY }],
    costs: spendRp(),
    effects: [{
      type: "deal_damage", target: NEAR_DEAD_HIT_ENEMY, amount: mightDamage(5_500),
      reach: "unrestricted", tags: ["attack", "execute"],
    }],
    limit: { scope: "chain", count: 1 },
  }, ["reaction", "attack", "execute"],
);

// ---- 防壁と隊列（pack_wall）----

// **飛んでくる数字そのものを削る。**防壁（総量）でも受け構え（回数）でもない、
// 三つ目の守り方。大きい一撃ほど、削り取れる割合は小さい。
reactiveSkills.absorb_shock = reaction("absorb_shock", REACTIVE_SKILL_NAMES.absorb_shock, {
  listenTo: "damage_proposed",
  timing: "interrupt",
  priority: 60,
  predicates: [SELF_IS_EVENT_TARGET],
  costs: spendRp(),
  effects: [{ type: "modify_pending_amount", operation: "decrease", amount: { type: "constant", value: 12 } }],
  limit: { scope: "round", count: 1 },
}, ["reaction", "guard"]);

// 身代わりは自分が引き受ける。こちらは**狙われた本人を厚くする**。
// 引き受けられない編成（後衛しか残っていない等）でも守りが出せる。
reactiveSkills.guard_the_marked = reaction("guard_the_marked", REACTIVE_SKILL_NAMES.guard_the_marked, {
  listenTo: "target_selected",
  timing: "interrupt",
  priority: 20,
  predicates: [EVENT_SOURCE_IS_ENEMY, ALLY_IS_EVENT_TARGET],
  costs: spendRp(),
  effects: [{ type: "add_status", target: HIT_ALLY_TARGET, statusId: "warded", stacks: 1 }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "guard"]);

// 30%を切った一撃にだけ、戦闘に一度だけ厚い防壁。**保険であって、常設の壁ではない。**
reactiveSkills.last_stand = reaction("last_stand", REACTIVE_SKILL_NAMES.last_stand, {
  listenTo: "damage_taken",
  timing: "after",
  priority: 145,
  predicates: [SELF_IS_EVENT_TARGET, { type: "hp_percent", subject: "self", op: "lte", value: 30 }],
  costs: spendRp(),
  effects: [{ type: "gain_barrier", target: SELF_TARGET, amount: focusBarrier(15_000), duration: "round" }],
  limit: { scope: "battle", count: 1 },
}, ["reaction", "guard"]);

// 踏み固めは「動いた自分」に防壁。こちらは**動いた仲間**へ。
// 位置替え・引きずり出し・陣の組み直しが、そのまま守りの合図になる。
reactiveSkills.counterweight = reaction("counterweight", REACTIVE_SKILL_NAMES.counterweight, {
  listenTo: "actor_moved",
  timing: "after",
  priority: 115,
  predicates: [{ type: "target_exists", query: MOVED_ALLY }],
  costs: spendRp(),
  effects: [{ type: "gain_barrier", target: MOVED_ALLY, amount: focusBarrier(5_000), duration: "round" }],
  limit: { scope: "round", count: 1 },
}, ["reaction", "guard", "move"]);

// ---- 構えと手当て（pack_care）----

// **自分のHPを削って、仲間の傷の半分を返す。**HP を支払う唯一の技能。
// 反応権だけでは出せないので、round を稼いでも持ち越しHPの合計は増えない。
reactiveSkills.shared_pain = reaction("shared_pain", REACTIVE_SKILL_NAMES.shared_pain, {
  listenTo: "damage_taken",
  timing: "after",
  priority: 135,
  predicates: [{ type: "target_exists", query: HURT_ALLY_NOT_SELF }],
  costs: [{ type: "spend_reaction_points", amount: 1 }, { type: "lose_hp", amount: 30 }],
  effects: [{
    type: "heal",
    target: HURT_ALLY_NOT_SELF,
    amount: { type: "event_value_scaled", key: "amount", numerator: 1, denominator: 2 },
    tags: ["care", "sacrifice"],
  }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "care"]);

// **状態を消す唯一の反応。**隙が付いた仲間から、付いた直後に払い落とす。
reactiveSkills.watchful_care = reaction("watchful_care", REACTIVE_SKILL_NAMES.watchful_care, {
  listenTo: "status_added",
  timing: "after",
  priority: 110,
  predicates: [statusIs("exposed"), { type: "target_exists", query: EXPOSED_EVENT_ALLY }],
  costs: spendRp(),
  effects: [{ type: "remove_status", target: EXPOSED_EVENT_ALLY, statusId: "exposed", stacks: "all" }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "care"]);

// 受け流しは防壁を張る。こちらは守勢。**削り切られない代わりに、薄い。**
reactiveSkills.steady_under_fire = reaction(
  "steady_under_fire", REACTIVE_SKILL_NAMES.steady_under_fire, {
    listenTo: "damage_taken",
    timing: "after",
    priority: 118,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: spendRp(),
    effects: [{ type: "add_status", target: SELF_TARGET, statusId: "warded", stacks: 1 }],
    limit: { scope: "round", count: 1 },
  }, ["reaction", "care", "guard"],
);

// 余った回復を、次の一手の集中へ。余剰治療（別の負傷者へ回す）の裏の出口。
reactiveSkills.second_wind = reaction("second_wind", REACTIVE_SKILL_NAMES.second_wind, {
  listenTo: "excess_healing",
  timing: "after",
  priority: 112,
  predicates: [SELF_IS_EVENT_SOURCE],
  costs: spendRp(),
  effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
  limit: { scope: "round", count: 1 },
}, ["reaction", "care", "tempo"]);

// ---- 行動権と準備（pack_tempo）----

// **敵が溜め始めた瞬間**に隙を刻む。急かす（味方の準備を進める）と同じ出来事の裏面。
reactiveSkills.read_the_charge = reaction("read_the_charge", REACTIVE_SKILL_NAMES.read_the_charge, {
  listenTo: "preparation_started",
  timing: "after",
  priority: 128,
  predicates: [EVENT_TARGET_IS_ENEMY],
  costs: spendRp(),
  effects: [{ type: "add_status", target: HIT_ENEMY_TARGET, statusId: "exposed", stacks: 1 }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "tempo", "mark"]);

// **敵の溜めを叩き落とす。**戦闘に一度きり。大技一発の相手に対する答えで、
// 数を出してくる相手には効かない。
reactiveSkills.break_the_charge = reaction("break_the_charge", REACTIVE_SKILL_NAMES.break_the_charge, {
  listenTo: "preparation_advanced",
  timing: "after",
  priority: 128,
  predicates: [EVENT_TARGET_IS_ENEMY],
  costs: spendRp(),
  effects: [{ type: "interrupt_preparation", target: HIT_ENEMY_TARGET }],
  limit: { scope: "battle", count: 1 },
}, ["reaction", "tempo"]);

// 宣言に割り込んで、その一撃を鈍らせる。**潰さないぶん、何度でも使える。**
reactiveSkills.counter_order = reaction("counter_order", REACTIVE_SKILL_NAMES.counter_order, {
  listenTo: "action_declared",
  timing: "interrupt",
  priority: 30,
  predicates: [EVENT_SOURCE_IS_ENEMY],
  costs: spendRp(),
  effects: [{
    type: "add_status",
    target: { scope: "event_source", filters: [{ type: "alive" }], take: 1 },
    statusId: "staggered",
    stacks: 1,
  }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "tempo", "debuff"]);

// **敵の攻撃宣言そのものを消す。**反応権2と、戦闘に一度きりが代償。
// 号令や急かしと違い、これは「順番を作る」のではなく「順番を奪う」。
reactiveSkills.stall_the_blow = reaction("stall_the_blow", REACTIVE_SKILL_NAMES.stall_the_blow, {
  listenTo: "action_declared",
  timing: "interrupt",
  priority: 25,
  predicates: [EVENT_SOURCE_IS_ENEMY, { type: "event_tag", tag: "attack", value: true }],
  costs: spendRp(2),
  effects: [{ type: "cancel_pending_action" }],
  limit: { scope: "battle", count: 1 },
}, ["reaction", "tempo"]);

// ---- 連撃と刻印（pack_barrage）----

// **隙が消える瞬間**に一撃。刻印砕きが刈り取ったあとにも、
// ラウンド終わりに自然消滅したときにも起きる。
reactiveSkills.echo_of_the_mark = reaction("echo_of_the_mark", REACTIVE_SKILL_NAMES.echo_of_the_mark, {
  listenTo: "status_removed",
  timing: "after",
  priority: 108,
  predicates: [statusIs("exposed"), EVENT_TARGET_IS_ENEMY],
  costs: spendRp(),
  effects: [{
    type: "deal_damage", target: HIT_ENEMY_TARGET, amount: mightDamage(5_000),
    reach: "unrestricted", tags: ["attack", "mark"],
  }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "attack", "mark"]);

// ---- 余波と受け渡し（pack_relay）----

// 怯みが付いた拍で、最前の敵にも怯みを移す。**一体を鈍らせる手が、面へ広がる。**
reactiveSkills.stagger_relay = reaction("stagger_relay", REACTIVE_SKILL_NAMES.stagger_relay, {
  listenTo: "status_added",
  timing: "after",
  priority: 106,
  predicates: [statusIs("staggered"), EVENT_TARGET_IS_ENEMY],
  costs: spendRp(),
  effects: [{ type: "add_status", target: FRONTMOST_ENEMY, statusId: "staggered", stacks: 1 }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "relay", "debuff"]);

// 守勢を受け取った拍を、攻めの集中へ変える。**守られた者が刃になる。**
reactiveSkills.warded_into_edge = reaction("warded_into_edge", REACTIVE_SKILL_NAMES.warded_into_edge, {
  listenTo: "status_added",
  timing: "after",
  priority: 106,
  predicates: [statusIs("warded"), SELF_IS_EVENT_TARGET],
  costs: spendRp(),
  effects: [{ type: "add_status", target: SELF_TARGET, statusId: "focused", stacks: 1 }],
  limit: { scope: "round", count: 1 },
}, ["reaction", "relay", "buff"]);

// 裂傷が入った相手へ隙も重ねる。**細い傷を、束ねて太くする。**
reactiveSkills.bleed_into_wake = reaction("bleed_into_wake", REACTIVE_SKILL_NAMES.bleed_into_wake, {
  listenTo: "status_added",
  timing: "after",
  priority: 106,
  predicates: [statusIs("bleeding"), EVENT_TARGET_IS_ENEMY],
  costs: spendRp(),
  effects: [{ type: "add_status", target: HIT_ENEMY_TARGET, statusId: "exposed", stacks: 1 }],
  limit: { scope: "chain", count: 1 },
}, ["reaction", "relay", "mark"]);

export const REACTIVE_SKILLS = reactiveSkills;
