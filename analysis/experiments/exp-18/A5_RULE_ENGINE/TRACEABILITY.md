# A5 — 要求トレーサビリティ

R5 の各節を、実装ファイル・テスト・証拠へ対応させる。
状態は「予定」で作成し、完了時に「実績」へ更新した（R5 §16 Gate A）。
更新時点のコミットは `ea27f90`。

状態の凡例: 検査済（テストが存在して緑）/ 実装済（テストで直接固定していない）/ 逸脱（RESULT.md に記載）

| R5 節 | 要求 | 実装 | テスト | 状態 |
|---|---|---|---|---|
| §1.2 | 味方4人上限、active2 / reactive2 / equipment2 | `schema.mjs` `validate.mjs` | `schema.test.mjs` 上限拒否 | 検査済 |
| §1.2 | 戦闘に乱数を使わない | `engine.mjs`（Date / Math.random 不使用） | `engine.test.mjs` 100回深一致 | 検査済 |
| §1.2 | 行動権と反応権を別資源にする | `engine.mjs` actor.actionPoints / reactionPoints | `engine.test.mjs` 資源分離 | 検査済 |
| §1.2 | 人物名・特定相方IDを参照する型が存在しない | `schema.mjs` predicate/filter 一覧 | `schema.test.mjs` 型不在の検査 | 検査済 |
| §1.2 | frontier/ を変更しない | — | `git diff main..HEAD -- frontier/` が空 | 実績: 無変更 |
| §3.3 | ecology/ へ新規配置 | `ecology/` 20ファイル | — | 実装済 |
| §4 | 公開API 3ファイル | `engine.mjs` `validate.mjs` `mine.mjs` | 各テストが export 経由で呼ぶ | 検査済 |
| §4.1 | 成功時の結果形 | `engine.mjs` `buildResult` | `engine.test.mjs` 形の検査 | 検査済 |
| §4.1 | 不正・上限・未実装は例外、部分結果を返さない | `errors.mjs` `EcologyError` | `termination.test.mjs` | 検査済 |
| §4.2 | 純粋性（入力不変・同一結果） | `engine.mjs`（deep copy して展開） | `engine.test.mjs` 入力凍結比較 | 検査済 |
| §5.1 | ContentBundle と ID 規約 | `validate.mjs` | `schema.test.mjs` | 検査済 |
| §5.2 | Character / EnemyActor、数値は安全整数・0以上 | `validate.mjs` | `schema.test.mjs` 負数・非整数拒否 | 検査済 |
| §5.3 | BattleInput、位置重複不可、tactic 2件・useWhen 2件 | `validate.mjs` | `schema.test.mjs` | 検査済 |
| §5.4 | Position 4種、移動は swap_positions のみ | `schema.mjs` `effects.mjs` | `engine.test.mjs` swap | 検査済 |
| §5.5 | preparation は同時に1つ | `engine.mjs` | `engine.test.mjs` 準備 | 検査済 |
| §5.6 | 装備は0で壊れ、以後 rule を供給しない | `engine.mjs` `ownedRules` | `engine.test.mjs` broken 供給停止 | 検査済 |
| §5.7 | RuleDef、tie-break 5段、発火直前の再評価 | `engine.mjs` `dispatchRules` | `engine.test.mjs` 固定順序・再評価 | 検査済 |
| §5.7 | 同 owner 同 rule は 1 chain 1回 | `engine.mjs` chain firing 表 | `termination.test.mjs` | 検査済 |
| §6 | v1 EventType 固定、予約語彙は validator error | `schema.mjs` `validate.mjs` | `schema.test.mjs` 予約語拒否 | 検査済 |
| §7 | CombatEvent の必須項目、id は sequence から決定的 | `event-queue.mjs` | `engine.test.mjs` | 検査済 |
| §8 | v1 predicate、比較演算子、subject | `predicates.mjs` | `schema.test.mjs` `engine.test.mjs` | 検査済 |
| §8 | useWhen で使える predicate の制限 | `validate.mjs` | `schema.test.mjs` | 検査済 |
| §8 | hp_percent は整数比較 | `predicates.mjs` | `engine.test.mjs` 境界 | 検査済 |
| §9 | TargetQuery の scope / filter / sort / take | `selectors.mjs` | `engine.test.mjs` | 検査済 |
| §9 | sort 末尾に position_asc, instance_id_asc を暗黙追加 | `selectors.mjs` | `engine.test.mjs` tie 解消 | 検査済 |
| §10.1 | cost は一括支払い、途中巻き戻し無し | `effects.mjs` `payCosts` | `engine.test.mjs` 不足時不発火 | 検査済 |
| §10.2 | v1 effect 一覧 | `effects.mjs` | `schema.test.mjs` 未知 effect 拒否 | 検査済 |
| §10.3 | ValueDef、0除算禁止、整数計算、最後に floor | `values.mjs` | `schema.test.mjs` `engine.test.mjs` | 検査済 |
| §11.1 | 初期化と battle_started 後の勝敗確認 | `engine.mjs` | `engine.test.mjs` 即決着 | 検査済 |
| §11.2 | ラウンド開始、refresh は listen 不可 | `engine.mjs` `validate.mjs` | `schema.test.mjs` | 検査済 |
| §11.3 | activation、preparation 自動進行、AP 取得での再投入 | `engine.mjs` | `engine.test.mjs` 再行動 | 検査済 |
| §11.4 | active action の14手順 | `engine.mjs` `performAction` | `engine.test.mjs` 順序固定 | 検査済 |
| §11.5 | interrupt は同期、after は FIFO | `engine.mjs` | `engine.test.mjs` 順序固定 | 検査済 |
| §11.6 | ラウンド終了処理 | `engine.mjs` `endRound` | `engine.test.mjs` | 検査済 |
| §11.6 | stalemate（採用した。state hash と fixture は README に記載） | `engine.mjs` `stateHash` | `engine.test.mjs` stalemate | 検査済 |
| §12.1 | damage の7手順と excess_damage 式 | `effects.mjs` | `engine.test.mjs` 境界 | 検査済 |
| §12.2 | healing と excess_healing | `effects.mjs` | `engine.test.mjs` 境界 | 検査済 |
| §12.3 | barrier packet、期限順吸収 | `effects.mjs` | `engine.test.mjs` | 検査済 |
| §12.4 | preparation の完成経路2種 | `engine.mjs` `effects.mjs` | `engine.test.mjs` | 検査済 |
| §12.5 | swap は原子的、両者に actor_moved | `effects.mjs` | `engine.test.mjs` | 検査済 |
| §12.6 | 装備摩耗と broken | `effects.mjs` | `engine.test.mjs` | 検査済 |
| §13 | Objective 3種、chain 終了後に判定 | `engine.mjs` `checkOutcome` | `engine.test.mjs` defeat 反応後の判定 | 検査済 |
| §14 | 既定 options と上限到達時のエラー診断 | `engine.mjs` `errors.mjs` | `termination.test.mjs` | 検査済 |
| §15 | fixture content（active / reactive / equipment / status） | `fixture-content.mjs` | 全テスト | 検査済 |
| §16 A | PREFLIGHT / TRACEABILITY | 本書と `PREFLIGHT.md` | — | 実績: commit d97f3f5 |
| §16 B | schema | `validate.mjs` | `schema.test.mjs` | 検査済 |
| §16 C | 決定性とイベント意味 | `engine.mjs` | `engine.test.mjs` | 検査済 |
| §16 D | 停止 | `engine.mjs` | `termination.test.mjs` | 検査済 |
| §16 E | データ追加だけの拡張 | `fixture-content.mjs` へのデータ追加 | `extensibility.test.mjs` + `git diff ab83135 ea27f90` がエンジン無変更 | 検査済 |
| §16 F | 連鎖採掘 | `mine.mjs` | `mine.test.mjs` + `MINING_SAMPLE.json` | 検査済 |
| §17 | 5本のテストが個別に exit 0、可能なら check.mjs | `check.mjs` | `analysis/check-all.sh` 経由で CI | 検査済 |
| §18 | 成果物一式 | `A5_RULE_ENGINE/` 6ファイル | — | 実装済 |

