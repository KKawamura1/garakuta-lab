# EXP-18 R5 — 創発的ルールエンジン実装委譲票

更新日: 2026-08-29（UTC）  
状態: 実装担当へ渡せる実装要求。人間テストはまだ行わない。  
依頼先: モデルを限定しない実装・検査担当1名。サブエージェント、別レビュー担当は追加しない。  
前提: [R2](./R2_CORE_REJECTION_AND_SYSTEM_SCALE.md) → [R3](./R3_CHARACTER_FIRST_CONTEXT.md) → [R4](./R4_EMERGENT_RULE_ECOLOGY_AND_LONG_TERM_EXPANSION.md)

## 0. この票の結論

次に実装するのはゲーム画面ではない。

数人〜十数人の永続キャラクターへ、多数の技能・装備を付け、共通イベントから設計者未列挙の相互作用を生める、決定的な戦闘ルールエンジンを実装する。

今回の納品物は次である。

- ecology/配下の純粋な戦闘エンジン。
- データ駆動の人物、技能、装備、敵、状態定義。
- 決定的なイベント列。
- 反応、準備、位置交換、行動権再取得、余剰量、装備消耗の基礎。
- 無限連鎖、参照不正、発動不能を落とす検査。
- 小規模な構成探索とイベント連鎖採掘。
- 要求トレーサビリティとGate結果。

今回、実装しないもの:

- ブラウザUI。
- Cloudflare公開。
- D1保存。
- 本番キャラクター名、立ち絵、物語。
- 12アクティブ、12リアクティブ、18装備の本番コンテンツ。
- 遠征画面と長期キャンペーン。
- 面白さの合否判定。
- 既存frontier/の改造。

まず、後からコンテンツを増やしても個別条件分岐を増やさず、同じ入力から同じ因果列を返し、停止する基盤を作る。

## 1. 目的・不変条件・委任するHOW

### 1.1 目的

R4の「設計者は完成コンボを作らず、単独でも働く小規則と共通イベントを作る」を、実行可能なデータ形式と決定的イベント処理へ変換する。

この実装で面白さは証明しない。

次の設計段階で、人物・技能・装備を増やし、実際にどの連鎖が自然発生するかを観測できる状態を作る。

### 1.2 不変条件

実装担当は次を変更しない。

- 味方の本編編成上限は4人。
- 人物は固有能力を持ち、アクティブ2、リアクティブ2、装備2を付けられる。
- 戦闘は決定的で、戦闘内の命中、対象、威力、発動に乱数を使わない。
- 行動権と反応権を別資源にする。
- アクティブ技能は優先順で選ばれる。
- リアクティブ技能は共通イベントを読む。
- 技能や装備から、人物名・特定の相方IDを参照しない。
- 個別人物・技能・装備・敵をエンジンのif文へ書かない。
- 全ての状態変化は因果イベントから追跡できる。
- 無料循環を黙って打ち切らない。検査または実行エラーにする。
- frontier/は変更しない。
- UI、公開、人間テストへ進まない。

### 1.3 委任するHOW

次は実装担当が改善してよい。

- ecology/内部のファイル分割。
- 関数名、内部クラス、イミュータブル／コピー方式。
- テスト補助関数。
- 探索の列挙順と効率化。
- エラーメッセージの追加。
- JSON Schema、手書きvalidator、JSDocの選択。
- Node標準機能内での実装方式。

ただし外部依存を追加する場合は、その必要性をPREFLIGHT.mdへ書き、標準機能だけでは要求を満たせない反例を示す。原則は依存なしの.mjsとする。

## 2. 開始前に読むもの

実装担当は、コードを書く前に次を読む。

1. AGENTS.md
2. PROJECT_MEMORY.md
3. analysis/CURRENT.md
4. docs/SOL_TERRA_WORKFLOW.md
5. このR5
6. R4
7. frontier/README.md
8. frontier/engine.mjs
9. frontier/core.test.mjs

R1とA1は歴史的教材であり、R2以降と矛盾するときはR2〜R5を優先する。

## 3. 既存コードの扱い

### 3.1 残すもの

frontier/から、考え方として次を残す。

- 戦闘エンジンがUIを知らない。
- 同じ入力が完全に同じ結果とイベント列を返す。
- 表示はイベント列を再生し、別の説明計算をしない。
- テストが数値だけでなく必要イベントの存在を確認する。
- 内容定義とエンジンを分ける。

