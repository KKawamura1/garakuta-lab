import assert from "node:assert/strict";
import { ACTIONS, DAYS, GAME_VERSION, chooseAction, continueDay, createGame, resolveEnding } from "../tomori/engine.mjs";
import { buildPayload, record } from "../tomori/telemetry.mjs";

function finish(seed, sequence) {
  let state = createGame({ seed, name: "スモーク", legacy: { title: "前の子", line: "また会おう。" } });
  assert.ok(state.legacy, "legacy note is carried into a new run");
  record(state, { type: "run_started", seed });
  for (let day = 0; day < DAYS; day += 1) {
    const action = sequence[day];
    const picked = chooseAction(state, action);
    assert.equal(picked.ok, true, "action must be selectable");
    state = picked.state;
    assert.equal(state.history.length, day + 1);
    record(state, { type: "action_chosen", day: day + 1, actionId: action });
    const advanced = continueDay(state);
    assert.equal(advanced.ok, true, "day must advance");
    state = advanced.state;
  }
  assert.equal(state.phase, "result");
  assert.equal(state.history.length, DAYS);
  assert.ok(state.ending?.title);
  return state;
}

const voice = finish(12, ["listen", "listen", "listen"]);
assert.equal(voice.ending.id, "voice");
const warmth = finish(13, ["warm", "warm", "warm"]);
assert.equal(warmth.ending.id, "warmth");
const gaze = finish(14, ["look", "look", "look"]);
assert.equal(gaze.ending.id, "gaze");
const weave = finish(15, ["listen", "warm", "look"]);
assert.equal(weave.ending.id, "weave");

const payloadState = finish(21, ["listen", "warm", "listen"]);
record(payloadState, { type: "emotion_marked", kind: "spark", phase: "result", note: "smoke" });
payloadState.survey = { fun: 4, replay: 5, understood: "声を覚えた", next: "ぬくもりを深める" };
record(payloadState, { type: "survey_submitted", survey: payloadState.survey });
const payload = buildPayload(payloadState);
assert.equal(payload.gameVersion, GAME_VERSION);
assert.equal(payload.runId, payload.telemetryRunId);
assert.equal(payload.outcome.reached, DAYS);
assert.equal(payload.outcome.reason, resolveEnding(payloadState).id);
assert.equal(payload.moments.length, 1);
assert.equal(payload.answers.replay, 5);
assert.equal(payload.stats.actionCount, DAYS);

for (let seed = 1; seed <= 120; seed += 1) {
  const game = finish(seed, ACTIONS.map((_, index) => ACTIONS[(seed + index) % ACTIONS.length].id));
  assert.equal(game.history.length, DAYS);
}

console.log("tomori smoke passed");
