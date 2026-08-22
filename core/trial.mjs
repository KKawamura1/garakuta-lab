// 対にして出す試行（Recall テスト）。
//
// **P は仮説であって守るべきルールではない**（`agents/HYPOTHESIS_TESTING.md`）。
// 条件を満たす版が面白いかだけでなく、**満たさない版がつまらないか**も測らないと、
// その条件が必要だとは言えない。ここは「破った版」を作るための場所である。
//
// 破る版は**壊れたゲームであってはいけない。** 壊れたものがつまらないのは当たり前で、
// それでは仮説の検証にならない。破る条件以外は、両方とも同じ水準に揃える
// （`analysis/match-pair.mjs` で敵の数値を寄せ、`analysis/smoke-trial.mjs` が機械で見張る）。

import { BASE } from "./laws.mjs";

// **対の敵の数値は、表から取らない。**
// 最初は `LAW_TABLE[0]` を土台にしていたが、調律し直すたびに表の中身が変わり、
// **実験そのものが黙って動いた**（2026-08-22、表を作り直したら対の詰みなし率が100%→83%へ）。
// 実験は、他の作業に揺さぶられてはいけない。素の敵の数値だけを土台にする。
const BATTLES = 3;
const FLAT = BASE.map(() => 1);
const CYCLE_CAPS = BASE.map(e => Math.max(4, Math.round(e.hp / 3)));

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
  // T3「並び順が効く」。**企画の出発点そのものなのに、一度も破って試していない。**
  //
  // 【第1版の失敗（2026-08-22）】位相と法則を**同時に**変えていた
  // （A=位相あり＋継電＋先陣／B=位相なし＋共鳴＋均衡）。2組とも A が選ばれたが、
  // 作者の理由は「①ルールが均衡なのに均衡を達成する手段がない ②2ターン目の強攻撃を耐える手段が無い」で、
  // **操作した変数（並び順）とは別の理由**だった。どちらが効いたか言えないので、対として無効。
  // （均衡は実測で**34%の局面で達成不能**だった。初期手札の契約が撃3・守2しか保証せず、
  //   整が1枚も来ないことがあるため。）
  //
  // 【第2版】**法則は両側とも同じ（蓄積＋過負荷）。位相の有無だけが違う。**
  // 揃えた量：詰みなし 100%/100%、選択に勝目 81%/81%
  // 離した量：順序が効く 38%/1%
  t3: {
    id: "t3",
    question: "並び順が効くことは、面白さの条件か",
    battles: BATTLES,
    sides: [
      { key: "order-matters", laws: ["buildup", "overload"], phaseless: false, hpScale: 1 },
      { key: "order-free", laws: ["buildup", "overload"], phaseless: true, hpScale: 0.55 }
    ]
  }
};

export function sideSpec(trialId, sideKey) {
  const trial = TRIALS[trialId];
  const side = trial.sides.find(s => s.key === sideKey);
  return {
    laws: side.laws,
    scales: FLAT.map(v => v * side.hpScale),
    atkScales: FLAT,
    modScales: FLAT,
    cycleCaps: CYCLE_CAPS,
    phaseless: side.phaseless,
    enemyCount: trial.battles
  };
}

// どちらを先に出すかは種で決める。**順序効果を相殺するため、伏せて入れ替える。**
export function sideOrder(trialId, seed) {
  const keys = TRIALS[trialId].sides.map(s => s.key);
  return seed % 2 === 0 ? keys : [...keys].reverse();
}
