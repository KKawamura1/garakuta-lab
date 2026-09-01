import { simulateBattle } from "./engine.mjs";
import { PLAYABLE_CONTENT, DISPLAY_NAMES } from "./playable-content.mjs";
import {
  CHARACTER_OPTIONS,
  COMPONENTS,
  EQUIPMENT,
  RUN_SEED,
  SKILLS,
  SKILL_TREE_NODES,
  characterInfo,
  enemyInfo,
  enemyTargetingText,
  equipEquipment,
  equipSkill,
  freshLoadout,
  initialUnlockedSkills,
  makeExpeditionBattle,
  removeEquipment,
  removeSkill,
  reorderTactic,
  PARTY_SIZE,
  ensurePartySize,
  normalizeFormation,
  previewNextBattle,
  componentInfo,
  registerGeneratedEquipment,
  makePrologueBattle,
  prologueEncounter,
} from "./playable-battles.mjs";
import {
  BOSS_LAWS,
  CAMPAIGN_STAGES,
  ENEMY_MUTATIONS,
  EQUIPMENT_GROUPS,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  PACK_BY_ID,
  PROLOGUE,
  REGION,
  storyBeat,
  SKILL_PACKS,
  difficultyDef,
} from "./content/index.mjs";
import {
  ENCOUNTERS_PER_RUN,
  MAX_DIFFICULTY_RANK,
  META_UPGRADES,
  SCRAP_PER_SUPPLY,
  SUPPLY_USES,
  CAMP_TREATMENTS,
  availableCampaignStages,
  availableDifficulties,
  campTreat,
  commitBattleResult,
  convertScrap,
  dismantle,
  characterStats,
  composeEncounter,
  formatFunds,
  gainSupply,
  grantRunSkillPoints,
  manifestSkillIds,
  newProfile,
  newRun,
  normalizeProfile,
  parseFunds,
  purchaseTraining,
  purchaseUpgrade,
  recordEncounterCleared,
  registerSkillCosts,
  resetRunSkills,
  STARTING_RUN_SKILL_POINTS,
  rewardOffer,
  runSkillPoints,
  settleRun,
  slotLimits,
  slotUpgradeId,
  spendSupply,
  unlockRunSkill,
  upgradeCost,
  upgradeLevel,
  INVENTORY_LIMIT,
  MAX_SUPPLIES,
  appraisalLevel,
  blueprintCarryCapacity,
  newGeneratedItems,
  runContentBundle,
  takeGeneratedEquipment,
} from "./progression.mjs";
import {
  blueprintCompatibility,
  searchBlueprints,
  setCarrySelection,
  toggleFavorite,
} from "./blueprints.mjs";
import { RARITY_LABEL } from "./content/affixes.mjs";
import { POSITIONS, RUN_SCHEMA_VERSION } from "./schema.mjs";
import { buildBeats, beatDurationMs, eventSourceId } from "./replay-beats.mjs";
import { deviceIdForRun, sendPayload, uuid } from "./sync.mjs";
import { BUILD, FINGERPRINT } from "../core/build.mjs";

const VERSION = "EXP-18 R10 Campaign 0.8";
const SAVE_FORMAT_VERSION = 1;
const SAVE_KEY = "exp18-r10-auto-v01";
const MANUAL_SAVE_PREFIX = "exp18-r10-manual-v01-";
const MANUAL_SAVE_SLOTS = 3;
const app = document.querySelector("#app");
const positionLabels = {
  front_left: "前列左",
  front_center: "前列中",
  front_right: "前列右",
  rear_left: "後列左",
  rear_center: "後列中",
  rear_right: "後列右",
};
const positionRows = {
  front_left: "前列",
  front_center: "前列",
  front_right: "前列",
  rear_left: "後列",
  rear_center: "後列",
  rear_right: "後列",
};
const kindLabels = { active: "行動", reactive: "反応", passive: "常設", equipment: "装備" };
const branchIcons = { "攻撃": "✦", "指揮": "↗", "支援": "✚", "守り": "◇", "基礎": "▣" };
// デバッグログに残すイベント。**盤面で畳んだものもここには残る**ので、
// 「なぜそうなったか」を文字で追える。engine が出さない型は入れない
// （reaction_fired / rule_triggered は R5 には無い。ルール由来かは event.ruleId で分かる）。
const replayTypes = new Set([
  "battle_started",
  "resource_refreshed",
  "round_started",
  "actor_activated",
  "action_declared",
  "target_selected",
  "target_changed",
  "action_cost_paid",
  "action_started",
  "action_resolved",
  "action_skipped",
  "preparation_started",
  "preparation_advanced",
  "preparation_completed",
  "preparation_interrupted",
  "damage_taken",
  "excess_damage",
  "pending_amount_modified",
  "healing_applied",
  "excess_healing",
  "barrier_gained",
  "barrier_expired",
  "resource_gained",
  "resource_spent",
  "resource_unused",
  "actor_moved",
  "status_added",
  "status_removed",
  "equipment_worn",
  "equipment_broken",
  "equipment_repaired",
  "actor_defeated",
  "round_ended",
  "battle_ended",
]);

const ENEMY_ICONS = {
  gray_scrapper: "走",
  gray_marksman: "撃",
  gray_guard: "衛",
  gray_hunter: "狩",
  gray_echo: "響",
  gray_bulwark: "盾",
  ash_core: "核",
};

const REPLAY_SPEEDS = [
  { id: "slow", label: "ゆっくり", factor: 1.7 },
  { id: "normal", label: "標準", factor: 1 },
  { id: "fast", label: "速い", factor: 0.45 },
];

// 拍の組み立てはイベント列が変わったときだけ。毎拍やり直さない。
let replayTimer = null;
let saveTimer = null;
let battleLayoutKey = null;
let battleBeats = [];
let battleBeatsSource = null;

// **上限は functions/api/runs.js と同じ数にする。**
// 4000件で切って送っていたが、サーバは2000件で弾く（invalid_payload）。
// 戦闘イベントを1件ずつ runEvents へ積むので、5区画も遊べば2000を超える。
// そのとき画面には「端末に保存しました（D1未送信）」としか出ず、
// **遊んだ記録がD1に1行も残らない。**2026-08-29、公開先の通しで実測した。
// バイト側も同じで、1区画ぶんで約96KB あるため件数だけでは足りない。
// analysis/ecology-upload-smoke.mjs が、この2つとサーバ側の値を照合する。
const MAX_SENT_EVENTS = 2000;
const MAX_SENT_BYTES = 700000;

function payloadBytes(payload) {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

// 送れる分だけ送り、**何件落としたかを控えに書く。**
// 黙って切ると、後から「そもそも起きなかった」と読み違える。
function fitPayload(payload) {
  const recorded = payload.events.length;
  if (payload.events.length > MAX_SENT_EVENTS) {
    payload.events = [payload.events[0], ...payload.events.slice(-(MAX_SENT_EVENTS - 1))];
  }
  while (payload.events.length > 1 && payloadBytes(payload) > MAX_SENT_BYTES) {
    payload.events = [payload.events[0], ...payload.events.slice(Math.ceil(payload.events.length / 2))];
  }
  payload.stats.eventsRecorded = recorded + (payload.stats.eventsDroppedLocally ?? 0);
  payload.stats.eventsSent = payload.events.length;
  return payload;
}

// ============================================================ 状態の三層（R6 §4）
//
// ProfileState … 遠征をまたいで残るもの（活動資金、鍛錬、購入、難易度解禁）
// RunState     … 一遠征のあいだだけのもの（編成、技能点、装備、補給、仮計上）
// BattleState  … 一戦のあいだだけのもの（現在HP、装備耐久）— state.hp がそれ
//
// **profile へ遠征内のものを入れない。**入れた瞬間に「遠征を捨てても残る」に
// なって、補給と再挑戦のトレードオフ（R6 §12.1）が消える。

registerSkillCosts(SKILL_TREE_NODES);

// R9 §8 — その Stage を一度でもクリアしているか。**初回だけ物語と学習順を固定し、
// 既知になった後の再訪では編成から始められるようにする**ための分岐。
function isCampaignStageCleared(profile, sequence) {
  const progress = profile?.campaignProgress?.[REGION.id];
  return Boolean(progress?.clearedStageSequences?.includes(sequence));
}

function defaultFormation(roster) {
  const formation = {};
  roster.forEach((id, index) => {
    formation[id] = CHARACTER_OPTIONS.find((option) => option.id === id)?.defaultPosition
      ?? POSITIONS[index];
  });
  return normalizeFormation(formation, roster);
}

// R9 §2.1 — この遠征の人数。チュートリアル Stage は2〜5人で、
// 一度クリアした Stage を遊び直すときは5人。
function runPartySize() {
  return Math.max(1, Math.min(PARTY_SIZE, Math.floor(state.run?.partySize ?? PARTY_SIZE)));
}

// 初回のチュートリアル Stage では、誰が来るかは物語が決める。
function rosterLocked() {
  return state.run?.rosterLocked === true;
}

function partyLabel() {
  return state.run.roster.length + " / " + runPartySize() + "人";
}

// 遠征を1つ作る。**技能の解禁も装備も、ここで run の中へ入る。**
//
// `runSeed` を渡せるのは、**難易度を選び直しても manifest を引き直させない**ため。
// 渡さずに作り直すと、有効パックが気に入るまで難易度ボタンを往復すれば
// 引き直せてしまう（R6 §5.2 は manifest を seed で決めると言っている）。
function startRun(profile, options = {}) {
  // R9 §2.1 — Campaign Stage は、初回はその Stage の cast をそのまま使う。
  // R9 §8 — 一度クリアした Stage は5人を自由に選べる（freeRoster）。
  const sequence = options.campaignStageSequence ?? null;
  const stage = sequence === null ? null : CAMPAIGN_STAGES[sequence] ?? null;
  const cleared = sequence !== null && isCampaignStageCleared(profile, sequence);
  const freeRoster = options.freeRoster ?? cleared;
  const size = stage && !freeRoster ? stage.partySize : PARTY_SIZE;
  const requested = options.roster
    ?? (stage && !freeRoster ? [...stage.castCharacterIds] : ["warden", "mender", "lancer", "scout"]);
  const roster = ensurePartySize(requested, size);
  const runSeed = options.runSeed ?? (RUN_SEED + "-" + uuid().slice(0, 8));
  const run = newRun(profile, {
    runSeed,
    runId: options.runId ?? uuid(),
    roster,
    difficulty: options.difficulty ?? 0,
    // R8 Implementation Phase 1 — 渡されれば Campaign Stage の固定 manifest、
    // 渡さなければ従来どおり Free / Endless の random manifest になる
    // （newRun 側の分岐。content/campaign-stages.mjs）。
    campaignStageSequence: options.campaignStageSequence ?? null,
    freeRoster,
    formation: defaultFormation(roster),
    startedAt: new Date().toISOString(),
  });
  run.loadout = freshLoadout(roster);
  run.runUnlockedSkills = {};
  let joined = run;
  for (const id of roster) joined = joinRun(joined, id);
  return joined;
}

// 一人を遠征へ入れる。**開始時も途中加入も同じ規則を通す。**
//
//   - 遠征内技能点を配る（0で始めると、その仲間だけ何も解禁できない）
//   - 解禁表を starter 技能で埋める（空だと外した技能を戻せない）
//   - manifest から外れた技能は解禁表からも装着欄からも落とす
//     （画面に「今回は出ない」と書いたものが戦闘へ入る、を作らない）
function joinRun(run, characterId) {
  const available = new Set(manifestSkillIds(run.manifest).all);
  const fresh = freshLoadout([characterId]);
  const keep = (list) => (list ?? []).filter((skillId) => available.has(skillId));
  const next = {
    ...run,
    runSkillPoints: { ...run.runSkillPoints },
    runUnlockedSkills: { ...run.runUnlockedSkills },
    loadout: {
      ...run.loadout,
      tactics: { ...run.loadout?.tactics },
      reactives: { ...run.loadout?.reactives },
      passives: { ...run.loadout?.passives },
      equipment: { ...run.loadout?.equipment },
    },
  };
  // **配るのは初回だけ。**離脱と再加入で配り直すと、点を使い切ってから
  // 外して入れ直せば無限に解禁できる。
  next.runSkillPoints[characterId] = Object.hasOwn(run.runSkillPoints ?? {}, characterId)
    ? runSkillPoints(run, characterId)
    : STARTING_RUN_SKILL_POINTS;
  next.runUnlockedSkills[characterId] = [...new Set([
    ...keep(run.runUnlockedSkills?.[characterId]),
    ...keep(initialUnlockedSkills(characterId)),
  ])];
  next.loadout.tactics[characterId] = keep(run.loadout?.tactics?.[characterId] ?? fresh.tactics[characterId]);
  next.loadout.reactives[characterId] = keep(run.loadout?.reactives?.[characterId] ?? fresh.reactives[characterId]);
  next.loadout.passives[characterId] = run.loadout?.passives?.[characterId] ?? [];
  next.loadout.equipment[characterId] = run.loadout?.equipment?.[characterId] ?? [];
  // 行動が一つも残らなくても、戦闘 engine が技能なし時の通常攻撃へ戻す。
  // ここで strike を補充すると「0個にする」編成が再加入時だけ戻ってしまう。
  return next;
}

function freshUiState() {
  return {
    phase: "intro",
    tab: "roster",
    guildTab: "expedition",
    // Phase C — Blueprint archive の絞り込み（画面だけの状態）。
    blueprintFilter: { rarity: null, favorite: false },
    // R9 §2 / §7 — 物語の断片。queue が空になったら after へ進む。
    story: { queue: [], after: "camp" },
    saveMenuReturn: "intro",
    saveNotice: null,
    prologueActive: false,
    selectedCharacter: null,
    // ギルドは**遠征の編成とは別の選択**を持つ。roster の5人へ丸めると、
    // 同行していない仲間の鍛錬と第4枠が永久に買えなくなる。
    guildCharacter: null,
    formationSelection: null,
    selectedSkillNode: null,
    selectedEquipment: null,
    selectedDifficulty: 0,
    // R8 Implementation Phase 1 — 遠征の仕立て方。既定は "campaign"
    // （Stage 0〜3の固定manifest）。"free" は旧・難易度rank選択（random manifest）で、
    // 早々にcampaignへ統合予定のため格下げしてある（作者判断、2026-08-31）。
    expeditionMode: "campaign",
    selectedCampaignStageSequence: 0,
    treatTargets: [],
    selectedRewardCharacter: null,
    hp: {},
    equipmentDurability: {},
    rewardOffer: [],
    lastResult: null,
    lastSettlement: null,
    lastCarrySnapshot: null,
    replayEvents: [],
    replaySnapshots: [],
    replayIndex: 0,
    replayPlaying: false,
    replaySpeed: "normal",
    replayLogOpen: false,
    skillTreeScroll: {},
    runEvents: [],
    runEventsDropped: 0,
    battleError: null,
    feedback: null,
    migrationNote: null,
    error: null,
    runId: null,
    startedAt: null,
  };
}

function initialState() {
  const profile = newProfile();
  return { ...freshUiState(), profile, run: startRun(profile, { campaignStageSequence: 0 }), phase: "intro" };
}

// R10 — 旧セーブとの互換は切る。新しい保存キーと形式だけを読む。
function readStoredSnapshot(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    if (saved.saveFormatVersion !== SAVE_FORMAT_VERSION) return null;
    if (!saved.profile || !saved.run
      || saved.run.schemaVersion !== RUN_SCHEMA_VERSION
      || !Array.isArray(saved.run.roster)) return null;
    return saved;
  } catch {
    return null;
  }
}

function hydrateState(saved) {
  if (!saved) return initialState();
  const fresh = initialState();
  const next = { ...fresh, ...saved };
  next.profile = normalizeProfile(saved.profile);

  // 保存時点のRunを復元する。形式が違うデータは readStoredSnapshot で
  // 入口から弾いているため、Free Runを勝手に作って続行しない。
  const savedRun = saved.run;
  next.run = savedRun;
  next.run.partySize = Number.isFinite(savedRun.partySize)
    ? Math.max(1, Math.min(PARTY_SIZE, Math.floor(savedRun.partySize)))
    : PARTY_SIZE;
  next.run.rosterLocked = savedRun.rosterLocked === true;
  next.run.roster = ensurePartySize(
    savedRun.roster.filter((id) => characterInfo(id)),
    next.run.partySize,
  );
  next.run.formation = normalizeFormation(savedRun.formation, next.run.roster);
  next.run.loadout = savedRun.loadout || freshLoadout(next.run.roster);
  next.run.generatedEquipment = savedRun.generatedEquipment && typeof savedRun.generatedEquipment === "object"
    ? savedRun.generatedEquipment
    : {};
  next.run.carriedBlueprintIds = Array.isArray(savedRun.carriedBlueprintIds)
    ? savedRun.carriedBlueprintIds
    : [];
  registerGeneratedEquipment(next.run.generatedEquipment);
  next.run.inventory = Array.isArray(savedRun.inventory)
    ? savedRun.inventory.filter((id) => componentInfo(id)).slice(0, INVENTORY_LIMIT)
    : [];
  next.run.supplies = Math.max(0, Math.min(MAX_SUPPLIES, Math.floor(savedRun.supplies ?? 0)));
  next.run.results = Array.isArray(savedRun.results) ? savedRun.results : [];

  next.migrationNote = null;
  const hasFormationSelection = Object.prototype.hasOwnProperty.call(saved, "formationSelection");
  const savedFormationSelection = hasFormationSelection ? saved.formationSelection : next.selectedCharacter;
  next.formationSelection = next.run.roster.includes(savedFormationSelection) ? savedFormationSelection : null;
  // 戦闘内の値（HP・装備耐久）はBattleState。保存から戻るときは満タンへ戻す。
  next.hp = Object.fromEntries(
    CHARACTER_OPTIONS.map((option) => [option.id, characterStats(next.profile, option.id).stats.maxHp]),
  );
  next.equipmentDurability = {};
  next.runEvents = Array.isArray(next.runEvents) ? next.runEvents : [];
  next.rewardOffer = Array.isArray(next.rewardOffer) ? next.rewardOffer : [];
  next.replayEvents = Array.isArray(next.replayEvents) ? next.replayEvents : [];
  next.replaySnapshots = Array.isArray(next.replaySnapshots) ? next.replaySnapshots : [];
  next.skillTreeScroll = next.skillTreeScroll && typeof next.skillTreeScroll === "object" && !Array.isArray(next.skillTreeScroll)
    ? next.skillTreeScroll
    : {};
  next.selectedSkillNode = next.selectedSkillNode || null;
  next.battleError = next.battleError || null;
  next.replaySpeed = REPLAY_SPEEDS.some((entry) => entry.id === next.replaySpeed) ? next.replaySpeed : "normal";
  next.replayLogOpen = next.replayLogOpen === true;
  next.saveMenuReturn = "intro";
  next.saveNotice = null;
  return next;
}

function loadState() {
  try {
    return hydrateState(readStoredSnapshot(SAVE_KEY));
  } catch {
    return initialState();
  }
}

let state = loadState();

// Keep the live replay in memory, but avoid persisting the same snapshots twice.
// Safari can hit its Web Storage quota around the sixth, event-heavy battle;
// an exception here used to happen before render(), leaving the user on the
// "自動戦闘を再生する" screen even though simulation had completed.
function persistableState() {
  const persisted = { ...state, saveFormatVersion: SAVE_FORMAT_VERSION };
  // 保存メニューは一時画面なので、Continueでそこへ戻さない。
  if (state.phase === "saveMenu") {
    persisted.phase = state.saveMenuReturn === "camp" ? "camp" : "intro";
    persisted.saveMenuReturn = "intro";
  }
  if (state.lastResult && typeof state.lastResult === "object") {
    // Copy only the object that we trim; the live state remains untouched.
    persisted.lastResult = { ...state.lastResult };
    // state.replaySnapshots is the copy used by the replay screen.
    delete persisted.lastResult.replaySnapshots;
  }
  return persisted;
}

function storageSnapshot() {
  const snapshot = persistableState();
  snapshot.savedAt = new Date().toISOString();
  return snapshot;
}

function writeSnapshot(key, snapshot) {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot));
    return { ok: true, compacted: false };
  } catch (error) {
    if (!isRecoverableStorageError(error)) throw error;
  }

  const minimal = clone(snapshot);
  const shed = [
    () => {
      const events = Array.isArray(minimal.runEvents) ? minimal.runEvents : [];
      minimal.runEventsDropped = (minimal.runEventsDropped ?? 0) + Math.max(0, events.length - 50);
      minimal.runEvents = events.slice(-50);
    },
    () => { minimal.replaySnapshots = []; },
    () => {
      minimal.replayEvents = [];
      if (minimal.phase === "battle") minimal.phase = "result";
    },
    () => { if (minimal.lastResult) minimal.lastResult.events = []; },
  ];
  for (const drop of shed) {
    drop();
    try {
      localStorage.setItem(key, JSON.stringify(minimal));
      return { ok: true, compacted: true };
    } catch (retryError) {
      if (!isRecoverableStorageError(retryError)) throw retryError;
    }
  }
  return { ok: false, compacted: false };
}

function saveState() {
  // Keep the live replay in memory, but do not block the battle when the
  // device's Web Storage quota is exhausted. The fallback progressively drops
  // reconstructible data while retaining profile/run progress.
  const result = writeSnapshot(SAVE_KEY, storageSnapshot());
  if (!result.ok) {
    state.error = "端末の保存枠が足りません。記録を送ってから、新しい遠征を始めてください。";
    return false;
  }
  return !result.compacted;
}

function manualSaveKey(slot) {
  return MANUAL_SAVE_PREFIX + String(slot);
}

function formatSaveDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "日時不明"
    : date.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
}

function saveSummary(snapshot) {
  if (!snapshot?.run) return "空き枠";
  const run = snapshot.run;
  const mode = run.campaignStageSequence === null || run.campaignStageSequence === undefined
    ? "Free"
    : "Campaign Stage " + run.campaignStageSequence;
  const party = Array.isArray(run.roster) ? run.roster.length : 0;
  return mode + " · " + party + "人 · " + formatSaveDate(snapshot.savedAt);
}

function hasAutoSave() {
  return Boolean(readStoredSnapshot(SAVE_KEY));
}

function saveManualSlot(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > MANUAL_SAVE_SLOTS) return;
  const key = manualSaveKey(slot);
  if (readStoredSnapshot(key)
    && !window.confirm("手動セーブ枠 " + slot + " を上書きします。よろしいですか？")) return;
  const snapshot = storageSnapshot();
  snapshot.phase = "camp";
  snapshot.saveKind = "manual";
  snapshot.saveSlot = slot;
  const result = writeSnapshot(manualSaveKey(slot), snapshot);
  if (!result.ok) {
    state.error = "このセーブ枠へ保存できませんでした。端末の保存容量を確認してください。";
  } else {
    state.saveNotice = "手動セーブ枠 " + slot + " に保存しました。";
    state.error = null;
    saveState();
  }
  render();
}

function loadSavedGame(key) {
  const snapshot = readStoredSnapshot(key);
  if (!snapshot) {
    state.error = "このセーブデータは読み込めないか、存在しません。";
    render();
    return;
  }
  state = hydrateState(snapshot);
  state.saveNotice = key === SAVE_KEY ? "オートセーブから再開しました。" : "手動セーブから再開しました。";
  state.error = null;
  // Continue後も、読み込んだ状態を現在のオートセーブとして保持する。
  saveState();
  render();
}


