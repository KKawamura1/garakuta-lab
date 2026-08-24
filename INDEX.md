# ガラクタ・ラボ リポジトリ・インデックス

このリポジトリは、ゲーム本体、仮説、機械評価、人間／エージェントのプレイ記録、
運用コードを同じ場所で管理する実験場です。**全部読む必要はありません。**
目的に合う入口から入り、詳細データは必要になった実験だけ開いてください。

## まず現在地

- 最終目的：作者自身が、中身を知った後も繰り返し遊びたいゲームを作る
- 現在の既定画面：**SKIP 0.4「連勝機関」**
- 現在の中核ルール：**laws-0.5**、ランへ出す法則の組は12組
- 支持されたもの：配置順が結果を変えること、strikeという出来事、終了時の答え合わせへの反応
- 反証・休止したもの：連勝記録を永続得点にする、COST/SQUEEZEの暴走、IDENTの法則当て
- 未決着：strikeの何が効いたか、答え合わせが継続を作るか、T2、法則同士の噛み合わせ、
  1巡上限と倍率の衝突

最新の作業状態は [.claude/RESUME.md](./.claude/RESUME.md) を正とします。
版の説明は [core/rules-version.mjs](./core/rules-version.mjs)、
人間テストの判定は該当する `analysis/*.md` を正とします。

## 最小の読書順

### 企画と現状を理解する（推奨）

1. [README.md](./README.md) — 現在地と遊べる版
2. [AGENTS.md](./AGENTS.md) — 作業判断と検証上の禁止事項
3. [DESIGN_CHARTER.md](./DESIGN_CHARTER.md) — 最終目的と欲しい面白さ
4. [docs/SOL_TERRA_WORKFLOW.md](./docs/SOL_TERRA_WORKFLOW.md) — Sol/Terra/作者の分業と実験サイクル
5. [analysis/EXPERIMENT_HISTORY.md](./analysis/EXPERIMENT_HISTORY.md) — OBSから直近までの時系列
6. [.claude/RESUME.md](./.claude/RESUME.md) — 未決着・直近の観測・次の作業

### 現在のゲーム実装を追う

1. [core/rules-version.mjs](./core/rules-version.mjs)
2. [core/laws.mjs](./core/laws.mjs)
3. [core/law-table.mjs](./core/law-table.mjs)
4. [core/run.mjs](./core/run.mjs)
5. [play/app.js](./play/app.js)
6. 関係する `analysis/smoke-*.mjs`

### 新しい実験を設計する

1. [DESIGN_CHARTER.md](./DESIGN_CHARTER.md)
2. [DESIGN_LEARNINGS.md](./DESIGN_LEARNINGS.md) の関係節
3. [agents/HYPOTHESIS_TESTING.md](./agents/HYPOTHESIS_TESTING.md)
4. 直近の類似実験の `analysis/*.md`
5. 実装前に「問い・変更・維持・成功信号・失敗信号・複雑性コスト」を登録

## ディレクトリ地図

| 場所 | 役割 |
|---|---|
| `core/` | UIから分離したルール、状態機械、決定的乱数、シミュレーション、指標 |
| `play/` | 現在の本編UI。laws / skip / cost / squeeze / ident / 旧版を切替 |
| `puzzle/` | 法則を読んで並びを作る短い「破れ」 |
| `material/` | MAT 0.3。来た素材を複数用途へ割り当てる比較試作 |
| `cycle/` | 周期・循環系の旧比較試作 |
| `agent-view/` | 人間とエージェントへ同じ観測・操作空間を出す画面 |
| `agents/` | エージェント実験のプロトコル、方策、実行コード |
| `analysis/` | 事前登録、関門、調律、プレイ判定、反証、回帰検査 |
| `research/` | ランダム性・構築ゲームの先行調査 |
| `functions/`, `migrations/` | Pages FunctionからD1へプレイログを保存 |
| `docs/` | 公開、ログ取得、export、日常運用 |
| `.github/workflows/` | D1ログexportなどのActions |
| ルートの `index.html`, `app.js` | 旧ARC/OBS系トップ。現在の本編入口は `play/` |

## 中核コード

| ファイル | 役割 |
|---|---|
| [core/rules-version.mjs](./core/rules-version.mjs) | 遊ぶ側から見た規則の版と指紋 |
| [core/laws.mjs](./core/laws.mjs) | 法則、法則の適用、laws系ルールセット生成 |
| [core/law-table.mjs](./core/law-table.mjs) | 調律器が生成した、ランへ出す12組と敵数値。手編集しない |
| [core/trial.mjs](./core/trial.mjs) | 一要因だけ変える対照実験 |
| [core/run.mjs](./core/run.mjs) | 報酬、配置、戦闘、終了までの状態機械 |
| [core/relay.mjs](./core/relay.mjs) | 周期・位相・部品などlaws系の土台 |
| [core/metrics.mjs](./core/metrics.mjs) | ランの指標と要約 |
| [core/render.mjs](./core/render.mjs) | 人間／エージェント向けの観測文字列 |
| [core/best-possible.mjs](./core/best-possible.mjs) | 手持ちから理論上の最良値を計算 |
| [core/rng.mjs](./core/rng.mjs) | シードから再現できる乱数 |


