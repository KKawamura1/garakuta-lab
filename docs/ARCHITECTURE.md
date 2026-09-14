# 技術契約とコードの地図

## 1. リポジトリの地図

| パス | 役割 |
|---|---|
| `ecology/` | **本編。**UI、content、engine、進行、replay、local save |
| `analysis/` | 検査。`check-all.sh` と `ecology-*.mjs`（smoke・公開先 E2E）、`stamp.mjs`（build 印） |
| `analysis/ecology-chain-safety-audit.mjs` | Issue #175 の資源報酬定義・event trace・再発火・過剰回復・limit を監査する安全ゲート。 |
| `analysis/ecology-chain-safety-blind-spots.mjs` | 安全ゲートが拒否すべき schema-valid な不正例と、許可条件を満たす既存の陽性例を実際の content から検査する smoke。 |
| `analysis/ecology-stage3-builds.mjs` | Stage 3（5人・4pack）の三構成（issue #176）を data として持ち、取得計画の予算・核の成立時点・代替入口・代表装備・同じ seed での event 列の違いを、実際に engine へ通して検査する smoke。 |
| `core/build.mjs` | build metadataのtracked loader。sidecarが無いローカルでは `unbuilt` を使う |
| `core/build.generated.mjs` | Cloudflare Pages buildが `CF_PAGES_COMMIT_SHA` から作る無視対象sidecar |
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
| `progression.mjs` | Profile、Run、報酬、補給、Campaign 解禁、必殺印の勘定 |
| `ultimates.mjs` | 必殺技（issue #238）。取得済み技能を必殺へ変える純関数の変換規則と、遠征 bundle への混ぜ方。**engine も schema も必殺を知らない** |
| `replay-beats.mjs` | イベント列をリプレイ表示へ変換。必殺の拍（issue #242 のカットイン）も、新しい event を足さずに ID の形だけで組む |
| `content/` | 人物、技能、装備、敵、pack、Campaign、affix、物語、名簿、根城、立ち絵 |
| `art/` | **配信用の画。**タイトルの5人（`title-cast.webp`）と会話の立ち絵（`portraits/*.webp`）。原本は `docs/art/`、作り直しは `analysis/art-web-assets.py` |
| `content/dialogue.mjs` | 会話画面の本文・配役・立ち位置（本編・序盤・根城）。会話定義の編集先 |
| `content/character-lore.mjs` | キャラクター設定の正本（名前・人物像・来歴・関係）。人物本文の編集先 |
| `content/world-lore.mjs` | 地域・根城備品の設定本文と、敵本文への集約窓口 |
| `content/encounters.mjs` | 敵本文の正本（噂・図鑑）と、**狙いの説明文の導出**（`ENEMY_TARGETING` は `enemies.mjs` の tactics から組み立てる。人が書かないので挙動とずれない）。**敵配置ではない** |
| `content/expedition.mjs` | **遠征の敵配置の正本。**Stage ごとの3幕12戦（`STAGE_ENCOUNTERS`、10 Stage）、threat budget、boss law、難易度 rank。Stage 3 の第7・8戦のような幕内の明示的な `enemyStatScale` もここで宣言する。`EXPEDITION_ENCOUNTERS` は Stage 0 の12戦（Stage を渡さない呼び出しの既定）。`progression.composeEncounter(index, rank, { partySize, stageSequence })` → `playable-battles.makeExpeditionBattle` の経路を全プレイ経路が読む |
| `content/enemies.mjs` | **敵 unit の正本。**家系（`ENEMY_FAMILIES`）ごとの個体表と `FAMILY_POWER`（家系共通の出力）、`ENEMY_THREAT_COST`。家系共通でない幕内の敵倍率は `content/expedition.mjs` の明示的な指定で行う |
| `content/skill-tree.mjs` | 技能ツリーの節（`requires` は `{ skillId, minLv }`、`maxLv` は skill-levels から導出）と表示文、前提判定 `prerequisitesMet` |
| `content/skill-tree-layout.mjs` | 技能ツリーの座標（`requires` から森を組み、x=深さ・y=行を与える）と、その検査 |
| `content/skill-levels.mjs` | 技能レベルの上限（連続する量を持つ技能だけが Lv10 まで伸びる）と 1段の値段 |
| `content/packs.mjs` | 技能の pack 所属と Stage ごとの core / full の入口。Stage 1 の `pack_edge` core は `cover_ally`（身代わり）までを含み、Stage 2 の `pack_wall` core は `shield_handoff`（受けの受け渡し）へ続く |
| `content/roster.mjs` | 人物の加入時初期技能。ナギは Stage 1 で `cover_ally` を初期リアクティブに持つ |
| `equipment-gen.mjs` | 装備を手続きで組み立てる決定的 generator と検査 |
| `static-bonuses.mjs` | passive と装備の常時能力を戦闘・検証・preview・UIで同じように合算 |
| `blueprints.mjs` | Blueprint archive、持込枠、再製造 |
| `mine.mjs` | イベント連鎖の採掘 |
| `sync.mjs` | `/api/runs` への送信と端末 ID |
| `check.mjs` | `ecology/*.test.mjs` の runner |

遠征タブの `renderMap()` は、12個のノードを `composeEncounter(step, ...)` から生成し、
`RunState.encounterIndex` との比較だけで `done` / `current` / `unreached` を決めます。
精鋭・bossの種別はノード内の記号と凡例へ分離し、強い現在地枠を種別用の枠で上書きしません。
`analysis/ecology-map-smoke.mjs` が12戦の配置とこの表示契約を、
`analysis/ecology-trial.mjs` がiPhone幅での現在地移動を確認します。

## 3. 状態は三層

| 層 | 永続期間 | 主な内容 |
|---|---|---|
| ProfileState | 全遠征をまたぐ | 人物、活動資金、購入済み投資、人物鍛錬、Blueprint archive、図鑑、最高 clear Stage、解禁 content、物語の既読印、schema version |
| RunState | 一遠征 | manifest、Campaign Stage、12戦進行、現在 HP、補給と**その遠征の補給総数**、**必殺印**、隊、formation、run 技能点・取得技能・取得予約（技能ID・目標Lv）・装着順・一時停止状態・**必殺技の指定と構え**、**その遠征で拾った装備の定義そのもの**、持込 Blueprint、仮計上資金、結果 |
| BattleState | 一戦 | actor、AP / RP、barrier / block、準備、status、装備耐久、event queue、被弾 chain、攻撃単位の回復窓、開始 HP snapshot、preview / commit 状態 |

### タイトル画面とContinue

タイトル画面は表示中のUIであり、ゲームの再開地点ではない。タイトルへ戻るときは、直前のゲーム画面を
オートセーブへ記録する。ページを開いた直後はタイトルを表示し、そこからContinueを選んだときだけ
その再開地点へ復元する。タイトルへ戻る前に作られた旧い保存に再開地点の記録が無い場合は、
遠征準備画面へ復元する。ロードメニューを閉じるだけではオートセーブを上書きしない。

タイトル画面だけは通常画面と別の `titleShell()` を使う。`titleShell()` は渡された題名を
`wordmarkMarkup()` で組み（狭い画面では語のあいだで折り返す）、画面いっぱいの層
（`.title-air`）を敷く。層は、下端に置いた5人の画と、その上の幕（光・左右の切り口消し・
下へ落ちる暗がり）でできている。

### 起動と画像の読み込み

`app.js` の入口は `render()` ではなく `boot()` である。`boot()` はタイトルの画と5人の
立ち絵（`PORTRAIT_IMAGE_URLS`）を `Image.decode()` で先に取り、読み込み画面を出してから
`render()` する。読み込みが `BOOT_REVEAL_DELAY_MS` より速ければ読み込み画面は出さず、
`BOOT_TIMEOUT_MS` を超えたら待たずに始める（**入口で止まらない**）。タイトルの画は
読み終わった時点で `html.title-art-ready` が付き、そこで初めて現れる（途中の帯を見せない）。
`index.html` は app.js が届くまでの静的な読み込み印（`.boot-static`）と、
タイトルの画の `<link rel="preload">` を持つ。

配信する画像は `ecology/art/` の WebP だけで、`docs/art/` の原本（1枚 2〜3MB）は配らない。
`_headers` が `/ecology/art/*` を一日キャッシュする。

