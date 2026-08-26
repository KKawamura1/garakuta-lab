import {
  CHALLENGES,
  MAX_HULL,
  MAX_STAGES,
  SLOT_COUNT,
  VERSION,
  continueAfterBattle,
  createGame,
  currentChallenge,
  currentOffers,
  getModule,
  installModule,
  moveSlot,
  normalizeSeed,
  removeSlot,
  runStage,
  skipOffer,
  summary
} from "./engine.mjs";
import {
  buildPayload,
  ensureTelemetry,
  recordTelemetry,
  sendEmberlineTelemetry
} from "./telemetry.mjs";

const BUILD_STAMP = "emberline-20260826-a";
const STATE_KEY = "emberline-current-v1";
const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const rawQuerySeed = params.get("seed");
const querySeed = rawQuerySeed == null || rawQuerySeed === "" ? Number.NaN : Number(rawQuerySeed);

function randomSeed() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return normalizeSeed(values[0]);
  }
  return normalizeSeed(Date.now());
}

const initialSeed = Number.isFinite(querySeed) ? normalizeSeed(querySeed) : randomSeed();
let state = loadState() || createGame(initialSeed);
let pendingOffer = state.pendingOffer || null;
let message = state.message || "廃材を一つ拾い、穴へ置いたら走行する。";

ensureTelemetry(state);
if (!state.telemetry.events.length) {
  recordTelemetry(state, {
    type: "run_started",
    gameVersion: VERSION,
    buildStamp: BUILD_STAMP,
    seed: state.seed,
    challenges: state.challenges,
    starter: state.slots
  });
  recordTelemetry(state, {
    type: "offer_seen",
    stage: state.stage,
    offers: state.offersByStage[state.stage]
  });
}
persist();
render();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    const seedMatchesUrl = Number.isFinite(querySeed) ? saved?.seed === initialSeed : Number.isFinite(saved?.seed);
    return saved?.version === VERSION && seedMatchesUrl ? saved : null;
  } catch {
    return null;
  }
}

