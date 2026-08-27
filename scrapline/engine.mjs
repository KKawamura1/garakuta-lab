/**
 * SCRAPLINE 0.6 — deterministic train-line simulation.
 *
 * The game is intentionally built from a small physical grammar. A single
 * lump enters at the rear, is transformed by the cars in order, is fired,
 * and can return through the line. Enemies ask different concrete questions:
 * number, weight, time, and whether the train can protect its tail.
 */

export const VERSION = "scrapline-0.7";
export const BUILD_STAMP = "scrapline-build-20260827-r7";
export const MAX_STAGES = 7;
export const MAX_CARS = 5;
export const MAX_HULL = 8;
export const MAX_VOLLEYS = 6;

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
    text: "弾速を1段階上げる。長い列でも速攻の照準を外しやすい。",
  },
  {
    id: "cut",
    icon: "✂",
    name: "切断車",
    rarity: "common",
    text: "鉄塊を2つに割る。重さと火花を分けて、手数を増やす。",
  },
  {
    id: "press",
    icon: "▣",
    name: "圧縮車",
    rarity: "common",
    text: "複数の弾を一つへまとめる。単発でも密度を上げる。",
  },
  {
    id: "charge",
    icon: "⚡",
    name: "帯電車",
    rarity: "common",
    text: "弾それぞれへ火花を一つ加える。溶解の燃料になる。",
  },
  {
    id: "melt",
    icon: "♨",
    name: "溶解車",
    rarity: "common",
    text: "火花を熱へ変え、装甲を抜く溶解弾と爆風を作る。",
  },
  {
    id: "magnet",
    icon: "⌁",
    name: "磁石車",
    rarity: "common",
    text: "着弾後の弾へ戻る印をつける。帰路の起点になる。",
  },
  {
    id: "armor",
    icon: "⬟",
    name: "装甲車",
    rarity: "common",
    text: "最も小さい弾を装甲板へ変え、狙われた車両を守る。",
  },
  {
    id: "collector",
    icon: "◒",
    name: "回収車",
    rarity: "common",
    text: "戻った弾を次の鉄塊へ足す。拾い屋から車列を守る。",
  },
  {
    id: "reverse",
    icon: "↶",
    name: "逆走車",
    rarity: "rare",
    text: "磁石で戻った弾を、車両の逆順へもう一度通す。",
  },
  {
    id: "loop",
    icon: "∞",
    name: "ループ車",
    rarity: "rare",
    text: "自分より後ろの加工だけを、発射前にもう一周する。",
  },
  {
    id: "scar",
    icon: "✹",
    name: "傷跡車",
    rarity: "rare",
    text: "傷ついた列車へ、次の鉄塊の重さを1つ足す。",
  },
];

const CAR_BY_ID = new Map(CARS.map((car) => [car.id, car]));

