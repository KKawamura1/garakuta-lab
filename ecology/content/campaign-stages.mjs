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
import { AFFIX_FAMILIES } from "./affixes.mjs";
import { BASELINE_ACTIVE_SKILL_IDS, PACK_BY_ID, SKILL_PACKS } from "./packs.mjs";
import { REGION } from "./expedition.mjs";

// ---------------------------------------------------------------- ラダーの型（R8 §4.2 / R9 §3）
//
// **R8 と R9 で有効パック数の作り方が違う。黙って片方へ寄せない。**
//
//   R8 §4.2「有効パック数を徐々に増やす」… activePackCount = 1 + ceil(sequence/2)
//     → 1, 2, 2, 3, 3, 4, 4。§4.3「過去パックは単純累積させない」で、
//       Stage ごとに一部の過去パックを引き上げる（回転）。
//   R9 §3「初期4Stageのチュートリアル化」… 累積。1, 2, 3, 4。
//     → 「チュートリアル中に以前の語彙を入れ替えず、基本packを土台として
//        少しずつ積む構成を第一候補とする」（R9 §3）。
//
// 初期4 Stage は R9 の累積を採る。**Stage 4 以降は R8 の回転へ戻す**ので、
// 式そのものは両方残し、Stage 定義が `ladderMode` でどちらを名乗るかを決める。
// 差分と影響は docs/HISTORY.md §3.2。
export const LADDER_MODES = Object.freeze(["tutorial", "rotation"]);
export const TUTORIAL_MAX_SEQUENCE = 3;

