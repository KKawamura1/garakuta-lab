import {
  BUILD_STAMP,
  GAME_VERSION,
  PARTS,
  SCENES,
  SLOT_KEYS,
  SLOT_LABELS,
  STAT_LABELS,
  buildSignature,
  evaluateBuild,
  offersFor,
  partById,
  partName,
  sceneFor,
  statLabel,
  useFor
} from "./app-runtime.mjs";
import { record, send } from "./telemetry.mjs";

const STORAGE_KEY_BASE = "garakuta-kindling-state-v1";
const STARTER_SLOTS = ["button", "mirror", null, null];
const MARKERS = [
  { kind: "spark", label: "ひらめいた" },
  { kind: "choice", label: "迷った" },
  { kind: "payoff", label: "きた！" },
  { kind: "friction", label: "つらい" },
  { kind: "unclear", label: "わからない" },
  { kind: "bored", label: "退屈" },
  { kind: "worry", label: "不安" }
];
const FAIL_LINES = [
  "霧が灯りを飲み込み、相棒はあなたの手を強く握った。",
  "鉄犬の影が横切り、相棒はぎりぎりで道の端に逃げ込んだ。",
  "足元が崩れ、相棒は濡れた橋のこちら側に戻ってきた。",
  "雨が音をさらい、開きかけた扉はまた静かに閉じた。",
  "黒いものが階段を満たし、火花は途中で小さく消えた。",
  "窓は見えているのに、灯りを渡す手が風に負けた。"
];

const app = document.getElementById("app");
let state = loadState();
let message = "拾ったものは、部位で別の働きをする。";
let audioContext = null;
let rafId = null;
let travelTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function storageKey() {
  const raw = new URLSearchParams(location.search).get("seed");
  return raw ? STORAGE_KEY_BASE + "-seed-" + hashSeed(raw) : STORAGE_KEY_BASE;
}

function randomSeed() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] || 1;
  }
  return Math.floor(Math.random() * 4294967295) || 1;
}

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function querySeed() {
  const raw = new URLSearchParams(location.search).get("seed");
  if (!raw) return randomSeed();
  if (/^[0-9]+$/.test(raw)) return (Number(raw) >>> 0) || 1;
  return hashSeed(raw);
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "kindling-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function newState(seed) {
  const runId = uid();
  const created = {
    version: 1,
    runId: runId,
    gameVersion: GAME_VERSION,
    buildStamp: BUILD_STAMP,
    seed: Number(seed) >>> 0 || 1,
    startedAt: nowIso(),
    endedAt: null,
    phase: "route",
    stage: 0,
    light: 3,
    maxLight: 4,
    slots: STARTER_SLOTS.slice(),
    routeChoice: null,
    offerIds: [],
    selectedPart: null,
    travelStartedAt: null,
    history: [],
    memories: [],
    scars: [],
    lastResult: null,
    won: false,
    endReason: null,
    survey: null,
    noteDraft: "",
    telemetry: {
      runId: runId,
      startedAt: nowIso(),
      events: [],
      sentAt: null,
      error: null
    }
  };
  record(created, {
    type: "run_started",
    game: GAME_VERSION,
    seed: created.seed,
    buildStamp: BUILD_STAMP,
    starter: buildSignature(created.slots)
  });
  return created;
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.version === 1 && saved.gameVersion === GAME_VERSION && Array.isArray(saved.slots)) {
        return saved;
      }
    }
  } catch (error) {
    // A clean run is safer than blocking the game when storage is unavailable.
  }
  return newState(querySeed());
}

function persist() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch (error) {
    // The game remains playable without local persistence.
  }
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character];
  });
}

function currentScene() {
  return sceneFor(state.stage, state.seed);
}

function currentRoute() {
  const scene = currentScene();
  return scene.options.find(function (route) {
    return route.id === state.routeChoice;
  }) || null;
}

function phaseText() {
  return {
    route: "道を選ぶ",
    build: "体をつくる",
    travel: "歩く",
    result: "結果を受け取る",
    done: "あとがき"
  }[state.phase] || "夜道";
}

function routeForHistory(item) {
  const scene = SCENES[item.stage] || SCENES[0];
  return scene.routes.find(function (route) {
    return route.id === item.route;
  }) || scene.routes[0];
}

function useText(use) {
  if (!use) return "この部位では、まだ働き方が見えない";
  return statLabel(use.stat) + " +" + use.value + " / " + use.verb;
}

function partUseList(partId) {
  const part = partById(partId);
  if (!part) return "";
  return SLOT_KEYS.map(function (slotKey) {
    const use = useFor(partId, slotKey);
    return "<span class=\"use-chip\"><b>" + esc(SLOT_LABELS[slotKey]) + "</b> " + esc(useText(use)) + "</span>";
  }).join("");
}

function requirementChips(route, result) {
  return Object.entries(route.req).map(function (entry) {
    const stat = entry[0];
    const need = entry[1];
    const have = result && result.requirements ? ((result.requirements.find(function (item) {
      return item.stat === stat;
    }) || {}).have || 0) : null;
    const display = have == null ? "必要 " + need : have + " / " + need;
    const okay = have != null && have >= need;
    return "<span class=\"req-chip " + (okay ? "is-ok" : "") + "\"><b>" + esc(statLabel(stat)) + "</b> " + display + "</span>";
  }).join("");
}

function lightHtml() {
  const dots = Array.from({ length: state.maxLight }, function (_, index) {
    return "<span class=\"light-dot " + (index < state.light ? "is-lit" : "") + "\" aria-label=\"" + (index < state.light ? "灯っている" : "消えている") + "\"></span>";
  }).join("");
  return "<section class=\"light-strip\" aria-label=\"残りの灯り\">" +
    "<div><span class=\"section-kicker\">帰るまでの灯り</span><strong>" + state.light + "<small> / " + state.maxLight + "</small></strong></div>" +
    "<div class=\"light-dots\">" + dots + "</div>" +
    "<p>" + (state.light > 1 ? "失敗しても、まだ夜は続く。" : state.light === 1 ? "次に落とすと、夜明けまで届かない。" : "灯りは消えた。") + "</p>" +
    "</section>";
}

