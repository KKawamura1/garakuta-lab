import { ARC } from "./arc.mjs";

const PIVOT_THRESHOLD = 0.4;

function share(part, whole) {
  return whole > 0 ? Number((part / whole).toFixed(3)) : 0;
}

function slotDistance(a = [], b = []) {
  const length = Math.max(a.length, b.length, 1);
  let changed = 0;
  for (let i = 0; i < length; i += 1) if ((a[i] || null) !== (b[i] || null)) changed += 1;
  return changed / length;
}

export function describeRun(trace) {
  const events = trace.events || [];
  const battles = trace.battles || [];
  const predicted = events.filter(e => e.type === "battle_predicted");
  const ended = events.filter(e => e.type === "battle_ended");
  const rewards = events.filter(e => e.type === "reward_chosen" || e.type === "reward_scrapped");
  const markers = events.filter(e => e.type === "emotion_marked");

  const surprise = { better: 0, expected: 0, worse: 0 };
  ended.forEach(e => { surprise[e.surprise] = (surprise[e.surprise] || 0) + 1; });

  // 旧定義は「圧勝」と言い切る予測スタイルに依存していた。第3回で、慎重に予測する
  // プレイヤーでは同じ惰性を検出できないことが分かったので、予測から切り離す。
  // 無傷で勝った戦闘は、何を選んでも結果が変わらなかった戦闘である。
  const hpLostOf = i => (battles[i] ? battles[i].hpLost : null);
  const flawless = i => Boolean(ended[i].won) && hpLostOf(i) === 0;

  let deadTime = 0;
  for (let i = ended.length - 1; i >= 0; i -= 1) {
    if (!flawless(i)) break;
    deadTime += 1;
  }

  const flawlessBattles = ended.filter((_, i) => flawless(i)).length;
  const flawlessBattleRate = share(flawlessBattles, ended.length);

  // 構成に一切触れずに戦った戦闘。第3回で、退屈した人間だけが6戦中3戦、
  // エージェントは0〜2戦だった。自己申告を必要としない「判断が発生しなかった区間」の近似。
  const idleBattles = predicted.filter(e => (e.editsSincePrevious || 0) === 0).length;
  const idleBattleRate = share(idleBattles, predicted.length);

  const builds = predicted.map(e => e.build || []);
  let pivots = 0;
  for (let i = 1; i < builds.length; i += 1) if (slotDistance(builds[i - 1], builds[i]) >= PIVOT_THRESHOLD) pivots += 1;
  const pivotRate = share(pivots, Math.max(0, builds.length - 1));

  let reinterpretations = 0;
  const chosenNames = events.filter(e => e.type === "reward_chosen").map(e => e.chosen);
  for (let i = 1; i < builds.length; i += 1) {
    const before = builds[i - 1].filter(Boolean);
    const after = builds[i].filter(Boolean);
    const newPart = chosenNames[i - 1];
    const added = after.filter(name => name !== newPart && !before.includes(name));
    const dropped = before.filter(name => !after.includes(name));
    const reordered = builds[i].some((name, slot) => name && name !== newPart && builds[i - 1].includes(name) && builds[i - 1][slot] !== name);
    if (added.length || dropped.length || reordered) reinterpretations += 1;
  }
  const reinterpretationRate = share(reinterpretations, Math.max(0, builds.length - 1));

  // 位相を変える操作＝列に残ったまま枠が変わった部品。buildSignature（枠順の部品ID）から出る。
  // PHASE では「どの枠に置くか」が作動する巡回そのものを決めるので、これが機構の使用回数になる。
  const signatures = predicted.map(e => (e.buildSignature || "").split(","));
  let phaseMoves = 0;
  for (let i = 1; i < signatures.length; i += 1) {
    const before = signatures[i - 1];
    const after = signatures[i];
    after.forEach((id, slot) => {
      if (!id || id === "-") return;
      const was = before.indexOf(id);
      if (was >= 0 && was !== slot) phaseMoves += 1;
    });
  }
  const phaseMoveRate = share(phaseMoves, Math.max(0, signatures.length - 1));

  const byType = new Map();
  let totalOutput = 0;
  ended.forEach(e => (e.contributions || []).forEach(c => {
    const value = (c.damage || 0) + (c.shield || 0);
    byType.set(c.name, (byType.get(c.name) || 0) + value);
    totalOutput += value;
  }));
  const gateRanking = [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, share: share(value, totalOutput) }));
  const gateConcentration = gateRanking.length ? gateRanking[0].share : 0;

  const worries = predicted.map(e => e.worry);
  const worryCounts = worries.reduce((acc, worry) => acc.set(worry, (acc.get(worry) || 0) + 1), new Map());
  const worryConcentration = worries.length ? share(Math.max(...worryCounts.values()), worries.length) : 0;
  let worryChanges = 0;
  for (let i = 1; i < worries.length; i += 1) if (worries[i] !== worries[i - 1]) worryChanges += 1;
  const problemChainRate = share(worryChanges, Math.max(0, worries.length - 1));

  const updates = events.filter(e => e.type === "reward_chosen").map(e => e.update);
  const updateCounts = updates.reduce((acc, update) => acc.set(update, (acc.get(update) || 0) + 1), new Map());

  const levelOf = trace.predictionLevel || ARC.predictionLevel;
  const tension = predicted.map(e => levelOf(e.prediction));
  const tenseBattles = tension.filter(level => level <= 1).length;

  const markerCounts = markers.reduce((acc, m) => acc.set(m.kind, (acc.get(m.kind) || 0) + 1), new Map());

  const metrics = {
    seed: trace.seed,
    playerId: trace.playerId,
    won: trace.won,
    reached: trace.reached,
    finalHp: trace.finalHp,
    battles: ended.length,
    surprise,
    deadTime,
    flawlessBattles,
    flawlessBattleRate,
    idleBattles,
    idleBattleRate,
    phaseMoves,
    phaseMoveRate,
    pivotRate,
    reinterpretationRate,
    gateConcentration,
    gateRanking: gateRanking.slice(0, 3),
    worryConcentration,
    problemChainRate,
    worryCounts: Object.fromEntries(worryCounts),
    updateCounts: Object.fromEntries(updateCounts),
    tensionCurve: tension,
    tenseBattleRate: share(tenseBattles, tension.length),
    markerCounts: Object.fromEntries(markerCounts),
    markerTotal: markers.length,
    rewardsTaken: events.filter(e => e.type === "reward_chosen").length,
    rewardsSkipped: events.filter(e => e.type === "reward_scrapped").length,
    rewardCount: rewards.length
  };
  metrics.warnings = warningsFor(metrics);
  return metrics;
}

