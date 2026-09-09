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
  initialSkillLevels,
  initialUnlockedSkills,
  removeEquipment,
  reorderSkill,
  toggleSkill,
  PARTY_SIZE,
  ensurePartySize,
  normalizeFormation,
  previewNextBattle,
  componentInfo,
  registerGeneratedEquipment,
  makePrologueBattle,
  simulateExpeditionBattle,
  tacticUseWhenFor,
  prologueEncounter,
} from "./playable-battles.mjs";
import {
  BOSS_LAWS,
  CAMPAIGN_STAGES,
  campaignStageDisplayNameFor,
  DOSSIER_SECTION_HEADINGS,
  ENEMY_MUTATIONS,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  PACK_BY_ID,
  PROLOGUE,
  REGION,
  castOnStage,
  portraitAccent,
  portraitSvg,
  storyBeat,
  dossierFor,
  dossierRevealLevel,
  revealedBonds,
  revealedDossierSections,
  ENEMY_CODEX,
  homesteadFlag,
  homesteadScene,
  nextHomesteadScene,
  revealedFixtures,
  seenHomesteadIds,
  seenHomesteadScenes,
  SKILL_PACKS,
  // issue #176 — 状態（バフ・デバフ）の説明。定義の隣にある一行をそのまま出す。
  STATUS_GLOSSARY,
  SKILL_LEVEL_CAPS,
  SKILL_LEVEL_COST,
  // issue #148 — 説明文の数字を、いまのレベルの値で読ませる。
  skillLevelValueSteps,
  skillTextAtLevel,
  // R19（issue #137）— 技能ツリーの座標と表示語彙。
  BRANCH_BUILDS,
  SCOPE_LABELS,
  SKILL_TREE_GROUPS,
  TRIGGER_LABELS,
  buildSkillTreeLayout,
  // issue #168 — 前提（技能IDと必要Lv）の判定。解禁 API と同じ関数を読む。
  unmetPrerequisites,
} from "./content/index.mjs";
import {
  ENCOUNTERS_PER_RUN,
  META_UPGRADES,
  SCRAP_PER_SUPPLY,
  SUPPLY_USES,
  CAMP_TREATMENTS,
  availableCampaignStages,
  availableCharacterIds,
  campTreat,
  recordBestiary,
  commitBattleResult,
  convertScrap,
  dismantle,
  characterStats,
  composeEncounter,
  runContentBundle,
  formatFunds,
  gainSupply,
  grantRunSkillPointsForClear,
  manifestSkillIds,
  newProfile,
  newRun,
  normalizeProfile,
  parseFunds,
  purchaseTraining,
  purchaseUpgrade,
  recordEncounterCleared,
  skillPointsForClear,
  STARTING_RUN_SKILL_POINTS,
  rewardOffer,
  runSkillPoints,
  runSkillLevel,
  levelUpRunSkill,
  settleRun,
  slotLimits,
  spendSupply,
  unlockRunSkill,
  upgradeCost,
  upgradeLevel,
  INVENTORY_LIMIT,
  MAX_SUPPLIES,
  appraisalLevel,
  blueprintCarryCapacity,
  newGeneratedItems,
  takeGeneratedEquipment,
} from "./progression.mjs";
import {
  blueprintCompatibility,
  searchBlueprints,
  setCarrySelection,
  toggleFavorite,
} from "./blueprints.mjs";
import { RARITIES, RARITY_LABEL } from "./content/affixes.mjs";
import { MIN_SKILL_LEVEL, POSITIONS, RUN_SCHEMA_VERSION } from "./schema.mjs";
import { maxHpWithStaticBonuses } from "./static-bonuses.mjs";
import {
  buildBeats,
  beatDurationMs,
  beatHasStrikeImpact,
  eventSourceId,
  filterReplayEvents,
  REPLAY_EVENT_TYPES,
} from "./replay-beats.mjs";
import { deviceIdForRun, sendPayload, uuid } from "./sync.mjs";
import { BUILD, FINGERPRINT } from "../core/build.mjs";

const GAME_VERSION = "EXP-18 R10 Campaign 0.9";
const SAVE_FORMAT_VERSION = 1;
const SAVE_KEY = "exp18-r10-auto-v02";
const MANUAL_SAVE_PREFIX = "exp18-r10-manual-v02-";
const MANUAL_SAVE_SLOTS = 3;
// R9 §7 の会話画面（立ち絵つきの一行送り）。**使う場所は下の「物語」の節。**
const STORY_TYPE_MS = 26;          // 一文字あたりの送り速度
const STORY_AUTO_HOLD_MS = 1500;   // AUTO で読み終えてから次の行までの待ち
const STORY_LOG_LIMIT = 60;        // 履歴に残す行数
const SUPPLY_TUTORIAL_FLAG = "supply_tutorial_seen";
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
const kindLabels = { active: "アクティブ", reactive: "リアクティブ", passive: "パッシブ", equipment: "装備" };
const branchIcons = { "攻撃": "✦", "指揮": "↗", "支援": "✚", "守り": "◇", "基礎": "▣" };
// デバッグログに残すイベント。**盤面で畳んだものもここには残る**ので、
// 「なぜそうなったか」を文字で追える。手書きの whitelist は engine の
// 新しい event を敵味方どちらから出しても落とすため、schema を正本にする。
const replayTypes = REPLAY_EVENT_TYPES;

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
// 画面（phase）が切り替わった render() だけ、ページ先頭へ戻す。**同じ画面内の
// 操作（タブ選択・技能選択・報酬引き直しなど）では動かさない**——毎回動かすと
// スクロール位置を保ったまま組み替えたい操作まで壊れる。
let lastRenderedPhase = null;

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

// issue #211 — クリア済みかどうかは、Stage選択カードの解禁情報にだけ使う。
// Campaignの物語イベントは初訪・再訪で分岐させない。
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

// R9 §2.1 / issue #211 — この遠征の人数。Campaignは初回・再訪とも
// Stage定義の2〜5人を使う。
function runPartySize() {
  return Math.max(1, Math.min(PARTY_SIZE, Math.floor(state.run?.partySize ?? PARTY_SIZE)));
}

// Campaign Stageでは初回・再訪とも、誰が来るかはStage定義が決める。
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
  // issue #211 — Campaign Stage は初回・再訪とも、その Stage の同行者と人数を使う。
  // 5人編成の本編は Stage 3（および将来の後続Stage）に残し、導入Stageの問いを
  // 再訪時にも同じ盤面規模で読み直せるようにする。
  const sequence = options.campaignStageSequence ?? null;
  const stage = sequence === null ? null : CAMPAIGN_STAGES[sequence] ?? null;
  const size = stage?.partySize ?? PARTY_SIZE;
  const requested = stage
    ? [...stage.castCharacterIds]
    : (options.roster ?? ["warden", "mender", "lancer", "guardian"]);
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
    tutorial: options.tutorial === true,
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
    // R19（issue #137）— レベルは取得と同じで、離脱・再加入では戻らない。
    runSkillLevels: { ...run.runSkillLevels },
    loadout: {
      ...run.loadout,
      tactics: { ...run.loadout?.tactics },
      reactives: { ...run.loadout?.reactives },
      passives: { ...run.loadout?.passives },
      equipment: { ...run.loadout?.equipment },
      ...(run.loadout?.disabled && typeof run.loadout.disabled === "object"
        ? { disabled: { ...run.loadout.disabled } }
        : {}),
    },
  };
  // **初期化するのは初回だけ。**離脱と再加入で点を戻さないので、
  // 外して入れ直しても技能点を増やせない。
  next.runSkillPoints[characterId] = Object.hasOwn(run.runSkillPoints ?? {}, characterId)
    ? runSkillPoints(run, characterId)
    : STARTING_RUN_SKILL_POINTS;
  next.runUnlockedSkills[characterId] = [...new Set([
    ...keep(run.runUnlockedSkills?.[characterId]),
    ...keep(initialUnlockedSkills(characterId)),
  ])];
  // issue #168 — 無償閉包が親の Lv を要求するなら、**その Lv も無償で付く。**
  // 取得済みにしておきながら前提 Lv 不足で子が取れない形を作らない。
  // 既に上げてある Lv は下げない（離脱・再加入で巻き戻さない）。
  const freeLevels = Object.entries(initialSkillLevels(characterId))
    .filter(([skillId]) => available.has(skillId));
  if (freeLevels.length) {
    const levels = { ...(run.runSkillLevels?.[characterId] ?? {}) };
    for (const [skillId, level] of freeLevels) {
      levels[skillId] = Math.max(levels[skillId] ?? 0, level);
    }
    next.runSkillLevels[characterId] = levels;
  }
  next.loadout.tactics[characterId] = keep(run.loadout?.tactics?.[characterId] ?? fresh.tactics[characterId]);
  next.loadout.reactives[characterId] = keep(run.loadout?.reactives?.[characterId] ?? fresh.reactives[characterId]);
  next.loadout.passives[characterId] = keep(run.loadout?.passives?.[characterId]);
  next.loadout.equipment[characterId] = run.loadout?.equipment?.[characterId] ?? [];
  const savedDisabled = run.loadout?.disabled?.[characterId];
  if (Array.isArray(savedDisabled)) {
    const installed = new Set([
      ...next.loadout.tactics[characterId],
      ...next.loadout.reactives[characterId],
      ...next.loadout.passives[characterId],
    ]);
    const disabled = [...new Set(savedDisabled)].filter((skillId) => installed.has(skillId));
    if (disabled.length) next.loadout.disabled[characterId] = disabled;
    else {
      delete next.loadout.disabled[characterId];
      if (!Object.keys(next.loadout.disabled).length) delete next.loadout.disabled;
    }
  }
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
    // lineIndex は断片の中の何行目か。auto は自動送り、log は履歴。
    story: { queue: [], after: "camp", lineIndex: 0, auto: false, log: [], logOpen: false },
    // 画面内ヘルプの開閉は、同じ画面を再描画しても保持する。
    helpOpen: {},
    saveMenuReturn: "intro",
    saveNotice: null,
    prologueActive: false,
    // R11 §5 — 序盤の一戦は2段構え。"first" は負ける一戦、"retry" は巻き戻したあと。
    // 巻き戻しても prologueActive は true のままなので、camp から「戦闘へ」を押すと
    // 本編1戦目ではなく**同じ門の盤面**へ戻る（currentEncounter が prologueEncounter を返す）。
    prologueStage: null,
    selectedCharacter: null,
    // ギルドは**遠征の編成とは別の選択**を持つ。roster の5人へ丸めると、
    // 同行していない仲間の鍛錬が永久に買えなくなる。
    guildCharacter: null,
    formationSelection: null,
    selectedSkillNode: null,
    // R19（issue #137）— ツリーは種別（アクティブ / リアクティブ / パッシブ）で切り替える。
    skillTreeKind: "active",
    selectedEquipment: null,
    // R12 — Free / Endless（旧・難易度rank選択）を削除した。遠征は Campaign Stage
    // だけになったので、仕立て方の選択も難易度の選択も持たない（作者判断）。
    selectedCampaignStageSequence: 0,
    treatTargets: [],
    treatmentSelection: null,
    treatmentResult: null,
    // #209 — the mandatory supply walkthrough belongs only to the New Game
    // Stage 0 introduction. Revisited/ordinary expeditions start with zero
    // supplies and must keep their normal, optional camp flow.
    supplyTutorialRunId: null,
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


// **一時導線の宣言。**ここに載っているものは「消す前提で入っている」ものである。
// `analysis/ecology-screens-smoke.mjs` が、この表と docs/OPERATIONS.md §3.1 の欄が
// 一致していることを見張る。**片方だけ消しても落ちる。**
//
// issue #176 の作者試遊で使った Stage 3 直行の導線（`debug-stage`）は、
// PR #186 の merge 前にここごと外した。次に一時導線を足すときは、この配列と
// docs/OPERATIONS.md §3.1 の表へ同時に書く。
export const TEMPORARY_DEBUG_ENTRIES = Object.freeze([]);

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
  // issue #138 — 「報酬を見る」の中間画面を廃止した。結果画面が報酬選択を兼ねるので、
  // 旧いオートセーブがちょうどその画面で保存されていても結果画面へ戻す。
  if (next.phase === "reward") next.phase = "result";
  // issue #138 — 戦闘前確認の画面（battlePreview）も廃止した。旧いオートセーブが
  // ちょうどその画面で保存されていてもキャンプへ戻す。
  if (next.phase === "battlePreview") {
    next.phase = "camp";
    next.tab = "map";
  }
  next.profile = normalizeProfile(saved.profile);

  // 保存時点のRunを復元する。形式が違うデータは readStoredSnapshot で
  // 入口から弾いているため、Free Runを勝手に作って続行しない。
  const savedRun = saved.run;
  next.run = savedRun;
  const savedCampaignStage = savedRun.campaignStageSequence === null
    || savedRun.campaignStageSequence === undefined
    ? null
    : CAMPAIGN_STAGES[savedRun.campaignStageSequence] ?? null;
  if (savedCampaignStage) {
    // issue #211 — 同じsave schemaで作られた旧「自由再訪」も、復元時に
    // Stage定義の同行者・人数へ揃え、表示・敵規模との食い違いを残さない。
    next.run.partySize = savedCampaignStage.partySize;
    next.run.rosterLocked = true;
    next.run.roster = [...savedCampaignStage.castCharacterIds];
  } else {
    next.run.partySize = Number.isFinite(savedRun.partySize)
      ? Math.max(1, Math.min(PARTY_SIZE, Math.floor(savedRun.partySize)))
      : PARTY_SIZE;
    next.run.rosterLocked = savedRun.rosterLocked === true;
    next.run.roster = ensurePartySize(
      savedRun.roster.filter((id) => characterInfo(id)),
      next.run.partySize,
    );
  }
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
  next.skillTreeKind = ["active", "reactive", "passive"].includes(next.skillTreeKind) ? next.skillTreeKind : "active";
  // 旧いオートセーブには story.lineIndex / log が無い。**足りない欄を補って読む。**
  next.story = {
    queue: Array.isArray(saved.story?.queue) ? saved.story.queue.filter(Boolean) : [],
    after: saved.story?.after ?? "camp",
    lineIndex: Number.isFinite(saved.story?.lineIndex) ? Math.max(0, Math.floor(saved.story.lineIndex)) : 0,
    auto: saved.story?.auto === true,
    log: Array.isArray(saved.story?.log) ? saved.story.log.slice(-STORY_LOG_LIMIT) : [],
    logOpen: false,
  };
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
// pre-battle camp screen even though simulation had completed.
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

// 端末の保存枠が尽きたときの例外か。**尽きたなら削って書き直す。壊れたなら投げる。**
//
// 140aa36（R10 の New Game / セーブ枠）が saveState を storageSnapshot +
// writeSnapshot へ書き直したとき、この関数だけが消えて呼び出しが2箇所残った。
// 保存枠が尽きるまで踏まれない経路なので `node --check` も単体テストも通り、
// 公開先の通し（analysis/ecology-trial.mjs）が長い遠征のときだけ
// ReferenceError で落ちていた。**消えたら気づけるよう、
// analysis/ecology-screens-smoke.mjs が未定義の呼び先を見るようにしてある。**
function isRecoverableStorageError(error) {
  return [
    "QuotaExceededError",
    "NS_ERROR_DOM_QUOTA_REACHED",
    "SecurityError",
  ].includes(error?.name);
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
  const mode = "Campaign Stage " + (run.campaignStageSequence ?? 0);
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
  const inRun = ["camp", "battle", "battleError", "result", "defeat"]
    .includes(state.phase);
  // R11 §5 改 — チュートリアル（灰の門）の最中はタイトルへ戻る・撤退する導線を
  // 出さない。負ける一戦目も、巻き戻したあとの結果画面（報酬選択を兼ねる）も、
  // まだ隊列を直しきる前に離脱されると「一手直せば勝てる」導入が成立しない。
  const headerAction = options.hideHeaderAction || state.prologueActive || supplyTutorialVisible()
    ? ""
    : options.back
      ? button(options.backLabel ?? "キャンプへ", options.backAction ?? "back-camp", false, "menu-button")
      : inRun
        ? button("安全に撤退する", "abandon-run", false, "menu-button")
        : button("ギルドへ", "back-guild", false, "menu-button");
  // 共通のタイトル・サブタイトルを残す唯一の例外はタイトル画面。
  const titleHeader = options.titleScreen
    ? "<header class=\"header title-header\"><div><h1>" + esc(title)
      + "</h1><p class=\"subtitle\">" + esc(subtitle)
      + "</p></div>" + headerAction + "</header>"
    : "";
  const screenActions = !options.titleScreen && headerAction
    ? "<div class=\"screen-actions\">" + headerAction + "</div>"
    : "";
  // Build metadata stays available to automated diagnostics without occupying
  // the normal player-facing chrome. Visible details live inside technical logs.
  const footer = "<span class=\"build-stamp\" hidden aria-hidden=\"true\">build " + esc(BUILD) + "</span>";
  return "<div class=\"shell\">" + titleHeader + screenActions + body + error + footer + "</div>";
}

function diagnosticStamp() {
  return "<p class=\"muted diagnostic-stamp\">build " + esc(BUILD)
    + " · rules " + esc(PLAYABLE_CONTENT.contentVersion)
    + " · run " + esc(String(state.run.runId).slice(0, 8))
    + " · seed " + esc(state.run.runSeed) + "</p>";
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
  const base = statsFor(characterId)?.stats.maxHp ?? PLAYABLE_CONTENT.characters[characterId]?.maxHp ?? 1;
  const passiveSkillIds = (state.run?.loadout?.passives?.[characterId] ?? [])
    .filter((id) => !skillDisabled(characterId, id));
  const equipment = (state.run?.loadout?.equipment?.[characterId] ?? []).map((equipmentId) => ({
    equipmentId,
    broken: equipmentDurability(equipmentId) === 0,
  }));
  return maxHpWithStaticBonuses(base, runContentBundle(state.run), passiveSkillIds, equipment);
}

function limitsFor(characterId) {
  return slotLimits(state.profile, characterId);
}

function funds() {
  return parseFunds(state.profile.activityFunds);
}

// R8 Implementation Phase 1 — Campaign Stage の run は `campaignStageSequence` を持つ。
// R12 で Free / Endless を削除したので、本編の run はこれを必ず持つ。**古い保存を
// 読んだときだけ null が来る**ので、判定そのものは残す。
function isCampaignRun() {
  return state.run.campaignStageSequence !== null && state.run.campaignStageSequence !== undefined;
}

function hasStoryFlag(flag) {
  return (state.profile.storyFlags ?? []).includes(flag);
}

// 初回の本編戦闘（encounter 1）に勝った後にだけ補給の使い方を案内する。
// R11 §5 改 — 巻き戻したあとの勝利がそのまま encounter 1 の勝利になるので、
// `!state.prologueActive` は advanceAfterReward が既に prologueActive を
// 落としたあとにしか呼ばれない（結果・報酬画面の表示中はまだ真のまま）。
function firstOrdinaryBattleWon() {
  return isCampaignRun()
    && state.run.campaignStageSequence === 0
    && !state.prologueActive
    && Array.isArray(state.run.results)
    && state.run.results.some((entry) => entry.encounter === 1 && entry.result === "win");
}

function shouldShowSupplyTutorialAfterReward() {
  return firstOrdinaryBattleWon()
    && state.run.encounterIndex === 1
    && state.lastResult?.result === "win"
    && !hasStoryFlag(SUPPLY_TUTORIAL_FLAG);
}