function progressHtml() {
  const items = Array.from({ length: SCENES.length }, function (_, index) {
    const item = SCENES[index];
    const cls = index < state.stage || state.phase === "done" ? "is-done" : index === state.stage && state.phase !== "done" ? "is-current" : "";
    return "<span class=\"progress-node " + cls + "\" title=\"" + esc(item.title) + "\"><i>" + (index + 1) + "</i><b>" + esc(item.title) + "</b></span>";
  }).join("");
  return "<div class=\"progress-track\">" + items + "</div>";
}

function headerHtml() {
  return "<header class=\"topbar\">" +
    "<div><span class=\"eyebrow\">KINDLING / 夜道の構築譚</span><h1>拾い火 <em>KINDLING</em></h1></div>" +
    "<div class=\"stamp\"><span>" + esc(GAME_VERSION) + "</span><span>" + esc(BUILD_STAMP) + "</span></div>" +
    "</header>";
}

function canvasHtml() {
  const scene = currentScene();
  const current = state.lastResult && state.lastResult.scene === scene.title ? state.lastResult : null;
  const caption = state.phase === "done" ? "拾ったものは、もう相棒の一部になっている。" :
    state.phase === "travel" ? "相棒が、選んだ道を歩いている。" :
    current ? (current.passed ? "通れた。相棒の中で、拾ったものが鳴っている。" : "足りなかった。けれど、相棒はまだここにいる。") :
    scene.intro;
  return "<section class=\"canvas-card\">" +
    "<div class=\"canvas-meta\"><span>" + esc(scene.eyebrow) + "</span><span>" + esc(phaseText()) + "</span></div>" +
    "<div class=\"canvas-wrap\"><canvas id=\"scene-canvas\" aria-label=\"" + esc(scene.title) + "の夜道のアニメーション\"></canvas><div class=\"canvas-glow\"></div></div>" +
    "<div class=\"canvas-caption\"><strong>" + esc(scene.title) + "</strong><span>" + esc(caption) + "</span></div>" +
    "</section>";
}

function routeCard(route, index) {
  const chosen = state.routeChoice === route.id;
  const result = evaluateBuild(state.slots, route);
  return "<button class=\"route-card " + (chosen ? "is-chosen" : "") + "\" data-route=\"" + esc(route.id) + "\" type=\"button\">" +
    "<span class=\"route-icon\">" + esc(route.icon) + "</span>" +
    "<span class=\"route-copy\"><b>" + esc(route.name) + "</b><span>" + esc(route.desc) + "</span><span class=\"route-req\">" + requirementChips(route, null) + "</span><small>" + (route.reward === "memory" ? "記憶が残る" : "灯りが戻る") + "</small></span>" +
    "<span class=\"route-arrow\">" + (chosen ? "選択中" : "選ぶ") + "</span>" +
    "</button>";
}

function routePanel() {
  const scene = currentScene();
  return "<section class=\"game-panel route-panel\">" +
    "<div class=\"panel-heading\"><span class=\"section-kicker\">" + esc(scene.eyebrow) + "</span><h2>" + esc(scene.question) + "</h2><p>" + esc(scene.intro) + "</p></div>" +
    "<div class=\"route-list\">" + scene.options.map(routeCard).join("") + "</div>" +
    "<div class=\"hint-row\"><span class=\"hint-mark\">✦</span><span>同じ拾いものでも、目・胸・手・脚のどこに組み込むかで働き方が変わる。</span></div>" +
    "</section>";
}

function bodySlot(index, placementMode) {
  const slotKey = SLOT_KEYS[index];
  const partId = state.slots[index];
  const part = partById(partId);
  const selected = state.selectedPart;
  const selectedUse = selected ? useFor(selected, slotKey) : null;
  const action = placementMode ? " data-slot=\"" + index + "\"" : "";
  return "<button class=\"body-slot " + (placementMode ? "is-placeable" : "") + " " + (part ? "has-part" : "is-empty") + "\"" + action + " type=\"button\" style=\"--part-color:" + esc(part ? part.color : "#68738e") + "\">" +
    "<span class=\"slot-label\">" + esc(SLOT_LABELS[slotKey]) + "</span>" +
    "<span class=\"slot-glyph\">" + esc(part ? part.glyph : "＋") + "</span>" +
    "<span class=\"slot-part\">" + esc(part ? part.name : "空き") + "</span>" +
    "<span class=\"slot-use\">" + esc(placementMode ? useText(selectedUse) : useText(part && part.uses[slotKey])) + "</span>" +
    (placementMode ? "<span class=\"slot-action\">" + (selectedUse ? "ここに組み込む" : "働き方が薄い") + "</span>" : "") +
    "</button>";
}

function bodyMapHtml(placementMode) {
  return "<div class=\"body-map\">" +
    "<div class=\"body-orbit orbit-a\"></div><div class=\"body-orbit orbit-b\"></div>" +
    "<div class=\"body-slots\">" + SLOT_KEYS.map(function (_, index) { return bodySlot(index, placementMode); }).join("") + "</div>" +
    "</div>";
}

function offerCard(partId) {
  const part = partById(partId);
  const selected = state.selectedPart === partId;
  return "<button class=\"offer-card " + (selected ? "is-selected" : "") + "\" data-part=\"" + esc(partId) + "\" type=\"button\" style=\"--part-color:" + esc(part.color) + "\">" +
    "<span class=\"offer-glyph\">" + esc(part.glyph) + "</span>" +
    "<span class=\"offer-copy\"><b>" + esc(part.name) + "</b><span>" + esc(part.line) + "</span><span class=\"offer-uses\">" + partUseList(partId) + "</span></span>" +
    "<span class=\"offer-tag\">" + (selected ? "選択中" : "拾う") + "</span>" +
    "</button>";
}

