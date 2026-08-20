import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { localSearchPolicy, naivePolicy } from "../agents/policies.mjs";
import { ARC } from "../core/arc.mjs";
import { BUS } from "../core/bus.mjs";
import { PHASE } from "../core/phase.mjs";

// 別ルールセットを同じ物差しで並べる。見たいのは勝率ではなく、
// 「支配部品が固定されるか」「決着後の死に時間」「苦戦を予期する頻度」。

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));
const seeds = Number(args.seeds || 120);

function play(seed, ruleset, makePolicy) {
  const policy = makePolicy({ ruleset });
  const run = createRun({ seed, playerId: "compare", ruleset });
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") { run.act(policy.reward(observation)); continue; }
    policy.build(observation).forEach(action => run.act(action));
    run.act(policy.battle(run.observe()));
  }
  const trace = run.trace();
  const metrics = describeRun(trace);
  const builds = trace.events.filter(e => e.type === "battle_predicted").map(e => e.build.filter(Boolean));
  const finalBuild = builds[builds.length - 1] || [];
  return { metrics, finalBuild, won: trace.won };
}

function evaluate(ruleset) {
  const runs = [];
  for (let seed = 1; seed <= seeds; seed += 1) runs.push(play(seed, ruleset, localSearchPolicy));
  const naive = [];
  for (let seed = 1; seed <= seeds; seed += 1) naive.push(play(seed, ruleset, naivePolicy));

  const topCounts = new Map();
  runs.forEach(r => {
    const top = r.metrics.gateRanking[0]?.name;
    if (top) topCounts.set(top, (topCounts.get(top) || 0) + 1);
  });
  const ranked = [...topCounts.entries()].sort((a, b) => b[1] - a[1]);

  const adoption = new Map();
  runs.forEach(r => new Set(r.finalBuild).forEach(name => adoption.set(name, (adoption.get(name) || 0) + 1)));
  const parts = Object.values(ruleset.PARTS).map(p => p.name);
  const rates = parts.map(name => (adoption.get(name) || 0) / runs.length);
  const dead = parts.filter((name, i) => rates[i] < 0.05);

  const mean = key => runs.reduce((sum, r) => sum + (r.metrics[key] || 0), 0) / runs.length;
  const builds = runs.map(r => [...r.finalBuild].sort().join("|"));
  const buildCounts = builds.reduce((map, b) => map.set(b, (map.get(b) || 0) + 1), new Map());

  // 認知コスト。学習ログ#11に対応する項が無かったため追加する。
  // 計算できるもの（規則行数・敵修飾子の種類・説明文量）と、設計者が宣言するもの（保持概念）を並べる。
  const ruleLines = (ruleset.rules.match(/^- /gm) || []).length;
  const basicKeys = new Set(["name", "face", "hp", "atk", "trait", "goal", "window"]);
  const enemyMods = new Set();
  ruleset.ENEMIES.forEach(e => Object.keys(e).forEach(k => { if (!basicKeys.has(k)) enemyMods.add(k); }));
  const descChars = Math.round(Object.values(ruleset.PARTS)
    .reduce((sum, p) => sum + p.desc.length, 0) / Object.keys(ruleset.PARTS).length);

  return {
    ルール: ruleset.title,
    保持概念数: (ruleset.conceptsToHold || []).length,
    規則行数: ruleLines,
    敵修飾子の種類: enemyMods.size,
    部品説明の平均字数: descChars,
    配置が決めるもの: ruleset.placementRule || "—",
    勝率: Number((runs.filter(r => r.won).length / runs.length).toFixed(3)),
    素朴方針の勝率: Number((naive.filter(r => r.won).length / naive.length).toFixed(3)),
    "首位部品の最頻シェア": Number((ranked[0] ? ranked[0][1] / runs.length : 0).toFixed(3)),
    首位部品の種類: ranked.length,
    最終構成の種類: Number((buildCounts.size / runs.length).toFixed(3)),
    最多構成への集中: Number((Math.max(...buildCounts.values()) / runs.length).toFixed(3)),
    "採用率5%未満の部品": dead.length,
    死に時間: Number(mean("deadTime").toFixed(3)),
    無傷勝利率: Number(mean("flawlessBattleRate").toFixed(3)),
    惰性戦闘率: Number(mean("idleBattleRate").toFixed(3)),
    苦戦予期率: Number(mean("tenseBattleRate").toFixed(3)),
    問題の連鎖: Number(mean("problemChainRate").toFixed(3)),
    _ranked: ranked.slice(0, 4),
    _adoption: parts.map((name, i) => [name, Number(rates[i].toFixed(2))]).sort((a, b) => b[1] - a[1])
  };
}

const rows = [ARC, BUS, PHASE].map(evaluate);
const complexityKeys = ["ルール", "保持概念数", "規則行数", "敵修飾子の種類", "部品説明の平均字数", "配置が決めるもの"];
console.log("■ 認知コスト（低いほど軽い。指標が良くなっても、ここが重くなれば差引で悪化しうる）");
console.table(rows.map(r => Object.fromEntries(complexityKeys.map(k => [k, r[k]]))));
console.log("■ 構造");
console.table(rows.map(({ _ranked, _adoption, ...rest }) => {
  const out = { ...rest };
  complexityKeys.filter(k => k !== "ルール").forEach(k => delete out[k]);
  return out;
}));
rows.forEach(row => {
  console.log(`\n【${row.ルール}】首位部品: ${row._ranked.map(([n, c]) => `${n} ${c}`).join(" / ")}`);
  console.log(`  最終構成への採用率: ${row._adoption.map(([n, r]) => `${n} ${r}`).join(" / ")}`);
});
