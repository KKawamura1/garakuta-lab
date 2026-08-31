# ecology — 灰の遠征の現行実装

ecology/ は EXP-18 R8 の本編です。現在の公開入口は /ecology/ で、ルートはここへリダイレクトします。

## 現行の範囲

- Campaign Stage 0〜3
- 8人から5人を選ぶ 2×3 隊列
- 行動3、反応3、常設2、装備2枠
- 3幕12戦、4・8・12戦目のボス
- HP 持ち越し、有限補給、報酬、野営、撤退
- 敵の狙いと開始条件の exact preview
- 決定的な自動戦闘リプレイと event log
- Profile / Run / Battle の保存と D1 送信

Campaign Stage の pack は content/campaign-stages.mjs と content/packs.mjs が定義します。Stage 0 から pack_edge、pack_wall、pack_tempo、pack_barrage を順に導入し、一部の pack を返します。

## 主なファイル

| ファイル | 役割 |
|---|---|
| app.js | UI、local save、進行、送信 payload |
| engine.mjs | 決定的な戦闘解決 |
| playable-battles.mjs | 現行の戦闘入力、preview、loadout |
| progression.mjs | Profile、Run、報酬、補給、Campaign 解禁 |
| replay-beats.mjs | イベント列をリプレイ表示へ変換 |
| content/ | 人物、技能、装備、敵、pack、Campaign |
| sync.mjs | /api/runs への送信と端末 ID |
| check.mjs | ecology のテスト suite runner |

## 検査

    node ecology/check.mjs
    bash analysis/check-all.sh
    node analysis/ecology-anti-stall-audit.mjs
    node analysis/ecology-contract-smoke.mjs
    node analysis/ecology-readout-smoke.mjs
    node analysis/ecology-screens-smoke.mjs
    node analysis/ecology-test-hygiene-smoke.mjs
    node analysis/ecology-upload-smoke.mjs

公開先の通しは analysis/ecology-trial.mjs です。Free mode の互換検査は analysis/ecology-expedition-smoke.mjs と analysis/ecology-decision-space-smoke.mjs です。

## 境界

現行版は Stage 0〜3 までです。生成装備、Blueprint、Stage 4 以降、最終的な stage 固有の敵法則はまだありません。自動検査が通っても、作者の fun や再プレイ欲は未判定です。

R8 の判断と実装履歴は analysis/experiments/exp-18/ にあります。
