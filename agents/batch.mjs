import { createRun } from "../core/run.mjs";
import { describeRun, summarize } from "../core/metrics.mjs";
import { POLICIES } from "./policies.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));

const policyName = args.policy || "local";
const seeds = Number(args.seeds || 40);
const from = Number(args.from || 1);
const makePolicy = POLICIES[policyName];
if (!makePolicy) {
  console.error(`未知のポリシー: ${policyName}（${Object.keys(POLICIES).join(", ")}）`);
  process.exit(2);
}

const runs = [];
for (let i = 0; i < seeds; i += 1) {
  const seed = from + i;
  const policy = makePolicy();
  const run = createRun({ seed, playerId: `policy:${policyName}` });
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") {
      run.act(policy.reward(observation));
      continue;
    }
    policy.build(observation).forEach(action => run.act(action));
    run.act(policy.battle(run.observe()));
  }
  runs.push(describeRun(run.trace()));
}

const summary = summarize(runs);
if (args.json) {
  console.log(JSON.stringify({ policy: policyName, seeds, summary, runs }, null, 2));
} else {
  console.log(`ポリシー ${policyName} / ${seeds}ラン（seed ${from}..${from + seeds - 1}）`);
  console.log(JSON.stringify(summary, null, 2));
}
