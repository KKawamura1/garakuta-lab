# EXP-04 Candidate 5 — 要求トレーサビリティ

開始点: `ad66d21a8b74f80cfa8638ba22a1a3a144ddab80`

この候補は、指定された開始点から `exp-04/candidate-5` を作成した。R1/R2の意味論・閾値・禁止事項を変更しない。R2の「判定を変える曖昧さを発見した場合は、高価な探索前に具体的な証拠と必要な意思決定を報告して停止する」という条件に従い、完全な計算探索は開始していない。

| 要求 | 対応成果物 | 状態 |
| --- | --- | --- |
| R1/R2と関連indexの確認 | `00_TRACEABILITY.md`, `01_PREFLIGHT.md` | 完了 |
| 実装前の反証レビュー | `01_PREFLIGHT.md` | 完了 |
| 仕様の形式化・判定定義 | `02_FORMALIZATION.md` | 曖昧箇所を特定して停止 |
| positive / negative fixture | `preflight.mjs` | 曖昧さを示す最小診断のみ |
| 独立評価器・naive照合 | — | 探索開始前の停止条件により未実施 |
| 事前固定規則による探索 | — | 未実施 |
| 計算ゲート結果 | `03_RESULT.md` | 判定不能（仕様決定待ち） |
| 再現可能な証拠 | `preflight.mjs`, `01_PREFLIGHT.md` | 完了 |
| UI・デプロイ・D1・人間評価 | — | 禁止範囲のため未実施 |

## 参照した指定資料

- `AGENTS.md`
- `INDEX.md`
- `analysis/experiments/README.md`
- `docs/SOL_TERRA_WORKFLOW.md`
- `analysis/experiments/exp-04/R1_GRAFT.md`
- `analysis/experiments/exp-04/R2_SOL_GRAFT_BLIND_MODEL_COMPARISON.md`
