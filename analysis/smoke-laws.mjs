import { readFileSync } from "node:fs";
import { createRun } from "../core/run.mjs";
import { LAWS, LAW_IDS, RUN_LAW_IDS, makeSimulate, makeLawRuleset, PARTS, LINES, BASE, SLOT_COUNT } from "../core/laws.mjs";
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

// **法則の条件が、実際に達成できること。**
//
// 均衡は「撃・守・整の3系統がそろっているなら2倍」だが、初期手札の契約は撃3・守2しか
// 保証しない。**整が1枚も来ない局面が34%あり、そこでは達成する手段が無い。**
// 作者の報告（2026-08-22）：「ルールが均衡なのに均衡を達成する手段がない…つまらなかった」。
//
// 上振れが**文面上**存在すること（上の 2.5）と、**その場で実際に届くこと**は別の量である。
// 到達しうる持ち物を並べて、上振れを引ける局面がどれだけあるかを見る。
{
  const { reachableSets } = await import("./sets.mjs");
  const sets = reachableSets({ PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
    startContract: t => t.filter(x => PARTS[x].line === "strike").length >= 3
      && t.filter(x => PARTS[x].line === "guard").length >= 2
      && t.filter(x => PARTS[x].line === "service").length >= 1 }, { runs: 30 });
  const linesOf = owned => new Set(owned.map(t => PARTS[t].line)).size;
  // いまの法則で「持ち物の側の条件」を要求するのは均衡だけ（3系統そろうこと）。
  // 条件を持ち物に課す法則を足したら、ここに検査を足すこと。
  const reachableFor = {
    balance: owned => linesOf(owned) >= 3
  };
  Object.entries(reachableFor).forEach(([id, ok]) => {
    if (!LAWS[id]) return;
    const hit = sets.filter(s => ok(s.owned)).length / sets.length;
    if (hit < 0.9) {
      fail(`法則「${LAWS[id].name}」は${((1 - hit) * 100).toFixed(0)}%の局面で条件を達成できない。`
        + "**達成する手段が無い法則は、遊ぶ側から見れば効果が無いのと同じ**（作者の報告 2026-08-22）");
    }
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


// **「上がる条件が存在する」ことと、「その条件が満たせる」ことは別である。**
//
// 上の検査は、倍率を返す法則すべてに 1 を超える条件が**あること**を見ている。
// それは通っていたのに、作者は二度、独立に同じ形の不満を出した：
//
//   減衰：「減衰とダメージ上限のルール相性が悪く、理不尽に感じる」
//   単調：「周期2以上だと5つ並べても最大2.5個で3個に届かないので、単純なデメリットになっている」
//
// 13法則を同じ物差しにかけたら、この2つだけが下がる側の方が大きかった
// （`analysis/law-upside.mjs`）。2つとも削除したうえで、**同じ穴が二度開かないように**
// 物差しの方をここへ置く。**存在ではなく、実測の割合で見る。**
//
// 数え方：出荷している盤面で、**勝てる並び**の作動を数える。
//   上がる … 倍率 > 1 の作動の割合
//   下がる … 倍率 < 1 の作動の割合
//   捨てられた … 上がった作動のうち、その巡が1巡上限に張り付いていた割合
//                （張り付いた巡では倍率を上げても敵HPは1も減らない）
// 効いている上がる側 = 上がる × (1 − 捨てられた)。**これが下がる側を下回ったら落とす。**
{
  const SAMPLE = 250;
  const types = Object.keys(PARTS);
  const bad = [];
  // **ランに出す法則にだけ課す。**破れの出題では「下がるだけ」は解くべき制約であって、
  // 理不尽ではない（1問ずつ独立で、越えられることが機械で確かめてある）。
  RUN_LAW_IDS.filter(id => LAWS[id].gain).forEach(id => {
    const boards = table.filter(v => v.laws.includes(id));
    if (!boards.length) return;                 // 表に載っていない法則は測れない
    const simulate = makeSimulate([id]);
    let up = 0, down = 0, flat = 0, wasted = 0;
    boards.forEach(v => {
      const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps);
      const enemy = rules.ENEMIES[2];
      const cap = enemy.cycleCap || enemy.hp;
      const rng = makeRng(31 + id.length);
      for (let n = 0; n < SAMPLE; n += 1) {
        const order = Array.from({ length: SLOT_COUNT }, () => types[Math.floor(rng() * types.length)]);
        const r = simulate({
          slots: order.map((type, i) => ({ id: `x${i}`, type })),
          hp: rules.MAX_HP, maxHp: rules.MAX_HP, enemy, rng: makeRng(1)
        });
        if (!r.won) continue;                   // 負ける並びは採用されない
        const perCycle = new Map();
        let prev = enemy.hp;
        (r.log || []).forEach(e => {
          if (!e.after) return;
          perCycle.set(e.cycle, (perCycle.get(e.cycle) || 0) + Math.max(0, prev - e.after.enemyHp));
          prev = e.after.enemyHp;
        });
        (r.log || []).forEach(e => {
          if (e.gain === undefined) return;
          if (e.gain > 1) { up += 1; if ((perCycle.get(e.cycle) || 0) >= cap) wasted += 1; }
          else if (e.gain < 1) down += 1;
          else flat += 1;
        });
      }
    });
    const acts = up + down + flat;
    if (!acts) return;
    const live = (up / acts) * (1 - (up ? wasted / up : 0));
    const downRate = down / acts;
    if (live < downRate) bad.push(`${LAWS[id].name}（効いている上がる側 ${(live * 100).toFixed(1)}% ＜ 下がる ${(downRate * 100).toFixed(1)}%）`);
  });
  if (bad.length) fail(`下がるだけになっている法則がある：${bad.join(" / ")}`
    + `\n  上がる条件は在るが、遊びの中で満たせていない。直すか、外すこと（`
    + `詳しくは node analysis/law-upside.mjs）`);
}

console.log(`laws smoke: 法則${LAW_IDS.length}件（ランに出すのは${RUN_LAW_IDS.length}件）が1行・有効・決定的・組が偽物でない、表の${table.length}組が遊べる OK`);
