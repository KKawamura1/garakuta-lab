# ecology — 灰の遠征の現行実装

ecology/ は EXP-18 R8 の本編を土台にした R10 Campaign です。現在の公開入口は /ecology/ で、ルートはここへリダイレクトします。

## 現行の範囲

- Campaign Stage 0〜3（R9 のチュートリアル構成: 2人 → 5人、pack は累積）
- Stage 0 初回の「勝てない一戦」と巻き戻し、Stage ごとの会話（立ち絵つきの一行送り。いつでも飛ばせる）
- 一度クリアした Stage は、揃っている仲間から5人を選んで再訪できる
- 行動3、反応3、常設2、装備2枠
- 3幕12戦、4・8・12戦目のボス。敵の数と threat budget は遠征の人数に合わせる
- HP 持ち越し、有限補給、報酬、野営、撤退
- 敵の狙いと開始条件の exact preview
- 決定的な自動戦闘リプレイと event log
- 手続き生成装備と Blueprint archive（Phase C）
- Profile / Run / Battle の保存と D1 送信
- New Game / Continue / Load Game。オートセーブと3つの手動セーブ枠を分離

Campaign Stage の pack は content/campaign-stages.mjs と content/packs.mjs が定義します。
Stage 0 から pack_edge、pack_wall、pack_tempo、pack_care を順に導入し、**引き上げません**。
新しい pack はその Stage では入口（core）だけ、次の Stage から全体（full）が出ます。

## タイトルと保存

- **New Game** は既存のオートセーブを確認のうえ、新しい Profile と Campaign Stage 0 を作り、シキとナズナの2人・オープニング会話から始めます。手動セーブ枠は残します。
- **Continue** は最新のオートセーブから再開します。タイトルの **Load Game** ではオートセーブと3つの手動セーブ枠を選べます。
- 手動セーブは Camp の安全な地点で作成でき、枠を上書きするときは確認を出します。
- 保存形式は R10 専用です。旧形式・旧キーのセーブは移行せず、読み込めないデータとして扱います。

## 主なファイル

| ファイル | 役割 |
|---|---|
| app.js | UI、local save、進行、送信 payload |
| engine.mjs | 決定的な戦闘解決 |
| playable-battles.mjs | 現行の戦闘入力、preview、loadout |
| progression.mjs | Profile、Run、報酬、補給、Campaign 解禁 |
| replay-beats.mjs | イベント列をリプレイ表示へ変換 |
| content/ | 人物、技能、装備、敵、pack、Campaign、affix、物語、名簿、根城 |
| equipment-gen.mjs | 手続き生成装備の決定的 generator と検査 |
| blueprints.mjs | Blueprint archive、持込枠、再製造 |
| sync.mjs | /api/runs への送信と端末 ID |
| check.mjs | ecology のテスト suite runner |

## 検査

    node ecology/check.mjs
    bash analysis/check-all.sh
    node analysis/ecology-anti-stall-audit.mjs
    node analysis/ecology-contract-smoke.mjs
    node analysis/ecology-equipment-gen-smoke.mjs
    node analysis/ecology-readout-smoke.mjs
    node analysis/ecology-screens-smoke.mjs
    node analysis/ecology-test-hygiene-smoke.mjs
    node analysis/ecology-upload-smoke.mjs

画面の通しは二つあります。analysis/ecology-trial.mjs が12戦の長い流れと精算・投資を、
analysis/ecology-tutorial-trial.mjs が本編（Campaign）の入口——最初の会話、勝てない一戦、
巻き戻し、2人編成、入口だけの技能ツリー、生成装備の報酬、根城と名簿、図鑑——を踏みます。
どちらも手元では Chromium、公開先では GitHub Actions から走ります。R12 で Free mode を削除したので、その互換検査（ecology-expedition-smoke.mjs / ecology-decision-space-smoke.mjs）も一緒に消しました。

## 境界

現行版は Stage 0〜3 までです。Stage 4 以降、Endless、stage 固有の敵法則、
affix family の購入はまだありません。`pack_barrage`（連撃と刻印）と
`pack_relay`（余波と受け渡し）は content としては存在しますが、Campaign Stage には
入っておらず、Campaign には出てきません。

自動検査が通っても、作者の fun や再プレイ欲は未判定です。

R8 / R9 の判断と実装履歴は analysis/experiments/exp-18/ にあります。
直近の実装票は R8_IMPLEMENTATION_PHASE4_STATUS.md（生成装備と Blueprint）と
R9_IMPLEMENTATION_TUTORIAL_STAGES.md（初期4Stageのチュートリアル化）です。
## イベントログの値

engine が出力する `type` は、次の44種類に固定しています。

- `battle_started`
- `round_started`
- `actor_activated`
- `round_ended`
- `battle_ended`
- `action_declared`
- `target_selected`
- `target_changed`
- `action_cost_paid`
- `action_started`
- `action_resolved`
- `action_skipped`
- `action_canceled`
- `preparation_started`
- `preparation_advanced`
- `preparation_completed`
- `preparation_interrupted`
- `damage_proposed`
- `barrier_damaged`
- `barrier_broken`
- `damage_taken`
- `excess_damage`
- `healing_proposed`
- `healing_applied`
- `excess_healing`
- `barrier_proposed`
- `barrier_gained`
- `barrier_expired`
- `actor_defeated`
- `resource_refreshed`
- `resource_spent`
- `resource_gained`
- `resource_unused`
- `actor_moved`
- `status_added`
- `status_removed`
- `equipment_worn`
- `equipment_broken`
- `equipment_repaired`
- `block_proposed`
- `block_gained`
- `damage_blocked`
- `block_spent`
- `pending_amount_modified`

イベントの値と不変条件は `schema.mjs` と `validate.mjs` が定義します。
