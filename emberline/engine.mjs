// 火走り / EMBERLINE 0.1
//
// 目標は一つだけ：火種を5区画の先にある灯台へ届ける。
// プレイヤーは廃材を選び、4つの穴へ置き、左から動く機関の結果を見る。

export const VERSION = "emberline-0.1";
export const MAX_STAGES = 5;
export const SLOT_COUNT = 4;
export const MAX_HULL = 8;

export const MODULES = [
  {
    id: "wheel",
    icon: "◍",
    name: "小さな車輪",
    role: "starter",
    effect: "推進 +2",
    description: "最初から装着済み。小さいが、必ず前へ進む。",
    color: "#8fd3ff"
  },
  {
    id: "bellows",
    icon: "〰",
    name: "ふいご",
    effect: "推進 +2",
    description: "直前が火花なら、さらに推進 +2。",
    color: "#f6bb73"
  },
  {
    id: "coil",
    icon: "✦",
    name: "火花コイル",
    effect: "火花 +2",
    description: "直前が推進なら、守り +1も作る。",
    color: "#ffd86d"
  },
  {
    id: "ram",
    icon: "◆",
    name: "鉄杭",
    effect: "推進 +2",
    description: "火花1を使うと、さらに推進 +3。空なら熱 +1。",
    color: "#e59b9b"
  },
  {
    id: "mantle",
    icon: "◈",
    name: "苔の外套",
    effect: "守り +2",
    description: "熱があれば、熱−1・守り +1。",
    color: "#9ed39b"
  },
  {
    id: "furnace",
    icon: "♨",
    name: "余熱炉",
    effect: "熱 +2 / 推進 +4",
    description: "火花2を使うと、さらに推進 +3。",
    color: "#ff846f"
  },
  {
    id: "cooler",
    icon: "❄",
    name: "冷却羽",
    effect: "熱−2 / 守り +1",
    description: "冷やした熱1につき、推進 +1。",
    color: "#9de5e8"
  },
  {
    id: "mirror",
    icon: "◐",
    name: "反響鏡",
    effect: "直前の出力を再現",
    description: "直前の推進・守り・火花を半分だけもう一度。",
    color: "#c7a8ed"
  },
  {
    id: "hook",
    icon: "⌁",
    name: "磁気鉤",
    effect: "圧力−1 / 推進 +1",
    description: "直前が守りなら、守り +1も作る。",
    color: "#b5b8c8"
  }
];

export const SCRAP_MODULES = MODULES.filter(module => module.role !== "starter");

export const CHALLENGES = [
  {
    id: "fog",
    icon: "〰",
    name: "霧の峠",
    text: "道が見えない。火花があれば、霧の向こうへ進める。",
    rule: "霧：残った火花も、前進1として数える。",
    need: 4,
    pressure: 1
  },
  {
    id: "gate",
    icon: "▣",
    name: "鉄門",
    text: "古い門が道を塞いでいる。熱を力へ変えられる。",
    rule: "鉄門：火花を使った推進は、追加の前進になる。",
    need: 6,
    pressure: 2
  },
  {
    id: "swarm",
    icon: "⁙",
    name: "音虫の群れ",
    text: "小さな敵が群がる。一度の力を、何度も返したい。",
    rule: "群れ：反響や鉤で生まれた連鎖も、前進になる。",
    need: 7,
    pressure: 3
  },
  {
    id: "mud",
    icon: "≈",
    name: "黒いぬかるみ",
    text: "車輪が沈む。守りを足場へ変えられる。",
    rule: "ぬかるみ：守りが2以上なら、守りも前進になる。",
    need: 8,
    pressure: 3
  },
  {
    id: "beacon",
    icon: "✧",
    name: "灯台の階段",
    text: "最後の坂。火種を灯台の頂上まで運ぶ。",
    rule: "灯台：残った火花は最大3まで、前進になる。",
    need: 10,
    pressure: 4
  }
];

const MODULE_BY_ID = Object.fromEntries(MODULES.map(module => [module.id, module]));
const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map(challenge => [challenge.id, challenge]));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeSeed(seed) {
  const numeric = Number(seed);
  if (!Number.isFinite(numeric)) return 12;
  return Math.abs(Math.floor(numeric)) % 1000000000;
}

function randomFor(seed) {
  let value = (normalizeSeed(seed) ^ 0x9e3779b9) >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}

function moduleById(moduleId) {
  return MODULE_BY_ID[moduleId] || null;
}

export function getModule(moduleId) {
  return moduleById(moduleId);
}

export function getChallenge(challengeId) {
  return CHALLENGE_BY_ID[challengeId] || null;
}

