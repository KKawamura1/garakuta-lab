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
} from "./playable-battles.mjs";
import { POSITIONS } from "./schema.mjs";
import { deviceIdForRun, sendPayload, uuid } from "../agent-view/sync.js";

const VERSION = "EXP-18 Full prototype 0.1";
const SAVE_KEY = "exp18-full-prototype-v01";
const app = document.querySelector("#app");
const positionLabels = {
  front_left: "前列左",
  front_right: "前列右",
  rear_left: "後列左",
  rear_right: "後列右",
};
const positionRows = {
  front_left: "前列",
  front_right: "前列",
  rear_left: "後列",
  rear_right: "後列",
};
const kindLabels = { active: "行動", reactive: "反応", equipment: "装備" };
const branchIcons = { "攻撃": "✦", "指揮": "↗", "支援": "✚", "守り": "◇" };
const replayTypes = new Set([
  "battle_started",
  "round_started",
  "actor_activated",
  "action_declared",
  "target_selected",
  "target_changed",
  "action_started",
  "action_resolved",
  "action_skipped",
  "preparation_started",
  "preparation_advanced",
  "preparation_completed",
  "preparation_interrupted",
  "damage_taken",
  "excess_damage",
  "healing_applied",
  "excess_healing",
  "barrier_gained",
  "resource_gained",
  "resource_spent",
  "actor_moved",
  "status_added",
  "equipment_worn",
  "equipment_broken",
  "equipment_repaired",
  "actor_defeated",
  "reaction_fired",
  "rule_triggered",
  "battle_ended",
]);

let replayTimer = null;

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
    skillPoints: 10,
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

function normalizeFormation(formation, roster) {
  const next = {};
  const used = new Set();
  for (const id of roster) {
    const requested = formation?.[id];
    const position = POSITIONS.includes(requested) && !used.has(requested)
      ? requested
      : POSITIONS.find((candidate) => !used.has(candidate));
    if (position) {
      next[id] = position;
      used.add(position);
    }
  }
  return next;
}

