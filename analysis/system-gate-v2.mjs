const MAX_HP = 30;
const ACTIVE_CAPACITY = 5;
const BASE_ENEMIES = [
  { name: "偵察ダニ", hp: 16, atk: 3, rage: 0 },
  { name: "採掘モグラ", hp: 28, atk: 4, rage: 0 },
  { name: "鋲打ちムカデ", hp: 39, atk: 6, rage: 0 },
  { name: "赤熱カラス", hp: 53, atk: 7, rage: 1 },
  { name: "圧砕ゴリラ", hp: 68, atk: 8, rage: 1 },
  { name: "廃棄場の王", hp: 79, atk: 9, rage: 1 },
];
const ITEM_TYPES = ["generator", "gun", "shield", "battery", "echo", "leech"];
const OBSERVED_FAILED_RUNS = [
  {
    id: "632fd1a9",
    initial: ["battery", "gun", "echo"],
    offers: [["gun", "leech"], ["battery", "echo"], ["generator", "battery"], ["generator", "battery"]],
  },
  {
    id: "f6824ce4",
    initial: ["generator", "echo", "leech"],
    offers: [["gun", "echo"], ["battery", "gun"], ["battery", "gun"], ["gun", "battery"]],
  },
];

const VARIANTS = [
  {
    id: "cycle_0_1",
    name: "現行CYCLE 0.1",
    description: "公開版と同じ数値・機構",
  },
  {
    id: "numeric_relief",
    name: "数値緩和のみ",
    description: "ルールを変えず、敵耐久と攻撃を10%低下",
    enemyHpScale: 0.9,
    enemyAtkScale: 0.9,
  },
  {
    id: "fixed_chassis",
    name: "固定基礎機能",
    description: "各巡に本体から電力1・装甲2。ランダム部品が役割を欠いても基本動作を残す",
    baseEnergy: 1,
    baseArmor: 2,
  },
  {
    id: "dual_role_sources",
    name: "供給部品の複合化",
    description: "発電機は攻撃2、蓄電器は装甲2も同時に出す",
    generatorDamage: 2,
    batteryArmor: 2,
  },
  {
    id: "fixed_chassis_strong",
    name: "固定本体を主役化",
    description: "本体が毎巡攻撃4・電力1・装甲3を持ち、部品は必須役割ではなく変形要素になる",
    baseDamage: 4,
    baseEnergy: 1,
    baseArmor: 3,
  },
  {
    id: "multi_output_sources",
    name: "供給部品を多用途化",
    description: "発電機は攻撃3、蓄電器は装甲3も出し、専用消費先がなくても役割を持つ",
    generatorDamage: 3,
    batteryArmor: 3,
  },
  {
    id: "multi_output_relief_97",
    name: "多用途供給＋耐久3%緩和",
    description: "供給部品の多用途化に加え、撃破巡回の境界だけをわずかに緩める",
    generatorDamage: 3,
    batteryArmor: 3,
    enemyHpScale: 0.97,
  },
  {
    id: "multi_output_relief_95",
    name: "多用途供給＋耐久5%緩和",
    description: "供給部品の多用途化に加え、敵耐久を5%低下",
    generatorDamage: 3,
    batteryArmor: 3,
    enemyHpScale: 0.95,
  },
  {
    id: "multi_output_curated_rng",
    name: "多用途供給＋検証済み乱数",
    description: "ルールは多用途供給版のまま、勝利経路25%以上・不可視の将来罠なしのランだけを採用",
    generatorDamage: 3,
    batteryArmor: 3,
    curated: true,
  },
];

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
}

function enemyFor(variant, wave) {
  const source = BASE_ENEMIES[wave];
  return {
    ...source,
    hp: Math.max(1, Math.round(source.hp * (variant.enemyHpScale || 1))),
    atk: Math.max(1, Math.round(source.atk * (variant.enemyAtkScale || 1))),
  };
}

function drawType(random, excluded = [], allowed = ITEM_TYPES) {
  const rareAllowed = allowed.includes("leech") && !excluded.includes("leech");
  const ordinary = allowed.filter(type => type !== "leech" && !excluded.includes(type));
  if (rareAllowed && random() < 0.11) return "leech";
  if (!ordinary.length) return "leech";
  return ordinary[Math.floor(random() * ordinary.length)];
}

