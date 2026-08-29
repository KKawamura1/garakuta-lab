# A5 — Gate 結果

対象コミット: `ea27f90`（Gate E まで）。本文書と証拠文書はその後のコミット。
実行環境: Node v22.22.2、外部依存なし。
Gate は面白さを判定しない。実装が次の設計実験を信用できるかだけを判定する。

全体:

~~~sh
$ node ecology/check.mjs
schema.test.mjs: 119 checks passed
engine.test.mjs: 538 checks passed
termination.test.mjs: 108 checks passed
extensibility.test.mjs: 31 checks passed
mine.test.mjs: 754 checks passed
ecology: 5 suites passed.
$ echo $?
0
~~~

`ecology/check.mjs` は各テストを別プロセスで走らせ、**出力ではなく exit code** を見る。
`analysis/check-all.sh` からも呼ぶので、push ごとに CI で鳴る。

~~~sh
$ bash analysis/check-all.sh
... ok   ecology/check.mjs ...
検査は全部通った。
$ echo $?
0
~~~

## Gate A — 反証レビューと要求トレーサビリティ

| 項目 | 内容 |
|---|---|
| 判定 | 通過 |
| コマンド | — （文書） |
| 対象commit | `d97f3f5` |
| 証拠 | [PREFLIGHT.md](./PREFLIGHT.md), [TRACEABILITY.md](./TRACEABILITY.md) |

コードを1行も書く前に作成した。R5 §19 の停止条件に該当する項目が1件（§15.4 の表現不能）あったが、
不変条件を変えずに済む最小修正（filter 1件追加）があるため停止せず、逸脱として記録した。
恒偽・到達不能・未定義を10件挙げ、全て実装で塞いだ。

未確認項目: なし。

## Gate B — schema

| 項目 | 内容 |
|---|---|
| 判定 | 通過 |
| コマンド | `node ecology/schema.test.mjs` |
| exit code | 0（119 checks） |
| 対象commit | `ea27f90` |
| 証拠 | `ecology/schema.test.mjs`, `ecology/validate.mjs` |

要求ごとの対応:

| R5 Gate B の要求 | 検査 |
|---|---|
| 全正常fixtureがvalidate成功 | コンテンツ1件＋戦闘入力29件 |
| 未知EventType, Effect, Predicateを拒否 | + 未知 filter / sort / cost / value / scope も拒否 |
| 予約語彙（`actor_revived` 等）を拒否 | `reserved_event_type` |
| listen 不可の `resource_refreshed` を拒否 | `non_listenable_event` |
| 参照切れを拒否 | status / skill / character / equipment / reactive / objective の6経路 |
| 重複ID、重複positionを拒否 | 定義ID、rule ID、instance ID、味方position、敵position |
| active2, reactive2, equipment2, useWhen2 の上限を拒否 | 4件＋味方5人 |
| interrupt専用effectをafter ruleで使う定義を拒否 | `interrupt_only_effect`、さらに pending frame の種類違いも拒否 |
| 0除算、負数、非整数、NaN相当を拒否 | denominator 0, maxHp -1, speed 1.5, NaN, Infinity, priority 1001, steps 4, limit 0 |
| 人物名・特定相方IDをpredicateで参照できる型が存在しない | subject 一覧が関係だけであることを構造検査し、`instance_id_is` / `character_is` を書くと拒否されることも検査 |

未確認項目: なし。

## Gate C — 決定性とイベント意味

| 項目 | 内容 |
|---|---|
| 判定 | 通過 |
| コマンド | `node ecology/engine.test.mjs` |
| exit code | 0（538 checks） |
| 対象commit | `ea27f90` |
| 証拠 | `ecology/engine.test.mjs` |

