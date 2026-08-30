# EXP-18 A7 — Milestone 0 PREFLIGHT / TRACEABILITY

作成日：2026-08-30
担当：実装（Claude）
対象：[R7](../R7_IMPLEMENTATION_SEQUENCE_AND_PARALLEL_CONTENT_EXPANSION.md) Milestone 0 と Phase A の PREFLIGHT
状態：**content は1件も増やしていない。game rule は1つも変えていない。**

R7 §12 が最初の担当へ求めた9点に順に答える。

## 1. TRACEABILITY

| 出所 | 要求 | この PR での状態 | 証拠 |
|---|---|---|---|
| R7 §5 M0-1 | 実装起点の commit SHA を記録する | 済 | 下の §2 |
| R7 §5 M0-2 | content 定義を種類別ファイルへ分離する | 済 | `ecology/content/` 11ファイル |
| R7 §5 M0-3 | 分離前後の深一致 fixture を作る | 済 | `ecology/contract-snapshot.json`（18節・107,917バイト）、`ecology/contract.test.mjs` |
| R7 §5 M0-4 | ID重複・未知 event/effect・個別相方参照・数値型を validator で拒否する | 済（一部は既存 validator が既に拒否） | 下の §6.3 |
| R7 §5 M0-5 | engine を変えられる統合担当を一人にする | 組織側の取り決め。コードでは engine への個別 ID 分岐を機械で禁じた | `analysis/ecology-contract-smoke.mjs` |
| R7 §5 M0-6 | content contract version を記録する | 済 | `CONTENT_CONTRACT_VERSION = "ecology-content-contract-1"` |
| R7 §3 | ファイル分離と game rule 変更を同じ commit へ混ぜない | 済 | commit `d46d6dc` は移動のみ |
| R7 §4.3 | 空の実装や架空 event を先に置かない | 済 | `skills-passive.mjs` / `packs.mjs` は作っていない |
| R7 §5 M0 | この段階では技能・敵・装備を増やさない | 済 | ID 72件は分離前と同一（contract smoke が照合） |
| R6 §17.1 | Phase A の範囲 | **未着手**（本 PR は PREFLIGHT まで） | 下の §7 |

PR #49（一周可能試作）と PR #50（R6/R7 設計）は、いずれも本 PR の前提であり、
本 PR はそのどちらの結論も変更していない。

## 2. 実装起点 SHA

~~~text
09a291faa0c275b8dea214fb6102cb22f7983d72
（main / PR #51 merge 後 / EXP-18 Full prototype 0.3）
~~~

深一致 fixture はこの SHA の出力を凍らせたものである。

## 3. 現在の content import graph

分離前（PR #51 時点）：

~~~text
fixture-content.mjs ─→ playable-content.mjs ─┬─→ playable-battles.mjs ─┬─→ app.js
                                             └────────────────────────┘
                                                                       └─→ playable.test.mjs
~~~

`playable-content.mjs` に人物・技能・装備・状態・敵の定義が、
`playable-battles.mjs` に敵の狙い・encounter・役割表・技能ツリーと、
loadout / 報酬 / 戦闘入力の**仕組み**が同居していた。

分離後：

~~~text
fixture-content.mjs ─→ content/base.mjs ─┬─→ content/characters.mjs      ─┐
                                          ├─→ content/skills-active.mjs   │
                                          ├─→ content/skills-reactive.mjs │
                                          ├─→ content/equipment-fixed.mjs ├─→ content/index.mjs
                                          ├─→ content/statuses.mjs        │        │
                                          └─→ content/enemies.mjs        ─┘        │
                                              content/roster.mjs      ─────────────┤
                                              content/skill-tree.mjs  ─────────────┤
                                              content/encounters.mjs  ─────────────┘
                                                                                   │
                                     playable-content.mjs（adapter）←──────────────┤
                                     playable-battles.mjs（仕組みだけ）←───────────┘
~~~

`playable-battles.mjs` は 527行 → 306行。減った221行は移動であって削除ではない。

## 4. 種類別ファイル分離

