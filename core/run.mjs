import { makeRng } from "./rng.mjs";
import { ARC } from "./arc.mjs";

export function createRun({ seed, playerId = "unknown", ruleset = ARC }) {
  const {
    PARTS, ENEMIES, PREDICTIONS, WORRY_CATEGORIES, UPDATE_KINDS, MARKER_KINDS,
    SLOT_COUNT, START_PARTS, RARE_RATE,
    MAX_HP, REPAIR_HP, WIN_HEAL, REWARD_CHOICES,
    simulateBattle, predictionLevel, outcomeLevel
  } = ruleset;

  const rng = makeRng(seed);
  let counter = 0;
  const makeId = () => `p${(counter += 1).toString(36)}`;

  const weightedType = (exclude = []) => {
    const keys = Object.keys(PARTS);
    const common = keys.filter(k => !PARTS[k].rare && !exclude.includes(k));
    const rares = keys.filter(k => PARTS[k].rare && !exclude.includes(k));
    const pool = rng() < RARE_RATE && rares.length ? rares : common;
    return pool[Math.floor(rng() * pool.length)];
  };

  const makePart = type => ({ id: makeId(), type, acquiredWave: state?.wave ?? 0 });

  const state = {
    seed, playerId, ruleset: ruleset.id,
    phase: "build", wave: 0, hp: MAX_HP, maxHp: MAX_HP, scrap: 1,
    inventory: [], slots: Array(SLOT_COUNT).fill(null),
    offer: null, done: false, won: false,
    lastBattle: null, battles: [], rewards: [],
    trace: [], seq: 0, edits: newEdits(),
    previews: [], previewsAfterFirstWin: 0, sawWinningPreview: false
  };

  // 初期手札の契約。ルールセットが startContract を持つなら、それを満たすまで引き直す。
  //
  // 必要になった理由：RELAY の生成条件を測ったとき、1〜2戦目だけ
  // 「締めると勝てない手札が生まれ、緩めると全部の並びが勝つ」の二択になった。
  // 敵の数値では解けない。原因は手札の偏り（撃が足りない引き）だったので、
  // 難易度ではなく**引きの側**に条件を置く。詰みを作らずに締めるための唯一の手である。
  const drawStart = () => {
    const types = [];
    while (types.length < START_PARTS) types.push(weightedType(types));
    return types;
  };
  let startTypes = drawStart();
  if (typeof ruleset.startContract === "function") {
    let tries = 0;
    while (!ruleset.startContract(startTypes) && tries < 200) { startTypes = drawStart(); tries += 1; }
  }
  state.inventory = startTypes.map(makePart);

  function newEdits() { return { place: 0, remove: 0, swap: 0, scrap: 0, repair: 0, total: 0 }; }

  const bump = kind => { state.edits[kind] += 1; state.edits.total += 1; };

  const record = (type, detail = {}) => {
    state.seq += 1;
    state.trace.push({ seq: state.seq, type, wave: state.wave + 1, phase: state.phase, ...detail });
  };

  record("run_started", { initial: state.inventory.map(p => PARTS[p.type].name) });

  const view = instance => instance && ({
    id: instance.id, type: instance.type, name: PARTS[instance.type].name,
    icon: PARTS[instance.type].icon, short: PARTS[instance.type].short,
    desc: PARTS[instance.type].desc, tags: PARTS[instance.type].tags,
    cost: PARTS[instance.type].cost,
    period: PARTS[instance.type].period,
    line: PARTS[instance.type].line,
    rare: Boolean(PARTS[instance.type].rare), acquiredWave: instance.acquiredWave + 1
  });

  const currentEnemy = () => ENEMIES[Math.min(state.wave, ENEMIES.length - 1)];

  const enemyView = () => {
    const enemy = currentEnemy();
    if (ruleset.enemyView) return ruleset.enemyView(enemy);
    return { name: enemy.name, hp: enemy.hp, atk: enemy.atk, armor: enemy.armor || 0, trait: enemy.trait };
  };

  const buildSignature = () => state.slots.map(s => (s ? s.id : "-")).join(",");

  function fail(message) {
    return { ok: false, error: message, observation: observe() };
  }

  function observe() {
    const base = {
      ruleset: state.ruleset, title: ruleset.title,
      slotLabel: ruleset.slotLabel, slotHint: ruleset.slotHint,
      seed: state.seed, phase: state.phase,
      battleNumber: state.wave + 1, totalBattles: ENEMIES.length,
      hp: state.hp, maxHp: state.maxHp, scrap: state.scrap,
      slots: state.slots.map((instance, i) => ({ slot: i + 1, part: view(instance) })),
      inventory: state.inventory.map(view),
      upcomingEnemy: state.done ? null : enemyView(),
      lastBattle: state.lastBattle,
      done: state.done, won: state.won
    };
    if (state.phase === "reward") base.offer = state.offer.map((instance, i) => ({ choice: i + 1, part: view(instance) }));
    base.legalActions = legalActions();
    return base;
  }

  function legalActions() {
    if (state.done) return [];
    if (state.phase === "reward") {
      return [
        { type: "take", args: { choice: `1..${REWARD_CHOICES}`, reason: "string", update: `one of ${UPDATE_KINDS.join("|")}`, updateText: "string" } },
        { type: "skipAll", args: { reason: "string" } },
        { type: "mark", args: { kind: MARKER_KINDS.join("|"), note: "string" } },
      { type: "preview", args: { signature: "string", won: "boolean", hp: "number", cycles: "number" }, note: "並びを1つ試した記録（画面が自動で送る）" }
      ];
    }
    return [
      { type: "place", args: { partId: "inventory part id", slot: `1..${SLOT_COUNT}` } },
      { type: "remove", args: { slot: `1..${SLOT_COUNT}` } },
      { type: "swap", args: { slotA: `1..${SLOT_COUNT}`, slotB: `1..${SLOT_COUNT}` } },
      { type: "scrapPart", args: { partId: "inventory part id" } },
      { type: "repair", args: {}, note: `修復材1で HP+${REPAIR_HP}` },
      { type: "battle", args: { prediction: PREDICTIONS.join("|"), worry: WORRY_CATEGORIES.join("|"), worryText: "string" } },
      { type: "mark", args: { kind: MARKER_KINDS.join("|"), note: "string" } },
      { type: "preview", args: { signature: "string", won: "boolean", hp: "number", cycles: "number" }, note: "並びを1つ試した記録（画面が自動で送る）" }
    ];
  }

  function act(action) {
    if (state.done) return fail("run is finished");
    const type = action?.type;

    if (type === "mark") {
      if (!MARKER_KINDS.includes(action.kind)) return fail(`kind must be one of ${MARKER_KINDS.join("|")}`);
      record("emotion_marked", { kind: action.kind, note: String(action.note || "").slice(0, 200) });
      return { ok: true, observation: observe() };
    }

    if (state.phase === "reward") return actReward(action);
    return actBuild(action);
  }

  function actBuild(action) {
    const type = action?.type;
    // 画面が並びの結果を出すたびに呼ばれる。**探索そのものの記録である。**
    //
    // これまで観測できたのは各戦闘の最終的な並びだけで、そこへ至る試行は一度も見ていなかった。
    // 「ガチャガチャやってれば大体勝てる」という報告を、こちらは数字で確かめられなかった。
    // 勝てる並びを見つけた後もさらに試したかどうかが、志が効いているかの直接の証拠になる。
    if (type === "preview") {
      const signature = String(action.signature || "").slice(0, 80);
      if (state.previews.length < 200 && signature) {
        state.previews.push({
          sig: signature, won: Boolean(action.won),
          hp: Number(action.hp) || 0, cycles: Number(action.cycles) || 0
        });
        if (state.sawWinningPreview) state.previewsAfterFirstWin += 1;
        if (action.won) state.sawWinningPreview = true;
      }
      return { ok: true, observation: observe() };
    }

    if (type === "place") {
      const index = state.inventory.findIndex(p => p.id === action.partId);
      if (index < 0) return fail("no such part in inventory");
      const slot = Number(action.slot) - 1;
      if (!(slot >= 0 && slot < SLOT_COUNT)) return fail(`slot must be 1..${SLOT_COUNT}`);
      const instance = state.inventory.splice(index, 1)[0];
      const displaced = state.slots[slot];
      state.slots[slot] = instance;
      if (displaced) state.inventory.push(displaced);
      bump("place");
      return { ok: true, observation: observe() };
    }
    if (type === "remove") {
      const slot = Number(action.slot) - 1;
      if (!(slot >= 0 && slot < SLOT_COUNT)) return fail(`slot must be 1..${SLOT_COUNT}`);
      if (!state.slots[slot]) return fail("slot is already empty");
      state.inventory.push(state.slots[slot]);
      state.slots[slot] = null;
      bump("remove");
      return { ok: true, observation: observe() };
    }
    if (type === "swap") {
      const a = Number(action.slotA) - 1;
      const b = Number(action.slotB) - 1;
      if (![a, b].every(n => n >= 0 && n < SLOT_COUNT)) return fail(`slots must be 1..${SLOT_COUNT}`);
      [state.slots[a], state.slots[b]] = [state.slots[b], state.slots[a]];
      bump("swap");
      return { ok: true, observation: observe() };
    }
    if (type === "scrapPart") {
      const index = state.inventory.findIndex(p => p.id === action.partId);
      if (index < 0) return fail("no such part in inventory");
      const instance = state.inventory.splice(index, 1)[0];
      state.scrap += 1;
      bump("scrap");
      record("part_scrapped", { part: PARTS[instance.type].name });
      return { ok: true, observation: observe() };
    }
    if (type === "repair") {
      if (state.scrap < 1) return fail("no scrap");
      if (state.hp >= state.maxHp) return fail("hp is full");
      state.scrap -= 1;
      state.hp = Math.min(state.maxHp, state.hp + REPAIR_HP);
      bump("repair");
      record("repaired", { hp: state.hp });
      return { ok: true, observation: observe() };
    }
    if (type === "battle") return runBattle(action);
    return fail(`unknown action "${type}" in build phase`);
  }

  function runBattle(action) {
    if (state.slots.every(s => !s)) return fail("place at least one part before fighting");
    if (!PREDICTIONS.includes(action.prediction)) return fail(`prediction must be one of ${PREDICTIONS.join("|")}`);
    if (!WORRY_CATEGORIES.includes(action.worry)) return fail(`worry must be one of ${WORRY_CATEGORIES.join("|")}`);

    const enemy = currentEnemy();
    const signature = buildSignature();
    record("battle_predicted", {
      enemy: enemy.name, prediction: action.prediction,
      worry: action.worry, worryText: String(action.worryText || "").slice(0, 300),
      build: state.slots.map(s => (s ? PARTS[s.type].name : null)),
      buildSignature: signature,
      editsSincePrevious: state.edits.total,
      editBreakdown: { ...state.edits }
    });
    state.edits = newEdits();

    const result = simulateBattle({
      slots: state.slots, hp: state.hp, maxHp: state.maxHp, enemy, rng
    });

    const hpBefore = state.hp;
    state.hp = result.hp;
    const expected = predictionLevel(action.prediction);
    // 巡回数も渡す。打切り間際の勝ちを「圧勝」と記録すると、
    // 指標も画面も実態からずれる（RELAY の実測で判明）。
    const actual = outcomeLevel(result.won, state.hp, result.cycles);
    const surprise = actual > expected ? "better" : actual < expected ? "worse" : "expected";

    const summary = {
      battleNumber: state.wave + 1, enemy: enemy.name, won: result.won,
      cycles: result.cycles, hpBefore, hpAfter: state.hp, hpLost: hpBefore - state.hp,
      enemyHpLeft: result.enemyHp, leftoverPower: result.power, leftoverHeat: result.heat,
      leftoverShield: result.shield, timedOut: result.timedOut,
      resources: result.resources,
      prediction: action.prediction, surprise,
      contributions: result.contributions.map(c => ({
        name: c.name, activations: c.activations, damage: c.damage,
        shield: c.shield, powerMade: c.powerMade, powerSpent: c.powerSpent,
        heatMade: c.heatMade, heatCooled: c.heatCooled, healing: c.healing
      })),
      log: condenseLog(result.log)
    };

    // 等級は罰ではなく志（P11）。ルールセットが持っていれば記録する。
    const grade = ruleset.gradeFor ? ruleset.gradeFor(result.won, hpBefore - state.hp) : null;
    summary.grade = grade;
    // その戦闘で試した並びの数。ここまで一度も観測できていなかった量である。
    const previews = state.previews.length;

    record("battle_ended", {
      enemy: enemy.name, won: result.won, cycles: result.cycles,
      hpBefore, hpAfter: state.hp, enemyHpLeft: result.enemyHp,
      prediction: action.prediction, expectedLevel: expected, actualLevel: actual, surprise,
      buildSignature: signature, worry: action.worry,
      grade: grade ? grade.label : null, gradeRank: grade ? grade.rank : null,
      previewCount: previews,
      previewsAfterFirstWin: state.previewsAfterFirstWin,
      previewTrail: state.previews.slice(-40),
      contributions: summary.contributions
    });
    state.previews = [];
    state.previewsAfterFirstWin = 0;
    state.sawWinningPreview = false;

    state.lastBattle = summary;
    state.battles.push(summary);

    if (!result.won) {
      state.phase = "end";
      state.done = true;
      state.won = false;
      record("run_ended", { won: false, reached: state.wave + 1 });
      return { ok: true, battle: summary, observation: observe() };
    }

    state.hp = Math.min(state.maxHp, state.hp + WIN_HEAL);
    if (state.wave >= ENEMIES.length - 1) {
      state.phase = "end";
      state.done = true;
      state.won = true;
      record("run_ended", { won: true, reached: ENEMIES.length });
      return { ok: true, battle: summary, observation: observe() };
    }

    state.wave += 1;
    state.phase = "reward";
    const types = [];
    while (types.length < REWARD_CHOICES) {
      const next = weightedType(types);
      if (!types.includes(next)) types.push(next);
    }
    state.offer = types.map(makePart);
    record("reward_offered", { offered: types.map(t => PARTS[t].name) });
    return { ok: true, battle: summary, observation: observe() };
  }

  function actReward(action) {
    const type = action?.type;
    const offered = state.offer.map(p => PARTS[p.type].name);
    if (type === "take") {
      const index = Number(action.choice) - 1;
      if (!(index >= 0 && index < state.offer.length)) return fail(`choice must be 1..${state.offer.length}`);
      if (!UPDATE_KINDS.includes(action.update)) return fail(`update must be one of ${UPDATE_KINDS.join("|")}`);
      const instance = state.offer[index];
      instance.acquiredWave = state.wave;
      state.inventory.push(instance);
      state.rewards.push({ offered, chosen: PARTS[instance.type].name, update: action.update });
      record("reward_chosen", {
        offered, chosen: PARTS[instance.type].name,
        passed: offered.filter((_, i) => i !== index),
        reason: String(action.reason || "").slice(0, 300),
        update: action.update, updateText: String(action.updateText || "").slice(0, 300)
      });
      state.offer = null;
      state.phase = "build";
      return { ok: true, observation: observe() };
    }
    if (type === "skipAll") {
      state.scrap += 2;
      state.rewards.push({ offered, chosen: null, update: "none" });
      record("reward_scrapped", {
        offered, reason: String(action.reason || "").slice(0, 300)
      });
      state.offer = null;
      state.phase = "build";
      return { ok: true, observation: observe() };
    }
    return fail(`unknown action "${type}" in reward phase`);
  }

  // 資源名はルールセットごとに違うので、after に入っている物だけを並べる。
  const RESOURCE_LABELS = { power: "電", heat: "熱", shield: "装", bus: "帯", hp: null, enemyHp: null };

  function condenseLog(log) {
    return log.map(entry => {
      if (entry.type === "enemy") return `巡${entry.cycle} 敵:${entry.part} ${entry.text}（残HP ${entry.after.hp}）`;
      const where = entry.slot === null ? "" : ` 枠${entry.slot + 1}`;
      const cost = entry.cost === undefined ? "" : `(帯${entry.cost})`;
      const state = Object.entries(entry.after)
        .filter(([key, value]) => RESOURCE_LABELS[key] && value !== undefined)
        .map(([key, value]) => `${RESOURCE_LABELS[key]}${value}`).join(" ");
      // 数字が出ない効果（遮蔽・回復・加算）もログに出す。
      // 出ていないと、効いたのかどうかをプレイヤーが確かめられない。
      // 法則で倍率が乗ったなら、それをログに出す。
      // **法則は毎ラン変わるので、読んで覚えるのではなく、動いているのを見て分かる必要がある。**
      const boost = entry.gain && entry.gain !== 1 ? `×${entry.gain} ` : "";
      const bits = [
        entry.damage ? `${boost}${entry.damage}ダメージ` : "",
        entry.shieldGained ? `${boost}遮蔽+${entry.shieldGained}` : "",
        entry.healed ? `${boost}回復+${entry.healed}` : "",
        entry.selfDamage ? `自傷${entry.selfDamage}` : "",
        entry.boostUsed ? `＋${entry.boostUsed}を受けた` : "",
        entry.boostSet ? `次へ＋${entry.boostSet}` : ""
      ].filter(Boolean).join(" / ");
      const hit = bits ? `（${bits}）` : "";
      return `巡${entry.cycle}${where} ${entry.part}${cost}：${entry.text}${hit} → 敵HP${entry.after.enemyHp}${state ? " " + state : ""}`;
    });
  }

  function finish(survey = {}) {
    record("survey", {
      // 面白さと継続は別物（作者の指摘）。1つに混ぜると、天井のせいで落ちた点を
      // 「ゲームが面白くなくなった」と読み違える。
      fun: Number(survey.fun || 0),
      replay: Number(survey.replay || 0),
      gapReason: String(survey.gapReason || "").slice(0, 300),
      bestMoment: String(survey.bestMoment || "").slice(0, 300),
      pivot: String(survey.pivot || ""),
      settledAt: String(survey.settledAt || ""),
      runStory: String(survey.runStory || "").slice(0, 500),
      friction: String(survey.friction || "").slice(0, 300),
      wishlist: String(survey.wishlist || "")
    });
    return traceOut();
  }

  function traceOut() {
    return {
      seed: state.seed, ruleset: state.ruleset, playerId: state.playerId,
      won: state.won, reached: state.wave + 1, finalHp: state.hp,
      battles: state.battles.map(b => ({ ...b, log: undefined })),
      rewards: state.rewards, events: state.trace
    };
  }

  return { observe, act, finish, trace: traceOut, get done() { return state.done; } };
}
