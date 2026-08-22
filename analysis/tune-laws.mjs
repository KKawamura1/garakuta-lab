import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { makeSimulate, scaleEnemies, BASE, LAW_IDS, LAWS, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { reachableSets, SAFE_HP } from "./sets.mjs";
import { makeRng } from "../core/rng.mjs";

// 法則の組ごとに敵の数値を決める調律器（作り直し）。
//
// 前の版は敵HPの二分探索の各段で全局面を測り直していた。精度を上げると100分かかる。
// **やり方を変える：敵HPは、結果を「いつ何ダメージ届いたか」に読み替えれば、測り直さなくてよい。**
//
// 各並びを一度だけ「HPが無限の的」と戦わせ、巡回ごとの累計ダメージと自HPを記録する。
// すると敵HP=h に対する勝敗は、**累計ダメージが h を超える巡回が12巡以内にあり、
// その時点で自分が生きているか**を見るだけで分かる。二分探索が計算ゼロになる。
//
// 攻撃力は自分の生死を変えるので読み替えできない。候補を少数に絞って測り直す。
// **敵HPは「勝てるか」を、攻撃力は「無傷で勝てるか」を動かす**（第11回の知見）。

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [item, true];
}));
const setRuns = Number(args.sets || 20);
const cap = Number(args.cap || 300);
const TARGET = 0.15;          // T2：勝てる並びの割合の中央値をここへ寄せる
const MAX_HP = 30;
const DUMMY_HP = 1e9;
// 合格した6組はほぼ全部が上限の3.2を使っていた。**探索の端に張り付いているのは、
// 範囲が足りていない印である。** 上を伸ばす（閾値ではなく探索範囲の話なので、後出しの緩和ではない）。
// 上を 4.5・6 まで戻した。**絞った理由が、1巡上限を入れたことで消えたからである。**
// 絞ったときの理由は「攻撃力を上げるほど勝ち＝完全防御になり、勝利と無傷が同じ集合へ収束する」。
// これは**速く殺して敵の行動前に終わらせる**道が開いていたときの話で、
// 1巡に通る上限を入れて最低3巡かかるようにした今は、その回避路が無い。
// 閾値ではなく探索範囲の話である。
const ATK_CANDIDATES = [1, 1.5, 2.2, 3.2, 4.5, 6];
// 命中上限・下限の倍率。**法則が1回の命中の大きさを掛け算で動かすので、それへの条件も一緒に振る。**
// 素の値だけだと環甲（上限14）がどの組でも帯に入らず、91組すべてがそこで落ちた。
const MOD_CANDIDATES = [1, 1.6, 2.5];
// 1巡に通る合計の上限。**素のHPに対する比で候補を持つ。**
//
// HPに連動させると、一度の戦闘から任意の敵HPを読み出す高速化（下の capacity）が壊れる。
// 上限が変われば戦闘そのものが変わるので、HPと一緒には動かせない。
// よって上限は独立した軸として探索し、**選ばれたHPが上限の3倍以上あること**を後で課す。
// それで「どんな並びでも最低3巡かかる」が保証され、1巡決着が構造的に起きない。
const CYCLECAP_CANDIDATES = [1 / 5, 1 / 3];
const MIN_CYCLES = 3;
// 上を 4.5・6 まで伸ばしていたのをやめた。**攻撃力を上げるほど「勝ち＝完全防御」になり、
// 勝利と無傷が同じものへ収束する**（実測：攻×6の環甲は勝率9.3%なのに無傷が8.9%）。
// 天井を下げたいのに、上げる方向の手だった。閾値ではなく探索範囲の話である。
const EFFICIENCY = 7;         // 実測の探索効率（無作為の何倍か）
const TRIES = 10;             // 1戦あたりの試行回数の実測中央値
const reachable = p => 1 - (1 - Math.min(1, p * EFFICIENCY)) ** TRIES;

// 登録した閾値（agents/PROTOCOL.md と analysis/smoke-gate.mjs で突き合わせている）
const T1_SAFE = 0.98;
// 登録文は「中央値が 5〜15%。全戦闘で 30% を超えない」の**二本立て**である。
// ここでは上限しか見ていなかった（T1・T3 と同じ、登録と実装の食い違い）。
const T2_BAND = [0.05, 0.15];
const T2_MAX = 0.30;
const T3_DECIDED = 0.95;
const CEILING = 0.50;

