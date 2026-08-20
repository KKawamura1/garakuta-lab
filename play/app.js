import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { PHASE } from "../core/phase.mjs";
import { ARC } from "../core/arc.mjs";
import { sendRun, uuid } from "../agent-view/sync.js";

const RULESETS = { phase: PHASE, arc: ARC };
const SAVE_KEY = "garakuta-play-session";
const ARCHIVE_KEY = "garakuta-play-finished";
const MAX_ARCHIVE = 12;
const GRID_CYCLES = 8;

const MARKERS = [
  ["hit", "きた！"], ["insight", "ひらめいた"], ["choice", "迷う"],
  ["payoff", "うまくいった"], ["friction", "つらい"], ["unclear", "わからない"]
];
const UPDATE_LABELS = [
  ["confirmed", "方針どおり"], ["revalued_existing", "手持ちの見方が変わった"], ["new_plan", "方針を変える"]
];

const $ = s => document.querySelector(s);
const el = (tag, props = {}, kids = []) => {
  const node = Object.assign(document.createElement(tag), props);
  kids.filter(Boolean).forEach(k => node.append(k));
  return node;
};

let session = load();
let run = rebuild();
let selectedPartId = null;
let selectedSlot = null;
let pendingPrediction = null;
let pendingWorry = "なし";
let playback = null;
let message = "";

function rulesetOf(name) { return RULESETS[String(name || "phase").toLowerCase()] || PHASE; }

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved?.seed !== undefined && Array.isArray(saved.actions)) return saved;
  } catch (_) {}
  return fresh();
}

function fresh(seed = null, ruleset = null) {
  const params = new URLSearchParams(location.search);
  return {
    runId: uuid(),
    ruleset: ruleset || params.get("ruleset") || "phase",
    seed: seed === null ? Math.floor(Math.random() * 100000) : seed,
    playerId: "human-play",
    head: "play",
    startedAt: new Date().toISOString(),
    actions: [], survey: null
  };
}

function rebuild() {
  const next = createRun({ seed: session.seed, playerId: session.playerId, ruleset: rulesetOf(session.ruleset) });
  session.actions.forEach(a => next.act(a));
  return next;
}

function readArchive() {
  try { const a = JSON.parse(localStorage.getItem(ARCHIVE_KEY)); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function archiveCurrent() {
  if (!session.trace) return;
  const archive = readArchive().filter(x => x.runId !== session.runId);
  archive.push(JSON.parse(JSON.stringify(session)));
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive.slice(-MAX_ARCHIVE)));
}
function persist() { localStorage.setItem(SAVE_KEY, JSON.stringify(session)); }

function act(action) {
  const result = run.act(action);
  if (!result.ok) { message = result.error; draw(); return result; }
  session.actions.push({ ...action, at: new Date().toISOString() });
  persist();
  return result;
}

/* ---------- 位相表：剰余計算を絵にする ---------- */

function firesOn(cycle, slotIndex, period) {
  return (cycle - 1) % period === slotIndex % period;
}
function isDefensive(part) {
  return Boolean(part && part.tags && part.tags.includes("防御"));
}

