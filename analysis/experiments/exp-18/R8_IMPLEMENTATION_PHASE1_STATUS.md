# EXP-18 R8 — Implementation Phase 1 完了報告

作成日: 2026-08-31（UTC）
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
| anti-stall 診断 | `analysis/ecology-anti-stall-audit.mjs` | 新設。**現状2件の違反を報告する（§3参照）** |
| 安全撤退 vs 敗北の区別 | `settleRun(profile, run, "retreat")`、`BLUEPRINT_SAVE_LIMIT` | `ecology/progression.mjs` |
| Campaign Stage 解禁（活動資金で買えない） | `availableCampaignStages`、`isCampaignStageUnlocked` | `ecology/progression.mjs` |
| exact preview | `simulateNextBattle`、`previewNextBattle` | `ecology/playable-battles.mjs` |
| version 更新 | `PROFILE_SCHEMA_VERSION`/`RUN_SCHEMA_VERSION`/`MANIFEST_VERSION` を各1つ、`CONTENT_CONTRACT_VERSION` を1つ上げた | `ecology/schema.mjs`、`ecology/content/index.mjs` |
| 旧 save migration | `normalizeProfile` が `campaignProgress` を追加で拾う。RunState は既存方式どおり version 不一致で破棄・再構築 | `ecology/progression.mjs` |

### content（最小限、Phase 2 probe content の対象外）

- `pack_barrage`（連撃と刻印、Stage 3 の新パック）: `barrage_strike`、`mark_strike` の2 active のみ。
  密度（active 4〜6、発生源・変換器・利得先）は Phase 2 の仕事として未着手。
- `emergency_treatment`（reactive、`pack_care` 所属）: R8 §9.1 の worked example と数値まで一致する
  応急処置の実装例。

### テスト・検査

- `ecology/campaign-stage.test.mjs`（新設、56 checks）を `ecology/check.mjs` へ登録。
- `ecology/contract-snapshot.json` を意図した差分だけで作り直した（新規スキル・パック・manifest 節のみ）。
- `node ecology/check.mjs`: 8 suites 全通過。
- `node analysis/check-all.sh`: 全通過（21秒、予算60秒以内）。
- `node analysis/ecology-anti-stall-audit.mjs`: **意図的に非ゼロ終了**（§3参照。fast path 対象外）。

## 2. Gate 1（§18）チェックリストに対する状況

| Gate 1 の要求 | 状況 |
|---|---|
| 同じStage/seedで固定pack・敵・報酬・previewがdeep equal | ✅ `campaign-stage.test.mjs` で検証 |
| 通常・精鋭後carry、boss後回復、敗北非commit、retry restore、reload一致 | ✅ pure function レベルで検証。**reload（app.js の永続化）は未検証**（§4参照） |
| previewと正式実行の勝敗・round・終了HP・消費資源・event fingerprintが一致 | ✅ `campaign-stage.test.mjs` が実際に `simulateBattle` を1回走らせて検証 |
| harmless enemyを残しても、有限資源なしでcarry HPを改善できない | ⚠️ **未達。** `mend`/`triage` が構造的にこの不変条件を破る。§3 参照 |
| random 3/4 manifest以外のPhase A/B既存出力が意図した差を除いて一致 | ✅ `contract.test.mjs`、`phase-b.test.mjs` が確認 |
| Fast checkを1分以内に保つ | ✅ 21秒 |

**したがって Gate 1 はまだ全達成していない。** 残るのは1点（anti-stall）と、
未実施のUI統合（§4）。

## 3. 未解決: anti-stall（Sol 判断待ち）

[R8_IMPLEMENTATION_PHASE0_FREEZE.md](./R8_IMPLEMENTATION_PHASE0_FREEZE.md) §3 で記録済みの反例のとおり、
`mend`（baseline）と `triage`（`pack_care`）は、HP 持ち越し下で
「敵を1体残してround を稼ぐと無料で回復できる」という anti-stall 違反を持つ。

提案する修正は同票に記載した（`damage_taken` を chain 内だけで読む reactive への
作り替え。`emergency_treatment` が実装例）。**今回の system migration には含めていない**
——`mend` は複数人物の `starterTactics` に載る baseline 技能で、
active → reactive への変更は roster / skill-tree / `ACTION_MODES` /
`contract-snapshot.json` を連鎖的に更新する content 層の大改修になり、
R8 §19.4「system変更とcontent追加を同じPRへ混ぜない」に反するため。

## 4. 今回のセッションで実施しなかったこと

- **`ecology/app.js`（UI層）の本格的な配線。** 研究の結果、HP持ち越しの配線自体
  （`playable-battles.mjs` の `options.hp`）は既に存在しており、app.js が
  毎戦 `resetBattleResources()` を呼んで満タンへ戻しているだけと分かった
  （`R8_IMPLEMENTATION_PHASE0_FREEZE.md` §1）。したがって新しい pure function
  （`commitBattleResult`、`campTreat`、`previewNextBattle`、campaign stage 選択、
  安全撤退ボタン等）を実際の画面から呼ぶ配線はまだ無い。142KBのUIファイルへの
  安全な統合は、system契約とcontentを混ぜない責務分離（R8 §19.4）を守るため、
  別の作業単位として残した。
- **Stage 0〜3 の probe content**（R8 §5.1-5.4、Implementation Phase 2）。
  敵family・配置・Stage law はまだ Phase B の `REGION`/`DIFFICULTIES` を
  placeholder として引き継いでいる（`campaign-stages.mjs` に明記）。
- **Playwright E2E trial**（`analysis/ecology-trial.mjs`）の実行。
  バージョン文字列の参照だけ更新したが、実ブラウザでの通しは走らせていない
  （ローカル環境に対象サーバが無い）。

## 5. 次にすること

1. Sol が §3 の anti-stall 修正案（`mend`/`triage` の reactive 化）を判断する。
2. 判断後、承認されれば別 workstream として content 層の改修を行い、
   `analysis/ecology-anti-stall-audit.mjs` を緑にする。
3. `ecology/app.js` へ Campaign Stage 選択、HP持ち越し表示、野営治療、
   安全撤退、次戦 preview を配線する（system契約は今回の実装で確定済み）。
4. Gate 1 を機械的に確認できたら、R8 §18 Implementation Phase 2
   （Stage 0〜3 probe content）へ進む。
