import {
  BUILD_STAMP,
  CARS,
  MAX_CARS,
  MAX_HULL,
  MAX_STAGES,
  VERSION,
  carById,
  challengeFor,
  continueFromReport,
  createGame,
  installCar,
  moveCar,
  offersFor,
  previewTrain,
  recordMarker,
  recordSurvey,
  removeCar,
  runBattle,
  skipReward,
} from "./engine.mjs";
import {
  ensureTelemetry,
  flushScraplineTelemetryQueue,
  recordTelemetry,
  sendScraplineTelemetry,
} from "./telemetry.mjs";

const requestedSeed = querySeed();
const STORAGE_KEY = requestedSeed === null
  ? "scrapline-state-v1"
  : `scrapline-state-v1-seed-${Number(requestedSeed) >>> 0}`;
const app = document.querySelector("#app");
let state = loadState();
let selectedSlot = Number.isInteger(state.selectedSlot) ? state.selectedSlot : null;
let replayTimer = null;
let replayToken = 0;
let audioContext = null;
let dragSource = null;
let pointerDrag = null;
let suppressClickUntil = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nowIso() {
  return new Date().toISOString();
}

function stopReplay() {
  replayToken += 1;
  if (replayTimer !== null) window.clearTimeout(replayTimer);
  replayTimer = null;
}

function querySeed() {
  const raw = new URLSearchParams(location.search).get("seed");
  const parsed = raw === null || raw === "" ? null : Number(raw);
  return parsed === null || !Number.isFinite(parsed) ? null : parsed;
}

function loadState() {
  let loaded = null;
  try {
    loaded = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    loaded = null;
  }
  const expectedSeed = requestedSeed === null ? null : (Number(requestedSeed) >>> 0);
  if (!loaded || loaded.version !== VERSION || !Array.isArray(loaded.activeCars) || (expectedSeed !== null && loaded.seed !== expectedSeed)) {
    loaded = createGame(requestedSeed);
    recordTelemetry(loaded, { type: "run_started", seed: loaded.seed });
  } else {
    ensureTelemetry(loaded);
  }
  return loaded;
}

function persist() {
  state.selectedSlot = selectedSlot;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The game remains playable in private browsing; telemetry will still be
    // attempted when the survey is submitted.
  }
}

function setState(next, event = null) {
  state = next;
  ensureTelemetry(state);
  if (event) recordTelemetry(state, event);
  persist();
  render();
}

function carList(ids) {
  return ids.map((id) => carById(id));
}

function stageLabel(stage) {
  return `${Math.min(stage, MAX_STAGES)} / ${MAX_STAGES}`;
}

function phaseCopy() {
  if (state.phase === "build") return "車列を組んで発車";
  if (state.phase === "report") return "因果のショーを確認";
  if (state.phase === "reward") return "残骸から一台を拾う";
  return state.won ? "炉心を制圧した" : "列車は止まった";
}

