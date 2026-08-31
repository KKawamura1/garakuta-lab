# EXP-18 R8 — 固定難易度・コンボ・遠征損耗の統合実装設計

作成日: 2026-08-31（UTC）  
更新日: 2026-08-31（UTC。固定ラダー、数値成長、攻撃パック、HP持越し、有限治療、結果開示を一文書へ統合）  
対象: EXP-18 Phase B完了後から、D0〜D20・Phase C・Endlessまでの今後の実装  
状態: 設計提案。コード変更・作者プレイによる支持はまだない。  
履歴資料: [R4 創発的ルール生態系](./R4_EMERGENT_RULE_ECOLOGY_AND_LONG_TERM_EXPANSION.md)、[R6 長期進行](./R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS.md)、[R7 実装順序](./R7_IMPLEMENTATION_SEQUENCE_AND_PARALLEL_CONTENT_EXPANSION.md)、[A9 Phase B実装結果](./A9_PHASE_B/RESULT.md)。これらを読まなくても、ここからの仕様変更・実装順・受入条件を本票だけで判断できることを目的とする。

## 0. 訂正と結論

### 0.1 この文書で使うP / Nの定義

回復について、作者が提示した二つの軸を次のように定義する。

| 記号 | 定義 |
|---|---|
| **P1** | 回復技能を現在の形で実装する。roundごとに戻るAP / RP等を使い、戦闘中に過去のHP損傷を繰り返し回復できる |
| **N1** | 回復という行為自体を実質的に消滅させる。回復役、回復技能、回復eventを通常の構築語彙にしない |
| **P2** | 戦闘終了時に生存者のHPを毎回全回復し、次戦を満タンで始める |
| **N2** | 通常戦終了時には全回復せず、HP損傷を次戦へ持ち越す。回復は拠点または有限な補給等へ絞る |

現在の実装は **P1 + P2** である。P2は、「P1なら勝利確定後に最後の敵を残して全快するのが当然になるため、最初から戦闘終了時に全回復したことにする」という整理で導入された。

本票はP1 / N1の二択をそのまま採用しない。第三案を次のように定義する。

| 記号 | 定義 |
|---|---|
| **B1: 有限治療** | 自由回復は廃止するが、回復役は残す。被弾直後の応急処置、補給治療、遠征中に戻らないcharge、損傷予防・集中・転嫁として実装する |

**統合判断は B1 + N2** とする。元の二択へ無理に戻せば「自由回復についてはN1、遠征HPについてはN2」だが、回復eventとヒーラー構築まで消す文字どおりのN1ではない。

### 0.2 現在地

R6 / R7に基づくMilestone 0、Phase A、Phase Bのコードは実装済みである。ただし作者はPhase A / Bをまだプレイしておらず、R7が要求した作者Gateを飛ばしている。したがって、実装済みは「動く」の証拠であり、「面白い」「この方向を支持した」の証拠ではない。

| 領域 | 現在 | この文書での扱い |
|---|---|---|
| content file分離・schema・validator | 実装済み | 維持し、以後のhard contractにする |
| 5人・2×3・技能枠・攻撃文法 | Phase Aで実装済み | D0〜D3作者Gateで遡って評価する |
| Profile / Run分離、12戦、活動資金、補給、rank 0〜5 | Phase Bで実装済み | 基盤を維持し、manifest・HP・補給用途を本票へmigrationする |
| manifest | seedが4パック中3つを選ぶ | rankごとの新1＋固定過去packへ置換する |
| HP / 回復 | P1 + P2 | B1 + N2へ置換する |
| 難易度 | rank 0〜5の旧modifier | 固定pack、固定数値、想定周回帯を持つscenarioへ置換する |
| 生成装備・Blueprint・目利き | 未実装 | D0〜D3作者Gate後のPhase Cで実装する |
| Difficulty 6〜20・endless | 未実装 | D0〜D6の語彙支持後に拡張する |

この文書を、ここから先のEXP-18の設計・実装順・受入条件の正本とする。R6 / R7は履歴と詳細根拠として残すが、矛盾時は本票を優先する。

初版R8は、現在の4パックから2つを選ぶ全6組を難易度0〜5へ割り当てた。これは難易度ごとの差を大きくする一方で、**難易度を進めるたびに新しい語彙が積み上がり、その新語彙によって昔の技能が見え直す**という作者の狙いを失っていた。難易度ごとに世界を交換するだけでは、知識の蓄積ではなく別問題へのリセットになる。

初版を撤回し、次を採用する。

1. 難易度が一つ進むたび、**その難易度で初登場する新パックを必ず一つ追加**する。
2. 新パックに加え、過去に登場したパックからいくつかを設計者が事前固定で選ぶ。
3. 有効パック数は難易度0〜6で `1, 2, 2, 3, 3, 4, 4` と徐々に増やす。
4. 過去パックを全て累積させず、一度外したパックを後の難易度で再登場させる。再登場時、新パックとの接続によって昔の技能の評価を変える。
5. 難しさは敵の強さだけでなく、使える語彙と接続候補が増え、構築空間を読む必要が増すことからも生む。
6. パック構成はcampaignでは難易度ごとに固定する。seedは敵順、報酬、装備roll等へ使い、パック選択には使わない。
7. 各新パックには、選ばれた過去パックとの設計された接続面を最低2本置く。ただし完成レシピを一つに閉じず、代替部品と未知の高次コンボを残す。
8. 難易度が上がるほど、設計済みの二者接続に加えて、設計者が全て列挙しない三者・四者接続が生まれるようにする。
9. パック増加とギルドの累積強化によって理想buildの上限が上がるため、敵の固定数値もrankごとに大きく上げる。複雑性を数値上昇の代わりにしない。
10. 平均的なプレイヤーは、前rankを2〜5遠征ほど再訪して活動資金・人物鍛錬・Blueprint・知見を蓄えた後に次rankを突破する強さを狙う。
11. 優れた未知コンボは必要周回を短縮し、過剰鍛錬は最終的に素朴な構成でも突破を可能にする。知識と永続成長の両方を正当な攻略経路にする。
12. `刃と撃破`だけに爽快感を担わせない。全manifestにprimary offenseまたは明確なoffensive hybridを最低1パック含め、primary offense packを少なくとも3rankに1回は新規導入する。
13. Phase Cの生成装備へ進む前に、まず難易度0〜3で「昔の技能が新パックによって見え直すこと」と「E不在でも攻撃の主役があること」を人間評価する。
14. 通常戦・精鋭戦後の全回復を撤回し、HPを次戦へ持ち越す。4戦目・8戦目のboss後だけ拠点で全回復する。
15. roundごとに戻るAP / RPだけで古い損傷を自由回復する技能は撤廃する。ただし回復役を消さず、被弾直後の応急処置、補給治療、遠征中に戻らない有限charge、予防・転嫁へ再設計する。
16. 次戦の正確な勝敗・終了HP・消費資源・主要chainを事前表示し、見えない結果の手計算ではなく、有限補給の配分と構築を難しさにする。

この構造なら、序盤は設計された手応えを持ち、後半は過去資産の組合せが増えて開発者も知らないコンボが生まれる。HP損傷も4戦区間の資源として残るため、強いコンボは勝敗だけでなく補給余力と撤退判断へ返る。

## 1. 現状の問題

### 1.1 コンボがあっても、単体強化との差が小さい

現行contentには大溜め、急かす、準備の螺旋、撃破時AP、余剰治療等の接続候補がある。しかし作者構成の実測は、最良の素朴な役割配分に対して約1.09倍である。

- 条件をつなげても、「同じ一発を早める」「小さい量を足す」だけになりやすい。
- 仕込みに使うAP、RP、人物、技能枠に対する利得が小さい。
- activeは条件不成立ならskipするため、広く強い技能を下位まで埋めることが弱くなりにくい。
- 固定装備には同じruleで耐久だけが違う系列があり、接続の選択より強い版の比較になりやすい。
- 現在のパックは分類箱としては機能するが、他パックのeventをどう読み替えるかが十分設計されていない。

敵を強くするだけでは、単体構成とコンボ構成が同率で苦しくなる。必要なのは、コンボ側の超過利得と、難易度ごとの構築問題の変化である。

### 1.2 現在のランダム3/4パックでは学習順を設計できない

`PACKS_PER_MANIFEST = 3` かつ全4パックなので、遠征ごとの差は「一系統だけ欠ける」4通りである。

- 75%の語彙が毎回残り、難易度が変わっても同じ汎用構成を使いやすい。
- 新しいパックの導入順が無い。
- 敵、報酬、boss lawを「この新しいeventを学ぶ段階」に合わせられない。
- 過去の技能が後のパックで別の価値を持つ瞬間を設計できない。

乱数が必要なのは、学ぶ文法そのものではなく、**固定された文法の中でどの部品がいつ来るか**である。

## 2. 目標体験

難易度を一つ進めたとき、プレイヤーに次が起きる。

