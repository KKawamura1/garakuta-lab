import {
  ACTIONS,
  ENEMIES,
  MUTATIONS,
  VERSION,
  MAX_ENERGY,
  RESTORE_AFTER_BATTLE,
  createGame,
  actionInfo,
  currentIntent,
  playAction,
  chooseMutation,
  deserialize,
  serialize,
  summary,
  describeMutation
} from "./engine.mjs";

const SAVE_KEY = "garakuta-graft-session";
const RESULT_KEY = "garakuta-graft-results";
const app = document.querySelector("#app");
const url = new URL(location.href);
const requestedSeed = url.searchParams.get("seed");

let state = loadState() || createGame(requestedSeed === null ? null : Number(requestedSeed));
let selectedMutation = null;
let markerOpen = false;
let surveySaved = false;

const MARKERS = [
  ["spark", "閃き"],
  ["hesitate", "迷い"],
  ["surge", "勢い"],
  ["worry", "不安"],
  ["bored", "退屈"]
];

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "on") node.addEventListener(value[0], value[1]);
    else if (key === "disabled") node.disabled = Boolean(value);
    else if (key === "checked") node.checked = Boolean(value);
    else node.setAttribute(key, value);
  }
  for (const child of (Array.isArray(children) ? children : [children])) {
    if (child) node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function loadState() {
  try {
    const saved = deserialize(localStorage.getItem(SAVE_KEY));
    if (!saved) return null;
    if (requestedSeed !== null && Number(saved.seed) !== Number(requestedSeed)) return null;
    saved.moments ||= [];
    saved.survey ||= null;
    return saved;
  } catch (_) {
    return null;
  }
}

function saveState() {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch (_) { /* 遊びは続ける */ }
}

function formatMutation(id) {
  const m = describeMutation(id);
  return m ? `${m.icon}${m.name}` : "未接続";
}

function formatEffect(info) {
  return info.effectText || "効果なし";
}

function mutationChip(mutation) {
  if (!mutation) return h("span", { class: "mutation-chip empty", text: "素の動作" });
  return h("span", { class: `mutation-chip mutation-${mutation.id}`, text: `${mutation.icon} ${mutation.name}` });
}

function bar(value, max, kind = "hp") {
  const outer = h("div", { class: `meter ${kind}` });
  const inner = h("i");
  inner.style.width = `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
  outer.append(inner);
  return outer;
}

function card(title, children, extraClass = "") {
  return h("section", { class: `panel ${extraClass}` }, [h("h2", { text: title }), ...children]);
}

function statusHeader() {
  const enemy = state.enemy;
  const header = h("header", { class: "topbar" });
  const left = h("div", { class: "brand" }, [
    h("strong", { text: "接ぎ木機関" }),
    h("span", { class: "version", text: VERSION })
  ]);
  const right = h("div", { class: "top-actions" }, [
    h("span", { class: "seed", text: `seed ${state.seed}` }),
    h("button", { class: "tiny-button", type: "button", text: "新しいラン", on: ["click", newRun] })
  ]);
  header.append(h("div", { class: "topline" }, [left, right]));

  const status = h("div", { class: "status-grid" });
  const hp = h("div", { class: "status-cell" }, [
    h("span", { class: "status-label", text: "機体" }),
    h("strong", { text: `${state.hp}/${state.maxHp}` }),
    bar(state.hp, state.maxHp, "hp")
  ]);
  const energy = h("div", { class: "status-cell" }, [
    h("span", { class: "status-label", text: "エネルギー" }),
    h("strong", { text: `${state.energy}/${MAX_ENERGY}` }),
    bar(state.energy, MAX_ENERGY, "energy")
  ]);
  const wave = h("div", { class: "status-cell" }, [
    h("span", { class: "status-label", text: state.done ? "結果" : "進行" }),
    h("strong", { text: state.done ? "終了" : `${state.battleIndex + 1}/${ENEMIES.length}戦` }),
    h("span", { class: "status-sub", text: state.done ? "" : `第${state.turn}巡` })
  ]);
  status.append(hp, energy, wave);
  header.append(status);
  if (!state.done && state.phase === "battle") {
    header.append(h("div", { class: "intent", text: `敵の次の攻撃　${currentIntent(state)}` }));
  }
  return header;
}

function enemyPanel() {
  const enemy = state.enemy;
  return card(`${enemy.icon} ${enemy.name}`, [
    h("div", { class: "enemy-row" }, [
      h("strong", { text: `HP ${enemy.hp}/${enemy.maxHp}` }),
      h("span", { class: "enemy-note", text: `攻撃列 ${enemy.attackIndex}巡目` })
    ]),
    bar(enemy.hp, enemy.maxHp, "enemy"),
    h("p", { class: "trait", text: enemy.trait }),
    h("div", { class: "known-attacks", text: knownAttacks() })
  ], "enemy-panel");
}

function knownAttacks() {
  const seen = state.log
    .filter(x => x.kind === "enemy")
    .map(x => (x.text.match(/敵の攻撃(\d+)/) || [])[1])
    .filter(Boolean);
  return seen.length ? `見た攻撃：${seen.join(" → ")}` : "まだ攻撃列は分からない";
}

function actionPanel() {
  const buttons = ACTIONS.map(action => {
    const info = actionInfo(state, action.id);
    const button = h("button", {
      class: `action-button action-${action.id}${info.mutation ? " grafted" : ""}`,
      type: "button",
      disabled: !info.legal,
      on: ["click", () => doAction(action.id)]
    }, [
      h("div", { class: "action-head" }, [
        h("span", { class: "action-icon", text: action.icon }),
        h("strong", { text: action.name }),
        mutationChip(info.mutation)
      ]),
      h("div", { class: "action-effect", text: formatEffect(info) }),
      h("div", { class: "action-desc", text: info.mutation ? `${info.mutation.description} ${action.description}` : action.description }),
      h("div", { class: `action-reason${info.legal ? "" : " disabled"}`, text: info.legal ? "選ぶ" : info.reason })
    ]);
    return button;
  });
  return card("次の一手", [
    h("p", { class: "hint", text: "攻撃を受けるか、力を蓄えるか、いま大きく動くか。全部はできない。" }),
    h("div", { class: "action-grid" }, buttons)
  ], "action-panel");
}

function logPanel(limit = 8) {
  const lines = state.log.slice(-limit).map(entry => h("div", { class: `log-line ${entry.kind}`, text: entry.text }));
  return card("機関ログ", lines.length ? lines : [h("div", { class: "muted", text: "まだ記録はない" })], "log-panel");
}

function markerPanel() {
  const wrapper = h("section", { class: "marker-wrap" });
  const toggle = h("button", { class: "marker-toggle", type: "button", text: markerOpen ? "気持ちを閉じる" : "いまの気持ちを記録", on: ["click", () => { markerOpen = !markerOpen; render(); }] });
  wrapper.append(toggle);
  if (!markerOpen) return wrapper;
  const note = h("input", { class: "note-input", type: "text", maxlength: "120", placeholder: "ひとこと（任意）" });
  const choices = h("div", { class: "marker-choices" });
  MARKERS.forEach(([id, label]) => choices.append(h("button", {
    class: `marker marker-${id}`, type: "button", text: label,
    on: ["click", () => {
      state.moments ||= [];
      state.moments.push({ turn: state.turn, battle: state.battleIndex + 1, kind: id, note: note.value.trim() });
      saveState();
      markerOpen = false;
      render();
    }]
  })));
  wrapper.append(h("div", { class: "marker-panel" }, [choices, note]));
  return wrapper;
}

function battleView() {
  return [enemyPanel(), actionPanel(), logPanel(), markerPanel()];
}

function nextEnemyPanel() {
  const enemy = state.nextEnemy;
  if (!enemy) return null;
  return h("div", { class: "next-enemy" }, [
    h("strong", { text: `次は ${enemy.icon} ${enemy.name}　HP ${enemy.hp}` }),
    h("span", { text: `初手の攻撃 ${enemy.attacks[0]}　・　${enemy.trait}` })
  ]);
}

function mutationChoicePanel() {
  const selected = selectedMutation ? describeMutation(selectedMutation) : null;
  const availableTargets = ACTIONS.filter(action => !state.actions[action.id].mutation);
  const offerButtons = state.offer.map(id => {
    const m = describeMutation(id);
    return h("button", {
      class: `mutation-option${selectedMutation === id ? " selected" : ""}`,
      type: "button",
      on: ["click", () => { selectedMutation = id; render(); }]
    }, [
      h("div", { class: "option-head" }, [h("span", { text: `${m.icon} ${m.name}` }), h("span", { class: "option-short", text: m.short })]),
      h("div", { class: "option-desc", text: m.description })
    ]);
  });
  const targets = selected ? availableTargets.map(action => h("button", {
    class: "target-option", type: "button",
    on: ["click", () => graft(selectedMutation, action.id)]
  }, [
    h("span", { class: "target-icon", text: action.icon }),
    h("span", { class: "target-copy" }, [
      h("strong", { text: `${action.name}へ接ぎ木` }),
      h("span", { text: action.description })
    ]),
    h("span", { class: "target-arrow", text: "→" })
  ])) : [];
  return card("新しい性質を接ぎ木する", [
    h("p", { class: "hint", text: "候補を1つ選び、まだ変異していない行動へ接続する。次の敵は見えている。" }),
    h("div", { class: "mutation-options" }, offerButtons),
    selected ? h("div", { class: "target-title", text: `${selected.icon} ${selected.name}を、どの行動の性質にする？` }) : null,
    selected ? h("div", { class: "target-options" }, targets) : h("div", { class: "muted", text: "まず性質を選ぶ" })
  ], "mutation-panel");
}

function rewardView() {
  return [
    h("div", { class: "reward-banner", text: `第${state.battleIndex + 1}戦を突破した。機体は次の敵に備えて${Math.min(state.maxHp, state.hp + RESTORE_AFTER_BATTLE) - state.hp}回復する。` }),
    nextEnemyPanel(),
    mutationChoicePanel(),
    logPanel(5),
    markerPanel()
  ].filter(Boolean);
}

function battleSummaryPanel() {
  const rows = state.history.map(battle => h("div", { class: `summary-row ${battle.won ? "won" : "lost"}` }, [
    h("strong", { text: `第${battle.battle}戦 ${battle.enemy}` }),
    h("span", { text: battle.won ? `${battle.turns}巡 ・ HP ${battle.hpBefore}→${battle.hpAfter}` : `停止 ・ HP ${battle.hpBefore}→${battle.hpAfter}` }),
    h("small", { text: battle.actions.filter(x => !x.startsWith("resolved:")).map(id => actionName(id)).join(" → ") })
  ]));
  return card("今回の機関", rows.length ? rows : [h("div", { class: "muted", text: "戦闘記録はない" })], "summary-panel");
}

function actionName(id) {
  return ACTIONS.find(x => x.id === id)?.name || id;
}

function graftSummary() {
  const rows = ACTIONS.map(action => h("div", { class: "graft-summary-row" }, [
    h("span", { text: `${action.icon} ${action.name}` }),
    h("strong", { text: formatMutation(state.actions[action.id].mutation) })
  ]));
  return card("接ぎ木の結果", rows);
}

function surveyPanel() {
  if (state.survey || surveySaved) {
    return card("記録", [h("p", { class: "hint", text: "このランの感想を保存した。" })]);
  }
  const fun = h("select", { class: "survey-control" }, [h("option", { value: "", text: "未選択" }), ...[1, 2, 3, 4, 5].map(v => h("option", { value: String(v), text: `${v}` }))]);
  const replay = h("select", { class: "survey-control" }, [h("option", { value: "", text: "未選択" }), ...[1, 2, 3, 4, 5].map(v => h("option", { value: String(v), text: `${v}` }))]);
  const best = h("input", { class: "survey-control", type: "text", maxlength: "200", placeholder: "一番良かった瞬間" });
  const friction = h("input", { class: "survey-control", type: "text", maxlength: "200", placeholder: "退屈・面倒だったところ" });
  const story = h("input", { class: "survey-control", type: "text", maxlength: "200", placeholder: "このランを一言で" });
  const warn = h("div", { class: "survey-warn" });
  const save = h("button", { class: "primary-button", type: "button", text: "感想を保存", on: ["click", () => {
    if (!fun.value || !replay.value) { warn.textContent = "面白さと、また遊びたい度を選んでください。"; return; }
    state.survey = { fun: Number(fun.value), replay: Number(replay.value), bestMoment: best.value.trim(), friction: friction.value.trim(), story: story.value.trim(), savedAt: new Date().toISOString() };
    surveySaved = true;
    try { localStorage.setItem(RESULT_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
    saveState();
    render();
  ]});
  return card("この試作について", [
    h("label", { class: "survey-label", text: "ゲーム自体は面白かった？（1〜5）" }), fun,
    h("label", { class: "survey-label", text: "また遊びたい？（1〜5）" }), replay,
    h("label", { class: "survey-label", text: "自由メモ" }), best, friction, story, warn, save
  ]);
}

function doneView() {
  const won = state.history.length === ENEMIES.length && state.history.every(x => x.won);
  return [
    h("div", { class: `result-banner ${won ? "success" : "failure"}` }, [
      h("strong", { text: won ? "機関は最後まで動いた" : "機関は停止した" }),
      h("span", { text: `${state.history.length}/${ENEMIES.length}戦 ・ 最終HP ${state.hp}` })
    ]),
    graftSummary(),
    battleSummaryPanel(),
    surveyPanel(),
    h("button", { class: "secondary-button", type: "button", text: "別のseedで再起動", on: newRun })
  ];
}

function doAction(actionId) {
  const result = playAction(state, actionId);
  if (!result.ok) return;
  state = result.state;
  saveState();
  render();
}

function graft(mutationId, actionId) {
  const result = chooseMutation(state, mutationId, actionId);
  if (!result.ok) return;
  state = result.state;
  selectedMutation = null;
  saveState();
  render();
}

function newRun() {
  const nextSeed = Math.floor(Math.random() * 90000) + 10000;
  state = createGame(nextSeed);
  state.moments = [];
  state.survey = null;
  selectedMutation = null;
  surveySaved = false;
  markerOpen = false;
  saveState();
  render();
}

function render() {
  app.replaceChildren(statusHeader());
  const main = h("main", { class: "main" });
  if (state.done || state.phase === "done") main.append(...doneView());
  else if (state.phase === "reward") main.append(...rewardView());
  else main.append(...battleView());
  app.append(main);
}

render();
