# EXP-18 R6 — 長期進行・手続き生成装備・設計図

状態: 実装委譲可能な設計票  
対象: EXP-18 R5エンジン、およびPR #49の一周可能な試作  
作成日: 2026-08-29  
この文書の役割: 長期化のために要素を足し続けるのではなく、遠征ごとに新しい構築問題が生まれ、奇跡的な装備との出会いだけが適度に永続する進行構造を固定する。

## 0. 結論

本編の中心を「永続育成」から「有限の遠征を繰り返す構築ゲーム」へ変更する。

- 人物、物語、図鑑、解禁した仕組み、到達難易度、保存した設計図は永続する。
- 技能点、遠征内の技能解禁、生成装備、補給、経路は遠征終了時に失う。
- 一遠征は3幕12戦。4、8、12戦目をボスとし、12戦目で明確に完結する。
- 遠征開始時に、その遠征で使える技能パック、装備affix群、主な敵、ボス法則を提示する。
- 装備は、基材と汎用ルール断片の組み合わせからseed付きで生成する。
- 遠征終了時、生成装備を正確な「設計図」として少数だけ永久保存できる。
- 次の遠征へ持ち込める設計図は最初1枚。高難度の達成で最大5枚まで、非常にゆっくり増える。
- 持込設計図からは、その遠征に一つだけ同じ装備を再製造する。敵は持込品に合わせて隠れて強くならない。
- 永続解禁は原則として選択肢を増やす横方向のものとし、無制限な攻撃力上昇を置かない。
- 通常クリア後に難易度0〜20とエンドレス深度を置く。一生育成の数値インフレはエンドレスだけに隔離する。

この方式は、次の二つを両立させる。

1. 遠征ごとに構成を捨て、今回のルール集合から強さを予想し直す。
2. 「二度と出ないかもしれない品を引いた」という記憶と成果は失わない。

## 1. 現在の試作が長期化できない理由

PR #49では、8人、24技能、18装備、7区画が一周の画面としてつながった。一方、現在は次の状態である。

- 技能点と解禁技能はmetaに保存され、新しい遠征にも残る。
- 所有装備もmetaに保存される。
- 装備報酬は所有済み定義を候補から除く。
- 7区画と敵編成は固定。
- HPと装備耐久は毎戦回復し、敗北は無損失で何度でも再挑戦できる。

このまま100技能、100装備へ増やしても、全取得までの時間が延びるだけである。全取得後は報酬が消え、全技能解禁後は成長選択が消える。強い完成構成を捨てる理由もない。

したがって、必要なのはコンテンツ量ではなく、永続状態と遠征状態の分離である。

## 2. 目標体験

### 2.1 遠征開始

開始画面を見て、プレイヤーが次のように考える。

- 今回は移動、防壁、余剰回復、準備の4パックが使える。
- ボスは準備完了へ反応するので、急かすより準備中断を使う方がよいかもしれない。
- 保存してある「余剰回復で行動権を渡す装備」が今回は強そうだ。
- 設計図枠は2枚しかない。万能の防具と、今回刺さる変な装備のどちらを持ち込むか。

### 2.2 遠征中

新しい取得物で既存構成の評価が変わる。

- 単体では弱そうなaffixが、今の技能と敵には刺さる。
- 予定していた人物、技能順、装備先を途中で壊す。
- 補給を報酬更新に使うか、敗北時の再挑戦用に残すか迷う。
- 勝敗だけでなく、装備耐久、未使用資源、行動回数、発火した因果を観察する。

### 2.3 遠征終了

- 勝敗にかかわらず、その遠征固有の構成を説明できる。
- 見つけた装備のうち、永久保存する一品を迷う。
- 次回は別の技能集合、別の設計図、別の難易度で試したいと思う。
- クリアには明確な終点があり、その後も高難度とエンドレスを選べる。

## 3. 不変条件

以下は実装担当が独自に変えない。

