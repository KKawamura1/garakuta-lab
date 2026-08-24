# A6 test evidence

## 実行済み

    node --check analysis/gate-control02-r6.mjs
    node --check analysis/control02-preflight-r6.mjs
    node analysis/control02-preflight-r6.mjs
    time env SEED_LIMIT=100 node analysis/gate-control02-r6.mjs > /tmp/r6-a6-benchmark-100.json

構文検査、preflight、benchmarkはすべて終了コード0。

preflightの重要な結果：

    passed=true
    failures=[]
    equivalence.passed=true
    equivalence.seeds=10
    mismatches=[]
    policyMismatches=[]

## 公開境界

Gate AはA-calcの範囲だけであり、UI・内部計算・永続イベントの三者一致は検査していない。UI、デプロイ、D1、本番E2E、人間テスト、URL提示は実施していない。

完全探索の結果が全Gate不合格なので、公開へ進まない。