### 3.2 捨てるもの

次を新エンジンへコピーしない。

- 三拍固定。
- 味方一体につき行動一つ。
- ram、echo、capacitorなどの機体固有分岐。
- actAlly内のaction.typeごとのゲームコンテンツ分岐。
- 群れ／要塞ごとの分類問題。
- lastAllyAttackのような特定コンボ専用状態。
- missionIdに埋め込んだ特定目的だけの処理。

### 3.3 新規配置

新実装はecology/へ置く。

推奨構成は次だが、同じ責務分離を保てば変更してよい。

~~~text
ecology/
  README.md
  schema.mjs
  validate.mjs
  engine.mjs
  event-queue.mjs
  predicates.mjs
  selectors.mjs
  effects.mjs
  fixture-content.mjs
  fixtures.mjs
  schema.test.mjs
  engine.test.mjs
  termination.test.mjs
  extensibility.test.mjs
  mine.mjs
  mine.test.mjs
~~~

## 4. 公開API

ecology/engine.mjsは少なくとも次をexportする。

~~~js
export function simulateBattle(input, contentBundle, options = {})
export function validateBattleInput(input, contentBundle)
~~~

ecology/validate.mjsは少なくとも次をexportする。

~~~js
export function validateContentBundle(contentBundle)
~~~

ecology/mine.mjsは少なくとも次をexportする。

~~~js
export function mineBuilds(miningInput, contentBundle, options = {})
export function fingerprintEventChain(battleResult)
~~~

### 4.1 simulateBattle

成功時:

~~~js
{
  schemaVersion: "ecology-result-1",
  contentVersion: "fixture-1",
  battleId: "fixture-battle",
  result: "win" | "loss" | "draw",
  reason:
    | "objective_met"
    | "all_allies_defeated"
    | "round_limit"
    | "stalemate",
  roundsUsed: 3,
  actors: [/* 最終snapshot */],
  equipment: [/* 最終durability */],
  events: [/* 完全な因果列 */],
  metrics: {/* 検査と採掘用 */},
}
~~~

不正コンテンツ、イベント上限、無料循環、未実装effectへ遭遇した場合は、部分的な正常結果を返さず例外にする。例外には少なくともbattleId、round、chainId、event sequence、ruleIdを含める。

### 4.2 純粋性

simulateBattleは次を満たす。

- inputとcontentBundleを変更しない。
- Date、Math.random、暗黙のグローバル状態を使わない。
- 同じ引数ならJSON深一致する。
- event ID、chain ID、instance IDも一致する。
- ログへ実時間を入れない。

採掘側でseed付き疑似乱数を使うことは許容するが、戦闘側へ持ち込まない。

## 5. コンテンツスキーマ

以下は概念型である。実装はJSDoc、検証関数、JSON Schemaのいずれでもよいが、意味を変えない。

### 5.1 ContentBundle

~~~ts
type ContentBundle = {
  schemaVersion: "ecology-content-1";
  contentVersion: string;
  characters: Record<string, CharacterDef>;
  activeSkills: Record<string, ActiveSkillDef>;
  reactiveSkills: Record<string, ReactiveSkillDef>;
  equipment: Record<string, EquipmentDef>;
  statuses: Record<string, StatusDef>;
  enemyActors: Record<string, EnemyActorDef>;
};
~~~

全IDはcontentBundle内で安定、一意、ASCIIのlower_snake_caseまたはdot区切りとする。本番表示名は別フィールドであり、IDを表示名として使わない。

### 5.2 CharacterDefとEnemyActorDef

~~~ts
type CharacterDef = {
  id: string;
  displayName: string;
  maxHp: number;
  speed: number;
  baseActionPoints: number;
  baseReactionPoints: number;
  signatureRules: RuleDef[];
  tags: string[];
};

type EnemyActorDef = {
  id: string;
  displayName: string;
  maxHp: number;
  speed: number;
  baseActionPoints: number;
  baseReactionPoints: number;
  tactics: TacticDef[];
  reactiveSkillIds: string[];
  intrinsicRules: RuleDef[];
  tags: string[];
};
~~~

数値は有限の安全整数。HP、speed、資源、効果量は0以上。負の変化はeffect typeで表す。

