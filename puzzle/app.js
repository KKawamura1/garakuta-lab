// 「破れ」— **噛み合わせを見つけることだけでできたゲーム。**
//
// 企画の全記録でいちばん強い感情は、勝敗でも等級でもなく気づきだった：
//   「そうか、一撃99の制限は2回攻撃なら198までいけるのか。知識アンロック！」
// それを勝敗の副産物ではなく、**遊びの本体**にする。
//
// **骨格を一つも引き継いでいない**（`analysis/RETROSPECTIVE.md`）。
// 8つのルールセットが共有していた 枠5・初期部品8・12巡・3択報酬・独立6戦・HP30 のうち、
// ここに残っているのは「5枠に部品を置く」だけで、
//   HPが無い／負けが無い／報酬が無い／戦闘が無い／敵は数値の制約でしかない。
// 遊ぶ側の動詞も違う：**勝つために並べる**のではなく、**目標を越えるために並べる。**
//
// 目標の置き方が全て（`analysis/gen-puzzles.mjs`）：
//   法則を**足し算で読んで**組んだ並びの実測値と、全列挙の最大値の**あいだ**に置いてある。
//   足し算で考えている限り届かない。噛み合わせに気づいた時だけ越える。

import { makeSimulate, LAWS, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { PUZZLES } from "../core/puzzle-table.mjs";
import { makeRng } from "../core/rng.mjs";
import { BUILD } from "../core/build.mjs";
import { uuid, sendPayload, deviceIdForRun } from "../agent-view/sync.js";

const KEY = "garakuta-puzzle";
const $ = s => document.querySelector(s);
const el = (tag, props = {}, kids = []) => {
  const node = Object.assign(document.createElement(tag), props);
  kids.filter(Boolean).forEach(k => node.append(k));
  return node;
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw.index === "number") return raw;
  } catch (_) {}
  return fresh();
}

function fresh() {
  return { runId: uuid(), index: 0, slots: [null, null, null, null, null],
    tries: {}, best: {}, cleared: {}, marks: [], startedAt: new Date().toISOString() };
}
let state = load();
let picked = null;                  // 手持ちの何番目を持っているか
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };

const puzzle = () => PUZZLES[Math.min(state.index, PUZZLES.length - 1)];

// いまの並びが、3巡で通す合計。**実機をそのまま回す。**近似しない。
function scoreOf(p, slots) {
  if (!slots.some(Boolean)) return { total: 0, perCycle: [0, 0, 0] };
  const sim = makeSimulate(p.laws);
  const enemy = { name: "試験体", hp: 1e9, atk: 0, atkPeriod: 99, cap: p.cap, floor: 0, cycleCap: 0, regen: 0 };
  const r = sim({
    slots: slots.map((t, i) => (t === null ? null : { id: `s${i}`, type: t })),
    hp: 999, maxHp: 999, enemy, rng: makeRng(1)
  });
  const perCycle = [0, 0, 0];
  let total = 0;
  (r.log || []).forEach(e => {
    if (e.cycle <= p.cycles && e.damage) { perCycle[e.cycle - 1] += e.damage; total += e.damage; }
  });
  return { total, perCycle };
}

