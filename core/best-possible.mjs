// **その持ち物で、到達できた最良は何だったか。**
//
// 作者の提案（2026-08-22）：
//   「可能なら答えを教えてくれると面白いかもです。つまり、もっといい評価を取れたのか、
//     取れなかったのか。あるいは、その評価を取る方法は何だったのか。
//     学びがあると飽きずに楽しめそうです」
//
// **これは「増強の仮説」**であって必要条件ではない。生成条件には入れない。
// 要素分解のうち、ここで出すのは (a) 到達可能だったか と (b) 最良の値 まで。
// **(c) その並びそのものは出さない。** 探索を奪ううえ、作者が既に報告している摩擦
// 「そのまま勝ててしまう」に燃料を足すことになるため（教わった型を次戦へ持ち込める）。
//
// 全列挙で答える。実測で手持ち13個・並べ方7,240通り・135ms なので、標本を採る必要はない。
// **「調べた範囲で最良」ではなく、本当の最良を出せる。**

import { SLOT_COUNT } from "./laws.mjs";

// 同じ種類の部品は入れ替えても同じ盤面になるので、種類で重複を畳む。
export function allArrangements(types, slotCount = SLOT_COUNT) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [], cur = [];
  const walk = depth => {
    if (depth === slotCount) { out.push([...cur]); return; }
    kinds.forEach(kind => {
      if (!counts.get(kind)) return;
      counts.set(kind, counts.get(kind) - 1); cur.push(kind);
      walk(depth + 1);
      cur.pop(); counts.set(kind, counts.get(kind) + 1);
    });
  };
  walk(0);
  return out;
}

// rules: ルールセット / owned: その時点の部品の種類 / enemy: その戦闘の敵 / hp: 戦闘開始時のHP
export function bestPossible(rules, owned, enemy, hp, rng) {
  let bestRank = -1, bestLabel = null, bestCycles = Infinity, wins = 0, total = 0;
  allArrangements(owned, rules.SLOT_COUNT).forEach(order => {
    total += 1;
    const r = rules.simulateBattle({
      slots: order.map((type, i) => ({ id: `b${i}`, type })),
      hp, maxHp: rules.MAX_HP, enemy, rng: rng()
    });
    if (!r.won) return;
    wins += 1;
    const grade = rules.gradeFor(true, hp - r.hp, r.cycles);
    if (grade.rank > bestRank) { bestRank = grade.rank; bestLabel = grade.label; }
    if (r.cycles < bestCycles) bestCycles = r.cycles;
  });
  return {
    rank: bestRank, label: bestLabel,
    cycles: bestCycles === Infinity ? null : bestCycles,
    winnable: wins, total
  };
}
