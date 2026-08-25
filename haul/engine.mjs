// 持ち帰り限界 / HAUL 0.1
//
// ECHOの反証を受けた独立試作。
// 抽象的な得点ではなく、帰還艇を直すための部品を持ち帰る。
// 「安全に回収するか、深く潜って多く取るか」を、危険と船体で読む。

export const VERSION = "haul-0.1";
export const MAX_STAGES = 6;
export const TARGET_CARGO = 7;
export const DANGER_LIMIT = 8;
export const MAX_HULL = 3;

export const SITUATIONS = [
  { id: "anchor", name: "錨鎖区画", text: "古い錨鎖の隙間に、帰還艇の部品が沈んでいる。", threat: 2, yield: 1, deepYield: 3 },
  { id: "flood", name: "浸水ポンプ室", text: "水位が上がっている。急げば奥の箱まで届く。", threat: 1, yield: 1, deepYield: 2 },
  { id: "crack", name: "亀裂回廊", text: "壁の向こうに反応がある。崩落音も近い。", threat: 3, yield: 1, deepYield: 3 },
  { id: "generator", name: "沈んだ発電室", text: "重い発電部品がある。運ぶなら機体を揺らす。", threat: 2, yield: 2, deepYield: 4 },
  { id: "nest", name: "鉄くずの巣", text: "使える部品が多いが、巣の主が戻る前に決めたい。", threat: 4, yield: 1, deepYield: 3 },
  { id: "lock", name: "帰還ロック", text: "最後の区画。ここを抜ければ帰還艇を起動できる。", threat: 2, yield: 2, deepYield: 4 }
];

export const ACTIONS = [
  {
    id: "salvage",
    icon: "⛏",
    name: "回収する",
    description: "見えている部品を取る。危険は区画の脅威ぶん。"
  },
  {
    id: "stabilize",
    icon: "◌",
    name: "安定させる",
    description: "危険を3下げる。部品は増えない。"
  },
  {
    id: "deep",
    icon: "⬇",
    name: "深く潜る",
    description: "多く取れるが、危険を大きく増やす。限界を越えると船体が傷つく。"
  }
];

const ACTION_BY_ID = Object.fromEntries(ACTIONS.map(action => [action.id, action]));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizedSeed(seed) {
  const numeric = Number(seed);
  return Number.isFinite(numeric) ? Math.abs(Math.floor(numeric)) % 100000 : 12;
}

function hash(seed, salt = 0) {
  let value = (Math.imul(normalizedSeed(seed) + 1, 0x45d9f3b) + Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  return value >>> 0;
}

function sequenceFor(seed) {
  return SITUATIONS
    .map((situation, index) => ({ id: situation.id, key: hash(seed, index + 19) }))
    .sort((a, b) => a.key - b.key)
    .map(entry => entry.id);
}

function situationById(id) {
  return SITUATIONS.find(situation => situation.id === id) || SITUATIONS[0];
}

function finish(state, won, reason) {
  state.done = true;
  state.won = won;
  state.endReason = reason;
  state.endedAt = new Date().toISOString();
}

function dangerAfter(state, addedDanger, situation, actionName) {
  state.danger += addedDanger;
  let collapse = false;
  let text = `${actionName}で危険が${addedDanger}増えた。`;
  if (state.danger > DANGER_LIMIT) {
    collapse = true;
    state.hull -= 1;
    state.danger = 4;
    text += ` 限界を越え、${situation.name}が崩れて船体−1。危険は4まで戻った。`;
  }
  return { collapse, text };
}

export function createGame(seed = 12) {
  const normalized = normalizedSeed(seed);
  const state = {
    version: VERSION,
    seed: normalized,
    sequence: sequenceFor(normalized),
    stage: 0,
    cargo: 0,
    danger: 0,
    hull: MAX_HULL,
    done: false,
    won: false,
    endReason: null,
    plan: [],
    log: [],
    telemetry: null,
    survey: null,
    endedAt: null
  };
  state.log.push({ stage: 0, text: `帰還艇の修理に部品${TARGET_CARGO}個が必要だ。6区画を抜ける。`, kind: "system" });
  return state;
}

export function currentSituation(state) {
  return situationById(state.sequence[Math.min(state.stage, MAX_STAGES - 1)]);
}

export function actionById(actionId) {
  return ACTION_BY_ID[actionId] || null;
}

export function playAction(input, actionId) {
  const state = clone(input);
  if (state.done) return { state, result: { ok: false, message: "この潜航は終了しています。" } };
  const action = ACTION_BY_ID[actionId];
  if (!action) return { state, result: { ok: false, message: "その行動はありません。" } };

  const situation = currentSituation(state);
  const before = { cargo: state.cargo, danger: state.danger, hull: state.hull };
  let cargoGain = 0;
  let resultText = "";
  let kind = "neutral";
  let collapse = false;

  if (actionId === "salvage") {
    cargoGain = situation.yield;
    state.cargo += cargoGain;
    const danger = dangerAfter(state, situation.threat, situation, "回収");
    collapse = danger.collapse;
    resultText = `部品を${cargoGain}個回収した。${danger.text}`;
    kind = "good";
  } else if (actionId === "stabilize") {
    const beforeDanger = state.danger;
    state.danger = Math.max(0, state.danger - 3);
    resultText = `機体を安定させた。危険 ${beforeDanger}→${state.danger}。部品は増えない。`;
    kind = "safe";
  } else {
    cargoGain = situation.deepYield;
    state.cargo += cargoGain;
    const danger = dangerAfter(state, situation.threat + 2, situation, "深掘り");
    collapse = danger.collapse;
    resultText = `奥から部品を${cargoGain}個引き上げた。${danger.text}`;
    kind = collapse ? "danger" : "good";
  }

  state.plan.push(actionId);
  state.log.push({ stage: state.stage, text: resultText, kind });
  state.stage += 1;

  if (state.hull <= 0) {
    finish(state, false, "hull_broken");
  } else if (state.stage >= MAX_STAGES) {
    finish(state, state.cargo >= TARGET_CARGO, state.cargo >= TARGET_CARGO ? "returned" : "not_enough_cargo");
  }

  return {
    state,
    result: {
      ok: true,
      actionId,
      actionName: action.name,
      situation,
      before,
      after: { cargo: state.cargo, danger: state.danger, hull: state.hull },
      cargoGain,
      collapse,
      text: resultText,
      done: state.done
    }
  };
}

export function summary(state) {
  return {
    won: Boolean(state.won),
    cargo: state.cargo,
    targetCargo: TARGET_CARGO,
    danger: state.danger,
    hull: state.hull,
    stages: state.stage,
    sequence: clone(state.sequence),
    plan: clone(state.plan),
    reason: state.endReason || null
  };
}

export function planLabel(plan = []) {
  return plan.map(id => ACTION_BY_ID[id]?.icon || "?").join(" ");
}
