# 技術契約とコードの地図

## 1. リポジトリの地図

| パス | 役割 |
|---|---|
| `ecology/` | **本編。**UI、content、engine、進行、replay、local save |
| `analysis/` | 検査。`check-all.sh` と `ecology-*.mjs`（smoke・公開先 E2E）、`stamp.mjs`（build 印） |
| `analysis/ecology-enemy-tactics-smoke.mjs` | 敵専用技能registryから、庇護・治療・弱体・多段の実戦参照を検査する smoke。 |
| `analysis/ecology-weapon-loadout-smoke.mjs` | 初期4技能、武器技能pack、敵技能pack、未参照技能の不在を検査する smoke。 |
| `analysis/ecology-enemy-tactics-smoke.mjs` | Stage 1 の敵による庇護・治療・全体弱体・三段攻撃を event 列で検査し、Stage 9 最終戦を上限鍛錬の固定隊で「五人必殺なら勝利、0人または任意の4人なら敗北」に固定する smoke。 |
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
| `content/expedition.mjs` | **遠征の敵配置の正本。**Stage ごとの3幕12戦（`STAGE_ENCOUNTERS`、10 Stage）、threat budget、boss law、難易度 rank。Stage 1以降の役割編成と、Stage 3後半・Stage 6〜9の明示的な `enemyStatScale` もここで宣言する。`EXPEDITION_ENCOUNTERS` は Stage 0 の12戦（Stage を渡さない呼び出しの既定）。`progression.composeEncounter(index, rank, { partySize, stageSequence })` → `playable-battles.makeExpeditionBattle` の経路を全プレイ経路が読む |
| `content/enemies.mjs` | **敵 unit の正本。**家系（`ENEMY_FAMILIES`）ごとの個体表と `FAMILY_POWER`（家系共通の出力）、`ENEMY_THREAT_COST`。庇護役・治療役も味方と同じ `cover_ally` / `mend` を `reactives` に持つだけで、敵専用の分岐は無い。家系共通でない幕内の敵倍率は `content/expedition.mjs` の明示的な指定で行う |
| `content/weapon-trees.mjs` | プレイヤー向け武器技能の正本。各節は `weaponId / position / kind / skillId / cost / requires` を持ち、前提は取得済みIDだけで判定する |
| `content/enemy-skills.mjs` | 敵AI専用の active / reactive / passive registry。敵unitが参照する技能だけを保持する |
| `content/packs.mjs` / `content/skill-packs.mjs` | 装備packと武器技能packを分離した正本。画面では一つの遠征pack案内へまとめるが、manifestでは別欄で保持する |
| `content/roster.mjs` | 人物の加入時初期技能。各人物の代表武器2本の `R` と `A1` を一つずつ、計4節から導出する |
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
`analysis/ecology-map-smoke.mjs` と `analysis/ecology-screens-smoke.mjs` が、12戦の配置と画面契約を確認します。

## 3. 状態は三層

| 層 | 永続期間 | 主な内容 |
|---|---|---|
| ProfileState | 全遠征をまたぐ | 人物、活動資金、購入済み投資、人物鍛錬、Blueprint archive、図鑑、最高 clear Stage、解禁 content、物語の既読印、schema version |
| RunState | 一遠征 | manifest、Campaign Stage、12戦進行、現在 HP、補給と**その遠征の補給総数**、**必殺印**、隊、formation、run 技能点・武器技能の取得・装着順・人物ごとの取得予約・**必殺技の指定と構え**、**その遠征で拾った装備の定義そのもの**、持込 Blueprint、仮計上資金、結果 |
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
武器別ツリーの節はすべて1SP・レベルなしで、前提は取得済みIDだけを見ます。取得予約は
`reserveRunSkill` が人物ごとに一つの目標節を保存し、`fulfillSkillReservations` が技能点を得た時点で
前提から目標まで自動解禁します。別の節を予約した場合は既存の予約を置き換えます。
セーブは現行の `SAVE_FORMAT_VERSION` / `RUN_SCHEMA_VERSION` / `MANIFEST_VERSION` が一致するものだけを読み、
旧セーブの技能・pack・loadoutを移行しません。
戦闘時の選択は `playable-battles.mjs` の loadout に保存し、active 一つ、ordered reactive、ordered target、
全 passive を `allyInput()` が preview と本番に共通で渡します。
`simulateExpeditionBattle` が予測と本番の入力構成と `equipmentBreaks: false` を共有するため、
HP・装備耐久を含む同じ入力から同じ結果とイベント列を返します（旧 replay の技能レベル欄は読み取り互換のみ）。
**呼び出し側も一本です**：`app.js` の `expeditionBattleOptions()` が盤面の外の入力
（`composed` / `hp` / `equipmentDurability` / `limitsFor`）を組み、戦闘予測
（`previewNextBattle`）と本番（`simulateExpeditionBattle`）がその戻り値をそのまま渡します。
本番が足すのは結果を変えない `simulationOptions: { captureReplaySnapshots: true }` だけで、
`app.js` の試映も同じ `simulateExpeditionBattle` と snapshot 収集を使います。ただし
`previewOnly` の境界より内側では `RunState.results`、ledger、技能点、図鑑、
`commitBattleResult`、戦闘ログを更新しません。試映の結果は `simulationMode` により必ず専用結果へ
入り、通常の報酬生成・進行経路を通らずキャンプへ戻ります。
取得予約は武器技能の `skillReservations` に保存します。武器画面は
`skillReservationFor` / `reserveRunSkill` / `cancelRunSkillReservation` を通じて一人物一目標の予約、
予約取消、技能点獲得後の自動解禁を操作します。
`analysis/ecology-screens-smoke.mjs` は武器別ツリーの入口、解禁操作、予測 cache の鍵を見張ります。
技能定義にレベル係数や技能レベル欄はありません。表示値は各武器定義の固定値をそのまま出し、
`analysis/ecology-weapon-loadout-smoke.mjs` と `ecology/weapon-system.test.mjs` が初期構成・前提・
取得経路を見張ります。

