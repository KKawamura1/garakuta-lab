// ecology/content/skill-tree.mjs
//
// **技能ツリーの節と、技能・装備の表示文。種類をまたぐので、ここに集める。**
// R7 Milestone 0 で playable-battles.mjs から分離した。
// R19（issue #137）で、節の並びを tier の平面から**入れ子の森**へ書き換えた。
//
// engine・schema・共通registryは変更しない。

import { MIN_SKILL_LEVEL } from "../schema.mjs";
import { BASELINE_ACTIVE_SKILL_IDS, BASELINE_REACTIVE_SKILL_IDS } from "./packs.mjs";
import { skillLevelCap } from "./skill-levels.mjs";
import { ACTIVE_SKILLS } from "./skills-active.mjs";
import { REACTIVE_SKILLS } from "./skills-reactive.mjs";
import { PASSIVE_SKILLS } from "./skills-passive.mjs";

const activeMeta = {
  // R6 §17.1 — Phase A の攻撃 archetype。**説明に「何に強くて何に弱いか」を書く。**
  rapid_cuts: ["刻み斬り", "{amount}を{hits}回。合計{total}で通常攻撃を上回るが、受けの硬い相手には通りにくい。", "攻撃"],
  pierce_thrust: ["貫き突き", "通常攻撃を上回る{amount}。相手の受けを6割無視する。硬い相手向け。", "攻撃"],
  row_sweep: ["薙ぎ払い", "前列の敵が2体以上いるとき、同じ行を{amount}ずつ薙ぐ。対象がいなければスキップ。", "攻撃"],
  column_thrust: ["突き通し", "同じ列の前後を{amount}ずつ貫く。後列を庇う列に効く。", "攻撃"],
  guard_crush: ["受け崩し", "通常攻撃を上回る{amount}。相手の受け構えと受けを完全に無視する。", "攻撃"],
  rear_hunt: ["後衛狩り", "後列の生存者がいるときだけ{amount}で狙う。対象がいなければスキップ。", "攻撃"],
  finishing_thrust: ["止めの一突き", "HP半分以下の敵がいるときだけ{amount}で狙う。対象がいなければスキップ。", "攻撃"],
  crack_mark: ["傷口を開く", "未露出の敵へ{amount}で攻撃し、「隙」を付ける。対象がいなければスキップ。", "攻撃"],
  brace_for_impact: ["衝撃に備える", "受け構えを1つ得てから、通常の追い打ちを行う。多段攻撃には剥がされやすい。", "守り"],
  strike: ["斬撃", "最も弱った敵へ、通常攻撃を上回る{amount}の単発。", "攻撃"],
  // R11 §5 — Stage 0 の安定した二本。**違いは威力ではなく、出せる場所。**
  steady_cut: ["確かな斬り", "条件も準備もない、腕力{amount}の一撃。武器なので後列から出すと40%まで落ちる。", "攻撃"],
  aimed_shot: ["狙い撃ち", "最も弱った敵へ技術{amount}。技なので後列から出しても落ちず、前列が生きていても後列へ通る。", "攻撃"],
  bulwark: ["防壁形成", "自分に技術の{amount}のラウンド防壁を張ってから、追い打ちを行う。", "守り"],
  relay_order: ["号令", "前列の先頭の味方へ行動権を1渡す。", "指揮"],
  heavy_swing: ["溜め突き", "準備1回のあと、{amount}の一撃。開始と準備で行動権を計2つ使う。", "攻撃"],
  reposition: ["位置替え", "後衛なら、最も傷ついた前衛と場所を替える。", "機動"],
  long_swing: ["大溜め", "準備3回のあと、{amount}を一撃で返す。開始と準備で行動権を計4つ使う。", "攻撃"],
  hunt_the_slow: ["準備狩り", "準備中の敵がいるときだけ{amount}で狙う。対象がいなければスキップ。", "攻撃"],
  idle_shuffle: ["息を整える", "自分に集中を1つ付ける。集中中はスキップ。", "準備"],
  mark_target: ["隙を刻む", "まだ「隙」のない敵に付与する。対象がいなければスキップ。", "指揮"],
  steady_aim: ["狙いを澄ます", "自分に「集中」を1つ付けてから、追い打ちを行う。集中中はスキップ。", "準備"],
  // R9 §5 — 横断pack「余波と受け渡し」の主行動。
  hand_off: ["引き継ぐ", "最も傷ついた味方へ受け構えを1つ渡してから、追い打ちを行う。", "支援"],
  overreach: ["無理を通す", "自分のHPが60%以上のときだけ、最も弱った敵へ{amount}。条件を欠いても行動は塞がらない。", "攻撃"],
  // R9 §4.1 — pack_care の主行動。HP を戻さず、これ以上の傷を止める側へ置く。
  shield_the_wounded: ["傷へ盾を", "最も傷ついた味方へ技術の{amount}のラウンド防壁を張ってから、追い打ちを行う。", "支援"],
  // R8 Implementation Phase 2 — pack_barrage（連撃と刻印、Stage 3）の密度。
  barrage_strike: ["連撃", "{amount}を{hits}回。合計{total}で、受けの厚い相手より、受け構え（block）を持つ相手に強い。", "攻撃"],
  mark_strike: ["刻印撃ち", "隙のない敵へ{amount}で攻撃し、「隙」を付ける。対象がいなければスキップ。", "攻撃"],
  mark_break: ["刻印砕き", "「隙」を持つ敵へ{amount}で攻撃し、隙を刈り取る。対象がいなければスキップ。", "攻撃"],
  sweeping_barrage: ["連ぎ払い", "前列の敵が2体以上いるとき、同じ行を{amount}×{hits}回薙ぐ。対象がいなければスキップ。", "攻撃"],
  piercing_barrage: ["貫き連撃", "同じ列の前後を{amount}×{hits}回貫く。後列を庇う列を多段で崩す。", "攻撃"],
  // ---------------------------------------------------------------- R16 — 大量追加
  //
  // **説明文には「何に強くて何に弱いか」と「代償」を書く。**係数の数字は
  // analysis/ecology-readout-smoke.mjs が定義側と照合するので、勝手にずれない。
  //
  // 刃と撃破（pack_edge）— 殴る前に何を読むか
  reckless_swing: ["捨て身の一振り", "最前の敵へ腕力{amount}。代償として自分に「隙」が1つ付き、次に受ける一撃が重くなる。", "攻撃"],
  double_back: ["二の太刀", "同じ相手を続けて2回以上狙っていたときだけ腕力{amount}。相手を変えると数え直しになる。", "攻撃"],
  spread_cut: ["散らし斬り", "同じ相手を続けて狙っていないときだけ腕力{amount}。二の太刀とは同時に成立しない。", "攻撃"],
  opening_stab: ["先の一刺し", "1ラウンド目だけ腕力{amount}。2ラウンド目からは通常攻撃へ戻る。", "攻撃"],
  bloodied_charge: ["手負いの突撃", "自分のHPが50%以下のときだけ腕力{amount}。「無理を通す」（60%以上）の裏。", "攻撃"],
  hamstring: ["足を払う", "腕力{amount}と引き換えに「怯み」を1つ付ける。怯んだ相手が出すダメージが1段につき8軽くなる。", "攻撃"],
  execute_low: ["首を落とす", "HP30%以下の敵がいるときだけ腕力{amount}。対象がいなければスキップ。", "攻撃"],
  rend: ["抉る", "腕力{amount}と「裂傷」2つ。裂傷はラウンド終わりに1段12、受けを完全に無視して刻む。", "攻撃"],
  // 防壁と隊列（pack_wall）— 隊列の話を相手側へ広げる
  drag_forward: ["引きずり出す", "敵の後列で最も弱った一体を、最前の敵と入れ替える。届かなかった刃が届くようになる。", "機動"],
  shield_wall: ["盾の列", "前列の味方**全員**へ技術{amount}のラウンド防壁。一人へ厚く張る「傷へ盾を」の面展開。", "守り"],
  rally_line: ["陣を組み直す", "最も傷ついた前衛と、最も無事な後衛（自分以外）を入れ替える。自分は動かない。", "機動"],
  bulwark_of_will: ["意地の壁", "**開幕2ラウンドだけ**、自分へ最大HPの{amount}の戦闘中防壁。技術ではなく体で張る。", "守り"],
  spread_the_guard: ["構えを配る", "前列の味方全員へ受け構えを1つ。単発大威力に強く、多段には剥がされる。", "守り"],
  bracing_thrust: ["受けながらの突き", "腕力{amount}を出しつつ、自分に「守勢」を1つ。攻守を両取りするぶん威力は控えめ。", "攻撃"],
  // 構えと手当て（pack_care）— HPを戻す以外の手当て
  field_dressing: ["まとめて手当て", "HP50%以下の味方**全員**へ技術{amount}のラウンド防壁。対象がいなければスキップ。", "支援"],
  steady_breath: ["息を合わせる", "隊列の最後の味方へ「集中」を1つ。狙いを澄ますを他人へ向けた形。", "支援"],
  ward_ally: ["守勢を渡す", "最も傷ついた味方へ「守勢」を1つ。防壁と違い削り切られず、一撃ごとに8軽くする。", "支援"],
  precise_cut: ["静かな一手", "このラウンド一度も被弾していないときだけ、技術{amount}。技なので後列からでも落ちない。", "攻撃"],
  sustaining_ward: ["長く守る", "**開幕2ラウンドだけ**、最も傷ついた味方へ技術{amount}の戦闘中防壁。薄いが消えない。", "支援"],
  cleansing_step: ["払いのける", "自分に付いた「隙」を全部払い、代わりに「守勢」を1つ得る。状態を消す唯一の行動。", "守り"],
  // 行動権と準備（pack_tempo）— 相手の順番を崩す
  hasten_ally: ["背を押す", "隊列の最後の味方へ行動権を1渡す。号令（前列の先頭へ）と逆向き。", "指揮"],
  call_the_slow: ["後詰めを呼ぶ", "後列の味方全員へ反応権を1渡す。手数ではなく割り込みの権利を配る。", "指揮"],
  feint: ["誘い", "最前の敵へ「怯み」を1つ。次に動く相手ほど軽くする価値がある。", "指揮"],
  set_the_pace: ["拍を作る", "準備1回のあと、行動権を1と「集中」を1。開始と準備で2つ払うので手数は増えない。", "準備"],
  // 連撃と刻印（pack_barrage）— 刻印を「数」として読む
  flurry_finish: ["刻み止め", "最も弱った敵へ{amount}を{hits}回。受け構えを剥がしやすく、受けの厚い相手には最も弱い。", "攻撃"],
  mark_spread: ["刻印を散らす", "「隙」を持たない敵**全員**へ隙を1つずつ配る。対象がいなければスキップ。", "攻撃"],
  shatter_point: ["積もる刻印", "「隙」1段につき{amount}を受け無視で叩き込み、隙を全部刈り取る。腕力も技術も読まない。", "攻撃"],
  // 余波と受け渡し（pack_relay）— 自分の不利で他人の有利を買う
  take_the_wound: ["傷を引き受ける", "最も傷ついた味方へ「守勢」を2つ。代償として自分に「隙」が1つ付く。", "支援"],
  pass_the_edge: ["刃を渡す", "前列で最も速い味方へ「集中」を1つ。自分の一手を他人の一手に変える。", "指揮"],
};

