// 接ぎ木機関 GRAFT 0.1
//
// これは既存の5枠・法則機関から独立した小型試作です。
// 目的は勝率の最適化ではなく、変異が「数字」ではなく
// 行動のタイミングと順序を変えるかを、実際に遊べる形で確かめることです。

export const VERSION = "graft-0.1";
export const MAX_TURNS = 8;
export const MAX_ENERGY = 6;
export const MAX_HP = 30;
export const RESTORE_AFTER_BATTLE = 10;

export const ACTIONS = [
  {
    id: "charge",
    icon: "⚡",
    name: "充電",
    short: "力を2つ蓄える",
    description: "エネルギーを2得る。攻撃と遮蔽の準備になる。"
  },
  {
    id: "strike",
    icon: "🔧",
    name: "打撃",
    short: "力1で5ダメージ",
    description: "エネルギーを1使い、敵へ5ダメージ。"
  },
  {
    id: "guard",
    icon: "🛡",
    name: "遮蔽",
    short: "力1で7防ぐ",
    description: "エネルギーを1使い、この巡の攻撃を7防ぐ。"
  }
];

export const MUTATIONS = [
  {
    id: "recoil",
    icon: "☄",
    name: "反動",
    short: "効果2倍・次巡は休止",
    description: "この行動の効果が2倍になる。使った次の巡だけ同じ行動を選べない。"
  },
  {
    id: "echo",
    icon: "〰",
    name: "余波",
    short: "半分の効果を次巡へ",
    description: "この行動の半分の効果が、次の巡の開始時にもう一度だけ起きる。"
  },
  {
    id: "handoff",
    icon: "⇢",
    name: "継ぎ火",
    short: "次の別行動を1.5倍",
    description: "この行動の後、次に別の行動を選ぶと、その効果が1.5倍になる。"
  }
];

// 攻撃列は決定的だが、最初から全列は見せない。
// 一度受けた攻撃はログに残るので、理不尽ではなく学習可能な未知になる。
export const ENEMIES = [
  {
    id: "scout",
    name: "巡回ドローン",
    icon: "◈",
    hp: 12,
    attacks: [3, 5, 2, 5, 4, 6, 3, 5],
    trait: "軽い攻撃と重い攻撃が交互に来る。早く壊せば被害を減らせる。"
  },
  {
    id: "press",
    name: "圧縮獣",
    icon: "◆",
    hp: 16,
    attacks: [5, 7, 3, 6, 4, 8, 5, 7],
    trait: "4巡目までに崩せるか、遮蔽で重い攻撃を受け流すか。"
  },
  {
    id: "saw",
    name: "鋸歯炉",
    icon: "▣",
    hp: 20,
    attacks: [6, 4, 8, 5, 7, 3, 8, 5],
    trait: "攻撃が強い。余波や継ぎ火で攻撃の間を作ると楽になる。"
  },
  {
    id: "heart",
    name: "心臓炉",
    icon: "✦",
    hp: 24,
    attacks: [5, 8, 4, 8, 6, 9, 5, 8],
    trait: "最後の機関。速く削るか、守りながら機会を作るか。"
  }
];

const ACTION_BY_ID = Object.fromEntries(ACTIONS.map(x => [x.id, x]));
const MUTATION_BY_ID = Object.fromEntries(MUTATIONS.map(x => [x.id, x]));

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomSeed() {
  return 10000 + ((Date.now() + Math.floor(Math.random() * 90000)) % 90000);
}

