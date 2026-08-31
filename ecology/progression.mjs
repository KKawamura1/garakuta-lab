// ecology/progression.mjs
//
// **Phase B の system。状態を三層に分け、遠征と活動資金をここだけで動かす。**
// R6 §4（三層）、§5（一遠征）、§9（活動資金）、§12（敗北と補給）、§13（難易度）。
// R7 Milestone 4 の system 側。
//
// ここは画面を知らない。DOM も localStorage も触らず、**入力から出力を作るだけ**にする。
// 理由は二つある。
//
//   1. 活動資金と精算は「一度だけ」が効く。画面の再描画に混ぜると、
//      同じ run を二度精算する経路がいつか生える。
//   2. 検査が画面なしで踏める。ecology/phase-b.test.mjs はここだけを見る。
//
// **不変条件（ここを壊したら Phase B は成立しない）**
//   - ProfileState に遠征内の技能点・装備・現在HP・現在の敵を入れない（R6 §4.1）。
//   - 同じ runId を二度精算しない（R6 §9.2）。
//   - retry しても同じ encounter の撃破 base は一度だけ（R6 §9.2）。
//   - 難易度は活動資金で買えず、一つ前の rank のクリアだけで開く（R6 §9.6）。
//   - 鍛錬は speed / AP / RP / 枠数 / 発火回数 / 優先順を上げない（R6 §9.5）。
//   - 永続値は 10進文字列で保存し、計算は bigint で行う（R6 §9.1）。

import {
  MANIFEST_VERSION,
  PROFILE_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
  TRAINABLE_STATS,
  TRAINING_STAT_TARGET,
} from "./schema.mjs";
import { roundHalfUpDiv, BPS } from "./values.mjs";
import { makeRng, seedKey, seededShuffle } from "./seeded.mjs";
import {
  BOSS_LAWS,
  ENCOUNTERS_PER_RUN,
  ENEMY_MUTATIONS,
  ENEMY_THREAT_COST,
  EQUIPMENT_GROUPS,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  MAX_DIFFICULTY_RANK,
  MAX_MUTATIONS_PER_UNIT,
  MUTATION_SPEND_ORDER,
  PACKS_PER_MANIFEST,
  PLAYABLE_CONTENT,
  REGION,
  SKILL_PACKS,
  STARTER_EQUIPMENT_IDS,
  BASELINE_ACTIVE_SKILL_IDS,
  campaignManifestForStage,
  campaignStageDef,
  difficultyDef,
  expeditionEncounter,
  skillIdsForPacks,
} from "./content/index.mjs";

export { PROFILE_SCHEMA_VERSION, RUN_SCHEMA_VERSION, MANIFEST_VERSION, MAX_CAMPAIGN_STAGE_SEQUENCE };

// ============================================================ 活動資金（R6 §9.1）
//
// 概念値1を100として設計する。通常戦一勝が100前後。JS の safe integer を
// 超え得るので、**永続化は10進文字列、計算は bigint**。

export const FUND_UNIT = 100;

export function parseFunds(value) {
  if (typeof value === "bigint") return value < 0n ? 0n : value;
  const text = String(value ?? "0").trim();
  if (!/^-?\d+$/.test(text)) return 0n;
  const parsed = BigInt(text);
  return parsed < 0n ? 0n : parsed;
}

export function fundsToString(value) {
  return parseFunds(value).toString();
}

