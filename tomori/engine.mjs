export const GAME_VERSION = "tomori-0.1";
export const DAYS = 3;

export const ACTIONS = [
  {
    id: "listen",
    trait: "voice",
    icon: "◌",
    name: "耳をすます",
    promise: "聞こえない声にも、返事を待つ",
    color: "#f5b7d4"
  },
  {
    id: "warm",
    trait: "warmth",
    icon: "✦",
    name: "手のひらを貸す",
    promise: "震えが止まるまで、ここにいる",
    color: "#ffc676"
  },
  {
    id: "look",
    trait: "gaze",
    icon: "◉",
    name: "窓を開ける",
    promise: "知らない夜を、一緒に見る",
    color: "#9bd9e8"
  }
];

export const TRAITS = {
  voice: { name: "声", icon: "◌", color: "#f5b7d4", verb: "返事をする" },
  warmth: { name: "ぬくもり", icon: "✦", color: "#ffc676", verb: "そばにいる" },
  gaze: { name: "まなざし", icon: "◉", color: "#9bd9e8", verb: "遠くを見る" }
};

export const ORIGINS = [
  {
    id: "rain",
    name: "雨の夜",
    icon: "∿",
    color: "#9bd9e8",
    line: "雨上がりの側溝で、濡れた小さな灯りを拾った。",
    flavor: "水たまりの音を、ひとつずつ食べている。"
  },
  {
    id: "station",
    name: "終電のあと",
    icon: "╱",
    color: "#c7b5f5",
    line: "終電のあと、誰もいないホームで小さな灯りが待っていた。",
    flavor: "遠ざかる足音を、まだ帰ってくるものだと思っている。"
  },
  {
    id: "garden",
    name: "眠らない庭",
    icon: "❋",
    color: "#abd99d",
    line: "夜の庭で、花のふりをした小さな灯りが震えていた。",
    flavor: "咲く前の気配を、胸の奥へしまっている。"
  },
  {
    id: "attic",
    name: "屋根裏",
    icon: "⌂",
    color: "#f4b7a9",
    line: "屋根裏の古い箱から、まだ名前のない灯りが転がり出た。",
    flavor: "忘れられたものの匂いを、少しだけ知っている。"
  }
];

export const SCENES = [
  {
    title: "拾った夜",
    kicker: "1日目 / はじめての夜",
    situation: "小さな灯りは、あなたの手の中で三回だけ瞬いた。まだ、何を怖がっているのかも分からない。",
    need: "この子は、まだあなたを知らない。",
    prompt: "最初に、何を渡す？",
    reactions: {
      listen: "あなたが息を止めると、子も止まった。やがて胸の奥から、小さな「ぽ」が一音だけ返った。",
      warm: "手のひらを丸くすると、子はその形を覚えた。震えはまだある。でも、火を消さずにいられた。",
      look: "窓の外を見せると、子は初めて自分から一歩動いた。暗いのに、外には星があった。"
    },
    repeated: {
      listen: "昨日の一音を、今度はあなたの名前のそばに置いた。",
      warm: "昨日の手のひらを思い出し、今度は子の方から近づいてきた。",
      look: "昨日より遠くを見た。窓の向こうにも、帰る場所があるのかもしれない。"
    }
  },
  {
    title: "雨の向こう",
    kicker: "2日目 / 覚えたもの",
    situation: "朝になっても、子は消えなかった。あなたが昨日渡したものが、子の中で小さく光っている。",
    need: "今日は、昨日の記憶をどう使うか決める日だ。",
    prompt: "雨の向こうへ、何を教える？",
    reactions: {
      listen: "子は遠い雨音の中から、ひとつだけ違う音を選んだ。それは、誰かが帰りを待つ音だった。",
      warm: "濡れた窓に触れた子の指先から、消えない輪が広がった。待つことにも、形があるらしい。",
      look: "子は窓を少し開け、雨の向こうを指した。怖がっているのに、見たい気持ちは止まらなかった。"
    },
    repeated: {
      listen: "子は同じ記憶をもう一度鳴らした。今度は、返事を待つ時間まで覚えていた。",
      warm: "子は同じ場所へ戻ってきた。そこが安全だからではなく、あなたと分けたいからだった。",
      look: "子は同じ窓を見た。でも今日は、外へ行く道をあなたにも見せようとした。"
    }
  },
  {
    title: "朝が来る前",
    kicker: "3日目 / 見届ける夜",
    situation: "夜明けが近い。子を作った暗がりが、迎えに来ている。子はもう、最初のようにただ震えてはいない。",
    need: "三日間で覚えたものを、最後に一つだけ使える。",
    prompt: "この子と、どんな朝を選ぶ？",
    reactions: {
      listen: "子は暗がりへ向かって、あなたから受け取った音を返した。遠くで、ひとつずつ灯りがついた。",
      warm: "子は消えかけた暗がりを胸に抱えた。朝は来る。それでも、ここにいた時間は消えない。",
      look: "子は暗がりの先を見つめ、あなたの手を一度だけ握った。それから、まだ誰も知らない道へ歩いた。"
    },
    repeated: {
      listen: "三日分の返事が重なり、子の中で初めて歌になった。",
      warm: "三日分のぬくもりが重なり、子は小さな家のような光になった。",
      look: "三日分の景色が重なり、子は夜の端に新しい道を描いた。"
    }
  }
];

