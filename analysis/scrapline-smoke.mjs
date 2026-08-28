import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BUILD_STAMP,
  CARS,
  CHALLENGES,
  MAX_CARS,
  MAX_HULL,
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
  revealReport,
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

assert.equal(VERSION, "scrapline-0.7");
assert.match(BUILD_STAMP, /^scrapline-build-20260828-r8$/);
assert.equal(CARS.length, 11);
assert.equal(MAX_CARS, 5);
assert.equal(MAX_VOLLEYS, 6);
assert.equal(MAX_STAGES, 7);
assert.equal(CHALLENGES.length, 5, "four regular enemy questions plus one boss");
assert.deepEqual(new Set(CHALLENGES.map((challenge) => challenge.kind)), new Set(["swarm", "armor", "fast", "scavenger", "boss"]));
assert.ok(CHALLENGES.every((challenge) => challenge.waves.every((wave) => Number.isFinite(wave.attack) && Number.isFinite(wave.attackInterval))), "every enemy wave has concrete timing and attack data");
assert.equal(new Set(CARS.map((car) => car.id)).size, CARS.length);
assert.equal(new Set(CARS.filter((car) => car.rarity === "rare").map((car) => car.id)).size, 3);
assert.equal(CARS.filter((car) => car.rarity === "common").length, 7);
assert.equal(challengeFor(0).id, "sparrows");
assert.equal(challengeFor(MAX_STAGES - 1).id, "core");
assert.equal(challengeFor(0, 12).id, "sparrows");
assert.ok(challengeFor(4, 0).waves[0].attack > 0, "the fast cannon has a real attack value");
assert.ok(new Set(Array.from({ length: 32 }, (_, seed) => challengeFor(1, seed).id)).size > 1, "later encounter questions vary by seed");

const a = createGame(12);
const b = createGame(12);
const canonical = createGame(0);
const stageForKind = (kind) => Array.from({ length: MAX_STAGES - 1 }, (_, stage) => stage)
  .find((stage) => challengeFor(stage, canonical.seed).kind === kind);
assert.deepEqual(stable(a), stable(b), "same seed creates the same initial train");
assert.deepEqual(
  runBattle({ ...canonical, stage: 2, activeCars: ["charge", "melt"], phase: "build" }).report,
  runBattle({ ...canonical, stage: 2, activeCars: ["charge", "melt"], phase: "build" }).report,
  "the same seed and placement produce the same battle events",
);
assert.notEqual(createGame(12).seed, createGame(13).seed);
assert.notEqual(createGame().seed, 0, "unseeded runs should not fall back to seed zero");
assert.equal(new Set([createGame(0).starterPattern, createGame(3).starterPattern]).size, 2, "the run starts from two readable patterns");

for (let seed = 0; seed < 32; seed += 1) {
  for (let stage = 0; stage < MAX_STAGES - 1; stage += 1) {
    const offerState = { ...createGame(seed), stage };
    const offers = offersFor(offerState);
    assert.equal(offers.length, 3, `three salvage choices at seed ${seed}, stage ${stage}`);
    assert.equal(new Set(offers.map((car) => car.id)).size, 3, "salvage choices are distinct");
    assert.ok(offers.every((car) => !offerState.activeCars.includes(car.id)), "offers do not duplicate the current train");
  }
}
assert.deepEqual(offersFor(a).map((car) => car.id), offersFor(createGame(12)).map((car) => car.id));

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
assert.match(previewTrain(magnetThenMelt).summary, /♨/);
assert.match(previewTrain(magnetThenMelt).summary, /💥/, "magnet before melt arms a returning blast");
assert.doesNotMatch(previewTrain(meltThenMagnet).summary, /💥/);

const cutThenPress = previewTrain({ ...a, activeCars: ["cut", "press"] });
const pressThenCut = previewTrain({ ...a, activeCars: ["press", "cut"] });
assert.equal(cutThenPress.projectiles.length, 1, "cut then press recombines the split pieces");
assert.equal(pressThenCut.projectiles.length, 2, "press then cut keeps two denser fragments");

const armorPreview = previewTrain({ ...a, activeCars: ["armor"] });
assert.match(armorPreview.events[0].note, /装甲板/);
assert.equal(armorPreview.projectiles[0].mass, 1, "armour formation spends one unit and leaves the remainder");
const collectorPreview = previewTrain({ ...a, activeCars: ["collector"] });
assert.equal(collectorPreview.projectiles[0].collected, true);
const scarPreview = previewTrain({ ...a, activeCars: ["scar"], hull: 7 });
assert.match(scarPreview.summary, /^3/);
for (const car of CARS) {
  const singleCarPreview = previewTrain({ ...a, activeCars: [car.id] });
  assert.ok(singleCarPreview.events.some((event) => event.carId === car.id), `${car.id} has a visible physical action`);
}
const loopPreview = previewTrain({ ...a, activeCars: ["loop", "charge", "melt"] });
assert.ok(loopPreview.events.some((event) => event.path === "loop" && event.carId === "charge"), "loop replays only the cars behind it");

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
assert.deepEqual(installCar(full, "press", 2).activeCars, ["accelerator", "charge", "press", "magnet", "reverse"], "full train can replace a selected slot");

