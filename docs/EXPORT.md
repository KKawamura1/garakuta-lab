# プレイ記録の取り出し方（Claude 側の手順）

初回設定は [`D1_LOG_ACCESS.md`](./D1_LOG_ACCESS.md) にある。こちらは**毎回の取り出し**の手順で、
**作者が GitHub の画面を開く必要はない。**

## 結論：D1 は直接見られない。ただし取り出しは Claude 側から起動できる

| | 可否 | 理由 |
|---|---|---|
| D1 を直接 SQL で読む | **不可** | この実行環境に Cloudflare の資格情報が無い（Secrets は GitHub 側にしか無い） |
| 公開先の API を叩く | **不可** | 外向き通信が代理サーバで遮断されている（`garakuta-lab.pages.dev` は EGRESS_BLOCKED） |
| **エクスポートを起動する** | **可** | ワークフローが `workflow_dispatch` なので GitHub MCP から投げられる |
| **結果を読む** | **可** | `echo_to_log: true` にすればジョブのログに本文が出る |

**資格情報をこの環境へ持ち込むことはしない。** リポジトリもログも公開なので、
Secrets は GitHub に置いたまま、実行だけをリポジトリ側にやらせるのが正しい形である。

## 手順

### 1. 起動する

```
mcp__github__actions_run_trigger
  method: run_workflow
  owner: KKawamura1
  repo: garakuta-lab
  workflow_id: export-playtests.yml
  ref: main
  inputs: { "limit": "5", "echo_to_log": "true" }
```

- `limit` は取り出す最新ラン数（`3` / `5` / `10` / `20`）。
- **`echo_to_log` を `true` にしないと本文がログに出ない。** 既定は `false`。
  ログは公開されるので、アンケートの自由記述がそのまま公開される（作者は了承済み）。

### 2. 終わるのを待つ（30〜60秒）

```
mcp__github__actions_list  method: list_workflow_runs, resource_id: export-playtests.yml, per_page: 2
```

先頭の run の `conclusion` が `success` になるまで待つ。

### 3. ジョブ ID を取り、ログを読む

```
mcp__github__actions_list  method: list_workflow_jobs, resource_id: <run_id>
mcp__github__get_job_logs  job_id: <job_id>, return_content: true, tail_lines: 160
```

**本文が大きいとそのままでは返らず、ファイルに保存される**（返り値がその場所を教える）。
1行が非常に長いので `Read` の行指定は効かない。Bash で切り出す。

```bash
python3 - <<'PY'
import json
p = "<保存されたファイルのパス>"
s = open(p, encoding="utf-8").read()
log = json.loads(s)["logs_content"] if s.lstrip().startswith("{") else s
runs, moments = [], []
for line in log.split("\n"):
    body = line.split("Z ", 1)[-1].strip()
    if body.startswith('{"run_id"'):
        o = json.loads(body)
        (runs if "schema_version" in o else moments).append(o)
json.dump(runs, open("runs.json", "w"), ensure_ascii=False)
json.dump(moments, open("moments.json", "w"), ensure_ascii=False)
print(len(runs), "ラン /", len(moments), "マーカー")
PY
```

### 4. 記録として取り込む

```bash
node analysis/import-export.mjs <runs.json> --head=play
```

`analysis/human-runs/human-<ruleset>-seed<n>.json` ができる。以後：

```bash
node analysis/human-panel.mjs --ruleset=relay        # ランを横に並べる
node analysis/arrangement-space.mjs --ruleset=relay  # 勝てる並びの割合を数える
```

## つまずきどころ（全部一度は踏んだ）

- **`tail_lines` を大きくすると返り値の上限を超える。** 超えたらファイルに落ちるので上の切り出しを使う。
- **感情マーカーはログの前半に出る。** `tail_lines` が小さいと前半のマーカーが切れる。
  マーカー数が `moment_count` と合わなければ、もっと遡る。
- **`ended_at` が無いランはエクスポートに出ない**（`WHERE ended_at IS NOT NULL`）。
  古い版で終えたセッションで起きた。いまは送信時に補完される。
- **`game_version` が `unknown-...` なら、ルールセットを版表に足し忘れている**
  （`agent-view/sync.js` の `RULESET_VERSION`）。`analysis/smoke-sync.mjs` が検査している。
- **進行中のランは出てこない。** 終了してアンケートを送った時点で D1 に入る。

## 遊ぶ側から直接取り出す道（最後の砦）

画面が壊れて送信もできないときのために、**「遊び方」の中に「生の記録を出す」**がある。
セッション（行動列と感情マーカーを含む）をそのまま写せるので、貼ってもらえば読める。
再読み込みでランが壊れて記録を失いかけた事故（2026-08-22）を受けて追加した。
