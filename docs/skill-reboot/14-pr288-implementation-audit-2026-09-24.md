# PR #288 — PR #287 全190技能 実装監査台帳

更新日: 2026-09-24。正本は [武器カタログ](./11-weapon-catalog.md)。技能の順序はカタログの10武器×19節に合わせる。

## 監査手順

1. カタログの各節の実装契約・効果表示・種別・位置を読む。表示名の一致だけでは完了にしない。
2. PR #288の該当skill IDをregistryから各weapon moduleへ追い、対象、trigger/window、費用、回数/上限、状態段数、hit/防御/移動/準備の順序を契約と照合する。
3. 複数hit・複数対象・武器をまたぐ契約は、共有イベント/効果の実行経路とテストを追う。動作検証欄は該当するテストまたは再現ケースが通った後だけチェックする。
4. 不一致が共有層にあれば先に戻って直し、その層に依存する確認済み技能を再監査してチェックを戻す。
5. 3欄すべての根拠が揃った節だけ完了とする。最終commit前にカタログ順でもう一周する。

## 共有層の変更・再監査記録

| checkpoint | 変更 | 再監査対象 | 状態 |
|---|---|---|---|
| 初回 | PR #288 head d8f48aa のtreeから開始。全190件をカタログ順に照合する。 | 全190件 | 進行中 |
| 1 | 戦槌の副対象追加を能力値基準へ修正。防御崩しの連鎖上限と、砕け音による同hit窓の再開を修正。 | 戦槌 AB1, AB2, BA1, BA2 と、後続で同じ共有窓を使う全節 | 再監査中 |
| 2 | 戦槌のA2をhit解決イベントで判定。B1に受け構えの有無ソートを追加。BB2の攻撃限定スナップショット・消費を修正。 | 戦槌1–19 | 再監査完了 |
| 3 | 格闘具の全19節を再照合し、追撃・防御吸収時の連携・拳順の対象連結を動作テストで確認。 | 格闘具20–38 | 再監査完了 |
| 4 | 射出器向けに技能効果／準備優先ターゲット選択、基準対象条件の選択時スナップショット、攻撃対象状態の消費・予約例外、陣営一意マーカー、露呈の共有ダメージ補正を追加。最寄り対象順に合わせprologue専用の敵配置・係数を調整。射出器19節をカタログ順に実装と照合。 | 戦槌1–19、格闘具20–38、射出器39–57 | 再監査完了 |

## 個別技能一覧

### 1. 戦槌（warhammer）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 1 | R | 槌打ち | warhammer_blow | ☑ | ☑ | ☑ |
| 2 | A1 | 重い頭 | warhammer_heavy_head | ☑ | ☑ | ☑ |
| 3 | A2 | 響く鉄 | warhammer_ringing_iron | ☑ | ☑ | ☑ |
| 4 | A3 | 大槌打ち | warhammer_heavy_blow | ☑ | ☑ | ☑ |
| 5 | AA1 | 鉄塊 | warhammer_iron_mass | ☑ | ☑ | ☑ |
| 6 | AA2 | 深い衝撃 | warhammer_deep_impact | ☑ | ☑ | ☑ |
| 7 | AA3 | 震天打ち | warhammer_heaven_blow | ☑ | ☑ | ☑ |
| 8 | AB1 | 振り幅 | warhammer_wide_swing | ☑ | ☑ | ☑ |
| 9 | AB2 | 横薙ぎ | warhammer_sweep | ☑ | ☑ | ☑ |
| 10 | AB3 | 地割り | warhammer_earth_splitter | ☑ | ☑ | ☑ |
| 11 | B1 | 鎧を指す | warhammer_point_at_armor | ☑ | ☑ | ☑ |
| 12 | B2 | 打ち返し | warhammer_break_point | ☑ | ☑ | ☑ |
| 13 | B3 | 破城打ち | warhammer_siege_blow | ☑ | ☑ | ☑ |
| 14 | BA1 | 砕けた鎧 | warhammer_broken_armor | ☑ | ☑ | ☑ |
| 15 | BA2 | 砕け音 | warhammer_breaking_sound | ☑ | ☑ | ☑ |
| 16 | BA3 | 解体槌 | warhammer_dismantler | ☑ | ☑ | ☑ |
| 17 | BB1 | 戦利の破片 | warhammer_trophy_fragment | ☑ | ☑ | ☑ |
| 18 | BB2 | 逆鍛造 | warhammer_reverse_forging | ☑ | ☑ | ☑ |
| 19 | BB3 | 王殺し | warhammer_kingslayer | ☑ | ☑ | ☑ |

