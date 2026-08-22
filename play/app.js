import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { PHASE } from "../core/phase.mjs";
import { RELAY } from "../core/relay.mjs";
import { makeLawRuleset, LAWS as LAW_DEFS, OVERDRIVE } from "../core/laws.mjs";
import { bestPossible } from "../core/best-possible.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { COST_TABLE } from "../core/cost-table.mjs";
import { TRIALS, sideSpec, sideOrder, pickTrial } from "../core/trial.mjs";
import { BUILD } from "../core/build.mjs";
import { ARC } from "../core/arc.mjs";
import { sendRun, uuid } from "../agent-view/sync.js";
import { projectCycles, markFor, firesOfRuleset } from "../core/project.mjs";
import { makeRng } from "../core/rng.mjs";

const RULESETS = { relay: RELAY, phase: PHASE, arc: ARC };

// **代償の版（cost-0.1）。** 法則も敵も laws-0.3 と同じで、暴走だけが足してある。
// 設定そのもの（OVERDRIVE）は core/laws.mjs にある。**画面と検査で同じものを見る。**

// 法則機関は「ルールセット」が固定でない。**毎ラン、事前検証を通った法則の組を引く。**
// 引ける組は core/law-table.mjs にあり、生成条件（T1〜T3）と天井の条件を通ったものだけが載っている。
// つまり「出してよい問題か」の判定が、設計時の作業ではなく機械の一部になっている。
const lawVariants = Array.isArray(LAW_TABLE) ? LAW_TABLE : [];
// **版が違えば表も違う。**
// laws-0.3 の表をそのまま暴走ありで測ったら、16組中15組が壊れた（詰みなしが47〜94%へ）。
// 敵の数値は「ぎりぎり勝てる」ところに置いてあるので、代償を足せばそこから落ちる。
// 代償の版には、暴走ありで調律し直した表を使う（`analysis/tune-laws.mjs --cost`）。
const costVariants = Array.isArray(COST_TABLE) ? COST_TABLE : [];
// いま引くべき表。**セッションの版で決める。**
function variantsOf(session) {
  // 同定の版は laws-0.3 と同じ盤面（伏せているだけ）なので、素の表を使う。
  return String(session && session.ruleset).toLowerCase() === "cost" ? costVariants : lawVariants;
}

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
function pickVariant(seed, played, table = lawVariants) {
  if (!table.length) return null;
  const fresh = table.filter(v => !played.has(v.laws.join("+")));
  const pool = fresh.length ? fresh : table;
  return pool[hashOf(`laws:${seed}`) % pool.length];
}

// 進行中のランが、どの法則で始まったかを突き止める。
//
// **事故の再発防止である。** 未挑戦の組を優先する仕組みを入れたとき、
// セッションに「どの組で始めたか」を書いていなかった。すると再読み込みのたびに
// `pickVariant` が走り、ラン中に記録が増えて「未挑戦の組」が変わるので、
// **別の法則で再生されてランが壊れた**（作者の進行中のランが第1戦で終了した）。
//
// 記録済みの試行（preview）には、**元の法則で計算した結果**が入っている。
// 候補の法則で同じ並びを引き直し、結果が一致する組を探せば、元の組が分かる。
let ambiguousVariants = [];

function inferVariant(saved, table = lawVariants) {
  const actions = saved.actions || [];
  if (!actions.length || !table.length) return null;
  const scored = [];
  table.forEach(variant => {
    const rules = makeLawRuleset(variant.laws, variant.scales, variant.atkScales, variant.modScales, variant.cycleCaps);
    const probe = createRun({ seed: saved.seed, playerId: saved.playerId, ruleset: rules });
    let accepted = 0;
    let matched = 0;
    let checked = 0;
    for (const action of actions) {
      if (action.type === "preview" && action.signature) {
        const o = probe.observe();
        const enemy = rules.ENEMIES[o.battleNumber - 1] || rules.ENEMIES[rules.ENEMIES.length - 1];
        const slots = String(action.signature).split(",")
          .map((type, i) => (type === "-" ? null : { id: `r${i}`, type }));
        if (enemy && slots.some(Boolean)) {
          const r = rules.simulateBattle({ slots, hp: o.hp, maxHp: o.maxHp, enemy, rng: makeRng(1) });
          checked += 1;
          if (r.won === Boolean(action.won) && r.hp === action.hp && r.cycles === action.cycles) matched += 1;
        }
      }
      if (!probe.act(action).ok) break;
      accepted += 1;
    }
    // **本物の法則なら、記録された操作は全部通る。** 途中で弾かれるのは別の法則である証拠。
    // 試行の結果の一致は、それでも並ぶ候補を分けるための second key。
    scored.push({ variant, accepted, rate: checked ? matched / checked : 0 });
  });
  // **並んだら選ばない。** 2つの候補が同じだけ辻褄を合わせることがあり（作者の記録で実際に起きた）、
  // 先に見つけた方を採ると、進行は戻るのに法則だけ別物になる。
  const full = scored.filter(x => x.accepted === actions.length);
  if (!full.length) return null;
  const top = Math.max(...full.map(x => x.rate));
  const winners = full.filter(x => x.rate >= top - 1e-9);
  ambiguousVariants = winners.length > 1 ? winners.map(x => x.variant) : [];
  return winners.length === 1 ? winners[0].variant : null;
}

