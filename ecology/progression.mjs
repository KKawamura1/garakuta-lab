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
//   - 鍛錬は speed / AP / RP / 技能の装着数 / 発火回数 / 優先順を上げない（R6 §9.5）。
//   - 永続値は 10進文字列で保存し、計算は bigint で行う（R6 §9.1）。

import {
  LIMITS,
  MANIFEST_VERSION,
  PROFILE_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
  TRAINABLE_STATS,
  TRAINING_STAT_TARGET,
} from "./schema.mjs";
import { roundHalfUpDiv, BPS } from "./values.mjs";
import { makeRng, seedKey, seededShuffle } from "./seeded.mjs";
import {
  BLUEPRINT_CAPACITY_COSTS,
  BLUEPRINT_CAPACITY_UPGRADE_ID,
  BLUEPRINT_MAX_CAPACITY,
  BLUEPRINT_SAVE_LIMIT,
  carryCapacity,
  manufactureCarried,
  newArchive,
  normalizeArchive,
  saveBlueprint,
} from "./blueprints.mjs";
import { AFFIX_FAMILIES, RARITIES } from "./content/affixes.mjs";
import { EquipmentGenerationError, generateEquipment, rollRarity } from "./equipment-gen.mjs";
import {
  BOSS_LAWS,
  ENCOUNTERS_PER_RUN,
  ENEMY_MUTATIONS,
  ENEMY_THREAT_COST,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  MAX_DIFFICULTY_RANK,
  MAX_MUTATIONS_PER_UNIT,
  MUTATION_SPEND_ORDER,
  PACKS_PER_MANIFEST,
  PLAYABLE_CONTENT,
  REGION,
  SKILL_PACKS,
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
// character は Phase D。空の実装を先に置かない（R7 §4.3）。
// blueprint_capacity と appraisal は Phase C で実装が付いたので開いた
// （R8 §3.7 の初期仕様、Implementation Phase 4 step 4/5）。
//
// SkillPack は4つとも最初から解禁済みにする。買える pack が無いのに
// category だけ置くと、画面に「常に買えない行」が出る。6個目以降を足すときに開く。
export const APPRAISAL_UPGRADE_ID = "appraisal";
export const APPRAISAL_COSTS = Object.freeze(["15000", "45000", "120000", "300000", "750000"]);

export const META_UPGRADES = Object.freeze([
  Object.freeze({
    id: "starting_supplies",
    category: "starting_supplies",
    displayName: "開始補給",
    maxLevel: 2,
    costs: Object.freeze(["12000", "60000"]),
    describeLevel: (level) => `遠征開始時の補給 ${3 + level}（上限5）`,
  }),
  // R8 §3.7 — Blueprint 持込枠。初期1、最大5。**買えるのは枠だけで、
  // 中身（どの Blueprint を持ち込むか）は archive の選択で決める。**
  Object.freeze({
    id: BLUEPRINT_CAPACITY_UPGRADE_ID,
    category: "blueprint_capacity",
    displayName: "Blueprint 持込枠",
    maxLevel: BLUEPRINT_CAPACITY_COSTS.length,
    costs: BLUEPRINT_CAPACITY_COSTS,
    describeLevel: (level) => `遠征開始時に持ち込める Blueprint ${carryCapacity(level)}件（上限 ${BLUEPRINT_MAX_CAPACITY}）`,
  }),
  // R8 §3.7 — 目利き。**情報を隠して売り直す仕組みにはしない**（R8 §11 の完全開示と
  // 衝突する）。装備の rarity roll を level+1 回引いて良い方を採る、
  // 「良い品を見つける目」として実装した。報酬の中身は最初から全部読める。
  Object.freeze({
    id: APPRAISAL_UPGRADE_ID,
    category: "appraisal",
    displayName: "目利き",
    maxLevel: APPRAISAL_COSTS.length,
    costs: APPRAISAL_COSTS,
    describeLevel: (level) => `装備の等級を ${level + 1} 回引いて良い方を採る`,
  }),
]);

// 旧 save が持つ固定装備 pool の購入履歴は、読み込み時だけ保持する。
// 現行の報酬経路では固定装備を提示しないため、購入対象としては再公開しない。
const LEGACY_META_UPGRADE_IDS = Object.freeze(["equipment_pool.group_repair"]);

// R18 — 技能の装着枠は廃止した。旧 save の購入履歴を読めるように ID と
// 定数は残すが、現行の購入画面へは戻さない。
export const SLOT_UPGRADE_COSTS = Object.freeze({ active: "30000", reactive: "60000" });
export const SLOT_UPGRADE_PREFIX = Object.freeze({ active: "slot_active_4", reactive: "slot_reactive_4" });

export function slotUpgradeId(kind, characterId) {
  return SLOT_UPGRADE_PREFIX[kind] + "." + characterId;
}

function characterIdFromSlotUpgrade(id) {
  for (const prefix of Object.values(SLOT_UPGRADE_PREFIX)) {
    if (id.startsWith(prefix + ".")) return id.slice(prefix.length + 1);
  }
  return null;
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
  const characterId = characterIdFromSlotUpgrade(id);
  // R18 — active / reactive の旧「第4枠」投資は、技能数無制限への移行後は
  // 新たに購入できない。値を保持するのは古い Profile の読み込み互換のため。
  if (characterId) return null;
  const def = metaUpgradeDef(id);
  if (!def) return null;
  const level = upgradeLevel(profile, id);
  if (def.maxLevel !== undefined && level >= def.maxLevel) return null;
  return parseFunds(def.costs[Math.min(level, def.costs.length - 1)]);
}

// ============================================================ ProfileState（R6 §4.1）

const CHARACTER_IDS = Object.keys(PLAYABLE_CONTENT.characters);

// R9 §2.1 — Campaign では、最初の二人から始めて Stage を一つクリアする
// たびに次の人物が一人だけ登場する。画面で全8人を定義していることと、
// プレイヤーが出会った人物を混ぜない。
const INITIAL_CAMPAIGN_CHARACTER_IDS = Object.freeze([
  ...campaignStageDef(0).castCharacterIds,
]);

export function availableCharacterIds(profile, regionId = REGION.id) {
  const progress = profile?.campaignProgress?.[regionId];
  const highest = Number.isFinite(Number(progress?.highestClearedStageSequence))
    ? Math.floor(Number(progress.highestClearedStageSequence))
    : -1;
  const introduced = new Set(INITIAL_CAMPAIGN_CHARACTER_IDS);
  // Stage N をクリアすると、次の Stage の joiningCharacterId が解禁される。
  const through = Math.min(MAX_CAMPAIGN_STAGE_SEQUENCE, highest + 1);
  for (let sequence = 1; sequence <= through; sequence += 1) {
    const joining = campaignStageDef(sequence).joiningCharacterId;
    if (joining) introduced.add(joining);
  }
  return CHARACTER_IDS.filter((id) => introduced.has(id));
}

export function isCharacterUnlocked(profile, characterId, regionId = REGION.id) {
  return availableCharacterIds(profile, regionId).includes(characterId);
}

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
    // R9 §2.1 — 初期2人だけが登場済み。残りは Stage の進行で増える。
    // normalizeProfile でも campaignProgress から再計算するので、旧R10 save
    // （この欄を持たない）も同じ解放状態へ戻せる。
    unlockedCharacterIds: [...INITIAL_CAMPAIGN_CHARACTER_IDS],
    purchases: [],
    settledRunIds: [],
    // R9 §8 — 物語の既読印。**Profile に置く**（遠征を捨てても、序盤の敗北を
    // もう一度見せられては困る）。
    storyFlags: [],
    // R8 §3.6 — Phase C。Blueprint archive は Profile 側の永続区画。
    // **所持上限は無い。**制限が掛かるのは遠征開始時の持込枠だけ。
    blueprints: newArchive(),
    // R8 §3.2 の「図鑑」。**遠征をまたいで残る、会った敵の記録。**
    // 遠征内の戦績（run.results）とは別物で、こちらは捨てた遠征のぶんも残る
    // （会ったことは、負けても取り消されない）。
    bestiary: {},
  };
}

