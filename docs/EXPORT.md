# プレイ記録の取り出し方（Claude 側の完全手順）

**この文書は、文脈が失われた状態から読んでも実行できるように書く。**
過去に一度、取り出し方が分からなくなって二度と使えなくなったことがある。
「分かっている人向けの要約」を書かない。**そのまま打てるものを書く。**

初回設定（Cloudflare トークンの作り方）は [`D1_LOG_ACCESS.md`](./D1_LOG_ACCESS.md)。
こちらは**毎回の取り出し**で、**作者が GitHub の画面を開く必要はない。**

---

## 0. 全体像

プレイ記録は Cloudflare D1（データベース `garakuta-playtests`）にある。
そこへ直接は届かないので、**GitHub Actions に読ませて、その出力を読む。**

```
Claude ──(1) ワークフローを起動──> GitHub Actions ──> Cloudflare D1
                                        │
Claude <──(2) ジョブのログを読む───────┘
```

| やりたいこと | 可否 | 理由 |
|---|---|---|
| D1 を直接 SQL で読む | **不可** | この実行環境に Cloudflare の資格情報が無い |
| 公開先の API を叩く | **不可** | 外向き通信が代理サーバで遮断（`garakuta-lab.pages.dev` は EGRESS_BLOCKED） |
| **ワークフローを起動する** | **可** | `.github/workflows/export-playtests.yml` が `workflow_dispatch` |
| **ジョブのログを読む** | **可** | `echo_to_log: true` のとき本文がログに出る |

**資格情報をこの実行環境へ持ち込まないこと。** リポジトリもジョブログも公開である。
Secrets は GitHub 側に置いたまま、実行だけをリポジトリにやらせるのが正しい形。

---

## 1. ワークフローを起動する

必要なら先に `ToolSearch` で `select:mcp__github__actions_run_trigger` を読み込む。

```
mcp__github__actions_run_trigger
  method: run_workflow
  owner: KKawamura1
  repo: garakuta-lab
  workflow_id: export-playtests.yml
  ref: main
  inputs: { "limit": "10", "echo_to_log": "true" }
```

成功すると `{"message":"Workflow run has been queued","status_code":204}` が返る。
**204 は「受け付けた」であって「終わった」ではない。**

| 入力 | 値 | 意味 |
|---|---|---|
| `limit` | `"3"` / `"5"` / `"10"` / `"20"` | 取り出す**最新ラン数**。文字列で渡す。他の値は拒否される |
| `echo_to_log` | `"true"` / `"false"` | **`"true"` にしないと本文がログに出ない。** 既定は `"false"` |

`echo_to_log: "true"` にすると、アンケートの自由記述が**公開ログに載る**（作者は了承済み）。

---

## 2. 終わるのを待つ（30〜60秒）

```
mcp__github__actions_list
  method: list_workflow_runs
  owner: KKawamura1
  repo: garakuta-lab
  resource_id: export-playtests.yml
  per_page: 1
```

**注意：`per_page` は効かない。** 全 run が返るので応答が大きい。それでも先頭が最新である。
`workflow_runs[0].status` が `"completed"` かつ `conclusion` が `"success"` なら次へ。
`workflow_runs[0].id` が **run_id**。

待つときは Bash を `run_in_background: true` で使う。
**`sleep` の直後に別コマンドを繋ぐのは環境が禁止している**（`sleep 60; cat ...` は弾かれる）。

```bash
sleep 60; echo waited     # run_in_background: true で
```

---

## 3. ジョブ ID を取る

```
mcp__github__actions_list
  method: list_workflow_jobs
  owner: KKawamura1
  repo: garakuta-lab
  resource_id: <run_id>
```

`jobs.jobs[0].id` が **job_id**。

---

## 4. ログを読む

```
mcp__github__get_job_logs
  owner: KKawamura1
  repo: garakuta-lab
  job_id: <job_id>
  return_content: true
  tail_lines: 220
```

**ほぼ必ず返り値の上限を超えてファイルに保存される。**
そのときエラーが保存先を教える（`/root/.claude/projects/.../tool-results/....txt`）。
**1行が十数万文字あるので `Read` の行指定は効かない。** Bash で切り出す。

