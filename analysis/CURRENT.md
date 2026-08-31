# 現在地 — 灰の遠征

更新日: 2026-08-31（UTC）

## 結論

EXP-18 R8 の Campaign Stage 0〜3 が、現在の本編です。実装と機械検査は進んでいますが、作者は現行版をまだ評価していません。面白さと再プレイ欲は未判定です。

## 現行の遊び方

- 8人から5人を選ぶ。
- 5人を2×3の隊列に配置する。前列3・後列2、または前列2・後列3。
- 各人物に行動3、反応3、常設2を装着し、固定装備を2枠まで割り当てる。
- Campaign Stage を選ぶ。Stage 0 が既定で、Stage 1〜3 は前段のクリアで順に開く。
- 次の戦闘の敵、狙い、法則、変異、脅威の概要を開始前に読む。
- 自動戦闘を決定的に再生し、盤面の動きとイベントログで因果を追う。
- 報酬、野営、補給、撤退を選びながら遠征を進め、終了時に記録する。

## Campaign Stage

| Stage | 新しい pack | 返ってくる pack | 現在の意味 |
|---|---|---|---|
| 0 — 灰の入口 | pack_edge | なし | 範囲、到達、基本の反応 |
| 1 — 防壁と隊列 | pack_wall | pack_edge | 防御と隊列 |
| 2 — 行動権と準備 | pack_tempo | pack_edge | AP/RP と準備 |
| 3 — 連撃と刻印 | pack_barrage | pack_wall、pack_tempo | 連撃、刻印、開口部 |

1遠征は3幕12戦です。4、8、12戦目が act boss です。通常戦と精鋭戦の HP は持ち越し、4・8戦目のボス後に全回復します。補給は再挑戦、報酬の引き直し、偵察、野営などで消費する有限資源です。

## 現行の技術境界

- ecology/ が UI、content、engine、進行、replay、local save の本体。
- Profile は遠征をまたぐ資金・解禁・人物状態、Run は遠征内の資源と構成、Battle は一戦の再生状態を持つ。
- 同じ入力と seed は同じ戦闘イベント列を返す。
- exact preview は、開始前の見える情報と実際の battle input の一致を監視する。
- functions/api/runs.js と migrations/ が D1 の受け側です。

## 既知の未実装

- Stage 0〜3 の敵族、act boss 法則、stage-specific law は暫定定義。
- Phase C の生成装備、affix、Blueprint、目利き、追加 inventory は未実装。
- Stage 4 以降と Endless は未実装。
- 装備耐久は現状、戦闘ごとにリセットされる。
- 野営治療の対象選択は自動です。
- Free mode と旧 save migration は互換用で、Campaign の評価対象ではありません。

## 次の関門

作者が Stage 0〜3 を 1〜2 遠征遊び、編成の意図、選択の因果、次に試したい変更、再訪意欲、分かりにくい表示を記録します。その結果で、現行 content の調整か Phase C への進行かを判断します。
