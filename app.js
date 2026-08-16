const PARTS = {
  spark: {
    name: "火花ノズル", icon: "✦", short: "小攻撃＋発電", tags: ["攻撃", "電力"],
    desc: "2ダメージを与え、電力を1得る。いつ置いても最低限働く。",
    run: () => ({ damage: 2, power: 1, text: "火花が敵を削り、電力を拾った" })
  },
  furnace: {
    name: "暴走炉", icon: "♨", short: "熱で威力上昇", tags: ["攻撃", "熱"],
    desc: "熱を2増やし、現在の熱に応じて1〜6ダメージ。冷やしても溜めても使える。",
    run: s => ({ damage: Math.min(6, 1 + Math.floor((s.heat + 2) / 2)), heat: 2, text: "炉が赤熱して殴りかかった" })
  },
  turbine: {
    name: "廃熱タービン", icon: "✺", short: "熱を発電へ", tags: ["熱", "電力", "冷却"],
    desc: "熱を1冷まし、電力を2得る。熱が4以上なら、さらに電力＋1。",
    run: s => ({ power: 2 + (s.heat >= 4 ? 1 : 0), cool: 1, text: "廃熱でタービンが回った" })
  },
  ram: {
    name: "電磁ラム", icon: "➤", short: "電力を打撃へ", tags: ["攻撃", "電力"],
    desc: "3ダメージ。電力を最大3消費し、その2倍を追加する。電力ゼロでも動く。",
    run: s => {
      const used = Math.min(3, s.power);
      return { damage: 3 + used * 2, power: -used, text: `電力${used}を叩き込んだ` };
    }
  },
  plating: {
    name: "即席装甲機", icon: "⬡", short: "電力で装甲追加", tags: ["防御", "電力"],
    desc: "装甲を3得る。電力があれば1消費し、さらに装甲＋3。",
    run: s => ({ shield: 3 + (s.power > 0 ? 3 : 0), power: s.power > 0 ? -1 : 0, text: "鉄板を前面へ溶接した" })
  },
  vent: {
    name: "破裂ベント", icon: "≋", short: "冷却量で攻撃", tags: ["攻撃", "熱", "冷却"],
    desc: "熱を最大4冷まし、冷ました量＋2ダメージ。熱がなくても2ダメージ。",
    run: s => {
      const cooled = Math.min(4, s.heat);
      return { damage: 2 + cooled, cool: cooled, text: `熱${cooled}を敵へ噴きつけた` };
    }
  },
  pulse: {
    name: "熱感知パルス", icon: "◎", short: "高熱で大爆発", tags: ["攻撃", "熱", "冷却"],
    desc: "通常は2ダメージ。熱が5以上なら8ダメージを与え、熱を2冷ます。",
    run: s => s.heat >= 5
      ? ({ damage: 8, cool: 2, text: "高熱を検知し、衝撃波を放った" })
      : ({ damage: 2, text: "小さな探査波を放った" })
  },
  battery: {
    name: "過充電池", icon: "▣", short: "大量発電", tags: ["電力", "防御"],
    desc: "電力を4得る。作動前から電力が4以上あれば、余剰で装甲も2得る。",
    run: s => ({ power: 4, shield: s.power >= 4 ? 2 : 0, text: "電力を乱暴に詰め込んだ" })
  },
  echo: {
    name: "残響コイル", icon: "∞", short: "直前の半分を再現", tags: ["複製", "万能"],
    desc: "直前の部品が生んだ正の効果を半分再現する。先頭なら2ダメージ。",
    run: s => {
      if (!s.last) return { damage: 2, text: "残響する物がないので直接ぶつけた" };
      const half = key => Math.max(0, Math.floor((s.last[key] || 0) / 2));
      return { damage: half("damage"), power: half("power"), heat: half("heat"), shield: half("shield"), heal: half("heal"), text: "直前の動作を弱く反響した" };
    }
  },
  recycler: {
    name: "小型再生機", icon: "♲", short: "少しずつ全体改善", tags: ["回復", "電力", "冷却"],
    desc: "HPを1回復し、電力を1得て、熱を1冷ます。地味だが腐らない。",
    run: () => ({ heal: 1, power: 1, cool: 1, text: "端材を全身へ配り直した" })
  },
  prism: {
    name: "装甲プリズム", icon: "◇", short: "装甲を攻撃へ", tags: ["攻撃", "防御"],
    desc: "2ダメージ。装甲があれば最大3消費し、その2倍を追加する。",
    run: s => {
      const used = Math.min(3, s.shield);
      return { damage: 2 + used * 2, shield: -used, text: `装甲${used}を光弾へ変えた` };
    }
  },
  mine: {
    name: "時限ボルト", icon: "◉", short: "2回ごとに爆発", tags: ["攻撃", "蓄積"],
    desc: "奇数回は2ダメージ、偶数回は11ダメージ。爆発後はまた2ダメージに戻る。",
    run: s => {
      const count = (s.uses[s.instanceId] || 0) + 1;
      s.uses[s.instanceId] = count;
      return count % 2 === 0
        ? ({ damage: 11, text: "ボルトが時間差で大爆発した" })
        : ({ damage: 2, text: "敵へ時限ボルトを打ち込んだ" });
    }
  },
  leech: {
    name: "吸着ドリル", icon: "⌾", short: "攻撃しながら防御", tags: ["攻撃", "防御"],
    desc: "3ダメージを与え、装甲を2得る。派手ではないが一つで攻防を担う。",
    run: () => ({ damage: 3, shield: 2, text: "削った破片を装甲へ貼り付けた" })
  },
  unstable: {
    name: "違法砲身", icon: "‼", short: "雑に強い不安定砲", tags: ["攻撃", "熱", "レア"],
    desc: "5〜11ダメージを与え、熱＋2。現在、熱そのものによるペナルティはない。",
    rare: true,
    run: () => ({ damage: 5 + Math.floor(Math.random() * 7), heat: 2, text: "違法砲身が轟音とともに暴れた" })
  }
};