// 画面に出す形。**桁区切りだけ**で、K / M へ省略しない（R6 §9.5）。
export function formatFunds(value) {
  return parseFunds(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ============================================================ 鍛錬（R6 §9.5）

// 費用は二次増加を採用しない。四能力×複数人物ですでに巨大な sink がある。
//   cost = 2_000 + 100 * floor(L / 10)
export function trainingCost(level) {
  const current = BigInt(Math.max(0, Math.floor(level ?? 0)));
  return 2_000n + 100n * (current / 10n);
}

// **常に base stat へ合計倍率を掛ける。**買った順や save/load で複利差を作らない。
export function trainedStat(baseStat, level) {
  const safeLevel = Math.max(0, Math.floor(level ?? 0));
  return roundHalfUpDiv(baseStat * (BPS + 10 * safeLevel), BPS);
}

// その能力の次の一段で、丸め後の整数が実際に増える level。
// **効果が見えないことを隠さない**（R6 §9.5）。
export function nextVisibleTrainingLevel(baseStat, level) {
  const current = trainedStat(baseStat, level);
  for (let step = Math.max(0, Math.floor(level ?? 0)) + 1; step <= (level ?? 0) + 2_000; step += 1) {
    if (trainedStat(baseStat, step) > current) return step;
  }
  return null;
}

// ============================================================ 永続投資（R6 §9.3）
//
// **Phase B が持つ category は R6 §17.2 が挙げたものだけ。**
// blueprint_capacity と appraisal は Phase C、character は Phase D。
// 空の実装を先に置かない（R7 §4.3）。
//
// SkillPack は4つとも最初から解禁済みにする。買える pack が無いのに
// category だけ置くと、画面に「常に買えない行」が出る。6個目以降を足すときに開く。
export const META_UPGRADES = Object.freeze([
  Object.freeze({
    id: "starting_supplies",
    category: "starting_supplies",
    displayName: "開始補給",
    maxLevel: 2,
    costs: Object.freeze(["12000", "60000"]),
    describeLevel: (level) => `遠征開始時の補給 ${3 + level}（上限5）`,
  }),
  ...EQUIPMENT_GROUPS.filter((group) => !group.startsUnlocked).map((group) => Object.freeze({
    id: "equipment_pool." + group.id,
    category: "equipment_pool",
    displayName: group.displayName,
    maxLevel: 1,
    costs: Object.freeze([group.cost]),
    unlocks: group.equipmentIds,
    describeLevel: () => group.equipmentIds.length + "品が報酬 pool へ加わる",
  })),
]);

// R6 §6.6 — 第4枠は**人物ごとの**永続投資。全小隊が一度に複雑化しないようにする。
export const SLOT_UPGRADE_COSTS = Object.freeze({ active: "30000", reactive: "60000" });
export const SLOT_UPGRADE_PREFIX = Object.freeze({ active: "slot_active_4", reactive: "slot_reactive_4" });

export function slotUpgradeId(kind, characterId) {
  return SLOT_UPGRADE_PREFIX[kind] + "." + characterId;
}

const META_UPGRADE_BY_ID = Object.fromEntries(META_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

export function metaUpgradeDef(id) {
  return META_UPGRADE_BY_ID[id] ?? null;
}

export function upgradeLevel(profile, id) {
  return Math.max(0, Math.floor(profile?.metaUpgradeLevels?.[id] ?? 0));
}

// 次の一段の費用。買い切ったら null（「買えない」と「0で買える」を混ぜない）。
export function upgradeCost(profile, id) {
  if (id.startsWith(SLOT_UPGRADE_PREFIX.active)) {
    return upgradeLevel(profile, id) >= 1 ? null : parseFunds(SLOT_UPGRADE_COSTS.active);
  }
  if (id.startsWith(SLOT_UPGRADE_PREFIX.reactive)) {
    return upgradeLevel(profile, id) >= 1 ? null : parseFunds(SLOT_UPGRADE_COSTS.reactive);
  }
  const def = metaUpgradeDef(id);
  if (!def) return null;
  const level = upgradeLevel(profile, id);
  if (def.maxLevel !== undefined && level >= def.maxLevel) return null;
  return parseFunds(def.costs[Math.min(level, def.costs.length - 1)]);
}

// ============================================================ ProfileState（R6 §4.1）

const CHARACTER_IDS = Object.keys(PLAYABLE_CONTENT.characters);

function freshCharacterProfile(characterId) {
  return {
    characterId,
    trainingLevels: { might: 0, focus: 0, guard: 0, vitality: 0 },
    storyFlags: [],
  };
}

function freshCampaignProgress() {
  // R8 §1.1 / §3.2 — 「最高clear Stage」は永続する。難易度 rank とは
  // 別の軸なので regionProgress の highestClearedDifficulty とは混ぜない
  // （R8 Implementation Phase 0 の migration 対応表を参照）。
  return { highestClearedStageSequence: -1, clearedStageSequences: [] };
}

export function newProfile() {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    profileId: null,
    characters: Object.fromEntries(CHARACTER_IDS.map((id) => [id, freshCharacterProfile(id)])),
    unlockedPackIds: SKILL_PACKS.map((pack) => pack.id),
    metaUpgradeLevels: {},
    activityFunds: "0",
    activityFundsLifetimeEarned: "0",
    regionProgress: {
      [REGION.id]: { highestClearedDifficulty: -1, clearedRanks: [], runsFinished: 0 },
    },
    campaignProgress: {
      [REGION.id]: freshCampaignProgress(),
    },
    purchases: [],
    settledRunIds: [],
  };
}

// **未知の欄は落とし、足りない欄は生やす。**version 不一致を黙って読み飛ばさない
// （R6 §16）ので、schemaVersion が違うものは新規として扱い、
// 拾える進行（活動資金・鍛錬・購入）だけを移す。
export function normalizeProfile(saved) {
  const profile = newProfile();
  if (!saved || typeof saved !== "object") return profile;
  profile.profileId = typeof saved.profileId === "string" ? saved.profileId : null;
  profile.activityFunds = fundsToString(saved.activityFunds);
  profile.activityFundsLifetimeEarned = fundsToString(saved.activityFundsLifetimeEarned);
  for (const id of CHARACTER_IDS) {
    const levels = saved.characters?.[id]?.trainingLevels;
    if (!levels) continue;
    for (const stat of TRAINABLE_STATS) {
      const level = Number(levels[stat]);
      if (Number.isFinite(level) && level >= 0) {
        profile.characters[id].trainingLevels[stat] = Math.floor(level);
      }
    }
  }
  if (saved.metaUpgradeLevels && typeof saved.metaUpgradeLevels === "object") {
    for (const [id, level] of Object.entries(saved.metaUpgradeLevels)) {
      const known = metaUpgradeDef(id)
        || id.startsWith(SLOT_UPGRADE_PREFIX.active)
        || id.startsWith(SLOT_UPGRADE_PREFIX.reactive);
      if (!known) continue;
      const value = Number(level);
      if (Number.isFinite(value) && value > 0) profile.metaUpgradeLevels[id] = Math.floor(value);
    }
  }
  const progress = saved.regionProgress?.[REGION.id];
  if (progress) {
    const highest = Number(progress.highestClearedDifficulty);
    profile.regionProgress[REGION.id].highestClearedDifficulty =
      Number.isFinite(highest) ? Math.max(-1, Math.min(MAX_DIFFICULTY_RANK, Math.floor(highest))) : -1;
    profile.regionProgress[REGION.id].clearedRanks = Array.isArray(progress.clearedRanks)
      ? [...new Set(progress.clearedRanks.filter((rank) => Number.isInteger(rank) && rank >= 0))]
      : [];
    const runs = Number(progress.runsFinished);
    profile.regionProgress[REGION.id].runsFinished = Number.isFinite(runs) ? Math.max(0, Math.floor(runs)) : 0;
  }
  // R8 Implementation Phase 1 — campaign stage 進行。旧 save には存在しない欄
  // なので、未クリアから始まる（difficulty rank からの自動換算はしない。
  // R8_IMPLEMENTATION_PHASE0_FREEZE.md §2 の判断）。
  const campaignProgress = saved.campaignProgress?.[REGION.id];
  if (campaignProgress) {
    const highestStage = Number(campaignProgress.highestClearedStageSequence);
    profile.campaignProgress[REGION.id].highestClearedStageSequence = Number.isFinite(highestStage)
      ? Math.max(-1, Math.min(MAX_CAMPAIGN_STAGE_SEQUENCE, Math.floor(highestStage)))
      : -1;
    profile.campaignProgress[REGION.id].clearedStageSequences = Array.isArray(campaignProgress.clearedStageSequences)
      ? [...new Set(campaignProgress.clearedStageSequences.filter((seq) => Number.isInteger(seq) && seq >= 0))]
      : [];
  }
  profile.purchases = Array.isArray(saved.purchases) ? saved.purchases.slice(-50) : [];
  profile.settledRunIds = Array.isArray(saved.settledRunIds)
    ? saved.settledRunIds.filter((id) => typeof id === "string").slice(-200)
    : [];
  return profile;
}

// R6 §17.2 — 旧 save（Phase A の平たい meta）からの移行。
//
// **旧 save の永続技能点と永続解禁は、Phase B では run 内の資源になった**
// （R6 §5.3 が「8人全員へ永続技能点+2」を削除した）。持ち越せる意味が無いので
// profile へは積まない。代わりに、これまで配った技能点を活動資金へ換算して返す。
// 捨てずに換えるのは、作者の遊んだ分が消えたように見えないため。
//
//   技能点1 = 通常戦一勝の 1/2 = 50
export const LEGACY_SKILL_POINT_VALUE = 50;

export function migrateLegacyProfile(legacyMeta) {
  const profile = newProfile();
  if (!legacyMeta || typeof legacyMeta !== "object") return { profile, converted: 0n, note: null };
  let points = 0n;
  for (const value of Object.values(legacyMeta.skillPoints ?? {})) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) points += BigInt(Math.floor(number));
  }
  const converted = points * BigInt(LEGACY_SKILL_POINT_VALUE);
  profile.activityFunds = converted.toString();
  profile.activityFundsLifetimeEarned = converted.toString();
  return {
    profile,
    converted,
    note: points > 0n
      ? `旧 save の技能点 ${points} 点を活動資金 ${formatFunds(converted)} へ換算しました。`
      : null,
  };
}

