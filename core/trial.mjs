// 対にして出す試行（Recall テスト）。
//
// **P は仮説であって守るべきルールではない**（`agents/HYPOTHESIS_TESTING.md`）。
// 条件を満たす版が面白いかだけでなく、**満たさない版がつまらないか**も測らないと、
// その条件が必要だとは言えない。ここは「破った版」を作るための場所である。
//
// 破る版は**壊れたゲームであってはいけない。** 壊れたものがつまらないのは当たり前で、
// それでは仮説の検証にならない。破る条件以外は、両方とも同じ水準に揃える
// （`analysis/match-pair.mjs` で敵の数値を寄せ、`analysis/smoke-trial.mjs` が機械で見張る）。

import { LAW_TABLE } from "./law-table.mjs";

const base = LAW_TABLE[0];
const BATTLES = 3;

export const TRIALS = {
  // T3「並び順が効く」。**企画の出発点そのものなのに、一度も破って試していない。**
  //
  // 位相（周期Pの部品を枠iに置くと作動巡回がずれる）が「並び順が効く」の本体なので、
  // 法則を順序非依存にするだけでは足りず、位相そのものを外す必要がある。
  //
  // 操作チェックの実測（analysis/match-pair.mjs）：
  //   詰みなし   100% 対 100%   ← 揃えた
  //   選択に勝目  50% 対  57%   ← 揃えた
  //   順序が効く  50% 対   1%   ← これが操作したかった差
  t3: {
    id: "t3",
    question: "並び順が効くことは、面白さの条件か",
    battles: BATTLES,
    sides: [
      { key: "order-matters", laws: ["relay", "vanguard"], phaseless: false, hpScale: 1 },
      { key: "order-free", laws: ["resonance", "balance"], phaseless: true, hpScale: 0.6 }
    ]
  }
};

export function sideSpec(trialId, sideKey) {
  const trial = TRIALS[trialId];
  const side = trial.sides.find(s => s.key === sideKey);
  return {
    laws: side.laws,
    scales: base.scales.map(v => v * side.hpScale),
    atkScales: base.atkScales,
    modScales: base.modScales,
    cycleCaps: base.cycleCaps,
    phaseless: side.phaseless,
    enemyCount: trial.battles
  };
}

// どちらを先に出すかは種で決める。**順序効果を相殺するため、伏せて入れ替える。**
export function sideOrder(trialId, seed) {
  const keys = TRIALS[trialId].sides.map(s => s.key);
  return seed % 2 === 0 ? keys : [...keys].reverse();
}
