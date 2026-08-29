# A5 — 反証レビュー（コード前）

対象: [R5](../R5_EMERGENT_RULE_ENGINE_IMPLEMENTATION_HANDOFF.md)（EXP-18 創発的ルールエンジン実装委譲票）
基準commit: 9f9def637d18ae6804ec3d0834537af6c660580a（main）
書いた時点: 実装コードを1行も書く前。

R5 §16 Gate A の要求どおり、コードより先に「この票のまま書くと何が壊れるか」を探した。
結論は**停止しない**。R5 §19 の停止条件に該当するものは1件（§15.4）だが、
不変条件（§1.2）を一つも変えずに済む最小修正が存在するため、修正案を明示して実装へ進む。

## 0. 判定の要約

| # | 箇所 | 種別 | 判定 | 対応 |
|---|---|---|---|---|
| 1 | §15.4 positive status | **表現不能**（語彙の欠落） | 最小修正して進む | v1 filter へ `is_event_source` を1件だけ追加 |
| 2 | §15.3 「1修理する装備」 | **表現不能**（effect の欠落） | 仕様逸脱を明記して代替 | v1 では回復へ置換、v2 修正案を提示 |
| 3 | §15.3 「AP costを1下げる装備」 | 語彙の欠落だがHOWで等価表現可 | HOWとして解決 | `actor_activated` で round 1回 +1 AP |
| 4 | §11.6 の手順順序 | **恒偽**（コスト支払が絶対に成立しない） | 観測順を定義して解決 | サブステップごとに after queue を drain |
| 5 | §11.3-2 activation 8上限 | **到達不能**（恒偽の分岐） | エラーではなく安全制約と定義 | 余剰APを resource_unused で可視化 |
| 6 | §14 termination 5標本 | 全部が安全制約側に落ちる | 標本を1件足す | apCost 0 の真の無限ループを追加 |
| 7 | §5.3 regionRules | owner 不在で self/cost が未定義 | validator で拒否 | allies/enemies は味方側/敵側で解決 |
| 8 | §4.1 round_limit の勝敗 | 未定義 | 決めて明記 | objective 未達の round_limit は loss |
| 9 | §13 draw の reason | 列挙に draw 用が無い | 決めて明記 | 双方全滅かつ未達は `all_allies_defeated` |
| 10 | §16 Gate F の合格条件 | 代理指標の誤読リスク | 文書で封じる | fingerprint 数を面白さの証拠にしない |

**この表は完全ではなかった。** 実装後の監査レビューで5件の穴が出ている。
本書末尾の「追補」（§14〜§19）を必ず併せて読むこと。とくに §17 は、
書いた最適化が正当なコンテンツを壊していた例である。

## 1. §15.4 の positive status は v1 predicate/filter では書けない

### 要求

> 次のdamage/heal/barrier amountを+1し、その後消えるpositive status

これは保持者が**与える**量を増やす（negative 側と対になっているので「受ける」ではない）。
つまり rule は `damage_proposed` / `healing_proposed` を interrupt で読み、
**そのイベントの source が自分自身であるときだけ**発火しなければならない。

### v1 語彙で書けるか

§8 の predicate は always / hp_percent / resource / position / has_status / is_preparing /
event_tag / event_value / history_count / target_exists / round_number。
このうち「イベントの登場人物と rule owner が同一か」を判定できるのは `target_exists` だけである。
`target_exists` は §9 の TargetQueryDef を持ち、filter に `is_event_primary_target` があるので

~~~js
{ type: "target_exists", query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 } }
~~~

で「**このイベントの主対象は自分**」は書ける（negative status 側はこれで足りる）。
ところが filter 一覧（alive / row_is / hp_percent / has_status / is_preparing /
not_previous_target / is_event_primary_target）には **source 側の対応物が無い**。
scope に `event_source` はあるが、そこから「それが自分か」へ戻す手段が無い。
よって「自分が source のとき」は v1 語彙で書けない。

### 代用案とその反例

`has_status(subject: event_source, statusId: 自分自身の status id)` で代用すると通ってしまうが、これは誤り。

- 反例: 同じ強化 status を味方2人（A, B）が同時に持つ。
- A が攻撃 → `damage_proposed(source=A)` → A の rule も B の rule も「source は status を持つ」で真。
- 両方が `modify_pending_amount +1` を適用し、**+2 になる**。
- limit（chain 1回）は owner ごとの制約なので、これを止めない。
- fixture の保持者を1人にすれば検査は緑になる。つまり**この誤りはテストで見えない**。

