import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { PHASE } from "../core/phase.mjs";
import { RELAY } from "../core/relay.mjs";
import { makeLawRuleset } from "../core/laws.mjs";
import LAW_TABLE from "../core/law-table.json" with { type: "json" };
import { ARC } from "../core/arc.mjs";
import { sendRun, uuid } from "../agent-view/sync.js";
import { projectCycles, markFor, firesOn } from "../core/project.mjs";
import { makeRng } from "../core/rng.mjs";

const RULESETS = { relay: RELAY, phase: PHASE, arc: ARC };

// 法則機関は「ルールセット」が固定でない。**毎ラン、事前検証を通った法則の組を引く。**
// 引ける組は core/law-table.json にあり、生成条件（T1〜T3）と天井の条件を通ったものだけが載っている。
// つまり「出してよい問題か」の判定が、設計時の作業ではなく機械の一部になっている。
const lawVariants = Array.isArray(LAW_TABLE) ? LAW_TABLE : [];

function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// 新しいランでは、**まだ記録の無い組を優先して引く。**
//
// これが P12 の核心である。第10回で継続が止まった理由は作者の言葉どおり
// 「もう一回やっても、もうハイスコアが二度と得られない（最大でも1位タイにしかならない）」だった。
// 記録が組ごとにあり、未挑戦の組から引くなら、**始める理由が毎回ある。**
// 同じ種なら同じ組になる（再現できる）ことは保つ。
function pickVariant(seed) {
  if (!lawVariants.length) return null;
  // モジュール初期化中にも呼ばれるので、`bests` を参照せずその場で読む。
  // 以前 agent-view で、初期化前の変数を読んで画面が落ちたのと同じ形を避ける。
  const played = new Set(Object.keys(loadBests())
    .map(key => key.split(":")[1]).filter(Boolean));
  const fresh = lawVariants.filter(v => !played.has(v.laws.join("+")));
  const pool = fresh.length ? fresh : lawVariants;
  return pool[hashOf(`laws:${seed}`) % pool.length];
}

function lawRulesetFor(session) {
  const variant = session.variant && lawVariants.find(v => v.laws.join("+") === session.variant)
    || pickVariant(session.seed);
  return variant ? makeLawRuleset(variant.laws, variant.scales, variant.atkScales) : RELAY;
}
const SAVE_KEY = "garakuta-play-session";
const ARCHIVE_KEY = "garakuta-play-finished";
const BEST_KEY = "garakuta-play-bests";
const MAX_ARCHIVE = 12;
// 表に出す巡回数。打切りまで全部出す——打切りが見えていなかったせいで、
// 作者がHP満タンのまま時間切れで負けたことがある（第4回）。
const gridCycles = rules => (rules.deterministic ? rules.MAX_CYCLES : 8);

// 探索の手応え。勝てる並びが何通りあるかを、体験の側から測るための質問。
const GRIPS = [
  ["only", "これしかない"],
  ["chose", "いくつか成立して選んだ"],
  ["settled", "妥協した"],
  ["more", "もっと良いのがありそう"]
];

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
let pendingGrip = null;
let lastBestBeaten = false;
let playback = null;
let message = "";

// 敵ごとの自己最高。**ランをまたいで残る唯一の値である。**
// 作者の言う形（A）＝「1ランは短く、失敗すると最初からになるが、何かしら永続する値が溜まる」の最小形。
// 外しても罰は無い。勝ちは勝ちで、ランはそのまま続く。
function loadBests() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { return {}; }
}
function saveBests(bests) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(bests)); } catch { /* 保存できなくても遊べる */ }
}
let bests = loadBests();
// 記録の鍵に**法則の組**を入れる。組が変われば記録は未設定に戻るので、
// 「もうハイスコアが二度と得られない」（第10回で継続が止まった理由）が起きない。
const bestKeyFor = (rulesetName, enemyName) => {
  const rules = rulesetOf(rulesetName);
  const variant = rules.variantId ? `:${rules.variantId}` : "";
  return `${String(rulesetName).toLowerCase()}${variant}:${enemyName}`;
};