const skeleton = {
  PARTS, START_PARTS: 8, RARE_RATE: 0.12, ENEMIES: BASE,
  startContract: types => {
    const count = line => types.filter(t => PARTS[t].line === line).length;
    return count("strike") >= 3 && count("guard") >= 2;
  }
};
const SETS = reachableSets(skeleton, { runs: setRuns });

if (setRuns < Math.ceil(1 / (1 - T3_DECIDED))) {
  console.error(`標本不足：敵1体あたり${setRuns}局面では「順序が効く${T3_DECIDED * 100}%以上」を判定できない。`);
  process.exit(2);
}

function arrangementsOf(types, rng) {
  const counts = new Map();
  types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const kinds = [...counts.keys()];
  const out = [];
  const cur = [];
  const walk = d => {
    if (out.length > 200000) return;
    if (d === SLOT_COUNT) { out.push([...cur]); return; }
    kinds.forEach(k => {
      if (!counts.get(k)) return;
      counts.set(k, counts.get(k) - 1);
      cur.push(k);
      walk(d + 1);
      cur.pop();
      counts.set(k, counts.get(k) + 1);
    });
  };
  walk(0);
  if (out.length <= cap) return out;
  const picked = [];
  for (let i = 0; i < cap; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
  return picked;
}

// 一度の戦闘から、あらゆる敵HPに対する答えを引き出せる形にする。
//
// **敵が死んだ瞬間で切る。** 前の版は「その巡回の終わりのHP」を返しており、
// 実機では起きないはずの**その巡回の敵の攻撃を、勝った側にも数えていた**。
// そのぶん無傷が過小に見え、天井の条件が甘く測られ、攻撃力を上げ足りないまま出荷した。
// 実際、作者の4ランは全部 HP30 の完全勝利で「どうせ勝ち」と書かれた。
//
// 出来事を順番に並べ、累計ダメージが敵HPを超えた**その出来事の時点**のHPを返す。
function capacity(simulate, order, enemyTemplate) {
  const enemy = { ...enemyTemplate, hp: DUMMY_HP };
  const result = simulate({
    slots: order.map((type, i) => ({ id: `x${i}`, type })),
    hp: SAFE_HP, maxHp: MAX_HP, enemy, rng: makeRng(1)
  });
  const events = [];
  result.log.forEach(entry => {
    if (!entry.after) return;
    events.push({
      cycle: entry.cycle,
      dealt: DUMMY_HP - entry.after.enemyHp,
      hp: entry.after.hp
    });
  });
  return events;
}

// 敵HP h に対する結果を、出来事の列から読み出す。
function outcomeAt(events, h) {
  for (const e of events) {
    if (e.dealt >= h) return { won: true, hp: Math.max(0, e.hp), cycles: e.cycle };
    if (e.hp <= 0) return { won: false, hp: 0, cycles: e.cycle };
  }
  const last = events[events.length - 1];
  return { won: false, hp: last ? Math.max(0, last.hp) : SAFE_HP, cycles: last ? last.cycle : 0 };
}

function measureEnemy(caps, hpScale, base) {
  const h = Math.max(20, Math.round(base.hp * hpScale));
  const rates = [];
  const flawlessRates = [];
  let dead = 0;
  let decided = 0;
  caps.forEach(list => {
    let won = 0;
    let flawless = 0;
    let all = true;
    list.forEach(c => {
      const r = outcomeAt(c, h);
      if (r.won) { won += 1; if (r.hp >= SAFE_HP) flawless += 1; } else all = false;
    });
    rates.push(won / list.length);
    flawlessRates.push(flawless / list.length);
    if (won === 0) dead += 1;
    else if (!all) decided += 1;
  });
  const median = a => { const t = [...a].sort((x, y) => x - y); return t[Math.floor(t.length / 2)]; };
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    hp: h,
    winMedian: median(rates), flawlessMean: mean(flawlessRates),
    safeRate: 1 - dead / caps.length, decidedRate: decided / caps.length
  };
}