function draw() {
  const p = puzzle();
  const { total, perCycle } = scoreOf(p, state.slots);
  const cleared = total >= p.target;
  if (cleared && !state.cleared[state.index]) { state.cleared[state.index] = true; save(); }
  if (total > (state.best[state.index] || 0)) { state.best[state.index] = total; save(); }

  $("#wave").textContent = `${state.index + 1}問目 / 全${PUZZLES.length}問`;

  const goal = $("#goal");
  goal.replaceChildren();
  goal.append(el("span", { className: `now${cleared ? " over" : ""}`, textContent: String(total) }));
  goal.append(el("span", { className: "sep", textContent: "/" }));
  goal.append(el("span", { className: "target", textContent: `目標 ${p.target}` }));
  const bar = el("div", { className: `bar${cleared ? " cleared" : ""}` });
  const fill = el("i");
  fill.style.width = `${Math.max(0, Math.min(100, (total / p.target) * 100))}%`;
  bar.append(fill);
  goal.append(bar);

  const screen = $("#screen");
  screen.replaceChildren();

  // 越えたときだけ出す札。**次へ進む口はここにしか無い。**
  if (cleared) {
    const win = el("div", { className: "card" });
    win.append(el("h2", { textContent: "越えた" }));
    win.append(el("div", { className: "cleared-note", textContent: `${total} ／ 目標 ${p.target}` }));
    win.append(el("div", { className: "small", style: "margin-top:6px",
      textContent: `足し算で読むと ${p.naive} までしか出ない組み合わせでした。試した回数 ${state.tries[state.index] || 0}。` }));
    if (state.index < PUZZLES.length - 1) {
      win.append(el("div", { className: "actions", style: "margin-top:10px" }, [
        el("button", {
          className: "btn primary wide", textContent: "次の問題へ",
          onclick: () => { state.index += 1; state.slots = [null, null, null, null, null]; picked = null; save(); draw(); }
        })
      ]));
    } else {
      win.append(el("div", { style: "margin-top:10px", textContent: "全問越えました。" }));
      win.append(el("div", { className: "actions", style: "margin-top:10px" }, [
        el("button", { className: "btn primary wide", textContent: "感想を書いて送る", onclick: () => openSurvey() })
      ]));
    }
    screen.append(win);
  }

  // 法則。**これが材料である。**説明を読まないと組めない。
  const lawCard = el("div", { className: "card" });
  lawCard.append(el("h2", { textContent: "この問題の法則（2つとも効いている）" }));
  p.laws.forEach(id => {
    lawCard.append(el("div", { className: "law" }, [
      el("span", { className: "law-name", textContent: LAWS[id].name }),
      el("span", { className: "law-desc", textContent: LAWS[id].desc })
    ]));
  });
  lawCard.append(el("div", { className: "small", style: "margin-top:6px",
    textContent: `相手は1発あたり ${p.cap} までしか通らない。${p.cycles}巡ぶんの合計で競う。` }));
  screen.append(lawCard);

  // 枠。押すと外す。手持ちを持っているなら置く。
  const rackCard = el("div", { className: "card" });
  rackCard.append(el("h2", { textContent: picked !== null ? "置きたい枠を押す" : "枠（押すと外す）" }));
  const rack = el("div", { className: "rack" });
  state.slots.forEach((type, i) => {
    rack.append(el("button", {
      type: "button",
      className: `${type === null ? "empty" : ""}`,
      onclick: () => {
        if (picked !== null) { state.slots[i] = state.pool ? state.pool[picked] : p.pool[picked]; picked = null; }
        else state.slots[i] = null;
        state.tries[state.index] = (state.tries[state.index] || 0) + 1;
        save(); draw();
      }
    }, [
      el("span", { className: "n", textContent: type === null ? `${i + 1}` : PARTS[type].name }),
      el("span", { className: "p", textContent: type === null ? "空き" : `周${PARTS[type].period ?? 1}` })
    ]));
  });
  rackCard.append(rack);

  // 巡回ごとの実測。**近づいているのが見えないと、回すだけになる。**
  const cyc = el("div", { className: "cyc" });
  const row = el("div", { className: "row" });
  row.append(el("div", { className: "lab", textContent: "巡ごと" }));
  perCycle.forEach(v => row.append(el("div", { className: `v${v ? " hot" : ""}`, textContent: v ? String(v) : "—" })));
  cyc.append(row);
  rackCard.append(cyc);
  screen.append(rackCard);

  // 手持ち。同じ部品を何度でも使える形ではなく、**8個から5枠を選ぶ。**
  const poolCard = el("div", { className: "card" });
  poolCard.append(el("h2", { textContent: `手持ち（${p.pool.length}個から5枠）` }));
  const pool = el("div", { className: "pool" });
  const usedCount = new Map();
  state.slots.forEach(t => { if (t) usedCount.set(t, (usedCount.get(t) || 0) + 1); });
  const seen = new Map();
  p.pool.forEach((type, i) => {
    const n = (seen.get(type) || 0) + 1;
    seen.set(type, n);
    const used = n <= (usedCount.get(type) || 0);
    pool.append(el("button", {
      type: "button",
      className: `${used ? "used" : ""}${picked === i ? " on" : ""}`,
      onclick: () => { picked = picked === i ? null : i; draw(); }
    }, [
      el("span", { textContent: PARTS[type].name }),
      el("span", { className: "p", textContent: `周${PARTS[type].period ?? 1}` })
    ]));
  });
  poolCard.append(pool);
  poolCard.append(el("div", { className: "small", style: "margin-top:6px",
    textContent: "部品を押してから枠を押すと置ける。枠を押すと外れる。" }));
  screen.append(poolCard);
}