const reactiveMeta = {
  counter_blow: ["反撃", "敵に殴られたあと、RP1で攻撃者へ腕力の{amount}ダメージ。", "被弾"],
  cover_ally: ["身代わり", "敵が味方を狙った瞬間、RP1で自分へ引き受ける。", "標的"],
  overflow_care: ["余剰治療", "自分が行った回復の余剰の{amount}を、RP1で別の負傷者へ回す。回復手段を選ばない。", "回復"],
  scavenge_ap: ["拾い直し", "敵を倒したとき、行動権を1得る。", "撃破"],
  guard_step: ["踏み固め", "移動したあと、技術の{amount}のラウンド防壁を得る。", "移動"],
  urging: ["急かす", "味方の準備開始時、RP1で準備を1進める。", "準備"],
  brace_after_hit: ["受け流し", "被弾後、RP1で技術の{amount}のラウンド防壁を得る。", "被弾"],
  triage_relay: ["連携治療", "応急手当の余剰だけをRP1で別の負傷者へ{amount}回す。条件は狭いが、連携時の量が大きい。", "回復"],
  block_focus: ["受け返しの集中", "受け構えで攻撃を止めたあと、RP1で「集中」を得る。次の一手を強くする。", "防御"],
  barrier_stitch: ["防壁の縫い直し", "防壁が壊れたあと、RP1で受け構えを1つ得る。", "防御"],
  // R8 Implementation Phase 1（続き）— mend/triage を anti-stall 安全な reactive
  // へ作り替えた（analysis/ecology-anti-stall-audit.mjs 是正、作者承認済み）。
  // どれも「同じ被弾の一部だけを返す」形で、古い損傷やround稼ぎでは発火しない。
  mend: ["手当て", "誰かが被弾した直後、RP1でその被弾量の{amount}を返す。同じ一撃を二重には治せない。", "回復"],
  triage: ["応急手当", "被弾後にHP半分以下になった自分以外の味方へ、RP1でその被弾量の{amount}を返す。自分は対象にしない。", "回復"],
  emergency_treatment: ["応急処置", "自分が被弾した直後、RP1でその被弾量の{amount}を返す。", "回復"],
  // R9 §5 — 横断pack。6つの発生源を、それぞれ別の役割の資源へ渡す。
  spill_forward: ["余波を回す", "過剰ダメージが出たあと、RP1で最も弱った敵へ腕力の{amount}。掃除役へ回る。", "撃破"],
  blocked_into_step: ["受けを順番へ", "受け構えで止めたあと、RP1で前列の先頭の味方へ行動権を1渡す。", "防御"],
  mercy_into_guard: ["手当てを備えへ", "自分が回復を与えたあと、RP1でその相手へ受け構えを1つ。", "回復"],
  stride_into_reach: ["歩みを間合いへ", "移動したあと、RP1で最前の敵へ「隙」を付ける。", "移動"],
  readied_relay: ["支度を渡す", "自分の準備が完了したあと、RP1で隊列の最後の味方へ反応権を1渡す。", "準備"],
  wake_of_the_fallen: ["倒したあと", "敵が倒れたあと、RP1で最も傷ついた味方へ技術の{amount}の防壁。", "撃破"],
  // R9 §4.1 / §9.2 — 導入 pack の接続面。別の役割が使う小さな入口と出口。
  whetted_by_pain: ["痛みで研ぐ", "被弾したあと、RP1で「集中」を得る。守り役が刃のpackへ入る口。", "被弾"],
  shield_handoff: ["受けの受け渡し", "受け構えで一撃を止めたあと、RP1で最も傷ついた味方へ技術の{amount}の防壁。", "防御"],
  patient_step: ["溜めの次手", "自分の準備が完了したあと、RP1で行動権を1得る。", "準備"],
  // R8 Implementation Phase 2 — pack_barrage（続き）。W・Tが既に発生させている
  // eventを読み、同じ利得先（隙の付与）へ2つの発生源からつなぐ。
  guarded_opening: ["受け止めの隙", "自分が受け構えで一撃を止めたあと、RP1でHPが最も高い敵へ「隙」を付ける。", "指揮"],
  seize_the_opening: ["機を逃さず", "自分が行動権を得たあと、RP1でHPが最も高い敵へ「隙」を付ける。", "指揮"],
  // ---------------------------------------------------------------- R16 — 大量追加
  //
  // **反応技能は「どの出来事を読むか」で分ける。**同じ結果でも、読む拍が違えば別の技能。
  opportunist: ["隙に応じる", "敵に「隙」が付いた瞬間、RP1で腕力{amount}。誰が付けた隙でも読む。", "状態"],
  vengeful_step: ["意趣返し", "味方が倒れたあと、RP1で最前の敵へ腕力{amount}。戦闘中2回まで。", "撃破"],
  finish_the_wounded: ["止めを促す", "敵がHP25%以下まで削られた一撃のあと、RP1でその敵へ腕力{amount}。自分の一撃でなくてよい。", "撃破"],
  absorb_shock: ["衝撃を殺す", "自分に飛んでくるダメージを、RP1で{amount}減らす。ラウンド1回。大きい一撃ほど割合では小さい。", "被弾"],
  guard_the_marked: ["狙われた者へ", "敵が味方を狙った瞬間、RP1でその味方へ「守勢」を1つ。身代わりと違い自分は受けない。", "標的"],
  last_stand: ["背水", "被弾してHP30%以下になったとき、RP1で技術{amount}のラウンド防壁。戦闘に1回きり。", "被弾"],
  counterweight: ["支え直す", "**自分以外の味方**が動いたあと、RP1でその味方へ技術{amount}のラウンド防壁。", "移動"],
  shared_pain: ["痛みを分ける", "味方が被弾した直後、RP1と自分のHP30を払って、その被弾量の{amount}を返す。", "回復"],
  watchful_care: ["目を離さない", "味方に「隙」が付いた瞬間、RP1でその隙を全部払い落とす。状態を消す唯一の反応。", "状態"],
  steady_under_fire: ["揺れない手", "被弾後、RP1で自分に「守勢」を1つ。受け流し（防壁）と違い削り切られない。", "被弾"],
  second_wind: ["二の息", "自分の回復が余ったあと、RP1で「集中」を1つ。余剰治療とは別の出口。", "回復"],
  read_the_charge: ["溜めを読む", "**敵が**準備を始めた瞬間、RP1でその敵へ「隙」を1つ。", "準備"],
  break_the_charge: ["溜めを崩す", "**敵の**準備が進んだあと、RP1でその準備を叩き落とす。戦闘に1回きり。", "準備"],
  counter_order: ["差し込む号令", "敵が行動を宣言した瞬間、RP1でその敵へ「怯み」を1つ。潰さないぶん何度でも。", "標的"],
  stall_the_blow: ["出鼻を挫く", "敵が攻撃を宣言した瞬間、RP2でその行動そのものを消す。戦闘に1回きり。", "標的"],
  echo_of_the_mark: ["刻印の残響", "敵の「隙」が消えた瞬間、RP1で腕力{amount}。刈り取っても、自然に消えても起きる。", "状態"],
  stagger_relay: ["怯みを回す", "敵に「怯み」が付いた瞬間、RP1で最前の敵へも「怯み」を1つ。", "状態"],
  warded_into_edge: ["守勢を刃へ", "自分が「守勢」を受け取ったあと、RP1で「集中」を1つ。守られた者が刃になる。", "状態"],
  bleed_into_wake: ["裂傷の余波", "敵に「裂傷」が入った瞬間、RP1でその敵へ「隙」も1つ。細い傷を束ねる。", "状態"],
};

