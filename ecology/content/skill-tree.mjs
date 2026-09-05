// ecology/content/skill-tree.mjs
//
// **技能ツリーの節と、技能・装備の表示文。種類をまたぐので統合担当が持つ。**
// R7 Milestone 0 で playable-battles.mjs から分離した。**挙動は変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 統合 担当だけ。engine・schema・共通registryは変更しない。

const activeMeta = {
  // R6 §17.1 — Phase A の攻撃 archetype。**説明に「何に強くて何に弱いか」を書く。**
  rapid_cuts: ["刻み斬り", "50%を3回。合計150%で通常攻撃を上回るが、受けの硬い相手には通りにくい。", "攻撃"],
  pierce_thrust: ["貫き突き", "通常攻撃を上回る115%。相手の受けを6割無視する。硬い相手向け。", "攻撃"],
  row_sweep: ["薙ぎ払い", "前列の敵が2体以上いるとき、同じ行を80%ずつ薙ぐ。対象がいなければスキップ。", "攻撃"],
  column_thrust: ["突き通し", "同じ列の前後を110%ずつ貫く。後列を庇う列に効く。", "攻撃"],
  guard_crush: ["受け崩し", "通常攻撃を上回る115%。相手の受け構えと受けを完全に無視する。", "攻撃"],
  rear_hunt: ["後衛狩り", "後列の生存者がいるときだけ120%で狙う。対象がいなければスキップ。", "攻撃"],
  finishing_thrust: ["止めの一突き", "HP半分以下の敵がいるときだけ140%で狙う。対象がいなければスキップ。", "攻撃"],
  crack_mark: ["傷口を開く", "未露出の敵へ110%で攻撃し、「隙」を付ける。対象がいなければスキップ。", "攻撃"],
  brace_for_impact: ["衝撃に備える", "受け構えを1つ得てから、通常の追い打ちを行う。多段攻撃には剥がされやすい。", "守り"],
  strike: ["斬撃", "最も弱った敵へ、通常攻撃を上回る120%の単発。", "攻撃"],
  // R11 §5 — Stage 0 の安定した二本。**違いは威力ではなく、出せる場所。**
  steady_cut: ["確かな斬り", "条件も準備もない、腕力130%の一撃。武器なので後列から出すと40%まで落ちる。", "攻撃"],
  aimed_shot: ["狙い撃ち", "最も弱った敵へ集中力125%。技なので後列から出しても落ちず、前列が生きていても後列へ通る。", "攻撃"],
  bulwark: ["防壁形成", "自分に集中力の200%のラウンド防壁を張ってから、追い打ちを行う。", "守り"],
  relay_order: ["号令", "前衛の最速の味方へ行動権を1渡す。", "指揮"],
  heavy_swing: ["溜め突き", "準備1回のあと、550%の一撃。開始と準備で行動権を計2つ使う。", "攻撃"],
  reposition: ["位置替え", "後衛なら、最も傷ついた前衛と場所を替える。", "機動"],
  long_swing: ["大溜め", "準備3回のあと、1000%を一撃で返す。開始と準備で行動権を計4つ使う。", "攻撃"],
  hunt_the_slow: ["準備狩り", "準備中の敵がいるときだけ300%で狙う。対象がいなければスキップ。", "攻撃"],
  idle_shuffle: ["息を整える", "自分に集中を1つ付ける。集中中はスキップ。", "準備"],
  mark_target: ["隙を刻む", "まだ「隙」のない敵に付与する。対象がいなければスキップ。", "指揮"],
  steady_aim: ["狙いを澄ます", "自分に「集中」を1つ付けてから、追い打ちを行う。集中中はスキップ。", "準備"],
  // R9 §5 — 横断pack「余波と受け渡し」の主行動。
  hand_off: ["引き継ぐ", "最も傷ついた味方へ受け構えを1つ渡してから、追い打ちを行う。", "支援"],
  overreach: ["無理を通す", "自分のHPが60%以上のときだけ、最も弱った敵へ165%。条件を欠いても行動は塞がらない。", "攻撃"],
  // R9 §4.1 — pack_care の主行動。HP を戻さず、これ以上の傷を止める側へ置く。
  shield_the_wounded: ["傷へ盾を", "最も傷ついた味方へ集中力の150%のラウンド防壁を張ってから、追い打ちを行う。", "支援"],
  // R8 Implementation Phase 2 — pack_barrage（連撃と刻印、Stage 3）の密度。
  barrage_strike: ["連撃", "45%を3回。合計135%で、受けの厚い相手より、受け構え（block）を持つ相手に強い。", "攻撃"],
  mark_strike: ["刻印撃ち", "隙のない敵へ100%で攻撃し、「隙」を付ける。対象がいなければスキップ。", "攻撃"],
  mark_break: ["刻印砕き", "「隙」を持つ敵へ130%で攻撃し、隙を刈り取る。対象がいなければスキップ。", "攻撃"],
  sweeping_barrage: ["連ぎ払い", "前列の敵が2体以上いるとき、同じ行を40%×2回薙ぐ。対象がいなければスキップ。", "攻撃"],
  piercing_barrage: ["貫き連撃", "同じ列の前後を48%×2回貫く。後列を庇う列を多段で崩す。", "攻撃"],
  // ---------------------------------------------------------------- R16 — 大量追加
  //
  // **説明文には「何に強くて何に弱いか」と「代償」を書く。**係数の数字は
  // analysis/ecology-readout-smoke.mjs が定義側と照合するので、勝手にずれない。
  //
  // 刃と撃破（pack_edge）— 殴る前に何を読むか
  reckless_swing: ["捨て身の一振り", "最前の敵へ腕力200%。代償として自分に「隙」が1つ付き、次に受ける一撃が重くなる。", "攻撃"],
  double_back: ["二の太刀", "同じ相手を続けて2回以上狙っていたときだけ腕力165%。相手を変えると数え直しになる。", "攻撃"],
  spread_cut: ["散らし斬り", "同じ相手を続けて狙っていないときだけ腕力135%。二の太刀とは同時に成立しない。", "攻撃"],
  opening_stab: ["先の一刺し", "1ラウンド目だけ腕力185%。2ラウンド目からは通常攻撃へ戻る。", "攻撃"],
  bloodied_charge: ["手負いの突撃", "自分のHPが50%以下のときだけ腕力205%。「無理を通す」（60%以上）の裏。", "攻撃"],
  hamstring: ["足を払う", "腕力85%と引き換えに「怯み」を1つ付ける。怯んだ相手が出すダメージが1段につき8軽くなる。", "攻撃"],
  execute_low: ["首を落とす", "HP30%以下の敵がいるときだけ腕力200%。対象がいなければスキップ。", "攻撃"],
  rend: ["抉る", "腕力95%と「裂傷」2つ。裂傷はラウンド終わりに1段12、受けを完全に無視して刻む。", "攻撃"],
  // 防壁と隊列（pack_wall）— 隊列の話を相手側へ広げる
  drag_forward: ["引きずり出す", "敵の後列で最も弱った一体を、最前の敵と入れ替える。届かなかった刃が届くようになる。", "機動"],
  shield_wall: ["盾の列", "前列の味方**全員**へ集中力70%のラウンド防壁。一人へ厚く張る「傷へ盾を」の面展開。", "守り"],
  rally_line: ["陣を組み直す", "最も傷ついた前衛と、最も無事な後衛（自分以外）を入れ替える。自分は動かない。", "機動"],
  bulwark_of_will: ["意地の壁", "**開幕2ラウンドだけ**、自分へ最大HPの10%の戦闘中防壁。術力ではなく体で張る。", "守り"],
  spread_the_guard: ["構えを配る", "前列の味方全員へ受け構えを1つ。単発大威力に強く、多段には剥がされる。", "守り"],
  bracing_thrust: ["受けながらの突き", "腕力105%を出しつつ、自分に「守勢」を1つ。攻守を両取りするぶん威力は控えめ。", "攻撃"],
  // 構えと手当て（pack_care）— HPを戻す以外の手当て
  field_dressing: ["まとめて手当て", "HP50%以下の味方**全員**へ集中力60%のラウンド防壁。対象がいなければスキップ。", "支援"],
  steady_breath: ["息を合わせる", "最も遅い味方へ「集中」を1つ。狙いを澄ますを他人へ向けた形。", "支援"],
  ward_ally: ["守勢を渡す", "最も傷ついた味方へ「守勢」を1つ。防壁と違い削り切られず、一撃ごとに8軽くする。", "支援"],
  precise_cut: ["静かな一手", "このラウンド一度も被弾していないときだけ、集中力150%。技なので後列からでも落ちない。", "攻撃"],
  sustaining_ward: ["長く守る", "**開幕2ラウンドだけ**、最も傷ついた味方へ集中力90%の戦闘中防壁。薄いが消えない。", "支援"],
  cleansing_step: ["払いのける", "自分に付いた「隙」を全部払い、代わりに「守勢」を1つ得る。状態を消す唯一の行動。", "守り"],
  // 行動権と準備（pack_tempo）— 相手の順番を崩す
  hasten_ally: ["背を押す", "最も遅い味方へ行動権を1渡す。号令（前衛の最速へ）と逆向き。", "指揮"],
  call_the_slow: ["後詰めを呼ぶ", "後列の味方全員へ反応権を1渡す。手数ではなく割り込みの権利を配る。", "指揮"],
  feint: ["誘い", "最も速い敵へ「怯み」を1つ。先に動く相手ほど軽くする価値がある。", "指揮"],
  set_the_pace: ["拍を作る", "準備1回のあと、行動権を1と「集中」を1。開始と準備で2つ払うので手数は増えない。", "準備"],
  // 連撃と刻印（pack_barrage）— 刻印を「数」として読む
  flurry_finish: ["刻み止め", "最も弱った敵へ30%を5回。受け構えを剥がす速さは随一で、受けの厚い相手には最も弱い。", "攻撃"],
  mark_spread: ["刻印を散らす", "「隙」を持たない敵**全員**へ隙を1つずつ配る。対象がいなければスキップ。", "攻撃"],
  shatter_point: ["積もる刻印", "「隙」1段につき45を受け無視で叩き込み、隙を全部刈り取る。腕力も術力も読まない。", "攻撃"],
  // 余波と受け渡し（pack_relay）— 自分の不利で他人の有利を買う
  take_the_wound: ["傷を引き受ける", "最も傷ついた味方へ「守勢」を2つ。代償として自分に「隙」が1つ付く。", "支援"],
  pass_the_edge: ["刃を渡す", "前列で最も速い味方へ「集中」を1つ。自分の一手を他人の一手に変える。", "指揮"],
};

