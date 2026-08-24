# A1 Terra: EXP-03 Gate結果

対象要求: [R1_CONTROL](../R1_CONTROL.md)

- 実装: [core/control.mjs](../../../../core/control.mjs)
- 自動検査: [analysis/gate-control.mjs](../../../../analysis/gate-control.mjs)
- 実行日: 2026-08-24
- 総合結果: **A〜Dすべて合格**
- 選定seed: **7**
- seed走査: **1から7まで昇順**
- UI・デプロイ: 本結果を根拠に実施

既存のゲーム規則セットは変更せず、EXP-03専用の control-0.1 計算・画面を独立追加した。各要求の結果は次の順に読む。

1. [Gate A — 計算正確性](./1_GATE_A.md)
2. [Gate B — 探索抵抗性](./2_GATE_B.md)
3. [Gate C — 報酬の厚み](./3_GATE_C.md)
4. [Gate D — 参照破壊検出とseed選定](./4_GATE_D.md)
5. [UI・デプロイ結果](./5_UI_DEPLOY.md)

uiDeploymentAllowed は各Gateの合否から計算する値に修正済みで、固定値ではない。
generatedAt は実行ごとに変わるため、数値の正はこの結果票と実装の再実行で照合する。