const ENEMIES = [
  { name: "スクラップ・ラット", face: "●", hp: 22, atk: 3, armor: 0, trait: "標準型。まず動作を確かめる相手。" },
  { name: "切断ドローン", face: "✕", hp: 34, atk: 5, armor: 0, trait: "攻撃力が高い。防御か速攻が欲しい。" },
  { name: "鋳鉄クラブ", face: "▰", hp: 43, atk: 5, armor: 2, trait: "装甲2。小さい攻撃を軽減する。" },
  { name: "焼却監視機", face: "▲", hp: 56, atk: 7, armor: 0, heat: 1, trait: "攻撃のたび、こちらの熱を1増やす。" },
  { name: "暴走ジャガー", face: "◆", hp: 72, atk: 7, armor: 1, rage: 2, trait: "各巡回で攻撃力＋2。長期戦ほど危険。" },
  { name: "廃都の中枢", face: "◈", hp: 94, atk: 10, armor: 2, rage: 1, trait: "装甲2・攻撃上昇。寄せ集めの最終試験。" }
];

const GAME_VERSION = "observe-0.2";
const TELEMETRY_SCHEMA = 2;
const SAVE_KEY = "garakuta-lab-save";
const REPORTS_KEY = "garakuta-lab-run-reports";
const SYNC_QUEUE_KEY = "garakuta-lab-sync-queue";
const MAX_LOCAL_REPORTS = 5;

const $ = selector => document.querySelector(selector);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

let state;
let selectedInventory = null;
let selectedSlot = null;
let inBattle = false;
let battle = null;
let currentPhase = "build";
let syncTimer = null;

function makePart(type) { return { id: uid(), type }; }

function weightedType(exclude = []) {
  const common = Object.keys(PARTS).filter(k => !PARTS[k].rare && !exclude.includes(k));
  const rares = Object.keys(PARTS).filter(k => PARTS[k].rare && !exclude.includes(k));
  const pool = Math.random() < 0.12 && rares.length ? rares : common;
  return pool[Math.floor(Math.random() * pool.length)];
}

function newRunStats() {
  return {
    startedAt: new Date().toISOString(), battles: 0, victories: 0,
    rewards: [], skippedRewards: 0, scrappedParts: [], repairs: 0
  };
}

function newTelemetry() {
  return {
    schemaVersion: TELEMETRY_SCHEMA,
    gameVersion: GAME_VERSION,
    runId: crypto.randomUUID ? crypto.randomUUID() : uid(),
    sequence: 0,
    events: [],
    moments: [],
    syncState: "local"
  };
}