// 対の試行。**2本続けて遊んで、どちらが良かったかを選んでもらう。**
//
// なぜ対か：絶対評価（1〜5）は遊んだ回数とともに単調に下がることが分かっている
// （RELAY 5→4→3→3→2→1）。**版をまたぐ絶対比較は順序効果と交絡している。**
// 同じ日に続けて2本遊べば、減衰していく量でも差は見える。
// どちらがどちらかは伏せる。出す順序は種で入れ替える。
function trialRulesetFor(session) {
  const spec = sideSpec(session.trial.id, session.trial.side);
  return makeLawRuleset(spec.laws, spec.scales, spec.atkScales, spec.modScales, spec.cycleCaps,
    { phaseless: spec.phaseless, gradeBy: spec.gradeBy, enemyCount: spec.enemyCount });
}

function lawRulesetFor(session, options = {}) {
  const table = variantsOf(session);
  // 復旧用の指定。?laws=relay+balance のように渡すと、**進行を保ったまま法則だけ差し替える。**
  // 推定が2候補で並んだとき、人が知っている答えを入れるための口である。
  //
  // **区切りは何でも受ける。** URLSearchParams は `+` を空白として復号するので、
  // 上に書いてある `?laws=relay+balance` をそのまま貼ると `"relay balance"` になり、
  // どの組にも一致せず**黙って何も起きない**。事故のために置いた出口が、事故の形で壊れていた。
  const raw = new URLSearchParams(location.search).get("laws");
  const key = ids => [...ids].sort().join("+");
  const forced = raw ? key(raw.split(/[+,\s]+/).filter(Boolean)) : null;
  if (forced) {
    const hit = table.find(v => key(v.laws) === forced);
    if (hit && session.variant !== hit.laws.join("+")) {
      session.variant = hit.laws.join("+");
      session.variantSpec = { laws: hit.laws, scales: hit.scales, atkScales: hit.atkScales, modScales: hit.modScales, cycleCaps: hit.cycleCaps };
    }
  }
  // 決めた法則はセッションに焼き付ける。**表が変わっても、進行中のランは同じ規則で再生される。**
  const spec = session.variantSpec;
  if (spec && spec.laws) return makeLawRuleset(spec.laws, spec.scales, spec.atkScales, spec.modScales, spec.cycleCaps, options);
  const byId = session.variant && table.find(v => v.laws.join("+") === session.variant);
  const chosen = byId || inferVariant(session, table) || pickVariant(session.seed, new Set(), table);
  if (!chosen) return RELAY;
  session.variant = chosen.laws.join("+");
  session.variantSpec = { laws: chosen.laws, scales: chosen.scales, atkScales: chosen.atkScales, modScales: chosen.modScales, cycleCaps: chosen.cycleCaps };
  return makeLawRuleset(chosen.laws, chosen.scales, chosen.atkScales, chosen.modScales, chosen.cycleCaps, options);
}

const SAVE_KEY = "garakuta-play-session";
const ARCHIVE_KEY = "garakuta-play-finished";
const BEST_KEY = "garakuta-play-bests";
const MAX_ARCHIVE = 12;
const LAWS_BY_ID = Object.fromEntries(Object.entries(LAW_DEFS).map(([id, l]) => [id, l.name]));
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
// 法則を突き止めた／選んだ結果をすぐ書き戻す。書かないと次の再読み込みでまた選び直しになる。
try { persist(); } catch (_) { /* 保存できなくても遊べる */ }
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
  if (session && session.trial) return trialRulesetFor(session);
  const key = String(name || defaultRuleset()).toLowerCase();
  if (key === "laws") return lawRulesetFor(session);
  if (key === "cost") return lawRulesetFor(session, { overdrive: OVERDRIVE });
  if (key === "ident") return lawRulesetFor(session, { hidden: true });
  if (key === "skip") return lawRulesetFor(session, { skipWins: true });
  return RULESETS[key] || RELAY;
}

function load() {
  let saved = null;
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (raw?.seed !== undefined && Array.isArray(raw.actions)) saved = raw;
  } catch (_) {}

  // **URL が指した対と、保存されている対が違うなら、指された方を始める。**
  //
  // ここを見ていなかったせいで、t3 のセッションが残った状態で ?trial=t2 を開くと
  // **t3 が続いていた。**作者は t2 を遊んだつもりで3組とも t3 を遊んでいる（2026-08-22）。
  // 実験の取り違えは、記録を汚すだけでなく**作者の時間を丸ごと無駄にする。**
  //
  // 同じ対を指しているときは何もしない（ラン途中のリロードで進行を壊さないため）。
  // ?study で来たときは、遊びかけの対があればそれを続ける（毎回引き直すと組が完成しない）。
  const params = new URLSearchParams(location.search);
  const studyMode = params.has("study") && !TRIALS[params.get("trial")];
  // **終わった組はもう続けない。**続けると同じ対ばかり貯まって、割り振りの意味が消える。
  const unfinished = saved?.trial && !(saved.trial.stage === 1 && saved.survey?.better);
  const wanted = studyMode
    ? (unfinished ? saved.trial.id : wantedTrial())
    : params.get("trial");
  if (wanted && TRIALS[wanted] && saved && saved.trial?.id !== wanted) {
    // 捨てる前に控えを取る。**遊んだものは、途中でも残す。**
    try {
      const archive = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || [];
      if (Array.isArray(archive) && saved.actions.length) {
        archive.push(saved);
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive.slice(-MAX_ARCHIVE)));
      }
    } catch (_) {}
    return fresh();
  }
  // **URL が別の版を指しているなら、その版を始める。**
  //
  // ここは対（`?trial=`）で一度やった事故と、まったく同じ形である。
  // 保存済みセッションがあると `?ruleset=` は黙って無視され、
  // **作者は新しいゲームを開いたつもりで前のゲームを遊ぶ。**
  // 画面の切り替えを足したときに「URL は効かない」と注記して済ませたが、
  // 注記は事故を防がない。今夜 `?ruleset=cost` `?ruleset=ident` `?ruleset=skip` を
  // 渡すので、**渡す前に直す。**
  //
  // 同じ版を指しているときは何もしない（ラン途中のリロードで進行を壊さないため）。
  const wantedRuleset = params.get("ruleset");
  if (wantedRuleset && saved && !saved.trial
      && String(saved.ruleset).toLowerCase() !== wantedRuleset.toLowerCase()) {
    try {
      const archive = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || [];
      if (Array.isArray(archive) && saved.actions.length) {
        archive.push(saved);
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive.slice(-MAX_ARCHIVE)));
      }
    } catch (_) {}
    return fresh(null, wantedRuleset);
  }

  // 逆に、対を指していないのに対のセッションが残っているときは、そのまま続ける
  // （対の2本目の途中でリロードしても壊れないように）。
  return saved || fresh();
}

