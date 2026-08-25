export const GAME_VERSION = "night-eater-0.1";
export const MAX_NIGHTS = 6;
export const SLOT_IDS = ["eye", "heart", "hand"];
export const SLOT_NAMES = { eye: "目", heart: "胸", hand: "手" };

export const NIGHTS = [
  {
    id: "bridge", title: "橋の下", icon: "⌁", need: "returning", threshold: 2,
    question: "誰かの声が、暗い水面から呼んでいる。",
    ask: "声を返す", success: "子は水面へ、小さな返事を落とした。",
    failure: "声は水にほどけ、子の足元だけが濡れた。"
  },
  {
    id: "rubble", title: "崩れた通り", icon: "⌂", need: "hold", threshold: 3,
    question: "道を塞ぐ瓦礫の向こうに、眠った人がいる。",
    ask: "重いものを抱える", success: "子は小さな体で、道に隙間を作った。",
    failure: "瓦礫は動かず、遠くで朝を待つ音だけがした。"
  },
  {
    id: "rain", title: "雨の庭", icon: "∿", need: "warm", threshold: 3,
    question: "消えかけた火を、濡れた花が囲んでいる。",
    ask: "火を分ける", success: "子の胸から、雨の中でも消えない熱がこぼれた。",
    failure: "火は一度だけ明るくなり、雨の奥へ戻った。"
  },
  {
    id: "theater", title: "空っぽの劇場", icon: "◌", need: "look", threshold: 3,
    question: "誰もいない舞台で、まだ終わっていない話が動く。",
    ask: "見えない続きを見つける", success: "子は暗幕の裏の続きを見つけ、あなたへ振り返った。",
    failure: "舞台は静かになった。見えたはずのものが、また隠れた。"
  },
  {
    id: "station", title: "最後の駅", icon: "╱", need: "returning", threshold: 4,
    question: "列車を待つ影が、あなたではなく子を見ている。",
    ask: "選んだことを返す", success: "子は影の手へ、拾ったものを返した。",
    failure: "影は手を引いた。子はまだ、返すものを決められない。"
  },
  {
    id: "lighthouse", title: "灯台", icon: "△", need: "whole", threshold: 7,
    question: "夜の終わり。灯りを誰に渡すか、もう誰も決めてくれない。",
    ask: "最後の灯りを選ぶ", success: "子はあなたの教えを抱えたまま、灯りの方へ歩いた。",
    failure: "子は灯りの前で立ち止まり、あなたの顔を見上げた。"
  }
];

function part(id, name, icon, color, flavor, tags, slots) {
  return { id, name, icon, color, flavor, tags, slots };
}

const s = (look, hold, returning, warm) => ({ look: look || 0, hold: hold || 0, returning: returning || 0, warm: warm || 0 });

