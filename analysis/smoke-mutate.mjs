import { strict as assert } from "node:assert";
import { createRun } from "../core/run.mjs";
import { MUTATE, MUTATION_CHIPS } from "../core/mutate.mjs";
import { makeRng } from "../core/rng.mjs";

function model(part) {
  return part ? { id: part.id, type: part.type, ...(part.chip ? { chip: { type: part.chip.type } } : {}) } : null;
}

function sameSimulation() {
  const slots = [
    { id: "p1", type: "rivet", chip: { id: "chip-1", type: "overclock" } },
    { id: "p2", type: "twin" },
    { id: "p3", type: "rivet", chip: { id: "chip-2", type: "pressure" } },
    { id: "p4", type: "twin", chip: { id: "chip-3", type: "follow" } },
  ];
  const enemy = MUTATE.ENEMIES[0];
  const a = MUTATE.simulateBattle({ slots, hp: 30, maxHp: 30, enemy, rng: makeRng(1) });
  const b = MUTATE.simulateBattle({ slots, hp: 30, maxHp: 30, enemy, rng: makeRng(1) });
  assert.deepEqual(a, b, "同じseed・同じチップ配置は同じ結果");
  assert.ok(a.log.some(entry => entry.chip === "overclock" && entry.period < entry.basePeriod), "過速歯車で周期が短くなる");
  assert.ok(a.log.some(entry => entry.chip === "pressure" && entry.period > entry.basePeriod), "蓄圧筒で周期が長くなる");
  assert.ok(a.log.every(entry => !entry.followed || entry.chip === "follow"), "追従フラグは追従軸だけに付く");
  const followCycles = new Map();
  a.log.filter(entry => entry.followed).forEach(entry =>
    followCycles.set(entry.cycle, (followCycles.get(entry.cycle) || 0) + 1));
  assert.ok([...followCycles.values()].every(n => n <= 1), "追従軸は1巡1回で、連鎖が無限に増えない");
}

function permutations(pool, size, prefix = [], used = new Set()) {
  if (prefix.length === size) return [prefix];
  const out = [];
  for (const part of pool) {
    if (used.has(part.id)) continue;
    const nextUsed = new Set(used);
    nextUsed.add(part.id);
    out.push(...permutations(pool, size, [...prefix, part], nextUsed));
  }
  return out;
}

function arrangeWinning(run) {
  const before = run.observe();
  const owned = [...before.slots.map(slot => slot.part), ...before.inventory].filter(Boolean);
  const size = Math.min(5, owned.length);
  const enemy = MUTATE.ENEMIES[before.battleNumber - 1];
  const chosen = permutations(owned, size).find(candidate => {
    const result = MUTATE.simulateBattle({
      slots: candidate.map(model), hp: before.hp, maxHp: before.maxHp, enemy, rng: makeRng(1)
    });
    return result.won;
  });
  assert.ok(chosen, `第${before.battleNumber}戦に勝てる並びがある`);
  before.slots.forEach((slot, i) => { if (slot.part) assert.equal(run.act({ type: "remove", slot: i + 1 }).ok, true); });
  const afterRemove = run.observe();
  chosen.forEach((part, i) => {
    const current = afterRemove.inventory.find(item => item.id === part.id);
    assert.ok(current, "選んだ部品が予備にある");
    assert.equal(run.act({ type: "place", partId: current.id, slot: i + 1 }).ok, true);
  });
}

function playThrough(seed) {
  const run = createRun({ seed, playerId: "mutate-smoke", ruleset: MUTATE });
  const actions = [];
  const apply = action => {
    const result = run.act(action);
    assert.equal(result.ok, true, result.error || action.type);
    actions.push(action);
    return result;
  };

  let moved = false;
  let guard = 0;
  while (!run.done && guard++ < 40) {
    const o = run.observe();
    if (o.phase === "chip") {
      const target = [...o.slots.map(slot => slot.part), ...o.inventory].find(part => part && !part.chip);
      assert.ok(target, "チップを付けられる部品がある");
      apply({ type: "attachChip", partId: target.id });
      if (!moved) {
        const after = run.observe();
        const source = [...after.slots.map(slot => slot.part), ...after.inventory].find(part => part?.chip);
        const destination = [...after.slots.map(slot => slot.part), ...after.inventory].find(part => part && !part.chip && part.id !== source.id);
        assert.ok(source && destination, "チップ移動の元と先がある");
        apply({ type: "moveChip", fromPartId: source.id, toPartId: destination.id });
        moved = true;
      }
      continue;
    }
    if (o.phase === "reward") { apply({ type: "skipAll", reason: "smoke" }); continue; }
    arrangeWinning(run);
    apply({ type: "battle", prediction: MUTATE.PREDICTIONS[0], worry: "なし" });
  }
  assert.ok(guard < 40, "4戦が無限ループしない");
  const trace = run.trace();
  assert.equal(trace.reached, 4, "MUTATEは4戦で終了する");
  assert.equal(trace.events.filter(event => event.type === "chip_offered").length, 2, "第1・2戦後にチップを得る");
  assert.equal(trace.events.filter(event => event.type === "chip_attached").length, 2, "2チップとも装着記録がある");
  assert.ok(trace.events.some(event => event.type === "chip_moved"), "チップ移動が記録される");
  assert.equal(trace.finalBuild.filter(part => part.chip).length, 2, "最終構成に2チップが残る");
  return { run, actions, trace };
}

sameSimulation();
const first = playThrough(314159);
const restored = createRun({ seed: 314159, playerId: "mutate-smoke", ruleset: MUTATE });
for (const action of first.actions) assert.equal(restored.act(action).ok, true, `再生できない: ${action.type}`);
assert.deepEqual(restored.observe(), first.run.observe(), "同じ操作を再生すると進行・装着先が復旧する");
assert.deepEqual(Object.keys(MUTATION_CHIPS).sort(), ["follow", "overclock", "pressure"], "チップは3種類だけ");
console.log("mutate smoke: 3チップの決定的予告・追従上限・装着/移動・4戦完走・再生復旧 OK");