1. 新パックの共通動詞を理解する。
2. 今回一緒に選ばれた過去パックを見て、以前使った技能を思い出す。
3. 「前は単体で使っていた技能が、新パックのこのruleの入力または利得先になる」と予想する。
4. 単体で強い技能を役割ごとに並べた構成では、序盤は進めてもbossを安定して越えられない。
5. 新旧パックをまたぐevent chainを作ると、仕込みに見合う大きな結果が返る。
6. 戦闘後に「以前は○○だった技能を、今回は△△のために使った」と説明できる。
7. さらに三つ以上のパックが有効な難易度では、設計者が用意した二者接続を越えて、自分だけの高次コンボを探す。
8. 初回挑戦では数値的に押し切られ、「前rankであと何を試し、何を育てるか」が見える。
9. 前rankの周回で活動資金・Blueprint・人物鍛錬と実戦知識を得て再挑戦する。
10. 強いコンボを発見すれば想定周回数より早く突破でき、構築知識が実質的な経験値として働く。

プレイヤーが覚えるのは完成レシピではない。`何が発生し、何がそれを読み、何へ変わるか`という共通文法である。

## 3. 長期完成形と状態・経済・戦闘の基礎契約

### 3.1 不変条件

- 人物は永続し、遠征ごとに消えない。愛着の主語は人物、偶然性の主語は装備にする。
- 同じ入力、seed、content / generator versionから同じ完全なevent列を返す。
- 人物名、特定skill ID、特定equipment IDをコンボ条件としてengineへ埋め込まない。
- 新要素は共有event、predicate、cost、effect、target relationで接続する。
- player profileに応じた不可視の敵補正を行わない。強いBlueprintや鍛錬は実際に強くする。
- 難易度だけは一つ前のrank clearで順に解禁し、活動資金で買えず、飛ばせない。
- 機械検査は決定性、破綻、発火不能、支配性候補を検出する。funの証明には使わない。
- 一度公開したID・event・effect・targetの意味を黙って変更しない。変更はversionとmigrationを持つ。
- 戦闘値は整数で表示し、effect確定時にround-half-upする。AP、RP、hit数、block回数、round、chargeは小整数を保つ。
- 通常行動には攻撃手段を保証する。技能未装備・全skill skip時は通常攻撃、純支援active解決後は威力50%の追撃を行う。明示された準備だけを例外にする。

### 3.2 三層の状態

| 層 | 永続期間 | 主な内容 |
|---|---|---|
| ProfileState | 全遠征をまたぐ | 人物、活動資金、購入済み投資、人物鍛錬、Blueprint archive、図鑑、最高clear rank、解禁content、schema version |
| RunState | 一遠征 | manifest、難易度、12戦進行、現在HP、補給、5人、formation、run技能点・技能、生成装備inventory、持込Blueprint、仮計上資金、結果 |
| BattleState | 一戦 | actor、AP / RP、barrier / block、準備、status、装備耐久、event queue、被弾chain、開始HP snapshot、preview / commit状態 |

Profileへ永続するもの:

- 人物と解禁済み人物。
- 活動資金、購入履歴、有限meta upgrade。
- 人物別might / focus / guard / vitality鍛錬。
- Blueprint archiveとfavorite / origin。
- 図鑑、発見済みevent path、最高clear rank、endless記録。

遠征終了で消えるもの:

- run技能点、run中に解禁した技能。
- 生成装備の実物。選んだものだけBlueprintとして保存する。
- 補給、scrap、治療charge、現在HP、遠征内状態。
- encounter順、報酬offer、仮の構成履歴。

### 3.3 一遠征

- 3幕、合計12戦。4 / 8 / 12戦目をbossとする。
- 8人以上の永続rosterから5人を選び、2×3の六枠へ一枠空けて配置する。
- 通常・精鋭戦後はHPを持ち越し、4 / 8戦目boss後だけ拠点で全回復する。
- 各戦闘前後で保存し、iPhone上で別sessionへまたいで再開できる。
- 遠征開始前に新pack、固定の過去pack、enemy family、三体のboss law、region law、報酬規則、難易度数値、想定ギルド強化帯を表示する。
- 敵個体、位置、mutationは現在戦闘分を常に表示し、補給による偵察は次幕を早期開示する。
- 通常戦勝利後は4候補から一つ選ぶ。完成形では生成装備2、人物一人のrun技能点+2、補給+1を基本とする。
- 精鋭・bossは装備rarity tableを上げ、bossは遠征中だけの技能またはsignature変異を候補にできる。
- inventoryは装備中を含め12品。13品目取得時は一品を分解するか新報酬を捨てる。scrap 2で補給1へ変換する。

### 3.4 人物parameter、技能枠、攻撃差

- 基礎parameterはmaxHp、might、focus、guard、speed、AP、RP。
- 未強化の低rank基準はmaxHp 160〜300、might / focus / guard 100以下。高rankは4桁以上を許容する。
- 基本装着枠は3 active / 3 reactive / 2 passive。活動資金で人物ごとにactive / reactiveを最大4へ増やせる。
- activeは短い使用条件とpriorityを持ち、条件不成立ならskipする。全てskipなら通常攻撃を行う。
- 攻撃はbasic / heavy / rapid / pierce / row / columnを最低限区別する。
- guardは一hitごとの固定軽減、blockはhit単位の無効回数、barrierは総量吸収とし、解決順を固定する。
- 人物固有性は専用完成コンボではなく、parameter、初期技能、signature、得意な共有eventの角度で作る。
- 常設fallback passiveは「今回欲しい技能が来なかった」安全弁とし、取得率が高すぎる場合は技能poolの診断信号にする。

### 3.5 手続き生成装備

Phase Cで、装備を技能とは異なる偶然の副構築として実装する。

一つの完結ruleは `trigger -> condition 0〜2 -> cost 0〜1 -> effect 1〜2 -> limit -> durability / charge` から成る。不完全なtriggerだけ、effectだけ、発火不能、無料無限循環を生成しない。

| rarity | 完結rule数 | 総affix目安 | total power budget |
|---|---:|---:|---:|
| common | 1 | 1〜2 | 2 |
| rare | 1〜2 | 2〜4 | 4 |
| epic | 2〜3 | 4〜7 | 7 |
| legendary | 3〜4 + keystone 0〜1 | 6〜10 | 10 |

- 複数ruleでもitem全体のpower budgetは一つとし、rule数倍しない。
- 高rarityは確定上位互換ではなく、複数文脈または大きな代償を持つ品にする。
- 各ruleは単独で発火できるが、偶然rule間が接続することを許す。
- seed、drop index、generator version、resolved parameter、originを保存し、同じ入力から同じ品を作る。
- 50 attemptで生成不能なら既定品へ黙ってfallbackせず、診断errorにする。
- 技能は意図して選ぶ主構築、装備は現在構成を壊して再評価させる副構築にする。

### 3.6 Blueprint

- 遠征終了時に生成装備のcanonical descriptor、全rule、resolved parameter、rarity、来歴をexactに保存する。
- Blueprintはimmutable。同じdescriptorは重複品にせず取得履歴を追加できる。
- archive自体に所持上限を設けず、検索、filter、favorite、人物、地域、affix familyを持つ。
- 遠征開始時、carry capacity以内のBlueprintを一品ずつexact copyとして再製造する。
- manifest外のaffix familyでも持込品は有効。敵は持込品を見て強くならない。
- 初期capacity 1、最大5。追加slot費用は4,000 / 20,000 / 100,000 / 500,000。
- 遠征勝利は最大2件、安全撤退はそのrunの新規取得候補から最大2件、敗北は最大1件を保存する。
- 互換不能な古いBlueprintを削除せず、disabledReasonを表示する。

### 3.7 活動資金と永続投資

活動資金はrun中にProfileへ直接加算せず、ledgerへ仮計上し、勝利・安全撤退・敗北時に一度だけ精算する。retryしても同じencounterの撃破baseは一度だけにする。

| 確定結果 | base |
|---|---:|
| 通常戦初回撃破 | 100 |
| 精鋭戦初回撃破 | 180 |
| boss初回撃破 | 320 |
| 到達距離 | clear済み戦闘数 × 25 |
| 12戦完走 | 600 |
| 地域・rank初回clear | 800 + rank × 100 |

~~~ts
difficultyMultiplierBps = 10_000 + difficultyRank * 1_000;
activityFundsEarned = floor(baseTotal * difficultyMultiplierBps / 10_000);
~~~

敗北でも確定済み資金を持ち帰る。高rankほど時間効率を良くし、低rank farmを禁止せず、最高到達rankの周回を恒常的に下回らせない。

| 投資 | 初期仕様 |
|---|---|
| Blueprint持込枠 | 4,000 / 20,000 / 100,000 / 500,000 |
| 開始補給 | 3→4は12,000、4→5は60,000。上限5 |
| SkillPack | 一pack 3,000〜30,000。campaign rank必須packはrank解禁時に自動使用可能。購入対象は任意のside pack、Free / Endless pool、variantで、全manifestへ自動追加しない |
| 装備基材 / affix family | 一群2,000〜20,000 |
| 新人物 / signature | 一件10,000〜50,000 |
| 目利き | 15,000 / 45,000 / 120,000 / 300,000 / 750,000 |
| active / reactive第4枠 | 人物ごとに30,000 / 60,000 |
| 人物鍛錬 | might / focus / guard / vitalityを人物別・上限なし |

人物鍛錬は一levelにつきbase stat +10bps（+0.1%）。speed、AP、RP、slot、発火回数は上げない。常にbaseへ合計倍率を掛け、購入順による複利差を作らない。

~~~ts
cost = 2_000n + 100n * (level / 10n);
trainedStat = roundHalfUp(baseStat * (10_000 + 10 * level) / 10_000);
~~~