- 愛着の主語は装備ではなく永続人物である。人物を遠征ごとに消さない。
- 戦闘は同じ入力なら同じ完全なイベント列を返す。
- 人物名、特定技能名、特定装備名を参照するコンボ条件をエンジンへ追加しない。
- 新要素は共有event、predicate、cost、effect、target relationで相互作用する。
- 装備生成も戦闘もseed付きで再現可能にする。
- プレイヤーに見えない自動難易度補正を行わない。
- 強い設計図を持ち込んだときは、実際に強く感じられるようにする。
- 永続の生攻撃力、防御力、HPを無制限に増やさない。
- 装備の説明は、発火契機、条件、代償、効果、制限を省略せず表示する。
- 機械検査は破綻と支配性候補の検出に使い、面白さの証明に使わない。
- PR #49の人間評価がまだ無くても、この設計票を面白さの支持証拠とは書かない。

## 4. 状態を三層に分ける

### 4.1 ProfileState — 永続

~~~ts
type ProfileState = {
  schemaVersion: "ecology-profile-1";
  profileId: string;
  characters: Record<CharacterId, CharacterProfile>;
  unlockedPackIds: string[];
  unlockedAffixFamilyIds: string[];
  blueprintArchive: Blueprint[];
  blueprintCarryCapacity: number;
  codex: CodexState;
  regionProgress: Record<RegionId, RegionProgress>;
  achievements: string[];
  settings: Record<string, unknown>;
};

type CharacterProfile = {
  characterId: string;
  signatureVariantIds: string[];
  activeSignatureVariantId: string;
  affinity: number;
  storyFlags: string[];
  cosmetics: string[];
};

type RegionProgress = {
  highestClearedDifficulty: number;
  highestEndlessDepth: number;
  bossRecords: string[];
};
~~~

ProfileStateに、遠征内技能点、遠征内装備、現在HP、現在の敵を入れない。

### 4.2 RunState — 遠征中だけ

~~~ts
type RunState = {
  schemaVersion: "ecology-run-1";
  runId: string;
  runSeed: string;
  regionId: string;
  difficulty: number;
  manifest: ExpeditionManifest;
  encounterIndex: number;       // 0..11
  act: 1 | 2 | 3;
  supplies: number;
  roster: CharacterId[];
  formation: Record<CharacterId, Position>;
  runSkillPoints: Record<CharacterId, number>;
  runUnlockedSkills: Record<CharacterId, SkillId[]>;
  loadout: Loadout;
  inventory: GeneratedEquipmentInstance[];
  carriedBlueprintIds: string[];
  generatedEquipmentDefs: Record<string, EquipmentDef>;
  results: EncounterResultSummary[];
  status: "active" | "won" | "lost" | "abandoned";
};
~~~

### 4.3 BattleState — 一戦

既存R5 BattleInputとBattleResultを使う。HPと装備耐久はBattleState内だけで変化し、通常戦後に全回復する。この設計では遠征の緊張をHP持越しではなく、補給、報酬、設計図枠、敵難易度で作る。

## 5. 一遠征

### 5.1 長さ

- 3幕、合計12戦。
- 1〜3、5〜7、9〜11戦目は通常または精鋭。
- 4、8、12戦目はボス。
- 12戦目撃破で遠征勝利。
- 各戦闘前後で保存し、iPhone上で別セッションへまたいで再開できる。
- 現在の7区画は「灰の入口」チュートリアル遠征として残してよい。

### 5.2 ExpeditionManifest

~~~ts
type ExpeditionManifest = {
  manifestVersion: "ecology-manifest-1";
  seed: string;
  baselineSkillIds: SkillId[];
  enabledPackIds: string[];
  enabledAffixFamilyIds: string[];
  enemyFamilyIds: string[];
  actBossIds: [EnemyActorId, EnemyActorId, EnemyActorId];
  regionLawIds: string[];
  rewardTableId: string;
};
~~~

遠征開始前に全項目を表示する。敵の個体編成までは伏せてよいが、主な敵family、地域法則、各幕のボス法則は事前に分かる。

最初の実装では、現在の24技能を4パックに分け、baseline技能に加えて3パックを有効にする。パックが6個以上になったら、seedから3つのmanifest候補を生成し、プレイヤーが1つ選ぶ。

baselineには、最低限の攻撃、回復、防壁を入れ、どのmanifestでも行動不能な人物を作らない。

### 5.3 報酬

通常戦勝利後は4候補から1つ選ぶ。

- seed生成装備2個。
- 選んだ人物一人のrunSkillPoints +2。
- 補給 +1。

精鋭戦とボスは、装備のrarity tableを一段上げる。ボス報酬は追加で、遠征中だけ有効な技能変異または人物signature変異を候補にできる。

