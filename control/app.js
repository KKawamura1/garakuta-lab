import {
  MAX_HP, MAX_TURNS, PARTS, INITIAL_PARTS, generateEnemies, offerFor, simulateBattle
} from "../core/control.mjs";
import { uuid, deviceIdForRun, sendPayload } from "../agent-view/sync.js";

const KEY = "garakuta-control";
const seedFromUrl = Number(new URLSearchParams(location.search).get("seed") || 7);
const names = Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, v.name]));
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function fresh() {
  return { runId: uuid(), seed: seedFromUrl, startedAt: new Date().toISOString(), battle: 1,
    hp: MAX_HP, loadout: [...INITIAL_PARTS], actions: [], phase: "battle", events: [], moments: [] };
}
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (_) { state = fresh(); }
const enemies = generateEnemies(state.seed);
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const enemy = () => enemies[state.battle - 1];
const result = () => simulateBattle({ parts: state.loadout, enemy: enemy(), actions: state.actions, hp: state.hp });
const available = type => {
  const r = simulateBattle({ parts: state.loadout, enemy: enemy(), actions: [...state.actions, type], hp: state.hp });
  return r.legal && !r.terminal;
};
function event(type, extra = {}) { state.events.push({ seq: state.events.length + 1, type, at: new Date().toISOString(), battle: state.battle, ...extra }); }

function render() {
  const screen = $("#screen");
  const e = enemy();
  const r = result();
  $("#status").textContent = `seed ${state.seed} / ${state.battle}戦目`;
  if (state.phase === "done") { renderDone(screen, r); return; }
  if (state.phase === "reward") { renderReward(screen); return; }
  const legal = state.loadout.filter(available);
  screen.innerHTML = `
    <div class="card"><div class="row"><strong>敵：<span class="enemy">${esc(e.name)}</span></strong><span>残りターン ${MAX_TURNS - state.actions.length}</span></div>
      <div class="row"><span>敵HP <b class="enemy">${r.enemyHp}</b> / ${e.hp}</span><span>次の攻撃 <b class="enemy">${e.atk}</b></span></div>
      <div class="row"><span>自HP <b class="player">${r.hp}</b> / ${state.hp}</span><span>エネルギー <b class="player">${r.energy}</b></span></div>
      <p class="muted">敵の次行動を見て、作動させる部品を1つ選ぶ。</p></div>
    <div class="card"><h2>装備</h2><div class="buttons">${state.loadout.map(type => `<button data-act="${type}" ${legal.includes(type) ? "" : "disabled"}>${esc(names[type])}</button>`).join("")}</div></div>
    <div class="card"><h2>今回のログ</h2><div class="log">${(r.log || []).map(x => `<div>巡${x.turn} ${esc(names[x.action] || x.action)}：${x.damage ? `${x.damage}ダメージ` : x.energy ? `エネルギー+${x.energy}` : x.shield ? `遮蔽${x.shield}` : "作動"} → HP ${x.hpAfter} / 敵HP ${x.enemyHpAfter}</div>`).join("") || "まだ行動していません"}</div></div>
    <div class="card"><div class="mark"><button data-mark="insight">ひらめいた</button><button data-mark="choice">迷う</button><button data-mark="friction">つらい</button><button data-mark="payoff">うまくいった</button></div></div>`;
  screen.querySelectorAll("[data-act]").forEach(button => button.onclick = () => act(button.dataset.act));
  screen.querySelectorAll("[data-mark]").forEach(button => button.onclick = () => mark(button.dataset.mark));
}

function act(type) {
  if (!available(type)) return;
  state.actions.push(type); event("part_used", { part: type }); save();
  const r = result();
  if (r.terminal) {
    event(r.won ? "battle_won" : "battle_lost", { hp: r.hp, enemyHp: r.enemyHp, turns: r.turns });
    if (r.won && state.battle < 3) { state.hp = r.hp; state.phase = "reward"; }
    else state.phase = "done";
    save();
  }
  render();
}

function renderReward(screen) {
  const offer = offerFor(state.seed, state.battle, state.loadout);
  screen.innerHTML = `<div class="card reward"><h2>第${state.battle}戦後の報酬</h2><p class="muted">1個を選び、装備中の1個と交換する。後から付け替えない。</p>${offer.map(type => `<button data-reward="${type}">${esc(names[type])}</button>`).join("")}</div>`;
  screen.querySelectorAll("[data-reward]").forEach(button => button.onclick = () => chooseReward(button.dataset.reward));
}
function chooseReward(reward) {
  const offer = offerFor(state.seed, state.battle, state.loadout);
  if (!offer.includes(reward)) return;
  const old = prompt(`${names[reward]}を入れる代わりに外す部品名を入力：${state.loadout.map(x => names[x]).join(" / ")}`);
  const index = state.loadout.findIndex(type => names[type] === old);
  if (index < 0) return;
  const replaced = state.loadout[index]; state.loadout[index] = reward;
  event("reward_chosen", { reward, replaced });
  state.battle += 1; state.actions = []; state.phase = "battle"; save(); render();
}
function mark(kind) { state.moments.push({ seq: state.moments.length + 1, kind, at: new Date().toISOString(), battle: state.battle }); event("emotion_marked", { kind }); save(); }

function renderDone(screen, r) {
  const won = state.events.filter(x => x.type === "battle_won").length === 3;
  screen.innerHTML = `<div class="card"><h2>${won ? "3戦完走" : "ラン終了"}</h2><p>${won ? "全戦勝利しました。" : "このランはここで終了です。"}</p><p class="muted">seed ${state.seed} / 最終HP ${r.hp}</p><button class="primary" id="surveyOpen">感想を書く</button></div>`;
  $("#surveyOpen").onclick = () => $("#survey").showModal();
}
$("#send").onclick = async () => {
  const fun = $("#fun").value, replay = $("#replay").value;
  if (!fun || !replay) { $("#surveyError").textContent = "面白さと再プレイ意向を選んでください"; return; }
  const r = result();
  const payload = { runId: state.runId, telemetryRunId: state.runId, deviceId: deviceIdForRun(), schemaVersion: 4,
    gameVersion: "control-0.1-play", startedAt: state.startedAt, endedAt: new Date().toISOString(),
    outcome: { won: state.events.filter(x => x.type === "battle_won").length === 3, reached: state.battle, hp: r.hp },
    build: state.loadout.map(type => names[type]), stats: { seed: state.seed, battles: state.events.filter(x => x.type === "battle_won").length },
    answers: { fun: Number(fun), replay: Number(replay), insight: $("#insight").value, bestMoment: $("#best").value, friction: $("#friction").value, runStory: $("#story").value },
    client: { language: navigator.language, viewport: `${innerWidth}x${innerHeight}` }, events: state.events, moments: state.moments };
  const sent = await sendPayload(payload); $("#surveyError").textContent = sent.ok ? "記録しました。" : `送信失敗：${sent.error}`;
};
render();