function progressBar(value, max) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="meter" aria-label="${value} / ${max}"><span style="width:${percentage}%"></span></div>`;
}

function renderTrain() {
  const cars = carList(state.activeCars);
  const rareCount = cars.filter((car) => car.rarity === "rare").length;
  const complexity = Math.min(5, cars.length + rareCount + Math.floor(state.stage / 2));
  const slots = cars.map((car, index) => `
    <article class="train-slot ${selectedSlot === index ? "is-selected" : ""} ${car.rarity === "rare" ? "rare-slot" : ""}" data-drag-slot="${index}" draggable="true" aria-label="${escapeHtml(car.name)}。ドラッグで並べ替え">
      <button class="car-card" data-action="select-slot" data-slot="${index}" aria-pressed="${selectedSlot === index}">
        <span class="car-icon" aria-hidden="true">${car.icon}</span>
        <span class="car-name">${escapeHtml(car.name)}</span>
        <span class="car-effect">${escapeHtml(car.text)}</span>
        <span class="slot-number">車両 ${index + 1}</span>
      </button>
      <div class="drag-grip" aria-hidden="true">⠿ ドラッグ</div>
      <div class="slot-actions" aria-label="${escapeHtml(car.name)}の並び替え">
        <button class="icon-button" data-action="move-left" data-slot="${index}" ${index === 0 ? "disabled" : ""} aria-label="${escapeHtml(car.name)}を左へ">←</button>
        <button class="icon-button" data-action="move-right" data-slot="${index}" ${index === cars.length - 1 ? "disabled" : ""} aria-label="${escapeHtml(car.name)}を右へ">→</button>
        <button class="icon-button danger" data-action="remove" data-slot="${index}" ${cars.length <= 1 ? "disabled" : ""} aria-label="${escapeHtml(car.name)}を外す">×</button>
      </div>
    </article>
  `).join("");
  const empty = Array.from({ length: Math.max(0, MAX_CARS - cars.length) }, (_, index) => `
    <div class="train-slot empty-slot" aria-label="空きスロット">
      <span>空き</span><small>${cars.length + index + 1} / ${MAX_CARS}</small>
    </div>
  `).join("");
  return `
    <section class="train-panel panel" data-stage="${state.stage}" data-train-size="${cars.length}" data-complexity="${complexity}">
      <div class="panel-heading">
        <div><p class="kicker">BUILD THE CAUSE CHAIN</p><h2>車列の順番</h2></div>
        <span class="selection-hint">${selectedSlot === null ? "満車なら交換先を選択" : `交換先: 車両 ${selectedSlot + 1}`}</span>
      </div>
      <p class="muted">左が後部ホッパー、右が砲台。車両をドラッグして並べ替えます（矢印でも操作できます）。鉄塊はこの順に通ります。</p>
      <div class="train-line">
        <div class="train-end hopper"><span aria-hidden="true">◉</span><strong>ホッパー</strong><small>鉄塊 1</small></div>
        <div class="line-arrow" aria-hidden="true">›</div>
        ${slots || ""}${empty}
        <div class="line-arrow" aria-hidden="true">›</div>
        <div class="train-end cannon"><span aria-hidden="true">◎</span><strong>砲台</strong><small>発射</small></div>
      </div>
    </section>
  `;
}

function enemyPreviewMarkup(challenge) {
  const waves = (challenge.waves || []).map((wave) => `${escapeHtml(wave.name)}${wave.count > 1 ? ` ×${wave.count}` : ""}`).join(" / ");
  return `
    <div class="enemy-preview" data-kind="${escapeHtml(challenge.kind)}">
      <div class="enemy-preview-lane"><span class="enemy-track-line" aria-hidden="true"></span><span class="enemy-sprite" aria-hidden="true">${escapeHtml(challenge.icon || "⚠")}</span><span class="enemy-target" aria-hidden="true">列車</span></div>
      <div class="enemy-preview-copy"><span class="enemy-preview-label">敵の動き</span><strong>${escapeHtml(challenge.motion || challenge.text)}</strong><small>${waves}</small></div>
    </div>
  `;
}

function previewVisualMarkup(preview) {
  const nodes = state.activeCars.map((id, index) => {
    const car = carById(id);
    const event = preview.events[index];
    return `<span class="preview-machine ${event ? "has-effect" : ""}" style="--machine-index:${index}"><b>${escapeHtml(car.icon)}</b><small>${escapeHtml(car.name)}</small></span>`;
  }).join("");
  const level = Math.max(1, Math.min(5, preview.projectiles?.length || 1));
  const visibleProjectiles = (preview.projectiles || []).slice(0, 8);
  const balls = visibleProjectiles.map((projectile, index) => `<span class="preview-ball ${projectile.mode === "molten" ? "is-molten" : ""} ${projectile.returning ? "is-returning" : ""}" style="--ball-index:${index};--ball-size:${Math.max(0.68, Math.min(1.45, 0.72 + ((projectile.mass || 2) * 0.1)))}rem" aria-hidden="true"></span>`).join("");
  const overflow = (preview.projectiles?.length || 0) > visibleProjectiles.length ? `<span class="preview-overflow">+${preview.projectiles.length - visibleProjectiles.length}</span>` : "";
  return `<div class="preview-visual" data-level="${level}" data-projectiles="${preview.projectiles?.length || 0}"><span class="preview-hopper">◉</span><i>›</i>${nodes}<i>›</i><span class="preview-cannon">◎</span>${balls}${overflow}</div>`;
}

function previewMarkup() {
  const preview = state.preview || previewTrain(state);
  const eventText = preview.events.length
    ? preview.events.map((event, index) => `<li class="preview-step"><span class="preview-step-number">${index + 1}</span><span><strong>${escapeHtml(event.icon || "•")} ${escapeHtml(event.carName || "加工")}</strong><small>${escapeHtml(event.before || "")} → ${escapeHtml(event.after || "")}</small><em>${escapeHtml(event.note || "")}</em></span></li>`).join("")
    : `<li class="preview-step empty-preview"><span>まだ加工車がありません</span></li>`;
  return `
    <div class="preview-box">
      <div class="preview-label"><span>LOCAL PREVIEW / 同じ因果列</span><span>到着 ${preview.travel} tick</span></div>
      ${previewVisualMarkup(preview)}
      <div class="preview-result"><strong>${escapeHtml(preview.summary)}</strong><span>発射前の形</span></div>
      <ol class="preview-flow">${eventText}</ol>
      <p class="preview-footnote">順番を一つ動かすと、速度・火花・戻り印のどこが変わるかをここで確認できます。</p>
    </div>
  `;
}

function renderBuildPanel() {
  const challenge = challengeFor(state.stage, state.seed);
  if (state.phase !== "build") return "";
  return `
    <section class="panel mission-panel">
      <div class="panel-heading"><div><p class="kicker">NEXT TARGET</p><h2>第${state.stage + 1}区画: ${escapeHtml(challenge.name)}</h2></div><span class="threat threat-${escapeHtml(challenge.kind)}">${escapeHtml(challenge.kind)}</span></div>
      <p class="mission-copy">${escapeHtml(challenge.text)}</p>
      ${enemyPreviewMarkup(challenge)}
      ${previewMarkup()}
      <div class="action-row">
        <button class="button secondary" data-action="preview">もう一度プレビュー</button>
        <button class="button primary launch" data-action="launch">発車する <span aria-hidden="true">→</span></button>
      </div>
      <p class="microcopy">発車すると、弾が車両を通る順に短いショーが始まります。結果の途中でリロードしても、この画面から再開できます。</p>
    </section>
  `;
}

function reportEventLabel(event) {
  if (event.type === "battle_start") return [`${event.icon || "⚠"} 敵影`, event.motion || event.note || "敵影を確認"];
  if (event.type === "volley") return [`Volley ${event.volley}`, `${event.before || "鉄塊"} が後部から入った`];
  if (event.type === "car") return [`${event.icon || "•"} ${event.carName || "加工車"}`, `${event.before || ""} → ${event.after || ""} · ${event.note || ""}`];
  if (event.type === "loop") return ["∞ ループ", event.note || "後ろ側の加工をやり直す"];
  if (event.type === "fire") return ["◎ 発射", `${event.summary || "鉄塊"} · 到着 ${event.travel || "?"} tick`];
  if (event.type === "impact") return [`✹ ${event.target || "敵"} に命中`, `${event.damage || 0} ダメージ（${event.note || "正面に命中"}）`];
  if (event.type === "impact_splash") return [`✹ 爆風が ${event.target || "敵"} へ`, `${event.damage || 0} ダメージ（${event.note || "隣の敵へ広がった"}）`];
  if (event.type === "impact_blocked") return ["弾が止まった", `${event.target || "敵"} · ${event.note || "相手の性質に弾かれた"}`];
  if (event.type === "return") return ["↩ 回収ライン", event.note || "磁石が着弾後の鉄片を呼び戻す"];
  if (event.type === "return_reprocess") return ["↶ 帰還再加工", `${event.summary || "戻り弾"} · ${event.note || "逆走車が帰路を変えた"}`];
  if (event.type === "collector_gain") return ["◒ 残骸を回収", event.note || "次の鉄塊へ戻した"];
  if (event.type === "enemy_recover") return ["敵の拾い直し", event.note || "戻り弾の残骸を拾われた"];
  if (event.type === "enemy_repelled") return ["拾い屋を押し返した", event.note || "尾部へ届かなかった"];
  if (event.type === "car_stolen") return ["車両を奪われる", event.note || "尾部の車両が狙われた"];
  if (event.type === "car_stolen_confirmed") return ["車両を失った", event.note || "残った車列で組み直す"];
  if (event.type === "enemy_shell") return ["⚠ 敵弾", `${event.target || "敵"} → ${event.targetCarId ? carById(event.targetCarId).name : "車体"}`];
  if (event.type === "enemy_attack") return ["敵の反撃", `${event.damage || 0} ダメージ / ${event.targetCarId ? `${carById(event.targetCarId).name}へ` : "車体へ"} / 装甲吸収 ${event.absorbed || 0}${event.convertedMass ? ` / 次弾の鉄塊 +${event.convertedMass}` : ""}`];
  if (event.type === "wave_clear") return ["✓ ウェーブ突破", event.note || "敵影が消えた"];
  if (event.type === "repair") return ["応急修理", event.note || `車体を ${event.amount || 0} 回復`];
  if (event.type === "battle_end") return ["終点", event.reason || "列車が止まった"];
  return [event.type || "記録", event.note || ""];
}

function replayEvents(report) {
  const events = (report.events || [])
    .filter((event) => ["battle_start", "volley", "car", "loop", "fire", "impact", "impact_splash", "impact_blocked", "return", "return_reprocess", "collector_gain", "enemy_recover", "enemy_repelled", "car_stolen", "car_stolen_confirmed", "enemy_shell", "enemy_attack", "wave_clear", "repair", "battle_end"].includes(event.type));
  const maxFrames = 40;
  if (events.length <= maxFrames) return events;
  // Keep the beginning and end of the show, then spend the remaining frames
  // on events that explain a transformation or collision. This avoids a
  // late-run eight-pellet burst pushing the outcome off screen.
  const keep = new Set([0, events.length - 1]);
  const priority = new Set(["car", "loop", "fire", "impact", "impact_splash", "impact_blocked", "return", "return_reprocess", "collector_gain", "enemy_recover", "enemy_repelled", "car_stolen", "car_stolen_confirmed", "enemy_shell", "enemy_attack", "wave_clear"]);
  events.forEach((event, index) => { if (priority.has(event.type) && keep.size < maxFrames) keep.add(index); });
  for (let index = 0; keep.size < maxFrames && index < events.length; index += 1) keep.add(index);
  return [...keep].sort((a, b) => a - b).map((index) => events[index]);
}

function showcaseReport(report) {
  if (!report) return report;
  const events = report.events || [];
  const fires = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.type === "fire");
  if (!fires.length) return report;
  const best = fires.sort((a, b) => {
    const aShow = a.event.spectacle || {};
    const bShow = b.event.spectacle || {};
    return (bShow.level || 0) - (aShow.level || 0)
      || (bShow.projectileCount || 0) - (aShow.projectileCount || 0)
      || (b.event.projectiles?.length || 0) - (a.event.projectiles?.length || 0)
      || b.index - a.index;
  })[0];
  let start = best.index;
  while (start > 0 && events[start - 1].type !== "volley" && events[start - 1].type !== "battle_start") start -= 1;
  let end = best.index + 1;
  while (end < events.length && !["volley", "battle_end"].includes(events[end].type) && end - start < 24) end += 1;
  return { ...report, events: events.slice(start, end) };
}

function causalHighlights(report) {
  const events = report?.events || [];
  const meaningful = events.filter((event) => ["car", "loop", "impact", "impact_splash", "impact_blocked", "return", "return_reprocess", "collector_gain", "enemy_recover", "enemy_repelled", "car_stolen", "car_stolen_confirmed", "enemy_attack", "wave_clear"].includes(event.type));
  const selected = [];
  const add = (event) => { if (event && !selected.includes(event) && selected.length < 3) selected.push(event); };
  add(meaningful.find((event) => event.type === "car" && event.before !== event.after) || meaningful.find((event) => event.type === "loop"));
  add(meaningful.find((event) => ["return_reprocess", "return", "collector_gain", "enemy_recover", "enemy_repelled", "car_stolen"].includes(event.type)));
  add([...meaningful].reverse().find((event) => ["wave_clear", "impact", "impact_splash", "impact_blocked", "car_stolen_confirmed", "enemy_attack"].includes(event.type)));
  meaningful.slice().reverse().forEach(add);
  return selected;
}

function replayFrame(event, index, total) {
  const [title, detail] = reportEventLabel(event);
  const payload = event.type === "enemy_shell"
    ? "⚠"
    : event.after || event.summary || (event.projectile ? `${event.projectile.mass || 0}` : "");
  const lane = ["impact", "impact_splash", "impact_blocked", "enemy_shell", "enemy_attack", "enemy_recover", "enemy_repelled", "car_stolen", "car_stolen_confirmed"].includes(event.type)
    ? "enemy"
    : event.type === "return" || event.type === "return_reprocess" ? "return" : "train";
  const train = event.train || state.lastBattle?.train || state.activeCars;
  const activeIndex = Number.isInteger(event.carIndex) ? event.carIndex : Number.isInteger(event.targetCarIndex) ? event.targetCarIndex : -1;
  const trainNodes = train.map((id, carIndex) => {
    const car = carById(id);
    return `<span class="replay-train-car ${carIndex === activeIndex ? "is-active" : ""}" data-car-index="${carIndex}"><b>${escapeHtml(car.icon)}</b><small>${escapeHtml(car.name)}</small></span>`;
  }).join("");
  const projectileList = event.afterProjectiles?.length
    ? event.afterProjectiles
    : event.projectiles?.length ? event.projectiles : (event.projectile ? [event.projectile] : []);
  const projectileGlyph = (item) => item.mode === "enemy-shell" ? "⚠" : item.mode === "molten" ? "✹" : item.returning ? "↩" : (item.splitCount || 0) > 0 ? "◆" : "●";
  const projectileMarkup = projectileList.length
    ? projectileList.slice(0, 10).map((item, itemIndex) => {
      const itemClass = `${item.mode === "molten" ? "is-molten" : ""} ${item.mode === "enemy-shell" ? "is-enemy-shell" : ""} ${item.returning ? "is-returning" : ""} ${item.returnBlast ? "is-blast" : ""}`;
      const shortId = String(item.id || "p").split("-").slice(-2).join("-");
      return `<span class="replay-payload ${itemClass}" data-projectile-id="${escapeHtml(item.id || "")}" title="弾 ${escapeHtml(item.id || "")}" style="--payload-index:${itemIndex};--payload-size:${Math.max(0.72, Math.min(1.55, 0.72 + ((item.mass || 2) * 0.1)))}rem">${projectileGlyph(item)}<small>${escapeHtml(shortId)}</small></span>`;
    }).join("")
    : `<span class="replay-payload" style="--payload-size:0.9rem">${escapeHtml(payload || "鉄塊")}</span>`;
  const spectacleLevel = event.spectacle?.level || state.lastBattle?.spectacle?.level || 1;
  const particles = Array.from({ length: Math.min(10, 3 + spectacleLevel * 2) }, (_, particleIndex) => `<i class="replay-particle particle-${particleIndex}" aria-hidden="true">${["impact", "impact_splash", "fire"].includes(event.type) ? "✦" : "·"}</i>`).join("");
  const enemyNode = lane === "enemy" ? `<span class="replay-enemy-node" aria-hidden="true">${escapeHtml(state.lastBattle?.enemyIcon || "⚠")}</span>` : "";
  return `
    <div class="replay-progress"><span style="width:${Math.round(((index + 1) / Math.max(1, total)) * 100)}%"></span></div>
    <div class="replay-route replay-${lane}" data-spectacle="${spectacleLevel}">
      <span class="replay-node">ホッパー</span><i aria-hidden="true">›</i><div class="replay-train-cars">${trainNodes}</div><i aria-hidden="true">›</i><span class="replay-node">砲台</span>${enemyNode}
      <span class="replay-payloads" data-location="${escapeHtml(event.location?.lane || lane)}">${projectileMarkup}</span>${particles}
    </div>
    <div class="replay-caption"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>
    <small class="replay-count">${index + 1} / ${total}</small>
  `;
}

function playEventCue(event) {
  const frequencies = {
    battle_start: 220,
    volley: 260,
    car: 320,
    loop: 380,
    fire: 520,
    impact: 760,
    impact_splash: 840,
    impact_blocked: 170,
    return: 430,
    return_reprocess: 470,
    collector_gain: 590,
    enemy_recover: 180,
    enemy_repelled: 300,
    car_stolen: 120,
    car_stolen_confirmed: 105,
    enemy_shell: 150,
    enemy_attack: 130,
    wave_clear: 880,
    repair: 610,
    battle_end: 980,
  };
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !frequencies[event.type]) return;
    audioContext ||= new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const spectacleLevel = event.spectacle?.level || state.lastBattle?.spectacle?.level || 1;
    oscillator.type = ["impact", "impact_splash", "return_reprocess", "wave_clear"].includes(event.type) ? "triangle" : ["enemy_attack", "impact_blocked", "car_stolen"].includes(event.type) ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(frequencies[event.type] + spectacleLevel * 18, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime((["impact", "impact_splash"].includes(event.type) ? 0.065 : 0.035) + spectacleLevel * 0.004, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (event.type === "wave_clear" ? 0.32 : 0.16));
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (event.type === "wave_clear" ? 0.33 : 0.18));
  } catch {
    // Sound is optional; the visual route remains the source of truth.
  }
}

function vibrateForEvent(event) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const pattern = {
    impact: 16,
    impact_splash: [14, 18, 24],
    impact_blocked: 8,
    return: [10, 18, 10],
    return_reprocess: [8, 14, 8],
    enemy_shell: 10,
    enemy_attack: 32,
    car_stolen_confirmed: [12, 28, 12],
    wave_clear: [12, 24, 22],
  }[event.type];
  if (pattern) {
    try { navigator.vibrate(pattern); } catch { /* optional */ }
  }
}

function startReplay(report) {
  stopReplay();
  const events = replayEvents(report);
  const stage = document.querySelector("#replay-stage");
  if (!stage || !events.length) return;
  const token = replayToken;
  const frameDelay = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320;
  let index = 0;
  const tick = () => {
    if (token !== replayToken) return;
    const frame = document.querySelector("#replay-stage");
    if (!frame) return;
    frame.innerHTML = replayFrame(events[index], index, events.length);
    frame.dataset.eventIndex = String(index);
    playEventCue(events[index]);
    vibrateForEvent(events[index]);
    if (index < events.length - 1) {
      index += 1;
      replayTimer = window.setTimeout(tick, frameDelay);
    } else {
      replayTimer = null;
    }
  };
  tick();
}

function renderReport() {
  if (state.phase !== "report" || !state.lastBattle) return "";
  const report = state.lastBattle;
  const highlights = causalHighlights(report).map((event) => {
    const [title, detail] = reportEventLabel(event);
    return `<li class="highlight-item highlight-${event.type}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></li>`;
  }).join("");
  const lines = report.events
    .filter((event) => replayEvents(report).includes(event))
    .slice(-60)
    .map((event, index) => {
      const [title, detail] = reportEventLabel(event);
      return `<li class="trace-item trace-${event.type}" style="--trace-delay:${Math.min(index, 20) * 35}ms"><span class="trace-title">${escapeHtml(title)}</span><span class="trace-detail">${escapeHtml(detail)}</span></li>`;
    }).join("");
  const outcome = report.won ? "突破" : "停止";
  const outcomeClass = report.won ? "success" : "failure";
  return `
    <section class="panel report-panel ${outcomeClass}">
      <div class="report-head"><div><p class="kicker">CAUSE CHAIN REPLAY</p><h2>${escapeHtml(report.enemyIcon || "⚠")} ${escapeHtml(report.challenge)} <span class="outcome-pill">${outcome}</span></h2></div><div class="report-hp">車体 ${report.hullBefore} → <strong>${report.hullAfter}</strong></div></div>
      <p class="muted">${escapeHtml(report.motion || "敵と弾の動きを、同じイベント列から再生します。")}</p>
      <div id="replay-stage" class="replay-stage" role="status" aria-live="polite"><span>再生準備中…</span></div>
      <div class="highlight-box"><p class="kicker">THREE CAUSES TO REMEMBER</p><ol class="highlight-list">${highlights || "<li class=\"highlight-item\"><span>この区画では変化なし</span></li>"}</ol></div>
      <details class="trace-details"><summary>全ログを見る（${replayEvents(report).length} コマ）</summary><ol class="trace-list">${lines}</ol></details>
      <div class="action-row">
        <button class="button primary" data-action="continue-report">${state.done ? "結果を記録する" : "残骸を調べる"} <span aria-hidden="true">→</span></button>
      </div>
    </section>
  `;
}

