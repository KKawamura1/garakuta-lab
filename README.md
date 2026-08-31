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
