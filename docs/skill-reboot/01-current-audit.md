# 現行技能システム監査（`KKawamura1/garakuta-lab` `main`）

監査時点: 2026-09-07

対象は GitHub callable tool で取得した `KKawamura1/garakuta-lab` の `main` である。Git clone、実装変更、GitHub への書込みはしていない。件数は取得したモジュールを一時的な Node 実行環境に配置して import し、`SKILL_TREE_NODES`、`skillIdsForPacks`、`initialUnlockedSkills` の定義から再計算した。したがって、issue 本文や古いコメントに残る件数は、現行ソースの数値と分けて扱う。

## 1. 先に結論

| 観点 | 現行値 | 根拠 |
|---|---:|---|
| プレイヤー向け技能ツリー | 118節 | `ecology/content/skill-tree.mjs` |
| ツリー内訳 | active 58 / reactive 43 / passive 17 | 同上 |
| 実行時技能定義 | active 66 / reactive 43 / passive 17 | `ecology/content/skills-active.mjs`, `skills-reactive.mjs`, `skills-passive.mjs` |
| ツリー外の実行時 active | 8節 | `playable-battles.mjs` の内蔵/fixture/enemy 用技能（`front_strike` 等） |
| 初期ランの技能点 | 0 | `ecology/progression.mjs` (`STARTING_RUN_SKILL_POINTS`) |
| 通常の勝利1回あたり | 現行実装は現ロスター全員に +1 | `ecology/app.js` (`simulateAndEnterBattle`)、`progression.mjs` |
| Campaign の段階 | Stage 0–3、累積 pack 1→4 | `ecology/content/campaign-stages.mjs` |
| Stage 3 時点の使用可能節数 | active 43 / reactive 29 / passive 13 = 85 | `campaign-stages.mjs`, `packs.mjs` の `skillIdsForPacks` |
| Stage 3 で未到達 | 118 - 85 = 33 | 上記の現行ツリー/manifest 計算 |
| ツリー最大列 | active x10 / reactive x9 / passive x3 | `skill-tree.mjs`, `skill-tree-layout.mjs` |
| Campaign の到達列 | active x10 / reactive x8 | `analysis/ecology-skill-tree-smoke.mjs` の意図的な Stage 3 判定 |

現行は、技能数の規模に対して「ラン内技能点を解放とレベルアップで共用し、初期0・勝利+1」となっている。さらにキャラクター加入時は、スターター技能とその前提閉包を無償で `runUnlockedSkills` に追加する。この二つを分けずに再設計すると、表示上のコスト、実際の加入時解放、装備技能、Stage解禁の意味が混線する。

また、`ecology/run.mjs` は `main` に存在しない。ラン生成・技能点付与は `ecology/progression.mjs` と `ecology/app.js` に分散しており、戦闘コンテンツも現行遠征12戦の `ecology/content/expedition.mjs` と旧互換7戦の `ecology/content/encounters.mjs` が併存する。再設計時に正本と移行方針を明示する必要がある。

## 2. 技能ツリーの現状

### 2.1 数え方とレベル

`ecology/content/skill-tree.mjs` の `SKILL_TREE_NODES` を `kind` で集計すると、active 58、reactive 43、passive 17、合計118である。`ecology/content/skills-active.mjs` の実行時定義は66で、差分8はプレイヤー向けツリーではない内蔵・fixture・敵向けの基本攻撃等である。

`ecology/content/skill-levels.mjs` の現行レベル規則は次のとおり。

| 項目 | 現行値 |
|---|---|
| 初回取得 | Lv1 |
| 最大Lv | 通常はLv10。ただし量を持たない定義はLv1上限 |
| Lvアップ費用 | ラン技能点1（`SKILL_LEVEL_COST`） |
| 効果倍率 | `SKILL_LEVEL_STEP_BPS=1200`、Lvごと+12%。Lv10は2.08倍 |
| 倍率対象 | damage / heal / barrier / pending amount の量 |
| 倍率対象外 | AP、RP、ヒット数、対象数、回数上限、耐久、チャージ、ブロック等 |
| 返金 | なし |