function phaseGrid(o) {
  const enemy = o.upcomingEnemy || {};
  const atkPeriod = enemy["攻撃周期"] || 1;
  const enemyHits = c => (c - 1) % atkPeriod === 0;
  const grid = el("div", { className: "phase-grid" });
  grid.style.gridTemplateColumns = `86px repeat(${GRID_CYCLES}, 1fr)`;

  grid.append(el("div", { className: "cell cycle-label", textContent: "巡回" }));
  for (let c = 1; c <= GRID_CYCLES; c += 1) {
    grid.append(el("div", { className: "cell cycle-label num", textContent: String(c) }));
  }

  grid.append(el("div", { className: "cell slot-label", textContent: "敵の攻撃" }));
  for (let c = 1; c <= GRID_CYCLES; c += 1) {
    grid.append(el("div", {
      className: `cell${enemyHits(c) ? " hit" : ""}`,
      textContent: enemyHits(c) ? String(enemy.atk ?? "") : ""
    }));
  }

  const parts = rulesetOf(session.ruleset).PARTS;
  const nominal = type => {
    try {
      const d = parts[type].run({ uses: {}, rng: () => 0.5, instanceId: "x" });
      const dmg = (d.damage || 0) + (d.hits || []).reduce((a, b) => a + b, 0);
      return { dmg, shield: d.shield || 0 };
    } catch (_) { return { dmg: 0, shield: 0 }; }
  };
  const perCycle = Array.from({ length: GRID_CYCLES }, () => ({ n: 0, dmg: 0, shield: 0 }));
  o.slots.forEach((slot, i) => {
    if (!slot.part) return;
    const nom = nominal(slot.part.type);
    for (let c = 1; c <= GRID_CYCLES; c += 1) {
      if (!firesOn(c, i, slot.part.period || 1)) continue;
      perCycle[c - 1].n += 1;
      perCycle[c - 1].dmg += nom.dmg;
      perCycle[c - 1].shield += nom.shield;
    }
  });

  o.slots.forEach((slot, i) => {
    const part = slot.part;
    const label = el("button", {
      className: `cell slot-label${selectedSlot === i ? " selected" : ""}`,
      textContent: part ? `${i + 1} ${part.name}` : `${i + 1} 空き`,
      onclick: () => tapSlot(i)
    });
    grid.append(label);
    for (let c = 1; c <= GRID_CYCLES; c += 1) {
      const fires = part && firesOn(c, i, part.period || 1);
      const aligned = fires && isDefensive(part) && enemyHits(c);
      grid.append(el("div", {
        className: `cell${fires ? " fire" : ""}${fires && isDefensive(part) ? " def" : ""}${aligned ? " aligned" : ""}`,
        textContent: fires ? "●" : ""
      }));
    }
  });

  // 合計行。素の値なので、送気管の加算と敵の減衰・上限は含まない。
  grid.append(el("div", { className: "cell slot-label", textContent: "素の攻撃" }));
  perCycle.forEach(x => grid.append(el("div", {
    className: `cell${x.dmg ? " fire" : ""}`, textContent: x.dmg ? String(x.dmg) : "—"
  })));
  grid.append(el("div", { className: "cell slot-label", textContent: "素の遮蔽" }));
  perCycle.forEach((x, idx) => grid.append(el("div", {
    className: `cell${x.shield ? " fire def" : ""}${x.shield && enemyHits(idx + 1) ? " aligned" : ""}`,
    textContent: x.shield ? String(x.shield) : "—"
  })));
  return grid;
}

/* ---------- 操作 ---------- */

function tapSlot(i) {
  const o = run.observe();
  if (selectedPartId) {
    act({ type: "place", partId: selectedPartId, slot: i + 1 });
    selectedPartId = null; selectedSlot = null;
  } else if (selectedSlot !== null && selectedSlot !== i) {
    act({ type: "swap", slotA: selectedSlot + 1, slotB: i + 1 });
    selectedSlot = null;
  } else {
    selectedSlot = selectedSlot === i ? null : i;
    if (!o.slots[i].part && selectedSlot === i) selectedSlot = null;
  }
  message = "";
  draw();
}

function tapPart(id) {
  selectedPartId = selectedPartId === id ? null : id;
  selectedSlot = null;
  message = "";
  draw();
}

/* ---------- 画面 ---------- */

function draw() {
  const o = run.observe();
  const rules = rulesetOf(session.ruleset);
  $("#title").textContent = rules.title.split(" / ")[0];
  $("#wave").textContent = o.done
    ? (o.won ? "全6戦を突破" : `第${o.battleNumber}戦で停止`)
    : `第${o.battleNumber}戦 / 全${o.totalBattles}戦 ・ seed ${o.seed}`;
  const screen = $("#screen");
  screen.replaceChildren();

  if (playback) { screen.append(...battleScreen(o)); return; }
  if (o.done) { screen.append(...endScreen(o)); return; }
  if (o.phase === "reward") { screen.append(...rewardScreen(o)); return; }
  screen.append(...buildScreen(o));
}