function hash(seed, salt = 0) {
  let x = (Number(seed) || 1) >>> 0;
  x = (x ^ ((salt + 1) * 0x9e3779b9)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  return x >>> 0;
}

function enemyAt(index) {
  const source = ENEMIES[Math.max(0, Math.min(ENEMIES.length - 1, index))];
  return { ...copy(source), maxHp: source.hp, attackIndex: 0 };
}

function actionState(mutation = null) {
  return { mutation };
}

function freshOffer(seed, battleIndex) {
  // 2候補は常に異なる。既に使った変異も別の行動へ接ぎ木できる。
  const start = hash(seed, battleIndex + 17) % MUTATIONS.length;
  return [
    MUTATIONS[start].id,
    MUTATIONS[(start + 1 + (hash(seed, battleIndex + 31) % 2)) % MUTATIONS.length].id
  ].filter((id, index, all) => all.indexOf(id) === index);
}

function actionName(id) {
  return ACTION_BY_ID[id]?.name || id;
}

function mutationName(id) {
  return MUTATION_BY_ID[id]?.name || id;
}

function baseEffect(actionId) {
  if (actionId === "charge") return { energy: 2 };
  if (actionId === "strike") return { damage: 5, cost: 1 };
  return { shield: 7, cost: 1 };
}

function scaled(value, multiplier) {
  return Math.max(0, Math.round(value * multiplier));
}

function mutationFor(state, actionId) {
  return state.actions[actionId]?.mutation ? MUTATION_BY_ID[state.actions[actionId].mutation] : null;
}

function effectText(effect) {
  return [
    effect.energy ? `力+${effect.energy}` : "",
    effect.damage ? `攻撃${effect.damage}` : "",
    effect.shield ? `遮蔽${effect.shield}` : ""
  ].filter(Boolean).join("・");
}

function log(state, text, kind = "system") {
  state.log.push({ turn: state.turn, text, kind });
}

function resolveEffect(state, actionId, effect, source, triggerMutation = false) {
  const action = ACTION_BY_ID[actionId];
  if (effect.energy) {
    const before = state.energy;
    state.energy = Math.min(MAX_ENERGY, state.energy + effect.energy);
    log(state, `${source}${action.icon}${action.name}：力 ${before}→${state.energy}`);
  }
  if (effect.damage) {
    const before = state.enemy.hp;
    state.enemy.hp = Math.max(0, state.enemy.hp - effect.damage);
    log(state, `${source}${action.icon}${action.name}：敵HP ${before}→${state.enemy.hp}`, "good");
  }
  if (effect.shield) {
    state.shield += effect.shield;
    log(state, `${source}${action.icon}${action.name}：遮蔽${effect.shield}`, "guard");
  }
  return triggerMutation;
}

function applyActionEffect(state, actionId, triggerMutation) {
  const action = ACTION_BY_ID[actionId];
  const mutation = triggerMutation ? mutationFor(state, actionId) : null;
  const base = baseEffect(actionId);
  const multiplier = mutation?.id === "recoil" ? 2 : 1;
  const effect = {};
  for (const key of ["energy", "damage", "shield"]) {
    if (base[key]) effect[key] = scaled(base[key], multiplier);
  }
  if (base.cost) effect.cost = base.cost;
  if (mutation?.id === "recoil") state.lockedAction = actionId;
  resolveEffect(state, actionId, effect, "手動 ", triggerMutation);
  if (mutation?.id === "echo") {
    const delayed = {};
    for (const key of ["energy", "damage", "shield"]) {
      if (base[key]) delayed[key] = Math.max(1, Math.round(base[key] / 2));
    }
    state.pendingEcho = { actionId, effect: delayed };
    log(state, `${action.icon}${action.name}の余波を次巡へ予約した`, "mutation");
  }
  if (mutation?.id === "handoff") {
    state.handoff = { source: actionId };
    log(state, `${action.icon}${action.name}が継ぎ火を作った。次の別行動が強くなる`, "mutation");
  }
}

function applyHandoff(state, actionId) {
  if (!state.handoff || state.handoff.source === actionId) return false;
  const source = actionName(state.handoff.source);
  const base = baseEffect(actionId);
  const bonus = {};
  for (const key of ["energy", "damage", "shield"]) {
    if (base[key]) bonus[key] = Math.max(1, Math.round(base[key] / 2));
  }
  state.handoff = null;
  resolveEffect(state, actionId, bonus, "継ぎ火 ", false);
  log(state, `${source}→${actionName(actionId)}：継ぎ火が発動`, "mutation");
  return true;
}

function attackNow(state) {
  const raw = state.enemy.attacks[state.enemy.attackIndex % state.enemy.attacks.length];
  const blocked = Math.min(raw, state.shield);
  const incoming = raw - blocked;
  state.enemy.attackIndex += 1;
  state.hp = Math.max(0, state.hp - incoming);
  log(state, `敵の攻撃${raw}：遮蔽${blocked}、HP ${state.hp + incoming}→${state.hp}`, incoming ? "enemy" : "guard");
  state.shield = 0;
}

function finishBattle(state, won, reason = null) {
  const summary = {
    battle: state.battleIndex + 1,
    enemy: state.enemy.name,
    won,
    reason: won ? null : reason,
    turns: state.turn,
    hpBefore: state.battleHpBefore,
    hpAfter: state.hp,
    actions: state.turnActions.slice(),
    mutations: copy(state.actions)
  };
  state.history.push(summary);
  state.lastBattle = summary;
  state.endReason = won ? null : reason;
  if (!won || state.battleIndex >= ENEMIES.length - 1) {
    state.done = true;
    state.phase = "done";
    return;
  }
  state.phase = "reward";
  state.offer = freshOffer(state.seed, state.battleIndex);
  state.nextEnemy = enemyAt(state.battleIndex + 1);
  log(state, `第${state.battleIndex + 1}戦を突破。次の敵は${state.nextEnemy.name}`, "good");
}

function resetBattle(state, nextIndex) {
  state.battleIndex = nextIndex;
  state.enemy = enemyAt(nextIndex);
  state.nextEnemy = null;
  state.turn = 0;
  state.turnActions = [];
  state.energy = Math.min(MAX_ENERGY, state.energy + 1);
  state.shield = 0;
  state.pendingEcho = null;
  state.handoff = null;
  state.lockedAction = null;
  state.endReason = null;
  state.battleHpBefore = state.hp;
  state.phase = "battle";
  state.offer = null;
  state.log = [];
}

export function createGame(seed = null) {
  const numericSeed = Number(seed);
  const actualSeed = seed === null || seed === undefined || seed === ""
    ? randomSeed()
    : (Number.isFinite(numericSeed) ? numericSeed : randomSeed());
  const state = {
    version: VERSION,
    seed: actualSeed,
    phase: "battle",
    done: false,
    battleIndex: 0,
    turn: 0,
    hp: MAX_HP,
    maxHp: MAX_HP,
    energy: 1,
    shield: 0,
    enemy: enemyAt(0),
    nextEnemy: null,
    actions: {
      charge: actionState(),
      strike: actionState(),
      guard: actionState()
    },
    pendingEcho: null,
    handoff: null,
    lockedAction: null,
    offer: null,
    selectedMutation: null,
    battleHpBefore: MAX_HP,
    turnActions: [],
    history: [],
    lastBattle: null,
    endReason: null,
    log: [{ turn: 0, text: "機関が起動した。次の攻撃を見て、行動を選ぶ", kind: "system" }]
  };
  return state;
}

export function actionInfo(state, actionId) {
  const action = ACTION_BY_ID[actionId];
  const mutation = mutationFor(state, actionId);
  const base = baseEffect(actionId);
  const multiplier = mutation?.id === "recoil" ? 2 : 1;
  const effect = {};
  for (const key of ["energy", "damage", "shield"]) {
    if (base[key]) effect[key] = scaled(base[key], multiplier);
  }
  const locked = state.lockedAction === actionId;
  const enough = actionId === "charge" ? state.energy < MAX_ENERGY : state.energy >= 1;
  return {
    ...action,
    mutation,
    effect,
    legal: !locked && enough && !state.done && state.phase === "battle",
    reason: locked ? "反動でこの巡は休止" : (enough ? "" : "力が足りない"),
    effectText: effectText(effect)
  };
}

export function currentIntent(state) {
  if (!state.enemy) return null;
  return state.enemy.attacks[state.enemy.attackIndex % state.enemy.attacks.length];
}

export function playAction(input, actionId) {
  const state = copy(input);
  if (state.done || state.phase !== "battle") return { state: input, ok: false, error: "いまは戦闘中ではない" };
  const info = actionInfo(state, actionId);
  if (!info.legal) return { state: input, ok: false, error: info.reason || "その行動は使えない" };

  state.turn += 1;
  state.turnActions.push(actionId);
  state.shield = 0;
  log(state, `— ${state.turn}巡目 —`, "turn");

  if (state.pendingEcho) {
    const echo = state.pendingEcho;
    state.pendingEcho = null;
    resolveEffect(state, echo.actionId, echo.effect, "余波 ", false);
    if (state.enemy.hp <= 0) {
      log(state, "余波が敵を壊した。手動行動も敵攻撃も起きない", "good");
      finishBattle(state, true);
      return { state, ok: true, battleEnded: true };
    }
  }

  const base = baseEffect(actionId);
  if (base.cost) state.energy -= base.cost;
  const hadHandoff = applyHandoff(state, actionId);
  applyActionEffect(state, actionId, true);
  if (hadHandoff) {
    // 継ぎ火の追加効果は、手動効果と同じ対象へ既に解決されている。
  }
  state.turnActions.push(`resolved:${actionId}`);

  if (state.enemy.hp <= 0) {
    finishBattle(state, true);
    return { state, ok: true, battleEnded: true };
  }

  attackNow(state);
  if (state.hp <= 0) {
    finishBattle(state, false, "hp_zero");
    return { state, ok: true, battleEnded: true };
  }

  // 反動の休止は「次の1巡」だけ。別行動を選んだ時点で解除する。
  if (state.lockedAction && state.lockedAction !== actionId) state.lockedAction = null;
  if (state.turn >= MAX_TURNS) {
    finishBattle(state, false, "turn_limit");
    return { state, ok: true, battleEnded: true };
  }
  return { state, ok: true, battleEnded: false };
}

export function chooseMutation(input, mutationId, targetActionId) {
  const state = copy(input);
  if (state.done || state.phase !== "reward") return { state: input, ok: false, error: "いまは接ぎ木を選ぶ場面ではない" };
  if (!state.offer.includes(mutationId)) return { state: input, ok: false, error: "その変異は今回の候補ではない" };
  if (!ACTION_BY_ID[targetActionId]) return { state: input, ok: false, error: "その行動は存在しない" };
  if (state.actions[targetActionId].mutation) return { state: input, ok: false, error: "その行動には既に変異がある" };
  state.actions[targetActionId].mutation = mutationId;
  state.selectedMutation = { mutationId, targetActionId };
  const m = MUTATION_BY_ID[mutationId];
  const a = ACTION_BY_ID[targetActionId];
  state.log = [{ turn: 0, text: `${m.icon}${m.name}を${a.icon}${a.name}へ接ぎ木した`, kind: "mutation" }];
  state.hp = Math.min(state.maxHp, state.hp + RESTORE_AFTER_BATTLE);
  resetBattle(state, state.battleIndex + 1);
  return { state, ok: true };
}

export function abandon(input) {
  const state = copy(input);
  state.done = true;
  state.phase = "done";
  return state;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(raw) {
  try {
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!state || state.version !== VERSION || !state.enemy || !state.actions) return null;
    return state;
  } catch (_) {
    return null;
  }
}

export function summary(state) {
  return {
    version: state.version,
    seed: state.seed,
    battles: state.history.length,
    won: Boolean(state.done && state.history.length === ENEMIES.length && state.history.every(x => x.won)),
    hp: state.hp,
    mutations: Object.fromEntries(Object.entries(state.actions).map(([id, value]) => [id, value.mutation]))
  };
}

export function describeAction(id) {
  return ACTION_BY_ID[id] || null;
}

export function describeMutation(id) {
  return MUTATION_BY_ID[id] || null;
}