function tuneEnemy(simulate, index) {
  const base = BASE[index];
  const situations = SETS.filter(s => s.index === index);
  const candidates = [];

  // **攻撃力の候補は全部試して、条件をいくつ満たすかで選ぶ。**
  // 早く抜けると、後の候補の方が良かった場合を取り逃す（前の版はそれで帯を外していた）。
  // 修飾を持たない敵では倍率を振っても何も変わらないので、候補を1つに畳む（無駄な再計算を避ける）。
  const modList = (base.cap < 99 || base.floor) ? MOD_CANDIDATES : [1];
  for (const atkScale of ATK_CANDIDATES) for (const modScale of modList)
  for (const capFrac of CYCLECAP_CANDIDATES) {
    const cycleCap = Math.max(4, Math.round(base.hp * capFrac));
    const template = {
      ...base, cycleCap,
      atk: Math.max(1, Math.round(base.atk * atkScale)),
      cap: base.cap < 99 ? Math.max(2, Math.round(base.cap * modScale)) : base.cap,
      floor: base.floor ? Math.max(2, Math.round(base.floor * modScale)) : base.floor
    };
    // 最低巡回数が確保できないHPは、そもそも探索範囲から外す。
    const floorScale = (MIN_CYCLES * cycleCap) / base.hp;
    const caps = situations.map(s => {
      const rng = makeRng(s.run * 977 + index);
      return arrangementsOf(s.owned, rng).map(order => capacity(simulate, order, template));
    });

    const bisect = (test) => {
      let lo = 0.2, hi = 40;
      for (let step = 0; step < 20; step += 1) {
        const mid = (lo + hi) / 2;
        if (test(measureEnemy(caps, mid, base))) lo = mid; else hi = mid;
      }
      return { lo, hi };
    };
    // T1：詰みを作らない上限。倍率を上げるほど詰みが増えるので、通る側が下。
    const smax = bisect(m => m.safeRate >= T1_SAFE).lo;
    // T2：勝てる並びの割合は倍率とともに減る。帯の**両端**を取る。
    const smin = bisect(m => m.winMedian > T2_BAND[1]).hi;   // ここから上が「15%以下」
    const sfloor = bisect(m => m.winMedian >= T2_BAND[0]).lo; // ここまでが「5%以上」

    // **帯の中を走査して、天井がいちばん低いところを採る。**
    //
    // 前の版は `Math.min(smin, smax)`、つまり**帯の緩い端**をそのまま使っていた。
    // 帯の中では倍率を上げるほど無傷が減るので、これは天井をわざわざ最悪にする選び方である。
    // 学び#33・#52 で二度書いた「緩い端を選んで合格にする」を、三度目に踏んでいた。
    // 閾値は一つも動かしていない。**帯の中のどこを選ぶかという探索の話である。**
    const top = Math.min(smax, Math.max(smin, sfloor));
    const low = Math.max(smin, floorScale);   // 1巡上限の3倍のHPを下回らない
    let best = null;
    for (let step = 0; step <= 12; step += 1) {
      const scale = low + ((top - low) * step) / 12;
      if (scale <= 0 || scale < floorScale) continue;
      const m = measureEnemy(caps, scale, base);
      if (m.safeRate < T1_SAFE) break;              // ここから上は詰みが出る
      if (m.winMedian < T2_BAND[0]) break;          // ここから上は締めすぎ
      if (!best || m.flawlessMean < best.flawlessMean) best = { ...m, scale };
    }
    if (!best) {
      const fallback = Math.max(floorScale, Math.min(smin, smax));
      best = { ...measureEnemy(caps, fallback, base), scale: fallback };
    }
    const found = { ...best, atkScale, modScale, cycleCap, smin, smax, sfloor };
    found.score =
      (found.safeRate >= T1_SAFE ? 8 : 0)
      + (found.winMedian <= T2_BAND[1] && found.winMedian >= T2_BAND[0] ? 4 : 0)
      + (found.decidedRate >= T3_DECIDED ? 2 : 0)
      + (reachable(found.flawlessMean) <= CEILING ? 1 : 0);
    candidates.push(found);
  }
  candidates.sort((a, b) => b.score - a.score || a.winMedian - b.winMedian);
  return candidates[0];
}

const pairs = [];
for (let i = 0; i < LAW_IDS.length; i += 1) {
  for (let j = i + 1; j < LAW_IDS.length; j += 1) pairs.push([LAW_IDS[i], LAW_IDS[j]]);
}

// --only=relay+bias,... で組を絞り、--verbose で敵ごとの内訳を出す（診断用。判定は変えない）。
const only = args.only ? String(args.only).split(",").map(x => x.split("+")) : null;
const verbose = Boolean(args.verbose);
if (only) {
  const want = new Set(only.map(p => [...p].sort().join("+")));
  pairs.length = pairs.filter(p => want.has([...p].sort().join("+"))).length
    && pairs.splice(0, pairs.length, ...pairs.filter(p => want.has([...p].sort().join("+")))).length ? pairs.length : 0;
}

