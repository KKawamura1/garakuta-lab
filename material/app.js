const GAME_VERSION = "material-0.1";
const SAVE_KEY = "garakuta-material-save";
const MAX_HP = 30;
const BAY_CAPACITY = 3;

const MATERIALS = {
  spring: { name: "歪みバネ", icon: "〽", color: "#d5f05a", rare: false },
  lens: { name: "焦げレンズ", icon: "◉", color: "#72c8b8", rare: false },
  magnet: { name: "逆さ磁石", icon: "∩", color: "#89aaf0", rare: false },
  blade: { name: "欠け刃", icon: "✦", color: "#ee875d", rare: false },
  resin: { name: "生体樹脂", icon: "≈", color: "#dc8fb3", rare: false },
  core: { name: "異常核", icon: "◇", color: "#f2c661", rare: true }
};

const BAY_META = {
  turret: { name: "砲塔", icon: "➤", hint: "敵を壊す。炉や外殻の状態でも性能が変わる。" },
  hull: { name: "外殻", icon: "⬡", hint: "反撃を受ける一巡分の装甲。余剰は貯まらない。" },
  reactor: { name: "炉", icon: "⚡", hint: "毎巡回の出力を作り、砲塔と外殻を増幅する。" },
  bench: { name: "作業台", icon: "＋", hint: "未接続。いずれかの部位へ溶接しないと戦えない。" }
};

const ENEMIES = [
  { name: "偵察ダニ", mark: "●", hp: 20, atk: 3, rage: 0, trait: "まずは素材の三つの使い道を試す相手。" },
  { name: "採掘モグラ", mark: "▼", hp: 34, atk: 5, rage: 0, trait: "素直に硬い。攻撃と外殻の配分を問う。" },
  { name: "鋲打ちムカデ", mark: "≋", hp: 50, atk: 7, rage: 0, trait: "一定攻撃。炉の増幅が働いているかを見る。" },
  { name: "赤熱カラス", mark: "▲", hp: 70, atk: 8, rage: 1, trait: "反撃が毎巡回＋1。長引かせるか、急ぐか。" },
  { name: "圧砕ゴリラ", mark: "◆", hp: 96, atk: 10, rage: 1, trait: "高耐久・上昇攻撃。半端な配置を壊す。" },
  { name: "廃棄場の王", mark: "◈", hp: 128, atk: 12, rage: 2, trait: "反撃が毎巡回＋2。今回できた獣の最終試験。" }
];

const $ = selector => document.querySelector(selector);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

let state;
let selectedId = null;
let inBattle = false;

function randomType(exclude = []) {
  const common = Object.keys(MATERIALS).filter(type => !MATERIALS[type].rare && !exclude.includes(type));
  if (Math.random() < 0.11 && !exclude.includes("core")) return "core";
  return common[Math.floor(Math.random() * common.length)];
}

function makeMaterial(type, bay) {
  return { id: uid(), type, bay };
}

function freshState() {
  const initial = [];
  const used = [];
  ["turret", "hull", "reactor"].forEach(bay => {
    const type = randomType(used);
    used.push(type);
    initial.push(makeMaterial(type, bay));
  });
  return {
    runId: uid(), startedAt: new Date().toISOString(), endedAt: null,
    wave: 0, hp: MAX_HP, completed: false, won: false,
    pendingReward: null,
    materials: initial, events: [], moments: [], answers: {}, seq: 0,
    stats: { victories: 0, battles: 0, moves: 0, bigRebuilds: 0, rewards: [], battleResults: [] },
    lastBattleMoveCount: 0
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved?.runId && Array.isArray(saved.materials)) return saved;
  } catch (_) {}
  return freshState();
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function snapshot() {
  return {
    wave: state.wave, hp: state.hp,
    materials: state.materials.map(({ id, type, bay }) => ({ id, type, bay })),
    forecast: forecast(1)
  };
}

