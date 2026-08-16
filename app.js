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
    desc: "普段は2ダメージ。2回目の作動では追加で9ダメージ。単独で完結する。",
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
    desc: "5〜11ダメージを与え、熱＋2。引いた瞬間から強いが、機械を熱くする。",
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

const $ = selector => document.querySelector(selector);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

let state;
let selectedInventory = null;
let selectedSlot = null;
let inBattle = false;
let battle = null;

function makePart(type) { return { id: uid(), type }; }

function weightedType(exclude = []) {
  const common = Object.keys(PARTS).filter(k => !PARTS[k].rare && !exclude.includes(k));
  const rares = Object.keys(PARTS).filter(k => PARTS[k].rare && !exclude.includes(k));
  const pool = Math.random() < 0.12 && rares.length ? rares : common;
  return pool[Math.floor(Math.random() * pool.length)];
}

function newState() {
  const types = [];
  while (types.length < 8) types.push(weightedType(types));
  return {
    version: 1, wave: 0, hp: 30, maxHp: 30, scrap: 1,
    inventory: types.map(makePart), slots: [null, null, null, null, null], completed: false
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("garakuta-lab-save"));
    if (saved?.version === 1) return saved;
  } catch (_) {}
  return newState();
}

function saveState() {
  localStorage.setItem("garakuta-lab-save", JSON.stringify(state));
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
  $("#selectedInspector").classList.toggle("hidden", selectedInventory === null || inBattle);
  $("#battleButton").disabled = inBattle || state.slots.every(x => !x);
  $("#battleButton").textContent = inBattle ? "作動中…" : "このガラクタで戦う";
}

function selectInventory(index) {
  if (inBattle) return;
  selectedInventory = selectedInventory === index ? null : index;
  selectedSlot = null;
  render();
  renderInspector();
}

function renderInspector() {
  const box = $("#selectedInspector");
  if (selectedInventory === null) return;
  const instance = state.inventory[selectedInventory];
  const p = getPart(instance);
  box.innerHTML = `<strong>${p.icon} ${p.name}</strong><p>装着先を上の駆動列から選んでください。不要なら分解して、修復材にできます。</p><div class="inspector-actions"><button id="scrapSelected">分解して ◆1</button><button id="cancelSelected">選択解除</button></div>`;
  $("#scrapSelected").addEventListener("click", () => {
    state.inventory.splice(selectedInventory, 1);
    state.scrap += 1;
    selectedInventory = null;
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
    saveState(); render();
    setLog(`${name}をスロット${index + 1}へ装着。`);
    return;
  }
  selectedSlot = selectedSlot === index ? null : index;
  render();
}

function moveSlot(direction) {
  if (selectedSlot === null) return;
  if (direction === "remove") {
    const removed = state.slots[selectedSlot];
    if (removed) state.inventory.push(removed);
    state.slots[selectedSlot] = null;
    selectedSlot = null;
  } else {
    const target = selectedSlot + (direction === "left" ? -1 : 1);
    if (target < 0 || target >= state.slots.length) return;
    [state.slots[selectedSlot], state.slots[target]] = [state.slots[target], state.slots[selectedSlot]];
    selectedSlot = target;
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
  render(); updateBattleUI();
  $("#enemyName").textContent = battle.enemy.name;
  $("#enemyFace").textContent = battle.enemy.face;
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
      const delta = p.run(context);
      battle.uses = context.uses;
      const actual = applyDelta(delta);
      battle.last = { ...delta, damage: actual };
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
    setLog(`${battle.enemy.name}の反撃：装甲で${blocked}防ぎ、HPへ${attack}ダメージ。`);
    updateBattleUI();
    $(".machine-face").classList.add("hit-flash");
    await sleep(520);
    $(".machine-face").classList.remove("hit-flash");
  }

  state.hp = Math.max(0, Math.ceil(battle.hp));
  inBattle = false;
  if (battle.enemyHp <= 0) await winBattle();
  else loseBattle();
}

async function winBattle() {
  setLog(`${battle.enemy.name}を撃破。機械の残りHPは${state.hp}。`);
  state.hp = Math.min(state.maxHp, state.hp + 3);
  if (state.wave >= ENEMIES.length - 1) {
    state.completed = true;
    saveState(); render();
    $("#runEndTitle").textContent = "廃都の中枢を停止した";
    $("#runEndSummary").textContent = `拾い物だけの機械が、全${ENEMIES.length}戦を生き延びました。最後のHP：${state.hp}。`;
    $("#runEndDialog").showModal();
    return;
  }
  state.wave += 1;
  saveState(); render();
  await sleep(650);
  showRewards();
}

function loseBattle() {
  saveState(); render();
  $("#runEndTitle").textContent = "機械は停止した";
  $("#runEndSummary").textContent = `${state.wave + 1}戦目で停止。欲しい部品が来なかったからではなく、今ある部品の別の並べ方を試せるでしょうか。`;
  $("#runEndDialog").showModal();
}

function showRewards() {
  const types = [];
  while (types.length < 3) types.push(weightedType(types));
  const box = $("#rewardChoices");
  box.innerHTML = "";
  types.forEach(type => {
    const p = PARTS[type];
    const button = document.createElement("button");
    button.className = "reward-card";
    button.innerHTML = `<span class="part-icon">${p.icon}</span><strong>${p.name}</strong><p>${p.desc}</p><span class="part-tags">${p.tags.map(t => `<i>${t}</i>`).join("")}</span>`;
    button.addEventListener("click", () => {
      state.inventory.push(makePart(type));
      saveState();
      $("#rewardDialog").close();
      render();
      setLog(`${p.name}を拾った。今の機械へどう混ぜる？`);
    });
    box.appendChild(button);
  });
  $("#rewardDialog").showModal();
}

function newRun() {
  state = newState();
  selectedInventory = null;
  selectedSlot = null;
  battle = null;
  saveState();
  $("#runEndDialog").close();
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
    saveState(); render(); setLog("修復材を使い、HPを5回復した。");
  });
  $("#helpButton").addEventListener("click", () => $("#helpDialog").showModal());
  $("#closeHelp").addEventListener("click", () => $("#helpDialog").close());
  $("#skipReward").addEventListener("click", () => {
    state.scrap += 2; saveState(); $("#rewardDialog").close(); render();
    setLog("候補をすべて分解し、修復材を2得た。");
  });
  $("#newRunButton").addEventListener("click", newRun);
}

state = loadState();
registerEvents();
render();
if (state.completed || state.hp <= 0) {
  $("#runEndTitle").textContent = state.completed ? "廃都の中枢を停止した" : "機械は停止した";
  $("#runEndSummary").textContent = `前回のラン：${state.wave + 1}戦目、HP ${state.hp}。`;
  $("#runEndDialog").showModal();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
