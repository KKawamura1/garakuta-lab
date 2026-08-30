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
  encounterInfo,
  enemyInfo,
  enemyTargetingText,
  equipEquipment,
  equipSkill,
  freshLoadout,
  initialUnlockedSkills,
  makeBattle,
  removeEquipment,
  removeSkill,
  reorderTactic,
  rewardOffer,
  PARTY_SIZE,
  SLOT_LIMITS,
  ensurePartySize,
  normalizeFormation,
} from "./playable-battles.mjs";
import { POSITIONS } from "./schema.mjs";
import { buildBeats, beatDurationMs, eventSourceId } from "./replay-beats.mjs";
import { deviceIdForRun, sendPayload, uuid } from "../agent-view/sync.js";
import { BUILD, FINGERPRINT } from "../core/build.mjs";

const VERSION = "EXP-18 Phase A 0.4";
const SAVE_KEY = "exp18-full-prototype-v02";
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

const STARTING_SKILL_POINTS = 2;

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
  payload.stats.eventsRecorded = recorded;
  payload.stats.eventsSent = payload.events.length;
  return payload;
}

function initialSkillPoints() {
  return Object.fromEntries(CHARACTER_OPTIONS.map((option) => [option.id, STARTING_SKILL_POINTS]));
}

function normalizeSkillPoints(value) {
  const defaults = initialSkillPoints();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  for (const option of CHARACTER_OPTIONS) {
    const points = Number(value[option.id]);
    if (Number.isFinite(points)) defaults[option.id] = Math.max(0, Math.floor(points));
  }
  return defaults;
}

function defaultMeta() {
  const unlocked = {};
  for (const option of CHARACTER_OPTIONS) unlocked[option.id] = initialUnlockedSkills(option.id);
  const ownedEquipment = [
    "standing_plate",
    "worn_greaves",
    "splinter_edge",
    "field_kit",
    "momentum_rig",
    "bastion_shell",
  ];
  const equipmentDurability = {};
  for (const id of ownedEquipment) equipmentDurability[id] = EQUIPMENT[id]?.maxDurability ?? 1;
  return {
    skillPoints: initialSkillPoints(),
    unlocked,
    ownedEquipment,
    equipmentDurability,
    expeditions: 0,
  };
}

function defaultFormation(roster) {
  const formation = {};
  roster.forEach((id, index) => {
    formation[id] = CHARACTER_OPTIONS.find((option) => option.id === id)?.defaultPosition
      ?? POSITIONS[index];
  });
  return normalizeFormation(formation, roster);
}

function partyLabel() {
  return state.roster.length + " / " + PARTY_SIZE + "人";
}


function newRunState(meta) {
  const roster = ensurePartySize(["warden", "mender", "lancer", "scout"]);
  return {
    phase: "camp",
    tab: "roster",
    stage: 1,
    runSeed: RUN_SEED + "-" + uuid().slice(0, 8),
    runId: uuid(),
    startedAt: new Date().toISOString(),
    roster,
    formation: defaultFormation(roster),
    loadout: freshLoadout(roster),
    hp: {},
    rewardOffer: [],
    selectedCharacter: roster[0],
    formationSelection: roster[0],
    selectedSkillNode: null,
    selectedEquipment: null,
    lastResult: null,
    replayEvents: [],
    replaySnapshots: [],
    replayIndex: 0,
    replayPlaying: false,
    replaySpeed: "normal",
    replayLogOpen: false,
    skillTreeScroll: {},
    results: [],
    runEvents: [],
    battleError: null,
    feedback: null,
    error: null,
    meta: structuredClone(meta),
  };
}

function initialState() {
  const state = newRunState(defaultMeta());
  state.phase = "intro";
  state.startedAt = null;
  return state;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!saved || typeof saved !== "object") return initialState();
    const fresh = initialState();
    const next = { ...fresh, ...saved };
    const meta = { ...defaultMeta(), ...(saved.meta || {}) };
    meta.unlocked = { ...defaultMeta().unlocked, ...(saved.meta?.unlocked || {}) };
    meta.skillPoints = normalizeSkillPoints(saved.meta?.skillPoints);
    meta.ownedEquipment = Array.isArray(saved.meta?.ownedEquipment)
      ? saved.meta.ownedEquipment.filter((id) => EQUIPMENT[id])
      : meta.ownedEquipment;
    meta.equipmentDurability = { ...defaultMeta().equipmentDurability, ...(saved.meta?.equipmentDurability || {}) };
    for (const id of meta.ownedEquipment) {
      meta.equipmentDurability[id] = EQUIPMENT[id]?.maxDurability ?? 1;
    }
    next.meta = meta;
    // R6 §5.4 — 4人の旧 save は5人へ育てる。**SAVE_KEY は上げない**
    // （上げると作者の進行が消える）。足りない一人は並び順の先頭から決定的に選び、
    // 位置は normalizeFormation が前3後2／前2後3へ落とす。
    next.roster = ensurePartySize(
      Array.isArray(next.roster) ? next.roster.filter((id) => characterInfo(id)) : fresh.roster,
    );
    next.formation = normalizeFormation(next.formation, next.roster);
    next.loadout = next.loadout || freshLoadout(next.roster);
    const hasFormationSelection = Object.prototype.hasOwnProperty.call(saved, "formationSelection");
    const savedFormationSelection = hasFormationSelection ? saved.formationSelection : next.selectedCharacter;
    next.formationSelection = hasFormationSelection
      ? (next.roster.includes(savedFormationSelection) ? savedFormationSelection : null)
      : (next.roster.includes(savedFormationSelection) ? savedFormationSelection : (next.roster[0] ?? null));
    next.hp = Object.fromEntries(CHARACTER_OPTIONS.map((option) => [option.id, maxHp(option.id)]));
    next.results = Array.isArray(next.results) ? next.results : [];
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
    return next;
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
  const persisted = { ...state };
  if (state.lastResult && typeof state.lastResult === "object") {
    // Copy only the object that we trim; the live state remains untouched.
    persisted.lastResult = { ...state.lastResult };
    // state.replaySnapshots is the copy used by the replay screen.
    delete persisted.lastResult.replaySnapshots;
  }
  return persisted;
}

