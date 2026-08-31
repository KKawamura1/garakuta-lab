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
// R9 §3.1 / §4 — **導入 pack は「入口（core）」と「全体（full）」を分ける。**
//
// R9 が言っているのは「技能数を極端に減らす」ことではなく、「同時に理解させる
// 戦闘上の問いを一つに絞る」ことである。だから pack の技能そのものは減らさず、
// **その pack が初登場した Stage では core だけを出し、次の Stage から full を出す。**
// 前に覚えた技能は消えず、新しい人物がそれを別の目的で使う（R9 §3.1）。
//
// core は R9 §4.1 の五分類を満たすように選ぶ:
//   1. 中心語彙を直接使う / 2. 別の結果へ変換する / 3. 過去 pack の event を繋ぐ /
//   4. この pack の event を別の役割へ渡す / 5. 条件不成立でも単独で価値がある
//
// core を宣言しない pack は、いつでも full で出る（Free / Endless と同じ扱い）。
export const SKILL_PACKS = Object.freeze([
  Object.freeze({
    id: "pack_edge",
    displayName: "刃と撃破",
    summary: "単発・多段・貫通で、受けの厚い相手をどう抜くかを問う。",
    combatRole: "primary_offense",
    activeSkillIds: Object.freeze(["heavy_swing", "long_swing", "hunt_the_slow", "rapid_cuts", "pierce_thrust", "guard_crush", "rear_hunt", "finishing_thrust", "crack_mark"]),
    reactiveSkillIds: Object.freeze(["counter_blow", "damage_echo", "scavenge_ap", "whetted_by_pain"]),
    passiveSkillIds: Object.freeze(["first_blood"]),
    // 問い:「同じ一撃でも、誰へ、どんな受けの相手へ当てるかで結果が変わる」。
    coreActiveSkillIds: Object.freeze(["heavy_swing", "pierce_thrust", "finishing_thrust", "rear_hunt"]),
    coreReactiveSkillIds: Object.freeze(["counter_blow", "scavenge_ap", "whetted_by_pain"]),
    corePassiveSkillIds: Object.freeze(["first_blood"]),
    tags: Object.freeze(["attack", "execute"]),
  }),
  Object.freeze({
    id: "pack_care",
    displayName: "手当てと余剰",
    summary: "溢れた回復を捨てず、削られながら立て直す。",
    combatRole: "support",
    activeSkillIds: Object.freeze(["idle_shuffle", "shield_the_wounded"]),
    reactiveSkillIds: Object.freeze(["overflow_care", "triage_relay", "brace_after_hit", "emergency_treatment", "triage"]),
    passiveSkillIds: Object.freeze(["steady_hands"]),
    // 問い:「傷そのものではなく、傷の連鎖をどこで止めるか」。
    coreActiveSkillIds: Object.freeze(["idle_shuffle", "shield_the_wounded"]),
    coreReactiveSkillIds: Object.freeze(["emergency_treatment", "triage", "brace_after_hit", "overflow_care"]),
    corePassiveSkillIds: Object.freeze(["steady_hands"]),
    tags: Object.freeze(["heal", "overflow"]),
  }),
  Object.freeze({
    id: "pack_wall",
    displayName: "防壁と隊列",
    summary: "誰が前に立つかと、行・列のどちらを薙ぐかを問う。",
    combatRole: "offensive_hybrid",
    activeSkillIds: Object.freeze(["reposition", "row_sweep", "column_thrust", "brace_for_impact"]),
    reactiveSkillIds: Object.freeze(["cover_ally", "guard_step", "barrier_bloom", "block_focus", "barrier_stitch", "shield_handoff"]),
    passiveSkillIds: Object.freeze(["opening_guard"]),
    // 問い:「誰を守り、守った結果をどう使うか」（R9 §3 の Stage 1）。
    coreActiveSkillIds: Object.freeze(["reposition", "brace_for_impact", "column_thrust"]),
    coreReactiveSkillIds: Object.freeze(["cover_ally", "guard_step", "block_focus", "shield_handoff"]),
    corePassiveSkillIds: Object.freeze(["opening_guard"]),
    tags: Object.freeze(["barrier", "formation"]),
  }),
  Object.freeze({
    id: "pack_tempo",
    displayName: "行動権と準備",
    summary: "順番そのものを作り替える。遅い構成に手番を通す。",
    combatRole: "offensive_hybrid",
    activeSkillIds: Object.freeze(["relay_order", "mark_target", "steady_aim"]),
    reactiveSkillIds: Object.freeze(["urging", "ap_loop", "prep_spiral", "patient_step"]),
    passiveSkillIds: Object.freeze(["held_breath"]),
    // 問い:「誰がいつ動くと得か」（R9 §3 の Stage 2）。
    coreActiveSkillIds: Object.freeze(["relay_order", "steady_aim", "mark_target"]),
    coreReactiveSkillIds: Object.freeze(["urging", "ap_loop", "patient_step"]),
    corePassiveSkillIds: Object.freeze(["held_breath"]),
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
  // R9 §5 — **5人が揃った後の最初の横断pack の試作（probe）。**
  //
  // 「特定の必須技能ではなく、既存の共有eventを別の人物が受け取り、別の効果へ
  //   変換する」（R9 §5）。6つの発生源——防いだ / 過剰ダメージ / 回復した /
  //   移動した / 準備を完了した / 撃破した——を一つずつ読み、どれも
  //   「その役割の中で完結しない出口」へ渡す。
  //
  // **Campaign Stage 0〜3 には入れていない。**R9 §10 が「このGateを通過する前に
  // ...大量の高次packを追加しない」と書いているので、作者評価までは
  // Free / Endless の random manifest からだけ引ける。Stage 4 の候補である。
  //
  // core を宣言しない = いつでも full。導入 pack ではないので段階を分けない。
  Object.freeze({
    id: "pack_relay",
    displayName: "余波と受け渡し",
    summary: "起きた出来事を、別の役割の資源へ渡す。誰の出来事でも読める。",
    combatRole: "support",
    activeSkillIds: Object.freeze(["hand_off", "overreach"]),
    reactiveSkillIds: Object.freeze([
      "spill_forward", "blocked_into_step", "mercy_into_guard",
      "stride_into_reach", "readied_relay", "wake_of_the_fallen",
    ]),
    passiveSkillIds: Object.freeze(["wake_reader"]),
    tags: Object.freeze(["relay", "handoff", "crosscut"]),
  }),
]);

// R6 §5.2 — Free / Endless（random manifest）で一遠征に有効になるパック数。
// **解禁済みパックが増えても、一遠征で見える局所ルール量は増やさない**（R6 §14）。
// Campaign Stage の有効パック数は `activePackCount()`（R8 §4.2）が別に決める。
export const PACKS_PER_MANIFEST = 3;

export const PACK_BY_ID = Object.freeze(
  Object.fromEntries(SKILL_PACKS.map((pack) => [pack.id, pack])),
);

// R9 §3.1 — pack の見せ方。"core" はその pack が初登場した Stage の入口、
// "full" はそれ以降（と Free / Endless）。core を宣言していない pack は
// どちらを頼まれても full を返す。
export const PACK_DEPTHS = Object.freeze(["core", "full"]);

export function packSkillIds(pack, depth = "full") {
  const useCore = depth === "core" && Array.isArray(pack.coreActiveSkillIds);
  return {
    active: useCore ? pack.coreActiveSkillIds : pack.activeSkillIds,
    reactive: useCore ? pack.coreReactiveSkillIds : pack.reactiveSkillIds,
    passive: useCore ? (pack.corePassiveSkillIds ?? []) : (pack.passiveSkillIds ?? []),
  };
}

// manifest が有効にしたパックから、実際に使える技能 ID を出す。
// **baseline は必ず入る。**ここが唯一の合成地点で、画面もツリーもここを読む。
//
// `depths` は packId → "core" | "full"。渡さなければ全部 full
// （Free / Endless と、Stage を持たない呼び出し）。
export function skillIdsForPacks(packIds, depths = {}) {
  const active = new Set(BASELINE_ACTIVE_SKILL_IDS);
  const reactive = new Set(BASELINE_REACTIVE_SKILL_IDS);
  const passive = new Set(BASELINE_PASSIVE_SKILL_IDS);
  for (const packId of packIds ?? []) {
    const pack = PACK_BY_ID[packId];
    if (!pack) continue;
    const ids = packSkillIds(pack, depths?.[packId] ?? "full");
    for (const id of ids.active) active.add(id);
    for (const id of ids.reactive) reactive.add(id);
    for (const id of ids.passive) passive.add(id);
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