$("#menuButton").addEventListener("click", () => {
  const done = Object.keys(state.cleared).length;
  $("#menuBody").replaceChildren(...[
    `越えた問題：${done} / ${PUZZLES.length}`,
    `試した回数の合計：${Object.values(state.tries).reduce((n, x) => n + x, 0)}`,
    `版：puzzle-0.1 ・ ${BUILD}`
  ].map(t => el("div", { textContent: t })));
  $("#menuDialog").showModal();
});
$("#closeMenu").addEventListener("click", () => $("#menuDialog").close());
$("#resetBtn").addEventListener("click", () => {
  if (!confirm("最初の問題からやり直しますか？")) return;
  state = { index: 0, slots: [null, null, null, null, null], tries: {}, best: {}, cleared: {}, startedAt: new Date().toISOString() };
  picked = null; save(); $("#menuDialog").close(); draw();
});
$("#copyBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(JSON.stringify(state, null, 1)); alert("コピーしました。"); }
  catch (_) { alert("コピーできませんでした。"); }
});

/* ---------- 遊び方・気持ち・感想 ---------- */

// **規則を読む場所が無かった。**作者：「遊び方を見る欄はないんですか？」
// 本編は `rules` を持っているが、ここは本編の骨格を一つも引き継いでいないので、
// 説明も別に要る。**引き継がなかったものの中に、要るものが混ざる。**
const HOW = `【破れ PUZZLE 0.1 遊び方】
- **勝ち負けはない。**HPも、報酬も、敵の攻撃も、戦闘もない。
- 手持ちの8個から**5枠**に部品を置き、${PUZZLES[0].cycles}巡ぶんの合計ダメージで**目標を越える**。
- 枠には位相がある。**周期Pの部品を枠iに置くと (巡回-1)%P === i%P の巡に作動する。**
  同じ部品でも、置く枠で作動する巡が変わる。
- 問題ごとに**法則が2つ**効いている。2つとも読まないと組めない。
- 相手は**1発あたりの上限**を持つ。大きい一撃はそこで頭を打つ。
- 部品を押してから枠を押すと置ける。枠を押すと外れる。
- 越えたら次の問題へ進める。**戻れる**ので、越えたあとに詰め直してもよい。

【この出題について】
目標は機械が置いている。**法則を足し算で読んで組んだ並びの実測値と、
全列挙の最大値のあいだ**に必ず入るように選んである。
つまり「2つの法則が噛み合う置き方」に気づくまで、目標は越えられない。
気づけば越えられることは、出題を作った時点で全問確かめてある。`;

const MARKS = [
  ["hit", "きた！"], ["insight", "ひらめいた"], ["choice", "迷う"],
  ["payoff", "うまくいった"], ["friction", "つらい"], ["unclear", "わからない"]
];

function openMark() {
  const box = $("#markChoices");
  box.replaceChildren();
  MARKS.forEach(([kind, label]) => {
    box.append(el("button", {
      className: "btn wide", textContent: label,
      onclick: () => {
        state.marks = [...(state.marks || []), {
          kind, label, note: $("#markNote").value.trim().slice(0, 160),
          puzzle: state.index + 1, at: new Date().toISOString(),
          tries: state.tries[state.index] || 0
        }];
        $("#markNote").value = "";
        save();
        $("#markDialog").close();
      }
    }));
  });
  $("#markDialog").showModal();
}