| R5 Gate C の必須fixture | 結果 |
|---|---|
| 同一入力100回のJSON深一致 | `fixture_full_party` で100回一致（event ID・chain ID 含む） |
| inputとcontent bundleが変更されない | 実行前後のJSONが一致。加えて fixture content は deep freeze してある |
| damage, barrier, heal, excess の境界 | `fixture_barrier_partial`（部分吸収）、`fixture_barrier_packet`（期限順・全吸収は damage_taken を出さない）、`fixture_core`（heal 0 と excess 5）、`fixture_broken_equipment`（excess = max(0, 4-0-1) = 3） |
| 複数interruptの固定順序 | `fixture_cover` で cover が2件、initiative rank 順（lancer→warden）に発火し、対象が2段階で移る |
| 先行反応による後続反応のcost不足の再評価 | `fixture_cost_contest`：priority 100 が唯一のRPを払い、priority 200 は発火しない |
| coverによる target_changed | 同上。`action_started` の対象が最終的な相手になる |
| preparation の自己activation完成と外部advance完成 | `fixture_preparation`（次のactivationで完成、その activation は通常行動へ進まない）、`fixture_external_advance`（`urging` が同じ chain 内で完成させる） |
| AP取得による queue末尾再行動 | `fixture_requeue`：敵の activation を挟んでから2回目が来る＝末尾に入っている |
| broken equipment が後続ruleを供給しない | `fixture_broken_equipment`：発火中のruleは完走し、以後の `excess_damage` には反応しない |
| actor_defeated reaction 後に objective 判定 | `fixture_core`：`actor_defeated` → `scavenge_ap` → `battle_ended` の順 |

追加で固定したもの: イベントIDがsequenceから決まること、親イベントが必ず先行すること、
initiative の並び、対象クエリの暗黙tie-break（入力順を逆にしても同じ相手）、
hp_percent の整数比較（ちょうど50%が `lte` を満たす）、region rule、
ラウンド終了処理で作られた round barrier が失効しないこと、README のvalues表が全35イベントを覆うこと。

未確認項目: なし。

## Gate D — 停止

| 項目 | 内容 |
|---|---|
| 判定 | 通過 |
| コマンド | `node ecology/termination.test.mjs` |
| exit code | 0（108 checks） |
| 対象commit | `ea27f90` |
| 証拠 | `ecology/termination.test.mjs` |

R5 §14 の5標本は**全て安全制約で停止**する（PREFLIGHT §6 の予告どおり）。

| 標本 | 停止のしかた | 結果 | events / maxChain |
|---|---|---|---|
| AP相互付与（`ap_loop` ×2） | 同 owner 同 rule は 1 chain 1回 | win | 61 / 9 |
| damage_taken 相互（`damage_echo` ×2） | 同上 | win | 33 / 12 |
| barrier_gained 自己（`barrier_bloom`） | 同上 | win | 27 / 8 |
| preparation_advanced 自己（`prep_spiral`） | 同上 | win | 42 / 8 |
| 装備が自分の摩耗に反応（`hungry_plate`） | 同上＋耐久 | win | 27 / 8 |

安全制約と循環エラーの区別（R5 §14「明示する」）:

- **安全制約で停止**（正常終了・例外にしない）: 同 owner 同 rule は 1 chain 1回、
  1 actor 1 round に 8 activation まで。
  黙って落ちないことは、余った資源が `resource_unused` に出ることで担保する。
  `fixture_activation_cap` で両者が上限8ちょうどに達し、未使用APが記録されることを検査した。
- **循環エラー**（例外・部分結果を返さない）: `maxEventsPerChain` / `maxEventsPerBattle` 到達。

エラー側の標本（PREFLIGHT §6 で追加）:

| 標本 | 期待 | 実測 |
|---|---|---|
| `fixture_free_action`（apCost 0 の常時使用可能技能） | `maxEventsPerBattle` で例外 | 例外。診断の currentActorId = `a_scout`、round = 1 |
| `fixture_full_party` に `maxEventsPerChain: 6` | chain上限で例外 | 例外。limitValue 6、chainId あり |
| `fixture_core` に `maxEventsPerBattle: 12` | battle上限で例外 | 例外。limitValue 12 |
| `fixture_core` に `maxEventsPerChain: 10` | 発火中ruleがスタックに残る | `overflow_care_rule` / owner `a_mender` / listenTo `excess_healing` / 起点イベントID |

診断の必須項目（R5 §14）は9項目すべてを検査した:
battleId, round, current actor, chainId, event sequence, parent event,
rule activation stack, 直近20イベント, 各ruleのchain発火回数。

余裕率（R5 Gate D「正常fixtureは maxEvents の10%未満」）:

- 正常fixture 23件の最大: **315 / 4096 = 7.7%**（`fixture_full_party`）、chain最大 **14 / 256 = 5.5%**。
- 参考: termination fixture `fixture_activation_cap` は chain 30（11.7%）。これは正常fixtureではなく、
  上限に当てにいくための標本である。
- 余裕率そのものは安全性の証拠にならない（PREFLIGHT §12）。分子と分母を両方書いたのはそのため。

未確認項目: なし。

## Gate E — データ追加による拡張

