// ecology/content/affixes.mjs
//
// **Phase C の affix 目録。装備を手続きで組み立てるための語彙。**
//
// affix は装備そのものではない。**一つの完結 rule を組み立てるための部品**で、
// R8 §3.5 が決めた文法
//
//   unconditional stat 1 + trigger -> condition 0〜1 -> cost 0〜1 -> effect 1〜3 -> limit -> durability / charge
//
// のどの位置に入るかを `role` が宣言する。role は R8 §13.2 の四種と、
// legendary 以上が持つ keystone を足した六種である。
//
//   source     … trigger。どの event を読むか。
//   converter  … condition。読んだ event をどの状況へ絞るか。
//   payoff     … effect。何が起きるか。
//   stabilizer … cost / durability / limit。代償と発火回数。
//   keystone   … 品全体の形を一段変える。legendary 以上、最大1つ。
//
// **ここは目録だけを持ち、組み立ては ecology/equipment-gen.mjs が行う。**
// 目録と組み立てを分けたのは、affix family を content wave として増やすとき、
// generator 契約（決定性・power budget・dead rule 検査）を触らずに済ませるため
// （R8 §19.4 責務分離）。
//
// **公開した affix id は引退させても再利用しない。** Blueprint は descriptor の
// 中に affix id を持つので、同じ id が別の意味になると過去の記録が嘘になる
// （R8 §3.6「Blueprintはimmutable」）。引退は RETIRED_AFFIX_IDS へ書く。

export const AFFIX_ROLES = Object.freeze(["source", "converter", "payoff", "stabilizer", "keystone"]);

// R8 §3.5 — rarity ごとの完結rule数、総affix目安、total power budget。
// **複数ruleでもitem全体のpower budgetは一つとし、rule数倍しない。**
// 装備全体の等級。個々の rule も同じ語彙で effectRarity を持つが、
// 装備等級は「効果数・最低品質・組み合わせ予算」の保証として使う。
// 旧4等級の ID は残し、新たに mythic / oopart を追加して Blueprint の既存記録を読めるようにする。
export const RARITIES = Object.freeze(["common", "rare", "epic", "legendary", "mythic", "oopart"]);
export const RARITY_BUDGET = Object.freeze({
  common: Object.freeze({ rules: [1, 1], affixes: [1, 4], power: 5, keystones: 0 }),
  rare: Object.freeze({ rules: [1, 2], affixes: [2, 6], power: 8, keystones: 0 }),
  epic: Object.freeze({ rules: [1, 3], affixes: [3, 8], power: 12, keystones: 0 }),
  legendary: Object.freeze({ rules: [2, 4], affixes: [4, 10], power: 18, keystones: 1 }),
  mythic: Object.freeze({ rules: [2, 5], affixes: [5, 13], power: 26, keystones: 1 }),
  oopart: Object.freeze({ rules: [3, 6], affixes: [6, 16], power: 36, keystones: 1 }),
});

// すべての生成装備が一つ持つ、条件・回数・耐久に依存しない基礎効果。
// `amounts` は item rarity と一対一で、低い品でも基礎訓練一つ前後、
// オーパーツなら人物の役割を変えうる幅にする。
// 「数値は増えたが強くならない」罠を避けて候補に入れない。
export const EQUIPMENT_IMPLICITS = Object.freeze([
  Object.freeze({
    id: "implicit_vitality", stat: "max_hp", displayName: "生命",
    summary: "最大HP", payoffTags: ["defense", "care"],
    amounts: Object.freeze({ common: 40, rare: 55, epic: 75, legendary: 100, mythic: 140, oopart: 200 }),
  }),
  Object.freeze({
    id: "implicit_might", stat: "might", displayName: "腕力",
    summary: "腕力", payoffTags: ["damage"],
    amounts: Object.freeze({ common: 5, rare: 7, epic: 10, legendary: 14, mythic: 20, oopart: 30 }),
  }),
  Object.freeze({
    id: "implicit_focus", stat: "focus", displayName: "技術",
    summary: "技術", payoffTags: ["damage", "care", "setup", "tempo", "handoff"],
    amounts: Object.freeze({ common: 5, rare: 7, epic: 10, legendary: 14, mythic: 20, oopart: 30 }),
  }),
  Object.freeze({
    id: "implicit_guard", stat: "guard", displayName: "受け",
    summary: "受け", payoffTags: ["defense", "handoff"],
    amounts: Object.freeze({ common: 2, rare: 3, epic: 4, legendary: 6, mythic: 9, oopart: 14 }),
  }),
]);

// 引退した affix id。**別内容への再利用は禁止。**
export const RETIRED_AFFIX_IDS = Object.freeze({
  src_spill: Object.freeze({
    since: "ecology-equipment-gen-6",
    reason: "回復の溢れを発火条件にする装備効果を廃止したため",
  }),
});