// Four regular questions plus one two-wave boss. Seven stages are made by
// permuting the four regular questions and repeating one with more pressure.
export const CHALLENGES = [
  {
    id: "sparrows",
    name: "鉄くずスズメ",
    kind: "swarm",
    icon: "🐦",
    motion: "小型機が三方向へ散り、後尾へ回り込む",
    text: "小型機が散っている。手数か爆風でまとめて落とせ。",
    waves: [
      { id: "sparrow-pack", name: "スズメの群れ", kind: "swarm", count: 3, hp: 2, armor: 0, attack: 1, attackInterval: 4 },
    ],
  },
  {
    id: "plate",
    name: "廃工場の盾",
    kind: "armor",
    icon: "⬟",
    motion: "厚い盾が正面で軽い弾を受け、ゆっくり迫る",
    text: "軽い弾を止める装甲板。圧縮した重弾、溶融、帰還の累積が答えになる。",
    waves: [
      { id: "plate", name: "装甲運搬車", kind: "armor", count: 1, hp: 11, armor: 1, armorCharges: 2, weightThreshold: 3, attack: 1, attackInterval: 3 },
    ],
  },
  {
    id: "cannon",
    name: "赤錆キャノン",
    kind: "fast",
    icon: "◈",
    motion: "照準線が先頭車へ走り、短い拍で撃つ",
    text: "照準が早い。短い列、加速、または狙われた車両の装甲で先手を取れ。",
    waves: [
      { id: "cannon", name: "赤錆砲台", kind: "fast", count: 1, hp: 6, armor: 1, weightThreshold: 3, attack: 2, reactionTime: 2.2, attackInterval: 2.2, fast: true },
    ],
  },
  {
    id: "scavengers",
    name: "拾い屋の列",
    kind: "scavenger",
    icon: "🦾",
    motion: "残骸を拾いながら後尾へ寄り、車両を狙う",
    text: "残った弾を拾って回復し、後尾の車両を奪おうとする。早期撃破、回収、帰還、尾部装甲で対処する。",
    waves: [
      { id: "scavenger-pack", name: "拾い屋", kind: "scavenger", count: 1, hp: 10, armor: 1, attack: 1, attackInterval: 2.8, stealAfter: 2.4, steal: true, recoverAmount: 1 },
    ],
  },
  {
    id: "core",
    name: "炉心を喰う王",
    kind: "boss",
    icon: "♛",
    motion: "護衛を盾にして炉心砲を短い間隔で撃つ二段階の巨体",
    text: "群れの護衛を抜き、装甲の炉心へ別の答えを返せ。ここまでの車列を一つの機械にする。",
    waves: [
      { id: "core-guard", name: "炉心の護衛", kind: "swarm", count: 3, hp: 2, armor: 0, attack: 1, attackInterval: 3 },
      { id: "core-king", name: "炉心を喰う王", kind: "armor", count: 1, hp: 26, armor: 1, armorCharges: 3, weightThreshold: 3, attack: 2, reactionTime: 2.8, attackInterval: 2.6, fast: true, boss: true, returnRequired: true, moltenResistance: 0.55 },
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

function carFor(id) {
  return CAR_BY_ID.get(id) || CARS[0];
}

function bossPreparation(state) {
  const finalOrder = ["accelerator", "charge", "melt", "magnet", "reverse"];
  const acquisitionOrder = state.starterPattern === "charge"
    ? ["melt", "accelerator", "charge", "magnet", "reverse"]
    : ["charge", "melt", "accelerator", "magnet", "reverse"];
  const hasMagnet = state.activeCars.includes("magnet");
  const hasReverse = state.activeCars.includes("reverse");
  if (state.stage >= 4 && hasMagnet && !hasReverse) {
    return { finalOrder, next: "reverse" };
  }
  if (state.stage >= 4 && hasReverse && !hasMagnet) {
    return { finalOrder, next: "magnet" };
  }
  return {
    finalOrder,
    next: acquisitionOrder.find((id) => !state.activeCars.includes(id)) || null,
  };
}

function projectileSignature(projectiles) {
  return projectiles
    .map((p) => `${p.mass}${p.compressed ? "▣" : ""}${p.splitCount ? `◆${p.splitCount}` : ""}${p.sparks ? `⚡${p.sparks}` : ""}${p.mode === "molten" ? "♨" : ""}${p.returning ? "↩" : ""}${p.returnBlast ? "💥" : ""}${Math.abs((p.speed || 1) - 1) > 0.05 ? `×${Number(p.speed).toFixed(1)}` : ""}`)
    .join(" + ") || "空";
}

function projectileSnapshot(projectiles) {
  return projectiles.map((p) => ({
    id: p.id,
    mass: p.mass,
    sparks: p.sparks,
    mode: p.mode,
    compressed: Boolean(p.compressed),
    splitCount: p.splitCount || 0,
    returning: Boolean(p.returning),
    returnBlast: Boolean(p.returnBlast),
    speed: Number((p.speed || 1).toFixed(2)),
    collected: Boolean(p.collected),
  }));
}

function makeProjectile(id, mass = 2) {
  return {
    id,
    mass,
    sparks: 0,
    mode: "solid",
    compressed: false,
    splitCount: 0,
    returning: false,
    returnBlast: false,
    speed: 1,
    collected: false,
  };
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
    note = "全ての弾速 +1。長い列でも速攻の照準を外しやすい";
  } else if (car.id === "cut") {
    next = projectiles.flatMap((projectile) => {
      if ((projectile.splitCount || 0) >= 3) return [projectile];
      const fragmentSpeed = Math.max(0.6, (projectile.speed || 1) * 0.85);
      const splitCount = (projectile.splitCount || 0) + 1;
      const first = {
        ...projectile,
        mass: Math.max(1, Math.ceil(projectile.mass / 2)),
        sparks: Math.ceil(projectile.sparks / 2),
        splitCount,
        speed: fragmentSpeed,
      };
      const second = {
        ...projectile,
        id: `${projectile.id}-b`,
        mass: Math.max(1, Math.floor(projectile.mass / 2)),
        sparks: Math.floor(projectile.sparks / 2),
        splitCount,
        speed: fragmentSpeed,
      };
      return [first, second];
    });
    note = `${projectiles.length}個 → ${next.length}個。重さと火花を分け、分かれた弾は少し減速`;
  } else if (car.id === "press") {
    if (projectiles.length > 1) {
      const merged = projectiles.reduce((total, p) => ({
        ...total,
        mass: Math.min(5, total.mass + p.mass),
        sparks: total.sparks + p.sparks,
        compressed: true,
      }), { ...projectiles[0], id: `${projectiles[0].id}-pressed`, compressed: true });
      next = [merged];
    } else if (projectiles.length === 1) {
      next = [{ ...projectiles[0], mass: Math.min(5, projectiles[0].mass + 1), compressed: true }];
    }
    note = `弾の密度を上げた。合金の重さ ${next[0]?.mass ?? 0}`;
  } else if (car.id === "charge") {
    next = projectiles.map((projectile) => ({ ...projectile, sparks: projectile.sparks + 1 }));
    note = "全ての弾に火花 +1。後段の溶解へつなぐ";
  } else if (car.id === "melt") {
    next = projectiles.map((projectile) => {
      // A magnet placed before the melt car is a visible promise that this
      // particular returning shot will flare. It is deliberately expressed
      // on the projectile, rather than as a named pair recipe, so the same
      // rule also composes with cut, press, collector, and reverse.
      if (path === "forward" && projectile.returning) {
        return { ...projectile, mode: "molten", sparks: 0, returnBlast: true };
      }
      if (path === "reverse" && (projectile.returning || context.processingReturn)) {
        return { ...projectile, mode: "molten", sparks: 0, returnBlast: true };
      }
      if (projectile.mode === "molten") return projectile;
      if (projectile.sparks > 0) return { ...projectile, mode: "molten", sparks: 0 };
      return projectile;
    });
    note = next.some((p) => p.mode === "molten")
      ? (next.some((p) => p.returnBlast) ? "戻り弾へ帰路の炸裂を仕込んだ" : "溶けた弾は着弾時に爆風")
      : "火花がなく、変化なし";
  } else if (car.id === "magnet") {
    next = path === "forward"
      ? projectiles.map((projectile) => ({ ...projectile, returning: true }))
      : projectiles;
    note = path === "forward" ? "着弾後に戻る印をつけた" : "帰路の磁石は一度きりの帰還を消費した";
  } else if (car.id === "armor") {
    context.armorCarIndex = index;
    if (projectiles.length) {
      const indexToConsume = projectiles.reduce((smallest, projectile, candidate) => projectile.mass < projectiles[smallest].mass ? candidate : smallest, 0);
      const consumed = projectiles[indexToConsume];
      // The armour former shaves one unit off the smallest piece. A one-unit
      // fragment is spent completely, while a dense lump still leaves a
      // smaller shot in the firing line. This makes armour a real tradeoff,
      // not a dead turn.
      const remainder = consumed.mass > 1
        ? [{ ...consumed, mass: consumed.mass - 1, compressed: false }]
        : [];
      next = projectiles.filter((_, candidate) => candidate !== indexToConsume).concat(remainder);
      context.armorGain += Math.max(1, Math.ceil(consumed.mass / 2));
      note = `最も小さい鉄片 ${consumed.mass} から装甲板を作り、${remainder.length ? `残り ${remainder[0].mass} を発射線へ戻した` : "弾を使い切った"}`;
    } else {
      note = "弾がなく、装甲板を作れない";
    }
  } else if (car.id === "collector") {
    next = projectiles.map((projectile) => ({ ...projectile, collected: true }));
    note = "この印のついた戻り弾を次の鉄塊へ持ち越す";
  } else if (car.id === "reverse") {
    context.reverseOnReturn = true;
    note = "戻り弾も車列を逆順に通る";
  } else if (car.id === "loop") {
    if (context.loopIndex === null) context.loopIndex = index;
    note = "この車両より後ろ側の加工を発射前にもう一周";
  } else if (car.id === "scar") {
    note = context.scarBonus ? "傷ついた列車なので積載済みの鉄塊が +1" : "まだ無傷なので待機";
  }

  if (car.id === "loop") context.loopPenalty += 1;
  context.afterProjectiles = next;
  logCarEvent(context.events, car, path, before, projectileSignature(next), note, context, index);
  return next;
}

function processLine(carIds, projectiles, context, path = "forward", from = 0, to = carIds.length) {
  let next = projectiles;
  const step = from <= to ? 1 : -1;
  const beforeEnd = from <= to ? (index) => index < to : (index) => index > to;
  for (let index = from; beforeEnd(index); index += step) next = applyCar(carIds[index], next, context, path, index);
  return next;
}

function damageFor(projectile) {
  // Speed is not a separate gauge: a faster physical projectile hits harder.
  // Sparks add force once they are present; melt converts all of that energy
  // into the much louder molten/blast state below.
  const base = projectile.mass + (projectile.sparks || 0) + Math.max(0, Math.floor(projectile.speed || 1) - 1);
  return projectile.mode === "molten" ? base + 3 + (projectile.returnBlast ? 2 : 0) : base;
}

function aliveUnits(enemy) {
  return enemy.units.filter((unit) => unit.hp > 0);
}

function enemyDefeated(enemy) {
  return enemy.units.every((unit) => unit.hp <= 0);
}

function targetUnit(enemy, projectileIndex) {
  const alive = aliveUnits(enemy);
  if (!alive.length) return null;
  if (enemy.kind === "swarm") return alive[projectileIndex % alive.length];
  return alive[0];
}

function pushImpact(events, enemy, unit, projectile, damage, raw, armor, context, note, type = "impact") {
  events.push({
    type,
    target: unit.name,
    targetId: unit.id,
    targetEnemy: enemy.name,
    damage,
    raw,
    armor,
    projectile: { ...projectile },
    projectileId: projectile.id,
    location: { lane: "enemy", offset: Number(((context.waveIndex || 0) * 0.17 + 0.42).toFixed(2)) },
    note,
  });
}

function hitUnit(enemy, unit, projectile, context, splash = false) {
  const raw = damageFor(projectile);
  const bossReturnBlock = enemy.boss
    && enemy.returnRequired
    && !context.returnPass
    && projectile.mode !== "molten";
  if (bossReturnBlock) {
    pushImpact(context.events, enemy, unit, projectile, 0, raw, 0, context, "炉心が正面の弾を受け流した。帰還弾だけが内部へ届く", "impact_blocked");
    return { damage: 0, blocked: true };
  }
  const swarmFormationBlock = enemy.kind === "swarm"
    && !splash
    && !context.returnPass
    && (context.projectileCount || 1) < 2
    && projectile.mode !== "molten"
    && (projectile.sparks || 0) < 1
    && (projectile.speed || 1) < 2;
  if (swarmFormationBlock) {
    pushImpact(context.events, enemy, unit, projectile, 0, raw, 0, context, "密集隊形が単発の遅い弾をかわした", "impact_blocked");
    return { damage: 0, blocked: true };
  }
  // An accelerated molten round that is already on the forward path can
  // still arrive in time. A returning blast has spent a beat turning around,
  // so the same four-car length is intercepted; this keeps speed and return
  // as a real placement tradeoff rather than a hidden enemy-specific recipe.
  const moltenRush = context.activeCars.length === 4
    && projectile.mode === "molten"
    && (projectile.speed || 1) >= 2
    && !projectile.returnBlast;
  const fastIntercept = enemy.kind === "fast"
    && ((context.activeCars.length >= 4 && context.travel >= 2 && !moltenRush)
      || (context.travel > (enemy.reactionTime || 2.5) && (projectile.speed || 1) <= 2));
  if (fastIntercept) {
    pushImpact(context.events, enemy, unit, projectile, 0, raw, 0, context, context.activeCars.length >= 4 ? "長い列の弾を砲台が照準の途中で撃ち落とした" : "遅れて届いた分裂弾を砲台が撃ち落とした", "impact_blocked");
    return { damage: 0, blocked: true };
  }
  const lightBlocked = enemy.kind === "armor"
    && projectile.mode !== "molten"
    && projectile.mass < (unit.weightThreshold || enemy.weightThreshold || 3)
    && unit.armorCharges > 0;
  if (lightBlocked) {
    unit.armorCharges -= 1;
    pushImpact(context.events, enemy, unit, projectile, 0, raw, unit.armor, context, "軽い弾が装甲板に弾かれた", "impact_blocked");
    return { damage: 0, blocked: true };
  }
  const armorCut = projectile.mode === "molten" ? 0 : unit.armor;
  const unresistedDamage = Math.max(1, raw - armorCut);
  const damage = enemy.moltenResistance && projectile.mode === "molten"
    ? Math.max(1, Math.floor(unresistedDamage * enemy.moltenResistance))
    : unresistedDamage;
  unit.hp -= damage;
  pushImpact(context.events, enemy, unit, projectile, damage, raw, armorCut, context, splash ? "溶解弾の爆風が隣の敵にも届いた" : (projectile.mode === "molten" ? "溶解弾が装甲を抜いた" : "正面に命中"), splash ? "impact_splash" : "impact");
  if (enemy.kind === "scavenger" && projectile.mode !== "molten" && damage > 0 && unit.hp > 0) {
    unit.hp += enemy.recoverAmount || 1;
    context.events.push({ type: "enemy_recover", target: unit.name, targetId: unit.id, amount: enemy.recoverAmount || 1, note: "拾い屋が命中後の残骸を拾って回復した" });
  }
  return { damage, blocked: false };
}

function hitEnemy(enemy, projectile, projectileIndex, context) {
  const unit = targetUnit(enemy, projectileIndex);
  if (!unit) return;
  hitUnit(enemy, unit, projectile, context);
  if (projectile.mode === "molten" && enemy.kind === "swarm") {
    const splashTargets = aliveUnits(enemy).filter((candidate) => candidate.id !== unit.id).slice(0, 2);
    splashTargets.forEach((candidate) => hitUnit(enemy, candidate, { ...projectile, mass: Math.max(1, Math.floor(projectile.mass / 2)) }, context, true));
  }
}

function enemyDamage(enemy, travel) {
  const late = Math.max(0, Math.ceil(travel) - 3);
  return enemy.attack + Math.min(2, late);
}

function chooseTargetCar(context, enemy) {
  if (!context.activeCars.length) return null;
  if (enemy.kind === "scavenger") return context.activeCars.length - 1;
  if (enemy.kind === "fast") return 0;
  return (context.waveIndex + context.volleyIndex) % context.activeCars.length;
}

function applyEnemyAttack(enemy, context, reason) {
  const targetCarIndex = chooseTargetCar(context, enemy);
  const targetCarId = targetCarIndex === null ? null : context.activeCars[targetCarIndex];
  const raw = enemyDamage(enemy, context.travel);
  const targetIsArmor = targetCarId === "armor";
  // A generated armour plate can intercept a shell anywhere, but it is twice
  // as useful when the physical armour car is where the enemy is aiming.
  const absorbLimit = targetIsArmor ? raw : Math.floor(raw / 2);
  const absorbed = Math.min(context.armor, absorbLimit);
  context.armor -= absorbed;
  const damage = Math.max(0, raw - absorbed);
  context.hull -= damage;
  context.events.push({
    type: "enemy_shell",
    target: enemy.name,
    targetCarIndex,
    targetCarId,
    projectile: {
      id: `enemy-${context.waveIndex}-${context.volleyIndex}`,
      mass: raw,
      mode: "enemy-shell",
      speed: Number((1 / Math.max(1, context.travel)).toFixed(2)),
    },
    location: { lane: "enemy", carIndex: targetCarIndex, offset: 0.8 },
    reason,
    note: `${enemy.name}の攻撃弾が${targetCarId ? `${carFor(targetCarId).name}へ` : "車体へ"}向かう`,
  });
  const convertedMass = targetIsArmor && absorbed > 0 ? 1 : 0;
  if (convertedMass) context.storedMass = Math.min(3, context.storedMass + convertedMass);
  context.events.push({
    type: "enemy_attack",
    target: enemy.name,
    targetCarIndex,
    targetCarId,
    damage,
    absorbed,
    convertedMass,
    hull: context.hull,
    location: { lane: "train", carIndex: targetCarIndex },
    reason,
    note: convertedMass
      ? `装甲が ${absorbed} 受け止め、鉄塊 +${convertedMass} を次弾へ戻した`
      : absorbed ? `装甲が ${absorbed} 受け止めた` : "車体に直撃",
  });
}

function computeTravel(activeCars, projectiles, loopPenalty) {
  const meanSpeed = projectiles.length
    ? projectiles.reduce((total, projectile) => total + (projectile.speed || 1), 0) / projectiles.length
    : 1;
  return Math.max(1, Number(((Math.max(1, activeCars.length) + loopPenalty * 1.5) / Math.max(0.5, meanSpeed)).toFixed(2)));
}

function enemyFrom(definition) {
  const enemy = clone(definition);
  enemy.units = Array.from({ length: enemy.count || 1 }, (_, index) => ({
    id: `${enemy.id}-${index + 1}`,
    name: enemy.count > 1 ? `${enemy.name}${index + 1}` : enemy.name,
    hp: enemy.hp,
    maxHp: enemy.hp,
    armor: enemy.armor || 0,
    armorCharges: enemy.armorCharges || 0,
    weightThreshold: enemy.weightThreshold || 3,
  }));
  enemy.approach = 0;
  return enemy;
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
    armorCarIndex: null,
    scarBonus: state.activeCars.includes("scar") && state.hull < MAX_HULL ? 1 : 0,
    hull: state.hull,
    armor: state.armor || 0,
    storedMass: state.storedMass || 0,
    hasCollector: state.activeCars.includes("collector"),
    waveIndex,
    volleyIndex,
    scavengerProgress: state.scavengerProgress || 0,
    preImpactAttack: false,
    sawReturnReprocess: false,
    projectileCount: 1,
    returnPass: false,
    processingReturn: false,
  };
  const startingMass = 2 + context.storedMass + context.scarBonus;
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
    events.push({ type: "loop", carIndex: context.loopIndex, train: [...state.activeCars], location: { lane: "train", carIndex: context.loopIndex }, note: "ループ車が後ろ側の加工をやり直す", from: context.loopIndex + 1 });
    projectiles = processLine(state.activeCars, projectiles, context, "loop", context.loopIndex + 1, state.activeCars.length);
  }

  context.travel = computeTravel(state.activeCars, projectiles, context.loopPenalty);
  context.projectileCount = projectiles.length;
  enemy.approach += context.travel;
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

  if (enemy.fast && context.travel >= (enemy.reactionTime || 2.5)) {
    context.preImpactAttack = true;
    applyEnemyAttack(enemy, context, "発射前に照準が完了");
    enemy.approach = Math.max(0, enemy.approach - (enemy.attackInterval || 2.5));
  }

  projectiles.forEach((projectile, index) => hitEnemy(enemy, projectile, index, context));

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
      context.processingReturn = true;
      returned = processLine(state.activeCars, returned, context, "reverse", state.activeCars.length - 1, -1);
      context.processingReturn = false;
      context.sawReturnReprocess = true;
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
      context.returnPass = true;
      context.projectileCount = returned.length;
      returned.forEach((projectile, index) => hitEnemy(enemy, projectile, index, context));
      context.returnPass = false;
    }
    if (context.hasCollector) {
      context.collectedMass += returned.reduce((total, projectile) => total + (projectile.collected ? projectile.mass : 0), 0);
    }
  }

  if (!enemyDefeated(enemy) && !context.preImpactAttack && enemy.approach >= (enemy.attackInterval || 2.5)) {
    applyEnemyAttack(enemy, context, "敵の反撃");
    enemy.approach -= enemy.attackInterval || 2.5;
  }

  if (enemy.kind === "scavenger" && !enemyDefeated(enemy)) {
    context.scavengerProgress += context.travel;
    if (context.scavengerProgress >= (enemy.stealAfter || 2.4)) {
      const tail = state.activeCars[state.activeCars.length - 1];
      const protectedTail = tail === "armor" || context.hasCollector || context.sawReturnReprocess;
      if (protectedTail) {
        context.events.push({ type: "enemy_repelled", target: enemy.name, targetCarId: tail || null, note: tail === "armor" ? "尾部装甲が拾い屋を押し返した" : context.hasCollector ? "回収車が残骸を先に回収した" : "帰還弾が拾い屋の列を追い返した" });
        context.scavengerProgress = 0;
      } else if (state.activeCars.length > 1) {
        context.stolenCarId = tail;
        context.events.push({ type: "car_stolen", target: enemy.name, targetCarId: tail, targetCarIndex: state.activeCars.length - 1, note: `${carFor(tail).name}が拾い屋に奪われた` });
        context.scavengerProgress = 0;
      } else {
        context.events.push({ type: "enemy_repelled", target: enemy.name, targetCarId: tail || null, note: "最後の一両は奪えず、拾い屋が離れた" });
        context.scavengerProgress = 0;
      }
    }
  }

  if (enemy.kind === "scavenger" && context.hasCollector && !enemyDefeated(enemy)) {
    // The collector has a visible job even when no magnet is installed: it
    // gathers a little of the scavenger's loose scrap after each exchange.
    context.collectedMass += 1;
    context.events.push({
      type: "collector_gain",
      target: enemy.name,
      amount: 1,
      note: "回収車が拾い屋の残骸を次の鉄塊へ戻した",
    });
  }

  return {
    events,
    enemy,
    travel: context.travel,
    armorGain: context.armorGain,
    collectedMass: context.collectedMass,
    nextStoredMass: Math.min(3, context.storedMass + context.collectedMass),
    hullAfter: context.hull,
    armorAfter: context.armor,
    scavengerProgress: context.scavengerProgress,
    stolenCarId: context.stolenCarId || null,
    projectiles,
  };
}