function record(type, detail = {}) {
  const event = {
    seq: ++state.seq, at: new Date().toISOString(),
    elapsedMs: Date.now() - new Date(state.startedAt).getTime(),
    type, detail, state: snapshot()
  };
  state.events.push(event);
  saveState();
  return event;
}

function mats(bay, type = null) {
  return state.materials.filter(m => m.bay === bay && (!type || m.type === type));
}

function count(bay, type = null) {
  return mats(bay, type).length;
}

function effectText(type, bay) {
  if (bay === "bench") return "まだ働かない";
  const effects = {
    spring: {
      turret: "3攻撃。偶数巡回はさらに＋3",
      hull: "3装甲。奇数巡回はさらに＋3",
      reactor: "出力＋2"
    },
    lens: {
      turret: "2＋出力×2攻撃（上限10）",
      hull: "2＋出力×2装甲（上限10）",
      reactor: "出力＋1。同じレンズが他部位にあると最大＋2"
    },
    magnet: {
      turret: "2＋外殻の素材数×2攻撃",
      hull: "2＋砲塔の素材数×2装甲",
      reactor: "1＋外殻の素材数だけ出力"
    },
    blade: {
      turret: "7攻撃",
      hull: "6装甲",
      reactor: "出力＋3"
    },
    resin: {
      turret: "4攻撃し、耐久を1修復",
      hull: "4装甲を得て、耐久を1修復",
      reactor: "出力＋1、耐久を1修復"
    },
    core: {
      turret: "砲塔の合計攻撃を1.5倍",
      hull: "外殻の合計装甲を1.5倍",
      reactor: "炉の合計出力を1.5倍"
    }
  };
  return effects[type][bay];
}

function forecast(cycle = 1) {
  let power = 0;
  power += count("reactor", "spring") * 2;
  power += count("reactor", "blade") * 3;
  power += count("reactor", "resin");
  power += count("reactor", "magnet") * (1 + Math.min(3, count("hull")));
  const outsideLenses = count("turret", "lens") + count("hull", "lens");
  power += count("reactor", "lens") * (1 + Math.min(2, outsideLenses));
  power = Math.ceil(power * Math.pow(1.5, count("reactor", "core")));

  let damage = 2;
  damage += count("turret", "spring") * (3 + (cycle % 2 === 0 ? 3 : 0));
  damage += count("turret", "blade") * 7;
  damage += count("turret", "resin") * 4;
  damage += count("turret", "magnet") * (2 + Math.min(3, count("hull")) * 2);
  damage += count("turret", "lens") * Math.min(10, 2 + power * 2);
  damage = Math.ceil(damage * Math.pow(1.5, count("turret", "core")));

  let shield = 1;
  shield += count("hull", "spring") * (3 + (cycle % 2 === 1 ? 3 : 0));
  shield += count("hull", "blade") * 6;
  shield += count("hull", "resin") * 4;
  shield += count("hull", "magnet") * (2 + Math.min(3, count("turret")) * 2);
  shield += count("hull", "lens") * Math.min(10, 2 + power * 2);
  shield = Math.ceil(shield * Math.pow(1.5, count("hull", "core")));

  const healing = count("turret", "resin") + count("hull", "resin") + count("reactor", "resin");
  return { power, damage, shield, healing };
}

function currentEnemy() {
  return ENEMIES[Math.min(state.wave, ENEMIES.length - 1)];
}

function renderMaterial(material) {
  const def = MATERIALS[material.type];
  const button = document.createElement("button");
  button.type = "button";
  button.className = `material-chip ${def.rare ? "rare" : ""} ${selectedId === material.id ? "selected" : ""}`;
  button.style.borderLeftColor = def.color;
  button.innerHTML = `<strong>${def.icon} ${def.name}</strong><small>${effectText(material.type, material.bay)}</small>`;
  button.addEventListener("click", () => selectMaterial(material.id));
  return button;
}