## UIと比較版

| 入口 | 位置づけ |
|---|---|
| `/play/` | SKIP 0.4。現在の既定画面 |
| `/play/?ruleset=laws` | strikeを足していない素の法則機関 |
| `/play/?ruleset=relay` | 初見で最高再プレイ評価5が出た比較基準 |
| `/play/?ruleset=phase` | 周期と位相の前段 |
| `/material/` | 多用途素材の別構造 |
| `/puzzle/` | 問題を1問ずつ解く短い試作 |
| `/control/?seed=7` | EXP-03「操機 / CONTROL 0.1」。戦闘中の部品選択を主動詞にする独立試作 |
| `/agent-view/` | エージェントと同条件で見るデバッグ画面 |

COST、SQUEEZE、IDENTは画面内に残っていますが休止中です。
削除せず、比較点・反証記録として保持しています。

## 実験履歴と判定

最初は [analysis/EXPERIMENT_HISTORY.md](./analysis/EXPERIMENT_HISTORY.md) だけ読めば十分です。
判断根拠が必要になったら、次を開きます。

| ファイル | 主題 |
|---|---|
| [analysis/ROUND7_RELAY.md](./analysis/ROUND7_RELAY.md) | RELAYの生成・評価構造 |
| [analysis/ROUND8_RELAY_HUMAN.md](./analysis/ROUND8_RELAY_HUMAN.md) | RELAYの人間テスト |
| [analysis/ROUND10_CEILING.md](./analysis/ROUND10_CEILING.md) | 等級と天井 |
| [analysis/ROUND11_LAWS.md](./analysis/ROUND11_LAWS.md) | 法則機関の生成 |
| [analysis/ROUND14_T3.md](./analysis/ROUND14_T3.md) | 並び順が効くことの対照実験 |
| [analysis/ROUND15_COST.md](./analysis/ROUND15_COST.md) | COST/SQUEEZEの反証 |
| [analysis/SKIP_0_3.md](./analysis/SKIP_0_3.md) | strikeと連勝記録を分けた判定 |
| [analysis/PREDICTIONS_2026-08-23.md](./analysis/PREDICTIONS_2026-08-23.md) | 遊ぶ前の予測と、その後の採点 |
| [analysis/BUGS_2026-08-23.md](./analysis/BUGS_2026-08-23.md) | 不可能敵、周期表示など直近の欠陥 |
| [analysis/EMOTIONAL_ARC_HYPOTHESIS.md](./analysis/EMOTIONAL_ARC_HYPOTHESIS.md) | 感情の落差・期待・発見の仮説 |
| [analysis/AGENT_PROXY_PILOT.md](./analysis/AGENT_PROXY_PILOT.md) | エージェントを面白さ採点へ使う限界 |

`analysis/agent-runs/`、JSON、画像は付属データです。Markdownの判定を読んでから、
必要な標本だけ開いてください。

## エージェントの位置づけ

[agents/PROTOCOL.md](./agents/PROTOCOL.md) と
[agents/HYPOTHESIS_TESTING.md](./agents/HYPOTHESIS_TESTING.md) が入口です。

エージェントは、勝敗、決着点、死に時間、因果説明、UI理解、操作差の確認には使えます。
人間の5段階面白さや再プレイ欲は過大評価したため、作者の代替採点者にはしません。
人間の時間は「どちらが面白かったか・なぜか」のような結果変数へ集中させます。

## 運用

| ファイル | 役割 |
|---|---|
| [docs/SOL_TERRA_WORKFLOW.md](./docs/SOL_TERRA_WORKFLOW.md) | Sol/Terra/作者の分業、実験票、結果パケット |
| [docs/OPERATIONS.md](./docs/OPERATIONS.md) | 公開、検査、再開、調律の手順 |
| [docs/EXPORT.md](./docs/EXPORT.md) | D1ログのexport |
| [docs/D1_LOG_ACCESS.md](./docs/D1_LOG_ACCESS.md) | D1ログの読み方 |
| [functions/api/runs.js](./functions/api/runs.js) | プレイpayloadの検証とD1 upsert |
| [migrations/0001_playtest_observations.sql](./migrations/0001_playtest_observations.sql) | runs / momentsスキーマ |

公開前は個別のsmokeを手で眺めるのではなく、終了コードを返す一括検査を使います。

```bash
./analysis/check-all.sh
node analysis/stamp.mjs
```

ルールの数値を変える前に登録文と参照版を確認します。結果を見てから閾値を動かさず、
測り方を直した場合は理由と元の観測を残します。

## 文書の優先順位

食い違いがあるときは、次の順で判断します。

1. 作者の直近の明示的な指示
2. [DESIGN_CHARTER.md](./DESIGN_CHARTER.md) と [AGENTS.md](./AGENTS.md)
3. `core/rules-version.mjs` と実装・生成表
4. 該当実験の事前登録と判定文書
5. [.claude/RESUME.md](./.claude/RESUME.md)
6. README / このINDEX / 古いretrospective

READMEやINDEXに固定した組数・版・「本命」を書いた場合は、ルール更新時に一緒に直します。
