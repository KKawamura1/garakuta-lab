import assert from "node:assert/strict";
import {
  MAX_CARS,
  MAX_HULL,
  continueFromReport,
  createGame,
  installCar,
  revealReport,
  runBattle,
  skipReward,
} from "../scrapline/engine.mjs";

function rewardCandidates(state) {
  const candidates = [skipReward(state)];
  for (const offer of state.offers) {
    if (state.activeCars.length < MAX_CARS) candidates.push(installCar(state, offer.id));
    else {
      for (let slot = 0; slot < state.activeCars.length; slot += 1) {
        candidates.push(installCar(state, offer.id, slot));
      }
    }
  }
  return candidates;
}

function noReorderChoice(state) {
  const scored = rewardCandidates(state).map((candidate, index) => {
    const result = runBattle({ ...candidate, collectReports: false });
    const remainingHp = result.report.waveReports.reduce((sum, wave) => sum + wave.hp, 0);
    return {
      candidate,
      score: Number(result.report.won) * 100000
        + result.report.hullAfter * 100
        - remainingHp * 10
        - candidate.activeCars.length
        - index / 100,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].candidate;
}

const POLICIES = {
  noReorder: (state) => noReorderChoice(state),
  appendOnly: (state) => state.activeCars.length < MAX_CARS
    ? installCar(state, state.offers[0].id)
    : skipReward(state),
  skipAfterStage3: (state) => state.stage >= 3 ? skipReward(state) : noReorderChoice(state),
};

function play(seed, chooseReward) {
  let state = createGame(seed);
  state.collectReports = false;
  const reports = [];
  for (let guard = 0; guard < 40 && !state.done; guard += 1) {
    if (state.phase === "build") {
      const battle = runBattle(state);
      reports.push(battle.report);
      state = battle.state;
    } else if (state.phase === "report") {
      state = continueFromReport(revealReport(state));
    } else if (state.phase === "reward") {
      state = chooseReward(state);
    }
  }
  return { state, reports };
}

const summary = {};
for (const [name, policy] of Object.entries(POLICIES)) {
  let damaged = 0;
  let failed = 0;
  let lateAttrition = 0;
  let repairs = 0;
  for (let seed = 0; seed < 256; seed += 1) {
    const run = play(seed, policy);
    const attacks = run.reports.flatMap((report) => report.events).filter((event) => event.type === "enemy_attack" && event.damage > 0);
    const repairEvents = run.reports.flatMap((report) => report.events).filter((event) => event.type === "repair");
    if (attacks.length) damaged += 1;
    if (!(run.state.done && run.state.won)) failed += 1;
    if (run.reports.some((report) => report.stage >= 3 && report.hullAfter < MAX_HULL)) lateAttrition += 1;
    assert.ok(repairEvents.every((event) => event.amount <= 1), "automatic repair never erases more than one hull");
    repairs += repairEvents.length;
  }
  assert.ok(damaged >= Math.ceil(256 * 0.95), `${name} takes real damage in at least 95% of seeds`);
  assert.ok(failed >= Math.ceil(256 * 0.25), `${name} cannot erase the later decisions in at least 25% of seeds`);
  assert.ok(lateAttrition > 0, `${name} can carry damage beyond the opening questions`);
  summary[name] = { damaged, failed, lateAttrition, repairs };
}

console.log("scrapline run policy smoke ok", JSON.stringify(summary));
