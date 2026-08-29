import { simulateBattle } from "./engine.mjs";
import { PLAYABLE_CONTENT, DISPLAY_NAMES } from "./playable-content.mjs";
import {
  CHARACTER_OPTIONS,
  COMPONENTS,
  RUN_SEED,
  componentInfo,
  componentLabel,
  componentOffer,
  encounterLabel,
  freshLoadout,
  installComponent,
  loadoutSummary,
  makeBattle,
  reorderTactic,
  stageRule,
} from "./playable-battles.mjs";
import { deviceIdForRun, sendPayload, uuid } from "../agent-view/sync.js";

const VERSION = "EXP-18 UI slice 0.2";
const SAVE_KEY = "exp18-playable-slice-v02";
const app = document.querySelector("#app");

const freshState = () => ({
  phase: "intro",
  stage: 0,
  runSeed: `${RUN_SEED}-${uuid().slice(0, 8)}`,
  roster: [],
  loadout: null,
  ownedComponents: [],
  offer: [],
  takenThisStage: 0,
  lastResult: null,
  results: [],
  runEvents: [],
  error: null,
  runId: uuid(),
  startedAt: null,
  feedback: null,
});

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || typeof saved !== "object") return freshState();
    const next = { ...freshState(), ...saved };
    next.roster = Array.isArray(next.roster) ? next.roster : [];
    next.ownedComponents = Array.isArray(next.ownedComponents) ? next.ownedComponents : [];
    next.offer = Array.isArray(next.offer) ? next.offer : [];
    next.results = Array.isArray(next.results) ? next.results : [];
    next.runEvents = Array.isArray(next.runEvents) ? next.runEvents : [];
    if (!next.runSeed) next.runSeed = RUN_SEED;
    if (!next.feedback) {
      const savedFeedback = JSON.parse(localStorage.getItem(`${SAVE_KEY}-feedback`) || "null");
      next.feedback = savedFeedback && typeof savedFeedback === "object" ? savedFeedback : null;
    }
    return next;
  } catch {
    return freshState();
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function button(label, action, disabled = false, className = "button", attributes = "") {
  return `<button type="button" class="${className}" data-action="${action}" ${attributes} ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
}

function shell(title, subtitle, body) {
  const error = state.error ? `<p class="error" role="alert">${esc(state.error)}</p>` : "";
  return `<div class="shell"><header class="header"><div><p class="kicker">${VERSION}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><button type="button" class="menu" data-action="reset" aria-label="最初から">↺</button></header>${body}${error}<footer>seed: ${esc(state.runSeed)} · build: ${VERSION}</footer></div>`;
}

function record(type, details = {}) {
  const entry = { seq: state.runEvents.length, at: new Date().toISOString(), type, ...details };
  state.runEvents = [...state.runEvents, entry];
}

function nameFor(id) {
  return DISPLAY_NAMES[id] ?? id ?? "誰か";
}

function characterName(id) {
  return nameFor(id).split(" — ")[0];
}

function positionLabel(position) {
  return {
    front_left: "前列左",
    front_right: "前列右",
    rear_left: "後列左",
    rear_right: "後列右",
  }[position] ?? position;
}

function kindLabel(kind) {
  return { active: "行動", reactive: "反応", equipment: "装備" }[kind] ?? kind;
}

const starterEffects = {
  bulwark: "自分にラウンド防壁3。",
  mend: "最も傷ついた味方を5回復。",
  strike: "最も弱った敵に4ダメージ。",
};

function effectFor(kind, id) {
  return COMPONENTS[id]?.effect ?? starterEffects[id] ?? nameFor(id);
}

function tacticRows(characterId, tactics) {
  return tactics.map((id, index) => `<div class="installed-row"><span class="order">${index + 1}</span><span class="installed-copy"><b>${esc(nameFor(id))}</b><small>${esc(effectFor("active", id))}</small></span><span class="reorder">${button("↑", "move-tactic", index === 0, "icon-button", `data-character="${characterId}" data-index="${index}" data-direction="-1"`)}${button("↓", "move-tactic", index === tactics.length - 1, "icon-button", `data-character="${characterId}" data-index="${index}" data-direction="1"`)}</span></div>`).join("");
}

function reactiveRows(reactives) {
  return reactives.map((id) => `<div class="installed-row"><span class="bullet">↳</span><span class="installed-copy"><b>${esc(nameFor(id))}</b><small>${esc(effectFor("reactive", id))}</small></span></div>`).join("");
}

function renderMember(member) {
  const info = CHARACTER_OPTIONS.find((option) => option.id === member.characterId);
  const summary = loadoutSummary(state.loadout, [member.characterId])[0];
  const equipment = summary.equipment
    ? `<div class="installed-row"><span class="bullet">◆</span><span class="installed-copy"><b>${esc(nameFor(summary.equipment))}</b><small>${esc(effectFor("equipment", summary.equipment))}</small></span></div>`
    : `<p class="empty-slot">装備なし</p>`;
  return `<article class="member-node"><div class="member-head"><span class="avatar">${esc(info?.icon ?? "・")}</span><div><b>${esc(characterName(member.characterId))}</b><small>${esc(info?.role ?? "")} · ${esc(positionLabel(info?.position))}</small></div></div><div class="slot-group"><div class="slot-heading"><span>行動・優先順</span><small>${summary.tactics.length} / 2</small></div>${tacticRows(member.characterId, summary.tactics)}</div><div class="slot-group"><div class="slot-heading"><span>リアクティブ</span><small>${summary.reactives.length} / 2</small></div>${reactiveRows(summary.reactives) || '<p class="empty-slot">反応なし</p>'}</div><div class="slot-group"><div class="slot-heading"><span>装備</span><small>${summary.equipment ? "1 / 1" : "0 / 1"}</small></div>${equipment}</div></article>`;
}

function assignButtons(componentId, action = "assign-component") {
  return state.roster.map((characterId) => {
    const preview = state.loadout ? installComponent(state.loadout, componentId, characterId) : { ok: false };
    const limitReached = action === "assign-component" && state.takenThisStage >= 3;
    const disabled = !preview.ok || limitReached;
    const label = disabled && !preview.ok ? `${characterName(characterId)}（枠なし）` : `${characterName(characterId)}へ`;
    const attrs = `data-component="${componentId}" data-character="${characterId}"`;
    return button(label, action, disabled, "tiny-button", attrs);
  }).join("");
}

function componentLine(componentId, action = "assign-component") {
  const component = componentInfo(componentId);
  if (!component) return "";
  const status = action === "assign-component" ? "拾う" : "報酬";
  return `<div class="component-line"><div class="component-copy"><div class="component-title"><span class="kind kind-${component.kind}">${kindLabel(component.kind)}</span><b>${esc(component.label)}</b><span class="component-status">${status}</span></div><p>${esc(component.effect)}</p><small>${esc(component.grammar)}</small></div><div class="component-actions">${assignButtons(componentId, action)}</div></div>`;
}

function render() {
  const views = { intro: renderIntro, roster: renderRoster, build: renderBuild, battle: renderBattle, result: renderResult, reward: renderReward, complete: renderComplete };
  app.innerHTML = (views[state.phase] ?? renderIntro)();
  app.querySelectorAll("[data-action]").forEach((element) => element.addEventListener("click", handleAction));
}

function renderIntro() {
  return shell("灰の遠征", "仲間と部材を組み替え、戦闘で答え合わせする", `<section class="hero card"><div class="sigil">◌</div><p class="lead">4人から3人を選び、<br>スキル・反応・装備を仲間の枠へ取り付けます。</p>${button("遠征を始める", "start", false, "button primary")}<p class="hint">戦闘中の操作はありません。組んだ仕組みが何を起こしたかを、短いログで確認します。</p></section><section class="three-up"><div class="card"><b>仲間を選ぶ</b><span>4人から3人</span></div><div class="card"><b>部材を組む</b><span>行動・反応・装備</span></div><div class="card"><b>答えを見る</b><span>3区画を自動戦闘</span></div></section>`);
}

function renderRoster() {
  const characters = CHARACTER_OPTIONS.map((option) => {
    const selected = state.roster.includes(option.id);
    const active = option.starterTactics.map(nameFor).join("、");
    const reactive = option.starterReactives.map(nameFor).join("、");
    return `<button type="button" class="character-option ${selected ? "selected" : ""}" data-action="toggle-character" data-character="${option.id}"><div class="character-top"><span class="avatar">${esc(option.icon)}</span><span><b>${esc(characterName(option.id))}</b><small>${esc(option.role)} · ${esc(positionLabel(option.position))}</small></span><span class="check">${selected ? "✓" : "＋"}</span></div><p>${esc(option.summary)}</p><small>初期行動: ${esc(active)} · 初期反応: ${esc(reactive)}</small></button>`;
  }).join("");
  const selectedNames = state.roster.map(characterName).join("、") || "まだ選ばれていません";
  return shell("出撃する3人", "4人の役割から、今回の3人を選ぶ", `<section class="card"><div class="section-head"><div><p class="eyebrow">ROSTER / 4 → 3</p><h2>誰を組み合わせる？</h2></div><span class="stage">${state.roster.length} / 3</span></div><p class="muted">仲間は初期行動と初期反応を1つずつ持ちます。あとから拾う部材で、別の仲間にも役割を移せます。</p><div class="character-grid">${characters}</div><p class="selection-note">選択中: <b>${esc(selectedNames)}</b></p>${button("この3人で構成を始める", "confirm-roster", state.roster.length !== 3, "button primary")}</section><section class="card rule-note"><p class="eyebrow">RULE</p><p>位置は仲間ごとに固定です。前衛は狙われやすく、後衛は位置替えや号令の影響を受けます。</p></section>`);
}

function renderBuild() {
  if (!state.loadout) return renderRoster();
  const offer = state.offer.length
    ? `<section class="card"><div class="section-head"><div><p class="eyebrow">MATERIALS / SEEDED OFFER</p><h2>拾える部材</h2></div><span class="stage">${state.stage === 1 ? `${state.takenThisStage} / 3` : "任意"}</span></div><p class="muted">部材をひとつ選び、取り付け先を決めます。同じ部材を複数の仲間には付けられません。</p><div class="component-list">${state.offer.map((id) => componentLine(id)).join("")}</div>${state.stage === 1 ? '<p class="hint">初期構成は2個以上、3個まで。迷った部材は見送ってかまいません。</p>' : ""}</section>`
    : `<section class="card quiet"><p class="eyebrow">MATERIALS</p><h2>今の部材で組み直した</h2><p class="muted">この区画で追加できる部材はありません。優先順を見直してから戦えます。</p></section>`;
  const memberNodes = state.roster.map((characterId) => renderMember({ characterId })).join("");
  const inventory = state.ownedComponents.length
    ? `<div class="inventory">${state.ownedComponents.map((id) => `<span class="inventory-chip"><span class="kind kind-${COMPONENTS[id]?.kind}">${kindLabel(COMPONENTS[id]?.kind)}</span>${esc(componentLabel(id))}</span>`).join("")}</div>`
    : '<p class="empty-slot">まだ追加部材はありません。</p>';
  const fightDisabled = state.stage === 1 && state.takenThisStage < 2;
  return shell(`第${state.stage}区画の構成`, `${encounterLabel(state.stage)} · ${stageRule(state.stage)}`, `<section class="card"><div class="section-head"><div><p class="eyebrow">ASSEMBLY</p><h2>仕組みを組む</h2></div><span class="stage">${state.stage} / 3</span></div><div class="member-grid">${memberNodes}</div><div class="inventory-wrap"><div class="slot-heading"><span>手元にある部材</span><small>${state.ownedComponents.length} 個</small></div>${inventory}</div></section>${offer}${button(state.stage === 1 ? "この構成で戦う" : "次の戦闘へ", "fight", fightDisabled, "button primary")}<p class="hint centered">行動は上から順に試します。↑↓で優先順を変えられます。</p>`);
}

function renderBattle() {
  const battle = makeBattle(state.stage, state.roster, state.loadout, state.runSeed);
  const allies = battle.allies.map((ally) => `<div class="battle-member"><div><b>${esc(characterName(ally.characterId))}</b><small>${esc(positionLabel(ally.position))}</small></div><span>${esc(ally.tactics.map((tactic) => nameFor(tactic.activeSkillId)).join(" → "))}</span></div>`).join("");
  const enemies = battle.enemies.map((enemy) => `<div class="enemy-row"><span class="enemy-mark">◆</span><b>${esc(nameFor(enemy.enemyActorId))}</b><span>${enemy.hp} HP</span></div>`).join("");
  const components = state.ownedComponents.map(componentLabel).join("、") || "初期構成のみ";
  return shell(`第${state.stage}区画`, "戦闘前の最終確認", `<section class="card battle-plan"><p class="eyebrow">AUTO BATTLE</p><h2>この仕組みを試す</h2><p class="muted">敵を倒すまで、R5の決定的な自動戦闘が進みます。seedは ${esc(state.runSeed)} です。</p><div class="plan-section"><h3>味方の優先順</h3>${allies}</div><div class="plan-section"><h3>部材</h3><p class="plan-components">${esc(components)}</p></div><div class="plan-section"><h3>相手</h3>${enemies}</div>${button("戦闘を再生する", "simulate", false, "button primary")}</section><p class="hint centered">戦闘後に、発動した行動・反応・装備を因果順で表示します。</p>`);
}

function actorName(id) {
  const actor = state.lastResult?.actors?.find((entry) => entry.instanceId === id);
  return String(actor?.displayName ?? nameFor(id)).split(" — ")[0];
}

function targetNames(ids) {
  return (ids || []).map((id) => actorName(id)).join("、");
}

function eventText(event) {
  const values = event.values || {};
  const source = actorName(event.sourceActorId || event.actorId || event.ownerActorId);
  const target = targetNames(event.targetActorIds || event.targetIds);
  const amount = values.amount ?? values.actual ?? values.proposed;
  const amountText = amount !== undefined ? ` · ${amount}` : "";
  const skillId = values.activeSkillId || values.skillId || event.activeSkillId || event.skillId;
  const skill = skillId ? nameFor(skillId) : "行動";
  const reactionId = values.reactiveSkillId || event.reactiveSkillId;
  const reaction = reactionId ? nameFor(reactionId) : "反応";
  const round = event.round ?? values.round ?? "-";
  const resourceLabel = (resource) => ({ action_points: "行動権", reaction_points: "RP" }[resource] ?? resource ?? "資源");
  const targetLabel = target && target === source ? "自分" : target || "相手";
  const cause = event.ruleId && event.sourceDefinitionId ? `（${nameFor(event.sourceDefinitionId)}）` : "";
  const map = {
    battle_started: "戦闘開始",
    round_started: `ラウンド${round}開始`,
    actor_activated: `${source}が動き出す`,
    action_declared: `${source}が${skill}を選んだ`,
    target_selected: `${source}が${targetLabel}を狙う`,
    target_changed: `狙いが${targetLabel}になった`,
    action_cost_paid: `${source}が${skill}のコストを払った`,
    action_started: `${source}の${skill}が始まる`,
    action_resolved: `${source}の${skill}が解決した`,
    action_skipped: `${source}は行動しなかった`,
    action_canceled: `${source}の行動が取り消された`,
    preparation_started: `${source}が準備を始める`,
    preparation_advanced: `${source}の準備が進む`,
    preparation_completed: `${source}の準備が完了`,
    preparation_interrupted: `${source}の準備が止まった`,
    damage_proposed: `${source}から攻撃の提案${amountText}`,
    barrier_damaged: `${target || source}の防壁が削れた${amountText}`,
    barrier_broken: `${target || source}の防壁が壊れた`,
    damage_taken: `${target || source}がダメージを受けた${amountText}`,
    excess_damage: "攻撃が余った",
    healing_proposed: `${source}から回復の提案${amountText}`,
    healing_applied: `${target || source}が回復した${amountText}`,
    excess_healing: "回復が余った",
    barrier_proposed: `${target || source}に防壁の提案${amountText}`,
    barrier_gained: `${target || source}に防壁が生まれた${amountText}`,
    barrier_expired: `${target || source}の防壁が消えた`,
    resource_refreshed: `${source}の${resourceLabel(values.resource)}が戻った`,
    resource_spent: `${source}が${resourceLabel(values.resource)}を使った${amountText}`,
    resource_gained: `${target || source}が${resourceLabel(values.resource)}を得た${amountText}`,
    resource_unused: `${source}の${resourceLabel(values.resource)}が余った${amountText}`,
    actor_moved: `${source}が位置を替えた`,
    status_added: `${target || source}に状態が加わった`,
    status_removed: `${target || source}の状態が外れた`,
    equipment_worn: `${source}の装備が摩耗した${amountText}`,
    equipment_broken: `${source}の装備が壊れた`,
    equipment_repaired: `${source}の装備が修理された${amountText}`,
    actor_defeated: `${source}が倒れた`,
    battle_ended: `戦闘終了 · ${values.result || "決着"}`,
  };
  if (event.type === "reaction_fired" || event.type === "rule_triggered") return `${source}の${reaction}が発火${cause}`;
  return `${map[event.type] || `${event.type}${amountText}`}${cause}`;
}

const readableEvents = new Set([
  "action_declared", "target_changed", "action_started", "action_skipped", "preparation_started",
  "preparation_advanced", "preparation_completed", "damage_taken", "healing_applied", "excess_damage",
  "excess_healing", "barrier_gained", "resource_gained", "resource_spent", "actor_moved", "status_added",
  "equipment_worn", "equipment_broken", "equipment_repaired", "actor_defeated", "reaction_fired", "rule_triggered",
  "battle_ended",
]);

function renderResult() {
  const result = state.lastResult;
  if (!result) return renderBuild();
  const won = result.result === "win";
  const metrics = result.metrics || {};
  const events = (result.events || []).filter((event) => readableEvents.has(event.type));
  const eventRows = events.length ? events : (result.events || []).slice(-20);
  const displayEvents = eventRows.length > 40 ? [...eventRows.slice(0, 34), ...eventRows.slice(-6)] : eventRows;
  const eventHtml = displayEvents.map((event) => `<li class="event"><span class="event-round">R${event.round ?? "-"}</span><span>${esc(eventText(event))}</span></li>`).join("");
  const eventCount = displayEvents.length === eventRows.length ? `${eventRows.length}` : `${displayEvents.length} / ${eventRows.length}`;
  const nextAction = won ? (state.stage >= 3 ? button("遠征結果を見る", "complete", false, "button primary") : button("次の部材を見る", "rewards", false, "button primary")) : button("構成に戻る", "back-build", false, "button primary");
  return shell(won ? "突破した" : "足を止めた", `${encounterLabel(state.stage)} · ${result.roundsUsed}ラウンド`, `<section class="card verdict ${won ? "win" : "loss"}"><div class="verdict-mark">${won ? "✓" : "×"}</div><h2>${won ? "この組み合わせは通った" : "この組み合わせでは届かなかった"}</h2><p>${won ? "部材の因果を確認し、次の報酬でさらに改造できます。" : "優先順か、部材を付ける相手を見直せます。"}</p><div class="metrics"><span><b>${metrics.allyHpLost ?? 0}</b><small>味方HP損失</small></span><span><b>${metrics.equipmentWear ?? 0}</b><small>装備摩耗</small></span><span><b>${metrics.reactionsFired ?? 0}</b><small>反応発火</small></span></div></section><section class="card"><div class="section-head"><div><p class="eyebrow">CAUSE & EFFECT</p><h2>何が起きたか</h2></div><span class="count">${eventCount} events</span></div><ol class="events">${eventHtml}</ol><details><summary>全イベントを見る</summary><pre>${esc((result.events || []).map(eventText).join("\n"))}</pre></details></section>${nextAction}`);
}

function renderReward() {
  const options = state.offer.map((id) => componentLine(id, "take-reward")).join("");
  return shell("部材をひとつ拾う", `${encounterLabel(state.stage)}を突破 · 次は第${state.stage + 1}区画`, `<section class="card"><p class="eyebrow">REWARD / 3 → 1</p><h2>次の組み合わせに何を足す？</h2><p class="muted">候補は3つ。選んだ部材は、取り付け先まで決めると次の区画へ進みます。</p><div class="component-list">${options}</div>${button("今回は見送る", "skip-reward", false, "button")}</section>`);
}

function renderComplete() {
  const feedback = state.feedback || {};
  const option = (value, label, selected) => `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
  const trail = state.roster.map(characterName).join("、");
  const materials = state.ownedComponents.map(componentLabel).join("、") || "初期構成のみ";
  return shell("遠征を終えた", "この版では、組合せUIと因果表示を評価してください", `<section class="card verdict win"><div class="verdict-mark">✦</div><h2>三つの区画を見届けた</h2><p>今回の仲間: ${esc(trail)}<br>手にした部材: ${esc(materials)}</p><div class="build-trail"><span><i>1</i>仲間を4人から3人に絞った</span><span><i>2</i>部材を枠へ取り付けた</span><span><i>3</i>自動戦闘で因果を確認した</span></div></section><section class="card feedback"><p class="eyebrow">UI CHECK</p><h2>画面についてのメモ</h2><label>もう一度遊びたい度<select id="feedback-replay">${option("", "選択してください", !feedback.replay)}${option("1", "1 — もう遊ばない", feedback.replay === "1")}${option("2", "2", feedback.replay === "2")}${option("3", "3", feedback.replay === "3")}${option("4", "4", feedback.replay === "4")}${option("5", "5 — もう一度遊びたい", feedback.replay === "5")}</select></label><label>感情マーカー<select id="feedback-marker">${option("", "選択なし", !feedback.marker)}${option("hit", "きた！", feedback.marker === "hit")}${option("insight", "ひらめいた", feedback.marker === "insight")}${option("choice", "迷う", feedback.marker === "choice")}${option("payoff", "うまくいった", feedback.marker === "payoff")}${option("friction", "つらい", feedback.marker === "friction")}${option("unclear", "わからない", feedback.marker === "unclear")}</select></label><label>一番分かりやすかったところ<textarea id="feedback-clear" placeholder="例：部材を仲間へ付ける画面">${esc(feedback.clear || "")}</textarea></label><label>一番分かりにくかったところ<textarea id="feedback-confusing" placeholder="例：反応がなぜ発火したか">${esc(feedback.confusing || "")}</textarea></label>${button("保存して送信", "save-feedback", false, "button primary")}<p id="feedback-status" class="hint">run: ${esc(state.runId)} · seed: ${esc(state.runSeed)}</p></section>`);
}

function handleAction(event) {
  const element = event.currentTarget;
  const action = element.dataset.action;
  if (action === "reset") {
    state = freshState();
    saveState();
    render();
    return;
  }
  if (action === "start") {
    state = freshState();
    state.phase = "roster";
    state.startedAt = new Date().toISOString();
    record("run_started", { seed: state.runSeed, version: VERSION });
    saveState();
    render();
    return;
  }
  if (action === "toggle-character") {
    const id = element.dataset.character;
    if (state.roster.includes(id)) state.roster = state.roster.filter((entry) => entry !== id);
    else if (state.roster.length < 3) state.roster = [...state.roster, id];
    state.error = null;
    saveState();
    render();
    return;
  }
  if (action === "confirm-roster") {
    if (state.roster.length !== 3) return;
    state.loadout = freshLoadout(state.roster);
    state.stage = 1;
    state.offer = componentOffer(state.runSeed, 1, [], 5);
    state.takenThisStage = 0;
    state.phase = "build";
    state.error = null;
    record("roster_selected", { roster: [...state.roster], offer: [...state.offer] });
    saveState();
    render();
    return;
  }
  if (action === "assign-component") {
    if (state.takenThisStage >= 3) {
      state.error = "初期構成は3個までです。";
      render();
      return;
    }
    const componentId = element.dataset.component;
    const characterId = element.dataset.character;
    const result = installComponent(state.loadout, componentId, characterId);
    if (!result.ok) {
      state.error = result.reason;
      render();
      return;
    }
    state.loadout = result.loadout;
    state.ownedComponents = [...state.ownedComponents, componentId];
    state.offer = state.offer.filter((id) => id !== componentId);
    state.takenThisStage += 1;
    state.error = null;
    record("component_assigned", { componentId, characterId, stage: state.stage, source: "offer" });
    saveState();
    render();
    return;
  }
  if (action === "move-tactic") {
    state.loadout = reorderTactic(state.loadout, element.dataset.character, Number(element.dataset.index), Number(element.dataset.direction));
    state.error = null;
    record("tactic_reordered", { characterId: element.dataset.character, index: Number(element.dataset.index), direction: Number(element.dataset.direction), stage: state.stage });
    saveState();
    render();
    return;
  }
  if (action === "fight") {
    if (state.stage === 1 && state.takenThisStage < 2) {
      state.error = "初期部材を2個以上取り付けてください。";
      render();
      return;
    }
    state.phase = "battle";
    state.error = null;
    record("loadout_confirmed", { stage: state.stage, roster: [...state.roster], loadout: loadoutSummary(state.loadout, state.roster) });
    saveState();
    render();
    return;
  }
  if (action === "simulate") {
    try {
      const battle = makeBattle(state.stage, state.roster, state.loadout, state.runSeed);
      record("battle_started", { stage: state.stage, battleId: battle.battleId });
      const result = simulateBattle(battle, PLAYABLE_CONTENT);
      state.lastResult = result;
      state.results = [...state.results, { stage: state.stage, result: result.result, roundsUsed: result.roundsUsed, metrics: result.metrics }];
      for (const combatEvent of result.events || []) {
        state.runEvents.push({ seq: state.runEvents.length, at: new Date().toISOString(), type: "combat_event", stage: state.stage, event: combatEvent });
      }
      record("battle_completed", { stage: state.stage, result: result.result, reason: result.reason, roundsUsed: result.roundsUsed });
      state.phase = "result";
      state.error = null;
    } catch (error) {
      state.error = error.message;
    }
    saveState();
    render();
    return;
  }
  if (action === "back-build") {
    state.phase = "build";
    state.error = null;
    saveState();
    render();
    return;
  }
  if (action === "rewards") {
    state.offer = componentOffer(state.runSeed, state.stage + 1, state.ownedComponents, 3);
    state.phase = "reward";
    state.error = null;
    record("reward_presented", { stage: state.stage + 1, offer: [...state.offer] });
    saveState();
    render();
    return;
  }
  if (action === "take-reward") {
    const componentId = element.dataset.component;
    const characterId = element.dataset.character;
    const result = installComponent(state.loadout, componentId, characterId);
    if (!result.ok) {
      state.error = result.reason;
      render();
      return;
    }
    state.loadout = result.loadout;
    state.ownedComponents = [...state.ownedComponents, componentId];
    record("reward_taken", { stage: state.stage, componentId, characterId });
    state.stage += 1;
    state.offer = [];
    state.takenThisStage = 0;
    state.phase = "build";
    state.error = null;
    saveState();
    render();
    return;
  }
  if (action === "skip-reward") {
    record("reward_skipped", { stage: state.stage, offer: [...state.offer] });
    state.stage += 1;
    state.offer = [];
    state.takenThisStage = 0;
    state.phase = "build";
    state.error = null;
    saveState();
    render();
    return;
  }
  if (action === "complete") {
    record("run_completed", { stage: state.stage, result: state.lastResult?.result || "win" });
    state.phase = "complete";
    saveState();
    render();
    return;
  }
  if (action === "save-feedback") {
    const clear = document.querySelector("#feedback-clear")?.value || "";
    const confusing = document.querySelector("#feedback-confusing")?.value || "";
    const replay = document.querySelector("#feedback-replay")?.value || "";
    const marker = document.querySelector("#feedback-marker")?.value || "";
    const endedAt = new Date().toISOString();
    state.feedback = { clear, confusing, replay, marker, savedAt: endedAt };
    record("feedback_submitted", { replay, marker });
    saveState();
    localStorage.setItem(`${SAVE_KEY}-feedback`, JSON.stringify(state.feedback));
    const events = state.runEvents.length <= 2000 ? state.runEvents : [state.runEvents[0], ...state.runEvents.slice(-1999)];
    const finalResult = state.results.findLast?.((entry) => entry.stage === 3) || state.results[state.results.length - 1];
    const finalWon = state.results.some((entry) => entry.stage === 3 && entry.result === "win");
    const payload = {
      runId: state.runId,
      telemetryRunId: state.runId,
      deviceId: deviceIdForRun(),
      schemaVersion: 4,
      gameVersion: VERSION,
      startedAt: state.startedAt || endedAt,
      endedAt,
      outcome: { won: finalWon, reached: state.stage, hp: finalResult?.metrics?.allyHpLost === undefined ? 0 : Math.max(0, 100 - finalResult.metrics.allyHpLost) },
      build: { roster: state.roster, loadout: state.loadout, ownedComponents: state.ownedComponents },
      stats: { seed: state.runSeed, stageCount: state.stage, ruleset: PLAYABLE_CONTENT.contentVersion, results: state.results },
      answers: { replay, clear, confusing, marker },
      client: { language: navigator.language, viewport: `${innerWidth}x${innerHeight}`, head: "ecology" },
      events,
      moments: marker ? [{ seq: state.runEvents.length - 1, at: endedAt, elapsedMs: 0, kind: marker, label: marker, phase: "complete", note: clear }] : [],
    };
    const submitButton = element;
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
  }
}

render();
