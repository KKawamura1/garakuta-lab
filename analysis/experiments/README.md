# 実験票と回答の索引

更新日: 2026-08-29（UTC）

このディレクトリは、Solの依頼をR、実装・検査担当の回答をAとして保存する実験記録です。
ここにある票は仮説・条件・判定の履歴であり、現在の作業キューは PROJECT_MEMORY と CURRENT を確認してください。

## EXP-01 — MUTATION

- R1_MUTATION.md — 初回依頼
- A1_TERRA_IMPLEMENTATION/ — 実装・検査・人間テスト回答
- R2_STRUCTURE_GATE.md → A2_TERRA_STRUCTURE_GATE/
- R3_MUTATION_DECISION.md → A3_TERRA_DECISION_ANALYSIS/

## EXP-02 — DISCOVERY / PUZZLE

- R1_DISCOVERY.md — 自動ゲートと人間テストの依頼
- A1_TERRA_GATES/ — Gate A〜Dと結果
- R2_SOL_DECISION.md — 最終判定

## EXP-03 — CONTROL

- R1_CONTROL.md → A1_TERRA_GATES/
- A2_TERRA_HUMAN/ — CONTROL 0.1の実装・人間テスト回答
- R2_SOL_CONTROL_0_1_DECISION.md — CONTROL 0.1の判定
- R3_SOL_CONTROL_0_2.md → A3_LUNA_CONTROL_0_2/
- R4_SOL_CONTROL_0_2_GATE_AUDIT.md → A4_TERRA_CONTROL_0_2_GATE_AUDIT/
- R5_SOL_CONTROL_0_2_EXACT_SEARCH_BUDGET.md
- R6_SOL_CONTROL_0_2_GATE_E_QUANTIFIER_FIX.md → A6_TERRA_CONTROL_0_2_GATE_E_QUANTIFIER_FIX/

## EXP-04 — GRAFT（計算ゲートの比較と独立試作）

- R1_GRAFT.md — 固定3行動と性質変異の依頼
- R2_SOL_GRAFT_BLIND_MODEL_COMPARISON.md — 候補比較の依頼
- Candidate 1〜6の回答はmainにマージされていません。各候補の結果は、未マージPR #5〜#10で確認できます。
- mainにあるGRAFTの実装・作者テスト記録はgraft/、analysis/GRAFT_0_1.md、analysis/GRAFT_0_1_PLAY.mdです。

## EXP-18 — キャラクター主体の創発的ルール生態系

- R2 — 敵分類の小さなコアを棄却し、局所可読・全体把握不能、一般的な強さ、トレードオフへ転換。
- R3 — ガラクタ主体を外し、永続人物と交換可能な技能・装備へ転換。
- R4 — 完成コンボを先に列挙せず、共有eventと小規則から相互作用を作る設計。
- R5 → A5_RULE_ENGINE/ — 決定的ルールエンジン、schema、停止、拡張、連鎖採掘。
- PR #49 — 8人、24技能、18装備、7区画を一周できるdraft試作。人間評価前。
- R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS.md — 12戦run、SkillPack、複数rule生成装備、exact Blueprint、活動資金、永続投資、1,000倍戦闘量、人物parameter、5人formation、3〜4 active / reactive、攻撃多様性、敵予算、難易度、敗北とresetの実装委譲票。

## EXP-00以外の独立試作

ARC/OBS、PHASE、RELAY、LAWS、COST、SQUEEZE、IDENT、SKIP、ECHO、HAUL、NIGHT-EATER、TOMORI、EMBERLINE、KINDLING、SCRAPLINEは、主にanalysis/直下の票と各試作READMEにあります。全体の時系列と現在の判定はEXPERIMENT_LEDGERを正とします。

新しい実験を追加するときは、依頼・実装境界・検査結果・作者テスト結果・判定を、既存の票を上書きせず新しい版として置きます。
