import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CARS,
  MAX_CARS,
  MAX_STAGES,
  MAX_VOLLEYS,
  VERSION,
  challengeFor,
  continueFromReport,
  createGame,
  installCar,
  moveCar,
  offersFor,
  previewTrain,
  recommendedPolicy,
  removeCar,
  runBattle,
} from "../scrapline/engine.mjs";
import {
  buildScraplinePayload,
  enqueueScraplinePayload,
  ensureTelemetry,
  flushScraplineTelemetryQueue,
  recordTelemetry,
} from "../scrapline/telemetry.mjs";

const stable = (state) => ({
  version: state.version,
  seed: state.seed,
  stage: state.stage,
  hull: state.hull,
  armor: state.armor,
  storedMass: state.storedMass,
  activeCars: state.activeCars,
  phase: state.phase,
  done: state.done,
  won: state.won,
});

assert.equal(VERSION, "scrapline-0.5");
assert.equal(CARS.length, 11);
assert.equal(MAX_VOLLEYS, 5);
assert.equal(new Set(CARS.map((car) => car.id)).size, CARS.length);
assert.equal(challengeFor(0).id, "sparrows");
assert.equal(challengeFor(MAX_STAGES - 1).id, "core");
assert.equal(challengeFor(0, 12).id, "sparrows");
assert.ok(new Set(Array.from({ length: 12 }, (_, seed) => challengeFor(1, seed).id)).size > 1, "later encounter questions vary by seed");

const a = createGame(12);
const b = createGame(12);
assert.deepEqual(stable(a), stable(b), "same seed creates the same initial train");
assert.notEqual(createGame(12).seed, createGame(13).seed);
assert.notEqual(createGame().seed, 0, "unseeded runs should not fall back to seed zero");
assert.equal(new Set([createGame(0).starterPattern, createGame(3).starterPattern]).size, 2, "the run starts from one of two readable patterns");

assert.deepEqual(offersFor(a).map((car) => car.id), offersFor(createGame(12)).map((car) => car.id));
assert.equal(offersFor(a).length, 3);
assert.equal(new Set(offersFor(a).map((car) => car.id)).size, 3);

const chargeThenMelt = { ...a, activeCars: ["charge", "melt"] };
const meltThenCharge = { ...a, activeCars: ["melt", "charge"] };
assert.notEqual(previewTrain(chargeThenMelt).summary, previewTrain(meltThenCharge).summary, "vehicle order changes the payload");
assert.match(previewTrain(chargeThenMelt).summary, /♨/);
assert.doesNotMatch(previewTrain(meltThenCharge).summary, /♨/);

const acceleratorThenCut = { ...a, activeCars: ["accelerator", "cut"] };
const cutThenAccelerator = { ...a, activeCars: ["cut", "accelerator"] };
assert.notEqual(previewTrain(acceleratorThenCut).summary, previewTrain(cutThenAccelerator).summary, "acceleration before cutting changes fragment speed");
assert.notEqual(previewTrain(acceleratorThenCut).travel, previewTrain(cutThenAccelerator).travel, "speed order changes arrival time");

const magnetThenMelt = { ...a, activeCars: ["magnet", "melt"] };
const meltThenMagnet = { ...a, activeCars: ["melt", "magnet"] };
assert.match(previewTrain(magnetThenMelt).summary, /💥/);
assert.doesNotMatch(previewTrain(meltThenMagnet).summary, /💥/);

const scarPreview = previewTrain({ ...a, activeCars: ["scar"], hull: 7 });
assert.match(scarPreview.summary, /^3/);
const loopPreview = previewTrain({ ...a, activeCars: ["loop", "charge", "melt"] });
assert.ok(loopPreview.events.some((event) => event.path === "loop" && event.carId === "charge"), "loop replays the cars behind it");

const withCars = installCar(installCar(a, "charge"), "melt");
assert.deepEqual(withCars.activeCars, ["accelerator", "charge", "melt"]);
const moved = moveCar(withCars, 1, 2);
assert.deepEqual(moved.activeCars, ["accelerator", "melt", "charge"]);
const removed = removeCar(moved, 1);
assert.deepEqual(removed.activeCars, ["accelerator", "charge"]);
let full = a;
for (const id of ["charge", "melt", "magnet", "reverse", "loop"]) full = installCar(full, id);
assert.equal(full.activeCars.length, MAX_CARS);
assert.equal(installCar(full, "press").activeCars.length, MAX_CARS, "a full train does not silently grow");
assert.deepEqual(installCar(withCars, "charge").activeCars, withCars.activeCars, "duplicate cars are not stackable upgrades");
assert.deepEqual(removeCar(a, 0).activeCars, a.activeCars, "the last processing car cannot be removed");

const reverseState = { ...a, activeCars: ["charge", "magnet", "reverse"] };
const reverseBattle = runBattle(reverseState);
assert.ok(reverseBattle.report.events.some((event) => event.type === "car" && event.path === "reverse"), "reverse car must expose its return pass");
const splitterBattle = runBattle({ ...a, stage: 4, activeCars: ["charge"] });
assert.ok(splitterBattle.report.events.some((event) => event.type === "enemy_split"), "the splitter threat must visibly create a second target");

