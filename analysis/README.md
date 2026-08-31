# 現行分析入口

現在のプロダクトは EXP-18 の「灰の遠征」です。

## 最初に読むもの

1. CURRENT.md
2. EXPERIMENT_LEDGER.md
3. ecology/PLAYABLE_RULES.md
4. analysis/experiments/exp-18/R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md

## 現行検査

- ecology-anti-stall-audit.mjs: 回復・反応の停止性監査
- ecology-contract-smoke.mjs: content 契約の検査
- ecology-readout-smoke.mjs: 表示値と content の照合
- ecology-screens-smoke.mjs: 画面と主要操作の接続
- ecology-test-hygiene-smoke.mjs: 明らかな恒真 assert の検出
- ecology-upload-smoke.mjs: D1 payload と受け側の整合
- ecology-trial.mjs: 公開先 E2E 台本

ecology-expedition-smoke.mjs と ecology-decision-space-smoke.mjs は、互換用 Free mode の補助検査です。Campaign の現行受入条件ではありません。

## EXP-18

analysis/experiments/exp-18/ は、R1〜R8 の設計判断と A5 以降の実装結果をまとめた一次記録です。R8 が現在の実装判断の入口で、R6/R7 は単独で新しい作業を開始する資料ではありません。