function regularOrder(seed) {
  const regular = CHALLENGES.slice(0, 4);
  return regular
    .map((challenge, index) => ({ challenge, score: hash(seed, 700 + index * 31) }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.challenge);
}

export function challengeFor(stage, seed = null) {
  const safeStage = Math.max(0, Math.min(MAX_STAGES - 1, stage));
  if (safeStage === 0) return clone(CHALLENGES[0]);
  if (safeStage === MAX_STAGES - 1) return clone(CHALLENGES[4]);
  const normalizedSeed = seed === null || seed === undefined || seed === "" ? 0 : Number(seed) >>> 0;
  const order = regularOrder(normalizedSeed);
  const repeated = order[hash(normalizedSeed, 991) % order.length];
  const sequence = [...order, repeated];
  const challenge = clone(sequence[safeStage - 1]);
  challenge.encounter = safeStage + 1;
  challenge.pressure = safeStage >= 4 ? 1 : 0;
  challenge.waves = challenge.waves.map((wave) => ({
    ...wave,
    hp: wave.hp + (challenge.pressure && wave.kind !== "fast" ? 1 : 0),
    attack: wave.attack + (challenge.pressure && wave.kind === "fast" ? 1 : 0),
  }));
  return challenge;
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
    armorCarIndex: null,
    scarBonus: safeState.activeCars.includes("scar") && safeState.hull < MAX_HULL ? 1 : 0,
    hull: safeState.hull,
    armor: safeState.armor || 0,
    storedMass: safeState.storedMass || 0,
    hasCollector: safeState.activeCars.includes("collector"),
  };
  let projectiles = projectile ? [clone(projectile)] : [makeProjectile("preview", 2 + context.scarBonus + context.storedMass)];
  projectiles = processLine(safeState.activeCars, projectiles, context);
  if (context.loopIndex !== null && context.loopIndex < safeState.activeCars.length - 1) {
    projectiles = processLine(safeState.activeCars, projectiles, context, "loop", context.loopIndex + 1, safeState.activeCars.length);
  }
  context.travel = computeTravel(safeState.activeCars, projectiles, context.loopPenalty);
  return {
    events: context.events,
    summary: projectileSignature(projectiles),
    travel: context.travel,
    projectiles: projectileSnapshot(projectiles),
  };
}