レベル上限はIDのハードコードではなく、技能定義を再帰走査して量を持つ effect の有無から導出される（`skill-levels.mjs`）。Reactive の source definition も技能IDとして解決されるため、リアクティブ技能の量にも同じレベル計算がかかる。AP/RPや発火回数などのルール構造をレベルだけで増やさない、という現行制約は維持対象である。

### 2.2 前提・分岐・終端

`skill-tree.mjs` は全て同じ `kind` 内の単一前提を持ち、複数前提の合流も、kindをまたぐ前提もない。`skill-tree-layout.mjs` は `requires` から列を生成するため、現行の基本形は一本の親から枝分かれする木である。

| kind | x 列の節数 | root | 全体の終端列 |
|---|---|---|---:|
| active | x1:4, x2:11, x3:8, x4:8, x5:14, x6:3, x7:2, x8:3, x9:2, x10:3 | `strike`, `bulwark`, `barrage_strike`, `mark_strike` | x10 |
| reactive | x1:1, x2:4, x3:8, x4:5, x5:9, x6:5, x7:5, x8:4, x9:2 | `mend` | x9 |
| passive | x1:6, x2:5, x3:6 | `foundation_vitality`, `foundation_might`, `foundation_focus`, `foundation_guard`, `foundation_ap`, `foundation_rp` | x3 |

active の主な経路は、`strike` から `steady_cut→pierce_thrust`、`rear_hunt→rapid_cuts→spread_cut→crack_mark→rend→double_back`、`heavy_swing→long_swing`、`finishing_thrust→hamstring→execute_low`、および `aimed_shot→shield_the_wounded→field_dressing` / `ward_ally→sustaining_ward` に分岐する。`bulwark` からは `spread_the_guard→brace_for_impact→bulwark_of_will` と `reposition→rally_line→relay_order→mark_target→steady_aim` が伸びる。別rootとして `barrage_strike` と `mark_strike` の短い枝がある。x10終端は `reckless_swing`、`bloodied_charge`、`pass_the_edge` である（詳細な親子は `skill-tree.mjs` が正本）。

reactive は `mend` から、回復系 `triage→overflow_care→emergency_treatment→triage_relay→second_wind→shared_pain→urging→mercy_into_guard`、反撃系 `counter_blow→opportunist→whetted_by_pain`、防御/被弾系 `brace_after_hit→cover_ally→shield_handoff→guard_the_marked→barrier_stitch→wake_of_the_fallen→warded_into_edge→blocked_into_step`、開口系 `guarded_opening→seize_the_opening` / `echo_of_the_mark` へ分岐する。`emergency_treatment` から `steady_under_fire`、`whetted_by_pain` から `vengeful_step` と `finish_the_wounded`、`shield_handoff` から `last_stand`、`brace_after_hit` から `absorb_shock→block_focus→counterweight`、`patient_step` から `stride_into_reach` などの側枝がある。全体では x9終端だが、Campaign Stage 3 では x8までを意図した構成である。

passive は6つの foundation から始まる。`foundation_might→first_blood` は `edge_honed`、`wake_reader`、`mark_reader` を含み、`foundation_focus→steady_hands` は `patient_hands`、`relay_reader`、`foundation_guard→opening_guard→wall_reader`、`foundation_ap→held_breath→first_order` へ続く。`foundation_vitality` と `foundation_rp` は現行では foundation 自体が枝の終端である。

`analysis/ecology-skill-tree-smoke.mjs` は active/reactive に二つのフォーク、active x10終端二つ、reactive x9終端二つ等を検証する一方、Campaign 最終列を reactive x8 としている。ここは全体ツリーと現行Campaign解禁の違いを明記して設計する。

## 3. コスト、pack、Stage 解禁

### 3.1 無償 entry と passive foundation

`ecology/content/packs.mjs` の `BASELINE_ACTIVE_SKILL_IDS` は `strike`,`bulwark`、`BASELINE_REACTIVE_SKILL_IDS` は `mend`、`BASELINE_PASSIVE_SKILL_IDS` は次の6つである。

`foundation_vitality`, `foundation_might`, `foundation_focus`, `foundation_guard`, `foundation_ap`, `foundation_rp`

