import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { POLICIES } from "../agents/policies.mjs";
import { ARC } from "../core/arc.mjs";
import { PHASE } from "../core/phase.mjs";
import { BUS } from "../core/bus.mjs";

// 「飽き」を測る面。describeRun は1ラン内の構造しか見ないので、
// ラン“をまたいだ”反復——毎回同じ部品が勝ち筋になる、毎回同じ位置で圧力が消える、
// 毎回同じ機械に収束する——には原理的に盲目である。ここを別の面として測る。
//
// 注意: 採用率は方策の癖でもある。localSearch は次の一戦の模擬結果で選ぶので、
// 長期的な価値を持つ部品を過小評価しうる。人間の採用率と突き合わせて読むこと。

const RULESETS = { arc: ARC, phase: PHASE, bus: BUS };

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));

const ruleset = RULESETS[args.ruleset || "phase"];
if (!ruleset) {
  console.error(`未知のルールセット: ${args.ruleset}（${Object.keys(RULESETS).join(", ")}）`);
  process.exit(2);
}
const policyName = args.policy || "local";
const seeds = Number(args.seeds || 200);
const from = Number(args.from || 1);

const offered = new Map();
const taken = new Map();
const zeroLossByIndex = [];
const battlesByIndex = [];
const finalBuilds = [];
const warningCounts = new Map();
const runMetrics = [];

for (let i = 0; i < seeds; i += 1) {
  const seed = from + i;
  const policy = POLICIES[policyName]({ ruleset });
  const run = createRun({ seed, playerId: `policy:${policyName}`, ruleset });
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") {
      const action = policy.reward(observation);
      const names = observation.offer.map(item => item.part.type);
      names.forEach(name => offered.set(name, (offered.get(name) || 0) + 1));
      if (action.type === "take") {
        const picked = observation.offer.find(item => item.choice === action.choice);
        if (picked) taken.set(picked.part.type, (taken.get(picked.part.type) || 0) + 1);
      }
      run.act(action);
      continue;
    }
    policy.build(observation).forEach(action => run.act(action));
    run.act(policy.battle(run.observe()));
  }
  const trace = run.trace();
  const metrics = describeRun(trace);
  runMetrics.push(metrics);
  metrics.warnings.forEach(w => warningCounts.set(w.code, (warningCounts.get(w.code) || 0) + 1));
  trace.battles.forEach((battle, index) => {
    battlesByIndex[index] = (battlesByIndex[index] || 0) + 1;
    if (battle.hpBefore - battle.hpAfter <= 0) zeroLossByIndex[index] = (zeroLossByIndex[index] || 0) + 1;
  });
  const last = [...trace.events].reverse().find(e => e.type === "battle_predicted");
  if (last) finalBuilds.push(last.build);
}

function jaccardMean(builds, sample = 400) {
  if (builds.length < 2) return null;
  let total = 0;
  let count = 0;
  for (let i = 0; i < builds.length && count < sample; i += 1) {
    for (let j = i + 1; j < builds.length && count < sample; j += 1) {
      const a = new Set(builds[i]);
      const b = new Set(builds[j]);
      const inter = [...a].filter(x => b.has(x)).length;
      total += inter / new Set([...builds[i], ...builds[j]]).size;
      count += 1;
    }
  }
  return total / count;
}

const pct = v => `${(v * 100).toFixed(1)}%`;

console.log(`# ${ruleset.id || args.ruleset || "phase"} / ${policyName} / ${seeds}ラン（seed ${from}..${from + seeds - 1}）\n`);

console.log("## 提示採用率（提示されたら何割取られるか）");
console.log("100%に近い部品は「選択肢」ではなく「引けたかどうか」の関門である。");
const rows = [...offered.keys()].map(name => ({
  name,
  offered: offered.get(name),
  taken: taken.get(name) || 0,
  rate: (taken.get(name) || 0) / offered.get(name)
})).sort((a, b) => b.rate - a.rate);
rows.forEach(r => console.log(`  ${r.name.padEnd(8)} ${String(r.taken).padStart(4)}/${String(r.offered).padStart(4)}  ${pct(r.rate).padStart(6)}`));
const gate = rows[0];
console.log(`\n最高採用率: ${gate.name} ${pct(gate.rate)}  /  採用率80%超の部品数: ${rows.filter(r => r.rate >= 0.8).length}`);

console.log("\n## 圧力の位置（各戦闘を無傷で勝った率）");
battlesByIndex.forEach((total, index) => {
  const zero = zeroLossByIndex[index] || 0;
  console.log(`  ${String(index + 1).padStart(2)}戦目  ${String(zero).padStart(4)}/${String(total).padStart(4)}  ${pct(zero / total).padStart(6)}`);
});
const early = [0, 1].reduce((acc, i) => acc + ((zeroLossByIndex[i] || 0) / (battlesByIndex[i] || 1)), 0) / 2;
console.log(`\n1〜2戦目の平均無傷率: ${pct(early)}`);

console.log("\n## 最終構成の収束（Jaccard 平均。1.0 は毎回同じ機械）");
console.log(`  ${jaccardMean(finalBuilds).toFixed(3)}`);

console.log("\n## 現行の警告の発火率（この面を既存の評価器が拾えているか）");
[...warningCounts.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([code, count]) => console.log(`  ${code.padEnd(20)} ${pct(count / seeds).padStart(6)}`));
if (!warningCounts.size) console.log("  （発火なし）");

// ---- 合格判定（第5回で追加）----
// 生成側の指標（勝ち筋ゼロ率・収束・死に部品）だけで合否を出していた運用の誤りを受けて、
// 圧力の“位置”を合格条件に入れる。平均では隠れるので、戦闘別の分布で見る。

const flawlessByIndex = battlesByIndex.map((total, index) => (zeroLossByIndex[index] || 0) / total);
let longestRun = 0;
let current = 0;
flawlessByIndex.forEach(rate => {
  current = rate > 0.8 ? current + 1 : 0;
  longestRun = Math.max(longestRun, current);
});
const warnPerRun = [...warningCounts.values()].reduce((a, b) => a + b, 0) / seeds;
const tensionRate = (warningCounts.get("no_tension") || 0) / seeds;
const convergence = jaccardMean(finalBuilds);

const checks = [
  { name: "無料の中盤なし", ok: longestRun < 2, detail: `無傷率80%超の連続 ${longestRun}戦（許容 1戦まで）` },
  { name: "緊張が生まれる", ok: tensionRate < 0.7, detail: `no_tension ${pct(tensionRate)}（許容 70%未満）` },
  { name: "関門化なし", ok: rows.filter(r => r.rate >= 0.8).length === 0, detail: `採用率80%超 ${rows.filter(r => r.rate >= 0.8).length}件` },
  { name: "収束しすぎない", ok: convergence < 0.45, detail: `Jaccard ${convergence.toFixed(3)}（許容 0.45未満）` }
];

console.log("\n## 合格判定");
checks.forEach(c => console.log(`  ${c.ok ? "○" : "×"} ${c.name.padEnd(10)} ${c.detail}`));
console.log(`  警告の平均発火数 ${warnPerRun.toFixed(2)}件/ラン（参考）`);
console.log(`\n判定: ${checks.every(c => c.ok) ? "合格" : `不合格（${checks.filter(c => !c.ok).map(c => c.name).join("・")}）`}`);
if (args.strict && !checks.every(c => c.ok)) process.exit(1);
