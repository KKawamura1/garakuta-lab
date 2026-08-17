const MAX_HP = 30;
const ACTIVE_CAPACITY = 5;
const BASE_ENEMIES = [
  { hp: 18, atk: 3, rage: 0 },
  { hp: 30, atk: 4, rage: 0 },
  { hp: 42, atk: 6, rage: 0 },
  { hp: 56, atk: 7, rage: 1 },
  { hp: 72, atk: 9, rage: 1 },
  { hp: 84, atk: 10, rage: 1 }
];

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function uniquePermutations(values, length) {
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const keys = [...counts.keys()];
  const result = [];
  const current = [];
  function visit() {
    if (current.length === length) {
      result.push([...current]);
      return;
    }
    for (const key of keys) {
      if (!counts.get(key)) continue;
      counts.set(key, counts.get(key) - 1);
      current.push(key);
      visit();
      current.pop();
      counts.set(key, counts.get(key) + 1);
    }
  }
  visit();
  return result;
}

function assignmentBuilds(items, slots, caps) {
  const activeTarget = Math.min(ACTIVE_CAPACITY, items.length);
  const result = [];
  const seen = new Set();
  const current = [];
  const counts = Object.fromEntries(slots.map(slot => [slot, 0]));
  const destinations = [...slots, "bench"];
  function visit(index, active) {
    if (index === items.length) {
      if (active !== activeTarget) return;
      const signature = current.map(entry => `${entry.type}:${entry.slot}`).sort().join("|");
      if (!seen.has(signature)) {
        seen.add(signature);
        result.push(current.map(entry => ({ ...entry })));
      }
      return;
    }
    const remaining = items.length - index;
    if (active > activeTarget || active + remaining < activeTarget) return;
    for (const slot of destinations) {
      if (slot !== "bench" && counts[slot] >= caps[slot]) continue;
      if (slot !== "bench" && active >= activeTarget) continue;
      if (slot !== "bench") counts[slot] += 1;
      current.push({ type: items[index], slot });
      visit(index + 1, active + Number(slot !== "bench"));
      current.pop();
      if (slot !== "bench") counts[slot] -= 1;
    }
  }
  visit(0, 0);
  return result;
}

function count(build, slot, type = null) {
  return build.filter(entry => entry.slot === slot && (!type || entry.type === type)).length;
}

function scaledEnemy(enemy, scale) {
  return {
    hp: Math.max(1, Math.round(enemy.hp * scale)),
    atk: Math.max(1, Math.round(enemy.atk * scale)),
    rage: enemy.rage ? Math.max(1, Math.round(enemy.rage * scale)) : 0
  };
}

function scoreResult(result) {
  return result.won
    ? 1_000_000 + result.hp * 1000 + (result.armorRemaining || 0) * 10 - result.cycles
    : -result.enemyHp * 1000 + result.hp;
}