function statusCard(o) {
  const card = el("div", { className: "card" });
  card.append(el("div", { className: "rowline" }, [
    el("strong", { textContent: "機体" }),
    el("span", { className: "grow small num", textContent: `HP ${o.hp} / ${o.maxHp}` }),
    el("span", { className: "chip", textContent: `◆${o.scrap}` })
  ]));
  const bar = el("div", { className: "bar" });
  bar.append(el("i", {}, []));
  bar.firstChild.style.width = `${Math.max(0, Math.min(100, o.hp / o.maxHp * 100))}%`;
  card.append(bar);
  if (o.scrap >= 1 && o.hp < o.maxHp) {
    card.append(el("div", { className: "actions", style: "margin-top:8px" }, [
      el("button", { className: "btn", textContent: `修復材1でHP+${rulesetOf(session.ruleset).REPAIR_HP}`, onclick: () => { act({ type: "repair" }); draw(); } })
    ]));
  }
  return card;
}

function enemyCard(o) {
  const e = o.upcomingEnemy;
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: "次の敵" }));
  card.append(el("div", { className: "rowline" }, [
    el("strong", { textContent: e.name }),
    el("span", { className: "grow small num", textContent: `HP ${e.hp ?? "—"}` })
  ]));
  const LABELS = { atk: "攻撃", armor: "装甲", soak: "減衰", cap: "命中上限", strikes: "反撃回数" };
  const facts = Object.entries(e)
    .filter(([k, v]) => !["name", "trait", "hp"].includes(k) && v !== null && v !== undefined)
    .map(([k, v]) => `${LABELS[k] || k} ${v}`);
  card.append(el("div", { className: "small", textContent: facts.join(" ・ ") }));
  card.append(el("div", { className: "small", style: "margin-top:4px", textContent: e.trait }));
  card.append(el("div", {
    className: "small", style: "margin-top:4px;color:#dd5b56",
    textContent: `${rulesetOf(session.ruleset).MAX_CYCLES}巡までに削り切れなければ敗北（耐えるだけでは勝てない）`
  }));
  return card;
}