// R6 §9.5 — 鍛錬を掛けた後の人物 stat。**base、level、合計 bps、丸め後**を全部返す。
// 画面も BattleInput も結果 log も、この一つの関数を読む。
export function characterStats(profile, characterId) {
  const definition = PLAYABLE_CONTENT.characters[characterId];
  if (!definition) return null;
  const levels = profile?.characters?.[characterId]?.trainingLevels ?? {};
  const base = {
    maxHp: definition.maxHp,
    might: definition.might ?? 0,
    focus: definition.focus ?? 0,
    guard: definition.guard ?? 0,
  };
  const stats = { ...base };
  const detail = {};
  for (const axis of TRAINABLE_STATS) {
    const level = Math.max(0, Math.floor(levels[axis] ?? 0));
    const target = TRAINING_STAT_TARGET[axis];
    stats[target] = trainedStat(base[target], level);
    detail[axis] = {
      level,
      bonusBps: 10 * level,
      base: base[target],
      value: stats[target],
      stat: target,
      nextVisibleLevel: nextVisibleTrainingLevel(base[target], level),
      cost: trainingCost(level).toString(),
    };
  }
  return { base, stats, training: Object.fromEntries(TRAINABLE_STATS.map((a) => [a, detail[a].level])), detail };
}

// R6 §6.6 — 基本 3/3/2、購入で active と reactive だけ4へ。
export function slotLimits(profile, characterId) {
  return {
    active: 3 + upgradeLevel(profile, slotUpgradeId("active", characterId)),
    reactive: 3 + upgradeLevel(profile, slotUpgradeId("reactive", characterId)),
    passive: 2,
    equipment: 2,
  };
}

// 報酬 pool に入っている装備。買った群だけが加わる。
export function unlockedEquipmentIds(profile) {
  const ids = [];
  for (const group of EQUIPMENT_GROUPS) {
    const unlocked = group.startsUnlocked || upgradeLevel(profile, "equipment_pool." + group.id) > 0;
    if (unlocked) ids.push(...group.equipmentIds);
  }
  return ids;
}

// ---------------------------------------------------------------- 購入 transaction
//
// R6 §9.3 の MetaPurchase。**残高・前後・費用を1件で残す。**
// 「買ったのに増えていない」を後から追えるようにする。
export function purchaseUpgrade(profile, upgradeId, options = {}) {
  const cost = upgradeCost(profile, upgradeId);
  if (cost === null) return { ok: false, reason: "これ以上は買えません。" };
  const balance = parseFunds(profile.activityFunds);
  if (balance < cost) {
    return { ok: false, reason: `活動資金が足りません（不足 ${formatFunds(cost - balance)}）。` };
  }
  const fromLevel = upgradeLevel(profile, upgradeId);
  const next = structuredClone(profile);
  next.metaUpgradeLevels[upgradeId] = fromLevel + 1;
  next.activityFunds = (balance - cost).toString();
  const purchase = {
    purchaseId: options.purchaseId ?? `p_${upgradeId}_${fromLevel + 1}`,
    upgradeId,
    fromLevel,
    toLevel: fromLevel + 1,
    cost: cost.toString(),
    balanceBefore: balance.toString(),
    balanceAfter: (balance - cost).toString(),
  };
  next.purchases = [...(next.purchases ?? []), purchase].slice(-50);
  return { ok: true, profile: next, purchase };
}

// 鍛錬は level 上限が無いので metaUpgradeLevels ではなく CharacterProfile に置く
// （R6 §4.1）。購入の記録の形は上と同じにする。
export function purchaseTraining(profile, characterId, axis) {
  if (!TRAINABLE_STATS.includes(axis)) return { ok: false, reason: "その能力は鍛錬できません。" };
  const character = profile.characters?.[characterId];
  if (!character) return { ok: false, reason: "その仲間が見つかりません。" };
  const fromLevel = Math.max(0, Math.floor(character.trainingLevels[axis] ?? 0));
  const cost = trainingCost(fromLevel);
  const balance = parseFunds(profile.activityFunds);
  if (balance < cost) {
    return { ok: false, reason: `活動資金が足りません（不足 ${formatFunds(cost - balance)}）。` };
  }
  const next = structuredClone(profile);
  next.characters[characterId].trainingLevels[axis] = fromLevel + 1;
  next.activityFunds = (balance - cost).toString();
  const purchase = {
    purchaseId: `t_${characterId}_${axis}_${fromLevel + 1}`,
    upgradeId: `training.${axis}.${characterId}`,
    fromLevel,
    toLevel: fromLevel + 1,
    cost: cost.toString(),
    balanceBefore: balance.toString(),
    balanceAfter: (balance - cost).toString(),
  };
  next.purchases = [...(next.purchases ?? []), purchase].slice(-50);
  return { ok: true, profile: next, purchase };
}