function newState() {
  const types = [];
  while (types.length < 8) types.push(weightedType(types));
  return {
    version: 3, wave: 0, hp: 30, maxHp: 30, scrap: 1,
    inventory: types.map(makePart), slots: [null, null, null, null, null], completed: false,
    stats: newRunStats(), lastReport: null, telemetry: newTelemetry()
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if ([1, 2, 3].includes(saved?.version)) {
      return {
        ...saved,
        version: 3,
        stats: { ...newRunStats(), ...(saved.stats || {}) },
        lastReport: saved.lastReport || null,
        telemetry: saved.telemetry || newTelemetry()
      };
    }
  } catch (_) {}
  return newState();
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function partRef(instance) {
  if (!instance) return null;
  return { id: instance.id, type: instance.type, name: getPart(instance)?.name || instance.type };
}

function snapshot(extra = {}) {
  return {
    phase: currentPhase,
    wave: state.wave,
    hp: state.hp,
    maxHp: state.maxHp,
    scrap: state.scrap,
    inventory: state.inventory.map(partRef),
    slots: state.slots.map(partRef),
    battle: battle ? {
      cycle: battle.cycle,
      hp: battle.hp,
      power: battle.power,
      heat: battle.heat,
      shield: battle.shield,
      enemy: battle.enemy.name,
      enemyHp: battle.enemyHp,
      uses: { ...battle.uses }
    } : null,
    ...extra
  };
}

function recordEvent(type, detail = {}, includeSnapshot = true) {
  if (!state.telemetry) state.telemetry = newTelemetry();
  const event = {
    seq: ++state.telemetry.sequence,
    at: new Date().toISOString(),
    elapsedMs: Date.now() - new Date(state.stats.startedAt).getTime(),
    type,
    detail
  };
  if (includeSnapshot) event.state = snapshot();
  state.telemetry.events.push(event);
  return event;
}

function phaseName() {
  if (currentPhase === "battle") return "戦闘中";
  if (currentPhase === "reward") return "報酬選択";
  if (currentPhase === "end") return "ラン終了";
  return "構築中";
}

function getPart(instance) { return instance ? PARTS[instance.type] : null; }

function renderPartCard(instance, index) {
  const p = getPart(instance);
  const button = document.createElement("button");
  button.className = `part-card ${selectedInventory === index ? "selected" : ""}`;
  button.innerHTML = `<span class="part-icon">${p.icon}</span><strong>${p.name}</strong><p>${p.desc}</p><span class="part-tags">${p.tags.map(t => `<i>${t}</i>`).join("")}</span>`;
  button.addEventListener("click", () => selectInventory(index));
  return button;
}

function render() {
  const enemy = ENEMIES[Math.min(state.wave, ENEMIES.length - 1)];
  $("#waveLabel").textContent = String(state.wave + 1).padStart(2, "0");
  $("#hpText").textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;
  $("#hpBar").style.width = `${clamp(state.hp / state.maxHp * 100, 0, 100)}%`;
  $("#scrapText").textContent = state.scrap;
  $("#repairButton").disabled = state.scrap < 1 || state.hp >= state.maxHp || inBattle;

  if (!inBattle) {
    $("#powerText").textContent = "0";
    $("#heatText").textContent = "0";
    $("#shieldText").textContent = "0";
    $("#enemyName").textContent = enemy.name;
    $("#enemyFace").textContent = enemy.face;
    $("#enemyStats").textContent = `攻撃 ${enemy.atk} / 装甲 ${enemy.armor || 0}`;
    $("#enemyTrait").textContent = `特徴：${enemy.trait}`;
    $("#enemyHpText").textContent = `${enemy.hp} / ${enemy.hp}`;
    $("#enemyHpBar").style.width = "100%";
  }

  const slots = $("#machineSlots");
  slots.innerHTML = "";
  state.slots.forEach((instance, i) => {
    const part = getPart(instance);
    const button = document.createElement("button");
    button.className = `machine-slot ${part ? "filled" : ""} ${selectedSlot === i ? "selected" : ""} ${selectedInventory !== null ? "pending" : ""}`;
    button.dataset.slot = i;
    button.innerHTML = part
      ? `<span class="slot-number">0${i + 1}</span><span class="part-icon">${part.icon}</span><span class="part-name">${part.name}</span><span class="part-short">${part.short}</span>`
      : `<span class="slot-number">0${i + 1}</span><span class="part-icon empty-mark">＋</span><span class="part-name">空き</span>`;
    button.disabled = inBattle;
    button.addEventListener("click", () => clickSlot(i));
    slots.appendChild(button);
  });

  const inventory = $("#inventory");
  inventory.innerHTML = "";
  state.inventory.forEach((instance, i) => inventory.appendChild(renderPartCard(instance, i)));
  if (!state.inventory.length) inventory.innerHTML = `<p class="build-hint">予備部品はありません。</p>`;

  $("#slotControls").classList.toggle("hidden", selectedSlot === null || inBattle);
  $("#selectedInspector").classList.toggle("hidden", (selectedInventory === null && selectedSlot === null) || inBattle);
  $("#battleButton").disabled = inBattle || state.slots.every(x => !x);
  $("#battleButton").textContent = inBattle ? "作動中…" : "このガラクタで戦う";
  renderInspector();
}

function selectInventory(index) {
  if (inBattle) return;
  selectedInventory = selectedInventory === index ? null : index;
  selectedSlot = null;
  recordEvent("part_inspected", { part: selectedInventory === null ? null : partRef(state.inventory[selectedInventory]) }, false);
  render();
}

function renderInspector() {
  const box = $("#selectedInspector");
  if (selectedInventory === null) {
    const instance = selectedSlot === null ? null : state.slots[selectedSlot];
    if (!instance) {
      box.innerHTML = "";
      return;
    }
    const p = getPart(instance);
    box.innerHTML = `<strong>${p.icon} ${p.name}</strong><p>${p.desc}</p><div class="part-tags">${p.tags.map(t => `<i>${t}</i>`).join("")}</div>`;
    return;
  }
  const instance = state.inventory[selectedInventory];
  const p = getPart(instance);
  box.innerHTML = `<strong>${p.icon} ${p.name}</strong><p>装着先を上の駆動列から選んでください。不要なら分解して、修復材にできます。</p><div class="inspector-actions"><button id="scrapSelected">分解して ◆1</button><button id="cancelSelected">選択解除</button></div>`;
  $("#scrapSelected").addEventListener("click", () => {
    const removed = state.inventory.splice(selectedInventory, 1)[0];
    state.scrap += 1;
    state.stats.scrappedParts.push(p.name);
    selectedInventory = null;
    recordEvent("part_scrapped", { part: partRef(removed), scrapGained: 1 });
    saveState(); render();
    setLog(`${p.name}を分解し、修復材を1得た。`);
  });
  $("#cancelSelected").addEventListener("click", () => { selectedInventory = null; render(); });
}

function clickSlot(index) {
  if (inBattle) return;
  if (selectedInventory !== null) {
    const incoming = state.inventory.splice(selectedInventory, 1)[0];
    const outgoing = state.slots[index];
    state.slots[index] = incoming;
    if (outgoing) state.inventory.push(outgoing);
    const name = getPart(incoming).name;
    selectedInventory = null;
    selectedSlot = index;
    recordEvent("slot_changed", { slot: index, incoming: partRef(incoming), outgoing: partRef(outgoing) });
    saveState(); render();
    setLog(`${name}をスロット${index + 1}へ装着。`);
    return;
  }
  selectedSlot = selectedSlot === index ? null : index;
  render();
}

function moveSlot(direction) {
  if (selectedSlot === null) return;
  const from = selectedSlot;
  if (direction === "remove") {
    const removed = state.slots[selectedSlot];
    if (removed) state.inventory.push(removed);
    state.slots[selectedSlot] = null;
    selectedSlot = null;
    recordEvent("slot_removed", { slot: from, part: partRef(removed) });
  } else {
    const target = selectedSlot + (direction === "left" ? -1 : 1);
    if (target < 0 || target >= state.slots.length) return;
    [state.slots[selectedSlot], state.slots[target]] = [state.slots[target], state.slots[selectedSlot]];
    selectedSlot = target;
    recordEvent("slots_swapped", { from, to: target });
  }
  saveState(); render();
}

function setLog(text) { $("#combatLog").textContent = text; }

function updateBattleUI() {
  $("#hpText").textContent = `${Math.max(0, Math.ceil(battle.hp))} / ${state.maxHp}`;
  $("#hpBar").style.width = `${clamp(battle.hp / state.maxHp * 100, 0, 100)}%`;
  $("#powerText").textContent = battle.power;
  $("#heatText").textContent = battle.heat;
  $("#shieldText").textContent = battle.shield;
  $("#enemyHpText").textContent = `${Math.max(0, Math.ceil(battle.enemyHp))} / ${battle.enemy.hp}`;
  $("#enemyHpBar").style.width = `${clamp(battle.enemyHp / battle.enemy.hp * 100, 0, 100)}%`;
}

function applyDelta(delta) {
  const armor = battle.enemy.armor || 0;
  const rawDamage = Math.max(0, delta.damage || 0);
  const actualDamage = rawDamage > 0 ? Math.max(1, rawDamage - armor) : 0;
  battle.enemyHp -= actualDamage;
  battle.power = Math.max(0, battle.power + (delta.power || 0));
  battle.heat = Math.max(0, battle.heat + (delta.heat || 0) - (delta.cool || 0));
  battle.shield = Math.max(0, battle.shield + (delta.shield || 0));
  battle.hp = Math.min(state.maxHp, battle.hp + (delta.heal || 0));
  return actualDamage;
}

async function startBattle() {
  if (inBattle || state.slots.every(x => !x)) return;
  inBattle = true;
  selectedInventory = null;
  selectedSlot = null;
  const enemyBase = ENEMIES[Math.min(state.wave, ENEMIES.length - 1)];
  battle = {
    hp: state.hp, power: 0, heat: 0, shield: 0, enemyHp: enemyBase.hp,
    enemy: { ...enemyBase }, uses: {}, last: null, cycle: 0
  };
  currentPhase = "battle";
  state.stats.battles += 1;
  recordEvent("battle_started", {
    enemy: { name: battle.enemy.name, hp: battle.enemy.hp, atk: battle.enemy.atk, armor: battle.enemy.armor || 0 },
    build: state.slots.map(partRef)
  });
  saveState();
  render(); updateBattleUI();
  $("#enemyName").textContent = battle.enemy.name;
  $("#enemyFace").textContent = battle.enemy.face;
  $("#enemyStats").textContent = `攻撃 ${battle.enemy.atk} / 装甲 ${battle.enemy.armor || 0}`;
  $("#enemyTrait").textContent = `特徴：${battle.enemy.trait}`;
  setLog("駆動開始。左から順に部品が作動する。");
  await sleep(500);

  while (battle.hp > 0 && battle.enemyHp > 0 && battle.cycle < 12) {
    battle.cycle += 1;
    for (let i = 0; i < state.slots.length; i += 1) {
      const instance = state.slots[i];
      if (!instance) continue;
      const p = getPart(instance);
      const slotEl = document.querySelector(`[data-slot="${i}"]`);
      slotEl?.classList.add("active");
      const context = { ...battle, instanceId: instance.id };
      const before = snapshot().battle;
      const delta = p.run(context);
      battle.uses = context.uses;
      const actual = applyDelta(delta);
      battle.last = { ...delta, damage: actual };
      recordEvent("part_resolved", {
        cycle: battle.cycle, slot: i, part: partRef(instance), before,
        delta: { ...delta }, actualDamage: actual
      });
      setLog(`巡回${battle.cycle} / ${p.name}：${delta.text}${actual ? `（${actual}ダメージ）` : ""}`);
      updateBattleUI();
      if (actual) $("#enemyFace").classList.add("hit-flash");
      await sleep(370);
      $("#enemyFace").classList.remove("hit-flash");
      slotEl?.classList.remove("active");
      if (battle.enemyHp <= 0) break;
    }
    if (battle.enemyHp <= 0) break;

    let attack = battle.enemy.atk + (battle.enemy.rage || 0) * (battle.cycle - 1);
    const blocked = Math.min(battle.shield, attack);
    battle.shield -= blocked;
    attack -= blocked;
    battle.hp -= attack;
    battle.heat += battle.enemy.heat || 0;
    recordEvent("enemy_attacked", {
      cycle: battle.cycle, enemy: battle.enemy.name, baseAttack: battle.enemy.atk,
      blocked, hpDamage: attack, heatAdded: battle.enemy.heat || 0
    });
    setLog(`${battle.enemy.name}の反撃：装甲で${blocked}防ぎ、HPへ${attack}ダメージ。`);
    updateBattleUI();
    $(".machine-face").classList.add("hit-flash");
    await sleep(520);
    $(".machine-face").classList.remove("hit-flash");
  }

  state.hp = Math.max(0, Math.ceil(battle.hp));
  inBattle = false;
  recordEvent("battle_ended", {
    won: battle.enemyHp <= 0, cycles: battle.cycle, finalHp: state.hp,
    enemyHp: Math.max(0, battle.enemyHp), power: battle.power, heat: battle.heat, shield: battle.shield
  });
  if (battle.enemyHp <= 0) await winBattle();
  else loseBattle();
}

async function winBattle() {
  setLog(`${battle.enemy.name}を撃破。機械の残りHPは${state.hp}。`);
  state.stats.victories += 1;
  state.hp = Math.min(state.maxHp, state.hp + 3);
  if (state.wave >= ENEMIES.length - 1) {
    state.completed = true;
    saveState(); render();
    showRunEnd(true);
    return;
  }
  state.wave += 1;
  currentPhase = "build";
  saveState(); render();
  await sleep(650);
  showRewards();
}

function loseBattle() {
  saveState(); render();
  showRunEnd(false);
}

function showRewards() {
  currentPhase = "reward";
  const types = [];
  while (types.length < 3) types.push(weightedType(types));
  recordEvent("reward_offered", { types, parts: types.map(type => PARTS[type].name) });
  saveState();
  const box = $("#rewardChoices");
  box.innerHTML = "";
  types.forEach(type => {
    const p = PARTS[type];
    const button = document.createElement("button");
    button.className = "reward-card";
    button.innerHTML = `<span class="part-icon">${p.icon}</span><strong>${p.name}</strong><p>${p.desc}</p><span class="part-tags">${p.tags.map(t => `<i>${t}</i>`).join("")}</span>`;
    button.addEventListener("click", () => {
      const instance = makePart(type);
      state.inventory.push(instance);
      state.stats.rewards.push(p.name);
      currentPhase = "build";
      recordEvent("reward_chosen", { part: partRef(instance), offeredTypes: types });
      saveState();
      $("#rewardDialog").close();
      render();
      setLog(`${p.name}を拾った。今の機械へどう混ぜる？`);
    });
    box.appendChild(button);
  });
  $("#rewardDialog").showModal();
}

function makeRunReport(won) {
  const title = won ? "廃都の中枢を停止した" : "機械は停止した";
  const summary = won
    ? `拾い物だけの機械が、全${ENEMIES.length}戦を生き延びました。最後のHP：${state.hp}。`
    : `${state.wave + 1}戦目で停止。今ある部品の別の並べ方を試せるでしょうか。`;
  return {
    id: state.telemetry.runId, runId: state.telemetry.runId,
    gameVersion: GAME_VERSION, schemaVersion: TELEMETRY_SCHEMA,
    endedAt: new Date().toISOString(), won, title, summary,
    reached: won ? ENEMIES.length : state.wave + 1,
    defeated: state.stats.victories,
    hp: state.hp,
    build: state.slots.map(instance => {
      const part = getPart(instance);
      return part ? { name: part.name, icon: part.icon, short: part.short } : null;
    }),
    stats: JSON.parse(JSON.stringify(state.stats)),
    answers: {}
  };
}

function buildRows(report) {
  return report.build.map((part, index) => part
    ? `<div class="report-part"><span class="order">0${index + 1}</span><span class="part-icon">${part.icon}</span><span><strong>${part.name}</strong><small>${part.short}</small></span></div>`
    : `<div class="report-part empty"><span class="order">0${index + 1}</span><span class="part-icon">＋</span><span><strong>空き</strong><small>部品なし</small></span></div>`
  ).join("");
}

function factsHtml(report) {
  return `<div class="run-fact"><strong>${report.reached}/${ENEMIES.length}</strong><small>到達戦</small></div>
    <div class="run-fact"><strong>${report.hp}</strong><small>最終HP</small></div>
    <div class="run-fact"><strong>${report.stats.rewards.length}</strong><small>拾った部品</small></div>`;
}

function fillReportForm(answers = {}) {
  const form = $("#playtestForm");
  ["bestMoment", "friction", "hardChoice", "wishlist", "pivot", "randomnessNote", "comment"].forEach(name => {
    const field = form.elements[name];
    if (field) field.value = answers[name] || "";
  });
  form.querySelectorAll('[name="replay"]').forEach(input => {
    input.checked = input.value === String(answers.replay || "");
  });
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
    comment: String(data.get("comment") || "").trim(),
    replay: String(data.get("replay") || "")
  };
}

