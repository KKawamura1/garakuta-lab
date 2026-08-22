// 「その法則は、選択肢を狭めるか」を測る。
//
// 作者の報告（2026-08-22）：**「偏食は選択肢を狭めるのでとてもつまらなかったです。
// ただ、新しいルールで気づきがあった時はとても楽しかったです。」**
//
// 偏食には上振れ（撃×2）があるので、`smoke-laws.mjs` の「ハズレ法則の禁止」を素通りする。
// **上振れがあることと、選択肢が残ることは別の量である。** ここで別に測る。
//
// 測り方：勝てる並びに現れる**系統構成**（撃/守/整の枚数の組）の多様性。
// 5枠を3系統へ分ける構成は21通りある。法則が「撃だけ」を強いるなら、
// 勝てる並びの構成はごく少数へ潰れる。潰れ方を数える。
//
// **参照点を必ず一緒に測る**（学び#52）。作者が5を付けた RELAY 0.1 と、
// つまらないと言われた偏食入りの組と、その両方を同じ物差しにかける。

import { makeSimulate, makeLawRuleset, scaleEnemies, PARTS, SLOT_COUNT, BASE } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { PARTS as RPARTS, ENEMIES as RENEMIES, simulateBattle as rsim, START_PARTS, RARE_RATE }
  from "../core/relay.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const MAX_HP = 30, CAP = 400;

function arrangementsOf(types, rng) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [], cur = [];
  const walk = d => {
    if (out.length > 200000) return;
    if (d === SLOT_COUNT) { out.push([...cur]); return; }
    kinds.forEach(k => {
      if (!counts.get(k)) return;
      counts.set(k, counts.get(k) - 1); cur.push(k);
      walk(d + 1);
      cur.pop(); counts.set(k, counts.get(k) + 1);
    });
  };
  walk(0);
  if (out.length <= CAP) return out;
  const picked = [];
  for (let i = 0; i < CAP; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
  return picked;
}

const composition = (order, parts) => {
  const c = { strike: 0, guard: 0, service: 0 };
  order.forEach(t => { c[parts[t].line] += 1; });
  return `撃${c.strike}守${c.guard}整${c.service}`;
};

// 一つの敵について、勝てる並びの系統構成を数える。
function widthFor(simulate, parts, enemies, sets, index) {
  const enemy = enemies[index];
  const situations = sets.filter(s => s.index === index);
  const winComps = new Map();
  let wins = 0, total = 0;
  situations.forEach(s => {
    arrangementsOf(s.owned, makeRng(s.run * 977 + index)).forEach(order => {
      total += 1;
      const r = simulate({
        slots: order.map((type, i) => ({ id: `x${i}`, type })),
        hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1), parts
      });
      if (!r.won) return;
      wins += 1;
      const k = composition(order, parts);
      winComps.set(k, (winComps.get(k) || 0) + 1);
    });
  });
  // **5%以上を占める構成の数**を「選択肢の幅」とする。
  // 1つしか無いなら「その形にしないと勝てない」。多いほど別の攻め方が成立している。
  const viable = [...winComps.entries()].filter(([, n]) => n / Math.max(1, wins) >= 0.05);
  // 上位の構成が占める割合（1に近いほど一本道）。
  const top = Math.max(0, ...winComps.values()) / Math.max(1, wins);
  return { wins, total, kinds: viable.length, top, list: viable.sort((a, b) => b[1] - a[1]) };
}

function report(label, simulate, parts, enemies, sets) {
  const rows = enemies.map((_, i) => widthFor(simulate, parts, enemies, sets, i));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const kinds = mean(rows.map(r => r.kinds));
  const top = mean(rows.map(r => r.top));
  console.log(`${label.padEnd(20)} 幅 ${kinds.toFixed(1)}構成  一本道度 ${(top * 100).toFixed(0)}%`
    + `  戦闘ごと[${rows.map(r => r.kinds).join(",")}]`);
  return { label, kinds, top };
}

const rsets = reachableSets({ PARTS: RPARTS, START_PARTS, RARE_RATE, ENEMIES: RENEMIES,
  startContract: t => t.filter(x => RPARTS[x].line === "strike").length >= 3
    && t.filter(x => RPARTS[x].line === "guard").length >= 2 }, { runs: 10 });
const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
  startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
    && t.filter(x => PARTS[x].line === "guard").length >= 2
    && t.filter(x => PARTS[x].line === "service").length >= 1 }, { runs: 10 });

console.log("勝てる並びに現れる系統構成の幅（5%以上を占める構成の数）\n");
const out = [];
out.push(report("RELAY 0.1（評価5）", rsim, RPARTS, RENEMIES, rsets));
console.log("");
LAW_TABLE.forEach(row => {
  const rules = makeLawRuleset(row.laws, row.scales, row.atkScales, row.modScales, row.cycleCaps);
  out.push(report(row.name, makeSimulate(row.laws), PARTS, rules.ENEMIES, sets));
});
console.log("");
out.push(report("（法則なし・素）", makeSimulate([]), PARTS, scaleEnemies(1, 1, 1), sets));

console.log("\n偏食入りとそれ以外:");
const bias = out.filter(o => o.label.includes("偏食"));
const rest = out.filter(o => !o.label.includes("偏食"));
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
console.log(`  偏食入り(${bias.length}件)   幅 ${mean(bias.map(o => o.kinds)).toFixed(1)}  一本道度 ${(mean(bias.map(o => o.top)) * 100).toFixed(0)}%`);
console.log(`  それ以外(${rest.length}件)   幅 ${mean(rest.map(o => o.kinds)).toFixed(1)}  一本道度 ${(mean(rest.map(o => o.top)) * 100).toFixed(0)}%`);