// ---------------------------------------------------------------- target query の語彙
//
// **敵味方の区別は scope で行い、filter では行わない。** v1 の filter に側の
// 概念が無いので、`event_source` scope で「殴ってきた奴」を取ると、lose_hp
// コストで自分が source になった瞬間に味方へ撃つ品が生まれる。
// `enemies` scope + is_event_source なら、その事故が構造的に起きない。
const SELF = Object.freeze({ scope: "self", take: 1 });
const EVENT_ENEMY_SOURCE = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_source" }], take: 1,
});
const EVENT_ENEMY_TARGET = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }, { type: "is_event_primary_target" }], take: 1,
});
const WEAKEST_ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_asc"], take: 1,
});
const TOUGHEST_ENEMY = Object.freeze({
  scope: "enemies", filters: [{ type: "alive" }], sort: ["hp_desc"], take: 1,
});
// issue #176 — 「最も傷ついた味方」は**傷の割合**で選ぶ（docs/DESIGN.md 8.7.1）。
const WEAKEST_ALLY = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }], sort: ["hp_percent_asc"], take: 1,
});
const FRONT_ALLY = Object.freeze({
  scope: "allies", filters: [{ type: "alive" }, { type: "row_is", row: "front" }], sort: ["hp_percent_asc"], take: 1,
});
const ALL_ALLIES = Object.freeze({ scope: "allies", filters: [{ type: "alive" }], take: "all" });
const anchorSelfIsTarget = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const anchorSelfIsSource = Object.freeze({
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
});
const anchorEnemyIsTarget = Object.freeze({
  type: "target_exists",
  query: { scope: "enemies", filters: [{ type: "is_event_primary_target" }], take: 1 },
});
const NOT_COST_DAMAGE = Object.freeze({ type: "event_tag", tag: "cost", value: false });