function isRecoverableStorageError(error) {
  return [
    "QuotaExceededError",
    "NS_ERROR_DOM_QUOTA_REACHED",
    "SecurityError",
  ].includes(error?.name);
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(persistableState()));
    return true;
  } catch (error) {
    if (!isRecoverableStorageError(error)) throw error;
    try {
      // The current tab remains fully playable even if the device can only
      // retain a smaller checkpoint. Keep the latest replay if possible;
      // otherwise keep enough run history to resume from the current area.
      const minimal = persistableState();
      if (minimal.lastResult && typeof minimal.lastResult === "object") {
        delete minimal.lastResult.events;
      }
      minimal.runEvents = Array.isArray(minimal.runEvents)
        ? minimal.runEvents.slice(-400)
        : [];
      localStorage.setItem(SAVE_KEY, JSON.stringify(minimal));
    } catch (retryError) {
      if (!isRecoverableStorageError(retryError)) throw retryError;
      // Persistence is best-effort. Do not block the in-memory battle UI.
    }
    return false;
  }
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
  const headerAction = options.back
    ? button("キャンプへ", "back-camp", false, "menu-button")
    : button("新しい遠征", "new-expedition", false, "menu-button");
  return "<div class=\"shell\"><header class=\"header\"><div><p class=\"kicker\">" + VERSION
    + "</p><h1>" + esc(title) + "</h1><p class=\"subtitle\">" + esc(subtitle)
    + "</p></div>" + headerAction + "</header>" + body + error
    + "<footer>遠征 " + esc(state.runId.slice(0, 8)) + " · seed " + esc(state.runSeed)
    + " · ルール " + esc(PLAYABLE_CONTENT.contentVersion)
    + "<br>build " + esc(BUILD) + "</footer></div>";
}

function record(type, details = {}) {
  state.runEvents = [...state.runEvents, {
    seq: state.runEvents.length,
    at: new Date().toISOString(),
    type,
    ...details,
  }];
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

function maxHp(characterId) {
  return PLAYABLE_CONTENT.characters[characterId]?.maxHp ?? 1;
}

function currentHp(characterId) {
  return Math.max(0, Math.min(maxHp(characterId), state.hp[characterId] ?? maxHp(characterId)));
}

function equipmentOwner(equipmentId) {
  return state.roster.find((characterId) => (state.loadout.equipment?.[characterId] || []).includes(equipmentId)) ?? null;
}

function equipmentDurability(equipmentId) {
  return Math.max(0, state.meta.equipmentDurability[equipmentId] ?? EQUIPMENT[equipmentId]?.maxDurability ?? 1);
}

function skillPointsFor(characterId) {
  return Math.max(0, Math.floor(Number(state.meta.skillPoints?.[characterId] ?? STARTING_SKILL_POINTS)));
}

function resetBattleResources() {
  for (const option of CHARACTER_OPTIONS) state.hp[option.id] = maxHp(option.id);
  for (const id of state.meta.ownedEquipment) {
    state.meta.equipmentDurability[id] = EQUIPMENT[id]?.maxDurability ?? 1;
  }
}

function isUnlocked(characterId, skillId) {
  return (state.meta.unlocked?.[characterId] || []).includes(skillId);
}

function installedSkill(characterId, skillId, kind) {
  const key = kind === "active" ? "tactics" : "reactives";
  return (state.loadout[key]?.[characterId] || []).includes(skillId);
}

function selectedCharacter() {
  if (state.roster.includes(state.selectedCharacter)) return state.selectedCharacter;
  return state.roster[0];
}

function selectedFormationCharacter() {
  return state.roster.includes(state.formationSelection) ? state.formationSelection : null;
}

function positionOwner(position) {
  return state.roster.find((characterId) => state.formation[characterId] === position) ?? null;
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
    ["equipment", "装備", state.roster.reduce((total, id) => total + (state.loadout.equipment?.[id] || []).length, 0) + "/" + (state.roster.length * 2)],
    ["map", "戦闘", state.stage + "/7"],
  ];
  return "<nav class=\"tabs\" aria-label=\"キャンプ画面\">" + tabs.map(([id, label, meta]) =>
    "<button type=\"button\" class=\"tab " + (state.tab === id ? "active" : "")
      + "\" aria-label=\"" + label + "\" aria-current=\"" + (state.tab === id ? "step" : "false")
      + "\" data-action=\"tab\" data-tab=\"" + id + "\"><b>" + label + "</b><small>" + meta + "</small></button>").join("")
    + "</nav>";
}

