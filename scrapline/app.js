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
import { ensureTelemetry, recordTelemetry, sendScraplineTelemetry } from "./telemetry.mjs";

const requestedSeed = querySeed();
const STORAGE_KEY = requestedSeed === null
  ? "scrapline-state-v1"
  : `scrapline-state-v1-seed-${Number(requestedSeed) >>> 0}`;
const app = document.querySelector("#app");
let state = loadState();
let selectedSlot = Number.isInteger(state.selectedSlot) ? state.selectedSlot : null;

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
  const slots = cars.map((car, index) => `
    <article class="train-slot ${selectedSlot === index ? "is-selected" : ""}">
      <button class="car-card" data-action="select-slot" data-slot="${index}" aria-pressed="${selectedSlot === index}">
        <span class="car-icon" aria-hidden="true">${car.icon}</span>
        <span class="car-name">${escapeHtml(car.name)}</span>
        <span class="car-effect">${escapeHtml(car.text)}</span>
        <span class="slot-number">車両 ${index + 1}</span>
      </button>
      <div class="slot-actions" aria-label="${escapeHtml(car.name)}の並び替え">
        <button class="icon-button" data-action="move-left" data-slot="${index}" ${index === 0 ? "disabled" : ""} aria-label="${escapeHtml(car.name)}を左へ">←</button>
        <button class="icon-button" data-action="move-right" data-slot="${index}" ${index === cars.length - 1 ? "disabled" : ""} aria-label="${escapeHtml(car.name)}を右へ">→</button>
        <button class="icon-button danger" data-action="remove" data-slot="${index}" aria-label="${escapeHtml(car.name)}を外す">×</button>
      </div>
    </article>
  `).join("");
  const empty = Array.from({ length: Math.max(0, MAX_CARS - cars.length) }, (_, index) => `
    <div class="train-slot empty-slot" aria-label="空きスロット">
      <span>空き</span><small>${cars.length + index + 1} / ${MAX_CARS}</small>
    </div>
  `).join("");
  return `
    <section class="train-panel panel">
      <div class="panel-heading">
        <div><p class="kicker">BUILD THE CAUSE CHAIN</p><h2>車列の順番</h2></div>
        <span class="selection-hint">${selectedSlot === null ? "満車なら交換先を選択" : `交換先: 車両 ${selectedSlot + 1}`}</span>
      </div>
      <p class="muted">左が後部ホッパー、右が砲台。鉄塊はこの順に一度ずつ通ります。</p>
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

function previewMarkup() {
  const preview = state.preview || previewTrain(state);
  const eventText = preview.events.length
    ? preview.events.map((event) => `${event.icon || "•"} ${event.note}`).join(" → ")
    : "まだ加工車がありません";
  return `
    <div class="preview-box">
      <div class="preview-label"><span>LOCAL PREVIEW</span><span>通過 ${preview.travel} tick</span></div>
      <div class="preview-result"><strong>${escapeHtml(preview.summary)}</strong><span>発射前の形</span></div>
      <p>${escapeHtml(eventText)}</p>
    </div>
  `;
}

function renderBuildPanel() {
  const challenge = challengeFor(state.stage);
  if (state.phase !== "build") return "";
  return `
    <section class="panel mission-panel">
      <div class="panel-heading"><div><p class="kicker">NEXT TARGET</p><h2>第${state.stage + 1}区画: ${escapeHtml(challenge.name)}</h2></div><span class="threat threat-${escapeHtml(challenge.kind)}">${escapeHtml(challenge.kind)}</span></div>
      <p class="mission-copy">${escapeHtml(challenge.text)}</p>
      ${previewMarkup()}
      <div class="action-row">
        <button class="button secondary" data-action="preview">もう一度プレビュー</button>
        <button class="button primary launch" data-action="launch">発車する <span aria-hidden="true">→</span></button>
      </div>
      <p class="microcopy">発車すると敵の反撃まで自動で進みます。結果の途中でリロードしても、この画面から再開できます。</p>
    </section>
  `;
}

function renderReport() {
  if (state.phase !== "report" || !state.lastBattle) return "";
  const report = state.lastBattle;
  const lines = report.events
    .filter((event) => ["battle_start", "volley", "car", "loop", "fire", "impact", "return", "enemy_recover", "enemy_attack", "wave_clear", "battle_end"].includes(event.type))
    .slice(-42)
    .map((event, index) => {
      let title = "";
      let detail = "";
      if (event.type === "battle_start") { title = "発車ベル"; detail = event.note; }
      if (event.type === "volley") { title = `Volley ${event.volley}`; detail = `${event.before} が後部から入った`; }
      if (event.type === "car") { title = `${event.icon} ${event.carName}`; detail = `${event.before} → ${event.after} · ${event.note}`; }
      if (event.type === "loop") { title = "∞ ループ"; detail = event.note; }
      if (event.type === "fire") { title = "◎ 発射"; detail = `${event.summary} · 通過 ${event.travel} tick`; }
      if (event.type === "impact") { title = `✹ ${event.target} に命中`; detail = `${event.damage} ダメージ（${event.note}）`; }
      if (event.type === "return") { title = "↩ 回収ライン"; detail = event.note; }
      if (event.type === "enemy_recover") { title = "敵の拾い直し"; detail = event.note; }
      if (event.type === "enemy_attack") { title = "敵の反撃"; detail = `${event.damage} ダメージ / 装甲吸収 ${event.absorbed}`; }
      if (event.type === "wave_clear") { title = "✓ ウェーブ突破"; detail = event.note; }
      if (event.type === "battle_end") { title = "終点"; detail = event.reason || (report.won ? "次の残骸が開いた" : "列車が止まった"); }
      return `<li class="trace-item trace-${event.type}" style="--trace-delay:${Math.min(index, 20) * 45}ms"><span class="trace-title">${escapeHtml(title)}</span><span class="trace-detail">${escapeHtml(detail)}</span></li>`;
    }).join("");
  const outcome = report.won ? "突破" : "停止";
  const outcomeClass = report.won ? "success" : "failure";
  return `
    <section class="panel report-panel ${outcomeClass}">
      <div class="report-head"><div><p class="kicker">CAUSE CHAIN REPLAY</p><h2>${escapeHtml(report.challenge)} <span class="outcome-pill">${outcome}</span></h2></div><div class="report-hp">車体 ${report.hullBefore} → <strong>${report.hullAfter}</strong></div></div>
      <p class="muted">上から順に、鉄塊が何へ変わり、何が返ってきたかを追えます。</p>
      <ol class="trace-list">${lines}</ol>
      <div class="action-row">
        <button class="button primary" data-action="continue-report">${state.done ? "結果を記録する" : "残骸を調べる"} <span aria-hidden="true">→</span></button>
      </div>
    </section>
  `;
}

function renderReward() {
  if (state.phase !== "reward") return "";
  const offers = state.offers.length ? state.offers : offersFor(state);
  const offerCards = offers.map((car) => `
    <article class="offer-card ${car.rarity === "rare" ? "rare" : ""}">
      <div class="offer-icon" aria-hidden="true">${car.icon}</div>
      <div><span class="rarity">${car.rarity === "rare" ? "RARE / ルール変更" : "SALVAGE / 加工"}</span><h3>${escapeHtml(car.name)}</h3><p>${escapeHtml(car.text)}</p></div>
      <button class="button small" data-action="install" data-car="${car.id}">${state.activeCars.length < MAX_CARS ? "末尾に連結" : "選択車両と交換"}</button>
    </article>
  `).join("");
  return `
    <section class="panel reward-panel">
      <div class="panel-heading"><div><p class="kicker">SALVAGE CHOICE</p><h2>残骸から一台だけ</h2></div><span class="selection-hint">${state.activeCars.length}/${MAX_CARS} 車両</span></div>
      <p class="muted">新しい車両は、今ある車両の意味まで変えます。満車なら車両をタップして交換先を決めてください。</p>
      <div class="offer-grid">${offerCards}</div>
      <button class="button text-button" data-action="skip-reward">今回は拾わない</button>
    </section>
  `;
}

function renderDone() {
  if (state.phase !== "done") return "";
  const resultTitle = state.won ? "炉心を制圧した" : "列車が止まった";
  const resultCopy = state.won
    ? "七つの区画を抜け、最初の鉄塊が王の炉心まで届きました。次は別の順番で同じ問いを試せます。"
    : `${state.reason || "敵の反撃で列車が止まりました"}。車列のどこを入れ替えれば、同じ敵に別の答えが返るかを残してください。`;
  const sent = state.telemetry?.sentAt ? "送信済み" : state.telemetry?.error ? "再送待ち" : "未送信";
  return `
    <section class="panel done-panel ${state.won ? "success" : "failure"}">
      <p class="kicker">RUN COMPLETE / ${escapeHtml(sent)}</p><h2>${resultTitle}</h2><p>${resultCopy}</p>
      <div class="result-stats"><span>到達 <strong>${state.stage}/${MAX_STAGES}</strong></span><span>車体 <strong>${state.hull}/${MAX_HULL}</strong></span><span>車両 <strong>${state.activeCars.length}/${MAX_CARS}</strong></span></div>
      ${renderSurvey()}
    </section>
  `;
}

function renderSurvey() {
  if (state.survey) {
    return `<div class="survey-sent"><strong>回答を保存しました。</strong><span>${state.telemetry?.error ? escapeHtml(state.telemetry.error) : "このプレイの因果ログと一緒に送信します。"}</span><button class="button secondary" data-action="new-run">新しい列車を始める</button></div>`;
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

function render() {
  if (!app) return;
  const challenge = challengeFor(state.stage);
  const status = state.telemetry?.error ? `<p class="sync-error" role="status">ログ送信: ${escapeHtml(state.telemetry.error)}</p>` : "";
  app.innerHTML = `
    <main class="shell">
      <header class="hero">
        <div><p class="eyebrow">NEW ROUTE / SCRAPLINE</p><h1>ガラクタ列車</h1><p class="lead">鉄塊を一つだけ、車列の順番で別の答えに変える。</p></div>
        <div class="stamp"><span>${VERSION}</span><span>seed ${state.seed}</span><span>${BUILD_STAMP}</span></div>
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
  result.report.events.slice(0, 150).forEach((event) => {
    if (["car", "fire", "impact", "return", "enemy_attack", "wave_clear"].includes(event.type)) {
      recordTelemetry(state, { type: "battle_event", stage: result.report.stage, eventType: event.type, carId: event.carId || null, damage: event.damage || 0 });
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

function newRun() {
  const next = createGame(querySeed());
  recordTelemetry(next, { type: "run_started", seed: next.seed, restarted: true });
  selectedSlot = null;
  setState(next);
}

app?.addEventListener("click", (event) => {
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
  } else if (action === "install") {
    handleInstall(button.dataset.car);
  } else if (action === "skip-reward") {
    setState(skipReward(state), { type: "reward_skipped", stage: state.stage });
  } else if (action === "marker") {
    const form = document.querySelector("#marker-form");
    if (form) submitMarker(form, button.dataset.marker);
  } else if (action === "new-run") {
    newRun();
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

ensureTelemetry(state);
persist();
render();