const equipmentMeta = {
  worn_greaves: ["踏み込みの靴", "ラウンド最初の発動後、行動権を1得る。", "手数", 2],
  splinter_edge: ["棘の刃", "余ったダメージが出ると、耐久1で10ダメージを追加。", "攻撃", 2],
  field_kit: ["野営道具", "余ったRPを使い、耐久1を修理する。", "修理", 2],
  standing_plate: ["継ぎはぎの盾", "戦闘開始時、戦闘中防壁20を得る。", "防御", 3],
  momentum_rig: ["勢いの留め具", "移動後、耐久1で「集中」を得る。", "機動", 2],
  hungry_plate: ["喰らう板", "戦闘開始時に耐久を使い、後続の摩耗を誘発する。", "消耗", 3],
  guard_lantern: ["守り火", "小さな防壁を長く維持する。", "防御", 2],
  bastion_shell: ["厚い継ぎ板", "戦闘開始時、防壁30。", "防御", 3],
  tempo_buckle: ["拍子の留め具", "ラウンド最初の発動後、行動権を得る。耐久1。", "手数", 1],
  quickstrap: ["軽い締め具", "発動後の行動権を狙う。耐久が高い。", "手数", 3],
  reserve_coil: ["予備のばね", "ラウンド最初の発動後、行動権を得る。", "手数", 4],
  focus_band: ["集中の帯", "移動後、「集中」を得る。耐久1。", "機動", 1],
  anchor_boots: ["錨の靴", "移動後、「集中」を得る。耐久が高い。", "機動", 3],
  signal_lens: ["合図のレンズ", "移動後、「集中」を得る。", "機動", 4],
  thorn_clasp: ["返しの留め具", "余ったダメージから10ダメージの追加攻撃。耐久1。", "攻撃", 1],
  shard_hilt: ["破片の柄", "余ったダメージから10ダメージの追加攻撃。", "攻撃", 3],
  repair_pouch: ["修繕袋", "余ったRPで装備を修理する。耐久1。", "修理", 1],
  recovery_satchel: ["大きな救急袋", "余ったRPで装備を2修理する。", "修理", 4],
  block_latch: ["受け止め金具", "戦闘開始時、戦闘中防壁10を得る。耐久2。", "防御", 2],
  impact_spring: ["衝撃ばね", "受け構えが消費されたあと、耐久1でラウンド防壁10を得る。", "防御", 1],
  wound_thread: ["傷縫い糸", "被弾後、耐久1で「集中」を得る。ラウンド1回。", "反撃", 2],
  quiet_lens: ["静観レンズ", "余った行動権を耐久1でラウンド防壁へ変える。", "蓄積", 2],
  rescue_sachet: ["救急の小袋", "回復を行ったあと、耐久1で反応権を1得る。", "治療", 2],
  last_bell: ["仕留めの鈴", "敵を倒したあと、耐久1で行動権を1得る。戦闘1回。", "撃破", 1],
};

