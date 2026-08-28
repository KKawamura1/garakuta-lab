# SCRAPLINE — 企画書実装マップ

更新日: 2026-08-28（UTC）
対象企画: `analysis/SCRAPLINE_GAME_CONCEPT.md`
ruleset: `scrapline-0.7`
build: `scrapline-build-20260828-r8`
schema: `5`

## 何を検証できる実装にしたか

SCRAPLINE 0.7 は、強い部品を引くゲームではなく、「一つの鉄塊が車列を通って
変形する共通物理を読み、新しい一両で既存列を再解釈したくなるか」を検証する。
そのため、ルールだけでなく、予測・ショー・答え合わせ・記録の順序も実装対象にした。

1. **決定的な弾の変形**
   `makeProjectile` / `processLine` が、弾ID、重さ、火花、速度、分裂、
   圧縮、溶融、帰還、回収印を同じ物体の状態として追跡する。
2. **配置順と局所プレビュー**
   `previewTrain` は各車両の前後だけを正確に見せ、最終勝敗は予告しない。
   タップ選択面とドラッグ把手を分け、満車時は交換先を選ぶまで仮組みも交換も行わない。
3. **全敵共通の時間コスト**
   `computeTravel` で求めた着弾時間だけ `enemy.approach` が進む。
   全通常敵が同じ `advanceEnemyBeforeImpact` を使い、長い列は敵名や正確な
   車両数に依存せず着弾前攻撃を受ける。旧版の四両専用迎撃は削除した。
4. **異なる四つの問いと二段階ボス**
   群れ、装甲、高速砲、拾い屋をボス前に必ず一度ずつ提示する。第1区画は群れ、
   第2区画は非群れで、同じ問いを連続させない。ボスは重い圧縮弾、溶解、
   帰還再加工など複数の物理状態で突破できる。
5. **正解保証のない残骸三択**
   三候補はseedと区画から決定し、重複と現車両を除く。特定カウンターや
   磁石車＋逆走車を保証しない。直前に自分で解体・交換した一台だけは
   `RECOVER` と明示して一度回収でき、短列化を可逆にする。選択前から次敵も表示する。
6. **予測→ショー→答え合わせ**
   戦闘イベントの最終コマまでは勝敗、最終HP、因果要約、続行操作をDOMへ出さない。
   最も派手な一斉射の加工列、各ウェーブ決着、帰還、大被害、相討ちを32コマ内へ
   優先保存し、衝突・帰還・決着を通常加工より長く保持する。
7. **損耗と後半判断**
   区画間の自動修理は最大1。高速砲の後半個体は短列・加速と一時解体の判断を
   要し、初期列や追加順だけの方策が後半を自動突破しない。
8. **測定完全性**
   提示三候補、次敵、選択前後、採用・見送り、seed、版、時刻、途中終了、
   マーカー、自由記述をschema 5 payloadへ保存する。pagehideは
   `sendBeacon` で途中状態をupsertし、明示終了後はアンケートを送信できる。
9. **一ランを作品として残す**
   最終画面の見せ場は最終戦固定ではなく、保存した全7戦からイベント指標最大を
   選ぶ。回答前に具体的な車両名や回答例を提示せず、プレイヤー自身の未完の問いを残す。

## 企画境界と固定検査

| 企画上の境界 | 実装 | 固定検査 |
| --- | --- | --- |
| 一つの鉄塊を追跡 | projectile ID と前後スナップショット | `scrapline-smoke.mjs` |
| 配置順で意味が変わる | 加速・切断・帯電・溶融・磁石・圧縮・逆走を順次適用 | `scrapline-smoke.mjs` |
| 長列に共通の時間代償 | 全敵共通 `approach += travel`、着弾前攻撃 | `scrapline-physics-smoke.mjs` |
| 固有四両例外を置かない | 命中判定から正確な車両数分岐を削除 | `scrapline-physics-smoke.mjs` |
| 敵順に感情曲線を持たせる | 群れ開始、非群れ第2区画、四問網羅、連続なし | `scrapline-seed-regression.mjs` |
| 報酬を持ち物検査にしない | 正解保証なしの三択、自己解体品の一度回収、次敵予告 | `scrapline-reward-smoke.mjs` |
| 後半にも判断を残す | 修理最大1、愚直三方策の被害・未完走閾値 | `scrapline-run-policy-smoke.mjs` |
| 同seedに別方針を残す | 重弾・溶解型と分裂・帰還型の合法完走 | `scrapline-run-diversity-smoke.mjs` |
| 結果をショーより先に出さない | `reportDisclosure` と再生完了ゲート | `scrapline-presentation-smoke.mjs` |
| ログで仮説を再現できる | offerHistory、行動前後、途中終了、schema 5 | `scrapline-telemetry-smoke.mjs` |
| 万能固定列を作らない | 全順序列を全7区画へ照合 | `scrapline-balance-smoke.mjs` |