// **並列に走らせる。** この環境は4コアで、組ごとの評価は完全に独立している。
// 直列だと91組で13分かかり、その間ずっと1コアしか動いていなかった。
// `--slice=i/n` を受けた子は自分の担当だけを評価して JSON を吐き、親が束ねる。
const slice = args.slice ? String(args.slice).split("/").map(Number) : null;
if (slice) {
  const [index, total] = slice;
  const mine = pairs.filter((_, i) => i % total === index);
  pairs.length = 0;
  pairs.push(...mine);
}

const table = [];
const rejected = [];

// 親は自分では測らず、子を起こして束ねるだけ。`--workers=1` で直列（旧来の挙動）に戻せる。
const workers = slice ? 1 : Number(args.workers || Math.min(4, cpus().length));
const self = fileURLToPath(import.meta.url);
const passthrough = process.argv.slice(2).filter(a => !/^--(workers|slice|emit|sets|cap|only|screen|percap)=/.test(a));

function runWorkers(extra, list, label) {
  const started = Date.now();
  let finished = 0;
  const only = list ? [`--only=${list.map(p => p.join("+")).join(",")}`] : [];
  return Promise.all(Array.from({ length: workers }, (_, i) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath,
      [self, ...passthrough, ...extra, ...only, `--slice=${i}/${workers}`, "--emit=json"],
      { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", d => { out += d; });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error(`子${i}が異常終了しました（${code}）`));
      finished += 1;
      if (finished === workers) {
        process.stderr.write(`${label}：並列${workers}で${((Date.now() - started) / 1000).toFixed(0)}秒\n`);
      }
      try { resolve(JSON.parse(out)); } catch (e) { reject(new Error(`子${i}の出力が読めません: ${e.message}`)); }
    });
  })));
}

// **粗い篩。** 落とす権限だけを持ち、通す権限は持たない。
//
// 86組が落ちるのに全組へ最大精度をかけていた。粗く測って**明らかに届かないものだけ**を外す。
// 外す線（天井90%）は本来の条件（50%）から遠く取ってある。標本が粗いぶん誤差で動くので、
// **間違えるなら厳しすぎる側に倒れるようにする**（＝残しすぎる方向）。
// 合否はこのあとの本番だけが決める。**速い方に合否を決めさせると、分母のすり替えになる。**
// 実測（2026-08-22、本番の4組を参照点に）：
//   並び60本  … 真値44%の組が98%と出た。**上振れする＝落としてはいけないものを落とす。** 使えない。
//   並び120本 … 真値 44/26/40/38% に対し 47/36/40/19%。追随する。
// よって篩は120本で走らせ、線は0.95に置く（本番の条件は0.50、篩で見た合格組の最大は47%）。
// **粗くすると天井は高く出る**（帯の端が荒れて、探索が悪い方に落ちる）ので、
// 誤差は必ず「落としすぎ」の側に出る。線を遠くに置くのはそのためである。
const SCREEN_DROP = 0.95;
let toEvaluate = pairs;
if (args.screen && !slice && !args.noceiling) {
  // **局面数（sets）は削らない。** 削ると「T3を判定できる標本数か」の番人（学び#52の規則2）に
  // 引っかかって子が落ちる。番人が正しいので、こちらが削る対象を変える。
  // 篩が見るのは天井だけで、天井は並びの側の量なので、**並びの本数（cap）だけを削る。**
  // **敵も減らす。** 天井は戦闘ごとの最大なので、**一部の戦闘だけ見て超えていれば、
  // それだけで落とす根拠になる。** 見なかった戦闘は最大値を下げる側にしか効かないので、
  // 敵を省くことで「落としてはいけないものを落とす」ことは起きない。
  // 並び120本 × 敵3体で、本番の約2割の費用になる。
  const rough = await runWorkers([`--sets=${setRuns}`, `--cap=${args.screencap || 120}`,
    `--enemies=${args.screenenemies || 3}`, "--percap=99"], null, "粗い篩");
  const all = rough.flatMap(part => [...part.table, ...part.rejected]);
  const drop = new Set(all.filter(r => (r.flawlessReach ?? 0) > SCREEN_DROP).map(r => r.name));
  toEvaluate = pairs.filter(p => !drop.has(p.map(id => LAWS[id].name).join("＋")));
  process.stderr.write(`  ${pairs.length}組中${drop.size}組を篩で落とし、${toEvaluate.length}組を本番へ\n`);
}

