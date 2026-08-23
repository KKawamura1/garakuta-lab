#!/usr/bin/env node

import fs from "node:fs";

const args = process.argv.slice(2);
const runsPath = args.find((arg) => !arg.startsWith("--"));
const momentsPath = args.filter((arg) => !arg.startsWith("--"))[1];
const outputArg = args.find((arg) => arg.startsWith("--output="));

if (!runsPath) {
  console.error("Usage: node analyze-mutate-decision.mjs runs-readable.json [moments-readable.json] [--output=report.md]");
  process.exit(1);
}

const runs = JSON.parse(fs.readFileSync(runsPath, "utf8"));
const moments = momentsPath ? JSON.parse(fs.readFileSync(momentsPath, "utf8")) : [];
const mutateRuns = runs
  .filter((run) => /^mutate-0\.[12]-play$/.test(run.game_version))
  .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));

const round = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const p = 10 ** digits;
  return Math.round(value * p) / p;
};

const pct = (numerator, denominator) => denominator ? `${round((numerator / denominator) * 100, 1)}%` : "—";
const eventSeq = (event) => Number(event.seq ?? 0);
const eventsFor = (run) => {
  let events = [];
  if (Array.isArray(run.events)) events = run.events;
  if (!events.length && typeof run.events_json === "string") events = JSON.parse(run.events_json);
  return events.slice().sort((a, b) => eventSeq(a) - eventSeq(b));
};
const statsFor = (run) => {
  if (run.stats && typeof run.stats === "object") return run.stats;
  if (typeof run.stats_json === "string") return JSON.parse(run.stats_json);
  return {};
};
const answersFor = (run) => {
  if (run.answers && typeof run.answers === "object") return run.answers;
  if (typeof run.answers_json === "string") return JSON.parse(run.answers_json);
  return {};
};

const typeOf = (event) => event.chipType ?? event.chip_type ?? "unknown";
const chipOf = (event) => event.chip ?? typeOf(event);
const targetIdOf = (event, side = "to") => event[`${side}PartId`] ?? event[`${side}_part_id`] ?? event[side] ?? "unknown";
const targetTypeOf = (event, side = "to") => event[`${side}Type`] ?? event[`${side}_type`] ?? event[side] ?? "unknown";
const signature = (event) => String(event.buildSignature ?? event.build_signature ?? "").split(",").filter(Boolean);

const hamming = (a, b) => {
  if (!a.length || !b.length) return null;
  const n = Math.max(a.length, b.length);
  let distance = 0;
  for (let index = 0; index < n; index += 1) {
    if (a[index] !== b[index]) distance += 1;
  }
  return distance;
};

const battleResult = (event) => ({
  wave: event.wave ?? null,
  enemy: event.enemy ?? null,
  won: Boolean(event.won),
  cycles: Number(event.cycles ?? event.turns ?? 0),
  hpBefore: Number(event.hpBefore ?? event.hp_before ?? 0),
  hpAfter: Number(event.hpAfter ?? event.hp_after ?? 0),
  grade: event.grade ?? null,
  seq: eventSeq(event),
});

// This is intentionally a simple, explicit ordering proxy. It is not a causal
// claim because adjacent battles normally use different enemies.
const outcomeImproved = (before, after) => {
  if (!before || !after) return null;
  if (Number(after.won) !== Number(before.won)) return Number(after.won) > Number(before.won);
  if (after.hpAfter !== before.hpAfter) return after.hpAfter > before.hpAfter;
  return after.cycles < before.cycles;
};

const escaped = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const fmtResult = (result) => result ? `${result.won ? "勝" : "負"}/${result.cycles}T/HP${result.hpAfter}` : "—";
const fmtNumber = (value) => value === null || value === undefined ? "—" : String(value);

