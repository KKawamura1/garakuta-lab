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
// ## 関門は2つ。**帯の床と天井を留める。**
//
//   床: 無作為編成の耐久倍率の**中央値が 1.0 未満**
//       … 考えずに枠を埋めた編成が、出荷している難度を通ってはいけない
//   天井: 探索で見つけた最良編成の耐久倍率が **2.0 以上**
//       … 考え抜いた編成は、敵の連続量を全部2倍にしても完走できてほしい
//
// 天井は作者の指定（2026-08-30）。**「いい戦略には、いい意味でゲームを壊してほしい」。**
// 強い編成の到達点を、比ではなく絶対値で留める。難度を上げるだけでは通らない
// （敵を強くすると探索の最良も同じだけ下がる）ので、天井を上げるには
// 編成側の上振れを作るしかない。
//
// 床が無いと天井は「簡単にすれば通る」関門になり、
// 天井が無いと床は「難しくすれば通る」関門になる。**両側から挟む。**
//
// 知識の利得（＝ 天井 ÷ 床）は、この2つから導かれる量なので関門にしない。
// 床 < 1.0 かつ 天井 ≥ 2.0 なら利得は必ず 2.0 を超える。診断として印字だけする。
//
// 1.0 は「出荷している難度そのもの」であって選んだ値ではない。
// 2.0 は作者が決めた。**通らないからといって動かさない**（AGENTS.md）。
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
// 参照編成を測るとき差し替えるので const 配列を書き換える形にしてある。
const ROSTER = ["warden", "mender", "lancer", "scout", "guardian"];

