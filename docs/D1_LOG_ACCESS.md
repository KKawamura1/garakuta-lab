# D1プレイログ取得

更新日: 2026-08-31（UTC）

現在のプレイ記録は functions/api/runs.js から D1 の PLAYTEST_DB へ保存されます。取得は読み取り専用の GitHub Actions workflow から行い、プレイデータを変更しません。

## 手順

1. GitHub の Actions で Export D1 playtests を開く。
2. limit を選ぶ。通常は 3。
3. 自由記述を公開ログへ出す必要がなければ、echo_to_log は false のままにする。
4. Run workflow を押す。
5. 完了したジョブの artifact をダウンロードする。

SQL、認証、Cloudflare Account の設定は workflow 内の既存手順に従います。トークンや D1 の内容をリポジトリへ保存しません。

## 取得時の注意

- 終了時刻のあるランだけが export 対象です。
- game_version と buildStamp で、現行の灰の遠征と別版を分けます。
- 自由記述を Actions のログへ出す場合、ログを読める範囲が広がることを明示します。
- migration を変更したら、取得 SQL と schema の対応を確認します。
