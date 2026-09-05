# AGENTS.md — One Battle Ahead

作者自身が iPhone で繰り返し遊びたい自動戦闘遠征ゲームを作るリポジトリです。
本編は `ecology/`。公開先は https://garakuta-lab.pages.dev/ecology/ 、ルートは
`/ecology/` へリダイレクトします。

## 作業前に読むもの

- 毎回まずこの `AGENTS.md` を読む。
- 変更対象のコードとテストを読む。
- 必要に応じて `docs/GAME.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、
  `docs/OPERATIONS.md`、`docs/HISTORY.md`、`docs/RULE_ECOLOGY.md` を読む。
- `OPEN_ISSUES.md` は現在の作業キューとして確認し、解決済み項目はその場で削除する。
- `CLAUDE.md` はこのファイルを読むよう指示するだけで、追加ルールはない。
- 実装変更時は `GAME.md` と `ARCHITECTURE.md` を現在形に更新する。
  設計判断を変更したときは `DESIGN.md` と `HISTORY.md` を更新する。

## 守ること

- `Profile` / `Run` / `Battle` の三層を分離する。
- 同じ入力・seed・content version・generator version から、同じ結果とイベント列を返す。
  `Date` と `Math.random` を engine やゲーム内容の計算経路へ入れない。
- 乱数 key を用途別に分け、reward reroll で後続の敵や drop を変えない。
- Manifest、Encounter、Reward、装備、compiled equipment、Blueprint、再製造品の
  JSON 内容を完全に一致させる。
- preview と本番は同じ経路を使い、UI・replay・検査は engine の同じイベント列を読む。
- 新しい event は schema、validator、engine テスト、表示・replay と同時に更新する。
  未知の event、effect、predicate、scope、tag は無視せず validator error にする。
- 計算途中は整数比または固定小数で保持し、effect 確定時に round-half-up する。
  AP、RP、hit 数、block 数、round、charge、耐久、status stack、位置は小整数で扱う。
- `RETIRED_IDS` は理由付きで残す。version の不一致を黙って無視しない。
- anti-stall を守る。敵を残して round を稼ぐだけで、次戦へ持ち越す HP・補給・装備状態が
  改善してはいけない。
- 新しい面白さは固有 ID の相方ではなく、共有 event・predicate・cost・effect・target
  relation で作る。pack は発生源・変換器・利得先・制動／代償を持ち、閉じたレシピにしない。
- 敵は特定技能を要求せず、速度・対象数・guard・block・位置・継続時間・資源圧力などの
  性能軸を変える。新 pack は既存 event を読み、単独でも現在価値のある技能を作る。
- 完全上位互換を作らない。作る場合は明確な代償を付ける。
- 装備の生成処理は `trigger → condition 0〜2個 → cost 0〜1個 → effect 1〜2個 → limit →
  durability/charge` の形にし、発火不能・無料無限循環・説明不能なものは生成バグとして拒否する。
  rule は拾う前から全文を読めるようにし、50回試行して生成できなければ診断を表示する。
- 遠征中の活動資金は ledger に仮計上し、勝利・安全撤退・敗北時に一度だけ精算する。
  成長の主軸は新技能・装備・情報・持込枠・経路など横方向に置き、敵を隠れて自動強化しない。
  通常画面で K/M 表記を常用しない。

## 最低限の検査と公開

```bash
node ecology/check.mjs
bash analysis/check-all.sh
```

画面を変更した場合は、次も実行する。

```bash
node analysis/ecology-tutorial-trial.mjs
node analysis/ecology-trial.mjs
```

通常 CI 成功後に公開先 E2E を行う。公開物を変更したら
`node analysis/stamp.mjs` を実行し、生成された `core/build.mjs` も commit する。
preview と本番の build 印・content contract を一致させ、検査結果・未確認事項・変更理由・
変更範囲を PR に残す。失敗した経路が一つでもあれば、作者へ URL を渡さない。
