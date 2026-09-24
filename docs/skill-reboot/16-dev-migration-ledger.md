# dev移行台帳 — Stage 0

更新日: 2026-09-24  
状態: **進行中。** 基準調査とカタログ由来メタデータの同期を開始した。ゲーム本体の切替前に旧経路の依存と代替検査を追う。

この台帳は、[PR #288の依存監査・実装順序](https://github.com/KKawamura1/garakuta-lab/blob/feat/weapon-skill-system/docs/skill-reboot/15-pr288-dependency-audit-and-sequencing.md)に沿って、dev上での確認事項・撤去条件・未確認点を記録する。技能仕様の正本はmainの [武器カタログ](11-weapon-catalog.md) と [解決順監査](12-resolution-order-audit.md)。PR #288は移植元・監査材料として使い、全体をdevへ取り込まない。

## 基準スナップショット

| 対象 | 2026-09-24時点の状態 |
|---|---|
| main / dev | mainの基準commitは `d06e997a4bffbfb7d4848f1576a89708ee566f53`。devとこのStage 0作業ブランチはこのcommitから開始した |
| PR #288 | Draft・open。base=`main`、head=`feat/weapon-skill-system`（`1d3855cac3da825a0c470a411d316f86abd0633b`）、43 commits、104 files（追加43,799 / 削除37,560）。この差分は丸ごとマージしない |
| PR #288技能監査 | 同PRの監査台帳は戦槌・格闘具・射出器の57/190節を仕様・実装・挙動テストまで照合済みとしている。残る133節と共有機構変更後の再監査が残る |
| mainのCI | mainの基準commitに対する `灰の遠征 checks` run 35870940575 はsuccess。2026-09-24のcheck-runでも `Current implementation` とCloudflare Pages deployがsuccess |
| #288で報告された検査 | `weapon-system.test.mjs` 2,950 checks、`story.test.mjs` 5,739 checks、termination 117、schema 134などはpassと報告。 `ecology/check.mjs` は14 suite中13 passで、contract snapshotの不一致が残作業として記録されている |
| Issue #178 | open。完了条件に `node ecology/check.mjs`、`bash analysis/check-all.sh`、両trialが含まれる。新しい同等試験を通すか、完了条件を明示的に更新するまで両trialを削除しない |

mainのCIはNode 22で構文検査、`ecology/check.mjs`、`analysis/check-all.sh`のsmokeを実行する。`.github/workflows/ecology-trial.yml`はpush時にmainを除外するため、この基準runは公開preview上の遠征・チュートリアル通しを証明しない。画面／切替PRでは専用branch previewで両trialを確認し、実行不能なら未確認理由を記録する。ここでの基準検査結果はGitHub Actionsの記録によるもので、このWork内でmain全体をローカル実行した結果ではない。

## 旧経路の依存台帳

| 旧経路・参照元 | 置換先 | 撤去条件と代替検査 |
|---|---|---|
| `ecology/content/skills-active.mjs`、`skills-reactive.mjs`、`skills-passive.mjs`。現行player registryは `content/index.mjs` で統合される | 武器別player skill moduleと、新しいplayer registry | 初期20節の実装・戦闘・予測・replayが新registryを通る切替PRで旧定義を撤去。IDごとの契約・挙動試験を移す |
| `content/skill-tree.mjs`、`skill-tree-layout.mjs`、`skill-levels.mjs`。旧skill ID、level map、取得前提をUI・進行・保存が読む | 武器別treeと取得済みID集合。武器技能にlevelを持たせない | 新treeの190位置・前提・取得可能集合・初期20を機械検査してから、旧tree・layout・level参照を初期20の切替PRで同時に削除。新規モジュールから旧IDをimportしない |
| `content/packs.mjs` のskill packと装備packの混在・共通解禁 | `skill-packs` と装備packの別registry・別manifest欄 | 遠征生成・抽選・画面のpack一覧・保存を別集合で検査し、技能が装備抽選へ／装備が技能取得へ漏れないことを確認して旧skill-pack経路を削除 |
| `content/index.mjs`、`content/enemies.mjs`、`playable-content.mjs`の共有player/enemy skill参照 | 敵が実際に使う定義だけのenemy registryと、武器別player registry | 全敵actorのactive/reactive/passive参照がenemy registryに解決し、player技能が混入しないことを検査。敵戦闘を維持した上で旧共有registryを撤去 |
| `schema.mjs`、`validate.mjs`、`effects.mjs`、`predicates.mjs`、`engine.mjs`、`event-queue.mjs`、`replay-beats.mjs` | 解決順監査に沿った共通event/effect/predicateと、その表示・replay | event語彙を増やすPRごとにschema・validator・engine境界テスト・表示/replayをそろえる。未知語彙はvalidator error。previewと本番を同一engine経路にする |
| `progression.mjs`、`playable-battles.mjs`、`app.js`のProfile/Run保存、取得・予約、装備、予測 | 新loadout、予約、装備/技能pack分離、明示的なcontent/save version | 新versionで取得から保存・再読込を試験し、異なるversionを拒否する。旧save移行は行わず、互換adapterを切替PRに残さない |
| `app.js`、`index.html`、`styles.css`、画面smoke、tutorial/expedition trial | fixture先行の武器tree/loadout/予約/技能説明/戦闘予測UI | 画面ごとに390px前後のsmokeとbranch previewを確認。未実装節を取得可能に見せず、本番と予測に同じengine event列を使う |
| `contract-snapshot.json`、`contract-snapshot.mjs`、`contract.test.mjs`、`ecology/check.mjs`、`analysis/check-all.sh`、GitHub Actions | 新規registry・save/event contractに対応するsnapshotとテスト | 対象PRごとに差分理由を確認する。削除するチェックは対応する新試験を明記してから外す |
| `docs/skill-reboot/README.md` と旧v3/research文書へのリンク、Issue #178 | docs・Issueの明示的な後続整理 | 文書リンクを実在ファイルで確認。Issue #178の両trial条件は同等試験か明示的な条件更新まで保持する |

依存が見つからないことだけで削除可とはしない。import、ID、保存データ、UI、preview、replay、CI、workflow、文書、Issueをこの表へ戻し、旧検査が覆っていた範囲を新しい検査へ移したPRで削除を完了とする。

## 190節メタデータの出典と現状

`11-weapon-catalog.md` の各武器表は10武器×19節で、位置・種別・名称・実装契約・表示用効果文・フレーバーを定義する。現在の正本には**実装skill IDと前提skill IDは明記されていない**。したがってそれらを「カタログから生成済み」とは扱わない。

このStage 0ではPR #288の `analysis/sync-pr287-weapon-spec.mjs` と生成物 `ecology/content/weapon-specifications.mjs` を移植する。同期checkはカタログ10武器・190行・列数・位置順・空欄・種別を検査し、生成物の差分を検出する。`analysis/check-all.sh` から `--check` で実行する。カタログ11とPR #288の生成物を組み合わせたローカル検証は `190 specification rows are synchronized` でpassした。

ID・前提の対応は、PR #288の武器tree moduleにあるposition-to-skill bindingが現状の根拠で、mainの仕様からは再生成できない。初期取得も、各人物の代表武器2本×R/A1を各節の実際の種別から導出する契約であり、A1をactiveと決め打ちしてはならない。Stage 0完了前に、bindingと代表武器の出典を明示したデータ／規則を一つにし、190位置への全件対応・一意ID・有効な前提・初期20件を検査する。仕様文のコピーをweapon moduleへ増やさない。

## Stage 0の残件と完了判定

- [x] mainの基準CI・PR #288・Issue #178の状態を記録
- [x] カタログ由来の190節表示・契約メタデータ同期を追加
- [ ] skill IDと前提関係を190位置へ一意に結ぶ正本と検証を追加
- [ ] 5人の代表武器2本からR/A1を種別不問で導出する初期20節を検証
- [ ] このPRのGitHub Actions CIを確認し、未確認点を更新

準備段階では旧player runtimeを維持する。新規モジュールは旧skill ID・level map・旧tree・旧pack形状へ依存させない。初期20節のゲーム本体切替と旧経路削除は同じ後続PRで行う。