function analyseRun(run) {
  const events = eventsFor(run);
  const stats = statsFor(run);
  const answers = answersFor(run);
  const battles = events.filter((event) => event.type === "battle_ended").map(battleResult);
  const predictions = events.filter((event) => event.type === "battle_predicted");
  const moves = events.filter((event) => event.type === "chip_moved");
  const rewards = events.filter((event) => ["reward_chosen", "reward_scrapped"].includes(event.type));

  const moveRows = moves.map((move, index) => {
    const previousBattle = battles.filter((battle) => battle.seq < eventSeq(move)).at(-1) ?? null;
    const nextBattle = battles.find((battle) => battle.seq > eventSeq(move)) ?? null;
    const previousPrediction = predictions.filter((prediction) => eventSeq(prediction) < eventSeq(move)).at(-1) ?? null;
    const nextPrediction = predictions.find((prediction) => eventSeq(prediction) > eventSeq(move)) ?? null;
    const intervalMoves = moves.filter((candidate) => {
      const candidateSeq = eventSeq(candidate);
      const left = previousPrediction ? eventSeq(previousPrediction) : -Infinity;
      const right = nextPrediction ? eventSeq(nextPrediction) : Infinity;
      return candidateSeq > left && candidateSeq < right;
    });
    const priorReward = rewards.filter((reward) => eventSeq(reward) < eventSeq(move)).at(-1) ?? null;
    const afterReward = Boolean(priorReward && (move.wave == null || priorReward.wave == null || priorReward.wave === move.wave));
    const beforeSignature = signature(previousPrediction);
    const afterSignature = signature(nextPrediction);
    const improved = outcomeImproved(previousBattle, nextBattle);

    return {
      index: index + 1,
      seq: eventSeq(move),
      wave: move.wave ?? null,
      chip: chipOf(move),
      chipType: typeOf(move),
      from: targetIdOf(move, "from"),
      to: targetIdOf(move, "to"),
      fromType: targetTypeOf(move, "from"),
      toType: targetTypeOf(move, "to"),
      previousBattle,
      nextBattle,
      improved,
      noImprovement: improved === null ? null : !improved,
      hpDelta: previousBattle && nextBattle ? nextBattle.hpAfter - previousBattle.hpAfter : null,
      turnDelta: previousBattle && nextBattle ? nextBattle.cycles - previousBattle.cycles : null,
      previousPrediction,
      nextPrediction,
      configDistance: hamming(beforeSignature, afterSignature),
      intervalMoveCount: intervalMoves.length,
      afterReward,
      rewardType: priorReward?.type ?? null,
      reward: priorReward?.reward ?? priorReward?.part ?? null,
    };
  });

  const byChip = new Map();
  for (const move of moveRows) {
    const key = move.chipType;
    if (!byChip.has(key)) byChip.set(key, []);
    byChip.get(key).push(move);
  }

  const chipRows = [...byChip.entries()].map(([chipType, chipMoves]) => {
    const destinations = chipMoves.map((move) => move.to);
    const destinationTypes = chipMoves.map((move) => move.toType);
    const directReversals = chipMoves.slice(1).filter((move, index) => {
      const previous = chipMoves[index];
      return move.from === previous.to && move.to === previous.from;
    }).length;
    const repeatedDestinations = chipMoves.slice(1).filter((move, index) => chipMoves.slice(0, index + 1).some((previous) => previous.to === move.to)).length;
    const returnToPriorSource = chipMoves.slice(1).filter((move, index) => chipMoves.slice(0, index + 1).some((previous) => previous.from === move.to)).length;
    const distances = [...new Set(chipMoves.map((move) => move.configDistance).filter((distance) => distance !== null))];
    const noImprovement = chipMoves.filter((move) => move.noImprovement === true).length;
    const afterReward = chipMoves.filter((move) => move.afterReward).length;
    return {
      chipType,
      moves: chipMoves.length,
      uniqueTargetTypes: [...new Set(destinationTypes)],
      uniqueTargetIds: [...new Set(destinations)],
      directReversals,
      repeatedDestinations,
      returnToPriorSource,
      noImprovement,
      comparableMoves: chipMoves.filter((move) => move.noImprovement !== null).length,
      afterReward,
      distances,
      meanConfigDistance: distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null,
      rows: chipMoves,
    };
  });

  const eventMarkers = events
    .filter((event) => ["insight", "choice", "friction", "hit", "unclear"].includes(event.kind) && event.text)
    .map((event) => ({ kind: event.kind, text: event.text, seq: eventSeq(event) }));
  const runMoments = moments
    .filter((moment) => moment.run_id === run.run_id || moment.runId === run.run_id)
    .map((moment) => ({ kind: moment.kind, text: moment.note ?? moment.label ?? "", seq: Number(moment.event_seq ?? 0) }));
  const markers = [...eventMarkers, ...runMoments].filter((marker) => marker.text);

  return {
    run,
    seed: stats.seed ?? run.seed ?? null,
    stats,
    answers,
    events,
    battles,
    predictions,
    moves,
    rewards,
    moveRows,
    chipRows,
    markers,
    survey: answers,
  };
}

