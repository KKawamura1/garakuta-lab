# 灰の遠征 — リポジトリ・インデックス

このリポジトリの現行実装と、EXP-18 の判断記録を案内します。

| 目的 | 読む場所 |
|---|---|
| 現在のルールと作業方針 | AGENTS.md → PROJECT_MEMORY.md → analysis/CURRENT.md |
| プレイヤー向けの現行規則 | ecology/PLAYABLE_RULES.md |
| 現行本編のコード | ecology/ |
| R8 の実装正本 | analysis/experiments/exp-18/R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md |
| R9（初期4Stageのチュートリアル化）の案と実装票 | analysis/experiments/exp-18/R9_EARLY_STAGES_AND_PACK_SCOPE_PROPOSAL.md / R9_IMPLEMENTATION_TUTORIAL_STAGES.md |
| Phase C（生成装備と Blueprint）の実装票 | analysis/experiments/exp-18/R8_IMPLEMENTATION_PHASE4_STATUS.md |
| 本編5人のキャラクター設計（R11、実装済み） | analysis/experiments/exp-18/R11_CHARACTER_DESIGN_FIVE.md |
| 物語まわりの評価と実装（R12、実装済み） | analysis/experiments/exp-18/R12_STORYTELLING_REVIEW.md |
| EXP-18 の判断履歴 | analysis/experiments/exp-18/ |
| 運用・公開・人間テスト | docs/ |
| D1 への保存処理 | functions/api/runs.js、migrations/ |

## 現行の入口

- /ecology/: 灰の遠征の本編
- /: /ecology/ へのリダイレクト
- Free mode: 旧 save との互換用。新しい設計判断の入口にはしない

## 現行コードの境界

ecology/ がゲーム本体です。core/build.mjs は公開版の build 印だけを提供し、frontier/ は EXP-18 R1 の教材・参照実装として残しています。functions/、migrations/、wrangler.jsonc は公開と D1 の基盤です。

EXP-18 の過去の実装報告は、当時の事実を再現するための履歴です。現在の変更判断は R8 と R9 実装票、analysis/CURRENT.md、実コードとテストの順に確認してください。R8 と R9 で食い違う箇所（有効パック数の式、過去 pack の扱い、Stage 3 の pack）は R9_IMPLEMENTATION_TUTORIAL_STAGES.md §2 に差分と影響を記録しています。
