import {
  ACTIONS,
  DAYS,
  GAME_VERSION,
  ORIGINS,
  actionById,
  chooseAction,
  continueDay,
  createGame,
  nextPossibility,
  sceneFor,
  traitById,
  visibleMemories
} from "./engine.mjs";
import { buildPayload, record, send } from "./telemetry.mjs";

const STORAGE_KEY = "tomori-current-run-v1";
const LAST_RESULT_KEY = "tomori-last-result-v1";
const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const forcedSeed = params.has("seed") ? params.get("seed") : null;
let state = loadState();
let toastTimer = null;
let audioContext = null;

function storageGet(key) {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); } catch { /* persistence is optional */ }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadState() {
  try {
    const value = JSON.parse(storageGet(STORAGE_KEY) || "null");
    return value?.gameVersion === GAME_VERSION ? value : null;
  } catch {
    return null;
  }
}

function saveState() {
  if (state) storageSet(STORAGE_KEY, JSON.stringify(state));
}

function loadLastResult() {
  try { return JSON.parse(storageGet(LAST_RESULT_KEY) || "null"); } catch { return null; }
}

function originOf(current) {
  return ORIGINS.find(origin => origin.id === current.origin.id) || ORIGINS[0];
}

function showToast(message) {
  clearTimeout(toastTimer);
  let element = document.querySelector(".toast");
  if (!element) {
    element = document.createElement("div");
    element.className = "toast";
    document.body.append(element);
  }
  element.textContent = message;
  toastTimer = setTimeout(() => element.remove(), 2600);
}

function playTone(trait) {
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequencies = { voice: 392, warmth: 262, gaze: 523 };
    oscillator.frequency.value = frequencies[trait] || 330;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, audioContext.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.38);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch {
    // Sound is decoration; the game must work when audio is unavailable.
  }
}

function renderTop(current, label) {
  return `<header class="topbar">
    <a class="brand" href="./">灯守 <span>/ TOMORI 0.1</span></a>
    <span class="top-status">${escapeHtml(label)}</span>
  </header>`;
}

function renderProgress(current) {
  return `<div class="progress" aria-label="3日間の進行">
    ${Array.from({ length: DAYS }, (_, index) => `<span class="progress-dot ${index < current.history.length ? "done" : ""} ${index === current.day ? "current" : ""}"></span>`).join("")}
    <span class="progress-copy">${current.history.length}/${DAYS}日</span>
  </div>`;
}

function renderCreature(current, emphasis = "") {
  const memories = visibleMemories(current);
  const counts = current.counts;
  const max = Math.max(counts.voice, counts.warmth, counts.gaze);
  const leaders = Object.entries(counts).filter(([, value]) => value === max && value > 0).map(([key]) => key);
  const form = leaders.length === 1 ? leaders[0] : leaders.length > 1 ? "weave" : "newborn";
  const origin = originOf(current);
  const dots = memories.map(memory => `<span class="memory-orb" style="--orb:${memory.color}" title="${escapeHtml(memory.name)}">${memory.icon}</span>`).join("");
  return `<section class="creature-stage ${escapeHtml(form)} ${escapeHtml(emphasis)}" style="--origin:${origin.color}">
    <div class="moon"></div>
    <div class="cloud cloud-a"></div><div class="cloud cloud-b"></div>
    <div class="stars">✦　·　　✧　·　⋆</div>
    <div class="creature" aria-label="${escapeHtml(current.name)}">
      <span class="ear ear-left"></span><span class="ear ear-right"></span>
      <span class="creature-body"><span class="eye eye-left"></span><span class="eye eye-right"></span><span class="mouth"></span></span>
      <span class="tail"></span><span class="foot foot-left"></span><span class="foot foot-right"></span>
      <span class="orb-row">${dots || "<i class=\"newborn-mark\">·</i>"}</span>
    </div>
    <p class="creature-caption"><strong>${escapeHtml(current.name)}</strong>　${memories.length ? "覚えたものが、光っている" : "まだ名前のない灯り"}</p>
  </section>`;
}