「設計者が完成コンボを作らず、小規則を足していく」（R4）前提では、同じ status を2人が持つのは
例外ではなく通常運用である。したがって代用は採らない。

### 最小修正（実装するもの）

§9 の v1 filter へ **`is_event_source` を1件だけ追加**する。`is_event_primary_target` と対称で、
新しい概念・新しい評価器・新しい実行時状態を一つも増やさない（イベントは既に sourceActorId を持つ）。

- 不変条件（§1.2）への影響: 無し。人物名・相方ID参照を増やさない。エンジンへコンテンツ if を増やさない。乱数を増やさない。
- Gate B「未知のfilterを拒否」: 追加後の一覧を既知集合とし、それ以外は従来どおり拒否する。
- 仕様逸脱として RESULT.md / GATE_RESULTS.md に記載する。

R5 §19 は「個別コンテンツifなしでは表現不可能な必須fixtureがある」を停止条件に挙げるが、
その趣旨はエンジンにコンテンツ分岐を書かせないことにある。ここでの欠落は**関係述語1個の穴**であり、
穴を塞ぐ修正はコンテンツ分岐を生まないので、停止せず修正して進む。

## 2. §15.3 の「1修理する装備」は v1 effect に存在しない

> resource_unusedのRPで自分を1修理する装備

§10.2 の v1 effect に耐久を戻すものは無い（`wear_equipment` は減らすだけ）。
§5.2 は「数値は0以上、負の変化は effect type で表す」と定めるので、負の amount による回避もできない。
§12.6 も「0まで減らす」しか定義しておらず、`equipment_repaired` に相当するイベントも §6 に無い。

**この判断は §16 で覆した。** 以下は初版の判断の記録である。

- 初版で実装したもの: 同じ配線（`resource_unused` を listen する装備由来 rule、`spend_reaction_points` コスト、
  event_tag / event_value による資源種別の判定）を検査する最寄りの v1 表現として、**保持者を1回復する**装備にした。
- 監査レビューの指摘: 配線の検査にはなるが同じゲーム性ではない。装備消耗を遠征のトレードオフにするなら
  修理は基礎語彙である。→ §16 で `repair_equipment` / `equipment_repaired` を実装し、
  broken の解除は「しない」と決めた（§5.6 を黙って取り消さないため）。

## 3. §15.3 の「最初の active action の AP cost を1下げる装備」

v1 effect にコスト改変が無い（§10.2）。`modify_pending_amount` は damage/heal の量だけを対象にする（§12.1/§12.2）。

HOW として等価表現する: `actor_activated` を listen し、`limit {scope:"round", count:1}` で
保持者へ `gain_resource(action_points, 1)`。行動宣言より前に +1 されるので、そのラウンドの最初の行動は
実質1安くなる。差分は「そのラウンドに一度も行動しなかった場合、AP が余る（round_ended で resource_unused に出る）」点だけで、
コスト計算としては同値。fixture のコメントへ同値性と差分を書く。これは仕様逸脱ではなくHOW。

## 4. §11.6 の順序をそのまま実装すると §15.3 の RP コストが恒偽になる

§11.6 は次の順である。

1. round_ended を記録し after 反応を処理
2. 未使用 AP/RP を resource_unused として記録
3. round barrier 失効
4. round status 除去
5. **AP と RP を 0 へする**
6. chain を全て解決して勝敗確認

字面どおりだと、2 で出した `resource_unused` の after 反応は 6 で初めて走る。そのとき RP は 5 で 0 になっており、
§11.5「各ruleは発火直前に条件とcostを再評価する」により `spend_reaction_points` は**決して払えない**。
つまり §15.3 の「resource_unused の RP で〜」という fixture は、§11.6 の字面と両立しない（恒偽）。

解決: §11.5 が「実装が stack, queue, frame のいずれを内部で使ってもよい。外から観測される順序はテストで固定する」と
委任しているので、**round 終了処理の各サブステップの直後に after queue を drain する**。
（2 の全 actor 分を記録 → drain → 3 → drain → 4 → drain → 5 → 最終 drain → 勝敗確認）
観測順は engine.test.mjs で固定する。README にも順序表を書く。

## 5. §11.3-2 の「activation 8以上なら循環エラー」は到達不能

同 §11.3 末尾の再投入条件が「当該roundのactivation回数が8未満」なので、8回目を終えた actor は queue へ戻らない。
したがって「8以上の actor を pop する」状況は、他の投入経路が無い v1 では発生しない。
そのままだと**恒偽の分岐**（＝壊れても気づけない分岐）になる。