// その対を、これまでに何組**終えた**か。控えの中で stage 1（2本目）を終えた数を数える。
function trialPairsDone(trialId) { return donePerTrial()[trialId] || 0; }

function donePerTrial() {
  const out = {};
  try {
    const archive = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || [];
    if (Array.isArray(archive)) {
      archive.forEach(x => {
        if (x.trial?.stage === 1 && x.survey?.better) out[x.trial.id] = (out[x.trial.id] || 0) + 1;
      });
    }
  } catch (_) {}
  return out;
}

// URL から対を決める。
//   ?study        … **機械が割り振る**（作者はこれを使う。何を検証中か分からない）
//   ?trial=<id>   … 名指し（私の検証用。目隠しが壊れるので作者には渡さない）
function wantedTrial() {
  const params = new URLSearchParams(location.search);
  const named = params.get("trial");
  if (named && TRIALS[named]) return named;
  if (params.has("study") || named === "" || named === "1") return pickTrial(donePerTrial());
  return null;
}

function fresh(seed = null, ruleset = null, trial = null) {
  const params = new URLSearchParams(location.search);
  const trialId = trial ? trial.id : wantedTrial();
  const name = ruleset || params.get("ruleset") || defaultRuleset();
  const chosenSeed = seed === null ? Math.floor(Math.random() * 100000) : seed;
  if (trialId && TRIALS[trialId]) {
    // 1本目は種で順序を決める。2本目は1本目から引き継ぐ。
    // **その対を何組目に遊ぶかで、出す順を厳密に交互にする。**
    // 種任せだと偏る（実際に3組とも同じ順序になった）。控えから数える。
    const done = trialPairsDone(trialId);
    const state = trial || { id: trialId, trialId: uuid(), stage: 0, pairIndex: done,
      order: sideOrder(trialId, done), seed: chosenSeed };
    return {
      runId: uuid(), ruleset: "laws", seed: chosenSeed, playerId: "human-play", head: "play",
      startedAt: new Date().toISOString(), actions: [], survey: null,
      trial: { ...state, side: state.order[state.stage] }
    };
  }
  // **未挑戦の組を選ぶのは、ランを始めるこの瞬間だけ。**
  // 以後は焼き付けた組を使う。ラン中に記録が増えても選び直さない。
  const played = new Set(Object.keys(loadBests()).map(key => key.split(":")[1]).filter(Boolean));
  const variant = name === "laws" ? pickVariant(chosenSeed, played) : null;
  return {
    runId: uuid(),
    ruleset: name,
    variant: variant ? variant.laws.join("+") : undefined,
    variantSpec: variant ? { laws: variant.laws, scales: variant.scales, atkScales: variant.atkScales, modScales: variant.modScales, cycleCaps: variant.cycleCaps } : undefined,
    seed: chosenSeed,
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
    // **暴走を巡回ごとに拾う。**代償の版で決めるのは「この巡回にどれだけ出すか」なので、
    // 押したあとの一行ではなく、並べている表に出ていないといけない。
    overdrive: blank(),
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
    } else if (entry.part === "暴走") {
      out.overdrive[c - 1] += (entry.hpDamage || 0) + (entry.blocked || 0);
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
        // 法則で作動周期が変わることがある（倍速）。基本の周期で描くと、表と実機がずれる。
        const period = part ? (rules.periodOf ? rules.periodOf(part) : part.period || 1) : 1;
        const fires = part && firesOfRuleset(rules)(c, i, period);
        const value = entry ? (entry.damage || entry.shieldGained || entry.healed || 0) : 0;
        const defensive = entry ? Boolean(entry.shieldGained) : (part && isDefensive(part));
        const gain = entry && entry.gain !== undefined && entry.gain !== 1 ? entry.gain : null;
        const cell = el("div", {
          className: `cell${fires ? " fire" : ""}${defensive && fires ? " def" : ""}`
            + `${gain > 1 ? " relay" : ""}${gain && gain < 1 ? " damped" : ""}`
            + `${defensive && fires && enemyHits(c) ? " aligned" : ""}`
        });
        if (entry) {
          cell.append(el("span", { className: "cell-value", textContent: String(value || "·") }));
          // 倍率を数字の横に出す。**法則は毎ラン変わるので、
          // 説明文を読んで覚えるより、効いているのを見て分かる方が速い。**
          if (gain) cell.append(el("span", { className: "cell-gain", textContent: `×${gain}` }));
        } else {
          cell.textContent = fires && c <= trace.cycles ? "·" : "";
        }
        grid.append(cell);
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
    if (rules.overdrive) row("暴走", trace.overdrive);
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
      const fires = part && firesOfRuleset(rules)(c, i, part.period || 1);
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
  // **規則の版と build の印は別物である。**
  // 規則の版（laws-0.2）は規則を変えたときだけ動くので、
  // 「さっき公開したものが届いているか」の確認には使えない。
  // build の印は公開のたびに変わるので、そちらで見分ける。
  // **伏せた版では、見出しに法則を出さない。**
  // `rules.id` は `ident-0.1:reflect+monotony` の形で、**答えがそのまま書いてあった。**
  $("#gameButton").textContent = rules.publicId || rules.id;
  $("#build").textContent = BUILD;
  document.title = `${rules.title.split(" / ")[0]}（${rules.publicId || rules.id}）`;
  $("#wave").textContent = o.done
    ? (o.won ? `全${o.totalBattles}戦を突破` : `第${o.battleNumber}戦で停止`)
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
  const named = new Set(session.identified || []);
  card.append(el("h2", { textContent: rules.hidden ? "このランの法則（不明）" : "このランの法則" }));

  rules.laws.forEach(law => {
    // **同定の版では、当てるまで名前も説明も出さない。**
    // 手がかりは伏せていない：位相表は作動巡回を描くし、予告は実機の結果を出す。
    // 素の値と実際の差を読めば、どの法則が効いているかは**分かる。**
    // 分からないのではなく、**まだ確かめていない**という状態にしてある。
    const known = !rules.hidden || named.has(law.id);
    card.append(el("div", { className: "law" }, [
      el("span", { className: "law-name", textContent: known ? law.name : "？？？" }),
      el("span", { className: "law-desc",
        textContent: known ? law.desc : "並べて、予告の数字が素の合計とどうずれるかを見る" })
    ]));
  });

  // **版が足した規則も、ここに出す。**遊び方の画面を開かないと読めないのでは、
  // 並べている最中に効いてくる規則としては遅い。
  if (rules.overdriveHint) {
    card.append(el("div", { className: "law" }, [
      el("span", { className: "law-name", textContent: "暴走" }),
      el("span", { className: "law-desc", textContent: rules.overdriveHint })
    ]));
  }

  if (rules.hidden) {
    const unknown = rules.laws.filter(l => !named.has(l.id));
    if (unknown.length) {
      const row = el("div", { className: "actions", style: "margin-top:10px" });
      row.append(el("button", {
        className: "btn wide", textContent: "法則を当てる",
        onclick: () => openGuess(rules, unknown)
      }));
      card.append(row);
      card.append(el("div", { className: "small", style: "margin-top:6px",
        textContent: "外しても罰は無い。何度でも言える。" }));
    } else {
      card.append(el("div", { className: "small", style: "margin-top:6px",
        textContent: "2つとも当てた。" }));
    }
  } else {
    card.append(el("div", { className: "small", style: "margin-top:6px",
      textContent: "法則はランごとに変わる。組が変われば、最適な並びも狙える記録も別物になる。" }));
  }
  return card;
}

// 当てる画面。**13件から選ぶ。**当てずっぽうでも 2/13 なので、
// 手がかりを読む方が早い。外しても罰は無い（等級と同じで、罰ではなく志）。
function openGuess(rules, unknown) {
  const ids = Object.keys(LAW_DEFS);
  const list = $("#gameChoices");
  list.replaceChildren(...ids.map(id => el("button", {
    className: "btn wide", style: "margin-bottom:6px; text-align:left",
    textContent: `${LAW_DEFS[id].name} — ${LAW_DEFS[id].desc}`,
    onclick: () => {
      const hit = unknown.find(l => l.id === id);
      session.identified = [...(session.identified || []), ...(hit ? [id] : [])];
      session.guesses = (session.guesses || 0) + 1;
      message = hit ? `当たり。${LAW_DEFS[id].name}だった。` : "違う。もう一度どうぞ。";
      $("#gameDialog").close();
      persist(); draw();
    }
  })));
  $("#gameDialog").showModal();
}

// 推定が並んだときは、黙って決めずに訊く。
// 進行は正しく戻っているのに法則だけ別物、という直しにくい状態を作らないため。
function ambiguityCard() {
  if (ambiguousVariants.length < 2) return null;
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: "どちらの法則で遊んでいましたか" }));
  card.append(el("div", { className: "small",
    textContent: "再読み込みで法則を突き止めましたが、記録からは次のどれかまでしか絞れませんでした。"
      + "進行はそのままで、法則だけ差し替えます。" }));
  ambiguousVariants.forEach(variant => {
    const id = variant.laws.join("+");
    card.append(el("button", {
      className: `btn wide${session.variant === id ? " primary" : ""}`,
      style: "margin-top:8px; text-align:left",
      textContent: `${variant.name}${session.variant === id ? "（いま選ばれている）" : ""}`,
      onclick: () => {
        session.variant = id;
        session.variantSpec = { laws: variant.laws, scales: variant.scales, atkScales: variant.atkScales, modScales: variant.modScales, cycleCaps: variant.cycleCaps };
        ambiguousVariants = [];
        run = rebuild();
        persist();
        draw();
      }
    }));
  });
  return card;
}