### 3.8 敵、boss、endless

- 敵はchassis、共通rule、mutation、region lawをthreat budget内で組み合わせる。
- 最大5体、2×3内で位置重複なし。特定skillを要求するhard counterを作らない。
- mutationとboss lawは戦闘前に全て表示する。
- 各bossは固有chassis / 外見、公開law一つ、difficulty mutation 0〜2、三つ以上の対応方法を持つ。
- 難易度0で地域clear、10で正式制覇、20で設計上の最高難度完了とする。
- rank 20後にendlessを解禁し、4戦blockごとにbudget、mutation、数値倍率を上げる。
- endlessでは全buildの公平性を保証せず、数値inflationと過去rankの圧倒を許す。

### 3.9 決定性とversioning

Manifest、Encounter、Reward offer、GeneratedEquipmentInstance、compiled EquipmentDef、Blueprint descriptor、Blueprint再製造品は同じ入力でJSON深一致する。

乱数keyを用途別に分離し、reward rerollが後続敵や後続dropを変えないようにする。

~~~text
runSeed:manifest:rank
runSeed:encounter:encounterIndex
runSeed:reward:encounterIndex:rerollIndex:slot
runSeed:item:dropIndex:attempt
~~~

profile、run、battle、content、manifest、generator、Blueprintのversionを保存し、不一致を黙って読み飛ばさない。

## 4. 難易度ラダーの基本規則

### 4.1 一難易度につき新パック一つ

各難易度は必ず一つの新パックを持つ。

~~~ts
type DifficultyScenarioDef = {
  id: string;
  rank: number;
  newPackId: SkillPackId;
  returningPackIds: SkillPackId[];
  enabledPackIds: SkillPackId[];
  activePackCount: number;
  enemyFamilyIds: EnemyFamilyId[];
  actBossIds: [EnemyActorId, EnemyActorId, EnemyActorId];
  regionLawIds: string[];
  pressureTags: string[];
  learningGoals: string[];
  enemyContinuousScaleBps: number;
  threatBudgetDelta: number;
  activityFundMultiplierBps: number;
  expectedGuildPowerBandBps: [number, number];
  recommendedPriorRankRuns: [number, number];
};
~~~

不変条件:

- `newPackId`はそのrankより前のcampaignに出現していない。
- `enabledPackIds`は `newPackId` と固定の `returningPackIds` から成る。
- 同rankならseedを変えてもpack構成は変わらない。
- 新パックは必ず遠征開始画面で先頭に表示し、「今回初登場」と明示する。
- 過去パックは「再登場」と最後に使ったrankを表示する。
- campaignで初登場したパックは、clear後にFree / Endlessの選択poolへ解禁する。
- 敵scale、threat、報酬倍率、想定ギルド強化帯、想定周回数をrank定義へ固定し、player profileに応じて動的補正しない。

### 4.2 有効パック数を徐々に増やす

難易度0〜6の初期式を次とする。

~~~text
activePackCount(rank) = 1 + ceil(rank / 2)
~~~

| rank | 有効パック数 | 内訳 |
|---:|---:|---|
| 0 | 1 | 新1 + 過去0 |
| 1 | 2 | 新1 + 過去1 |
| 2 | 2 | 新1 + 過去1 |
| 3 | 3 | 新1 + 過去2 |
| 4 | 3 | 新1 + 過去2 |
| 5 | 4 | 新1 + 過去3 |
| 6 | 4 | 新1 + 過去3 |

以後も2難易度ごとに一つ増やしてよいが、局所可読性を守るため無制限には増やさない。暫定上限を6パックとし、5パック時点の作者評価で上限を再判断する。

パック数が同じ難易度でも、新パックと過去パックの組を入れ替えるため、構築問題は変わる。パック数が増える難易度では理想buildの上限も上がるため、敵数値も固定値として大きく引き上げる。**数値、永続成長、構築複雑性の三つを同時に難易度へ使う。**

### 4.3 過去パックは単純累積させない

毎回「前回の全パック＋新パック」にすると、以前の完成構成へ新しい強要素を足すだけになる。過去パックは設計者が固定選択する。

選択規則:

- 新パックが、選ばれた過去パックのeventを最低2種類読む。
- 新パックが発生させるeventを、過去パック側が最低2種類読める。
- rank 2以降、可能なら直前rankで不在だったパックを一つ再登場させる。
- 同じ完成構成を連続rankで維持できる組を避ける。
- 新パックと接続しない過去パックを、単なる選択肢数増加のために入れない。
- 全ての過去パックを均等に出す必要はないが、長期間再登場しないパックは意図と理由を記録する。

## 5. 難易度0〜6の初期構成案

`刃と撃破`だけが攻撃の主役だと、それが不在のrankは通常攻撃と支援中心になり、爽快感と構築上限が落ちる。そこでprimary offense packを定期導入し、その間を防御・tempo・care等のhybrid / support packで接続する。

- E: 刃と撃破 (`pack_edge`)
- W: 防壁と隊列 (`pack_wall`)
- T: 行動権と準備 (`pack_tempo`)
- B: 連撃と刻印（新設候補 `pack_barrage`）
- C: 手当てと余剰 (`pack_care`)
- S: 消耗と再生（新設候補 `pack_salvage`）
- R: 傷と背水（新設候補 `pack_risk`）

| 難易度 | 新パック | 種別 | 固定の過去パック | 合計 | 今回見え直すもの |
|---:|---|---|---|---:|---|
| 0 | **E 刃と撃破** | primary offense | なし | 1 | 単発・貫通・大技・撃破の基礎比較 |
| 1 | **W 防壁と隊列** | offensive hybrid | E | 2 | blockや移動が、攻撃対象・形・増幅条件になる |
| 2 | **T 行動権と準備** | offensive hybrid | E | 2 | 以前は遅いだけだった溜め攻撃が、AP / RP集中の利得先になる |
| 3 | **B 連撃と刻印** | primary offense | W + T | 3 | block、移動、AP追加が、多段・on-hit・mark連鎖の発生回数を変える |
| 4 | **C 手当てと余剰** | support / hybrid | E + B | 3 | 攻撃で生じた実damage・過剰damage・反動を、回復と再攻撃へ循環させる |
| 5 | **S 消耗と再生** | offensive hybrid | B + C + T | 4 | 多段、余剰回復、未使用資源が、装備消耗・charge・次のburstへ変わる |
| 6 | **R 傷と背水** | primary offense | W + C + S | 4 | HP減少、barrier破壊、装備摩耗を避ける対象から意図的な燃料へ変える |

primary offenseはD0、D3、D6と3rankごとに初登場する。W、T、Sも攻撃行動を最低3つ持つhybridとし、primary offense不在時でも爽快感を失わない。これは実装開始用の具体案であり、作者評価前に難易度7以降を埋めない。

### 5.1 Difficulty 0 — E: 基本の攻撃差を学ぶ

この段階ではコンボ量を増やしすぎない。

- 通常攻撃、単発、多段、貫通、行・列、準備、撃破条件の差を読む。
- 大溜めはまだ「時間を払って大きく殴る」技能として存在する。
- 止めの一突き、拾い直し等の撃破前後のeventを見せる。
- 後のパックが読むeventを、戦闘ログには既に残す。

敵はguard、block、前後列、少数の小型敵を一つずつ導入する。ここで最適な攻撃を一つに固定しない。

### 5.2 Difficulty 1 — W + E: 防御と位置が攻撃を変える

新しい見方:

- `damage_blocked` → 受け返しの集中 → 次の単発・範囲攻撃。
- 位置替え → 踏み固め／移動後集中 → 行・列・後衛狩り。
- 身代わりで攻撃対象を変え、反撃や撃破順を制御する。

以前のE技能は同じ数値のまま、敵のguard / block / positionとWのeventによって採用理由が変わる。

### 5.3 Difficulty 2 — T + E: 大溜めが機関の利得先になる

作者の狙いを最も短く検証できる段階である。

- D0の大溜めは、単体では合計4APかかる遅い大技だった。
- Tの号令、急かす、準備の螺旋、AP装備が加わる。
- 同じ大溜めが、複数人物からAP / RPを集めて短時間に放つ利得先へ変わる。
- 止めの一突き → 撃破 → 拾い直し／仕留めの鈴 → 次の行動、という別レーンも成立させる。

設計レーンは最低2本にし、「大溜めを見つけること」だけを正解にしない。

### 5.4 Difficulty 3 — B + W + T: 新しい攻撃エンジンを配信する

`刃と撃破`が不在でも、Bがprimary offenseとして戦闘の主役を担う。

新しい見方:

- 多段攻撃がblock chargeを一枚だけ剥がし、残りhitを通す。
- Wの位置替えとrow / column制御が、多段のon-hit対象数を増やす。
- TのAP追加が単純な斬撃回数ではなく、mark付与 → 多段消費 → 追撃の一連へ使われる。
- `damage_blocked`、`actor_moved`、`resource_gained`がBのhit数・対象・mark payoffへつながる。

Bの候補内容:

- 多段、splash、on-hit、mark stack、hit数に応じた小効果。
- 一発の係数はEより低いが、event発生回数と対象数で高い天井を持つ。
- guardには弱くblockには強い等、Eの単なる上位互換にしない。

