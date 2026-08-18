import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { localSearchPolicy } from "../agents/policies.mjs";

// 生成契約を入れると平坦化するかを、入れる前に測る。
// 契約は「そのシードを採用するかどうか」のふるいなので、
// 同じシード集合を条件ごとに絞り込んで、指標の分布がどう動くかを見る。
//
//   なし        : 全シード（現行 ARC 0.1）
//   勝ち筋1本以上 : 勝てる報酬経路が1つでもあるシードだけ
//   勝利経路25%以上 : CYCLE 0.2 を平坦化させた条件を ARC へ当てたもの

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));
const seeds = Number(args.seeds || 120);
const from = Number(args.from || 1);

function playOnce(seed) {
  const run = createRun({ seed, playerId: "contract" });
  const policy = localSearchPolicy();
  const offered = new Set(run.observe().inventory.map(p => p.name));
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") {
      observation.offer.forEach(item => offered.add(item.part.name));
      run.act(policy.reward(observation));
      continue;
    }
    policy.build(observation).forEach(action => run.act(action));
    run.act(policy.battle(run.observe()));
  }
  const trace = run.trace();
  const metrics = describeRun(trace);
  const builds = trace.events.filter(e => e.type === "battle_predicted").map(e => e.build);
  return {
    ...metrics,
    flawless: trace.won && trace.battles.every(b => b.hpLost === 0),
    offered: [...offered],
    hasPlating: offered.has("即席装甲機"),
    finalBuild: [...(builds[builds.length - 1] || [])].filter(Boolean).sort().join("|")
  };
}

function pathStats(seed) {
  const runPath = decisions => {
    const run = createRun({ seed, playerId: "contract" });
    const policy = localSearchPolicy();
    let rewardIndex = 0;
    let guard = 0;
    while (!run.done && guard < 400) {
      guard += 1;
      const observation = run.observe();
      if (observation.phase === "reward") {
        if (rewardIndex >= decisions.length) return { pending: true };
        const decision = decisions[rewardIndex];
        rewardIndex += 1;
        run.act(decision === 0
          ? { type: "skipAll", reason: "c" }
          : { type: "take", choice: decision, reason: "c", update: "none", updateText: "" });
        continue;
      }
      policy.build(observation).forEach(action => run.act(action));
      run.act(policy.battle(run.observe()));
    }
    return { pending: false, won: run.trace().won };
  };
  let total = 0;
  let wins = 0;
  const stack = [[]];
  while (stack.length) {
    const decisions = stack.pop();
    const result = runPath(decisions);
    if (result.pending) { [0, 1, 2, 3].forEach(d => stack.push([...decisions, d])); continue; }
    total += 1;
    if (result.won) wins += 1;
  }
  return wins / total;
}

const rows = [];
for (let i = 0; i < seeds; i += 1) {
  const seed = from + i;
  rows.push({ seed, run: playOnce(seed), winPathRate: pathStats(seed) });
}

function summarise(label, subset, all) {
  if (!subset.length) return { 条件: label, 採用率: "0%", シード数: 0 };
  const mean = key => subset.reduce((sum, r) => sum + (Number(r.run[key]) || 0), 0) / subset.length;
  const rate = predicate => subset.filter(predicate).length / subset.length;
  const builds = subset.map(r => r.run.finalBuild);
  const counts = builds.reduce((map, b) => map.set(b, (map.get(b) || 0) + 1), new Map());
  const top = Math.max(...counts.values());
  return {
    条件: label,
    採用率: `${(subset.length / all.length * 100).toFixed(0)}%`,
    シード数: subset.length,
    勝率: Number(rate(r => r.run.won).toFixed(3)),
    無傷勝利率: Number(rate(r => r.run.flawless).toFixed(3)),
    苦戦予期率: Number(mean("tenseBattleRate").toFixed(3)),
    問題の連鎖: Number(mean("problemChainRate").toFixed(3)),
    再解釈: Number(mean("reinterpretationRate").toFixed(3)),
    方針転換: Number(mean("pivotRate").toFixed(3)),
    死に時間: Number(mean("deadTime").toFixed(3)),
    最終構成の種類: counts.size,
    最多構成への集中: Number((top / subset.length).toFixed(3))
  };
}

const conditions = [
  ["なし（現行）", () => true],
  ["勝ち筋1本以上", r => r.winPathRate > 0],
  ["勝利経路25%以上", r => r.winPathRate >= 0.25]
];

console.log(`ARC 0.1 / seed ${from}..${from + seeds - 1}（各シード1024経路を全探索）\n`);
console.table(conditions.map(([label, predicate]) => summarise(label, rows.filter(predicate), rows)));

const rates = rows.map(r => r.winPathRate).sort((a, b) => a - b);
const q = p => rates[Math.min(rates.length - 1, Math.floor(p * rates.length))];
console.log(`勝利経路割合: 中央値 ${(q(0.5) * 100).toFixed(1)}% / 下位10% ${(q(0.1) * 100).toFixed(1)}% / 上位10% ${(q(0.9) * 100).toFixed(1)}%`);
console.log(`勝ち筋ゼロ: ${rows.filter(r => r.winPathRate === 0).length}/${rows.length}`);

// 人間テストに渡す候補：勝ち筋はあるが自明ではなく、装甲部品が実際に選択肢に出る盤面。
const candidates = rows
  .filter(r => r.winPathRate >= 0.08 && r.winPathRate <= 0.45 && r.run.hasPlating)
  .sort((a, b) => Math.abs(a.winPathRate - 0.2) - Math.abs(b.winPathRate - 0.2));
console.log(`\n人間テスト候補（勝利経路8〜45% かつ 即席装甲機が提示される）: ${candidates.length}件`);
candidates.slice(0, 8).forEach(r => {
  console.log(`  seed ${String(r.seed).padStart(4)}  勝利経路 ${(r.winPathRate * 100).toFixed(1)}%  局所探索は${r.run.won ? "勝利" : "敗北"}`);
});
