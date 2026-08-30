# リポジトリ地図

更新日: 2026-08-29（UTC）
対象: main 3c0790c80d74ef0361dda06f21f806b5dbf6f3e0

この文書は、増えた資料を迷わず読めるようにする案内図です。現在の判断は「正史」、実験票・ログ・コードは「根拠」、古い要約と運用メモは「履歴」として分けます。

## 1. まず読む場所

| 目的 | 最初に読むもの | 次に必要なもの |
|---|---|---|
| 新しい作業を始める | AGENTS.md | PROJECT_MEMORY.md → analysis/CURRENT.md |
| 全体の現在地を確認する | analysis/CURRENT.md | analysis/EXPERIMENT_LEDGER.md |
| 過去の仮説検証を追う | analysis/EXPERIMENT_LEDGER.md | 個別の実験票・作者ログ・機械検査 |
| 新しい実験を設計する | DESIGN_CHARTER.md | docs/AGENT_ONBOARDING.md → 類似実験の票 |
| 現在の本編を直す | core/rules-version.mjs | core/ → play/ → 関係するsmoke |
| SCRAPLINEを扱う | analysis/SCRAPLINE_AGENT_RUNBOOK.md | concept → implementation → D1結果 |
| EXP-18を扱う | analysis/experiments/exp-18/R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS.md | R4 → R5 → A5_RULE_ENGINE/ → PR #49、コードは ecology/ |
| 公開やログ取得を行う | docs/HUMAN_TEST_RELEASE.md | docs/OPERATIONS.md / EXPORT.md |

全ファイルを読む必要はありません。先に現在地を固定し、必要な系列だけを深掘りしてください。

## 2. 現在のスナップショット

- 最終目的は、作者自身が中身を知った後もiPhoneで繰り返し遊びたいゲームを作ることです。
- 現在の既定入口は /play/ の SKIP 0.4 / laws-0.5 です。これは比較基準であり、面白さの勝者として確定していません。
- 最新の独立試作は /scrapline/ の SCRAPLINE 0.7 / scrapline-build-20260829-r12 です。
- SCRAPLINEは、機械検査と保存完全性は確認できましたが、作者プレイではfun 1〜2/5、因果の説明は成立せず、不採択です。
- EXP-18 R5の実装と監査修正はmainにあります。PR #49は8人・24技能・18装備・7区画を一周できるdraft試作、R6は長期進行・手続き生成装備・Blueprintの実装委譲票です。PR #49は人間評価前で、R6は設計段階です。

## 3. 判断の優先順位

資料が食い違うときは、次の順で判断します。

1. 作者の最新の明示的な指示・感想
2. AGENTS.md と DESIGN_CHARTER.md
3. PROJECT_MEMORY.md と analysis/CURRENT.md
4. analysis/EXPERIMENT_LEDGER.md
5. 該当する実験票、作者の生ログ、D1 export、実装
6. 研究メモ、README、古い時系列要約、古いrunbook

「古い」は「無価値」ではありません。過去の判断を再現するときは当時の票とログを優先し、現在のキューへ自動的に持ち上げません。

## 4. ディレクトリ地図

| 場所 | 役割 | 現在の扱い |
|---|---|---|
| core/ | 本編のルール、状態機械、乱数、指標 | 現行コード |
| ecology/ | EXP-18のデータ駆動・決定的ルールエンジンと遊べる版 | 実装済み。`node ecology/check.mjs` で検査。詳細は ecology/README.md |
| ecology/content/ | 遊べる版の定義を種類別に分けた置き場（R7 Milestone 0） | 技能・敵・装備はここを触る。`playable-content.mjs` は adapter で、足す場所ではない |
| play/ | 本編の既定UIと比較ルールセット | 現行の比較基準 |
| scrapline/ | SCRAPLINE 0.7の独立試作 | 最新試作。ただし不採択 |
| kindling/、emberline/、tomori/、night-eater/ | 縦切り試作 | 作者テスト結果を反映して凍結・比較保存 |
| graft/、echo/、haul/、material/、puzzle/、control/、cycle/ | 過去の仮説を分けて試した比較試作 | 削除せず個別判定とともに保存 |
| agent-view/ | 本編と同じ観測条件を出す画面 | 診断・比較用 |
| analysis/experiments/ | Solの実験依頼RとTerraの回答A | 実験の一次記録 |
| analysis/ 直下 | 旧ラウンド、独立試作票、smoke、調律、結果要約 | 既存の履歴・検査資産 |
| analysis/human-runs/ | 作者・人間の再現可能なプレイ記録 | 一次証拠 |
| analysis/agent-runs/ | エージェント代理プレイの出力 | 補助証拠。作者のfun代替にはしない |
| research/ | 先行事例と一般化した設計知見 | 参考資料。創発的ルール生態系の一般メモを含む |
| docs/ | 作業導線、公開、D1/export、運用 | 手順書 |
| .github/workflows/ | 検査とD1 export | 自動化 |
| .claude/ | Claude Codeの再開・停止運用 | 歴史的運用資料。現在の設計キューではない |
| ルートのindex.html / app.js | 初期のARC/OBS系ランディングと旧本編 | 互換・履歴として保存 |

