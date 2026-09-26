# Stage 5 — 本編runtime切替

更新日: 2026-09-26  
状態: Stage 5aのruntime registry境界、Stage 5bのゴウ4節、Stage 5cのツグミ4節、Stage 5dのナギ4節、Stage 5eのヒバナ鉤縄・双刃R/A1をPRスタックで実装中。初期20節の16節がruntime定義済みで、本編切替は未完了。

## 現状と目的

Stage 0〜3ではカタログ由来の190節、敵技能registry分離、解決順とActionPlan、武器技能の取得・loadout・pack・save契約をdevに用意した。Stage 4では同じ190節を表示する技能画面、固定fixtureのloadout / 取得予約画面、engine未接続の予測表示を独立ページへ作った。Stage 4の最終スタック #312 → #313 → #316 → #317 → #318 はdevへ統合済みで、現行ゲームの取得・保存・戦闘はまだ旧player runtimeを使う。

Stage 5の目的は、新しい武器技能を本編の取得・編成・戦闘・予測・replayへ通し、最後に置き換え済みの旧player技能経路を撤去すること。Stage 4のfixtureを本物のrun stateへ接続するだけでは完了としない。未実装の節が取得可能または実戦で動くように見える状態も作らない。

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
5. **Stage 5g — 新stateからBattleInputを構築。** run・formation・装備・Manifest・取得済み技能・loadoutを検証し、同じengine bundleへ接続する。予測と本番で入力と結果が一致する境界を固定する。
6. **Stage 5h — 本編UI・保存接続。** Stage 4で整えた表示を実run stateへ接続し、初期技能、取得、予約、主軸、リアクティブ／ターゲット優先列を保存・再読込する。表示される操作は本編で有効な挙動と対応させる。
7. **Stage 5i — 本編切替と旧経路撤去。** 新規runの作成から戦闘・予測・replay・セーブ再開までを切り替える。旧player技能registry、旧skill tree / level / skill pack参照は置換範囲の検査後に削除する。敵registryは維持する。

## Stage 5完了条件

- 初期20節が仕様どおり実行でき、残り170節は取得・予約・装備・戦闘入力のどこにも漏れない。
- runから作ったlive battleとforecastが同じengine pathを使い、同じ入力・seedで結果とevent列が一致する。
- save / reload後もManifest、取得済みnode、loadout、編成、状態が保持され、二重報酬や旧versionの読み替えがない。
- replay表示が新node keyの技能名と結果を説明できる。
- 画面smoke、チュートリアルtrial、遠征trialを通す。画面変更は390px前後のbranch previewを確認し、実行不能なら理由を記録する。
- dependency ledger、GAME.md、ARCHITECTURE.mdを現在形へ更新し、旧player経路のimport・ID・保存参照を残さない。
