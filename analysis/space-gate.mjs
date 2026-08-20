import { PHASE } from "../core/phase.mjs";
import { RELAY } from "../core/relay.mjs";
import { ARC } from "../core/arc.mjs";
import { makeRng } from "../core/rng.mjs";
import { reachableSets, HP_POINTS, SAFE_HP } from "./sets.mjs";

// P10 の生成条件を直接測る。作者の言葉：
//   「並びはきつめに、部品選択はゆるめに。どの部品を選択しても勝ちの目があるが、
//     部品の効果は大きく違っていて、勝敗には並び順が大きく影響する」
//
// 到達しうる所持部品集合 S を実プレイから集め、S を5枠へ並べる相異なる型の並びを
// 全列挙して、勝てる並びを数える。決定的なルールセットなので近似ではない。
//
// T1 選択はゆるい：勝てる並びが1つ以上ある S の割合 ≥ 98%
// T2 並びはきつい：勝てる並びの割合の中央値 5〜15%、どの戦闘でも 30% 以下
// T3 並び順が効く：0%でも100%でもない戦闘 ≥ 95%
// T5 外した代償  ：外した並びの平均失点 ≥ 勝利時回復の3倍

const RULESETS = { phase: PHASE, relay: RELAY, arc: ARC };
const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));

const rules = RULESETS[args.ruleset || "relay"];
if (!rules) { console.error("未知のルールセット"); process.exit(2); }
const seeds = Number(args.seeds || 30);
const cap = Number(args.cap || 60000); // 1戦あたりの列挙上限。超えたら一様にサンプルする。
const { SLOT_COUNT, MAX_HP, WIN_HEAL, ENEMIES } = rules;

function arrangements(types) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [];
  const current = [];
  const walk = depth => {
    if (depth === SLOT_COUNT) { out.push([...current]); return; }
    kinds.forEach(kind => {
      if (counts.get(kind) === 0) return;
      counts.set(kind, counts.get(kind) - 1);
      current.push(kind);
      walk(depth + 1);
      current.pop();
      counts.set(kind, counts.get(kind) + 1);
    });
  };
  walk(0);
  return out;
}

function measure(types, enemy, hp) {
  let list = arrangements(types);
  const full = list.length;
  if (full > cap) {
    const rng = makeRng(7);
    const picked = [];
    for (let i = 0; i < cap; i += 1) picked.push(list[Math.floor(rng() * full)]);
    list = picked;
  }
  let won = 0;
  let lossHp = 0;
  let losses = 0;
  list.forEach(order => {
    const slots = order.map((type, i) => ({ id: `x${i}`, type }));
    const result = rules.simulateBattle({ slots, hp, maxHp: MAX_HP, enemy, rng: makeRng(1) });
    if (result.won) won += 1;
    else { losses += 1; lossHp += hp - result.hp; }
  });
  return {
    sampled: list.length, full, winRate: won / list.length,
    lossPenalty: losses ? lossHp / losses : 0
  };
}

// 局面は難易度から独立に作る。方策のプレイから採ると、締めた瞬間に序盤で全滅して
// 後半が測れなくなり、「難しくすると測れないので難しくしない」方向へ壊れる（実際に一度そうなった）。
// T1 は「どの部品を選択しても」の主張なので、報酬も方策ではなく一様乱択で引く。
const situations = reachableSets(rules, { runs: seeds }).flatMap(s => HP_POINTS.map(hp => ({ ...s, hp })));

const rows = situations.map(s => ({ ...s, ...measure(s.owned, ENEMIES[Math.min(s.index, ENEMIES.length - 1)], s.hp) }));

const median = list => {
  const sorted = [...list].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const mean = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const pct = v => `${(v * 100).toFixed(1)}%`.padStart(6);

console.log(`# ${rules.id} / ${seeds}シード / ${rows.length}局面\n`);
console.log("戦 | 敵       | 勝てる並びの割合 | 0%の局面 | 100%の局面 | 外した時の平均失点");
for (let index = 0; index < ENEMIES.length; index += 1) {
  const group = rows.filter(r => r.index === index);
  if (!group.length) continue;
  const zero = group.filter(r => r.winRate === 0).length;
  const full = group.filter(r => r.winRate === 1).length;
  console.log([
    String(index + 1).padStart(2),
    ENEMIES[index].name.padEnd(6),
    `${pct(median(group.map(r => r.winRate)))} (中央値)`,
    `${String(zero).padStart(3)}/${String(group.length).padStart(3)}`,
    `${String(full).padStart(4)}/${String(group.length).padStart(3)}`,
    `${mean(group.map(r => r.lossPenalty)).toFixed(1).padStart(8)}`
  ].join(" | "));
}

const safeRows = rows.filter(r => r.hp === SAFE_HP);
const t1 = safeRows.filter(r => r.winRate > 0).length / safeRows.length;
const t2median = median(rows.map(r => r.winRate));
const t2worst = Math.max(...ENEMIES.map((_, i) => median(rows.filter(r => r.index === i).map(r => r.winRate)) || 0));
const t3 = rows.filter(r => r.winRate > 0 && r.winRate < 1).length / rows.length;
const t5 = mean(rows.map(r => r.lossPenalty)) / WIN_HEAL;

const checks = [
  { name: "T1 選択はゆるい", ok: t1 >= 0.98, detail: `満タンで勝てる並びがある局面 ${pct(t1)}（≥98%）` },
  { name: "T2 並びはきつい", ok: t2median >= 0.05 && t2median <= 0.15 && t2worst <= 0.30,
    detail: `中央値 ${pct(t2median)}（5〜15%）／戦闘別の最大 ${pct(t2worst)}（≤30%）` },
  { name: "T3 順序が効く", ok: t3 >= 0.95, detail: `0%でも100%でもない局面 ${pct(t3)}（≥95%）` },
  { name: "T5 外した代償", ok: t5 >= 3, detail: `外した時の失点 ${mean(rows.map(r => r.lossPenalty)).toFixed(1)} ＝ 勝利回復の${t5.toFixed(1)}倍（≥3倍）` }
];
console.log("\n## P10 生成条件");
checks.forEach(c => console.log(`  ${c.ok ? "○" : "×"} ${c.name}  ${c.detail}`));
console.log(`\n判定: ${checks.every(c => c.ok) ? "合格" : `不合格（${checks.filter(c => !c.ok).map(c => c.name).join("・")}）`}`);
if (args.strict && !checks.every(c => c.ok)) process.exit(1);
