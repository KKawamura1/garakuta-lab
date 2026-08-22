// 「前の戦闘と同じ並びのまま、次も勝てる」局面が何割あるか。
//
// 作者の着想（2026-08-22）：それを欠陥として潰すのではなく、**褒めて戦闘を飛ばす**。
// 報酬は「時間が浮く」だけにして、汎用的に勝てる構成を狙う動機を作る。
//
// **設計の前に、頻度を知る必要がある。** 1割なら演出の出番がほぼ無く、
// 8割なら run の大半が飛んで、遊ぶところが残らない。作者の時間は1分も使わずに測れる。
//
// ついでに「そのまま勝てる」の中身も分ける：
//   そのまま無傷 … 完全に手つかずで最上位の等級まで行く
//   そのまま勝ち … 勝つが傷は負う（＝飛ばしてよいかは微妙）

import { makeSimulate, makeLawRuleset, PARTS, SLOT_COUNT, BASE } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const MAX_HP = 30, CAP = 200;

function arrangementsOf(types, rng) {
  const counts = new Map(); types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()]; const out = [], cur = [];
  const walk = d => { if (out.length > 200000) return;
    if (d === SLOT_COUNT) { out.push([...cur]); return; }
    kinds.forEach(k => { if (!counts.get(k)) return;
      counts.set(k, counts.get(k) - 1); cur.push(k); walk(d + 1); cur.pop(); counts.set(k, counts.get(k) + 1); }); };
  walk(0);
  if (out.length <= CAP) return out;
  const picked = []; for (let i = 0; i < CAP; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
  return picked;
}

const play = (sim, order, enemy) => sim({
  slots: order.map((t, i) => ({ id: `x${i}`, type: t })), hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1) });

// 各戦闘で「その戦闘に勝てた並び」を集め、次の戦闘へ持ち込んで、そのまま勝てるかを見る。
function measure(row, runs = 24) {
  const rules = makeLawRuleset(row.laws, row.scales, row.atkScales, row.modScales, row.cycleCaps);
  const sim = makeSimulate(row.laws);
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
      && t.filter(x => PARTS[x].line === "guard").length >= 2
      && t.filter(x => PARTS[x].line === "service").length >= 1 }, { runs });
  const steps = [];
  for (let r = 0; r < runs; r += 1) {
    for (let i = 0; i + 1 < rules.ENEMIES.length; i += 1) {
      const owned = sets.find(s => s.run === r && s.index === i)?.owned;
      if (!owned) continue;
      // その戦闘に**無傷で**勝てた並び（＝人が採用しそうな並び）を持ち越す。
      const winners = arrangementsOf(owned, makeRng(r * 977 + i))
        .filter(o => { const x = play(sim, o, rules.ENEMIES[i]); return x.won && x.hp >= SAFE_HP; });
      if (!winners.length) continue;
      let carriedWin = 0, carriedFlawless = 0;
      winners.forEach(o => {
        const next = play(sim, o, rules.ENEMIES[i + 1]);
        if (next.won) { carriedWin += 1; if (next.hp >= SAFE_HP) carriedFlawless += 1; }
      });
      steps.push({ from: i + 1, to: i + 2,
        win: carriedWin / winners.length, flawless: carriedFlawless / winners.length });
    }
  }
  const mean = k => steps.reduce((n, s) => n + s[k], 0) / Math.max(1, steps.length);
  const byStep = {};
  steps.forEach(s => { (byStep[`${s.from}→${s.to}`] ||= []).push(s.flawless); });
  return { name: row.name, win: mean("win"), flawless: mean("flawless"),
    byStep: Object.fromEntries(Object.entries(byStep)
      .map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length])) };
}

console.log("前の戦闘で無傷だった並びを、そのまま次へ持ち込んだとき\n");
console.log("組              そのまま勝ち  そのまま無傷   戦闘ごとの「そのまま無傷」");
const all = [];
LAW_TABLE.forEach(row => {
  const m = measure(row);
  all.push(m);
  console.log(`${m.name.padEnd(12)} ${(m.win * 100).toFixed(0).padStart(9)}% ${(m.flawless * 100).toFixed(0).padStart(11)}%   `
    + Object.entries(m.byStep).map(([k, v]) => `${k}:${(v * 100).toFixed(0)}%`).join(" "));
});
const mean = k => all.reduce((n, m) => n + m[k], 0) / all.length;
console.log(`\n平均：そのまま勝ち ${(mean("win") * 100).toFixed(0)}% ／ そのまま無傷 ${(mean("flawless") * 100).toFixed(0)}%`);
console.log(`\n読み方：そのまま無傷が ${(mean("flawless") * 100).toFixed(0)}% なら、`
  + `6戦のうち約 ${(mean("flawless") * 5).toFixed(1)} 戦が飛ぶ計算になる。`);
