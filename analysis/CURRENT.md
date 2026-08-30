# 現在地 — 新しいエージェント向け短縮版

更新日: 2026-08-29（UTC）
対象: main、PR #49（EXP-18 一周可能試作）、R6長期進行設計

## 1. 結論

まだ、作者が内容を知った後も再プレイしたいゲームは証明できていません。
局所的な発見や学習は何度か観測できましたが、持続する「次の一手」には至っていません。

直近のSCRAPLINE 0.7では、7区画を完走した作者ランでもfun 1/5・replay 1/5、
「始終なにもわからん」という評価でした。完走可能性・イベント数・複数の機械的な勝ち筋は、
面白さの証拠になっていません。

その後の設計レビューで、三拍・敵別の正解・完成コンボを先に作る方式を棄却しました。
現在の未検証仮説は、少人数の永続キャラクターへ汎用技能・装備を付け、
単独でも働く小規則が共通イベントを介して設計者未列挙の相互作用を作る
「創発的ルール生態系」です。

## 2. 現在の実装

- 既定入口: /play/ — SKIP 0.4 / laws-0.5。比較基準として維持。
- 最新の公開試作: /scrapline/ — SCRAPLINE 0.7 / scrapline-build-20260829-r12。不採択。
- EXP-18 frontier/: R1の三拍参照コア。決定性と因果イベントの教材であり、本編コアとしては棄却。
- ecology/: EXP-18 R5の決定的ルールエンジン。実装済みでGate A〜F通過。UI・公開・D1・人間テストは持たない。面白さは証明していない。

ルール版、build、schema、対象commitを混ぜずに扱います。

## 3. 最新の一次観測

SCRAPLINE 0.7の作者プレイでは、2件の敗北と1件のクリアが記録されています。

- 敗北ラン: 第2〜3区画で終了、fun 2/5が2件。先回り、後ろに回り込む、残骸、戻った弾、車両を奪うなどの説明が理解されませんでした。
- クリアラン: 7/7到達、fun 1/5・replay 1/5。「溶解ゲーか？」「始終なにもわからん」。
- D1にはイベント列・提示候補・選択・移動・途中終了・感情マーカーが保存されました。主問題は測定不足ではなく、因果提示とゲームモデルです。

詳細は analysis/SCRAPLINE_D1_PLAYTEST_20260829.md と analysis/SCRAPLINE_D1_PLAYTEST_20260829_CLEAR.md。

EXP-18 R2〜R5は、この観測後の設計仮説と実装委譲票です。作者プレイ結果ではありません。

## 4. 次にすること

EXP-18の決定的ルールエンジンはmainへ入り、監査で見つかったstalemate、防壁提案、量変更記録、装備修理、同一装備重複の穴も修正済みです。

PR #49は、8人から4人を選び、24技能、18装備、7区画を一周するUIまで実装したdraftです。これは「編成→技能・装備→決定的自動戦闘→報酬」が一画面系としてつながるかを確認する試作で、長期バランスや面白さはまだ人間評価されていません。

作者の最新判断は、有限遠征、runごとの技能集合、手続き生成装備、永続Blueprintを組み合わせる長期構造を「かなり面白そう」とし、特に「奇跡のようなアイテムを手に入れた嬉しさを永久保存しつつ、持込数を厳しく制限するBlueprint」を支持しています。

次の設計票は
[R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS](experiments/exp-18/R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS.md)
です。R6は次を固定します。

