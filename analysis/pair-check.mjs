// 対の操作チェック。**人間に出す前に、狙った条件だけが違うことを機械で確かめる。**
//
// Recall テストの版は「条件を破っただけ」であって、壊れたゲームであってはいけない。
// 壊れたものがつまらないのは当たり前で、それでは仮説の検証にならない。
// **破る条件以外は、両方とも通っていること。** それをここで見る。
//
// 測るもの（すべて全列挙。標本ではない）：
//   T1 詰みなし率  … どの持ち物にも勝てる並びが1つ以上ある割合
//   T2 勝てる並び  … 並びのうち勝てるものの割合（中央値）
//   T3 順序が効く  … **同じ持ち物で、並べ替えると勝敗が変わる**戦闘の割合
//   天井           … 無傷で勝てる並びの割合（換算前の生の値も出す）

import { makeSimulate, makeLawRuleset, PARTS, SLOT_COUNT, BASE } from "../core/laws.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

const CAP = 300, MAX_HP = 30;
const EFFICIENCY = 7, TRIES = 10;
const reachable = p => 1 - (1 - Math.min(1, p * EFFICIENCY)) ** TRIES;

// **「どの5個を選ぶか」と「どう並べるか」を分ける。**
//
// これが企画の出発点そのものである（「並びはきつめに、部品選択はゆるめに」）。
// これまでの列挙は両方を混ぜていたので、**選択の緩さと並びのきつさを分離できていなかった。**
//
// さらに、T3 の実装（「勝てる並びが0%でも100%でもない戦闘の割合」）には誤りがあった。
// 「全部の並びが勝つ」局面がほぼ存在しないので、**T3 = 1 - 詰み率 = T1** になっていて、
// 全ての測定で T1 と T3 が同じ値を出していた。**T3 は一度も「並び順が効くこと」を測っていない。**
// 正しくは、**同じ5個を並べ替えたときに勝敗が変わるか**である。

// 手持ちから5個を選ぶ組み合わせ（順序を無視）。
function selectionsOf(types, cap, rng) {
  const kinds = [...new Set(types)];
  const avail = new Map(); types.forEach(t => avail.set(t, (avail.get(t) || 0) + 1));
  const out = [], cur = [];
  const walk = (start, left) => {
    if (out.length > 20000) return;
    if (left === 0) { out.push([...cur]); return; }
    for (let i = start; i < kinds.length; i += 1) {
      const k = kinds[i];
      const use = Math.min(avail.get(k), left);
      for (let n = 1; n <= use; n += 1) {
        for (let x = 0; x < n; x += 1) cur.push(k);
        walk(i + 1, left - n);
        for (let x = 0; x < n; x += 1) cur.pop();
      }
    }
  };
  walk(0, SLOT_COUNT);
  if (out.length <= cap) return out;
  const picked = []; for (let i = 0; i < cap; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
  return picked;
}

// 同じ5個の並べ替え（重複を除く）。
function permutationsOf(multiset, cap) {
  const out = [], cur = [], used = new Array(multiset.length).fill(false);
  const sorted = [...multiset].sort();
  const walk = () => {
    if (out.length >= cap) return;
    if (cur.length === sorted.length) { out.push([...cur]); return; }
    let last = null;
    for (let i = 0; i < sorted.length; i += 1) {
      if (used[i] || sorted[i] === last) continue;
      last = sorted[i]; used[i] = true; cur.push(sorted[i]);
      walk();
      cur.pop(); used[i] = false;
    }
  };
  walk();
  return out;
}

export function measure({ laws, scales, atkScales, modScales, cycleCaps, phaseless = false, overdrive = null }, runs = 20) {
  const rules = makeLawRuleset(laws, scales, atkScales, modScales, cycleCaps, { phaseless, overdrive });
  const sim = makeSimulate(laws, { phaseless, overdrive });
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
      && t.filter(x => PARTS[x].line === "guard").length >= 2
      && t.filter(x => PARTS[x].line === "service").length >= 1 }, { runs });

  const per = rules.ENEMIES.map((enemy, index) => {
    let sel = 0, selWinnable = 0;          // 選択のゆるさ
    let orderMatters = 0, orderChecked = 0; // 並び順が効くか
    const permWinRates = [];                // 並びのきつさ
    let dead = 0, situations = 0, cycles = 0, wins = 0, flawSum = 0, flawN = 0;
    sets.filter(s => s.index === index).forEach(s => {
      situations += 1;
      const rng = makeRng(s.run * 977 + index);
      let anyWin = false;
      selectionsOf(s.owned, 40, rng).forEach(multiset => {
        sel += 1;
        const perms = permutationsOf(multiset, 60);
        let won = 0, flaw = 0;
        perms.forEach(order => {
          const r = sim({ slots: order.map((t, i) => ({ id: `x${i}`, type: t })),
            hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1) });
          if (r.won) { won += 1; wins += 1; cycles += r.cycles; if (r.hp >= SAFE_HP) flaw += 1; }
        });
        flawSum += flaw / perms.length; flawN += 1;
        if (won > 0) { selWinnable += 1; anyWin = true; permWinRates.push(won / perms.length); }
        orderChecked += 1;
        // **並べ替えだけで勝敗が変わったか。**選ぶものは同じである。
        if (won > 0 && won < perms.length) orderMatters += 1;
      });
      if (!anyWin) dead += 1;
    });
    const median = a => { if (!a.length) return 0; const t = [...a].sort((x, y) => x - y); return t[Math.floor(t.length / 2)]; };
    return {
      safe: 1 - dead / situations,
      selectionLoose: selWinnable / sel,           // 勝ち目のある選択の割合
      permTight: median(permWinRates),             // 選べたとき、勝つ並びの割合
      orderMatters: orderMatters / orderChecked,   // **本物の T3**
      flawless: flawSum / flawN,
      cycles: wins ? cycles / wins : 0
    };
  });
  const mean = k => per.reduce((n, e) => n + e[k], 0) / per.length;
  return {
    T1: mean("safe"), selectionLoose: mean("selectionLoose"), permTight: mean("permTight"),
    T3: mean("orderMatters"), flawlessRaw: mean("flawless"), ceiling: reachable(mean("flawless")),
    cycles: mean("cycles"), per
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { LAW_TABLE } = await import("../core/law-table.mjs");
  const base = LAW_TABLE[0];
  const shape = (laws, phaseless) => ({ ...base, laws, phaseless });
  console.log("操作チェック：選択と並びを分けて測る（敵の数値は同じものを使う）\n");
  console.log("版                                    詰みなし  選択に勝目  並びの当り  順序が効く  天井");
  const cases = [
    ["A 位相あり＋順序依存（継電＋先陣）", ["relay", "vanguard"], false],
    ["B 位相なし＋順序非依存（共鳴＋均衡）", ["resonance", "balance"], true],
    ["  参考：位相あり＋順序非依存", ["resonance", "balance"], false],
    ["  参考：位相なし＋順序依存", ["relay", "vanguard"], true]
  ];
  for (const [label, laws, phaseless] of cases) {
    const m = measure(shape(laws, phaseless), 12);
    console.log(`${label.padEnd(36)} ${(m.T1 * 100).toFixed(1).padStart(7)}% ${(m.selectionLoose * 100).toFixed(1).padStart(10)}% `
      + `${(m.permTight * 100).toFixed(1).padStart(10)}% ${(m.T3 * 100).toFixed(1).padStart(10)}% ${(m.ceiling * 100).toFixed(0).padStart(5)}%`);
  }
}
