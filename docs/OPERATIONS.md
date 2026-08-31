# 灰の遠征 — 運用手順

更新日: 2026-08-31（UTC）

## 日常の変更

1. AGENTS.md、analysis/CURRENT.md、変更対象の R8 と実装を読む。
2. 現在の branch と main の差分を確認する。
3. 変更理由と受入条件を PR に書く。
4. 実装後に次を実行する。

    node ecology/check.mjs
    bash analysis/check-all.sh

5. 公開物を変更した場合は analysis/stamp.mjs で build 印を更新し、生成された core/build.mjs も commit する。
6. GitHub Actions の通常 Checks が成功してから、公開先 E2E を必要に応じて実行する。

## 作者へ渡す条件

作者へ URL を渡すのは、実装、ローカル検査、公開先 E2E の未確認項目が無い場合だけです。機械検査は壊れた候補を落とすためのもので、fun、因果理解、再プレイ欲は作者の評価で決めます。

## D1 の扱い

ecology/ は終了時に、版、build、seed、Profile/Run の要約、event 列、アンケートを /api/runs へ送ります。送信失敗時も端末側の保存結果を明示し、「保存済み」と「D1 保存済み」を混同しません。

取得は Export D1 playtests workflow の読み取り専用経路を使います。自由記述をジョブログへ出す echo_to_log=true は、作者の明示的な確認がある場合だけ使用します。

## 変更時の注意

- Campaign Stage と Free mode は別の進行軸です。
- CONTENT_CONTRACT_VERSION、Profile/Run schema、save key を変更するときは migration と古い端末データへの影響を書く。
- 新しい content は登録、exact preview、決定性、anti-stall の検査を追加する。
- 未実装の Phase C、Stage 4 以降を説明だけで現行化しない。

## 障害時

- 画面が空白なら、ブラウザ console、公開された module の MIME、build 印、直接 import の順に確認する。
- 戦闘が止まるなら、同じ seed のイベント列、termination、anti-stall の結果を確認する。
- D1 の送信が失敗するなら、payload の schema、HTTP status、functions/api/runs.js の許可 host、D1 migration を確認する。
- 作者のプレイ結果を推測で補わず、未確認として止める。