### 2. 格闘具（gauntlets）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 20 | R | 正拳 | gauntlets_punch | ☑ | ☑ | ☑ |
| 21 | A1 | 握り込み | gauntlets_grip | ☑ | ☑ | ☑ |
| 22 | A2 | 追い拳 | gauntlets_chasing_fist | ☑ | ☑ | ☑ |
| 23 | A3 | 二連拳 | gauntlets_double_punch | ☑ | ☑ | ☑ |
| 24 | AA1 | 連打 | gauntlets_combo_fists | ☑ | ☑ | ☑ |
| 25 | AA2 | 拳圧 | gauntlets_pressure | ☑ | ☑ | ☑ |
| 26 | AA3 | 百裂 | gauntlets_hundred_fists | ☑ | ☑ | ☑ |
| 27 | AB1 | 流し身 | gauntlets_knuckle_guard | ☑ | ☑ | ☑ |
| 28 | AB2 | 打って守る | gauntlets_strike_guard | ☑ | ☑ | ☑ |
| 29 | AB3 | 鉄身打ち | gauntlets_iron_body | ☑ | ☑ | ☑ |
| 30 | B1 | 目を離さない | gauntlets_watch_target | ☑ | ☑ | ☑ |
| 31 | B2 | 拳順 | gauntlets_streak | ☑ | ☑ | ☑ |
| 32 | B3 | 畳み掛け | gauntlets_barrage | ☑ | ☑ | ☑ |
| 33 | BA1 | 歩法 | gauntlets_footwork | ☑ | ☑ | ☑ |
| 34 | BA2 | 空いた懐 | gauntlets_empty_pocket | ☑ | ☑ | ☑ |
| 35 | BA3 | 飛び込み膝 | gauntlets_flying_knee | ☑ | ☑ | ☑ |
| 36 | BB1 | 見取り | gauntlets_form_record | ☑ | ☑ | ☑ |
| 37 | BB2 | 重ね構え | gauntlets_borrowed_stance | ☑ | ☑ | ☑ |
| 38 | BB3 | 無手 | gauntlets_empty_hand | ☑ | ☑ | ☑ |

### 3. 射出器（launcher）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 39 | R | 射出 | launcher_shot | ☑ | ☑ | ☑ |
| 40 | A1 | 高圧筒 | launcher_high_pressure | ☑ | ☑ | ☑ |
| 41 | A2 | 穿孔針 | launcher_piercing_needle | ☑ | ☑ | ☑ |
| 42 | A3 | 大口径射出 | launcher_large_shot | ☑ | ☑ | ☑ |
| 43 | AA1 | 圧縮薬 | launcher_compressed_charge | ☑ | ☑ | ☑ |
| 44 | AA2 | 硬芯 | launcher_hard_core | ☑ | ☑ | ☑ |
| 45 | AA3 | 穿城射 | launcher_siege_shot | ☑ | ☑ | ☑ |
| 46 | AB1 | 連装筒 | launcher_multi_barrel | ☑ | ☑ | ☑ |
| 47 | AB2 | 援護弾 | launcher_support_shell | ☑ | ☑ | ☑ |
| 48 | AB3 | 二連射 | launcher_double_shot | ☑ | ☑ | ☑ |
| 49 | B1 | 医療役を抜く | launcher_pull_healer | ☑ | ☑ | ☑ |
| 50 | B2 | 準備を抜く | launcher_skip_preparation | ☑ | ☑ | ☑ |
| 51 | B3 | 指定射 | launcher_designated_shot | ☑ | ☑ | ☑ |
| 52 | BA1 | 観測孔 | launcher_observation_hole | ☑ | ☑ | ☑ |
| 53 | BA2 | 測距 | launcher_rangefinder | ☑ | ☑ | ☑ |
| 54 | BA3 | 一斉照準 | launcher_volley_aim | ☑ | ☑ | ☑ |
| 55 | BB1 | 弱点標 | launcher_order_table | ☑ | ☑ | ☑ |
| 56 | BB2 | 合点射 | launcher_order_check | ☑ | ☑ | ☑ |
| 57 | BB3 | 一点集中射 | launcher_three_point | ☑ | ☑ | ☑ |

