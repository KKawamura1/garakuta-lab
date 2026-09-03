# AGENTS.md — 灰の遠征

作者自身が iPhone で繰り返し遊びたい自動戦闘遠征ゲームを作るリポジトリです。
本編は `ecology/`。公開先は https://garakuta-lab.pages.dev/ecology/ 、ルートは
`/ecology/` へリダイレクトします。

このファイルには、**今後ずっと守るルールだけ**を置きます。

## 資料は三つだけ

| 資料 | 中身 | 寿命 |
|---|---|---|
| AGENTS.md（これ） | 常に守る最小限のルール | 恒久 |
| `docs/` | 仕様・技術契約・運用・設計思想・歴史的経緯。**必要になったときだけ読む** | 恒久だが随時 |
| OPEN_ISSUES.md | 次の実装でだけ気をつける残論点。**片付いた項目はその場で削除する** | 一時的 |

新しい実験記録・進捗報告・状況メモのファイルを増やさないでください。事実は
コードとテストに、判断の経緯は `docs/HISTORY.md` に、やり残しは OPEN_ISSUES.md に
書きます。

## 判断の優先順位

1. 実コードと、そのコードを直接検査するテスト
2. `docs/` の仕様（`GAME.md` / `ARCHITECTURE.md` / `DESIGN.md`）
3. `docs/HISTORY.md` の経緯

資料と実装が食い違う場合、黙って片方へ寄せない。差分と影響を書いてから決めます。

## 守ること

- **決定性を壊さない。**同じ入力・seed・content version は同じイベント列を返す。
  `Date` と `Math.random` を engine とゲーム内容の計算経路へ入れない。
- **engine へ人物・技能・装備の固有 ID 分岐を足さない。**新しい面白さは、共有
  イベント・条件・資源・対象関係へ接続する content として足す。
- **exact preview と本番を同じ経路に保つ。**preview 専用の試算を作らない。
- **anti-stall 不変条件を守る。**敵を残して round を稼いでも、有限資源を払わない
  限り次戦へ持ち越す HP・補給・装備状態は改善しない（詳細は `docs/DESIGN.md`）。
- **公開済みの ID・イベント・effect の意味を黙って変えない。**変更は version と
  migration を持つ。ID を別内容へ再利用しない。
- **Profile / Run / Battle の分離を壊さない。**
- **機械検査の通過を、面白さ・因果理解・再プレイ欲の判定に使わない。**
- **作者に未検証の経路をテスト役として渡さない。**
- 仕様・閾値・公開可否を、実装の都合だけで事後に変更しない。
- system 変更と content 追加を同じ変更へ混ぜない。

## 最低限の検査

    node ecology/check.mjs
    bash analysis/check-all.sh

公開物を変えたときは `node analysis/stamp.mjs` で build 印を更新し、生成された
`core/build.mjs` も commit します。公開先まで確認する変更では GitHub Actions の
「Ecology trial (deployed)」を実行し、失敗した場合は URL を作者へ渡さず、失敗した
経路を記録します。

## 完了条件

変更理由、変更範囲、検査結果、未確認事項を PR に残します。やり残しは
OPEN_ISSUES.md へ、判断の経緯で残す価値があるものだけ `docs/HISTORY.md` へ
一行足します。
