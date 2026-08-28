import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MAX_STAGES,
  continueFromReport,
  createGame,
  endRunEarly,
  installCar,
  revealReport,
  runBattle,
} from "../scrapline/engine.mjs";
import {
  SURVEY_SCALES,
  bestShowcaseReport,
  causalHighlights,
  reportDisclosure,
  selectReplayEvents,
} from "../scrapline/presentation.mjs";
import {
  SCRAPLINE_SCHEMA_VERSION,
  buildScraplinePayload,
  ensureTelemetry,
  recordTelemetry,
  sendScraplineCheckpoint,
} from "../scrapline/telemetry.mjs";

assert.deepEqual(SURVEY_SCALES.fun, { low: "退屈だった", high: "面白かった" });
assert.deepEqual(SURVEY_SCALES.replay, { low: "一度で十分", high: "もう一度試したい" });

const hiddenReport = {
  won: true,
  outcome: "won",
  hullAfter: 7,
  events: [{ type: "wave_clear", target: "敵", note: "敵を撃破" }],
};
assert.deepEqual(reportDisclosure(hiddenReport, false), {
  revealed: false,
  outcome: null,
  hullAfter: null,
  highlights: [],
  canContinue: false,
});
assert.equal(reportDisclosure(hiddenReport, true).canContinue, true);

const reverseReport = {
  won: true,
  outcome: "won",
  events: [
    { type: "car", carId: "charge", before: "2", after: "2⚡1" },
    { type: "return_reprocess", projectiles: Array.from({ length: 8 }, (_, index) => ({ id: `p${index}` })), spectacle: { level: 5 } },
    { type: "impact", damage: 10, target: "炉心" },
    { type: "wave_clear", target: "炉心", note: "炉心を撃破" },
  ],
};
assert.equal(causalHighlights(reverseReport)[0].type, "return_reprocess", "the highest-impact return pass is not omitted");
assert.ok(causalHighlights(reverseReport).some((event) => event.type === "impact"), "large damage is retained");

const lossReport = {
  won: false,
  outcome: "lost",
  reason: "列車が大破",
  events: [
    { type: "wave_clear", target: "護衛", note: "護衛を撃破" },
    { type: "enemy_attack", damage: 8, note: "車体に直撃" },
    { type: "battle_end", won: false, reason: "列車が大破" },
  ],
};
const lossHighlights = causalHighlights(lossReport);
assert.ok(lossHighlights.some((event) => event.type === "enemy_attack"));
assert.notEqual(lossHighlights.at(-1).type, "wave_clear", "an intermediate kill is not presented as the loss outcome");

const mutualHighlights = causalHighlights({ ...lossReport, outcome: "mutual", challenge: "炉心を喰う王" });
assert.equal(mutualHighlights.at(-1).type, "mutual_destruction");

const quiet = { stage: 1, events: [{ type: "fire", spectacle: { level: 1, projectileCount: 1 } }, { type: "impact", damage: 1 }] };
const spectacular = { stage: 4, events: [{ type: "fire", spectacle: { level: 5, projectileCount: 8, returning: 8, molten: 4 } }, { type: "return_reprocess", projectiles: Array(8).fill({}) }, { type: "impact_splash", damage: 12 }] };
assert.equal(bestShowcaseReport([spectacular, quiet]).stage, 4, "the full run, not the last battle, chooses the final showcase");

