# EXP-18 灰の遠征 0.3（戦闘アニメーション） — 公開条件結果

作成日：2026-08-29
対象：PR #51 / ブランチ `claude/battle-log-animation-vvwajy`
公開先：`https://claude-battle-log-animation.garakuta-lab.pages.dev/ecology/`
build の印：`26f4570 / 2026-08-29 22:54Z`（画面の一番下に出る）

## 判定

**公開可。** [docs/HUMAN_TEST_RELEASE.md](../../../docs/HUMAN_TEST_RELEASE.md) の
5項目すべてPASS。未確認は0件。

## 1. 要求トレーサビリティ

作者の依頼（2026-08-29、会話）を1行ずつ置く。

| 要求（原文） | 状態 | 証拠 |
|---|---|---|
| 「戦闘のログ表示が見づらいので、アニメーションにしてほしい」 | PASS | 盤面表示に置換（`ecology/app.js` `renderBattle` / `syncBattleView`）。ecology-trial「盤面に味方と敵の箱が出る」「ダメージ値が対象の上に浮かぶ」。commit 00aeeaa |
| 「キャラクターが攻撃し合う感じにしてほしい」 | PASS | 行動側 `.is-striking` が相手側へ踏み込み、被弾側 `.is-hit` が揺れる（`ecology/styles.css`）。公開先の通しで実測 |
| 「名前とHPの書かれた箱が人数分あって」 | PASS | 味方4＋敵2〜3の箱に名前・HP帯・HP数値・防壁。ecology-trial「盤面に味方と敵の箱が出る」（6箱） |
| 「スキル表示とともに」 | PASS | 箱の中の札に使用中／準備中の技能。ecology-trial の第7区画確認で `準備 重い一撃（残1）` を観測 |
| 「ダメージ値が対象の上に浮かぶ」 | PASS | `.float.damage` を対象の箱の上へ生成。ecology-trial「ダメージ値が対象の上に浮かぶ」 |
| 「ログ表示は……デバッグログ的な扱いに降格」 | PASS | 盤面下の折りたたみ（既定で閉）へ移動。結果画面の一覧も同じ扱い。ecology-trial「ログは既定で閉じている」「デバッグログを開ける」「結果画面でもログは折りたたみ」 |
| 「アニメーションがわかりづらいときに補助的に見る」 | PASS | 一時停止・一拍戻す／進める・速さ3段・最初から再生。結果画面から「戦闘をもう一度見る」。ecology-trial で全操作を踏んだ |

実験票（R3/R4/R5）の仕様・閾値は変更していない。戦闘の解決規則、
編成・技能・装備・敵・区画数はすべて据え置き。変えたのは表示と、
下の「4. ログ完全性」で見つけた保存欠陥の修正だけ。

## 2. 既存プレイテストUIの踏襲

| 条件 | 状態 | 証拠 |
|---|---|---|
| 選択可能な全要素の名前と効果を選択前に読める | PASS | 技能ノード・装備カードの説明は据え置き。盤面は HOW TO READ で読み方を明示 |
| 操作不能な選択肢は理由が分かる | PASS | 一拍戻す／進めるは端で不可、最後まで見た後は「最初から再生」に変わる |
| 感情マーカーに任意メモを付けられる | PASS | ecology-trial「感情マーカーに任意メモを付けられる」、D1 `moment_rows=1` |
| 終了アンケートに既定値を入れない | PASS | ecology-trial「アンケートに既定値が入っていない」 |
| 版・seed・build stamp を画面で確認できる | PASS | **今回追加した**（従来ecologyには build の印が無かった）。ecology-trial「build の印が画面に出ている」 |
| 途中リロードから復旧できる | PASS | ecology-trial「戦闘中のリロードから復旧する」（第3区画の戦闘中に実施） |
| prompt/confirm へ依存しない | PASS | `ecology/` に `prompt(` `confirm(` `alert(` は無い |
| 390×844 で主要操作が画面外へ隠れない | PASS | ecology-trial は 390×844 固定。「タブが画面内に収まる」「再生の操作が画面内にある」「送信ボタンが画面内にある」 |

意図的に外した既存機能は無い。

## 3. 本番E2E

**この箱から pages.dev へは出られない**（egress ブロック、`connect_rejected` を実測）。
そのため同じ台本を GitHub Actions から公開先に対して走らせた。作者に代行は頼んでいない。

