# ecology — 創発的ルールエンジン v1

[EXP-18 R5](../analysis/experiments/exp-18/R5_EMERGENT_RULE_ENGINE_IMPLEMENTATION_HANDOFF.md) の実装。
戦闘ルールだけを持つ決定的なエンジンで、UIも公開もD1も持たない。
面白さは証明していない。次の設計段階で、人物・技能・装備を増やしたときに
どの連鎖が自然発生するかを観測できる土台を作るためのものである。

`frontier/` は変更していない。あちらは R1 の教材として残す。

## 実行

~~~sh
node ecology/check.mjs        # 9本まとめて（exit code を検査する）
node ecology/schema.test.mjs
node ecology/engine.test.mjs
node ecology/termination.test.mjs
node ecology/extensibility.test.mjs
node ecology/mine.test.mjs
node ecology/playable.test.mjs
node ecology/contract.test.mjs  # content contract の深一致（R7 Milestone 0）
node ecology/phase-a.test.mjs   # block / guard / 多段 / 範囲 / reach（旧 Phase A 由来の戦闘契約）
node ecology/phase-b.test.mjs   # 3幕12戦、難易度、報酬、進行（現行 Phase B）
~~~

外部依存なし。Node標準のみ。`analysis/check-all.sh` からも呼ばれる。


## content はどこにあるか

遊べる版の定義は `ecology/content/` に**種類別**で置いてある（R7 Milestone 0）。

| 触りたいもの | ファイル |
|---|---|
| 行動技能 | `content/skills-active.mjs` |
| 反応技能 | `content/skills-reactive.mjs` |
| 固定装備 | `content/equipment-fixed.mjs` |
| 仲間（engine 定義） | `content/characters.mjs` |
| 仲間（役割・図像・初期の技能） | `content/roster.mjs` |
| 敵 unit と狙いの説明文 | `content/enemies.mjs` |
| 旧 Phase A の配置 | `content/encounters.mjs` |
| 現行 Phase B の3幕12戦 | `content/expedition.mjs` |
| 技能ツリーと表示文 | `content/skill-tree.mjs` |
| bundle の組み立て・contract 版・引退 ID | `content/index.mjs` |

`playable-content.mjs` は既存の import を壊さないための adapter で、
**新しい定義を足す場所ではない。**

定義を足したり数値を動かしたりすると `ecology/contract.test.mjs` が落ちる。
それは正しい落ち方なので、差分を読んでから
`node ecology/contract-snapshot.mjs --write` で凍結を作り直すこと。

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

- interrupt は、pending frame を持つ5イベント（`action_declared` / `target_selected` /
  `damage_proposed` / `healing_proposed` / `barrier_proposed`）でのみ、**その場で同期的に**処理する。
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
| `barrier_proposed` | amount（interrupt前の提案値）, duration | duration |
| `barrier_gained` | amount, proposed, duration, barrierTotal | duration |
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
| `equipment_repaired` | equipmentId, before, amount, after | — |
| `block_proposed` | amount | — |
| `block_gained` | amount, before, after | — |
| `damage_blocked` | proposed, blockBefore, blockAfter | tags of the blocked damage |
| `block_spent` | amount, before, after | — |
| `pending_amount_modified` | operation, before, after, delta, proposalEventId | operation |

イベントに表示用の文章は入れない。事実だけを入れ、表示側が再生する。

`damage_proposed.amount` は**interrupt前**の値、`damage_taken.proposed` は**interrupt後**の値である。
`healing_proposed` / `barrier_proposed` も同じ形をとる。

**量を変えた rule は `pending_amount_modified` に残る。** 差分が見えるだけでは
「誰のどの規則が +1 したか」を再生できないので、変更ごとに1件記録する。
このイベントは listen できない（validatorが拒否する）。他人のinterrupt窓の内側で
反応が走ることになるため。

## 細かい意味

- **`damage_taken` は実際にHPが減ったときだけ出る。** 全部が防壁に吸われた場合は
  `damage_proposed` と `barrier_damaged` だけが残る（§12.1-9）。