export const RELICS = [
  part("lens", "ひびのレンズ", "◉", "#b9e7ff", "見えないものを、少しだけこちらへ寄せる。", ["see", "echo"], {
    eye: s(3, 0, 0, 0), heart: s(1, 0, 1, 0), hand: s(1, 0, 1, 0)
  }),
  part("shell", "眠り貝", "◒", "#f1c7a9", "抱えたものの重さを、忘れない。", ["hold", "quiet"], {
    eye: s(1, 0, 0, 0), heart: s(0, 3, 0, 0), hand: s(0, 2, 0, 0)
  }),
  part("bell", "欠けた鈴", "◔", "#f7dc76", "返事のない場所でも、鳴り方を変えない。", ["echo", "voice"], {
    eye: s(0, 0, 2, 0), heart: s(0, 0, 1, 1), hand: s(0, 0, 3, 0)
  }),
  part("thread", "赤い糸", "⟋", "#ff9e9e", "離れたものを、同じ夜の中へ結ぶ。", ["bind"], {
    eye: s(0, 1, 1, 0), heart: s(0, 1, 1, 0), hand: s(0, 1, 2, 0)
  }),
  part("ember", "消えない火種", "✦", "#ff9b61", "小さいままなら、誰かの手で守れる。", ["heat"], {
    eye: s(1, 0, 0, 0), heart: s(0, 0, 0, 3), hand: s(0, 0, 1, 2)
  }),
  part("thorn", "黒い棘", "✶", "#df9ae9", "痛みを知っているものだけが、引っかけられる。", ["edge"], {
    eye: s(1, 0, 1, 0), heart: s(0, 0, 0, 1), hand: s(0, 0, 3, 0)
  }),
  part("mirror", "裏返しの鏡", "◇", "#c4b2ff", "返したものが、少し違う顔で戻ってくる。", ["echo", "see"], {
    eye: s(2, 0, 1, 0), heart: s(0, 0, 2, 0), hand: s(1, 0, 2, 0)
  }),
  part("key", "曲がった鍵", "⌁", "#b7d2a3", "開く前の扉にも、手をかけてみる。", ["open"], {
    eye: s(2, 0, 0, 0), heart: s(0, 1, 1, 0), hand: s(0, 1, 2, 0)
  }),
  part("feather", "夜鳥の羽", "⌇", "#d5d1ff", "軽いものは、遠くまで見に行ける。", ["light", "soft"], {
    eye: s(1, 0, 0, 0), heart: s(0, 0, 0, 2), hand: s(1, 0, 1, 0)
  }),
  part("seed", "眠らない種", "❋", "#a8e5a5", "土のないところでも、根を探す。", ["grow", "hold"], {
    eye: s(1, 0, 0, 1), heart: s(0, 1, 0, 2), hand: s(0, 2, 0, 0)
  }),
  part("button", "青いボタン", "●", "#80d9e7", "なくしたものの代わりにはならない。でも、手渡せる。", ["tiny", "echo"], {
    eye: s(1, 0, 0, 0), heart: s(0, 1, 0, 0), hand: s(0, 0, 1, 1)
  }),
  part("cup", "欠けたカップ", "∪", "#f4b7c7", "空っぽだから、何かを受け取れる。", ["hold", "receive"], {
    eye: s(1, 0, 0, 0), heart: s(0, 2, 0, 1), hand: s(0, 1, 1, 0)
  })
];

export const PART_BY_ID = Object.fromEntries(RELICS.map(x => [x.id, x]));

function clone(value) {
  return structuredClone(value);
}

function hash(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomRunId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "ne-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

function shuffled(seed) {
  const result = RELICS.map(x => x.id);
  let state = hash(seed) || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state ^ (state >>> 16), 2246822519) + 3266489917) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function partById(id) {
  return PART_BY_ID[id] || null;
}

export function nightOf(state) {
  return NIGHTS[Math.min(state.night, NIGHTS.length - 1)];
}

export function createGame(options = {}) {
  const seed = options.seed === undefined || options.seed === null || options.seed === ""
    ? Math.floor(Math.random() * 1000000000)
    : Number(options.seed);
  const legacy = options.legacy && partById(options.legacy.partId) ? { ...options.legacy } : null;
  const deck = shuffled(Number.isFinite(seed) ? seed : hash(seed));
  if (legacy) deck.unshift(legacy.partId);
  const state = {
    gameVersion: GAME_VERSION,
    runId: randomRunId(),
    seed: Number.isFinite(seed) ? seed : hash(seed),
    startedAt: new Date().toISOString(),
    endedAt: null,
    phase: "build",
    night: 0,
    light: 3,
    bond: 0,
    insight: 0,
    scars: 0,
    parts: [null, "shell", null],
    bag: [],
    discarded: [],
    offer: [],
    deck,
    deckIndex: 0,
    legacy,
    legacyConsumed: false,
    history: [],
    log: ["あなたは、手のひらに収まる子を拾った。"],
    lastOutcome: null,
    endReason: null,
    ending: null,
    telemetry: { runId: randomRunId(), startedAt: new Date().toISOString(), events: [], sentAt: null, error: null },
    survey: null
  };
  return drawOffer(state);
}

function nextDeckId(state) {
  const id = state.deck[state.deckIndex % state.deck.length];
  state.deckIndex += 1;
  return id;
}

