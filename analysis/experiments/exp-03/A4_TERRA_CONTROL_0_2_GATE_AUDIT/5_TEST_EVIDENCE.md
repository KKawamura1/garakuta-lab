# テスト証拠

状態: **未実行（停止）**

監査で確認済みの既存テスト不足:

- Gate Aは計算ログだけで、UI・保存ログ三者一致を検査していない。
- Gate Bの偏向板唯一最適／0で非最適が未検査。
- Gate CのnextAttack無視決定的方策が未実装。
- Gate D/E/FのR3意味的条件が直接検査されていない。
- seed不採用時の証拠出力がない。

R3の固定方策定義の確認後、修復版にpositive/negative/nonvacuous fixtureを追加し、終了コード0の出力をここへ保存する。

## R4試作検査

- `node --check analysis/gate-control02.mjs`: exit 0
- `SEED_LIMIT=1 node analysis/gate-control02.mjs`: exit 0
- `SEED_LIMIT=10 node analysis/gate-control02.mjs`: exit 0、real 6.086s

R4の完全fixtureおよび10,000 seed正式実行は、下記の計算量停止により未実行。試作コード・結果はmainへ反映していないため、これらは受入証拠ではない。