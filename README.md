# ガラクタ・ラボ

作者自身が、中身を知った後もiPhoneで繰り返し遊びたいゲームを作るための実験場です。
完成仕様を磨くより、**面白さの仮説 → 小さな試作 → 自分でプレイ → 観測 → 次の仮説**
を短く回します。

## 新しい作業者が最初に読む資料

現在の正史は [PROJECT_MEMORY.md](./PROJECT_MEMORY.md) です。全ファイルを読む必要はありません。次に [analysis/EXPERIMENT_LEDGER.md](./analysis/EXPERIMENT_LEDGER.md) で、どの仮説が支持・不支持・未検証かを確認し、具体的な作業手順は [docs/AGENT_ONBOARDING.md](./docs/AGENT_ONBOARDING.md) に従ってください。

過去の [analysis/EXPERIMENT_HISTORY.md](./analysis/EXPERIMENT_HISTORY.md) や [.claude/RESUME.md](./.claude/RESUME.md) は失敗や運用経緯を保存した資料です。現在の実験キューを探す場所ではありません。失敗作・成功作・成立しなかった検証も含めて残しています。

プレイ版: https://garakuta-lab.pages.dev/

現在の既定版: **連勝機関 / SKIP 0.4**  
https://garakuta-lab.pages.dev/play/

## いま何を試しているか

中核は **法則機関 / laws-0.5** です。

- 5枠へ部品を並べる
- 部品ごとの作動周期と、枠で決まる位相がある
- 戦闘結果は決定的で、押す前に正確な予告を見られる
- 毎ラン2つの法則を引き、同じ部品でも有効な並びが変わる
- 人間へ出す前に、詰み・勝てる並び・順序の効き方を機械で検査する
- 現在ランへ出す法則の組は12組。単調・減衰は「上がる条件が実戦でほぼ働かない」ため、ランから外し、短い問題版にだけ残した

SKIP 0.4 は、この中核に「同じ並びのまま次も勝てるなら、戦闘を飛ばして strike とする」
仕組みを足した版です。strike そのものは3ラン連続で最良の瞬間に挙がりました。
一方、**連勝記録を永続得点にすれば次のランを始めたくなる**という仮説は2ラン連続で外れ、
休止判定になっています。したがって、SKIP 0.4 は現在の既定実装ではありますが、
「連勝記録が本命だと確定した」という意味ではありません。

いま残っている主な問いは次です。

- strike という出来事の何が効いたのか
- 終了時の答え合わせが、次のランを始める理由になっているか
- 「そのまま勝てる」戦闘を飛ばす判断が、遊ぶ部分を減らさず方針を作れるか
- 1巡上限が倍率の「上がる側」を捨てている問題をどう扱うか
- T2（勝てる並びの狭さ）と、法則同士の噛み合わせが本当に面白さを動かすか

直近までの流れは [analysis/EXPERIMENT_HISTORY.md](./analysis/EXPERIMENT_HISTORY.md)、
現在の作業状態は [.claude/RESUME.md](./.claude/RESUME.md) を参照してください。
リポジトリ全体の道案内は [INDEX.md](./INDEX.md) です。

## 企画の判断基準

最上位の外部記憶は [DESIGN_CHARTER.md](./DESIGN_CHARTER.md) です。
特に重視する体験は、来た材料の再解釈、方針転換、自分で強さを作った感覚、
驚いた後に理解できるオート戦闘、そして次に試したい仮説が残ることです。

作業者は最初に [AGENTS.md](./AGENTS.md) を読みます。
検証条件は守るべき仕様ではなく仮説です。条件を満たす版だけでなく、
満たさない版も比較し、面白さを予測できない条件は捨てます。

## 遊べる比較版