const analysed = mutateRuns.map(analyseRun);
const allChipRows = analysed.flatMap((run) => run.chipRows.map((row) => ({ ...row, run })));
const allMoveRows = analysed.flatMap((run) => run.moveRows.map((row) => ({ ...row, run })));
const comparableMoves = allMoveRows.filter((row) => row.noImprovement !== null);

function makeReport() {
  const lines = [];
  lines.push("# EXP-01 MUTATION 決定分析（既存4ラン）");
  lines.push("");
  lines.push(`入力ラン: ${analysed.length}件（${analysed.map((item) => `seed${item.seed}/${item.run.game_version}`).join(", ")}）`);
  lines.push("ゲーム本体のコード・数値・効果は変更していない。D1の既存 `runs-readable.json` / `moments-readable.json` を読み、イベント順だけから集計した。");
  lines.push("");
  lines.push("## 集計定義");
  lines.push("");
  lines.push("- 配置先の種類数: `chip_moved.toType` のユニーク数。併せて部品IDのユニーク数も出す。");
  lines.push("- 同じ配置への往復: 直前の移動を逆向きに戻る `A→B→A` と、過去に一度でも同じ宛先IDへ戻る反復を分ける。");
  lines.push("- 5スロット構成距離: 移動前後に観測された隣接 `battle_predicted.buildSignature` のハミング距離。複数移動が同じ戦闘間隔に入る場合、その距離は各移動に同じ区間値として付く。");
  lines.push("- 移動前後の勝敗・ターン・HP: 移動直前の最後の実戦 `battle_ended` と、移動直後の最初の実戦を対応付ける。改善は `勝利 > HP > 少ないターン` の単純な順序で、敵が変わるため因果判定ではない。");
  lines.push("- 改善なし: 上記の単純順序で厳密な改善にならない移動。対応する実戦がないものは分母から外す。");
  lines.push("- 通常報酬後: 直前に同じwaveの `reward_chosen` または `reward_scrapped` がある移動。");
  lines.push("");

  lines.push("## チップ別・ラン別");
  lines.push("");
  lines.push("| seed | version | chip | 移動数 | 配置先種類数 | 配置先ID数 | 直前逆戻り | 宛先反復 | 改善なし | 通常報酬後 | 5-slot距離（観測区間） | preview数 |");
  lines.push("|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|");
  for (const row of allChipRows.sort((a, b) => Number(a.run.seed) - Number(b.run.seed) || a.chipType.localeCompare(b.chipType))) {
    lines.push(`| ${row.run.seed} | ${row.run.run.game_version} | ${escaped(row.chipType)} | ${row.moves} | ${row.uniqueTargetTypes.length} | ${row.uniqueTargetIds.length} | ${row.directReversals} | ${row.repeatedDestinations} | ${row.noImprovement}/${row.comparableMoves} (${pct(row.noImprovement, row.comparableMoves)}) | ${row.afterReward}/${row.moves} | ${row.distances.join(", ") || "—"}（平均${fmtNumber(round(row.meanConfigDistance))}） | ${statsFor(row.run.run).previewCount ?? "—"} |`);
  }
  lines.push("");

  lines.push("## 移動単位: 前後の実戦結果・構成距離・報酬後か");
  lines.push("");
  lines.push("| seed | chip# | chip | wave | 配置変更 | 前の実戦 | 後の実戦 | Δturn | ΔHP | 改善 | 5-slot距離 | 報酬後 | 区間内移動数 |");
  lines.push("|---:|---:|---|---:|---|---|---|---:|---:|---|---:|---|---:|");
  for (const row of allMoveRows.sort((a, b) => Number(a.run.seed) - Number(b.run.seed) || a.seq - b.seq)) {
    const result = row.improved === null ? "判定不能" : row.improved ? "あり" : "なし";
    lines.push(`| ${row.run.seed} | ${row.index} | ${escaped(row.chipType)} | ${fmtNumber(row.wave)} | ${escaped(row.from)}→${escaped(row.to)} | ${fmtResult(row.previousBattle)} | ${fmtResult(row.nextBattle)} | ${fmtNumber(row.turnDelta)} | ${fmtNumber(row.hpDelta)} | ${result} | ${fmtNumber(row.configDistance)} | ${row.afterReward ? `yes(${row.rewardType ?? "reward"})` : "no"} | ${row.intervalMoveCount} |`);
  }
  lines.push("");

  lines.push("## ラン別の補助事実");
  lines.push("");
  lines.push("| seed | 勝敗/到達 | 実戦数 | 全移動 | 比較可能移動 | 改善なし移動率 | 通常報酬後移動率 | 5-slot距離の観測値 | semantic marker | search/friction marker |");
  lines.push("|---:|---|---:|---:|---:|---:|---:|---|---|---|");
  for (const item of analysed.sort((a, b) => Number(a.seed) - Number(b.seed))) {
    const noImprovement = item.moveRows.filter((row) => row.noImprovement === true).length;
    const comparable = item.moveRows.filter((row) => row.noImprovement !== null).length;
    const afterReward = item.moveRows.filter((row) => row.afterReward).length;
    const distances = [...new Set(item.moveRows.map((row) => row.configDistance).filter((distance) => distance !== null))];
    const semantic = item.markers.filter((marker) => ["insight", "choice", "hit"].includes(marker.kind)).map((marker) => `${marker.kind}:${marker.text}`).join(" / ") || "—";
    const search = item.markers.filter((marker) => ["friction", "unclear"].includes(marker.kind)).map((marker) => `${marker.kind}:${marker.text}`).join(" / ") || "—";
    lines.push(`| ${item.seed} | ${item.run.won ? "win" : "loss"}/${item.run.reached ?? "—"} | ${item.battles.length} | ${item.moves.length} | ${comparable} | ${noImprovement}/${comparable} (${pct(noImprovement, comparable)}) | ${afterReward}/${item.moves.length} (${pct(afterReward, item.moves.length)}) | ${distances.join(", ") || "—"} | ${escaped(semantic)} | ${escaped(search)} |`);
  }
  lines.push("");

  lines.push("## 「意味のある再解釈」と「総当たり探索」を分けるために観測できる事実");
  lines.push("");
  lines.push("このログだけでプレイヤーの意図を断定はしない。以下は、それぞれを支持し得る観測可能な手掛かりを分離したもの。");
  lines.push("");
  lines.push("### 再解釈側の手掛かり");
  lines.push("");
  for (const item of analysed.sort((a, b) => Number(a.seed) - Number(b.seed))) {
    const markers = item.markers.filter((marker) => ["insight", "choice", "hit"].includes(marker.kind));
    const surveyText = item.survey && Object.keys(item.survey).length ? JSON.stringify(item.survey, null, 0) : "";
    const answerText = typeof surveyText === "string" ? surveyText : JSON.stringify(surveyText);
    if (markers.length || answerText) {
      lines.push(`- seed${item.seed}: ${markers.map((marker) => `${marker.kind}「${marker.text}」`).join(" / ") || "markerなし"}${answerText ? `; survey「${answerText}」` : ""}`);
    }
  }
  lines.push("");
  lines.push("### 総当たり側の手掛かり");
  lines.push("");
  for (const item of analysed.sort((a, b) => Number(a.seed) - Number(b.seed))) {
    const stats = item.stats;
    const repeats = item.chipRows.reduce((sum, row) => sum + row.directReversals + row.repeatedDestinations, 0);
    const friction = item.markers.filter((marker) => marker.kind === "friction").map((marker) => marker.text).join(" / ");
    lines.push(`- seed${item.seed}: preview ${stats.previewCount ?? "—"}回、移動 ${item.moves.length}回、直前逆戻り ${item.chipRows.reduce((sum, row) => sum + row.directReversals, 0)}回、宛先反復 ${item.chipRows.reduce((sum, row) => sum + row.repeatedDestinations, 0)}回${friction ? `、friction「${friction}」` : ""}。`);
  }
  lines.push("");
  lines.push("## ログ上の限界");
  lines.push("");
  lines.push("- `chip_moved` は移動イベントだが、各移動直後の完全な5スロット状態を持たない。そのため5-slot距離は、隣接する実戦予測の構成間距離であり、個々の移動への厳密な寄与量ではない。");
  lines.push("- 0.1ログでは、追加発動の内部効果や各プレビューの詳細が保存されていない。preview数はrun statsの集計値のみ使う。");
  lines.push("- 移動前後の実戦は別の敵を含むため、改善なし率は行動の因果効果ではなく、前後実戦結果の記述的な代理値である。");
  lines.push("- したがって、意味理解・総当たりの最終分類、結論、次の実験設計はここでは行わず、Sol側に残す。");
  return `${lines.join("\n")}\n`;
}

const report = makeReport();
if (outputArg) fs.writeFileSync(outputArg.slice("--output=".length), report);
process.stdout.write(report);