export const ACTIVE_META = activeMeta;
export const REACTIVE_META = reactiveMeta;
export const EQUIPMENT_META = equipmentMeta;

// R6 §6.8 — 常設 fallback passive の表示文。**基礎訓練は系統に属さない。**
// どの人物も、いつでも、前提なしで取れる（詰み防止だから）。
const passiveMeta = {
  foundation_vitality: ["地力", "最大HPが50増える。", "基礎"],
  foundation_might: ["膂力", "腕力が2増える。武器技能の量が上がる。", "基礎"],
  foundation_focus: ["技術", "技術が2増える。技術・治療・防壁の量が上がる。", "基礎"],
  foundation_guard: ["受け", "受けが1増える。一撃ごとの被害を減らす。", "基礎"],
  foundation_ap: ["出足", "戦闘開始時に一度だけ行動権+1。毎ラウンドではない。", "基礎"],
  foundation_rp: ["備え", "戦闘開始時に一度だけ反応権+1。毎ラウンドではない。", "基礎"],
  opening_guard: ["初手の構え", "戦闘開始時、受け構えを1つ得る。最初の一撃を受け止めるための守り。", "守り"],
  // R9 §4.1 — 導入 pack の常設。どれも rule で、その pack の中心的な出来事を
  // 別の結果へ変える（数値だけの上位版は作らない。R9 §4.2）。
  first_blood: ["先手の一閃", "戦闘開始時、「集中」を1つ得る。最初の一撃を研ぐための攻め。", "攻撃"],
  wake_reader: ["余波を読む", "過剰ダメージを出したあと、「集中」を1つ得る。余波の行き先が一つ増える。", "攻撃"],
  held_breath: ["余りを溜める", "ラウンド終わりに行動権が余っていたら、「集中」を1つ得る。手数は増えない。", "指揮"],
  steady_hands: ["慣れた手つき", "自分が回復を与えたあと、「集中」を1つ得る。手当てを次の仕事へつなぐ。", "支援"],
  // R16 — 大量追加。**どれも手数を増やさない。**既に起きている出来事の行き先が増える。
  edge_honed: ["研ぎ澄ます", "自分が敵を倒したあと、「集中」を1つ得る。ラウンド1回。", "攻撃"],
  wall_reader: ["崩れを読む", "自分の防壁が使われずに消えたあと、受け構えを1つ得る。ラウンド1回。", "守り"],
  patient_hands: ["先に手を打つ", "戦闘開始時、最も傷ついた味方へ「守勢」を1つ。傷を持ち越した戦闘ほど効く。", "支援"],
  first_order: ["初手の号令", "戦闘開始時に一度だけ、前列で最も速い味方（自分以外）へ行動権+1。毎ラウンドではない。", "指揮"],
  mark_reader: ["刻印を読む", "自分が敵へ「隙」を付けたあと、「集中」を1つ得る。ラウンド1回。", "攻撃"],
  relay_reader: ["渡りを読む", "自分が防壁を受け取ったあと、「集中」を1つ得る。ラウンド1回。", "支援"],
};
export const PASSIVE_META = passiveMeta;

