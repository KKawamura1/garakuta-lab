import {
  COMMANDS,
  GAME_VERSION,
  MAX_NIGHTS,
  NIGHTS,
  PART_BY_ID,
  RELICS,
  SLOT_IDS,
  SLOT_NAMES,
  behaviorOf,
  chooseCommand,
  continueNight,
  createGame,
  discardBag,
  forecast,
  installPart,
  nightOf,
  readBuild,
  skipBuild,
  storeOffer
} from "./engine.mjs";
import { buildPayload, record, send } from "./telemetry.mjs";

const SESSION_KEY = "night-eater-session";
const LAST_RUN_KEY = "night-eater-last-run";
const app = document.querySelector("#app");
const urlSeed = new URLSearchParams(location.search).get("seed");
const markerLabels = {
  spark: "ひらめいた",
  hit: "きた！",
  hesitate: "迷う",
  worry: "不安",
  unclear: "わからない",
  payoff: "うまくいった",
  boring: "退屈"
};
let state = loadSession();
let selectedPart = null;
let soundEnabled = localStorage.getItem("night-eater-sound") !== "off";
let sendBusy = false;

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return saved && saved.gameVersion === GAME_VERSION ? saved : null;
  } catch (_) {
    return null;
  }
}

function persist() {
  if (!state) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

function saveLastRun() {
  if (!state) return;
  localStorage.setItem(LAST_RUN_KEY, JSON.stringify({
    ending: state.ending,
    parts: state.parts,
    seed: state.seed,
    behavior: readBuild(state.parts).behavior,
    endedAt: state.endedAt
  }));
}

function previousRun() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_RUN_KEY) || "null");
    return saved && saved.ending ? saved : null;
  } catch (_) {
    return null;
  }
}

function startRun() {
  const previous = previousRun();
  const legacyPart = previous?.ending?.keepsakePartId || previous?.parts?.find(Boolean) || null;
  state = createGame({
    seed: urlSeed === null ? undefined : Number(urlSeed),
    legacy: legacyPart ? { partId: legacyPart, endingId: previous.ending.id } : null
  });
  selectedPart = null;
  record(state, { type: "run_started", seed: state.seed, legacyPartId: legacyPart, previousEnding: previous?.ending?.id || null });
  recordOfferSeen();
  persist();
  render();
  chirp(220, 0.08);
}

