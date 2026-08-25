import {
  ACTIONS,
  HEAT_LIMIT,
  MAX_STAGES,
  VERSION,
  actionById,
  createGame,
  currentSituation,
  planLabel,
  playAction,
  summary
} from "./engine.mjs";
import {
  ECHO_GAME_VERSION,
  buildEchoPayload,
  ensureTelemetry,
  recordTelemetry,
  sendEchoTelemetry
} from "./telemetry.mjs";

const STATE_KEY = "echo-state-v1";
const GHOST_KEY = "echo-ghost-v1";
const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const seed = Number.isFinite(Number(params.get("seed"))) ? Number(params.get("seed")) : 12;

const MARKERS = [
  ["spark", "閃き"],
  ["hesitate", "迷い"],
  ["surge", "勢い"],
  ["worry", "不安"],
  ["bored", "退屈"]
];

let state = loadState() || createGame(seed, loadGhost());
let message = "";
let sendState = "未送信";
ensureTelemetry(state);
if (!state.telemetry.events.length) {
  recordTelemetry(state, { type: "run_started", seed: state.seed, previousScore: state.ghost?.score ?? null });
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

function loadGhost() {
  try {
    const ghost = JSON.parse(localStorage.getItem(GHOST_KEY) || "null");
    return ghost?.plan ? ghost : null;
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

function actionName(actionId) {
  return actionById(actionId)?.name || actionId || "—";
}

function ghostPanel() {
  const ghost = state.ghost;
  if (!ghost) {
    return `<div class="ghost empty"><span class="eyebrow">残響</span><strong>まだ前回の自分はいない</strong><p>まず1回走り、次の走行で手順を見比べる。</p></div>`;
  }
  const icons = Array.from({ length: MAX_STAGES }, (_, index) => {
    const id = ghost.plan?.[index];
    const current = index === state.stage;
    return `<span class="ghost-step ${current ? "current" : ""}" title="${esc(actionName(id))}">${id ? actionIcon(id) : "·"}</span>`;
  }).join("");
  return `<div class="ghost"><div class="ghost-heading"><span class="eyebrow">前回の残響</span><strong>${esc(ghost.score)}部品</strong></div><div class="ghost-plan">${icons}</div><p>同じ手なら熱−1、違う手なら部品+2。どこを書き換える？</p></div>`;
}

function stageTrack() {
  return Array.from({ length: MAX_STAGES }, (_, index) => {
    const current = index === state.stage && !state.done;
    const done = index < state.stage;
    const ghost = state.ghost?.plan?.[index];
    return `<span class="stage-dot ${done ? "done" : ""} ${current ? "current" : ""}" title="区画${index + 1}">${done ? actionIcon(state.plan[index]) : ghost ? actionIcon(ghost) : index + 1}</span>`;
  }).join("");
}

function actionButtons() {
  if (state.done) return "";
  const situation = currentSituation(state);
  return ACTIONS.map(action => `<button class="action action-${action.id}" data-action="${action.id}">
    <span class="action-icon">${action.icon}</span><span><strong>${action.name}</strong><small>${action.description}</small></span>
  </button>`).join("") + `<p class="rule-note">この区画の圧力 <b>${situation.pressure}</b> ／ 回収量 <b>${situation.yield}</b>　熱が${HEAT_LIMIT}を超えると崩壊。</p>`;
}

function markerPanel() {
  return `<section class="marker-panel"><div class="section-heading"><span class="eyebrow">途中の感触</span><span>いつでも1タップ</span></div><div class="markers">${MARKERS.map(([id, label]) => `<button data-marker="${id}">${label}</button>`).join("")}</div><div class="marker-input"><input id="marker-note" maxlength="80" placeholder="任意メモ：何が起きた？" /><button data-mark-note>記録</button></div></section>`;
}

function resultPanel() {
  const result = summary(state);
  const reason = state.won ? "6区画を抜けた" : "熱が限界を超えた";
  const compare = result.previousScore == null ? "前回なし" : `前回 ${result.previousScore}部品 → 今回 ${result.score}部品`;
  if (state.survey) {
    return `<section class="result"><span class="eyebrow">走行終了</span><h2>${state.won ? "出口に出た" : "機関が崩れた"}</h2><p>${reason}。${compare}</p><div class="final-plan">${planLabel(result.plan)}</div><p class="sent-state">${esc(sendState)}</p><button class="primary" data-new-run>この残響を書き換える</button></section>`;
  }
  return `<section class="result"><span class="eyebrow">走行終了</span><h2>${state.won ? "出口に出た" : "機関が崩れた"}</h2><p>${reason}。${compare}</p><div class="final-plan">${planLabel(result.plan)}</div><form id="survey"><label>面白さ <select name="fun" required><option value="">選択</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join("")}</select></label><label>今すぐもう一度やりたい度 <select name="replay" required><option value="">選択</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join("")}</select></label><label>一番よかった瞬間 <textarea name="bestMoment" maxlength="160" placeholder="任意"></textarea></label><label>引っかかった点 <textarea name="friction" maxlength="160" placeholder="任意"></textarea></label><label>次に試したい手 <textarea name="nextPlan" maxlength="160" placeholder="例：3区画目だけ違う手にする"></textarea></label><button class="primary" type="submit">回答して残響を保存</button></form></section>`;
}

function render() {
  const situation = currentSituation(state);
  const logs = (state.log || []).slice(-7).reverse().map(entry => `<li class="${esc(entry.kind)}"><span>${entry.stage + 1}</span>${esc(entry.text)}</li>`).join("");
  app.innerHTML = `<main class="shell"><header class="topbar"><div><span class="eyebrow">INDEPENDENT PROTOTYPE</span><h1>残響工房 <em>ECHO</em></h1></div><div class="stamp">${ECHO_GAME_VERSION}<br />seed ${state.seed}</div></header><section class="intro"><p>前回の自分は、倒す相手ではなく書き換える足跡だ。</p><div class="stage-track">${stageTrack()}</div></section>${ghostPanel()}${state.done ? resultPanel() : `<section class="machine"><div class="machine-meta"><div><span class="eyebrow">区画 ${state.stage + 1} / ${MAX_STAGES}</span><h2>${esc(situation.name)}</h2><p>${esc(situation.text)}</p></div><div class="meters"><span>部品 <b>${state.score}</b></span><span class="heat-meter">熱 <b>${state.heat}</b> / ${HEAT_LIMIT}</span></div></div><div class="actions">${actionButtons()}</div></section>`}<section class="log"><div class="section-heading"><span class="eyebrow">足跡</span><span>${state.telemetry?.events?.length || 0} events</span></div><ol>${logs || "<li>まだ足跡はない</li>"}</ol></section>${markerPanel()}<footer><span>${esc(message || "6手で終わる。結果より、次に変えたい1手を探す。")}</span><span>${esc(sendState)}</span></footer></main>`;
}

function handleAction(actionId) {
  const previousStage = state.stage;
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
    echo: outcome.result.echo,
    scoreAfter: state.score,
    heatAfter: state.heat
  });
  if (state.done) {
    recordTelemetry(state, { type: "run_finished", won: state.won, score: state.score, heat: state.heat, reason: state.endReason });
    message = "終わった。前回と同じ手か、違う手か。";
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
  const ghost = state.done ? summary(state) : loadGhost();
  if (state.done) localStorage.setItem(GHOST_KEY, JSON.stringify(ghost));
  state = createGame(seed, ghost);
  ensureTelemetry(state);
  recordTelemetry(state, { type: "run_started", seed: state.seed, previousScore: state.ghost?.score ?? null });
  message = state.ghost ? "前回の足跡を表示した。1手だけでも書き換えてみる。" : "最初の走行。足跡を残す。";
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
  localStorage.setItem(GHOST_KEY, JSON.stringify(summary(state)));
  persist();
  sendState = "送信中…";
  render();
  const result = await sendEchoTelemetry(state);
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
