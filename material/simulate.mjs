const MAX_HP = 30;
const BAY_CAPACITY = 3;
const ACTIVE_CAPACITY = 5;
const COMMON = ["spring", "lens", "magnet", "blade", "resin"];
const TYPES = [...COMMON, "core"];

const ENEMIES = [
  { name: "偵察ダニ", hp: 18, atk: 3, rage: 0 },
  { name: "採掘モグラ", hp: 30, atk: 4, rage: 0 },
  { name: "鋲打ちムカデ", hp: 42, atk: 6, rage: 0 },
  { name: "赤熱カラス", hp: 56, atk: 7, rage: 1 },
  { name: "圧砕ゴリラ", hp: 72, atk: 9, rage: 1 },
  { name: "廃棄場の王", hp: 84, atk: 10, rage: 1 }
];

function randomType(exclude = []) {
  const common = COMMON.filter(type => !exclude.includes(type));
  if (Math.random() < 0.11 && !exclude.includes("core")) return "core";
  return common[Math.floor(Math.random() * common.length)];
}

function forecast(materials, cycle = 1) {
  const count = (bay, type) => materials.filter(m => m.bay === bay && m.type === type).length;
  const bayCount = bay => materials.filter(m => m.bay === bay).length;
  let power = count("reactor", "spring") * 2 + count("reactor", "blade") * 3 + count("reactor", "resin");
  power += count("reactor", "magnet") * (1 + Math.min(3, bayCount("hull")));
  const outsideLenses = count("turret", "lens") + count("hull", "lens");
  power += count("reactor", "lens") * (1 + Math.min(2, outsideLenses));
  power = Math.ceil(power * Math.pow(1.5, count("reactor", "core")));

  let damage = 2 + count("turret", "spring") * (3 + (cycle % 2 === 0 ? 3 : 0));
  damage += count("turret", "blade") * 7 + count("turret", "resin") * 4;
  damage += count("turret", "magnet") * (2 + Math.min(3, bayCount("hull")) * 2);
  damage += count("turret", "lens") * Math.min(10, 2 + power * 2);
  damage = Math.ceil(damage * Math.pow(1.5, count("turret", "core")));

  let armor = count("hull", "spring") * 6 + count("hull", "blade") * 6 + count("hull", "resin") * 4;
  armor += count("hull", "magnet") * (2 + Math.min(3, bayCount("turret")) * 2);
  armor += count("hull", "lens") * Math.min(10, 2 + power * 2);
  armor = Math.ceil(armor * Math.pow(1.5, count("hull", "core")));
  const healing = materials.filter(m => m.type === "resin" && m.bay !== "bench").length;
  return { power, damage, armor, healing };
}

function battle(hpStart, enemy, materials) {
  let hp = hpStart;
  let enemyHp = enemy.hp;
  let armor = forecast(materials, 1).armor;
  const armorCapacity = armor;
  let cycles = 0;
  while (hp > 0 && enemyHp > 0 && cycles < 8) {
    cycles += 1;
    const f = forecast(materials, cycles);
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
}

function placements(types) {
  const result = [];
  const seen = new Set();
  const bays = ["turret", "hull", "reactor", "bench"];
  const current = [];
  const counts = { turret: 0, hull: 0, reactor: 0 };
  const targetActive = Math.min(ACTIVE_CAPACITY, types.length);
  function visit(index) {
    if (index === types.length) {
      if (current.filter(m => m.bay !== "bench").length === targetActive) {
        const signature = current.map(m => `${m.type}:${m.bay}`).sort().join("|");
        if (!seen.has(signature)) {
          seen.add(signature);
          result.push(current.map(m => ({ ...m })));
        }
      }
      return;
    }
    const active = current.filter(m => m.bay !== "bench").length;
    const remaining = types.length - index;
    if (active > targetActive || active + remaining < targetActive) return;
    for (const bay of bays) {
      if (bay !== "bench" && counts[bay] >= BAY_CAPACITY) continue;
      if (bay !== "bench" && active >= targetActive) continue;
      if (bay !== "bench") counts[bay] += 1;
      current.push({ type: types[index], bay });
      visit(index + 1);
      current.pop();
      if (bay !== "bench") counts[bay] -= 1;
    }
  }
  visit(0);
  return result;
}

const placementCache = new Map();
function bestBattle(hp, enemy, types) {
  const key = [...types].sort().join(",");
  if (!placementCache.has(key)) placementCache.set(key, placements(types));
  let best = null;
  let second = null;
  for (const build of placementCache.get(key)) {
    const result = battle(hp, enemy, build);
    const score = result.won
      ? 1_000_000 + result.hp * 1000 + result.armorRemaining * 10 - result.cycles
      : -result.enemyHp * 1000 + result.hp;
    const candidate = { score, result, build };
    if (!best || score > best.score) {
      second = best;
      best = candidate;
    } else if (!second || score > second.score) {
      second = candidate;
    }
  }
  return { ...best, margin: best.score - (second?.score ?? best.score) };
}

function runOne() {
  const types = [];
  const used = [];
  for (let i = 0; i < 3; i += 1) {
    const type = randomType(used);
    types.push(type);
    used.push(type);
  }
  let hp = MAX_HP;
  const battles = [];
  for (let wave = 0; wave < ENEMIES.length; wave += 1) {
    const chosen = bestBattle(hp, ENEMIES[wave], types);
    battles.push(chosen);
    if (!chosen.result.won) return { won: false, reached: wave + 1, battles };
    hp = Math.min(MAX_HP, chosen.result.hp + 2);
    if (wave < ENEMIES.length - 1) types.push(randomType());
  }
  return { won: true, reached: 6, battles };
}

const RUNS = Number(process.argv[2] || 500);
const DEBUG = process.argv.includes("--debug");
const totals = {
  wins: 0,
  reached: Array(7).fill(0),
  hullCounts: Array(4).fill(0),
  battles: 0,
  armorNecessary: 0,
  armorUnused: 0,
  closeChoices: 0
};

for (let i = 0; i < RUNS; i += 1) {
  const run = runOne();
  if (DEBUG && i < 3) {
    console.error(JSON.stringify(run.battles.map((chosen, wave) => ({
      wave: wave + 1,
      result: chosen.result,
      build: chosen.build.filter(m => m.bay !== "bench")
    })), null, 2));
  }
  totals.wins += Number(run.won);
  totals.reached[run.reached] += 1;
  for (const chosen of run.battles) {
    totals.battles += 1;
    totals.hullCounts[chosen.build.filter(m => m.bay === "hull").length] += 1;
    totals.armorUnused += Number(chosen.result.armorCapacity > 0 && chosen.result.armorRemaining === chosen.result.armorCapacity);
    totals.closeChoices += Number(chosen.margin < 1000);
  }
}

console.log(JSON.stringify({
  runs: RUNS,
  winRate: totals.wins / RUNS,
  reached: totals.reached,
  hullShare: totals.hullCounts.map(n => n / totals.battles),
  unusedArmorShare: totals.armorUnused / totals.battles,
  closeChoiceShare: totals.closeChoices / totals.battles,
  cachedMaterialSets: placementCache.size
}, null, 2));