function setState(next) {
  state = next;
  persist();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function part(id) {
  return PART_BY_ID[id] || null;
}

function partSummary(id, slot) {
  const current = part(id);
  if (!current) return "<span class='empty-slot'>空いている</span>";
  const values = current.slots[slot];
  return "<span class='slot-icon' style='--part-color:" + current.color + "'>" + current.icon + "</span>" +
    "<strong>" + escapeHtml(current.name) + "</strong>" +
    "<small>" + actionLine(values) + "</small>";
}

function actionLine(values) {
  const actions = [
    ["見る", values.look],
    ["抱える", values.hold],
    ["返す", values.returning],
    ["温める", values.warm]
  ].filter(item => item[1] > 0);
  return actions.map(item => item[0] + " " + item[1]).join(" ・ ") || "まだ分からない";
}

function skillsLine(skills) {
  return [
    ["見る", skills.look],
    ["抱える", skills.hold],
    ["返す", skills.returning],
    ["温める", skills.warm]
  ].map(item => "<span><b>" + item[1] + "</b>" + item[0] + "</span>").join("");
}

function progressMarkup() {
  return "<div class='night-track'>" + NIGHTS.map((night, index) => {
    const className = index < state.night ? "done" : index === state.night ? "current" : "";
    return "<span class='night-dot " + className + "' title='" + escapeHtml(night.title) + "'>" +
      (index < state.night ? "✓" : index + 1) + "</span>";
  }).join("") + "</div>";
}

function creatureMarkup(reading, phase) {
  const parts = state.parts.map((id, index) => {
    const current = part(id);
    return "<div class='creature-module module-" + SLOT_IDS[index] + (current ? " filled" : "") + "' style='--part-color:" +
      (current?.color || "#71809b") + "'><span>" + (current?.icon || "·") + "</span></div>";
  }).join("");
  const behaviorClass = reading.behavior.replaceAll("子", "").replaceAll(" ", "-");
  const outcomeClass = phase === "aftermath" && state.lastOutcome ? (state.lastOutcome.success ? " celebrate" : " tremble") : "";
  return "<div class='creature-scene'>" +
    "<div class='moon-glow'></div><div class='dust dust-a'></div><div class='dust dust-b'></div>" +
    "<div class='road'><span>" + nightOf(state).icon + "</span><i></i><span>✦</span></div>" +
    "<div class='creature " + behaviorClass + outcomeClass + "'>" +
    "<div class='ear ear-left'></div><div class='ear ear-right'></div>" +
    "<div class='body'><div class='face'><i></i><i></i><b></b></div>" + parts + "</div>" +
    "<div class='foot foot-left'></div><div class='foot foot-right'></div>" +
    "</div>" +
    "<div class='creature-caption'>この子は <strong>" + escapeHtml(reading.behavior) + "</strong></div>" +
    "</div>";
}

function headerMarkup() {
  const currentNight = Math.min(state.night + 1, MAX_NIGHTS);
  return "<header class='topbar'>" +
    "<div><span class='eyebrow'>NIGHT-EATER 0.1</span><h1>夜を食べる子</h1></div>" +
    "<div class='top-meta'><button class='sound-toggle' data-action='sound' aria-label='音の切り替え'>" +
    (soundEnabled ? "♪" : "♪̸") + "</button><span>夜 " + currentNight + " / " + MAX_NIGHTS + "</span><span>灯 " + state.light + " ・ 絆 " + state.bond + "</span></div>" +
    "</header>" + progressMarkup();
}

function storyMarkup() {
  const night = nightOf(state);
  const previous = state.legacy && state.night === 0
    ? "<p class='legacy-line'>前の子の置き土産が、ポケットの底でまだ温かい。</p>" : "";
  return "<section class='story-card'>" +
    "<div class='story-icon'>" + night.icon + "</div><div><span class='eyebrow'>NIGHT " + (state.night + 1) + " / " + escapeHtml(night.title) + "</span>" +
    "<h2>" + escapeHtml(night.question) + "</h2><p>" + escapeHtml(night.ask) + "</p>" + previous + "</div>" +
    "</section>";
}

function relicCard(id, source) {
  const current = part(id);
  if (!current) return "";
  const selected = selectedPart?.id === id && selectedPart?.source === source ? " selected" : "";
  const slotLines = SLOT_IDS.map(slot => "<span>" + SLOT_NAMES[slot] + " " + actionLine(current.slots[slot]) + "</span>").join("");
  return "<button class='relic-card" + selected + "' data-action='select-part' data-part-id='" + id + "' data-source='" + source + "'>" +
    "<span class='relic-icon' style='--part-color:" + current.color + "'>" + current.icon + "</span>" +
    "<span class='relic-copy'><b>" + escapeHtml(current.name) + "</b><small>" + escapeHtml(current.flavor) + "</small><em>" + slotLines + "</em></span>" +
    "</button>";
}

function bagMarkup() {
  if (!state.bag.length) return "<p class='muted'>ポケットは空っぽ。</p>";
  return "<div class='bag-list'>" + state.bag.map(id =>
    "<div class='bag-item'>" + relicCard(id, "bag") +
    "<button class='discard-button' data-action='discard' data-part-id='" + id + "' aria-label='手放す'>手放す</button></div>"
  ).join("") + "</div>";
}

function buildPanel() {
  const selectionText = selectedPart
    ? "「" + escapeHtml(part(selectedPart.id)?.name) + "」を選択中。下の身体へ取り付ける。"
    : "拾ったものを一つ選び、取り付ける場所を選ぶ。取り替えはいつでもできる。";
  return "<section class='panel build-panel'>" +
    "<div class='panel-heading'><span class='eyebrow'>拾う / 取り付ける</span><h2>この子に何を教える？</h2></div>" +
    "<p class='build-intro'>" + selectionText + "</p>" +
    "<div class='offer-grid'>" + state.offer.map(id => relicCard(id, "offer")).join("") + "</div>" +
    "<div class='body-slots'>" + SLOT_IDS.map((slot, index) => {
      const selected = selectedPart ? " 取り付け可能" : "";
      return "<button class='body-slot" + (selected ? " ready" : "") + "' data-action='install' data-slot='" + index + "'" +
        (selectedPart ? "" : " disabled") + "><span class='slot-label'>" + SLOT_NAMES[slot] + "</span>" +
        "<span class='slot-content'>" + partSummary(state.parts[index], slot) + "</span>" +
        "<small>" + (selected ? "ここへ置く" : "部品を選ぶ") + "</small></button>";
    }).join("") + "</div>" +
    "<div class='bag-heading'><span>ポケット " + state.bag.length + " / 2</span><small>前の部品をしまっておける</small></div>" +
    bagMarkup() +
    "<div class='build-actions'><button class='secondary-button' data-action='store-selected' " +
    (selectedPart?.source === "offer" ? "" : "disabled") + ">ポケットにしまう</button>" +
    "<button class='text-button' data-action='skip-build'>今夜は拾わない</button></div>" +
    "</section>";
}

function commandPanel() {
  const night = nightOf(state);
  const reading = readBuild(state.parts);
  const commandButtons = COMMANDS.map(command => {
    const prediction = forecast(state, command.id);
    const className = prediction.status === "strong" ? " strong" : prediction.status === "edge" ? " edge" : " weak";
    const valueLine = night.need === "whole"
      ? "全体のまとまり " + prediction.value + " / " + prediction.threshold
      : "使う力「" + ({ look: "見る", hold: "抱える", returning: "返す", warm: "温める" }[night.need]) + "」 " + prediction.value + " / " + prediction.threshold;
    return "<button class='command-button" + className + "' data-action='command' data-command='" + command.id + "'>" +
      "<span class='command-icon'>" + command.icon + "</span><span class='command-copy'><b>" + command.name + "</b>" +
      "<small>" + command.hint + "</small><em>" + prediction.label + " ・ " + valueLine + "</em></span></button>";
  }).join("");
  return "<section class='panel command-panel'>" +
    "<div class='panel-heading'><span class='eyebrow'>呼ぶ / 見届ける</span><h2>" + escapeHtml(night.ask) + "</h2></div>" +
    "<p class='command-intro'>同じ子でも、任せるか手を添えるかで、夜の記憶が変わる。</p>" +
    "<div class='skill-strip'>" + skillsLine(reading.skills) + "</div>" +
    "<div class='command-list'>" + commandButtons + "</div>" +
    "<div class='causal-log'><span class='eyebrow'>いま見えている因果</span>" +
    reading.traces.slice(-4).map(line => "<p>＋ " + escapeHtml(line) + "</p>").join("") +
    "</div></section>";
}

function aftermathPanel() {
  const outcome = state.lastOutcome;
  const night = nightOf(state);
  const title = outcome.success ? "届いた。" : "届かなかった。";
  const sub = outcome.success ? "子は、あなたが渡したふるまいで夜を越えた。" : "でも、失敗した場所は次に触れる場所として残った。";
  const buttonText = state.endReason || state.night >= MAX_NIGHTS - 1 ? "最後の場面へ" : "次の夜へ";
  return "<section class='panel aftermath-panel " + (outcome.success ? "success" : "failure") + "'>" +
    "<span class='eyebrow'>" + escapeHtml(night.title) + " / 見届けた結果</span><h2>" + title + "</h2>" +
    "<p class='outcome-lead'>" + escapeHtml(outcome.text) + "</p><p>" + sub + "</p>" +
    "<div class='outcome-stats'><span>灯 <b>" + state.light + "</b></span><span>絆 <b>" + state.bond + "</b></span><span>ひらめき <b>" + state.insight + "</b></span></div>" +
    "<button class='primary-button' data-action='continue'>" + buttonText + "</button></section>";
}

function historyMarkup() {
  if (!state.history.length) return "";
  return "<section class='panel history-panel'><div class='panel-heading'><span class='eyebrow'>この子の記憶</span><h2>夜のあとに残ったもの</h2></div>" +
    "<ol>" + state.history.map(item => "<li class='" + (item.success ? "good" : "bad") + "'><span class='history-night'>" + (item.night + 1) + "</span><span><b>" +
      escapeHtml(item.title) + " ・ " + escapeHtml(item.behavior) + "</b><small>" + escapeHtml(item.text) + "</small></span></li>").join("") + "</ol></section>";
}

function markerPanel() {
  return "<section class='marker-panel'><div class='panel-heading'><span class='eyebrow'>途中の気持ち</span><h2>いま、どんな感じ？</h2></div>" +
    "<div class='marker-grid'>" + Object.entries(markerLabels).map(([id, label]) =>
      "<button data-action='marker' data-marker='" + id + "'>" + label + "</button>"
    ).join("") + "</div><input id='marker-note' type='text' placeholder='任意メモ（何がそう感じさせた？）' maxlength='120' /></section>";
}

function resultPanel() {
  const ending = state.ending || { title: "夜の記録", text: "まだ言葉にならない。" };
  const reading = readBuild(state.parts);
  const won = state.endReason === "dawn";
  const status = state.telemetry?.sentAt ? "<p class='send-ok'>プレイログを保存しました。</p>" :
    state.telemetry?.error ? "<p class='send-error'>保存待ち： " + escapeHtml(state.telemetry.error) + "</p>" : "";
  return "<section class='panel result-panel'><span class='eyebrow'>夜明け / " + escapeHtml(state.ending?.id || state.endReason) + "</span>" +
    "<h2>" + escapeHtml(ending.title) + "</h2><p class='ending-text'>" + escapeHtml(ending.text) + "</p>" +
    "<div class='final-creature'><span>" + escapeHtml(reading.behavior) + "</span><strong>" + state.parts.map(id => part(id)?.icon || "·").join(" ") + "</strong></div>" +
    "<p class='result-seed'>この子のseed " + state.seed + " ・ " + (won ? "灯台へ届いた" : "灯りを失った") + "</p>" +
    historyMarkup() +
    "<form data-form='survey' class='survey-form'>" +
    "<label>面白さ <select name='fun' required><option value=''>選ぶ</option><option value='1'>1 — 退屈</option><option value='2'>2</option><option value='3'>3</option><option value='4'>4</option><option value='5'>5 — また遊びたい</option></select></label>" +
    "<label>もう一度遊びたい度 <select name='replay' required><option value=''>選ぶ</option><option value='1'>1</option><option value='2'>2</option><option value='3'>3</option><option value='4'>4</option><option value='5'>5</option></select></label>" +
    "<label>いちばん残った瞬間 <textarea name='moment' maxlength='500' required placeholder='空欄のまま送らず、あなたの言葉で書いてください'></textarea></label>" +
    "<label>次に変えて試したいこと <textarea name='next' maxlength='500' placeholder='任意'></textarea></label>" +
    "<button class='primary-button' type='submit' " + (state.survey ? "disabled" : "") + ">" + (state.survey ? "回答済み" : "記録を送る") + "</button>" +
    "</form>" + status +
    "<div class='result-actions'><button class='secondary-button' data-action='new'>もう一度、別の子を育てる</button>" +
    (state.telemetry?.error ? "<button class='text-button' data-action='resend'>ログを再送する</button>" : "") + "</div></section>";
}

function footerMarkup() {
  return "<footer><span>" + GAME_VERSION + " ・ build " + GAME_VERSION + "</span><span>ランダム seed は記録にのみ使います</span></footer>";
}

function titleScreen() {
  const previous = previousRun();
  const carry = previous ? "<div class='carry-card'><span>前の子が残したもの</span><b>" +
    escapeHtml(previous.ending.title) + "</b><p>「" + escapeHtml(part(previous.ending.keepsakePartId)?.name || "小さな記憶") + "」が、次の夜へ混ざる。</p></div>" : "";
  return "<main class='title-screen'><div class='title-art'><div class='title-moon'></div><div class='title-beast'>◌</div><span>✦</span><span>·</span><span>✧</span></div>" +
    "<span class='eyebrow'>NIGHT-EATER 0.1</span><h1>夜を食べる子</h1>" +
    "<p class='title-lead'>拾ったガラクタで、小さな子のふるまいを育てる。<br />最後の夜に、何を返すかを見届ける。</p>" +
    carry + "<button class='primary-button title-start' data-action='new'>夜を始める</button>" +
    "<p class='title-note'>6つの夜 / 10分ほど / 画面の中央で子が動きます</p></main>";
}

function gameScreen() {
  const reading = readBuild(state.parts);
  let main = "";
  if (state.phase === "build") main = buildPanel();
  if (state.phase === "command") main = commandPanel();
  if (state.phase === "aftermath") main = aftermathPanel();
  if (state.phase === "result") main = resultPanel();
  return "<main class='shell'>" + headerMarkup() + storyMarkup() +
    creatureMarkup(reading, state.phase) + main +
    (state.phase !== "result" ? historyMarkup() : "") +
    markerPanel() + footerMarkup() + "</main>";
}

function render() {
  app.innerHTML = state ? gameScreen() : titleScreen();
  if (state) {
    if (state.phase === "command") recordCommandForecasts();
    persist();
  }
}

function recordOfferSeen() {
  if (!state || state.phase !== "build") return;
  const existing = state.telemetry?.events?.some(event => event.type === "offer_seen" && event.night === state.night);
  if (existing) return;
  record(state, { type: "offer_seen", night: state.night, partIds: [...state.offer] });
}

function recordCommandForecasts() {
  const existing = state.telemetry?.events?.some(event => event.type === "command_forecasts_seen" && event.night === state.night);
  if (existing) return;
  record(state, {
    type: "command_forecasts_seen",
    night: state.night,
    forecasts: COMMANDS.map(command => {
      const item = forecast(state, command.id);
      return { command: command.id, value: item.value, threshold: item.threshold, status: item.status };
    })
  });
}

function marker(id) {
  const note = document.querySelector("#marker-note")?.value?.trim() || "";
  record(state, { type: "emotion_marked", kind: id, label: markerLabels[id], phase: state.phase, night: state.night, note });
  const input = document.querySelector("#marker-note");
  if (input) input.value = "";
  persist();
  render();
}

function selection(id, source) {
  selectedPart = selectedPart?.id === id && selectedPart?.source === source ? null : { id, source };
  render();
}

function install(slotIndex) {
  if (!selectedPart) return;
  const before = [...state.parts];
  const response = installPart(state, selectedPart.id, slotIndex, selectedPart.source);
  if (!response.result.ok) {
    toast(response.result.message);
    return;
  }
  state = response.state;
  record(state, { type: "part_installed", night: state.night, partId: selectedPart.id, source: selectedPart.source, slot: SLOT_IDS[slotIndex], before, after: [...state.parts] });
  selectedPart = null;
  chirp(360, 0.1);
  persist();
  render();
}

function stashSelected() {
  if (!selectedPart || selectedPart.source !== "offer") return;
  const response = storeOffer(state, selectedPart.id);
  if (!response.result.ok) {
    toast(response.result.message);
    return;
  }
  state = response.state;
  record(state, { type: "part_stored", night: state.night, partId: selectedPart.id, abandoned: response.result.abandoned || [], bag: [...state.bag] });
  selectedPart = null;
  persist();
  render();
}

function discard(id) {
  const response = discardBag(state, id);
  if (!response.result.ok) {
    toast(response.result.message);
    return;
  }
  state = response.state;
  record(state, { type: "part_discarded", night: state.night, partId: id });
  persist();
  render();
}

function skip() {
  const response = skipBuild(state);
  if (!response.result.ok) return;
  state = response.state;
  record(state, { type: "build_skipped", night: state.night });
  persist();
  render();
}

function command(id) {
  const prediction = forecast(state, id);
  const response = chooseCommand(state, id);
  if (!response.result.ok) {
    toast(response.result.message);
    return;
  }
  state = response.state;
  record(state, {
    type: "command_chosen",
    night: state.night,
    command: id,
    forecast: { value: prediction.value, threshold: prediction.threshold, status: prediction.status },
    success: response.result.success
  });
  record(state, {
    type: "night_resolved",
    night: state.night,
    nightId: nightOf(state).id,
    success: response.result.success,
    light: state.light,
    bond: state.bond,
    power: prediction.value,
    threshold: prediction.threshold
  });
  chirp(response.result.success ? 660 : 150, response.result.success ? 0.18 : 0.28);
  persist();
  render();
}

function nextNight() {
  const response = continueNight(state);
  if (!response.result.ok) return;
  state = response.state;
  if (response.result.ended) {
    saveLastRun();
    record(state, { type: "run_ended", reason: state.endReason, ending: state.ending?.id || null, summary: buildPayload(state).stats });
    chirp(state.endReason === "dawn" ? 880 : 110, 0.3);
  } else {
    recordOfferSeen();
    chirp(260, 0.08);
  }
  persist();
  render();
}

async function submitSurvey(form) {
  if (sendBusy || state.survey) return;
  const data = new FormData(form);
  state.survey = {
    fun: Number(data.get("fun")),
    replay: Number(data.get("replay")),
    moment: String(data.get("moment") || "").trim(),
    next: String(data.get("next") || "").trim()
  };
  record(state, { type: "survey_submitted", survey: state.survey });
  sendBusy = true;
  persist();
  render();
  const response = await send(state);
  sendBusy = false;
  if (!response.ok) toast("保存待ちにしました。あとで再送できます。");
  persist();
  render();
}

async function resend() {
  if (sendBusy) return;
  sendBusy = true;
  render();
  const response = await send(state);
  sendBusy = false;
  if (!response.ok) toast("まだ送れませんでした。");
  persist();
  render();
}

function toast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 2400);
}

let audioContext = null;
function chirp(frequency, duration) {
  if (!soundEnabled || !window.AudioContext) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, audioContext.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration + 0.02);
  } catch (_) {
    // 音が出せない端末でも、ゲーム自体はそのまま遊べる。
  }
}

app.addEventListener("click", event => {
  const target = event.target.closest("[data-action], [data-marker]");
  if (!target) return;
  const action = target.dataset.action;
  if (target.dataset.marker) {
    marker(target.dataset.marker);
    return;
  }
  if (action === "new") startRun();
  if (action === "sound") {
    soundEnabled = !soundEnabled;
    localStorage.setItem("night-eater-sound", soundEnabled ? "on" : "off");
    render();
  }
  if (action === "select-part") selection(target.dataset.partId, target.dataset.source);
  if (action === "install") install(Number(target.dataset.slot));
  if (action === "store-selected") stashSelected();
  if (action === "discard") discard(target.dataset.partId);
  if (action === "skip-build") skip();
  if (action === "command") command(target.dataset.command);
  if (action === "continue") nextNight();
  if (action === "resend") resend();
});

app.addEventListener("submit", event => {
  if (event.target.matches("[data-form='survey']")) {
    event.preventDefault();
    submitSurvey(event.target);
  }
});

render();
