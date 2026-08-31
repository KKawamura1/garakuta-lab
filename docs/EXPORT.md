# 灰の遠征のプレイ記録を取り出す

更新日: 2026-08-31（UTC）

## 通常手順

1. GitHub の Actions で Export D1 playtests を開く。
2. limit を選び、通常は 3 または 5 にする。
3. 自由記述をジョブログへ出さない場合は echo_to_log=false のままにする。
4. workflow を起動する。
5. 完了後に artifact をダウンロードし、現行版の game_version と buildStamp を確認する。

この workflow は終了した記録だけを読み取り、D1 の行を変更しません。大量の結果を扱う場合は limit を小さくして複数回に分けます。

## 見る項目

- game_version: 画面とルールの版
- buildStamp: 公開物の build 印
- outcome: 到達、勝敗、終了時 HP
- build: 仲間、隊列、技能、装備
- events: 遠征内の選択、戦闘、報酬、精算
- answers: 終了アンケート
- moments: 感情マーカー

現行の入口は ecology/ です。過去版の記録を混ぜず、版と build を先に絞ってから内容を読んでください。

## 公開ログ

echo_to_log=true は、自由記述が GitHub Actions のログへ出す設定です。作者の明示的な確認がある場合だけ使い、通常は false にします。