export function warningsFor(m) {
  const warnings = [];
  if (m.deadTime >= 2) warnings.push({ code: "dead_time", detail: `末尾に無傷勝利が${m.deadTime}戦続いた（決着後の惰性）` });
  if (m.flawlessBattleRate >= 0.5 && m.battles >= 3) warnings.push({ code: "no_pressure", detail: `${Math.round(m.flawlessBattleRate * 100)}%の戦闘を無傷で勝った（圧力が無い）` });
  if (m.idleBattleRate >= 0.5 && m.battles >= 3) warnings.push({ code: "idle_build", detail: `${Math.round(m.idleBattleRate * 100)}%の戦闘を、構成に触れずに戦った（判断が発生していない）` });
  if (m.gateConcentration > 0.5) warnings.push({ code: "single_gate", detail: `出力の${Math.round(m.gateConcentration * 100)}%が${m.gateRanking[0]?.name}に集中` });
  if (m.worryConcentration >= 0.6 && m.battles >= 3) warnings.push({ code: "single_worry", detail: `不安の${Math.round(m.worryConcentration * 100)}%が一つの機能に集中` });
  if (m.problemChainRate < 0.34 && m.battles >= 3) warnings.push({ code: "no_problem_chain", detail: "問題が入れ替わらず同じ不足が続いた" });
  if (m.pivotRate === 0 && m.battles >= 3) warnings.push({ code: "no_pivot", detail: "稼働列が一度も大きく変わらなかった" });
  if (m.reinterpretationRate === 0 && m.battles >= 3) warnings.push({ code: "no_reinterpretation", detail: "既存部品の評価が一度も変わらなかった" });
  if (m.tenseBattleRate === 0 && m.battles >= 3) warnings.push({ code: "no_tension", detail: "一度も苦戦を予期しなかった" });
  return warnings;
}

export function summarize(runs) {
  if (!runs.length) return null;
  const mean = key => Number((runs.reduce((sum, r) => sum + (r[key] || 0), 0) / runs.length).toFixed(3));
  const counts = new Map();
  runs.forEach(r => r.warnings.forEach(w => counts.set(w.code, (counts.get(w.code) || 0) + 1)));
  return {
    runs: runs.length,
    winRate: mean("won"),
    meanReached: mean("reached"),
    meanDeadTime: mean("deadTime"),
    meanFlawlessBattleRate: mean("flawlessBattleRate"),
    meanIdleBattleRate: mean("idleBattleRate"),
    meanPhaseMoves: mean("phaseMoves"),
    meanPivotRate: mean("pivotRate"),
    meanReinterpretationRate: mean("reinterpretationRate"),
    meanGateConcentration: mean("gateConcentration"),
    meanProblemChainRate: mean("problemChainRate"),
    meanWorryConcentration: mean("worryConcentration"),
    meanTenseBattleRate: mean("tenseBattleRate"),
    warningRates: Object.fromEntries([...counts.entries()].map(([code, n]) => [code, Number((n / runs.length).toFixed(3))]))
  };
}
