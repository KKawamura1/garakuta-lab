# 技術契約とコードの地図

## 1. リポジトリの地図

| パス | 役割 |
|---|---|
| `ecology/` | **本編。**UI、content、engine、進行、replay、local save |
| `analysis/` | 検査。`check-all.sh` と `ecology-*.mjs`（smoke・公開先 E2E）、`stamp.mjs`（build 印） |
| `core/build.mjs` | 公開版の build 印だけを持つ生成物。`analysis/stamp.mjs` が作る |
| `functions/api/runs.js` | プレイ記録の受け取りと検証（Cloudflare Pages Functions） |
| `migrations/` | D1 schema |
| `wrangler.jsonc`、`_headers`、`index.html`、`404.html` | 公開設定とルート導線 |
| `docs/` | この資料 |

公開の入口は `/ecology/`（本編）、`/`（`/ecology/` へリダイレクト）、`/api/runs`（D1 保存）です。


## 2. `ecology/` の主なファイル

| ファイル | 役割 |
|---|---|
| `app.js` | UI（タイトル画面を含む）、local save、進行、送信 payload |
| `engine.mjs` | 決定的な戦闘解決 |
| `schema.mjs` / `validate.mjs` | イベント・状態の定義と不変条件 |
| `effects.mjs` / `predicates.mjs` / `values.mjs` / `event-queue.mjs` | 効果・条件・値・イベント順 |
| `playable-battles.mjs` | 現行の戦闘入力、preview、loadout（技能の装着順・一時停止を含む） |
| `progression.mjs` | Profile、Run、報酬、補給、Campaign 解禁 |
| `replay-beats.mjs` | イベント列をリプレイ表示へ変換 |
| `content/` | 人物、技能、装備、敵、pack、Campaign、affix、物語、名簿、根城、立ち絵 |
| `content/dialogue.mjs` | 会話画面の本文・配役・立ち位置（本編・序盤・根城）。会話定義の編集先 |
| `content/character-lore.mjs` | キャラクター設定の正本（名前・人物像・来歴・関係）。人物本文の編集先 |
| `content/world-lore.mjs` | 地域・根城備品の設定本文と、敵本文への集約窓口 |
| `content/encounters.mjs` | 敵の配置・狙い・敵本文（既存 content API の正本） |
| `content/skill-tree-layout.mjs` | 技能ツリーの座標（`requires` から森を組み、x=深さ・y=行を与える）と、その検査 |
| `content/skill-levels.mjs` | 技能レベルの上限（連続する量を持つ技能だけが Lv10 まで伸びる）と 1段の値段 |
| `equipment-gen.mjs` | 装備を手続きで組み立てる決定的 generator と検査 |
| `blueprints.mjs` | Blueprint archive、持込枠、再製造 |
| `mine.mjs` | イベント連鎖の採掘 |
| `sync.mjs` | `/api/runs` への送信と端末 ID |
| `check.mjs` | `ecology/*.test.mjs` の runner |

## 3. 状態は三層

| 層 | 永続期間 | 主な内容 |
|---|---|---|
| ProfileState | 全遠征をまたぐ | 人物、活動資金、購入済み投資、人物鍛錬、Blueprint archive、図鑑、最高 clear Stage、解禁 content、物語の既読印、schema version |
| RunState | 一遠征 | manifest、Campaign Stage、12戦進行、現在 HP、補給、隊、formation、run 技能点・取得技能・装着順・一時停止状態、**その遠征で拾った装備の定義そのもの**、持込 Blueprint、仮計上資金、結果 |
| BattleState | 一戦 | actor、AP / RP、barrier / block、準備、status、装備耐久、event queue、被弾 chain、開始 HP snapshot、preview / commit 状態 |

技能の取得は `progression.mjs` の `unlockRunSkill` で一度だけ行い、払い戻し API は持ちません。
取得は Lv1 で、`levelUpRunSkill` が 1点ごとに 1段上げます（`RunState.runSkillLevels`）。レベルは `runSkillLevelsFor` から BattleInput の `ally.skillLevels` へ渡り、engine は `effects.mjs` の `afterSkillLevel` で連続量（damage / heal / barrier とその増減）にだけ係数を掛けます。**engine は技能 ID で分岐しません**：表に載っていない技能では掛け算そのものが起きず、Lv1 は係数 1.0 ちょうどなので旧入力と1バイトも変わりません。離散量（AP/RP・段数・回数・耐久）と装備の rule には掛かりません。装着順と一時停止は `playable-battles.mjs` の loadout に保存し、`disabled` が無い旧 save は全技能を有効として扱います。allyInput がオフの技能を BattleInput から除外するため、preview と本番の両方へ同じ状態が届きます。

遠征終了で消えるもの: run 技能点と run 中に解禁した技能、装備の実物（選んだものだけ
Blueprint として残る）、補給・scrap・治療 charge・現在 HP、encounter 順と報酬 offer。

