import assert from "node:assert/strict";
import { createGame, playAction, summary } from "../haul/engine.mjs";

const ACTIONS = ["salvage", "stabilize", "deep"];
const seed12 = createGame(12);
assert.equal(seed12.sequence.join(","), "crack,nest,anchor,flood,generator,lock");
assert.notEqual(createGame(6).sequence.join(","), seed12.sequence.join(","));

let leaves = 0;
let wins = 0;
let losses = 0;
let hullBroken = 0;
let missingCargo = 0;

function walk(state) {
  if (state.done) {
    leaves += 1;
    const result = summary(state);
    if (result.won) wins += 1;
    else losses += 1;
    if (result.reason === "hull_broken") hullBroken += 1;
    if (result.reason === "not_enough_cargo") missingCargo += 1;
    return;
  }
  for (const action of ACTIONS) walk(playAction(state, action).state);
}

walk(seed12);
assert.equal(leaves, 3 ** 6);
assert.ok(wins > 0, "seed 12 must have a winning plan");
assert.ok(losses > 0, "seed 12 must have a losing plan");
assert.ok(hullBroken > 0, "deep pushing must be able to break the hull");
assert.ok(missingCargo > 0, "over-stabilizing must be able to miss the cargo goal");

let safe = createGame(12);
for (const action of ["salvage", "salvage", "salvage", "stabilize", "salvage", "salvage"]) {
  safe = playAction(safe, action).state;
}
assert.equal(summary(safe).won, true);
assert.equal(summary(safe).cargo, 7);

let reckless = createGame(12);
for (const action of ["deep", "deep", "deep", "deep", "deep", "deep"]) {
  reckless = playAction(reckless, action).state;
}
assert.equal(summary(reckless).won, false);
assert.equal(summary(reckless).reason, "hull_broken");

console.log(JSON.stringify({ leaves, wins, losses, hullBroken, missingCargo }));