現在の「8人全員へ永続技能点+2」は削除する。runSkillPointsとrunUnlockedSkillsは遠征終了時に消える。

## 6. 技能パック

### 6.1 定義

~~~ts
type SkillPackDef = {
  id: string;
  displayName: string;
  activeSkillIds: SkillId[];
  reactiveSkillIds: SkillId[];
  affixFamilyIds: string[];
  enemyMutationIds: string[];
  bossLawIds: string[];
  tags: string[];
};
~~~

一パックの追加単位は原則として次とする。

- active 4個。
- reactive 4個。
- 装備affix 6個前後。
- enemy mutation 3個前後。
- boss law 1個。
- character signature候補1個。

パックは推奨完成コンボの箱ではない。同じevent語彙へ、プレイヤー、装備、敵の三方向から小規則を追加するmechanics packである。

### 6.2 現在の24技能の初期分割

実装担当は意味を保つ範囲で細部を調整してよいが、最初は次の4系統に分ける。

1. 攻撃・撃破: strike、heavy_swing、long_swing、hunt_the_slow、counter_blow、damage_echo、scavenge_ap。
2. 回復・余剰: mend、triage、overflow_care、triage_relay、brace_after_hit。
3. 防壁・隊列: bulwark、reposition、cover_ally、guard_step、barrier_bloom。
4. 行動権・準備: relay_order、mark_target、steady_aim、idle_shuffle、urging、ap_loop、prep_spiral。

baselineとの重複は許す。将来は一要素を複数パックへ重複登録せず、baselineか一パックのいずれか一つに所属させる。

### 6.3 人物固有性

各人物は、交換不能なsignature ruleを一つ持つ。永続解禁でsignatureの別型を増やせるが、同時に有効なのは一型だけ。

共通技能を広く付け替えられる余地は残す。固有能力は「その人物でなければ成立しない完成コンボ」ではなく、共有eventの一つを少し違う価値へ変える程度にする。

## 7. 手続き生成装備

### 7.1 目的

理論上の組み合わせ数を増やすこと自体を目的にしない。次を満たす生成装備だけを採用する。

- 一品を局所的に読める。
- 現在の構成によって価値が変わる。
- 強い効果には、条件、resource cost、耐久、回数制限のいずれかがある。
- 全構成で常に勝る一品を作らない。
- 同じseed、drop index、generator versionなら同じ一品になる。
- 既存R5 validatorと停止検査を通るEquipmentDefへcompileできる。

### 7.2 保存形式

~~~ts
type GeneratedEquipmentInstance = {
  instanceId: string;
  definitionId: string;
  generatorVersion: "ecology-loot-1";
  seed: string;
  dropIndex: number;
  baseId: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  affixes: RolledAffix[];
  maxDurability: number;
  displayName: string;
  tags: string[];
  origin: ItemOrigin;
};

type RolledAffix = {
  affixId: string;
  tier: number;
  rollQuality: number;          // 0..100
  resolvedParameters: Record<string, number | string>;
};

type ItemOrigin = {
  runId: string;
  regionId: string;
  difficulty: number;
  encounterIndex: number;
  acquiredFrom: string;
};
~~~

resolvedParametersを保存し、後から同じaffixの数値表が変わっても、既存の一品を黙って別物にしない。

### 7.3 装備文法

一つの装備ruleは次からなる。

1. Trigger: listenToとtiming。
2. Conditions: predicates 0〜2個。
3. Cost: costs 0〜1個。
4. Payload: effects 1〜2個。
5. Limit: chain、round、battleのいずれか。
6. Durability: 発火コストまたはbattle内回数上限として働く。

affixは任意コードではなく、次の型のいずれかである。

~~~ts
type AffixDef = {
  id: string;
  familyId: string;
  kind: "trigger" | "condition" | "cost" | "effect" | "modifier" | "keystone";
  compatibleTags: string[];
  incompatibleTags: string[];
  powerCost: number;
  complexityCost: number;
  weight: number;
  tiers: AffixTierDef[];
};
~~~

triggerだけ、effectだけの不完全なEquipmentDefを生成しない。基材が必ず最低一つのtriggerとeffectを供給する。

個別技能ID、人物ID、装備IDをpredicateへ埋め込まない。event type、tag、source relation、target relationだけを使う。

### 7.4 rarity