技能の取得は `progression.mjs` の `unlockRunSkill` で一度だけ行い、払い戻し API は持ちません。
取得は Lv1 で、`levelUpRunSkill` が 1点ごとに 1段上げます（`RunState.runSkillLevels`）。レベルは `runSkillLevelsFor` から BattleInput の `ally.skillLevels` へ渡り、engine は `effects.mjs` の `afterSkillLevel` で連続量（damage / heal / barrier とその増減）にだけ係数を掛けます。**engine は技能 ID で分岐しません**：表に載っていない技能では掛け算そのものが起きず、Lv1 は係数 1.0 ちょうどなので旧入力と1バイトも変わりません。離散量（AP/RP・段数・回数・耐久）と装備の rule には掛かりません。装着順と一時停止は `playable-battles.mjs` の loadout に保存し、`disabled` が無い旧 save は全技能を有効として扱います。allyInput がオフの技能を BattleInput から除外するため、preview と本番の両方へ同じ状態が届きます。
`simulateExpeditionBattle` が予測と本番の入力構成と `equipmentBreaks: false` を共有するため、
技能レベル・HP・装備耐久を含む同じ入力から同じ結果とイベント列を返します。
**呼び出し側も一本です**：`app.js` の `expeditionBattleOptions()` が盤面の外の入力
（`composed` / `hp` / `equipmentDurability` / `limitsFor`）を組み、戦闘予測
（`previewNextBattle`）と本番（`simulateExpeditionBattle`）がその戻り値をそのまま渡します。
本番が足すのは結果を変えない `simulationOptions: { captureReplaySnapshots: true }` だけで、
`app.js` の試映も同じ `simulateExpeditionBattle` と snapshot 収集を使います。ただし
`previewOnly` の境界より内側では `RunState.results`、ledger、技能点、取得予約、図鑑、
`commitBattleResult`、戦闘ログを更新しません。試映の結果は `simulationMode` により必ず専用結果へ
入り、通常の報酬生成・進行経路を通らずキャンプへ戻ります。
取得予約は `progression.mjs` の `reserveRunSkill` / `cancelRunSkillReservation` が一人一目標を管理し、`fulfillSkillReservations` が同じ決定順で前提・必要Lv・目標技能を、手持ちSPの範囲だけ自動取得します。画面は自動取得の action 列を受け取り、前提をオフ、目標をオンで loadout へ反映します。`RunState.skillReservations` は保存・再開の対象です。
`analysis/ecology-screens-smoke.mjs` がその2箇所と、予測 cache の鍵
（`forecastKey`、`runSkillLevels` と `runUnlockedSkills` を含む）を見張ります。
`content/skill-levels.mjs` の `LEVELED_EFFECTS` と `effects.mjs` の `afterSkillLevel` が
掛かる effect 型が一致しているかは `analysis/ecology-skill-catalog-smoke.mjs` が見ます。
技能の数は**変動量と固定量に分けてあります**。変動量（レベルで伸びる damage / heal /
barrier / 増減の amount）は各技能にちょうど一つで、説明文はその数を持たず `{amount}` /
`{total}` / `{hits}` と書いて定義を指します。表示の直前に
`skillTextAtLevel(text, definition, level)` が実際の値（レベルを掛け、単位は amount 型が
決める）を埋めます。固定量——発動条件の閾値、後列減衰、段数、AP / RP——は文字のままです。
数を二箇所に書かないので「係数を変えたのに説明文が旧値のまま」は起こりません。
`skillTextIssues` が「変動量を数字で直接書いた」「`{amount}` を書き忘れた」「変動量を二つ
持っている」を検出し、`analysis/ecology-readout-smoke.mjs` と `ecology/phase-b.test.mjs` が
それを見張ります。

取得コストと登場時期に対する強さは `analysis/ecology-skill-balance-smoke.mjs` が production
content を直接読んで検査します。深い腕力攻撃を基礎攻撃の高Lvと比較し、技術攻撃の係数帯、
溜め技の1行動平均、AP移譲の `channel` / `not_self` を固定します。さらに同じ content を
小戦闘へ通し、隙・怯み・守勢が多段の全hitへ割合で掛かること、裂傷が最大HPを読むこと、
複数行動の途中で「余りを溜める」が次の一手を集中させること、位置替えと踏み固めが連鎖すること、
身代わりが自己標的へRPを空費しないことまでevent列で確かめます。

割合状態は新しいengine語彙ではありません。`content/statuses.mjs` が段数と `hitIndex` の
排他的な組ごとに有限の `damage_proposed` ruleを展開し、既存の
`event_value_scaled` とchain発火上限を使います。上限はproduction contentの最大6hitに合わせ、
balance smokeが0〜5の全hitを覆うruleを要求します。

技能画面の効果チップは、この同じ `skillTextAtLevel` から能力値を掛ける前の係数を読む。
人物ごとの最終値は詳細欄へ重ねず、印（腕・技・受・HP）と係数を見たプレイヤーが判断する。
未取得節の右端は、現在Lvから取得可能になるまでに必要な他技能の残りLv数を破線四角、
取得コストを実線四角として `+` で結ぶ。前提Lvの閉包は `remainingPrerequisiteLevels` が
一度だけ辿り、既に満たしている前提は差し引く。

遠征終了で消えるもの: run 技能点と run 中に解禁した技能、装備の実物（選んだものだけ
Blueprint として残る）、補給・scrap・治療 charge・現在 HP、encounter 順と報酬 offer。

### 報酬と戦闘後の行き先（PR #255）

装備の候補を出す戦闘は `progression.offersRewardAfterClear(index)` の一箇所が決めます。
`REWARD_ENCOUNTER_KINDS`（いまは `["boss"]`）に含まれる種別の戦闘＝4・8・12戦目だけが
候補を出し、候補は装備 `REWARD_EQUIPMENT_SLOTS`（2）件で、**補給は候補に入りません**。
`app.js` の `resultScreenDue()` はこの判定と「敗北」「最終戦」「プロローグ」を見て、
結果画面を出すかどうかを決めます。出さない勝利は `advanceAfterBattle()` が直接キャンプへ
戻し、`captureLastBattleNote()` が直前の一戦の要約（ラウンド数・味方HP損失・技能点・
装備摩耗・必殺の印・戦闘不能・幕ボス後の全回復）を `lastBattleNote` へ一度だけ写します。
この一枚は `renderCamp()` がどのタブでも同じ位置に出し、次の戦闘を始めると消えます。
組み立ては純関数 `buildBattleNote()` に分けてあるので、**装備を選ぶ画面も同じ一枚を
読みます**（結果画面だけが持っていた「戦闘後の状態」——勝敗の大札・4つの指標・人物ごとの
HP・装備耐久の一覧——は、装備を選ぶ画面には出しません。作者試遊 2026-09-12）。
`metrics.allyHpLost` / `enemyHpLost` は engine が `startingHp - hp` で数えます。
`maxHp - hp` だと前の戦闘から持ち越した傷を毎回数え直すので、無傷で抜けた一戦でも
損失が出ていました。
12戦目の候補を受け取ったあとは `rewardTakenAtEncounter` を立てて同じ結果画面に留まり、
「遠征を精算する」へ渡します（encounterIndex は進めません）。

装備の札は `readout.rules`（rule ごとの `when` / `paid` / `limitText` / `effects`）を読んで、
**発火条件・代償・発火回数を畳まずに**出します。`equipment-gen.mjs` の `ruleReadout()` が
その構造を作り、`ruleText()` が同じ構造から全文の一文を組むので、**札と全文が同じ材料**を
読みます。高さの予算は「行数」（常時1行 + rule ごとに見出し1行 + 効果の行）で、候補数から
決めます（2件で4行、3件以上で3行）。余地が足りない rule は**まとめて**畳み、件数は全文を
開く行が言います。見出しだけ出して効果を隠すことはしません。保存済みの Blueprint の
readout は `rules` を持たないので、その場合は畳んだ全文だけが条件を持ちます。

### 残す設計図の選択（issue #151）

`settleRun(profile, run, outcome, options)` の `options.keepDescriptors` が選択です。
候補と上限は `blueprintSaveCandidates(run)` / `blueprintSaveLimitFor(outcome)` が外へ出し、
`resolveBlueprintKeeps` が「候補に無い descriptor を落とす」「上限へ丸める」「空なら
何も残さない」を一箇所で行います。`keepDescriptors` を渡さない経路（既存の自動精算と
テスト）は従来どおり等級の高い順に上限まで残します。`app.js` は候補が上限より多いときだけ
phase `blueprintPick`（`renderBlueprintPick`）を挟み、`pendingSettlement` と `blueprintKeep`
を持って `performSettlement()` へ渡します。精算は `performSettlement()` の一箇所だけが行い、
選択の有無で入口が変わるだけです。