mainのツリーは現在393ファイル、うちMarkdown 135ファイル、analysis/配下241ファイルです。ファイル数やコミット数を、独立したゲーム仮説の数として数えません。

## 5. 遊べる入口の扱い

| 入口 | 位置づけ | 判定 |
|---|---|---|
| /play/ | SKIP 0.4。現在の既定・比較基準 | 継続利用。ただし勝者ではない |
| /play/?ruleset=laws | SKIPなしのlaws基準 | 比較用 |
| /play/?ruleset=relay / phase | 初期の順序・位相比較 | 比較用 |
| /scrapline/ | 7区画の車列・因果ショー | 最新結果は不採択。次の修正前に実験票が必要 |
| /kindling/、/emberline/、/tomori/、/night-eater/ | 物語・育成・構築の縦切り | 結果を保存した凍結比較版 |
| /graft/、/echo/、/haul/、/material/、/puzzle/、/control/、/cycle/ | 独立・旧比較試作 | 歴史・比較用 |
| /、/agent-view/ | ラボ入口・診断画面 | 本編の判定入口ではない |

各試作のREADMEは遊び方と実装境界、analysis/の票は仮説と判定、D1結果票は実際の作者観測を示します。

## 6. 実験資料の分類

- 正史: PROJECT_MEMORY、CURRENT、EXPERIMENT_LEDGER。現在の判断だけを置き、詳細を複製しません。
- 実験票: analysis/experiments/exp-XX/。依頼、変更、不変条件、受入条件、回答を保存します。
- 独立試作票: analysis/*_0_1.md とSCRAPLINE関連票。各試作の問いと結果を記録します。
- 一次証拠: analysis/human-runs/、D1 exportから転記した結果票、機械検査のJSON。
- 検査インフラ: analysis/smoke-*.mjs、gate、tune、import/export、Actions。
- 研究: research/。実験結果ではなく、次の仮説を考える材料です。
- 履歴: analysis/ROUND*.md、analysis/EXPERIMENT_HISTORY.md、.claude/RESUME.md、旧PR。現在の判断へ直接引用するときは日付と条件を付けます。

## 7. 更新ルール

1. 新しい仮説は、実装前に一つの実験票へ登録します。主ループ、変更・維持、作者が見る差分、成功/停止条件、機械検査、公開境界を書きます。
2. 検査が通ったこと、完走したこと、エージェントのスコアが高いことを、作者のfun/replayの合格と書きません。
3. 作者の自由記述、行動列、感情マーカー、D1の完了状態は、要約より優先します。既存の原文は削除しません。
4. 実験後はCURRENTとLEDGERに短い結果を追加し、詳細は個別票・ログへ残します。
5. 版、build、schema、seed、対象commitを結果に残します。結果の後で閾値や分母を変更しません。
6. 失敗作・成功作・未成立の検証・未マージPRは、削除や「現行」との混同を避ける案内を付けて保存します。
7. 既存文書を短縮するときは、一次証拠へのリンクを残し、原文を別名で上書きしません。

この地図自体は、ファイルの内容の代わりではありません。現在の判断が変わったら、まずこの地図とCURRENTを同期し、詳細資料はそのまま残します。