ここで「Eが無いと爽快感が無い」を人間評価する。Bの連鎖が見た目・ログ・撃破テンポで別種の爽快感を作れなければ、support packを増やす前に攻撃contentを直す。

### 5.5 Difficulty 4 — C + E + B: 攻撃と治療を往復させる

primary offenseをEとBの二つ置き、Cがその結果を別の攻撃機会へ戻す。

新しい見方:

- Eの単発大damageとBの多段damageで、治療資源を使う対象・時点を変える。
- recoilまたは被弾集中で同一被弾chain内の応急処置条件を作り、有限治療の余剰を別人物へ回す。
- `healing_applied` / `excess_healing`をmark、追加hit、次の攻撃増幅のいずれかへ戻す。
- 補給・治療chargeを回復へ使うだけでなく、どの攻撃エンジンを再起動するかが判断になる。

Cに自由回復または純回復だけを置かない。focus依存の攻撃、`damage_taken`直後の応急処置、有限治療、healing eventを攻撃へ戻すreactive等を持たせ、offense最低3つの契約を満たす。治療可能な損傷0への空撃ちはskipし、`excess_healing`を発生させない。

### 5.6 Difficulty 5 — S + B + C + T: 余りと摩耗を次のburstへ変える

新パックSは、既に発生していたが短期価値しかなかった事実を読むoffensive hybridである。

読む候補:

- `excess_damage`
- `excess_healing`
- `resource_unused`
- `equipment_worn`
- `equipment_broken`
- 戦闘終了時の残存barrier

新しい見方:

- Bの多段・過剰damageが装備chargeを作り、次roundの範囲攻撃または追撃へ変わる。
- Cの実回復を伴う有限な余剰回復が、摩耗回復やrule再使用余地になる。
- Tの未使用AP / RPを修理へ回すか、今roundの攻撃連鎖に使うかを選ぶ。
- 装備を壊さないことだけでなく、壊れる直前・壊れた瞬間を攻撃payoffへできる。

Sは装備管理だけの支援パックにしない。耐久を払うburst active、摩耗時追撃、破損時の一回効果等を持ち、S自身にも攻撃の主役を置く。

### 5.7 Difficulty 6 — R + W + C + S: 傷を避けるものから燃料へ変える

新パックRは三つ目のprimary offenseであり、HP cost、低HP、barrier破壊、装備摩耗を攻撃倍率・対象数・再行動へ変える。ただし低HP維持を一つの正解にしない。

新しい見方:

- Rのrecoil attackで意図的にHPを下げ、Cの応急手当条件を作る。
- Wのblock / barrier / 身代わりで、誰をどこまで危険にさらすかを制御する。
- Sがdamage / wearを修理、charge、次戦価値へ変える。
- Cが有限治療を使いすぎると低HP条件と補給を失い、使わなすぎると倒れる。回復量そのものではなく回復先・資源・時点が判断になる。

4パック時には6組の二者接続が存在し、さらに三者・四者のevent pathが生まれる。設計者が明示調律するのはRと過去パックの2〜3本までとし、全高次組合せを完成レシピとして列挙しない。

## 6. パックの設計単位

### 6.1 `発生源 → 変換器 → 利得先`

強い構成は、固有名詞ではなく共有eventの経路として記録する。

| 役割 | 意味 | 現行例 |
|---|---|---|
| 発生源 | 後段が読める事実・状態・余りを作る | 実回復を伴う`excess_healing`、`actor_moved`、`damage_blocked`、`actor_defeated`、`preparation_started` |
| 変換器 | event / resourceを別の価値へ変える | 急かす、受け返しの集中、救急の小袋、拾い直し |
| 利得先 | 集めた価値を大きな結果へ変える | 大溜め、範囲攻撃、止めの一突き、強い回復・防壁 |
| 制動・代償 | 無料循環と万能化を止める | RP、AP、HP、耐久、round / battle limit、位置、準備時間 |

価値配分:

- 単体: 採用理由はあるが、汎用の最良行動を常に上回らない。
- 二部品: 条件を意識すれば単体強化より明確に得をする。
- 三部品以上: 敵圧力と合えば素朴な役割配分を大きく越えるが、別の敵圧力では代償が出る。

### 6.2 新パックは昔のeventを読む

各新パックのcontent reviewに次を必須とする。

| 欄 | 記録内容 |
|---|---|
| 初登場rank | いつ学ぶか |
| 選択された過去パック | 今回どの既習語彙と組むか |
| 読む過去event | 過去パックが既に発生させていた事実2種類以上 |
| 返すevent | 過去パック側が読める事実2種類以上 |
| 見え直す旧技能 | 以前の用途と今回の用途 |
| 設計レーン | 最低2本 |
| 代替部品 | 各レーンで一つ以上交換可能 |
| 苦手圧力 | 万能構成にならない理由 |
| 未設計領域 | あえて列挙しない高次接続 |

旧技能の係数を新rankで密かに変えて「見え直した」ことにしない。同じ定義のまま、新パックがeventへ価値を与えることで評価を変える。

### 6.3 閉じたレシピを避けるopen engine

- 一つの利得先へ到達する発生源を2つ以上用意する。
- 一つの発生源を読む変換器または利得先を2つ以上用意する。
- 同じeventを技能、装備、人物signatureの二領域以上が扱う。
- 想定構成から一部品を同じ役割の別部品へ交換できる。
- 発生源と最大利得先を一装備へ閉じ込めない。
- 敵は特定SkillIdを要求せず、速度、対象数、guard、block、位置、継続時間、resource pressureを変える。

設計者が用意するのは答えではなく、複数経路を持つ接続面である。

### 6.4 パック密度

一パックの標準:

- active 4〜6。うちoffense 3以上。
- reactive 4〜6。
- passive 0〜2。
- equipment affix 4〜6。
- enemy mutation 2〜3。
- boss law 1。
- 発生源、変換器、利得先を各1つ以上。
- 自パック内で閉じる道1本。
- 過去または将来パックへ開くeventを2種類以上。

現在はEへ攻撃技能が偏り、C / W / Tはutility・reactive寄りである。固定manifestへ移す前に、パックごとの火力差が単なる難易度差にならないよう密度を揃える。

### 6.5 攻撃パックの供給契約

`刃と撃破`を常駐baselineにすると安全だが、全rankの攻撃構成がEを中心に固定される。逆にEを外すだけでは爽快感が落ちる。したがって、攻撃の主役そのものを横方向に増やす。

~~~ts
type PackCombatRole = "primary_offense" | "offensive_hybrid" | "support";
~~~

manifest契約:

- 全manifestに `primary_offense` を一つ以上含める。ただし新規導入rankの幕1だけは、十分な攻撃力を持つ `offensive_hybrid` で代替してよい。
- 有効パック4以上では、primary offenseまたはoffensive hybridを二つ以上含める。
- primary offenseを少なくとも3rankに一つ新規導入する。
- support packもactive 4〜6のうちoffense 3以上を維持し、通常攻撃への50%追撃だけに爽快感を依存しない。
- 新しい攻撃パックは、既存攻撃パックの単なる係数上位版にしない。

攻撃パック候補:

| 系統 | 主な爽快感 | 得意 | 苦手 |
|---|---|---|---|
| 刃と撃破 E | 大きな単発、貫通、execute、撃破連鎖 | 高guard、単体、瀕死処理 | block枚数、対象分散 |
| 連撃と刻印 B | 多段、on-hit、mark消費、splash | block、小型群、発火回数 | 高guard、一撃deadline |
| 傷と背水 R | recoil、低HP、barrier破壊、危険なburst | 短期決戦、自己損傷利用 | 長期安定、回復過多 |
| 将来: 術式と反響 | focus攻撃、状態反響、連鎖伝播 | 配置をまたぐ連鎖、支援兼攻撃 | 単純単体burst |
| 将来: 報復と迎撃 | block / damage_takenから反撃 | 敵の手数、守りながら攻撃 | 低手数・準備主体の敵 |

攻撃パックを増やすことは、攻撃技能を同名倍率違いで増やすことではない。**敵を倒すまでのevent経路と画面上の気持ちよさを増やすこと**である。

## 7. 数値・永続成長・複雑性を全て難易度へ含める

複雑性を理由に敵数値を抑えない。パックが増えるほど組合せ上限が上がり、活動資金・人物鍛錬・Blueprintも累積するため、敵の固定数値も大きく上げる。

~~~text
攻略力 = 構築知識 × パック相互作用 × 生成装備 / Blueprint × ギルド累積強化

要求難易度 = 固定された敵戦力 + boss law + 遠征資源制約 + 構築複雑性
~~~

### 7.1 敵数値は理想buildの上限に合わせて大きく上げる

新rankの敵は、プレイヤー現在値へ動的追従させない。開発時に次を順番に測り、rank定義へ固定する。

1. 新manifestで成立する複数の上位buildを探索する。
2. 想定されるギルド強化帯とBlueprint持込を適用する。
3. 上位buildの固定戦力帯を測る。
4. その帯でも最終bossが自動勝利にならず、良いbuildなら明確に圧倒できる固定敵数値を置く。

初期調律幅:

- パック数据え置きrankでも、敵の実効戦力を前rank比1.3〜1.6倍程度へ上げる候補を測る。
- パック数増加rankでは、組合せ天井と永続成長を含め、前rank比1.6〜2.0倍程度まで測る。
- 数字を見て後から通る倍率へ合わせず、候補帯を先に登録して代表buildで比較する。
- 良い未知コンボがこの帯を大きく越え、一時的にゲームを壊すことを成功として許容する。

三桁中心という基準は低rankの通常帯であって、全difficultyの絶対上限ではない。高rankでは4桁以上を許容し、桁区切り・短縮表示・倍率内訳で読みやすさを保つ。数値の成長幅を、表示桁への懸念だけで潰さない。

### 7.2 前rank周回を標準進行へする

平均的な進行目標:

- 前rank初回clear直後の標準buildは、新rankの幕1〜2までは進めるが完走しない。
- 前rankを追加で2〜5遠征し、活動資金、人物鍛錬、Blueprint、構成知識を得ると新rankが現実的になる。
- 新rankで敗北しても確定済み活動資金を持ち帰り、完全な無駄runにしない。
- 上位rankほど一遠征の活動資金効率を上げ、低rankだけを高速周回するのが最適にならないようにする。
- previous rank clear以外のhard level gateは置かない。強い知識・構成なら早期突破できる。
- 十分な過剰鍛錬をすれば素朴な構成でも突破できることを許す。ただし必要周回は良い構成より大幅に多くする。

これにより「経験値貯め」は活動資金・鍛錬・装備という数値成長、「知見貯め」はevent接続と敵理解というプレイヤー学習になり、両方が同じ周回に存在する。

### 7.3 選択肢数ではなく生きた接続数を見る

パックが増えても、互いに無関係なら複雑なだけで深くない。各scenarioで次を数える。

- 使用可能skill数。
- 異なるevent入出力の種類。
- 実際に成立する二者event path数。
- 三者以上のevent path候補数。
- 同じ利得先へ至る代替経路数。
- 成功buildのevent fingerprint数。

単純な定義数より、結果を変える接続が増えていることを重視する。

## 8. 回復方式の比較とB1 + N2の理由

| 組合せ | 得られるもの | 問題 | 判断 |
|---|---|---|---|
| P1 + P2（現行） | 回復技能と毎戦同じ初期条件を両立 | HP損傷が遠征判断にならず、回復は一戦内の勝敗だけに閉じる | 撤回する |
| P1 + N2 | 回復役とHP持越しの両立に見える | 最後の敵を残し、AP / RP回復を待って全快するのが最適になる | 採用しない |
| N1 + N2 | HP持越しと撤退判断が明快 | 回復event、余剰治療、ヒーラー構築をまとめて失う | 採用しない |
| **B1 + N2** | HP持越し、補給判断、ヒーラー構築を残す | 状態・UI・検査の追加が必要 | **採用する** |

問題は、画面に「回復」という語があるかではない。**戦闘時間だけを支払い、次戦へ持ち越すHPを生成できるか**である。削除するのは回復eventではなく、時間から永続HPを無限生成する経路である。

### 8.1 anti-stall不変条件

次を機械検査できる仕様として固定する。

> 敵を一体残して追加roundを経過させても、補給や遠征中に戻らない治療chargeを消費しない限り、次戦へ持ち越すHP・補給・装備状態は改善しない。

許可する回復:

- `damage_taken`と同じreaction chain内で発火し、実回復量がその被弾量以下の応急処置。
- 補給または補給から変換した、遠征中に戻らない治療chargeを消費する回復。
- `once_per_expedition`、消耗品、遠征中に再充填されない装備charge等、次戦へまたがって減る有限効果。
- 4戦目・8戦目boss後の拠点全回復。
- 撃破、過剰damage等の有限eventを読む希少なsustain。ただし通常contentでは一戦の回復上限を持つ。

許可しない回復:

- roundごとに戻るAP / RPだけを払い、任意の過去損傷を戻すactive。
- cooldown完了まで敵を残せば再使用できる回復。
- 一戦ごとに無料で戻る`once_per_battle` healを、勝利直前まで温存して使う通常技能。
- 戦闘終了時に全回復する装備耐久だけを支払い、古い損傷を戻す通常技能。
- full HPまたは治療可能な損傷0の対象へ空撃ちし、`excess_healing`だけを発生させる技能。
- 小damageの敵を残し、lifesteal等で古い損傷を回収する通常engine。
- round経過だけで治療chargeを再生成するrule。

敵をroundごとに強化する、固定turn limitを置く等は主解決にしない。それらは「回復利益と追加被害の比較」という別の待機最適化を作り、回復役へ毎戦同じ時間税を課す。

## 9. 有限治療とヒーラーの再定義

### 9.1 応急処置 — 被弾と同じchainだけを戻す

~~~text
enemy hit 36
  -> damage_taken 36
  -> 応急処置 12
  -> 次戦へ残る実損傷 24
~~~

- 後からactiveで古い損傷へ使えない。
- 一つのdamage tokenを二重治療できない。
- RP、位置、対象関係によって、誰の被弾を救うかがbuildになる。
- 機能はmitigationに近いが、`healing_applied`を出すため回復eventとの接続を残せる。

### 9.2 野営治療 — 補給との交換

通常戦・精鋭戦後のcampで補給1を使い、現在HPを回復する。初期比較候補は次とし、数値は実装前に固定して作者評価する。

| 治療 | 効果候補 | 意味 |
|---|---:|---|
| 集中治療 | 一人をmaxHpの40%回復 | tank・背水役等、一人へ損傷を集める構成向け |
| 全体手当 | 生存者全員をmaxHpの12%回復 | damage分散構成向け |
| 蘇生 | 戦闘不能者一人をmaxHpの25%で復帰 | roster欠損を戻す高価値用途 |

### 9.3 有限の戦闘治療

active healを完全には消さず、補給から事前に作る治療charge、消耗品、遠征中に再充填されない装備charge等を消費させる。

- chargeはround経過・通常戦終了では戻らない。
- boss後の拠点補給時だけ戻す候補にする。
- 条件不成立時はskipし、chargeを消費しない。
- 戦闘終了時に自動使用しない。
- target、発火時点、回復効率、回復後のevent変換を技能・装備差にする。
- 強いrare engineが有限制約を破り、大きなsustainを得ることは発見として許容する。ただしbaselineにしない。

### 9.4 ヒーラーはHP生成役ではなく損傷制御役

| 役割 | プレイヤーの問い | 接続候補 |
|---|---|---|
| 応急処置 | どの被弾へRPを使うか | `damage_taken -> healing_applied` |
| 被害集中 | 誰へ攻撃を集め、集中治療を効率化するか | 身代わり、guard、position |
| 予防 | barrier / block /弱体解除で永続損傷を防ぐ | W、C、enemy debuff |
| 治療効率 | 補給1を単体・全体・蘇生のどれへ変えるか | focus、装備rule、camp effect |
| 損傷転嫁 | recoilや低HPを誰に負担させるか | R、W、C |
| 回復変換 | 有限に発生したhealingを攻撃・AP・markへ戻す | C、B、T |

良いヒーラーbuildは一幕4戦で失うHPを減らし、その結果として補給をrerollへ回せる。戦闘終了直前に全員を満タンへする作業員にはしない。

### 9.5 `excess_healing`

- 治療可能な損傷0ならheal skillはskipし、`healing_applied`も`excess_healing`も出さない。
- `excess_healing`は、実回復1以上が発生した同じeffectで、支払済みの回復量が余った場合だけ出す。
- 同じexcessを複数ruleが読むことは許すが、治療chargeや補給へ戻すruleにはbattle上限を置く。
- 応急処置の余剰量は元の`damage_taken`を越えない。

余剰回復はfull HPへの空撃ちで作る燃料ではなく、有限治療の大きさと対象を選んだ副産物になる。

## 10. HP持越し、4戦区間、補給、撤退

### 10.1 12戦を `4戦 × 3幕` へ分ける

- 戦闘開始時、`RunState.currentHp`をBattleInputへ渡す。
- 勝利時だけBattleResultの生存HPをRunStateへcommitする。
- 敗北時は開始前snapshotへ戻す。補給1でretryする場合、同じHP・敵seedから再開する。
- 通常戦・精鋭戦勝利では全回復しない。
- 4戦目・8戦目boss勝利後は拠点帰還として全回復する。
- 12戦目は遠征終了のため、HP回復演出を行わない。

12戦全体を一つのHP poolにすると、1戦目の小さな損傷が残り8〜11戦を決め、再開始を強める。まず4戦区間で評価し、短すぎる場合だけ回復間隔を広げる。

### 10.2 補給の四用途

1. 敗北後、同じ戦闘へ再挑戦する。
2. 報酬候補をrerollする。
3. 次幕の敵個体編成を偵察する。
4. campで集中治療・全体手当・蘇生を行う。

通常戦後は、`現HPで進む / 補給治療 / 報酬reroll / 安全撤退`を同じ画面へ出す。

### 10.3 安全撤退を敗北と区別する

現在実装では敗北と放棄がどちらも「確定活動資金 + Blueprint 1件」であり、低HPでも進んで追加撃破を試す方が一方的に得である。N2だけでは撤退判断にならない。

初期案:

- 12戦勝利: Blueprint 2件保存。
- 戦闘開始前の安全撤退: その遠征で新規取得した候補からBlueprint 2件保存。ただし完走・初clear bonusなし。
- 敗北: Blueprint 1件保存。
- 活動資金: 勝利・安全撤退・敗北のいずれも、従来どおり確定済み分を持ち帰る。

