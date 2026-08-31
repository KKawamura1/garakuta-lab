# EXP-18 R8 — Implementation Phase 1 完了報告

作成日: 2026-08-31（UTC）
更新日: 2026-08-31（UTC。作者承認を得てanti-stall修正とapp.js配線を追加実施）
対象: [R8](./R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md) §18 Implementation Phase 1
前提: [R8_IMPLEMENTATION_PHASE0_FREEZE.md](./R8_IMPLEMENTATION_PHASE0_FREEZE.md)

この票は「何を実装したか」と「Gate 1 に対して何が未達か」を分ける。
**面白さの証明ではない。** 作者プレイはまだ無い。

## 1. 実装したもの

### system（`ecology/` 配下の pure function 層）

| 契約 | 実装 | 場所 |
|---|---|---|
| `CampaignStageDef` / `PackCombatRole` | Stage 0〜3 を `E`, `W+E`, `T+E`, `B+W+T` へ固定 | `ecology/content/campaign-stages.mjs`、`ecology/content/packs.mjs` |
| manifestラダー検査（§16.1） | `auditCampaignManifestLadder()` | `ecology/content/campaign-stages.mjs` |
| `RunState.currentHp` / HP持ち越し | `newRun`、`commitBattleResult` | `ecology/progression.mjs` |
| 4/8戦目boss後の全回復 | `isActBossFullHealIndex` | `ecology/progression.mjs` |
| 敗北時 non-commit / retry restore | `commitBattleResult`（敗北時は run を一切変更しない） | `ecology/progression.mjs` |
| 野営治療（有限、補給消費） | `campTreat`、`CAMP_TREATMENTS`、`SUPPLY_USES.camp` | `ecology/progression.mjs` |
| 応急処置（chain 内だけの回復） | `emergency_treatment`（reactive skill） | `ecology/content/skills-reactive.mjs` |
| anti-stall 診断 | `analysis/ecology-anti-stall-audit.mjs` | 新設。**現状違反0件** |
| 安全撤退 vs 敗北の区別 | `settleRun(profile, run, "retreat")`、`BLUEPRINT_SAVE_LIMIT` | `ecology/progression.mjs` |
| Campaign Stage 解禁（活動資金で買えない） | `availableCampaignStages`、`isCampaignStageUnlocked` | `ecology/progression.mjs` |
| exact preview | `simulateNextBattle`、`previewNextBattle` | `ecology/playable-battles.mjs` |
| version 更新 | `PROFILE_SCHEMA_VERSION`/`RUN_SCHEMA_VERSION`/`MANIFEST_VERSION` を各1つ、`CONTENT_CONTRACT_VERSION` を2つ（4→5）上げた | `ecology/schema.mjs`、`ecology/content/index.mjs` |
| 旧 save migration | `normalizeProfile` が `campaignProgress` を追加で拾う。RunState は既存方式どおり version 不一致で破棄・再構築 | `ecology/progression.mjs` |

### content

- `pack_barrage`（連撃と刻印、Stage 3 の新パック）: `barrage_strike`、`mark_strike` の2 active のみ。
  密度（active 4〜6、発生源・変換器・利得先）は Phase 2 の仕事として未着手。
- `emergency_treatment`（reactive、`pack_care` 所属）: R8 §9.1 の worked example と数値まで一致する
  応急処置の実装例（被弾の1/3を返す、RP1、chain内1回）。
- **`mend`/`triage` を active から reactive へ作り替えた**（作者承認済み、§3参照）。
  `mend`（baseline）は被弾した誰か（自分含む）へ被弾量の25%、`triage`（`pack_care`）は
  被弾後にHP50%以下になった味方へ被弾量の50%を、どちらも `damage_taken` chain内で
  1回だけ返す。旧 ID は `RETIRED_IDS`（`content/index.mjs`）へ理由付きで記録した
  （別内容への再利用ではなく、同じIDの意味変更として記録）。
  `mender` の starterTactics/starterReactives、`SKILL_TREE_NODES` の kind、
  `ACTION_MODES` を連鎖的に更新した。