// ---------------------------------------------------------------- source（trigger）
//
// **source は power を払わず、affix 数にも数えない。** trigger は「どの出来事を
// 読むか」であって強さではないので、ここへ予算を割くと rarity が
// 「読む出来事の数」を意味してしまう。R8 §3.5 の「総affix目安」は
// converter / payoff / stabilizer / keystone の数として数える。
//
// `provides` は「この trigger を読んだ rule の中で、何が使えるか」を宣言する。
// converter と payoff は `requires` でそれを求める。**片方が欠けた組み合わせは
// generator が組み立てる前に落ちる**ので、発火不能な rule が生成されない
// （R8 §3.5「不完全なtriggerだけ、effectだけ、発火不能...を生成しない」）。
//
// `valueKeys` は、その event が values に必ず持つ鍵。event_value 述語を
// この一覧の外の鍵で書くと、その rule は永久に発火しないので dead 判定になる。
const SOURCES = [
  {
    id: "src_overkill", familyId: "family_edge", role: "source", power: 0,
    displayName: "余波の", summary: "自分の攻撃が過剰ダメージを出したとき",
    listenTo: "excess_damage", anchor: "self_source", predicates: [anchorSelfIsSource],
    // **過剰ダメージの相手はもう倒れている。**`enemy_target_alive` を出さないので、
    // 「その相手へ追撃」系の payoff はこの trigger と組み合わさらない
    // （棘の刃が hp_asc の別の敵を狙っているのと同じ理由）。
    provides: ["self_acts", "has_amount"], supports: ["damage", "tempo", "setup"],
    valueKeys: ["amount", "proposed", "hpBefore"],
  },
  {
    id: "src_onhit", familyId: "family_edge", role: "source", power: 0,
    displayName: "手応えの", summary: "自分の攻撃が敵のHPを削ったとき",
    listenTo: "damage_taken", anchor: "self_source",
    predicates: [anchorSelfIsSource, anchorEnemyIsTarget, NOT_COST_DAMAGE],
    provides: ["self_acts", "has_amount", "enemy_target_alive", "onhit"],
    supports: ["damage", "setup", "tempo"],
    valueKeys: ["amount", "hpBefore", "hpAfter", "proposed"],
  },
  {
    id: "src_execute", familyId: "family_edge", role: "source", power: 0,
    displayName: "仕留めの", summary: "敵が倒れたとき",
    listenTo: "actor_defeated", anchor: "enemy_target", predicates: [anchorEnemyIsTarget],
    provides: ["enemy_down"], supports: ["damage", "tempo", "setup", "handoff"], valueKeys: [],
  },
  {
    id: "src_wounded", familyId: "family_scar", role: "source", power: 0,
    displayName: "傷の", summary: "自分がHPダメージを受けたとき",
    listenTo: "damage_taken", anchor: "self_target", predicates: [anchorSelfIsTarget, NOT_COST_DAMAGE],
    provides: ["self_hurt", "has_amount", "damage_chain", "enemy_source_alive"],
    supports: ["defense", "damage", "care", "setup"],
    valueKeys: ["amount", "hpBefore", "hpAfter", "proposed"],
  },
  {
    id: "src_blocked", familyId: "family_wall", role: "source", power: 0,
    displayName: "受けの", summary: "自分が受け止め（block）で攻撃を止めたとき",
    listenTo: "damage_blocked", anchor: "self_target", predicates: [anchorSelfIsTarget],
    provides: ["self_defends", "enemy_source_alive"], supports: ["defense", "damage", "tempo", "handoff"],
    valueKeys: ["proposed", "blockBefore", "blockAfter"],
  },
  {
    id: "src_shattered", familyId: "family_wall", role: "source", power: 0,
    displayName: "砕けた", summary: "自分の防壁が割れたとき",
    listenTo: "barrier_broken", anchor: "self_target", predicates: [anchorSelfIsTarget],
    provides: ["self_defends"], supports: ["defense", "damage", "tempo", "handoff"], valueKeys: ["barrierTotal"],
  },
  {
    id: "src_leftover", familyId: "family_tempo", role: "source", power: 0,
    displayName: "余りの", summary: "round 終わりに行動権が余っていたとき",
    listenTo: "resource_unused", anchor: "self_target", predicates: [anchorSelfIsTarget],
    provides: ["self_idle", "has_amount"], supports: ["tempo", "setup", "defense"], valueKeys: ["amount", "resource"],
  },
  {
    id: "src_stride", familyId: "family_tempo", role: "source", power: 0,
    displayName: "踏み出しの", summary: "自分が動いたとき",
    listenTo: "actor_moved", anchor: "self_target", predicates: [anchorSelfIsTarget],
    provides: ["self_moves"], supports: ["tempo", "setup", "defense"], valueKeys: [],
  },
  {
    id: "src_drawn", familyId: "family_tempo", role: "source", power: 0,
    displayName: "満ちた", summary: "自分の準備が完了したとき",
    listenTo: "preparation_completed", anchor: "self_source", predicates: [anchorSelfIsSource],
    provides: ["self_acts"], supports: ["damage", "setup", "tempo"], valueKeys: [],
  },
  {
    id: "src_mercy", familyId: "family_care", role: "source", power: 0,
    displayName: "手当ての", summary: "自分が回復を与えたとき",
    listenTo: "healing_applied", anchor: "self_source", predicates: [anchorSelfIsSource],
    provides: ["self_acts", "has_amount"], supports: ["care", "defense", "tempo", "handoff"],
    valueKeys: ["requested", "actual", "hpAfter"],
  },
  {
    id: "src_received", familyId: "family_care", role: "source", power: 0,
    displayName: "癒やしの", summary: "自分が回復を受けたとき",
    listenTo: "healing_applied", anchor: "self_target", predicates: [anchorSelfIsTarget],
    provides: ["self_acts", "has_amount"], supports: ["care", "defense", "tempo", "handoff"],
    valueKeys: ["requested", "actual", "hpAfter"],
  },
  {
    id: "src_mark", familyId: "family_barrage", role: "source", power: 0,
    displayName: "刻みの", summary: "自分が敵へ状態を刻んだとき",
    listenTo: "status_added", anchor: "self_source",
    predicates: [anchorSelfIsSource, anchorEnemyIsTarget],
    provides: ["self_acts", "enemy_target_alive"], supports: ["damage", "setup", "tempo"],
    valueKeys: ["statusId", "stacks"],
  },
  {
    id: "src_follow", familyId: "family_barrage", role: "source", power: 0,
    displayName: "追いの", summary: "自分の行動が解決したとき",
    listenTo: "action_resolved", anchor: "self_source", predicates: [anchorSelfIsSource],
    provides: ["self_acts"], supports: ["damage", "setup", "tempo"], valueKeys: [],
  },
  {
    id: "src_battle_plan", familyId: "family_wall", role: "source", power: 0,
    displayName: "備えの", summary: "戦闘開始時",
    listenTo: "battle_started", anchor: "none", predicates: [],
    provides: ["opening"], supports: ["defense", "care", "setup", "handoff"], valueKeys: [],
  },
  {
    id: "src_round_edge", familyId: "family_edge", role: "source", power: 0,
    displayName: "巡る", summary: "各 round の開始時",
    listenTo: "round_started", anchor: "none", predicates: [],
    provides: ["round_tick"], supports: ["damage", "setup"], valueKeys: ["round"],
  },
  {
    id: "src_incoming", familyId: "family_wall", role: "source", power: 0,
    displayName: "逸らしの", summary: "自分へのダメージが決まる直前",
    listenTo: "damage_proposed", timing: "interrupt", anchor: "self_target", predicates: [anchorSelfIsTarget],
    provides: ["pending_amount", "damage_chain", "enemy_source_alive"], supports: ["defense"],
    valueKeys: ["amount", "hitIndex", "hitCount"],
  },
];