const currentMaterialModel = {
  id: "multi_role_material",
  name: "A 多用途素材",
  ruleCount: 18,
  itemTypes: ["spring", "lens", "magnet", "blade", "resin", "core"],
  builds(items) {
    return assignmentBuilds(items, ["turret", "hull", "reactor"], { turret: 3, hull: 3, reactor: 3 });
  },
  forecast(build, cycle = 1) {
    let power = count(build, "reactor", "spring") * 2 + count(build, "reactor", "blade") * 3 + count(build, "reactor", "resin");
    power += count(build, "reactor", "magnet") * (1 + Math.min(3, count(build, "hull")));
    const outsideLenses = count(build, "turret", "lens") + count(build, "hull", "lens");
    power += count(build, "reactor", "lens") * (1 + Math.min(2, outsideLenses));
    power = Math.ceil(power * 1.5 ** count(build, "reactor", "core"));
    let damage = 2 + count(build, "turret", "spring") * (3 + (cycle % 2 === 0 ? 3 : 0));
    damage += count(build, "turret", "blade") * 7 + count(build, "turret", "resin") * 4;
    damage += count(build, "turret", "magnet") * (2 + Math.min(3, count(build, "hull")) * 2);
    damage += count(build, "turret", "lens") * Math.min(10, 2 + power * 2);
    damage = Math.ceil(damage * 1.5 ** count(build, "turret", "core"));
    let armor = count(build, "hull", "spring") * 6 + count(build, "hull", "blade") * 6 + count(build, "hull", "resin") * 4;
    armor += count(build, "hull", "magnet") * (2 + Math.min(3, count(build, "turret")) * 2);
    armor += count(build, "hull", "lens") * Math.min(10, 2 + power * 2);
    armor = Math.ceil(armor * 1.5 ** count(build, "hull", "core"));
    const healing = count(build, "turret", "resin") + count(build, "hull", "resin") + count(build, "reactor", "resin");
    return { power, damage, armor, healing };
  },
  battle(hpStart, enemy, build) {
    let hp = hpStart;
    let enemyHp = enemy.hp;
    let armor = this.forecast(build, 1).armor;
    const armorCapacity = armor;
    let cycles = 0;
    while (hp > 0 && enemyHp > 0 && cycles < 8) {
      cycles += 1;
      const f = this.forecast(build, cycles);
      hp = Math.min(MAX_HP, hp + f.healing);
      enemyHp -= f.damage;
      if (enemyHp > 0) {
        const attack = enemy.atk + enemy.rage * (cycles - 1);
        const blocked = Math.min(attack, armor);
        armor -= blocked;
        hp -= attack - blocked;
      }
    }
    return { won: enemyHp <= 0, hp: Math.max(0, hp), enemyHp: Math.max(0, enemyHp), armorCapacity, armorRemaining: armor, cycles };
  },
  preview(build) {
    const one = this.forecast(build, 1);
    const two = this.forecast(build, 2);
    return { offense: one.damage + two.damage, defense: one.armor + one.healing * 8, power: one.power };
  },
  archetype(build) {
    const f = this.forecast(build, 1);
    return `T${count(build, "turret")}H${count(build, "hull")}R${count(build, "reactor")}-D${Math.round(f.damage / 5)}A${Math.round(f.armor / 5)}P${Math.round(f.power / 2)}Y${f.healing}`;
  }
};

const mutationModel = {
  id: "fixed_chassis_mutations",
  name: "B 固定機械＋性質変異",
  ruleCount: 14,
  itemTypes: ["amplify", "echo", "link", "burst", "recycle", "wild"],
  builds(items) {
    return assignmentBuilds(items, ["engine", "cannon", "plating", "repair"], { engine: 2, cannon: 2, plating: 2, repair: 2 });
  },
  forecast(build, cycle = 1) {
    const mods = slot => count(build, slot);
    let power = 1;
    power += count(build, "engine", "amplify") * 2;
    power += count(build, "engine", "echo") * (cycle % 2 === 0 ? 3 : 1);
    power += count(build, "engine", "link") * Math.max(1, mods("cannon"));
    power += count(build, "engine", "burst") * (cycle === 1 ? 4 : 0);
    power += count(build, "engine", "recycle");
    power = Math.ceil(power * 1.5 ** count(build, "engine", "wild"));
    let damage = 4;
    damage += count(build, "cannon", "amplify") * 4;
    damage += count(build, "cannon", "echo") * (cycle % 2 === 0 ? 7 : 1);
    damage += count(build, "cannon", "link") * power * 2;
    damage += count(build, "cannon", "burst") * (cycle === 1 ? 9 : 1);
    damage += count(build, "cannon", "recycle") * (1 + mods("plating"));
    damage = Math.ceil(damage * 1.5 ** count(build, "cannon", "wild"));
    let armor = 0;
    armor += count(build, "plating", "amplify") * 7;
    armor += count(build, "plating", "echo") * 5;
    armor += count(build, "plating", "link") * (2 + power * 2);
    armor += count(build, "plating", "burst") * 10;
    armor += count(build, "plating", "recycle") * (3 + mods("cannon") * 2);
    armor = Math.ceil(armor * 1.5 ** count(build, "plating", "wild"));
    let healing = 0;
    healing += count(build, "repair", "amplify");
    healing += count(build, "repair", "echo") * Number(cycle % 2 === 0);
    healing += count(build, "repair", "link") * Math.floor(power / 2);
    healing += count(build, "repair", "burst") * (cycle === 1 ? 3 : 0);
    healing += count(build, "repair", "recycle");
    healing = Math.ceil(healing * 1.5 ** count(build, "repair", "wild"));
    return { power, damage, armor, healing };
  },
  battle(hpStart, enemy, build) {
    let hp = hpStart;
    let enemyHp = enemy.hp;
    let armor = this.forecast(build, 1).armor;
    const armorCapacity = armor;
    let cycles = 0;
    while (hp > 0 && enemyHp > 0 && cycles < 8) {
      cycles += 1;
      const f = this.forecast(build, cycles);
      hp = Math.min(MAX_HP, hp + f.healing);
      enemyHp -= f.damage;
      if (enemyHp > 0) {
        const attack = enemy.atk + enemy.rage * (cycles - 1);
        const blocked = Math.min(attack, armor);
        armor -= blocked;
        hp -= attack - blocked;
      }
    }
    return { won: enemyHp <= 0, hp: Math.max(0, hp), enemyHp: Math.max(0, enemyHp), armorCapacity, armorRemaining: armor, cycles };
  },
  preview(build) {
    const one = this.forecast(build, 1);
    const two = this.forecast(build, 2);
    return { offense: one.damage + two.damage, defense: one.armor + (one.healing + two.healing) * 6, power: one.power };
  },
  archetype(build) {
    const f = this.forecast(build, 1);
    return `E${count(build, "engine")}C${count(build, "cannon")}P${count(build, "plating")}R${count(build, "repair")}-D${Math.round(f.damage / 5)}A${Math.round(f.armor / 5)}Y${f.healing}`;
  }
};