決め: 8上限は **安全制約による停止**として扱い、エラーにはしない（R5 §14 の「安全制約で停止する場合と、
循環エラーにすべき場合を明示する」に従って明示する）。防御的な検査自体は残すが、テストは
「AP を配り続ける rule があっても 1 round の activation が 8 で止まり、余った AP が resource_unused に出る」を固定する。
黙って落ちないこと（§1.2）は、余剰 AP がイベント列に出ることで満たす。エラーにするのは chain / battle のイベント上限だけ。

## 6. §14 の5標本は、どれも循環エラーにならない

v1 の安全制約「同 owner・同 rule は 1 chain に 1 回」（§5.7）は、chain 内の反応回数を
（rule 数 × owner 数）で上から抑える。rule も owner も有限なので、**単一 chain は構造的に必ず停止する**。
§14 が挙げる5標本（AP相互付与 / damage_taken相互 / barrier_gained自己 / preparation_advanced自己 / 装備の自己摩耗）は
すべてこの制約で止まる。よって5標本は「安全制約で停止する場合」の証人であって、
「循環エラーにすべき場合」の証人にはならない。エラー経路が一度も踏まれないまま緑になる。

追加する標本:

- `apCost: 0` で常時使用可能な active skill。§11.3-7「APがあり、使用可能tacticがある限り優先順に行動する」に
  行動回数の上限が無いので、これは chain 制約の外側で**本当に停止しない**。既定の `maxEventsPerBattle` で
  診断付きエラーになることを検査する。
- 上限値を小さくした options（maxEventsPerChain / maxEventsPerBattle）で正常 fixture を走らせ、
  エラー診断が R5 §14 の必須項目を全て含むことを検査する。

## 7. regionRules は owner を持たない

§5.3 の `BattleInput.regionRules` は RuleDef だが、owner instance が無い。
そのままだと `subject: "self"`、`scope: "self"`、`costs`（AP/RP/HP/barrier/装備を払う主体）が未定義になる。

決め（validator で機械化する）:

- region rule の predicate / value / effect で `subject: "self"`、`scope: "self"` を**拒否**する。
- region rule の `costs` は空でなければ**拒否**する（払う主体がいない）。
- `scope: "allies"` は味方側、`scope: "enemies"` は敵側に解決する（actor 所有 rule では owner の側／対側）。
- tie-break の owner 項は、actor 所有 rule より必ず後ろに来る固定値にする。

## 8. round_limit の勝敗が未定義

§4.1 の result は win/loss/draw、reason に round_limit がある。どの result と組むかは書かれていない。
決め: **objective 未達で maxRounds に到達したら loss**（reason: round_limit）。
`survive_rounds` は達成時点で win になるので、この決めと衝突しない。

## 9. draw の reason

§13 は「双方全滅で objective が同じ chain で達成されていなければ draw」と定めるが、
§4.1 の reason 列挙に draw 専用の語が無い。決め: その場合の reason は `all_allies_defeated` を使う
（味方が全滅した事実は真であり、result 側で draw と区別できる）。新しい reason 語を勝手に増やさない。

## 10. frontier/ を拡張基盤に使えない理由

R5 §3.2 の列挙と一致するが、実装判断として重いものを3点。

- `frontier/engine.mjs` の `actAlly` は `action.type` ごとの分岐で、ram / echo / capacitor など**機体固有の分岐がエンジン側にある**。
  R5 §1.2「個別人物・技能・装備・敵をエンジンのif文へ書かない」と正面から衝突する。
- 三拍固定（`state.beat` 1〜3）で、行動権・反応権という資源の概念が無い。R5 §11 の activation / 再行動 / 反応の窓は後付けできない。
- イベントが `{beat, type, ...}` の平坦なログで、因果（parentEventId / chainId）も上限も無い。
  R5 §7 と §14 は列の構造そのものを要求しているので、既存ログの拡張ではなく作り直しになる。

残す考え方（§3.1）は ecology/ でも守る: エンジンが UI を知らない、同じ入力が同じイベント列を返す、
表示は列の再生だけ、テストが数値でなくイベントの存在を見る、内容定義とエンジンを分ける。

## 11. 恒真・恒偽・未定義の洗い出し（その他）

コードを書く前に列挙し、実装で塞ぐと決めたもの。