function clone(value) {
  return structuredClone(value);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function button(label, action, disabled = false, className = "button", attributes = "") {
  return "<button type=\"button\" class=\"" + className + "\" data-action=\"" + esc(action) + "\" "
    + attributes + (disabled ? " disabled" : "") + ">" + esc(label) + "</button>";
}

function shell(title, subtitle, body, options = {}) {
  const error = state.error ? "<p class=\"error\" role=\"alert\">" + esc(state.error) + "</p>" : "";
  // R6 §9.2 / §12.2 — 遠征は勝利・敗北・**放棄**のいずれでも一度だけ精算する。
  // 途中の遠征をボタン一つで捨てると、そこまでの活動資金が消える。
  // だから run の最中は「放棄」で、精算画面を必ず通す。
  const inRun = ["camp", "battlePreview", "battle", "battleError", "result", "reward", "defeat"]
    .includes(state.phase);
  const headerAction = options.hideHeaderAction
    ? ""
    : options.back
      ? button(options.backLabel ?? "キャンプへ", options.backAction ?? "back-camp", false, "menu-button")
      : inRun
        ? button("安全に撤退する", "abandon-run", false, "menu-button")
        : button("ギルドへ", "back-guild", false, "menu-button");
  return "<div class=\"shell\"><header class=\"header\"><div><p class=\"kicker\">" + VERSION
    + "</p><h1>" + esc(title) + "</h1><p class=\"subtitle\">" + esc(subtitle)
    + "</p></div>" + headerAction + "</header>" + body + error
    + "<footer>遠征 " + esc(String(state.run.runId).slice(0, 8)) + " · seed " + esc(state.run.runSeed)
    + " · ルール " + esc(PLAYABLE_CONTENT.contentVersion)
    + "<br>build " + esc(BUILD) + "</footer></div>";
}

// **控えは端末の保存枠に収まる量で切る。**
//
// Phase A は7区画だった。Phase B は12戦あり、戦闘イベントを1件ずつ積むので、
// 実測で第6戦の手前に localStorage の quota を超え、**保存が例外で止まった**
// （ページエラーが出て、そこから先の進行が一切保存されない）。
// 送信側は既に MAX_SENT_EVENTS で切っているので、控えも同じ数で切る。
// **黙って切らない。**落とした件数を数え、控えと控えの送信の両方へ残す。
const MAX_STORED_RUN_EVENTS = MAX_SENT_EVENTS;

function pushRunEvent(entry) {
  state.runEvents.push({ seq: state.runEvents.length + (state.runEventsDropped ?? 0), ...entry });
  if (state.runEvents.length <= MAX_STORED_RUN_EVENTS) return;
  const overflow = state.runEvents.length - MAX_STORED_RUN_EVENTS;
  state.runEventsDropped = (state.runEventsDropped ?? 0) + overflow;
  // 先頭（run_started）は残す。**始まりが消えると、何の遠征の控えか分からない。**
  state.runEvents = [state.runEvents[0], ...state.runEvents.slice(overflow + 1)];
}

function record(type, details = {}) {
  pushRunEvent({ at: new Date().toISOString(), type, ...details });
}

function nameFor(id) {
  return DISPLAY_NAMES[id] ?? id ?? "不明";
}

function characterName(id) {
  return String(nameFor(id)).split(" — ")[0];
}

function characterDisplay(id) {
  const definition = PLAYABLE_CONTENT.characters[id];
  return String(definition?.displayName ?? nameFor(id)).split(" — ")[0];
}

function positionText(position) {
  return positionLabels[position] ?? position;
}

function kindText(kind) {
  return kindLabels[kind] ?? kind;
}

// R6 §9.5 — 鍛錬後の値。**base ではなくこれを画面と戦闘の両方が読む。**
function statsFor(characterId) {
  return characterStats(state.profile, characterId);
}

function maxHp(characterId) {
  return statsFor(characterId)?.stats.maxHp ?? PLAYABLE_CONTENT.characters[characterId]?.maxHp ?? 1;
}

function limitsFor(characterId) {
  return slotLimits(state.profile, characterId);
}

function funds() {
  return parseFunds(state.profile.activityFunds);
}

// R8 Implementation Phase 1 — Campaign Stage の run は `campaignStageSequence`
// を持つ。Free / Endless（従来の難易度rank選択）はこれが null のまま。
function isCampaignRun() {
  return state.run.campaignStageSequence !== null && state.run.campaignStageSequence !== undefined;
}

function currentHp(characterId) {
  if (isCampaignRun()) {
    const hp = state.run.currentHp?.[characterId];
    return Math.max(0, Math.min(maxHp(characterId), Number.isFinite(hp) ? hp : maxHp(characterId)));
  }
  return Math.max(0, Math.min(maxHp(characterId), state.hp[characterId] ?? maxHp(characterId)));
}

function equipmentOwner(equipmentId) {
  return state.run.roster.find((characterId) => (state.run.loadout.equipment?.[characterId] || []).includes(equipmentId)) ?? null;
}

// **装備の表示情報は一箇所から引く。**固定装備は EQUIPMENT に、Phase C の
// 生成装備は run が抱えている定義から作った別表に居る（playable-battles の
// registerGeneratedEquipment）。画面が EQUIPMENT を直接読むと、生成装備が
// 名前も効果も空のまま並ぶ。
function gear(equipmentId) {
  return componentInfo(equipmentId) ?? null;
}

function generatedItem(equipmentId) {
  return state.run?.generatedEquipment?.[equipmentId] ?? null;
}

function rarityChip(rarity) {
  if (!rarity) return "";
  return "<span class=\"rarity-chip rarity-" + esc(rarity) + "\">" + esc(RARITY_LABEL[rarity] ?? rarity) + "</span>";
}

function gearLines(equipmentId) {
  const item = generatedItem(equipmentId);
  if (!item) return [];
  return item.readout?.lines ?? [];
}

function equipmentDurability(equipmentId) {
  return Math.max(0, state.equipmentDurability[equipmentId] ?? gear(equipmentId)?.maxDurability ?? 1);
}

// R6 §5.3 — 技能点は**遠征内の資源**。遠征が終われば消える。
function skillPointsFor(characterId) {
  return runSkillPoints(state.run, characterId);
}

// 装備耐久は R8 Phase 1 の対象外（持ち越しはまだ実装していない）ので、
// Campaign / Free のどちらでも毎戦リセットする。
function resetEquipmentDurability() {
  state.equipmentDurability = {};
  for (const id of state.run.inventory) {
    state.equipmentDurability[id] = gear(id)?.maxDurability ?? 1;
  }
}

// Free / Endless 用。HPも装備耐久も毎戦満タンへ戻す（従来どおり）。
// Campaign Stage の run では呼ばない — HPは `run.currentHp` が持ち越す
// （commitBattleResult, resetEquipmentDurabilityのみ使う）。
function resetBattleResources() {
  for (const option of CHARACTER_OPTIONS) state.hp[option.id] = maxHp(option.id);
  resetEquipmentDurability();
}

function isUnlocked(characterId, skillId) {
  return (state.run.runUnlockedSkills?.[characterId] || []).includes(skillId);
}

// この遠征の manifest が有効にした技能かどうか。**外れた技能はツリーで触れない。**
function inManifest(skillId) {
  return manifestSkillIds(state.run.manifest).all.includes(skillId);
}

// R9 §3.2 — 敵の数と threat budget は、その遠征の人数に合わせて決まる。
// **preview と正式実行が同じ引数を使う**ように、ここ一箇所で組む。
function currentEncounter() {
  // R9 §2.1 — 序盤の敗北は12戦の梯子に属さない。**別の敵を出しているのに
  // 第1戦の名前を出さない**（何を見ているのか分からなくなる）。
  if (state.prologueActive) return prologueEncounter();
  return composeEncounter(state.run.encounterIndex, state.run.difficulty, { partySize: state.run.partySize });
}

function actOfIndex(index) {
  return index <= 4 ? 1 : index <= 8 ? 2 : 3;
}

// R6 §12.1 — 偵察が見せるのは**次の幕**の通常戦の個体編成である。
//
// いま挑む戦闘は補給を使わずに全部見える（見えないと隊列も技能も組めない）。
// 伏せられているのは先の幕の並びと変異で、そこを1つ前倒しで見るのが偵察。
// 法則・敵family・各幕のボスは、偵察しなくても遠征開始時から見える（R6 §5.2）。
function isScouted(index) {
  const act = actOfIndex(index);
  if (act <= actOfIndex(state.run.encounterIndex)) return true;
  return (state.run.scoutedActs ?? []).includes(act);
}

// 次の幕の先頭の通常戦。**無ければ null**（第3幕にいるとき）。
function nextActPreview() {
  const act = actOfIndex(state.run.encounterIndex) + 1;
  if (act > 3) return null;
  for (let index = state.run.encounterIndex + 1; index <= ENCOUNTERS_PER_RUN; index += 1) {
    const composed = composeEncounter(index, state.run.difficulty, { partySize: state.run.partySize });
    if (composed.act === act && composed.kind !== "boss") return composed;
  }
  return null;
}

function installedSkill(characterId, skillId, kind) {
  const key = SLOT_KEYS[kind];
  return (state.run.loadout[key]?.[characterId] || []).includes(skillId);
}

function selectedCharacter() {
  if (state.run.roster.includes(state.selectedCharacter)) return state.selectedCharacter;
  return state.run.roster[0];
}

// ギルド画面の選択。**8人全員が対象**（永続投資は同行の有無に関係しない）。
function guildCharacter() {
  const id = state.guildCharacter;
  return CHARACTER_OPTIONS.some((option) => option.id === id) ? id : CHARACTER_OPTIONS[0].id;
}

function selectedFormationCharacter() {
  return state.run.roster.includes(state.formationSelection) ? state.formationSelection : null;
}

function positionOwner(position) {
  return state.run.roster.find((characterId) => state.run.formation[characterId] === position) ?? null;
}

function sectionHeading(eyebrow, title, right = "") {
  return "<div class=\"section-head\"><div><p class=\"eyebrow\">" + esc(eyebrow)
    + "</p><h2>" + esc(title) + "</h2></div>" + right + "</div>";
}

function campNav() {
  const skillCharacter = selectedCharacter();
  const tabs = [
    ["roster", "編成", partyLabel()],
    ["skills", "スキル", characterName(skillCharacter) + " " + skillPointsFor(skillCharacter) + "pt"],
    ["equipment", "装備", state.run.roster.reduce((total, id) => total + (state.run.loadout.equipment?.[id] || []).length, 0) + "/" + (state.run.roster.length * 2)],
    ["map", "戦闘", state.run.encounterIndex + "/" + ENCOUNTERS_PER_RUN + " · 補給" + state.run.supplies],
  ];
  return "<nav class=\"tabs\" aria-label=\"キャンプ画面\">" + tabs.map(([id, label, meta]) =>
    "<button type=\"button\" class=\"tab " + (state.tab === id ? "active" : "")
      + "\" aria-label=\"" + label + "\" aria-current=\"" + (state.tab === id ? "step" : "false")
      + "\" data-action=\"tab\" data-tab=\"" + id + "\"><b>" + label + "</b><small>" + meta + "</small></button>").join("")
    + "</nav><div class=\"camp-tools\">"
    + button("セーブ / ロード", "open-save-menu", false, "tiny-button", "data-return=\"camp\"")
    + "</div>";
}

function render() {
  stopReplayTimer();
  // Phase C — **今の遠征が抱えている生成装備だけを、装備画面の語彙にする。**
  // 遠征が変われば表も入れ替わる（前の遠征の品が残らない）。
  registerGeneratedEquipment(state.run?.generatedEquipment ?? {});
  const views = {
    intro: renderIntro,
    expeditionStart: renderExpeditionStart,
    saveMenu: renderSaveMenu,
    story: renderStory,
    camp: renderCamp,
    battlePreview: renderBattlePreview,
    battle: renderBattle,
    battleError: renderBattleError,
    result: renderResult,
    reward: renderReward,
    defeat: renderDefeat,
    settlement: renderSettlement,
    complete: renderComplete,
  };
  app.innerHTML = (views[state.phase] ?? renderIntro)();
  app.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", handleAction);
  });
  restoreSkillTreeScroll();
  if (state.phase === "battle") mountBattleView();
}

function captureSkillTreeScroll() {
  if (state.phase !== "camp" || state.tab !== "skills") return;
  const scroll = { ...(state.skillTreeScroll || {}) };
  app.querySelectorAll(".skill-branch[data-branch]").forEach((element) => {
    const value = Number(element.scrollLeft);
    if (Number.isFinite(value)) scroll[element.dataset.branch] = value;
  });
  state.skillTreeScroll = scroll;
}

function restoreSkillTreeScroll() {
  if (state.phase !== "camp" || state.tab !== "skills") return;
  const scroll = state.skillTreeScroll || {};
  app.querySelectorAll(".skill-branch[data-branch]").forEach((element) => {
    const value = Number(scroll[element.dataset.branch]);
    if (Number.isFinite(value)) element.scrollLeft = value;
  });
}

function renderIntro() {
  const auto = readStoredSnapshot(SAVE_KEY);
  const continueLabel = auto ? saveSummary(auto) : "オートセーブはありません";
  return shell("灰の遠征", "二人から始め、5人を揃え、3幕12戦を越える", "<section class=\"hero card\">"
    + "<div class=\"sigil\">◈</div><p class=\"lead\">最初は二人。Stageを越えるたびに一人加わり、<br>5人で2×3の6枠を埋めます。</p>"
    + "<p class=\"intro-copy\">戦闘は自動で進みます。プレイヤーが作るのは、敵の狙いに対して誰を前へ出し、どの技能を優先し、どの装備を消耗させるかという準備です。<b>New Gameでは、必ずCampaign Stage 0をレオンとユウリの2人から始めます。</b></p>"
    + "<div class=\"title-actions\">"
    + button("つづきから", "continue-game", !auto, "button primary")
    + button("はじめから", "new-game", false, "button")
    + button("遠征を仕立てる", "start", false, "button")
    + button("セーブを選ぶ", "open-save-menu", false, "button", "data-return=\"intro\"")
    + "</div>"
    + "<p class=\"save-summary\"><b>Continue</b> · " + esc(continueLabel) + "</p>"
    + "<div class=\"loop\"><span><b>1</b>遠征を仕立てる</span><span><b>2</b>3幕12戦</span><span><b>3</b>活動資金と設計図を持ち帰る</span><span><b>4</b>鍛錬と枠を買う</span></div></section>"
    + "<section class=\"three-up\"><div class=\"card\"><b>2人 → 5人</b><span>Stageごとに一人加わる</span></div><div class=\"card\"><b>技能パックは積む</b><span>前に覚えた技能は消えない</span></div><div class=\"card\"><b>設計図</b><span>拾った生成装備を次へ持ち込む</span></div></section>", { hideHeaderAction: true });
}

function renderSaveSlot(slot, snapshot, fromCamp) {
  const actions = fromCamp
    ? button(snapshot ? "上書き保存" : "この枠に保存", "save-slot", false, "tiny-button primary-mini", "data-slot=\"" + slot + "\"")
      + (snapshot ? button("読み込む", "load-slot", false, "tiny-button", "data-slot=\"" + slot + "\"") : "")
    : snapshot
      ? button("読み込む", "load-slot", false, "tiny-button primary-mini", "data-slot=\"" + slot + "\"")
      : "";
  return "<article class=\"save-slot " + (snapshot ? "" : "empty") + "\"><div><b>手動セーブ " + slot
    + "</b><small>" + esc(saveSummary(snapshot)) + "</small></div><div class=\"save-slot-actions\">" + actions + "</div></article>";
}

function renderSaveMenu() {
  const fromCamp = state.saveMenuReturn === "camp";
  const auto = readStoredSnapshot(SAVE_KEY);
  const manual = Array.from({ length: MANUAL_SAVE_SLOTS }, (_, index) => {
    const slot = index + 1;
    return renderSaveSlot(slot, readStoredSnapshot(manualSaveKey(slot)), fromCamp);
  }).join("");
  const autoActions = fromCamp
    ? button("オートセーブを読み込む", "load-auto", !auto, "tiny-button", "")
    : button("つづきから", "continue-game", !auto, "button primary-mini", "");
  const notice = state.saveNotice
    ? "<p class=\"save-notice\" role=\"status\">" + esc(state.saveNotice) + "</p>"
    : "";
  return shell(fromCamp ? "セーブ / ロード" : "ロードゲーム",
    fromCamp ? "安全な地点で進行を保存する" : "再開する進行を選ぶ",
    "<section class=\"card save-menu-card\"><p class=\"muted\">オートセーブは常に最新の安全な状態を保持します。手動セーブは3枠あり、New Gameを始めても残ります。</p>"
    + "<article class=\"save-slot auto\"><div><b>オートセーブ</b><small>" + esc(auto ? saveSummary(auto) : "まだありません") + "</small></div><div class=\"save-slot-actions\">" + autoActions + "</div></article>"
    + "<div class=\"save-slot-list\">" + manual + "</div>" + notice + "</section>",
    { back: true, backAction: fromCamp ? "back-camp" : "back-title", backLabel: fromCamp ? "キャンプへ" : "タイトルへ" });
}

// ============================================================ 遠征を仕立てる
// ============================================================ 遠征を仕立てる（R6 §15.1）
//
// **遠征開始前に全部を表示する。**有効パック、敵family、3体のボスと法則、
// 難易度modifier、開始補給。個体編成だけは伏せてよい（偵察で開く）。

function difficultyCard(rank) {
  const def = difficultyDef(rank);
  const selected = state.selectedDifficulty === rank;
  const mods = def.encounterModifiers.length
    ? def.encounterModifiers.length + "件の変更"
    : "変更なし";
  return "<button type=\"button\" class=\"difficulty-card " + (selected ? "selected" : "")
    + "\" aria-pressed=\"" + (selected ? "true" : "false") + "\" data-action=\"select-difficulty\" data-rank=\"" + rank
    + "\"><b>難易度 " + rank + "</b><small>" + esc(def.summary) + "</small>"
    + "<span class=\"difficulty-meta\">報酬 ×" + (def.rank ? (1 + rank * 0.1).toFixed(1) : "1.0")
    + " · 補給 " + def.startingSupplies + " · " + mods + "</span></button>";
}

// R8 Implementation Phase 1 — Campaign Stage の選択カード。
// activeなpackはmanifest（すでにStage定義から固定構成で作られている）から読む。
function campaignStageCard(sequence) {
  const stage = CAMPAIGN_STAGES[sequence];
  const selected = state.selectedCampaignStageSequence === sequence;
  const newPack = PACK_BY_ID[stage.newPackId];
  // R9 §2.1 / §8 — Stage は「難易度」ではなく「人数と問いが違う場面」。
  // **誰が加わるのかと、この Stage で問われることを先に見せる。**
  const cleared = isCampaignStageCleared(state.profile, sequence);
  const joining = stage.joiningCharacterId
    ? characterName(stage.joiningCharacterId) + " が加わる"
    : "最初の二人";
  return "<button type=\"button\" class=\"difficulty-card " + (selected ? "selected" : "")
    + "\" aria-pressed=\"" + (selected ? "true" : "false") + "\" data-action=\"select-campaign-stage\" data-sequence=\"" + sequence
    + "\"><b>" + esc(stage.displayName) + "</b><small>" + esc(stage.question) + "</small>"
    + "<span class=\"difficulty-meta\">"
    + (cleared ? "5人・自由編成で再訪" : stage.partySize + "人 · " + esc(joining))
    + " · 今回初登場 " + esc(newPack?.displayName ?? stage.newPackId)
    + " · 有効パック " + stage.activePackCount + "</span></button>";
}

function renderExpeditionStart() {
  const manifest = state.run.manifest;
  const ranks = availableDifficulties(state.profile);
  const campaignStages = availableCampaignStages(state.profile);
  const isCampaign = state.expeditionMode === "campaign";
  const packs = SKILL_PACKS.map((pack) => {
    const on = manifest.enabledPackIds.includes(pack.id);
    return "<div class=\"pack-row " + (on ? "on" : "off") + "\"><b>" + esc(pack.displayName)
      + "</b><small>" + esc(pack.summary) + "</small><span>" + (on ? "有効" : "この遠征では出ない") + "</span></div>";
  }).join("");
  const bosses = manifest.actBossLawIds.map((lawId, index) => {
    const law = BOSS_LAWS[lawId];
    return "<article class=\"boss-card\"><div class=\"boss-top\"><span class=\"enemy-mark\">◆</span><div><b>第"
      + (index + 1) + "幕 · " + esc(enemyInfo(manifest.actBossIds[index]).label) + "</b><small>"
      + esc(law.displayName) + "</small></div></div><p>" + esc(law.previewText) + "</p>"
      + "<ul class=\"boss-counters\">" + law.counters.map((line) => "<li>" + esc(line) + "</li>").join("") + "</ul></article>";
  }).join("");
  const note = state.migrationNote
    ? "<section class=\"card quiet\"><p class=\"eyebrow\">SAVE MIGRATION</p><p class=\"muted\">"
      + esc(state.migrationNote) + "</p></section>"
    : "";
  const tabs = "<nav class=\"tabs\" aria-label=\"ギルド画面\">"
    + [
      ["expedition", "遠征", ENCOUNTERS_PER_RUN + "戦"],
      ["guild", "ギルド投資", formatFunds(funds())],
      ["blueprints", "Blueprint", (state.profile.blueprints?.entries?.length ?? 0)
        + "件 · 持込 " + (state.profile.blueprints?.carrySelection?.length ?? 0)
        + "/" + blueprintCarryCapacity(state.profile)],
    ]
      .map(([id, label, meta]) => "<button type=\"button\" class=\"tab " + (state.guildTab === id ? "active" : "")
        + "\" aria-current=\"" + (state.guildTab === id ? "step" : "false")
        + "\" data-action=\"guild-tab\" data-tab=\"" + id + "\"><b>" + label + "</b><small>" + esc(meta) + "</small></button>").join("")
    + "</nav>";
  // R8 §1.1 — Campaign は「難易度rank」ではなく、Stageごとに固有のpack構成を持つ。
  // 自由遠征（旧・難易度rank）は早々にキャンペーンへ統合予定なので格下げする
  // （既定はキャンペーン、表示順も後ろへ。作者判断、2026-08-31）。
  const modeTabs = "<nav class=\"tabs\" aria-label=\"遠征の仕立て方\">"
    + [["campaign", "キャンペーン", "Stage 0-" + MAX_CAMPAIGN_STAGE_SEQUENCE], ["free", "自由遠征（旧仕様）", "難易度rank"]]
      .map(([id, label, meta]) => "<button type=\"button\" class=\"tab " + (state.expeditionMode === id ? "active" : "")
        + "\" aria-current=\"" + (state.expeditionMode === id ? "step" : "false")
        + "\" data-action=\"expedition-mode\" data-mode=\"" + id + "\"><b>" + label + "</b><small>" + esc(meta) + "</small></button>").join("")
    + "</nav>";
  const difficultySection = "<section class=\"card\">" + sectionHeading("DIFFICULTY / 0 - " + MAX_DIFFICULTY_RANK, "どの難易度で出るか",
      "<span class=\"stage\">解禁 " + ranks.length + " / " + (MAX_DIFFICULTY_RANK + 1) + "</span>")
    + "<p class=\"muted\">難易度は活動資金で買えません。<b>一つ前をクリアしたときだけ次が開きます。</b>報酬は難易度1つにつき+10%です。</p>"
    + "<div class=\"difficulty-grid\">" + ranks.map(difficultyCard).join("") + "</div>";
  const campaignSection = "<section class=\"card\">" + sectionHeading(
      "CAMPAIGN STAGE / 0 - " + MAX_CAMPAIGN_STAGE_SEQUENCE, "どのStageへ出るか",
      "<span class=\"stage\">解禁 " + campaignStages.length + " / " + (MAX_CAMPAIGN_STAGE_SEQUENCE + 1) + "</span>")
    + "<p class=\"muted\">Stageは活動資金で買えず、飛ばせません。<b>一つ前をクリアしたときだけ次が開きます。</b>"
    + "pack構成はseedに関係なくStageごとに固定です（R8 §1.1-1.2）。</p>"
    + "<div class=\"difficulty-grid\">" + campaignStages.map(campaignStageCard).join("") + "</div>"
    + (CAMPAIGN_STAGES[state.selectedCampaignStageSequence]?.learningGoals?.length
      ? "<ul class=\"boss-counters\">" + CAMPAIGN_STAGES[state.selectedCampaignStageSequence].learningGoals
          .map((line) => "<li>" + esc(line) + "</li>").join("") + "</ul>"
      : "");
  const expeditionBody = ""
    + "<section class=\"card\">" + sectionHeading("EXPEDITION / " + esc(REGION.displayName), "この遠征に出るもの",
      "<span class=\"stage\">活動資金 " + formatFunds(funds()) + "</span>")
    + "<p class=\"muted\">" + esc(REGION.summary) + " 敵family: " + esc(REGION.enemyFamilyText)
    + "。<b>個体の並びと変異は、その幕を偵察するまで伏せられます。</b></p>"
    + "<div class=\"pack-list\">" + packs + "</div></section>"
    + "<section class=\"card\">" + sectionHeading("ACT BOSSES / 3", "先に見えている3つの法則")
    + "<p class=\"muted\">ボスの法則は遠征開始時から見えます。途中の報酬を「最後に向けて取る」判断ができます。</p>"
    + "<div class=\"boss-grid\">" + bosses + "</div></section>"
    + modeTabs + (isCampaign ? campaignSection : difficultySection)
    + button("この条件で遠征へ出る", "begin-expedition", false, "button primary") + "</section>";
  const body = { guild: renderGuild, blueprints: renderBlueprints }[state.guildTab]?.() ?? expeditionBody;
  return shell("ギルド", "遠征を仕立てて、持ち帰った資金を使う", tabs + note + body);
}

