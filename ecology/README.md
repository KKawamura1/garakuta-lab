# ecology — 創発的ルールエンジン v1

[EXP-18 R5](../analysis/experiments/exp-18/R5_EMERGENT_RULE_ENGINE_IMPLEMENTATION_HANDOFF.md) の実装。
戦闘ルールだけを持つ決定的なエンジンで、UIも公開もD1も持たない。
面白さは証明していない。次の設計段階で、人物・技能・装備を増やしたときに
どの連鎖が自然発生するかを観測できる土台を作るためのものである。

`frontier/` は変更していない。あちらは R1 の教材として残す。

## 実行

~~~sh
node ecology/check.mjs        # 5本まとめて（exit code を検査する）
node ecology/schema.test.mjs
node ecology/engine.test.mjs
node ecology/termination.test.mjs
node ecology/extensibility.test.mjs
node ecology/mine.test.mjs
~~~

外部依存なし。Node標準のみ。`analysis/check-all.sh` からも呼ばれる。

## ファイル

| ファイル | 責務 |
|---|---|
| `schema.mjs` | v1語彙の凍結リスト（イベント、述語、フィルタ、コスト、効果、上限） |
| `validate.mjs` | コンテンツと戦闘入力の検査。未知の名前・参照切れ・上限違反を拒否 |
| `errors.mjs` | 検証エラーと実行時エラー（診断つき） |
| `actors.mjs` | 戦闘状態の読み取り補助と履歴カウンタ |
| `predicates.mjs` | §8 の11述語 |
| `selectors.mjs` | §9 の対象クエリ |
| `values.mjs` | §10.3 の効果量 |
| `effects.mjs` | §10.1 コストと §12 原子的効果 |
| `event-queue.mjs` | イベント列、chain、上限、診断 |
| `engine.mjs` | 公開API、進行順、反応の発火順、勝敗 |
| `fixture-content.mjs` | §15 の検査用コンテンツ（本番コンテンツではない） |
| `fixtures.mjs` | 戦闘入力 |
| `mine.mjs` | §16 F 連鎖採掘 |
| `check.mjs` | 全テストの実行 |

## 公開API

~~~js
import { simulateBattle, validateBattleInput, validateContentBundle } from "./ecology/engine.mjs";
import { mineBuilds, fingerprintEventChain } from "./ecology/mine.mjs";
~~~

- `simulateBattle(input, contentBundle, options)` — 成功時は `ecology-result-1` を返す。
  不正コンテンツ、上限到達、未実装効果では**部分的な結果を返さず例外**にする。
- `validateContentBundle(bundle)` / `validateBattleInput(input, bundle)` — `{path, code, message}` の配列。空なら妥当。
- 既定 options: `{ maxEventsPerChain: 256, maxEventsPerBattle: 4096, maxActivationsPerActorPerRound: 8 }`

`simulateBattle` は input と contentBundle を変更しない。Date も Math.random も使わない。
同じ引数なら event ID・chain ID を含めて JSON 深一致する（`engine.test.mjs` が100回で確認）。

## 進行順（外から観測される順序）

R5 §11.5 は内部実装を委任しているので、ここに書いた順序を正とし、テストで固定している。

1. `battle_started` → after反応 → 勝敗確認
2. 各ラウンド:
   1. AP/RP を base へ refresh（`resource_refreshed`。**v1ではlisten不可**、validatorが拒否する）
   2. `round_started` → after反応
   3. initiative は speed 降順、同値は position 順、instanceId 順。**sideは鍵に入れない**
   4. queue から順に activation
   5. `round_ended` → after反応
   6. 未使用 AP/RP を `resource_unused`（0のときは出さない）→ after反応
   7. round barrier の失効 → after反応
   8. round status の除去 → after反応
   9. AP/RP を0にする
   10. 勝敗確認 → stalemate 判定
3. `battle_ended`

**6〜8の各段階の直後に after queue を drain する。** R5 §11.6 の字面（全部終わってから解決）だと、
`resource_unused` に反応して RP を払う規則が恒偽になる（RPは9で0になっている）。
理由は [PREFLIGHT §4](../analysis/experiments/exp-18/A5_RULE_ENGINE/PREFLIGHT.md)。

**ラウンド終了処理の途中で作られた round barrier / round status は失効しない。**
「未使用APを round barrier に変える」規則が、作った次の段階で消えるのを避けるため、
`round_ended` より後に作られたものは次のラウンドのものとして扱う。