function persist() {
  state.pendingOffer = pendingOffer;
  state.message = message;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function phaseLabel() {
  if (state.done) return "result";
  return `${state.phase}-${state.stage + 1}`;
}

function challengeForStage(stage) {
  return CHALLENGES.find(challenge => challenge.id === state.challenges[stage]) || CHALLENGES[0];
}

function meter(label, value, max, className = "") {
  const ratio = Math.max(0, Math.min(1, max ? value / max : 0));
  return `<div class="meter ${className}"><div class="meter-label"><span>${label}</span><strong>${value}<small> / ${max}</small></strong></div><div class="meter-track"><i style="width:${ratio * 100}%"></i></div></div>`;
}

function stageTrack() {
  return Array.from({ length: MAX_STAGES }, (_, index) => {
    const history = state.history[index];
    const current = index === state.stage && !state.done;
    const label = history ? (history.cleared ? "✓" : "×") : index + 1;
    return `<span class="stage-dot ${history ? (history.cleared ? "cleared" : "missed") : ""} ${current ? "current" : ""}" title="${esc(challengeForStage(index).name)}">${label}</span>`;
  }).join("");
}

function missionPanel() {
  return `<section class="mission"><div><span class="eyebrow">目的</span><strong>火種を灯台へ運ぶ</strong><p>5区画を越える。部品は左から順番に動き、守りが足りないと船体が傷つく。</p></div><div class="meters">${meter("船体", state.hull, MAX_HULL, "hull-meter")}${meter("火花", state.spark, 8, "spark-meter")}${meter("熱", state.heat, 9, "heat-meter")}</div></section>`;
}

function challengePanel() {
  const challenge = state.done ? null : currentChallenge(state);
  if (!challenge) return "";
  return `<section class="challenge"><div class="challenge-heading"><span class="eyebrow">区画 ${state.stage + 1} / ${MAX_STAGES}</span><h2><b>${challenge.icon}</b>${esc(challenge.name)}</h2></div><p>${esc(challenge.text)}</p><div class="challenge-rule"><span>今回の問い</span><strong>${esc(challenge.rule)}</strong><em>必要な前進 ${challenge.need}　/　圧力 ${challenge.pressure}</em></div></section>`;
}

function slotMarkup(moduleId, index) {
  const module = moduleId ? getModule(moduleId) : null;
  const placing = Boolean(pendingOffer);
  return `<div class="slot ${module ? "occupied" : "empty"} ${placing ? "place-target" : ""}" style="--module-color:${module?.color || "#4e566e"}"><div class="slot-number">穴 ${index + 1}</div>${placing ? `<button class="slot-place" data-place-slot="${index}" aria-label="穴${index + 1}へ置く">${module ? "交換" : "ここへ置く"}</button>` : module ? `<div class="module-glyph">${module.icon}</div><div class="module-name">${esc(module.name)}</div><div class="module-effect">${esc(module.effect)}</div><div class="slot-controls"><button data-move-slot="${index},${index - 1}" ${index === 0 ? "disabled" : ""} aria-label="${esc(module.name)}を左へ">←</button><button data-move-slot="${index},${index + 1}" ${index === SLOT_COUNT - 1 ? "disabled" : ""} aria-label="${esc(module.name)}を右へ">→</button><button data-remove-slot="${index}" ${moduleId === "wheel" ? "disabled" : ""}>外す</button></div>` : `<div class="empty-hole">空き穴</div>`}</div>`;
}

function machinePanel() {
  const slots = state.slots.map((moduleId, index) => slotMarkup(moduleId, index)).join("");
  const placement = pendingOffer ? `<div class="placement-note"><span>手に持っている廃材</span><strong>${getModule(pendingOffer)?.icon} ${esc(getModule(pendingOffer)?.name)}</strong><button data-cancel-offer>戻す</button></div>` : "";
  return `<section class="machine"><div class="section-heading"><div><span class="eyebrow">走行機関 / 4穴</span><h2>左から順番に動く</h2></div><span class="direction">1 → 2 → 3 → 4</span></div>${placement}<div class="slots">${slots}</div><p class="machine-help">廃材を拾ったら穴へ置く。矢印で順序を変え、結果を見て次を直す。</p></section>`;
}

function scrapMarkup(module) {
  return `<button class="scrap" data-offer="${module.id}" style="--module-color:${module.color}"><span class="scrap-icon">${module.icon}</span><span class="scrap-copy"><strong>${esc(module.name)}</strong><em>${esc(module.effect)}</em><small>${esc(module.description)}</small></span><b>拾う</b></button>`;
}

function buildPanel() {
  if (state.done || state.phase !== "build") return "";
  if (pendingOffer) return `<section class="salvage waiting"><span class="eyebrow">装着先を選ぶ</span><p>手に持った廃材を、空き穴か交換したい穴へ置く。</p></section>`;
  if (state.ready) return `<section class="salvage ready"><span class="eyebrow">走行準備完了</span><p>この並びで区画へ進む。走行中は部品が左から一つずつ動く。</p><button class="primary run-button" data-run-stage>この並びで走る →</button></section>`;
  const offers = currentOffers(state).map(scrapMarkup).join("");
  return `<section class="salvage"><div class="section-heading"><div><span class="eyebrow">今回の廃材</span><h2>一つ拾うか、見送る</h2></div><span>3つから1つ</span></div><div class="scrap-list">${offers}</div><button class="skip-button" data-skip-offer>今回は見送る（機関は変えない）</button></section>`;
}

function eventClass(kind) {
  return ["force", "guard", "spark", "heat", "reason", "success", "damage", "fail"].includes(kind) ? kind : "info";
}

function battlePanel() {
  if (state.done || state.phase !== "battle" || !state.stageResult) return "";
  const result = state.stageResult;
  const challenge = challengeForStage(result.stage);
  const logs = result.log.map(entry => `<li class="${eventClass(entry.kind)}">${entry.moduleId ? `<span class="log-source">${esc(getModule(entry.moduleId)?.name || entry.moduleId)}</span>` : ""}<span>${esc(entry.text)}</span></li>`).join("");
  return `<section class="battle"><div class="battle-top"><div><span class="eyebrow">走行結果</span><h2>${challenge.icon} ${esc(challenge.name)}</h2></div><div class="battle-score ${result.cleared ? "good" : "bad"}"><strong>${result.progress}</strong><small> / ${result.need} 前進</small></div></div><ul class="battle-log">${logs}</ul><div class="battle-summary"><span>${result.cleared ? "区画を抜けた" : "前進が足りず、足が止まった"}</span><b>${result.damage ? `船体 −${result.damage}` : "損傷なし"}</b></div><button class="primary" data-next-stage>次の区画へ →</button></section>`;
}

function historyPanel() {
  if (!state.history.length || state.done) return "";
  return `<section class="history"><div class="section-heading"><span class="eyebrow">ここまでの走行</span><span>${state.history.length} / ${MAX_STAGES}</span></div>${state.history.map(entry => `<div class="history-row"><span>${entry.stage + 1}. ${esc(entry.challengeName)}</span><b class="${entry.cleared ? "ok" : "ng"}">${entry.cleared ? "通過" : "停滞"}</b><em>${entry.progress}/${entry.need}　損傷${entry.damage}</em></div>`).join("")}</section>`;
}

function finalPanel() {
  if (!state.done) return "";
  const result = summary(state);
  const title = result.won ? "灯台に届いた" : result.reason === "hull_broken" ? "機関が止まった" : "灯台まで届かなかった";
  const body = result.won
    ? "火種は、あなたが組んだ機関に運ばれて頂上で灯った。"
    : "届かなかった区画と、発動した部品の順番が次の手がかりになる。";
  const rows = result.history.map(entry => `<li><span>${entry.stage + 1}</span><strong>${esc(entry.challengeName)}</strong><em>${entry.cleared ? "通過" : "停滞"} ${entry.progress}/${entry.need} / 損傷${entry.damage}</em></li>`).join("");
  if (state.survey) return `<section class="final"><span class="eyebrow">走行終了</span><h2>${title}</h2><p>${body}</p><div class="final-build">${result.slots.map((id, index) => `<span>${index + 1}. ${id ? `${getModule(id)?.icon} ${esc(getModule(id)?.name)}` : "空"}</span>`).join("")}</div><ol class="final-history">${rows}</ol><p class="send-status">${esc(state.sendState || "送信待ち")}</p><button class="primary" data-new-run>別の廃材で、もう一度組む</button>${state.telemetry?.error ? `<button class="secondary" data-resend>記録を再送</button>` : ""}</section>`;
  return `<section class="final"><span class="eyebrow">走行終了</span><h2>${title}</h2><p>${body}</p><div class="final-build">${result.slots.map((id, index) => `<span>${index + 1}. ${id ? `${getModule(id)?.icon} ${esc(getModule(id)?.name)}` : "空"}</span>`).join("")}</div><ol class="final-history">${rows}</ol><form id="survey"><div class="survey-title">今回の感触を残す</div><label>面白さ（1〜5）<select name="fun" required><option value="">選んでください</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n}</option>`).join("")}</select></label><label>もう一度、別の廃材で組みたい（1〜5）<select name="replay" required><option value="">選んでください</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n}</option>`).join("")}</select></label><label>一番よかった瞬間<textarea name="bestMoment" maxlength="240" placeholder="任意"></textarea></label><label>引っかかった点<textarea name="friction" maxlength="240" placeholder="任意"></textarea></label><label>次に試したい手<textarea name="nextPlan" maxlength="240" placeholder="思いつけば"></textarea></label><button class="primary" type="submit">回答して記録を保存</button></form><p class="send-status">${esc(state.sendState || "未送信")}</p></section>`;
}