### 4. 医療具（medical_kit）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 58 | R | 応急防壁 | medical_kit_treatment | ☐ | ☐ | ☐ |
| 59 | A1 | 応急手当 | medical_kit_clean_tools | ☐ | ☐ | ☐ |
| 60 | A2 | 回復の手際 | medical_kit_wash | ☐ | ☐ | ☐ |
| 61 | A3 | 救護防壁 | medical_kit_major_treatment | ☐ | ☐ | ☐ |
| 62 | AA1 | 急所を診る | medical_kit_stimulant_protocol | ☐ | ☐ | ☐ |
| 63 | AA2 | 連携治療 | medical_kit_surplus_bandage | ☐ | ☐ | ☐ |
| 64 | AA3 | 救命防壁 | medical_kit_full_procedure | ☐ | ☐ | ☐ |
| 65 | AB1 | 早期手当 | medical_kit_wide_spray | ☐ | ☐ | ☐ |
| 66 | AB2 | 合併症対応 | medical_kit_equal_dose | ☐ | ☐ | ☐ |
| 67 | AB3 | 野戦処置 | medical_kit_field_treatment | ☐ | ☐ | ☐ |
| 68 | B1 | 危険域 | medical_kit_danger_zone | ☐ | ☐ | ☐ |
| 69 | B2 | 緊急蘇生 | medical_kit_emergency_revive | ☐ | ☐ | ☐ |
| 70 | B3 | 戦列防壁 | medical_kit_transfusion | ☐ | ☐ | ☐ |
| 71 | BA1 | 広域化 | medical_kit_active_agent | ☐ | ☐ | ☐ |
| 72 | BA2 | 重ね包帯 | medical_kit_regenerative_drug | ☐ | ☐ | ☐ |
| 73 | BA3 | 野戦防壁 | medical_kit_regenerative_procedure | ☐ | ☐ | ☐ |
| 74 | BB1 | 血へ還す | medical_kit_reserve_blood_protocol | ☐ | ☐ | ☐ |
| 75 | BB2 | 戦後治療 | medical_kit_life_collateral | ☐ | ☐ | ☐ |
| 76 | BB3 | 終療防壁 | medical_kit_time_surgery | ☐ | ☐ | ☐ |