function renderBays() {
  const root = $("#bays");
  root.innerHTML = "";
  ["turret", "hull", "reactor", "bench"].forEach(bay => {
    const meta = BAY_META[bay];
    const section = document.createElement("section");
    section.className = `bay ${bay}`;
    const capacity = bay === "bench" ? `${count(bay)}個待機` : `${count(bay)} / ${BAY_CAPACITY}`;
    section.innerHTML = `<h3>${meta.icon} ${meta.name}</h3><p>${meta.hint}</p><span class="bay-capacity">${capacity}</span>`;
    mats(bay).forEach(material => section.appendChild(renderMaterial(material)));
    if (bay === "bench" && count(bay) === 0) section.classList.add("hidden");
    root.appendChild(section);
  });
}

function render() {
  const enemy = currentEnemy();
  const f = forecast(1);
  $("#waveText").textContent = `${state.wave + 1} / ${ENEMIES.length}`;
  $("#hpText").textContent = `${state.hp} / ${MAX_HP}`;
  $("#hpBar").style.width = `${clamp(state.hp / MAX_HP * 100, 0, 100)}%`;
  $("#materialCount").textContent = state.materials.length;
  $("#enemyMark").textContent = enemy.mark;
  $("#enemyName").textContent = enemy.name;
  $("#enemyStats").textContent = `耐久 ${enemy.hp} / 攻撃 ${enemy.atk}${enemy.rage ? `（毎巡回＋${enemy.rage}）` : ""}`;
  $("#enemyTrait").textContent = enemy.trait;
  $("#forecastPower").textContent = f.power;
  $("#forecastDamage").textContent = f.damage;
  $("#forecastShield").textContent = f.shield;
  $("#forecastNote").textContent = `初回予測。修復 ${f.healing} / 砲塔${count("turret")}・外殻${count("hull")}・炉${count("reactor")}。偶奇効果と敵の攻撃上昇で巡回ごとに変わる。`;
  $("#battleButton").disabled = inBattle || count("bench") > 0 || state.completed;
  $("#battleButton").textContent = inBattle ? "駆動中…" : count("bench") ? "未接続の素材がある" : "この溶接獣で戦う";
  renderBays();
  renderSelection();
}

function selectMaterial(id) {
  if (inBattle || state.completed) return;
  selectedId = selectedId === id ? null : id;
  record("material_inspected", { materialId: selectedId });
  render();
}

function renderSelection() {
  const tray = $("#selectionTray");
  const material = state.materials.find(m => m.id === selectedId);
  tray.classList.toggle("hidden", !material);
  if (!material) return;
  const def = MATERIALS[material.type];
  $("#selectedMaterialName").textContent = `${def.icon} ${def.name}`;
  tray.querySelectorAll("[data-move]").forEach(button => {
    const bay = button.dataset.move;
    button.disabled = material.bay === bay || count(bay) >= BAY_CAPACITY;
    const oldText = button.textContent.split("：")[0];
    button.textContent = `${oldText}：${effectText(material.type, bay)}`;
  });
}

function moveSelected(to) {
  const material = state.materials.find(m => m.id === selectedId);
  if (!material || material.bay === to || count(to) >= BAY_CAPACITY) return;
  const from = material.bay;
  const before = forecast(1);
  material.bay = to;
  state.stats.moves += 1;
  state.lastBattleMoveCount += 1;
  const after = forecast(1);
  record("material_moved", { material: material.type, from, to, before, after });
  selectedId = null;
  render();
  scheduleSync();
}