// ============================================================ 難易度（R6 §9.6）

export function availableDifficulties(profile, regionId = REGION.id) {
  const highest = profile?.regionProgress?.[regionId]?.highestClearedDifficulty ?? -1;
  const top = Math.min(MAX_DIFFICULTY_RANK, Math.max(0, highest + 1));
  return Array.from({ length: top + 1 }, (_, rank) => rank);
}

export function isDifficultyUnlocked(profile, rank, regionId = REGION.id) {
  return availableDifficulties(profile, regionId).includes(rank);
}

// ============================================================ Campaign Stage 解禁（R8 §3.1, §4）
//
// R8 §3.1 — 「Campaign Stageは一つ前のStage clearで順に解禁し、活動資金で買えず、飛ばせない。」
// availableDifficulties と同じ形にする（活動資金で買えない不変条件を共有する）。
export function availableCampaignStages(profile, regionId = REGION.id) {
  const highest = profile?.campaignProgress?.[regionId]?.highestClearedStageSequence ?? -1;
  const top = Math.min(MAX_CAMPAIGN_STAGE_SEQUENCE, Math.max(0, highest + 1));
  return Array.from({ length: top + 1 }, (_, sequence) => sequence);
}

export function isCampaignStageUnlocked(profile, sequence, regionId = REGION.id) {
  return availableCampaignStages(profile, regionId).includes(sequence);
}

// ============================================================ Manifest（R6 §5.2）

export function makeManifest(seed, profile) {
  const unlocked = SKILL_PACKS
    .filter((pack) => (profile?.unlockedPackIds ?? []).includes(pack.id))
    .map((pack) => pack.id);
  const pool = unlocked.length ? unlocked : SKILL_PACKS.map((pack) => pack.id);
  // R6 §5.2 — pack が6個以上になったら候補を3つ出して選ばせる。
  // 4個の今は seed が3つを選ぶだけ。**pool dilution を避けるため、
  // 解禁済みが増えても一遠征の有効 pack 数は増やさない。**
  const enabled = seededShuffle(pool, seedKey(seed, "manifest", 0))
    .slice(0, PACKS_PER_MANIFEST)
    .sort((a, b) => pool.indexOf(a) - pool.indexOf(b));
  return {
    manifestVersion: MANIFEST_VERSION,
    seed: String(seed),
    regionId: REGION.id,
    baselineSkillIds: [...BASELINE_ACTIVE_SKILL_IDS],
    enabledPackIds: enabled,
    enabledAffixFamilyIds: [],
    enemyFamilyIds: [...REGION.enemyFamilyIds],
    actBossIds: [...REGION.actBossIds],
    actBossLawIds: [...REGION.actBossLawIds],
    regionLawIds: [...REGION.regionLawIds],
    rewardTableId: REGION.rewardTableId,
  };
}

export function manifestSkillIds(manifest) {
  return skillIdsForPacks(manifest?.enabledPackIds ?? []);
}

// ============================================================ RunState（R6 §4.2）

export const MAX_SUPPLIES = 5;
export const INVENTORY_LIMIT = 12;
export const RUN_SKILL_POINTS_PER_REWARD = 2;
// R6 §5.3 — 遠征開始時の技能点。0 から始めると第1戦の構成が組めないので、
// **開始時に一人2点**配る。遠征終了時に消える（R6 §5.3）。
export const STARTING_RUN_SKILL_POINTS = 2;

export function startingSupplies(profile, rank) {
  const base = difficultyDef(rank).startingSupplies;
  return Math.min(MAX_SUPPLIES, base + upgradeLevel(profile, "starting_supplies"));
}

// R8 §1.1 — Campaign は `options.campaignStageSequence` を渡して作る。
// 渡さなければ従来どおり Free / Endless の random manifest（`makeManifest`）を使う。
// 両経路は同じ RunState 形を返す（campaign 専用の欄を増やすだけで、
// Free / Endless の既存出力は変えない）。
export function newRun(profile, options = {}) {
  const rank = Math.max(0, Math.min(MAX_DIFFICULTY_RANK, Math.floor(options.difficulty ?? 0)));
  const roster = [...(options.roster ?? [])];
  const runSeed = String(options.runSeed ?? "run");
  const isCampaign = options.campaignStageSequence !== undefined && options.campaignStageSequence !== null;
  const campaignStageSequence = isCampaign
    ? Math.max(0, Math.min(MAX_CAMPAIGN_STAGE_SEQUENCE, Math.floor(options.campaignStageSequence)))
    : null;
  const manifest = isCampaign
    ? campaignManifestForStage(campaignStageSequence, runSeed)
    : makeManifest(runSeed, profile);
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: String(options.runId ?? runSeed),
    runSeed,
    regionId: REGION.id,
    campaignStageSequence,
    difficulty: rank,
    manifest,
    encounterIndex: 1,
    act: 1,
    supplies: startingSupplies(profile, rank),
    roster,
    formation: { ...(options.formation ?? {}) },
    runSkillPoints: Object.fromEntries(roster.map((id) => [id, STARTING_RUN_SKILL_POINTS])),
    runUnlockedSkills: { ...(options.unlockedSkills ?? {}) },
    loadout: options.loadout ?? null,
    inventory: [...STARTER_EQUIPMENT_IDS],
    scrap: 0,
    // R6 §12.1 — 偵察は**次の幕**を開ける。いまいる幕は補給なしで見えるので、
    // ここは空で始まる（第1幕が入っていると、第2幕が最初から見える意味になる）。
    scoutedActs: [],
    rerollsUsed: {},
    retries: {},
    results: [],
    fundLedger: newFundLedger(rank),
    // R8 §1.5 / §10 — HP は遠征内で持ち越す。遠征開始時は満タンから始める。
    // 4戦目・8戦目 boss 勝利後の全回復と、通常・精鋭戦後の持ち越しは
    // commitBattleResult が扱う。
    currentHp: Object.fromEntries(
      roster.map((id) => [id, characterStats(profile, id)?.stats.maxHp ?? 0]),
    ),
    status: "active",
    startedAt: options.startedAt ?? null,
  };
}