export function drawOffer(input) {
  const state = clone(input);
  if (state.phase !== "build" || state.offer.length) return state;
  const offer = [];
  while (offer.length < 2 && state.deckIndex < state.deck.length + 4) {
    const id = nextDeckId(state);
    if (!offer.includes(id)) offer.push(id);
  }
  state.offer = offer;
  if (state.legacy && !state.legacyConsumed) {
    state.legacyConsumed = true;
    state.log.push("前の子が残した「" + partById(state.legacy.partId).name + "」が、夜の入り口に置かれている。");
  }
  return state;
}

function addSkill(target, values) {
  Object.keys(target).forEach(key => { target[key] += values[key] || 0; });
}

export function readBuild(parts) {
  const skills = { look: 0, hold: 0, returning: 0, warm: 0 };
  const traces = [];
  const installed = [];
  SLOT_IDS.forEach((slot, index) => {
    const id = parts[index];
    const current = partById(id);
    if (!current) return;
    installed.push(current);
    addSkill(skills, current.slots[slot]);
    traces.push(SLOT_NAMES[slot] + "の" + current.name + "が「" + primaryVerb(current.slots[slot]) + "」を覚えさせる");
  });
  const tags = installed.flatMap(x => x.tags);
  const has = tag => tags.includes(tag);
  if (has("bind") && installed.length >= 2) {
    skills.hold += 1;
    skills.returning += 1;
    traces.push("赤い糸が、二つの部位を同じ動きへ結ぶ");
  }
  if (tags.filter(x => x === "echo").length >= 2) {
    skills.returning += 2;
    skills.look += 1;
    traces.push("二つの反響が、返事をもう一度返す");
  }
  if (has("heat") && has("hold")) {
    skills.warm += 1;
    traces.push("抱えた熱が、雨に消えない形になる");
  }
  if (has("see") && has("echo")) {
    skills.look += 1;
    skills.returning += 1;
    traces.push("見たものを、別の顔で返す回路が開く");
  }
  if (has("grow") && (skills.warm > 0 || skills.hold > 1)) {
    skills.warm += 1;
    skills.hold += 1;
    traces.push("種が、抱えたものの中で根を張る");
  }
  if (has("edge") && has("bind")) {
    skills.returning += 1;
    traces.push("棘が糸をつかみ、遠いものへ手を伸ばす");
  }
  const behavior = behaviorOf(skills, installed.length, traces.length - installed.length);
  return { skills, traces, behavior, installed: installed.map(x => x.id) };
}

function primaryVerb(values) {
  const entries = [["見る", values.look], ["抱える", values.hold], ["返す", values.returning], ["温める", values.warm]];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] ? entries[0][0] : "待つ";
}

export function behaviorOf(skills, installedCount = 0, resonanceCount = 0) {
  const entries = [
    ["見つける子", skills.look],
    ["抱える子", skills.hold],
    ["返事をする子", skills.returning],
    ["火を分ける子", skills.warm]
  ];
  entries.sort((a, b) => b[1] - a[1]);
  if (resonanceCount >= 2 && installedCount >= 3) return "変なやさしさの子";
  return entries[0][1] ? entries[0][0] : "まだ名前のない子";
}

function powerFor(reading, night) {
  if (night.need !== "whole") return reading.skills[night.need] || 0;
  const values = Object.values(reading.skills);
  return Math.min(...values) + Math.floor(values.reduce((sum, value) => sum + value, 0) / 4);
}

export function forecast(input, commandId) {
  const state = input;
  const night = nightOf(state);
  const reading = readBuild(state.parts);
  const base = powerFor(reading, night);
  const bonus = commandId === "help" ? 1 : commandId === "wait" ? -1 : 0;
  const value = base + bonus;
  const success = value >= night.threshold;
  const gap = night.threshold - value;
  const status = success ? (gap <= -1 ? "strong" : "edge") : "weak";
  const command = commandById(commandId);
  return {
    night: night.id, command: commandId, reading, base, value, threshold: night.threshold,
    gap, success, status, label: status === "strong" ? "かなり届きそう" : status === "edge" ? "ぎりぎり届きそう" : "まだ足りない",
    hint: command ? command.hint : ""
  };
}

