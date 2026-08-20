import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PHASE } from "../core/phase.mjs";
import { makeRng } from "../core/rng.mjs";

// 「正解の組み合わせは何通りあるか」を数える。
//
// 作者の申告：入れ替えのたびに結果を暗算するのは「ただの足し算で脳トレ」でつまらない。
// 一方で組み合わせを試している時間は楽しい。→ 予測は自動で出し、正解を減らす方向。
// その「正解の数」をここで直接測る。無傷率のような結果の統計ではなく、
// **決定の空間そのもの**を測る指標である。
//
// PHASE 0.1 の戦闘は決定的（どの部品も rng を使わない）なので、列挙は近似ではなく正確。
// 同じ型の部品は交換しても同じ機械になるので、型の並びで重複を除く。

const { ENEMIES, PARTS, simulateBattle, SLOT_COUNT, MAX_HP } = PHASE;

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));

const nameToType = new Map(Object.entries(PARTS).map(([type, part]) => [part.name, type]));
const enemyByName = new Map(ENEMIES.map(e => [e.name, e]));

// 型の多重集合から、長さ SLOT_COUNT の相異なる並びを列挙する。
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
  const list = arrangements(types);
  let won = 0;
  let flawless = 0;
  list.forEach(order => {
    const slots = order.map((type, i) => ({ id: `x${i}`, type }));
    const result = simulateBattle({ slots, hp, maxHp: MAX_HP, enemy, rng: makeRng(1) });
    if (result.won) {
      won += 1;
      if (result.hp >= hp) flawless += 1;
    }
  });
  return { total: list.length, won, flawless, winRate: won / list.length, flawlessRate: flawless / list.length };
}

const pct = v => `${(v * 100).toFixed(1)}%`.padStart(6);

// --- 作者のトレースから、各戦闘時点の所持部品を復元して測る ---
const dir = "analysis/human-runs";
const files = readdirSync(dir).filter(n => /^human-phase-seed\d+\.json$/.test(n)).sort();
const perBattle = [[], [], [], [], [], []];
const all = [];

files.forEach(file => {
  const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const events = data.trace.events;
  const started = events.find(e => e.type === "run_started");
  if (!started) return;
  let owned = started.initial.map(name => nameToType.get(name)).filter(Boolean);
  const ended = events.filter(e => e.type === "battle_ended");
  const chosen = events.filter(e => e.type === "reward_chosen");
  console.log(`\n## seed ${data.seed}（再プレイ ${data.survey?.replay ?? "?"}）`);
  console.log("戦 | 敵       | 所持 | 並びの総数 | 勝てる並び | 無傷の並び | 実際の失点");
  ended.forEach((battle, index) => {
    const enemy = enemyByName.get(battle.enemy);
    if (!enemy) return;
    const m = measure(owned, enemy, battle.hpBefore);
    const lost = battle.hpBefore - battle.hpAfter;
    console.log([
      String(index + 1).padStart(2),
      battle.enemy.padEnd(6),
      String(owned.length).padStart(4),
      String(m.total).padStart(9),
      `${pct(m.winRate)}`,
      `${pct(m.flawlessRate)}`,
      String(lost).padStart(9)
    ].join(" | "));
    perBattle[index].push(m.winRate);
    all.push(m.winRate);
    // 次の戦闘の前に、この波の報酬を加える
    const reward = chosen[index];
    if (reward && reward.chosen) {
      const type = nameToType.get(reward.chosen);
      if (type) owned.push(type);
    }
  });
});

const median = list => {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const mean = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

console.log("\n## まとめ（作者4ラン）");
console.log("戦 | 勝てる並びの割合（平均）");
perBattle.forEach((list, index) => {
  if (!list.length) return;
  console.log(`${String(index + 1).padStart(2)} | ${pct(mean(list))}   [${list.map(v => pct(v).trim()).join(" ")}]`);
});
console.log(`\n全${all.length}戦の中央値: ${pct(median(all))} / 平均: ${pct(mean(all))}`);
const mid = mean([...perBattle[2], ...perBattle[3], ...perBattle[4]]);
console.log(`3〜5戦目の平均: ${pct(mid)}`);
console.log(`6戦目の平均: ${pct(mean(perBattle[5]))}`);