// ---------------------------------------------------------------- ギルド投資（R6 §9.3）
function purchaseRow(id, displayName, detail, cost, disabledReason) {
  const affordable = cost !== null && funds() >= cost;
  const label = cost === null ? "購入済み" : formatFunds(cost);
  return "<div class=\"purchase-row\"><span class=\"purchase-copy\"><b>" + esc(displayName)
    + "</b><small>" + esc(detail) + "</small></span><span class=\"purchase-cost\">" + esc(label) + "</span>"
    + (cost === null
      ? "<span class=\"purchase-done\">✓</span>"
      : button("買う", "purchase", !affordable || Boolean(disabledReason), "tiny-button primary-mini",
        "data-upgrade=\"" + esc(id) + "\"")) + "</div>";
}

function renderGuild() {
  const characterId = guildCharacter();
  const stats = statsFor(characterId);
  const upgrades = META_UPGRADES.map((upgrade) => {
    const level = upgradeLevel(state.profile, upgrade.id);
    return purchaseRow(upgrade.id, upgrade.displayName, upgrade.describeLevel(level + 1),
      upgradeCost(state.profile, upgrade.id));
  }).join("");
  const slots = ["active", "reactive"].map((kind) => {
    const id = slotUpgradeId(kind, characterId);
    return purchaseRow(id, kindText(kind) + "の第4枠 · " + characterName(characterId),
      "この仲間だけ " + kindText(kind) + " を4つ装着できるようになる",
      upgradeCost(state.profile, id));
  }).join("");
  // R6 §9.5 — 上限なしの鍛錬。**現在の合計bonus、丸め後stat、次に整数が増えるlevelを出す。**
  // 効果が見えないことを隠さない。
  const trainingRows = Object.entries(stats.detail).map(([axis, detail]) => {
    const axisLabel = { might: "腕力", focus: "術力", guard: "受け", vitality: "体力" }[axis];
    const nextText = detail.nextVisibleLevel === null
      ? "これ以上は表示が変わりません"
      : detail.nextVisibleLevel === detail.level + 1
        ? "次の一段で " + (detail.value + 1) + " になる"
        : "次に整数が増えるのは level " + detail.nextVisibleLevel;
    return "<div class=\"purchase-row\"><span class=\"purchase-copy\"><b>" + esc(axisLabel)
      + " Lv" + detail.level + "</b><small>基礎 " + detail.base + " → 現在 " + detail.value
      + "（+" + (detail.bonusBps / 100).toFixed(1) + "%） · " + esc(nextText) + "</small></span>"
      + "<span class=\"purchase-cost\">" + formatFunds(detail.cost) + "</span>"
      + button("鍛える", "train", funds() < parseFunds(detail.cost), "tiny-button primary-mini",
        "data-character=\"" + characterId + "\" data-axis=\"" + axis + "\"") + "</div>";
  }).join("");
  const memberTabsHtml = "<div class=\"member-tabs\" aria-label=\"仲間を選ぶ\">"
    + CHARACTER_OPTIONS.map((option) => "<button type=\"button\" class=\"member-tab "
      + (option.id === characterId ? "active" : "") + "\" data-action=\"select-guild-character\" data-character=\""
      + option.id + "\"><span class=\"avatar small\">" + esc(option.icon) + "</span><span>"
      + characterName(option.id) + "<small>" + esc(option.role) + "</small></span></button>").join("") + "</div>";
  return "<section class=\"card\">" + sectionHeading("ACTIVITY FUNDS", "持ち帰った資金を使う",
      "<span class=\"stage\">" + formatFunds(funds()) + "</span>")
    + "<p class=\"muted\">活動資金は遠征の勝敗を問わず、遠征が終わるたびに一度だけ精算されます。<b>購入は取り消せません。</b>買った品は報酬 pool へ加わりますが、どの遠征にも必ず出るわけではありません。</p>"
    + "<div class=\"purchase-list\">" + upgrades + "</div></section>"
    + "<section class=\"card\">" + sectionHeading("PER CHARACTER", "誰を先に複雑にするか")
    + memberTabsHtml
    + "<div class=\"purchase-list\">" + slots + "</div>"
    + "<h3 class=\"training-heading\">鍛錬（上限なし）</h3>"
    + "<p class=\"muted\">1段で +0.1%。速度・行動権・枠数・発火回数は鍛錬で上がりません。</p>"
    + "<div class=\"purchase-list\">" + trainingRows + "</div></section>";
}

// ---------------------------------------------------------------- Blueprint archive（R8 §3.6）
//
// **archive に所持上限は無い。**制限が掛かるのは遠征開始時の持込枠だけなので、
// 画面も「何件持っているか」ではなく「今回どれを持ち込むか」を主役にする。
function renderBlueprints() {
  const archive = state.profile.blueprints ?? { entries: [], carrySelection: [] };
  const capacity = blueprintCarryCapacity(state.profile);
  const carried = archive.carrySelection ?? [];
  const filter = state.blueprintFilter ?? { rarity: null, favorite: false };
  const entries = searchBlueprints(archive, {
    rarity: filter.rarity ?? undefined,
    favorite: filter.favorite || undefined,
  });

  const rarityFilters = [["", "すべて"], ["legendary", "遺物"], ["epic", "希"], ["rare", "上"], ["common", "並"]]
    .map(([value, label]) => "<button type=\"button\" class=\"tiny-button "
      + ((filter.rarity ?? "") === value ? "primary-mini" : "") + "\" data-action=\"blueprint-filter\" data-rarity=\""
      + value + "\">" + esc(label) + "</button>").join("")
    + "<button type=\"button\" class=\"tiny-button " + (filter.favorite ? "primary-mini" : "")
    + "\" data-action=\"blueprint-filter\" data-favorite=\"toggle\">★ お気に入りだけ</button>";

  const cards = entries.map((entry) => {
    const verdict = blueprintCompatibility(entry);
    const chosen = carried.includes(entry.blueprintId);
    const lines = (entry.readout?.lines ?? []).map((line) => "<p>" + esc(line) + "</p>").join("");
    const origin = entry.acquisitions[0] ?? {};
    return "<article class=\"reward-card blueprint-card" + (chosen ? " selected" : "")
      + (verdict.ok ? "" : " disabled") + "\">"
      + "<div class=\"reward-kind kind-equipment\">Blueprint</div>"
      + "<h3>" + esc(entry.definition.displayName) + rarityChip(entry.rarity) + "</h3>"
      + lines
      + (entry.readout?.keystone ? "<p class=\"keystone-line\">" + esc(entry.readout.keystone) + "</p>" : "")
      + "<small>耐久 " + entry.definition.maxDurability + " · 取得 " + entry.acquisitions.length + "回"
      + (origin.campaignStageId ? " · " + esc(origin.campaignStageId) : "")
      + (origin.outcome ? " · " + esc(origin.outcome) : "") + "</small>"
      + (verdict.ok
        ? button(chosen ? "持込を外す" : "この遠征へ持ち込む", "toggle-blueprint-carry",
          !chosen && carried.length >= capacity, "tiny-button primary-mini",
          "data-blueprint=\"" + esc(entry.blueprintId) + "\"")
        : "<p class=\"muted\">" + esc(verdict.disabledReason) + "</p>")
      + button(entry.favorite ? "★ お気に入り解除" : "☆ お気に入り", "toggle-blueprint-favorite", false,
        "tiny-button", "data-blueprint=\"" + esc(entry.blueprintId) + "\"")
      + "</article>";
  }).join("");

  return "<section class=\"card\">" + sectionHeading("BLUEPRINT ARCHIVE", "残した品の設計図",
      "<span class=\"stage\">持込 " + carried.length + " / " + capacity + "</span>")
    + "<p class=\"muted\">遠征で見つけた生成装備は、遠征が終わるときに設計図として残ります"
    + "（勝利2件・安全撤退2件・敗北1件）。<b>設計図そのものに所持上限はありません。</b>"
    + "遠征開始時に持ち込めるのは持込枠のぶんだけで、持ち込んだ品は"
    + "その遠征の affix family の外でもそのまま動きます。</p>"
    + "<div class=\"flow-actions\">" + rarityFilters + "</div>"
    + (entries.length
      ? "<div class=\"reward-grid\">" + cards + "</div>"
      : "<p class=\"muted\">まだ設計図がありません。遠征で生成装備を拾い、遠征を終えると残ります。</p>")
    + "</section>";
}

// ---------------------------------------------------------------- 物語（R9 §2, §7, §8）
//
// **説明画面ではない。**pack の意味を人物の行動として見せる断片を、
// 一つずつ出す。**いつでも飛ばせる**（R9 §8：既知になった後の再訪で
// チュートリアルがランの固定税になってはいけない）。
function renderStory() {
  const queue = state.story?.queue ?? [];
  const current = queue[0];
  if (!current) return renderCamp();
  const lines = current.lines.map((line) => line.speaker
    ? "<p class=\"story-line\"><b>" + esc(line.speaker) + "</b><span>" + esc(line.text) + "</span></p>"
    : "<p class=\"story-line narration\">" + esc(line.text) + "</p>").join("");
  const remaining = queue.length - 1;
  return shell(current.title, "灰の遠征 · 物語", "<section class=\"card story-card\">"
    + "<div class=\"story-lines\">" + lines + "</div>"
    + (current.footer ? "<p class=\"muted story-footer\">" + esc(current.footer) + "</p>" : "")
    + "<div class=\"flow-actions\">"
    + button(remaining > 0 ? "次へ" : "先へ進む", "story-next", false, "button primary")
    + button("この Stage の会話を飛ばす", "story-skip", false, "button")
    + "</div>"
    + "<p class=\"hint\">会話はいつでも飛ばせます。一度クリアした Stage では最初から出ません。</p>"
    + "</section>");
}

// 物語の queue を積んで story 画面へ入る。**積むものが無ければ、そのまま次へ。**
function enterStory(beats, after) {
  const queue = beats.filter(Boolean);
  state.story = { queue, after };
  if (!queue.length) {
    finishStory();
    return;
  }
  state.phase = "story";
  saveState();
  render();
}

function finishStory() {
  const after = state.story?.after ?? "camp";
  state.story = { queue: [], after: "camp" };
  if (after === "prologue") {
    startPrologue();
    return;
  }
  state.phase = "camp";
  state.tab = "roster";
  saveState();
  render();
}

// R9 §2.1 — 本当に負ける配置を、本当に走らせる。
function startPrologue() {
  const battle = makePrologueBattle(statsFor);
  const result = simulateBattle(battle, PLAYABLE_CONTENT, {
    equipmentBreaks: false,
    captureReplaySnapshots: true,
  });
  state.prologueActive = true;
  state.lastResult = compactResult(result);
  const replay = compactReplay(result);
  state.replayEvents = replay.events;
  state.replaySnapshots = replay.snapshots;
  state.replayIndex = 0;
  state.replayPlaying = true;
  state.phase = "battle";
  record("prologue_started", { battleId: battle.battleId, result: result.result });
  saveState();
  render();
}

// R9 §8 — その Stage の会話をこの遠征で出すかどうか。
// **一度クリアした Stage では出さない。**初回だけ学習順を固定する。
function storyBeatsForStart(sequence) {
  const stage = CAMPAIGN_STAGES[sequence];
  if (!stage) return { beats: [], after: "camp" };
  if (isCampaignStageCleared(state.profile, sequence)) return { beats: [], after: "camp" };
  if (sequence === 0) {
    const seen = (state.profile.storyFlags ?? []).includes("prologue_seen");
    if (seen) return { beats: [], after: "camp" };
    return { beats: [storyBeat(stage.id, "opening")], after: "prologue" };
  }
  return { beats: [storyBeat(stage.id, "join")], after: "camp" };
}

function renderCamp() {
  const view = {
    roster: renderRoster,
    skills: renderSkills,
    equipment: renderEquipment,
    map: renderMap,
  }[state.tab]();
  const title = state.tab === "map" ? "出発前のキャンプ" : "キャンプで組み替える";
  const subtitle = "第" + state.run.encounterIndex + "戦 / " + ENCOUNTERS_PER_RUN
    + " · " + currentEncounter().name + " · " + partyLabel();
  return shell(title, subtitle, campNav() + view);
}

// R6 §15.2 — base 値・永続鍛錬・run 内補正を分けて表示する。
// **鍛錬が乗っている stat だけに印を付ける。**印が無い＝地のままと読める。
function trainedMark(stats, axis) {
  const detail = stats?.detail?.[axis];
  if (!detail || detail.level === 0) return "";
  return "<i class=\"trained\" title=\"基礎 " + detail.base + " · 鍛錬 Lv" + detail.level + "\">＋</i>";
}

function renderRoster() {
  const formationSelection = selectedFormationCharacter();
  const slots = POSITIONS.map((position) => {
    const owner = positionOwner(position);
    const selected = owner && formationSelection === owner;
    const content = owner
      ? "<span class=\"avatar\">" + esc(characterInfo(owner)?.icon ?? "・") + "</span><span><b>"
        + esc(characterName(owner)) + "</b><small>" + esc(characterInfo(owner)?.role ?? "")
        + " · HP " + currentHp(owner) + "/" + maxHp(owner) + "</small></span>"
      : "<span class=\"empty-icon\">＋</span><span><b>空き枠</b><small>選択した仲間をここへ置く</small></span>";
    return "<button type=\"button\" class=\"formation-slot " + (selected ? "selected" : "")
      + "\" aria-pressed=\"" + (selected ? "true" : "false") + "\" data-action=\"place-character\" data-position=\"" + position + "\"><span class=\"slot-label\">"
      + positionText(position) + "</span><span class=\"slot-person\">" + content + "</span></button>";
  }).join("");
  const characterCards = (rosterLocked()
    ? CHARACTER_OPTIONS.filter((option) => state.run.roster.includes(option.id))
    : CHARACTER_OPTIONS
  ).map((option) => {
    const inParty = state.run.roster.includes(option.id);
    const selected = formationSelection === option.id;
    const action = inParty ? "select-formation-character" : "toggle-roster";
    const actionLabel = inParty
      ? (selected ? "位置選択中" : "位置を選ぶ")
      : "編成に入れる";
    const stats = statsFor(option.id);
    return "<article class=\"character-card " + (inParty ? "in-party " : "") + (selected ? "selected" : "")
      + "\"><button type=\"button\" class=\"character-main\" data-action=\"" + action
      + "\" data-character=\"" + option.id + "\"><span class=\"avatar\">"
      + esc(option.icon) + "</span><span class=\"character-copy\"><b>" + esc(characterName(option.id))
      + "</b><small>" + esc(option.role) + " · " + esc(option.summary) + "</small></span><span class=\"check\">"
      + (inParty ? "✓" : "＋") + "</span></button><div class=\"character-stats\"><span>HP "
      + stats.stats.maxHp + trainedMark(stats, "vitality") + "</span><span>腕力 " + stats.stats.might + trainedMark(stats, "might")
      + "</span><span>術力 " + stats.stats.focus + trainedMark(stats, "focus")
      + "</span><span>受け " + stats.stats.guard + trainedMark(stats, "guard")
      + "</span><span>速度 " + (PLAYABLE_CONTENT.characters[option.id]?.speed ?? "-")
      + "</span><span>AP " + (PLAYABLE_CONTENT.characters[option.id]?.baseActionPoints ?? "-")
      + " / RP " + (PLAYABLE_CONTENT.characters[option.id]?.baseReactionPoints ?? "-")
      + "</span><span>" + esc(actionLabel) + "</span></div></article>";
  }).join("");
  const future = rosterLocked()
    ? CHARACTER_OPTIONS.filter((option) => !state.run.roster.includes(option.id))
        .map((option) => esc(characterName(option.id)) + "（" + esc(option.role) + "）").join("、")
    : "";
  const futureBlock = future
    ? "<details class=\"future-roster\"><summary>後で加入する仲間（" + (CHARACTER_OPTIONS.length - state.run.roster.length) + "人）</summary><p class=\"muted\">"
      + future + "</p></details>"
    : "";
  const rosterHeading = rosterLocked() ? "ROSTER / " + runPartySize() : "ROSTER / 8 → " + runPartySize();
  const rosterCopy = rosterLocked()
    ? "今回は" + runPartySize() + "人で進みます。<b>同行者は物語が決めます。</b>Stageをクリアすると、次の仲間が加わります。"
    : "8人全員に固有の初期技能があります。好きな仲間を選び、技能ツリーで別の役割へ伸ばせます。";
  return "<section class=\"card\">" + sectionHeading("FORMATION / 2×3", "誰がどこに立つ？", "<span class=\"stage\">"
    + partyLabel() + "</span>") + "<p class=\"muted\">仲間をタップして位置選択。同じ仲間をもう一度タップすると解除し、選択後に別の位置枠をタップすると二人を交換します。<b>" + (runPartySize() >= 5 ? "5人で6枠なので、必ず一枠が空きます。" : runPartySize() + "人なので、空き枠が" + (6 - runPartySize()) + "つあります。") + "</b>前3後2か前2後3のどちらかにしかできません。前3は単体攻撃を分散できますが、前列を薙ぐ攻撃が3人に当たります。前2は後列に3人置けますが、前列一人あたりの被弾が増えます。</p>"
    + "<div class=\"formation-board\">" + slots + "</div><p class=\"selection-note\">位置選択中: <b>"
    + esc(formationSelection ? characterName(formationSelection) : "なし") + "</b> · "
    + (formationSelection ? "同じ枠をタップで解除 / 別の枠をタップで交換" : "仲間または位置枠をタップして選択")
    + (formationSelection ? "<span class=\"formation-selection-actions\">" + button("選択解除", "clear-formation-selection", false, "tiny-button") + "</span>" : "") + "</p></section>"
    + "<section class=\"card\">" + sectionHeading(rosterHeading,
      rosterLocked() ? "今回の同行者" : "同行する仲間を選ぶ")
    + "<p class=\"muted\">" + rosterCopy + "</p>"
    + "<div class=\"character-grid\">" + characterCards + "</div>" + futureBlock + "</section>"
    + "<section class=\"card quiet\"><p class=\"eyebrow\">NEXT</p><h3>次にやること</h3><p class=\"muted\">スキルツリーで技能を組み、装備画面で実物を2枠に割り当ててください。</p>"
    + button("スキルツリーを見る", "tab", false, "button", "data-tab=\"skills\"") + "</section>";
}

const SLOT_KEYS = { active: "tactics", reactive: "reactives", passive: "passives" };
const SLOT_TITLES = {
  active: "行動（優先順）",
  reactive: "リアクティブ（条件発火）",
  passive: "常設（いつでも効く）",
};

function skillSlotRows(characterId, kind) {
  const key = SLOT_KEYS[kind];
  const list = state.run.loadout[key]?.[characterId] || [];
  const title = SLOT_TITLES[kind];
  const rows = list.map((skillId, index) => {
    const info = COMPONENTS[skillId];
    const moveButtons = kind === "active"
      ? "<span class=\"reorder\">" + button("↑", "move-tactic", index === 0, "icon-button", "data-character=\"" + characterId + "\" data-index=\"" + index + "\" data-direction=\"-1\"")
        + button("↓", "move-tactic", index === list.length - 1, "icon-button", "data-character=\"" + characterId + "\" data-index=\"" + index + "\" data-direction=\"1\"") + "</span>"
      : "";
    return "<div class=\"installed-row\"><span class=\"" + (kind === "active" ? "order" : kind === "passive" ? "bullet passive" : "bullet") + "\">"
      + (kind === "active" ? index + 1 : "↳") + "</span><span class=\"installed-copy\"><b>"
      + esc(info?.label ?? nameFor(skillId)) + "</b><small>" + esc(info?.effect ?? "") + "</small></span>"
      + moveButtons + button("外す", "remove-skill", false, "icon-button remove", "data-character=\"" + characterId
        + "\" data-skill=\"" + skillId + "\" data-kind=\"" + kind + "\"") + "</div>";
  }).join("");
  return "<div class=\"slot-group\"><div class=\"slot-heading\"><span>" + title + "</span><small>"
    + list.length + " / " + limitsFor(characterId)[kind] + "</small></div>" + (rows || "<p class=\"empty-slot\">技能ツリーから装着してください。</p>") + "</div>";
}

function memberTabs(characterId) {
  return "<div class=\"member-tabs\" aria-label=\"仲間を選ぶ\">" + state.run.roster.map((id) => "<button type=\"button\" class=\"member-tab "
    + (id === characterId ? "active" : "") + "\" aria-pressed=\"" + (id === characterId ? "true" : "false")
    + "\" data-action=\"select-character\" data-character=\"" + id
    + "\"><span class=\"avatar small\">" + esc(characterInfo(id)?.icon ?? "・") + "</span>"
    + "<span>" + characterName(id) + "<small>" + positionText(state.run.formation[id]) + " · "
    + skillPointsFor(id) + "pt</small></span></button>").join("") + "</div>";
}