### 5.3 Loadoutと戦闘入力

~~~ts
type BattleInput = {
  schemaVersion: "ecology-battle-1";
  battleId: string;
  maxRounds: number;
  objective: ObjectiveDef;
  allies: AllyInput[];
  enemies: EnemyInput[];
  regionRules?: RuleDef[];
};

type AllyInput = {
  instanceId: string;
  characterId: string;
  position: Position;
  tactics: TacticDef[];
  reactiveSkillIds: string[];
  equipment: EquipmentInput[];
  hp?: number;
};

type EnemyInput = {
  instanceId: string;
  enemyActorId: string;
  position: Position;
  hp?: number;
};

type EquipmentInput = {
  instanceId: string;
  equipmentId: string;
  durability: number;
};

type TacticDef = {
  activeSkillId: string;
  useWhen: PredicateDef[];
};
~~~

本編ではalliesは4人とする。エンジンfixtureでは境界検査のため1〜4人を許容する。enemiesはv1で1〜4人。同じside内でpositionは重複不可。

TacticDefの配列順が優先順である。最大2件。useWhenは最大2条件。技能自身の条件とuseWhenをANDで評価する。

### 5.4 Position

v1の位置は次の四つだけ。

~~~ts
type Position =
  | "front_left"
  | "front_right"
  | "rear_left"
  | "rear_right";
~~~

順序は上記の列挙順。決定性のtie-breakにも使う。

v1の移動effectはswap_positionsだけとする。同じsideの生存者二人の位置を交換する。空き枠への移動、敵味方間の交換、押し出しは将来拡張とし、勝手に実装しない。

### 5.5 ActiveSkillDef

~~~ts
type ActiveSkillDef = {
  id: string;
  displayName: string;
  apCost: number;
  intrinsicPredicates: PredicateDef[];
  targetQuery: TargetQueryDef;
  effects: EffectDef[];
  preparation?: {
    steps: number;
    completionEffects: EffectDef[];
  };
  tags: string[];
};
~~~

preparationがある技能は、使用時に通常effectsを適用した後、completionEffectsをpendingとして保持する。通常effectsが不要なら空配列。

同一人物はpending preparationを一つだけ持てる。準備中に別のpreparation技能を選べない。

### 5.6 ReactiveSkillDef、EquipmentDef、StatusDef

~~~ts
type ReactiveSkillDef = {
  id: string;
  displayName: string;
  rule: RuleDef;
  tags: string[];
};

type EquipmentDef = {
  id: string;
  displayName: string;
  maxDurability: number;
  rules: RuleDef[];
  tags: string[];
};

type StatusDef = {
  id: string;
  displayName: string;
  polarity: "positive" | "negative" | "neutral";
  maxStacks: number;
  duration: "turn" | "round" | "battle";
  rules: RuleDef[];
  tags: string[];
};
~~~

durabilityが0になった装備は壊れ、以後その戦闘ではruleを供給しない。装備そのものは結果から消さない。

### 5.7 RuleDef

~~~ts
type RuleDef = {
  id: string;
  listenTo: EventType;
  timing: "interrupt" | "after";
  priority: number;
  predicates: PredicateDef[];
  costs: CostDef[];
  effects: EffectDef[];
  limit: {
    scope: "chain" | "round" | "battle";
    count: number;
  };
};
~~~

v1では、同じowner instanceの同じruleは一chainに一度しか発火できない。limitがroundまたはbattleでも、この安全制約を追加適用する。allowRepeatInChainのような解除フラグをv1へ作らない。

priorityは小さいほど先。範囲0〜1000。tie-breakは次の順。

1. priority昇順。
2. rule ownerのそのラウンドのinitiative rank昇順。
3. owner position順。
4. owner instanceId辞書順。
5. rule id辞書順。

発火直前にpredicate、cost、owner生存、装備耐久を再評価する。先行反応で条件が崩れた場合は発火しない。

## 6. v1のEventType

v1で実装するイベントは次で固定する。

### 6.1 戦闘とラウンド

- battle_started
- round_started
- actor_activated
- round_ended
- battle_ended

### 6.2 行動

- action_declared
- target_selected
- target_changed
- action_cost_paid
- action_started
- action_resolved
- action_skipped
- action_canceled

### 6.3 準備

- preparation_started
- preparation_advanced
- preparation_completed
- preparation_interrupted