function supplyTutorialVisible() {
  return state.supplyTutorialRunId === state.run.runId
    && firstOrdinaryBattleWon()
    && state.run.encounterIndex >= 2
    && !hasStoryFlag(SUPPLY_TUTORIAL_FLAG);
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

// **装備の表示情報は一箇所から引く。**遠征ごとの装備は run が抱えている定義から
// 作った別表に居る（playable-battles の registerGeneratedEquipment）。画面が
// EQUIPMENT を直接読むと、拾った装備が名前も効果も空のまま並ぶ。
function gear(equipmentId) {
  return componentInfo(equipmentId) ?? null;
}

function generatedItem(equipmentId) {
  return state.run?.generatedEquipment?.[equipmentId] ?? null;
}

const RARITY_RANK = Object.freeze(
  Object.fromEntries(RARITIES.map((rarity, index) => [rarity, index + 1])),
);

function rarityChip(rarity) {
  if (!rarity) return "";
  const safe = RARITY_RANK[rarity] ? rarity : "common";
  const label = RARITY_LABEL[rarity] ?? rarity;
  const rank = RARITY_RANK[rarity] ?? 1;
  return "<span class=\"rarity-chip rarity-" + esc(safe)
    + "\" title=\"装備レアリティ: " + esc(label) + "（格 " + rank + "/" + RARITIES.length + "）\">"
    + "<span class=\"rarity-rank\">" + rank + "</span><span>" + esc(label) + "</span></span>";
}

function effectRarityBadge(rarity, label = null) {
  const safe = RARITY_RANK[rarity] ? rarity : "common";
  const display = label ?? RARITY_LABEL[rarity] ?? rarity;
  const rank = RARITY_RANK[rarity] ?? 1;
  return "<span class=\"effect-rarity rarity-" + esc(safe)
    + "\" title=\"効果のレアリティ: " + esc(display) + "（格 " + rank + "/" + RARITIES.length + "）\">"
    + "<span class=\"effect-rarity-rank\">" + rank + "</span>" + esc(display) + "</span>";
}

function effectSlotLabel(slot) {
  if (slot === "implicit") return "基礎効果・常時";
  if (slot === "base") return "基礎効果";
  const match = /^effect(\d+)$/.exec(String(slot ?? ""));
  return match ? "追加効果" + match[1] : "効果";
}

function equipmentReadoutHtml(item, { compact = false } = {}) {
  const readout = item?.readout;
  // 表示用コピーだけを並べ替える。保存データの effect 順と descriptor は変更しない。
  const effects = Array.isArray(readout?.effects)
    ? readout.effects.map((effect, index) => ({ effect, index }))
      .sort((a, b) => {
        if (a.effect.slot === "implicit" || b.effect.slot === "implicit") {
          return a.effect.slot === "implicit" ? -1 : 1;
        }
        const rarityDiff = (RARITY_RANK[b.effect.rarity] ?? 0) - (RARITY_RANK[a.effect.rarity] ?? 0);
        return rarityDiff || a.index - b.index;
      })
      .map(({ effect }) => effect)
    : [];
  const lines = Array.isArray(readout?.lines) ? readout.lines : [];
  const ruleLines = lines.map((line) => "<p class=\"equipment-rule-line\">" + esc(line) + "</p>").join("");
  const keystone = readout?.keystone
    ? "<p class=\"keystone-line\">" + esc(readout.keystone) + "</p>"
    : "";
  const risk = readout?.risk
    ? "<p class=\"risk-line\"><b>規格外の代償：</b>" + esc(readout.risk) + "</p>"
    : "";
  if (!effects.length) return ruleLines + risk + keystone;

  const details = effects.map((effect) => {
    const amount = effect.amount == null ? ""
      : effect.unconditional ? " +" + esc(effect.amount) : "（" + esc(effect.amount) + "）";
    return "<div class=\"equipment-effect-detail\">"
      + "<span class=\"effect-detail-label\">" + esc(effectSlotLabel(effect.slot)) + "</span>"
      + effectRarityBadge(effect.rarity, effect.rarityLabel)
      + "<span class=\"effect-detail-summary\">" + esc(effect.summary) + amount + "</span></div>";
  }).join("");
  const compactDetails = effects.filter((effect) => effect.slot === "implicit").map((effect) => {
    const amount = effect.amount == null ? "" : " +" + esc(effect.amount);
    return "<div class=\"equipment-effect-detail\"><span class=\"effect-detail-label\">基礎効果・常時</span>"
      + effectRarityBadge(effect.rarity, effect.rarityLabel)
      + "<span class=\"effect-detail-summary\">" + esc(effect.summary) + amount + "</span></div>";
  }).join("");
  return "<div class=\"equipment-effect-details\">" + (compact ? compactDetails : details) + "</div>"
    + ruleLines + risk + keystone;
}

function equipmentRarityCallout(item) {
  const rarity = item?.rarity;
  const rank = RARITY_RANK[rarity] ?? 0;
  const effects = Array.isArray(item?.readout?.effects) ? item.readout.effects : [];
  const highest = effects.reduce((max, effect) => Math.max(max, RARITY_RANK[effect.rarity] ?? 0), 0);
  if (highest > rank) {
    const highRarity = RARITIES[highest - 1] ?? rarity;
    return "<p class=\"rarity-callout rarity-" + esc(highRarity) + "\">"
      + "<span class=\"rarity-callout-mark\">✦</span>規格外 — "
      + esc(RARITY_LABEL[highRarity] ?? highRarity) + "効果</p>";
  }
  if (rank < 4 || !effects.length) return "";
  const sameRank = effects.filter((effect) => (RARITY_RANK[effect.rarity] ?? 0) === rank).length;
  const safe = RARITY_RANK[rarity] ? rarity : "common";
  return "<p class=\"rarity-callout rarity-" + esc(safe) + "\">"
    + "<span class=\"rarity-callout-mark\">✦</span>"
    + esc(RARITY_LABEL[rarity] ?? rarity) + "級 — 最高格の効果 " + sameRank + "件</p>";
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

// R19（issue #137）— 技能レベル。**取得＝Lv1。**未取得は 0 を返す。
function skillLevelOf(characterId, skillId) {
  return runSkillLevel(state.run, characterId, skillId);
}

// その技能が持てる最大レベル。連続する量を持たない技能は Lv1 止まりで、
// **画面はそれを「レベルなし」と書く**（強くならないものへ点を払わせない）。
function skillLevelCapOf(skillId) {
  return SKILL_LEVEL_CAPS[skillId] ?? 1;
}

// この遠征の manifest が有効にした技能かどうか。**外れた技能はツリーで触れない。**
function inManifest(skillId) {
  return manifestSkillIds(state.run.manifest).all.includes(skillId);
}

// R9 §3.2 — 敵の数と threat budget は、その遠征の人数で決まる。
// **preview と正式実行が同じ引数を使う**ように、組み立てはこの一箇所に閉じる。
function encounterOptions() {
  return { partySize: state.run.partySize };
}

// R9 §3.2 — 敵の数と threat budget は、その遠征の人数に合わせて決まる。
// **preview と正式実行が同じ引数を使う**ように、ここ一箇所で組む。
function currentEncounter() {
  // R9 §2.1 — 序盤の敗北は12戦の梯子に属さない。**別の敵を出しているのに
  // 第1戦の名前を出さない**（何を見ているのか分からなくなる）。
  if (state.prologueActive) return prologueEncounter();
  return composeEncounter(state.run.encounterIndex, state.run.difficulty, encounterOptions());
}

function actOfIndex(index) {
  return index <= 4 ? 1 : index <= 8 ? 2 : 3;
}

// R14 §3 — 偵察（補給1で次の幕の個体編成を先に見る）は消した。
//
// R6 §12.1 は「いま挑む戦闘は補給なしで全部見える。伏せられているのは先の幕の
// 並びと変異で、そこを1つ前倒しで見るのが偵察」と言っていた。**次の一戦の結果
// そのものが常時見えるようになった今、その一枠は買う理由を失った**（作者判断）。
// 補給は再挑戦・報酬の引き直し・野営治療の三つで取り合う。

function installedSkill(characterId, skillId, kind) {
  const key = SLOT_KEYS[kind];
  return (state.run.loadout[key]?.[characterId] || []).includes(skillId);
}

function skillDisabled(characterId, skillId) {
  return (state.run.loadout.disabled?.[characterId] || []).includes(skillId);
}

function selectedCharacter() {
  if (state.run.roster.includes(state.selectedCharacter)) return state.selectedCharacter;
  return state.run.roster[0];
}

// R12 — **物語がまだ出していない人物を、どの画面にも出さない。**
//
// 加入の判定は progression.mjs の `availableCharacterIds`（Campaign の進行から
// 再構成する engine 側の唯一の規則）に任せる。画面側で二つ目の判定を持つと、
// いつか片方だけずれる。**いま出ている遠征の同行者は必ず「会った人」に含める**
// ので、古い保存から入っても名簿と編成が食い違わない。
function metCharacterIds(profile = state.profile, run = state.run) {
  const met = new Set(availableCharacterIds(profile));
  for (const id of run?.roster ?? []) met.add(id);
  return met;
}

// 会ったことのある人物だけの CHARACTER_OPTIONS。順番は roster.mjs の並びを保つ。
function metCharacterOptions() {
  const met = metCharacterIds();
  return CHARACTER_OPTIONS.filter((option) => met.has(option.id));
}

// ギルド画面の選択。**会ったことのある仲間が対象**（永続投資は同行の有無に
// 関係しないが、まだ加入していない人物を鍛えられるのはおかしい。R12 §4.E-1）。
function guildCharacter() {
  const options = metCharacterOptions();
  const fallback = options[0] ?? CHARACTER_OPTIONS[0];
  const id = state.guildCharacter;
  return options.some((option) => option.id === id) ? id : fallback.id;
}

function selectedFormationCharacter() {
  return state.run.roster.includes(state.formationSelection) ? state.formationSelection : null;
}

function positionOwner(position) {
  return state.run.roster.find((characterId) => state.run.formation[characterId] === position) ?? null;
}

function sectionHeading(eyebrow, title, right = "") {
  // 通常画面の主見出しは日本語を一つだけにする。装飾用の英語ラベルは出さない。
  void eyebrow;
  return "<div class=\"section-head\"><div><h2>" + esc(title) + "</h2></div>" + right + "</div>";
}

function helpDetails(id, title, body, open = false) {
  return "<details class=\"card help-details\" data-help=\"" + esc(id) + "\"" + (open ? " open" : "") + ">"
    + "<summary>" + esc(title) + "</summary>"
    + "<div class=\"help-body\">" + body + "</div></details>";
}

function captureHelpDetails() {
  const open = { ...(state.helpOpen ?? {}) };
  app.querySelectorAll("details.help-details[data-help]").forEach((element) => {
    open[element.dataset.help] = element.open;
  });
  state.helpOpen = open;
}

function restoreHelpDetails() {
  app.querySelectorAll("details.help-details[data-help]").forEach((element) => {
    element.open = state.helpOpen?.[element.dataset.help] === true;
  });
}


function campNav() {
  const skillCharacter = selectedCharacter();
  const tutorialLocked = supplyTutorialVisible();
  const activeTab = tutorialLocked ? "supplies" : state.tab;
  const tabs = [
    ["roster", "編成", partyLabel()],
    ["skills", "スキル", characterName(skillCharacter) + " " + skillPointsFor(skillCharacter) + "pt"],
    ["equipment", "装備", state.run.roster.reduce((total, id) => total + (state.run.loadout.equipment?.[id] || []).length, 0) + "/" + (state.run.roster.length * 2)],
    ["supplies", "補給", state.run.supplies + "/" + MAX_SUPPLIES],
    ["map", "戦闘", state.run.encounterIndex + "/" + ENCOUNTERS_PER_RUN],
  ];
  return "<nav class=\"tabs\" aria-label=\"キャンプ画面\">" + tabs.map(([id, label, meta]) => {
    const active = activeTab === id;
    const locked = tutorialLocked && id !== "supplies";
    return "<button type=\"button\" class=\"tab " + (active ? "active" : "")
      + "\" aria-label=\"" + label + "\" aria-current=\"" + (active ? "step" : "false")
      + "\" data-action=\"tab\" data-tab=\"" + id + "\""
      + (locked ? " disabled aria-disabled=\"true\"" : "") + "><b>" + label + "</b><small>" + meta + "</small></button>";
  }).join("") + "</nav>";
}

function campTools() {
  return "<div class=\"camp-tools\">"
    + button("セーブ / ロード", "open-save-menu", false, "tiny-button", "data-return=\"camp\"")
    + "</div>";
}

function render() {
  captureHelpDetails();
  stopReplayTimer();
  stopStoryTimers();
  registerGeneratedEquipment(state.run?.generatedEquipment ?? {});
  const views = {
    intro: renderIntro,
    expeditionStart: renderExpeditionStart,
    saveMenu: renderSaveMenu,
    story: renderStory,
    camp: renderCamp,
    battle: renderBattle,
    battleError: renderBattleError,
    result: renderResult,
    defeat: renderDefeat,
    settlement: renderSettlement,
    homestead: renderHomestead,
    complete: renderComplete,
  };
  const phaseChanged = state.phase !== lastRenderedPhase;
  lastRenderedPhase = state.phase;
  app.innerHTML = (views[state.phase] ?? renderIntro)();
  app.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", handleAction);
  });
  restoreHelpDetails();
  restoreSkillTreeScroll();
  layoutSkillTreeConnectors();
  if (state.phase === "battle") mountBattleView();
  if (state.phase === "story") mountStoryView();
  if (phaseChanged) window.scrollTo(0, 0);
}


function captureSkillTreeScroll() {
  if (state.phase !== "camp" || state.tab !== "skills") return;
  const scroll = { ...(state.skillTreeScroll || {}) };
  app.querySelectorAll(".skill-tree-scroll[data-branch]").forEach((element) => {
    const value = Number(element.scrollLeft);
    if (Number.isFinite(value)) scroll[element.dataset.branch] = value;
  });
  state.skillTreeScroll = scroll;
}

function restoreSkillTreeScroll() {
  if (state.phase !== "camp" || state.tab !== "skills") return;
  const scroll = state.skillTreeScroll || {};
  app.querySelectorAll(".skill-tree-scroll[data-branch]").forEach((element) => {
    const value = Number(scroll[element.dataset.branch]);
    if (Number.isFinite(value)) element.scrollLeft = value;
  });
}

function renderIntro() {
  const auto = readStoredSnapshot(SAVE_KEY);
  const continueLabel = auto ? saveSummary(auto) : "オートセーブはありません";
  const saveStatus = auto
    ? "<p class=\"save-summary\"><span>オートセーブ</span> · " + esc(continueLabel) + "</p>"
    : "";
  return shell("One Battle Ahead", "", "<section class=\"title-screen\" aria-label=\"メインメニュー\">"
    + "<div class=\"sigil\" aria-hidden=\"true\">◈</div>"
    + "<div class=\"title-actions\">"
    + button("つづきから", "continue-game", !auto, "button primary")
    + button("はじめから", "new-game", false, "button")
    + button("ロードゲーム", "open-save-menu", false, "button", "data-return=\"intro\"")
    + "</div>"
    + saveStatus
    + "</section>", { hideHeaderAction: true, titleScreen: true, hideFooter: true });
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
  return shell("", "",
    "<section class=\"card save-menu-card\">"
    + sectionHeading("SAVE / LOAD", fromCamp ? "セーブ / ロード" : "ロードゲーム")
    + "<p class=\"operation-note\">自動保存は最新の安全な状態です。手動保存は3枠あり、New Gameの後も残ります。</p>"
    + "<article class=\"save-slot auto\"><div><b>オートセーブ</b><small>" + esc(auto ? saveSummary(auto) : "まだありません") + "</small></div><div class=\"save-slot-actions\">" + autoActions + "</div></article>"
    + "<div class=\"save-slot-list\">" + manual + "</div>" + notice + "</section>",
    { back: true, backAction: fromCamp ? "back-camp" : "back-title", backLabel: fromCamp ? "キャンプへ" : "タイトルへ" });
}


// ============================================================ 遠征を仕立てる
// ============================================================ 遠征を仕立てる（R6 §15.1）
//
// **遠征開始前に全部を表示する。**有効パック、敵family、3体のボスと法則、開始補給。
// 先の幕の個体編成だけは伏せる（挑む一戦は戦闘タブと戦闘予測が全部見せる）。
//
// R12 — ただし「全部」は**この遠征に出るもの**であって、まだ物語が公開していない
// ものではない。未解禁の pack と、次に加わる人物の名前は出さない（作者判断）。

// R8 Implementation Phase 1 — Campaign Stage の選択カード。
// activeなpackはmanifest（すでにStage定義から固定構成で作られている）から読む。
function campaignStageCard(sequence) {
  const stage = CAMPAIGN_STAGES[sequence];
  const selected = state.selectedCampaignStageSequence === sequence;
  const newPack = PACK_BY_ID[stage.newPackId];
  // R9 §2.1 / §8 — Stage は「難易度」ではなく「人数と問いが違う場面」。
  // **誰が加わるのかと、この Stage で問われることを先に見せる。**
  const cleared = isCampaignStageCleared(state.profile, sequence);
  // R12 — **まだクリアしていない Stage の加入者は、名前を出さない。**
  // 誰が来るかは join の会話が渡すものなので、選択カードで先に割らない。
  const joining = stage.joiningCharacterId
    ? (cleared ? characterName(stage.joiningCharacterId) + " が加わる" : "新しい仲間が加わる")
    : "最初の二人";
  return "<button type=\"button\" class=\"difficulty-card " + (selected ? "selected" : "")
    + "\" aria-pressed=\"" + (selected ? "true" : "false") + "\" data-action=\"select-campaign-stage\" data-sequence=\"" + sequence
    + "\"><b>" + esc(stage.displayName) + "</b><small>" + esc(stage.question) + "</small>"
    + "<span class=\"difficulty-meta\">"
    + (cleared
      ? stage.partySize + "人・" + esc(stage.castCharacterIds.map(characterName).join("＋")) + "で再訪"
      : stage.partySize + "人 · " + esc(joining))
    + " · 今回初登場 " + esc(newPack?.displayName ?? stage.newPackId)
    + " · 有効パック " + stage.activePackCount + "</span></button>";
}