function renderMemories(current) {
  const memories = visibleMemories(current);
  return `<section class="memory-panel" aria-live="polite">
    <div class="section-label">この子が覚えたこと</div>
    <div class="memory-row">${memories.length ? memories.map(memory => `<span class="memory-chip" style="--chip:${memory.color}"><b>${memory.icon}</b><span>${escapeHtml(memory.name)}</span><small>${memory.day}日目</small></span>`).join("") : "<span class=\"empty-memory\">まだ何も決まっていない。最初の一つを選ぶと、子の形が変わる。</span>"}</div>
  </section>`;
}

function renderEmotionPanel(current) {
  const note = document.querySelector("#emotion-note")?.value || "";
  const markers = [
    ["spark", "ひらめいた"],
    ["hit", "刺さった"],
    ["delight", "嬉しい"],
    ["hesitate", "迷った"],
    ["unclear", "分からない"],
    ["worry", "不安"],
    ["bored", "退屈"]
  ];
  return `<section class="emotion-panel">
    <div class="emotion-heading"><span class="section-label">いまの感情を残す</span><span class="emotion-help">任意。メモは空欄でも保存されます</span></div>
    <input id="emotion-note" type="text" maxlength="140" placeholder="ひとことメモ（任意）" value="${escapeHtml(note)}" />
    <div class="marker-grid">${markers.map(([kind, label]) => `<button type="button" class="marker-button marker-${kind}" data-emotion="${kind}">${label}</button>`).join("")}</div>
  </section>`;
}

function renderFooter(current) {
  return `<footer><details><summary>記録情報</summary><p>version: ${GAME_VERSION}<br />seed: ${escapeHtml(current.seed)}<br />run: ${escapeHtml(current.runId)}</p></details></footer>`;
}

function renderScene(current, mode = "choice") {
  const scene = sceneFor(current);
  const origin = originOf(current);
  const legacy = current.legacy ? `<div class="legacy-note"><span>前の子からの小さな手紙</span><b>「${escapeHtml(current.legacy.title)}」</b><p>${escapeHtml(current.legacy.line)}</p></div>` : "";
  const intro = current.day === 0 ? `<p class="origin-line"><span style="color:${origin.color}">${origin.icon}</span>${escapeHtml(origin.line)}</p><p class="origin-flavor">${escapeHtml(origin.flavor)}</p>` : "";
  const reveal = mode === "reveal" ? renderReveal(current) : renderChoices(current);
  return `<main class="shell">
    ${renderTop(current, scene.kicker)}
    ${renderProgress(current)}
    <section class="story-card">
      <div class="story-kicker"><span style="color:${origin.color}">${origin.icon}</span>${escapeHtml(scene.kicker)}</div>
      <h1>${escapeHtml(scene.title)}</h1>
      <p class="situation">${escapeHtml(scene.situation)}</p>
      ${intro}
      <div class="need"><strong>この子の今</strong><span>${escapeHtml(scene.need)}</span></div>
      ${legacy}
    </section>
    ${renderCreature(current, mode === "reveal" ? "pulse" : "")}
    ${renderMemories(current)}
    ${reveal}
    ${renderEmotionPanel(current)}
    ${renderFooter(current)}
  </main>`;
}

function renderChoices(current) {
  const scene = sceneFor(current);
  return `<section class="choice-panel">
    <div class="section-label">${escapeHtml(scene.prompt)}</div>
    <div class="choice-list">${ACTIONS.map(action => `<button type="button" class="choice-card choice-${action.trait}" data-action="${action.id}">
      <span class="choice-icon" style="--choice:${action.color}">${action.icon}</span>
      <span class="choice-copy"><b>${escapeHtml(action.name)}</b><small>${escapeHtml(action.promise)}</small><em>${escapeHtml(traitById(action.trait).name)}を覚える</em></span>
    </button>`).join("")}</div>
    <p class="choice-note">どれが正解かではなく、どんな子に会いたいかを選ぶ。</p>
  </section>`;
}

function renderReveal(current) {
  const entry = current.pendingReveal;
  const trait = traitById(entry.trait);
  const final = current.day === DAYS - 1;
  return `<section class="reveal-card" style="--reveal:${trait.color}" aria-live="polite">
    <div class="reveal-label">${final ? "朝を迎える" : "この子に残ったもの"}</div>
    <h2><span>${trait.icon}</span>${escapeHtml(trait.name)}を覚えた</h2>
    <p class="reaction">${escapeHtml(entry.reaction)}</p>
    <p class="causal">${escapeHtml(current.name)}は「${escapeHtml(actionById(entry.actionId).name)}」を選んだあなたを覚えている。</p>
    <button type="button" class="primary-button" data-next>${final ? "この子の朝を見届ける" : "次の夜へ"}<span> →</span></button>
  </section>`;
}