| ファイル | 持つもの | 担当 |
|---|---|---|
| `content/base.mjs` | 共有の道具だけ。定義は置かない | 統合 |
| `content/characters.mjs` | 仲間の engine 定義と表示名 | 人物 |
| `content/roster.mjs` | 編成画面から見た仲間（役割・図像・既定位置・初期の技能） | 人物 |
| `content/skills-active.mjs` | 行動技能 | 技能 |
| `content/skills-reactive.mjs` | 反応技能 | 技能 |
| `content/equipment-fixed.mjs` | 固定装備 | 装備 |
| `content/statuses.mjs` | 状態異常の表示名 | 統合 |
| `content/enemies.mjs` | 敵 unit と狙いの説明文 | 敵・encounter |
| `content/encounters.mjs` | 区画ごとの配置 | 敵・encounter |
| `content/skill-tree.mjs` | 技能ツリーの節と表示文（種類をまたぐ） | 統合 |
| `content/index.mjs` | bundle の組み立て・contract version・RETIRED_IDS | 統合 |

**表示名の表も種類別へ割った。** R7 §3 の推奨には無いが、
共有 registry を1つ残すとそこが衝突点になるため。

R7 §3 が挙げた `skills-passive.mjs` と `packs.mjs` は**作っていない。**
passive 枠は Phase A、SkillPack manifest は Phase B の語彙であり、
R7 §4.3 の「空の実装を先に置かない」に従って、中身と一緒に置く。

## 5. 深一致 fixture

`ecology/contract-snapshot.mjs` が観測点を1箇所で作り、
`ecology/contract-snapshot.json` が起点 SHA の出力を凍らせている。

凍らせたもの（18節）：content bundle、表示名、役割表、技能ツリー、encounter、
敵情報、狙いの説明文、初期解禁、loadout、**7区画の battle input**、
**3 seed × 7区画 × 所持あり／なしの reward offer 42件**。

`ecology/contract.test.mjs` は節ごとに深一致を見たあと、バイト一致も見る
（深一致は鍵の順序を見ないので、保存・D1・replay の見え方の変化に気づけない）。

意図した変更のときは `node ecology/contract-snapshot.mjs --write` で作り直す。

**鳴ることを確かめた。** 技能の表示名を1文字変える／敵の maxHp を変える、
どちらも該当の節を名指しして終了コード1。

## 6. hard / soft contract

### 6.1 hard（変えるなら migration が要る）

| 契約 | いまの状態 | 機械 |
|---|---|---|
| definition ID は永続・一意。削除後に別内容へ再利用しない | ID 72件 | contract smoke §4／validator の duplicate_id |
| 保存済み ID を消すなら理由と行き先を書く | `RETIRED_IDS`（いま空） | contract smoke §4 |
| 既存 event / effect / predicate / scope / tag の意味を変えない | schema registry で閉じている | validator の unknown_value |
| 新語彙は schema version を上げ、additive に足す | `CONTENT_SCHEMA_VERSION` | validator の bad_schema_version |
| position は canonical ID で保存する（表示語を入れない） | 4 position（Phase A で6へ） | contract smoke §5 |
| 連続量と離散量を区別する | 現状すべて整数 | contract smoke §3 |
| content は個別の人物／技能／装備 ID を条件にしない | schema に「特定 ID を指す述語」が存在しない | 下の §6.3 |
| engine は content の ID で分岐しない | 9ファイル・分岐0件 | contract smoke §2 |
| event の事実と表示文を分ける | event に表示文は入らない（event-queue.mjs 冒頭の約束） | — |
| save / D1 / replay に content version と ID を残す | `stats.buildStamp` / `rulesFingerprint` / `contentVersion` | ecology-trial の D1 照合 |

### 6.2 soft（あとで動かしてよい。ただし build の印は上げる）

係数、cost、cooldown、発火上限、敵の maxHp と parameter、encounter の構成、
報酬の重み、技能点の価格、装備の power budget、Difficulty 倍率。

soft を動かしたときは深一致 fixture が落ちる。**それは正しい落ち方**なので、
差分を読んでから `--write` で凍結を作り直す。

### 6.3 「個別相方参照」について

