export const VERSION = "odd-0.1";
export const GAME_VERSION = "odd-0.1-machine";
export const MAX_STAGES = 7;
export const SLOT_COUNT = 4;
export const MAX_EMBER = 3;
export const MAX_WEAR = 6;
export const MAX_SCRAP = 6;

export const COMMANDS = [
  { id: "rush", name: "急ぐ", icon: "➜", description: "衝撃を増やす。機関が少し傷む。" },
  { id: "steady", name: "整える", icon: "◌", description: "守りを作る。熱をゆっくり回す。" },
  { id: "listen", name: "耳を澄ます", icon: "◒", description: "信号を読む。余った部品を拾う。" }
];

export const PARTS = [
  { id: "boiler", name: "小型炉", icon: "♨", description: "熱2。急ぐと衝撃+1、整えると守り+1。" },
  { id: "ram", name: "突撃杭", icon: "◆", description: "衝撃1。蓄電していれば、その分も衝撃にする。" },
  { id: "sponge", name: "水苔", icon: "◈", description: "熱2ごとに守り1。何もなければ守り1。" },
  { id: "bell", name: "遠鳴り鈴", icon: "◔", description: "信号を出す。守りがあれば部品くずも拾う。" },
  { id: "magnet", name: "迷子磁石", icon: "✦", description: "部品くずを蓄電へ変える。くずがなければ拾う。" },
  { id: "mirror", name: "裏返し鏡", icon: "◇", description: "直前の出力をもう一度だけ写す。順番で意味が変わる。" },
  { id: "lens", name: "焦げレンズ", icon: "◉", description: "次の部品の出力を2倍。耳を澄ますと3倍。" },
  { id: "nest", name: "火種の巣", icon: "⌂", description: "守り1。守りが厚く、火種が傷んでいれば回復する。" },
  { id: "hook", name: "引っかけ鉤", icon: "∩", description: "衝撃があれば部品くずを拾う。" },
  { id: "valve", name: "余熱弁", icon: "⊙", description: "熱2を蓄電2へ変える。熱がなければ守り1。" },
  { id: "moth", name: "夜蛾ランプ", icon: "☼", description: "熱を信号へ変える。耳を澄ますと信号を重ねる。" },
  { id: "wheel", name: "空回り輪", icon: "◎", description: "衝撃1。急ぐともう1、整えると部品くず1。" },
  { id: "anchor", name: "錨爪", icon: "⚓", description: "守り1。機関の摩耗を1戻す。" },
  { id: "needle", name: "細針", icon: "╱", description: "蓄電1を衝撃2へ。なければ信号1。" }
];

const PART_BY_ID = Object.fromEntries(PARTS.map(part => [part.id, part]));
const COMMAND_BY_ID = Object.fromEntries(COMMANDS.map(command => [command.id, command]));