- **防壁は packet 単位**で、期限が早い順（round → battle）、同期限なら作成順に消費する。総量上限は設けない。
- **0HPのactorはheal対象にしない。** 復活はv1に無い。
- **`not_previous_target`** は「この chain で直前に解決された効果の対象」を除く。
  余剰回復を別の味方へ渡す規則は、これで自分が今治した相手を避けている。
- **status の duration**: `turn` は保持者の activation 終了時、`round` はラウンド終了時、`battle` は戦闘中ずっと。
- **壊れた装備**は以後 rule を供給しない。ただし**発火中の rule は途中で取り消さない**（§12.6）。
- **修理は maxDurability で止まり、壊れた装備を復活させない。** 耐久0の装備はその戦闘のあいだ死んだままで、
  自分を修理して戻ってくることもできない（rule を供給しないので、そもそも発火しない）。
- **同じ装備を1人が2つ持てない**（validatorが拒否）。§5.7 の発火予算は owner と rule で数えるので、
  2つ目は予算を共有してしまい、どちらの実物が摩耗するかも配列順に依存する。
  2つ目が独立して働くべきかは設計判断なので、実装側では決めずに禁止した。
- **region rule** には owner がいない。`self` の述語・スコープ・コストは validator が拒否し、
  `allies` は味方側、`enemies` は敵側として解決する。
- **objective は定義IDで指定する。** instance ID を目的に埋め込めない。
- **round_limit** は objective 未達のまま maxRounds に達した場合で、結果は `loss`。
- **draw** は双方全滅かつ objective 未達のときだけ。reason は `all_allies_defeated`（v1の語彙に draw 専用の理由が無いため）。

## stalemate を採用しない理由

R5 §11.6 は stalemate 判定を**任意**としている。v1 では採用しない。好みではなく反例がある。

**待つことは正当な戦術である。** v1 は `round_number` と `history_count` を述語として持つので、
「3ラウンド目から使う」「未使用APが累計4以上になったら使う」は普通に書ける。
その待機中、HP・防壁・準備・状態・装備耐久のどれも動かない。
2ラウンド連続の無変化で draw にすると、**その技能は一度も撃てないまま試合が終わる。**

~~~text
tactics: [{ activeSkillId: "strike", useWhen: [{ type: "round_number", op: "gte", value: 3 }] }]
→ 採用していたら2ラウンド目終わりで draw。strike は永遠に発動しない。
~~~

hash にラウンド数や履歴を足しても直らない。どちらも毎ラウンド変わるので、
今度は判定が一度も成立しなくなる（恒偽の分岐が残るだけ）。

したがって、何も動かない試合を終わらせるのは `round_limit` だけである。
`fixture_inert`（何も起きない試合が maxRounds で終わる）と
`fixture_waiting_tactic`（上の反例。3ラウンド目に撃てる）でこの挙動を固定している。
`stalemate` は R5 §4.1 の reason 一覧に残っているが、**v1 は決して返さない。**

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

いずれも v1 語彙の穴を塞ぐための追加で、**R5 §1.2 の不変条件は1つも変えていない。**
理由と反例は [PREFLIGHT](../analysis/experiments/exp-18/A5_RULE_ENGINE/PREFLIGHT.md)。

| # | 追加したもの | 無いと何が書けないか |
|---|---|---|
| 1 | filter `is_event_source` | 「このイベントを起こしたのは自分か」。§15.4 の強化 status が書けない。代用は保持者が2人以上で二重適用になる |
| 2 | event `barrier_proposed` | §15.4 の「次の**防壁**量を+1」。防壁だけ提案イベントが無く、interrupt窓が開かない |
| 3 | event `pending_amount_modified` | 量を変えた rule の身元。R5 §1.2「全ての状態変化は因果イベントから追跡できる」を満たせない |
| 4 | effect `repair_equipment` / event `equipment_repaired` | §15.3 の「自分を1修理する装備」。耐久を戻す手段が無く、負の amount も禁止されている |

削ったもの: **stalemate 判定**（R5 §11.6 の任意項目。上の反例のため採用しない）。

その他の決め（round_limit の勝敗、draw の reason、activation上限の扱い、region rule の制約、
ラウンド終了の drain 位置、同一装備の重複禁止）は R5 が未定義だった箇所で、PREFLIGHT に理由を書いてある。