if (workers > 1 && !slice) {
  const parts = await runWorkers([`--sets=${setRuns}`, `--cap=${cap}`], toEvaluate, "本番");
  parts.forEach(part => { table.push(...part.table); rejected.push(...part.rejected); });
  const checked = parts.reduce((n, part) => n + part.checked, 0);
  if (checked !== toEvaluate.length) throw new Error(`${toEvaluate.length}組のうち${checked}組しか評価されていません`);
}

// 進み具合を標準エラーへ出す。数分〜十数分かかるので、**黙って走る道具は壊れているのと見分けが付かない。**
const started = Date.now();
(workers > 1 ? [] : pairs).forEach((pair, n) => {
  const simulate = makeSimulate(pair);
  const name = pair.map(id => LAWS[id].name).join("＋");
  const elapsed = (Date.now() - started) / 1000;
  const eta = n ? ((elapsed / n) * (pairs.length - n)).toFixed(0) : "?";
  process.stderr.write(`[${String(n + 1).padStart(3)}/${pairs.length}] ${name}　残り約${eta}秒\n`);
  const perEnemy = (args.enemies ? BASE.slice(0, Number(args.enemies)) : BASE)
    .map((_, index) => tuneEnemy(simulate, index));
  if (verbose) {
    console.log(`\n## ${name}`);
    console.log("  敵            敵HP  攻×  修×  詰みなし  勝てる並び  順序  無傷の並び  天井(換算)");
    perEnemy.forEach((e, i) => console.log(
      `  ${BASE[i].name.padEnd(6)} ${String(e.hp).padStart(8)} ${String(e.atkScale).padStart(4)} ${String(e.modScale ?? 1).padStart(4)}`
      + `  ${(e.safeRate * 100).toFixed(1).padStart(7)}%  ${(e.winMedian * 100).toFixed(1).padStart(8)}%`
      + `  ${(e.decidedRate * 100).toFixed(0).padStart(3)}%  ${(e.flawlessMean * 100).toFixed(2).padStart(8)}%`
      + `  ${(reachable(e.flawlessMean) * 100).toFixed(0).padStart(8)}%`));
  }

  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const safeRate = mean(perEnemy.map(e => e.safeRate));
  const decided = mean(perEnemy.map(e => e.decidedRate));
  const winMedian = mean(perEnemy.map(e => e.winMedian));
  // P12-b の登録文は「最上位等級の**1戦あたり**到達率が50%未満」。戦闘ごとの条件である。
  // 実装は6戦の平均に対して見ていたので、**天井の低い戦闘が高い戦闘を隠していた**
  // （T2の上限・T1・T3に続いて4件目の、登録と実装の食い違い）。
  // reachable は単調増加なので、この直しは必ず**厳しく**なる。緩める方向の直しではない。
  const ceilings = perEnemy.map(e => reachable(e.flawlessMean));
  const ceiling = Math.max(...ceilings);

  const reasons = [];
  if (safeRate < T1_SAFE) reasons.push(`詰みが多い（${(safeRate * 100).toFixed(1)}%、要${T1_SAFE * 100}%）`);
  // 登録文は「中央値が 5〜15%。**全戦闘で** 30% を超えない」。上限は戦闘ごとの条件である。
  // 実装は中央値の平均に対して見ていたので、緩い戦闘が他に紛れて通っていた（#51と同じ型）。
  const loosest = Math.max(...perEnemy.map(e => e.winMedian));
  if (loosest > T2_MAX) reasons.push(`緩すぎる戦闘がある（${(loosest * 100).toFixed(0)}%、要${T2_MAX * 100}%以下）`);
  if (winMedian > T2_BAND[1]) reasons.push(`締まりが足りない（中央値 ${(winMedian * 100).toFixed(0)}%、要${T2_BAND[0] * 100}〜${T2_BAND[1] * 100}%）`);
  else if (winMedian < T2_BAND[0]) reasons.push(`締めすぎ（中央値 ${(winMedian * 100).toFixed(1)}%、要${T2_BAND[0] * 100}〜${T2_BAND[1] * 100}%）`);
  if (decided < T3_DECIDED) reasons.push(`順序が効かない（${(decided * 100).toFixed(0)}%、要${T3_DECIDED * 100}%）`);
  // --noceiling：天井（P12-b）を**測るが落とさない**。
  //
  // 2026-08-22、作者の判断で今回だけ P10 の決定ルール（生成条件を満たさない版は人間テストへ送らない）
  // を破る。理由は、天井の条件が T1 と同時に満たせないことが判明したためである。
  // 参照点 RELAY 0.1（作者評価5・企画の記録）でも天井は71%で、
  // HPを上げて天井を通すと詰みなし率が83%へ落ちて T1（98%）を割る。
  // **参照点が通らない関門は、関門の側が壊れている**（学び#52）。
  // 数字で決められないので、遊んで決める。**天井の値は表に残し、隠さない。**
  if (ceiling > CEILING && !args.noceiling) reasons.push(
    `天井が近い戦闘がある（${(ceiling * 100).toFixed(0)}%、要${CEILING * 100}%以下）`);
  if (reasons.length) {
    // 数字も残す。**粗い篩が「落として安全か」を判断するのに要る**（理由の文字列では足りない）。
    rejected.push({ name, laws: pair, why: reasons.join(" / "),
      safeRate: Number(safeRate.toFixed(3)), winMedian: Number(winMedian.toFixed(3)),
      decided: Number(decided.toFixed(3)), flawlessReach: Number(ceiling.toFixed(3)) });
    return;
  }

  table.push({
    laws: pair, name,
    scales: perEnemy.map(e => Number(e.scale.toFixed(2))),
    atkScales: perEnemy.map(e => e.atkScale),
    modScales: perEnemy.map(e => e.modScale ?? 1),
    cycleCaps: perEnemy.map(e => e.cycleCap),
    enemyHp: perEnemy.map(e => e.hp),
    safeRate: Number(safeRate.toFixed(3)),
    winMedian: Number(winMedian.toFixed(3)),
    decided: Number(decided.toFixed(3)),
    flawlessReach: Number(ceiling.toFixed(3)),
    ceilings: ceilings.map(c => Number(c.toFixed(3))),
    ceilingPassed: ceiling <= CEILING
  });
});