これにより、奇跡の装備を確保して帰るか、次bossの報酬とclearを狙うかが分かれる。敗北時の活動資金没収は行わない。

### 10.4 状態契約

~~~ts
type RunState = {
  // existing fields...
  currentHp: Record<CharacterId, number>;
  supplies: number;
  treatmentCharges: number; // 遠征中に自動回復しない
};

type BattleCarrySnapshot = {
  startingHp: Record<CharacterId, number>;
  endingHp: Record<CharacterId, number>;
  treatmentChargesSpent: number;
  suppliesSpent: number;
  committed: boolean;
};
~~~

- previewはRunStateを変更しない。
- 同じRunState、loadout、BattleInputから同じ終了HPとevent列を返す。
- 勝利結果は一度だけcommitする。
- retryは開始前HPへ戻り、補給だけを一度消費する。
- reloadしてもcommitted HPと未commit previewを混同しない。
- HP0の人物は、蘇生または明示された例外なしに出撃できない。

## 11. 次戦結果の完全開示

### 11.1 採用理由

戦闘が決定的でHP損傷が持ち越されるなら、結果を隠すことは主に手計算と再試行を増やす。過去の作者記録には、「部品入れ替えごとに戦闘がどうなるか予測するのはストレス」「正確な結果予測がすぐ出るなら、UIの工夫でもっと面白くなるかもしれない」の両方が残っている。

次戦について現在の決定的engineを副作用なしで実行し、次を無料表示する。

- 勝利 / 敗北 / 打切り、round数。
- 各人物の開始HP → 終了HP、戦闘不能。
- 消費する補給、治療charge、装備耐久。
- 最初に構成が崩れたevent。
- damage / healing / barrier / actionの主要chain。
- 不発技能、対象不在、資源不足。

未来の報酬選択は未確定なので、最初は次の一戦だけを完全開示する。既知の構成を変えず報酬も取らない仮定で、幕末までを一括試算する表示は後から追加できる。

### 11.2 完全開示の失敗条件

- 終了HPが増えるまで技能・装備を一個ずつ交換し、event接続を説明しない。
- 予測更新の待ち時間が構築時間の主部になる。
- previewがあるためreplayを見ず、何が効いたか分からない。
- 全戦闘を損傷0へする唯一構成が固定される。
- 予測値の微差だけを詰め、新パックによる旧技能の見え直しが起きない。

対策は予測回数制限ではない。入出力chip、変更前後の主要chain差分、ablation表示により、何を変えたため結果が変わったかを返す。

## 12. 遠征内の導入順

新パックを有効にしただけでは、プレイヤーが触れずに終わる可能性がある。一遠征の3幕を学習順に使う。

### 幕1 — 新パック単体の意味

- 新パックの発生源または基礎activeを最初から一つ使える状態にする。
- 敵は新eventを見せるが、過去パックとの接続をまだ必須にしない。
- 第4戦bossは新パック単体とbaselineで越えられる。

### 幕2 — 過去パックとの二者接続

- 報酬・技能点で変換器と利得先へ届く。
- 敵圧力が単体利用より接続利用を有利にする。
- 第8戦bossは設計レーンA / Bのいずれか、または同等の未知経路で越える。

### 幕3 — 高次接続

- 有効パックが3つ以上なら、複数の二者接続を同じ構成へ組み込める。
- 第12戦bossは一つの専用鍵を要求せず、初動、継続、対象順、資源のうち複数軸を問う。
- 設計レーンをコピーするだけより、今回の報酬に合わせて一部を組み替えた方が安定する。

固定パックは学習順を作り、seed報酬は同じ文法内での適応を作る。

## 13. 装備とBlueprint

### 13.1 固定装備

- 同じruleで耐久だけが違う系列はrarity表現へ寄せ、別装備としてpoolを薄めない。
- 単純装備は比較基準として一部残すが、報酬の主食にしない。
- 新パックのequipment familyは、新eventを読む品と、過去eventを読む品を両方持つ。
- 一品が発生源と最大利得先を両方持つ自己完結装備を量産しない。

### 13.2 Phase C生成装備

affixへ `source / converter / payoff / stabilizer` role tagを持たせる。

- manifestごとにroleの出現比率を固定する。
- 報酬4候補が全て同じroleにならない。
- 一遠征内で最低一つの発生源と、それを読む候補へ到達可能にする。
- 毎runで完成engineまでは保証しない。baselineで進み、途中取得で計画を変えられる範囲にする。
- 複数rule品は異なるroleを組み合わせ、同じ出力を二倍にするだけにしない。

Blueprint持込品はmanifest外のaffix familyでも動く。過去パックのruleを一つ持ち込めるため、固定scenarioに対するプレイヤー独自の越境手段になる。ただし持込枠を厳しく制限し、過去の完成構成を丸ごと再現させない。

## 14. 敵とboss

敵は新パックのチュートリアル鍵にも、特定技能の所持検査にもならない。

- 新eventが自然に起きる状況を作る。
- 旧技能の新しい用途が有利になるbreakpointを置く。
- 新パックなしの旧構成は幕1を進めるが、幕2〜3で安定しない。
- 新パックだけの構成も、過去パックとの接続なしでは最終bossを安定しない。
- boss lawは遠征開始時から公開する。
- bossごとに少なくとも三つの対応方法を持つ。
- hard counter、完全無効、特定SkillId条件を使わない。

例:

- T導入rankでは準備必須にせず、高耐久対象と小型敵のdeadlineで「大溜め加速」と「撃破AP連鎖」の両方を有利にする。
- C導入rankでは回復必須にせず、被害対象が時間で移ることで、身代わり・手番移動・治療再配分を有利にする。
- S導入rankでは装備破壊を強制せず、長期戦と未使用資源によって修理・温存・使い切りの価値を分ける。

## 15. 発見を画面へ返す

### 15.1 戦闘前

- 新パックを先頭に大きく表示する。
- 過去パックには「再登場: D1以来」等を表示する。
- 技能・装備へ `発生: 余剰回復`、`反応: 余剰回復` の入出力チップを出す。
- 現小隊が発生させるeventと、それを読むruleの件数を表示する。
- 0入力のruleは警告するが、自動装備や完成レシピは出さない。
- 現在構成を変えるたび、次戦の正確な勝敗、終了HP、消費資源を更新する。
- 変更前後で増減した主要event chainを表示し、終了HPだけのhill climbingを防ぐ。

### 15.2 戦闘中

- event chainを同じ色または線で短く表示する。
- 例: `大溜め開始 → 急かす → 準備完了 → 大ダメージ`。
- AP / RP / HP / 耐久を何点使い、damage / heal / barrier / actionを何点得たかをまとめる。
- 同ruleの連続発火は折り畳むが、起点と最終結果を隠さない。

### 15.3 戦闘後

- 最も長い連鎖。
- 最も結果を変えた連鎖。
- 新パックが初めて読んだ過去event。
- 今回一度も入力されなかったrule。
- 以前のrankと比べ、同じ旧技能の発火先がどう増えたか。
- 次戦へ持ち越す人物別HPと、boss拠点までの残り戦闘数。
- 現HPで続行、補給治療、reroll、安全撤退の比較。

発見済みevent pathはcodexへ保存し、プレイヤーが名前を付けられるようにする。設計者のコンボ名を解除する方式にはしない。

## 16. 機械検査

面白さは人間が判断する。機械は、設計意図が実装上成立していない状態を落とす。

### 16.1 manifestラダー

- 各rankに一つだけ初登場packがある。
- 新packは必ず有効。
- 有効pack数が登録した列 `1, 2, 2, 3, 3, 4, 4` と一致する。
- 同rank・異seedでpack構成が一致する。
- future packが早いrankへ漏れない。
- campaignとFree / Endlessのmanifestをsave / D1で区別する。
- 全manifestにprimary offenseまたは許可されたoffensive hybridがある。
- primary offense初登場の間隔が3rankを越えない。
- 有効pack 4以上で攻撃roleが二つ未満のmanifestを拒否する。

### 16.2 旧技能の再解釈

各rankに最低2件の固定counterfactualを置く。

1. 過去packだけの代表build。
2. 新packを足したfull build。
3. full buildから対象の旧技能だけを外したablation。
4. full buildから新packのbridgeだけを外したablation。

見るもの:

- 新pack追加後、対象の旧技能が発生させるeventの利用先が増える。
- 同じ旧技能の限界寄与が、新pack無しより新pack有りで明確に上がる。
- full buildはbridge ablationを明確に上回る。
- 単純に新packの最強技能だけを足したbuildより、新旧接続buildが上回る。

差20%以上を初期診断値にしてよいが、数値を見る前に登録し、funの証明には使わない。

### 16.3 素朴な基準と複数解

- 係数またはrarityの高い順に積むbuild。
- 攻撃N・防御M・回復Lの役割全探索。
- 設計レーンA / B。
- 探索が見つけた未知build。

目標:

- 素朴な最良は幕1を越えられるが最終bossを安定完走しない。
- 設計レーンA / Bは異なるevent fingerprintで完走できる。
- 未知buildが見つかる余地を残す。
- 同一技能・装備が全rankの成功buildで採用率70%を越えたら診断する。
- baselineまたは一Blueprintだけで全rankを同じ構成が完走したら失敗。