function addLog(ctx, text, kind = "info", moduleId = null) {
  ctx.log.push({ moduleId, text, kind });
}

function addForce(ctx, amount, text, moduleId) {
  ctx.force += amount;
  ctx.last = { type: "force", amount };
  addLog(ctx, `${text}（推進 +${amount}）`, "force", moduleId);
}

function addGuard(ctx, amount, text, moduleId) {
  ctx.guard += amount;
  ctx.last = { type: "guard", amount };
  addLog(ctx, `${text}（守り +${amount}）`, "guard", moduleId);
}

function addSpark(ctx, amount, text, moduleId) {
  ctx.spark = Math.min(8, ctx.spark + amount);
  ctx.last = { type: "spark", amount };
  addLog(ctx, `${text}（火花 +${amount}）`, "spark", moduleId);
}

function addHeat(ctx, amount, text, moduleId) {
  ctx.heat = Math.min(9, Math.max(0, ctx.heat + amount));
  addLog(ctx, `${text}（熱 ${amount >= 0 ? "+" : ""}${amount}）`, "heat", moduleId);
}

function activateModule(ctx, moduleId, index) {
  const module = moduleById(moduleId);
  if (!module) return;
  const prefix = `${index + 1}. ${module.icon}${module.name}`;
  const previous = ctx.last;

  if (moduleId === "wheel") {
    addForce(ctx, 2, `${prefix}が回る`, moduleId);
    return;
  }

  if (moduleId === "bellows") {
    addForce(ctx, 2, `${prefix}が空気を送る`, moduleId);
    if (previous?.type === "spark") addForce(ctx, 2, `${prefix}が火花を押し込む`, moduleId);
    return;
  }

  if (moduleId === "coil") {
    addSpark(ctx, 2, `${prefix}が火花を蓄える`, moduleId);
    if (previous?.type === "force") addGuard(ctx, 1, `${prefix}が推進の余波をまとわせる`, moduleId);
    return;
  }

  if (moduleId === "ram") {
    if (ctx.spark >= 1) {
      ctx.spark -= 1;
      ctx.hotForce += 3;
      addForce(ctx, 5, `${prefix}が火花を食べて貫く`, moduleId);
      addLog(ctx, "火花 1 を使ったので、鉄門では追加の前進になる", "reason", moduleId);
    } else {
      addForce(ctx, 2, `${prefix}が空のまま突く`, moduleId);
      addHeat(ctx, 1, `${prefix}が無理をする`, moduleId);
    }
    return;
  }

  if (moduleId === "mantle") {
    addGuard(ctx, 2, `${prefix}が機関を包む`, moduleId);
    if (ctx.heat > 0) {
      ctx.heat -= 1;
      addGuard(ctx, 1, `${prefix}が余熱を吸う`, moduleId);
      addLog(ctx, "熱 1 を冷ましたので、守りが増えた", "reason", moduleId);
    }
    return;
  }

  if (moduleId === "furnace") {
    addHeat(ctx, 2, `${prefix}が燃える`, moduleId);
    addForce(ctx, 4, `${prefix}が熱を推進へ変える`, moduleId);
    if (ctx.spark >= 2) {
      ctx.spark -= 2;
      ctx.hotForce += 3;
      addForce(ctx, 3, `${prefix}が火花を炉へ落とす`, moduleId);
      addLog(ctx, "火花 2 を使ったので、鉄門では追加の前進になる", "reason", moduleId);
    }
    return;
  }

  if (moduleId === "cooler") {
    const cooled = Math.min(2, ctx.heat);
    ctx.heat -= cooled;
    addGuard(ctx, 1, `${prefix}が機関を冷やす`, moduleId);
    if (cooled > 0) addForce(ctx, cooled, `${prefix}が冷ました熱を押し出す`, moduleId);
    else addLog(ctx, "冷やす熱がなかったので、守りだけが残った", "reason", moduleId);
    return;
  }

  if (moduleId === "mirror") {
    if (!previous) {
      addSpark(ctx, 1, `${prefix}が空の記憶から火花を返す`, moduleId);
      return;
    }
    const amount = Math.max(1, Math.floor(previous.amount / 2));
    ctx.chainCount += 1;
    if (previous.type === "force") addForce(ctx, amount, `${prefix}が直前の推進を返す`, moduleId);
    else if (previous.type === "guard") addGuard(ctx, amount, `${prefix}が直前の守りを返す`, moduleId);
    else addSpark(ctx, amount, `${prefix}が直前の火花を返す`, moduleId);
    addLog(ctx, "反響が生まれたので、群れでは追加の前進になる", "reason", moduleId);
    return;
  }

  if (moduleId === "hook") {
    ctx.pressure = Math.max(0, ctx.pressure - 1);
    ctx.chainCount += 1;
    addForce(ctx, 1, `${prefix}が道を引き寄せる`, moduleId);
    addLog(ctx, "敵の圧力 −1", "reason", moduleId);
    if (previous?.type === "guard") addGuard(ctx, 1, `${prefix}が守りを足場にする`, moduleId);
  }
}

