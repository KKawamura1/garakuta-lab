// 出題を作る。**「足し算で読んでいる限り届かない」ことを機械で保証する。**
//
// 企画の全記録でいちばん強い感情は、勝敗でも等級でもなく気づきだった：
//   「そうか、一撃99の制限は2回攻撃なら198までいけるのか。知識アンロック！」
// それを勝敗の副産物ではなく、**出題そのもの**にする。
//
// 出題は「この敵に、3巡で X ダメージ通せ」。X の置き方が全てである：
//   naive … 法則を**足し算で読んで**組んだ並びが、実際に出す値
//   best  … 全列挙で見つかる最大値
//   目標 X は **naive と best のあいだ**に置く。
//   → 足し算で考えている限り届かない。噛み合わせに気づいた時だけ越える。
//
// **総当たりで解けてはいけない。**5個の並べ替えだけなら60通りで、
// それは気づきではなく作業である（作者の記録：「ガチャガチャやってたらなんか勝てるので飽きてきた」）。
// 手持ち8個から5枠を選んで並べる形にして、空間を数千通りにする。

import { writeFileSync } from "node:fs";
import { makeSimulate, LAWS, LAW_IDS, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { makeRng } from "../core/rng.mjs";

const CYCLES = 3;
const HUGE = 1e9;
const POOL = 8;
const MIN_RATIO = 1.3;      // 足し算で組んだ値の何倍を「気づきが要る」とみなすか
// **総当たりで解ける出題は出さない。**
// 手持ちに同じ部品が偏ると並びが100通りまで落ち、それは気づきではなく作業になる。
const MIN_SPACE = 400;
const WANT = Number(process.argv[2] || 8);

// 敵は**1発の上限**だけを持つ。多段や作動回数で越えるのが、狙っている気づきの形。
const enemyOf = cap => ({ name: "試験体", hp: HUGE, atk: 0, atkPeriod: 99, cap, floor: 0, cycleCap: 0, regen: 0 });

function permsOf(multiset) {
  const out = [], cur = [], used = new Array(multiset.length).fill(false);
  const sorted = [...multiset].sort();
  const walk = () => {
    if (cur.length === sorted.length) { out.push([...cur]); return; }
    let last = null;
    for (let i = 0; i < sorted.length; i += 1) {
      if (used[i] || sorted[i] === last) continue;
      last = sorted[i]; used[i] = true; cur.push(sorted[i]); walk(); cur.pop(); used[i] = false;
    }
  };
  walk();
  return out;
}

// 手持ちから5枠を選んで並べる全パターン（重複は除く）。
export function arrangementSpace(pool) {
  const out = [], seen = new Set();
  const walk = (start, cur) => {
    if (cur.length === SLOT_COUNT) {
      permsOf(cur).forEach(o => { const k = o.join(","); if (!seen.has(k)) { seen.add(k); out.push(o); } });
      return;
    }
    for (let i = start; i < pool.length; i += 1) walk(i + 1, [...cur, pool[i]]);
  };
  walk(0, []);
  return out;
}

const damage = (sim, order, enemy) => {
  const r = sim({ slots: order.map((t, i) => ({ id: `x${i}`, type: t })),
    hp: 999, maxHp: 999, enemy: { ...enemy }, rng: makeRng(1) });
  let total = 0;
  (r.log || []).forEach(e => { if (e.cycle <= CYCLES && e.damage) total += e.damage; });
  return total;
};

export function buildPuzzle(lawA, lawB, pool, cap) {
  const enemy = enemyOf(cap);
  const none = makeSimulate([]), onlyA = makeSimulate([lawA]), onlyB = makeSimulate([lawB]);
  const both = makeSimulate([lawA, lawB]);
  const space = arrangementSpace(pool);
  let best = -1, bestOrder = null, naiveScore = -1, naiveOrder = null;
  space.forEach(o => {
    const t = damage(both, o, enemy);
    if (t > best) { best = t; bestOrder = o; }
    const d0 = damage(none, o, enemy);
    const add = d0 + (damage(onlyA, o, enemy) - d0) + (damage(onlyB, o, enemy) - d0);
    if (add > naiveScore) { naiveScore = add; naiveOrder = o; }
  });
  if (!bestOrder || !naiveOrder) return null;
  const naiveTrue = damage(both, naiveOrder, enemy);
  if (naiveTrue <= 0) return null;
  const ratio = best / naiveTrue;
  if (ratio < MIN_RATIO) return null;
  if (space.length < MIN_SPACE) return null;
  return {
    laws: [lawA, lawB], name: `${LAWS[lawA].name}＋${LAWS[lawB].name}`,
    pool, cap, cycles: CYCLES,
    // 目標は naive と best のあいだ。**足し算では届かず、最良なら越える。**
    target: Math.floor((naiveTrue + best) / 2),
    naive: naiveTrue, best, ratio: Number(ratio.toFixed(2)),
    answer: bestOrder, space: space.length
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const strike = Object.keys(PARTS).filter(t => PARTS[t].line === "strike");
  const rng = makeRng(20260823);
  const puzzles = [];
  const usedPairs = new Set();
  console.log("出題を作る（足し算では届かない目標を置く）\n");
  for (let attempt = 0; attempt < 300 && puzzles.length < WANT; attempt += 1) {
    const a = LAW_IDS[Math.floor(rng() * LAW_IDS.length)];
    const b = LAW_IDS[Math.floor(rng() * LAW_IDS.length)];
    if (a === b) continue;
    const key = [a, b].sort().join("+");
    if (usedPairs.has(key)) continue;          // 同じ組ばかり並べない（学び#55）
    const pool = Array.from({ length: POOL }, () => strike[Math.floor(rng() * strike.length)]);
    const cap = [60, 99, 140][Math.floor(rng() * 3)];
    const p = buildPuzzle(a, b, pool, cap);
    if (!p) continue;
    usedPairs.add(key);
    puzzles.push(p);
    console.log(`  ${String(puzzles.length).padStart(2)}. ${p.name.padEnd(11)} 上限${String(p.cap).padStart(3)}`
      + ` 足し算${String(p.naive).padStart(4)} → 目標${String(p.target).padStart(4)} → 最良${String(p.best).padStart(4)}`
      + `（${p.ratio}倍・${p.space}通り）`);
  }
  if (puzzles.length < 4) { console.error("\n出題が4つ未満。表として成立しない。"); process.exit(1); }
  puzzles.sort((x, y) => x.ratio - y.ratio);   // やさしい順
  writeFileSync("core/puzzle-table.mjs",
    "// 出題の表。**analysis/gen-puzzles.mjs が生成する。手で編集しない。**\n"
    + "//\n// 目標は「法則を足し算で読んで組んだ並びの実測値」と「全列挙の最大値」のあいだに置いてある。\n"
    + "// つまり**足し算で考えている限り届かず、噛み合わせに気づいた時だけ越える。**\n"
    + "// answer は検証用の最良解（画面には出さない）。\n\n"
    + `export const PUZZLES = ${JSON.stringify(puzzles, null, 1)};\n\nexport default PUZZLES;\n`);
  console.log(`\n  core/puzzle-table.mjs に ${puzzles.length} 問。`);
}
