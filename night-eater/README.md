# 夜を食べる子 / NIGHT-EATER 0.1

作者が拾ったガラクタで、小さな相棒のふるまいを育てる独立試作。

## 遊び方

1. その夜に来たガラクタを選ぶ。
2. 目・胸・手のどこへ取り付けるか決める。取り替えは安い。
3. その子の現在のふるまいを見て、「任せる」「手を添える」「待つ」から選ぶ。
4. 6夜の出来事を見届け、終端で自由記述を送る。

部品は単独で働くが、共通語彙（見る・抱える・返す・温める）の組み合わせで意味が変わる。
数値の最大化を目的にせず、同じ部品を別の場所へ置いたときの身体と物語の変化を観測する。

## 起動

静的ファイルとして配信する。開発中はリポジトリのルートから、例えば次で確認できる。

~~~bash
python3 -m http.server 4173
~~~

その後 http://localhost:4173/night-eater/ を開く。

?seed=12 のようにseedを指定すると同じ提示順を再現できる。通常の入口ではseedを指定せず、
プレイヤーにはランダムに見せる。

## ログ

既存の agent-view/sync.js と同じ /api/runs へ gameVersion: night-eater-0.1 で送る。
途中経路は localStorage に保存し、送信失敗時は結果画面から再送できる。

主なイベント：

- run_started
- offer_seen
- part_installed / part_stored / part_discarded
- command_forecasts_seen
- command_chosen
- night_resolved
- emotion_marked
- survey_submitted
- run_ended

設計と人間テストの問いは analysis/NIGHT_EATER_0_1.md に記録する。
