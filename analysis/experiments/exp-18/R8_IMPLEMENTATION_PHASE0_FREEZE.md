# EXP-18 R8 — Implementation Phase 0: 現状凍結と migration 記録

作成日: 2026-08-31（UTC）
対象: [R8](./R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md) §2 step 1、§18 Implementation Phase 0
基準 commit: `94298f3be15b7154577fd946dfe03d241041ceaf`（main、2026-08-31 16:11 JST）

この票は、R8 の system migration（Implementation Phase 1）を始める前に、
「今何が動いているか」と「何を意図的に変えるか」を分離して書く。
既存の凍結資産（`ecology/contract-snapshot.json`、`ecology/phase-b.test.mjs`）を
複製しない。ここでは **どのテスト・fixture が「今のフルヒール random manifest」を
凍結しているか**と、**Phase 1 でそれぞれ何が起きるか**だけを対応表にする。

## 1. 凍結されている現行仕様と、その場所

| 現行仕様 | 凍結している場所 | Phase 1 での扱い |
|---|---|---|
| skill pack manifest は `runSeed` から3/4パックをランダム選択（`makeManifest`, `progression.mjs:390-414`） | `phase-b.test.mjs` §技能パック、`contract-snapshot.json` の `manifests` セクション | **維持する。** Free / Endless 用の既存経路として残す。Campaign 専用に新しい固定 manifest 経路（`campaignManifestForStage`）を追加で作る。既存関数のシグネチャ・出力は変えない |
| 難易度 rank 0〜5 が敵 threat budget・報酬倍率・開始補給を左右（`content/expedition.mjs` `DIFFICULTIES`） | `phase-b.test.mjs` §難易度、§難易度の解禁、`contract-snapshot.json` の `composedEncounters` | **維持する。** Free / Endless の難易度調整として残す。Campaign Stage の pack 構成・報酬倍率は rank ではなく `CampaignStageDef` が持つ新しい軸にする |
| 毎戦闘、HP は満タンから開始する（`app.js` の `resetBattleResources()` が `begin-stage` と `simulate` 後に毎回呼ばれる。`playable-battles.mjs` の `options.hp` 経由の持ち越し配線自体は既に存在するが、呼び出し側が毎回満タンを渡すので実質使われていない） | `phase-b.test.mjs` §12戦が実際に走る（HPを渡さず毎回 `makeExpeditionBattle` を呼ぶことで暗黙に凍結） | **意図的に変える。** `RunState.currentHp` を導入し、通常・精鋭戦後は持ち越す。4戦目・8戦目 boss 勝利後だけ拠点全回復する。この差分は「意図した差」であり、bug ではない |
| 敗北・放棄はどちらも `settleRun(profile, run, "lost"|"abandoned")` で活動資金だけを精算し、Blueprint という概念自体が存在しない | `phase-b.test.mjs` §活動資金（部分クレジット・二重精算拒否のテスト） | **拡張する。** `outcome: "retreat"`（安全撤退）を新設し、`won`/`retreat`/`lost` で settlement の記録形（`blueprintSaveLimit` フィールドなど、Phase C 未実装のため記録のみ）を分ける。既存の `won`/`lost` 経路の出力は変えない |
| `SUPPLY_USES` は `retry` / `reroll` / `scout` の3用途のみ | `phase-b.test.mjs` §補給 | **拡張する。** `camp`（野営治療）を4つ目の用途として追加する。既存3用途の動作は変えない |
| next-battle preview は存在しない | （凍結対象なし。新規機能） | **新設する** |
| `CONTENT_CONTRACT_VERSION = "ecology-content-contract-3"` | `content/index.mjs`、`contract.test.mjs` | Stage 3 用の最小限 `pack_barrage` と `emergency_treatment` を新設するため **4 へ上げる** |
| `PROFILE_SCHEMA_VERSION = "ecology-profile-1"` / `RUN_SCHEMA_VERSION = "ecology-run-1"` / `MANIFEST_VERSION = "ecology-manifest-1"` | `phase-b.test.mjs` §版 | RunState に `currentHp` 等、ProfileState に campaign stage 進行を追加するため **それぞれ1つ上げる**（`-2`） |

## 2. Migration 対象（旧 save → 新 schema）

既存の migration パターン（`progression.mjs` の `normalizeProfile` / `migrateLegacyProfile`、
`app.js` の `loadState()`）を踏襲する。