初期値は次とする。値はfun判定前の生成設定であり、テストを通すために後から変更しない。

| rarity | 通常affix数 | 特徴 | power budget |
|---|---:|---|---:|
| common | 1 | 基材の意味が明瞭 | 2 |
| rare | 2 | 条件または追加effect | 4 |
| epic | 3 | 二つの用途、または強い効果と明確な代償 | 7 |
| legendary | 3 + keystone 1 | 通常にない関係変換 | 10 |

幕ごとの仮loot weight:

| 入手場所 | common | rare | epic | legendary |
|---|---:|---:|---:|---:|
| 第1幕通常 | 70 | 25 | 5 | 0 |
| 第2幕通常 | 50 | 35 | 13 | 2 |
| 第3幕通常 | 35 | 40 | 20 | 5 |
| 精鋭 | 対応幕からcommonを20減らし、上位へ配分 |
| ボス | rare未満を出さず、対応幕のepic/legendaryを増やす |

Legendaryは固定の正解コンボではない。通常affix poolに存在しない汎用keystoneを一つ含むランダム品である。

### 7.5 power budget

強い効果はpowerCostを消費する。厳しい条件、RP、HP、耐久のcostはbudget rebateを持てる。generatorはrarityのtarget budget範囲に収まる組み合わせだけを採用する。

同じbudgetでも用途が異なるようにし、rarityを単純な上位互換にしない。高rarityは広く強いのではなく、複数の文脈を持つか、強い代わりに代償が大きいものとする。

### 7.6 生成手順

1. runSeed、encounterIndex、rewardSlotからitemSeedを作る。
2. rarity tableでrarityを決める。
3. manifestのenabledAffixFamilyIdsから基材を選ぶ。
4. compatibility、power budget、complexity budgetを満たすaffixを順に選ぶ。
5. resolvedParametersを確定する。
6. EquipmentDefへcompileする。
7. validateContentBundleを通す。
8. generator固有のdead-rule検査を通す。
9. 失敗なら同じitemSeedのattempt番号を増やして再生成する。
10. 50 attemptで生成不能なら、既定品へ黙ってfallbackせず診断エラーにする。

生成された定義IDとrule IDはcanonical descriptorから決定的に作り、contentBundle内で一意にする。

## 8. 設計図

### 8.1 保存するもの

Blueprintは生成装備の正確な構造と来歴を永久保存する。

~~~ts
type Blueprint = {
  blueprintVersion: "ecology-blueprint-1";
  blueprintId: string;
  createdAt: string;
  sourceItem: Omit<GeneratedEquipmentInstance, "instanceId">;
  canonicalDescriptor: string;
  displaySnapshot: {
    name: string;
    rulesText: string[];
    rarity: string;
  };
  originBuild?: {
    roster: CharacterId[];
    ownerCharacterId?: CharacterId;
    activeSkillIds: SkillId[];
    reactiveSkillIds: SkillId[];
  };
  favorite: boolean;
  disabledReason?: string;
};
~~~

canonicalDescriptorはkey順を固定したJSONとする。blueprintIdはdescriptorの安定hashから作る。hash衝突時はdescriptor比較で検出し、別suffixを付ける。

Blueprintはimmutableである。保存後にreroll、tier変更、affix差替えをしない。別の品を作った場合は別Blueprintとして保存する。

古いBlueprintを新バージョンで黙って再解釈しない。互換不能になった場合もarchiveから消さず、disabledReasonを表示する。

### 8.2 archive

- archive自体にゲーム上の所持上限を設けない。
- 検索、rarity、affix family、取得地域、人物、favoriteで絞り込める。
- 破棄は明示操作だけにする。
- profile exportへ必ず含める。
- 遠征終了時、勝利なら最大2件、敗北または放棄なら最大1件をarchiveへ追加できる。
- すでにarchive済みと同じdescriptorなら重複保存せず、取得履歴だけを追加してよい。

敗北でも一品を保存できるのは、奇跡的なdropを失う恐怖が構築実験を抑制しないためである。序盤品はrarity table上弱いため、序盤だけを反復しても高難度品の代替になりにくい。

### 8.3 遠征への持込

