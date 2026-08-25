import {
  ACTIONS,
  DANGER_LIMIT,
  MAX_HULL,
  MAX_STAGES,
  TARGET_CARGO,
  VERSION,
  actionById,
  createGame,
  currentSituation,
  planLabel,
  playAction,
  summary
} from "./engine.mjs";
import {
  HAUL_GAME_VERSION,
  ensureTelemetry,
  recordTelemetry,
  sendHaulTelemetry
} from "./telemetry.mjs";

const STATE_KEY = "haul-state-v1";
const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const rawSeed = params.get("seed");
const parsedSeed = Number(rawSeed);
const seed = rawSeed == null || rawSeed === "" || !Number.isFinite(parsedSeed) ? 12 : parsedSeed;

const MARKERS = [
  ["spark", "閃き"],
  ["hesitate", "迷い"],
  ["surge", "勢い"],
  ["worry", "不安"],
  ["bored", "退屈"]
];

let state = loadState() || createGame(seed);
let message = "";
let sendState = "未送信";
ensureTelemetry(state);
if (!state.telemetry.events.length) {
  recordTelemetry(state, { type: "run_started", seed: state.seed, sequence: state.sequence });
}
persist();
render();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    return saved?.version === VERSION && saved?.seed === Math.abs(Math.floor(seed)) % 100000 ? saved : null;
  } catch {
    return null;
  }
}

function persist() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function actionIcon(actionId) {
  return actionById(actionId)?.icon || "?";
}

function stageTrack() {
  return Array.from({ length: MAX_STAGES }, (_, index) => {
    const current = index === state.stage && !state.done;
    const done = index < state.stage;
    return `<span class="stage-dot ${done ? "done" : ""} ${current ? "current" : ""}" title="区画${index + 1}">${done ? actionIcon(state.plan[index]) : index + 1}</span>`;
  }).join("");
}

function meter(label, value, limit, className = "") {
  return `<div class="meter ${className}"><span>${label}</span><strong>${value}<small> / ${limit}</small></strong></div>`;
}

function missionPanel() {
  return `<section class="mission"><div><span class="eyebrow">MISSION</span><strong>帰還艇を直す</strong><p>部品を${TARGET_CARGO}個持ち帰り、沈没区画から戻る。</p></div><div class="meters">${meter("部品", state.cargo, TARGET_CARGO, "cargo-meter")}${meter("危険", state.danger, DANGER_LIMIT, "danger-meter")}${meter("船体", state.hull, MAX_HULL, "hull-meter")}</div></section>`;
}

function actionButtons() {
  if (state.done) return "";
  const situation = currentSituation(state);
  return ACTIONS.map(action => `<button class="action action-${action.id}" data-action="${action.id}">
    <span class="action-icon">${action.icon}</span><span><strong>${action.name}</strong><small>${action.description}</small></span>
  </button>`).join("") + `<p class="rule-note">この区画の脅威 <b>${situation.threat}</b> ／ 回収 <b>${situation.yield}</b> ／ 深掘り <b>${situation.deepYield}</b></p>`;
}

function markerPanel() {
  return `<section class="marker-panel"><div class="section-heading"><span class="eyebrow">途中の感触</span><span>いつでも1タップ</span></div><div class="markers">${MARKERS.map(([id, label]) => `<button data-marker="${id}">${label}</button>`).join("")}</div><div class="marker-input"><input id="marker-note" maxlength="80" placeholder="任意メモ：何が起きた？" /><button data-mark-note>記録</button></div></section>`;
}

function resultPanel() {
  const result = summary(state);
  const title = state.won ? "帰還艇が起動した" : state.endReason === "hull_broken" ? "船体が限界を迎えた" : "部品が足りない";
  const body = state.won
    ? `部品${result.cargo}個を積み、船体${result.hull}で帰還した。`
    : state.endReason === "hull_broken"
      ? `危険に耐えられず、部品${result.cargo}個を残した。`
      : `部品は${result.cargo}個。帰還に${TARGET_CARGO}個必要だった。`;
  if (state.survey) {
    return `<section class="result"><span class="eyebrow">潜航終了</span><h2>${title}</h2><p>${body}</p><div class="final-status">部品 ${result.cargo}/${TARGET_CARGO}　危険 ${result.danger}/${DANGER_LIMIT}　船体 ${result.hull}/${MAX_HULL}</div><div class="final-plan">${planLabel(result.plan)}</div><p class="sent-state">${esc(sendState)}</p><button class="primary" data-new-run>もう一度、別の判断で潜る</button></section>`;
  }
  return `<section class="result"><span class="eyebrow">潜航終了</span><h2>${title}</h2><p>${body}</p><div class="final-status">部品 ${result.cargo}/${TARGET_CARGO}　危険 ${result.danger}/${DANGER_LIMIT}　船体 ${result.hull}/${MAX_HULL}</div><div class="final-plan">${planLabel(result.plan)}</div><form id="survey"><label>面白さ <select name="fun" required><option value="">選択</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join("")}</select></label><label>今すぐもう一度やりたい度 <select name="replay" required><option value="">選択</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join("")}</select></label><label>一番よかった瞬間 <textarea name="bestMoment" maxlength="160" placeholder="任意"></textarea></label><label>引っかかった点 <textarea name="friction" maxlength="160" placeholder="任意"></textarea></label><label>次に試したい手 <textarea name="nextPlan" maxlength="160" placeholder="例：3区画目で安定させず深掘りする"></textarea></label><button class="primary" type="submit">回答して潜航記録を保存</button></form></section>`;
}

