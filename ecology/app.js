import { simulateBattle } from "./engine.mjs";
import { PLAYABLE_CONTENT } from "./playable-content.mjs";
import {
  hpAlertFor,
  hpAlertLabelFor,
  hpGaugeCornerRoles,
  hpGaugeState,
  hpToneFor,
} from "./hp-gauge.mjs";
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
  componentLabel,
  registerGeneratedEquipment,
  makePrologueBattle,
  simulateExpeditionBattle,
  tacticUseWhenFor,
  prologueEncounter,
  // issue #240 — 必殺技を教える一戦。**第1戦の席に座る手書きの盤面。**
  ULTIMATE_LESSON_ENCOUNTER_INDEX,
  ultimateLessonEncounter,
  // issue #238 — 必殺技の指定と構え。loadout を触るのはこの三つだけ。
  // #240/#242 追補 — 画面が使うのは長押し一回の toggleUltimateForBattle で、
  // 指定と構えを別々に動かす二つは model の原子操作として残る（ultimate.test.mjs）。
  toggleUltimateForBattle,
  ultimateCandidates,
  installUnlockedSkills,
} from "./playable-battles.mjs";
import {
  BOSS_LAWS,
  CAMPAIGN_STAGES,
  campaignStageDisplayNameFor,
  DOSSIER_SECTION_HEADINGS,
  ENEMY_MUTATIONS,
  MAX_CAMPAIGN_STAGE_SEQUENCE,
  DOSSIER_FINAL_STAGE_SEQUENCE,
  PACK_BY_ID,
  PORTRAIT_IMAGE_URLS,
  PROLOGUE,
  // 作者要望 2026-09-14 — 一戦目の後に教える技能点の使い方（取得と予約）。
  SKILL_LESSON,
  ULTIMATE_LESSON,
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
  // issue #177 — 「誰の何で伸びるのか」と、その技能の効果量。
  leveledEffectOf,
  // R19（issue #137）— 技能ツリーの座標と表示語彙。
  BRANCH_BUILDS,
  SCOPE_LABELS,
  SKILL_TREE_GROUPS,
  TRIGGER_LABELS,
  buildSkillTreeLayout,
  // issue #168 — 前提（技能IDと必要Lv）の判定。解禁 API と同じ関数を読む。
  remainingPrerequisiteLevels,
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
  cancelRunSkillReservation,
  canFulfillSkillReservation,
  fulfillSkillReservations,
  manifestSkillIds,
  normalizeRunSkillReservations,
  reserveRunSkill,
  skillReservationFor,
  skillReservationLevelFor,
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
  runSkillLevelsFor,
  levelUpRunSkill,
  settleRun,
  slotLimits,
  spendSupply,
  unlockRunSkill,
  upgradeCost,
  TRAINING_STEP_BPS,
  upgradeLevel,
  INVENTORY_LIMIT,
  // PR #255 — 遠征ごとの補給総数（表記の分母）と、装備候補を出す戦闘の判定。
  // 画面は `MAX_SUPPLIES`（永続強化を積んだときの天井）を読まない。読むのは
  // つねに**その遠征の総数**で、分母が画面ごとにずれないようにする。
  runSuppliesMax,
  offersRewardAfterClear,
  // issue #151 — 精算で残す設計図は、候補と上限を読んでプレイヤーが選ぶ。
  blueprintSaveCandidates,
  blueprintSaveLimitFor,
  appraisalLevel,
  blueprintCarryCapacity,
  newGeneratedItems,
  takeGeneratedEquipment,
  // issue #238 — 必殺印（一人一遠征に一度きり・補充なし）と、いま構えている必殺技。
  armedUltimates,
  ultimateUsesLeft,
  ultimatesUnlocked,
} from "./progression.mjs";
import {
  blueprintCompatibility,
  searchBlueprints,
  setCarrySelection,
  toggleFavorite,
} from "./blueprints.mjs";
import { RARITIES, RARITY_LABEL } from "./content/affixes.mjs";
import {
  ULTIMATE_AMOUNT_MULTIPLIER,
  ULTIMATE_MIN_STAGE_SEQUENCE,
  ULTIMATE_READY_HP_PERCENT,
  baseSkillIdOf,
  isUltimateId,
} from "./ultimates.mjs";
import { MIN_SKILL_LEVEL, POSITIONS, RUN_SCHEMA_VERSION } from "./schema.mjs";
import { maxHpWithStaticBonuses } from "./static-bonuses.mjs";
import {
  buildBeats,
  beatDurationMs,
  beatHasStrikeImpact,
  eventSourceId,
  filterReplayEvents,
  REPLAY_EVENT_TYPES,
  STRIKE_IMPACT_EVENT_TYPES,
} from "./replay-beats.mjs";
import {
  attackStyleOfEvent,
  beatAttackStyle,
  buildAttackStyleIndex,
} from "./attack-style.mjs";
import { spawnImpactMark, spawnStrikeLine } from "./battle-fx.mjs";
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
// 作者要望 2026-09-14 — 技能の取得・予約を教え終えた印。補給と同じで一度きり。
const SKILL_LESSON_FLAG = "skill_lesson_seen";
// issue #240 — 必殺技の一戦を見終えた印。**一度見たら再訪では出さない。**
const ULTIMATE_LESSON_FLAG = "ultimate_lesson_seen";
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

// issue #159 — 固定同行者の区画では、人数を N/M で出さない。**分母は「まだ入れられる」
// と読めてしまう**が、その回は誰も足せない（作者指摘、2026-09-08）。
function partyLabel() {
  return rosterLocked()
    ? state.run.roster.length + "人"
    : state.run.roster.length + " / " + runPartySize() + "人";
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
  // issue #236 — **取得済みは必ず装着欄に並ぶ。**starter の前提（無償閉包で取得済みに
  // なる親の節）は、これまで解禁表にだけあって装着欄に無かった。その状態はオフと
  // 同じことを二通りに表しているだけなので、ここでオフのまま装着欄へ入れる。
  // 戦闘の入力は変わらない（allyInput が disabled を除いてから組む）。
  next.loadout = installUnlockedSkills(
    next.loadout, characterId, next.runUnlockedSkills[characterId]);
  // 行動が一つも残らなくても、戦闘 engine が技能なし時の通常攻撃へ戻す。
  // ここで strike を補充すると「0個にする」編成が再加入時だけ戻ってしまう。
  return next;
}

function freshUiState() {
  return {
    phase: "intro",
    tab: "map",
    // issue #235 — 盤面が隊列の組み替えを受けているか。その場かぎりの役なので保存しない
    // （persistableState が落とし、読み込みでも false へ戻す）。
    formationMode: false,
    guildTab: "expedition",
    // Phase C — Blueprint archive の絞り込み（画面だけの状態）。
    blueprintFilter: { rarity: null, favorite: false },
    // R9 §2 / §7 — 物語の断片。queue が空になったら after へ進む。
    // lineIndex は断片の中の何行目か。auto は自動送り、log は履歴。
    story: { queue: [], after: "camp", lineIndex: 0, auto: false, log: [], logOpen: false },
    // issue #200 — 巻き戻しの演出が逆走させる行（読んだ履歴の逆順）と、凍らせる舞台。
    // **保存しない**（persistableState が落とす）。演出の途中でリロードしたら、
    // すでに巻き戻し済みの会話から続ける。
    rewind: null,
    // 画面内ヘルプの開閉は、同じ画面を再描画しても保持する。
    helpOpen: {},
    saveMenuReturn: "intro",
    // タイトル画面は表示だけの状態。Continue用の再開先を別に保持する。
    resumePhase: null,
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
    // 全戦投影で選んでいる戦闘と敵。ギルドとキャンプで同じ盤を使い、
    // 技能タブへ往復しても閲覧位置を保つ。保存データには入れない。
    inspectedEncounterIndex: null,
    selectedEnemyId: null,
    formationSelection: null,
    selectedSkillNode: null,
    // R19（issue #137）— ツリーは種別（アクティブ / リアクティブ / パッシブ）で切り替える。
    skillTreeKind: "active",
    // issue #177 — テーマの絞り込み（null は全部）。
    skillTreeBranch: null,
    selectedEquipment: null,
    // R12 — Free / Endless（旧・難易度rank選択）を削除した。遠征は Campaign Stage
    // だけになったので、仕立て方の選択も難易度の選択も持たない（作者判断）。
    selectedCampaignStageSequence: 0,
    treatTargets: [],
    treatmentSelection: null,
    treatmentResult: null,
    // #209 — the mandatory walkthroughs belong only to the New Game Stage 0
    // introduction. Revisited/ordinary expeditions start with zero supplies and
    // must keep their normal, optional camp flow.
    //
    // 作者要望 2026-09-14 — 印は**導入の遠征そのもの**を指す。技能の取得・予約
    // （一戦目の後）と補給（二戦目の後）が同じ印を読むので、`supply` の名前を
    // 外した（古い保存は hydrateState が読み替える）。
    tutorialRunId: null,
    // 作者要望 2026-09-14 — 技能チュートリアルの受け渡し（もう一人を押す最後の一手）が
    // 済んだ印。**ここから先は自由な場面**なので、画面の状態から導かずに印で覚える。
    skillLessonHandedOff: false,
    hp: {},
    equipmentDurability: {},
    rewardOffer: [],
    // PR #255 — 最終戦で装備を受け取った戦闘。**候補を作り直さない**ための印。
    rewardTakenAtEncounter: null,
    // issue #151 — 精算で残す設計図の選択（descriptor の配列）。
    blueprintKeep: null,
    pendingSettlement: null,
    lastResult: null,
    lastSettlement: null,
    lastCarrySnapshot: null,
    replayEvents: [],
    replaySnapshots: [],
    replayIndex: 0,
    replayPlaying: false,
    replaySpeed: "normal",
    replayLogOpen: false,
    // 先見機の試映中だけ真。本番と同じ replay を表示するが、Run / Profile は確定しない。
    simulationMode: false,
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

function hydrateState(saved, { resumeFromTitle = false } = {}) {
  if (!saved) return initialState();
  const fresh = initialState();
  const next = { ...fresh, ...saved };
  // タイトル画面自体をオートセーブの再開先にしない。
  // マーカーの無い旧い保存は、タイトルへ戻る直前の既定導線へ戻す。
  if (resumeFromTitle && next.phase === "intro") {
    const resumablePhases = [
      "expeditionStart", "story", "camp", "battle", "battleError",
      "result", "defeat", "settlement", "homestead", "complete",
    ];
    next.phase = resumablePhases.includes(saved.resumePhase)
      ? saved.resumePhase
      : "expeditionStart";
  }
  // ページを開いた直後はタイトルを表示する。Continueで復元した後は再保存時に消える。
  next.resumePhase = null;
  // issue #138 — 「報酬を見る」の中間画面を廃止した。結果画面が報酬選択を兼ねるので、
  // 旧いオートセーブがちょうどその画面で保存されていても結果画面へ戻す。
  if (next.phase === "reward") next.phase = "result";
  // issue #138 — 戦闘前確認の画面（battlePreview）も廃止した。旧いオートセーブが
  // ちょうどその画面で保存されていてもキャンプへ戻す。
  if (next.phase === "battlePreview") {
    next.phase = "camp";
    next.tab = "map";
  }
  // 作者要望 2026-09-14 — 導入の遠征の印は `supplyTutorialRunId` から
  // `tutorialRunId` へ名を変えた（補給だけでなく技能の手取りも読む）。
  // **古い保存の遠征を、印の無い普通の遠征へ落とさない。**
  if (!next.tutorialRunId && saved.supplyTutorialRunId) next.tutorialRunId = saved.supplyTutorialRunId;
  delete next.supplyTutorialRunId;
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
  next.run = {
    ...next.run,
    skillReservations: normalizeRunSkillReservations(next.run),
  };
  next.run.formation = normalizeFormation(savedRun.formation, next.run.roster);
  next.run.loadout = savedRun.loadout || freshLoadout(next.run.roster);
  // issue #236 — 「取得済みだが未装着」を持つ古い保存も、読み込んだ時点で
  // オフの装着済みへ揃える。**その保存の戦闘結果は変わらない。**
  for (const characterId of next.run.roster) {
    next.run.loadout = installUnlockedSkills(
      next.run.loadout, characterId, next.run.runUnlockedSkills?.[characterId]);
  }
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
  // PR #255 — 遠征ごとの補給総数。**古い保存には欄が無い**ので、持っている数と
  // 固定値から読み直す（`runSuppliesMax`）。読み直した総数より多くは持てない。
  next.run.suppliesMax = runSuppliesMax(savedRun);
  next.run.supplies = Math.max(0, Math.min(next.run.suppliesMax, Math.floor(savedRun.supplies ?? 0)));
  // issue #238 — 欄の無い保存は「まだ誰も放っていない」として読む。
  next.run.ultimatesUsed = Array.isArray(savedRun.ultimatesUsed)
    ? savedRun.ultimatesUsed.filter((id) => typeof id === "string")
    : [];
  next.run.results = Array.isArray(savedRun.results) ? savedRun.results : [];

  next.migrationNote = null;
  // issue #159 — 保存に欄が無い（この欄より古い）保存も、**誰も選んでいない状態**で開く。
  // 選択中の人物を引き継ぐと、盤面のどこかが最初から光った状態でキャンプへ戻る。
  const savedFormationSelection = saved.formationSelection;
  next.formationSelection = next.run.roster.includes(savedFormationSelection) ? savedFormationSelection : null;
  next.formationMode = false;
  // 戦闘内の値（HP・装備耐久）はBattleState。保存から戻るときは満タンへ戻す。
  next.hp = Object.fromEntries(
    CHARACTER_OPTIONS.map((option) => [option.id, characterStats(next.profile, option.id).stats.maxHp]),
  );
  next.equipmentDurability = {};
  next.runEvents = Array.isArray(next.runEvents) ? next.runEvents : [];
  next.rewardOffer = Array.isArray(next.rewardOffer) ? next.rewardOffer : [];
  // 旧版の全タブ共通カードは戦歴へ統合したため、読み込み時に捨てる。
  delete next.lastBattleNote;
  next.rewardTakenAtEncounter = Number.isInteger(next.rewardTakenAtEncounter)
    ? next.rewardTakenAtEncounter
    : null;
  next.blueprintKeep = Array.isArray(next.blueprintKeep) ? next.blueprintKeep : null;
  next.pendingSettlement = next.pendingSettlement && typeof next.pendingSettlement === "object"
    ? next.pendingSettlement
    : null;
  // issue #151 — 選択の途中で中断した保存は、精算の前（結果画面）から読み直す。
  if (next.phase === "blueprintPick" && !next.pendingSettlement) next.phase = "camp";
  next.replayEvents = Array.isArray(next.replayEvents) ? next.replayEvents : [];
  next.replaySnapshots = Array.isArray(next.replaySnapshots) ? next.replaySnapshots : [];
  next.skillTreeScroll = next.skillTreeScroll && typeof next.skillTreeScroll === "object" && !Array.isArray(next.skillTreeScroll)
    ? next.skillTreeScroll
    : {};
  next.selectedSkillNode = next.selectedSkillNode || null;
  next.inspectedEncounterIndex = null;
  next.selectedEnemyId = null;
  next.skillTreeKind = ["active", "reactive", "passive"].includes(next.skillTreeKind) ? next.skillTreeKind : "active";
  next.skillTreeBranch = typeof next.skillTreeBranch === "string" && next.skillTreeBranch ? next.skillTreeBranch : null;
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
  next.simulationMode = next.simulationMode === true;
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
  // issue #235 — 隊列の組み替えは**その場かぎりの役**である。保存して戻ったときに
  // 盤面が組み替えの途中で開くと、人物を選ぶつもりの一押しが移動になる（#159 の
  // 「誰も選んでいない状態で開く」と同じ理由）。
  delete persisted.formationMode;
  // 全戦投影の閲覧位置と敵詳細の選択は、その場かぎりの表示状態として扱う。
  delete persisted.inspectedEncounterIndex;
  delete persisted.selectedEnemyId;
  // issue #200 — 巻き戻しの演出は保存の再開先にしない。**状態はもう巻き戻し済み**なので、
  // 途中でリロードしたら巻き戻し後の会話から続ける（演出だけを二度見せない）。
  if (state.phase === "rewind") persisted.phase = "story";
  delete persisted.rewind;
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
    // issue #237 — 保存できた枠そのものも一度光る（帯の一行と枠の二箇所で返す）。
    fx("save-slot:" + slot, "gain");
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
  const resumeFromTitle = state.phase === "intro"
    || (state.phase === "saveMenu" && state.saveMenuReturn !== "camp");
  state = hydrateState(snapshot, { resumeFromTitle });
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

function shell(body) {
  const error = state.error ? "<p class=\"error\" role=\"alert\">" + esc(state.error) + "</p>" : "";
  // 通常画面の shell は本文を包むだけにする。タイトル・撤退・戻るの共通導線を
  // 上端へ自動で足すと、画面ごとの主操作と競合し、キャンプのタブからも離れる。
  // それぞれの操作は、その判断をするカードまたはタブ内容の中へ置く。
  const footer = "<span class=\"build-stamp\" hidden aria-hidden=\"true\">build " + esc(BUILD) + "</span>";
  return "<div class=\"shell\">" + body + error + footer + "</div>";
}

// ---------------------------------------------------------------- 起動と読み込み
//
// **絵は、要る画面に入る前に読み終えておく。**立ち絵は会話が始まってから後追いで
// 出ていた（原本の PNG が5人で 13MB あった）。配信用の WebP へ替えたうえで、
// 起動時にタイトルの画と5人の立ち絵を先に取り、読み込み画面で待つ。
//
// **待ちは有限にする。**回線が細い・画像が消えている・decode に失敗するのいずれでも、
// BOOT_TIMEOUT_MS で打ち切ってゲームを始める（絵が出ないことはあっても、
// 入口で止まることはない）。
const TITLE_ART_URL = "/ecology/art/title-cast.webp";
const BOOT_TIMEOUT_MS = 7000;
// 読み込みが速いときに読み込み画面を一瞬だけ出すと、ちらついて見える。
// この時間より早く終わったら、読み込み画面そのものを出さない。
const BOOT_REVEAL_DELAY_MS = 200;
const GAME_TITLE = "One Battle Ahead";
const bootImages = [];

function preloadImage(src) {
  const image = new Image();
  bootImages.push(image);
  image.src = src;
  if (typeof image.decode === "function") {
    return image.decode().catch(() => undefined);
  }
  return new Promise((resolve) => {
    image.onload = resolve;
    image.onerror = resolve;
  });
}

function renderBootScreen(loaded, total) {
  const percent = total ? Math.round((loaded / total) * 100) : 100;
  app.innerHTML = titleShell(GAME_TITLE, "", "<section class=\"title-screen boot-screen\">"
    + "<div class=\"boot-bar\" role=\"progressbar\" aria-label=\"読み込み中\""
    + " aria-valuemin=\"0\" aria-valuemax=\"100\" aria-valuenow=\"" + percent + "\">"
    + "<i style=\"width:" + percent + "%\"></i></div></section>");
}

async function boot() {
  const sources = [TITLE_ART_URL, ...PORTRAIT_IMAGE_URLS];
  let loaded = 0;
  let showing = false;
  const reveal = setTimeout(() => {
    showing = true;
    renderBootScreen(loaded, sources.length);
  }, BOOT_REVEAL_DELAY_MS);
  const loading = sources.map((src) => preloadImage(src).then(() => {
    loaded += 1;
    // タイトルの画は、読み終わってから一度だけ現れる（途中の帯を見せない）。
    if (src === TITLE_ART_URL) document.documentElement.classList.add("title-art-ready");
    if (showing) renderBootScreen(loaded, sources.length);
  }));
  let expired = null;
  await Promise.race([
    Promise.all(loading),
    new Promise((resolve) => { expired = setTimeout(resolve, BOOT_TIMEOUT_MS); }),
  ]);
  clearTimeout(reveal);
  if (expired !== null) clearTimeout(expired);
  render();
}

// タイトルの表題は、文字を並べただけの見出しではなく**組み文字**として置く。
// 最後の語を下段へ落として字間を開き、上段と対比させる。装飾記号（以前の ◈）は
// 置かない。**記号は意味を持たないので、大きく置くほど安っぽく見える。**
function wordmarkMarkup(title) {
  const words = String(title).split(/\s+/).filter(Boolean);
  if (!words.length) return "<h1 class=\"wordmark\"></h1>";
  const tail = words[words.length - 1];
  const lead = words.slice(0, -1).join(" ");
  return "<h1 class=\"wordmark\">"
    + (lead ? "<span class=\"wordmark-lead\">" + esc(lead) + "</span>" : "")
    + "<span class=\"wordmark-tail\">" + esc(tail) + "</span></h1>";
}

function titleShell(title, subtitle, body) {
  const error = state.error ? "<p class=\"error\" role=\"alert\">" + esc(state.error) + "</p>" : "";
  const footer = "<span class=\"build-stamp\" hidden aria-hidden=\"true\">build " + esc(BUILD) + "</span>";
  // 空気は画面いっぱいの層で作り、タイトル画面を出しているあいだだけ存在させる。
  // 画像は持たない（読み込み待ちのない起動が、この画面の速さである）。
  return "<div class=\"shell title-shell\"><div class=\"title-air\" aria-hidden=\"true\"></div>"
    + "<header class=\"header title-header\"><div>" + wordmarkMarkup(title)
    + "<p class=\"subtitle\">" + esc(subtitle)
    + "</p></div></header>" + body + error + footer + "</div>";
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
  // 固定コンテンツだけでなく、現在の Run が保持する生成装備もここを通す。
  // 内部 ID をそのまま画面へ出すのは、未知の部材を診断するときだけに限定する。
  return componentLabel(id) ?? "不明";
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
  return maxHpWithStaticBonuses(
    base,
    runContentBundle(state.run),
    passiveSkillIds,
    equipment,
    runSkillLevelsFor(state.run, characterId),
  );
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

// 導入 Stage の第 n 戦に勝ったあとか。**手取りチュートリアルの置き場所は
// 「どの一戦の直後か」だけで決まる**ので、判定は一つにして戦数で呼び分ける。
//
// R11 §5 改 — 巻き戻したあとの勝利がそのまま encounter 1 の勝利になるので、
// `!state.prologueActive` は advanceAfterBattle が既に prologueActive を
// 落としたあとにしか呼ばれない（結果・報酬画面の表示中はまだ真のまま）。
function ordinaryBattleWon(encounterIndex) {
  return isCampaignRun()
    && state.run.campaignStageSequence === 0
    && !state.prologueActive
    && Array.isArray(state.run.results)
    && state.run.results.some((entry) => entry.encounter === encounterIndex && entry.result === "win");
}

// 導入の遠征（New Game で始めた Stage 0）か。**再訪・通常遠征は手取りを持たない。**
function tutorialRun() {
  return state.tutorialRunId === state.run.runId;
}

// 作者要望 2026-09-14 — 教える順は「一戦目前: 隊列 → 一戦目後: 技能の取得・予約
// → 二戦目後: 補給」。**同じ画面に二つ出さない**ので、戦数で場所を分ける。
const SKILL_LESSON_ENCOUNTER_INDEX = SKILL_LESSON.encounterIndex ?? 1;
const SUPPLY_TUTORIAL_ENCOUNTER_INDEX = SKILL_LESSON_ENCOUNTER_INDEX + 1;

function shouldShowSkillLessonAfterBattle() {
  return ordinaryBattleWon(SKILL_LESSON_ENCOUNTER_INDEX)
    && state.run.encounterIndex === SKILL_LESSON_ENCOUNTER_INDEX
    && state.lastResult?.result === "win"
    && !hasStoryFlag(SKILL_LESSON_FLAG);
}

function skillLessonVisible() {
  return tutorialRun()
    && ordinaryBattleWon(SKILL_LESSON_ENCOUNTER_INDEX)
    && state.run.encounterIndex === SKILL_LESSON_ENCOUNTER_INDEX + 1
    && !hasStoryFlag(SKILL_LESSON_FLAG);
}

function shouldShowSupplyTutorialAfterBattle() {
  return ordinaryBattleWon(SUPPLY_TUTORIAL_ENCOUNTER_INDEX)
    && state.run.encounterIndex === SUPPLY_TUTORIAL_ENCOUNTER_INDEX
    && state.lastResult?.result === "win"
    && !hasStoryFlag(SUPPLY_TUTORIAL_FLAG);
}

function supplyTutorialVisible() {
  return tutorialRun()
    && ordinaryBattleWon(SUPPLY_TUTORIAL_ENCOUNTER_INDEX)
    && state.run.encounterIndex >= SUPPLY_TUTORIAL_ENCOUNTER_INDEX + 1
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
  // R23 — 12戦の中身は Stage ごとに違う。**予測も本番も同じ引数**で組む。
  return {
    partySize: state.run.partySize,
    stageSequence: state.run.campaignStageSequence ?? 0,
  };
}

// R9 §3.2 — 敵の数と threat budget は、その遠征の人数に合わせて決まる。
// **preview と正式実行が同じ引数を使う**ように、ここ一箇所で組む。
function currentEncounter() {
  // R9 §2.1 — 序盤の敗北は12戦の梯子に属さない。**別の敵を出しているのに
  // 第1戦の名前を出さない**（何を見ているのか分からなくなる）。
  if (state.prologueActive) return prologueEncounter();
  // issue #240 — 必殺技の一戦も梯子から出てこない手書きの盤面である。**予測も本番も
  // ここを通る**ので、「予測では勝てたのに本番は別の敵だった」が構造として起きない。
  if (ultimateLessonActive()) return ultimateLessonEncounter();
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

// issue #237 — 反応の宛先（`data-fx="cell:<立ち位置>"`）を人物から引く。
// **人物ではなく枠を光らせる**ので、入れ替えたときに空いた側も鳴る。
function cellFxKey(characterId) {
  const position = characterId ? state.run?.formation?.[characterId] : null;
  return position ? "cell:" + position : null;
}

function positionOwner(position) {
  return state.run.roster.find((characterId) => state.run.formation[characterId] === position) ?? null;
}

// 枠の行（"front" / "rear"）。**綴りの規則は POSITIONS の名前そのもの**で、
// 盤面の並び（`position.startsWith(row + "_")`）と同じ読み方をここに一つだけ置く。
function positionRow(position) {
  return POSITIONS.includes(position) ? String(position).split("_")[0] : null;
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


// ---------------------------------------------------------------- 図で言う（作者要望 2026-09-13）
//
// **文章で説明する画面はダサい。**規則・内訳・状態・因果は、段落ではなく
// 記号・数・目盛り・流れで出す。文のまま残すのは会話（story）と、
// 世界の側が言う一行（world-voice / settle-closing / 名簿・図鑑の本文）だけである。
//
// ここは画面共通の語彙で、画面ごとに似た形を作り直さない。
//   glyph()        線画の記号。色は currentColor で継ぐので、置いた場所の色になる。
//   statTiles()    数の並び。**数が主、名が従。**
//   ruleGrid()     規則の一段。記号＋一語＋十数文字。段落にしない。
//   flowStrip()    順のあること（払う→変える→戻る）を矢印で繋ぐ。
//   segmentMeter() 段のあるもの（鍛錬12段・補給3個・到達12戦）を目盛りで出す。
//   ledgerRows()   内訳を長さで比べる。合計との比が、読まずに分かる。
//   splitColumns() 残るもの／消えるものを二列で並べる。
//
// **記号は線画に統一する。**絵文字は端末ごとに別の絵が出て、色も継がない。
const GLYPHS = Object.freeze({
  funds: "<circle cx='12' cy='12' r='8.2'/><path d='M12 6.8 14.7 12 12 17.2 9.3 12Z'/>",
  supply: "<path d='M12 3.2 20 7.4v9.2L12 20.8 4 16.6V7.4Z'/><path d='M4 7.4 12 11.6l8-4.2M12 11.6v9.2'/>",
  blueprint: "<path d='M6 3h8l4 4v14H6Z'/><path d='M14 3v4h4'/><path d='M9 12h6M9 16h4'/>",
  distance: "<path d='M6 3.5v17'/><path d='M6 5h10l-2.2 3.2L16 11.4H6Z'/>",
  multiply: "<path d='M7 7 17 17M17 7 7 17'/>",
  strike: "<path d='M4 20 9.5 14.5'/><path d='M9 14 18.5 4.5 21 7 11.5 16.5Z'/><path d='M3 3.5 8 8'/>",
  might: "<path d='M4 20 12 12'/><path d='m13 4 7 7-3.2 3.2L9.8 7.2Z'/>",
  focus: "<circle cx='12' cy='12' r='7'/><circle cx='12' cy='12' r='2.2'/><path d='M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4'/>",
  guard: "<path d='M12 3 5 5.8v6.4c0 4 2.9 6.6 7 8.8 4.1-2.2 7-4.8 7-8.8V5.8Z'/>",
  vitality: "<path d='M3 12.5h3.8L9 7.5l3 9.5 2.2-5 1.4 2.5H21'/>",
  retry: "<path d='M20.2 12a8.2 8.2 0 1 1-2.6-6'/><path d='M20.5 3.6v5.2h-5.2'/>",
  reroll: "<rect x='4' y='4' width='16' height='16' rx='3.2'/><circle cx='9' cy='9' r='1.15'/><circle cx='12' cy='12' r='1.15'/><circle cx='15' cy='15' r='1.15'/>",
  camp: "<rect x='3.4' y='6.6' width='17.2' height='13' rx='2.4'/>"
    + "<path d='M9 6.6V5.2a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 5.2v1.4'/>"
    + "<path d='M12 10.4v5.4M9.3 13.1h5.4'/>",
  slots: "<rect x='3.2' y='6.4' width='17.6' height='11.2' rx='2.4'/><path d='M9.1 6.4v11.2M14.9 6.4v11.2'/>",
  spark: "<path d='M12 2.4 13.9 9.3 20.8 11.2 13.9 13.1 12 20 10.1 13.1 3.2 11.2 10.1 9.3Z'/>",
  lock: "<rect x='4.8' y='10' width='14.4' height='10.2' rx='2.2'/><path d='M8.2 10V7.2a3.8 3.8 0 0 1 7.6 0V10'/>",
  check: "<path d='m4.8 12.4 4.6 4.6L19.2 7.2'/>",
  cross: "<path d='M6 6 18 18M18 6 6 18'/>",
  person: "<circle cx='12' cy='8' r='3.6'/><path d='M4.8 20.4c1.3-4.1 3.9-6.2 7.2-6.2s5.9 2.1 7.2 6.2'/>",
  enemy: "<path d='M12 2.8 21.2 12 12 21.2 2.8 12Z'/><circle cx='12' cy='12' r='2.6'/>",
  gear: "<circle cx='12' cy='12' r='3.2'/><path d='M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1M18.6 18.6l-2.1-2.1M7.5 7.5 5.4 5.4'/>",
  skill: "<circle cx='12' cy='4.8' r='2.2'/><circle cx='5.4' cy='17.4' r='2.2'/><circle cx='18.6' cy='17.4' r='2.2'/><path d='M10.9 6.8 6.5 15.4M13.1 6.8l4.4 8.6M7.6 17.4h8.8'/>",
  round: "<circle cx='12' cy='12' r='8.2'/><path d='M12 6.8V12l3.6 2.2'/>",
  eye: "<path d='M2.4 12S6.2 6.2 12 6.2 21.6 12 21.6 12 17.8 17.8 12 17.8 2.4 12 2.4 12Z'/><circle cx='12' cy='12' r='2.6'/>",
  home: "<path d='M3.6 11.2 12 3.6l8.4 7.6'/><path d='M6 9.8v10.4h12V9.8'/>",
  book: "<path d='M4.4 5.4A2.4 2.4 0 0 1 6.8 3H19.2v14.6H6.8a2.4 2.4 0 0 0-2.4 2.4Z'/><path d='M19.2 17.6V21H6.8'/>",
  flag: "<path d='M6 3.4v17.2'/><path d='M6 4.8h11l-2.4 3.4L17 11.6H6Z'/>",
  down: "<path d='M12 4.2v14.4'/><path d='m6.4 13 5.6 5.6 5.6-5.6'/>",
  up: "<path d='M12 19.8V5.4'/><path d='m6.4 11 5.6-5.6 5.6 5.6'/>",
});

function glyph(name, className = "") {
  const body = GLYPHS[name];
  if (!body) return "";
  return "<svg class=\"glyph" + (className ? " " + className : "") + "\" viewBox=\"0 0 24 24\""
    + " fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\""
    + " stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\">" + body + "</svg>";
}

// 数の並び。**タイルは3〜4枚まで。**それ以上並べると、どれも読まれない。
// tone は色の役目（gold=得るもの / bad=失ったもの / good=残るもの / quiet=前提）。
function statTiles(items, className = "", columns = null) {
  const style = Number.isFinite(columns) ? " style=\"--tiles:" + columns + "\"" : "";
  const cells = items.filter(Boolean).map((item) => "<span class=\"stat-tile"
    + (item.tone ? " tone-" + esc(item.tone) : "")
    + (item.wide ? " wide" : "") + "\""
    + (item.watch ? " data-fx-watch=\"" + esc(item.watch) + "\"" : "") + ">"
    + (item.glyph ? glyph(item.glyph, "tile-glyph") : "")
    + "<b>" + esc(item.value) + (item.unit ? "<i>" + esc(item.unit) + "</i>" : "") + "</b>"
    + "<small>" + esc(item.label) + "</small></span>").join("");
  return "<div class=\"stat-tiles" + (className ? " " + className : "") + "\"" + style + ">" + cells + "</div>";
}

// 規則の一段。**一段につき、記号ひとつ・見出し一語・本文一行。**
// 二行以上書きたくなったら、それは規則が二つある（段を分ける）。
function ruleGrid(items, className = "") {
  const cells = items.filter(Boolean).map((item) => "<div class=\"rule-cell"
    + (item.tone ? " tone-" + esc(item.tone) : "") + "\">"
    + "<span class=\"rule-mark\">" + (item.glyph ? glyph(item.glyph) : esc(item.mark ?? "")) + "</span>"
    + "<span class=\"rule-copy\"><b>" + esc(item.title) + "</b>"
    + (item.value ? "<em>" + esc(item.value) + "</em>" : "")
    + (item.line ? "<small>" + esc(item.line) + "</small>" : "") + "</span></div>").join("");
  return "<div class=\"rule-grid" + (className ? " " + className : "") + "\">" + cells + "</div>";
}

// 順のあること。**矢印は「この次に何が起きるか」だけに使う。**
function flowStrip(steps, className = "") {
  const cells = steps.filter(Boolean).map((step) => "<span class=\"flow-step"
    + (step.tone ? " tone-" + esc(step.tone) : "") + "\">"
    + (step.glyph ? glyph(step.glyph, "flow-glyph") : "")
    + "<b>" + esc(step.label) + "</b>"
    + (step.sub ? "<small>" + esc(step.sub) + "</small>" : "") + "</span>")
    .join("<span class=\"flow-arrow\" aria-hidden=\"true\"></span>");
  return "<div class=\"flow-strip" + (className ? " " + className : "") + "\">" + cells + "</div>";
}

// 段のあるもの。**12段までは目盛りで、それ以上は帯で出す。**
// 目盛りが細くなりすぎると、何段目かが読めなくなる（読めない目盛りは飾りである）。
const METER_MAX_SEGMENTS = 12;

function segmentMeter(value, max, options = {}) {
  const total = Math.max(0, Math.round(max));
  const filled = Math.max(0, Math.min(total, Math.round(value)));
  const tone = options.tone ? " tone-" + esc(options.tone) : "";
  const label = options.label
    ? "<span class=\"meter-label\">" + esc(options.label) + "</span>"
    : "";
  if (total > METER_MAX_SEGMENTS || total <= 0) {
    const percent = total ? Math.round((filled / total) * 100) : 0;
    return "<div class=\"meter bar" + tone + "\">" + label
      + "<span class=\"meter-track\"><i style=\"width:" + percent + "%\"></i></span></div>";
  }
  const pips = Array.from({ length: total }, (_, index) => "<i class=\""
    + (index < filled ? "on" : "off")
    + (options.nextIndex === index ? " next" : "") + "\"></i>").join("");
  return "<div class=\"meter" + tone + "\">" + label
    + "<span class=\"meter-pips\">" + pips + "</span></div>";
}

// 内訳。**長さで比べられるようにする。**数字の列だけでは、どれが効いたか読めない。
function ledgerRows(rows) {
  const values = rows.map((row) => Math.abs(Number(row.value) || 0));
  const top = Math.max(1, ...values);
  return "<div class=\"ledger\">" + rows.map((row) => {
    const amount = Number(row.value) || 0;
    const percent = Math.round((Math.abs(amount) / top) * 100);
    return "<div class=\"ledger-row" + (amount ? "" : " empty") + "\">"
      + "<span class=\"ledger-label\">" + (row.glyph ? glyph(row.glyph) : "")
      + esc(row.label) + "</span>"
      + "<span class=\"ledger-bar\"><i style=\"width:" + percent + "%\"></i></span>"
      + "<b>" + esc(row.display ?? amount) + "</b></div>";
  }).join("") + "</div>";
}

// 残るもの／消えるもの。**同じ画面に両方を出す。**片方だけ書くと、
// 「書いていないほう」が起きたときに理由が読めない。
// content の中の **強調** を太字にする。**esc のあとに置き換える**
// （先に置き換えると、本文の < > がそのまま生きてしまう）。
// これが無かったあいだ、Stage の学びは画面に「**敵は……**」と星印のまま出ていた。
function emphasize(value) {
  return esc(value).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}

// 旧 learningNotes（区画の学びの覚え書き）は 2026-09-15 に撤去した。作者指摘
// 「札の読み方と、この区画で分かること、まるまる要らない」——押す前に読ませるものでは
// なかった。content 側の `learningGoals` は区画の定義として残してある。

// 遠征の形。**「3幕12戦。4・8・12戦目にボスが立つ」と書く代わりに、12戦を並べる。**
// 幕の切れ目・精鋭・ボスの位置は、印の形そのものが言う。
function expeditionShapeRail() {
  const steps = Array.from({ length: ENCOUNTERS_PER_RUN }, (_, offset) => {
    const step = offset + 1;
    const encounter = composeEncounter(step, state.run.difficulty, encounterOptions());
    return { step, kind: encounter.kind, act: encounter.act ?? Math.ceil(step / 4) };
  });
  const acts = [...new Set(steps.map((entry) => entry.act))];
  const kindLabels = { normal: "通常", elite: "精鋭", boss: "ボス" };
  return "<div class=\"act-rail\" role=\"list\" aria-label=\"" + ENCOUNTERS_PER_RUN + "戦の形\">"
    + acts.map((act) => "<span class=\"act-group\" role=\"listitem\"><b>第" + act + "幕</b>"
      + "<span class=\"act-nodes\">" + steps.filter((entry) => entry.act === act)
        .map((entry) => "<i class=\"act-node kind-" + entry.kind + "\" title=\"第" + entry.step
          + "戦・" + esc(kindLabels[entry.kind] ?? entry.kind) + "\"></i>").join("")
      + "</span></span>").join("")
    + "</div>"
    + "<div class=\"act-legend\">"
    + Object.entries(kindLabels).map(([kind, label]) =>
      "<span><i class=\"act-node kind-" + kind + "\"></i>" + esc(label) + "</span>").join("")
    + "</div>";
}

// 決着の印。**記号を一字大きく置くのではなく、図として置く。**
// 勝ち・退き・敗けで形そのものを変える（色だけの違いは、色が読めない画面で消える）。
const VERDICT_SIGILS = Object.freeze({
  win: "<circle cx='32' cy='32' r='23.5' class='sigil-ring'/>"
    + "<path d='M32 8.5 36.8 27.2 55.5 32 36.8 36.8 32 55.5 27.2 36.8 8.5 32 27.2 27.2Z' class='sigil-core'/>",
  retreat: "<circle cx='32' cy='32' r='23.5' class='sigil-ring'/>"
    + "<path d='M32 12.5 51.5 32 32 51.5 12.5 32Z' class='sigil-core'/>"
    + "<path d='M38.5 25.5 26 32l12.5 6.5' class='sigil-slash'/>",
  loss: "<circle cx='32' cy='32' r='23.5' class='sigil-ring'/>"
    + "<path d='M32 12.5 51.5 32 32 51.5 12.5 32Z' class='sigil-core'/>"
    + "<path d='M19.5 19.5 44.5 44.5' class='sigil-slash'/>",
});

function verdictSigil(kind) {
  const safe = Object.hasOwn(VERDICT_SIGILS, kind) ? kind : "loss";
  return "<svg class=\"verdict-sigil " + safe + "\" viewBox=\"0 0 64 64\" fill=\"none\""
    + " stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\""
    + " aria-hidden=\"true\" focusable=\"false\">" + VERDICT_SIGILS[safe] + "</svg>";
}

function splitColumns(keep, lose, options = {}) {
  const column = (items, kind, heading) => "<div class=\"split-col " + kind + "\">"
    + "<b>" + glyph(kind === "keep" ? "check" : "cross") + esc(heading) + "</b>"
    + "<ul>" + items.map((item) => "<li>" + esc(item) + "</li>").join("") + "</ul></div>";
  return "<div class=\"split-columns\">"
    + column(keep, "keep", options.keepLabel ?? "持ち帰る")
    + column(lose, "lose", options.loseLabel ?? "ここで消える")
    + "</div>";
}


// issue #159 — タブの数字は、そのタブを開かずに「まだやることがあるか」を出す。
// **選んでいる一人の残点では、他の四人が余らせていることが読めない。**
function totalSkillPoints() {
  return state.run.roster.reduce((total, id) => total + skillPointsFor(id), 0);
}

// 装備の分子は装着済みの総数、分母は**実際に埋められる数**——手元の総数と枠の総数の
// 小さいほうである。所持が足りなくても枠が足りなくても、埋めきれば X/X になる。
function equipmentFillLabel() {
  const worn = state.run.roster.reduce((total, id) =>
    total + (state.run.loadout.equipment?.[id] || []).length, 0);
  const slots = state.run.roster.length * 2;
  const owned = state.run.inventory.length;
  return worn + "/" + Math.max(worn, Math.min(owned, slots));
}

// 閉じ込めている間に他のタブを押したときの一行。**閉じ込め先ごとに一つだけ。**
const TUTORIAL_TAB_LOCK_NOTICE = Object.freeze({
  supplies: "補給チュートリアルを完了するまで、補給タブから移動できません。",
  skills: "技能チュートリアルを完了するまで、スキルタブから移動できません。",
  map: "隊列チュートリアルを完了するまで、遠征タブから移動できません。",
});

// チュートリアルが一枚のタブへ閉じ込めている間は、そのタブ id を返す。
// **閉じ込め方は二つあるが、閉じ込める書き方は一つにする**（補給と隊列で別々に書かない）。
function campTutorialTab() {
  if (supplyTutorialTabLocked()) return "supplies";
  if (formationTutorialLocked()) return "map";
  // 作者要望 2026-09-14 — 技能の取得・予約は技能タブの地図と操作盤で打つ。
  // **一手目（スキルタブを押す）と "done" では閉じ込めない**——前者はその一手が
  // 打てなくなり、後者は次の一押し（盤面の「実戦」）が打てなくなる。
  if (skillLessonTabLocked()) return "skills";
  // issue #240 — 必殺技は装着行を長押しして構えるので、その二手のあいだは技能タブに
  // 留める（三手目の「遠征タブを押す」は、留めたままでは打てない）。
  if (ultimateLessonTabLocked()) return "skills";
  return null;
}

function campNav() {
  const tutorialLocked = campTutorialTab();
  const activeTab = tutorialLocked ?? state.tab;
  // issue #235 — 編成タブは廃止した。隊列は上端の共通盤面が常に持ち、人物の中身は
  // スキル・装備タブの memberContext が出す。**説明を読むだけのタブを一枚残さない。**
  // 戦闘は「遠征」に改め、次の一戦・撤退・セーブという**遠征単位の操作**を集める。
  const tabs = [
    ["skills", "スキル", totalSkillPoints() + "pt"],
    ["equipment", "装備", equipmentFillLabel()],
    ["supplies", "補給", state.run.supplies + "/" + supplyTotal()],
    ["map", "遠征", state.run.encounterIndex + "/" + ENCOUNTERS_PER_RUN],
  ];
  return "<nav class=\"tabs\" aria-label=\"キャンプ画面\">" + tabs.map(([id, label, meta]) => {
    const active = activeTab === id;
    const locked = Boolean(tutorialLocked) && id !== tutorialLocked;
    // issue #237 — 札の中の数（技能点・装着・補給・進み）は、**このタブを開いていなくても
    // 変わる**。読み値に印を付けておけば、どのタブから触っても数のほうが光る。
    return "<button type=\"button\" class=\"tab " + (active ? "active" : "")
      + "\" aria-label=\"" + label + "\" aria-current=\"" + (active ? "step" : "false")
      + "\" data-action=\"tab\" data-tab=\"" + id + "\" data-fx=\"tab:" + id + "\""
      + (locked ? " disabled aria-disabled=\"true\"" : "") + "><b>" + label
      + "</b><small data-fx-watch=\"tab-meta:" + id + "\">" + meta + "</small></button>";
  }).join("") + "</nav>";
}

// ---------------------------------------------------------------- 反応（issue #237）
//
// **画面は毎回まるごと描き直す。**だから「いま何が変わったか」は DOM からは読めない
// ——描き直したあとの要素はどれも生まれたてで、前の姿を持っていない。ここは、その
// 一回の描き直しに**短い反応をひとつだけ載せる**ための仕組みである。
//
//   fx(key, kind)   離散な出来事。操作した本人が「次の描画ではここが光る」と申告する。
//                   印は `data-fx="<key>"`。同じ key の要素すべてに `fx-<kind>` が付く。
//   data-fx-watch   数の変化。読み値そのものに印を付けておくと、前の描画と文字列が
//                   違ったときだけ `fx-up` / `fx-down` / `fx-change` が付く。
//
// **数の側は申告が要らない。**装備を替えれば予測HPが動き、技能を取れば技能点が減る
// ——どの操作がどの数へ響くかを操作の側へ書き写すと、書き漏らした経路だけが黙る。
// 読み値に印を付けておけば、経路が増えても反応は勝手に追いつく。
//
// 守ること。
//   - 反応は**描き終わってから class を足すだけ**で、待ちも段も増やさない。
//   - 反応が出なくても、色・記号・数・ラベルで同じことが読める。
//   - 動きの時間と曲線は styles.css の `--fx-*` にだけ書く（ここには書かない）。
//   - 遠征が入れ替わったら読み値の記憶を捨てる。**別の遠征の数と比べない。**
const FX_UNKNOWN_DIRECTION = "change";
let pendingFx = new Map();
const readoutValues = new Map();
let fxRunId = null;
let lastRenderedTab = null;
let lastRenderedGuildTab = null;
let lastForecastSignature = null;

function fx(key, kind) {
  if (!key || !kind) return;
  pendingFx.set(String(key), String(kind));
}

function applyPendingFx() {
  if (!pendingFx.size) return;
  // **属性の値そのものを読んで突き合わせる。**`[data-fx="…"]` という選択子を組み立てると、
  // key に引用符が混ざった日（生成装備の id は外から来る）に選択子が壊れるか、
  // 黙って何も光らなくなる。印の付いた要素は一画面に数十個なので、素直に舐める。
  for (const element of app.querySelectorAll("[data-fx]")) {
    const kind = pendingFx.get(element.dataset.fx);
    if (kind) element.classList.add("fx-" + kind);
  }
  pendingFx.clear();
}

// 増えたのか減ったのか。**読み取れなければ「変わった」とだけ言う**（嘘の向きを出さない）。
function readoutDirection(before, after) {
  const firstNumber = (text) => {
    const match = String(text).match(/-?[0-9]+/);
    return match ? Number(match[0]) : null;
  };
  const from = firstNumber(before);
  const to = firstNumber(after);
  if (from === null || to === null || from === to) return FX_UNKNOWN_DIRECTION;
  return to > from ? "up" : "down";
}

// 作者指摘 2026-09-13 —「先見機は窓と数字が一瞬光るだけで、全く機械っぽさがない」。
// 先見機の窓の中だけは、数が**差し替わる瞬間そのもの**を見せる。ブラウン管の同期が
// 外れたときのように、前の値が横へ千切れて流れ、そのあとに新しい値が座る。
//
// 影に入れる文字は `readoutValues` が既に持っている（前の描画の読み値）ので、
// 新しく覚えるものは何も無い。**読み値そのものは最初から新しい値のまま**で、
// 差し替えを遅らせない——遅らせると、速く押した回に古い数が残る。
// 動きの時間と曲線は CSS が持ち、ここは影を一枚置いて animationend で捨てるだけ。
function hauntWithPreviousValue(element, before) {
  if (!before || !element.closest(".forecaster-window")) return;
  const ghost = document.createElement("span");
  ghost.className = "fx-ghost";
  // 読み上げには出さない。**古い値は、読む人にとっては嘘である。**
  ghost.setAttribute("aria-hidden", "true");
  ghost.textContent = before;
  ghost.addEventListener("animationend", () => ghost.remove(), { once: true });
  element.appendChild(ghost);
  // 誰の予測が動いたかは、枠そのものが一度ずれて言う。ただし**その枠が既に別の
  // 返事をしている回（選んだ・入れ替えた）は譲る**——一つの枠に二つは載せない。
  const cell = element.closest(".party-cell");
  if (cell && ![...cell.classList].some((name) => name.startsWith("fx-"))) cell.classList.add("fx-crt");
}

function pulseChangedReadouts() {
  const seen = new Set();
  for (const element of app.querySelectorAll("[data-fx-watch]")) {
    const key = element.dataset.fxWatch;
    if (!key) continue;
    seen.add(key);
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    const before = readoutValues.get(key);
    readoutValues.set(key, text);
    // 初めて出た読み値は光らせない。**画面へ来たことは変化ではない。**
    if (before === undefined || before === text) continue;
    element.classList.add("fx-" + readoutDirection(before, text));
    hauntWithPreviousValue(element, before);
  }
  // 画面から消えた読み値は忘れる。覚えたままだと、次に出たときへ
  // 「そのあいだに変わった」という嘘の反応が出る。
  for (const key of [...readoutValues.keys()]) {
    if (!seen.has(key)) readoutValues.delete(key);
  }
}

// 遠征が入れ替わったら、数の記憶ごと捨てる。新しい Game・ロード・次の遠征は
// 「変化」ではなく別の盤である。
function resetFxMemoryIfRunChanged() {
  const runId = state.run?.runId ?? null;
  if (runId === fxRunId) return;
  fxRunId = runId;
  readoutValues.clear();
  pendingFx.clear();
  lastForecastSignature = null;
}

// 予測は触るたびに計算し直される。**勝敗の文字が同じでも数は動く**（装備を替えて
// 終了HPだけが上がる回がある）ので、見張るのは窓に出ている文字ではなく予測そのもの。
// 一つでも動いた回だけ、窓が一度走査する（`.forecaster-window.fx-recalc`）。
function forecastSignature() {
  const forecast = state.phase === "camp" ? battleForecast() : null;
  if (!forecast) return null;
  return [forecast.result, forecast.roundsUsed]
    .concat((forecast.perCharacter ?? []).map((entry) =>
      entry.characterId + ":" + entry.startingHp + ":" + entry.endingHp + ":" + (entry.defeated ? "x" : "o")))
    .join("|");
}

// 描き終えた画面へ反応を載せる。**ここだけが class を足す。**
// タイトル・会話・巻き戻しは自前の入り方を持っているので、画面の立ち上がりを重ねない
// （タイトルの背景は position: fixed で、祖先を transform すると 1 拍ずれる）。
const FX_SELF_ENTERING_PHASES = new Set(["intro", "story", "rewind"]);

function applyRenderFeedback({ phaseChanged, tabChanged, guildTabChanged }) {
  const signature = forecastSignature();
  if (signature !== null && lastForecastSignature !== null && signature !== lastForecastSignature) {
    app.querySelector(".forecaster-window")?.classList.add("fx-recalc");
  }
  lastForecastSignature = signature;
  if (state.phase === "camp") {
    if (phaseChanged) app.querySelector(".camp-top")?.classList.add("fx-board-enter");
    if (phaseChanged || tabChanged) app.querySelector(".camp-view")?.classList.add("fx-view-enter");
  } else if (state.phase === "expeditionStart") {
    // 作者指摘 2026-09-15 —「アニメーションが全然ない」。ギルドはキャンプと同じ作りで、
    // **貼りついた上端は動かさず、札の中身だけが立ち上がる**（`.guild-view` の段は
    // styles.css が一枚ずつ遅らせる）。札を押しただけの回にも返事が出る。
    if (phaseChanged) app.querySelector(".guild-top")?.classList.add("fx-board-enter");
    if (phaseChanged || guildTabChanged) app.querySelector(".guild-view")?.classList.add("fx-view-enter");
  } else if (phaseChanged && !FX_SELF_ENTERING_PHASES.has(state.phase)) {
    app.querySelector(".shell")?.classList.add("fx-view-enter");
  }
  applyPendingFx();
  pulseChangedReadouts();
}

function render() {
  captureHelpDetails();
  stopReplayTimer();
  stopStoryTimers();
  stopRewindTimers();
  registerGeneratedEquipment(state.run?.generatedEquipment ?? {});
  const views = {
    intro: renderIntro,
    expeditionStart: renderExpeditionStart,
    saveMenu: renderSaveMenu,
    story: renderStory,
    rewind: renderRewind,
    camp: renderCamp,
    battle: renderBattle,
    battleError: renderBattleError,
    result: renderResult,
    defeat: renderDefeat,
    blueprintPick: renderBlueprintPick,
    settlement: renderSettlement,
    homestead: renderHomestead,
    complete: renderComplete,
  };
  const phaseChanged = state.phase !== lastRenderedPhase;
  const tabChanged = state.phase === "camp" && state.tab !== lastRenderedTab;
  const guildTabChanged = state.phase === "expeditionStart" && state.guildTab !== lastRenderedGuildTab;
  lastRenderedPhase = state.phase;
  lastRenderedTab = state.phase === "camp" ? state.tab : null;
  lastRenderedGuildTab = state.phase === "expeditionStart" ? state.guildTab : null;
  resetFxMemoryIfRunChanged();
  app.innerHTML = (views[state.phase] ?? renderIntro)();
  app.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", handleAction);
  });
  // issue #238 — 長押しは**画面をひとつも足さずに**もう一つの操作を作る。
  // 必殺技は「たまにしか触らないが、触る場所は装着行しかない」操作なので、
  // 常設の枠を出さず、行そのものを長く押させる（作者指摘 2026-09-12 以降は、
  // その長押し一回が「この一戦で使う／使わない」のトグルそのものである）。
  bindLongPress();
  // R11 §5 改 / issue #240 — チュートリアルの錠と光。**描画したあとに一度で掛ける。**
  applyTutorialGate();
  publishCampTopHeight();
  restoreHelpDetails();
  restoreSkillTreeScroll();
  layoutSkillTreeConnectors();
  focusSelectedSkillNode();
  // 作者要望 2026-09-14 — 光る先が画面の外なら、こちらから寄せる（段が変わった回だけ）。
  focusTutorialSpot();
  focusLaunchCard();
  if (state.phase === "battle") mountBattleView();
  if (state.phase === "story") mountStoryView();
  if (state.phase === "rewind") mountRewindView();
  // issue #237 — 反応は**測り終えて貼り終えたあと**に載せる。先に載せると、
  // publishCampTopHeight() が立ち上がり途中の高さを測ってしまう。
  applyRenderFeedback({ phaseChanged, tabChanged, guildTabChanged });
  if (phaseChanged) window.scrollTo(0, 0);
}


// ---------------------------------------------------------------- 長押し（issue #238）
//
// **押している時間だけで、二つ目の操作を作る。**指を離す前に離れたら取り消し、
// 動かしたら（＝スクロールだった）取り消す。iPhone の既定の選択・虫眼鏡は
// CSS（touch-action / user-select）で止めてある。
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 10;

function bindLongPress() {
  // 作者要望 2026-09-13 — 押しているあいだ、左から光の帯が伸びて右端で満ちる。
  // **長さの正本は JS のこの定数ひとつ**で、帯の速さも同じ値から描く（CSS 側へ
  // 書き写すと、ずれた日に「満ちたのに反応しない帯」ができる）。
  document.documentElement.style.setProperty("--long-press-ms", LONG_PRESS_MS + "ms");
  app.querySelectorAll("[data-longpress]").forEach((element) => {
    let timer = null;
    let origin = null;
    let pointerId = null;

    const releasePointerCapture = () => {
      const activePointerId = pointerId;
      pointerId = null;
      if (activePointerId === null || !element.hasPointerCapture?.(activePointerId)) return;
      try {
        element.releasePointerCapture(activePointerId);
      } catch {
        // pointerup と DOM の再描画が重なった場合は、捕捉解除済みとして扱う。
      }
    };

    const cancel = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      origin = null;
      releasePointerCapture();
      element.classList.remove("pressing");
    };

    element.addEventListener("pointerdown", (event) => {
      if (event.isPrimary === false) return;
      if (event.button !== undefined && event.button !== 0) return;

      // 行の中には、指定した必殺をこの一戦へ持ち込む ✹ や、技能のオン／オフ、
      // 並べ替えの釦がある。そこを押したときまで親行が pointer capture すると、
      // pointerup/click の宛先が親へ寄って、子の通常クリックを長押し経路が奪う。
      // 長押しは行の本文だけに掛け、行内の操作部品はその部品へ渡す。
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button, input, textarea, select, a, [data-action]")) return;

      cancel();
      origin = { x: event.clientX, y: event.clientY };
      pointerId = event.pointerId ?? null;
      element.classList.add("pressing");

      // iPhone / WebKit の長押し文字選択を、長押し判定と競合させない。
      // touch-action はスクロール方針を残しつつ、既定の選択は selectstart
      // と CSS 側でも止める。
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        event.preventDefault();
      }
      if (pointerId !== null && element.setPointerCapture) {
        try {
          element.setPointerCapture(pointerId);
        } catch {
          // 既にポインタが離れている場合は、通常のイベント経路で続ける。
        }
      }

      timer = setTimeout(() => {
        timer = null;
        origin = null;
        releasePointerCapture();
        // **満ちた帯は満ちたまま渡す。**帯が右端へ届いた拍と、必殺が入る拍を同じに
        // する（先に消すと、満ちる直前で切れたように見える）。行はこの直後の
        // 再描画で作り直されるので、外す `pressing` は届かない要素への後始末である。
        handleAction({ currentTarget: element, longPress: true });
        element.classList.remove("pressing");
      }, LONG_PRESS_MS);
    }, { passive: false });

    element.addEventListener("pointermove", (event) => {
      if (!origin || (pointerId !== null && event.pointerId !== pointerId)) return;
      if (Math.abs(event.clientX - origin.x) > LONG_PRESS_SLOP
        || Math.abs(event.clientY - origin.y) > LONG_PRESS_SLOP) cancel();
    });

    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      element.addEventListener(type, cancel);
    }

    // 長押しの途中で出る文字選択・ドラッグ選択・右クリックメニューを止める。
    element.addEventListener("selectstart", (event) => event.preventDefault());
    element.addEventListener("dragstart", (event) => event.preventDefault());
    element.addEventListener("contextmenu", (event) => event.preventDefault());
  });
}
/*
 * Safari の viewport / touch-action だけでは、ダブルタップ拡大が残ることがある。
 * ゲーム画面では拡大を操作として使わないので、OS固有のジェスチャーもここで止める。
 * 会話本文の長押し選択は維持し、ダブルタップだけを抑止する。
 */
const DOUBLE_TAP_ZOOM_WINDOW_MS = 350;

function bindBrowserGestureGuards() {
  let lastTouchEndAt = 0;
  let lastTouchTarget = null;
  const targetFor = (target) => {
    if (!(target instanceof Element)) return app;
    return target.closest("[data-action], button, select, textarea, input, .skill-tree-scroll") ?? app;
  };
  const preventGesture = (event) => event.preventDefault();

  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(type, preventGesture, { passive: false });
  }
  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener("touchend", (event) => {
    const now = performance.now();
    const target = targetFor(event.target);
    if (target === lastTouchTarget && now - lastTouchEndAt <= DOUBLE_TAP_ZOOM_WINDOW_MS) {
      event.preventDefault();
    }
    lastTouchEndAt = now;
    lastTouchTarget = target;
  }, { passive: false });
  document.addEventListener("dblclick", preventGesture, { passive: false });
}

// issue #236 — キャンプの固定帯の高さを CSS へ渡す。**その下へ貼りたいものが
// あるのに、CSS は貼りついた兄弟の高さを知らない。**技能ツリーの要約帯が
// `top: 8px`（＝画面の上端）で固定帯の上に乗り、盤面を隠していた。
// 帯の高さは回によって変わる（隊列を組み替えている間は一行増える）ので、
// 毎 render で測り直す。
function publishCampTopHeight() {
  const campTop = app.querySelector(".camp-top");
  const root = document.documentElement;
  if (!campTop) {
    root.style.removeProperty("--camp-top-h");
    return;
  }
  const height = Math.round(campTop.getBoundingClientRect().height);
  if (height > 0) root.style.setProperty("--camp-top-h", height + "px");
  // 作者要望 2026-09-14 — 手取りの札も固定帯の下へ貼りつく。**その下へ貼りたいもの
  // （技能点の要約帯）があるので、札の高さも同じように渡す。**札が無い回は 0。
  const note = app.querySelector(".camp-view > .tutorial-note-card.pinned");
  const noteHeight = note ? Math.round(note.getBoundingClientRect().height) + 6 : 0;
  root.style.setProperty("--tutorial-note-h", noteHeight + "px");
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
    ? "<p class=\"save-summary\"><span>オートセーブ</span>" + esc(continueLabel) + "</p>"
    : "";
  // **入口は二つ。**「つづきから」「はじめから」だけを同じ列に置く。
  //
  // 以前はここへ「ロードゲーム」を同じ強さで三つ目に並べていたが、二つの理由で浮いていた。
  // (1) 遊ぶたびに押すのは上の二つで、保存枠を選ぶのは稀にしかない操作である。
  //     同じ大きさ・同じ間隔で三つ並べると、その頻度の違いが画面から消える。
  // (2) 「つづきから」「はじめから」が言い回しなのに、一つだけ片仮名の名詞だった。
  // 保存枠は消さず、控えの一行の下へ小さな一行として置く。
  //
  // 金は「いま押す一つ」にだけ使う。控えが無いときは「つづきから」が押せないので、
  // 金は「はじめから」へ移す。
  return titleShell("One Battle Ahead", "", "<section class=\"title-screen\" aria-label=\"メインメニュー\">"
    + "<div class=\"title-rule\" aria-hidden=\"true\"></div>"
    + "<div class=\"title-actions\">"
    + button("つづきから", "continue-game", !auto, "title-entry" + (auto ? " lead" : ""))
    + button("はじめから", "new-game", false, "title-entry" + (auto ? "" : " lead"))
    + "</div>"
    + saveStatus
    + button("セーブデータを選ぶ", "open-save-menu", false, "title-link", "data-return=\"intro\"")
    + "</section>");
}
function renderSaveSlot(slot, snapshot, fromCamp) {
  const actions = fromCamp
    ? button(snapshot ? "上書き保存" : "この枠に保存", "save-slot", false, "tiny-button primary-mini", "data-slot=\"" + slot + "\"")
      + (snapshot ? button("読み込む", "load-slot", false, "tiny-button", "data-slot=\"" + slot + "\"") : "")
    : snapshot
      ? button("読み込む", "load-slot", false, "tiny-button primary-mini", "data-slot=\"" + slot + "\"")
      : "";
  return "<article class=\"save-slot " + (snapshot ? "" : "empty") + "\" data-fx=\"save-slot:" + slot
    + "\"><div><b>手動セーブ " + slot
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
    ? "<p class=\"save-notice fx-on\" role=\"status\">" + esc(state.saveNotice) + "</p>"
    : "";
  const returnAction = fromCamp ? "back-camp" : "back-title";
  const returnLabel = fromCamp ? "キャンプへ" : "タイトルへ";
  return shell(
    "<section class=\"card save-menu-card\">"
    // 見出しは、押してきた一行と同じ言葉にする（「ロードゲーム」という別名を作らない）。
    + sectionHeading("SAVE / LOAD", fromCamp ? "セーブ / ロード" : "セーブデータを選ぶ")
    + ruleGrid([
      { glyph: "retry", title: "オートセーブ", value: "最新の安全な状態", line: "遠征の節目ごとに上書きされます。" },
      { glyph: "book", title: "手動保存", value: MANUAL_SAVE_SLOTS + " 枠", line: "New Game のあとも残ります。" },
    ], "two")
    + "<article class=\"save-slot auto\"><div><b>オートセーブ</b><small>" + esc(auto ? saveSummary(auto) : "まだありません") + "</small></div><div class=\"save-slot-actions\">" + autoActions + "</div></article>"
    + "<div class=\"save-slot-list\">" + manual + "</div>"
    + notice
    + "<div class=\"save-menu-footer\">"
    + button(returnLabel, returnAction, false, "button quiet")
    + "</div></section>");
}

// ============================================================ 遠征を仕立てる
// ============================================================ 遠征を仕立てる（R6 §15.1）
//
// **遠征開始前に全部を表示する。**有効パック、全12戦の敵配置・能力・技能・狙い、開始補給。
// 先の幕も伏せない。技能を取る前に、先で必要になる組み方まで自力で読めるようにする。
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
  //
  // 作者指摘 2026-09-15 —「同じことが何度も書いてある」。旧版の札は同行者を名前で
  // 並べていたので、第2章の6枚は**同じ一行を6回**繰り返していた（全員が揃ったあとは
  // castCharacterIds が動かない）。名前は選んだ一枚ぶんだけ、下の「今回の遠征」が出す。
  // 札が持つのは、**札どうしで違う三つの数**だけにする——人数・初登場・語彙の数。
  const cleared = isCampaignStageCleared(state.profile, sequence);
  return "<button type=\"button\" class=\"difficulty-card " + (selected ? "selected" : "")
    + (cleared ? " cleared" : "")
    + "\" aria-pressed=\"" + (selected ? "true" : "false") + "\" data-action=\"select-campaign-stage\""
    + " data-sequence=\"" + sequence + "\" data-fx=\"stage:" + sequence + "\">"
    + "<b>" + esc(stage.displayName)
    + (cleared ? "<i class=\"stage-clear-mark\" title=\"踏破済み\">" + glyph("check") + "</i>" : "")
    + "</b><small>" + esc(stage.question) + "</small>"
    + "<span class=\"difficulty-meta\">"
    + "<span>" + glyph("person") + stage.partySize + "人</span>"
    // 新しい pack を足さない区画（Stage 6 は既出の6つで組む）では、この粒ごと出さない。
    // **空の記号を置かない**——中身の無い印は、何かを言い落としたように見える。
    + (newPack || stage.newPackId
      ? "<span>" + glyph("spark") + esc(newPack?.displayName ?? stage.newPackId) + "</span>"
      : "")
    + "<span>" + glyph("gear") + stage.activePackCount + "</span>"
    + "</span></button>";
}

// 選んだ区画へ誰と入るか。**名前は画面に一度だけ出す。**
// R12 §4.E-1 — まだ越えていない区画の同行者は名前を出さない（加入は会話が渡すもの）。
function stageCastStrip(sequence) {
  const stage = CAMPAIGN_STAGES[sequence];
  if (!stage) return "";
  const chips = isCampaignStageCleared(state.profile, sequence)
    ? stage.castCharacterIds.map((id) => "<span class=\"cast-chip\" style=\"--accent:"
      + esc(portraitAccent(id)) + "\"><i>" + esc(characterInfo(id)?.icon ?? "") + "</i>"
      + esc(characterName(id)) + "</span>").join("")
    : "<span class=\"cast-chip unknown\">" + glyph("person") + stage.partySize + "人で入る</span>"
      + (stage.joiningCharacterId
        ? "<span class=\"cast-chip unknown\">" + glyph("spark") + "新しい仲間が加わる</span>"
        : "");
  return "<div class=\"plan-stage\"><b>" + esc(stage.displayName) + "</b></div>"
    + "<div class=\"cast-strip\">" + chips + "</div>";
}

// ---------------------------------------------------------------- ギルドの札（作者指摘 2026-09-15）
//
// **札の並びは、遠征と遠征のあいだに人がたどる順そのものにする。**作者が数えた一番よくある
// 一回はこうである——①遠征が終わり、②根城の会話の続きを読み、（③図鑑を少し眺め）、
// ④資金を使い、⑤設計図を仕込み、⑥最新の区画へ出る。
//
// 旧版の並び（遠征・投資・設計図・根城・図鑑）はこの順の逆回りで、開く札が遠征だったので
// **最初と最後に同じ札を押す**ことになっていた。並びを順のとおりにすると、左から右へ一度
// なぞるだけで一回が終わる（同じ札を二度押す場面が無くなる）。
//
// **読み物と仕度も分ける。**根城と図鑑は「見る人は毎回見る、見ない人は一度も見ない」札で、
// 投資・設計図・遠征は毎回必ず通る札である。境目に縦線を一本入れて、左が読み物・右が
// 仕度だと形で分かるようにする。
//
// **札の数は、どれも「その中にいくつあるか」で揃える。**活動資金だけは札ではなく帯そのものが
// 持つ（どの札を開いていても同じ場所で読め、買った瞬間に減るのが見える）。
const GUILD_TABS = Object.freeze([
  { id: "homestead", label: "根城" },
  { id: "codex", label: "図鑑" },
  // ここから右が「毎回必ず通る仕度」。
  { id: "guild", label: "投資", groupStart: true },
  { id: "blueprints", label: "設計図" },
  { id: "expedition", label: "遠征" },
]);
const GUILD_TAB_IDS = Object.freeze(GUILD_TABS.map((tab) => tab.id));

// **帰ってきた人は読み物の端から、初めての人は出発から。**一度でも区画を越えていれば、
// 根城には前回の続きがある（`back-guild` はそこへ開く）。まだ一度も越えていない回は
// 根城も図鑑も空なので、出発の札で開く。
function defaultGuildTab(profile = state.profile) {
  return highestClearedStage(profile) >= 0 ? "homestead" : "expedition";
}

function guildTabMeta(id) {
  const archive = state.profile.blueprints ?? {};
  return {
    homestead: () => metCharacterIds().size + "人",
    codex: () => bestiaryEntries().length + "体",
    guild: () => "残り" + META_UPGRADES
      .filter((upgrade) => upgradeCost(state.profile, upgrade.id) !== null).length,
    blueprints: () => (archive.entries?.length ?? 0) + "件",
    expedition: () => ENCOUNTERS_PER_RUN + "戦",
  }[id]?.() ?? "";
}

// 貼りつく上端。**キャンプの `.camp-top` と同じ作り**で、活動資金と札を一つの塊にする。
function guildTop() {
  const tabs = "<nav class=\"tabs\" style=\"--tab-count:" + GUILD_TABS.length + "\""
    + " aria-label=\"ギルド画面\">"
    + GUILD_TABS.map((tab) => "<button type=\"button\" class=\"tab "
      + (state.guildTab === tab.id ? "active" : "") + (tab.groupStart ? " group-start" : "")
      + "\" aria-current=\"" + (state.guildTab === tab.id ? "step" : "false")
      + "\" data-action=\"guild-tab\" data-tab=\"" + tab.id + "\" data-fx=\"guild-tab:" + tab.id + "\">"
      + "<b>" + esc(tab.label) + "</b>"
      + "<small data-fx-watch=\"guild-tab-meta:" + tab.id + "\">"
      + esc(guildTabMeta(tab.id)) + "</small></button>").join("")
    + "</nav>";
  return "<div class=\"guild-top\">"
    + "<div class=\"guild-funds\">" + glyph("funds", "guild-funds-mark")
    + "<b data-fx-watch=\"funds\">" + formatFunds(funds()) + "</b>"
    + "<small>活動資金</small></div>"
    + tabs + "</div>";
}

// ギルドの仲間選び。**投資（鍛える相手）と名簿（読む相手）は同じ一人を指す。**
// 同じ人を選ぶ帯を二つ置くと、どちらが「いま見ている人」なのかが画面から読めなくなる
// （issue #236 でキャンプ側が通った道と同じ）。
function guildMemberStrip(characterId, label) {
  return "<div class=\"member-tabs\" aria-label=\"" + esc(label) + "\">"
    + metCharacterOptions().map((option) => "<button type=\"button\" class=\"member-tab "
      + (option.id === characterId ? "active" : "")
      + "\" aria-pressed=\"" + (option.id === characterId ? "true" : "false")
      + "\" data-action=\"select-guild-character\" data-character=\"" + option.id + "\""
      + " data-fx=\"guild-member:" + option.id + "\""
      + " style=\"--accent:" + esc(portraitAccent(option.id)) + "\">"
      // **帯は名前だけ。**役どころは名簿の見出し（役 · 年 · 出）が、その人の色は
      // 縁の一本が出している。図像の札まで並べると、5人目（ゲンゾウ）が iPhone 幅で
      // はみ出す——はみ出た一人は、無いのと同じである。
      + characterName(option.id) + "</button>").join("")
    + "</div>";
}

// 行き先を選び直した回だけ、出発の一枚をこちらから寄せる。**釦は選び直しの上にある**ので、
// 下で札を押した手は、そのままでは新しい行き先も釦も見られない（手取りの
// `focusTutorialSpot` と同じ考え方で、光る先が画面の外ならこちらから寄せる）。
let pendingLaunchFocus = false;

function focusLaunchCard() {
  if (!pendingLaunchFocus) return;
  pendingLaunchFocus = false;
  const card = app.querySelector(".launch-card");
  if (!card || card.getBoundingClientRect().top >= 0) return;
  const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
  // 出発の一枚は札の頭なので、頁ごと上端へ戻せば貼りついた帯の下に収まる。
  window.scrollTo({ top: 0, behavior });
}

// 遠征タブ。**この札の用は一つしかない——出ることである。**だから釦を先頭に置く。
//
// 作者指摘 2026-09-15（二度目）—「遠征に進むボタンがめっちゃ下にある」。旧版はこの札に
// 行き先の一覧・今回の遠征・全12戦の投影を積んでから、その下に釦を置いていた。
//
// 落としたものが三つある。
//   - **全12戦の投影**。ここで敵を検める用はほとんど無い（同じ盤はキャンプの遠征タブに
//     あり、出たあとで何度でも見られる）。
//   - **「今回の遠征」**。行き先の名前も同行者も、この札の頭が既に出している。
//   - **「札の読み方と、この区画で分かること」**。押す前に読ませるものではない。
//
// 行き先は既定で最新の解禁区画になっている。作者の見立てでは、新しい区画が開いた回は
// 99% それを選び、開かなかった回は 90% 前と同じ（＝同じく最新）を選ぶ。**既定のまま出る
// のが普通の一回**なので、選び直しは釦の下へ置き、選べる先が一つしか無い回は出さない。
function renderExpeditionPlan() {
  const manifest = state.run.manifest;
  const sequence = state.selectedCampaignStageSequence;
  const campaignStages = availableCampaignStages(state.profile);
  const packs = SKILL_PACKS.filter((pack) => manifest.enabledPackIds.includes(pack.id));
  const packRows = packs.map((pack) => "<div class=\"pack-row on\"><b>" + esc(pack.displayName)
    + "</b><small>" + esc(pack.summary) + "</small><span>"
    + ((manifest.packDepths ?? {})[pack.id] === "core" ? "入口" : "有効") + "</span></div>").join("");
  // 作者要望 2026-09-13 — 遠征の形は**文ではなく並び**で出す（REGION.summary の
  // 「3幕12戦。4・8・12戦目にボスが立つ」は、この帯そのものである）。
  const launch = "<section class=\"card launch-card\">" + sectionHeading("", "遠征へ出る")
    + stageCastStrip(sequence)
    + expeditionShapeRail()
    + button("この条件で遠征へ出る", "begin-expedition", false, "button primary")
    + helpDetails("run-packs", "この遠征で引ける技能パック " + packs.length,
      "<div class=\"pack-list\">" + packRows + "</div>")
    + "</section>";
  // 選べる先が一つしか無い回（第一部の入口）には、選び直しの節を出さない。
  const destination = campaignStages.length > 1
    ? "<section class=\"card\">" + sectionHeading("", "行き先を変える")
      + segmentMeter(campaignStages.length, MAX_CAMPAIGN_STAGE_SEQUENCE + 1,
        { label: "解禁 " + campaignStages.length + " / " + (MAX_CAMPAIGN_STAGE_SEQUENCE + 1) })
      + "<div class=\"difficulty-grid\">" + campaignStages.map(campaignStageCard).join("") + "</div>"
      + "</section>"
    : "";
  return launch + destination;
}

function renderExpeditionStart() {
  const note = state.migrationNote
    ? "<section class=\"card quiet\"><p class=\"muted\">" + esc(state.migrationNote) + "</p></section>"
    : "";
  const body = { guild: renderGuild, blueprints: renderBlueprints, homestead: homesteadBody, codex: renderBestiary }[state.guildTab]?.()
    ?? renderExpeditionPlan();
  const guildActions = "<section class=\"card quiet guild-actions\">"
    + button("タイトルへ", "back-title", false, "button quiet")
    + "</section>";
  // issue #237 — 札の中身は `.guild-view` にまとめる。**立ち上がりを掛けるのはここだけ**で、
  // 貼りついた上端（.guild-top）は動かさない（帯が毎回跳ねると押し先が動く）。
  return shell(guildTop() + "<div class=\"guild-view\">" + note + body + guildActions + "</div>");
}

// ---------------------------------------------------------------- ギルド投資（R6 §9.3）
//
// 作者要望 2026-09-13 — **投資の行から説明文を抜く。**行が答えるのは四つだけである：
// 何を買うか（記号と名）／いま何段目か（目盛り）／次の一段で何が変わるか（一語）／
// いくらか（数）。段が見えていれば「あと何回買えるか」を文で書く必要はない。
const UPGRADE_GLYPHS = Object.freeze({
  starting_supplies: "supply",
  starting_skill_points: "skill",
  blueprint_capacity: "blueprint",
  equipment_slot: "slots",
  camp_care: "camp",
  appraisal: "eye",
});

function purchaseRow(id, displayName, detail, cost, disabledReason, options = {}) {
  const affordable = cost !== null && funds() >= cost;
  const label = cost === null ? "購入済み" : formatFunds(cost);
  const meter = Number.isFinite(options.level) && Number.isFinite(options.maxLevel) && options.maxLevel > 0
    ? segmentMeter(options.level, options.maxLevel, {
      nextIndex: cost === null ? null : options.level,
      tone: cost === null ? "good" : null,
    })
    : "";
  return "<div class=\"purchase-row" + (cost === null ? " done" : "")
    + (affordable || cost === null ? "" : " short") + "\" data-fx=\"upgrade:" + esc(id) + "\">"
    + "<span class=\"purchase-mark\">" + glyph(options.glyph ?? "funds") + "</span>"
    + "<span class=\"purchase-copy\"><b>" + esc(displayName) + "</b>"
    + "<small>" + esc(detail) + "</small>" + meter + "</span>"
    + "<span class=\"purchase-buy\"><span class=\"purchase-cost\">" + esc(label) + "</span>"
    + (cost === null
      ? "<span class=\"purchase-done\">" + glyph("check") + "</span>"
      : button("買う", "purchase", !affordable || Boolean(disabledReason), "tiny-button primary-mini",
        "data-upgrade=\"" + esc(id) + "\"")) + "</span></div>";
}

// R23 — 鍛錬の一段でその能力がいくつになるか。**progression の式をここで綴り直さない**
// ように、detail が持つ base と段の効果から引く。
function trainedStatPreview(detail) {
  return Math.round(detail.base * (10_000 + TRAINING_STEP_BPS * (detail.level + 1)) / 10_000);
}

function renderGuild() {
  const characterId = guildCharacter();
  const stats = statsFor(characterId);
  const upgrades = META_UPGRADES.map((upgrade) => {
    const level = upgradeLevel(state.profile, upgrade.id);
    const cost = upgradeCost(state.profile, upgrade.id);
    // **段は目盛りが言う。**行の文は「次の一段で何が変わるか」だけにする。
    const detail = cost === null
      ? upgrade.describeLevel(level)
      : upgrade.describeLevel(level + 1);
    return purchaseRow(upgrade.id, upgrade.displayName, detail, cost, null, {
      glyph: UPGRADE_GLYPHS[upgrade.category] ?? "funds",
      level,
      maxLevel: upgrade.maxLevel,
    });
  }).join("");
  // 作者要望 2026-09-13 — 鍛錬の行は**数と目盛りだけで読めるようにする。**
  // 「次の一段で N になる」は矢印一本（現在 → 次）で済み、「上限まで鍛えた」は
  // 満ちた目盛りそのものが言う。文で言い直すのは、丸めで整数が動かない枠だけ。
  const trainingRows = Object.entries(stats.detail).map(([axis, detail]) => {
    const axisLabel = { might: "腕力", focus: "技術", guard: "受け", vitality: "体力" }[axis];
    const capped = detail.cost === null;
    const preview = capped ? null : trainedStatPreview(detail);
    const stalled = !capped && detail.nextVisibleLevel !== detail.level + 1;
    // R23 — 一段 +8% なので、ほとんどの枠は次の一段で整数が動く。
    // 動かない枠（base が小さいもの）だけを名指しする。
    const stallNote = !stalled
      ? ""
      : "<small class=\"train-stall\">" + esc(detail.nextVisibleLevel === null
        ? "上限まで鍛えても表示は変わらない"
        : "次に整数が増えるのは Lv" + detail.nextVisibleLevel) + "</small>";
    return "<div class=\"purchase-row train-row" + (capped ? " done" : "")
      + "\" data-fx=\"train:" + esc(characterId) + ":" + esc(axis) + "\">"
      + "<span class=\"purchase-mark\">" + glyph(axis === "might" ? "might"
        : axis === "focus" ? "focus"
          : axis === "guard" ? "guard" : "vitality") + "</span>"
      + "<span class=\"purchase-copy\"><b>" + esc(axisLabel)
      + "<span class=\"train-values\"><i>基礎 " + detail.base + "</i>"
      + "<em>" + detail.value + "</em>"
      + (preview !== null && preview > detail.value
        ? "<span class=\"train-next\">→ " + preview + "</span>"
        : "")
      + "</span></b>"
      + segmentMeter(detail.level, detail.maxLevel, {
        label: "Lv" + detail.level + "/" + detail.maxLevel,
        nextIndex: capped ? null : detail.level,
        tone: capped ? "good" : null,
      })
      + stallNote + "</span>"
      + "<span class=\"purchase-buy\"><span class=\"purchase-cost\">"
      + (capped ? "上限" : formatFunds(detail.cost)) + "</span>"
      + (capped
        ? "<span class=\"purchase-done\">" + glyph("check") + "</span>"
        : button("鍛える", "train", funds() < parseFunds(detail.cost), "tiny-button primary-mini",
          "data-character=\"" + characterId + "\" data-axis=\"" + axis + "\"")) + "</span></div>";
  }).join("");
  // **鍛錬の数は、式ではなく定数から引く。**画面へ写した数（旧「一段6%・上限72%」）は、
  // R23 で段の効きを変えた日に置き去りになった。ここでは TRAINING_STEP_BPS と
  // 段数そのものから出す。
  const stepPercent = (TRAINING_STEP_BPS / 100).toFixed(0);
  const trainMaxLevel = Object.values(stats.detail)[0]?.maxLevel ?? 12;
  const capPercent = ((TRAINING_STEP_BPS * trainMaxLevel) / 100).toFixed(0);
  const spent = Object.values(stats.detail).reduce((total, detail) => total + detail.level, 0);
  const spentMax = Object.values(stats.detail).length * trainMaxLevel;
  // 作者指摘 2026-09-15 — 活動資金は貼りついた上端（`guildTop`）が持つ。ここで出すと、
  // 同じ数が一画面に二度並ぶ。取り消せないことは**赤い一行**で足りる（旧版は段落つきの
  // 赤い札を、この画面へ入るたび毎回開いていた）。
  return "<section class=\"card\">" + sectionHeading("", "資金を使う")
    + "<p class=\"guild-caution\">" + glyph("lock") + "購入は取り消せません</p>"
    + "<div class=\"purchase-list\">" + upgrades + "</div>"
    + helpDetails("guild-rules", "投資のルール",
      ruleGrid([
        { glyph: "funds", title: "精算", value: "遠征の終わりに一度", line: "実入りは Stage が進むほど大きい（第一部の最後は最初の9倍）。" },
        { glyph: "gear", title: "常設の強化", value: "買い切り", line: "開始補給・初期SP・持込枠・目利き・装備枠・野営の手当て。" },
        { glyph: "might", title: "鍛錬", value: trainMaxLevel + "段 · 一段 +" + stepPercent + "%", line: "上限まで積むと基礎値 +" + capPercent + "%。仲間と能力ごとに別勘定。" },
        { glyph: "lock", title: "全部は積めない", value: "毎回選ぶ", line: "第一部を通して入る資金では、鍛錬は埋まらない。", tone: "bad" },
      ]))
    + "</section>"
    // **選んでいる相手は帯そのものが言う。**旧版は帯のすぐ下に「鍛える相手 ゴウ」という
    // 札を置いていたが、光っている帯の一つ隣で同じ名を言い直しているだけだった。
    // 残したのは帯が言えない数——隊全体でいま何段積んであるか——だけである。
    + "<section class=\"card\">" + sectionHeading("", "仲間を鍛える",
      "<span class=\"stage\">積んだ段 " + spent + " / " + spentMax + "</span>")
    + guildMemberStrip(characterId, "鍛える仲間を選ぶ")
    + "<div class=\"purchase-list\">" + trainingRows + "</div>"
    + helpDetails("training-rules", "鍛錬のルール",
      ruleGrid([
        { glyph: "up", title: "上がるもの", value: "基礎値だけ", line: "一段で +" + stepPercent + "%。丸めた表示が動かない段もある。", tone: "good" },
        { glyph: "lock", title: "上がらないもの", value: "行動権・装着数・発火回数", line: "鍛錬では増えません。", tone: "bad" },
      ]))
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
  // R23 — 名簿の最後の節は「隊が揃って一つ先まで行った」で開く。第一部が10 Stage に
  // なったので、ここに最終 Stage を渡すと Stage 9 まで開かなくなる。
  const options = { met: met.has(characterId), finalStageSequence: DOSSIER_FINAL_STAGE_SEQUENCE };
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
  // 作者要望 2026-09-13 — **どこまで開いたかは目盛りで出す。**残りの一行は、
  // 数の言い直しではなく世界の側の言い方なので、目盛りの下にそのまま残す。
  const sealedNote = sealed > 0
    ? "<div class=\"dossier-progress\">" + glyph("lock")
      + segmentMeter(open.length, DOSSIER_SECTIONS_TOTAL, {
        label: "書けた節 " + open.length + " / " + DOSSIER_SECTIONS_TOTAL,
      })
      + "</div>"
      + "<p class=\"dossier-sealed\">まだ書かれていない節が " + sealed
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

// 作者指摘 2026-09-15 —「テキストが多すぎる」。旧版はここで**会った全員の欄を同時に
// 開いていた**ので、根城のタブは実測 7,900px（iPhone の画面 12 枚ぶん）になり、
// 誰の話を読んでいるのかも分からなくなっていた。**一度に読むのは一人。**
// 選ぶ相手は投資タブの鍛錬と同じ一人で、帯も同じものを使う（選択を二つ持たない）。
function renderDossiers() {
  const met = metCharacterIds();
  const options = metCharacterOptions();
  if (!options.length) {
    return "<section class=\"card\">" + sectionHeading("", "隊の名簿")
      + "<p class=\"muted\">まだ誰の欄も書けていません。</p></section>";
  }
  const characterId = guildCharacter();
  return "<section class=\"card\">" + sectionHeading("", "隊の名簿")
    + "<p class=\"tab-note\">" + glyph("book")
    + "詰所へ出す申請の控え。何度も一緒に灰へ入るほど、書ける欄が増えます。</p>"
    + guildMemberStrip(characterId, "名簿を読む仲間を選ぶ")
    + (dossierCard(characterId, met) || "<p class=\"muted\">まだこの人の欄は書けていません。</p>")
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
  // **一度見た場面は読み返せる。**それは並んでいる釦そのものが言うので、
  // 「読み返せます」という一段を上に置き直さない。
  return "<section class=\"card\">" + sectionHeading("", "根城での場面",
      "<span class=\"stage\">" + seen.length + " 夜</span>")
    + "<div class=\"scene-list\">" + seen.map((entry) => "<button type=\"button\" class=\"scene-row\""
      + " data-action=\"replay-homestead\" data-scene=\"" + esc(entry.id) + "\"><b>"
      + esc(entry.beat.title) + "</b><small>" + esc(entry.beat.place) + "</small></button>").join("")
    + "</div></section>";
}

function homesteadBody() {
  const open = revealedFixtures(homesteadContext()).length;
  const pending = pendingHomesteadScene();
  // 人数は札が出している。ここが持てる数は**家にいくつあるか**のほうである。
  return "<section class=\"card\">" + sectionHeading("", "根城",
      "<span class=\"stage\">" + open + " 箇所</span>")
    + "<p class=\"tab-note\">" + glyph("home")
    + "灰の縁から外れた廃屋。拾ってきたもので増える。戦闘には影響しません。</p>"
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
  return shell(
    homesteadBody()
    + "<section class=\"card quiet\">"
    + button("ギルドへ", "back-guild", false, "button primary")
    + button("記録を送る", "complete", false, "button") + "</section>");
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
  // 作者要望 2026-09-13 — 見た数・倒した数は札で、書き足しまでの残りは目盛りで出す。
  return "<article class=\"codex-card\"><div class=\"codex-head\"><b>" + esc(info.label) + "</b>"
    + "<span class=\"codex-counts\"><span>" + glyph("eye") + "見た " + entry.seen + "</span>"
    + "<span>" + glyph("strike") + "倒した " + entry.defeated + "</span></span></div>"
    + "<p class=\"codex-targeting\">" + esc(info.targeting) + "</p>"
    + (entry.defeated > 0 && info.lore ? "<p class=\"enemy-lore\">" + esc(info.lore) + "</p>" : "")
    + codex.map((line) => "<p class=\"codex-line\">" + esc(line) + "</p>").join("")
    + (sealed
      ? "<div class=\"codex-seal\">" + glyph("lock")
        + segmentMeter(entry.defeated, CODEX_DEEP_THRESHOLD, {
          label: "あと " + (CODEX_DEEP_THRESHOLD - entry.defeated) + " 体倒すと書き足せる",
        })
        + "</div>"
      : "")
    + "</article>";
}

function renderBestiary() {
  const entries = bestiaryEntries();
  const deep = entries.filter((entry) => entry.defeated >= CODEX_DEEP_THRESHOLD).length;
  return "<section class=\"card\">" + sectionHeading("", "会った灰殻の記録",
      "<span class=\"stage\">書き足せた " + deep + "</span>")
    + "<p class=\"tab-note\">" + glyph("eye")
    + "詰所へ出す控えの写し。会ったことは、負けても取り消されません。</p>"
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

  // 絞り込みは**横一列の粒**にする。旧版は 8 個の釦が 2 列 5 段へ折り返して、
  // 設計図を 1 件も持っていない回でも画面の半分を占めていた。
  const rarityFilters = [["", "すべて"], ...[...RARITIES].reverse().map((rarity) => [rarity, RARITY_LABEL[rarity] ?? rarity])]
    .map(([value, label]) => "<button type=\"button\" class=\"tiny-button "
      + ((filter.rarity ?? "") === value ? "primary-mini" : "") + "\" data-action=\"blueprint-filter\" data-rarity=\""
      + value + "\" data-fx=\"blueprint-filter:" + esc(value || "all") + "\">" + esc(label) + "</button>").join("")
    + "<button type=\"button\" class=\"tiny-button " + (filter.favorite ? "primary-mini" : "")
    + "\" data-action=\"blueprint-filter\" data-favorite=\"toggle\""
    + " data-fx=\"blueprint-filter:favorite\">★ お気に入り</button>";

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

  // 持っている件数は札が出している。ここが持つのは**今回どれを持ち込むか**である。
  // 規則は畳む——設計図が 1 件も無い回に、4 段の規則だけが並ぶ画面になっていた。
  return "<section class=\"card\">" + sectionHeading("", "残した品の設計図",
      "<span class=\"stage\">持込 " + carried.length + " / " + capacity + "</span>")
    // **残せる数は定数から引く。**ここへ書き写した件数は、PR #255 で上限を
    // 変えた日に置き去りになり、実際の上限（勝利1・撤退0・敗北0）と食い違っていた。
    + helpDetails("blueprint-rules", "設計図のルール", ruleGrid([
      { glyph: "blueprint", title: "所持上限", value: "なし", line: "設計図そのものは何件でも残ります。", tone: "good" },
      { glyph: "supply", title: "持込枠", value: capacity + " 件", line: "遠征開始時に持ち込める数。ギルドで伸ばせます。" },
      {
        glyph: "check",
        title: "残せる数",
        value: "勝利 " + blueprintSaveLimitFor("won") + " · 撤退 " + blueprintSaveLimitFor("retreat")
          + " · 敗北 " + blueprintSaveLimitFor("lost"),
        line: "遠征の終わり方で決まります。",
      },
      { glyph: "gear", title: "持込品", value: "系統の外でも動く", line: "その遠征で選ばれた技能パックに関わらず、そのまま動きます。" },
    ]))
    + ((archive.entries ?? []).length ? "<div class=\"filter-chips\">" + rarityFilters + "</div>" : "")
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
    + "<div class=\"vn-log-body story-copy\">" + rows + "</div></div>";
}

// R11 §5 / 作者試遊 2026-09-11 — **「時間が巻き戻る」は物語の出来事である。**
//
// これまでは、倒れた会話のあとに結果画面（勝敗・損失・戦闘後の状態・履歴）を挟み、
// その主操作としてこの釦を置いていた。だが杭を引いて時間を戻すのはゴウがその場で
// やったことで、**システム画面の一項目にすると演出が死ぬ**（作者指摘「本来めっちゃ
// かっこいい演出なはずなので、こんなシステム画面の一部にしてほしくない」）。
//
// そこで、会話の最後の行を読み終えた拍で、**舞台に被せてど真ん中に一つだけ**釦を出す。
// ノベルゲームの選択肢と同じ置き方で、押すまで先へ進めない。**スキップも越えない**
// （storySkipStop が門まで飛ばして止める）。
//
// **序盤の一戦専用である。**通常の敗北は巻き戻らず、補給で再挑戦するか撤退する
// （作者判断 2026-09-11）。だから表は1件しかなく、増やす前提も持たない。
const STORY_GATES = Object.freeze({
  // **釦だけ。**「この一戦は遠征に数えません」は結果画面が言っていたが、ここで
  // 言い添えると、演出の真ん中にシステムの断り書きが立つ。そもそもこの拍の
  // プレイヤーは活動資金をまだ一度も見ていないので、読んでも意味が取れない。
  // 答えは次の会話（「もう一度、門の前」）が、時間が戻ったこと自体で返す。
  stage_0_prologue_defeat: Object.freeze({
    action: "rewind-prologue",
    label: "時間が巻き戻る",
  }),
});

// いま「進む」の代わりに一つの操作だけを差し出す拍か。**最後の行で、積んだ断片も
// 尽きているとき**にだけ門になる（途中の行で出すと、読み飛ばす釦になる）。
function storyGate() {
  const beat = currentStoryBeat();
  const gate = beat ? STORY_GATES[beat.id] : null;
  if (!gate) return null;
  if (storyLineIndex() < beat.lines.length - 1) return null;
  if ((state.story?.queue?.length ?? 1) > 1) return null;
  return gate;
}

// スキップの行き先。**門のある会話は、門まで飛ばす。**
//
// 作者試遊 2026-09-11（issue #200 の続き）— スキップは「読むのをやめる」操作であって、
// **決める拍まで飛ばすものではない。**門は押すまで越えられない拍（STORY_GATES）なので、
// スキップだけが越えられるのは筋が通らない。ついでに、飛ばした行も履歴へ積むので、
// 巻き戻しの逆走は**読み飛ばした行も含めて**材料にできる。
//
// 積んだ断片のどれかに門があれば、その断片とその後ろを残して、門の行（＝最後の行）で
// 止まる。門が無ければ null で、これまでどおり会話を丸ごと飛ばす。
function storySkipStop() {
  const queue = state.story?.queue ?? [];
  const gateIndex = queue.findIndex((beat) => Boolean(beat && STORY_GATES[beat.id]));
  if (gateIndex < 0) return null;
  return { gateIndex, beat: queue[gateIndex] };
}

// 門まで飛ばす。**飛ばした行は履歴へ積む**（読み返せるし、逆走もその行を使う）。
// いま読んでいる行は既に積まれているので、その次から積む。
function skipStoryToGate(stop) {
  const queue = state.story?.queue ?? [];
  for (let index = 0; index <= stop.gateIndex; index += 1) {
    const beat = queue[index];
    for (let line = index === 0 ? storyLineIndex() + 1 : 0; line < beat.lines.length; line += 1) {
      pushStoryLog(beat, line);
    }
  }
  const lineIndex = stop.beat.lines.length - 1;
  state.story = { ...state.story, queue: queue.slice(stop.gateIndex), lineIndex, logOpen: false };
  // **飛ばした人を文字送りで待たせない。**読み終えた行として描くので、門はすぐ出る
  // （CSS の `.vn.typed` が出す条件は mountStoryView の settle が満たす）。
  storyTypingDone = true;
  storyShownLine = stop.beat.id + ":" + lineIndex;
  record("story_skipped_to_gate", { beat: stop.beat.id });
  saveState();
  render();
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
  const gate = storyGate();
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
    + "<p class=\"vn-text story-copy\" aria-live=\"polite\" data-full=\"" + esc(line.text) + "\"></p>"
    + (gate ? "" : "<span class=\"vn-caret\" aria-hidden=\"true\">▼</span>")
    + "<span class=\"vn-progress\">" + (index + 1) + " / " + beat.lines.length
    + (remaining > 0 ? " · 続き " + remaining : "") + "</span>"
    + "</div>"
    // 文字送りが終わるまでは出さない（CSS の `.vn.typed` が出す）。最後の一行を
    // 読み終えた瞬間に、舞台の真ん中へ現れる。
    + (gate
      ? "<div class=\"vn-gate\"><div class=\"vn-gate-inner\">"
        + button(gate.label, gate.action, false, "button primary vn-gate-button")
        + "</div></div>"
      : "")
    + "</div>"
    + (lastLine && beat.footer ? "<p class=\"vn-note story-copy\">" + esc(beat.footer) + "</p>" : "")
    + controls
    + (gate ? "" : "<p class=\"hint vn-hint\">タップで進みます。</p>")
    + (state.story?.logOpen ? storyBacklog() : "")
    + "</section>";
  return shell(scene);
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
    // 門のある拍は AUTO でも越えない。**押して越える拍である。**
    if (state.story?.auto && !state.story?.logOpen && !storyGate()) {
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
//
// issue #200 — `via` は、積んだ会話の**手前に一度だけ挟む場面**の phase である
// （いまは巻き戻しの演出 `"rewind"` だけ）。会話はもう積み終わっているので、
// 挟んだ場面が終わったら phase を `"story"` へ移すだけで続きが始まる。
function enterStory(beats, after, { via = null } = {}) {
  const queue = beats.filter(Boolean);
  state.story = { queue, after, lineIndex: 0, auto: state.story?.auto === true, log: [], logOpen: false };
  if (!queue.length) {
    finishStory();
    return;
  }
  pushStoryLog(queue[0], 0);
  state.phase = via ?? "story";
  saveState();
  render();
}

function finishStory() {
  stopStoryTimers();
  const after = state.story?.after ?? "camp";
  // R11 §5 改 / 作者試遊 2026-09-11 — 倒れた会話のあとは、結果画面を挟まずにそのまま
  // 巻き戻る。**釦は会話の最後の拍に被さって出る**（STORY_GATES）。
  //
  // 作者試遊（issue #200 の続き）で、スキップも門で止まるようになった（storySkipStop）
  // ので、**通常の操作でここへ来る道は無い。**門のある拍を越える手段が釦だけになった
  // 残りの受け皿として置く（門が出ない形——queue に別の断片が続く保存など——で
  // 最後の行を越えたとき、巻き戻さずにキャンプへ落ちないようにする）。
  //
  // issue #200 — **この枝は、下の初期化より前に置く。**巻き戻しの演出は読んだ行を
  // 逆走させるので、`state.story.log` が生きているあいだに渡さなければならない
  // （rewindPrologue() は enterStory() で story を積み直すため、初期化を飛ばしてよい）。
  if (after === "prologueRewind") {
    rewindPrologue();
    return;
  }
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
  // R11 §5 改 — 二度目の勝利は、そのまま本編1戦目の勝利として扱う。
  //
  // PR #255 — **第1戦は通常戦なので、装備の候補は出ない。**以前は結果画面が
  // 報酬選択を兼ねていたので一枚挟んでいたが、選ぶものが無くなったため、会話の
  // あとはそのままキャンプへ戻る（`advanceAfterBattle` が prologueActive を落とし、
  // 技能点の付与と補給チュートリアルの提示もそこで揃う）。
  if (after === "prologueClear") {
    state.profile = {
      ...state.profile,
      storyFlags: [...new Set([...(state.profile.storyFlags ?? []), "prologue_seen"])],
    };
    record("prologue_cleared", { stage: state.run.campaignStageSequence });
    advanceAfterBattle();
    return;
  }
  state.phase = "camp";
  state.tab = "map";
  saveState();
  render();
}

// ============================================================ 巻き戻しの演出（issue #200）
//
// **「押した瞬間に次の会話」では、時間は巻き戻らない。**
//
// PR #248 で［時間が巻き戻る］を結果画面から会話の舞台へ移したが、押した先は普通の
// 会話遷移のままだった（作者試遊「いまは押した瞬間次の会話に遷移していて、巻き戻って
// いる感覚がないです」）。出来事としての巻き戻しは、**戻っていく過程そのものを
// 見せなければ**成立しない。
//
// そこで、押した拍では舞台をそのまま残し、**いま読んだ行を逆順に消していく。**
//
//   杭が鳴る … 舞台の下から一度だけ閃光（`.firing`）。このあいだは何も動かさない
//   逆走     … 読んだ行を後ろから消す。名前と立ち絵も、行と一緒に逆へ戻る
//   静止     … 逆走が尽きたら揺れも帯も止め（`.settled`）、白へ抜ける（`.out`）
//   会話へ   … 巻き戻し後の会話（「もう一度、門の前」）が始まる
//
// **台詞は一行も足さない。**逆走に使うのは `state.story.log`（実際に読んだ行）だけで、
// 読んでいない行は混ざらない。足せば、演出が新しい説明になる。
//
// **進行は止めない**（会話画面の約束と同じ）。舞台を叩けば演出を追い越せる。
// `prefers-reduced-motion` では揺れ・帯・閃光を止め、行を短く差し替えるだけにする。
//
// 状態はこの演出へ入る前に**もう巻き戻し済み**である（`rewindPrologue()` が巻き戻し、
// 巻き戻し後の会話まで積んでから phase を `"rewind"` にする）。だから途中でリロード
// しても会話から続き、演出だけが二度出ることはない（`persistableState()` が phase を
// `"story"` へ寄せる）。

// 逆走して見せる行数の上限。倒れた会話は3行なので普段は全部が入る。**長い断片で
// 逆走が長引かないための蓋**で、演出の長さを行数に任せない。
const REWIND_TRACK_LIMIT = 4;
const REWIND_FIRE_MS = 380;
// 一行が出てから消え始めるまでの間。**読んだ行だと気づくための一拍**で、
// これが無いと文字が消える動きだけが残る。
const REWIND_LINE_HOLD_MS = 150;
const REWIND_LINE_MS = 420;
const REWIND_UNTYPE_MS = 14;
const REWIND_LINE_GAP_MS = 90;
const REWIND_HOLD_MS = 280;
const REWIND_OUT_MS = 420;
// prefers-reduced-motion。逆走は残す（何が起きたか分からなくなる）が、文字を消す
// 動きも揺れも出さず、行を差し替えるだけにする。
const REWIND_REDUCED_STEP_MS = 200;

let rewindTimer = null;

function stopRewindTimers() {
  if (rewindTimer) clearTimeout(rewindTimer);
  rewindTimer = null;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

// 逆走に使う行。**いま読んだ履歴をそのまま逆順に使う。**
function rewindTrackFromLog() {
  return (state.story?.log ?? [])
    .slice(-REWIND_TRACK_LIMIT)
    .reverse()
    .filter((entry) => entry?.text)
    .map((entry) => ({ who: entry.who ?? null, speaker: entry.speaker ?? null, text: entry.text }));
}

// 逆走のあいだ凍らせておく舞台。**会話の最後の拍の続きに見えなければならない**ので、
// mood・場所・立ち絵は倒れた会話のものをそのまま使う。
function rewindScene(beat) {
  const track = rewindTrackFromLog();
  if (!beat || !track.length) return null;
  return { beat, track };
}

function renderRewind() {
  const beat = state.rewind?.beat;
  const track = state.rewind?.track ?? [];
  // 材料が無ければ、積んである会話をそのまま描く（mountRewindView が先へ送る）。
  if (!beat || !track.length) return renderStory();
  const index = beat.lines.length - 1;
  const figures = [...castOnStage(beat, index)]
    .sort((a, b) => (STORY_PLACEMENTS[a.at] ?? 1) - (STORY_PLACEMENTS[b.at] ?? 1))
    .map((entry) => storyFigure(beat, entry, index))
    .join("");
  const scene = "<section class=\"vn rewind\" data-mood=\"" + esc(beat.mood ?? "defeat") + "\">"
    // 叩けば追い越せる。舞台は button ではないので、Enter / Space は mount で拾う。
    + "<div class=\"vn-stage rewind-stage\" data-action=\"rewind-skip\" role=\"button\" tabindex=\"0\""
    + " aria-label=\"巻き戻しの演出を飛ばす\">"
    + "<div class=\"vn-sky\"></div><div class=\"vn-haze\"></div>"
    + "<div class=\"vn-place\"><b>" + esc(beat.title) + "</b>"
    + (beat.place ? "<span>" + esc(beat.place) + "</span>" : "") + "</div>"
    + "<div class=\"vn-figures\">" + figures + "</div>"
    + "<div class=\"rewind-bands\" aria-hidden=\"true\"></div>"
    + "<div class=\"rewind-streaks\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i></div>"
    + "<div class=\"rewind-veil\" aria-hidden=\"true\"></div>"
    + "<div class=\"rewind-mark\" aria-hidden=\"true\">◀◀</div>"
    + "<div class=\"vn-box narration rewind-box\">"
    + "<div class=\"vn-name rewind-name\" hidden></div>"
    // 逆走中の文字は読ませるものではない（一行ずつ消えていく）。読み上げは
    // `.rewind-status` の一言だけにする。
    + "<p class=\"vn-text rewind-text\" aria-hidden=\"true\"></p>"
    // 逆走の残り。通常の会話が「1 / 3」を出す位置に、**右から左へ減る帯**を置く
    // （進む帯ではなく、戻る帯である）。
    + "<div class=\"rewind-meter\" aria-hidden=\"true\"><span class=\"rewind-meter-fill\"></span></div>"
    + "</div>"
    + "<p class=\"rewind-status\" role=\"status\">時間が巻き戻る</p>"
    + "<div class=\"rewind-out\" aria-hidden=\"true\"></div>"
    + "</div></section>";
  return shell(scene);
}

// 逆走を進める。**表示は DOM 側で進める**（会話の文字送りと同じ理由で、一文字ごとに
// state を書き換えて保存を走らせない）。
function mountRewindView() {
  stopRewindTimers();
  const scene = app.querySelector(".vn.rewind");
  const stage = scene?.querySelector(".rewind-stage");
  const text = scene?.querySelector(".rewind-text");
  const track = state.rewind?.track ?? [];
  // 描けなかったら黙って先へ送る。**演出のために進行を止めない。**
  if (!scene || !stage || !text || !track.length) { finishRewind(); return; }
  const box = scene.querySelector(".rewind-box");
  const nameplate = scene.querySelector(".rewind-name");
  const meter = scene.querySelector(".rewind-meter-fill");
  const figures = [...scene.querySelectorAll(".vn-figure")];
  const reduced = prefersReducedMotion();
  stage.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
    event.preventDefault();
    event.currentTarget.click();
  });
  // 行が切り替わる拍で、舞台を一度だけ突かせる（テープが噛む感じ）。
  const jolt = () => {
    if (reduced) return;
    scene.classList.remove("jolt");
    void scene.offsetWidth;
    scene.classList.add("jolt");
  };
  const showRemaining = (remaining) => {
    if (meter) meter.style.width = Math.max(0, Math.round((remaining / track.length) * 100)) + "%";
  };
  // 行と一緒に、名前と立ち絵も逆へ戻す。**誰の行まで戻ったかが見えなければ、
  // ただのノイズになる。**
  const showEntry = (entry) => {
    box?.classList.toggle("narration", !entry.speaker);
    if (nameplate) {
      nameplate.textContent = entry.speaker ?? "";
      nameplate.hidden = !entry.speaker;
      nameplate.style.setProperty("--accent", portraitAccent(entry.who));
    }
    for (const figure of figures) {
      const speaking = Boolean(entry.who) && figure.dataset.character === entry.who;
      figure.classList.toggle("speaking", speaking);
      figure.classList.toggle("muted-figure", !speaking);
    }
  };
  // 逆走が尽きた拍。**誰も何も言っていない時点まで戻った**ので、名前も消す。
  const settle = () => {
    showRemaining(0);
    text.textContent = "";
    if (nameplate) { nameplate.textContent = ""; nameplate.hidden = true; }
    box?.classList.add("narration");
    stage.classList.add("settled");
    rewindTimer = setTimeout(() => {
      stage.classList.add("out");
      rewindTimer = setTimeout(() => { finishRewind(); }, reduced ? 120 : REWIND_OUT_MS);
    }, reduced ? 120 : REWIND_HOLD_MS);
  };
  const step = (cursor) => {
    if (state.phase !== "rewind") return;
    if (cursor >= track.length) { settle(); return; }
    const entry = track[cursor];
    showRemaining(track.length - cursor);
    showEntry(entry);
    text.textContent = entry.text;
    jolt();
    if (reduced) {
      rewindTimer = setTimeout(() => { step(cursor + 1); }, REWIND_REDUCED_STEP_MS);
      return;
    }
    // 一行を REWIND_LINE_MS で消しきる。**長い行でも待たせない。**
    const perTick = Math.max(1, Math.ceil((entry.text.length * REWIND_UNTYPE_MS) / REWIND_LINE_MS));
    let shown = entry.text.length;
    const untype = () => {
      if (state.phase !== "rewind") return;
      shown = Math.max(0, shown - perTick);
      text.textContent = entry.text.slice(0, shown);
      rewindTimer = shown > 0
        ? setTimeout(untype, REWIND_UNTYPE_MS)
        : setTimeout(() => { step(cursor + 1); }, REWIND_LINE_GAP_MS);
    };
    rewindTimer = setTimeout(untype, REWIND_LINE_HOLD_MS);
  };
  showRemaining(track.length);
  // 杭が鳴る一拍。**閃光のあいだは何も動かさない。**
  stage.classList.add("firing");
  rewindTimer = setTimeout(() => { step(0); }, reduced ? 120 : REWIND_FIRE_MS);
}

// 演出の終わり。**状態はもう巻き戻し済み**なので、積んである会話を開くだけである。
// 叩いて追い越したときも、流れきったときも、ここを通る。
function finishRewind() {
  stopRewindTimers();
  if (state.phase !== "rewind") return;
  state.rewind = null;
  state.phase = "story";
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
  // R23 — 第2章（Stage 4〜9）は誰も加入しないので `join` を持たない。
  // 代わりに `opening` があり、どちらも「その Stage へ入る一枚」である。
  return { beats: [storyBeat(stage.id, "join") ?? storyBeat(stage.id, "opening")], after: "camp" };
}

function renderCamp() {
  const activeTab = campTutorialTab() ?? state.tab;
  const view = {
    skills: renderSkills,
    equipment: renderEquipment,
    supplies: renderSupplies,
    map: renderMap,
  }[activeTab]?.() ?? renderMap();
  // R14 §1 / issue #159 — 盤面・予測・タブは一つの塊で上端に貼りつく。**どのタブで
  // 何を触っても、誰がどこにいて、HPがいくつ減るかが視界から出ない。**
  // issue #235 — 撤退とセーブは遠征タブが持つ。**固定される上端の外に、常設の
  // ボタンを一つも置かない**（実測で64px、iPhoneの第一画面の1割だった）。
  // issue #240 — 手取りの手引きは**どのタブでも同じ場所**に出す（構える行は技能タブ、
  // 挑む釦は盤面にあるので、片方のタブへ書くと段の途中で札が消える）。
  //
  // 作者要望 2026-09-14（デザイン面の改善）— 札は本文の頭のまま、**貼りつく**ようにした。
  // 技能チュートリアルの押し先（ツリーの節・操作盤の釦）は本文をかなり下まで送った
  // 先にあり、静かな札はそこへ着いた時点で画面の外にある。貼りつく札なら、送った
  // ぶんだけ帯の下へ回るので、**送らない回（隊列・補給）では高さを一つも食わない。**
  // 固定帯（.camp-top）そのものへ入れないのはこのためである。
  const tutorialNote = formationTutorialNote() + skillLessonNote()
    + supplyTutorialNote() + ultimateLessonNote();
  return shell(
    "<div class=\"camp-top\">" + partyBar(activeTab) + campNav() + "</div>"
    // PR #255 — 直前の一戦の一行は本文の頭に出す。戻った先のタブは場面によって
    // 変わる（補給チュートリアル中は補給タブに錠が掛かる）ので、遠征タブだけに
    // 書くと「さっき何が起きたか」が読めない回ができる。
    // issue #237 — タブの中身は `.camp-view` にまとめる。**立ち上がりを掛けるのはここだけ**で、
    // 上端の盤面（.camp-top）は動かさない（貼りついた盤が毎回跳ねると押し先が動く）。
    + "<div class=\"camp-view\">"
    + tutorialNote + view
    + "</div>");
}

// R6 §15.2 — base 値・永続鍛錬・run 内補正を分けて表示する。
// **鍛錬が乗っている stat だけに印を付ける。**印が無い＝地のままと読める。
function trainedMark(stats, axis) {
  const detail = stats?.detail?.[axis];
  if (!detail || detail.level === 0) return "";
  return "<i class=\"trained\" title=\"基礎 " + detail.base + " · 鍛錬 Lv" + detail.level + "\">＋</i>";
}

// issue #236 — 能力値は**どの画面でも同じ4軸・同じ並び・同じ形**で出す。編成タブが
// 持っていた表と、仲間カードの一行が別々の書き方だったのをここへ寄せる。
// 数字だけを大きく、軸名は小さく。鍛錬が乗っている軸にだけ ＋ が付く。
const STAT_AXES = Object.freeze([
  ["腕力", "might"],
  ["技術", "focus"],
  ["受け", "guard"],
]);

function statAxesHtml(characterId, { live = false } = {}) {
  const stats = statsFor(characterId);
  const hp = live
    ? currentHp(characterId) + "<small>/" + stats.stats.maxHp + "</small>"
    : String(stats.stats.maxHp);
  const axes = STAT_AXES.map(([label, axis]) =>
    "<span><small>" + esc(label) + "</small><b>" + stats.stats[axis] + trainedMark(stats, axis) + "</b></span>");
  return "<span><small>HP</small><b>" + hp + trainedMark(stats, "vitality") + "</b></span>" + axes.join("");
}

const SLOT_KEYS = { active: "tactics", reactive: "reactives", passive: "passives" };
// **見出しは名前だけ。**「順番」「いつでも効く」は、行の番号と目盛りが出している。
const SLOT_TITLES = {
  active: "アクティブ",
  reactive: "リアクティブ",
  passive: "パッシブ",
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
    ruleGrid([{ glyph: "up", title: "「守勢を1つ」", value: "＝ 1段つける", line: "技能の説明の数え方は、ここの段のことです。", tone: "quiet" }])
    + "<div class=\"glossary\">" + rows + "</div>"
    + "<h3 class=\"legend-heading\">状態ではない守り</h3>"
    + ruleGrid([
      { glyph: "guard", title: "防壁", value: "総量を吸う" },
      { glyph: "guard", title: "受け構え", value: "一撃を回数で無効にする" },
      { glyph: "guard", title: "受け", value: "一撃ごとの固定軽減" },
    ]));
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

// ============================================================ 記号の語彙（issue #177）
//
// **通常のゲームシステムは、文章ではなく形と色で見せる。**文字を読ませてよいのは
// 物語と技能の説明文だけで、「いくつ払うか」「何回に一度出るか」「誰の手で伸びるか」は
// 一目で分かる形にする（作者方針、2026-09-09）。
//
// 語彙は四つしかない。
//
//   ● ピップ  … 数えるもの（AP・RP・HPの代償・レベル）
//   ▬ バー    … 量。**同じ画面の中で長さを比べられる**（誰の手で何が出るか）
//   ◔ 割      … 順番。装着した本数のうち、この一本がどれだけ出番を持つか
//   色        … テーマ（攻撃・守り・支援・指揮・基礎）と、能力値（腕力・技術・受け）
//
// 意味の対応表は畳んだヘルプに一度だけ置く（`symbolLegendHelp`）。**節の上には出さない。**

const BRANCH_KEYS = { "攻撃": "strike", "守り": "guard", "支援": "care", "指揮": "order", "基礎": "base" };
const STAT_MARKS = { might: "腕", focus: "技", guard: "受", max_hp: "HP" };

// 反応の起点の言葉は content 側の正本（TRIGGER_LABELS）を引く。二重に書かない。
function triggerLabelOf(listenTo) {
  return TRIGGER_LABELS[listenTo] ?? listenTo ?? "";
}
const STAT_LABELS = { might: "腕力", focus: "技術", guard: "受け", max_hp: "最大HP" };
// **丸は「払うもの」だけに使う。**行動点・反応点・代償のHPの三つ以外へ丸を出さない
// （同じ形が別の意味を持つと、見分けが付かなくなる。作者指摘 2026-09-09）。
function pips(count, cls, cap = 6) {
  if (!count) return "";
  const shown = Math.min(count, cap);
  return "<span class=\"pips " + cls + "\" aria-hidden=\"true\">"
    + "<i></i>".repeat(shown) + (count > cap ? "<b>+" + (count - cap) + "</b>" : "") + "</span>";
}

// 消費。**AP は金の点、RP は紫の点、代償の HP は赤い点。**数はそのまま点の数。
function costPips(node) {
  const definition = skillDefinitionOf(node.skillId);
  if (!definition) return "";
  if (node.kind === "active") {
    const ap = definition.apCost ?? 0;
    return pips(ap, "ap") || "<span class=\"pips free\" aria-hidden=\"true\"><i></i></span>";
  }
  if (node.kind === "reactive") {
    const costs = definition.rule?.costs ?? [];
    const rp = costs.find((cost) => cost.type === "spend_reaction_points")?.amount ?? 0;
    const hp = costs.find((cost) => cost.type === "lose_hp")?.amount ?? 0;
    return pips(rp, "rp") + (hp ? "<span class=\"pips hp\" aria-hidden=\"true\"><i></i></span>" : "");
  }
  return "";
}

// ---------------------------------------------------------------- 発動条件（issue #177）
//
// **丸は消費だけに譲る。**「条件つきかどうか」を白抜きの丸で出していたが、
// 同じ丸が行動点・反応点・代償HP・条件・取得状態を別々の意味で表していて、
// 見分けが付かなかった（作者指摘、2026-09-09）。条件は**技能名の下に短い薄字**で書く。
// ありなしだけでは解像度が低い——「いつ出るのか」はこの一行の値打ちがある。
const ROW_WORDS = { front: "前列", rear: "後列" };
const SCOPE_WORDS = { enemies: "敵", allies: "味方", self: "自分" };
const COUNT_WORDS = { enemies: "体", allies: "人" };

function filterWords(filters = []) {
  const words = [];
  for (const filter of filters) {
    if (filter.type === "alive") continue;
    if (filter.type === "row_is") words.push(ROW_WORDS[filter.row] ?? "");
    else if (filter.type === "hp_percent") {
      words.push("HP" + filter.value + "%" + (filter.op === "lte" ? "以下の" : "以上の"));
    } else if (filter.type === "has_status") {
      const name = STATUS_GLOSSARY.find((entry) => entry.id === filter.statusId)?.displayName
        ?? filter.statusId;
      const none = filter.op === "eq" && (filter.value ?? 0) === 0;
      words.push(none ? name + "のついていない" : name + "のついた");
    } else if (filter.type === "is_preparing") words.push(filter.value === false ? "溜めていない" : "溜めている");
    else if (filter.type === "not_self") words.push("自分以外の");
  }
  return words.join("");
}

function targetExistsText(predicate) {
  const query = predicate.query ?? {};
  const scope = SCOPE_WORDS[query.scope] ?? "";
  const count = Number(predicate.value ?? 1);
  const unit = COUNT_WORDS[query.scope] ?? "つ";
  const many = count > 1 ? count + unit + "以上" : "";
  return filterWords(query.filters) + scope + (many ? "が" + many : "が") + "いるとき";
}

function predicateText(predicate) {
  switch (predicate.type) {
    case "target_exists": return targetExistsText(predicate);
    case "hp_percent":
      return "自分のHPが" + predicate.value + "%" + (predicate.op === "lte" ? "以下のとき" : "以上のとき");
    case "round_number":
      return predicate.op === "eq" ? predicate.value + "ラウンド目だけ" : predicate.value + "ラウンド目まで";
    case "has_status": {
      const name = STATUS_GLOSSARY.find((entry) => entry.id === predicate.statusId)?.displayName
        ?? predicate.statusId;
      return (predicate.value ?? 0) === 0 ? name + "がついていないとき" : name + "がついているとき";
    }
    case "position": return "自分が" + (ROW_WORDS[predicate.row] ?? "") + "のとき";
    case "history_count":
      if (predicate.metric === "same_target_streak") {
        return predicate.op === "lte" ? "同じ相手を続けて狙っていないとき" : "同じ相手を続けて狙ったとき";
      }
      if (predicate.metric === "damage_taken") return "そのラウンドに被弾していないとき";
      return "";
    default: return "";
  }
}

// 節に出す一行。**空なら条件が無い**（「無条件」とわざわざ書かない）。
function conditionText(node) {
  const definition = skillDefinitionOf(node.skillId);
  if (!definition) return "";
  if (node.kind === "reactive") return triggerLabelOf(definition.rule?.listenTo);
  if (node.kind === "passive") return "";
  const parts = (definition.intrinsicPredicates ?? []).map(predicateText).filter(Boolean);
  if (!parts.length) {
    // 発動条件が無くても、対象が絞られていれば「誰へ出るのか」は条件である。
    const target = filterWords(definition.targetQuery?.filters);
    const scope = SCOPE_WORDS[definition.targetQuery?.scope] ?? "";
    if (target) return target + scope + "へ";
  }
  return parts.join(" / ");
}

function conditionLine(node) {
  const text = conditionText(node);
  if (!text) return "";
  return "<small class=\"node-when\" title=\"" + esc(text) + "\">" + esc(text) + "</small>";
}

function costLabel(node) {
  const definition = skillDefinitionOf(node.skillId);
  if (!definition) return "";
  if (node.kind === "active") return "行動点" + (definition.apCost ?? 0);
  if (node.kind === "reactive") {
    const costs = definition.rule?.costs ?? [];
    const rp = costs.find((cost) => cost.type === "spend_reaction_points")?.amount ?? 0;
    const hp = costs.find((cost) => cost.type === "lose_hp")?.amount ?? 0;
    return "反応点" + rp + (hp ? "・HP" + hp : "");
  }
  return "常時";
}

// レベル。**素直に文字で書く。**ほとんどの節が Lv1 なので、目盛りにすると
// 「1個だけ塗った10個の四角」が並んで、かえって読めなかった（作者指摘）。
// 上限は添え字にして、いまの段を主にする。
function levelMeter(node, characterId) {
  const cap = skillLevelCapOf(node.skillId);
  if (cap <= 1) return "";
  const level = skillLevelOf(characterId, node.skillId);
  if (!level) return "";
  return "<span class=\"level-tag" + (level >= cap ? " maxed" : "") + "\" title=\"レベル "
    + level + " / " + cap + "\">Lv" + level + "<small>/" + cap + "</small></span>";
}

// **技能が持つ効果量。**能力値を掛ける前の係数を出す。
// ゴウ（腕力50・技術6）で見ても「技術が低いから技術技能が弱い」という答えを
// 画面から先に決めず、技能そのものの強さと、人物の能力値を別々に読めるようにする。
function skillEffectAmount(characterId, skillId) {
  const definition = skillDefinitionOf(skillId);
  const effect = leveledEffectOf(definition);
  const amount = effect?.amount;
  if (!amount || amount.type !== "stat_scaled") return null;
  const stat = amount.scalingStat;
  if (!STAT_LABELS[stat] || !STAT_MARKS[stat]) return null;
  const level = Math.max(MIN_SKILL_LEVEL, skillLevelOf(characterId, skillId));
  const one = skillTextAtLevel("{amount}", definition, level);
  if (!one) return null;
  const kind = effect.type === "heal" ? "heal" : effect.type === "gain_barrier" ? "barrier" : "damage";
  return { stat, kind, one, hits: effect.hitCount ?? 1 };
}

// **量は数で出す。**能力値との掛け算後の実数ではなく、技能の係数を表示する。
// 印（腕・技・受・HP）と単位付きの効果量を並べ、人物ごとの能力値による差は
// プレイヤーが自分で判断できるようにする。
function yieldBar(characterId, skillId) {
  const effect = skillEffectAmount(characterId, skillId);
  if (!effect) return "";
  const label = STAT_LABELS[effect.stat] + "で伸びる · 効果 "
    + effect.one + (effect.hits > 1 ? "（" + effect.one + "×" + effect.hits + "）" : "");
  return "<span class=\"yield-chip stat-" + effect.stat + " yield-" + effect.kind + "\" role=\"img\""
    + " aria-label=\"" + esc(label) + "\" title=\"" + esc(label) + "\">"
    + "<i>" + STAT_MARKS[effect.stat] + "</i>" + esc(effect.one)
    + (effect.hits > 1 ? "<small>×" + effect.hits + "</small>" : "") + "</span>";
}

// この技能を取得できるようになるまでに、**いまの人物が追加で取るべき他技能の
// Lv 数**。取得済みの前提は差し引くので、すでに解禁できる技能は 0 になる。
function prerequisiteLevelsFor(node, characterId) {
  return remainingPrerequisiteLevels(
    node,
    SKILL_TREE_NODES,
    (skillId) => skillLevelOf(characterId, skillId),
  );
}

// 取得の状態。**文字を出さない。**まだ持っていない節は、前提の残りLv数と取得コストを
// 形の違う四角で分ける。
//
// issue #236 — 持っている節の印は**一つだけ**になった。「取得済みだが未装着」を
// 廃止したので、□✓（取得済み・未装着）と ■✓（装着中）を分ける必要が無い。
// 残る違いはオン／オフだけで、それは同じ印の濃さで出す。
function nodeStateMark(node, nodeState, characterId) {
  const reservation = nodeState.reserved
    ? "<span class=\"node-reservation-mark\" role=\"img\" aria-label=\"取得予約中\" title=\"取得予約中\">◎</span>"
    : "";
  let mark;
  if (nodeState.unlocked) {
    const label = nodeState.disabled ? "取得済み・オフ" : "取得済み";
    mark = "<span class=\"node-mark equipped" + (nodeState.disabled ? " off" : "") + "\" role=\"img\""
      + " aria-label=\"" + label + "\" title=\"" + label + "\">✓</span>";
  } else {
    const affordable = nodeState.prereqsMet && skillPointsFor(characterId) >= node.cost;
    const title = nodeState.prereqsMet
      ? (affordable ? "解禁できる（技能点" + node.cost + "）" : "技能点が足りない（必要" + node.cost + "）")
      : "前提がまだ（技能点" + node.cost + "）";
    const prerequisiteLevels = prerequisiteLevelsFor(node, characterId);
    const chainLabel = node.requires?.length
      ? "取得までに必要な他技能の残りLv" + prerequisiteLevels + " + 取得コスト" + node.cost + "点"
      : "取得コスト" + node.cost + "点";
    const acquisition = "<span class=\"node-mark cost acquisition-cost" + (affordable ? " ready" : "")
      + (nodeState.prereqsMet ? "" : " gated") + "\" aria-hidden=\"true\">" + node.cost + "</span>";
    const prerequisite = node.requires?.length
      ? "<span class=\"node-mark prerequisite-levels\" aria-hidden=\"true\">" + prerequisiteLevels + "</span>"
        + "<span class=\"cost-plus\" aria-hidden=\"true\">+</span>"
      : "";
    mark = "<span class=\"node-cost-chain\" role=\"img\" aria-label=\"" + esc(title + "。" + chainLabel) + "\""
      + " title=\"" + esc(chainLabel) + "\">" + prerequisite + acquisition + "</span>";
  }
  return "<span class=\"node-state-marks\">" + reservation + mark + "</span>";
}

// 入切の摘み。**装着行と技能ツリーの操作盤は同じ形を共有する。**同じ操作に二つの
// 見た目を持たせない（作者指摘 2026-09-13 — 盤の「オンにする／オフにする」の釦と
// 「取得状態は変わりません」の一行は、この摘みが形で言っていることの重複だった）。
function skillToggleSwitch(characterId, skillId, kind, disabled) {
  return "<button type=\"button\" class=\"skill-switch" + (disabled ? " off" : " on")
    + "\" data-action=\"toggle-skill\" data-character=\"" + characterId + "\" data-skill=\""
    + skillId + "\" data-kind=\"" + kind + "\" role=\"switch\" aria-checked=\""
    + (disabled ? "false" : "true") + "\" aria-label=\"" + (disabled ? "オンにする" : "オフにする")
    + "\" title=\"" + (disabled ? "いまオフ · 押すとオンになる" : "いま有効 · 押すとオフになる")
    + "\"><i></i></button>";
}

function skillSlotRows(characterId, kind) {
  const key = SLOT_KEYS[kind];
  const list = state.run.loadout[key]?.[characterId] || [];
  const title = SLOT_TITLES[kind];
  const definition = PLAYABLE_CONTENT.characters[characterId] ?? {};
  // **一人が1ラウンドに払える点。**装着した技能の合計と並べて見せる。
  const budget = kind === "active" ? (definition.baseActionPoints ?? 0)
    : kind === "reactive" ? (definition.baseReactionPoints ?? 0) : 0;
  const live = list.filter((skillId) => !skillDisabled(characterId, skillId));
  // 順送りなので、有効な本数のうち一本ぶんが出番になる（issue #187 / #230）。
  const turns = live.length;
  let spent = 0;
  const rows = list.map((skillId, index) => {
    const info = COMPONENTS[skillId];
    const node = SKILL_TREE_NODES.find((entry) => entry.skillId === skillId);
    const disabled = skillDisabled(characterId, skillId);
    const moveButtons = kind === "active" || kind === "reactive"
      ? "<span class=\"reorder\">" + button("↑", "move-skill", index === 0, "icon-button", "data-character=\"" + characterId + "\" data-kind=\"" + kind + "\" data-index=\"" + index + "\" data-direction=\"-1\"")
        + button("↓", "move-skill", index === list.length - 1, "icon-button", "data-character=\"" + characterId + "\" data-kind=\"" + kind + "\" data-index=\"" + index + "\" data-direction=\"1\"") + "</span>"
      : "";
    // **出番。**順送りの何本目か、を目盛りで出す。文字で「1/3」と書かない。
    const liveIndex = disabled ? -1 : live.indexOf(skillId);
    const share = kind === "active" && turns > 1 && liveIndex >= 0
      ? "<span class=\"turn-share\" role=\"img\" aria-label=\"装着 " + turns + "本のうちの1本（およそ"
        + turns + "ラウンドに1回）\" title=\"装着 " + turns + "本のうちの1本（およそ" + turns + "ラウンドに1回）\">"
        + Array.from({ length: turns }, (unused, slot) =>
          "<i class=\"" + (slot === liveIndex ? "on" : "") + "\"></i>").join("") + "</span>"
      : "";
    // **反応点の収支。**上の行から順に払うので、点が尽きた行は同じラウンドで出せない。
    let overflow = "";
    if (kind === "reactive" && node && !disabled) {
      const costs = skillDefinitionOf(skillId)?.rule?.costs ?? [];
      const rp = costs.find((cost) => cost.type === "spend_reaction_points")?.amount ?? 0;
      spent += rp;
      if (spent > budget) overflow = " over";
    }
    const marks = node
      ? "<span class=\"row-marks\">" + costPips(node) + yieldBar(characterId, skillId)
        + levelMeter(node, characterId) + "</span>" + conditionLine(node)
      : "";
    // issue #238 — 必殺技はこの行の**長押し**だけで決まる。専用の枠を画面へ足さない。
    const ultimate = ultimateRowState(characterId, skillId, kind);
    return "<div class=\"installed-row" + (disabled ? " disabled" : "") + overflow
      + (ultimate.designated ? " ultimate" : "") + (ultimate.armed ? " armed" : "")
      + (ultimate.fires ? " firing" : "") + (ultimate.spent ? " spent" : "")
      + (ultimate.pressable
        ? "\" data-longpress=\"toggle-ultimate\" data-character=\"" + characterId
          + "\" data-skill=\"" + skillId + "\" title=\"" + esc(ultimate.hint)
        : "")
      // issue #237 — 地図の節と同じ key を持たせる（取得した技能が両方で光る）。
      + "\" data-fx=\"skill:" + esc(skillId) + "\">"
      + (kind === "passive"
        ? "<span class=\"bullet passive\">↳</span>"
        : "<span class=\"order\">" + (index + 1) + "</span>")
      + "<span class=\"installed-copy\"><b>" + esc(info?.label ?? nameFor(skillId)) + "</b>"
      + marks + share + ultimate.traits + "</span>"
      + ultimate.seal
      + moveButtons
      // **入切は「札」ではなく「摘み」にする。**丸は払うものだけに譲ったので、
      // 操作は動く摘みの形（スイッチ）で出す。
      + skillToggleSwitch(characterId, skillId, kind, disabled)
      + "</div>";
  }).join("");
  // 見出しは、払える点（●）と、装着で払う合計（○が足りない）を並べるだけにする。
  const meter = budget > 0
    ? "<span class=\"slot-budget " + (kind === "active" ? "ap" : "rp") + "\" role=\"img\" aria-label=\""
      + (kind === "active" ? "行動点" : "反応点") + " " + budget + " · 装着 " + list.length + "件\" title=\""
      + (kind === "active" ? "1ラウンドに払える行動点" : "1ラウンドに払える反応点") + " " + budget + "\">"
      + pips(budget, kind === "active" ? "ap" : "rp") + "</span>"
    : "";
  const total = kind === "reactive" && spent > budget
    ? "<span class=\"slot-over\" role=\"img\" aria-label=\"装着した反応の合計が反応点を超えている\""
      + " title=\"装着した反応の合計（" + spent + "）が1ラウンドの反応点（" + budget
      + "）を超えている。下の行は出ないことがある\">▲</span>"
    : "";
  return "<div class=\"slot-group\"><div class=\"slot-heading\"><span>" + title + "</span>"
    + meter + total + "</div>"
    + (rows || "<p class=\"empty-slot\">—</p>") + "</div>";
}

// issue #159 — 仲間タブ（memberTabs）と、立ち位置・HPの小さな印（formationMark /
// hpMark）はここにあった。**上端の共通盤面がその三つを兼ねる**ので消した。
// 盤面のセルがどこにあるかが立ち位置で、セルのHPバーがそのままHPの印である。

function memberContext(characterId, emphasis = "skills") {
  const option = characterInfo(characterId);
  const active = (state.run.loadout.tactics?.[characterId] || []).map((id) =>
    (COMPONENTS[id]?.label ?? nameFor(id)) + (skillDisabled(characterId, id) ? "（オフ）" : ""));
  const reactive = (state.run.loadout.reactives?.[characterId] || []).map((id) =>
    (COMPONENTS[id]?.label ?? nameFor(id)) + (skillDisabled(characterId, id) ? "（オフ）" : ""));
  const worn = (state.run.loadout.equipment?.[characterId] || []).map((id) => nameFor(id));
  // **絵で出せるもの（立ち位置・HP）は絵にし、名前だけを文字で残す。**issue #177。
  const primary = emphasis === "skills"
    ? (worn.length ? worn.join(" · ") : "")
    : (active.length ? active.join(" → ") : "");
  const secondary = emphasis === "skills" ? "" : (reactive.length ? reactive.join(" · ") : "");
  // issue #235 — 編成タブが持っていた4軸の能力値は、ここが引き取った。
  // **人物を選ぶのは上端の盤面、その人物の中身を読むのはこの帯**、と役が一本になる。
  return "<section class=\"member-context\"><div class=\"member-context-head\"><span class=\"avatar\">"
    + esc(option?.icon ?? "・") + "</span><div><h3>" + esc(characterName(characterId))
    + "</h3><small>" + esc(option?.role ?? "") + " · " + esc(option?.summary ?? "") + "</small></div>"
    + "</div>"
    + "<div class=\"member-context-stats\">" + statAxesHtml(characterId, { live: true }) + "</div>"
    + (primary || secondary
      ? "<div class=\"member-context-loadout\">"
        + (primary ? "<span>" + esc(primary) + "</span>" : "")
        + (secondary ? "<span>" + esc(secondary) + "</span>" : "") + "</div>"
      : "") + "</section>";
}


// issue #236 — **帯が出すのは、ツリーを触っているあいだ画面から消えるものだけ。**
// AP/RP は真上の盤面セルが、装着している技能の名前と順番はスロット行が、節の値段と
// 前提と解禁釦はツリーの節そのものが既に出している。再掲を並べても読み飛ばされる
// （作者指摘 2026-09-11「今の表示じゃ意味ない」）。
//
// 消えるのは二つ——**いま誰に払っているか**と、**あと何点あるか**である。
function skillBuildSummary(characterId) {
  const points = skillPointsFor(characterId);
  const party = totalSkillPoints();
  const reservationId = skillReservationFor(state.run, characterId);
  const reservationLevel = skillReservationLevelFor(state.run, characterId);
  const reservationLabel = reservationId
    ? (COMPONENTS[reservationId]?.label ?? nameFor(reservationId))
    : "";
  const reservationTarget = reservationLevel ? "Lv" + reservationLevel + "まで" : "";
  const reservation = reservationId
    ? "<span class=\"summary-reservation\" role=\"status\" title=\"取得予約: " + esc(reservationLabel)
      + "・" + esc(reservationTarget) + "\"><small>取得予約</small><b>"
      + esc(reservationLabel) + "</b><small>" + esc(reservationTarget) + "</small></span>"
    : "";
  return "<aside class=\"skill-build-summary\" aria-live=\"polite\">"
    + "<span class=\"avatar small\">" + esc(characterInfo(characterId)?.icon ?? "・") + "</span>"
    + "<b class=\"summary-name\">" + esc(characterName(characterId)) + "</b>"
    + reservation
    + "<span class=\"summary-points\" role=\"img\" aria-label=\"" + esc(characterName(characterId))
    + "の技能点 " + points + " · 隊全体 " + party + "\"><small>技能点</small><b>" + points + "</b>"
    + (party !== points ? "<small class=\"summary-party\">隊 " + party + "</small>" : "")
    + "</span></aside>";
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

// 節の状態。**取得・装着・解禁可否は四箇所で使うので一箇所で出す。**
function skillNodeState(node, characterId) {
  const unlocked = isUnlocked(characterId, node.skillId);
  const equipped = installedSkill(characterId, node.skillId, node.kind);
  const disabled = equipped && skillDisabled(characterId, node.skillId);
  // issue #168 — 前提は Lv まで見る。解禁 API と同じ関数を通る。
  const unmet = unmetPrerequisites(node, (skillId) => skillLevelOf(characterId, skillId));
  const prereqsMet = unmet.length === 0;
  const canUnlock = !unlocked && prereqsMet && skillPointsFor(characterId) >= node.cost;
  const reservationTarget = skillReservationFor(state.run, characterId);
  const reservationTargetLevel = skillReservationLevelFor(state.run, characterId);
  const reserved = reservationTarget === node.skillId;
  const canReserve = !unlocked || skillLevelOf(characterId, node.skillId) < skillLevelCapOf(node.skillId);
  // issue #236 — 取得済み技能はオン／オフだけを残す。
  const stateClass = unlocked
    ? "equipped" + (disabled ? " disabled" : "")
    : canUnlock ? "available" : !prereqsMet ? "prerequisite" : "locked";
  return {
    unlocked, equipped, disabled, prereqsMet, unmet, canUnlock, stateClass,
    reservationTarget, reservationTargetLevel, reserved, canReserve,
  };
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
  // **段を持たない節・まだ取っていない節には、何も書かない。**目盛りが無いことが
  // そのまま「段を持たない」で、値段は右端の丸に出ている（issue #177）。
  if (cap <= 1 || !nodeState.unlocked) return "";
  const level = skillLevelOf(characterId, node.skillId);
  if (level >= cap) return "";
  const affordable = skillPointsFor(characterId) >= SKILL_LEVEL_COST;
  // **1点で、上の説明のどの数字がいくつになるか。**倍率ではなく、変わる数そのものを出す。
  const steps = skillLevelValueSteps(
    COMPONENTS[node.skillId]?.effect ?? "", skillDefinitionOf(node.skillId), level,
  );
  // **1点で変わるのは数だけ。**その数そのものを出す（規則の説明は畳んだヘルプにある）。
  const change = steps.length
    ? "<span class=\"level-step\">" + steps.map((step) =>
      esc(step.from) + " → <b>" + esc(step.to) + "</b>").join(" · ") + "</span>"
    : "<span class=\"level-step\">+12%</span>";
  return button("Lv " + (level + 1) + "（" + SKILL_LEVEL_COST + "点）",
    "level-up-skill", !affordable, "tiny-button" + (affordable ? " primary-mini" : ""),
    "data-character=\"" + characterId + "\" data-skill=\"" + node.skillId + "\"") + change;
}


// 予約された技能を自動取得したときの loadout 反映。
// 前提は installUnlockedSkills の既定（末尾へ追加・オフ）に任せ、
// 目標だけは通常の取得と同じく equipSkill でオンにする。
function applyAutomaticSkillActions(actions = []) {
  if (!actions.length) return;
  let loadout = state.run.loadout;
  for (const action of actions) {
    if (action.type === "unlock") {
      const node = SKILL_TREE_NODES.find((entry) => entry.skillId === action.skillId);
      if (!node) continue;
      if (action.target) {
        const equipped = equipSkill(loadout, action.characterId, action.skillId, node.kind, limitsFor);
        if (equipped.ok) {
          loadout = equipped.loadout;
        } else if ((loadout.disabled?.[action.characterId] ?? []).includes(action.skillId)) {
          const enabled = toggleSkill(loadout, action.characterId, action.skillId, limitsFor);
          if (enabled.ok) loadout = enabled.loadout;
        }
      } else {
        loadout = installUnlockedSkills(loadout, action.characterId, [action.skillId]);
      }
      // issue #237 — 予約が勝手に取った技能も、自分で押したときと同じ反応にする。
      // **誰かが黙って取った**ように見えるのが一番分からない。
      fx("skill:" + action.skillId, "gain");
      record("skill_unlocked", {
        characterId: action.characterId,
        skillId: action.skillId,
        cost: action.cost,
        automatic: true,
        reservationTarget: action.targetSkillId,
        reservationTargetLevel: action.targetLevel,
        reservationTargetStep: action.target === true,
      });
    } else if (action.type === "level") {
      fx("skill:" + action.skillId, "level");
      record("skill_leveled", {
        characterId: action.characterId,
        skillId: action.skillId,
        level: action.level,
        cost: action.cost,
        automatic: true,
        reservationTarget: action.targetSkillId,
        reservationTargetLevel: action.targetLevel,
      });
    }
  }
  state.run.loadout = loadout;
}

// 作者指摘 2026-09-13 — **盤が短いほど、地図と一緒に読める。**盤は画面の下端に居るので、
// 高いぶんだけ地図の見える帯を食う。そこで盤に残すのは「その節を取るかどうかを決める材料」
// だけにした。
//
// ・入切は盤の頭の摘み（装着行と同じ形）にした。「オンにする／オフにする」の釦と
//   「取得状態は変わりません……」の一行は、摘みが形で言っていることの重複である。
// ・前提・派生の札は消した。**どこから来てどこへ行くかは、真上の地図が線で見せている。**
// ・取得・段上げ・予約・予約取消は一行へまとめた。同じことを言う組（押せる「解禁」と
//   「Lv1まで取得」）は片方だけ出す。
// ・予約の説明文は畳んだ「技能のルール」へ移した。いまの予約先は上の要約帯が出している。
function renderSkillDetail(node, characterId, nodeState) {
  const cap = skillLevelCapOf(node.skillId);
  const level = skillLevelOf(characterId, node.skillId);
  const actions = [];
  let shortfall = "";
  if (!nodeState.unlocked) {
    if (nodeState.canUnlock) {
      actions.push(button("解禁（" + node.cost + "点・戻せません）", "unlock-skill", false,
        "tiny-button primary-mini",
        "data-character=\"" + characterId + "\" data-skill=\"" + node.skillId + "\""));
    } else if (nodeState.prereqsMet) {
      actions.push(button("解禁（" + node.cost + "点）", "unlock-skill", true, "tiny-button",
        "data-character=\"" + characterId + "\" data-skill=\"" + node.skillId + "\""));
    } else {
      shortfall = "<p class=\"node-locked\">" + prerequisiteShortfallText(characterId, nodeState.unmet) + "</p>";
    }
  }
  actions.push(levelUpAction(node, characterId, nodeState));
  // 現在のSPで目標まで完了できるなら「取得」、足りなければ「予約」。
  const reservationButton = (targetLevel) => {
    const here = nodeState.reserved && nodeState.reservationTargetLevel === targetLevel;
    const verb = canFulfillSkillReservation(state.run, characterId, node.skillId, targetLevel)
      ? "取得"
      : "予約";
    return button("Lv" + targetLevel + "まで" + verb + (here ? " ◎" : ""),
      "reserve-skill", here, "tiny-button reservation-button",
      "data-character=\"" + characterId + "\" data-skill=\"" + node.skillId
        + "\" data-target-level=\"" + targetLevel + "\"");
  };
  // **いま押せる「解禁」と同じことを言う「Lv1まで取得」は出さない。**
  // 押せないとき（点が足りない・前提がまだ）だけ、Lv1 を予約として置く。
  if (!nodeState.unlocked && !nodeState.canUnlock) actions.push(reservationButton(MIN_SKILL_LEVEL));
  if (cap > MIN_SKILL_LEVEL && level < cap) actions.push(reservationButton(cap));
  if (nodeState.reserved) {
    actions.push(button("予約取消", "cancel-skill-reservation", false, "tiny-button reservation-button",
      "data-character=\"" + characterId + "\" data-skill=\"" + node.skillId + "\""));
  }
  const scope = node.kind === "active"
    ? "<i class=\"scope-mark\" title=\"対象\">" + esc(SCOPE_LABELS[skillDefinitionOf(node.skillId)?.targetQuery?.scope] ?? "") + "</i>"
    : "";
  const actionRow = actions.filter(Boolean).join("");
  // 作者要望 2026-09-14 — 技能の説明文にも content の `**強調**` が入っている
  // （「HP50%以下の味方**全員**へ」など8件）。Stage の学びと同じ `emphasize()` を
  // 通すので、星印が本文に混ざって出ることはもう無い。
  return "<div class=\"skill-detail\"><p>" + scope + emphasize(skillEffectText(characterId, node.skillId))
    + (level > 1 ? "<span class=\"level-now-tag\">Lv " + level + "</span>" : "") + "</p>"
    + shortfall
    + (actionRow ? "<div class=\"node-action\">" + actionRow + "</div>" : "")
    + "</div>";
}


// 作者指摘 2026-09-13 — **節は地図の印であって、操作盤ではない。**説明と取得の釦を
// 節の中で開いていたころ、(1) 釦が列幅（iPhone では 176px）の中に入るので、押す前に
// まず横スクロールが要り、(2) 開いた節だけ背が伸びて同じ行の節と線がその場で動いて
// いた。節が持つのは「どこに何があるか」だけにして、押した節の中身は地図の外の
// 操作盤（`renderSkillSheet`）へ出す。**押しても地図は動かない。**
function renderSkillRow(row, characterId, tone) {
  const node = row.node;
  const info = COMPONENTS[node.skillId];
  const nodeState = skillNodeState(node, characterId);
  const selected = state.selectedSkillNode === node.skillId;
  // issue #237 — 反応の宛先は技能そのもの（`skill:<id>`）。地図の節と、装着した行と、
  // **同じ技能を指すものは全部同じ key を持つ**ので、取得した一手が両方で光る。
  return "<div class=\"tree-cell" + tone + (selected ? " selected" : "") + "\" data-node=\"" + esc(row.key)
    + "\" data-fx=\"skill:" + esc(node.skillId) + "\""
    + " style=\"grid-column:" + row.x + ";grid-row:" + (row.y + 1) + "\">"
    + "<article class=\"skill-node " + nodeState.stateClass + (nodeState.reserved ? " reserved" : "") + (selected ? " selected" : "") + "\">"
    + "<button type=\"button\" class=\"skill-node-button\" aria-pressed=\"" + (selected ? "true" : "false")
    + "\" data-action=\"select-skill-node\" data-skill=\"" + esc(node.skillId) + "\">"
    + "<span class=\"node-icon branch-" + (BRANCH_KEYS[node.branch] ?? "base") + "\" title=\""
    + esc(node.branch) + "\">" + esc(skillNodeIcon(node)) + "</span>"
    + "<span class=\"node-copy\"><b>" + esc(info?.label ?? node.skillId) + "</b>"
    + "<small class=\"node-meters\" title=\"" + esc(costLabel(node)) + "\">"
    + costPips(node) + yieldBar(characterId, node.skillId)
    + levelMeter(node, characterId) + "</small>" + conditionLine(node) + "</span>"
    + nodeStateMark(node, nodeState, characterId) + "</button></article></div>";
}


// **地図の下端に貼りつく操作盤。**選んだ節の説明・前提・派生・取得の釦をここだけで出す。
// 貼りついているので、地図をどれだけ横へ動かしても、操作はいつも画面の同じ場所にある。
function renderSkillSheet(selectedRow, characterId) {
  if (!selectedRow) return "";
  const node = selectedRow.node;
  const nodeState = skillNodeState(node, characterId);
  const info = COMPONENTS[node.skillId];
  return "<aside class=\"skill-sheet " + nodeState.stateClass + (nodeState.reserved ? " reserved" : "")
    + "\" aria-live=\"polite\">"
    + "<div class=\"skill-sheet-head\">"
    + "<span class=\"node-icon branch-" + (BRANCH_KEYS[node.branch] ?? "base") + "\" title=\""
    + esc(node.branch) + "\">" + esc(skillNodeIcon(node)) + "</span>"
    + "<span class=\"sheet-title\"><b>" + esc(info?.label ?? node.skillId) + "</b>"
    + "<small>" + esc(node.branch) + " · 深さ " + selectedRow.x + "</small></span>"
    // 取得済みなら、ここは状態の印ではなく**摘み**にする（装着行と同じ形）。
    // 印は「取得済み」としか言わないが、摘みは同じ場所で入切まで済ませる。
    + (nodeState.equipped
      ? skillToggleSwitch(characterId, node.skillId, node.kind, nodeState.disabled)
      : nodeStateMark(node, nodeState, characterId))
    + "<button type=\"button\" class=\"sheet-close\" data-action=\"select-skill-node\" data-skill=\"\""
    + " aria-label=\"閉じる\" title=\"閉じる\">✕</button></div>"
    + renderSkillDetail(node, characterId, nodeState) + "</aside>";
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
  // 取得済みの根本は選択経路の強調から外し、未取得の前提だけを水色にする。
  const pendingOnPath = new Set([...onPath].filter((key) => {
    const row = group.byKey.get(key);
    return row && !isUnlocked(characterId, row.skillId);
  }));
  const ownedOnPath = new Set([...onPath].filter((key) => !pendingOnPath.has(key)));
  const derived = new Set(selectedRow ? selectedRow.descendants : []);
  const tabs = groups.map((entry) => "<button type=\"button\" class=\"tree-tab" + (entry.kind === kind ? " active" : "")
    + "\" aria-pressed=\"" + (entry.kind === kind ? "true" : "false") + "\" data-action=\"select-skill-kind\" data-kind=\""
    + entry.kind + "\"><b>" + esc(entry.label) + "</b><small>" + entry.nodeCount + "</small></button>").join("");
  const branch = state.skillTreeBranch;
  const rows = group.rows.map((row) => {
    const dimmed = branch && row.node.branch !== branch;
    const tone = !selectedRow
      ? (dimmed ? " faded" : "")
      : row.key === selectedRow.key ? ""
        : pendingOnPath.has(row.key) ? " on-path"
          : ownedOnPath.has(row.key) ? "" : derived.has(row.key) ? " derived" : " faded";
    return renderSkillRow(row, characterId, dimmed && !selectedRow ? " faded" : tone);
  }).join("");
  const columns = "repeat(" + Math.max(group.depth, 1) + ", var(--tree-col-width))";
  // 強調を解除する ✕ は、操作盤の頭（`.sheet-close`）へ移した。地図の上に置くと、
  // 「いま何を選んでいるか」を言う札が地図と盤の二箇所に出る。
  return "<div class=\"tree-tabs\" role=\"tablist\">" + tabs + "</div>"
    + branchFilter(group)
    + "<div class=\"skill-tree-scroll\" data-branch=\"" + kind + "\"><div class=\"skill-tree-forest\" data-branch=\""
    + kind + "\" style=\"grid-template-columns:" + columns + "\">"
    + "<svg class=\"tree-lines\" aria-hidden=\"true\"></svg>" + rows + "</div></div>"
    + renderSkillSheet(selectedRow, characterId);
}

// **テーマは色と印で選ぶ。**#165 の方針は「分類（アクティブ／リアクティブ／パッシブ）は
// 表示と自動実行の方法で、習得ツリーはテーマ別に混在させる」なので、テーマは
// 絞り込みとして要る。押すとそのテーマ以外が沈む。もう一度押すと戻る。
function branchFilter(group) {
  const counts = new Map();
  for (const row of group.rows) counts.set(row.node.branch, (counts.get(row.node.branch) ?? 0) + 1);
  const chips = [...counts.entries()].map(([branch, count]) => {
    const on = state.skillTreeBranch === branch;
    return "<button type=\"button\" class=\"branch-chip branch-" + (BRANCH_KEYS[branch] ?? "base")
      + (on ? " on" : "") + "\" aria-pressed=\"" + (on ? "true" : "false")
      + "\" data-action=\"select-skill-branch\" data-branch=\"" + esc(branch) + "\""
      + " aria-label=\"" + esc(branch) + " " + count + "件\" title=\"" + esc(branch) + "（" + count + "件）"
      + (BRANCH_BUILDS[branch] ? " — " + esc(BRANCH_BUILDS[branch]) : "") + "\">"
      + esc(branchIcons[branch] ?? "·") + "<small>" + count + "</small></button>";
  }).join("");
  return "<div class=\"branch-filter\" role=\"group\" aria-label=\"テーマで絞る\">" + chips + "</div>";
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
  const characterId = selectedCharacter();
  const pendingOnPath = new Set([...onPath].filter((key) => {
    const row = group.byKey.get(key);
    return row && !isUnlocked(characterId, row.skillId);
  }));
  const selectedIsPending = selectedRow && !isUnlocked(characterId, selectedRow.skillId);
  const derived = new Set(selectedRow ? [selectedRow.key, ...selectedRow.descendants] : []);
  const edgeTone = (childKey) => {
    if (!selectedRow) return "";
    if ((childKey === selectedRow.key && selectedIsPending) || pendingOnPath.has(childKey)) return " on-path";
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


// 作者指摘 2026-09-13 — **選んだ節を、こちらが探しに行かない。**
//
// 操作盤の「前提」「派生」の札は押せるが、押しても地図は前に居た場所のままだった。
// 深いツリーの帯は 2000px を超える（iPhone の窓は 340px）ので、辿った先の節は
// たいてい窓の外に居る。**窓の外に居るときだけ**、帯を横へ、ページを縦へ寄せる。
// 既に見えている節を押したときは動かさない（指の下で地図が滑るのを避ける）。
let focusedSkillNode = null;

function focusSelectedSkillNode() {
  const skillId = state.phase === "camp" && state.tab === "skills" ? state.selectedSkillNode : null;
  if (!skillId) {
    focusedSkillNode = null;
    return;
  }
  if (skillId === focusedSkillNode) return;
  focusedSkillNode = skillId;
  const cell = [...app.querySelectorAll(".tree-cell")].find((element) => element.dataset.node === skillId);
  const band = cell?.closest(".skill-tree-scroll");
  if (!cell || !band) return;
  const margin = 12;
  // 動きを減らす設定では、寄せる動きも一足で終わらせる（CSS 側の方針と揃える）。
  const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
  const cellRect = cell.getBoundingClientRect();
  const bandRect = band.getBoundingClientRect();
  if (cellRect.left < bandRect.left + margin || cellRect.right > bandRect.right - margin) {
    // 窓の中央へ寄せる。端に貼りつけると、隣の節（＝前提や派生の続き）が見えない。
    const delta = (cellRect.left + cellRect.width / 2) - (bandRect.left + bandRect.width / 2);
    band.scrollTo({ left: band.scrollLeft + delta, behavior });
  }
  // 縦に見えている範囲は、**貼りつく帯の下から操作盤の上まで**である。
  // 起点は帯の「いまの位置」ではなく**貼りついたときの位置**（キャンプの固定帯の下に
  // 技能点の要約帯が付く）にする。いまの位置で測ると、まだ流れの中に居る帯の真下へ
  // 節を寄せてしまい、寄せ終わったあとに帯が上へ貼りついて、地図の見える帯が
  // その高さぶん無駄に狭くなる。
  const sheet = app.querySelector(".skill-sheet");
  const summary = app.querySelector(".skill-build-summary");
  const campBottom = app.querySelector(".camp-top")?.getBoundingClientRect().bottom ?? 0;
  const top = campBottom + (summary ? summary.getBoundingClientRect().height + 6 : 0) + margin;
  const bottom = (sheet?.getBoundingClientRect().top ?? window.innerHeight) - margin;
  if (cellRect.top < top || cellRect.bottom > bottom) {
    // 見える帯の上寄り（1/3）へ置く。真上に貼りつけると、その節から下へ伸びる
    // 派生先が一つも見えない。
    const want = top + Math.max(0, (bottom - top - cellRect.height) / 3);
    window.scrollBy({ top: cellRect.top - want, behavior });
  }
}

// **記号の意味は、畳んだ中に一度だけ置く。**節や装着行の上には出さない
// （出すと、結局そこで文章を読むことになる）。issue #177 の作者方針。
function symbolLegendHelp() {
  const row = (mark, text) => "<dt>" + mark + "</dt><dd>" + esc(text) + "</dd>";
  return helpDetails("skill-symbols", "記号の意味",
    "<dl class=\"symbol-legend\">"
    + row(pips(1, "ap"), "行動点。丸の数だけ1ラウンドに払う")
    + row(pips(1, "rp"), "反応点。装着した反応は上から順に払い、尽きたら下は出ない")
    + row("<span class=\"pips hp\"><i></i></span>", "代償にHPを払う")
    + row("<span class=\"yield-chip stat-might\"><i>腕</i>130%</span>",
      "技能の効果量。印は掛ける能力値（腕＝腕力・技＝技術・受＝受け・HP＝最大HP）")
    + row("<span class=\"level-tag\">Lv1<small>/10</small></span>", "いまの段と上限")
    + row("<span class=\"node-mark cost acquisition-cost\">1</span>", "この技能の取得コスト")
    + row("<span class=\"node-cost-chain\"><span class=\"node-mark prerequisite-levels\">1</span><span class=\"cost-plus\">+</span><span class=\"node-mark acquisition-cost\">1</span></span>",
      "取得までに必要な他技能の残りLv数と、この技能の取得コスト")
    + row("<span class=\"node-mark owned\">✓</span>", "取得済み・未装着")
    + row("<span class=\"node-mark equipped\">✓</span>", "装着中")
    + row("<span class=\"turn-share\"><i></i><i class=\"on\"></i><i></i></span>",
      "出番。装着した本数のうちの一本。順送りなので、増やすほど一本あたりの出番は減る")
    + row("<span class=\"turn-cells\"><span class=\"turn-round\">"
      + "<i class=\"turn-cell branch-strike\">✦</i></span><span class=\"turn-round\">"
      + "<i class=\"turn-cell idle\"></i></span></span>",
      "戦闘のあと、誰がどのラウンドに何を出したか。点線の枠はその拍に動いていない")
    // issue #238 / 作者指摘 2026-09-13 — 必殺の残りは**人物ごと**に出す（隊の合計はやめた）。
    + row("<span class=\"party-ultimate firing\">✹</span>",
      "必殺技を残している仲間。薄い ✹ は「まだ残っている」、金の ✹ は「構えている」、"
      + "光る ✹ は「この一戦で出る」、灰の ✧ は「この遠征ではもう放った」")
    + "</dl>"
    + "<p class=\"muted\">丸は<b>払うもの</b>だけに使います。発動条件は技能名の下に短い薄字で書きます。</p>");
}

// ---------------------------------------------------------------- 必殺技（issue #238）
//
// **専用の枠を画面へ置かない。**必殺技はたまにしか触らない操作なのに、常設の枠を
// 出すと毎回そこを読み飛ばすことになる（作者指摘：「UIがダサいというか邪魔」）。
// 触る場所は装着行しかないので、**その行を長押しすると指定・解除**にした。
// 指定された行には ✹ が出て、押すとその一戦で構える／解く。
//
// 残り回数は SKILLS の見出しへ小さく出すだけにする。一人一遠征に一度きりなので、
// 「誰がまだ持っているか」は盤面の ✹ と行の ✹ で読める。

function armedUltimateIds() {
  return new Set(armedUltimates(state.run).map((entry) => entry.characterId));
}

// **誰が必殺を残していて、誰が使い終えたか**（作者指摘 2026-09-13）。
//
// 以前は技能タブの見出しに「必殺を残す仲間 ◆◆◇」という**隊の合計**だけを出していた。
// 合計は「あと何回あるか」には答えるが、**「誰の一回か」には答えない。**一人一遠征に
// 一度きりで隊で分け合う枠でもないのだから、合計にはそもそも意味が薄い。
//
// 盤面のセルは常にその人物ひとりを指しているので、印はそこへ置く。四段ある。
//
//   firing … 塗って光る ✹ … 構えていて、**この一戦で出る**（予測が言っている）
//   armed  … 金の ✹      … 構えているが、この一戦では条件が揃わない
//   ready  … 薄い ✹      … まだ残っている（構えていない）
//   spent  … 灰の ✧      … この遠征ではもう放った（補充されない）
function ultimateCellMark(characterId) {
  if (!ultimatesUnlocked(state.run)) return "";
  const left = ultimateUsesLeft(state.run, characterId);
  const skillId = armedUltimates(state.run)
    .find((entry) => entry.characterId === characterId)?.skillId ?? null;
  const fires = Boolean(skillId)
    && (battleForecast()?.ultimateFiredBy ?? []).includes(characterId);
  const [tone, glyph, label] = left <= 0
    ? ["spent", "✧", "必殺技 · この遠征ではもう放った"]
    : skillId
      ? fires
        ? ["firing", "✹", "必殺 " + nameFor(skillId) + " · この一戦で出る"]
        : ["armed", "✹", "必殺 " + nameFor(skillId) + " · 構えているが、この一戦では出ない"]
      : ["ready", "✹", "必殺技 · まだ残っている（技能の行を長押しで構える）"];
  return "<span class=\"party-ultimate " + tone + "\" role=\"img\" aria-label=\""
    + esc(characterName(characterId)) + "の" + esc(label) + "\" title=\"" + esc(label)
    + "\">" + glyph + "</span>";
}

// 装着行ひとつぶんの必殺の状態。**行の見た目と操作を、ここ一箇所で決める。**
// 作者指摘 2026-09-12 — 操作は長押しだけ。行の中に押す釦を置かない（押す場所が
// 二つあると、長押しの当たり判定をその釦へ譲る必要が出て、どちらも押しにくくなる）。
// ✹ は操作ではなく**状態の印**で、構えているあいだ行ごと光る（styles.css）。
function ultimateRowState(characterId, skillId, kind) {
  const blank = {
    designated: false, armed: false, fires: false, spent: false,
    pressable: false, hint: "", traits: "", seal: "",
  };
  if (!ultimatesUnlocked(state.run)) return blank;
  // パッシブは放つ瞬間を持たないので候補にならない。量も状態も動かさない技能も同じ。
  if (kind === "passive") return blank;
  const candidate = ultimateCandidates(state.run.loadout, characterId)
    .find((entry) => entry.skillId === skillId);
  if (!candidate) return blank;
  const designated = (state.run.loadout.ultimates?.[characterId] ?? null) === skillId;
  const left = ultimateUsesLeft(state.run, characterId);
  const armed = designated && armedUltimateIds().has(characterId);
  if (!designated) {
    return {
      ...blank,
      pressable: true,
      hint: left > 0
        ? "長押しでこの一戦の必殺技にする（" + candidate.traitLabels.join("・") + "）"
        : "この仲間は、この遠征ではもう必殺技を放っている",
    };
  }
  // **構えたのに出ない、を黙って起こさない。**次の一戦を最後まで走らせた予測が
  // 「本当に放つか」を知っているので、構えた時点でそれを出す。
  const fires = armed && (battleForecast()?.ultimateFiredBy ?? []).includes(characterId);
  const spent = left <= 0;
  const label = spent
    ? "この遠征ではもう放った"
    : fires
      ? "この一戦で出る"
      : armed
        ? "構えているが、この一戦では条件が揃わない"
        : "まだ構えていない";
  return {
    designated: true,
    armed,
    fires,
    spent,
    pressable: true,
    hint: "必殺技 · " + label + " · 長押しで解く",
    traits: "<span class=\"ultimate-traits\">"
      + candidate.traitLabels.map((text) => "<span class=\"ultimate-trait\">" + esc(text) + "</span>").join("")
      + (spent ? "<span class=\"ultimate-trait idle\">この遠征では放った</span>" : "")
      + (armed && !fires && !spent ? "<span class=\"ultimate-trait idle\">この一戦では出ない</span>" : "")
      + "</span>",
    // **印は動く。**構えているあいだは脈打ち、この一戦で本当に出るなら強く光る。
    seal: "<span class=\"ultimate-seal\" role=\"img\" aria-label=\"必殺技 · "
      + esc(label) + "\" title=\"" + esc(label) + "\">✹</span>",
  };
}

// 必殺技の説明。**畳んだ中に置く**ので、普段は一行も画面を占めない。
function ultimateHelp() {
  return helpDetails("ultimate-rules", "必殺技のルール", ruleGrid([
    {
      glyph: "spark",
      title: "構える",
      value: "装着行を長押し",
      line: "もう一度の長押しで外れる。構えた行は金色に光り ✹ が付く。指定も解除も無料。",
    },
    {
      glyph: "up",
      title: "掛かる変換",
      value: "単体→全体 · 量 ×" + ULTIMATE_AMOUNT_MULTIPLIER + " · 溜めなし · 防壁が残る · 反応点なし",
      line: "AP・回数・耐久・行動権は変わりません。",
      tone: "good",
    },
    {
      glyph: "lock",
      title: "放てる数",
      value: "一人 1回 / 遠征",
      line: "補充されません。構えただけでは減らず、負けてやり直した一戦でも減りません。",
      tone: "bad",
    },
    {
      glyph: "vitality",
      title: "出る条件",
      value: "隊の誰かが HP " + ULTIMATE_READY_HP_PERCENT + "%未満",
      line: "元の技能と同じ条件で、その技能が最初に出る場面に出ます。",
    },
    {
      glyph: "round",
      title: "放った後",
      value: "自分に「隙」1段",
      line: "戦闘に1回きり。出るかどうかも、その後も、戦闘予測にそのまま出ます。",
    },
  ]));
}

function renderSkills() {
  // issue #159 — 対象の人物は上端の共通盤面で選ぶ。**このタブに二つ目の仲間タブを
  // 持たない。**残り技能点は隊全体の合計にする（一人ぶんだけでは、他の誰かが
  // 使い残していることがこの画面から読めない。作者指摘 2026-09-08）。
  const characterId = selectedCharacter();
  // 作者指摘 2026-09-13 — **隊全体の合計（必殺を残す仲間 N人）は出さない。**
  // 誰の一回かに答えないので、指す先が無い。残りは盤面のセルが一人ずつ出す
  // （`ultimateCellMark`）。
  const pointsBadge = "<span class=\"skill-points-badge\"><small>技能点 · 隊全体</small>"
    + "<b data-fx-watch=\"skill-points\">" + totalSkillPoints() + "</b></span>";
  const depths = state.run.manifest.packDepths ?? {};
  const packs = state.run.manifest.enabledPackIds
    .map((id) => (PACK_BY_ID[id]?.displayName ?? id) + (depths[id] === "core" ? "（入口）" : ""))
    .join(" · ");
  return "<section class=\"card skill-build-card\">" + sectionHeading("SKILLS", "技能", pointsBadge)
    + "<p class=\"context-line\">" + esc(packs) + "</p>"
    + memberContext(characterId, "skills")
    + skillSlotRows(characterId, "active") + skillSlotRows(characterId, "reactive") + skillSlotRows(characterId, "passive") + "</section>"
    + "<section class=\"card\">"
    + "<details class=\"progressive-details skill-tree-details\" open><summary>技能ツリー</summary>"
    + skillBuildSummary(characterId) + renderSkillTree(characterId)
    + "</details>"
    + symbolLegendHelp()
    // issue #187 — アクティブはカーソルから登録順に走査し、選んだ技能の次へ進む。
    // issue #177 — この規則そのものは装着行の「出番」の目盛りで見せている。
    // 作者指摘 2026-09-13 — 予約の規則（自動取得の順と、入る向き）はここに一度だけ置く。
    // 節ごとの盤で毎回繰り返すと、盤が高くなって地図が見えなくなる。
    + helpDetails("skill-rules", "技能のルール", ruleGrid([
      {
        glyph: "skill",
        title: "取得",
        value: "枠の上限はありません",
        line: "取った技能はその場で装着されて回り始めます。",
      },
      {
        glyph: "lock",
        title: "取り消せない",
        value: "取得した技能は遠征中に忘れません",
        line: "使った技能点も戻りません。",
        tone: "bad",
      },
      {
        glyph: "round",
        title: "アクティブ",
        value: "順番に回る",
        line: "出した技能の次から判定し、条件が未達ならスキップ。装着を増やすほど一本の出番は減ります。",
      },
      {
        glyph: "retry",
        title: "リアクティブ",
        value: "上から順に判定",
        line: "条件が別々なので複数が同じ拍に鳴りますが、反応点が尽きた時点で下は出ません。",
      },
      {
        glyph: "cross",
        title: "オフ",
        value: "取得状態・前提・段は失わない",
        line: "戦闘にも予測にも現れません。starter の前提として無償で付く節は最初からオフです。",
        tone: "quiet",
      },
      {
        glyph: "flag",
        title: "取得予約",
        value: "一人につき一つ",
        line: "技能点が入るたび、前提 → 必要な段 → 目的の技能 → 目的の段の順で自動で取ります。途中の前提はオフ、目的はオンで入ります。",
      },
      ultimatesUnlocked(state.run)
        ? { glyph: "spark", title: "必殺技", value: "装着行を長押し", line: "詳しくは下の「必殺技のルール」を開いてください。" }
        : null,
    ]))
    + (ultimatesUnlocked(state.run) ? ultimateHelp() : "")
    + statusGlossaryHelp()
    + "</section>";
}


function equipmentSlotHtml(characterId, slot) {
  const equipmentId = (state.run.loadout.equipment?.[characterId] || [])[slot] || null;
  const selected = state.selectedEquipment;
  const canInstall = Boolean(selected && selected !== equipmentId);
  const label = equipmentId ? nameFor(equipmentId) : "空き枠";
  // issue #236 — 埋まっている枠は耐久の数だけ。空き枠は「空き枠」がもう言っているので、
  // **装備を選んでいるときだけ**「ここへ」と足す（何もないときは何も書かない）。
  const detail = equipmentId
    ? "耐久 " + equipmentDurability(equipmentId) + " / " + (gear(equipmentId)?.maxDurability ?? 1)
    : selected ? "ここへ" : "";
  return "<div class=\"equipment-slot\" data-fx=\"slot:" + esc(characterId) + ":" + slot
    + "\"><button type=\"button\" class=\"equip-slot-button "
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
      + (item?.rarity ? " rarity-card-" + esc(item.rarity) : "") + "\" data-fx=\"gear:" + esc(id) + "\"><button type=\"button\" class=\"gear-main\" data-action=\"select-equipment\" data-equipment=\"" + id
      + "\"><span class=\"gear-icon\">◆</span><span class=\"gear-copy\"><b>" + esc(info?.label ?? id)
      + rarityChip(item?.rarity) + (item?.carried ? "<span class=\"carried-chip\">持込</span>" : "")
      + "</b>" + readout
      + "</span><span class=\"gear-state\">"
      + (owner ? characterName(owner) : "手元")
      // issue #237 — 摩耗も破損も、戻ってきた拍でこの数が動く。数が主語なので
      // 札そのものではなく数を光らせる（減れば赤、直れば金）。
      + "<br><span data-fx-watch=\"gear-durability:" + esc(id) + "\">耐久 " + durability + "/" + max
      + "</span></span></button>"
      + button("分解", "dismantle", false, "tiny-button", "data-equipment=\"" + id + "\"")
      + "</article>";
  }).join("");
  // issue #236 — 主語はすぐ上の memberContext が出している。見出しで名前を繰り返さない。
  const slots = "<section class=\"selected-loadout\"><h3>装備枠</h3>"
    + "<div class=\"equipment-slots\">" + equipmentSlotHtml(characterId, 0) + equipmentSlotHtml(characterId, 1) + "</div></section>";
  const inventory = "<details class=\"progressive-details equipment-inventory\" open>"
    + "<summary><span data-fx-watch=\"inventory\">手元 "
    + state.run.inventory.length + " / " + INVENTORY_LIMIT + "</span></summary>"
    + "<div class=\"gear-grid\">" + (inventoryCards || "<p class=\"muted\">まだ装備を持っていません。</p>")
    + "</div></details>";
  // issue #236 — 装備を選んだあとだけ、次の一手を一行で言う。選ぶ前は
  // カードが押せる形で並んでいるので、何も書かない。
  const selection = selected ? "装着する枠を選ぶ" : "";
  return "<section class=\"card equipment-build-card\">" + sectionHeading("EQUIPMENT", "装備",
      "<span class=\"stage\">装着 " + equipmentFillLabel() + "</span>")
    + (selection ? "<p class=\"operation-note\" role=\"status\">" + selection + "</p>" : "")
    + memberContext(characterId, "equipment")
    + slots
    + inventory
    + helpDetails("equipment-rules", "装備のルール", ruleGrid([
      { glyph: "gear", title: "付け外し", value: "何度でも", line: "所持上限は " + INVENTORY_LIMIT + " 品。遠征が終わると装備は手放します。" },
      { glyph: "spark", title: "発火効果", value: "耐久 −1（複数効果・多段・範囲は −2）", line: "耐久0では、以後の発火効果が不発になります。", tone: "bad" },
      { glyph: "up", title: "能力値補正", value: "耐久を使わない", line: "装着しているあいだ効く常時効果です。", tone: "good" },
      { glyph: "retry", title: "耐久", value: "戦闘後に最大へ戻る", line: "修理効果は自己相殺を避け、HPか防壁の有限コストを使います。" },
    ]))
    + "</section>";
}


function enemySkillRows(enemyActorId) {
  const actor = PLAYABLE_CONTENT.enemyActors[enemyActorId] ?? {};
  const skillEntries = [
    ...(actor.tactics ?? []).map((entry) => ({
      id: typeof entry === "string" ? entry : entry.activeSkillId,
      kind: "A",
      kindLabel: "行動",
    })),
    ...(actor.reactiveSkillIds ?? []).map((id) => ({ id, kind: "R", kindLabel: "反応" })),
    ...(actor.passiveSkillIds ?? []).map((id) => ({ id, kind: "P", kindLabel: "常時" })),
  ].filter((entry) => entry.id);
  return "<div class=\"enemy-skill-list\" aria-label=\"使用技能\">"
    + skillEntries.map((entry) => {
      const info = componentInfo(entry.id);
      return "<div class=\"enemy-skill-row\"><span class=\"enemy-skill-kind\" title=\""
        + esc(entry.kindLabel) + "\">" + entry.kind + "</span><span><b>"
        // 敵側の技能（enemy_heavy / front_strike など）は COMPONENTS に居ないので、
        // componentInfo だけを見ると内部 ID が画面へ出る。名前は componentLabel から引く。
        + esc(componentLabel(entry.id)) + "</b><small>" + esc(info?.effect ?? "") + "</small></span></div>";
    }).join("")
    + "</div>";
}

function renderEnemy(enemy, { withLore = true } = {}) {
  const info = enemyInfo(enemy.enemyActorId);
  const actor = PLAYABLE_CONTENT.enemyActors[enemy.enemyActorId] ?? {};
  const mutations = (enemy.mutations ?? []).map((id) => ENEMY_MUTATIONS[id]?.displayName ?? id);
  const badges = (enemy.boss ? ["ボス"] : []).concat(enemy.reinforcement ? ["増援"] : []).concat(mutations);
  const stats = [
    ["HP", enemy.stats.maxHp],
    ["腕力", enemy.stats.might],
    ["技術", enemy.stats.focus],
    ["受け", enemy.stats.guard],
    ["AP", actor.baseActionPoints ?? 1],
    ["RP", actor.baseReactionPoints ?? 0],
  ];
  return "<article class=\"enemy-card" + (enemy.boss ? " boss" : "") + "\"><div class=\"enemy-top\"><span class=\"enemy-mark\">◆</span><div><b>"
    + esc(info.label) + "</b><small>" + esc(positionText(enemy.position)) + "</small></div></div>"
    + (badges.length ? "<div class=\"enemy-badges\">" + badges.map((text) =>
      "<span class=\"badge\">" + esc(text) + "</span>").join("") + "</div>" : "")
    + "<div class=\"enemy-stat-grid\" aria-label=\"能力値\">" + stats.map(([label, value]) =>
      "<span><small>" + label + "</small><b>" + value + "</b></span>").join("") + "</div>"
    + "<div class=\"enemy-targeting\"><span class=\"enemy-detail-mark\">◎</span><p>"
    + esc(info.targeting) + "</p></div>"
    + enemySkillRows(enemy.enemyActorId)
    + (mutations.length ? "<p class=\"muted small\">" + esc((enemy.mutations ?? [])
      .map((id) => ENEMY_MUTATIONS[id]?.previewText ?? "").join(" ")) + "</p>" : "")
    // R12 §4.B — 規則ではない噂は、完全情報の能力・技能・狙いから一段離す。
    + (withLore && info.lore ? "<p class=\"enemy-lore\">" + esc(info.lore) + "</p>" : "")
    + "</article>";
}

function selectedEncounterEnemy(encounter) {
  if (!encounter?.enemies?.length) return null;
  return encounter.enemies.find((enemy) => enemy.instanceId === state.selectedEnemyId)
    ?? encounter.enemies[0];
}

function inspectedEncounterIndex() {
  const fallback = state.phase === "camp" ? state.run.encounterIndex : 1;
  const value = Number.isInteger(state.inspectedEncounterIndex) ? state.inspectedEncounterIndex : fallback;
  return Math.max(1, Math.min(ENCOUNTERS_PER_RUN, value));
}

function encounterForInspection(index) {
  if (state.phase === "camp" && index === state.run.encounterIndex
      && (state.prologueActive || ultimateLessonActive())) return currentEncounter();
  return composeEncounter(index, state.run.difficulty, encounterOptions());
}

function inspectedEncounter() {
  return encounterForInspection(inspectedEncounterIndex());
}

function clearedEncounterResult(index) {
  const results = Array.isArray(state.run.results) ? state.run.results : [];
  return [...results].reverse().find((entry) =>
    entry?.encounter === index && entry.result === "win") ?? null;
}

function encounterAftermath(index) {
  if (index === ENCOUNTERS_PER_RUN) return "精算";
  if (isCampaignRun() && (index === 4 || index === 8)) return "全快";
  return "持越";
}

function encounterReport(index, encounter) {
  const result = clearedEncounterResult(index);
  const known = Boolean(result);
  const rounds = known && Number.isFinite(result.roundsUsed) ? result.roundsUsed : "？";
  const allyLoss = known && Number.isFinite(result.metrics?.allyHpLost)
    ? result.metrics.allyHpLost
    : "？";
  const skillPoints = skillPointsForClear(encounter?.kind);
  const aftermath = encounterAftermath(index);
  const facts = [
    { glyph: "skill", value: "+" + skillPoints, label: "技能点" },
    { glyph: "vitality", value: aftermath, label: "HP" },
    { glyph: "round", value: rounds, label: "ラウンド" },
    { glyph: "cross", value: allyLoss, label: "味方損失" },
  ];
  const accessible = "技能点 +" + skillPoints + "・戦闘後HP " + aftermath + "・"
    + rounds + "ラウンド・味方損失 " + allyLoss;
  return "<div class=\"encounter-report " + (known ? "recorded" : "unknown")
    + "\" data-report-known=\"" + (known ? "true" : "false")
    + "\" aria-label=\"" + esc(accessible) + "\">"
    + facts.map((fact) => "<span class=\"encounter-report-cell\">"
      + glyph(fact.glyph) + "<span><b>" + esc(fact.value) + "</b><small>"
      + esc(fact.label) + "</small></span></span>").join("")
    + "</div>";
}

// 作者要望 2026-09-15 — 上端の窓と同じ先見機が映しているのだから、**窓の作りを
// 二つに分けない。**見出しは `.forecast-head`（丸い先見機の眼＋戦闘名／右に読み値）を
// そのまま使い、読み値だけが「勝敗・ラウンド」ではなく「02/12」になる。
// 「FUTURE SCOPE / LINK ACTIVE」の二段の銘は落とす——窓そのものが先見機の像で、
// 何を見ているかは戦闘名が言う。
function encounterConsole(mode, index, encounter) {
  const forecast = mode === "forecast";
  const target = "第" + index + "戦" + (encounter?.name ? " · " + encounter.name : "");
  return "<div class=\"forecast-head encounter-console " + mode + "\">"
    + "<span class=\"forecaster-identity\">"
    + (forecast
      ? "<span class=\"forecaster-lens\" aria-hidden=\"true\"><i></i></span>"
      : "<span class=\"encounter-console-mark\" aria-hidden=\"true\">" + glyph("check") + "</span>")
    + "<span class=\"forecast-title\">" + esc(target) + "</span></span>"
    + "<span class=\"forecast-readout\">"
    + (forecast ? "<span class=\"encounter-console-signal\" aria-hidden=\"true\"><i></i><i></i><i></i></span>" : "")
    + "<strong>" + String(index).padStart(2, "0") + "<small>/"
    + ENCOUNTERS_PER_RUN + "</small></strong></span></div>";
}

function encounterArchive({ currentIndex = null } = {}) {
  const selectedIndex = inspectedEncounterIndex();
  const encounter = encounterForInspection(selectedIndex);
  const recorded = Number.isInteger(currentIndex) && selectedIndex < currentIndex;
  const mode = recorded ? "record" : "forecast";
  const kindMeta = {
    normal: { label: "通常", marker: "" },
    elite: { label: "精鋭", marker: "◆" },
    boss: { label: "ボス", marker: "★" },
  };
  const statusLabels = {
    done: "クリア済み",
    current: "現在地",
    unreached: "未到達",
    available: "閲覧可",
  };
  const rail = Array.from({ length: ENCOUNTERS_PER_RUN }, (_, offset) => {
    const step = offset + 1;
    const item = encounterForInspection(step);
    const meta = kindMeta[item.kind] ?? kindMeta.normal;
    const status = Number.isInteger(currentIndex)
      ? (step < currentIndex ? "done" : step === currentIndex ? "current" : "unreached")
      : "available";
    const selected = step === selectedIndex;
    const label = "第" + step + "戦・" + meta.label + "・" + statusLabels[status]
      + (selected ? "・表示中" : "");
    return "<button type=\"button\" class=\"map-node " + status + " kind-" + item.kind
      + (selected ? " inspected" : "") + "\" data-action=\"inspect-encounter\" data-encounter=\"" + step
      + "\" data-map-index=\"" + step + "\" data-map-kind=\"" + item.kind
      + "\" data-map-status=\"" + status + "\" aria-label=\"" + esc(label)
      + "\" aria-current=\"" + (status === "current" ? "step" : "false")
      + "\" aria-pressed=\"" + (selected ? "true" : "false") + "\"><span class=\"map-node-number\">"
      + step + "</span>" + (meta.marker ? "<span class=\"map-kind-badge\" aria-hidden=\"true\">"
        + meta.marker + "</span>" : "") + "</button>";
  }).join("");
  // 作者要望 2026-09-15 — 投影の中から**文章を全部落とす。**
  // 幕・種別・危険度・最大ラウンドの銘（種別は節の◆★が、進み具合は「NN/12」が既に言う）、
  // 区画の一言、ボス法則の解説——どれも読ませる文で、見れば分かる情報の言い直しか、
  // 盤面を見に来た手を止めるだけだった。残すのは4指標と敵の盤面。
  const boardLabel = (mode === "forecast" ? "先見機による第" : "踏破済みの第")
    + selectedIndex + "戦 · " + encounter.name + (mode === "forecast" ? " の投影" : " の記録");
  return "<section class=\"card encounter-archive forecaster-window mode-" + mode
    + "\" data-inspected-encounter=\"" + selectedIndex + "\" data-inspection-mode=\"" + mode
    + "\" aria-label=\"" + esc(boardLabel) + "\">"
    + (mode === "forecast" ? "<span class=\"forecaster-scan\" aria-hidden=\"true\"></span>" : "")
    + encounterConsole(mode, selectedIndex, encounter)
    + "<div class=\"map-progress\" role=\"list\" aria-label=\"全" + ENCOUNTERS_PER_RUN + "戦の敵を選ぶ\">"
    + rail + "</div>"
    + "<div class=\"encounter-projection " + mode + "\" role=\"region\" aria-live=\"polite\">"
    + encounterReport(selectedIndex, encounter)
    + "<div class=\"enemy-details\">" + expeditionEnemyBoard(encounter) + "</div>"
    + "</div></section>";
}

// 遠征の敵セルは、戦闘盤面と同じ位置を押せる小さな入口にする。
// 狙い・変異・拾い屋の一言は、選んだ一体の詳細欄へ集約して重複を避ける。
function expeditionEnemyCell(enemy, selectedId) {
  if (!enemy) return "<div class=\"enemy-board-empty\" aria-hidden=\"true\"></div>";
  const selected = enemy.instanceId === selectedId;
  const info = enemyInfo(enemy.enemyActorId);
  const badges = [];
  if (enemy.boss) badges.push("★");
  if (enemy.reinforcement) badges.push("＋");
  if (enemy.mutations?.length) badges.push("変異" + enemy.mutations.length);
  const accessibleName = info.label + "・" + positionText(enemy.position)
    + "・HP " + enemy.stats.maxHp + "・受け " + enemy.stats.guard;
  return "<button type=\"button\" class=\"enemy-board-cell"
    + (enemy.boss ? " boss" : "") + (selected ? " selected" : "")
    + "\" data-action=\"select-expedition-enemy\" data-enemy=\"" + esc(enemy.instanceId)
    + "\" aria-label=\"" + esc(accessibleName) + "\" aria-pressed=\"" + (selected ? "true" : "false")
    + "\" aria-controls=\"selected-enemy-detail\">"
    + "<span class=\"enemy-board-cell-top\"><span class=\"enemy-board-icon\" aria-hidden=\"true\">"
    + esc(ENEMY_ICONS[enemy.enemyActorId] ?? "◆") + "</span><b>" + esc(info.label) + "</b></span>"
    + "<span class=\"enemy-board-cell-stats\"><span>HP " + enemy.stats.maxHp
    + "</span><span>受け " + enemy.stats.guard + "</span></span>"
    + (badges.length ? "<span class=\"enemy-board-badges\" aria-hidden=\"true\">"
      + badges.map((badge) => esc(badge)).join(" ") + "</span>" : "")
    + "</button>";
}

function expeditionEnemyBoard(encounter) {
  const selected = selectedEncounterEnemy(encounter);
  if (!selected) return "<p class=\"muted\">敵はいません。</p>";
  const cells = positionRowsHtml(
    encounter.enemies,
    "enemy",
    "enemy",
    "<div class=\"enemy-board-empty\" aria-hidden=\"true\"></div>",
    selected.instanceId,
  );
  return "<div class=\"enemy-board\" role=\"group\" aria-label=\"敵の隊列\">"
    + cells + "</div>"
    + "<div class=\"enemy-selection-detail\" id=\"selected-enemy-detail\" data-selected-enemy=\""
    + esc(selected.instanceId) + "\" role=\"region\" aria-label=\"敵の詳細\">"
    + renderEnemy(selected, { withLore: true }) + "</div>";
}

// R6 §12.1 — 補給は3用途で共有する。**引き直しに使うと再挑戦の余地が減る。**
// そのトレードオフを、残数と用途を同じ場所へ並べて見せる。
//
// PR #255 — 分母は**その遠征の総数**（既定3、ギルドの「開始補給」で伸びる）。
// 遠征中に増えないので、「3/3」が最初から最後まで同じ意味で読める。
function supplyTotal() {
  return runSuppliesMax(state.run);
}

// issue #236 改 / 作者要望 2026-09-13 — 用途は**箇条書きの文ではなく記号つきの名札**にする。
// 三つが同じ一つを取り合っていることは、並びと目盛りで出る（文で言い直さない）。
const SUPPLY_USE_MARKS = Object.freeze({
  retry: { glyph: "retry", title: "再挑戦" },
  reroll: { glyph: "reroll", title: "引き直し" },
  camp: { glyph: "camp", title: "野営治療" },
});

function suppliesBar(context) {
  const supplies = state.run.supplies;
  const total = supplyTotal();
  const uses = Object.entries(SUPPLY_USES).map(([id, text]) => ({
    glyph: SUPPLY_USE_MARKS[id]?.glyph ?? "supply",
    title: SUPPLY_USE_MARKS[id]?.title ?? id,
    line: text,
    tone: supplies ? null : "quiet",
  }));
  return "<div class=\"supplies-bar\"><div class=\"supplies-head\">"
    + "<b data-fx-watch=\"supplies\">" + glyph("supply") + "補給 " + supplies + " / " + total
    + "</b><span>" + esc(context ?? "三つの用途で取り合う") + "</span></div>"
    + segmentMeter(supplies, total, { tone: supplies ? null : "bad" })
    + ruleGrid(uses, "supply-uses-grid") + "</div>";
}

function renderSupplies() {
  const scrap = state.run.scrap ?? 0;
  const treatment = isCampaignRun()
    ? campTreatmentBlock()
    : "<section class=\"card quiet\"><p class=\"muted\">この遠征では戦闘ごとにHPが全回復するため、野営治療は使いません。</p></section>";
  return "<section class=\"card\">" + sectionHeading("SUPPLIES", "補給")
    + suppliesBar()
    + "<div class=\"scrap-line\"><span>屑 <b>" + scrap + "</b> / " + SCRAP_PER_SUPPLY + " → 補給1</span>"
    + button("補給へ替える", "convert-scrap", scrap < SCRAP_PER_SUPPLY || state.run.supplies >= supplyTotal(), "tiny-button")
    + "</div></section>"
    + treatment
    + helpDetails("supply-rules", "補給のルール", ruleGrid([
      { glyph: "supply", title: "総数", value: supplyTotal() + " 個で固定", line: "報酬では増えません。総数はギルドの「開始補給」で伸びます。" },
      { glyph: "multiply", title: "取り合い", value: "再挑戦・引き直し・野営", line: "先に使った分は、残りの用途へ回りません。", tone: "bad" },
      { glyph: "reroll", title: "屑から戻す", value: "屑 " + SCRAP_PER_SUPPLY + " → 補給 1", line: "戻せるのは使った分だけで、総数は超えません。", tone: "good" },
    ]));
}


// issue #235 — 旧「戦闘」タブ。**準備タブ（スキル・装備・補給）と役が違う。**
// ここは「次の一戦へ進む」と、遠征そのものをどうするか（隊列の顔ぶれ・撤退・セーブ）を
// 決める場所で、他の三枚のように何度も往復するタブではない。
function renderMap() {
  const ruleBody = ruleGrid([
    isCampaignRun()
      ? { glyph: "vitality", title: "HP", value: "次の戦闘へ持ち越す", line: "全回復するのは4戦目・8戦目のボス後だけ。敵を残して待っても戻りません。", tone: "bad" }
      : { glyph: "vitality", title: "HP・装備耐久", value: "戦闘後に最大へ戻る", line: "この遠征では持ち越しません。", tone: "good" },
    { glyph: "person", title: "隊列", value: "⇅ 隊列 でいつでも", line: "どのタブからでも組み替えられます。" },
    { glyph: "might", title: "前列", value: "武器攻撃が通る", line: "前列の人数で、狙われ方も変わります。" },
    { glyph: "focus", title: "後列", value: "技術の攻撃と支援向き", line: "武器攻撃は後列から出すと大きく落ちます。" },
  ]) + "<div class=\"map-legend-help\"><div class=\"map-legend\" aria-label=\"戦闘マップの凡例\">"
    + "<span><i class=\"map-legend-mark state-done\" aria-hidden=\"true\">✓</i>クリア済み</span>"
    + "<span><i class=\"map-legend-mark state-current\" aria-hidden=\"true\"></i>現在地</span>"
    + "<span><i class=\"map-legend-mark state-unreached\" aria-hidden=\"true\"></i>未到達</span>"
    + "<span><i class=\"map-legend-symbol kind-elite\" aria-hidden=\"true\">◆</i>精鋭</span>"
    + "<span><i class=\"map-legend-symbol kind-boss\" aria-hidden=\"true\">★</i>ボス</span>"
    + "</div></div>";
  const canRetreat = !state.prologueActive && !supplyTutorialVisible();
  const expeditionTools = "<section class=\"card expedition-tools\">"
    + sectionHeading("EXPEDITION", "遠征をいったん離れる")
    + "<div class=\"expedition-tool-row\">"
    + button("セーブ / ロード", "open-save-menu", false, "button", "data-return=\"camp\"")
    + (canRetreat ? button("安全に撤退する", "abandon-run", false, "button quiet") : "")
    + "</div>"
    + (canRetreat
      ? ruleGrid([{ glyph: "funds", title: "撤退", value: "確定分だけ持ち帰る", line: "遠征はそこで終わります。技能点・装備・補給は残りません。" }])
      : "")
    + "</section>";
  return encounterArchive({ currentIndex: state.run.encounterIndex })
    + expeditionTools
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
    + "<p><b>" + esc(treatment?.displayName ?? "治療") + "</b> " + esc(targetNames)
    + " <span class=\"muted\">· 補給 " + result.supplies + "</span></p>"
    + complete + "</div>";
}

// issue #159 — 治療の対象は上端の共通盤面から選ぶ。**治療のためだけの三つ目の
// 仲間一覧を作らない。**候補・対象外・選択中の治療名・取り消しは、すべて盤面と
// その一行（partyCellRole / partyBoardNote）が持つので、このタブには何も足さない。

const TREATMENT_GLYPHS = Object.freeze({
  concentrated: "vitality",
  full_party: "camp",
  revive: "person",
});

function campTreatmentBlock() {
  const tutorial = supplyTutorialVisible();
  const selectedTreatment = state.treatmentSelection ? CAMP_TREATMENTS[state.treatmentSelection] : null;
  const rows = Object.values(CAMP_TREATMENTS).map((treatment) => {
    const applicable = treatmentTargetIds(treatment).length > 0;
    const blockedByTutorial = tutorial && treatment.id !== "concentrated";
    const blockedBySelection = state.treatmentSelection && state.treatmentSelection !== treatment.id;
    const disabled = blockedByTutorial || blockedBySelection || state.run.supplies < 1 || !applicable;
    const actionLabel = treatment.targetCount === "all"
      ? "補給1"
      : state.treatmentSelection === treatment.id
        ? "選び直す"
        : "対象を選ぶ";
    // 治療の行も投資の行と同じ三列（記号・中身・払うもの）で組む。
    return "<div class=\"purchase-row" + (state.treatmentSelection === treatment.id ? " treatment-selected" : "")
      + "\"><span class=\"purchase-mark\">" + glyph(TREATMENT_GLYPHS[treatment.id] ?? "camp") + "</span>"
      + "<span class=\"purchase-copy\"><b>" + esc(treatment.displayName)
      + "</b><small>" + esc(treatment.summary) + "</small></span>"
      + "<span class=\"purchase-buy\">"
      + button(actionLabel, "treat", disabled, "tiny-button primary-mini", "data-treatment=\"" + esc(treatment.id) + "\"")
      + "</span></div>";
  }).join("");
  return "<section class=\"card\">" + sectionHeading("CAMP TREATMENT", "野営治療",
      "<span class=\"stage\">補給 " + state.run.supplies + "</span>")
    + treatmentResultBlock() + rows
    + helpDetails("treatment-rules", "治療の対象", ruleGrid([
      { glyph: "vitality", title: "集中治療", value: "負傷した生存者", line: "治療を選んだあと、対象を選びます。" },
      { glyph: "person", title: "蘇生", value: "戦闘不能者だけ", line: "治療を選んだあと、対象を選びます。" },
      { glyph: "camp", title: "全体手当", value: "生存者全員", line: "対象は選びません。" },
    ]))
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
    // issue #238 — 放ち終えた仲間は必殺を持ち込めない。**回数表も鍵に入れる**
    // （入れないと、放った直後に「まだ出る」と言う古い予測が残る）。
    state.run.ultimatesUsed,
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

// ============================================================ 仲間の共通盤面（issue #159）
//
// **キャンプの主語は「誰がどこにいるか」で、それは一つしかない。**
//
// 以前は同じ仲間を選ぶ表示が四つあった——上端の横並び予測チップ、編成タブの隊列盤と
// キャラクターカード、技能タブの仲間タブ、装備タブの仲間タブと対象カード。タブを移る
// たびに「いま誰を触っているか」を探し直すことになり、予測を見ながら組み替えるという
// この遠征の中心の操作が、画面ごとに分断されていた（作者試遊、2026-09-06）。
//
// だから **`POSITIONS` そのままの3列×2行を上端に一つだけ置き、タブは操作だけを
// そこへ掛ける。**盤面の形・並び・情報項目は戦闘中の `battleRowsHtml` と同じで、
// キャンプで見ていた並びがそのまま戦闘の盤面になる。
//
// **セルが持つのは五つだけ。**顔と名前、HP（予測があれば開始→終了）、減少量、
// 残HPの数、行動点／反応点の丸（issue #177 の「丸は払うものだけ」）。
// 立ち位置は文字で書かない——**セルが盤面のどこにあるかが、それを出している。**
const BOARD_ROWS = [
  { row: "front", label: "前列" },
  { row: "rear", label: "後列" },
];

// **タブごとに変わるのはここだけ。**盤面そのものは一つで、掛かる操作が入れ替わる。
//
//   編成 … セル（空き枠を含む）を押して選択・移動・交換する
//   技能／装備 … 人物を選ぶだけで、隊列は動かさない
//   補給 … 通常は何も起きない。単体治療・蘇生を選んだあいだだけ対象選択になる
//   戦闘 … 見るだけ
// issue #235 — 盤面の役は**タブではなく盤面の状態**で決まる。編成タブを廃止したので、
// 隊列の組み替えはどのタブからでも「⇅ 隊列」で入れる（タブを往復させない）。
// 治療の対象選びだけは、選び終わるまで他の役を上書きする。
function boardMode(tab) {
  const treatment = CAMP_TREATMENTS[state.treatmentSelection];
  if (tab === "supplies" && treatment && treatment.targetCount !== "all") return "treat";
  if (state.formationMode) return "formation";
  // issue #159 — 補給タブは、治療を選ぶまで**誰を選ぶ場面でもない**。押せる形にしない。
  return tab === "supplies" ? "none" : "select";
}

function partyCellRole(mode, position, characterId) {
  if (mode === "formation") {
    // 行と居る人は**枠そのものが名乗る。**隊列チュートリアルが光らせる先も、
    // 通しの検査が押す先も、この二つの印だけで指せる（位置の綴りを写さない）。
    return {
      action: "place-character",
      attrs: "data-position=\"" + esc(position) + "\" data-row=\"" + esc(positionRow(position) ?? "")
        + "\"" + (characterId ? " data-character=\"" + esc(characterId) + "\"" : ""),
      selected: Boolean(characterId) && selectedFormationCharacter() === characterId,
    };
  }
  if (mode === "treat") {
    const treatment = CAMP_TREATMENTS[state.treatmentSelection];
    if (!treatment || !characterId) return { action: null };
    return {
      action: "select-treatment-target",
      attrs: "data-treatment=\"" + esc(treatment.id) + "\" data-character=\"" + esc(characterId) + "\"",
      selected: false,
      picking: true,
      // 対象外は**押せない状態で残す**。消すと「誰が対象になり得るのか」が読めない。
      disabled: !treatmentTargetIds(treatment).includes(characterId),
    };
  }
  if (mode === "none" || !characterId) return { action: null };
  return {
    action: "select-character",
    attrs: "data-character=\"" + esc(characterId) + "\"",
    selected: selectedCharacter() === characterId,
  };
}

// セルの中身。予測があれば開始HP→終了HPと減少量、無ければ現在HPだけを同じ形で出す。
function partyCellPerson(characterId, entry) {
  const definition = PLAYABLE_CONTENT.characters[characterId] ?? {};
  const ceiling = Math.max(1, entry?.maxHp || maxHp(characterId) || 1);
  const now = Math.max(0, Math.min(ceiling, currentHp(characterId)));
  const ending = entry ? Math.max(0, Math.min(ceiling, entry.endingHp)) : now;
  const starting = entry ? Math.max(ending, Math.min(ceiling, entry.startingHp)) : now;
  const pct = (value) => Math.max(0, Math.min(100, Math.round((value / ceiling) * 1000) / 10));
  // 減少量が主役。**±0 と回復（＋）を別の色で出す**（装備を替えた効きが一目で分かる）。
  const lost = entry ? entry.hpLost : 0;
  const deltaText = lost > 0 ? "−" + lost : lost < 0 ? "＋" + Math.abs(lost) : "±0";
  const deltaClass = entry?.defeated ? "fatal" : lost > 0 ? "down" : lost < 0 ? "up" : "flat";
  const barLabel = entry
    ? "HP " + starting + " から " + ending + "（" + (entry.defeated ? "戦闘不能" : deltaText) + "）"
    : "HP " + now + " / " + ceiling;
  const ap = definition.baseActionPoints ?? 0;
  const rp = definition.baseReactionPoints ?? 0;
  // issue #238 / 作者指摘 2026-09-13 — **誰が必殺を残していて、誰が使い終えたかは
  // 盤面から読めなければならない**（技能タブを開かないと分からない、にしない）。
  // 印は四段（残っている／構えた／この一戦で出る／もう放った）で、`ultimateCellMark` が決める。
  const ultimateMark = ultimateCellMark(characterId);
  // issue #235 — セルは**2行**。1行目に人物と1ラウンドの資源、2行目にHPと増減を置く。
  // 4行積みは1セル67px・固定領域234pxで、iPhoneの画面の3割を常時奪っていた。
  // **出す情報は一つも減らさずに**、行だけを畳む（数値はバーの上へ重ねる）。
  // 顔を識別の主語にするため、狭いセルの顔の上へ名前と職種アイコンは重ねない。
  // AP/RP と必殺印は下部の情報帯へ残し、HP と増減をそのさらに下へ置く。
  return characterFaceWatermark(characterId, "party-character-face")
    + "<span class=\"forecast-info-layer\"><span class=\"forecast-member-head\">"
    + ultimateMark + "<span class=\"party-res\" role=\"img\" aria-label=\"1ラウンドに払える 行動点" + ap
    + " · 反応点" + rp + "\">" + pips(ap, "ap") + pips(rp, "rp") + "</span></span>"
    + "<span class=\"party-figures\">"
    + "<span class=\"forecast-hp-bar\" role=\"img\" aria-label=\"" + esc(barLabel) + "\">"
    + "<span class=\"forecast-hp-end\" style=\"width:" + pct(ending) + "%\"></span>"
    + "<span class=\"forecast-hp-loss\" style=\"width:" + pct(starting - ending) + "%\"></span>"
    // issue #237 — **この数が、装備と技能を替えた効きの受け皿である。**
    // 予測が良くなれば金、悪くなれば赤で一度光る（操作の側は何も申告しない）。
    + "<span class=\"forecast-hp-values\" data-fx-watch=\"hp:" + esc(characterId) + "\"><b>"
    + ending + "</b><small>/" + ceiling + "</small></span></span>"
    + (entry
      // 増減そのものも読み値である。**終了HPが同じでも、倒れるかどうかは変わる回がある。**
      ? "<span class=\"forecast-delta " + deltaClass + "\" data-fx-watch=\"delta:" + esc(characterId) + "\">"
        + esc(entry.defeated ? "倒れる" : deltaText) + "</span>"
      : "")
    + "</span></span>";
}

function partyCell(position, mode, byCharacter) {
  const characterId = positionOwner(position);
  const entry = characterId ? byCharacter.get(characterId) : null;
  const role = partyCellRole(mode, position, characterId);
  const classes = ["party-cell"];
  if (!characterId) classes.push("empty");
  if (entry) classes.push("forecast-member");
  if (entry?.defeated || (characterId && currentHp(characterId) <= 0)) classes.push("defeated");
  if (role.selected) classes.push("selected");
  if (role.picking) classes.push(role.disabled ? "unpickable" : "pickable");
  const body = characterId
    ? partyCellPerson(characterId, entry)
    : "<span class=\"party-empty\" aria-hidden=\"true\">＋</span><span class=\"party-empty-text\">空き枠</span>";
  const label = characterId
    ? characterName(characterId) + " · " + positionText(position)
    : "空き枠 · " + positionText(position);
  // issue #237 — 反応の宛先は**立ち位置**にする。人物で指すと、隊列を入れ替えたときに
  // 「動いた枠」ではなく「動いた人」しか光らず、空いた側の枠が黙る。
  const fxKey = " data-fx=\"cell:" + esc(position) + "\"";
  if (!role.action) {
    return "<div class=\"" + classes.join(" ") + "\"" + fxKey + " role=\"img\" aria-label=\"" + esc(label) + "\">"
      + body + "</div>";
  }
  return "<button type=\"button\" class=\"" + classes.join(" ") + "\" data-action=\"" + role.action + "\" "
    + role.attrs + fxKey + " aria-label=\"" + esc(label) + "\" aria-pressed=\"" + (role.selected ? "true" : "false") + "\""
    + (role.disabled ? " disabled aria-disabled=\"true\"" : "") + ">" + body + "</button>";
}

// 盤面の下の一行。**二手続きの操作だけが説明を要る**（編成の移動先、治療の対象）。
// 技能・装備は選んだセルが光るだけで足りるので、何も足さない。
function partyBoardNote(mode) {
  if (mode === "formation") {
    // **二手続きの操作だけが説明を要る。**選ぶ前と選んだ後で、次の一手だけを言う。
    const instruction = selectedFormationCharacter() ? "移動先の枠へ" : "動かす仲間を選ぶ";
    return "<p class=\"party-note\" role=\"status\"><span>" + esc(instruction) + "</span></p>";
  }
  if (mode === "treat") {
    const treatment = CAMP_TREATMENTS[state.treatmentSelection];
    if (!treatment) return "";
    return "<p class=\"party-note picking\" role=\"status\"><span><b>" + esc(treatment.displayName)
      + "</b>の対象を1人"
      + (treatment.revive ? "（戦闘不能のみ）" : "（負傷のみ）") + "</span>"
      + button("やめる", "cancel-treatment-target", false, "tiny-button") + "</p>";
  }
  return "";
}

// ============================================================ 手取りチュートリアルの札（共通）
//
// **札は一種類しか無い。**隊列・技能・補給・必殺技の四つは、どれも
// 「いま押す一箇所を光らせる → それ以外を錠で閉じる → 押したら次の段へ進む」
// という同じ形なので、**見た目と組み立ても一箇所から出す。**
//
// 作者要望 2026-09-14（デザイン面の改善）— 以前は四つが別々に <section> を
// 組んでいて、進捗（手順 n/N）が出るのは補給だけ、段の一覧は縦に積むだけだった。
// 札が育つと固定帯の下の本文が押し出されるので、**段の一覧は横一列の小さな印**に
// する。次に何が来るかは読めて、高さは一行で済む。
//
//   marks … [段id, 短い名前] の並び。**名前は「何を押すか」だけ**にする
//           （押し方は見出しと本文が言っている）。
//   step  … いまの段。marks に無い段（"done" など）は「全部済み」と読む。
function tutorialNoteCard({ kind, eyebrow, title, body, marks, step, extra = "" }) {
  const order = marks.map(([id]) => id);
  const index = order.indexOf(step);
  const complete = index < 0;
  const current = complete ? marks.length : index;
  const list = marks.map(([id, label], position) => {
    const mark = complete || current > position ? "done" : id === step ? "current" : "todo";
    return "<li class=\"" + mark + "\"><span>" + (position + 1) + "</span><i>" + label + "</i></li>";
  }).join("");
  // **貼りつくのは錠が掛かっているあいだだけ。**錠が外れた段（"done"）まで帯の下に
  // 居座ると、そこから先の自由な探索（技能・装備・予測）で画面を食うだけになる。
  const pinned = tutorialGate()?.locked ? " pinned" : "";
  return "<section class=\"card tutorial-note-card " + kind + "-tutorial" + pinned + "\" role=\"status\">"
    + "<p class=\"tutorial-head\"><span class=\"eyebrow\">" + esc(eyebrow) + "</span>"
    + "<span class=\"tutorial-progress\">手順 <b>" + Math.min(current + 1, marks.length)
    + "/" + marks.length + "</b></span></p>"
    + "<h3>" + title + "</h3>"
    + "<p class=\"tutorial-note\">" + body + "</p>"
    + "<ol class=\"tutorial-steps\">" + list + "</ol>" + extra + "</section>";
}

// ============================================================ 補給チュートリアル（共通の手取り型）
//
// **文章だけで操作を探させない。**補給の導入も、隊列・技能・必殺技と同じく
// 「いま押す一箇所を光らせる → それ以外を錠で閉じる → 押したら次の段へ進む」
// という形にする。
//
//   treatment … 「集中治療」を押す
//   target    … 回復する仲間のセルを押す
//
// 集中治療の対象は複数あり得るので、target では有効なセルをすべて光らせる。
// どれを選んでも同じ一手が完了するため、特定の人物へ画面を固定しない。
//
// 作者要望 2026-09-14 — 出る場所を**二戦目の後**へ送った。一戦目の後は技能の
// 取得・予約を教える（下の `skillLessonStep`）。判定は
// `SUPPLY_TUTORIAL_ENCOUNTER_INDEX` 一箇所だけを読む。
function supplyTutorialStep() {
  if (!supplyTutorialVisible()) return null;
  // 作者指摘 2026-09-14 — **「補給」というものがある、から教える。**以前はキャンプが
  // 勝手に補給タブを開いていたので、開いた先の釦だけが説明されて、**その資源が
  // 何なのか**（遠征に持っていく数の決まった道具で、三つの用途で取り合う）は
  // タブの中の畳んだ段にしか無かった。自分でタブを押す一手を先頭に足す。
  if (state.tab !== "supplies") return "tab";
  return state.treatmentSelection === "concentrated" ? "target" : "treatment";
}

function supplyTutorialLocked() {
  return supplyTutorialStep() !== null;
}

// タブを補給へ閉じ込めるのは、**タブを自分で押したあと**の段だけ（技能と同じ理由）。
function supplyTutorialTabLocked() {
  const step = supplyTutorialStep();
  return step !== null && step !== "tab";
}

function supplyTutorialSpotSelector(step) {
  return {
    tab: "nav.tabs [data-tab=\"supplies\"]",
    treatment: "[data-action=\"treat\"][data-treatment=\"concentrated\"]:not([disabled])",
    target: "[data-action=\"select-treatment-target\"][data-treatment=\"concentrated\"]:not([disabled])",
  }[step] ?? null;
}

function supplyTutorialNote() {
  const step = supplyTutorialStep();
  if (!step) return "";
  const copy = {
    tab: {
      title: "補給を持っています",
      body: "<b>補給は、この遠征へ持ってきた" + supplyTotal() + "個だけの道具です。</b>"
        + "再挑戦・装備の引き直し・野営の治療が、この同じ" + supplyTotal()
        + "個を取り合います（戦って増えることはありません）。"
        + "光っている「補給」タブを押してください。",
    },
    treatment: {
      title: "次の戦いに備えましょう",
      body: "<b>傷は次の一戦へ持ち越します。</b>"
        + "ここでは1個使って傷を戻します。光っている「集中治療」を押してください。",
    },
    target: {
      title: "誰を治すかを選ぶ",
      body: "補給はまだ消費していません。光っている傷ついた仲間のセルを押してください。",
    },
  }[step];
  return tutorialNoteCard({
    kind: "supply",
    eyebrow: "補給チュートリアル",
    title: copy.title,
    body: copy.body,
    marks: [["tab", "補給タブ"], ["treatment", "集中治療"], ["target", "回復する仲間"]],
    step,
  });
}

// ============================================================ 技能チュートリアル（作者要望 2026-09-14）
//
// **一戦目の勝利で入った技能点を、その場で使わせる。**
//
// 作者要望 —「一戦目後: スキル取得・予約のチュートリアル」。技能点は一戦ごとに
// 全員へ1点入るのに、入った点の使い道（技能ツリー）を画面から教える場所が無く、
// 「技能のルール」の畳んだ段を自分で開くしかなかった。
//
// 教えるのは**二手の違い**である。
//
//   取得 … いまの1点で届く節を、いま取る（`SKILL_LESSON.unlockSkillId`）
//   予約 … いまは前提の段が足りない節を、先に指す（`SKILL_LESSON.reserveSkillId`）
//
// 錠は最後の一手まで掛かる。**タブと人物と節を選ぶ手も段に数える**——押す場所が
// タブの奥・盤面・地図の中に散っているので、「どれを押すのか」が段の側に無いと、
// 結局どこかで探し回ることになる（作者指摘 2026-09-14、二度目）。
//
//   tab     … 「スキル」タブを押す（技能の地図はこのタブの中にある）
//   pick    … 盤面で払う相手を押す（点は人物ごとに持つ）
//   open    … 取得する節を押す（操作盤がその節で開く）
//   unlock  … 操作盤の「解禁」を押す
//   aim     … 予約する節を押す（操作盤の「✕」も押せる。下を参照）
//   reserve … 操作盤の「Lv1まで予約」を押す
//   handoff … もう一人を押す（**ここから先は自分で決める**という受け渡し）
//   done    … 錠は外れる。**光らせる先も置かない**——ゴウの1点をどう使うかは、
//             急かさずに悩んでもらう場面である（作者要望 2026-09-14）。
//
// **教える二手は content が決める**（`SKILL_LESSON.tutorial`）。技能 id をここへ
// 書き写さないので、content を変えれば錠と光も一緒に動く。
const SKILL_LESSON_GOAL = SKILL_LESSON.tutorial ?? null;

function skillLessonNode(skillId) {
  return SKILL_TREE_NODES.find((node) => node.skillId === skillId) ?? null;
}

// 最後に受け渡す相手。**content は「教える側」だけを持つ**ので、受け取る側は
// 同行者から引く（二人目が居ない編成では、この段ごと落ちる）。
function skillLessonHandoffId() {
  return state.run.roster.find((id) => id !== SKILL_LESSON_GOAL?.characterId) ?? null;
}

function skillLessonStep() {
  if (state.phase !== "camp" || !SKILL_LESSON_GOAL || !skillLessonVisible()) return null;
  const { characterId, unlockSkillId, reserveSkillId } = SKILL_LESSON_GOAL;
  if (!state.run.roster.includes(characterId)) return null;
  // 節が今回の manifest から外れていたら、教材そのものが無いので黙って出さない。
  if (!inManifest(unlockSkillId) || !inManifest(reserveSkillId)) return null;
  // **受け渡しが済んだら、もう段は戻らない。**ここから先は自由に触れる場面なので、
  // タブを移ろうと誰を選び直そうと "done" のままにする（印を持たずに画面の状態から
  // 導くと、ツグミを選び直した拍に錠が戻り、押せる場所が一つだけの画面に落ちる）。
  const handoffId = skillLessonHandoffId();
  const reserved = skillReservationFor(state.run, characterId) === reserveSkillId;
  if (state.skillLessonHandedOff || (reserved && !handoffId)) return "done";
  if (state.tab !== "skills") return "tab";
  // **予約まで済んだら、選んでいる人物で段を戻さない。**受け渡しの段では相手を
  // もう一人へ変えさせるので、「教える相手が選ばれているか」を先に見ると、
  // ゴウを押した拍に `pick` へ巻き戻ってしまう。
  if (reserved) return selectedCharacter() === handoffId ? "done" : "handoff";
  if (selectedCharacter() !== characterId) return "pick";
  if (!isUnlocked(characterId, unlockSkillId)) {
    return state.selectedSkillNode === unlockSkillId ? "unlock" : "open";
  }
  return state.selectedSkillNode === reserveSkillId ? "reserve" : "aim";
}

// 錠が掛かるのは受け渡しまで。"done" は何も塞がず、何も光らせない。
function skillLessonLocked() {
  const step = skillLessonStep();
  return step !== null && step !== "done";
}

// タブを技能へ閉じ込めるのは、**タブを自分で押したあと**の段だけ。一手目は
// 「スキルタブを押す」なので、ここで閉じ込めるとその一手が打てない。
function skillLessonTabLocked() {
  const step = skillLessonStep();
  return step !== null && step !== "tab" && step !== "done";
}

// 光らせる先。**選択子はこの表にしかない。**地図の節・操作盤の釦と綴りを分けない。
function skillLessonSpotSelector(step) {
  const goal = SKILL_LESSON_GOAL;
  if (!goal) return null;
  const node = (skillId) => ".skill-tree-forest [data-action=\"select-skill-node\"][data-skill=\""
    + skillId + "\"]";
  const cell = (characterId) => ".camp-top [data-action=\"select-character\"][data-character=\""
    + characterId + "\"]";
  return {
    tab: "nav.tabs [data-tab=\"skills\"]",
    pick: cell(goal.characterId),
    open: node(goal.unlockSkillId),
    unlock: ".skill-sheet [data-action=\"unlock-skill\"][data-character=\"" + goal.characterId
      + "\"][data-skill=\"" + goal.unlockSkillId + "\"]:not([disabled])",
    aim: node(goal.reserveSkillId),
    // **予約は「Lv1まで」の一つだけを光らせる。**同じ節には上限までの予約も並ぶが、
    // 教えるのは「届かない先を指す」ことであって、上限まで積むことではない。
    reserve: ".skill-sheet [data-action=\"reserve-skill\"][data-skill=\"" + goal.reserveSkillId
      + "\"][data-target-level=\"" + MIN_SKILL_LEVEL + "\"]",
    handoff: cell(skillLessonHandoffId()),
    done: null,
  }[step] ?? null;
}

// 光らせはしないが、**押せるようにはしておく先**（作者指摘 2026-09-14）。
//
// 取得した節の操作盤は地図の下端に貼りつくので、iPhone の窓では次に押す節
// （深さ4の「長く守る」）がその裏に隠れることがある。**閉じる手を塞いだままにすると、
// 光っている節を押せない場面が作れてしまう。**そこで「✕」だけは通す。
// 閉じても段は進まない（次の一押しは同じ節のまま）ので、教える順は崩れない。
function skillLessonAllowSelector(step) {
  return step === "aim" ? ".skill-sheet [data-action=\"select-skill-node\"].sheet-close" : null;
}

// 手引きの札。**段ごとに、次の一押しだけを言う。**（隊列・補給と同じ作り）
// 技能名・前提・点の数は節と content から引くので、ここで書き写さない。
function skillLessonNote() {
  const step = skillLessonStep();
  const goal = SKILL_LESSON_GOAL;
  if (!step || !goal) return "";
  const name = characterName(goal.characterId);
  const handoffId = skillLessonHandoffId();
  const handoffName = handoffId ? characterName(handoffId) : "";
  const unlockLabel = nameFor(goal.unlockSkillId);
  const reserveLabel = nameFor(goal.reserveSkillId);
  const unlockNode = skillLessonNode(goal.unlockSkillId);
  const reserveNode = skillLessonNode(goal.reserveSkillId);
  const cost = unlockNode?.cost ?? 1;
  // 予約先が待っている前提は**節のデータから**出す（「傷へ盾を Lv3」を手で書かない）。
  const gate = (reserveNode?.requires ?? [])
    .map((required) => nameFor(required.skillId) + " Lv" + required.minLv)
    .join("・");
  const copy = {
    tab: {
      title: "技能点が入りました",
      body: "<b>" + esc(SKILL_LESSON.pointHint) + "</b>"
        + "使い道は「スキル」タブの中にあります。光っているタブを押してください。",
    },
    pick: {
      title: "誰に払うかを選ぶ",
      body: "<b>" + esc(SKILL_LESSON.ownerHint) + "</b>"
        + "上の盤面で光っている" + esc(name) + "のセルを押してください。",
    },
    open: {
      title: "取る技能を選ぶ",
      body: "地図の節が" + esc(name) + "の技能です。"
        + "いま" + cost + "点で取れる「" + esc(unlockLabel) + "」が光っています。押してください。",
    },
    unlock: {
      title: esc(unlockLabel) + "を取得する",
      body: "<b>" + esc(SKILL_LESSON.unlockHint) + "</b>"
        + "光っている「解禁」を押してください。",
    },
    aim: {
      title: "いまは届かない先を指す",
      body: "<b>" + esc(SKILL_LESSON.reachHint) + "</b>"
        + "「" + esc(reserveLabel) + "」は"
        + (gate ? esc(gate) + "が要ります。" : "前提がまだ足りません。")
        + "予約しておけば" + esc(SKILL_LESSON.meritHint)
        + "光っているその節を押してください（操作盤が邪魔なら「✕」で閉じられます）。",
    },
    reserve: {
      title: esc(reserveLabel) + "を予約する",
      body: "<b>" + esc(SKILL_LESSON.reserveHint) + "</b>"
        + "光っている「Lv" + MIN_SKILL_LEVEL + "まで予約」を押してください。",
    },
    handoff: {
      title: "ここから先は自分で決める",
      body: "<b>" + esc(SKILL_LESSON.doneHint) + "</b>"
        + "光っている" + esc(handoffName) + "のセルを押してください。"
        + esc(handoffName) + "にも1点入っています。",
    },
    done: {
      title: esc(handoffName || name) + "の1点は自由です",
      body: "<b>" + esc(SKILL_LESSON.freeHint) + "</b>"
        + "取っても、取らずに残して予約だけしても構いません。"
        + "決めたら、上の「実戦」で次の一戦へ進んでください。",
    },
  }[step];
  return tutorialNoteCard({
    kind: "skill",
    eyebrow: "技能チュートリアル",
    title: copy.title,
    body: copy.body,
    marks: [
      ["tab", "スキル"],
      ["pick", esc(name)],
      ["open", esc(unlockLabel)],
      ["unlock", "解禁"],
      ["aim", esc(reserveLabel)],
      ["reserve", "予約"],
      ...(handoffId ? [["handoff", esc(handoffName)]] : []),
    ],
    step,
  });
}

// ============================================================ 隊列チュートリアル（R11 §5 改）
//
// **巻き戻したあとの並べ替えだけは、押す場所が光り、そこしか押せない。**
//
// 作者指摘 2026-09-12 —「最初のチュートリアル、並べ替えてツグミを後ろに下げる部分を
// ちゃんとしたチュートリアルにしてほしい。押すべき場所が光って、そこしか押せなくなる、
// よくあるチュートリアル」。ここは手引きの一段落しか無く、盤面もタブもセーブも全部
// 押せた。**一手の場所を言葉で書いても、初めての人はまずどこを押すのかを探す。**
//
// 錠は**並べ替えの三手だけ**に掛ける（DESIGN.md §6.4.4）。教える一手が終われば錠は
// 外れ、技能も装備も予測も自由に触れる。**教えるのは一手であって、遠征の触り方を
// 全部禁じるのではない。**
//
//   open  … 「⇅ 隊列」を押す
//   pick  … 動かす仲間のセルを押す
//   place … 後列の空き枠を押す
//   done  … 一手が済んだ。錠は外れ、次の一押し（この敵に挑む）だけが光る
//
// **教える一手は content が決める**（`PROLOGUE.tutorial`）。人物 id と行をここへ
// 書き写さないので、content を変えれば錠と光も一緒に動く。
const FORMATION_TUTORIAL_GOAL = PROLOGUE.tutorial ?? null;

function formationTutorialStep() {
  if (state.phase !== "camp" || !FORMATION_TUTORIAL_GOAL) return null;
  if (!state.prologueActive || state.prologueStage !== "retry") return null;
  const { characterId, row } = FORMATION_TUTORIAL_GOAL;
  if (!state.run.roster.includes(characterId)) return null;
  if (positionRow(state.run.formation?.[characterId]) === row) return "done";
  if (!state.formationMode) return "open";
  return selectedFormationCharacter() === characterId ? "place" : "pick";
}

// 錠が掛かるのは並べ替えの三手だけ。"done" は光らせるだけで、何も塞がない。
function formationTutorialLocked() {
  const step = formationTutorialStep();
  return step !== null && step !== "done";
}

// 光らせる先。**選択子はこの表にしかない。**画面と検査が別々の綴りを持つと、
// 盤面の書き方が変わったときに「光らない錠」だけが残る。
function formationTutorialSpotSelector(step) {
  const goal = FORMATION_TUTORIAL_GOAL;
  if (!goal) return null;
  return {
    open: ".camp-top [data-action=\"toggle-formation-mode\"]",
    pick: ".camp-top [data-action=\"place-character\"][data-character=\"" + goal.characterId + "\"]",
    // 移動先は**空いている枠だけ。**人の乗った枠は入れ替えになるので光らせない。
    place: ".camp-top [data-action=\"place-character\"][data-row=\"" + goal.row + "\"]:not([data-character])",
    done: "[data-action=\"begin-stage\"]",
  }[step] ?? null;
}

// いま掛かっている手取りの錠。**同時に二つは掛からない**——隊列チュートリアルは
// Stage 0 の巻き戻し直後、技能チュートリアルは本編第1戦の勝利直後、補給チュートリアルは
// 第2戦の勝利直後、必殺技の一戦は Stage 1 の第1戦だけで、場面が重ならない。
// 画面・押せる経路・通しの検査は、この一つの形（段・錠・光らせる先）だけを読む。
function tutorialGate() {
  const formation = formationTutorialStep();
  if (formation) {
    return {
      id: "formation",
      step: formation,
      locked: formationTutorialLocked(),
      selector: formationTutorialSpotSelector(formation),
    };
  }
  const skill = skillLessonStep();
  if (skill) {
    return {
      id: "skill",
      step: skill,
      locked: skillLessonLocked(),
      selector: skillLessonSpotSelector(skill),
      allow: skillLessonAllowSelector(skill),
    };
  }
  const supply = supplyTutorialStep();
  if (supply) {
    return {
      id: "supply",
      step: supply,
      locked: supplyTutorialLocked(),
      selector: supplyTutorialSpotSelector(supply),
    };
  }
  const ultimate = ultimateLessonStep();
  if (ultimate) {
    return {
      id: "ultimate",
      step: ultimate,
      locked: ultimateLessonLocked(),
      selector: ultimateLessonSpotSelector(ultimate),
    };
  }
  return null;
}

// **錠と光は描画のあとに一度で掛ける。**画面ごとに同じ条件を書き写すと、
// いつか片方だけが直る（`disabled` は釦にしか効かないので、釦以外は CSS で止める）。
function applyTutorialGate() {
  const gate = tutorialGate();
  if (!gate) return;
  const spots = gate.selector ? [...app.querySelectorAll(gate.selector)] : [];
  for (const spot of spots) spot.classList.add("tutorial-spot");
  if (!gate.locked) return;
  // **光る先＋「光らせないが通す先」**が、押してよい全部である（`tutorialOpenings`）。
  const open = gate.allow ? [...spots, ...app.querySelectorAll(gate.allow)] : spots;
  for (const element of app.querySelectorAll("[data-action]")) {
    if (open.some((allowed) => allowed === element || allowed.contains(element))) continue;
    element.classList.add("tutorial-blocked");
    element.setAttribute("aria-disabled", "true");
    if ("disabled" in element) element.disabled = true;
  }
}

// 作者要望 2026-09-14（デザイン面の改善）— **光る先を、こちらから探しに行かせない。**
//
// 技能チュートリアルの押し先は、貼りつく帯の下をかなり送った先（技能ツリーの節、
// その下の操作盤）にある。錠が掛かっているので押せる場所は一つしか無いのに、
// 初めて開いた人は「光っているものが画面に無い」状態から探すことになる。
// **段が変わった回だけ**、光る先が窓の外なら寄せる（`focusSelectedSkillNode` と
// 同じ作法で、既に見えているときは動かさない——指の下で画面が滑るのを避ける）。
let focusedTutorialSpot = null;

function focusTutorialSpot() {
  const gate = tutorialGate();
  const key = gate ? gate.id + ":" + gate.step : null;
  if (!key) {
    focusedTutorialSpot = null;
    return;
  }
  if (key === focusedTutorialSpot) return;
  focusedTutorialSpot = key;
  const spot = gate.selector ? app.querySelector(gate.selector) : null;
  if (!spot) return;
  // 貼りつく帯の中（タブ・盤面のセル）は、どこまで送っても見えている。寄せない。
  if (spot.closest(".camp-top")) return;
  const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
  // 横の帯（技能ツリー）は帯ごと、縦はページごと寄せる。見える範囲の上端は
  // **貼りついた帯の下**——そこより上へ寄せると、札の裏に光る先が隠れる。
  const band = spot.closest(".skill-tree-scroll");
  const rect = spot.getBoundingClientRect();
  const margin = 12;
  if (band) {
    const bandRect = band.getBoundingClientRect();
    if (rect.left < bandRect.left + margin || rect.right > bandRect.right - margin) {
      band.scrollTo({
        left: band.scrollLeft + (rect.left + rect.width / 2) - (bandRect.left + bandRect.width / 2),
        behavior,
      });
    }
  }
  // 見える範囲は**貼りついたものの下から、貼りついた操作盤の上まで**である。
  const note = app.querySelector(".camp-view > .tutorial-note-card.pinned");
  const campBottom = app.querySelector(".camp-top")?.getBoundingClientRect().bottom ?? 0;
  const top = Math.max(campBottom, note ? campBottom + note.getBoundingClientRect().height + 6 : 0) + margin;
  const sheet = app.querySelector(".skill-sheet");
  const bottom = (sheet?.getBoundingClientRect().top ?? window.innerHeight) - margin;
  if (rect.top < top || rect.bottom > bottom) {
    window.scrollBy({ top: rect.top - (top + Math.max(0, (bottom - top - rect.height) / 3)), behavior });
  }
}

// 錠が掛かっている間、押してよい要素かどうか。**判定は光らせる先と同じ選択子**なので、
// 「光っているのに押せない」「光っていないのに押せる」が構造として起きない。
// 長押しでしか動かない行（必殺技）もここを通る。
function tutorialAllows(element) {
  const gate = tutorialGate();
  if (!gate?.locked) return true;
  const openings = tutorialOpenings(gate);
  return Boolean(openings && element?.closest?.(openings));
}

// 押してよい先の選択子。**光る先（`selector`）に、光らせないが通す先（`allow`）を足す。**
// 足すのは「この段を進めはしないが、塞ぐと進めなくなる手」だけである（いまは技能
// チュートリアルの操作盤の「✕」——盤が次に押す節を隠すことがある）。
function tutorialOpenings(gate) {
  return [gate?.selector, gate?.allow].filter(Boolean).join(", ") || null;
}

// 手引きの札。**段ごとに、次の一押しだけを言う。**（補給チュートリアルと同じ作り）
function formationTutorialNote() {
  const step = formationTutorialStep();
  if (!step || !FORMATION_TUTORIAL_GOAL) return "";
  const name = characterName(FORMATION_TUTORIAL_GOAL.characterId);
  const rowWord = ROW_WORDS[FORMATION_TUTORIAL_GOAL.row] ?? "後列";
  const copy = {
    open: {
      title: "立ち位置を組み替える",
      body: "<b>同じ影、同じ数。違うのは立ち位置だけ。</b>"
        + "上の盤面で光っている「⇅ 隊列」を押してください。",
    },
    pick: {
      title: "動かす仲間を選ぶ",
      body: "腕力で振る武器は" + rowWord + "から出すと大きく落ち、技術で通す技は落ちない。"
        + "<b>" + esc(name) + "の攻撃は技なので、" + rowWord + "でも威力が落ちない。</b>"
        + "光っている" + esc(name) + "のセルを押してください。",
    },
    place: {
      title: rowWord + "へ下げる",
      body: "<b>敵は届く範囲で最もHPの低い者を狙う。</b>"
        + "前に二人並べば、柔らかいほうから崩れる。"
        + "光っている" + rowWord + "の空き枠を押してください。",
    },
    done: {
      title: "一手で、予測が変わる",
      body: "<b>" + esc(name) + "の応急手当は自分には効かず、被弾したゴウを後ろから手当てできる。</b>"
        + esc(PROLOGUE.retryHint),
    },
  }[step];
  return tutorialNoteCard({
    kind: "formation",
    eyebrow: "隊列チュートリアル",
    title: esc(copy.title),
    body: copy.body,
    marks: [
      ["open", "⇅ 隊列"],
      ["pick", esc(name)],
      ["place", rowWord + "の空き枠"],
    ],
    step,
  });
}

// ============================================================ 必殺技の一戦（issue #240）
//
// **必殺技をどこで覚えるのかが無かった。**#238 で仕組みは入ったが、Stage 1 から解禁
// されるだけで、画面に畳んだ説明があるだけだった（作者要望：「冒頭の先見機みたいに、
// 負けそうになって必殺技で切り返す」）。そこで**必殺が解禁される最初の Stage の
// 第1戦**を、構えないと勝てない一戦にする。
//
// **盤面と結果は content と engine が持つ**（`ULTIMATE_LESSON`、`ecology/story.test.mjs`）。
// ここにあるのは錠の側だけで、三段とも「次の一押し」しか開けない。
//
//   pick … ナギのセルを押す（技能タブは選んだ一人ぶんしか出ない）
//   arm  … 光っている装着行を**長押し**して、この一戦の必殺にする
//   open … 光っている「遠征」タブを押す（作者指摘 2026-09-13。構えた瞬間に画面が
//          勝手に跳ぶのではなく、**タブを開くのもプレイヤーの一手**にする）
//   done … 錠は外れ、次の一押し（この敵に挑む）だけが光る
//
// **巻き戻しは使わない。予測の帯が教材である。**構える前の帯は「敗北」、構えたあとの
// 帯は「勝利」で、その差が必殺ひとつぶんだと画面から読める（DESIGN.md §8.11）。
const ULTIMATE_LESSON_GOAL = ULTIMATE_LESSON.tutorial ?? null;

// この一戦が、まだ必殺技の教材であるか。**敵の差し替えと画面の錠が同じ判定を読む。**
function ultimateLessonActive() {
  if (!ULTIMATE_LESSON_GOAL || !isCampaignRun() || state.prologueActive) return false;
  if (state.run.campaignStageSequence !== ULTIMATE_MIN_STAGE_SEQUENCE) return false;
  if (state.run.encounterIndex !== ULTIMATE_LESSON_ENCOUNTER_INDEX) return false;
  if (hasStoryFlag(ULTIMATE_LESSON_FLAG)) return false;
  if (!state.run.roster.includes(ULTIMATE_LESSON_GOAL.characterId)) return false;
  return ultimatesUnlocked(state.run);
}

// 教える一手が打ててあるか。**指定と構えの両方**を見る（長押し一回で両方動く）。
function ultimateLessonArmed() {
  const goal = ULTIMATE_LESSON_GOAL;
  if (!goal) return false;
  return (state.run.loadout.ultimates?.[goal.characterId] ?? null) === goal.skillId
    && armedUltimateIds().has(goal.characterId);
}

function ultimateLessonStep() {
  if (state.phase !== "camp" || !ultimateLessonActive()) return null;
  if (!ultimateLessonArmed()) {
    return selectedCharacter() === ULTIMATE_LESSON_GOAL.characterId ? "arm" : "pick";
  }
  // 構え終わったら、次の一押しは**自分で遠征タブを開くこと**。構えた拍で画面を
  // 勝手に跳ばさない（作者指摘 2026-09-13）。
  return state.tab === "map" ? "done" : "open";
}

// 錠が掛かるのは三手のあいだだけ。"done" は光らせるだけで、何も塞がない。
function ultimateLessonLocked() {
  const step = ultimateLessonStep();
  return step !== null && step !== "done";
}

// タブそのものを閉じ込めるのは、技能タブで打つ二手のあいだだけ。**三手目は
// 「遠征タブを押す」なので、ここで閉じ込めると自分の一手が効かない。**
function ultimateLessonTabLocked() {
  const step = ultimateLessonStep();
  return step === "pick" || step === "arm";
}

// 光らせる先。**選択子はこの表にしかない。**画面と検査が別々の綴りを持つと、
// 行の書き方が変わったときに「光らない錠」だけが残る。
function ultimateLessonSpotSelector(step) {
  const goal = ULTIMATE_LESSON_GOAL;
  if (!goal) return null;
  return {
    pick: ".camp-top [data-action=\"select-character\"][data-character=\"" + goal.characterId + "\"]",
    // 長押しの行は釦ではない。**行そのもの**が押す先で、錠もここだけを通す。
    arm: ".installed-row[data-longpress][data-character=\"" + goal.characterId
      + "\"][data-skill=\"" + goal.skillId + "\"]",
    open: "nav.tabs [data-tab=\"map\"]",
    done: "[data-action=\"begin-stage\"]",
  }[step] ?? null;
}

// 手引きの札。**段ごとに、次の一押しだけを言う。**（隊列・補給チュートリアルと同じ作り）
// 変換の印（全体へ・量3倍・溜め不要）は ultimates.mjs の記録から引くので、
// ここで数字や効果を書き写さない。
function ultimateLessonNote() {
  const step = ultimateLessonStep();
  const goal = ULTIMATE_LESSON_GOAL;
  if (!step || !goal) return "";
  const name = characterName(goal.characterId);
  const skill = nameFor(goal.skillId);
  const traits = (ultimateCandidates(state.run.loadout, goal.characterId)
    .find((entry) => entry.skillId === goal.skillId)?.traitLabels ?? []).join("・");
  const forecast = battleForecast();
  const band = forecast ? (FORECAST_RESULT_LABEL[forecast.result] ?? null) : null;
  const bandLine = band
    ? "<span class=\"tutorial-forecast\">いまの予測 <b>" + esc(band) + "</b></span>"
    : "";
  const copy = {
    pick: {
      title: "構える相手を選ぶ",
      body: "<b>" + esc(ULTIMATE_LESSON.hint) + "</b>"
        + "光っている" + esc(name) + "のセルを押してください。",
    },
    arm: {
      title: esc(skill) + "を必殺技にする",
      body: "<b>必殺技は新しい技能ではなく、持っている技能に掛かる一度きりの変換です。</b>"
        + esc(name) + "の「" + esc(skill) + "」は"
        + (traits ? "必殺にすると<b>" + esc(traits) + "</b>になります。" : "必殺にすると別物になります。")
        + "光っている行を<b>長押し</b>してください。",
    },
    open: {
      title: "予測が変わった",
      body: "<b>" + esc(ULTIMATE_LESSON.armedHint) + "</b>"
        + "光っている「遠征」タブを押して、次の一戦へ進んでください。",
    },
    done: {
      title: "この敵に挑む",
      body: "<b>構えた必殺は、放たなければ減りません。</b>"
        + "放つのは<b>隊の誰かがHP" + ULTIMATE_READY_HP_PERCENT
        + "%未満になってから</b>で、放てるのは一人一遠征に一度きりです。",
    },
  }[step];
  return tutorialNoteCard({
    kind: "ultimate",
    eyebrow: "必殺技チュートリアル",
    title: copy.title,
    body: copy.body,
    marks: [
      ["pick", esc(name)],
      ["arm", "長押しで構える"],
      ["open", "「遠征」タブ"],
    ],
    step,
    extra: bandLine,
  });
}

// camp の上端に貼りつく盤面。**予測が出せない場面でも盤面は出す**——隊列と現在HPは
// 予測とは別に要る。予測の帯（勝敗・ラウンド数・開始→終了HP）だけを黙って落とす。
function partyBar(tab) {
  const mode = boardMode(tab);
  const forecast = battleForecast();
  const byCharacter = new Map((forecast?.perCharacter ?? []).map((entry) => [entry.characterId, entry]));
  const rows = BOARD_ROWS.map(({ row, label }) => {
    const cells = POSITIONS.filter((position) => position.startsWith(row + "_"))
      .map((position) => partyCell(position, mode, byCharacter)).join("");
    return "<div class=\"party-row\"><span class=\"party-row-label\">" + esc(label)
      + "</span><div class=\"party-cells\">" + cells + "</div></div>";
  }).join("");
  const encounterName = currentEncounter()?.name;
  // **「戦闘予測」と書かない。**盤面そのものが予測であり、勝敗とラウンドが右に出ている。
  const target = state.prologueActive
    ? "灰の門"
    : "第" + state.run.encounterIndex + "戦" + (encounterName ? " · " + encounterName : "");
  const verdict = forecast
    ? "<span class=\"forecast-verdict\" data-fx-watch=\"forecast-verdict\">"
      + esc(FORECAST_RESULT_LABEL[forecast.result] ?? forecast.result)
      + " · " + forecast.roundsUsed + "ラウンド</span>"
    : "";
  // 作者要望 2026-09-13 — 先見機の窓そのものから、未来を試映するか実戦へ入る。
  // 作者要望 2026-09-13（二度目）— **この二つは窓で一番大事な操作なので、窓の下へ
  // 一段取って大きく置く。**見出し行の右端へ二字で畳んでいた頃は、指で狙うには
  // 小さすぎた。段が一つ増えるぶんは、何をする釦かを一行で言う余地に使う。
  // 治療の対象を選んでいるあいだは、盤面の役がそちらにあるので押させない。
  const controlsDisabled = mode === "treat";
  const disabledAttr = controlsDisabled ? " disabled aria-disabled=\"true\"" : "";
  const forecasterActions = "<div class=\"forecaster-actions\">"
    + (forecast
      ? "<button type=\"button\" class=\"forecaster-action simulate\" data-action=\"preview-battle\""
        + " aria-label=\"先見機で戦闘結果を試映する\"" + disabledAttr + ">"
        + "<span class=\"forecaster-action-icon\" aria-hidden=\"true\">◉</span>"
        + "<span class=\"forecaster-action-copy\"><b>試映</b><small>結果を先に見る</small></span></button>"
      : "")
    + "<button type=\"button\" class=\"forecaster-action engage\" data-action=\"begin-stage\""
    + " aria-label=\"この敵との実戦へ進む\"" + disabledAttr + ">"
    + "<span class=\"forecaster-action-icon\" aria-hidden=\"true\">▶</span>"
    + "<span class=\"forecaster-action-copy\"><b>実戦</b><small>この敵へ進む</small></span></button>"
    + "</div>";
  // issue #235 — 隊列の組み替えは盤面の役の切り替えで入る。**どのタブからでも同じ一手**で、
  // 編成タブへ往復しない。治療の対象を選んでいる間は、盤面の役を奪われるので出さない。
  const formationToggle = mode === "treat"
    ? ""
    : "<button type=\"button\" class=\"board-mode" + (mode === "formation" ? " active" : "")
      + "\" data-action=\"toggle-formation-mode\" aria-pressed=\"" + (mode === "formation" ? "true" : "false")
      + "\" title=\"隊列を組み替える\"><span aria-hidden=\"true\">⇅</span>隊列</button>";
  const head = "<div class=\"forecast-head\"><span class=\"forecaster-identity\">"
    + "<span class=\"forecaster-lens\" aria-hidden=\"true\"><i></i></span>"
    + "<span class=\"forecast-title\">" + esc(target) + "</span></span>"
    + "<span class=\"forecast-readout\">" + verdict + formationToggle + "</span></div>";
  const forecastLabel = forecast
    ? "先見機による" + target + "の戦闘結果予測"
    : target + "の現在の隊列";
  return "<section class=\"party-bar forecaster-window" + (forecast ? " forecast-bar " + esc(forecast.result) : "")
    + "\" aria-label=\"" + esc(forecastLabel) + "\" aria-live=\"polite\">"
    + "<span class=\"forecaster-scan\" aria-hidden=\"true\"></span>" + head
    + "<div class=\"party-board\" data-fx=\"board\" aria-label=\"隊列と戦闘予測\">" + rows + "</div>"
    + partyBoardNote(mode) + forecasterActions + "</section>";
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

const BATTLE_RESULT_LABELS = { win: "勝利", loss: "敗北", draw: "相打ち" };

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
    recovery_window_closed: target + "の回復可能な窓が閉じた",
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
    // 最後の一行だけ engine の語（win / loss / draw）がそのまま出ていた。
    // 盤面の帯と同じ言葉に揃える。
    battle_ended: "戦闘終了 · " + (BATTLE_RESULT_LABELS[values.result] ?? "決着"),
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

function characterFaceWatermark(characterId, scope) {
  const portrait = portraitSvg(characterId, "neutral", { crop: "face" });
  if (!portrait) return "";
  return "<span class=\"character-face-watermark " + scope + "\" data-character=\""
    + esc(characterId) + "\" aria-hidden=\"true\">"
    + portrait + "</span>";
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

// 作者試遊 2026-09-13 — **決着の拍は再生の終点である。**VICTORY / DEFEAT の帯が
// 出たところで再生を止め、そこから先は［次へ］を押すまで進まない。だから
// 「最後の拍」ではなく「決着の拍」を終点として一箇所で決める。`battle_ended` は
// engine の最後のイベントなので通常は末尾と同じだが、戦闘が決着の拍を持たない
// 入力（途中まで保存された replay など）でも終点を失わないよう末尾へ落とす。
function endingBeatIndex(beats = replayBeats()) {
  const found = beats.findIndex((beat) => beat.kind === "ending");
  return found >= 0 ? found : Math.max(0, beats.length - 1);
}

function atReplayEnding(index = clampReplayIndex(), beats = replayBeats()) {
  return beats.length === 0 || index >= endingBeatIndex(beats);
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
  const isAlly = actor.side === "ally";
  const face = isAlly
    ? characterFaceWatermark(actor.definitionId, "unit-character-face")
    : "";
  const top = isAlly
    ? ""
    : "<div class=\"unit-top\"><span class=\"unit-icon\">" + esc(unitIcon(actor))
      + "</span><b class=\"unit-name\">" + esc(shortName(actor.displayName)) + "</b></div>";
  return "<div class=\"unit hp-tone-green\" role=\"group\" aria-label=\"" + esc(shortName(actor.displayName))
    + "\" data-unit=\"" + esc(actor.instanceId) + "\" data-max-hp=\"" + esc(String(actor.maxHp ?? 0)) + "\" data-hp-alert=\"normal\" data-hp-tone=\"green\">"
    // 手応えの層。閃き・衝撃輪・斬線・弾着・照準は**この一枚の中だけ**で動くので、
    // 箱の大きさも並びも変わらない（盤面が動くと踏み込みと揺れが読めなくなる）。
    // `fx-shot` は一枚で二役——撃つ側では銃口の閃光、受ける側では弾着の火花になる。
    + "<span class=\"unit-fx\" aria-hidden=\"true\">"
    + "<i class=\"fx-flash\"></i><i class=\"fx-ring\"></i><i class=\"fx-slash\"></i>"
    + "<i class=\"fx-shot\"></i><i class=\"fx-reticle\"></i>"
    + "</span>"
    + face
    + top + "<div class=\"unit-info-layer\"><div class=\"unit-cast\"></div><div class=\"unit-bar\" role=\"img\" aria-label=\"HPと防壁\"><span class=\"unit-fill\"></span><span class=\"unit-recovered\" aria-hidden=\"true\"></span><span class=\"unit-recoverable\" aria-hidden=\"true\"></span><span class=\"unit-unrecoverable\" aria-hidden=\"true\"></span><span class=\"unit-barrier-fill\" aria-hidden=\"true\"></span></div>"
    + "<div class=\"unit-stats\"><span class=\"unit-hp\"></span>"
    + "<span class=\"unit-marks\"></span><span class=\"unit-pips\"></span></div></div></div>";
}

// 盤面は 2×3 のまま見せる。**折り返して並べ替えると隊列が読めなくなる**
// （前3後2 と 前2後3 の違いが、まさに「どの枠が空いているか」なので）。
const BATTLE_COLUMNS = ["left", "center", "right"];

function positionRowsHtml(
  items,
  side,
  cellType = "battle",
  emptyHtml = "<div class=\"unit-empty\" aria-hidden=\"true\"></div>",
  selectedId = null,
) {
  // composeEncounter の敵は side を持たず position だけを持つ。戦闘 replay actor は
  // side を持つので、ここで両方の入力形式を同じ3×2の枠へ寄せる。
  const mine = (items ?? []).filter((item) =>
    item.side === side || (side === "enemy" && item.side === undefined));
  const rowsOrder = side === "enemy" ? ["rear", "front"] : ["front", "rear"];
  const rows = rowsOrder.map((row) => {
    const cells = BATTLE_COLUMNS.map((column) => {
      const item = mine.find((entry) => entry.position === row + "_" + column);
      const cell = item
        ? (cellType === "enemy" ? expeditionEnemyCell(item, selectedId) : unitHtml(item))
        : emptyHtml;
      return cell;
    }).join("");
    return "<div class=\"battle-row\"><span class=\"battle-row-label\">"
      + (row === "front" ? "前列" : "後列") + "</span><div class=\"battle-units\">" + cells + "</div></div>";
  }).join("");
  // 戦闘 replay は味方と敵が同じ画面に並ぶので側の名札が要る。遠征の敵盤面
  // （cellType === "enemy"）は敵しか出ないので、赤い「敵」は言い直しにしかならない。
  if (cellType === "enemy") return rows;
  return "<span class=\"battle-side-label\">" + (side === "enemy" ? "敵" : "味方") + "</span>" + rows;
}

function battleRowsHtml(actors, side) {
  return positionRowsHtml(actors, side);
}

function renderBattle() {
  const beats = replayBeats();
  const actors = replayActors();
  const speedButtons = REPLAY_SPEEDS.map((entry) =>
    button(entry.label, "replay-speed", false, "speed-button" + (replaySpeed().id === entry.id ? " active" : ""),
      "data-speed=\"" + entry.id + "\"")).join("");
  const encounter = currentEncounter();
  // 前進の釦は描き出しの時点で一つに決める（直後の updateReplayControls と同じ判定を
  // 使うので、描き直した一瞬だけ二つ並ぶことがない）。
  const atEnding = atReplayEnding();
  const visionClass = state.simulationMode ? " simulation-vision" : "";
  const visionLens = state.simulationMode
    ? "<span class=\"simulation-lens\" aria-hidden=\"true\"><i></i></span>"
      + "<span class=\"simulation-scan\" aria-hidden=\"true\"></span>"
    : "";
  return shell( "<section class=\"card battle-card" + visionClass + "\">" + visionLens
    + sectionHeading("BATTLE", state.simulationMode ? "戦闘予測" : "戦闘", "<span class=\"stage\">" + esc(encounter.name) + "</span>")
    + "<div class=\"replay-progress\"><span class=\"replay-progress-fill\"></span></div>"
    + "<div class=\"battle-field\" aria-live=\"off\">"
    + "<div class=\"battle-side\" data-side=\"enemy\">" + battleRowsHtml(actors, "enemy") + "</div>"
    + "<div class=\"battle-beat\"><span class=\"beat-round\"></span>"
    + "<p class=\"beat-text\" aria-live=\"polite\"></p><span class=\"beat-count\"></span></div>"
    + "<div class=\"battle-side\" data-side=\"ally\">" + battleRowsHtml(actors, "ally") + "</div>"
    // issue #242 — 必殺のカットイン。**拍が来たときだけ中身が入る**空の枠を一つ置く。
    + "<div class=\"ultimate-cutin\" aria-hidden=\"true\"></div>"
    // 幕の帯（開始・ラウンド・決着）と、浮く数字の層。**数字は箱の中ではなく盤面へ置く。**
    // 箱の中に置くと、味方の箱（顔を切り抜くため overflow を閉じている）で消え、
    // 敵では一つ上の箱の中に出て、誰が受けたのか読めなくなる。
    + "<div class=\"battle-banner\" aria-hidden=\"true\"></div>"
    + "<div class=\"battle-floats\" aria-hidden=\"true\"></div>"
    + "</div>"
    + "<div class=\"replay-transport\">"
    + button("◀ 一手", "replay-back", true, "button", "data-role=\"replay-back\"")
    + button("自動再生", "replay-toggle", beats.length === 0, "button primary", "data-role=\"replay-toggle\"")
    + button("一手 ▶", "replay-step", true, "button", "data-role=\"replay-step\"")
    + "</div>"
    + "<div class=\"replay-speed\"><span class=\"replay-speed-label\">速さ</span>" + speedButtons + "</div>"
    // PR #255 — **行き先ではなく、いま押す操作の名前にする。**「キャンプへ戻る」と
    // 書くと、戦闘の前へ戻る（＝やり直せる）ように読めた（作者試遊 2026-09-12）。
    // 行き先が場面で変わる（結果画面・キャンプ・精算）ぶん、札で行き先を約束しない。
    //
    // 作者試遊 2026-09-13 — **飛ばし先を決着の帯に変えた。**「再生をとばす」は
    // 戦闘を丸ごと畳んで次の場面へ出てしまい、勝敗の帯を見ないまま終わっていた。
    // いまは［一気に決着へ］が VICTORY / DEFEAT の拍まで早送りして**そこで止まり**、
    // 次の場面へ出るのは［次へ］だけである。二つは同じ場所で入れ替わるので、
    // 「いま押せる前進」は常に一つしか出ない。
    + "<div class=\"replay-finish\">"
    + button("一気に決着へ ▶▶", "replay-verdict", beats.length === 0, "button",
      "data-role=\"replay-verdict\"" + (atEnding ? " hidden" : ""))
    + button("次へ ▶", "replay-result", false, "button primary",
      "data-role=\"replay-next\"" + (atEnding ? "" : " hidden"))
    + "</div></section>"
    + helpDetails("battle-display", "表示の説明", battleLegend())
    // issue #176 — 盤面に出ている状態の意味を、その場で引けるようにする。
    + statusGlossaryHelp()
    + "<details class=\"card battle-history debug-log\"" + (state.replayLogOpen ? " open" : "")
    + "><summary>戦闘履歴</summary>"
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
      // amount は**重さを決める材料**でもある（最大HPに対する割合で字の大きさが変わる）。
      return targets.map((id) => ({ actorId: id, text: "-" + (values.amount ?? 0), tone: tone("damage"), cause, amount: values.amount ?? 0 }));
    case "damage_absorbed":
      return targets.map((id) => ({ actorId: id, text: "◈-" + (values.amount ?? 0), tone: tone("barrier"), cause }));
    case "damage_skipped":
      return targets.map((id) => ({ actorId: id, text: "不発", tone: "blocked", cause }));
    case "healing_applied": {
      const amount = values.actual ?? values.amount ?? 0;
      return amount > 0 ? targets.map((id) => ({ actorId: id, text: "+" + amount, tone: tone("heal"), cause, amount })) : [];
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

// 攻撃の型（腕力＝斬撃／技術＝銃撃）。表は content から一度だけ組む。
// 読み方は ecology/attack-style.mjs にあり、engine も拍も触らない。
const ATTACK_STYLE_INDEX = buildAttackStyleIndex(PLAYABLE_CONTENT);

// 一撃の重さ。**最大HPに対する割合**で三段に分ける。同じ50でも、HP110の人と
// HP300の人では起きたことの大きさが違う。割合だけで決まるので、同じイベント列
// からは同じ重さが出る（時計も乱数も混ぜない）。
const HIT_HEAVY_PERCENT = 15;
const HIT_CRUSH_PERCENT = 30;

function hitLevel(amount, maxHp) {
  const hit = Number(amount ?? 0);
  const max = Number(maxHp ?? 0);
  if (!(hit > 0)) return 0;
  if (!(max > 0)) return 1;
  const percent = (hit * 100) / max;
  if (percent >= HIT_CRUSH_PERCENT) return 3;
  if (percent >= HIT_HEAVY_PERCENT) return 2;
  return 1;
}

// 拍のあいだに誰がどれだけ重い一撃を受けたか。撃破はその拍で最大の重さとして扱う。
function beatHitLevels(beat, actors) {
  const maxHpOf = new Map((actors || []).map((actor) => [actor.instanceId, actor.maxHp ?? 0]));
  const levels = new Map();
  const raise = (id, level) => levels.set(id, Math.max(levels.get(id) ?? 0, level));
  for (const event of beat?.events || []) {
    for (const id of event.targetActorIds || []) {
      if (event.type === "damage_taken") raise(id, hitLevel(event.values?.amount, maxHpOf.get(id)));
      else if (event.type === "damage_absorbed") raise(id, 1);
      else if (event.type === "actor_defeated") raise(id, 3);
    }
  }
  return levels;
}

// 踏み込む向き。**狙った相手の列へ**踏み込む。盤面の列差だけで決まる。
function lungeShiftPx(actors, actingId, beat) {
  let targetId = null;
  for (const event of beat?.events || []) {
    for (const id of event.targetActorIds || []) {
      if (id !== actingId && targetId === null) targetId = id;
    }
  }
  const columnOf = (id) => {
    const actor = (actors || []).find((entry) => entry.instanceId === id);
    return BATTLE_COLUMNS.indexOf(String(actor?.position ?? "").split("_")[1] ?? "");
  };
  const from = columnOf(actingId);
  const to = columnOf(targetId);
  if (from < 0 || to < 0) return 0;
  return Math.max(-1, Math.min(1, to - from)) * 9;
}

const FLOAT_SHIFTS = [0, -24, 24, -12, 12, -32, 32];

function floatWeightClass(spec, unit) {
  const level = hitLevel(spec.amount, unit?.dataset?.maxHp);
  return level >= 3 ? " crush" : level === 2 ? " heavy" : "";
}

// 浮く数字は**盤面の層**へ置く。箱の中に置くと、味方の箱（顔を切り抜くため
// overflow を閉じている）では消え、敵では一つ上の箱の中に出て持ち主が読めない。
function spawnFloat(field, unit, spec, offset) {
  const host = field.querySelector(".battle-floats");
  if (!host) return;
  const fieldRect = field.getBoundingClientRect();
  const rect = unit.getBoundingClientRect();
  const node = document.createElement("span");
  node.className = "float " + spec.tone + floatWeightClass(spec, unit);
  // 受けた箱の真上へ出す。盤面が揺れている最中でも、両方の矩形が同じだけ動くので
  // 相対位置は変わらない。
  node.style.left = (rect.left - fieldRect.left + rect.width / 2) + "px";
  node.style.top = (rect.top - fieldRect.top + rect.height * 0.55) + "px";
  // 同じ拍で複数浮くときに重ならないように、中央から左右へ振り分ける。
  // **一つだけのときは必ず真ん中**に出す（誰の数字なのかが一番読める位置）。
  node.style.setProperty("--float-shift", FLOAT_SHIFTS[offset % FLOAT_SHIFTS.length] + "px");
  node.style.animationDelay = Math.min(offset, 3) * 70 + "ms";
  node.textContent = spec.text;
  if (spec.cause) {
    const cause = document.createElement("i");
    cause.className = "float-cause";
    cause.textContent = spec.cause;
    node.appendChild(cause);
  }
  host.appendChild(node);
  setTimeout(() => node.remove(), 1500);
}

// 踏み込んだ相手を線で結ぶ。**「誰が誰を殴ったか」は盤面で一番読みたいこと**なので、
// 箱の動きだけに任せず、行った先そのものを一度だけ描く。長さと角度は二つの箱の
// 位置から出るので、乱数も時計も要らない。
function strikeTargetIds(beat, actingId) {
  const ids = [];
  for (const event of beat?.events || []) {
    if (!STRIKE_IMPACT_EVENT_TYPES.has(event.type)) continue;
    for (const id of event.targetActorIds || []) {
      if (id !== actingId && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

// 線と印そのものは ecology/battle-fx.mjs にある。**盤面の演出だけを切り出してある**ので、
// ecology/fx-test.html（演出の見本）が、ゲームを一戦進めずに同じ絵を同じ経路で出せる。

// 盤面の揺れ。**重さの三段をそのまま揺れの三段にする。**三つを外してから付け直すので、
// 同じ強さが続けて来ても毎回頭から揺れる。
function shakeField(field, level) {
  field.classList.remove("shake-1", "shake-2", "shake-3");
  if (level <= 0) return;
  void field.offsetWidth;
  field.classList.add("shake-" + level);
}

function updateReplayControls(index, beats) {
  const atEnd = atReplayEnding(index, beats);
  const toggle = app.querySelector("[data-role=\"replay-toggle\"]");
  if (toggle) {
    toggle.textContent = state.replayPlaying ? "一時停止" : (atEnd ? "最初から再生" : "自動再生");
    // 決着のあとで金の釦を二つ出さない。**ここで押すべきは［次へ］**で、
    // もう一度見るのはついでなので、主役の色は一つに保つ。
    toggle.className = "button" + (state.replayPlaying || atEnd ? "" : " primary");
    toggle.disabled = beats.length === 0;
  }
  const step = app.querySelector("[data-role=\"replay-step\"]");
  if (step) step.disabled = atEnd;
  const back = app.querySelector("[data-role=\"replay-back\"]");
  if (back) back.disabled = index <= 0;
  // 作者試遊 2026-09-13 — 前進の釦は一度に一つ。決着の前は［一気に決着へ］、
  // 決着の帯が出てからは［次へ］だけを出す。
  const verdict = app.querySelector("[data-role=\"replay-verdict\"]");
  if (verdict) {
    verdict.hidden = atEnd;
    verdict.disabled = beats.length === 0;
  }
  const next = app.querySelector("[data-role=\"replay-next\"]");
  if (next) next.hidden = !atEnd;
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
    const gauge = hpGaugeState(actor);
    const corners = hpGaugeCornerRoles(actor);
    const fill = unit.querySelector(".unit-fill");
    const recoveredFill = unit.querySelector(".unit-recovered");
    const recoverableFill = unit.querySelector(".unit-recoverable");
    const unrecoverableFill = unit.querySelector(".unit-unrecoverable");
    const segments = [
      { key: "green", element: fill, amount: gauge.green },
      { key: "recovered", element: recoveredFill, amount: gauge.recovered },
      { key: "recoverable", element: recoverableFill, amount: gauge.recoverable },
      { key: "unrecoverable", element: unrecoverableFill, amount: gauge.unrecoverable },
    ];
    let offset = 0;
    segments.forEach(({ key, element, amount }) => {
      const left = gauge.maxHp > 0 ? (offset / gauge.maxHp) * 100 : 0;
      const width = gauge.maxHp > 0 ? (amount / gauge.maxHp) * 100 : 0;
      if (element) {
        element.style.left = left + "%";
        element.style.width = width + "%";
        // 隣接区分の境界は角を立て、バーの外側と赤／黒境界だけ丸める。
        element.style.borderRadius = "0";
        if (key === corners.leftRound) {
          element.style.borderTopLeftRadius = "999px";
          element.style.borderBottomLeftRadius = "999px";
        }
        if (key === corners.rightRound) {
          element.style.borderTopRightRadius = "999px";
          element.style.borderBottomRightRadius = "999px";
        }
      }
      offset += amount;
    });
    const alert = hpAlertFor(actor);
    const alertLabel = hpAlertLabelFor(alert);
    const tone = hpToneFor(actor);
    unit.dataset.hpAlert = alert;
    unit.dataset.hpTone = tone;
    unit.classList.toggle("hp-tone-green", tone === "green");
    unit.classList.toggle("hp-tone-yellow", tone === "yellow");
    unit.classList.toggle("hp-tone-red", tone === "red");
    const hp = unit.querySelector(".unit-hp");
    if (hp) hp.textContent = actor.alive
      ? gauge.currentHp + "/" + gauge.maxHp
      : "戦闘不能";
    const barrierFill = unit.querySelector(".unit-barrier-fill");
    if (barrierFill) barrierFill.style.width = barrierPercent(actor) + "%";
    const bar = unit.querySelector(".unit-bar");
    if (bar) {
      const barrier = Number(actor.barrier ?? 0);
      const safeBarrier = Number.isFinite(barrier) ? Math.max(0, barrier) : 0;
      bar.setAttribute(
        "aria-label",
        "HP " + gauge.currentHp + "/" + gauge.maxHp
          + "、回復済み " + gauge.recovered
          + "、回復可能 " + gauge.recoverable
          + "、回復不能 " + gauge.unrecoverable
          + "、防壁 " + safeBarrier,
      );
      if (alertLabel) bar.setAttribute("aria-label", bar.getAttribute("aria-label") + "、" + alertLabel);
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

  // 拍をまたいだ一時演出を持ち越さず、HP警告枠を常に読める状態に戻す。
  // `is-striking` もここで落とす。型の class（strike-*）だけを毎拍外して踏み込みの
  // class を残すと、**次の拍で型が外れた瞬間に斬線の規則が復活して**、撃った人が
  // 一拍遅れて斬る絵が出る。付け直すのは下の restartAnimation だけにする。
  field.querySelectorAll(".unit").forEach((unit) => unit.classList.remove(
    "is-acting",
    "is-aimed",
    "is-striking",
    "is-hit",
    "is-healed",
    "is-shielded",
    "is-blocked",
    "is-downed",
    "hit-2",
    "hit-3",
    "strike-weapon",
    "strike-technique",
    "hit-weapon",
    "hit-technique",
  ));

  if (beat) {
    const head = beat.events[0];
    const actingId = eventSourceId(head);
    const actingUnit = unitOf(actingId);
    const levels = beatHitLevels(beat, actors);
    if (actingUnit) {
      actingUnit.classList.add("is-acting");
      // 踏み込む向きは狙った相手の列で決まる。左右へ寄せるぶんだけを渡し、
      // 前後（味方は上・敵は下）は side の CSS が持つ。
      actingUnit.style.setProperty("--lunge-x", lungeShiftPx(actors, actingId, beat) + "px");
    }
    // 作者要望 2026-09-14 — **腕力は斬撃、技術は銃撃。**型は拍の着弾イベントから読む
    // （新しい event も拍も増やさない）。型を持たないダメージ（裂傷・装備の破片）は
    // どちらでもないので、これまでどおりの汎用の被弾のまま出す。
    const strikeStyle = beatAttackStyle(ATTACK_STYLE_INDEX, beat);
    if (actingUnit && beatHasStrikeImpact(beat) && !options.silent) {
      if (strikeStyle) actingUnit.classList.add("strike-" + strikeStyle);
      restartAnimation(actingUnit, "is-striking");
      // **線は拍の中で終わる。**数字は履歴として少し残すが、線が次の拍まで残ると
      // 「いま誰が誰を殴ったか」を指さなくなる。多段・全体攻撃では人数ぶん出るので、
      // 消すのはこの拍の頭で一度だけにする。
      field.querySelectorAll(".strike-line").forEach((line) => line.remove());
      for (const id of strikeTargetIds(beat, actingId)) {
        spawnStrikeLine(field, actingUnit, unitOf(id), strikeStyle);
      }
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
      // 多段攻撃でも印は一つ。同じ場所へ重ねて描いても、形が濃くなるだけで読めない。
      const marked = new Set();
      const markOnce = (id, unit, style) => {
        if (!style || marked.has(id)) return;
        marked.add(id);
        spawnImpactMark(field, unit, style);
      };
      let offset = 0;
      for (const event of beat.events) {
        for (const id of event.targetActorIds || []) {
          const unit = unitOf(id);
          if (!unit) continue;
          // 作者指摘 2026-09-14 — **撃破の拍で攻撃の絵をもう一度出さない。**
          // 撃破は着弾とは別の拍なので、そこで斬線や弾着を出し直すと、一度の攻撃が
          // 二度当たったように見える。ここで出すのは「倒れた」だけにする。
          if (event.type === "actor_defeated") {
            restartOnce(id, unit, "is-downed");
          } else if (event.type === "damage_taken" || event.type === "damage_absorbed") {
            // 重い一撃ほど大きく揺らす。段は付け直す前に決める（restart が消すため）。
            const level = levels.get(id) ?? 1;
            if (level >= 2) unit.classList.add("hit-" + level);
            // 受けた側の絵も型で分ける。斬撃は刃の線が走り、銃撃は弾着の火花が出る。
            const hitStyle = attackStyleOfEvent(ATTACK_STYLE_INDEX, event);
            if (hitStyle) unit.classList.add("hit-" + hitStyle);
            markOnce(id, unit, hitStyle);
            restartOnce(id, unit, "is-hit");
          } else if (event.type === "healing_applied") restartOnce(id, unit, "is-healed");
          else if (event.type === "barrier_gained" || event.type === "block_gained") restartOnce(id, unit, "is-shielded");
          else if (event.type === "damage_blocked" || event.type === "damage_skipped") restartOnce(id, unit, "is-blocked");
        }
        for (const spec of floatsFor(event)) {
          const unit = unitOf(spec.actorId);
          if (unit) spawnFloat(field, unit, spec, offset++);
        }
      }
      // 盤面そのものの揺れは、その拍で一番重かった一撃に合わせて一度だけ。
      shakeField(field, Math.max(0, ...levels.values()));
    }
  }

  // issue #242 — 必殺の拍だけ、盤面を一段沈めてカットインを重ねる。**同じ拍へ二度
  // 同じ絵を書き込まない**ので、再描画でも演出が巻き戻らない（一時停止中も崩れない）。
  const cutIn = field.querySelector(".ultimate-cutin");
  if (cutIn) {
    const showCutIn = beat?.kind === "ultimate";
    field.classList.toggle("ultimate-hold", showCutIn);
    if (!showCutIn) {
      if (cutIn.dataset.beat) {
        cutIn.dataset.beat = "";
        cutIn.innerHTML = "";
      }
      cutIn.classList.remove("show");
    } else if (cutIn.dataset.beat !== String(index)) {
      cutIn.dataset.beat = String(index);
      cutIn.innerHTML = ultimateCutInHtml(beat);
      cutIn.classList.add("show");
      if (!options.silent) restartAnimation(cutIn, "run");
    }
  }

  // 幕の帯。**拍が言っていることを、盤面の真ん中で一度だけ大きく言う。**
  // 出るのは戦闘の開始・ラウンドの頭・決着だけで、拍の長さも順序も変えない。
  // カットインと同じく、同じ拍へ二度書き込まないので再描画で巻き戻らない。
  const banner = field.querySelector(".battle-banner");
  if (banner) {
    const spec = battleBannerFor(beat);
    // 決着の帯は消えずに残るので、**同じことを言う拍の行とは重ならないようにする。**
    // 帯は盤面の真ん中（拍の行の上）に出るため、流れて消えていたころは一瞬の重なりで
    // 済んでいた。読み上げは拍の行（aria-live）が持っているので、消すのは見た目だけ。
    field.classList.toggle("verdict-hold", Boolean(spec?.hold));
    if (!spec) {
      banner.dataset.beat = "";
      banner.className = "battle-banner";
      banner.textContent = "";
    } else if (banner.dataset.beat !== String(index)) {
      banner.dataset.beat = String(index);
      banner.innerHTML = "<b>" + esc(spec.word) + "</b><i>" + esc(spec.reading) + "</i>";
      // 作者試遊 2026-09-13 — **決着の帯だけは消えずに残る。**開始とラウンドの帯は
      // 次の拍へ場所を譲るので流れて消えるが、VICTORY / DEFEAT はそこで再生が
      // 止まる拍なので、［次へ］を押すまで出したままにする（`hold`）。
      banner.className = "battle-banner show " + spec.tone + (spec.hold ? " hold" : "");
      if (!options.silent) restartAnimation(banner, "run");
    }
  }

  const slate = field.querySelector(".battle-beat");
  if (slate) slate.dataset.kind = beat?.kind ?? "opening";
  const beatText = field.querySelector(".beat-text");
  if (beatText) {
    const text = beat ? beatText_(beat) : "戦闘開始";
    if (beatText.textContent !== text) {
      beatText.textContent = text;
      restartAnimation(beatText, "pulse");
      if (slate) restartAnimation(slate, "pulse");
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

// 幕の帯に出す言葉。**拍の種類だけで決まる**ので、同じイベント列からは同じ帯が出る。
// 読み上げは拍の行（`.beat-text`、aria-live）が既に担当しているので、帯は aria-hidden
// のまま二重に読ませない。
function battleBannerFor(beat) {
  if (!beat) return null;
  if (beat.kind === "opening") return { word: "BATTLE START", reading: "戦闘開始", tone: "open" };
  if (beat.kind === "round") {
    const round = beat.events[0]?.round ?? 1;
    return { word: "ROUND " + round, reading: "ラウンド" + round, tone: "round" };
  }
  if (beat.kind === "ending") {
    // `hold` — この帯は流して消さない（再生がここで止まる）。
    const result = beat.events[0]?.values?.result;
    if (result === "win") return { word: "VICTORY", reading: "勝利", tone: "win", hold: true };
    if (result === "loss") return { word: "DEFEAT", reading: "敗北", tone: "lose", hold: true };
    return { word: "DRAW", reading: "相打ち", tone: "draw", hold: true };
  }
  return null;
}

// ---------------------------------------------------------------- 必殺のカットイン（issue #242）
//
// **一人一遠征に一度きりの稀さは、この演出を載せるために選んである**（DESIGN.md §8.10）。
// 拍は `replay-beats.mjs` が `ultimate` 種として既に組んでいるので、ここは**その拍の
// 中身を絵にするだけ**である。立ち絵・技能名・変換の印は、どれも拍の `ultimateId` から
// 導く（画面が必殺の表を持たない）。
//
// 決定的であること：同じイベント列からは同じ拍が同じ順で出るので、演出も同じ順で出る。
// 一時停止・一手送り・戻す・速度変更・自動再生は、どれも拍の境目しか動かさない。
function ultimateCutInHtml(beat) {
  const ultimateId = beat?.ultimateId ?? null;
  if (!ultimateId) return "";
  const head = beat.events[0];
  const actorId = eventSourceId(head);
  const actor = replayActors().find((entry) => entry.instanceId === actorId) ?? null;
  const characterId = actor?.definitionId ?? null;
  const info = componentInfo(ultimateId);
  const traits = info?.traitLabels ?? [];
  // 立ち絵が無い人物（敵や、絵の無い id）では枠だけが出る。**演出は落ちない。**
  const portrait = characterId ? portraitSvg(characterId, "firm", { uid: "cutin-" + characterId }) : "";
  const accent = characterId ? portraitAccent(characterId) : "var(--gold)";
  return "<div class=\"cutin-sheet\" style=\"--accent:" + esc(accent) + "\">"
    + "<span class=\"cutin-burst\"></span>"
    // 速度線と斬線。**帯そのものより速く走る層**を重ねて、一拍の重さを出す。
    + "<span class=\"cutin-lines\"></span>"
    + "<span class=\"cutin-slash\"></span>"
    + (portrait ? "<span class=\"cutin-figure\">" + portrait + "</span>" : "")
    + "<span class=\"cutin-copy\">"
    + "<span class=\"cutin-who\">" + esc(actorName(actorId)) + "</span>"
    + "<b class=\"cutin-skill\">" + esc(info?.label ?? nameFor(ultimateId)) + "</b>"
    + (traits.length
      ? "<span class=\"cutin-traits\">"
        + traits.map((text) => "<span>" + esc(text) + "</span>").join("") + "</span>"
      : "")
    + "</span></div>";
}

// 拍の一行。同時に出したものは「＋」で並べる（並列に出したことが読めるように）。
// **同じことを二度言わない。** 「ゴウの斬撃が始まる ＋ ゴウ → 敵に5ダメージ」は
// 二行ぶんの場所を取って一行ぶんしか伝えない。
function beatText_(beat) {
  const head = beat.events[0];
  // issue #242 — 必殺の拍は、誰の何が出たかだけを言う（ダメージは次の拍が言う）。
  if (beat.kind === "ultimate") {
    return actorName(eventSourceId(head)) + "：" + nameFor(beat.ultimateId) + "！";
  }
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

// 作者要望 2026-09-13 — **色と形の説明は、色と形で出す。**
//
// ここは四段落の文章だった（帯の色、主色の境目、一撃の重さ、動きの意味を全部書いていた）。
// 盤面の見た目を言葉へ翻訳して読ませるのは、翻訳を二度させることである。
// 同じ帯・同じ四隅・同じ大きさの点をそのまま並べ、名前だけを添える。
function legendSwatch(inner, className = "") {
  return "<span class=\"legend-swatch" + (className ? " " + className : "") + "\" aria-hidden=\"true\">"
    + inner + "</span>";
}

function legendItems(items) {
  return "<div class=\"legend-grid\">" + items.map((item) =>
    "<div class=\"legend-item\">" + item.swatch
    + "<span class=\"legend-copy\"><b>" + esc(item.title) + "</b>"
    + (item.line ? "<small>" + esc(item.line) + "</small>" : "") + "</span></div>").join("") + "</div>";
}

function battleLegend() {
  // 帯そのもの。**盤面の .unit-bar と同じ層構成で、同じ色を使う。**
  const hpBar = "<span class=\"legend-bar\">"
    + "<i class=\"seg main\" style=\"width:46%\"></i>"
    + "<i class=\"seg recovered\" style=\"width:14%\"></i>"
    + "<i class=\"seg recoverable\" style=\"width:22%\"></i>"
    + "<i class=\"seg unrecoverable\" style=\"width:18%\"></i>"
    + "<i class=\"seg barrier\"></i></span>";
  const band = legendItems([
    { swatch: legendSwatch("<i class=\"chip main\"></i>"), title: "残HP", line: "主色のままの帯" },
    { swatch: legendSwatch("<i class=\"chip recovered\"></i>"), title: "回復した分", line: "この攻撃で戻った分" },
    { swatch: legendSwatch("<i class=\"chip recoverable\"></i>"), title: "回復可能", line: "まだ戻せる残り" },
    { swatch: legendSwatch("<i class=\"chip unrecoverable\"></i>"), title: "回復不能", line: "戻せない分" },
    { swatch: legendSwatch("<i class=\"chip barrier\"></i>"), title: "防壁", line: "帯の上端の灰色" },
  ]);
  const tone = legendItems([
    { swatch: legendSwatch("<i class=\"chip tone-green\"></i>"), title: "緑", line: "残HP 56%以上" },
    { swatch: legendSwatch("<i class=\"chip tone-yellow\"></i>"), title: "黄", line: "残HP 26〜55%" },
    { swatch: legendSwatch("<i class=\"chip tone-red\"></i>"), title: "赤", line: "残HP 25%以下" },
  ]);
  const weight = legendItems([
    { swatch: legendSwatch("<i class=\"hit hit-1\"></i>"), title: "並", line: "最大HPの 15%未満" },
    { swatch: legendSwatch("<i class=\"hit hit-2\"></i>"), title: "重い", line: "15%以上・箱が揺れる" },
    { swatch: legendSwatch("<i class=\"hit hit-3\"></i>"), title: "致命", line: "30%以上と撃破・盤面が揺れる" },
  ]);
  const motion = legendItems([
    { swatch: legendSwatch("<i class=\"box lunge\"></i>"), title: "踏み込んだ箱", line: "出した側。狙う相手の列へ寄る" },
    { swatch: legendSwatch("<i class=\"box shake\"></i>"), title: "揺れた箱", line: "受けた側" },
    { swatch: legendSwatch("<i class=\"line\"></i>"), title: "光の線", line: "攻撃側から被弾側へ一度だけ走る" },
    { swatch: legendSwatch("<i class=\"aim\"></i>"), title: "金の四隅", line: "いま狙われている箱" },
    { swatch: legendSwatch("<span class=\"legend-number\">12</span>"), title: "浮かぶ数字", line: "ダメージ・回復・防壁" },
  ]);
  return "<h3 class=\"legend-heading\">箱の下の帯</h3>" + hpBar + band
    + "<h3 class=\"legend-heading\">主色（枠の色は変わらない）</h3>" + tone
    + "<h3 class=\"legend-heading\">一撃の重さ</h3>" + weight
    + "<h3 class=\"legend-heading\">動きと印</h3>" + motion
    + ruleGrid([
      { glyph: "eye", title: "視差効果を減らす", value: "動きだけ止まる", line: "帯・照準・数字はそのまま出ます。", tone: "quiet" },
      { glyph: "book", title: "細かい出来事", value: "技術ログ", line: "戦闘履歴の中で確認できます。", tone: "quiet" },
    ]);
}

function renderBattleError() {
  const failure = state.battleError || {};
  const diagnostics = failure.diagnostics || {};
  const recent = diagnostics.recentEvents || [];
  const actorLabels = failure.actorLabels || {};
  const stack = diagnostics.ruleActivationStack || [];
  const encounter = currentEncounter();
  return shell( "<section class=\"card verdict loss\">"
    + sectionHeading("BATTLE ERROR", "戦闘を停止しました", "<span class=\"stage\">" + esc(encounter.name) + "</span>")
    + "<div class=\"verdict-mark\">!</div>"
    + ruleGrid([
      { glyph: "lock", title: "安全弁", value: "途中結果を破棄", line: "この構成の戦闘イベントが上限を超えました。", tone: "bad" },
      { glyph: "book", title: "直前のイベント", value: "残してあります", line: "下の一覧で、何が繰り返されたかを追えます。", tone: "quiet" },
    ])
    + "<p class=\"error battle-error-message\">" + esc(failure.message || "battle runtime error") + "</p>"
    + "<div class=\"metrics\"><span><b>" + (diagnostics.eventSequence ?? "—") + "</b><small>イベント番号</small></span><span><b>"
    + esc(actorLabels[diagnostics.currentActorId] ?? diagnostics.currentActorId ?? "—") + "</b><small>実行中</small></span><span><b>"
    + esc(diagnostics.chainId ?? "—") + "</b><small>チェーン</small></span><span><b>" + recent.length + "</b><small>直前ログ</small></span></div></section>"
    + "<section class=\"card\">" + sectionHeading("DIAGNOSTICS", "直前のイベント")
    + "<ol class=\"events diagnostic-events\">"
    + recent.map((event) => "<li class=\"event\"><span class=\"event-round\">R" + (event.round ?? "-") + "</span><span>"
      + esc(diagnosticEventText(event, actorLabels)) + "</span></li>").join("") + "</ol>"
    + (stack.length ? "<details><summary>発火中の反応</summary><pre>" + esc(JSON.stringify(stack, null, 2)) + "</pre></details>" : "")
    + "<details><summary>エンジン診断データ</summary><pre>" + esc(JSON.stringify(diagnostics, null, 2)) + "</pre></details></section>"
    + "<section class=\"card quiet\">"
    + ruleGrid([
      { glyph: "cross", title: "まず切る", value: "0コストの行動", line: "直前に装着したものからオフにして、もう一度試します。" },
      { glyph: "cross", title: "次に切る", value: "準備・行動権を互いに増やす反応", line: "二つが互いを呼ぶと、際限なく回ります。" },
    ])
    + "<div class=\"flow-actions\">" + button("スキルを見直す", "retry-build", false, "button primary")
    + button("キャンプへ戻る", "back-battle-preview", false, "button") + "</div></section>");
}

function resultActors(result, { simulation = false } = {}) {
  // R8 §1.5 — Campaign Stage は「次戦」も持ち越しHP（run.currentHp、
  // commitBattleResultが既に確定済み）。Free / Endless は従来どおり毎戦満タン。
  return (result?.actors || []).filter((actor) => actor.side === "ally").map((actor) => {
    const characterId = String(actor.instanceId ?? "").replace(/^a_/, "");
    const nextHp = isCampaignRun()
      ? Math.max(0, Math.min(actor.maxHp, state.run.currentHp?.[characterId] ?? actor.maxHp))
      : actor.maxHp;
    const outcome = simulation
      ? (actor.alive ? "投影 HP " + actor.hp + "/" + actor.maxHp : "投影 戦闘不能")
      : (actor.alive ? "戦闘内 HP " + actor.hp + "/" + actor.maxHp : "戦闘内 戦闘不能")
        + " → 次戦 HP " + nextHp + "/" + actor.maxHp;
    return "<div class=\"result-actor\"><span class=\"avatar small\">" + esc(characterInfo(actor.definitionId)?.icon ?? "・")
      + "</span><div><b>" + esc(String(actor.displayName).split(" — ")[0]) + "</b><small>"
      + outcome + " · 防壁 " + actor.barrier + "</small></div></div>";
  }).join("");
}

// ============================================================ 順番の帯（issue #177）
//
// **「装着順が結果にどう効いたか」を、文ではなく帯で見せる。**
// アクティブは装着順を順送りに回るので（#188 / #187）、装着を増やすほど一本
// あたりの出番が減る。それが実際にどう出たのかは、ラウンドごとに何が鳴ったかを
// 並べれば一目で分かる。色はテーマ、印はテーマの記号、押さえれば技能名が出る。
function rotationStrip(result) {
  const events = result?.events ?? [];
  const nodeBySkillId = new Map(SKILL_TREE_NODES.map((node) => [node.skillId, node]));
  const byCharacter = new Map();
  let lastRound = 0;
  for (const event of events) {
    if (event.type !== "action_declared") continue;
    const source = String(event.sourceActorId ?? "");
    if (!source.startsWith("a_")) continue;
    const characterId = source.slice(2);
    if (!state.run.roster.includes(characterId)) continue;
    const round = Number(event.round ?? 0);
    lastRound = Math.max(lastRound, round);
    if (!byCharacter.has(characterId)) byCharacter.set(characterId, new Map());
    const rounds = byCharacter.get(characterId);
    if (!rounds.has(round)) rounds.set(round, []);
    rounds.get(round).push(event.skillId);
  }
  if (!byCharacter.size) return "";
  const rows = state.run.roster.filter((id) => byCharacter.has(id)).map((characterId) => {
    const rounds = byCharacter.get(characterId);
    const cells = [];
    for (let round = 1; round <= lastRound; round += 1) {
      const fired = rounds.get(round) ?? [];
      if (!fired.length) {
        cells.push("<span class=\"turn-round\"><i class=\"turn-cell idle\" title=\"" + round
          + "ラウンド目 · 動いていない\"></i></span>");
        continue;
      }
      // **ラウンドごとに束ねる。**行動点2の人物は同じラウンドに二つ出るので、
      // 束ねないと人物ごとに拍がずれて、縦に読めなくなる。
      cells.push("<span class=\"turn-round\">" + fired.map((skillId) => {
        // issue #238 — 必殺は元の技能の節から系統を引き、印だけを ✹ に替える。
        // **どの系統の一手だったかは残したまま、必殺だけが帯の中で目立つ。**
        const ultimate = isUltimateId(skillId);
        const node = nodeBySkillId.get(ultimate ? baseSkillIdOf(skillId) : skillId);
        const label = COMPONENTS[skillId]?.label ?? nameFor(skillId);
        const branch = node ? (BRANCH_KEYS[node.branch] ?? "base") : "base";
        return "<i class=\"turn-cell branch-" + branch + (ultimate ? " ultimate" : "")
          + "\" title=\"" + round + "ラウンド目 · "
          + esc(label) + "\" aria-label=\"" + round + "ラウンド目 " + esc(label) + "\">"
          + esc(ultimate ? "✹" : (node ? (branchIcons[node.branch] ?? "·") : "·")) + "</i>";
      }).join("") + "</span>");
    }
    return "<div class=\"turn-row\"><span class=\"avatar small\">"
      + esc(characterInfo(characterId)?.icon ?? "・") + "</span>"
      + "<span class=\"turn-cells\">" + cells.join("") + "</span></div>";
  }).join("");
  return "<section class=\"card\">" + sectionHeading("ORDER", "出した順番")
    + "<div class=\"turn-strip\">" + rows + "</div></section>";
}

function renderResult() {
  const result = state.lastResult;
  if (!result) return renderCamp();
  const won = result.result === "win";
  const encounter = currentEncounter();
  const metrics = result.metrics || {};
  const events = compactEvents(result.events || state.replayEvents);
  const shown = events.length > 40 ? [...events.slice(0, 30), ...events.slice(-10)] : events;
  // 試映の結果は、報酬・持越HP・技能点を扱う通常の結果画面へ絶対に流さない。
  // 青い投影面と走査線を戦闘中から連続させ、文字の札ではなく「まだ機械の中」を示す。
  if (state.simulationMode) {
    const status = "<section class=\"card verdict simulation-result " + (won ? "win" : "loss") + "\">"
      + "<span class=\"simulation-lens\" aria-hidden=\"true\"><i></i></span>"
      + "<span class=\"simulation-scan\" aria-hidden=\"true\"></span>"
      + "<div class=\"verdict-mark\">" + (won ? "✓" : "×") + "</div><h2>"
      + (won ? "突破した" : "足を止めた") + "</h2><p class=\"verdict-context\">"
      + esc(encounter.name) + " · " + result.roundsUsed + "ラウンド</p>"
      + "<div class=\"metrics\"><span><b>" + (metrics.allyHpLost ?? 0) + "</b><small>味方HP損失</small></span><span><b>"
      + (metrics.enemyHpLost ?? 0) + "</b><small>敵HP損失</small></span><span><b>" + (metrics.reactionsFired ?? 0)
      + "</b><small>反応発火</small></span><span><b>" + (metrics.equipmentWear ?? 0)
      + "</b><small>装備摩耗</small></span></div></section>";
    const projected = "<section class=\"card simulation-projection\">"
      + sectionHeading("TRACE", "投影された終端")
      + "<div class=\"result-actors\">" + resultActors(result, { simulation: true }) + "</div></section>";
    const next = "<div class=\"primary-action result-primary-action\" data-primary-action=\"return-from-simulation\">"
      + button("↩ 先見機へ戻る", "return-from-simulation", false, "button primary") + "</div>";
    const replay = state.replayEvents?.length
      ? "<section class=\"card\">" + button("もう一度映す", "replay-again", false, "button") + "</section>"
      : "";
    const history = "<details class=\"card battle-history debug-log\"" + (state.replayLogOpen ? " open" : "")
      + "><summary>投影記録</summary><ol class=\"events\">"
      + shown.map((event) => "<li class=\"event\"><span class=\"event-round\">R"
        + (event.round ?? "-") + "</span><span>" + esc(eventText(event)) + "</span>"
        + "<code class=\"event-type\">" + esc(event.type) + "</code></li>").join("")
      + "</ol></details>";
    return shell(status + next + projected + rotationStrip(result) + replay + history);
  }
  const prologueUnresolved = state.prologueActive && !(state.prologueStage === "retry" && won);
  ensureResultReward(won, prologueUnresolved);
  // 作者試遊 2026-09-11 — 序盤の敗北はここへ来ない（会話の門が受ける）。
  // 残るのは巻き戻したあとの再挑戦で負けた場合と、中断復帰の保険だけである。
  const next = prologueUnresolved
    ? state.prologueStage === "retry"
      ? button("編成を見直す", "back-camp", false, "button primary")
      : button("続きを見る", "resume-prologue-defeat", false, "button primary")
    : won
      ? rewardDueForCurrentEncounter() && state.rewardOffer.length
        ? rewardSectionHtml()
        // PR #255 — 最終戦の候補を受け取り終えたら、そのまま精算へ進む。
        // 候補の無い勝利で結果画面に残るのは中断復帰と古い保存だけだが、
        // そこでも「次の一手」を必ず出す。
        : state.run.encounterIndex >= ENCOUNTERS_PER_RUN
          ? button("遠征を精算する", "settle-run", false, "button primary")
          : button("キャンプへ戻る", "advance-encounter", false, "button primary")
      : button("この先どうするか", "show-defeat", false, "button primary");
  const nextBlock = "<div class=\"primary-action result-primary-action\" data-primary-action=\"result-next\">"
    + next + "</div>";
  const equipment = (result.equipment || []).map((item) => "<div class=\"result-gear\"><b>"
    + esc(gear(item.equipmentId)?.label ?? item.equipmentId) + "</b><span>"
    + "戦闘内 " + item.durability + " / " + item.maxDurability + " → 次戦 "
    + item.maxDurability + " / " + item.maxDurability + "</span></div>").join("");
  // issue #168 — 表示する量も progression の表から引く（画面に書いた数と、
  // 実際に配った数がずれないようにする）。
  const skillGain = !prologueUnresolved && won
    ? "<p class=\"gain-chip\">" + glyph("skill") + "全員に技能点 +"
      + skillPointsForClear(currentEncounter().kind) + "</p>"
    : "";
  const carryText = prologueUnresolved
    ? ruleGrid([{ glyph: "lock", title: "この一戦は遠征に数えません", value: "据え置き", line: "活動資金と持ち越しHPは動きません。", tone: "quiet" }])
    : statTiles([
      { value: formatFunds(state.run.fundLedger.provisionalTotal), label: "持ち帰る活動資金", tone: "gold", glyph: "funds", wide: true },
      { value: state.run.fundLedger.highestClearedEncounter + " / " + ENCOUNTERS_PER_RUN, label: "到達", glyph: "distance" },
    ], "", 2);
  const rewardLayout = won && !prologueUnresolved
    && rewardDueForCurrentEncounter() && state.rewardOffer.length > 0;
  const status = "<section class=\"card verdict " + (won ? "win" : "loss") + "\"><div class=\"verdict-mark\">"
    + (won ? "✓" : "×") + "</div><h2>" + (won ? "突破した" : "足を止めた")
    + "</h2><p class=\"verdict-context\">" + esc(encounter.name) + " · " + result.roundsUsed
    + "ラウンド</p><div class=\"metrics\"><span><b>" + (metrics.allyHpLost ?? 0) + "</b><small>味方HP損失</small></span><span><b>"
    + (metrics.enemyHpLost ?? 0) + "</b><small>敵HP損失</small></span><span><b>" + (metrics.reactionsFired ?? 0)
    + "</b><small>反応発火</small></span><span><b>" + (metrics.equipmentWear ?? 0) + "</b><small>装備摩耗</small></span></div>"
    + skillGain + "</section>";
  // issue #238 — 必殺印は「構えたから」ではなく「放ったから」減る。
  // **払った理由と残りを、払った画面で見せる。**
  // 作者指摘 2026-09-13 — 人数ではなく**名前**で出す。「あと2人」は誰の一回かに答えない。
  const firedBy = state.lastCarrySnapshot?.ultimateFiredBy ?? [];
  const stillHave = state.run.roster.filter((id) => ultimateUsesLeft(state.run, id) > 0);
  const sealText = firedBy.length
    ? ruleGrid([{
      glyph: "spark",
      title: "必殺技を放った",
      value: firedBy.map((id) => characterName(id)).join(" · "),
      line: "この遠征ではもう放てません。"
        + (stillHave.length
          ? "まだ残しているのは " + stillHave.map((id) => characterName(id)).join(" · ") + " です。"
          : "隊の全員が放ち終えました。"),
    }])
    : "";
  const stateCard = "<section class=\"card\">" + sectionHeading("AFTER BATTLE", "戦闘後の状態")
    + carryText + sealText + "<div class=\"result-actors\">" + resultActors(result) + "</div>"
    + "<div class=\"result-gear-list\">" + (equipment || "<p class=\"muted\">装備なし</p>")
    + "</div></section>";
  const replay = state.replayEvents?.length
    ? "<section class=\"card\">" + button("戦闘をもう一度見る", "replay-again", false, "button") + "</section>"
    : "";
  const history = "<details class=\"card battle-history debug-log\"" + (state.replayLogOpen ? " open" : "")
    + "><summary>戦闘履歴</summary>"
    + "<ol class=\"events\">" + shown.map((event) => "<li class=\"event\"><span class=\"event-round\">R"
      + (event.round ?? "-") + "</span><span>" + esc(eventText(event)) + "</span>"
      + "<code class=\"event-type\">" + esc(event.type) + "</code></li>").join("") + "</ol>"
    + "<details class=\"technical-log\"><summary>技術ログ</summary>"
    + diagnosticStamp()
    + "<p class=\"muted\">全イベントを診断用データとして表示します。</p>"
    + "<pre>" + esc(JSON.stringify(result.events || state.replayEvents || [], null, 2)) + "</pre></details></details>";
  // PR #255 — **装備を選ぶ画面は、選ぶものだけを上に置く。**
  //
  // 作者試遊 2026-09-12 —「報酬画面の『戦闘後の状態』も複雑すぎて要らないかも。
  // 戦闘後キャンプの『LAST BATTLE』と同じモーダルでいいです。」勝敗の大札・4つの
  // 指標・人物ごとのHP・装備耐久の一覧を、キャンプと同じ一枚へ置き換える。
  // 候補と拾う釦を折り返しの上へ収めるため、その一枚は**候補の下**に置く
  // （決めるのは候補で、直前の一戦はその材料ではない）。
  //
  // 上端の「安全に撤退する」も出さない。**候補を一つ拾ってから撤退できる**
  // （先に撤退すると、選ばせておいて取り上げる形になる）。
  if (rewardLayout) {
    return shell(
      nextBlock + "<section class=\"card result-encounter-report\">"
      + encounterReport(state.run.encounterIndex, currentEncounter()) + "</section>"
      + rotationStrip(result) + replay + history);
  }
  return shell( status + nextBlock + stateCard + rotationStrip(result) + replay + history);
}


// R15 — 戦闘の勝利で技能点は全員へ自動付与する。装備の候補はボス戦突破後だけ、
// **装備2件のあいだの選択**として出る（活動資金も補給もこの選択に入らない）。
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

// PR #255 — **装備の候補を出すのはボス戦を突破したときだけ。**判定は
// progression 側の一箇所（`offersRewardAfterClear`）が持つので、画面と進行が
// 別々の条件を持たない。
function rewardDueForCurrentEncounter() {
  return offersRewardAfterClear(state.run.encounterIndex);
}

// issue #138 — ボス戦の勝利で結果画面に来た時点で、装備候補を一度だけ用意する。
// すでに用意済み（引き直し済みも含む）なら上書きしない。
function ensureResultReward(won, prologueUnresolved) {
  if (!won || prologueUnresolved || !rewardDueForCurrentEncounter()) return;
  // PR #255 — 最終戦（12戦目）の候補を受け取ったあとは、同じ画面に留まって
  // 精算へ進む。**受け取った戦闘の候補を作り直さない**（何度でも拾えてしまう）。
  if (state.rewardTakenAtEncounter === state.run.encounterIndex) return;
  if (state.rewardOffer.length) return;
  const rerolls = state.run.rerollsUsed?.[state.run.encounterIndex] ?? 0;
  state.rewardOffer = rewardOffer(state.run, state.profile, state.run.encounterIndex, rerolls);
  record("reward_presented", { encounter: state.run.encounterIndex, offer: clone(state.rewardOffer) });
}

// PR #255 — **装備の2候補を、1画面に収める。**
//
// 作者指摘 2026-09-12：「装備は2つとも画面に収める。少なくとも iPhone 16e では
// スクロールなしで選べてほしい。ヴァンパイアサバイバーズを参考に。」
//
// そのために、札の形を「読む順」で三層に分けた。
//
//   1. 名前と等級、品全体を変える一行（keystone / 規格外の代償）
//   2. 常時効果と、追加効果の要約（格・名前・量）を一行ずつ
//   3. 条件・代償・発火回数まで入った全文は、畳んだ段の中
//
// **全文はいつでも拾う前に読める**（AGENTS.md の完全開示）。畳むのは長い文だけで、
// 量・格・耐久・発火回数は畳まずに出す。候補が3つに増えても同じ形で並ぶように、
// 札の高さは候補数（`data-count`）から CSS が締める。
// 候補が増えるほど、一枚に割ける高さは減る。**畳む量だけを変える**
// （畳んだ先には必ず全文がある）。数えるのは「行」で、条件の行も効果の行も同じ1行。
function rewardRowBudget(count) {
  return count >= 3 ? 3 : 4;
}

function rewardEffectLine(effect, { always = false } = {}) {
  const amount = effect.amount == null ? ""
    : always ? " +" + esc(effect.amount) : "（" + esc(effect.amount) + "）";
  // **常時効果と発火効果を見分けられるようにする。**畳んだ形では「腕力 +20」と
  // 「装備の耐久を戻す（3）」が同じ見た目で並ぶので、条件も耐久も要らない一つだけに
  // 印を付ける（全文の「基礎効果・常時」と同じことを、一文字で言う）。
  const mark = always
    ? "<span class=\"effect-always\" title=\"基礎効果・常時。条件も耐久も要りません\">常時</span>"
    : "";
  return "<li>" + effectRarityBadge(effect.rarity, effect.rarityLabel) + mark
    + "<span>" + esc(effect.summary) + amount + "</span></li>";
}

// PR #255 — **rule の見出し。**作者試遊 2026-09-12「結局、条件と消費も見ないと
// 選べないです」。効果の要約だけでは拾うかどうかを決められないので、
// **いつ・何を払い・何回**をその効果の真上に置く。
function rewardRuleHeadHtml(rule) {
  const chips = [...(rule.paid ?? []), rule.limitText]
    .filter(Boolean)
    .map((text) => "<span>" + esc(text) + "</span>").join("");
  return "<p class=\"reward-rule-head\"><b>" + esc(rule.when) + "</b>" + chips + "</p>";
}

function rewardChoiceHtml(offer, index, { full, rowBudget }) {
  // R8 §3.5 — 生成に失敗したら既定品へ黙って落とさず、診断をそのまま出す。
  if (offer.type === "generator_error") {
    return "<article class=\"reward-choice disabled\"><header><h3>装備の候補が作れませんでした</h3></header>"
      + "<p class=\"muted\">" + esc(offer.message) + "</p>"
      + "<p class=\"muted\">ほかの候補を選ぶか、補給1で引き直してください。</p></article>";
  }
  const item = offer.item ?? null;
  const info = item ? null : EQUIPMENT[offer.equipmentId];
  const label = item ? item.definition.displayName : (info?.label ?? offer.equipmentId);
  const durability = item ? item.definition.maxDurability : (info?.maxDurability ?? 1);
  const readout = item?.readout ?? null;
  const implicit = (readout?.effects ?? []).find((effect) => effect.unconditional) ?? null;
  // **古い readout（rule の構造を持たない Blueprint）でも壊れない。**その場合は
  // 条件を畳んだ全文だけが持つので、rule 見出しは出さずに全文へ誘導する。
  const rules = Array.isArray(readout?.rules) ? readout.rules : [];

  // 行の予算を「常時1行 + rule ごとに（見出し1行 + 効果の行）」で使い切る。
  // 途中で尽きたら、その先は畳んだ全文の中にある。
  let rows = 0;
  const blocks = [];
  let hiddenEffects = 0;
  if (implicit) {
    blocks.push("<ul class=\"reward-effect-list\">"
      + rewardEffectLine(implicit, { always: true }) + "</ul>");
    rows += 1;
  }
  for (const rule of rules) {
    const effects = rule.effects ?? [];
    // 見出し1行ぶんと効果1行ぶんの余地が無ければ、その rule ごと畳む。**見出しだけ
    // 出す**のは一番悪い（条件と代償を見せて、何が起きるかを隠すことになる）。
    if (rows + 2 > rowBudget && blocks.length) {
      hiddenEffects += effects.length;
      continue;
    }
    const room = Math.max(1, rowBudget - rows - 1);
    const shown = effects.slice(0, room);
    hiddenEffects += effects.length - shown.length;
    blocks.push("<div class=\"reward-rule\">" + rewardRuleHeadHtml(rule)
      + "<ul class=\"reward-effect-list\">" + shown.map((effect) => rewardEffectLine(effect)).join("")
      + "</ul></div>");
    rows += 1 + shown.length;
  }
  const banner = item
    ? (readout?.keystone
      ? "<p class=\"reward-keystone\">✦ " + esc(readout.keystone) + "</p>" : "")
      + (readout?.risk
        ? "<p class=\"reward-risk\">規格外の代償：" + esc(readout.risk) + "</p>" : "")
    : "";
  const body = blocks.length ? blocks.join("")
    : "<p class=\"muted\">" + esc(info?.effect ?? "") + "</p>";
  const lines = Array.isArray(readout?.lines) ? readout.lines : [];
  // 耐久も畳まない情報なので、畳んだ段の見出しへ同じ行に載せる（行を一つ節約する）。
  // 畳んだ残りの件数は、**それを開く行**が持つ（別の一行にすると、札の高さを
  // 一段食ったうえで「どこを押せば読めるのか」を言わないままになる）。
  const fullText = "<details class=\"reward-full\"><summary><span class=\"reward-meta\">戦闘耐久 "
    + durability + "</span>全文を読む（"
    + (hiddenEffects > 0 ? "ほか " + hiddenEffects + " 件・" : "")
    + "条件・代償・回数）</summary>"
    + lines.map((line) => "<p class=\"equipment-rule-line\">" + esc(line) + "</p>").join("")
    // R8 §3.1 — 偶然性の主語は装備。**拾った品が、拾われ方について一行だけ言う。**
    + (item && generatedVoice(item) ? "<p class=\"item-voice\">" + esc(generatedVoice(item)) + "</p>" : "")
    + "</details>";
  return "<article class=\"reward-choice" + (item?.rarity ? " rarity-card-" + esc(item.rarity) : "") + "\">"
    + "<header><h3>" + esc(label) + "</h3>" + rarityChip(item?.rarity) + "</header>"
    + banner + body + fullText
    + (full ? "<p class=\"muted\">持ち物が" + INVENTORY_LIMIT + "品で一杯です。装備画面で一品を分解してください。</p>" : "")
    + button("これを拾う", "take-reward", full, "button primary reward-take",
      "data-offer=\"" + index + "\"") + "</article>";
}

// issue #138 — 結果画面に埋め込む報酬選択。以前は「報酬を見る」で別画面へ渡していた。
function rewardSectionHtml() {
  const full = state.run.inventory.length >= INVENTORY_LIMIT;
  const count = Math.max(1, state.rewardOffer.length);
  const rowBudget = rewardRowBudget(count);
  const cards = state.rewardOffer
    .map((offer, index) => rewardChoiceHtml(offer, index, { full, rowBudget })).join("");
  const rerolls = state.run.rerollsUsed?.[state.run.encounterIndex] ?? 0;
  return "<section class=\"card reward-card-shell\">"
    + sectionHeading("REWARD", "どちらを持ち帰る？",
      "<span class=\"stage\">補給 " + state.run.supplies + " / " + supplyTotal() + "</span>")
    + (state.run.encounterIndex >= ENCOUNTERS_PER_RUN
      ? ruleGrid([{ glyph: "flag", title: "最後の一戦", value: "次は精算", line: "選んだ品は精算で残す設計図の候補になります。" }])
      : "")
    + "<div class=\"reward-choices\" data-fx=\"rewards\" data-count=\"" + count + "\">" + cards + "</div>"
    + "<div class=\"reward-reroll\">"
    + button("補給1で候補を引き直す", "reroll-reward", state.run.supplies < 1 || rerolls >= 1, "button quiet")
    + "<small>" + (rerolls >= 1 ? "この戦闘ではもう引き直せません。" : "1戦闘に一度だけ。再挑戦の余地が減ります。")
    + (appraisalLevel(state.profile) > 0
      ? " 目利き Lv" + appraisalLevel(state.profile) + "：等級を " + (appraisalLevel(state.profile) + 1)
        + " 回引いて良い方を採っています。"
      : "")
    + "</small></div>"
    // R12 §4.B — 報酬の画面にも世界の側の一行を置く。**選ぶ材料ではない**ので、
    // 候補と引き直しのあと（画面の折り返しより下でよい位置）へ回す。
    + "<p class=\"world-voice\">" + esc(rewardVoice()) + "</p></section>";
}

// R6 §12.2 — 敗北処理。**即座に破棄しない。**
// 作者要望 2026-09-13 — **敗北画面から説明文を外す。**
//
// 「届かなかった。補給1で編成・位置・技能・装備を変えて……」という一段落は、
// 画面が既に持っている三つのこと（どこで止まったか／何を払うか／何が残るか）を
// 文へ畳み直していた。ここではそれを、止まった位置の目盛り・払って変える流れ・
// 確定した数のタイルで出す。**残す文は、世界の側が言う一行だけ。**
function renderDefeat() {
  const canRetry = state.run.supplies >= 1;
  const encounter = currentEncounter();
  const ledger = state.run.fundLedger;
  const reached = ledger.highestClearedEncounter;
  const plate = "<section class=\"card verdict loss verdict-plate\">"
    + verdictSigil("loss") + "<h2>足を止めた</h2>"
    + "<p class=\"verdict-context\">" + esc(encounter.name) + " · 第" + (state.run.encounterIndex + 1) + "戦</p>"
    + "<div class=\"verdict-rail\">"
    + segmentMeter(reached, ENCOUNTERS_PER_RUN, {
      label: "到達 " + reached + " / " + ENCOUNTERS_PER_RUN,
      nextIndex: reached,
      tone: "bad",
    })
    + "</div>"
    + "<p class=\"world-voice\">" + esc(defeatVoice()) + "</p></section>";
  // **払うもの → 変えられるもの → 戻る先。**再挑戦の中身は、この三つで尽きている。
  const retryFlow = flowStrip([
    { glyph: "supply", label: "補給 −1", sub: "払う", tone: "bad" },
    { glyph: "person", label: "編成・技能・装備", sub: "組み替える" },
    { glyph: "retry", label: "同じ一戦", sub: "やり直す", tone: "gold" },
  ]);
  const actionCard = "<section class=\"card primary-action defeat-primary-action\" data-primary-action=\"defeat-next\">"
    + sectionHeading("NEXT", "次の手", "<span class=\"stage\">補給 " + state.run.supplies + "</span>")
    + suppliesBar(canRetry ? "再挑戦に1つ使う" : "補給が尽きた")
    + (canRetry
      ? retryFlow + button("補給1で編成を変えて再挑戦", "retry-encounter", false, "button primary")
      : ruleGrid([{ glyph: "lock", title: "補給 0", value: "再挑戦できない", line: "この遠征はここで終わります。", tone: "bad" }]))
    + button("遠征を終えて精算する", "settle-run", false, canRetry ? "button" : "button primary")
    + "</section>";
  return shell(plate + actionCard
    + "<section class=\"card\">" + sectionHeading("CARRY HOME", "ここまでで確定した活動資金")
    + statTiles([
      { value: formatFunds(ledger.provisionalTotal), label: "負けても持ち帰る", tone: "gold", glyph: "funds", wide: true },
      { value: ledger.clearedEncounterBase, label: "撃破", glyph: "strike" },
      { value: reached, unit: "戦", label: "到達", glyph: "distance" },
      { value: "×" + (ledger.difficultyMultiplierBps / 10000).toFixed(1), label: "倍率", glyph: "multiply" },
    ], "", 3)
    + "</section>");
}

// R8 §3.6 / §10.3 — 遠征終了時に残った設計図。**何が残り、何が残らなかったかを
// 両方出す。**「良い品を拾ったのに残らなかった」を黙って起こさない。
function blueprintSettlementSection(settlement) {
  const saved = settlement.savedBlueprints ?? [];
  const found = settlement.blueprintCandidateCount ?? newGeneratedItems(state.run).length;
  if (!found && !saved.length) return "";
  const cards = saved.map((entry) =>
    "<div class=\"settle-row\"><span>" + esc(entry.displayName) + rarityChip(entry.rarity)
    + "</span><b>" + (entry.added ? "新しく残した" : "取得履歴を追加") + "</b></div>").join("");
  // PR #255 — 設計図を持ち帰れるのは**勝って生還したときだけ**（勝利1・撤退0・
  // 敗北0）。残せないときは「残せなかった」ではなく**なぜ残らないのか**を言う
  // （見つけた品が消えた理由が画面から読めないと、拾った意味が分からなくなる）。
  const limit = settlement.blueprintSaveLimit;
  const capacity = blueprintCarryCapacity(state.profile);
  return "<section class=\"card\">" + sectionHeading("BLUEPRINT", "設計図として残した品",
      "<span class=\"stage\">" + saved.length + " / " + limit + "</span>")
    + statTiles([
      { value: found, unit: "品", label: "見つけた", glyph: "gear" },
      { value: saved.length, unit: "件", label: "残した", glyph: "blueprint", tone: saved.length ? "gold" : "quiet" },
      { value: capacity, unit: "件", label: "次の持込枠", glyph: "supply", tone: "quiet" },
    ], "", 3)
    + (saved.length
      ? "<div class=\"settle-list\">" + cards + "</div>"
      : limit > 0
        ? ruleGrid([{ glyph: "cross", title: "残せる品なし", value: "今回は無し", line: "設計図になる装備を見つけていません。", tone: "quiet" }])
        : ruleGrid([{
          glyph: "lock",
          title: "持ち帰れない",
          value: "見つけた " + found + " 品を手放す",
          line: "設計図を持ち帰れるのは12戦を抜けて生還したときだけです。",
          tone: "bad",
        }]))
    + (saved.length && found > saved.length
      ? "<p class=\"muted\">この遠征で見つけた装備 " + found + " 品のうち、"
        + (settlement.blueprintChosen ? "選んだ " : "等級の高い ")
        + saved.length + " 品だけを残しました。</p>"
      : "")
    + (saved.length
      ? flowStrip([
        { glyph: "gear", label: "拾う", sub: "遠征のなか" },
        { glyph: "blueprint", label: "残す", sub: "精算で選ぶ", tone: "gold" },
        { glyph: "supply", label: "持ち込む", sub: "枠 " + capacity },
      ])
      : "")
    + "</section>";
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

// issue #151 — **遠征終了時に何を設計図として残すかを、プレイヤーが決める。**
//
// これまでは等級の高い順に自動で残していた。装備の組み合わせを見つけるゲームで、
// 最後の価値判断だけがレアリティに置き換わっていたので（今回の構成を成立させた
// 低レア品より、使わなかった高レア品が残る）、候補と上限を出して選ばせる。
//
// **条件・代償・効果・レアリティは、残す前に全文で読める**（畳んだ段の中）。
// 選ばなかった品は残らない——埋まっていない枠を自動で埋めない。
function renderBlueprintPick() {
  const outcome = state.pendingSettlement?.outcome;
  if (!outcome) return renderSettlement();
  const limit = blueprintSaveLimitFor(outcome);
  const candidates = blueprintSaveCandidates(state.run);
  const chosen = new Set(Array.isArray(state.blueprintKeep) ? state.blueprintKeep : []);
  const outcomeLabel = { won: "12戦を抜けた", retreat: "安全に撤退した", lost: "遠征は途中で終わった" }[outcome]
    ?? "遠征が終わった";
  const cards = candidates.map((item) => {
    const selected = chosen.has(item.descriptor);
    return "<article class=\"keep-card" + (selected ? " selected" : "")
      + (item.rarity ? " rarity-card-" + esc(item.rarity) : "") + "\">"
      + "<button type=\"button\" class=\"keep-main\" data-action=\"toggle-blueprint-keep\""
      + " data-descriptor=\"" + esc(item.descriptor) + "\" aria-pressed=\"" + (selected ? "true" : "false")
      + "\"><span class=\"keep-mark\" aria-hidden=\"true\">" + (selected ? "✓" : "") + "</span>"
      + "<span class=\"keep-name\">" + esc(item.definition.displayName) + "</span>"
      + rarityChip(item.rarity) + "</button>"
      + "<details class=\"reward-full\"><summary>全文を読む（条件・代償・回数）</summary>"
      + equipmentReadoutHtml(item, { compact: false }) + "</details></article>";
  }).join("");
  const primary = "<section class=\"card primary-action\" data-primary-action=\"blueprint-keep\">"
    + sectionHeading("BLUEPRINT", "残す設計図を選ぶ",
      "<span class=\"stage\">" + chosen.size + " / " + limit + "</span>")
    + statTiles([
      { value: candidates.length, unit: "品", label: "見つけた", glyph: "gear" },
      { value: chosen.size + " / " + limit, label: "選んだ / 残せる", glyph: "blueprint", tone: "gold" },
    ], "", 2)
    + segmentMeter(chosen.size, limit, { label: "残す", tone: "good" })
    + ruleGrid([{
      glyph: "lock",
      title: outcomeLabel,
      value: "設計図は最大 " + limit + " 件",
      line: "選ばなかった品は残りません。",
      tone: "bad",
    }])
    + button(chosen.size ? "この " + chosen.size + " 件を残して精算する" : "何も残さず精算する",
      "confirm-blueprint-keep", false, "button primary")
    + "</section>";
  return shell(primary
    + "<section class=\"card\">" + sectionHeading("CANDIDATES", "この遠征で見つけた装備",
      "<span class=\"stage\">" + candidates.length + " 品</span>")
    + ruleGrid([
      { glyph: "check", title: "押すと入れ替わる", value: "選択", line: "上限ぶんまで選べます。", tone: "quiet" },
      { glyph: "blueprint", title: "持込品", value: "候補に出ない", line: "既に設計図があるためです。", tone: "quiet" },
    ], "two")
    + "<div class=\"keep-list\">" + cards + "</div>"
    + flowStrip([
      { glyph: "blueprint", label: "残す", sub: "この画面", tone: "gold" },
      { glyph: "supply", label: "持ち込む", sub: "枠 " + blueprintCarryCapacity(state.profile) },
    ])
    + "</section>");
}

// R6 §9.2 — 精算は**一度だけ**。ここが唯一の入口。
//
// 作者要望 2026-09-13 — **締めの画面から説明文を外す。**内訳は棒の長さで比べ、
// 「何が残り、何が消えるか」は二列で並べる。文のまま残すのは締めの一行だけ
// （あれは説明ではなく、拾い屋の側の言い方である）。
function renderSettlement() {
  const settlement = state.lastSettlement;
  if (!settlement) return renderExpeditionStart();
  const b = settlement.breakdown;
  const won = settlement.outcome === "won";
  // R8 §10.3 — 安全撤退は敗北ではない。完走・初clearボーナスは付かないが、
  // 確定済み活動資金はそのまま持ち帰る（撃破ゼロ没収はしない）。
  const retreated = settlement.outcome === "retreat";
  const reached = state.run.fundLedger.highestClearedEncounter;
  const title = won ? "遠征を終えた" : retreated ? "安全に撤退した" : "遠征は途中で終わった";
  const plate = "<section class=\"card verdict verdict-plate " + (won ? "win" : "loss") + "\">"
    + verdictSigil(won ? "win" : retreated ? "retreat" : "loss")
    + "<h2>" + esc(title) + "</h2>"
    + "<p class=\"verdict-context\">"
    + esc(CAMPAIGN_STAGES[state.run.campaignStageSequence]?.displayName ?? "遠征")
    + " · " + reached + " / " + ENCOUNTERS_PER_RUN + " 戦</p>"
    + "<div class=\"verdict-rail\">"
    + segmentMeter(reached, ENCOUNTERS_PER_RUN, {
      label: "到達 " + reached + " / " + ENCOUNTERS_PER_RUN,
      nextIndex: won ? null : reached,
      tone: won ? "good" : "bad",
    })
    + "</div>"
    + statTiles([
      { value: "+" + formatFunds(settlement.earned), label: "持ち帰った活動資金", tone: "gold", glyph: "funds", wide: true },
      { value: formatFunds(settlement.balanceBefore), label: "残高（前）", tone: "quiet" },
      { value: formatFunds(settlement.balanceAfter), label: "残高（後）", tone: "gold" },
    ], "", 2)
    + "<p class=\"settle-closing\">" + esc(settlementClosingLine(settlement)) + "</p></section>";
  const nextAction = "<section class=\"card primary-action settlement-primary-action\" data-primary-action=\"settlement-next\">"
    + sectionHeading("NEXT", "次の行き先")
    + button("根城へ帰る", "go-homestead", false, "button primary")
    + button("ギルドへ戻る", "back-guild", false, "button")
    + button("記録を送る", "complete", false, "button")
    + "</section>";
  // **内訳は長さで比べる。**どの項目が今回の実入りを作ったかは、数字の列では読めない。
  const breakdown = ledgerRows([
    { label: "撃破した戦闘", value: b.clearedEncounterBase, glyph: "strike" },
    { label: "到達距離（" + reached + "戦 × 25）", value: b.distance, glyph: "distance" },
    { label: "12戦完走", value: b.outcomeBonus, glyph: "flag" },
    { label: "この区画の初回クリア", value: b.firstClearBonus, glyph: "spark" },
  ]);
  const limit = settlement.blueprintSaveLimit;
  const totals = "<div class=\"settle-total\">"
    + "<div class=\"settle-row total\"><span>報酬倍率</span><b>×"
    + (b.difficultyMultiplierBps / 10000).toFixed(1) + "</b></div>"
    + "<div class=\"settle-row total grand\"><span>合計</span><b>"
    + formatFunds(settlement.earned) + "</b></div></div>";
  return shell(plate + nextAction
    + "<section class=\"card\">" + sectionHeading("SETTLEMENT", "内訳")
    + breakdown + totals
    + splitColumns(["活動資金", "設計図"], ["技能点", "解禁", "装備", "補給"])
    + ruleGrid([limit > 0
      ? {
        glyph: "blueprint",
        title: "設計図",
        value: "最大 " + limit + " 件",
        line: (won ? "勝利" : retreated ? "安全撤退" : "敗北") + "なので、ここまで残せました。",
        tone: "good",
      }
      : {
        glyph: "blueprint",
        title: "設計図",
        value: "残らない",
        line: (retreated ? "安全撤退" : "敗北") + "では持ち帰れません。",
        tone: "bad",
      }])
    + "</section>"
    + blueprintSettlementSection(settlement)
    + (settlement.unlockedCampaignStage !== null && settlement.unlockedCampaignStage !== undefined
      ? "<section class=\"card unlock-card\">" + glyph("flag", "unlock-glyph")
        + "<div><small>区画が開いた</small><b>"
        + esc(CAMPAIGN_STAGES[settlement.unlockedCampaignStage]?.displayName ?? ("区画 " + settlement.unlockedCampaignStage))
        + "</b></div></section>"
      : "")
    );
}

function renderComplete() {
  const feedback = state.feedback || {};
  const option = (value, label, selected) => "<option value=\"" + value + "\" " + (selected ? "selected" : "") + ">" + label + "</option>";
  const roster = state.run.roster;
  const carriedGear = state.run.inventory.map((id) => gear(id)?.label ?? id);
  const reached = state.run.fundLedger.highestClearedEncounter;
  const settlement = state.lastSettlement;
  // 作者要望 2026-09-13 — 締めの一枚も**名前は名札、道のりは帯**で出す。
  const nameChips = (items, empty) => "<div class=\"name-chips\">"
    + (items.length ? items.map((text) => "<span>" + esc(text) + "</span>").join("")
      : "<span class=\"empty\">" + esc(empty) + "</span>") + "</div>";
  return shell("<section class=\"card verdict win verdict-plate\">"
    + verdictSigil("win") + "<h2>遠征を終えた</h2>"
    + "<p class=\"verdict-context\">" + reached + " / " + ENCOUNTERS_PER_RUN + " 戦を見届けた</p>"
    + "<div class=\"verdict-rail\">"
    + segmentMeter(reached, ENCOUNTERS_PER_RUN, { label: "到達 " + reached + " / " + ENCOUNTERS_PER_RUN, tone: "good" })
    + "</div>"
    + statTiles([
      settlement
        ? { value: formatFunds(settlement.earned), label: "持ち帰った活動資金", tone: "gold", glyph: "funds", wide: true }
        : null,
      { value: roster.length, unit: "人", label: "今回の仲間", glyph: "person" },
      { value: carriedGear.length, unit: "品", label: "手元の装備", glyph: "gear" },
    ], "", 2)
    + nameChips(roster.map(characterName), "なし")
    + nameChips(carriedGear, "装備なし")
    + flowStrip([
      { glyph: "flag", label: "仕立てた", sub: "遠征" },
      { glyph: "skill", label: "組んだ", sub: "技能パックの範囲で" },
      { glyph: "supply", label: "決めた", sub: "補給の使い道" },
      { glyph: "funds", label: "育てた", sub: "ギルド", tone: "gold" },
    ], "complete-trail")
    + "</section>"
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
    enterStory([storyBeat("stage_0", "prologueDefeat")], "prologueRewind");
    return true;
  }
  if (state.prologueStage === "retry" && state.lastResult?.result === "win") {
    enterStory([storyBeat("stage_0", "prologueWin")], "prologueClear");
    return true;
  }
  return false;
}

// R9 §2.1 — 巻き戻し。**序盤の敗北は遠征の結果に数えない。**
// 活動資金も持ち越しHPも動かさず、同じ Stage の第1戦から本編を始める。
//
// 会話の門の釦（rewind-prologue）と、門の無い形で会話が尽きたとき
// （after: "prologueRewind"）の**両方がここを通る。**どちらから来ても同じ状態になる。
// スキップは門で止まる（storySkipStop）ので、越えるのは釦だけである。
function rewindPrologue() {
  // issue #200 — **逆走に使う材料は、状態を巻き戻す前に取る。**読んだ行の履歴は
  // このあと enterStory() が空にするので、ここで写しておく（門の釦から来たときは
  // 舞台が立っており、スキップから来たときは storyBeat() で同じ断片を引き直す）。
  const scene = rewindScene(currentStoryBeat() ?? storyBeat("stage_0", "prologueDefeat"));
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
  // issue #200 — 会話へ入る前に、逆走の演出を一度だけ挟む。**状態はもう巻き戻して
  // あるので、演出はどこで途切れても進行を失わない。**読んだ行が無ければ
  // （逆走させるものが無ければ）そのまま会話へ入る。
  state.rewind = scene;
  enterStory([storyBeat("stage_0", "prologueRewound")], "camp", { via: scene ? "rewind" : null });
}

// PR #255 — **結果画面は、そこで決めることがある戦闘にだけ出す。**
// 残るのは三つだけである。
//
//   1. 負けた（再挑戦するか、精算するかを決める）
//   2. ボス戦を突破した（装備の候補から一つ選ぶ）
//   3. 12戦目を突破した（精算へ進む）
//
// それ以外の勝利はそのままキャンプへ戻し、踏破した節の4指標が
// `run.results` から実績を読みます。
function resultScreenDue() {
  if (state.simulationMode) return true;
  if (state.prologueActive) return true;
  if (state.lastResult?.result !== "win") return true;
  if (state.run.encounterIndex >= ENCOUNTERS_PER_RUN) return true;
  return rewardDueForCurrentEncounter();
}

// 戦闘画面から次の場面へ出る一箇所。序盤の一戦なら会話が先に入る
// （enterPrologueBeatIfDue）。
//
// issue #138 では再生が流れきったところで自動的にここへ入っていたが、作者試遊
// 2026-09-13 で**決着の帯を読む間がない**ことが分かったので、再生はVICTORY /
// DEFEAT の拍で止まり、ここへ入るのは［次へ］を押したときだけになった。
function goToBattleResult() {
  state.replayPlaying = false;
  if (!state.simulationMode && enterPrologueBeatIfDue()) return;
  if (!resultScreenDue()) {
    advanceAfterBattle();
    return;
  }
  state.phase = "result";
  saveState();
  render();
}

function scheduleReplayBeat() {
  stopReplayTimer();
  if (state.phase !== "battle") return;
  const beats = replayBeats();
  const index = clampReplayIndex();
  // 作者試遊 2026-09-13 — **決着で止まる。**issue #138 では最後の拍のあと自動で
  // 結果画面（または序盤の会話）へ進めていたが、VICTORY / DEFEAT の帯が出た直後に
  // 画面が入れ替わるので、勝敗を読む間がなかった。ここでは再生を閉じるだけにして、
  // 次の場面へ渡すのは［次へ］（`replay-result`）一箇所へ寄せる。序盤の会話も
  // 同じ釦から入る（`goToBattleResult` が `enterPrologueBeatIfDue` を通す）。
  if (atReplayEnding(index, beats)) {
    state.replayPlaying = false;
    saveState();
    updateReplayControls(index, beats);
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
function simulateAndEnterBattle({ previewOnly = false } = {}) {
  let battle;
  // issue #240 — いま挑むのが必殺技の教材の一戦か。**戦う前に数えておく**
  // （勝つと encounterIndex が進むので、後から判定すると答えが変わる）。
  const lessonBattle = ultimateLessonActive();
  // 最終戦の受け取り印は、次の一戦を始めた時点で役目を終える。
  state.simulationMode = previewOnly;
  if (!previewOnly) state.rewardTakenAtEncounter = null;
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
    if (!previewOnly) {
      record("battle_started", {
        encounter: state.run.encounterIndex,
        kind: composed.kind,
        difficulty: state.run.difficulty,
        threat: composed.spentThreat,
        battleId: battle.battleId,
      });
    }
    const result = simulation.result;
    state.lastResult = compactResult(result);
    const replay = compactReplay(result);
    state.replayEvents = replay.events;
    state.replaySnapshots = replay.snapshots;
    state.replayIndex = 0;
    state.replayPlaying = true;
    if (!previewOnly) state.run.results = [...state.run.results, {
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
    if (!previewOnly && result.result === "win") {
      // issue #240 — 必殺技の一戦は**勝った時点で役目を終える。**負けた回は印を押さない
      // ので、再挑戦でも同じ教材（同じ盤面・同じ錠）がもう一度出る。
      if (lessonBattle) {
        state.profile = {
          ...state.profile,
          storyFlags: [...new Set([...(state.profile.storyFlags ?? []), ULTIMATE_LESSON_FLAG])],
        };
        record("ultimate_lesson_cleared", {
          characterId: ULTIMATE_LESSON_GOAL?.characterId ?? null,
          skillId: ULTIMATE_LESSON_GOAL?.skillId ?? null,
          roundsUsed: result.roundsUsed,
        });
      }
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
      const automatic = fulfillSkillReservations(state.run);
      state.run = automatic.run;
      applyAutomaticSkillActions(automatic.actions);
      for (const completed of automatic.completed) {
        record("skill_reservation_completed", completed);
      }
    }
    if (!previewOnly) {
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
    }
    // R8 §3.2 の図鑑。**会ったことは Profile に残る。**遠征を捨てても、
    // 序盤の一戦でも残す（会ったという事実は、勝敗で取り消されない）。
    if (!previewOnly) {
      state.profile = recordBestiary(
        state.profile,
        (composed.enemies ?? []).map((enemy) => enemy.enemyActorId),
        { defeated: result.result === "win" },
      );
    }
    // R8 §8, §10 — Campaign Stage: 勝利時だけHPをcommitする（敗北時はrunを
    // 変更しない=retry safe）。4/8戦目boss勝利後はcommitBattleResultが全回復する。
    // R11 §5 改 — 巻き戻したあとの一戦もこの経路で HP を commit する。
    // もう「遠征に数えない」演習ではない。
    if (!previewOnly) {
      if (isCampaignRun()) {
        const commit = commitBattleResult(state.profile, state.run, state.run.encounterIndex, result);
        state.run = commit.run;
        state.lastCarrySnapshot = commit.snapshot;
        resetEquipmentDurability();
      } else {
        resetBattleResources();
      }
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
    if (!previewOnly) {
      if (isCampaignRun()) resetEquipmentDurability();
      else resetBattleResources();
    }
    state.error = null;
    state.phase = "battleError";
  }
  saveState();
  render();
}

function advanceAfterBattle() {
  // R11 §5 改 — 巻き戻したあとの勝利（本編1戦目）は、報酬を受け取ってここへ来た
  // 時点で本当に序盤の演出を終える。prologueClear では落とさなかった
  // prologueActive / prologueStage をここで落とす（結果・報酬画面の名称表示は
  // もう済んでいるので、次戦以降の currentEncounter() は通常のladderへ戻る）。
  if (state.prologueActive) {
    state.prologueActive = false;
    state.prologueStage = null;
  }
  const completedEncounter = state.run.encounterIndex;
  // 作者要望 2026-09-14 — 一戦目の後は技能、二戦目の後は補給。**同じ拍に二つは来ない。**
  const showSkillLesson = shouldShowSkillLessonAfterBattle();
  const showSupplyTutorial = shouldShowSupplyTutorialAfterBattle();
  state.run.encounterIndex += 1;
  state.rewardOffer = [];
  state.lastResult = null;
  state.replayEvents = [];
  state.replaySnapshots = [];
  state.replayIndex = 0;
  state.replayPlaying = false;
  state.phase = "camp";
  // 作者指摘 2026-09-14 — **手取りはタブを押すところから始める。**キャンプが勝手に
  // 技能タブ・補給タブを開くと、「その画面がどこにあるのか」を教える一手が消える。
  // どちらの手取りも一手目が「タブを押す」なので、戻る先は通常どおり遠征タブにする。
  state.tab = "map";
  if (showSkillLesson && SKILL_LESSON_GOAL) {
    // **払う相手は、教える相手以外から始める。**「誰に払うか」を選ぶ一手を
    // 教えるので、その相手が最初から選ばれていると段が一つ空振りする。
    state.selectedCharacter = state.run.roster.find((id) => id !== SKILL_LESSON_GOAL.characterId)
      ?? state.selectedCharacter;
    state.selectedSkillNode = null;
    state.skillTreeKind = skillLessonNode(SKILL_LESSON_GOAL.unlockSkillId)?.kind ?? "active";
    state.skillTreeBranch = null;
    state.skillLessonHandedOff = false;
  }
  state.inspectedEncounterIndex = null;
  state.selectedEnemyId = null;
  state.treatmentSelection = null;
  state.treatmentResult = null;
  state.treatTargets = [];
  state.error = null;
  state.run.act = actOfIndex(state.run.encounterIndex);
  record("stage_advanced", { encounter: state.run.encounterIndex, act: state.run.act });
  if (showSkillLesson) {
    record("skill_lesson_presented", { encounter: completedEncounter });
  }
  if (showSupplyTutorial) {
    record("supply_tutorial_presented", { encounter: completedEncounter });
  }
  saveState();
  render();
}

// R6 §9.2 — 精算は**一度だけ**。issue #151 で「何を残すか」の選択が前に入ったので、
// 精算そのものはここ一箇所へ閉じ、選択の有無で入口だけが変わるようにした。
//
//   keepDescriptors === null … 従来どおり等級の高い順に上限まで残す
//   配列               … その品だけを残す（選ばなかった品は残らない）
function performSettlement(outcome, keepDescriptors) {
  // issue #212 follow-up — Campaign StageのstageEndは初訪・再訪を分けず、
  // 完走するたびに同じ会話を通常の一行送りで表示する。
  const won = outcome === "won";
  const stage = CAMPAIGN_STAGES[state.run.campaignStageSequence];
  const stageEndBeat = won && stage ? storyBeat(stage.id, "stageEnd") : null;
  const result = settleRun(
    state.profile, state.run, outcome,
    keepDescriptors === null ? {} : { keepDescriptors },
  );
  if (!result.ok) {
    state.error = result.reason;
  } else {
    state.profile = result.profile;
    state.run = result.run;
    state.lastSettlement = result.settlement;
    record("run_settled", result.settlement);
  }
  state.pendingSettlement = null;
  state.blueprintKeep = null;
  if (result.ok && stageEndBeat) {
    enterStory([stageEndBeat], "settlement");
    return;
  }
  state.phase = "settlement";
  saveState();
  render();
}

function ensureSelectedCharacter() {
  state.selectedCharacter = selectedCharacter();
}

function handleAction(event) {
  const element = event.currentTarget;
  // issue #238 — 同じ要素が、押した時間で別の操作になる。長押しは data-longpress。
  const action = event.longPress ? element.dataset.longpress : element.dataset.action;
  if (!action) return;
  // issue #200 — **舞台に被せた操作は、舞台へ落とさない。**会話の門（`.vn-gate`）の釦は
  // `.vn-stage`（`data-action="story-advance"`）の中にあるので、一度押すと釦と舞台の
  // 両方が鳴る。釦が巻き戻したあとの舞台はもう「次の会話」なので、続けて鳴った
  // 「叩いて進む」が巻き戻し後の一行目（「同じ朝。同じ光。」＝時間が戻ったことを
  // 見せる行）を読み飛ばしていた。長押しの合成呼び出しには止める先が無いので `?.` で呼ぶ。
  if (element.closest?.(".vn-gate")) event.stopPropagation?.();
  // R11 §5 改 / issue #240 — 手取りチュートリアル（隊列・補給・必殺技）の錠は**押せる形（DOM）と
  // 経路（ここ）の両方**で掛ける。光っていない場所は押しても何も起きない
  // （DESIGN.md §6.4.3 の離脱経路と同じ二重の塞ぎ方）。長押しの行も同じここを通る。
  if (!tutorialAllows(element)) return;
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
      selectedCampaignStageSequence: 0,
      runId: run.runId,
      startedAt: run.startedAt,
      // #209 — remember which New Game run owns the mandatory first-use
      // walkthroughs. A normal/revisit run must not inherit those gates.
      tutorialRunId: run.runId,
      // issue #159 — 隊列操作は**誰も選んでいない状態**から始める。先頭を選んだ状態で
      // 開くと、盤面のどこかが最初から光っていて「もう一手目を打った」と読める。
      formationSelection: null,
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
    // タイトルのロードメニューを閉じるだけなら、オートセーブを上書きしない。
    if (state.phase === "saveMenu") {
      state.phase = "intro";
      state.saveMenuReturn = "intro";
      state.saveNotice = null;
      state.error = null;
      render();
      return;
    }
    // タイトルへ戻る前のゲーム画面を、Continueの再開先として記録する。
    state.resumePhase = state.phase;
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
    // **開く札は、ジャーニーの先頭。**旧版はここで遠征（＝出口）の札を開いていたので、
    // 根城から順に見て回ると、最初と最後で同じ札を押すことになっていた。
    state.guildTab = defaultGuildTab(profile);
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
    state.inspectedEncounterIndex = 1;
    state.selectedEnemyId = null;
    fx("stage:" + sequence, "select");
    pendingLaunchFocus = true;
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
    state.guildTab = GUILD_TAB_IDS.includes(element.dataset.tab) ? element.dataset.tab : "expedition";
    fx("guild-tab:" + state.guildTab, "pick");
    saveState();
    render();
    return;
  }

  if (action === "select-guild-character") {
    const id = element.dataset.character;
    if (!metCharacterOptions().some((option) => option.id === id)) return;
    state.guildCharacter = id;
    fx("guild-member:" + id, "select");
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
      fx("upgrade:" + element.dataset.upgrade, "gain");
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
      fx("train:" + element.dataset.character + ":" + element.dataset.axis, "level");
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
    state.tab = "map";
    state.migrationNote = null;
    state.prologueActive = false;
    ensureSelectedCharacter();
    state.formationSelection = null;
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
        if (state.story?.auto && !storyGate()) {
          storyAutoTimer = setTimeout(() => { advanceStoryLine(); }, STORY_AUTO_HOLD_MS);
        }
      }
      return;
    }
    // 門のある拍では、舞台を叩いても進まない。**門の釦だけが次を持つ。**
    if (storyGate()) return;
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
    // 門のある会話は、門まで飛ばして止まる。**越えるのは釦だけである。**
    const stop = storySkipStop();
    if (stop) {
      skipStoryToGate(stop);
      return;
    }
    record("story_skipped", { after: state.story?.after ?? "camp" });
    state.story = { ...state.story, queue: [], after: state.story?.after ?? "camp", logOpen: false };
    finishStory();
    return;
  }

  if (action === "rewind-prologue") {
    rewindPrologue();
    return;
  }

  // issue #200 — 逆走の演出は、叩けば追い越せる（会話画面と同じ約束）。
  if (action === "rewind-skip") {
    finishRewind();
    return;
  }

  // 作者試遊 2026-09-11 — 中断復帰の保険。**通常はここへ来ない**（序盤の敗北は
  // 会話の門で受ける）が、保存枠が尽きたときの minimal snapshot は phase を
  // battle から result へ寄せるので、会話を見ないまま結果画面に立つことがある。
  // そのときは倒れた会話から見せ直す。
  if (action === "resume-prologue-defeat") {
    enterStory([storyBeat("stage_0", "prologueDefeat")], "prologueRewind");
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
    // 錠が一枚のタブへ閉じ込めている間は、そこから出さない。**閉じ込め先も文面も
    // `campTutorialTab()` 一箇所から出す**（補給と技能で別々に書くと片方だけずれる）。
    const lockedTab = campTutorialTab();
    if (lockedTab && nextTab !== lockedTab) {
      state.tab = lockedTab;
      state.error = TUTORIAL_TAB_LOCK_NOTICE[lockedTab] ?? "いまはこのタブから移動できません。";
      saveState();
      render();
      return;
    }
    state.phase = "camp";
    state.tab = nextTab;
    fx("tab:" + nextTab, "pick");
    ensureSelectedCharacter();
    saveState();
    render();
    return;
  }

  if (action === "select-character") {
    // 作者要望 2026-09-14 — 技能チュートリアルの最後の一手（もう一人を押す）は、
    // ここを通る。**打てた拍に印を残す**ので、このあと誰を選び直しても段は戻らない。
    if (skillLessonStep() === "handoff") {
      state.skillLessonHandedOff = true;
      record("skill_lesson_handed_off", { characterId: element.dataset.character ?? null });
    }
    state.selectedCharacter = element.dataset.character || state.selectedCharacter;
    state.selectedSkillNode = null;
    fx(cellFxKey(state.selectedCharacter), "select");
    saveState();
    render();
    return;
  }

  if (action === "inspect-encounter") {
    const index = Number(element.dataset.encounter);
    if (!Number.isInteger(index) || index < 1 || index > ENCOUNTERS_PER_RUN) return;
    state.inspectedEncounterIndex = index;
    state.selectedEnemyId = null;
    render();
    return;
  }

  if (action === "select-expedition-enemy") {
    const encounter = inspectedEncounter();
    const enemyId = element.dataset.enemy;
    if (!encounter?.enemies?.some((enemy) => enemy.instanceId === enemyId)) return;
    state.selectedEnemyId = enemyId;
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

  if (action === "reserve-skill") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const requestedLevel = Number(element.dataset.targetLevel);
    const targetLevel = Number.isInteger(requestedLevel) ? requestedLevel : null;
    const previous = skillReservationFor(state.run, characterId);
    const previousLevel = skillReservationLevelFor(state.run, characterId);
    const result = reserveRunSkill(state.run, characterId, skillId, targetLevel);
    if (!result.ok) {
      state.error = result.reason;
    } else {
      state.run = result.run;
      fx("skill:" + skillId, "select");
      record("skill_reserved", {
        characterId,
        skillId,
        targetLevel: skillReservationLevelFor(state.run, characterId),
        replacedSkillId: previous && previous !== skillId ? previous : null,
        replacedTargetLevel: previousLevel,
      });
      const automatic = fulfillSkillReservations(state.run);
      state.run = automatic.run;
      applyAutomaticSkillActions(automatic.actions);
      for (const completed of automatic.completed) {
        record("skill_reservation_completed", completed);
      }
    }
    saveState();
    render();
    return;
  }
  if (action === "cancel-skill-reservation") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const result = cancelRunSkillReservation(state.run, characterId, skillId);
    if (!result.ok) {
      state.error = result.reason;
    } else {
      state.run = result.run;
      fx("skill:" + skillId, "off");
      record("skill_reservation_cancelled", { characterId, skillId });
    }
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
      fx("skill:" + skillId, "level");
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

  // issue #177 — テーマの絞り込み。**同じ印をもう一度押すと全部へ戻る。**
  if (action === "select-skill-branch") {
    const branch = element.dataset.branch || "";
    state.skillTreeBranch = state.skillTreeBranch === branch ? null : branch;
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
        if (state.formationSelection === id) state.formationSelection = null;
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

  // issue #235 — 盤面を隊列の組み替えへ入れる／戻す。**画面は一枚も増えない。**
  if (action === "toggle-formation-mode") {
    state.formationMode = !state.formationMode;
    if (!state.formationMode) state.formationSelection = null;
    fx("board", "mode");
    render();
    return;
  }

  if (action === "place-character") {
    const position = element.dataset.position;
    const id = selectedFormationCharacter();
    // R11 §5 改 — 教えている一手の前後を見る（下で、済んだら盤面を自分で畳む）。
    const tutorialStepBefore = formationTutorialStep();
    if (!POSITIONS.includes(position)) return;
    const other = positionOwner(position);
    if (!id) {
      if (other) {
        state.selectedCharacter = other;
        state.formationSelection = other;
        state.selectedSkillNode = null;
        fx("cell:" + position, "select");
        saveState();
        render();
      }
      return;
    }
    if (other === id) {
      state.formationSelection = null;
      fx("cell:" + position, "select");
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
    // 動いた枠は二つある。**空いた側も鳴らす**（片方だけだと「どこから来たか」が消える）。
    fx("cell:" + position, "swap");
    fx("cell:" + oldPosition, "swap");
    record("formation_changed", { characterId: id, position, swappedWith: other });
    // 教えていた一手が済んだ。**錠を外し、盤面も自分で通常へ戻す**（教え終わった型を
    // プレイヤーに畳ませない）。ここから先は技能も装備も予測も自由に触れる。
    if (tutorialStepBefore === "place" && formationTutorialStep() === "done") {
      state.formationMode = false;
      record("formation_tutorial_completed", { characterId: id, position });
    }
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
      // issue #236 — 取得と装着を分けない。**点を払った技能はその場で回り始める。**
      // 「取得済みだが未装着」は、オフと同じことを二通りに表しているだけだった。
      const equipped = equipSkill(state.run.loadout, characterId, skillId, node.kind, limitsFor);
      if (equipped.ok) state.run.loadout = equipped.loadout;
      fx("skill:" + skillId, "gain");
      record("skill_unlocked", { characterId, skillId, cost: node.cost });
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
      fx("skill:" + skillId, result.enabled ? "on" : "off");
      record("skill_toggled", { characterId, skillId, kind, enabled: result.enabled });
    }
    saveState();
    render();
    return;
  }

  // issue #238 / 作者指摘 2026-09-12 — 必殺技は**装着行の長押し一回**で決める。
  // 指定と構えを同時に動かすので、「長押ししたのにまだ構えていない」が起きない。
  // 払うものは無い（印を払うのは、戦って本当に放ったときだけ）。
  if (action === "toggle-ultimate") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const result = toggleUltimateForBattle(state.run.loadout, characterId, skillId, limitsFor, {
      uses: ultimateUsesLeft(state.run, characterId),
    });
    const lessonStepBefore = ultimateLessonStep();
    if (!result.ok) state.error = result.reason;
    else {
      state.run.loadout = result.loadout;
      fx("skill:" + result.skillId, "ultimate");
      // 構えた印は盤面のセルにも出る（`ultimateCellMark`）ので、そちらも一緒に鳴らす。
      fx(cellFxKey(characterId), "ultimate");
      record("ultimate_toggled", { characterId, skillId: result.skillId, armed: result.armed });
      // issue #240 — 教える一手が打てた瞬間だけを記録する。
      // **画面は跳ばさない**（作者指摘 2026-09-13）。構えた行を見せたまま、次の一手
      // 「遠征タブを押す」へ進む。ここで `state.tab` を技能へ揃えるのは、run の既定が
      // 遠征タブで、揃えないと三手目が最初から済んだことになってしまうためである。
      if (lessonStepBefore === "arm") {
        state.tab = "skills";
        record("ultimate_lesson_armed", { characterId, skillId: result.skillId });
      }
    }
    saveState();
    render();
    return;
  }

  if (action === "move-skill" || action === "move-tactic") {
    const kind = element.dataset.kind || "active";
    // 動かす前に、どの技能が動くのかを控える（動かしたあとでは番号が指す先が変わる）。
    const movedSkillId = (state.run.loadout[SLOT_KEYS[kind]]?.[element.dataset.character]
      || [])[Number(element.dataset.index)];
    if (movedSkillId) {
      fx("skill:" + movedSkillId, Number(element.dataset.direction) < 0 ? "move-up" : "move-down");
    }
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
    fx("gear:" + state.selectedEquipment, "select");
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
        fx("slot:" + characterId + ":" + slot, "equip");
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
    // 外す前に枠の番号を控える。外したあとの配列にはもう居ない。
    const slot = (state.run.loadout.equipment?.[characterId] || []).indexOf(equipmentId);
    if (slot >= 0) fx("slot:" + characterId + ":" + slot, "unequip");
    state.run.loadout = removeEquipment(state.run.loadout, characterId, equipmentId, limitsFor);
    record("equipment_removed", { characterId, equipmentId });
    saveState();
    render();
    return;
  }

  if (action === "begin-stage" || action === "preview-battle") {
    const previewOnly = action === "preview-battle";
    if (supplyTutorialVisible()) {
      state.tab = "supplies";
      state.error = "まず補給チュートリアルの指定操作を完了してください。";
      saveState();
      render();
      return;
    }
    // 作者要望 2026-09-14 — 技能チュートリアルは**次の一戦へ出る拍で終わる。**
    // 予約した瞬間に閉じると、「予約は一人に一つ・取り消せる」を言う段が消える
    // （錠はもう外れているので、この段のあいだも技能は自由に触れる）。
    if (!previewOnly && skillLessonStep() === "done") {
      const flags = new Set(Array.isArray(state.profile.storyFlags) ? state.profile.storyFlags : []);
      flags.add(SKILL_LESSON_FLAG);
      state.profile = { ...state.profile, storyFlags: [...flags] };
      record("skill_lesson_completed", {
        characterId: SKILL_LESSON_GOAL?.characterId ?? null,
        unlockSkillId: SKILL_LESSON_GOAL?.unlockSkillId ?? null,
        reserveSkillId: SKILL_LESSON_GOAL?.reserveSkillId ?? null,
      });
    }
    // R9 §2.1 — 出発に必要な人数は Stage で変わる（Stage 0 は2人）。
    if (state.run.roster.length !== runPartySize()) {
      state.error = "出発には" + runPartySize() + "人の編成が必要です。";
      state.tab = "map";
      saveState();
      render();
      return;
    }
    state.run.formation = normalizeFormation(state.run.formation, state.run.roster);
    // R8 §1.5 / §10 — Campaign StageはHPを持ち越すので満タンへ戻さない。
    // 装備耐久はどちらのmodeも毎戦リセット（持ち越しはまだ未実装）。
    if (!previewOnly) {
      if (isCampaignRun()) resetEquipmentDurability();
      else resetBattleResources();
    }
    state.battleError = null;
    if (!previewOnly) {
      record("loadout_confirmed", {
        stage: state.run.encounterIndex,
        roster: [...state.run.roster],
        formation: clone(state.run.formation),
        loadout: clone(state.run.loadout),
      });
    }
    // issue #138 — チュートリアル（灰の門）も含め、常に戦闘前確認を挟まず
    // そのまま自動戦闘へ進む。act boss の前で一度だけ会話を挟む戦闘は、
    // 会話のあとに続けて自動戦闘へ入る（会話自体は物語上必要なので残す）。
    const actBeat = previewOnly || state.prologueActive
      ? null
      : actStoryBeatForEncounter(state.run.campaignStageSequence, state.run.encounterIndex);
    if (actBeat) {
      enterStory([actBeat], "battle");
      return;
    }
    simulateAndEnterBattle({ previewOnly });
    return;
  }

  if (action === "return-from-simulation") {
    state.simulationMode = false;
    state.lastResult = null;
    state.replayEvents = [];
    state.replaySnapshots = [];
    state.replayIndex = 0;
    state.replayPlaying = false;
    state.battleError = null;
    state.phase = "camp";
    saveState();
    render();
    return;
  }

  if (action === "replay-toggle") {
    if (!state.replayEvents.length) return;
    if (atReplayEnding()) {
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
    // 一手送りも決着の拍で止まる（そこから先は［次へ］が預かる）。
    if (!atReplayEnding()) state.replayIndex = clampReplayIndex() + 1;
    saveState();
    syncBattleView();
    return;
  }

  if (action === "replay-back") {
    state.replayPlaying = false;
    // 飛ばした直後に戻すときも、いま見えている拍の一つ前へ戻る（控えの index が
    // 画面より先に進んでいても、見えているものから数える）。
    if (clampReplayIndex() > 0) state.replayIndex = clampReplayIndex() - 1;
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

  // 作者試遊 2026-09-13 — ［一気に決着へ］。**次の場面へは出ない。**VICTORY /
  // DEFEAT の拍まで再生位置を進めて、そこで止める。盤面・HP・履歴は拍から引き直す
  // ので、飛ばしても「最後の盤面」は一手ずつ見たときと同じものになる。
  if (action === "replay-verdict") {
    if (!state.replayEvents.length) return;
    state.replayPlaying = false;
    state.replayIndex = endingBeatIndex();
    saveState();
    syncBattleView();
    return;
  }

  // ［次へ］。**戦闘画面から次の場面へ出る唯一の道**である（結果画面・キャンプ・
  // 精算・序盤の会話のどれへ行くかは `goToBattleResult` が決める）。
  //
  // R12 — **再生を飛ばしても、序盤の会話を飛び越えない。**以前はこの分岐が
  // scheduleReplayBeat（再生が最後まで流れきった場合）にしか無かったので、釦で
  // 再生を打ち切ると prologueClear が起きず、既読印が押されないまま prologueActive が
  // 真のまま残った。**門の一戦から出られなくなる**（結果画面は「編成を見直す」しか
  // 出さないので、何度勝っても同じ盤面へ戻る）。goToBattleResult に寄せてある。
  if (action === "replay-result") {
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
        fx("rewards", "reroll");
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
    if (element.dataset.fx) fx(element.dataset.fx, "mode");
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
      // 旧い保存に残っている補給の候補だけがここへ来る（PR #255 以降、
      // 補給は報酬の候補に出ない）。
      state.run = gainSupply(state.run, offer.amount);
      record("reward_taken", { encounter: state.run.encounterIndex, reward: "supplies", amount: offer.amount });
    }
    // PR #255 — **最終戦の報酬は、次の戦闘ではなく精算へつながる。**
    // 12戦目もボス戦なので候補は出るが、遠征はここで終わるので encounterIndex は
    // 進めない。受け取った印を置いて、同じ画面の「遠征を精算する」へ渡す。
    if (state.run.encounterIndex >= ENCOUNTERS_PER_RUN) {
      state.rewardTakenAtEncounter = state.run.encounterIndex;
      state.rewardOffer = [];
      saveState();
      render();
      return;
    }
    advanceAfterBattle();
    return;
  }

  // PR #255 — 候補の無い勝利から次へ進む。通常は結果画面を通らないので、
  // この釦は中断復帰と古い保存のための保険である（進み方は報酬と同じ経路）。
  if (action === "advance-encounter") {
    if (state.lastResult?.result !== "win") return;
    advanceAfterBattle();
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
      state.tab = "map";
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
    // 誰が癒えたのかは、盤面のその枠が言う。**全体治療なら三つ同時に鳴る。**
    for (const id of treated) fx(cellFxKey(id), "heal");
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
    // issue #151 — 残せる件数より多く見つけているときだけ、**何を残すかを選ばせる。**
    // 選ぶ余地が無いときに画面を一枚増やさない——候補が上限以下のときと、
    // そもそも一つも残せないとき（撤退・敗北は0件）の両方である。
    const keepLimit = blueprintSaveLimitFor(outcome);
    if (keepLimit > 0 && blueprintSaveCandidates(state.run).length > keepLimit) {
      state.pendingSettlement = { outcome };
      state.blueprintKeep = blueprintSaveCandidates(state.run)
        .slice(0, keepLimit)
        .map((item) => item.descriptor);
      state.phase = "blueprintPick";
      saveState();
      render();
      return;
    }
    performSettlement(outcome, null);
    return;
  }

  // issue #151 — 候補の選択を入れ替える。**上限を超える選択はそこで止める**
  // （選んだつもりの品が黙って落ちるのを避ける）。
  if (action === "toggle-blueprint-keep") {
    const descriptor = element.dataset.descriptor;
    const outcome = state.pendingSettlement?.outcome;
    if (!descriptor || !outcome) return;
    const limit = blueprintSaveLimitFor(outcome);
    const chosen = Array.isArray(state.blueprintKeep) ? [...state.blueprintKeep] : [];
    const at = chosen.indexOf(descriptor);
    if (at >= 0) chosen.splice(at, 1);
    else if (chosen.length >= limit) {
      state.error = "残せるのは " + limit + " 件までです。外してから選んでください。";
    } else chosen.push(descriptor);
    state.blueprintKeep = chosen;
    saveState();
    render();
    return;
  }

  if (action === "confirm-blueprint-keep") {
    const outcome = state.pendingSettlement?.outcome;
    if (!outcome) return;
    performSettlement(outcome, Array.isArray(state.blueprintKeep) ? state.blueprintKeep : []);
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

bindBrowserGestureGuards();
boot();
