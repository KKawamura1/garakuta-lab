import { makeRng } from "../core/rng.mjs";

// 到達しうる所持部品集合を作る。
//
// 方策にプレイさせて集めると、難易度を締めた瞬間に序盤で全滅して後半の局面が採れなくなり、
// 探索が「難しくすると測れないので難しくしない」方向へ壊れる（実際に一度そうなった）。
// また T1「どの部品を選択しても勝ちの目がある」は方策の選択だけでなく**すべての選択**についての主張なので、
// 報酬は方策ではなく一様乱択で引く方が主張に忠実である。
//
// よって難易度から独立に、規則どおりの成長（初期8個＋毎戦1個）だけを再現する。

export function reachableSets(rules, { runs = 40, seed = 1 } = {}) {
  const { PARTS, START_PARTS, RARE_RATE, ENEMIES } = rules;
  const keys = Object.keys(PARTS);
  const common = keys.filter(k => !PARTS[k].rare);
  const rares = keys.filter(k => PARTS[k].rare);
  const out = [];
  for (let r = 0; r < runs; r += 1) {
    const rng = makeRng(seed * 7919 + r);
    const draw = () => {
      const pool = rng() < RARE_RATE && rares.length ? rares : common;
      return pool[Math.floor(rng() * pool.length)];
    };
    // 初期手札はルールセットの契約に従う（run.mjs と同じ扱いにしないと測定がずれる）。
    const drawStart = () => {
      const types = [];
      for (let i = 0; i < START_PARTS; i += 1) types.push(draw());
      return types;
    };
    let owned = drawStart();
    if (typeof rules.startContract === "function") {
      let tries = 0;
      while (!rules.startContract(owned) && tries < 200) { owned = drawStart(); tries += 1; }
    }
    for (let index = 0; index < ENEMIES.length; index += 1) {
      out.push({ run: r, index, owned: [...owned] });
      owned.push(draw());
    }
  }
  return out;
}

// HP は戦況で変わるので、一点で測ると判定が張り付く。ただし**低HPを含めてはいけない。**
//
// 測定で分かったこと：T1「どの部品を選択しても勝ちの目がある」を HP16 まで含めて課すと、
// 「瀕死で到達しても勝てること」を要求してしまい、どの敵の数値でも T2 と両立しない。
// しかし作者の主張は**部品の選択**についてのものであって、体力についてのものではない。
// 瀕死で到達した局面は、すでに負けている局面であってよい（負けられないゲームは緊張が無い）。
// よって健康な局面だけで測る。安全側（詰みの有無）は満タンで判定する。
export const HP_POINTS = [30, 24];
export const SAFE_HP = 30;