1. 人物・Blueprint・図鑑・活動資金・購入済み投資・微小な人物鍛錬は永続、技能点・遠征技能・生成装備・補給はrun終了でreset。
2. 一遠征3幕12戦、4・8・12戦目をbossとする。
3. 遠征ごとに使用可能SkillPack、affix family、敵family、boss lawを提示する。
4. 生成装備はrarityに応じて複数の完結ruleを持て、exact Blueprintとして勝利時2件、敗北時1件保存できる。
5. 遠征結果を100倍単位の「活動資金」として敗北時にも持ち帰り、Blueprint枠、補給、技能、装備、人物、目利きへ投資する。
6. Blueprint持込枠は1から最大5へ、4,000 / 20,000 / 100,000 / 500,000で購入する。難易度だけは一つ前のclearで順番に解禁する。
7. 戦闘の連続量は現行のおよそ10倍へ移し、未強化maxHp 160〜300、主要parameter 100以下を通常帯とする。AP、RP、hit数、round等は小整数のままにし、effect確定時だけround-half-upする。
8. 人物ごとのmight / focus / guard / vitality鍛錬は一段+0.1%、費用は `2,000 + 100 × floor(level / 10)` の段階的線形、上限なし。敵は持込Blueprintや鍛錬へ隠れて追従しない。
9. 味方5人を2×3の六枠へ置き、一枠を空けて前3後2または前2後3を選ぶ。敵も最大5体。
10. skill枠は基本3 active / 3 reactive / 2 passive、人物別投資で最大4 / 4 / 2。basic strikeとsignatureは別枠。能力passive七種を常設し、選択率と他候補を技能設計の診断へ使う。
11. 全人物は通常攻撃を常備し、純支援技能後は半威力追撃を行う。攻撃差はguard / block / barrier、単発 / 多段、範囲、貫通、位置、riskで作る。属性相性、命中回避、物理魔法別防御は初期coreへ入れない。
12. 完成形はPhase A戦闘、B遠征と活動資金、C生成装備とBlueprint、D長期拡張へ分ける。まずPR #49の7戦・固定報酬・固定装備を残してPhase Aだけを実装し、作者評価前に次段階やcontentを先行実装しない。

R6の文書完成は面白さの証明ではありません。最初はPhase Aのparameter、五人formation、skill枠、攻撃・防御文法だけを実装し、作者が1〜2遠征で差を説明・利用できた場合だけPhase Bへ進みます。

systemとcontentの実装順序は
[R7_IMPLEMENTATION_SEQUENCE_AND_PARALLEL_CONTENT_EXPANSION](experiments/exp-18/R7_IMPLEMENTATION_SEQUENCE_AND_PARALLEL_CONTENT_EXPANSION.md)
を正とします。未来の全systemを先に作らず、content file分離とversioned contractを先に固定します。Phase A作者支持後に小さな技能・敵・固定装備probeを追加し、Phase B以降は既存語彙のcontentだけをsystem実装と並列可能にします。procedural affixと複数rule装備はPhase C契約後です。現行の一実装担当制は変更していません。

## 5. 現在の設計上の不変条件

- 機体・ガラクタではなく、永続する人物を愛着の主語にする。
- 好きな人物へ、広く技能と装備を付け替えられる。
- 人名指定、固有相方指定の完成コンボを主食にしない。
- 一要素は局所的に読めるが、全組み合わせを設計者も列挙しない。
- 戦闘は決定的で、驚いた後に因果を理解できる。
- 勝敗だけでなく、損傷、消耗、速度、資源温存を結果に残す。
- 新規則が旧人物・旧技能・旧装備の意味を変えられるイベント履歴を持つ。
- 機械検査は破綻の足切りに使い、fun判定には使わない。
- 技能は手作業で一般的な採用理由を保証し、装備は完全生成の偶然性を担う。
- 戦闘進行に必要な攻撃はloadout強制ではなく、通常攻撃と支援後の半威力追撃で保証する。
- 永続鍛錬は微小・段階的線形費用に限り、might、focus、guard、maxHpだけを上げ、speed、AP、RP、発火回数を上げない。費用は対象人物・能力数と100〜1,000時間の到達目標から検証する。
- 戦闘の連続量は三桁の可読性を優先して現行のおよそ10倍へ移し、hit数、resource、round、durabilityは小整数に保つ。
- 五人編成とskill枠増加は組み合わせ空間を広げるが、RPと発火limitで反応量を制御する。常設能力passiveは安全弁であり、その選択率を候補品質の診断に使う。
- 攻撃技能を係数違いだけにせず、共通防御面・範囲・位置・代償のいずれかで評価を変える。

一般化した設計知見は
[research/emergent_rule_ecology_and_extensible_game_design.md](../research/emergent_rule_ecology_and_extensible_game_design.md)
に分離しています。

## 6. 証拠の読み方

- 作者の自由記述・感情マーカー・実際の行動列
- D1/exportの完了ランと表示版
- 再現可能な機械検査・構造ゲート
- エージェント評価・勝率・探索数
- 実装者の意図

上ほど強い証拠です。機械検査が落ちた場合は、設計の失敗か測定の失敗かを分け、
未成立の条件から方向全体を否定しません。

## 7. 必ず読むもの

1. AGENTS.md
2. PROJECT_MEMORY.md
3. docs/REPOSITORY_MAP.md
4. この文書
5. analysis/EXPERIMENT_LEDGER.md
6. EXP-18 R5
7. 実装後はA5_RULE_ENGINE/のPREFLIGHT、TRACEABILITY、RESULT
