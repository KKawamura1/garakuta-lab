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
  let flawless = 0;
  let lossHp = 0;
  let losses = 0;
  list.forEach(order => {
    const slots = order.map((type, i) => ({ id: `x${i}`, type }));
    const result = rules.simulateBattle({ slots, hp, maxHp: MAX_HP, enemy, rng: makeRng(1) });
    if (result.won) { won += 1; if (result.hp >= hp) flawless += 1; }
    else { losses += 1; lossHp += hp - result.hp; }
  });
  return {
    sampled: list.length, full, winRate: won / list.length,
    flawlessRate: flawless / list.length,
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
// 「ガチャガチャやってれば大体勝てる」を数字にする。
//
// 画面が並びの結果を即座に断定する以上、並べ替えを試す費用はゼロである。
// すると勝てる並びの割合 p だけで、無作為な試行 k 回の成功率 1-(1-p)^k が決まる。
// **正解の少なさは、探索の難しさを意味しない。** 作者の実測 p=13.7% では、
// 20回ガチャガチャすれば95%勝てる。これは第7回に「探索が効いている」と読んだ数字と同じものである。
console.log("\n## 無作為な並べ替えで勝てる確率（試す費用がゼロなので、これが探索の下限難易度）");
[5, 10, 20, 40].forEach(k => {
  const rate = 1 - (1 - t2median) ** k;
  console.log(`  ${String(k).padStart(2)}回試す: ${pct(rate)}`);
});
const shuffle20 = 1 - (1 - t2median) ** 20;
if (shuffle20 > 0.5) {
  console.log("  → 20回で過半数を超える。**思考は無作為に勝てない。**");
  console.log(`     20回を50%未満に抑えるには p < 3.4% が必要で、T1（詰みを作らない）と両立しない。`);
}

// 探索者にとっての到達率へ換算する。
//
// **同じ誤りを二度した。** 1回の試行あたりの希少さを、そのまま難易度として設計に使ってしまう誤りである。
//   1度目：勝てる並び 13.7%/試行 → 20回試せば95%（#42）
//   2度目：無傷の並び 1.8%/試行 → 天井のつもりが1ランで全踏破された（#47）
// 作者の試行記録（seed 720）で実測した探索効率は**無作為の3〜27倍、中央値およそ7倍**。
// 以後、設計は「1試行あたりの率」ではなく「この探索者が1戦で到達する率」で行う。
const EFFICIENCY = 7;          // 実測値。telemetry が増えたら更新する。
const TRIES = 10;              // 1戦あたりの試行回数の実測中央値（6戦で 8,1,12,6,3,6）。
const reachable = p => 1 - (1 - Math.min(1, p * EFFICIENCY)) ** TRIES;
console.log("\n## 探索者にとっての到達率（無作為の7倍の効率で10回試す、という実測の模型）");
console.log(`  勝ち   1試行あたり ${pct(t2median)} → 1戦あたり ${pct(reachable(t2median))}`);
const flawlessRate = mean(rows.map(r => r.flawlessRate || 0));
console.log(`  無傷   1試行あたり ${pct(flawlessRate)} → 1戦あたり ${pct(reachable(flawlessRate))}`);
if (reachable(flawlessRate) > 0.5) {
  console.log("  → **最上位の等級が1戦で半数以上到達される。天井は1ランで尽きる。**");
}

console.log("\n## P10 生成条件");
checks.forEach(c => console.log(`  ${c.ok ? "○" : "×"} ${c.name}  ${c.detail}`));
console.log(`\n判定: ${checks.every(c => c.ok) ? "合格" : `不合格（${checks.filter(c => !c.ok).map(c => c.name).join("・")}）`}`);
if (args.strict && !checks.every(c => c.ok)) process.exit(1);