async function startBattle() {
  if (inBattle || count("bench") || state.completed) return;
  inBattle = true;
  selectedId = null;
  state.stats.battles += 1;
  if (state.lastBattleMoveCount >= 3) state.stats.bigRebuilds += 1;
  const movesBefore = state.lastBattleMoveCount;
  state.lastBattleMoveCount = 0;
  const enemy = currentEnemy();
  let enemyHp = enemy.hp;
  let hp = state.hp;
  const cycles = [];
  record("battle_started", { enemy, movesBefore, build: state.materials });
  render();
  $("#combatLog").textContent = `${enemy.name}へ接近。炉→砲塔→外殻の順で一巡する。`;
  await sleep(450);

  let cycle = 0;
  while (hp > 0 && enemyHp > 0 && cycle < 8) {
    cycle += 1;
    const f = forecast(cycle);
    hp = Math.min(MAX_HP, hp + f.healing);
    enemyHp -= f.damage;
    $("#combatLog").textContent = `巡回${cycle}：炉${f.power} → 砲撃${f.damage}。敵残り${Math.max(0, enemyHp)}。`;
    $("#forecastPower").textContent = f.power;
    $("#forecastDamage").textContent = f.damage;
    $("#forecastShield").textContent = f.shield;
    await sleep(480);
    let attack = 0;
    let blocked = 0;
    let hpDamage = 0;
    if (enemyHp > 0) {
      attack = enemy.atk + enemy.rage * (cycle - 1);
      blocked = Math.min(attack, f.shield);
      hpDamage = attack - blocked;
      hp -= hpDamage;
      $("#combatLog").textContent = `${enemy.name}の反撃${attack}。外殻${blocked}、耐久へ${hpDamage}。余剰外殻は廃棄。`;
      $("#hpText").textContent = `${Math.max(0, hp)} / ${MAX_HP}`;
      $("#hpBar").style.width = `${clamp(hp / MAX_HP * 100, 0, 100)}%`;
      await sleep(520);
    }
    const result = { cycle, ...f, attack, blocked, hpDamage, hp: Math.max(0, hp), enemyHp: Math.max(0, enemyHp) };
    cycles.push(result);
    record("cycle_resolved", result);
  }

  state.hp = Math.max(0, hp);
  inBattle = false;
  const won = enemyHp <= 0;
  const battleResult = { enemy: enemy.name, won, cycles, finalHp: state.hp, enemyHp: Math.max(0, enemyHp) };
  state.stats.battleResults.push(battleResult);
  record("battle_ended", battleResult);
  if (!won) {
    finishRun(false);
    return;
  }
  state.stats.victories += 1;
  state.hp = Math.min(MAX_HP, state.hp + 2);
  if (state.wave >= ENEMIES.length - 1) {
    finishRun(true);
    return;
  }
  const type = randomType();
  state.pendingReward = makeMaterial(type, "bench");
  state.stats.rewards.push(type);
  record("material_found", { type, name: MATERIALS[type].name });
  showReward(state.pendingReward);
  scheduleSync();
}

function showReward(material) {
  const def = MATERIALS[material.type];
  $("#rewardMaterial").innerHTML = `<div class="reward-material ${def.rare ? "rare" : ""}"><span>${def.icon}</span><strong>${def.name}</strong><small>砲塔・外殻・炉で別の働き</small></div>`;
  $("#rewardDialog").showModal();
}

function takeReward() {
  if (!state.pendingReward) return;
  state.materials.push(state.pendingReward);
  const type = state.pendingReward.type;
  record("material_taken", { type });
  state.pendingReward = null;
  state.wave += 1;
  $("#rewardDialog").close();
  $("#combatLog").textContent = `${MATERIALS[type].name}を作業台へ置いた。使い道を決めよう。`;
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
  $("#endTitle").textContent = state.won ? "廃棄場の王を溶かした" : "溶接獣は停止した";
  $("#endSummary").textContent = `${state.wave + 1}/6戦・撃破${state.stats.victories}・最終耐久${state.hp}・素材${state.materials.length}個・付替${state.stats.moves}回`;
  const root = $("#finalBuild");
  root.innerHTML = "";
  ["turret", "hull", "reactor", "bench"].forEach(bay => {
    const list = mats(bay).map(m => `${MATERIALS[m.type].icon}${MATERIALS[m.type].name}`).join("、") || "なし";
    const div = document.createElement("div");
    div.textContent = `${BAY_META[bay].icon} ${BAY_META[bay].name}：${list}`;
    root.appendChild(div);
  });
  $("#endDialog").showModal();
}