// 通報は本編と同じ列構成で入れる（`game_version` で分けられる）。
// **ここを繋いでいなかったので、遊んでもらっても記録は端末の中だけだった。**
function payload(survey) {
  const cleared = Object.keys(state.cleared).length;
  const tries = Object.values(state.tries).reduce((n, x) => n + x, 0);
  const events = PUZZLES.map((p, i) => ({
    seq: i + 1, type: state.cleared[i] ? "puzzle_cleared" : "puzzle_open",
    puzzle: i + 1, laws: p.laws, target: p.target, naive: p.naive,
    best: state.best[i] || 0, tries: state.tries[i] || 0
  }));
  return {
    runId: state.runId, telemetryRunId: state.runId, deviceId: deviceIdForRun(),
    schemaVersion: 4, gameVersion: "puzzle-0.1-play",
    startedAt: state.startedAt, endedAt: new Date().toISOString(),
    outcome: { won: cleared >= PUZZLES.length, reached: cleared, hp: 0 },
    build: state.slots.filter(Boolean).map(t => PARTS[t].name),
    stats: {
      puzzles: PUZZLES.length, cleared, tries,
      perPuzzle: PUZZLES.map((p, i) => ({
        puzzle: i + 1, laws: p.laws.join("+"), target: p.target, naive: p.naive,
        best: state.best[i] || 0, tries: state.tries[i] || 0, cleared: Boolean(state.cleared[i])
      })),
      build: BUILD
    },
    answers: survey || {},
    client: { language: navigator.language, viewport: `${innerWidth}x${innerHeight}` },
    events,
    moments: (state.marks || []).map((m, i) => ({
      seq: i + 1, at: m.at, elapsedMs: 0, kind: m.kind, label: m.label,
      phase: `${m.puzzle}問目`, note: m.note
    }))
  };
}

async function push(survey) {
  const result = await sendPayload(payload(survey));
  alert(result.ok ? "記録しました。ありがとうございます。"
    : `送信できませんでした（${result.error}）。「記録をコピー」で渡してください。`);
}

// **途中でやめたときこそ聞きたい。**全問越えないと出ない形にはしない。
function openSurvey() {
  const dialog = el("dialog", { className: "ask" });
  dialog.append(el("h2", { textContent: "感想（途中でも構いません）" }));
  const pick = (label, options) => {
    dialog.append(el("label", { className: "field", textContent: label }));
    const sel = el("select");
    sel.append(el("option", { value: "", textContent: "未選択" }));
    options.forEach(v => sel.append(el("option", { value: String(v), textContent: String(v) })));
    dialog.append(sel);
    return sel;
  };
  const text = (label, placeholder = "") => {
    dialog.append(el("label", { className: "field", textContent: label }));
    const input = el("input", { type: "text", placeholder });
    dialog.append(input);
    return input;
  };
  // **本編と同じ2問**（面白さと継続は別物）にしておく。並べて比べられるようにするため。
  const fun = pick("このゲーム自体は面白いか（1〜5）", [1, 2, 3, 4, 5]);
  const replay = pick("もう一度遊びたいか（1〜5）", [1, 2, 3, 4, 5]);
  const found = pick("噛み合わせに気づいた瞬間はあったか", ["あった", "なかった"]);
  const foundWhat = text("あったなら、何に気づいたか", "例：単調の3つ目が3倍になるので、同系統を3枚並べる");
  const best = text("一番良かった瞬間");
  const friction = text("退屈・面倒だったところ");
  const story = text("このゲームを一言で");
  const warn = el("div", { className: "warn" });
  dialog.append(warn);
  dialog.append(el("div", { className: "actions", style: "display:grid; gap:8px; margin-top:12px" }, [
    el("button", {
      className: "btn primary wide", textContent: "記録して送る",
      onclick: () => {
        const missing = [];
        if (!fun.value) missing.push("面白いか");
        if (!replay.value) missing.push("もう一度遊びたいか");
        if (!found.value) missing.push("気づいた瞬間");
        if (missing.length) { warn.textContent = `未回答：${missing.join(" / ")}`; return; }
        const survey = {
          fun: Number(fun.value), replay: Number(replay.value),
          insight: found.value, insightWhat: foundWhat.value,
          bestMoment: best.value, friction: friction.value, runStory: story.value
        };
        state.survey = survey; save();
        dialog.close(); dialog.remove();
        push(survey);
      }
    }),
    el("button", { className: "btn wide", textContent: "やめる", onclick: () => { dialog.close(); dialog.remove(); } })
  ]));
  document.body.append(dialog);
  dialog.showModal();
}

$("#markButton").addEventListener("click", () => openMark());
$("#howBtn").addEventListener("click", () => {
  $("#menuDialog").close();
  $("#howBody").replaceChildren(...HOW.split("\n").map(t => el("div", { textContent: t })));
  $("#howDialog").showModal();
});
$("#closeHow").addEventListener("click", () => $("#howDialog").close());
$("#surveyBtn").addEventListener("click", () => { $("#menuDialog").close(); openSurvey(); });
$("#closeMark").addEventListener("click", () => $("#markDialog").close());

draw();