### 6.4 HPと防壁

- damage_proposed
- barrier_damaged
- barrier_broken
- damage_taken
- excess_damage
- healing_proposed
- healing_applied
- excess_healing
- barrier_gained
- barrier_expired
- actor_defeated

### 6.5 資源、位置、状態、装備

- resource_refreshed
- resource_spent
- resource_gained
- resource_unused
- actor_moved
- status_added
- status_removed
- equipment_worn
- equipment_broken

R4にあるwave_started、defeat_prevented、actor_revived、action_repeated、frontline_openedなどは予約語彙であり、v1では実装しない。内容定義から参照された場合はvalidator errorにする。

## 7. CombatEvent

全イベントは少なくとも次を持つ。

~~~ts
type CombatEvent = {
  id: string;
  sequence: number;
  type: EventType;
  round: number;
  chainId: string;
  parentEventId?: string;
  sourceActorId?: string;
  targetActorIds: string[];
  sourceDefinitionId?: string;
  ruleId?: string;
  skillId?: string;
  equipmentInstanceId?: string;
  tags: string[];
  values: Record<string, number | string | boolean | null>;
};
~~~

- idはsequenceから決定的に生成する。
- chainIdは最初の能動行動、ラウンドイベント、外部効果ごとに生成する。
- 反応が生むイベントは元イベントをparentEventIdへ持つ。
- 画面用文章をeventへ保存しない。事実と表示文を分離する。
- valuesの必須キーはイベントごとにREADMEへ表で記載する。
- 定義IDとinstance IDを混同しない。

## 8. v1のPredicateDef

v1は次だけを実装する。任意JavaScript式、文字列eval、コールバックをコンテンツへ許可しない。

- always
- hp_percent
- resource
- position
- has_status
- is_preparing
- event_tag
- event_value
- history_count
- target_exists
- round_number

比較演算子はeq、ne、lt、lte、gt、gte。

subjectは必要な型に限り、次から選ぶ。

- self
- event_source
- event_primary_target
- selected_target
- candidate_target

hp_percentは浮動小数を使わず、hp × 100とmaxHp × thresholdを整数比較する。

history_countのv1 metric:

- active_actions
- reactive_actions
- different_targets
- same_target_streak
- times_moved
- damage_dealt
- damage_taken
- healing_done
- excess_damage
- excess_healing
- unused_action_points
- unused_reaction_points

window:

- chain
- round
- battle

useWhenでプレイヤーが指定できるpredicateは、hp_percent、resource、position、has_status、is_preparing、history_count、round_numberだけとする。event専用subjectを含むpredicateはcontent rule専用。

## 9. TargetQueryDef

~~~ts
type TargetQueryDef = {
  scope:
    | "self"
    | "allies"
    | "enemies"
    | "event_source"
    | "event_targets";
  filters: TargetFilterDef[];
  sort: TargetSortDef[];
  take: 1 | "all";
};
~~~

v1 filter:

- alive
- row_is
- hp_percent
- has_status
- is_preparing
- not_previous_target
- is_event_primary_target

v1 sort:

- hp_asc
- hp_desc
- barrier_asc
- barrier_desc
- speed_asc
- speed_desc
- position_asc
- instance_id_asc

sortの最後には必ずposition_asc、instance_id_ascを暗黙追加し、tieを残さない。

scopeがevent_sourceまたはevent_targetsで、該当actorがいなければ空集合。空集合のtargetを要求するactionは使用不能。after反応は発火直前に再評価する。

## 10. CostDefとEffectDef

### 10.1 CostDef

v1 cost:

- spend_action_points
- spend_reaction_points
- lose_hp
- consume_barrier
- wear_equipment

コストは全て支払える場合にだけまとめて支払う。途中まで支払い、後半で失敗して巻き戻す実装にしない。

lose_hpは自分を0以下にできない。自傷で倒れる仕組みは将来拡張とする。

### 10.2 EffectDef

v1 effect:

- deal_damage
- heal
- gain_barrier
- gain_resource
- add_status
- remove_status
- swap_positions
- start_preparation
- advance_preparation
- interrupt_preparation
- wear_equipment
- modify_pending_amount
- redirect_pending_target
- cancel_pending_action

v1に任意のeffect handler名やスクリプトを入れない。

