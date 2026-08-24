# 参照点・fixture計画

状態: **未実行（停止）**

R3 Gate Fは、5参照点を意味的なGate A〜Eへ実入力して棄却理由を出す必要がある。既存の生成範囲外による棄却は不十分と監査で判定した。

修正後に実施するfixtureは、各Gate条件ごとに次を揃える。

- 条件を満たすpositive fixture
- その条件だけを壊すnegative fixture
- negativeが実際にFAILする検査
- 証人が無い場合にPASSできないnonvacuous検査

ただしGate Cの3戦固定方策の報酬選択規則が未定義であり、fixtureを含む実装を進めると独自仕様の追加になるため未実行で停止した。