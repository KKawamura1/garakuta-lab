import { simulateBattle } from "./engine.mjs";
import { PLAYABLE_CONTENT, DISPLAY_NAMES } from "./playable-content.mjs";
import { DOCTRINES, makeBattle, encounterLabel, packageLabel, packageDetail } from "./playable-battles.mjs";
import { deviceIdForRun, sendPayload, uuid } from "../agent-view/sync.js";

const VERSION = "EXP-18 UI slice 0.1";
const SEED = "slice-1801";
const SAVE_KEY = "exp18-playable-slice-v01";
const app = document.querySelector("#app");

const freshState = () => ({ phase: "intro", stage: 0, packages: [], lastResult: null, error: null, runId: uuid(), startedAt: null, feedback: null });
let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved && typeof saved === "object" ? { ...freshState(), ...saved } : freshState();
  } catch {
    return freshState();
  }
}

function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
function esc(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function namesFor(ids) { return ids.map((id) => DISPLAY_NAMES[id] ?? id).join("、"); }
function targetNames(ids) { return ids.map((id) => actorName(id)).join("、"); }

function button(label, action, disabled = false, className = "button") {
  return `<button class="${className}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
}

function shell(title, subtitle, body) {
  return `<div class="shell"><header class="header"><div><p class="kicker">${VERSION}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><button class="menu" data-action="reset" aria-label="最初から">↺</button></header>${body}<footer>seed: ${SEED} · build: ${VERSION}</footer></div>`;
}

function render() {
  const views = { intro: renderIntro, build: renderBuild, battle: renderBattle, result: renderResult, reward: renderReward, complete: renderComplete };
  app.innerHTML = (views[state.phase] ?? renderIntro)();
  app.querySelectorAll("[data-action]").forEach((element) => element.addEventListener("click", handleAction));
}

function renderIntro() {
  return shell("灰の遠征", "三人の判断を、戦闘の中で確かめる", `<section class="hero card"><div class="sigil">✦</div><p class="lead">ここで選ぶのは、正解ではなく方針です。<br>戦闘は自動で進み、選択の結果をあとから追えます。</p>${button("遠征を始める", "start", false, "button primary")}<p class="hint">この版は、EXP-18のUIと因果表示を確認するための小規模試作です。</p></section><section class="three-up"><div class="card"><b>編成する</b><span>三人の役割と装備を見る</span></div><div class="card"><b>送り出す</b><span>予想した連鎖を観察する</span></div><div class="card"><b>読み替える</b><span>報酬で次の方針を変える</span></div></section>`);
}

function renderBuild() {
  const selected = state.packages;
  const doctrineCards = Object.entries(DOCTRINES).map(([id, pack]) => `<button class="choice ${selected.includes(id) ? "selected" : ""}" data-action="choose-package" data-package="${id}"><span class="choice-title">${esc(pack.name)}</span><span class="choice-short">${esc(pack.short)}</span><span class="choice-detail">${esc(pack.detail)}</span>${selected.includes(id) ? "<i>今回の遠征に採用済み</i>" : ""}</button>`).join("");
  const roster = [
    ["warden", "前衛", "攻撃を防壁へ変える"],
    ["mender", "後衛", "回復の余りを味方へ回す"],
    ["lancer", "遊撃", "余った行動権を拾う"],
  ].map(([id, role, detail]) => `<div class="roster-row"><span class="avatar">${id === "warden" ? "盾" : id === "mender" ? "手" : "槍"}</span><span><b>${esc(DISPLAY_NAMES[id])}</b><small>${role} · ${detail}</small></span></div>`).join("");
  return shell(`第${state.stage}区画`, encounterLabel(state.stage), `<section class="card"><div class="section-head"><div><p class="eyebrow">ROSTER</p><h2>三人を送り出す</h2></div><span class="stage">${state.stage} / 3</span></div><div class="roster">${roster}</div></section><section class="card"><p class="eyebrow">DOCTRINE</p><h2>今回の方針を選ぶ</h2><p class="muted">同じ人物でも、方針を変えると優先する行動と装備が変わります。</p><div class="choices">${doctrineCards}</div>${button("この方針で戦う", "fight", selected.length === 0, "button primary")}</section>`);
}

function renderBattle() {
  const battle = makeBattle(state.stage, state.packages);
  const allies = battle.allies.map((ally) => `<div class="mini-row"><b>${esc(DISPLAY_NAMES[ally.characterId])}</b><span>${namesFor(ally.tactics.map((t) => t.activeSkillId))}</span></div>`).join("");
  const enemies = battle.enemies.map((enemy) => `<div class="enemy"><span class="enemy-mark">◆</span><b>${esc(DISPLAY_NAMES[enemy.enemyActorId])}</b><span>${enemy.hp} HP</span></div>`).join("");
  return shell(`第${state.stage}区画`, "戦闘前の最終確認", `<section class="card battle-plan"><p class="eyebrow">YOUR PLAN</p><h2>${esc(state.packages.map(packageLabel).join(" + "))}</h2><p class="muted">${state.packages.map(packageDetail).join(" ")}</p><div class="split"><div><h3>味方</h3>${allies}</div><div><h3>相手</h3>${enemies}</div></div>${button("戦闘を再生する", "simulate", false, "button primary")}</section><p class="hint centered">実行後は、主要な因果イベントを日本語で確認できます。</p>`);
}

function actorName(id) {
  const actor = state.lastResult?.actors?.find((entry) => entry.instanceId === id);
  return actor?.displayName ?? DISPLAY_NAMES[id] ?? id ?? "誰か";
}

function eventText(event) {
  const source = actorName(event.sourceActorId);
  const target = targetNames(event.targetActorIds || []);
  const v = event.values || {};
  const amount = v.amount ?? v.actual ?? v.proposed;
  const amountText = amount !== undefined ? ` · ${amount}` : "";
  const map = {
    battle_started: "遠征開始",
    round_started: `ラウンド${v.round ?? event.round}開始`,
    actor_activated: `${source}が動き出す`,
    action_declared: `${source}が行動を選んだ`,
    action_started: `${source}の行動が始まる`,
    action_resolved: `${source}の行動が解決した`,
    damage_proposed: `${source}から攻撃の提案${amountText}`,
    damage_taken: `${target || source}がダメージを受けた${amountText}`,
    healing_applied: `${target || source}が回復した${amountText}`,
    excess_damage: "攻撃が余った",
    excess_healing: "回復が余った",
    barrier_gained: `${target || source}に防壁が生まれた${amountText}`,
    resource_gained: `${target || source}が${v.resource || "資源"}を得た${amountText}`,
    resource_unused: `${source}の${v.resource || "資源"}が余った${amountText}`,
    equipment_worn: `${source}の装備が摩耗した${amountText}`,
    equipment_broken: `${source}の装備が壊れた`,
    actor_defeated: `${source}が倒れた`,
    action_skipped: `${source}は行動しなかった`,
    battle_ended: `戦闘終了 · ${v.result || "決着"}`,
  };
  return map[event.type] || `${event.type}${amountText}`;
}

function renderResult() {
  const result = state.lastResult;
  if (!result) return renderBuild();
  const won = result.result === "win";
  const keyEvents = result.events.filter((event) => ["action_started", "damage_taken", "healing_applied", "barrier_gained", "resource_gained", "resource_unused", "equipment_broken", "actor_defeated", "battle_ended"].includes(event.type));
  const events = keyEvents.map((event) => `<li class="event"><span class="event-round">R${event.round}</span><span>${esc(eventText(event))}</span></li>`).join("");
  return shell(won ? "突破した" : "足を止めた", `${encounterLabel(state.stage)} · ${result.roundsUsed}ラウンド`, `<section class="card verdict ${won ? "win" : "loss"}"><div class="verdict-mark">${won ? "✓" : "×"}</div><h2>${won ? "この方針は通った" : "この方針では届かなかった"}</h2><p>${won ? "次の報酬で、さらに読み替えられます。" : "敗因を読んで、次の方針を変えられます。"}</p><div class="metrics"><span><b>${result.metrics.allyHpLost}</b><small>味方HP損失</small></span><span><b>${result.metrics.equipmentWear}</b><small>装備摩耗</small></span><span><b>${result.metrics.reactionsFired}</b><small>反応発火</small></span></div></section><section class="card"><div class="section-head"><div><p class="eyebrow">CAUSE & EFFECT</p><h2>何が起きたか</h2></div><span class="count">${keyEvents.length} events</span></div><ol class="events">${events}</ol><details><summary>全イベントを見る</summary><pre>${esc(result.events.map(eventText).join("\n"))}</pre></details></section>${button(state.stage >= 3 ? "遠征結果を見る" : "次の報酬を選ぶ", state.stage >= 3 ? "complete" : "rewards", false, "button primary")}`);
}

function renderReward() {
  const options = Object.entries(DOCTRINES).filter(([id]) => !state.packages.includes(id));
  const cards = options.map(([id, pack]) => `<button class="choice reward" data-action="take-reward" data-package="${id}"><span class="reward-label">報酬候補</span><span class="choice-title">${esc(pack.name)}</span><span class="choice-short">${esc(pack.short)}</span><span class="choice-detail">${esc(pack.detail)}</span></button>`).join("");
  return shell("次の方針を拾う", "報酬は、いまの構成の意味を変える", `<section class="card"><p class="lead">次の区画へ進む前に、ひとつだけ方針を加えます。</p><div class="choices">${cards || "<p>すべての方針を試しました。</p>"}</div></section>`);
}

function renderComplete() {
  const feedback = state.feedback || {};
  const option = (value, label, selected) => `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
  return shell("遠征を終えた", "この小さな版で、UIの方向を確認してください", `<section class="card verdict win"><div class="verdict-mark">✦</div><h2>三つの区画を見届けた</h2><p>次は、どの情報を残し、どの判断を増やすかを決めます。</p><div class="build-trail">${state.packages.map((id, index) => `<span><i>${index + 1}</i>${esc(packageLabel(id))}</span>`).join("")}</div></section><section class="card feedback"><p class="eyebrow">UI CHECK</p><h2>画面についてのメモ</h2><label>もう一度遊びたい度<select id="feedback-replay">${option("", "選択してください", !feedback.replay)}${option("1", "1 — もう遊ばない", feedback.replay === "1")}${option("2", "2", feedback.replay === "2")}${option("3", "3", feedback.replay === "3")}${option("4", "4", feedback.replay === "4")}${option("5", "5 — もう一度遊びたい", feedback.replay === "5")}</select></label><label>感情マーカー<select id="feedback-marker">${option("", "選択なし", !feedback.marker)}${option("hit", "きた！", feedback.marker === "hit")}${option("insight", "ひらめいた", feedback.marker === "insight")}${option("choice", "迷う", feedback.marker === "choice")}${option("payoff", "うまくいった", feedback.marker === "payoff")}${option("friction", "つらい", feedback.marker === "friction")}${option("unclear", "わからない", feedback.marker === "unclear")}</select></label><label>一番分かりやすかったところ<textarea id="feedback-clear" placeholder="例：戦闘前に方針の違いが見えた">${esc(feedback.clear || "")}</textarea></label><label>一番分かりにくかったところ<textarea id="feedback-confusing" placeholder="例：反応がなぜ発火したか">${esc(feedback.confusing || "")}</textarea></label>${button("保存して送信", "save-feedback", false, "button primary")}<p id="feedback-status" class="hint">run: ${esc(state.runId)} · seed: ${SEED}</p></section>`);
}

function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "reset") { state = freshState(); saveState(); render(); return; }
  if (action === "start") { state = { ...freshState(), phase: "build", stage: 1, startedAt: new Date().toISOString() }; saveState(); render(); return; }
  if (action === "choose-package") {
    const id = event.currentTarget.dataset.package;
    state.packages = state.packages.includes(id) ? state.packages.filter((entry) => entry !== id) : [...state.packages, id];
    state.error = null; saveState(); render(); return;
  }
  if (action === "fight") { state.phase = "battle"; saveState(); render(); return; }
  if (action === "simulate") {
    try { state.lastResult = simulateBattle(makeBattle(state.stage, state.packages), PLAYABLE_CONTENT); state.phase = "result"; state.error = null; } catch (error) { state.error = error.message; }
    saveState(); render(); return;
  }
  if (action === "rewards") { state.phase = "reward"; saveState(); render(); return; }
  if (action === "take-reward") {
    const id = event.currentTarget.dataset.package;
    state.packages = [...state.packages, id]; state.stage += 1; state.phase = "build"; saveState(); render(); return;
  }
  if (action === "complete") { state.phase = "complete"; saveState(); render(); return; }
  if (action === "save-feedback") {
    const clear = document.querySelector("#feedback-clear")?.value || "";
    const confusing = document.querySelector("#feedback-confusing")?.value || "";
    const replay = document.querySelector("#feedback-replay")?.value || "";
    const marker = document.querySelector("#feedback-marker")?.value || "";
    const endedAt = new Date().toISOString();
    state.feedback = { clear, confusing, replay, marker, savedAt: endedAt };
    saveState();
    localStorage.setItem(`${SAVE_KEY}-feedback`, JSON.stringify(state.feedback));
    const payload = {
      runId: state.runId,
      telemetryRunId: state.runId,
      deviceId: deviceIdForRun(),
      schemaVersion: 4,
      gameVersion: VERSION,
      startedAt: state.startedAt || endedAt,
      endedAt,
      outcome: { won: Boolean(state.lastResult?.result === "win"), reached: state.stage, hp: 0 },
      build: state.packages,
      stats: { seed: SEED, stageCount: state.stage, ruleset: PLAYABLE_CONTENT.contentVersion },
      answers: { replay, clear, confusing, marker },
      client: { language: navigator.language, viewport: `${innerWidth}x${innerHeight}`, head: "ecology" },
      events: state.lastResult?.events || [],
      moments: marker ? [{ seq: 0, at: endedAt, elapsedMs: 0, kind: marker, label: marker, phase: "complete", note: clear }] : [],
    };
    const submitButton = event.currentTarget;
    submitButton.disabled = true;
    submitButton.textContent = "保存中…";
    sendPayload(payload).then((result) => {
      submitButton.disabled = false;
      submitButton.textContent = result.ok ? "D1に保存しました" : "端末に保存しました（D1未送信）";
      const hint = document.querySelector("#feedback-status");
      if (hint) hint.textContent = result.ok ? `保存済み · run ${state.runId.slice(0, 8)}` : `送信待ち · ${result.error}`;
    }).catch(() => {
      submitButton.disabled = false;
      submitButton.textContent = "端末に保存しました（D1未送信）";
    });
    return;
  }
}

render();
