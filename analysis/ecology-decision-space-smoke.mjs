// **「考えて組むこと」が「運任せ」に勝つかを測る。**
//
// 2026-08-30、灰の遠征を無作為編成で回したところ、技能・反応・常設・装備を
// でたらめに埋めた編成の 67% が7区画を完走した。技能ごとの寄与も全20種が
// ±0.2区画（7区画中）に収まり、どれを選んでも結果が変わらなかった。
// 作者の「始終なにもわからん」は提示の問題ではなく、**知るべきことが実在しない**
// という状態を指していた。散文で気づけなかったので、機械へ移す。
//
// これは fun の判定ではない。**選択空間が退化していないかの足切り**であり、
// 「壊れているのに緑になる」ことを防ぐためにある（AGENTS.md「機械検査は
// 破綻の足切りに使い、fun判定には使わない」）。
//
// ## 何を測るか
//
// 編成ごとに **耐久倍率**（敵を一律何倍まで強くしても完走できるか）を二分探索で出す。
// 連続量なので、区画数のような粗い整数より細かく編成を区別できる。そのうえで：
//
//   知識の利得 = 探索で見つけた最良編成の耐久倍率 ÷ 無作為編成の中央値
//   運の幅     = 無作為編成の最良の耐久倍率       ÷ 無作為編成の中央値
//
// **比を見るのは、難度調整で通せないようにするため。** 敵を一律に強くすると
// 分子も分母も同じだけ下がるので、この比は動かない。「敵を強くしただけ」を
// 成功と誤認しない。同じ理由で、この関門は敵がどう作られるべきかについて
// 何も仮定しない（特定の対策を強いる敵を正解として埋め込まない）。
//
// ## 関門は3つ。**別々の条件なので、別々に落ちる。**
//
//   1. 遠征が理不尽でない  : 探索の最良編成は、出荷している難度（1.0倍）を完走できる
//   2. 雑な編成が通らない  : 無作為編成の耐久倍率の**中央値が 1.0 未満**
//   3. 考える幅がある      : 知識の利得 ≥ 2.0
//
// 1 が無いと 2 は「不可能にすれば通る」関門になり、2 が無いと 3 は
// 「幅は存在するがプレイヤーがその外に立っている」状態を見逃す。実際、
// 2026-08-30 の main はこの形だった（利得 2.11 倍で 3 は通るのに、無作為編成の
// 中央値が 1.11 倍あり、**出荷難度が編成系の効く帯の下にあった**）。
// 3 だけでは「編成系は壊れていないのに game が退屈」を検出できない。
//
// 閾値 2.0 は数字を見る前に決めた。1.0 は「出荷している難度そのもの」であって
// 選んだ値ではない。**通らないからといって動かさない**（AGENTS.md）。
//
// ## 関門自身の参照点
//
// 参照点の無い関門は、自分が壊れていることを教えてくれない（AGENTS.md）。
// **本番を測る前に、答えの分かっている content 2つへ同じ物差しをかける。**
//
//   陰性参照: 全技能・全装備が同一のクローン → 利得はちょうど 1.00 でなければならない。
//             ここが 1.00 を超えるなら、物差しが信号を捏造している。
//   陽性参照: 1種だけ明確に強い技能を混ぜる   → 利得は閾値を超えなければならない。
//             ここが超えないなら、物差しが実在する差を見落としている。
//
// どちらかが落ちたときに壊れているのは game ではなく**この検査**であり、
// 出力もそう言う。
//
// 長いので `analysis/check-all.sh` の SLOW_CHECKS 側。毎週と手動でだけ走る。

import assert from "node:assert/strict";
import { simulateBattle } from "../ecology/engine.mjs";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";
import { ENCOUNTERS } from "../ecology/content/index.mjs";
import { EQUIPMENT, SKILLS, freshLoadout, makeBattle } from "../ecology/playable-battles.mjs";

const ENGINE_OPTIONS = { equipmentBreaks: false, captureReplaySnapshots: false };
const ROSTER = ["warden", "mender", "lancer", "scout", "guardian"];

