# D1プレイログ取得

GitHub Actionsの固定ワークフローから、`garakuta-playtests`の最新の完了ランを読み取り専用で取得する。
一度設定すれば、取得のたびにコードを変更する必要はない。

## ChatGPT（OpenAI）/GitHub連携からの現行取得手順（2026-08-25追記）

このセクションは、現在のChatGPT（OpenAI）からこのリポジトリを扱う場合の手順である。下にあるClaude向けの記述は削除せず、歴史的な手順として残す。ただし、GitHub連携で利用できる操作名や起動経路は異なる。

### 通常経路

1. `.github/workflows/export-playtests.yml` の **Export D1 playtests** を対象にする。
2. `workflow_dispatch` が利用できる場合は、`main` に対して起動する。
3. 入力は通常 `limit=10`（最新10ラン）と `echo_to_log=true`（ジョブログにも出力）を使う。選択できる `limit` は `3 / 5 / 10 / 20`。
4. 完了を待ち、成功したジョブのログまたは `d1-playtests-<run_number>` アーティファクトを読む。

`echo_to_log=true` は、アーティファクトを取得できない環境でも本文を読めるようにするための設定である。自由記述アンケートも公開ジョブログに含まれるため、必要な場合だけ使う。

### workflow起動操作が連携に現れない場合

ワークフロー自体には `workflow_dispatch` があるが、ChatGPTのGitHub連携に起動操作が公開されないことがある。その場合は、既存の成功済みexportジョブを再実行して現在のD1を読み直す。

1. `github_fetch_workflow_run_jobs` で、既知のexport実行のジョブを確認する。
2. `Export latest playtests` が `completed / success` であることを確認する。
3. `github_rerun_workflow_job` でそのジョブを再実行する。
4. `github_fetch_workflow_run_jobs` を数回呼び、`completed / success` になるまで待つ。
5. `github_fetch_workflow_job_logs` でログを取得する。必要なら `github_fetch_workflow_run_artifacts` でアーティファクトを確認する。

再実行は元のworkflow runの入力を引き継ぐ。したがって、元のrunが `limit=3` や `echo_to_log=false` なら、その設定を前提に結果を解釈する。十分な件数を出したい場合は、`limit` が10以上で、ログを読む場合は `echo_to_log=true` のrunを再実行する。

2026-08-25には、run `32678395057` の成功済みジョブを再実行し、job `97690189718` のログから最新のGRAFT 3ランを確認できた。この経路はD1の読み取り専用exportであり、プレイデータを書き換えない。

### GRAFTの確認条件

- GRAFTの`gameVersion`は `graft-0.1-graft`。
- スキーマバージョンは4。
- `runs` のexportは `ended_at IS NOT NULL` の完了ランだけが対象。
- GRAFTでは終了アンケート保存時に`endedAt`が設定されるため、最後まで遊んだ後にアンケートを保存する。
- `events_json`に行動・接ぎ木・感情マーカー・アンケート送信・終了イベントが入り、`moments-readable.json`に感情マーカーが出る。
- 公開APIは送信用で、D1の読み取りには使わない。読み取りはこのexport経路を使う。

## 初回設定

### 1. Cloudflare APIトークン

Cloudflare Dashboardの **Manage Account → Account API Tokens → Create Token** からカスタムトークンを作成する。

- Permissions: `Account` / `D1` / `Read`
- Account Resources: ガラクタ・ラボを置いているアカウントだけ
- 有効期限: 必要に応じて設定

表示されたトークンは再表示できないため、その場でGitHub Secretへ登録する。

### 2. GitHub Secrets

リポジトリ `KKawamura1/garakuta-lab` の **Settings → Secrets and variables → Actions → New repository secret** で次の2件を登録する。

| 名前 | 値 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 上で作成した読み取り専用トークン |
| `CLOUDFLARE_ACCOUNT_ID` | CloudflareのAccount ID |

トークンやAccount IDをチャット、Issue、Actions入力欄、リポジトリ内のファイルへ貼らない。

## 毎回の取得

**Claude 側から起動できる。** 作者が Actions の画面を開く必要はない。
手順は [`EXPORT.md`](./EXPORT.md) にある。以下は人が手で取る場合の手順。


1. GitHubで **Actions → Export D1 playtests** を開く。
2. **Run workflow** を押す。
3. 取得する最新ラン数（3 / 5 / 10 / 20）を選ぶ。
4. 完了したrunを開き、下部のArtifactsから `d1-playtests-…` をダウンロードする。

実行時の入力は2つある。

| 入力 | 意味 |
|---|---|
| `limit` | 取得する最新ラン数 |
| `echo_to_log` | `true` にすると、同じ内容をジョブログにも書き出す |

`echo_to_log` は、アーティファクト（Blobストレージ）へ到達できない環境から中身を読むための逃げ道である。
**このリポジトリは公開なので、ジョブログも公開される。** 書き出されるのは`runs_sql`が選択した列だけで、
`device_id`とトークンは含まれないが、アンケートの自由記述はそのまま出る。既定は`false`。

ActionsのSummaryにはラン一覧が表示される。成果物には次のJSONが入る。

- `runs-readable.json`: 構成、回答、統計、全イベントを含むラン本体
- `moments-readable.json`: プレイ中の感情マーカー
- `runs.json`, `moments.json`: Wranglerのメタデータを含む生出力

`device_id`と`client_json`は出力しない。ワークフローの権限は`contents: read`、Cloudflareトークンは`D1 Read`だけに制限する。