export function simulateStage(slots, challengeInput, sparkStart = 0, heatStart = 0) {
  const challenge = typeof challengeInput === "string" ? getChallenge(challengeInput) : challengeInput;
  if (!challenge) throw new Error("challenge_not_found");

  const ctx = {
    force: 0,
    guard: 0,
    spark: Math.max(0, sparkStart),
    heat: Math.max(0, heatStart),
    pressure: challenge.pressure,
    last: null,
    hotForce: 0,
    chainCount: 0,
    log: []
  };

  (slots || []).forEach((moduleId, index) => {
    if (moduleId) activateModule(ctx, moduleId, index);
  });

  let bonus = 0;
  const bonusReasons = [];
  if (challenge.id === "fog") {
    bonus = ctx.spark;
    if (bonus) bonusReasons.push(`残った火花 ${bonus}`);
  } else if (challenge.id === "gate") {
    bonus = ctx.hotForce;
    if (bonus) bonusReasons.push(`火花を使った推進 ${bonus}`);
  } else if (challenge.id === "swarm") {
    bonus = ctx.chainCount;
    if (bonus) bonusReasons.push(`連鎖 ${bonus}`);
  } else if (challenge.id === "mud") {
    bonus = ctx.guard >= 2 ? ctx.guard : 0;
    if (bonus) bonusReasons.push(`守りからの足場 ${bonus}`);
  } else if (challenge.id === "beacon") {
    bonus = Math.min(3, ctx.spark);
    if (bonus) bonusReasons.push(`火花の補助 ${bonus}`);
  }

  const progress = ctx.force + bonus;
  const cleared = progress >= challenge.need;
  const overheated = ctx.heat > 6;
  const pressureDamage = Math.max(0, ctx.pressure - ctx.guard);
  const damage = pressureDamage + (overheated ? 1 : 0) + (cleared ? 0 : 1);
  if (bonusReasons.length) addLog(ctx, `${challenge.name}の規則：${bonusReasons.join("＋")} → 前進 +${bonus}`, "reason");
  addLog(ctx, cleared ? `前進 ${progress}/${challenge.need}。区画を抜けた。` : `前進 ${progress}/${challenge.need}。足が止まった。`, cleared ? "success" : "fail");
  addLog(ctx, `圧力 ${ctx.pressure} − 守り ${ctx.guard} = ${pressureDamage} 損傷${overheated ? "。過熱で +1" : ""}`, damage ? "damage" : "safe");

  const nextHeat = Math.max(0, ctx.heat - 1 - (overheated ? 2 : 0));
  return {
    challengeId: challenge.id,
    force: ctx.force,
    guard: ctx.guard,
    spark: ctx.spark,
    heat: nextHeat,
    pressure: ctx.pressure,
    progress,
    need: challenge.need,
    damage,
    cleared,
    overheated,
    chainCount: ctx.chainCount,
    bonus,
    bonusReasons,
    log: ctx.log
  };
}

function initialOffers(random, stage) {
  if (stage === 0) return ["bellows", "coil", "ram"];
  return shuffled(SCRAP_MODULES.map(module => module.id), random).slice(0, 3);
}

export function createGame(seed = 12) {
  const normalized = normalizeSeed(seed);
  const random = randomFor(normalized);
  const shuffledLater = shuffled(CHALLENGES.filter(challenge => challenge.id !== "fog" && challenge.id !== "beacon"), random);
  const challenges = ["fog", ...shuffledLater.map(challenge => challenge.id), "beacon"];
  const offersByStage = Array.from({ length: MAX_STAGES }, (_, stage) => initialOffers(random, stage));
  return {
    version: VERSION,
    seed: normalized,
    stage: 0,
    challenges,
    offersByStage,
    slots: ["wheel", null, null, null],
    hull: MAX_HULL,
    spark: 0,
    heat: 0,
    phase: "build",
    ready: false,
    chosenOffer: null,
    stageResult: null,
    history: [],
    done: false,
    won: false,
    endReason: null,
    endedAt: null,
    survey: null,
    telemetry: null
  };
}

function invalidState(state, message) {
  return { state: clone(state), result: { ok: false, message } };
}

