import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRun } from "../core/run.mjs";
import { describeRun, summarize } from "../core/metrics.mjs";
import { POLICIES } from "../agents/policies.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));

const dir = args.dir;
if (!dir || !existsSync(dir)) {
  console.error("使い方: node analysis/agent-panel.mjs --dir=<セッション置き場> [--baselineSeeds=200]");
  process.exit(2);
}

const sessions = readdirSync(dir).filter(name => name.endsWith(".json"))
  .map(name => ({ name, data: JSON.parse(readFileSync(join(dir, name), "utf8")) }))
  .filter(item => item.data.trace);

if (!sessions.length) {
  console.error(`${dir} に完了したセッションがありません`);
  process.exit(2);
}

const agentRuns = sessions.map(item => ({
  ...describeRun(item.data.trace),
  survey: item.data.survey || {},
  file: item.name
}));

function playPolicy(seed, policyName) {
  const policy = POLICIES[policyName]();
  const run = createRun({ seed, playerId: `policy:${policyName}` });
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

const agentSeeds = agentRuns.map(r => r.seed);
const matched = {
  naive: agentSeeds.map(seed => playPolicy(seed, "naive")),
  local: agentSeeds.map(seed => playPolicy(seed, "local"))
};

const baselineSeeds = Number(args.baselineSeeds || 200);
const wide = { naive: [], local: [] };
for (let seed = 1; seed <= baselineSeeds; seed += 1) {
  wide.naive.push(playPolicy(seed, "naive"));
  wide.local.push(playPolicy(seed, "local"));
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? Number((num / Math.sqrt(dx * dy)).toFixed(3)) : null;
}

const EPISTEMIC = ["problemChainRate", "reinterpretationRate", "pivotRate", "tenseBattleRate", "deadTime"];

function winCorrelations(runs) {
  const wins = runs.map(r => (r.won ? 1 : 0));
  return Object.fromEntries(EPISTEMIC.map(key => [key, pearson(wins, runs.map(r => r[key] || 0))]));
}

function flagRate(runs, code) {
  return Number((runs.filter(r => r.warnings.some(w => w.code === code)).length / runs.length).toFixed(3));
}

const report = {
  agents: agentRuns.map(r => ({
    file: r.file, seed: r.seed, player: r.playerId, won: r.won, reached: r.reached, finalHp: r.finalHp,
    replay: r.survey.replay ?? null, pivotAnswer: r.survey.pivot ?? null,
    bestMoment: r.survey.bestMoment ?? null,
    deadTime: r.deadTime, pivotRate: r.pivotRate, reinterpretationRate: r.reinterpretationRate,
    problemChainRate: r.problemChainRate, worryConcentration: r.worryConcentration,
    gateConcentration: r.gateConcentration, topGate: r.gateRanking[0]?.name ?? null,
    tenseBattleRate: r.tenseBattleRate, surprise: r.surprise,
    markers: r.markerCounts, updates: r.updateCounts,
    warnings: r.warnings.map(w => w.code)
  })),
  summaries: {
    agent: summarize(agentRuns),
    naiveMatched: summarize(matched.naive),
    localMatched: summarize(matched.local),
    naiveWide: summarize(wide.naive),
    localWide: summarize(wide.local)
  },
  preRegistered: {
    P1_win_does_not_predict_interest: {
      criterion: "勝敗と認識指標の相関が、勝ちを一律に良しとしない（|r| が小さい、または向きが逆）",
      agentPanelN: agentRuns.length,
      correlationsAgent: winCorrelations(agentRuns),
      correlationsLocalWide: winCorrelations(wide.local),
      note: "エージェント標本は小さい。判定は local の広い標本を主、エージェントを従とする。"
    },
    P2_dead_time_detected: {
      criterion: "無傷で圧勝予測が続いて終わるランに dead_time 警告が立つ",
      agentFlagRate: flagRate(agentRuns, "dead_time"),
      localWideFlagRate: flagRate(wide.local, "dead_time"),
      flawlessAgentRuns: agentRuns.filter(r => r.won && r.finalHp >= 24).map(r => ({
        seed: r.seed, finalHp: r.finalHp, deadTime: r.deadTime,
        flagged: r.warnings.some(w => w.code === "dead_time")
      }))
    },
    P3_single_gate_detected: {
      criterion: "single_gate または single_worry が過半のランで立ち、出力集中の首位が防御系に偏る",
      agentEitherFlagRate: Number((agentRuns.filter(r => r.warnings.some(w => ["single_gate", "single_worry"].includes(w.code))).length / agentRuns.length).toFixed(3)),
      localWideEitherFlagRate: Number((wide.local.filter(r => r.warnings.some(w => ["single_gate", "single_worry"].includes(w.code))).length / wide.local.length).toFixed(3)),
      topGateCountsAgent: countBy(agentRuns.map(r => r.gateRanking[0]?.name)),
      topGateCountsLocalWide: countBy(wide.local.map(r => r.gateRanking[0]?.name)),
      topWorryAgent: countBy(agentRuns.flatMap(r => Object.entries(r.worryCounts).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([k]) => k)))
    },
    P4_agent_above_naive: {
      criterion: "エージェントの problemChainRate と reinterpretationRate が naive を明確に上回る",
      agent: pickMeans(summarize(agentRuns)),
      naiveMatched: pickMeans(summarize(matched.naive)),
      localMatched: pickMeans(summarize(matched.local))
    }
  }
};

function countBy(values) {
  return Object.fromEntries(values.filter(Boolean).reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map()));
}

function pickMeans(summary) {
  return summary && {
    problemChainRate: summary.meanProblemChainRate,
    reinterpretationRate: summary.meanReinterpretationRate,
    pivotRate: summary.meanPivotRate,
    tenseBattleRate: summary.meanTenseBattleRate,
    winRate: summary.winRate
  };
}

console.log(JSON.stringify(report, null, 2));