export const STAGE_TEMPLATES = [
  {
    id: "wall", icon: "▰", name: "沈黙の壁",
    text: "音のない壁が道を塞いでいる。強く叩けば、向こう側から返事がある。",
    need: { stats: ["force"], value: 4, label: "衝撃 4" },
    success: "壁の奥から、まだ使える部品が転がってきた。",
    failure: "壁は揺れただけだった。機関の骨組みにひびが入る。",
    fail: { wear: 1 }
  },
  {
    id: "fog", icon: "≋", name: "名前のない霧",
    text: "霧の中では、進む道そのものが変わる。信号を返してくれるものが必要だ。",
    need: { stats: ["signal"], value: 4, label: "信号 4" },
    success: "遠鳴りが道を固定した。霧の向こうに次の灯りが見える。",
    failure: "返事のない道へ踏み込んだ。火種がひとつ消える。",
    fail: { ember: 1 }
  },
  {
    id: "flood", icon: "≈", name: "逆流する水路",
    text: "水が機関の足元を押し流そうとする。踏ん張るには、厚い守りが要る。",
    need: { stats: ["guard"], value: 4, label: "守り 4" },
    success: "水路を渡る間に、濡れた部品を乾かせた。摩耗が少し戻る。",
    failure: "足場が崩れた。火種を抱えた巣が濡れてしまう。",
    fail: { ember: 1 }
  },
  {
    id: "frost", icon: "❄", name: "凍った階段",
    text: "冷気が熱を奪う。熱を一度だけ、まっすぐ前へ送れれば登れる。",
    need: { stats: ["heat"], value: 2, label: "熱 2" },
    success: "焦げた足跡が階段を溶かした。火種が少し息を吹き返す。",
    failure: "足が凍りついた。機関を無理に動かした摩耗が残る。",
    fail: { wear: 1 }
  },
  {
    id: "ravine", icon: "⋮", name: "二つに割れた谷",
    text: "向こう岸は遠い。押し出す力と、正しい合図の両方がなければ届かない。",
    need: { stats: ["force", "signal"], value: 6, label: "衝撃＋信号 6" },
    success: "機関が谷をまたいだ。落ちた部品を拾い集める。",
    failure: "片足だけが向こう岸へ届いた。火種が揺らめく。",
    fail: { ember: 1 }
  },
  {
    id: "tower", icon: "⌁", name: "眠る塔",
    text: "塔は、熱を守りに変える機械だ。熱を捨てずに抱えたまま届かせたい。",
    need: { stats: ["guard", "heat"], value: 5, label: "守り＋熱 5" },
    success: "塔が目を覚まし、周囲の風から火種を守った。",
    failure: "塔は動かなかった。余熱だけが機関の中で暴れた。",
    fail: { wear: 1 }
  },
  {
    id: "beast", icon: "◒", name: "眠らない獣",
    text: "獣は、弱い一撃も薄い守りも見逃さない。押し返しながら、火種を隠す。",
    need: { stats: ["force", "guard"], value: 6, label: "衝撃＋守り 6" },
    success: "獣は機関の変な音を嫌がり、夜の奥へ逃げた。",
    failure: "獣の爪が機関をかすめた。火種を守りきれない。",
    fail: { ember: 1, wear: 1 }
  },
  {
    id: "gate", icon: "⊞", name: "朝の門",
    text: "門の前では、力よりも機関が何を伝えたいかが問われる。",
    need: { stats: ["signal", "guard"], value: 5, label: "信号＋守り 5" },
    success: "門が開いた。向こう側には、機関を待っていた朝がある。",
    failure: "門はまだ閉じている。それでも、火種を抱えて押し通る。",
    fail: { wear: 1 }
  }
];

const STAGE_BY_ID = Object.fromEntries(STAGE_TEMPLATES.map(stage => [stage.id, stage]));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeSeed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.abs(Math.floor(number)) % 1000000;
}

