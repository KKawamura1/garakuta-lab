# A6 preflight evidence

新しいファイル名で次を実行した。

    node --check analysis/gate-control02-r6.mjs
    node --check analysis/control02-preflight-r6.mjs
    node analysis/control02-preflight-r6.mjs

すべて終了コード0。

| 検査 | 結果 |
| --- | --- |
| Gate A positive / negative | true / true |
| Gate B positive / negative | true / true |
| Gate C positive / negative | true / true |
| Gate D positive / negative | true / true |
| Gate E positive / negative | true / true |
| Gate E bad-exchange non-vacuity | true |
| Gate F semantic execution | true |
| 現在状態のignore-next-attack | true; state progressed |
| naive-vs-optimized | true; seed 1〜10, mismatches=[] |

Gate Fの5参照はすべて、宣言的理由ではなく意味的な対象Gateで棄却された。reward-irrelevantは生成可能な攻撃列でもEを棄却するため、生成範囲外だけに依存していない。

## 新評価器と旧修復版の同値性

新しい gate-control02-r6.mjs は、R6修復済み評価器のパスだけを変更したもの。改行を正規化した比較で旧修復版と内容が一致する。新しいpreflightも、評価器のimport先以外は同じである。

