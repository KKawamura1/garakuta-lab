# EXP-04 Candidate 2 計算ゲート回答

## 結論

**判定不能・仕様決定待ちで停止。** Gate C の「最適行動列」には最適化目的がなく、
最短撃破を優先する解釈では同じ取得が Gate C を満たさず、残HPを優先する解釈では
満たす具体例が得られた。独立実装のオラクルでも同じ分岐を確認した。

R2 §4 の停止条件に従い、敵生成規則の固定、4戦seed探索、Gate A〜Fの最終判定には
進んでいない。これは Gate FAIL でも PASS でもない。

## 成果物

- `1_REQUIREMENTS_TRACE.md` — R1/R2要求と証拠・状態の対応
- `2_REFUTATION_REVIEW.md` — 高価な探索前の反証レビューと停止判断
- `3_FORMALIZATION.md` — 診断に必要な暫定意味論と二つの最適化解釈
- `4_RESULT.md` — 計算範囲、証拠、判定、必要な意思決定、残余リスク
- `graft-core.mjs` — 小規模な独立戦闘器
- `preflight.mjs` — 9装着組、丸め、順序、禁止、非連鎖、決定性fixture
- `gate-c-ambiguity.mjs` — Gate Cの判定分岐を探す列挙診断
- `witness-oracle.mjs` — coreをimportしない証人専用の独立列挙
- `ambiguity-witness.json` — 再生成可能な代表証拠
- `run-checks.sh` — 一括再実行入口

## 再実行

```bash
bash analysis/experiments/exp-04/A2_CANDIDATE_2/run-checks.sh
```

期待終了コードは `0`。最初の行が `preflight: PASS`、診断JSONで
`turns-first.gateC=false` と `hp-first.gateC=true`、最後のJSONで
`committedEvidence: PASS` と `independentOracle: PASS` を確認する。

## 来歴

- `BASE_SHA`: `ad66d21a8b74f80cfa8638ba22a1a3a144ddab80`
- branch: `exp-04/candidate-2`
- tested completion HEAD: `TO_BE_RECORDED_AFTER_COMMIT`

最終記録用コミットを除く、コード・fixture・結果が一致した完了時HEADを上欄へ記録する。
PRの最終headはGitHubのPRメタデータを正とする。

UI実装、デプロイ、D1操作、プレイURL提示、人間評価、他候補の参照は行っていない。