// ---------------------------------------------------------------- 図鑑（R8 §3.2）
//
// **数えるのは二つだけ。**「何度見たか」と「何度倒したか」。
// 見た数と倒した数で、根城の図鑑がどこまで開くかが決まる（content/encounters.mjs の
// ENEMY_LORE / ENEMY_CODEX）。engine には出ないので、戦闘の決定性には触れない。
export function normalizeBestiary(saved) {
  const bestiary = {};
  if (!saved || typeof saved !== "object") return bestiary;
  for (const [id, entry] of Object.entries(saved)) {
    if (!PLAYABLE_CONTENT.enemyActors[id]) continue;
    const seen = Math.max(0, Math.floor(Number(entry?.seen) || 0));
    const defeated = Math.max(0, Math.floor(Number(entry?.defeated) || 0));
    if (!seen && !defeated) continue;
    bestiary[id] = { seen, defeated: Math.min(defeated, seen) };
  }
  return bestiary;
}

// 一戦ぶんを足す。**同じ戦闘に何体いても、その敵種は「一戦で一回」数える。**
// 個体数で数えると、群れの敵だけが極端に早く開く。
export function recordBestiary(profile, enemyActorIds, options = {}) {
  const defeatedAll = options.defeated === true;
  const bestiary = { ...(profile.bestiary ?? {}) };
  for (const id of new Set(enemyActorIds ?? [])) {
    if (!PLAYABLE_CONTENT.enemyActors[id]) continue;
    const before = bestiary[id] ?? { seen: 0, defeated: 0 };
    bestiary[id] = {
      seen: before.seen + 1,
      defeated: before.defeated + (defeatedAll ? 1 : 0),
    };
  }
  return { ...profile, bestiary };
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
        || LEGACY_META_UPGRADE_IDS.includes(id)
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
  // 人物解放は save の自由入力を信用せず、Campaign の既存進行から再構成する。
  // 未登場の人物が古い/不整合な save に残っていても、ギルドの鍛錬対象へ戻らない。
  profile.unlockedCharacterIds = availableCharacterIds(profile);
  profile.purchases = Array.isArray(saved.purchases) ? saved.purchases.slice(-50) : [];
  profile.settledRunIds = Array.isArray(saved.settledRunIds)
    ? saved.settledRunIds.filter((id) => typeof id === "string").slice(-200)
    : [];
  // R8 §3.6 — 保存した品が黙って消えるのが一番困るので、archive は
  // schemaVersion が違っても読める entry を引き継ぐ（normalizeArchive 側）。
  profile.blueprints = normalizeArchive(saved.blueprints);
  // 既読印は物語の側の記録なので、根城の場面（homestead:*）もここに乗る。
  // 上限を 50 から 200 へ上げた（Stage が増えるほど印も増えるため）。
  profile.storyFlags = Array.isArray(saved.storyFlags)
    ? saved.storyFlags.filter((flag) => typeof flag === "string").slice(0, 200)
    : [];
  profile.bestiary = normalizeBestiary(saved.bestiary);
  return profile;
}