`FREE_ENTRY_SKILL_IDS` に入るため node cost 0 なのは active/reactive の3節（`strike`,`bulwark`,`mend`）だけである。6 foundation は常時manifestに含まれるが、ツリー上の nominal cost は1である。ファイル中の「passive 7種」というコメントは現行配列と一致しない。

### 3.2 Pack の full/core

| pack | role | full A/R/P | core A/R/P |
|---|---|---:|---:|
| `pack_edge` | primary_offense | 17/6/2 | 5/4/1 |
| `pack_care` | offensive_hybrid | 10/9/2 | 4/5/1 |
| `pack_wall` | offensive_hybrid | 10/9/2 | 4/5/1 |
| `pack_tempo` | offensive_hybrid | 7/6/2 | 4/4/1 |
| `pack_barrage` | primary_offense | 8/3/1 | fullのみ |
| `pack_relay` | support | 4/9/2 | fullのみ |

`PACKS_PER_MANIFEST=3` はランダム/無料 manifest 用の一般経路だが、`newProfile` は6 pack IDを解禁する。現行Campaignは固定packの累積経路を使うため、packの全所有と、そのStageでmanifestへ入る節は別概念である。`packs.mjs` の「4 pack」というコメントも現行6 pack配列とは一致しない。

### 3.3 Campaign Stage の実測

`ecology/content/campaign-stages.mjs` は Stage 0–3 を定義し、各Stageで新packを core として追加し、既存packを full にする。pack選択はseed非依存の固定値で、`auditCampaignManifestLadder()` の計算結果は空配列（重複/単調性エラーなし）である。

| Stage | 表示名 | 現行ID | 固定ロスター | enabled packs / 深度 | A/R/P / 合計 |
|---:|---|---|---|---|---:|
| 0 | 灰の入口 | `stage_0_edge` | warden, mender | care core | 6/6/7 = **19** |
| 1 | 抜ける刃 | `stage_1_wall` | warden, mender, lancer | care full, edge core | 17/14/9 = **40** |
| 2 | 動く隊列 | `stage_2_tempo` | warden, mender, lancer, guardian | care/edge full, wall core | 33/21/11 = **65** |
| 3 | 間合いと順番 | `stage_3_care` | warden, mender, lancer, guardian, tactician | care/edge/wall full, tempo core | 43/29/13 = **85** |

Stage ID の語尾と実際に追加されるpackがずれている（Stage 0 IDはedgeだがcare追加、Stage 1 IDはwallだがedge追加、以下同様）。IDはセーブ/ストーリーキーとして既存参照があり得るため、再設計で単純改名せず、保持または明示migrationを決める。

118節との差分は33節である。内訳は、`pack_barrage` full の12節、`pack_relay` full の15節、`pack_tempo` の core差分6節である。これは「未実装」ではなく、現行Stage 3 manifestに入らない節数である。`skill-tree-layout.mjs` の全体ツリーには reactive x9 があるが、`analysis/ecology-skill-tree-smoke.mjs` は `pack_relay` をStage 4候補として reactive x9をStage 3未到達にしている。

Stage定義には party/join/packDepths/question/pressure があるが、敵・boss・law の欄は現行では地域共通値または空配列である。`progression.composeEncounter` は `ecology/content/expedition.mjs` の固定12 encounterを実際に合成し、Stage固有の敵配置・位置・法則を使う実装にはなっていない。関連する設計課題は open issue #149（Stage固有の敵圧）、#154（Stage 3後）、#105（Stage 4以降）である。

## 4. 初期技能、前提閉包、加入、技能点

### 4.1 初期値と付与経路

根拠は `ecology/progression.mjs` と `ecology/app.js` である。

- `STARTING_RUN_SKILL_POINTS=0`。`newRun` は開始時の現ロスター各人を0点で初期化する。
- `RUN_SKILL_POINTS_PER_REWARD=1`。
- `simulateAndEnterBattle` は `result.result === "win"` のとき `recordEncounterCleared` の後に `grantRunSkillPointsToAll` を呼ぶ。通常/elite/bossを区別する条件はこの付与箇所にはない。
- したがって、現行アプリ経路で12戦すべて勝つと、そのRunの現ロスター各人は最終勝利後12点（最終戦直前は11点）になる。Run終了時の `settleRun` は技能点・解放・レベルをProfileへ移さないため、Profileへの持越しは0である。
- キャラクター加入時の追加技能点はない。`joinRun` は既存キャラクターなら既存点/レベルを保持し、新規キーなら0点を作る。
- SP付与自体に encounter key の冪等ガードはない。通常UIが同じ勝利を何度も確定する経路を作る場合は、同じ勝利を二重加算しない設計確認が必要である。