- **SKIP 0.4（既定）**: https://garakuta-lab.pages.dev/play/
- **素の法則機関**: https://garakuta-lab.pages.dev/play/?ruleset=laws
- **RELAY 0.1**: https://garakuta-lab.pages.dev/play/?ruleset=relay
- **PHASE 0.1**: https://garakuta-lab.pages.dev/play/?ruleset=phase
- **MAT 0.3「選べる漂着物」**: https://garakuta-lab.pages.dev/material/
- **破れ / PUZZLE 0.1**: https://garakuta-lab.pages.dev/puzzle/
- **操機 / CONTROL 0.1（EXP-03）**: https://garakuta-lab.pages.dev/control/?seed=7
- **エージェントと同じ情報だけを見る画面**: https://garakuta-lab.pages.dev/agent-view/
- **残響工房 / ECHO 0.1**: https://garakuta-lab.pages.dev/echo/?seed=12
- **持ち帰り限界 / HAUL 0.1**: https://garakuta-lab.pages.dev/haul/?seed=12

COST・SQUEEZE・IDENTは比較のため残していますが、直近の人間テストで休止判定です。
画面内の「遊び分け」から切り替えられます。

## 現在の独立探索

GRAFT、ECHO、HAULで、「初見の発見は作れても、得点・履歴・抽象的な資源だけでは知った後の再プレイが弱い」という結果が続いています。
HAUL 0.1では、部品7個という目標は読めましたが、余分に回収しても意味がなく、危険・船体も「何を守るか」を作れませんでした。作者プレイは3勝1敗、面白さ2,1,1,1、再プレイ度は全て1で、不採択と判定しています。
次はHAULの数値調整で延命せず、プレイヤーが守りたい具体的な対象と、ランごとに変化する構築対象を置く小さな観測型試作へ移ります。

結果と次の仮説は [analysis/HAUL_0_1.md](./analysis/HAUL_0_1.md)、実装と遊び方は [haul/README.md](./haul/README.md) です。

次の独立縦切りとして **ガラクタ列車 / SCRAPLINE 0.1** を追加しました。後部ホッパーから砲台までの車両順で一つの鉄塊を加工し、着弾後の戻り道までを因果ログとして再生します。7区画・最大5車両・seed再現・D1ログを備えます。公開URLでの人間テストは、ブラウザE2EとD1保存確認が済むまで案内しません。

- [scrapline/README.md](./scrapline/README.md) — 遊び方、seed、ログ仕様
- [analysis/SCRAPLINE_0_1.md](./analysis/SCRAPLINE_0_1.md) — 面白さの核、失敗回避、成功・停止信号
- [analysis/scrapline-smoke.mjs](./analysis/scrapline-smoke.mjs) — 決定性・順番差・7区画完走の回帰検査

## 本気の縦切り：拾い火 / KINDLING 0.1

難易度やルール量を増やす前に、「拾ったものを自分の形にして、相棒が実際に変わり、その帰結が物語になる」面白さを一度つなげて試す独立作です。6場面の夜道で、ルート選択、部位への組み込み、コンボ演出、短い物語、失敗の傷を一周にまとめています。

- プレイ版: https://garakuta-lab.pages.dev/kindling/
- [kindling/README.md](./kindling/README.md) — 遊び方、seed、ログ仕様
- [analysis/KINDLING_0_1.md](./analysis/KINDLING_0_1.md) — 仮説、公開条件、到達可能性の学び
- [research/fun_beyond_difficulty_2026-08-26.md](./research/fun_beyond_difficulty_2026-08-26.md) — 難易度・複雑さ以外の面白さの分解

通常はランダムseedで遊び、再現比較が必要なときだけURLに `?seed=12` のように指定します。既定の `/play/` は置き換えません。

## 実装と記録

- HTML / CSS / JavaScriptのみの静的PWA
- ルールとシミュレーションは `core/`、現在のUIは `play/`
- Pages Function + D1へプレイ記録を自動保存
- 保存失敗時は端末内キューから再送
- `localStorage` に進行・記録を保存し、Service Workerでオフライン対応
- 感情マーカー、各選択、戦闘処理、終了アンケート、最終構成を記録
- GitHub Actions経由でD1ログを読み取り可能
- Apple Developer ProgramとApp Store配布は不要

