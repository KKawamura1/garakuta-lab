// ecology/content/skill-tree.mjs
//
// **技能ツリーの節と、技能・装備の表示文。種類をまたぐので統合担当が持つ。**
// R7 Milestone 0 で playable-battles.mjs から分離した。**挙動は変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 統合 担当だけ。engine・schema・共通registryは変更しない。

const activeMeta = {
  // R6 §17.1 — Phase A の攻撃 archetype。**説明に「何に強くて何に弱いか」を書く。**
  rapid_cuts: ["刻み斬り", "3回に分けて刻む。合計は大きいが、受けの硬い相手には通りにくい。", "攻撃"],
  pierce_thrust: ["貫き突き", "威力は控えめだが、相手の受けを6割無視する。硬い相手向け。", "攻撃"],
  row_sweep: ["薙ぎ払い", "狙った相手と同じ行を薙ぐ。前列に3人並ぶ相手ほど効く。", "攻撃"],
  column_thrust: ["突き通し", "狙った相手と同じ列の前後を貫く。後列を庇う列に効く。", "攻撃"],
  guard_crush: ["受け崩し", "威力は控えめだが、相手の受けを完全に無視する。硬い単発防御に強い。", "攻撃"],
  rear_hunt: ["後衛狩り", "後列の生存者だけを狙う。後列がいないときは通常攻撃へ戻る。", "攻撃"],
  finishing_thrust: ["止めの一突き", "HP半分以下の敵だけを狙い、大きく削る。傷のない敵には使えない。", "攻撃"],
  crack_mark: ["傷口を開く", "威力を抑えて攻撃し、狙った敵へ「隙」を付ける。追撃役がいるほど強い。", "攻撃"],
  brace_for_impact: ["衝撃に備える", "受け構えを1つ得てから、通常の追い打ちを行う。多段攻撃には剥がされやすい。", "守り"],
  strike: ["斬撃", "最も弱った敵へ4ダメージ。", "攻撃"],
  mend: ["手当て", "最も傷ついた味方を5回復。", "支援"],
  bulwark: ["防壁形成", "自分にラウンド防壁3。", "守り"],
  relay_order: ["号令", "前衛の最速の味方へ行動権を1渡す。", "指揮"],
  heavy_swing: ["溜め突き", "準備1回のあと、最も傷ついた敵へ9ダメージ。", "攻撃"],
  reposition: ["位置替え", "後衛なら、最も傷ついた前衛と場所を替える。", "機動"],
  long_swing: ["大溜め", "準備3回のあと、最も傷ついた敵へ9ダメージ。", "攻撃"],
  triage: ["応急手当", "HP半分以下の味方を8回復。", "支援"],
  hunt_the_slow: ["準備狩り", "準備中の敵へ5ダメージ。", "攻撃"],
  idle_shuffle: ["息を整える", "自分に集中を1つ付ける。集中中は使わない。", "準備"],
  mark_target: ["隙を刻む", "最もHPの高い敵に「隙」を1つ付ける。", "指揮"],
  steady_aim: ["狙いを澄ます", "自分に「集中」を1つ付ける。", "準備"],
};

const reactiveMeta = {
  counter_blow: ["反撃", "敵に殴られたあと、RP1で攻撃者へ2ダメージ。", "被弾"],
  cover_ally: ["身代わり", "敵が味方を狙った瞬間、RP1で自分へ引き受ける。", "標的"],
  overflow_care: ["余剰治療", "余った回復を別の負傷者へ回す。", "回復"],
  scavenge_ap: ["拾い直し", "敵を倒したとき、行動権を1得る。", "撃破"],
  guard_step: ["踏み固め", "移動したあと、ラウンド防壁2を得る。", "移動"],
  urging: ["急かす", "味方の準備開始時、RP1で準備を1進める。", "準備"],
  brace_after_hit: ["受け流し", "被弾後、RP1でラウンド防壁2を得る。", "被弾"],
  triage_relay: ["連携治療", "応急手当の余剰を別の負傷者へ回す。", "回復"],
  ap_loop: ["行動権の循環", "行動権を得たとき、前衛へもう一度渡す。", "資源"],
  damage_echo: ["痛みの反響", "被弾した敵へ1ダメージを返す。", "被弾"],
  barrier_bloom: ["防壁の花", "防壁を得たとき、さらに防壁1。", "防壁"],
  prep_spiral: ["準備の螺旋", "準備が進むたび、自分の準備をさらに1段進める。", "準備"],
  block_focus: ["受け返しの集中", "受け構えで攻撃を止めたあと、RP1で「集中」を得る。次の一手を強くする。", "防御"],
  barrier_stitch: ["防壁の縫い直し", "防壁が壊れたあと、RP1で受け構えを1つ得る。", "防御"],
};

