import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { POLICIES } from "../agents/policies.mjs";
import { RELAY } from "../core/relay.mjs";
import { PHASE } from "../core/phase.mjs";
import { ARC } from "../core/arc.mjs";

// 探索曲線：**どれだけ探したかで結果がどれだけ変わるか。**
//
// 画面が並びの結果を正確に出すようになった以上、`surprise` と `no_tension` は退化する
// （予測は常に当たる）。圧力の指標を「結果が読めないこと」から「正解が少ないこと」へ移すと
// P9 で登録した。その移した先がこれである。
//
// 4000通り試す代理は人間ではない。人間は画面で15〜40通りくらい試す。
// 一点で測ると「超人は無傷で勝つ」か「無策は全滅する」しか出ないので、**地平を振って曲線で見る。**
// 曲線が寝ていれば探索は報われない（探しても無駄／探さなくても勝てる）。
// 立っていれば、探した分だけ結果が変わる＝探索がゲームになっている。

const RULESETS = { relay: RELAY, phase: PHASE, arc: ARC };
const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [item, true];
}));
const rules = RULESETS[args.ruleset || "relay"];
const seeds = Number(args.seeds || 40);
const horizons = (args.tries || "1,5,15,40,120,600,4000").split(",").map(Number);

const pct = v => `${(v * 100).toFixed(0)}%`.padStart(4);

console.log(`# ${rules.id} / ${seeds}シード\n`);
console.log("試行数 | 完走率 | 到達戦 | 無傷率 | 停滞率 | 位相移動 | 収束(Jaccard)");

const finals = new Map();
horizons.forEach(tries => {
  const metrics = [];
  const builds = [];
  for (let seed = 1; seed <= seeds; seed += 1) {
    const policy = POLICIES.search({ ruleset: rules, tries });
    const run = createRun({ seed, playerId: `search:${tries}`, ruleset: rules });
    let guard = 0;
    while (!run.done && guard < 400) {
      guard += 1;
      const o = run.observe();
      if (o.phase === "reward") { run.act(policy.reward(o)); continue; }
      policy.build(o).forEach(a => run.act(a));
      const r = run.act(policy.battle(run.observe()));
      if (!r.ok) throw new Error(r.error);
    }
    const trace = run.trace();
    metrics.push(describeRun(trace));
    const last = [...trace.events].reverse().find(e => e.type === "battle_predicted");
    if (last) builds.push(last.build);
  }
  const mean = f => metrics.reduce((a, m) => a + f(m), 0) / metrics.length;
  let jac = 0;
  let n = 0;
  for (let i = 0; i < builds.length; i += 1) {
    for (let j = i + 1; j < builds.length; j += 1) {
      const A = new Set(builds[i]);
      const B = new Set(builds[j]);
      jac += [...A].filter(x => B.has(x)).length / new Set([...builds[i], ...builds[j]]).size;
      n += 1;
    }
  }
  const row = {
    tries,
    won: metrics.filter(m => m.won).length / metrics.length,
    reached: mean(m => m.reached),
    flawless: mean(m => m.flawlessBattleRate),
    idle: mean(m => m.idleBattleRate),
    moves: mean(m => m.phaseMoves),
    jaccard: n ? jac / n : 0
  };
  finals.set(tries, row);
  console.log([
    String(tries).padStart(6),
    pct(row.won),
    row.reached.toFixed(1).padStart(6),
    pct(row.flawless),
    pct(row.idle),
    row.moves.toFixed(1).padStart(8),
    row.jaccard.toFixed(3).padStart(13)
  ].join(" | "));
});

const first = finals.get(horizons[0]);
const last = finals.get(horizons[horizons.length - 1]);
const lift = last.won - first.won;
console.log(`\n探索の効き（完走率）: ${pct(first.won)} → ${pct(last.won)}  差 ${pct(lift)}`);
const human = finals.get(horizons.find(h => h >= 15)) || last;
console.log(`人間に近い地平（${human.tries}通り）: 完走 ${pct(human.won)} / 無傷率 ${pct(human.flawless)} / 到達 ${human.reached.toFixed(1)}戦`);
console.log(lift >= 0.4
  ? "→ 探索が結果を大きく変える。探すことがゲームになっている。"
  : "→ 曲線が寝ている。探しても変わらない（または探さなくても勝てる）。");