function renderTitle() {
  const previous = loadLastResult();
  const resume = state && state.phase !== "result";
  app.innerHTML = `<main class="title-screen">
    <div class="title-art"><span class="title-moon"></span><span class="title-creature">✧</span><i>·</i><i>✦</i><i>·</i></div>
    <div class="title-kicker">小さな育成ゲーム / 3日間</div>
    <h1>灯守</h1>
    <p class="title-lead">夜のすき間から、<br />小さな灯りをひとつ拾った。<br />三日だけ、そばにいて育てよう。</p>
    <label class="name-field">この子を呼ぶ名前（任意）<input id="new-name" maxlength="12" placeholder="たとえば、トワ" /></label>
    <button type="button" class="primary-button title-start" data-start>灯りを拾い上げる</button>
    ${resume ? `<button type="button" class="text-button title-resume" data-resume>続きから再開する</button>` : ""}
    ${previous ? `<section class="previous-card"><span>前の夜の記録</span><b>${escapeHtml(previous.title)}</b><p>${escapeHtml(previous.line)}</p></section>` : ""}
    <details class="how-to"><summary>遊び方</summary><p>毎夜ひとつ、子への接し方を選びます。選択はすぐに反応し、三日目に育った性質が朝の出来事へ返ってきます。正解を探すゲームではありません。</p></details>
    <p class="title-note">名前と選択は、次の画面で記録されます。seedは通常ランダムです。</p>
  </main>`;
}

function renderResult(current) {
  const ending = current.ending;
  const next = nextPossibility(current);
  const memories = visibleMemories(current);
  const status = current.telemetry.sentAt ? `<span class="send-ok">記録を保存しました</span>` : current.telemetry.error ? `<span class="send-error">保存待ち：${escapeHtml(current.telemetry.error)}</span>` : `<span class="muted">記録を送信中…</span>`;
  app.innerHTML = `<main class="shell result-shell">
    ${renderTop(current, "3日目 / 朝")}
    ${renderProgress(current)}
    <section class="ending-card" style="--ending:${ending.color}">
      <div class="ending-icon">${ending.icon}</div>
      <div class="ending-kicker">${escapeHtml(current.name)}の結末</div>
      <h1>${escapeHtml(ending.title)}</h1>
      <p class="ending-lead">${escapeHtml(ending.lead)}</p>
      <p class="ending-body">${escapeHtml(ending.body)}</p>
      <div class="ending-creature" style="--ending:${ending.color}"><span>${ending.icon}</span><b>${escapeHtml(current.name)}</b></div>
    </section>
    <section class="memory-panel result-memories"><div class="section-label">あなたが残した三日間</div><div class="memory-row">${memories.map(memory => `<span class="memory-chip" style="--chip:${memory.color}"><b>${memory.icon}</b><span>${escapeHtml(memory.name)}</span><small>${memory.day}日目</small></span>`).join("")}</div></section>
    <section class="next-card" style="--next:${next.color}"><div class="section-label">まだ見ていない可能性</div><h2>${next.icon} ${escapeHtml(next.name)}</h2><p>${escapeHtml(next.text)}</p></section>
    <section class="survey-panel">
      <div class="section-label">短い記録（任意ではなく、今回はぜひ）</div>
      <p class="survey-lead">このゲームが面白くなるかを知りたいので、数字よりも「なぜ」を残してください。</p>
      <form id="survey-form">
        <label>面白さ（1〜5）<select name="fun" required><option value="" selected disabled>選んでください</option>${[1,2,3,4,5].map(value => `<option value="${value}">${value}</option>`).join("")}</select></label>
        <label>もう一度、別の育て方を試したい（1〜5）<select name="replay" required><option value="" selected disabled>選んでください</option>${[1,2,3,4,5].map(value => `<option value="${value}">${value}</option>`).join("")}</select></label>
        <label>この子は、何を求めていたと思う？<textarea name="understood" maxlength="500" required placeholder="短くて大丈夫です"></textarea></label>
        <label>次に試すなら、どんな育て方？<textarea name="next" maxlength="500" placeholder="思いつかなければ空欄で大丈夫です"></textarea></label>
        <button type="submit" class="primary-button">記録を送る</button>
      </form>
      <p id="survey-status">${status}</p>
    </section>
    ${renderEmotionPanel(current)}
    <div class="result-actions"><button type="button" class="primary-button" data-restart>もう一度育てる</button><button type="button" class="text-button" data-resend>記録を再送</button></div>
    ${renderFooter(current)}
  </main>`;
}