function getDeviceId() {
  let id = localStorage.getItem("garakuta-lab-device-id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : uid();
    localStorage.setItem("garakuta-lab-device-id", id);
  }
  return id;
}

function payloadForReport(report) {
  return {
    schemaVersion: TELEMETRY_SCHEMA,
    gameVersion: GAME_VERSION,
    runId: report.runId || report.id,
    telemetryRunId: state.telemetry.runId,
    deviceId: getDeviceId(),
    startedAt: state.stats.startedAt,
    endedAt: report.endedAt,
    outcome: {
      won: report.won, title: report.title, reached: report.reached,
      defeated: report.defeated, hp: report.hp
    },
    build: report.build,
    stats: report.stats,
    answers: report.answers || {},
    moments: state.telemetry.moments || [],
    events: state.telemetry.events || [],
    client: {
      language: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      standalone: window.matchMedia("(display-mode: standalone)").matches
    }
  };
}

function readSyncQueue() {
  try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY)) || []; } catch (_) { return []; }
}

function writeSyncQueue(queue) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue.slice(-12)));
  updateSyncStatus(queue.length ? "pending" : "synced", queue.length);
}

function queuePayload(payload) {
  const queue = readSyncQueue();
  const next = [...queue.filter(item => item.runId !== payload.runId), payload];
  writeSyncQueue(next);
}