### activation

1. 死亡していれば skip
2. `actor_activated`
3. 準備中なら1段進めて activation 終了（完成した場合は completionEffects まで）
4. 準備中でなければ、APがあり使える tactic がある限り優先順に行動する
5. **一度も行動しなかった activation にだけ** `action_skipped` を1件記録する
   （行動した後にAPが尽きた場合は skip ではない。余りは `resource_unused` に出る）
6. activation 終了後にAPを得た actor は、生存・非準備中・queue未在・当該roundのactivationが8未満、
   を全て満たすとき queue 末尾へ一度だけ戻る

### 能動行動

`action_declared`(interrupt窓) → `target_selected`(interrupt窓) → 再検証 → コスト一括支払い
→ `action_cost_paid` → `action_started` → 効果 → 準備の作成 → `action_resolved` → after反応を全部解決 → 勝敗確認。

技能の効果は `action_started` を「現在のイベント」として解決する。したがって
`scope: "event_targets"` は「この行動が実際に狙っている相手」を意味し、cover で対象が変わった後も正しい。

### 反応

- interrupt は、pending frame を持つ4イベント（`action_declared` / `target_selected` /
  `damage_proposed` / `healing_proposed`）でのみ、**その場で同期的に**処理する。
- after は chain の queue へ入れ、chain の末尾で FIFO に処理する。
- 発火順は priority 昇順 → owner の initiative rank → owner の position → owner instanceId → rule id。
- 候補は列挙時に一度確定し、各ruleは**発火直前に**owner生存・装備耐久・status残存・limit・述語・コストを再評価する。
  先行反応で条件が崩れたものは発火しない（`fixture_cost_contest` が証人）。
- 同一 owner の同一 rule は **1 chain に 1 回**だけ発火する。limit が round / battle でもこの制約が上乗せされる。

## イベントの values

必須キーの表。`tags` は付随情報で、`event_tag` 述語から読める。

| イベント | values | tags |
|---|---|---|
| `battle_started` | objective, maxRounds, allies, enemies | — |
| `round_started` | round | — |
| `actor_activated` | activation, round | side |
| `round_ended` | round | — |
| `battle_ended` | result, reason, roundsUsed | — |
| `action_declared` | apCost, targetCount | 技能のtags |
| `target_selected` | targetCount | 技能のtags |
| `target_changed` | from, to | redirect |
| `action_cost_paid` | apCost, actionPoints | — |
| `action_started` | targetCount | 技能のtags |
| `action_resolved` | targetCount | 技能のtags |
| `action_skipped` | actionPoints, reason | — |
| `action_canceled` | reason, byRuleId, byActorId | — |
| `preparation_started` | steps, stepsRemaining | — |
| `preparation_advanced` | before, amount, after | — |
| `preparation_completed` | steps | — |
| `preparation_interrupted` | cause, stepsRemaining | actor_defeated / effect |
| `damage_proposed` | amount（interrupt前の提案値） | 効果のtags |
| `barrier_damaged` | amount, packetRemaining, duration | cost（コスト消費時） |
| `barrier_broken` | duration, barrierTotal | cost |
| `damage_taken` | amount, hpBefore, hpAfter, proposed, barrierAbsorbed | 効果のtags / cost |
| `excess_damage` | amount, proposed, barrierAbsorbed, hpBefore | 効果のtags |
| `healing_proposed` | amount | 効果のtags |
| `healing_applied` | requested, actual, hpAfter | 効果のtags |
| `excess_healing` | amount, requested, actual | 効果のtags |
| `barrier_gained` | amount, duration, barrierTotal | duration |
| `barrier_expired` | amount, duration, barrierTotal | round |
| `actor_defeated` | definitionId, side | side |
| `resource_refreshed` | actionPointsBefore, actionPoints, reactionPointsBefore, reactionPoints | — |
| `resource_spent` | resource, amount, before, after | 資源名 |
| `resource_gained` | resource, amount, before, after | 資源名 |
| `resource_unused` | resource, amount | 資源名 |
| `actor_moved` | from, to, rowChanged | swap |
| `status_added` | statusId, added, stacks, duration | polarity, duration |
| `status_removed` | statusId, removed, remaining, cause | effect / round / turn |
| `equipment_worn` | equipmentId, before, amount, after | cost |
| `equipment_broken` | equipmentId | cost |