- **ProfileState**: `schemaVersion` 不一致時は `normalizeProfile` が新しい `newProfile()` へ
  拾える欄（活動資金、鍛錬、購入履歴、`regionProgress`）だけ移す既存方式を維持する。
  新設する `campaignProgress`（`highestClearedStage` / `clearedStageIds`）は
  旧 save に存在しないので、常に初期値（未クリア）から始まる。
  **旧 `regionProgress.highestClearedDifficulty` を campaign stage の既クリア数へ
  読み替える自動変換はしない**（difficulty rank と campaign stage は異なる軸であり、
  安全な対応関係が無いため）。作者の既存進行のうち活動資金・鍛錬・購入は失われない。
- **RunState**: 既存方式どおり、`schemaVersion` が一致しない進行中 run は
  「保存されていた遠征の形が古かったため、作り直しました」として**破棄して作り直す**。
  RunState は一遠征限りの低価値データであり、既存 migration も同じ扱いをしている
  （`A7_MILESTONE_0/PREFLIGHT.md` §7.4 に前例あり）。
- **旧 `difficulty` rank ベースの campaign 突入経路**: Campaign Stage 選択 UI は
  新しい `CampaignStageDef` 一覧から選ぶ形にする。Free / Endless からの `newRun` 呼び出しは
  従来どおり `options.difficulty` を使える。

## 3. Phase 1 で見つかった未解決の矛盾（Sol 判断が必要）

R8 §8-9 は「AP/RP だけで回復する常時使用可能な active は、HP 持ち越し下で
anti-stall 不変条件（§8.1）を破る」と明記している。現行の `mend`（baseline、
全 manifest で常時使用可）と `triage`（`pack_care`）はどちらも
`spend_action_points` のみをコストとし、被弾直後に限定されない、
round ごとに全回復する AP で何度でも再発動できる active heal である。

具体的な反例:

1. HP 持ち越しを導入すると、敵を1体だけ残して round を稼ぎ、`mend`
   （focus 120%、1AP）を毎 round 撃つだけで、実質無料で満タンまで
   回復してから次戦へ進めてしまう。これは R8 §8.1 の
   「敵を一体残して追加roundを経過させても...次戦へ持ち越すHPは改善しない」
   に反する。
2. `mend`/`triage` は active skill であり、reactive rule のような
   `limit: {scope, count}` フィールドを engine が持たない（`schema.mjs` の
   active skill 定義に limit 相当の語彙が無い）。したがって「1戦につき
   使用回数を機械的に制限する」対処は、既存の active skill 語彙の範囲では
   実装できない。

**実施済み（2026-08-31、作者承認）**: 下記の提案どおり `mend`/`triage` を
reactive へ作り替えた。詳細は
[R8_IMPLEMENTATION_PHASE1_STATUS.md](./R8_IMPLEMENTATION_PHASE1_STATUS.md) §3。

**提案した修正（実施済み）**: `mend`/`triage` を、被弾と
同じ reaction chain 内だけで発火する reactive（`listenTo: "damage_taken"`,
`amount: {type: "event_value_scaled", key: "amount", numerator: 1, denominator: 3}`
のような形）へ作り替える。この形は R8 §9.1 の「応急処置」の worked example
（被弾36 → 応急処置12 → 残り損傷24）と数値まで一致する。ただし
`mend` は baseline（`roster.mjs` の複数人物の `starterTactics`）で、
active → reactive への変更は roster の `starterTactics`/`starterReactives`、
`skill-tree.mjs` の `SKILL_TREE_NODES`、`ACTION_MODES`、
`contract-snapshot.json` を連鎖的に更新する content 層の大改修になる。
R8 §19.4「system 変更と content 追加を同じ PR へ混ぜない」「Stage 調整で
unit・encounter・Stage の二層以上を同時に動かさない」という責務分離方針から、
**この改修は今回の system migration（Phase 1）には含めない**。

代わりに、今回は以下を実装する:

- `analysis/ecology-anti-stall-audit.mjs`（新設。`*smoke*` glob には意図的に載らない名前にした） — 「heal effect を持つ
  active skill で、コストが `spend_action_points`/`spend_reaction_points`
  のみのもの」を機械的に検出する診断スクリプト。**現状 `mend` と `triage`
  を実際に検出して報告する**（意図的に緩めていない）。
- `emergency_treatment`（新設 reactive skill、`pack_care` 所属）—
  R8 §9.1 の「応急処置」パターンを実装した最初の実例。既存語彙のみで
  実装できる（新しい schema/engine 変更は不要）。今後の content 改修は
  これを模範にできる。
- この診断結果と提案は本票と Phase 1 完了報告に明記し、`mend`/`triage`
  の改修そのものは別 PR・別セッションの content workstream として
  Sol の判断へ委ねる。

## 4. この票の後の作業

Implementation Phase 1（`CampaignStageDef`、HP 持ち越し、有限治療、
exact preview、version migration）を、この票が凍結した対応表に沿って進める。