// 数字を見る前に決めた閾値。**通らないからといって動かさない**（AGENTS.md）。
const PREMIUM_GATE = 2.0;
// 出荷している難度。選んだ閾値ではなく、遊ばれている設定そのもの。
const SHIPPED_DIFFICULTY = 1.0;
// 陰性参照の許容。全編成が同一なのだから、ちょうど 1.00 のはず。
// 二分探索の刻みぶんだけ緩める。
const IDENTICAL_TOLERANCE = 1.001;

// 中央値が 1.0 のどちら側にあるかを言い切れる標本数が要る（AGENTS.md 検証5規則の3）。
// 足りないときは数字を出して「判定不能」で落とす。黙って通さない。
const RANDOM_SAMPLES = 48;
const BOOTSTRAP_ROUNDS = 2_000;
const GREEDY_SWEEPS = 2;
// 観測される耐久倍率は 2倍台まで。天井を高く取ると、決着しない長期戦を
// 何度も回して時間だけ食う（16倍で engine のイベント上限に当たった）。
const TOLERANCE_CEILING = 6;
const TOLERANCE_STEPS = 8;

// 敵側の素の値。難度を動かすたびにここから作り直す。
const BASE_ENEMIES = structuredClone(PLAYABLE_CONTENT.enemyActors);
const BASE_ENCOUNTERS = structuredClone(ENCOUNTERS);

// 敵の強さを一律 multiplier 倍にする。**定義の maxHp と encounter の初期hpを
// 同じ倍率で動かす。** 片方だけだと、敵が上限より低いHPで湧いて難度がずれる
// （engine は `hp: enemy.hp ?? enemyStats.maxHp` で初期HPを決めている）。
function setDifficulty(multiplier) {
  for (const [id, base] of Object.entries(BASE_ENEMIES)) {
    const actor = PLAYABLE_CONTENT.enemyActors[id];
    actor.maxHp = Math.max(1, Math.round(base.maxHp * multiplier));
    actor.might = Math.max(1, Math.round(base.might * multiplier));
  }
  for (let i = 0; i < ENCOUNTERS.length; i += 1) {
    for (let j = 0; j < ENCOUNTERS[i].enemies.length; j += 1) {
      const base = BASE_ENCOUNTERS[i].enemies[j];
      if (typeof base.hp === "number") {
        ENCOUNTERS[i].enemies[j].hp = Math.max(1, Math.round(base.hp * multiplier));
      }
    }
  }
}

// **決着しない戦闘は「その難度では完走できない」として扱う。**
// 敵を強くしていくと、どちらも倒しきれずイベント上限（4096）へ達する組が出る。
// 例外を握り潰すと本物の engine 欠陥まで消えるので、この上限だけを見て数える。
let eventLimitHits = 0;
function isEventLimit(error) {
  return error?.limit === "maxEventsPerBattle" || error?.diagnostics?.limit === "maxEventsPerBattle";
}

// 一遠征。**HPは区画をまたいで持ち越す**（画面側の `hp: state.hp` と同じ）。
// 途中で負けたら、そこまでの区画数と、取りこぼした敵HPを負の余裕として返す。
function playRun(loadout, multiplier) {
  setDifficulty(multiplier);
  let hp = {};
  let cleared = 0;
  let margin = 0;
  for (let stage = 1; stage <= ENCOUNTERS.length; stage += 1) {
    const battle = makeBattle(stage, ROSTER, loadout, "decision-space", {}, { hp });
    let result;
    try {
      result = simulateBattle(battle, PLAYABLE_CONTENT, ENGINE_OPTIONS);
    } catch (error) {
      if (!isEventLimit(error)) throw error;
      eventLimitHits += 1;
      return { completed: false, cleared, margin: margin - 1 };
    }
    const allies = result.actors.filter((actor) => actor.side === "ally");
    if (result.result !== "win") {
      const left = result.actors.filter((actor) => actor.side === "enemy" && actor.alive);
      margin -= left.reduce((sum, actor) => sum + Math.max(0, actor.hp), 0);
      return { completed: false, cleared, margin };
    }
    cleared += 1;
    hp = Object.fromEntries(allies.map((actor) => [actor.definitionId, Math.max(0, actor.hp)]));
    margin += allies.reduce((sum, actor) => sum + Math.max(0, actor.hp), 0);
  }
  return { completed: true, cleared, margin };
}