const equipmentMeta = {
  worn_greaves: ["踏み込みの靴", "ラウンド最初の発動後、行動権を1得る。", "速度", 2],
  splinter_edge: ["棘の刃", "余ったダメージが出ると、耐久1で1ダメージを追加。", "攻撃", 2],
  field_kit: ["野営道具", "余ったRPを使い、耐久1を修理する。", "修理", 2],
  standing_plate: ["継ぎはぎの盾", "戦闘開始時、戦闘中防壁2を得る。", "防御", 3],
  momentum_rig: ["勢いの留め具", "移動後、耐久1で「集中」を得る。", "機動", 2],
  hungry_plate: ["喰らう板", "戦闘開始時に耐久を使い、後続の摩耗を誘発する。", "消耗", 3],
  guard_lantern: ["守り火", "小さな防壁を長く維持する。", "防御", 2],
  bastion_shell: ["厚い継ぎ板", "戦闘開始時、防壁3。", "防御", 3],
  tempo_buckle: ["拍子の留め具", "ラウンド最初の発動後、行動権を得る。耐久1。", "速度", 1],
  quickstrap: ["軽い締め具", "発動後の行動権を狙う。耐久が高い。", "速度", 3],
  reserve_coil: ["予備のばね", "ラウンド最初の発動後、行動権を得る。", "速度", 4],
  focus_band: ["集中の帯", "移動後、「集中」を得る。耐久1。", "機動", 1],
  anchor_boots: ["錨の靴", "移動後、「集中」を得る。耐久が高い。", "機動", 3],
  signal_lens: ["合図のレンズ", "移動後、「集中」を得る。", "機動", 4],
  thorn_clasp: ["返しの留め具", "余ったダメージから追加攻撃。耐久1。", "攻撃", 1],
  shard_hilt: ["破片の柄", "余ったダメージから追加攻撃。", "攻撃", 3],
  repair_pouch: ["修繕袋", "余ったRPで装備を修理する。耐久1。", "修理", 1],
  recovery_satchel: ["大きな救急袋", "余ったRPで装備を2修理する。", "修理", 4],
};

export const ACTIVE_META = activeMeta;
export const REACTIVE_META = reactiveMeta;
export const EQUIPMENT_META = equipmentMeta;

// R6 §6.8 — 常設 fallback passive の表示文。**基礎訓練は系統に属さない。**
// どの人物も、いつでも、前提なしで取れる（詰み防止だから）。
const passiveMeta = {
  foundation_vitality: ["地力", "最大HPが50増える。", "基礎"],
  foundation_might: ["膂力", "腕力が2増える。武器技能の量が上がる。", "基礎"],
  foundation_focus: ["集中力", "術力が2増える。技術・治療・防壁の量が上がる。", "基礎"],
  foundation_guard: ["受け", "受けが1増える。一撃ごとの被害を減らす。", "基礎"],
  foundation_speed: ["速さ", "速度が1増える。行動順が早くなる。", "基礎"],
  foundation_ap: ["出足", "戦闘開始時に一度だけ行動権+1。毎ラウンドではない。", "基礎"],
  foundation_rp: ["備え", "戦闘開始時に一度だけ反応権+1。毎ラウンドではない。", "基礎"],
  opening_guard: ["初手の構え", "戦闘開始時、受け構えを1つ得る。最初の一撃を受け止めるための守り。", "守り"],
};
export const PASSIVE_META = passiveMeta;