function markerPanel() {
  const markers = [["spark", "ひらめいた"], ["choice", "迷った"], ["payoff", "きた！"], ["friction", "つらい"], ["unclear", "わからない"], ["bored", "退屈"], ["worry", "不安"]];
  return `<section class="marker-panel"><div class="section-heading"><div><span class="eyebrow">リアルタイム記録</span><h2>いまの感触</h2></div><span>任意 / 何度でも</span></div><div class="markers">${markers.map(([id, label]) => `<button data-marker="${id}">${label}</button>`).join("")}</div><input id="marker-note" maxlength="160" value="${esc(state.noteDraft || "")}" placeholder="任意メモ：何が起きた？" /><p>マーカーの前後どちらでメモを書いても、直近のマーカーに紐づきます。</p></section>`;
}

function render() {
  const eventCount = state.telemetry?.events?.length || 0;
  app.innerHTML = `<main class="shell"><header class="topbar"><div><span class="eyebrow">INDEPENDENT PROTOTYPE</span><h1>火走り <em>EMBERLINE</em></h1></div><div class="stamp">${VERSION}<br />build ${BUILD_STAMP}</div></header><section class="mission-intro"><p>拾った廃材で機関を組み、火種を灯台へ運ぶ。</p><div class="stage-track" aria-label="5区画の進行">${stageTrack()}</div></section>${missionPanel()}${challengePanel()}${state.done ? finalPanel() : state.phase === "battle" ? battlePanel() : `${machinePanel()}${buildPanel()}${historyPanel()}`}<section class="event-count">${eventCount} events / seedは記録のみ</section>${markerPanel()}<footer><span>${esc(message)}</span><span>${esc(state.sendState || "未送信")}</span></footer></main>`;
}