const reverseState = { ...a, activeCars: ["charge", "magnet", "reverse"] };
const reverseBattle = runBattle(reverseState);
assert.ok(reverseBattle.report.events.some((event) => event.type === "car" && event.path === "reverse"), "reverse car exposes its return pass");
assert.ok(reverseBattle.report.events.some((event) => event.type === "return"), "magnet emits a returning projectile");

const lateShow = runBattle({ ...canonical, stage: MAX_STAGES - 1, activeCars: ["magnet", "reverse", "loop", "cut", "accelerator"], phase: "build" });
assert.equal(lateShow.report.won, true, "a late multi-stage line remains a viable build");
assert.ok(lateShow.report.events.some((event) => event.type === "return_reprocess" && event.projectiles.length >= 8), "loop + cut + reverse creates the eight-projectile return volley");
assert.ok(lateShow.report.events.some((event) => event.type === "car" && event.beforeProjectiles && event.afterProjectiles), "each car event keeps before/after projectile snapshots");

const swarmCounter = runBattle({ ...canonical, stage: 0, activeCars: ["press"], phase: "build" });
assert.equal(swarmCounter.report.won, false, "a single slow lump is stopped by the swarm formation");
assert.ok(swarmCounter.report.events.some((event) => event.type === "impact_blocked"));
assert.equal(runBattle({ ...canonical, stage: 0, activeCars: ["cut"], phase: "build" }).report.won, true, "splitting is a swarm solution");
assert.ok(runBattle({ ...canonical, stage: 0, activeCars: ["charge", "melt"], phase: "build" }).report.events.some((event) => event.type === "impact_splash"), "molten damage is a second swarm solution");

const armourStage = stageForKind("armor");
const armourCounter = runBattle({ ...canonical, stage: armourStage, activeCars: ["accelerator", "cut", "press"], phase: "build" });
assert.equal(armourCounter.report.won, true, "dense weight is an armour solution");
assert.ok(runBattle({ ...canonical, stage: armourStage, activeCars: ["charge", "melt"], phase: "build" }).report.won, "molten force is a second armour solution");
const armourAttrition = runBattle({ ...canonical, stage: armourStage, activeCars: ["charge"], phase: "build" });
assert.equal(armourAttrition.report.won, true, "the starter can still break through with damage");
assert.ok(armourAttrition.report.hullAfter < MAX_HULL && armourAttrition.report.events.some((event) => event.type === "impact_blocked"), "the fallback pays visible attrition rather than bypassing armour");

const fastStage = stageForKind("fast");
const fastCounter = runBattle({ ...canonical, stage: fastStage, activeCars: ["accelerator"], phase: "build" });
assert.equal(fastCounter.report.won, true, "a short accelerated line beats the fast cannon");
const fastLong = runBattle({ ...canonical, stage: fastStage, activeCars: ["accelerator", "press", "charge", "melt", "magnet"], phase: "build" });
assert.equal(fastLong.report.won, false, "raw power does not erase the fast cannon's time question");
assert.ok(fastLong.report.events.some((event) => event.type === "enemy_attack" && event.damage > 0));
assert.ok(fastLong.report.events.some((event) => event.type === "impact_blocked"), "a shot arriving after the reaction line is visibly intercepted");
assert.ok(fastLong.report.events.findIndex((event) => event.type === "enemy_attack") < fastLong.report.events.findIndex((event) => event.type === "impact_blocked"), "the long line pays its time cost before its first hit");
assert.ok(runBattle({ ...canonical, stage: fastStage, activeCars: ["press"], phase: "build" }).report.won, "a different one-car heavy line also beats the fast cannon");

const scavengerStage = stageForKind("scavenger");
const scavengerCounter = runBattle({ ...canonical, stage: scavengerStage, activeCars: ["charge", "collector"], phase: "build" });
assert.equal(scavengerCounter.report.won, true, "the collector protects a line from the scavenger");
assert.ok(scavengerCounter.report.events.some((event) => event.type === "collector_gain"));
assert.ok(scavengerCounter.report.events.some((event) => event.type === "enemy_repelled"));
const scavengerLoss = runBattle({ ...canonical, stage: scavengerStage, activeCars: ["charge", "cut"], phase: "build" });
assert.equal(scavengerLoss.report.won, false);
assert.ok(scavengerLoss.report.events.some((event) => event.type === "car_stolen_confirmed"), "an unprotected tail is actually removed");
assert.ok(scavengerLoss.report.events.some((event) => event.type === "enemy_recover"), "the scavenger can recover from a nonlethal hit");
assert.ok(runBattle({ ...canonical, stage: scavengerStage, activeCars: ["accelerator", "press"], phase: "build" }).report.won, "early destruction is a second scavenger solution");

