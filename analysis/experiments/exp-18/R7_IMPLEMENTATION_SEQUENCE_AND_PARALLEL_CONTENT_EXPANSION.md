# EXP-18 R7 — 実装順序と並列コンテンツ拡張

> [!IMPORTANT]
> **履歴資料。今後の実装正本ではない。** R6〜R8の状態・経済・固定難易度・content契約・実装順序は [R8 統合実装設計](./R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md) へ統合した。本票は判断経緯の参照に限り、Milestone順序を単独で実装入力にしない。

作成日: 2026-08-30（UTC）  
状態: 実装委譲票。コード変更・作者プレイによる支持はまだない。  
前提: [R6 長期進行・生成装備・設計図](./R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS.md)、PR #49の一周可能試作、PR #50の設計変更。

## 0. 結論

未来のsystemを先に全部実装しない。代わりに、**contentが依存する契約だけを早く広く固定し、各system Phaseで作者が支持した語彙の範囲だけcontent実装を並列化する。**

採用する順序は次である。

1. 現在のcontent集中ファイルを、挙動を変えず種類別へ分離する。
2. ID、event、effect、target、position、数値単位、versioning、validatorというcontent契約を固定する。
3. R6 Phase Aの戦闘基盤だけを実装し、作者1〜2遠征で評価する。
4. 支持後、小さな技能・敵・固定装備のprobe batchを追加し、語彙が量産に耐えるか検査する。
5. Phase B以降は、安定した既存語彙のcontent追加だけをsystem実装と並列に進める。
6. 新語彙を必要とするcontentは先行実装せず、要求票へ蓄積し、次のmechanics packとして一系統ずつ追加する。
7. Phase Cの生成装備契約が支持されるまで、affixや複数rule装備を量産しない。

目指すのは「full system first」ではなく、**thin full contract + validated system slices + growing content**である。

## 1. なぜsystemを全部先に作らないか

system変更でcontentがやり直しになる危険は本物である。しかし、R6の活動資金、12戦run、生成装備、Blueprint、endlessまで先に実装すると、戦闘基盤が面白くなかった場合に最も大きな作り直しが生じる。

逆に、契約なしで技能や敵を大量追加すると、event名、対象規則、隊列、数値単位の変更で全定義が壊れる。

両方を避ける境界は次である。

| 先に作る | 先に作らない |
|---|---|
| 既存IDを維持する規則 | 未来の全mechanics |
| 既存event / effectの意味 | 未検証のevent / effect実装 |
| additiveな語彙追加手順 | 全affix family |
| content schemaとvalidator | 生成装備generator |
| target / formation座標 | Difficulty 20までの敵 |
| 数値単位と丸め地点 | 全数値balance |
| versionとmigration hook | 全meta進行 |
| content fileの分離 | contentの量産 |

将来拡張を可能にするのは、未来を全部予測することではない。**一度公開した意味を変えず、語彙を追加できる構造**である。

## 2. 用語

- **system Phase**: R6のPhase A〜D。engine、run、meta、generator等の仕組み。
- **content wave**: 安定済みの語彙だけで追加する技能、敵、固定装備、encounter。
- **content contract**: content dataが依存してよいID、schema、event、effect、target、単位、validation。
- **mechanics pack**: 新しい共通event / effect / targetを追加する一系統のsystem変更。
- **probe batch**: 量産前に文法と判断差を試す少量content。

## 3. 現在の並列化阻害要因

PR #49では主に次へ責務が集中している。

- `ecology/playable-content.mjs`: 人物、技能、装備等の本番定義。
- `ecology/playable-battles.mjs`: 敵、encounter、報酬、loadout、戦闘入力。
- `ecology/app.js`: UI、save、進行、表示変換。
- `ecology/schema.mjs`、`effects.mjs`、`engine.mjs`、`event-queue.mjs`: 共通engine。

技能担当、敵担当、装備担当が同時に現在の二つのcontentファイルを編集すると、merge conflictだけでなく、同じ定数やregistryを別々に変更する意味衝突が起きる。

Phase AのPREFLIGHTで、動作を変えず次の分離を行うことを推奨する。実装担当は同等以上に衝突を避けるHOWへ変更してよい。

~~~text
ecology/content/
  characters.mjs
  skills-active.mjs
  skills-reactive.mjs
  skills-passive.mjs
  equipment-fixed.mjs
  enemies.mjs
  encounters.mjs
  packs.mjs
  index.mjs
~~~

