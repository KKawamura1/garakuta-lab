# エージェント向け作業導線

更新日: 2026-08-31（UTC）

## 最初に読むもの

1. AGENTS.md
2. PROJECT_MEMORY.md
3. analysis/CURRENT.md
4. ecology/README.md
5. ecology/PLAYABLE_RULES.md
6. 変更対象に対応する R8 の節

公開や作者テストに関係する場合だけ、docs/HUMAN_TEST_RELEASE.md と docs/OPERATIONS.md を追加で読みます。

## 現在の認識

- 本編は ecology/ の「灰の遠征」。
- 入口は Campaign Stage 0〜3。Free mode は互換経路です。
- 自動戦闘、決定的リプレイ、exact preview、Profile/Run/Battle 分離、D1 記録が現行の骨格です。
- 現在版の作者評価は未実施です。自動検査を fun の代わりに使いません。

## 作業の進め方

1. 変更対象の現状と直接利用者を調べる。
2. R8 と現在のコード・テストの差分を確認する。
3. 変更理由、非対象、受入条件、未確認事項を短く書く。
4. 最小範囲を実装する。
5. node ecology/check.mjs と bash analysis/check-all.sh を実行する。
6. 公開に関係する場合は GitHub Actions の公開先 E2E を実行する。
7. PR に検査結果と、作者に依頼する評価だけを残す。

## 禁止事項

- 旧プロトタイプの導線を現行入口として復活させない。
- R6/R7 の履歴資料を、R8 の現行仕様より優先しない。
- 未実装の Phase C や Stage 4 以降を、説明だけで実装済みに見せない。
- 作者の未評価を、勝率やテスト通過で代用しない。