### 10.3 ValueDef

効果量は次のいずれか。

- constant
- event_value_scaled
- actor_stat_scaled
- status_stacks_scaled

scaledはnumerator、denominatorを持ち、0除算禁止。途中計算は整数、最後にfloor。最終値は0未満にしない。

v1のactor stat:

- max_hp
- current_hp
- barrier
- action_points
- reaction_points
- speed

## 11. 戦闘処理順

### 11.1 初期化

1. contentとbattle inputをvalidateする。
2. inputをdeep copyまたは不変構造から戦闘stateへ展開する。
3. instanceId重複、position重複、参照不正を再確認する。
4. event sequence、chain sequenceを0から開始する。
5. battle_startedを記録し、そのafter反応を処理する。
6. 初期状態だけで勝敗が決まる場合も、battle_started後にbattle_endedを記録する。

### 11.2 ラウンド開始

各ラウンドで次を行う。

1. round内のrule counter、activation counterを初期化。
2. 生存actorのAPとRPをbase値へrefreshする。
3. refreshはresource_refreshedとして記録するが、v1ではリアクションのlisten対象にしない。
4. round_startedを記録し、after反応を処理する。
5. speed降順で初期initiative queueを作る。
6. tieはsideではなく、position順、instanceId順。sideによる暗黙優遇を作らない。

### 11.3 actor activation

queueからactorを取り出す。

1. actorが死亡済みならskip。
2. 一ラウンドのactivation回数が8以上なら循環エラー。
3. actor_activatedを記録。
4. preparation中なら自動で1 step進める。
5. preparationが完了した場合、completionEffectsを解決し、このactivationを終了する。
6. preparationが残る場合も、このactivationを終了する。
7. preparation中でなければ、APがあり、使用可能tacticがある限り優先順に行動する。
8. tacticが一つも使えなければaction_skippedを一回記録し、activationを終了する。
9. APが余っていても、使用可能行動がなければ保持する。
10. activation中にAPを得た場合、そのまま次のtacticを評価する。

actorがactivation終了後にAPを得た場合:

- 生存している。
- preparation中でない。
- queueへまだ存在しない。
- 当該roundのactivation回数が8未満。

この全てを満たすとqueue末尾へ一度だけ再追加する。これが撃破時再行動などの基礎になる。

### 11.4 active action

1. TacticDef順にskillのintrinsicPredicatesとuseWhenを評価。
2. target queryを実行。
3. cost支払可能性を確認。
4. 最初に成立したskillとtargetを選ぶ。
5. pending actionを作る。
6. action_declaredを記録し、interrupt反応を処理。
7. target_selectedを記録し、interrupt反応を処理。
8. cancel、target、costを再検証。
9. costを一括支払い、action_cost_paid。
10. action_started。
11. effectsを配列順に解決。
12. preparation指定があればpending preparationを作る。
13. action_resolved。
14. 発生したafter反応を全て解決。
15. chainが空になった後に勝敗を確認。

redirect_pending_target、modify_pending_amount、cancel_pending_actionはinterrupt timingのruleからだけ使用可能。afterで使えばvalidator error。

### 11.5 reaction

イベント記録直後に、そのEventTypeをlistenするruleを列挙する。

- interrupt ruleはpending frameが存在するイベントでのみ発火可能。
- after ruleはイベント事実を変えず、子effectを作る。
- 発火順はRuleDefのtie-breakに従う。
- 各ruleは発火直前に条件とcostを再評価する。
- cost支払い後にeffectsを配列順で適用する。
- 同owner、同rule、同chainの二度目は発火しない。
- 反応で新イベントが出た場合はFIFOで処理する。ただし現在のinterrupt windowを閉じる前に、そのwindowへ属するinterruptを全て処理する。

実装がstack、queue、frameのいずれを内部で使ってもよいが、外から観測される順序はテストで固定する。

### 11.6 ラウンド終了

initiative queueが空になった後:

1. round_endedを記録し、after反応を処理。
2. 各actorの未使用AP、RPをresource_unusedとして記録。
3. duration=roundのbarrier packetを期限の早い順に失効しbarrier_expired。
4. duration=roundのstatusを除去しstatus_removed。
5. APとRPを0へする。
6. chainを全て解決して勝敗確認。
7. maxRoundsに到達して未決ならround_limit。