function rewardPreviewMarkup(car) {
  const replacementSlot = state.activeCars.length >= MAX_CARS
    ? (selectedReplacement() ?? state.activeCars.length - 1)
    : null;
  const projectedState = installCar(state, car.id, replacementSlot);
  const projected = previewTrain(projectedState);
  const slotCopy = replacementSlot === null
    ? "末尾へ連結した場合"
    : `車両 ${replacementSlot + 1} と交換した場合`;
  return `<span class="salvage-impact"><span>仮組み / ${escapeHtml(slotCopy)}</span><strong>${escapeHtml(projected.summary)}</strong><small>到着 ${projected.travel} tick · ${projected.projectiles.length}発</small></span>`;
}

function renderReward() {
  if (state.phase !== "reward") return "";
  const offers = state.offers.length ? state.offers : offersFor(state);
  const offerRows = offers.map((car, index) => `
    <li class="salvage-row ${car.rarity === "rare" ? "rare" : ""}">
      <span class="offer-index" aria-hidden="true">${index + 1}</span>
      <span class="offer-icon" aria-hidden="true">${car.icon}</span>
      <span class="salvage-copy"><span class="rarity">${car.rarity === "rare" ? "RARE / ルール変更" : car.rarity === "starter" ? "SALVAGE / 始動" : "SALVAGE / 加工"}</span><strong>${escapeHtml(car.name)}</strong><small>${escapeHtml(car.text)}</small>${rewardPreviewMarkup(car)}</span>
      <button class="button small" data-action="install" data-car="${car.id}">${state.activeCars.length < MAX_CARS ? "連結する" : "選択車両と交換"}</button>
    </li>
  `).join("");
  return `
    <section class="panel reward-panel">
      <div class="panel-heading"><div><p class="kicker">SALVAGE CHOICE</p><h2>残骸から一台だけ</h2></div><span class="selection-hint">${state.activeCars.length}/${MAX_CARS} 車両</span></div>
      <p class="muted">新しい車両は、今ある車両の意味まで変えます。満車なら車両をタップして交換先を決めてください。</p>
      <ol class="salvage-list">${offerRows}</ol>
      <button class="button text-button" data-action="skip-reward">今回は拾わない</button>
    </section>
  `;
}