// ---------------------------------------------------------------- converter（condition）
//
// converter は power を消費しない。**選択肢を狭める部品に予算を払わせると、
// 「条件が厳しいほど高rarity」という逆の意味になる**（R8 §3.5 は高rarityを
// 「確定上位互換ではなく、複数文脈または大きな代償」と定義している）。
// 代わりに `magnitudeBonus` を持ち、狭めたぶんだけ payoff の量を一段上げる。
//
// `group` が同じ converter は同じ rule へ二つ入らない。入ると
// 「HP50%以下 かつ 60%以上」のような、永久に成立しない条件が生まれる。
const CONVERTERS = [
  {
    id: "cnv_desperate", familyId: "family_scar", role: "converter", power: 0, group: "hp",
    displayName: "背水の", summary: "自分のHPが50%以下のとき", magnitudeBonus: 1,
    supports: ["damage", "defense", "care"],
    requires: [], predicates: [{ type: "hp_percent", subject: "self", op: "lte", value: 50 }],
  },
  {
    id: "cnv_unhurt", familyId: "family_wall", role: "converter", power: 0, group: "hp",
    displayName: "無傷の", summary: "自分のHPが70%以上のとき", magnitudeBonus: 1,
    supports: ["damage", "setup", "tempo"],
    requires: [], predicates: [{ type: "hp_percent", subject: "self", op: "gte", value: 70 }],
  },
  {
    id: "cnv_vanguard", familyId: "family_wall", role: "converter", power: 0, group: "row",
    displayName: "前列の", summary: "自分が前列にいるとき", magnitudeBonus: 1,
    supports: ["damage", "defense", "handoff"],
    requires: [], predicates: [{ type: "position", subject: "self", op: "eq", row: "front" }],
  },
  {
    id: "cnv_rearguard", familyId: "family_tempo", role: "converter", power: 0, group: "row",
    displayName: "後列の", summary: "自分が後列にいるとき", magnitudeBonus: 1,
    supports: ["care", "tempo", "setup", "handoff"],
    requires: [], predicates: [{ type: "position", subject: "self", op: "eq", row: "rear" }],
  },
  {
    id: "cnv_late", familyId: "family_tempo", role: "converter", power: 0, group: "round",
    displayName: "長期の", summary: "3 round 目以降", magnitudeBonus: 1,
    supports: ["damage", "defense", "care"],
    requires: [], predicates: [{ type: "round_number", op: "gte", value: 3 }],
  },
  {
    id: "cnv_opening", familyId: "family_edge", role: "converter", power: 0, group: "round",
    displayName: "先手の", summary: "2 round 目まで", magnitudeBonus: 1,
    supports: ["damage", "setup", "tempo"],
    requires: [], predicates: [{ type: "round_number", op: "lte", value: 2 }],
  },
  {
    id: "cnv_heavy", familyId: "family_edge", role: "converter", power: 0, group: "amount",
    displayName: "重い", summary: "その量が15以上のとき", magnitudeBonus: 1,
    supports: ["damage", "defense", "care"],
    requires: ["has_amount"], predicates: [{ type: "event_value", key: "amount", op: "gte", value: 15 }],
  },
  {
    id: "cnv_slight", familyId: "family_care", role: "converter", power: 0, group: "amount",
    displayName: "細い", summary: "その量が10以下のとき", magnitudeBonus: 1,
    supports: ["care", "defense", "tempo"],
    requires: ["has_amount"], predicates: [{ type: "event_value", key: "amount", op: "lte", value: 10 }],
  },
  {
    id: "cnv_focused", familyId: "family_barrage", role: "converter", power: 0, group: "status",
    displayName: "集中の", summary: "自分に集中が付いているとき", magnitudeBonus: 1,
    supports: ["damage", "setup"],
    requires: [], predicates: [{ type: "has_status", subject: "self", statusId: "focused", op: "gte", value: 1 }],
  },
  {
    id: "cnv_relentless", familyId: "family_barrage", role: "converter", power: 0, group: "history",
    displayName: "重ねの", summary: "この round に自分が2回以上行動したあと", magnitudeBonus: 1,
    supports: ["damage", "tempo", "setup"],
    requires: [],
    predicates: [{
      type: "history_count", subject: "self", metric: "active_actions",
      window: "round", op: "gte", value: 2,
    }],
  },
  {
    id: "cnv_reserved", familyId: "family_tempo", role: "converter", power: 0, group: "resource",
    displayName: "溜めの", summary: "反応点が1以上残っているとき", magnitudeBonus: 1,
    supports: ["defense", "tempo", "handoff"],
    requires: [], predicates: [{ type: "resource", subject: "self", resource: "reaction_points", op: "gte", value: 1 }],
  },
];