stalemateは、二ラウンド連続でHP、防壁、準備、状態、装備耐久のいずれも変化せず、勝敗も進まない場合に判定してよい。判定を入れる場合はstate hashとfixtureをREADMEへ記載する。

## 12. 原子的効果の意味

### 12.1 damage

1. deal_damageがdamage_proposedを作る。
2. interruptでamountを0以上へ変更可能。
3. durationが最も早いbarrier packetから吸収する。同期限なら作成sequence順。
4. barrier吸収があればbarrier_damaged。
5. packetが0になればbarrier_broken。
6. 残量をHPへ適用しdamage_taken。
7. targetが0HPになればactor_defeated。
8. targetを倒してなお残量があればexcess_damage。
9. HPダメージ0でもdamage_proposedは残す。damage_takenは実HP減少がある場合だけ。

excess_damageは次で計算する。

> max(0, proposedAfterInterrupt − barrierAbsorbed − hpBefore)

### 12.2 healing

1. healing_proposed。
2. interruptでamount変更可能。
3. actualHealing = min(amount, maxHp − hp)。
4. healing_appliedへactualとrequestedを記録。
5. amount − actualHealingが正ならexcess_healing。
6. 0HPのactorはv1ではheal対象外。復活は実装しない。

### 12.3 barrier

barrierはpacketで保持する。

~~~ts
{
  amount: number;
  duration: "round" | "battle";
  createdSequence: number;
  sourceActorId?: string;
  sourceDefinitionId?: string;
}
~~~

gain_barrierはbarrier_gainedを出す。v1では総量上限を設けない。支配性はコンテンツ検査の対象であり、エンジンが暗黙に切り捨てない。

### 12.4 preparation

- stepsは1〜3。
- start時にpreparation_started。
- actor activation冒頭またはadvance_preparationでstepsを減らしpreparation_advanced。
- 0になった瞬間にpreparation_completedとcompletionEffectsを処理。
- 外部advanceで0になった場合はその場で完成する。
- 自分のactivationで0になった場合はcompletionEffects後にactivation終了。通常tacticは続けない。
- interrupt_preparationはpendingを削除しpreparation_interrupted。
- actor defeat時もpendingを削除するが、その原因をevent valuesへ残す。
- 準備開始時のAP以外に、完成時コストを課さない。

### 12.5 position

swap_positionsは同じsideの生存actor二人にだけ使える。

- positionを原子的に交換する。
- actorごとにactor_movedを一件ずつ、同じchainで記録する。
- history times_movedを両者について増やす。
- 一人だけ動かして一時的なposition重複をイベントから観測させない。

### 12.6 equipment wear

- wear_equipmentは対象equipment instanceのdurabilityを0まで減らす。
- equipment_wornへbefore、amount、afterを記録。
- 0になった瞬間にequipment_broken。
- broken後、その装備の未発火ruleは候補から除く。
- 現在実行中のruleは途中で取り消さない。
- 装備はresult snapshotへ残す。

## 13. ObjectiveDef

v1は次の三つ。

- eliminate_all_enemies
- defeat_definition
- survive_rounds

defeat_definitionはenemy definition IDと必要数を持つ。instance ID固定の目的にしない。

勝敗は一つのatomic effectと、そのeventから発生したreaction chainが終了した後に評価する。actor_defeatedへの反応が処理される前にbattleを終了しない。

双方全滅した場合:

- objectiveが同じchainで達成されていればwin。
- それ以外はdraw。

## 14. イベント上限と循環検出

既定options:

~~~js
{
  maxEventsPerChain: 256,
  maxEventsPerBattle: 4096,
  maxActivationsPerActorPerRound: 8,
}
~~~

上限到達は通常結果ではなくエラー。

エラーには次を含める。

- battleId
- round
- current actor
- chainId
- event sequence
- parent event
- rule activation stackまたはqueue
- 直近20イベント
- 各ruleのchain発火回数

termination.test.mjsは少なくとも次を持つ。

- APを相互付与し続けようとする二rule。
- damage_takenに反応して互いへdamageする二rule。
- barrier_gainedに反応してbarrierを得るrule。
- preparation_advancedを自分で再発火させるrule。
- 装備が自分のwearへ反応するrule。

安全制約で停止する場合と、循環エラーにすべき場合を明示する。黙って最後のイベントを落として成功扱いしない。

