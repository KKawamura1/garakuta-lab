# ガラクタ・ラボ

作者自身が、中身を知った後もiPhoneで繰り返し遊びたいゲームを作るための実験場です。
完成仕様を磨くより、**面白さの仮説 → 小さな試作 → 自分でプレイ → 観測 → 次の仮説**
を短く回します。

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
- **エージェントと同じ情報だけを見る画面**: https://garakuta-lab.pages.dev/agent-view/

COST・SQUEEZE・IDENTは比較のため残していますが、直近の人間テストで休止判定です。
画面内の「遊び分け」から切り替えられます。

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