function buildScreen(o) {
  const out = [statusCard(o), ambiguityCard(), lawsCard(), enemyCard(o)].filter(Boolean);

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
    const grade = rules.gradeFor ? rules.gradeFor(first.won, lost, first.cycles) : null;
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
    // **暴走は、押す前に見えていなければならない。**
    // 見えない代償は代償ではなく事故で、MAT 0.2 の「負けた理由が分からない」に戻る。
    // 予告は実機の `simulateBattle` を回しているので、log からそのまま拾える。
    if (rules.overdrive) {
      const od = (first.log || []).filter(e => e.part === "暴走");
      const selfHit = od.reduce((n, e) => n + (e.hpDamage || 0), 0);
      const held = od.reduce((n, e) => n + (e.blocked || 0), 0);
      box.append(el("div", {
        className: "small",
        textContent: od.length
          ? `暴走 ${od.length}回 ・ 遮蔽で${held}受け止め、HPへ${selfHit}`
          : "暴走なし（どの巡回も閾値を超えていない）"
      }));
    }
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
  const rules = rulesetOf(session.ruleset);
  const cycles = gridCycles(rules);
  const fires = firesOfRuleset(rules);
  if (period === 1) return "毎巡";
  const list = [];
  for (let c = 1; c <= cycles && list.length < 3; c += 1) if (fires(c, slotIndex, period)) list.push(c);
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
  // 手で戦ったら連鎖は切れる。**連鎖は「触らずに勝てた回数」である。**
  session.streak = 0;
  session.lastSkips = [];
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

// **連勝を褒めて、戦闘を飛ばす**（作者の提案、`agents/HYPOTHESIS_TESTING.md` 0.5）。
//
// 「同じ構成でそのまま次も勝てる」は、これまで**つまらなさの代名詞**だった。
// 作者の着想は、それを潰すのではなく**褒める**こと。
//   「ゲーム的に明示的な報酬を与えるのではなく、単に戦闘をスキップするだけにして、
//     時間の節約という報酬を与えるといいかもしれません」
//
// だから**ゲーム内の報酬は無い。**浮くのは時間だけである。
//
// 条件は「そのままで**勝てる**」（無傷までは求めない）。無傷を条件にすると滅多に起きない。
//
// **頻度は実測した：20%**（`analysis/smoke-skip.mjs`、勝てる並びで抜けた30局面のうち6）。
// 6戦のランで1回起きるかどうかで、**2連鎖は4%。**
// 最初に別の測定（`carryover-wins.mjs` の45%）から「2連鎖20%・3連鎖9%」と書いたが、
// **あちらは「無傷の並びを持ち越したとき」の数字で、ここの条件とは母集団が違った。**
// 実際に出す条件で測り直したのが上の20%である。
// つまり **「N strike!」はほぼ 1 strike! にしかならない。**そこは承知で出す。
//
// **失ったHPはそのまま適用する。**飛ばすのは操作であって、結果ではない。
// 隠して得をさせると、それは時間の節約ではなく難度の低下になる。
// 飛ばせるあいだ飛ばす。**上限を置く。**
// `trySkip` が「成功したのに戦闘が進まない」状態になったら無限ループになり、
// 作者のブラウザが固まる。全戦闘数より多く回る道理が無い。
function runSkips() {
  const rules = rulesetOf(session.ruleset);
  if (!rules.skipWins) return;
  session.lastSkips = [];
  let skipped = 0;
  const limit = rules.ENEMIES.length + 1;
  while (skipped < limit && trySkip()) skipped += 1;
  if (skipped) persist();
}

function trySkip() {
  const rules = rulesetOf(session.ruleset);
  if (!rules.skipWins) return false;
  const o = run.observe();
  if (o.finished) return false;
  const slots = o.slots.map(x => (x.part ? { id: x.part.id, type: x.part.type } : null));
  if (!slots.some(Boolean)) return false;
  const enemy = rules.ENEMIES[o.battleNumber - 1];
  if (!enemy) return false;
  const r = rules.simulateBattle({ slots, hp: o.hp, maxHp: o.maxHp, enemy, rng: makeRng(1) });
  if (!r.won) return false;
  // **同じ操作を、機械が代わりに押す。**記録に残る操作は本物のままなので、再生も壊れない。
  const res = run.act({ type: "battle", prediction: machinePrediction(rules),
    worry: "なし", worryText: "手応え:skip" });
  if (!res.ok) return false;
  if (res.battle && res.battle.grade) recordBest(session.ruleset, res.battle.enemy, res.battle.grade, res.battle.cycles);
  session.streak = (session.streak || 0) + 1;
  // **何が起きたかを残す。**飛ばした戦闘は見ていないので、
  // 結果を出さないと「知らないうちに報酬画面に居る」だけになる。
  const note = { enemy: res.battle.enemy, cycles: res.battle.cycles,
    hpAfter: res.battle.hpAfter, grade: res.battle.grade ? res.battle.grade.label : "" };
  session.lastSkips = [...(session.lastSkips || []), note];
  // **画面用の控えは手で戦うと消える。**通報用にはランを通した累積を別に持つ。
  // 消える方だけを送っていたら、飛ばしたことが記録に残らない。
  session.skipLog = [...(session.skipLog || []), { ...note, battleNumber: res.battle.battleNumber }];
  return true;
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

// **飛ばしたことは、画面に出さないと伝わらない。**
//
// `message` は構築画面の「戦う前に」の札にしか出ないので、
// 飛ばした直後（報酬画面）では**見えないまま消えていた。**
// 遊ぶ側からは「知らないうちに次の報酬画面に居る」だけになる。作者の言う爽快さの逆である。
function skipCard() {
  const skips = session.lastSkips || [];
  if (!skips.length) return null;
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: `${session.streak} strike!` }));
  card.append(el("div", { className: "small",
    textContent: `触らずに勝てたので${skips.length}戦飛ばした。浮いた時間が報酬で、ゲーム内の見返りは無い。` }));
  skips.forEach(x => card.append(el("div", {
    textContent: `${x.enemy} — ${x.grade || "勝利"}・${x.cycles}巡・残HP ${x.hpAfter}`
  })));
  return card;
}

