# EXP-18 Phase B — 実装結果

作成日：2026-08-30
対象：[R6](../R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS.md) §17.2 / [R7](../R7_IMPLEMENTATION_SEQUENCE_AND_PARALLEL_CONTENT_EXPANSION.md) §5 Milestone 4
前提：[Phase A 実装結果](../A8_PHASE_A/RESULT.md)、[Milestone 0 PREFLIGHT](../A7_MILESTONE_0/PREFLIGHT.md)
状態：**実装済み。作者はまだ Phase A も Phase B も遊んでいない。**

---

## 0. 先に言うこと：Gate を飛ばしている

R6 §17.2 は「**Phase A が支持された場合だけ**追加する」と書いてあり、
R7 §5 Milestone 2 は作者が1〜2遠征を遊んで6項目を自分の言葉で説明・利用できることを
Phase B の入口条件にしている。**その Gate はまだ通っていない**（A8 の記録どおり、
作者は Phase A をまだ遊んでいない）。

依頼が Phase B の実装だったので実装したが、順序としてはここが飛んでいる。
**Phase A が支持されなかった場合、ここで足したものの多くは作り直しになる。**
特に作り直しが大きいのは、12戦の encounter 編成と threat budget（Phase A の
戦闘が変われば全部測り直し）。逆に作り直しが小さいのは、状態三層の分離・
活動資金・補給・難易度 schema で、これらは戦闘の中身に依存していない。

Phase A の Gate を通す順に戻すなら、**この実装を merge せずに置いておける**
（`ecology/progression.mjs` と `ecology/content/expedition.mjs` は新規ファイルで、
Phase A の出力を 1 バイトも動かしていない。§4 に証拠がある）。

---

## 1. R6 §17.2 の項目

| 項目 | 状態 | 置き場所 |
|---|---|---|
| ProfileState / RunState 分離と旧 save migration | 済 | `progression.mjs` の `newProfile` / `newRun`、`app.js` の `loadState` |
| 3幕12戦、boss 4 / 8 / 12 | 済 | `content/expedition.mjs` の `EXPEDITION_ENCOUNTERS` |
| run skill point と run skill reset | 済 | `runSkillPoints` / `unlockRunSkill` / `resetRunSkills` |
| 活動資金の仮計上、一回精算、購入 transaction | 済 | `RunFundLedger`、`recordEncounterCleared`、`settleRun`、`purchaseUpgrade` / `purchaseTraining` |
| 補給、retry、reward reroll、scout | 済 | `spendSupply` / `gainSupply`、`app.js` の `retry-encounter` / `reroll-reward` / `scout` |
| Difficulty 0〜5 と順次解禁 | 済 | `DIFFICULTIES`、`availableDifficulties`（R6 §9.6：資金で買えず、一つ前のクリアだけで開く） |
| 人物鍛錬と第4 active / reactive 購入 | 済 | `trainingCost` / `trainedStat`、`slotUpgradeId`、`slotLimits` |
| 固定 SkillPack manifest。装備はまだ固定定義から選ぶ | 済 | `content/packs.mjs`、`makeManifest`（4パック中3つを seed が選ぶ） |

**Phase B で実装しないもの**（R6 §17.3 以降）はすべて手つかず。生成装備、affix、
Blueprint、目利き、carry capacity、Difficulty 6〜20、endless、attack archetype の追加。

---

## 2. R6 が数字で書いたことと、実装が一致していること

`ecology/phase-b.test.mjs`（600 checks）が見ているのは実装の有無ではなく、
**R6 が固定した式と不変条件そのもの**である。主なもの：