// ---------------------------------------------------------------- 技能ツリーの森（R19 / issue #137）
//
// **書いた形が、そのまま画面の形になる。**
//
// R18 までのツリーは「系統 × tier（0/1/2）」の平らな並びだった。
// 節がどこから生えるのかは requires を目で追わないと分からず、深さ（tier）は
// 0/1/2 の三段しか無かったので、**取得方針が立たない**（issue #137 の出発点）。
//
// ここでは森を入れ子で書く。字下げがそのまま x（前提からの深さ）になり、
// 親が前提、子が派生である。x は書いた形から出るので、**手で座標を書かない**。
//
//   node(id, ...children)  … その技能の節。子は必ず1列右に来る。
//
// **前提は必ず同じ種別（行動 / 反応 / 常設）の中に置く。**種別をまたぐ前提は
// 「これは何の資源を伸ばす話なのか」を読めなくするので使わない
// （旧 R19 は `from()` という種別またぎの橋渡しを試したが、分かりにくいので廃止した。
// analysis/ecology-skill-tree-smoke.mjs が種別またぎの前提を検出する）。
//
// ## 深さの意味（issue #137 §深さと分岐）
//
//   x=1      入口。前提を持たない基本技能
//   x=2      基本の使いやすさ・効率の強化
//   x=3      1回目の大きな役割分岐
//   x=4      分岐方向の強化
//   x=5      2回目の大きな役割分岐
//   x=6〜9   コンボや専門性の強化
//   x=10     最終ビルドの到達点
//
// ## 並べるときの決まり
//
// **子は必ず親と同じか後ろの pack に置く。** pack は Stage ごとに増えるので、
// 前提が後の pack に居ると「画面に出ているのに永久に解禁できない節」になる
// （analysis/ecology-skill-catalog-smoke.mjs が Stage ごとに見る）。
// 順番は baseline → 構えと手当て → 刃と撃破 → 防壁と隊列 → 行動権と準備 で、
// 同じ pack の中では core（入口）が先、full が後である。
//
// **campaign で、行動は x=10、リアクティブは x=8 まで届く道を通す。**届かない到達点は
// 設計図であって、遊べる形ではない。行動ツリーは「薙ぎ払い」（防壁と隊列 full ＝
// Stage 3）、反応ツリーは「手当てを備えへ」まで、実際に取り切れる。