- 遠征開始前に、archiveからcarry capacity以内のBlueprintを選ぶ。
- 一Blueprintから一遠征につき一品だけ再製造する。
- 再製造品はsourceItemのaffix、tier、rollQuality、resolvedParametersを完全に保持する。
- 再製造品は通常のinventory上限と装備枠を使う。
- 同じBlueprintを複製して複数人物へ配らない。
- manifestに含まれないaffix familyでも持込品は有効。これが長期報酬である。
- 敵のthreat budgetは持込品数や強さを見て自動変更しない。
- 低難度を過去の強い設計図で圧倒することは許す。次の挑戦は明示的な高難度で行う。

### 8.4 carry capacityの解禁

初期実装の最大値は5。条件は厳しくし、容量を増やす挑戦では、まだ解禁していない枠を使えない。

| capacity | 解禁条件 |
|---:|---|
| 1 | チュートリアル遠征を初回クリア |
| 2 | 難易度5を、持込Blueprint 1枚以下でクリア |
| 3 | 難易度10を、持込Blueprint 2枚以下でクリア |
| 4 | 難易度15を、持込Blueprint 3枚以下、再挑戦0回でクリア |
| 5 | 難易度20を、持込Blueprint 4枚以下、再挑戦0回でクリア |

複数地域が実装された後は、単一地域の反復だけでcapacity 4以降を解禁できないよう「異なる地域での達成」を追加してよい。ただし条件変更はR6の次版で明記する。

## 9. inventory

- 遠征中inventoryは12品まで。
- 装備中の品も12品に含む。
- 報酬取得で13品目になる場合、その場で一品を分解するか新報酬を捨てる。
- 分解すると遠征内通貨ではなく補給1/2相当のscrapを得る。scrap 2で補給1へ変換できる。
- v1ではaffix crafting、reroll、合成を実装しない。報酬候補全体のrerollだけを補給1で行う。
- Blueprint化は遠征終了時だけ。戦闘中の一時状態や摩耗状態は保存しない。

## 10. 敵生成とスケール

### 10.1 敵も同じ小規則で構成する

~~~ts
type EnemyChassisDef = {
  id: string;
  baseStats: { maxHp: number; speed: number; actionPoints: number; reactionPoints: number };
  baseTacticIds: string[];
  baseRuleIds: string[];
  threatCost: number;
  compatibleMutationTags: string[];
};

type EnemyMutationDef = {
  id: string;
  ruleIds: string[];
  tacticPatch?: unknown;
  threatCost: number;
  incompatibleMutationIds: string[];
  previewText: string;
};
~~~

Encounterはchassis、mutation、region lawをthreat budget内で組み合わせる。

### 10.2 threat budget

- 戦闘番号ごとのbase budgetをデータで持つ。
- 難易度modifierがbudgetを明示的に加算する。
- chassis、追加個体、mutation、boss lawがbudgetを消費する。
- HP/攻撃倍率は最終微調整だけに使い、難易度の主役にしない。
- 最大4体、位置重複なし。
- 一つのskill packを完全に無効化するhard counterを生成しない。
- 「準備中を狙う」「最初の防壁を反響する」のように、庇う、位置、速度、別技能で迂回可能なsoft counterにする。
- 全enemy mutationとboss lawを戦闘前に表示する。

初期のbase budgetは、現在の7戦を基準に実測し、12段階へ単調増加させる。実装担当が数値を決める前に、現在の7戦をchassis/mutationへ分解した対応表をPREFLIGHTへ出す。

### 10.3 boss

各bossは次を持つ。

- 固有chassisまたは外見。
- 公開されたboss law 1個。
- difficultyによるmutation 0〜2個。
- 少なくとも三つの異なる対応方法。
- 最終bossだけを倒せる専用技能や専用装備を作らない。

ボス法則は遠征開始時から見える。途中の報酬を「最後に向けて取る」判断を可能にする。

## 11. 敗北と補給

### 11.1 補給

- 遠征開始時3。
- 上限5。
- 報酬の補給+1、scrap 2の交換で増える。
- 次の三用途で共有する。

1. 敗北後、編成を変更して同じ戦闘へ再挑戦: 1。
2. 報酬4候補を一度だけ再生成: 1。
3. 次幕の通常敵個体編成を早期に偵察: 1。

boss law、enemy family、region lawは補給を使わなくても見える。偵察で見えるのは個体、位置、mutationの組み合わせである。

### 11.2 敗北処理