function nextRandom(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

function shuffle(state, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(nextRandom(state) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function drawOffer(state) {
  const ids = [];
  const candidates = shuffle(state, PARTS.map(part => part.id));
  for (const id of candidates) {
    if (!ids.includes(id)) ids.push(id);
    if (ids.length === 2) break;
  }
  return ids;
}

export function partById(id) {
  return PART_BY_ID[id] || null;
}

export function commandById(id) {
  return COMMAND_BY_ID[id] || null;
}

export function stageById(id) {
  return STAGE_BY_ID[id] || null;
}

export function createGame(seed = 1) {
  const normalized = normalizeSeed(seed);
  const state = {
    version: VERSION,
    seed: normalized,
    rng: (normalized ^ 0x9e3779b9) >>> 0,
    stages: [],
    stage: 0,
    phase: "build",
    parts: ["boiler", "ram", "sponge", "bell"],
    offer: [],
    selectedOffer: null,
    ember: MAX_EMBER,
    wear: 0,
    scrap: 0,
    swapsLeft: 3,
    repairUsed: false,
    insight: 0,
    done: false,
    won: false,
    endReason: null,
    log: [],
    telemetry: null,
    survey: null,
    endedAt: null
  };
  state.stages = shuffle(state, STAGE_TEMPLATES.map(stage => stage.id)).slice(0, MAX_STAGES);
  state.offer = drawOffer(state);
  state.log.push({ stage: 0, kind: "system", text: "4つのガラクタを通り道に並べ、火種を朝まで運ぶ。" });
  return state;
}

export function currentStage(state) {
  return stageById(state.stages[Math.min(state.stage, state.stages.length - 1)]) || STAGE_TEMPLATES[0];
}

function outputTemplate() {
  return {
    force: 0,
    guard: 0,
    signal: 0,
    heat: 0,
    charge: 0,
    scrap: 0,
    repair: 0,
    wear: 0,
    trace: [],
    lastKind: null,
    lastAmount: 0,
    amplify: 1
  };
}

function addOutput(output, kind, amount, text) {
  const raw = Math.max(0, Math.floor(amount));
  if (!raw) return;
  const value = raw * output.amplify;
  output[kind] += value;
  output.lastKind = kind;
  output.lastAmount = value;
  output.trace.push(text.replace("{n}", String(value)));
  output.amplify = 1;
}

function trace(output, text) {
  output.trace.push(text);
}

export function simulateMachine(parts, commandId, state) {
  const command = commandById(commandId) || COMMANDS[0];
  const output = outputTemplate();
  let scrap = state.scrap;

  const gainScrap = amount => {
    const before = scrap;
    scrap = clamp(scrap + amount, 0, MAX_SCRAP);
    const gained = scrap - before;
    if (gained > 0) {
      output.scrap += gained;
      output.lastKind = "scrap";
      output.lastAmount = gained;
      output.trace.push(`部品くず +${gained}`);
      output.amplify = 1;
    }
  };

  if (command.id === "rush") {
    addOutput(output, "force", 1, "命令：衝撃 +{n}");
    addOutput(output, "heat", 1, "命令：熱 +{n}");
    output.wear += 1;
  } else if (command.id === "steady") {
    addOutput(output, "guard", 1, "命令：守り +{n}");
    addOutput(output, "heat", 1, "命令：熱 +{n}");
  } else {
    addOutput(output, "signal", 2, "命令：信号 +{n}");
    gainScrap(1);
  }

  for (const id of parts) {
    const before = output.trace.length;
    const part = partById(id);
    if (!part) continue;

    switch (id) {
      case "boiler":
        addOutput(output, "heat", 2, "小型炉：熱 +{n}");
        if (command.id === "rush") addOutput(output, "force", 1, "小型炉：急ぐので衝撃 +{n}");
        if (command.id === "steady") addOutput(output, "guard", 1, "小型炉：整えて守り +{n}");
        break;
      case "ram": {
        const charge = output.charge;
        output.charge = 0;
        addOutput(output, "force", 1 + Math.min(charge, 2), `突撃杭：衝撃 +{n}${charge ? `（蓄電${charge}を使った）` : ""}`);
        if (command.id === "rush") output.wear += 1;
        break;
      }
      case "sponge": {
        const blocks = Math.floor(output.heat / 2);
        output.heat -= blocks * 2;
        addOutput(output, "guard", Math.max(1, blocks), `水苔：熱を守りへ ${blocks ? `(${blocks})` : ""} +{n}`);
        break;
      }
      case "bell":
        addOutput(output, "signal", command.id === "listen" ? 2 : 1, "遠鳴り鈴：信号 +{n}");
        if (output.guard > 0) gainScrap(1);
        break;
      case "magnet": {
        if (scrap > 0) {
          const amount = Math.min(scrap, 2);
          scrap -= amount;
          output.charge += amount;
          trace(output, `迷子磁石：部品くず${amount}を蓄電へ`);
        } else {
          gainScrap(1);
          trace(output, "迷子磁石：落ちていた部品くずを拾う");
        }
        break;
      }
      case "mirror":
        if (output.lastKind && ["force", "guard", "signal", "heat"].includes(output.lastKind)) {
          addOutput(output, output.lastKind, Math.min(output.lastAmount, 2), `裏返し鏡：直前の${output.lastKind}を写す +{n}`);
        } else {
          addOutput(output, "signal", 1, "裏返し鏡：まだないものを信号にする +{n}");
        }
        break;
      case "lens":
        output.amplify = command.id === "listen" ? 3 : 2;
        trace(output, `焦げレンズ：次の出力 ×${output.amplify}`);
        break;
      case "nest":
        addOutput(output, "guard", 1, "火種の巣：守り +{n}");
        if (output.guard >= 2 && state.ember < MAX_EMBER) {
          output.repair += 1;
          trace(output, "火種の巣：火種を1つ温める");
        }
        break;
      case "hook":
        if (output.force >= 2) gainScrap(1);
        else trace(output, "引っかけ鉤：届くものがない");
        break;
      case "valve":
        if (output.heat >= 2) {
          output.heat -= 2;
          output.charge += 2;
          trace(output, "余熱弁：熱2を蓄電2へ");
        } else {
          addOutput(output, "guard", 1, "余熱弁：守り +{n}");
        }
        break;
      case "moth":
        if (output.heat > 0) output.heat -= 1;
        addOutput(output, "signal", command.id === "listen" ? 2 : 1, "夜蛾ランプ：熱を信号へ +{n}");
        break;
      case "wheel":
        addOutput(output, "force", command.id === "rush" ? 2 : 1, "空回り輪：衝撃 +{n}");
        if (command.id === "steady") gainScrap(1);
        break;
      case "anchor":
        addOutput(output, "guard", 1, "錨爪：守り +{n}");
        output.wear = Math.max(0, output.wear - 1);
        trace(output, "錨爪：摩耗 -1");
        if (command.id === "listen") addOutput(output, "signal", 1, "錨爪：耳を澄ました反響 +{n}");
        break;
      case "needle":
        if (output.charge > 0) {
          output.charge -= 1;
          addOutput(output, "force", 2, "細針：蓄電を衝撃へ +{n}");
        } else {
          addOutput(output, "signal", 1, "細針：信号 +{n}");
        }
        break;
      default:
        break;
    }
    if (output.trace.length === before) trace(output, `${part.name}：反応なし`);
  }

  output.scrapAfter = scrap;
  output.scrapDelta = scrap - state.scrap;
  return output;
}

export function evaluateStage(stage, output) {
  const value = stage.need.stats.reduce((sum, stat) => sum + (output[stat] || 0), 0);
  return { value, required: stage.need.value, passed: value >= stage.need.value };
}

export function preview(state, commandId) {
  const stage = currentStage(state);
  const output = simulateMachine(state.parts, commandId, state);
  return { command: commandById(commandId), stage, output, evaluation: evaluateStage(stage, output) };
}

function pushLog(state, text, kind = "neutral") {
  state.log.push({ stage: state.stage, text, kind });
  if (state.log.length > 24) state.log.shift();
}

export function selectOffer(input, offerIndex) {
  const state = structuredClone(input);
  if (state.done || state.phase !== "build") return { state, result: { ok: false, message: "いまは部品を選べない。" } };
  if (!Number.isInteger(offerIndex) || !state.offer[offerIndex]) return { state, result: { ok: false, message: "その部品はない。" } };
  state.selectedOffer = offerIndex;
  return { state, result: { ok: true, part: partById(state.offer[offerIndex]) } };
}

export function installOffer(input, slotIndex) {
  const state = structuredClone(input);
  if (state.done || state.phase !== "build" || state.selectedOffer == null) return { state, result: { ok: false, message: "先に入れる部品を選ぶ。" } };
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SLOT_COUNT) return { state, result: { ok: false, message: "その枠はない。" } };
  const id = state.offer[state.selectedOffer];
  const oldId = state.parts[slotIndex];
  state.parts[slotIndex] = id;
  state.scrap = clamp(state.scrap + 1, 0, MAX_SCRAP);
  state.offer = [];
  state.selectedOffer = null;
  state.phase = "command";
  pushLog(state, `${partById(id).name}を${slotIndex + 1}番枠へ。${partById(oldId).name}は部品くずになった。`, "build");
  return { state, result: { ok: true, action: "installed", part: id, oldPart: oldId, slot: slotIndex } };
}

export function scrapOffer(input) {
  const state = structuredClone(input);
  if (state.done || state.phase !== "build" || state.selectedOffer == null) return { state, result: { ok: false, message: "先に部品を選ぶ。" } };
  const id = state.offer[state.selectedOffer];
  state.scrap = clamp(state.scrap + 2, 0, MAX_SCRAP);
  state.offer = [];
  state.selectedOffer = null;
  state.phase = "command";
  pushLog(state, `${partById(id).name}を分解し、部品くず2を得た。`, "build");
  return { state, result: { ok: true, action: "scrapped", part: id, scrap: 2 } };
}

export function skipOffer(input) {
  const state = structuredClone(input);
  if (state.done || state.phase !== "build") return { state, result: { ok: false, message: "いまは見送れない。" } };
  state.offer = [];
  state.selectedOffer = null;
  state.phase = "command";
  pushLog(state, "今回はどちらも入れず、機関の癖を信じる。", "build");
  return { state, result: { ok: true, action: "skipped" } };
}

export function swapSlots(input, first, second) {
  const state = structuredClone(input);
  if (state.done || state.phase !== "command") return { state, result: { ok: false, message: "いまは並べ替えられない。" } };
  if (state.swapsLeft <= 0) return { state, result: { ok: false, message: "もう配線を組み替える余裕がない。" } };
  if (![first, second].every(index => Number.isInteger(index) && index >= 0 && index < SLOT_COUNT) || first === second) {
    return { state, result: { ok: false, message: "別の2枠を選ぶ。" } };
  }
  [state.parts[first], state.parts[second]] = [state.parts[second], state.parts[first]];
  state.swapsLeft -= 1;
  pushLog(state, `${first + 1}番と${second + 1}番の配線を入れ替えた。`, "build");
  return { state, result: { ok: true, first, second } };
}

export function repairMachine(input) {
  const state = structuredClone(input);
  if (state.done || state.phase !== "command") return { state, result: { ok: false, message: "いまは整備できない。" } };
  if (state.repairUsed) return { state, result: { ok: false, message: "この区画ではもう整備した。" } };
  if (state.scrap < 2) return { state, result: { ok: false, message: "部品くずが2つ必要だ。" } };
  state.scrap -= 2;
  state.ember = Math.min(MAX_EMBER, state.ember + 1);
  state.wear = Math.max(0, state.wear - 1);
  state.repairUsed = true;
  pushLog(state, "部品くず2を使って、火種と機関を整備した。", "safe");
  return { state, result: { ok: true } };
}

export function chooseCommand(input, commandId) {
  const state = structuredClone(input);
  if (state.done || state.phase !== "command") return { state, result: { ok: false, message: "いまは命令を送れない。" } };
  const command = commandById(commandId);
  if (!command) return { state, result: { ok: false, message: "その命令はない。" } };

  const stage = currentStage(state);
  const before = { ember: state.ember, wear: state.wear, scrap: state.scrap };
  const output = simulateMachine(state.parts, commandId, state);
  const evaluation = evaluateStage(stage, output);
  state.scrap = clamp(output.scrapAfter, 0, MAX_SCRAP);
  state.ember = clamp(state.ember + output.repair, 0, MAX_EMBER);
  state.wear = clamp(state.wear + output.wear, 0, MAX_WEAR);

  let text;
  let kind;
  if (evaluation.passed) {
    state.insight += 1;
    state.wear = Math.max(0, state.wear + (stage.id === "flood" ? -1 : 0));
    text = `${stage.success}（${stage.need.label}: ${evaluation.value}）`;
    kind = "good";
  } else {
    state.ember = clamp(state.ember - (stage.fail.ember || 0), 0, MAX_EMBER);
    state.wear = clamp(state.wear + (stage.fail.wear || 0), 0, MAX_WEAR);
    text = `${stage.failure}（${stage.need.label}: ${evaluation.value}）`;
    kind = "danger";
  }
  state.log.push({ stage: state.stage, text, kind });
  state.stage += 1;
  state.phase = "build";
  state.repairUsed = false;
  state.offer = [];
  state.selectedOffer = null;

  if (state.ember <= 0) {
    state.done = true;
    state.won = false;
    state.endReason = "ember_lost";
  } else if (state.wear >= MAX_WEAR) {
    state.done = true;
    state.won = false;
    state.endReason = "machine_broken";
  } else if (state.stage >= MAX_STAGES) {
    state.done = true;
    state.won = true;
    state.endReason = "morning";
  } else {
    state.offer = drawOffer(state);
  }

  if (state.done) {
    state.phase = "result";
    state.endedAt = new Date().toISOString();
  }
  return {
    state,
    result: { ok: true, command: commandId, stage, before, output, evaluation, after: { ember: state.ember, wear: state.wear, scrap: state.scrap }, done: state.done }
  };
}

export function summary(state) {
  return {
    won: Boolean(state.won),
    reached: state.stage,
    ember: state.ember,
    wear: state.wear,
    scrap: state.scrap,
    insight: state.insight,
    parts: [...state.parts],
    stages: [...state.stages],
    swaps: 3 - state.swapsLeft,
    reason: state.endReason || null
  };
}

export function planLabel(parts) {
  return parts.map(id => partById(id)?.icon || "?").join(" ");
}
