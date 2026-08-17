const GAME_VERSION = "cycle-0.1";
const SAVE_KEY = "garakuta-cycle-save-v1";
const MAX_HP = 30;
const ACTIVE_CAPACITY = 5;

const MODULES = {
  generator: { name: "脈動発電機", icon: "⚡", color: "#d5f05a", text: "電力＋2", rare: false },
  gun: { name: "電弧砲", icon: "➤", color: "#ee875d", text: "4攻撃。最大2電力を使い、1ごとに＋2", rare: false },
  shield: { name: "偏向盾", icon: "⬡", color: "#72c8b8", text: "3装甲。最大2電力を使い、1ごとに＋2", rare: false },
  battery: { name: "継ぎ接ぎ蓄電器", icon: "▣", color: "#89aaf0", text: "電力＋1。余剰を最大3だけ次巡へ", rare: false },
  echo: { name: "反響器", icon: "◎", color: "#dc8fb3", text: "直前の効果を半分繰り返す（攻撃は最低1）", rare: false },
  leech: { name: "吸命管", icon: "✚", color: "#f2c661", text: "3攻撃、耐久を1修復", rare: true }
};

const ENEMIES = [
  { name: "偵察ダニ", mark: "●", hp: 17, atk: 3, rage: 0, trait: "順番を一度動かせば違いが見える相手。" },
  { name: "採掘モグラ", mark: "▼", hp: 28, atk: 4, rage: 0, trait: "電力を砲と盾のどちらへ先に渡すか。" },
  { name: "鋲打ちムカデ", mark: "≋", hp: 39, atk: 6, rage: 0, trait: "毎巡同じ反撃。列の安定性を試す。" },
  { name: "赤熱カラス", mark: "▲", hp: 53, atk: 7, rage: 1, trait: "反撃が毎巡＋1。長期戦は危険。" },
  { name: "圧砕ゴリラ", mark: "◆", hp: 68, atk: 8, rage: 1, trait: "火力だけでも盾だけでも足りない。" },
  { name: "廃棄場の王", mark: "◈", hp: 79, atk: 9, rage: 1, trait: "今ある機構の順番を読み切れるか。" }
];

const $ = selector => document.querySelector(selector);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
let state;
let selectedId = null;
let inBattle = false;

function randomType(exclude = []) {
  const common = Object.keys(MODULES).filter(type => !MODULES[type].rare && !exclude.includes(type));
  if (Math.random() < 0.11 && !exclude.includes("leech")) return "leech";
  return common[Math.floor(Math.random() * common.length)];
}

function makeModule(type, active = false) {
  return { id: uid(), type, active };
}

function freshState() {
  const used = [];
  const modules = Array.from({ length: 3 }, () => {
    const type = randomType(used);
    used.push(type);
    return makeModule(type, true);
  });
  return {
    runId: uid(), startedAt: new Date().toISOString(), endedAt: null,
    wave: 0, hp: MAX_HP, completed: false, won: false, pendingReward: null,
    modules, events: [], moments: [], answers: {}, seq: 0,
    stats: { victories: 0, battles: 0, moves: 0, rewards: [], rewardChoices: [], battleResults: [] }
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved?.runId && Array.isArray(saved.modules)) return saved;
  } catch (_) {}
  return freshState();
}

function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
function activeModules() { return state.modules.filter(module => module.active); }
function benchModules() { return state.modules.filter(module => !module.active); }

function cycleForecast(modules = activeModules(), carried = 0, withSteps = false) {
  let energy = carried;
  let damage = 2;
  let armor = 0;
  let healing = 0;
  let previous = { energy: 0, damage: 0, armor: 0, healing: 0 };
  const steps = [];
  for (const module of modules) {
    const effect = { energy: 0, damage: 0, armor: 0, healing: 0 };
    const before = energy;
    if (module.type === "generator") effect.energy = 2;
    if (module.type === "gun") {
      const spent = Math.min(2, energy);
      energy -= spent;
      effect.damage = 4 + spent * 2;
    }
    if (module.type === "shield") {
      const spent = Math.min(2, energy);
      energy -= spent;
      effect.armor = 3 + spent * 2;
    }
    if (module.type === "battery") effect.energy = 1;
    if (module.type === "echo") {
      effect.energy = Math.floor(previous.energy / 2);
      effect.damage = Math.max(1, Math.floor(previous.damage / 2));
      effect.armor = Math.floor(previous.armor / 2);
      effect.healing = Math.floor(previous.healing / 2);
    }
    if (module.type === "leech") {
      effect.damage = 3;
      effect.healing = 1;
    }
    energy += effect.energy;
    damage += effect.damage;
    armor += effect.armor;
    healing += effect.healing;
    if (withSteps) steps.push({ module, before, after: energy, ...effect });
    previous = effect;
  }
  const carry = modules.some(module => module.type === "battery") ? Math.min(3, energy) : 0;
  return { energy, damage, armor, healing, carry, steps };
}

