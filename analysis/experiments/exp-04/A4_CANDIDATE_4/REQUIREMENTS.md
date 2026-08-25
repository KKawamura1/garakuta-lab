# R1/R2 要求トレーサビリティ

| 要求 | 実装・証拠 | 状態 |
|---|---|---|
| BASE_SHAから隔離ブランチ | `exp-04/candidate-4`, base `ad66d21a8b74f80cfa8638ba22a1a3a144ddab80` | 完了 |
| 高価な探索前の反証レビュー | `REPORT.md` §2、`preflight.mjs` | 完了 |
| 仕様と判定条件の形式化 | `REPORT.md` §3 | **判定変更する未定義点のため停止** |
| positive / negative fixture | `preflight.mjs` の carry=1 / reset=0 | 完了（停止根拠） |
| 評価器、独立オラクル照合 | 本評価器は未着手 | R2停止条件により非実施 |
| 生成規則を事前固定して探索 | 未着手 | R2停止条件により非実施 |
| Gate A〜F判定 | 判定不能 | ゲーム意味論の意思決定待ち |
| UI、デプロイ、D1、人間評価を行わない | 変更なし | 完了 |
| 再現可能な証拠 | `node analysis/experiments/exp-04/A4_CANDIDATE_4/preflight.mjs` | 完了 |

停止はR2 §4およびR1 §5に従う。未定義点を仮定してPASS候補を作ることはしていない。