export function offersFor(state) {
  // A starter car is also recoverable after it has been removed. Otherwise a
  // run that begins with charge could never discover acceleration (and vice
  // versa), making the two readable openings secretly irreversible.
  const eligible = CARS.filter((car) => !state.activeCars.includes(car.id));
  if (!eligible.length) return [];
  const ranked = eligible
    .map((car, index) => ({ car, score: hash(state.seed, state.stage * 37 + index * 17 + car.id.length) }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.car);
  const counters = {
    swarm: ["cut", "charge", "melt", "magnet"],
    armor: ["press", "melt", "magnet", "reverse"],
    // Melt is the readable one-car answer to the fast cannon: it arrives
    // with enough force before the cannon's reaction window closes. The
    // other entries create different answers once the line is longer.
    fast: ["accelerator", "melt", "press", "magnet", "collector", "armor", "cut"],
    scavenger: ["collector", "magnet", "reverse", "armor"],
    boss: ["melt", "reverse", "magnet", "press"],
  };
  const counterPool = (counters[challengeFor(state.stage, state.seed).kind] || [])
    .filter((id) => eligible.some((car) => car.id === id));
  const offers = [];
  const challengeKind = challengeFor(state.stage, state.seed).kind;
  const answerFor = (kind) => {
    const answerIds = {
      swarm: ["cut", "melt", "charge"],
      armor: ["press", "melt", "magnet"],
      fast: ["accelerator", "melt", "press"],
      scavenger: ["collector", "magnet", "armor"],
      boss: ["press", "reverse", "magnet", "melt"],
    }[kind] || [];
    return answerIds.find((id) => eligible.some((car) => car.id === id));
  };
  const immediateNeedsAnswer = challengeKind === "fast" && !state.activeCars.includes("accelerator")
    || challengeKind === "scavenger" && !state.activeCars.some((id) => ["collector", "magnet"].includes(id))
    || challengeKind === "armor" && !state.activeCars.some((id) => ["press", "melt", "magnet"].includes(id));
  const guarantees = [];
  const bossPart = bossPreparation(state).next;
  if (bossPart && eligible.some((car) => car.id === bossPart)) guarantees.push(bossPart);
  // From the fourth encounter onward, keep both halves of the return idea
  // visible whenever neither is in the train yet. A player may still ignore
  // them, but the run must not secretly become impossible because the last
  // reward offered only one half of a two-part physical route.
  if (state.stage >= 4) {
    ["magnet", "reverse"].forEach((id) => {
      if (!state.activeCars.includes(id) && eligible.some((car) => car.id === id)) guarantees.push(id);
    });
  }
  if (immediateNeedsAnswer) guarantees.push(answerFor(challengeKind));
  // The next encounter is visible before the choice. Preserve one readable
  // answer for that next question too, so a line does not become doomed just
  // because the previous choice solved a different question.
  if (state.stage < MAX_STAGES - 1) {
    const nextKind = challengeFor(state.stage + 1, state.seed).kind;
    const nextAnswer = nextKind === "fast" && !state.activeCars.includes("accelerator")
      ? answerFor(nextKind)
      : nextKind === "scavenger" && !state.activeCars.some((id) => ["collector", "magnet"].includes(id))
        ? answerFor(nextKind)
        : nextKind === "armor" && !state.activeCars.some((id) => ["press", "melt", "magnet"].includes(id))
          ? answerFor(nextKind)
          : null;
    if (nextAnswer) guarantees.push(nextAnswer);
  }
  guarantees.filter(Boolean).forEach((id) => {
    if (!offers.some((offer) => offer.id === id)) offers.push(carFor(id));
  });
  const counterOffset = counterPool.length ? hash(state.seed, state.stage * 101 + 53) % counterPool.length : 0;
  // Two readable answers and one discovery slot keep the choice constrained
  // while avoiding a fixed “take the first counter” order.
  for (let index = 0; index < Math.min(2, counterPool.length); index += 1) {
    const candidate = counterPool[(counterOffset + index) % counterPool.length];
    if (!offers.some((offer) => offer.id === candidate)) offers.push(carFor(candidate));
  }
  for (const car of ranked) {
    if (offers.some((offer) => offer.id === car.id)) continue;
    offers.push(car);
    if (offers.length === 3) break;
  }
  return offers.slice(0, 3).sort((a, b) => hash(state.seed, state.stage * 211 + a.id.length) - hash(state.seed, state.stage * 211 + b.id.length));
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
    offerHistory: [],
    selectedOffer: null,
    lastBattle: null,
    battleHistory: [],
    battleReports: [],
    collectReports: true,
    carHistory: [],
    moveCount: 0,
    rebuildCount: 0,
    previewCount: 0,
    swapCount: 0,
    done: false,
    won: false,
    outcomeStatus: "in_progress",
    endedEarly: false,
    reportRevealed: false,
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
  const before = [...next.activeCars];
  const [car] = next.activeCars.splice(from, 1);
  next.activeCars.splice(to, 0, car);
  next.moveCount += 1;
  next.carHistory.push({ action: "move", carId: car, from, to, stage: next.stage, before, after: [...next.activeCars], at: new Date().toISOString() });
  delete next.preview;
  next.events.push({ type: "move", from, to, carId: car });
  return next;
}

export function removeCar(state, index) {
  const next = clone(state);
  if (index < 0 || index >= next.activeCars.length || next.activeCars.length <= 1) return next;
  const before = [...next.activeCars];
  const [car] = next.activeCars.splice(index, 1);
  delete next.preview;
  next.carHistory.push({ action: "remove", carId: car, index, stage: next.stage, before, after: [...next.activeCars], at: new Date().toISOString() });
  next.events.push({ type: "remove", index, carId: car });
  next.rebuildCount += 1;
  return next;
}

export function installCar(state, carId, slot = null) {
  const next = clone(state);
  if (!CAR_BY_ID.has(carId) || next.activeCars.includes(carId)) return next;
  const before = [...next.activeCars];
  let action = null;
  let replaced = null;
  if (slot !== null && Number.isInteger(slot) && slot >= 0 && slot < next.activeCars.length) {
    replaced = next.activeCars[slot];
    next.activeCars[slot] = carId;
    next.swapCount += 1;
    action = "replace";
    next.carHistory.push({ action, carId, replaced, slot, stage: next.stage, before, after: [...next.activeCars], at: new Date().toISOString() });
  } else if (next.activeCars.length < MAX_CARS) {
    next.activeCars.push(carId);
    action = "append";
    next.carHistory.push({ action, carId, slot: next.activeCars.length - 1, stage: next.stage, before, after: [...next.activeCars], at: new Date().toISOString() });
  } else {
    return next;
  }
  const presented = [...(next.offerHistory || [])].reverse().find((entry) => entry.stage === next.stage && !entry.decision);
  if (presented) {
    presented.decision = { action, carId, replaced, slot, before, after: [...next.activeCars], at: new Date().toISOString() };
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
  const before = [...next.activeCars];
  next.carHistory.push({ action: "skip", stage: next.stage, before, after: [...next.activeCars], at: new Date().toISOString() });
  const presented = [...(next.offerHistory || [])].reverse().find((entry) => entry.stage === next.stage && !entry.decision);
  if (presented) presented.decision = { action: "skip", carId: null, before, after: [...next.activeCars], at: new Date().toISOString() };
  next.offers = [];
  next.selectedOffer = "skip";
  next.phase = "build";
  delete next.preview;
  next.events.push({ type: "skip_reward", stage: next.stage });
  return next;
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
  let activeCars = [...next.activeCars];
  const waveReports = [];
  let won = true;

  for (let waveIndex = 0; waveIndex < challenge.waves.length; waveIndex += 1) {
    const enemy = enemyFrom(challenge.waves[waveIndex]);
    let waveWon = false;
    let scavengerProgress = 0;
    for (let volley = 0; volley < MAX_VOLLEYS; volley += 1) {
      const volleyResult = simulateVolley({ ...next, activeCars, hull, armor, storedMass, scavengerProgress }, challenge, enemy, volley, waveIndex);
      events.push(...volleyResult.events.map((event) => ({ ...event, wave: waveIndex })));
      hull = volleyResult.hullAfter;
      armor = volleyResult.armorAfter + volleyResult.armorGain;
      storedMass = volleyResult.nextStoredMass;
      scavengerProgress = volleyResult.scavengerProgress;

      if (volleyResult.stolenCarId) {
        const stolenIndex = activeCars.indexOf(volleyResult.stolenCarId);
        if (stolenIndex >= 0 && activeCars.length > 1) {
          const [stolen] = activeCars.splice(stolenIndex, 1);
          next.carHistory.push({ action: "stolen", carId: stolen, index: stolenIndex, stage: next.stage });
          next.rebuildCount += 1;
          events.push({ type: "car_stolen_confirmed", carId: stolen, carIndex: stolenIndex, train: [...activeCars], note: `${carFor(stolen).name}を失った。残った車列で組み直す` });
        }
      }
      next.activeCars = [...activeCars];

      if (enemyDefeated(enemy)) {
        waveWon = true;
        events.push({ type: "wave_clear", wave: waveIndex, target: enemy.name, targetId: enemy.id, note: `${enemy.name}を撃破` });
        break;
      }
      if (hull <= 0) {
        won = false;
        break;
      }
    }
    waveReports.push({
      id: enemy.id,
      name: enemy.name,
      kind: enemy.kind,
      won: waveWon,
      hp: enemy.units.reduce((total, unit) => total + Math.max(0, unit.hp), 0),
      count: aliveUnits(enemy).length,
      units: enemy.units.map((unit) => ({ id: unit.id, name: unit.name, hp: Math.max(0, unit.hp), armorCharges: unit.armorCharges })),
    });
    if (!waveWon || hull <= 0) {
      won = false;
      break;
    }
  }

  const repair = won ? Math.min(4, MAX_HULL - Math.max(0, hull)) : 0;
  hull += repair;
  if (repair) events.push({ type: "repair", amount: repair, hull, note: "区画のあいだに応急修理を入れた" });
  next.activeCars = [...activeCars];
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
    armorBefore: state.armor || 0,
    hullAfter: next.hull,
    armorAfter: next.armor,
    waveReports,
    trainBefore: [...state.activeCars],
    train: [...next.activeCars],
    spectacle: events.filter((event) => event.spectacle).reduce((best, event) => event.spectacle.level > best.level ? event.spectacle : best, spectacleFor(next.activeCars, [])),
    events,
    highlight: events.filter((event) => ["car", "impact", "impact_splash", "impact_blocked", "return", "return_reprocess", "enemy_recover", "enemy_repelled", "car_stolen", "car_stolen_confirmed", "enemy_shell", "enemy_attack", "wave_clear"].includes(event.type)).slice(-16),
  };
  const enemyDefeatedAll = waveReports.length === challenge.waves.length && waveReports.every((wave) => wave.won);
  const mutual = !won && enemyDefeatedAll && next.hull <= 0;
  const outcome = won ? "won" : mutual ? "mutual" : "lost";
  next.lastBattle.outcome = outcome;
  next.lastBattle.enemyDefeated = enemyDefeatedAll;
  next.reportRevealed = false;
  next.battleHistory.push({ stage: next.stage + 1, challenge: challenge.id, kind: challenge.kind, won, outcome, enemyDefeated: enemyDefeatedAll, hull: next.hull, armor: next.armor, train: [...next.activeCars] });
  if (won) {
    next.stage += 1;
    if (next.stage >= MAX_STAGES) {
      next.done = true;
      next.won = true;
      next.outcomeStatus = "won";
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
    next.outcomeStatus = outcome;
    next.phase = "report";
    next.reason = mutual ? "敵と列車が同時に壊れた" : next.hull <= 0 ? "列車が大破" : "敵を撃破できなかった";
    next.endedAt = new Date().toISOString();
  }
  next.lastBattle.reason = next.reason || (won ? "次の残骸が開いた" : "列車が止まった");
  next.lastBattle.events.push({ type: "battle_end", stage: next.stage, won, outcome, reason: next.lastBattle.reason });
  if (next.collectReports !== false) {
    next.battleReports ||= [];
    next.battleReports.push(clone(next.lastBattle));
  }
  next.events.push({ type: "battle_end", stage: next.stage, won, outcome, reason: next.reason });
  return { state: next, report: next.lastBattle };
}

export function revealReport(state) {
  const next = clone(state);
  if (next.phase === "report" && next.lastBattle) next.reportRevealed = true;
  return next;
}

function registerOfferPresentation(state) {
  const next = state;
  next.offerHistory ||= [];
  const alreadyPresented = next.offerHistory.some((entry) => entry.stage === next.stage);
  if (alreadyPresented) return next;
  const challenge = challengeFor(next.stage, next.seed);
  next.offerHistory.push({
    stage: next.stage,
    presentedAt: new Date().toISOString(),
    nextChallenge: { id: challenge.id, kind: challenge.kind, name: challenge.name, motion: challenge.motion },
    before: { train: [...next.activeCars], hull: next.hull, armor: next.armor, storedMass: next.storedMass },
    offers: next.offers.map((car) => ({ id: car.id, name: car.name, rarity: car.rarity, text: car.text })),
    decision: null,
  });
  next.events.push({ type: "offers_presented", stage: next.stage, nextChallenge: challenge.id, offers: next.offers.map((car) => car.id) });
  return next;
}

export function continueFromReport(state) {
  const next = clone(state);
  if (next.phase !== "report" || !next.reportRevealed) return next;
  if (next.done) {
    next.phase = "done";
    return next;
  }
  next.phase = "reward";
  next.offers = next.offers.length ? next.offers : offersFor(next);
  return registerOfferPresentation(next);
}

export function endRunEarly(state, reason = "プレイヤーが途中で記録を終了") {
  const next = clone(state);
  if (next.done) return next;
  next.done = true;
  next.won = false;
  next.endedEarly = true;
  next.outcomeStatus = "abandoned";
  next.reason = reason;
  next.phase = "done";
  next.reportRevealed = true;
  next.endedAt = new Date().toISOString();
  next.events.push({ type: "run_ended_early", stage: next.stage, reason, at: next.endedAt });
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

function battleVariants(state) {
  const variants = [state];
  const seen = new Set([state.activeCars.join(",")]);
  const add = (candidate) => {
    const key = candidate.activeCars.join(",");
    if (!seen.has(key)) {
      seen.add(key);
      variants.push(candidate);
    }
  };
  const preserve = new Set(challengeFor(state.stage, state.seed).kind === "fast"
    ? ["accelerator", ...(state.stage >= 4 ? ["magnet", "reverse"] : [])]
    : state.stage >= 4 ? ["magnet", "reverse"] : []);
  // A long train is a deliberate risk against the fast cannon. The player
  // can dismantle one car before departure; the diagnostic policy must be
  // able to discover that same legal decision instead of treating it as an
  // unwinnable seed.
  if (state.activeCars.length > 1) {
    const core = new Set(bossPreparation(state).finalOrder);
    const removalOrder = state.activeCars
      .map((carId, index) => ({ carId, index }))
      .sort((a, b) => Number(preserve.has(a.carId)) - Number(preserve.has(b.carId))
        || Number(core.has(a.carId)) - Number(core.has(b.carId)))
      .map((entry) => entry.index);
    removalOrder.forEach((index) => add(removeCar(state, index)));
  }
  if (challengeFor(state.stage, state.seed).kind === "fast" && state.activeCars.length > 3) {
    // A fast cannon asks for a genuinely short line. Generate legal two-car
    // dismantles as well, because a five-car train can otherwise remain four
    // cars long after a single removal.
    for (let first = 0; first < state.activeCars.length; first += 1) {
      if (preserve.has(state.activeCars[first])) continue;
      const once = removeCar(state, first);
      for (let second = 0; second < once.activeCars.length; second += 1) {
        if (preserve.has(once.activeCars[second])) continue;
        add(removeCar(once, second));
      }
    }
  }
  // Placement is part of the game, so the verifier explores one legal swap
  // at a time. Re-entering this function after a move covers the remaining
  // permutations without adding a second hidden placement rule.
  for (let from = 0; from < state.activeCars.length; from += 1) {
    for (let to = 0; to < state.activeCars.length; to += 1) {
      if (from !== to) add(moveCar(state, from, to));
    }
  }
  return variants;
}

function policyBattle(state) {
  const candidates = battleVariants(state);
  const direct = runBattle(candidates[0]);
  if (direct.report?.won) return direct;
  const outcomes = candidates.map((candidate) => ({ candidate, result: runBattle(candidate) }));
  const winning = outcomes.filter((entry) => entry.result.report?.won);
  if (winning.length) {
    winning.sort((a, b) => {
      const aCars = a.candidate.activeCars.length;
      const bCars = b.candidate.activeCars.length;
      const fast = challengeFor(state.stage, state.seed).kind === "fast";
      return (fast ? aCars - bCars : bCars - aCars)
        || (b.result.report.hullAfter || 0) - (a.result.report.hullAfter || 0);
    });
    return winning[0].result;
  }
  return outcomes[0].result;
}

function arrangePolicyTrain(state) {
  const order = ["accelerator", "charge", "melt", "magnet", "reverse", "press", "cut", "collector", "armor", "loop", "scar"];
  let next = state;
  const sorted = [...state.activeCars].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  sorted.forEach((carId, targetIndex) => {
    const currentIndex = next.activeCars.indexOf(carId);
    if (currentIndex >= 0 && currentIndex !== targetIndex) next = moveCar(next, currentIndex, targetIndex);
  });
  return next;
}

function greedyReward(state) {
  const candidates = [];
  for (const offer of state.offers) {
    if (state.activeCars.length < MAX_CARS) candidates.push({ state: installCar(state, offer.id), offer: offer.id, slot: null });
    else for (let slot = 0; slot < state.activeCars.length; slot += 1) candidates.push({ state: installCar(state, offer.id, slot), offer: offer.id, slot });
  }
  candidates.push({ state: skipReward(state), offer: "skip", slot: null });
  const challenge = challengeFor(state.stage, state.seed);
  const answerSet = {
    swarm: new Set(["cut", "melt", "charge"]),
    armor: new Set(["press", "melt", "magnet"]),
    fast: new Set(["accelerator", "press", "melt"]),
    scavenger: new Set(["collector", "magnet", "armor"]),
    boss: new Set(["reverse", "magnet", "press", "melt"]),
  }[challenge.kind] || new Set();
  const preparation = bossPreparation(state);
  const fastAhead = Array.from({ length: MAX_STAGES - state.stage }, (_, index) => challengeFor(state.stage + index, state.seed))
    .some((nextChallenge) => nextChallenge.kind === "fast");
  const baseline = policyBattle(skipReward(state));
  const neededNow = !baseline.report?.won;
  const scored = candidates.map((candidate, index) => {
    const preview = policyBattle(candidate.state);
    const addedAnswer = candidate.offer !== "skip" && answerSet.has(candidate.offer);
    const fastShort = challenge.kind === "fast" && candidate.state.activeCars.includes("accelerator") && candidate.state.activeCars.length <= 3;
    const safeBossPart = candidate.offer === preparation.next
      && (candidate.state.activeCars.length <= 4 || state.stage >= MAX_STAGES - 1 || !fastAhead);
    return {
      candidate,
      score: (preview.report?.won ? 100000 : 0)
        + (preview.report?.hullAfter || 0) * 100
        + (fastShort ? 500 : 0)
        + (addedAnswer ? (neededNow ? 40 : -120) : 0)
        + (safeBossPart ? 5000 : 0)
        - (!neededNow && candidate.offer !== "skip" && candidate.state.activeCars.length >= 4 && !safeBossPart ? 100 : 0)
        - candidate.state.activeCars.length
        - index,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].candidate.state;
}

function battleKey(state) {
  return [state.seed, state.stage, state.hull, state.armor, state.storedMass, state.activeCars.join(",")].join("|");
}

function cachedBattle(state, battleMemo) {
  const key = battleKey(state);
  if (battleMemo.has(key)) return battleMemo.get(key);
  const result = runBattle(state);
  battleMemo.set(key, result);
  return result;
}

function canPolicyFinish(state, memo, depth = 0, battleMemo = new Map()) {
  if (state.done) return Boolean(state.won);
  if (depth > MAX_STAGES * 7) return false;
  const key = policyKey(state);
  if (memo.has(key)) return memo.get(key);
  let result = false;
  if (state.phase === "build") {
    const direct = cachedBattle(state, battleMemo);
    result = direct.report?.won
      ? canPolicyFinish(direct.state, memo, depth + 1, battleMemo)
      : battleVariants(state).slice(1).some((variant) => canPolicyFinish(cachedBattle(variant, battleMemo).state, memo, depth + 1, battleMemo));
  } else if (state.phase === "report") {
    result = canPolicyFinish(continueFromReport(revealReport(state)), memo, depth + 1, battleMemo);
  } else if (state.phase === "reward") {
    const candidates = [];
    for (const offer of state.offers) {
      if (state.activeCars.length < MAX_CARS) candidates.push(installCar(state, offer.id));
      else for (let slot = 0; slot < state.activeCars.length; slot += 1) candidates.push(installCar(state, offer.id, slot));
    }
    candidates.push(skipReward(state));
    result = candidates.some((candidate) => canPolicyFinish(candidate, memo, depth + 1, battleMemo));
  }
  memo.set(key, result);
  return result;
}

function policyReward(state, memo, battleMemo) {
  const candidates = [];
  for (const offer of state.offers) {
    if (state.activeCars.length < MAX_CARS) candidates.push({ state: installCar(state, offer.id), id: offer.id, slot: null });
    else for (let slot = 0; slot < state.activeCars.length; slot += 1) candidates.push({ state: installCar(state, offer.id, slot), id: offer.id, slot });
  }
  candidates.push({ state: skipReward(state), id: "skip", slot: null });
  return candidates.find((candidate) => canPolicyFinish(candidate.state, memo, 0, battleMemo)) || candidates[0];
}

export function recommendedPolicy(seed) {
  let state = createGame(seed);
  // Search branches do not need full replay snapshots. Omitting them keeps
  // the verifier fast without changing any battle decision or user run.
  state.collectReports = false;
  for (let guard = 0; guard < MAX_STAGES * 7 && !state.done; guard += 1) {
    if (state.phase === "build") {
      state = arrangePolicyTrain(state);
      state.preview = previewTrain(state);
      state.previewCount += 1;
      state = policyBattle(state).state;
    } else if (state.phase === "report") {
      state = continueFromReport(revealReport(state));
    } else if (state.phase === "reward") {
      state = greedyReward(state);
    }
  }
  return state;
}