export const SKILL_TREE_NODES = Object.freeze([
  { id: "node_strike", skillId: "strike", kind: "active", branch: "攻撃", tier: 0, cost: 0, requires: [] },
  { id: "node_heavy", skillId: "heavy_swing", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_long", skillId: "long_swing", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["heavy_swing"] },
  { id: "node_hunt", skillId: "hunt_the_slow", kind: "active", branch: "攻撃", tier: 2, cost: 2, requires: ["heavy_swing"] },
  { id: "node_relay", skillId: "relay_order", kind: "active", branch: "指揮", tier: 0, cost: 0, requires: [] },
  { id: "node_reposition", skillId: "reposition", kind: "active", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  { id: "node_mark", skillId: "mark_target", kind: "active", branch: "指揮", tier: 2, cost: 1, requires: ["reposition"] },
  { id: "node_aim", skillId: "steady_aim", kind: "active", branch: "指揮", tier: 2, cost: 2, requires: ["mark_target"] },
  { id: "node_mend", skillId: "mend", kind: "active", branch: "支援", tier: 0, cost: 0, requires: [] },
  { id: "node_triage", skillId: "triage", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_idle", skillId: "idle_shuffle", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_bulwark", skillId: "bulwark", kind: "active", branch: "守り", tier: 0, cost: 0, requires: [] },
  { id: "node_counter", skillId: "counter_blow", kind: "reactive", branch: "攻撃", tier: 0, cost: 1, requires: ["strike"] },
  { id: "node_echo", skillId: "damage_echo", kind: "reactive", branch: "攻撃", tier: 1, cost: 2, requires: ["counter_blow"] },
  { id: "node_scavenge", skillId: "scavenge_ap", kind: "reactive", branch: "指揮", tier: 0, cost: 1, requires: ["strike"] },
  { id: "node_step", skillId: "guard_step", kind: "reactive", branch: "指揮", tier: 1, cost: 1, requires: ["scavenge_ap"] },
  { id: "node_cover", skillId: "cover_ally", kind: "reactive", branch: "守り", tier: 0, cost: 1, requires: ["bulwark"] },
  { id: "node_brace", skillId: "brace_after_hit", kind: "reactive", branch: "守り", tier: 1, cost: 1, requires: ["cover_ally"] },
  { id: "node_bloom", skillId: "barrier_bloom", kind: "reactive", branch: "守り", tier: 2, cost: 2, requires: ["brace_after_hit"] },
  { id: "node_overflow", skillId: "overflow_care", kind: "reactive", branch: "支援", tier: 0, cost: 1, requires: ["mend"] },
  { id: "node_triage_relay", skillId: "triage_relay", kind: "reactive", branch: "支援", tier: 1, cost: 1, requires: ["overflow_care"] },
  { id: "node_urging", skillId: "urging", kind: "reactive", branch: "支援", tier: 0, cost: 1, requires: ["mend"] },
  { id: "node_prep_spiral", skillId: "prep_spiral", kind: "reactive", branch: "支援", tier: 1, cost: 2, requires: ["urging"] },
  { id: "node_ap_loop", skillId: "ap_loop", kind: "reactive", branch: "指揮", tier: 1, cost: 2, requires: ["scavenge_ap"] },
  { id: "node_block_focus", skillId: "block_focus", kind: "reactive", branch: "守り", tier: 1, cost: 1, requires: ["brace_after_hit"] },
  { id: "node_barrier_stitch", skillId: "barrier_stitch", kind: "reactive", branch: "守り", tier: 2, cost: 1, requires: ["barrier_bloom"] },
  // R6 §17.1 — Phase A の攻撃 archetype。攻撃系統の T1/T2 へ置く。
  { id: "node_rapid", skillId: "rapid_cuts", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_pierce", skillId: "pierce_thrust", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_row", skillId: "row_sweep", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["rapid_cuts"] },
  { id: "node_column", skillId: "column_thrust", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["pierce_thrust"] },
  { id: "node_guard_crush", skillId: "guard_crush", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_rear_hunt", skillId: "rear_hunt", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["guard_crush"] },
  { id: "node_finishing", skillId: "finishing_thrust", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["strike"] },
  { id: "node_crack_mark", skillId: "crack_mark", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_brace_impact", skillId: "brace_for_impact", kind: "active", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  // R6 §6.8 — 基礎訓練。**前提を持たない**ので、どの人物もいつでも取れる。
  { id: "node_found_vitality", skillId: "foundation_vitality", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_might", skillId: "foundation_might", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_focus", skillId: "foundation_focus", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_guard", skillId: "foundation_guard", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_speed", skillId: "foundation_speed", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_ap", skillId: "foundation_ap", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_rp", skillId: "foundation_rp", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_opening_guard", skillId: "opening_guard", kind: "passive", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
]);