function render() {
  if (!state) renderTitle();
  else if (state.phase === "result") renderResult(state);
  else renderScene(state, state.phase);
  app.dataset.ready = "true";
}

function startGame() {
  const name = document.querySelector("#new-name")?.value || "";
  const previous = loadLastResult();
  state = createGame({ seed: forcedSeed, name, legacy: previous ? { title: previous.title, line: previous.line } : null });
  record(state, { type: "run_started", name: state.name, origin: state.origin, legacy: Boolean(state.legacy) });
  record(state, { type: "scene_seen", day: 1, scene: sceneFor(state).title });
  saveState();
  render();
}

function recordEmotion(kind) {
  const noteInput = document.querySelector("#emotion-note");
  record(state, { type: "emotion_marked", kind, label: kind, phase: state.phase, day: state.day + 1, note: noteInput?.value?.trim() || "" });
  saveState();
  if (noteInput) noteInput.value = "";
  showToast("感情を記録しました");
  render();
}

function choose(actionId) {
  const action = actionById(actionId);
  const result = chooseAction(state, actionId);
  if (!result.ok) return showToast(result.error);
  state = result.state;
  record(state, { type: "action_chosen", day: state.day + 1, actionId, actionName: action.name, trait: action.trait, repeated: state.pendingReveal.repeated });
  record(state, { type: "reaction_seen", day: state.day + 1, trait: action.trait, reaction: state.pendingReveal.reaction });
  saveState();
  playTone(action.trait);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function nextDay() {
  const endingNow = state.day === DAYS - 1;
  const result = continueDay(state);
  if (!result.ok) return showToast(result.error);
  state = result.state;
  if (result.ended) {
    record(state, { type: "run_ended", ending: state.ending.id, title: state.ending.title, counts: state.counts });
    storageSet(LAST_RESULT_KEY, JSON.stringify({ title: state.ending.title, line: state.ending.lead }));
  } else {
    record(state, { type: "scene_seen", day: state.day + 1, scene: sceneFor(state).title });
  }
  saveState();
  render();
  if (endingNow) await sendCurrent();
}

async function sendCurrent() {
  const result = await send(state);
  saveState();
  const status = document.querySelector("#survey-status");
  if (status) status.innerHTML = result.ok ? `<span class="send-ok">記録を保存しました</span>` : `<span class="send-error">保存待ち：${escapeHtml(result.error || "通信できませんでした")}</span>`;
  if (state.phase === "result") render();
}

function submitSurvey(form) {
  const data = new FormData(form);
  state.survey = {
    fun: Number(data.get("fun")),
    replay: Number(data.get("replay")),
    understood: String(data.get("understood") || "").trim(),
    next: String(data.get("next") || "").trim()
  };
  record(state, { type: "survey_submitted", survey: state.survey });
  saveState();
  const status = document.querySelector("#survey-status");
  if (status) status.innerHTML = `<span class="muted">回答を送信中…</span>`;
  sendCurrent();
}

app.addEventListener("click", event => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) return choose(actionButton.dataset.action);
  if (event.target.closest("[data-next]")) return nextDay();
  if (event.target.closest("[data-emotion]")) return recordEmotion(event.target.closest("[data-emotion]").dataset.emotion);
  if (event.target.closest("[data-start]")) return startGame();
  if (event.target.closest("[data-resume]")) return render();
  if (event.target.closest("[data-restart]")) { state = null; render(); return; }
  if (event.target.closest("[data-resend]")) return sendCurrent();
});

app.addEventListener("submit", event => {
  if (!event.target.matches("#survey-form")) return;
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  submitSurvey(event.target);
});

if (state?.phase === "result" && !state.telemetry?.sentAt) sendCurrent();
render();

export { buildPayload };
