# A5 — 結果

対象: [EXP-18 R5 創発的ルールエンジン実装委譲票](../R5_EMERGENT_RULE_ENGINE_IMPLEMENTATION_HANDOFF.md)
日付: 2026-08-29（UTC）

## 1. コミットとブランチ

ブランチ `claude/exp-18-r5-implementation-ye41p1`（base: main `9f9def6`）。PRは作っていない。

| commit | 内容 |
|---|---|
| `d97f3f5` | Gate A（PREFLIGHT / TRACEABILITY）。コードより前 |
| `ab83135` | エンジン本体、fixture、Gate B/C/D/F、`analysis/check-all.sh` への配線 |
| `ea27f90` | Gate E（データ追加のみ。エンジン無改造を差分で証明） |
| `d0be1d8` | IMPLEMENTATION / GATE_RESULTS / MINING_SAMPLE / RESULT、TRACEABILITY の実績更新 |
| `b5d6b1f` | push ごとの検査を1分以内に保つ配線（探索系を週次・手動へ） |
| 本コミット | **監査レビューで見つかった5件の修正**（下記 §3.5） |

## 2. 実装した範囲

`ecology/` に、UIも公開もD1も持たない決定的な戦闘ルールエンジンを作った。

- データ駆動の人物・技能・装備・状態・敵定義。エンジンに個別IDの分岐は1つも無い。
- 行動権と反応権を別資源として扱う activation queue。AP取得による末尾再投入。
- 35種のイベント型による因果列。chain / parent / sequence を持ち、IDは決定的。
- 反応: interrupt（4イベントの pending frame に同期）と after（chain末尾のFIFO）。
  発火順は priority → initiative → position → instanceId → ruleId。
- 反応、準備、位置交換、行動権再取得、余剰量（damage / healing 両方）、装備消耗。
- 無限連鎖・参照不正・発動不能を落とす検査（Gate B の10項目）。
- 小規模な構成探索とイベント連鎖採掘（81 build / 162 battle / fingerprint 96種）。
- 要求トレーサビリティと Gate 結果。

検査は `node ecology/check.mjs` の5本（1608 checks）で、`analysis/check-all.sh` から CI で鳴る。

## 3. 仕様逸脱

**4件の追加と1件の撤去。** いずれも R5 §1.2 の不変条件には触れていない。
2〜4 と撤去は監査レビューを受けて入れたもので、初版では「既知の制約」として先送りしていた。

### 3.1 v1 filter に `is_event_source` を1件追加した

R5 §9 の filter 一覧に無いものを足した。理由と反例は [PREFLIGHT §1](./PREFLIGHT.md)。

要約: v1 の語彙では「このイベントを起こしたのは自分か」が書けない。
`is_event_primary_target` は存在するのに、source 側の対応物が無い。
そのため §15.4 の「自分が与える damage/heal を +1 する positive status」が表現できない。
`has_status(subject: event_source, statusId: 自分自身)` で代用すると、
**同じ status を2人が持ったとき両方の rule が発火して +2 になる**。
fixture の保持者を1人にすると検査では見えない誤りなので、代用は採らなかった。

追加したのは関係述語1個ぶんで、新しい実行時状態も新しいイベントも増えていない。
Gate B の「未知filterを拒否」は、追加後の一覧を既知集合として維持している。

**設計担当への確認事項**: この追加を正式に v1 語彙へ入れてよいか。
入れない場合、§15.4 の positive status は v1 では実装できない（representable でない）。

### 3.2 event `barrier_proposed` を追加した