function recordOfferSeen() {
  recordTelemetry(state, { type: "offer_seen", stage: state.stage, offers: state.offersByStage[state.stage] });
}

function handleOffer(moduleId) {
  if (state.done || state.phase !== "build" || state.ready) return;
  if (!currentOffers(state).some(module => module.id === moduleId)) return;
  pendingOffer = moduleId;
  state.noteDraft ||= "";
  recordTelemetry(state, { type: "module_considered", stage: state.stage, moduleId, offers: state.offersByStage[state.stage] });
  message = `${getModule(moduleId)?.name}をどの穴へ置く？`;
  persist();
  render();
}

function placeOffer(slotIndex) {
  if (!pendingOffer) return;
  const selected = pendingOffer;
  const outcome = installModule(state, selected, slotIndex);
  if (!outcome.result.ok) {
    message = outcome.result.message;
    render();
    return;
  }
  state = outcome.state;
  pendingOffer = null;
  recordTelemetry(state, {
    type: "module_chosen",
    stage: state.stage,
    moduleId: selected,
    slotIndex,
    replaced: outcome.result.replaced,
    offers: state.offersByStage[state.stage],
    slots: state.slots
  });
  message = outcome.result.replaced ? `${getModule(selected)?.name}を交換した。矢印で順番も変えられる。` : `${getModule(selected)?.name}を装着した。矢印で順番も変えられる。`;
  persist();
  render();
}

function doSkipOffer() {
  const outcome = skipOffer(state);
  if (!outcome.result.ok) return;
  state = outcome.state;
  pendingOffer = null;
  recordTelemetry(state, { type: "offer_skipped", stage: state.stage, offers: state.offersByStage[state.stage], slots: state.slots });
  message = "今回は機関を変えない。";
  persist();
  render();
}

function doMoveSlot(from, to) {
  const outcome = moveSlot(state, from, to);
  if (!outcome.result.ok) return;
  state = outcome.state;
  recordTelemetry(state, { type: "slot_moved", stage: state.stage, from, to, slots: state.slots });
  message = "順番を変えた。左から発動する。";
  persist();
  render();
}

function doRemoveSlot(slotIndex) {
  const outcome = removeSlot(state, slotIndex);
  if (!outcome.result.ok) {
    message = outcome.result.message;
    render();
    return;
  }
  state = outcome.state;
  recordTelemetry(state, { type: "slot_removed", stage: state.stage, slotIndex, slots: state.slots });
  message = "部品を外した。見送る余地も残しておく。";
  persist();
  render();
}

function doRunStage() {
  const beforeStage = state.stage;
  recordTelemetry(state, { type: "stage_started", stage: beforeStage, challengeId: state.challenges[beforeStage], slots: state.slots, spark: state.spark, heat: state.heat });
  const outcome = runStage(state);
  if (!outcome.result.ok) {
    message = outcome.result.message;
    render();
    return;
  }
  state = outcome.state;
  const battle = outcome.result.battle;
  recordTelemetry(state, {
    type: "stage_resolved",
    stage: battle.stage,
    challengeId: battle.challengeId,
    before: battle.before,
    after: battle.after,
    progress: battle.progress,
    need: battle.need,
    damage: battle.damage,
    cleared: battle.cleared,
    chainCount: battle.chainCount,
    battleLog: battle.log
  });
  if (state.done) {
    recordTelemetry(state, { type: "run_ended", won: state.won, reached: state.history.length, hull: state.hull, reason: state.endReason, slots: state.slots });
    message = state.won ? "灯台に火がついた。" : "機関が止まった。次に直す場所が見える。";
  } else {
    message = battle.cleared ? "通過した。次の廃材が来る。" : "足が止まった。次は順番か部品を変える。";
  }
  persist();
  render();
}