// issue #168（#165 段階1）— **前提は「その技能を持っているか」ではなく
// 「その技能が Lv いくつか」で書く。**
//
// 現行の全節は親 Lv1（＝取得済み）だけを要求するので、`node()` はそのまま書ける。
// 親を伸ばして初めて意味が変わる子を作りたくなったとき、その要求を**節のデータとして**
// 書けるようにしておく（設計 #165 の 09-growth-v3 §4.1 が推奨する形）。
//
//   node("child")                      … 親 Lv1（取得済み）で開く。既定。
//   needsParentLv(3, node("child"))    … 親を Lv3 まで伸ばして初めて開く。
//
// **要求は辺に付くので、子の側に書く。**同じ親から生える別の子が、別の Lv を
// 要求してよい（「Lv1 で横へ、Lv3 で深く」という複数経路を作るため）。
const node = (skillId, ...children) => ({ skillId, children, minLv: MIN_SKILL_LEVEL });
const needsParentLv = (minLv, entry) => ({ ...entry, minLv });

// 系統（役割）。**ツリーの構造ではなく、節に付く色である。**
// どの資源を払うか（行動 / 反応 / 常設）はツリーの大分類、どの役割かはこの表。
const BRANCH_OF = {
  strike: "攻撃",
  heavy_swing: "攻撃",
  long_swing: "攻撃",
  hunt_the_slow: "攻撃",
  relay_order: "指揮",
  reposition: "指揮",
  mark_target: "指揮",
  steady_aim: "指揮",
  mend: "支援",
  triage: "支援",
  emergency_treatment: "支援",
  idle_shuffle: "支援",
  bulwark: "守り",
  steady_cut: "攻撃",
  aimed_shot: "支援",
  counter_blow: "攻撃",
  scavenge_ap: "指揮",
  guard_step: "指揮",
  cover_ally: "守り",
  brace_after_hit: "守り",
  overflow_care: "支援",
  triage_relay: "支援",
  urging: "支援",
  block_focus: "守り",
  barrier_stitch: "守り",
  rapid_cuts: "攻撃",
  pierce_thrust: "攻撃",
  row_sweep: "攻撃",
  column_thrust: "攻撃",
  guard_crush: "攻撃",
  rear_hunt: "攻撃",
  finishing_thrust: "攻撃",
  crack_mark: "攻撃",
  brace_for_impact: "守り",
  barrage_strike: "攻撃",
  mark_strike: "攻撃",
  mark_break: "攻撃",
  sweeping_barrage: "攻撃",
  piercing_barrage: "攻撃",
  guarded_opening: "攻撃",
  seize_the_opening: "攻撃",
  foundation_vitality: "基礎",
  foundation_might: "基礎",
  foundation_focus: "基礎",
  foundation_guard: "基礎",
  foundation_ap: "基礎",
  foundation_rp: "基礎",
  opening_guard: "守り",
  whetted_by_pain: "攻撃",
  first_blood: "攻撃",
  shield_handoff: "守り",
  patient_step: "指揮",
  held_breath: "指揮",
  shield_the_wounded: "支援",
  steady_hands: "支援",
  hand_off: "支援",
  overreach: "攻撃",
  spill_forward: "攻撃",
  wake_reader: "攻撃",
  blocked_into_step: "守り",
  wake_of_the_fallen: "守り",
  mercy_into_guard: "支援",
  readied_relay: "指揮",
  stride_into_reach: "指揮",
  hamstring: "攻撃",
  rend: "攻撃",
  double_back: "攻撃",
  spread_cut: "攻撃",
  opening_stab: "攻撃",
  bloodied_charge: "攻撃",
  reckless_swing: "攻撃",
  execute_low: "攻撃",
  opportunist: "攻撃",
  vengeful_step: "攻撃",
  finish_the_wounded: "攻撃",
  edge_honed: "攻撃",
  drag_forward: "守り",
  shield_wall: "守り",
  rally_line: "守り",
  bulwark_of_will: "守り",
  spread_the_guard: "守り",
  bracing_thrust: "守り",
  absorb_shock: "守り",
  guard_the_marked: "守り",
  last_stand: "守り",
  counterweight: "守り",
  wall_reader: "守り",
  field_dressing: "支援",
  steady_breath: "支援",
  ward_ally: "支援",
  precise_cut: "支援",
  sustaining_ward: "支援",
  cleansing_step: "支援",
  shared_pain: "支援",
  watchful_care: "支援",
  steady_under_fire: "支援",
  second_wind: "支援",
  patient_hands: "支援",
  hasten_ally: "指揮",
  call_the_slow: "指揮",
  feint: "指揮",
  set_the_pace: "指揮",
  read_the_charge: "指揮",
  break_the_charge: "指揮",
  counter_order: "指揮",
  stall_the_blow: "指揮",
  first_order: "指揮",
  flurry_finish: "攻撃",
  mark_spread: "攻撃",
  shatter_point: "攻撃",
  echo_of_the_mark: "攻撃",
  mark_reader: "攻撃",
  take_the_wound: "支援",
  pass_the_edge: "指揮",
  stagger_relay: "指揮",
  warded_into_edge: "守り",
  bleed_into_wake: "攻撃",
  relay_reader: "支援",
};

