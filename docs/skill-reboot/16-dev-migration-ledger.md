# dev移行台帳 — Stage 0〜4

更新日: 2026-09-26  
状態: **Stage 0〜3完了。Stage 4（fixture-first UI）を実装中。** Stage 0の190節同期と初期20導出、Stage 1の敵registry分離、Stage 2の共通解決順・ActionPlan（#299〜#304）、Stage 3のloadout・progression・pack・save契約（#306〜#311）はdevで完了。現行runtime・画面への切替と残り170節の実装は後続段階。

この台帳は、[PR #288の依存監査・実装順序](https://github.com/KKawamura1/garakuta-lab/blob/feat/weapon-skill-system/docs/skill-reboot/15-pr288-dependency-audit-and-sequencing.md)に沿って、dev上での確認事項・撤去条件・未確認点を記録する。技能仕様の正本はmainの [武器カタログ](11-weapon-catalog.md) と [解決順監査](12-resolution-order-audit.md)。PR #288は移植元・監査材料として使い、全体をdevへ取り込まない。

## 基準スナップショット

| 対象 | 2026-09-24時点の状態 |
|---|---|
| main / dev | mainの基準commitは `d06e997a4bffbfb7d4848f1576a89708ee566f53`。devとこのStage 0作業ブランチはこのcommitから開始した |
| PR #288 | Draft・open。base=`main`、head=`feat/weapon-skill-system`（`1d3855cac3da825a0c470a411d316f86abd0633b`）、43 commits、104 files（追加43,799 / 削除37,560）。この差分は丸ごとマージしない |
| PR #288技能監査 | 同PRの監査台帳は戦槌・格闘具・射出器の57/190節を仕様・実装・挙動テストまで照合済みとしている。残る133節と共有機構変更後の再監査が残る |
| mainのCI | mainの基準commitに対する `灰の遠征 checks` run 35870940575 はsuccess。2026-09-24のcheck-runでも `Current implementation` とCloudflare Pages deployがsuccess |
| Stage 0 branch | checks run 35993715798 はsuccess。カタログ同期checkを含む `analysis/check-all.sh` が通った |
| Stage 0 trial | deployed trial run 35993715806 はsuccess。今回のbranchはruntime切替前なので、これは現行ゲームの遠征・チュートリアル経路を保つ基準確認であり、新技能engineの試験ではない |
| #288で報告された検査 | `weapon-system.test.mjs` 2,950 checks、`story.test.mjs` 5,739 checks、termination 117、schema 134などはpassと報告。 `ecology/check.mjs` は14 suite中13 passで、contract snapshotの不一致が残作業として記録されている |
| Issue #178 | open。完了条件に `node ecology/check.mjs`、`bash analysis/check-all.sh`、両trialが含まれる。新しい同等試験を通すか、完了条件を明示的に更新するまで両trialを削除しない |

mainのCIはNode 22で構文検査、`ecology/check.mjs`、`analysis/check-all.sh`のsmokeを実行する。`.github/workflows/ecology-trial.yml`はpush時にmainを除外するため、この基準runは公開preview上の遠征・チュートリアル通しを証明しない。画面／切替PRでは専用branch previewで両trialを確認し、実行不能なら未確認理由を記録する。ここでの基準検査結果はGitHub Actionsの記録によるもので、このWork内でmain全体をローカル実行した結果ではない。

## 旧経路の依存台帳

| 旧経路・参照元 | 置換先 | 撤去条件と代替検査 |
|---|---|---|
| `ecology/content/skills-active.mjs`、`skills-reactive.mjs`、`skills-passive.mjs`。現行player registryは `content/index.mjs` で統合される | 武器別player skill moduleと、新しいplayer registry | 初期20節の実装・戦闘・予測・replayが新registryを通る切替PRで旧定義を撤去。IDごとの契約・挙動試験を移す |
| `content/skill-tree.mjs`、`skill-tree-layout.mjs`、`skill-levels.mjs`。旧skill ID、level map、取得前提をUI・進行・保存が読む | 武器別treeと取得済みID集合。武器技能にlevelを持たせない | 新treeの190位置・前提・取得可能集合・初期20を機械検査してから、旧tree・layout・level参照を初期20の切替PRで同時に削除。新規モジュールから旧IDをimportしない |
| `content/packs.mjs` のskill packと装備packの混在・共通解禁 | `skill-packs` と装備packの別registry・別manifest欄 | 遠征生成・抽選・画面のpack一覧・保存を別集合で検査し、技能が装備抽選へ／装備が技能取得へ漏れないことを確認して旧skill-pack経路を削除 |
| `content/index.mjs`、`content/enemies.mjs`、`playable-content.mjs`の共有player/enemy skill参照 | 敵の実使用技能だけを持つenemy registry（PR #292）と、武器別player registry | PR #292で全敵actorのactive/reactive/passive参照を敵側だけで解決し、player IDの誤参照をschemaで拒否。共有効果の複製元として旧player moduleへの一時importは残る。武器別player実装を通す切替時に複製元と旧runtime依存を撤去 |
| `schema.mjs`、`validate.mjs`、`effects.mjs`、`predicates.mjs`、`engine.mjs`、`event-queue.mjs`、`replay-beats.mjs` | 解決順監査に沿った共通event/effect/predicateと、その表示・replay | event語彙を増やすPRごとにschema・validator・engine境界テスト・表示/replayをそろえる。未知語彙はvalidator error。previewと本番を同一engine経路にする |
| `progression.mjs`、`playable-battles.mjs`、`app.js`のProfile/Run保存、取得・予約、装備、予測 | 新loadout、予約、装備/技能pack分離、明示的なcontent/save version | 新versionで取得から保存・再読込を試験し、異なるversionを拒否する。旧save移行は行わず、互換adapterを切替PRに残さない |
| `app.js`、`index.html`、`styles.css`、画面smoke、tutorial/expedition trial | fixture先行の武器tree/loadout/予約/技能説明/戦闘予測UI | 画面ごとに390px前後のsmokeとbranch previewを確認。未実装節を取得可能に見せず、本番と予測に同じengine event列を使う |
| `contract-snapshot.json`、`contract-snapshot.mjs`、`contract.test.mjs`、`ecology/check.mjs`、`analysis/check-all.sh`、GitHub Actions | 新規registry・save/event contractに対応するsnapshotとテスト | 対象PRごとに差分理由を確認する。削除するチェックは対応する新試験を明記してから外す |
| `docs/skill-reboot/README.md` と旧v3/research文書へのリンク、Issue #178 | docs・Issueの明示的な後続整理 | 文書リンクを実在ファイルで確認。Issue #178の両trial条件は同等試験か明示的な条件更新まで保持する |

依存が見つからないことだけで削除可とはしない。import、ID、保存データ、UI、preview、replay、CI、workflow、文書、Issueをこの表へ戻し、旧検査が覆っていた範囲を新しい検査へ移したPRで削除を完了とする。

## 190節メタデータの出典と現状

`11-weapon-catalog.md` の各武器表は10武器×19節で、位置・種別・名称・実装契約・表示用効果文・フレーバーを定義する。現在の正本には**実装skill IDは明記されていない**。技能ツリーの前提はカタログ上の位置から確定する。

このStage 0ではPR #288の `analysis/sync-pr287-weapon-spec.mjs` と生成物 `ecology/content/weapon-specifications.mjs` を移植した。同期checkはカタログ10武器・190行・列数・位置順・空欄・種別を検査し、生成物の差分を検出する。`analysis/check-all.sh` から `--check` で実行する。カタログ11と生成物の組合せはローカルcheckで190行同期を確認し、Stage 0 branchのchecks run 35993715798でもpassした。

実装skill IDはカタログ11にないため、PR #288のweapon tree moduleをそのまま新しい正本として採用しない。PR #288の監査台帳で仕様・実装・動作まで照合済みなのは57/190節。追加で全190節のtree種別をカタログの種別と照らすと、25件が不一致で、すべて未チェックの133節にあった。監査済み57節に種別不一致はない。これは未監査データを新runtimeへ一括移植できないことを示す。

skill IDはmainの仕様から再生成できない。前提はカタログの位置から導出する。PR #288のtree moduleを監査台帳とともに証拠として保存し、その状態を新runtimeへそのまま昇格しない。初期取得は代表武器2本×R/A1から種別不問で導出する（医療具A1はリアクティブ）。Stage 0ではbindingと代表武器の出典を分けて記録し、190位置への全件対応・一意ID・初期20件を検査した。仕様文のコピーを武器moduleへ増やさない。

### skill IDの出典と初期20技能の検証

- `ecology/content/weapon-skill-bindings.mjs` は、PR #288 head `1d3855cac3da825a0c470a411d316f86abd0633b` の10個の武器tree宣言から、190位置のskill ID・旧treeの宣言種別を記録した移行専用データである。技能ツリーの前提はカタログ上の位置から導出する。戦闘定義はコピーせず、runtimeからimportもしない。
- 各行に監査状態と出典moduleを持たせた。PR #288監査台帳（https://github.com/KKawamura1/garakuta-lab/blob/1d3855cac3da825a0c470a411d316f86abd0633b/docs/skill-reboot/14-pr288-implementation-audit-2026-09-24.md）で完了している戦槌・格闘具・射出器の57節だけを `audited`、残る133節は `pending` とする。代表武器の根拠はPR #288の `weapon-trees.mjs` に固定した。旧実装のskill IDを記録したことは、技能の意味や新runtimeでの挙動が監査済みであることを意味しない。
- 旧treeの提案種別は正本の種別として使わない。カタログと異なる25位置（医療具4、大盾2、長槍5、鉤縄4、号旗4、重弩6）は一覧のまま保持し、pendingの差分として検査する。特に医療具A1はカタログのリアクティブを初期技能に含める。
- 代表武器は人物ごとに2種を明示し、種別ではなくR/A1位置から20節を導出する。検査は190位置の完全対応、一意ID、57/133の監査状態、25種別差分、5人×2武器×R/A1を確認する。
- `node analysis/check-weapon-skill-bindings.mjs` を `analysis/check-all.sh` へ加えた。Stage 0後の個別節監査は引き続き武器PRの範囲で行う。


### PR #288実装とカタログの未解決差分

| 武器 | 未監査の種別不一致数 | 例 |
|---|---:|---|
| 医療具 | 4 | A1: カタログはリアクティブ「応急手当」、tree moduleはパッシブID `medical_kit_clean_tools` |
| 大盾 | 2 | A2 / BB1 |
| 長槍 | 5 | B2 / BA1 / BB1 など |
| 鉤縄 | 4 | B1 / B2 / BA1 / BB1 |
| 号旗 | 4 | AB1 / AB2 / BB1 / BB2 |
| 重弩 | 6 | AB1 / AB2 / B2 / BA1 / BA2 / BB1 |

医療具A1の実装定義はPR #288の `MEDICAL_KIT_PASSIVE_SKILLS` にあり、防壁提案量を増やすパッシブ規則である。カタログのA1は被弾後のリアクティブ回復で、種別だけでなく効果も異なる。PR #288の `weapon-trees.mjs` は表の種別をカタログから上書きするため、結合後のtreeだけを見る検査では定義側の不一致を隠す可能性がある。

この25件はPR #288の未監査範囲で見つかった初期差分であり、全技能の動作監査の代わりにはならない。未照合のIDは仮の移植元として扱い、確認済みbindingへ昇格しない。将来はカタログ上の位置から前提を導出し、PR #288由来のskill IDと宣言種別は照合根拠付きで扱う。
## Stage 0の完了判定

- [x] mainの基準CI・PR #288・Issue #178の状態を記録
- [x] カタログ由来の190節表示・契約メタデータ同期を追加
- [x] 出典・監査状態付きのskill IDを190位置へ結び、種別差分と未監査状態を維持して検証
- [x] 5人の代表武器2本からR/A1を種別不問で導出する初期20節を検証
- [x] PR #290のchecksとdeployed trialを確認し、結果を記録

## Stage 1の敵registry分離

- [x] PR #292で敵active/reactive/passive registryとenemy core actionを分離し、敵戦闘smoke・schema境界検査を通した

準備段階では旧player runtimeを維持する。新規モジュールは旧skill ID・level map・旧tree・旧pack形状へ依存させない。PR #292の共有enemy actionは移行用の複製であり、武器別player実装の後に複製元importを撤去する。初期20節のゲーム本体切替と旧経路削除は同じ後続PRで行う。

新しい武器スキルに個別レベルは設けない。PR #299の `add_action_hit` は現行の旧player runtimeに残る `skillLevels` / `afterSkillLevel` を経由するが、この補正を新しい武器スキルへ引き継がない。旧runtime撤去時に、追加hitを含む新武器技能の解決から旧level map依存をなくす。現行contentは `action_hits_expanding` を使わないため、Stage 2中は旧runtime上の暫定挙動として扱う。

## Stage 2の共通解決順とActionPlan

- [x] PR #294で同一人物のリアクティブ優先列をevent / timingごとに適用する。条件またはRP支払いに失敗した候補は飛ばし、同じ窓で最初に発動した一つだけを選ぶ。他の人物の反応は独立して処理する。複数候補・条件不成立・RP不足からのfallbackを `ecology/engine.test.mjs` のイベント列で固定した。
- [x] ActionPlanの基礎境界を追加する。`applyEffects` の最初の `deal_damage` 前に、同じ効果列に残る直接ダメージ効果ごとの基礎対象、形状展開後の受け手、hit枠、基礎威力を固定する。効果列の受け手を重複排除し、`damage_proposed` / `damage_skipped` に共通の `actionPlanId`、効果index、基礎hit数・対象数・予定対象数を記録する。提案前に対象が倒れてhitを飛ばす場合も `plannedAmount` を残す。
- [x] 一つ目の攻撃効果で最弱対象を倒しても後続効果が別対象へ移らないこと、最初のhit後に得た状態が後続効果の基礎威力へ遡及しないことを `ecology/engine.test.mjs` で確認する。試映は同じ `simulateBattle` を通り、replayは同じevent列を読む。
- [x] `action_declared` のinterruptと、そこで発生した移動イベントのafter反応を対象決定前に完了する。melee射程内の候補が空でも、同じqueryに射程外の生存対象があり、発火可能な `action_declared` 位置交換ruleがある場合だけ行動候補として残し、移動後にqueryを解き直す。移動反応が無いときは空振りの宣言を出さない。移動後の対象を `target_selected` に渡し、既存redirect後の最終対象をコスト再確認・`action_started`・ActionPlanへつなぐ。前列へのswap、`actor_moved` after反応、移動後の対象選択、cover redirect、最終対象へのdamageと、移動反応が無いときに宣言しないことを `ecology/engine.test.mjs` のevent traceで確認する。
- [x] PR #297で `target_selected` のinterruptとafter反応をすべて終え、最終対象・行動者の生存・APを再確認してから `action_started` を出す。そこで攻撃開始時のinterruptを一人物ごとのリアクティブ優先列で解決し、反応とそのafter反応後に主効果のActionPlanを作る。対象選択後反応で行動者が倒れた場合はAP支払い前に中止し、攻撃開始反応で倒れた場合は支払い済みAPを戻さず本体効果を中止する。どちらも対象を選び直さない。`ecology/engine.test.mjs` のevent traceで、対象選択後反応が攻撃開始反応より先に解決すること、開始時の強化が最初のdamageへ反映されること、先行候補がRP不足なら次候補が発動すること、攻撃者撃破時に主damageが発生しないことを固定する。`action_started` ではpending-action専用の対象変更・取消し効果を拒否する。
- [x] 対象変更と攻撃開始反応の後、ActionPlan固定前に `action_targets_expanding` を接続する。単体直接攻撃だけがこの窓へ進み、`add_action_damage` の実対象・正量を支払い前に確認する。各人物の優先列から最初に成立する副対象追加一つを選び、主対象と重なる相手を除いた追加damage片を元のActionPlanへ登録する。主効果列の後に標準damage処理で解決し、重複なしの予定対象数と後続不発をevent traceで固定した。振り幅・貫通・炸裂筒など個別技能のregistry定義は後続の技能移植で追加する。
- [x] Stage 2fで `action_hits_expanding` と `add_action_hit` を追加し、候補のhit数・威力をRP支払い前に固定してからActionPlanへ統合する。合計hit上限による優先列fallback、基礎hit数と計画hit数の記録、対象の途中撃破で追加hitを再配分しないことを `ecology/engine.test.mjs` で確認する。
- [x] 各damage instanceの防御・HP結果後にafter queueをdrainし、`barrier_broken`後の反応と、その反応が作るcounter・状態付与を次の予定hit前に完了する。再帰drainで現在のrule効果を中断しないこと、後続hitだけが新状態を読むことを `ecology/engine.test.mjs` のevent traceで確認する。
- [x] action effect・準備開始が発生させたafter反応を `action_resolved` より先に完了し、そのイベント固有のafter反応をaction end処理として最後に行う。順序を `ecology/engine.test.mjs` のevent traceで固定する。
- [x] PR #295のActionPlan基礎でPR #293の単独の効果単位計画を包含し、PR #293をsupersededとして閉じた。別系統の計画は並行して残さない。

- [x] PR #302で、新しい武器技能に個別レベルを設けない方針と、旧runtimeの `skillLevels` / `afterSkillLevel` 依存を新runtimeへ持ち込まない切替条件を台帳に記録した。
- [x] PR #303で、すでにdevにあったPR #299の後ろへPR #300〜#302の累積差分を統合した。
- [x] PR #304で監査項目6a「攻撃前防御崩し→反応→ダメージ」を実装した。`reduce_defenses` で防壁の割合減少・受け構えの全解除を扱い、防御が減った対象ごとに一度 `defense_reduced` を発生させ、次の対象・効果へ進む前に反応を解決する。防壁解除はdamage/hitとして記録しない。hit後の7bも同じ反応窓を使い、受け構えが減った時または防壁が0になった時に反応する。反応で得た状態は以後の未処理hitに適用する。

Stage 2の共通解決順とActionPlanはdevで完了した。PR #299は先行してdevへマージ済みで、PR #300〜#302は [PR #303](https://github.com/KKawamura1/garakuta-lab/pull/303) で統合、最後の防御崩し窓は [PR #304](https://github.com/KKawamura1/garakuta-lab/pull/304) で追加された。devの統合commitは `0341d850655b5b99bf1671e107881c787bba8754`。このcommitの [Current implementation checks](https://github.com/KKawamura1/garakuta-lab/actions/runs/36208047199) と [deployed expedition trial](https://github.com/KKawamura1/garakuta-lab/actions/runs/36208047165) はsuccess。

以降は依存順序表のStage 3〜7（ロードアウトと取得・UI・本体切替・残り170節・最終統合）へ進み、各境界を個別PRと同じsimulation/replay経路で検証する。


## Stage 3 progress — loadout and progression state

- [x] **3a / PR #306 — 主軸と優先列のロードアウト契約。** `ecology/weapon-loadout.mjs` は仕様190節の `weaponId:position` から一意なnode keyを作り、一人一つの主軸、順序を持つリアクティブ列とターゲット列を定義する。取得済みpassiveは個別装着欄を持たずすべて適用する。未取得・種別違い・未知node・未知field・別version・roster不一致を拒否する。旧skill ID / level map / tree / packには依存しない。
- [x] **3b / PR #307 — 取得・前提・予約。** `ecology/weapon-progression.mjs` はカタログ位置から前提DAGを導出し、取得済みnodeと人物別SPのみを保持する。技能levelは持たない。人物ごと一つの予約先へ前提から自動取得し、予約の取消・差替え・クリア報酬の重複防止を扱う。利用可能nodeは後続の新Manifestから渡す。
- [x] **3c / PR #309 — skill packとequipment packの分離。** `ecology/weapon-pack-manifest.mjs` は武器10種のskill pack（`skill:<weaponId>`）と装備affix family pack（`equipment:<familyId>`）を別registry・Profile欄・Manifest欄として定義する。二つのpoolを別seed domainで抽選し、取得可能nodeはskill packから、装備familyはequipment packからだけ導出する。共通の `family_scar` は常時有効。旧Profile/Runと現行runtimeへはまだ接続しない。
- [x] **3d / PR #310 — Profile / Run保存境界。** `ecology/weapon-save.mjs` はProfileとRunを別schema versionでJSON保存・再読込する。未対応version・未知field・旧skill level欄・roster違い・Profile未解禁pack・Manifest範囲外の取得node・未取得loadout技能は理由付きで拒否する。旧saveの自動移行や現行storageへの接続はしない。

3a〜3dは新武器技能系の移行契約であり、現行Profile/Run保存・runtime Manifest・画面・BattleInputへは未接続である。現行ゲームの技能tree/runtimeは切替PRまで維持し、Stage 5の本体切替で旧経路を同時撤去する。

## Stage 4 progress — fixture-first UI

- [x] **4a — 技能ツリーと節の説明。** 独立プレビューで10武器×19節を地図／一覧表示し、PR #289と同じ丸付きA/R/T/P、条件・コスト／効果バッジ、選択で地図を作り直さない効果専用の詳細盤を使う。内部位置名を表示せず、全節を `catalog-only` / `canAcquire: false` として本編のruntime・取得・saveへ接続しない。
- [x] **4b — 主軸・リアクティブ・ターゲットのロードアウト画面。** 固定fixtureだけで主軸一つとリアクティブ／ターゲット優先列を並べ替え、パッシブに個別装着枠を出さない。A/R/T/P丸記号を使い、内部位置名は画面に出さない。fixtureはページ内だけで、本編state・保存には渡さない。
- [ ] **4c — 前提・取得予約画面。** 固定fixtureで前提経路と一人一件の予約表示を確認する。未実装技能の取得操作を有効にしない。
- [ ] **4d — 技能説明と戦闘予測の表示面。** 効果説明を表示し、予測画面の情報配置を確認する。新runtime未接続の固定値を本編の予測と誤認させない。

4aのプレビューは `/ecology/weapon-skill-prototype.html`。現行 `/ecology/` の起動経路を変えず、game stateも書き換えない。各後続PRで画面単位の試験とモバイルbranch preview確認を記録する。
