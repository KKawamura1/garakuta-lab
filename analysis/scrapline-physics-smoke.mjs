import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MAX_STAGES,
  challengeFor,
  createGame,
  previewTrain,
  runBattle,
} from "../scrapline/engine.mjs";

const seed = 0;
const regularKinds = ["swarm", "armor", "fast", "scavenger"];
const stageByKind = new Map();
for (let stage = 0; stage < MAX_STAGES - 1; stage += 1) {
  const kind = challengeFor(stage, seed).kind;
  if (!stageByKind.has(kind)) stageByKind.set(kind, stage);
}
assert.deepEqual(new Set(stageByKind.keys()), new Set(regularKinds));

const shortTrain = ["charge"];
const longTrain = ["charge", "reverse", "collector", "scar", "loop"];
assert.ok(previewTrain({ ...createGame(seed), activeCars: longTrain }).travel
  > previewTrain({ ...createGame(seed), activeCars: shortTrain }).travel);

const beforeFirstImpact = (report) => {
  const end = report.events.findIndex((event) => ["impact", "impact_splash", "impact_blocked"].includes(event.type));
  return end < 0 ? report.events : report.events.slice(0, end);
};

const pressure = {};
for (const kind of regularKinds) {
  const stage = stageByKind.get(kind);
  const short = runBattle({ ...createGame(seed), stage, activeCars: shortTrain, phase: "build" }).report;
  const long = runBattle({ ...createGame(seed), stage, activeCars: longTrain, phase: "build" }).report;
  const shortOpening = beforeFirstImpact(short);
  const longOpening = beforeFirstImpact(long);
  const shortFire = shortOpening.find((event) => event.type === "fire");
  const longFire = longOpening.find((event) => event.type === "fire");
  const shortApproach = shortOpening.find((event) => event.type === "enemy_approach");
  const longApproach = longOpening.find((event) => event.type === "enemy_approach");
  const shortAttacks = shortOpening.filter((event) => event.type === "enemy_attack").length;
  const longAttacks = longOpening.filter((event) => event.type === "enemy_attack").length;

  assert.equal(shortApproach.amount, shortFire.travel, `${kind} advances only by short travel`);
  assert.equal(longApproach.amount, longFire.travel, `${kind} advances only by long travel`);
  assert.ok(longFire.travel > shortFire.travel, `${kind} sees the longer physical flight`);
  assert.ok(longAttacks >= shortAttacks, `${kind} never gives a long train less pre-impact pressure`);
  assert.ok(longAttacks > 0, `${kind} can attack before a sufficiently late shot lands`);
  pressure[kind] = { shortTravel: shortFire.travel, longTravel: longFire.travel, shortAttacks, longAttacks };
}

const engineSource = await readFile(new URL("../scrapline/engine.mjs", import.meta.url), "utf8");
assert.doesNotMatch(engineSource, /activeCars\.length\s*===\s*4/, "no exact four-car combat exception remains");
const advanceSource = engineSource.match(/function advanceEnemyBeforeImpact[\s\S]*?\n}\n/)?.[0] || "";
assert.match(advanceSource, /enemy\.approach \+= gained/);
assert.doesNotMatch(advanceSource, /if\s*\([^)]*enemy\.(kind|id|name)|activeCars\.length/, "approach pressure is shared physics, not an enemy or train-name exception");

console.log("scrapline physics smoke ok", JSON.stringify(pressure));
