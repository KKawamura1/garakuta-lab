// ecology/content/packs.mjs
//
// **技能パック。R6 §6.1-6.2 — 一遠征で使える語彙を、遠征ごとに絞る箱。**
// R7 Milestone 4（Phase B）で新設した。
//
// パックは「推奨完成コンボの箱」ではない。同じ event 語彙へ小規則を足す単位で、
// **一遠征で有効になるのは4パック中3つ**なので、毎回どれかの系統が欠ける。
// 欠けた系統を別の系統で埋める判断が、遠征ごとの問いになる。
//
// ここを触ってよいのは 統合 担当だけ（種類をまたぐため）。engine・schema は変更しない。

// R6 §5.2 — baseline。**どの manifest でも行動不能な人物を作らない**ために、
// 最低限の攻撃・防壁はパックに属さず常に使える。
export const BASELINE_ACTIVE_SKILL_IDS = Object.freeze(["strike", "bulwark"]);

// R8 Implementation Phase 1（続き）— mend は anti-stall 安全な reactive へ
// 作り替えたので baseline reactive へ移した（analysis/ecology-anti-stall-audit.mjs、
// R8_IMPLEMENTATION_PHASE0_FREEZE.md §3、作者承認済み）。
export const BASELINE_REACTIVE_SKILL_IDS = Object.freeze(["mend"]);

// R6 §6.8 — 常設 fallback passive は詰み防止なので、パックに属さない。
// manifest がどうであれ、7種すべていつでも取れる。
export const BASELINE_PASSIVE_SKILL_IDS = Object.freeze([
  "foundation_vitality", "foundation_might", "foundation_focus",
  "foundation_guard", "foundation_speed", "foundation_ap", "foundation_rp",
]);

// R8 §6.5 — パックが攻撃の主役を担えるかどうかの宣言。
//   primary_offense … そのパック単体でも敵を倒すまでの主軸になれる
//   offensive_hybrid … 攻撃行動を最低3つ持ち、主役が不在でも爽快感を落とさない
//   support        … 攻撃を他パックへ依存する
export const PACK_COMBAT_ROLES = Object.freeze(["primary_offense", "offensive_hybrid", "support"]);

