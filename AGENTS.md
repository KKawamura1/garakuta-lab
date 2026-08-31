# エージェント作業規約 — 灰の遠征

更新日: 2026-08-31（UTC）

## 現在の正本

- プロダクト名は「灰の遠征」。
- 現行本編は ecology/。ルートの本番入口も ecology/ へ揃える。
- 現行の設計正本は EXP-18 R8 と、初期4Stageについては R9 実装票。R6 と R7 は判断履歴であり、単独の実装指示ではない。
- 実装・テスト・公開は揃いつつあるが、作者の現行版プレイ評価はまだ無い。

## 作業前に読むもの

1. PROJECT_MEMORY.md
2. analysis/CURRENT.md
3. ecology/README.md または ecology/PLAYABLE_RULES.md
4. 変更対象に対応する R8 の節、実装、テスト

必要な範囲だけを読み、過去の要約から現在の作業キューを推測しないでください。

## 判断の優先順位

1. 実コードと、そのコードを直接検査するテスト
2. R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md と、初期4Stage については
   R9_IMPLEMENTATION_TUTORIAL_STAGES.md（R8 との差分を §2 に記録してある）
3. analysis/CURRENT.md と PROJECT_MEMORY.md
4. R6/R7 などの履歴資料

設計資料と実装が食い違う場合、黙って片方を合わせず、差分と影響を記録してから判断します。

## 守ること

- Campaign Stage と旧 Free mode を混同しない。
- 新しい技能・敵・装備は、既存の content 契約と検証経路に登録する。
- 決定性、exact preview、リプレイ、Profile/Run 分離を壊さない。
- 機械検査の通過を、面白さ・因果理解・再プレイ欲の判定に使わない。
- 作者に未検証の経路をテスト役として渡さない。
- 仕様、閾値、公開可否を、実装の都合だけで事後変更しない。

## 最低限の検査

    node ecology/check.mjs
    bash analysis/check-all.sh

公開先まで確認する変更では、GitHub Actions の「Ecology trial (deployed)」も実行します。失敗時は URL を作者へ渡さず、失敗した経路を記録します。

## 完了条件

変更理由、変更範囲、検査結果、未確認事項を PR に残します。履歴資料を削除・移動した場合も、現行の入口から参照されないことを確認します。