// ============================================================ 技能点（R6 §5.3）

export function runSkillPoints(run, characterId) {
  return Math.max(0, Math.floor(run?.runSkillPoints?.[characterId] ?? 0));
}

export function grantRunSkillPoints(run, characterId, amount = RUN_SKILL_POINTS_PER_REWARD) {
  const next = { ...run, runSkillPoints: { ...run.runSkillPoints } };
  next.runSkillPoints[characterId] = runSkillPoints(run, characterId) + amount;
  return next;
}

// 遠征内の解禁。**manifest が有効にした技能しか解禁できない。**
export function unlockRunSkill(run, characterId, node) {
  if (!node) return { ok: false, reason: "その技能が見つかりません。" };
  const available = manifestSkillIds(run.manifest).all;
  if (!available.includes(node.skillId)) {
    return { ok: false, reason: "この遠征の技能パックには入っていません。" };
  }
  const unlocked = run.runUnlockedSkills?.[characterId] ?? [];
  if (unlocked.includes(node.skillId)) return { ok: false, reason: "すでに解禁されています。" };
  if (!node.requires.every((required) => unlocked.includes(required))) {
    return { ok: false, reason: "前提技能がまだ解禁されていません。" };
  }
  if (runSkillPoints(run, characterId) < node.cost) {
    return { ok: false, reason: "技能点が足りません。" };
  }
  const next = {
    ...run,
    runSkillPoints: { ...run.runSkillPoints },
    runUnlockedSkills: { ...run.runUnlockedSkills },
  };
  next.runSkillPoints[characterId] = runSkillPoints(run, characterId) - node.cost;
  next.runUnlockedSkills[characterId] = [...unlocked, node.skillId];
  return { ok: true, run: next };
}

// R6 §17.2 — run skill reset。**使った点をそのまま戻す**（罰を付けない）。
// 遠征の途中で構成を組み替えられないと、報酬で得た技能が死に札になる。
export function resetRunSkills(run, characterId, initialSkills) {
  const unlocked = run.runUnlockedSkills?.[characterId] ?? [];
  const base = new Set(initialSkills ?? []);
  const spent = unlocked
    .filter((skillId) => !base.has(skillId))
    .reduce((total, skillId) => total + (skillCostOf(run, skillId) ?? 0), 0);
  const next = {
    ...run,
    runSkillPoints: { ...run.runSkillPoints },
    runUnlockedSkills: { ...run.runUnlockedSkills },
  };
  next.runSkillPoints[characterId] = runSkillPoints(run, characterId) + spent;
  next.runUnlockedSkills[characterId] = [...base];
  return { run: next, refunded: spent };
}

let skillCostLookup = null;
export function registerSkillCosts(nodes) {
  skillCostLookup = Object.fromEntries(nodes.map((node) => [node.skillId, node.cost]));
}
function skillCostOf(run, skillId) {
  return skillCostLookup?.[skillId] ?? 0;
}

// ============================================================ 補給（R6 §12.1）

// R8 §10.2 — 補給の四用途。retry、reward reroll、偵察、野営治療は
// 同じ有限の補給を奪い合う（R8 §1.5 の不変条件）。
export const SUPPLY_USES = Object.freeze({
  retry: "敗北した戦闘へ、編成を変えて再挑戦する",
  reroll: "報酬4候補を一度だけ引き直す",
  scout: "次の幕の通常戦の個体編成を先に見る",
  camp: "野営で集中治療・全体手当・蘇生のいずれかを行う",
});

export function spendSupply(run, use) {
  if (!Object.hasOwn(SUPPLY_USES, use)) return { ok: false, reason: "その使い道はありません。" };
  if ((run.supplies ?? 0) < 1) return { ok: false, reason: "補給がありません。" };
  return { ok: true, run: { ...run, supplies: run.supplies - 1 } };
}

export function gainSupply(run, amount = 1) {
  return { ...run, supplies: Math.min(MAX_SUPPLIES, (run.supplies ?? 0) + amount) };
}

// ============================================================ 野営治療（R8 §9.2, §10.2）
//
// **補給1を消費する、遠征中に自動で戻らない治療。**round経過や毎戦の
// 全回復では戻らない（R8 §8.1 の anti-stall 不変条件）。数値は R8 §9.2 の
// 初期比較候補をそのまま採用した未調整値（作者プレイ前の soft data）。
export const CAMP_TREATMENTS = Object.freeze({
  concentrated: Object.freeze({
    id: "concentrated", displayName: "集中治療", targetCount: 1, healBps: 4_000, revive: false,
    summary: "一人をmaxHpの40%回復する。tank・背水役等、一人へ損傷を集める構成向け。",
  }),
  full_party: Object.freeze({
    id: "full_party", displayName: "全体手当", targetCount: "all", healBps: 1_200, revive: false,
    summary: "生存者全員をmaxHpの12%回復する。damage分散構成向け。",
  }),
  revive: Object.freeze({
    id: "revive", displayName: "蘇生", targetCount: 1, healBps: 2_500, revive: true,
    summary: "戦闘不能者一人をmaxHpの25%で復帰させる。roster欠損を戻す高価値用途。",
  }),
});