| 項目 | 内容 |
|---|---|
| 判定 | 通過 |
| コマンド | `node ecology/extensibility.test.mjs` |
| exit code | 0（31 checks） |
| 対象commit | `ea27f90`（`ab83135` との差分） |
| 証拠 | `ecology/extensibility.test.mjs`, 下記 git diff |

4件とも `fixture-content.mjs` へのデータ追加と `fixtures.mjs` の戦闘入力だけで実現した。

| R5 Gate E の要求 | 追加したデータ | 実測 |
|---|---|---|
| HP半分以下の味方を回復し、余剰回復を別の味方へ渡す技能 | active `triage` + reactive `triage_relay` | 半分以下の味方だけを選び、要求8・実効7・余剰1、余剰1が別の味方へ |
| 移動後の次行動を強化する装備 | equipment `momentum_rig` | 移動直後に `focused` を付与、次の攻撃が 4 → 5、耐久1消費 |
| 未使用APをround barrierへ変える人物signature | character `pivot` の signatureRule | 未使用AP 2 → 防壁2、次ラウンドまで残り、被弾2を吸収 |
| 準備中の敵を優先する敵tactic | enemy `husk_hunter` + active `hunt_the_slow` | 1R目は準備中の相手を狙い、誰も準備していない2R目は tactic 順で通常攻撃へ落ちる |

エンジンコードが変わっていないことの証明:

~~~sh
$ git diff --stat ab83135 ea27f90 -- ecology/engine.mjs ecology/effects.mjs \
    ecology/predicates.mjs ecology/selectors.mjs ecology/values.mjs \
    ecology/event-queue.mjs ecology/schema.mjs ecology/validate.mjs ecology/actors.mjs
（出力なし）

$ git diff --stat ab83135 ea27f90
 ecology/check.mjs              |   1 +
 ecology/extensibility.test.mjs | 121 ++++++++++++++++++++++++++++++++
 ecology/fixture-content.mjs    | 155 +++++++++++++++++++++++++++++++++++++++++
 ecology/fixtures.mjs           |  58 +++++++++++++++
 4 files changed, 335 insertions(+)
~~~

変わったのは、コンテンツ、戦闘入力、テスト、テストランナーの一覧だけである。
新しい述語・効果・イベントは1つも要らなかった。

未確認項目: なし。

## Gate F — 連鎖採掘

| 項目 | 内容 |
|---|---|
| 判定 | 通過 |
| コマンド | `node ecology/mine.test.mjs` |
| exit code | 0（754 checks） |
| 対象commit | `ea27f90` |
| 証拠 | `ecology/mine.mjs`, [MINING_SAMPLE.json](./MINING_SAMPLE.json) |

プール `fixture_pool_1`（人物3 × アクティブ3 × リアクティブ3 × 装備3 = 81 build、戦闘2件）:

- buildsEvaluated 81、battlesEvaluated 162、エラー0。
- **uniqueChainFingerprints 80**（合格条件は2件以上）。
- 同じプールを2回採掘して JSON 一致。
- fingerprint は instance ID（`mine_ally` 等）と event ID を含まず、
  イベント型・source定義ID・対象関係（self / same_side / opposing_side）・
  rule／skill定義ID・tags・因果の深さを残す。
- エラーが隠れないこと: `idle_shuffle` を含むプールを採掘すると、その build が
  `errors` に診断つきで載り、`battlesEvaluated` に数えられず、健全な build の結果は残る。

**Gate F の合格は「面白いコンボが見つかった」ではない。**
fingerprint の数は粒度の選び方で動く。どれを候補とみなすかは設計担当へ戻す（R5 §20）。

未確認項目: MINING_SAMPLE.json は全量ではなく切り詰めた標本（先頭4 build、先頭8 fingerprint）。
全量は同ファイル内の再現コマンドで出せる。

## 失敗時の反例（記録）

実装中に検査で落として直したもの。

1. **ラウンド終了処理で作られた round barrier が、その場で失効していた。**
   §11.6 の順序どおりだと「未使用APをround barrierに変える」（Gate E の3件目）が恒偽になる。
   `round_ended` 以降に作られた packet / status は失効対象から外すよう直した。
2. **行動に成功した直後にも `action_skipped` が出ていた。** §11.3-8 の読みを
   「一度も行動しなかった activation にだけ」へ直した。
3. **`roundsUsed` がラウンド途中の決着で0のままだった。** 決着したラウンドを使ったラウンド数に数えるよう直した。