// ============================================================ Phase C の Profile 読み取り

export function blueprintCarryCapacity(profile) {
  return carryCapacity(upgradeLevel(profile, BLUEPRINT_CAPACITY_UPGRADE_ID));
}

export function appraisalLevel(profile) {
  return upgradeLevel(profile, APPRAISAL_UPGRADE_ID);
}

// R8 §3.7 —「装備基材 / affix family 一群2,000〜20,000」は Phase D 以降の買い物。
// 現時点の pool は **その遠征の pack から決まる**（新パックの family と、
// どの pack にも属さない family_scar）。買って増やす経路はまだ開けない。
export function affixFamilyIdsForPacks(packIds) {
  const enabled = new Set(packIds ?? []);
  return AFFIX_FAMILIES
    .filter((family) => family.packId === null || enabled.has(family.packId))
    .map((family) => family.id);
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

// R18 — 技能は無制限。equipment だけは2枠を維持する。
export function slotLimits(_profile, _characterId) {
  return {
    active: Number.MAX_SAFE_INTEGER,
    reactive: Number.MAX_SAFE_INTEGER,
    passive: Number.MAX_SAFE_INTEGER,
    equipment: 2,
  };
}

// 現行の装備報酬はすべて遠征ごとの手続き生成品である。
// 名前を残した旧 API は、固定装備を新しい報酬へ混ぜないため空配列を返す。
export function unlockedEquipmentIds(_profile) {
  return [];
}

// ---------------------------------------------------------------- 購入 transaction
//
// R6 §9.3 の MetaPurchase。**残高・前後・費用を1件で残す。**
// 「買ったのに増えていない」を後から追えるようにする。
export function purchaseUpgrade(profile, upgradeId, options = {}) {
  const characterId = characterIdFromSlotUpgrade(upgradeId);
  if (characterId && !isCharacterUnlocked(profile, characterId)) {
    return { ok: false, reason: "まだ出会っていない仲間は強化できません。" };
  }
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
  if (!isCharacterUnlocked(profile, characterId)) {
    return { ok: false, reason: "まだ出会っていない仲間は鍛錬できません。" };
  }
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
    // Free / Endless は Stage の学習順を持たないので、pack は常に full で出る
    // （R9 §3.1 の core / full はチュートリアル Stage の仕組み）。
    packDepths: Object.fromEntries(enabled.map((packId) => [packId, "full"])),
    // R8 §13.2 — Phase C。**affix family は pack から決まる。**新パックの
    // family と、どの pack にも属さない傷の family がその遠征の生成 pool になる。
    enabledAffixFamilyIds: affixFamilyIdsForPacks(enabled),
    enemyFamilyIds: [...REGION.enemyFamilyIds],
    actBossIds: [...REGION.actBossIds],
    actBossLawIds: [...REGION.actBossLawIds],
    regionLawIds: [...REGION.regionLawIds],
    rewardTableId: REGION.rewardTableId,
  };
}