function renderExpeditionStart() {
  const manifest = state.run.manifest;
  const campaignStages = availableCampaignStages(state.profile);
  const packs = SKILL_PACKS.filter((pack) => manifest.enabledPackIds.includes(pack.id))
    .map((pack) => "<div class=\"pack-row on\"><b>" + esc(pack.displayName)
      + "</b><small>" + esc(pack.summary) + "</small><span>"
      + ((manifest.packDepths ?? {})[pack.id] === "core" ? "入口" : "有効") + "</span></div>").join("");
  const bosses = manifest.actBossLawIds.map((lawId, index) => {
    const law = BOSS_LAWS[lawId];
    return "<article class=\"boss-card\"><div class=\"boss-top\"><span class=\"enemy-mark\">◆</span><div><b>第"
      + (index + 1) + "幕 · " + esc(enemyInfo(manifest.actBossIds[index]).label) + "</b><small>"
      + esc(law.displayName) + "</small></div></div><p>" + esc(law.previewText) + "</p>"
      + "<ul class=\"boss-counters\">" + law.counters.map((line) => "<li>" + esc(line) + "</li>").join("") + "</ul></article>";
  }).join("");
  const note = state.migrationNote
    ? "<section class=\"card quiet\"><p class=\"muted\">" + esc(state.migrationNote) + "</p></section>"
    : "";
  const tabs = "<nav class=\"tabs\" aria-label=\"ギルド画面\">"
    + [
      ["expedition", "遠征", ENCOUNTERS_PER_RUN + "戦"],
      ["guild", "ギルド投資", formatFunds(funds())],
      ["blueprints", "設計図", (state.profile.blueprints?.entries?.length ?? 0)
        + "件 · 持込 " + (state.profile.blueprints?.carrySelection?.length ?? 0)
        + "/" + blueprintCarryCapacity(state.profile)],
      ["homestead", "根城", metCharacterIds().size + "人"],
      ["codex", "図鑑", bestiaryEntries().length + "体"],
    ]
      .map(([id, label, meta]) => "<button type=\"button\" class=\"tab " + (state.guildTab === id ? "active" : "")
        + "\" aria-current=\"" + (state.guildTab === id ? "step" : "false")
        + "\" data-action=\"guild-tab\" data-tab=\"" + id + "\"><b>" + label + "</b><small>" + esc(meta) + "</small></button>").join("")
    + "</nav>";
  const campaignSection = "<section class=\"card\">" + sectionHeading(
      "CAMPAIGN STAGE", "行き先を選ぶ",
      "<span class=\"stage\">解禁 " + campaignStages.length + " / " + (MAX_CAMPAIGN_STAGE_SEQUENCE + 1) + "</span>")
    + "<p class=\"operation-note\">区画は前の区画をクリアした順に解禁され、飛ばせません。</p>"
    + "<div class=\"difficulty-grid\">" + campaignStages.map(campaignStageCard).join("") + "</div>"
    + (CAMPAIGN_STAGES[state.selectedCampaignStageSequence]?.learningGoals?.length
      ? "<ul class=\"boss-counters\">" + CAMPAIGN_STAGES[state.selectedCampaignStageSequence].learningGoals
          .map((line) => "<li>" + esc(line) + "</li>").join("") + "</ul>"
      : "");
  const expeditionBody = "<section class=\"card\">" + sectionHeading(
      "EXPEDITION", "今回の遠征", "<span class=\"stage\">活動資金 " + formatFunds(funds()) + "</span>")
    + "<p class=\"operation-note\">" + esc(REGION.summary) + "</p>"
    + "<h3 class=\"training-heading\">有効な技能パック</h3>"
    + "<div class=\"pack-list\">" + packs + "</div></section>"
    + "<section class=\"card\">" + sectionHeading("ACT BOSSES", "先に確認できる法則")
    + "<p class=\"operation-note\">出発前に3幕のボス法則を確認できます。</p>"
    + "<div class=\"boss-grid\">" + bosses + "</div></section>"
    + campaignSection
    + button("この条件で遠征へ出る", "begin-expedition", false, "button primary") + "</section>";
  const body = { guild: renderGuild, blueprints: renderBlueprints, homestead: homesteadBody, codex: renderBestiary }[state.guildTab]?.()
    ?? expeditionBody;
  return shell("", "",
    "<div class=\"camp-tools guild-tools\">" + button("タイトルへ", "back-title", false, "tiny-button") + "</div>"
    + tabs + note + body, { hideHeaderAction: true });
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
    const cost = upgradeCost(state.profile, upgrade.id);
    const detail = cost === null
      ? "Lv" + level + " · 購入済み"
      : "Lv" + level + " → Lv" + (level + 1) + " · " + upgrade.describeLevel(level + 1);
    return purchaseRow(upgrade.id, upgrade.displayName, detail, cost);
  }).join("");
  const trainingRows = Object.entries(stats.detail).map(([axis, detail]) => {
    const axisLabel = { might: "腕力", focus: "技術", guard: "受け", vitality: "体力" }[axis];
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
  const metOptions = metCharacterOptions();
  const memberTabsHtml = "<div class=\"member-tabs\" aria-label=\"仲間を選ぶ\">"
    + metOptions.map((option) => "<button type=\"button\" class=\"member-tab "
      + (option.id === characterId ? "active" : "") + "\" data-action=\"select-guild-character\" data-character=\""
      + option.id + "\"><span class=\"avatar small\">" + esc(option.icon) + "</span><span>"
      + characterName(option.id) + "<small>" + esc(option.role) + "</small></span></button>").join("") + "</div>";
  return "<section class=\"card\">" + sectionHeading("ACTIVITY FUNDS", "資金を使う",
      "<span class=\"stage\">" + formatFunds(funds()) + "</span>")
    + "<p class=\"operation-note\">購入は取り消せません。購入後の値と価格を確認してから選んでください。</p>"
    + "<div class=\"purchase-list\">" + upgrades + "</div>"
    + helpDetails("guild-rules", "投資のルール",
      "<p class=\"muted\">活動資金は遠征終了時に精算されます。技能の取得、設計図の持込枠、目利き、初期SPアップ、開始補給、鍛錬を長期的に整えます。</p>")
    + "</section>"
    + "<section class=\"card\">" + sectionHeading("CHARACTER TRAINING", "仲間を鍛える",
      "<span class=\"stage\">" + metOptions.length + "人</span>")
    + memberTabsHtml
    + "<div class=\"purchase-list\">" + trainingRows + "</div>"
    + helpDetails("training-rules", "鍛錬のルール",
      "<p class=\"muted\">1段で基礎値が少し上がります。行動権・技能の装着数・発火回数は変わりません。</p>")
    + "</section>";
}


// ---------------------------------------------------------------- 名簿（R12 §4.A）
//
// **読める設定。**R11 §2・§4・§5 に書いてある人物の中身を、ここで初めて画面へ出す。
// 愛着の源として作者が選んだ「設定の厚み」は、これまでどこからも読めなかった。
//
// **一度に全部は語らない。**節はその人と何度灰へ入ったかで開き、will（その人が
// 何を求めているか）は5人が揃うまで開かない。関係は、相手が加入していて、
// 遅いほうの加入 Stage を越えたときだけ出る。判定は content/dossiers.mjs に置いてある
// （画面側で二つ目の判定を持つと、いつか片方だけずれる）。

const DOSSIER_SECTIONS_TOTAL = Object.keys(DOSSIER_SECTION_HEADINGS).length;

function highestClearedStage(profile = state.profile) {
  return profile?.campaignProgress?.[REGION.id]?.highestClearedStageSequence ?? -1;
}

function dossierCard(characterId, met) {
  const entry = dossierFor(characterId);
  if (!entry) return "";
  const highest = highestClearedStage();
  const options = { met: met.has(characterId), finalStageSequence: MAX_CAMPAIGN_STAGE_SEQUENCE };
  const level = dossierRevealLevel(characterId, highest, options);
  if (level === 0) return "";
  const open = revealedDossierSections(level);
  const sections = open.map((key) => "<div class=\"dossier-section\"><b>"
    + esc(DOSSIER_SECTION_HEADINGS[key] ?? key) + "</b>"
    + entry.sections[key].map((line) => "<p>" + esc(line) + "</p>").join("")
    + "</div>").join("");
  const bonds = revealedBonds(characterId, highest, met);
  const bondRows = bonds.length
    ? "<div class=\"dossier-section bonds\"><b>関係</b>"
      + bonds.map((bond) => "<p><i style=\"color:" + esc(portraitAccent(bond.with)) + "\">"
        + esc(characterName(bond.with)) + "</i>"
        + bond.lines.map((line) => "<span>" + esc(line) + "</span>").join("") + "</p>").join("")
      + "</div>"
    : "";
  // **まだ開いていない節は、数だけ見せて中身を出さない。**
  // 「この先がある」と分かることと、先を読めてしまうことは別である。
  const sealed = DOSSIER_SECTIONS_TOTAL - open.length;
  const sealedNote = sealed > 0
    ? "<p class=\"dossier-sealed\">まだ書かれていない節が " + sealed
      + " つある。この人と、もう少し灰へ入ること。</p>"
    : "";
  const info = characterInfo(characterId);
  return "<article class=\"dossier-card\" style=\"--accent:" + esc(portraitAccent(characterId)) + "\">"
    + "<div class=\"dossier-head\"><div class=\"dossier-bust\">"
    + portraitSvg(characterId, level >= 4 ? "calm" : "neutral", { uid: "dossier-" + characterId })
    + "</div><div class=\"dossier-name\"><b>" + esc(characterName(characterId)) + "</b>"
    + "<small>" + esc(info?.role ?? "") + " · " + esc(entry.age) + " · " + esc(entry.origin) + "</small>"
    + "</div></div>"
    + "<div class=\"dossier-body\">" + sections + bondRows + sealedNote + "</div></article>";
}

function renderDossiers() {
  const met = metCharacterIds();
  const cards = CHARACTER_OPTIONS.map((option) => dossierCard(option.id, met)).filter(Boolean).join("");
  return "<section class=\"card\">" + sectionHeading("ROSTER FILE", "隊の名簿",
      "<span class=\"stage\">" + met.size + " 人</span>")
    + "<p class=\"muted\">詰所へ出す申請の控えです。<b>灰へ何度も一緒に入るほど、書ける欄が増えます。</b>"
    + "戦闘の役には影響しません。</p>"
    + (cards || "<p class=\"muted\">まだ誰の欄も書けていません。</p>")
    + "</section>";
}

// ---------------------------------------------------------------- 根城（R11 §2.4 / §9.4）
//
// **帰る場所。**これまで画面は「灰の中」か「詰所（ギルド）」しか無く、
// R11 §2.4 が「日常の場面と設定の厚みはここに置く」と決めた家が、どこにも無かった。
//
// 根城は精算のあとに必ず通る。**遠征と遠征のあいだの、灰が出てこない一枚**である。
// 名簿（R12 §4.A）もここへ移した。詰所の投資画面の奥タブに置くより、
// 帰り道に必ず通る場所へ置いたほうが読まれる（R12 §7.6 の懸念への答え）。

function homesteadContext() {
  return {
    highestClearedStageSequence: highestClearedStage(),
    met: metCharacterIds(),
    blueprintCount: state.profile.blueprints?.entries?.length ?? 0,
  };
}

// 会話のあとに戻る先。**入ってきた画面へ返す**（下の finishStory が受ける）。
function homesteadReturnPhase() {
  return state.phase === "expeditionStart" ? "guildHomestead" : "homestead";
}

// まだ見ていない日常の場面。**帰った時に一つだけ出す。**
function pendingHomesteadScene() {
  return nextHomesteadScene(homesteadContext(), seenHomesteadIds(state.profile.storyFlags));
}

function fixtureCards() {
  const open = revealedFixtures(homesteadContext());
  if (!open.length) return "";
  return "<div class=\"fixture-list\">" + open.map((entry) => "<article class=\"fixture-card\">"
    + "<b>" + esc(entry.label) + "</b>"
    + entry.lines.map((line) => "<p>" + esc(line) + "</p>").join("")
    + "</article>").join("") + "</div>";
}

// 読み返せる日常の場面。**もう一度見るのは自由**（既読印は消えない）。
function homesteadSceneList() {
  const seen = seenHomesteadScenes(seenHomesteadIds(state.profile.storyFlags));
  if (!seen.length) return "";
  return "<section class=\"card\">" + sectionHeading("EVENINGS / " + seen.length, "根城での場面")
    + "<p class=\"muted\">一度見た場面は、ここから読み返せます。</p>"
    + "<div class=\"scene-list\">" + seen.map((entry) => "<button type=\"button\" class=\"scene-row\""
      + " data-action=\"replay-homestead\" data-scene=\"" + esc(entry.id) + "\"><b>"
      + esc(entry.beat.title) + "</b><small>" + esc(entry.beat.place) + "</small></button>").join("")
    + "</div></section>";
}

function homesteadBody() {
  const open = revealedFixtures(homesteadContext()).length;
  const pending = pendingHomesteadScene();
  return "<section class=\"card\">" + sectionHeading("HOMESTEAD / " + open, "根城",
      "<span class=\"stage\">" + metCharacterIds().size + " 人</span>")
    + "<p class=\"muted\">灰の縁から外れた廃屋を直して使っています。<b>拾ってきたもので少しずつ増えます。</b>"
    + "戦闘には影響しません。</p>"
    + fixtureCards()
    + (pending
      ? "<div class=\"flow-actions\">" + button("今夜の場面を見る", "enter-homestead-scene", false, "button primary")
        + "</div>"
      : "")
    + "</section>"
    + homesteadSceneList()
    + renderDossiers();
}

function renderHomestead() {
  return shell("", "",
    homesteadBody()
    + "<section class=\"card quiet\">"
    + button("ギルドへ", "back-guild", false, "button primary")
    + button("記録を送る", "complete", false, "button") + "</section>",
    { hideHeaderAction: true });
}

// ---------------------------------------------------------------- 図鑑（R8 §3.2）
//
// R8 §3.2 は ProfileState に「図鑑」を挙げていたが、R12 の時点でも未実装だった
// （app.js の codex は装備の未入手一覧で、図鑑ではない）。ここがその実装である。
//
// **段階開示にする。**名簿と同じ考え方で、会っただけの相手には狙いしか書けない。
//
//   1回でも見た … 名前と狙い（戦闘前の敵カードと同じ情報）
//   1回倒した   … 拾い屋の噂（ENEMY_LORE）
//   5回倒した   … 図鑑の一節（ENEMY_CODEX）。何度も見た者にしか書けないこと
//
// **会っていない敵は名前も出さない**（R12 §4.E-1 と同じ線）。
const CODEX_DEEP_THRESHOLD = 5;

function bestiaryEntries() {
  const bestiary = state.profile.bestiary ?? {};
  return Object.keys(PLAYABLE_CONTENT.enemyActors)
    .filter((id) => (bestiary[id]?.seen ?? 0) > 0)
    .map((id) => ({ id, ...bestiary[id] }));
}

function bestiaryCard(entry) {
  const info = enemyInfo(entry.id);
  const deep = entry.defeated >= CODEX_DEEP_THRESHOLD;
  const codex = deep ? (ENEMY_CODEX[entry.id] ?? []) : [];
  const sealed = !deep && (ENEMY_CODEX[entry.id] ?? []).length > 0;
  return "<article class=\"codex-card\"><div class=\"codex-head\"><b>" + esc(info.label) + "</b>"
    + "<small>見た " + entry.seen + " · 倒した " + entry.defeated + "</small></div>"
    + "<p class=\"codex-targeting\">" + esc(info.targeting) + "</p>"
    + (entry.defeated > 0 && info.lore ? "<p class=\"enemy-lore\">" + esc(info.lore) + "</p>" : "")
    + codex.map((line) => "<p class=\"codex-line\">" + esc(line) + "</p>").join("")
    + (sealed
      ? "<p class=\"dossier-sealed\">あと " + (CODEX_DEEP_THRESHOLD - entry.defeated)
        + " 体倒すと、書き足せることがある。</p>"
      : "")
    + "</article>";
}

function renderBestiary() {
  const entries = bestiaryEntries();
  const deep = entries.filter((entry) => entry.defeated >= CODEX_DEEP_THRESHOLD).length;
  return "<section class=\"card\">" + sectionHeading("FIELD CODEX / " + entries.length, "会った灰殻の記録",
      "<span class=\"stage\">書き足せた " + deep + "</span>")
    + "<p class=\"muted\">詰所へ出す控えの写しです。<b>遠征を捨てても消えません</b>"
    + "（会ったことは、負けても取り消されないので）。灰殻が何なのかは、ここにも書いてありません。</p>"
    + (entries.length
      ? "<div class=\"codex-grid\">" + entries.map(bestiaryCard).join("") + "</div>"
      : "<p class=\"muted\">まだ一体も記録がありません。灰へ入ると増えます。</p>")
    + "</section>";
}

// ---------------------------------------------------------------- Blueprint archive（R8 §3.6）
//
// **archive に所持上限は無い。**制限が掛かるのは遠征開始時の持込枠だけなので、
// 画面も「何件持っているか」ではなく「今回どれを持ち込むか」を主役にする。
// R12 §4.B — 設計図の由来。**acquisitions は既に持っている**（blueprints.mjs の
// saveBlueprint が runId / encounterIndex / campaignStageId / outcome を残す）ので、
// 新しい状態は足さず、機械の id を人の言葉へ写すだけにする。
const BLUEPRINT_OUTCOME_TEXT = Object.freeze({
  won: "遠征を終えて",
  retreat: "撤退のさなかに",
  lost: "退きながら",
});

function blueprintOriginText(origin) {
  if (!origin) return "";
  // issue #172 — Stage ID を連番へ改名したので、改名前の ID で保存された
  // 記録（campaignStageId）でも由来表示が消えないよう、新旧どちらの ID からも
  // displayName を引く campaignStageDisplayNameFor を通す。
  const stage = campaignStageDisplayNameFor(origin.campaignStageId);
  const where = stage
    ? (origin.encounterIndex ? stage + " の第" + origin.encounterIndex + "戦" : stage)
    : (origin.encounterIndex ? "第" + origin.encounterIndex + "戦" : null);
  if (!where) return "";
  const how = BLUEPRINT_OUTCOME_TEXT[origin.outcome] ?? null;
  return how ? where + "で拾い、" + how + "持ち帰った。" : where + "で拾った。";
}

function renderBlueprints() {
  const archive = state.profile.blueprints ?? { entries: [], carrySelection: [] };
  const capacity = blueprintCarryCapacity(state.profile);
  const carried = archive.carrySelection ?? [];
  const filter = state.blueprintFilter ?? { rarity: null, favorite: false };
  const entries = searchBlueprints(archive, {
    rarity: filter.rarity ?? undefined,
    favorite: filter.favorite || undefined,
  });

  const rarityFilters = [["", "すべて"], ...[...RARITIES].reverse().map((rarity) => [rarity, RARITY_LABEL[rarity] ?? rarity])]
    .map(([value, label]) => "<button type=\"button\" class=\"tiny-button "
      + ((filter.rarity ?? "") === value ? "primary-mini" : "") + "\" data-action=\"blueprint-filter\" data-rarity=\""
      + value + "\">" + esc(label) + "</button>").join("")
    + "<button type=\"button\" class=\"tiny-button " + (filter.favorite ? "primary-mini" : "")
    + "\" data-action=\"blueprint-filter\" data-favorite=\"toggle\">★ お気に入りだけ</button>";

  const cards = entries.map((entry) => {
    const verdict = blueprintCompatibility(entry);
    const chosen = carried.includes(entry.blueprintId);
    const readout = equipmentReadoutHtml({ readout: entry.readout }, { compact: false });
    const origin = entry.acquisitions[0] ?? {};
    return "<article class=\"reward-card blueprint-card rarity-card-" + esc(entry.rarity ?? "common")
      + (chosen ? " selected" : "")
      + (verdict.ok ? "" : " disabled") + "\">"
      + "<div class=\"reward-kind kind-equipment\">設計図</div>"
      + "<h3>" + esc(entry.definition.displayName) + rarityChip(entry.rarity) + "</h3>"
      + equipmentRarityCallout({ rarity: entry.rarity, readout: entry.readout })
      + readout
      + "<small>耐久 " + entry.definition.maxDurability + " · 取得 " + entry.acquisitions.length + "回</small>"
      // R12 §4.B — **設計図は遠征をまたいで残る唯一の物である。**
      // どの遠征のどこで拾ったのかを人の言葉で残すと、archive が記録になる。
      + (blueprintOriginText(origin) ? "<p class=\"blueprint-origin\">"
        + esc(blueprintOriginText(origin)) + "</p>" : "")
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
    + "<p class=\"muted\">遠征で見つけた装備は、遠征が終わるときに設計図として残ります"
    + "（勝利2件・安全撤退2件・敗北1件）。<b>設計図そのものに所持上限はありません。</b>"
    + "遠征開始時に持ち込めるのは持込枠のぶんだけで、持ち込んだ品は"
    + "その遠征で選ばれた装備の系統の外でも、そのまま動きます。</p>"
    + "<div class=\"flow-actions\">" + rarityFilters + "</div>"
    + (entries.length
      ? "<div class=\"reward-grid\">" + cards + "</div>"
      : "<p class=\"muted\">まだ設計図がありません。遠征で装備を拾い、遠征を終えると残ります。</p>")
    + "</section>";
}

// ---------------------------------------------------------------- 物語（R9 §2, §7, §8）
//
// **説明画面ではない。**pack の意味を人物の行動として見せる断片を、
// 一行ずつ出す。**いつでも飛ばせる**（R9 §8：既知になった後の再訪で
// チュートリアルがランの固定税になってはいけない）。
//
// 見せ方は近年のスマホゲームの対話に合わせてある。
//
//   立ち絵      … 舞台に立つ人物を描き、**喋っている人だけを前へ出す**。
//                  表情は行ごとに切り替わる（content/portraits.mjs）。
//   一行送り     … 断片をまとめて出さず、一行ずつ流す。画面のどこを叩いても進む。
//   文字送り     … 表示中に叩くと即座に全部出る。二度叩けば次の行へ。
//   AUTO / SKIP  … 自動送りと、この Stage の会話を丸ごと飛ばす。
//   履歴        … 直前まで読んだ行を後から読み返せる。
//
// **演出は進行を止めない。**文字送りも自動送りも、叩けば必ず追い越せる。

// 送り速度・AUTO の待ち・履歴の長さは、ファイル冒頭の定数群に置いてある
// （hydrateState が保存の履歴を切り詰めるのに使うので、宣言はそれより前でなければ
// ならない。ここへ書き戻すと、読み込みが TDZ で落ちて題名画面へ戻る）。

let storyTypeTimer = null;
let storyAutoTimer = null;
// **文字送りの途中かどうか。**途中なら、叩いても行は進めず全文を出す。
let storyTypingDone = true;
// 最後に読み終えた行。**AUTO の切り替えや履歴を閉じたときに、
// 同じ行をもう一度打ち直さない**（読んだ文が消えるのは進行の逆戻りに見える）。
let storyShownLine = null;

function stopStoryTimers() {
  if (storyTypeTimer) clearTimeout(storyTypeTimer);
  if (storyAutoTimer) clearTimeout(storyAutoTimer);
  storyTypeTimer = null;
  storyAutoTimer = null;
}

function currentStoryBeat() {
  return state.story?.queue?.[0] ?? null;
}

function storyLineIndex() {
  const beat = currentStoryBeat();
  if (!beat) return 0;
  const raw = Number(state.story?.lineIndex ?? 0);
  const index = Number.isFinite(raw) ? Math.floor(raw) : 0;
  return Math.max(0, Math.min(beat.lines.length - 1, index));
}

const STORY_PLACEMENTS = { left: 0, center: 1, right: 2 };

// その人物がこの行までに見せた最後の表情。**地の文でも顔は残る。**
function storyExpressionFor(beat, characterId, upTo) {
  for (let index = Math.min(upTo, beat.lines.length - 1); index >= 0; index -= 1) {
    const line = beat.lines[index];
    if (line.who === characterId && line.emotion) return line.emotion;
  }
  return "neutral";
}

// 名前欄に出す人物。地の文の行では、直前に喋っていた人を残さず空にする。
function storySpeaker(beat, index) {
  return beat.lines[index]?.who ?? null;
}

// 地の文の行で、直前に喋っていた人。**舞台を一度に暗くしない。**
function storyAttentive(beat, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (beat.lines[cursor]?.who) return beat.lines[cursor].who;
  }
  return null;
}

function storyFigure(beat, entry, index) {
  const speaking = storySpeaker(beat, index) === entry.who;
  const attentive = !storySpeaker(beat, index) && storyAttentive(beat, index) === entry.who;
  const expression = speaking
    ? (beat.lines[index].emotion ?? "neutral")
    : storyExpressionFor(beat, entry.who, index);
  const entering = (entry.since ?? 0) === index;
  return "<div class=\"vn-figure " + (speaking ? "speaking" : "muted-figure")
    + (attentive ? " attentive" : "")
    + (entering ? " entering" : "") + " at-" + esc(entry.at) + "\""
    + " style=\"--accent:" + esc(portraitAccent(entry.who)) + "\""
    + " data-character=\"" + esc(entry.who) + "\">"
    + portraitSvg(entry.who, expression, { uid: beat.id + "-" + entry.who })
    + "</div>";
}

function storyBacklog() {
  const entries = state.story?.log ?? [];
  const rows = entries.length
    ? entries.map((entry) => "<p class=\"vn-log-line" + (entry.speaker ? "" : " narration") + "\">"
      + (entry.speaker
        ? "<b style=\"color:" + esc(portraitAccent(entry.who)) + "\">" + esc(entry.speaker) + "</b>"
        : "")
      + "<span>" + esc(entry.text) + "</span></p>").join("")
    : "<p class=\"muted\">まだ履歴がありません。</p>";
  return "<div class=\"vn-log\" role=\"dialog\" aria-label=\"会話の履歴\">"
    + "<div class=\"vn-log-head\"><b>履歴</b>"
    + button("閉じる", "story-log", false, "tiny-button") + "</div>"
    + "<div class=\"vn-log-body\">" + rows + "</div></div>";
}

function renderStory() {
  const beat = currentStoryBeat();
  if (!beat) return renderCamp();
  const index = storyLineIndex();
  const line = beat.lines[index];
  const speakerId = storySpeaker(beat, index);
  const figures = [...castOnStage(beat, index)]
    .sort((a, b) => (STORY_PLACEMENTS[a.at] ?? 1) - (STORY_PLACEMENTS[b.at] ?? 1))
    .map((entry) => storyFigure(beat, entry, index))
    .join("");
  const lastLine = index >= beat.lines.length - 1;
  const remaining = (state.story?.queue?.length ?? 1) - 1;
  const auto = state.story?.auto === true;
  const nameplate = line.speaker
    ? "<div class=\"vn-name\" style=\"--accent:" + esc(portraitAccent(speakerId)) + "\">"
      + esc(line.speaker) + "</div>"
    : "";
  const controls = "<div class=\"vn-controls\">"
    + button("履歴", "story-log", (state.story?.log?.length ?? 0) === 0, "vn-chip")
    + button(auto ? "AUTO 停止" : "AUTO", "story-auto", false, "vn-chip" + (auto ? " on" : ""))
    + button("スキップ", "story-skip", false, "vn-chip")
    + "</div>";
  const scene = "<section class=\"vn\" data-mood=\"" + esc(beat.mood ?? "ash") + "\">"
    + "<div class=\"vn-stage" + (line.fx === "impact" ? " impact" : "") + "\""
    + " data-action=\"story-advance\" role=\"button\" tabindex=\"0\""
    + " aria-label=\"会話を進める\">"
    + "<div class=\"vn-sky\"></div><div class=\"vn-haze\"></div>"
    + "<div class=\"vn-place\"><b>" + esc(beat.title) + "</b>"
    + (beat.place ? "<span>" + esc(beat.place) + "</span>" : "") + "</div>"
    + "<div class=\"vn-figures\">" + figures + "</div>"
    + "<div class=\"vn-box" + (line.speaker ? "" : " narration") + "\">"
    + nameplate
    + "<p class=\"vn-text\" aria-live=\"polite\" data-full=\"" + esc(line.text) + "\"></p>"
    + "<span class=\"vn-caret\" aria-hidden=\"true\">▼</span>"
    + "<span class=\"vn-progress\">" + (index + 1) + " / " + beat.lines.length
    + (remaining > 0 ? " · 続き " + remaining : "") + "</span>"
    + "</div></div>"
    + (lastLine && beat.footer ? "<p class=\"vn-note\">" + esc(beat.footer) + "</p>" : "")
    + controls
    + "<p class=\"hint vn-hint\">タップで進みます。</p>"
    + (state.story?.logOpen ? storyBacklog() : "")
    + "</section>";
  return shell("", "", scene, { hideHeaderAction: true });
}


// 文字送り。**表示は DOM 側で進める。**state を一文字ごとに書き換えない
// （保存が毎フレーム走ると端末の保存枠を無駄に削る）。
function mountStoryView() {
  stopStoryTimers();
  const scene = app.querySelector(".vn");
  const target = scene?.querySelector(".vn-text");
  if (!scene || !target) return;
  const full = target.dataset.full ?? "";
  const beat = currentStoryBeat();
  const key = (beat?.id ?? "") + ":" + storyLineIndex();
  // 舞台は button ではないので、Enter / Space を自分で拾う。
  scene.querySelector(".vn-stage")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
    event.preventDefault();
    event.currentTarget.click();
  });
  const settle = () => {
    target.textContent = full;
    storyTypingDone = true;
    storyShownLine = key;
    scene.classList.add("typed");
    if (state.story?.auto && !state.story?.logOpen) {
      storyAutoTimer = setTimeout(() => { advanceStoryLine(); }, STORY_AUTO_HOLD_MS);
    }
  };
  if (state.story?.logOpen || storyShownLine === key) { settle(); return; }
  storyTypingDone = false;
  scene.classList.remove("typed");
  target.textContent = "";
  let cursor = 0;
  const step = () => {
    cursor += 1;
    target.textContent = full.slice(0, cursor);
    if (cursor >= full.length) { settle(); return; }
    storyTypeTimer = setTimeout(step, STORY_TYPE_MS);
  };
  if (!full.length) settle();
  else storyTypeTimer = setTimeout(step, STORY_TYPE_MS);
}

// 表示中の一行を履歴へ積む。**同じ行を二度積まない。**
function pushStoryLog(beat, index) {
  const line = beat?.lines?.[index];
  if (!line) return;
  const log = [...(state.story?.log ?? [])];
  const key = beat.id + ":" + index;
  if (log.length && log[log.length - 1].key === key) return;
  log.push({ key, who: line.who, speaker: line.speaker, text: line.text });
  state.story = { ...state.story, log: log.slice(-STORY_LOG_LIMIT) };
}

// 一行進める。**断片を跨いだら次の断片の一行目へ。**積むものが尽きたら after へ。
function advanceStoryLine() {
  stopStoryTimers();
  const beat = currentStoryBeat();
  if (!beat) { finishStory(); return; }
  const index = storyLineIndex();
  if (index + 1 < beat.lines.length) {
    state.story = { ...state.story, lineIndex: index + 1 };
    pushStoryLog(beat, index + 1);
    saveState();
    render();
    return;
  }
  const queue = [...(state.story.queue ?? [])];
  queue.shift();
  state.story = { ...state.story, queue, lineIndex: 0 };
  if (!queue.length) { finishStory(); return; }
  pushStoryLog(queue[0], 0);
  saveState();
  render();
}

