# SCRAPLINE — 企画書実装マップ

`analysis/SCRAPLINE_GAME_CONCEPT.md` の「最初から守る設計上の境界」を、
`scrapline/` の実装と自動検査へ対応づけた記録です。現在の ruleset は
`scrapline-0.5`、build は `scrapline-build-20260827-r5` です。

## 簡単な土台から順に積んだもの

1. **決定的な弾の変形** — `engine.mjs` の `makeProjectile` / `processLine`。
   弾ID、重さ、火花、速度、分裂世代、溶融、帰還を一つのオブジェクトで追います。
2. **順番と局所プレビュー** — `previewTrain` と `previewMarkup`。
   各車両の前後スナップショットを表示し、勝敗そのものは予告しません。
3. **敵の問いと物理的な時間** — `CHALLENGES`、`enemyDamage`、`challengeFor`。
   群れ、装甲、速攻、拾い屋、分解、混成、ボスを、行動と複数の解法で表現します。
   車両が長いほど `travel` が伸び、外し続けると敵弾が車体へ届きます。
4. **毎区画の再構築** — `offersFor`、`installCar`、`removeCar`、`moveCar`。
   新車両は一台だけ拾い、満車なら交換、不要車は解体、重複レベル上げは不可です。
5. **ショーと答え合わせ** — `runBattle` のイベント列を `replayFrame` が再生。
   車両ハイライト、弾の色・大きさ・世代、敵弾の標的車両、帰還再加工、粒子、音、振動を同じ列から生成します。
6. **作品としての終了** — `finalShotMarkup`、`majorRebuild`、`rebuildHistoryMarkup`。
   最終車列、最大の一射、三つの因果、大改造地点、車列名、次の未完の問いを残します。
7. **保存と観測** — `localStorage`、`telemetry.mjs`、manifest、Service Worker。
   report/reward/done の再開、オフライン送信待ち、seed・車列・イベント・感情マーカーを保存します。

## 8つの境界の対応

| 企画書の意図 | 実装上の対応 | 機械検査 |
| --- | --- | --- |
| 一つの鉄塊を追跡 | projectile `id` と `beforeProjectiles` / `afterProjectiles` | carイベントに前後配列がある |
| 配置順で意味が変わる | `processLine`、加速/切断/帯電/溶融/磁石の順 | previewの要約・速度が不一致 |
| 新報酬で既存列を再解釈 | seed依存の3候補、交換・見送り・移動履歴 | 256 seedの最終列191通り |
| 車両数と発射速度の交換 | `baseTravel` と弾速、敵の遅延反撃 | 到着tickと反撃イベント |
| 行動の違う複数の敵 | wave、armor、fast、steal、splits、boss | 各問い2本以上の勝ち筋 |
| 戦前プレビュー/戦後再生 | enemy preview、local preview、cause replay | UIソースとイベント対応検査 |
| 見た目・音・振動の質的成長 | 8発までの帰還再加工、色、粒子、WebAudio、Vibration API | 8発 `return_reprocess` と敵弾変換 |
| 最終列車と大改造履歴 | final train、`carHistory`、major rebuild | 終了画面の履歴・次の問い |

## 企画書で「初版には入れない」もの

熱・電気ゲージ、固有A+Bレシピ、同一車両のレベル上げ、リロール店、指数HP、
隠し命中乱数、長いストーリー、永続スコアを追加していません。火花や装甲は、
弾・装甲板・敵弾という画面上の具体物としてだけ現れます。

## 残るのは人間・公開環境の検証

ローカルの決定性、複数解法、PWA資産、UIのネイティブダイアログ不使用は
`analysis/scrapline-smoke.mjs`、0〜255 seed の完走と最終列の分岐は
`analysis/scrapline-seed-regression.mjs` で検査します。一方、iPhone Safariの実機操作、公開環境の
D1行/export、初見プレイヤーの再プレイ欲はコードだけでは合格にできないため、
`docs/HUMAN_TEST_RELEASE.md` のリリースゲートで別途確認します。