function reactionLabel(kind) {
  return { hit: "きた！", choice: "迷う", insight: "ひらめいた", payoff: "うまくいった", dull: "退屈", unfair: "理不尽" }[kind] || kind;
}

function saveReaction(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const kind = String(data.get("kind") || "");
  if (!kind) return;
  const note = String(data.get("note") || "").trim();
  const e = record("moment_recorded", { kind, label: reactionLabel(kind), note });
  state.moments.push({ seq: e.seq, at: e.at, elapsedMs: e.elapsedMs, kind, label: reactionLabel(kind), phase: inBattle ? "battle" : "build", note });
  saveState();
  event.currentTarget.reset();
  $("#reactionDialog").close();
  $("#combatLog").textContent = `「${reactionLabel(kind)}」を記録した。`;
  scheduleSync();
}

function collectAnswers() {
  const data = new FormData($("#playtestForm"));
  return {
    bestMoment: String(data.get("bestMoment") || "").trim(),
    friction: String(data.get("friction") || "").trim(),
    hardChoice: String(data.get("hardChoice") || "").trim(),
    wishlist: String(data.get("wishlist") || ""),
    pivot: String(data.get("pivot") || ""),
    randomnessNote: String(data.get("randomnessNote") || "").trim(),
    replay: String(data.get("replay") || ""),
    comment: String(data.get("comment") || "").trim()
  };
}

function getDeviceId() {
  let id = localStorage.getItem("garakuta-lab-device-id");
  if (!id) {
    id = uid();
    localStorage.setItem("garakuta-lab-device-id", id);
  }
  return id;
}

function payload() {
  return {
    schemaVersion: 3, gameVersion: GAME_VERSION, runId: state.runId, telemetryRunId: state.runId,
    deviceId: getDeviceId(), startedAt: state.startedAt, endedAt: state.endedAt,
    outcome: { won: state.won, title: state.completed ? (state.won ? "廃棄場の王を溶かした" : "溶接獣は停止した") : "進行中", reached: state.wave + 1, defeated: state.stats.victories, hp: state.hp },
    build: state.materials.map(m => ({ name: MATERIALS[m.type].name, icon: MATERIALS[m.type].icon, short: `${BAY_META[m.bay].name}：${effectText(m.type, m.bay)}` })),
    stats: { ...state.stats, finalForecast: forecast(1), placements: Object.fromEntries(["turret", "hull", "reactor", "bench"].map(b => [b, mats(b).map(m => m.type)])) },
    answers: state.answers || {}, moments: state.moments || [], events: state.events || [],
    client: { language: navigator.language, viewport: `${innerWidth}x${innerHeight}`, standalone: matchMedia("(display-mode: standalone)").matches }
  };
}

let syncTimer;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 700);
}

async function syncNow() {
  $("#syncStatus").textContent = "送信中";
  try {
    const response = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    $("#syncStatus").textContent = "記録済";
  } catch (_) {
    $("#syncStatus").textContent = "端末保存";
  }
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
  record("run_started", { version: GAME_VERSION, initial: state.materials });
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
$("#takeReward").addEventListener("click", takeReward);
$("#playtestForm").addEventListener("submit", submitReport);
$("#newRunButton").addEventListener("click", newRun);
$("#cancelSelection").addEventListener("click", () => { selectedId = null; render(); });
document.querySelectorAll("[data-move]").forEach(button => button.addEventListener("click", () => moveSelected(button.dataset.move)));
addEventListener("online", syncNow);

state = loadState();
if (!state.events.length) record("run_started", { version: GAME_VERSION, initial: state.materials });
render();
if (state.completed) showEnd();
else if (state.pendingReward) showReward(state.pendingReward);
else scheduleSync();
