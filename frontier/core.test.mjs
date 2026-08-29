import assert from "node:assert/strict";
import { simulateBattle, simulateFronts } from "./engine.mjs";

const burst = ["ram", "echo"];
const heavy = ["capacitor", "cannon"];
const snipe = ["guard", "sniper"];

function expectResult(input, expectedResult, expectedBeats) {
  const result = simulateBattle(input);
  assert.equal(result.result, expectedResult, JSON.stringify(input));
  if (expectedBeats !== undefined) assert.equal(result.beatsUsed, expectedBeats, JSON.stringify(input));
  return result;
}

// M0: placement is already meaningful before doctrines are introduced.
expectResult({ missionId: "connection", allyUnitIds: burst }, "win", 1);
expectResult({ missionId: "connection", allyUnitIds: [...burst].reverse() }, "win", 2);

// M1: an unmodified squad fails, while each qualitative doctrine solves it differently.
expectResult({ missionId: "swarm", allyUnitIds: burst }, "loss", 3);
expectResult({ missionId: "swarm", allyUnitIds: burst, doctrineId: "overrun" }, "win", 2);
expectResult({ missionId: "swarm", allyUnitIds: burst, doctrineId: "double_echo" }, "win", 2);
expectResult({ missionId: "swarm", allyUnitIds: burst, doctrineId: "brace" }, "win", 3);

// M2: none of the first-squad doctrines turns the burst squad into a universal answer.
for (const doctrineId of ["overrun", "double_echo", "brace"]) {
  expectResult({ missionId: "fortress", allyUnitIds: burst, doctrineId }, "loss", 3);
}

// M2 has at least two mechanically distinct answers.
const heavyWin = expectResult({ missionId: "fortress", allyUnitIds: heavy }, "win", 3);
const snipeWin = expectResult({ missionId: "fortress", allyUnitIds: snipe }, "win", 2);
assert(heavyWin.events.some((event) => event.type === "charge"));
assert(heavyWin.events.some((event) => event.type === "consume_charge" && event.power === 10));
assert(heavyWin.events.some((event) => event.type === "attack" && event.armorBlocked === 3));
assert(snipeWin.events.some((event) => event.type === "shield"));
assert(snipeWin.events.some((event) => event.type === "attack" && event.target.startsWith("artillery")));

// The fortress squads do not replace the original swarm squad.
expectResult({ missionId: "swarm", allyUnitIds: heavy }, "loss");
expectResult({ missionId: "swarm", allyUnitIds: snipe }, "loss", 3);

// Correct assignment preserves both strategies and clears both fronts.
const correct = simulateFronts([
  { squadId: "first", missionId: "swarm", allyUnitIds: burst, doctrineId: "overrun" },
  { squadId: "second", missionId: "fortress", allyUnitIds: heavy },
]);
assert.equal(correct.allWin, true);

const swapped = simulateFronts([
  { squadId: "first", missionId: "fortress", allyUnitIds: burst, doctrineId: "overrun" },
  { squadId: "second", missionId: "swarm", allyUnitIds: heavy },
]);
assert.equal(swapped.allWin, false);

assert.throws(
  () => simulateFronts([
    { squadId: "same", missionId: "swarm", allyUnitIds: burst, doctrineId: "overrun" },
    { squadId: "same", missionId: "fortress", allyUnitIds: burst, doctrineId: "overrun" },
  ]),
  /cannot be assigned/,
);

// Exact repeatability includes the full causal event stream.
const deterministicInput = { missionId: "swarm", allyUnitIds: burst, doctrineId: "double_echo" };
assert.deepEqual(simulateBattle(deterministicInput), simulateBattle(deterministicInput));

// Every core mechanism must be visible in the event protocol.
const eventTypes = new Set([
  ...simulateBattle({ missionId: "swarm", allyUnitIds: burst, doctrineId: "overrun" }).events,
  ...simulateBattle({ missionId: "swarm", allyUnitIds: burst, doctrineId: "double_echo" }).events,
  ...simulateBattle({ missionId: "swarm", allyUnitIds: burst, doctrineId: "brace" }).events,
  ...heavyWin.events,
  ...snipeWin.events,
  ...simulateBattle({ missionId: "fortress", allyUnitIds: burst }).events,
].map((event) => event.type));

for (const required of [
  "attack",
  "overflow",
  "echo",
  "brace",
  "charge",
  "consume_charge",
  "shield",
  "wait",
  "barrage",
]) {
  assert(eventTypes.has(required), `missing event type: ${required}`);
}

console.log("SCRAP FRONTIER core checks passed");