const reactiveMeta = {
  counter_blow: ["反撃", "敵に殴られたあと、RP1で攻撃者へ腕力の50%ダメージ。", "被弾"],
  cover_ally: ["身代わり", "敵が味方を狙った瞬間、RP1で自分へ引き受ける。", "標的"],
  overflow_care: ["余剰治療", "自分が行った回復の余剰を、RP1で別の負傷者へそのまま回す。回復手段を選ばない。", "回復"],
  scavenge_ap: ["拾い直し", "敵を倒したとき、行動権を1得る。", "撃破"],
  guard_step: ["踏み固め", "移動したあと、集中力の50%のラウンド防壁を得る。", "移動"],
  urging: ["急かす", "味方の準備開始時、RP1で準備を1進める。", "準備"],
  brace_after_hit: ["受け流し", "被弾後、RP1で集中力の50%のラウンド防壁を得る。", "被弾"],
  triage_relay: ["連携治療", "応急手当の余剰だけをRP1で別の負傷者へ125%回す。条件は狭いが、連携時の量が大きい。", "回復"],
  ap_loop: ["行動権の循環", "行動権を得たとき、前衛へもう一度渡す。", "資源"],
  damage_echo: ["痛みの反響", "被弾した敵へ腕力の25%ダメージを返す。", "被弾"],
  barrier_bloom: ["防壁の花", "防壁を得たとき、さらに集中力の25%の防壁。", "防壁"],
  prep_spiral: ["準備の螺旋", "準備が進むたび、自分の準備をさらに1段進める。", "準備"],
  block_focus: ["受け返しの集中", "受け構えで攻撃を止めたあと、RP1で「集中」を得る。次の一手を強くする。", "防御"],
  barrier_stitch: ["防壁の縫い直し", "防壁が壊れたあと、RP1で受け構えを1つ得る。", "防御"],
  // R8 Implementation Phase 1（続き）— mend/triage を anti-stall 安全な reactive
  // へ作り替えた（analysis/ecology-anti-stall-audit.mjs 是正、作者承認済み）。
  // どれも「同じ被弾の一部だけを返す」形で、古い損傷やround稼ぎでは発火しない。
  mend: ["手当て", "誰かが被弾した直後、RP1でその被弾量の25%を返す。同じ一撃を二重には治せない。", "回復"],
  triage: ["応急手当", "被弾後にHP半分以下になった自分以外の味方へ、RP1でその被弾量の50%を返す。自分は対象にしない。", "回復"],
  emergency_treatment: ["応急処置", "自分が被弾した直後、RP1でその被弾量の33%を返す。", "回復"],
  // R9 §5 — 横断pack。6つの発生源を、それぞれ別の役割の資源へ渡す。
  spill_forward: ["余波を回す", "過剰ダメージが出たあと、RP1で最も弱った敵へ腕力の30%。掃除役へ回る。", "撃破"],
  blocked_into_step: ["受けを順番へ", "受け構えで止めたあと、RP1で前列の最速の味方へ行動権を1渡す。", "防御"],
  mercy_into_guard: ["手当てを備えへ", "自分が回復を与えたあと、RP1でその相手へ受け構えを1つ。", "回復"],
  stride_into_reach: ["歩みを間合いへ", "移動したあと、RP1で最前の敵へ「隙」を付ける。", "移動"],
  readied_relay: ["支度を渡す", "自分の準備が完了したあと、RP1で最も遅い味方へ反応権を1渡す。", "準備"],
  wake_of_the_fallen: ["倒したあと", "敵が倒れたあと、RP1で最も傷ついた味方へ術力の100%の防壁。", "撃破"],
  // R9 §4.1 / §9.2 — 導入 pack の接続面。別の役割が使う小さな入口と出口。
  whetted_by_pain: ["痛みで研ぐ", "被弾したあと、RP1で「集中」を得る。守り役が刃のpackへ入る口。", "被弾"],
  shield_handoff: ["受けの受け渡し", "受け構えで一撃を止めたあと、RP1で最も傷ついた味方へ集中力の75%の防壁。", "防御"],
  patient_step: ["溜めの次手", "自分の準備が完了したあと、RP1で行動権を1得る。", "準備"],
  // R8 Implementation Phase 2 — pack_barrage（続き）。W・Tが既に発生させている
  // eventを読み、同じ利得先（隙の付与）へ2つの発生源からつなぐ。
  guarded_opening: ["受け止めの隙", "自分が受け構えで一撃を止めたあと、RP1でHPが最も高い敵へ「隙」を付ける。", "指揮"],
  seize_the_opening: ["機を逃さず", "自分が行動権を得たあと、RP1でHPが最も高い敵へ「隙」を付ける。", "指揮"],
  // ---------------------------------------------------------------- R16 — 大量追加
  //
  // **反応技能は「どの出来事を読むか」で分ける。**同じ結果でも、読む拍が違えば別の技能。
  opportunist: ["隙に応じる", "敵に「隙」が付いた瞬間、RP1で腕力45%。誰が付けた隙でも読む。", "状態"],
  vengeful_step: ["意趣返し", "味方が倒れたあと、RP1で最前の敵へ腕力60%。戦闘中2回まで。", "撃破"],
  finish_the_wounded: ["止めを促す", "敵がHP25%以下まで削られた一撃のあと、RP1でその敵へ腕力55%。自分の一撃でなくてよい。", "撃破"],
  absorb_shock: ["衝撃を殺す", "自分に飛んでくるダメージを、RP1で12減らす。ラウンド1回。大きい一撃ほど割合では小さい。", "被弾"],
  guard_the_marked: ["狙われた者へ", "敵が味方を狙った瞬間、RP1でその味方へ「守勢」を1つ。身代わりと違い自分は受けない。", "標的"],
  last_stand: ["背水", "被弾してHP30%以下になったとき、RP1で集中力150%のラウンド防壁。戦闘に1回きり。", "被弾"],
  counterweight: ["支え直す", "**自分以外の味方**が動いたあと、RP1でその味方へ集中力50%のラウンド防壁。", "移動"],
  shared_pain: ["痛みを分ける", "味方が被弾した直後、RP1と自分のHP30を払って、その被弾量の50%を返す。", "回復"],
  watchful_care: ["目を離さない", "味方に「隙」が付いた瞬間、RP1でその隙を全部払い落とす。状態を消す唯一の反応。", "状態"],
  steady_under_fire: ["揺れない手", "被弾後、RP1で自分に「守勢」を1つ。受け流し（防壁）と違い削り切られない。", "被弾"],
  second_wind: ["二の息", "自分の回復が余ったあと、RP1で「集中」を1つ。余剰治療とは別の出口。", "回復"],
  read_the_charge: ["溜めを読む", "**敵が**準備を始めた瞬間、RP1でその敵へ「隙」を1つ。", "準備"],
  break_the_charge: ["溜めを崩す", "**敵の**準備が進んだあと、RP1でその準備を叩き落とす。戦闘に1回きり。", "準備"],
  counter_order: ["差し込む号令", "敵が行動を宣言した瞬間、RP1でその敵へ「怯み」を1つ。潰さないぶん何度でも。", "標的"],
  stall_the_blow: ["出鼻を挫く", "敵が攻撃を宣言した瞬間、RP2でその行動そのものを消す。戦闘に1回きり。", "標的"],
  echo_of_the_mark: ["刻印の残響", "敵の「隙」が消えた瞬間、RP1で腕力50%。刈り取っても、自然に消えても起きる。", "状態"],
  stagger_relay: ["怯みを回す", "敵に「怯み」が付いた瞬間、RP1で最前の敵へも「怯み」を1つ。", "状態"],
  warded_into_edge: ["守勢を刃へ", "自分が「守勢」を受け取ったあと、RP1で「集中」を1つ。守られた者が刃になる。", "状態"],
  bleed_into_wake: ["裂傷の余波", "敵に「裂傷」が入った瞬間、RP1でその敵へ「隙」も1つ。細い傷を束ねる。", "状態"],
};