| R6 の記述 | 検査 |
|---|---|
| §9.2「rank 0 の12戦を通常9・boss 3 で初回クリアすると 3,560」 | 同じ式で 3,560 になることを確かめる |
| §9.5 の費用表（level 10 で 2,100 / 100 で 3,000 / 300 で 5,000 / 1,000 で 12,000、累計 20,000） | 4行とも実測 |
| §9.5「常に base stat へ合計倍率を掛ける」 | 50段を1段ずつ買い、`base × (10000+10L)/10000` と一致すること。save/load を挟んでも同じ |
| §9.5「speed / AP / RP / 枠数 / 発火回数 / 優先順は鍛錬で上げない」 | validator が `stats.speed` の上書きを拒否する。engine の速度が base のままであること |
| §9.2「retry しても同じ encounter の撃破 base は一度だけ」 | 同じ戦闘を二度記録しても base が増えない |
| §9.2「同じ runId を二重精算しない」 | 二度目が false を返し、**残高が動かない**。ledger を書き換えて持ち込んでも profile 側が弾く |
| §9.6「rank は買えず、飛ばせず、一つ前のクリアだけで開く」 | 資金を積んでも購入表に無い。クリアで1つだけ開く |
| §12.1「補給は3用途で共有する」 | 再挑戦・引き直し・偵察が同じ数を減らす |
| §5.3「活動資金は4候補に入らない」 | 報酬 offer に資金が現れない |
| §11.3「boss は三つ以上の対応方法を持つ」 | 3体とも counters が3件以上 |
| §11.2「base budget は12段階へ単調増加」 | 2〜12戦目が前より重い |
| §16「同じ入力なら同じ出力」 | manifest・encounter・報酬が deep equal |

---

## 3. R6 の記述に対して、実装側で決めたこと（判断が要ったところ）

### 3.1 敵の変異は **stat だけ**にした

R6 §11.1 の `EnemyMutationDef` は `ruleIds` と `tacticPatch` を持てる。
Phase B ではそれを使わず、`maxHp / might / focus / guard` を動かす変異4種だけにした。

理由は R7 §5 と §11 である。rule を足す変異は**敵側へ新しい語彙を入れる**ことになり、
R7 は「新語彙を必要とする content は先行実装せず、mechanics pack として一系統ずつ追加する」
「新 mechanics を二系統以上同時追加しない」を停止条件にしている。
Phase B は system の段なので、ここで敵の rule を増やすと、次に何が効いたのか分離できない。

**代償**：ボスの「公開された法則」は、いまはその chassis が既に持っている振る舞いの
公開（文章）＋数値変異であって、専用の rule ではない。R6 §11.3 が求める
「固有 chassis または外見」「公開された boss law 1個」「三つの対応方法」のうち、
**法則が rule として存在する形にはまだなっていない。**これは敵 content wave の仕事として残す。

### 3.2 難易度は budget を**足す側**だけにした

rank 0 は `threatBudget` をちょうど使い切る編成にしてある。つまり
**rank 0 が R7 §8 の言う「Difficulty 0 の reference encounter」そのもの**で、
増援も余り変異も出ない。rank が budget を足した分だけ、まず増援（5体まで）、
次に固定順の変異が増える。

変異の選び順を seed ではなく固定順にしたのは、rank を上げたときに
「何が増えたのか」を作者が一目で言えるようにするため。

### 3.3 旧 save の永続技能点は活動資金へ換算した

R6 §5.3 は「8人全員へ永続技能点+2」を削除し、技能点を run 内資源にした。
旧 save が持っていた永続技能点は Phase B に置き場所が無い。捨てると作者の
遊んだ分が消えたように見えるので、**技能点1 = 50（通常戦一勝の半分）**で
活動資金へ換算し、移行したことを画面に出す。`SAVE_KEY` は上げていない。

途中だった7区画の進行は引き継いでいない（12戦の RunState として表現できない）。
これも画面に出す。

### 3.4 買える永続投資を絞った

R6 §9.3 の初期価格帯のうち、Phase B に置いたのは
**開始補給（12,000 / 60,000）・装備群1つ（12,000）・第4枠（30,000 / 60,000）・鍛錬（上限なし）**だけ。
Blueprint 持込枠と目利きは Phase C、新人物は Phase D なので、
空の行を先に置かない（R7 §4.3）。

SkillPack は4つとも最初から解禁済みにした。買えるパックが無いのに category だけ
置くと、画面に「常に買えない行」が出る。6個目以降を足すときに開く。

装備群は**1つだけ買える形**にした。理由は実測で、固定装備は18品しかなく報酬の
機会は11回あるので、群を後ろに残しすぎると**第5戦で「拾える装備がもう無い」**に
なった。品数そのものが増えるのは Phase C の生成装備で、R6 §17.3 がそこへ置いている。