function activeBuildSummary(result) {
  const actions = result.actions.filter(function (action) { return action.partId && action.use; });
  if (!actions.length) return "<p class=\"muted\">まだ体に組み込まれたものがない。</p>";
  return "<div class=\"active-actions\">" + actions.map(function (action) {
    return "<span class=\"active-action\"><i style=\"--part-color:" + esc(action.color) + "\">" + esc(action.glyph) + "</i><b>" + esc(action.slotName) + "</b><span>" + esc(action.partName) + " → " + esc(useText(action.use)) + "</span></span>";
  }).join("") + "</div>";
}

function buildPanel() {
  const scene = currentScene();
  const route = currentRoute();
  const result = route ? evaluateBuild(state.slots, route) : null;
  const offers = state.offerIds.map(function (id) { return partById(id); }).filter(Boolean);
  return "<section class=\"game-panel build-panel\">" +
    "<div class=\"build-intro\"><div><span class=\"section-kicker\">体をつくる / " + esc(route ? route.name : "") + "</span><h2>拾ったものを、どこにする？</h2><p>正解の部位は一つではない。今の道を見て、相棒の次の一手を組み立てる。</p></div><span class=\"route-badge\">" + esc(route ? route.icon : "·") + "</span></div>" +
    "<div class=\"route-brief\"><span><b>この道に必要</b> " + (route ? requirementChips(route, result) : "") + "</span><span>" + esc(route ? route.desc : "") + "</span></div>" +
    "<div class=\"build-grid\"><div><div class=\"mini-heading\"><span>いまの相棒</span><small>" + esc(buildSignature(state.slots)) + "</small></div>" + bodyMapHtml(Boolean(state.selectedPart)) + "</div>" +
    "<div class=\"offers\"><div class=\"mini-heading\"><span>今夜拾えるもの</span><small>2つだけ</small></div>" + offers.map(function (part) { return offerCard(part.id); }).join("") + "</div></div>" +
    "<div class=\"build-readout\"><div class=\"mini-heading\"><span>体の働き</span><small>組み込みで変わる</small></div>" + activeBuildSummary(result) + "</div>" +
    "<div class=\"build-footer\"><p class=\"selection-note\">" + (state.selectedPart ? "「" + esc(partName(state.selectedPart)) + "」を選択中。組み込みたい部位をタップ。" : "組み込みを終えたら、この体で歩ける。必要なら拾わずに進んでもよい。") + "</p>" +
    "<button class=\"primary-button " + (!state.selectedPart ? "is-ready" : "") + "\" data-start=\"travel\" type=\"button\" " + (!state.selectedPart ? "" : "disabled") + ">" + (!state.selectedPart ? "この体で歩く" : "まず拾うものを組み込む") + "<span>→</span></button></div>" +
    "</section>";
}

function travelPanel() {
  const route = currentRoute();
  const result = state.lastResult;
  return "<section class=\"game-panel travel-panel\">" +
    "<div class=\"travel-mark\"><span class=\"travel-pulse\"></span><span>TRAVELING</span></div>" +
    "<h2>相棒が、" + esc(route ? route.name : "選んだ道") + "を歩いている。</h2>" +
    "<p>部位に宿った働きが、夜道で本当に使えるかを見届ける。</p>" +
    "<div class=\"travel-recipe\">" + (result ? requirementChips(route, result) : "") + "</div>" +
    "<button class=\"secondary-button\" data-finish-travel=\"1\" type=\"button\">結果を受け取る <span>→</span></button>" +
    "</section>";
}

function resultPanel() {
  const item = state.lastResult;
  const route = currentRoute() || routeForHistory(item || {});
  if (!item) return "";
  const comboHtml = item.combos.length ? "<div class=\"combo-list\">" + item.combos.map(function (combo) {
    return "<div class=\"combo-card\" style=\"--combo-color:" + esc(combo.color) + "\"><span>✦</span><div><b>" + esc(combo.name) + "</b><small>" + esc(combo.text) + "</small></div></div>";
  }).join("") + "</div>" : "";
  const actionsHtml = item.actions.filter(function (action) { return action.partId && action.use; }).map(function (action) {
    return "<div class=\"action-row\"><span style=\"--part-color:" + esc(action.color) + "\">" + esc(action.glyph) + "</span><b>" + esc(action.slotName) + " / " + esc(action.partName) + "</b><small>" + esc(useText(action.use)) + "</small></div>";
  }).join("");
  const terminal = state.stage >= SCENES.length - 1 || state.light <= 0;
  const buttonLabel = terminal ? "夜明けを見る" : "次の夜道へ";
  return "<section class=\"game-panel result-panel " + (item.passed ? "is-pass" : "is-fail") + "\">" +
    "<div class=\"result-banner\"><span class=\"result-symbol\">" + (item.passed ? "✦" : "·") + "</span><div><span class=\"section-kicker\">" + (item.passed ? "通れた" : "灯りを落とした") + "</span><h2>" + esc(item.scene) + "</h2></div><strong>" + (item.passed ? "+" + (item.reward === "light" ? "灯り" : "記憶") : "-1 灯り") + "</strong></div>" +
    "<p class=\"story-result\">" + esc(item.story) + "</p>" +
    (item.close && !item.passed ? "<p class=\"near-miss\">あと一つだった。次は、どの部位を変える？</p>" : "") +
    comboHtml +
    "<div class=\"result-columns\"><div><div class=\"mini-heading\"><span>相棒がしたこと</span><small>" + (item.actions.filter(function (action) { return action.partId; }).length) + " pieces</small></div><div class=\"action-list\">" + (actionsHtml || "<p class=\"muted\">空のまま歩いた。</p>") + "</div></div><div><div class=\"mini-heading\"><span>道の判定</span><small>" + (item.totals ? "組み込み後" : "") + "</small></div><div class=\"requirement-list\">" + item.requirements.map(function (req) {
    return "<div class=\"requirement-row " + (req.ok ? "is-ok" : "is-miss") + "\"><span>" + esc(req.label) + "</span><b>" + req.have + " / " + req.need + "</b><i>" + (req.ok ? "OK" : "不足") + "</i></div>";
  }).join("") + "</div></div></div>" +
    "<p class=\"reward-line\">" + esc(item.rewardText) + "</p>" +
    "<button class=\"primary-button is-ready\" data-" + (terminal ? "final" : "advance") + "=\"1\" type=\"button\">" + buttonLabel + "<span>→</span></button>" +
    "</section>";
}

