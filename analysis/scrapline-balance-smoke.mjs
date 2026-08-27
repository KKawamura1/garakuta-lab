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

// These stages contain the four regular questions and the two-wave boss for
// one deterministic encounter order. The order itself changes by seed; the
// balance invariant is about the questions, not their presentation order.
const stages = [0, 2, 3, 4, 6];
const kinds = stages.map((stage) => challengeFor(stage, 0).kind);
const solutionCounts = Object.fromEntries(kinds.map((kind) => [kind, 0]));
const examples = Object.fromEntries(kinds.map((kind) => [kind, []]));
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
}

console.log("scrapline balance smoke ok", JSON.stringify({
  builds: builds.length,
  checked,
  universalCount,
  solutionCounts,
  examples,
}));