// 物語の queue を積んで story 画面へ入る。**積むものが無ければ、そのまま次へ。**
function enterStory(beats, after) {
  const queue = beats.filter(Boolean);
  state.story = { queue, after, lineIndex: 0, auto: state.story?.auto === true, log: [], logOpen: false };
  if (!queue.length) {
    finishStory();
    return;
  }
  pushStoryLog(queue[0], 0);
  state.phase = "story";
  saveState();
  render();
}

function finishStory() {
  stopStoryTimers();
  const after = state.story?.after ?? "camp";
  state.story = { queue: [], after: "camp", lineIndex: 0, auto: state.story?.auto === true, log: [], logOpen: false };
  if (after === "prologue") {
    startPrologue();
    return;
  }
  // 根城の日常場面のあとは、**入ってきた画面へ戻す。**
  // 精算から来たときは根城の一枚へ、ギルドの根城タブから来たときはそのタブへ。
  // （戻り先を一つに決めると、タブから読み返した人が遠征の仕立てから弾かれる。）
  if (after === "homestead" || after === "guildHomestead") {
    state.phase = after === "homestead" ? "homestead" : "expeditionStart";
    if (after === "guildHomestead") state.guildTab = "homestead";
    saveState();
    render();
    return;
  }
  // issue #212 — Stage 終了会話のあとに、すでに一度だけ確定した精算へ戻る。
  // lastSettlement は会話へ入る前に保存済みなので、リロードや SKIP でも二重精算しない。
  if (after === "settlement") {
    state.phase = "settlement";
    saveState();
    render();
    return;
  }
  // R12 §4.C — issue #138 改 — 幕の断片のあとは、戦闘前確認を挟まず
  // そのまま自動戦闘へ入る。
  if (after === "battle") {
    simulateAndEnterBattle();
    return;
  }
  // R11 §5 — 倒れた会話のあとで、巻き戻しのボタンを持つ画面へ出る。
  if (after === "prologueResult") {
    state.phase = "result";
    saveState();
    render();
    return;
  }
  // R11 §5 改 — 二度目の勝利は、そのまま本編1戦目の勝利として扱う。**ここで
  // 既読印は押すが、prologueActive は落とさない。**結果画面（報酬選択を兼ねる）を
  // 通常の勝利と同じ経路で見せたあと、次の戦闘へ進むとき（advanceAfterReward）に
  // 初めて落とす。ここで落とすと、結果画面が currentEncounter() 経由で
  // 「灰の入口」（12戦の第1戦）の名を誤って出してしまう。
  if (after === "prologueClear") {
    state.profile = {
      ...state.profile,
      storyFlags: [...new Set([...(state.profile.storyFlags ?? []), "prologue_seen"])],
    };
    record("prologue_cleared", { stage: state.run.campaignStageSequence });
    state.phase = "result";
    saveState();
    render();
    return;
  }
  state.phase = "camp";
  state.tab = "roster";
  saveState();
  render();
}

// R11 §5 — **一戦目は「誰かが倒れた瞬間」で見せ終える。**
//
// engine は最後まで走らせて本当の敗北を出している（story.test.mjs が確かめる）。
// だが、まだルールを知らない一戦目に時間切れまで見せると、何が悪かったのか
// 分からないまま長い。倒れた拍で切って、そのまま巻き戻しの会話へ渡す。
//
// **切るのは表示だけ。**勝敗も因果も engine が出したものをそのまま使う。
function truncateAtFall(replay, characterId) {
  const target = "a_" + characterId;
  const index = replay.events.findIndex((event) => event.type === "actor_defeated"
    && [event.sourceActorId, ...(event.targetActorIds ?? [])].filter(Boolean).includes(target));
  if (index < 0) return replay;
  return {
    events: replay.events.slice(0, index + 1),
    snapshots: replay.snapshots.slice(0, index + 1),
  };
}

// R9 §2.1 — 本当に負ける配置を、本当に走らせる。
function startPrologue() {
  const battle = makePrologueBattle(statsFor);
  const result = simulateBattle(battle, PLAYABLE_CONTENT, {
    equipmentBreaks: false,
    captureReplaySnapshots: true,
  });
  state.prologueActive = true;
  state.prologueStage = "first";
  state.lastResult = compactResult(result);
  // 既定配置では、ツグミが2ラウンド目に倒れる。そこで見せ終える。
  const replay = truncateAtFall(compactReplay(result), "mender");
  state.replayEvents = replay.events;
  state.replaySnapshots = replay.snapshots;
  state.replayIndex = 0;
  state.replayPlaying = true;
  state.phase = "battle";
  record("prologue_started", { battleId: battle.battleId, result: result.result });
  saveState();
  render();
}

// Campaignの物語イベントは、初訪・再訪で分岐しない。
// 同じStageでは opening / join・幕の断片・stageEnd を何度でも同じ順で表示する。
// 読み飛ばしたいときは、会話画面のスキップを使う。
// R12 §4.C — **幕の切れ目に短い断片を置く。**
//
// 4・8・12戦目は act boss で、プレイヤーが必ず一度止まる点である。ここに置けば
// 新しい導線を作らずに済む。12戦のあいだが完全な無音だったのを埋めるための枠で、
// **pack の説明はしない**（説明は opening / join / stageEnd が既に持っている）。
const ACT_BOSS_ENCOUNTERS = Object.freeze({ 4: "act1", 8: "act2", 12: "act3" });

function actStoryBeatForEncounter(sequence, encounterIndex) {
  const key = ACT_BOSS_ENCOUNTERS[encounterIndex];
  if (!key) return null;
  const stage = CAMPAIGN_STAGES[sequence];
  if (!stage) return null;
  return storyBeat(stage.id, key);
}

function storyBeatsForStart(sequence) {
  const stage = CAMPAIGN_STAGES[sequence];
  if (!stage) return { beats: [], after: "camp" };
  if (sequence === 0) {
    const seen = (state.profile.storyFlags ?? []).includes("prologue_seen");
    // opening は再訪でも同じ会話を表示する。序盤の敗北・巻き戻しだけは、
    // 専用チュートリアルとして初回に限る。
    return {
      beats: [storyBeat(stage.id, "opening")],
      after: seen ? "camp" : "prologue",
    };
  }
  return { beats: [storyBeat(stage.id, "join")], after: "camp" };
}

function renderCamp() {
  const tutorialLocked = supplyTutorialVisible();
  const activeTab = tutorialLocked ? "supplies" : state.tab;
  const view = {
    roster: renderRoster,
    skills: renderSkills,
    equipment: renderEquipment,
    supplies: renderSupplies,
    map: renderMap,
  }[activeTab]?.() ?? renderMap();
  // R14 §1 — 予測とタブは一つの塊で上端に貼りつく。**どのタブで何を触っても、
  // 各メンバーのHPと減少量が視界から出ない。**
  return shell("", "",
    "<div class=\"camp-top\">" + forecastBar() + campNav() + "</div>" + campTools() + view);
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
  const metOptions = metCharacterOptions();
  const rosterOptions = rosterLocked()
    ? CHARACTER_OPTIONS.filter((option) => state.run.roster.includes(option.id))
    : metOptions;
  const characterCards = rosterOptions.map((option) => {
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
      + "</span><span>技術 " + stats.stats.focus + trainedMark(stats, "focus")
      + "</span><span>受け " + stats.stats.guard + trainedMark(stats, "guard")
      + "</span><span>AP " + (PLAYABLE_CONTENT.characters[option.id]?.baseActionPoints ?? "-")
      + " / RP " + (PLAYABLE_CONTENT.characters[option.id]?.baseReactionPoints ?? "-")
      + "</span><span>" + esc(actionLabel) + "</span></div></article>";
  }).join("");
  const instruction = formationSelection ? "移動先を選んでください。" : "仲間を選んでください。";
  const rosterCopy = rosterLocked()
    ? "今回は" + runPartySize() + "人で進みます。同行者は物語が決めます。"
    : "会った仲間から" + runPartySize() + "人を選びます。";
  const rewindTutorialNote = state.prologueActive && state.prologueStage === "retry"
    ? "<p class=\"muted tutorial-note\"><b>同じ影、同じ数。違うのは立ち位置だけ。</b>"
      + "腕力で振る武器は後列から出すと大きく落ち、技術で通す技は落ちない。"
      + "ツグミの応急手当は自分には効かず、被弾したゴウを後ろから手当てできる。"
      + "ツグミを後列へ、ゴウを前列へ置いて、上の戦闘予測がどう動くか見てほしい。</p>"
    : "";
  return "<section class=\"card\">" + sectionHeading("FORMATION", "隊列",
      "<span class=\"stage\">" + partyLabel() + "</span>")
    + "<p class=\"operation-note\" role=\"status\">" + instruction + "</p>"
    + "<div class=\"formation-board\">" + slots + "</div>"
    + helpDetails("formation", "配置の説明",
      "<p class=\"muted\">前列は武器攻撃を通しやすく、後列は技術による攻撃や支援に向きます。前列の人数で狙われ方も変わります。</p>"
      + "<p class=\"muted\">仲間を選んでから位置枠を選ぶと交換できます。同じ枠をもう一度押すと選択を解除します。</p>")
    + rewindTutorialNote
    + "</section>"
    + "<section class=\"card\">" + sectionHeading("ROSTER", rosterLocked() ? "今回の同行者" : "仲間を選ぶ")
    + "<p class=\"operation-note\">" + rosterCopy + "</p>"
    + "<div class=\"character-grid\">" + characterCards + "</div></section>";
}


const SLOT_KEYS = { active: "tactics", reactive: "reactives", passive: "passives" };
const SLOT_TITLES = {
  active: "アクティブ（順番）",
  reactive: "リアクティブ",
  passive: "パッシブ（いつでも効く）",
};

// issue #176 — 状態（バフ・デバフ）の説明。**本文は content/statuses.mjs にしかない。**
// 画面はそれを並べるだけなので、定義を変えれば説明も一緒に動く。
function statusGlossaryHelp() {
  const rows = STATUS_GLOSSARY.map((entry) => "<div class=\"glossary-row\">"
    + "<b class=\"status-term " + (entry.polarity === "positive" ? "good" : "bad") + "\">"
    + esc(entry.displayName) + "</b>"
    + "<small>" + esc(entry.summary)
    + "（最大" + entry.maxStacks + "段・" + esc(entry.durationText) + "）</small></div>").join("");
  return helpDetails("status-rules", "状態（バフ・デバフ）の意味",
    "<p class=\"muted\">技能の説明にある「守勢を1つ」などは、ここの状態を1段つけるという意味です。</p>"
    + "<div class=\"glossary\">" + rows + "</div>"
    + "<p class=\"muted\">防壁（総量を吸う）・受け構え（一撃を回数で無効にする）・受け（一撃ごとの固定軽減）は"
    + "状態ではなく、それぞれ別の守りです。</p>");
}

// その行動に固有条件・発動条件があるかを表示する（issue #176）。
// 技能の順番は、現在位置からのラウンドロビン走査に使う。
function activeFiringLabel(skillId) {
  const skill = PLAYABLE_CONTENT.activeSkills?.[skillId];
  if (!skill) return null;
  if ((skill.intrinsicPredicates ?? []).length) return "条件つき";
  if (tacticUseWhenFor(skillId).length) return "条件つき";
  const filters = skill.targetQuery?.filters ?? [];
  if (filters.some((filter) => filter.type !== "alive")) return "条件つき";
  return "無条件";
}

function skillSlotRows(characterId, kind) {
  const key = SLOT_KEYS[kind];
  const list = state.run.loadout[key]?.[characterId] || [];
  const title = SLOT_TITLES[kind];
  const rows = list.map((skillId, index) => {
    const info = COMPONENTS[skillId];
    const disabled = skillDisabled(characterId, skillId);
    const moveButtons = kind === "active" || kind === "reactive"
      ? "<span class=\"reorder\">" + button("↑", "move-skill", index === 0, "icon-button", "data-character=\"" + characterId + "\" data-kind=\"" + kind + "\" data-index=\"" + index + "\" data-direction=\"-1\"")
        + button("↓", "move-skill", index === list.length - 1, "icon-button", "data-character=\"" + characterId + "\" data-kind=\"" + kind + "\" data-index=\"" + index + "\" data-direction=\"1\"") + "</span>"
      : "";
    const markerClass = kind === "passive" ? "bullet passive" : "order";
    const marker = kind === "passive" ? "↳" : index + 1;
    // issue #176 — 無条件／条件つきを行に出し、条件の読み落としを防ぐ。
    const firing = kind === "active" ? activeFiringLabel(skillId) : null;
    const firingChip = firing
      ? "<span class=\"firing-chip " + (firing === "無条件" ? "always" : "conditional") + "\">" + firing + "</span>"
      : "";
    return "<div class=\"installed-row" + (disabled ? " disabled" : "") + "\"><span class=\"" + markerClass + "\">"
      + marker + "</span><span class=\"installed-copy\"><b>"
      + esc(info?.label ?? nameFor(skillId)) + firingChip + "</b><small>"
      + esc(skillEffectText(characterId, skillId)) + "</small></span>"
      + moveButtons
      + button(disabled ? "オンにする" : "オフにする", "toggle-skill", false, "tiny-button skill-toggle",
        "data-character=\"" + characterId + "\" data-skill=\"" + skillId + "\" data-kind=\"" + kind + "\"")
      + "<span class=\"skill-state\" title=\"" + (disabled ? "効果は一時停止中です" : "効果は有効です") + "\">"
      + (disabled ? "オフ" : "有効") + "</span></div>";
  }).join("");
  return "<div class=\"slot-group\"><div class=\"slot-heading\"><span>" + title + "</span><small>"
    + list.length + " · 無制限</small></div>"
    + (rows || "<p class=\"empty-slot\">技能ツリーから装着してください。装着後はここでオン/オフを切り替えられます。</p>") + "</div>";
}

function memberTabs(characterId, options = {}) {
  const showSkillPoints = options.showSkillPoints !== false;
  return "<div class=\"member-tabs\" aria-label=\"仲間を選ぶ\">" + state.run.roster.map((id) => "<button type=\"button\" class=\"member-tab "
    + (id === characterId ? "active" : "") + "\" aria-pressed=\"" + (id === characterId ? "true" : "false")
    + "\" data-action=\"select-character\" data-character=\"" + id
    + "\"><span class=\"avatar small\">" + esc(characterInfo(id)?.icon ?? "・") + "</span>"
    + "<span>" + characterName(id) + "<small>" + positionText(state.run.formation[id])
    + (showSkillPoints ? " · " + skillPointsFor(id) + "pt" : "") + "</small></span></button>").join("") + "</div>";
}


function memberContext(characterId, emphasis = "skills") {
  const option = characterInfo(characterId);
  const active = (state.run.loadout.tactics?.[characterId] || []).map((id) =>
    (COMPONENTS[id]?.label ?? nameFor(id)) + (skillDisabled(characterId, id) ? "（オフ）" : ""));
  const reactive = (state.run.loadout.reactives?.[characterId] || []).map((id) =>
    (COMPONENTS[id]?.label ?? nameFor(id)) + (skillDisabled(characterId, id) ? "（オフ）" : ""));
  const worn = (state.run.loadout.equipment?.[characterId] || []).map((id) => nameFor(id));
  const primary = emphasis === "skills"
    ? "装備 " + (worn.length ? worn.join(" · ") : "なし")
    : "アクティブ " + (active.length ? active.join(" → ") : "なし");
  const secondary = emphasis === "skills"
    ? "位置 " + positionText(state.run.formation[characterId]) + " · HP " + currentHp(characterId) + "/" + maxHp(characterId)
    : "リアクティブ " + (reactive.length ? reactive.join(" · ") : "なし");
  return "<section class=\"member-context\"><div class=\"member-context-head\"><span class=\"avatar\">"
    + esc(option?.icon ?? "・") + "</span><div><h3>" + esc(characterName(characterId))
    + "</h3><small>" + esc(option?.role ?? "") + " · " + esc(option?.summary ?? "") + "</small></div></div>"
    + "<div class=\"member-context-loadout\"><span><b>" + esc(primary) + "</b></span><span><b>" + esc(secondary) + "</b></span></div></section>";
}


function skillBuildSummary(characterId) {
  const active = (state.run.loadout.tactics?.[characterId] || []).map((id) =>
    (COMPONENTS[id]?.label ?? nameFor(id)) + (skillDisabled(characterId, id) ? "（オフ）" : ""));
  const reactive = (state.run.loadout.reactives?.[characterId] || []).map((id) =>
    (COMPONENTS[id]?.label ?? nameFor(id)) + (skillDisabled(characterId, id) ? "（オフ）" : ""));
  const passive = (state.run.loadout.passives?.[characterId] || []).map((id) =>
    (COMPONENTS[id]?.label ?? nameFor(id)) + (skillDisabled(characterId, id) ? "（オフ）" : ""));
  const definition = PLAYABLE_CONTENT.characters[characterId] ?? {};
  const selectedNode = SKILL_TREE_NODES.find((node) => node.skillId === state.selectedSkillNode);
  const selectedInfo = selectedNode ? COMPONENTS[selectedNode.skillId] : null;
  const slotKey = selectedNode ? SLOT_KEYS[selectedNode.kind] : null;
  const slotLabel = selectedNode?.kind === "active" ? "アクティブ枠"
    : selectedNode?.kind === "reactive" ? "リアクティブ枠" : "パッシブ枠";
  const slotCount = selectedNode ? (state.run.loadout[slotKey]?.[characterId] || []).length : 0;
  const target = selectedNode
    ? "選択中: " + (selectedInfo?.label ?? nameFor(selectedNode.skillId)) + " · 装着先: " + characterName(characterId)
      + " · " + slotLabel + "（" + slotCount + " · 無制限）"
    : "技能を選択すると、ここに装着先を表示";
  return "<aside class=\"skill-build-summary\" aria-live=\"polite\"><div class=\"skill-build-summary-head\"><span class=\"avatar small\">"
    + esc(characterInfo(characterId)?.icon ?? "・") + "</span><span><b>" + esc(characterName(characterId))
    + "のビルド</b><small>" + esc(positionText(state.run.formation[characterId])) + " · "
    + esc(characterInfo(characterId)?.role ?? "") + "</small></span></div><div class=\"skill-summary-slots\"><span><b>アクティブ</b> "
    + esc(active.length ? active.join(" · ") : "なし") + "</span><span><b>リアクティブ</b> "
    + esc(reactive.length ? reactive.join(" · ") : "なし") + "</span><span><b>パッシブ</b> "
    + esc(passive.length ? passive.join(" · ") : "なし") + "</span></div><div class=\"skill-summary-stats\">"
    + "<span><b>HP</b> " + currentHp(characterId) + "/" + maxHp(characterId) + "</span><span><b>AP</b> "
    + (definition.baseActionPoints ?? "-") + "</span><span><b>RP</b> " + (definition.baseReactionPoints ?? "-")
    + "</span></div><div class=\"skill-summary-target\">"
    + esc(target) + "</div></aside>";
}
function skillNodeIcon(node) {
  return branchIcons[node.branch] ?? "·";
}

// R19（issue #137）— ツリーは種別で三つに分かれる。**AP を払うアクティブと RP を払うリアクティブが
// 同じ枝に混ざっていると、どちらの資源を伸ばす話なのかが読めない。**
const SKILL_TREE_KINDS = SKILL_TREE_GROUPS.map((group) => group.kind);

// R12 — manifest に無い技能ノードは**出さない**。
//
// R6 §5.2 は「灰色にして残す。消すと今回は出ないことが分からなくなる」と言っていた。
// それは Free / Endless の random manifest（毎回どれかの系統が欠ける）の話である。
// Campaign の pack は累積するので、**manifest に無い＝まだ物語が配っていない語彙**に
// なった。灰色で名前だけ見せると、未解禁 pack と次 Stage の技能が先に割れる。
// Free mode を削除した R12 では、灰色に残す理由そのものが無い（作者判断）。
function visibleSkillNodes() {
  return SKILL_TREE_NODES.filter((node) => inManifest(node.skillId));
}

// **森は毎回組み直す。**pack が変われば出る節が変わり、座標も変わる。
// 座標を保存して使い回すと、外れた pack のぶんだけ穴が空いた森になる。
function skillTreeLayout() {
  return buildSkillTreeLayout(visibleSkillNodes());
}

function selectedSkillKind() {
  const requested = state.skillTreeKind;
  return SKILL_TREE_KINDS.includes(requested) ? requested : "active";
}

// 消費と、いつ出るのか。**節の上で読めないと、取ってから初めて分かることになる。**
function skillCostText(node) {
  const definition = PLAYABLE_CONTENT.activeSkills?.[node.skillId]
    ?? PLAYABLE_CONTENT.reactiveSkills?.[node.skillId]
    ?? PLAYABLE_CONTENT.passiveSkills?.[node.skillId];
  if (!definition) return "—";
  if (node.kind === "active") return "AP" + (definition.apCost ?? 0);
  if (node.kind === "reactive") {
    const rp = (definition.rule?.costs ?? []).find((cost) => cost.type === "spend_reaction_points");
    const hp = (definition.rule?.costs ?? []).find((cost) => cost.type === "lose_hp");
    return (rp ? "RP" + rp.amount : "RP0") + (hp ? " · HP" + hp.amount : "");
  }
  return "常時";
}

function skillConditionText(node) {
  const definition = PLAYABLE_CONTENT.activeSkills?.[node.skillId]
    ?? PLAYABLE_CONTENT.reactiveSkills?.[node.skillId]
    ?? PLAYABLE_CONTENT.passiveSkills?.[node.skillId];
  if (!definition) return "";
  if (node.kind === "reactive") return TRIGGER_LABELS[definition.rule?.listenTo] ?? definition.rule?.listenTo ?? "";
  if (node.kind === "active") return (SCOPE_LABELS[definition.targetQuery?.scope] ?? "") + "へ";
  return definition.statBonus ? "基礎値を上げる" : "条件を満たす限り";
}

// 節の状態。**取得・装着・解禁可否は四箇所で使うので一箇所で出す。**
function skillNodeState(node, characterId) {
  const unlocked = isUnlocked(characterId, node.skillId);
  const equipped = installedSkill(characterId, node.skillId, node.kind);
  const disabled = equipped && skillDisabled(characterId, node.skillId);
  // issue #168 — 前提は Lv まで見る。判定は content/skill-tree.mjs の一箇所
  // （解禁 API と同じ関数）を通るので、画面が「取れます」と言ったのに押すと
  // 断られる、が起きない。
  const unmet = unmetPrerequisites(node, (skillId) => skillLevelOf(characterId, skillId));
  const prereqsMet = unmet.length === 0;
  const canUnlock = !unlocked && prereqsMet && skillPointsFor(characterId) >= node.cost;
  const stateClass = equipped
    ? "equipped" + (disabled ? " disabled" : "")
    : unlocked ? "unlocked" : canUnlock ? "available" : !prereqsMet ? "prerequisite" : "locked";
  const status = equipped
    ? (disabled ? "装着中 · オフ" : "装着中")
    : unlocked ? "取得済み"
      : canUnlock ? "解禁可能 · " + node.cost + "pt"
        : !prereqsMet ? "前提待ち · " + node.cost + "pt" : "点数不足 · " + node.cost + "pt";
  return { unlocked, equipped, disabled, prereqsMet, unmet, canUnlock, stateClass, status };
}