// 補給1を消費し、選んだ治療を適用する。**治療可能な損傷0の対象へは空撃ちしない**
// （R8 §8.1「full HPまたは治療可能な損傷0の対象へ空撃ちし...技能を許可しない」と
// 同じ理由。ここは battle engine の外なので healing_applied / excess_healing
// イベントは無いが、無駄打ちで補給を溶かさない意味は同じ）。
export function campTreat(run, profile, treatmentId, targetCharacterIds = []) {
  const treatment = CAMP_TREATMENTS[treatmentId];
  if (!treatment) return { ok: false, reason: "その治療はありません。" };
  const targets = treatment.targetCount === "all"
    ? [...run.roster]
    : targetCharacterIds.slice(0, treatment.targetCount);
  if (targets.length === 0) return { ok: false, reason: "対象がいません。" };

  const currentHp = { ...run.currentHp };
  const applicable = targets.filter((characterId) => {
    const hp = currentHp[characterId] ?? 0;
    const maxHp = characterStats(profile, characterId)?.stats.maxHp ?? 0;
    return treatment.revive ? hp <= 0 : hp > 0 && hp < maxHp;
  });
  if (applicable.length === 0) return { ok: false, reason: "治療できる対象がいません。" };

  const spend = spendSupply(run, "camp");
  if (!spend.ok) return spend;

  for (const characterId of applicable) {
    const maxHp = characterStats(profile, characterId)?.stats.maxHp ?? 0;
    const healAmount = roundHalfUpDiv(maxHp * treatment.healBps, BPS);
    const before = treatment.revive ? 0 : (currentHp[characterId] ?? 0);
    currentHp[characterId] = Math.min(maxHp, before + healAmount);
  }
  return { ok: true, run: { ...spend.run, currentHp }, treated: applicable };
}

// ============================================================ HP持ち越しと次戦commit（R8 §8, §10）

// R8 §10.1 — 4戦目・8戦目のboss勝利後だけ拠点で全回復する。12戦目は遠征終了。
export function isActBossFullHealIndex(encounterIndex) {
  return encounterIndex === 4 || encounterIndex === 8;
}

function endingHpFromBattleResult(battleResult, roster) {
  const hp = {};
  for (const characterId of roster) {
    const actor = battleResult.actors.find((entry) => entry.instanceId === "a_" + characterId);
    hp[characterId] = actor ? actor.hp : 0;
  }
  return hp;
}

// R8 §10.4 — BattleCarrySnapshot。**勝利時だけ一度だけ commit する。**
// 敗北時は開始前 snapshot（= 現在の run.currentHp）へ戻すだけで、何も変更しない
// （commitBattleResult を呼ぶ前の run.currentHp は一切変更していないので、
// 「戻す」は「何もしない」と同じ。retry も同じ理由で安全）。
// preview（`previewNextBattle`, playable-battles.mjs）はこの関数を呼ばない。
export function commitBattleResult(profile, run, encounterIndex, battleResult) {
  const startingHp = { ...run.currentHp };
  const won = battleResult.result === "win";
  if (!won) {
    return {
      run,
      snapshot: { startingHp, endingHp: startingHp, treatmentChargesSpent: 0, suppliesSpent: 0, committed: false },
    };
  }
  const rawEndingHp = endingHpFromBattleResult(battleResult, run.roster);
  const endingHp = isActBossFullHealIndex(encounterIndex)
    ? Object.fromEntries(run.roster.map((id) => [id, characterStats(profile, id)?.stats.maxHp ?? 0]))
    : rawEndingHp;
  return {
    run: { ...run, currentHp: endingHp },
    snapshot: { startingHp, endingHp, treatmentChargesSpent: 0, suppliesSpent: 0, committed: true },
  };
}

// R6 §10 — inventory は12品。**13品目になるときは、その場で一品を分解するか捨てる。**
// 分解は遠征内通貨ではなく scrap を生み、scrap 2 で補給1へ替えられる。
export const SCRAP_PER_SUPPLY = 2;

export function dismantle(run, equipmentId) {
  if (!(run.inventory ?? []).includes(equipmentId)) {
    return { ok: false, reason: "その装備は持ち物にありません。" };
  }
  const next = {
    ...run,
    inventory: run.inventory.filter((id) => id !== equipmentId),
    scrap: (run.scrap ?? 0) + 1,
    loadout: structuredClone(run.loadout ?? {}),
  };
  for (const characterId of Object.keys(next.loadout.equipment ?? {})) {
    next.loadout.equipment[characterId] = (next.loadout.equipment[characterId] ?? [])
      .filter((id) => id !== equipmentId);
  }
  return { ok: true, run: next };
}

export function convertScrap(run) {
  if ((run.scrap ?? 0) < SCRAP_PER_SUPPLY) {
    return { ok: false, reason: "scrap が足りません（" + SCRAP_PER_SUPPLY + "で補給1）。" };
  }
  if ((run.supplies ?? 0) >= MAX_SUPPLIES) return { ok: false, reason: "補給が上限です。" };
  return { ok: true, run: gainSupply({ ...run, scrap: run.scrap - SCRAP_PER_SUPPLY }, 1) };
}

// ============================================================ 敵編成（R6 §11.2 / §13.2）
//
// **rank 0 は budget をちょうど使い切る設計なので、増援も余り変異も出ない。**
// rank が budget を足した分だけ、まず増援（5体まで）、次に変異が増える。
// 精鋭とボスへの保証変異は budget とは別枠（R6 §13.2 の rank 2 / rank 4）。

function applyPatches(base, patches) {
  const totals = { maxHp: { bps: BPS, flat: 0 }, might: { bps: BPS, flat: 0 }, focus: { bps: BPS, flat: 0 }, guard: { bps: BPS, flat: 0 } };
  for (const patch of patches) {
    for (const [stat, change] of Object.entries(patch ?? {})) {
      if (!totals[stat]) continue;
      if (change.bps) totals[stat].bps += change.bps - BPS;
      if (change.flat) totals[stat].flat += change.flat;
    }
  }
  const out = {};
  for (const [stat, value] of Object.entries(base)) {
    out[stat] = roundHalfUpDiv(value * totals[stat].bps, BPS) + totals[stat].flat;
  }
  return out;
}

function enemyBaseStats(enemyActorId) {
  const definition = PLAYABLE_CONTENT.enemyActors[enemyActorId];
  return {
    maxHp: definition.maxHp,
    might: definition.might ?? 0,
    focus: definition.focus ?? 0,
    guard: definition.guard ?? 0,
  };
}

function addMutation(unit, mutationId) {
  if (unit.mutations.includes(mutationId)) return false;
  if (unit.mutations.length >= MAX_MUTATIONS_PER_UNIT) return false;
  unit.mutations.push(mutationId);
  return true;
}

