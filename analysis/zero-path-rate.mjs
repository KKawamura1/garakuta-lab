import { createRun } from "../core/run.mjs";
import { localSearchPolicy } from "../agents/policies.mjs";

// 学習ログ#18でCYCLE 0.1を棄却した基準「勝ち筋ゼロ率」を、現行トップのARC 0.1へ当てる。
// 各シードについて報酬の選び方4^5=1024通りを全探索し、一つも勝てないシードの割合を出す。

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));
const seeds = Number(args.seeds || 20);
const from = Number(args.from || 1);

function play(seed, decisions) {
  const run = createRun({ seed, playerId: "probe" });
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
        ? { type: "skipAll", reason: "probe" }
        : { type: "take", choice: decision, reason: "probe", update: "none", updateText: "" });
      continue;
    }
    policy.build(observation).forEach(action => run.act(action));
    run.act(policy.battle(run.observe()));
  }
  return { pending: false, trace: run.trace() };
}

function winningPaths(seed) {
  let total = 0;
  let wins = 0;
  const stack = [[]];
  while (stack.length) {
    const decisions = stack.pop();
    const result = play(seed, decisions);
    if (result.pending) { [0, 1, 2, 3].forEach(d => stack.push([...decisions, d])); continue; }
    total += 1;
    if (result.trace.won) wins += 1;
  }
  return { total, wins };
}

const rows = [];
for (let i = 0; i < seeds; i += 1) {
  const seed = from + i;
  const { total, wins } = winningPaths(seed);
  rows.push({ seed, total, wins, rate: wins / total });
}

const zero = rows.filter(r => r.wins === 0);
const rates = rows.map(r => r.rate).sort((a, b) => a - b);
const pct = q => rates[Math.min(rates.length - 1, Math.floor(q * rates.length))];

console.log(`ARC 0.1 / seed ${from}..${from + seeds - 1}（各1024経路を全探索、局所探索プレイヤー）`);
console.log(`  勝ち筋ゼロのシード: ${zero.length}/${rows.length}  = ${(zero.length / rows.length * 100).toFixed(1)}%`);
console.log(`  勝利経路割合  中央値 ${(pct(0.5) * 100).toFixed(1)}%  下位10% ${(pct(0.1) * 100).toFixed(1)}%  上位10% ${(pct(0.9) * 100).toFixed(1)}%`);
console.log(`  ゼロのseed: ${zero.map(r => r.seed).join(", ") || "なし"}`);