- 台本：`analysis/ecology-trial.mjs`（手元では localhost、CIでは公開先）
- 経路：`.github/workflows/ecology-trial.yml`（push で起動。公開先が期待した
  build を出すまで待ってから遊ぶ）
- 実行：[run #4](https://github.com/KKawamura1/garakuta-lab/actions/runs/33279836278) — 32/32 通過、終了コード0

踏んだもの：初期表示 → 編成・スキル・装備・戦闘の4タブ → スキルツリーのノード選択 →
第1〜5区画の戦闘（盤面・浮かぶダメージ値・デバッグログ開閉）→ 各区画の報酬選択 →
**第3区画の戦闘中にリロード** → 敗北時の「構成を見直す」→ 終了アンケート送信 →
D1保存 → D1からの読み戻し照合。

## 4. ログ完全性

**この通しで欠陥を1件見つけ、直した。**

公開先の最初の通し（[run #1](https://github.com/KKawamura1/garakuta-lab/actions/runs/33279382239)）で、
送信が `invalid_payload` で弾かれていた。`ecology/app.js` は4000件で切って送り、
`functions/api/runs.js` は2000件で弾く。戦闘イベントを1件ずつ積むので、
**5区画も遊べば超える＝長く遊んだランほどD1に残らない。**
画面には「端末に保存しました（D1未送信）」としか出ないため、
公開先で通しを踏むまで誰も気づかなかった（PR #49 の時点から存在）。

- 直した：送信上限を件数2000・本体700KBへ揃え、溢れたら古い方から落とす（commit 26f4570）
- 何件記録して何件送ったかを `stats` に残す（黙って切ると「起きなかった」と読める）
- 機械に移した：`analysis/ecology-upload-smoke.mjs` が両方のファイルから
  実際の数を読んで比べる。押すたびに走る（240ms）

**この欠陥を通してしまった検査も直した。** ecology-trial は送信結果を
「保存しました」で見ていたが、成功「D1に保存しました」と失敗
「端末に保存しました（D1未送信）」の両方に入る。成功文字列で見るようにし、
さらに**画面の文言ではなくD1の実物**を引くようにした。

読み戻した行（[run #4](https://github.com/KKawamura1/garakuta-lab/actions/runs/33279836278)、
自由記述の本文は公開ログへ出していない）：

```
run_id          c9de99e3-413f-48c9-9fd5-ac40b988b6de
game_version    EXP-18 Full prototype 0.3
seed            frontier-1801-3381e1a1
build_stamp     26f4570 / 2026-08-29 22:54Z
events          1001 / 2084 件（記録2084、送信1001）
answer_replay   4
answer_marker   payoff
free_text       書いたとおり（一致=1）
moment_rows     1
```

選択前状態・選択した行動・選択後状態は `combat_event` として1イベントずつ残る。
版・seed・時刻・感情マーカー・アンケート数値・自由記述はすべて上のとおり保存を確認した。

**残っている制限（作者へ）：** 7区画を通すと記録は2084件を超え、
バイト上限で古い側が落ちる（上の例では1001件送信）。落とした件数は
`eventsRecorded` / `eventsSent` に残るので、後から「起きなかった」とは読めない。
全イベントを残したいなら、`combat_event` の粒度を落とす設計変更が要る。
これは今回の依頼の範囲外なので手を付けていない。

## 5. 公開判定

| 条件 | 状態 |
|---|---|
| 個別の自動ゲート（`ecology/check.mjs` 6 suites） | PASS |
| 要求トレーサビリティ | PASS（上表、未確認0件） |
| 既存UI踏襲 | PASS |
| 本番E2E | PASS（公開先で32/32） |
| リロード復旧 | PASS（本番の戦闘中に実施） |
| D1保存とexport照合 | PASS（D1から読み戻して照合） |
| 全検査コマンドの終了コード0 | PASS（`RUN_EXHAUSTIVE=1 bash analysis/check-all.sh` 180秒、終了コード0） |
| ルール版とbuild stamp更新 | PASS（版 0.2 → 0.3、build の印 `cc732e7` → `26f4570`、sw キャッシュ v57 → v58） |

規則そのものは変えていないため `core/rules-version.mjs` は据え置き
（`analysis/smoke-version.mjs` は通っている＝規則の指紋 `4b3adaa0af5c` は不変）。
画面が変わったので `ecology/app.js` の `VERSION` だけを 0.3 へ上げ、記録を分けた。