古い `docs/GAME.md` や issue #150 は「通常勝利+1」「12戦なので最終戦前は最大11点」と説明するが、実コードは `result === "win"` 全般で付与する。この差は、勝利種別が増えた場合の仕様の正本を決める材料である。issue #150 はopenで、序盤/中盤/終盤の成長曲線を再設計する提案であり、完了済み仕様ではない。issue #165 は技能体系全体再設計の現行要求である。

### 4.2 キャラクター加入時の無償前提閉包

`ecology/playable-battles.mjs` の `initialUnlockedSkills(characterId)` は、`ecology/content/roster.mjs` のスターター active/reactive に `strike`,`mend`,`bulwark` を足し、`withPrerequisites` で前提を再帰的に追加する。`ecology/app.js` の `joinRun` はその閉包を現在のmanifestに絞り、`runUnlockedSkills` に直接追加する。ここでは node cost を支払わない。`freshLoadout` が装備するのはスターター tactics/reactives のみで、passiveや全閉包が自動装備されるわけではない。

次表の「nominal paid」はツリーnode cost（entry 0、その他通常1）を閉包に機械的に適用した参考値であり、加入時に徴収される実支出ではない。

| character | starter active | starter reactive | 全閉包節数 / nominal paid | Stage 3までの備考 |
|---|---|---|---:|---|
| warden | `steady_cut` | `mend`,`overflow_care` | 6 / 3 | Stage 0から全て可用 |
| mender | `aimed_shot`,`shield_the_wounded` | `triage`,`emergency_treatment` | 8 / 5 | Stage 0から全て可用 |
| lancer | `heavy_swing`,`rear_hunt` | `shield_handoff`,`triage` | 11 / 8 | Stage 1では9節/6点相当。`cover_ally`,`shield_handoff`はmanifest外 |
| guardian | `reposition`,`column_thrust` | `scavenge_ap`,`brace_after_hit` | 11 / 8 | Stage 2で全て可用 |
| tactician | `relay_order`,`mark_target` | `patient_step`,`block_focus` | 14 / 11 | Stage 3で全て可用 |

Stage別に見ると、Stage 0は warden 6/3、mender 8/5。Stage 1は lancer 9/6が追加され、Stage 2で guardian 11/8、Stage 3で tactician 14/11が追加される。各キャラクターの全閉包には entry無償の3節が含まれ、残りは nominal cost 1だが、加入時には全て無償追加される。この「無償前提閉包」と「free entry node（3節）」は別の数値である。

### 4.3 現行解放操作

`unlockRunSkill` は manifest内、前提全解放、node cost支払いを要求する。`levelUpRunSkill` は解放済み、上限未達、SP1支払いを要求する。いずれも返金なしである。同じ1点を解放とLvアップに使うため、12勝程度のRunで深い枝を取得しつつLvを上げる余地は限られる。スターター閉包が深いキャラクターほど、見かけのツリー支出と実際のビルド支出が乖離する。

## 5. キャラクター、AP/RP、技能自動選択

### 5.1 現行キャラクター

`ecology/content/characters.mjs` の5人は次の基礎値を持つ（同ファイルと `docs/GAME.md` の数値は未検証値として扱われる）。

| ID | 役割上の呼称 | HP | might | focus | guard | AP | RP |
|---|---|---:|---:|---:|---:|---:|---:|
| `warden` | Gou | 300 | 50 | 6 | 1 | 1 | 2 |
| `mender` | Tsugumi | 110 | 8 | 52 | 2 | 1 | 2 |
| `lancer` | Nagi | 210 | 16 | 30 | 24 | 1 | 2 |
| `guardian` | Hibana | 120 | 14 | 14 | 3 | 2 | 2 |
| `tactician` | Genzou | 160 | 20 | 22 | 10 | 1 | 4 |

