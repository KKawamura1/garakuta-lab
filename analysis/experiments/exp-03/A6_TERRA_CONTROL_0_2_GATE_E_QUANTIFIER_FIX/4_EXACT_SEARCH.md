# A6 exact-search result

## 実行結果

新しい評価器名でseed 1〜100のベンチマークを再実行した。

    time env SEED_LIMIT=100 node analysis/gate-control02-r6.mjs > /tmp/r6-a6-benchmark-100.json

終了コード0。countsは B=1, C=0, D=4, E=0, BC=0, BD=1, CD=0, BCD=0, BCDE=0, all=0。

seed 1〜10000の高価な完全探索は、同じR6修復版ロジックを使った直前の実行で完了済みであり、A6のファイル名変更だけを理由に再実行していない。新旧評価器の内容一致と新パスでのpreflight・benchmarkを確認した。

完全探索の記録：

- 実行時間：16分52.151秒
- 終了コード：0
- checkpoint：nextSeed=10001, complete=true
- Gate E：0
- 全Gate：0
- uiDeploymentAllowed：false

## 集計

| metric | count | first seed |
| --- | ---: | ---: |
| Gate B | 127 | 25 |
| Gate C | 58 | 187 |
| Gate D | 173 | 22 |
| Gate E | 0 | — |
| B ∩ C | 56 | 187 |
| B ∩ D | 16 | 25 |
| C ∩ D | 13 | 1301 |
| B ∩ C ∩ D | 13 | 1301 |
| B ∩ C ∩ D ∩ E | 0 | — |
| all gates | 0 | — |

上位候補5件はseed 1301, 1884, 2119, 2943, 3020。すべてB/C/Dはtrue、Eはfalseだった。

## Gate Eの不合格理由

| seed | 最適キャンペーン (撃破, HP, turns) | 報酬ごとの有用交換数 |
| ---: | --- | --- |
| 1301 | (3, 4, 13) | collapse 2, capacitor 1; capacitor 1, follow 0 |
| 1884 | (3, 3, 16) | capacitor 1, collapse 2; capacitor 0, follow 0 |
| 2119 | (3, 2, 17) | capacitor 1, collapse 2; capacitor 1, follow 0 |
| 2943 | (3, 1, 17) | collapse 2, follow 0; follow 0, capacitor 1 |
| 3020 | (3, 2, 16) | follow 0, collapse 2; capacitor 1, follow 0 |

全候補でchanged=true、exchange=true。したがってEの失敗は、全交換先を要求する旧量化子の残存ではなく、少なくとも一つの提示報酬に有用な交換先がないためである。