function runName() {
  const ids = new Set(state.activeCars);
  const events = state.battleHistory?.length ? (state.lastBattle?.events || []) : [];
  if (events.some((event) => event.type === "impact_splash")) return "群焼き爆風線";
  if (events.some((event) => event.type === "car_stolen" || event.type === "enemy_repelled")) return "尾部防衛線";
  if (events.some((event) => event.type === "return_reprocess" && event.summary?.includes("♨"))) return "帰還炸裂線";
  if (events.some((event) => event.type === "return_reprocess")) return "逆走回収線";
  if (events.some((event) => event.type === "impact_blocked")) return "破城試験線";
  if (ids.has("magnet") && ids.has("reverse") && ids.has("collector")) return "回収逆走線";
  if (ids.has("charge") && ids.has("melt")) return "溶鉱火花線";
  if (ids.has("cut") && ids.has("press")) return "分岐圧縮線";
  if (ids.has("loop")) return "反復ループ線";
  return (carById(state.activeCars[0])?.name || "鉄塊") + "編成";
}

function nextExperimentQuestion() {
  const unused = CARS.find((car) => !state.activeCars.includes(car.id) && car.rarity !== "starter");
  if (state.won) {
    return unused
      ? "次は" + unused.name + "を入れて、" + (state.activeCars[0] ? carById(state.activeCars[0]).name : "先頭車") + "との順番を比べる。"
      : "同じ5両で、磁石と溶解の順番だけを入れ替える。";
  }
  return "同じ敵に再挑戦し、" + (unused ? unused.name : "先頭車") + "を一台だけ交換して因果を比べる。";
}