function historyHtml(includeCurrent) {
  const rows = state.history.filter(function (item) {
    return includeCurrent || item.stage < state.stage;
  }).map(function (item) {
    return "<div class=\"history-row " + (item.passed ? "is-pass" : "is-fail") + "\"><span class=\"history-index\">0" + (item.stage + 1) + "</span><div><b>" + esc(item.scene) + " / " + esc(item.routeName) + "</b><small>" + esc(item.story) + "</small></div><strong>" + (item.passed ? "通過" : "傷") + "</strong></div>";
  }).join("");
  if (!rows) return "";
  return "<section class=\"history-panel\"><div class=\"mini-heading\"><span>ここまでの夜道</span><small>" + state.history.length + " / " + SCENES.length + "</small></div>" + rows + "</section>";
}

function markerHtml() {
  return "<section class=\"marker-panel\"><div class=\"marker-heading\"><span class=\"section-kicker\">今の気持ちを残す</span><p>一つだけでも、複数でも。感じた瞬間に押してよい。</p></div><div class=\"marker-list\">" + MARKERS.map(function (marker) {
    return "<button type=\"button\" class=\"marker-button\" data-marker=\"" + marker.kind + "\">" + marker.label + "</button>";
  }).join("") + "</div><label class=\"note-label\">ひとことメモ <textarea id=\"emotion-note\" rows=\"2\" maxlength=\"240\" placeholder=\"何がそう思わせた？\">" + esc(state.noteDraft) + "</textarea></label></section>";
}

function finalPanel() {
  const winning = state.won;
  const memories = state.memories.length ? state.memories.map(function (memory) {
    return "<li>" + esc(memory) + "</li>";
  }).join("") : "<li>まだ、名前のない夜だった。</li>";
  const summary = winning ?
    "相棒は窓辺に灯りを置いた。拾ったものは、ただのガラクタではなく、帰るための形になった。" :
    "朝は来た。けれど、相棒の胸に残った小さな火は、まだ消えていない。次は別の形で帰れるかもしれない。";
  const sendLabel = state.telemetry && state.telemetry.sentAt ? "送信済み" : state.sendState || "未送信";
  return "<section class=\"game-panel final-panel\">" +
    "<div class=\"final-heading\"><span class=\"section-kicker\">" + (winning ? "THE LIGHT CAME HOME" : "THE NIGHT CONTINUES") + "</span><h2>" + (winning ? "灯りが、帰った。" : "まだ、夜の途中。") + "</h2><p>" + summary + "</p></div>" +
    "<div class=\"final-columns\"><div><div class=\"mini-heading\"><span>残った記憶</span><small>" + state.memories.length + " pieces</small></div><ul class=\"memory-list\">" + memories + "</ul></div><div><div class=\"mini-heading\"><span>今回の形</span><small>" + esc(buildSignature(state.slots)) + "</small></div><div class=\"final-stat\"><b>" + state.history.length + "</b><span>夜道を進んだ</span></div><div class=\"final-stat\"><b>" + state.light + "</b><span>灯りが残った</span></div></div></div>" +
    historyHtml(true) +
    "<form class=\"survey-form\" id=\"survey-form\"><div class=\"mini-heading\"><span>このゲームを教えてください</span><small>送信前に確認できます</small></div><fieldset><legend>面白さ</legend><div class=\"scale-row\">" + [1, 2, 3, 4, 5].map(function (value) { return "<label><input type=\"radio\" name=\"fun\" value=\"" + value + "\" required><span>" + value + "</span></label>"; }).join("") + "</div><div class=\"scale-hint\"><span>つまらない</span><span>もう一度遊びたい</span></div></fieldset><fieldset><legend>もう一度遊びたい度</legend><div class=\"scale-row\">" + [1, 2, 3, 4, 5].map(function (value) { return "<label><input type=\"radio\" name=\"replay\" value=\"" + value + "\" required><span>" + value + "</span></label>"; }).join("") + "</div></fieldset><label>いちばん残った瞬間<textarea name=\"bestMoment\" rows=\"2\" maxlength=\"240\" required placeholder=\"例：火花が一気に広がったところ\"></textarea></label><label>つまずいた／分からなかったところ<textarea name=\"friction\" rows=\"2\" maxlength=\"240\" required placeholder=\"なければ「なし」\"></textarea></label><label>次に遊ぶなら何を変えたい？<textarea name=\"nextPlan\" rows=\"2\" maxlength=\"240\" required placeholder=\"ルート、拾いもの、物語など\"></textarea></label><button class=\"primary-button is-ready\" type=\"submit\">感想を送る <span>→</span></button><p class=\"send-status\">ログ: " + esc(sendLabel) + (state.telemetry && state.telemetry.error ? " / " + esc(state.telemetry.error) : "") + "</p>" + (state.telemetry && state.telemetry.error ? "<button class=\"secondary-button\" data-resend=\"1\" type=\"button\">もう一度送信 <span>↻</span></button>" : "") + "</form>" +
    "<button class=\"secondary-button new-run-button\" data-new-run=\"1\" type=\"button\" " + (state.survey ? "" : "disabled") + ">別の夜を始める <span>↻</span></button>" +
    "</section>";
}

function phaseHtml() {
  if (state.phase === "route") return routePanel();
  if (state.phase === "build") return buildPanel();
  if (state.phase === "travel") return travelPanel();
  if (state.phase === "result") return resultPanel();
  if (state.phase === "done") return finalPanel();
  return "";
}

function pageHtml() {
  const scene = currentScene();
  return "<main class=\"shell\">" + headerHtml() + progressHtml() + canvasHtml() + lightHtml() + phaseHtml() +
    (state.phase !== "done" ? historyHtml(false) : "") +
    (state.phase !== "done" || state.survey ? markerHtml() : "") +
    "<footer class=\"footer-note\"><span>seed " + esc(state.seed) + "</span><span>" + (state.telemetry ? state.telemetry.events.length : 0) + " events</span><span>" + esc(scene.title) + "</span></footer></main>";
}