function updateSyncStatus(status, count = readSyncQueue().length) {
  const element = $("#syncStatus");
  if (!element) return;
  element.className = `sync-status ${status}`;
  if (status === "synced") element.textContent = "クラウド保存済み";
  else if (status === "syncing") element.textContent = "保存中…";
  else element.textContent = `端末保存・未同期${count}`;
  if ($("#reportStatus") && currentPhase === "end") {
    $("#reportStatus").textContent = status === "synced"
      ? "プレイ記録と回答をクラウドへ保存しました。"
      : status === "syncing" ? "プレイ記録を保存しています…" : "端末へ保存済み。オンライン時に自動送信します。";
  }
}

async function syncPendingRuns() {
  const queue = readSyncQueue();
  if (!queue.length || !navigator.onLine) {
    updateSyncStatus(queue.length ? "pending" : "synced", queue.length);
    return;
  }
  updateSyncStatus("syncing", queue.length);
  const remaining = [];
  for (const payload of queue) {
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`save failed: ${response.status}`);
    } catch (_) {
      remaining.push(payload);
    }
  }
  writeSyncQueue(remaining);
}

function scheduleSync(report, delay = 900) {
  // Capture the finished run now. `state` is replaced as soon as a new run begins.
  const payload = payloadForReport(report);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    archivePayload(payload);
    queuePayload(payload);
    syncPendingRuns();
  }, delay);
}