/* ---------- 報酬 ---------- */

function rewardScreen(o) {
  const out = [statusCard(o), skipCard()].filter(Boolean);
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: "拾い物 — 1つだけ持って帰れる" }));
  const list = el("div", { className: "parts" });
  o.offer.forEach(item => {
    const p = item.part;
    list.append(el("button", {
      className: "part",
      onclick: () => askUpdate(choice => {
        act({ type: "take", choice: item.choice, reason: "", update: choice, updateText: "" });
        // **飛ばすのは、報酬を取って構築へ戻ってからである。**
        //
        // 最初は戦闘画面を閉じた直後に呼んでいたが、そこはまだ報酬の段階で、
        // 戦闘の操作は受け付けられない（`core/run.mjs` が phase="reward" にする）。
        // `trySkip` は黙って false を返し、**飛ばしは一度も起きなかった。**
        // ブラウザで勝てる並びを組んで通すまで気づかなかった。
        // 報酬は飛ばさない。取る／取らないは遊ぶ側の決定で、時間の節約とは別のものである。
        runSkips();
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

/* ---------- 対の試行の終わり ---------- */

function finishTrialRun(o, survey) {
  session.survey = survey;
  session.endedAt = new Date().toISOString();
  session.trace = run.finish(survey);
  session.metrics = describeRun(session.trace);
  archiveCurrent();
  persist();
  // **1本目も必ず送る。** 送っていなかったせいで、対の片側だけがサーバーへ届き、
  // 2組遊んでもらったのに手元に残ったのは2本だけだった（2026-08-22）。
  // 比べる相手が無ければ、対にした意味が消える。
  // `session` はこの直後に差し替わるので、いまの中身を捕まえて送る。
  const snapshot = JSON.parse(JSON.stringify(session));
  sendRun(snapshot).catch(() => {});
}

// 2本目は push() が状態表示つきで送るので、ここでは送らない（二重送信を避ける）。
function finishTrialRunNoSend(o, survey) {
  session.survey = survey;
  session.endedAt = new Date().toISOString();
  session.trace = run.finish(survey);
  session.metrics = describeRun(session.trace);
  archiveCurrent();
  persist();
}

// 両方の本を、**本人が作った事実だけ**で並べ直す。
//
// 作者：「2ラン連続でしかも結構重いゲームをやってると、1ラン目の感想をわすれます……」
// 忘れられたまま選ばせると、答えは2本目の印象だけで決まり、**対にした意味が消える。**
// 出すのは戦闘の結果・自分が付けたマーカー・1本目のメモだけ。
// こちらの解釈も、どちらが良かったかを匂わせるものも出さない。
function battleLines(battles) {
  // 等級は、控え（trace）では {rank,label} の形、いまのラン（observe）では文字列で来る。
  // 片方だけを想定すると [object Object] が出る。負けたときは等級を出さない（「敗北・敗北」になる）。
  const gradeOf = g => (g && typeof g === "object" ? g.label : g) || null;
  return (battles || []).map(b => {
    const grade = b.won ? gradeOf(b.grade) : null;
    return `第${b.battleNumber}戦 ${b.enemy}：`
      + (b.won ? `${b.cycles}巡で撃破` : "敗北")
      + (b.hpLost ? `・${b.hpLost}失う` : b.won ? "・無傷" : "")
      + (grade ? `・${grade}` : "");
  });
}

function markerLines(actions) {
  return (actions || []).filter(a => a && a.type === "mark" && a.note)
    .map(a => `${(MARKERS.find(m => m[0] === a.kind) || [])[1] || a.kind}：${a.note}`);
}

function recallCard(o) {
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: "この2本で起きたこと" }));
  card.append(el("div", { className: "small",
    textContent: "思い出すための控えです。どちらが良かったかは書いてありません。" }));

  const first = readArchive()
    .filter(x => x.trial?.trialId === session.trial.trialId && x.trial?.stage === 0)
    .slice(-1)[0];

  const box = (label, lawNames, lines, memo, marks) => {
    const b = el("div", { className: "card", style: "margin-top:10px;padding:10px" });
    b.append(el("div", { style: "font-weight:600", textContent: label }));
    if (lawNames) b.append(el("div", { className: "small", textContent: lawNames }));
    lines.forEach(t => b.append(el("div", { className: "small", textContent: t })));
    if (memo) b.append(el("div", { style: "margin-top:6px", textContent: `メモ：${memo}` }));
    marks.forEach(t => b.append(el("div", { className: "small", textContent: t })));
    return b;
  };

  const lawsOf = spec => {
    if (!spec?.laws) return null;
    return spec.laws.map(id => (LAWS_BY_ID[id] || id)).join("＋");
  };

  card.append(box("1本目",
    lawsOf(first?.variantSpec) || (first ? lawsOf(sideSpec(session.trial.id, session.trial.order[0])) : null),
    battleLines(first?.trace?.battles), first?.survey?.memo, markerLines(first?.actions)));
  card.append(box("2本目",
    rulesetOf(session.ruleset).laws.map(l => l.name).join("＋"),
    battleLines(o.battles), null, markerLines(session.actions)));
  return card;
}

// **答え合わせ。その持ち物で、もっと良い等級が取れたのか。**
//
// 作者の提案：「もっといい評価を取れたのか、取れなかったのか。…学びがあると飽きずに楽しめそう」。
// 増強の仮説なので生成条件には入れない。出すのは
//   (a) 取れたのか／取れなかったのか  (b) 最良の値
// **並びそのものは出さない。**探索を奪ううえ、「そのまま勝ててしまう」摩擦に燃料を足す。
//
// **ラン終わりにだけ出す。**戦闘ごとに出すと、教わった型をその場で次戦へ持ち込めてしまう。
function answerCard(o, rules) {
  const battles = (o.battles || []).filter(b => Array.isArray(b.owned) && b.owned.length);
  if (!battles.length) return null;
  const card = el("div", { className: "card" });
  card.append(el("h2", { textContent: "答え合わせ" }));
  card.append(el("div", { className: "small",
    textContent: "その戦闘の持ち物で、どこまで行けたか。並べ方は全部試して調べています。" }));

  let missed = 0;
  battles.forEach(b => {
    const enemy = rules.ENEMIES[b.battleNumber - 1];
    if (!enemy) return;
    const best = bestPossible(rules, b.owned, enemy, b.hpBefore ?? rules.MAX_HP, () => makeRng(1));
    const line = el("div", { style: "margin-top:8px" });
    const yours = b.won ? `${b.grade || "?"}・${b.cycles}巡` : "敗北";
    if (best.rank < 0) {
      line.append(el("div", { textContent: `第${b.battleNumber}戦 ${b.enemy}：あなた ${yours}` }));
      line.append(el("div", { className: "small", textContent: "この持ち物では、どう並べても勝てなかった。" }));
    } else {
      const reached = b.won && (b.gradeRank ?? 0) >= best.rank;
      if (!reached) missed += 1;
      line.append(el("div", { textContent: `第${b.battleNumber}戦 ${b.enemy}：あなた ${yours}` }));
      line.append(el("div", {
        className: "small",
        textContent: reached
          ? `最良に届いていた。（この持ち物での上限は ${best.label}・最短${best.cycles}巡）`
          : `もっと上があった：${best.label}・最短${best.cycles}巡`
      }));
    }
    card.append(line);
  });
  card.append(el("div", { className: "small", style: "margin-top:10px",
    textContent: missed === 0
      ? "全部の戦闘で、その持ち物の上限に届いていました。"
      : `${missed}戦で、まだ上がありました。` }));
  return card;
}

function trialEnd(o) {
  const out = [];
  const stage = session.trial.stage;

  // 1本目：**点数は訊かない。**（付けさせると、2本目でそれを守ろうとして比較が汚れる）
  // ただし**あとで思い出すための1行**は書いてもらう。作者の指摘：
  //   「2ラン連続でしかも結構重いゲームをやってると、1ラン目の感想をわすれます……」
  // 忘れられたら対比較の前提が崩れる。**忘れる方が、引きずられるより悪い。**
  if (stage === 0) {
    const card = el("div", { className: "card" });
    card.append(el("h2", { textContent: "1本目 終わり" }));
    card.append(el("div", { textContent: "続けてもう1本あります。遊び終わってから、二つを比べて答えてもらいます。" }));
    card.append(el("div", { className: "small", style: "margin-top:8px",
      textContent: "※ 二つは規則が少し違います。どこが違うかは、先に言わないでおきます。" }));
    const ans1 = answerCard(o, rulesetOf(session.ruleset));
    if (ans1) out.push(ans1);
    card.append(el("label", { className: "field",
      textContent: "1本目のひとこと（採点ではなく、あとで自分が思い出すためのメモ）" }));
    const memo = el("input", { type: "text", placeholder: "例：削り切れなくて粘った／並べ替えが効いた" });
    card.append(memo);
    card.append(el("div", { className: "actions", style: "margin-top:12px" }, [
      el("button", {
        className: "btn primary wide", textContent: "2本目へ",
        onclick: () => {
          if (!session.survey) {
            finishTrialRun(o, { trialStage: 0, side: session.trial.side, memo: memo.value.trim() });
          }
          const next = { ...session.trial, stage: 1 };
          delete next.side;
          session = fresh(session.trial.seed + 1, null, next);
          run = rebuild();
          message = "";
          persist();
          draw();
        }
      })
    ]));
    out.push(card);
    return out;
  }

  // 2本目：強制選択。**絶対評価は主要指標にしない**（遊んだ回数で単調に下がるため）。
  if (session.survey && session.survey.better) {
    const done = el("div", { className: "card" });
    done.append(el("div", { className: "small", textContent: message || "記録しました。" }));
    const acts = [];
    // **次の組へ、一押しで行けるようにする。**どの対になるかはこちらで決めるので、
    // 遊ぶ側は何を検証中か知らないまま続けられる。
    if (new URLSearchParams(location.search).has("study")) {
      acts.push(el("button", {
        className: "btn primary wide", textContent: "次の組へ",
        onclick: () => {
          archiveCurrent();
          session = fresh();
          run = rebuild();
          selectedPartId = null; selectedSlot = null; pendingPrediction = null;
          pendingGrip = null; playback = null; message = "";
          persist(); draw();
        }
      }));
    }
    acts.push(el("button", { className: "btn wide", textContent: "サーバーへ再送", onclick: () => push() }));
    acts.push(el("button", { className: "btn", textContent: "JSONをコピー", onclick: () => copyJson() }));
    done.append(el("div", { className: "actions", style: "margin-top:10px" }, acts));
    out.push(done);
    return out;
  }

  // **思い出す手がかりを、先に並べる。**
  //
  // 作者：「2ラン連続でしかも結構重いゲームをやってると、1ラン目の感想をわすれます……」
  // 忘れられたまま選ばせると、答えは2本目の印象だけで決まる。**対にした意味が消える。**
  // 出すのは**本人が作った事実だけ**（法則・戦闘ごとの等級と巡回・自分が付けたマーカー・1本目のメモ）。
  // こちらの解釈や、どちらが良かったかを匂わせるものは出さない。
  const ans2 = answerCard(o, rulesetOf(session.ruleset));
  if (ans2) out.push(ans2);
  out.push(recallCard(o));

  const form = el("div", { className: "card" });
  form.append(el("h2", { textContent: "二つを比べて" }));
  form.append(el("div", { className: "small",
    textContent: "1本目と2本目のどちらか、を選んでください。「どちらとも言えない」も答えです。" }));
  const pick = (label, name) => {
    form.append(el("label", { className: "field", textContent: label }));
    const sel = el("select");
    sel.append(el("option", { value: "", textContent: "未選択" }));
    [["1", "1本目"], ["2", "2本目"], ["same", "どちらとも言えない"]]
      .forEach(([v, t]) => sel.append(el("option", { value: v, textContent: t })));
    form.append(sel);
    return sel;
  };
  const better = pick("どちらが面白かったか", "better");
  const again = pick("どちらをもう一度やりたいか", "again");
  form.append(el("label", { className: "field", textContent: "そう感じた理由" }));
  const why = el("input", { type: "text", placeholder: "例：2本目は並べ替えても結果が変わらなかった" });
  form.append(why);
  form.append(el("label", { className: "field", textContent: "二つの違いに気づいたか（気づいたなら、何が違ったか）" }));
  const noticed = el("input", { type: "text", placeholder: "気づかなければ「気づかなかった」" });
  form.append(noticed);
  form.append(el("label", { className: "field", textContent: "一番良かった瞬間（どちらの本かも書いてください）" }));
  const best = el("input", { type: "text" });
  form.append(best);
  form.append(el("label", { className: "field", textContent: "退屈・面倒だったところ" }));
  const friction = el("input", { type: "text" });
  form.append(friction);
  const warn = el("div", { className: "warn" });
  form.append(warn);
  form.append(el("div", { className: "actions", style: "margin-top:12px" }, [
    el("button", {
      className: "btn primary wide", textContent: "記録して送る",
      onclick: () => {
        const missing = [];
        if (!better.value) missing.push("どちらが面白かったか");
        if (!again.value) missing.push("どちらをもう一度やりたいか");
        if (!why.value.trim()) missing.push("理由");
        if (missing.length) { warn.textContent = `未回答：${missing.join(" / ")}`; return; }
        // **どちらが A でどちらが B かは、記録の側だけが知っている。**
        const order = session.trial.order;
        const sideOf = n => (n === "same" ? "same" : order[Number(n) - 1]);
        finishTrialRunNoSend(o, {
          trialId: session.trial.trialId, trial: session.trial.id, trialStage: 1,
          order: order.join(">"), side: session.trial.side,
          better: better.value, betterSide: sideOf(better.value),
          again: again.value, againSide: sideOf(again.value),
          why: why.value, noticed: noticed.value, bestMoment: best.value, friction: friction.value
        });
        message = "送信中…";
        draw();
        push();
      }
    })
  ]));
  out.push(form);
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
  head.append(el("div", { textContent: o.won ? `全${o.totalBattles}戦を突破した。` : `第${o.battleNumber}戦で停止した。` }));
  out.push(head);
  if (o.lastBattle) out.push(lastBattleCard(o.lastBattle));
  if (session.trial) return [...out, ...trialEnd(o)];

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
  if (lawVariants.length) {
    entries.unshift(["skip", { title: "連勝機関 / SKIP 0.1（そのまま勝てる戦闘は飛ばす）" }]);
    entries.unshift(["ident", { title: "同定機関 / IDENT 0.1（法則は伏せてあるが、位相表から一発で読める）" }]);
    entries.unshift(["cost", { title: `代償機関 / COST 0.1（${costVariants.length}通り・速く倒すと自分が削れる）` }]);
    entries.unshift(["laws", { title: `法則機関 / LAWS 0.3（${lawVariants.length}通りの法則の組）` }]);
  }
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
  const body = $("#helpBody");
  body.replaceChildren(...rulesetOf(session.ruleset).rules.split("\n").map(line => el("div", { textContent: line })));

  // **どんな状態でも生の記録を取り出せる口。**
  // 進行中のランが再読み込みで壊れたとき、感情マーカーごと失われかけた。
  // 遊べなくなっても、記録だけは necessarily 取り出せるようにしておく。
  body.append(el("div", { className: "small", style: "margin-top:14px;opacity:.8",
    textContent: "うまく動かないときは、下から生の記録を取り出せます（行動と気持ちの記録が全部入っています）。" }));
  const out = el("textarea", { readOnly: true, rows: 4, style: "width:100%;margin-top:6px;font-size:10px" });
  const status = el("div", { className: "small", style: "margin-top:4px" });
  body.append(el("div", { className: "actions", style: "margin-top:6px" }, [
    el("button", {
      className: "btn", textContent: "生の記録を出す",
      onclick: () => {
        const raw = JSON.stringify({ ...session, bests: loadBests() });
        out.value = raw;
        out.select();
        try {
          navigator.clipboard.writeText(raw);
          status.textContent = `写しました（${raw.length}文字／行動${(session.actions || []).length}件）`;
        } catch (_) {
          status.textContent = "下の枠を長押しして選び、コピーしてください。";
        }
      }
    })
  ]));
  body.append(out);
  body.append(status);
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
