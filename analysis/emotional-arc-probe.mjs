const MAX_HP = 30;
const CAPACITY = 5;
const RUNS = Number(process.argv.find(arg => arg.startsWith("--runs="))?.split("=")[1] || 60);
const BUILD_SAMPLES = Number(process.argv.find(arg => arg.startsWith("--build-samples="))?.split("=")[1] || 250);

const OBS_ENEMIES = [
  { hp: 22, atk: 3, armor: 0, rage: 0 },
  { hp: 34, atk: 5, armor: 0, rage: 0 },
  { hp: 43, atk: 5, armor: 2, rage: 0 },
  { hp: 56, atk: 7, armor: 0, rage: 0, heat: 1 },
  { hp: 72, atk: 7, armor: 1, rage: 2 },
  { hp: 94, atk: 10, armor: 2, rage: 1 },
];

const CYCLE_ENEMIES = [
  { hp: 16, atk: 3, rage: 0 },
  { hp: 28, atk: 4, rage: 0 },
  { hp: 39, atk: 6, rage: 0 },
  { hp: 53, atk: 7, rage: 1 },
  { hp: 68, atk: 8, rage: 1 },
  { hp: 79, atk: 9, rage: 1 },
];

const OBS_TYPES = ["spark", "furnace", "turbine", "ram", "plating", "vent", "pulse", "battery", "echo", "recycler", "prism", "mine", "leech", "unstable"];
const CYCLE_TYPES = ["generator", "gun", "shield", "battery", "echo", "leech"];

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function hash(text) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function lcsLength(one, two) {
  const table = Array.from({ length: one.length + 1 }, () => Array(two.length + 1).fill(0));
  for (let i = 1; i <= one.length; i += 1) {
    for (let j = 1; j <= two.length; j += 1) {
      table[i][j] = one[i - 1] === two[j - 1]
        ? table[i - 1][j - 1] + 1
        : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  return table[one.length][two.length];
}

function buildDistance(one = [], two = []) {
  const size = Math.max(one.length, two.length, 1);
  return 1 - lcsLength(one.map(item => item.id), two.map(item => item.id)) / size;
}

function utility(result) {
  return result.won
    ? 100 + result.hp - result.cycles
    : -result.enemyHp - (MAX_HP - result.hp);
}

function obsBattle(build, enemy) {
  let hp = MAX_HP;
  let enemyHp = enemy.hp;
  let power = 0;
  let heat = 0;
  let shield = 0;
  let last = null;
  let cycles = 0;
  const uses = new Map();

  while (hp > 0 && enemyHp > 0 && cycles < 12) {
    cycles += 1;
    for (const item of build) {
      let delta = {};
      if (item.type === "spark") delta = { damage: 2, power: 1 };
      if (item.type === "furnace") delta = { damage: Math.min(6, 1 + Math.floor((heat + 2) / 2)), heat: 2 };
      if (item.type === "turbine") delta = { power: 2 + Number(heat >= 4), cool: 1 };
      if (item.type === "ram") {
        const used = Math.min(3, power);
        delta = { damage: 3 + used * 2, power: -used };
      }
      if (item.type === "plating") delta = { shield: 3 + (power > 0 ? 3 : 0), power: power > 0 ? -1 : 0 };
      if (item.type === "vent") {
        const cooled = Math.min(4, heat);
        delta = { damage: 2 + cooled, cool: cooled };
      }
      if (item.type === "pulse") delta = heat >= 5 ? { damage: 8, cool: 2 } : { damage: 2 };
      if (item.type === "battery") delta = { power: 4, shield: power >= 4 ? 2 : 0 };
      if (item.type === "echo") {
        const half = key => Math.max(0, Math.floor((last?.[key] || 0) / 2));
        delta = last
          ? { damage: half("damage"), power: half("power"), heat: half("heat"), shield: half("shield"), heal: half("heal") }
          : { damage: 2 };
      }
      if (item.type === "recycler") delta = { heal: 1, power: 1, cool: 1 };
      if (item.type === "prism") {
        const used = Math.min(3, shield);
        delta = { damage: 2 + used * 2, shield: -used };
      }
      if (item.type === "mine") {
        const count = (uses.get(item.id) || 0) + 1;
        uses.set(item.id, count);
        delta = { damage: count % 2 === 0 ? 11 : 2 };
      }
      if (item.type === "leech") delta = { damage: 3, shield: 2 };
      if (item.type === "unstable") delta = { damage: 8, heat: 2 };

      const rawDamage = Math.max(0, delta.damage || 0);
      const actualDamage = rawDamage > 0 ? Math.max(1, rawDamage - (enemy.armor || 0)) : 0;
      enemyHp -= actualDamage;
      power = Math.max(0, power + (delta.power || 0));
      heat = Math.max(0, heat + (delta.heat || 0) - (delta.cool || 0));
      shield = Math.max(0, shield + (delta.shield || 0));
      hp = Math.min(MAX_HP, hp + (delta.heal || 0));
      last = { ...delta, damage: actualDamage };
      if (enemyHp <= 0) break;
    }
    if (enemyHp <= 0) break;
    const attack = enemy.atk + (enemy.rage || 0) * (cycles - 1);
    const blocked = Math.min(shield, attack);
    shield -= blocked;
    hp -= attack - blocked;
    heat += enemy.heat || 0;
  }

  return { won: enemyHp <= 0, hp: Math.max(0, hp), enemyHp: Math.max(0, enemyHp), cycles };
}

function cycleForecast(build, variant, carried = 0) {
  let energy = carried;
  let damage = 2;
  let armor = 0;
  let healing = 0;
  let previous = { energy: 0, damage: 0, armor: 0, healing: 0 };
  for (const item of build) {
    const effect = { energy: 0, damage: 0, armor: 0, healing: 0 };
    if (item.type === "generator") {
      effect.energy = 2;
      effect.damage = variant.generatorDamage;
    }
    if (item.type === "gun") {
      const spent = Math.min(2, energy);
      energy -= spent;
      effect.damage = 4 + spent * 2;
    }
    if (item.type === "shield") {
      const spent = Math.min(2, energy);
      energy -= spent;
      effect.armor = 3 + spent * 2;
    }
    if (item.type === "battery") {
      effect.energy = 1;
      effect.armor = variant.batteryArmor;
    }
    if (item.type === "echo") {
      effect.energy = Math.floor(previous.energy / 2);
      effect.damage = Math.max(1, Math.floor(previous.damage / 2));
      effect.armor = Math.floor(previous.armor / 2);
      effect.healing = Math.floor(previous.healing / 2);
    }
    if (item.type === "leech") {
      effect.damage = 3;
      effect.healing = 1;
    }
    energy += effect.energy;
    damage += effect.damage;
    armor += effect.armor;
    healing += effect.healing;
    previous = effect;
  }
  return { damage, armor, healing, carry: build.some(item => item.type === "battery") ? Math.min(3, energy) : 0 };
}

function cycleBattle(build, enemy, variant) {
  let hp = MAX_HP;
  let enemyHp = enemy.hp;
  let carried = 0;
  let cycles = 0;
  while (hp > 0 && enemyHp > 0 && cycles < 8) {
    cycles += 1;
    const forecast = cycleForecast(build, variant, carried);
    carried = forecast.carry;
    hp = Math.min(MAX_HP, hp + forecast.healing);
    enemyHp -= forecast.damage;
    if (enemyHp > 0) {
      const attack = enemy.atk + enemy.rage * (cycles - 1);
      hp -= attack - Math.min(attack, forecast.armor);
    }
  }
  return { won: enemyHp <= 0, hp: Math.max(0, hp), enemyHp: Math.max(0, enemyHp), cycles };
}

function drawObs(random, excluded = []) {
  const ordinary = OBS_TYPES.filter(type => type !== "unstable" && !excluded.includes(type));
  if (!excluded.includes("unstable") && random() < 0.12) return "unstable";
  return ordinary[Math.floor(random() * ordinary.length)];
}

function drawCycle(random, excluded = []) {
  const ordinary = CYCLE_TYPES.filter(type => type !== "leech" && !excluded.includes(type));
  if (!excluded.includes("leech") && random() < 0.11) return "leech";
  return ordinary[Math.floor(random() * ordinary.length)];
}

function createSystem(id) {
  if (id === "obs_0_1") {
    return {
      id,
      offerSize: 3,
      enemy: wave => OBS_ENEMIES[wave],
      battle: obsBattle,
      initial(random, make) {
        const types = [];
        while (types.length < 8) types.push(drawObs(random, types));
        return types.map(make);
      },
      offer(random) {
        const types = [];
        while (types.length < 3) types.push(drawObs(random, types));
        return types;
      },
      rare: type => type === "unstable",
    };
  }
  const variant = id === "cycle_0_2"
    ? { generatorDamage: 3, batteryArmor: 3 }
    : { generatorDamage: 0, batteryArmor: 0 };
  return {
    id,
    offerSize: 2,
    enemy: wave => CYCLE_ENEMIES[wave],
    battle: (build, enemy) => cycleBattle(build, enemy, variant),
    initial(random, make) {
      const types = [];
      while (types.length < 3) types.push(drawCycle(random, types));
      return types.map(make);
    },
    offer(random) {
      const first = drawCycle(random);
      return [first, drawCycle(random, [first])];
    },
    rare: type => type === "leech",
  };
}

function sampleBuilds(items, anchor = [], limit = BUILD_SAMPLES) {
  const length = Math.min(CAPACITY, items.length);
  let possible = 1;
  for (let index = 0; index < length; index += 1) possible *= items.length - index;
  const target = Math.min(limit, possible);
  const key = items.map(item => item.id).sort().join("|");
  const random = rng(hash(key));
  const builds = new Map();
  const add = build => {
    if (build.length !== length) return;
    builds.set(build.map(item => item.id).join(","), build);
  };
  if (anchor.length === length && anchor.every(item => items.some(candidate => candidate.id === item.id))) add(anchor);
  if (anchor.length) {
    const active = anchor.filter(item => items.some(candidate => candidate.id === item.id));
    const bench = items.filter(item => !active.some(candidate => candidate.id === item.id));
    for (let left = 0; left < active.length; left += 1) {
      for (let right = left + 1; right < active.length; right += 1) {
        const build = [...active];
        [build[left], build[right]] = [build[right], build[left]];
        add(build);
      }
    }
    for (const candidate of bench) {
      if (active.length < length) {
        for (let position = 0; position <= active.length; position += 1) {
          const build = [...active];
          build.splice(position, 0, candidate);
          add(build);
        }
      } else {
        for (let removed = 0; removed < active.length; removed += 1) {
          for (let position = 0; position < active.length; position += 1) {
            const build = active.filter((_, index) => index !== removed);
            build.splice(position, 0, candidate);
            add(build);
          }
        }
      }
    }
  }
  while (builds.size < target) add(shuffle(items, random).slice(0, length));
  return [...builds.values()];
}

function bestBuild(system, items, enemy, anchor = []) {
  const assessed = sampleBuilds(items, anchor).map(build => {
    const result = system.battle(build, enemy);
    return { build, result, utility: utility(result) };
  });
  assessed.sort((one, two) => two.utility - one.utility || buildDistance(anchor, one.build) - buildDistance(anchor, two.build));
  const best = assessed[0];
  return {
    ...best,
    nearBestShare: assessed.filter(row => row.utility >= best.utility - 3).length / assessed.length,
    fullHealthWinShare: assessed.filter(row => row.result.won && row.result.hp === MAX_HP).length / assessed.length,
  };
}

function preExistingRevalued(before, after, candidate) {
  const beforeIds = new Set(before.map(item => item.id));
  const afterExisting = after.filter(item => item.id !== candidate.id);
  if (afterExisting.some(item => !beforeIds.has(item.id))) return true;
  const sharedBefore = before.filter(item => afterExisting.some(candidateItem => candidateItem.id === item.id)).map(item => item.id);
  const sharedAfter = afterExisting.filter(item => beforeIds.has(item.id)).map(item => item.id);
  return lcsLength(sharedBefore, sharedAfter) < Math.max(0, sharedBefore.length - 1);
}

function evaluate(systemId) {
  const system = createSystem(systemId);
  const rewardGains = [];
  const chosenGains = [];
  const offerContrasts = [];
  const pivotDistances = [];
  const revaluations = [];
  const immediateUses = [];
  const nearBestShares = [];
  const fullHealthShares = [];
  const finalSignatures = new Map();
  const chosenTypes = new Map();
  const pairResults = new Map();
  let rareOffers = 0;
  let rareChosen = 0;

  for (let run = 1; run <= RUNS; run += 1) {
    const random = rng(hash(`${systemId}:${run}`));
    let serial = 0;
    const make = type => ({ id: `${run}:${serial += 1}`, type });
    const items = system.initial(random, make);
    let lastBest = [];

    for (let wave = 0; wave < 6; wave += 1) {
      const current = bestBuild(system, items, system.enemy(wave), lastBest);
      lastBest = current.build;
      nearBestShares.push(current.nearBestShare);
      fullHealthShares.push(current.fullHealthWinShare);
      if (wave === 5) {
        const signature = current.build.map(item => item.type).sort().join("+");
        finalSignatures.set(signature, (finalSignatures.get(signature) || 0) + 1);
        break;
      }

      const nextEnemy = system.enemy(wave + 1);
      const baseline = bestBuild(system, items, nextEnemy, current.build);
      const offeredTypes = system.offer(random);
      const candidates = offeredTypes.map(type => make(type));
      const options = candidates.map(candidate => {
        const after = bestBuild(system, [...items, candidate], nextEnemy, baseline.build);
        return { candidate, after, gain: after.utility - baseline.utility };
      }).sort((one, two) => two.gain - one.gain);

      for (const option of options) rewardGains.push(option.gain);
      offerContrasts.push(options[0].gain - options.at(-1).gain);
      const chosen = options[0];
      chosenGains.push(chosen.gain);
      pivotDistances.push(buildDistance(baseline.build, chosen.after.build));
      revaluations.push(Number(preExistingRevalued(baseline.build, chosen.after.build, chosen.candidate)));
      immediateUses.push(Number(chosen.after.build.some(item => item.id === chosen.candidate.id)));
      chosenTypes.set(chosen.candidate.type, (chosenTypes.get(chosen.candidate.type) || 0) + 1);
      if (system.rare(chosen.candidate.type)) rareChosen += 1;
      rareOffers += candidates.filter(candidate => system.rare(candidate.type)).length;

      for (let one = 0; one < options.length; one += 1) {
        for (let two = one + 1; two < options.length; two += 1) {
          const left = options[one];
          const right = options[two];
          const types = [left.candidate.type, right.candidate.type].sort();
          const key = types.join("|");
          if (!pairResults.has(key)) pairResults.set(key, { total: 0, wins: new Map() });
          const result = pairResults.get(key);
          result.total += 1;
          if (left.gain !== right.gain) {
            const winner = left.gain > right.gain ? left.candidate.type : right.candidate.type;
            result.wins.set(winner, (result.wins.get(winner) || 0) + 1);
          }
        }
      }

      items.push(chosen.candidate);
      lastBest = chosen.after.build;
    }
  }

  const pairSamples = [...pairResults.values()].filter(result => result.total >= 5);
  const reversals = pairSamples.filter(result => {
    const shares = [...result.wins.values()].map(count => count / result.total);
    return shares.length >= 2 && shares.every(share => share >= 0.2);
  });
  const topSignature = Math.max(...finalSignatures.values());
  const totalChoices = [...chosenTypes.values()].reduce((sum, value) => sum + value, 0);
  const topChosenType = [...chosenTypes.entries()].sort((one, two) => two[1] - one[1])[0];

  return {
    system: systemId,
    runs: RUNS,
    positivePotential: {
      chosenRewardGainMedian: round(percentile(chosenGains, 0.5)),
      chosenRewardGainP90: round(percentile(chosenGains, 0.9)),
      jackpotTail: round(percentile(chosenGains, 0.9) - percentile(chosenGains, 0.5)),
      averageOfferContrast: round(mean(offerContrasts)),
      meaningfulPivotRate: round(pivotDistances.filter(value => value >= 0.4).length / pivotDistances.length),
      averagePivotDistance: round(mean(pivotDistances)),
      existingPartRevaluationRate: round(mean(revaluations)),
      chosenPartImmediateUseRate: round(mean(immediateUses)),
      contextualPairReversalRate: round(reversals.length / Math.max(1, pairSamples.length)),
    },
    repetitionRisk: {
      averageNearBestBuildShare: round(mean(nearBestShares)),
      averageFullHealthBuildShare: round(mean(fullHealthShares)),
      finalBuildSignatureCount: finalSignatures.size,
      topFinalSignatureShare: round(topSignature / RUNS),
      topChosenRewardType: topChosenType?.[0] || null,
      topChosenRewardShare: round((topChosenType?.[1] || 0) / totalChoices),
    },
    jackpotWithoutDependency: {
      rareOfferRate: round(rareOffers / (RUNS * 5 * system.offerSize)),
      rareChosenRate: round(rareChosen / (RUNS * 5)),
      allRewardGainP10: round(percentile(rewardGains, 0.1)),
      allRewardGainP90: round(percentile(rewardGains, 0.9)),
    },
  };
}

const results = ["obs_0_1", "cycle_0_1", "cycle_0_2"].map(evaluate);
console.log(JSON.stringify({
  warning: "面白さの得点ではない。感情の山・再解釈・反復リスクを生みうる構造の代理指標。",
  configuration: { runs: RUNS, buildSamples: BUILD_SAMPLES },
  results,
}, null, 2));