function archivePayload(archived) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem(REPORTS_KEY)) || []; } catch (_) {}
  history = [archived, ...history.filter(item => item.runId !== archived.runId)].slice(0, MAX_LOCAL_REPORTS);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(history));
}

function archiveReport(report) {
  archivePayload(payloadForReport(report));
}

function saveReportAnswers(message = "回答をこの端末へ保存しました。") {
  if (!state.lastReport) return;
  state.lastReport.answers = collectAnswers();
  saveState();
  $("#reportStatus").textContent = message;
  scheduleSync(state.lastReport);
}

function showRunEnd(won) {
  currentPhase = "end";
  if (!state.telemetry.endedAt) {
    state.telemetry.endedAt = new Date().toISOString();
    recordEvent("run_ended", { won, reached: won ? ENEMIES.length : state.wave + 1, hp: state.hp });
  }
  if (!state.lastReport) state.lastReport = makeRunReport(won);
  const report = state.lastReport;
  $("#runEndTitle").textContent = report.title;
  $("#runEndSummary").textContent = report.summary;
  $("#runFacts").innerHTML = factsHtml(report);
  $("#finalBuild").innerHTML = buildRows(report);
  const moments = state.telemetry.moments || [];
  $("#momentSummary").textContent = moments.length
    ? `途中で記録した感情：${moments.map(moment => moment.label).join("・")}`
    : "途中の感情記録はありません。";
  fillReportForm(report.answers);
  saveState();
  archiveReport(report);
  scheduleSync(report, 50);
  if (!$("#runEndDialog").open) $("#runEndDialog").showModal();
}