function render() {
  if (!app) return;
  app.innerHTML = pageHtml();
  persist();
  if (!rafId) rafId = requestAnimationFrame(drawFrame);
}

function setMessage(text) {
  message = text;
  render();
}

function chooseRoute(routeId) {
  if (state.phase !== "route") return;
  const scene = currentScene();
  const route = scene.options.find(function (item) { return item.id === routeId; });
  if (!route) return;
  state.routeChoice = route.id;
  state.offerIds = offersFor(state);
  state.selectedPart = null;
  state.phase = "build";
  record(state, {
    type: "route_chosen",
    stage: state.stage,
    scene: scene.title,
    route: route.id,
    routeName: route.name,
    requirements: route.req
  });
  message = "拾ったものを、相棒のどこにするか決める。";
  chirp("choice");
  render();
}

function choosePart(partId) {
  if (state.phase !== "build" || state.offerIds.indexOf(partId) < 0) return;
  state.selectedPart = partId;
  const part = partById(partId);
  record(state, {
    type: "part_selected",
    stage: state.stage,
    scene: currentScene().title,
    partId: partId,
    partName: part ? part.name : partId,
    available: state.offerIds.slice()
  });
  message = "部位を選ぶと、同じ素材の別の顔が見える。";
  chirp("pick");
  render();
}

function installPart(slotIndex) {
  if (state.phase !== "build" || !state.selectedPart) return;
  const index = Number(slotIndex);
  if (!Number.isInteger(index) || index < 0 || index >= SLOT_KEYS.length) return;
  const selected = state.selectedPart;
  const before = state.slots.slice();
  const oldIndex = state.slots.indexOf(selected);
  const displaced = state.slots[index];
  if (oldIndex >= 0 && oldIndex !== index) state.slots[oldIndex] = displaced || null;
  state.slots[index] = selected;
  state.selectedPart = null;
  const use = useFor(selected, SLOT_KEYS[index]);
  record(state, {
    type: "part_installed",
    stage: state.stage,
    scene: currentScene().title,
    partId: selected,
    partName: partName(selected),
    slot: index,
    slotName: SLOT_LABELS[SLOT_KEYS[index]],
    use: use,
    before: before,
    after: state.slots.slice()
  });
  message = use ? partName(selected) + "が" + use.verb + "。" : "その部位では、まだ働き方が見えない。";
  chirp("install");
  vibrate(12);
  render();
}

function resolveTravel() {
  if (state.phase !== "build" || !state.routeChoice) return;
  const route = currentRoute();
  if (!route) return;
  const result = evaluateBuild(state.slots, route);
  const passed = result.passed;
  const lightBefore = state.light;
  const lightAfter = passed ? Math.min(state.maxLight, state.light + (route.reward === "light" ? 1 : 0)) : Math.max(0, state.light - 1);
  const rewardText = passed ? route.rewardText : "拾ったものは、次の夜にも残っている";
  const story = passed ? route.success : FAIL_LINES[state.stage] || "相棒は、まだあなたの手を離さない。";
  const item = {
    stage: state.stage,
    scene: currentScene().title,
    route: route.id,
    routeName: route.name,
    passed: passed,
    close: result.close,
    primary: result.primaryStat,
    secondary: Object.keys(route.req)[1] || null,
    requirements: result.requirements,
    totals: result.totals,
    rawTotals: result.rawTotals,
    combos: result.combos,
    actions: result.actions,
    reward: route.reward,
    rewardText: rewardText,
    story: story,
    lightBefore: lightBefore,
    lightAfter: lightAfter
  };
  state.light = lightAfter;
  if (passed && route.reward === "memory") state.memories.push(route.rewardText);
  if (!passed) state.scars.push(currentScene().title);
  state.history.push(item);
  state.lastResult = item;
  state.travelStartedAt = Date.now();
  state.phase = "travel";
  record(state, {
    type: "scene_started",
    stage: state.stage,
    scene: item.scene,
    route: route.id,
    build: buildSignature(state.slots)
  });
  record(state, {
    type: "scene_resolved",
    stage: state.stage,
    scene: item.scene,
    route: route.id,
    passed: item.passed,
    close: item.close,
    requirements: item.requirements,
    totals: item.totals,
    combos: item.combos.map(function (combo) { return combo.id; }),
    lightBefore: lightBefore,
    lightAfter: lightAfter
  });
  message = passed ? "通れた。拾ったものが、相棒の動きになった。" : "足りなかった。でも、その失敗も相棒の記憶になる。";
  chirp(passed ? "pass" : "fail");
  vibrate(passed ? [12, 30, 28] : [35, 20, 35]);
  render();
  clearTimeout(travelTimer);
  travelTimer = setTimeout(function () {
    finishTravel();
  }, 1850);
}

function finishTravel() {
  if (state.phase !== "travel") return;
  state.phase = "result";
  render();
}

function advanceScene() {
  if (state.phase !== "result") return;
  if (state.stage >= SCENES.length - 1 || state.light <= 0) {
    showFinal();
    return;
  }
  state.stage += 1;
  state.routeChoice = null;
  state.offerIds = [];
  state.selectedPart = null;
  state.lastResult = null;
  state.phase = "route";
  record(state, {
    type: "scene_opened",
    stage: state.stage,
    scene: currentScene().title,
    light: state.light
  });
  message = "次の角。相棒の形を、また少し変えられる。";
  chirp("advance");
  render();
}

function showFinal() {
  if (state.phase !== "result") return;
  state.phase = "done";
  state.won = state.stage >= SCENES.length - 1 && Boolean(state.lastResult && state.lastResult.passed) && state.light > 0;
  state.endedAt = nowIso();
  state.endReason = state.won ? "home" : (state.light <= 0 ? "light_out" : "final_route_failed");
  record(state, {
    type: "run_ended",
    won: state.won,
    reason: state.endReason,
    reached: state.history.length,
    light: state.light,
    build: buildSignature(state.slots)
  });
  message = state.won ? "帰る場所に、灯りを置けた。" : "朝は来た。次は別の形で帰れるかもしれない。";
  chirp(state.won ? "win" : "end");
  render();
}

