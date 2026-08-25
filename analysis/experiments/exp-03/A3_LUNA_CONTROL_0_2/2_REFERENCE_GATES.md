# EXP-03 CONTROL 0.2 — Gate F 参照点結果

対象: R3_SOL_CONTROL_0_2 / Gate F  
実行: node analysis/gate-control02.mjs  
位置づけ: 本番seed探索より先に実行

## 結果

Gate F: **PASS**

5つの参照点を先に評価し、すべて「実験したい因果機構を含む採用候補」としては不適格になることを確認した。

| 参照点 | 結果 | 検出理由 |
|---|---|---|
| 攻撃が全ターン0 | 却下 | 0が2回以上・6以上が2回以上という攻撃列条件を満たさない |
| 攻撃が全ターン1 | 却下 | 0が2回以上・6以上が2回以上という攻撃列条件を満たさない |
| 発電後に攻撃連打だけで最適 | 却下 | generator → generator → nail → nail → nail の固定列が勝利 |
| 防御だけしていれば負けない | 却下 | 全攻撃0で、防御因果を検証する敵ではない |
| 報酬部品を使わない方が最適 | 却下 | generator → nail → nail で報酬部品なしに勝利 |

## 証拠

- all-zero: 8ターンすべて攻撃0、勝利列79 / 全列1227
- all-one: 8ターンすべて攻撃1、勝利列79 / 全列1227
- attack-only: 最適列 generator, generator, nail, nail, nail、終了HP30、5ターン
- defend-safe: 8ターンすべて攻撃0
- reward-irrelevant: 最適列 generator, nail, nail、終了HP30、3ターン

Gate Fを通過したため、seed 1〜10000の本番探索へ進んだ。