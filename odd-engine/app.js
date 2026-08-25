import {
  COMMANDS,
  GAME_VERSION,
  MAX_EMBER,
  MAX_SCRAP,
  MAX_STAGES,
  MAX_WEAR,
  SLOT_COUNT,
  chooseCommand,
  commandById,
  createGame,
  currentStage,
  installOffer,
  partById,
  planLabel,
  preview,
  repairMachine,
  scrapOffer,
  selectOffer,
  skipOffer,
  summary,
  swapSlots
} from "./engine.mjs";
import {
  ensureTelemetry,
  recordTelemetry,
  sendOddTelemetry
} from "./telemetry.mjs";

const app = document.querySelector("#app");
const STATE_PREFIX = "odd-engine-state-v1-";
const LAST_SEED_KEY = "odd-engine-last-seed";
const params = new URLSearchParams(location.search);
const explicitSeed = params.get("seed");

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] % 1000000;
  }
  return Math.floor(Math.random() * 1000000);
}

function validSeed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.floor(number)) % 1000000 : null;
}

let seed = validSeed(explicitSeed);
if (seed == null) {
  try { seed = validSeed(localStorage.getItem(LAST_SEED_KEY)); } catch { /* private mode */ }
  if (seed == null) seed = randomSeed();
  history.replaceState(null, "", `${location.pathname}?seed=${seed}`);
}
try { localStorage.setItem(LAST_SEED_KEY, String(seed)); } catch { /* private mode */ }

let state = loadState() || createGame(seed);
let message = "";
let sendState = state.telemetry?.sentAt ? "D1送信済み" : "未送信";
let selectedSlot = null;
ensureTelemetry(state);
if (!state.telemetry.events.length) {
  recordTelemetry(state, { type: "run_started", seed: state.seed, stages: state.stages });
}
persist();
render();