// **一つの法則が表を占領しないようにする。**
//
// 最初の表は14組中9組が継電を含んでいた。継電は倍率を大きく上げるので、
// 他の法則と組んでも生成条件を通しやすい。結果、毎ラン継電が引かれ、作者は
// 「全然継電以外のルール来ないし、楽勝だし、もういいや」と書いた。**多様性が偽物だった。**
// 品質の良い順に採り、どの法則も規定数を超えないところで打ち切る。
if (args.enemies && Number(args.enemies) !== BASE.length && !args.emit) {
  throw new Error("敵を減らした状態では表を書けない（--emit=json の篩でだけ使う）");
}
if (args.emit === "json") {
  process.stdout.write(JSON.stringify({ table, rejected, checked: pairs.length }));
  process.exit(0);
}

const PER_LAW_CAP = Number(args.percap || 3);
const quality = row => row.flawlessReach + Math.abs(row.winMedian - 0.10);
const balanced = [];
const used = new Map();
[...table].sort((a, b) => quality(a) - quality(b)).forEach(row => {
  if (row.laws.some(id => (used.get(id) || 0) >= PER_LAW_CAP)) return;
  row.laws.forEach(id => used.set(id, (used.get(id) || 0) + 1));
  balanced.push(row);
});
table.length = 0;
table.push(...balanced);

table.sort((a, b) => a.name.localeCompare(b.name));
// .mjs で書き出す。JSON モジュール（import ... with { type: "json" }）は
// 端末によっては解釈できず、画面が丸ごと出なくなる（作者の iPhone で実際に起きた）。
writeFileSync("core/law-table.mjs",
  `// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**\n`
  + `//\n// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、\n`
  + `// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。\n\n`
  + `export const LAW_TABLE = ${JSON.stringify(table, null, 1)};\n\nexport default LAW_TABLE;\n`);

console.log(`# ${pairs.length}組を検証 → 合格 ${table.length}組（1法則あたり最大${PER_LAW_CAP}組）/ 不合格 ${rejected.length}組\n`);
table.forEach(row => console.log(
  `  ${row.name.padEnd(11)} 敵HP[${row.enemyHp.join(",")}] 攻×[${row.atkScales.join(",")}]`
  + `  詰みなし ${(row.safeRate * 100).toFixed(1)}%  勝てる並び ${(row.winMedian * 100).toFixed(0)}%`
  + `  順序 ${(row.decided * 100).toFixed(0)}%  天井 ${(row.flawlessReach * 100).toFixed(0)}%`));
if (rejected.length) {
  console.log("\n不合格");
  rejected.forEach(r => console.log(`  ${r.name.padEnd(11)} ${r.why}`));
}