---

## 4. Phase A の出力を動かしていないことの実測

`ecology/contract-snapshot.json` を作り直す前に差分を取った。**動いたのは2件だけ**である。

~~~text
battles.stage1〜7.schemaVersion: "ecology-battle-2" -> "ecology-battle-3"
content.contentVersion:          "ecology-playable-full-0.3" -> "ecology-playable-full-0.4"
~~~

7区画の battle input（味方の技能・装備・位置、敵の配置と HP）、24技能の定義、
18装備、敵定義、報酬42件、技能ツリー、表示名は**1バイトも動いていない**。
version の2件は意図した変更である（battle input に `stats` 上書きが増え、
遠征の形が変わったので記録を分ける）。

凍結には Phase B の出力も足した：12戦 × rank 0〜5 の編成、manifest 3件、
報酬 offer、難易度表、boss law、変異、threat cost、購入表。

---

## 5. 12戦が通せる形になっていることの実測

`analysis/ecology-expedition-smoke.mjs`（毎 push、`analysis/*smoke*.mjs` の glob で拾われる）。到達戦数：

| build | r0 | r1 | r2 | r3 | r4 | r5 |
|---|--:|--:|--:|--:|--:|--:|
| starter（初期構成のまま） | 4 | 3 | 3 | 3 | 3 | 3 |
| mid（3枠＋常設2＋装備4） | 11 | 11 | 11 | 9 | 9 | 9 |
| late（貫き・行・列＋反応3＋装備7） | 12 | 12 | 12 | 12 | 12 | 12 |

読めること：

- **初期構成のままでは第5戦で止まる。**Phase A の7区画は初期構成で全部勝てていた
  （A8 §3 の未検証観測）ので、そこは12戦側で変わった。
- **第12戦は build を要求する。**mid は11戦目まで、late だけが通る。
- **rank 3 の「通常戦の round 上限 -1」が mid に効いている**（11 → 9）。
  budget +1 と精鋭変異は mid には効いていない。
- **late は rank 5 でも12戦通る。**Difficulty 0〜5 は、組み切った編成に対しては
  まだ緩い。R6 §13.2 は 6〜20 を同じ schema で足すと言っており、そこは Phase D。
  **数字を見てから 0〜5 を締め直すことはしていない**（R7 §11：見てから条件を動かさない。
  R7 §8：難易度の3層を同時に動かさない）。

第12戦の決着は late で 12ラウンド・味方全員生存。

---

## 6. 実装中に見つけて直したもの

| 何 | どう分かったか | 実害 |
|---|---|---|
| **装着した3つ目の行動が戦闘へ入っていなかった** | 第4枠を売る前に枠の道筋を辿った。`usableTactics` が v1 の `slice(0, 2)` のままだった | Phase A で枠を3へ増やして以降、**3つ目に置いた技能は画面に「装着中」と出て、戦闘では存在しなかった** |
| **戦闘中にリロードすると進行が丸ごと消えた** | `ecology-trial` の「戦闘中のリロード」で時間切れ。画面は intro に戻っていた | `loadState` が `maxHp()` を呼び、それが未代入の `state` を読んで ReferenceError → catch が save を捨てて初期化。**Phase B の12戦では毎回踏む** |
| **第6戦の手前で localStorage の quota を超えて保存が止まった** | 通しの最中に `QuotaExceededError` が1件。以降の進行は保存されない | `state.lastResult` が `replaySnapshots` ごと保存されていた（第10戦で 5.8MB）。結果画面が使う分だけへ落とし、控えの件数も送信側と同じ上限で切り、超えたら**進行ではなく控えを捨てる**順を入れた |
| 報酬の装備候補が第5戦で尽きた | 通しで「拾って次へ」が出なくなった | §3.4 のとおり、買える装備群を絞って開始 pool を14品にした |
| 遠征を捨てるボタンが精算を通らなかった | header の「新しい遠征」が run を作り直していた | R6 §9.2 は放棄でも一度精算すると書いてある。run 中は「遠征を放棄する」→精算画面へ |
| **ギルドで3人の鍛錬と第4枠が永久に買えなかった** | `/code-review` | 投資画面が8人を並べるのに、選択が遠征の5人へ丸められていた。同行していない仲間の永続投資は届かない。ギルドの選択を編成と分けた |
| **精算後に「難易度0」と表示しながら前の rank を走っていた** | `/code-review` | rank の clamp を state 差し替えの**後**でやっていたので、clamp は新しい state（常に0）を読み、run は前の選択で作られていた |
| **途中加入した仲間が技能点0・解禁表なしで入った** | `/code-review` | 加入が loadout だけを生やしていた。外した starter 技能を戻せず、manifest から外れた技能が「今回は出ない」と書かれたまま戦闘へ入っていた。加入の規則を `joinRun` へ一本化した |
| **偵察が「いまの幕」を伏せていた** | `/code-review` が戦闘前確認からの漏れを指摘 → R6 §12.1 を読み直した | R6 の偵察は**次の幕**を先に見る手であって、いま挑む敵を隠す仕掛けではない（隠すと隊列も技能も組めない）。いまの戦闘は常に全部見え、偵察は次の幕を開ける形へ直した |
| 引き直せない manifest を難易度ボタンで引き直せた | 自分で辿った | 難易度を選び直すたびに run を作り直していて、seed ごと変わっていた。seed を持ち回す |
| 離脱→再加入で技能点を配り直せた | 上の `joinRun` を書いていて気づいた | 配るのは初回だけにした |