## 15. fixture content

fixture-content.mjsは本番コンテンツではない。schemaと順序を証明する最小証人である。表示名は説明的な仮名でよい。

最低限、次をデータだけで表す。

### 15.1 active

- 単体damage。
- healとexcess_healing。
- round barrier。
- 味方へのAP付与。
- 一段preparation後の大damage。
- 同side二人のposition swap。

### 15.2 reactive

- damage_taken後のcounter。
- target_selected interruptでのcoverとredirect。
- excess_healing後の別対象heal。
- actor_defeated後のAP獲得。
- actor_moved後のbarrier。
- preparation_started後のadvance。

最後のpreparation advanceは明白なコンボの推奨ではなく、処理順を検査するための技術fixtureである。本番contentへ自動採用しない。

### 15.3 equipment

- 最初のactive actionのAP costを1下げる装備。
- excess_damageを読んで小damageを出す装備。
- resource_unusedのRPで自分を1修理する装備。
- battle durationのbarrierを作る装備。

### 15.4 status

- 受けるdamage proposedを+1するnegative status。
- 次のdamage/heal/barrier amountを+1し、その後消えるpositive status。

全fixtureに、どのイベント、predicate、effect、limitを検査するためかコメントまたは対応表を付ける。

## 16. Gate A〜F

Gateは面白さを判定しない。実装が次の設計実験を信用可能にするかを判定する。

### Gate A — 反証レビューと要求トレーサビリティ

コード前に次を作る。

- analysis/experiments/exp-18/A5_RULE_ENGINE/PREFLIGHT.md
- analysis/experiments/exp-18/A5_RULE_ENGINE/TRACEABILITY.md

PREFLIGHTには次を含める。

- R4とR5の矛盾候補。
- frontierを拡張基盤に使えない理由。
- EventType、順序、上限に恒真・恒偽・未定義がないか。
- 仕様どおりでも本目的を測れない代理指標がないか。
- 実装前に停止すべき不明点。

重大な矛盾があれば、コードを書かずに反例と最小修正案を返す。単なる命名や内部HOWは質問せず進める。

TRACEABILITYは各R5節を、実装ファイル、テスト、証拠へ対応させる。未着手時点では予定を記載し、完了時に実績へ更新する。

### Gate B — schema

必須:

- 全正常fixtureがvalidate成功。
- 未知EventType、Effect、Predicateを拒否。
- 参照切れを拒否。
- 重複ID、重複positionを拒否。
- active2、reactive2、equipment2、useWhen2の上限を拒否。
- interrupt専用effectをafter ruleで使う定義を拒否。
- 0除算、負数、非整数、NaN相当を拒否。
- 人物名または特定相方IDをpredicateで参照できる型が存在しない。

### Gate C — 決定性とイベント意味

必須fixture:

- 同一入力100回のJSON深一致。
- inputとcontent bundleが変更されない。
- damage、barrier、heal、excessの境界。
- 複数interruptの固定順序。
- 先行反応により後続反応のcost不足が生じた場合の再評価。
- coverによるtarget_changed。
- preparationの自己activation完成と外部advance完成。
- AP取得によるqueue末尾再行動。
- broken equipmentが後続ruleを供給しない。
- actor_defeated reaction後にobjective判定。

### Gate D — 停止

必須:

- termination fixturesが所定の安全制約または診断エラーになる。
- 正常fixtureはmaxEventsの10%未満で終了する。
- 同rule同owner同chain一回制約をテスト。
- 一actor一round activation 8上限をテスト。
- エラー診断にR5の必須情報がある。

### Gate E — データ追加による拡張

engine、predicates、selectors、effectsを変更せず、fixture-contentへのデータ追加だけで次を作る。

- HP半分以下の味方を回復し、余剰回復を別の味方へ渡す技能。
- 移動後の次行動を強化する装備。
- 未使用APをround barrierへ変える人物signature。
- 準備中の敵を優先する敵tactic。

git diffまたは結果文書で、エンジンコード変更がないことを示す。

### Gate F — 連鎖採掘

mineBuildsは小さいfixture poolから複数loadoutを決定的に実行し、最低限次を出す。

