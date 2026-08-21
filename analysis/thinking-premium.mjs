import { RELAY } from "../core/relay.mjs";
import { PHASE } from "../core/phase.mjs";
import { reachableSets, HP_POINTS, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

// 「考えると、どれだけ良くなるか」を測る。
//
// 作者の指摘：ガチャガチャで勝ててしまうのはつまらないが、**咎めるのはもっとつまらない**。
// 「積み上げのないゲームで決断を大きく咎めるのは楽しみを奪う」。
// 実際、RELAY の人間5ランは**全勝**で、このゲームは一度も咎めていない。
// つまり「試行に費用をつける」「決定を1戦で完結させない」は、存在しない問題を解こうとしていた。
//
// 罰を増やさずにガチャガチャを無意味でなくする道は一つ：**勝ち負けの外に質の差を置く。**
// その前提として、**考えた並びは、たまたま勝てた並びより実際に良いのか**を確かめる必要がある。
// 良くならないなら、質を残しても意味がない。

const RULESETS = { relay: RELAY, phase: PHASE };
const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [item, true];
}));
const rules = RULESETS[args.ruleset || "relay"];
const { SLOT_COUNT, MAX_HP, MAX_CYCLES, ENEMIES } = rules;
const runs = Number(args.runs || 40);

function allArrangements(types) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [];
  const cur = [];
  const walk = d => {
    if (d === SLOT_COUNT) { out.push([...cur]); return; }
    kinds.forEach(k => {
      if (!counts.get(k)) return;
      counts.set(k, counts.get(k) - 1);
      cur.push(k);
      walk(d + 1);
      cur.pop();
      counts.set(k, counts.get(k) + 1);
    });
  };
  walk(0);
  return out;
}

const play = (order, enemy, hp) => rules.simulateBattle({
  slots: order.map((type, i) => ({ id: `x${i}`, type })), hp, maxHp: MAX_HP, enemy, rng: makeRng(1)
});

const sets = reachableSets(rules, { runs });
const rows = [];

sets.forEach(situation => {
  const enemy = ENEMIES[Math.min(situation.index, ENEMIES.length - 1)];
  const hp = SAFE_HP;
  const list = allArrangements(situation.owned);
  const rng = makeRng(situation.run * 131 + situation.index);

  // ガチャガチャ：無作為に20回試して、最初に勝てたところで止める（人はふつう最適化しない）。
  let shuffled = null;
  for (let k = 0; k < 20 && !shuffled; k += 1) {
    const pick = list[Math.floor(rng() * list.length)];
    const result = play(pick, enemy, hp);
    if (result.won) shuffled = result;
  }
  // 考えた側：全通りのうち最良（残HPが多く、巡回が短い）。
  let best = null;
  list.forEach(order => {
    const result = play(order, enemy, hp);
    if (!result.won) return;
    if (!best || result.hp > best.hp || (result.hp === best.hp && result.cycles < best.cycles)) best = result;
  });
  if (shuffled && best) rows.push({ index: situation.index, shuffled, best });
});

const mean = (list, f) => list.reduce((a, r) => a + f(r), 0) / list.length;
const pct = v => `${(v * 100).toFixed(0)}%`.padStart(4);

console.log(`# ${rules.id} / ${sets.length}局面のうち、両方が勝てた ${rows.length}件\n`);
console.log("戦 | ガチャガチャの残HP | 考えた場合の残HP | 差 | ガチャの巡回 | 考えた巡回 | 差");
for (let index = 0; index < ENEMIES.length; index += 1) {
  const g = rows.filter(r => r.index === index);
  if (!g.length) continue;
  const sh = mean(g, r => r.shuffled.hp);
  const be = mean(g, r => r.best.hp);
  const sc = mean(g, r => r.shuffled.cycles);
  const bc = mean(g, r => r.best.cycles);
  console.log([
    String(index + 1).padStart(2), sh.toFixed(1).padStart(17), be.toFixed(1).padStart(16),
    (be - sh).toFixed(1).padStart(4), sc.toFixed(1).padStart(12), bc.toFixed(1).padStart(10),
    (sc - bc).toFixed(1).padStart(4)
  ].join(" | "));
}

const hpGain = mean(rows, r => r.best.hp - r.shuffled.hp);
const cycGain = mean(rows, r => r.shuffled.cycles - r.best.cycles);
const flawlessShuffle = rows.filter(r => r.shuffled.hp >= SAFE_HP).length / rows.length;
const flawlessBest = rows.filter(r => r.best.hp >= SAFE_HP).length / rows.length;

console.log(`\n考えることで残るHP: 平均 +${hpGain.toFixed(1)}（最大HP ${MAX_HP} の ${(hpGain / MAX_HP * 100).toFixed(0)}%）`);
console.log(`考えることで縮む巡回: 平均 -${cycGain.toFixed(1)}（打切り ${MAX_CYCLES}巡）`);
console.log(`無傷で勝てた割合: ガチャガチャ ${pct(flawlessShuffle)} / 考えた場合 ${pct(flawlessBest)}`);
console.log(hpGain >= 5
  ? "\n→ 質の差がある。**勝ち負けの外に質を置けば、罰を増やさずに思考が報われる。**"
  : "\n→ 質の差が小さい。質を残しても思考は報われない。別の道が要る。");