function markEmotion(kind) {
  const marker = MARKERS.find(function (item) { return item.kind === kind; });
  if (!marker) return;
  record(state, {
    type: "emotion_marked",
    kind: kind,
    label: marker.label,
    phase: state.phase,
    stage: state.stage,
    scene: currentScene().title,
    note: state.noteDraft || ""
  });
  message = marker.label + " を記録した。";
  chirp("marker");
  persist();
  const button = document.querySelector("[data-marker=\"" + kind + "\"]");
  if (button) {
    button.classList.add("is-flashed");
    setTimeout(function () { button.classList.remove("is-flashed"); }, 300);
  }
}

function updateNote(value) {
  state.noteDraft = value.slice(0, 240);
  persist();
}

async function submitSurvey(form) {
  const formData = new FormData(form);
  const survey = {
    fun: Number(formData.get("fun")),
    replay: Number(formData.get("replay")),
    bestMoment: String(formData.get("bestMoment") || "").trim(),
    friction: String(formData.get("friction") || "").trim(),
    nextPlan: String(formData.get("nextPlan") || "").trim()
  };
  if (!survey.fun || !survey.replay || !survey.bestMoment || !survey.friction || !survey.nextPlan) return;
  state.survey = survey;
  record(state, { type: "survey_submitted", survey: survey });
  state.sendState = "送信中…";
  render();
  const result = await send(state);
  state.sendState = result.ok ? "送信済み" : "送信失敗";
  persist();
  render();
}

async function resendLog() {
  state.sendState = "送信中…";
  render();
  const result = await send(state);
  state.sendState = result.ok ? "送信済み" : "送信失敗";
  persist();
  render();
}

function startNewRun() {
  if (!state.survey) {
    message = "先に今回の感想を送ると、次の夜を始められる。";
    render();
    return;
  }
  state = newState(randomSeed());
  message = "新しい夜。前とは違う拾いものが待っている。";
  render();
}

function chirp(kind) {
  if (typeof window === "undefined") return;
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const base = {
      choice: 320,
      pick: 420,
      install: 520,
      pass: 660,
      fail: 180,
      marker: 760,
      advance: 440,
      win: 880,
      end: 130
    }[kind] || 300;
    oscillator.type = kind === "fail" || kind === "end" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(base, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(base * (kind === "fail" || kind === "end" ? 0.72 : 1.35), audioContext.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.24);
  } catch (error) {
    // Audio is an enhancement, not a requirement for playability.
  }
}