武器技能の強さは固定値・共有event・武器の到達位置で調整します。技能レベル係数、Lv上限、
前提Lvの閉包は現行実装にありません。`analysis/ecology-enemy-tactics-smoke.mjs` は敵AIの
庇護・治療・弱体・多段を実戦eventで確認し、`analysis/ecology-weapon-loadout-smoke.mjs` は
プレイヤー初期構成と敵技能との集合分離を確認します。

遠征終了で消えるもの: run 技能点と run 中に解禁した技能、装備の実物（選んだものだけ
Blueprint として残る）、補給・scrap・治療 charge・現在 HP、encounter 順と報酬 offer。

### 報酬と戦闘後の行き先（PR #255）

装備の候補を出す戦闘は `progression.offersRewardAfterClear(index)` の一箇所が決めます。
`REWARD_ENCOUNTER_KINDS`（いまは `["boss"]`）に含まれる種別の戦闘＝4・8・12戦目だけが
候補を出し、候補は装備 `REWARD_EQUIPMENT_SLOTS`（2）件で、**補給は候補に入りません**。
`app.js` の `resultScreenDue()` はこの判定と「敗北」「最終戦」「プロローグ」を見て、
結果画面を出すかどうかを決めます。出さない勝利は `advanceAfterBattle()` が直接キャンプへ
戻します。直前戦だけを全タブへ重ねるカードは置かず、遠征タブの12戦盤で踏破した節を選ぶと、
`run.results` からラウンド数と味方HP損失を読んだ4指標が出ます。未踏破の節も同じ位置へ
技能点・戦闘後HPと未知の「？」を出すので、未来と実績を同じ物差しで比べられます。
装備を選ぶ結果画面にも人物・装備一覧は戻さず、候補の下に同じ4指標だけを置きます。
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

技能の前提は `{ skillId }` で、判定は `content/weapon-trees.mjs` の武器節情報を、解禁 API
（`progression.unlockRunSkill`）・画面・加入時の初期構成が共有します。初期構成は代表武器2本の
`R` / `A1`、各人物4技能で固定し、前提の無償閉包だけを適用します。
`newRun` は `startingSupplies(profile, rank)` で補給を決め、同じ値を `RunState.suppliesMax`（その遠征の総数・表記の分母）へも入れます。基礎は `STARTING_SUPPLIES_BASE`（3）で、永続強化「開始補給」の段ぶん（最大 +2、天井は `MAX_SUPPLIES` = 5）が加わります。導入用の特例は持ちません（Stage 0 だけ1個という例外があると「3/3」が最初の遠征で嘘になるため）。`gainSupply` と `convertScrap` は `runSuppliesMax(run)` を上限にするので、**遠征中に総数を超えて増えません**——屑から戻せるのは使った分だけです。欄の無い古い保存は `runSuppliesMax` が基礎値として読み直します。New Game が作る `runId` を `tutorialRunId` として画面状態に保持し、その導入遠征だけを必須チュートリアルの対象にします（旧 `supplyTutorialRunId` は `hydrateState` が読み替えます）。通常遠征・再訪・既存セーブはこの marker を持たないため、補給タブを任意に使えます。導入遠征の Stage 0 では、**補給チュートリアルを終えるまで補給が一つも減りません**（`suppliesSealed()`）。錠の条件は手引きの出現（`ordinaryBattleWon()`）と同じ Stage を読みます——Stage を選び直した遠征は `runId` を持ち回すので導入の marker を持ったまま Stage 1 以降を走ることがあり、そこで錠を掛けると手引きが出ないまま永久に開きません。補給タブは `campNav()` で `disabled`、`campActiveTab()` は保存が指していても補給の画面を返さず、`tab` と `treat` の handler も同じ判定で弾きます（画面と経路の両方に錠を掛けます）。報酬の引き直しも同じ判定で閉じ、再挑戦だけは `spendSupply` を通さず無料でやり直せます（敗北画面が `SEALED_SUPPLY_NOTE` で理由を出します）。手引きそのものの一手（`supplyTutorialVisible()`）と、完了印 `SUPPLY_TUTORIAL_FLAG` が付いたあとは錠が外れます。手取りの置き場所は `SKILL_LESSON_ENCOUNTER_INDEX`（第1戦の直後＝技能）と `SUPPLY_TUTORIAL_ENCOUNTER_INDEX`（その次の一戦の直後＝補給）の二つだけが決め、`ordinaryBattleWon(n)` が両方の判定を共有します。本編第2戦に勝つと補給チュートリアルに入り、`supplyTutorialStep()` が `tab` / `treatment` / `target` の段を保持します（一手目で補給タブを自分で押させ、その札が「補給とは何か」を説明します。`supplyTutorialTabLocked()` は `tab` の段だけ閉じ込めません）。`supplyTutorialSpotSelector()` が「集中治療」のボタンまたは負傷者の盤面セルを選び、隊列・技能・補給・必殺技は共通の `tutorialGate()` → `applyTutorialGate()` → `tutorialAllows()` を使います。これにより光る先・画面上の錠・handler の制限が同じ選択子から出ます。単体治療は `treatmentTargetIds()` が返す候補から `select-treatment-target` を受けるまで補給を消費せず、確定後だけ既存の `progression.mjs` の `campTreat` へ明示した target ID を渡します。対象を選ぶ画面は補給タブ専用の一覧ではなく、上端の共通盤面（`partyCellRole` の `supplies` mode）です。結果は `treatmentResult` と `role=status` で表示し、完了印は `ProfileState.storyFlags` に保存します。`supplyTutorialVisible()` 中は nav の他タブ、`begin-stage`、撤退経路を UI と handler の両方で閉じます。