### 16.4 未知コンボ探索

SkillIdのpair数ではなくevent pathでclusterする。

~~~text
preparation_started
  -> advance_preparation
  -> preparation_completed
  -> damage_applied
~~~

- pathは長さ2〜6のevent / effect型列へ正規化する。
- 同じruleで数値・耐久だけが違う装備は同じclusterにする。
- 成功buildの主要path、消費資源、最終出力、ablation差を記録する。
- 設計レーンと異なる三者以上のpathを未知候補として人へ返す。
- 本数だけをGateにしない。再現性とevent列を確認する。

### 16.5 数値進行と周回帯

rankごとに次の固定参照点を置く。

1. 前rank初回clear直後のprofile + 標準build。
2. 前rankを想定2〜5回周回したprofile + 標準build。
3. 低鍛錬profile + 上位の相互作用build。
4. 過剰鍛錬profile + 素朴build。

目標:

- 1は新rankを安定完走しない。
- 2は設計レーンを使えば完走できる。
- 3も知識による早期突破として完走できる。
- 4も長い数値育成による突破として完走できる。
- 低rank周回の一時間あたり活動資金が、到達済み最高rank周回を恒常的に上回らない。
- 敵数値はprofileを読んで動的変更せず、DifficultyDefへ固定する。

### 16.6 HP持越し、anti-stall、preview

- 通常戦勝利後の次戦開始HPが前戦終了HPと一致する。
- boss 4 / 8勝利後だけ全回復する。
- preview、敗北、engine errorはRunState.currentHpを変更しない。
- retryは同じ開始HP、同じseed、同じ結果になる。
- harmless enemyを残して1 / 5 / 20round延長しても、遠征中に戻らない有限資源を使わない限りcarry HPが増えない。
- `AP / RPだけを消費して古い損傷を回復`するevent pathをvalidatorで拒否する。
- 治療可能量0へのcastはskipし、`excess_healing`を出さない。
- previewと実行の勝敗、round、終了HP、消費資源、event fingerprintが一致する。
- loadout変更後に古いpreviewを表示しない。
- preview連打で補給、報酬seed、HP、正式戦闘回数が変わらない。

参照buildは、offense中心、W予防、C応急処置、補給効率、希少sustainを比較する。一戦勝率だけでなく、4戦区間の終了HP、補給残数、reroll回数、撤退率を見る。

## 17. 人間評価

まず難易度0〜3を遊ぶ。

最重要の支持信号:

- D0で使った旧技能を、D1またはD2で別の目的に装着する。
- 「前は○○だったが、今回は△△とつながるから使った」と説明する。
- 新パックの係数の大きい技能だけでなく、旧技能とのbridgeを選ぶ。
- 敗北後に数値強化以外のevent接続を変更する。
- 設計レーンの部品を一つ別物へ交換する。
- D2の大溜め以外にも、撃破連鎖等の別engineを試す。
- D3でEが不在でも、Bの多段・mark・on-hitを攻撃の主役として爽快に感じる。
- 次の新パックで昔の何が変わるか予想する。
- 新rank初回敗北後に、前rankでもう一度試すbuild・欲しい装備・買いたいギルド強化を言える。Phase C後は欲しいBlueprintも含む。
- 数回の周回後、数値だけでなく自分の理解も進んだと感じる。
- 通常戦後の残HPを見て、補給治療、報酬reroll、現HPで続行、安全撤退の間で迷う。
- exact previewを見て終了HPだけでなく、どのevent chainを変えたか説明する。

失敗信号:

- 新パックを無視し、以前の完成構成で完走する。
- 新パックの最強技能だけを全員へ配る。
- 過去packは選択肢を増やすだけで、event上つながっていない。
- 発火している連鎖の起点、代償、最終利得を説明できない。
- 設計レーンが唯一解で、代替部品へ変えると成立しない。
- パック数増加が面白さではなく、探しにくさ・読みづらさだけを増やす。
- Eが無いrankで、通常攻撃と支援だけが続き撃破の爽快感が落ちる。
- 前rank周回が同じ作業の反復で、構成知識も永続選択も増えない。
- ギルド強化だけ、またはコンボだけの一方が常に他方を不要にする。
- 最後の敵を残し、回復技能やchargeの再使用を待つ方が得になる。
- HP持越しによって1戦目の小損傷が残り8〜11戦を決め、再開始が最適になる。
- previewの終了HPだけを見て部品を一つずつ交換し、因果を理解しない。

## 18. 実装順序

Milestone 0、Phase A、Phase Bのコードは実装済みだが、作者Gateは未通過である。ここからは、既存実装を捨てて作り直すのではなく、基盤をmigrationし、D0〜D3の統合縦断で遡ってGateを通す。

### Stage 0 — 現状凍結とmigration票

- mainのcommit、content / engine / profile / run / battle / difficulty versionを記録する。
- 現行P1 + P2、random 3/4 manifest、rank 0〜5 encounter、報酬、活動資金、素朴build、late build、event fingerprintをfixtureとして保存する。
- content分離前後の深一致fixtureと、Phase A / Bの既存checksを残す。
- 変更するhard contract、追加するversion、旧save migration、破棄する旧仕様をTRACEABILITYへ一対一で記録する。
- この段階で技能・敵・装備の係数を変えない。

### Stage 1 — system migration

一つのsystem系列ずつ実装し、content調整と混ぜない。

1. `DifficultyScenarioDef`、`PackCombatRole`、rank別固定manifestを追加し、D0〜D3をE、W+E、T+E、B+W+Tへ固定する。
2. `RunState.currentHp`、BattleCarrySnapshot、勝利時commit、敗北非commit、retry restore、boss後全回復を追加する。
3. healを応急処置、補給治療、遠征中に戻らないchargeへ分類し、P1の自由回復をvalidatorで拒否する。
4. 補給へcamp治療を追加し、安全撤退と敗北のBlueprint保存差を状態・精算へ追加する。
5. 次戦exact previewを副作用なしで実行し、勝敗、終了HP、消費資源、主要chainを表示する。
6. profile / run / battle / content / manifest versionを上げ、旧saveと進行中runのmigrationを実装する。

### Gate 1 — system整合

- random 3/4 manifest以外のPhase A / B既存出力が、意図したversion差を除いて一致する。
- 同じrank / seedで固定pack、敵、報酬、previewがdeep equalになる。
- 通常・精鋭後carry、boss後回復、敗北非commit、retry restore、reloadが一致する。
- previewと正式実行の勝敗、round、終了HP、消費資源、event fingerprintが一致する。
- harmless enemyを残しても、遠征中に戻らない資源なしでcarry HPを改善できない。
- Fast checkを一分以内に保ち、全組合せ探索はslow / manualへ分離する。

### Stage 2 — D0〜D3のprobe content

- D0: E単体でbasic / heavy / rapid / pierce / row / column / executeの差を見せる。
- D1: W + Eでblock、移動、対象制御から攻撃へつながる二レーンを作る。
- D2: T + Eで大溜め加速と撃破AP連鎖の二レーンを作る。
- D3: Bを第二primary offenseとして追加し、E不在のW + Tで多段・on-hit・markを主砲にする。
- 現行技能のbridgeで足りない場合だけ、安定済みevent語彙の範囲で少量追加する。
- 新event / effectが必要ならcontent側へ仮実装せず、mechanics requestへ記録する。
- 一つのcontent PRはactive、reactive、passive、敵、encounter、固定装備の一familyだけを変更する。

probe batch一回の上限:

| family | 上限 |
|---|---:|
| active | 5 |
| reactive | 2 |
| passive | 1 |
| 敵unit | 6 |
| encounter | 6 |
| 固定装備 | 6 |

### Stage 3 — 難易度調律

1. Difficulty 0のunit層を固定する。
2. encounter層で初動、持続、単体、範囲、耐久、反応の圧力を分ける。
3. 最後にrank層のenemy scale、threat、boss law、報酬倍率を載せる。

一PRで動かす層は一つだけにする。前rank初回clear、想定2〜5周回、低鍛錬上位build、過剰鍛錬素朴buildの四参照点を比較し、固定DifficultyDefへ登録する。

### Gate 2 — 作者によるD0〜D3統合評価

作者が1〜2遠征ずつ遊び、次を支持した場合だけPhase Cへ進む。

- 人物parameter、formation、単発 / 多段 / row / column、guard / block / barrierの差を説明・利用できる。
- D0の旧技能をD1 / D2で別目的に装着し、そのevent接続を説明できる。
- 設計レーンが最低二本あり、一部品を代替できる。
- D3でE無しでもBが攻撃の主役となり、別種の爽快感がある。
- 前rank初回clear直後では次rankを安定完走せず、2〜5周または上位build発見で突破できる。
- 4戦区間で現HP続行、補給治療、reroll、安全撤退を比較する。
- exact previewを見て、終了HPだけでなく変更したevent chainを説明する。
- 12戦がHP節約だけの重いrunにならず、次に試す構成・装備・投資を言える。Phase C後は保存・持込したいBlueprintも含む。

支持されなければ、content量で延命せず、支持されなかったsystem / content層を修正する。

### Stage 4 — Phase C: 生成装備とBlueprint

Gate 2後に限り、次をこの順で実装する。

