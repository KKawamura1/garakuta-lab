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
  },

  // T2「勝てる並びの割合が5〜15%」。**ここは既に反証寄りの記録がある。**
  //   PHASE 0.1 は勝てる並びが59〜100%（帯の遥か外）で、再プレイ 4,3,3,3。
  //   一方 GATE v2 を通した CYCLE 0.2 は再プレイ 1,1（「何しても勝てそう」）。
  //   ただしどちらも他の条件も違っていたので、ceteris paribus ではない。ここで揃えて試す。
  //
  // 法則も位相も両側で同じ（継電＋先陣）。**敵HPだけが違う。**
  // 実測：勝てる並び 10%（帯の中）対 52%（帯の外・30%の上限も超える）／詰みなし 95%/100%
  t2: {
    id: "t2",
    question: "正解が少ないことは、面白さの条件か",
    battles: BATTLES,
    sides: [
      { key: "tight", laws: ["relay", "vanguard"], phaseless: false, hpScale: 1.5 },
      { key: "loose", laws: ["relay", "vanguard"], phaseless: false, hpScale: 0.9 }
    ]
  },

  // 天井（P12-b）「最上位等級の1戦あたり到達率が50%未満」。
  //
  // **これは今日半日、私を止めた条件である。**満たせないと分かってゲームの側を作り直し、
  // 参照点 RELAY 0.1（作者評価5）でさえ71%だと分かって、ようやく関門の側を疑った。
  // 「必要条件の仮説」の棚に置いていたが、**増強の仮説だった可能性が高い**（0節）。
  //
  // 天井は敵HPと強く結びついていて（HPが低いほど速く倒せて無傷になる）、
  // 勝率を保ったまま天井だけ動かす点は**探した中で1組しか無かった。**
  // 攻撃力とHPを同時に振り、勝てる並びを揃えて天井だけを離す。
  //
  // 実測：詰みなし 95%/96%、勝てる並び 19%/14%、**天井 89% 対 18%**
  ceiling: {
    id: "ceiling",
    question: "最上位の等級が遠いことは、また遊びたくなる条件か",
    battles: BATTLES,
    sides: [
      { key: "ceiling-near", laws: ["resonance", "fade"], phaseless: false, hpScale: 0.5, atkScale: 3.2 },
      { key: "ceiling-far", laws: ["resonance", "fade"], phaseless: false, hpScale: 0.7, atkScale: 1.8 }
    ]
  },

  // **最上位の等級が「無傷」か「速さ」か。**
  //
  // 登録されている最上位は無傷（失点0）だが、作者の感情マーカーは全部**撃破巡回**を指していた：
  //   「巡数更新オウケーイ」「作戦勝ちで5ターン勝利！アツい」「さすがに理論値では？？」
  //   最良の瞬間：「何巡で達成するかも保存されてると途中で気づいて、記録をもっと詰めたくなったところ」
  // **何を最上位に置くかで、狙う対象が変わるのではないか。**
  //
  // これは「増強の仮説」であって必要条件ではない（0節）。生成条件には入れない。
  // 要素分解のうち (a)等級の基準 と (b)自己最高の持ち方 をまとめて片側にしている。
  // (c)「無傷を残すか消すか」は、この結果を見てから。
  //
  // 法則も敵も両側で同じ。**等級の付け方だけが違う。**
  // 珍しさは実測で揃えた：無傷 50.1%／7巡以内 46.0%（勝てた並びに占める割合）。
  speed: {
    id: "speed",
    question: "最上位の等級を「速さ」にすると、狙う気になるか",
    battles: BATTLES,
    sides: [
      { key: "grade-damage", laws: ["buildup", "overload"], phaseless: false, hpScale: 1, gradeBy: "damage" },
      { key: "grade-speed", laws: ["buildup", "overload"], phaseless: false, hpScale: 1, gradeBy: "speed" }
    ]
  }
};

export function sideSpec(trialId, sideKey) {
  const trial = TRIALS[trialId];
  const side = trial.sides.find(s => s.key === sideKey);
  return {
    laws: side.laws,
    scales: FLAT.map(v => v * side.hpScale),
    atkScales: FLAT.map(v => v * (side.atkScale ?? 1)),
    modScales: FLAT,
    cycleCaps: CYCLE_CAPS,
    phaseless: side.phaseless,
    gradeBy: side.gradeBy || "damage",
    enemyCount: trial.battles
  };
}

// どちらを先に出すかは、**その対を何組目に遊ぶかで厳密に交互にする。**
//
// 最初は種の偶奇で決めていたが、**3組とも同じ順序になった**（1/8で起こる）。
// 順序効果を相殺するために伏せて入れ替えているのに、偶然に任せると相殺できない。
// n が小さいほど偏る確率が高いので、**乱数ではなく数え上げで交互にする。**
// **どの対を出すかは、遊ぶ側に選ばせない。**
//
// リンクで `?trial=t2` のように指定していたが、**それだと何を検証中か分かってしまう。**
// 作者の指摘：「リンクで指定するのが若干イケてないですかね。私がなんの仮説検証を
// しているのか分かっちゃいますし。…私は無心でプレイするだけでいいと嬉しい」。
// 選ぶ手間も押し付けていた。
//
// 組数の少ない対から出す（同数なら乱択）。**均等に貯まるので、どれかだけ n が伸びない。**
export function pickTrial(doneByTrial = {}, rand = Math.random) {
  const ids = Object.keys(TRIALS);
  const least = Math.min(...ids.map(id => doneByTrial[id] || 0));
  const pool = ids.filter(id => (doneByTrial[id] || 0) === least);
  return pool[Math.floor(rand() * pool.length)];
}

export function sideOrder(trialId, playedCount = 0) {
  const keys = TRIALS[trialId].sides.map(s => s.key);
  return playedCount % 2 === 0 ? keys : [...keys].reverse();
}
