# ガラクタ・ラボ リポジトリ・インデックス

このリポジトリは、ゲーム本体だけでなく、ゲームデザインの仮説・機械評価・人間／エージェントのプレイテスト・運用記録・デバッグ用画面を同じ場所で管理する実験場です。

このインデックスは、2026-08-23時点の main（確認したコミット: e0a75d7）を基準にしています。

## 全体像

    企画の判断基準
      DESIGN_CHARTER.md / DESIGN_LEARNINGS.md / research/

    ゲームのルール・シミュレーション基盤
      core/

    プレイ可能なUI
      play/       本命 LAWS 0.1、旧 ruleset も切替可能
      index.html  旧トップ版 ARC 0.1
      cycle/      RELAY/循環駆動列系の比較版
      material/   MAT 0.3 多用途素材
      puzzle/     法則を読んで並びを当てる小型テスト
      agent-view/ エージェントと同じ観測・操作空間の画面

    評価・検証
      analysis/   関門、調律、プレイテスト、反証、日々の分析
      agents/     エージェント実験のプロトコルと実行コード

    記録・運用
      functions/  Pages Function → D1保存
      migrations/ D1スキーマ
      docs/       export・運用・ログ取得
      .github/    Actions

## 最初に読むファイル

| ファイル | 何が分かるか |
| --- | --- |
| [README.md](./README.md) | 現在の本命が LAWS 0.1 であること、旧版との関係、公開URL、企画の短い説明。 |
| [CLAUDE.md](./CLAUDE.md) | 作業上の判断規則。仮説とゲームを混同しないこと、PrecisionだけでなくRecallを見ること、参照点を先に関門へかけること、機械化すべきルールなど。 |
| [DESIGN_CHARTER.md](./DESIGN_CHARTER.md) | 企画の目的、欲しい面白さ、ランダム性・再解釈・方針転換・オート戦闘の原則、評価順位。 |
| [DESIGN_LEARNINGS.md](./DESIGN_LEARNINGS.md) | 試作から得た学びと、棄却・反証した仮説の長期ログ。非常に長いので、全体像を掴んだ後に必要な節を読む。 |
| [agents/PROTOCOL.md](./agents/PROTOCOL.md) | エージェントに何を見せ、何を隠し、どのように行動・内省させるかの実験プロトコル。 |
| [docs/OPERATIONS.md](./docs/OPERATIONS.md) | 作業再開、通知、公開、ログ取得、調律機などの運用手順。 |

## ゲーム本体とルール基盤

### core/：ゲームのルールをUIから分離した中核

本命のゲームを、ブラウザUIとは独立して再現・シミュレーション・評価するためのES Modulesです。

| ファイル | 役割 |
| --- | --- |
| [core/project.mjs](./core/project.mjs) | 中核モジュール群の公開入口・プロジェクト定数。 |
| [core/rules-version.mjs](./core/rules-version.mjs) | ルールセット名・版の識別。 |
| [core/arc.mjs](./core/arc.mjs) | ARC 0.1のルールセット。 |
| [core/phase.mjs](./core/phase.mjs) | PHASE 0.1のルールセット。 |
| [core/bus.mjs](./core/bus.mjs) | RELAY／BUS系のルールセット。 |
| [core/laws.mjs](./core/laws.mjs) | LAWS 0.1の法則、部品、問題、生成・適用ロジック。 |
| [core/law-table.mjs](./core/law-table.mjs) | 生成条件を通過した法則の組・記録枠・関門結果のテーブル。 |
| [core/puzzle-table.mjs](./core/puzzle-table.mjs) | 法則を読み、並びを作る問題の定義。 |
| [core/squeeze-table.mjs](./core/squeeze-table.mjs) | 追加の調律・圧縮系ルールの定義。 |
| [core/cost-table.mjs](./core/cost-table.mjs) | 部品や行動のコスト表。 |
| [core/build.mjs](./core/build.mjs) | 部品を枠へ置いた構成の生成・表現。 |
| [core/run.mjs](./core/run.mjs) | ランの状態機械。報酬、配置、戦闘、観測、終了までを統合する。 |
| [core/trial.mjs](./core/trial.mjs) | 問題・試行の実行。 |
| [core/relay.mjs](./core/relay.mjs) | RELAY系の実行ロジック。 |
| [core/metrics.mjs](./core/metrics.mjs) | ランの指標・要約・観測値。 |
| [core/best-possible.mjs](./core/best-possible.mjs) | その問題やランでの理論上の最良値を計算する補助。 |
| [core/rng.mjs](./core/rng.mjs) | 決定的な乱数。 |
| [core/render.mjs](./core/render.mjs) | ルール基盤の観測結果を人間／エージェント向けテキストへ変換。 |