- `resource_refreshed` は §11.2-3 で「リアクションのlisten対象にしない」。単に無視すると、
  これを listen する rule は**恒偽の死にデータ**になる。→ validator で `listenTo: "resource_refreshed"` を拒否する。
- `timing: "interrupt"` は §11.5 で「pending frame が存在するイベントでのみ発火可能」。
  pending frame を持つのは action_declared / target_selected / damage_proposed / healing_proposed の4つだけ。
  他を listen する interrupt rule は恒偽。→ validator で拒否する。
- `modify_pending_amount` は damage/heal の frame にしか意味が無く、`cancel_pending_action` は action frame にしか意味が無い。
  → listenTo と effect の組み合わせを validator で拒否する。
- §12.1-9「HPダメージ0でも damage_proposed は残す。damage_taken は実HP減少がある場合だけ」。
  したがって `history_count(damage_taken)` は「実際に減った」だけを数える。counter 系の rule はこれに乗る。
- §12.2-6「0HPのactorはheal対象外」。heal の対象クエリは `alive` filter を明示しない限り死者を含みうるので、
  0HP への heal は healing_proposed を出さずに対象から落とす（excess_healing にもしない）。
- take: 1 のクエリで sort が tie を残すと非決定になる。§9 のとおり sort 末尾へ position_asc, instance_id_asc を**必ず**足す。
- `hp_percent` は §8 のとおり `hp * 100` と `maxHp * threshold` の整数比較で行う。浮動小数を1箇所も使わない。
- ValueDef の scaled は分母0を validator で拒否し、途中は整数、最後に floor、負にしない（§10.3）。

## 12. 代理指標の点検（仕様どおりでも目的を測れない指標）

- Gate F の `uniqueChainFingerprints` の**数**は、面白さでも創発性でもない。
  fingerprint は「同じ入力から同じ因果列が出るか」と「データ追加で列の形が増えるか」だけを測る。
  数が多いのは、粒度の細かい fingerprint を選んだだけでも起きる。→ RESULT.md に「面白さを証明していない」と明記し、
  どの fingerprint を候補とみなすかは設計担当へ戻す（R5 §20）。
- Gate D の「正常fixtureは maxEvents の10%未満」も、fixture を小さくすれば必ず通る。
  余裕率そのものは安全性の証拠ではないので、GATE_RESULTS.md には実測値（分子と分母の両方）を残す。
- Gate C の「100回 JSON 深一致」は、乱数を使っていないことの証拠であって、順序が**正しい**ことの証拠ではない。
  順序の正しさは、個別の順序 fixture（interrupt 複数、cover、再評価、外部 advance）で別に固定する。

## 13. 実装前に停止すべき不明点

無し。§1 は最小修正（filter 1件追加）で塞ぎ、§2 は仕様逸脱として記録したうえで代替 fixture にする。
§4〜§9 はいずれも R5 が実装担当へ委任した「観測順・診断・内部HOW」の範囲で決められる。
不変条件（§1.2）を変更する必要は生じない。

---

# 追補（実装後の監査レビューで見つかったもの）

**上の §13 と、初版 GATE_RESULTS.md の「未確認項目: なし」は誤りだった。**
実装後の監査レビューで5件の穴が出た。うち1件（§17）は、書いたコードが正当なコンテンツを
壊すもので、fixture を1つ増やせば初版でも捕まえられたはずのものである。

反証レビューの弱点も一緒に記録する。**§11 で「恒偽・恒真・未定義」は列挙したが、
「実装した最適化が、まだ書いていないコンテンツを殺さないか」を見ていなかった。**
恒偽になるのは既存の分岐だけではない。将来のデータの側が恒偽になることもある。

## 14. 防壁だけ提案イベントが無く、§15.4 の三分の一が書けない