最大5人、2x3 formation、最大敵5体、装備最大2個は `ecology/schema.mjs` と `AGENTS.md` の共有制約である。後衛武器の might scaling は40%、techniqueは位置で減衰しない。damageは block→guard→barrier→HP の順で処理される（`ecology/engine.mjs`, `effects.mjs`）。

### 5.2 AP/RPと1ラウンドの順序

`ecology/engine.mjs` の `startRound` は、生存者のAP/RPを基礎値へ更新し、`resource_refreshed` を記録してから `round_started` を発火する。`foundation_ap`/`foundation_rp` は `round_started` 後に戦闘1回だけ各資源+1する passive rule である。毎ラウンド増加するpassiveは現行の設計制約に反するため、新技能でも同種の無限/反復資源ループを作らない。

味方側と敵側が交互に action queue を処理する。各sideの queue は formation position、同位置なら instance IDで決まり、生存者はside phaseごとに最大1回のactivationを行う。AP2の actor が1回のactivationでAPを2回使うことはなく、次の自分側phaseで再度動く。`gain_resource action_points` は同じsideの未訪問actorを次回phaseに再queueするだけで、現在のactivationを直ちに連続化しない。actor/round のactivation cap は8。

`chooseTactic` は `actor.tactics` のロード順を先頭から調べ、技能固有predicate、tacticの `useWhen`、target query/reach、AP costを全て満たす最初の技能を選ぶ。現行の特殊 `useWhen` は `relay_order` の round内初回action限定で、その他は空。UIで並び替え/無効化した結果だけがBattleInputに入り、内容側にpriorityの別アルゴリズムはない。tacticが使えなければ core basic strike（melee/ranged）へフォールバックする。utility action は50%で一度 `fallbackStrike` を続けるが、channelは明示的に追撃しない。

## 6. 発火連鎖と装備の共有イベント

### 6.1 event/chain

`ecology/engine.mjs`、`event-queue.mjs`、`effects.mjs` の実行順は以下である。

1. actionを候補化し、`action_declared` と `target_selected` のinterrupt windowで再検証する。
2. AP/RPを支払い、`action_started`、技能のeffect/preparation、`action_resolved` を同一chainで処理する。
3. `damage_proposed`、`healing_proposed`、`barrier_proposed` 等のinterruptを即時dispatchし、after反応をqueueする。
4. queueされたafter反応を排出し、actor_defeated等の反応を勝敗確定前に処理する。

`runChain` はchain内event数256、battle全体4096を既定上限とし、同一owner/ruleはchainごと最大1回、さらにround/battle limitを適用する。発火直前にsource、predicate、costを再チェックする。eventには決定的な `evt_0000` 系ID、chain、parent、source actor、targets、source definition、rule/skill/equipment IDs、tags、valuesが入り、リプレイ/UI/テストが同じevent streamを読む。

### 6.2 reactiveのRPと優先順

Reactiveはイベントとpredicateが成立した時にRP costを確認して発火する。多くはRP1、`stall_the_blow` はRP2、`guard_step` や `scavenge_ap` など無料に見えるものもchain/round上限を持つ。ruleの比較は priority、initiative rank、position rank、owner ID、rule ID、equipment instance ID。所有者内で同一event/timingのreactiveはloadout orderを使う。従って、ロード順だけで全キャラクター横断の順番を決める仕様ではない。

### 6.3 「装備共有イベント」の実態

装備は共有インベントリや共通ruleプールではなく、各actorの最大2枠に装着される。しかし、`engine.ruleEntriesFor` / `allRuleEntries` は生存actor全員の装備ruleを集め、発生したeventを全体dispatchする。`selectors.mjs` の `event_source` / `event_targets` と `is_event_source` / `is_event_primary_target` により、装備所有者が別actorの行動・被弾・回復・撃破を観測し、条件を満たせば自分の効果を発火できる。

