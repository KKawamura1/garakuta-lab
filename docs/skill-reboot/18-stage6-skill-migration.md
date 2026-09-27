# Stage 6 — 残り153節のruntime移行

更新日: 2026-09-27  
状態: **戦槌全19節を本編runtimeへ移行済み。Stage 5の初期20節を含む37節が本編で実行可能。残り153節はfail-closed。PR #336で戦槌の一括レビュー中。**

Stage 5で5人の代表武器の初期R/A1と新しい本編Run境界を接続した。Stage 6は、残る武器の技能を新runtimeへ移す。仕様の正本は[武器技能カタログ](11-weapon-catalog.md)と[解決順監査](12-resolution-order-audit.md)。旧技能ID・level・player treeを復活させず、node keyとStage別runtime registryから同じBattleInput経路へつなぐ。

## 進め方

1. カタログ順に武器単位で進める。複数節が使う共通engine機構は一般化したevent/effect/selectorとして実装し、別武器でも再利用できる形にする。
2. 一つの武器の全節を一つのレビュー可能なPRへまとめる。コード・runtime allowlist・取得/UI/BattleInput・event testを同時に揃え、liveとforecastが同じbuilderを使うことを保つ。
3. Stageのexecutable allowlistは実装とevent testを終えた節だけに更新する。未実装節はUI、取得、予約の自動進行、loadout、ultimate候補、BattleInputすべてから閉じる。
4. shared engine変更が既存技能へ影響しうる場合は、変更前後で既存runtime testと代表battleを再実行する。
5. 完了時にカタログ190節とruntime registryを照合し、実装済みの過不足、説明文とのずれ、未実装節の漏れ表示を監査する。

武器単位のPRはStage 5切替後の`dev`をbaseにする。Stage 6は全武器の移行が終わるまで継続し、最後に全nodeとsave/UI/BattleInput/replayの接続を再確認する。

## 戦槌 — 19/19節完了

Stage 5の初期20節は維持し、戦槌A2〜BB3の17節を追加した。Stage 6 registryは初期20節と戦槌runtimeを束ね、37節のallowlistと一致することを起動時に確認する。全190節のうち残る153節は表示・取得・予約・BattleInputに出さない。

### 攻撃と範囲拡張

- A2「響く鉄」は攻撃全体のhit順で初回RPを払い、最大2hitへ怯み。AA1「鉄塊」は攻撃の第1hitを+20%、AA2「深い衝撃」は怯みを+1段、AA3「震天打ち」は単体220%。
- AB1「振り幅」はRP1を払って近接単体攻撃を隣接敵へ拡張。AB2「横薙ぎ」は計画上の異なる敵が2体以上なら攻撃全体+15%。AB3「地割り」は敵一列へ160%。
- ActionPlanのhit通し番号と予定対象数をdamage proposalへ載せる。ターゲット優先nodeのqueryを人物別の選択主軸へ適用する。live/forecastで同じ決定結果を使う。

### 防御と反撃

- B1「鎧を指す」は受け構えの敵、防壁の敵の順で選ぶ。B2「打ち返し」は味方が敵からHPダメージを受けた時にRP1で腕力70%の反撃と怯み1。B3「破城打ち」は防壁・受け構えを除去して130%。
- BA1「砕けた鎧」は攻撃で敵の防御を崩した後に破甲2。BA2「砕け音」はhit後に残る受け構えを除去。BA3「解体槌」は防壁・受け構え・堅牢を除去して170%。
- 破甲は各hitの受けを段数分下げ、堅牢は受けを段数分上げる。どちらも段数上限なし、ラウンド終わりに半分へ減る。

### 強化の解除と転用

- BB1「戦利の破片」は敵の強化解除1段ごとに堅牢2を得る。BB2「逆鍛造」は攻撃開始時の堅牢を固定し、1段につき攻撃+15%の後、全段を消費する。BB3「王殺し」は敵の防壁と全強化を解除して180%。
- `ecology/weapon-skill-runtime-warhammer.test.mjs` は17節の定義・実挙動、RP不足、多段/複数対象、対象優先、破甲/堅牢の減衰、状態解除、行動開始時snapshotを確認する。
- `ecology/weapon-battle-input.test.mjs` はターゲット優先nodeの取得・loadout・人物別active queryへの適用を確認する。
- `node ecology/check.mjs`、`bash analysis/check-all.sh`、Stage 6 branch previewの390×844 browser trial、PR CIを実行する。

## 以降の進捗

次は次の武器をカタログ順に移植する。各PRにnode key、必要な共通機構、event test、preview結果、残数を記録する。Stage 6の最終合格時には残数が0、全190節のruntime登録とカタログ契約の照合が一致すること。