// 山登りが登るための連続点数。到達区画が同じでも余裕で差がつく。
function score(loadout, multiplier) {
  const run = playRun(loadout, multiplier);
  return run.cleared * 1_000_000 + run.margin;
}

// **その編成が完走できる最大の敵倍率。** これが編成の強さの物差し。
function tolerance(loadout) {
  if (!playRun(loadout, 0.25).completed) return 0;
  let low = 0.25;
  let high = TOLERANCE_CEILING;
  for (let i = 0; i < TOLERANCE_STEPS; i += 1) {
    const mid = (low + high) / 2;
    if (playRun(loadout, mid).completed) low = mid; else high = mid;
  }
  return low;
}

// 中央値の 95% 区間。**閾値をまたいでいたら判定しない。**
function bootstrapMedianInterval(values, seed) {
  const rng = makeRng(seed ^ 0x5f3759df);
  const medians = [];
  for (let round = 0; round < BOOTSTRAP_ROUNDS; round += 1) {
    const sample = [];
    for (let i = 0; i < values.length; i += 1) sample.push(values[Math.floor(rng() * values.length)]);
    sample.sort((a, b) => a - b);
    medians.push(sample[Math.floor(sample.length / 2)]);
  }
  medians.sort((a, b) => a - b);
  return [medians[Math.floor(BOOTSTRAP_ROUNDS * 0.025)], medians[Math.floor(BOOTSTRAP_ROUNDS * 0.975)]];
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function draw(rng, pool, count) {
  const rest = [...pool];
  const taken = [];
  for (let i = 0; i < count && rest.length; i += 1) {
    taken.push(...rest.splice(Math.floor(rng() * rest.length), 1));
  }
  return taken;
}

function randomLoadout(rng, pools) {
  const loadout = freshLoadout(ROSTER);
  for (const id of ROSTER) {
    for (const [key, [pool, size]] of Object.entries(pools)) {
      loadout[key][id] = draw(rng, pool, size);
    }
  }
  return loadout;
}

// 枠ごとに候補を総当たりして、点数が上がる置き換えだけ残す。
// **無作為の最良から始める。** そうしないと、関門が落ちた理由が
// 「game が平坦」なのか「探索が弱い」なのか分けられない。
function climb(start, multiplier, pools, sweeps) {
  let best = structuredClone(start);
  let bestScore = score(best, multiplier);
  let evaluations = 1;
  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    let improved = false;
    for (const id of ROSTER) {
      for (const [key, [pool, size]] of Object.entries(pools)) {
        for (let slot = 0; slot < size; slot += 1) {
          for (const candidate of pool) {
            if (best[key][id].includes(candidate)) continue;
            const trial = structuredClone(best);
            trial[key][id][slot] = candidate;
            const trialScore = score(trial, multiplier);
            evaluations += 1;
            if (trialScore > bestScore) { bestScore = trialScore; best = trial; improved = true; }
          }
        }
      }
    }
    if (!improved) break;
  }
  return { best, evaluations };
}

// 一つの content について、無作為・探索の両方を回して比を出す。
function measure(label, pools, seed) {
  const rng = makeRng(seed);
  const samples = [];
  for (let i = 0; i < RANDOM_SAMPLES; i += 1) {
    const loadout = randomLoadout(rng, pools);
    samples.push({ loadout, tolerance: tolerance(loadout) });
  }
  samples.sort((a, b) => a.tolerance - b.tolerance);
  const values = samples.map((sample) => sample.tolerance);
  const median = values[Math.floor(values.length / 2)];
  const luckiest = samples[samples.length - 1];
  const medianInterval = bootstrapMedianInterval(values, seed);

  // 標本が「全部完走」「全部全滅」の端を指したときだけ、判定できるかを確かめる
  // （AGENTS.md 検証5規則の2・3）。中央値が 0 なら比が定義できない。
  if (median <= 0) {
    return { label, median, verdict: "判定不能", note: "無作為編成の中央値が 0 倍。比が定義できない" };
  }

  const climbed = climb(luckiest.loadout, median, pools, GREEDY_SWEEPS);
  const searched = tolerance(climbed.best);
  return {
    label,
    median,
    luck: luckiest.tolerance,
    searched,
    premium: searched / median,
    luckSpread: luckiest.tolerance / median,
    medianInterval,
    evaluations: climbed.evaluations,
    verdict: null,
  };
}