```bash
cd /tmp/claude-0/-home-user-garakuta-lab/<セッションID>/scratchpad && python3 - <<'PY'
import json
p = "<エラーが教えてくれた保存先のパス>"
s = open(p, encoding="utf-8").read()
# 返り値が JSON なら logs_content を取り出す。生ログならそのまま。
log = json.loads(s)["logs_content"] if s.lstrip().startswith("{") else s
runs, moments = [], []
for line in log.split("\n"):
    body = line.split("Z ", 1)[-1].strip()   # 先頭のタイムスタンプを落とす
    if body.startswith('{"run_id"'):
        try:
            o = json.loads(body)
        except Exception:
            continue
        # ラン本体は schema_version を持つ。持たない方が感情マーカー。
        (runs if "schema_version" in o else moments).append(o)
json.dump(runs, open("runs.json", "w"), ensure_ascii=False)
json.dump(moments, open("moments.json", "w"), ensure_ascii=False)
print(len(runs), "ラン /", len(moments), "マーカー")
for r in sorted(runs, key=lambda x: x["started_at"]):
    st = json.loads(r["stats_json"]); an = json.loads(r["answers_json"])
    print(r["started_at"][:16], r["game_version"], "seed", st.get("seed"),
          "勝" if r["won"] else "負", "面白", an.get("fun"), "再", an.get("replay"),
          "マーカー", r["moment_count"])
PY
```

**マーカー数が `moment_count` の合計と合わなければ、遡り足りていない。**
`tail_lines` を増やして取り直す（**マーカーはログの前半に出る**）。

自由記述と感情マーカーを読むには：

```bash
python3 - <<'PY'
import json
for r in json.load(open("runs.json")):
    st = json.loads(r["stats_json"]); an = json.loads(r["answers_json"])
    print("="*70)
    print("seed", st.get("seed"), "| 面白", an.get("fun"), "/ 再", an.get("replay"))
    print("  warnings:", ", ".join(w["code"] for w in st.get("warnings", [])) or "なし")
    print(" ", json.dumps(an, ensure_ascii=False))
ids = {r["run_id"]: json.loads(r["stats_json"]).get("seed") for r in json.load(open("runs.json"))}
for m in json.load(open("moments.json")):
    if m["run_id"] in ids:
        print(f'seed{ids[m["run_id"]]} #{m["event_seq"]} {m["kind"]}: {m.get("note","")}')
PY
```

---

## 5. 記録として取り込む

**作業ディレクトリはリポジトリのルート（`/home/user/garakuta-lab`）で実行すること。**
scratchpad から `node analysis/...` を叩くと MODULE_NOT_FOUND で落ちる。

```bash
node analysis/import-export.mjs <runs.json の絶対パス> --head=play
```

`analysis/human-runs/human-<ruleset>-seed<n>.json` ができる。以後：

```bash
node analysis/human-panel.mjs --ruleset=laws         # ランを横に並べる
node analysis/arrangement-space.mjs --ruleset=laws   # 勝てる並びの割合を数える
```

---

## つまずきどころ（全部一度は踏んだ）

| 症状 | 原因と対処 |
|---|---|
| ログが返らずファイルに落ちる | 正常。上の切り出しスクリプトを使う |
| マーカーが少ない | マーカーはログの**前半**。`tail_lines` を増やす |
| ランが1件も出ない | `ended_at` が NULL のランは除外（`WHERE ended_at IS NOT NULL`）。**進行中のランは出ない** |
| `game_version` が `unknown-...` | ルールセットを版表に足し忘れ（`agent-view/sync.js` の `RULESET_VERSION`）。`analysis/smoke-sync.mjs` が全ルールセットを照合している |
| `import-export.mjs` が MODULE_NOT_FOUND | 作業ディレクトリがリポジトリのルートでない |
| ワークフローが失敗する | 診断ステップに資格情報の `env:` を付け忘れると落ちる。過去にそれでアーティファクトごと消えた |
| 作業が巻き戻っている | コンテナ再起動で作業ディレクトリが古い commit に戻ることがある。`git fetch && git reset --hard origin/<branch>` で復旧。**こまめに push すること** |

---

## 最後の砦：遊ぶ側から直接取り出す

画面が壊れて送信もできないとき用に、**「遊び方」ダイアログの中に「生の記録を出す」**がある。
セッション（`seed` / `variantSpec` / 行動列 / 感情マーカー）をそのまま写せる。
貼ってもらえば `createRun` に流して再生できる。

再読み込みで進行中のランが壊れ、記録を失いかけた事故（2026-08-22）を受けて追加した。