1. affix schema、完結rule grammar、canonical descriptor、power / complexity budget。
2. 決定的generator、50 attempt診断、dead rule / 無料循環validator。
3. rarity別rule数と報酬table。
4. Blueprint exact保存、archive、再製造、carry capacity 1〜5、旧version disable表示。
5. 目利き、生成装備報酬、勝利 / 安全撤退 / 敗北の保存数。
6. 生成装備を含むpreview、save / reload / export / D1。

generator契約が機械検査されるまでprocedural affixや複数rule装備を量産しない。作者が「奇跡の品を保存したい」「持込品によって今回の構成が変わった」と感じた後に装備content waveを広げる。

### Stage 5 — D4〜D6

- D4: C + E + B。有限治療、実回復を伴う余剰、攻撃への回帰。
- D5: S + B + C + T。余剰、未使用資源、装備消耗からburstへ変換。
- D6: R + W + C + S。recoil、低HP、barrier破壊、摩耗をprimary offenseへ変換。
- primary offenseを3rank以内に一つ追加し続ける。
- 各新packは過去eventを二種類以上読み、過去packへ二種類以上返す。
- mechanics追加は一系統ずつ行い、そのmechanicsを使うcontentはcontract merge後に作る。

### Stage 6 — Difficulty 7〜20、Free、Endless

- 一rank一新pack、固定の過去pack、active pack上限6を維持する。
- D0〜D6で支持されたmanifest、数値、HP、補給、生成装備contractを使ってrank 7〜20を追加する。
- rank 10に正式制覇、rank 20に設計上の完了とendless解禁を置く。
- Freeでは解禁済みpackの任意 / random組合せを許し、campaignの学習順と分離する。
- endlessは4戦blockごとにbudget、mutation、数値倍率、活動資金倍率を増やす。
- 新pack、敵family、affix family、人物を通常content waveとして継続配信する。

## 19. content契約と継続拡張規則

未来の全systemを先に実装しない。contentが依存する薄い契約を固定し、作者に支持された語彙の範囲だけを増やす。

### 19.1 hard contract

- definition IDは永続・一意。削除後も別内容へ再利用しない。
- ID改名はaliasまたはmigrationを持つ。
- event、effect、predicate、scope、tag、position、数値単位、丸め地点の意味を黙って変えない。
- 新語彙はschema versionを上げ、additiveに追加する。
- 2×3のcanonical position IDを保存し、表示語だけを保存しない。
- event事実と表示文を分離する。
- save、D1、replayへcontent versionとdefinition IDを残す。
- unknown語彙を無視せずvalidator errorにする。
- 個別人物 / skill / equipment IDを相方条件にしない。

### 19.2 soft data

係数、cost、cooldown、発火上限、enemy parameter、threat cost、encounter、reward / rarity weight、skill point価格、power budget、Difficulty数値は調律可能とする。ただし変更ごとにbuild / content versionを上げ、測定済みrunと混同しない。

### 19.3 通常content waveとmechanics pack

- 通常wave: 既存語彙だけで技能、敵、固定装備、生成装備motif、encounter、人物を追加する。
- mechanics pack: 新event / effect / predicate / targetを一系統だけ追加するsystem変更。
- 新語彙が必要なcontentは先行実装せず、用途、反例、必要な三family以上をrequest票へ記録する。
- mechanics packのmerge後、同じcontract SHAから新語彙contentを作る。
- 召喚、復活、属性、地形等の未決定語彙を空実装しない。

### 19.4 責務分離

- system変更とcontent追加を同じPRへ混ぜない。
- 技能、敵、encounter、固定装備、生成装備を一つのcontent PRへ混ぜない。
- Difficulty調整でunit、encounter、rankの二層以上を同時に動かさない。
- Phase C契約前にprocedural affix、複数rule装備、Blueprint対象品を本番実装しない。
- 現在のAGENTS.mdどおり実装担当は一人。ここでのworkstreamは並列agent起動の許可ではなく、順番に処理する責務境界である。

### 19.5 content PR受入票

~~~text
Contract SHA:
Content family:
追加ID:
利用する既存event/effect/target:
新語彙要求: なし / mechanics request:
単独の現在価値:
強くなる二文脈:
弱くなる二文脈:
過去packとの接続:
見え直す旧content:
圧力vector:
変更したsoft data層:
Fast check:
Slow check:
reference比較:
未検証:
~~~

engine / schema変更0、validator error 0、説明と実event不一致0、個別ID相方参照0を必須にする。完全上位互換は削除するか、明示的な代償を付ける。

### 19.6 停止条件

- migration前後で、意図した差以外の同一seed出力が変わる。
- 作者Gate前にprobe batchを越えるcontent量が必要になる。
- content追加のためengineへ個別ID分岐が必要になる。
- systemとcontent、またはunit / encounter / rankの複数層を同時変更し、差分原因を分離できない。
- 新mechanicsを二系統以上同時追加する。
- Fast checkが一分を超え、slowへ分離できない。
- previewと正式実行が一致しない。
- HP持越しだけを、有限治療・撤退差・previewなしで作者公開しようとする。
- reference suiteの高勝率やfingerprint数をfunの証拠として扱う。
- 作者が支持しなかったPhaseをcontent量で延命しようとする。

停止時は、依存していたcontract、影響するcontent ID、最小修正案、破棄可能な作業を記録する。

## 20. 採用しない代案

### 全過去パックを毎回累積する

完成構成を維持したまま新しい強要素を足すだけになり、選び直しと再発見が弱い。UIと探索空間も急速に膨張する。

### 難易度ごとにパックを全交換する

初版R8の誤り。知識の積み上げではなく、別問題へのリセットになる。

### パックは固定するが、新パックを保証しない

難易度を進めても新しい学習が起きず、昔の強いmanifestの繰り返しになる。

### 敵数値だけを大幅に上げる

単体構成とコンボ構成を同率で苦しくし、旧技能の再解釈を作らない。

### 新パックだけを極端に強くする

過去パックとの接続ではなく、新技能の上位互換化になる。

### 難易度ごとに正解buildを一つ登録する

初回パズルにはなるが既知後のreplayを失う。登録するのは最低2本の設計レーンとevent接続条件までにする。

### 先にPhase C生成装備を大量追加する

現在の単体強化中心の文法を数百品へ増幅し、原因分離と作り直しを難しくする。

### 通常戦後の全回復を維持する

自由回復のstall問題は吸収できるが、HP損傷、補給治療、4戦区間の計画、撤退判断が遠征から消える。

### 回復役を完全に削除する

attritionは単純になるが、応急処置、被害集中、治療効率、余剰回復、希少sustainという構築空間を失う。削除すべきなのは回復eventではなく、round経過から持越しHPを無限生成する経路である。

### 自由回復を残し、敵をroundごとに強化する

待つ利益と追加damageの比較を新たに強制するだけで、無害な敵、barrier engine、cooldown待ちの例外が残る。回復役へ毎戦同じ時間税を課すため採用しない。

### 12戦を一つのHP poolで通す

序盤損傷のsnowballと再開始を強める。まず4戦区間で評価し、短すぎる場合だけ拠点回復間隔を広げる。

### 結果を隠して緊張感を作る

決定的戦闘では主に手計算と再試行を増やす。緊張は未知の結果ではなく、見えている損傷と有限補給をどう配分するかから作る。

### 未来のsystemを全て先に実装する

戦闘・HP・manifestが支持されなかった場合に、生成装備、Blueprint、endlessまで大きく作り直す。薄いcontractと支持済みsliceを順に積む。

### 作者Gate前にcontent量を増やす

面白くないsystemを技能・敵・装備の物量で覆い、原因分離と作り直しを難しくする。Gate前はprobe batch上限を越えない。

### 将来使うかもしれない語彙を空実装する

召喚、復活、属性、地形等の未決定mechanicsを予約実装すると、使われない複雑性と互換責務が残る。追加口だけを持ち、必要時に一系統ずつ実装する。

## 21. 最終的に目指す状態

難易度は、敵の数値だけが増える階段ではない。

> 一段進むたびに、新しいパックが一つ現れる。  
> 過去パックの一部が設計された組で戻り、昔の技能に新しい用途が生まれる。  
> 有効パック数が徐々に増え、二者接続から三者・四者接続へ構築空間が育つ。  
> 構築上限とギルドの累積強化に合わせ、敵数値も大きく伸びる。  
> 前rankの周回で数値と知見を蓄え、優れたコンボならその周回を短縮できる。  
> 刃、多段、背水、術式、報復など、異なる攻撃パックが定期的に新しい爽快感を持ち込む。  
> 通常戦の損傷は次へ残り、治療・reroll・安全撤退が同じ有限補給を奪い合う。  
> 次戦結果は正確に見えるが、どのHP損失を受け入れ、どのコンボへ組み替えるかはプレイヤーが決める。  
> ヒーラーは無料で全快させず、被弾を救い、損傷を集め、有限治療の価値を増幅する。  
> 設計者は入口となる接続面を作るが、高次コンボの全ては決めない。  
> campaignで学んだ後、Free / Endlessと生成装備が未知の組を作る。

この順なら、設計された手応え、知識の積み上げ、数値成長、周回の意味、攻撃の爽快感、複雑性による難しさ、開発者も知らない発見を同時に育てられる。
