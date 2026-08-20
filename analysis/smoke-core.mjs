import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { createRun } from "../core/run.mjs";
import { PARTS, ENEMIES, simulateBattle } from "../core/arc.mjs";
import { makeRng } from "../core/rng.mjs";
import { describeRun } from "../core/metrics.mjs";
import { renderObservation } from "../core/render.mjs";
import { naivePolicy, localSearchPolicy } from "../agents/policies.mjs";

assert.equal(Object.keys(PARTS).length, 14, "ARC 0.1 は14部品");
assert.equal(ENEMIES.length, 6, "ARC 0.1 は6戦");

const rngA = makeRng(99);
const rngB = makeRng(99);
assert.deepEqual([rngA(), rngA(), rngA()], [rngB(), rngB(), rngB()], "同じseedは同じ乱数列");

function playWithPolicy(seed, policy) {
  const run = createRun({ seed, playerId: "smoke" });
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") { run.act(policy.reward(observation)); continue; }
    policy.build(observation).forEach(action => run.act(action));
    run.act(policy.battle(run.observe()));
  }
  return run.trace();
}

const first = playWithPolicy(12345, localSearchPolicy());
const second = playWithPolicy(12345, localSearchPolicy());
assert.deepEqual(first, second, "同じseed・同じ方針なら完全に同じ経過");

const other = playWithPolicy(54321, localSearchPolicy());
assert.notDeepEqual(first.events, other.events, "違うseedは違う経過");

const run = createRun({ seed: 7, playerId: "smoke" });
const start = run.observe();
assert.equal(start.inventory.length, 8, "初期部品は8個");
assert.equal(start.slots.length, 5, "駆動列は5枠");
assert.equal(start.upcomingEnemy.name, ENEMIES[0].name, "第1戦の敵が見えている");
assert.ok(!("rage" in start.upcomingEnemy), "敵の内部係数は見せない");
assert.ok(!start.futureEnemies, "将来の敵は見せない");

assert.equal(run.act({ type: "battle", prediction: "圧勝", worry: "なし" }).ok, false, "空の駆動列では戦えない");
assert.equal(run.act({ type: "place", partId: "nope", slot: 1 }).ok, false, "存在しない部品は置けない");
run.act({ type: "place", partId: start.inventory[0].id, slot: 1 });
assert.equal(run.act({ type: "battle", prediction: "たぶん勝ち", worry: "なし" }).ok, false, "予測は語彙に限定される");
assert.equal(run.act({ type: "battle", prediction: "圧勝", worry: "気合" }).ok, false, "不安の分類は語彙に限定される");

const battled = run.act({ type: "battle", prediction: "ギリギリ", worry: "火力", worryText: "一部品では足りない" });
assert.ok(battled.ok, "予測と不安を添えれば戦える");
assert.ok(battled.battle.contributions.length >= 1, "部品別の働きが返る");

const sim = simulateBattle({
  slots: [{ id: "x", type: "spark" }], hp: 30, maxHp: 30,
  enemy: { name: "t", hp: 4, atk: 0, armor: 0 }, rng: makeRng(1)
});
assert.equal(sim.won, true);
assert.equal(sim.cycles, 2, "火花ノズル2ダメージで敵HP4は2巡");

const armored = simulateBattle({
  slots: [{ id: "x", type: "spark" }], hp: 30, maxHp: 30,
  enemy: { name: "t", hp: 4, atk: 0, armor: 5 }, rng: makeRng(1)
});
assert.equal(armored.cycles, 4, "敵装甲が高くても最低1ダメージは通る");

// 位相を変える操作が数えられること。ARCでは0、枠を動かせば増える。
const phaseTrace = (() => {
  const run = createRun({ seed: 21, playerId: "smoke" });
  const inv = run.observe().inventory;
  inv.slice(0, 5).forEach((p, i) => run.act({ type: "place", partId: p.id, slot: i + 1 }));
  run.act({ type: "battle", prediction: "圧勝", worry: "なし", worryText: "" });
  if (run.observe().phase === "reward") run.act({ type: "skipAll", reason: "s" });
  run.act({ type: "swap", slotA: 1, slotB: 2 });
  run.act({ type: "battle", prediction: "圧勝", worry: "なし", worryText: "" });
  return run.trace();
})();
const phaseMetrics = describeRun(phaseTrace);
assert.equal(phaseMetrics.phaseMoves, 2, "枠を入れ替えた2部品が位相移動として数えられる");
const predicted = phaseTrace.events.filter(e => e.type === "battle_predicted");
assert.equal(predicted[1].editBreakdown.swap, 1, "付け替えは種別ごとに記録される");
assert.equal(predicted[0].editBreakdown.place, 5);

const metrics = describeRun(first);
["deadTime", "pivotRate", "reinterpretationRate", "gateConcentration", "problemChainRate", "warnings"]
  .forEach(key => assert.ok(key in metrics, `指標 ${key} が計算される`));
assert.ok(!("score" in metrics), "合成得点は作らない");

const naive = describeRun(playWithPolicy(12345, naivePolicy()));
assert.ok(naive.warnings.some(w => w.code === "no_pivot"), "素朴方針は方針転換なしとして警告される");
assert.ok(naive.warnings.some(w => w.code === "no_problem_chain"), "素朴方針は問題の連鎖なしとして警告される");
assert.ok(metrics.pivotRate >= naive.pivotRate, "局所探索は素朴方針以上に構成を動かす");

// 人間用ヘッドとエージェント用CLIが同じ文字列を見ていること
const viewRun = createRun({ seed: 4242, playerId: "smoke" });
const viewStart = viewRun.observe();
viewRun.act({ type: "place", partId: viewStart.inventory[0].id, slot: 1 });
viewRun.act({ type: "place", partId: viewStart.inventory[1].id, slot: 2 });
const shared = renderObservation(viewRun.observe());

const replayed = createRun({ seed: 4242, playerId: "smoke" });
const replayStart = replayed.observe();
replayed.act({ type: "place", partId: replayStart.inventory[0].id, slot: 1 });
replayed.act({ type: "place", partId: replayStart.inventory[1].id, slot: 2 });
assert.equal(renderObservation(replayed.observe()), shared, "同じ行動列は同じ画面になる");

const cliSource = readFileSync(new URL("../agents/session.mjs", import.meta.url), "utf8");
const playSource = readFileSync(new URL("../agents/play.mjs", import.meta.url), "utf8");
const webSource = readFileSync(new URL("../agent-view/app.js", import.meta.url), "utf8");
[["session.mjs", cliSource], ["play.mjs", playSource], ["agent-view/app.js", webSource]].forEach(([name, source]) => {
  assert.ok(/renderObservation/.test(source), `${name} は共有レンダラを使う`);
  assert.ok(!/function render\(observation/.test(source), `${name} は独自のレンダラを持たない`);
});
assert.ok(!/simulateBattle|PARTS\[/.test(webSource), "人間用ヘッドはルール実装を複製しない");

console.log("core smoke: ルール移植・決定性・観測範囲・行動検証・指標・表示共有 OK");
