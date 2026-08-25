import assert from "node:assert/strict";
import {
  COMMANDS,
  MAX_NIGHTS,
  PART_BY_ID,
  RELICS,
  SLOT_IDS,
  chooseCommand,
  continueNight,
  createGame,
  forecast,
  installPart,
  readBuild,
  skipBuild
} from "../night-eater/engine.mjs";
import { buildPayload, record } from "../night-eater/telemetry.mjs";

function play(seed) {
  let state = createGame({ seed });
  let guard = 0;
  while (state.phase !== "result" && guard < 100) {
    guard += 1;
    if (state.phase === "build") {
      const candidate = state.offer[0];
      const current = PART_BY_ID[candidate];
      let bestSlot = 0;
      let bestValue = -1;
      SLOT_IDS.forEach((slot, index) => {
        const values = current.slots[slot];
        const value = Object.values(values).reduce((sum, item) => sum + item, 0);
        if (value > bestValue) {
          bestValue = value;
          bestSlot = index;
        }
      });
      const installed = installPart(state, candidate, bestSlot, "offer");
      state = installed.result.ok ? installed.state : skipBuild(state).state;
    } else if (state.phase === "command") {
      const predictions = COMMANDS.map(command => ({ command, prediction: forecast(state, command.id) }));
      const viable = predictions.find(item => item.prediction.success);
      const chosen = viable || predictions[0];
      state = chooseCommand(state, chosen.command.id).state;
    } else if (state.phase === "aftermath") {
      state = continueNight(state).state;
    }
  }
  assert.equal(state.phase, "result", "seed " + seed + " must reach an ending");
  assert.ok(state.history.length >= 1 && state.history.length <= MAX_NIGHTS, "history length");
  assert.ok(readBuild(state.parts).behavior, "behavior must have a name");
  return state;
}

const signatures = new Set();
for (let seed = 1; seed <= 300; seed += 1) {
  const state = play(seed);
  signatures.add(state.ending.id + ":" + readBuild(state.parts).behavior + ":" + state.history.filter(x => x.success).length);
}
assert.ok(signatures.size >= 4, "the first 300 seeds should not collapse to one ending");

for (const relic of RELICS) {
  for (let slot = 0; slot < SLOT_IDS.length; slot += 1) {
    const state = createGame({ seed: 10 });
    state.offer = [relic.id];
    const result = installPart(state, relic.id, slot, "offer");
    assert.equal(result.result.ok, true, relic.id + " in " + SLOT_IDS[slot]);
    assert.equal(result.state.parts[slot], relic.id);
  }
}

const payloadState = play(777);
record(payloadState, { type: "emotion_marked", kind: "spark", phase: "result", note: "payload smoke" });
record(payloadState, { type: "survey_submitted", survey: { fun: 4, replay: 5, moment: "payload smoke", next: "" } });
const payload = buildPayload(payloadState, { deviceId: "smoke-device" });
assert.equal(payload.gameVersion, "night-eater-0.1");
assert.equal(payload.telemetryRunId, payload.runId, "D1 requires one run id");
assert.equal(payload.outcome.reason, payloadState.endReason);
assert.equal(payload.events.length, payloadState.telemetry.events.length);
assert.equal(payload.moments[0].kind, "spark");

const first = createGame({ seed: 42 });
const second = createGame({ seed: 42 });
assert.deepEqual(first.offer, second.offer, "same seed must reproduce the offer");
assert.deepEqual(first.parts, second.parts, "same seed must reproduce the initial body");

console.log("night-eater smoke passed");
console.log(JSON.stringify({ simulatedSeeds: 300, distinctSignatures: signatures.size, relicSlots: RELICS.length * SLOT_IDS.length }));