### UI（`ecology/app.js`）

- 遠征の仕立て方に「自由遠征」「キャンペーン」のタブを追加（`expedition-mode` action）。
  キャンペーンでは Stage 0〜3 のカードから選ぶ（`select-campaign-stage` action）。
- `currentHp()` が Campaign run では `run.currentHp` を読むよう分岐。マップ・編成・
  戦闘前確認の各画面のHP表示がそのまま持ち越しHPを表示する。
- `resetBattleResources()` を装備耐久専用の `resetEquipmentDurability()` と分離し、
  Campaign run では毎戦の強制フルヒールを止めた。
- `simulate` action 成功時に `commitBattleResult` を呼び、`run.currentHp` を確定する。
  敗北時・engine例外時はHPを変更しない（retry-safe）。
- 戦闘結果画面（`resultActors`、旧「次戦は全員HP最大」という誤ったコピー）を、
  Campaign run では実際の持ち越しHPを表示するよう修正
  （**ブラウザ確認で実際に見つけた不具合。§4参照**）。
- マップ画面に野営治療カード（`treat` action、対象は自動選択）を追加。
- 戦闘前確認画面に exact preview パネルを追加（`previewNextBattle` を呼び、
  RunStateを変更せず勝敗・ラウンド数・人物別開始/終了HPを表示）。
- 「遠征を放棄する」を「安全に撤退する」に改称し、outcome を `"abandoned"` から
  `"retreat"` へ変更。精算画面が retreat を敗北と区別して表示する。

### テスト・検査

- `ecology/campaign-stage.test.mjs`（新設、56 checks）を `ecology/check.mjs` へ登録。
- `ecology/contract-snapshot.json` を意図した差分だけで作り直した。
- `node ecology/check.mjs`: 8 suites 全通過。
- `node analysis/check-all.sh`: 全通過（18秒、予算60秒以内）。
- `node analysis/ecology-anti-stall-audit.mjs`: **違反0件**。
- `node analysis/ecology-trial.mjs`（既存のFree/Endless E2E、Playwright）: 55/55 通過（回帰なし）。
- Campaign Stage 専用の手動 Playwright 通し（モード切替→Stage選択→exact preview→
  戦闘実行→報酬→HP持ち越し確認→野営治療→安全撤退）を実施し、スクリーンショットで確認。

## 2. Gate 1（§18）チェックリストに対する状況

| Gate 1 の要求 | 状況 |
|---|---|
| 同じStage/seedで固定pack・敵・報酬・previewがdeep equal | ✅ `campaign-stage.test.mjs` で検証 |
| 通常・精鋭後carry、boss後回復、敗北非commit、retry restore、reload一致 | ✅ pure function レベルで検証。実ブラウザでの通し戦闘でも202/260等の持ち越しHPを確認 |
| previewと正式実行の勝敗・round・終了HP・消費資源・event fingerprintが一致 | ✅ `campaign-stage.test.mjs` に加え、実ブラウザのexact previewで「勝利1ラウンド、260→202」を表示 → 実行結果も202/260で一致することを確認 |
| harmless enemyを残しても、有限資源なしでcarry HPを改善できない | ✅ `mend`/`triage`を reactive化。`ecology-anti-stall-audit.mjs`が違反0件を報告 |
| random 3/4 manifest以外のPhase A/B既存出力が意図した差を除いて一致 | ✅ `contract.test.mjs`、`phase-b.test.mjs` が確認 |
| Fast checkを1分以内に保つ | ✅ 18秒 |

**機械検査の範囲ではGate 1を満たしている。** ただし本票冒頭のとおり、これは
「動く」ことの確認であり「面白い」ことの証明ではない。Gate 2（作者評価）は別。

## 3. anti-stall 修正の内容（作者承認済み、実施済み）