- 敗北後、即座に遠征を破棄しない。
- 補給が1以上なら、1消費してcampへ戻り、人物、位置、技能、装備を変更して同じBattleInput seedへ再挑戦できる。
- 敵を強化しない。報酬も変更しない。
- 補給0で敗北したら遠征終了。
- 任意に遠征を放棄できる。
- 敗北または放棄でもBlueprintを1件保存できる。
- 敗北理由、最後に発火したrule、未使用資源、装備摩耗、主要なtarget変更を結果画面に残す。

補給をrerollへ使うと再挑戦余地が減る。これが遠征全体の勝敗以外のトレードオフになる。

## 12. 難易度、一区切り、エンドレス

### 12.1 明確な完了

- 難易度0の12戦目撃破で地域クリア。
- 初回クリア時に短いキャラクター場面とcredits相当の区切りを出す。
- 難易度10で地域の正式制覇。
- 難易度20で設計上の最高難度を完了。
- 以後はendless depthを記録する。

### 12.2 難易度modifier

DifficultyDefをデータとして持つ。

~~~ts
type DifficultyDef = {
  rank: number;
  threatBudgetDelta: number;
  startingSupplies: number;
  encounterModifiers: string[];
  rewardModifiers: string[];
  bossMutationCount: number;
};
~~~

rankは順番に解禁し、全変更を開始前に表示する。最初の実装は0〜5だけでよい。6〜20は同じschemaで追加する。

例:

- Rank 1: 全戦闘threat budget +1。
- Rank 2: 精鋭へmutation +1。
- Rank 3: 通常戦のmaxRounds -1。
- Rank 4: 各bossへmutation +1。
- Rank 5: starting supplies 2。

以後も、見える変異、budget、資源制約を優先する。単純な敵HP倍率を毎rank積まない。

### 12.3 endless

- 難易度20後に解禁。
- 12戦後も4戦単位で続く。
- 4戦ごとにthreat budget、mutation count、数値倍率を増やす。
- 無限の公平性や全buildの生存を保証しない。
- 個人記録はdepth、boss撃破、使用Blueprint、構成fingerprintを保存する。
- ここでは数値インフレと圧倒を許すが、本編の通常難易度へ逆流させない。

## 13. 拡張単位

新しい仕組みを追加するときは、単一技能や単一敵だけを足さず、SkillPack単位で追加する。

一パックは、既存の少なくとも三つのevent typeを読み、少なくとも二つのevent typeを新たに発生させる。専用イベントを追加する場合は、人物、技能、装備、敵のうち三領域以上で使う反例を先に示す。

新パック追加によって一遠征の表示量を増やさない。manifestが選ぶパック数は4前後に固定する。

これにより、総コンテンツは増えるが、一回のプレイヤーが把握する局所ルール量は増え続けない。

## 14. UI要件

### 14.1 遠征開始

一画面で次を表示する。

- 有効SkillPack。
- 有効affix family。
- enemy family。
- 3体のbossと法則。
- region law。
- 難易度modifier。
- Blueprint carry capacityと現在選択数。

三つのmanifestから選ぶ段階では、それぞれを同じ比較軸で横並びにする。

### 14.2 装備

装備説明は次の順で固定する。

1. WHEN — 何が起きたとき。
2. IF — 追加条件。
3. PAY — 支払うもの。
4. DO — 起きる効果。
5. LIMIT — 発火上限と耐久。

rarity色だけで強さを判断させない。event名、対象relation、値、耐久を必ず文字で出す。

### 14.3 Blueprint archive

- 名前、rarity、全rule、来歴、最初に使った人物を表示。
- favorite、検索、filter。
- 遠征開始時に選択し、capacity超過を拒否。
- Blueprintから生成される実物がexact copyであることを表示。
- disabled Blueprintを消さず、理由を表示。

## 15. 決定性とversioning

次の生成物は同じ入力でJSON深一致する。

- Manifest。
- Encounter。
- Reward offer。
- GeneratedEquipmentInstance。
- Compiled EquipmentDef。
- Blueprint canonicalDescriptor。
- Blueprintから再製造したGeneratedEquipmentInstance。

乱数キーは用途ごとに分離する。

~~~text
runSeed:manifest:offerIndex
runSeed:encounter:encounterIndex
runSeed:reward:encounterIndex:rerollIndex:slot
runSeed:item:dropIndex:attempt
~~~