function render() {
  const situation = currentSituation(state);
  const logs = (state.log || []).slice(-7).reverse().map(entry => `<li class="${esc(entry.kind)}"><span>${entry.stage + 1}</span>${esc(entry.text)}</li>`).join("");
  app.innerHTML = `<main class="shell"><header class="topbar"><div><span class="eyebrow">INDEPENDENT PROTOTYPE</span><h1>持ち帰り限界 <em>HAUL</em></h1></div><div class="stamp">${HAUL_GAME_VERSION}<br />seed ${state.seed}</div></header><section class="intro"><p>部品を持ち帰るには、深く潜るだけでは足りない。</p><div class="stage-track">${stageTrack()}</div></section>${missionPanel()}${state.done ? resultPanel() : `<section class="machine"><div class="machine-meta"><div><span class="eyebrow">区画 ${state.stage + 1} / ${MAX_STAGES}</span><h2>${esc(situation.name)}</h2><p>${esc(situation.text)}</p></div></div><div class="actions">${actionButtons()}</div></section>`}<section class="log"><div class="section-heading"><span class="eyebrow">潜航記録</span><span>${state.telemetry?.events?.length || 0} events</span></div><ol>${logs || "<li>まだ記録はない</li>"}</ol></section>${markerPanel()}<footer><span>${esc(message || "安全に回収するか、深く潜るか。部品と危険を見て決める。")}</span><span>${esc(sendState)}</span></footer></main>`;
}

function handleAction(actionId) {
  const previousStage = state.stage;
  const situation = currentSituation(state);
  const outcome = playAction(state, actionId);
  if (!outcome.result.ok) {
    message = outcome.result.message;
    render();
    return;
  }
  state = outcome.state;
  recordTelemetry(state, {
    type: "action_chosen",
    stage: previousStage,
    action: actionId,
    situationId: situation.id,
    threat: situation.threat,
    yield: situation.yield,
    deepYield: situation.deepYield,
    before: outcome.result.before,
    after: outcome.result.after,
    cargoGain: outcome.result.cargoGain,
    collapse: outcome.result.collapse
  });
  if (state.done) {
    recordTelemetry(state, { type: "run_finished", won: state.won, cargo: state.cargo, danger: state.danger, hull: state.hull, reason: state.endReason });
    message = "潜航が終わった。次に変える区画を決める。";
  } else {
    message = outcome.result.text;
  }
  persist();
  render();
}

function mark(kind, note = "") {
  recordTelemetry(state, { type: "emotion_marked", kind, phase: state.done ? "result" : `stage-${state.stage + 1}`, note: note.trim() });
  message = "感触を記録した。";
  persist();
  render();
}

function newRun() {
  state = createGame(seed);
  ensureTelemetry(state);
  recordTelemetry(state, { type: "run_started", seed: state.seed, sequence: state.sequence });
  message = "同じseedでも、次は危険を見て判断を変える。";
  sendState = "未送信";
  persist();
  render();
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
  persist();
  sendState = "送信中…";
  render();
  const result = await sendHaulTelemetry(state);
  sendState = result.ok ? "D1送信済み" : `D1未送信：${result.error || "後で再試行"}`;
  persist();
  render();
}

app.addEventListener("click", event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action) return handleAction(action);
  const marker = event.target.closest("[data-marker]")?.dataset.marker;
  if (marker) return mark(marker);
  if (event.target.closest("[data-mark-note]")) return mark("note", document.querySelector("#marker-note")?.value || "");
  if (event.target.closest("[data-new-run]")) return newRun();
});

app.addEventListener("submit", event => {
  if (event.target.id !== "survey") return;
  event.preventDefault();
  submitSurvey(event.target);
});