序盤の巻き戻しでは、`app.js` が `PROLOGUE.formation` を `RunState.formation` に戻してから camp へ進めます。初期配置を `defaultFormation` に戻さないため、変更なしの再戦は敗北として予測されます。巻き戻し直後の camp は隊列チュートリアル（DESIGN.md 6.4.4）に入り、`formationTutorialStep()` が `open` / `pick` / `place` / `done` の段を返します。教える一手は content 側の `PROLOGUE.tutorial`（`characterId` / `row`）が持ち、`formationTutorialSpotSelector()` が段ごとの選択子を一箇所で作ります。`render()` の後段の `applyTutorialGate()` が、その選択子に当たる要素へ `tutorial-spot`（光）を付け、`done` 以外の段では他の `[data-action]` を `tutorial-blocked` と `disabled` で塞ぎます。`handleAction` も同じ選択子で弾くので、押せる形と経路の両方が同じ判定を読みます。`campTutorialTab()` が補給チュートリアルと同じ形でタブを一枚へ閉じ込め、目標の行へ入った瞬間に錠が外れて `formationMode` も false へ戻ります（`place-character` の handler が段の前後を比べて畳みます）。`prologueEncounter()` は12戦用の敵定義を流用しますが、`PROLOGUE.enemyScaling` のHP66%・前衛の攻撃75%を適用し、後列の marksman は個別に36.5%へ落とします（`might` / `focus`）。射出器Rの最寄り対象選択に合わせた導入戦専用の調整で、通常戦の難易度や敵定義は変えません。
巻き戻し直後の情報分離を含む会話本文は `content/dialogue.mjs` が正本で、`story.mjs` は断片の順序と表示条件だけを持ちます。
本編第1戦に勝つと技能チュートリアル（DESIGN.md 6.4.6）に入ります。キャンプが戻る先は通常どおり遠征タブで、`skillLessonStep()` が `tab` / `pick` / `open` / `aim` / `unlock` / `handoff` / `done` の段を返します。教える武器と入口節は content の `SKILL_LESSON.tutorial`（`characterId` / `weaponId` / `unlockSkillId`）が持ち、受け渡す相手は同行者から引きます（`skillLessonHandoffId()`）。`skillLessonSpotSelector()` はタブ、上端の盤面セル（`select-character`）、武器タブ（`select-weapon-tree`）、入口節（`select-weapon-skill-node`）、武器節の `unlock-weapon-skill` を一箇所で綴ります。`done` は選択子を持たない段で、**光らせる先を置きません**。

錠の掛かる範囲は二つに分かれます。`skillLessonLocked()` は `done` 以外、`skillLessonTabLocked()` は `tab` と `done` 以外（一手目がタブを押すことなので、そこで閉じ込めると打てません）。武器タブを開いたあと入口節を選び、`unlock-weapon-skill` を押すと解禁し、最後にもう一人へ渡します。受け渡しが済んだ印は画面状態の `skillLessonHandedOff` で、以後は誰を選び直しても段が戻りません（画面の状態から導くと、教えた相手を選び直した拍に錠が復活します）。完了印 `skill_lesson_seen` は **次の一戦へ出るとき**（`begin-stage`）に押します。