function recordBest(rulesetName, enemyName, grade, cycles) {
  if (!grade || !grade.rank) return false;
  const key = bestKeyFor(rulesetName, enemyName);
  const prior = bests[key];
  const better = !prior || grade.rank > prior.rank || (grade.rank === prior.rank && cycles < prior.cycles);
  if (better) { bests[key] = { rank: grade.rank, label: grade.label, cycles }; saveBests(bests); }
  return better;
}

// 既定は法則機関。ただし通った組が無いときは遊べないので RELAY に落とす。
function defaultRuleset() { return lawVariants.length ? "laws" : "relay"; }

function rulesetOf(name) {
  const key = String(name || defaultRuleset()).toLowerCase();
  if (key === "laws") return lawRulesetFor(session);
  return RULESETS[key] || RELAY;
}

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
    ruleset: ruleset || params.get("ruleset") || defaultRuleset(),
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
function persist() {
  // 自己最高もセッションに載せる。エクスポートで「何ラン目の状態か」を復元できるようにするため。
  session.bests = bests;
  localStorage.setItem(SAVE_KEY, JSON.stringify(session));
}

function act(action) {
  const result = run.act(action);
  if (!result.ok) { message = result.error; draw(); return result; }
  session.actions.push({ ...action, at: new Date().toISOString() });
  persist();
  return result;
}

/* ---------- 位相表：剰余計算を絵にする ---------- */

function isDefensive(part) {
  return Boolean(part && part.tags && part.tags.includes("防御"));
}



// 系統は継電の条件そのものなので、部品を見た瞬間に分からなければならない。
const LINE_LABEL = { strike: "撃", guard: "守", service: "整" };
const lineBadge = part => (part && part.line
  ? el("span", { className: `tag line-${part.line}`, textContent: LINE_LABEL[part.line] || part.line })
  : null);

// いまの並びで実際に起きることを、巡回ごとに引き出す。
// 画面の判定（outcomePanel）と同じ計算を使うので、表と判定が食い違うことはない。
function battleTrace(o, rules) {
  const cycles = gridCycles(rules);
  const enemy = rules.ENEMIES[o.battleNumber - 1] || rules.ENEMIES[rules.ENEMIES.length - 1];
  const slots = o.slots.map(x => (x.part ? { id: x.part.id, type: x.part.type } : null));
  if (!enemy || !slots.some(Boolean)) return null;
  const result = rules.simulateBattle({ slots, hp: o.hp, maxHp: o.maxHp, enemy, rng: makeRng(1) });
  const blank = () => Array.from({ length: cycles }, () => 0);
  const out = {
    cycles: result.cycles, bySlot: new Map(),
    damage: blank(), shield: blank(), heal: blank(), reflect: blank(),
    enemyHp: blank(), hp: blank()
  };
  result.log.forEach(entry => {
    const c = entry.cycle;
    if (c > cycles) return;
    if (entry.slot !== null && entry.slot !== undefined) {
      out.bySlot.set(`${entry.slot}:${c}`, entry);
      out.damage[c - 1] += entry.damage || 0;
      out.shield[c - 1] += entry.shieldGained || 0;
      out.heal[c - 1] += entry.healed || 0;
    } else if (entry.type === "reflect") {
      out.reflect[c - 1] += entry.damage || 0;
      out.damage[c - 1] += entry.damage || 0;
    }
    if (entry.after) {
      out.enemyHp[c - 1] = entry.after.enemyHp;
      out.hp[c - 1] = entry.after.hp;
    }
  });
  // 決着後の巡回は空欄にする（起きないことを書かない）。
  for (let c = result.cycles; c < cycles; c += 1) { out.enemyHp[c] = 0; out.hp[c] = 0; }
  return out;
}