const driveLineModel = {
  id: "cyclic_drive_line",
  name: "C 循環駆動列",
  ruleCount: 11,
  itemTypes: ["generator", "gun", "shield", "battery", "echo", "leech"],
  builds(items) {
    return uniquePermutations(items, Math.min(ACTIVE_CAPACITY, items.length));
  },
  cycle(build, carried = 0) {
    let energy = carried;
    let damage = 2;
    let armor = 0;
    let healing = 0;
    let previous = { energy: 0, damage: 0, armor: 0, healing: 0 };
    for (const type of build) {
      const effect = { energy: 0, damage: 0, armor: 0, healing: 0 };
      if (type === "generator") effect.energy = 2;
      if (type === "gun") {
        const spent = Math.min(2, energy);
        energy -= spent;
        effect.damage = 4 + spent * 2;
      }
      if (type === "shield") {
        const spent = Math.min(2, energy);
        energy -= spent;
        effect.armor = 3 + spent * 2;
      }
      if (type === "battery") effect.energy = 1;
      if (type === "echo") {
        effect.energy = Math.floor(previous.energy / 2);
        effect.damage = Math.max(1, Math.floor(previous.damage / 2));
        effect.armor = Math.floor(previous.armor / 2);
        effect.healing = Math.floor(previous.healing / 2);
      }
      if (type === "leech") {
        effect.damage = 3;
        effect.healing = 1;
      }
      energy += effect.energy;
      damage += effect.damage;
      armor += effect.armor;
      healing += effect.healing;
      previous = effect;
    }
    const nextCarry = build.includes("battery") ? Math.min(3, energy) : 0;
    return { damage, armor, healing, power: energy, carry: nextCarry };
  },
  battle(hpStart, enemy, build) {
    let hp = hpStart;
    let enemyHp = enemy.hp;
    let carried = 0;
    let cycles = 0;
    let totalArmor = 0;
    let unusedArmor = 0;
    while (hp > 0 && enemyHp > 0 && cycles < 8) {
      cycles += 1;
      const f = this.cycle(build, carried);
      carried = f.carry;
      hp = Math.min(MAX_HP, hp + f.healing);
      enemyHp -= f.damage;
      if (enemyHp > 0) {
        const attack = enemy.atk + enemy.rage * (cycles - 1);
        const blocked = Math.min(attack, f.armor);
        totalArmor += blocked;
        unusedArmor += f.armor - blocked;
        hp -= attack - blocked;
      }
    }
    return { won: enemyHp <= 0, hp: Math.max(0, hp), enemyHp: Math.max(0, enemyHp), armorCapacity: totalArmor + unusedArmor, armorRemaining: unusedArmor, cycles };
  },
  preview(build) {
    const one = this.cycle(build, 0);
    const two = this.cycle(build, one.carry);
    return { offense: one.damage + two.damage, defense: one.armor + two.armor + (one.healing + two.healing) * 6, power: one.power + two.power };
  },
  archetype(build) {
    const one = this.cycle(build, 0);
    const two = this.cycle(build, one.carry);
    return `D${Math.round((one.damage + two.damage) / 5)}A${Math.round((one.armor + two.armor) / 5)}Y${one.healing + two.healing}P${one.carry ? 1 : 0}-${build.slice(0, 2).join("+")}`;
  }
};