四つの手引きの札は `tutorialNoteCard()` が一枚だけ組み、`renderCamp()` が `.camp-view` の頭へ出します。錠が掛かっている段では札に `pinned` が付き、固定帯（`--camp-top-h`）の真下へ貼りつきます。`publishCampTopHeight()` が札の高さを `--tutorial-note-h` へ入れます（技能点の帯は 2026-09-17 に貼るのをやめ、ツリーの操作の行へ移したので、その下に貼るものはいまのところ手引きの札だけです）。`focusTutorialSpot()` は段が変わった回だけ、光らせる先が窓の外なら技能ツリーの帯とページを寄せます（`focusSelectedSkillNode()` と同じ作法で、見えているときは動かしません）。貼りついた札の重なりの段は `z-index: 4` で、キャンプの固定帯（`.camp-top`、3）・技能の操作盤（`.skill-sheet`、2）より手前に出ます。**札が隠れると、いま押す場所を言う唯一の文が読めなくなる**ためです（札は固定帯の下へ `--camp-top-h` のぶんだけずらして貼るので、固定帯とは重なりません）。

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
- 味方 actor の active skill は `BattleInput.activeSkillId` の一つだけです。legacy fixture / 敵定義の
  `tactics` は段階移行中の互換入口として残しますが、playable loadout は巡回カーソルを使いません。
- 同じ actor の reactive skill は loadout の上から順に再評価し、条件・コスト・RP温存量を満たして
  **最初に発動した一つ**でその trigger window を閉じます。actor をまたぐ順序と、signature / passive /
  equipment / status は従来どおり priority・initiative・position・ID の tie-break を使います。
- `targetSkillIds` は順序付きです。engine は active の合法候補集合を先に作り、各 target skill の
  `targetQuery` がその集合から一体を選べたときだけ採用します。したがって target skill は active の
  scope・filter・reach・take を拡張できません。

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

### R25の射程と一時移動

新武器カタログの`deal_damage.rangeClass`は`melee / long / ranged / support`の四値です。
`effects.mjs`の`reachOfEffect()`が対象合法性へ写し、`afterPositionModifier()`が同じ値から
最終量を計算します。`melee`は攻撃者が前列なら125%、後列なら40%。`long / ranged`は攻撃者の
行に依存せず、対象が後列かつ対象側に生存前列がいれば75%です。`support`は補正しません。
`reach`と`rangeClass`の併記はvalidator errorです。未移行contentは`rangeClass`を持たず、従来の
`reach`と腕力後列減衰を通るため、武器単位で移行できます。

`move_to_open_row`は同じ側の空きマスだけを、現在列からの距離、固定マス順の順で選びます。
`returnAfterAction: true`ならpending actionへ出発点を積み、技能効果とそこから生じた反応をすべて
解決した後、出発点が空いていて本人が移動先に残っている場合だけ帰還します。往路・復路とも
通常の`actor_moved`を発行し、初期配置は発行しません。これにより一時前進はその行動の近接補正を
得ながら敵フェーズ前に戻れ、毎AP起動で再評価されます。

前進passiveは`action_declared`のinterruptで動きます。engineは宣言eventへ`actionReach()`で解決した
`melee / ranged / long / support` tagを加え、passiveはactive IDでなくこの共有tagを読みます。
`after`ではaction chain終了まで発火が遅れるため、攻撃前移動には使いません。帰還予定を積んだ後で
対象消滅や割り込み中止が起きても、`performAction()`の`finally`が帰還を試みます。

### R25の武器横断ルール

`content/weapon-warhammer.mjs`、`content/weapon-dual-blades.mjs`、
`content/weapon-gauntlets.mjs`、`content/weapon-launcher.mjs`、
`content/weapon-tower-shield.mjs`、`content/weapon-long-spear.mjs`、
`content/weapon-medical-kit.mjs`、`content/weapon-grappling-hook.mjs`、
`content/weapon-banner.mjs`、`content/weapon-heavy-crossbow.mjs`を19節縦スライスとし、
`content/weapon-root-slices.mjs`は旧呼び出し元のための互換barrelとして残す。定義は
`weaponId`と`treePosition`を
表示・取得用に持ちます。戦闘条件は武器IDを読まず、hit番号、攻撃tag、防壁・受け構え、状態の極性、
eventの主対象と同じ列、という共有事実だけを読みます。activeだけが`rangeClass: melee`と基礎係数を
所有します。これにより非アクティブ技能を別武器へ組み合わせてもengineの固有分岐は増えません。

一技能が複数の独立した反応点を持つ場合は`rule`または`rules`を受け付けます。通常は同じruleを
一chain一回に制限し、各hitや複数の状態除去を本当に読む規則だけが`allowRepeatInChain: true`と
有限のchain上限を宣言します。event単位の発火記録も併用するため、同じ出来事への自己再発火はできません。
上位passiveの`replacesPassiveSkillIds`は取得済みの下位版だけを実行時に抑止します。

