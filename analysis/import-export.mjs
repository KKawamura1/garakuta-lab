import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// D1 の export（1ラン1行の JSON）を analysis/human-runs/ の記録形式に落とす。
// これまで手作業でやっていた変換を再現可能にするためのもの。
// events_json にすでに完全な出来事列が入っているので、再生はせず trace を組み直すだけ。

const args = process.argv.slice(2);
const source = args.find(a => !a.startsWith("--"));
const only = (args.find(a => a.startsWith("--head=")) || "").slice(7);
const outDir = (args.find(a => a.startsWith("--out=")) || "--out=analysis/human-runs").slice(6);

if (!source) {
  console.error("usage: node analysis/import-export.mjs <export.json> [--head=play] [--out=dir]");
  process.exit(1);
}

const rows = JSON.parse(readFileSync(source, "utf8"));
const parse = value => (typeof value === "string" ? JSON.parse(value) : value);

function traceOf(row, events) {
  const stats = parse(row.stats_json) || {};
  const predicted = events.filter(e => e.type === "battle_predicted");
  const battles = events.filter(e => e.type === "battle_ended").map((e, i) => ({
    battleNumber: i + 1,
    enemy: e.enemy,
    won: e.won,
    cycles: e.cycles,
    hpBefore: e.hpBefore,
    hpAfter: e.hpAfter,
    hpLost: e.hpBefore - e.hpAfter,
    enemyHpLeft: e.enemyHpLeft,
    prediction: e.prediction,
    surprise: e.surprise,
    editsSincePrevious: predicted[i] ? predicted[i].editsSincePrevious : null,
    editBreakdown: predicted[i] ? predicted[i].editBreakdown || null : null,
    contributions: e.contributions
  }));
  const rewards = events.filter(e => e.type === "reward_chosen" || e.type === "reward_scrapped").map(e => ({
    wave: e.wave,
    offered: e.offered,
    chosen: e.chosen || null,
    passed: e.passed || [],
    update: e.update || "none"
  }));
  return {
    seed: stats.seed,
    ruleset: `${row.game_version}`.replace(/-(play|agentview)$/, ""),
    playerId: stats.playerId || "human",
    won: Boolean(row.won),
    reached: row.reached,
    finalHp: row.final_hp,
    battles,
    rewards,
    events
  };
}

let written = 0;
rows.forEach(row => {
  const head = /agentview$/.test(row.game_version) ? "agentview" : "play";
  if (only && head !== only) return;
  const events = parse(row.events_json) || [];
  const survey = parse(row.answers_json) || {};
  const stats = parse(row.stats_json) || {};
  const record = {
    seed: stats.seed,
    playerId: stats.playerId || "human",
    head,
    ruleset: `${row.game_version}`.replace(/-(play|agentview)$/, "").replace(/-0\.\d+$/, ""),
    survey,
    actionCount: stats.actionCount ?? null,
    reportedStats: stats,
    moments: events.filter(e => e.type === "emotion_marked").map(e => ({ seq: e.seq, wave: e.wave, phase: e.phase, kind: e.kind, note: e.note })),
    trace: traceOf(row, events)
  };
  const name = `human-${record.ruleset}-seed${record.seed}.json`;
  writeFileSync(join(outDir, name), `${JSON.stringify(record, null, 1)}\n`);
  console.log(`${name}  seed ${record.seed}  ${record.trace.won ? "勝ち" : "負け"}  replay ${survey.replay ?? "?"}`);
  written += 1;
});
console.log(`${written} 件`);
