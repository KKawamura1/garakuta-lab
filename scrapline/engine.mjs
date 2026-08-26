/**
 * SCRAPLINE 0.4 — deterministic train-line simulation.
 *
 * The engine deliberately keeps the cause chain visible: a single lump is
 * passed through the cars in order, then the result is fired and (sometimes)
 * brought back through the line.  The UI can therefore show exactly why a
 * volley worked or failed instead of exposing an opaque score formula.
 */

export const VERSION = "scrapline-0.4";
export const BUILD_STAMP = "scrapline-build-20260827-r4";
export const MAX_STAGES = 7;
export const MAX_CARS = 5;
export const MAX_HULL = 8;
// Five volleys leave room for a deliberate comeback line while the physical
// travel penalty still makes a slow, single-shot train pay for every miss.
export const MAX_VOLLEYS = 5;

const STARTER_PATTERNS = [["charge"], ["accelerator"]];

const CAR_EFFECTS = {
  accelerator: ["speed"],
  cut: ["split"],
  press: ["compress"],
  charge: ["spark"],
  melt: ["melt", "blast"],
  magnet: ["return"],
  armor: ["armor"],
  collector: ["collect"],
  reverse: ["reverse"],
  loop: ["loop"],
  scar: ["scar"],
};

export const CARS = [
  {
    id: "accelerator",
    icon: "➜",
    name: "加速車",
    rarity: "starter",
    text: "弾速を1段階上げる。速い敵の照準を外しやすい。",
  },
  {
    id: "cut",
    icon: "✂",
    name: "切断車",
    rarity: "common",
    text: "鉄塊を2つに割る。火花も分けて、手数を増やす。",
  },
  {
    id: "press",
    icon: "▣",
    name: "圧縮車",
    rarity: "common",
    text: "複数の鉄片を1つに圧縮。装甲敵へ重い一撃。",
  },
  {
    id: "charge",
    icon: "⚡",
    name: "帯電車",
    rarity: "common",
    text: "鉄片に火花を1つ灯す。溶解車の燃料にもなる。",
  },
  {
    id: "melt",
    icon: "♨",
    name: "溶解車",
    rarity: "common",
    text: "火花をまとった鉄片を溶かし、着弾時の爆風を生む。",
  },
  {
    id: "magnet",
    icon: "⌁",
    name: "磁石車",
    rarity: "common",
    text: "着弾後の鉄片を列車へ呼び戻す。回収・逆走の起点。",
  },
  {
    id: "armor",
    icon: "⬟",
    name: "装甲車",
    rarity: "common",
    text: "最も小さい鉄片を装甲板へ変換し、被弾を1回受け止める。",
  },
  {
    id: "collector",
    icon: "◒",
    name: "回収車",
    rarity: "common",
    text: "戻ってきた鉄片を次の発射へ持ち越す。小さな弾を育てる。",
  },
  {
    id: "reverse",
    icon: "↶",
    name: "逆走車",
    rarity: "rare",
    text: "磁石で戻った弾が、車両を逆順にも一度通る。",
  },
  {
    id: "loop",
    icon: "∞",
    name: "ループ車",
    rarity: "rare",
    text: "自分より後ろの加工を、発射前にもう一周だけやり直す。",
  },
  {
    id: "scar",
    icon: "✹",
    name: "傷跡車",
    rarity: "rare",
    text: "傷ついた列車ほど、次の鉄塊に重さを1つ足す。",
  },
];

const CAR_BY_ID = new Map(CARS.map((car) => [car.id, car]));