export function activePackCountForSequence(sequence, mode = "tutorial") {
  if (mode === "tutorial") return sequence + 1;
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

// R9 §2 — **初期4 Stage は、5人とゲームの文法を覚えるチュートリアルとして扱う。**
// 2人で始め、Stage を一つ進むごとに1人が加わり、Stage 3で5人が揃う。
// 加入する人物は pack の所有者ではない（`joiningCharacterId` は「その pack の
// 分かりやすい入口を持つ人」であって、その pack を独占しない）。
//
// `packDepths` は R9 §3.1 の「累積させる」を実装する。新 pack はその Stage では
// core（入口）だけ、次の Stage から full。**前に覚えた技能は消えない。**
export const CAMPAIGN_STAGES = Object.freeze([
  // R13 — 人物を差し替えた。**pack の解禁順（care → edge → wall → tempo）は動かない。**
  // 動かせない理由は、この下の検査が「sequence 0 以外は primary_offense pack が
  // 残っていること」を要求していて、campaign の primary_offense は pack_edge 一つ
  // しか無いからである。**だから直したのは問い（誰が何を教えるか）のほうだけ。**
  //
  //   0 ゴウ＋ツグミ … 武器（腕力）と技（集中）の違い＝立つ場所の違い
  //   1 ＋ナギ       … **問題は Stage 0 で既に出ている。**ゴウは受け1で細かい攻撃が
  //                    全部通り、ツグミは主火力なのに紙。前に立てる人が来て、刃が届く
  //   2 ＋ヒバナ     … 行動権2の遊撃。隊列を動かすこと自体は割に合わず、
  //                    寄せて行・列で薙ぐと初めて得になる
  //   3 ＋ゲンゾウ   … 順番そのものを触れるようになり、選択肢が一気に広がる
  Object.freeze({
    id: "stage_0_edge",
    sequence: 0,
    ladderMode: "tutorial",
    displayName: "Stage 0 — 灰の入口",
    question: "武器と技の違いは、立つ場所の違い",
    partySize: 2,
    castCharacterIds: Object.freeze(["warden", "mender"]),
    joiningCharacterId: null,
    newPackId: "pack_care",
    returningPackIds: Object.freeze([]),
    enabledPackIds: Object.freeze(["pack_care"]),
    packDepths: Object.freeze({ pack_care: "core" }),
    activePackCount: 1,
    enemyFamilyIds: PLACEHOLDER_ENEMY_FAMILY_IDS,
    actBossIds: PLACEHOLDER_ACT_BOSS_IDS,
    stageLawIds: Object.freeze([]),
    pressureTags: Object.freeze(["guard", "block", "small_group"]),
    learningGoals: Object.freeze([
      "武器（腕力）の攻撃は後列から出すと大きく落ち、技（集中）は落ちない（R11 §5）",
      "だから前列と後列の選択は、守りの話であると同時に火力の話でもある",
      "**主火力のツグミが一番柔らかい。**この一点が、以降3 Stage の問題になる",
      "回復は「HPを戻す役」ではなく「損傷の連鎖を止める役」（R8 §9.4）",
    ]),
    activityFundMultiplierBps: UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS,
  }),
  Object.freeze({
    id: "stage_1_wall",
    sequence: 1,
    ladderMode: "tutorial",
    displayName: "Stage 1 — 抜ける刃",
    question: "誰が前に立つと、誰が振り抜けるか",
    partySize: 3,
    castCharacterIds: Object.freeze(["warden", "mender", "lancer"]),
    joiningCharacterId: "lancer",
    newPackId: "pack_edge",
    returningPackIds: Object.freeze(["pack_care"]),
    enabledPackIds: Object.freeze(["pack_care", "pack_edge"]),
    packDepths: Object.freeze({ pack_care: "full", pack_edge: "core" }),
    activePackCount: 2,
    enemyFamilyIds: PLACEHOLDER_ENEMY_FAMILY_IDS,
    actBossIds: PLACEHOLDER_ACT_BOSS_IDS,
    stageLawIds: Object.freeze([]),
    pressureTags: Object.freeze(["position", "burst", "row_column"]),
    learningGoals: Object.freeze([
      "溜め・条件・貫通は、成立すれば安定した一撃を大きく上回る（R9 §3）",
      "ナギは受けが桁違いで、hit ごとの固定軽減なので**多段がそのまま止まる**",
      "**庇う技はまだ来ない。**前に立つ人が居るという事実だけで、後列の技が通り続ける",
    ]),
    activityFundMultiplierBps: UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS,
  }),
  Object.freeze({
    id: "stage_2_tempo",
    sequence: 2,
    ladderMode: "tutorial",
    displayName: "Stage 2 — 動く隊列",
    question: "隊列を動かして、何を得るか",
    partySize: 4,
    castCharacterIds: Object.freeze(["warden", "mender", "lancer", "guardian"]),
    joiningCharacterId: "guardian",
    newPackId: "pack_wall",
    returningPackIds: Object.freeze(["pack_care", "pack_edge"]),
    enabledPackIds: Object.freeze(["pack_care", "pack_edge", "pack_wall"]),
    packDepths: Object.freeze({ pack_care: "full", pack_edge: "full", pack_wall: "core" }),
    activePackCount: 3,
    enemyFamilyIds: PLACEHOLDER_ENEMY_FAMILY_IDS,
    actBossIds: PLACEHOLDER_ACT_BOSS_IDS,
    stageLawIds: Object.freeze([]),
    pressureTags: Object.freeze(["cover", "position", "row_column"]),
    learningGoals: Object.freeze([
      "身代わり・受け構え・防壁が、被害を「消す」のではなく「移す」（R9 §3）",
      "**位置替えそれ自体は割に合わない。**必ず誰かと入れ替わり、前列は先に狙われる",
      "ヒバナは行動権が二つあるので往復できる。寄せて行・列で薙ぐと初めて得になる",
      "刃 pack が full になり、前 Stage の技能に新しい使い道が出る（R9 §3.1）",
    ]),
    activityFundMultiplierBps: UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS,
  }),
  Object.freeze({
    id: "stage_3_care",
    sequence: 3,
    ladderMode: "tutorial",
    displayName: "Stage 3 — 間合いと順番",
    question: "誰がいつ動くと得か",
    partySize: 5,
    castCharacterIds: Object.freeze(["warden", "mender", "lancer", "guardian", "tactician"]),
    joiningCharacterId: "tactician",
    newPackId: "pack_tempo",
    returningPackIds: Object.freeze(["pack_care", "pack_edge", "pack_wall"]),
    enabledPackIds: Object.freeze(["pack_care", "pack_edge", "pack_wall", "pack_tempo"]),
    packDepths: Object.freeze({
      pack_care: "full", pack_edge: "full", pack_wall: "full", pack_tempo: "core",
    }),
    activePackCount: 4,
    enemyFamilyIds: PLACEHOLDER_ENEMY_FAMILY_IDS,
    actBossIds: PLACEHOLDER_ACT_BOSS_IDS,
    stageLawIds: Object.freeze([]),
    pressureTags: Object.freeze(["preparation", "ap_pressure", "attrition"]),
    learningGoals: Object.freeze([
      "行動権を渡すと、遅い構成にも大技の手番が通る（R9 §3）",
      "ゲンゾウは反応点が二つ多い。**自分から動かず、読んでから何度も割り込める**",
      "割り込みと準備の前倒しで、同じ編成から別の結果が出る",
      "5人が揃い、配置・技能・装備の差だけで役割を作れるか（R9 §2.1）",
    ]),
    activityFundMultiplierBps: UNTUNED_ACTIVITY_FUND_MULTIPLIER_BPS,
  }),
]);

// R9 §2.1 — チュートリアルの人数。Stage の定義から引く一箇所。
export function partySizeForStage(sequence) {
  return campaignStageDef(sequence).partySize;
}

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
    // R9 §3.1 — 新 pack はその Stage では core（入口）だけを出し、
    // 次の Stage から full になる。**前に覚えた技能は消えない。**
    packDepths: { ...stage.packDepths },
    ladderMode: stage.ladderMode,
    partySize: stage.partySize,
    castCharacterIds: [...stage.castCharacterIds],
    // R8 §13.2 — Phase C。Stage の pack が、その Stage で拾える装備の
    // affix family を決める。**Stage 番号では決めない**（pack が意味の単位）。
    enabledAffixFamilyIds: AFFIX_FAMILIES
      .filter((family) => family.packId === null || stage.enabledPackIds.includes(family.packId))
      .map((family) => family.id),
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

    // 有効pack数が、その Stage が名乗るラダーの式と一致する。
    if (!LADDER_MODES.includes(stage.ladderMode)) {
      problems.push(`${path}: ladderMode "${stage.ladderMode}" が未知`);
    }
    const expectedCount = activePackCountForSequence(stage.sequence, stage.ladderMode);
    if (stage.activePackCount !== expectedCount || stage.enabledPackIds.length !== expectedCount) {
      problems.push(`${path}: activePackCount が ${expectedCount} でない`
        + `（宣言 ${stage.activePackCount}、enabledPackIds.length ${stage.enabledPackIds.length}）`);
    }

    // R9 §2.1 — チュートリアルは2人から始めて Stage ごとに1人増え、Stage 3で5人。
    if (stage.ladderMode === "tutorial") {
      const expectedParty = Math.min(5, stage.sequence + 2);
      if (stage.partySize !== expectedParty) {
        problems.push(`${path}: partySize が ${expectedParty} でない（宣言 ${stage.partySize}）`);
      }
      if (stage.castCharacterIds.length !== stage.partySize) {
        problems.push(`${path}: castCharacterIds の人数が partySize と合わない`);
      }
      if (stage.sequence > 0) {
        if (!stage.joiningCharacterId) problems.push(`${path}: 加入する人物が宣言されていない`);
        else if (!stage.castCharacterIds.includes(stage.joiningCharacterId)) {
          problems.push(`${path}: 加入する人物 "${stage.joiningCharacterId}" が cast に居ない`);
        }
      }
      // 累積: 前 Stage の enabledPackIds を全部持っている（入れ替えない）。
      const previous = sorted.find((entry) => entry.sequence === stage.sequence - 1);
      if (previous) {
        for (const packId of previous.enabledPackIds) {
          if (!stage.enabledPackIds.includes(packId)) {
            problems.push(`${path}: チュートリアル中に pack "${packId}" が引き上げられている（R9 §3.1 は累積）`);
          }
        }
        for (const characterId of previous.castCharacterIds) {
          if (!stage.castCharacterIds.includes(characterId)) {
            problems.push(`${path}: チュートリアル中に "${characterId}" が抜けている（R9 §2.1 は仲間外れを作らない）`);
          }
        }
      }
      // 新 pack は core で入り、以前の pack は full になっている。
      if (stage.packDepths[stage.newPackId] !== "core") {
        problems.push(`${path}: 新 pack "${stage.newPackId}" が core で入っていない`);
      }
      for (const packId of stage.returningPackIds) {
        if (stage.packDepths[packId] !== "full") {
          problems.push(`${path}: 過去 pack "${packId}" が full になっていない（R9 §3.1）`);
        }
      }
      // どの Stage にも攻撃の主役が居る（累積なので pack_edge が残り続ける）。
      //
      // **例外は導入 Stage（sequence 0）だけ。**この検査のすぐ下のコメントが
      // 「stage_0 のように新規導入 Stage が hybrid のとき」を想定と書いているのに、
      // 判定側がそれを許していなかった。R11 §5 で Stage 0 は「条件のない一撃を
      // 武器と技で一本ずつ」に絞った導入になり、primary_offense はナギと一緒に
      // Stage 1 で来る。baseline の斬撃・防壁・応急は manifest に関わらず必ず
      // 引けるので（packs.mjs の BASELINE_*）、行動不能な人物は作られない。
      const hasPrimary = stage.enabledPackIds
        .some((packId) => PACK_BY_ID[packId]?.combatRole === "primary_offense");
      const hasHybrid = stage.enabledPackIds
        .some((packId) => PACK_BY_ID[packId]?.combatRole === "offensive_hybrid");
      if (!hasPrimary && !(stage.sequence === 0 && hasHybrid)) {
        problems.push(`${path}: primary_offense pack が残っていない`);
      }
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
    if (JSON.stringify(a.enabledPackIds) !== JSON.stringify(b.enabledPackIds)
      || JSON.stringify(a.packDepths) !== JSON.stringify(b.packDepths)) {
      problems.push(`${stage.id}: seed を変えると enabledPackIds が変わった（campaign は pack 選択に seed を使わない契約）`);
    }
  }

  return problems;
}