function snapshot() {
  const first = cycleForecast(activeModules(), 0);
  const second = cycleForecast(activeModules(), first.carry);
  return { wave: state.wave, hp: state.hp, modules: state.modules.map(({ id, type, active }) => ({ id, type, active })), forecast: { first, second } };
}

function record(type, detail = {}) {
  const event = { seq: ++state.seq, at: new Date().toISOString(), elapsedMs: Date.now() - new Date(state.startedAt).getTime(), type, detail, state: snapshot() };
  state.events.push(event);
  saveState();
  return event;
}

function currentEnemy() { return ENEMIES[Math.min(state.wave, ENEMIES.length - 1)]; }

function effectSummary(step) {
  const bits = [];
  if (step.energy) bits.push(`電＋${step.energy}`);
  if (step.damage) bits.push(`攻＋${step.damage}`);
  if (step.armor) bits.push(`装＋${step.armor}`);
  if (step.healing) bits.push(`修＋${step.healing}`);
  return bits.join(" ") || "効果なし";
}

function renderFlow() {
  const result = cycleForecast(activeModules(), 0, true);
  const root = $("#flowPreview");
  root.innerHTML = "";
  result.steps.forEach(step => {
    const def = MODULES[step.module.type];
    const div = document.createElement("div");
    div.className = "flow-step";
    div.innerHTML = `<strong>${def.icon} ${def.name}</strong><small>電 ${step.before} → ${step.after}</small><small>${effectSummary(step)}</small>`;
    root.appendChild(div);
  });
}

function renderModule(module) {
  const def = MODULES[module.type];
  const button = document.createElement("button");
  button.type = "button";
  button.className = `module-chip ${def.rare ? "rare" : ""} ${selectedId === module.id ? "selected" : ""}`;
  button.style.setProperty("--module-color", def.color);
  button.innerHTML = `<b>${def.icon}</b><strong>${def.name}</strong><small>${def.text}</small>`;
  button.addEventListener("click", () => selectModule(module.id));
  return button;
}

function renderLine() {
  const active = activeModules();
  const root = $("#driveLine");
  root.innerHTML = "";
  for (let index = 0; index < ACTIVE_CAPACITY; index += 1) {
    const slot = document.createElement("div");
    slot.className = "line-slot";
    slot.innerHTML = `<span>${index + 1}</span>`;
    if (active[index]) slot.appendChild(renderModule(active[index]));
    root.appendChild(slot);
  }
  const bench = benchModules();
  $("#benchArea").classList.toggle("hidden", !bench.length);
  $("#bench").innerHTML = "";
  bench.forEach(module => $("#bench").appendChild(renderModule(module)));
}

function renderSelection() {
  const tray = $("#moveTray");
  const selected = state.modules.find(module => module.id === selectedId);
  tray.classList.toggle("hidden", !selected);
  if (!selected) return;
  $("#selectedModuleName").textContent = `${MODULES[selected.type].icon} ${MODULES[selected.type].name}`;
  const active = activeModules();
  const index = active.findIndex(module => module.id === selected.id);
  tray.querySelector('[data-move="left"]').disabled = !selected.active || index <= 0;
  tray.querySelector('[data-move="right"]').disabled = !selected.active || index >= active.length - 1;
  tray.querySelector('[data-move="bench"]').disabled = !selected.active;
  tray.querySelector('[data-move="active"]').disabled = selected.active || active.length >= ACTIVE_CAPACITY;
}

function summarizeBattle(result) {
  if (!result) return "";
  const damage = result.cycles.reduce((sum, cycle) => sum + cycle.damage, 0);
  const blocked = result.cycles.reduce((sum, cycle) => sum + cycle.blocked, 0);
  return `${result.enemy}：${result.won ? "勝利" : "敗北"} / ${result.cycles.length}巡 / 攻撃${damage} / 防いだ${blocked} / 耐久${result.finalHp}`;
}