§6 のイベント一覧に防壁の提案が無く、`gain_barrier` は提案を経ずに packet を作っていた。
そのため §15.4 が要求する「次の damage/heal/**barrier** amount を+1する status」の
防壁の三分の一が**実装不能**だった。初版はこれを「既知の制約」として文書に書いて済ませていたが、
必須 fixture が欠けたまま緑になっていたので、監査レビューを受けて塞いだ。[PREFLIGHT §14](./PREFLIGHT.md)。

**設計担当への確認事項**: 防壁に提案段階を設けてよいか。設けた以上、防壁量は
cover 系の interrupt で肩代わり・増減の対象になる。

### 3.3 event `pending_amount_modified` を追加した

`modify_pending_amount` は pending frame の数値を直接書き換えるだけで、
**誰のどの規則が変えたかがイベント列から再生できなかった。**
R5 §1.2 の「全ての状態変化は因果イベントから追跡できる」を満たさないので、v2 送りにせず塞いだ。
listen 不可にしてある（他人の interrupt 窓の内側で反応が走るのを避けるため）。[PREFLIGHT §15](./PREFLIGHT.md)。

### 3.4 effect `repair_equipment` と event `equipment_repaired` を追加した

R5 §10.2 に耐久を戻すものが無く、§5.2 が負の amount を禁じている。
初版は §15.3 の「1修理する装備」を保持者のHP回復へ置換していたが、
**配線の検査にはなっても同じゲーム性ではない**（装備消耗を遠征のトレードオフにするなら修理は基礎語彙）。
[PREFLIGHT §16](./PREFLIGHT.md)。

決めた意味は2つ。**maxDurability で clamp する**、**耐久0で壊れた装備は修理で復活しない**。
後者は §5.6「0になった装備は以後 rule を供給しない」を修理が黙って取り消さないための決めで、
壊れた装備は自分の修理規則も供給しないので自力では戻ってこられない。

**設計担当への確認事項**: この「壊れたら戦闘中は戻らない」を正式仕様にしてよいか。
遠征側で戦闘間に修理するのか、消耗品として失うのかは、まだ決まっていない。

### 3.5 stalemate 判定を撤去した（R5 §11.6 の任意項目）

初版は採用していたが、**正当な待機戦術を殺していた。**

~~~js
tactics: [{ activeSkillId: "strike", useWhen: [{ type: "round_number", op: "gte", value: 3 }] }]
// 初版: 2ラウンド目の終わりで draw / stalemate。strike は一度も撃てない。
~~~

v1 は `round_number` と `history_count` を述語に持つので、待機を条件にした技能は普通に書ける。
その待機中は判定が見る5つの量がどれも動かず、待機と膠着を区別できない。
hash にラウンド数や履歴を足しても、今度は判定が一度も成立しなくなるだけである。
[PREFLIGHT §17](./PREFLIGHT.md)。

**設計担当への確認事項**: 膠着を早く畳む仕組みが要るなら、
「両側とも damage_proposed を1件も出していないラウンドが N 回続いた」のような
**行動に基づく**条件で設計しなおす必要がある。状態の無変化では待機と区別できない。

## 4. 全テスト結果

~~~sh
$ node ecology/schema.test.mjs        # exit 0 — 126 checks
$ node ecology/engine.test.mjs        # exit 0 — 589 checks
$ node ecology/termination.test.mjs   # exit 0 — 108 checks
$ node ecology/extensibility.test.mjs # exit 0 — 31 checks
$ node ecology/mine.test.mjs          # exit 0 — 754 checks
$ node ecology/check.mjs              # exit 0 — 5 suites
$ bash analysis/check-all.sh          # exit 0 — 既存の検査も含めて全部
~~~

Gate A〜F すべて通過。詳細と実測値は [GATE_RESULTS.md](./GATE_RESULTS.md)。

## 5. 実装していないもの

R5 §0 が「今回実装しない」と書いたものは、全て実装していない。

- ブラウザUI、Cloudflare公開、D1保存。
- 本番キャラクター名、立ち絵、物語。
- 本番の12アクティブ・12リアクティブ・18装備。
- 遠征画面と長期キャンペーン。
- 既存 `frontier/` の改造（1バイトも変更していない）。

v1 として意図的に実装していないもの:

- 予約イベント5種（参照すると validator error）。
- 空き枠への移動、敵味方間の交換、押し出し。
- 復活、自傷による戦闘不能。
- 耐久を条件にする述語（修理規則は「直すものがあるか」を事前に判定できない）。
- 1人が同じ装備を2つ持つこと（validator が拒否。PREFLIGHT §18）。
- `stalemate` の判定（reason 一覧には残るが v1 は返さない）。

既知の制約は [IMPLEMENTATION.md §5](./IMPLEMENTATION.md) に5件挙げてある。

## 6. 次の設計担当が判断すべき点

1. **§3.1〜§3.4 の語彙追加4件を v1 として認めるか。** 認めない場合、§15.4 の強化 status（damage / heal / barrier）と
   §15.3 の修理装備は v1 では書けないので、R5 側の必須 fixture を落とす判断になる。
2. **装備が壊れたあとの扱い。** 戦闘中は戻らないと決めた。遠征側で直すのか、消耗して失うのか。
3. **膠着を畳む仕組みが要るか。** 要るなら状態の無変化ではなく行動に基づく条件で（§3.5）。
4. **同じ装備を2つ持てるようにするか。** 現在は validator が拒否している。
   許すなら §5.7 の発火予算を装備インスタンス単位へ変える判断が要る。
5. **`turn` duration の意味。** 現在は「保持者の activation 終了時に消える」。
6. **どの chain fingerprint を面白い候補とみなすか。** 実装担当は判定しない。
7. **本番コンテンツ一式**（人物8名の固有能力と数値、技能・装備、初期敵、遠征の回復速度、
   人間テストへ出す build arc、UIとアート文脈）。

## 7. していないこと（明記）

- **UI・公開・人間テストへ進んでいない。** 作者にプレイURLは渡していない。
  [docs/HUMAN_TEST_RELEASE.md](../../../../docs/HUMAN_TEST_RELEASE.md) の条件は満たしていないし、満たそうともしていない。
- **面白さを証明していない。** Gate は「実装が次の設計実験を信用できるか」だけを見ている。
  fingerprint が96種出たことは、因果列が決定的で、データ追加で形が増えることの証拠であって、
  面白い組み合わせが96個あることの証拠ではない。
- **採掘結果を見て「面白そうなコンボ」を本番コンテンツへ追加していない**（R5 §20）。
  `fixture-content.mjs` は検査用であり、本番コンテンツではない。
- **仮説の支持・棄却をしていない。** この票は仮説検証の前段の基盤づくりである。