export const COMMANDS = [
  { id: "trust", icon: "◡", name: "任せる", hint: "子の今のふるまいを、そのまま信じる。", bond: 2 },
  { id: "help", icon: "⌁", name: "手を添える", hint: "あなたが少しだけ、足りないところを補う。", bond: 0 },
  { id: "wait", icon: "…", name: "待つ", hint: "急がず、子が自分で見つける時間を残す。", bond: 1 }
];

export function commandById(id) {
  return COMMANDS.find(command => command.id === id) || null;
}

export function installPart(input, partId, slotIndex, source = "offer") {
  const state = clone(input);
  if (state.phase !== "build") return { state, result: { ok: false, message: "いまは取り付ける時間ではない。" } };
  if (!partById(partId) || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SLOT_IDS.length) {
    return { state, result: { ok: false, message: "その部品や場所は選べない。" } };
  }
  const sourceList = source === "bag" ? state.bag : state.offer;
  if (!sourceList.includes(partId)) return { state, result: { ok: false, message: "その部品は手元にない。" } };
  const old = state.parts[slotIndex];
  if (old && old !== partId) {
    if (state.bag.length >= 2 && !state.bag.includes(partId)) {
      return { state, result: { ok: false, message: "ポケットがいっぱい。先に一つを手放す。" } };
    }
    state.bag.push(old);
  }
  const removeFrom = source === "bag" ? state.bag : state.offer;
  removeFrom.splice(removeFrom.indexOf(partId), 1);
  state.parts[slotIndex] = partId;
  state.offer = [];
  state.phase = "command";
  state.log.push(SLOT_NAMES[SLOT_IDS[slotIndex]] + "へ「" + partById(partId).name + "」を取り付けた。");
  return { state, result: { ok: true, partId, slot: SLOT_IDS[slotIndex], old } };
}

export function storeOffer(input, partId) {
  const state = clone(input);
  if (state.phase !== "build" || !state.offer.includes(partId)) return { state, result: { ok: false, message: "その部品はしまえない。" } };
  if (state.bag.length >= 2) return { state, result: { ok: false, message: "ポケットがいっぱい。先に一つを手放す。" } };
  const abandoned = state.offer.filter(id => id !== partId);
  state.offer.splice(state.offer.indexOf(partId), 1);
  state.bag.push(partId);
  state.discarded.push(...abandoned);
  state.offer = [];
  state.phase = "command";
  state.log.push("「" + partById(partId).name + "」を、あとで使うためにしまった。もう一つは夜の外へ置いた。");
  return { state, result: { ok: true, partId, abandoned } };
}

export function discardBag(input, partId) {
  const state = clone(input);
  if (state.phase !== "build" || !state.bag.includes(partId)) return { state, result: { ok: false, message: "それはポケットにない。" } };
  state.bag.splice(state.bag.indexOf(partId), 1);
  state.discarded.push(partId);
  state.log.push("「" + partById(partId).name + "」を夜の外へ置いた。");
  return { state, result: { ok: true, partId } };
}

export function skipBuild(input) {
  const state = clone(input);
  if (state.phase !== "build") return { state, result: { ok: false, message: "いまは拾う時間ではない。" } };
  state.offer = [];
  state.phase = "command";
  state.log.push("今夜は新しいものを拾わず、いまの子を信じた。");
  return { state, result: { ok: true } };
}