[R8_IMPLEMENTATION_PHASE0_FREEZE.md](./R8_IMPLEMENTATION_PHASE0_FREEZE.md) §3 で記録した反例
（`mend`/`triage` が AP専用active のため、敵を1体残してroundを稼ぐと無料回復できる）
に対し、作者から「大きく変えて構わない」と承認を得て、同票で提案した修正
（`damage_taken` を chain内だけで読む reactive への作り替え）を実施した。

- `mend`（baseline） / `triage`（`pack_care`）を active から reactive へ変更。
  IDと表示名は維持し、`content/index.mjs` の `RETIRED_IDS` へ理由と行き先を記録した
  （`CONTENT_CONTRACT_VERSION` を `-4` → `-5` へ上げた）。
- 回復量は `event_value_scaled`（被弾量の一定割合、mend 25% / triage 50%）にした。
  emergency_treatment（33%）と合わせ、どれも「同じ被弾を超えて回復しない」ため、
  round を稼いでも増えない。
- `mender` の starterTactics を `["strike", "idle_shuffle"]`、starterReactives を
  `["mend", "triage"]` へ変更。`SKILL_TREE_NODES` の該当ノードの `kind` を修正し、
  `node_emergency_treatment` を新設した。
- `analysis/ecology-expedition-smoke.mjs`、`analysis/ecology-decision-space-smoke.mjs`
  の参照 build もこれに合わせて更新した。

### 副作用として見つかった balance drift（未対応、Sol/作者判断待ち）

`analysis/ecology-decision-space-smoke.mjs`（SLOW_CHECKS、週次・手動のみ）の
「考えた編成 vs 素朴な編成」比較が、この変更後は閾値を割った
（作者が挙げた最強編成 1.75倍 に対し、素朴な役割配分の最良が1.55倍で、
差が1.13倍・閾値1.5に届かない）。原因は、この検査内のハードコードされた
参照build（`authorLoadout()`、`ROLE_KITS.回復`）を mend/triage の新しい reactive
形へ機械的に置き換えた際の配分差と考えられる。**係数はR8自身が「soft data、
遊んでから動かす前提」と明記している値であり、この検査を通すためだけに
数値やbuildを調整することはしていない**（AGENTS.mdの「通らないから閾値を
動かさない」に従う）。作者プレイでの再調整が必要な既知の課題として記録する。

## 4. 実ブラウザ確認で見つけて直した不具合

app.js を実際に Playwright で操作して初めて分かった問題:

- `resultActors()`（戦闘結果画面）が「次戦 HP」を常に `maxHp` 固定で表示しており、
  Campaign run でもHPが持ち越されないかのように見えていた。実際の `run.currentHp`
  を読むよう修正した。
- 同画面の説明文「戦闘中のHPと装備耐久は次の戦闘へ持ち越しません」も、
  Campaign run向けに「HPは持ち越します」という正しい文言へ分岐させた。

単体テストでは検出できない種類の不具合であり、実際に動かして確認したことに意味があった。

## 5. 今回のセッションで実施しなかったこと

- **Stage 0〜3 の probe content**（R8 §5.1-5.4、Implementation Phase 2）。
  敵family・配置・Stage law はまだ Phase B の `REGION`/`DIFFICULTIES` を
  placeholder として引き継いでいる（`campaign-stages.mjs` に明記）。
- **野営治療の対象選択UI。** 現状は対象を自動選択する簡易実装
  （集中治療=最もHP割合の低い生存者、蘇生=最初の戦闘不能者）。
  プレイヤーが対象を選ぶUIはまだ無い。
- **装備耐久の持ち越し。** R8はPhase 1の対象にしていないため、Campaign run でも
  装備耐久は毎戦フルへリセットする（HPだけが持ち越し対象）。
- **上記 §3 の balance drift の再調整。**

## 6. 次にすること

1. §3 の balance drift について、作者プレイまたは Sol の判断で
   参照 build・係数を再調整する。
2. Gate 2（作者評価）— Stage 0〜3 を実際に遊んでもらう。
3. Gate 2 通過後、R8 §18 Implementation Phase 2（Stage 0〜3 probe content）へ進む。
