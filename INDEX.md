# ガラクタ・ラボ リポジトリ・インデックス

このページは細部を複製する索引です。現在の判断を決める資料ではありません。
全体の分類は docs/REPOSITORY_MAP.md を見てください。

## 現在の正史

| 役割 | ファイル |
|---|---|
| 作業ルール | AGENTS.md |
| 現在の結論・生の声 | PROJECT_MEMORY.md |
| 短縮版の現在地 | analysis/CURRENT.md |
| 全実験の判定表 | analysis/EXPERIMENT_LEDGER.md |
| 設計の憲章 | DESIGN_CHARTER.md |
| 新担当の手順 | docs/AGENT_ONBOARDING.md |
| リポジトリ全体の分類 | docs/REPOSITORY_MAP.md |

最小読書順は、AGENTS → PROJECT_MEMORY → CURRENT → LEDGERです。個別の作業では、該当試作のREADMEと実験票だけを追加で読みます。

## 実装地図

| 場所 | 役割 |
|---|---|
| core/ | 本編のルール・状態機械・シミュレーション |
| play/ | 現在の既定UIとlaws/skip等の比較版 |
| scrapline/ | 最新の独立試作。作者テスト不採択 |
| kindling/、emberline/、tomori/、night-eater/ | 縦切り比較版 |
| graft/、echo/、haul/、material/、puzzle/、control/、cycle/ | 旧独立試作 |
| analysis/experiments/ | EXP-01〜04の依頼と回答 |
| analysis/ | 旧ラウンド、実験票、検査、結果要約 |
| analysis/human-runs/ | 作者・人間の再現可能なプレイ記録 |
| analysis/agent-runs/ | エージェント代理プレイ |
| research/ | 先行調査 |
| docs/ | 公開・運用・D1/export |
| .github/workflows/ | 検査・D1 export |
| .claude/ | 旧Claude運用の再開資料 |

## 現在の入口

- /play/: SKIP 0.4 / laws-0.5の既定・比較基準
- /scrapline/: SCRAPLINE 0.7 / build scrapline-build-20260829-r12。最新の作者テストは不採択
- その他の試作は比較・履歴用です。採否はPROJECT_MEMORYとLEDGERを確認してください。

## 実験・運用の入口

- 実験票: analysis/experiments/README.md
- 作者ログ: analysis/human-runs/README.md
- SCRAPLINE次担当ランブック: analysis/SCRAPLINE_AGENT_RUNBOOK.md
- 公開条件: docs/HUMAN_TEST_RELEASE.md
- D1ログ取得: docs/D1_LOG_ACCESS.md
- D1 export: docs/EXPORT.md
- 日常運用: docs/OPERATIONS.md

## 重要な扱い

古い文書、失敗作、成功作、未成立の検証、未マージPRは削除しません。
ただし、旧文書の「次にやること」は現在のキューではありません。資料が食い違うときは、AGENTSにある優先順位と、CURRENT/PROJECT_MEMORY/LEDGERの更新日を確認してください。