§15.4 は「次の damage/heal/**barrier** amount を+1し、その後消える positive status」を要求する。
ところが §6 のイベント一覧には `damage_proposed` と `healing_proposed` はあるが、防壁の提案が無い。
`gain_barrier` は提案を経ずに packet を作るので、interrupt 窓が開かない。

初版はこれを「既知の制約」として文書に書いて済ませた。これは誤り。
**必須 fixture の三分の一が実装不能なまま緑になっていた。**

修正: event `barrier_proposed` を追加し、damage / healing と同じ pending amount 処理へ通す。
`barrier_gained` は `proposed`（変更前）を values に持つ。
fixture は `fixture_focused_barrier`（防壁3が4になり、status が自分を消す）。

## 15. 量を変えた rule が、イベント列から消える

`modify_pending_amount` は pending frame の数値を直接書き換えるだけだった。
攻撃が4から5になった事実は `damage_proposed.amount` と `damage_taken.proposed` の差で見えるが、
**誰のどの規則が +1 したかは再生できない。**

R5 §1.2 は「全ての状態変化は因果イベントから追跡できる」を不変条件に挙げている。
連鎖の説明可能性はこの企画の根幹なので、v2 送りにしてよいものではない。

修正: event `pending_amount_modified` を追加し、
operation / before / after / delta / proposalEventId と、rule ID・source定義ID を残す。
**listen 不可**にする（`resource_refreshed` と同じ扱い）。listen できると、
他人の interrupt 窓の内側で反応が走ることになる。

## 16. 装備の修理が語彙に無く、fixture が別物になっていた

§15.3 の「resource_unused の RP で自分を1修理する装備」を、初版は保持者のHP回復へ置換した（§2）。
配線の検査にはなるが、**同じゲーム性ではない。**
装備消耗を遠征のトレードオフにするなら、修理は基礎語彙である。

修正: effect `repair_equipment` と event `equipment_repaired` を追加する。決めた意味は2つ。

- **maxDurability で clamp する。**
- **耐久0で壊れた装備は修理で復活しない。** §5.6 が「0になった装備は以後 rule を供給しない」と
  定めている以上、修理がそれを黙って取り消してはならない。壊れた装備は自分の修理規則も供給しないので、
  自力で戻ってくることもできない。

fixture は `fixture_field_kit`（耐久1から2へ、次ラウンドは clamp で何もしない）と
`fixture_broken_kit`（耐久0は修理イベントを1件も出さない）。

## 17. stalemate 判定が、正当な待機戦術を殺していた

これが一番重い。**書いた最適化が、まだ存在しないコンテンツを壊していた。**

初版は R5 §11.6 の任意項目を採用し、HP・防壁・準備・状態・装備耐久が2ラウンド連続で
変化しなければ draw にしていた。state hash にラウンド数も履歴も入っていない。

反例（実際に再現した）:

~~~js
tactics: [{ activeSkillId: "strike", useWhen: [{ type: "round_number", op: "gte", value: 3 }] }]
// → 2ラウンド目終わりで draw / stalemate。strike は一度も撃てない。
~~~

v1 は `round_number` と `history_count` を述語として持つ。
「3ラウンド目から」「未使用APが累計4以上になったら」は普通に書ける設計である。
その待機中は5つの量がどれも動かないので、待機と膠着を区別できない。

hash にラウンド数や履歴を足しても直らない。どちらも毎ラウンド変わるので、
今度は判定が一度も成立しない（恒偽の分岐が残る）。

修正: **v1 では stalemate を採用しない。** 何も動かない試合は `round_limit` で終わらせる。
`stalemate` は §4.1 の reason 一覧に残すが、v1 は決して返さない。
fixture は `fixture_inert`（何も起きない試合が maxRounds で終わる）と
`fixture_waiting_tactic`（上の反例が3ラウンド目に撃てる）。

## 18. 同じ装備を2つ持ったときの意味が決まっていない

発火予算のキーは owner + ruleId なので、同じ装備の2つ目は**予算を共有する**。
さらに tie-break が rule id で終わっていたため、どちらの実物が摩耗するかは
`actor.equipment` の配列順（sort の安定性）に落ちていた。決定的ではあるが、根拠が無い。

修正: **1人が同じ装備を2つ持つことを validator が拒否する。**
2つ目が独立して働くべきか（＝§5.7 の予算を装備インスタンス単位にするか）は
ゲーム設計の判断であり、実装担当が決めることではない（R5 §20）。禁止しておけば後からどちらへでも開ける。
tie-break にも equipmentInstanceId を足し、順序が配列順に落ちる経路自体を消した。

## 19. 「最初の行動コスト -1」は「activation時に AP+1」と同値ではない

§3 で「差分は行動しなかった場合に AP が余る点だけで、コスト計算としては同値」と書いたが、これは誤り。
Gate E で追加した `pivot`（未使用APを同量の round barrier に変える人物signature）のような規則がある世界では、
**余った AP は防壁に化けるので、割引と増分の差が連鎖する。**

修正: 代用をやめ、**この装備は「activation時に AP を1得る」ものだと正式に読み替える。**
表示名とコメントを実際の挙動に合わせた。割引が必要なら、コストを変える effect を v2 で足す判断になる。