Cloudflare PagesではD1を `PLAYTEST_DB` としてbindingし、
`migrations/0001_playtest_observations.sql` を適用します。
`functions/api/runs.js` が同一オリジンから記録を受け取ります。

## 本気の縦切り：NIGHT-EATER 0.1

既存の数値・法則中心の比較をいったん横に置き、作者が拾ったガラクタで小さな相棒を育てる体験全体を試す独立作です。
部品の取り付け先で相棒の見た目とふるまいが変わり、6夜の短い物語と終了ログへつながります。

- [night-eater/README.md](./night-eater/README.md) — 遊び方とログ仕様
- [analysis/NIGHT_EATER_0_1.md](./analysis/NIGHT_EATER_0_1.md) — 開始時刻、魂、仮説、失敗信号

人間テスト公開条件とブラウザE2Eが未確認のため、現時点ではmainの既定版ではありません。


## 育成の縦切り：灯守 / TOMORI 0.1

NIGHT-EATER 0.1の反省から、相棒一体・3日間で「接し方が姿と反応に残り、最後の場面で返ってくる」ことを試す独立作です。

- プレイ版: https://garakuta-lab.pages.dev/tomori/
- [tomori/README.md](./tomori/README.md) — 遊び方とログ仕様
- [analysis/TOMORI_0_1.md](./analysis/TOMORI_0_1.md) — 仮説、成功・失敗信号、人間テストの問い

既定の本編入口や過去の試作は置き換えません。

## もう一度遊びたくなる核を探す：火走り / EMBERLINE 0.1

TOMORI 0.1では、雰囲気はあっても「何をしたか・なぜそうなったか」が一周で掴めず、作者の面白さ2/5・再プレイ度1〜2/5に留まりました。そこで物語を長くする前に、作者が遊びの中で方針を作れる小さな構築ゲームを新しく作っています。

**火走り / EMBERLINE 0.1** は、拾った廃材を4穴の機関へ装着し、左から順番に動かして、5区画の先の灯台へ火種を運ぶゲームです。毎区画で3つの廃材から1つを選び、空き穴への装着・既存部品との交換・無料の順序変更を行います。部品単体の効果だけでなく、火花・熱・守り・直前の出力による連鎖を、部品名つきの走行ログで確認できます。

- プレイ版：https://garakuta-lab.pages.dev/emberline/
- [emberline/README.md](./emberline/README.md) — 遊び方、記録、検査
- [analysis/EMBERLINE_0_1.md](./analysis/EMBERLINE_0_1.md) — 仮説、失敗信号、作者テストの判断基準
- [analysis/emberline-gate.mjs](./analysis/emberline-gate.mjs) — 問題空間の自動ゲート
- [analysis/emberline-smoke.mjs](./analysis/emberline-smoke.mjs) — 縦切りの回帰検査

実装時点の自動ゲートは5/5通過しています。ただしこれは面白さの合格ではありません。作者が実際に「次はこの廃材をこの順で試したい」と思うかを、公開プレイで判定します。既存のSKIP、ECHO、HAUL、TOMORIは比較基準として残し、既定版にはまだしません。

## EMBERLINE 0.1 作者テスト結果

作者の2ランは2/2勝利、10/10区画通過だった。seed12は面白さ3/5・再プレイ度3/5、ランダムseed181104049は面白さ2/5・再プレイ度2/5で、自由記述は「簡単すぎ」。後者は初期の機関だけで後半2区画を見送っても勝てた。

したがって、選択・配置・順序・因果ログの自動ゲートは通ったが、作者が求める「うまくやらないと負ける」「次の手を試したい」には届かず、0.1は不採択とした。次は閾値を上げるだけでなく、区画ごとの具体的な優先対象、交換の意味、勝敗に効く方針を増やす仮説を [analysis/EMBERLINE_0_1.md](./analysis/EMBERLINE_0_1.md) に登録している。