function reportText(report) {
  const answers = report.answers || {};
  const build = report.build.map((part, index) => `${index + 1}. ${part ? `${part.icon} ${part.name}` : "空き"}`).join("\n");
  return [
    "ガラクタ・ラボ プレイテスト",
    `結果: ${report.title}`,
    `到達: ${report.reached}/${ENEMIES.length}戦 / 撃破${report.defeated} / 最終HP ${report.hp}`,
    `最終駆動列:\n${build}`,
    `拾った部品: ${report.stats.rewards.join("、") || "なし"}`,
    `報酬全分解: ${report.stats.skippedRewards}回 / 修理: ${report.stats.repairs}回`,
    `一番気持ちよかった瞬間:\n${answers.bestMoment || "未回答"}`,
    `面倒・退屈・理不尽だった瞬間:\n${answers.friction || "未回答"}`,
    `本気で迷った選択:\n${answers.hardChoice || "未回答"}`,
    `欲しい部品待ち: ${answers.wishlist || "未回答"}`,
    `偶然の部品で方針転換: ${answers.pivot || "未回答"}`,
    `補足: ${answers.randomnessNote || "なし"}`,
    `もう一度遊びたい度: ${answers.replay || "未回答"}/5`,
    `コメント: ${answers.comment || "なし"}`,
    `途中の感情: ${(state.telemetry.moments || []).map(moment => `${moment.label}${moment.note ? `（${moment.note}）` : ""}`).join("、") || "なし"}`
  ].join("\n\n");
}

async function copyReport() {
  saveReportAnswers("コピーを準備しています…");
  const text = reportText(state.lastReport);
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  $("#reportStatus").textContent = "コピーしました。このチャットへ貼り付けてください。";
}

