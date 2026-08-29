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
- 遠征結果に応じて、ギルドの「活動資金」を得る。敗北・放棄でも、その遠征で確定した分は失わない。
- 次の遠征へ持ち込める設計図は最初1枚。活動資金で最大5枚まで、非常に高い費用を払って増やす。
- 持込設計図からは、その遠征に一つだけ同じ装備を再製造する。敵は持込品や永続鍛錬に合わせて隠れて強くならない。
- 技能、装備基材、affix family、人物、補給、目利きは活動資金で横方向へ解禁する。難易度だけは一つ前のrankのクリアで順番に解禁する。
- 人物ごとの永続鍛錬は上限なしで許す。ただし一段+0.1%、高い初期費用、二次的に増える費用とし、有限解禁を取り終えた後のendless用sinkにする。
- 技能は手作業で「少なくとも一つの一般的な強み」を保証する。生成装備は平均的には技能より弱くてよく、複数の独立ruleが偶然噛み合うセレンディピティを担う。
- 通常クリア後に難易度0〜20とendless深度を置く。endlessでも活動資金と永続鍛錬が残り、周回を完全な無駄にしない。

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
- 永続能力上昇は人物ごとの威力と最大HPだけに限定する。上限は設けないが、一段+0.1%、費用増加、全量表示を不変条件とし、speed、AP、RP、防御率は上げない。
- 通常の人物行動には必ず攻撃手段がある。技能未装備・不発時は通常攻撃、純支援技能の解決後は威力50%の追撃を行う。明示された「溜め」だけを例外にする。
- 装備の説明は、複数ruleを持つ場合もruleごとに発火契機、条件、代償、効果、制限を省略せず表示する。
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
  activityFunds: string;              // 10進整数。永続化はnumberでなくbigint文字列
  activityFundsLifetimeEarned: string;
  metaUpgradeLevels: Record<MetaUpgradeId, number>;
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
  trainingLevels: {
    potency: number;                  // damage / heal / barrier、1 level = +10 bps
    vitality: number;                 // maxHp、1 level = +10 bps
  };
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
  fundLedger: RunFundLedger;
  status: "active" | "won" | "lost" | "abandoned";
};

type RunFundLedger = {
  clearedEncounterKeys: string[];     // retryしても同じencounterは一度だけ
  clearedEncounterBase: number;
  highestClearedEncounter: number;
  outcomeBonus: number;
  firstClearBonus: number;
  difficultyMultiplierBps: number;
  provisionalTotal: number;
  settled: boolean;
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

活動資金は4候補から選ぶ報酬ではない。戦闘結果から別枠で仮計上し、遠征終了時に勝敗を問わず精算する。補給や技能点を選んでも、活動資金の獲得量は減らない。

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

### 6.4 攻撃テンポを保証する基礎規則

技能数が増えても、支援技能だけを連打して戦闘が止まらないよう、次をengine invariantにする。

- 全人物はskill slotを消費しない basic_strike を常備する。基準威力は100%。
- active技能は offense、utility、channel のいずれかを静的dataで持つ。
- offense は、使用可能と判定されたなら、生存敵へ少なくとも一つのdirect damage proposalを必ず作る。
- utility の全ruleを解決した後、同じactorが生存敵へ威力50%の fallback_strike を一度だけ行う。
- channel は追撃を行わない明示的例外である。使用回数、cooldown、次行動での解決のいずれかを必須にし、連続使用で停止できないようにする。
- 技能未装備、全技能が不発、または有効対象なしなら basic_strike を行う。
- fallback_strike は通常のdamage / hit eventを発生させ、汎用のon-hit ruleを発火できる。ただし追撃を生成する判定そのものはrule effectではなくaction resolverが一度だけ行い、追撃から別の追撃は生まれない。
- stun等でactor自身が行動不能な場合は攻撃保証の対象外とする。

utility は「支援に加えて半分の通常攻撃」、offense は「通常攻撃以上の攻撃と付随効果」という比較になる。支援が無料の上位互換にならないよう、utility側の効果量は50%追撃込みで手作業調整する。

新SkillPackのactive 4個は、原則3個以上をoffenseにする。offenseの多くは、攻撃だけでなく防壁、移動、mark、回復、行動権などの小さい付随効果を持ってよい。純utilityはactive技能pool全体の25%以下を目標にし、報酬3候補にはoffenseを最低2個含める。装備条件として「攻撃技能を必ず装着」を課す必要はない。

技能は生成しない。各技能は公開前に、名前指定の相方なしで次を満たす。

1. 基準人物と中立敵で、basic strikeと異なる用途を一文で説明できる。
2. 少なくとも二つの異なる味方構成または敵条件で、採用理由がある。
3. 常にbasic strike以下でも、あらゆる相手への上位互換でもない。
4. active技能全体の攻撃比率と、戦闘のdirect-damage行動比率を下げすぎない。

### 6.5 既存24技能の移行

- strike、heavy_swing等、direct damageを保証できるものは offense。
- mend、triage、bulwark、reposition等の純支援は utility とし、解決後に50%追撃。
- relay_order等、別人物の即時攻撃を確実に発生させる技能は、実event列にdirect damageが含まれるなら offense としてよい。
- prep系のうち行動を溜めること自体が代償のものだけを channel にする。単なる支援をchannelへ逃がさない。
- skill tagだけで分類し、人物IDや個別敵IDによる例外を作らない。

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
  rules: RolledEquipmentRule[];
  maxDurability: number;
  displayName: string;
  tags: string[];
  origin: ItemOrigin;
};