### 5. 大盾（tower_shield）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 77 | R | 守りを引く | tower_shield_draw_guard | ☐ | ☐ | ☐ |
| 78 | A1 | 厚板 | tower_shield_thick_plate | ☐ | ☐ | ☐ |
| 79 | A2 | 痛みの肩代わり | tower_shield_visible | ☐ | ☐ | ☐ |
| 80 | A3 | 堅守 | tower_shield_hold_fast | ☐ | ☐ | ☐ |
| 81 | AA1 | 衝撃吸収 | tower_shield_shock_absorption | ☐ | ☐ | ☐ |
| 82 | AA2 | 城壁骨格 | tower_shield_wall_frame | ☐ | ☐ | ☐ |
| 83 | AA3 | 城門 | tower_shield_gate | ☐ | ☐ | ☐ |
| 84 | AB1 | 横板 | tower_shield_side_plate | ☐ | ☐ | ☐ |
| 85 | AB2 | 盾の列 | tower_shield_line | ☐ | ☐ | ☐ |
| 86 | AB3 | 防護線 | tower_shield_line_guard | ☐ | ☐ | ☐ |
| 87 | B1 | 引き受け役 | tower_shield_take_role | ☐ | ☐ | ☐ |
| 88 | B2 | 盾を差す | tower_shield_interpose | ☐ | ☐ | ☐ |
| 89 | B3 | 盾撃 | tower_shield_bash | ☐ | ☐ | ☐ |
| 90 | BA1 | 守り分け | tower_shield_spread_guard | ☐ | ☐ | ☐ |
| 91 | BA2 | 持ち直す | tower_shield_relief_voice | ☐ | ☐ | ☐ |
| 92 | BA3 | 聖域 | tower_shield_sanctuary | ☐ | ☐ | ☐ |
| 93 | BB1 | 反響膜 | tower_shield_mirror_film | ☐ | ☐ | ☐ |
| 94 | BB2 | 盾の奥 | tower_shield_turn_back | ☐ | ☐ | ☐ |
| 95 | BB3 | 城壁の返礼 | tower_shield_mirror_castle | ☐ | ☐ | ☐ |

### 6. 長槍（long_spear）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 96 | R | 貫き突き | long_spear_pierce | ☐ | ☐ | ☐ |
| 97 | A1 | 遠間の読み | long_spear_long_shaft | ☐ | ☐ | ☐ |
| 98 | A2 | 鎧抜き | long_spear_armor_pierce | ☐ | ☐ | ☐ |
| 99 | A3 | 深突き | long_spear_deep_thrust | ☐ | ☐ | ☐ |
| 100 | AA1 | 遠間の圧 | long_spear_butt_end | ☐ | ☐ | ☐ |
| 101 | AA2 | 貫通 | long_spear_penetration | ☐ | ☐ | ☐ |
| 102 | AA3 | 天穿ち | long_spear_sky_pierce | ☐ | ☐ | ☐ |
| 103 | AB1 | 二段突き | long_spear_double_thrust | ☐ | ☐ | ☐ |
| 104 | AB2 | 縫い留め | long_spear_pin | ☐ | ☐ | ☐ |
| 105 | AB3 | 串刺し | long_spear_impale | ☐ | ☐ | ☐ |
| 106 | B1 | 構えを刺す | long_spear_ready_target | ☐ | ☐ | ☐ |
| 107 | B2 | 迎え槍 | long_spear_first_mover | ☐ | ☐ | ☐ |
| 108 | B3 | 先制突き | long_spear_first_thrust | ☐ | ☐ | ☐ |
| 109 | BA1 | 足を止める | long_spear_foot_stop | ☐ | ☐ | ☐ |
| 110 | BA2 | 横槍 | long_spear_cross_thrust | ☐ | ☐ | ☐ |
| 111 | BA3 | 関所 | long_spear_checkpoint | ☐ | ☐ | ☐ |
| 112 | BB1 | 遅延標 | long_spear_order_mark | ☐ | ☐ | ☐ |
| 113 | BB2 | 迎え返し | long_spear_interrupt | ☐ | ☐ | ☐ |
| 114 | BB3 | 時穿ち | long_spear_time_thrust | ☐ | ☐ | ☐ |

