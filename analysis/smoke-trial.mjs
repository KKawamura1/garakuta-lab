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

const trial = TRIALS.t3;
const specs = trial.sides.map(s => ({ key: s.key, spec: sideSpec(trial.id, s.key) }));

// 3. まず遊べること。
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
  if (count("strike") < 3 || count("guard") < 2) fail(`${key} の初期手札が契約を満たさない`);
});

// 1と2。**測ってから比べる。**
const measured = specs.map(({ key, spec }) => ({ key, m: measure(spec, RUNS) }));
const [a, b] = measured;

// 操作したかった差：順序が効くか。**ここが離れていないと、対そのものが無意味。**
const orderGap = Math.abs(a.m.T3 - b.m.T3);
if (orderGap < 0.25) {
  fail(`順序が効く割合の差が小さすぎる（${(a.m.T3 * 100).toFixed(0)}% 対 ${(b.m.T3 * 100).toFixed(0)}%）。対になっていない`);
}
const free = measured.find(x => x.m.T3 < 0.1);
if (!free) fail("順序が効かない側が無い（どちらも順序が効いている）");

// 揃えるべき量：詰みなしと、選択に勝目があるか。
// **ここがずれていると、差が出ても「順序のせい」と言えない。**
if (Math.abs(a.m.T1 - b.m.T1) > 0.10) {
  fail(`詰みなし率が揃っていない（${(a.m.T1 * 100).toFixed(0)}% 対 ${(b.m.T1 * 100).toFixed(0)}%）`);
}
if (Math.abs(a.m.selectionLoose - b.m.selectionLoose) > 0.20) {
  fail(`選択に勝目がある割合が揃っていない（${(a.m.selectionLoose * 100).toFixed(0)}% 対 ${(b.m.selectionLoose * 100).toFixed(0)}%）`);
}
// どちらも詰みだらけでないこと（破る側も遊べる、の数値版）。
measured.forEach(({ key, m }) => {
  if (m.T1 < 0.90) fail(`${key} は詰みが多すぎる（詰みなし ${(m.T1 * 100).toFixed(0)}%）`);
  if (m.selectionLoose < 0.20) fail(`${key} は選べる部品が少なすぎる（勝目のある選択 ${(m.selectionLoose * 100).toFixed(0)}%）`);
});

// 順序は種で入れ替わること（順序効果の相殺）。
const even = sideOrder(trial.id, 2).join(">");
const odd = sideOrder(trial.id, 3).join(">");
if (even === odd) fail("種を変えても出す順序が入れ替わらない");

console.log(`trial smoke: ${trial.id} の対が成立（順序が効く ${(a.m.T3 * 100).toFixed(0)}% 対 ${(b.m.T3 * 100).toFixed(0)}%、`
  + `詰みなし ${(a.m.T1 * 100).toFixed(0)}%/${(b.m.T1 * 100).toFixed(0)}%、`
  + `選択に勝目 ${(a.m.selectionLoose * 100).toFixed(0)}%/${(b.m.selectionLoose * 100).toFixed(0)}%） OK`);
