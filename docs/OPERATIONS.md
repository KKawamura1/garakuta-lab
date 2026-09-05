# 運用 — 検査・公開・プレイ記録

## 1. 変更の流れ

1. AGENTS.md と、変更対象の実装・テストを読む。必要なら `docs/` の該当節。
2. 検査を走らせる。
3. 公開物を変えたら `node analysis/stamp.mjs` で build 印を更新し、生成された
   `core/build.mjs` も commit する。
4. GitHub Actions の通常 Checks が成功してから、必要なら公開先 E2E を実行する。
5. 検査結果と未確認事項を PR に残す。やり残しは GitHub Issues へ。


## 2. 検査の中身

`bash analysis/check-all.sh` は、`ecology/` の構文検査 → `node ecology/check.mjs`
（`ecology/*.test.mjs`）→ smoke 8本を順に走らせます。

| smoke | 見るもの |
|---|---|
| `ecology-anti-stall-audit.mjs` | 回復・反応の停止性監査 |
| `ecology-contract-smoke.mjs` | content 契約と凍結 ID の照合 |
| `ecology-equipment-gen-smoke.mjs` | 装備の手続き生成の決定性と完結性 |
| `ecology-readout-smoke.mjs` | 表示値と content の照合 |
| `ecology-skill-catalog-smoke.mjs` | 技能の定義・パック・ツリーの節・説明文の四点照合と、前提の到達可能性 |
| `ecology-screens-smoke.mjs` | 画面と主要操作の接続 |
| `ecology-test-hygiene-smoke.mjs` | 明らかな恒真 assert の検出 |
| `ecology-upload-smoke.mjs` | D1 payload と受け側の整合 |

画面の通し（Playwright / Chromium）は二本あります。`check-all.sh` には入っていないので、
画面に触れたときは手で走らせます。

    node analysis/ecology-tutorial-trial.mjs   # 本編の入口（会話・灰の門・巻き戻し・予測・装備・根城・図鑑）
    node analysis/ecology-trial.mjs            # 12戦の長い流れと精算・投資

公開先に対しては GitHub Actions の「Ecology trial (deployed)」から同じ台本を走らせます。

## 3. 作者へ URL を渡す前に

自動検査は面白さを判定しません。渡してよいのは、**未確認の経路が残っていないとき**だけです。

- 変更が schema / content / UI / 保存形式のどこへ影響するか確認した。
- `node ecology/check.mjs` と `bash analysis/check-all.sh` が成功する。
- 変更した表示や payload に、旧入口・旧版の表示が残っていない。
- 公開先で: `/ecology/` が開く、Campaign Stage を選べる、隊列・技能・装備を設定できる、
  次の敵の狙いと戦闘条件を開始前に読める、自動戦闘が決着してリプレイとイベントログを
  確認できる、戦闘中の再読み込みから復旧できる、終了アンケートと D1 送信の成功・失敗を
  区別できる。
- 画面に出る content contract と build 印が、公開先の `core/build.mjs` と一致する。
- 古い service worker や旧入口へ誘導されない。

**失敗した経路があるときは URL を渡さず、失敗した経路を記録します。**

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

