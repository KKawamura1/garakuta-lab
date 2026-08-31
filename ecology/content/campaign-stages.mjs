// ecology/content/campaign-stages.mjs
//
// **Campaign Stage の固定定義。R8 §4, §5.1-5.4。**
// R8 Implementation Phase 1 step 1/2 で新設した。
//
// Campaign は「難易度 rank」ではなく、Stage ごとに固有のパック構成を持つ
// （R8 §1.1）。ここで定義するのは Stage 0〜3 だけである
// （R8 §2「次に行う実装」step 2、§18 Implementation Phase 1 step 1）。
// Stage 4 以降は、Stage 0〜3 の作者評価（Gate 2）を経てから設計する
// （R8 §5 の表は「実装開始用の具体案」であり、本ファイルの対象外）。
//
// Free / Endless の random manifest（`makeManifest`, progression.mjs）は
// このファイルと独立に存在し続ける。campaign 専用の固定 manifest だけを
// ここで作る（R8 §1.2「seedはcampaignのpack選択には使わない」）。
//
// ここを触ってよいのは Campaign Stage 担当だけ。engine・schema は変更しない。

import { MANIFEST_VERSION } from "../schema.mjs";
import { BASELINE_ACTIVE_SKILL_IDS, PACK_BY_ID, SKILL_PACKS } from "./packs.mjs";
import { REGION } from "./expedition.mjs";

// R8 §4.2 — 有効パック数の初期式。activePackCount(sequence) = 1 + ceil(sequence / 2)。
// Stage 0〜6 の表: 1, 2, 2, 3, 3, 4, 4。
export function activePackCountForSequence(sequence) {
  return 1 + Math.ceil(sequence / 2);
}

// R8 §2 step 2 / §5.1-5.4 — Stage 0〜3 だけを固定する。
// enemyFamilyIds / actBossIds / stageLawIds は、Stage 固有の敵・配置・law が
// 未設計（R8 Implementation Phase 3 の仕事）なので、現行 REGION の値を
// Phase 1 の placeholder として引き継ぐ。**固定値であり、player profile に
// 応じて動的に変えない**（R8 §4.1 の不変条件）。
const PLACEHOLDER_ENEMY_FAMILY_IDS = Object.freeze([...REGION.enemyFamilyIds]);
const PLACEHOLDER_ACT_BOSS_IDS = Object.freeze([...REGION.actBossIds]);

// R8 §3.7 — 「報酬倍率をStage番号の一次式にはしない」。Stage 固有の報酬・law が
// 無い現時点では、単純な rank 一次式を代わりに作ることも禁じられた行為に当たる。
// **soft data が確定するまでは等倍のまま**にする（R8 §2.1「今は決めないもの」）。
const UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS = 10_000;