function render() {
  const enemy = currentEnemy();
  const first = cycleForecast(activeModules(), 0);
  const second = cycleForecast(activeModules(), first.carry);
  $("#waveText").textContent = `${state.wave + 1} / ${ENEMIES.length}`;
  $("#hpText").textContent = `${state.hp} / ${MAX_HP}`;
  $("#hpBar").style.width = `${clamp(state.hp / MAX_HP * 100, 0, 100)}%`;
  $("#moduleCount").textContent = `${activeModules().length} / ${ACTIVE_CAPACITY}`;
  $("#enemyMark").textContent = enemy.mark;
  $("#enemyName").textContent = enemy.name;
  $("#enemyStats").textContent = `耐久 ${enemy.hp} / 攻撃 ${enemy.atk}${enemy.rage ? `（毎巡＋${enemy.rage}）` : ""}`;
  $("#enemyTrait").textContent = enemy.trait;
  $("#forecastEnergy").textContent = first.energy;
  $("#forecastDamage").textContent = first.damage;
  $("#forecastArmor").textContent = first.armor;
  $("#forecastHeal").textContent = first.healing;
  $("#forecastNote").textContent = `1巡目：攻${first.damage}・装${first.armor}・修${first.healing}・次巡へ${first.carry}。2巡目：攻${second.damage}・装${second.armor}・修${second.healing}。装甲は巡ごとに作り直す。`;
  const last = state.stats.battleResults.at(-1);
  $("#lastBattleSummary").textContent = summarizeBattle(last);
  $("#lastBattleSummary").classList.toggle("hidden", !last);
  $("#battleButton").disabled = inBattle || state.completed || !activeModules().length;
  $("#battleButton").textContent = inBattle ? "駆動中…" : "この順で駆動する";
  renderFlow();
  renderLine();
  renderSelection();
}

function selectModule(id) {
  if (inBattle || state.completed) return;
  selectedId = selectedId === id ? null : id;
  record("module_inspected", { moduleId: selectedId });
  render();
}

function moveSelected(direction) {
  const selected = state.modules.find(module => module.id === selectedId);
  if (!selected) return;
  const active = activeModules();
  if (direction === "bench" && selected.active) selected.active = false;
  if (direction === "active" && !selected.active && active.length < ACTIVE_CAPACITY) {
    state.modules = state.modules.filter(module => module.id !== selected.id);
    selected.active = true;
    state.modules.push(selected);
  }
  if ((direction === "left" || direction === "right") && selected.active) {
    const from = state.modules.indexOf(selected);
    const activeIndex = active.findIndex(module => module.id === selected.id);
    const neighbor = active[activeIndex + (direction === "left" ? -1 : 1)];
    if (neighbor) {
      const to = state.modules.indexOf(neighbor);
      [state.modules[from], state.modules[to]] = [state.modules[to], state.modules[from]];
    }
  }
  state.stats.moves += 1;
  record("module_moved", { module: selected.type, direction });
  selectedId = null;
  render();
  scheduleSync();
}