// ---------------------------------------------------------------- payoff（effect）
//
// `magnitudes` は tier 0〜2 の量。tier は generator が power で買い、converter の
// magnitudeBonus で一段上がる。連続量は固定装備と同じ「10倍済み」の目盛りで書く
// （棘の刃の追撃が10）。離散量（行動権・受け止め・耐久・段数）は倍率を掛けない
// ——base.mjs の scaleFlatAmounts と同じ切り分け。
const PAYOFFS = [
  {
    id: "pay_echo_strike", familyId: "family_edge", role: "payoff", power: 2,
    displayName: "追撃", summary: "その相手へ追加ダメージ",
    emits: ["damage_proposed", "damage_taken", "excess_damage", "barrier_damaged", "barrier_broken", "damage_blocked", "block_spent", "actor_defeated"],
    requires: ["enemy_target_alive"], magnitudes: [20, 35, 55],
    effect: (amount) => ({
      type: "deal_damage", target: EVENT_ENEMY_TARGET,
      amount: { type: "constant", value: amount }, tags: ["affix"],
    }),
    payoffTags: ["damage"],
  },
  {
    id: "pay_riposte", familyId: "family_scar", role: "payoff", power: 2,
    displayName: "反撃", summary: "仕掛けてきた敵へダメージ",
    emits: ["damage_proposed", "damage_taken", "excess_damage", "barrier_damaged", "barrier_broken", "damage_blocked", "block_spent", "actor_defeated"],
    requires: ["enemy_source_alive"], magnitudes: [20, 35, 55],
    effect: (amount) => ({
      type: "deal_damage", target: EVENT_ENEMY_SOURCE,
      amount: { type: "constant", value: amount }, tags: ["affix"],
    }),
    payoffTags: ["damage"],
  },
  {
    id: "pay_cull", familyId: "family_edge", role: "payoff", power: 2,
    displayName: "掃除", summary: "最も弱った敵へダメージ",
    emits: ["damage_proposed", "damage_taken", "excess_damage", "barrier_damaged", "barrier_broken", "damage_blocked", "block_spent", "actor_defeated"],
    requires: [], magnitudes: [16, 28, 45],
    effect: (amount) => ({
      type: "deal_damage", target: WEAKEST_ENEMY,
      amount: { type: "constant", value: amount }, tags: ["affix"],
    }),
    payoffTags: ["damage"],
  },
  {
    id: "pay_breach", familyId: "family_barrage", role: "payoff", power: 2,
    displayName: "こじ開け", summary: "最も硬い敵へダメージ",
    emits: ["damage_proposed", "damage_taken", "excess_damage", "barrier_damaged", "barrier_broken", "damage_blocked", "block_spent", "actor_defeated"],
    requires: [], magnitudes: [16, 28, 45],
    effect: (amount) => ({
      type: "deal_damage", target: TOUGHEST_ENEMY,
      amount: { type: "constant", value: amount }, tags: ["affix"],
    }),
    payoffTags: ["damage"],
  },
  {
    id: "pay_sweep", familyId: "family_edge", role: "payoff", power: 3,
    displayName: "薙ぎ", summary: "最も弱った敵と同じ列へダメージ",
    emits: ["damage_proposed", "damage_taken", "excess_damage", "barrier_damaged", "barrier_broken", "damage_blocked", "block_spent", "actor_defeated"],
    requires: [], magnitudes: [10, 18, 30],
    effect: (amount) => ({
      type: "deal_damage", target: WEAKEST_ENEMY, targetPattern: "row",
      amount: { type: "constant", value: amount }, tags: ["affix", "area"],
    }),
    payoffTags: ["damage"],
  },
  {
    id: "pay_flurry", familyId: "family_barrage", role: "payoff", power: 3,
    displayName: "連ね撃ち", summary: "その相手へ2回ダメージ",
    emits: ["damage_proposed", "damage_taken", "excess_damage", "barrier_damaged", "barrier_broken", "damage_blocked", "block_spent", "actor_defeated"],
    requires: ["enemy_target_alive"], magnitudes: [10, 18, 28],
    effect: (amount) => ({
      type: "deal_damage", target: EVENT_ENEMY_TARGET, hitCount: 2,
      amount: { type: "constant", value: amount }, tags: ["affix", "multi_hit"],
    }),
    payoffTags: ["damage"],
  },
  {
    id: "pay_puncture", familyId: "family_edge", role: "payoff", power: 3,
    displayName: "貫き", summary: "その相手の受けを75%無視してダメージ",
    emits: ["damage_proposed", "damage_taken", "excess_damage", "barrier_damaged", "barrier_broken", "damage_blocked", "block_spent", "actor_defeated"],
    requires: ["enemy_target_alive"], magnitudes: [18, 32, 50],
    effect: (amount) => ({
      type: "deal_damage", target: EVENT_ENEMY_TARGET, guardPierceBps: 7_500,
      amount: { type: "constant", value: amount }, tags: ["affix", "piercing"],
    }),
    payoffTags: ["damage"],
  },
  {
    id: "pay_bleed", familyId: "family_scar", role: "payoff", power: 2,
    displayName: "裂傷", summary: "その相手へ裂傷",
    emits: ["status_added"], requires: ["enemy_target_alive"], magnitudes: [1, 2, 3], discrete: true,
    effect: (amount) => ({ type: "add_status", target: EVENT_ENEMY_TARGET, statusId: "bleeding", stacks: amount }),
    payoffTags: ["damage", "setup"],
  },
  {
    id: "pay_ward", familyId: "family_wall", role: "payoff", power: 2,
    displayName: "防壁", summary: "自分へ防壁",
    emits: ["barrier_proposed", "barrier_gained"],
    requires: [], magnitudes: [20, 35, 55],
    effect: (amount) => ({
      type: "gain_barrier", target: SELF,
      amount: { type: "constant", value: amount }, duration: "round",
    }),
    payoffTags: ["defense"],
  },
  {
    id: "pay_shelter", familyId: "family_wall", role: "payoff", power: 2,
    displayName: "庇い", summary: "最も傷ついた味方へ防壁",
    emits: ["barrier_proposed", "barrier_gained"],
    requires: [], magnitudes: [16, 28, 45],
    effect: (amount) => ({
      type: "gain_barrier", target: WEAKEST_ALLY,
      amount: { type: "constant", value: amount }, duration: "round",
    }),
    payoffTags: ["defense", "handoff"],
  },
  {
    id: "pay_brace", familyId: "family_wall", role: "payoff", power: 3,
    displayName: "受け止め", summary: "前列の味方へ受け止め",
    emits: ["block_proposed", "block_gained"],
    requires: [], magnitudes: [1, 2, 3], discrete: true,
    effect: (amount) => ({
      type: "gain_block", target: FRONT_ALLY, amount: { type: "constant", value: amount },
    }),
    payoffTags: ["defense", "handoff"],
  },
  {
    id: "pay_team_ward", familyId: "family_wall", role: "payoff", power: 3,
    displayName: "総守り", summary: "生存している味方全員へ防壁",
    emits: ["barrier_proposed", "barrier_gained"], requires: [], magnitudes: [8, 14, 24],
    effect: (amount) => ({
      type: "gain_barrier", target: ALL_ALLIES,
      amount: { type: "constant", value: amount }, duration: "round",
    }),
    payoffTags: ["defense", "handoff"],
  },
  {
    id: "pay_reassure", familyId: "family_care", role: "payoff", power: 3,
    displayName: "励まし", summary: "最も傷ついた味方へ防壁",
    emits: ["barrier_proposed", "barrier_gained"], requires: [], magnitudes: [14, 24, 40],
    effect: (amount) => ({
      type: "gain_barrier", target: WEAKEST_ALLY,
      amount: { type: "constant", value: amount }, duration: "round",
    }),
    payoffTags: ["care", "defense", "handoff"],
  },
  {
    id: "pay_hold", familyId: "family_wall", role: "payoff", power: 3,
    displayName: "踏ん張り", summary: "自分へ受け止め",
    emits: ["block_proposed", "block_gained"], requires: [], magnitudes: [1, 2, 3], discrete: true,
    effect: (amount) => ({ type: "gain_block", target: SELF, amount: { type: "constant", value: amount } }),
    payoffTags: ["defense"],
  },
  {
    id: "pay_bolster", familyId: "family_wall", role: "payoff", power: 2,
    displayName: "守勢", summary: "最も傷ついた味方へ守勢",
    emits: ["status_added"], requires: [], magnitudes: [1, 1, 2], discrete: true,
    effect: (amount) => ({ type: "add_status", target: WEAKEST_ALLY, statusId: "warded", stacks: amount }),
    payoffTags: ["defense", "handoff", "setup"],
  },
  {
    id: "pay_deflect", familyId: "family_wall", role: "payoff", power: 3,
    displayName: "逸らし", summary: "決まる直前のダメージを減らす",
    emits: ["pending_amount_modified"], requires: ["pending_amount"], magnitudes: [15, 28, 45],
    effect: (amount) => ({
      type: "modify_pending_amount", operation: "decrease",
      amount: { type: "constant", value: amount },
    }),
    payoffTags: ["defense"],
  },
  {
    id: "pay_relay_ap", familyId: "family_tempo", role: "payoff", power: 3,
    displayName: "行動権", summary: "自分へ行動点",
    emits: ["resource_gained"],
    requires: [], magnitudes: [1, 1, 2], discrete: true, needsFiniteCost: true,
    effect: (amount) => ({
      type: "gain_resource", target: SELF, resource: "action_points",
      amount: { type: "constant", value: amount },
    }),
    payoffTags: ["tempo"],
  },
  {
    id: "pay_relay_rp", familyId: "family_tempo", role: "payoff", power: 2,
    displayName: "反応権", summary: "自分へ反応点",
    emits: ["resource_gained"],
    requires: [], magnitudes: [1, 1, 2], discrete: true, needsFiniteCost: true,
    effect: (amount) => ({
      type: "gain_resource", target: SELF, resource: "reaction_points",
      amount: { type: "constant", value: amount },
    }),
    payoffTags: ["tempo"],
  },
  {
    id: "pay_command", familyId: "family_tempo", role: "payoff", power: 3,
    displayName: "号令", summary: "前列の味方へ行動点",
    emits: ["resource_gained"], requires: [], magnitudes: [1, 1, 2], discrete: true, needsFiniteCost: true,
    effect: (amount) => ({
      type: "gain_resource", target: FRONT_ALLY, resource: "action_points",
      amount: { type: "constant", value: amount },
    }),
    payoffTags: ["tempo", "handoff"],
  },
  {
    id: "pay_sharpen", familyId: "family_barrage", role: "payoff", power: 2,
    displayName: "集中", summary: "自分へ集中",
    emits: ["status_added"],
    requires: [], magnitudes: [1, 1, 1], discrete: true,
    effect: (amount) => ({ type: "add_status", target: SELF, statusId: "focused", stacks: amount }),
    payoffTags: ["setup"],
  },
  {
    id: "pay_expose", familyId: "family_barrage", role: "payoff", power: 2,
    displayName: "隙", summary: "その敵へ隙",
    emits: ["status_added"],
    requires: ["enemy_target_alive"], magnitudes: [1, 1, 2], discrete: true,
    effect: (amount) => ({ type: "add_status", target: EVENT_ENEMY_TARGET, statusId: "exposed", stacks: amount }),
    payoffTags: ["setup", "handoff"],
  },
  {
    id: "pay_chorus", familyId: "family_barrage", role: "payoff", power: 3,
    displayName: "共鳴", summary: "生存している味方全員へ集中",
    emits: ["status_added"], requires: [], magnitudes: [1, 1, 1], discrete: true,
    effect: (amount) => ({ type: "add_status", target: ALL_ALLIES, statusId: "focused", stacks: amount }),
    payoffTags: ["setup", "handoff"],
  },
  {
    id: "pay_first_aid", familyId: "family_care", role: "payoff", power: 3,
    displayName: "応急処置", summary: "受けた傷のぶんだけ自分を戻す",
    // R8 §9.1 / analysis/ecology-anti-stall-audit.mjs — heal は
    // **被弾 chain の中でだけ**、有限コストを払って動く。generator の
    // dead / loop 検査が、この二条件を満たさない heal rule を落とす。
    emits: ["healing_proposed", "healing_applied", "excess_healing"],
    requires: ["damage_chain"], magnitudes: [3, 5, 12], needsFiniteCost: true, chainOnly: true,
    effect: (amount) => ({
      type: "heal", target: SELF, amount: { type: "constant", value: amount }, tags: ["affix"],
    }),
    payoffTags: ["care"],
  },
  {
    id: "pay_triage", familyId: "family_care", role: "payoff", power: 3,
    displayName: "応援処置", summary: "最も傷ついた味方を回復",
    emits: ["healing_proposed", "healing_applied", "excess_healing"],
    requires: ["damage_chain"], magnitudes: [3, 5, 12], needsFiniteCost: true, chainOnly: true,
    effect: (amount) => ({
      type: "heal", target: WEAKEST_ALLY, amount: { type: "constant", value: amount }, tags: ["affix"],
    }),
    payoffTags: ["care", "handoff"],
  },
  {
    id: "pay_patch", familyId: "family_care", role: "payoff", power: 2,
    displayName: "繕い", summary: "装備の耐久を戻す",
    emits: ["equipment_repaired"],
    requires: [], magnitudes: [1, 1, 2], discrete: true, needsAnyCost: true, forbidsCostTypes: ["wear_equipment"],
    effect: (amount) => ({ type: "repair_equipment", amount: { type: "constant", value: amount } }),
    payoffTags: ["care"],
  },
];