// issue #168 — 前提が足りない理由は「まだ解禁していない」と「Lv が足りない」の
// 二つある。**どちらなのかを書く。**「先に前提を解禁してください」とだけ出すと、
// 解禁済みの前提を見て手が止まる。
function prerequisiteShortfallText(characterId, unmet = []) {
  const parts = (unmet ?? []).map((required) => {
    const label = COMPONENTS[required.skillId]?.label ?? required.skillId;
    const level = skillLevelOf(characterId, required.skillId);
    return level > 0 && required.minLv > level
      ? label + "を Lv" + required.minLv + "まで上げてください（いま Lv" + level + "）。"
      : label + "を先に解禁してください。";
  });
  return parts.length ? parts.join("") : "先に前提を解禁してください。";
}

// **前提と派生先は、押せる形で出す。**iPhone ではここを叩いて route を辿る
// （横スクロールしなくても、前提へ戻る・派生先へ進むができる）。
function skillRouteChip(skillId, minLv = MIN_SKILL_LEVEL) {
  const node = SKILL_TREE_NODES.find((entry) => entry.skillId === skillId);
  if (!node) return "";
  // issue #168 — 親を伸ばして初めて開く前提なら、**必要な Lv をチップに書く。**
  // 現行の全節は Lv1 しか要求しないので、いまはどのチップにも出ない。
  const need = minLv > MIN_SKILL_LEVEL ? " Lv" + minLv + "以上" : "";
  return "<button type=\"button\" class=\"route-chip\" data-action=\"select-skill-node\" data-skill=\"" + esc(skillId)
    + "\"><span>" + esc(branchIcons[node.branch] ?? "·") + "</span>" + esc(COMPONENTS[skillId]?.label ?? skillId)
    + "<small>" + esc(kindText(node.kind) + need) + "</small></button>";
}

// R19（issue #137）— 現在レベル／最大レベル。**上位互換を別技能で増やさないので、
// 同じ節が何段まで伸びるのかを節の上で読めるようにする。**
function levelBadge(node, characterId) {
  const cap = skillLevelCapOf(node.skillId);
  if (cap <= 1) return "<i class=\"badge-level flat\">レベルなし</i>";
  const level = skillLevelOf(characterId, node.skillId);
  const shown = level > 0 ? level : "—";
  return "<i class=\"badge-level" + (level >= cap ? " maxed" : "") + "\">Lv " + shown + "/" + cap + "</i>";
}

// issue #148 — **説明文の数字そのものを、いまのレベルの値にする。**
//
// レベルが上げるのは威力・治療量・防壁という連続量だけで、AP / RP や段数は
// 変わらない。1段（+12%）では**次の一戦の予測が動かないことのほうが多い**ので、
// 倍率を別行に添えるだけでは「Lv だけ上がって何も強くなっていない」と読めてしまう。
// 「腕力130%の一撃」が Lv2 で「腕力146%の一撃」と書かれていれば、その一行で済む
// （作者指摘）。掛かる数と掛からない数の見分けは content/skill-levels.mjs にある。
function skillDefinitionOf(skillId) {
  return PLAYABLE_CONTENT.activeSkills[skillId]
    ?? PLAYABLE_CONTENT.reactiveSkills[skillId]
    ?? PLAYABLE_CONTENT.passiveSkills[skillId]
    ?? null;
}

function skillEffectText(characterId, skillId) {
  const text = COMPONENTS[skillId]?.effect ?? "";
  return skillTextAtLevel(text, skillDefinitionOf(skillId), skillLevelOf(characterId, skillId));
}

// 取得済みの技能を1段上げる操作。**解禁と同じ通貨・同じ値段**なので、
// 「深く伸ばす」と「いま持っているものを厚くする」を同じ天秤で選べる。
function levelUpAction(node, characterId, nodeState) {
  const cap = skillLevelCapOf(node.skillId);
  if (cap <= 1) {
    return "<p class=\"node-locked\">この技能はレベルを持ちません。</p>";
  }
  if (!nodeState.unlocked) {
    return "<p class=\"node-locked\">解禁するとLv1になり、そこから技能点1点で上げられます。</p>";
  }
  const level = skillLevelOf(characterId, node.skillId);
  if (level >= cap) {
    return "<p class=\"node-locked\">最大レベルです（Lv " + cap + "）。上の説明は Lv "
      + level + " の値で書いてあります。</p>";
  }
  const affordable = skillPointsFor(characterId) >= SKILL_LEVEL_COST;
  // **1点で、上の説明のどの数字がいくつになるか。**倍率ではなく、変わる数そのものを出す。
  const steps = skillLevelValueSteps(
    COMPONENTS[node.skillId]?.effect ?? "", skillDefinitionOf(node.skillId), level,
  );
  const change = steps.length
    ? "上の説明の数字が <b>"
      + steps.map((step) => esc(step.from) + " → " + esc(step.to)).join("</b>、<b>") + "</b> になります。"
    : "威力・治療量・防壁が 12% 上がります。";
  return button("Lv " + (level + 1) + " へ上げる（" + SKILL_LEVEL_COST + "点・戻せません）",
    "level-up-skill", !affordable, "tiny-button" + (affordable ? " primary-mini" : ""),
    "data-character=\"" + characterId + "\" data-skill=\"" + node.skillId + "\"")
    + "<p class=\"node-locked level-now\">" + change
    + "AP / RP や段数・回数は変わりません。<b>1段では次の一戦の予測が動かないこともあります</b>"
    + "（倒すのに要るラウンドが変わらなければ、残るHPも変わりません）。</p>";
}


function renderSkillDetail(row, node, characterId, nodeState) {
  const derived = row.children;
  const requires = node.requires;
  const cap = skillLevelCapOf(node.skillId);
  const level = skillLevelOf(characterId, node.skillId);
  const levelSummary = cap > 1
    ? "<p class=\"skill-level-readout\"><b>現在 Lv" + level + " / " + cap + "</b>"
      + (level < cap ? " · 次は Lv" + (level + 1) + "（技能点" + SKILL_LEVEL_COST + "点）" : " · 最大レベル") + "</p>"
    : "<p class=\"skill-level-readout\">この技能はレベルなし</p>";
  const action = nodeState.equipped
    ? button(nodeState.disabled ? "オンにする" : "オフにする", "toggle-skill", false, "tiny-button skill-toggle",
      "data-character=\"" + characterId + "\" data-skill=\"" + node.skillId + "\" data-kind=\"" + node.kind + "\"")
      + "<p class=\"node-locked\">取得状態は変わりません。オフにすると、この遠征の戦闘では効果だけを止めます。</p>"
    : nodeState.unlocked
      ? button("装着する", "equip-skill", false, "tiny-button", "data-character=\"" + characterId
        + "\" data-skill=\"" + node.skillId + "\" data-kind=\"" + node.kind + "\"")
      : nodeState.canUnlock
        ? button("解禁（" + node.cost + "点・戻せません）", "unlock-skill", false, "tiny-button primary-mini",
          "data-character=\"" + characterId + "\" data-skill=\"" + node.skillId + "\"")
        : "<p class=\"node-locked\">"
          + (nodeState.prereqsMet
            ? "技能点が足りません（必要 " + node.cost + "点 / 手持ち " + skillPointsFor(characterId) + "点）。"
            : prerequisiteShortfallText(characterId, nodeState.unmet))
          + "</p>";
  // **説明文はいまのレベルの値で読む。**Lv1 では元の文のまま。
  return "<div class=\"skill-detail\"><p>" + esc(skillEffectText(characterId, node.skillId))
    + (level > 1 ? "<span class=\"level-now-tag\">Lv " + level + " の値</span>" : "") + "</p>"
    + "<p class=\"skill-detail-status\">状態: " + esc(nodeState.status) + "</p>"
    + levelSummary
    + "<div class=\"skill-route\"><span class=\"route-line\"><b>前提</b>"
    + (requires.length
      ? requires.map((required) => skillRouteChip(required.skillId, required.minLv)).join("")
      : "<small>なし（いつでも取れる）</small>") + "</span>"
    + "<span class=\"route-line\"><b>派生先</b>"
    + (derived.length ? derived.map(skillRouteChip).join("") : "<small>ここが終点</small>") + "</span></div>"
    + "<p class=\"route-build\">" + esc(BRANCH_BUILDS[node.branch] ?? "") + "</p>"
    + "<div class=\"node-action\">" + action + "</div>"
    + "<div class=\"node-action level-action\">" + levelUpAction(node, characterId, nodeState) + "</div></div>";
}


function renderSkillRow(row, characterId, tone) {
  const node = row.node;
  const info = COMPONENTS[node.skillId];
  const nodeState = skillNodeState(node, characterId);
  const selected = state.selectedSkillNode === node.skillId;
  const detail = selected ? renderSkillDetail(row, node, characterId, nodeState) : "";
  return "<div class=\"tree-cell" + tone + (selected ? " selected" : "") + "\" data-node=\"" + esc(row.key)
    + "\" style=\"grid-column:" + row.x + ";grid-row:" + (row.y + 1) + "\">"
    + "<article class=\"skill-node " + nodeState.stateClass + (selected ? " selected" : "") + "\">"
    + "<button type=\"button\" class=\"skill-node-button\" aria-pressed=\"" + (selected ? "true" : "false")
    + "\" data-action=\"select-skill-node\" data-skill=\"" + esc(node.skillId) + "\">"
    + "<span class=\"node-icon\">" + esc(skillNodeIcon(node)) + "</span>"
    + "<span class=\"node-copy\"><b>" + esc(info?.label ?? node.skillId) + "</b>"
    + "<small class=\"node-badges\"><i class=\"kind kind-" + node.kind + "\">" + esc(kindText(node.kind)) + "</i>"
    + "<i class=\"badge-cost\">" + esc(skillCostText(node)) + "</i>"
    + "<i class=\"badge-when\">" + esc(skillConditionText(node)) + "</i>"
    + levelBadge(node, characterId) + "</small></span>"
    + "<span class=\"node-status\">" + esc(nodeState.status) + "</span></button>"
    + detail + "</article></div>";
}


// render() 直後に layoutSkillTreeConnectors() が読む。**線は節の実位置を測ってから
// 引くので、直前に描いた森がどれだったかをここで覚えておく。**
let skillTreeConnectorGroup = null;

function renderSkillTree(characterId) {
  const kind = selectedSkillKind();
  const groups = skillTreeLayout();
  const group = groups.find((entry) => entry.kind === kind) ?? groups[0];
  skillTreeConnectorGroup = group;
  const selectedRow = state.selectedSkillNode ? group.byKey.get(state.selectedSkillNode) : null;
  const onPath = new Set(selectedRow ? selectedRow.ancestors : []);
  const derived = new Set(selectedRow ? selectedRow.descendants : []);
  const tabs = groups.map((entry) => "<button type=\"button\" class=\"tree-tab" + (entry.kind === kind ? " active" : "")
    + "\" aria-pressed=\"" + (entry.kind === kind ? "true" : "false") + "\" data-action=\"select-skill-kind\" data-kind=\""
    + entry.kind + "\"><b>" + esc(entry.label) + "</b><small>" + entry.nodeCount + "</small></button>").join("");
  const rows = group.rows.map((row) => {
    const tone = !selectedRow
      ? ""
      : row.key === selectedRow.key ? ""
        : onPath.has(row.key) ? " on-path"
          : derived.has(row.key) ? " derived" : " faded";
    return renderSkillRow(row, characterId, tone);
  }).join("");
  const legend = selectedRow
    ? "<p class=\"tree-focus\">前提と派生先を強調しています。"
      + button("強調を解除", "select-skill-node", false, "tiny-button", "data-skill=\"\"") + "</p>"
    : "<p class=\"muted tree-focus\">スキルを選ぶと詳細が開きます。</p>";
  const columns = "repeat(" + Math.max(group.depth, 1) + ", var(--tree-col-width))";
  return "<div class=\"tree-tabs\" role=\"tablist\">" + tabs + "</div>"
    + "<p class=\"tree-summary\"><b>" + esc(group.label) + "ツリー</b> · " + esc(group.summary) + "</p>"
    + legend
    + "<div class=\"skill-tree-scroll\" data-branch=\"" + kind + "\"><div class=\"skill-tree-forest\" data-branch=\""
    + kind + "\" style=\"grid-template-columns:" + columns + "\">"
    + "<svg class=\"tree-lines\" aria-hidden=\"true\"></svg>" + rows + "</div></div>";
}


// **線は前提→派生を実座標で結ぶ。**インデントの目分量ではなく、節の実際の位置
// （offsetLeft/offsetTop、スクロール量に左右されない）を測ってから、列の間に
// 直角線を引く。render() が innerHTML を差し替えた直後に呼ぶ。
function layoutSkillTreeConnectors() {
  const group = skillTreeConnectorGroup;
  if (!group) return;
  const forest = app.querySelector(".skill-tree-forest[data-branch=\"" + group.kind + "\"]");
  const svg = forest?.querySelector(".tree-lines");
  if (!forest || !svg) return;
  const nodeEls = new Map();
  forest.querySelectorAll("[data-node]").forEach((element) => nodeEls.set(element.dataset.node, element));
  const selectedRow = state.selectedSkillNode ? group.byKey.get(state.selectedSkillNode) : null;
  const onPath = new Set(selectedRow ? selectedRow.ancestors : []);
  const derived = new Set(selectedRow ? [selectedRow.key, ...selectedRow.descendants] : []);
  const edgeTone = (childKey) => {
    if (!selectedRow) return "";
    if (childKey === selectedRow.key || onPath.has(childKey)) return " on-path";
    if (derived.has(childKey)) return " derived";
    return " faded";
  };
  // **高さの基準は丸印（.node-icon）の中心。**カード全体の中心にすると、
  // バッジが1行で収まる節と2行に折り返す節とで高さが違い、同じ行（＝最初の子として
  // まっすぐ継いだ節）どうしでも線がわずかに曲がって見える（作者からの指摘）。
  // 丸印はどの節でもボタン左上の同じ位置に固定なので、そこを測れば行が同じ節は
  // 必ず同じ高さになる。
  const forestRect = forest.getBoundingClientRect();
  const anchorOf = (element) => {
    const icon = element.querySelector(".node-icon");
    const cellRect = element.getBoundingClientRect();
    const iconRect = icon ? icon.getBoundingClientRect() : cellRect;
    return {
      left: cellRect.left - forestRect.left,
      right: cellRect.right - forestRect.left,
      centerY: iconRect.top - forestRect.top + iconRect.height / 2,
    };
  };
  const paths = [];
  for (const row of group.rows) {
    if (!row.children.length) continue;
    const parentElement = nodeEls.get(row.key);
    if (!parentElement) continue;
    const parentAnchor = anchorOf(parentElement);
    for (const childKey of row.children) {
      const childElement = nodeEls.get(childKey);
      if (!childElement) continue;
      const childAnchor = anchorOf(childElement);
      const busX = parentAnchor.right + (childAnchor.left - parentAnchor.right) / 2;
      const d = "M " + parentAnchor.right + " " + parentAnchor.centerY + " H " + busX
        + " V " + childAnchor.centerY + " H " + childAnchor.left;
      paths.push("<path class=\"tree-line" + edgeTone(childKey) + "\" d=\"" + d + "\"></path>");
    }
  }
  svg.innerHTML = paths.join("");
}