function generateSeed(seed, allowed = ITEM_TYPES) {
  const random = rng(seed);
  const initial = [];
  while (initial.length < 3) initial.push(drawType(random, initial, allowed));
  const offers = [];
  for (let wave = 0; wave < 5; wave += 1) {
    const first = drawType(random, [], allowed);
    offers.push([first, drawType(random, [first], allowed)]);
  }
  return { seed, initial, offers };
}

function uniqueBuilds(items) {
  const length = Math.min(ACTIVE_CAPACITY, items.length);
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  const result = [];
  const current = [];
  function visit() {
    if (current.length === length) {
      result.push([...current]);
      return;
    }
    for (const [item, count] of counts) {
      if (!count) continue;
      counts.set(item, count - 1);
      current.push(item);
      visit();
      current.pop();
      counts.set(item, count);
    }
  }
  visit();
  return result;
}

function cycle(variant, build, carried = 0) {
  let energy = carried + (variant.baseEnergy || 0);
  let damage = variant.baseDamage || 2;
  let armor = variant.baseArmor || 0;
  let healing = 0;
  let previous = { energy: 0, damage: 0, armor: 0, healing: 0 };
  for (const type of build) {
    const effect = { energy: 0, damage: 0, armor: 0, healing: 0 };
    if (type === "generator") {
      effect.energy = 2;
      effect.damage = variant.generatorDamage || 0;
    }
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
    if (type === "battery") {
      effect.energy = 1;
      effect.armor = variant.batteryArmor || 0;
    }
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
  return {
    energy,
    damage,
    armor,
    healing,
    carry: build.includes("battery") ? Math.min(3, energy) : 0,
  };
}

function battle(variant, hpStart, enemy, build, cycleLimit = 8) {
  let hp = hpStart;
  let enemyHp = enemy.hp;
  let carried = 0;
  let cycles = 0;
  while (hp > 0 && enemyHp > 0 && cycles < cycleLimit) {
    cycles += 1;
    const forecast = cycle(variant, build, carried);
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

function resultScore(result) {
  return result.won
    ? 1_000_000 + result.hp * 1_000 - result.cycles
    : -result.enemyHp * 1_000 + result.hp;
}

const buildCache = new Map();
const battleCache = new Map();

function itemKey(items) {
  return [...items].sort().join(",");
}

function allBuilds(items) {
  const key = itemKey(items);
  if (!buildCache.has(key)) buildCache.set(key, uniqueBuilds(items));
  return buildCache.get(key);
}

function battleChoices(variant, hp, wave, items) {
  const key = `${variant.id}|${hp}|${wave}|${itemKey(items)}`;
  if (!battleCache.has(key)) {
    const enemy = enemyFor(variant, wave);
    const choices = allBuilds(items).map(build => ({ build, result: battle(variant, hp, enemy, build) }));
    choices.sort((a, b) => resultScore(b.result) - resultScore(a.result));
    battleCache.set(key, choices);
  }
  return battleCache.get(key);
}

function bestBattle(variant, hp, wave, items) {
  return battleChoices(variant, hp, wave, items)[0];
}

function countType(values, type) {
  return values.filter(value => value === type).length;
}

function candidateMatters(variant, hp, wave, items, candidate) {
  const baseline = bestBattle(variant, hp, wave, items);
  const choices = battleChoices(variant, hp, wave, [...items, candidate]);
  if (resultScore(choices[0].result) > resultScore(baseline.result)) return true;
  const previousCount = countType(items, candidate);
  return choices.some(choice => {
    const nearBest = baseline.result.won
      ? choice.result.won && choice.result.hp >= baseline.result.hp - 2
      : !choice.result.won && choice.result.enemyHp <= baseline.result.enemyHp + 3;
    return nearBest && countType(choice.build, candidate) > previousCount;
  });
}

function simulateMask(variant, generated, mask) {
  const items = [...generated.initial];
  let hp = MAX_HP;
  const decisions = [];
  for (let wave = 0; wave < BASE_ENEMIES.length; wave += 1) {
    const selected = bestBattle(variant, hp, wave, items);
    if (!selected.result.won) return { won: false, reached: wave + 1, hp: selected.result.hp, decisions };
    hp = Math.min(MAX_HP, selected.result.hp + 2);
    if (wave === BASE_ENEMIES.length - 1) return { won: true, reached: 6, hp, decisions };
    const pair = generated.offers[wave];
    const immediate = pair.map(candidate => bestBattle(variant, hp, wave + 1, [...items, candidate]).result);
    decisions.push({ depth: wave, prefix: mask & (2 ** wave - 1), hp, items: [...items], pair, immediate });
    items.push(pair[(mask >> wave) & 1]);
  }
  return { won: false, reached: 6, hp, decisions };
}

function pathAnalysis(variant, generated) {
  const paths = Array.from({ length: 32 }, (_, mask) => ({ mask, ...simulateMask(variant, generated, mask) }));
  const decisionNodes = new Map();
  for (const path of paths) {
    for (const decision of path.decisions) {
      const key = `${decision.depth}:${decision.prefix}`;
      if (!decisionNodes.has(key)) decisionNodes.set(key, decision);
    }
  }
  let oneLive = 0;
  let hiddenTrap = 0;
  let bothDead = 0;
  for (const decision of decisionNodes.values()) {
    const matching = paths.filter(path => (path.mask & (2 ** decision.depth - 1)) === decision.prefix);
    const live = [0, 1].map(branch => matching.some(path => ((path.mask >> decision.depth) & 1) === branch && path.won));
    if (!live[0] && !live[1]) bothDead += 1;
    if (live[0] !== live[1]) {
      oneLive += 1;
      const [a, b] = decision.immediate;
      const looksSame = a.won === b.won && (a.won ? Math.abs(a.hp - b.hp) <= 2 : Math.abs(a.enemyHp - b.enemyHp) <= 3);
      if (looksSame) hiddenTrap += 1;
    }
  }
  return {
    won: paths.some(path => path.won),
    branchShare: paths.filter(path => path.won).length / 32,
    hiddenTrapShare: oneLive ? hiddenTrap / oneLive : 0,
    bothDeadShare: decisionNodes.size ? bothDead / decisionNodes.size : 0,
    oneLiveForks: oneLive,
    hiddenTrapForks: hiddenTrap,
    decisionForks: decisionNodes.size,
    bothDeadForks: bothDead,
  };
}

function canWinThroughFifthBattle(variant, observed) {
  for (let mask = 0; mask < 16; mask += 1) {
    const items = [...observed.initial];
    let hp = MAX_HP;
    let alive = true;
    for (let wave = 0; wave < 5; wave += 1) {
      const selected = bestBattle(variant, hp, wave, items);
      if (!selected.result.won) {
        alive = false;
        break;
      }
      hp = Math.min(MAX_HP, selected.result.hp + 2);
      if (wave < 4) items.push(observed.offers[wave][(mask >> wave) & 1]);
    }
    if (alive) return true;
  }
  return false;
}

function visibleBattleScore(variant, hp, wave, build) {
  return resultScore(battle(variant, hp, enemyFor(variant, wave), build));
}

function neighbors(build, items) {
  const results = [];
  for (let index = 0; index < build.length - 1; index += 1) {
    const candidate = [...build];
    [candidate[index], candidate[index + 1]] = [candidate[index + 1], candidate[index]];
    results.push(candidate);
  }
  const remaining = [...items];
  for (const active of build) remaining.splice(remaining.indexOf(active), 1);
  for (let index = 0; index < build.length; index += 1) {
    for (const benched of new Set(remaining)) {
      const candidate = [...build];
      candidate[index] = benched;
      results.push(candidate);
    }
  }
  return results;
}

function canonicalBuild(previous, items) {
  const available = [...items];
  const kept = [];
  for (const type of previous) {
    const index = available.indexOf(type);
    if (index >= 0 && kept.length < ACTIVE_CAPACITY) {
      kept.push(type);
      available.splice(index, 1);
    }
  }
  while (kept.length < Math.min(ACTIVE_CAPACITY, items.length)) kept.push(available.shift());
  return kept;
}

function improveBuild(variant, hp, wave, start, items, steps) {
  let build = canonicalBuild(start, items);
  for (let step = 0; step < steps; step += 1) {
    const currentScore = visibleBattleScore(variant, hp, wave, build);
    const choices = neighbors(build, items).map(candidate => ({ build: candidate, score: visibleBattleScore(variant, hp, wave, candidate) }));
    choices.sort((a, b) => b.score - a.score);
    if (!choices.length || choices[0].score <= currentScore) break;
    build = choices[0].build;
  }
  return build;
}

function playVisiblePolicy(variant, generated, moveBudget) {
  const items = [...generated.initial];
  let build = [...generated.initial];
  let hp = MAX_HP;
  let deadCandidates = 0;
  let deadPairs = 0;
  let candidateCount = 0;
  const deadPairsByWave = [0, 0, 0, 0, 0];
  const offersByWave = [0, 0, 0, 0, 0];
  for (let wave = 0; wave < BASE_ENEMIES.length; wave += 1) {
    build = improveBuild(variant, hp, wave, build, items, moveBudget);
    const result = battle(variant, hp, enemyFor(variant, wave), build);
    if (!result.won) return { won: false, reached: wave + 1, deadCandidates, deadPairs, candidateCount, deadPairsByWave, offersByWave };
    hp = Math.min(MAX_HP, result.hp + 2);
    if (wave === BASE_ENEMIES.length - 1) return { won: true, reached: 6, deadCandidates, deadPairs, candidateCount, deadPairsByWave, offersByWave };
    const pair = generated.offers[wave];
    const evaluated = pair.map(candidate => {
      const candidateItems = [...items, candidate];
      const candidateBuild = canonicalBuild(build, candidateItems);
      const improved = improveBuild(variant, hp, wave + 1, candidateBuild, candidateItems, moveBudget);
      const score = visibleBattleScore(variant, hp, wave + 1, improved);
      const dead = !candidateMatters(variant, hp, wave + 1, items, candidate);
      return { candidate, build: improved, score, dead };
    });
    deadCandidates += evaluated.filter(value => value.dead).length;
    deadPairs += Number(evaluated.every(value => value.dead));
    deadPairsByWave[wave] += Number(evaluated.every(value => value.dead));
    offersByWave[wave] += 1;
    candidateCount += 2;
    evaluated.sort((a, b) => b.score - a.score);
    items.push(evaluated[0].candidate);
    build = canonicalBuild(evaluated[0].build, items);
  }
  return { won: false, reached: 6, deadCandidates, deadPairs, candidateCount, deadPairsByWave, offersByWave };
}

function playMyopicOracle(variant, generated) {
  const items = [...generated.initial];
  let hp = MAX_HP;
  for (let wave = 0; wave < BASE_ENEMIES.length; wave += 1) {
    const selected = bestBattle(variant, hp, wave, items);
    if (!selected.result.won) return { won: false, reached: wave + 1 };
    hp = Math.min(MAX_HP, selected.result.hp + 2);
    if (wave === BASE_ENEMIES.length - 1) return { won: true, reached: 6 };
    const pair = generated.offers[wave];
    const choices = pair.map(candidate => ({ candidate, result: bestBattle(variant, hp, wave + 1, [...items, candidate]).result }));
    choices.sort((a, b) => resultScore(b.result) - resultScore(a.result));
    items.push(choices[0].candidate);
  }
  return { won: false, reached: 6 };
}

function evaluateVariant(variant, seedCount, ablationSeedCount) {
  const pathResults = [];
  const myopicResults = [];
  const boundedResults = [];
  const naiveResults = [];
  let attempts = 0;
  for (let seed = 1; pathResults.length < seedCount && attempts < seedCount * 20; seed += 1) {
    attempts += 1;
    const generated = generateSeed(seed);
    const pathResult = pathAnalysis(variant, generated);
    if (variant.curated && (!pathResult.won || pathResult.branchShare < 0.25 || pathResult.hiddenTrapForks > 0)) continue;
    pathResults.push(pathResult);
    myopicResults.push(playMyopicOracle(variant, generated));
    boundedResults.push(playVisiblePolicy(variant, generated, 3));
    naiveResults.push(playVisiblePolicy(variant, generated, 0));
  }
  const roleAblation = {};
  for (const omitted of ITEM_TYPES) {
    const allowed = ITEM_TYPES.filter(type => type !== omitted);
    let wins = 0;
    for (let seed = 1; seed <= ablationSeedCount; seed += 1) {
      const generated = generateSeed(seed * 1009 + omitted.length * 7919, allowed);
      wins += Number(pathAnalysis(variant, generated).won);
    }
    roleAblation[omitted] = round(wins / ablationSeedCount);
  }
  const oracleWinRate = mean(pathResults.map(result => Number(result.won)));
  const boundedWinRate = mean(boundedResults.map(result => Number(result.won)));
  const naiveWinRate = mean(naiveResults.map(result => Number(result.won)));
  const candidateCount = boundedResults.reduce((sum, result) => sum + result.candidateCount, 0);
  const reachedOfferPairs = candidateCount / 2;
  const deadPairsByWave = [0, 1, 2, 3, 4].map(wave => boundedResults.reduce((sum, result) => sum + result.deadPairsByWave[wave], 0));
  const offersByWave = [0, 1, 2, 3, 4].map(wave => boundedResults.reduce((sum, result) => sum + result.offersByWave[wave], 0));
  const oneLiveForks = pathResults.reduce((sum, result) => sum + result.oneLiveForks, 0);
  const decisionForks = pathResults.reduce((sum, result) => sum + result.decisionForks, 0);
  const metrics = {
    generatorAcceptanceRate: round(pathResults.length / attempts),
    observedFailedRunsNowSolvable: OBSERVED_FAILED_RUNS.filter(run => canWinThroughFifthBattle(variant, run)).map(run => run.id),
    oracleWinRate: round(oracleWinRate),
    zeroPathSeedRate: round(1 - oracleWinRate),
    branchShareMean: round(mean(pathResults.map(result => result.branchShare))),
    branchShareP10: round(percentile(pathResults.map(result => result.branchShare), 0.1)),
    myopicOracleWinRate: round(mean(myopicResults.map(result => Number(result.won)))),
    boundedVisibleWinRate: round(boundedWinRate),
    naiveVisibleWinRate: round(naiveWinRate),
    humanOracleGap: round(oracleWinRate - boundedWinRate),
    visibleAgencyGap: round(boundedWinRate - naiveWinRate),
    hiddenTrapShare: round(oneLiveForks ? pathResults.reduce((sum, result) => sum + result.hiddenTrapForks, 0) / oneLiveForks : 0),
    seedsWithHiddenTrapRate: round(mean(pathResults.map(result => Number(result.hiddenTrapForks > 0)))),
    bothDeadForkShare: round(decisionForks ? pathResults.reduce((sum, result) => sum + result.bothDeadForks, 0) / decisionForks : 0),
    deadCandidateShare: round(candidateCount ? boundedResults.reduce((sum, result) => sum + result.deadCandidates, 0) / candidateCount : 0),
    deadPairShare: round(reachedOfferPairs ? boundedResults.reduce((sum, result) => sum + result.deadPairs, 0) / reachedOfferPairs : 0),
    deadPairShareByWave: deadPairsByWave.map((count, wave) => round(offersByWave[wave] ? count / offersByWave[wave] : 0)),
    roleAblation,
    worstRoleAblation: round(Math.min(...Object.values(roleAblation))),
  };
  const gates = {
    almostAlwaysSolvable: metrics.oracleWinRate >= 0.98,
    noCatastrophicTail: metrics.branchShareP10 >= 0.1,
    humanReachable: metrics.boundedVisibleWinRate >= 0.65 && metrics.humanOracleGap <= 0.25,
    judgmentMatters: metrics.visibleAgencyGap >= 0.15,
    futureTrapControlled: metrics.hiddenTrapShare <= 0.05,
    offersUsuallyMatter: metrics.deadPairShare <= 0.05,
    noNamedRoleRequired: metrics.worstRoleAblation >= 0.9,
  };
  return { id: variant.id, name: variant.name, description: variant.description, seedCount, ablationSeedCount, metrics, gates, passed: Object.values(gates).every(Boolean) };
}

const seedCount = Number(process.argv.find(arg => arg.startsWith("--seeds="))?.split("=")[1] || 200);
const ablationSeedCount = Number(process.argv.find(arg => arg.startsWith("--ablation-seeds="))?.split("=")[1] || 40);
const selected = process.argv.find(arg => arg.startsWith("--variants="))?.split("=")[1].split(",");
const variants = selected ? VARIANTS.filter(variant => selected.includes(variant.id)) : VARIANTS;
const results = variants.map(variant => evaluateVariant(variant, seedCount, ablationSeedCount));

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  purpose: "平均比較ではなく、各ランで人間の判断が働く土壌を足切りする",
  definitions: {
    oracleWinRate: "全32報酬経路・各戦闘の全配置を調べ、1本でも勝ち筋があるシードの割合",
    branchShareP10: "シードごとの勝利報酬経路割合の下位10パーセンタイル",
    boundedVisibleWinRate: "現在の敵だけを評価し、各戦闘3回まで隣接交換・入替で局所改善する仮想プレイヤーの勝率",
    naiveVisibleWinRate: "初期順と追加順をほぼ維持し、表示上よい報酬だけ選ぶ仮想プレイヤーの勝率",
    hiddenTrapShare: "次戦成績がほぼ同じに見えるのに、片方だけ将来の勝ち筋を失う分岐の割合",
    deadPairShare: "どちらを取っても次戦の最善結果が改善しない報酬2択の割合",
    roleAblation: "指定した部品をラン全体から除いた時の全知勝率",
  },
  note: "閾値は最初の仮置き。人間テストとの対応を見て更新する。単一スコアには合成しない。",
  results,
}, null, 2));