packless `family_scar` は `ecology/content/affixes.mjs` で shared `damage_taken` を読む代表例で、stageのaffix familiesには常時 `family_scar` が含まれる。その他の共有event例は `damage_blocked`、`barrier_broken`、`resource_unused`、`actor_moved`、`preparation_completed`、`healing_applied`、`status_added`、`action_resolved`、`battle_started`、`round_started`、`damage_proposed`。装備costは耐久/HP/barrier/RP等を使え、壊れた/枯れた装備はそのbattle中ruleを供給しない。生成文法は trigger/source → 0–2 conditions → 0–1 cost → 1–3 effects → limit → durability/charge で、拾う前に完全な読み出しを提示する契約がある（`equipment-gen.mjs`, `AGENTS.md`, `docs/GAME.md`）。

## 7. 現在の問題と再設計で残す制約

### 7.1 現行の問題（現行ソースから確認）

1. **正本・数値の不一致**: 実数118に対し `content/index.mjs` の「123節」、`packs.mjs` の「4 pack」「passive 7種」、`docs/GAME.md`/`docs/DESIGN.md` の reactive x10 記述が残る。全体layoutはreactive x9、Campaign smokeはx8である。監査値はモジュール実値を優先する。
2. **Stage IDとpackの意味ずれ**: `stage_0_edge` がcareを追加する等、表示/ID/追加packが対応しない。既存セーブ/ストーリー参照を踏まえたmigrationが必要。
3. **Campaignの段階差が技能manifest中心**: Stage固有 enemy/position/law は未充足で、実戦は `expedition.mjs` の固定12戦と地域共通敵・bossへ依存する。pack解禁の変化に対して、敵圧・複数解法・リプレイ差が薄い。
4. **技能点の曲線と解放の二重構造**: 初期0、勝利+1、解放とLvアップ共用、加入時前提閉包は無償。深い木の見かけのコストと、実際のキャラクター別ビルドコストが一致しない。
5. **旧互換コンテンツとの併存**: `content/encounters.mjs` は旧7戦リストを残し、`playable-battles.mjs` の互換API等から参照される一方、現行ランは `expedition.mjs` の12戦である。`docs/ARCHITECTURE.md` の「encountersが正本」という説明と実行経路を整理する必要がある。
6. **実験結果の不足**: 数値はNode計算で検証できるが、キャラクター基礎値・技能の強弱・自動優先順による実戦体験は、現行の静的チェックだけでは証明されない。`node ecology/check.mjs`、`bash analysis/check-all.sh`、skill tree smokeは整合性/決定性の検査であり、楽しさやビルド選択の検証ではない。
7. **旧資料を現行仕様として読めない**: issue #107（123技能、34未到達等）、#137（x10設計完了等）は過去の設計/実装時点の記録で、現行mainの118/33/x9と異なる。issue #150、#165、#149、#152、#154、#105はいずれもopenの設計課題であり、完了済み仕様と混ぜない。

### 7.2 再設計で維持すべき制約

次は `AGENTS.md`、`docs/DESIGN.md`、`docs/GAME.md`、`docs/RULE_ECOLOGY.md`、`docs/ARCHITECTURE.md` から、技能体系を変えても残すべき契約である。

- 同じ入力・seed・content・generatorなら同じ結果/event streamになる。乱数key、manifest、encounter、reward、equipment、compiled equipment、Blueprint/re-manufacture JSONの再現性を維持する。
- engine側はskill ID/nameごとの特例分岐を持たず、共有のevent、predicate、cost、effect、target relationの組合せで新しい遊びを表現する。
- 敵は特定技能を要求せず、初期圧、対象数、guard/block、位置、準備、資源圧など複数の性能軸で解法を問う。
- AP/RP、hit/block、round/charge/durability/status/position等は小さな整数/fixed pointで扱い、効果量の丸めはround-half-up。技能Lvは量の倍率以外の行動回数・資源・上限を直接増やさない。
- starter閉包、free entry、manifestのpack深度、解放cost、Lvアップcostを別データとして表示・計算する。加入時のSP、無償閉包、加入後の新規解放、Profile持越しを明示する。
- 5人/2x3 formation/最大敵5体/装備2個、位置・reach・guard/block/barrierを共有する。rear weapon 40%等の既存戦術軸を壊す場合は移行理由を定義する。
- fallback direct attack、utilityの一度だけの50% follow-up、channelの明示的な非追撃、action cap・chain cap・round/battle limitを維持し、時間経過でHP/資源/装備を稼ぐstallを許さない。
- reactive/装備の発火はcost・predicateを直前再確認し、優先順、loadout order、共有event participant scopeを決定的にする。無料ループ、死んだ条件、無限RP/AP循環を作らない。
- 装備は最大2枠、完全な拾得前readout、決定的generator、壊れた後のrule停止を維持する。packless `family_scar` のような共有event軸はpack所属と分離する。
- Campaignはsequentialでpay/skipなし、固定IDと既存参照を保全し、pack選択seed非依存という現行tutorial契約を変更する場合はversion/migrationを用意する。公開変更時はtutorial/trial script、content version、決定性チェックを更新する。
- 完全上位互換の技能を避け、上位は用途・コスト・条件・リスクのトレードオフを持たせる。技能名/効果の旧IDを変更する場合は `RETIRED_IDS` と理由、version mismatchの扱いを定義する。