export const CAMPAIGN_STAGES = Object.freeze([
  Object.freeze({
    id: "stage_0_edge",
    sequence: 0,
    displayName: "Stage 0 — 灰の入口",
    newPackId: "pack_edge",
    returningPackIds: Object.freeze([]),
    enabledPackIds: Object.freeze(["pack_edge"]),
    activePackCount: 1,
    enemyFamilyIds: PLACEHOLDER_ENEMY_FAMILY_IDS,
    actBossIds: PLACEHOLDER_ACT_BOSS_IDS,
    stageLawIds: Object.freeze([]),
    pressureTags: Object.freeze(["guard", "block", "small_group"]),
    learningGoals: Object.freeze([
      "単発・多段・貫通・行/列・準備・撃破条件の基礎比較（R8 §5.1）",
    ]),
    activityFundMultiplierBps: UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS,
  }),
  Object.freeze({
    id: "stage_1_wall",
    sequence: 1,
    displayName: "Stage 1 — 防壁と隊列",
    newPackId: "pack_wall",
    returningPackIds: Object.freeze(["pack_edge"]),
    enabledPackIds: Object.freeze(["pack_edge", "pack_wall"]),
    activePackCount: 2,
    enemyFamilyIds: PLACEHOLDER_ENEMY_FAMILY_IDS,
    actBossIds: PLACEHOLDER_ACT_BOSS_IDS,
    stageLawIds: Object.freeze([]),
    pressureTags: Object.freeze(["position", "cover", "row_column"]),
    learningGoals: Object.freeze([
      "damage_blocked→受け返しの集中→次の単発・範囲攻撃（R8 §5.2）",
      "位置替え→踏み固め／移動後集中→行・列・後衛狩り（R8 §5.2）",
    ]),
    activityFundMultiplierBps: UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS,
  }),
  Object.freeze({
    id: "stage_2_tempo",
    sequence: 2,
    displayName: "Stage 2 — 行動権と準備",
    newPackId: "pack_tempo",
    returningPackIds: Object.freeze(["pack_edge"]),
    enabledPackIds: Object.freeze(["pack_edge", "pack_tempo"]),
    activePackCount: 2,
    enemyFamilyIds: PLACEHOLDER_ENEMY_FAMILY_IDS,
    actBossIds: PLACEHOLDER_ACT_BOSS_IDS,
    stageLawIds: Object.freeze([]),
    pressureTags: Object.freeze(["preparation", "ap_pressure"]),
    learningGoals: Object.freeze([
      "大溜めが、複数人物からAP/RPを集めて短時間に放つ利得先へ変わる（R8 §5.3）",
      "止めの一突き→撃破→拾い直しという別レーンも成立させる（R8 §5.3）",
    ]),
    activityFundMultiplierBps: UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS,
  }),
  Object.freeze({
    id: "stage_3_barrage",
    sequence: 3,
    displayName: "Stage 3 — 連撃と刻印",
    newPackId: "pack_barrage",
    returningPackIds: Object.freeze(["pack_wall", "pack_tempo"]),
    enabledPackIds: Object.freeze(["pack_wall", "pack_tempo", "pack_barrage"]),
    activePackCount: 3,
    enemyFamilyIds: PLACEHOLDER_ENEMY_FAMILY_IDS,
    actBossIds: PLACEHOLDER_ACT_BOSS_IDS,
    stageLawIds: Object.freeze([]),
    pressureTags: Object.freeze(["block_read", "onhit", "mark"]),
    learningGoals: Object.freeze([
      "多段攻撃がblock chargeを一枚だけ剥がし、残りhitを通す（R8 §5.4）",
      "Wの位置替えとrow/column制御が、多段のon-hit対象数を増やす（R8 §5.4）",
      "TのAP追加が、mark付与→多段消費→追撃の一連へ使われる（R8 §5.4）",
      "Eが不在でも、Bの連鎖が別種の爽快感を作れるかを人間評価する（R8 §5.4）",
    ]),
    activityFundMultiplierBps: UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS,
  }),
]);

export const CAMPAIGN_STAGE_BY_SEQUENCE = Object.freeze(
  Object.fromEntries(CAMPAIGN_STAGES.map((stage) => [stage.sequence, stage])),
);
export const CAMPAIGN_STAGE_BY_ID = Object.freeze(
  Object.fromEntries(CAMPAIGN_STAGES.map((stage) => [stage.id, stage])),
);
export const MAX_CAMPAIGN_STAGE_SEQUENCE = CAMPAIGN_STAGES.length - 1;

export function campaignStageDef(sequence) {
  const clamped = Math.max(0, Math.min(MAX_CAMPAIGN_STAGE_SEQUENCE, Math.floor(sequence ?? 0)));
  return CAMPAIGN_STAGE_BY_SEQUENCE[clamped];
}

// R8 §4.1 — Campaign では manifest の pack 構成を random にしない。
// seed は敵順・報酬・装備roll等へは使うが、pack 選択には使わない
// （R8 §1.2「seedは...campaignのpack選択には使わない」）。
export function campaignManifestForStage(sequence, seed) {
  const stage = campaignStageDef(sequence);
  return {
    manifestVersion: MANIFEST_VERSION,
    seed: String(seed),
    regionId: REGION.id,
    campaignStageId: stage.id,
    campaignStageSequence: stage.sequence,
    baselineSkillIds: [...BASELINE_ACTIVE_SKILL_IDS],
    enabledPackIds: [...stage.enabledPackIds],
    enabledAffixFamilyIds: [],
    enemyFamilyIds: [...stage.enemyFamilyIds],
    actBossIds: [...stage.actBossIds],
    actBossLawIds: [...REGION.actBossLawIds],
    regionLawIds: [...stage.stageLawIds],
    rewardTableId: REGION.rewardTableId,
  };
}

