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
| 本コミット | IMPLEMENTATION / GATE_RESULTS / MINING_SAMPLE / RESULT、TRACEABILITY の実績更新 |

## 2. 実装した範囲

`ecology/` に、UIも公開もD1も持たない決定的な戦闘ルールエンジンを作った。

- データ駆動の人物・技能・装備・状態・敵定義。エンジンに個別IDの分岐は1つも無い。
- 行動権と反応権を別資源として扱う activation queue。AP取得による末尾再投入。
- 35種のイベント型による因果列。chain / parent / sequence を持ち、IDは決定的。
- 反応: interrupt（4イベントの pending frame に同期）と after（chain末尾のFIFO）。
  発火順は priority → initiative → position → instanceId → ruleId。
- 反応、準備、位置交換、行動権再取得、余剰量（damage / healing 両方）、装備消耗。
- 無限連鎖・参照不正・発動不能を落とす検査（Gate B の10項目）。
- 小規模な構成探索とイベント連鎖採掘（81 build / 162 battle / fingerprint 80種）。
- 要求トレーサビリティと Gate 結果。

検査は `node ecology/check.mjs` の5本（1550 checks）で、`analysis/check-all.sh` から CI で鳴る。

## 3. 仕様逸脱

2件。どちらも R5 §1.2 の不変条件には触れていない。

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

### 3.2 §15.3 の「1修理する装備」を回復へ置換した

R5 §10.2 の effect 一覧に耐久を戻すものが無く、§5.2 が負の amount を禁じている。
そのため fixture は、同じ配線（`resource_unused` を listen する装備由来 rule、
`spend_reaction_points` コスト、`event_tag` / `event_value` による資源種別判定）を保ったまま、
保持者を1回復する装備にした。[PREFLIGHT §2](./PREFLIGHT.md)。

**設計担当への確認事項**: 装備の修理を v2 に入れるか。
入れる場合、`repair_equipment` effect と `equipment_repaired` イベントに加えて、
「壊れた装備は rule を供給しない」（§5.6）の解除条件を決める必要がある。これは実装担当が決めない。

## 4. 全テスト結果

~~~sh
$ node ecology/schema.test.mjs        # exit 0 — 119 checks
$ node ecology/engine.test.mjs        # exit 0 — 538 checks
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
- 復活、自傷による戦闘不能、装備の修理。
- 防壁量の interrupt 変更（提案イベントが無い）。

既知の制約は [IMPLEMENTATION.md §5](./IMPLEMENTATION.md) に7件挙げてある。

## 6. 次の設計担当が判断すべき点

1. **§3.1 の filter 追加を v1 語彙として認めるか。** 認めない場合の代替案が必要。
2. **§3.2 の装備修理を v2 に入れるか。** 入れるなら broken 解除の規則も決まる。
3. **interrupt が量を変えたときの追跡。** 現在は「どの rule が変えたか」がイベントに残らない
   （差分は見える）。R4 の「全ての状態変化は因果イベントから追跡できる」を厳密に満たすなら、
   イベント型を1つ足す判断が要る。
4. **同じ装備を2つ持ったときの rule 予算。** 現在は §5.7 の字面どおり共有する。
   物理的に2つあるなら独立させるべきか。
5. **`turn` duration の意味。** 現在は「保持者の activation 終了時に消える」。
6. **どの chain fingerprint を面白い候補とみなすか。** 実装担当は判定しない。
7. **本番コンテンツ一式**（人物8名の固有能力と数値、技能・装備、初期敵、遠征の回復速度、
   人間テストへ出す build arc、UIとアート文脈）。

## 7. していないこと（明記）

- **UI・公開・人間テストへ進んでいない。** 作者にプレイURLは渡していない。
  [docs/HUMAN_TEST_RELEASE.md](../../../../docs/HUMAN_TEST_RELEASE.md) の条件は満たしていないし、満たそうともしていない。
- **面白さを証明していない。** Gate は「実装が次の設計実験を信用できるか」だけを見ている。
  fingerprint が80種出たことは、因果列が決定的で、データ追加で形が増えることの証拠であって、
  面白い組み合わせが80個あることの証拠ではない。
- **採掘結果を見て「面白そうなコンボ」を本番コンテンツへ追加していない**（R5 §20）。
  `fixture-content.mjs` は検査用であり、本番コンテンツではない。
- **仮説の支持・棄却をしていない。** この票は仮説検証の前段の基盤づくりである。
