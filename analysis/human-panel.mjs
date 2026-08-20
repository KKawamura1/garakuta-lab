import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describeRun } from "../core/metrics.mjs";

// 人間のランを横に並べる。1ラン内の指標（describeRun）だけでは「飽き」は見えない。
// ラン“をまたいだ”反復——同じ構成に収束する、同じ部品が山場になる、同じ位置で圧力が消える——
// を測るための面。ラン内指標が全部良くなっても飽きは進むことがある、という観測から作った。

const dir = process.argv.slice(2).find(a => !a.startsWith("--")) || "analysis/human-runs";
const filter = (process.argv.find(a => a.startsWith("--ruleset=")) || "").slice(10);

const runs = readdirSync(dir).filter(n => n.startsWith("human-") && n.endsWith(".json")).map(name => {
  const data = JSON.parse(readFileSync(join(dir, name), "utf8"));
  return { name, data, trace: data.trace };
}).filter(r => r.trace && (!filter || (r.data.ruleset || r.trace.ruleset || "").includes(filter)))
  .map(r => ({ ...r, metrics: describeRun(r.trace) }))
  .sort((a, b) => String(a.name).localeCompare(String(b.name)));

const pct = v => (v === null || v === undefined ? "  - " : `${(v * 100).toFixed(0)}%`.padStart(4));
const num = (v, w = 4) => String(v ?? "-").padStart(w);

console.log(`# ${runs.length} ラン (${dir}${filter ? ` / ${filter}` : ""})\n`);

console.log("## ラン内の指標");
console.log("seed    | 結果 | replay | 無傷率 | 停滞率 | 位相移動 | 問題交替 | 反転率 | 驚き(良/想定/悪)");
runs.forEach(({ data, metrics: m }) => {
  const s = m.surprise;
  console.log([
    String(data.seed).padStart(6),
    (m.won ? "勝ち" : "負け"),
    num(data.survey?.replay, 4),
    pct(m.flawlessBattleRate),
    pct(m.idleBattleRate),
    num(m.phaseMoves, 6),
    pct(m.problemChainRate),
    pct(m.pivotRate),
    `${s.better}/${s.expected}/${s.worse}`
  ].join(" | "));
});

console.log("\n## 圧力の形（各戦闘で失ったHP / 30）");
runs.forEach(({ data, trace }) => {
  const curve = trace.battles.map(b => String(b.hpLost).padStart(2)).join(" ");
  const zero = trace.battles.filter(b => b.hpLost === 0).length;
  console.log(`${String(data.seed).padStart(6)} | ${curve} | 無傷 ${zero}/${trace.battles.length}`);
});

console.log("\n## ランをまたいだ反復");
const finals = runs.map(({ data, trace }) => {
  const last = [...trace.events].reverse().find(e => e.type === "battle_predicted");
  return { seed: data.seed, build: last ? [...last.build] : [] };
});
finals.forEach(f => console.log(`${String(f.seed).padStart(6)} | 最終構成 ${f.build.join(" ")}`));

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter(x => B.has(x)).length;
  return inter / (new Set([...a, ...b]).size);
}
if (finals.length > 1) {
  const pairs = [];
  for (let i = 0; i < finals.length; i += 1) {
    for (let j = i + 1; j < finals.length; j += 1) pairs.push(jaccard(finals[i].build, finals[j].build));
  }
  const mean = pairs.reduce((a, b) => a + b, 0) / pairs.length;
  console.log(`\n最終構成の重なり（Jaccard 平均）: ${mean.toFixed(3)}  ${pairs.map(p => p.toFixed(2)).join(" ")}`);
}

const takes = new Map();
runs.forEach(({ trace }) => {
  trace.events.filter(e => e.type === "reward_chosen").forEach(e => {
    takes.set(e.chosen, (takes.get(e.chosen) || 0) + 1);
    (e.passed || []).forEach(p => takes.set(p, takes.get(p) || 0));
  });
});
const offers = new Map();
runs.forEach(({ trace }) => {
  trace.events.filter(e => e.type === "reward_offered").forEach(e => {
    e.offered.forEach(o => offers.set(o, (offers.get(o) || 0) + 1));
  });
});
console.log("\n提示されたときに取られた率（全ラン合算）");
[...offers.keys()].map(name => ({ name, offered: offers.get(name), taken: takes.get(name) || 0 }))
  .sort((a, b) => (b.taken / b.offered) - (a.taken / a.offered) || b.offered - a.offered)
  .forEach(r => console.log(`  ${r.name.padEnd(6)} ${String(r.taken).padStart(2)}/${String(r.offered).padStart(2)}  ${pct(r.taken / r.offered)}`));

console.log("\n## 山場として名指しされたもの（自由記述）");
runs.forEach(({ data }) => {
  const s = data.survey || {};
  console.log(`${String(data.seed).padStart(6)} | 決着 ${s.settledAt || "-"} | 山場 ${s.bestMoment || "-"} | 摩擦 ${s.friction || "-"} | 物語 ${s.runStory || "-"}`);
});
