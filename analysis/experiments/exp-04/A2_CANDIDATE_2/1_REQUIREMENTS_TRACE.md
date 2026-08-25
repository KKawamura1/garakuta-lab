# 要求トレーサビリティ

| 要求 | 実装・証拠 | 状態 |
|---|---|---|
| R2 §3: 指定BASEから専用ブランチ | `README.md` 来歴、GitHubブランチ | 実施 |
| R1 §5: 実装・探索前の反証レビュー | `2_REFUTATION_REVIEW.md` | 実施 |
| R1 §3: 3基本行動とターン順 | `graft-core.mjs`, `3_FORMALIZATION.md` | 診断用の暫定実装 |
| R1 §3 / Gate A: 3変異×3行動、丸め、タイミング、禁止、非連鎖、決定性 | `preflight.mjs`; `run-checks.sh` の最初のPASS | 暫定意味論下でfixture PASS。Gate A最終判定ではない |
| R1 §6: known-badと各Gate破壊fixture | Gate Cのnegative/positive分岐は `ambiguity-witness.json`。全Gate fixtureは未作成 | 仕様停止のため未完 |
| Gate B: 両提示候補に合法・次戦勝利・使用証人 | なし | 未評価 |
| Gate C: 取得前後の最適行動列変化 | `gate-c-ambiguity.mjs`, `witness-oracle.mjs` | 判定定義が不足し、解釈間で合否分岐 |
| Gate D: 5固定方策拒否と最適完走 | なし | 未評価 |
| Gate E: 文脈により有用装着先が2行動以上 | なし | 未評価 |
| Gate F: 両提示候補に完走継続 | なし | 未評価 |
| R1 §4: 敵候補規則を結果前に固定 | 固定していない | seed探索開始前に停止したため対象外 |
| R1 §7: 事前固定規則による候補探索 | 実行していない | R2 §4の停止条件を優先 |
| R2 §2: naive/独立オラクル | `witness-oracle.mjs`（coreをimportしない） | Gate C停止証拠について実施・PASS |
| R2 §5: コマンド、範囲、結果、残余リスク | `README.md`, `4_RESULT.md`, `ambiguity-witness.json` | 実施 |
| R1/R2: UI・公開・人間評価へ進まない | 変更は本フォルダ内だけ | 遵守 |

## なぜ全Gateを実装しなかったか

Gate Cは全Gate通過の必要条件であり、その真偽を決める語「最適」に目的関数がない。
候補数値を見て都合のよい目的関数を選ぶと、事後的な合格条件変更になる。
このため、敵生成・seed探索より先に、判定が変わる最小証拠を作って停止した。