function vibrate(pattern) {
  try {
    if (navigator && navigator.vibrate) navigator.vibrate(pattern);
  } catch (error) {
    // Haptics are optional.
  }
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawFrame(time) {
  const canvas = document.getElementById("scene-canvas");
  if (!canvas) {
    rafId = null;
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const scene = currentScene();
  const stage = state.stage;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, stage >= 4 ? "#0e152b" : "#111b35");
  sky.addColorStop(0.58, stage === 3 ? "#243044" : "#1b2540");
  sky.addColorStop(1, "#0b0f1e");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const rng = function (index) {
    const value = Math.sin((state.seed + index * 997 + stage * 131) * 0.0001) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let index = 0; index < 26; index += 1) {
    const x = rng(index) * width;
    const y = 18 + rng(index + 31) * height * 0.48;
    const alpha = 0.22 + rng(index + 61) * 0.5;
    context.fillStyle = "rgba(255,237,190," + alpha + ")";
    context.beginPath();
    context.arc(x, y, 0.7 + rng(index + 91) * 1.5, 0, Math.PI * 2);
    context.fill();
  }

  const moonX = width * (0.78 - stage * 0.035);
  const moonY = height * 0.22;
  const moonRadius = Math.min(width, height) * 0.095;
  const moonGlow = context.createRadialGradient(moonX, moonY, 1, moonX, moonY, moonRadius * 2.8);
  moonGlow.addColorStop(0, "rgba(255,222,157,.28)");
  moonGlow.addColorStop(1, "rgba(255,222,157,0)");
  context.fillStyle = moonGlow;
  context.beginPath();
  context.arc(moonX, moonY, moonRadius * 2.8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f8ddaa";
  context.beginPath();
  context.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#d9c38f";
  context.globalAlpha = 0.24;
  context.beginPath();
  context.arc(moonX - moonRadius * 0.25, moonY - moonRadius * 0.1, moonRadius * 0.22, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  drawWorld(context, width, height, stage, time);

  const travelProgress = state.phase === "travel" && state.travelStartedAt ? Math.min(1, Math.max(0, (Date.now() - state.travelStartedAt) / 1850)) : 0;
  const resultPassed = state.lastResult && state.lastResult.stage === stage && state.lastResult.passed;
  const resultFailed = state.lastResult && state.lastResult.stage === stage && !state.lastResult.passed;
  let companionProgress = state.phase === "travel" ? 0.2 + travelProgress * 0.6 : resultPassed ? 0.78 : resultFailed ? 0.5 : state.phase === "done" ? 0.75 : 0.22;
  let wobble = Math.sin(time / 230) * 2.5;
  if (state.phase === "travel") wobble += Math.sin(time / 32) * (resultFailed ? 2.5 : 0.8);
  const cx = width * companionProgress + wobble;
  const baseY = height * 0.72 + Math.sin(time / 390) * 3;
  drawCompanion(context, cx, baseY, Math.min(width, height) / 260, time, state);
  if (state.phase === "travel") drawTravelDust(context, cx, baseY, travelProgress, resultPassed);
  if (resultPassed && (state.phase === "result" || state.phase === "done")) drawBurst(context, cx, baseY - 82, time);
  if (resultFailed && state.phase === "result") drawFailRain(context, width, height, time);

  context.fillStyle = "rgba(255,255,255,.65)";
  context.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.letterSpacing = "1px";
  context.fillText(scene.eyebrow.toUpperCase(), 18, height - 16);
  context.letterSpacing = "0px";
  rafId = requestAnimationFrame(drawFrame);
}

function drawWorld(context, width, height, stage, time) {
  const ground = height * 0.77;
  context.fillStyle = "rgba(6,9,19,.82)";
  context.beginPath();
  context.moveTo(0, ground);
  for (let x = 0; x <= width; x += 22) {
    context.lineTo(x, ground - 12 - Math.sin(x * 0.035 + stage) * 8);
  }
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(255,214,138,.12)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(width * 0.05, ground + 2);
  context.lineTo(width * 0.94, ground + 2);
  context.stroke();

  if (stage === 0) {
    for (let i = 0; i < 6; i += 1) {
      const x = width * (0.12 + i * 0.16);
      const y = height * (0.58 + Math.sin(time / 900 + i) * 0.015);
      context.fillStyle = "rgba(179,196,228," + (0.07 + i * 0.01) + ")";
      context.beginPath();
      context.ellipse(x, y, width * 0.13, height * 0.08, 0, 0, Math.PI * 2);
      context.fill();
    }
  } else if (stage === 1) {
    drawIronDog(context, width * 0.72, height * 0.58, Math.min(width, height) / 220, time);
  } else if (stage === 2) {
    context.strokeStyle = "#46516f";
    context.lineWidth = 10;
    context.beginPath();
    context.moveTo(width * 0.06, height * 0.66);
    context.lineTo(width * 0.38, height * 0.66);
    context.moveTo(width * 0.62, height * 0.66);
    context.lineTo(width * 0.95, height * 0.66);
    context.stroke();
    context.strokeStyle = "rgba(255,196,107,.55)";
    context.lineWidth = 2;
    context.setLineDash([4, 7]);
    context.beginPath();
    context.moveTo(width * 0.07, height * 0.61);
    context.lineTo(width * 0.37, height * 0.61);
    context.moveTo(width * 0.63, height * 0.61);
    context.lineTo(width * 0.94, height * 0.61);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "rgba(10,13,27,.9)";
    context.beginPath();
    context.moveTo(width * 0.37, height * 0.64);
    context.lineTo(width * 0.63, height * 0.64);
    context.lineTo(width * 0.55, height);
    context.lineTo(width * 0.45, height);
    context.closePath();
    context.fill();
  } else if (stage === 3) {
    for (let i = 0; i < 4; i += 1) {
      const x = width * (0.06 + i * 0.24);
      context.fillStyle = i % 2 ? "#465878" : "#6d4f68";
      context.beginPath();
      context.moveTo(x, height * 0.54);
      context.lineTo(x + width * 0.18, height * 0.54);
      context.lineTo(x + width * 0.13, height * 0.42);
      context.lineTo(x + width * 0.05, height * 0.42);
      context.closePath();
      context.fill();
      context.fillStyle = "rgba(255,210,134,.32)";
      context.fillRect(x + width * 0.075, height * 0.49, width * 0.05, 3);
    }
    context.strokeStyle = "rgba(255,224,169,.2)";
    context.lineWidth = 1;
    for (let i = 0; i < 9; i += 1) {
      context.beginPath();
      context.moveTo(width * 0.03 + i * width * 0.12, height * 0.32);
      context.lineTo(width * 0.08 + i * width * 0.12, height * 0.54);
      context.stroke();
    }
  } else if (stage === 4) {
    context.fillStyle = "#1b213b";
    context.fillRect(width * 0.68, height * 0.18, width * 0.16, height * 0.58);
    context.fillStyle = "#303a5b";
    for (let i = 0; i < 5; i += 1) context.fillRect(width * 0.71, height * (0.25 + i * 0.095), width * 0.1, 3);
    context.fillStyle = "rgba(9,11,24,.86)";
    context.beginPath();
    context.arc(width * 0.46, height * 0.55, width * 0.11 + Math.sin(time / 300) * 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillStyle = "#202945";
    roundedRect(context, width * 0.66, height * 0.26, width * 0.24, height * 0.43, 9);
    context.fill();
    context.fillStyle = "rgba(255,216,151,.38)";
    roundedRect(context, width * 0.7, height * 0.31, width * 0.16, height * 0.29, 5);
    context.fill();
    context.strokeStyle = "rgba(255,228,178,.56)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(width * 0.78, height * 0.31);
    context.lineTo(width * 0.78, height * 0.6);
    context.moveTo(width * 0.7, height * 0.455);
    context.lineTo(width * 0.86, height * 0.455);
    context.stroke();
    context.fillStyle = "#d9a6c8";
    context.beginPath();
    context.arc(width * 0.78, height * 0.455, 5 + Math.sin(time / 250) * 1.5, 0, Math.PI * 2);
    context.fill();
  }
}

function drawIronDog(context, x, y, scale, time) {
  const pulse = Math.sin(time / 160) * 2;
  context.save();
  context.translate(x, y + pulse);
  context.scale(scale, scale);
  context.fillStyle = "#3f4c6a";
  roundedRect(context, -42, -18, 78, 42, 11);
  context.fill();
  context.fillStyle = "#7383a8";
  context.beginPath();
  context.moveTo(28, -16);
  context.lineTo(54, -5);
  context.lineTo(39, 13);
  context.lineTo(23, 8);
  context.closePath();
  context.fill();
  context.fillStyle = "#ff8b5d";
  context.beginPath();
  context.arc(42, -2, 4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#7f8dac";
  context.lineWidth = 7;
  for (let i = -28; i <= 22; i += 25) {
    context.beginPath();
    context.moveTo(i, 18);
    context.lineTo(i - 4, 40);
    context.stroke();
  }
  context.strokeStyle = "rgba(255,139,93,.35)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(47, 4);
  context.lineTo(70, 8 + Math.sin(time / 90) * 4);
  context.stroke();
  context.restore();
}

function drawCompanion(context, x, baseY, scale, time, currentState) {
  const slotParts = currentState.slots.map(function (partId, index) {
    return partById(partId) || { color: "#64708d", glyph: "·", uses: {} };
  });
  const headColor = slotParts[0].color;
  const heartColor = slotParts[1].color;
  const handColor = slotParts[2].color;
  const feetColor = slotParts[3].color;
  const bob = Math.sin(time / 230) * 2;
  context.save();
  context.translate(x, baseY + bob);
  context.scale(scale, scale);
  const glowSize = 45 + currentState.light * 8;
  const glow = context.createRadialGradient(0, -54, 2, 0, -54, glowSize);
  glow.addColorStop(0, "rgba(255,213,121,.36)");
  glow.addColorStop(1, "rgba(255,213,121,0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(0, -54, glowSize, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(0,0,0,.34)";
  context.beginPath();
  context.ellipse(0, 5, 42, 8, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = feetColor;
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-13, -12);
  context.lineTo(-22 + Math.sin(time / 180) * 4, 11);
  context.moveTo(13, -12);
  context.lineTo(22 + Math.sin(time / 180 + 1) * 4, 11);
  context.stroke();

  context.strokeStyle = handColor;
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(-22, -62);
  context.lineTo(-37 + Math.sin(time / 260) * 3, -31);
  context.moveTo(22, -62);
  context.lineTo(37 + Math.sin(time / 260 + 2) * 3, -31);
  context.stroke();

  context.fillStyle = heartColor;
  roundedRect(context, -26, -74, 52, 64, 19);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.25)";
  context.lineWidth = 2;
  context.stroke();

  const coreGlow = context.createRadialGradient(0, -48, 1, 0, -48, 19 + currentState.light * 2);
  coreGlow.addColorStop(0, "#fff0bd");
  coreGlow.addColorStop(0.3, "#ffc867");
  coreGlow.addColorStop(1, "rgba(255,176,78,0)");
  context.fillStyle = coreGlow;
  context.beginPath();
  context.arc(0, -48, 20 + currentState.light * 2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff2c9";
  context.beginPath();
  context.arc(0, -48, 5 + Math.min(3, currentState.light), 0, Math.PI * 2);
  context.fill();

  context.fillStyle = headColor;
  context.beginPath();
  context.arc(0, -91, 29, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.26)";
  context.stroke();

  const gaze = state.phase === "travel" ? 5 : 1;
  context.fillStyle = "#0b1020";
  context.beginPath();
  context.arc(-10 + gaze, -95, 5, 0, Math.PI * 2);
  context.arc(10 + gaze, -95, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff2c9";
  context.beginPath();
  context.arc(-9 + gaze, -96, 1.5, 0, Math.PI * 2);
  context.arc(11 + gaze, -96, 1.5, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(20,24,45,.7)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, -84, 9, 0.15, Math.PI - 0.15);
  context.stroke();

  context.fillStyle = headColor;
  context.font = "17px serif";
  context.textAlign = "center";
  context.fillText(slotParts[0].glyph || "·", 0, -123);
  context.fillStyle = feetColor;
  context.font = "14px serif";
  context.fillText(slotParts[3].glyph || "·", 0, 28);
  context.restore();
}

function drawTravelDust(context, x, baseY, progress, passed) {
  context.save();
  for (let i = 0; i < 8; i += 1) {
    const offset = (i * 13 + progress * 120) % 70;
    context.globalAlpha = Math.max(0, 0.35 - offset / 240);
    context.fillStyle = passed ? "#ffd166" : "#9aa7c4";
    context.beginPath();
    context.arc(x - 35 - offset, baseY + 2 + (i % 3) * 3, 2 + (i % 2), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawBurst(context, x, y, time) {
  const pulse = (Math.sin(time / 170) + 1) / 2;
  context.save();
  context.strokeStyle = "rgba(255,219,133," + (0.35 + pulse * 0.5) + ")";
  context.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const angle = i * Math.PI / 6;
    const length = 18 + pulse * 12 + (i % 3) * 5;
    context.beginPath();
    context.moveTo(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }
  context.restore();
}

function drawFailRain(context, width, height, time) {
  context.save();
  context.strokeStyle = "rgba(146,170,210,.32)";
  context.lineWidth = 1;
  for (let i = 0; i < 15; i += 1) {
    const x = (i * 47 + time / 8) % width;
    const y = (i * 29 + time / 5) % (height * 0.75);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - 4, y + 11);
    context.stroke();
  }
  context.restore();
}

app.addEventListener("click", function (event) {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) return chooseRoute(routeButton.getAttribute("data-route"));
  const partButton = event.target.closest("[data-part]");
  if (partButton) return choosePart(partButton.getAttribute("data-part"));
  const slotButton = event.target.closest("[data-slot]");
  if (slotButton) return installPart(slotButton.getAttribute("data-slot"));
  const startButton = event.target.closest("[data-start]");
  if (startButton) return resolveTravel();
  const finishButton = event.target.closest("[data-finish-travel]");
  if (finishButton) return finishTravel();
  const advanceButton = event.target.closest("[data-advance]");
  if (advanceButton) return advanceScene();
  const finalButton = event.target.closest("[data-final]");
  if (finalButton) return showFinal();
  const markerButton = event.target.closest("[data-marker]");
  if (markerButton) return markEmotion(markerButton.getAttribute("data-marker"));
  const newRunButton = event.target.closest("[data-new-run]");
  if (newRunButton) return startNewRun();
  const resendButton = event.target.closest("[data-resend]");
  if (resendButton) return resendLog();
});

app.addEventListener("input", function (event) {
  if (event.target && event.target.id === "emotion-note") updateNote(event.target.value);
});

app.addEventListener("submit", function (event) {
  if (event.target && event.target.id === "survey-form") {
    event.preventDefault();
    submitSurvey(event.target);
  }
});

window.addEventListener("beforeunload", persist);
if (state.phase === "travel") {
  const elapsed = Date.now() - Number(state.travelStartedAt || Date.now());
  if (elapsed > 1850) finishTravel();
  else {
    clearTimeout(travelTimer);
    travelTimer = setTimeout(finishTravel, 1850 - Math.max(0, elapsed));
  }
}
render();