const longReplay = [{ type: "battle_start" }];
for (let volley = 1; volley <= 4; volley += 1) {
  longReplay.push({ type: "volley", wave: 0, volley });
  for (let carIndex = 0; carIndex < 5; carIndex += 1) longReplay.push({ type: "car", carId: `v${volley}-car${carIndex}`, wave: 0, volley });
  longReplay.push({ type: "fire", wave: 0, volley, spectacle: { level: volley + 1, projectileCount: volley * 2 } });
  longReplay.push({ type: "enemy_approach", wave: 0, volley });
  for (let hit = 0; hit < 8; hit += 1) longReplay.push({ type: "impact", wave: 0, volley, damage: hit + 1 });
  if (volley === 4) longReplay.push({ type: "return_reprocess", wave: 0, volley, projectiles: Array(8).fill({}) });
}
longReplay.push({ type: "wave_clear", wave: 0, volley: 4 }, { type: "battle_end", won: true });
const selectedReplay = selectReplayEvents(longReplay, 32);
assert.equal(selectedReplay.length, 32);
assert.equal(selectedReplay[0].type, "battle_start");
assert.equal(selectedReplay.at(-1).type, "battle_end");
assert.ok(selectedReplay.some((event) => event.type === "wave_clear"));
assert.ok(selectedReplay.some((event) => event.type === "return_reprocess"));
for (let carIndex = 0; carIndex < 5; carIndex += 1) {
  assert.ok(selectedReplay.some((event) => event.carId === `v4-car${carIndex}`), "the most spectacular volley keeps its complete processing chain");
}

let state = runBattle(createGame(0)).state;
assert.equal(state.phase, "report");
assert.equal(state.reportRevealed, false);
assert.equal(continueFromReport(state).phase, "report", "the engine refuses to continue before replay disclosure");
state = continueFromReport(revealReport(state));
assert.equal(state.phase, "reward");
assert.equal(state.offerHistory.length, 1);
assert.equal(state.offerHistory[0].offers.length, 3);
assert.ok(state.offerHistory[0].nextChallenge.id, "the presented set records the visible next enemy");
const offered = state.offers[0].id;
const before = [...state.activeCars];
state = installCar(state, offered);
assert.deepEqual(state.offerHistory[0].decision.before, before);
assert.deepEqual(state.offerHistory[0].decision.after, state.activeCars);
assert.equal(state.offerHistory[0].decision.carId, offered);

let partial = createGame(12);
ensureTelemetry(partial, "2026-08-27T00:00:00.000Z");
recordTelemetry(partial, { type: "run_started", seed: partial.seed }, "2026-08-27T00:00:01.000Z");
partial.offerHistory.push({ stage: 1, offers: [{ id: "cut" }, { id: "press" }, { id: "melt" }], decision: null });
const checkpointPayload = buildScraplinePayload(partial, { deviceId: "partial-device" });
assert.equal(SCRAPLINE_SCHEMA_VERSION, 5);
assert.equal(checkpointPayload.outcome.status, "in_progress");
assert.equal(checkpointPayload.outcome.complete, false);
assert.equal(checkpointPayload.stats.offerHistory[0].offers.length, 3);
partial = endRunEarly(partial);
const earlyPayload = buildScraplinePayload(partial, { deviceId: "partial-device" });
assert.equal(earlyPayload.outcome.status, "abandoned");
assert.equal(earlyPayload.outcome.complete, true);
assert.equal(earlyPayload.outcome.endedEarly, true);
assert.equal(typeof sendScraplineCheckpoint, "function");

const appSource = await readFile(new URL("../scrapline/app.js", import.meta.url), "utf8");
assert.match(appSource, /data-disclosure="replaying"/);
assert.match(appSource, /reportDisclosure\(report, state\.reportRevealed\)/);
assert.match(appSource, /data-scale-direction="low-to-high"/);
assert.doesNotMatch(appSource, /例:\s*(磁石|溶解車|どの車両)/, "free answers are not seeded with concrete car hypotheses");
assert.match(appSource, /function bindTrainControls/);
assert.match(appSource, /NEXT QUESTION \/ 選択後の敵/);
assert.match(appSource, /交換先を選択してください/);
assert.match(appSource, /pagehide/);
assert.match(appSource, /sendScraplineCheckpoint/);
assert.match(appSource, /ここまでを記録して終了/);
assert.match(appSource, /enemy_approach/);
assert.match(appSource, /data-event=/);

console.log("scrapline presentation smoke ok", JSON.stringify({ schema: SCRAPLINE_SCHEMA_VERSION, offerSets: state.offerHistory.length }));