// R6 §6.2 の4系統。Phase A で増えた6 archetype も、**圧力の軸で**この4つへ割った。
// 刻み斬り（多段＝受けに弱い）と貫き突き（受け貫通）は「刃と撃破」、
// 薙ぎ払い（行）と突き通し（列）は隊列を読む技なので「防壁と隊列」。
//
// `combatRole` は R8 §6.5 の manifest 契約（16.1 のmanifestラダー検査）が読む。
export const SKILL_PACKS = Object.freeze([
  Object.freeze({
    id: "pack_edge",
    displayName: "刃と撃破",
    summary: "単発・多段・貫通で、受けの厚い相手をどう抜くかを問う。",
    combatRole: "primary_offense",
    activeSkillIds: Object.freeze(["heavy_swing", "long_swing", "hunt_the_slow", "rapid_cuts", "pierce_thrust", "guard_crush", "rear_hunt", "finishing_thrust", "crack_mark"]),
    reactiveSkillIds: Object.freeze(["counter_blow", "damage_echo", "scavenge_ap"]),
    tags: Object.freeze(["attack", "execute"]),
  }),
  Object.freeze({
    id: "pack_care",
    displayName: "手当てと余剰",
    summary: "溢れた回復を捨てず、削られながら立て直す。",
    combatRole: "support",
    activeSkillIds: Object.freeze(["idle_shuffle"]),
    reactiveSkillIds: Object.freeze(["overflow_care", "triage_relay", "brace_after_hit", "emergency_treatment", "triage"]),
    tags: Object.freeze(["heal", "overflow"]),
  }),
  Object.freeze({
    id: "pack_wall",
    displayName: "防壁と隊列",
    summary: "誰が前に立つかと、行・列のどちらを薙ぐかを問う。",
    combatRole: "offensive_hybrid",
    activeSkillIds: Object.freeze(["reposition", "row_sweep", "column_thrust", "brace_for_impact"]),
    reactiveSkillIds: Object.freeze(["cover_ally", "guard_step", "barrier_bloom", "block_focus", "barrier_stitch"]),
    passiveSkillIds: Object.freeze(["opening_guard"]),
    tags: Object.freeze(["barrier", "formation"]),
  }),
  Object.freeze({
    id: "pack_tempo",
    displayName: "行動権と準備",
    summary: "順番そのものを作り替える。遅い構成に手番を通す。",
    combatRole: "offensive_hybrid",
    activeSkillIds: Object.freeze(["relay_order", "mark_target", "steady_aim"]),
    reactiveSkillIds: Object.freeze(["urging", "ap_loop", "prep_spiral"]),
    tags: Object.freeze(["tempo", "preparation"]),
  }),
  // R8 §5.4 — Stage 3 の新パック。連撃・刻印を軸にした primary_offense。
  // **最小限の Implementation Phase 1 content。**密度（active 4〜6、
  // 発生源・変換器・利得先）を作り込む Phase 2 probe content はまだ入っていない。
  Object.freeze({
    id: "pack_barrage",
    displayName: "連撃と刻印",
    summary: "多段と刻印で、受けよりblockに強い攻め筋を問う。",
    combatRole: "primary_offense",
    activeSkillIds: Object.freeze([
      "barrage_strike", "mark_strike", "mark_break", "sweeping_barrage", "piercing_barrage",
    ]),
    reactiveSkillIds: Object.freeze(["guarded_opening", "seize_the_opening"]),
    tags: Object.freeze(["attack", "onhit", "mark"]),
  }),
]);

// R6 §5.2 — Free / Endless（random manifest）で一遠征に有効になるパック数。
// **解禁済みパックが増えても、一遠征で見える局所ルール量は増やさない**（R6 §14）。
// Campaign Stage の有効パック数は `activePackCount()`（R8 §4.2）が別に決める。
export const PACKS_PER_MANIFEST = 3;

export const PACK_BY_ID = Object.freeze(
  Object.fromEntries(SKILL_PACKS.map((pack) => [pack.id, pack])),
);

// manifest が有効にしたパックから、実際に使える技能 ID を出す。
// **baseline は必ず入る。**ここが唯一の合成地点で、画面もツリーもここを読む。
export function skillIdsForPacks(packIds) {
  const active = new Set(BASELINE_ACTIVE_SKILL_IDS);
  const reactive = new Set(BASELINE_REACTIVE_SKILL_IDS);
  const passive = new Set(BASELINE_PASSIVE_SKILL_IDS);
  for (const packId of packIds ?? []) {
    const pack = PACK_BY_ID[packId];
    if (!pack) continue;
    for (const id of pack.activeSkillIds) active.add(id);
    for (const id of pack.reactiveSkillIds) reactive.add(id);
    for (const id of pack.passiveSkillIds ?? []) passive.add(id);
  }
  return {
    active: [...active],
    reactive: [...reactive],
    passive: [...passive],
    all: [...active, ...reactive, ...passive],
  };
}

// どのパックにも属していない技能は、**どの遠征でも出ない**。
// 技能を足してパックへ載せ忘れると黙って消えるので、検査がここを見る。
export function packOfSkill(skillId) {
  for (const pack of SKILL_PACKS) {
    if (pack.activeSkillIds.includes(skillId)
      || pack.reactiveSkillIds.includes(skillId)
      || (pack.passiveSkillIds ?? []).includes(skillId)) return pack.id;
  }
  if (BASELINE_ACTIVE_SKILL_IDS.includes(skillId) || BASELINE_REACTIVE_SKILL_IDS.includes(skillId)
    || BASELINE_PASSIVE_SKILL_IDS.includes(skillId)) {
    return "baseline";
  }
  return null;
}