イベントに表示用の文章は入れない。事実だけを入れ、表示側が再生する。

`damage_proposed.amount` は**interrupt前**の値、`damage_taken.proposed` は**interrupt後**の値である。
両者の差が、interrupt で加減された量になる。

## 細かい意味

- **`damage_taken` は実際にHPが減ったときだけ出る。** 全部が防壁に吸われた場合は
  `damage_proposed` と `barrier_damaged` だけが残る（§12.1-9）。
- **防壁は packet 単位**で、期限が早い順（round → battle）、同期限なら作成順に消費する。総量上限は設けない。
- **0HPのactorはheal対象にしない。** 復活はv1に無い。
- **`not_previous_target`** は「この chain で直前に解決された効果の対象」を除く。
  余剰回復を別の味方へ渡す規則は、これで自分が今治した相手を避けている。
- **status の duration**: `turn` は保持者の activation 終了時、`round` はラウンド終了時、`battle` は戦闘中ずっと。
- **壊れた装備**は以後 rule を供給しない。ただし**発火中の rule は途中で取り消さない**（§12.6）。
- **region rule** には owner がいない。`self` の述語・スコープ・コストは validator が拒否し、
  `allies` は味方側、`enemies` は敵側として解決する。
- **objective は定義IDで指定する。** instance ID を目的に埋め込めない。
- **round_limit** は objective 未達のまま maxRounds に達した場合で、結果は `loss`。
- **draw** は双方全滅かつ objective 未達のときだけ。reason は `all_allies_defeated`（v1の語彙に draw 専用の理由が無いため）。

## stalemate の判定

R5 §11.6 の任意項目を採用した。ラウンド終了ごとに次の state hash を取り、
**直近3件（＝2ラウンド連続で変化なし）が一致したら `draw` / `stalemate`** とする。

~~~text
hash = actorごとに "instanceId:hp:防壁合計:準備残り:status(id:stacks を昇順):装備(instanceId:durability):生存"
       を "|" で連結し、"#" と objective 進捗を付ける
~~~

fixture は `fixture_stalemate`（`STALEMATE_BATTLE`）。
tactic を持たない味方と、tactic も rule も持たない敵 `still_husk` を置き、maxRounds 9 に対して
2ラウンド目の終わりで stalemate になる（round_limit より先に出ることをテストで固定している）。

## 停止

- **安全制約による停止**（正常終了する）: 同 owner 同 rule は1 chainに1回、1 actorは1 roundに8 activationまで。
  余った資源は `resource_unused` に出るので、黙って落ちることはない。
- **診断つきエラー**（例外、部分結果を返さない）: `maxEventsPerChain` / `maxEventsPerBattle` 到達、
  未知の effect / predicate / scope への到達。
  例外は battleId, round, 現在のactor, chainId, event sequence, parent event,
  rule発火スタック, chainごとのrule発火回数, 直近20イベントを持つ。

v1では、単一 chain は「同 owner 同 rule は1回」で構造的に停止する。
停止しないのは activation 内の行動ループ（apCost 0 の常時使用可能技能）で、
これは `maxEventsPerBattle` でエラーになる。`fixture_free_action` が証人。

## v1で実装していないもの

- 予約イベント（`wave_started`, `defeat_prevented`, `actor_revived`, `action_repeated`, `frontline_opened`）。
  参照すると validator error になる。
- 空き枠への移動、敵味方間の交換、押し出し（移動は `swap_positions` だけ）。
- 復活、自傷による戦闘不能。
- 装備の修理（耐久を戻す effect が無い）。
- 防壁量の interrupt 変更（`gain_barrier` に提案イベントが無い）。

## R5からの逸脱

1. **`is_event_source` フィルタを1件追加した。** v1の語彙では「このイベントを起こしたのは自分か」を書けず、
   §15.4 の強化 status が表現できない。代用（`has_status(subject: event_source)`）は保持者が2人以上いると
   二重適用になる。詳細と反例は
   [PREFLIGHT §1](../analysis/experiments/exp-18/A5_RULE_ENGINE/PREFLIGHT.md)。
2. **§15.3 の「1修理する装備」を回復へ置換した。** v1に耐久を戻す effect が無い。PREFLIGHT §2。

その他の決め（round_limit の勝敗、draw の reason、activation上限の扱い、region rule の制約、
ラウンド終了の drain 位置）は R5 が未定義だった箇所で、PREFLIGHT に理由を書いてある。
