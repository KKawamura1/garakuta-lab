import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MAX_STAGES,
  challengeFor,
  createGame,
  offersFor,
} from "../scrapline/engine.mjs";

const offeredByQuestion = new Map();
let pairedReturnOffers = 0;
let eligibleReturnChecks = 0;
let rareOffers = 0;

for (let seed = 0; seed < 256; seed += 1) {
  for (let stage = 1; stage < MAX_STAGES; stage += 1) {
    const state = { ...createGame(seed), stage };
    const offers = offersFor(state);
    const ids = offers.map((car) => car.id);
    assert.equal(ids.length, 3, `seed ${seed}, stage ${stage} presents three choices`);
    assert.equal(new Set(ids).size, 3, "one salvage screen never repeats a car");
    assert.ok(ids.every((id) => !state.activeCars.includes(id)), "the current train is excluded");
    if (stage === 1) assert.ok(offers.every((car) => car.rarity !== "rare"), "the opening salvage stays readable");
    rareOffers += offers.filter((car) => car.rarity === "rare").length;

    if (!state.activeCars.includes("magnet") && !state.activeCars.includes("reverse")) {
      eligibleReturnChecks += 1;
      if (ids.includes("magnet") && ids.includes("reverse")) pairedReturnOffers += 1;
    }

    const kind = challengeFor(stage, seed).kind;
    if (!offeredByQuestion.has(kind)) offeredByQuestion.set(kind, []);
    offeredByQuestion.get(kind).push(new Set(ids));
  }
}

assert.ok(rareOffers > 0, "rare rewrites enter later salvage pools");
assert.ok(pairedReturnOffers < eligibleReturnChecks, "magnet and reverse are not a guaranteed endgame package");
for (const [kind, sets] of offeredByQuestion) {
  const intersection = [...sets[0]].filter((id) => sets.every((set) => set.has(id)));
  assert.deepEqual(intersection, [], `${kind} has no universally guaranteed counter car`);
}

const recoveryState = {
  ...createGame(179),
  stage: 5,
  activeCars: ["accelerator", "charge"],
  recoverableCarId: "melt",
};
const recoveryOffers = offersFor(recoveryState);
assert.equal(recoveryOffers[0].id, "melt", "the player's most recently dismantled car remains recoverable once");
assert.equal(recoveryOffers[0].recovered, true, "recovery is explicit offer data, not a hidden counter");

const appSource = await readFile(new URL("../scrapline/app.js", import.meta.url), "utf8");
assert.match(appSource, /reward-next-enemy/);
assert.match(appSource, /選択後の敵/);
assert.match(appSource, /RECOVER \/ 直前の解体品/);

console.log("scrapline reward smoke ok", JSON.stringify({
  screens: eligibleReturnChecks,
  pairedReturnOffers,
  rareOffers,
  questions: [...offeredByQuestion.keys()],
}));