const lateShow = runBattle({ ...a, stage: 6, activeCars: ["loop", "cut", "magnet", "reverse", "charge"] });
assert.ok(lateShow.report.events.some((event) => event.type === "return_reprocess" && event.projectiles.length >= 8), "loop + reverse must create a visibly larger return volley");
assert.ok(lateShow.report.events.some((event) => event.type === "car" && event.beforeProjectiles && event.afterProjectiles), "each car event keeps before/after projectile snapshots");
const armourCounter = runBattle({ ...a, stage: 6, activeCars: ["armor"] });
assert.ok(armourCounter.report.events.some((event) => event.type === "enemy_shell" && event.location?.carIndex !== undefined), "enemy fire has a visible target location");
assert.ok(armourCounter.report.events.some((event) => event.type === "enemy_attack" && event.convertedMass > 0), "armour can turn a caught shell into next-shot material");
const bossNeedsReturn = runBattle({ ...a, stage: 6, activeCars: ["charge", "melt"] });
assert.equal(bossNeedsReturn.report.won, false, "a single molten recipe must not erase the boss question");

const solutionLines = {
  1: [["accelerator", "cut"], ["charge", "melt"]],
  2: [["accelerator", "cut"], ["charge", "melt"]],
  3: [["accelerator", "cut"], ["charge", "melt"]],
  4: [["accelerator", "collector"], ["charge", "melt"]],
  5: [["charge", "melt"], ["magnet", "collector"]],
  6: [["charge", "melt", "magnet", "reverse"], ["accelerator", "melt", "magnet", "reverse"]],
};
for (const [stage, builds] of Object.entries(solutionLines)) {
  for (const activeCars of builds) {
    assert.equal(runBattle({ ...createGame(0), stage: Number(stage), activeCars, phase: "build" }).report.won, true, `challenge at stage ${stage} keeps multiple solution lines`);
  }
}

const badState = { ...a, activeCars: ["armor"], hull: 8 };
const badBattle = runBattle(badState);
assert.equal(badBattle.state.done, true);
assert.equal(badBattle.state.won, false);
assert.equal(badBattle.state.reason, "敵を撃破できなかった");

const fullRunReport = recommendedPolicy(12);
assert.equal(fullRunReport.done, true);
assert.equal(fullRunReport.won, true);
assert.equal(fullRunReport.stage, MAX_STAGES);
const fullRun = continueFromReport(fullRunReport);
assert.equal(fullRun.phase, "done");
assert.match(fullRun.reason, /7ステージ/);
const sampledRuns = Array.from({ length: 16 }, (_, seed) => recommendedPolicy(seed));
assert.ok(sampledRuns.every((run) => run.won && run.stage === MAX_STAGES), "each sampled seed has at least one winnable line");
assert.ok(new Set(sampledRuns.map((run) => run.activeCars.join(","))).size > 3, "winnable lines do not collapse to one build");

ensureTelemetry(fullRun);
recordTelemetry(fullRun, { type: "smoke_completed", stage: fullRun.stage });
const payload = buildScraplinePayload(fullRun, { deviceId: "smoke-device" });
assert.equal(payload.gameVersion, VERSION);
assert.equal(payload.deviceId, "smoke-device");
assert.equal(payload.client.head, "scrapline");
assert.equal(payload.outcome.reached, MAX_STAGES);
assert.ok(payload.stats.starterPattern);
assert.ok(Array.isArray(payload.events));
assert.equal(payload.events.length, 1);

const eventful = runBattle({ ...a, activeCars: ["accelerator"] });
assert.ok(eventful.report.events.some((event) => event.type === "car" && Number.isInteger(event.carIndex) && Array.isArray(event.train)));
assert.ok(eventful.report.events.some((event) => event.type === "enemy_attack" && event.targetCarId));

assert.equal(typeof enqueueScraplinePayload, "function");
assert.equal(typeof flushScraplineTelemetryQueue, "function");

const appSource = await readFile(new URL("../scrapline/app.js", import.meta.url), "utf8");
assert.doesNotMatch(appSource, /\b(alert|prompt|confirm)\s*\(/, "the route must use in-page controls");
assert.match(appSource, /localStorage/);
assert.match(appSource, /scrapline-state-v1-seed/);
assert.match(appSource, /sendScraplineTelemetry/);
assert.match(appSource, /startReplay/);
assert.match(appSource, /retry-send/);
assert.match(appSource, /salvage-row/);
assert.match(appSource, /data-drag-slot/);
assert.match(appSource, /enemyPreviewMarkup/);
assert.match(appSource, /playEventCue/);
assert.match(appSource, /flushScraplineTelemetryQueue/);
assert.match(appSource, /serviceWorker/);
const indexSource = await readFile(new URL("../scrapline/index.html", import.meta.url), "utf8");
assert.match(indexSource, /manifest\.webmanifest/);
const swSource = await readFile(new URL("../scrapline/sw.js", import.meta.url), "utf8");
assert.match(swSource, /scrapline-static-v4/);
const manifestSource = await readFile(new URL("../scrapline/manifest.webmanifest", import.meta.url), "utf8");
assert.match(manifestSource, /standalone/);
const implementationMap = await readFile(new URL("./SCRAPLINE_IMPLEMENTATION.md", import.meta.url), "utf8");
assert.match(implementationMap, /8つの境界/);
assert.match(implementationMap, /iPhone Safari/);

console.log("scrapline smoke ok", JSON.stringify({ version: VERSION, stages: fullRun.stage, events: payload.events.length }));
