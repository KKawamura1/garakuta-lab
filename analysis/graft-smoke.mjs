import assert from "node:assert/strict";
import {
  ACTIONS,
  ENEMIES,
  MAX_TURNS,
  actionInfo,
  chooseMutation,
  createGame,
  playAction,
  serialize,
  deserialize
} from "../graft/engine.mjs";
import {
  buildGraftPayload,
  ensureTelemetry,
  recordTelemetry
} from "../graft/telemetry.mjs";

function playSequence(state, sequence) {
  let next = state;
  for (const actionId of sequence) {
    const result = playAction(next, actionId);
    assert.equal(result.ok, true, `expected ${actionId} to be legal`);
    next = result.state;
    if (next.phase !== "battle") break;
  }
  return next;
}

function firstBattle(seed) {
  const state = playSequence(createGame(seed), [
    "charge", "charge", "strike", "strike", "strike"
  ]);
  assert.equal(state.phase, "reward");
  assert.equal(state.history[0].won, true);
  return state;
}

// The first reward offers two distinct mutations and accepts an irreversible target.
const reward = firstBattle(1);
assert.equal(reward.offer.length, 2);
assert.notEqual(reward.offer[0], reward.offer[1]);
const grafted = chooseMutation(reward, reward.offer[0], "strike");
assert.equal(grafted.ok, true);
assert.equal(grafted.state.actions.strike.mutation, reward.offer[0]);
assert.equal(grafted.state.phase, "battle");
assert.equal(grafted.state.battleIndex, 1);

// Recoil changes the legal next action, not only the amount of damage.
const recoilState = chooseMutation(reward, "recoil", "strike").state;
const recoilCharge = playAction(recoilState, "charge").state;
const recoilStrike = playAction(recoilCharge, "strike").state;
assert.equal(recoilStrike.enemy.hp, ENEMIES[1].hp - 10);
assert.equal(actionInfo(recoilStrike, "strike").legal, false);
assert.match(actionInfo(recoilStrike, "strike").reason, /反動/);

// Echo resolves at the next turn start and does not create an automatic loop.
const echoState = chooseMutation(reward, "echo", "charge").state;
const echoCharge = playAction(echoState, "charge").state;
assert.ok(echoCharge.pendingEcho);
const echoStrike = playAction(echoCharge, "strike").state;
assert.equal(echoStrike.pendingEcho, null);
assert.ok(echoStrike.log.some(entry => entry.text.includes("余波")));

// Handoff only fires on the next different manual action.
const handoffReward = firstBattle(6);
const handoffState = chooseMutation(handoffReward, "handoff", "guard").state;
const handoffGuard = playAction(handoffState, "guard").state;
assert.ok(handoffGuard.handoff);
const handoffStrike = playAction(handoffGuard, "strike").state;
assert.equal(handoffStrike.enemy.hp, ENEMIES[1].hp - 8);
assert.equal(handoffStrike.handoff, null);

// Save/load is part of the playable loop.
assert.deepEqual(deserialize(serialize(handoffStrike)), handoffStrike);

// null is the player-facing random-seed path; explicit 0 remains a controlled seed.
assert.notEqual(createGame(null).seed, 0);
assert.equal(createGame(0).seed, 0);

const turnLimit = playSequence(createGame(12), [
  "guard", "charge", "guard", "charge", "guard", "charge", "guard", "charge"
]);
assert.equal(turnLimit.lastBattle.reason, "turn_limit");
assert.ok(turnLimit.hp > 0);

// The GRAFT prototype uses the existing /api/runs contract, with a separate game version.
const telemetryState = createGame(12);
ensureTelemetry(telemetryState, "2026-08-25T00:00:00.000Z");
recordTelemetry(telemetryState, {
  type: "emotion_marked",
  phase: "battle",
  kind: "spark",
  note: "接ぎ木が効いた"
}, "2026-08-25T00:00:01.000Z");
const telemetryPayload = buildGraftPayload(telemetryState, { deviceId: "graft-smoke-device" });
assert.equal(telemetryPayload.schemaVersion, 4);
assert.equal(telemetryPayload.telemetryRunId, telemetryPayload.runId);
assert.equal(telemetryPayload.gameVersion, "graft-0.1-graft");
assert.equal(telemetryPayload.events.length, 1);
assert.equal(telemetryPayload.moments.length, 1);
assert.equal(telemetryPayload.moments[0].note, "接ぎ木が効いた");
assert.equal(telemetryPayload.client.head, "graft");

function findWin(seed) {
  const seen = new Set();
  const key = state => JSON.stringify({
    phase: state.phase,
    done: state.done,
    battleIndex: state.battleIndex,
    turn: state.turn,
    hp: state.hp,
    energy: state.energy,
    enemyHp: state.enemy.hp,
    attackIndex: state.enemy.attackIndex,
    actions: state.actions,
    pendingEcho: state.pendingEcho,
    handoff: state.handoff,
    lockedAction: state.lockedAction,
    offer: state.offer
  });

  function search(state) {
    if (state.done) {
      return state.history.length === ENEMIES.length && state.history.every(battle => battle.won);
    }
    const fingerprint = key(state);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);

    if (state.phase === "reward") {
      for (const mutationId of state.offer) {
        for (const actionId of ACTIONS.map(action => action.id)) {
          const result = chooseMutation(state, mutationId, actionId);
          if (result.ok && search(result.state)) return true;
        }
      }
      return false;
    }

    for (const action of ACTIONS) {
      const result = playAction(state, action.id);
      if (result.ok && search(result.state)) return true;
    }
    return false;
  }

  return search(createGame(seed));
}

// A deterministic seed must not accidentally make the prototype unwinnable.
for (let seed = 1; seed <= 20; seed += 1) {
  assert.equal(findWin(seed), true, `seed ${seed} should have a winning line`);
}

assert.ok(MAX_TURNS >= 6);
console.log("GRAFT smoke: OK (mechanics + seeds 1..20)");