## 敵の問い

| 問い | 画面上の行動 | 解法と代償 |
| --- | --- | --- |
| 群れ | 三体が散り、遅い単発をかわす | 分裂、溶解爆風、速度、帰還。初期列でも複数射で突破 |
| 装甲 | 軽い弾を有限回弾き、装甲値を引く | 圧縮重弾、溶解、帰還累積。初期列は被害つき突破 |
| 高速砲 | `travel` 中に照準し、遅い弾道を迎撃する | 短列、加速、一時解体。長い高火力列は命中前に止められる |
| 拾い屋 | 残骸回復と尾部窃取 | 早期撃破、回収、帰還、尾部装甲 |
| ボス | 群れの護衛と炉心殻の二段階 | 圧縮重弾、溶解、帰還再加工を異なる全体構成で成立 |

戦闘結果は乱数に依存しない。seedは敵順と残骸候補だけを変え、同じ状態・同じ配置は
同じイベント列になる。

## 機械検査で確認した範囲

- 順序付き1〜5両を64,471列挙し、seed 0の全7区画、合計451,297戦を照合する。
- 「順序を変えない」方策は256 seedすべてで被害、225 seedで未完走。
- 「常に末尾追加」は251 seedで被害、252 seedで未完走。
- 「第3区画以降見送る」は256 seedすべてで被害、252 seedで未完走。
- 256 seedすべてにUI上の移動・解体・回収・報酬選択だけで完走路があり、
  推奨完走時の最終編成は64種類、敵順は54種類に分かれる。
- 順序付き64,471列の全7問照合で、全問を固定順のまま勝つ万能列は0。
- seed 6では、同じ敵順のまま重弾・溶解型と分裂・帰還型がともに7区画を完走し、
  採用報酬、発動機構、並べ替え履歴が異なる。
- ボスとの同時破壊を `won=false / outcome=mutual / enemyDefeated=true` として保存する。

これらは面白さの合格判定ではない。企画書の仮説を壊さず人間へ提示できる条件と、
ログから判断を再現できる条件だけを固定する。

## 検査入口

次担当の判断順、変更権限、残作業の証拠形式は
`analysis/SCRAPLINE_AGENT_RUNBOOK.md` を正とする。通常は次の統合入口を使う。PR/pushの通常CIは、64,471列の全順序探索と256 seed回帰だけを除外した
高速経路である。探索本体とassert条件は変更していない。全量を確認するときは
`RUN_EXHAUSTIVE=1` を付ける。GitHub Actionsでは
`.github/workflows/exhaustive-checks.yml` が手動・週次でこの経路を実行する。

```sh
node analysis/scrapline-agent-gate.mjs --quick
node analysis/scrapline-agent-gate.mjs --full
RUN_EXHAUSTIVE=1 bash analysis/check-all.sh
```

個別に原因を切り分ける場合だけ、以下を直接実行する。

```sh
node analysis/scrapline-smoke.mjs
node analysis/scrapline-presentation-smoke.mjs
node analysis/scrapline-physics-smoke.mjs
node analysis/scrapline-reward-smoke.mjs
node analysis/scrapline-run-policy-smoke.mjs
node analysis/scrapline-run-diversity-smoke.mjs
node analysis/scrapline-telemetry-smoke.mjs
node analysis/scrapline-seed-regression.mjs
node analysis/scrapline-balance-smoke.mjs
bash analysis/check-all.sh
```

## コード外に残る公開ゲート

機械検査が通っても面白さは未確認である。URLを案内する前に
`docs/HUMAN_TEST_RELEASE.md` に従い、公開先のiPhone Safari相当390×844で全主要操作、満車交換、
中盤リロード、勝敗・相討ち・途中終了、アンケート送信、D1保存、Actions export、
ruleset/build/seed/提示候補/行動前後/自由記述の一致を確認する。