コードを追うときは、まず rules-version.mjs → 使用するルールセット（現在は laws.mjs）→ run.mjs → metrics.mjs / render.mjs の順がよいです。

### play/：現在の本命「法則機関 / LAWS 0.1」

| ファイル | 役割 |
| --- | --- |
| [play/index.html](./play/index.html) | 本命UIの最小HTML。 |
| [play/app.js](./play/app.js) | core/run.mjsをブラウザで操作するUI。配置、戦闘、報酬、法則の表示、感情マーカー、アンケート、送信を担当。 |
| [play/styles.css](./play/styles.css) | 本命UIのスタイル。 |

URLの ?ruleset=relay、?ruleset=phase で旧ルールセットを比較できます。READMEに記載された本命のポイントは、毎ラン2つの法則を引き、法則の組ごとに記録を持ち、事前検証済みの組だけを出すことです。

### 旧トップ版・比較試作

| ディレクトリ／ファイル | 役割 |
| --- | --- |
| [index.html](./index.html) / [app.js](./app.js) / [styles.css](./styles.css) | 旧トップ版 ARC 0.1。PWA、報酬、オート戦闘、予測、感情・イベントログを含む。 |
| [cycle/](./cycle/) | 循環駆動列系の比較試作。順序・位相・生成／消費の関係を調べる。 |
| [material/](./material/) | MAT 0.3「選べる漂着物」。同じ素材を砲塔・外殻・炉の用途へ振り分ける案。material/simulate.mjsは大量シミュレーション。 |
| [puzzle/](./puzzle/) | 本編の法則読解を単独で試す小型プレイ。出題、法則、目標、試行回数、気づきのマーカーを記録する。 |
| [agent-view/](./agent-view/) | エージェントが見ている観測文字列と同じ情報を表示し、人間も同じ操作空間で遊べるデバッグ／比較画面。coreからランを再構築する。 |

### PWA・公開用ルートファイル

| ファイル | 役割 |
| --- | --- |
| [manifest.webmanifest](./manifest.webmanifest) | PWAの名前・アイコン・表示設定。 |
| [sw.js](./sw.js) | Service Worker。静的ファイルのキャッシュとオフライン対応。 |
| [icon-source.svg](./icon-source.svg) | アイコン元データ。 |
| [icons/](./icons/) | PWAアイコン。 |
| [404.html](./404.html) | Pagesの404 fallback。 |
| [_headers](./_headers) | Cloudflare Pagesのレスポンスヘッダー。 |

## エージェント実験

### agents/

| ファイル | 役割 |
| --- | --- |
| [agents/PROTOCOL.md](./agents/PROTOCOL.md) | 実験の目的、観測範囲、プロンプト、評価・秘匿条件、完走・中断・記録の扱い。 |
| [agents/HYPOTHESIS_TESTING.md](./agents/HYPOTHESIS_TESTING.md) | 仮説をPrecision（条件を満たす版を良いと判定）とRecall（満たさない版を悪いと判定）へ分解し、測定を設計する。 |
| [agents/play.mjs](./agents/play.mjs) | 1体のエージェントプレイを実行する。 |
| [agents/batch.mjs](./agents/batch.mjs) | 複数体・複数条件のプレイをまとめて実行する。 |
| [agents/session.mjs](./agents/session.mjs) | 1セッションの観測、行動、状態、記録を管理する。 |
| [agents/policies.mjs](./agents/policies.mjs) | エージェントのプレイ方針。直感型・最適化型などの差を定義する。 |

### agent-view/

エージェントと人間の情報差を減らすための画面です。agent-view/app.jsは core/run.mjs、core/render.mjs、core/metrics.mjs、各ルールセットを直接利用し、URLの ruleset と seed で再現可能なランを開始できます。

## 分析・検証

analysis/は単なる結果置き場ではなく、仮説ごとの登録文、関門、プレイテスト、反証、調律の実験帳です。

### まず読むべき分析文書