const MODELS = [currentMaterialModel, mutationModel, driveLineModel];
const buildCaches = new Map();
const battleCaches = new Map();

function itemKey(items) {
  return [...items].sort().join(",");
}

function getBuilds(model, items) {
  const key = `${model.id}|${itemKey(items)}`;
  if (!buildCaches.has(key)) buildCaches.set(key, model.builds(items));
  return buildCaches.get(key);
}

function evaluateBuilds(model, hp, enemy, items, scale) {
  const key = `${model.id}|${hp}|${enemy.hp}|${enemy.atk}|${enemy.rage}|${scale}|${itemKey(items)}`;
  if (!battleCaches.has(key)) {
    const target = scaledEnemy(enemy, scale);
    const evaluated = getBuilds(model, items).map(build => {
      const result = model.battle(hp, target, build);
      return { build, result, score: scoreResult(result), preview: model.preview(build) };
    }).sort((a, b) => b.score - a.score);
    battleCaches.set(key, evaluated);
  }
  return battleCaches.get(key);
}

function selectBuild(model, hp, enemy, items, scale, policy, random) {
  const choices = evaluateBuilds(model, hp, enemy, items, scale);
  if (policy === "random") return choices[Math.floor(random() * choices.length)];
  if (policy === "offense") return choices.reduce((best, choice) => choice.preview.offense > best.preview.offense ? choice : best);
  if (policy === "defense") return choices.reduce((best, choice) => choice.preview.defense > best.preview.defense ? choice : best);
  if (policy === "balanced") {
    const utility = choice => choice.preview.offense * 1.5 + choice.preview.defense + choice.preview.power;
    return choices.reduce((best, choice) => utility(choice) > utility(best) ? choice : best);
  }
  return choices[0];
}

function drawType(model, random, excluded = []) {
  const ordinary = model.itemTypes.filter(type => type !== model.itemTypes.at(-1) && !excluded.includes(type));
  const rare = model.itemTypes.at(-1);
  if (random() < 0.11 && !excluded.includes(rare)) return rare;
  return ordinary[Math.floor(random() * ordinary.length)];
}

function generateSeed(model, seed) {
  const random = rng(seed);
  const initial = [];
  while (initial.length < 3) initial.push(drawType(model, random, initial));
  const offers = [];
  for (let wave = 0; wave < 5; wave += 1) {
    const first = drawType(model, random);
    offers.push([first, drawType(model, random, [first])]);
  }
  return { seed, initial, offers };
}

function rewardScore(model, hp, enemy, items, candidate, scale, policy) {
  const choices = evaluateBuilds(model, hp, enemy, [...items, candidate], scale);
  if (policy === "myopic") return choices[0].score;
  const field = policy === "defense" ? "defense" : "offense";
  if (policy === "balanced") return Math.max(...choices.map(choice => choice.preview.offense * 1.5 + choice.preview.defense + choice.preview.power));
  return Math.max(...choices.map(choice => choice.preview[field]));
}

function playPolicy(model, generated, policy, scale) {
  const random = rng(generated.seed * 97 + policy.length * 7919);
  const items = [...generated.initial];
  let hp = MAX_HP;
  const archetypes = [];
  for (let wave = 0; wave < BASE_ENEMIES.length; wave += 1) {
    const selected = selectBuild(model, hp, BASE_ENEMIES[wave], items, scale, policy, random);
    archetypes.push(model.archetype(selected.build));
    if (!selected.result.won) return { won: false, reached: wave + 1, hp: selected.result.hp, archetypes };
    hp = Math.min(MAX_HP, selected.result.hp + 2);
    if (wave < 5) {
      const pair = generated.offers[wave];
      let picked;
      if (policy === "random") picked = pair[Math.floor(random() * 2)];
      else {
        const nextEnemy = BASE_ENEMIES[wave + 1];
        const firstScore = rewardScore(model, hp, nextEnemy, items, pair[0], scale, policy);
        const secondScore = rewardScore(model, hp, nextEnemy, items, pair[1], scale, policy);
        picked = firstScore >= secondScore ? pair[0] : pair[1];
      }
      items.push(picked);
    }
  }
  return { won: true, reached: 6, hp, archetypes };
}