追加した汎用語彙は、極性指定の`remove_statuses`、防壁／受け構えを除く`remove_barrier` /
`remove_block`、`has_defense`・`has_defense_or_status`・同列／主対象外のtarget filter、状態由来の
防御補正、除去種類数を係数へ変える`stat_times_context_scaled`、多段hit数を状態段数から有限に
決める`hitCountFromStatus`、固定順へ分配する`hitDistribution: round_robin`、戦闘ごとの有限使用を
示す`usesPerBattle`、単体対象を優先する状態tag、列／未行動target filter、対象の
redirectを引き継ぐevent tag、対象のAP/RPを減らす`reduce_resource`です。schemaは
`ecology-content-9`、result schemaは`ecology-result-4`、content contractは39、content versionは0.28です。

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
選択対象→確定操作の順を維持し、敵情報は選択中の一体に絞り、技能ツリー・装備一覧は折り畳みで長さを制御する。

ギルドとキャンプの敵情報は `encounterArchive()` を共有します。12個の節はいずれも
`composeEncounter(index, difficulty, encounterOptions())` を読み、選択中の一戦だけを
`expeditionEnemyBoard()` で3×2盤へ展開します。敵詳細は同じ composed enemy の確定 stat と
`PLAYABLE_CONTENT.enemyActors` の AP / RP・tactics・reactive / passive skill ID を合わせ、
技能名は `componentLabel()`（敵側の `enemy_heavy` / `front_strike` は `COMPONENTS` に居ないため、
`componentInfo()` だけでは内部 ID が出る）、効果は `componentInfo()`、狙い方は tactics から
導出済みの `enemyInfo()` を読みます。
画面用に敵能力・技能・狙いを複製しません。`inspectedEncounterIndex` と `selectedEnemyId` は
ギルド／キャンプ間とタブ往復中だけ保つ UI state で、RunState と保存データには入りません。

12戦盤そのものは上端の盤面と同じ `.forecaster-window`（下地・角の括弧・走査線・`.forecast-head`）
を着ます。**同じ先見機の像なので、窓の作りを二つ持たない**——見出しは `encounterConsole()` が
`.forecast-head` の並びで出し、左に照準レンズ（record は踏破の印）と「第N戦 · 名前」、
右に「NN/12」を置きます。投影の面（`.encounter-projection`）は枠も下地も持たず、
4指標（`encounterReport()`）と敵盤面だけを載せます。戦闘の銘（幕・種別・危険度・最大ラウンド）、
区画の説明文、ボス法則の解説文は持ちません。

キャンプでは、選んだ index が `run.encounterIndex` より前なら `record`、現在地以降なら
`forecast` として描き分けます。走査線・信号アニメーション・青緑の読み値は forecast だけに付き、
record は走査を止めた緑の窓です。各戦の技能点と戦闘後HPは進行規則から、踏破済みのラウンド数と
味方HP損失は保存済みの `run.results` から `encounterReport()` が読みます。未知の実績だけを
「？」にするため、画面専用の戦歴 state は持ちません。敵盤面は常時表示し、閉じない
`enemy-details` に置きます。