async function startBattle() {
  if (inBattle || state.completed) return;
  inBattle = true;
  selectedId = null;
  state.stats.battles += 1;
  const enemy = currentEnemy();
  let hp = state.hp;
  let enemyHp = enemy.hp;
  let carried = 0;
  const cycles = [];
  record("battle_started", { enemy, build: activeModules().map(module => module.type) });
  render();
  for (let cycle = 1; cycle <= 8 && hp > 0 && enemyHp > 0; cycle += 1) {
    const f = cycleForecast(activeModules(), carried);
    carried = f.carry;
    hp = Math.min(MAX_HP, hp + f.healing);
    enemyHp -= f.damage;
    $("#combatLog").textContent = `巡${cycle}：砲撃${f.damage}、装甲${f.armor}、修復${f.healing}。敵残り${Math.max(0, enemyHp)}。`;
    await sleep(430);
    let attack = 0;
    let blocked = 0;
    if (enemyHp > 0) {
      attack = enemy.atk + enemy.rage * (cycle - 1);
      blocked = Math.min(attack, f.armor);
      hp -= attack - blocked;
      $("#combatLog").textContent = `${enemy.name}の反撃${attack}。装甲で${blocked}、耐久へ${attack - blocked}。`;
      $("#hpText").textContent = `${Math.max(0, hp)} / ${MAX_HP}`;
      $("#hpBar").style.width = `${clamp(hp / MAX_HP * 100, 0, 100)}%`;
      await sleep(470);
    }
    const resolved = { cycle, damage: f.damage, armor: f.armor, healing: f.healing, carry: f.carry, attack, blocked, hp: Math.max(0, hp), enemyHp: Math.max(0, enemyHp) };
    cycles.push(resolved);
    record("cycle_resolved", resolved);
  }
  state.hp = Math.max(0, hp);
  inBattle = false;
  const won = enemyHp <= 0;
  const battleResult = { enemy: enemy.name, won, cycles, finalHp: state.hp, enemyHp: Math.max(0, enemyHp) };
  state.stats.battleResults.push(battleResult);
  record("battle_ended", battleResult);
  render();
  if (!won) return finishRun(false);
  state.stats.victories += 1;
  state.hp = Math.min(MAX_HP, state.hp + 2);
  if (state.wave >= ENEMIES.length - 1) return finishRun(true);
  const first = randomType();
  const second = randomType([first]);
  state.pendingReward = { offeredAt: new Date().toISOString(), candidates: [makeModule(first), makeModule(second)] };
  record("modules_offered", { types: [first, second], nextEnemy: ENEMIES[state.wave + 1].name });
  showReward();
  scheduleSync();
}

function showReward() {
  const offer = state.pendingReward;
  if (!offer) return;
  const next = ENEMIES[state.wave + 1];
  $("#rewardBattleSummary").textContent = summarizeBattle(state.stats.battleResults.at(-1));
  $("#rewardNextEnemy").textContent = `次戦：${next.name} / 耐久${next.hp} / 攻撃${next.atk}${next.rage ? `（毎巡＋${next.rage}）` : ""}`;
  $("#rewardChoices").innerHTML = "";
  offer.candidates.forEach(module => {
    const def = MODULES[module.type];
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rewardId = module.id;
    button.className = "reward-module";
    button.innerHTML = `<b>${def.icon}</b><strong>${def.name}</strong><small>${def.text}</small><em>こちらを接続</em>`;
    $("#rewardChoices").appendChild(button);
  });
  if (!$("#rewardDialog").open) $("#rewardDialog").showModal();
}

function chooseReward(id) {
  const offer = state.pendingReward;
  const chosen = offer?.candidates.find(module => module.id === id);
  if (!chosen) return;
  const rejected = offer.candidates.find(module => module.id !== id);
  const decisionMs = Date.now() - new Date(offer.offeredAt).getTime();
  state.modules.push(chosen);
  state.stats.rewards.push(chosen.type);
  state.stats.rewardChoices.push({ wave: state.wave + 1, offered: offer.candidates.map(module => module.type), chosen: chosen.type, rejected: rejected?.type, decisionMs });
  record("module_chosen", { offered: offer.candidates.map(module => module.type), chosen: chosen.type, rejected: rejected?.type, decisionMs });
  state.pendingReward = null;
  state.wave += 1;
  $("#rewardDialog").close();
  $("#combatLog").textContent = `${MODULES[chosen.type].name}を予備へ置いた。列へ入れるか決めよう。`;
  render();
  scheduleSync();
}

function finishRun(won) {
  state.completed = true;
  state.won = won;
  state.endedAt = new Date().toISOString();
  record("run_ended", { won, reached: state.wave + 1, hp: state.hp });
  render();
  showEnd();
  syncNow();
}

function showEnd() {
  $("#endTitle").textContent = state.won ? "廃棄場の王を停止した" : "駆動列は停止した";
  $("#endSummary").textContent = `${state.wave + 1}/6戦・撃破${state.stats.victories}・最終耐久${state.hp}・並替${state.stats.moves}回`;
  $("#finalBuild").innerHTML = "";
  const active = document.createElement("div");
  active.textContent = `駆動列：${activeModules().map(module => `${MODULES[module.type].icon}${MODULES[module.type].name}`).join(" → ") || "なし"}`;
  const bench = document.createElement("div");
  bench.textContent = `予備：${benchModules().map(module => `${MODULES[module.type].icon}${MODULES[module.type].name}`).join("、") || "なし"}`;
  $("#finalBuild").append(active, bench);
  if (!$("#endDialog").open) $("#endDialog").showModal();
}