const ENDINGS = {
  voice: {
    id: "voice",
    title: "声を返す子",
    icon: "◌",
    color: "#f5b7d4",
    lead: "子は、夜に落ちた音を拾い集めて、町へ返しに行った。",
    body: "あなたが待ってくれたから、子は返事を急がなくてよかった。朝の町には、昨日まで無かった小さな音が戻っている。",
    next: "次は、声を返さずにそばにいる子も見てみる？",
    alternate: "warm"
  },
  warmth: {
    id: "warmth",
    title: "巣になる子",
    icon: "✦",
    color: "#ffc676",
    lead: "子は、あなたの部屋の隅で小さな巣になった。",
    body: "外へ行けないのではない。消えそうなものを抱える場所を、自分で選んだのだ。夜に帰ると、子の光がひとつ増えている。",
    next: "次は、この子に遠い景色を見せてみる？",
    alternate: "gaze"
  },
  gaze: {
    id: "gaze",
    title: "朝を探す子",
    icon: "◉",
    color: "#9bd9e8",
    lead: "子は、あなたの見たことのない朝を探しに行った。",
    body: "手を放したのに、置いていかれた感じはしなかった。振り返った子の目には、次に会う場所がもう映っていた。",
    next: "次は、子が帰ってこられる場所を作ってみる？",
    alternate: "warmth"
  },
  weave: {
    id: "weave",
    title: "三つ編みの子",
    icon: "✧",
    color: "#d1c3f3",
    lead: "子は、声とぬくもりと景色を、細い光の糸に編み込んだ。",
    body: "ひとつを選べなかったことは、迷いではなかった。子はどれも捨てずに、あなたと夜の間に橋をかけた。",
    next: "次は、ひとつのことだけを深く覚えさせてみる？",
    alternate: "voice"
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function hash(value) {
  let result = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    result ^= text.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function randomRunId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "tomori-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

function resolveSeed(input) {
  if (input === undefined || input === null || input === "") return Math.floor(Math.random() * 1000000000);
  const number = Number(input);
  return Number.isFinite(number) ? Math.floor(number) : hash(input);
}

function originFor(seed) {
  return ORIGINS[hash(seed) % ORIGINS.length];
}

export function actionById(id) {
  return ACTIONS.find(action => action.id === id) || null;
}

export function traitById(id) {
  return TRAITS[id] || null;
}

export function sceneFor(state) {
  return SCENES[Math.min(state.day, SCENES.length - 1)];
}

export function createGame(options = {}) {
  const seed = resolveSeed(options.seed);
  const origin = originFor(seed);
  const name = String(options.name || "").trim().slice(0, 12) || "この子";
  const runId = randomRunId();
  const startedAt = new Date().toISOString();
  const legacy = options.legacy?.title ? {
    title: String(options.legacy.title).slice(0, 80),
    line: String(options.legacy.line || "").slice(0, 240)
  } : null;
  return {
    gameVersion: GAME_VERSION,
    runId,
    name,
    seed,
    origin: { id: origin.id, name: origin.name, icon: origin.icon, color: origin.color },
    startedAt,
    endedAt: null,
    phase: "choice",
    day: 0,
    legacy,
    counts: { voice: 0, warmth: 0, gaze: 0 },
    history: [],
    lastChoice: null,
    pendingReveal: null,
    ending: null,
    survey: null,
    telemetry: { runId, startedAt, events: [], sentAt: null, error: null }
  };
}

export function chooseAction(input, actionId) {
  const state = clone(input);
  const action = actionById(actionId);
  if (state.phase !== "choice") return { ok: false, state: input, error: "今は選べません" };
  if (!action) return { ok: false, state: input, error: "知らない行動です" };
  const repeated = state.lastChoice === action.id;
  const scene = sceneFor(state);
  state.counts[action.trait] += 1;
  state.lastChoice = action.id;
  state.history.push({
    day: state.day + 1,
    actionId: action.id,
    actionName: action.name,
    trait: action.trait,
    repeated,
    reaction: repeated ? scene.repeated[action.id] : scene.reactions[action.id]
  });
  state.pendingReveal = state.history[state.history.length - 1];
  state.phase = "reveal";
  return { ok: true, state };
}

export function resolveEnding(state) {
  const entries = Object.entries(state.counts);
  const max = Math.max(...entries.map(([, count]) => count));
  const leaders = entries.filter(([, count]) => count === max);
  if (leaders.length !== 1 || max < 2) return { ...ENDINGS.weave };
  return { ...ENDINGS[leaders[0][0]] };
}

export function continueDay(input) {
  const state = clone(input);
  if (state.phase !== "reveal") return { ok: false, state: input, error: "今は進めません" };
  if (state.day >= DAYS - 1) {
    state.phase = "result";
    state.endedAt = new Date().toISOString();
    state.ending = resolveEnding(state);
    state.pendingReveal = null;
    return { ok: true, state, ended: true };
  }
  state.day += 1;
  state.phase = "choice";
  state.pendingReveal = null;
  return { ok: true, state, ended: false };
}

export function visibleMemories(state) {
  return state.history.map(entry => ({
    day: entry.day,
    actionId: entry.actionId,
    trait: entry.trait,
    name: traitById(entry.trait).name,
    icon: traitById(entry.trait).icon,
    color: traitById(entry.trait).color
  }));
}

export function summary(state) {
  const ending = state.ending || resolveEnding(state);
  return {
    won: state.phase === "result",
    reached: state.history.length,
    reason: ending.id,
    ending: ending.id,
    counts: { ...state.counts },
    memories: visibleMemories(state),
    origin: state.origin
  };
}

export function nextPossibility(state) {
  const ending = state.ending || resolveEnding(state);
  const trait = traitById(ending.alternate);
  return {
    trait: ending.alternate,
    name: trait?.name || "別の育ち方",
    icon: trait?.icon || "✧",
    color: trait?.color || "#d1c3f3",
    text: ending.next
  };
}

export { ENDINGS };
