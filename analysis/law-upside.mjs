// **どの法則の「上がる側」が、実際に効いているか。**
//
// この企画には、下がるだけの法則を置かないという決まりがある。
// 作者の指摘（法則機関 0.1）：「その分プラスの効果がないと、単に**ハズレルール**と感じてしまいます」。
// `analysis/smoke-laws.mjs` はそれを機械で守っている——**倍率1を超える条件が存在すること。**
//
// **存在することと、効くことは別だった。**作者が二度、独立に同じ形の不満を出した：
//
//   減衰：「減衰とダメージ上限のルール相性が悪く、理不尽に感じる」
//   単調：「反射を生かすには遮蔽が多数必要だけど、中途半端な数だと単調の『2つめは半分』にやられる。
//         **周期2以上だと5つ並べても最大2.5個で3個に届かない**ので、単調が単純なデメリットになっている」
//
// 二例目なので、法則ごとの事故ではなく**関門の穴**である。だから法則を一つずつ作者に訊くのをやめて、
// 13法則ぜんぶを同じ物差しにかける。物差しは3つ：
//
//   上がる  … 作動のうち、その法則の倍率が 1 を超えた割合
//   下がる  … 作動のうち、倍率が 1 を下回った割合
//   捨てられた … 上がった作動のうち、**その巡が1巡上限に張り付いていた**割合
//                （張り付いた巡では、倍率を上げても敵HPは1も減らない）
//
// **効いている上がる側 = 上がる × (1 − 捨てられた)。**これが小さい法則は、
// 遊ぶ側から見て「下がるだけ」である。
//
// 測る盤面は、**その法則を実際に載せている出荷版の敵**（`core/law-table.mjs`）。
// 法則は1つだけ動かす（組にすると倍率が掛け算になって、どちらの条件か分からなくなる）。
// 並びは**その戦闘に勝てるもの**だけを見る。遊ぶ側は負ける並びを採用しないので。

import { makeSimulate, makeLawRuleset, LAWS, LAW_IDS, RUN_LAW_IDS, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { makeRng } from "../core/rng.mjs";

const SAMPLE = Number(process.argv[2] || 1500);

// その法則を載せている組を全部集め、敵は中盤（第3戦）を使う。
function boardsFor(lawId) {
  return LAW_TABLE.filter(v => v.laws.includes(lawId)).map(v => {
    const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps);
    return { laws: v.laws, enemy: rules.ENEMIES[2], maxHp: rules.MAX_HP };
  });
}

function measure(lawId) {
  // **倍率を持たない法則は、この物差しでは測れない。**
  // 反射（巡回の終わりに遮蔽の半分を返す）と倍速（周期を縮める）は掛け算をしないので、
  // 作動ごとの gain が無い。0% と出すと「効いていない」に見えるが、そうではない。
  if (!LAWS[lawId].gain) return null;
  const boards = boardsFor(lawId);
  if (!boards.length) return null;
  const simulate = makeSimulate([lawId]);
  const types = Object.keys(PARTS);
  let up = 0, down = 0, flat = 0, upWasted = 0, wins = 0, tried = 0;
  boards.forEach(board => {
    const rng = makeRng(31 + lawId.length);
    for (let n = 0; n < SAMPLE; n += 1) {
      const order = Array.from({ length: SLOT_COUNT }, () => types[Math.floor(rng() * types.length)]);
      const r = simulate({
        slots: order.map((type, i) => ({ id: `x${i}`, type })),
        hp: board.maxHp, maxHp: board.maxHp, enemy: board.enemy, rng: makeRng(1)
      });
      tried += 1;
      // **勝てない並びは採用されない。**遊ぶ側が置く盤面だけを数える。
      if (!r.won) continue;
      wins += 1;
      // 巡ごとに、通った合計が1巡上限に届いたか（＝そこから先は倍率が無意味）。
      const perCycle = new Map();
      let prev = board.enemy.hp;
      (r.log || []).forEach(e => {
        if (!e.after) return;
        perCycle.set(e.cycle, (perCycle.get(e.cycle) || 0) + Math.max(0, prev - e.after.enemyHp));
        prev = e.after.enemyHp;
      });
      const cap = board.enemy.cycleCap || board.enemy.hp;
      (r.log || []).forEach(e => {
        if (e.gain === undefined) return;
        if (e.gain > 1) {
          up += 1;
          if ((perCycle.get(e.cycle) || 0) >= cap) upWasted += 1;
        } else if (e.gain < 1) down += 1;
        else flat += 1;
      });
    }
  });
  const acts = up + down + flat;
  if (!acts) return null;
  const upRate = up / acts, downRate = down / acts;
  const wasted = up ? upWasted / up : 0;
  return {
    id: lawId, name: LAWS[lawId].name, boards: boards.length,
    winRate: tried ? wins / tried : 0,
    up: upRate, down: downRate, wasted, live: upRate * (1 - wasted)
  };
}

const rows = LAW_IDS.map(measure).filter(Boolean).sort((a, b) => a.live - b.live);
console.log("法則     載る組  上がる  下がる  上がった分が上限で捨てられた  **効いている上がる側**");
rows.forEach(r => console.log(
  `  ${r.name.padEnd(6)}${String(r.boards).padStart(4)}`
  + `${(r.up * 100).toFixed(1).padStart(8)}%${(r.down * 100).toFixed(1).padStart(7)}%`
  + `${(r.wasted * 100).toFixed(1).padStart(24)}%${(r.live * 100).toFixed(1).padStart(12)}%`));

// **どこで切るかは、ここでは決めない。**まず並べて、作者と決める。
// ただし「上がる側が下がる側より小さい」法則は、名指しできる。
const oneSided = rows.filter(r => r.live < r.down && RUN_LAW_IDS.includes(r.id));
console.log(`\n下がる側の方が大きい法則（ランに出すもののうち）：${oneSided.length}件`);
oneSided.forEach(r => console.log(
  `  ${r.name}：効いている上がる側 ${(r.live * 100).toFixed(1)}% ＜ 下がる ${(r.down * 100).toFixed(1)}%`));
const noGain = LAW_IDS.filter(id => !LAWS[id].gain).map(id => LAWS[id].name);
console.log(`\n※ 倍率を持たない法則（${noGain.join("・")}）は、この物差しでは測れない。`);
console.log(`   掛け算をしないので作動ごとの倍率が無い。0% と出したら嘘になるので外してある。`);
console.log(`※ 表に載っていない法則（どの組にも採られていない）も出ていない。`);