export function composeEncounter(index, difficultyRank) {
  const def = expeditionEncounter(index);
  const difficulty = difficultyDef(difficultyRank);
  const units = def.enemies.map((enemy, slot) => ({
    instanceId: `x${index}_${slot}`,
    enemyActorId: enemy.enemyActorId,
    position: enemy.position,
    boss: enemy.boss === true,
    mutations: [],
    threatCost: ENEMY_THREAT_COST[enemy.enemyActorId] ?? 0,
    reinforcement: false,
  }));

  const budget = def.threatBudget + difficulty.threatBudgetDelta;
  let spent = def.threatBudget;

  // 1. 余り budget はまず増援（枠が残っているときだけ）。
  for (const reinforcement of def.reinforcements) {
    if (units.length >= 5) break;
    const cost = ENEMY_THREAT_COST[reinforcement.enemyActorId] ?? 0;
    if (spent + cost > budget) continue;
    units.push({
      instanceId: `x${index}_r${units.length}`,
      enemyActorId: reinforcement.enemyActorId,
      position: reinforcement.position,
      boss: false,
      mutations: [],
      threatCost: cost,
      reinforcement: true,
    });
    spent += cost;
  }

  // 2. まだ余っていれば変異へ。**固定順**なので、rank を上げたときに
  //    「何が増えたのか」を作者が一目で言える。
  let added = true;
  while (added) {
    added = false;
    for (const mutationId of MUTATION_SPEND_ORDER) {
      const cost = ENEMY_MUTATIONS[mutationId].threatCost;
      if (spent + cost > budget) continue;
      for (const unit of units) {
        if (!addMutation(unit, mutationId)) continue;
        spent += cost;
        added = true;
        break;
      }
      if (added) break;
    }
  }

  // 3. rank の保証変異。budget 外（R6 §13.2 の rank 2 / rank 4 はそう書いてある）。
  const guaranteed = def.kind === "elite" ? difficulty.eliteMutationCount
    : def.kind === "boss" ? difficulty.bossMutationCount : 0;
  for (let n = 0; n < guaranteed; n += 1) {
    const targets = def.kind === "boss" ? units.filter((unit) => unit.boss) : units;
    let placed = false;
    for (const mutationId of MUTATION_SPEND_ORDER) {
      for (const unit of targets) {
        if (!addMutation(unit, mutationId)) continue;
        placed = true;
        break;
      }
      if (placed) break;
    }
  }

  // 4. stat を確定する。boss law は常に載る（rank 0 でも）。
  const law = def.bossLawId ? BOSS_LAWS[def.bossLawId] : null;
  const enemies = units.map((unit) => {
    const base = enemyBaseStats(unit.enemyActorId);
    const patches = unit.mutations.map((id) => ENEMY_MUTATIONS[id].patch);
    if (unit.boss && law) patches.unshift(law.patch);
    const stats = applyPatches(base, patches);
    return {
      instanceId: unit.instanceId,
      enemyActorId: unit.enemyActorId,
      position: unit.position,
      stats,
      mutations: [...unit.mutations],
      boss: unit.boss,
      reinforcement: unit.reinforcement,
      threatCost: unit.threatCost,
      baseStats: base,
    };
  });

  const maxRounds = Math.max(
    1,
    def.maxRounds + (def.kind === "normal" ? difficulty.normalMaxRoundsDelta : 0),
  );

  return {
    index,
    act: def.act,
    kind: def.kind,
    name: def.name,
    description: def.description,
    bossLawId: def.bossLawId ?? null,
    bossLaw: law,
    maxRounds,
    budget,
    spentThreat: spent,
    enemies,
  };
}

// ============================================================ 報酬（R6 §5.3）
//
// 通常戦勝利後は4候補から1つ。**活動資金はこの4候補に入らない**
// （補給や技能点を選んでも、資金の獲得量は減らない）。

export const REWARD_EQUIPMENT_SLOTS = 2;

export function rewardOffer(run, profile, encounterIndex, rerollIndex = 0) {
  const owned = new Set(run.inventory ?? []);
  const pool = unlockedEquipmentIds(profile).filter((id) => !owned.has(id));
  const equipment = [];
  for (let slot = 0; slot < REWARD_EQUIPMENT_SLOTS; slot += 1) {
    const key = seedKey(run.runSeed, "reward", encounterIndex, rerollIndex, slot);
    const candidates = pool.filter((id) => !equipment.includes(id));
    if (!candidates.length) break;
    const pick = candidates[Math.floor(makeRng(key)() * candidates.length)];
    equipment.push(pick);
  }
  const offers = equipment.map((equipmentId) => ({ type: "equipment", equipmentId }));
  offers.push({ type: "skill_points", amount: RUN_SKILL_POINTS_PER_REWARD });
  offers.push({ type: "supplies", amount: 1 });
  return offers;
}

// ============================================================ 活動資金の仮計上（R6 §9.2）

export const ENCOUNTER_BASE_FUNDS = Object.freeze({ normal: 100, elite: 180, boss: 320 });
export const DISTANCE_FUNDS_PER_ENCOUNTER = 25;
export const FULL_RUN_BONUS = 600;
export const FIRST_CLEAR_BASE = 800;
export const FIRST_CLEAR_PER_RANK = 100;

function newFundLedger(rank) {
  return {
    clearedEncounterKeys: [],
    clearedEncounterBase: 0,
    highestClearedEncounter: 0,
    outcomeBonus: 0,
    firstClearBonus: 0,
    difficultyMultiplierBps: BPS + rank * 1_000,
    provisionalTotal: 0,
    settled: false,
  };
}

function ledgerTotal(ledger) {
  const raw = ledger.clearedEncounterBase
    + ledger.highestClearedEncounter * DISTANCE_FUNDS_PER_ENCOUNTER
    + ledger.outcomeBonus
    + ledger.firstClearBonus;
  return Math.floor((raw * ledger.difficultyMultiplierBps) / BPS);
}

// **retry しても同じ encounter の撃破 base は一度だけ**（R6 §9.2）。
// 鍵は region と encounter で作る。run の中で一意であればよい。
export function recordEncounterCleared(run, index) {
  const def = expeditionEncounter(index);
  const key = `${run.regionId}:${index}`;
  const ledger = { ...run.fundLedger, clearedEncounterKeys: [...run.fundLedger.clearedEncounterKeys] };
  if (!ledger.clearedEncounterKeys.includes(key)) {
    ledger.clearedEncounterKeys.push(key);
    ledger.clearedEncounterBase += ENCOUNTER_BASE_FUNDS[def.kind] ?? 0;
  }
  ledger.highestClearedEncounter = Math.max(ledger.highestClearedEncounter, index);
  ledger.provisionalTotal = ledgerTotal(ledger);
  return { ...run, fundLedger: ledger };
}