function render() {
  stopReplayTimer();
  const views = {
    intro: renderIntro,
    camp: renderCamp,
    battlePreview: renderBattlePreview,
    battle: renderBattle,
    battleError: renderBattleError,
    result: renderResult,
    reward: renderReward,
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
  return shell("灰の遠征", "仲間の役割、技能、装備、隊列を組み替えて7区画を越える", "<section class=\"hero card\">"
    + "<div class=\"sigil\">◈</div><p class=\"lead\">5人を選び、2×3の6枠へ配置し、<br>各人の行動・反応・装備を組みます。</p>"
    + "<p class=\"intro-copy\">戦闘は自動で進みます。プレイヤーが作るのは、敵の狙いに対して誰を前へ出し、どの技能を優先し、どの装備を消耗させるかという準備です。</p>"
    + button("遠征を始める", "start", false, "button primary")
    + "<div class=\"loop\"><span><b>1</b>5人を編成</span><span><b>2</b>技能を解禁・装着</span><span><b>3</b>装備を2枠へ組む</span><span><b>4</b>自動戦闘で検証</span></div></section>"
    + "<section class=\"three-up\"><div class=\"card\"><b>8人から5人</b><span>2×3の6枠に一枠空く</span></div><div class=\"card\"><b>24技能</b><span>行動12・反応12</span></div><div class=\"card\"><b>18装備</b><span>耐久を持つ実物</span></div></section>");
}

function renderCamp() {
  const view = {
    roster: renderRoster,
    skills: renderSkills,
    equipment: renderEquipment,
    map: renderMap,
  }[state.tab]();
  const title = state.tab === "map" ? "出発前のキャンプ" : "キャンプで組み替える";
  const subtitle = "第" + state.stage + "区画 · " + encounterInfo(state.stage).name + " · " + partyLabel();
  return shell(title, subtitle, campNav() + view);
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
  const characterCards = CHARACTER_OPTIONS.map((option) => {
    const inParty = state.roster.includes(option.id);
    const selected = formationSelection === option.id;
    const action = inParty ? "select-formation-character" : "toggle-roster";
    const actionLabel = inParty ? (selected ? "位置選択中" : "位置を選ぶ") : "編成に入れる";
    return "<article class=\"character-card " + (inParty ? "in-party " : "") + (selected ? "selected" : "")
      + "\"><button type=\"button\" class=\"character-main\" data-action=\"" + action
      + "\" data-character=\"" + option.id + "\"><span class=\"avatar\">"
      + esc(option.icon) + "</span><span class=\"character-copy\"><b>" + esc(characterName(option.id))
      + "</b><small>" + esc(option.role) + " · " + esc(option.summary) + "</small></span><span class=\"check\">"
      + (inParty ? "✓" : "＋") + "</span></button><div class=\"character-stats\"><span>HP "
      + maxHp(option.id) + "</span><span>速度 " + (PLAYABLE_CONTENT.characters[option.id]?.speed ?? "-")
      + "</span><span>" + esc(actionLabel) + "</span></div>"
      + (inParty ? button("外す", "toggle-roster", state.roster.length <= 1, "tiny-button", "data-character=\"" + option.id + "\"") : "")
      + "</article>";
  }).join("");
  return "<section class=\"card\">" + sectionHeading("FORMATION / 2×3", "誰がどこに立つ？", "<span class=\"stage\">"
    + partyLabel() + "</span>") + "<p class=\"muted\">仲間をタップして位置選択。同じ仲間をもう一度タップすると解除し、選択後に別の位置枠をタップすると二人を交換します。<b>5人で6枠なので、必ず一枠が空きます。</b>前3後2か前2後3のどちらかにしかできません。前3は単体攻撃を分散できますが、前列を薙ぐ攻撃が3人に当たります。前2は後列に3人置けますが、前列一人あたりの被弾が増えます。</p>"
    + "<div class=\"formation-board\">" + slots + "</div><p class=\"selection-note\">位置選択中: <b>"
    + esc(formationSelection ? characterName(formationSelection) : "なし") + "</b> · "
    + (formationSelection ? "同じ枠をタップで解除 / 別の枠をタップで交換" : "仲間または位置枠をタップして選択")
    + (formationSelection ? "<span class=\"formation-selection-actions\">" + button("選択解除", "clear-formation-selection", false, "tiny-button") + "</span>" : "") + "</p></section>"
    + "<section class=\"card\">" + sectionHeading("ROSTER / 8 → " + PARTY_SIZE, "同行する仲間を選ぶ")
    + "<p class=\"muted\">8人全員に固有の初期技能があります。好きな仲間を選び、技能ツリーで別の役割へ伸ばせます。</p>"
    + "<div class=\"character-grid\">" + characterCards + "</div></section>"
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
  const list = state.loadout[key]?.[characterId] || [];
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
    + list.length + " / " + SLOT_LIMITS[kind] + "</small></div>" + (rows || "<p class=\"empty-slot\">技能ツリーから装着してください。</p>") + "</div>";
}

function memberTabs(characterId) {
  return "<div class=\"member-tabs\" aria-label=\"仲間を選ぶ\">" + state.roster.map((id) => "<button type=\"button\" class=\"member-tab "
    + (id === characterId ? "active" : "") + "\" aria-pressed=\"" + (id === characterId ? "true" : "false")
    + "\" data-action=\"select-character\" data-character=\"" + id
    + "\"><span class=\"avatar small\">" + esc(characterInfo(id)?.icon ?? "・") + "</span>"
    + "<span>" + characterName(id) + "<small>" + positionText(state.formation[id]) + " · "
    + skillPointsFor(id) + "pt</small></span></button>").join("") + "</div>";
}

function memberContext(characterId, emphasis = "skills") {
  const option = characterInfo(characterId);
  const active = (state.loadout.tactics?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const reactive = (state.loadout.reactives?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const gear = (state.loadout.equipment?.[characterId] || []).map((id) => nameFor(id));
  const primary = emphasis === "skills"
    ? "装備 " + (gear.length ? gear.join(" · ") : "なし")
    : "行動 " + (active.length ? active.join(" → ") : "なし");
  const secondary = emphasis === "skills"
    ? "位置 " + positionText(state.formation[characterId]) + " · HP " + currentHp(characterId) + "/" + maxHp(characterId)
    : "反応 " + (reactive.length ? reactive.join(" · ") : "なし");
  return "<section class=\"member-context\"><div class=\"member-context-head\"><span class=\"avatar\">"
    + esc(option?.icon ?? "・") + "</span><div><p class=\"eyebrow\">選択中の仲間</p><h3>" + esc(characterName(characterId))
    + "</h3><small>" + esc(option?.role ?? "") + " · " + esc(option?.summary ?? "") + "</small></div></div>"
    + "<div class=\"member-context-loadout\"><span><b>" + esc(primary) + "</b></span><span><b>" + esc(secondary) + "</b></span></div></section>";
}

function skillBuildSummary(characterId) {
  const active = (state.loadout.tactics?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const reactive = (state.loadout.reactives?.[characterId] || []).map((id) => COMPONENTS[id]?.label ?? nameFor(id));
  const selectedNode = SKILL_TREE_NODES.find((node) => node.skillId === state.selectedSkillNode);
  const selectedInfo = selectedNode ? COMPONENTS[selectedNode.skillId] : null;
  const slotKey = selectedNode?.kind === "active" ? "tactics" : "reactives";
  const slotLabel = selectedNode?.kind === "active" ? "行動枠" : "リアクティブ枠";
  const slotCount = selectedNode ? (state.loadout[slotKey]?.[characterId] || []).length : 0;
  const target = selectedNode
    ? "選択中: " + (selectedInfo?.label ?? nameFor(selectedNode.skillId)) + " · 装着先: " + characterName(characterId)
      + " · " + slotLabel + "（" + slotCount + " / 2）"
    : "技能を選択すると、ここに装着先を表示";
  return "<aside class=\"skill-build-summary\" aria-live=\"polite\"><div class=\"skill-build-summary-head\"><span class=\"avatar small\">"
    + esc(characterInfo(characterId)?.icon ?? "・") + "</span><span><b>" + esc(characterName(characterId))
    + "のビルド</b><small>" + esc(positionText(state.formation[characterId])) + " · "
    + esc(characterInfo(characterId)?.role ?? "") + "</small></span></div><div class=\"skill-summary-slots\"><span><b>行動</b> "
    + esc(active.length ? active.join(" · ") : "なし") + "</span><span><b>反応</b> "
    + esc(reactive.length ? reactive.join(" · ") : "なし") + "</span></div><div class=\"skill-summary-target\">"
    + esc(target) + "</div></aside>";
}
function skillNodeIcon(node) {
  return (node.kind === "reactive" ? "↳" : branchIcons[node.branch] ?? "·");
}

function renderSkillNode(node, characterId) {
  const info = COMPONENTS[node.skillId];
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
  const stateClass = unlocked ? "unlocked" : canUnlock ? "available" : "locked";
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
  const pointsBadge = "<span class=\"skill-points-badge\"><small>" + esc(characterName(characterId)) + "の残り技能点</small><b>" + skillPointsFor(characterId) + "</b></span>";
  // 「基礎」は最後。**詰み防止の棚であって、最初に見せる棚ではない。**
  const branches = ["攻撃", "指揮", "支援", "守り", "基礎"].map((branch) => renderSkillBranch(branch, characterId)).join("");
  return "<section class=\"card skill-build-card\">" + sectionHeading("SKILL TREE / " + SKILL_TREE_NODES.length + " NODES", "誰を伸ばす？", pointsBadge)
    + "<p class=\"muted\">仲間を切り替えながら、現在の行動・リアクティブ・装備を確認できます。技能ノードをタップすると説明と装着操作が開きます。</p>"
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
  const equipmentId = (state.loadout.equipment?.[characterId] || [])[slot] || null;
  const selected = state.selectedEquipment;
  const canInstall = Boolean(selected && selected !== equipmentId);
  const label = equipmentId ? nameFor(equipmentId) : "空き枠";
  const detail = equipmentId
    ? "戦闘耐久 " + equipmentDurability(equipmentId) + " / " + (EQUIPMENT[equipmentId]?.maxDurability ?? 1)
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
  const inventory = state.meta.ownedEquipment.map((id) => {
    const owner = equipmentOwner(id);
    const isSelected = selected === id;
    const max = EQUIPMENT[id]?.maxDurability ?? 1;
    const durability = equipmentDurability(id);
    return "<article class=\"gear-card " + (isSelected ? "selected" : "") + (durability === 0 ? " depleted" : "")
      + "\"><button type=\"button\" class=\"gear-main\" data-action=\"select-equipment\" data-equipment=\"" + id
      + "\"><span class=\"gear-icon\">◆</span><span class=\"gear-copy\"><b>" + esc(EQUIPMENT[id]?.label ?? id)
      + "</b><small>" + esc(EQUIPMENT[id]?.effect ?? "") + "</small></span><span class=\"gear-state\">"
      + (owner ? characterName(owner) : "手元") + "<br>戦闘耐久 " + durability + "/" + max + "</span></button>"
      + "</article>";
  }).join("");
  const codex = Object.keys(EQUIPMENT).filter((id) => !state.meta.ownedEquipment.includes(id)).map((id) =>
    "<span class=\"codex-chip locked\"><b>" + esc(EQUIPMENT[id].label) + "</b><small>未入手 · "
      + esc(EQUIPMENT[id].grammar) + "</small></span>").join("");
  const memberIds = [characterId, ...state.roster.filter((id) => id !== characterId)];
  const members = memberIds.map((id) => "<article class=\"gear-member " + (id === characterId ? "selected" : "") + "\"><button type=\"button\" class=\"member-head member-head-button\" data-action=\"select-character\" data-character=\"" + id + "\"><span class=\"avatar\">"
    + esc(characterInfo(id)?.icon ?? "・") + "</span><span><b>" + esc(characterName(id)) + "</b><small>"
    + esc(positionText(state.formation[id])) + " · 2装備枠</small></span><span class=\"member-focus\">" + (id === characterId ? "選択中" : "選ぶ") + "</span></button><div class=\"equipment-slots\">"
    + equipmentSlotHtml(id, 0) + equipmentSlotHtml(id, 1) + "</div></article>").join("");
  return "<section class=\"card equipment-build-card\">" + sectionHeading("EQUIPMENT / 2 SLOTS EACH", "実物を組み替える", "<span class=\"stage\">"
    + state.meta.ownedEquipment.length + " / " + Object.keys(EQUIPMENT).length + "</span>") + "<p class=\"muted\">装備は共有インベントリの実物です。選択してから仲間の枠をタップすると移動します。戦闘中に耐久が減り、0になるとその装備の効果が止まります。破損はせず、戦闘終了後に最大へ戻ります。</p>"
    + memberTabs(characterId) + memberContext(characterId, "equipment")
    + "<p class=\"selection-note\">選択中: <b>" + esc(selected ? EQUIPMENT[selected]?.label ?? selected : "なし")
    + "</b> · " + (selected ? "下の枠をタップして装着" : "上の装備をタップ") + "</p>"
    + "<div class=\"gear-grid\">" + inventory + "</div></section>"
    + "<section class=\"card\">" + sectionHeading("LOADOUT / 4 MEMBERS", "誰に何を持たせる？")
    + "<div class=\"gear-member-grid\">" + members + "</div></section>"
    + "<section class=\"card quiet\">" + sectionHeading("CODEX / 18 EQUIPMENT", "まだ見ぬ装備")
    + "<div class=\"codex-list\">" + (codex || "<p class=\"muted\">すべて入手済みです。</p>") + "</div>"
    + "<div class=\"flow-actions\">" + button("スキルへ戻る", "tab", false, "button", "data-tab=\"skills\"")
    + button("戦闘前確認へ", "tab", false, "button primary", "data-tab=\"map\"") + "</div></section>";
}

function renderEnemy(enemy) {
  const info = enemyInfo(enemy.enemyActorId);
  return "<article class=\"enemy-card\"><div class=\"enemy-top\"><span class=\"enemy-mark\">◆</span><div><b>"
    + esc(info.label) + "</b><small>" + esc(positionText(enemy.position)) + " · HP " + enemy.hp + "</small></div></div>"
    + "<p>" + esc(info.targeting) + "</p></article>";
}

function renderMap() {
  const encounter = encounterInfo(state.stage);
  const progress = Array.from({ length: 7 }, (_, index) => {
    const stage = index + 1;
    return "<span class=\"map-node " + (stage < state.stage ? "done" : stage === state.stage ? "current" : "")
      + "\">" + stage + "</span>";
  }).join("");
  const party = state.roster.map((id) => "<div class=\"map-party-row\"><span class=\"avatar small\">"
    + esc(characterInfo(id)?.icon ?? "・") + "</span><b>" + esc(characterName(id)) + "</b><span>"
    + positionText(state.formation[id]) + " · HP " + currentHp(id) + "/" + maxHp(id) + "</span></div>").join("");
  return "<section class=\"card\">" + sectionHeading("EXPEDITION / 7 AREAS", "次の敵を見る", "<span class=\"stage\">"
    + state.stage + " / 7</span>") + "<div class=\"map-progress\">" + progress + "</div><h3>"
    + esc(encounter.name) + "</h3><p class=\"lead-small\">" + esc(encounter.description) + "</p>"
    + "<div class=\"enemy-grid\">" + encounter.enemies.map(renderEnemy).join("") + "</div>"
    + "<div class=\"map-party\"><h3>現在の隊列</h3>" + party + "</div>"
    + button("この敵に挑む", "begin-stage", false, "button primary") + "</section>"
    + "<section class=\"card\">" + sectionHeading("TARGETING", "敵は誰を狙う？")
    + "<p class=\"muted\">敵ごとに狙いが違います。前列を守るだけでなく、後列優先・準備中優先の攻撃もあります。戦闘前に確認し、隊列とリアクティブを組み直してください。</p>"
    + encounter.enemies.map((enemy) => "<div class=\"targeting-line\"><b>" + esc(enemyInfo(enemy.enemyActorId).label)
      + "</b><span>" + esc(enemyTargetingText(enemy.enemyActorId)) + "</span></div>").join("") + "</section>"
    + "<section class=\"card quiet\"><p class=\"eyebrow\">CAMPAIGN RULE</p><p class=\"muted\">戦闘中のHPと装備耐久は、その戦闘の中だけ有効です。勝敗が決まるとHPと装備耐久は最大へ戻ります。報酬を1つ選び、次の区画へ進みます。</p></section>";
}

function renderBattlePreview() {
  const encounter = encounterInfo(state.stage);
  const allies = state.roster.map((id) => "<div class=\"battle-plan-row\"><span class=\"avatar small\">"
    + esc(characterInfo(id)?.icon ?? "・") + "</span><div><b>" + esc(characterName(id)) + "</b><small>"
    + esc(positionText(state.formation[id])) + " · HP " + currentHp(id) + "/" + maxHp(id) + "</small></div><span>"
    + esc((state.loadout.tactics?.[id] || []).map((skillId) => COMPONENTS[skillId]?.label ?? skillId).join(" → "))
    + "</span></div>").join("");
  return shell("第" + state.stage + "区画", encounter.name + " · 戦闘前の最終確認", "<section class=\"card\">"
    + sectionHeading("AUTO BATTLE / PLAN", "この構成で試す") + "<p class=\"muted\">戦闘中の操作はありません。行動の優先順、リアクティブの条件、敵の狙いをR5エンジンが決定的に解決します。</p>"
    + "<div class=\"plan-list\"><h3>味方の構成</h3>" + allies + "</div><div class=\"plan-list\"><h3>敵の狙い</h3>"
    + encounter.enemies.map((enemy) => "<div class=\"targeting-line\"><b>" + esc(enemyInfo(enemy.enemyActorId).label)
      + "</b><span>" + esc(enemyTargetingText(enemy.enemyActorId)) + "</span></div>").join("") + "</div>"
    + button("自動戦闘を再生する", "simulate", false, "button primary")
    + button("キャンプへ戻る", "back-camp", false, "button") + "</section>");
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
  return shell("戦闘", encounterInfo(state.stage).name + " · 自動戦闘を見る", "<section class=\"card battle-card\">"
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
  return shell("戦闘を停止しました", encounterInfo(state.stage).name + " · 構成を見直してください", "<section class=\"card verdict loss\">"
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
  return (result?.actors || []).filter((actor) => actor.side === "ally").map((actor) =>
    "<div class=\"result-actor\"><span class=\"avatar small\">" + esc(characterInfo(actor.definitionId)?.icon ?? "・")
      + "</span><div><b>" + esc(String(actor.displayName).split(" — ")[0]) + "</b><small>"
      + (actor.alive ? "戦闘内 HP " + actor.hp + "/" + actor.maxHp : "戦闘内 戦闘不能")
      + " → 次戦 HP " + actor.maxHp + "/" + actor.maxHp + " · 防壁 " + actor.barrier + "</small></div></div>").join("");
}

function renderResult() {
  const result = state.lastResult;
  if (!result) return renderCamp();
  const won = result.result === "win";
  const metrics = result.metrics || {};
  const events = compactEvents(result.events || state.replayEvents);
  const shown = events.length > 40 ? [...events.slice(0, 30), ...events.slice(-10)] : events;
  const next = won
    ? state.stage >= 7
      ? button("遠征を終えて記録する", "complete", false, "button primary")
      : button("報酬を見る", "show-reward", false, "button primary")
    : button("構成を見直す", "retry-build", false, "button primary");
  const equipment = (result.equipment || []).map((item) => "<div class=\"result-gear\"><b>"
    + esc(EQUIPMENT[item.equipmentId]?.label ?? item.equipmentId) + "</b><span>"
    + "戦闘内 " + item.durability + " / " + item.maxDurability + " → 次戦 "
    + item.maxDurability + " / " + item.maxDurability + "</span></div>").join("");
  return shell(won ? "突破した" : "足を止めた", encounterInfo(state.stage).name + " · " + result.roundsUsed + "ラウンド", "<section class=\"card verdict "
    + (won ? "win" : "loss") + "\"><div class=\"verdict-mark\">" + (won ? "✓" : "×")
    + "</div><h2>" + (won ? "この組み合わせは通った" : "この組み合わせでは届かなかった")
    + "</h2><p>" + (won ? "構成の因果を確認し、次の報酬でさらに変えられます。" : "敵の狙い、技能の優先順、装備の持たせ先を見直せます。")
    + "</p><div class=\"metrics\"><span><b>" + (metrics.allyHpLost ?? 0) + "</b><small>味方HP損失</small></span><span><b>"
    + (metrics.enemyHpLost ?? 0) + "</b><small>敵HP損失</small></span><span><b>" + (metrics.reactionsFired ?? 0)
    + "</b><small>反応発火</small></span><span><b>" + (metrics.equipmentWear ?? 0) + "</b><small>装備摩耗</small></span></div></section>"
    + "<section class=\"card\">" + sectionHeading("AFTER BATTLE", "次の区画へ持ち越す状態")
    + "<p class=\"muted\">戦闘中のHPと装備耐久は次の区画へ持ち越しません。次の戦闘は、全員HP最大・装備耐久最大から始まります。</p><div class=\"result-actors\">"
    + resultActors(result) + "</div><div class=\"result-gear-list\">" + (equipment || "<p class=\"muted\">装備なし</p>")
    + "</div></section>"
    // **因果はまずアニメーションで見せる。** 文字の一覧は、見返したいときの補助に降ろした。
    + (state.replayEvents?.length
      ? "<section class=\"card\">" + sectionHeading("CAUSE & EFFECT", "何が起きたかをもう一度見る")
        + "<p class=\"muted\">同じ戦闘を最初から、同じ順で再生します。決着までの因果は、箱の動きとダメージ値で追えます。</p>"
        + button("戦闘をもう一度見る", "replay-again", false, "button") + "</section>"
      : "")
    + "<details class=\"card debug-log\"><summary>デバッグログ（" + events.length + " イベント）</summary>"
    + "<p class=\"muted\">アニメーションで分かりにくかったところを、文字で確かめるためのものです。</p>"
    + "<ol class=\"events\">" + shown.map((event) => "<li class=\"event\"><span class=\"event-round\">R"
      + (event.round ?? "-") + "</span><span>" + esc(eventText(event)) + "</span>"
      + "<code class=\"event-type\">" + esc(event.type) + "</code></li>").join("") + "</ol>"
    + "<details><summary>全イベントを見る</summary><pre>" + esc((result.events || state.replayEvents || []).map(eventText).join("\n")) + "</pre></details></details>"
    + next);
}

function renderReward() {
  const offers = state.rewardOffer.map((id) => {
    const info = EQUIPMENT[id];
    return "<article class=\"reward-card\"><div class=\"reward-kind kind-equipment\">装備</div><h3>"
      + esc(info?.label ?? id) + "</h3><p>" + esc(info?.effect ?? "") + "</p><small>"
      + esc(info?.grammar ?? "") + " · 戦闘耐久 " + (info?.maxDurability ?? 1) + "</small>"
      + button("拾って次へ", "take-reward", false, "button", "data-equipment=\"" + id + "\"") + "</article>";
  }).join("");
  return shell("報酬を選ぶ", encounterInfo(state.stage).name + "を突破 · 次の区画へ", "<section class=\"card\">"
    + sectionHeading("REWARD / 4 → 1", "何を持ち帰る？") + "<p class=\"muted\">装備3候補から1つ選ぶか、参加・不参加を問わず8人全員へ技能点を配ります。</p>"
    + "<div class=\"reward-grid\">" + offers + "</div><div class=\"reward-special\">"
    + "<article class=\"reward-card special\"><div class=\"reward-kind kind-active\">成長</div><h3>全員の技能点 +2</h3><p>8人全員のスキルツリーを2点ずつ進められる。</p>"
    + button("全員に技能点を配る", "take-skill-reward", false, "button") + "</article></div></section>");
}

function renderComplete() {
  const feedback = state.feedback || {};
  const option = (value, label, selected) => "<option value=\"" + value + "\" " + (selected ? "selected" : "") + ">" + label + "</option>";
  const trail = state.roster.map(characterName).join("、");
  const gear = state.meta.ownedEquipment.map((id) => EQUIPMENT[id]?.label ?? id).join("、");
  return shell("遠征を終えた", "今回の編成と因果を記録する", "<section class=\"card verdict win\"><div class=\"verdict-mark\">✦</div><h2>7区画を見届けた</h2><p>今回の仲間: "
    + esc(trail) + "<br>手元の装備: " + esc(gear || "なし") + "</p><div class=\"build-trail\"><span><i>1</i>5人を選び、2×3へ組んだ</span><span><i>2</i>技能ツリーから実際の技能を装着した</span><span><i>3</i>装備2枠と敵の狙いを考えた</span><span><i>4</i>自動戦闘の因果を確認した</span></div></section>"
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
  state.stage += 1;
  state.rewardOffer = [];
  state.lastResult = null;
  state.replayEvents = [];
  state.replaySnapshots = [];
  state.replayIndex = 0;
  state.replayPlaying = false;
  state.phase = "camp";
  state.tab = "map";
  state.error = null;
  record("stage_advanced", { stage: state.stage });
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

  if (action === "reset") {
    state = initialState();
    saveState();
    render();
    return;
  }

  if (action === "start" || action === "new-expedition") {
    const meta = state.meta || defaultMeta();
    state = newRunState(meta);
    record("run_started", { seed: state.runSeed, version: VERSION, roster: [...state.roster] });
    saveState();
    render();
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
    if (!id || !state.roster.includes(id)) return;
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
    if (state.roster.includes(id)) {
      if (state.roster.length <= 1) {
        state.error = "最低1人は残してください。";
      } else {
        state.roster = state.roster.filter((entry) => entry !== id);
        const nextLoadout = freshLoadout(state.roster);
        for (const characterId of state.roster) {
          nextLoadout.tactics[characterId] = [...(state.loadout.tactics?.[characterId] || nextLoadout.tactics[characterId])];
          nextLoadout.reactives[characterId] = [...(state.loadout.reactives?.[characterId] || nextLoadout.reactives[characterId])];
          nextLoadout.equipment[characterId] = [...(state.loadout.equipment?.[characterId] || [])];
        }
        state.loadout = nextLoadout;
        state.formation = normalizeFormation(state.formation, state.roster);
        if (state.formationSelection === id) {
          state.formationSelection = state.roster[0] ?? null;
        }
        ensureSelectedCharacter();
        record("roster_changed", { roster: [...state.roster], removed: id });
      }
    } else if (state.roster.length >= PARTY_SIZE) {
      state.error = "編成は" + PARTY_SIZE + "人までです。";
    } else {
      state.roster = [...state.roster, id];
      const fresh = freshLoadout([id]);
      state.loadout.tactics[id] = fresh.tactics[id];
      state.loadout.reactives[id] = fresh.reactives[id];
      state.loadout.equipment[id] = [];
      state.formation = normalizeFormation(state.formation, state.roster);
      state.selectedCharacter = id;
      state.formationSelection = id;
      record("roster_changed", { roster: [...state.roster], added: id });
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
    const oldPosition = state.formation[id];
    if (other && other !== id) {
      state.formation[other] = oldPosition;
    }
    state.formation[id] = position;
    state.formation = normalizeFormation(state.formation, state.roster);
    state.formationSelection = null;
    record("formation_changed", { characterId: id, position, swappedWith: other });
    saveState();
    render();
    return;
  }

  if (action === "unlock-skill") {
    const characterId = element.dataset.character;
    const skillId = element.dataset.skill;
    const node = SKILL_TREE_NODES.find((entry) => entry.skillId === skillId);
    if (!node || isUnlocked(characterId, skillId)) return;
    if (!node.requires.every((required) => isUnlocked(characterId, required))) {
      state.error = "前提技能がまだ解禁されていません。";
    } else if (skillPointsFor(characterId) < node.cost) {
      state.error = "技能点が足りません。";
    } else {
      state.meta.skillPoints[characterId] = skillPointsFor(characterId) - node.cost;
      state.meta.unlocked[characterId] = [...new Set([...(state.meta.unlocked[characterId] || []), skillId])];
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
    const result = equipSkill(state.loadout, characterId, skillId, kind);
    if (!result.ok) state.error = result.reason;
    else {
      state.loadout = result.loadout;
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
    const result = removeSkill(state.loadout, characterId, skillId, kind);
    if (!result.ok) state.error = result.reason;
    else {
      state.loadout = result.loadout;
      record("skill_removed", { characterId, skillId, kind });
    }
    saveState();
    render();
    return;
  }

  if (action === "move-tactic") {
    state.loadout = reorderTactic(
      state.loadout,
      element.dataset.character,
      Number(element.dataset.index),
      Number(element.dataset.direction),
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
    if (!equipmentId || !state.meta.ownedEquipment.includes(equipmentId)) {
      state.error = "先に手元の装備を選んでください。";
    } else {
      const result = equipEquipment(state.loadout, characterId, equipmentId, slot);
      if (!result.ok) state.error = result.reason;
      else {
        state.loadout = result.loadout;
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
    state.loadout = removeEquipment(state.loadout, characterId, equipmentId);
    record("equipment_removed", { characterId, equipmentId });
    saveState();
    render();
    return;
  }

  if (action === "begin-stage") {
    if (state.roster.length !== PARTY_SIZE) {
      state.error = "出発には" + PARTY_SIZE + "人の編成が必要です。";
      state.tab = "roster";
    } else {
      state.formation = normalizeFormation(state.formation, state.roster);
      resetBattleResources();
      state.battleError = null;
      record("loadout_confirmed", {
        stage: state.stage,
        roster: [...state.roster],
        formation: clone(state.formation),
        loadout: clone(state.loadout),
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
      battle = makeBattle(
        state.stage,
        state.roster,
        state.loadout,
        state.runSeed,
        state.formation,
        { hp: state.hp, equipmentDurability: state.meta.equipmentDurability },
      );
      record("battle_started", { stage: state.stage, battleId: battle.battleId });
      const result = simulateBattle(battle, PLAYABLE_CONTENT, {
        equipmentBreaks: false,
        captureReplaySnapshots: true,
      });
      state.lastResult = result;
      const replay = compactReplay(result);
      state.replayEvents = replay.events;
      state.replaySnapshots = replay.snapshots;
      state.replayIndex = 0;
      state.replayPlaying = true;
      state.results = [...state.results, {
        stage: state.stage,
        result: result.result,
        roundsUsed: result.roundsUsed,
        metrics: result.metrics,
      }];
      for (const combatEvent of result.events || []) {
        state.runEvents.push({
          seq: state.runEvents.length,
          at: new Date().toISOString(),
          type: "combat_event",
          stage: state.stage,
          event: combatEvent,
        });
      }
      record("battle_completed", {
        stage: state.stage,
        result: result.result,
        reason: result.reason,
        roundsUsed: result.roundsUsed,
      });
      resetBattleResources();
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
      resetBattleResources();
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
    state.rewardOffer = rewardOffer(state.runSeed, state.stage, state.meta.ownedEquipment, 3);
    record("reward_presented", { stage: state.stage + 1, offer: [...state.rewardOffer] });
    state.phase = "reward";
    saveState();
    render();
    return;
  }

  if (action === "take-reward") {
    const equipmentId = element.dataset.equipment;
    if (equipmentId && !state.meta.ownedEquipment.includes(equipmentId)) {
      state.meta.ownedEquipment = [...state.meta.ownedEquipment, equipmentId];
      state.meta.equipmentDurability[equipmentId] = EQUIPMENT[equipmentId]?.maxDurability ?? 1;
      record("reward_taken", { stage: state.stage, equipmentId });
    }
    advanceAfterReward();
    return;
  }

  if (action === "take-skill-reward") {
    for (const option of CHARACTER_OPTIONS) {
      state.meta.skillPoints[option.id] = skillPointsFor(option.id) + 2;
    }
    record("reward_taken", {
      stage: state.stage,
      reward: "skill_points",
      amount: 2,
      recipients: CHARACTER_OPTIONS.map((option) => option.id),
    });
    advanceAfterReward();
    return;
  }

  if (action === "complete") {
    record("run_completed", { stage: state.stage, result: state.lastResult?.result || "win" });
    state.meta.expeditions += 1;
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
    const finalResult = state.results[state.results.length - 1];
    const finalWon = state.results.some((entry) => entry.stage === 7 && entry.result === "win");
    const finalActor = state.lastResult?.actors?.find((actor) => actor.side === "ally" && actor.alive);
    const payload = {
      runId: state.runId,
      telemetryRunId: state.runId,
      deviceId: deviceIdForRun(),
      schemaVersion: 4,
      gameVersion: VERSION,
      startedAt: state.startedAt || endedAt,
      endedAt,
      outcome: {
        won: finalWon,
        reached: state.stage,
        hp: finalActor?.hp ?? 0,
      },
      build: {
        roster: state.roster,
        formation: state.formation,
        loadout: state.loadout,
        ownedEquipment: state.meta.ownedEquipment,
      },
      stats: {
        // **印は stats に置く。**functions/api/runs.js が保存するのは
        // outcome / build / stats / answers / client / events だけで、
        // 最上位に足した項目は export に出ない（＝後から版を照合できない）。
        buildStamp: BUILD,
        rulesFingerprint: FINGERPRINT,
        seed: state.runSeed,
        stageCount: state.stage,
        ruleset: PLAYABLE_CONTENT.contentVersion,
        skillPoints: clone(state.meta.skillPoints),
        results: state.results,
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
        ? "保存済み · run " + state.runId.slice(0, 8)
        : "送信待ち · " + result.error;
    }).catch(() => {
      submitButton.disabled = false;
      submitButton.textContent = "端末に保存しました（D1未送信）";
    });
  }
}

render();