既存の公開importはadapterで維持し、分離前後のcontent bundleをJSON深一致させる。ファイル分離とgame rule変更を同じcommitへ混ぜない。

## 4. 先に固定するcontent契約

### 4.1 変更時にmigrationを要求するhard contract

- definition IDは永続・一意で、削除後も別内容へ再利用しない。
- 保存済みIDを改名するときはaliasまたはmigrationを持つ。
- 既存event、effect、predicate、scope、tagの意味を変更しない。
- 新語彙はschema versionを上げ、additiveに追加する。
- `front/middle/rear`等の表示語ではなく、2×3のcanonical position IDを保存する。
- HP等の連続量、AP/RP等の離散量をschema上で区別する。
- effect確定時のround-half-upと、block → guard → barrier → HPの順序を固定する。
- contentは人物名、特定skill ID、特定equipment IDを相方条件にしない。
- event事実と表示文を分離する。
- save、D1、replayへcontent versionとdefinition IDを残す。

### 4.2 後で調整してよいsoft data

- 係数、cost、cooldown、発火上限。
- enemy maxHpとparameter。
- encounterの構成とthreat cost。
- reward weightとrarity weight。
- skill point価格。
- 装備のpower budget。
- Difficulty倍率。

soft dataの変更でもbuild/versionを上げ、測定済みrunと混同しない。

### 4.3 未来へ予約するのは拡張口であり、語彙ではない

召喚、復活、属性、地形等を使うかは未決定なので、空の実装や架空eventを先に置かない。必要なのは次である。

- schema registryへ新語彙を追加できる。
- validatorが未知語彙を黙って無視せず拒否する。
- 新schema versionのmigrationを登録できる。
- 旧content bundleを旧versionとして再生できる。
- 一mechanics packだけを追加して検査できる。

## 5. systemとcontentの実装順序

### Milestone 0 — 分離と契約

R6 Phase Aのrule変更前に行う。

1. 実装起点のcommit SHAを記録する。
2. content定義を種類別ファイルへ分離する。
3. 分離前後のbattle input、reward offer、content bundleの深一致fixtureを作る。
4. ID重複、未知event/effect、個別相方参照、数値型をvalidatorで拒否する。
5. engine変更を行える統合担当だけを一人にする。
6. content contract versionを記録する。

この段階では技能、敵、装備を増やさない。

### Milestone 1 — R6 Phase A

R6 §17.1だけを実装する。

- 三桁中心の戦闘量と人物parameter。
- 5人・2×3 formation。
- 3 active / 3 reactive / 2 passive。
- basic strike、utility後fallback strike、常設fallback passive。
- guard、block、barrier。
- basic / heavy / rapid / pierce / row / column。
- 既存24技能のmigration。
- UI、因果log、D1、save migration。

engine、schema、position、damage orderを変更するのはこの統合PRだけとする。content量産PRを同時にmergeしない。

### Milestone 2 — Phase A作者Gate

作者が1〜2遠征を遊び、少なくとも次を自分の言葉で説明・利用できた場合だけ進む。

- 人物parameterの違い。
- 前3後2と前2後3の選択。
- 単発、多段、row、columnの使い分け。
- guard、block、barrierへの攻撃相性。
- 増えたskill枠によって成立した構成。
- fallback passiveを選んだ理由。

支持されなければ、content追加で覆い隠さずPhase Aを修正する。

### Milestone 3 — Content Wave 1

Phase Aが支持された後、量産前のprobe batchを別PRで追加する。

| 種類 | 上限 | 目的 |
|---|---:|---|
| active技能 | 5 | 五つ以上の攻撃軸で評価が変わるか |
| reactive技能 | 2 | 異なる共通eventへ接続できるか |
| passive技能 | 1 | 常時効果がactive/reactiveを押し退けないか |
| 敵unit | 6 | 初動、持続、単体、範囲、耐久、反応の圧力を分けられるか |
| encounter | 6 | 同じ敵でも配置と組合せで問いが変わるか |
| 固定装備 | 6 | 既存eventだけで用途の狭い偶然を作れるか |

この数字は発売時content量ではなく、一回のreviewで因果を追える上限である。一PRへ複数種類を混ぜず、種類ごとに独立させる。

### Milestone 4 — R6 Phase Bと並列拡張

Phase Bのsystem担当はProfile / Run分離、12戦、活動資金、補給、Difficulty 0〜5を実装する。