// ---------------------------------------------------------------- 16.1 manifestラダー検査
//
// R8 §16.1。CampaignStageDef の並びが契約を満たすかを、機械的に検査する。
// **fun の証明ではない**——構造が壊れていないことだけを見る。
export function auditCampaignManifestLadder(stages = CAMPAIGN_STAGES) {
  const problems = [];
  const introducedBy = new Map(); // packId -> 最初に newPackId として現れた sequence
  let lastPrimaryOffenseSequence = null;

  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence);
  for (const stage of sorted) {
    const path = `${stage.id} (sequence ${stage.sequence})`;

    // 各Stageに一つだけ初登場packがある。新packは必ず有効。
    if (!stage.enabledPackIds.includes(stage.newPackId)) {
      problems.push(`${path}: newPackId "${stage.newPackId}" が enabledPackIds に無い`);
    }
    if (introducedBy.has(stage.newPackId)) {
      problems.push(`${path}: newPackId "${stage.newPackId}" は sequence ${introducedBy.get(stage.newPackId)} で既出`);
    } else {
      introducedBy.set(stage.newPackId, stage.sequence);
    }

    // enabledPackIds は newPackId と returningPackIds から成る。
    const expectedEnabled = new Set([stage.newPackId, ...stage.returningPackIds]);
    const actualEnabled = new Set(stage.enabledPackIds);
    if (expectedEnabled.size !== actualEnabled.size
      || [...expectedEnabled].some((id) => !actualEnabled.has(id))) {
      problems.push(`${path}: enabledPackIds が newPackId + returningPackIds と一致しない`);
    }

    // 有効pack数が登録した列 1,2,2,3,3,4,4... と一致する。
    const expectedCount = activePackCountForSequence(stage.sequence);
    if (stage.activePackCount !== expectedCount || stage.enabledPackIds.length !== expectedCount) {
      problems.push(`${path}: activePackCount が ${expectedCount} でない`
        + `（宣言 ${stage.activePackCount}、enabledPackIds.length ${stage.enabledPackIds.length}）`);
    }

    // future packが早いStageへ漏れない: returningPackIds は「それより前の
    // sequence で newPackId として既出」のものだけ。
    for (const packId of stage.returningPackIds) {
      const introducedAt = introducedBy.get(packId);
      if (introducedAt === undefined || introducedAt >= stage.sequence) {
        problems.push(`${path}: returningPackIds に含む "${packId}" は、まだこの Stage より前で初登場していない`);
      }
    }

    // 参照する pack が SKILL_PACKS に実在し、role を宣言している。
    for (const packId of stage.enabledPackIds) {
      const pack = PACK_BY_ID[packId];
      if (!pack) {
        problems.push(`${path}: pack "${packId}" が SKILL_PACKS に存在しない`);
        continue;
      }
      if (!pack.combatRole) problems.push(`${path}: pack "${packId}" が combatRole を宣言していない`);
    }

    // 全manifestにprimary offenseまたは許可されたoffensive hybridがある。
    const roles = stage.enabledPackIds.map((id) => PACK_BY_ID[id]?.combatRole).filter(Boolean);
    const hasPrimary = roles.includes("primary_offense");
    const hasHybrid = roles.includes("offensive_hybrid");
    if (!hasPrimary && !hasHybrid) {
      problems.push(`${path}: primary_offense も offensive_hybrid も含まない manifest`);
    }
    // 幕1（Stage自体の最初の局面）だけは offensive_hybrid 代替を許すが、
    // それは stage_0 のように新規導入 Stage が hybrid のときの話であって、
    // ここでは「stage 自体に攻撃役が居るか」だけを見る（R8 §6.5）。

    // 有効パック4以上では、primary offenseまたはoffensive hybridを二つ以上含める。
    if (stage.enabledPackIds.length >= 4) {
      const offenseRoleCount = roles.filter((role) => role === "primary_offense" || role === "offensive_hybrid").length;
      if (offenseRoleCount < 2) {
        problems.push(`${path}: 有効パック4以上なのに攻撃roleを持つpackが2つ未満`);
      }
    }

    // primary offenseを少なくとも3Stageに一つ新規導入する。
    if (PACK_BY_ID[stage.newPackId]?.combatRole === "primary_offense") {
      if (lastPrimaryOffenseSequence !== null && stage.sequence - lastPrimaryOffenseSequence > 3) {
        problems.push(`${path}: 直前の primary_offense 新規導入（sequence ${lastPrimaryOffenseSequence}）から3Stageを超えている`);
      }
      lastPrimaryOffenseSequence = stage.sequence;
    }
  }

  // 同Stage・異seedでpack構成が一致する（決定性）。
  for (const stage of sorted) {
    const a = campaignManifestForStage(stage.sequence, "seed-a");
    const b = campaignManifestForStage(stage.sequence, "seed-b");
    if (JSON.stringify(a.enabledPackIds) !== JSON.stringify(b.enabledPackIds)) {
      problems.push(`${stage.id}: seed を変えると enabledPackIds が変わった（campaign は pack 選択に seed を使わない契約）`);
    }
  }

  return problems;
}