function memberContext(characterId, emphasis = "skills") {
  const option = characterInfo(characterId);
  const active = (state.run.loadout.tactics?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const reactive = (state.run.loadout.reactives?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const worn = (state.run.loadout.equipment?.[characterId] || []).map((id) => nameFor(id));
  const primary = emphasis === "skills"
    ? "装備 " + (worn.length ? worn.join(" · ") : "なし")
    : "行動 " + (active.length ? active.join(" → ") : "なし");
  const secondary = emphasis === "skills"
    ? "位置 " + positionText(state.run.formation[characterId]) + " · HP " + currentHp(characterId) + "/" + maxHp(characterId)
    : "反応 " + (reactive.length ? reactive.join(" · ") : "なし");
  return "<section class=\"member-context\"><div class=\"member-context-head\"><span class=\"avatar\">"
    + esc(option?.icon ?? "・") + "</span><div><p class=\"eyebrow\">選択中の仲間</p><h3>" + esc(characterName(characterId))
    + "</h3><small>" + esc(option?.role ?? "") + " · " + esc(option?.summary ?? "") + "</small></div></div>"
    + "<div class=\"member-context-loadout\"><span><b>" + esc(primary) + "</b></span><span><b>" + esc(secondary) + "</b></span></div></section>";
}

function skillBuildSummary(characterId) {
  const active = (state.run.loadout.tactics?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const reactive = (state.run.loadout.reactives?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const passive = (state.run.loadout.passives?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const definition = PLAYABLE_CONTENT.characters[characterId] ?? {};
  const selectedNode = SKILL_TREE_NODES.find((node) => node.skillId === state.selectedSkillNode);
  const selectedInfo = selectedNode ? COMPONENTS[selectedNode.skillId] : null;
  const slotKey = selectedNode ? SLOT_KEYS[selectedNode.kind] : null;
  const slotLabel = selectedNode?.kind === "active" ? "行動枠"
    : selectedNode?.kind === "reactive" ? "リアクティブ枠" : "常設枠";
  const slotCount = selectedNode ? (state.run.loadout[slotKey]?.[characterId] || []).length : 0;
  const target = selectedNode
    ? "選択中: " + (selectedInfo?.label ?? nameFor(selectedNode.skillId)) + " · 装着先: " + characterName(characterId)
      + " · " + slotLabel + "（" + slotCount + " / 2）"
    : "技能を選択すると、ここに装着先を表示";
  return "<aside class=\"skill-build-summary\" aria-live=\"polite\"><div class=\"skill-build-summary-head\"><span class=\"avatar small\">"
    + esc(characterInfo(characterId)?.icon ?? "・") + "</span><span><b>" + esc(characterName(characterId))
    + "のビルド</b><small>" + esc(positionText(state.run.formation[characterId])) + " · "
    + esc(characterInfo(characterId)?.role ?? "") + "</small></span></div><div class=\"skill-summary-slots\"><span><b>行動</b> "
    + esc(active.length ? active.join(" · ") : "なし") + "</span><span><b>反応</b> "
    + esc(reactive.length ? reactive.join(" · ") : "なし") + "</span><span><b>常設</b> "
    + esc(passive.length ? passive.join(" · ") : "なし") + "</span></div><div class=\"skill-summary-stats\">"
    + "<span><b>HP</b> " + currentHp(characterId) + "/" + maxHp(characterId) + "</span><span><b>AP</b> "
    + (definition.baseActionPoints ?? "-") + "</span><span><b>RP</b> " + (definition.baseReactionPoints ?? "-")
    + "</span></div><div class=\"skill-summary-target\">"
    + esc(target) + "</div></aside>";
}
function skillNodeIcon(node) {
  return (node.kind === "reactive" ? "↳" : branchIcons[node.branch] ?? "·");
}

function renderSkillNode(node, characterId) {
  const info = COMPONENTS[node.skillId];
  // R6 §5.2 — この遠征の manifest に入っていない技能は触れない。
  // **灰色にして残す。**消すと「今回は出ない」ことが分からなくなる。
  if (!inManifest(node.skillId)) {
    return "<article class=\"skill-node out-of-manifest\"><button type=\"button\" class=\"skill-node-button\""
      + " disabled data-action=\"select-skill-node\" data-skill=\"" + node.skillId + "\">"
      + "<span class=\"node-icon\">" + esc(skillNodeIcon(node)) + "</span><span class=\"node-copy\"><b>"
      + esc(info?.label ?? node.skillId) + "</b><small>" + kindText(node.kind) + " · T" + (node.tier + 1)
      + "</small></span><span class=\"node-status\">今回は出ない</span></button></article>";
  }
  const unlocked = isUnlocked(characterId, node.skillId);
  const equipped = installedSkill(characterId, node.skillId, node.kind);
  const prereqsMet = node.requires.every((skillId) => isUnlocked(characterId, skillId));
  const canUnlock = !unlocked && prereqsMet && skillPointsFor(characterId) >= node.cost;
  const selected = state.selectedSkillNode === node.skillId;
  let status = "ロック";
  let action = "";
  if (equipped) {
    status = "装着中";
    action = button("装着中 · 外す", "remove-skill", false, "tiny-button", "data-character=\"" + characterId
      + "\" data-skill=\"" + node.skillId + "\" data-kind=\"" + node.kind + "\"");
  } else if (unlocked) {
    status = "解禁済み";
    action = button("枠へ装着", "equip-skill", false, "tiny-button", "data-character=\"" + characterId
      + "\" data-skill=\"" + node.skillId + "\" data-kind=\"" + node.kind + "\"");
  } else if (canUnlock) {
    status = "解禁可能 · " + node.cost + "pt";
    action = button("解禁（" + node.cost + "点）", "unlock-skill", false, "tiny-button primary-mini", "data-character=\"" + characterId
      + "\" data-skill=\"" + node.skillId + "\"");
  } else {
    status = !prereqsMet ? "前提待ち" : "点数不足";
  }
  const stateClass = equipped
    ? "equipped"
    : unlocked
      ? "unlocked"
      : canUnlock
        ? "available"
        : !prereqsMet
          ? "prerequisite"
          : "locked";
  const detail = selected
    ? "<div class=\"skill-detail\"><p>" + esc(info?.effect ?? "") + "</p><small>前提: "
      + (node.requires.length ? esc(node.requires.map((id) => COMPONENTS[id]?.label ?? id).join(" / ")) : "なし")
      + "</small><div class=\"node-action\">" + action + "</div></div>"
    : "";
  return "<article class=\"skill-node " + stateClass + (selected ? " selected" : "") + "\"><button type=\"button\" class=\"skill-node-button\""
    + " aria-pressed=\"" + (selected ? "true" : "false") + "\" data-action=\"select-skill-node\" data-skill=\"" + node.skillId + "\">"
    + "<span class=\"node-icon\">" + esc(skillNodeIcon(node)) + "</span><span class=\"node-copy\"><b>" + esc(info?.label ?? node.skillId)
    + "</b><small>" + kindText(node.kind) + " · T" + (node.tier + 1) + "</small></span><span class=\"node-status\">"
    + esc(status) + "</span></button>" + detail + "</article>";
}

function renderSkillBranch(branch, characterId) {
  const nodes = SKILL_TREE_NODES.filter((node) => node.branch === branch);
  const tiers = [0, 1, 2].map((tier) => {
    const tierNodes = nodes.filter((node) => node.tier === tier).sort((a, b) => a.id.localeCompare(b.id));
    return "<div class=\"skill-tier\"><span class=\"tier-label\">T" + (tier + 1) + "</span><div class=\"tier-nodes\">"
      + (tierNodes.length ? tierNodes.map((node) => renderSkillNode(node, characterId)).join("") : "<span class=\"tier-empty\">—</span>") + "</div></div>";
  }).join("");
  return "<section class=\"skill-branch\" data-branch=\"" + esc(branch) + "\"><div class=\"branch-title\"><b><span class=\"branch-icon\">" + esc(branchIcons[branch] ?? "·")
    + "</span>" + branch + "</b><small>" + nodes.length + " ノード</small></div><div class=\"skill-tree-map\">" + tiers + "</div></section>";
}

function renderSkills() {
  const characterId = selectedCharacter();
  const pointsBadge = "<span class=\"skill-points-badge\"><small>" + esc(characterName(characterId)) + "の遠征内技能点</small><b>" + skillPointsFor(characterId) + "</b></span>";
  // R9 §3.1 — pack ごとに「入口だけ」か「全体」かが違う。**どちらなのかを名前の
  // 隣に書く。**書かないと、次の Stage で技能が増えたことに気づけない。
  const depths = state.run.manifest.packDepths ?? {};
  const packs = state.run.manifest.enabledPackIds
    .map((id) => (PACK_BY_ID[id]?.displayName ?? id) + (depths[id] === "core" ? "（入口）" : ""))
    .join(" · ");
  const hasCore = state.run.manifest.enabledPackIds.some((id) => depths[id] === "core");
  const manifestNote = "<p class=\"muted\">この遠征で有効な技能パック: <b>" + esc(packs)
    + "</b>。<b>外れたパックの技能は今回出ません。</b>技能点も解禁も遠征が終われば消えます。</p>"
    + (hasCore
      ? "<p class=\"muted\">（入口）と書いたパックは、この Stage では最初の問いに絞った技能だけが出ます。"
        + "<b>次の Stage へ進むと、同じパックの残りが加わります。</b>前に覚えた技能は消えません。</p>"
      : "")
    + "<div class=\"flow-actions\">"
    + button("この仲間の解禁をやり直す", "reset-run-skills", false, "tiny-button",
      "data-character=\"" + characterId + "\"")
    + "</div>";
  // 「基礎」は最後。**詰み防止の棚であって、最初に見せる棚ではない。**
  const branches = ["攻撃", "指揮", "支援", "守り", "基礎"].map((branch) => renderSkillBranch(branch, characterId)).join("");
  return "<section class=\"card skill-build-card\">" + sectionHeading("SKILL TREE / " + SKILL_TREE_NODES.length + " NODES", "誰を伸ばす？", pointsBadge)
    + "<p class=\"muted\">仲間を切り替えながら、現在の行動・リアクティブ・常設・装備と基礎値を確認できます。技能ノードをタップすると説明と装着操作が開きます。</p>"
    + manifestNote
    + memberTabs(characterId) + memberContext(characterId, "skills") + skillSlotRows(characterId, "active") + skillSlotRows(characterId, "reactive") + skillSlotRows(characterId, "passive") + "</section>"
    + "<section class=\"card\">" + sectionHeading("COMMON TREE", "技能を解禁する")
    + "<p class=\"muted\">同じツリーでも、誰に装着するか・どの順番で試すかで役割が変わります。アイコンを選び、説明を必要な時だけ開いてください。</p>"
    + "<div class=\"tree-legend\"><span><i class=\"kind kind-active\">行動</i> 自分の順番に試す</span><span><i class=\"kind kind-reactive\">反応</i> 条件発生時に発火</span>"
    + "<span><i class=\"kind kind-passive\">常設</i> いつでも効く</span></div>"
    + skillBuildSummary(characterId) + branches + "</section>"
    + "<section class=\"card quiet\"><p class=\"eyebrow\">NEXT / 2</p><p class=\"muted\">枠が決まったら、同じ仲間の装備と耐久を確認します。</p>"
    + "<div class=\"flow-actions\">" + button("編成へ戻る", "tab", false, "button", "data-tab=\"roster\"")
    + button("装備へ進む", "tab", false, "button primary", "data-tab=\"equipment\"") + "</div></section>";
}

function equipmentSlotHtml(characterId, slot) {
  const equipmentId = (state.run.loadout.equipment?.[characterId] || [])[slot] || null;
  const selected = state.selectedEquipment;
  const canInstall = Boolean(selected && selected !== equipmentId);
  const label = equipmentId ? nameFor(equipmentId) : "空き枠";
  const detail = equipmentId
    ? "戦闘耐久 " + equipmentDurability(equipmentId) + " / " + (gear(equipmentId)?.maxDurability ?? 1)
    : selected ? "選択中の装備をここへ" : "装備を選んでください";
  return "<div class=\"equipment-slot\"><button type=\"button\" class=\"equip-slot-button "
    + (canInstall ? "ready" : "") + "\" data-action=\"" + (canInstall ? "equip-equipment" : "select-character")
    + "\" data-character=\"" + characterId + "\" data-slot=\"" + slot + "\"><span class=\"slot-number\">"
    + (slot + 1) + "</span><span><b>" + esc(label) + "</b><small>" + esc(detail) + "</small></span></button>"
    + (equipmentId ? button("外す", "remove-equipment", false, "tiny-button", "data-character=\"" + characterId
      + "\" data-equipment=\"" + equipmentId + "\"") : "") + "</div>";
}

// 報酬 pool に入っている装備。**買っていない群は、まだ拾えないと分かるように出さない。**
function unlockedGear() {
  const ids = [];
  for (const group of EQUIPMENT_GROUPS) {
    const on = group.startsUnlocked || upgradeLevel(state.profile, "equipment_pool." + group.id) > 0;
    if (on) ids.push(...group.equipmentIds);
  }
  return ids;
}

function renderEquipment() {
  const characterId = selectedCharacter();
  const selected = state.selectedEquipment;
  const inventory = state.run.inventory.map((id) => {
    const owner = equipmentOwner(id);
    const isSelected = selected === id;
    const info = gear(id);
    const max = info?.maxDurability ?? 1;
    const durability = equipmentDurability(id);
    const item = generatedItem(id);
    const lines = gearLines(id);
    return "<article class=\"gear-card " + (isSelected ? "selected" : "") + (durability === 0 ? " depleted" : "")
      + (item ? " generated" : "") + "\"><button type=\"button\" class=\"gear-main\" data-action=\"select-equipment\" data-equipment=\"" + id
      + "\"><span class=\"gear-icon\">" + (item ? "❖" : "◆") + "</span><span class=\"gear-copy\"><b>" + esc(info?.label ?? id)
      + rarityChip(item?.rarity) + (item?.carried ? "<span class=\"carried-chip\">持込</span>" : "")
      + "</b>" + (lines.length
        ? lines.map((line) => "<small>" + esc(line) + "</small>").join("")
        : "<small>" + esc(info?.effect ?? "") + "</small>")
      + "</span><span class=\"gear-state\">"
      + (owner ? characterName(owner) : "手元") + "<br>戦闘耐久 " + durability + "/" + max + "</span></button>"
      + button("分解", "dismantle", false, "tiny-button", "data-equipment=\"" + id + "\"")
      + "</article>";
  }).join("");
  const codex = unlockedGear().filter((id) => !state.run.inventory.includes(id)).map((id) =>
    "<span class=\"codex-chip locked\"><b>" + esc(EQUIPMENT[id].label) + "</b><small>未入手 · "
      + esc(EQUIPMENT[id].grammar) + "</small></span>").join("");
  const generatedCount = Object.keys(state.run.generatedEquipment ?? {}).length;
  const memberIds = [characterId, ...state.run.roster.filter((id) => id !== characterId)];
  const members = memberIds.map((id) => "<article class=\"gear-member " + (id === characterId ? "selected" : "") + "\"><button type=\"button\" class=\"member-head member-head-button\" data-action=\"select-character\" data-character=\"" + id + "\"><span class=\"avatar\">"
    + esc(characterInfo(id)?.icon ?? "・") + "</span><span><b>" + esc(characterName(id)) + "</b><small>"
    + esc(positionText(state.run.formation[id])) + " · 2装備枠</small></span><span class=\"member-focus\">" + (id === characterId ? "選択中" : "選ぶ") + "</span></button><div class=\"equipment-slots\">"
    + equipmentSlotHtml(id, 0) + equipmentSlotHtml(id, 1) + "</div></article>").join("");
  return "<section class=\"card equipment-build-card\">" + sectionHeading("EQUIPMENT / 2 SLOTS EACH", "実物を組み替える", "<span class=\"stage\">"
    + state.run.inventory.length + " / " + INVENTORY_LIMIT + "</span>") + "<p class=\"muted\">装備はこの遠征の持ち物です（上限" + INVENTORY_LIMIT + "品）。選択してから仲間の枠をタップすると移動します。戦闘中に耐久が減り、0になるとその装備の効果が止まります。破損はせず、戦闘終了後に最大へ戻ります。<b>遠征が終わると手放します。</b></p>"
    + memberTabs(characterId) + memberContext(characterId, "equipment")
    + "<p class=\"selection-note\">選択中: <b>" + esc(selected ? gear(selected)?.label ?? selected : "なし")
    + "</b> · " + (selected ? "下の枠をタップして装着" : "上の装備をタップ") + "</p>"
    + "<div class=\"scrap-line\"><span>分解の屑 <b>" + (state.run.scrap ?? 0) + "</b>（"
    + SCRAP_PER_SUPPLY + "で補給1）</span>"
    + button("補給へ替える", "convert-scrap", (state.run.scrap ?? 0) < SCRAP_PER_SUPPLY
      || state.run.supplies >= MAX_SUPPLIES, "tiny-button") + "</div>"
    + "<div class=\"gear-grid\">" + inventory + "</div></section>"
    + "<section class=\"card\">" + sectionHeading("LOADOUT / " + runPartySize() + " MEMBERS", "誰に何を持たせる？")
    + "<div class=\"gear-member-grid\">" + members + "</div></section>"
    + "<section class=\"card quiet\">" + sectionHeading("REWARD POOL / " + unlockedGear().length + " EQUIPMENT", "この遠征で拾える装備",
      "<span class=\"stage\">生成 " + generatedCount + "</span>")
    + "<div class=\"codex-list\">" + (codex || "<p class=\"muted\">すべて入手済みです。</p>") + "</div>"
    + "<div class=\"flow-actions\">" + button("スキルへ戻る", "tab", false, "button", "data-tab=\"skills\"")
    + button("戦闘前確認へ", "tab", false, "button primary", "data-tab=\"map\"") + "</div></section>";
}

function renderEnemy(enemy) {
  const info = enemyInfo(enemy.enemyActorId);
  const mutations = (enemy.mutations ?? []).map((id) => ENEMY_MUTATIONS[id]?.displayName ?? id);
  const badges = (enemy.boss ? ["ボス"] : []).concat(enemy.reinforcement ? ["増援"] : []).concat(mutations);
  return "<article class=\"enemy-card" + (enemy.boss ? " boss" : "") + "\"><div class=\"enemy-top\"><span class=\"enemy-mark\">◆</span><div><b>"
    + esc(info.label) + "</b><small>" + esc(positionText(enemy.position)) + " · HP " + enemy.stats.maxHp
    + " · 受け " + enemy.stats.guard + "</small></div></div>"
    + (badges.length ? "<div class=\"enemy-badges\">" + badges.map((text) =>
      "<span class=\"badge\">" + esc(text) + "</span>").join("") + "</div>" : "")
    + "<p>" + esc(info.targeting) + "</p>"
    + (mutations.length ? "<p class=\"muted small\">" + esc((enemy.mutations ?? [])
      .map((id) => ENEMY_MUTATIONS[id]?.previewText ?? "").join(" ")) + "</p>" : "")
    + "</article>";
}

// R6 §12.1 — 補給は3用途で共有する。**引き直しに使うと再挑戦の余地が減る。**
// そのトレードオフを、残数と用途を同じ場所へ並べて見せる。
function suppliesBar(context) {
  const supplies = state.run.supplies;
  const pips = Array.from({ length: MAX_SUPPLIES }, (_, index) =>
    "<span class=\"supply-pip " + (index < supplies ? "on" : "") + "\"></span>").join("");
  const uses = Object.entries(SUPPLY_USES)
    .map(([id, text]) => "<li><b>" + esc({ retry: "再挑戦", reroll: "引き直し", scout: "偵察", camp: "野営治療" }[id])
      + "</b> " + esc(text) + "</li>").join("");
  return "<div class=\"supplies-bar\"><div class=\"supplies-head\"><b>補給 " + supplies + " / " + MAX_SUPPLIES
    + "</b><span>" + esc(context ?? "3つの用途で取り合う") + "</span></div>"
    + "<div class=\"supply-pips\">" + pips + "</div><ul class=\"supply-uses\">" + uses + "</ul></div>";
}

function renderMap() {
  const index = state.run.encounterIndex;
  const encounter = currentEncounter();
  const progress = Array.from({ length: ENCOUNTERS_PER_RUN }, (_, offset) => {
    const step = offset + 1;
    const kind = composeEncounter(step, state.run.difficulty, { partySize: state.run.partySize }).kind;
    return "<span class=\"map-node " + (step < index ? "done" : step === index ? "current" : "")
      + " kind-" + kind + "\" title=\"" + esc({ normal: "通常", elite: "精鋭", boss: "ボス" }[kind]) + "\">"
      + (kind === "boss" ? "★" : step) + "</span>";
  }).join("");
  const party = state.run.roster.map((id) => "<div class=\"map-party-row\"><span class=\"avatar small\">"
    + esc(characterInfo(id)?.icon ?? "・") + "</span><b>" + esc(characterName(id)) + "</b><span>"
    + positionText(state.run.formation[id]) + " · HP " + currentHp(id) + "/" + maxHp(id) + "</span></div>").join("");
  const kindLabel = { normal: "通常", elite: "精鋭", boss: "ボス" }[encounter.kind];
  const law = encounter.bossLaw
    ? "<div class=\"boss-law\"><b>" + esc(encounter.bossLaw.displayName) + "</b><p>"
      + esc(encounter.bossLaw.previewText) + "</p><ul class=\"boss-counters\">"
      + encounter.bossLaw.counters.map((line) => "<li>" + esc(line) + "</li>").join("") + "</ul></div>"
    : "";
  // いま挑む戦闘は常に全部見える。伏せられているのは先の幕である。
  const enemyBlock = "<div class=\"enemy-grid\">" + encounter.enemies.map(renderEnemy).join("") + "</div>";
  const preview = nextActPreview();
  const scoutBlock = preview === null
    ? ""
    : "<section class=\"card\">" + sectionHeading("SCOUT / 次の幕", "先に見ておくか")
      + (isScouted(preview.index)
        ? "<p class=\"muted\">第" + preview.act + "幕の通常戦。偵察済みなので、個体と変異が見えています。</p>"
          + "<div class=\"enemy-grid\">" + preview.enemies.map(renderEnemy).join("") + "</div>"
        : "<div class=\"scout-veil\"><p><b>第" + preview.act + "幕はまだ偵察していません。</b>"
          + "敵family（" + esc(REGION.enemyFamilyText) + "）と各幕のボスは最初から見えています。"
          + "偵察で見えるのは、個体・位置・変異の組み合わせです。</p>"
          + button("補給1で次の幕を偵察する", "scout", state.run.supplies < 1, "button") + "</div>")
      + "</section>";
  const ruleBlock = isCampaignRun()
    ? "<section class=\"card quiet\"><p class=\"eyebrow\">CAMPAIGN RULE</p><p class=\"muted\">"
      + "通常・精鋭戦後は現在HPを次の戦闘へ持ち越します（R8 §1.5）。4戦目・8戦目のボスを倒したときだけ全員が全回復します。"
      + "<b>敵を倒さずに粘っても、有限の補給（下の野営治療）を使わない限りHPは戻りません。</b>"
      + "負けても補給が残っていれば、編成を変えて同じ戦闘へ挑み直せます（開始前のHPへ戻ります）。</p></section>"
    : "<section class=\"card quiet\"><p class=\"eyebrow\">CAMPAIGN RULE</p><p class=\"muted\">戦闘中のHPと装備耐久は、その戦闘の中だけ有効です。勝敗が決まると最大へ戻ります。<b>遠征の緊張は持ち越しHPではなく、補給・報酬・敵の重さで作ります。</b>負けても補給が残っていれば、編成を変えて同じ戦闘へ挑み直せます。</p></section>";
  return "<section class=\"card\">" + sectionHeading("EXPEDITION / 3 ACTS · " + ENCOUNTERS_PER_RUN + " BATTLES",
      "次の敵を見る", "<span class=\"stage\">" + index + " / " + ENCOUNTERS_PER_RUN + "</span>")
    + "<div class=\"map-progress\">" + progress + "</div>"
    + "<p class=\"act-line\">第" + encounter.act + "幕 · " + kindLabel + "戦 · threat " + encounter.spentThreat
    + " / " + encounter.budget + " · 最大" + encounter.maxRounds + "ラウンド</p><h3>"
    + esc(encounter.name) + "</h3><p class=\"lead-small\">" + esc(encounter.description) + "</p>"
    + law + enemyBlock
    + "<div class=\"map-party\"><h3>現在の隊列</h3>" + party + "</div>"
    + button("この敵に挑む", "begin-stage", false, "button primary") + "</section>"
    + "<section class=\"card\">" + sectionHeading("SUPPLIES", "補給をどこへ使う？") + suppliesBar() + "</section>"
    + (isCampaignRun() ? campTreatmentBlock() : "")
    + scoutBlock
    + "<section class=\"card\">" + sectionHeading("TARGETING", "敵は誰を狙う？")
    + "<p class=\"muted\">敵ごとに狙いが違います。前列を守るだけでなく、後列優先・準備中優先の攻撃もあります。戦闘前に確認し、隊列とリアクティブを組み直してください。</p>"
    + encounter.enemies.map((enemy) => "<div class=\"targeting-line\"><b>" + esc(enemyInfo(enemy.enemyActorId).label)
      + "</b><span>" + esc(enemyTargetingText(enemy.enemyActorId)) + "</span></div>").join("") + "</section>"
    + ruleBlock;
}

// R8 §9.2 / §10.2 — 野営治療。補給1で3種のうちどれか一つ。
// 対象は自動選択する（集中治療=最もHP割合の低い生存者、全体手当=生存者全員、
// 蘇生=最初の戦闘不能者）。simpleな一次実装であり、対象を選ぶUIはまだ無い。
function campTreatmentBlock() {
  const alive = state.run.roster.filter((id) => currentHp(id) > 0);
  const defeated = state.run.roster.filter((id) => currentHp(id) <= 0);
  const rows = Object.values(CAMP_TREATMENTS).map((treatment) => {
    const applicable = treatment.revive ? defeated.length > 0 : alive.some((id) => currentHp(id) < maxHp(id));
    const disabled = state.run.supplies < 1 || !applicable;
    return "<div class=\"purchase-row\"><span class=\"purchase-copy\"><b>" + esc(treatment.displayName)
      + "</b><small>" + esc(treatment.summary) + "</small></span>"
      + button("補給1で使う", "treat", disabled, "tiny-button primary-mini", "data-treatment=\"" + esc(treatment.id) + "\"")
      + "</div>";
  }).join("");
  return "<section class=\"card\">" + sectionHeading("CAMP TREATMENT", "野営で治療する（補給を消費）")
    + "<p class=\"muted\">戦闘外で戻せるHPは、ここで補給を払った分だけです。誰を治療するかは自動選択します"
    + "（集中治療は最もHP割合の低い生存者、全体手当は生存者全員、蘇生は最初の戦闘不能者）。</p>" + rows + "</section>";
}

// R8 §11 — exact preview。副作用なしで次戦を1回実行し、結果を表示する。
// simulateアクションが実際に使うのと同じBattleInput構成経路（simulateNextBattle）
// を通るので、ここに出る結果は実行結果と完全一致する。
function nextBattlePreviewBlock() {
  let preview;
  try {
    preview = previewNextBattle(state.run, state.profile, state.run.encounterIndex);
  } catch {
    return "";
  }
  const resultLabel = { win: "勝利", loss: "敗北", draw: "決着つかず" }[preview.result] ?? preview.result;
  const rows = preview.perCharacter.map((entry) => "<div class=\"battle-plan-row\"><span class=\"avatar small\">"
    + esc(characterInfo(entry.characterId)?.icon ?? "・") + "</span><div><b>" + esc(characterName(entry.characterId))
    + "</b><small>" + (entry.defeated ? "戦闘不能" : "生存") + "</small></div><span>"
    + entry.startingHp + " → " + entry.endingHp + "</span></div>").join("");
  return "<section class=\"card\">" + sectionHeading("EXACT PREVIEW", "この構成のまま進めた結果",
      "<span class=\"stage\">" + resultLabel + " · " + preview.roundsUsed + "ラウンド</span>")
    + "<p class=\"muted\">無料・副作用なしの試算です。<b>同じ構成なら「自動戦闘を再生する」と完全に同じ結果になります。</b></p>"
    + "<div class=\"plan-list\">" + rows + "</div></section>";
}

function renderBattlePreview() {
  const encounter = currentEncounter();
  const allies = state.run.roster.map((id) => "<div class=\"battle-plan-row\"><span class=\"avatar small\">"
    + esc(characterInfo(id)?.icon ?? "・") + "</span><div><b>" + esc(characterName(id)) + "</b><small>"
    + esc(positionText(state.run.formation[id])) + " · HP " + currentHp(id) + "/" + maxHp(id) + "</small></div><span>"
    + esc((state.run.loadout.tactics?.[id] || []).map((skillId) => COMPONENTS[skillId]?.label ?? skillId).join(" → "))
    + "</span></div>").join("");
  return shell("第" + state.run.encounterIndex + "戦 / " + ENCOUNTERS_PER_RUN, encounter.name + " · 戦闘前の最終確認", "<section class=\"card\">"
    + sectionHeading("AUTO BATTLE / PLAN", "この構成で試す") + "<p class=\"muted\">戦闘中の操作はありません。行動の優先順、リアクティブの条件、敵の狙いをR5エンジンが決定的に解決します。</p>"
    + "<div class=\"plan-list\"><h3>味方の構成</h3>" + allies + "</div><div class=\"plan-list\"><h3>敵の狙い</h3>"
    + encounter.enemies.map((enemy) => "<div class=\"targeting-line\"><b>" + esc(enemyInfo(enemy.enemyActorId).label)
      + "</b><span>" + esc(enemyTargetingText(enemy.enemyActorId)) + "</span></div>").join("") + "</div>"
    + button("自動戦闘を再生する", "simulate", false, "button primary")
    + button("キャンプへ戻る", "back-camp", false, "button") + "</section>"
    + nextBattlePreviewBlock());
}

function actorName(id) {
  const actor = state.lastResult?.actors?.find((entry) => entry.instanceId === id);
  return String(actor?.displayName ?? nameFor(id)).split(" — ")[0];
}

function targetNames(ids) {
  return (ids || []).map((id) => actorName(id)).join("、");
}

function eventText(event) {
  const values = event.values || {};
  const sourceId = event.sourceActorId || event.actorId || event.ownerActorId;
  const source = sourceId ? actorName(sourceId) : "";
  const target = targetNames(event.targetActorIds || event.targetIds);
  const amount = values.amount ?? values.actual ?? values.proposed;
  const amountText = amount !== undefined ? " · " + amount : "";
  // だれがだれをどうしたかをひとつの行で読めるようにする。
  const number = amount ?? "";
  const arrow = source && target && source !== target ? source + " → " : "";
  const skillId = values.activeSkillId || values.skillId || event.activeSkillId || event.skillId;
  const skill = skillId ? nameFor(skillId) : "行動";
  const round = event.round ?? values.round ?? "-";
  const targetLabel = target && target === source ? "自分" : target || "相手";
  const causeName = eventCauseName(event);
  const cause = causeName ? "（" + causeName + "）" : "";
  const resourceLabel = (resource) => ({ action_points: "行動権", reaction_points: "RP" }[resource] ?? resource ?? "資源");
  const map = {
    battle_started: "戦闘開始",
    round_started: "ラウンド" + round + "開始",
    actor_activated: source + "が動き出す",
    action_declared: source + "が" + skill + "を選んだ",
    target_selected: source + "が" + targetLabel + "を狙う",
    target_changed: "狙いが" + targetLabel + "になった",
    action_started: source + "の" + skill + "が始まる",
    action_resolved: source + "の" + skill + "が解決した",
    action_skipped: source + "は行動しなかった",
    preparation_started: source + "が準備を始める",
    preparation_advanced: source + "の準備が進む",
    preparation_completed: source + "の準備が完了",
    preparation_interrupted: source + "の準備が止まった",
    // 受けで減ったぶんは、隠すと「なぜ通らないのか」が読めなくなる。
    damage_taken: arrow + target + " に " + number + " ダメージ"
      + (values.guardApplied > 0 ? "（受けで -" + values.guardApplied + "）" : ""),
    excess_damage: "攻撃が" + amountText + "余った",
    healing_applied: arrow + target + " を " + (values.actual ?? number) + " 回復",
    excess_healing: "回復が" + amountText + "余った",
    barrier_gained: target + " に防壁 " + number,
    // R6 §6.7 — block と guard。**何がどれだけ止めたのかを文字でも残す。**
    block_gained: target + " に受け構え " + number,
    block_spent: target + " の受け構えが1つ減った",
    damage_blocked: arrow + target + " の受け構えが " + (values.proposed ?? "") + " を止めた",
    resource_refreshed: target + "の" + resourceLabel(values.resource) + "が戻った",
    resource_unused: source + "は" + resourceLabel(values.resource) + "を余らせた",
    action_cost_paid: source + "が" + skill + "の代価を払った",
    round_ended: "ラウンド" + round + "終了",
    barrier_expired: target + "の防壁が切れた",
    status_removed: target + "の" + (statusInfo(values.statusId)?.displayName ?? "状態") + "が消えた",
    pending_amount_modified: "値が" + number + "へ変わった",
    damage_proposed: arrow + target + " へ " + number + " ダメージを提案",
    healing_proposed: arrow + target + " へ " + number + " 回復を提案",
    barrier_proposed: target + " へ防壁 " + number + " を提案",
    resource_gained: target + "が" + resourceLabel(values.resource) + amountText + "を得た",
    resource_spent: source + "が" + resourceLabel(values.resource) + amountText + "を使った",
    actor_moved: source + "が位置を替えた",
    status_added: target + "に" + (statusInfo(values.statusId)?.displayName ?? "状態")
      + (values.stacks > 1 ? values.stacks : ""),
    equipment_worn: source + "の装備が" + amountText + "摩耗した",
    equipment_broken: source + "の装備が壊れた",
    equipment_repaired: source + "の装備が" + amountText + "修理された",
    actor_defeated: target + "が倒れた",
    battle_ended: "戦闘終了 · " + (values.result || "決着"),
  };
  // ルール由来（リアクティブ・固有・装備）は、何が起こしたのかを添える。
  // 添えないと、ログでは主行動と見分けがつかない。
  const line = map[event.type] || event.type + amountText;
  return event.ruleId && cause ? line + cause : line;
}

function compactEvents(events) {
  return (events || []).filter((event) => replayTypes.has(event.type));
}

// 結果画面が使うぶんだけを控えへ残す。
//
// **result をそのまま保存すると端末の保存枠を超える。** 実測で第10戦の
// replaySnapshots だけで 5.8MB あった（localStorage は端末あたり数MB）。
// 再生に使う snapshot は compactReplay 側で別に持っているので、
// ここでは落とす。イベント列は結果画面のログ用に上限つきで残す。
const MAX_RESULT_EVENTS = 600;

function compactResult(result) {
  const events = result.events || [];
  const kept = events.length > MAX_RESULT_EVENTS
    ? [...events.slice(0, MAX_RESULT_EVENTS - 100), ...events.slice(-100)]
    : events;
  return {
    result: result.result,
    reason: result.reason,
    roundsUsed: result.roundsUsed,
    metrics: result.metrics,
    actors: result.actors,
    equipment: result.equipment,
    events: kept,
    eventsTotal: events.length,
  };
}

function compactReplay(result) {
  const events = [];
  const snapshots = [];
  (result?.events || []).forEach((event, index) => {
    if (!replayTypes.has(event.type)) return;
    events.push(event);
    snapshots.push(result.replaySnapshots?.[index] ?? null);
  });
  return { events, snapshots };
}

// ---------------------------------------------------------------- 戦闘の見せ方
//
// **ログは主役から降ろした。** 名前とHPの箱を人数分並べ、攻撃した側が相手へ踏み込み、
// 受けた側の箱の上へダメージ値が浮く。何が起きたかは動きで見せ、
// 「何のイベントが出たか」はデバッグログ（既定で閉じている）で確かめる。

// ---------------------------------------------------------------- 戦闘の見せ方
//
// **ログは主役から降ろした。** 名前・HP・行動権・状態の箱を人数分並べ、
// 攻撃した側が相手へ踏み込み、受けた側の箱の上へダメージ値が浮く。
// 何のイベントが出たかはデバッグログ（既定で閉）で確かめる。
//
// 進む単位は「拍」で、組み方は ecology/replay-beats.mjs にある。
// 主行動は必ず止め、自分に向いたサブ行動は攻撃と同時に出し、
// 事務（行動権の消費・解決の締め）は盤面に出さない。

function shortName(displayName) {
  return String(displayName ?? "").split(" — ")[0];
}

function unitIcon(actor) {
  return characterInfo(actor.definitionId)?.icon
    ?? ENEMY_ICONS[actor.definitionId]
    ?? (actor.side === "enemy" ? "◆" : "・");
}

function actorDefinition(actor) {
  return actor.side === "ally"
    ? PLAYABLE_CONTENT.characters[actor.definitionId]
    : PLAYABLE_CONTENT.enemyActors[actor.definitionId];
}

function statusInfo(statusId) {
  return PLAYABLE_CONTENT.statuses?.[statusId] ?? null;
}

function replaySpeed() {
  return REPLAY_SPEEDS.find((entry) => entry.id === state.replaySpeed) ?? REPLAY_SPEEDS[1];
}

function eventSkillName(event) {
  const values = event?.values || {};
  const skillId = values.activeSkillId || values.skillId || event?.skillId;
  return skillId ? nameFor(skillId) : null;
}

// サブ行動やパッシブは、どの技能が起こしたのかが分からないと読めない。
// ただし固有の性質（sourceDefinitionId が本人）は名前を出さない。
// 「スイ に防壁1（スイ — 先を読む人）」は、箱の上に浮いている時点で分かっている。
function eventCauseName(event) {
  const id = event?.ruleId ? event.sourceDefinitionId : null;
  if (!id) return null;
  const known = SKILLS.reactive?.[id] || SKILLS.active?.[id] || EQUIPMENT[id];
  return known ? shortName(nameFor(id)) : null;
}

function replayBeats() {
  const events = state.replayEvents || [];
  if (battleBeatsSource !== events) {
    battleBeats = buildBeats(events);
    battleBeatsSource = events;
  }
  return battleBeats;
}

function clampReplayIndex() {
  const beats = replayBeats();
  if (!beats.length) return 0;
  return Math.max(0, Math.min(state.replayIndex, beats.length - 1));
}

function currentBeat() {
  return replayBeats()[clampReplayIndex()] ?? null;
}

function replayActors() {
  const beat = currentBeat();
  return state.replaySnapshots?.[beat ? beat.to : 0]
    || state.replaySnapshots?.[0]
    || state.lastResult?.actors
    || [];
}

function layoutKeyOf(actors) {
  return actors.map((actor) => actor.instanceId + ":" + actor.position).join("|");
}

function unitHtml(actor) {
  return "<div class=\"unit\" data-unit=\"" + esc(actor.instanceId) + "\">"
    + "<div class=\"unit-floats\"></div>"
    + "<div class=\"unit-top\"><span class=\"unit-icon\">" + esc(unitIcon(actor))
    + "</span><b class=\"unit-name\">" + esc(shortName(actor.displayName))
    + "</b></div><div class=\"unit-bar\"><span class=\"unit-fill\"></span></div>"
    + "<div class=\"unit-stats\"><span class=\"unit-hp\"></span>"
    + "<span class=\"unit-marks\"></span><span class=\"unit-pips\"></span></div>"
    + "<div class=\"unit-cast\"></div></div>";
}

// 盤面は 2×3 のまま見せる。**折り返して並べ替えると隊列が読めなくなる**
// （前3後2 と 前2後3 の違いが、まさに「どの枠が空いているか」なので）。
const BATTLE_COLUMNS = ["left", "center", "right"];

function battleRowsHtml(actors, side) {
  const mine = actors.filter((actor) => actor.side === side);
  const rowsOrder = side === "enemy" ? ["rear", "front"] : ["front", "rear"];
  const rows = rowsOrder.map((row) => {
    const cells = BATTLE_COLUMNS.map((column) => {
      const actor = mine.find((entry) => entry.position === row + "_" + column);
      return actor ? unitHtml(actor) : "<div class=\"unit-empty\" aria-hidden=\"true\"></div>";
    }).join("");
    return "<div class=\"battle-row\"><span class=\"battle-row-label\">"
      + (row === "front" ? "前列" : "後列") + "</span><div class=\"battle-units\">" + cells + "</div></div>";
  }).join("");
  return "<span class=\"battle-side-label\">" + (side === "enemy" ? "敵" : "味方") + "</span>" + rows;
}

function renderBattle() {
  const beats = replayBeats();
  const actors = replayActors();
  const speedButtons = REPLAY_SPEEDS.map((entry) =>
    button(entry.label, "replay-speed", false, "speed-button" + (replaySpeed().id === entry.id ? " active" : ""),
      "data-speed=\"" + entry.id + "\"")).join("");
  return shell("戦闘", currentEncounter().name + " · 自動戦闘を見る", "<section class=\"card battle-card\">"
    + "<div class=\"replay-progress\"><span class=\"replay-progress-fill\"></span></div>"
    + "<div class=\"battle-field\" aria-live=\"off\">"
    + "<div class=\"battle-side\" data-side=\"enemy\">" + battleRowsHtml(actors, "enemy") + "</div>"
    + "<div class=\"battle-beat\"><span class=\"beat-round\"></span>"
    + "<p class=\"beat-text\" aria-live=\"polite\"></p><span class=\"beat-count\"></span></div>"
    + "<div class=\"battle-side\" data-side=\"ally\">" + battleRowsHtml(actors, "ally") + "</div>"
    + "</div>"
    + "<div class=\"replay-transport\">"
    + button("◀ 一手", "replay-back", true, "button", "data-role=\"replay-back\"")
    + button("自動再生", "replay-toggle", beats.length === 0, "button primary", "data-role=\"replay-toggle\"")
    + button("一手 ▶", "replay-step", true, "button", "data-role=\"replay-step\"")
    + "</div>"
    + "<div class=\"replay-speed\"><span class=\"replay-speed-label\">速さ</span>" + speedButtons + "</div>"
    + button("結果を見る", "replay-result", false, "button") + "</section>"
    + "<section class=\"card quiet\"><p class=\"eyebrow\">HOW TO READ</p>"
    + "<p class=\"muted\">踏み込んだ箱が動いた側、揺れた箱が受けた側です。箱の上に浮かぶ数字がダメージ（赤）・回復（緑）・防壁（青）、"
    + "箱の下の帯がHP、箱の中の札がいま使っている技能です。防御は3つあり、<b>◈防壁</b>は総量を受け、<b>▣受け構え</b>は一撃を丸ごと止め、<b>盾受け</b>は一撃ごとに固定で引きます。右下の粒は残っている行動権（金 ◆）と反応権（青 ◈）で、"
    + "金が尽きた仲間はそのラウンドの主行動を終えています。細かい因果を追いたいときだけ、下のデバッグログを開いてください。</p></section>"
    + "<details class=\"card debug-log\"" + (state.replayLogOpen ? " open" : "")
    + "><summary>デバッグログ（アニメーションで分かりにくいとき）</summary>"
    + "<p class=\"muted\">再生中の位置までのイベントを、新しい順に出しています。盤面では畳んだ行動権の消費や解決の締めも、ここには残ります。</p>"
    + "<ol class=\"events replay-events\"></ol></details>");
}

// いま誰がどの技能を使っているか。拍をまたいで札を出し続けるので、
// イベント列を頭から見て「開いている行動」を求める。
function castChips(events, upTo) {
  const chips = {};
  for (let i = 0; i <= upTo; i += 1) {
    const event = events[i];
    if (!event) continue;
    if (event.type === "round_started") {
      for (const key of Object.keys(chips)) delete chips[key];
      continue;
    }
    if (event.ruleId) continue;
    const id = eventSourceId(event);
    if (!id) continue;
    if (event.type === "action_declared" || event.type === "action_started") {
      chips[id] = eventSkillName(event) ?? "行動";
    } else if (event.type === "action_resolved" || event.type === "action_skipped") {
      delete chips[id];
    }
  }
  return chips;
}

function floatsFor(event) {
  const values = event.values || {};
  const targets = event.targetActorIds || [];
  const sourceId = eventSourceId(event);
  const cause = eventCauseName(event);
  const tone = (base) => (event.ruleId ? base + " from-rule" : base);
  switch (event.type) {
    case "damage_taken":
      return targets.map((id) => ({ actorId: id, text: "-" + (values.amount ?? 0), tone: tone("damage"), cause }));
    case "healing_applied": {
      const amount = values.actual ?? values.amount ?? 0;
      return amount > 0 ? targets.map((id) => ({ actorId: id, text: "+" + amount, tone: tone("heal"), cause })) : [];
    }
    case "barrier_gained":
      return targets.map((id) => ({ actorId: id, text: "◈" + (values.amount ?? 0), tone: tone("barrier"), cause }));
    case "actor_defeated":
      return targets.map((id) => ({ actorId: id, text: "撃破", tone: "defeat" }));
    case "damage_blocked":
      return targets.map((id) => ({ actorId: id, text: "止めた", tone: "blocked" }));
    case "block_gained":
      return targets.map((id) => ({ actorId: id, text: "▣" + (values.amount ?? 1), tone: "barrier" }));
    case "actor_moved":
      return sourceId ? [{ actorId: sourceId, text: "位置替え", tone: "move" }] : [];
    case "status_added": {
      const info = statusInfo(values.statusId);
      return info ? targets.map((id) => ({ actorId: id, text: info.displayName, tone: info.polarity === "negative" ? "bad" : "good" })) : [];
    }
    case "equipment_worn":
      return sourceId ? [{ actorId: sourceId, text: "装備 -" + (values.amount ?? 1), tone: "wear" }] : [];
    default:
      return [];
  }
}

function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function spawnFloat(unit, spec, offset) {
  const host = unit.querySelector(".unit-floats");
  if (!host) return;
  const node = document.createElement("span");
  node.className = "float " + spec.tone;
  // 同じ拍で複数浮くときに重ならないように、少しずつずらす。
  node.style.setProperty("--float-shift", (offset % 3 - 1) * 26 + "px");
  node.style.animationDelay = Math.min(offset, 3) * 70 + "ms";
  node.textContent = spec.cause ? spec.text + " " + spec.cause : spec.text;
  host.appendChild(node);
  setTimeout(() => node.remove(), 1400);
}

function updateReplayControls(index, beats) {
  const atEnd = index >= beats.length - 1;
  const toggle = app.querySelector("[data-role=\"replay-toggle\"]");
  if (toggle) {
    toggle.textContent = state.replayPlaying ? "一時停止" : (atEnd ? "最初から再生" : "自動再生");
    toggle.className = "button" + (state.replayPlaying ? "" : " primary");
    toggle.disabled = beats.length === 0;
  }
  const step = app.querySelector("[data-role=\"replay-step\"]");
  if (step) step.disabled = atEnd;
  const back = app.querySelector("[data-role=\"replay-back\"]");
  if (back) back.disabled = index <= 0;
  app.querySelectorAll(".speed-button[data-speed]").forEach((element) => {
    element.classList.toggle("active", element.dataset.speed === replaySpeed().id);
  });
}

function updateDebugLog(upTo, events) {
  const list = app.querySelector(".debug-log .replay-events");
  if (!list) return;
  const from = Math.max(0, upTo - 59);
  const rows = [];
  for (let i = upTo; i >= from; i -= 1) {
    const event = events[i];
    if (!event) continue;
    rows.push("<li class=\"event" + (i === upTo ? " current" : "") + (event.ruleId ? " from-rule" : "")
      + "\"><span class=\"event-round\">R" + (event.round ?? "-") + "</span><span>" + esc(eventText(event)) + "</span>"
      + "<code class=\"event-type\">" + esc(event.type) + "</code></li>");
  }
  list.innerHTML = rows.join("");
}

function unitPipsHtml(actor) {
  const definition = actorDefinition(actor);
  const apMax = Math.max(actor.actionPoints ?? 0, definition?.baseActionPoints ?? 0);
  const rpMax = Math.max(actor.reactionPoints ?? 0, definition?.baseReactionPoints ?? 0);
  const pips = [];
  for (let i = 0; i < apMax; i += 1) {
    pips.push("<i class=\"pip ap" + (i < (actor.actionPoints ?? 0) ? " on" : "") + "\"></i>");
  }
  if (apMax > 0 && rpMax > 0) pips.push("<i class=\"pip-gap\"></i>");
  for (let i = 0; i < rpMax; i += 1) {
    pips.push("<i class=\"pip rp" + (i < (actor.reactionPoints ?? 0) ? " on" : "") + "\"></i>");
  }
  return pips.join("");
}

function unitMarksHtml(actor) {
  const marks = [];
  // R6 §6.7 — 防御は3つある。**同じ「硬さ」でも問われるものが違う**ので、別々に出す。
  //   ◈ 防壁 … 総量を受ける
  //   ▣ 受け構え … 一撃を丸ごと止める（回数）
  //   盾 受け … 一撃ごとに固定で引く
  if (actor.block > 0) marks.push("<span class=\"mark block\">▣" + actor.block + "</span>");
  if (actor.barrier > 0) marks.push("<span class=\"mark barrier\">◈" + actor.barrier + "</span>");
  if (actor.guard > 0) marks.push("<span class=\"mark guard\">盾" + actor.guard + "</span>");
  for (const status of actor.statuses || []) {
    const info = statusInfo(status.statusId);
    if (!info) continue;
    marks.push("<span class=\"mark " + (info.polarity === "negative" ? "bad" : "good") + "\">"
      + esc(info.displayName) + (status.stacks > 1 ? status.stacks : "") + "</span>");
  }
  return marks.join("");
}

function syncBattleView(options = {}) {
  if (state.phase !== "battle") return;
  const field = app.querySelector(".battle-field");
  if (!field) return;
  const events = state.replayEvents || [];
  const beats = replayBeats();
  const index = clampReplayIndex();
  const beat = beats[index] ?? null;
  const upTo = beat ? beat.to : 0;
  const actors = replayActors();

  const key = layoutKeyOf(actors);
  if (key !== battleLayoutKey) {
    const enemySide = field.querySelector("[data-side=\"enemy\"]");
    const allySide = field.querySelector("[data-side=\"ally\"]");
    if (enemySide) enemySide.innerHTML = battleRowsHtml(actors, "enemy");
    if (allySide) allySide.innerHTML = battleRowsHtml(actors, "ally");
    battleLayoutKey = key;
  }

  const chips = castChips(events, upTo);
  const unitOf = (id) => (id ? field.querySelector("[data-unit=\"" + CSS.escape(id) + "\"]") : null);

  for (const actor of actors) {
    const unit = unitOf(actor.instanceId);
    if (!unit) continue;
    const ratio = actor.maxHp > 0 ? Math.max(0, Math.min(1, actor.hp / actor.maxHp)) : 0;
    const fill = unit.querySelector(".unit-fill");
    if (fill) {
      fill.style.width = (ratio * 100) + "%";
      fill.className = "unit-fill" + (ratio <= 0.25 ? " critical" : ratio <= 0.55 ? " low" : "");
    }
    const hp = unit.querySelector(".unit-hp");
    if (hp) hp.textContent = actor.alive ? actor.hp + "/" + actor.maxHp : "戦闘不能";
    const marks = unit.querySelector(".unit-marks");
    if (marks) marks.innerHTML = unitMarksHtml(actor);
    const pips = unit.querySelector(".unit-pips");
    if (pips) pips.innerHTML = unitPipsHtml(actor);
    unit.classList.toggle("defeated", !actor.alive);
    // 行動権が尽きた＝そのラウンドの主行動を終えている。
    unit.classList.toggle("spent", actor.alive && (actor.actionPoints ?? 0) === 0);
    const cast = unit.querySelector(".unit-cast");
    if (cast) {
      const prep = actor.preparation;
      if (prep) {
        cast.textContent = "準備 " + nameFor(prep.skillId) + "（残" + prep.stepsRemaining + "）";
        cast.className = "unit-cast prep show";
      } else if (actor.alive && chips[actor.instanceId]) {
        cast.textContent = chips[actor.instanceId];
        cast.className = "unit-cast show";
      } else {
        cast.textContent = "";
        cast.className = "unit-cast";
      }
    }
  }

  field.querySelectorAll(".unit").forEach((unit) => unit.classList.remove("is-acting", "is-aimed"));

  if (beat) {
    const head = beat.events[0];
    const actingId = eventSourceId(head);
    const actingUnit = unitOf(actingId);
    if (actingUnit) actingUnit.classList.add("is-acting");
    if (actingUnit && (beat.kind === "impact" || beat.kind === "sub") && !options.silent) {
      restartAnimation(actingUnit, "is-striking");
    }
    if (beat.kind === "declare" || beat.kind === "impact") {
      for (const event of beat.events) {
        for (const id of event.targetActorIds || []) unitOf(id)?.classList.add("is-aimed");
      }
    }
    if (!options.silent) {
      let offset = 0;
      for (const event of beat.events) {
        for (const id of event.targetActorIds || []) {
          const unit = unitOf(id);
          if (!unit) continue;
          if (event.type === "damage_taken" || event.type === "actor_defeated") restartAnimation(unit, "is-hit");
          else if (event.type === "healing_applied") restartAnimation(unit, "is-healed");
          else if (event.type === "barrier_gained") restartAnimation(unit, "is-shielded");
        }
        for (const spec of floatsFor(event)) {
          const unit = unitOf(spec.actorId);
          if (unit) spawnFloat(unit, spec, offset++);
        }
      }
    }
  }

  const beatText = field.querySelector(".beat-text");
  if (beatText) {
    const text = beat ? beatText_(beat) : "戦闘開始";
    if (beatText.textContent !== text) {
      beatText.textContent = text;
      restartAnimation(beatText, "pulse");
    }
  }
  const beatRound = field.querySelector(".beat-round");
  if (beatRound) beatRound.textContent = "R" + (beat?.events[0]?.round ?? "-");
  const beatCount = field.querySelector(".beat-count");
  if (beatCount) beatCount.textContent = (beats.length ? index + 1 : 0) + " / " + beats.length;
  const progress = app.querySelector(".replay-progress-fill");
  if (progress) progress.style.width = (beats.length ? Math.round(((index + 1) / beats.length) * 100) : 100) + "%";

  updateReplayControls(index, beats);
  updateDebugLog(upTo, events);
  scheduleReplayBeat();
}

// 拍の一行。同時に出したものは「＋」で並べる（並列に出したことが読めるように）。
// **同じことを二度言わない。** 「レオンの斬撃が始まる ＋ レオン → 敵に5ダメージ」は
// 二行ぶんの場所を取って一行ぶんしか伝えない。
function beatText_(beat) {
  const head = beat.events[0];
  if (beat.kind === "declare") {
    const targets = [];
    for (const event of beat.events) {
      for (const id of event.targetActorIds || []) if (!targets.includes(id)) targets.push(id);
    }
    return actorName(eventSourceId(head)) + "：" + (eventSkillName(head) ?? "行動")
      + (targets.length ? " → " + targets.map(actorName).join("、") : "");
  }
  // 着弾の拍は、結果の行があるなら「始まる」を省く。
  const meaty = beat.events.filter((event) => event.type !== "action_started");
  const parts = [];
  for (const event of (meaty.length ? meaty : beat.events)) {
    const line = eventText(event);
    if (line && !parts.includes(line)) parts.push(line);
  }
  return parts.join(" ＋ ") || "戦闘開始";
}

function mountBattleView() {
  battleLayoutKey = null;
  const details = app.querySelector("details.debug-log");
  if (details) {
    details.addEventListener("toggle", () => {
      state.replayLogOpen = details.open;
      saveState();
    });
  }
  syncBattleView({ silent: true });
}

function diagnosticEventText(event, actorLabels) {
  const source = actorLabels?.[event.sourceActorId] ?? event.sourceActorId ?? "—";
  const targets = (event.targetActorIds || []).map((id) => actorLabels?.[id] ?? id).join("、");
  const rule = event.ruleId ? " · rule " + event.ruleId : "";
  const skill = event.skillId ? " · skill " + event.skillId : "";
  return event.id + " · R" + (event.round ?? "-") + " · " + event.type + " · " + source
    + (targets ? " → " + targets : "") + rule + skill;
}

function renderBattleError() {
  const failure = state.battleError || {};
  const diagnostics = failure.diagnostics || {};
  const recent = diagnostics.recentEvents || [];
  const actorLabels = failure.actorLabels || {};
  const stack = diagnostics.ruleActivationStack || [];
  return shell("戦闘を停止しました", currentEncounter().name + " · 構成を見直してください", "<section class=\"card verdict loss\">"
    + "<div class=\"verdict-mark\">!</div><h2>安全弁が働きました</h2><p>この構成の戦闘イベントが上限を超えたため、途中結果を破棄しました。原因を確認できるよう、直前のイベントを残しています。</p>"
    + "<p class=\"error battle-error-message\">" + esc(failure.message || "battle runtime error") + "</p>"
    + "<div class=\"metrics\"><span><b>" + (diagnostics.eventSequence ?? "—") + "</b><small>イベント番号</small></span><span><b>"
    + esc(actorLabels[diagnostics.currentActorId] ?? diagnostics.currentActorId ?? "—") + "</b><small>実行中</small></span><span><b>"
    + esc(diagnostics.chainId ?? "—") + "</b><small>チェーン</small></span><span><b>" + recent.length + "</b><small>直前ログ</small></span></div></section>"
    + "<section class=\"card\">" + sectionHeading("DIAGNOSTICS", "直前のイベント")
    + "<p class=\"muted\">技能やリアクティブの組み合わせで、同じイベントが繰り返されていないか確認できます。</p><ol class=\"events diagnostic-events\">"
    + recent.map((event) => "<li class=\"event\"><span class=\"event-round\">R" + (event.round ?? "-") + "</span><span>"
      + esc(diagnosticEventText(event, actorLabels)) + "</span></li>").join("") + "</ol>"
    + (stack.length ? "<details><summary>発火中のリアクティブ</summary><pre>" + esc(JSON.stringify(stack, null, 2)) + "</pre></details>" : "")
    + "<details><summary>エンジン診断データ</summary><pre>" + esc(JSON.stringify(diagnostics, null, 2)) + "</pre></details></section>"
    + "<section class=\"card quiet\"><p class=\"muted\">通常のプレイでこの画面が出る場合は、直前に装着した0コスト行動や、準備・行動権を互いに増やすリアクティブを外して再試行してください。</p>"
    + "<div class=\"flow-actions\">" + button("スキルを見直す", "retry-build", false, "button primary")
    + button("戦闘前へ戻る", "back-battle-preview", false, "button") + "</div></section>");
}

function resultActors(result) {
  // R8 §1.5 — Campaign Stage は「次戦」も持ち越しHP（run.currentHp、
  // commitBattleResultが既に確定済み）。Free / Endless は従来どおり毎戦満タン。
  return (result?.actors || []).filter((actor) => actor.side === "ally").map((actor) => {
    const characterId = String(actor.instanceId ?? "").replace(/^a_/, "");
    const nextHp = isCampaignRun()
      ? Math.max(0, Math.min(actor.maxHp, state.run.currentHp?.[characterId] ?? actor.maxHp))
      : actor.maxHp;
    return "<div class=\"result-actor\"><span class=\"avatar small\">" + esc(characterInfo(actor.definitionId)?.icon ?? "・")
      + "</span><div><b>" + esc(String(actor.displayName).split(" — ")[0]) + "</b><small>"
      + (actor.alive ? "戦闘内 HP " + actor.hp + "/" + actor.maxHp : "戦闘内 戦闘不能")
      + " → 次戦 HP " + nextHp + "/" + actor.maxHp + " · 防壁 " + actor.barrier + "</small></div></div>";
  }).join("");
}

function renderResult() {
  const result = state.lastResult;
  if (!result) return renderCamp();
  const won = result.result === "win";
  const metrics = result.metrics || {};
  const events = compactEvents(result.events || state.replayEvents);
  const shown = events.length > 40 ? [...events.slice(0, 30), ...events.slice(-10)] : events;
  // R6 §12.2 — **敗北で即座に遠征を破棄しない。**補給が残っていれば再挑戦へ。
  // R9 §2.1 — 序盤の敗北は遠征の結果に数えない。ここから巻き戻す。
  const next = state.prologueActive
    ? button("時間が巻き戻る", "rewind-prologue", false, "button primary")
    : won
      ? state.run.encounterIndex >= ENCOUNTERS_PER_RUN
        ? button("遠征を精算する", "settle-run", false, "button primary")
        : button("報酬を見る", "show-reward", false, "button primary")
      : button("この先どうするか", "show-defeat", false, "button primary");
  const equipment = (result.equipment || []).map((item) => "<div class=\"result-gear\"><b>"
    + esc(gear(item.equipmentId)?.label ?? item.equipmentId) + "</b><span>"
    + "戦闘内 " + item.durability + " / " + item.maxDurability + " → 次戦 "
    + item.maxDurability + " / " + item.maxDurability + "</span></div>").join("");
  return shell(won ? "突破した" : "足を止めた", currentEncounter().name + " · " + result.roundsUsed + "ラウンド", "<section class=\"card verdict "
    + (won ? "win" : "loss") + "\"><div class=\"verdict-mark\">" + (won ? "✓" : "×")
    + "</div><h2>" + (won ? "この組み合わせは通った" : "この組み合わせでは届かなかった")
    + "</h2><p>" + (won ? "構成の因果を確認し、次の報酬でさらに変えられます。" : "敵の狙い、技能の優先順、装備の持たせ先を見直せます。")
    + "</p><div class=\"metrics\"><span><b>" + (metrics.allyHpLost ?? 0) + "</b><small>味方HP損失</small></span><span><b>"
    + (metrics.enemyHpLost ?? 0) + "</b><small>敵HP損失</small></span><span><b>" + (metrics.reactionsFired ?? 0)
    + "</b><small>反応発火</small></span><span><b>" + (metrics.equipmentWear ?? 0) + "</b><small>装備摩耗</small></span></div></section>"
    + "<section class=\"card\">" + sectionHeading("AFTER BATTLE", "次の戦闘へ持ち越す状態")
    + "<p class=\"muted\">" + (isCampaignRun()
      ? "装備耐久は次の戦闘へ持ち越しません（次戦は最大から）。<b>HPは持ち越します。</b>4戦目・8戦目のボスを倒したときだけ全員が全回復します（R8 §1.5）。"
      : "戦闘中のHPと装備耐久は次の戦闘へ持ち越しません。次の戦闘は、全員HP最大・装備耐久最大から始まります。")
    + "</p>"
    + (state.prologueActive
      ? "<p class=\"muted\"><b>この一戦は遠征に数えません。</b>活動資金も持ち越しHPも動きません。"
        + esc(PROLOGUE.hint) + "</p>"
      : "<p class=\"muted\">この遠征の仮計上: <b>" + formatFunds(state.run.fundLedger.provisionalTotal)
        + "</b>（到達 " + state.run.fundLedger.highestClearedEncounter + " / " + ENCOUNTERS_PER_RUN
        + "）。<b>負けても、ここまで確定した分は持ち帰ります。</b></p>") + "<div class=\"result-actors\">"
    + resultActors(result) + "</div><div class=\"result-gear-list\">" + (equipment || "<p class=\"muted\">装備なし</p>")
    + "</div></section>"
    // **因果はまずアニメーションで見せる。** 文字の一覧は、見返したいときの補助に降ろした。
    + (state.replayEvents?.length
      ? "<section class=\"card\">" + sectionHeading("CAUSE & EFFECT", "何が起きたかをもう一度見る")
        + "<p class=\"muted\">同じ戦闘を最初から、同じ順で再生します。決着までの因果は、箱の動きとダメージ値で追えます。</p>"
        + button("戦闘をもう一度見る", "replay-again", false, "button") + "</section>"
      : "")
    + "<details class=\"card debug-log\"><summary>デバッグログ（" + events.length + " イベント"
    + (result.eventsTotal && result.eventsTotal > (result.events || []).length
      ? " · 全 " + result.eventsTotal + " 件のうち端末に残した分" : "") + "）</summary>"
    + "<p class=\"muted\">アニメーションで分かりにくかったところを、文字で確かめるためのものです。</p>"
    + "<ol class=\"events\">" + shown.map((event) => "<li class=\"event\"><span class=\"event-round\">R"
      + (event.round ?? "-") + "</span><span>" + esc(eventText(event)) + "</span>"
      + "<code class=\"event-type\">" + esc(event.type) + "</code></li>").join("") + "</ol>"
    + "<details><summary>全イベントを見る</summary><pre>" + esc((result.events || state.replayEvents || []).map(eventText).join("\n")) + "</pre></details></details>"
    + next);
}

// R6 §5.3 — 通常戦勝利後は4候補から1つ。
// **活動資金はこの4候補に入らない。**補給や技能点を選んでも資金は減らない。
function renderReward() {
  const rewardCharacter = state.selectedRewardCharacter && state.run.roster.includes(state.selectedRewardCharacter)
    ? state.selectedRewardCharacter
    : state.run.roster[0];
  const full = state.run.inventory.length >= INVENTORY_LIMIT;
  const cards = state.rewardOffer.map((offer, index) => {
    if (offer.type === "equipment") {
      // R8 §13.2 — 生成装備は**最初から全 rule を読める**。目利きは等級の引きを
      // 良くするもので、読める量を売る仕組みにはしない（R8 §11 の完全開示）。
      const item = offer.item ?? null;
      const info = item
        ? { label: item.definition.displayName, effect: "", grammar: "生成 · " + (RARITY_LABEL[item.rarity] ?? item.rarity), maxDurability: item.definition.maxDurability }
        : EQUIPMENT[offer.equipmentId];
      const body = item
        ? (item.readout?.lines ?? []).map((line) => "<p>" + esc(line) + "</p>").join("")
          + (item.readout?.keystone ? "<p class=\"keystone-line\">" + esc(item.readout.keystone) + "</p>" : "")
        : "<p>" + esc(info?.effect ?? "") + "</p>";
      return "<article class=\"reward-card" + (item ? " generated" : "") + "\"><div class=\"reward-kind kind-equipment\">"
        + (item ? "生成装備" : "装備") + "</div><h3>"
        + esc(info?.label ?? offer.equipmentId) + rarityChip(item?.rarity) + "</h3>" + body + "<small>"
        + esc(info?.grammar ?? "") + " · 戦闘耐久 " + (info?.maxDurability ?? 1) + "</small>"
        + (full ? "<p class=\"muted\">持ち物が" + INVENTORY_LIMIT + "品で一杯です。装備画面で一品を分解してください。</p>" : "")
        + button("拾って次へ", "take-reward", full, "button", "data-offer=\"" + index + "\"") + "</article>";
    }
    // R8 §3.5 — 生成に失敗したら既定品へ黙って落とさず、診断をそのまま出す。
    if (offer.type === "generator_error") {
      return "<article class=\"reward-card\"><div class=\"reward-kind kind-equipment\">生成できず</div>"
        + "<h3>装備の候補が作れませんでした</h3><p>" + esc(offer.message) + "</p>"
        + "<small>この候補は選べません。ほかの候補を選ぶか、補給1で引き直してください。</small></article>";
    }
    if (offer.type === "skill_points") {
      const picker = state.run.roster.map((id) => "<button type=\"button\" class=\"reward-pick "
        + (id === rewardCharacter ? "selected" : "") + "\" data-action=\"select-reward-character\" data-character=\""
        + id + "\">" + esc(characterName(id)) + "</button>").join("");
      return "<article class=\"reward-card special\"><div class=\"reward-kind kind-active\">成長</div><h3>技能点 +"
        + offer.amount + "</h3><p>選んだ一人の遠征内技能点が " + offer.amount + " 増える。<b>遠征が終わると消えます。</b></p>"
        + "<div class=\"reward-picker\">" + picker + "</div>"
        + button("この仲間へ配る", "take-reward", false, "button", "data-offer=\"" + index + "\"") + "</article>";
    }
    return "<article class=\"reward-card special\"><div class=\"reward-kind kind-passive\">補給</div><h3>補給 +"
      + offer.amount + "</h3><p>再挑戦・報酬の引き直し・偵察に使う。上限 " + MAX_SUPPLIES + "。現在 "
      + state.run.supplies + "。</p>"
      + button("補給を受け取る", "take-reward", state.run.supplies >= MAX_SUPPLIES, "button",
        "data-offer=\"" + index + "\"") + "</article>";
  }).join("");
  const rerolls = state.run.rerollsUsed?.[state.run.encounterIndex] ?? 0;
  return shell("報酬を選ぶ", currentEncounter().name + "を突破 · 次の戦闘へ", "<section class=\"card\">"
    + sectionHeading("REWARD / 4 → 1", "何を持ち帰る？", "<span class=\"stage\">補給 " + state.run.supplies + "</span>")
    + "<p class=\"muted\">4候補から1つだけ選びます。<b>活動資金はこの選択に含まれません</b>（補給や技能点を選んでも、持ち帰る資金は減りません）。</p>"
    + (state.rewardOffer.filter((offer) => offer.type === "equipment").length < 2
      ? "<p class=\"muted\">装備の候補が減っています。生成が失敗した場合は理由が候補欄に出ます。</p>"
      : "")
    + (appraisalLevel(state.profile) > 0
      ? "<p class=\"muted\">目利き Lv" + appraisalLevel(state.profile)
        + "：生成装備の等級を " + (appraisalLevel(state.profile) + 1) + " 回引いて良い方を採っています。</p>"
      : "")
    + "<div class=\"reward-grid\">" + cards + "</div>"
    + "<div class=\"reward-reroll\">"
    + button("補給1で4候補を引き直す", "reroll-reward", state.run.supplies < 1 || rerolls >= 1, "button")
    + "<small>" + (rerolls >= 1 ? "この戦闘ではもう引き直せません。" : "引き直しは1戦闘につき一度だけ。使うと再挑戦の余地が減ります。")
    + "</small></div></section>");
}

// R6 §12.2 — 敗北処理。**即座に破棄しない。**
function renderDefeat() {
  const canRetry = state.run.supplies >= 1;
  return shell("足を止めた", currentEncounter().name + " · 補給 " + state.run.supplies, "<section class=\"card verdict loss\">"
    + "<div class=\"verdict-mark\">×</div><h2>この組み合わせでは届かなかった</h2>"
    + "<p>敵は強化されません。報酬も変わりません。<b>補給1で編成・位置・技能・装備を変えて、同じ戦闘へもう一度挑めます。</b></p>"
    + "</section>"
    + "<section class=\"card\">" + sectionHeading("SUPPLIES", "残っている手")
    + suppliesBar(canRetry ? "再挑戦に1つ使う" : "補給が尽きた") + "</section>"
    + "<section class=\"card\">" + sectionHeading("CARRY HOME", "ここまでで確定した活動資金")
    + "<p class=\"muted\">撃破した戦闘と到達距離は、負けても持ち帰ります。</p>"
    + "<p class=\"fund-line\"><b>" + formatFunds(state.run.fundLedger.provisionalTotal) + "</b>"
    + "<small>撃破 " + state.run.fundLedger.clearedEncounterBase + " · 到達 "
    + state.run.fundLedger.highestClearedEncounter + " 戦 · 難易度 ×"
    + (state.run.fundLedger.difficultyMultiplierBps / 10000).toFixed(1) + "</small></p>"
    + (canRetry
      ? button("補給1で編成を変えて再挑戦", "retry-encounter", false, "button primary")
      : "<p class=\"muted\">補給が0なので、この遠征はここで終わります。</p>")
    + button("遠征を終えて精算する", "settle-run", false, canRetry ? "button" : "button primary") + "</section>");
}

// R8 §3.6 / §10.3 — 遠征終了時に残った設計図。**何が残り、何が残らなかったかを
// 両方出す。**「良い品を拾ったのに残らなかった」を黙って起こさない。
function blueprintSettlementSection(settlement) {
  const saved = settlement.savedBlueprints ?? [];
  const found = newGeneratedItems(state.run).length;
  if (!found && !saved.length) return "";
  const cards = saved.map((entry) =>
    "<div class=\"settle-row\"><span>" + esc(entry.displayName) + rarityChip(entry.rarity)
    + "</span><b>" + (entry.added ? "新しく残した" : "取得履歴を追加") + "</b></div>").join("");
  return "<section class=\"card\">" + sectionHeading("BLUEPRINT", "設計図として残した品",
      "<span class=\"stage\">" + saved.length + " / " + settlement.blueprintSaveLimit + "</span>")
    + (saved.length
      ? "<div class=\"settle-list\">" + cards + "</div>"
      : "<p class=\"muted\">今回は残せる品がありませんでした。</p>")
    + (found > saved.length
      ? "<p class=\"muted\">この遠征で見つけた生成装備 " + found + " 品のうち、等級の高い "
        + saved.length + " 品だけを残しました。</p>"
      : "")
    + "<p class=\"muted\">設計図はギルドの Blueprint 画面から、次の遠征へ持ち込めます"
    + "（持込枠 " + blueprintCarryCapacity(state.profile) + "）。</p></section>";
}

// R9 §7 — Stage を越えたときだけ、次へ進む理由を短く示す。
// **勝ったときだけ。**負けた遠征のあとに「次へ進む理由」を出しても嘘になる。
function stageEndStorySection(settlement) {
  if (settlement.outcome !== "won") return "";
  const stage = CAMPAIGN_STAGES[state.run.campaignStageSequence];
  const beatDef = stage ? storyBeat(stage.id, "stageEnd") : null;
  if (!beatDef) return "";
  const lines = beatDef.lines.map((line) => line.speaker
    ? "<p class=\"story-line\"><b>" + esc(line.speaker) + "</b><span>" + esc(line.text) + "</span></p>"
    : "<p class=\"story-line narration\">" + esc(line.text) + "</p>").join("");
  return "<section class=\"card story-card\">" + sectionHeading("STORY", esc(beatDef.title))
    + "<div class=\"story-lines\">" + lines + "</div>"
    + (beatDef.footer ? "<p class=\"muted story-footer\">" + esc(beatDef.footer) + "</p>" : "")
    + "</section>";
}

// R6 §9.2 — 精算は**一度だけ**。ここが唯一の入口。
function renderSettlement() {
  const settlement = state.lastSettlement;
  if (!settlement) return renderExpeditionStart();
  const b = settlement.breakdown;
  const won = settlement.outcome === "won";
  // R8 §10.3 — 安全撤退は敗北ではない。完走・初clearボーナスは付かないが、
  // 確定済み活動資金はそのまま持ち帰る（撃破ゼロ没収はしない）。
  const retreated = settlement.outcome === "retreat";
  const rows = [
    ["撃破した戦闘", b.clearedEncounterBase],
    ["到達距離（" + state.run.fundLedger.highestClearedEncounter + "戦 × 25）", b.distance],
    ["12戦完走", b.outcomeBonus],
    ["この難易度の初回クリア", b.firstClearBonus],
  ].map(([label, value]) => "<div class=\"settle-row\"><span>" + esc(label) + "</span><b>" + value + "</b></div>").join("");
  const title = won ? "遠征を終えた" : retreated ? "安全に撤退した" : "遠征は途中で終わった";
  return shell(title,
    "難易度 " + state.run.difficulty + " · " + state.run.fundLedger.highestClearedEncounter + " / " + ENCOUNTERS_PER_RUN + " 戦",
    "<section class=\"card verdict " + (won ? "win" : "loss") + "\"><div class=\"verdict-mark\">"
    + (won ? "✦" : retreated ? "◇" : "◆") + "</div><h2>活動資金 " + formatFunds(settlement.earned) + " を持ち帰った</h2>"
    + "<p>残高 " + formatFunds(settlement.balanceBefore) + " → <b>" + formatFunds(settlement.balanceAfter) + "</b></p></section>"
    + "<section class=\"card\">" + sectionHeading("SETTLEMENT", "内訳")
    + "<div class=\"settle-list\">" + rows + "</div>"
    + "<div class=\"settle-row total\"><span>難易度倍率</span><b>×"
    + (b.difficultyMultiplierBps / 10000).toFixed(1) + "</b></div>"
    + "<div class=\"settle-row total\"><span>合計</span><b>" + formatFunds(settlement.earned) + "</b></div>"
    + "<p class=\"muted\">遠征内の技能点・解禁・装備・補給はここで消えます（R6 §5.3）。持ち帰るのは"
    + "活動資金と、下の設計図だけです。今回の結果分類（"
    + esc(won ? "勝利" : retreated ? "安全撤退" : "敗北") + "）では最大" + settlement.blueprintSaveLimit
    + "件を残せます。</p></section>"
    + blueprintSettlementSection(settlement)
    + stageEndStorySection(settlement)
    + (settlement.unlockedDifficulty !== null
      ? "<section class=\"card\"><p class=\"eyebrow\">DIFFICULTY</p><h3>難易度 "
        + settlement.unlockedDifficulty + " が開いた</h3><p class=\"muted\">"
        + esc(difficultyDef(settlement.unlockedDifficulty).summary) + "</p></section>"
      : "")
    + (settlement.unlockedCampaignStage !== null && settlement.unlockedCampaignStage !== undefined
      ? "<section class=\"card\"><p class=\"eyebrow\">CAMPAIGN STAGE</p><h3>"
        + esc(CAMPAIGN_STAGES[settlement.unlockedCampaignStage]?.displayName ?? ("Stage " + settlement.unlockedCampaignStage))
        + " が開いた</h3></section>"
      : "")
    + "<section class=\"card quiet\">"
    + button("ギルドへ戻る", "back-guild", false, "button primary")
    + button("記録を送る", "complete", false, "button") + "</section>");
}

function renderComplete() {
  const feedback = state.feedback || {};
  const option = (value, label, selected) => "<option value=\"" + value + "\" " + (selected ? "selected" : "") + ">" + label + "</option>";
  const trail = state.run.roster.map(characterName).join("、");
  const carried = state.run.inventory.map((id) => gear(id)?.label ?? id).join("、");
  const reached = state.run.fundLedger.highestClearedEncounter;
  const settlement = state.lastSettlement;
  return shell("遠征を終えた", "今回の編成と因果を記録する", "<section class=\"card verdict win\"><div class=\"verdict-mark\">✦</div><h2>"
    + reached + " / " + ENCOUNTERS_PER_RUN + " 戦を見届けた</h2><p>今回の仲間: "
    + esc(trail) + "<br>手元の装備: " + esc(carried || "なし")
    + (settlement ? "<br>持ち帰った活動資金: " + formatFunds(settlement.earned) : "")
    + "</p><div class=\"build-trail\"><span><i>1</i>遠征を仕立てた</span><span><i>2</i>技能パックの範囲で技能を組んだ</span><span><i>3</i>補給をどこへ使うか決めた</span><span><i>4</i>持ち帰った資金でギルドを育てた</span></div></section>"
    + "<section class=\"card feedback\"><p class=\"eyebrow\">HUMAN CHECK</p><h2>今回のUIについて</h2><label>もう一度遊びたい度<select id=\"feedback-replay\">"
    + option("", "選択してください", !feedback.replay) + option("1", "1 — もう遊ばない", feedback.replay === "1")
    + option("2", "2", feedback.replay === "2") + option("3", "3", feedback.replay === "3")
    + option("4", "4", feedback.replay === "4") + option("5", "5 — もう一度遊びたい", feedback.replay === "5")
    + "</select></label><label>感情マーカー<select id=\"feedback-marker\">"
    + option("", "選択なし", !feedback.marker) + option("hit", "きた！", feedback.marker === "hit")
    + option("insight", "ひらめいた", feedback.marker === "insight") + option("choice", "迷う", feedback.marker === "choice")
    + option("payoff", "うまくいった", feedback.marker === "payoff") + option("friction", "つらい", feedback.marker === "friction")
    + option("unclear", "わからない", feedback.marker === "unclear") + "</select></label><label>一番分かりやすかったところ<textarea id=\"feedback-clear\">"
    + esc(feedback.clear || "") + "</textarea></label><label>一番分かりにくかったところ<textarea id=\"feedback-confusing\">"
    + esc(feedback.confusing || "") + "</textarea></label>" + button("保存して送信", "save-feedback", false, "button primary")
    + "<p id=\"feedback-status\" class=\"hint\">D1へ送信すると、編成・技能・装備・戦闘イベントも一緒に保存されます。</p></section>");
}

function stopReplayTimer() {
  if (replayTimer) {
    clearTimeout(replayTimer);
    replayTimer = null;
  }
}

// 拍ごとに全状態を書き出すと、リプレイのなめらかさをlocalStorageに食われる。
// 進行位置の控えは間引き、止めたとき・進めたときは即座に書く。
function saveStateSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveState();
  }, 700);
}

function scheduleReplayBeat() {
  stopReplayTimer();
  if (state.phase !== "battle" || !state.replayPlaying) return;
  const beats = replayBeats();
  const index = clampReplayIndex();
  if (index >= beats.length - 1) {
    state.replayPlaying = false;
    saveState();
    updateReplayControls(index, beats);
    return;
  }
  replayTimer = setTimeout(() => {
    replayTimer = null;
    if (state.phase !== "battle" || !state.replayPlaying) return;
    state.replayIndex = clampReplayIndex() + 1;
    saveStateSoon();
    syncBattleView();
  }, beatDurationMs(beats[index], replaySpeed().factor));
}

function advanceAfterReward() {
  state.run.encounterIndex += 1;
  state.rewardOffer = [];
  state.lastResult = null;
  state.replayEvents = [];
  state.replaySnapshots = [];
  state.replayIndex = 0;
  state.replayPlaying = false;
  state.phase = "camp";
  state.tab = "map";
  state.error = null;
  state.run.act = actOfIndex(state.run.encounterIndex);
  record("stage_advanced", { encounter: state.run.encounterIndex, act: state.run.act });
  saveState();
  render();
}

function ensureSelectedCharacter() {
  state.selectedCharacter = selectedCharacter();
}

function handleAction(event) {
  const element = event.currentTarget;
  const action = element.dataset.action;
  captureSkillTreeScroll();
  state.error = null;

  if (action === "new-game") {
    if (hasAutoSave() && !window.confirm("現在のオートセーブを新しいGameで置き換えます。手動セーブ枠は残ります。")) return;
    const profile = newProfile();
    const run = startRun(profile, { campaignStageSequence: 0 });
    state = {
      ...freshUiState(),
      profile,
      run,
      phase: "story",
      expeditionMode: "campaign",
      selectedCampaignStageSequence: 0,
      runId: run.runId,
      startedAt: run.startedAt,
      formationSelection: run.roster[0] ?? null,
    };
    record("run_started", {
      runId: state.run.runId,
      seed: state.run.runSeed,
      version: VERSION,
      difficulty: state.run.difficulty,
      packs: [...state.run.manifest.enabledPackIds],
      supplies: state.run.supplies,
      roster: [...state.run.roster],
    });
    enterStory([storyBeat("stage_0_edge", "opening")], "prologue");
    return;
  }

  if (action === "continue-game") {
    loadSavedGame(SAVE_KEY);
    return;
  }

  if (action === "load-auto") {
    loadSavedGame(SAVE_KEY);
    return;
  }

  if (action === "open-save-menu") {
    state.saveMenuReturn = element.dataset.return === "camp" ? "camp" : "intro";
    state.saveNotice = null;
    state.error = null;
    state.phase = "saveMenu";
    render();
    return;
  }

  if (action === "back-title") {
    state.phase = "intro";
    state.saveMenuReturn = "intro";
    state.saveNotice = null;
    state.error = null;
    saveState();
    render();
    return;
  }

  if (action === "save-slot") {
    saveManualSlot(Number(element.dataset.slot));
    return;
  }

  if (action === "load-slot") {
    const slot = Number(element.dataset.slot);
    if (Number.isInteger(slot) && slot >= 1 && slot <= MANUAL_SAVE_SLOTS) {
      loadSavedGame(manualSaveKey(slot));
    }
    return;
  }

  if (action === "reset") {
    state = initialState();
    saveState();
    render();
    return;
  }

  // intro からも精算後からも、まずギルド（遠征を仕立てる画面）へ入る。
  if (action === "start" || action === "new-expedition" || action === "back-guild") {
    const profile = state.profile;
    // **rank は state を差し替える前に決める。**あとで決めると、
    // clamp は新しい state（常に0）を読み、run は前の選択で作られて、
    // 画面が「難易度0」と言いながら rank 1 を走らせる。
    const ranks = availableDifficulties(profile);
    const rank = Math.min(state.selectedDifficulty ?? 0, ranks[ranks.length - 1]);
    // R8 Implementation Phase 1 — mode を保ち、campaign なら解禁済みStageへ丸める。
    const mode = state.expeditionMode === "campaign" ? "campaign" : "free";
    const campaignStages = availableCampaignStages(profile);
    const campaignStage = Math.min(state.selectedCampaignStageSequence ?? 0, campaignStages[campaignStages.length - 1]);
    const guildCharacterId = state.guildCharacter;
    state = {
      ...freshUiState(),
      profile,
      run: startRun(profile, mode === "campaign" ? { campaignStageSequence: campaignStage } : { difficulty: rank }),
    };
    state.phase = "expeditionStart";
    state.expeditionMode = mode;
    state.selectedDifficulty = rank;
    state.selectedCampaignStageSequence = campaignStage;
    state.guildCharacter = guildCharacterId;
    saveState();
    render();
    return;
  }

  // R8 Implementation Phase 1 — 遠征の仕立て方を Free ⇔ Campaign で切り替える。
  if (action === "expedition-mode") {
    const mode = element.dataset.mode === "campaign" ? "campaign" : "free";
    if (mode === state.expeditionMode) return;
    state.expeditionMode = mode;
    state.run = startRun(state.profile, mode === "campaign"
      ? { campaignStageSequence: state.selectedCampaignStageSequence ?? 0, roster: state.run.roster }
      : { difficulty: state.selectedDifficulty ?? 0, roster: state.run.roster });
    saveState();
    render();
    return;
  }

  if (action === "select-campaign-stage") {
    const sequence = Number(element.dataset.sequence);
    if (!Number.isInteger(sequence) || !availableCampaignStages(state.profile).includes(sequence)) return;
    state.selectedCampaignStageSequence = sequence;
    // Stageはpack構成・報酬倍率を変えるのでrunを作り直すが、**seedは持ち回す**
    // （campaignのpack選択はseedに依存しないが、敵順・報酬は依存するため）。
    state.run = startRun(state.profile, {
      campaignStageSequence: sequence,
      roster: state.run.roster,
      runSeed: state.run.runSeed,
      runId: state.run.runId,
    });
    saveState();
    render();
    return;
  }

  if (action === "guild-tab") {
    state.guildTab = ["guild", "blueprints"].includes(element.dataset.tab)
      ? element.dataset.tab
      : "expedition";
    saveState();
    render();
    return;
  }

  if (action === "select-guild-character") {
    const id = element.dataset.character;
    if (!CHARACTER_OPTIONS.some((option) => option.id === id)) return;
    state.guildCharacter = id;
    saveState();
    render();
    return;
  }

  if (action === "select-difficulty") {
    const rank = Number(element.dataset.rank);
    if (!Number.isInteger(rank) || !availableDifficulties(state.profile).includes(rank)) return;
    state.selectedDifficulty = rank;
    state.expeditionMode = "free";
    // 難易度は開始補給と敵編成を変えるので run を作り直すが、
    // **seed は持ち回す**（manifest を引き直させない）。
    state.run = startRun(state.profile, {
      difficulty: rank,
      roster: state.run.roster,
      runSeed: state.run.runSeed,
      runId: state.run.runId,
    });
    saveState();
    render();
    return;
  }

  // R6 §9.3 — 購入は取り消せない。**残高・前後・費用を1件で残す。**
  if (action === "purchase") {
    const result = purchaseUpgrade(state.profile, element.dataset.upgrade);
    if (!result.ok) state.error = result.reason;
    else {
      state.profile = result.profile;
      // 買った枠と補給は、いま仕立てている遠征へすぐ効く。seed は持ち回す。
      state.run = startRun(state.profile, {
        difficulty: state.run.difficulty,
        campaignStageSequence: state.run.campaignStageSequence,
        roster: state.run.roster,
        runSeed: state.run.runSeed,
        runId: state.run.runId,
      });
      record("meta_purchased", result.purchase);
    }
    saveState();
    render();
    return;
  }

  if (action === "train") {
    const result = purchaseTraining(state.profile, element.dataset.character, element.dataset.axis);
    if (!result.ok) state.error = result.reason;
    else {
      state.profile = result.profile;
      record("training_purchased", result.purchase);
    }
    saveState();
    render();
    return;
  }

  if (action === "begin-expedition") {
    state.run.startedAt = new Date().toISOString();
    state.startedAt = state.run.startedAt;
    state.runId = state.run.runId;
    state.phase = "camp";
    state.tab = "roster";
    state.migrationNote = null;
    state.prologueActive = false;
    ensureSelectedCharacter();
    state.formationSelection = state.run.roster[0] ?? null;
    record("run_started", {
      runId: state.run.runId,
      seed: state.run.runSeed,
      version: VERSION,
      difficulty: state.run.difficulty,
      packs: [...state.run.manifest.enabledPackIds],
      supplies: state.run.supplies,
      roster: [...state.run.roster],
    });
    // R9 §2 — Campaign の初回だけ、物語の断片と序盤の敗北を挟む。
    if (isCampaignRun()) {
      const opening = storyBeatsForStart(state.run.campaignStageSequence);
      if (opening.beats.length) {
        enterStory(opening.beats, opening.after);
        return;
      }
    }
    saveState();
    render();
    return;
  }

  if (action === "story-next") {
    const queue = [...(state.story?.queue ?? [])];
    queue.shift();
    state.story = { queue, after: state.story?.after ?? "camp" };
    if (!queue.length) {
      finishStory();
      return;
    }
    saveState();
    render();
    return;
  }

  if (action === "story-skip") {
    record("story_skipped", { after: state.story?.after ?? "camp" });
    state.story = { queue: [], after: state.story?.after ?? "camp" };
    finishStory();
    return;
  }

  // R9 §2.1 — 巻き戻し。**序盤の敗北は遠征の結果に数えない。**
  // 活動資金も持ち越しHPも動かさず、同じ Stage の第1戦から本編を始める。
  if (action === "rewind-prologue") {
    state.prologueActive = false;
    state.profile = {
      ...state.profile,
      storyFlags: [...new Set([...(state.profile.storyFlags ?? []), "prologue_seen"])],
    };
    state.lastResult = null;
    state.replayEvents = [];
    state.replaySnapshots = [];
    state.replayIndex = 0;
    state.replayPlaying = false;
    record("prologue_rewound", { stage: state.run.campaignStageSequence });
    enterStory([storyBeat("stage_0_edge", "prologueDefeat")], "camp");
    return;
  }

  if (action === "back-camp") {
    state.phase = "camp";
    state.tab = "map";
    state.replayPlaying = false;
    saveState();
    render();
    return;
  }

  if (action === "tab") {
    state.phase = "camp";
    state.tab = element.dataset.tab || state.tab;
    ensureSelectedCharacter();
    saveState();
    render();
    return;
  }

  if (action === "select-character") {
    state.selectedCharacter = element.dataset.character || state.selectedCharacter;
    state.selectedSkillNode = null;
    saveState();
    render();
    return;
  }

  if (action === "select-formation-character") {
    const id = element.dataset.character;
    if (!id || !state.run.roster.includes(id)) return;
    state.selectedCharacter = id;
    state.selectedSkillNode = null;
    state.formationSelection = selectedFormationCharacter() === id ? null : id;
    saveState();
    render();
    return;
  }

  if (action === "clear-formation-selection") {
    state.formationSelection = null;
    saveState();
    render();
    return;
  }

  if (action === "select-skill-node") {
    state.selectedSkillNode = element.dataset.skill || null;
    saveState();
    render();
    return;
  }

  if (action === "toggle-roster") {
    const id = element.dataset.character;
    if (!id || !characterInfo(id)) return;
    if (rosterLocked()) {
      state.error = "この Stage の同行者は物語が決めます。一度クリアすると自由に選べます。";
      render();
      return;
    }
    if (state.run.roster.includes(id)) {
      if (state.run.roster.length <= 1) {
        state.error = "最低1人は残してください。";
      } else {
        state.run.roster = state.run.roster.filter((entry) => entry !== id);
        const nextLoadout = freshLoadout(state.run.roster);
        for (const characterId of state.run.roster) {
          nextLoadout.tactics[characterId] = [...(state.run.loadout.tactics?.[characterId] || nextLoadout.tactics[characterId])];
          nextLoadout.reactives[characterId] = [...(state.run.loadout.reactives?.[characterId] || nextLoadout.reactives[characterId])];
          nextLoadout.equipment[characterId] = [...(state.run.loadout.equipment?.[characterId] || [])];
        }
        state.run.loadout = nextLoadout;
        state.run.formation = normalizeFormation(state.run.formation, state.run.roster);
        if (state.formationSelection === id) {
          state.formationSelection = state.run.roster[0] ?? null;
        }
        ensureSelectedCharacter();
        record("roster_changed", { roster: [...state.run.roster], removed: id });
      }
    } else if (rosterLocked()) {
      state.error = "この Stage の同行者は物語が決めます。一度クリアすると自由に選べます。";
    } else if (state.run.roster.length >= runPartySize()) {
      state.error = "編成は" + runPartySize() + "人までです。";
    } else {
      state.run.roster = [...state.run.roster, id];
      // **run 側の欄も一緒に生やす。**loadout だけ足すと、
      // 技能点0で始まり、解禁表が空なので外した starter 技能を戻せなくなり、
      // manifest から外れた starter 技能が「今回は出ない」と書かれたまま戦闘へ入る。
      state.run = joinRun(state.run, id);
      state.run.formation = normalizeFormation(state.run.formation, state.run.roster);
      state.selectedCharacter = id;
      state.formationSelection = id;
      record("roster_changed", { roster: [...state.run.roster], added: id });
    }
    saveState();
    render();
    return;
  }

  if (action === "place-character") {
    const position = element.dataset.position;
    const id = selectedFormationCharacter();
    if (!POSITIONS.includes(position)) return;
    const other = positionOwner(position);
    if (!id) {
      if (other) {
        state.selectedCharacter = other;
        state.formationSelection = other;
        state.selectedSkillNode = null;
        saveState();
        render();
      }
      return;
    }
    if (other === id) {
      state.formationSelection = null;
      saveState();
      render();
      return;
    }
    const oldPosition = state.run.formation[id];
    if (other && other !== id) {
      state.run.formation[other] = oldPosition;
    }
    state.run.formation[id] = position;
    state.run.formation = normalizeFormation(state.run.formation, state.run.roster);
    state.formationSelection = null;
    record("formation_changed", { characterId: id, position, swappedWith: other });
    saveState();
    render();
    return;
  }

  // R6 §5.3 — 解禁は遠征内。遠征が終われば消える。
  if (action === "unlock-skill") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const node = SKILL_TREE_NODES.find((entry) => entry.skillId === skillId);
    const result = unlockRunSkill(state.run, characterId, node);
    if (!result.ok) state.error = result.reason;
    else {
      state.run = result.run;
      record("skill_unlocked", { characterId, skillId, cost: node.cost });
    }
    saveState();
    render();
    return;
  }

  // R6 §17.2 — run skill reset。**使った点をそのまま戻す**（罰を付けない）。
  if (action === "reset-run-skills") {
    const characterId = element.dataset.character;
    const { run, refunded } = resetRunSkills(state.run, characterId, initialUnlockedSkills(characterId)
      .filter((skillId) => inManifest(skillId)));
    state.run = run;
    // 装着済みからも、解禁を失った技能を外す。**装着したまま戦闘へ入らない。**
    const unlocked = new Set(state.run.runUnlockedSkills[characterId] ?? []);
    for (const key of ["tactics", "reactives", "passives"]) {
      state.run.loadout[key][characterId] = (state.run.loadout[key][characterId] ?? [])
        .filter((skillId) => unlocked.has(skillId));
    }
    record("run_skills_reset", { characterId, refunded });
    saveState();
    render();
    return;
  }

  if (action === "equip-skill") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const kind = element.dataset.kind;
    const result = equipSkill(state.run.loadout, characterId, skillId, kind, limitsFor);
    if (!result.ok) state.error = result.reason;
    else {
      state.run.loadout = result.loadout;
      record("skill_equipped", { characterId, skillId, kind });
    }
    saveState();
    render();
    return;
  }

  if (action === "remove-skill") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const kind = element.dataset.kind;
    const result = removeSkill(state.run.loadout, characterId, skillId, kind, limitsFor);
    if (!result.ok) state.error = result.reason;
    else {
      state.run.loadout = result.loadout;
      record("skill_removed", { characterId, skillId, kind });
    }
    saveState();
    render();
    return;
  }

  if (action === "move-tactic") {
    state.run.loadout = reorderTactic(
      state.run.loadout,
      element.dataset.character,
      Number(element.dataset.index),
      Number(element.dataset.direction),
      limitsFor,
    );
    record("tactic_reordered", {
      characterId: element.dataset.character,
      index: Number(element.dataset.index),
      direction: Number(element.dataset.direction),
    });
    saveState();
    render();
    return;
  }

  if (action === "select-equipment") {
    state.selectedEquipment = element.dataset.equipment || null;
    saveState();
    render();
    return;
  }

  if (action === "equip-equipment") {
    const equipmentId = state.selectedEquipment;
    const characterId = element.dataset.character;
    const slot = Number(element.dataset.slot);
    if (!equipmentId || !state.run.inventory.includes(equipmentId)) {
      state.error = "先に手元の装備を選んでください。";
    } else {
      const result = equipEquipment(state.run.loadout, characterId, equipmentId, slot, limitsFor);
      if (!result.ok) state.error = result.reason;
      else {
        state.run.loadout = result.loadout;
        state.selectedEquipment = null;
        record("equipment_equipped", { characterId, equipmentId, slot });
      }
    }
    saveState();
    render();
    return;
  }

  if (action === "remove-equipment") {
    const characterId = element.dataset.character;
    const equipmentId = element.dataset.equipment;
    state.run.loadout = removeEquipment(state.run.loadout, characterId, equipmentId, limitsFor);
    record("equipment_removed", { characterId, equipmentId });
    saveState();
    render();
    return;
  }

  if (action === "begin-stage") {
    // R9 §2.1 — 出発に必要な人数は Stage で変わる（Stage 0 は2人）。
    if (state.run.roster.length !== runPartySize()) {
      state.error = "出発には" + runPartySize() + "人の編成が必要です。";
      state.tab = "roster";
    } else {
      state.run.formation = normalizeFormation(state.run.formation, state.run.roster);
      // R8 §1.5 / §10 — Campaign StageはHPを持ち越すので満タンへ戻さない。
      // 装備耐久はどちらのmodeも毎戦リセット（持ち越しはまだ未実装）。
      if (isCampaignRun()) resetEquipmentDurability();
      else resetBattleResources();
      state.battleError = null;
      record("loadout_confirmed", {
        stage: state.run.encounterIndex,
        roster: [...state.run.roster],
        formation: clone(state.run.formation),
        loadout: clone(state.run.loadout),
      });
      state.phase = "battlePreview";
    }
    saveState();
    render();
    return;
  }

  if (action === "simulate") {
    let battle;
    try {
      const composed = currentEncounter();
      battle = makeExpeditionBattle(
        composed,
        state.run.roster,
        state.run.loadout,
        state.run.runSeed,
        state.run.formation,
        {
          // R8 §1.5 — Campaign Stage は run.currentHp（持ち越しHP）を渡す。
          // Free / Endless は従来どおり state.hp（毎戦満タン）。
          hp: isCampaignRun() ? state.run.currentHp : state.hp,
          equipmentDurability: state.equipmentDurability,
          limitsFor,
          statsFor,
          // Phase C — 生成装備の定義を含む content bundle を渡す。
          content: runContentBundle(state.run),
        },
      );
      record("battle_started", {
        encounter: state.run.encounterIndex,
        kind: composed.kind,
        difficulty: state.run.difficulty,
        threat: composed.spentThreat,
        battleId: battle.battleId,
      });
      const result = simulateBattle(battle, runContentBundle(state.run), {
        equipmentBreaks: false,
        captureReplaySnapshots: true,
      });
      state.lastResult = compactResult(result);
      const replay = compactReplay(result);
      state.replayEvents = replay.events;
      state.replaySnapshots = replay.snapshots;
      state.replayIndex = 0;
      state.replayPlaying = true;
      state.run.results = [...state.run.results, {
        encounter: state.run.encounterIndex,
        result: result.result,
        roundsUsed: result.roundsUsed,
        metrics: result.metrics,
      }];
      // R6 §9.2 — 活動資金は戦闘ごとに profile へ足さない。**run へ仮計上する。**
      // retry しても同じ encounter の撃破 base は一度だけ。
      if (result.result === "win") state.run = recordEncounterCleared(state.run, state.run.encounterIndex);
      for (const combatEvent of result.events || []) {
        pushRunEvent({
          at: new Date().toISOString(),
          type: "combat_event",
          stage: state.run.encounterIndex,
          event: combatEvent,
        });
      }
      record("battle_completed", {
        stage: state.run.encounterIndex,
        result: result.result,
        reason: result.reason,
        roundsUsed: result.roundsUsed,
      });
      // R8 §8, §10 — Campaign Stage: 勝利時だけHPをcommitする（敗北時はrunを
      // 変更しない=retry safe）。4/8戦目boss勝利後はcommitBattleResultが全回復する。
      if (isCampaignRun()) {
        const commit = commitBattleResult(state.profile, state.run, state.run.encounterIndex, result);
        state.run = commit.run;
        state.lastCarrySnapshot = commit.snapshot;
        resetEquipmentDurability();
      } else {
        resetBattleResources();
      }
      state.phase = "battle";
    } catch (error) {
      state.error = error.message;
      const diagnostics = error?.diagnostics || {};
      const actorLabels = Object.fromEntries([
        ...(battle?.allies || []).map((actor) => [actor.instanceId, characterName(actor.characterId)]),
        ...(battle?.enemies || []).map((actor) => [actor.instanceId, enemyInfo(actor.enemyActorId)?.label ?? actor.enemyActorId]),
      ]);
      state.battleError = {
        message: error.message,
        actorLabels,
        diagnostics: {
          battleId: diagnostics.battleId ?? battle?.battleId ?? null,
          round: diagnostics.round ?? null,
          currentActorId: diagnostics.currentActorId ?? null,
          chainId: diagnostics.chainId ?? null,
          eventSequence: diagnostics.eventSequence ?? null,
          ruleActivationStack: diagnostics.ruleActivationStack ?? [],
          chainRuleFirings: diagnostics.chainRuleFirings ?? {},
          recentEvents: diagnostics.recentEvents ?? [],
        },
      };
      // engineが例外を投げた場合はBattleResultが無いので、Campaign Stageでも
      // currentHpは変更しない（validateBattleInputで事前に弾かれるのが通常経路）。
      if (isCampaignRun()) resetEquipmentDurability();
      else resetBattleResources();
      state.error = null;
      state.phase = "battleError";
    }
    saveState();
    render();
    return;
  }

  if (action === "replay-toggle") {
    if (!state.replayEvents.length) return;
    if (state.replayIndex >= replayBeats().length - 1) {
      // 最後まで見たあとは、同じ戦闘をもう一度頭から流せる。
      state.replayIndex = 0;
      state.replayPlaying = true;
    } else {
      state.replayPlaying = !state.replayPlaying;
    }
    saveState();
    syncBattleView({ silent: true });
    return;
  }

  if (action === "replay-step") {
    state.replayPlaying = false;
    if (state.replayIndex < replayBeats().length - 1) state.replayIndex += 1;
    saveState();
    syncBattleView();
    return;
  }

  if (action === "replay-back") {
    state.replayPlaying = false;
    if (state.replayIndex > 0) state.replayIndex -= 1;
    saveState();
    syncBattleView({ silent: true });
    return;
  }

  if (action === "replay-speed") {
    const speed = element.dataset.speed;
    if (!REPLAY_SPEEDS.some((entry) => entry.id === speed)) return;
    state.replaySpeed = speed;
    saveState();
    syncBattleView({ silent: true });
    return;
  }

  if (action === "replay-again") {
    if (!state.replayEvents.length) return;
    state.phase = "battle";
    state.replayIndex = 0;
    state.replayPlaying = true;
    saveState();
    render();
    return;
  }

  if (action === "replay-result") {
    state.replayPlaying = false;
    state.phase = "result";
    saveState();
    render();
    return;
  }

  if (action === "retry-build") {
    state.phase = "camp";
    state.tab = "skills";
    state.battleError = null;
    saveState();
    render();
    return;
  }

  if (action === "back-battle-preview") {
    state.phase = "battlePreview";
    state.battleError = null;
    saveState();
    render();
    return;
  }

  if (action === "show-reward") {
    const rerolls = state.run.rerollsUsed?.[state.run.encounterIndex] ?? 0;
    state.rewardOffer = rewardOffer(state.run, state.profile, state.run.encounterIndex, rerolls);
    state.selectedRewardCharacter = state.run.roster[0] ?? null;
    record("reward_presented", { encounter: state.run.encounterIndex, offer: clone(state.rewardOffer) });
    state.phase = "reward";
    saveState();
    render();
    return;
  }

  // R6 §12.1 — 報酬の引き直しは補給1。**1戦闘につき一度だけ**（R6 §10）。
  if (action === "reroll-reward") {
    const used = state.run.rerollsUsed?.[state.run.encounterIndex] ?? 0;
    if (used >= 1) {
      state.error = "この戦闘ではもう引き直せません。";
    } else {
      const spent = spendSupply(state.run, "reroll");
      if (!spent.ok) state.error = spent.reason;
      else {
        state.run = { ...spent.run, rerollsUsed: { ...spent.run.rerollsUsed, [state.run.encounterIndex]: used + 1 } };
        state.rewardOffer = rewardOffer(state.run, state.profile, state.run.encounterIndex, used + 1);
        record("reward_rerolled", { encounter: state.run.encounterIndex, offer: clone(state.rewardOffer) });
      }
    }
    saveState();
    render();
    return;
  }

  // R6 §10 — 13品目になるときは、その場で一品を分解するか捨てる。
  if (action === "dismantle") {
    const result = dismantle(state.run, element.dataset.equipment);
    if (!result.ok) state.error = result.reason;
    else {
      state.run = result.run;
      if (state.selectedEquipment === element.dataset.equipment) state.selectedEquipment = null;
      record("equipment_dismantled", { equipmentId: element.dataset.equipment, scrap: state.run.scrap });
    }
    saveState();
    render();
    return;
  }

  if (action === "convert-scrap") {
    const result = convertScrap(state.run);
    if (!result.ok) state.error = result.reason;
    else {
      state.run = result.run;
      record("scrap_converted", { scrap: state.run.scrap, supplies: state.run.supplies });
    }
    saveState();
    render();
    return;
  }

  if (action === "select-reward-character") {
    state.selectedRewardCharacter = element.dataset.character || null;
    saveState();
    render();
    return;
  }

  if (action === "toggle-blueprint-carry") {
    const blueprintId = element.dataset.blueprint;
    const archive = state.profile.blueprints;
    const capacity = blueprintCarryCapacity(state.profile);
    const current = archive.carrySelection ?? [];
    const next = current.includes(blueprintId)
      ? current.filter((id) => id !== blueprintId)
      : [...current, blueprintId];
    state.profile = { ...state.profile, blueprints: setCarrySelection(archive, next, capacity) };
    state.error = null;
    // R8 §3.6 —「遠征開始時、carry capacity以内のBlueprintを再製造する」。
    // **まだ出発していない遠征なら、その場で作り直す。**そうしないと、
    // ギルドで持込を選んでも「次の次の遠征」からしか効かない
    // （run はギルドへ戻った時点で作られている）。
    // seed は持ち回すので、持込を選び直しても敵順・報酬は引き直せない。
    // 「まだ出発していない」は phase で見る。**run.startedAt は作成時に入るので
    // 出発の印にならない**（startRun がその場で今の時刻を書いている）。
    if (state.phase === "expeditionStart") {
      state.run = startRun(state.profile, {
        campaignStageSequence: state.run.campaignStageSequence,
        difficulty: state.run.difficulty,
        roster: state.run.roster,
        runSeed: state.run.runSeed,
        runId: state.run.runId,
        freeRoster: state.run.rosterLocked === false,
      });
      registerGeneratedEquipment(state.run.generatedEquipment);
    }
    record("blueprint_carry_changed", { blueprintId, carried: state.profile.blueprints.carrySelection });
    saveState();
    render();
    return;
  }

  if (action === "toggle-blueprint-favorite") {
    state.profile = {
      ...state.profile,
      blueprints: toggleFavorite(state.profile.blueprints, element.dataset.blueprint),
    };
    saveState();
    render();
    return;
  }

  if (action === "blueprint-filter") {
    const filter = { ...(state.blueprintFilter ?? { rarity: null, favorite: false }) };
    if (element.dataset.favorite === "toggle") filter.favorite = !filter.favorite;
    else filter.rarity = element.dataset.rarity || null;
    state.blueprintFilter = filter;
    render();
    return;
  }

  if (action === "take-reward") {
    const offer = state.rewardOffer[Number(element.dataset.offer)];
    if (!offer) return;
    if (offer.type === "generator_error") return;
    if (offer.type === "equipment") {
      if (state.run.inventory.length >= INVENTORY_LIMIT) {
        state.error = "遠征中の持ち物は" + INVENTORY_LIMIT + "品までです。";
        saveState();
        render();
        return;
      }
      if (offer.item) {
        // Phase C — 生成装備は定義ごと run へ入れる（content bundle に無い品なので）。
        const taken = takeGeneratedEquipment(state.run, offer.item);
        if (!taken.ok) {
          state.error = taken.reason;
          saveState();
          render();
          return;
        }
        state.run = taken.run;
        registerGeneratedEquipment(state.run.generatedEquipment);
        record("reward_taken", {
          encounter: state.run.encounterIndex,
          reward: "generated_equipment",
          equipmentId: offer.equipmentId,
          rarity: offer.item.rarity,
          descriptor: offer.item.descriptor,
        });
      } else {
        state.run.inventory = [...state.run.inventory, offer.equipmentId];
        record("reward_taken", { encounter: state.run.encounterIndex, reward: "equipment", equipmentId: offer.equipmentId });
      }
    } else if (offer.type === "skill_points") {
      const target = state.run.roster.includes(state.selectedRewardCharacter)
        ? state.selectedRewardCharacter
        : state.run.roster[0];
      state.run = grantRunSkillPoints(state.run, target, offer.amount);
      record("reward_taken", { encounter: state.run.encounterIndex, reward: "skill_points", characterId: target, amount: offer.amount });
    } else {
      state.run = gainSupply(state.run, offer.amount);
      record("reward_taken", { encounter: state.run.encounterIndex, reward: "supplies", amount: offer.amount });
    }
    advanceAfterReward();
    return;
  }

  // R6 §12.2 — 敗北しても即座に破棄しない。補給が残っていれば同じ戦闘へ挑み直す。
  if (action === "show-defeat") {
    state.phase = "defeat";
    saveState();
    render();
    return;
  }

  if (action === "retry-encounter") {
    const spent = spendSupply(state.run, "retry");
    if (!spent.ok) {
      state.error = spent.reason;
    } else {
      state.run = { ...spent.run, retries: { ...spent.run.retries, [state.run.encounterIndex]: (spent.run.retries?.[state.run.encounterIndex] ?? 0) + 1 } };
      state.phase = "camp";
      state.tab = "roster";
      state.lastResult = null;
      state.replayEvents = [];
      state.replaySnapshots = [];
      record("encounter_retried", { encounter: state.run.encounterIndex, supplies: state.run.supplies });
    }
    saveState();
    render();
    return;
  }

  if (action === "scout") {
    const spent = spendSupply(state.run, "scout");
    if (!spent.ok) {
      state.error = spent.reason;
    } else {
      // 偵察が開けるのは**次の幕**。いまの幕は補給なしで見えている。
      const act = actOfIndex(state.run.encounterIndex) + 1;
      state.run = { ...spent.run, scoutedActs: [...new Set([...(spent.run.scoutedActs ?? []), act])] };
      record("act_scouted", { act, supplies: state.run.supplies });
    }
    saveState();
    render();
    return;
  }

  // R8 §9.2 / §10.2 — 野営治療。対象は自動選択する（campTreatmentBlockのUIと対応）。
  if (action === "treat") {
    const treatmentId = element.dataset.treatment;
    const treatment = CAMP_TREATMENTS[treatmentId];
    let targets = [];
    if (treatment?.revive) {
      const target = state.run.roster.find((id) => currentHp(id) <= 0);
      if (target) targets = [target];
    } else if (treatment) {
      const target = [...state.run.roster]
        .filter((id) => currentHp(id) > 0 && currentHp(id) < maxHp(id))
        .sort((a, b) => currentHp(a) / maxHp(a) - currentHp(b) / maxHp(b))[0];
      if (target) targets = [target];
    }
    const result = campTreat(state.run, state.profile, treatmentId, targets);
    if (!result.ok) {
      state.error = result.reason;
    } else {
      state.run = result.run;
      record("camp_treated", { treatmentId, targets: result.treated ?? [], supplies: state.run.supplies });
    }
    saveState();
    render();
    return;
  }

  // R6 §9.2 — 精算は勝敗・放棄のいずれでも一度だけ。**ここが唯一の入口。**
  if (action === "settle-run" || action === "abandon-run") {
    const won = action === "settle-run"
      && state.run.encounterIndex >= ENCOUNTERS_PER_RUN
      && state.lastResult?.result === "win";
    // R8 §10.3 — 「放棄」は自発的な安全撤退として扱う（won/lostに続く3つ目のoutcome）。
    const outcome = won ? "won" : action === "abandon-run" ? "retreat" : "lost";
    const result = settleRun(state.profile, state.run, outcome);
    if (!result.ok) {
      state.error = result.reason;
    } else {
      state.profile = result.profile;
      state.run = result.run;
      state.lastSettlement = result.settlement;
      record("run_settled", result.settlement);
    }
    state.phase = "settlement";
    saveState();
    render();
    return;
  }

  if (action === "complete") {
    record("run_completed", {
      encounter: state.run.encounterIndex,
      reached: state.run.fundLedger.highestClearedEncounter,
      result: state.run.status,
    });
    state.phase = "complete";
    saveState();
    render();
    return;
  }

  if (action === "save-feedback") {
    const clear = document.querySelector("#feedback-clear")?.value || "";
    const confusing = document.querySelector("#feedback-confusing")?.value || "";
    const replay = document.querySelector("#feedback-replay")?.value || "";
    const marker = document.querySelector("#feedback-marker")?.value || "";
    const endedAt = new Date().toISOString();
    state.feedback = { clear, confusing, replay, marker, savedAt: endedAt };
    record("feedback_submitted", { replay, marker });
    saveState();
    const events = state.runEvents;
    const finalResult = state.run.results[state.run.results.length - 1];
    const finalWon = state.run.results.some(
      (entry) => entry.encounter === ENCOUNTERS_PER_RUN && entry.result === "win",
    );
    const finalActor = state.lastResult?.actors?.find((actor) => actor.side === "ally" && actor.alive);
    const payload = {
      runId: state.run.runId,
      telemetryRunId: state.run.runId,
      deviceId: deviceIdForRun(),
      schemaVersion: 4,
      gameVersion: VERSION,
      startedAt: state.run.startedAt || state.startedAt || endedAt,
      endedAt,
      outcome: {
        won: finalWon,
        reached: state.run.fundLedger.highestClearedEncounter,
        hp: finalActor?.hp ?? 0,
      },
      build: {
        roster: state.run.roster,
        formation: state.run.formation,
        loadout: state.run.loadout,
        ownedEquipment: state.run.inventory,
        // Phase C — 生成装備は content 版だけでは復元できない。**descriptor と
        // 来歴を控えへ入れる**（後から「どんな品を持っていたか」を照合するため）。
        generatedEquipment: Object.values(state.run.generatedEquipment ?? {}).map((item) => ({
          equipmentId: item.definition.id,
          displayName: item.definition.displayName,
          rarity: item.rarity,
          descriptor: item.descriptor,
          carried: item.carried === true,
          affixIds: item.provenance?.affixIds ?? [],
        })),
        carriedBlueprintIds: state.run.carriedBlueprintIds ?? [],
      },
      stats: {
        // **印は stats に置く。**functions/api/runs.js が保存するのは
        // outcome / build / stats / answers / client / events だけで、
        // 最上位に足した項目は export に出ない（＝後から版を照合できない）。
        buildStamp: BUILD,
        rulesFingerprint: FINGERPRINT,
        // 端末の保存枠に収めるため、控えの側で先に落とした件数。
        eventsDroppedLocally: state.runEventsDropped ?? 0,
        seed: state.run.runSeed,
        stageCount: state.run.encounterIndex,
        ruleset: PLAYABLE_CONTENT.contentVersion,
        // R6 §16 — 版と難易度を控えへ残す。**混ぜたら比較できない。**
        profileSchema: state.profile.schemaVersion,
        runSchema: state.run.schemaVersion,
        manifest: clone(state.run.manifest),
        difficulty: state.run.difficulty,
        supplies: state.run.supplies,
        runSkillPoints: clone(state.run.runSkillPoints),
        runUnlockedSkills: clone(state.run.runUnlockedSkills),
        // R6 §9.5 — 人物ごとの base stat・鍛錬 level・丸め後 stat。
        training: Object.fromEntries(state.run.roster.map((id) => [id, statsFor(id)])),
        activityFunds: state.profile.activityFunds,
        fundLedger: clone(state.run.fundLedger),
        settlement: state.lastSettlement ? clone(state.lastSettlement) : null,
        generatorVersion: state.run.generatedEquipment && Object.values(state.run.generatedEquipment)[0]
          ? Object.values(state.run.generatedEquipment)[0].provenance?.generatorVersion ?? null
          : null,
        blueprintArchiveSize: state.profile.blueprints?.entries?.length ?? 0,
        results: state.run.results,
        finalResult,
      },
      answers: { replay, clear, confusing, marker },
      client: {
        language: navigator.language,
        viewport: innerWidth + "x" + innerHeight,
        head: "ecology",
      },
      events,
      moments: marker
        ? [{ seq: state.runEvents.length - 1, at: endedAt, elapsedMs: 0, kind: marker, label: marker, phase: "complete", note: clear }]
        : [],
    };
    const submitButton = element;
    submitButton.disabled = true;
    submitButton.textContent = "保存中…";
    sendPayload(fitPayload(payload)).then((result) => {
      submitButton.disabled = false;
      submitButton.textContent = result.ok ? "D1に保存しました" : "端末に保存しました（D1未送信）";
      const hint = document.querySelector("#feedback-status");
      if (hint) hint.textContent = result.ok
        ? "保存済み · run " + String(state.run.runId).slice(0, 8)
        : "送信待ち · " + result.error;
    }).catch(() => {
      submitButton.disabled = false;
      submitButton.textContent = "端末に保存しました（D1未送信）";
    });
  }
}

render();