function enumeratePaths(model, generated, scale) {
  const paths = [];
  for (let mask = 0; mask < 32; mask += 1) {
    const items = [...generated.initial];
    const choices = [];
    let hp = MAX_HP;
    let reached = 0;
    let won = false;
    for (let wave = 0; wave < BASE_ENEMIES.length; wave += 1) {
      reached = wave + 1;
      const best = evaluateBuilds(model, hp, BASE_ENEMIES[wave], items, scale)[0];
      if (!best.result.won) break;
      hp = Math.min(MAX_HP, best.result.hp + 2);
      if (wave === 5) {
        won = true;
        break;
      }
      const choiceIndex = (mask >> wave) & 1;
      const picked = generated.offers[wave][choiceIndex];
      choices.push(picked);
      items.push(picked);
    }
    paths.push({ mask, won, reached, hp, choices });
  }
  return paths;
}

function pathTopology(paths) {
  let forks = 0;
  let bothLive = 0;
  let oneLive = 0;
  let bothDead = 0;
  let deadLatencyTotal = 0;
  let deadLatencyCount = 0;
  for (let depth = 0; depth < 5; depth += 1) {
    for (let prefix = 0; prefix < 2 ** depth; prefix += 1) {
      const members = paths.filter(path => (path.mask & (2 ** depth - 1)) === prefix);
      if (!members.some(path => path.reached > depth + 1)) continue;
      const leftLive = members.some(path => ((path.mask >> depth) & 1) === 0 && path.won);
      const rightLive = members.some(path => ((path.mask >> depth) & 1) === 1 && path.won);
      forks += 1;
      if (leftLive && rightLive) bothLive += 1;
      else if (leftLive || rightLive) oneLive += 1;
      else bothDead += 1;
      for (const branch of [0, 1]) {
        const branchPaths = members.filter(path => ((path.mask >> depth) & 1) === branch);
        if (!branchPaths.length || branchPaths.some(path => path.won)) continue;
        const failureWave = Math.max(...branchPaths.map(path => path.reached));
        deadLatencyTotal += Math.max(0, failureWave - (depth + 2));
        deadLatencyCount += 1;
      }
    }
  }
  return {
    forks,
    bothLive,
    oneLive,
    bothDead,
    deadLatency: deadLatencyCount ? deadLatencyTotal / deadLatencyCount : 0
  };
}