function buildScreen(o) {
  const out = [statusCard(o), enemyCard(o)];

  const grid2 = el("div", { className: "card" });
  grid2.append(el("h2", { textContent: "位相表 — どの枠がどの巡回に動くか" }));
  grid2.append(phaseGrid(o));
  grid2.append(el("div", { className: "legend" }, [
    el("span", {}, [el("i", { style: "background:#3d5c33" }), document.createTextNode("攻撃系が作動")]),
    el("span", {}, [el("i", { style: "background:#2f5a55" }), document.createTextNode("防御系が作動")]),
    el("span", {}, [el("i", { style: "background:#4a2422" }), document.createTextNode("敵の攻撃")]),
    el("span", {}, [el("i", { style: "background:transparent;border:2px solid #9dcc73" }), document.createTextNode("防御が攻撃と噛み合っている")])
  ]));
  grid2.append(el("div", { className: "small", style: "margin-top:6px", textContent: "合計は素の値です。送気管の加算、敵の減衰・命中上限は含みません。" }));
  grid2.append(killEstimate(o));
  out.push(grid2);

  const slotCard = el("div", { className: "card" });
  slotCard.append(el("h2", { textContent: selectedPartId ? "置きたい枠を選ぶ" : "枠（タップで選択、もう一つ選ぶと入れ替え）" }));
  const slots = el("div", { className: "slots" });
  o.slots.forEach((slot, i) => {
    const p = slot.part;
    const btn = el("button", {
      className: `slot${p ? "" : " empty"}${selectedSlot === i ? " selected" : ""}`,
      onclick: () => tapSlot(i)
    }, [
      el("span", { className: "idx", textContent: String(i + 1) }),
      el("span", { className: "icon", textContent: p ? p.icon : "＋" }),
      el("span", { className: "grow" }, [
        el("div", { className: "name", textContent: p ? p.name : "空き" }),
        el("div", { className: "meta", textContent: p ? `周期${p.period ?? 1} ・ ${cyclesText(i, p.period ?? 1)}` : "部品を選んでここをタップ" })
      ])
    ]);
    slots.append(btn);
  });
  slotCard.append(slots);
  if (selectedSlot !== null && o.slots[selectedSlot].part) {
    slotCard.append(el("div", { className: "actions", style: "margin-top:8px" }, [
      el("button", { className: "btn", textContent: "この枠を外す", onclick: () => { act({ type: "remove", slot: selectedSlot + 1 }); selectedSlot = null; draw(); } })
    ]));
  }
  out.push(slotCard);

  if (o.inventory.length) {
    const inv = el("div", { className: "card" });
    inv.append(el("h2", { textContent: `予備の部品（${o.inventory.length}）` }));
    const list = el("div", { className: "parts" });
    o.inventory.forEach(p => {
      list.append(el("button", {
        className: `part${selectedPartId === p.id ? " selected" : ""}`,
        onclick: () => tapPart(p.id)
      }, [
        el("span", { className: "icon", textContent: p.icon }),
        el("span", { className: "grow" }, [
          el("div", { className: "name" }, [
            document.createTextNode(p.name),
            el("span", { className: "tag", textContent: `周期${p.period ?? 1}` }),
            p.rare ? el("span", { className: "tag", textContent: "レア" }) : null
          ]),
          el("div", { className: "desc", textContent: p.desc })
        ])
      ]));
    });
    inv.append(list);
    if (selectedPartId) {
      inv.append(el("div", { className: "actions", style: "margin-top:8px" }, [
        el("button", { className: "btn", textContent: "分解して◆1", onclick: () => { act({ type: "scrapPart", partId: selectedPartId }); selectedPartId = null; draw(); } })
      ]));
    }
    out.push(inv);
  }

  if (o.lastBattle) out.push(lastBattleCard(o.lastBattle));

  const go = el("div", { className: "card" });
  go.append(el("h2", { textContent: "戦う前に — いまの見通しは？" }));
  const picks = el("div", { className: "actions" });
  rulesetOf(session.ruleset).PREDICTIONS.forEach(p => {
    picks.append(el("button", {
      className: `btn pick${pendingPrediction === p ? " on" : ""}`,
      textContent: p,
      onclick: () => { pendingPrediction = p; draw(); }
    }));
  });
  go.append(picks);
  go.append(el("label", { className: "field", textContent: "いちばん不安なこと" }));
  const worry = el("select");
  rulesetOf(session.ruleset).WORRY_CATEGORIES.forEach(w => worry.append(el("option", { value: w, textContent: w, selected: w === pendingWorry })));
  worry.onchange = () => { pendingWorry = worry.value; };
  go.append(worry);
  go.append(el("div", { className: "actions", style: "margin-top:10px" }, [
    el("button", {
      className: "btn primary wide",
      textContent: pendingPrediction ? "この配置で戦う" : "見通しを選んでください",
      disabled: !pendingPrediction,
      onclick: () => startBattle()
    }),
    el("button", { className: "btn", textContent: "気持ち", onclick: () => openMark() })
  ]));
  go.append(el("div", { className: "msg", textContent: message }));
  out.push(go);
  return out;
}

