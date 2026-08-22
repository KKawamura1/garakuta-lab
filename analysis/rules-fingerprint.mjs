// 規則の指紋。**版を上げ忘れたことを機械で見つけるためのもの。**
//
// 2026-08-22、1巡上限を入れて偏食を削って天井を外したのに、版は laws-0.1 のままだった。
// 作者の指摘：「いま0.1→0.2という事実が、これまで何度もこれを見落としていたことを物語っています」。
// **版の文字列は記録を分離するために置いてあるので、据え置くと記録が混ざる。**
//
// テキストの hash ではなく**挙動の hash** を取る。ファイルの hash だと
// コメントを直しただけで鳴り、意味の無い版上げを覚えてしまう。
// 決まった盤面を決まった順に戦わせ、その結果だけを畳み込む。
// **遊ぶ側から見て何かが変わったときにだけ変わる。**

import { createHash } from "node:crypto";
import { makeSimulate, scaleEnemies, LAW_IDS, LAWS, PARTS, BASE, SLOT_COUNT } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { makeRng } from "../core/rng.mjs";

const BUILDS = [
  ["rivet", "flurry", "twin", "thin", "thick"],
  ["rivet", "thin", "feed", "twin", "thick"],
  ["hammer", "collapse", "deflect", "loop", "auger"],
  ["thin", "thick", "deflect", "rivet", "feed"]
];

export function fingerprint() {
  const h = createHash("sha256");
  // 1. 法則そのもの：どの法則が、どの盤面でどう効くか。
  //    法則を足す・消す・効果を変えると変わる。名前や説明文を直しても変わる（遊ぶ側に見えるので）。
  LAW_IDS.forEach(id => {
    h.update(`${id}|${LAWS[id].name}|${LAWS[id].desc}`);
    [[], [id]].forEach(set => {
      const sim = makeSimulate(set, { phaseless: false });
      BUILDS.forEach(build => scaleEnemies(1, 1, 1).forEach(enemy => {
        const r = sim({ slots: build.map((t, i) => ({ id: `x${i}`, type: t })),
          hp: 30, maxHp: 30, enemy, rng: makeRng(1) });
        h.update(`${r.won}:${r.cycles}:${r.hp}:${r.enemyHp}`);
      }));
    });
  });
  // 2. 部品：効果を変えたら、同じ並びでも別のゲームになる。
  Object.entries(PARTS).forEach(([k, p]) => h.update(`${k}|${p.name}|${p.line}|${p.period}`));
  // 3. 敵の素の数値と、出している表（＝実際に遊ぶ難易度）。
  BASE.forEach(e => h.update(JSON.stringify([e.name, e.hp, e.atk, e.atkPeriod, e.cap, e.floor, e.regen])));
  LAW_TABLE.forEach(row => h.update(JSON.stringify([row.laws, row.enemyHp, row.atkScales, row.modScales, row.cycleCaps])));
  h.update(`slots:${SLOT_COUNT}`);
  return h.digest("hex").slice(0, 12);
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(fingerprint());