同時にcontent担当は、**Phase Aで固定済みの語彙だけ**を使う技能・敵・固定装備を追加できる。ただし次は待つ。

- encounterの最終配置と報酬順: 12戦構造が固定するまで待つ。
- enemy threat costの最終値: Phase Bのbudget式が固定するまで待つ。
- SkillPackへの所属と出現率: manifest schemaが固定するまで待つ。
- 永続価格を前提にした強さ: 活動資金収入が固定するまで待つ。

merge順はsystem B → migration/fixture → content rebase → encounter調整 → human releaseとする。

### Milestone 5 — R6 Phase C

生成装備とBlueprintは、技能・敵・固定装備とは別の依存関係を持つ。

Phase Cのgenerator、canonical descriptor、power budget、validatorが固定するまで、次を実装しない。

- procedural affix。
- 複数rule装備。
- rarity別rule数。
- Blueprint保存対象の装備。
- 目利きで変化するroll。

一方、既存語彙だけの技能・敵追加はPhase C system実装と並列可能である。固定装備も生成対象にしない限り追加できる。

Phase Cが作者に支持された後、初めて装備contentの大規模拡張を開始する。

### Milestone 6 — R6 Phase Dと継続運用

Phase D以降は、通常content waveとmechanics packを分ける。

- 通常wave: 既存語彙の技能、敵、装備、encounter、人物。並列可能。
- mechanics pack: 新event/effect/targetを一系統だけ追加。統合担当が直列実装。
- 通常waveはmechanics packのmerge中も旧契約上で作れる。
- 新語彙を使うcontentは、mechanics pack merge後のcontract SHAから作る。

## 6. 並列可能性matrix

| Workstream | 設計開始 | コード開始 | 並列可 | 主な待ち条件 |
|---|---|---|---|---|
| content file分離 | 今 | Milestone 0 | system変更とは分離 | PR #49回帰fixture |
| Phase A engine | 今 | Milestone 1 | UI/logと一部可 | contract分離 |
| Phase A UI / replay / D1 | 今 | Phase A event shape確定後 | engineと可 | event payload |
| 技能catalog | 今 | Phase A作者支持後 | 敵・固定装備と可 | skill schema |
| 敵unit catalog | 今 | Phase A作者支持後 | 技能と可 | parameter / formation |
| encounter編成 | 設計は今 | Phase B run形確定後 | skillと可 | threat budget、12戦 |
| 固定装備 | 今 | Phase A作者支持後 | 技能・敵と可 | equipment rule schema |
| procedural affix | motif設計だけ今 | Phase C契約後 | 技能・敵と可 | generator / descriptor |
| Difficulty調整 | 観測軸は今 | Phase B baseline後 | content追加と交互 | reference build、budget |
| 新mechanics | 要求記録だけ今 | 採択後一系統ずつ | 他mechanicsとは不可 | author decision |

「設計開始」は候補表、目的、圧力軸、利用eventの記述を意味する。未確定schemaを仮定した本番コードは書かない。

## 7. 担当境界

### 統合・system担当

主に次を所有する。

- `ecology/schema.mjs`
- `ecology/validate.mjs`
- `ecology/effects.mjs`
- `ecology/engine.mjs`
- `ecology/event-queue.mjs`
- save migration、version、共通registry

他担当の要求を直接つまみ実装せず、共通性が三つ以上のcontent familyで成立するかを確認する。

### 技能担当

- active / reactive / passiveのdataだけを変更。
- 既存event、effect、predicate、scopeだけを使う。
- 一技能ごとに「単独の現在価値」「二つ以上の採用文脈」「失うもの」を記録する。
- 新語彙が必要なら実装せず、mechanics requestへ反例と用途を記録する。

### 敵・encounter担当

- enemy definitionとencounter compositionだけを変更。
- 特定人物、特定技能を要求するhard counterを作らない。
- どの性能vectorへ圧力をかけるかを宣言する。
- Difficulty係数と敵定義を同じPRで同時調整しない。

### 装備担当

- Phase A/Bでは固定装備だけ。
- Phase C前はprocedural descriptorやaffix grammarを変更しない。
- 弱い品、狭い品を許すが、発火不能、説明不能、無料循環は作らない。
- 高rarityのpower budgetをrule数に比例して増やさない。

### balance・検査担当

- funを自動判定しない。
- 支配戦略、発火不能、上位互換、戦闘停止、圧力vectorの重複を検出する。
- Fast checkを一分以内に保ち、組合せ探索はslowへ置く。
- 閾値を結果確認後に動かさない。
- content PRの前後を同じreference suiteで比較する。

