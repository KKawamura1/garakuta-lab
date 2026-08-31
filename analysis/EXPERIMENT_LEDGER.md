# EXP-18 判断台帳

更新日: 2026-08-31（UTC）

現在の作業対象は EXP-18 の「灰の遠征」です。過去の独立ゲームの結果を、現行本編の入口や作業キューとして扱いません。

## 判断の流れ

| 記録 | 判断 |
|---|---|
| R1 | ルールエンジンの教材となる frontier を作る |
| R2 | 仕組み先行の大きな system ではなく、人物と具体的な選択を中心に置く |
| R3 | 永続する人物を愛着の主語にし、技能・装備を交換可能にする |
| R4 | 小さな rule がイベントと状態を介して創発的に連鎖する構造を採用 |
| R5 | 決定的な ecology engine、validator、停止性・拡張性検査を実装 |
| R6 | 3幕12戦、Profile/Run 分離、有限補給、長期 loot の設計を固定 |
| R7 | system と content を段階的に実装し、各段階で作者評価を挟む順序を固定 |
| R8 | 難易度 rank ではなく Campaign Stage を本編の進行軸にし、pack、損耗、exact preview を統合 |

R1〜R7 は判断履歴です。現在の設計を読むときは R8 と analysis/CURRENT.md を先に読みます。

## 実装状況

- A5: ecology の engine と基礎検査
- A6: battle replay と画面表示
- A7/A8: Phase A の契約と実装
- A9: Phase B の遠征、経済、Profile/Run
- R8 Phase 0/1/2: Campaign Stage、損耗、anti-stall、pack_barrage probe

## 現在の関門

R8 の Campaign Stage 0〜3 は動く形になっています。次は作者評価です。自動検査の pass、12戦の決着、D1 保存は、面白さの判定ではありません。

## 詳細

設計正本: analysis/experiments/exp-18/R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md

実装結果と判断の証拠: analysis/experiments/exp-18/ 以下

旧プロトタイプ、旧分析、旧運用資料は現行ブランチから整理しました。必要なら Git 履歴で当時の状態を復元します。