// 12巡の打切りは、遅い構成を組んでいる人にこそ見えている必要がある。
// 素の合計で敵HPへ何巡目に届くかを出し、制限を超えるなら赤で言う。
function killEstimate(o) {
  const rules = rulesetOf(session.ruleset);
  const limit = rules.MAX_CYCLES;
  const enemyHp = o.upcomingEnemy?.hp;
  if (!enemyHp) return el("div", { className: "small", textContent: "" });
  const parts = rules.PARTS;
  let acc = 0;
  let killCycle = null;
  for (let c = 1; c <= limit; c += 1) {
    o.slots.forEach((slot, i) => {
      if (!slot.part) return;
      if (!firesOn(c, i, slot.part.period || 1)) return;
      try {
        const d = parts[slot.part.type].run({ uses: {}, rng: () => 0.5, instanceId: "x" });
        acc += (d.damage || 0) + (d.hits || []).reduce((a, b) => a + b, 0);
      } catch (_) {}
    });
    if (killCycle === null && acc >= enemyHp) killCycle = c;
  }
  const ok = killCycle !== null;
  return el("div", {
    className: "small",
    style: `margin-top:6px;color:${ok ? "#9dcc73" : "#dd5b56"}`,
    textContent: ok
      ? `目安：素の合計だと ${killCycle}巡目に敵HP${enemyHp}へ届く（打切りは${limit}巡）`
      : `目安：素の合計では ${limit}巡かけても敵HP${enemyHp}に届かない（${acc}止まり）。耐えるだけでは負ける`
  });
}

function cyclesText(slotIndex, period) {
  if (period === 1) return "毎巡";
  const list = [];
  for (let c = 1; c <= GRID_CYCLES && list.length < 3; c += 1) if (firesOn(c, slotIndex, period)) list.push(c);
  return `${list.join("・")}…巡目`;
}

function lastBattleCard(b) {
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: `直前の戦闘 — ${b.enemy}` }));
  card.append(el("div", { className: "small", textContent: `${b.won ? "勝利" : "敗北"} ・ ${b.cycles}巡 ・ HP ${b.hpBefore}→${b.hpAfter} ・ 敵残${b.enemyHpLeft}` }));
  b.contributions.forEach(c => {
    const bits = [c.damage ? `攻撃${c.damage}` : "", c.shield ? `遮蔽${c.shield}` : "", c.healing ? `回復${c.healing}` : ""].filter(Boolean).join(" ");
    card.append(el("div", { className: "small", textContent: `${c.name}：${c.activations}回作動${c.idles ? `（${c.idles}回休み）` : ""} ${bits}` }));
  });
  return card;
}

/* ---------- 戦闘 ---------- */

function startBattle() {
  const result = act({
    type: "battle", prediction: pendingPrediction, worry: pendingWorry,
    worryText: ""
  });
  if (!result.ok) return;
  pendingPrediction = null;
  pendingWorry = "なし";
  selectedPartId = null; selectedSlot = null;
  const lines = result.battle.log || [];
  playback = { battle: result.battle, lines, shown: 0 };
  draw();
  tick();
}

function tick() {
  if (!playback) return;
  if (playback.shown >= playback.lines.length) { draw(); return; }
  playback.shown += 1;
  draw();
  setTimeout(tick, playback.lines[playback.shown - 1]?.includes("敵:") ? 460 : 260);
}

function battleScreen(o) {
  const b = playback.battle;
  const done = playback.shown >= playback.lines.length;
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: `第${b.battleNumber}戦 — ${b.enemy}（${rulesetOf(session.ruleset).MAX_CYCLES}巡で打切り）` }));
  const log = el("div", { className: "log" });
  let cycle = null;
  playback.lines.slice(0, playback.shown).forEach(line => {
    const m = /^巡(\d+)/.exec(line);
    if (m && m[1] !== cycle) { cycle = m[1]; log.append(el("div", { className: "cycle", textContent: `巡回 ${cycle}` })); }
    log.append(el("div", { className: `line${line.includes("敵:") ? " enemy" : ""}`, textContent: line.replace(/^巡\d+\s*/, "") }));
  });
  card.append(log);
  const actions = el("div", { className: "actions", style: "margin-top:12px" });
  if (!done) {
    actions.append(el("button", { className: "btn wide", textContent: "早送り", onclick: () => { playback.shown = playback.lines.length; draw(); } }));
  } else {
    actions.append(el("button", {
      className: "btn primary wide",
      textContent: b.won ? `勝利（残HP ${b.hpAfter}）— 次へ` : "敗北 — 結果を見る",
      onclick: () => { playback = null; draw(); }
    }));
    actions.append(el("button", { className: "btn", textContent: "気持ち", onclick: () => openMark() }));
  }
  card.append(actions);
  return [card];
}

