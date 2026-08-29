# ガラクタ・ラボ

作者自身が、中身を知った後もiPhoneで繰り返し遊びたいゲームを作るための実験場です。
面白さの仮説を小さく実装し、作者が遊び、行動・感情・自由記述を観測して次の仮説へ進みます。

## 現在地

更新対象のmain: 3c0790c80d74ef0361dda06f21f806b5dbf6f3e0

- 既定の比較版: 連勝機関 / SKIP 0.4（/play/）
- 中核ルール: laws-0.5
- 最新の独立試作: ガラクタ列車 / SCRAPLINE 0.7（/scrapline/、build scrapline-build-20260829-r12）
- 最新の作者プレイでは、SCRAPLINEは完走できても因果が理解されず、fun 1〜2/5で不採択でした。
- 現在、main上に進行中の実験票はありません。次の実験は、因果を短く読める形にする問いを登録してから始めます。

現在の結論は PROJECT_MEMORY.md、短縮版は analysis/CURRENT.md、全実験の索引は analysis/EXPERIMENT_LEDGER.md、全体の道案内は docs/REPOSITORY_MAP.md です。

## まず読む順番

1. AGENTS.md
2. PROJECT_MEMORY.md
3. analysis/CURRENT.md
4. analysis/EXPERIMENT_LEDGER.md
5. docs/AGENT_ONBOARDING.md
6. 必要な試作のREADME、実験票、一次ログ

過去の失敗作・成功作・未成立の検証は削除していません。古い時系列やClaude向けrunbookは、過去を再現する資料であって現在の作業キューではありません。

## 遊べる比較版

| 入口 | 位置づけ |
|---|---|
| https://garakuta-lab.pages.dev/play/ | 現在の既定・比較基準 |
| https://garakuta-lab.pages.dev/scrapline/ | 最新の独立試作。作者テストは不採択 |
| https://garakuta-lab.pages.dev/ | ラボの入口 |
| /play/?ruleset=laws / relay / phase | 本編の比較ルールセット |
| /kindling/ / emberline/ / tomori/ / night-eater/ | 縦切り比較版 |
| /graft/ / echo/ / haul/ / material/ / puzzle/ / control/ / cycle/ | 旧独立試作 |

## 設計上の不変条件

- 機械検査は到達性、勝敗、決定性、UI・ログ・版識別の健全性を確認します。面白さは作者の一次観測で判定します。
- 高い勝率、構造ゲート通過、複雑さ、エージェント評価は、fun/replayの代替ではありません。
- 作者が「誰が何をして、何が変わったか」を説明できない場合、文章・数値・要素を足す前にコアを作り直します。
- 失敗後に次に変えることが残るかを、勝敗とは別に見ます。

検査・公開・D1/exportの細部は docs/REPOSITORY_MAP.md から必要な資料へ進んでください。