newRun は新規遠征の技能点を startingSkillPoints(profile) で決め、基礎0へ永続強化「初期SPアップ」の段階ぶんを加える。固定の初期装備を inventory へ入れず、出発前に選んだ Blueprint の持込品だけは例外です。初期SPアップは新規遠征の開始時だけに適用し、途中加入者へ遡っては付けません。勝利時の技能点は progression.grantRunSkillPointsForClear の一箇所で決まります。量は SKILL_POINTS_PER_CLEAR（encounter の種別 → 点数。通常戦1／精鋭戦1／boss2）から引き、region:index を鍵に RunState.grantedSkillPointKeys へ記録するので、**同じ encounter からは一度しか配りません**（活動資金の撃破分と同じ鍵です）。12戦を全て勝った場合は15点、最後の戦いの直前までで13点です。app.js はこの関数を呼ぶだけで、量も冪等も持ちません。プロローグはこの経路から除外され、活動資金と技能点を増やしません。

技能の前提は `{ skillId, minLv }` で、判定は `content/skill-tree.mjs` の `prerequisitesMet` / `unmetPrerequisites` 一箇所を、解禁 API（`progression.unlockRunSkill`）・画面（`app.js` の `skillNodeState`）・加入時の無償閉包（`playable-battles.initialUnlockedSkills` と `initialSkillLevels`）が共有します。無償閉包が Lv1 より上を要求するときは、その Lv も加入時に無償で付きます（取得済みなのに前提 Lv 不足で子が取れない形を作らないため）。前提が上限 Lv を超えていないか、その Stage で出る節を一遠征ぶんの技能点で取り切れるかは `analysis/ecology-skill-catalog-smoke.mjs` が見ます。
`newRun` は `startingSupplies(profile, rank)` で補給を決め、同じ値を `RunState.suppliesMax`（その遠征の総数・表記の分母）へも入れます。基礎は `STARTING_SUPPLIES_BASE`（3）で、永続強化「開始補給」の段ぶん（最大 +2、天井は `MAX_SUPPLIES` = 5）が加わります。導入用の特例は持ちません（Stage 0 だけ1個という例外があると「3/3」が最初の遠征で嘘になるため）。`gainSupply` と `convertScrap` は `runSuppliesMax(run)` を上限にするので、**遠征中に総数を超えて増えません**——屑から戻せるのは使った分だけです。欄の無い古い保存は `runSuppliesMax` が基礎値として読み直します。New Game が作る `runId` を `supplyTutorialRunId` として画面状態に保持し、その導入遠征だけを必須チュートリアルの対象にします。通常遠征・再訪・既存セーブはこの marker を持たないため、補給タブを任意に使えます。初回の本編第1戦に勝ってキャンプへ戻ると、`app.js` は補給タブを開き、`supplyTutorialStep()` が `treatment` / `target` の段を保持します。`supplyTutorialSpotSelector()` が「集中治療」のボタンまたは負傷者の盤面セルを選び、隊列・補給・必殺技は共通の `tutorialGate()` → `applyTutorialGate()` → `tutorialAllows()` を使います。これにより光る先・画面上の錠・handler の制限が同じ選択子から出ます。単体治療は `treatmentTargetIds()` が返す候補から `select-treatment-target` を受けるまで補給を消費せず、確定後だけ既存の `progression.mjs` の `campTreat` へ明示した target ID を渡します。対象を選ぶ画面は補給タブ専用の一覧ではなく、上端の共通盤面（`partyCellRole` の `supplies` mode）です。結果は `treatmentResult` と `role=status` で表示し、完了印は `ProfileState.storyFlags` に保存します。`supplyTutorialVisible()` 中は nav の他タブ、`begin-stage`、撤退経路を UI と handler の両方で閉じます。

序盤の巻き戻しでは、`app.js` が `PROLOGUE.formation` を `RunState.formation` に戻してから camp へ進めます。初期配置を `defaultFormation` に戻さないため、変更なしの再戦は敗北として予測されます。巻き戻し直後の camp は隊列チュートリアル（DESIGN.md 6.4.4）に入り、`formationTutorialStep()` が `open` / `pick` / `place` / `done` の段を返します。教える一手は content 側の `PROLOGUE.tutorial`（`characterId` / `row`）が持ち、`formationTutorialSpotSelector()` が段ごとの選択子を一箇所で作ります。`render()` の後段の `applyTutorialGate()` が、その選択子に当たる要素へ `tutorial-spot`（光）を付け、`done` 以外の段では他の `[data-action]` を `tutorial-blocked` と `disabled` で塞ぎます。`handleAction` も同じ選択子で弾くので、押せる形と経路の両方が同じ判定を読みます。`campTutorialTab()` が補給チュートリアルと同じ形でタブを一枚へ閉じ込め、目標の行へ入った瞬間に錠が外れて `formationMode` も false へ戻ります（`place-character` の handler が段の前後を比べて畳みます）。`prologueEncounter()` は12戦用の敵定義を流用しますが、`PROLOGUE.enemyScaling` のHP60%・前衛の攻撃115%を適用し、後列の marksman は個別に73%へ落とします（`might` / `focus`）。通常戦の難易度や敵定義は変えません。
巻き戻し直後の情報分離を含む会話本文は `content/dialogue.mjs` が正本で、`story.mjs` は断片の順序と表示条件だけを持ちます。
Campaignの物語イベント（opening / join / 幕の断片 / stageEnd）は、既読状態や `clearedStageSequences` で表示を分岐させない。同じ Stage の再訪でも app.js は同じ断片を `enterStory()` へ渡す。Stage 0 の序盤の敗北・巻き戻しと補給案内だけは、専用チュートリアルとして初回の導線を維持する。

## 4. 決定性

- 公開版の `BUILD` はデプロイ対象のコミットSHAをPages build時に生成し、時刻を含めない。
  ルールの意味を分ける `FINGERPRINT` は `ecology/content/index.mjs` でsource controlする。
  生成sidecarはPRの差分へ持ち込まないため、複数ブランチ間でbuild印が衝突しない。

- Manifest、Encounter、Reward offer、装備 instance、compiled EquipmentDef、
  Blueprint descriptor、Blueprint 再製造品は、同じ入力から JSON の内容が完全に一致します。
- 生成装備は item rarity、無条件 stat の種類と値、各 payoff の effect rarity、解決済み数値を descriptor / provenance に含め、
  Blueprint はその効果品質まで exact に保持します。
- 回復 payoff は tier 0 / 1 / 2 の基準値 3 / 5 / 12 を持ち、effect rarity 倍率後に整数化します。
  generator は回復に任意の上限を設けず、自分のHP消費コストと自分専用回復の同一装備内共存だけを拒否します。
- 装備の意味を表示する責務は app.js に閉じる。装備バッジは格番号＋名称、効果欄は
  常時基礎／追加のスロットごとの格番号＋名称を表示する。常時基礎を先頭へ固定し、追加効果を
  効果レアリティの高い順に並べる。同格の効果は readout.effects の元順を保ち、生成品が持つ readout.effects と readout.lines は
  同じ item から読み、表示だけで rarity を再計算しない。
- プレイヤー向けの部材名は `playable-battles.mjs` の `componentLabel` を唯一の解決経路にする。
  固定装備は content metadata、生成装備は現在の Run から再構築した component metadata を使い、
  内部 ID へのフォールバックは未知データの診断用に限る。これにより装備枠、報酬結果、戦闘ログ、
  リプレイの表示が同じ名前になる。
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
- ラウンド持続の barrier / status は `endRound` では削除しません。前ラウンドの end phase
  開始位置を cutoff として記録し、次の `round_started` event を記録した直後に、その cutoff
  より前に作られたものだけを削除します。これにより、replay では期限切れが最後の攻撃ではなく
  次ラウンド開始の拍に乗り、end phase 中に作られた効果は次ラウンドを通過できます。

## 5. イベント列