| ファイル | 役割 |
| --- | --- |
| [analysis/README.md](./analysis/README.md) | 分析の構成と、どの関門・記録をどう読むか。 |
| [analysis/MORNING_2026-08-23.md](./analysis/MORNING_2026-08-23.md) | 直近の朝時点の状態、現在の問い、未完了作業。 |
| [analysis/PREDICTIONS_2026-08-23.md](./analysis/PREDICTIONS_2026-08-23.md) | 次の実験で何が起きると予測しているか。 |
| [analysis/BUGS_2026-08-23.md](./analysis/BUGS_2026-08-23.md) | 直近の不具合・観測された問題と対応状況。 |
| [analysis/RETROSPECTIVE.md](./analysis/RETROSPECTIVE.md) | ここまでの大きな実験を振り返り、何が分かり、何がまだ分からないかをまとめる。 |
| [analysis/EMOTIONAL_ARC_HYPOTHESIS.md](./analysis/EMOTIONAL_ARC_HYPOTHESIS.md) | 感情の落差・期待・発見・理解・圧倒の仮説。 |
| [analysis/AGENT_PROXY_PILOT.md](./analysis/AGENT_PROXY_PILOT.md) | 人間の感情評価をエージェントで代替できるかを試したパイロットの設計・結果・限界。 |

### 分析スクリプトの系統

