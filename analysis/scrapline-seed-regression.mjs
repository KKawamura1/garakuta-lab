import assert from "node:assert/strict";
import { MAX_STAGES, VERSION, recommendedPolicy } from "../scrapline/engine.mjs";

const runs = Array.from({ length: 256 }, (_, seed) => recommendedPolicy(seed));
assert.ok(runs.every((run) => run.version === VERSION && run.done && run.won && run.stage === MAX_STAGES), "all diagnostic seeds keep a winnable line");
assert.ok(new Set(runs.map((run) => run.activeCars.join(","))).size >= 32, "winnable lines retain meaningful build diversity");

console.log("scrapline seed regression ok", JSON.stringify({ version: VERSION, seeds: runs.length, uniqueFinalTrains: new Set(runs.map((run) => run.activeCars.join(","))).size }));
