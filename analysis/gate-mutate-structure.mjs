import { strict as assert } from "node:assert";
import { createRun } from "../core/run.mjs";
import { MUTATE, MUTATION_CHIPS } from "../core/mutate.mjs";
import { makeRng } from "../core/rng.mjs";

// EXP-01の構造ゲート。閾値は持たず、標本と全列挙の測定値だけを出す。
// 「取得前後」は、チップそのものの効果を敵変更から切り分けるため、同じ敵1を使う。
// 「後続報酬」は、第1戦後の通常部品報酬を追加したときの敵2で測る。

const SAMPLE_SEEDS = Number(process.env.MUTATE_GATE_SEEDS || 32);
const SLOT_COUNT = MUTATE.SLOT_COUNT;
const CHIP_TYPES = Object.keys(MUTATION_CHIPS);

function partModel(part) {
  return part ? {
    id: part.id,
    type: part.type,
    ...(part.chip ? { chip: { id: part.chip.id || `gate-${part.id}`, type: part.chip.type } } : {})
  } : null;
}

function permutations(pool, size = SLOT_COUNT, prefix = [], used = new Set()) {
  if (prefix.length === size) return [prefix];
  const out = [];
  for (const part of pool) {
    if (used.has(part.id)) continue;
    const next = new Set(used);
    next.add(part.id);
    out.push(...permutations(pool, size, [...prefix, part], next));
  }
  return out;
}

function score(result) {
  // 勝敗を最優先、次に敵残HP、残HP、短さ。勝ちの中では残HPを最大化する。
  return [result.won ? 1 : 0, -result.enemyHp, result.hp, -result.cycles];
}