// 数字を見る前に決めた閾値。**通らないからといって動かさない**（AGENTS.md）。
const PREMIUM_GATE = 2.0;
// 出荷している難度。選んだ閾値ではなく、遊ばれている設定そのもの。
const SHIPPED_DIFFICULTY = 1.0;
// 天井。**考え抜いた編成に届いてほしい高さ**（作者指定、2026-08-30）。
const CEILING_GATE = 2.0;
// 素朴な編成に対する差。**「単純なビルドが山登りに大きく負ける」**（作者指定）。
// 「大きく」の中身は指定が無いので 1.5 倍とし、数字を見る前に決めた。
const NAIVE_MARGIN_GATE = 1.5;
// **大勝するコンボの数**（作者指定、2026-08-31）。
// additive デッキに 1.5 倍で勝つ組み合わせを見つけては、その立役者の組を
// 取り除いて探し直す。何回できるかがコンボの本数。
// 5 本を目標にする。7区画の遠征を何度も遊ぶなら、run ごとに違う筋が見つかる
// 程度の本数が要る。役割の数（受け・回復・火力・速度・準備）から取った。
// **現状が 2 本と分かった後に選んだ値ではない**（2 の直上を選ぶのは、
// 落とすための数合わせになる）。
const COMBO_COUNT_GATE = 5;
const COMBO_ROUNDS_MAX = 6;
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
//
// **倍にするのは連続量の4つだけ**（R6 §4.4 が連続量と呼んでいるもの）。
// speed / AP / RP は小整数のままにする。ここを倍にすると敵の手数そのものが増えて、
// 「同じ敵が強い」ではなく「敵が増えた」に化ける。**測りたいのは強さであって数ではない。**
const SCALED_ENEMY_STATS = ["maxHp", "might", "focus", "guard"];
function setDifficulty(multiplier) {
  for (const [id, base] of Object.entries(BASE_ENEMIES)) {
    const actor = PLAYABLE_CONTENT.enemyActors[id];
    for (const stat of SCALED_ENEMY_STATS) {
      if (typeof base[stat] !== "number") continue;
      // guard は 0 の敵がいる。0 は 0 のままにする（下駄を履かせない）。
      actor[stat] = base[stat] === 0 ? 0 : Math.max(1, Math.round(base[stat] * multiplier));
    }
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
//
// **登る難度は「いま一番強い編成がちょうど限界を迎える倍率」にする。**
// ここを無作為の中央値にすると、その難度でだけ強い編成が見つかり、
// 天井（もっと高い倍率で勝てるか）とずれる。実測で
// 「探索の最良 2.02 < 運の最良 2.07」という逆転が出た。
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

  const climbed = climb(luckiest.loadout, luckiest.tolerance, pools, GREEDY_SWEEPS);
  // **報告する天井は、見つけた中で一番高いもの。** 山登りは固定難度の点数を
  // 上げるので、耐久倍率で見ると種より下がることがある（別の量だから）。
  // 下がったときに種を捨てると、探索の弱さを game の平坦さとして報告してしまう。
  const searched = Math.max(tolerance(climbed.best), luckiest.tolerance);
  return {
    label,
    median,
    luck: luckiest.tolerance,
    searched,
    premium: searched / median,
    luckSpread: luckiest.tolerance / median,
    medianInterval,
    values,
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

// **作者が「今の最強」として挙げた編成**（2026-08-30）。関門ではなく参照点。
// content を触ったとき、作者の考えた戦略が強くなったか弱くなったかを見る。
// 数字そのものより、無作為編成の中央値・探索の天井との位置関係を見る。
const AUTHOR_ROSTER = ["pivot", "lancer", "scout", "guardian", "mender"];
function authorLoadout() {
  const loadout = freshLoadout(AUTHOR_ROSTER);
  // カイ・レオン・スイ: 大溜めのみ＋急かす・準備の螺旋、行動追加の装備
  for (const id of ["pivot", "lancer", "scout"]) {
    loadout.tactics[id] = ["long_swing"];
    loadout.reactives[id] = ["urging", "prep_spiral"];
    loadout.equipment[id] = ["reserve_coil", "quickstrap"];
  }
  loadout.tactics.guardian = ["bulwark"];
  loadout.reactives.guardian = ["cover_ally"];
  loadout.equipment.guardian = ["bastion_shell", "standing_plate"];
  loadout.tactics.mender = ["mend"];
  loadout.reactives.mender = ["overflow_care"];
  loadout.equipment.mender = ["guard_lantern", "worn_greaves"];
  for (const id of AUTHOR_ROSTER) loadout.passives[id] = ["foundation_ap", "foundation_rp"];
  return loadout;
}

// **単品で強い要素だけを積んだ additive デッキ。**
// 各要素を「他が空の土台へ1種だけ全員に持たせて」測り、枠ごとに上位を詰める。
// **組み合わせを一切見ないので、これを大きく上回れるならそれは相互作用の分。**
function soloScore(kind, id, multiplier) {
  const loadout = freshLoadout(ROSTER);
  for (const character of ROSTER) {
    loadout.tactics[character] = ["strike"];
    loadout.reactives[character] = [];
    loadout.passives[character] = [];
    loadout.equipment[character] = [];
    if (kind === "tactics") loadout.tactics[character] = [id, "strike"];
    else loadout[kind][character] = [id];
  }
  return score(loadout, multiplier);
}

function additiveDeck(banned, multiplier) {
  const pools = poolsExcept(banned);
  const loadout = freshLoadout(ROSTER);
  const picks = {};
  for (const [kind, [pool, size]] of Object.entries(pools)) {
    picks[kind] = pool
      .map((id) => ({ id, value: soloScore(kind, id, multiplier) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, size)
      .map((entry) => entry.id);
  }
  for (const character of ROSTER) for (const kind of Object.keys(pools)) loadout[kind][character] = [...picks[kind]];
  return { loadout, picks };
}

function poolsExcept(banned) {
  const keep = (ids) => ids.filter((id) => !banned.has(id));
  return {
    tactics: [keep(realPools.tactics[0]), 3],
    reactives: [keep(realPools.reactives[0]), 3],
    passives: [keep(realPools.passives[0]), 2],
    equipment: [keep(realPools.equipment[0]), 2],
  };
}

function withoutElements(loadout, banned) {
  const copy = structuredClone(loadout);
  for (const character of ROSTER) {
    for (const kind of ["tactics", "reactives", "passives", "equipment"]) {
      copy[kind][character] = (copy[kind][character] ?? []).filter((id) => !banned.has(id));
    }
  }
  return copy;
}

function elementsOf(loadout) {
  const ids = new Set();
  for (const character of ROSTER) {
    for (const kind of ["tactics", "reactives", "passives", "equipment"]) {
      for (const id of loadout[kind][character] ?? []) ids.add(id);
    }
  }
  return [...ids];
}

// **立役者の組 = 相互作用項が最大の対。**
// 単に寄与が大きい対ではなく、`二つ同時に抜いた損失 − 片方ずつ抜いた損失の和`。
// これが正の対だけが「二つ揃って初めて効く」＝コンボである。
function keyPair(loadout, multiplier) {
  const ids = elementsOf(loadout);
  const base = score(loadout, multiplier);
  const single = {};
  for (const id of ids) single[id] = base - score(withoutElements(loadout, new Set([id])), multiplier);
  let best = null;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const [a, b] = [ids[i], ids[j]];
      const together = base - score(withoutElements(loadout, new Set([a, b])), multiplier);
      const interaction = together - single[a] - single[b];
      if (!best || interaction > best.interaction) best = { a, b, interaction };
    }
  }
  return best;
}

// **コンボを組まない素朴な編成**（作者の指定、2026-08-30）。
// 無作為編成は戦略ではないが、これは実在するプレイヤーの戦略。
// **「よく考えたビルドは、パッと思いつく編成より強くあってほしい」**を関門にする。
const NAIVE_BUILDS = {
  "全員回復": { tactics: ["mend", "triage", "strike"], reactives: ["overflow_care", "triage_relay", "brace_after_hit"] },
  "全員防御": { tactics: ["bulwark", "brace_for_impact", "strike"], reactives: ["cover_ally", "guard_step", "barrier_bloom"] },
  "全員攻撃": { tactics: ["strike", "heavy_swing", "rapid_cuts"], reactives: ["counter_blow", "damage_echo", "scavenge_ap"] },
  "攻撃2 回復2 防御1": null, // 役割ごとに割り振る。下で組む
};
// 素朴な編成でも、空き枠を空けたままにはしない（枠を埋めるコストはゼロなので、
// 空けた版と比べると「絞ると弱い」ぶんだけ関門が甘くなる）。
function naiveLoadout(name) {
  const loadout = freshLoadout(ROSTER);
  const roles = NAIVE_BUILDS[name];
  const attack = NAIVE_BUILDS["全員攻撃"];
  const care = NAIVE_BUILDS["全員回復"];
  const guard = NAIVE_BUILDS["全員防御"];
  const mix = [attack, attack, care, care, guard];
  ROSTER.forEach((id, index) => {
    const role = roles ?? mix[index];
    loadout.tactics[id] = [...role.tactics];
    loadout.reactives[id] = [...role.reactives];
    loadout.passives[id] = ["foundation_vitality", "foundation_ap"];
    loadout.equipment[id] = role === guard ? ["bastion_shell", "standing_plate"] : ["quickstrap", "reserve_coil"];
  });
  return loadout;
}

// **出荷難度をどこへ置くと、無作為編成が通らなくなるか。**
// 関門ではなく判断材料。床が落ちたとき、次に動かす一つ目の数がこれになる。
function shippingDial(row) {
  const lines = [];
  for (const dial of [1.0, 1.2, 1.4, 1.6, 1.8, 2.0]) {
    const clears = row.values.filter((value) => value >= dial).length;
    lines.push(`    敵 ${dial.toFixed(1)} 倍: 無作為編成の完走率 ${String(Math.round(clears * 100 / row.values.length)).padStart(3)}%`
      + `（${clears}/${row.values.length}）`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 本番
// ---------------------------------------------------------------------------

console.log("\n灰の遠征（現行 content）:");
const realRow = measure("現行", realPools, 20260830);
report(realRow);

// 参照編成は roster が違うので、測るときだけ ROSTER を差し替える。
const defaultRoster = [...ROSTER];
ROSTER.length = 0;
ROSTER.push(...AUTHOR_ROSTER);
const authorTolerance = tolerance(authorLoadout());
ROSTER.length = 0;
ROSTER.push(...defaultRoster);
console.log(`\n  作者が挙げた最強編成（参照点、関門ではない）: ${authorTolerance.toFixed(2)} 倍`
  + `　無作為の中央値の ${(authorTolerance / realRow.median).toFixed(2)} 倍 / 探索の天井の ${(authorTolerance / realRow.searched).toFixed(2)} 倍`);

console.log("\n  コンボを組まない素朴な編成（関門の相手）:");
const naiveRows = Object.keys(NAIVE_BUILDS).map((name) => ({ name, tolerance: tolerance(naiveLoadout(name)) }));
naiveRows.sort((a, b) => b.tolerance - a.tolerance);
for (const row of naiveRows) console.log(`    ${row.name.padEnd(20)} ${row.tolerance.toFixed(2)} 倍`);
const bestNaive = naiveRows[0];
console.log(`    → 最良の素朴編成 ${bestNaive.tolerance.toFixed(2)} 倍（${bestNaive.name}）`
  + `　探索の天井はその ${(realRow.searched / bestNaive.tolerance).toFixed(2)} 倍`);

// 大勝するコンボを数える。見つけた組を取り除いては探し直す。
console.log("\n  大勝するコンボの数え上げ（additive デッキに " + NAIVE_MARGIN_GATE + " 倍で勝つ組を、立役者ごと除いて数え直す）:");
const displayName = (id) => SKILLS.active[id]?.displayName ?? SKILLS.reactive[id]?.displayName
  ?? SKILLS.passive[id]?.displayName ?? EQUIPMENT[id]?.displayName ?? id;
const banned = new Set();
const combos = [];
for (let round = 1; round <= COMBO_ROUNDS_MAX; round += 1) {
  const additive = additiveDeck(banned, SHIPPED_DIFFICULTY);
  const additiveTolerance = tolerance(additive.loadout);
  if (additiveTolerance <= 0) { console.log(`    第${round}周: additive デッキが完走できない。ここで打ち切る`); break; }
  const climbAt = Math.max(additiveTolerance, SHIPPED_DIFFICULTY);
  const climbed = climb(additive.loadout, climbAt, poolsExcept(banned), GREEDY_SWEEPS);
  const combinedTolerance = Math.max(tolerance(climbed.best), additiveTolerance);
  const ratio = combinedTolerance / additiveTolerance;
  console.log(`    第${round}周: additive ${additiveTolerance.toFixed(2)} 倍 / 組み合わせ最良 ${combinedTolerance.toFixed(2)} 倍 → ${ratio.toFixed(2)} 倍`);
  if (ratio < NAIVE_MARGIN_GATE) { console.log(`      → ${NAIVE_MARGIN_GATE} 倍に届かない。ここで打ち止め`); break; }
  const pair = keyPair(climbed.best, climbAt);
  if (!pair || pair.interaction <= 0) { console.log("      → 相互作用が正の対が無い（積み上げで説明できる）。打ち止め"); break; }
  combos.push(pair);
  console.log(`      立役者の組: ${displayName(pair.a)} ＋ ${displayName(pair.b)} → 除外して再探索`);
  banned.add(pair.a);
  banned.add(pair.b);
}
console.log(`    → 大勝するコンボ ${combos.length} 本`);

console.log("\n  出荷難度をどこへ置くか（関門ではなく判断材料。天井は "
  + realRow.searched.toFixed(2) + " 倍）:");
console.log(shippingDial(realRow));

assert.equal(realRow.verdict, null, `現行 content が判定不能: ${realRow.note ?? ""}`);

// 床 — 考えずに枠を埋めた編成が、出荷している難度を通ってはいけない。
// 中央値の95%区間が閾値をまたいでいたら、数字を出して判定不能で落とす
// （AGENTS.md 検証5規則の3。黙って通さない）。
const [medianLow, medianHigh] = realRow.medianInterval;
assert.ok(
  medianLow > SHIPPED_DIFFICULTY || medianHigh < SHIPPED_DIFFICULTY,
  `無作為編成の耐久倍率の中央値 ${realRow.median.toFixed(2)} 倍の95%区間が`
  + ` [${medianLow.toFixed(2)}, ${medianHigh.toFixed(2)}] で、出荷難度 ${SHIPPED_DIFFICULTY.toFixed(2)} をまたいでいる。`
  + ` **標本 ${RANDOM_SAMPLES} 件では判定できない。** RANDOM_SAMPLES を増やすこと`,
);
assert.ok(
  realRow.median < SHIPPED_DIFFICULTY,
  `【床】無作為に枠を埋めた編成が、敵の連続量 ${realRow.median.toFixed(2)} 倍まで耐える`
  + ` （95%区間 [${medianLow.toFixed(2)}, ${medianHigh.toFixed(2)}]）。`
  + ` 出荷している難度は ${SHIPPED_DIFFICULTY.toFixed(2)} 倍なので、`
  + " **考えずに組んだ編成が半分以上の確率で完走する。**"
  + ` 探索の最良は ${realRow.searched.toFixed(2)} 倍あるので、幅そのものは在る。`
  + " 出荷難度が、その帯の下に置かれている",
);

// 天井 — 考え抜いた編成は、敵の連続量を全部2倍にしても完走できてほしい。
// **「いい戦略には、いい意味でゲームを壊してほしい」**（作者、2026-08-30）。
assert.ok(
  realRow.searched >= CEILING_GATE,
  `【天井】探索で見つけた最良編成でも、敵の連続量 ${realRow.searched.toFixed(2)} 倍までしか耐えられない。`
  + ` ${CEILING_GATE.toFixed(1)} 倍に届いていない。`
  + ` 無作為編成の中央値 ${realRow.median.toFixed(2)} 倍に対する利得は ${realRow.premium.toFixed(2)} 倍、`
  + ` 48回引き直したときの当たり（運の幅 ${realRow.luckSpread.toFixed(2)} 倍）と比べても`
  + (realRow.premium <= realRow.luckSpread ? "小さい" : "大きくない")
  + "。**上振れる編成が存在しない。** 技能・装備の側に、掛け算になる軸が要る",
);

// 素朴な編成との差 — 考え抜いた編成は、パッと思いつく編成に大きく勝ってほしい。
assert.ok(
  realRow.searched >= bestNaive.tolerance * NAIVE_MARGIN_GATE,
  `【素朴編成との差】探索の天井 ${realRow.searched.toFixed(2)} 倍に対し、`
  + ` コンボを組まない素朴な編成「${bestNaive.name}」が ${bestNaive.tolerance.toFixed(2)} 倍まで耐える。`
  + ` 差は ${(realRow.searched / bestNaive.tolerance).toFixed(2)} 倍で、閾値 ${NAIVE_MARGIN_GATE} に届かない。`
  + " **考え抜いた編成が、パッと思いつく編成に大きく勝てていない**",
);

// **コンボの本数は、まだ関門にしない。**
//
// 数え方は動くが、値が信用できない。同じ content で、探索の細部
// （山登りの掃引数・耐久倍率の天井と刻み）を変えるだけで 2 本にも 8 本にもなる。
// 見つかる組にも「継ぎはぎの盾＋厚い継ぎ板」（同じ効果の装備2つ）や
// 「貫き突き＋刻み斬り」（ただの攻撃技能2つ）が混ざる。相互作用項が
// 点数のノイズを拾っている。
//
// **信用できない数で緑や赤を出すより、数字だけ出して判断を人へ返す。**
// 関門にする前に要るもの:
//   1. 同じ content・別の探索設定で本数が変わらないこと（再現性）
//   2. 名指しされた組が、片方だけでは説明できないことの裏取り
//      （相互作用項が、点数の分解能に対して十分大きいか）
//   3. 「同じ効果の2つ」を組として数えない除外規則
if (combos.length < COMBO_COUNT_GATE) {
  console.log(`    ※ 目標は ${COMBO_COUNT_GATE} 本。ただし本数はまだ関門にしていない（値が探索設定でぶれる）`);
}

console.log("\n決着しなかった戦闘（イベント上限）: " + eventLimitHits + " 件。"
  + "高い倍率の探り以外で出ているなら engine 側を疑うこと");
console.log("\necology decision space smoke ok " + JSON.stringify({
  randomMedian: Number(realRow.median.toFixed(3)),
  premium: Number(realRow.premium.toFixed(3)),
  luckSpread: Number(realRow.luckSpread.toFixed(3)),
  gates: { shipped: SHIPPED_DIFFICULTY, premium: PREMIUM_GATE },
}));