function majorRebuild() {
  const entries = (state.carHistory || []).filter((entry) => entry.action !== "skip");
  if (!entries.length) return null;
  const counts = new Map();
  entries.forEach((entry) => counts.set(entry.stage || 0, (counts.get(entry.stage || 0) || 0) + 1));
  const [stage, count] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return count >= 2 ? { stage, count } : null;
}

function finalTrainMarkup() {
  return `<div class="final-train-summary" aria-label="最終車列">${state.activeCars.map((id, index) => {
    const car = carById(id);
    return `<span><b>${escapeHtml(car.icon)}</b><small>${index + 1}. ${escapeHtml(car.name)}</small></span>`;
  }).join("")}</div>`;
}

function finalShotMarkup() {
  const report = showcaseReport(state.lastBattle);
  if (!report) return "";
  const highlights = causalHighlights(report).map((event) => {
    const [title, detail] = reportEventLabel(event);
    return "<li class=\"highlight-item\"><strong>" + escapeHtml(title) + "</strong><span>" + escapeHtml(detail) + "</span></li>";
  }).join("");
  return [
    "<div class=\"final-shot\">",
    "<div class=\"final-shot-heading\"><p class=\"kicker\">MOST SPECTACULAR SHOT / " + escapeHtml(runName()) + "</p><button class=\"button text-button\" data-action=\"restart-replay\">もう一度再生</button></div>",
    finalTrainMarkup(),
    "<div id=\"replay-stage\" class=\"replay-stage final-replay\" role=\"status\" aria-live=\"polite\"><span>最終ショーを準備中…</span></div>",
    "<ol class=\"highlight-list\">" + (highlights || "<li class=\"highlight-item\"><span>最後の因果ログはありません</span></li>") + "</ol>",
    "</div>",
  ].join("");
}