/* ---------- 報酬 ---------- */

function rewardScreen(o) {
  const out = [statusCard(o)];
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: "拾い物 — 1つだけ持って帰れる" }));
  const list = el("div", { className: "parts" });
  o.offer.forEach(item => {
    const p = item.part;
    list.append(el("button", {
      className: "part",
      onclick: () => askUpdate(choice => {
        act({ type: "take", choice: item.choice, reason: "", update: choice, updateText: "" });
        draw();
      })
    }, [
      el("span", { className: "icon", textContent: p.icon }),
      el("span", { className: "grow" }, [
        el("div", { className: "name" }, [
          document.createTextNode(p.name),
          el("span", { className: "tag", textContent: `周期${p.period ?? 1}` }),
          p.rare ? el("span", { className: "tag", textContent: "レア" }) : null
        ]),
        el("div", { className: "desc", textContent: p.desc })
      ])
    ]));
  });
  card.append(list);
  card.append(el("div", { className: "actions", style: "margin-top:10px" }, [
    el("button", { className: "btn wide", textContent: "全部見送る（◆2）", onclick: () => { act({ type: "skipAll", reason: "" }); draw(); } }),
    el("button", { className: "btn", textContent: "気持ち", onclick: () => openMark() })
  ]));
  out.push(card);
  if (o.lastBattle) out.push(lastBattleCard(o.lastBattle));
  return out;
}

function askUpdate(then) {
  const dialog = el("dialog", { className: "" });
  dialog.append(el("h2", { textContent: "これを取ると、いまの方針は？" }));
  const acts = el("div", { className: "actions", style: "margin-top:10px" });
  UPDATE_LABELS.forEach(([value, label]) => {
    acts.append(el("button", {
      className: "btn pick", textContent: label,
      onclick: () => { dialog.close(); dialog.remove(); then(value); }
    }));
  });
  dialog.append(acts);
  document.body.append(dialog);
  dialog.showModal();
}

/* ---------- 終了 ---------- */

function endScreen(o) {
  const out = [];
  const head = el("div", { className: "card" });
  head.append(el("h2", { textContent: "ラン終了" }));
  head.append(el("div", { textContent: o.won ? "全6戦を突破した。" : `第${o.battleNumber}戦で停止した。` }));
  out.push(head);
  if (o.lastBattle) out.push(lastBattleCard(o.lastBattle));

  if (session.survey) {
    const done = el("div", { className: "card" });
    done.append(el("div", { className: "small", textContent: message || "記録しました。" }));
    done.append(el("div", { className: "actions", style: "margin-top:10px" }, [
      el("button", { className: "btn wide", textContent: "サーバーへ再送", onclick: () => push() }),
      el("button", { className: "btn", textContent: "JSONをコピー", onclick: () => copyJson() })
    ]));
    out.push(done);
    return out;
  }

  const form = el("div", { className: "card" });
  form.append(el("h2", { textContent: "最後にいくつか" }));
  form.append(el("label", { className: "field", textContent: "もう一度遊びたいか（1〜5）" }));
  const replay = el("select");
  replay.append(el("option", { value: "", textContent: "未選択" }));
  [1, 2, 3, 4, 5].forEach(v => replay.append(el("option", { value: String(v), textContent: String(v) })));
  form.append(replay);
  form.append(el("label", { className: "field", textContent: "方針転換はあったか" }));
  const pivot = el("select");
  pivot.append(el("option", { value: "", textContent: "未選択" }));
  ["あった", "なかった"].forEach(v => pivot.append(el("option", { value: v, textContent: v })));
  form.append(pivot);
  form.append(el("label", { className: "field", textContent: "勝敗が実質決まった戦闘番号（無ければ「なし」）" }));
  const settled = el("input", { type: "text", placeholder: "例：3 / なし" });
  form.append(settled);
  form.append(el("label", { className: "field", textContent: "一番良かった瞬間" }));
  const best = el("input", { type: "text" });
  form.append(best);
  form.append(el("label", { className: "field", textContent: "退屈・面倒だったところ" }));
  const friction = el("input", { type: "text" });
  form.append(friction);
  form.append(el("label", { className: "field", textContent: "このランを一言で" }));
  const story = el("input", { type: "text" });
  form.append(story);
  const warn = el("div", { className: "warn" });
  form.append(warn);
  form.append(el("div", { className: "actions", style: "margin-top:12px" }, [
    el("button", {
      className: "btn primary wide", textContent: "記録して送る",
      onclick: () => {
        const missing = [];
        if (!replay.value) missing.push("もう一度遊びたいか");
        if (!pivot.value) missing.push("方針転換");
        if (!settled.value.trim()) missing.push("決着点");
        if (missing.length) { warn.textContent = `未回答：${missing.join(" / ")}`; return; }
        const survey = {
          replay: Number(replay.value), pivot: pivot.value, settledAt: settled.value.trim(),
          bestMoment: best.value, friction: friction.value, runStory: story.value
        };
        session.survey = survey;
        session.endedAt = new Date().toISOString();
        session.trace = run.finish(survey);
        session.metrics = describeRun(session.trace);
        archiveCurrent();
        persist();
        message = "送信中…";
        draw();
        push();
      }
    })
  ]));
  out.push(form);
  return out;
}