function phaseGrid(o) {
  const rules = rulesetOf(session.ruleset);
  const cycles = gridCycles(rules);
  const enemy = o.upcomingEnemy || {};
  const atkPeriod = enemy["攻撃周期"] || 1;
  const enemyHits = c => (c - 1) % atkPeriod === 0;
  const grid = el("div", { className: "phase-grid" });
  grid.style.gridTemplateColumns = `86px repeat(${cycles}, 1fr)`;

  grid.append(el("div", { className: "cell cycle-label", textContent: "巡回" }));
  for (let c = 1; c <= cycles; c += 1) {
    grid.append(el("div", { className: "cell cycle-label num", textContent: String(c) }));
  }

  grid.append(el("div", { className: "cell slot-label", textContent: "敵の攻撃" }));
  for (let c = 1; c <= cycles; c += 1) {
    grid.append(el("div", {
      className: `cell${enemyHits(c) ? " hit" : ""}`,
      textContent: enemyHits(c) ? String(enemy.atk ?? "") : ""
    }));
  }

  // 決定的なルールセットでは、表も見積りではなく**実機のログ**から作る。
  // 近似の投影を別に持つと、説明文と実装がずれるのと同じ形で静かに食い違う（一度やった）。
  // ログから作れば、表に出ている数字は必ずその戦闘で実際に起きることである。
  const trace = rules.deterministic ? battleTrace(o, rules) : null;

  if (trace) {
    const cellOf = (slot, cycle) => trace.bySlot.get(`${slot}:${cycle}`);
    o.slots.forEach((slot, i) => {
      const part = slot.part;
      grid.append(el("button", {
        className: `cell slot-label${selectedSlot === i ? " selected" : ""}${part && part.line ? ` line-${part.line}` : ""}`,
        textContent: part ? `${i + 1} ${LINE_LABEL[part.line] || ""}${part.name}` : `${i + 1} 空き`,
        onclick: () => tapSlot(i)
      }));
      for (let c = 1; c <= cycles; c += 1) {
        const entry = cellOf(i, c);
        const fires = part && firesOn(c, i, part.period || 1);
        const value = entry ? (entry.damage || entry.shieldGained || entry.healed || 0) : 0;
        const defensive = entry ? Boolean(entry.shieldGained) : (part && isDefensive(part));
        grid.append(el("div", {
          className: `cell${fires ? " fire" : ""}${defensive && fires ? " def" : ""}`
            + `${entry && entry.gain > 1 ? " relay" : ""}`
            + `${defensive && fires && enemyHits(c) ? " aligned" : ""}`,
          textContent: entry ? String(value || "·") : (fires && c <= trace.cycles ? "·" : "")
        }));
      }
    });

    // 0 を「—」で潰さない行がある。撃破した巡回の敵HPは 0 であって、未発生ではない。
    const row = (label, values, cls = "", zeroIsReal = false) => {
      grid.append(el("div", { className: "cell slot-label", textContent: label }));
      values.forEach((v, idx) => {
        const past = idx + 1 > trace.cycles;
        grid.append(el("div", {
          className: `cell${v ? ` fire ${cls}` : ""}${cls === "def" && v && enemyHits(idx + 1) ? " aligned" : ""}`,
          textContent: past ? "" : (v || zeroIsReal ? String(v) : "—")
        }));
      });
    };
    row("与ダメージ", trace.damage);
    row("遮蔽", trace.shield, "def");
    if (trace.reflect.some(Boolean)) row("反射", trace.reflect);
    if (trace.heal.some(Boolean)) row("回復", trace.heal, "heal");
    row("敵HP", trace.enemyHp, "", true);
    row("自HP", trace.hp, "", true);
    return grid;
  }

  const projection = projectCycles(o.slots.map(x => (x.part ? { type: x.part.type } : null)), rules, cycles);
  const perCycle = projection.map(r => ({ n: r.firing, dmg: r.dmg, shield: r.shield, heal: r.heal }));

  o.slots.forEach((slot, i) => {
    const part = slot.part;
    const label = el("button", {
      className: `cell slot-label${selectedSlot === i ? " selected" : ""}`,
      textContent: part ? `${i + 1} ${part.name}` : `${i + 1} 空き`,
      onclick: () => tapSlot(i)
    });
    grid.append(label);
    for (let c = 1; c <= cycles; c += 1) {
      const fires = part && firesOn(c, i, part.period || 1);
      const aligned = fires && isDefensive(part) && enemyHits(c);
      grid.append(el("div", {
        className: `cell${fires ? " fire" : ""}${fires && isDefensive(part) ? " def" : ""}${aligned ? " aligned" : ""}`,
        textContent: fires ? markFor(rulesetOf(session.ruleset).PARTS[part.type]) : ""
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
  if (perCycle.some(x => x.heal)) {
    grid.append(el("div", { className: "cell slot-label", textContent: "素の回復" }));
    perCycle.forEach(x => grid.append(el("div", {
      className: `cell${x.heal ? " fire heal" : ""}`, textContent: x.heal ? String(x.heal) : "—"
    })));
  }
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
  // 版を画面に出す。出していなかったせいで、保存済みセッションが古いルールのままなのに
  // 「更新されていない」ようにしか見えない状態を作った（作者の報告で判明）。
  $("#title").textContent = rules.title.split(" / ")[0];
  $("#gameButton").textContent = rules.id;
  document.title = `${rules.title.split(" / ")[0]}（${rules.id}）`;
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
  // この敵の自己最高。ランをまたいで残る唯一の値であり、狙う的になる。
  // 届かなくても罰は無い（勝てばランは続く）ので、ここは赤くしない。
  const best = bests[bestKeyFor(session.ruleset, e.name)];
  card.append(el("div", {
    className: `small grade-line ${best ? `rank-${best.rank}` : ""}`, style: "margin-top:6px",
    textContent: best
      ? `この敵の自己最高： ${best.label}（${best.cycles}巡）`
      : "この敵の自己最高： まだ無い"
  }));
  return card;
}

// このランの法則。読まずには遊べないので、構築画面の先頭に出す。
function lawsCard() {
  const rules = rulesetOf(session.ruleset);
  if (!rules.laws || !rules.laws.length) return null;
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: "このランの法則" }));
  rules.laws.forEach(law => {
    card.append(el("div", { className: "law" }, [
      el("span", { className: "law-name", textContent: law.name }),
      el("span", { className: "law-desc", textContent: law.desc })
    ]));
  });
  card.append(el("div", { className: "small", style: "margin-top:6px",
    textContent: "法則はランごとに変わる。組が変われば、最適な並びも狙える記録も別物になる。" }));
  return card;
}

function buildScreen(o) {
  const out = [statusCard(o), lawsCard(), enemyCard(o)].filter(Boolean);

  const grid2 = el("div", { className: "card" });
  grid2.append(el("h2", { textContent: "位相表 — どの枠がどの巡回に動くか" }));
  grid2.append(el("div", { className: "grid-scroll" }, [phaseGrid(o)]));
  grid2.append(el("div", { className: "legend" }, [
    el("span", {}, [el("i", { style: "background:#3d5c33" }), document.createTextNode("攻撃系が作動")]),
    el("span", {}, [el("i", { style: "background:#2f5a55" }), document.createTextNode("防御系が作動")]),
    el("span", {}, [el("i", { style: "background:#4a2422" }), document.createTextNode("敵の攻撃")]),
    el("span", {}, [el("i", { style: "background:transparent;border:2px solid #9dcc73" }), document.createTextNode("防御が攻撃と噛み合っている")])
  ]));
  grid2.append(el("div", { className: "small", style: "margin-top:6px", textContent: "合計には送気管の加算を含みます。敵の減衰・命中上限は含みません。" }));
  grid2.append(outcomePanel(o));
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
    const p = o.slots[selectedSlot].part;
    const detail = el("div", { className: "detail" });
    detail.append(el("div", { className: "name" }, [
      document.createTextNode(`${p.icon} ${p.name}`),
      lineBadge(p),
      el("span", { className: "tag", textContent: `周期${p.period ?? 1}` }),
      p.rare ? el("span", { className: "tag", textContent: "レア" }) : null
    ]));
    detail.append(el("div", { className: "desc", textContent: p.desc }));
    detail.append(el("div", { className: "small", textContent: `枠${selectedSlot + 1}では ${cyclesText(selectedSlot, p.period ?? 1)} に作動` }));
    slotCard.append(detail);
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
            lineBadge(p),
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

  const rules = rulesetOf(session.ruleset);
  const go = el("div", { className: "card" });

  // 結果が上に出ているのに勝敗を予想させるのは、答えの見えている問題を出すのと同じである。
  // 決定的なルールセットでは予想を機械に任せ、代わりに**探索の手応え**を訊く。
  // これが新しい圧力の指標になる：勝てる並びが少なければ「これしかない」が増えるはずである。
  if (rules.deterministic) {
    go.append(el("h2", { textContent: "戦う前に — この並びの手応えは？" }));
    const picks = el("div", { className: "actions" });
    GRIPS.forEach(([value, label]) => {
      picks.append(el("button", {
        className: `btn pick${pendingGrip === value ? " on" : ""}`,
        textContent: label,
        onclick: () => { pendingGrip = value; draw(); }
      }));
    });
    go.append(picks);
  } else {
    go.append(el("h2", { textContent: "戦う前に — いまの見通しは？" }));
    const picks = el("div", { className: "actions" });
    rules.PREDICTIONS.forEach(p => {
      picks.append(el("button", {
        className: `btn pick${pendingPrediction === p ? " on" : ""}`,
        textContent: p,
        onclick: () => { pendingPrediction = p; draw(); }
      }));
    });
    go.append(picks);
  }
  go.append(el("label", { className: "field", textContent: "いちばん不安なこと" }));
  const worry = el("select");
  rules.WORRY_CATEGORIES.forEach(w => worry.append(el("option", { value: w, textContent: w, selected: w === pendingWorry })));
  worry.onchange = () => { pendingWorry = worry.value; };
  go.append(worry);
  go.append(el("div", { className: "actions", style: "margin-top:10px" }, [
    el("button", {
      className: "btn primary wide",
      textContent: readyToFight(rules) ? "この配置で戦う" : (rules.deterministic ? "手応えを選んでください" : "見通しを選んでください"),
      disabled: !readyToFight(rules),
      onclick: () => startBattle()
    }),
    el("button", { className: "btn", textContent: "気持ち", onclick: () => openMark() })
  ]));
  go.append(el("div", { className: "msg", textContent: message }));
  out.push(go);
  return out;
}

// 入れ替えのたびに結果を暗算するのは「ただの足し算で脳トレ」だと作者が報告した。
// PHASE の戦闘は決定的（どの部品も乱数を使わない）で、敵の数値はすべて画面に出ている。
// つまり正確な結果を出しても情報は増えない。**消えるのは暗算だけである。**
// 面白さは「結果が読めるか」ではなく「勝てる並びを見つけられるか」の側へ移す。
function outcomePanel(o) {
  const rules = rulesetOf(session.ruleset);
  const enemy = rules.ENEMIES[o.battleNumber - 1] || rules.ENEMIES[rules.ENEMIES.length - 1];
  if (!enemy) return el("div", { className: "small", textContent: "" });
  const slots = o.slots.map(x => (x.part ? { id: x.part.id, type: x.part.type } : null));
  if (!slots.some(Boolean)) {
    return el("div", { className: "verdict", textContent: "枠に部品を置くと、その並びの結果がここに出る" });
  }

  const runs = [];
  const samples = rules.deterministic ? 1 : 24;
  for (let i = 0; i < samples; i += 1) {
    runs.push(rules.simulateBattle({ slots, hp: o.hp, maxHp: o.maxHp, enemy, rng: makeRng(1000 + i) }));
  }
  const wins = runs.filter(r => r.won);
  const first = runs[0];

  if (rules.deterministic) {
    const lost = o.hp - first.hp;
    const grade = rules.gradeFor ? rules.gradeFor(first.won, lost) : null;
    // 試した並びを記録する。**探索そのものを観測するための唯一の手段である。**
    // 同じ並びを繰り返し描画しても二重に数えない。
    notePreview(slots, first);
    const box = el("div", { className: `verdict ${first.won ? "ok" : "ng"}` });
    box.append(el("div", {
      textContent: first.won
        ? `勝てる — ${first.cycles}巡で撃破 ・ HP ${o.hp}→${first.hp}${lost > 0 ? `（${lost}失う）` : "（無傷）"}`
        : first.timedOut
          ? `負ける — ${rules.MAX_CYCLES}巡で打切り ・ 敵残 ${first.enemyHp}`
          : `負ける — ${first.cycles}巡で力尽きる ・ 敵残 ${first.enemyHp}`
    }));
    if (grade && grade.rank) {
      const best = bests[bestKeyFor(session.ruleset, enemy.name)];
      const beats = !best || grade.rank > best.rank || (grade.rank === best.rank && first.cycles < best.cycles);
      box.append(el("div", {
        className: `grade-line rank-${grade.rank}`,
        textContent: `等級 ${grade.label}`
          + (best ? ` ・ この敵の自己最高 ${best.label}（${best.cycles}巡）` : " ・ 自己最高はまだ無い")
          + (beats ? "  ← 更新できる" : "")
      }));
    }
    return box;
  }

  const rate = wins.length / runs.length;
  const hps = wins.map(r => r.hp).sort((a, b) => a - b);
  const line = wins.length
    ? `${samples}回中${wins.length}回 勝ち ・ 残HP ${hps[0]}〜${hps[hps.length - 1]}`
    : `${samples}回とも 負け ・ 敵残 ${Math.min(...runs.map(r => r.enemyHp))}〜`;
  return el("div", { className: `verdict ${rate >= 0.999 ? "ok" : rate > 0 ? "mid" : "ng"}`, textContent: line });
}

// 試した並びの記録。画面は同じ並びを何度も描き直すので、直前と同じなら数えない。
let lastPreviewSignature = null;
function notePreview(slots, result) {
  const signature = slots.map(s => (s ? s.type : "-")).join(",");
  if (signature === lastPreviewSignature) return;
  lastPreviewSignature = signature;
  // act() を通す。session.actions に入れないと、再読み込み時の再生で試行の記録が消える。
  // ただし描画中に呼ばれるので、失敗しても draw() を呼び直さない（無限ループになる）。
  const action = { type: "preview", signature, won: result.won, hp: result.hp, cycles: result.cycles };
  const outcome = run.act(action);
  if (!outcome.ok) return;
  session.actions.push({ ...action, at: new Date().toISOString() });
  persist();
}

function cyclesText(slotIndex, period) {
  const cycles = gridCycles(rulesetOf(session.ruleset));
  if (period === 1) return "毎巡";
  const list = [];
  for (let c = 1; c <= cycles && list.length < 3; c += 1) if (firesOn(c, slotIndex, period)) list.push(c);
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

function readyToFight(rules) {
  return rules.deterministic ? Boolean(pendingGrip) : Boolean(pendingPrediction);
}

// 画面に出しているのと同じ計算から、予測ラベルを引く。
function machinePrediction(rules) {
  const o = run.observe();
  const enemy = rules.ENEMIES[o.battleNumber - 1] || rules.ENEMIES[rules.ENEMIES.length - 1];
  const slots = o.slots.map(x => (x.part ? { id: x.part.id, type: x.part.type } : null));
  const result = rules.simulateBattle({ slots, hp: o.hp, maxHp: o.maxHp, enemy, rng: makeRng(1) });
  // ルールセット自身の判定を使う。画面の言葉と記録の水準がずれないようにする。
  const level = rules.outcomeLevel(result.won, result.hp, result.cycles);
  return rules.PREDICTIONS[Math.max(0, Math.min(rules.PREDICTIONS.length - 1, level))];
}

function startBattle() {
  const rules = rulesetOf(session.ruleset);
  // 決定的なルールセットでは、予想は本人ではなく機械が出す（画面にすでに出ている答えと同じもの）。
  // これで surprise は必ず「想定どおり」になる。それは劣化ではなく、
  // 圧力の指標を「結果が読めないこと」から「正解が少ないこと」へ移した結果である（P9）。
  const prediction = rules.deterministic ? machinePrediction(rules) : pendingPrediction;
  const result = act({
    type: "battle", prediction, worry: pendingWorry,
    worryText: pendingGrip ? `手応え:${pendingGrip}` : ""
  });
  if (!result.ok) return;
  // 自己最高の更新。**更新できなくても何も失わない。** 罰ではなく志なので。
  const battle = result.battle;
  if (battle && battle.grade) {
    lastBestBeaten = recordBest(session.ruleset, battle.enemy, battle.grade, battle.cycles);
  }
  lastPreviewSignature = null;
  pendingPrediction = null;
  pendingGrip = null;
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
      textContent: b.won
        ? `${b.grade ? `${b.grade.label}` : "勝利"}（残HP ${b.hpAfter}）${lastBestBeaten ? " ・ 自己最高を更新" : ""} — 次へ`
        : "敗北 — 結果を見る",
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
          lineBadge(p),
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
  out.push(holdingsCard(o));
  if (o.lastBattle) out.push(lastBattleCard(o.lastBattle));
  return out;
}

// 報酬を選ぶ画面に、いまの手持ちを出す。
//
// 作者が2回続けて同じことを書いた：「相変わらず今の手持ちが見えない。
// 手持ちの部品とシナジーがある部品を優先的に選びたいのだけど。」
// 継電は系統の並びで効くので、**何を持っているかが分からないと報酬を選べない。**
// 記憶の問題ではなく、判断に必要な情報が画面に無いという欠陥である。
function holdingsCard(o) {
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: "いまの手持ち" }));

  const equipped = o.slots.map(s => s.part).filter(Boolean);
  const bench = o.inventory;
  const counts = { strike: 0, guard: 0, service: 0 };
  [...equipped, ...bench].forEach(p => { if (p.line && counts[p.line] !== undefined) counts[p.line] += 1; });
  const summary = Object.entries(counts).filter(([, n]) => n > 0)
    .map(([line, n]) => `${LINE_LABEL[line]}${n}`).join(" ・ ");
  card.append(el("div", { className: "small", textContent: `系統の内訳： ${summary || "なし"}` }));

  const strip = (label, parts) => {
    if (!parts.length) return;
    card.append(el("div", { className: "small", style: "margin-top:8px", textContent: label }));
    const row = el("div", { className: "holding-row" });
    parts.forEach((p, i) => row.append(el("span", {
      className: `holding line-${p.line || "none"}`,
      textContent: `${label === "枠に入っている" ? `${i + 1}:` : ""}${LINE_LABEL[p.line] || ""}${p.name}(周期${p.period ?? 1})`
    })));
    card.append(row);
  };
  strip("枠に入っている", equipped);
  strip("予備", bench);
  return card;
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
  // **面白さと継続は別物である。** 作者の指摘：
  //   「ゲームとしての面白さはまだ残っていると思います。（略）
  //     もうハイスコアが二度と得られないという張り合いのなさが継続しない最大の理由」
  // これまで1つの数字に混ぜて測っていたので、天井のせいで落ちた点を
  // 「ゲームが面白くなくなった」と読み違えていた。**2つに分ける。**
  form.append(el("label", { className: "field", textContent: "このゲーム自体はまだ面白いか（1〜5）" }));
  const fun = el("select");
  fun.append(el("option", { value: "", textContent: "未選択" }));
  [1, 2, 3, 4, 5].forEach(v => fun.append(el("option", { value: String(v), textContent: String(v) })));
  form.append(fun);
  form.append(el("label", { className: "field", textContent: "もう一度遊びたいか（1〜5）" }));
  const replay = el("select");
  replay.append(el("option", { value: "", textContent: "未選択" }));
  [1, 2, 3, 4, 5].forEach(v => replay.append(el("option", { value: String(v), textContent: String(v) })));
  form.append(replay);
  form.append(el("label", { className: "field", textContent: "面白さと継続が食い違うなら、その理由" }));
  const gapReason = el("input", { type: "text", placeholder: "例：面白いが、記録がもう更新できない" });
  form.append(gapReason);
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
        if (!fun.value) missing.push("まだ面白いか");
        if (!replay.value) missing.push("もう一度遊びたいか");
        if (!pivot.value) missing.push("方針転換");
        if (!settled.value.trim()) missing.push("決着点");
        if (missing.length) { warn.textContent = `未回答：${missing.join(" / ")}`; return; }
        const survey = {
          fun: Number(fun.value), replay: Number(replay.value),
          gapReason: gapReason.value, pivot: pivot.value, settledAt: settled.value.trim(),
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
  selectedPartId = null; selectedSlot = null; pendingPrediction = null; pendingGrip = null; playback = null; message = "";
  persist(); draw();
});
// ゲームの切り替え。URL の ?ruleset= は「まだ何も操作していないセッション」にしか効かず、
// 保存済みセッションのルールが残り続ける。作者はこれで、新しいゲームを開いたつもりで
// 前のゲームを遊んでいた。画面から切り替えられるようにする。
$("#gameButton").addEventListener("click", () => {
  const list = $("#gameChoices");
  const entries = [...Object.entries(RULESETS)];
  if (lawVariants.length) entries.unshift(["laws", { title: `法則機関 / LAWS 0.1（${lawVariants.length}通りの法則の組）` }]);
  list.replaceChildren(...entries.map(([key, rules]) => el("button", {
    className: `btn wide${key === String(session.ruleset).toLowerCase() ? " primary" : ""}`,
    style: "margin-bottom:8px; text-align:left",
    textContent: `${rules.title}${key === String(session.ruleset).toLowerCase() ? "（いま遊んでいる）" : ""}`,
    onclick: () => {
      $("#gameDialog").close();
      if (key === String(session.ruleset).toLowerCase()) return;
      if (!confirm(`${rules.title} を新しく始めますか？（いまのランは記録に残します）`)) return;
      archiveCurrent();
      session = fresh(null, key);
      run = rebuild();
      selectedPartId = null; selectedSlot = null; pendingPrediction = null; pendingGrip = null; playback = null; message = "";
      persist(); draw();
    }
  })));
  $("#gameDialog").showModal();
});
$("#closeGame").addEventListener("click", () => $("#gameDialog").close());

$("#helpButton").addEventListener("click", () => {
  $("#helpBody").replaceChildren(...rulesetOf(session.ruleset).rules.split("\n").map(line => el("div", { textContent: line })));
  $("#helpDialog").showModal();
});
$("#closeHelp").addEventListener("click", () => $("#helpDialog").close());
$("#closeMark").addEventListener("click", () => $("#markDialog").close());

const params = new URLSearchParams(location.search);
const urlSeed = params.get("seed");
const urlRuleset = params.get("ruleset");

// 進行中のランがあるときは URL でルールを乗っ取らない（リロードでランが消える）。
// ただし黙って無視すると、別のゲームを開いたつもりのまま前のゲームを遊ぶことになる。
if (session.actions.length && urlRuleset && urlRuleset.toLowerCase() !== String(session.ruleset).toLowerCase()) {
  message = `URLは ${urlRuleset.toLowerCase()} を指していますが、いま遊んでいるのは ${session.ruleset} です。`
    + "上のバージョン表示から切り替えられます（いまのランは記録に残ります）。";
}

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