const equipmentMeta = {
  worn_greaves: ["踏み込みの靴", "ラウンド最初の発動後、行動権を1得る。", "速度", 2],
  splinter_edge: ["棘の刃", "余ったダメージが出ると、耐久1で10ダメージを追加。", "攻撃", 2],
  field_kit: ["野営道具", "余ったRPを使い、耐久1を修理する。", "修理", 2],
  standing_plate: ["継ぎはぎの盾", "戦闘開始時、戦闘中防壁20を得る。", "防御", 3],
  momentum_rig: ["勢いの留め具", "移動後、耐久1で「集中」を得る。", "機動", 2],
  hungry_plate: ["喰らう板", "戦闘開始時に耐久を使い、後続の摩耗を誘発する。", "消耗", 3],
  guard_lantern: ["守り火", "小さな防壁を長く維持する。", "防御", 2],
  bastion_shell: ["厚い継ぎ板", "戦闘開始時、防壁30。", "防御", 3],
  tempo_buckle: ["拍子の留め具", "ラウンド最初の発動後、行動権を得る。耐久1。", "速度", 1],
  quickstrap: ["軽い締め具", "発動後の行動権を狙う。耐久が高い。", "速度", 3],
  reserve_coil: ["予備のばね", "ラウンド最初の発動後、行動権を得る。", "速度", 4],
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
  foundation_focus: ["集中力", "術力が2増える。技術・治療・防壁の量が上がる。", "基礎"],
  foundation_guard: ["受け", "受けが1増える。一撃ごとの被害を減らす。", "基礎"],
  foundation_speed: ["速さ", "速度が1増える。速度順の対象選択に影響する。", "基礎"],
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

export const SKILL_TREE_NODES = Object.freeze([
  { id: "node_strike", skillId: "strike", kind: "active", branch: "攻撃", tier: 0, cost: 0, requires: [] },
  { id: "node_heavy", skillId: "heavy_swing", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_long", skillId: "long_swing", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["heavy_swing"] },
  { id: "node_hunt", skillId: "hunt_the_slow", kind: "active", branch: "攻撃", tier: 2, cost: 2, requires: ["heavy_swing"] },
  { id: "node_relay", skillId: "relay_order", kind: "active", branch: "指揮", tier: 0, cost: 0, requires: [] },
  // R16 — 前提を baseline へ移した。**reposition は pack_wall、relay_order は pack_tempo** なので、
  // pack_wall が入って pack_tempo がまだ来ていない Stage 2 では、画面に出たまま永久に解禁できなかった
  // （analysis/ecology-skill-catalog-smoke.mjs が検出）。R9 §9.2「前提は各 pack の入口技能に置く」。
  { id: "node_reposition", skillId: "reposition", kind: "active", branch: "指揮", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_mark", skillId: "mark_target", kind: "active", branch: "指揮", tier: 2, cost: 1, requires: ["reposition"] },
  { id: "node_aim", skillId: "steady_aim", kind: "active", branch: "指揮", tier: 2, cost: 2, requires: ["mark_target"] },
  // R8 Implementation Phase 1（続き）— mend/triage は reactive（damage_taken に
  // 反応する応急処置）へ作り替えた。kind だけを直し、tier・requires は変えない。
  { id: "node_mend", skillId: "mend", kind: "reactive", branch: "支援", tier: 0, cost: 0, requires: [] },
  { id: "node_triage", skillId: "triage", kind: "reactive", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_emergency_treatment", skillId: "emergency_treatment", kind: "reactive", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_idle", skillId: "idle_shuffle", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_bulwark", skillId: "bulwark", kind: "active", branch: "守り", tier: 0, cost: 0, requires: [] },
  { id: "node_steady_cut", skillId: "steady_cut", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_aimed_shot", skillId: "aimed_shot", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_counter", skillId: "counter_blow", kind: "reactive", branch: "攻撃", tier: 0, cost: 1, requires: ["strike"] },
  { id: "node_echo", skillId: "damage_echo", kind: "reactive", branch: "攻撃", tier: 1, cost: 2, requires: ["counter_blow"] },
  { id: "node_scavenge", skillId: "scavenge_ap", kind: "reactive", branch: "指揮", tier: 0, cost: 1, requires: ["strike"] },
  { id: "node_step", skillId: "guard_step", kind: "reactive", branch: "指揮", tier: 1, cost: 1, requires: ["scavenge_ap"] },
  { id: "node_cover", skillId: "cover_ally", kind: "reactive", branch: "守り", tier: 0, cost: 1, requires: ["bulwark"] },
  // R16 — 同じ理由で baseline へ。**brace_after_hit は pack_care、cover_ally は pack_wall** なので、
  // Stage 0・1 では前提が来ていなかった。
  { id: "node_brace", skillId: "brace_after_hit", kind: "reactive", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
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
  // R16 — 同じ理由で baseline へ。**rear_hunt は pack_edge の core、guard_crush は full** なので、
  // pack_edge が core で入る Stage 1 では前提が来ていなかった。
  { id: "node_rear_hunt", skillId: "rear_hunt", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["strike"] },
  { id: "node_finishing", skillId: "finishing_thrust", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["strike"] },
  { id: "node_crack_mark", skillId: "crack_mark", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_brace_impact", skillId: "brace_for_impact", kind: "active", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  // R8 §5.4（続き）— pack_barrage の probe content。
  { id: "node_barrage", skillId: "barrage_strike", kind: "active", branch: "攻撃", tier: 0, cost: 1, requires: [] },
  { id: "node_mark_strike", skillId: "mark_strike", kind: "active", branch: "攻撃", tier: 0, cost: 1, requires: [] },
  { id: "node_mark_break", skillId: "mark_break", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["mark_strike"] },
  { id: "node_sweeping_barrage", skillId: "sweeping_barrage", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["barrage_strike"] },
  { id: "node_piercing_barrage", skillId: "piercing_barrage", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["barrage_strike"] },
  { id: "node_guarded_opening", skillId: "guarded_opening", kind: "reactive", branch: "攻撃", tier: 1, cost: 1, requires: ["mark_strike"] },
  { id: "node_seize_the_opening", skillId: "seize_the_opening", kind: "reactive", branch: "攻撃", tier: 1, cost: 1, requires: ["mark_strike"] },
  // R6 §6.8 — 基礎訓練。**前提を持たない**ので、どの人物もいつでも取れる。
  { id: "node_found_vitality", skillId: "foundation_vitality", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_might", skillId: "foundation_might", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_focus", skillId: "foundation_focus", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_guard", skillId: "foundation_guard", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_speed", skillId: "foundation_speed", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_ap", skillId: "foundation_ap", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_found_rp", skillId: "foundation_rp", kind: "passive", branch: "基礎", tier: 0, cost: 1, requires: [] },
  { id: "node_opening_guard", skillId: "opening_guard", kind: "passive", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  // R9 §4.1 / §9.2 — 導入 pack の接続面と常設。
  // **前提は各 pack の入口技能に置く**（別 pack を経由しないと届かない形にしない）。
  { id: "node_whetted", skillId: "whetted_by_pain", kind: "reactive", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_first_blood", skillId: "first_blood", kind: "passive", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_shield_handoff", skillId: "shield_handoff", kind: "reactive", branch: "守り", tier: 1, cost: 1, requires: ["cover_ally"] },
  { id: "node_patient_step", skillId: "patient_step", kind: "reactive", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  { id: "node_held_breath", skillId: "held_breath", kind: "passive", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  { id: "node_shield_wounded", skillId: "shield_the_wounded", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_steady_hands", skillId: "steady_hands", kind: "passive", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  // R9 §5 — 横断pack「余波と受け渡し」。**前提を baseline の入口へ置く**ので、
  // どの人物でも、別 pack を経由せずに一つ目の変換へ届く（R9 §5.1）。
  { id: "node_hand_off", skillId: "hand_off", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_overreach", skillId: "overreach", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_spill_forward", skillId: "spill_forward", kind: "reactive", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_wake_reader", skillId: "wake_reader", kind: "passive", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_blocked_into_step", skillId: "blocked_into_step", kind: "reactive", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_wake_of_the_fallen", skillId: "wake_of_the_fallen", kind: "reactive", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_mercy_into_guard", skillId: "mercy_into_guard", kind: "reactive", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_readied_relay", skillId: "readied_relay", kind: "reactive", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  { id: "node_stride_into_reach", skillId: "stride_into_reach", kind: "reactive", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  // ---------------------------------------------------------------- R16 — 大量追加の節
  //
  // **前提は各 pack の入口技能に置く**（別 pack を経由しないと届かない形にしない）。
  // baseline の strike / bulwark / mend と、その pack の core 技能だけを前提にする。
  // 深いものだけ、同じ pack の中で一段の連なりを作ってある。
  //
  // 刃と撃破（pack_edge）→ 攻撃系統
  { id: "node_hamstring", skillId: "hamstring", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_rend", skillId: "rend", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["hamstring"] },
  { id: "node_double_back", skillId: "double_back", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_spread_cut", skillId: "spread_cut", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_opening_stab", skillId: "opening_stab", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_bloodied_charge", skillId: "bloodied_charge", kind: "active", branch: "攻撃", tier: 2, cost: 1, requires: ["strike"] },
  { id: "node_reckless_swing", skillId: "reckless_swing", kind: "active", branch: "攻撃", tier: 2, cost: 2, requires: ["strike"] },
  { id: "node_execute_low", skillId: "execute_low", kind: "active", branch: "攻撃", tier: 2, cost: 2, requires: ["finishing_thrust"] },
  { id: "node_opportunist", skillId: "opportunist", kind: "reactive", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  { id: "node_vengeful_step", skillId: "vengeful_step", kind: "reactive", branch: "攻撃", tier: 2, cost: 1, requires: ["counter_blow"] },
  { id: "node_finish_the_wounded", skillId: "finish_the_wounded", kind: "reactive", branch: "攻撃", tier: 2, cost: 1, requires: ["strike"] },
  { id: "node_edge_honed", skillId: "edge_honed", kind: "passive", branch: "攻撃", tier: 1, cost: 1, requires: ["strike"] },
  // 防壁と隊列（pack_wall）→ 守り系統
  { id: "node_drag_forward", skillId: "drag_forward", kind: "active", branch: "守り", tier: 2, cost: 2, requires: ["reposition"] },
  { id: "node_shield_wall", skillId: "shield_wall", kind: "active", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_rally_line", skillId: "rally_line", kind: "active", branch: "守り", tier: 2, cost: 1, requires: ["reposition"] },
  { id: "node_bulwark_of_will", skillId: "bulwark_of_will", kind: "active", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_spread_the_guard", skillId: "spread_the_guard", kind: "active", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_bracing_thrust", skillId: "bracing_thrust", kind: "active", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_absorb_shock", skillId: "absorb_shock", kind: "reactive", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  { id: "node_guard_the_marked", skillId: "guard_the_marked", kind: "reactive", branch: "守り", tier: 2, cost: 1, requires: ["cover_ally"] },
  { id: "node_last_stand", skillId: "last_stand", kind: "reactive", branch: "守り", tier: 2, cost: 2, requires: ["bulwark"] },
  { id: "node_counterweight", skillId: "counterweight", kind: "reactive", branch: "守り", tier: 2, cost: 1, requires: ["guard_step"] },
  { id: "node_wall_reader", skillId: "wall_reader", kind: "passive", branch: "守り", tier: 1, cost: 1, requires: ["bulwark"] },
  // 構えと手当て（pack_care）→ 支援系統
  { id: "node_field_dressing", skillId: "field_dressing", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_steady_breath", skillId: "steady_breath", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_ward_ally", skillId: "ward_ally", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_precise_cut", skillId: "precise_cut", kind: "active", branch: "支援", tier: 2, cost: 1, requires: ["aimed_shot"] },
  { id: "node_sustaining_ward", skillId: "sustaining_ward", kind: "active", branch: "支援", tier: 2, cost: 1, requires: ["ward_ally"] },
  { id: "node_cleansing_step", skillId: "cleansing_step", kind: "active", branch: "支援", tier: 2, cost: 1, requires: ["ward_ally"] },
  { id: "node_shared_pain", skillId: "shared_pain", kind: "reactive", branch: "支援", tier: 2, cost: 2, requires: ["triage"] },
  { id: "node_watchful_care", skillId: "watchful_care", kind: "reactive", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_steady_under_fire", skillId: "steady_under_fire", kind: "reactive", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_second_wind", skillId: "second_wind", kind: "reactive", branch: "支援", tier: 2, cost: 1, requires: ["overflow_care"] },
  { id: "node_patient_hands", skillId: "patient_hands", kind: "passive", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  // 行動権と準備（pack_tempo）→ 指揮系統
  { id: "node_hasten_ally", skillId: "hasten_ally", kind: "active", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  { id: "node_call_the_slow", skillId: "call_the_slow", kind: "active", branch: "指揮", tier: 2, cost: 1, requires: ["relay_order"] },
  { id: "node_feint", skillId: "feint", kind: "active", branch: "指揮", tier: 2, cost: 1, requires: ["mark_target"] },
  { id: "node_set_the_pace", skillId: "set_the_pace", kind: "active", branch: "指揮", tier: 2, cost: 1, requires: ["steady_aim"] },
  { id: "node_read_the_charge", skillId: "read_the_charge", kind: "reactive", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  { id: "node_break_the_charge", skillId: "break_the_charge", kind: "reactive", branch: "指揮", tier: 2, cost: 2, requires: ["read_the_charge"] },
  { id: "node_counter_order", skillId: "counter_order", kind: "reactive", branch: "指揮", tier: 2, cost: 1, requires: ["relay_order"] },
  { id: "node_stall_the_blow", skillId: "stall_the_blow", kind: "reactive", branch: "指揮", tier: 2, cost: 2, requires: ["counter_order"] },
  { id: "node_first_order", skillId: "first_order", kind: "passive", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  // 連撃と刻印（pack_barrage）→ 攻撃系統
  { id: "node_flurry_finish", skillId: "flurry_finish", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["barrage_strike"] },
  { id: "node_mark_spread", skillId: "mark_spread", kind: "active", branch: "攻撃", tier: 1, cost: 1, requires: ["mark_strike"] },
  { id: "node_shatter_point", skillId: "shatter_point", kind: "active", branch: "攻撃", tier: 2, cost: 2, requires: ["mark_break"] },
  { id: "node_echo_of_the_mark", skillId: "echo_of_the_mark", kind: "reactive", branch: "攻撃", tier: 2, cost: 1, requires: ["mark_strike"] },
  { id: "node_mark_reader", skillId: "mark_reader", kind: "passive", branch: "攻撃", tier: 1, cost: 1, requires: ["mark_strike"] },
  // 余波と受け渡し（pack_relay）→ 出す先の役割に合わせて系統を散らす
  { id: "node_take_the_wound", skillId: "take_the_wound", kind: "active", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
  { id: "node_pass_the_edge", skillId: "pass_the_edge", kind: "active", branch: "指揮", tier: 1, cost: 1, requires: ["relay_order"] },
  { id: "node_stagger_relay", skillId: "stagger_relay", kind: "reactive", branch: "指揮", tier: 2, cost: 1, requires: ["relay_order"] },
  { id: "node_warded_into_edge", skillId: "warded_into_edge", kind: "reactive", branch: "守り", tier: 2, cost: 1, requires: ["bulwark"] },
  { id: "node_bleed_into_wake", skillId: "bleed_into_wake", kind: "reactive", branch: "攻撃", tier: 2, cost: 1, requires: ["strike"] },
  { id: "node_relay_reader", skillId: "relay_reader", kind: "passive", branch: "支援", tier: 1, cost: 1, requires: ["mend"] },
]);
