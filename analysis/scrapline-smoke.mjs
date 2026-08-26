import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CARS,
  MAX_CARS,
  MAX_STAGES,
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
import { buildScraplinePayload, ensureTelemetry, recordTelemetry } from "../scrapline/telemetry.mjs";

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

assert.equal(VERSION, "scrapline-0.2");
assert.equal(CARS.length, 11);
assert.equal(new Set(CARS.map((car) => car.id)).size, CARS.length);
assert.equal(challengeFor(0).id, "sparrows");
assert.equal(challengeFor(MAX_STAGES - 1).id, "core");

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

const reverseState = { ...a, activeCars: ["charge", "magnet", "reverse"] };
const reverseBattle = runBattle(reverseState);
assert.ok(reverseBattle.report.events.some((event) => event.type === "car" && event.path === "reverse"), "reverse car must expose its return pass");
const splitterBattle = runBattle({ ...a, stage: 4, activeCars: ["charge"] });
assert.ok(splitterBattle.report.events.some((event) => event.type === "enemy_split"), "the splitter threat must visibly create a second target");

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

const appSource = await readFile(new URL("../scrapline/app.js", import.meta.url), "utf8");
assert.doesNotMatch(appSource, /\b(alert|prompt|confirm)\s*\(/, "the route must use in-page controls");
assert.match(appSource, /localStorage/);
assert.match(appSource, /scrapline-state-v1-seed/);
assert.match(appSource, /sendScraplineTelemetry/);
assert.match(appSource, /startReplay/);
assert.match(appSource, /retry-send/);
assert.match(appSource, /salvage-row/);

console.log("scrapline smoke ok", JSON.stringify({ version: VERSION, stages: fullRun.stage, events: payload.events.length }));
