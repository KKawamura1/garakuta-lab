import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BUILD_STAMP,
  VERSION,
  continueFromReport,
  createGame,
  endRunEarly,
  installCar,
  revealReport,
  runBattle,
} from "../scrapline/engine.mjs";
import {
  SCRAPLINE_SCHEMA_VERSION,
  buildScraplinePayload,
  ensureTelemetry,
  recordTelemetry,
  sendScraplineCheckpoint,
} from "../scrapline/telemetry.mjs";

let state = createGame(23);
ensureTelemetry(state, "2026-08-27T02:00:00.000Z");
recordTelemetry(state, { type: "run_started", seed: state.seed }, "2026-08-27T02:00:01.000Z");
state = runBattle(state).state;
state = continueFromReport(revealReport(state));
const offerIds = state.offers.map((offer) => offer.id);
const chosen = offerIds[1];
state = installCar(state, chosen);
recordTelemetry(state, { type: "car_installed", carId: chosen, offerSet: offerIds }, "2026-08-27T02:00:02.000Z");

const payload = buildScraplinePayload(state, { deviceId: "telemetry-smoke-device" });
assert.equal(payload.schemaVersion, SCRAPLINE_SCHEMA_VERSION);
assert.equal(payload.schemaVersion, 5);
assert.equal(payload.gameVersion, VERSION);
assert.equal(payload.client.ruleset, VERSION);
assert.equal(payload.client.build, BUILD_STAMP);
assert.equal(payload.client.seed, 23);
assert.equal(payload.stats.seed, 23);
assert.equal(payload.outcome.status, "in_progress");
assert.equal(payload.outcome.complete, false);

const presentation = payload.stats.offerHistory[0];
assert.ok(presentation.presentedAt);
assert.deepEqual(presentation.offers.map((offer) => offer.id), offerIds);
assert.equal(presentation.offers.length, 3);
assert.ok(presentation.offers.every((offer) => offer.id && offer.name && offer.rarity && offer.text));
assert.ok(presentation.nextChallenge.id && presentation.nextChallenge.kind && presentation.nextChallenge.name && presentation.nextChallenge.motion);
assert.deepEqual(presentation.before.train, payload.stats.carHistory[0].before);
assert.equal(presentation.decision.carId, chosen);
assert.deepEqual(presentation.decision.before, payload.stats.carHistory[0].before);
assert.deepEqual(presentation.decision.after, payload.stats.carHistory[0].after);
assert.ok(presentation.decision.at);

const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
let beacon = null;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    language: "ja-JP",
    sendBeacon(url, body) {
      beacon = { url, body };
      return true;
    },
  },
});
assert.equal(sendScraplineCheckpoint(state), true);
assert.equal(beacon.url, "/api/runs");
assert.equal(beacon.body.type, "application/json");
const beaconPayload = JSON.parse(await beacon.body.text());
assert.equal(beaconPayload.runId, payload.runId);
assert.equal(beaconPayload.outcome.complete, false);
if (priorNavigator) Object.defineProperty(globalThis, "navigator", priorNavigator);
else delete globalThis.navigator;

state = endRunEarly(state, "テレメトリ検査で終了");
const abandoned = buildScraplinePayload(state, { deviceId: "telemetry-smoke-device" });
assert.equal(abandoned.outcome.status, "abandoned");
assert.equal(abandoned.outcome.complete, true);
assert.equal(abandoned.outcome.endedEarly, true);
assert.match(abandoned.outcome.reason, /終了/);

const apiSource = await readFile(new URL("../functions/api/runs.js", import.meta.url), "utf8");
assert.match(apiSource, /new TextEncoder\(\)\.encode\(body\)\.byteLength/);
assert.doesNotMatch(apiSource, /if \(!length \|\| length > MAX_BODY_BYTES\)/, "beacon checkpoints do not require a Content-Length header");
assert.match(apiSource, /device_id=excluded\.device_id/);

console.log("scrapline telemetry smoke ok", JSON.stringify({
  schema: payload.schemaVersion,
  seed: payload.stats.seed,
  offers: offerIds,
  status: abandoned.outcome.status,
}));
