// 残響工房 ECHO 0.1
//
// 独立試作。前回の自分の手順が「倒すべき相手」ではなく
// 「書き換えたくなる具体的な足跡」になるかを検証する。

export const VERSION = "echo-0.1";
export const MAX_STAGES = 6;
export const HEAT_LIMIT = 10;

export const SITUATIONS = [
  { id: "bridge", name: "雨の橋", text: "崩れかけた橋の向こうに部品が見える。", pressure: 2, yield: 4 },
  { id: "hole", name: "深い穴", text: "底は見えない。急げば近道になる。", pressure: 3, yield: 5 },
  { id: "lamp", name: "追跡灯", text: "遠くの灯りがこちらを探している。", pressure: 1, yield: 3 },
  { id: "collapse", name: "崩落区画", text: "天井が鳴る。今ならまだ抜けられる。", pressure: 4, yield: 6 },
  { id: "nest", name: "鉄くずの巣", text: "使える部品が多いが、音を立てる。", pressure: 2, yield: 6 },
  { id: "exit", name: "出口の発電機", text: "最後の一手。持ち帰るか、さらに賭けるか。", pressure: 3, yield: 7 }
];

export const ACTIONS = [
  {
    id: "harvest",
    icon: "⛏",
    name: "刈り取る",
    description: "部品を多く得る。熱が状況の圧力ぶん上がる。"
  },
  {
    id: "tune",
    icon: "◌",
    name: "整える",
    description: "少しだけ得て、熱を2下げる。"
  },
  {
    id: "gamble",
    icon: "✦",
    name: "賭ける",
    description: "熱が圧力以下なら大成功。高ければ崩れて小さな利益になる。"
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

function rotateIndex(seed, index) {
  return (normalizedSeed(seed) + index * 7 + index * index) % SITUATIONS.length;
}

function situationFor(state) {
  return SITUATIONS[rotateIndex(state.seed, state.stage)];
}

function initialGhost(ghost) {
  return ghost && Array.isArray(ghost.plan) ? clone(ghost) : null;
}

export function createGame(seed = 12, ghost = null) {
  const state = {
    version: VERSION,
    seed: normalizedSeed(seed),
    stage: 0,
    score: 0,
    heat: 0,
    done: false,
    won: false,
    endReason: null,
    plan: [],
    log: [],
    ghost: initialGhost(ghost),
    telemetry: null,
    survey: null,
    endedAt: null
  };
  state.log.push({ stage: 0, text: "機関を起動した。6区画を抜ける。", kind: "system" });
  return state;
}

export function currentSituation(state) {
  return situationFor(state);
}

export function actionById(actionId) {
  return ACTION_BY_ID[actionId] || null;
}

function finish(state, won, reason) {
  state.done = true;
  state.won = won;
  state.endReason = reason;
  state.endedAt = new Date().toISOString();
}

export function playAction(input, actionId) {
  const state = clone(input);
  if (state.done) return { state, result: { ok: false, message: "この走行は終了しています。" } };
  const action = ACTION_BY_ID[actionId];
  if (!action) return { state, result: { ok: false, message: "その行動はありません。" } };

  const situation = situationFor(state);
  const before = { score: state.score, heat: state.heat };
  let gain = 0;
  let text = "";
  let kind = "neutral";

  if (actionId === "harvest") {
    gain = situation.yield;
    state.heat += situation.pressure;
    text = `部品を${gain}回収。熱が${situation.pressure}上がった。`;
    kind = "good";
  } else if (actionId === "tune") {
    gain = 1;
    state.heat = Math.max(0, state.heat - 2);
    text = "機関を整え、部品を1だけ確保した。熱が2下がった。";
    kind = "safe";
  } else {
    const success = state.heat <= situation.pressure;
    gain = success ? situation.yield + 3 : 2;
    state.heat += success ? situation.pressure + 1 : situation.pressure + 2;
    text = success
      ? `賭けが通った。部品を${gain}得た。`
      : `熱に押し返された。部品を${gain}だけ拾った。`;
    kind = success ? "good" : "danger";
  }

  const ghostAction = state.ghost?.plan?.[state.stage] || null;
  let echo = null;
  let echoBonus = 0;
  if (ghostAction) {
    if (ghostAction === actionId) {
      echo = "echo";
      echoBonus = 1;
      state.heat = Math.max(0, state.heat - 1);
      text += " 前回と同じ手順が残響し、熱が1下がった。";
    } else {
      echo = "rewrite";
      echoBonus = 2;
      text += " 前回と違う手順を書き換え、部品を2得た。";
    }
  }

  state.score += gain + echoBonus;
  state.plan.push(actionId);
  state.log.push({ stage: state.stage, text, kind });
  state.stage += 1;

  if (state.heat > HEAT_LIMIT) {
    finish(state, false, "overheat");
  } else if (state.stage >= MAX_STAGES) {
    finish(state, true, "complete");
  }

  return {
    state,
    result: {
      ok: true,
      actionId,
      actionName: action.name,
      situation,
      before,
      after: { score: state.score, heat: state.heat },
      gain: gain + echoBonus,
      echo,
      text,
      done: state.done
    }
  };
}

export function summary(state) {
  return {
    won: Boolean(state.won),
    score: state.score,
    heat: state.heat,
    stages: state.stage,
    plan: clone(state.plan),
    reason: state.endReason || null,
    previousScore: state.ghost?.score ?? null
  };
}

export function planLabel(plan = []) {
  return plan.map(id => ACTION_BY_ID[id]?.icon || "?").join(" ");
}