function rebuildHistoryMarkup() {
  const history = state.carHistory || [];
  if (!history.length) return `<p class="muted history-empty">このランではまだ車両を動かしていません。</p>`;
  const rows = history.map((entry, index) => {
    const name = entry.carId ? (carById(entry.carId)?.name || entry.carId) : "車列";
    const replaced = entry.replaced ? (carById(entry.replaced)?.name || entry.replaced) : "";
    let detail = `${name}を残した`;
    if (entry.action === "append") detail = `${name}を車列へ連結`;
    if (entry.action === "replace") detail = `${replaced}を外し、${name}へ交換`;
    if (entry.action === "remove") detail = `${name}を解体`;
    if (entry.action === "stolen") detail = `${name}を拾い屋に奪われた`;
    if (entry.action === "move") detail = `${name}を ${entry.from + 1}番 → ${entry.to + 1}番へ移動`;
    if (entry.action === "skip") detail = "残骸を見送り、現在の車列を残した";
    return `<li class="history-row"><span class="history-index">${index + 1}</span><span><strong>区画 ${Math.min(MAX_STAGES, (entry.stage || 0) + 1)}</strong><small>${escapeHtml(detail)}</small></span></li>`;
  }).join("");
  return `<ol class="history-list">${rows}</ol>`;
}

function renderDone() {
  if (state.phase !== "done") return "";
  const resultTitle = state.won ? "炉心を制圧した" : "列車が止まった";
  const resultCopy = state.won
    ? "七つの区画を抜け、最初の鉄塊が王の炉心まで届きました。次は別の順番で同じ問いを試せます。"
    : `${state.reason || "敵の反撃で列車が止まりました"}。車列のどこを入れ替えれば、同じ敵に別の答えが返るかを残してください。`;
  const sent = state.telemetry?.sentAt ? "送信済み" : state.telemetry?.pending || state.telemetry?.error ? "再送待ち" : "未送信";
  const discarded = (state.carHistory || []).filter((entry) => entry.action === "replace" || entry.action === "remove" || entry.action === "stolen").length;
  const peak = majorRebuild();
  const peakCopy = peak ? `大改造の山: 第${Math.min(MAX_STAGES, peak.stage + 1)}区画（${peak.count}操作）` : "大改造の記録はありません";
  return `
    <section class="panel done-panel ${state.won ? "success" : "failure"}">
      <p class="kicker">RUN COMPLETE / ${escapeHtml(sent)}</p><h2>${resultTitle}</h2><p>${resultCopy}</p>
      <div class="run-name"><span>この列車の呼び名</span><strong>${escapeHtml(runName())}</strong><small>${escapeHtml(peakCopy)}</small><small>${escapeHtml(nextExperimentQuestion())}</small></div>
      ${finalShotMarkup()}
      <details class="history-details"><summary>大改造の履歴（${(state.carHistory || []).length}件）</summary>${rebuildHistoryMarkup()}</details>
      <div class="result-stats"><span>到達 <strong>${state.stage}/${MAX_STAGES}</strong></span><span>車体 <strong>${state.hull}/${MAX_HULL}</strong></span><span>車両 <strong>${state.activeCars.length}/${MAX_CARS}</strong></span><span>手放した車両 <strong>${discarded}</strong></span></div>
      ${renderSurvey()}
    </section>
  `;
}

function renderSurvey() {
  if (state.survey) {
    const retry = state.telemetry?.error ? `<button class="button secondary" data-action="retry-send">再送する</button>` : "";
    return `<div class="survey-sent"><strong>回答を保存しました。</strong><span>${state.telemetry?.error ? escapeHtml(state.telemetry.error) : "このプレイの因果ログと一緒に送信します。"}</span><div class="action-row">${retry}<button class="button secondary" data-action="new-run">新しい列車を始める</button></div></div>`;
  }
  const scale = (name, labels) => `<fieldset class="scale-field"><legend>${escapeHtml(labels[0])} <span>1 — 5</span> ${escapeHtml(labels[1])}</legend><div class="scale-options">${[1, 2, 3, 4, 5].map((value) => `<label><input required type="radio" name="${name}" value="${value}"><span>${value}</span></label>`).join("")}</div></fieldset>`;
  return `
    <form id="survey-form" class="survey-form">
      <p class="survey-title">30秒の振り返り</p>
      ${scale("fun", ["面白さ", "退屈さ"])}
      ${scale("replay", ["もう一度、順番を変えて試したい", "一度で十分"])}
      <label>一番「おっ」と思った瞬間<input required name="bestMoment" maxlength="120" placeholder="例: 磁石で戻った弾が逆走した"></label>
      <label>引っかかったところ<textarea required name="friction" maxlength="240" rows="2" placeholder="例: どの車両が効いたか分からなかった"></textarea></label>
      <label>次に試すこと（任意）<input name="nextPlan" maxlength="120" placeholder="例: 溶解車を切断車の前へ"></label>
      <button class="button primary" type="submit">回答を保存して送信</button>
      <p class="microcopy">空欄のない回答だけを送ります。ログには seed と車列の順番が含まれます。</p>
    </form>
  `;
}

