// 対が、対として成立していることを機械で見張る。
//
// **Recall テストの版は「条件を破っただけ」であって、壊れたゲームであってはいけない。**
// 壊れたものがつまらないのは当たり前で、それでは仮説の検証にならない。
// ここで見るのは次の3つ。
//   1. 揃えるべき量が揃っている（詰みなし・選択に勝目）
//   2. 操作したかった量だけが離れている（順序が効く）
//   3. どちらの側も、ちゃんと遊べる
//
// 揃わなくなったら落ちる。**気づかずに片側だけ難しい対を作者へ出すことを防ぐ。**

import { createRun } from "../core/run.mjs";
import { makeLawRuleset, SLOT_COUNT, PARTS } from "../core/laws.mjs";
import { TRIALS, sideSpec, sideOrder } from "../core/trial.mjs";
import { measure } from "./pair-check.mjs";

const fail = m => { console.error(`trial smoke: ${m}`); process.exit(1); };
const RUNS = 8;   // 検査なので粗く。傾向が逆転したら気づける程度で足りる

// 対ごとに、何を揃えて何を離すかは違う。**それも一緒に書いておく。**
const EXPECT = {
  t3: { separate: "T3", label: "順序が効く", minGap: 0.25, match: ["T1", "selectionLoose"] },
  t2: { separate: "overall", label: "勝てる並び", minGap: 0.25, match: ["T1"] },
  ceiling: { separate: "ceiling", label: "天井", minGap: 0.40, match: ["T1", "overall"] }
};

for (const trial of Object.values(TRIALS)) {
  const want = EXPECT[trial.id];
  if (!want) fail(`${trial.id} に「何を揃えて何を離すか」が書かれていない`);
  const specs = trial.sides.map(s => ({ key: s.key, spec: sideSpec(trial.id, s.key) }));

  // まず、どちらの側もちゃんと遊べること。
  // **破った版が壊れたゲームなら、つまらないのは当たり前で、仮説の検証にならない。**
  specs.forEach(({ key, spec }) => {
    const rules = makeLawRuleset(spec.laws, spec.scales, spec.atkScales, spec.modScales, spec.cycleCaps,
      { phaseless: spec.phaseless, enemyCount: spec.enemyCount });
    if (rules.ENEMIES.length !== trial.battles) fail(`${key} の戦闘数が ${rules.ENEMIES.length}（要 ${trial.battles}）`);
    const run = createRun({ seed: 7, playerId: "smoke", ruleset: rules });
    const o = run.observe();
    o.inventory.slice(0, SLOT_COUNT).forEach((part, i) => {
      if (!run.act({ type: "place", partId: part.id, slot: i + 1 }).ok) fail(`${key} で配置が弾かれた`);
    });
    const battle = run.act({ type: "battle", prediction: "勝てそう", worry: "なし", worryText: "" });
    if (!battle.ok) fail(`${key} で戦闘が弾かれた: ${battle.error}`);
    const count = line => o.inventory.filter(p => PARTS[p.type].line === line).length;
    if (count("strike") < 3 || count("guard") < 2 || count("service") < 1) {
      fail(`${key} の初期手札が契約を満たさない`);
    }
  });

  const measured = specs.map(({ key, spec }) => {
    const m = measure(spec, RUNS);
    m.overall = m.selectionLoose * m.permTight;   // 登録文の「勝てる並びの割合」
    return { key, m };
  });
  const [a, b] = measured;

  // 操作したかった差が、実際に離れていること。
  const gap = Math.abs(a.m[want.separate] - b.m[want.separate]);
  if (gap < want.minGap) {
    fail(`${trial.id}：${want.label}の差が小さすぎる`
      + `（${(a.m[want.separate] * 100).toFixed(0)}% 対 ${(b.m[want.separate] * 100).toFixed(0)}%）。対になっていない`);
  }

  // 揃えるべき量が揃っていること。**ここがずれると、差が出ても操作のせいと言えない。**
  want.match.forEach(key => {
    const d = Math.abs(a.m[key] - b.m[key]);
    const tol = key === "T1" ? 0.10 : 0.20;
    if (d > tol) {
      fail(`${trial.id}：${key} が揃っていない`
        + `（${(a.m[key] * 100).toFixed(0)}% 対 ${(b.m[key] * 100).toFixed(0)}%、許容 ${tol * 100}pt）`);
    }
  });

  // どちらの側も、詰みだらけでも選べなさすぎでもないこと。
  measured.forEach(({ key, m }) => {
    if (m.T1 < 0.90) fail(`${trial.id}/${key} は詰みが多すぎる（詰みなし ${(m.T1 * 100).toFixed(0)}%）`);
    if (m.selectionLoose < 0.20) fail(`${trial.id}/${key} は選べる部品が少なすぎる（${(m.selectionLoose * 100).toFixed(0)}%）`);
  });

  // 出す順序が種で入れ替わること（順序効果の相殺）。
  if (sideOrder(trial.id, 2).join(">") === sideOrder(trial.id, 3).join(">")) {
    fail(`${trial.id}：種を変えても出す順序が入れ替わらない`);
  }

  console.log(`trial smoke: ${trial.id} の対が成立（${want.label} `
    + `${(a.m[want.separate] * 100).toFixed(0)}% 対 ${(b.m[want.separate] * 100).toFixed(0)}%、`
    + `詰みなし ${(a.m.T1 * 100).toFixed(0)}%/${(b.m.T1 * 100).toFixed(0)}%） OK`);
}