function report(row) {
  if (row.verdict) { console.log(`  ${row.label}: ${row.verdict}（${row.note}）`); return; }
  const [low, high] = row.medianInterval;
  console.log(
    `  ${row.label}: 中央値 ${row.median.toFixed(2)}倍 [95% ${low.toFixed(2)}〜${high.toFixed(2)}]`
    + ` / 運の最良 ${row.luck.toFixed(2)}倍 / 探索の最良 ${row.searched.toFixed(2)}倍`
    + ` → 知識の利得 ${row.premium.toFixed(2)} 倍（運の幅 ${row.luckSpread.toFixed(2)} 倍、探索 ${row.evaluations} 回）`,
  );
}

// ---------------------------------------------------------------------------
// 参照点。**本番より先にかける。**
// ---------------------------------------------------------------------------

const realPools = {
  tactics: [Object.keys(SKILLS.active).filter((id) => !/^(enemy_|front_strike|rear_strike|idle_)/.test(id)), 3],
  reactives: [Object.keys(SKILLS.reactive), 3],
  passives: [Object.keys(SKILLS.passive), 2],
  equipment: [Object.keys(EQUIPMENT), 2],
};

// 参照用の技能を registry へ足して測り、終わったら必ず取り除く。
// **PLAYABLE_CONTENT は最上位だけ凍っている**ので、差し替えではなく出し入れにする。
function withExtraActiveSkills(skills, run) {
  for (const [id, definition] of Object.entries(skills)) PLAYABLE_CONTENT.activeSkills[id] = definition;
  try { return run(); } finally {
    for (const id of Object.keys(skills)) delete PLAYABLE_CONTENT.activeSkills[id];
  }
}

// 参照 content は行動技能だけを差し替え、反応・常設・装備は空にする。
// **測りたい差以外を盤面へ入れない**（AGENTS.md 検証5規則の4）。
function referencePools(ids) {
  return { tactics: [ids, 3], reactives: [[], 0], passives: [[], 0], equipment: [[], 0] };
}

function cloneStrike(id, coefficientBps) {
  const single = { scope: "enemies", filters: [{ type: "alive" }], sort: ["position_asc"], take: 1 };
  return {
    id,
    displayName: id,
    apCost: 1,
    actionMode: "offense",
    intrinsicPredicates: [],
    targetQuery: single,
    effects: [{
      type: "deal_damage",
      target: single,
      amount: { type: "stat_scaled", subject: "self", scalingStat: "might", coefficientBps },
      reach: "melee",
      tags: ["attack", "weapon"],
    }],
    tags: ["attack"],
  };
}

function referenceContent(prefix, makeCoefficient, count) {
  const skills = {};
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const id = prefix + i;
    skills[id] = cloneStrike(id, makeCoefficient(i));
    ids.push(id);
  }
  return { skills, ids };
}

console.log("参照点（先にかける。落ちたら壊れているのは game ではなくこの検査）:");

// 陰性: 12種すべて同一。どう組んでも同じ編成になる。
const negative = referenceContent("ref_same_", () => 10_000, 12);
const negativeRow = withExtraActiveSkills(negative.skills, () => measure(
  "陰性参照（全技能が同一）", referencePools(negative.ids), 11,
));
report(negativeRow);

// 陽性: 11種は弱く、1種だけ明確に強い。選べば勝つ。
const positive = referenceContent("ref_one_", (i) => (i === 0 ? 40_000 : 5_000), 12);
const positiveRow = withExtraActiveSkills(positive.skills, () => measure(
  "陽性参照（1種だけ明確に強い）", referencePools(positive.ids), 11,
));
report(positiveRow);