報酬rerollが後続敵や後続drop列を変えないよう、単一の可変PRNGを全用途で共有しない。

generatorVersion、manifestVersion、profile schema、run schemaを保存する。version不一致を黙って読み飛ばさない。

## 16. 実装境界

### 16.1 最初の実装で行う

- ProfileStateとRunStateの分離。
- 既存saveのmigration。
- 12戦、3boss、補給3。
- 現24技能の4パック化と、3パックを使うmanifest。
- equipment generator v1。
- Blueprint archive、勝利2／敗北1の保存。
- carry capacity 1、およびcapacity 2の解禁条件。
- inventory 12。
- threat budgetとenemy mutationのschema。
- Difficulty 0〜5。
- UI、D1にmanifest、生成装備descriptor、Blueprint選択、補給使用を保存。
- 人間テスト前の公開条件。

### 16.2 最初の実装で行わない

- 6個以上の新SkillPack。
- 新人物、物語本編、アート量産。
- affix個別reroll、合成、取引。
- online season、日次、週次、ランキング。
- capacity 3〜5の実際の解禁。
- Difficulty 6〜20の内容量産。
- endlessの本実装。
- funの自動判定。
- PR #49の人間評価を省略した長期コンテンツ量産。

## 17. 実装Gate

実装担当はコード前にPREFLIGHTとTRACEABILITYを作る。

### Gate A — 反証

最低限、次の反例を検討する。

- 最初から持込Blueprintだけで全報酬が無意味になる。
- manifest外Blueprintが毎回同じ構成を固定する。
- 低難度farmが最高Blueprintの最適入手法になる。
- rarityが単純な上位互換になる。
- generatorがdead ruleまたは無料循環を作る。
- 新しい解禁がpool dilutionだけを起こす。
- 敗北保存が即放棄farmを支配させる。
- 12戦が長いだけで途中の問いを変えない。
- enemy mutationがhard counterになる。
- save migrationでPR #49の進行を失う。

結果を変える二つ以上の解釈が残れば停止する。

### Gate B — 状態分離

- 新遠征でrunSkillPoints、runUnlockedSkills、inventory、suppliesが初期化される。
- characters、Blueprint、codex、difficultyは保持される。
- ProfileStateへ戦闘中HPやrun装備が混入しない。
- 旧saveからのmigrationをfixtureで固定する。
- reloadで遠征とBlueprint archiveが壊れない。

### Gate C — 生成決定性

- 同一seedのmanifest、12 encounter、全reward、全itemが100回JSON深一致。
- rerollが後続encounterと後続rewardを変えない。
- item順を変えてもblueprintIdがcanonical descriptorから同じになる。
- 異なるdrop keyが同じdefinitionIdになった場合、衝突を検知する。

### Gate D — 装備安全性

Fast check:

- 1,000生成品をcompileし、validator error 0。
- trigger/effect欠落0。
- power/complexity budget違反0。
- 個別人物／技能／装備ID参照0。
- 無限循環用fixture以外で既定event上限到達0。

Slow check:

- 50,000生成品のschema、compatibility、ID衝突を検査。
- 代表戦闘へ装着し、停止診断とevent因果を検査。
- 毎push一分制限を守り、slow checkは手動・週次へ置く。

### Gate E — Blueprint

- item → Blueprint → itemのcanonical descriptorが一致。
- rarity、affix、tier、rollQuality、resolvedParametersが一致。
- 一Blueprintから一遠征に二個生成できない。
- carry capacity超過を拒否。
- manifest外affixでも持込品が機能する。
- disabled Blueprintがarchiveから消えない。
- 勝利2件、敗北1件の保存上限を固定する。

### Gate F — 遠征

- 4、8、12戦目がboss。
- 12戦目勝利でrun won。
- 補給3開始、上限5。
- 敗北再挑戦で1消費し、同じBattleInput seedになる。
- 補給0敗北でrun lost。
- reward rerollとscoutも同じ補給を消費する。
- inventory 12超過を拒否。
- run終了時にrun資産が次runへ漏れない。

### Gate G — 敵と難易度

- Encounterの総threat costがbudget以下。
- mutation incompatibility違反0。
- 位置重複0、敵5体以上0。
- mutationとboss lawを戦闘前に完全表示。
- Blueprint強度による隠れbudget変更0。
- Difficulty 0〜5の差分を開始画面とログへ保存。