export function currentChallenge(state) {
  return getChallenge(state.challenges?.[state.stage]) || CHALLENGES[0];
}

export function currentOffers(state) {
  return (state.offersByStage?.[state.stage] || []).map(id => moduleById(id)).filter(Boolean);
}

export function installModule(input, moduleId, slotIndex) {
  const state = clone(input);
  if (state.done || state.phase !== "build") return invalidState(state, "いまは部品を置けません。");
  if (!currentOffers(state).some(module => module.id === moduleId)) return invalidState(state, "その廃材は今回の提示にありません。");
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SLOT_COUNT) return invalidState(state, "置き場所がありません。");
  const previous = state.slots[slotIndex] || null;
  state.slots[slotIndex] = moduleId;
  state.chosenOffer = { moduleId, slotIndex, replaced: previous };
  state.ready = true;
  return { state, result: { ok: true, moduleId, slotIndex, replaced: previous } };
}

export function skipOffer(input) {
  const state = clone(input);
  if (state.done || state.phase !== "build") return invalidState(state, "いまは見送れません。");
  state.chosenOffer = { moduleId: null, slotIndex: null, replaced: null };
  state.ready = true;
  return { state, result: { ok: true, skipped: true } };
}

export function moveSlot(input, from, to) {
  const state = clone(input);
  if (state.done || state.phase !== "build") return invalidState(state, "いまは順序を変えられません。");
  if (![from, to].every(index => Number.isInteger(index) && index >= 0 && index < SLOT_COUNT)) return invalidState(state, "その穴はありません。");
  [state.slots[from], state.slots[to]] = [state.slots[to], state.slots[from]];
  return { state, result: { ok: true, from, to } };
}

export function removeSlot(input, slotIndex) {
  const state = clone(input);
  if (state.done || state.phase !== "build") return invalidState(state, "いまは部品を外せません。");
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SLOT_COUNT) return invalidState(state, "その穴はありません。");
  if (state.slots[slotIndex] === "wheel") return invalidState(state, "小さな車輪は外せません。");
  state.slots[slotIndex] = null;
  return { state, result: { ok: true, slotIndex } };
}

export function continueAfterBattle(input) {
  const state = clone(input);
  if (state.done || state.phase !== "battle") return invalidState(state, "次の区画へは進めません。");
  state.phase = "build";
  state.stageResult = null;
  state.ready = false;
  return { state, result: { ok: true } };
}

export function runStage(input) {
  const state = clone(input);
  if (state.done || state.phase !== "build") return invalidState(state, "いまは走行できません。");
  if (!state.ready) return invalidState(state, "廃材を拾うか、見送ってから走行してください。");

  const challenge = currentChallenge(state);
  const before = { slots: clone(state.slots), hull: state.hull, spark: state.spark, heat: state.heat };
  const battle = simulateStage(state.slots, challenge, state.spark, state.heat);
  const result = {
    stage: state.stage,
    challengeId: challenge.id,
    challengeName: challenge.name,
    before,
    after: {
      hull: Math.max(0, state.hull - battle.damage),
      spark: battle.spark,
      heat: battle.heat,
      slots: clone(state.slots)
    },
    chosenOffer: clone(state.chosenOffer),
    ...battle
  };

  state.hull = result.after.hull;
  state.spark = result.after.spark;
  state.heat = result.after.heat;
  state.history.push(result);
  state.chosenOffer = null;
  state.ready = false;
  state.stageResult = result;

  if (state.hull <= 0 || state.stage + 1 >= MAX_STAGES) {
    state.done = true;
    state.won = state.hull > 0 && state.history.every(entry => entry.cleared);
    state.endReason = state.won ? "beacon_reached" : state.hull <= 0 ? "hull_broken" : "missed_gate";
    state.endedAt = new Date().toISOString();
    state.phase = "result";
  } else {
    state.stage += 1;
    state.phase = "battle";
  }

  return { state, result: { ok: true, battle: result, done: state.done } };
}

export function summary(state) {
  return {
    won: Boolean(state.won),
    reached: state.history?.length || 0,
    hull: state.hull,
    spark: state.spark,
    heat: state.heat,
    stage: state.stage,
    cleared: (state.history || []).filter(entry => entry.cleared).length,
    challenges: clone(state.challenges || []),
    slots: clone(state.slots || []),
    history: clone(state.history || []),
    reason: state.endReason || null
  };
}

export function slotLabel(slots = []) {
  return slots.map(moduleId => moduleId ? `${moduleById(moduleId)?.icon || "?"}${moduleById(moduleId)?.name || moduleId}` : "空");
}