`newRun` は新規遠征の技能点を0にし、固定の初期装備を `inventory` へ入れません。出発前に選んだ Blueprint の持込品だけは例外です。通常戦の勝利は `app.js` の一つの処理経路で、現在の `RunState.roster` 全員へ技能点1を自動付与します。プロローグはこの経路から除外され、活動資金と技能点を増やしません。
初回の本編第1戦の報酬後だけ、`app.js` がキャンプの補給タブを開きます。案内の完了印は `ProfileState.storyFlags` に保存し、治療の実処理は既存の `progression.mjs` の `campTreat` を通します。

序盤の巻き戻しでは、`app.js` が `PROLOGUE.formation` を `RunState.formation` に戻してから camp へ進めます。初期配置を `defaultFormation` に戻さないため、変更なしの再戦は敗北として予測されます。`prologueEncounter()` は12戦用の敵定義を流用しますが、`PROLOGUE.enemyScaling` のHP60%・前衛の攻撃115%を適用し、後列の marksman は個別に73%へ落とします（`might` / `focus`）。通常戦の難易度や敵定義は変えません。
巻き戻し直後の情報分離を含む会話本文は `content/dialogue.mjs` が正本で、`story.mjs` は断片の順序と表示条件だけを持ちます。

## 4. 決定性

- Manifest、Encounter、Reward offer、装備 instance、compiled EquipmentDef、
  Blueprint descriptor、Blueprint 再製造品は、同じ入力から JSON の内容が完全に一致します。
- 生成装備は item rarity と各 payoff の effect rarity、解決済み数値を descriptor / provenance に含め、
  Blueprint はその効果品質まで exact に保持します。
- 装備の意味を表示する責務は app.js に閉じる。装備バッジは格番号＋名称、効果欄は
  基礎／追加のスロットごとの格番号＋名称を表示し、効果レアリティの高い順に並べる。
  同格の効果は readout.effects の元順を保ち、生成品が持つ readout.effects と readout.lines は
  同じ item から読み、表示だけで rarity を再計算しない。
- `Date` と `Math.random` は engine とゲーム内容の計算経路に入れません。
- 乱数 key を用途別に分け、reward reroll が後続の敵や drop を変えないようにします。
- 同じ actor の reactive skill は loadout の上から順に候補を処理し、active skill は配列順に最初の使用可能なものを選びます。actor をまたぐ reactive の順序は、従来どおり priority・initiative・position・ID の tie-break を使います。

      runSeed:manifest:stageId
      runSeed:encounter:encounterIndex
      runSeed:reward:encounterIndex:rerollIndex:slot
      runSeed:item:dropIndex:attempt

- profile / run / battle / content / manifest / generator / Blueprint の version を保存し、
  不一致を黙って読み飛ばしません。
- 戦闘値は整数で表示し、effect 確定時に round-half-up します。AP、RP、hit 数、block 回数、
  round、charge は小整数を保ちます。
- 行動 queue は round 内に味方フェーズ→敵フェーズを交互に作ります。各フェーズでは
  その側の living actor が隊列順（前列の左→中央→右、後列の左→中央→右）に一回だけ
  起動し、AP2 の actor は次の自軍フェーズへ戻ります。round 開始時の initiativeRank は
  味方を先に、次に敵を置きます。同じ側・同じ位置だけ instance ID で決着し、隊列以外の
  能力値は initiative に介入しません。

## 5. イベント列

UI・replay・検査は、engine が出した同じイベント列を読みます。
新しい event を追加する場合は、schema、validator、engine テスト、表示・replay も同時に更新します。
ターゲットクエリの `not_self` は、反応ルールの owner と候補 actor の instance ID を比較し、ownerless な region rule では no-op です。
未知の event、effect、predicate、scope、tag などは無視せず validator error にします。

## 6. content の hard contract

### 6.1 表示用語

`focus` は内部 ID を維持し、画面上は「技術」と表示する。`focused` は状態異常なので、画面上は「集中」と表示する。能力値と状態異常を混同しない。

- 新語彙は schema version を上げ、additive に追加する。
- save、D1、replay へ content version と definition ID を残す。
- unknown 語彙を無視せず validator error にする。

係数、cost、cooldown、発火上限、enemy parameter、threat cost、encounter、Stage law、
reward / rarity weight、技能点価格、power budget は調律可能な soft data です。ただし
変更ごとに build / content version を上げ、測定済み run と混同しません。

引退した ID は `ecology/content/index.mjs` の `RETIRED_IDS` に理由付きで残し、
`analysis/ecology-contract-smoke.mjs` が凍結済み ID との差を照合します。

## 7. D1 とプレイ記録

`ecology/` は遠征終了時に、版、build 印、seed、Profile / Run の要約、event 列、
アンケート、感情マーカーを `/api/runs` へ送ります。送信失敗時も端末側の保存結果を
明示し、「保存済み」と「D1 保存済み」を混同しません。受け側は
`functions/api/runs.js`、schema は `migrations/`。取り出し方は `docs/OPERATIONS.md`。

## 8. 障害時に見る順

- 画面が空白: ブラウザ console → 公開された module の MIME → build 印 → 直接 import。
- 戦闘が止まる: 同じ seed のイベント列 → termination → anti-stall の結果。
- D1 送信が失敗: payload の schema → HTTP status → `functions/api/runs.js` の許可 host → migration。
- 作者のプレイ結果を推測で補わず、未確認として止める。

