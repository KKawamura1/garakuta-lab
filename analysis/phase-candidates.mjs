import { createRun } from "../core/run.mjs";
import { localSearchPolicy } from "../agents/policies.mjs";
import { PHASE } from "../core/phase.mjs";

// 人間テストへ出す盤面を選ぶ。勝ち筋はあるが自明でなく、
// 位相合わせの判断が実際に発生する（周期2以上の防御部品が手に入る）盤面を探す。

const args = Object.fromEntries(process.argv.slice(2).map(i => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(i); return m ? [m[1], m[2] === undefined ? true : m[2]] : [i, true];
}));
const seeds = Number(args.seeds || 40);
const PHASED_DEFENCE = ["厚板", "障壁", "蓄電盤"];

function walk(seed, decisions) {
  const run = createRun({ seed, playerId: "cand", ruleset: PHASE });
  const policy = localSearchPolicy({ ruleset: PHASE });
  const offered = new Set(run.observe().inventory.map(p => p.name));
  let ri = 0, g = 0;
  while (!run.done && g < 400) {
    g += 1;
    const o = run.observe();
    if (o.phase === "reward") {
      o.offer.forEach(x => offered.add(x.part.name));
      if (ri >= decisions.length) return { pending: true, offered };
      const d = decisions[ri]; ri += 1;
      run.act(d === 0 ? { type: "skipAll", reason: "c" } : { type: "take", choice: d, reason: "c", update: "none", updateText: "" });
      continue;
    }
    policy.build(o).forEach(a => run.act(a));
    run.act(policy.battle(run.observe()));
  }
  return { pending: false, won: run.trace().won, offered };
}

const rows = [];
for (let seed = 1; seed <= seeds; seed += 1) {
  let total = 0, wins = 0;
  const offered = new Set();
  const stack = [[]];
  while (stack.length) {
    const d = stack.pop();
    const r = walk(seed, d);
    r.offered.forEach(n => offered.add(n));
    if (r.pending) { [0, 1, 2, 3].forEach(x => stack.push([...d, x])); continue; }
    total += 1; if (r.won) wins += 1;
  }
  rows.push({ seed, rate: wins / total, defence: PHASED_DEFENCE.filter(n => offered.has(n)) });
}

const good = rows.filter(r => r.rate >= 0.08 && r.rate <= 0.45 && r.defence.length >= 1)
  .sort((a, b) => Math.abs(a.rate - 0.22) - Math.abs(b.rate - 0.22));
console.log(`PHASE 0.1 / seed 1..${seeds}`);
console.log(`  勝利経路割合 中央値 ${(rows.map(r => r.rate).sort((a, b) => a - b)[Math.floor(rows.length / 2)] * 100).toFixed(1)}%`);
console.log(`  人間テスト候補（勝利経路8〜45% かつ 位相合わせの要る防御部品が入手可能）: ${good.length}件`);
good.slice(0, 8).forEach(r => console.log(`    seed ${String(r.seed).padStart(3)}  勝利経路 ${(r.rate * 100).toFixed(1)}%  提示される防御: ${r.defence.join("・")}`));