assert.equal(negativeRow.verdict, null, "陰性参照が判定不能: この検査が壊れている");
assert.equal(positiveRow.verdict, null, "陽性参照が判定不能: この検査が壊れている");
assert.ok(
  negativeRow.premium <= IDENTICAL_TOLERANCE,
  `陰性参照の知識の利得が ${negativeRow.premium.toFixed(3)} 倍。全編成が同一なのだから 1.00 のはず。`
  + " **この検査が信号を捏造している。** game の判定へ進んではいけない",
);
assert.ok(
  positiveRow.premium >= PREMIUM_GATE,
  `陽性参照の知識の利得が ${positiveRow.premium.toFixed(2)} 倍で閾値 ${PREMIUM_GATE} に届かない。`
  + " 明確な優劣を置いたのに見つけられていない。**この検査の分解能か探索が足りない。**"
  + " game の判定へ進んではいけない",
);

// ---------------------------------------------------------------------------
// 本番
// ---------------------------------------------------------------------------

console.log("\n灰の遠征（現行 content）:");
const realRow = measure("現行", realPools, 20260830);
report(realRow);

assert.equal(realRow.verdict, null, `現行 content が判定不能: ${realRow.note ?? ""}`);

// 関門1 — 遠征が理不尽でない。**関門2の参照点。**
// これが無いと「勝てなくすれば通る」関門になる。
assert.ok(
  realRow.searched >= SHIPPED_DIFFICULTY,
  `探索で見つけた最良編成でも敵 ${realRow.searched.toFixed(2)} 倍までしか耐えられず、`
  + ` 出荷している難度 ${SHIPPED_DIFFICULTY.toFixed(2)} 倍を完走できない。遠征が理不尽になっている`,
);

// 関門2 — 雑な編成が通らない。**出荷難度が編成系の効く帯に入っているか。**
const [medianLow, medianHigh] = realRow.medianInterval;
assert.ok(
  medianLow > SHIPPED_DIFFICULTY || medianHigh < SHIPPED_DIFFICULTY,
  `無作為編成の耐久倍率の中央値 ${realRow.median.toFixed(2)} 倍の95%区間が`
  + ` [${medianLow.toFixed(2)}, ${medianHigh.toFixed(2)}] で、出荷難度 ${SHIPPED_DIFFICULTY.toFixed(2)} をまたいでいる。`
  + ` **標本 ${RANDOM_SAMPLES} 件では判定できない。** RANDOM_SAMPLES を増やすこと`,
);
assert.ok(
  realRow.median < SHIPPED_DIFFICULTY,
  `無作為に枠を埋めた編成が、敵 ${realRow.median.toFixed(2)} 倍まで耐える`
  + ` （95%区間 [${medianLow.toFixed(2)}, ${medianHigh.toFixed(2)}]）。`
  + ` 出荷している難度は ${SHIPPED_DIFFICULTY.toFixed(2)} 倍なので、**考えずに組んだ編成が半分以上の確率で完走する。**`
  + (realRow.premium >= PREMIUM_GATE
    ? ` 知識の利得は ${realRow.premium.toFixed(2)} 倍あるので、編成系そのものは働いている。`
      + " **出荷難度が、その幅の下に置かれている。**"
    : "")
  + " 選択が結果を決めていない",
);

// 関門3 — 考える幅がある。
assert.ok(
  realRow.premium >= PREMIUM_GATE,
  `知識の利得が ${realRow.premium.toFixed(2)} 倍で、閾値 ${PREMIUM_GATE} に届かない。`
  + ` 無作為に枠を埋めた編成が敵 ${realRow.median.toFixed(2)} 倍まで耐えるのに対し、`
  + ` 探索で見つけた最良編成は ${realRow.searched.toFixed(2)} 倍しか耐えない。`
  + (realRow.premium < realRow.luckSpread
    ? ` しかも運の幅 ${realRow.luckSpread.toFixed(2)} 倍を下回っている。`
      + " **考えて組むことが、さいころを振ることに負けている。**"
    : "")
  + " 編成画面が選択になっていない",
);

console.log("\n決着しなかった戦闘（イベント上限）: " + eventLimitHits + " 件。"
  + "高い倍率の探り以外で出ているなら engine 側を疑うこと");
console.log("\necology decision space smoke ok " + JSON.stringify({
  randomMedian: Number(realRow.median.toFixed(3)),
  premium: Number(realRow.premium.toFixed(3)),
  luckSpread: Number(realRow.luckSpread.toFixed(3)),
  gates: { shipped: SHIPPED_DIFFICULTY, premium: PREMIUM_GATE },
}));
