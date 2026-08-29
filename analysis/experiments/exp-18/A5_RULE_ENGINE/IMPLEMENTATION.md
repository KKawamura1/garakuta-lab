# A5 — 実装記録

対象: [R5](../R5_EMERGENT_RULE_ENGINE_IMPLEMENTATION_HANDOFF.md)
ブランチ: `claude/exp-18-r5-implementation-ye41p1`
コミット: `d97f3f5`（Gate A）→ `ab83135`（エンジン）→ `ea27f90`（Gate E）→ 本文書

## 1. ファイル構成

R5 §3.3 の推奨構成に、`errors.mjs`、`actors.mjs`、`values.mjs` を足した。
責務分離は保っている（推奨構成は「同じ責務分離を保てば変更してよい」）。

| ファイル | 行 | 責務 |
|---|---|---|
| `ecology/schema.mjs` | 325 | v1語彙の凍結リストと構造上限 |
| `ecology/errors.mjs` | 26 | 検証エラー／実行時エラー |
| `ecology/actors.mjs` | 130 | 戦闘状態の読み取りと履歴カウンタ |
| `ecology/values.mjs` | 39 | §10.3 の効果量 |
| `ecology/predicates.mjs` | 97 | §8 の11述語 |
| `ecology/selectors.mjs` | 103 | §9 の対象クエリ |
| `ecology/effects.mjs` | 617 | §10.1 コストと §12 原子的効果 |
| `ecology/event-queue.mjs` | 114 | イベント列、chain、上限、診断 |
| `ecology/engine.mjs` | 1009 | 公開API、進行順、反応発火、勝敗、結果 |
| `ecology/validate.mjs` | 867 | Gate B |
| `ecology/fixture-content.mjs` | 1008 | §15 の検査用コンテンツ |
| `ecology/fixtures.mjs` | 489 | 戦闘入力29件と採掘プール |
| `ecology/mine.mjs` | 167 | §16 F 連鎖採掘 |
| `ecology/check.mjs` | 30 | 5本の実行と exit code 検査 |
| `ecology/*.test.mjs` | 1618 | Gate B/C/D/E/F |
| `ecology/README.md` | 222 | イベントvalues表、進行順、stalemate、逸脱 |

外部依存なし。Node 22 標準機能のみ。PREFLIGHT に依存追加の必要性は書いていない（必要が生じなかった）。

## 2. 公開API

~~~js
// ecology/engine.mjs
export function simulateBattle(input, contentBundle, options = {})
export function validateBattleInput(input, contentBundle)
export function validateContentBundle(contentBundle)   // validate.mjs から再export

// ecology/validate.mjs
export function validateContentBundle(contentBundle)
export function validateBattleInput(input, contentBundle)

// ecology/mine.mjs
export function mineBuilds(miningInput, contentBundle, options = {})
export function fingerprintEventChain(battleResult)
export function enumerateBuilds(miningInput)
~~~

validate系の戻り値は `{path, code, message}` の配列（空なら妥当）。
`simulateBattle` は不正なら `EcologyValidationError`、上限到達なら `EcologyRuntimeError` を投げ、
部分的な結果を返さない。

## 3. R5からのHOW変更と、その同値性

いずれも結果の意味を変えず、外から観測される順序をテストで固定した。

| R5 | 実装 | 同値性の根拠 |
|---|---|---|
| §11.5「反応で新イベントが出た場合はFIFO」 | interrupt はその場で同期処理、after だけ chain 末尾の FIFO | 同 §11.5「現在のinterrupt windowを閉じる前にそのwindowのinterruptを全て処理する」を満たすには interrupt は同期でなければならない。§11.4 も after 反応の解決を `action_resolved` の後に置いている |
| §11.6 の6段階 | 各段階の直後に after queue を drain | 字面どおりだと §15.3 の RP コストが恒偽（PREFLIGHT §4）。段階の順序自体は変えていない |
| §11.3-8「tacticが一つも使えなければaction_skippedを一回記録」 | 一度も行動しなかった activation にだけ記録 | 行動後にAPが尽きた場合も記録すると、成功した行動の直後に必ず skip が並ぶ。余りは §11.6-2 の `resource_unused` に出るので情報は落ちない |
| §11.3-2「activation 8以上なら循環エラー」 | 到達不能な防御的検査として残し、上限は安全制約として扱う | 再投入条件が「8未満」なので他に投入経路が無い（PREFLIGHT §5）。防御的検査は残してある |
| §12.6「wear_equipment は対象equipment instance」 | rule の出所である装備インスタンスに限定。validator が装備由来でない rule の使用を拒否 | v1に装備インスタンスを指す対象クエリが無いため、これ以外に決定的な指定方法が無い |
| §5.5 preparation | 技能の `preparation` と effect `start_preparation` を同じ実装経路にした | 二重実装を避けただけ。completionEffects の中で `start_preparation` を使うのは validator が拒否（無限入れ子の防止） |
| §11.4-11 技能の効果 | 効果解決時の「現在のイベント」を `action_started` にした | `scope: "event_targets"` が「この行動が実際に狙っている相手」を意味するようになり、cover による差し替え後も正しい対象になる |