// ---------------------------------------------------------------- stabilizer（cost / 耐久 / limit）
const COST_AFFIXES = [
  {
    id: "cst_wear", familyId: "family_wall", role: "stabilizer", power: -1,
    displayName: "摩耗", summary: "耐久1", finite: true,
    emits: ["equipment_worn", "equipment_broken"],
    cost: { type: "wear_equipment", amount: 1 },
  },
  {
    id: "cst_blood", familyId: "family_scar", role: "stabilizer", power: -1,
    displayName: "血の", summary: "HP3", finite: true,
    emits: ["damage_taken"],
    cost: { type: "lose_hp", amount: 3 },
  },
  {
    id: "cst_shield_toll", familyId: "family_wall", role: "stabilizer", power: -1,
    displayName: "削りの", summary: "防壁3", finite: true,
    emits: ["barrier_damaged", "barrier_broken"],
    cost: { type: "consume_barrier", amount: 3 },
  },
  {
    id: "cst_reaction", familyId: "family_tempo", role: "stabilizer", power: -1,
    displayName: "拍子の", summary: "反応点1", finite: false,
    emits: ["resource_spent"],
    cost: { type: "spend_reaction_points", amount: 1 },
  },
  {
    id: "cst_stitch", familyId: "family_care", role: "stabilizer", power: -1,
    displayName: "使い切りの", summary: "耐久1", finite: true,
    emits: ["equipment_worn", "equipment_broken"],
    cost: { type: "wear_equipment", amount: 1 },
  },
  {
    id: "cst_fracture", familyId: "family_edge", role: "stabilizer", power: -3,
    displayName: "罅割れた", summary: "耐久2", finite: true, risky: true,
    riskSummary: "発火するたび耐久2。短命な代わりに格上の効果を持つ",
    emits: ["equipment_worn", "equipment_broken"],
    cost: { type: "wear_equipment", amount: 2 },
  },
  {
    id: "cst_blood_oath", familyId: "family_scar", role: "stabilizer", power: -3,
    displayName: "血誓の", summary: "HP15", finite: true, risky: true,
    riskSummary: "発火するたびHP15。危険な代わりに格上の効果を持つ",
    emits: ["damage_taken"],
    cost: { type: "lose_hp", amount: 15 },
  },
];