踏破済みの節の敵盤面は、**そのとき実際に戦った盤面**です。灰の門（`prologueEncounter`）と
必殺技の一戦（`ultimateLessonEncounter`）は 12戦の席に座る手書きの盤面で、
`composeEncounter` からは出てこないので、戦った時点で `run.results` の項へ
`script`（`"prologue"` / `"ultimate_lesson"`）を残し、`encounterForInspection()` が
`SCRIPTED_ENCOUNTER_BUILDERS` からその盤面を組み直します。**save に残すのは印の一語**で、
敵の表そのものは置きません。印の無い項は従来どおり `composeEncounter` で組みますが、
導入の遠征（New Game の Stage 0）の第1戦は必ず灰の門です（New Game は profile ごと
作り直すので、灰の門を飛ばす経路がありません）。
技能ツリーは武器別の地図／一覧へ一本化する。横送りの武器タブ（`.weapon-tree-tabs`）で武器を選び、
`.weapon-skill-map` は内部位置名から固定した7列の座標と `requires` の線で派生を示す。内部位置名そのものは
表示せず、丸の中の A / R / T / P で役割を示す。節の条件・AP/RP/HPコストは左、仕切りを挟んで対象・倍率・hitなど
効果バッジを右へ置き、未知の event / status ID は画面用の語へ置き換える。取得可能ならカード右上は解禁、不足時は
前提込みの必要点を添えた予約ボタンにする。
`.weapon-skill-list` は同じ `requires` を深さ優先へ並べ、`.weapon-list-guide` の縦線と肘を親・子の行の中心まで
伸ばして接続を保つ。長い節名はカード内で最大2行に折り返す。上位形態やアクティブ置換は効果と取得経路で分かるため、
節カードへ▲印を足さない。各節は
`select-weapon-skill-node` で選ぶが、詳細と操作は節を伸ばさず、地図／一覧の外にある
`.weapon-skill-sheet` だけを差し替える。操作盤の見出しに役割記号と取得操作を置き、区切り線の下は効果全文だけを出す。
節選択は `refreshWeaponSkillSelection()` でカードの選択状態・接続線・操作盤だけを更新し、地図 DOM と
`.weapon-tree-scroll` の横位置を保つ。選択節が表示窓外なら、`focusWeaponSkillTree()` が横帯とページを寄せる。
`select-weapon-skill-view` は見方だけを変え、取得状態には触れない。
`unlock-weapon-skill` が1SPを払い、取得後は役割ごとの loadout へ登録する。前提または技能点が足りない節は
`reserve-weapon-skill` で一人物一つまで予約でき、技能点獲得後に前提から自動解禁する。武器技能画面に
旧共通ツリー・技能レベル・旧pack切替は出さない。
`weaponSkillMemory` は人物IDごとに最後の `weaponId`・`skillId`・viewを持ち、人物選択時に復元する。
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
| `emphasize(value)` | content の `**強調**` を太字にする | 区画の学び |
| `characterPanel(id, opts)` | **人物の札**（顔・名前・AP/RP・HP・能力3軸＋画面ごとの読み値） | 連れていく隊・技能・装備 |
| `characterFaceChip(id)` | 一行しか無い場所で人物を指す小さな顔 | 技能ツリーの帯・結果・順番の帯 |
| `statAxesHtml(id, opts)` | 能力の並び（軸名は小、数は大。鍛えた軸に ＋） | 人物の札・仲間カード |
| `expeditionPartyCard(sequence)` | 連れていく隊（人物の札＋投資への飛び先） | 遠征の準備 |
| `guildMemberStrip(id, label)` | ギルドで「いま見ている一人」を選ぶ帯 | 鍛錬・名簿 |
| `.tab-note` | 節の一行注記（規則の段を置くほどではないもの） | 根城・名簿・図鑑 |

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

### 技能の取得と戦闘ロードアウト（武器技能移行）

RunState の loadout は、取得済み一覧と戦闘時の選択を次の欄へ分けます。

| 欄 | 意味 |
|---|---|
| `tactics[c]` | 移行中の取得済み active 一覧 |
| `actives[c]` | 戦闘へ出す active 一つ |
| `reactives[c]` | 上から調べる reactive 一覧 |
| `reactiveReserves[c][skillId]` | その reactive 発動後に残すRP |
| `targets[c]` | 上から調べる target 一覧 |
| `passives[c]` | 取得済み全件。すべて有効 |

`normalizeLoadout()` が旧保存の `tactics[c][0]` から `actives[c]` を決定的に補い、欠けている
`targets` / `reactiveReserves` を空で補います。未知技能や不正な温存値は BattleInput へ入れません。
app は保存復元時に旧 `disabled` を除去します。以後は active の選択、reactive / target の順番、
reactive のRP温存だけを編集し、passive は `allyInput()` が全件を BattleInput へ渡します。

`allyInput()` は `activeSkillId`、`activeOverrideSkillId`、`targetSkillIds`、`reactiveSkillIds`、
`reactiveReserveBySkill`、`passiveSkillIds` を一箇所で組みます。必殺アクティブは元技能との
二本装着ではなく、発動条件を満たした時だけ選択中アクティブを上書きする候補として渡します。

`analysis/ecology-screens-smoke.mjs` が片側検査で「装着する釦・`equip-skill` handler・
`.skill-node.unlocked` が戻っていないこと」と、4ロール欄・active 選択・RP温存の経路を見ます。
`analysis/ecology-weapon-loadout-smoke.mjs` は、初期4技能が各人物の代表武器2本の `R` / `A1` から
導出され、取得後に4ロールへ反映されることを踏む。

武器別の取得registryは`content/weapon-trees.mjs`です。各nodeは`weaponId / position / kind /
skillId / cost / requires`を持ち、前提は取得済みIDだけを要求します。`unlockRunSkill()`は武器nodeを
SP台帳で受けます。可用性は武器nodeが`manifest.enabledWeaponIds`を読み、現行manifestの
`enabledSkillPackIds` と同じ武器集合を使います。
`WEAPONS`には設計済みの10武器を載せ、Campaignは加入済み人物の署名武器・副武器を累積して開示します。
したがってStage 0はゴウ／ツグミの4武器、Stage 1でナギの2武器、Stage 2でヒバナの2武器、
Stage 3でゲンゾウの2武器が加わります。10武器すべてがmanifestとR〜BBの19節へ接続済みで、
`IMPLEMENTED_WEAPON_IDS`も10件です。大盾は`taunted`／`tower_shield_guard_stance`／`tower_shield_mirror`、
長槍は`long_spear_delayed`／`long_spear_pinned`／`long_spear_order_mark_status`を状態境界に使う。
格闘具は`gauntlets_momentum`／`gauntlets_form`、射出器は
`launcher_observed`／`launcher_order_mark`を状態境界に使い、対象継続は共有target filter
`previous_target`で表します。医療具は直接回復ではなく防壁を張り、反応の蘇生・再生へ接続する。
鉤縄は`actor_moved`と`grappling_hook_mark`、号旗はAP支援・`banner_debt`・`banner_time_sand`、
重弩は準備・`heavy_crossbow_ammo`・対象印と列攻撃を状態境界に使う。
新規runは10武器をskill packとしてmanifestへ載せ、Stage manifestは加入人物の2武器ずつを累積します。
manifest versionは4、content contractは40、content versionは0.30です。

