# analysis/ — 実験・検査・結果の索引

更新日: 2026-08-29（UTC）

analysis/は、ゲームの面白さを直接決める場所ではなく、仮説・実装条件・検査・作者観測を結び付ける場所です。現在地は PROJECT_MEMORY、CURRENT、REPOSITORY_MAP を先に読んでください。

## 読む順番

1. EXPERIMENT_LEDGER.md — 系列ごとの問い・観測・判定
2. 該当する実験票 — experiments/exp-XX/ または独立試作票
3. 作者の一次記録 — human-runs/、D1結果票
4. 機械検査 — 該当する smoke、gate、search
5. 実装 — core/または試作ディレクトリ

## 目的別の入口

| 知りたいこと | 入口 |
|---|---|
| 現在の本編のルール・版 | core/rules-version.mjs、core/laws.mjs、core/law-table.mjs |
| 本編の状態機械 | core/run.mjs、core/metrics.mjs、core/render.mjs |
| 本編の回帰検査 | smoke-core.mjs、smoke-laws.mjs、smoke-version.mjs、smoke-resume.mjs、smoke-sync.mjs |
| まとめて検査 | check-all.sh。通常CIは高速経路、全量はRUN_EXHAUSTIVE=1 bash check-all.sh |
| SCRAPLINEを検査 | scrapline-agent-gate.mjs とSCRAPLINE_AGENT_RUNBOOK.md |
| SCRAPLINEの作者観測 | SCRAPLINE_D1_PLAYTEST_20260829.md、SCRAPLINE_D1_PLAYTEST_20260829_CLEAR.md |
| 作者ログを比較 | human-panel.mjs、import-export.mjs、human-runs/ |
| エージェント代理プレイ | agent-panel.mjs、agent-runs/、agents/PROTOCOL.md |
| 法則表・構造ゲート | tune-laws.mjs、pair-check.mjs、arrangement-space.mjs |
| 過去世代の検査 | system-*.mjs、phase-candidates.mjs、emotional-arc-*.mjsと対応するROUND票 |

## ディレクトリの意味

- experiments/: 事前登録されたSolの依頼RとTerraの回答A。実験の一次記録です。
- human-runs/: 人間の行動列・回答・感情マーカー。作者の代替評価ではありません。
- agent-runs/: エージェントの補助的な出力。fun/replayを自動合格にしません。
- 直下のMarkdown: 初期試作、旧ラウンド、独立試作、結果要約。現行かどうかはCURRENT/LEDGERで確認します。
- 直下のmjs: 回帰検査、探索、調律、分析、import/export。実験票と対応しない古いスクリプトも削除しません。

## 新しいファイルを置くとき

新しい主仮説は、可能ならexperiments/exp-XX/に依頼・回答・証拠をまとめます。独立縦切りは試作名のREADMEとanalysis/NAME_VERSION.mdを対にします。検査は、何を保証するかがファイル名または票から分かるようにします。

古い資料を短く書き直す場合は、原文を上書きせず、新しい要約から旧資料へリンクします。既存の「次にやること」は、更新日が古ければ現在のキューとして扱いません。
