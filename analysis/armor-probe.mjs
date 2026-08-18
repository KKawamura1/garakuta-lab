import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { localSearchPolicy } from "../agents/policies.mjs";
import { PARTS } from "../core/arc.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));
const seeds = Number(args.seeds || 200);

const DEFENSIVE = ["plating", "leech"];
const OFFENSIVE = ["unstable", "mine", "ram"];

const CONDITIONS = {
  "全部品": [],
  "防御禁止": DEFENSIVE,
  "装甲機のみ禁止": ["plating"],
  "大火力禁止": OFFENSIVE
};

function play(seed, ban) {
  const policy = localSearchPolicy({ ban });
  const run = createRun({ seed, playerId: `ban:${ban.join("+") || "none"}` });
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") { run.act(policy.reward(observation)); continue; }
    policy.build(observation).forEach(action => run.act(action));
    run.act(policy.battle(run.observe()));
  }
  return describeRun(run.trace());
}

const rows = [];
for (const [label, ban] of Object.entries(CONDITIONS)) {
  const runs = [];
  for (let seed = 1; seed <= seeds; seed += 1) runs.push(play(seed, ban));
  const wins = runs.filter(r => r.won).length;
  const reached = runs.reduce((sum, r) => sum + r.reached, 0) / runs.length;
  const hp = runs.filter(r => r.won).reduce((sum, r) => sum + r.finalHp, 0) / Math.max(1, wins);
  rows.push({ 条件: label, 勝率: Number((wins / seeds).toFixed(3)), 平均到達戦: Number(reached.toFixed(2)), 勝利時平均HP: Number(hp.toFixed(1)) });
}
console.table(rows);

const base = [];
for (let seed = 1; seed <= seeds; seed += 1) base.push(play(seed, []));
const shieldShare = base.map(run => {
  const total = run.gateRanking.reduce((sum, g) => sum + g.share, 0);
  return { run, defensiveTop: DEFENSIVE.includes(Object.keys(PARTS).find(k => PARTS[k].name === run.gateRanking[0]?.name)) };
});
const withDef = shieldShare.filter(x => x.defensiveTop);
const without = shieldShare.filter(x => !x.defensiveTop);
console.log(`\n無制限プレイのうち、出力首位が防御部品だったラン: ${withDef.length}/${base.length}`);
console.log(`  そのランの勝率: ${(withDef.filter(x => x.run.won).length / Math.max(1, withDef.length)).toFixed(3)}`);
console.log(`  首位が非防御のランの勝率: ${(without.filter(x => x.run.won).length / Math.max(1, without.length)).toFixed(3)}`);