### 7. 鉤縄（grappling_hook）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 115 | R | 引き打ち | grappling_hook_pull | ☐ | ☐ | ☐ |
| 116 | A1 | 鉄鉤 | grappling_hook_iron_hook | ☐ | ☐ | ☐ |
| 117 | A2 | 長縄 | grappling_hook_long_rope | ☐ | ☐ | ☐ |
| 118 | A3 | 強引き | grappling_hook_strong_pull | ☐ | ☐ | ☐ |
| 119 | AA1 | 巻き上げ | grappling_hook_winch | ☐ | ☐ | ☐ |
| 120 | AA2 | 壁打ち | grappling_hook_wall_strike | ☐ | ☐ | ☐ |
| 121 | AA3 | 捕縛 | grappling_hook_capture | ☐ | ☐ | ☐ |
| 122 | AB1 | 救助索 | grappling_hook_rescue_line | ☐ | ☐ | ☐ |
| 123 | AB2 | 引き上げ | grappling_hook_raise | ☐ | ☐ | ☐ |
| 124 | AB3 | 救出 | grappling_hook_rescue | ☐ | ☐ | ☐ |
| 125 | B1 | 崩し足 | grappling_hook_break_step | ☐ | ☐ | ☐ |
| 126 | B2 | 引き戻し | grappling_hook_run_signal | ☐ | ☐ | ☐ |
| 127 | B3 | 投げ縄 | grappling_hook_throw_lasso | ☐ | ☐ | ☐ |
| 128 | BA1 | 壁崩し | grappling_hook_movement_marks | ☐ | ☐ | ☐ |
| 129 | BA2 | 釣り出し | grappling_hook_mark_step | ☐ | ☐ | ☐ |
| 130 | BA3 | 壁抜き | grappling_hook_net_field | ☐ | ☐ | ☐ |
| 131 | BB1 | 連動縄 | grappling_hook_two_point_anchor | ☐ | ☐ | ☐ |
| 132 | BB2 | 返し縄 | grappling_hook_rope_return | ☐ | ☐ | ☐ |
| 133 | BB3 | 大捕縛 | grappling_hook_total_swap | ☐ | ☐ | ☐ |

### 8. 双刃（dual_blades）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 134 | R | 二連斬り | dual_blades_two_cut | ☐ | ☐ | ☐ |
| 135 | A1 | 研ぎ分け | dual_blades_split_sharpening | ☐ | ☐ | ☐ |
| 136 | A2 | 駆け込み | dual_blades_dash_in | ☐ | ☐ | ☐ |
| 137 | A3 | 三連斬り | dual_blades_three_cut | ☐ | ☐ | ☐ |
| 138 | AA1 | 手数 | dual_blades_more_hands | ☐ | ☐ | ☐ |
| 139 | AA2 | 引き足 | dual_blades_retreat | ☐ | ☐ | ☐ |
| 140 | AA3 | 六花 | dual_blades_six_petals | ☐ | ☐ | ☐ |
| 141 | AB1 | 刃渡し | dual_blades_edge_pass | ☐ | ☐ | ☐ |
| 142 | AB2 | 無駄なし | dual_blades_no_waste | ☐ | ☐ | ☐ |
| 143 | AB3 | 舞い斬り | dual_blades_dancing_cut | ☐ | ☐ | ☐ |
| 144 | B1 | 裂き傷 | dual_blades_lacerating_edge | ☐ | ☐ | ☐ |
| 145 | B2 | 血を追う | dual_blades_blood_scent | ☐ | ☐ | ☐ |
| 146 | B3 | 傷刻み | dual_blades_wound_mark | ☐ | ☐ | ☐ |
| 147 | BA1 | 傷口拡大 | dual_blades_wound_expansion | ☐ | ☐ | ☐ |
| 148 | BA2 | 返り刃 | dual_blades_blood_spray | ☐ | ☐ | ☐ |
| 149 | BA3 | 血路 | dual_blades_blood_path | ☐ | ☐ | ☐ |
| 150 | BB1 | 刃の予約 | dual_blades_blade_reservation | ☐ | ☐ | ☐ |
| 151 | BB2 | 差し刃 | dual_blades_insert_blade | ☐ | ☐ | ☐ |
| 152 | BB3 | 千客万来 | dual_blades_many_guests | ☐ | ☐ | ☐ |