function renderSkills() {
  const characterId = selectedCharacter();
  const pointsBadge = "<span class=\"skill-points-badge\"><small>" + esc(characterName(characterId)) + "の技能点</small><b>" + skillPointsFor(characterId) + "</b></span>";
  const depths = state.run.manifest.packDepths ?? {};
  const packs = state.run.manifest.enabledPackIds
    .map((id) => (PACK_BY_ID[id]?.displayName ?? id) + (depths[id] === "core" ? "（入口）" : ""))
    .join(" · ");
  return "<section class=\"card skill-build-card\">" + sectionHeading("SKILLS", "技能", pointsBadge)
    + "<p class=\"operation-note\">対象を選び、取得済みの順序・オン/オフ・技能ツリーを確認します。</p>"
    + "<p class=\"context-line\">有効な技能パック: <b>" + esc(packs) + "</b> · 技能点と解禁はこの遠征中のみ有効です。</p>"
    + memberTabs(characterId) + memberContext(characterId, "skills")
    + skillSlotRows(characterId, "active") + skillSlotRows(characterId, "reactive") + skillSlotRows(characterId, "passive") + "</section>"
    + "<section class=\"card\">" + sectionHeading("SKILL TREE", "技能ツリー")
    + "<p class=\"operation-note\">スキルを選ぶと詳細が開きます。</p>"
    + "<details class=\"progressive-details skill-tree-details\" open><summary>技能ツリー（選択すると詳細が開きます）</summary>"
    + skillBuildSummary(characterId) + renderSkillTree(characterId)
    + "</details>"
    + helpDetails("skill-rules", "技能のルール",
      "<p class=\"muted\">取得した技能は遠征中に忘れません。使った技能点は戻らず、取得済みの技能はすべて装着できます。</p>"
      // issue #187 — アクティブはカーソルから登録順に走査し、選んだ技能の次へ進む。
      + "<p class=\"muted\"><b>アクティブは現在の位置から順番に判定し、最初に使える一本だけが出ます。</b>"
      + "選んだ技能の次から、次の activation の判定を始めます。<b>条件つき</b>の技能が未達ならスキップし、"
      + "後ろの技能を試します。使える技能が無い activation では位置を進めません。</p>"
      + "<p class=\"muted\">リアクティブも上から順に判定します。こちらは条件が別々なので複数が同じ拍に鳴りますが、"
      + "反応点が尽きた時点で下の技能は出ません。</p>"
      + "<p class=\"muted\">不要な技能は一時的にオフにできます。技能のレベルが上がってもAP・RP・回数は変わりません。</p>")
    + statusGlossaryHelp()
    + "</section>";
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

function renderEquipment() {
  const characterId = selectedCharacter();
  const selected = state.selectedEquipment;
  const inventoryCards = state.run.inventory.map((id) => {
    const owner = equipmentOwner(id);
    const isSelected = selected === id;
    const info = gear(id);
    const max = info?.maxDurability ?? 1;
    const durability = equipmentDurability(id);
    const item = generatedItem(id);
    const readout = item
      ? equipmentReadoutHtml(item, { compact: false })
      : "<small>" + esc(info?.effect ?? "") + "</small>";
    return "<article class=\"gear-card " + (isSelected ? "selected" : "") + (durability === 0 ? " depleted" : "")
      + (item?.rarity ? " rarity-card-" + esc(item.rarity) : "") + "\"><button type=\"button\" class=\"gear-main\" data-action=\"select-equipment\" data-equipment=\"" + id
      + "\"><span class=\"gear-icon\">◆</span><span class=\"gear-copy\"><b>" + esc(info?.label ?? id)
      + rarityChip(item?.rarity) + (item?.carried ? "<span class=\"carried-chip\">持込</span>" : "")
      + "</b>" + readout
      + "</span><span class=\"gear-state\">"
      + (owner ? characterName(owner) : "手元") + "<br>耐久 " + durability + "/" + max + "</span></button>"
      + button("分解", "dismantle", false, "tiny-button", "data-equipment=\"" + id + "\"")
      + "</article>";
  }).join("");
  const slots = "<section class=\"selected-loadout\"><h3>" + esc(characterName(characterId)) + "の装備枠</h3>"
    + "<div class=\"equipment-slots\">" + equipmentSlotHtml(characterId, 0) + equipmentSlotHtml(characterId, 1) + "</div></section>";
  const inventory = "<details class=\"progressive-details equipment-inventory\" open><summary>手元の装備（"
    + state.run.inventory.length + "品）</summary>"
    + "<div class=\"gear-grid\">" + (inventoryCards || "<p class=\"muted\">まだ装備を持っていません。</p>")
    + "</div></details>";
  const selection = selected
    ? "装着する枠を選んでください。"
    : "装備を選んでください。";
  return "<section class=\"card equipment-build-card\">" + sectionHeading("EQUIPMENT", "装備",
      "<span class=\"stage\">" + state.run.inventory.length + " / " + INVENTORY_LIMIT + "</span>")
    + "<p class=\"operation-note\" role=\"status\">" + selection + "</p>"
    + memberTabs(characterId, { showSkillPoints: false }) + memberContext(characterId, "equipment")
    + slots
    + inventory
    + helpDetails("equipment-rules", "装備のルール",
      "<p class=\"muted\">装備は何度でも付け外しできます。生成装備の発火効果は耐久を1消費し、複数効果・多段・範囲効果は2消費します。耐久0では以後の発火効果が不発になります。</p>"
      + "<p class=\"muted\">能力値補正は装着中の常時効果なので耐久を消費しません。修理効果は自己相殺を避け、HPか防壁の有限コストを使います。</p>"
      + "<p class=\"muted\">耐久は戦闘後に最大へ戻り、遠征終了時は装備を手放します。所持上限は" + INVENTORY_LIMIT + "品です。</p>")
    + "</section>";
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
    // R12 §4.B — 狙いの下に、拾い屋の言い分を一行。**規則ではない**ので見た目で分ける。
    + (info.lore ? "<p class=\"enemy-lore\">" + esc(info.lore) + "</p>" : "")
    + "</article>";
}

// R6 §12.1 — 補給は3用途で共有する。**引き直しに使うと再挑戦の余地が減る。**
// そのトレードオフを、残数と用途を同じ場所へ並べて見せる。
function suppliesBar(context) {
  const supplies = state.run.supplies;
  const pips = Array.from({ length: MAX_SUPPLIES }, (_, index) =>
    "<span class=\"supply-pip " + (index < supplies ? "on" : "") + "\"></span>").join("");
  const uses = Object.entries(SUPPLY_USES)
    .map(([id, text]) => "<li><b>" + esc({ retry: "再挑戦", reroll: "引き直し", camp: "野営治療" }[id])
      + "</b> " + esc(text) + "</li>").join("");
  return "<div class=\"supplies-bar\"><div class=\"supplies-head\"><b>補給 " + supplies + " / " + MAX_SUPPLIES
    + "</b><span>" + esc(context ?? "3つの用途で取り合う") + "</span></div>"
    + "<div class=\"supply-pips\">" + pips + "</div><ul class=\"supply-uses\">" + uses + "</ul></div>";
}

function renderSupplies() {
  const scrap = state.run.scrap ?? 0;
  const treatment = isCampaignRun()
    ? campTreatmentBlock()
    : "<section class=\"card quiet\"><p class=\"muted\">この遠征では戦闘ごとにHPが全回復するため、野営治療は使いません。</p></section>";
  return "<section class=\"card\">" + sectionHeading("SUPPLIES", "補給",
      "<span class=\"stage\">" + state.run.supplies + " / " + MAX_SUPPLIES + "</span>")
    + "<p class=\"operation-note\">残りの補給を、再挑戦・報酬の引き直し・野営治療に使います。</p>"
    + suppliesBar("残り " + state.run.supplies + " 個")
    + "<div class=\"scrap-line\"><span>分解の屑 <b>" + scrap + "</b>（" + SCRAP_PER_SUPPLY + "で補給1）</span>"
    + button("補給へ替える", "convert-scrap", scrap < SCRAP_PER_SUPPLY || state.run.supplies >= MAX_SUPPLIES, "tiny-button")
    + "</div></section>"
    + treatment
    + helpDetails("supply-rules", "補給のルール",
      "<p class=\"muted\">補給は遠征中だけ有効な有限資源です。再挑戦と引き直しに使った分は、野営治療には使えません。</p>");
}


function renderMap() {
  const index = state.run.encounterIndex;
  const encounter = currentEncounter();
  const progress = Array.from({ length: ENCOUNTERS_PER_RUN }, (_, offset) => {
    const step = offset + 1;
    const kind = composeEncounter(step, state.run.difficulty, encounterOptions()).kind;
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
  const enemyBlock = "<details class=\"progressive-details enemy-details\" open><summary>敵の情報（"
    + encounter.enemies.length + "体）</summary><div class=\"enemy-grid\">"
    + encounter.enemies.map(renderEnemy).join("") + "</div></details>";
  const ruleBody = isCampaignRun()
    ? "<p class=\"muted\">通常・精鋭戦後はHPを次の戦闘へ持ち越します。4戦目・8戦目のボス後だけ全員が全回復します。敵を倒さずに待ってもHPは戻りません。</p>"
    : "<p class=\"muted\">この遠征では戦闘終了後にHPと装備耐久が最大へ戻ります。</p>";
  return "<section class=\"card\">" + sectionHeading("EXPEDITION", "次の敵",
      "<span class=\"stage\">" + index + " / " + ENCOUNTERS_PER_RUN + "</span>")
    + "<div class=\"map-progress\">" + progress + "</div>"
    + "<div class=\"primary-action map-primary-action\" data-primary-action=\"begin-stage\">"
    + "<p class=\"primary-action-label\">次の操作</p>"
    + button("この敵に挑む", "begin-stage", false, "button primary")
    + "</div>"
    + "<p class=\"act-line\">第" + encounter.act + "幕 · " + kindLabel + "戦 · 危険度 " + encounter.spentThreat
    + " / " + encounter.budget + " · 最大" + encounter.maxRounds + "ラウンド</p><p class=\"lead-small\">"
    + esc(encounter.description) + "</p>"
    + law + enemyBlock
    + "<div class=\"map-party\"><h3>現在の隊列</h3>" + party + "</div>"
    + "</section>"
    + helpDetails("expedition-rules", "遠征のルール", ruleBody);
}


// R8 §9.2 / §10.2 — 野営治療。補給1で3種のうちどれか一つ。
// 単体治療は #159 の対象選択へつなぐため、対象を自動で決めず、
// 「治療を選ぶ」→「対象を選ぶ」→「補給を消費する」の順にする。
function treatmentTargetIds(treatment) {
  if (!treatment) return [];
  return state.run.roster.filter((id) => {
    const hp = currentHp(id);
    return treatment.revive ? hp <= 0 : hp > 0 && hp < maxHp(id);
  });
}

function treatmentResultBlock() {
  const result = state.treatmentResult;
  if (!result) return "";
  const treatment = CAMP_TREATMENTS[result.treatmentId];
  const targetNames = (result.treated ?? []).map((id) => characterName(id)).join("、") || "対象なし";
  const complete = result.tutorialCompleted
    ? "<p><b>傷ついた味方を回復できました。</b>これで次も戦えます。</p>"
    : "";
  return "<div class=\"supply-treatment-result\" role=\"status\">"
    + "<p><b>" + esc(treatment?.displayName ?? "治療") + "を実行しました。</b></p>"
    + "<p class=\"muted\">対象: " + esc(targetNames) + " · 補給残り " + result.supplies + "</p>"
    + complete + "</div>";
}

function treatmentTargetPicker() {
  const treatment = CAMP_TREATMENTS[state.treatmentSelection];
  if (!treatment || treatment.targetCount === "all") return "";
  const candidates = treatmentTargetIds(treatment);
  const buttons = candidates.map((id) => button(
    characterName(id) + " · HP " + currentHp(id) + "/" + maxHp(id),
    "select-treatment-target",
    false,
    "member-tab treatment-target",
    "data-treatment=\"" + esc(treatment.id) + "\" data-character=\"" + esc(id) + "\"",
  )).join("");
  return "<div class=\"treatment-target-picker\" role=\"group\" aria-label=\"" + esc(treatment.displayName) + "の対象選択\">"
    + "<p class=\"operation-note\"><b>手順 2/2</b> 対象を1人選んでください。選ぶまで補給は消費しません。</p>"
    + "<div class=\"member-tabs treatment-targets\">" + buttons + "</div>"
    + button("治療を選び直す", "cancel-treatment-target", false, "tiny-button")
    + "</div>";
}

function campTreatmentBlock() {
  const tutorial = supplyTutorialVisible();
  const selectedTreatment = state.treatmentSelection ? CAMP_TREATMENTS[state.treatmentSelection] : null;
  const rows = Object.values(CAMP_TREATMENTS).map((treatment) => {
    const applicable = treatmentTargetIds(treatment).length > 0;
    const blockedByTutorial = tutorial && treatment.id !== "concentrated";
    const blockedBySelection = state.treatmentSelection && state.treatmentSelection !== treatment.id;
    const disabled = blockedByTutorial || blockedBySelection || state.run.supplies < 1 || !applicable;
    const focus = tutorial && treatment.id === "concentrated";
    const actionLabel = treatment.targetCount === "all"
      ? "補給1で使う"
      : state.treatmentSelection === treatment.id
        ? "対象を選び直す"
        : "対象を選ぶ";
    return "<div class=\"purchase-row" + (focus ? " tutorial-focus" : "") + (state.treatmentSelection === treatment.id ? " treatment-selected" : "") + "\"><span class=\"purchase-copy\"><b>" + esc(treatment.displayName)
      + "</b><small>" + esc(treatment.summary) + "</small></span>"
      + button(actionLabel, "treat", disabled, "tiny-button primary-mini", "data-treatment=\"" + esc(treatment.id) + "\"")
      + "</div>";
  }).join("");
  const tutorialGuide = tutorial
    ? "<div class=\"supply-tutorial\" role=\"status\"><p class=\"eyebrow\">補給チュートリアル</p>"
      + "<h3>次の戦いに備えましょう</h3>"
      + "<p>勝てました。でも、傷は残っています。次の戦いへ進む前に、補給で手当てしてみましょう。</p>"
      + "<p class=\"muted\"><b>手順 1/2</b> 「集中治療」を選び、次に回復する仲間を1人選びます。必要な一手を終えるまで、他のタブと次の戦闘は閉じています。</p>"
      + (selectedTreatment
        ? "<p class=\"muted\"><b>手順 2/2</b> 対象を選んでください。対象を選ぶまで補給は消費しません。</p>"
        : "")
      + "</div>"
    : "";
  return "<section class=\"card\">" + sectionHeading("CAMP TREATMENT", "野営治療",
      "<span class=\"stage\">補給 " + state.run.supplies + "</span>")
    + tutorialGuide + treatmentResultBlock() + rows + treatmentTargetPicker()
    + helpDetails("treatment-rules", "治療の対象",
      "<p class=\"muted\">集中治療と蘇生は治療を選んだあと、対象をプレイヤーが明示的に選びます。集中治療は負傷した生存者、蘇生は戦闘不能者だけが候補です。全体手当は生存者全員へ適用します。</p>")
    + "</section>";
}

// R8 §11 — exact preview。副作用なしで次戦を1回実行し、結果を表示する。
// simulateアクションが実際に使うのと同じBattleInput構成経路（simulateNextBattle）
// を通るので、ここに出る結果は実行結果と完全一致する。
// R14 §1 — **戦闘予測は、組み替えている画面の上に常に出す。**
//
// R8 §11 の exact preview は「戦闘前の最終確認」画面にしか無かった。技能や装備を
// 触るたびに一度そこまで出て、戻って、また触る——という往復になっていて、
// 「次の一戦が完全に読める」というこの遠征の中心が、組み替えの手元に無かった。
// だから camp の全タブの上端へ、同じ試算をそのまま常設する。
//
// **ここも simulateNextBattle を通る。**preview 専用の計算は持たない
// （持った瞬間に、いつか片方だけが正しくなる）。
//
// R14 §1.1 — 出さない一点。**巻き戻す前のチュートリアル1戦目には出さない。**
// あの一戦は「予測どおりに負ける」ためにあり、プレイヤーはまだ巻き戻す力を
// 持っていない。読めても直せない予測は、脅しにしかならない。
function forecastVisible() {
  if (!state.run?.roster?.length) return false;
  return !(state.prologueActive && state.prologueStage === "first");
}

// R14 §1 / issue #148 — **予測と本番へ渡す盤面の外の入力は、この一箇所で組む。**
//
// simulateExpeditionBattle が BattleInput と simulateBattle のオプションを一本化
// しても、**呼び出し側が違う options を渡せば予測と本番はまたずれる。**
// 実際、技能レベルが本番へ渡らず「予測どおりに強くならない」不具合はここで起きた
// （issue #148 / PR #156）。だから preview も本番もこの関数の戻り値をそのまま使い、
// 本番が足してよいのは結果を変えない simulationOptions だけにする。
function expeditionBattleOptions(composed) {
  return {
    composed,
    // R8 §1.5 — Campaign Stage は run.currentHp（持ち越しHP）。
    // Free / Endless は従来どおり state.hp（毎戦満タン）。
    hp: isCampaignRun() ? state.run.currentHp : state.hp,
    equipmentDurability: state.equipmentDurability,
    limitsFor,
  };
}

// 予測は毎 render で戦闘を1回まわす。**入力が変わっていなければ前回の答えを使う。**
// 決定的 engine なので、同じ入力なら同じ結果になる（この cache は結果を変えない）。
let forecastCache = { key: null, value: null };

// **鍵は、戦闘が読む入力を全部数える。**数え落とした欄は「変えたのに予測が動かない」
// になり、予測が壊れているのか変わらないのかを画面から区別できなくなる。
function forecastKey(composed) {
  return JSON.stringify([
    composed?.index ?? null,
    composed?.enemies?.map((enemy) => [enemy.instanceId, enemy.enemyActorId, enemy.position, enemy.stats, enemy.mutations]) ?? null,
    composed?.maxRounds ?? null,
    state.run.runSeed,
    state.run.difficulty,
    state.run.roster,
    state.run.formation,
    state.run.loadout,
    state.run.currentHp,
    state.run.runSkillLevels,
    // 技能レベル表は runUnlockedSkills を辿って組まれる（runSkillLevelsFor）。
    // **レベルだけを鍵にすると、取得表の側が動いた回に古い予測が残る。**
    state.run.runUnlockedSkills,
    state.equipmentDurability,
    state.hp,
    Object.keys(state.run.generatedEquipment ?? {}),
    state.run.partySize,
    // 鍛錬と枠の購入は遠征の外で動くが、味方の stat を変える。**run だけを見て
    // 鍵にすると、ギルドで鍛えて戻った回に古い予測が残る。**
    state.profile.characters,
    state.profile.metaUpgradeLevels,
  ]);
}

// 次の一戦の試算。**読めなければ null**（画面は黙って予測を出さない）。
function battleForecast() {
  if (!forecastVisible()) return null;
  let composed;
  try {
    composed = currentEncounter();
  } catch {
    return null;
  }
  const key = forecastKey(composed);
  if (forecastCache.key === key) return forecastCache.value;
  let value = null;
  try {
    value = previewNextBattle(
      state.run, state.profile, state.run.encounterIndex, expeditionBattleOptions(composed),
    );
  } catch {
    value = null;
  }
  forecastCache = { key, value };
  return value;
}

const FORECAST_RESULT_LABEL = { win: "勝利", loss: "敗北", draw: "決着つかず" };

function forecastMemberChip(entry) {
  const ceiling = Math.max(1, entry.maxHp || maxHp(entry.characterId) || 1);
  const ending = Math.max(0, Math.min(ceiling, entry.endingHp));
  const starting = Math.max(ending, Math.min(ceiling, entry.startingHp));
  const pct = (value) => Math.max(0, Math.min(100, Math.round((value / ceiling) * 1000) / 10));
  // 減少量が主役。**±0 と回復（＋）を別の色で出す**（装備を替えた効きが一目で分かる）。
  const lost = entry.hpLost;
  const deltaText = lost > 0 ? "−" + lost : lost < 0 ? "＋" + Math.abs(lost) : "±0";
  const deltaClass = entry.defeated ? "fatal" : lost > 0 ? "down" : lost < 0 ? "up" : "flat";
  // 5人ぶんが 390px 幅に横並びで収まる形にしてある。**減少量を先に、残るHPを次に。**
  // 「いくつ減るか」が装備を替えたときにいちばん動く数字である。
  return "<div class=\"forecast-member " + (entry.defeated ? "defeated" : "") + "\">"
    + "<div class=\"forecast-member-head\"><span class=\"avatar small\">"
    + esc(characterInfo(entry.characterId)?.icon ?? "・") + "</span><b>"
    + esc(characterName(entry.characterId)) + "</b></div>"
    + "<div class=\"forecast-hp-bar\" role=\"img\" aria-label=\"HP " + starting + " から " + ending
    + "（" + (entry.defeated ? "戦闘不能" : deltaText) + "）\">"
    + "<span class=\"forecast-hp-end\" style=\"width:" + pct(ending) + "%\"></span>"
    + "<span class=\"forecast-hp-loss\" style=\"width:" + pct(starting - ending) + "%\"></span></div>"
    + "<div class=\"forecast-delta " + deltaClass + "\">" + esc(entry.defeated ? "倒れる" : deltaText) + "</div>"
    + "<div class=\"forecast-hp-values\"><b>" + ending + "</b><small>/" + ceiling + "</small></div>"
    + "</div>";
}

// camp の上端に貼りつく帯。**予測が出せないときは何も描かない**
// （空の枠だけ残ると、予測が壊れているのか出ない場面なのか読めない）。
function forecastBar() {
  const forecast = battleForecast();
  if (!forecast) return "";
  const label = FORECAST_RESULT_LABEL[forecast.result] ?? forecast.result;
  const encounterName = currentEncounter()?.name;
  const target = state.prologueActive
    ? "灰の門"
    : "第" + state.run.encounterIndex + "戦" + (encounterName ? " · " + encounterName : "");
  return "<section class=\"forecast-bar " + esc(forecast.result) + "\" aria-live=\"polite\">"
    + "<div class=\"forecast-head\"><span class=\"forecast-title\">戦闘予測 · " + esc(target) + "</span>"
    + "<span class=\"forecast-verdict\">" + esc(label) + " · " + forecast.roundsUsed + "ラウンド</span></div>"
    + "<div class=\"forecast-members\">" + forecast.perCharacter.map(forecastMemberChip).join("") + "</div>"
    + "</section>";
}

// R14 §1 — 戦闘前の確認画面が持っていた EXACT PREVIEW カードは消した。
// **同じ数字を同じ画面で二度出さない。**上端の帯がそれを常時出している。

function actorName(id) {
  const actor = state.lastResult?.actors?.find((entry) => entry.instanceId === id);
  return String(actor?.displayName ?? nameFor(id)).split(" — ")[0];
}

function targetNames(ids) {
  return (ids || []).map((id) => actorName(id)).join("、");
}

function eventReasonText(reason) {
  const labels = {
    no_target: "有効な対象がいない",
    cost: "資源が足りない",
    rule: "反応で取り消し",
    no_usable_tactic: "使える行動がない",
    target_defeated: "対象が倒れた",
    target_unavailable: "対象がいない",
  };
  return reason ? "（" + (labels[reason] ?? reason) + "）" : "";
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
    action_skipped: source + "は行動しなかった" + eventReasonText(values.reason),
    action_canceled: source + "の" + skill + "を実行しなかった" + eventReasonText(values.reason),
    preparation_started: source + "が準備を始める",
    preparation_advanced: source + "の準備が進む",
    preparation_completed: source + "の準備が完了",
    preparation_interrupted: source + "の準備が止まった",
    // 受けで減ったぶんは、隠すと「なぜ通らないのか」が読めなくなる。
    damage_taken: arrow + target + " に " + number + " ダメージ"
      + (values.guardApplied > 0 ? "（受けで -" + values.guardApplied + "）" : ""),
    damage_absorbed: arrow + target + " が防壁で " + number + " 吸収"
      + (values.finalDamage === 0 ? "（最終ダメージ0）" : "（最終 " + (values.finalDamage ?? 0) + " ダメージ）"),
    damage_skipped: arrow + target + " へのダメージが不発" + eventReasonText(values.reason),
    barrier_damaged: target + "の防壁が" + number + "吸収",
    barrier_broken: target + "の防壁が壊れた",
    excess_damage: "攻撃が" + amountText + "余った",
    healing_applied: arrow + target + " を " + (values.actual ?? number) + " 回復",
    excess_healing: "回復が" + amountText + "余った",
    barrier_gained: target + " に防壁 " + number,
    // R6 §6.7 — block と guard。**何がどれだけ止めたのかを文字でも残す。**
    block_gained: target + " に受け構え " + number,
    block_spent: target + " の受け構えが1つ減った",
    damage_blocked: arrow + target + " の受け構えが " + (values.proposed ?? "") + " を止めた",
    block_proposed: arrow + target + " へ受け構え " + number + " を提案",
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
    equipment_worn: source + "の装備が耐久 " + values.before + "→" + values.after
      + "（消費" + (values.amount ?? 1) + "）"
      + (values.after === 0 ? " · 耐久切れ、以後は不発" : ""),
    equipment_broken: source + "の装備が壊れた · 以後は不発",
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
  return filterReplayEvents(events);
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
    if (!replayTypes.has(event?.type)) return;
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
// 「トキ に防壁1（トキ — 先を読む人）」は、箱の上に浮いている時点で分かっている。
function eventCauseName(event) {
  const id = event?.ruleId ? event.sourceDefinitionId : null;
  if (!id) return null;
  const known = SKILLS.reactive?.[id] || SKILLS.active?.[id] || componentInfo(id) || EQUIPMENT[id];
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
  return "<div class=\"unit\" data-unit=\"" + esc(actor.instanceId) + "\" data-max-hp=\"" + esc(String(actor.maxHp ?? 0)) + "\">"
    + "<div class=\"unit-floats\"></div>"
    + "<div class=\"unit-top\"><span class=\"unit-icon\">" + esc(unitIcon(actor))
    + "</span><b class=\"unit-name\">" + esc(shortName(actor.displayName))
    + "</b></div><div class=\"unit-bar\" role=\"img\" aria-label=\"HPと防壁\"><span class=\"unit-fill\"></span><span class=\"unit-barrier-fill\" aria-hidden=\"true\"></span></div>"
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
  const encounter = currentEncounter();
  return shell("", "", "<section class=\"card battle-card\">"
    + sectionHeading("BATTLE", "戦闘", "<span class=\"stage\">" + esc(encounter.name) + "</span>")
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
    + "<p class=\"hint battle-hint\">再生を止めて、一手ずつ確認できます。</p>"
    + helpDetails("battle-display", "表示の説明",
      "<p class=\"muted\">踏み込んだ箱が動いた側、揺れた箱が受けた側です。浮かぶ数字はダメージ・回復・防壁、箱の下の緑の帯はHP、上端の灰色の帯は防壁を示します。</p>"
      + "<p class=\"muted\">細かい出来事や診断情報は、戦闘履歴の技術ログで確認できます。</p>")
    // issue #176 — 盤面に出ている状態の意味を、その場で引けるようにする。
    + statusGlossaryHelp()
    + "<details class=\"card battle-history debug-log\"" + (state.replayLogOpen ? " open" : "")
    + "><summary>戦闘履歴</summary>"
    + "<p class=\"muted\">再生中の位置までの出来事を新しい順に表示します。</p>"
    + "<ol class=\"events replay-events\"></ol>"
    + "<details class=\"technical-log\"><summary>技術ログ</summary>"
    + diagnosticStamp()
    + "<p class=\"muted\">全イベントを診断用データとして表示します。</p>"
    + "<pre class=\"technical-events\"></pre></details></details>");
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
    } else if (
      event.type === "action_resolved"
      || event.type === "action_skipped"
      || event.type === "action_canceled"
    ) {
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
    case "damage_absorbed":
      return targets.map((id) => ({ actorId: id, text: "◈-" + (values.amount ?? 0), tone: tone("barrier"), cause }));
    case "damage_skipped":
      return targets.map((id) => ({ actorId: id, text: "不発", tone: "blocked", cause }));
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
  const list = app.querySelector(".battle-history .replay-events");
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
  const technical = app.querySelector(".technical-events");
  if (technical) technical.textContent = JSON.stringify(events.slice(0, upTo + 1), null, 2);
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

function barrierPercent(actor) {
  const maxHp = Number(actor.maxHp ?? 0);
  const barrier = Number(actor.barrier ?? 0);
  if (!Number.isFinite(maxHp) || maxHp <= 0 || !Number.isFinite(barrier) || barrier <= 0) return 0;
  return Math.min(100, (barrier / maxHp) * 100);
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
    const barrierFill = unit.querySelector(".unit-barrier-fill");
    if (barrierFill) barrierFill.style.width = barrierPercent(actor) + "%";
    const bar = unit.querySelector(".unit-bar");
    if (bar) {
      const barrier = Number(actor.barrier ?? 0);
      const safeBarrier = Number.isFinite(barrier) ? Math.max(0, barrier) : 0;
      bar.setAttribute("aria-label", "HP " + actor.hp + "/" + actor.maxHp + "、防壁 " + safeBarrier);
    }
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
    if (actingUnit && beatHasStrikeImpact(beat) && !options.silent) {
      restartAnimation(actingUnit, "is-striking");
    }
    if (beat.kind === "declare" || beat.kind === "impact") {
      for (const event of beat.events) {
        for (const id of event.targetActorIds || []) unitOf(id)?.classList.add("is-aimed");
      }
    }
    if (!options.silent) {
      const animated = new Set();
      const restartOnce = (id, unit, className) => {
        const key = id + ":" + className;
        if (animated.has(key)) return;
        animated.add(key);
        restartAnimation(unit, className);
      };
      let offset = 0;
      for (const event of beat.events) {
        for (const id of event.targetActorIds || []) {
          const unit = unitOf(id);
          if (!unit) continue;
          if (event.type === "damage_taken" || event.type === "damage_absorbed" || event.type === "actor_defeated") restartOnce(id, unit, "is-hit");
          else if (event.type === "healing_applied") restartOnce(id, unit, "is-healed");
          else if (event.type === "barrier_gained") restartOnce(id, unit, "is-shielded");
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
// **同じことを二度言わない。** 「ゴウの斬撃が始まる ＋ ゴウ → 敵に5ダメージ」は
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
  const encounter = currentEncounter();
  return shell("", "", "<section class=\"card verdict loss\">"
    + sectionHeading("BATTLE ERROR", "戦闘を停止しました", "<span class=\"stage\">" + esc(encounter.name) + "</span>")
    + "<div class=\"verdict-mark\">!</div><p><b>安全弁が働きました。</b> この構成の戦闘イベントが上限を超えたため、途中結果を破棄しました。原因を確認できるよう、直前のイベントを残しています。</p>"
    + "<p class=\"error battle-error-message\">" + esc(failure.message || "battle runtime error") + "</p>"
    + "<div class=\"metrics\"><span><b>" + (diagnostics.eventSequence ?? "—") + "</b><small>イベント番号</small></span><span><b>"
    + esc(actorLabels[diagnostics.currentActorId] ?? diagnostics.currentActorId ?? "—") + "</b><small>実行中</small></span><span><b>"
    + esc(diagnostics.chainId ?? "—") + "</b><small>チェーン</small></span><span><b>" + recent.length + "</b><small>直前ログ</small></span></div></section>"
    + "<section class=\"card\">" + sectionHeading("DIAGNOSTICS", "直前のイベント")
    + "<p class=\"muted\">技能や反応の組み合わせで、同じイベントが繰り返されていないか確認できます。</p><ol class=\"events diagnostic-events\">"
    + recent.map((event) => "<li class=\"event\"><span class=\"event-round\">R" + (event.round ?? "-") + "</span><span>"
      + esc(diagnosticEventText(event, actorLabels)) + "</span></li>").join("") + "</ol>"
    + (stack.length ? "<details><summary>発火中の反応</summary><pre>" + esc(JSON.stringify(stack, null, 2)) + "</pre></details>" : "")
    + "<details><summary>エンジン診断データ</summary><pre>" + esc(JSON.stringify(diagnostics, null, 2)) + "</pre></details></section>"
    + "<section class=\"card quiet\"><p class=\"muted\">通常のプレイでこの画面が出る場合は、直前に装着した0コスト行動や、準備・行動権を互いに増やす反応をオフにして再試行してください。</p>"
    + "<div class=\"flow-actions\">" + button("スキルを見直す", "retry-build", false, "button primary")
    + button("キャンプへ戻る", "back-battle-preview", false, "button") + "</div></section>");
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
  const encounter = currentEncounter();
  const metrics = result.metrics || {};
  const events = compactEvents(result.events || state.replayEvents);
  const shown = events.length > 40 ? [...events.slice(0, 30), ...events.slice(-10)] : events;
  const prologueUnresolved = state.prologueActive && !(state.prologueStage === "retry" && won);
  ensureResultReward(won, prologueUnresolved);
  const next = prologueUnresolved
    ? state.prologueStage === "retry"
      ? button("編成を見直す", "back-camp", false, "button primary")
      : button("時間が巻き戻る", "rewind-prologue", false, "button primary")
    : won
      ? state.run.encounterIndex >= ENCOUNTERS_PER_RUN
        ? button("遠征を精算する", "settle-run", false, "button primary")
        : rewardSectionHtml()
      : button("この先どうするか", "show-defeat", false, "button primary");
  const nextBlock = "<div class=\"primary-action result-primary-action\" data-primary-action=\"result-next\">"
    + "<p class=\"primary-action-label\">次の操作</p>" + next + "</div>";
  const equipment = (result.equipment || []).map((item) => "<div class=\"result-gear\"><b>"
    + esc(gear(item.equipmentId)?.label ?? item.equipmentId) + "</b><span>"
    + "戦闘内 " + item.durability + " / " + item.maxDurability + " → 次戦 "
    + item.maxDurability + " / " + item.maxDurability + "</span></div>").join("");
  // issue #168 — 表示する量も progression の表から引く（画面に書いた数と、
  // 実際に配った数がずれないようにする）。
  const skillGain = !prologueUnresolved && won
    ? "<p class=\"operation-note\">編成中の全員に技能点 +"
      + skillPointsForClear(currentEncounter().kind) + "。報酬は下で1つ選びます。</p>"
    : "";
  const carryText = prologueUnresolved
    ? "<p class=\"muted\"><b>この一戦は遠征に数えません。</b>活動資金と持ち越しHPは動きません。</p>"
    : "<p class=\"muted\">獲得予定の活動資金: <b>" + formatFunds(state.run.fundLedger.provisionalTotal)
      + "</b>（到達 " + state.run.fundLedger.highestClearedEncounter + " / " + ENCOUNTERS_PER_RUN
      + "）。負けても、ここまで確定した分は持ち帰ります。</p>";
  const status = "<section class=\"card verdict " + (won ? "win" : "loss") + "\"><div class=\"verdict-mark\">"
    + (won ? "✓" : "×") + "</div><h2>" + (won ? "突破した" : "足を止めた")
    + "</h2><p class=\"verdict-context\">" + esc(encounter.name) + " · " + result.roundsUsed + "ラウンド</p><p>"
    + (won ? "この組み合わせは通りました。" : "この組み合わせでは届きませんでした。")
    + "</p><div class=\"metrics\"><span><b>" + (metrics.allyHpLost ?? 0) + "</b><small>味方HP損失</small></span><span><b>"
    + (metrics.enemyHpLost ?? 0) + "</b><small>敵HP損失</small></span><span><b>" + (metrics.reactionsFired ?? 0)
    + "</b><small>反応発火</small></span><span><b>" + (metrics.equipmentWear ?? 0) + "</b><small>装備摩耗</small></span></div>"
    + skillGain + "</section>";
  const stateCard = "<section class=\"card\">" + sectionHeading("AFTER BATTLE", "戦闘後の状態")
    + carryText + "<div class=\"result-actors\">" + resultActors(result) + "</div>"
    + "<div class=\"result-gear-list\">" + (equipment || "<p class=\"muted\">装備なし</p>")
    + "</div></section>";
  const replay = state.replayEvents?.length
    ? "<section class=\"card\">" + sectionHeading("REPLAY", "戦闘をもう一度見る")
      + "<p class=\"operation-note\">同じ戦闘を同じ順で再生します。</p>"
      + button("戦闘をもう一度見る", "replay-again", false, "button") + "</section>"
    : "";
  const history = "<details class=\"card battle-history debug-log\"" + (state.replayLogOpen ? " open" : "")
    + "><summary>戦闘履歴</summary>"
    + "<p class=\"muted\">アニメーションで分かりにくかった出来事を確認できます。</p>"
    + "<ol class=\"events\">" + shown.map((event) => "<li class=\"event\"><span class=\"event-round\">R"
      + (event.round ?? "-") + "</span><span>" + esc(eventText(event)) + "</span>"
      + "<code class=\"event-type\">" + esc(event.type) + "</code></li>").join("") + "</ol>"
    + "<details class=\"technical-log\"><summary>技術ログ</summary>"
    + diagnosticStamp()
    + "<p class=\"muted\">全イベントを診断用データとして表示します。</p>"
    + "<pre>" + esc(JSON.stringify(result.events || state.replayEvents || [], null, 2)) + "</pre></details></details>";
  return shell("", "", status + nextBlock + stateCard + replay + history);
}


// R15 — 通常戦勝利時に技能点は全員へ自動付与する。報酬は3候補から1つ。
// **活動資金はこの3候補に入らない。**
// ---------------------------------------------------------------- 世界の声（R12 §4.B の続き）
//
// R12 は敵カード・設計図・精算の三か所へ世界の声を載せた。残っていたのが
// **報酬・野営・敗北**である。どれもプレイヤーが必ず止まる画面なのに、全文が
// システム文だった（R12 §3「増やすべきは会話量ではなく、会話以外の器である」）。
//
// **会話ではない。**誰かの台詞にすると R9 §7 の断片の勘定に入ってしまうので、
// 地の文——詰所の言い方、拾い屋の言い習わし——として置く。
// **決定性を守る。**戦闘数や結果から引くので、同じ状況では同じ一行が出る。

const REWARD_VOICES = Object.freeze([
  "持てるだけ持って帰るのが拾い屋ではない。持って帰れるものを選ぶのが拾い屋である。",
  "詰所の買取は品を見ない。重さと等級しか見ない。選ぶ意味は、こちら側にしかない。",
  "拾わなかったものは灰へ戻る。戻ったものが次にどこへ出るかは、誰も知らない。",
  "同じ幕で二度同じ品を見た者はいる。持ち帰れた者はいない。",
]);

function rewardVoice() {
  return REWARD_VOICES[(state.run.encounterIndex - 1 + REWARD_VOICES.length) % REWARD_VOICES.length];
}

const DEFEAT_VOICES = Object.freeze([
  "退がるのに理由は要らない。進むほうに理由が要る。",
  "台帳の「未達」の欄は、達しなかったことだけを書く。何があったかは書かない。",
  "補給を残して戻った隊は、たいてい次も戻ってくる。",
]);

function defeatVoice() {
  return DEFEAT_VOICES[(state.run.fundLedger.highestClearedEncounter + DEFEAT_VOICES.length)
    % DEFEAT_VOICES.length];
}

// R8 §3.1 —「愛着の主語は人物、偶然性の主語は装備」。R12 §3 は、装備が
// rule 文しか持たないので偶然性が物語になっていないと書いた。設計図には由来を
// 付けたので、**拾った瞬間のほうにも一行を置く。**
//
// **品そのものから決まる**（affix の本数と耐久）ので、同じ品なら同じ一行が出る。
// 効果の言い換えは書かない（それは readout の仕事で、二重に書くとずれる）。
const GENERATED_VOICES = Object.freeze({
  common: [
    "外の工房でも作れそうな形をしている。灰の中に落ちていたことだけが説明できない。",
    "使い込まれている。前に持っていた者の握りの癖が、まだ残っている。",
  ],
  rare: [
    "継ぎ目が見当たらない。一枚から起こしたにしては、厚みが均一すぎる。",
    "灰を払うと下から別の色が出た。塗ったのではなく、そういう地らしい。",
  ],
  epic: [
    "詰所の買取に出すと、等級の欄で手が止まる。様式に無い形をしている。",
    "同じものを見たという報告が二件ある。どちらも別の幕の、別の隊からである。",
  ],
  legendary: [
    "台帳に載せる欄が無い。載せない、と決めた者がいたのかもしれない。",
    "手に持っているあいだ、灰の音が少しだけ遠い。気のせいだと全員が言う。",
  ],
  mythic: [
    "古い記録のどれにも一致しない。見つけたことだけが、記録に残っている。",
    "灯りを近づけると、装備のほうが先にこちらを見ている気がした。",
  ],
  oopart: [
    "拾ったのではない。灰が一度だけ、これをこちらへ返した。",
    "使い方を知っている者が、もういない。それでも手は迷わなかった。",
  ],
});

function generatedVoice(item) {
  const lines = GENERATED_VOICES[item?.rarity] ?? [];
  if (!lines.length) return "";
  const affixes = (item.provenance?.affixIds ?? []).length;
  const durability = item.definition?.maxDurability ?? 0;
  return lines[(affixes + durability) % lines.length];
}

// issue #138 — 通常戦の勝利で結果画面に来た時点で、報酬3候補を一度だけ用意する。
// すでに用意済み（引き直し済みも含む）なら上書きしない。
function ensureResultReward(won, prologueUnresolved) {
  if (!won || prologueUnresolved || state.run.encounterIndex >= ENCOUNTERS_PER_RUN) return;
  if (state.rewardOffer.length) return;
  const rerolls = state.run.rerollsUsed?.[state.run.encounterIndex] ?? 0;
  state.rewardOffer = rewardOffer(state.run, state.profile, state.run.encounterIndex, rerolls);
  record("reward_presented", { encounter: state.run.encounterIndex, offer: clone(state.rewardOffer) });
}

// issue #138 — 結果画面に埋め込む報酬選択。以前は「報酬を見る」で別画面へ渡していた。
function rewardSectionHtml() {
  const full = state.run.inventory.length >= INVENTORY_LIMIT;
  const cards = state.rewardOffer.map((offer, index) => {
    if (offer.type === "equipment") {
      // R8 §13.2 — 装備は**最初から全 rule を読める**。目利きは等級の引きを
      // 良くするもので、読める量を売る仕組みにはしない（R8 §11 の完全開示）。
      const item = offer.item ?? null;
      const info = item
        ? { label: item.definition.displayName, effect: "", grammar: "装備レアリティ · " + (RARITY_LABEL[item.rarity] ?? item.rarity), maxDurability: item.definition.maxDurability }
        : EQUIPMENT[offer.equipmentId];
      const body = item
        ? equipmentRarityCallout(item)
          + equipmentReadoutHtml(item, { compact: false })
          // R8 §3.1 — 偶然性の主語は装備。**拾った品が、拾われ方について一行だけ言う。**
          + (generatedVoice(item) ? "<p class=\"item-voice\">" + esc(generatedVoice(item)) + "</p>" : "")
        : "<p>" + esc(info?.effect ?? "") + "</p>";
      return "<article class=\"reward-card equipment-reward"
        + (item?.rarity ? " rarity-card-" + esc(item.rarity) : "") + "\"><div class=\"reward-kind kind-equipment\">装備</div><h3>"
        + esc(info?.label ?? offer.equipmentId) + rarityChip(item?.rarity) + "</h3>" + body + "<small>"
        + esc(info?.grammar ?? "") + " · 戦闘耐久 " + (info?.maxDurability ?? 1) + "</small>"
        + (full ? "<p class=\"muted\">持ち物が" + INVENTORY_LIMIT + "品で一杯です。装備画面で一品を分解してください。</p>" : "")
        + button("拾って次へ", "take-reward", full, "button", "data-offer=\"" + index + "\"") + "</article>";
    }
    // R8 §3.5 — 生成に失敗したら既定品へ黙って落とさず、診断をそのまま出す。
    if (offer.type === "generator_error") {
      return "<article class=\"reward-card\"><div class=\"reward-kind kind-equipment\">候補なし</div>"
        + "<h3>装備の候補が作れませんでした</h3><p>" + esc(offer.message) + "</p>"
        + "<small>この候補は選べません。ほかの候補を選ぶか、補給1で引き直してください。</small></article>";
    }
    return "<article class=\"reward-card special\"><div class=\"reward-kind kind-passive\">補給</div><h3>補給 +"
      + offer.amount + "</h3><p>再挑戦・報酬の引き直し・野営治療に使う。上限 " + MAX_SUPPLIES + "。現在 "
      + state.run.supplies + "。</p>"
      + button("補給を受け取る", "take-reward", state.run.supplies >= MAX_SUPPLIES, "button",
        "data-offer=\"" + index + "\"") + "</article>";
  }).join("");
  const rerolls = state.run.rerollsUsed?.[state.run.encounterIndex] ?? 0;
  return "<section class=\"card\">"
    + sectionHeading("REWARD / 3 → 1", "何を持ち帰る？", "<span class=\"stage\">補給 " + state.run.supplies + "</span>")
    + "<p class=\"muted\">3候補から1つだけ選びます。<b>活動資金はこの選択に含まれません</b>。戦闘勝利時の技能点は編成中の全員へ自動で加わります。</p>"
    + (state.rewardOffer.filter((offer) => offer.type === "equipment").length < 2
      ? "<p class=\"muted\">装備の候補が減っています。用意できない場合は理由が候補欄に出ます。</p>"
      : "")
    + (appraisalLevel(state.profile) > 0
      ? "<p class=\"muted\">目利き Lv" + appraisalLevel(state.profile)
        + "：装備の等級を " + (appraisalLevel(state.profile) + 1) + " 回引いて良い方を採っています。</p>"
      : "")
    + "<p class=\"world-voice\">" + esc(rewardVoice()) + "</p>"
    + "<div class=\"reward-grid\">" + cards + "</div>"
    + "<div class=\"reward-reroll\">"
    + button("補給1で3候補を引き直す", "reroll-reward", state.run.supplies < 1 || rerolls >= 1, "button")
    + "<small>" + (rerolls >= 1 ? "この戦闘ではもう引き直せません。" : "引き直しは1戦闘につき一度だけ。使うと再挑戦の余地が減ります。")
    + "</small></div></section>";
}

// R6 §12.2 — 敗北処理。**即座に破棄しない。**
function renderDefeat() {
  const canRetry = state.run.supplies >= 1;
  const encounter = currentEncounter();
  const actionCard = "<section class=\"card primary-action defeat-primary-action\" data-primary-action=\"defeat-next\">"
    + sectionHeading("NEXT", "次の手", "<span class=\"stage\">補給 " + state.run.supplies + "</span>")
    + "<p class=\"primary-action-label\">補給の使い道を選びます</p>"
    + suppliesBar(canRetry ? "再挑戦に1つ使う" : "補給が尽きた")
    + (canRetry
      ? button("補給1で編成を変えて再挑戦", "retry-encounter", false, "button primary")
      : "<p class=\"muted\">補給が0なので、この遠征はここで終わります。</p>")
    + button("遠征を終えて精算する", "settle-run", false, canRetry ? "button" : "button primary")
    + "</section>";
  return shell("", "", "<section class=\"card verdict loss\">"
    + "<div class=\"verdict-mark\">×</div><h2>足を止めた</h2>"
    + "<p class=\"verdict-context\">" + esc(encounter.name) + " · 補給 " + state.run.supplies + "</p>"
    + "<p><b>この組み合わせでは届かなかった。</b> 補給1で編成・位置・技能・装備を変えて、同じ戦闘へ再挑戦できます。</p>"
    + "<p class=\"world-voice\">" + esc(defeatVoice()) + "</p></section>"
    + actionCard
    + "<section class=\"card\">" + sectionHeading("CARRY HOME", "ここまでで確定した活動資金")
    + "<p class=\"muted\">撃破した戦闘と到達距離は、負けても持ち帰ります。</p>"
    + "<p class=\"fund-line\"><b>" + formatFunds(state.run.fundLedger.provisionalTotal) + "</b>"
    + "<small>撃破 " + state.run.fundLedger.clearedEncounterBase + " · 到達 "
    + state.run.fundLedger.highestClearedEncounter + " 戦 · 倍率 ×"
    + (state.run.fundLedger.difficultyMultiplierBps / 10000).toFixed(1) + "</small></p></section>");
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
      ? "<p class=\"muted\">この遠征で見つけた装備 " + found + " 品のうち、等級の高い "
        + saved.length + " 品だけを残しました。</p>"
      : "")
    + "<p class=\"muted\">設計図はギルドの設計図画面から、次の遠征へ持ち込めます"
    + "（持込枠 " + blueprintCarryCapacity(state.profile) + "）。</p></section>";
}

// issue #212 — Stage 終了会話も通常の一行送りへ通す。
// 精算内にまとめた読み返しカードは置かず、初回クリア時だけ settle-run から
// enterStory() へ入り、読み終えたら保存済みの精算画面へ戻る。

// R12 §4.B — 精算の締めの一行。
//
// **「撤退は敗北ではなく判断である」**（R11 §2.2）は世界観の中心なのに、
// これまで画面のどこにも書かれていなかった。結果分類と到達戦数は既に持っているので、
// 数字の下へ拾い屋の側の言い方を一行だけ置く。**慰めない。**評価もしない。
function settlementClosingLine(settlement) {
  const reached = state.run.fundLedger.highestClearedEncounter;
  if (settlement.outcome === "won") {
    return "十二戦を抜けた。器材を詰所へ返し、それから根城へ帰る。";
  }
  if (settlement.outcome === "retreat") {
    return reached > 0
      ? "第" + reached + "戦まで進んで、戻ると決めた。拾い屋の撤退は敗北ではない。危なければ戻り、戻ってまた入る。"
      : "入ってすぐ引き返した。台帳にはそう書く。それだけのことだ。";
  }
  return reached > 0
    ? "第" + reached + "戦で灰に押し返された。確定した分は持ち帰る。器材は返し、傷は数えて帳面に載せる。"
    : "灰の入口で押し返された。持ち帰るものは無い。それでも器材は返しに行く。";
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
    ["この区画の初回クリア", b.firstClearBonus],
  ].map(([label, value]) => "<div class=\"settle-row\"><span>" + esc(label) + "</span><b>" + value + "</b></div>").join("");
  const title = won ? "遠征を終えた" : retreated ? "安全に撤退した" : "遠征は途中で終わった";
  const nextAction = "<section class=\"card primary-action settlement-primary-action\" data-primary-action=\"settlement-next\">"
    + sectionHeading("NEXT", "次の行き先")
    + "<p class=\"primary-action-label\">精算を確認したら、帰る先を選びます。</p>"
    + button("根城へ帰る", "go-homestead", false, "button primary")
    + button("ギルドへ戻る", "back-guild", false, "button")
    + button("記録を送る", "complete", false, "button")
    + "</section>";
  return shell("", "",
    "<section class=\"card verdict " + (won ? "win" : "loss") + "\"><div class=\"verdict-mark\">"
    + (won ? "✦" : retreated ? "◇" : "◆") + "</div><h2>" + esc(title) + "</h2>"
    + "<p class=\"verdict-context\">" + esc(CAMPAIGN_STAGES[state.run.campaignStageSequence]?.displayName ?? "遠征")
    + " · " + state.run.fundLedger.highestClearedEncounter + " / " + ENCOUNTERS_PER_RUN + " 戦</p>"
    + "<p>活動資金 " + formatFunds(settlement.earned) + " を持ち帰った。残高 "
    + formatFunds(settlement.balanceBefore) + " → <b>" + formatFunds(settlement.balanceAfter) + "</b></p>"
    + "<p class=\"settle-closing\">" + esc(settlementClosingLine(settlement)) + "</p></section>"
    + nextAction
    + "<section class=\"card\">" + sectionHeading("SETTLEMENT", "内訳")
    + "<div class=\"settle-list\">" + rows + "</div>"
    + "<div class=\"settle-row total\"><span>報酬倍率</span><b>×"
    + (b.difficultyMultiplierBps / 10000).toFixed(1) + "</b></div>"
    + "<div class=\"settle-row total\"><span>合計</span><b>" + formatFunds(settlement.earned) + "</b></div>"
    + "<p class=\"muted\">遠征内の技能点・解禁・装備・補給はここで消えます（R6 §5.3）。持ち帰るのは"
    + "活動資金と、下の設計図だけです。今回の結果分類（"
    + esc(won ? "勝利" : retreated ? "安全撤退" : "敗北") + "）では最大" + settlement.blueprintSaveLimit
    + "件を残せます。</p></section>"
    + blueprintSettlementSection(settlement)
    + (settlement.unlockedCampaignStage !== null && settlement.unlockedCampaignStage !== undefined
      ? "<section class=\"card\"><p class=\"eyebrow\">CAMPAIGN STAGE</p><h3>"
        + esc(CAMPAIGN_STAGES[settlement.unlockedCampaignStage]?.displayName ?? ("区画 " + settlement.unlockedCampaignStage))
        + " が開いた</h3></section>"
      : "")
    );
}

function renderComplete() {
  const feedback = state.feedback || {};
  const option = (value, label, selected) => "<option value=\"" + value + "\" " + (selected ? "selected" : "") + ">" + label + "</option>";
  const trail = state.run.roster.map(characterName).join("、");
  const carried = state.run.inventory.map((id) => gear(id)?.label ?? id).join("、");
  const reached = state.run.fundLedger.highestClearedEncounter;
  const settlement = state.lastSettlement;
  return shell("", "", "<section class=\"card verdict win\"><div class=\"verdict-mark\">✦</div><h2>遠征を終えた</h2><p class=\"verdict-context\">"
    + reached + " / " + ENCOUNTERS_PER_RUN + " 戦を見届けた</p><p>今回の仲間: "
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

// R11 §5 / R12 — 序盤の一戦の、再生後に入る会話。**判定はここ一箇所にしかない。**
// 再生が流れきった場合と、［結果を見る］で打ち切った場合の両方から呼ぶ。
function enterPrologueBeatIfDue() {
  if (!state.prologueActive) return false;
  if (state.prologueStage === "first") {
    enterStory([storyBeat("stage_0", "prologueDefeat")], "prologueResult");
    return true;
  }
  if (state.prologueStage === "retry" && state.lastResult?.result === "win") {
    enterStory([storyBeat("stage_0", "prologueWin")], "prologueClear");
    return true;
  }
  return false;
}

// issue #138 — 再生を最後まで見終わったら、追加の「結果を見る」なしで
// 結果画面へ進める。序盤の一戦なら会話が先に入る（enterPrologueBeatIfDue）。
function goToBattleResult() {
  state.replayPlaying = false;
  if (enterPrologueBeatIfDue()) return;
  state.phase = "result";
  saveState();
  render();
}

function scheduleReplayBeat() {
  stopReplayTimer();
  if (state.phase !== "battle") return;
  const beats = replayBeats();
  const index = clampReplayIndex();
  if (index >= beats.length - 1) {
    state.replayPlaying = false;
    // R11 §5 — 序盤の一戦だけは、再生の終わりがそのまま会話の始まりになる。
    if (enterPrologueBeatIfDue()) return;
    saveState();
    updateReplayControls(index, beats);
    // issue #138 — 最後の拍を見せたあと、少し間を置いて結果画面へ自動で進む。
    // 自動再生が最後まで流れきったときだけでなく、一手ずつ進めて末尾に
    // 着いたときも同じに扱う（「結果を見る」を押さなくても戦闘画面で止まり続けない）。
    replayTimer = setTimeout(() => {
      replayTimer = null;
      if (state.phase !== "battle") return;
      goToBattleResult();
    }, beatDurationMs(beats[index], replaySpeed().factor));
    return;
  }
  if (!state.replayPlaying) return;
  replayTimer = setTimeout(() => {
    replayTimer = null;
    if (state.phase !== "battle" || !state.replayPlaying) return;
    state.replayIndex = clampReplayIndex() + 1;
    saveStateSoon();
    syncBattleView();
  }, beatDurationMs(beats[index], replaySpeed().factor));
}

// R8 §11 の simulateNextBattle と同じ BattleInput 構成経路を通る本番実行。
// issue #138 — チュートリアルも含め、「この敵に挑む」から戦闘前確認を挟まず
// 常にここへ入る（以前は「自動戦闘を再生する」ボタンの handler だった）。
function simulateAndEnterBattle() {
  let battle;
  try {
    const composed = currentEncounter();
    const simulation = simulateExpeditionBattle(
      state.run,
      state.profile,
      state.run.encounterIndex,
      {
        // **予測と同じ options をそのまま使う。**足してよいのは再生用の
        // snapshot 収集だけで、これは出来事の列も結果も変えない。
        ...expeditionBattleOptions(composed),
        simulationOptions: { captureReplaySnapshots: true },
      },
    );
    battle = simulation.battleInput;
    record("battle_started", {
      encounter: state.run.encounterIndex,
      kind: composed.kind,
      difficulty: state.run.difficulty,
      threat: composed.spentThreat,
      battleId: battle.battleId,
    });
    const result = simulation.result;
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
    // R11 §5 改 — 巻き戻したあとの一戦は、本編1戦目（encounterIndex 1）そのものと
    // して扱う。**この関数に来る時点で prologueActive が真なら、それは必ず
    // retry（本当に負ける一戦目は startPrologue() がここを通らず直接 simulate する）**
    // なので、通常戦と同じく勝利時に技能点を配る。
    if (result.result === "win") {
      state.run = recordEncounterCleared(state.run, state.run.encounterIndex);
      // issue #168 — 配る量と冪等の鍵は progression 側の一箇所で決まる。
      // **同じ encounter を二度勝っても二度は配らない**（活動資金と同じ鍵）。
      const grant = grantRunSkillPointsForClear(state.run, state.run.encounterIndex);
      state.run = grant.run;
      if (grant.granted) {
        record("battle_skill_points_granted", {
          stage: state.run.encounterIndex,
          amount: grant.amount,
          characterIds: [...state.run.roster],
        });
      }
    }
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
    // R8 §3.2 の図鑑。**会ったことは Profile に残る。**遠征を捨てても、
    // 序盤の一戦でも残す（会ったという事実は、勝敗で取り消されない）。
    state.profile = recordBestiary(
      state.profile,
      (composed.enemies ?? []).map((enemy) => enemy.enemyActorId),
      { defeated: result.result === "win" },
    );
    // R8 §8, §10 — Campaign Stage: 勝利時だけHPをcommitする（敗北時はrunを
    // 変更しない=retry safe）。4/8戦目boss勝利後はcommitBattleResultが全回復する。
    // R11 §5 改 — 巻き戻したあとの一戦もこの経路で HP を commit する。
    // もう「遠征に数えない」演習ではない。
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
}

function advanceAfterReward() {
  // R11 §5 改 — 巻き戻したあとの勝利（本編1戦目）は、報酬を受け取ってここへ来た
  // 時点で本当に序盤の演出を終える。prologueClear では落とさなかった
  // prologueActive / prologueStage をここで落とす（結果・報酬画面の名称表示は
  // もう済んでいるので、次戦以降の currentEncounter() は通常のladderへ戻る）。
  if (state.prologueActive) {
    state.prologueActive = false;
    state.prologueStage = null;
  }
  const completedEncounter = state.run.encounterIndex;
  const showSupplyTutorial = shouldShowSupplyTutorialAfterReward();
  state.run.encounterIndex += 1;
  state.rewardOffer = [];
  state.lastResult = null;
  state.replayEvents = [];
  state.replaySnapshots = [];
  state.replayIndex = 0;
  state.replayPlaying = false;
  state.phase = "camp";
  state.tab = showSupplyTutorial ? "supplies" : "map";
  state.treatmentSelection = null;
  state.treatmentResult = null;
  state.treatTargets = [];
  state.error = null;
  state.run.act = actOfIndex(state.run.encounterIndex);
  record("stage_advanced", { encounter: state.run.encounterIndex, act: state.run.act });
  if (showSupplyTutorial) {
    record("supply_tutorial_presented", { encounter: completedEncounter });
  }
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
    const run = startRun(profile, { campaignStageSequence: 0, tutorial: true });
    state = {
      ...freshUiState(),
      profile,
      run,
      phase: "story",
      selectedCampaignStageSequence: 0,
      runId: run.runId,
      startedAt: run.startedAt,
      // #209 — remember which New Game run owns the mandatory first-use
      // walkthrough. A normal/revisit run must not inherit that gate.
      supplyTutorialRunId: run.runId,
      formationSelection: run.roster[0] ?? null,
    };
    record("run_started", {
      runId: state.run.runId,
      seed: state.run.runSeed,
      version: GAME_VERSION,
      difficulty: state.run.difficulty,
      packs: [...state.run.manifest.enabledPackIds],
      supplies: state.run.supplies,
      roster: [...state.run.roster],
    });
    enterStory([storyBeat("stage_0", "opening")], "prologue");
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
    // R11 §5 改 — チュートリアル中はタイトルへ戻れない（画面上のボタンは既に
    // 隠しているが、経路として二重に塞ぐ）。
    if (state.prologueActive || supplyTutorialVisible()) return;
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
    // **Stage は state を差し替える前に決める。**あとで決めると、
    // clamp は新しい state（常に0）を読み、run は前の選択で作られて、
    // 画面が「Stage 0」と言いながら別の Stage を走らせる。
    const campaignStages = availableCampaignStages(profile);
    const campaignStage = campaignStages[campaignStages.length - 1];
    const guildCharacterId = state.guildCharacter;
    state = {
      ...freshUiState(),
      profile,
      run: startRun(profile, { campaignStageSequence: campaignStage }),
    };
    state.phase = "expeditionStart";
    state.selectedCampaignStageSequence = campaignStage;
    state.guildCharacter = guildCharacterId;
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

  // ---- 根城（R11 §2.4 / §9.4）
  //
  // 精算の次はここ。**新しい場面があれば先に会話へ入り、無ければ家の画面へ出る。**
  if (action === "go-homestead") {
    const scene = pendingHomesteadScene();
    if (scene) {
      // **既読印は入った時点で押す。**途中で閉じても、同じ夜を二度は出さない
      // （読み返しは根城の画面から自由にできる）。
      state.profile = {
        ...state.profile,
        storyFlags: [...new Set([...(state.profile.storyFlags ?? []), homesteadFlag(scene.id)])],
      };
      record("homestead_scene", { scene: scene.id });
      enterStory([scene.beat], "homestead");
      return;
    }
    state.phase = "homestead";
    saveState();
    render();
    return;
  }

  if (action === "enter-homestead-scene") {
    const scene = pendingHomesteadScene();
    if (!scene) return;
    state.profile = {
      ...state.profile,
      storyFlags: [...new Set([...(state.profile.storyFlags ?? []), homesteadFlag(scene.id)])],
    };
    record("homestead_scene", { scene: scene.id });
    enterStory([scene.beat], homesteadReturnPhase());
    return;
  }

  // 一度見た場面の読み返し。**既読印は動かさない。**
  if (action === "replay-homestead") {
    const scene = homesteadScene(element.dataset.scene);
    if (!scene || !seenHomesteadIds(state.profile.storyFlags).includes(scene.id)) return;
    enterStory([scene.beat], homesteadReturnPhase());
    return;
  }

  if (action === "guild-tab") {
    state.guildTab = ["guild", "blueprints", "homestead", "codex"].includes(element.dataset.tab)
      ? element.dataset.tab
      : "expedition";
    saveState();
    render();
    return;
  }

  if (action === "select-guild-character") {
    const id = element.dataset.character;
    if (!metCharacterOptions().some((option) => option.id === id)) return;
    state.guildCharacter = id;
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
      version: GAME_VERSION,
      difficulty: state.run.difficulty,
      packs: [...state.run.manifest.enabledPackIds],
      supplies: state.run.supplies,
      roster: [...state.run.roster],
    });
    // Campaign Stageの開始時（再訪を含む）に、物語の断片を挟む。
    // Stage 0の序盤の敗北・巻き戻しだけは、専用チュートリアルとして初回に限る。
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

  // 舞台を叩いた。**文字送りの途中なら、まず全文を出す。**
  // 読み終えている行でだけ、次の行へ進む。
  if (action === "story-advance") {
    if (state.story?.logOpen) return;
    if (!storyTypingDone) {
      stopStoryTimers();
      const target = app.querySelector(".vn-text");
      if (target) {
        target.textContent = target.dataset.full ?? "";
        storyTypingDone = true;
        storyShownLine = (currentStoryBeat()?.id ?? "") + ":" + storyLineIndex();
        app.querySelector(".vn")?.classList.add("typed");
        if (state.story?.auto) {
          storyAutoTimer = setTimeout(() => { advanceStoryLine(); }, STORY_AUTO_HOLD_MS);
        }
      }
      return;
    }
    advanceStoryLine();
    return;
  }

  if (action === "story-auto") {
    state.story = { ...state.story, auto: !(state.story?.auto === true) };
    saveState();
    render();
    return;
  }

  if (action === "story-log") {
    state.story = { ...state.story, logOpen: !(state.story?.logOpen === true) };
    render();
    return;
  }

  if (action === "story-skip") {
    record("story_skipped", { after: state.story?.after ?? "camp" });
    state.story = { ...state.story, queue: [], after: state.story?.after ?? "camp", logOpen: false };
    finishStory();
    return;
  }

  // R9 §2.1 — 巻き戻し。**序盤の敗北は遠征の結果に数えない。**
  // 活動資金も持ち越しHPも動かさず、同じ Stage の第1戦から本編を始める。
  if (action === "rewind-prologue") {
    // R11 §5 — **巻き戻しても prologueActive は落とさない。**同じ門の盤面を、
    // 今度はプレイヤーの配置で戦い直す。ここで本編1戦目へ飛ばすと、
    // 「編成を変え、予測どおりに勝利する」（R9 §2.1）が別の盤面の話になる。
    state.prologueStage = "retry";
    // R15 — 負けた配置をそのまま引き継ぐ。defaultFormation へ戻すと、
    // 何も変えずに勝ててしまい「一手直して勝つ」導入が成立しない。
    state.run.formation = normalizeFormation(PROLOGUE.formation, state.run.roster);
    state.lastResult = null;
    state.replayEvents = [];
    state.replaySnapshots = [];
    state.replayIndex = 0;
    state.replayPlaying = false;
    record("prologue_rewound", { stage: state.run.campaignStageSequence });
    enterStory([storyBeat("stage_0", "prologueRewound")], "camp");
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
    const nextTab = element.dataset.tab || state.tab;
    if (supplyTutorialVisible() && nextTab !== "supplies") {
      state.tab = "supplies";
      state.error = "補給チュートリアルを完了するまで、補給タブから移動できません。";
      saveState();
      render();
      return;
    }
    state.phase = "camp";
    state.tab = nextTab;
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
    const skillId = element.dataset.skill || null;
    state.selectedSkillNode = state.selectedSkillNode === skillId ? null : skillId;
    // R19（issue #137）— 前提・派生先の札を押したとき、選んだ節が画面に出るよう
    // **そのツリーへ切り替える。**
    const target = skillId ? SKILL_TREE_NODES.find((entry) => entry.skillId === skillId) : null;
    if (target && state.selectedSkillNode) state.skillTreeKind = target.kind;
    saveState();
    render();
    return;
  }

  // R19（issue #137）— 取得済み技能を1段上げる。解禁と同じで払い戻しは無い。
  if (action === "level-up-skill") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const result = levelUpRunSkill(state.run, characterId, skillId, skillLevelCapOf(skillId));
    if (!result.ok) state.error = result.reason;
    else {
      state.run = result.run;
      record("skill_leveled", { characterId, skillId, level: result.level, cost: SKILL_LEVEL_COST });
    }
    saveState();
    render();
    return;
  }

  if (action === "select-skill-kind") {
    const kind = element.dataset.kind;
    if (!["active", "reactive", "passive"].includes(kind)) return;
    state.skillTreeKind = kind;
    saveState();
    render();
    return;
  }

  if (action === "toggle-roster") {
    const id = element.dataset.character;
    if (!id || !characterInfo(id)) return;
    // R12 — 判定は metCharacterIds ひとつに寄せる（画面と engine で別々に
    // 判定すると、いつか片方だけずれる）。
    if (!rosterLocked() && !metCharacterIds().has(id)) {
      state.error = "まだ会っていない仲間は、編成に入れられません。";
      render();
      return;
    }
    if (rosterLocked()) {
      state.error = "この区画の同行者は物語が決めます。一度クリアすると自由に選べます。";
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
          nextLoadout.passives[characterId] = [...(state.run.loadout.passives?.[characterId] || [])];
          nextLoadout.equipment[characterId] = [...(state.run.loadout.equipment?.[characterId] || [])];
          const disabled = state.run.loadout.disabled?.[characterId];
          if (Array.isArray(disabled) && disabled.length) {
            const installed = new Set([
              ...nextLoadout.tactics[characterId],
              ...nextLoadout.reactives[characterId],
              ...nextLoadout.passives[characterId],
            ]);
            nextLoadout.disabled ??= {};
            nextLoadout.disabled[characterId] = [...new Set(disabled)].filter((skillId) => installed.has(skillId));
            if (!nextLoadout.disabled[characterId].length) delete nextLoadout.disabled[characterId];
          }
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
      state.error = "この区画の同行者は物語が決めます。一度クリアすると自由に選べます。";
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

  // R6 §5.3 — 取得は遠征内。遠征が終われば消える。
  // R18 — 取得の払い戻し経路は無く、装着後は順番とオン／オフだけを変えられる。
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

  if (action === "toggle-skill") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const kind = element.dataset.kind;
    const result = toggleSkill(state.run.loadout, characterId, skillId, limitsFor);
    if (!result.ok) state.error = result.reason;
    else {
      state.run.loadout = result.loadout;
      record("skill_toggled", { characterId, skillId, kind, enabled: result.enabled });
    }
    saveState();
    render();
    return;
  }

  if (action === "move-skill" || action === "move-tactic") {
    const kind = element.dataset.kind || "active";
    state.run.loadout = reorderSkill(
      state.run.loadout,
      element.dataset.character,
      kind,
      Number(element.dataset.index),
      Number(element.dataset.direction),
      limitsFor,
    );
    record("skill_reordered", {
      characterId: element.dataset.character,
      kind,
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
    if (supplyTutorialVisible()) {
      state.tab = "supplies";
      state.error = "まず補給チュートリアルの指定操作を完了してください。";
      saveState();
      render();
      return;
    }
    // R9 §2.1 — 出発に必要な人数は Stage で変わる（Stage 0 は2人）。
    if (state.run.roster.length !== runPartySize()) {
      state.error = "出発には" + runPartySize() + "人の編成が必要です。";
      state.tab = "roster";
      saveState();
      render();
      return;
    }
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
    // issue #138 — チュートリアル（灰の門）も含め、常に戦闘前確認を挟まず
    // そのまま自動戦闘へ進む。act boss の前で一度だけ会話を挟む戦闘は、
    // 会話のあとに続けて自動戦闘へ入る（会話自体は物語上必要なので残す）。
    const actBeat = state.prologueActive
      ? null
      : actStoryBeatForEncounter(state.run.campaignStageSequence, state.run.encounterIndex);
    if (actBeat) {
      enterStory([actBeat], "battle");
      return;
    }
    simulateAndEnterBattle();
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
    // R12 — **再生を飛ばしても、序盤の会話を飛び越えない。**
    // 以前はこの分岐が scheduleReplayBeat（再生が最後まで流れきった場合）にしか
    // 無かったので、［結果を見る］で再生を打ち切ると prologueClear が起きず、
    // 既読印が押されないまま prologueActive が真のまま残った。**門の一戦から
    // 出られなくなる**（結果画面は「編成を見直す」しか出さないので、
    // 何度勝っても同じ盤面へ戻る）。goToBattleResult に寄せて、両方の経路で通す。
    goToBattleResult();
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

  // issue #138 — 戦闘前確認の画面（battlePreview）を廃止したので、キャンプへ戻す。
  if (action === "back-battle-preview") {
    state.phase = "camp";
    state.tab = "map";
    state.battleError = null;
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
        // Phase C — 遠征ごとの装備は定義ごと run へ入れる（content bundle に無い品なので）。
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
          reward: "equipment",
          equipmentId: offer.equipmentId,
          rarity: offer.item.rarity,
          descriptor: offer.item.descriptor,
        });
      } else {
        state.run.inventory = [...state.run.inventory, offer.equipmentId];
        record("reward_taken", { encounter: state.run.encounterIndex, reward: "equipment", equipmentId: offer.equipmentId });
      }
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

  // 補給の治療結果を一箇所で適用する。対象を選び終えるまで
  // spendSupply は呼ばないので、#159 の明示選択と有限資源の意味を両立する。
  function applyCampTreatment(treatmentId, targetCharacterIds, tutorialVisible) {
    const result = campTreat(state.run, state.profile, treatmentId, targetCharacterIds);
    if (!result.ok) {
      state.error = result.reason;
      return false;
    }
    state.run = result.run;
    const treated = [...(result.treated ?? [])];
    const tutorialCompleted = tutorialVisible && treatmentId === "concentrated";
    state.treatTargets = treated;
    state.treatmentResult = {
      treatmentId,
      treated,
      supplies: state.run.supplies,
      tutorialCompleted,
    };
    record("camp_treated", { treatmentId, targets: treated, supplies: state.run.supplies });
    if (tutorialCompleted) {
      const flags = new Set(Array.isArray(state.profile.storyFlags) ? state.profile.storyFlags : []);
      flags.add(SUPPLY_TUTORIAL_FLAG);
      state.profile = { ...state.profile, storyFlags: [...flags] };
      record("supply_tutorial_completed", { treatmentId, targets: treated });
    }
    state.treatmentSelection = null;
    return true;
  }

  if (action === "select-treatment-target") {
    const treatmentId = element.dataset.treatment;
    const treatment = CAMP_TREATMENTS[treatmentId];
    const characterId = element.dataset.character;
    if (!treatment || treatment.targetCount === "all" || state.treatmentSelection !== treatmentId) return;
    if (!treatmentTargetIds(treatment).includes(characterId)) {
      state.error = "その仲間はこの治療の対象にできません。";
      saveState();
      render();
      return;
    }
    const tutorialVisible = supplyTutorialVisible();
    applyCampTreatment(treatmentId, [characterId], tutorialVisible);
    saveState();
    render();
    return;
  }

  if (action === "cancel-treatment-target") {
    state.treatmentSelection = null;
    state.treatTargets = [];
    saveState();
    render();
    return;
  }

  if (action === "treat") {
    const treatmentId = element.dataset.treatment;
    const treatment = CAMP_TREATMENTS[treatmentId];
    const tutorialVisible = supplyTutorialVisible();
    if (!treatment) {
      state.error = "その治療はありません。";
    } else if (tutorialVisible && treatmentId !== "concentrated") {
      state.error = "チュートリアル中は集中治療を完了してください。";
    } else if (treatment.targetCount !== "all") {
      const candidates = treatmentTargetIds(treatment);
      if (!candidates.length) {
        state.error = "治療できる対象がいません。";
      } else {
        state.treatmentSelection = treatmentId;
        state.treatTargets = [];
      }
    } else {
      applyCampTreatment(treatmentId, [], tutorialVisible);
    }
    saveState();
    render();
    return;
  }

  // R6 §9.2 — 精算は勝敗・放棄のいずれでも一度だけ。**ここが唯一の入口。**
  // R11 §5 改 — チュートリアル中は撤退できない（画面上のボタンは既に隠しているが、
  // 経路として二重に塞ぐ）。
  if (action === "settle-run" || action === "abandon-run") {
    if (state.prologueActive || supplyTutorialVisible()) return;
    const won = action === "settle-run"
      && state.run.encounterIndex >= ENCOUNTERS_PER_RUN
      && state.lastResult?.result === "win";
    // R8 §10.3 — 「放棄」は自発的な安全撤退として扱う（won/lostに続く3つ目のoutcome）。
    const outcome = won ? "won" : action === "abandon-run" ? "retreat" : "lost";
    // issue #212 follow-up — Campaign StageのstageEndは初訪・再訪を分けず、
    // 完走するたびに同じ会話を通常の一行送りで表示する。
    const stage = CAMPAIGN_STAGES[state.run.campaignStageSequence];
    const stageEndBeat = won && stage
      ? storyBeat(stage.id, "stageEnd")
      : null;
    const result = settleRun(state.profile, state.run, outcome);
    if (!result.ok) {
      state.error = result.reason;
    } else {
      state.profile = result.profile;
      state.run = result.run;
      state.lastSettlement = result.settlement;
      record("run_settled", result.settlement);
    }
    if (result.ok && stageEndBeat) {
      enterStory([stageEndBeat], "settlement");
      return;
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
      gameVersion: GAME_VERSION,
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
        // Phase C — 遠征ごとの装備は content 版だけでは復元できない。**descriptor と
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
