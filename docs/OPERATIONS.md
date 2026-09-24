# 運用 — 検査・公開・プレイ記録

## 1. 変更の流れ

1. AGENTS.md と、変更対象の実装・テストを読む。必要なら `docs/` の該当節。
2. 検査を走らせる。
3. Cloudflare Pages の Build command は `npm run build`、出力ディレクトリは `.` とする。
   build 時に `CF_PAGES_COMMIT_SHA` から `core/build.generated.mjs` を生成する。
   この sidecar は `.gitignore` 対象なので commit しない。
4. GitHub Actions の通常 Checks が成功してから、必要なら公開先 E2E を実行する。
5. 検査結果と未確認事項を PR に残す。やり残しは GitHub Issues へ。


## 2. 検査の中身

`bash analysis/check-all.sh` は、`ecology/` の構文検査 → `node ecology/check.mjs`
（`ecology/*.test.mjs`）→ 現行smokeを順に走らせます。

| smoke | 見るもの |
|---|---|
| `ecology-anti-stall-audit.mjs` | 回復・反応の停止性監査 |
| `ecology-contract-smoke.mjs` | content 契約と凍結 ID の照合 |
| `ecology-equipment-gen-smoke.mjs` | 装備の手続き生成の決定性と完結性 |
| `ecology-map-smoke.mjs` | 12戦のマップ配置と現在地・種別表示の契約 |
| `ecology-enemy-tactics-smoke.mjs` | 敵actorと分離された敵技能registryの参照整合性 |
| `ecology-campaign-curve.mjs` | Campaignの敵圧力曲線 |
| `ecology-weapon-loadout-smoke.mjs` | 初期4技能、武器skill pack、敵技能との分離 |
| `ecology-screens-smoke.mjs` | 画面と主要操作の接続 |
| `ecology-test-hygiene-smoke.mjs` | 明らかな恒真 assert の検出 |
| `ecology-upload-smoke.mjs` | D1 payload と受け側の整合 |

公開先のPlaywright通しは、現行の静的smokeとは別の確認項目です。PR #288では旧台本と
壊れたworkflowを削除し、公開先での1〜2遠征の確認を未実施として残します。URLを確定版と
して案内する前に、現行バンドルを公開してから手動で確認します。

## 3. 作者へ URL を渡す前に

自動検査は面白さを判定しません。渡してよいのは、**未確認の経路が残っていないとき**だけです。

- 変更が schema / content / UI / 保存形式のどこへ影響するか確認した。
- `node ecology/check.mjs` と `bash analysis/check-all.sh` が成功する。
- 変更した表示や payload に、旧入口・旧版の表示が残っていない。
- 公開先で: `/ecology/` が開く、Campaign Stage を選べる、隊列・技能・装備を設定できる、
  次の敵の狙いと戦闘条件を開始前に読める、自動戦闘が決着してリプレイとイベントログを
  確認できる、戦闘中の再読み込みから復旧できる、終了アンケートと D1 送信の成功・失敗を
  区別できる。
- 画面に出る content contract と build 印が、Pages buildが生成した公開先の
  `core/build.generated.mjs` と一致する。
- 古い service worker や旧入口へ誘導されない。

**失敗した経路があるときは URL を渡さず、失敗した経路を記録します。**

### 3.1 消す前提で入っている一時導線

**残ったまま公開されるのを、宣言と検査で防ぎます。**`ecology/app.js` の
`TEMPORARY_DEBUG_ENTRIES` が一時導線の正本で、`analysis/ecology-screens-smoke.mjs` が
この表と下の欄が一致していることを見張ります。**片方だけ消すと検査が落ちます。**

| id | 何のためか | いつ消すか |
|---|---|---|
| （現在なし） | | |

足すときも消すときも、この表の行と `TEMPORARY_DEBUG_ENTRIES` の要素を同じ commit で動かします。
issue #176 の作者試遊で使った Stage 3 直行の導線（`debug-stage`）は、PR #186 の merge 前に外しました。

## 4. 作者に頼む評価

作者は1〜2遠征だけ遊び、自由記述で残します。**自動ゲートの PASS は代わりになりません。**
いま見てほしい項目は、作者が現行 Campaign を1〜2遠征遊んだ結果です。

公開後は build 印・URL・検査結果・未確認事項を PR に残します。

## 5. プレイ記録（D1）の取り出し

読み取り専用の GitHub Actions workflow から取ります。プレイデータは変更しません。

1. Actions で **Export D1 playtests** を開く。
2. limit を選ぶ（通常は 3 か 5）。
4. Run workflow を押し、完了したジョブの artifact をダウンロードする。

見る項目: `game_version`（画面とルールの版）、`buildStamp`（公開物の build 印）、
`outcome`（到達・勝敗・終了 HP）、`build`（仲間・隊列・技能・装備）、`events`（遠征内の
選択・戦闘・報酬・精算）、`answers`（終了アンケート）、`moments`（感情マーカー）。

- 終了時刻のあるランだけが export 対象です。
- 版と build を先に絞ってから内容を読み、過去版の記録を混ぜません。
- migration を変えたら、取得 SQL と schema の対応を確認します。
- トークンや D1 の内容をリポジトリへ保存しません。
