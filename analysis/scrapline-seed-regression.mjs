import assert from "node:assert/strict";
import { cpus } from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import {
  MAX_STAGES,
  VERSION,
  challengeFor,
  createGame,
  offersFor,
  recommendedPolicy,
} from "../scrapline/engine.mjs";

const SEED_COUNT = 256;

if (!isMainThread) {
  parentPort.on("message", ({ seed, close }) => {
    if (close) {
      parentPort.close();
      return;
    }
    try {
      const run = recommendedPolicy(seed);
      parentPort.postMessage({
        seed,
        run: {
          version: run.version,
          done: run.done,
          won: run.won,
          stage: run.stage,
        },
      });
    } catch (error) {
      parentPort.postMessage({ seed, error: error?.stack || String(error) });
    }
  });
} else {
  const workerCount = Math.max(1, Math.min(8, cpus().length || 1));
  let nextSeed = 0;

  const batches = await Promise.all(Array.from({ length: workerCount }, () => new Promise((resolve, reject) => {
    if (nextSeed >= SEED_COUNT) {
      resolve([]);
      return;
    }

    const worker = new Worker(new URL(import.meta.url), { type: "module" });
    const results = [];

    worker.on("message", (message) => {
      if (message.error) {
        worker.terminate();
        reject(new Error(message.error));
        return;
      }

      results.push(message);
      if (nextSeed < SEED_COUNT) {
        worker.postMessage({ seed: nextSeed });
        nextSeed += 1;
      } else {
        worker.postMessage({ close: true });
        worker.terminate();
        resolve(results);
      }
    });
    worker.on("error", reject);

    worker.postMessage({ seed: nextSeed });
    nextSeed += 1;
  })));

  const bySeed = batches.flat().sort((a, b) => a.seed - b.seed);
  assert.equal(bySeed.length, SEED_COUNT);

  const runs = [];
  const challengeSequences = new Set();
  const openingPatterns = new Set();
  const offerSets = new Set();

  for (const entry of bySeed) {
    const { seed, run } = entry;
    const sequence = Array.from({ length: MAX_STAGES }, (_, stage) => challengeFor(stage, seed).kind);
    assert.equal(sequence[0], "swarm", \`seed \${seed} opens with the readable swarm\`);
    assert.notEqual(sequence[1], "swarm", \`seed \${seed} does not repeat the opening question\`);
    assert.deepEqual(new Set(sequence.slice(0, MAX_STAGES - 1)), new Set(["swarm", "armor", "fast", "scavenger"]), \`seed \${seed} presents all four regular questions before the boss\`);
    assert.ok(sequence.slice(1).every((kind, index) => kind !== sequence[index]), \`seed \${seed} never repeats a question consecutively\`);

    runs.push(run);
    assert.equal(run.version, VERSION, \`seed \${seed} uses the current ruleset\`);
    assert.ok(run.done && run.won && run.stage === MAX_STAGES, \`seed \${seed} has a complete legal winning line\`);

    const initial = createGame(seed);
    openingPatterns.add(initial.starterPattern);
    challengeSequences.add(sequence.join(","));
    offerSets.add(offersFor({ ...initial, stage: 0 }).map((car) => car.id).join(","));
  }

  assert.equal(runs.length, SEED_COUNT);
  assert.equal(openingPatterns.size, 2, "both readable starter patterns occur");
  assert.ok(challengeSequences.size >= 16, "seeded encounter order does not collapse to one route");
  assert.ok(offerSets.size >= 16, "seeded salvage choices do not collapse to one offer set");

  console.log("scrapline seed regression ok", JSON.stringify({
    version: VERSION,
    seeds: runs.length,
    workers: workerCount,
    uniqueRecommendedTrains: "checked in recommendedPolicy workers",
    uniqueChallengeSequences: challengeSequences.size,
    uniqueOpeningPatterns: openingPatterns.size,
    uniqueOpeningOfferSets: offerSets.size,
  }));
}