### Gate H — 人間テスト公開

既存HUMAN_TEST_RELEASEを満たす。さらにD1へ次を保存する。

- manifest全体と選択候補。
- carryしたBlueprint。
- 生成装備descriptorと報酬候補。
- 装備取得、破棄、分解。
- run中の大きなloadout変更。
- 補給の取得・使用理由。
- 敗北、再挑戦、放棄。
- 終了時に保存したBlueprint。
- 最終構成と戦闘event。

## 18. 人間評価

初回の実装評価では長期性を証明しない。まず2遠征以内で、仕組みが次の行動を生むかを見る。

支持信号:

- 開始時に「今回は○○が強そう」と具体的に言う。
- 新装備によって人物、技能順、装備先を大きく変える。
- 補給をrerollに使うか残すか迷う。
- 終了時に保存Blueprintを迷い、その品の発火契機を説明できる。
- 次回に持ち込むBlueprintまたは別manifestを自発的に考える。
- 24時間以内に、依頼されず再度開く。

失敗信号:

- rarityだけを見て常に上位品へ交換する。
- 持込Blueprintを毎回同じ4人へ付け、run報酬を見ない。
- 生成装備の文章が長く、何が起きるか説明できない。
- inventory整理が戦闘構築より長い。
- manifestを読まず、同じ初期構成で進む。
- 敗北理由が分からず、同じ構成で再試行する。
- 一遠征が長いだけで、戦闘4回ごとの問いが変わらない。

## 19. 実装順

1. State splitとsave migration。
2. Manifest、SkillPack、12戦のrun shell。
3. 装備affix schema、compiler、deterministic generator。
4. Blueprint archiveとcarry capacity 1〜2。
5. 補給、inventory、報酬。
6. Enemy chassis、mutation、threat budget。
7. Difficulty 0〜5。
8. UIとD1。
9. 機械Gate。
10. 公開条件を満たした後、作者1〜2遠征。
11. 作者結果の判定前に、新SkillPackやDifficulty 6以降を量産しない。

## 20. 実装担当が決めてよいHOW

- ファイル分割。
- generator内部の探索順。
- canonical JSONと安定hashの実装。
- affix compilerの中間表現。
- migration関数の実装方式。
- fast/slow testの配置。
- UIの部品構成。
- D1 payloadの後方互換方式。

次は独自に変えない。

- run/metaの境界。
- 12戦とboss位置。
- 補給の用途。
- Blueprintのexact copy、archive上限なし、carry上限。
- carry capacityの解禁条件。
- 敵がBlueprintへ隠れて追従しないこと。
- rarityの構造。
- 人間テスト前に長期コンテンツを量産しないこと。

## 21. 停止条件

- PR #49とmainの差により、state migrationの正しい起点を特定できない。
- 既存R5 schemaでは手続き生成品を個別content ID分岐なしにcompileできない。
- exact Blueprintを保存すると、既存saveやcontent versionを安全に読めない。
- generatorの停止性を50 attempt以内で保証できない。
- Fast checkが一分を超え、slow経路へ分離できない。
- Blueprint持込とmanifest制限のどちらを優先するかが実装中に再び曖昧になる。
- UIがrule全文を表示できず、rarity色だけで選ぶ状態になる。
- PR #49のコアプレイが理解可能か未確認なのに、技能・敵・affixの量産が必要になる。

停止時は、反例、影響、最小修正案をPREFLIGHTへ保存し、作者へE2E代行を求めない。

## 22. この設計が採用するもの／採用しないもの

採用する:

- Super Auto Pets型の、runごとに異なる使用可能集合。
- ハクスラ型の、奇跡的なランダム複合装備。
- Slay the Spire型の有限run、明示難易度、クリア後の高難度。
- 横方向の永続アンロック。
- 一品の来歴とexact ruleを保存するBlueprint。
- エンドレスでの数値インフレと到達深度。

採用しない:

- 全技能・全装備が一つのsaveへ単調蓄積するだけの進行。
- 敵がプレイヤー戦力を見て自動的に同じ強さへ追従する方式。
- 無制限の永続攻撃力上昇。
- 一敗即リセットと、無損失無制限retryの両極端。
- 名前指定の完成コンボ。
- rarityだけで決まる上位互換。
- 理論上の組み合わせ数を面白さの証拠とすること。
