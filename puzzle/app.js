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
  return { index: 0, slots: [null, null, null, null, null], tries: {}, best: {}, cleared: {}, startedAt: new Date().toISOString() };
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

draw();