const ACTIVE_FOREST = [
  node("strike",  // 斬撃
    node("overreach"),  // 無理を通す
    node("steady_cut",  // 確かな斬り
      node("pierce_thrust",  // 貫き突き
        node("column_thrust",  // 突き通し
          node("row_sweep")),  // 薙ぎ払い
        node("rear_hunt",  // 後衛狩り
          node("rapid_cuts",  // 刻み斬り
            node("spread_cut",  // 散らし斬り
              node("crack_mark",  // 傷口を開く
                node("rend",  // 抉る
                  node("double_back",  // 二の太刀
                    node("reckless_swing"),  // 捨て身の一振り
                    node("bloodied_charge")))))),  // 手負いの突撃
          node("guard_crush"))),  // 受け崩し
      node("heavy_swing",  // 溜め突き
        node("long_swing",  // 大溜め
          node("hunt_the_slow"),  // 準備狩り
          node("opening_stab"))),  // 先の一刺し
      node("finishing_thrust",  // 止めの一突き
        node("hamstring",  // 足を払う
          node("execute_low")))),  // 首を落とす
    node("aimed_shot",  // 狙い撃ち
      node("shield_the_wounded",  // 傷へ盾を
        node("field_dressing",  // まとめて手当て
          node("precise_cut"),  // 静かな一手
          node("idle_shuffle"))),  // 息を整える
      node("ward_ally",  // 守勢を渡す
        node("sustaining_ward",  // 長く守る
          node("cleansing_step"),  // 払いのける
          node("steady_breath"))))),  // 息を合わせる
  node("bulwark",  // 防壁形成
    node("hand_off"),  // 引き継ぐ
    node("take_the_wound"),  // 傷を引き受ける
    node("spread_the_guard",  // 構えを配る
      node("brace_for_impact",  // 衝撃に備える
        node("bulwark_of_will",  // 意地の壁
          node("shield_wall"),  // 盾の列
          node("bracing_thrust"))),  // 受けながらの突き
      node("reposition",  // 位置替え
        node("rally_line",  // 陣を組み直す
          node("drag_forward"),  // 引きずり出す
          node("relay_order",  // 号令
            node("hasten_ally"),  // 背を押す
            node("mark_target",  // 隙を刻む
              node("steady_aim",  // 狙いを澄ます
                node("feint"),  // 誘い
                node("set_the_pace",  // 拍を作る
                  node("call_the_slow",  // 後詰めを呼ぶ
                    node("pass_the_edge")))))))))),  // 刃を渡す
  node("barrage_strike",  // 連撃
    node("flurry_finish"),  // 刻み止め
    node("sweeping_barrage"),  // 連ぎ払い
    node("piercing_barrage")),  // 貫き連撃
  node("mark_strike",  // 刻印撃ち
    node("mark_spread"),  // 刻印を散らす
    node("mark_break",  // 刻印砕き
      node("shatter_point"))),  // 積もる刻印
];

const REACTIVE_FOREST = [
  node("mend",  // 手当て
    node("triage",  // 応急手当
      node("overflow_care",  // 余剰治療
        node("emergency_treatment",  // 応急処置
          node("triage_relay",  // 連携治療
            node("second_wind",  // 二の息
              node("shared_pain",  // 痛みを分ける
                node("urging",  // 急かす
                    node("mercy_into_guard"))))),  // 手当てを備えへ
          node("steady_under_fire"))),  // 揺れない手
      node("watchful_care")),  // 目を離さない
    node("counter_blow",  // 反撃
      node("opportunist",  // 隙に応じる
        node("whetted_by_pain",  // 痛みで研ぐ
            node("vengeful_step",  // 意趣返し
              node("guard_step",  // 踏み固め
                  node("read_the_charge",  // 溜めを読む
                    node("break_the_charge")))),  // 溜めを崩す
          node("finish_the_wounded",  // 止めを促す
            node("bleed_into_wake",  // 裂傷の余波
              node("spill_forward"))))),  // 余波を回す
      node("scavenge_ap",  // 拾い直し
        node("patient_step",  // 溜めの次手
          node("counter_order",  // 差し込む号令
            node("stall_the_blow",  // 出鼻を挫く
              node("stagger_relay",  // 怯みを回す
                node("readied_relay")))),  // 支度を渡す
          node("stride_into_reach")))),  // 歩みを間合いへ
    node("brace_after_hit",  // 受け流し
      node("cover_ally",  // 身代わり
        node("shield_handoff",  // 受けの受け渡し
          node("guard_the_marked",  // 狙われた者へ
              node("barrier_stitch",  // 防壁の縫い直し
                node("wake_of_the_fallen",  // 倒したあと
                  node("warded_into_edge",  // 守勢を刃へ
                    node("blocked_into_step"))))),  // 受けを順番へ
          node("last_stand"))),  // 背水
      node("absorb_shock",  // 衝撃を殺す
        node("block_focus",  // 受け返しの集中
          node("counterweight")))),  // 支え直す
    node("guarded_opening",  // 受け止めの隙
      node("seize_the_opening"),  // 機を逃さず
      node("echo_of_the_mark"))),  // 刻印の残響
];