const armourShell = runBattle({ ...canonical, stage: MAX_STAGES - 1, activeCars: ["armor"], phase: "build" });
assert.ok(armourShell.report.events.some((event) => event.type === "enemy_shell" && event.location?.carIndex !== undefined), "enemy fire has a visible target location");
assert.ok(armourShell.report.events.some((event) => event.type === "enemy_attack" && event.convertedMass > 0), "armour can turn a caught shell into next-shot material");
const bossReturn = runBattle({ ...canonical, stage: MAX_STAGES - 1, activeCars: ["accelerator", "press", "charge", "magnet", "reverse"], phase: "build" });
assert.equal(bossReturn.report.won, true, "a non-molten return line answers the boss");
assert.ok(bossReturn.report.events.some((event) => event.type === "return_reprocess"));
const bossMolten = runBattle({ ...canonical, stage: MAX_STAGES - 1, activeCars: ["accelerator", "cut", "melt", "magnet", "reverse"], phase: "build" });
assert.equal(bossMolten.report.won, true, "a molten return line answers the boss differently");
assert.ok(bossMolten.report.events.some((event) => event.type === "return_reprocess" && event.summary.includes("💥")));
const bossNeedsReturn = runBattle({ ...canonical, stage: MAX_STAGES - 1, activeCars: ["charge", "melt"], phase: "build" });
assert.equal(bossNeedsReturn.report.won, false, "one short molten pair does not erase the boss's two-wave question");

const mutual = runBattle({ ...canonical, stage: fastStage, hull: 2, activeCars: ["accelerator", "press"], phase: "build" });
assert.equal(mutual.report.won, false);
assert.equal(mutual.report.enemyDefeated, true);
assert.equal(mutual.report.outcome, "mutual");
assert.equal(mutual.state.outcomeStatus, "mutual");
assert.match(mutual.state.reason, /同時/);

const badState = { ...canonical, activeCars: ["charge", "melt"], hull: 8, stage: MAX_STAGES - 1, phase: "build" };
const badBattle = runBattle(badState);
assert.equal(badBattle.state.done, true);
assert.equal(badBattle.state.won, false);
assert.match(badBattle.state.reason, /撃破|大破/);

const fullRunReport = recommendedPolicy(12);
assert.equal(fullRunReport.version, VERSION);
assert.equal(fullRunReport.done, true);
assert.equal(fullRunReport.won, true);
assert.equal(fullRunReport.stage, MAX_STAGES);
const fullRun = continueFromReport(revealReport(fullRunReport));
assert.equal(fullRun.phase, "done");
assert.match(fullRun.reason, /7ステージ/);
const sampledRuns = [0, 3, 65, 255].map((seed) => recommendedPolicy(seed));
assert.ok(sampledRuns.every((run) => run.won && run.stage === MAX_STAGES), "sampled seeds keep at least one complete line");

ensureTelemetry(fullRun);
recordTelemetry(fullRun, { type: "smoke_completed", stage: fullRun.stage });
const payload = buildScraplinePayload(fullRun, { deviceId: "smoke-device" });
assert.equal(payload.gameVersion, VERSION);
assert.equal(payload.deviceId, "smoke-device");
assert.equal(payload.client.head, "scrapline");
assert.equal(payload.outcome.reached, MAX_STAGES);
assert.ok(payload.stats.starterPattern);
assert.ok(Array.isArray(payload.stats.carHistory));
assert.ok(Array.isArray(payload.events));
assert.equal(payload.events.at(-1).type, "smoke_completed");
assert.equal(typeof enqueueScraplinePayload, "function");
assert.equal(typeof flushScraplineTelemetryQueue, "function");

const appSource = await readFile(new URL("../scrapline/app.js", import.meta.url), "utf8");
assert.doesNotMatch(appSource, /\b(alert|prompt|confirm)\s*\(/, "the route uses in-page controls");
for (const marker of [
  "localStorage",
  "scrapline-state-v2-seed",
  "sendScraplineTelemetry",
  "startReplay",
  "retry-send",
  "salvage-row",
  "data-drag-slot",
  "data-drag-handle",
  "reportDisclosure",
  "sendScraplineCheckpoint",
  "ここまでを記録して終了",
  "enemyPreviewMarkup",
  "rewardPreviewMarkup",
  "playEventCue",
  "flushScraplineTelemetryQueue",
  "serviceWorker",
  "return_reprocess",
  "impact_blocked",
  "collector_gain",
  "car_stolen_confirmed",
  "enemy_shell",
  "final-train-summary",
  "MOST SPECTACULAR SHOT",
  "data-complexity",
]) assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
const indexSource = await readFile(new URL("../scrapline/index.html", import.meta.url), "utf8");
assert.match(indexSource, /manifest\.webmanifest/);
const swSource = await readFile(new URL("../scrapline/sw.js", import.meta.url), "utf8");
assert.match(swSource, /scrapline-static-v8/);
const manifestSource = await readFile(new URL("../scrapline/manifest.webmanifest", import.meta.url), "utf8");
assert.match(manifestSource, /standalone/);
const implementationMap = await readFile(new URL("./SCRAPLINE_IMPLEMENTATION.md", import.meta.url), "utf8");
assert.match(implementationMap, /企画境界と固定検査/);
assert.match(implementationMap, /iPhone Safari/);

console.log("scrapline smoke ok", JSON.stringify({ version: VERSION, stages: fullRun.stage, events: payload.events.length }));
