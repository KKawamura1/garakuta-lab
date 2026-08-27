import assert from "node:assert/strict";
import {
  MAX_STAGES,
  VERSION,
  challengeFor,
  createGame,
  offersFor,
  recommendedPolicy,
} from "../scrapline/engine.mjs";

const runs = [];
const challengeSequences = new Set();
const openingPatterns = new Set();
const offerSets = new Set();

for (let seed = 0; seed < 256; seed += 1) {
  const run = recommendedPolicy(seed);
  runs.push(run);
  assert.equal(run.version, VERSION, `seed ${seed} uses the current ruleset`);
  assert.ok(run.done && run.won && run.stage === MAX_STAGES, `seed ${seed} has a complete legal winning line`);

  const initial = createGame(seed);
  openingPatterns.add(initial.starterPattern);
  challengeSequences.add(Array.from({ length: MAX_STAGES }, (_, stage) => challengeFor(stage, seed).kind).join(","));
  offerSets.add(offersFor({ ...initial, stage: 0 }).map((car) => car.id).join(","));
}

assert.equal(runs.length, 256);
assert.equal(openingPatterns.size, 2, "both readable starter patterns occur");
assert.ok(challengeSequences.size >= 16, "seeded encounter order does not collapse to one route");
assert.ok(offerSets.size >= 16, "seeded salvage choices do not collapse to one offer set");

console.log("scrapline seed regression ok", JSON.stringify({
  version: VERSION,
  seeds: runs.length,
  uniqueRecommendedTrains: new Set(runs.map((run) => run.activeCars.join(","))).size,
  uniqueChallengeSequences: challengeSequences.size,
  uniqueOpeningPatterns: openingPatterns.size,
  uniqueOpeningOfferSets: offerSets.size,
}));