## 8. 計算・再現手順

今回の数値は次の規則で再現できる。

1. `SKILL_TREE_NODES` を import し、`kind` と `layout.x`（または `requires` 深さ）で group-by する。実行時active 66との差は、ツリーID集合との差集合を取り、8個の内蔵/敵/fixture IDとして確認する。
2. 各Stageの `enabledPackIds` と `packDepths` を `skillIdsForPacks` に渡す。baselineの active2/reactive1/passive6 を union し、core/full技能を足して A/R/P を数える。118からStage3合計85を引き、未到達33を得る。
3. 各characterの `starterTactics` / `starterReactives` に baseline active/reactiveを加え、`withPrerequisites` を再帰適用する。node costを合計した値は「nominal paid」として記録し、`joinRun` が実際にはその閉包を点消費なしで追加することを別に確認する。
4. SPは `STARTING_RUN_SKILL_POINTS + winCount * RUN_SKILL_POINTS_PER_REWARD`。現行アプリの勝利分岐には種別条件がない。`settleRun` の戻り値/Profile更新を確認し、Run外へ移らないことを確認する。
5. AP/RPと発火順は `engine.startRound`、`runActivations`、`chooseTactic`、`performAction`、`runChain`、`compareRuleEntries`、`event-queue.mjs` を順に追う。確認対象は `resource_refreshed`/`round_started` の順、side queue、tactic配列先頭優先、interrupt再検証、after queue、chain/activation上限、event provenanceである。

整合性の自動検査入口は `node ecology/check.mjs`、`bash analysis/check-all.sh`、`analysis/ecology-skill-tree-smoke.mjs`。これらは件数・schema・決定性・木構造を検査するが、実戦での強さ、技能選択の多様性、Stage圧の妥当性を保証しない。再設計では、同じseedでの複数ビルド比較、加入前後の閉包/SP ledger、Stage別に到達可能な技能と敵圧の表、event traceを追加の判定材料にする。

## 付録: 根拠ファイル一覧

- ルール/契約: `AGENTS.md`, `docs/DESIGN.md`, `docs/GAME.md`, `docs/RULE_ECOLOGY.md`, `docs/ARCHITECTURE.md`, `docs/HISTORY.md`
- ツリー/レイアウト/レベル: `ecology/content/skill-tree.mjs`, `ecology/content/skill-tree-layout.mjs`, `ecology/content/skill-levels.mjs`, `ecology/content/index.mjs`
- pack/Stage: `ecology/content/packs.mjs`, `ecology/content/campaign-stages.mjs`, `analysis/ecology-skill-tree-smoke.mjs`
- starter/加入/ラン: `ecology/content/roster.mjs`, `ecology/playable-battles.mjs`, `ecology/progression.mjs`, `ecology/app.js`
- 戦闘: `ecology/engine.mjs`, `ecology/effects.mjs`, `ecology/event-queue.mjs`, `ecology/predicates.mjs`, `ecology/selectors.mjs`, `ecology/schema.mjs`
- コンテンツ: `ecology/content/expedition.mjs`, `ecology/content/encounters.mjs`, `ecology/content/characters.mjs`, `ecology/content/affixes.mjs`, `ecology/content/equipment-gen.mjs`
- 旧/計画issue（現行値と分離）: #105, #107, #149, #150, #152, #154, #165（#137は過去の実装記録）