function compareScore(a, b) {
  const left = score(a);
  const right = score(b);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function emptyBest() {
  return { result: null, pairs: [] };
}

function addBest(best, result, pair) {
  if (!best.result) {
    best.result = result;
    best.pairs = [pair];
    return;
  }
  const relation = compareScore(result, best.result);
  if (relation > 0) {
    best.result = result;
    best.pairs = [pair];
  } else if (relation === 0) {
    best.pairs.push(pair);
  }
}

function analyzeNoChip(parts, enemy) {
  const placements = permutations(parts);
  const best = emptyBest();
  let wins = 0;
  for (const placement of placements) {
    const result = MUTATE.simulateBattle({
      slots: placement.map(partModel), hp: MUTATE.MAX_HP, maxHp: MUTATE.MAX_HP,
      enemy, rng: makeRng(1)
    });
    if (result.won) wins += 1;
    addBest(best, result, { placement: placement.map(p => p.id), target: null });
  }
  return {
    placements: placements.length,
    wins,
    zero: wins === 0,
    placementWinRate: wins / placements.length,
    allWin: wins === placements.length,
    best
  };
}

function analyzeChip(parts, enemy, chipType) {
  const placements = permutations(parts);
  const best = emptyBest();
  const targets = new Map(parts.map(part => [part.id, part]));
  const targetBest = new Map(parts.map(part => [part.id, emptyBest()]));
  let assignments = 0;
  let wins = 0;

  for (const target of parts) {
    for (const placement of placements) {
      const slots = placement.map(part => ({
        ...partModel(part),
        ...(part.id === target.id ? { chip: { id: `gate-${chipType}`, type: chipType } } : {})
      }));
      const result = MUTATE.simulateBattle({
        slots, hp: MUTATE.MAX_HP, maxHp: MUTATE.MAX_HP, enemy, rng: makeRng(1)
      });
      assignments += 1;
      if (result.won) wins += 1;
      const pair = { placement: placement.map(p => p.id), target: target.id };
      addBest(best, result, pair);
      addBest(targetBest.get(target.id), result, pair);
    }
  }

  // targetBestのキーを保持し、出力ではタイプに集約する。
  return {
    chipType,
    placements: placements.length,
    targets,
    assignments,
    wins,
    zero: wins === 0,
    assignmentWinRate: wins / assignments,
    best,
    targetBest
  };
}

function hamming(a, b) {
  return a.reduce((count, value, i) => count + (value === b[i] ? 0 : 1), 0);
}

function minPlacementDistance(before, after) {
  let distance = Infinity;
  for (const left of before.best.pairs) {
    for (const right of after.best.pairs) {
      distance = Math.min(distance, hamming(left.placement, right.placement));
    }
  }
  return distance;
}

function targetIds(best) {
  return new Set(best.pairs.map(pair => pair.target));
}

function rankMap(best, parts) {
  const counts = new Map(parts.map(part => [part.type, 0]));
  for (const pair of best.pairs) {
    const present = new Set(pair.placement);
    for (const part of parts) if (present.has(part.id)) counts.set(part.type, counts.get(part.type) + 1);
  }
  const ranked = [...counts.entries()]
    .map(([type, count]) => ({ type, rate: count / best.pairs.length, count }))
    .sort((a, b) => b.rate - a.rate || a.type.localeCompare(b.type));
  const result = new Map();
  ranked.forEach((item, i) => result.set(item.type, { rank: i + 1, ...item }));
  return result;
}

function distributionByType(ids, parts) {
  const byId = new Map(parts.map(part => [part.id, part.type]));
  const out = {};
  for (const id of ids) {
    const type = byId.get(id) || "追加部品";
    out[type] = (out[type] || 0) + 1;
  }
  return out;
}

function aggregateRankChanges(rows) {
  const byType = new Map();
  for (const row of rows) {
    for (const [type, before] of row.before.entries()) {
      const after = row.after.get(type);
      if (!byType.has(type)) byType.set(type, { before: 0, after: 0, delta: 0, n: 0 });
      const item = byType.get(type);
      item.before += before.rank;
      item.after += after.rank;
      item.delta += after.rank - before.rank;
      item.n += 1;
    }
  }
  return [...byType.entries()]
    .map(([type, item]) => ({
      type,
      meanBeforeRank: item.before / item.n,
      meanAfterRank: item.after / item.n,
      meanDeltaRank: item.delta / item.n
    }))
    .sort((a, b) => a.meanDeltaRank - b.meanDeltaRank || a.type.localeCompare(b.type));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function reachPostReward(seed) {
  const run = createRun({ seed, playerId: "mutate-structure-gate", ruleset: MUTATE });
  const start = run.observe();
  const parts = [...start.inventory];
  const pre = analyzeNoChip(parts, MUTATE.ENEMIES[0]);
  if (!pre.best.pairs.length || !pre.best.result.won) return { start, parts, pre, reachable: false };

  const chosen = pre.best.pairs[0].placement;
  for (let i = 0; i < chosen.length; i += 1) {
    const part = parts.find(item => item.id === chosen[i]);
    const placed = run.act({ type: "place", partId: part.id, slot: i + 1 });
    assert.equal(placed.ok, true);
  }
  const battle = run.act({ type: "battle", prediction: MUTATE.PREDICTIONS[0], worry: "なし" });
  assert.equal(battle.ok, true);
  const chipState = run.observe();
  if (chipState.phase !== "chip") return { start, parts, pre, reachable: false };
  const attachTarget = chipState.inventory[0] || chipState.slots.find(slot => slot.part)?.part;
  assert.ok(attachTarget);
  const attached = run.act({ type: "attachChip", partId: attachTarget.id });
  assert.equal(attached.ok, true);
  const rewardState = run.observe();
  assert.equal(rewardState.phase, "reward");
  return { start, parts, pre, reachable: true, chipType: chipState.chipOffer.type, offers: rewardState.offer.map(item => item.part) };
}

const distanceRows = [];
const rankRows = [];
const targetRows = [];
const laterRewardRows = [];
const preRows = [];
const postRows = [];
let unreachable = 0;

for (let seed = 1; seed <= SAMPLE_SEEDS; seed += 1) {
  const reached = reachPostReward(seed);
  if (!reached.reachable) unreachable += 1;
  const parts = reached.parts;
  const pre = reached.pre;
  preRows.push(pre);
  const beforeRank = rankMap(pre.best, parts);

  for (const chipType of CHIP_TYPES) {
    const post = analyzeChip(parts, MUTATE.ENEMIES[0], chipType);
    postRows.push(post);
    distanceRows.push({ seed, chipType, distance: minPlacementDistance(pre, post) });
    const afterRank = rankMap(post.best, parts);
    rankRows.push({ seed, chipType, before: beforeRank, after: afterRank });
    targetRows.push({ seed, chipType, distribution: distributionByType(targetIds(post.best), parts), uniqueTargets: targetIds(post.best).size });

    // 後続報酬の変更率は、各seedで実際に引いた第1チップについて測る。
    // 全チップ種を仮想的に当てる①〜③と分け、到達可能な分岐を保つ。
    if (reached.reachable && chipType === reached.chipType) {
      const beforeLater = analyzeChip(parts, MUTATE.ENEMIES[1], chipType);
      for (const offer of reached.offers) {
        const added = [...parts, offer];
        const afterLater = analyzeChip(added, MUTATE.ENEMIES[1], chipType);
        const beforeTargets = targetIds(beforeLater.best);
        const afterTargets = targetIds(afterLater.best);
        const intersection = [...beforeTargets].some(id => afterTargets.has(id));
        const setChanged = beforeTargets.size !== afterTargets.size || [...beforeTargets].some(id => !afterTargets.has(id));
        laterRewardRows.push({ seed, chipType, offerType: offer.type, forcedChange: !intersection, setChanged });
      }
    }
  }
}

const distances = distanceRows.map(row => row.distance);
const preWins = preRows.reduce((n, row) => n + row.wins, 0);
const prePlacements = preRows.reduce((n, row) => n + row.placements, 0);
const postWins = postRows.reduce((n, row) => n + row.wins, 0);
const postAssignments = postRows.reduce((n, row) => n + row.assignments, 0);
const postZero = postRows.filter(row => row.zero).length;
const preZero = preRows.filter(row => row.zero).length;
const rankTable = aggregateRankChanges(rankRows);
const forcedChanges = laterRewardRows.filter(row => row.forcedChange).length;
const setChanges = laterRewardRows.filter(row => row.setChanged).length;

console.log(`# EXP-01 構造ゲート測定結果\n`);
console.log(`- 標本seed: 1..${SAMPLE_SEEDS}（初期手持ちは実際のMUTATE生成、startContractを通過した到達可能状態）`);
console.log(`- 到達確認: ${SAMPLE_SEEDS - unreachable}/${SAMPLE_SEEDS} seedで第1戦勝利→チップ取得→通常報酬まで到達`);
console.log(`- 配置列挙: 1手持ちあたり ${preRows[0]?.placements || 0} 通り（8P5）、チップ装着先を含む場合 ${postRows[0]?.assignments || 0} 通り/チップ（8P5×8）`);
console.log(`- 最適化スコア: 勝敗 > 敵残HP > 自HP > 決着の短さ。最適解の同率はすべて保持。`);
console.log(`\n## ① 取得前後の最適配置距離（同じ敵1でチップ効果だけを比較）`);
console.log(`- 平均: ${(distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(3)} / 5`);
console.log(`- 中央値: ${median(distances)} / 5、P90: ${percentile(distances, 0.9)} / 5、最大: ${Math.max(...distances)} / 5`);
for (const chipType of CHIP_TYPES) {
  const values = distanceRows.filter(row => row.chipType === chipType).map(row => row.distance);
  console.log(`- ${MUTATION_CHIPS[chipType].name}: 平均 ${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3)}、中央値 ${median(values)}`);
}
console.log(`\n## ② 最適装着先の分布（同率最適解に含まれる装着先、部品種別）`);
for (const chipType of CHIP_TYPES) {
  const merged = {};
  let targetCount = 0;
  for (const row of targetRows.filter(item => item.chipType === chipType)) {
    for (const [type, count] of Object.entries(row.distribution)) { merged[type] = (merged[type] || 0) + count; targetCount += count; }
  }
  console.log(`- ${MUTATION_CHIPS[chipType].name}: ${JSON.stringify(Object.fromEntries(Object.entries(merged).sort((a, b) => b[1] - a[1])))}（seedごとの平均ユニーク最適先 ${(targetRows.filter(item => item.chipType === chipType).reduce((n, row) => n + row.uniqueTargets, 0) / SAMPLE_SEEDS).toFixed(2)}）`);
}
console.log(`\n## ③ 採用部品の順位変化（平均順位、負のΔが上昇）`);
for (const row of rankTable) console.log(`- ${row.type}: ${row.meanBeforeRank.toFixed(2)} → ${row.meanAfterRank.toFixed(2)}（Δ ${row.meanDeltaRank.toFixed(2)}）`);
console.log(`\n## ④ 後続通常報酬による最適装着先変更率（敵2、実際に取得した第1チップ×提示報酬）`);
console.log(`- 強制変更率（旧最適先が新最適集合に一つも残らない）: ${forcedChanges}/${laterRewardRows.length} = ${(100 * forcedChanges / laterRewardRows.length).toFixed(1)}%`);
console.log(`- 最適集合変更率（集合が完全一致しない）: ${setChanges}/${laterRewardRows.length} = ${(100 * setChanges / laterRewardRows.length).toFixed(1)}%`);
console.log(`\n## ⑤ 勝てる構成ゼロ率`);
console.log(`- チップ取得前（配置のみ）: ${preZero}/${preRows.length} = ${(100 * preZero / preRows.length).toFixed(1)}%`);
console.log(`- チップ取得後（配置×装着先）: ${postZero}/${postRows.length} = ${(100 * postZero / postRows.length).toFixed(1)}%`);
console.log(`\n## ⑥ 全配置勝利率`);
console.log(`- 取得前の配置単位: ${preWins}/${prePlacements} = ${(100 * preWins / prePlacements).toFixed(2)}%`);
console.log(`- 取得前に「全配置が勝利」の手持ち: ${preRows.filter(row => row.allWin).length}/${preRows.length} = ${(100 * preRows.filter(row => row.allWin).length / preRows.length).toFixed(1)}%`);
console.log(`- 取得後の配置×装着先単位: ${postWins}/${postAssignments} = ${(100 * postWins / postAssignments).toFixed(2)}%`);
console.log(`\n## 解釈用の注記`);
console.log(`- 最適解の同率を残したため、装着先分布と順位は「唯一の正解」ではなく、同じ最適スコアを持つ選択肢の広がりを表す。`);
console.log(`- 勝てる構成ゼロ率と全配置勝利率は、配置だけと配置×装着先を分けて出力し、チップ導入で詰みや自動勝利が隠れないようにした。`);
console.log(`- このスクリプトは閾値判定、敵HP調整、チップ内容調整を行わない。`);