// R9 §3.1 — manifest は pack の見せ方（core / full）も持つ。
// **画面もツリーも run もここを通る**ので、深さの解釈が一箇所に閉じる。
export function manifestSkillIds(manifest) {
  return skillIdsForPacks(manifest?.enabledPackIds ?? [], manifest?.packDepths ?? {});
}

// ============================================================ RunState（R6 §4.2）

export const MAX_SUPPLIES = 5;
export const INVENTORY_LIMIT = 12;
export const RUN_SKILL_POINTS_PER_REWARD = 1;
// R15 — 新規遠征は技能点0から始め、通常戦の勝利時に現在の編成全員へ
// 一律1点を自動で加える。遠征終了時に消える。
export const STARTING_RUN_SKILL_POINTS = 0;

export function startingSupplies(profile, rank) {
  const base = difficultyDef(rank).startingSupplies;
  return Math.min(MAX_SUPPLIES, base + upgradeLevel(profile, "starting_supplies"));
}

// R8 §1.1 — Campaign は `options.campaignStageSequence` を渡して作る。
// 渡さなければ従来どおり Free / Endless の random manifest（`makeManifest`）を使う。
// 両経路は同じ RunState 形を返す（campaign 専用の欄を増やすだけで、
// Free / Endless の既存出力は変えない）。
// R8 §3.6 — 遠征開始時、carry capacity 以内の Blueprint を exact copy として
// 再製造する。**seed からの作り直しではなく、保存した定義そのものの写し。**
function carriedItemsFor(profile) {
  return manufactureCarried(profile?.blueprints ?? newArchive(), blueprintCarryCapacity(profile));
}