export function chooseCommand(input, commandId) {
  const state = clone(input);
  if (state.phase !== "command") return { state, result: { ok: false, message: "いまは命令を送れない。" } };
  const command = commandById(commandId);
  if (!command) return { state, result: { ok: false, message: "その命令はない。" } };
  const prediction = forecast(state, commandId);
  const night = nightOf(state);
  const success = prediction.success;
  const before = { light: state.light, bond: state.bond, insight: state.insight };
  if (success) {
    state.bond += command.bond;
    if (prediction.status === "edge") state.insight += 1;
    if (prediction.reading.traces.length > prediction.reading.installed.length + 1) state.insight += 1;
  } else {
    state.light = Math.max(0, state.light - 1);
    state.scars += 1;
    if (commandId === "wait") state.insight += 1;
  }
  const text = success
    ? (commandId === "trust" ? night.success : commandId === "help" ? "あなたの手が重なり、" + night.success : "待ったあとで、" + night.success)
    : (commandId === "help" ? "手を添えたが、" + night.failure : night.failure);
  state.history.push({
    night: state.night,
    nightId: night.id,
    title: night.title,
    parts: [...state.parts],
    behavior: prediction.reading.behavior,
    command: commandId,
    need: night.need,
    power: prediction.value,
    threshold: night.threshold,
    success,
    text
  });
  state.lastOutcome = { ...prediction, success, text, before, after: { light: state.light, bond: state.bond, insight: state.insight } };
  state.phase = "aftermath";
  state.offer = [];
  if (state.light <= 0) state.endReason = "light_out";
  state.log.push(text);
  return { state, result: { ok: true, prediction, success, text } };
}

export function continueNight(input) {
  const state = clone(input);
  if (state.phase !== "aftermath") return { state, result: { ok: false, message: "まだ夜を越せない。" } };
  if (state.endReason || state.night >= MAX_NIGHTS - 1) {
    state.phase = "result";
    state.endedAt = new Date().toISOString();
    state.endReason = state.endReason || "dawn";
    state.ending = deriveEnding(state);
    state.log.push(state.ending.title + "。" + state.ending.text);
    return { state, result: { ok: true, ended: true } };
  }
  state.night += 1;
  state.phase = "build";
  state.offer = [];
  state.lastOutcome = null;
  return { state: drawOffer(state), result: { ok: true, ended: false } };
}

export function deriveEnding(state) {
  if (state.endReason === "light_out") {
    return { id: "dark", title: "夜はまだ終わらない", text: "子はあなたの袖の中で眠った。失った灯りの代わりに、次は何を渡すのかが残った。", keepsakePartId: state.parts.find(Boolean) || "shell" };
  }
  const reading = readBuild(state.parts);
  if (reading.behavior === "返事をする子" || reading.skills.returning >= reading.skills.look + 2) {
    return { id: "answer", title: "返事のある朝", text: "子は灯りを空へ返した。遠くの窓が、一つずつこちらを向いた。", keepsakePartId: state.parts[2] || state.parts[0] || "bell" };
  }
  if (reading.behavior === "火を分ける子" || reading.skills.warm >= reading.skills.hold + 2) {
    return { id: "ember", title: "分けられた朝", text: "子は灯りを胸にしまわず、待っていた手へ分けた。暗さは少しだけ薄くなった。", keepsakePartId: state.parts[1] || "ember" };
  }
  if (reading.behavior === "見つける子" || reading.skills.look >= reading.skills.returning + 2) {
    return { id: "far", title: "見つけた朝", text: "子は灯台の外を指さした。まだ見えていない道が、朝の先に続いている。", keepsakePartId: state.parts[0] || "lens" };
  }
  return { id: "together", title: "ふたりの朝", text: "子は灯りの前で振り返った。教えたことのない仕草を、あなたへ返した。", keepsakePartId: state.parts[1] || state.parts.find(Boolean) || "thread" };
}

export function summary(state) {
  const reading = readBuild(state.parts);
  return {
    gameVersion: GAME_VERSION,
    runId: state.runId,
    seed: state.seed,
    won: state.endReason === "dawn",
    reached: state.history.length,
    reason: state.endReason,
    light: state.light,
    bond: state.bond,
    insight: state.insight,
    scars: state.scars,
    parts: [...state.parts],
    bag: [...state.bag],
    behavior: reading.behavior,
    skills: reading.skills,
    history: [...state.history],
    ending: state.ending,
    legacyUsed: Boolean(state.legacy)
  };
}
