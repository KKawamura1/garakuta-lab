import { createRun } from "../core/run.mjs";
import { RELAY, PARTS, ENEMIES, simulateBattle } from "../core/relay.mjs";
import { makeRng } from "../core/rng.mjs";

const fail = message => { console.error(`relay smoke: ${message}`); process.exit(1); };
const rng = () => makeRng(1);

// 1. 継電の段階倍率。同系統が続けば 1,2,3... 倍になり、系統が変われば1へ戻る。
{
  const chain = ["rivet", "rivet", "rivet", "rivet", "rivet"].map((t, i) => ({ id: `a${i}`, type: t }));
  const r = simulateBattle({ slots: chain, hp: 30, maxHp: 30, enemy: { name: "t", hp: 9999, atk: 0, atkPeriod: 99, cap: 99, floor: 0 }, rng: rng() });
  const first = r.log.filter(e => e.cycle === 1 && e.slot !== null);
  const values = first.map(e => e.damage);
  if (values.join(",") !== "4,8,12,16,20") fail(`段階倍率が違う: ${values.join(",")}`);
}
{
  // 撃・守・撃 と並べれば、3つ目は連鎖が切れて等倍。
  const mixed = [{ id: "a", type: "rivet" }, { id: "b", type: "thin" }, { id: "c", type: "rivet" },
    { id: "d", type: "rivet" }, { id: "e", type: "rivet" }];
  const r = simulateBattle({ slots: mixed, hp: 30, maxHp: 30, enemy: { name: "t", hp: 9999, atk: 0, atkPeriod: 99, cap: 99, floor: 0 }, rng: rng() });
  const values = r.log.filter(e => e.cycle === 1 && e.slot !== null).map(e => e.damage || e.shieldGained);
  if (values.join(",") !== "4,4,4,8,12") fail(`系統が変わっても切れていない: ${values.join(",")}`);
}

// 2. 自傷には倍率が乗らない。
{
  // 過給器は周期2。枠0と枠2はどちらも奇数巡に作動するので、同じ巡回で連なる。
  const slots = [{ id: "a", type: "surge" }, null, { id: "b", type: "surge" }, null, null];
  const r = simulateBattle({ slots, hp: 30, maxHp: 30, enemy: { name: "t", hp: 9999, atk: 0, atkPeriod: 99, cap: 99, floor: 0 }, rng: rng() });
  const selfs = r.log.filter(e => e.cycle === 1 && e.slot !== null).map(e => e.selfDamage);
  if (selfs.join(",") !== "4,4") fail(`自傷に倍率が乗っている: ${selfs.join(",")}`);
}

// 3. 反射：巡回の終わりに残った遮蔽の半分が返る。
{
  const slots = [{ id: "a", type: "thin" }, null, null, null, null];
  const r = simulateBattle({ slots, hp: 30, maxHp: 30, enemy: { name: "t", hp: 9999, atk: 0, atkPeriod: 99, cap: 99, floor: 0 }, rng: rng() });
  const reflect = r.log.find(e => e.type === "reflect");
  if (!reflect || reflect.damage !== 2) fail(`反射が合わない: ${reflect && reflect.damage}`);
}

// 4. 決定性：同じ並びは何度引いても同じ結果。画面が結果を断定できる前提そのもの。
{
  const slots = ["hammer", "thick", "rivet", "loop", "twin"].map((t, i) => ({ id: `s${i}`, type: t }));
  const a = simulateBattle({ slots, hp: 30, maxHp: 30, enemy: ENEMIES[3], rng: makeRng(1) });
  const b = simulateBattle({ slots, hp: 30, maxHp: 30, enemy: ENEMIES[3], rng: makeRng(99999) });
  if (JSON.stringify([a.won, a.cycles, a.hp, a.enemyHp]) !== JSON.stringify([b.won, b.cycles, b.hp, b.enemyHp])) {
    fail("乱数で結果が変わった（deterministic を名乗れない）");
  }
  if (!RELAY.deterministic) fail("deterministic フラグが立っていない");
}

// 5. 初期手札の契約：撃3・守2を必ず満たす。これが無いと生成条件（T1とT2）が両立しない。
for (let seed = 1; seed <= 60; seed += 1) {
  const o = createRun({ seed, playerId: "smoke", ruleset: RELAY }).observe();
  const count = line => o.inventory.filter(p => PARTS[p.type].line === line).length;
  if (count("strike") < 3 || count("guard") < 2) fail(`seed ${seed} の初期手札が契約を満たさない`);
}

// 6. 部品の説明は1行に収める（読む重さの上限。「読むのは機械、探すのは人」）。
Object.entries(PARTS).forEach(([key, part]) => {
  if (part.desc.includes("\n") || part.desc.length > 46) fail(`${key} の説明が長い（${part.desc.length}字）`);
  if (!part.line) fail(`${key} に系統が無い`);
});

// 7. 敵の説明と数値が一致している（PHASEで一度、調律後に説明だけ古いまま残した）。
ENEMIES.forEach(enemy => {
  if (enemy.cap < 99 && !enemy.trait.includes(String(enemy.cap))) fail(`${enemy.name} の説明に命中上限 ${enemy.cap} が出ていない`);
  if (enemy.floor && !enemy.trait.includes(String(enemy.floor))) fail(`${enemy.name} の説明に命中下限 ${enemy.floor} が出ていない`);
  if (enemy.regen && !enemy.trait.includes(String(enemy.regen))) fail(`${enemy.name} の説明に毎巡回復 ${enemy.regen} が出ていない`);
  if (!enemy.trait.includes(String(enemy.atk))) fail(`${enemy.name} の説明に攻撃力 ${enemy.atk} が出ていない`);
});

// 等級（P11）。閾値と語がずれると、画面の言葉と記録がずれる。
{
  const { gradeFor } = await import("../core/relay.mjs");
  const cases = [[true, 0, "無傷"], [true, 5, "上々"], [true, 6, "及第"], [true, 14, "及第"], [true, 15, "辛勝"], [false, 30, "敗北"]];
  cases.forEach(([won, lost, label]) => {
    if (gradeFor(won, lost).label !== label) fail(`等級が違う: 勝${won} 失点${lost} → ${gradeFor(won, lost).label}（期待 ${label}）`);
  });
  if (gradeFor(false, 0).rank !== 0) fail("敗北の等級は0位でなければならない");
}

console.log("relay smoke: 段階倍率・自傷・反射・決定性・初期手札の契約・説明と数値の一致 OK");