async function push() {
  if (!session.runId) { session.runId = uuid(); persist(); }
  const result = await sendRun(session);
  message = result.ok ? "サーバーへ記録しました。" : `送信できませんでした（${result.error}）。JSONをコピーして渡してください。`;
  draw();
}

async function copyJson() {
  const finished = readArchive().filter(x => x.runId !== session.runId);
  const text = JSON.stringify([...finished, session], null, 1);
  try { await navigator.clipboard.writeText(text); message = "コピーしました。"; }
  catch (_) { message = "コピーできませんでした。"; }
  draw();
}

/* ---------- 気持ちの記録 ---------- */

function openMark() {
  const box = $("#markChoices");
  box.replaceChildren();
  MARKERS.forEach(([kind, label]) => {
    box.append(el("button", {
      className: "btn pick", textContent: label,
      onclick: () => {
        act({ type: "mark", kind, note: $("#markNote").value.trim() });
        $("#markNote").value = "";
        $("#markDialog").close();
        draw();
      }
    }));
  });
  $("#markDialog").showModal();
}

/* ---------- 起動 ---------- */

$("#newRun").addEventListener("click", () => {
  if (!confirm("いまのランを捨てて、新しく始めますか？")) return;
  archiveCurrent();
  const params = new URLSearchParams(location.search);
  const seed = params.get("seed");
  session = fresh(seed !== null && seed !== "" ? Number(seed) : null, session.ruleset);
  run = rebuild();
  selectedPartId = null; selectedSlot = null; pendingPrediction = null; playback = null; message = "";
  persist(); draw();
});
$("#helpButton").addEventListener("click", () => {
  $("#helpBody").replaceChildren(...rulesetOf(session.ruleset).rules.split("\n").map(line => el("div", { textContent: line })));
  $("#helpDialog").showModal();
});
$("#closeHelp").addEventListener("click", () => $("#helpDialog").close());
$("#closeMark").addEventListener("click", () => $("#markDialog").close());

const params = new URLSearchParams(location.search);
const urlSeed = params.get("seed");
const urlRuleset = params.get("ruleset");
if (!session.actions.length) {
  const wantSeed = urlSeed !== null && urlSeed !== "" ? Number(urlSeed) : null;
  const wantRuleset = urlRuleset ? urlRuleset.toLowerCase() : session.ruleset;
  if ((wantSeed !== null && wantSeed !== session.seed) || wantRuleset !== session.ruleset) {
    session = fresh(wantSeed, wantRuleset);
    run = rebuild();
  }
}
persist();
draw();