export const CHALLENGES = [
  {
    id: "sparrows",
    name: "鉄くずスズメ",
    kind: "swarm",
    icon: "🐦",
    motion: "小型機が三方向へ散り、後尾へ回り込む",
    text: "小型機が散っている。手数か爆風でまとめて落とせ。",
    waves: [
      { id: "sparrow-pack", name: "スズメの群れ", hp: 7, armor: 0, count: 3, attack: 1 },
    ],
  },
  {
    id: "plate",
    name: "廃工場の盾",
    kind: "armor",
    icon: "⬟",
    motion: "厚い盾が正面で弾を受け、ゆっくり迫る",
    text: "分厚い装甲板が正面を覆う。圧縮か溶解が答えになる。",
    waves: [
      { id: "plate", name: "装甲運搬車", hp: 10, armor: 1, count: 1, attack: 1 },
    ],
  },
  {
    id: "cannon",
    name: "赤錆キャノン",
    kind: "fast",
    icon: "◈",
    motion: "照準線が先頭車へ走り、三拍で撃つ",
    text: "照準が早い。短い通過時間で撃ち返される前に壊せ。",
    waves: [
      { id: "cannon", name: "赤錆砲台", hp: 8, armor: 1, count: 1, attack: 1, fast: true },
    ],
  },
  {
    id: "scavengers",
    name: "拾い屋の列",
    kind: "scavenger",
    icon: "🦾",
    motion: "残骸を拾いながら後尾へ寄る二台組",
    text: "こちらの弾を拾って回復する。磁石と回収車で逆に利用できる。",
    waves: [
      { id: "scavenger-a", name: "拾い屋A", hp: 4, armor: 1, count: 1, attack: 1, steal: true },
      { id: "scavenger-b", name: "拾い屋B", hp: 4, armor: 1, count: 1, attack: 1, steal: true },
    ],
  },
  {
    id: "splitter",
    name: "分解クレーン",
    kind: "split",
    icon: "⚒",
    motion: "当たった残骸を吊り上げ、小型機へ組み直す",
    text: "殴るほど敵が増える。圧縮してから撃つか、溶かして一掃。",
    waves: [
      { id: "splitter", name: "分解クレーン", hp: 5, armor: 1, count: 1, attack: 1, splits: true },
    ],
  },
  {
    id: "yard",
    name: "夜間ヤード",
    kind: "mixed",
    icon: "⚠",
    motion: "群れが視界を塞ぎ、背後から装甲機が加速する",
    text: "速い小型機と装甲機が同時に来る。車列の順番が問われる。",
    waves: [
      { id: "yard-swarm", name: "ヤードの群れ", hp: 7, armor: 0, count: 3, attack: 1 },
      { id: "yard-guard", name: "ヤードの守衛", hp: 8, armor: 1, count: 1, attack: 1, fast: true },
    ],
  },
  {
    id: "core",
    name: "炉心を喰う王",
    kind: "boss",
    icon: "♛",
    motion: "護衛を盾にして炉心砲を二拍ごとに撃つ",
    text: "拾った鉄くずを王冠にする巨体。ここまでの車列を一つの答えに変えろ。",
    waves: [
      { id: "core-guard", name: "炉心の護衛", hp: 9, armor: 1, count: 1, attack: 1 },
      { id: "core-king", name: "炉心を喰う王", hp: 22, armor: 1, count: 1, attack: 2, fast: true, boss: true },
    ],
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hash(seed, salt = 0) {
  let value = (Number(seed) >>> 0) ^ (Number(salt) * 0x9e3779b9);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function randomUnit(seed, salt = 0) {
  return hash(seed, salt) / 0x100000000;
}

function carFor(id) {
  return CAR_BY_ID.get(id) || CARS[0];
}

function projectileSignature(projectiles) {
  return projectiles
    .map((p) => `${p.mass}${p.splitCount ? `◆${p.splitCount}` : ""}${p.sparks ? `⚡${p.sparks}` : ""}${p.mode === "molten" ? "♨" : ""}${p.returning ? "↩" : ""}${p.returnBlast ? "💥" : ""}${Math.abs((p.speed || 1) - 1) > 0.05 ? `×${Number(p.speed).toFixed(1)}` : ""}`)
    .join(" + ") || "空";
}

function projectileSnapshot(projectiles) {
  return projectiles.map((p) => ({
    id: p.id,
    mass: p.mass,
    sparks: p.sparks,
    mode: p.mode,
    splitCount: p.splitCount || 0,
    returning: Boolean(p.returning),
    returnBlast: Boolean(p.returnBlast),
    speed: Number((p.speed || 1).toFixed(2)),
  }));
}

function makeProjectile(id, mass = 2) {
  return { id, mass, sparks: 0, mode: "solid", splitCount: 0, returning: false, returnBlast: false, speed: 1, collected: false };
}

function spectacleFor(carIds, projectiles) {
  const count = projectiles.length;
  const molten = projectiles.filter((projectile) => projectile.mode === "molten").length;
  const returning = projectiles.filter((projectile) => projectile.returning).length;
  const sparks = projectiles.reduce((total, projectile) => total + (projectile.sparks || 0), 0);
  const level = Math.max(1, Math.min(5, Math.ceil((carIds.length + count + molten * 2 + returning * 2 + sparks) / 3)));
  const theme = returning && molten ? "return-blast" : returning ? "return" : molten ? "molten" : count > 1 ? "split" : "solid";
  return { level, theme, projectileCount: count, molten, returning, sparks, carCount: carIds.length };
}

function logCarEvent(events, car, path, before, after, note, context, index) {
  events.push({
    type: "car",
    carId: car.id,
    carName: car.name,
    icon: car.icon,
    path,
    carIndex: index,
    train: [...(context.activeCars || [])],
    effects: [...(CAR_EFFECTS[car.id] || [])],
    location: { lane: path === "reverse" ? "return" : "train", carIndex: index },
    before,
    after,
    beforeProjectiles: projectileSnapshot(context.beforeProjectiles || []),
    afterProjectiles: projectileSnapshot(context.afterProjectiles || []),
    note,
  });
}

function applyCar(carId, projectiles, context, path = "forward", index = 0) {
  const car = carFor(carId);
  const before = projectileSignature(projectiles);
  context.beforeProjectiles = projectiles;
  let next = projectiles;
  let note = car.text;

  if (car.id === "accelerator") {
    next = projectiles.map((projectile) => ({ ...projectile, speed: Math.min(3, (projectile.speed || 1) + 1) }));
    note = "全ての弾速 +1。速い敵の照準を外しやすい";
  } else if (car.id === "cut") {
    next = projectiles.flatMap((projectile) => {
      // A shard can be split again on a loop/return pass, but it cannot
      // multiply forever. Three generations are enough to make the late-run
      // machine visibly different (up to eight pellets) without making the
      // first cut an automatic answer.
      if ((projectile.splitCount || 0) >= 3) return [projectile];
      const fragmentSpeed = Math.max(0.6, (projectile.speed || 1) * 0.85);
      const splitCount = (projectile.splitCount || 0) + 1;
      const first = { ...projectile, mass: Math.max(1, Math.ceil(projectile.mass / 2)), sparks: Math.ceil(projectile.sparks / 2), splitCount, mode: "solid", speed: fragmentSpeed };
      const second = { ...projectile, id: `${projectile.id}-b`, mass: Math.max(1, Math.floor(projectile.mass / 2)), sparks: Math.floor(projectile.sparks / 2), splitCount, mode: "solid", speed: fragmentSpeed };
      return [first, second];
    });
    note = `${projectiles.length}個 → ${next.length}個。分かれた弾は少し減速（第${Math.max(...next.map((projectile) => projectile.splitCount || 0), 0)}世代）`;
  } else if (car.id === "press") {
    if (projectiles.length > 1) {
      const merged = projectiles.reduce((total, p) => ({
        ...total,
        mass: total.mass + p.mass,
        sparks: total.sparks + p.sparks,
      }), { ...projectiles[0], id: `${projectiles[0].id}-pressed` });
      next = [merged];
    }
    note = `合金の重さ ${next[0]?.mass ?? 0}`;
  } else if (car.id === "charge") {
    next = projectiles.map((projectile) => ({ ...projectile, sparks: projectile.sparks + 1 }));
    note = "全てに火花 +1";
  } else if (car.id === "melt") {
    next = projectiles.map((projectile) => {
      if (projectile.sparks > 0) return { ...projectile, mode: "molten", sparks: 0 };
      if (projectile.returning) return { ...projectile, mode: "molten", returnBlast: true };
      return projectile;
    });
    note = next.some((p) => p.mode === "molten")
      ? (next.some((p) => p.returnBlast) ? "戻り弾に溶解火薬を仕込んだ" : "溶けた弾は着弾時に爆風")
      : "火花がなく、変化なし";
  } else if (car.id === "magnet") {
    next = projectiles.map((projectile) => ({ ...projectile, returning: true }));
    note = "着弾後に戻る印をつけた。後ろの溶解車なら帰り道で炸裂";
  } else if (car.id === "armor") {
    if (projectiles.length > 1 || projectiles[0]?.mass > 1) {
      const indexToConsume = projectiles.reduce((smallest, projectile, candidate) => projectile.mass < projectiles[smallest].mass ? candidate : smallest, 0);
      const consumed = projectiles[indexToConsume];
      next = projectiles.filter((_, candidate) => candidate !== indexToConsume);
      context.armorGain += Math.max(1, consumed.mass);
      note = `鉄片 ${consumed.mass} を装甲板へ`;
    } else {
      note = "鉄片が小さすぎて装甲化できない";
    }
  } else if (car.id === "collector") {
    next = projectiles.map((projectile) => ({ ...projectile, collected: true }));
    note = "戻った弾を次弾の材料にする印";
  } else if (car.id === "reverse") {
    context.reverseOnReturn = true;
    note = "戻り道も車列を逆順に通る";
  } else if (car.id === "loop") {
    context.loopIndex = index;
    note = "この車両より後ろ側の加工を発射前にもう一周";
  } else if (car.id === "scar") {
    if (context.hull < MAX_HULL) {
      note = "傷ついた列車なので積載済みの鉄塊が +1";
    } else {
      note = "まだ無傷なので待機";
    }
  }

  // Processing cars change the payload, but do not each add a full enemy
  // tick. A long train should feel richer, not become an automatic loss.
  if (car.id === "loop") context.loopPenalty += 1;
  context.afterProjectiles = next;
  logCarEvent(context.events, car, path, before, projectileSignature(next), note, context, index);
  return next;
}

function processLine(carIds, projectiles, context, path = "forward", from = 0, to = carIds.length) {
  let next = projectiles;
  const step = from <= to ? 1 : -1;
  const beforeEnd = from <= to ? (index) => index < to : (index) => index > to;
  for (let index = from; beforeEnd(index); index += step) {
    next = applyCar(carIds[index], next, context, path, index);
  }
  return next;
}

function damageFor(projectile) {
  // A single spark is a fuse, not free damage. It only becomes extra force
  // after a second charge (or after melt consumes it into a blast), so a
  // starter charge cannot brute-force every encounter by itself.
  const base = projectile.mass + Math.max(0, (projectile.sparks || 0) - 1);
  return projectile.mode === "molten" ? base + 3 + (projectile.returnBlast ? 2 : 0) : base;
}

function hitEnemy(enemy, projectile, context) {
  const raw = damageFor(projectile);
  const armorCut = projectile.mode === "molten" ? 0 : enemy.armor;
  const damage = Math.max(1, raw - armorCut);
  enemy.hp -= damage;
  if (enemy.count > 1) enemy.count = Math.max(0, enemy.count - Math.max(1, Math.floor(damage / 2)));
  context.events.push({
    type: "impact",
    target: enemy.name,
    damage,
    raw,
    armor: armorCut,
    projectile: { ...projectile },
    projectileId: projectile.id,
    location: { lane: "enemy", offset: Number(((context.waveIndex || 0) * 0.17 + 0.42).toFixed(2)) },
    note: projectile.mode === "molten" ? "溶解弾の爆風が周囲にも届いた" : "正面に命中",
  });
  if (projectile.mode === "molten" && enemy.count > 1) enemy.count = Math.max(0, enemy.count - 1);
  if (enemy.splits && enemy.hp > 0 && !enemy.splitDone && raw >= 2) {
    enemy.splitDone = true;
    enemy.hp += 2;
    enemy.count += 1;
    context.events.push({ type: "enemy_split", target: enemy.name, amount: 2, note: "分解クレーンが残骸から小型機を組み立てた" });
  }
  if (enemy.steal && projectile.mode !== "molten" && !context.hasCollector) {
    enemy.hp += 1;
    context.events.push({ type: "enemy_recover", target: enemy.name, amount: 1, note: "拾い屋が命中後の残骸を拾った" });
  }
}

function enemyDefeated(enemy) {
  // `count` is the visible unit count for a swarm. A lone machine cannot be
  // deleted just because one blast touched it; it must actually lose its HP.
  return enemy.hp <= 0 || (enemy.count > 1 && enemy.count <= 0);
}

function simulateVolley(state, challenge, enemy, volleyIndex, waveIndex = 0) {
  const events = [];
  const context = {
    events,
    activeCars: [...state.activeCars],
    baseTravel: Math.max(1, state.activeCars.length),
    travel: 1,
    loopPenalty: 0,
    armorGain: 0,
    collectedMass: 0,
    reverseOnReturn: false,
    loopIndex: null,
    scarBonus: state.activeCars.includes("scar") && state.hull < MAX_HULL ? 1 : 0,
    hull: state.hull,
    hasCollector: state.activeCars.includes("collector"),
    waveIndex,
  };
  const startingMass = 2 + (state.storedMass || 0) + context.scarBonus;
  let projectiles = [makeProjectile(`s${state.stage}-v${volleyIndex}`, startingMass)];
  events.push({
    type: "volley",
    volley: volleyIndex + 1,
    before: projectileSignature(projectiles),
    projectiles: projectileSnapshot(projectiles),
    location: { lane: "hopper", offset: 0 },
    note: "後部ホッパーから鉄塊が1つ入った",
  });
  projectiles = processLine(state.activeCars, projectiles, context, "forward");

  if (context.loopIndex !== null && context.loopIndex < state.activeCars.length - 1) {
    events.push({ type: "loop", carIndex: context.loopIndex, train: [...state.activeCars], note: "ループ車が後ろ側の加工をやり直す", from: context.loopIndex + 1 });
    projectiles = processLine(state.activeCars, projectiles, context, "loop", context.loopIndex + 1, state.activeCars.length);
  }

  const meanSpeed = projectiles.length
    ? projectiles.reduce((total, projectile) => total + (projectile.speed || 1), 0) / projectiles.length
    : 1;
  context.travel = Math.max(1, Number(((context.baseTravel + context.loopPenalty) / Math.max(0.5, meanSpeed)).toFixed(2)));

  events.push({
    type: "fire",
    travel: context.travel,
    projectiles: projectileSnapshot(projectiles),
    summary: projectileSignature(projectiles),
    train: [...state.activeCars],
    spectacle: spectacleFor(state.activeCars, projectiles),
    location: { lane: "cannon", offset: 1 },
    note: "先頭砲から発射",
  });
  for (const projectile of projectiles) hitEnemy(enemy, projectile, context);

  const returners = projectiles.filter((projectile) => projectile.returning);
  if (returners.length) {
    let returned = returners.map((projectile) => ({ ...projectile, returning: false }));
    events.push({
      type: "return",
      summary: projectileSignature(returned),
      projectiles: projectileSnapshot(returned),
      train: [...state.activeCars],
      path: "return",
      location: { lane: "enemy", offset: 0.72 },
      note: "磁石が着弾後の鉄片を呼び戻す",
    });
    if (context.reverseOnReturn) {
      returned = processLine(state.activeCars, returned, context, "reverse", state.activeCars.length - 1, -1);
      events.push({
        type: "return_reprocess",
        summary: projectileSignature(returned),
        projectiles: projectileSnapshot(returned),
        train: [...state.activeCars],
        path: "reverse",
        spectacle: spectacleFor(state.activeCars, returned),
        location: { lane: "train", offset: 0.5 },
        note: "逆走車が戻り弾を車列へ通し直した",
      });
      for (const projectile of returned) hitEnemy(enemy, projectile, context);
    }
    if (state.activeCars.includes("collector")) {
      context.collectedMass += returned.reduce((total, projectile) => total + (projectile.collected ? projectile.mass : 0), 0);
    }
  }

  return {
    events,
    enemy,
    travel: context.travel,
    armorGain: context.armorGain,
    collectedMass: context.collectedMass,
    nextStoredMass: Math.min(3, context.collectedMass),
    projectiles,
  };
}

function enemyFrom(definition) {
  return clone(definition);
}

export function challengeFor(stage, seed = null) {
  const safeStage = Math.max(0, Math.min(CHALLENGES.length - 1, stage));
  // The first question is always the readable swarm tutorial. Later questions
  // permute deterministically so a run changes its pressure without making the
  // first screen an accidental hard wall.
  if (safeStage === 0 || safeStage === CHALLENGES.length - 1 || seed === null || seed === undefined || seed === "") {
    return CHALLENGES[safeStage];
  }
  // Keep the boss at the end, but make the first six questions seed-dependent.
  // A deterministic permutation changes the question, never the combat rules.
  const order = CHALLENGES.slice(1, -1)
    .map((challenge, index) => ({ challenge, score: hash(seed, 700 + index * 31) }))
    .sort((a, b) => a.score - b.score);
  const yardIndex = order.findIndex((entry) => entry.challenge.id === "yard");
  if (yardIndex >= 0 && yardIndex !== order.length - 1) {
    const [yard] = order.splice(yardIndex, 1);
    order.push(yard);
  }
  return order[safeStage - 1].challenge;
}

export function carById(carId) {
  return carFor(carId);
}

export function previewTrain(state, projectile = null) {
  const safeState = clone(state);
  const context = {
    events: [],
    activeCars: [...safeState.activeCars],
    baseTravel: Math.max(1, safeState.activeCars.length),
    travel: 1,
    loopPenalty: 0,
    armorGain: 0,
    collectedMass: 0,
    reverseOnReturn: false,
    loopIndex: null,
    scarBonus: safeState.activeCars.includes("scar") && safeState.hull < MAX_HULL ? 1 : 0,
    hull: safeState.hull,
    hasCollector: safeState.activeCars.includes("collector"),
  };
  let projectiles = projectile ? [clone(projectile)] : [makeProjectile("preview", 2 + context.scarBonus)];
  projectiles = processLine(safeState.activeCars, projectiles, context);
  if (context.loopIndex !== null && context.loopIndex < safeState.activeCars.length - 1) {
    projectiles = processLine(safeState.activeCars, projectiles, context, "loop", context.loopIndex + 1, safeState.activeCars.length);
  }
  const meanSpeed = projectiles.length
    ? projectiles.reduce((total, projectile) => total + (projectile.speed || 1), 0) / projectiles.length
    : 1;
  context.travel = Math.max(1, Number(((context.baseTravel + context.loopPenalty) / Math.max(0.5, meanSpeed)).toFixed(2)));
  return {
    events: context.events,
    summary: projectileSignature(projectiles),
    travel: context.travel,
    projectiles: projectileSnapshot(projectiles),
  };
}

export function offersFor(state) {
  const available = CARS.filter((car) => car.rarity !== "starter" && !state.activeCars.includes(car.id));
  const pool = available.length ? available : CARS.filter((car) => car.rarity !== "starter");
  const ranked = pool
    .map((car, index) => ({ car, score: hash(state.seed, state.stage * 37 + index * 17 + car.id.length) }))
    .sort((a, b) => a.score - b.score);
  const offers = [];
  // The first few salvage screens contain up to two legible answers to the
  // next threat, but their position is seed-dependent. A player can learn
  // the language without being handed one solved build order.
  const counters = {
    swarm: ["charge", "cut"],
    armor: ["melt", "press", "cut"],
    fast: ["melt", "charge", "cut"],
    scavenger: ["collector", "melt", "reverse"],
    split: ["melt", "press", "cut"],
    mixed: ["melt", "charge", "cut"],
    boss: ["reverse", "collector", "melt"],
  };
  const counterPool = (counters[challengeFor(state.stage, state.seed).kind] || [])
    .filter((id) => !state.activeCars.includes(id) && pool.some((car) => car.id === id));
  // Surface every readable answer to the next question when it exists. The
  // player still chooses one car (and the remaining slots are seed-noise),
  // but a seed must never hide the only viable physical verb.
  const counterCount = Math.min(3, counterPool.length);
  const counterOffset = counterPool.length ? hash(state.seed, state.stage * 101 + 53) % counterPool.length : 0;
  for (let index = 0; index < counterCount; index += 1) {
    offers.push(carFor(counterPool[(counterOffset + index) % counterPool.length]));
  }
  for (const entry of ranked) {
    if (offers.some((car) => car.id === entry.car.id)) continue;
    offers.push(entry.car);
    if (offers.length === 3) break;
  }
  return offers
    .map((car, index) => ({ car, score: hash(state.seed, state.stage * 211 + index * 19 + car.id.length) }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.car);
}

export function createGame(seed = null) {
  const parsedSeed = Number(seed);
  const hasSeed = seed !== null && seed !== undefined && seed !== "" && Number.isFinite(parsedSeed);
  const normalizedSeed = hasSeed ? (parsedSeed >>> 0) : (Date.now() >>> 0);
  const starterCars = [...STARTER_PATTERNS[hash(normalizedSeed, 11) % STARTER_PATTERNS.length]];
  return {
    version: VERSION,
    buildStamp: BUILD_STAMP,
    seed: normalizedSeed,
    stage: 0,
    phase: "build",
    hull: MAX_HULL,
    armor: 0,
    storedMass: 0,
    activeCars: starterCars,
    starterPattern: starterCars[0],
    offers: [],
    selectedOffer: null,
    lastBattle: null,
    battleHistory: [],
    carHistory: [],
    moveCount: 0,
    rebuildCount: 0,
    previewCount: 0,
    swapCount: 0,
    done: false,
    won: false,
    reason: null,
    survey: null,
    markers: [],
    events: [],
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
}

export function moveCar(state, from, to) {
  const next = clone(state);
  if (from < 0 || from >= next.activeCars.length || to < 0 || to >= next.activeCars.length || from === to) return next;
  const [car] = next.activeCars.splice(from, 1);
  next.activeCars.splice(to, 0, car);
  next.moveCount += 1;
  next.carHistory.push({ action: "move", carId: car, from, to, stage: next.stage });
  delete next.preview;
  next.events.push({ type: "move", from, to, carId: car });
  return next;
}

export function removeCar(state, index) {
  const next = clone(state);
  if (index < 0 || index >= next.activeCars.length || next.activeCars.length <= 1) return next;
  const [car] = next.activeCars.splice(index, 1);
  delete next.preview;
  next.carHistory.push({ action: "remove", carId: car, index, stage: next.stage });
  next.events.push({ type: "remove", index, carId: car });
  next.rebuildCount += 1;
  return next;
}

export function installCar(state, carId, slot = null) {
  const next = clone(state);
  if (!CAR_BY_ID.has(carId) || next.activeCars.includes(carId)) return next;
  if (slot !== null && Number.isInteger(slot) && slot >= 0 && slot < next.activeCars.length) {
    const replaced = next.activeCars[slot];
    next.activeCars[slot] = carId;
    next.swapCount += 1;
    next.carHistory.push({ action: "replace", carId, replaced, slot, stage: next.stage });
  } else if (next.activeCars.length < MAX_CARS) {
    next.activeCars.push(carId);
    next.carHistory.push({ action: "append", carId, slot: next.activeCars.length - 1, stage: next.stage });
  } else {
    return next;
  }
  next.rebuildCount += 1;
  delete next.preview;
  next.offers = [];
  next.selectedOffer = carId;
  next.phase = "build";
  next.events.push({ type: "install", carId, slot });
  return next;
}

export function skipReward(state) {
  const next = clone(state);
  next.carHistory.push({ action: "skip", stage: next.stage });
  next.offers = [];
  next.selectedOffer = "skip";
  next.phase = "build";
  delete next.preview;
  next.events.push({ type: "skip_reward", stage: next.stage });
  return next;
}

function enemyDamage(enemy, travel) {
  const late = Math.max(0, Math.ceil(travel) - 3);
  let damage = enemy.attack + (enemy.fast && travel > 1.1 ? 1 : 0);
  if (late > 0) damage += late;
  return damage;
}

export function runBattle(state) {
  if (state.done || state.phase !== "build") return { state: clone(state), report: state.lastBattle };
  const next = clone(state);
  const challenge = challengeFor(next.stage, next.seed);
  const events = [{
    type: "battle_start",
    challenge: challenge.name,
    challengeId: challenge.id,
    kind: challenge.kind,
    enemyIcon: challenge.icon,
    motion: challenge.motion,
    icon: challenge.icon,
    stage: next.stage + 1,
    train: [...next.activeCars],
    note: challenge.text,
  }];
  let hull = next.hull;
  let armor = next.armor;
  let storedMass = next.storedMass || 0;
  const waveReports = [];
  let won = true;
  for (let waveIndex = 0; waveIndex < challenge.waves.length; waveIndex += 1) {
    const enemy = enemyFrom(challenge.waves[waveIndex]);
    const waveEvents = [];
    let waveWon = false;
    for (let volley = 0; volley < MAX_VOLLEYS; volley += 1) {
      const volleyResult = simulateVolley({ ...next, hull, armor, storedMass }, challenge, enemy, volley, waveIndex);
      waveEvents.push(...volleyResult.events);
      events.push(...volleyResult.events.map((event) => ({ ...event, wave: waveIndex })));
      armor += volleyResult.armorGain;
      storedMass = volleyResult.nextStoredMass;
      if (enemyDefeated(enemy)) {
        waveWon = true;
        events.push({ type: "wave_clear", wave: waveIndex, target: enemy.name, note: `${enemy.name}を撃破` });
        break;
      }
      let attack = enemyDamage(enemy, volleyResult.travel);
      const absorbed = Math.min(armor, attack);
      armor -= absorbed;
      attack -= absorbed;
      hull -= attack;
      const targetCarIndex = next.activeCars.length
        ? Math.max(0, next.activeCars.length - 1 - ((waveIndex + volley) % next.activeCars.length))
        : null;
      events.push({
        type: "enemy_shell",
        wave: waveIndex,
        target: enemy.name,
        targetCarIndex,
        targetCarId: targetCarIndex === null ? null : next.activeCars[targetCarIndex],
        projectile: {
          id: `enemy-${waveIndex}-${volley}`,
          mass: Math.max(1, attack + absorbed),
          mode: "enemy-shell",
          speed: Number((1 / Math.max(1, volleyResult.travel)).toFixed(2)),
        },
        location: { lane: "enemy", carIndex: targetCarIndex, offset: 0.8 },
        note: `${enemy.name}の攻撃弾が列車へ向かう`,
      });
      let convertedMass = 0;
      // An armour plate is not a dead-end meter: when it catches a shell, a
      // piece of that impact becomes material for the next visible volley.
      // This is the concrete “enemy attack becomes a bullet” turn in the
      // late-run machine, and is capped to one lump per hit.
      if (absorbed > 0 && next.activeCars.includes("armor")) {
        convertedMass = 1;
        storedMass = Math.min(3, storedMass + convertedMass);
      }
      events.push({
        type: "enemy_attack",
        wave: waveIndex,
        target: enemy.name,
        targetCarIndex,
        targetCarId: targetCarIndex === null ? null : next.activeCars[targetCarIndex],
        damage: attack,
        absorbed,
        convertedMass,
        hull,
        location: { lane: "train", carIndex: targetCarIndex },
        note: convertedMass
          ? `装甲が ${absorbed} 受け止め、鉄塊 +${convertedMass} を次弾へ戻した`
          : absorbed ? `装甲が ${absorbed} 受け止めた` : "車体に直撃",
      });
      if (hull <= 0) {
        won = false;
        break;
      }
    }
    waveReports.push({ id: enemy.id, name: enemy.name, won: waveWon, hp: enemy.hp, count: enemy.count });
    if (!waveWon || hull <= 0) {
      won = false;
      break;
    }
  }

  const repair = won ? Math.min(6, MAX_HULL - Math.max(0, hull)) : 0;
  hull += repair;
  if (repair) events.push({ type: "repair", amount: repair, hull, note: "区画のあいだに応急修理を入れた" });
  next.hull = Math.max(0, hull);
  next.armor = Math.max(0, armor);
  next.storedMass = Math.min(3, storedMass);
  next.lastBattle = {
    stage: next.stage + 1,
    challenge: challenge.name,
    challengeId: challenge.id,
    kind: challenge.kind,
    enemyIcon: challenge.icon,
    motion: challenge.motion,
    won,
    hullBefore: state.hull,
    hullAfter: next.hull,
    armorAfter: next.armor,
    waveReports,
    train: [...next.activeCars],
    spectacle: events
      .filter((event) => event.spectacle)
      .reduce((best, event) => event.spectacle.level > best.level ? event.spectacle : best, spectacleFor(next.activeCars, [])),
    events,
    highlight: events.filter((event) => ["car", "impact", "return", "return_reprocess", "enemy_recover", "enemy_split", "enemy_shell", "enemy_attack", "wave_clear"].includes(event.type)).slice(-12),
  };
  next.battleHistory.push({ stage: next.stage + 1, challenge: challenge.id, kind: challenge.kind, won, hull: next.hull, armor: next.armor, train: [...next.activeCars] });
  if (won) {
    next.stage += 1;
    if (next.stage >= MAX_STAGES) {
      next.done = true;
      next.won = true;
      next.phase = "report";
      next.reason = "7ステージ突破";
      next.endedAt = new Date().toISOString();
    } else {
      next.phase = "report";
      next.offers = offersFor(next);
    }
  } else {
    next.done = true;
    next.won = false;
    next.phase = "report";
    next.reason = next.hull <= 0 ? "列車が大破" : "敵を撃破できなかった";
    next.endedAt = new Date().toISOString();
  }
  next.lastBattle.events.push({ type: "battle_end", stage: next.stage, won, reason: next.reason || (won ? "次の残骸が開いた" : "列車が止まった") });
  next.events.push({ type: "battle_end", stage: next.stage, won, reason: next.reason });
  return { state: next, report: next.lastBattle };
}

export function continueFromReport(state) {
  const next = clone(state);
  if (next.phase !== "report") return next;
  if (next.done) {
    next.phase = "done";
    return next;
  }
  next.phase = "reward";
  next.offers = next.offers.length ? next.offers : offersFor(next);
  return next;
}

export function recordMarker(state, marker, note = "") {
  const next = clone(state);
  next.markers.push({ marker, note: String(note).slice(0, 500), stage: next.stage, at: new Date().toISOString() });
  next.events.push({ type: "marker", marker, note });
  return next;
}

export function recordSurvey(state, survey) {
  const next = clone(state);
  next.survey = { ...survey };
  next.events.push({ type: "survey", fields: Object.keys(next.survey) });
  return next;
}

function policyKey(state) {
  return [state.stage, state.phase, state.hull, state.armor, state.storedMass, state.activeCars.join(",")].join("|");
}

function canPolicyFinish(state, memo, depth = 0) {
  if (state.done) return Boolean(state.won);
  if (depth > MAX_STAGES * 5) return false;
  const key = policyKey(state);
  if (memo.has(key)) return memo.get(key);
  let result = false;
  if (state.phase === "build") {
    result = canPolicyFinish(runBattle(state).state, memo, depth + 1);
  } else if (state.phase === "report") {
    result = canPolicyFinish(continueFromReport(state), memo, depth + 1);
  } else if (state.phase === "reward") {
    const candidates = [];
    for (const offer of state.offers) {
      if (state.activeCars.length < MAX_CARS) {
        candidates.push(installCar(state, offer.id));
      } else {
        for (let slot = 0; slot < state.activeCars.length; slot += 1) candidates.push(installCar(state, offer.id, slot));
      }
    }
    candidates.push(skipReward(state));
    result = candidates.some((candidate) => canPolicyFinish(candidate, memo, depth + 1));
  }
  memo.set(key, result);
  return result;
}

function policyReward(state, memo) {
  const candidates = [];
  for (const offer of state.offers) {
    if (state.activeCars.length < MAX_CARS) {
      candidates.push({ state: installCar(state, offer.id), id: offer.id, slot: null });
    } else {
      for (let slot = 0; slot < state.activeCars.length; slot += 1) {
        candidates.push({ state: installCar(state, offer.id, slot), id: offer.id, slot });
      }
    }
  }
  candidates.push({ state: skipReward(state), id: "skip", slot: null });
  return candidates.find((candidate) => canPolicyFinish(candidate.state, memo)) || candidates[0];
}

export function recommendedPolicy(seed) {
  // This route finder is deliberately kept outside the UI. It gives the
  // regression suite a deterministic way to prove that a seed has at least
  // one winnable line, while the player still sees only three imperfectly
  // ordered salvage choices.
  let state = createGame(seed);
  const memo = new Map();
  for (let guard = 0; guard < MAX_STAGES * 5 && !state.done; guard += 1) {
    if (state.phase === "build") {
      state.preview = previewTrain(state);
      state.previewCount += 1;
      state = runBattle(state).state;
    } else if (state.phase === "report") {
      state = continueFromReport(state);
    } else if (state.phase === "reward") {
      state = policyReward(state, memo).state;
    }
  }
  return state;
}