R7 §4.1 は「content は人物名、特定 skill ID、特定 equipment ID を相方条件にしない」を求めている。
現状の schema を調べたところ、**そもそも書けない。**

- `PREDICATE_TYPES` は11種（always / hp_percent / resource / position / has_status /
  is_preparing / event_tag / event_value / history_count / target_exists / round_number）
- `TARGET_FILTER_TYPES` は8種（alive / row_is / hp_percent / has_status /
  is_preparing / not_previous_target / is_event_primary_target / is_event_source）

いずれも特定の definition ID を取る欄を持たない。条件は状態・位置・tag・履歴で書く。
一方、`starterTactics`、`tactics[].activeSkillId`、`reactiveSkillIds`、
技能ツリーの `requires` は**宣言的な持ち物**であり、相方条件ではないので許す。

したがって M0-4 の「個別相方参照を拒否する」は、新しい検査を足すのではなく
**schema にその欄を増やさないこと**で守る。増えたら validator の
`unknown_value` が鳴る（未知の predicate 型は既に拒否される）。

## 7. Phase A で変える schema と、旧 save の migration

### 7.1 schema 変更（すべて additive）

| 変更 | 種別 | 旧 content への影響 |
|---|---|---|
| `POSITIONS` 4 → 6（`front_center` / `rear_center` を追加） | additive | 既存の4 position はそのまま有効 |
| `CharacterDef` へ `might` / `focus` / `guard` | additive | 既存定義は未設定 → 中立値で埋める |
| `VALUE_TYPES` へ `scaled`（`scalingStat` + `coefficientBps`） | additive | 既存の `constant` はそのまま動く |
| `TARGET_PATTERNS`（single / row / column / splash / all） | 新 registry | 既存は single 相当 |
| `REACH`（melee / ranged / unrestricted） | 新 registry | 既存は既存の targetQuery が担う |
| `guard` / `block` の軽減順（block → guard → barrier → HP） | 既存 barrier の前段 | barrier だけの定義は挙動不変 |
| passive skill 枠 | 新 registry | 既存 loadout には無い |

**破壊的な改名は1件も無い。** すべて「足す」側で表現できる。

### 7.2 移行が要る content の実数

| 節 | 定義数 | 定数を持つ定義 | 定数の総数 | 移行の性質 |
|---|---:|---:|---:|---|
| characters | 8（うち engine 定義 11） | 1 | 1 | maxHp ×10 は機械。might/focus/guard は R6 §4.4 の表から |
| activeSkills | 16 | 12 | 12 | **判断が要る**（might か focus か、係数いくつか） |
| reactiveSkills | 14 | 11 | 11 | **判断が要る** |
| equipment | 18 | 13 | 13 | R6 §4.4 が「flat roll は parameter 非依存で残してよい」→ ×10 の機械移行 |
| enemyActors | 11 | 0 | 0 | maxHp は encounter 側。×10 は機械 |
| statuses | 2 | 2 | 4 | 判断が要る（4件） |
| **合計** | — | **39** | **41** | 判断が要るのは **27件**、機械で済むのが **14件 + maxHp 22件** |

### 7.3 R7 §12 の停止条件への回答

> PREFLIGHT の時点で「Phase A を実装すると既存 content の大半が手修正になる」場合、
> 修正を始めず、adapter または機械 migration 案を先に返す。

**該当しない。** 手で判断するのは 27件（技能23・状態4）で、
これは R6 §4.4 が明示的に求めている判断（「定数×10だけへ変換して終えない」）そのものである。
残りは機械移行できる。**大半が手修正になる状況ではないので、停止しない。**

ただし判断27件は soft data なので、Phase A の1 PR で確定させず、
中立 parameter（might=40 / focus=40）で現行の相対効果量を保つ係数から始める（R6 §4.4）。

### 7.4 旧 save の migration

`SAVE_KEY = "exp18-full-prototype-v02"` の中身と、Phase A での扱い。