function showScreenshotReport() {
  saveReportAnswers();
  const report = state.lastReport;
  const signals = report.answers || {};
  $("#screenshotCard").innerHTML = `<p class="eyebrow">GARAKUTA LAB / RUN REPORT</p>
    <h2>${report.title}</h2>
    <p class="report-date">${new Date(report.endedAt).toLocaleString("ja-JP")}</p>
    <div class="run-facts">${factsHtml(report)}</div>
    <div class="report-build">${buildRows(report)}</div>
    <div class="screenshot-signals">
      <div><strong>${signals.wishlist || "–"}</strong><small>欲しい物待ち</small></div>
      <div><strong>${signals.pivot || "–"}</strong><small>方針転換</small></div>
      <div><strong>${signals.replay || "–"}/5</strong><small>もう一度</small></div>
    </div>`;
  $("#runEndDialog").close();
  $("#screenshotDialog").showModal();
}

function openReactionDialog() {
  $("#reactionNote").value = "";
  if (!$("#reactionDialog").open) $("#reactionDialog").showModal();
}

function markReaction(button) {
  const kind = button.dataset.reaction;
  const label = button.dataset.label;
  const note = $("#reactionNote").value.trim();
  const event = recordEvent("emotion_marked", { kind, label, note, phase: currentPhase, phaseLabel: phaseName() });
  state.telemetry.moments.push({ seq: event.seq, at: event.at, elapsedMs: event.elapsedMs, kind, label, note, phase: currentPhase });
  saveState();
  if (state.lastReport) {
    archiveReport(state.lastReport);
    scheduleSync(state.lastReport, 120);
  }
  $("#reactionDialog").close();
  setLog(`「${label}」を${phaseName()}の記録へ残した。`);
}

function newRun() {
  if (state.lastReport) {
    saveReportAnswers();
    archiveReport(state.lastReport);
  }
  state = newState();
  currentPhase = "build";
  selectedInventory = null;
  selectedSlot = null;
  battle = null;
  recordEvent("run_started", { initialInventory: state.inventory.map(partRef), source: "new_run" });
  saveState();
  $("#runEndDialog").close();
  if ($("#screenshotDialog").open) $("#screenshotDialog").close();
  render();
  setLog("新しいガラクタが届いた。完成図はない。");
}

function registerEvents() {
  $("#battleButton").addEventListener("click", startBattle);
  $("#slotControls").addEventListener("click", e => {
    const action = e.target.dataset.action;
    if (action) moveSlot(action);
  });
  $("#repairButton").addEventListener("click", () => {
    if (state.scrap < 1 || state.hp >= state.maxHp) return;
    state.scrap -= 1;
    state.hp = Math.min(state.maxHp, state.hp + 5);
    state.stats.repairs += 1;
    recordEvent("repaired", { scrapSpent: 1, hpGained: 5 });
    saveState(); render(); setLog("修復材を使い、HPを5回復した。");
  });
  $("#helpButton").addEventListener("click", () => $("#helpDialog").showModal());
  $("#closeHelp").addEventListener("click", () => $("#helpDialog").close());
  $("#skipReward").addEventListener("click", () => {
    state.scrap += 2; state.stats.skippedRewards += 1; currentPhase = "build";
    recordEvent("reward_scrapped", { scrapGained: 2 });
    saveState(); $("#rewardDialog").close(); render();
    setLog("候補をすべて分解し、修復材を2得た。");
  });
  $("#playtestForm").addEventListener("input", () => saveReportAnswers());
  $("#playtestForm").addEventListener("change", () => saveReportAnswers());
  $("#copyReportButton").addEventListener("click", copyReport);
  $("#screenshotButton").addEventListener("click", showScreenshotReport);
  $("#closeScreenshot").addEventListener("click", () => {
    $("#screenshotDialog").close();
    $("#runEndDialog").showModal();
  });
  $("#newRunButton").addEventListener("click", newRun);
  $("#reactionButton").addEventListener("click", openReactionDialog);
  document.querySelectorAll("[data-open-reaction]").forEach(button => button.addEventListener("click", openReactionDialog));
  $("#closeReaction").addEventListener("click", () => $("#reactionDialog").close());
  $("#reactionChoices").addEventListener("click", event => {
    const button = event.target.closest("[data-reaction]");
    if (button) markReaction(button);
  });
  window.addEventListener("online", syncPendingRuns);
}

state = loadState();
if (!state.telemetry.events.length) {
  recordEvent("run_started", { initialInventory: state.inventory.map(partRef), source: "loaded_or_migrated" });
  saveState();
}
registerEvents();
render();
updateSyncStatus(readSyncQueue().length ? "pending" : "synced");
syncPendingRuns();
if (state.completed || state.hp <= 0 || state.lastReport) {
  showRunEnd(state.completed);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