function buildSpaceMetrics(model, hp, enemy, items, scale) {
  const choices = evaluateBuilds(model, hp, enemy, items, scale);
  const best = choices[0];
  const winning = choices.filter(choice => choice.result.won);
  const plausible = best.result.won
    ? choices.filter(choice => choice.result.won && choice.result.hp >= best.result.hp - 5)
    : choices.filter(choice => choice.result.enemyHp <= best.result.enemyHp + 10);
  return {
    rawChoices: choices.length,
    winningBasin: winning.length / choices.length,
    winningArchetypes: new Set(winning.map(choice => model.archetype(choice.build))).size,
    effectiveChoices: new Set(plausible.map(choice => model.archetype(choice.build))).size
  };
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function runModel(model, seeds, scale) {
  const policies = ["random", "offense", "defense", "balanced", "myopic"];
  const policyResults = Object.fromEntries(policies.map(policy => [policy, []]));
  const oracleWins = [];
  const branchShares = [];
  const topology = [];
  const spaces = [];
  const finalArchetypes = [];
  for (const seed of seeds) {
    const generated = generateSeed(model, seed);
    for (const policy of policies) {
      const result = playPolicy(model, generated, policy, scale);
      policyResults[policy].push(result);
      if (policy === "myopic" && result.won) finalArchetypes.push(result.archetypes.at(-1));
    }
    const paths = enumeratePaths(model, generated, scale);
    oracleWins.push(Number(paths.some(path => path.won)));
    branchShares.push(paths.filter(path => path.won).length / paths.length);
    topology.push(pathTopology(paths));
    if (spaces.length < Math.min(40, seeds.length)) {
      const myopic = playPolicy(model, generated, "myopic", scale);
      const chosenItems = [...generated.initial];
      for (let wave = 0; wave < 5; wave += 1) {
        const pair = generated.offers[wave];
        const hp = MAX_HP;
        const first = rewardScore(model, hp, BASE_ENEMIES[Math.min(5, wave + 1)], chosenItems, pair[0], scale, "myopic");
        const second = rewardScore(model, hp, BASE_ENEMIES[Math.min(5, wave + 1)], chosenItems, pair[1], scale, "myopic");
        chosenItems.push(first >= second ? pair[0] : pair[1]);
      }
      spaces.push(buildSpaceMetrics(model, MAX_HP, BASE_ENEMIES[5], chosenItems, scale));
    }
  }
  const wins = policy => mean(policyResults[policy].map(result => Number(result.won)));
  return {
    model: model.id,
    name: model.name,
    scale,
    seeds: seeds.length,
    ruleCount: model.ruleCount,
    winRates: Object.fromEntries(policies.map(policy => [policy, round(wins(policy))])),
    oracleWinRate: round(mean(oracleWins)),
    branchWinShare: round(mean(branchShares)),
    futureKnowledgeGap: round(mean(oracleWins) - wins("myopic")),
    simpleSkillGap: round(wins("myopic") - Math.max(wins("offense"), wins("defense"), wins("balanced"))),
    topology: {
      bothLiveShare: round(mean(topology.map(value => value.forks ? value.bothLive / value.forks : 0))),
      oneLiveShare: round(mean(topology.map(value => value.forks ? value.oneLive / value.forks : 0))),
      bothDeadShare: round(mean(topology.map(value => value.forks ? value.bothDead / value.forks : 0))),
      deadLatencyBattles: round(mean(topology.map(value => value.deadLatency)))
    },
    buildSpace: {
      rawChoices: round(mean(spaces.map(value => value.rawChoices)), 1),
      winningBasin: round(mean(spaces.map(value => value.winningBasin))),
      winningArchetypes: round(mean(spaces.map(value => value.winningArchetypes)), 1),
      effectiveChoices: round(mean(spaces.map(value => value.effectiveChoices)), 1)
    },
    finalArchetypeDiversity: new Set(finalArchetypes).size
  };
}

const seedCountArg = process.argv.find(arg => arg.startsWith("--seeds="));
const seedCount = Number(seedCountArg?.slice("--seeds=".length) || 160);
const scalesArg = process.argv.find(arg => arg.startsWith("--scales="));
const scales = scalesArg
  ? scalesArg.slice("--scales=".length).split(",").map(Number)
  : [1, 0.9, 1.1];
const modelsArg = process.argv.find(arg => arg.startsWith("--models="));
const selectedModels = modelsArg
  ? new Set(modelsArg.slice("--models=".length).split(","))
  : null;
const baseSeeds = Array.from({ length: seedCount }, (_, index) => index + 1);
const robustnessSeeds = baseSeeds.slice(0, Math.min(80, seedCount));
const results = [];
for (const model of MODELS.filter(candidate => !selectedModels || selectedModels.has(candidate.id))) {
  for (const scale of scales) {
    results.push(runModel(model, scale === 1 ? baseSeeds : robustnessSeeds, scale));
  }
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  definition: {
    futureKnowledgeGap: "全報酬経路のどこかに勝ち筋がある率 − 次の一戦だけ最適化する仮想プレイヤーの勝率",
    simpleSkillGap: "一戦最適化 − 最良の単純ヒューリスティック",
    branchWinShare: "全32報酬選択経路のうち、各戦闘を最適配置した場合に勝てる割合",
    bothLiveShare: "到達可能な報酬ノードで、どちらを選んでも将来の勝ち筋が残る割合",
    oneLiveShare: "片方だけに将来の勝ち筋が残る割合",
    deadLatencyBattles: "数学的に勝ち筋を失ってから敗北が観測されるまでの平均戦闘数",
    winningBasin: "最終戦の全構成に占める勝利構成の割合",
    effectiveChoices: "最善から耐久5以内にある、機能的に異なる構成群の数"
  },
  results
}, null, 2));