武器技能は旧`*_META`を複製しません。`componentInfo()`が`PLAYABLE_CONTENT`の`displayName /
displayEffect / flavorText`から4ロール用metadataを組み、取得後は`installUnlockedSkills()`が既存の
loadoutへ登録します。`replacesActiveSkillId`が選択中なら選択も上位へ移し、
`replacesPassiveSkillIds`は下位を常時欄から外します。取得履歴は`runUnlockedSkills`へ残るため、
前提判定と表示上の置換を混同しません。

### キャンプのタブ（issue #235）

キャンプのタブは スキル・装備・補給・遠征 の4枚で、`campNav()` が出す。準備の3枚は何度も
往復する画面、遠征タブは「次の一戦へ進む」と遠征そのものをどうするか（`abandon-run`・
`open-save-menu`）を決める画面で、役が違う。`renderCamp()` は盤面とタブだけを上端へ固定し、
操作は固定帯の外に置く。

共通の `shell(body)` は本文を包むだけで、上部へタイトル・撤退・戻るのボタンを自動追加しない。
ギルド画面は五枚の札を `guildTop()` が上端へ貼りつけます（`.guild-top`。キャンプの
`.camp-top` と同じ作りで、活動資金と札を一つの塊にする）。**並びは人がたどる順**
（`GUILD_TABS`）で、根城・図鑑（読み物）と投資・設計図・遠征（毎回通る仕度）を
`group-start` の縦線で分けます。ギルドを開く札は `defaultGuildTab()` が決めます
——一度でも区画を越えていれば先頭の根城、まだなら出発の遠征です。
遠征の札は出発の一枚（行き先・同行者・12戦の形・釦）が頭で、行き先の選び直しは
その下です。**全12戦の投影はキャンプの遠征タブだけが持ちます。****活動資金は画面に一度だけ**
出し、開いた先の見出しで言い直しません。札の中身は `.guild-view` にまとまり、
立ち上がり（`fx-view-enter` と `guild-card-enter` の段）が掛かるのはここだけです。
札の数はどれも「その中にいくつあるか」で揃えます（`guildTabItems()`）。ギルドの仲間の
選択は `state.guildCharacter` **一つだけ**で、鍛錬と名簿が同じ一人を指します。

ギルド画面の「タイトルへ」は各タブ内容の末尾（`guild-actions`）、セーブ画面の戻る操作は
カード内（`save-menu-footer`）にある。戦闘・結果・精算などの画面も、操作をそれぞれの
カード内に持つため、共通の上部ボタンでキャンプの主導線を覆わない。

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
ブラウザでの実挙動は、公開先のCloudflare Pages previewで確認する対象として残す。手元では
`analysis/ecology-screens-smoke.mjs` と `analysis/ecology-weapon-loadout-smoke.mjs` が、
隊列・武器技能・装備・治療の入口を静的に確認する。