## PREFLIGHT で決めたことの対応

| PREFLIGHT # | 決め | 実装 | テスト |
|---|---|---|---|
| 1 | filter `is_event_source` を1件追加（**仕様逸脱**: RESULT §3.1） | `selectors.mjs` `schema.mjs` | `engine.test.mjs` 強化 status |
| 2 | 「1修理する装備」は v1 では回復へ置換（**仕様逸脱**: RESULT §3.2） | `fixture-content.mjs` | `engine.test.mjs` field kit |
| 3 | AP cost -1 は actor_activated + round 1回の +1 AP | `fixture-content.mjs` | `engine.test.mjs` |
| 4 | round 終了は各サブステップ後に drain | `engine.mjs` `endRound` | `engine.test.mjs` 順序固定 |
| 5 | activation 8上限は安全制約（エラーにしない） | `engine.mjs` | `termination.test.mjs` |
| 6 | apCost 0 の真の無限ループを追加標本にする | `fixture-content.mjs` | `termination.test.mjs` |
| 7 | region rule は self / cost を拒否 | `validate.mjs` | `schema.test.mjs` |
| 8 | round_limit は loss | `engine.mjs` | `engine.test.mjs` |
| 9 | 双方全滅・未達は draw / all_allies_defeated | `engine.mjs` | `engine.test.mjs` |
| 10 | fingerprint 数を面白さの証拠にしない | — | `RESULT.md` §7 と `GATE_RESULTS.md` Gate F |

## 追加した実装ファイル

R5 §3.3 の推奨構成に無いが、責務分離のために足したもの。

| ファイル | 理由 |
|---|---|
| `errors.mjs` | 検証エラーと実行時エラーの型を、engine と mine の両方から使うため |
| `actors.mjs` | 戦闘状態の読み取りと履歴カウンタ。predicates / selectors / effects の共通土台 |
| `values.mjs` | §10.3 の効果量。effects から分けて単独で読めるようにした |
| `check.mjs` | §17 の「可能なら」に対応。出力ではなく exit code を検査する |