function renderMarkers() {
  const markers = [
    ["spark", "閃き"], ["choice", "選択の手応え"], ["payoff", "因果が返った"],
    ["friction", "操作の摩擦"], ["unclear", "何が起きたか不明"], ["bored", "退屈"],
  ];
  return `
    <section class="panel marker-panel">
      <div class="panel-heading"><div><p class="kicker">MOMENT MARKER</p><h2>今の感触を一つ記録</h2></div><span class="selection-hint">任意 / 何度でも</span></div>
      <form id="marker-form" class="marker-form"><div class="marker-buttons">${markers.map(([id, label]) => `<button type="button" class="marker-button" data-action="marker" data-marker="${id}">${label}</button>`).join("")}</div><input name="markerNote" maxlength="180" placeholder="一言メモ（任意）"><span id="marker-status" class="form-status" role="status"></span></form>
    </section>
  `;
}

function completeDrag(from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
  suppressClickUntil = Date.now() + 450;
  setState(moveCar(state, from, to), { type: "car_reordered", from, to, method: "drag" });
}

function bindTrainDragging() {
  if (!app) return;
  const slots = [...app.querySelectorAll("[data-drag-slot]")];
  slots.forEach((slot) => {
    slot.addEventListener("dragstart", (event) => {
      if (event.target.closest(".slot-actions")) { event.preventDefault(); return; }
      dragSource = Number(slot.dataset.dragSlot);
      slot.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(dragSource));
      }
    });
    slot.addEventListener("dragend", () => {
      dragSource = null;
      slot.classList.remove("is-dragging");
      slots.forEach((candidate) => candidate.classList.remove("is-drag-target"));
    });
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      slot.classList.add("is-drag-target");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("is-drag-target"));
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      const from = dragSource ?? Number(event.dataTransfer?.getData("text/plain"));
      const to = Number(slot.dataset.dragSlot);
      completeDrag(from, to);
    });
    slot.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".slot-actions")) return;
      if (!event.isPrimary) return;
      pointerDrag = { from: Number(slot.dataset.dragSlot), startX: event.clientX, startY: event.clientY, moved: false, slot };
      try { slot.setPointerCapture(event.pointerId); } catch { /* optional */ }
    });
    slot.addEventListener("pointermove", (event) => {
      if (!pointerDrag || pointerDrag.slot !== slot) return;
      const dx = event.clientX - pointerDrag.startX;
      const dy = event.clientY - pointerDrag.startY;
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return;
      pointerDrag.moved = true;
      slot.classList.add("is-dragging");
      event.preventDefault();
    });
    const finishPointerDrag = (event) => {
      if (!pointerDrag || pointerDrag.slot !== slot) return;
      const drag = pointerDrag;
      pointerDrag = null;
      slot.classList.remove("is-dragging");
      if (!drag.moved) return;
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-drag-slot]");
      completeDrag(drag.from, target ? Number(target.dataset.dragSlot) : drag.from);
    };
    slot.addEventListener("pointerup", finishPointerDrag);
    slot.addEventListener("pointercancel", finishPointerDrag);
  });
}

function render() {
  if (!app) return;
  stopReplay();
  const challenge = challengeFor(state.stage, state.seed);
  const status = state.telemetry?.error ? `<p class="sync-error" role="status">ログ送信: ${escapeHtml(state.telemetry.error)}</p>` : "";
  const diagnosticStamp = requestedSeed === null ? "" : "<span>diagnostic seed " + state.seed + "</span>";
  app.innerHTML = `
    <main class="shell">
      <header class="hero">
        <div><p class="eyebrow">NEW ROUTE / SCRAPLINE</p><h1>ガラクタ列車</h1><p class="lead">鉄塊を一つだけ、車列の順番で別の答えに変える。</p></div>
        <div class="stamp"><span>${VERSION}</span>${diagnosticStamp}<span>${BUILD_STAMP}</span></div>
      </header>
      <section class="status-strip panel">
        <div><span class="kicker">STAGE</span><strong>${stageLabel(state.stage)}</strong><span class="status-copy">${escapeHtml(phaseCopy())}</span></div>
        <div class="status-meter"><span>車体 ${state.hull}/${MAX_HULL}</span>${progressBar(state.hull, MAX_HULL)}</div>
        <div class="status-meter armor-meter"><span>装甲 ${state.armor}</span>${progressBar(Math.min(state.armor, MAX_HULL), MAX_HULL)}</div>
      </section>
      ${renderTrain()}
      ${renderBuildPanel()}
      ${renderReport()}
      ${renderReward()}
      ${renderDone()}
      ${renderMarkers()}
      <footer class="footer"><span>build ${BUILD_STAMP}</span><span>このルートは既存の /play/ を置き換えません。</span><button class="text-button" data-action="new-run">最初からやり直す</button>${status}</footer>
    </main>
  `;
  bindTrainDragging();
  if ((state.phase === "report" || state.phase === "done") && state.lastBattle) {
    startReplay(state.phase === "done" ? showcaseReport(state.lastBattle) : state.lastBattle);
  }
}

function selectedReplacement() {
  return selectedSlot !== null && selectedSlot < state.activeCars.length ? selectedSlot : null;
}

