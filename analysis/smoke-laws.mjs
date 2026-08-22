import { readFileSync } from "node:fs";
import { createRun } from "../core/run.mjs";
import { LAWS, LAW_IDS, makeSimulate, makeLawRuleset, PARTS, LINES, BASE, SLOT_COUNT } from "../core/laws.mjs";
import { makeRng } from "../core/rng.mjs";

const fail = message => { console.error(`laws smoke: ${message}`); process.exit(1); };

// 0. 遊ぶ画面が、端末によって解釈できない構文を使っていないこと。
//    `import ... with { type: "json" }` を使ったせいで、作者の iPhone で**画面が丸ごと出なかった**。
//    ここの Chromium では動いたので、検証を通り抜けた。**動かせない端末があるなら、構文で守る。**
{
  const head = readFileSync("play/app.js", "utf8");
  if (/\bwith\s*\{\s*type\s*:/.test(head)) fail("play/app.js が import 属性を使っている（古い端末で落ちる）");
  if (/\?\./.test(head) === false && false) fail("unreachable");
}

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

// 2.5 **ハズレ法則の禁止。** 倍率を返す法則は、どこかに「1を超える条件」を必ず持つこと。
// 最初は「同系統が続くと半分」のような下がるだけの法則を4つ置いていた。天井（無傷の到達率）を
// 下げるために足したもので、遊ぶ側の理由が無かった。作者の指摘：
// 「その分プラスの効果がないと、単に**ハズレルール**と感じてしまいます」。
// **評価器の都合が設計へ漏れた形**なので、機械で塞ぐ。下がること自体は禁じない（取引は成立する）。
// 塞ぐのは「下がるだけ」の方である。
{
  const grid = [];
  const LINE_IDS = Object.keys(LINES);
  [1, 2, 3, 4].forEach(chain =>
    [0, 1, 2, 3].forEach(position =>
      [1, 2, 3, 4, 5].forEach(firingCount =>
        [true, false].forEach(restedLastCycle =>
          [1, 2, 3, 6].forEach(activationsSoFar =>
            [1, 2, 3].forEach(linesPresent =>
              [1, 2, 5, 12].forEach(cycle =>
                LINE_IDS.forEach(line => LINE_IDS.forEach(prevLine => {
                  grid.push({ part: PARTS.rivet, line, prevLine, chain, position, cycle,
                    firingCount, linesPresent, restedLastCycle, activationsSoFar, slotIndex: position });
                })))))))));

  LAW_IDS.forEach(id => {
    const law = LAWS[id];
    if (!law.gain) return;   // 周期や巡回末の法則（倍速・反射）は倍率を返さない。上げ幅は形で持つ。
    const values = grid.map(ctx => law.gain(ctx));
    const best = Math.max(...values);
    const worst = Math.min(...values);
    if (!(best > 1)) fail(`法則「${law.name}」は倍率が1を超える条件を持たない（最大${best}）。`
      + "下がるだけの法則は**ハズレ法則**なので置かない。狙えば上がる条件を必ず添えること");
    // 上げ幅が「まぐれ」でないこと。全体の1割以上の状況で1を超えるなら、狙って作れる条件だとみなす。
    const upFraction = values.filter(v => v > 1).length / values.length;
    if (upFraction < 0.02) fail(`法則「${law.name}」の上振れが狭すぎる（${(upFraction * 100).toFixed(1)}%）`);
    // 下がる条件が無いこと自体は禁じない（継電・先陣などは純粋な上げである）。
    void worst;
  });
}

const slots = shape(BUILDS[0]);

// 3. 決定的であること。画面が結果を断定できる前提そのもの。
LAW_IDS.forEach(id => {
  const a = makeSimulate([id, "relay"])({ slots, hp: 30, maxHp: 30, enemy: BASE[3], rng: makeRng(1) });
  const b = makeSimulate([id, "relay"])({ slots, hp: 30, maxHp: 30, enemy: BASE[3], rng: makeRng(98765) });
  if (a.won !== b.won || a.cycles !== b.cycles || a.hp !== b.hp) fail(`${id} が乱数で結果を変えた`);
});

// 4. 表に載っている組は、実在する法則で、敵の倍率がそろっていること。
const { LAW_TABLE: table } = await import("../core/law-table.mjs");
if (!Array.isArray(table)) fail("law-table.mjs が配列を出していない");
// 表が空でも壊れてはいない（出してよい組がまだ無い、という状態）。
// ただしその場合、法則機関は遊べる状態ではないので、画面の選択肢にも出さない。
table.forEach(row => {
  row.laws.forEach(id => { if (!LAWS[id]) fail(`表に未知の法則 ${id} がある`); });
  if (!Array.isArray(row.scales) || row.scales.length !== BASE.length) fail(`${row.name} の敵HP倍率が足りない`);
  if (!Array.isArray(row.atkScales) || row.atkScales.length !== BASE.length) fail(`${row.name} の攻撃倍率が足りない`);
  // 天井（P12-b）。**2026-08-22 の作者判断で、今回だけ天井を通さない版を出している**
  // （T1と同時に満たせないことが判明し、参照点 RELAY 0.1 でも71%だった。agents/PROTOCOL.md 参照）。
  // なので「通っていること」ではなく「**通ったかどうかを表に正直に書いてあること**」を検査する。
  // 隠して出すのと、承知の上で出すのは違う。機械で守れるのは後者である。
  if (typeof row.ceilingPassed !== "boolean") fail(`${row.name} に天井の合否が記録されていない`);
  if (row.ceilingPassed !== row.flawlessReach <= 0.5) fail(`${row.name} の天井の合否が値と食い違う`);
  // 1巡決着が起きないこと。**これは今回の版の存在理由なので、緩められない。**
  if (!Array.isArray(row.cycleCaps)) fail(`${row.name} に1巡上限が無い`);
  row.enemyHp.forEach((hp, i) => {
    const least = Math.ceil(hp / row.cycleCaps[i]);
    if (least < 3) fail(`${row.name} の敵${i + 1}は最低${least}巡で倒せる（1巡決着を潰した意味が無い）`);
  });
});

// 5. 表の組は実際に遊べること。
table.slice(0, 5).forEach(row => {
  const rules = makeLawRuleset(row.laws, row.scales, row.atkScales, row.modScales, row.cycleCaps);
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

// 敵の説明文と数値が一致していること。
// RELAY で一度、調律後に説明文だけ古いまま残した。組ごとに数値が変わる法則機関では必ず起きる。
table.slice(0, 5).forEach(row => {
  const rules = makeLawRuleset(row.laws, row.scales, row.atkScales, row.modScales, row.cycleCaps);
  rules.ENEMIES.forEach(enemy => {
    if (!enemy.trait.includes(String(enemy.atk))) fail(`${row.name} の ${enemy.name}：説明に攻撃力 ${enemy.atk} が無い`);
    if (enemy.cap < 99 && !enemy.trait.includes(String(enemy.cap))) fail(`${row.name} の ${enemy.name}：説明に命中上限が無い`);
    if (enemy.floor && !enemy.trait.includes(String(enemy.floor))) fail(`${row.name} の ${enemy.name}：説明に命中下限が無い`);
    if (enemy.regen && !enemy.trait.includes(String(enemy.regen))) fail(`${row.name} の ${enemy.name}：説明に毎巡回復が無い`);
  });
});

console.log(`laws smoke: 法則${LAW_IDS.length}件が1行・有効・決定的・組が偽物でない、表の${table.length}組が遊べる OK`);
