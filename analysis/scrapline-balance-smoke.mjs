import assert from "node:assert/strict";
import { cpus } from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import {
  CARS,
  MAX_CARS,
  challengeFor,
  createGame,
  runBattle,
} from "../scrapline/engine.mjs";

const carIds = CARS.map((car) => car.id);
const stages = Array.from({ length: 7 }, (_, stage) => stage);
const kinds = stages.map((stage) => challengeFor(stage, 0).kind);

function enumerate(prefix, builds) {
  if (prefix.length) builds.push(prefix);
  if (prefix.length >= MAX_CARS) return;
  for (const carId of carIds) {
    if (!prefix.includes(carId)) enumerate([...prefix, carId], builds);
  }
}

function emptySummary() {
  return {
    checked: 0,
    universalCount: 0,
    solutionCounts: Object.fromEntries(kinds.map((kind) => [kind, 0])),
    examples: Object.fromEntries(kinds.map((kind) => [kind, []])),
    mechanismSignatures: Object.fromEntries(kinds.map((kind) => [kind, []])),
  };
}

if (!isMainThread) {
  const builds = [];
  enumerate([], builds);
  const summary = emptySummary();

  for (let index = workerData.shard; index < builds.length; index += workerData.shards) {
    const activeCars = builds[index];
    let winsEveryQuestion = true;
    for (const stage of stages) {
      const report = runBattle({ ...createGame(0), stage, activeCars, phase: "build" }).report;
      summary.checked += 1;
      const kind = challengeFor(stage, 0).kind;
      if (report.won) {
        summary.solutionCounts[kind] += 1;
        if (summary.examples[kind].length < 4) summary.examples[kind].push(activeCars);
        const events = report.events;
        const mechanisms = [
          events.some((event) => event.type === "car" && event.carId === "cut" && event.afterProjectiles?.length > event.beforeProjectiles?.length) ? "split" : null,
          events.some((event) => event.projectile?.compressed && event.damage > 0) ? "heavy" : null,
          events.some((event) => ["impact", "impact_splash"].includes(event.type) && event.projectile?.mode === "molten" && event.damage > 0) ? "molten" : null,
          events.some((event) => event.type === "return_reprocess") ? "return" : null,
          events.some((event) => event.type === "enemy_attack" && event.absorbed > 0) ? "armor" : null,
          events.some((event) => event.type === "collector_gain") ? "collector" : null,
          events.some((event) => event.type === "fire" && event.projectiles?.some((projectile) => projectile.speed > 1)) ? "speed" : null,
        ].filter(Boolean);
        summary.mechanismSignatures[kind].push(mechanisms.sort().join("+") || "plain");
      } else {
        winsEveryQuestion = false;
      }
    }
    if (winsEveryQuestion) summary.universalCount += 1;
  }

  summary.buildCount = builds.length;
  parentPort.postMessage(summary);
  parentPort.close();
} else {
  const workerCount = Math.max(1, Math.min(8, cpus().length || 1));
  const summaries = await Promise.all(Array.from({ length: workerCount }, (_, shard) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { type: "module", workerData: { shard, shards: workerCount } });
    worker.once("message", (summary) => {
      resolve(summary);
      worker.terminate();
    });
    worker.once("error", reject);
  })));

  const buildCount = summaries[0]?.buildCount || 0;
  assert.ok(summaries.every((summary) => summary.buildCount === buildCount), "workers enumerate the same complete train space");
  assert.equal(buildCount, 64471, "all ordered trains up to five cars are enumerated");

  const merged = emptySummary();
  for (const summary of summaries) {
    merged.checked += summary.checked;
    merged.universalCount += summary.universalCount;
    for (const kind of kinds) {
      merged.solutionCounts[kind] += summary.solutionCounts[kind];
      merged.examples[kind].push(...summary.examples[kind]);
      merged.examples[kind] = merged.examples[kind].slice(0, 4);
      merged.mechanismSignatures[kind].push(...summary.mechanismSignatures[kind]);
    }
  }

  assert.equal(merged.checked, buildCount * stages.length);
  assert.equal(merged.universalCount, 0, "no one ordered train dominates every enemy question");
  for (const kind of kinds) {
    assert.ok(merged.solutionCounts[kind] >= 2, kind + " keeps at least two distinct solutions");
    assert.ok(new Set(merged.examples[kind].map((build) => build.join(","))).size >= 2, kind + " examples are distinct trains");
    assert.ok(new Set(merged.mechanismSignatures[kind]).size >= 2, kind + " can be cleared through more than one observed mechanism signature");
  }

  console.log("scrapline balance smoke ok", JSON.stringify({
    builds: buildCount,
    checked: merged.checked,
    workers: workerCount,
    universalCount: merged.universalCount,
    solutionCounts: merged.solutionCounts,
    mechanismSignatures: Object.fromEntries(Object.entries(merged.mechanismSignatures).map(([kind, signatures]) => [kind, new Set(signatures).size])),
    examples: merged.examples,
  }));
}