UI・replay・検査は、engine が出した同じイベント列を読みます。
新しい event を追加する場合は、schema、validator、engine テスト、表示・replay も同時に更新します。
履歴／replay の入力型は `replay-beats.mjs` の `REPLAY_EVENT_TYPES` が
`schema.mjs` の `EVENT_TYPES` から導出するため、画面側だけの手書き whitelist を持ちません。
防壁で吸い切った攻撃は `damage_proposed` → `barrier_damaged` / `barrier_broken` →
`damage_absorbed`（`finalDamage: 0` を含む）、途中で対象を失った hit は `damage_skipped`、
行動の取り消しは `action_canceled` として、HPが変わらない場合も理由を残します。
戦闘盤面の防壁バーは新しいイベントや状態を持たず、`app.js` が現在の `replaySnapshots` の actor から `barrier` と `maxHp` を読み、`min(100, barrier / maxHp * 100)` の表示幅へ変換します。数値マークとバーは同じsnapshotを読むため、付与・吸収・破壊・期限切れの表示がずれません。
準備付き行動では `preparation_completed` の後続にあるダメージ系イベントを別の `impact` 拍へ分離します。盤面の踏み込みと、攻撃側から被弾側へ引く線は `beatHasStrikeImpact()` が判定する着弾拍だけに限定し、準備開始・完了や `sub` 反応で誤って攻撃モーションを出さないようにします。
ターゲットクエリの `not_self` は、反応ルールの owner と候補 actor の instance ID を比較し、ownerless な region rule では no-op です。
ターゲットクエリの並び替えは `TARGET_SORT_TYPES`（schema）が正本で、実装は `selectors.mjs` の
`sortValue` 一箇所です。`hp_asc` / `hp_desc` は残りHPそのもの（**攻撃の狙い先**。味方側・敵側とも
「最もHPの低い相手」を指す）、`hp_percent_asc` / `hp_percent_desc` は**傷の割合**
（**庇護・回復の宛先**。「最も傷ついた味方」）で、後者の値は `hp * 10000 / maxHp` の
切り捨て（整数 bps）から作ります。
**浮動小数は比較経路に入りません。**同率は既定の `position_asc` → `instance_id_asc` へ落ちるので、
`take: 1` が配列の到着順に依存することはありません。
未知の event、effect、predicate、scope、tag などは無視せず validator error にします。

HP回復は `damage_taken` が実際に失わせたHPだけを、同じ攻撃チェーンの回復窓で戻せます。
防壁で吸収した分は窓に入りません。次の `action_started` またはラウンド／戦闘境界で
`recovery_window_closed` を記録し、残った未回復ダメージを確定します。リプレイ snapshot は
`recoveredDamage`・`recoverableDamage`・`unrecoverableDamage` を運び、UIは `hp-gauge.mjs` の
純粋な投影で最大HPバーを緑（未回復の残HP）・濃い緑（同じ攻撃中に回復した分）・赤（回復可能残分）・
黒（回復不能分）に分けます。区分の隣接境界は角丸にせず、最初の区分の左端を丸めます。赤がある
ときは赤の右端（赤／黒境界または赤の外側終端）だけを丸め、赤が無いときは黒の手前の最後の
非黒区分を丸めます。全損時は黒が外側区分です。

低HPの色も同じ投影を読み、生存中の `currentHp / maxHp` を整数 bps へ変換して、56%以上を緑、
26〜55%を黄、25%以下を赤とします。`app.js` は `hp-tone-green` / `hp-tone-yellow` /
`hp-tone-red` クラスと `data-hp-tone` へ変換し、残HP区分を主色、回復済み区分を主色の薄め、
回復可能区分を主色のかなり暗めへ揃えます。HPによって unit の枠色は変更しないため、行動・狙い・
被弾など既存の枠表示と競合しません。`data-hp-alert` とARIA語彙は閾値の意味を補助的に伝えます。
回復済み区分の統合・赤の黒への確定・戦闘不能時の確定は、エンジンの `recovery_window_closed`
と同じ snapshot の表示拍で起きます。

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
Campaign Stage の ID は `NAMED_SECTIONS` に含まれずこの照合の対象外なので、
引退した Stage ID は別に `ecology/content/campaign-stages.mjs` の
`RETIRED_CAMPAIGN_STAGE_IDS` へ理由付きで残します（issue #172）。

## 7. D1 とプレイ記録

`ecology/` は遠征終了時に、版、build 印、seed、Profile / Run の要約、event 列、
アンケート、感情マーカーを `/api/runs` へ送ります。送信失敗時も端末側の保存結果を
明示し、「保存済み」と「D1 保存済み」を混同しません。受け側は
`functions/api/runs.js`、schema は `migrations/`。取り出し方は `docs/OPERATIONS.md`。

## 8. 障害時に見る順

- 画面が空白: ブラウザ console → 公開された module の MIME → build 印 → 直接 import。
- 戦闘が止まる: 同じ seed のイベント列 → termination → anti-stall の結果。
  反応・連鎖の安全性は `analysis/ecology-chain-safety-audit.mjs` が、到達可能な技能・
AP/RP は actor × resource × round の収支と、spend 一回ごとの transfer 割当を追跡し、余剰回復は overflow 直下の consumer 多重化まで検査する。
  固定／生成装備の定義と代表的な event trace を別に検査する。AP/RP の受け渡しと生成、
  同じ owner/rule の chain 内再発火、自傷コスト由来の `damage_taken`、過剰回復の
  元 amount／親子関係、rule の limit.owner・scope・count を個別に見る。chain/battle cap
  到達は正常停止の証拠として数えず、既存の anti-stall（持越しHP・物資・装備）とも
  別の検査結果として報告する。
- D1 送信が失敗: payload の schema → HTTP status → `functions/api/runs.js` の許可 host → migration。
- 作者のプレイ結果を推測で補わず、未確認として止める。



### 8.1 資源報酬の許可例を追加するとき

