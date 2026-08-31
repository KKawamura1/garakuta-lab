# 灰の遠征

EXP-18 R8 を実装する、作者自身の iPhone 向けゲームです。現在の本編は ecology/ にあります。

## 現在地

- 入口: /ecology/（ルートは本編へリダイレクト）
- 形式: 8人から5人を選ぶ、2×3隊列の自動戦闘遠征
- 本編: Campaign Stage 0〜3、3幕12戦、決定的リプレイ、D1記録
- 現在の判断: 実装は揃いつつあるが、作者による現行版の評価は未実施

Campaign Stage は、技能パックと敵の攻略問題を段階的に増やします。難易度 rank の旧自由遠征は互換モードとして残っていますが、本編の導線ではありません。

## 読む順番

1. AGENTS.md
2. PROJECT_MEMORY.md
3. analysis/CURRENT.md
4. ecology/PLAYABLE_RULES.md
5. analysis/experiments/exp-18/R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md

## 検査

    node ecology/check.mjs
    bash analysis/check-all.sh

機械検査の成功は、面白さや再プレイ欲の証明ではありません。次の関門は作者が Campaign Stage 0〜3 を実際に遊び、選択の因果と再訪したくなる理由を記録することです。

## 公開先

https://garakuta-lab.pages.dev/ecology/

リポジトリ名、Cloudflare Pages のドメイン、D1 の binding 名は既存インフラの識別子として維持しています。プロダクトの表示名と現行導線は「灰の遠征」です。

旧プロトタイプと旧運用資料は現行ツリーから整理しました。必要な過去の判断は Git の履歴と analysis/experiments/exp-18/ の記録で確認してください。
## イベントログの値

戦闘ログは値を持つイベント列です。現行エンジンが出力する `type` は次の44種類です。

- `battle_started`
- `round_started`
- `actor_activated`
- `round_ended`
- `battle_ended`
- `action_declared`
- `target_selected`
- `target_changed`
- `action_cost_paid`
- `action_started`
- `action_resolved`
- `action_skipped`
- `action_canceled`
- `preparation_started`
- `preparation_advanced`
- `preparation_completed`
- `preparation_interrupted`
- `damage_proposed`
- `barrier_damaged`
- `barrier_broken`
- `damage_taken`
- `excess_damage`
- `healing_proposed`
- `healing_applied`
- `excess_healing`
- `barrier_proposed`
- `barrier_gained`
- `barrier_expired`
- `actor_defeated`
- `resource_refreshed`
- `resource_spent`
- `resource_gained`
- `resource_unused`
- `actor_moved`
- `status_added`
- `status_removed`
- `equipment_worn`
- `equipment_broken`
- `equipment_repaired`
- `block_proposed`
- `block_gained`
- `damage_blocked`
- `block_spent`
- `pending_amount_modified`

イベントの詳細な値と不変条件は `ecology/schema.mjs`、実装契約は `ecology/PLAYABLE_RULES.md` を参照してください。