追加で決めたこと（R5 が未定義だった箇所。理由は PREFLIGHT と README）:

- round_limit の結果は `loss`。
- 双方全滅かつ objective 未達は `draw` / `all_allies_defeated`。
- ラウンド終了処理の途中で作られた round barrier / round status は、その場では失効しない。
- region rule は `self` の述語・スコープ・コストを拒否し、`allies` / `enemies` を両側として解決する。
- `resource_refreshed` を listen する rule は validator error。
- rule ID は contentBundle 内で大域的に一意。
- `turn` duration の status は保持者の activation 終了時に消える。

## 4. frontier から引き継いだ考え方と、写さなかったもの

引き継いだ（R5 §3.1）:

- エンジンが UI を知らない。`ecology/` に DOM も fetch も無い。
- 同じ入力が完全に同じ結果とイベント列を返す（`engine.test.mjs` が100回で確認）。
- 表示はイベント列の再生。イベントに表示文を入れない。
- テストが数値だけでなく必要イベントの存在と順序を見る。
- 内容定義とエンジンを分ける。

写さなかった（R5 §3.2）:

- 三拍固定 → 行動権／反応権と activation queue。
- 味方一体につき行動一つ → AP がある限り複数行動、AP取得で再投入。
- `ram` / `echo` / `capacitor` などの機体固有分岐 → 存在しない。エンジンに個別IDの分岐が1つも無い。
- `actAlly` 内の `action.type` ごとの分岐 → 効果はデータで、`applyEffect` は v1 effect 型のディスパッチだけ。
- 群れ／要塞の分類 → 敵は tactic と rule を持つだけで、種別分岐が無い。
- `lastAllyAttack` のような特定コンボ専用状態 → 履歴は §8 の12指標だけ。
- `missionId` に埋めた特定目的の処理 → objective は3種の宣言で、判定は共通。

`frontier/` は1バイトも変更していない。

## 5. 既知の制約

1. **interrupt が量を変えたとき、どの rule が変えたかはイベントに残らない。**
   v1 の EventType に「量が変わった」を表す語が無いため。差分自体は
   `damage_proposed.amount`（変更前）と `damage_taken.proposed`（変更後）の差として見える。
   v2 で `amount_modified` 相当を足すなら、そこで rule ID を残せる。
2. **防壁量は interrupt で変更できない。** `gain_barrier` に提案イベントが無く、pending frame も無い。
   §15.4 の強化 status が damage と heal しか強化できないのはこのため。
3. **装備の修理ができない。** PREFLIGHT §2。
4. **反応候補はイベントごとに一度だけ列挙する。** 先行反応が新しい status を付けても、
   その status の rule は同じイベントの反応列には加わらない（次のイベントからは加わる）。
   決定性のためで、README にも書いてある。
5. **同じ装備を2つ持つと rule 予算を共有する。** §5.7 の「同 owner の同 rule は 1 chain 1回」を
   字面どおり実装したため。装備インスタンスごとに独立させるなら、この制約の書き換えが要る。
6. **`different_targets` と `same_target_streak` は能動行動の対象だけを数える。**
   反応の対象は数えない。
7. **stalemate は「2ラウンド連続で state hash が変わらない」だけを見る。**
   同じ状態を往復する2周期の膠着は検出できない。