| 系統 | 主なファイル | 目的 |
| --- | --- | --- |
| 煙突試験 | analysis/smoke-*.mjs | ルール、UI、ログ、リロード、版、同期などの最低限の整合性を確認。 |
| 関門 | analysis/*gate*.mjs, analysis/space-gate.mjs, analysis/verdict.mjs | 勝ち筋の有無、法則の問題性、構成空間、絶対足切りなどを測る。 |
| 調律 | analysis/tune-*.mjs, analysis/*calibrate*.mjs, analysis/cost-*.mjs | 閾値を動かすのではなく、登録した評価基準に対するルール値を探る。 |
| 問題・法則 | analysis/law-*.mjs, analysis/puzzle-*.mjs, analysis/*laws*.mjs | 法則の組、問題の難度、目標値、法則が「下がるだけ」になっていないかを検査。 |
| プレイテスト | analysis/*human*.mjs, analysis/agent-*.mjs, analysis/agent-runs/ | 人間、合成プレイヤー、エージェントのプレイと比較。 |
| 記録・判断 | analysis/*ROUND*.md, analysis/*_0_1.md, analysis/*_2026-08-23.md | ラウンド単位の仮説・実験・判定・次の一手。 |

### 代表的な分析文書

| ファイル | 役割 |
| --- | --- |
| [analysis/ROUND11_LAWS.md](./analysis/ROUND11_LAWS.md) | LAWS 0.1の登録と、14組が合格するまでの記録。 |
| [analysis/ROUND10_CEILING.md](./analysis/ROUND10_CEILING.md) | 最上位等級を踏破できない天井をどう設計・確認したか。 |
| [analysis/ROUND7_RELAY.md](./analysis/ROUND7_RELAY.md) / [analysis/ROUND8_RELAY_HUMAN.md](./analysis/ROUND8_RELAY_HUMAN.md) | RELAY系の構造・人間テスト。 |
| [analysis/ROUND2_HUMAN_VS_AGENT.md](./analysis/ROUND2_HUMAN_VS_AGENT.md) | 人間とエージェントの評価差。 |
| [analysis/ROUND5_BOREDOM.md](./analysis/ROUND5_BOREDOM.md) / [analysis/BOREDOM.md](./analysis/BOREDOM.md) | 退屈の観測と評価。 |
| [analysis/TRADEOFF.md](./analysis/TRADEOFF.md) / [analysis/COST_0_1.md](./analysis/COST_0_1.md) | 面白さ・公平性・認知コスト・調律のトレードオフ。 |
| [analysis/IDENT_0_1.md](./analysis/IDENT_0_1.md) / [analysis/PUZZLE_0_1.md](./analysis/PUZZLE_0_1.md) | 面白さの同定と問題単体の検証。 |
| [analysis/SKIP_0_1.md](./analysis/SKIP_0_1.md) / [analysis/SKIP_0_3.md](./analysis/SKIP_0_3.md) | 報酬を見送ること・選択肢の扱い。 |
| [analysis/ROUND13_TRIALS.md](./analysis/ROUND13_TRIALS.md) / [analysis/ROUND14_T3.md](./analysis/ROUND14_T3.md) / [analysis/ROUND15_COST.md](./analysis/ROUND15_COST.md) | 直近の問題・法則・コストの試行。 |

JSONや画像・プレイログの大量ファイルは、対応する分析文書の付属データです。個別に読むより、まず同名・近接するMarkdownを読み、必要な実験のJSONだけ開くのが効率的です。

## 調査資料

| ファイル | 役割 |
| --- | --- |
| [research/randomness_as_material_survey.md](./research/randomness_as_material_survey.md) | ランダム性を「判決」ではなく「材料・問題」として扱うための先行研究・失敗例。 |
| [research/game_design_prior_art_research.md](./research/game_design_prior_art_research.md) | カードに見せない構築・配置・相互作用ゲームの先行例。 |

## ログ保存と運用

| ファイル | 役割 |
| --- | --- |
| [functions/api/runs.js](./functions/api/runs.js) | Cloudflare Pages Function。プレイpayloadの検証とD1へのupsert。 |
| [migrations/0001_playtest_observations.sql](./migrations/0001_playtest_observations.sql) | runs と moments のD1スキーマ。 |
| [docs/D1_LOG_ACCESS.md](./docs/D1_LOG_ACCESS.md) | D1からプレイログを読み出す手順。 |
| [docs/EXPORT.md](./docs/EXPORT.md) | ログを安全にexportし、分析へ渡す手順。 |
| [docs/OPERATIONS.md](./docs/OPERATIONS.md) | 日々の運用、再開、公開、記録、調律機。 |
| [.github/workflows/export-playtests.yml](./.github/workflows/export-playtests.yml) | GitHub ActionsからCloudflare D1の読み取り専用exportを実行するworkflow。 |
| [wrangler.jsonc](./wrangler.jsonc) | Pages、D1 binding、migration設定。 |

## 旧版・比較版の位置づけ

- ARC 0.1：最初に面白かったOBSを再試験し、感情・予測・物語を観測する基準版。
- PHASE 0.1：枠の位相を中心にした版。
- RELAY 0.1：部品ごとの周期と順序を中心にした版。
- LAWS 0.1：RELAYの中核に、毎ラン2つの法則と記録・天井を加えた現在の本命。
- MAT 0.3：同じ素材を用途へ割り当てる別構造。
- PUZZLE 0.1：法則読解・問題設計を単体で見る試作。

比較時には、勝率だけでなく「提示された材料に判断が残るか」「法則が変わっても型が固定されないか」「現在の問題を見て並びを改善できるか」「最上位まで進んだ後にも続けたいか」を見ます。

## よくある入口

| 目的 | 読む順 |
| --- | --- |
| 現在の本命を遊ぶ | README → core/laws.mjs → core/law-table.json → play/ |
| ルールを変更する | CLAUDE.md → DESIGN_CHARTER.md → core/rules-version.mjs → 対象ルール → analysisの登録文 → smoke |
| エージェント実験を行う | agents/PROTOCOL.md → agents/HYPOTHESIS_TESTING.md → agents/play.mjs → analysis/agent-* |
| 人間とエージェントを比較する | agent-view/ → core/render.mjs → analysis/ROUND2_HUMAN_VS_AGENT.md |
| 問題・法則を調律する | core/law-table.mjs / core/puzzle-table.mjs → analysis/ROUND10_CEILING.md → analysis/ROUND11_LAWS.md → 該当するtune/gate |
| D1ログを扱う | docs/EXPORT.md → docs/D1_LOG_ACCESS.md → migrations/ → functions/api/runs.js |
| 直近の作業を再開する | .claude/RESUME.md → analysis/MORNING_2026-08-23.md → analysis/PREDICTIONS_2026-08-23.md → CLAUDE.md |

## よく使うコマンド

リポジトリルートから次のように実行します。

    node analysis/smoke-version.mjs
    node analysis/smoke-resume.mjs
    node analysis/smoke-laws.mjs
    node analysis/smoke-gate.mjs

    node analysis/space-gate.mjs
    node analysis/winnable.mjs
    node analysis/law-gate.mjs
    node analysis/tune-laws.mjs

    node agents/play.mjs
    node agents/batch.mjs
    node analysis/agent-panel.mjs

個別の分析スクリプトには、対象ラウンドのMarkdownに記載された引数・シード・比較条件を優先します。閾値を結果に合わせて変更せず、既存の参照点と登録文を先に確認してください。

## 読書順

### 企画を理解する

1. README.md
2. CLAUDE.md
3. DESIGN_CHARTER.md
4. research/ の2資料
5. DESIGN_LEARNINGS.md（必要な節から）
6. analysis/RETROSPECTIVE.md
7. core/laws.mjs と core/law-table.json
8. play/ と agent-view/

### 実装を変更する

1. CLAUDE.md
2. DESIGN_CHARTER.md
3. 変更対象の core/ モジュール
4. 対応する analysis/ の登録文・関門
5. 対応する smoke script
6. UI（play/ または agent-view/）
7. D1／exportが関係する場合は docs/ と functions/

### 現状を把握する

1. .claude/RESUME.md
2. analysis/MORNING_2026-08-23.md
3. analysis/PREDICTIONS_2026-08-23.md
4. analysis/BUGS_2026-08-23.md
5. analysis/RETROSPECTIVE.md
