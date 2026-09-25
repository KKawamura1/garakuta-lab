# dev移行台帳 — Stage 0・Stage 1・Stage 2

更新日: 2026-09-25  
状態: **Stage 0・Stage 1完了。Stage 2fで追加hitを統合し、2gではhit後反応と防御崩しまで実装。action endのafter処理順が残る。** PR #291で190節のカタログ同期・ID出典整理・初期20節の導出を追加した。PR #292で敵の実使用技能だけを独立したregistryへ移し、schema・engine・敵戦闘の境界を切り替えた。PR #294で同一人物のリアクティブ優先列を監査仕様へ合わせ、PR #295で同一効果列に含まれる複数の直接ダメージを一つのActionPlanへ束ねた。PR #296で対象前の移動反応を解決順へ接続し、移動後に対象を再選択した。PR #297では対象選択後のafter反応を先に完了し、最終対象・行動者の生存・APを再確認してから、主効果とActionPlan固定の前に攻撃開始時のinterruptを解決した。PR #298で単体攻撃の副対象拡張反応を主行動のActionPlanへ接続した。PR #299で追加hit/RPを統合し、Stage 2gの防御崩し・hit後反応は次のhit前に解決する。残りはaction end反応の境界順。武器別player registry、未実装技能の取得制御、新runtimeへの全面移行はStage 2の後続。

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

## Stage 2の共通解決順とActionPlan

- [x] PR #294で同一人物のリアクティブ優先列をevent / timingごとに適用する。条件またはRP支払いに失敗した候補は飛ばし、同じ窓で最初に発動した一つだけを選ぶ。他の人物の反応は独立して処理する。複数候補・条件不成立・RP不足からのfallbackを `ecology/engine.test.mjs` のイベント列で固定した。
- [x] ActionPlanの基礎境界を追加する。`applyEffects` の最初の `deal_damage` 前に、同じ効果列に残る直接ダメージ効果ごとの基礎対象、形状展開後の受け手、hit枠、基礎威力を固定する。効果列の受け手を重複排除し、`damage_proposed` / `damage_skipped` に共通の `actionPlanId`、効果index、基礎hit数・対象数・予定対象数を記録する。提案前に対象が倒れてhitを飛ばす場合も `plannedAmount` を残す。
- [x] 一つ目の攻撃効果で最弱対象を倒しても後続効果が別対象へ移らないこと、最初のhit後に得た状態が後続効果の基礎威力へ遡及しないことを `ecology/engine.test.mjs` で確認する。試映は同じ `simulateBattle` を通り、replayは同じevent列を読む。
- [x] `action_declared` のinterruptと、そこで発生した移動イベントのafter反応を対象決定前に完了する。melee射程内の候補が空でも、同じqueryに射程外の生存対象があり、発火可能な `action_declared` 位置交換ruleがある場合だけ行動候補として残し、移動後にqueryを解き直す。移動反応が無いときは空振りの宣言を出さない。移動後の対象を `target_selected` に渡し、既存redirect後の最終対象をコスト再確認・`action_started`・ActionPlanへつなぐ。前列へのswap、`actor_moved` after反応、移動後の対象選択、cover redirect、最終対象へのdamageと、移動反応が無いときに宣言しないことを `ecology/engine.test.mjs` のevent traceで確認する。
- [x] PR #297で `target_selected` のinterruptとafter反応をすべて終え、最終対象・行動者の生存・APを再確認してから `action_started` を出す。そこで攻撃開始時のinterruptを一人物ごとのリアクティブ優先列で解決し、反応とそのafter反応後に主効果のActionPlanを作る。対象選択後反応で行動者が倒れた場合はAP支払い前に中止し、攻撃開始反応で倒れた場合は支払い済みAPを戻さず本体効果を中止する。どちらも対象を選び直さない。`ecology/engine.test.mjs` のevent traceで、対象選択後反応が攻撃開始反応より先に解決すること、開始時の強化が最初のdamageへ反映されること、先行候補がRP不足なら次候補が発動すること、攻撃者撃破時に主damageが発生しないことを固定する。`action_started` ではpending-action専用の対象変更・取消し効果を拒否する。
- [x] 対象変更と攻撃開始反応の後、ActionPlan固定前に `action_targets_expanding` を接続する。単体直接攻撃だけがこの窓へ進み、`add_action_damage` の実対象・正量を支払い前に確認する。各人物の優先列から最初に成立する副対象追加一つを選び、主対象と重なる相手を除いた追加damage片を元のActionPlanへ登録する。主効果列の後に標準damage処理で解決し、重複なしの予定対象数と後続不発をevent traceで固定した。振り幅・貫通・炸裂筒など個別技能のregistry定義は後続の技能移植で追加する。
- [x] Stage 2fで `action_hits_expanding` と `add_action_hit` を追加し、候補のhit数・威力をRP支払い前に固定してからActionPlanへ統合する。合計hit上限による優先列fallback、基礎hit数と計画hit数の記録、対象の途中撃破で追加hitを再配分しないことを `ecology/engine.test.mjs` で確認する。
- [x] 各damage instanceの防御・HP結果後にafter queueをdrainし、`barrier_broken`後の反応と、その反応が作るcounter・状態付与を次の予定hit前に完了する。再帰drainで現在のrule効果を中断しないこと、後続hitだけが新状態を読むことを `ecology/engine.test.mjs` のevent traceで確認する。
- [ ] action effectが発生させたafter反応を `action_resolved` より先に完了し、そのイベント固有のafter反応をaction end処理として最後に行う。順序をevent traceで固定する。
- [x] PR #295のActionPlan基礎でPR #293の単独の効果単位計画を包含し、PR #293をsupersededとして閉じた。別系統の計画は並行して残さない。

次はaction effectのafter反応と `action_resolved` の境界を固定してStage 2を閉じる。各段階は共通engineのevent traceで固定し、previewとreplayは同じsimulation経路を保つ。