const PASSIVE_FOREST = [
  node("foundation_vitality"),  // foundation_vitality
  node("foundation_might",  // foundation_might
    node("first_blood",  // first_blood
      node("edge_honed"),  // edge_honed
      node("wake_reader")),  // wake_reader
    node("mark_reader")),  // mark_reader
  node("foundation_focus",  // foundation_focus
    node("steady_hands",  // steady_hands
      node("patient_hands"),  // patient_hands
      node("relay_reader"))),  // relay_reader
  node("foundation_guard",  // foundation_guard
    node("opening_guard",  // opening_guard
      node("wall_reader"))),  // wall_reader
  node("foundation_ap",  // foundation_ap
    node("held_breath",  // held_breath
      node("first_order"))),  // first_order
  node("foundation_rp"),  // foundation_rp
];

// **値段は深さそのものが決める。**1節 1点で、行動 x=10 の到達点までは 9点、
// リアクティブ x=9 の到達点までは 8点かかる（遠征1回で配られる技能点とほぼ同じ）。
// baseline の入口だけ 0点で、
// 誰でも最初から一つは出せる（R6 §5.2 の詰み防止）。
const FREE_ENTRY_SKILL_IDS = new Set([
  ...BASELINE_ACTIVE_SKILL_IDS,
  ...BASELINE_REACTIVE_SKILL_IDS,
]);

// issue #168 — 節の最大 Lv も**節のデータにする。**前提が要求する Lv が、その技能の
// 上限を超えていないか（＝永久に開かない子が居ないか）を、節を見るだけで検算できる。
// 値は content/skill-levels.mjs の導出をそのまま使うので、手で書いた上限は増えない。
const DEFINITIONS_OF_KIND = {
  active: ACTIVE_SKILLS,
  reactive: REACTIVE_SKILLS,
  passive: PASSIVE_SKILLS,
};

function flattenForest(forest, kind, out) {
  const walk = (entry, requires, x) => {
    out.push(Object.freeze({
      id: "node_" + entry.skillId,
      skillId: entry.skillId,
      kind,
      branch: BRANCH_OF[entry.skillId] ?? "基礎",
      // R19 — **座標を data として持つ。**組み方から出た値をここへ焼き、
      // content/skill-tree-layout.mjs が組み直した x と一致するかを検査する。
      x,
      cost: requires.length === 0 && FREE_ENTRY_SKILL_IDS.has(entry.skillId) ? 0 : 1,
      maxLv: skillLevelCap(DEFINITIONS_OF_KIND[kind]?.[entry.skillId]),
      // issue #168 — 前提は `{ skillId, minLv }`。ID だけ要る呼び出し元は
      // `requiredSkillIds(node)` を通る。
      requires: Object.freeze(requires.map((required) => Object.freeze({ ...required }))),
    }));
    for (const child of entry.children) {
      walk(child, [{ skillId: entry.skillId, minLv: child.minLv ?? MIN_SKILL_LEVEL }], x + 1);
    }
  };
  for (const entry of forest) walk(entry, [], 1);
  return out;
}

export const SKILL_TREE_NODES = Object.freeze([
  ...flattenForest(ACTIVE_FOREST, "active", []),
  ...flattenForest(REACTIVE_FOREST, "reactive", []),
  ...flattenForest(PASSIVE_FOREST, "passive", []),
]);

// ---------------------------------------------------------------- 前提の読み方（issue #168）
//
// **前提の判定はここ一つだけ。**解禁 API・画面の「前提待ち」・加入時の無償閉包・
// 保存の復元が同じ関数を通る。別々に書くと、片方だけが Lv を見ない形へ戻る
// （そのとき画面には「取れます」と出て、押すと断られる）。
//
// `levelOf(skillId)` は**未取得なら 0**、取得済みならその Lv を返すこと。

export function requiredSkillIds(node) {
  return (node?.requires ?? []).map((required) => required.skillId);
}

export function unmetPrerequisites(node, levelOf) {
  return (node?.requires ?? []).filter((required) => {
    const level = levelOf(required.skillId);
    return !(Number.isInteger(level) && level >= required.minLv);
  });
}

export function prerequisitesMet(node, levelOf) {
  return unmetPrerequisites(node, levelOf).length === 0;
}

export { needsParentLv };