\`docs/DESIGN.md\` §4.1.1 が意味上の契約、\`analysis/ecology-chain-safety-audit.mjs\` が機械的な
判定、\`analysis/ecology-chain-safety-blind-spots.mjs\` が追加例の実行可能な記録を担当する。
許可例を増やすときは次の順で更新する。

1. まず、既存の event / predicate / cost / effect / target / limit だけで、有限コスト型または
   外部イベントの一回型として定義できることを確認する。
2. \`allowedResourceCases\` に content 定義への path、発火条件、対象、支払い、上限、許可理由を
   追加する。実装 ID の比較だけで通す条件は追加しない。
3. 近い形で条件を一つ欠く不正例を \`skillCases\` または trace ケースに置く。例えば
   \`scavenge_ap\`（敵条件＋round/1）を許可するなら、敵条件と一回性を欠く
   \`free_defeat_ap\` は拒否され続けなければならない。
4. 監査側を変更した場合は、まず不正例を拒否できず CI が落ちることを確認し、その後に最小の
   判定を追加して、既存の許可例・新しい陽性例・近似不正例をすべて \`check-all.sh\` で確認する。
5. PR 本文には、追加した条件と陽性／陰性の件数、CI の結果を残す。

engine / schema に新しい語彙を追加する必要がある変更は、この追加手順の範囲外であり、
別の仕様・互換性検討を先に行う。

## 9. UI表示の責務

`app.js` の通常画面は、主見出し、現在の選択対象、次の操作の順で構成する。意思決定が済んだ画面では、次の操作を
先に押せるよう、主操作を詳細カード・履歴・内訳より前へ置く。隊列・技能・装備のような選択画面では
選択対象→確定操作の順を維持し、敵情報・技能ツリー・装備一覧は段階表示と折り畳みで長さを制御する。
技能ツリーは**地図と操作盤を分ける**。節（`.tree-cell`）は位置と状態だけを持ち、押した節の説明・
前提・派生・取得・段上げ・取得予約は画面下端へ貼る操作盤（`renderSkillSheet` / `.skill-sheet`）が
出す。節の中で開かないので、押しても地図は組み変わらず、釦は列幅ではなく画面幅を使える。
`focusSelectedSkillNode()` は、選び直した節が帯の窓の外に居るときだけ地図を寄せる。
盤は「その節を取るかどうかを決める材料」だけを持つ（効果の一文・足りない前提・一行に並ぶ
取得／段上げ／予約）。入切は `skillToggleSwitch()` の摘みを装着行と共有し、前提と派生の一覧は
地図が、予約の規則は畳んだヘルプが、いまの予約先は要約帯が出す。
装飾的な英語副見出し、
常に表示する一般説明、同じタブへ戻るNEXT/QUICK LINKSは画面の主操作から外し、必要なルールを
`details.help-details` のタップ式ヘルプへ置く。`helpOpen` が開閉状態を保持するため、同じ画面の
再描画でも読んでいた詳細は閉じない。戦闘のプレイヤー向け履歴は「戦闘履歴」、全イベントと build・rule version・run・seed は
その中の折り畳まれた「技術ログ」に分ける。通常画面の header / footer には内部版数を出さない。
shell を共有するタイトル・キャンプ・戦闘・結果・精算の全画面と、戦闘予測の冗長文が戻らないことを
`analysis/ecology-screens-smoke.mjs` が検査する。表示整理は予測・本番・報酬・精算の計算経路を変更しない。

画面本体の文章は、ストーリーと技能・装備の説明文に絞る（issue #236）。状態・数量・対象・可否は
記号・数・棒・色・配置で出し、**同じ数を同じ画面で二度出さない**。見出しとその直下の要約が
同じことを言っている組（「技能ツリー」の見出しと summary、「ゴウの装備枠」と直上の人物帯、
「補給 2 / 3」の見出し札とバーの頭）は札の側を落とす。金の主ボタンは位置と色でそれ自体が
「次の操作」なので、`primary-action-label` のような札を重ねない。押せる形になっているカードの
一覧へ「選んでください」と書き添えず、**二手続きの操作で次の一手が要るときだけ**一行を出す
（装備を選んだあとの「装着する枠を選ぶ」、隊列の「移動先の枠へ」、治療の対象選び）。
戦闘マップの凡例と配置の説明は畳んだヘルプへ置き、各節は `title` と読み上げラベルで
自分の状態（「第3戦・精鋭・未到達」）を名乗る。同じ種類の敵が並ぶ回は、`enemy-lore` の一行を
最初の1枚にだけ出す。

### 図で言う共通語彙（作者要望 2026-09-13）

**説明を段落で書く画面は作らない。**規則・内訳・状態・因果は、記号・数・目盛り・流れで出す。
`app.js` はその語彙を一箇所だけ持ち、画面ごとに似た形を作り直さない。

| 関数 | 出すもの | 主な使い先 |
|---|---|---|
| `glyph(name)` | 線画の記号（`currentColor` を継ぐ 24×24 SVG） | すべての段・タイル・札 |
| `statTiles(items, className, columns)` | 数の並び（数が主、名が従） | 敗北・精算・完走・結果・設計図 |
| `ruleGrid(items)` | 規則の一段（記号＋見出し一語＋一行） | 各ヘルプ、警告、画面の前置き |
| `flowStrip(steps)` | 順のあること（払う→変える→戻る） | 再挑戦、設計図の行き先、完走の道のり |
| `segmentMeter(value, max, options)` | 段のあるもの（12段まで目盛り、超えたら帯） | 鍛錬・補給・到達・解禁・図鑑・名簿 |
| `ledgerRows(rows)` | 内訳を長さで比べる | 精算の内訳 |
| `splitColumns(keep, lose)` | 残るもの／消えるもの | 精算 |
| `verdictSigil(kind)` | 決着の印（勝ち・退き・敗け） | 敗北・精算・完走 |
| `battleLegend()` | 盤面と同じ帯・色・点の凡例 | 戦闘画面の「表示の説明」 |
| `expeditionShapeRail()` | 12戦の並び（幕・精鋭・ボスの位置） | 遠征の準備 |
| `counterChips()` / `learningNotes()` | 法則への手／区画の覚え書き | 遠征の準備 |
| `emphasize(value)` | content の `**強調**` を太字にする | 区画の学び |

規則:

- `ruleGrid` の一段は「記号ひとつ・見出し一語・十数文字」。二行要るなら規則が二つある（段を分ける）。
- 画面に数を写さない。鍛錬の効き（`TRAINING_STEP_BPS` と段数）、設計図の残せる件数
  （`blueprintSaveLimitFor`）、補給の総数のように、**定数から引けるものは引く**。
  書き写した数は、実装を変えた日に置き去りになる（旧「一段6%」「勝利2件・撤退2件・敗北1件」が
  実際の値と食い違っていた）。
- 段落で残してよいのは、会話（`story`）、世界の側の一行（`world-voice` / `settle-closing` /
  名簿・図鑑・根城の本文）、content が持つ説明文だけ。
- 語彙の関数とその CSS、そして消した段落が戻っていないことを
  `analysis/ecology-screens-smoke.mjs` が検査する。

### 会話の門（STORY_GATES）

会話の最後の拍で、「進む」の代わりに**一つの操作だけ**を差し出す仕組み。`app.js` の
`STORY_GATES` が beat の id で引ける表で、`storyGate()` が「その beat に門があり、
最後の行で、積んだ断片も尽きている」ときだけ門を返す。

門があるあいだは、`renderStory()` が舞台（`.vn-stage`）に被せて `.vn-gate` を描き、
進む合図（`.vn-caret` / `.vn-hint`）を出さない。舞台を叩いても `advanceStoryLine()` を
呼ばず（文字送りの早送りだけは効く）、AUTO の自動送りも仕掛けない。門そのものは
文字送りが終わるまで出さない——CSS の `.vn.typed .vn-gate` が出すので、JS の追加は無い。

**スキップも門を越えない**（issue #200 の続き）。`storySkipStop()` が積んだ断片から門を
探し、見つかれば `skipStoryToGate()` が**その断片の最後の行**へ飛んで止まる。飛ばした行は
`pushStoryLog()` で履歴へ積むので、読み返せるし、巻き戻しの逆走もその行を材料にできる。
文字送りは終わった扱いにする（`storyShownLine` を飛び先へ合わせる）ので、門はすぐ出る。
門の無い会話では `storySkipStop()` が null を返し、これまでどおり丸ごと飛ぶ。

いまの登録は1件、**序盤の一戦の敗北**（`stage_0_prologue_defeat` → `rewind-prologue`）
だけである。通常の敗北は巻き戻らないので、増やす前提を持たない。

`enterPrologueBeatIfDue()` が積む倒れた会話の `after` は `"prologueRewind"` で、
`finishStory()` はそれを受けて `rewindPrologue()` を呼ぶ。スキップが門で止まるように
なったので、**通常の操作でこの枝を通る道は無い**（越える手段は門の釦だけ）。門が出ない形
——queue に別の断片が続く保存など——で最後の行を越えたときに、巻き戻さずキャンプへ
落ちないための受け皿として残してある。結果画面は序盤の敗北の経路から外れた
（`after === "prologueResult"` は無い）。保存枠が尽きたときの minimal snapshot は
phase を battle から result へ寄せるため、会話を見ないまま結果画面に立つことがある。
その保険として `resume-prologue-defeat` が倒れた会話へ戻す。

### 巻き戻しの演出（phase `rewind` / issue #200）

会話の門［時間が巻き戻る］を押した先は、**逆走の場面**である（押した瞬間に次の会話へ
遷移しない）。`rewindPrologue()` の順は次のとおり。

1. `rewindScene()` が、**状態を触る前に**逆走の材料を写す。舞台は倒れた会話の beat
   （mood・場所・立ち絵をそのまま使う）、逆走する行は `state.story.log` を
   `REWIND_TRACK_LIMIT` 件まで逆順にしたもの。**新しい台詞は足さない。**
2. 巻き戻しそのもの（`prologueStage = "retry"`、負けた配置の引き継ぎ、`lastResult` と
   replay の破棄、`record("prologue_rewound")`）。
3. `enterStory([… prologueRewound …], "camp", { via: "rewind" })`。`via` は**積んだ会話の
   手前に一度だけ挟む場面**の phase で、会話はもう積み終わっている。

`renderRewind()` は会話と同じ `.vn` / `.vn-stage` を描き、`mountRewindView()` が DOM 側で
進める（会話の文字送りと同じで、一文字ごとに state を書き換えない）。拍は
閃光（`.firing`）→ 逆走（行ごとに `.jolt`、末尾から消す）→ 静止（`.settled`）→
白へ抜ける（`.out`）で、`finishRewind()` が phase を `"story"` へ移す。**舞台を叩けば
（`rewind-skip`）どこでも追い越せる**し、`prefers-reduced-motion` では行の差し替えだけに
落ちる（揺れ・帯・筋・閃光は CSS の `@media` が止める）。

演出へ入る時点で状態は**もう巻き戻し済み**なので、途中でリロードしても進行を失わない。
`persistableState()` が phase `rewind` を `story` として保存し、再開は巻き戻し後の会話から
続く（演出は二度出ない）。`state.rewind` は保存しない。

二つの順序が効いている。**`finishStory()` の `prologueRewind` の枝は、履歴を初期化する
前に置く**（会話をスキップして巻き戻したとき、逆走させる行が消える）。**会話の門の押しは
下の舞台へ落とさない**（`.vn-gate` の釦は `data-action="story-advance"` の `.vn-stage` の
中にあるので、止めないと一押しで巻き戻しと「叩いて進む」が続けて起き、巻き戻し後の
一行目が読み飛ばされる）。どちらも `analysis/ecology-screens-smoke.mjs` が見張る。

### 技能の取得と装着（issue #236）

**「取得済みだが未装着」という状態は無い。**技能枠は `SLOT_LIMITS` の
`active` / `reactive` / `passive` とも `Number.MAX_SAFE_INTEGER`（上限があるのは装備の2枠だけ）で、
取得したものを装着できない場面が存在しない。この状態は「オフ」と同じことを二通りに
表しているだけだった。

不変条件は一つ。**`runUnlockedSkills[c]` に入っている技能は、必ず種別ごとの装着欄にも
並んでいる。**出すか出さないかは `loadout.disabled` だけが決める。

- `unlock-skill` は `unlockRunSkill` のあと `equipSkill` を通す（**オンで**装着され、
  その場で回り始める）。
- `joinRun` と保存の読み込みは `installUnlockedSkills()`（`playable-battles.mjs`）を通す。
  こちらは**オフで**末尾へ足す。starter の無償閉包で取得済みになる親の節や、
  旧い保存が持っている未装着の技能が対象で、**オンで足すと今まで出ていなかった技能が
  急に回り始める**（＝過去の遠征の結果が変わる）ため。

この置き換えが戦闘へ影響しないことの根拠は `allyInput()` にある。tactics・reactives・
passives のいずれも `enabled()` で `disabled` を除いてから battle input を組むので、
**engine から見て「オフ」と「未装着」は同一**である。必殺技も同じで、`withUltimate` は
`enabled()` 後の列へ差し込み、`ultimateCandidates` は disabled を候補から外す。

`analysis/ecology-screens-smoke.mjs` が片側検査で「装着する釦・`equip-skill` handler・
`.skill-node.unlocked` が戻っていないこと」と「三つの経路が残っていること」を見る。
`analysis/ecology-trial.mjs` は保存へ技能点を入れてから実際に一つ取得し、
装着行に並ぶところまで踏む（技能点は0で始まるので、点を入れないとこの経路は踏めない）。

### キャンプのタブ（issue #235）

キャンプのタブは スキル・装備・補給・遠征 の4枚で、`campNav()` が出す。準備の3枚は何度も
往復する画面、遠征タブは「次の一戦へ進む」と遠征そのものをどうするか（`rosterSwapSection()` の
顔ぶれ・`abandon-run`・`open-save-menu`）を決める画面で、役が違う。`renderCamp()` は
`shell(..., { hideHeaderAction: true })` を使い、**固定される上端の外に常設ボタンを置かない**
（旧 `campTools()` と shell のヘッダー操作は、実測で iPhone 幅の第一画面 64px を占めていた）。

撤退だけは `state.prologueActive` と `supplyTutorialVisible()` のあいだ出さない（隊列を直しきる
前に離脱されると「一手直せば勝てる」導入が成立しない）。**セーブは離脱ではない**ので、
物語の最中でも遠征タブから触れる。

### 仲間の共通盤面（issue #159 / #235）

キャンプで仲間を選ぶ経路は `partyBar(tab)` 一つに閉じる。盤面は `POSITIONS` から
そのまま3列×2行を組み、行の見出しと格子は戦闘中の `battleRowsHtml()` と同じ形にする。
セルの中身は `partyCellPerson()`、セルに掛かる操作は `partyCellRole(mode, position, characterId)`
だけが決める。

mode は**タブではなく盤面の状態**で、`boardMode(tab)` が一箇所で決める（issue #235 で
編成タブを廃止したため）。優先順は、補給タブで単体治療・蘇生を選んでいるあいだの `treat`
（`select-treatment-target`）、`state.formationMode` が立っているあいだの `formation`
（`place-character`）、補給タブの既定の `none`（操作なし・`<div>`）、それ以外の `select`
（`select-character`）。`formationMode` は予測の見出し行の「⇅ 隊列」（`toggle-formation-mode`）
で入り、**どのタブからでも同じ一手**で隊列を組み替えられる。この状態はその場かぎりなので
`persistableState()` が落とし、読み込みでも `false` へ戻す（盤面が組み替えの途中で開くと、
人物を選ぶつもりの一押しが移動になる）。盤面は隊列を変える唯一の入口なので、
`formation` 以外の mode から `state.run.formation` は動かない。

### 遠征側の敵盤面

`renderMap()` の敵欄は `expeditionEnemyBoard()` が担当し、盤面の行・列は戦闘表示と
`positionRowsHtml()` を共有する。敵側は戦闘と同じく `rear` → `front` の順、各行は
`left` → `center` → `right` の3枠で、空き枠も詰めない。敵セルは
`select-expedition-enemy` を持つ button とし、押された `instanceId` を画面状態の
`state.selectedEnemyId` に置く。選択状態は `persistableState()` で落とすので、敵の詳細を
途中の遠征へ保存しない。

詳細本文は既存の `renderEnemy()` を選択中の一体にだけ適用し、`enemy-selection-detail` として
盤面の直下に置く。これにより敵の位置は3×2の盤面で読み、狙い・変異・ロアは押した一体の
詳細で読む、という二段の表示になる。同じ encounter の敵だけを handler で受け付け、
戦闘後の `advanceAfterBattle()` では選択を解除する。

セルは顔部分を `portraitSvg(..., { crop: "face" })` で切り出した背景レイヤーとして敷く。名前と職種アイコンは
顔の上へ置かず、目元を残す。AP/RP のピップ、HP バー、増減は下部の `forecast-info-layer` へ集め、
情報部分だけを濃いグラデーションで覆う。顔はこの帯に隠れない範囲で濃く表示する。
元画像ごとの余白差は `character-face-watermark[data-character]` の共通補正で吸収し、
予測セルと戦闘カードの両方が同じ人物別スケールを読む。5人を同じ条件で確認する開発画面は
`/ecology/portrait-test.html` に置く。4行積みだった頃は 1 セル 67px・固定領域 234px で、
iPhone 幅（390×844）の画面の3割を常時占めていた。

予測は従来どおり `battleForecast()`（`previewNextBattle` → `expeditionBattleOptions`）から
読み、`forecast.perCharacter` を characterId で引いてセルへ差し込む。**予測が無い場面でも
盤面は描き、勝敗・ラウンド数・開始→終了HPの帯だけを落とす。**予測セルの DOM 名
（`forecast-member` / `forecast-hp-values` / `forecast-delta`）は通しの検査が数字を読む契約なので、
`analysis/ecology-screens-smoke.mjs` が画面と CSS の両方で存在を見る。同じ smoke が
「キャンプのレンダラーに二つ目の仲間選択（`memberTabs` / `formation-board` / 治療専用の対象一覧）が
戻っていないこと」と「隊列の選択が先頭の仲間で初期化されていないこと」も片側検査で塞ぐ。
ブラウザでの実挙動（隊列交換・技能／装備の対象切替・集中治療と蘇生の対象選択）は
`analysis/ecology-tutorial-trial.mjs`、盤面が iPhone 幅で横スクロールしないことは
`analysis/ecology-trial.mjs` が踏む。

戦闘中の `unitHtml()` も同じ `portraitSvg(..., { crop: "face" })` を味方枠の背景へ差し込み、
`character-face-watermark` を z-index 0 に置く。味方の名前・職種アイコンは描画せず、
`unit-info-layer` に行動内容・HP・資源・状態を集める。DOM の順番は行動内容（表示時だけ高さを持つ）→
HPバー→数値・状態で、情報帯の下側へ重ねるグラデーションが顔との境界を担う。これにより通常時は空いた行動欄ぶん
顔を大きく見せ、行動中だけ内容をHPの上へ出せる。`portrait-test.html` はこの2種類の枠を同じ画面に
並べ、目元の基準線と情報帯込みで補正を確認する。敵には対応する人物画像がないため、既存の敵アイコンと枠を維持する。

## 生成装備ruleの耐久契約

`equipment-gen.mjs` は、修理以外の全生成ruleへ `wear_equipment` costをちょうど一つ付ける。
消費量はruleのeffect形状から決定的に導出し、単体・単効果は1、複数効果・多段・範囲は2とする。
affix由来のHP・防壁・RP等の追加costとは別枠で、engineの既存のatomic cost処理を共有する。
修理effectは例外として耐久costを付けず、非耐久の有限costをgenerator監査で必須にする。

`statBonus` はrule列の外で `static-bonuses.mjs` が適用するため摩耗しない。戦闘中は
`equipment_worn` のbefore/amount/afterがreplayと表示の正本であり、耐久0のinstanceは
`engine.ruleEntriesFor` が以後のdispatch対象から外す。新しいevent語彙は追加しない。


この変更は生成装備ruleの既存cost欄の意味を変えるため、content contractは18へ上げる。
generator version 7より前のBlueprintは互換不能理由を表示し、現行ruleへ黙って読み替えない。

### affix 目録の追加（PR #255 / generator version 8）

作者指摘「ダメージ増加系の装備がない」「スキルやキャラとのコンボのワクワクが無い」
「『回復が仲間全体につく』のに回復効果のない装備がある」に対して、目録（`content/affixes.mjs`）
へ次を足した。組み立て側（`equipment-gen.mjs`）の契約は変えていない。

| 追加 | role / family | 何のため |
|---|---|---|
| `src_outgoing` 研ぎの | source / edge | **自分が与えるダメージが決まる直前**を読む trigger。これが無かったので「与ダメージが増える装備」が一つも作れなかった。cost の自傷を拾わないよう「敵が的」「cost ではない」を両方要求する |
| `pay_amplify` 増幅 | payoff / edge | `modify_pending_amount` の increase。追撃（別インスタンス）ではなく、いま決まる一撃そのものを太らせる |
| `pay_rend` 総崩し | payoff / edge | 生存する敵全員へ隙。自分の追撃にはならないが、隊の誰のダメージも通るようになる |
| `pay_rupture` 抉り | payoff / scar | 裂傷を負った敵すべてへダメージ。裂傷を配る技能（抉る）・装備（裂傷）が先に要る |
| `cnv_exposed` / `cnv_bleeding` | converter / edge・scar | 刻んだ状態を条件にする。装備単独では満たせないので、構成の中でだけ強く鳴る |
| `key_honed` 研ぎ澄ました | keystone / edge | 装備が与えるダメージ +50%。hit を増やす `key_twin_edge` は受けに二度払うので、量そのものを増やす伸び方を別に置いた |

`pay_rend` / `pay_rupture` は `requires: ["enemy_target_alive"]` を持つ。敵を的にしない
trigger（手当てや被弾）へ付くと、隙も裂傷も配れないまま並ぶ死に効果になるためである。

回復の基準値は tier 0/1/2 で 3/5/12 → **10/18/30** へ上げた。`key_overflowing`（回復が
味方全員へ届く）は元から heal effect を要求していたが、量が barrier の 1/5 しかなく、
「全体へ届く」と書いてあるのに実質ゼロだった。anti-stall の形（被弾 chain の中だけ・
有限コスト・chain 1回）は変えていないので、回復量は依然その攻撃で受けた傷が上限である。

目録が増えると生成物の内容が変わるので content contract は 22、generator version は 8。
**既存の Blueprint は保存した定義そのものを持つので、版が上がっても動く。**

## 必殺技の作られ方（issue #238）

必殺技は content ではなく**変換規則**である。`ecology/ultimates.mjs` の `ascendSkill` が、
取得済みの技能定義から必殺技の定義（ID は `ult_<元のID>`）を作る。純関数で、`Date` も
`Math.random` も読まない。

    RunState.loadout.ultimates      … 誰がどの技能を必殺に指定しているか
    RunState.loadout.ultimateArmed  … その一戦で誰が構えているか
    RunState.ultimatesUsed          … この遠征でもう放った人物（一人一度きり・補充なし）

`progression.armedUltimates(run)` が「Stage が解禁されていて、指定が有効で、構えていて、
まだ放っていない」組を roster 順で返し、これが唯一の正本になる。`runContentBundle(run)` は
その技能の必殺定義を bundle へ混ぜ、`playable-battles.allyInput` は**元の技能の一つ前**へ
必殺を差し込む。だから必殺は元の技能と同じ条件で判定され、同じ場面に出る。予測と本番は
`simulateExpeditionBattle` の同じ経路を通るので、構えても両者はずれない。

必殺が必ず持つ発動条件は二つで、どちらも既存の語彙で書けている。

  - 「1戦闘に1回」… 規則を持たない状態 `ultimate_spent` を自分へ付け、
    `has_status = 0` を条件にする。
  - 「隊の誰かが削られていること」… `target_exists` + `hp_percent`。

**engine にも schema にも必殺のための語彙は無い**（`ecology/ultimate.test.mjs` が両ファイルの
本文を読んで確かめる）。

放ったかどうかは戦闘のイベント列から読む（`ultimateFirings` が `status_added` の
`ultimate_spent` を拾う）。構えただけでは使わない。**`previewNextBattle` の返り値も
`ultimateFiredBy` を持つ**ので、画面は「構えた必殺がこの一戦で本当に出るか」を戦う前に出せる。
`commitBattleResult` が**勝った戦闘でだけ**その人物を `ultimatesUsed` へ入れ、構えを解く。
負けた一戦は run を変えないので、retry で二重に取られない。

UI は専用の枠を持たない。装着行（`.installed-row[data-longpress]`）の長押しが**この一戦の
必殺の入切**で、`render()` のあとに `bindLongPress()` が pointer イベントを張る。長押しは
`data-longpress` の action を、通常のクリックは `data-action` を `handleAction` へ渡す。

**操作は長押し一回に畳んである**（作者指摘 2026-09-12）。`playable-battles.toggleUltimateForBattle`
が指定（`ultimates`）と構え（`ultimateArmed`）を同時に動かす唯一の入口で、画面に押す釦は
無い（行の `✹` は状態の印である）。指定と構えを別々に動かす `setUltimate` /
`toggleUltimateArmed` は model の原子操作として残り、`ecology/ultimate.test.mjs` が直接見る。
行の見た目は三段（指定＝金の縁／構え＝脈打つ／この一戦で出る＝光が走る）で、段の差が
そのまま状態の差である。

押している時間は行の左から伸びる光の帯で出す（`.installed-row.pressing::before`）。
**長さの正本は `LONG_PRESS_MS` ひとつ**で、`bindLongPress()` が
`--long-press-ms` として CSS へ渡す（両方に書くと、ずれた日に「満ちたのに入らない帯」が
できる）。誰が必殺を残しているかは盤面のセルの `ultimateCellMark()` が四段で出し、
**隊の合計はどこにも出さない**（合計は「誰の一回か」に答えない）。

## 操作の反応（issue #237）

**画面は毎回まるごと描き直す。**`render()` が `app.innerHTML` を差し替えるので、描き直した
あとの要素は全部が生まれたてで、前の姿を持っていない。「いま何が変わったか」を知っている
のは操作の側だけである。反応の層はそこを二つの口で埋める。

  - **`fx(key, kind)`** … 離散な出来事。操作した本人が「次の描画ではここが光る」と申告する。
    印は `data-fx="<key>"`。`applyPendingFx()` が描き終わってから `fx-<kind>` を足し、
    申告を空にする。key は立ち位置（`cell:front_left`）・技能（`skill:<id>`）・装備枠
    （`slot:<人物>:<番号>`）・タブ（`tab:skills`）のように**何が変わったかの名前**にする。
  - **`data-fx-watch="<key>"`** … 数の変化。読み値そのものに印を付けておくと、
    `pulseChangedReadouts()` が前の描画の文字列と突き合わせ、変わった回だけ
    `fx-up` / `fx-down` / `fx-change` を足す（向きは最初の整数で決め、読めなければ
    `change`）。**どの操作がどの数へ響くかを操作の側へ書き写さない**ので、経路が増えても
    反応は勝手に追いつく。装備を替えれば盤面の予測HPが、技能を取れば技能点が、戦って
    戻れば補給・耐久・現在地が、申告なしで光る。

初めて出た読み値は光らせない（画面へ来たことは変化ではない）。画面から消えた読み値は
忘れる（覚えたままだと、次に出たときへ嘘の反応が出る）。遠征が替わったら
`resetFxMemoryIfRunChanged()` が記憶ごと捨てる——別の遠征の数と比べない。

予測だけは読み値ではなく**予測そのもの**を見張る。`forecastSignature()` が勝敗・ラウンド
数・全員の開始／終了HP・戦闘不能を一本の文字列にし、一つでも動いた回に
`.forecaster-window` が `fx-recalc` を受ける。窓に出ている文字だけを
見ると、「勝利・3ラウンド」のまま終了HPだけが上がった回を取り落とす。

`fx-recalc` の下で起きるのは**ブラウン管の同期外れ**である（作者指摘 2026-09-13）。
硬い走査線が一度降り（`.forecaster-window.fx-recalc::after`。常時の一本
`.forecaster-scan::after` とは別の面に置く）、面の横の目が濃くなって転がり
（`.forecaster-scan::before`）、見出し行と盤面が別の拍で左右へずれる（`fx-crt-desync` /
`fx-crt-tear`）。**釦の段（`.forecaster-actions`）は動かさない**——ブレている最中に
押される的である。

変わった読み値が窓の中にあるときは、`hauntWithPreviousValue()` が前の描画の値を
`<span class="fx-ghost" aria-hidden="true">` として一枚重ね、`animationend` で捨てる
（次の描画でも消える）。**読み値そのものの差し替えは遅らせない**——遅らせると、速く押した
回に古い数が残る。流れるのは影のほうだけである。影を置いた枠（`.party-cell`）が他の反応を
着ていなければ `fx-crt` も足し、誰の予測が動いたかを枠のずれで出す。

反応の class は次の描画まで外れないので、**`.fx-recalc` の下で静的な見た目を差し替えない。**
背景や濃さを class で塗り替えると、動きが終わったあとの窓にそれが残る。動かすのは
opacity と transform に限り、終端の keyframe を書かずに元の値へ戻す。

`applyRenderFeedback()` が反応を載せる唯一の場所で、`render()` の**最後**に呼ぶ
（先に呼ぶと `publishCampTopHeight()` が立ち上がり途中の高さを測る）。画面の立ち上がりも
ここが決める。キャンプはタブの中身（`.camp-view`）だけを動かし、**貼りついた上端
（`.camp-top`）は動かさない**（毎回跳ねるとタップ対象が動く）。タイトル・会話・巻き戻しは
自前の入り方を持っているので重ねない。

時間と曲線は `styles.css` の `:root` が四段だけ持つ（`--fx-tap` / `--fx-quick` /
`--fx-step` / `--fx-accent`）。JS 側には書かない。`prefers-reduced-motion` は
styles.css の「反応」節の末尾で一括して止める。

## 盤面の手応え（戦闘アニメーション）

演出は**新しい event も新しい拍も持たない**。`syncBattleView` が、いま表示している拍の
イベント列だけから向き・重さ・種類を決め、CSS のクラスと CSS 変数へ落とす。時計も乱数も
使わないので、同じ seed・同じ入力からは同じ演出が同じ順で出る。

  - **重さの三段** … `hitLevel(amount, maxHp)` が最大HPに対する割合で 1／2／3 を返す
    （15% 以上で 2、30% 以上で 3、撃破はその拍の 3）。段は `unit` の揺れ（`hit-2` /
    `hit-3`）・浮く数字の大きさ（`.float.damage.heavy` / `.crush`）・盤面の揺れ
    （`.battle-field.shake-1〜3`）の三箇所へ**同じ値**で効く。
  - **踏み込む向き** … `lungeShiftPx()` が狙った相手との**列差**（`BATTLE_COLUMNS` の
    index 差）を ±9px の `--lunge-x` にする。前後（味方は上・敵は下）は side の CSS が持つ。
  - **踏み込んだ先の線** … `spawnStrikeLine()` が攻撃側と被弾側の矩形中心を結ぶ
    `.strike-line` を一本置く。長さと角度は二つの箱の位置だけから出る。
  - **浮く数字** … `.battle-floats`（盤面の層）へ座標で刺す。`unit` の中に置くと、味方の箱
    （立ち絵のため `overflow: hidden`）で消え、敵では一つ上の箱の中に出て持ち主が読めない。
  - **幕の帯** … `battleBannerFor(beat)` が拍の種類だけから言葉を決める（opening／round／
    ending）。カットインと同じく `dataset.beat` で同じ拍へ二度書き込まないので、再描画でも
    演出が巻き戻らない。読み上げは `.beat-text`（aria-live）が持ち、帯は `aria-hidden`。
    決着（ending）の帯だけは `hold` を返し、`banner-*-hold` の keyframe で開いたまま止まる
    （再生がその拍で終わるため）。出ているあいだは `.battle-field.verdict-hold` が拍の行の
    見た目だけを譲らせる。

`prefers-reduced-motion` では動きだけを止める。帯・カットイン・照準・数字は**出したまま**
なので、止めても何が起きたかは読める。

## 再生の終点と、次の場面への渡し

**リプレイの終点は「最後の拍」ではなく「決着の拍」である。**`endingBeatIndex()` が
`kind === "ending"`（`battle_ended`）の拍を探し、無ければ末尾へ落とす。`atReplayEnding()`
がその判定を一箇所で持ち、自動再生（`scheduleReplayBeat`）・一手送り・釦の出し分け
（`updateReplayControls`）が同じ答えを読む。

  - `scheduleReplayBeat` は終点で `replayPlaying` を落として**そこで止まる**。以前は
    `beatDurationMs` ぶん待って `goToBattleResult()` を呼んでいたが、決着の帯が出た直後に
    画面が入れ替わり、勝敗を読む間が無かった（issue #138 の自動送りをここで畳んだ）。
  - `replay-verdict`（［一気に決着へ］）は `replayIndex` を終点へ動かすだけで、場面は
    変えない。盤面・HP・履歴は拍から引き直すので、飛ばした先は一手ずつ進めた先と同じ。
  - `replay-result`（［次へ］）だけが `goToBattleResult()` を呼び、序盤の会話
    （`enterPrologueBeatIfDue`）・結果画面・キャンプ・精算のどれかへ渡す。**戦闘画面から
    出る道はこの一本だけ**なので、飛ばしても会話の既読印を飛び越えない（R12）。
  - 前進の釦は常に一つだけ出す（終点の前は［一気に決着へ］、終点からは［次へ］）。
    出し分けは `hidden` 属性で、描き出し（`renderBattle`）と更新（`updateReplayControls`）
    が同じ `atReplayEnding()` を読む。

灰の門の一戦は `truncateAtFall` で `battle_ended` の手前まで切ってあるので ending 拍を
持たない。終点は倒れた拍（末尾）へ落ち、帯は出ないまま［次へ］で会話へ渡る。

## 必殺の拍とカットイン（issue #242）

必殺は**新しい event を持たない**（engine も schema も必殺を知らない）。だから
`replay-beats.buildBeats` は ID の形だけを読み、`kind: "ultimate"` の拍を一つ増やす。

  - アクティブ … `action_started` の `skillId` が `ult_` で始まる拍。宣言の event が
    あるので、盤面が動く前にカットインを置ける（`to` はその index）。
  - リアクティブ … 割り込みは宣言の event を持たない（`fireRule` は効果だけを出す）ので、
    `ruleId` が `ult_` で始まる**最初の効果**で拍を開き、`to` を一つ前にして
    「効果が乗る前の盤面」を見せる。

同じ firing から二度カットインしない（`sourceActorId` + `chainId` + `ruleId` で一度だけ）。
拍の列はイベント列だけから決まるので、一時停止・一手送り・戻す・速度変更・自動再生の
どれでも順序が変わらず、`ecology/replay-beats.test.mjs` と `analysis/ecology-ultimate-smoke.mjs`
（放った数とカットインの拍数が一致すること）が性質として見ている。

画面側は `.battle-field` の中の `.ultimate-cutin` 一枚で、`syncBattleView` が拍の
`ultimateId` から立ち絵・技能名・変換の印を組む（画面は必殺の表を持たない）。

## 必殺技の一戦（issue #240）

手書きの一戦は二つあり、どちらも `composeEncounter`（threat budget）を通らない。
`playable-battles.scriptedEncounter` が唯一の組み立てで、content の定義から敵を作る。

  - 灰の門（`PROLOGUE`）… 第0戦。12戦の梯子の外
  - 塞ぐ二枚（`ULTIMATE_LESSON`）… **Stage 1 の第1戦そのもの**

画面は `ultimateLessonActive()` が真のときだけ `currentEncounter()` で差し替える。**予測も
本番も `currentEncounter()` を通る**ので、「予測では勝てたのに本番は別の敵」が起きない。
印は `profile.storyFlags` の `ultimate_lesson_seen` で、**勝った時点**で押す（負けた回は
押さないので、再挑戦では同じ教材が出る）。

手取りの錠は隊列・補給チュートリアルと同じ形を共有する。`tutorialGate()` が「いま掛かっている
段・錠・光らせる先」を一つ返し、`applyTutorialGate()` が描画のあとに光と錠を掛け、
`tutorialAllows(element)` が経路側でも同じ選択子で塞ぐ。**光らせる先と押せる先が同じ表**
から出るので、「光るのに押せない」が構造として起きない。