function stateKey() {
  return `${STATE_PREFIX}${seed}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey()) || "null");
    return saved?.version === GAME_VERSION.replace("-machine", "") && saved?.seed === seed ? saved : null;
  } catch {
    return null;
  }
}

function persist() {
  try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch { /* private mode */ }
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statLabel(key) {
  return { force: "衝", guard: "守", signal: "信", heat: "熱" }[key] || key;
}

function outputLabel(output) {
  return ["force", "guard", "signal", "heat"].filter(key => output[key] > 0)
    .map(key => `${statLabel(key)}${output[key]}`).join(" · ") || "反応なし";
}

function meter(label, value, max, className) {
  const ratio = Math.max(0, Math.min(1, value / max));
  return `<div class="meter ${className}"><div class="meter-top"><span>${label}</span><b>${value}<small>/${max}</small></b></div><i><em style="width:${ratio * 100}%"></em></i></div>`;
}

function stageTrack() {
  return Array.from({ length: MAX_STAGES }, (_, index) => {
    const completed = index < state.stage;
    const current = index === state.stage && !state.done;
    const icon = completed ? "✓" : index + 1;
    return `<span class="stage-dot ${completed ? "completed" : ""} ${current ? "current" : ""}">${icon}</span>`;
  }).join("");
}

function missionPanel() {
  return `<section class="mission panel"><div><span class="eyebrow">MISSION</span><h2>火種を朝へ</h2><p>おかしな機関を組み、7つの区画を越える。</p></div><div class="meters">${meter("火種", state.ember, MAX_EMBER, "ember")}${meter("摩耗", state.wear, MAX_WEAR, "wear")}${meter("くず", state.scrap, MAX_SCRAP, "scrap")}</div></section>`;
}

function partSlot(partId, index) {
  const part = partById(partId);
  const selected = selectedSlot === index;
  return `<button class="part-slot ${selected ? "selected" : ""}" data-slot="${index}" title="${esc(part?.description || "")}"><span class="slot-no">${index + 1}</span><strong>${part?.icon || "?"}</strong><span class="part-name">${esc(part?.name || partId)}</span></button>`;
}

function machinePanel() {
  const stage = currentStage(state);
  return `<section class="machine panel"><div class="section-heading"><span class="eyebrow">区画 ${Math.min(state.stage + 1, MAX_STAGES)} / ${MAX_STAGES}</span><span>${esc(stage.need.label)}</span></div><div class="stage-title"><span class="stage-icon">${stage.icon}</span><div><h2>${esc(stage.name)}</h2><p>${esc(stage.text)}</p></div></div><div class="pipeline-label"><span>機関の並び</span><span>タップで2枠を交換（残り${state.swapsLeft}回）</span></div><div class="pipeline">${state.parts.map(partSlot).join("")}</div>${state.phase === "command" ? commandPanel(stage) : offerPanel()}${state.phase === "command" ? repairPanel() : ""}</section>`;
}

function offerPanel() {
  if (!state.offer.length) return `<div class="offer empty"><span>部品を見送った。今ある機関で進む。</span></div>`;
  const selected = state.selectedOffer;
  const cards = state.offer.map((id, index) => {
    const part = partById(id);
    return `<button class="offer-card ${selected === index ? "selected" : ""}" data-offer="${index}"><span class="offer-icon">${part.icon}</span><span><b>${esc(part.name)}</b><small>${esc(part.description)}</small></span></button>`;
  }).join("");
  const installButtons = selected == null ? "" : `<div class="install-box"><p><b>${esc(partById(state.offer[selected]).name)}</b>をどこへ入れる？</p><div class="install-slots">${Array.from({ length: SLOT_COUNT }, (_, index) => `<button data-install-slot="${index}">${index + 1}番と交換</button>`).join("")}</div><div class="offer-actions"><button data-scrap-offer>分解してくず2</button><button data-skip-offer>見送る</button></div></div>`;
  return `<div class="offer"><div class="pipeline-label"><span>今回のガラクタ</span><span>1つだけ選ぶ</span></div><div class="offer-list">${cards}</div>${installButtons}<p class="hint">入れ替えた古い部品は、くず1になる。</p></div>`;
}

function commandPanel(stage) {
  const buttons = COMMANDS.map(command => {
    const item = preview(state, command.id);
    const pass = item.evaluation.passed;
    return `<button class="command ${pass ? "promising" : "risky"}" data-command="${command.id}"><span class="command-icon">${command.icon}</span><span class="command-body"><b>${command.name}</b><small>${esc(command.description)}</small><em>${outputLabel(item.output)}　${pass ? "◎ 通れそう" : `△ ${item.evaluation.value}/${item.evaluation.required}`}</em></span></button>`;
  }).join("");
  return `<div class="commands"><div class="pipeline-label"><span>命令を送る</span><span>予測は機関の反応、結果は区画が決める</span></div>${buttons}<p class="hint">必要なもの：<b>${esc(stage.need.label)}</b>。同じ部品でも、命令と並びで出力が変わる。</p></div>`;
}

function repairPanel() {
  const disabled = state.repairUsed || state.scrap < 2;
  return `<div class="repair-line"><button class="repair" data-repair ${disabled ? "disabled" : ""}>🛠 整備する（くず2）</button><span>${state.repairUsed ? "この区画では整備済み" : state.scrap < 2 ? "くずが足りない" : "火種+1、摩耗-1"}</span></div>`;
}

function logPanel() {
  const entries = [...(state.log || [])].slice(-6).reverse().map(entry => `<li class="${esc(entry.kind)}"><span>${entry.stage + 1}</span><p>${esc(entry.text)}</p></li>`).join("");
  return `<section class="log panel"><div class="section-heading"><span class="eyebrow">機関の記憶</span><span>${state.telemetry?.events?.length || 0} events</span></div><ol>${entries || "<li><p>まだ何も起きていない。</p></li>"}</ol></section>`;
}

const MARKERS = [
  ["spark", "ひらめいた"], ["hesitate", "迷う"], ["surge", "きた！"], ["worry", "不安"], ["unclear", "わからない"], ["satisfying", "うまくいった"], ["boring", "退屈"]
];

function markerPanel() {
  if (state.done) return "";
  return `<section class="markers panel"><div class="section-heading"><span class="eyebrow">途中の感触</span><span>1タップで記録</span></div><div class="marker-grid">${MARKERS.map(([id, label]) => `<button data-marker="${id}">${label}</button>`).join("")}</div><div class="note-line"><input id="marker-note" maxlength="120" placeholder="任意メモ：何が分かった？" /><button data-mark-note>記録</button></div></section>`;
}

function resultPanel() {
  const result = summary(state);
  const title = state.won ? "朝が来た" : state.endReason === "ember_lost" ? "火種が消えた" : "機関が止まった";
  const body = state.won
    ? "寄せ集めの機関が、最後まで火種を運んだ。"
    : state.endReason === "ember_lost" ? "壊れたのは機関だけではなかった。" : "摩耗が積み重なり、機関は自分の重さに耐えられなかった。";
  const outcome = `火種 ${result.ember}/${MAX_EMBER}　摩耗 ${result.wear}/${MAX_WEAR}　くず ${result.scrap}`;
  if (state.survey) {
    return `<section class="result panel"><span class="eyebrow">行進終了</span><h2>${title}</h2><p>${body}</p><div class="outcome">${outcome}</div><div class="final-build">${planLabel(result.parts)}</div><p class="sent-state">${esc(sendState)}</p><div class="result-actions"><button class="primary" data-new-same>同じseedで、別の機関を試す</button><button class="secondary" data-new-random>新しい夜へ</button></div>${state.telemetry?.error ? `<button class="resend" data-resend>送信を再試行</button>` : ""}</section>`;
  }
  return `<section class="result panel"><span class="eyebrow">行進終了</span><h2>${title}</h2><p>${body}</p><div class="outcome">${outcome}</div><div class="final-build">${planLabel(result.parts)}</div><form id="survey"><label>面白さ <select name="fun" required><option value="">選択</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n}</option>`).join("")}</select></label><label>今すぐもう一度やりたい度 <select name="replay" required><option value="">選択</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n}</option>`).join("")}</select></label><label>一番よかった瞬間 <textarea name="bestMoment" maxlength="240" placeholder="任意"></textarea></label><label>引っかかった点 <textarea name="friction" maxlength="240" placeholder="任意"></textarea></label><label>次に変えたいこと <textarea name="nextPlan" maxlength="240" placeholder="例：焦げレンズを先頭に置いてみたい"></textarea></label><button class="primary" type="submit">回答して記録を保存</button></form></section>`;
}

function render() {
  const title = state.done ? "行進は終わった" : "火種を朝へ";
  app.innerHTML = `<main class="shell"><header class="topbar"><div><span class="eyebrow">A SERIOUS BET ON FUN</span><h1>おかしな機関 <em>ODD ENGINE</em></h1></div><div class="stamp">${GAME_VERSION}<br />seed ${state.seed}</div></header><section class="intro"><h2>${title}</h2><p>拾った部品を並べ、命令を送る。機関が返した答えを見て、次を決める。</p><div class="stage-track">${stageTrack()}</div></section>${missionPanel()}${state.done ? resultPanel() : machinePanel()}${logPanel()}${markerPanel()}<footer><span>${esc(message || "正解を探すより、今ある部品の意味を変えてみる。")}</span><span>${esc(sendState)}</span></footer></main>`;
}

function applyEngine(result, event) {
  if (!result.result.ok) {
    message = result.result.message;
    render();
    return false;
  }
  state = result.state;
  if (event) recordTelemetry(state, event);
  persist();
  render();
  return true;
}

function handleOffer(index) {
  const result = selectOffer(state, index);
  applyEngine(result, { type: "offer_selected", stage: state.stage, offerIndex: index, partId: state.offer[index] });
}

function handleInstall(slot) {
  const partId = state.offer[state.selectedOffer];
  const result = installOffer(state, slot);
  applyEngine(result, result.result.ok ? { type: "part_installed", stage: state.stage, partId, slot, oldPartId: result.result.oldPart } : null);
}

function handleScrap() {
  const partId = state.offer[state.selectedOffer];
  const result = scrapOffer(state);
  applyEngine(result, result.result.ok ? { type: "part_scrapped", stage: state.stage, partId, amount: 2 } : null);
}

function handleSwap(slot) {
  if (selectedSlot == null) {
    selectedSlot = slot;
    message = `${slot + 1}番枠を選んだ。もう1枠を選ぶと入れ替わる。`;
    render();
    return;
  }
  if (selectedSlot === slot) {
    selectedSlot = null;
    render();
    return;
  }
  const first = selectedSlot;
  selectedSlot = null;
  const result = swapSlots(state, first, slot);
  applyEngine(result, result.result.ok ? { type: "slots_swapped", stage: state.stage, first, second: slot } : null);
}

function handleCommand(commandId) {
  const stage = currentStage(state);
  const result = chooseCommand(state, commandId);
  const event = result.result.ok ? {
    type: "command_chosen",
    stage: state.stage,
    stageId: stage.id,
    command: commandId,
    parts: [...state.parts],
    before: result.result.before,
    output: {
      force: result.result.output.force,
      guard: result.result.output.guard,
      signal: result.result.output.signal,
      heat: result.result.output.heat,
      scrapDelta: result.result.output.scrapDelta,
      repair: result.result.output.repair,
      wear: result.result.output.wear,
      trace: result.result.output.trace
    },
    evaluation: result.result.evaluation,
    passed: result.result.evaluation.passed,
    after: result.result.after
  } : null;
  if (applyEngine(result, event)) {
    if (result.state.done) {
      recordTelemetry(state, { type: "run_finished", won: state.won, reached: state.stage, reason: state.endReason, parts: [...state.parts] });
      persist();
      message = state.won ? "朝が来た。今度はこの機関を別の順番で作れる。" : "止まった理由は、機関の記憶に残っている。";
      render();
    } else {
      message = result.result.evaluation.passed ? "通った。次の部品で、今の機関の意味が変わるかもしれない。" : "通らなかった。どの出力が足りなかったかを見て、次を組み替える。";
      persist();
      render();
    }
  }
}

function mark(kind, note = "") {
  recordTelemetry(state, { type: "emotion_marked", kind, phase: state.done ? "result" : `stage-${state.stage + 1}`, note: note.trim() });
  message = "その瞬間を記録した。";
  persist();
  render();
}

function newRun(nextSeed) {
  const sameSeed = nextSeed === seed;
  seed = nextSeed;
  history.replaceState(null, "", `${location.pathname}?seed=${seed}`);
  try { localStorage.setItem(LAST_SEED_KEY, String(seed)); } catch { /* private mode */ }
  state = createGame(seed);
  ensureTelemetry(state);
  recordTelemetry(state, { type: "run_started", seed: state.seed, stages: state.stages });
  sendState = "未送信";
  selectedSlot = null;
  message = sameSeed ? "同じseedでも、別の並びなら違う答えになる。" : "新しい夜が始まった。";
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
  const result = await sendOddTelemetry(state);
  sendState = result.ok ? "D1送信済み" : `D1未送信：${result.error || "後で再試行"}`;
  persist();
  render();
}

async function resend() {
  sendState = "送信中…";
  render();
  const result = await sendOddTelemetry(state);
  sendState = result.ok ? "D1送信済み" : `D1未送信：${result.error || "後で再試行"}`;
  persist();
  render();
}

app.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.offer != null) return handleOffer(Number(target.dataset.offer));
  if (target.dataset.installSlot != null) return handleInstall(Number(target.dataset.installSlot));
  if (target.matches("[data-scrap-offer]")) return handleScrap();
  if (target.matches("[data-skip-offer]")) return applyEngine(skipOffer(state), { type: "offer_skipped", stage: state.stage });
  if (target.dataset.slot != null) return handleSwap(Number(target.dataset.slot));
  if (target.dataset.repair != null) return applyEngine(repairMachine(state), { type: "repair_used", stage: state.stage });
  if (target.dataset.command) return handleCommand(target.dataset.command);
  if (target.dataset.marker) return mark(target.dataset.marker);
  if (target.matches("[data-mark-note]")) return mark("note", document.querySelector("#marker-note")?.value || "");
  if (target.matches("[data-new-same]")) return newRun(seed);
  if (target.matches("[data-new-random]")) return newRun(randomSeed());
  if (target.matches("[data-resend]")) return resend();
});

app.addEventListener("submit", event => {
  if (event.target.id !== "survey") return;
  event.preventDefault();
  submitSurvey(event.target);
});