function doNextStage() {
  const outcome = continueAfterBattle(state);
  if (!outcome.result.ok) return;
  state = outcome.state;
  recordOfferSeen();
  message = "次の区画。いまの機関に何を足す？";
  persist();
  render();
}

function markEmotion(kind) {
  const note = String(state.noteDraft || "").trim();
  recordTelemetry(state, { type: "emotion_marked", kind, phase: phaseLabel(), stage: state.stage + 1, note });
  message = "感触を記録した。";
  persist();
  render();
}

function updateNote(value) {
  state.noteDraft = value;
  const phase = phaseLabel();
  const latest = [...(state.telemetry?.events || [])].reverse().find(event => event.type === "emotion_marked" && event.phase === phase);
  if (latest) latest.note = value.trim();
  persist();
}

async function submitSurvey(form) {
  const data = new FormData(form);
  state.survey = {
    fun: Number(data.get("fun")),
    replay: Number(data.get("replay")),
    bestMoment: String(data.get("bestMoment") || "").trim(),
    friction: String(data.get("friction") || "").trim(),
    nextPlan: String(data.get("nextPlan") || "").trim()
  };
  recordTelemetry(state, { type: "survey_submitted", ...state.survey });
  state.sendState = "送信中…";
  persist();
  render();
  const result = await sendEmberlineTelemetry(state);
  state.sendState = result.ok ? "D1送信済み" : `D1未送信：${result.error || "後で再試行"}`;
  persist();
  render();
}

async function resend() {
  state.sendState = "再送中…";
  persist();
  render();
  const result = await sendEmberlineTelemetry(state);
  state.sendState = result.ok ? "D1送信済み" : `D1未送信：${result.error || "後で再試行"}`;
  persist();
  render();
}

function newRun() {
  const nextSeed = randomSeed();
  state = createGame(nextSeed);
  pendingOffer = null;
  message = "新しい廃材が来た。まず一つ拾う。";
  ensureTelemetry(state);
  recordTelemetry(state, { type: "run_started", gameVersion: VERSION, buildStamp: BUILD_STAMP, seed: state.seed, challenges: state.challenges, starter: state.slots });
  recordOfferSeen();
  persist();
  render();
}

app.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.offer) return handleOffer(target.dataset.offer);
  if (target.dataset.placeSlot) return placeOffer(Number(target.dataset.placeSlot));
  if (target.dataset.cancelOffer !== undefined) {
    pendingOffer = null;
    message = "廃材を戻した。";
    persist();
    render();
    return;
  }
  if (target.dataset.skipOffer !== undefined) return doSkipOffer();
  if (target.dataset.moveSlot) {
    const [from, to] = target.dataset.moveSlot.split(",").map(Number);
    if (Number.isInteger(from) && Number.isInteger(to) && to >= 0 && to < SLOT_COUNT) return doMoveSlot(from, to);
    return;
  }
  if (target.dataset.removeSlot) return doRemoveSlot(Number(target.dataset.removeSlot));
  if (target.dataset.runStage !== undefined) return doRunStage();
  if (target.dataset.nextStage !== undefined) return doNextStage();
  if (target.dataset.marker) return markEmotion(target.dataset.marker);
  if (target.dataset.newRun !== undefined) return newRun();
  if (target.dataset.resend !== undefined) return resend();
});

app.addEventListener("input", event => {
  if (event.target.id === "marker-note") updateNote(event.target.value);
});

app.addEventListener("submit", event => {
  if (event.target.id !== "survey") return;
  event.preventDefault();
  submitSurvey(event.target);
});

// Keep the payload shape inspectable during local checks without sending it.
export { BUILD_STAMP, buildPayload };