## 8. 難易度調整の順序

難易度は三層を同時に動かさない。

1. **unit層**: 敵一体のparameterとrule。
2. **encounter層**: 人数、配置、組合せ、wave。
3. **rank層**: threat budget、modifier、報酬倍率。

まずDifficulty 0のreference encounterを固定し、unit層を調整する。次にencounter層で異なる性能圧力を作る。最後にrank層を載せる。

一つの調整PRで動かしてよい層は一つだけとする。勝率だけでなく次を比較する。

- 戦闘round。
- 味方損傷。
- 装備消耗。
- AP/RP未使用。
- direct damageを含むturn比率。
- block / guard / barrierの吸収。
- 攻撃対象と位置変更。
- 使用技能と発火しなかった技能。
- 構成変更の有無。
- 敵が圧力をかける性能vector。

reference buildは「正解build」ではない。広域、単体burst、多段、持続、防御、位置利用等の観測器であり、全buildを同勝率へ揃えない。

## 9. content PRの受入票

各content PRは次を本文へ記録する。

~~~text
Contract SHA:
Content family:
追加ID:
利用する既存event/effect/target:
新語彙要求: なし / mechanics requestへのlink
単独の現在価値:
強くなる二文脈:
弱くなる二文脈:
圧力vector:
変更したsoft data層:
Fast check:
Slow check:
reference比較:
未検証:
~~~

必須条件:

- engine / schema変更0。必要ならPRを分ける。
- 個別人物／技能／装備IDへの相方参照0。
- validator error 0。
- 説明と実eventの不一致0。
- 完全上位互換がある場合は削除または明示的な代償を追加。
- probe batch上限内。
- 数値を見た後に受入条件を変更しない。

## 10. branchとmerge規則

現行のAGENTS.mdは「Sol＋実装担当一名＋作者」を固定し、サブエージェントや別review担当を認めていない。したがって、この資料は**技術的に分離可能なwork packet**を定義するものであり、同時に複数エージェントを起動する許可ではない。

将来、作者が複数実装担当を明示的に許可しAGENTS.mdを変更した場合だけ、次を使う。

1. 統合担当がcontent contract commitを作る。
2. 全担当が同じexact SHAからbranchを作る。
3. 一担当は一content familyだけを所有する。
4. content担当はengine、schema、共通registryを変更しない。
5. 新語彙要求はコードではなくrequest票にする。
6. system PRを先にmergeし、content PRは最新contractへrebaseしてvalidatorを再実行する。
7. merge後に統合担当が全content bundleとsave migrationを検査する。
8. 作者公開は統合後の一buildだけにする。

複数担当を許可しない現状でも、これらのwork packetを一人の実装担当が順番に処理すれば、責務混在と作り直しを減らせる。

## 11. 停止条件

- content分離前後で同一seedの入力または結果が一致しない。
- Phase A作者Gate前にprobe batchを越えてcontentを増やす必要がある。
- content追加のためengineへ個別ID分岐が必要になる。
- 二人以上の担当が同じcontent registryを同時編集する。
- systemとcontentの数値を同じ比較で同時変更し、差分原因を分離できない。
- Phase C前にprocedural affixの本番実装が必要になる。
- 新mechanicsを二系統以上同時追加する。
- Difficulty調整でunit、encounter、rankの二層以上を同時に動かす。
- Fast checkが一分を超え、slowへ分離できない。
- reference suiteの高勝率をfunの証拠として扱う。
- 作者が支持しなかったPhaseをcontent量で延命しようとする。

停止時は、依存していた契約、影響するcontent ID、最小の修正案、破棄可能な作業を記録する。

## 12. 最初の実装担当への依頼

最初の担当はcontentを増やさず、Milestone 0とPhase AのPREFLIGHTだけを行う。

最低成果物:

1. PR #49、PR #50、R6、R7のTRACEABILITY。
2. 実装起点SHA。
3. 現在のcontent import graph。
4. 種類別ファイル分離案。
5. 分離前後の深一致fixture。
6. hard / soft contract一覧。
7. Phase Aで変更するschemaと旧save migration。
8. 並列可能になるcontract commitの候補。
9. 反証と停止条件。

PREFLIGHTの時点で「Phase Aを実装すると既存contentの大半が手修正になる」場合、修正を始めず、adapterまたは機械migration案を先に返す。
