import { readFileSync } from "node:fs";
import { createRun } from "../core/run.mjs";
import { LAWS, LAW_IDS, makeSimulate, makeLawRuleset, PARTS, BASE, SLOT_COUNT } from "../core/laws.mjs";
import { makeRng } from "../core/rng.mjs";

const fail = message => { console.error(`laws smoke: ${message}`); process.exit(1); };

// 1. 法則は1行で書けること（読む重さの上限。「読むのは機械、探すのは人」）。
Object.entries(LAWS).forEach(([id, law]) => {
  if (!law.name || !law.desc) fail(`${id} に名前か説明が無い`);
  if (law.desc.includes("\n") || law.desc.length > 52) fail(`${id} の説明が長い（${law.desc.length}字）`);
  if (!law.gain && !law.order && !law.endOfCycle && !law.period) fail(`${id} は何もしていない`);
});

// 2. どの法則も、実際に結果を変えること。変えない法則は表に載せてはいけない。
// 一つの並びでは全部の法則を試せない（継電は系統が連ならないと発火せず、
// 均衡は3系統そろわないと発火しない）。**法則ごとに、効く形の並びを含む複数の盤面で試す。**
const BUILDS = [
  ["rivet", "flurry", "twin", "thin", "thick"],     // 撃が連なる
  ["rivet", "thin", "feed", "twin", "thick"],       // 3系統そろう
  ["hammer", "collapse", "deflect", "loop", "auger"], // 周期が長い
  ["thin", "thick", "deflect", "rivet", "feed"]     // 守が連なる
];
const shape = build => build.map((t, i) => ({ id: `s${i}`, type: t }));
const playAll = ids => BUILDS.flatMap(build => BASE.slice(0, 4).map(enemy =>
  makeSimulate(ids)({ slots: shape(build), hp: 30, maxHp: 30, enemy, rng: makeRng(1) })));
const plain = playAll([]);
LAW_IDS.forEach(id => {
  const withLaw = playAll([id]);
  const changed = withLaw.some((r, i) => r.won !== plain[i].won || r.cycles !== plain[i].cycles
    || r.hp !== plain[i].hp || r.enemyHp !== plain[i].enemyHp);
  if (!changed) fail(`法則「${LAWS[id].name}」はどの盤面でも結果を変えない`);
});
// 組が、片方の法則だけの場合と同じ結果になってはいけない。
// 「他の法則があって初めて意味を持つ法則」は、組の多様性を偽装する（逆順がそうだった）。
for (let i = 0; i < LAW_IDS.length; i += 1) {
  for (let j = i + 1; j < LAW_IDS.length; j += 1) {
    const pair = playAll([LAW_IDS[i], LAW_IDS[j]]);
    const onlyA = playAll([LAW_IDS[i]]);
    const onlyB = playAll([LAW_IDS[j]]);
    const identical = other => pair.every((r, n) => r.won === other[n].won && r.cycles === other[n].cycles
      && r.hp === other[n].hp && r.enemyHp === other[n].enemyHp);
    if (identical(onlyA) || identical(onlyB)) {
      fail(`「${LAWS[LAW_IDS[i]].name}＋${LAWS[LAW_IDS[j]].name}」が片方だけの場合と同じ結果になる`);
    }
  }
}

const slots = shape(BUILDS[0]);

// 3. 決定的であること。画面が結果を断定できる前提そのもの。
LAW_IDS.forEach(id => {
  const a = makeSimulate([id, "relay"])({ slots, hp: 30, maxHp: 30, enemy: BASE[3], rng: makeRng(1) });
  const b = makeSimulate([id, "relay"])({ slots, hp: 30, maxHp: 30, enemy: BASE[3], rng: makeRng(98765) });
  if (a.won !== b.won || a.cycles !== b.cycles || a.hp !== b.hp) fail(`${id} が乱数で結果を変えた`);
});

// 4. 表に載っている組は、実在する法則で、敵の倍率がそろっていること。
const table = JSON.parse(readFileSync("core/law-table.json", "utf8"));
if (!Array.isArray(table)) fail("law-table.json が配列でない");
// 表が空でも壊れてはいない（出してよい組がまだ無い、という状態）。
// ただしその場合、法則機関は遊べる状態ではないので、画面の選択肢にも出さない。
table.forEach(row => {
  row.laws.forEach(id => { if (!LAWS[id]) fail(`表に未知の法則 ${id} がある`); });
  if (!Array.isArray(row.scales) || row.scales.length !== BASE.length) fail(`${row.name} の敵HP倍率が足りない`);
  if (!Array.isArray(row.atkScales) || row.atkScales.length !== BASE.length) fail(`${row.name} の攻撃倍率が足りない`);
  // 天井の条件（P12-b）。第10回はこれを見ずに出して、1ランで天井を失った。
  if (row.flawlessReach > 0.5) fail(`${row.name} の天井が近い（${row.flawlessReach}）`);
});

// 5. 表の組は実際に遊べること。
table.slice(0, 5).forEach(row => {
  const rules = makeLawRuleset(row.laws, row.scales, row.atkScales);
  const run = createRun({ seed: 3, playerId: "smoke", ruleset: rules });
  const observation = run.observe();
  if (observation.slots.length !== SLOT_COUNT) fail(`${row.name} の枠数が違う`);
  observation.inventory.slice(0, SLOT_COUNT).forEach((part, i) => {
    const result = run.act({ type: "place", partId: part.id, slot: i + 1 });
    if (!result.ok) fail(`${row.name} で配置が弾かれた: ${result.error}`);
  });
  const battle = run.act({ type: "battle", prediction: "勝てそう", worry: "なし", worryText: "" });
  if (!battle.ok) fail(`${row.name} で戦闘が弾かれた: ${battle.error}`);
  if (!battle.battle.grade) fail(`${row.name} に等級が付かない`);
  // 初期手札の契約（撃3・守2）。これが無いと生成条件が両立しない。
  const count = line => observation.inventory.filter(p => PARTS[p.type].line === line).length;
  if (count("strike") < 3 || count("guard") < 2) fail(`${row.name} の初期手札が契約を満たさない`);
});

console.log(`laws smoke: 法則${LAW_IDS.length}件が1行・有効・決定的・組が偽物でない、表の${table.length}組が遊べる OK`);
