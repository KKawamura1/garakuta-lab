import { readFileSync } from "node:fs";
import { createRun } from "../core/run.mjs";
import { localSearchPolicy } from "../agents/policies.mjs";

// 報酬の選び方だけを全通り試し、局所探索プレイヤーに戦わせる。
// 「そのシードに勝ち筋があったか」「どの報酬時点で消えたか」を出す。
// 局所探索は各戦闘の全配置を試すので人間より強い。ここで勝てないなら、
// 人間が勝てた可能性はさらに低い。逆は言えない（貪欲なので取りこぼす）。

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));

const DECISIONS = [0, 1, 2, 3]; // 0 = 全部見送る

function play(seed, decisions) {
  const run = createRun({ seed, playerId: "winnable-probe" });
  const policy = localSearchPolicy();
  const offersSeen = [];
  let rewardIndex = 0;
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") {
      offersSeen.push(observation.offer.map(item => item.part.name));
      if (rewardIndex >= decisions.length) {
        return { pending: true, rewardIndex, offers: observation.offer.map(item => item.part.name) };
      }
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
  const trace = run.trace();
  return { pending: false, won: trace.won, reached: trace.reached, finalHp: trace.finalHp, offersSeen };
}

function explore(seed, prefix) {
  const results = [];
  const stack = [prefix];
  while (stack.length) {
    const decisions = stack.pop();
    const result = play(seed, decisions);
    if (result.pending) {
      DECISIONS.forEach(decision => stack.push([...decisions, decision]));
      continue;
    }
    results.push({ decisions, ...result });
  }
  return results;
}

const seed = Number(args.seed);
if (!Number.isFinite(seed)) { console.error("--seed=<n> が必要です"); process.exit(2); }
const actual = args.actual ? JSON.parse(args.actual) : null;

const all = explore(seed, []);
const wins = all.filter(r => r.won);
console.log(`seed ${seed}: 報酬経路 ${all.length}通り中 ${wins.length}通りが勝利（${(wins.length / all.length * 100).toFixed(1)}%）`);
if (wins.length) {
  const best = wins.sort((a, b) => b.finalHp - a.finalHp)[0];
  console.log(`  最良: 決定列 ${JSON.stringify(best.decisions)} → 残HP ${best.finalHp}`);
}
const reachedCounts = all.reduce((map, r) => map.set(r.reached, (map.get(r.reached) || 0) + 1), new Map());
console.log(`  到達戦の分布: ${[...reachedCounts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `第${k}戦 ${v}`).join(" / ")}`);

if (actual) {
  console.log(`\n実際の選択 ${JSON.stringify(actual)} に沿って、各時点で勝ち筋が残っていたか`);
  for (let k = 0; k <= actual.length; k += 1) {
    const prefix = actual.slice(0, k);
    const branch = explore(seed, prefix);
    const branchWins = branch.filter(r => r.won).length;
    const label = k === 0 ? "ラン開始時" : `第${k}報酬を選んだ直後`;
    console.log(`  ${label.padEnd(18)} 継続 ${String(branch.length).padStart(4)}通り中 勝利 ${String(branchWins).padStart(4)}通り` + (branchWins ? "" : "   ← ここで勝ち筋が消えている"));
  }
}