function handleInstall(carId) {
  const slot = state.activeCars.length >= MAX_CARS ? selectedReplacement() : null;
  if (state.activeCars.length >= MAX_CARS && slot === null) {
    showMessage("先に交換する車両をタップしてください。");
    return;
  }
  const next = installCar(state, carId, slot);
  selectedSlot = null;
  setState(next, { type: "car_installed", carId, slot });
}

function showMessage(message) {
  const status = document.querySelector("#marker-status");
  if (status) {
    status.textContent = message;
    window.setTimeout(() => { if (status) status.textContent = ""; }, 2600);
  }
}

function launch() {
  if (state.phase !== "build") return;
  recordTelemetry(state, { type: "battle_started", stage: state.stage + 1, cars: [...state.activeCars] });
  const result = runBattle(state);
  state = result.state;
  ensureTelemetry(state);
  recordTelemetry(state, { type: "battle_finished", stage: result.report.stage, won: result.report.won, hull: result.report.hullAfter });
  result.report.events.slice(0, 220).forEach((event, eventIndex) => {
    if (["battle_start", "volley", "car", "loop", "fire", "impact", "impact_splash", "impact_blocked", "return", "return_reprocess", "collector_gain", "enemy_recover", "enemy_repelled", "car_stolen", "car_stolen_confirmed", "enemy_shell", "enemy_attack", "wave_clear", "repair", "battle_end"].includes(event.type)) {
      recordTelemetry(state, {
        type: "cause_replay_event",
        stage: result.report.stage,
        eventIndex,
        eventType: event.type,
        carId: event.carId || null,
        path: event.path || null,
        before: event.before || null,
        after: event.after || null,
        summary: event.summary || null,
        travel: event.travel || null,
        target: event.target || null,
        damage: event.damage || 0,
        note: event.note || null,
        event,
      });
    }
  });
  persist();
  render();
}

function submitMarker(form, marker) {
  const note = new FormData(form).get("markerNote") || "";
  state = recordMarker(state, marker, note);
  recordTelemetry(state, { type: "emotion_marked", kind: marker, stage: state.stage, note: String(note).slice(0, 180) });
  persist();
  form.reset();
  showMessage("記録しました");
}

async function submitSurvey(form) {
  const data = new FormData(form);
  const survey = {
    fun: Number(data.get("fun")),
    replay: Number(data.get("replay")),
    bestMoment: String(data.get("bestMoment") || "").slice(0, 120),
    friction: String(data.get("friction") || "").slice(0, 240),
    nextPlan: String(data.get("nextPlan") || "").slice(0, 120),
  };
  state = recordSurvey(state, survey);
  recordTelemetry(state, { type: "survey_submitted", stage: state.stage, fun: survey.fun, replay: survey.replay });
  persist();
  render();
  const result = await sendScraplineTelemetry(state);
  persist();
  render();
  if (!result.ok) showMessage(result.error || "送信に失敗しました。再送できます。");
}

async function retryTelemetry() {
  showMessage("保存済みログを再送しています…");
  const result = await sendScraplineTelemetry(state);
  persist();
  render();
  showMessage(result.ok ? "再送しました" : result.error || "まだ送信できません。もう一度試せます。");
}

async function flushTelemetryQueue() {
  const result = await flushScraplineTelemetryQueue();
  if (result?.sent) showMessage(`${result.sent}件の保存済みログを送信しました`);
}

function newRun() {
  const next = createGame(querySeed());
  recordTelemetry(next, { type: "run_started", seed: next.seed, restarted: true });
  selectedSlot = null;
  setState(next);
}

app?.addEventListener("click", (event) => {
  if (Date.now() < suppressClickUntil) {
    event.preventDefault();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "select-slot") {
    selectedSlot = Number(button.dataset.slot);
    persist();
    render();
  } else if (action === "move-left" || action === "move-right") {
    const from = Number(button.dataset.slot);
    const to = action === "move-left" ? from - 1 : from + 1;
    setState(moveCar(state, from, to), { type: "car_reordered", from, to });
  } else if (action === "remove") {
    const index = Number(button.dataset.slot);
    selectedSlot = null;
    setState(removeCar(state, index), { type: "car_removed", index });
  } else if (action === "preview") {
    const next = { ...state, preview: previewTrain(state), previewCount: (state.previewCount || 0) + 1 };
    setState(next, { type: "preview_viewed", stage: state.stage, summary: next.preview.summary });
  } else if (action === "launch") {
    launch();
  } else if (action === "continue-report") {
    setState(continueFromReport(state), { type: "report_continued", stage: state.stage });
  } else if (action === "restart-replay") {
    if (state.lastBattle) startReplay(state.phase === "done" ? showcaseReport(state.lastBattle) : state.lastBattle);
  } else if (action === "install") {
    handleInstall(button.dataset.car);
  } else if (action === "skip-reward") {
    setState(skipReward(state), { type: "reward_skipped", stage: state.stage });
  } else if (action === "marker") {
    const form = document.querySelector("#marker-form");
    if (form) submitMarker(form, button.dataset.marker);
  } else if (action === "new-run") {
    newRun();
  } else if (action === "retry-send") {
    retryTelemetry();
  }
});

app?.addEventListener("submit", (event) => {
  if (event.target.id === "survey-form") {
    event.preventDefault();
    if (event.target.reportValidity()) submitSurvey(event.target);
  }
});

window.addEventListener("error", (event) => {
  if (!app) return;
  app.innerHTML = `<main class="shell boot-error"><h1>SCRAPLINE を読み込めませんでした</h1><p>${escapeHtml(event.error?.message || event.message || "unknown error")}</p><button class="button primary" onclick="location.reload()">再読み込み</button></main>`;
});

window.addEventListener("online", () => { flushTelemetryQueue(); });
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // The route stays usable when a host does not allow service workers.
  });
}

ensureTelemetry(state);
persist();
render();
window.setTimeout(() => { flushTelemetryQueue(); }, 900);
