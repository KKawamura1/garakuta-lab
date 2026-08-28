import assert from "node:assert/strict";
import {
  CARS,
  MAX_CARS,
  challengeFor,
  createGame,
  runBattle,
} from "../scrapline/engine.mjs";

const carIds = CARS.map((car) => car.id);
const builds = [];
const enumerate = (prefix) => {
  if (prefix.length) builds.push(prefix);
  if (prefix.length >= MAX_CARS) return;
  for (const carId of carIds) {
    if (!prefix.includes(carId)) enumerate([...prefix, carId]);
  }
};
enumerate([]);

// Check the whole seven-encounter pressure curve. Repeated questions are
// deliberately harder, so a fixed train that only beats the tutorial form
// must not be counted as a universal answer.
const stages = Array.from({ length: 7 }, (_, stage) => stage);
const kinds = stages.map((stage) => challengeFor(stage, 0).kind);
const solutionCounts = Object.fromEntries(kinds.map((kind) => [kind, 0]));
const examples = Object.fromEntries(kinds.map((kind) => [kind, []]));
const mechanismSignatures = Object.fromEntries(kinds.map((kind) => [kind, new Set()]));
let checked = 0;
let universalCount = 0;

for (const activeCars of builds) {
  let winsEveryQuestion = true;
  for (const stage of stages) {
    const report = runBattle({ ...createGame(0), stage, activeCars, phase: "build" }).report;
    checked += 1;
    const kind = challengeFor(stage, 0).kind;
    if (report.won) {
      solutionCounts[kind] += 1;
      if (examples[kind].length < 4) examples[kind].push(activeCars);
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
      mechanismSignatures[kind].add(mechanisms.sort().join("+") || "plain");
    } else {
      winsEveryQuestion = false;
    }
  }
  if (winsEveryQuestion) universalCount += 1;
}

assert.equal(builds.length, 64471, "all ordered trains up to five cars are enumerated");
assert.equal(checked, builds.length * stages.length);
assert.equal(universalCount, 0, "no one ordered train dominates every enemy question");
for (const kind of kinds) {
  assert.ok(solutionCounts[kind] >= 2, `${kind} keeps at least two distinct solutions`);
  assert.ok(new Set(examples[kind].map((build) => build.join(","))).size >= 2, `${kind} examples are distinct trains`);
  assert.ok(mechanismSignatures[kind].size >= 2, `${kind} can be cleared through more than one observed mechanism signature`);
}

console.log("scrapline balance smoke ok", JSON.stringify({
  builds: builds.length,
  checked,
  universalCount,
  solutionCounts,
  mechanismSignatures: Object.fromEntries(Object.entries(mechanismSignatures).map(([kind, signatures]) => [kind, signatures.size])),
  examples,
}));