### 9. 号旗（banner）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 153 | R | 号令 | banner_command | ☐ | ☐ | ☐ |
| 154 | A1 | 声を通す | banner_clear_voice | ☐ | ☐ | ☐ |
| 155 | A2 | 息を合わせる | banner_breathe_together | ☐ | ☐ | ☐ |
| 156 | A3 | 進め | banner_advance | ☐ | ☐ | ☐ |
| 157 | AA1 | 大号令 | banner_great_command | ☐ | ☐ | ☐ |
| 158 | AA2 | 二拍先 | banner_two_beats | ☐ | ☐ | ☐ |
| 159 | AA3 | 総進撃 | banner_total_assault | ☐ | ☐ | ☐ |
| 160 | AB1 | 遺志の号令 | banner_line_delivery | ☐ | ☐ | ☐ |
| 161 | AB2 | 揃い足 | banner_synced_steps | ☐ | ☐ | ☐ |
| 162 | AB3 | 列進 | banner_line_advance | ☐ | ☐ | ☐ |
| 163 | B1 | 次は誰だ | banner_next_target | ☐ | ☐ | ☐ |
| 164 | B2 | 背を押す | banner_push_forward | ☐ | ☐ | ☐ |
| 165 | B3 | 急かす | banner_hurry | ☐ | ☐ | ☐ |
| 166 | BA1 | 借り札 | banner_debt_token | ☐ | ☐ | ☐ |
| 167 | BA2 | 返済猶予 | banner_debt_grace | ☐ | ☐ | ☐ |
| 168 | BA3 | 前借り命令 | banner_borrowed_command | ☐ | ☐ | ☐ |
| 169 | BB1 | 持久旗 | banner_hourglass | ☐ | ☐ | ☐ |
| 170 | BB2 | 旗の守り | banner_buy_second | ☐ | ☐ | ☐ |
| 171 | BB3 | 勝旗 | banner_last_command | ☐ | ☐ | ☐ |

### 10. 重弩（heavy_crossbow）

| # | 位置 | PR #287 名称 | PR #288 skill ID | 仕様照合 | 実装照合 | 動作検証 |
|---:|---|---|---|---|---|---|
| 172 | R | 装填射 | heavy_crossbow_loaded_shot | ☐ | ☐ | ☐ |
| 173 | A1 | 強弦 | heavy_crossbow_strong_string | ☐ | ☐ | ☐ |
| 174 | A2 | 徹甲矢 | heavy_crossbow_armor_piercing | ☐ | ☐ | ☐ |
| 175 | A3 | 重装填射 | heavy_crossbow_heavy_loaded_shot | ☐ | ☐ | ☐ |
| 176 | AA1 | 極太矢 | heavy_crossbow_thick_bolt | ☐ | ☐ | ☐ |
| 177 | AA2 | 城抜き | heavy_crossbow_siege_piercer | ☐ | ☐ | ☐ |
| 178 | AA3 | 城砕き | heavy_crossbow_siege_breaker | ☐ | ☐ | ☐ |
| 179 | AB1 | 炸裂筒 | heavy_crossbow_explosive_canister | ☐ | ☐ | ☐ |
| 180 | AB2 | 爆圧 | heavy_crossbow_blast_pressure | ☐ | ☐ | ☐ |
| 181 | AB3 | 破裂矢 | heavy_crossbow_burst_bolt | ☐ | ☐ | ☐ |
| 182 | B1 | 大物を狙う | heavy_crossbow_large_game | ☐ | ☐ | ☐ |
| 183 | B2 | 迎撃照準 | heavy_crossbow_loading_hold | ☐ | ☐ | ☐ |
| 184 | B3 | 強装填 | heavy_crossbow_reserved_shot | ☐ | ☐ | ☐ |
| 185 | BA1 | 準備射撃 | heavy_crossbow_impact_mark | ☐ | ☐ | ☐ |
| 186 | BA2 | 引き絞り | heavy_crossbow_trigger_detonation | ☐ | ☐ | ☐ |
| 187 | BA3 | 大装填 | heavy_crossbow_timed_bolt | ☐ | ☐ | ☐ |
| 188 | BB1 | 次弾装填 | heavy_crossbow_next_ammo | ☐ | ☐ | ☐ |
| 189 | BB2 | 速射準備 | heavy_crossbow_future_shot | ☐ | ☐ | ☐ |
| 190 | BB3 | 極限装填 | heavy_crossbow_three_time_shot | ☐ | ☐ | ☐ |