ギルドの「連れていく隊」と、技能・装備タブの人物帯は、同じ顔を `characterPanel()` から出す
（2026-09-16）。札は `characterFaceWatermark(id, "panel-character-face")` ＋ 名前 ＋ AP/RP ＋
HPバー（予測セルと同じ `.forecast-hp-bar`）＋ 能力3軸で、画面ごとに違うのは `extras`
（技能＝技能点と装着本数、装備＝枠・耐久・常時補正）と `action`（鍛えるへの飛び先）だけである。
**職種アイコンと役どころと紹介文はどの画面からも出さない。**札の形は一つで、顔は背に敷かず
左の縦長の枠（126px）に立て、読み値はその右に置く——背に敷くと読み値の帯（約95px）が顔の窓を
潰し、目元が名前の行と重なるためである（DESIGN 5.2.1）。人物別の顔補正は札では掛けず、
上書きは `[data-character]` を付けて詳細度を合わせること。
行の高さしか無い場所（技能ツリーの貼りつく帯・結果画面・順番の帯）は
`characterFaceChip()` の小さな顔で指す。人物別の余白補正は `.character-face-watermark` と
`.character-face-chip` が同じ値を共有する。

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

  - **撃破の拍は攻撃の絵を繰り返さない** … `actor_defeated` は着弾とは別の拍なので、
    そこでは `is-downed` だけを出す。`is-hit` も型の class も印も付けない（付けると、
    一度の攻撃が二度当たったように見える。作者指摘 2026-09-14）。
  - **重さの三段** … `hitLevel(amount, maxHp)` が最大HPに対する割合で 1／2／3 を返す
    （15% 以上で 2、30% 以上で 3、撃破はその拍の 3）。段は `unit` の揺れ（`hit-2` /
    `hit-3`）・浮く数字の大きさ（`.float.damage.heavy` / `.crush`）・盤面の揺れ
    （`.battle-field.shake-1〜3`）の三箇所へ**同じ値**で効く。
  - **踏み込む向き** … `lungeShiftPx()` が狙った相手との**列差**（`BATTLE_COLUMNS` の
    index 差）を ±9px の `--lunge-x` にする。前後（味方は上・敵は下）は side の CSS が持つ。
  - **踏み込んだ先の線** … `spawnStrikeLine()` が攻撃側と被弾側の矩形中心を結ぶ
    `.strike-line` を一本置く。長さと角度は二つの箱の位置だけから出る。
  - **攻撃の型（腕力＝斬撃／技術＝銃撃）** … `ecology/attack-style.mjs` が、着弾イベントの
    `tags`（`weapon` / `technique`）を正本に、無ければ出どころの定義（`skillId` →
    `ruleId` → `sourceDefinitionId`）の `deal_damage` が伸びる能力値で補って型を決める。
    表（`buildAttackStyleIndex`）は content から一度だけ組む。`syncBattleView` は
    撃つ側へ `strike-weapon` / `strike-technique`、受ける側へ `hit-weapon` /
    `hit-technique`、線へ `weapon` / `technique` を付けるだけで、絵は styles.css が持つ。
    腕力は踏み込み＋斬線、技術は反動＋銃口の閃光＋走る弾道になる。
    型を持たないダメージ（裂傷・装備の破片）には class が付かず、既定の絵のまま出る。
  - **線の飛び方は型で変えない** … 攻撃側から被弾側へ線が一本飛ぶ動きは、どちらの型でも
    同じ `strike-line` の keyframe である。銃撃だけ光を一粒ずつ走らせる弾道も試したが、
    同じ距離が遅く見えて速さが消えた（作者指摘 2026-09-14）。銃撃の線は**太さと色だけ**
    細く白くし、型の差は着弾の印と銃口の閃光（`.muzzle-flash`）が持つ。
  - **着弾の印** … `spawnImpactMark()` が `.battle-floats`（盤面の層）へ、被弾した箱より
    ひと回り大きい `.impact-mark` を一つ置く（多段でも拍あたり一つ）。**型の差を箱の中
    （`.unit-fx`）だけで描くと、100×72 の枠と丸角に切られて実機では読めない。**
    分けているのは光り方ではなく形で、斬撃は**上から下へ引かれる二本の太刀**（`::before`
    が一の太刀、`::after` が二の太刀。`slash-draw` が `.strike-line` と同じ clip-path の
    作りで引き、同じ向きへ消す）、銃撃は芯から棘が伸びる星になる。銃口の閃光（`.muzzle-flash`）も線とは別の札にする——線は `clip-path`
    で削られながら走るので、同じ札に乗せると閃光まで切り落とされる。
  - **浮く数字** … `.battle-floats`（盤面の層）へ座標で刺す。`unit` の中に置くと、味方の箱
    （立ち絵のため `overflow: hidden`）で消え、敵では一つ上の箱の中に出て持ち主が読めない。
  - **幕の帯** … `battleBannerFor(beat)` が拍の種類だけから言葉を決める（opening／round／
    ending）。カットインと同じく `dataset.beat` で同じ拍へ二度書き込まないので、再描画でも
    演出が巻き戻らない。読み上げは `.beat-text`（aria-live）が持ち、帯は `aria-hidden`。
    決着（ending）の帯だけは `hold` を返し、`banner-*-hold` の keyframe で開いたまま止まる
    （再生がその拍で終わるため）。出ているあいだは `.battle-field.verdict-hold` が拍の行の
    見た目だけを譲らせる。

`prefers-reduced-motion` では動きだけを止める。帯・カットイン・照準・数字・着弾の印は
**出したまま**なので、止めても何が起きたかは読める。

線と印そのものは `ecology/battle-fx.mjs` にある。**engine も state も入らない**
（入力は「どの箱から」「どの箱へ」「どちらの型で」の三つだけ）ので、`ecology/fx-test.html`
（演出の見本）が一戦も進めずに、本番と同じ関数・同じ CSS で同じ絵を出せる。端末側の
切り分け場でもあり、`prefers-reduced-motion` の入切と build の印をその画面の先頭に出す。

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

手取りの錠は隊列・技能・補給チュートリアルと同じ形を共有する。`tutorialGate()` が「いま掛かっている
段・錠・光らせる先」を一つ返し、`applyTutorialGate()` が描画のあとに光と錠を掛け、
`tutorialAllows(element)` が経路側でも同じ選択子で塞ぐ。**光らせる先と押せる先が同じ表**
から出るので、「光るのに押せない」が構造として起きない。