const SHAPE_AFFIXES = [
  {
    id: "stb_tough", familyId: "family_wall", role: "stabilizer", power: 1,
    displayName: "頑丈", summary: "耐久 +1", durabilityBonus: 1,
  },
  {
    id: "stb_reinforced", familyId: "family_wall", role: "stabilizer", power: 2,
    displayName: "重ね継ぎ", summary: "耐久 +3", durabilityBonus: 3,
  },
  {
    id: "stb_repeat", familyId: "family_barrage", role: "stabilizer", power: 2,
    displayName: "連ね", summary: "この rule の発火回数 +1", limitBonus: 1,
  },
  {
    id: "stb_padded_kit", familyId: "family_care", role: "stabilizer", power: 2,
    displayName: "詰め直し", summary: "耐久 +2", durabilityBonus: 2,
  },
];

const KEYSTONES = [
  {
    id: "key_relentless", familyId: "family_barrage", role: "keystone", power: 3,
    displayName: "絶え間なき", summary: "すべての追加効果の発火回数 +2", limitBonusAll: 2,
  },
  {
    id: "key_tempered", familyId: "family_wall", role: "keystone", power: 3,
    displayName: "鍛え上げた", summary: "基礎効果を60%強化し、耐久 +4",
    durabilityBonus: 4, implicitBonusBps: 16_000,
  },
  {
    id: "key_attuned", familyId: "family_tempo", role: "keystone", power: 3,
    displayName: "呼応する", summary: "各 rule の解決後、自分へ集中が1つ乗る",
    extraEffect: () => ({ type: "add_status", target: SELF, statusId: "focused", stacks: 1 }),
  },
  {
    id: "key_twin_edge", familyId: "family_edge", role: "keystone", power: 3,
    displayName: "双つ刃の", summary: "装備が与えるすべてのダメージが1 hit増える",
    requiresEffectTypes: ["deal_damage"],
    transformEffect: (effect) => effect.type === "deal_damage"
      ? { ...effect, hitCount: (effect.hitCount ?? 1) + 1 }
      : effect,
  },
  {
    id: "key_sanctuary", familyId: "family_wall", role: "keystone", power: 3,
    displayName: "不落の", summary: "装備が張る防壁がround終了で消えず、戦闘中残る",
    requiresEffectTypes: ["gain_barrier"],
    transformEffect: (effect) => effect.type === "gain_barrier"
      ? { ...effect, duration: "battle" }
      : effect,
  },
  {
    id: "key_overflowing", familyId: "family_care", role: "keystone", power: 3,
    displayName: "溢れ続ける", summary: "装備による回復が生存している味方全員へ届く",
    requiresEffectTypes: ["heal"],
    transformEffect: (effect) => effect.type === "heal"
      ? { ...effect, target: ALL_ALLIES }
      : effect,
  },
];