function newRunState(meta) {
  const roster = ["warden", "mender", "lancer", "scout"];
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
    selectedSkillNode: null,
    selectedEquipment: null,
    lastResult: null,
    replayEvents: [],
    replayIndex: 0,
    replayPlaying: false,
    results: [],
    runEvents: [],
    battleSnapshot: null,
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
    meta.ownedEquipment = Array.isArray(saved.meta?.ownedEquipment)
      ? saved.meta.ownedEquipment.filter((id) => EQUIPMENT[id])
      : meta.ownedEquipment;
    meta.equipmentDurability = { ...defaultMeta().equipmentDurability, ...(saved.meta?.equipmentDurability || {}) };
    next.meta = meta;
    next.roster = Array.isArray(next.roster)
      ? next.roster.filter((id) => characterInfo(id)).slice(0, 4)
      : fresh.roster;
    next.formation = normalizeFormation(next.formation, next.roster);
    next.loadout = next.loadout || freshLoadout(next.roster);
    next.hp = next.hp && typeof next.hp === "object" ? next.hp : {};
    next.results = Array.isArray(next.results) ? next.results : [];
    next.runEvents = Array.isArray(next.runEvents) ? next.runEvents : [];
    next.rewardOffer = Array.isArray(next.rewardOffer) ? next.rewardOffer : [];
    next.replayEvents = Array.isArray(next.replayEvents) ? next.replayEvents : [];
    next.selectedSkillNode = next.selectedSkillNode || null;
    next.battleError = next.battleError || null;
    return next;
  } catch {
    return initialState();
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
    + " · ルール " + esc(PLAYABLE_CONTENT.contentVersion) + "</footer></div>";
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

function positionOwner(position) {
  return state.roster.find((characterId) => state.formation[characterId] === position) ?? null;
}

function sectionHeading(eyebrow, title, right = "") {
  return "<div class=\"section-head\"><div><p class=\"eyebrow\">" + esc(eyebrow)
    + "</p><h2>" + esc(title) + "</h2></div>" + right + "</div>";
}

function campNav() {
  const tabs = [
    ["roster", "編成", state.roster.length + "/4"],
    ["skills", "スキル", "残り" + state.meta.skillPoints + "pt"],
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
  if (replayTimer) {
    clearInterval(replayTimer);
    replayTimer = null;
  }
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
  if (state.phase === "battle" && state.replayPlaying) startReplayTimer();
}

function renderIntro() {
  return shell("灰の遠征", "仲間の役割、技能、装備、隊列を組み替えて7区画を越える", "<section class=\"hero card\">"
    + "<div class=\"sigil\">◈</div><p class=\"lead\">4人を選び、4つの位置へ配置し、<br>各人の行動・反応・装備を組みます。</p>"
    + "<p class=\"intro-copy\">戦闘は自動で進みます。プレイヤーが作るのは、敵の狙いに対して誰を前へ出し、どの技能を優先し、どの装備を消耗させるかという準備です。</p>"
    + button("遠征を始める", "start", false, "button primary")
    + "<div class=\"loop\"><span><b>1</b>4人を編成</span><span><b>2</b>技能を解禁・装着</span><span><b>3</b>装備を2枠へ組む</span><span><b>4</b>自動戦闘で検証</span></div></section>"
    + "<section class=\"three-up\"><div class=\"card\"><b>8人の仲間</b><span>固有の役割と初期技能</span></div><div class=\"card\"><b>24技能</b><span>行動12・反応12</span></div><div class=\"card\"><b>18装備</b><span>耐久を持つ実物</span></div></section>");
}

function renderCamp() {
  const view = {
    roster: renderRoster,
    skills: renderSkills,
    equipment: renderEquipment,
    map: renderMap,
  }[state.tab]();
  const title = state.tab === "map" ? "出発前のキャンプ" : "キャンプで組み替える";
  const subtitle = "第" + state.stage + "区画 · " + encounterInfo(state.stage).name + " · 4人編成";
  return shell(title, subtitle, campNav() + view);
}

function renderRoster() {
  const slots = POSITIONS.map((position) => {
    const owner = positionOwner(position);
    const selected = owner && selectedCharacter() === owner;
    const content = owner
      ? "<span class=\"avatar\">" + esc(characterInfo(owner)?.icon ?? "・") + "</span><span><b>"
        + esc(characterName(owner)) + "</b><small>" + esc(characterInfo(owner)?.role ?? "")
        + " · HP " + currentHp(owner) + "/" + maxHp(owner) + "</small></span>"
      : "<span class=\"empty-icon\">＋</span><span><b>空き枠</b><small>選択した仲間をここへ置く</small></span>";
    return "<button type=\"button\" class=\"formation-slot " + (selected ? "selected" : "")
      + "\" data-action=\"place-character\" data-position=\"" + position + "\"><span class=\"slot-label\">"
      + positionText(position) + "</span><span class=\"slot-person\">" + content + "</span></button>";
  }).join("");
  const characterCards = CHARACTER_OPTIONS.map((option) => {
    const inParty = state.roster.includes(option.id);
    const selected = selectedCharacter() === option.id;
    const action = inParty ? "select-character" : "toggle-roster";
    const actionLabel = inParty ? (selected ? "選択中" : "選ぶ") : "編成に入れる";
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
  return "<section class=\"card\">" + sectionHeading("FORMATION / 4 SLOTS", "誰がどこに立つ？", "<span class=\"stage\">"
    + state.roster.length + " / 4人</span>") + "<p class=\"muted\">仲間を選んでから位置枠をタップすると、二人の位置を交換できます。前列・後列は敵の狙いと技能の条件に影響します。</p>"
    + "<div class=\"formation-board\">" + slots + "</div><p class=\"selection-note\">選択中: <b>"
    + esc(characterName(selectedCharacter())) + "</b> · 位置枠をタップして配置</p></section>"
    + "<section class=\"card\">" + sectionHeading("ROSTER / 8 → 4", "同行する仲間を選ぶ")
    + "<p class=\"muted\">8人全員に固有の初期技能があります。好きな仲間を選び、技能ツリーで別の役割へ伸ばせます。</p>"
    + "<div class=\"character-grid\">" + characterCards + "</div></section>"
    + "<section class=\"card quiet\"><p class=\"eyebrow\">NEXT</p><h3>次にやること</h3><p class=\"muted\">スキルツリーで行動2・反応2を組み、装備画面で実物を2枠に割り当ててください。</p>"
    + button("スキルツリーを見る", "tab", false, "button", "data-tab=\"skills\"") + "</section>";
}

function skillSlotRows(characterId, kind) {
  const key = kind === "active" ? "tactics" : "reactives";
  const list = state.loadout[key]?.[characterId] || [];
  const title = kind === "active" ? "行動（優先順）" : "リアクティブ（条件発火）";
  const rows = list.map((skillId, index) => {
    const info = COMPONENTS[skillId];
    const moveButtons = kind === "active"
      ? "<span class=\"reorder\">" + button("↑", "move-tactic", index === 0, "icon-button", "data-character=\"" + characterId + "\" data-index=\"" + index + "\" data-direction=\"-1\"")
        + button("↓", "move-tactic", index === list.length - 1, "icon-button", "data-character=\"" + characterId + "\" data-index=\"" + index + "\" data-direction=\"1\"") + "</span>"
      : "";
    return "<div class=\"installed-row\"><span class=\"" + (kind === "active" ? "order" : "bullet") + "\">"
      + (kind === "active" ? index + 1 : "↳") + "</span><span class=\"installed-copy\"><b>"
      + esc(info?.label ?? nameFor(skillId)) + "</b><small>" + esc(info?.effect ?? "") + "</small></span>"
      + moveButtons + button("外す", "remove-skill", false, "icon-button remove", "data-character=\"" + characterId
        + "\" data-skill=\"" + skillId + "\" data-kind=\"" + kind + "\"") + "</div>";
  }).join("");
  return "<div class=\"slot-group\"><div class=\"slot-heading\"><span>" + title + "</span><small>"
    + list.length + " / 2</small></div>" + (rows || "<p class=\"empty-slot\">技能ツリーから装着してください。</p>") + "</div>";
}

function memberTabs(characterId) {
  return "<div class=\"member-tabs\" aria-label=\"仲間を選ぶ\">" + state.roster.map((id) => "<button type=\"button\" class=\"member-tab "
    + (id === characterId ? "active" : "") + "\" aria-pressed=\"" + (id === characterId ? "true" : "false")
    + "\" data-action=\"select-character\" data-character=\"" + id
    + "\"><span class=\"avatar small\">" + esc(characterInfo(id)?.icon ?? "・") + "</span>"
    + "<span>" + characterName(id) + "<small>" + positionText(state.formation[id]) + "</small></span></button>").join("") + "</div>";
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

function skillNodeIcon(node) {
  return (node.kind === "reactive" ? "↳" : branchIcons[node.branch] ?? "·");
}

function renderSkillNode(node, characterId) {
  const info = COMPONENTS[node.skillId];
  const unlocked = isUnlocked(characterId, node.skillId);
  const equipped = installedSkill(characterId, node.skillId, node.kind);
  const prereqsMet = node.requires.every((skillId) => isUnlocked(characterId, skillId));
  const canUnlock = !unlocked && prereqsMet && state.meta.skillPoints >= node.cost;
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
  return "<section class=\"skill-branch\"><div class=\"branch-title\"><b><span class=\"branch-icon\">" + esc(branchIcons[branch] ?? "·")
    + "</span>" + branch + "</b><small>" + nodes.length + " ノード</small></div><div class=\"skill-tree-map\">" + tiers + "</div></section>";
}

function renderSkills() {
  const characterId = selectedCharacter();
  const pointsBadge = "<span class=\"skill-points-badge\"><small>残り技能点</small><b>" + state.meta.skillPoints + "</b></span>";
  const branches = ["攻撃", "指揮", "支援", "守り"].map((branch) => renderSkillBranch(branch, characterId)).join("");
  return "<section class=\"card skill-build-card\">" + sectionHeading("SKILL TREE / 24 NODES", "誰を伸ばす？", pointsBadge)
    + "<p class=\"muted\">仲間を切り替えながら、現在の行動・リアクティブ・装備を確認できます。技能ノードをタップすると説明と装着操作が開きます。</p>"
    + memberTabs(characterId) + memberContext(characterId, "skills") + skillSlotRows(characterId, "active") + skillSlotRows(characterId, "reactive") + "</section>"
    + "<section class=\"card\">" + sectionHeading("COMMON TREE / 12 + 12", "技能を解禁する")
    + "<p class=\"muted\">同じツリーでも、誰に装着するか・どの順番で試すかで役割が変わります。アイコンを選び、説明を必要な時だけ開いてください。</p>"
    + "<div class=\"tree-legend\"><span><i class=\"kind kind-active\">行動</i> 自分の順番に試す</span><span><i class=\"kind kind-reactive\">反応</i> 条件発生時に発火</span></div>"
    + branches + "</section>"
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
    ? "耐久 " + equipmentDurability(equipmentId) + " / " + (EQUIPMENT[equipmentId]?.maxDurability ?? 1)
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
    return "<article class=\"gear-card " + (isSelected ? "selected" : "") + (durability === 0 ? " broken" : "")
      + "\"><button type=\"button\" class=\"gear-main\" data-action=\"select-equipment\" data-equipment=\"" + id
      + "\"><span class=\"gear-icon\">◆</span><span class=\"gear-copy\"><b>" + esc(EQUIPMENT[id]?.label ?? id)
      + "</b><small>" + esc(EQUIPMENT[id]?.effect ?? "") + "</small></span><span class=\"gear-state\">"
      + (owner ? characterName(owner) : "手元") + "<br>" + durability + "/" + max + "</span></button>"
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
    + state.meta.ownedEquipment.length + " / " + Object.keys(EQUIPMENT).length + "</span>") + "<p class=\"muted\">装備は共有インベントリの実物です。選択してから仲間の枠をタップすると移動します。戦闘で耐久が減り、壊れても所持は失いません。</p>"
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
    + "<section class=\"card quiet\"><p class=\"eyebrow\">CAMPAIGN RULE</p><p class=\"muted\">勝利するとHPと装備耐久を持ち越します。報酬を1つ選び、次の区画へ進みます。敗北時は戦闘前の状態へ戻って構成を練り直せます。</p></section>";
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
  const source = actorName(event.sourceActorId || event.actorId || event.ownerActorId);
  const target = targetNames(event.targetActorIds || event.targetIds);
  const amount = values.amount ?? values.actual ?? values.proposed;
  const amountText = amount !== undefined ? " · " + amount : "";
  const skillId = values.activeSkillId || values.skillId || event.activeSkillId || event.skillId;
  const skill = skillId ? nameFor(skillId) : "行動";
  const reactionId = values.reactiveSkillId || event.reactiveSkillId;
  const reaction = reactionId ? nameFor(reactionId) : "反応";
  const round = event.round ?? values.round ?? "-";
  const targetLabel = target && target === source ? "自分" : target || "相手";
  const cause = event.ruleId && event.sourceDefinitionId ? "（" + nameFor(event.sourceDefinitionId) + "）" : "";
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
    damage_taken: target + "が" + amountText + "ダメージを受けた",
    excess_damage: "攻撃が" + amountText + "余った",
    healing_applied: target + "が" + amountText + "回復した",
    excess_healing: "回復が" + amountText + "余った",
    barrier_gained: target + "に防壁" + amountText + "が生まれた",
    resource_gained: target + "が" + resourceLabel(values.resource) + amountText + "を得た",
    resource_spent: source + "が" + resourceLabel(values.resource) + amountText + "を使った",
    actor_moved: source + "が位置を替えた",
    status_added: target + "に状態が加わった",
    equipment_worn: source + "の装備が" + amountText + "摩耗した",
    equipment_broken: source + "の装備が壊れた",
    equipment_repaired: source + "の装備が" + amountText + "修理された",
    actor_defeated: target + "が倒れた",
    battle_ended: "戦闘終了 · " + (values.result || "決着"),
  };
  if (event.type === "reaction_fired" || event.type === "rule_triggered") return source + "の" + reaction + "が発火" + cause;
  return map[event.type] || event.type + amountText;
}

function compactEvents(events) {
  return (events || []).filter((event) => replayTypes.has(event.type));
}

function renderReplayActor(actor) {
  return "<div class=\"replay-actor " + (actor.alive ? "" : "defeated") + "\"><span class=\"avatar small\">"
    + esc(characterInfo(actor.definitionId)?.icon ?? (actor.side === "enemy" ? "◆" : "・"))
    + "</span><div><b>" + esc(String(actor.displayName).split(" — ")[0]) + "</b><small>"
    + (actor.alive ? "HP " + actor.hp + "/" + actor.maxHp : "戦闘不能") + " · 防壁 " + actor.barrier + "</small></div></div>";
}

function renderBattle() {
  const result = state.lastResult;
  const events = state.replayEvents;
  const index = Math.min(state.replayIndex, Math.max(0, events.length - 1));
  const current = events[index];
  const visible = events.slice(Math.max(0, index - 11), index + 1).reverse();
  const percent = events.length ? Math.round(((index + 1) / events.length) * 100) : 100;
  const actors = result ? result.actors || [] : [];
  const allies = actors.filter((actor) => actor.side === "ally").map(renderReplayActor).join("");
  const enemies = actors.filter((actor) => actor.side === "enemy").map(renderReplayActor).join("");
  const controls = state.replayPlaying
    ? button("一時停止", "replay-toggle", false, "button")
    : button("自動再生", "replay-toggle", index >= events.length - 1, "button primary");
  return shell("戦闘リプレイ", encounterInfo(state.stage).name + " · " + percent + "%", "<section class=\"card replay-card\">"
    + "<div class=\"replay-progress\"><span style=\"width:" + percent + "%\"></span></div><div class=\"replay-now\">"
    + (current ? esc(eventText(current)) : "戦闘開始") + "</div><div class=\"replay-columns\"><div><h3>味方</h3>"
    + allies + "</div><div><h3>敵</h3>" + enemies + "</div></div><ol class=\"events replay-events\">"
    + visible.map((event) => "<li class=\"event\"><span class=\"event-round\">R" + (event.round ?? "-")
      + "</span><span>" + esc(eventText(event)) + "</span></li>").join("") + "</ol>"
    + "<div class=\"replay-controls\">" + controls + button("一拍進める", "replay-step", index >= events.length - 1, "button")
    + button("結果を見る", "replay-result", false, "button") + "</div></section>"
    + "<section class=\"card quiet\"><p class=\"eyebrow\">WHY THIS TARGET?</p><p class=\"muted\">「誰が誰を狙ったか」「なぜ技能が発火したか」をイベント順に表示しています。戦闘後は全イベントを開けます。</p></section>");
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
    + button("戦闘前へ戻る", "back-battle-preview", false, "button") + "</div></section>";
}

function resultActors(result) {
  return (result?.actors || []).filter((actor) => actor.side === "ally").map((actor) =>
    "<div class=\"result-actor\"><span class=\"avatar small\">" + esc(characterInfo(actor.definitionId)?.icon ?? "・")
      + "</span><div><b>" + esc(String(actor.displayName).split(" — ")[0]) + "</b><small>"
      + (actor.alive ? "HP " + actor.hp + "/" + actor.maxHp : "戦闘不能")
      + " · 防壁 " + actor.barrier + "</small></div></div>").join("");
}

function renderResult() {
  const result = state.lastResult;
  if (!result) return renderCamp();
  const won = result.result === "win";
  const metrics = result.metrics || {};
  const events = compactEvents(result.events);
  const shown = events.length > 40 ? [...events.slice(0, 30), ...events.slice(-10)] : events;
  const next = won
    ? state.stage >= 7
      ? button("遠征を終えて記録する", "complete", false, "button primary")
      : button("報酬を見る", "show-reward", false, "button primary")
    : button("構成を見直す", "retry-build", false, "button primary");
  const equipment = (result.equipment || []).map((item) => "<div class=\"result-gear\"><b>"
    + esc(EQUIPMENT[item.equipmentId]?.label ?? item.equipmentId) + "</b><span>"
    + item.durability + " / " + item.maxDurability + (item.broken ? " · 壊れた" : "") + "</span></div>").join("");
  return shell(won ? "突破した" : "足を止めた", encounterInfo(state.stage).name + " · " + result.roundsUsed + "ラウンド", "<section class=\"card verdict "
    + (won ? "win" : "loss") + "\"><div class=\"verdict-mark\">" + (won ? "✓" : "×")
    + "</div><h2>" + (won ? "この組み合わせは通った" : "この組み合わせでは届かなかった")
    + "</h2><p>" + (won ? "構成の因果を確認し、次の報酬でさらに変えられます。" : "敵の狙い、技能の優先順、装備の持たせ先を見直せます。")
    + "</p><div class=\"metrics\"><span><b>" + (metrics.allyHpLost ?? 0) + "</b><small>味方HP損失</small></span><span><b>"
    + (metrics.enemyHpLost ?? 0) + "</b><small>敵HP損失</small></span><span><b>" + (metrics.reactionsFired ?? 0)
    + "</b><small>反応発火</small></span><span><b>" + (metrics.equipmentWear ?? 0) + "</b><small>装備摩耗</small></span></div></section>"
    + "<section class=\"card\">" + sectionHeading("AFTER BATTLE", "味方の状態") + "<div class=\"result-actors\">"
    + resultActors(result) + "</div><div class=\"result-gear-list\">" + (equipment || "<p class=\"muted\">装備なし</p>")
    + "</div></section><section class=\"card\">" + sectionHeading("CAUSE & EFFECT", "何が起きたか", "<span class=\"count\">"
    + shown.length + (shown.length === events.length ? "" : " / " + events.length) + " events</span>")
    + "<ol class=\"events\">" + shown.map((event) => "<li class=\"event\"><span class=\"event-round\">R"
      + (event.round ?? "-") + "</span><span>" + esc(eventText(event)) + "</span></li>").join("") + "</ol>"
    + "<details><summary>全イベントを見る</summary><pre>" + esc((result.events || []).map(eventText).join("\n")) + "</pre></details></section>"
    + next);
}

function renderReward() {
  const offers = state.rewardOffer.map((id) => {
    const info = EQUIPMENT[id];
    return "<article class=\"reward-card\"><div class=\"reward-kind kind-equipment\">装備</div><h3>"
      + esc(info?.label ?? id) + "</h3><p>" + esc(info?.effect ?? "") + "</p><small>"
      + esc(info?.grammar ?? "") + " · 耐久 " + (info?.maxDurability ?? 1) + "</small>"
      + button("拾って次へ", "take-reward", false, "button", "data-equipment=\"" + id + "\"") + "</article>";
  }).join("");
  return shell("報酬を選ぶ", encounterInfo(state.stage).name + "を突破 · 次の区画へ", "<section class=\"card\">"
    + sectionHeading("REWARD / 3 → 1", "何を持ち帰る？") + "<p class=\"muted\">装備は共有インベントリに入り、次のキャンプで誰に持たせるかを決めます。装備を取らず、技能点や休息を選ぶこともできます。</p>"
    + "<div class=\"reward-grid\">" + offers + "</div><div class=\"reward-special\">"
    + "<article class=\"reward-card special\"><div class=\"reward-kind kind-active\">成長</div><h3>技能点 +2</h3><p>キャンプへ戻り、誰かのスキルツリーを2段進める。</p>"
    + button("技能点を取る", "take-skill-reward", false, "button") + "</article>"
    + "<article class=\"reward-card special\"><div class=\"reward-kind kind-reactive\">休息</div><h3>短い休息</h3><p>全員のHPを5回復し、全装備を1修理する。</p>"
    + button("休息する", "take-rest-reward", false, "button") + "</article></div></section>");
}

function renderComplete() {
  const feedback = state.feedback || {};
  const option = (value, label, selected) => "<option value=\"" + value + "\" " + (selected ? "selected" : "") + ">" + label + "</option>";
  const trail = state.roster.map(characterName).join("、");
  const gear = state.meta.ownedEquipment.map((id) => EQUIPMENT[id]?.label ?? id).join("、");
  return shell("遠征を終えた", "今回の編成と因果を記録する", "<section class=\"card verdict win\"><div class=\"verdict-mark\">✦</div><h2>7区画を見届けた</h2><p>今回の仲間: "
    + esc(trail) + "<br>手元の装備: " + esc(gear || "なし") + "</p><div class=\"build-trail\"><span><i>1</i>4人を選び、隊列を組んだ</span><span><i>2</i>技能ツリーから実際の技能を装着した</span><span><i>3</i>装備2枠と敵の狙いを考えた</span><span><i>4</i>自動戦闘の因果を確認した</span></div></section>"
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

function updateMetaDurability(result) {
  for (const item of result.equipment || []) {
    state.meta.equipmentDurability[item.equipmentId] = item.durability;
  }
}

function updateHpFromResult(result) {
  for (const actor of result.actors || []) {
    if (actor.side === "ally") state.hp[actor.definitionId] = actor.hp;
  }
}

function startReplayTimer() {
  replayTimer = setInterval(() => {
    if (!state.replayPlaying) return;
    if (state.replayIndex >= state.replayEvents.length - 1) {
      state.replayPlaying = false;
      saveState();
      render();
      return;
    }
    state.replayIndex += 1;
    saveState();
    render();
  }, 180);
}

function advanceAfterReward() {
  state.stage += 1;
  state.rewardOffer = [];
  state.lastResult = null;
  state.replayEvents = [];
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
        ensureSelectedCharacter();
        record("roster_changed", { roster: [...state.roster], removed: id });
      }
    } else if (state.roster.length >= 4) {
      state.error = "編成は4人までです。";
    } else {
      state.roster = [...state.roster, id];
      const fresh = freshLoadout([id]);
      state.loadout.tactics[id] = fresh.tactics[id];
      state.loadout.reactives[id] = fresh.reactives[id];
      state.loadout.equipment[id] = [];
      state.formation = normalizeFormation(state.formation, state.roster);
      state.selectedCharacter = id;
      record("roster_changed", { roster: [...state.roster], added: id });
    }
    saveState();
    render();
    return;
  }

  if (action === "place-character") {
    const position = element.dataset.position;
    const id = selectedCharacter();
    if (!POSITIONS.includes(position) || !id) return;
    const other = positionOwner(position);
    const oldPosition = state.formation[id];
    if (other && other !== id) {
      state.formation[other] = oldPosition;
    }
    state.formation[id] = position;
    state.formation = normalizeFormation(state.formation, state.roster);
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
    } else if (state.meta.skillPoints < node.cost) {
      state.error = "技能点が足りません。";
    } else {
      state.meta.skillPoints -= node.cost;
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
    if (state.roster.length !== 4) {
      state.error = "出発には4人の編成が必要です。";
      state.tab = "roster";
    } else {
      state.formation = normalizeFormation(state.formation, state.roster);
      state.battleSnapshot = { hp: clone(state.hp), equipmentDurability: clone(state.meta.equipmentDurability) };
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
      const result = simulateBattle(battle, PLAYABLE_CONTENT);
      state.lastResult = result;
      state.replayEvents = compactEvents(result.events);
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
      if (result.result === "win") {
        updateHpFromResult(result);
        updateMetaDurability(result);
      } else if (state.battleSnapshot) {
        state.hp = clone(state.battleSnapshot.hp);
        state.meta.equipmentDurability = clone(state.battleSnapshot.equipmentDurability);
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
      state.error = null;
      state.phase = "battleError";
    }
    saveState();
    render();
    return;
  }

  if (action === "replay-toggle") {
    if (state.replayIndex >= state.replayEvents.length - 1) return;
    state.replayPlaying = !state.replayPlaying;
    saveState();
    render();
    return;
  }

  if (action === "replay-step") {
    state.replayPlaying = false;
    if (state.replayIndex < state.replayEvents.length - 1) state.replayIndex += 1;
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
    state.meta.skillPoints += 2;
    record("reward_taken", { stage: state.stage, reward: "skill_points", amount: 2 });
    advanceAfterReward();
    return;
  }

  if (action === "take-rest-reward") {
    for (const id of state.roster) state.hp[id] = Math.min(maxHp(id), currentHp(id) + 5);
    for (const id of state.meta.ownedEquipment) {
      state.meta.equipmentDurability[id] = Math.min(
        EQUIPMENT[id]?.maxDurability ?? 1,
        equipmentDurability(id) + 1,
      );
    }
    record("reward_taken", { stage: state.stage, reward: "rest", heal: 5, repair: 1 });
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
    const events = state.runEvents.length <= 4000
      ? state.runEvents
      : [state.runEvents[0], ...state.runEvents.slice(-3999)];
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
        seed: state.runSeed,
        stageCount: state.stage,
        ruleset: PLAYABLE_CONTENT.contentVersion,
        skillPoints: state.meta.skillPoints,
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
    sendPayload(payload).then((result) => {
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
