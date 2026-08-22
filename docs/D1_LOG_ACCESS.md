# D1プレイログ取得

GitHub Actionsの固定ワークフローから、`garakuta-playtests`の最新の完了ランを読み取り専用で取得する。
一度設定すれば、取得のたびにコードを変更する必要はない。

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