| 保存している物 | Phase A の影響 | migration |
|---|---|---|
| `roster`（4人） | 5人編成へ | 既存4人を保ち、5人目を自動で足す |
| `formation`（id → position） | 2×3・空き1枠へ | 既存4件はそのまま有効。5人目を空き position へ置き、前3後2／前2後3を満たす側を選ぶ |
| `loadout.tactics` / `.reactives`（各2枠） | 3 active / 3 reactive / 2 passive へ | additive。既存は失われない。passive は fallback を割り当てる |
| `loadout.equipment`（各2枠） | 変更なし | そのまま |
| `hp` | maxHp ×10 | **migration 不要。** `loadState` が毎回 content の maxHp から入れ直している |
| `meta.unlocked` / `skillPoints` | skill ID 不変 | そのまま |
| `meta.ownedEquipment` / `equipmentDurability` | 装備 ID 不変 | そのまま |
| `results` / `runEvents` | 過去の記録 | 触らない。旧 contentVersion のまま残す |
| `replayEvents` / `replaySnapshots` | 旧 engine の出力 | 再生しない。読み込み時に捨てる（区画の進行は保つ） |

**SAVE_KEY は上げない。** 上げると作者の進行が消える。
上の表がすべて additive なので `loadState` の中で移行できる。
移行できないと分かった時点で初めて key を上げ、そのときは理由を書く。

## 8. 並列可能になる contract commit

このブランチの HEAD を content contract の起点とする。
content 担当（技能・敵・装備）は、Phase A 作者 Gate の後、**この SHA から branch を切る。**

ただし R7 §10 と AGENTS.md の通り、いまは「Sol＋実装担当1名＋作者」の構成なので、
これは**同時に複数担当を立てる許可ではない。**一人が順に処理するための境界である。

## 9. 反証と停止条件

### 9.1 この Milestone 0 への反証

- **「分離しても衝突は減らない」**：減る根拠は、いま12ファイルのうち
  技能担当が触るのは2つ、敵担当は2つ、装備担当は1つで、重なりが `index.mjs` と
  `skill-tree.mjs` だけになったこと。ただし `skill-tree.mjs` は種類をまたぐので、
  ここは依然として衝突点である。**Phase B で技能ツリーが SkillPack manifest へ移るまで、
  この一点は残る。**
- **「深一致 fixture は soft data の調整のたびに落ちて邪魔になる」**：落ちるのは正しい。
  ただし更新が習慣になると意味を失うので、`--write` は差分を読んでからだけ使う。
  更新の理由を commit に書けないなら、それは意図した変更ではない。
- **「engine の ID 分岐禁止は厳しすぎる」**：いま0件なので、
  厳しすぎるかどうかは足そうとしたときに分かる。足したくなったら、
  それは共通語彙が足りない合図であり、mechanics pack の要求として記録する。
- **「contract を固定しても Phase A で壊れる」**：§7.1 の通り、
  Phase A の schema 変更はすべて additive で表現できると見込んでいる。
  additive で書けない変更が出たら、そこが本当の契約違反なので止める。

### 9.2 停止条件（R7 §11 のうち、この段階で機械が引くもの）

| 条件 | 引く機械 |
|---|---|
| 分離前後で同一 seed の入力または結果が一致しない | `ecology/contract.test.mjs` |
| content 追加のため engine へ個別 ID 分岐が必要になる | `analysis/ecology-contract-smoke.mjs` |
| 公開済みの ID が黙って消える／別内容へ再利用される | 同上 |
| Fast check が一分を超える | `analysis/check-all.sh` の予算 |
| 画面かボタンの行き先が消える | `analysis/ecology-screens-smoke.mjs` |

機械に置けないもの（人が見る）：Phase A 作者 Gate、probe batch の上限、
難易度の層を同時に動かさないこと、reference suite の勝率を fun の証拠にしないこと。

## 10. 次の担当への引き継ぎ

Milestone 0 は終わっている。次は R6 §17.1 の Phase A だが、**その前に作者の判断が要る。**

- Phase A は engine・schema・position・damage order を変える唯一の統合 PR になる（R7 §5）。
- Phase A を始めてよいか、それとも Milestone 0 の分離だけで一度止めて
  他のことをするかは、作者が決める。
- Phase A に入る場合、この PREFLIGHT の §7 がそのまま作業計画になる。