type RolledEquipmentRule = {
  ruleIndex: number;             // canonical順。0から連番
  parts: RolledAffix[];          // trigger / condition / cost / effect / modifier
  powerSpent: number;
  complexitySpent: number;
  resolvedLimit: {
    scope: "chain" | "round" | "battle";
    maxActivations: number;
    durabilityCost: number;
  };
};

type RolledAffix = {
  affixId: string;
  tier: number;
  rollQuality: number;           // 0..100
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

一つの完結した装備ruleは次からなる。

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

triggerだけ、effectだけの不完全なruleを生成しない。基材は第1ruleのtriggerとeffectを供給してよいが、第2rule以降もそれぞれ単独で発火できるtriggerとeffectを必ず持つ。

高rarity装備は、同じ一ruleへ副詞を増やすだけでなく、独立した完結ruleを複数持てる。rule間に設計者が完成コンボを埋め込まない。偶然、rule Aのeffectがrule Bのtriggerやconditionを満たすことは許し、それをcanonical event列と停止上限で安全に処理する。

個別技能ID、人物ID、装備IDをpredicateへ埋め込まない。event type、tag、source relation、target relationだけを使う。

### 7.4 rarity

初期値は次とする。値はfun判定前の生成設定であり、テストを通すために後から変更しない。

| rarity | 完結rule数 | 一itemの総affix目安 | 特徴 | total power budget |
|---|---:|---:|---|---:|
| common | 1 | 1〜2 | 基材の意味が明瞭 | 2 |
| rare | 1〜2 | 2〜4 | 一つの強めのrule、または弱い二用途 | 4 |
| epic | 2〜3 | 4〜7 | 独立した複数用途が偶然共存する | 7 |
| legendary | 3〜4 | 6〜10 + keystone 0〜1 | 多文脈。各ruleは単体で読める | 10 |

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

budgetはitem全体で一つだけ持ち、複数ruleへ分配する。rule数が増えてもbudgetをrule数倍しない。各ruleは最低1を消費し、同一item内の完全に同じcanonical ruleは拒否する。これにより、高rarityは「強いruleを複数積んだ確定上位品」ではなく、「一つ一つは弱めだが、用途が重なれば奇跡になる品」になりやすい。

同じbudgetでも用途が異なるようにし、rarityを単純な上位互換にしない。高rarityは広く強いのではなく、複数の文脈を持つか、強い代わりに代償が大きいものとする。

### 7.6 生成手順

1. runSeed、encounterIndex、rewardSlotからitemSeedを作る。
2. rarity tableでrarityを決める。
3. manifestのenabledAffixFamilyIdsから基材を選ぶ。
4. rarityからrule数をrollし、total power / complexity budgetを各ruleへ最低1ずつ分配する。
5. 各ruleを独立に、完全なtrigger→condition/cost→effect→limitとして生成する。
6. compatibility、item総budget、rule単体budget、cross-rule停止条件を検査する。
7. resolvedParametersとdisplayNameを確定する。
8. EquipmentDefへcompileする。
9. validateContentBundleを通す。
10. generator固有のdead-rule、同一rule重複、無料循環検査を通す。
11. 失敗なら同じitemSeedのattempt番号を増やして再生成する。
12. 50 attemptで生成不能なら、既定品へ黙ってfallbackせず診断エラーにする。

生成された定義IDとrule IDはcanonical descriptorから決定的に作り、contentBundle内で一意にする。

### 7.7 名前と役割分担

生成品へ個別の固有名を手書きしない。displayName は次の決定的な部品から作る。

1. baseIdに対応する基材名。
2. 最もpowerを使ったruleのtrigger/effect motif。
3. 二番目に目立つruleのmotif。存在しなければ省略。
4. 同名descriptorが同じarchiveにある場合だけ、hash先頭4桁を表示上のsuffixにする。

表示例は「黄銅の短剣〈余熱・返礼〉」程度とし、名前から全効果を推測させない。詳細欄は RULE I、RULE II のように分割して全文を出す。

技能は意図して選べる主構築、装備は偶然から再評価を起こす副構築とする。

- 技能: 手作業、すべてに一般的な採用理由、manifest内で選択可能。
- 装備: 完全なseed生成、弱い品や用途の狭い品も許す、奇跡的な複数rule一致をBlueprintで保存。
- 装備の平均期待値を上げて全品を有用にしない。読み捨てられる品があるから、稀な一致が記憶に残る。
- ただしdead rule、説明不能、発火不能、無料無限循環は「弱い品」ではなくgenerator bugとして拒否する。

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
- 再製造品はsourceItemの全rule、affix、tier、rollQuality、resolvedParametersを完全に保持する。
- 再製造品は通常のinventory上限と装備枠を使う。
- 同じBlueprintを複製して複数人物へ配らない。
- manifestに含まれないaffix familyでも持込品は有効。これが長期報酬である。
- 敵のthreat budgetは持込品数や強さを見て自動変更しない。
- 低難度を過去の強い設計図で圧倒することは許す。次の挑戦は明示的な高難度で行う。

### 8.4 carry capacityの購入

初期値1、v1最大値5。難易度実績による直接解禁は廃止し、活動資金だけで購入する。前のslotを購入済みであること以外に、難易度、地域、achievementの条件を付けない。

| capacity | 追加slotの費用 | 累計費用 |
|---:|---:|---:|
| 1 | 初期所持 | 0 |
| 2 | 4,000 | 4,000 |
| 3 | 20,000 | 24,000 |
| 4 | 100,000 | 124,000 |
| 5 | 500,000 | 624,000 |

slot 2は早期の目標、slot 4以降は長期目標、slot 5はendgame目標である。数値は「旧案の40 / 200 / 1,000 / 5,000を100倍した初期値」であり、作者テスト前に値下げして取得を急がせない。

## 9. ギルドの活動資金

### 9.1 名前と単位

世界観上の名称は「活動資金」とする。遠征、調査、補給、人材育成へ使うギルド共通の資金であり、抽象的な魂、記憶、転生資源にはしない。

内部値は非負の整数だけを使う。初期の概念値1を100として設計し、通常戦一勝を100前後にする。1000倍ではなく100倍を採用する理由は、将来1%単位の調整余地を残しつつ、UIの桁を無用に増やさないためである。永続saveではJS safe integer超過を避けるため10進文字列で保存し、計算はbigintで行う。

### 9.2 遠征精算

活動資金は戦闘ごとにProfileへ直接加算せず、RunFundLedgerへ仮計上する。遠征の勝利、敗北、放棄のいずれかで一度だけ精算し、同じrunIdを二重精算しない。

基礎値:

| 確定した結果 | base |
|---|---:|
| 通常戦を初回撃破 | 100 |
| 精鋭戦を初回撃破 | 180 |
| ボスを初回撃破 | 320 |
| 到達距離 | クリア済み戦闘数 × 25 |
| 12戦完走 | 600 |
| その地域・rankの初回クリア | 800 + rank × 100 |

同一run内で同じencounterをretryしても、撃破baseは一度だけ。敗北そのもの、同じ敵への反復、戦闘開始直後の放棄には資金を与えない。途中まで確定した撃破baseと到達距離は、最終的に負けても持ち帰る。

~~~ts
difficultyMultiplierBps = 10_000 + difficultyRank * 1_000;
activityFundsEarned =
  floor(
    (clearedEncounterBase + highestClearedEncounter * 25
      + outcomeBonus + firstClearBonus)
    * difficultyMultiplierBps
    / 10_000
  );
~~~

rank 0の12戦を通常9、boss 3として初回クリアすると、初期値では3,560を得る。rank 0で7戦まで勝って8戦目で終了した場合は、敵種別によるが約1,100を持ち帰る。高難度は+10% / rankなので、低難度farmを完全禁止せず、高難度へ進む方が時間効率で有利になる。

endlessは4戦blockを一精算単位とし、通常のdifficulty倍率へ completedEndlessBlocks × 200 bps を加える。block途中で敗北しても、そのblock内で確定した個別撃破baseは残す。

### 9.3 ギルド投資

難易度以外の永続解禁は、原則すべて活動資金で購入する。同一upgradeのlevel順以外にachievement条件を置かない。

~~~ts
type MetaUpgradeDef = {
  id: MetaUpgradeId;
  category:
    | "blueprint_capacity"
    | "starting_supplies"
    | "skill_pack"
    | "equipment_pool"
    | "character"
    | "appraisal"
    | "training";
  maxLevel?: number;                    // trainingだけ省略＝上限なし
  costs: string[] | { formulaId: string };
  unlocks: string[];
};

type MetaPurchase = {
  purchaseId: string;
  upgradeId: MetaUpgradeId;
  fromLevel: number;
  toLevel: number;
  cost: string;
  balanceBefore: string;
  balanceAfter: string;
};
~~~

初期価格帯:

| 投資 | 初期仕様 |
|---|---|
| Blueprint持込枠 | §8.4の4,000 / 20,000 / 100,000 / 500,000 |
| 開始補給 | 3→4は12,000、4→5は60,000。上限5 |
| SkillPack | 1 pack 3,000〜30,000。購入後も各遠征ではmanifestに選ばれたpackだけが出る |
| 装備基材 / affix family | 一群2,000〜20,000。購入は生成poolを増やすが、全遠征へ必ず出現させない |
| 新人物 / signature variant | 一件10,000〜50,000。人物固有の完成コンボではなく共有eventへの別角度を増やす |
| 目利き | 5 level、15,000 / 45,000 / 120,000 / 300,000 / 750,000 |
| 人物鍛錬 | §9.5。各人物・各能力ごとに上限なし |

購入画面は、現在残高、購入後残高、何がpoolへ加わるか、次level費用を常に表示する。購入は取消不能なので、確認画面に「この遠征で必ず出るわけではない」ことも表示する。

pool dilutionを避けるため、解禁済みSkillPackが増えても一遠征のenabled pack数は増やさない。開始時にseed生成されたmanifest候補3つから選ぶ。

### 9.4 目利き

目利きは全dropを高rarity化しない。各報酬offerの先頭の装備候補一枠だけを lucky slot とする。levelをL（0〜5）として、その枠の最低rarityから次のrarityへ重みを次の通り移す。§7.4の70 / 25 / 5等は表示上の百分率であり、計算前に100倍して合計10,000 bpsへ正規化する。

- commonがあるtable: commonから 100 × L bpsを引き、rareへ80%、epicへ18%、legendaryへ2%を配る。
- commonがないtable: 現在の最低rarityから同量を引き、一段上へ80%、二段上へ20%を配る。
- legendaryより上へ配る分はlegendaryへ寄せる。
- 負のweightは0でclampし、余りは最低rarityへ戻して総計10,000 bpsを保つ。
- 他の装備候補、持込Blueprint、敵threatは変えない。

level 5でも通常tableのcommonが5 percentage points減るだけである。奇跡を日用品にせず、「少しだけ良い抽選を一枠増やした」感覚に留める。

### 9.5 上限なしの人物鍛錬

有限解禁を取り終えた後も遠征を無駄にしないため、各人物に potency と vitality の二系統だけを置く。

- potency 1 level: その人物がsourceのdamage、heal、barrierの基礎量を+10 bps（+0.1%）。
- vitality 1 level: その人物の遠征開始時maxHpを+10 bps（+0.1%）。
- speed、AP、RP、防御率、target priority、発火回数は上げない。閾値や行動回数を壊しやすいためである。
- level上限なし。費用は人物・能力ごとに独立。
- 現在levelをLとすると、次の一段の費用は次式。100単位に切り上げる。

~~~ts
rawCost = 10_000n + 1_000n * L + 25n * L * L;
cost = ((rawCost + 99n) / 100n) * 100n;
~~~

level 0→1は10,000、level 10→11は22,500を22,500のまま、level 100→101は360,000である。効果は線形、費用は二次増加なので、購入は続けられるが有限解禁より急速に割高になる。

戦闘計算はbasis pointの固定小数で行う。整数damage等へ丸める際はactor・effect categoryごとのdeterministic residueをBattleState内で持ち、小さいbonusが永遠に切り捨てられないようにする。residueは戦闘外へ持ち越さない。

永続鍛錬で過去の低難度が簡単になることは許す。敵を鍛錬量へ自動追従させない。挑戦は明示difficultyとendlessで取り戻す。UI、BattleInput、結果logへ人物ごとの鍛錬bpsを残す。

### 9.6 難易度だけはクリアで解禁する

rank 0だけを初期解禁する。同じ地域のrank Nをクリアするとrank N+1を解禁する。活動資金でrankを買えず、rankを飛ばせず、持込Blueprint数やretry回数などの追加achievement条件も付けない。rank 20クリアでendlessを解禁する。

## 10. inventory

- 遠征中inventoryは12品まで。
- 装備中の品も12品に含む。
- 報酬取得で13品目になる場合、その場で一品を分解するか新報酬を捨てる。
- 分解すると遠征内通貨ではなく補給1/2相当のscrapを得る。scrap 2で補給1へ変換できる。
- v1ではaffix crafting、reroll、合成を実装しない。報酬候補全体のrerollだけを補給1で行う。
- Blueprint化は遠征終了時だけ。戦闘中の一時状態や摩耗状態は保存しない。

## 11. 敵生成とスケール

### 11.1 敵も同じ小規則で構成する

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

### 11.2 threat budget

- 戦闘番号ごとのbase budgetをデータで持つ。
- 難易度modifierがbudgetを明示的に加算する。
- chassis、追加個体、mutation、boss lawがbudgetを消費する。
- HP/攻撃倍率は最終微調整だけに使い、難易度の主役にしない。
- 最大4体、位置重複なし。
- 一つのskill packを完全に無効化するhard counterを生成しない。
- 「準備中を狙う」「最初の防壁を反響する」のように、庇う、位置、速度、別技能で迂回可能なsoft counterにする。
- 全enemy mutationとboss lawを戦闘前に表示する。

初期のbase budgetは、現在の7戦を基準に実測し、12段階へ単調増加させる。実装担当が数値を決める前に、現在の7戦をchassis/mutationへ分解した対応表をPREFLIGHTへ出す。

### 11.3 boss

各bossは次を持つ。

- 固有chassisまたは外見。
- 公開されたboss law 1個。
- difficultyによるmutation 0〜2個。
- 少なくとも三つの異なる対応方法。
- 最終bossだけを倒せる専用技能や専用装備を作らない。

ボス法則は遠征開始時から見える。途中の報酬を「最後に向けて取る」判断を可能にする。

## 12. 敗北と補給

### 12.1 補給

- 遠征開始時3。
- 上限5。
- 報酬の補給+1、scrap 2の交換で増える。
- 次の三用途で共有する。

1. 敗北後、編成を変更して同じ戦闘へ再挑戦: 1。
2. 報酬4候補を一度だけ再生成: 1。
3. 次幕の通常敵個体編成を早期に偵察: 1。

boss law、enemy family、region lawは補給を使わなくても見える。偵察で見えるのは個体、位置、mutationの組み合わせである。

### 12.2 敗北処理

- 敗北後、即座に遠征を破棄しない。
- 補給が1以上なら、1消費してcampへ戻り、人物、位置、技能、装備を変更して同じBattleInput seedへ再挑戦できる。
- 敵を強化しない。報酬も変更しない。
- 補給0で敗北したら遠征終了。
- 任意に遠征を放棄できる。
- 敗北または放棄でもBlueprintを1件保存できる。
- 敗北理由、最後に発火したrule、未使用資源、装備摩耗、主要なtarget変更を結果画面に残す。

補給をrerollへ使うと再挑戦余地が減る。これが遠征全体の勝敗以外のトレードオフになる。

## 13. 難易度、一区切り、エンドレス

### 13.1 明確な完了

- 難易度0の12戦目撃破で地域クリア。
- 初回クリア時に短いキャラクター場面とcredits相当の区切りを出す。
- 難易度10で地域の正式制覇。
- 難易度20で設計上の最高難度を完了。
- 以後はendless depthを記録する。

### 13.2 難易度modifier

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

rankは§9.6の通り、一つ前のrankクリアだけで順番に解禁し、全変更を開始前に表示する。活動資金では購入できない。最初の実装は0〜5だけでよい。6〜20は同じschemaで追加する。

例:

- Rank 1: 全戦闘threat budget +1。
- Rank 2: 精鋭へmutation +1。
- Rank 3: 通常戦のmaxRounds -1。
- Rank 4: 各bossへmutation +1。
- Rank 5: starting supplies 2。

以後も、見える変異、budget、資源制約を優先する。単純な敵HP倍率を毎rank積まない。

### 13.3 endless

- 難易度20後に解禁。
- 12戦後も4戦単位で続く。
- 4戦ごとにthreat budget、mutation count、数値倍率を増やす。
- 無限の公平性や全buildの生存を保証しない。
- 個人記録はdepth、boss撃破、使用Blueprint、構成fingerprintを保存する。
- ここでは数値インフレと圧倒を許す。活動資金と人物鍛錬は本編にも残るが、敵が自動追従せず、低難度が簡単になることを許容する。

## 14. 拡張単位

新しい仕組みを追加するときは、単一技能や単一敵だけを足さず、SkillPack単位で追加する。

一パックは、既存の少なくとも三つのevent typeを読み、少なくとも二つのevent typeを新たに発生させる。専用イベントを追加する場合は、人物、技能、装備、敵のうち三領域以上で使う反例を先に示す。

新パック追加によって一遠征の表示量を増やさない。manifestが選ぶパック数は4前後に固定する。

これにより、総コンテンツは増えるが、一回のプレイヤーが把握する局所ルール量は増え続けない。

## 15. UI要件

### 15.1 遠征開始

一画面で次を表示する。

- 有効SkillPack。
- 有効affix family。
- enemy family。
- 3体のbossと法則。
- region law。
- 難易度modifier。
- Blueprint carry capacityと現在選択数。

三つのmanifestから選ぶ段階では、それぞれを同じ比較軸で横並びにする。

### 15.2 装備

装備説明は次の順で固定する。

1. WHEN — 何が起きたとき。
2. IF — 追加条件。
3. PAY — 支払うもの。
4. DO — 起きる効果。
5. LIMIT — 発火上限と耐久。

rarity色だけで強さを判断させない。event名、対象relation、値、耐久を必ず文字で出す。

### 15.3 Blueprint archive

- 名前、rarity、全rule、来歴、最初に使った人物を表示。
- favorite、検索、filter。
- 遠征開始時に選択し、capacity超過を拒否。
- Blueprintから生成される実物がexact copyであることを表示。
- disabled Blueprintを消さず、理由を表示。

## 16. 決定性とversioning

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

## 17. 実装境界

### 17.1 最初の実装で行う

- ProfileStateとRunStateの分離。
- 既存saveのmigration。
- 活動資金の仮計上、勝敗を問わない一回精算、購入transaction。
- 12戦、3boss、補給3。
- 全人物のbasic strike、技能action mode、utility後の50%追撃。
- 現24技能の4パック化と、3パックを使うmanifest。
- equipment generator v1。epic以上で複数の完結ruleを生成する。
- Blueprint archive、勝利2／敗北1の保存。
- carry capacity 1、およびcapacity 2の4,000での購入。
- inventory 12。
- threat budgetとenemy mutationのschema。
- Difficulty 0〜5。
- UI、D1にmanifest、生成装備descriptor、Blueprint選択、補給使用を保存。
- 人間テスト前の公開条件。

### 17.2 最初の実装で行わない

- 6個以上の新SkillPack。
- 新人物、物語本編、アート量産。
- affix個別reroll、合成、取引。
- online season、日次、週次、ランキング。
- capacity 3〜5の実際の購入。
- 全SkillPack、全装備family、全人物の解禁内容量産。
- Difficulty 6〜20の内容量産。
- endlessの本実装。
- funの自動判定。
- PR #49の人間評価を省略した長期コンテンツ量産。

## 18. 実装Gate

実装担当はコード前にPREFLIGHTとTRACEABILITYを作る。

### Gate A — 反証

最低限、次の反例を検討する。

- 最初から持込Blueprintだけで全報酬が無意味になる。
- manifest外Blueprintが毎回同じ構成を固定する。
- 低難度farmが活動資金と最高Blueprintの両方で最適になる。
- 活動資金を稼ぐため、勝ち目のない戦闘を同一runでretryし続ける。
- 永続鍛錬が有限投資より先に買う最適解になる。
- rarityが単純な上位互換になる。
- 複数rule装備が説明不能またはcross-rule無料循環になる。
- 支援技能だけでdirect damageが止まり、戦闘が泥仕合になる。
- generatorがdead ruleまたは無料循環を作る。
- 新しい解禁がpool dilutionだけを起こす。
- 敗北保存が即放棄farmを支配させる。
- 12戦が長いだけで途中の問いを変えない。
- enemy mutationがhard counterになる。
- save migrationでPR #49の進行を失う。

結果を変える二つ以上の解釈が残れば停止する。

### Gate B — 状態分離

- 新遠征でrunSkillPoints、runUnlockedSkills、inventory、suppliesが初期化される。
- characters、Blueprint、codex、difficulty、活動資金、購入済み投資、人物鍛錬は保持される。
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
- rarity、全rule、affix、tier、rollQuality、resolvedParametersが一致。
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

### Gate G — 活動資金と永続投資

- 通常、精鋭、boss、距離、完走、初回clearの全fixtureが§9.2の整数式と一致。
- 同一encounterを何度retryしても撃破baseは一度だけ。
- 勝利、敗北、放棄で確定分を持ち帰り、同じrunIdの二重精算を拒否。
- 0未満の残高、残高不足購入、level飛ばし、同一purchaseIdの二重適用を拒否。
- activityFundsと費用はbigintで計算し、profile export/importで10進文字列が一致。
- Blueprint capacity 2の費用4,000、開始補給、目利き、人物鍛錬の購入結果をfixture化。
- 人物鍛錬のcost式、+10 bps、deterministic residueが同一入力で一致。
- 永続投資による敵threatの隠れ変更0。
- rank N未clearでN+1開始を拒否し、rank N clearでN+1だけを解禁。活動資金によるrank購入経路0。

### Gate H — 攻撃テンポと技能品質

- 技能未装備、全技能不発で100% basic strike。
- utility解決後に50% fallback strikeが一度だけ発生し、追撃から追撃0。
- offenseが使用可能なのにdirect damage proposal 0となるcontentをvalidatorが拒否。
- channelに使用上限、cooldown、次行動解決のいずれも無いcontentを拒否。
- active skill poolのutility比率25%以下、新packのactive 4中offense 3以上。
- reward技能3候補のoffense 2未満0。
- 全人物生存・行動可能な代表build 10,000 actor-turnで、direct damageを含むturn 75%以上。
- 生存敵と行動可能な味方がいるのに、direct damage proposal 0が2 round連続するfixture 0。
- 各技能に、名前指定の相方なしで採用理由が二文脈以上あることをcontent review表へ記録。

### Gate I — 敵と難易度

- Encounterの総threat costがbudget以下。
- mutation incompatibility違反0。
- 位置重複0、敵5体以上0。
- mutationとboss lawを戦闘前に完全表示。
- Blueprint強度による隠れbudget変更0。
- Difficulty 0〜5の差分を開始画面とログへ保存。

### Gate J — 人間テスト公開

既存HUMAN_TEST_RELEASEを満たす。さらにD1へ次を保存する。

- manifest全体と選択候補。
- carryしたBlueprint。
- 生成装備descriptorと報酬候補。
- 装備取得、破棄、分解。
- run中の大きなloadout変更。
- 補給の取得・使用理由。
- 活動資金の仮計上、難易度倍率、精算、購入履歴。
- 人物鍛錬bpsと戦闘へ適用した固定小数residue。
- 技能action mode、basic / fallback strike、攻撃を含むturn比率。
- 敗北、再挑戦、放棄。
- 終了時に保存したBlueprint。
- 最終構成と戦闘event。

## 19. 人間評価

初回の実装評価では長期性を証明しない。まず2遠征以内で、仕組みが次の行動を生むかを見る。

支持信号:

- 開始時に「今回は○○が強そう」と具体的に言う。
- 新装備によって人物、技能順、装備先を大きく変える。
- 補給をrerollに使うか残すか迷う。
- 活動資金をBlueprint枠、content解禁、補給、目利きのどれへ使うか迷う。
- 敗色が濃くても、次の撃破または到達資金のために構成を変えて続ける。
- 終了時に保存Blueprintを迷い、その品の複数ruleを個別に説明できる。
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
- 低難度周回だけが活動資金の時間効率で常に最適になる。
- 有限解禁より人物鍛錬だけを先に買う。
- 支援技能の選びすぎで攻撃が止まる、または50%追撃込みのutilityが常にoffenseより強い。
- 複数rule装備をrarity色だけで選び、各ruleを説明できない。

## 20. 実装順

1. State split、save migration、activityFunds bigint文字列。
2. RunFundLedger、一回精算、購入transaction、rank順次解禁。
3. basic strike、skill action mode、utility後の50%追撃。
4. Manifest、SkillPack、12戦のrun shell。
5. 複数完結ruleを持つ装備schema、compiler、deterministic generator。
6. Blueprint archiveとcarry capacity 1〜2の購入。
7. 補給、inventory、報酬、目利きlevel 0〜1。
8. 人物鍛錬potency / vitalityとfixed-point residue。
9. Enemy chassis、mutation、threat budget。
10. Difficulty 0〜5。
11. UIとD1。
12. 機械Gate。
13. 公開条件を満たした後、作者1〜2遠征。
14. 作者結果の判定前に、新SkillPackやDifficulty 6以降を量産しない。

## 21. 実装担当が決めてよいHOW

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
- 活動資金の100倍単位、敗北時保持、一回精算。
- 難易度だけを一つ前のclearで解禁すること。
- 人物鍛錬の+10 bps、対象能力、費用式、上限なし。
- basic strikeとutility後の50%追撃。
- Blueprintのexact copy、archive上限なし、carry上限。
- carry capacityの活動資金価格。
- 敵がBlueprintや人物鍛錬へ隠れて追従しないこと。
- rarityごとの複数rule構造とitem総power budget。
- 人間テスト前に長期コンテンツを量産しないこと。

## 22. 停止条件

- PR #49とmainの差により、state migrationの正しい起点を特定できない。
- 既存R5 schemaでは手続き生成品を個別content ID分岐なしにcompileできない。
- exact Blueprintを保存すると、既存saveやcontent versionを安全に読めない。
- activityFundsの二重精算をtransactionまたは同等のidempotencyで防げない。
- bigint文字列を既存save、D1、exportでlosslessに扱えない。
- utility後のfallback strikeをevent上限と因果logを壊さず追加できない。
- 複数rule間の無料循環を既存停止検査で検出または制限できない。
- generatorの停止性を50 attempt以内で保証できない。
- Fast checkが一分を超え、slow経路へ分離できない。
- Blueprint持込とmanifest制限のどちらを優先するかが実装中に再び曖昧になる。
- UIがrule全文を表示できず、rarity色だけで選ぶ状態になる。
- PR #49のコアプレイが理解可能か未確認なのに、技能・敵・affixの量産が必要になる。

停止時は、反例、影響、最小修正案をPREFLIGHTへ保存し、作者へE2E代行を求めない。

## 23. この設計が採用するもの／採用しないもの

採用する:

- Super Auto Pets型の、runごとに異なる使用可能集合。
- ハクスラ型の、奇跡的なランダム複合装備。
- Slay the Spire型の有限run、明示難易度、クリア後の高難度。
- 活動資金をどこへ投資するかという永続構築。
- 横方向の永続アンロックと、非常に遅い上限なし人物鍛錬。
- 一品の来歴と複数のexact ruleを保存するBlueprint。
- 通常攻撃を土台に、攻撃へ支援を付随させる技能構成。
- エンドレスでの数値インフレと到達深度。

採用しない:

- 全技能・全装備が一つのsaveへ単調蓄積するだけの進行。
- 敵がプレイヤー戦力を見て自動的に同じ強さへ追従する方式。
- 低費用・大幅・speed/AP/RPまで含む永続能力上昇。
- 活動資金に合わせて敵が隠れて強くなる自動追従。
- 一敗即リセットと、無損失無制限retryの両極端。
- 名前指定の完成コンボ。
- rarityだけで決まる上位互換。
- 理論上の組み合わせ数を面白さの証拠とすること。