---

## 7. 検査

- `bash analysis/check-all.sh` … 終了コード0（29.5秒 / 予算60秒）
- `node ecology/check.mjs` … 9 suites（`phase-b.test.mjs` 600 checks を新設）
- `RUN_EXHAUSTIVE=1 bash analysis/check-all.sh` … 終了コード0（366秒）
- `node analysis/ecology-trial.mjs` … **57/57**、390×844。
  ギルド→投資→編成→技能→装備→12戦→戦闘中リロード→敗北時の補給再挑戦→精算→送信まで踏む
- `node analysis/ecology-expedition-smoke.mjs` … §5 の表を出し、
  「rank 0 を通せる build が一つも無い」「初期構成で12戦通る」「rank を上げて先へ進む」を落とす
- 深一致 fixture は §4 の差分を確認してから作り直した

---

## 8. 作者へ

遊ぶときに見てほしいのは、Phase A の6項目（R7 §5 Milestone 2）に加えて次です。

- 技能パックが1つ欠けることで、組み方が変わったか。
- 補給を再挑戦・引き直し・偵察のどれに使ったか。**足りないと感じたか。**
- 報酬の4候補で迷ったか。装備・技能点・補給のどれを取ったか。
- 遠征が終わったあと、活動資金で何を買いたくなったか。**買うものが無いと感じたか。**
- 鍛錬の +0.1% が、見えないのに買う気になるか。ならないか。
- 難易度1へ進みたくなったか。

**歯ごたえについて**：初期構成では第5戦で止まり、組み切れば12戦通ります（§5）。
Difficulty 0〜5 は組み切った編成には緩いままです。そこは数字を見てから
締め直していません。締めるなら、unit 層・encounter 層・rank 層のどれか一層だけを
一度に動かします（R7 §8）。

## 9. 停止条件に触れたか（R7 §11）

- content 分離前後で出力が一致しない → **触れていない**（§4）。
- Phase A 作者 Gate 前に probe batch を越えて content を増やす → **敵・技能・装備の定義は1件も増やしていない。**
  増えたのは encounter の編成（既存 chassis の並べ替え）と、パック・難易度・変異という system 側の data。
- content 追加のため engine へ個別 ID 分岐が必要になる → **触れていない**（`ecology-contract-smoke` が見ている）。
- system と content の数値を同じ比較で同時変更 → **encounter 層だけを触った。**
  unit（敵の base stat）と rank（倍率）は動かしていない。
- Fast check が1分を超える → **20.7秒。**
- reference suite の高勝率を fun の証拠として扱う → §5 は「通せる形か」までしか言っていない。
- **作者が支持しなかった Phase を content 量で延命する → §0 のとおり、Gate 自体を飛ばしている。**
  これがこの実装で唯一、はっきり踏んでいる線である。