export function newRun(profile, options = {}) {
  const rank = Math.max(0, Math.min(MAX_DIFFICULTY_RANK, Math.floor(options.difficulty ?? 0)));
  let roster = [...(options.roster ?? [])];
  const runSeed = String(options.runSeed ?? "run");
  const isCampaign = options.campaignStageSequence !== undefined && options.campaignStageSequence !== null;
  const campaignStageSequence = isCampaign
    ? Math.max(0, Math.min(MAX_CAMPAIGN_STAGE_SEQUENCE, Math.floor(options.campaignStageSequence)))
    : null;
  const manifest = isCampaign
    ? campaignManifestForStage(campaignStageSequence, runSeed)
    : makeManifest(runSeed, profile);
  // R9 §2.1 — チュートリアル Stage は人数が決まっている。**呼び出し側が
  // 5人渡しても、その Stage の人数へ切り詰める**（初回の学習順を守るため）。
  // R9 §8 — 一度クリアした Stage を遊び直すときは、登場済みの仲間を
  // 最初から選べる（`freeRoster`）。Stage 3 まで進めると5人になる。
  // 初回の物語と学習順は固定してよいが、既知になった後の再訪で
  // チュートリアルがランの固定税になってはいけない。
  const rosterLocked = isCampaign && options.freeRoster !== true;
  const availableCount = isCampaign && options.freeRoster === true
    ? availableCharacterIds(profile).length
    : LIMITS.maxAlliesInCampaign;
  const partySize = rosterLocked
    ? (manifest.partySize ?? LIMITS.maxAlliesInCampaign)
    : Math.min(LIMITS.maxAlliesInCampaign, availableCount);
  // 初回のチュートリアル Stage では、**誰が来るかは content が決める**
  // （R9 §2.1「加入する人物」）。呼び出し側の選択は、Stage をクリアして
  // freeRoster になってから効く。
  roster = rosterLocked ? [...(manifest.castCharacterIds ?? roster)] : roster;
  if (isCampaign && options.freeRoster === true) {
    const available = availableCharacterIds(profile);
    const allowed = new Set(available);
    roster = roster.filter((id) => allowed.has(id));
    for (const id of available) {
      if (roster.length >= partySize) break;
      if (!roster.includes(id)) roster.push(id);
    }
  }
  roster = roster.slice(0, partySize);
  const carried = carriedItemsFor(profile);
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: String(options.runId ?? runSeed),
    runSeed,
    regionId: REGION.id,
    campaignStageSequence,
    // R9 §2.1 / §8 — この遠征の人数と、編成を組み替えてよいか。
    partySize,
    rosterLocked,
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
    // R15 — 固定の初期装備は持たせない。出発前に明示的に選んだ Blueprint だけを持ち込む。
    inventory: carried.map((item) => item.definition.id),
    // R8 §3.5 / §3.6 — **遠征ごとの装備は content bundle に無い**ので、
    // 定義そのものを run が持つ。戦闘・preview・保存は全部この一箇所を読む。
    generatedEquipment: Object.fromEntries(carried.map((item) => [item.definition.id, item])),
    carriedBlueprintIds: carried.map((item) => item.provenance.carriedFromBlueprintId).filter(Boolean),
    // 生成が失敗したら黙って既定品へ落とさず、ここへ診断を残して画面へ出す
    // （R8 §3.5「50 attemptで生成不能なら...診断errorにする」）。
    generatorDiagnostics: [],
    scrap: 0,
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

export function grantRunSkillPointsToAll(run, amount = RUN_SKILL_POINTS_PER_REWARD) {
  const characterIds = [...new Set([
    ...(Array.isArray(run?.roster) ? run.roster : []),
    ...Object.keys(run?.runSkillPoints ?? {}),
  ])];
  let next = run;
  for (const characterId of characterIds) {
    next = grantRunSkillPoints(next, characterId, amount);
  }
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

// R14 §2 — 解禁のやり直し（resetRunSkills）は消した。
//
// R6 §17.2 は「使った点をそのまま戻す（罰を付けない）」と言っていた。次の一戦の
// 結果が完全に読めるようになると、それは**予測を見ながら技能を出し入れして
// 最適解を探す作業**になり、「いま強くするか、将来へ取っておくか」という
// 遠征のあいだの賭けが消える。技能点の使い道は一度きりにし、都度の調整は
// 装備と loadout のオン／オフ・順番に持たせる。
//
// 解禁は遠征内で一度だけで、撤退するか12戦を突破して遠征が終わるまで戻せない。
// 装着は取得済み技能を無制限に追加でき、装着後は playable-battles 側で
// 一時停止と順番変更を扱う。払い戻しが無くなったので、技能の値段表
// （registerSkillCosts）も一緒に消えた。解禁の可否と値段は、そのつど呼び出し側が
// 渡す node.cost で足りる。

// ============================================================ 補給（R6 §12.1）

// R8 §10.2 / R14 §3 — 補給の三用途。retry、reward reroll、野営治療は
// 同じ有限の補給を奪い合う（R8 §1.5 の不変条件）。
//
// **偵察（次の幕の個体編成を先に見る）は消した。**次の一戦は戦闘予測が
// 完全に見せるようになったので、補給を払って先を覗く枠に値段がつかない。
export const SUPPLY_USES = Object.freeze({
  retry: "敗北した戦闘へ、編成を変えて再挑戦する",
  reroll: "報酬3候補を一度だけ引き直す",
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
    generatedEquipment: { ...(run.generatedEquipment ?? {}) },
  };
  // 分解した装備の定義は run から落とす。**save を無限に太らせない**
  // （Blueprint に残すかどうかは遠征終了時の判断で、持ち物とは別）。
  delete next.generatedEquipment[equipmentId];
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

// R9 §3.2 —「各Stageの敵は、新しい問いを確認するための少数の配置にする。」
//
// チュートリアル Stage は2〜4人で進む。**同じ12戦の敵をそのまま出すと、
// 人数が足りないという理由だけで負ける**ので、人数に合わせて敵の数と
// threat budget を落とす。
//
// **5人の遠征の出力は1バイトも変えない**（contract.test.mjs が凍結と深一致を
// 見ている）。切り詰めは partySize < 5 のときにだけ走る。
export function composeEncounter(index, difficultyRank, options = {}) {
  const def = expeditionEncounter(index);
  const difficulty = difficultyDef(difficultyRank);
  const fullParty = LIMITS.maxAlliesInCampaign;
  const partySize = Math.max(1, Math.min(fullParty, Math.floor(options.partySize ?? fullParty)));
  const units = def.enemies.map((enemy, slot) => ({
    instanceId: `x${index}_${slot}`,
    enemyActorId: enemy.enemyActorId,
    position: enemy.position,
    boss: enemy.boss === true,
    mutations: [],
    threatCost: ENEMY_THREAT_COST[enemy.enemyActorId] ?? 0,
    reinforcement: false,
  }));

  let budget = def.threatBudget + difficulty.threatBudgetDelta;
  let spent = def.threatBudget;

  // R9 §3.2 — 少人数 Stage の切り詰め。**boss は必ず残す**（幕の問いが消える）。
  // 後ろの枠から落とすので、前列の圧力の形は変わらない。
  if (partySize < fullParty) {
    while (units.length > partySize) {
      const removable = units.map((unit, slot) => ({ unit, slot })).filter((entry) => !entry.unit.boss);
      if (!removable.length) break;
      units.splice(removable[removable.length - 1].slot, 1);
    }
    spent = units.reduce((total, unit) => total + unit.threatCost, 0);
    budget = Math.floor(budget * partySize / fullParty);
  }

  // 1. 余り budget はまず増援（枠が残っているときだけ）。
  for (const reinforcement of def.reinforcements) {
    if (units.length >= partySize) break;
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
  //
  // R9 §3.2 — 少人数 Stage では boss の体力も人数に合わせる。**boss は数を
  // 減らせない**（減らすと幕の問いが消える）ので、増援と違って切り詰めが効かない。
  // 2人で5人ぶんの体力を削り切れという形にすると、「組み方」ではなく
  // 「人数が足りない」という理由だけで詰む。
  // **法則・行動・狙いは変えない。**削る量だけが人数に比例する。
  const bossScalePatch = partySize < fullParty
    ? { maxHp: { bps: Math.floor(BPS * partySize / fullParty) } }
    : null;
  // 受け（guard）は**一撃ごとの定額**なので、味方が減ると「総被害に占める割合」が
  // 勝手に上がる。2人で5人ぶんの受けを削るのは、組み方ではなく手数の問題になる。
  // 敵の数と体力を人数へ合わせたのと同じ比で、受けも合わせる。
  const guardScalePatch = partySize < fullParty
    ? { guard: { bps: Math.floor(BPS * partySize / fullParty) } }
    : null;
  const law = def.bossLawId ? BOSS_LAWS[def.bossLawId] : null;
  const enemies = units.map((unit) => {
    const base = enemyBaseStats(unit.enemyActorId);
    const patches = unit.mutations.map((id) => ENEMY_MUTATIONS[id].patch);
    if (guardScalePatch) patches.unshift(guardScalePatch);
    if (unit.boss && bossScalePatch) patches.unshift(bossScalePatch);
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
// 通常戦勝利後は3候補から1つ。**活動資金はこの3候補に入らない**
// （補給を選んでも、資金の獲得量は減らない）。

export const REWARD_EQUIPMENT_SLOTS = 2;

// ---------------------------------------------------------------- 装備の drop（R8 §13.2）

// **drop 列の鍵。** 同じ遠征・同じ戦闘・同じ引き直し回数・同じ枠なら同じ品が出る。
// 100 / 10 の桁分けは、引き直しと枠が互いの列を動かさないためのもの。
export function dropIndexFor(encounterIndex, rerollIndex, slot) {
  return encounterIndex * 100 + rerollIndex * 10 + slot;
}

// R8 §3.7 の「目利き」。**情報を隠して売るのではなく、等級の引きを良くする。**
// level+1 回引いて一番良い等級を採る。level 0 は素の1回引き。
function appraisedRarity(run, dropIndex, level) {
  let best = null;
  for (let attempt = 0; attempt <= level; attempt += 1) {
    const rarity = rollRarity(makeRng(seedKey(run.runSeed, "rarity", dropIndex, attempt)));
    if (best === null || RARITIES.indexOf(rarity) > RARITIES.indexOf(best)) best = rarity;
  }
  return best;
}

// 一品ぶんの生成。**失敗を握りつぶさない。**戻り値は
// { type: "equipment", item } か { type: "generator_error", message }。
export function generatedRewardCandidate(run, profile, encounterIndex, rerollIndex, slot) {
  const dropIndex = dropIndexFor(encounterIndex, rerollIndex, slot);
  const rarity = appraisedRarity(run, dropIndex, appraisalLevel(profile));
  try {
    const item = generateEquipment({
      seed: run.runSeed,
      dropIndex,
      rarity,
      familyIds: run.manifest?.enabledAffixFamilyIds ?? [],
      origin: {
        runId: run.runId,
        regionId: run.regionId,
        campaignStageId: run.manifest?.campaignStageId ?? null,
        encounterIndex,
      },
    });
    // 報酬の分類は通常の装備だけにする。内部の generated / item は、
    // 保存・復元と完全開示のために残す。
    return { type: "equipment", generated: true, equipmentId: item.definition.id, item };
  } catch (error) {
    if (!(error instanceof EquipmentGenerationError)) throw error;
    return { type: "generator_error", message: error.message, diagnostics: error.diagnostics };
  }
}

// ============================================================ 報酬（R6 §5.3）
//
// 通常戦勝利後は3候補から1つ。**活動資金はこの3候補に入らない**
// （補給を選んでも、資金の獲得量は減りません）。
//
// R8 §13.2 — 装備2枠はどちらも遠征ごとの手続き生成品にする。
// 固定装備の報酬 pool は廃止し、報酬の構成を装備2・補給1へ固定する。
//
// 「報酬3候補が全て同じroleにならない」（R8 §13.2）は、装備2・補給という
// 構成そのものが満たしている。装備どうしが同じ役割に寄る場合だけ、
// 次の drop 列へずらして払い先の種類を変える。
export function rewardOffer(run, profile, encounterIndex, rerollIndex = 0) {
  const owned = new Set(run.inventory ?? []);
  const offers = [];
  const offeredIds = new Set(owned);
  const takenTags = new Set();
  for (let slot = 0; slot < REWARD_EQUIPMENT_SLOTS; slot += 1) {
    let candidate = null;
    let fallback = null;
    for (let nudge = 0; nudge < 3; nudge += 1) {
      const next = generatedRewardCandidate(run, profile, encounterIndex, rerollIndex, slot * 3 + nudge);
      if (next.type !== "equipment") {
        candidate = next;
        break;
      }
      if (offeredIds.has(next.equipmentId)) continue;
      fallback ??= next;
      const tags = next.item.readout.payoffTags;
      if (!tags.length || tags.some((tag) => !takenTags.has(tag))) {
        candidate = next;
        break;
      }
    }
    candidate ??= fallback;
    if (!candidate) continue;
    if (candidate.type === "equipment") {
      offeredIds.add(candidate.equipmentId);
      for (const tag of candidate.item.readout.payoffTags) takenTags.add(tag);
    }
    offers.push(candidate);
  }

  offers.push({ type: "supplies", amount: 1 });
  return offers;
}

// 遠征ごとの装備を持ち物へ入れる。**定義そのものを run が抱える**ので、
// 戦闘・preview・保存・送信は run.generatedEquipment だけを読めばよい。
export function takeGeneratedEquipment(run, item) {
  const id = item.definition.id;
  if ((run.inventory ?? []).includes(id)) return { ok: false, reason: "その装備はすでに持っています。" };
  if ((run.inventory ?? []).length >= INVENTORY_LIMIT) {
    return { ok: false, reason: "持ち物が一杯です。一品を分解してください。" };
  }
  return {
    ok: true,
    run: {
      ...run,
      inventory: [...(run.inventory ?? []), id],
      generatedEquipment: { ...(run.generatedEquipment ?? {}), [id]: structuredClone(item) },
    },
  };
}

// 遠征中に見つけた装備のうち、まだ Blueprint に残していないもの。
// **持込品（carried）は既に archive にあるので候補にしない。**
export function newGeneratedItems(run) {
  return Object.values(run.generatedEquipment ?? {}).filter((item) => !item.carried);
}

// 遠征ごとの装備定義を混ぜた content bundle。engine も validator もこれを読む。
export function runContentBundle(run) {
  const generated = run?.generatedEquipment ?? {};
  const ids = Object.keys(generated);
  if (!ids.length) return PLAYABLE_CONTENT;
  const equipment = { ...PLAYABLE_CONTENT.equipment };
  for (const id of ids) equipment[id] = generated[id].definition;
  return { ...PLAYABLE_CONTENT, equipment };
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

// R8 §10.3 — 安全撤退を敗北と区別する。件数の定義は Phase C で archive 側
// （ecology/blueprints.mjs）へ移した。ここは再輸出だけを残す。
export { BLUEPRINT_SAVE_LIMIT };

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
  // 解放欄は campaignProgress から必ず再計算する。既存 save に残っている
  // 未登場人物や、途中で不整合になった値をギルドへ流さない。
  nextProfile.unlockedCharacterIds = availableCharacterIds(nextProfile, run.regionId);
  nextProfile.settledRunIds = [...(nextProfile.settledRunIds ?? []), run.runId].slice(-200);

  // R8 §3.6 / §10.3 — Phase C。遠征終了時に、この run で見つけた装備を
  // Blueprint archive へ exact に残す。件数は確定結果で変わる
  // （勝利2 / 安全撤退2 / 敗北1）。**持込品は既に archive にあるので数えない。**
  // 選ぶ順は「rarity が高い順 → 表示名 → id」で決定的にする。取得順に依らせると、
  // 同じ遠征を同じように遊んでも残る品が変わる。
  const saveLimit = BLUEPRINT_SAVE_LIMIT[outcome] ?? BLUEPRINT_SAVE_LIMIT.lost;
  const rarityRank = Object.fromEntries(RARITIES.map((rarity, index) => [rarity, RARITIES.length - 1 - index]));
  const candidates = newGeneratedItems(run)
    .sort((a, b) => (rarityRank[a.rarity] ?? 9) - (rarityRank[b.rarity] ?? 9)
      || a.definition.displayName.localeCompare(b.definition.displayName, "ja")
      || a.definition.id.localeCompare(b.definition.id))
    .slice(0, saveLimit);
  const savedBlueprints = [];
  let archive = nextProfile.blueprints ?? newArchive();
  for (const item of candidates) {
    const saved = saveBlueprint(archive, item, {
      runId: run.runId,
      encounterIndex: run.fundLedger.highestClearedEncounter,
      campaignStageId: run.manifest?.campaignStageId ?? null,
      outcome,
    });
    archive = saved.archive;
    savedBlueprints.push({
      blueprintId: saved.blueprintId,
      descriptor: item.descriptor,
      rarity: item.rarity,
      displayName: item.definition.displayName,
      added: saved.added,
    });
  }
  nextProfile.blueprints = archive;

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
      blueprintSaveLimit: saveLimit,
      // 実際に archive へ残した品。added: false は「同じ descriptor が既にあり、
      // 取得履歴だけ増えた」という意味（R8 §3.6 の immutable 契約）。
      savedBlueprints,
    },
  };
}

export { ENCOUNTERS_PER_RUN, MAX_DIFFICULTY_RANK };