~~~js
{
  miningVersion: "ecology-mining-1",
  buildsEvaluated: number,
  battlesEvaluated: number,
  buildResults: [{
    buildId: string,
    performance: {
      wins: number,
      roundsUsed: number,
      hpLost: number,
      equipmentWear: number,
      actionPointsUnused: number,
      reactionPointsUnused: number
    },
    eventHistogram: Record<string, number>,
    chainFingerprints: string[]
  }],
  uniqueChainFingerprints: string[],
  errors: []
}
~~~

fingerprintはinstance ID、event IDを除き、少なくとも次を残す。

- event type。
- source definition IDまたはsource relation。
- target relation。
- skill／rule definition ID。
- repeatedではないv1でもtags。
- 親子関係の深さ。

Gate Fの合格は、二つ以上の異なるfingerprintが出ること、同じ入力で同じ採掘結果になること、エラーが隠されないこと。面白いコンボが見つかったとは判定しない。

## 17. 実行コマンド

外部test runnerを入れない場合、最低限次が個別に終了コード0になるようにする。

~~~sh
node ecology/schema.test.mjs
node ecology/engine.test.mjs
node ecology/termination.test.mjs
node ecology/extensibility.test.mjs
node ecology/mine.test.mjs
~~~

可能なら全実行用ecology/check.mjsを作る。

~~~sh
node ecology/check.mjs
~~~

出力にPASSと書くだけでなく、process exit codeを検査する。

## 18. 成果物

実装コード:

- ecology/配下。

証拠:

~~~text
analysis/experiments/exp-18/A5_RULE_ENGINE/
  PREFLIGHT.md
  TRACEABILITY.md
  IMPLEMENTATION.md
  GATE_RESULTS.md
  MINING_SAMPLE.json
  RESULT.md
~~~

### 18.1 IMPLEMENTATION.md

- 実際のファイル構成。
- 公開API。
- R5からのHOW変更と同値性。
- frontierから再利用した考え方と、コピーしなかったもの。
- 既知の制約。

### 18.2 GATE_RESULTS.md

Gate A〜Fごとに:

- 判定。
- コマンド。
- exit code。
- 対象commit。
- 証拠ファイル。
- 未確認項目。
- 失敗時の反例。

### 18.3 RESULT.md

- commitとbranchまたはPR。
- 実装範囲。
- 仕様逸脱。
- 全テスト結果。
- 未実装。
- 次の設計担当が判断すべき点。
- UI・公開・人間テストをしていないこと。
- 面白さを証明していないこと。

## 19. 停止条件

実装担当は次で停止する。

- R5内に、結果を変える二通り以上の解釈があり、どちらもHOWではない。
- v1 event順序では要求fixtureを表現できない。
- 無限連鎖を防ぐため、不変条件の変更が必要。
- 個別コンテンツifなしでは表現不可能な必須fixtureがある。
- 外部依存なしでは不可能で、依存追加がリポジトリ方針と衝突する。
- テストが通らないのに閾値・上限・fixtureを緩めないと完了できない。
- 既存の未関連変更と競合し、安全に分離できない。

停止時は作者へ実装やE2E代行を頼まない。反例、影響、最小修正案をRESULT.mdまたはPREFLIGHT.mdへ保存して返す。

## 20. 完了後も実装担当が決めないこと

A5完了後、次は設計担当へ戻す。

- 本番8人物の固有能力と数値。
- 本番12アクティブ、12リアクティブ、18装備。
- どのchain fingerprintを面白い候補とみなすか。
- 遠征のHP・装備消耗の回復速度。
- 初期敵6〜8種。
- 人間テストへ出すbuild arc。
- UIとアート文脈。
- 面白さの支持・棄却。

実装担当は、採掘結果を見て「面白そうなコンボ」を本番コンテンツへ無断追加しない。

## 21. 実装担当へ渡す最短プロンプト

次のURL一つとともに、以下だけを渡せば開始できる。

> 最新mainからEXP-18 R5に従ってください。最初にGate Aの反証レビューと要求トレーサビリティを作り、重大な矛盾がなければecology/の純粋戦闘エンジン、fixture、Gate B〜Fを実装してください。frontier/、UI、公開、D1、本番コンテンツは変更しないでください。結果と証拠はanalysis/experiments/exp-18/A5_RULE_ENGINE/へ保存してください。サブエージェントや別レビュー担当は起動せず、未確認項目があれば作者へ代行を求めず停止してください。