// R8 §10.3 — 安全撤退を敗北と区別する。Blueprint archive 自体は Phase C 未実装
// なので、ここでは「今回の settlement は何件まで保存してよいか」という数値だけを
// 記録する（実際の保存は Phase C の仕事。R8 Implementation Phase 1 step 4
// 「安全撤退と敗北のBlueprint保存差を状態・精算へ追加する」の状態側だけを満たす）。
export const BLUEPRINT_SAVE_LIMIT = Object.freeze({ won: 2, retreat: 2, lost: 1 });

// R6 §9.2 / R8 §10.3 — 勝利・安全撤退・敗北のいずれかで**一度だけ**精算する。
// 二度目は黙って通さず、settled: false と理由を返す。
// outcome は "won" | "retreat" | "lost" のいずれか。
// **won と retreat のどちらも完走・初clear bonusは retreat には付かない**
// （R8 §10.3「ただし完走・初clear bonusなし」）。敗北時の活動資金没収は行わない
// （確定済みぶんは outcome を問わず持ち帰る。R8 §3.7）。
export function settleRun(profile, run, outcome) {
  if (run.fundLedger.settled) {
    return { ok: false, reason: "この遠征はすでに精算されています。", profile, run };
  }
  if ((profile.settledRunIds ?? []).includes(run.runId)) {
    return { ok: false, reason: "この runId はすでに精算されています。", profile, run };
  }
  const progress = profile.regionProgress?.[run.regionId]
    ?? { highestClearedDifficulty: -1, clearedRanks: [], runsFinished: 0 };
  const won = outcome === "won";
  const ledger = { ...run.fundLedger, clearedEncounterKeys: [...run.fundLedger.clearedEncounterKeys] };
  // R8 §3.7 — 12戦完走ボーナスも安全撤退には付かない（won 以外は全て0）。
  ledger.outcomeBonus = won ? FULL_RUN_BONUS : 0;
  const firstClear = won && !progress.clearedRanks.includes(run.difficulty);
  ledger.firstClearBonus = firstClear ? FIRST_CLEAR_BASE + FIRST_CLEAR_PER_RANK * run.difficulty : 0;
  const earned = ledgerTotal(ledger);
  ledger.provisionalTotal = earned;
  ledger.settled = true;

  const nextProfile = structuredClone(profile);
  nextProfile.activityFunds = (parseFunds(profile.activityFunds) + BigInt(earned)).toString();
  nextProfile.activityFundsLifetimeEarned =
    (parseFunds(profile.activityFundsLifetimeEarned) + BigInt(earned)).toString();
  const nextProgress = nextProfile.regionProgress[run.regionId]
    ?? (nextProfile.regionProgress[run.regionId] = { highestClearedDifficulty: -1, clearedRanks: [], runsFinished: 0 });
  nextProgress.runsFinished += 1;
  if (won) {
    // R6 §9.6 — rank N をクリアすると rank N+1 が開く。買えず、飛ばせない。
    nextProgress.clearedRanks = [...new Set([...nextProgress.clearedRanks, run.difficulty])].sort((a, b) => a - b);
    nextProgress.highestClearedDifficulty = Math.max(nextProgress.highestClearedDifficulty, run.difficulty);
  }
  // R8 §3.1 / §4 — campaign stage の既クリアは、difficulty rank とは別軸で進む。
  let unlockedCampaignStage = null;
  if (won && run.campaignStageSequence !== null && run.campaignStageSequence !== undefined) {
    const nextCampaignProgress = nextProfile.campaignProgress[run.regionId]
      ?? (nextProfile.campaignProgress[run.regionId] = freshCampaignProgress());
    const alreadyCleared = nextCampaignProgress.clearedStageSequences.includes(run.campaignStageSequence);
    nextCampaignProgress.clearedStageSequences =
      [...new Set([...nextCampaignProgress.clearedStageSequences, run.campaignStageSequence])].sort((a, b) => a - b);
    nextCampaignProgress.highestClearedStageSequence =
      Math.max(nextCampaignProgress.highestClearedStageSequence, run.campaignStageSequence);
    if (!alreadyCleared && run.campaignStageSequence < MAX_CAMPAIGN_STAGE_SEQUENCE) {
      unlockedCampaignStage = run.campaignStageSequence + 1;
    }
  }
  nextProfile.settledRunIds = [...(nextProfile.settledRunIds ?? []), run.runId].slice(-200);

  return {
    ok: true,
    profile: nextProfile,
    run: { ...run, fundLedger: ledger, status: outcome },
    settlement: {
      runId: run.runId,
      outcome,
      earned,
      firstClear,
      breakdown: {
        clearedEncounterBase: ledger.clearedEncounterBase,
        distance: ledger.highestClearedEncounter * DISTANCE_FUNDS_PER_ENCOUNTER,
        outcomeBonus: ledger.outcomeBonus,
        firstClearBonus: ledger.firstClearBonus,
        difficultyMultiplierBps: ledger.difficultyMultiplierBps,
      },
      balanceBefore: fundsToString(profile.activityFunds),
      balanceAfter: nextProfile.activityFunds,
      unlockedDifficulty: won && run.difficulty < MAX_DIFFICULTY_RANK
        && !(profile.regionProgress?.[run.regionId]?.clearedRanks ?? []).includes(run.difficulty)
        ? run.difficulty + 1
        : null,
      unlockedCampaignStage,
      // Phase C（Blueprint archive）実装までは「今回何件保存してよいか」の記録のみ。
      blueprintSaveLimit: BLUEPRINT_SAVE_LIMIT[outcome] ?? BLUEPRINT_SAVE_LIMIT.lost,
    },
  };
}

export { ENCOUNTERS_PER_RUN, MAX_DIFFICULTY_RANK };
