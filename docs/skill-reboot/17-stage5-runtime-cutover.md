# Stage 5 — 本編runtime切替

更新日: 2026-09-27
状態: Stage 5a〜5gはPR #331まで。5h/5iの本編接続・切替は現在のローカル変更で実装済みだが、390×844のブラウザ試行は環境のChromiumクラッシュで未確認。

## 現状と目的

Stage 0〜3でカタログ由来の190節、敵技能registry分離、解決順とActionPlan、新武器技能の取得・loadout・pack・save契約を用意した。Stage 4の独立fixture UIは、Stage 5で実Runへ接続する前の試作として完了した。Stage 5a〜5gのPR #331までは初期20節のruntimeとBattleInput builderを追加し、5h/5iでは本編Run、画面、保存、preview / replayを同じruntimeへ切り替える。

Stage 5の目的は、新しい武器技能を本編の取得・編成・戦闘・予測・replayへ通し、置き換えた旧player技能経路を本編UI・保存・BattleInputから外すこと。Stage 4のfixtureを本物のrun stateへ接続するだけでは完了としない。未実装の節が取得可能または実戦で動くように見える状態も作らない。

## Stage 5の最初のプレイ可能範囲

最初の完全な縦切りは、5人の代表武器2つずつにあるRとA1、計20節とする。これは初期loadoutの20節と一致する。

| 人物 | 武器 | 最初に持つ節 |
|---|---|---|
| ゴウ | warhammer / gauntlets | 各R・A1 |
| ツグミ | launcher / medical_kit | 各R・A1 |
| ナギ | tower_shield / long_spear | 各R・A1 |
| ヒバナ | grappling_hook / dual_blades | 各R・A1 |
| ゲンゾウ | banner / heavy_crossbow | 各R・A1 |

この範囲のA1は、カタログ上9つのパッシブと医療具A1のリアクティブで構成される。技能の種別・意味はweapon catalogの位置と実装契約に従い、PR #288由来の旧IDや未監査の旧定義から推定しない。残り170節をStage 5へ紛れ込ませない。

## 必須境界

- 新しい技能の保存・loadout上の識別子はweaponIdとpositionからなるnode keyを使う。engineのskill IDが必要なら、妥当なengine IDへの変換は一か所に集め、衝突・逆変換不能を拒否する。
- executableなplayer skill registryを明示し、カタログ情報だけの節を実装済みとして扱わない。未実装節は取得、予約、装備、BattleInput生成の全てで拒否する。
- 初期20節の効果はカタログと解決順監査に照合する。位置選択、対象、基礎hit数、反応窓、資源支払、強化・状態適用を確定する順は共通engine規則に従う。
- new Profile / Run、Manifest、取得済みnode、loadoutからBattleInputを作る。live battleとforecastが別の効果実装を持たず、同じcontent bundleとsimulateBattleを通る。
- replayは同じ確定済みevent列とnode keyを記録し、旧skill IDや技能level mapを参照しない。武器技能に個別levelは追加しない。
- 敵技能registryはplayer registryと分離したままにする。移行の都合で敵の実使用技能を旧player registryへ戻さない。
- 旧Profile / Runは自動移行しない。新しいsave versionと合わない既存データは既定の方針どおり拒否する。
- 本編切替は、初期20のruntime・BattleInput・UI・save / reload・preview / replayが揃ってから行う。切替PRで旧player tree / level / pack / runtime参照を同時に撤去し、片方の経路だけが残る中間状態を作らない。

## 小さく進めるPR順

各PRはdevへ積み、コード変更のPRには実際に追加した利用者向け挙動と、対応するリスクの検証だけを含める。

1. **Stage 5a — runtime registry境界。** node keyとengine skill IDの変換、executable nodeの登録、Manifestで解禁されたpackから取得可能nodeを導き、実装済みregistryとの交差だけを取得可能にする。初期20以外を実行可能と見なさない検査を加える。
2. **Stage 5b — ゴウの初期4節。** 戦槌・格闘具のR / A1を新runtime IDで登録し、既存の共通engine bundleへ投影して戦闘イベントで検証する。hit番号ごとのパッシブは該当する一撃だけに発火する。
3. **Stage 5c — ツグミの初期4節。** 射出器・医療具のR / A1を新runtime IDで登録し、遠隔初撃、低HP割合への防壁、医療具A1の被弾後回復と実損失上限をイベント列で検証する。
4. **Stage 5d〜5f — ナギ、ヒバナ、ゲンゾウの初期12節。** 各人物の代表武器R / A1を小PRで追加し、初期20節すべての定義を共通engineで確かめる。
5. **Stage 5g — 新stateからBattleInputを構築。** run・formation・装備・Manifest・取得済み技能・loadoutを検証し、同じengine bundleへ接続する。予測と本番で入力と結果が一致する境界を固定する。Run v2はformation、装備instanceと耐久、人物ごとの現在HPを保存する。
6. **Stage 5h — 本編UI・保存接続。** 実Runに初期取得・取得・予約・主軸・反応優先列を接続し、Stage 1以降は長押しで必殺を選ぶ。weapon Profile / Run v4と本編storageへ保存する。**実装済み。**
7. **Stage 5i — 本編切替と旧経路撤去。** 新規Run、live / forecast、Replay、セーブ再開をweapon Runへ切り替え、初期20以外の表示・取得・BattleInputを閉じる。アプリから旧player tree / level / pack / runtimeの依存を除く。敵registryは維持する。**実装済み。**

## Stage 5の実装確認

- [x] 初期20節の共通BattleInput runtime、5人の節別event tests、未実装nodeの拒否。
- [x] 本番とforecastが同じbuilder・engine pathを使い、同じ入力・seedで結果とevent列が一致する。
- [x] weapon Run v4の厳密なsave / reload。取得・予約・loadout・編成・現在HP・必殺台帳を検証する。
- [x] Replayがruntime IDをnode keyへ戻して技能名を表示する。
- [x] 画面smoke、Stage5取得・予約・長押し必殺・Stage 1のTutorial trialを書き換えた。
- [ ] 390×844のブラウザtrialを実行する。ローカルChromiumは起動直後にSIGSEGVとなり、Cloud Chromeもlocalhost接続をERR_BLOCKED_BY_CLIENTで拒否したため、この環境では視覚確認できていない。
- [x] dependency ledger、GAME.md、ARCHITECTURE.mdをStage5切替後の現在形へ更新。