const reactionLabel = kind => ({ hit: "きた！", choice: "迷う", insight: "ひらめいた", payoff: "うまくいった", dull: "退屈", unfair: "理不尽" }[kind] || kind);
function saveReaction(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const kind = String(data.get("kind") || "");
  if (!kind) return;
  const note = String(data.get("note") || "").trim();
  const logged = record("moment_recorded", { kind, label: reactionLabel(kind), note });
  state.moments.push({ seq: logged.seq, at: logged.at, elapsedMs: logged.elapsedMs, kind, label: reactionLabel(kind), phase: inBattle ? "battle" : "build", note });
  saveState();
  event.currentTarget.reset();
  $("#reactionDialog").close();
  $("#combatLog").textContent = `「${reactionLabel(kind)}」を記録した。`;
  scheduleSync();
}

function collectAnswers() {
  const data = new FormData($("#playtestForm"));
  return Object.fromEntries(["bestMoment", "friction", "hardChoice", "rewardChoice", "gradient", "wishlist", "futureTrap", "choiceLoad", "replay", "comment"].map(key => [key, String(data.get(key) || "").trim()]));
}

function getDeviceId() {
  let id = localStorage.getItem("garakuta-lab-device-id");
  if (!id) { id = uid(); localStorage.setItem("garakuta-lab-device-id", id); }
  return id;
}

function payload() {
  return {
    schemaVersion: 3, gameVersion: GAME_VERSION, runId: state.runId, telemetryRunId: state.runId,
    deviceId: getDeviceId(), startedAt: state.startedAt, endedAt: state.endedAt,
    outcome: { won: state.won, title: state.completed ? (state.won ? "廃棄場の王を停止した" : "駆動列は停止した") : "進行中", reached: state.wave + 1, defeated: state.stats.victories, hp: state.hp },
    build: state.modules.map(module => ({ name: MODULES[module.type].name, icon: MODULES[module.type].icon, short: module.active ? `駆動列${activeModules().findIndex(item => item.id === module.id) + 1}` : "予備" })),
    stats: { ...state.stats, placements: { active: activeModules().map(module => module.type), bench: benchModules().map(module => module.type) }, finalForecast: cycleForecast(activeModules(), 0) },
    answers: state.answers || {}, moments: state.moments || [], events: state.events || [],
    client: { language: navigator.language, viewport: `${innerWidth}x${innerHeight}`, standalone: matchMedia("(display-mode: standalone)").matches }
  };
}

let syncTimer;
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 700); }
async function syncNow() {
  $("#syncStatus").textContent = "送信中";
  try {
    const response = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    if (!response.ok) throw new Error(String(response.status));
    $("#syncStatus").textContent = "記録済";
  } catch (_) { $("#syncStatus").textContent = "端末保存"; }
}

async function submitReport(event) {
  event.preventDefault();
  state.answers = collectAnswers();
  record("answers_saved", state.answers);
  await syncNow();
  $("#saveMessage").textContent = "回答と全プレイログを保存しました。";
}

function newRun() {
  state = freshState();
  selectedId = null;
  inBattle = false;
  record("run_started", { version: GAME_VERSION, initial: state.modules });
  $("#endDialog").close();
  $("#saveMessage").textContent = "";
  $("#playtestForm").reset();
  render();
  scheduleSync();
}

$("#helpButton").addEventListener("click", () => $("#helpDialog").showModal());
$("#battleButton").addEventListener("click", startBattle);
$("#reactionButton").addEventListener("click", () => $("#reactionDialog").showModal());
$("#reactionForm").addEventListener("submit", saveReaction);
$("#cancelReaction").addEventListener("click", () => { $("#reactionForm").reset(); $("#reactionDialog").close(); });
$("#rewardChoices").addEventListener("click", event => { const button = event.target.closest("[data-reward-id]"); if (button) chooseReward(button.dataset.rewardId); });
$("#playtestForm").addEventListener("submit", submitReport);
$("#newRunButton").addEventListener("click", newRun);
$("#cancelSelection").addEventListener("click", () => { selectedId = null; render(); });
document.querySelectorAll("[data-move]").forEach(button => button.addEventListener("click", () => moveSelected(button.dataset.move)));
addEventListener("online", syncNow);

state = loadState();
if (!state.events.length) record("run_started", { version: GAME_VERSION, initial: state.modules });
render();
if (state.completed) showEnd();
else if (state.pendingReward) showReward();
else scheduleSync();