export const AFFIXES = Object.freeze([
  ...SOURCES, ...CONVERTERS, ...PAYOFFS, ...COST_AFFIXES, ...SHAPE_AFFIXES, ...KEYSTONES,
].map((affix) => Object.freeze(affix)));

export const AFFIX_BY_ID = Object.freeze(Object.fromEntries(AFFIXES.map((affix) => [affix.id, affix])));

export const AFFIXES_BY_ROLE = Object.freeze(Object.fromEntries(
  AFFIX_ROLES.map((role) => [role, Object.freeze(AFFIXES.filter((affix) => affix.role === role))]),
));

// stabilizer は「代償」と「形」で使い所が違うので、generator 用に分けて出す。
export const COST_AFFIX_IDS = Object.freeze(COST_AFFIXES.map((affix) => affix.id));
export const SHAPE_AFFIX_IDS = Object.freeze(SHAPE_AFFIXES.map((affix) => affix.id));

// R8 §13.2 — affix family。manifest が出現比率を固定する単位。
export const AFFIX_FAMILIES = Object.freeze([
  Object.freeze({ id: "family_edge", displayName: "刃の刻印", packId: "pack_edge" }),
  Object.freeze({ id: "family_wall", displayName: "壁の刻印", packId: "pack_wall" }),
  Object.freeze({ id: "family_tempo", displayName: "拍の刻印", packId: "pack_tempo" }),
  Object.freeze({ id: "family_care", displayName: "手当ての刻印", packId: "pack_care" }),
  // 傷の刻印はどの pack の所有物でもない。被弾という**全 role が共有する event**を
  // 読むので、packId は持たない（R8 §13.2「新eventを読む品と、過去eventを読む品を
  // 両方持つ」の後者側）。
  Object.freeze({ id: "family_scar", displayName: "傷の刻印", packId: null }),
  Object.freeze({ id: "family_barrage", displayName: "連ねの刻印", packId: "pack_barrage" }),
]);
export const AFFIX_FAMILY_IDS = Object.freeze(AFFIX_FAMILIES.map((family) => family.id));
export const AFFIX_FAMILY_BY_ID = Object.freeze(
  Object.fromEntries(AFFIX_FAMILIES.map((family) => [family.id, family])),
);

// 表示名の素材。**seed から決まる**ので、同じ品はいつどこで出ても同じ名前になる。
export const ITEM_NOUNS = Object.freeze([
  "留め具", "外套", "手甲", "脛当て", "首飾り", "腕輪", "灯", "面頬", "帯", "小盾",
  "指輪", "鞘", "肩当て", "手袋", "鎖", "護符", "杖頭", "鈴",
]);
export const RARITY_LABEL = Object.freeze({
  // 内部 ID は保存互換のため維持し、画面は順序が一目で分かる一般的な呼称に揃える。
  common: "コモン",
  rare: "レア",
  epic: "エピック",
  legendary: "レジェンダリー",
  mythic: "ミシック",
  oopart: "オーパーツ",
});
export const EFFECT_RARITY_LABEL = RARITY_LABEL;
