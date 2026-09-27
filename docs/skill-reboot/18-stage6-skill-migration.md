# Stage 6 — 残り170節のruntime移行

更新日: 2026-09-27  
状態: **6aで戦槌A2/A3を実装。Stage 5の初期20節を含む22節が本編で実行可能。残り168節はfail-closed。BaseはPR #332/#333統合後の`dev`。**

Stage 5で5人の代表武器の初期R/A1と新しい本編Run境界を接続した。Stage 6は、カタログにある残り170節を新runtimeへ移す。仕様の正本は[武器技能カタログ](11-weapon-catalog.md)と[解決順監査](12-resolution-order-audit.md)。旧技能ID・level・player treeを復活させず、node keyとStage別runtime registryから同じBattleInput経路へつなぐ。

## 進め方

1. カタログ順に進め、最初の武器で必要な共有engine機構を先に作る。共通機構は技能IDを見ず、一般化したevent/effect/selectorとして試験する。
2. 各武器の技能は、その武器のruntime moduleへ登録する。仕様の条件・対象・係数・コスト・回数・状態付与をそれぞれ確認できる小さな縦切りにし、liveとforecastが同じbuilderを使うことを保つ。
3. Stageのexecutable allowlistは実装とevent testを終えた節だけに更新する。未実装節はUI、取得、予約の自動進行、loadout、ultimate候補、BattleInputすべてから閉じる。
4. shared engine変更が既存技能へ影響しうる場合は、変更前後で既存runtime testと代表battleを再実行する。
5. 完了時にカタログ190節とruntime registryを照合し、実装済みの過不足、説明文とのずれ、未実装節の漏れ表示を監査する。

実装ごとはStage 5切替PRをbaseに積む小PRとしてレビュー可能にする。Stage 5の切替がdevへ入った後にStage 6 branchを最新`dev`へrebaseする。Stage 6自体は技能群の移行が終わるまで継続し、最後に全nodeとsave/UI/BattleInput/replayの接続を再確認する。

## 6a — 戦槌A2/A3

6aはカタログ先頭の戦槌A2「響く鉄」とA3「大槌打ち」を本編へ接続する。Stage 5の20節境界はStage 5 registryに残し、Stage 6 registryはそれにA2/A3だけを加えた22節と起動時に照合する。残る168節はまだ表示・取得・予約・BattleInputに出さない。

### 響く鉄

- `damage_proposed`イベントへ、そのActionPlanが実際に提案するhitの0始まり通し番号`actionHitOrdinal`を加える。複数damage効果や複数対象でも一つの攻撃全体で順番を数える。番号状態は`WeakMap`で持ち、immutableなActionPlan自体は書き換えない。
- Reactive skill定義は、旧来の単一`rule`に加えて`rules`配列を受け付ける。engineは各ruleを候補へ展開し、同じactorが同じevent/timing窓でreactiveを一つだけ発動する既存優先列規則を維持する。
- 第1hitでRP1を払い、対象へ怯み1と攻撃中markerを付ける。第2hitはmarkerがある場合だけ怯み1を付けてmarkerを消す。3hit目以降は対象外。RP不足なら費用も効果も発生しない。
- 1hit攻撃では`action_resolved`時にmarkerを消す。状態定義のround expiryは中断時の最終清掃境界にする。

### 大槌打ち

- 槌打ちの置換となるactive skill。`distance_asc`で最も近い生存敵1体を選び、腕力の170%を近接damageとして与える。

## 6aの検証

- `ecology/weapon-skill-runtime-warhammer.test.mjs`: registryが22節であること、Stage 5の初期20節は不変であることを確認する。
- 同じ試験で、3hit攻撃はRP1回・怯み2回まで、1hit×2対象は両対象に怯み、RP0は無発動、markerは行動後に消えることをイベント列とactor stateで固定する。
- 大槌打ちが最も近い敵を選び、腕力100から170damageを提案することを確認する。
- `node ecology/check.mjs`、`bash analysis/check-all.sh`、Stage 6 branch previewの390×844 browser trial、PR CIを通す。

## 以降の進捗

次は戦槌の残りnodeをカタログ順で移植し、共通規則が足りない箇所だけを次のshared changeにする。各完了小PRのnode key、必要な機構、event test、preview結果、残数をこの節へ記録する。Stage 6の最終合格時には残数が0、全190節のruntime登録とカタログ契約の照合が一致すること。
