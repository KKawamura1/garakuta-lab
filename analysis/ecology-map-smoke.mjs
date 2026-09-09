// Issue #203 — the battle map must communicate progress and encounter kind
// without letting elite/boss styling look like the current-location marker.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ENCOUNTERS_PER_RUN } from "../ecology/progression.mjs";
import { expeditionEncounter } from "../ecology/content/index.mjs";

const app = readFileSync("ecology/app.js", "utf8");
const styles = readFileSync("ecology/styles.css", "utf8");
const mapStart = app.indexOf("function renderMap()");
const mapEnd = app.indexOf("\nfunction treatmentTargetIds", mapStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart, "renderMap() is present");
const map = app.slice(mapStart, mapEnd);

const expectedKinds = [
  "normal", "normal", "elite", "boss",
  "normal", "normal", "elite", "boss",
  "normal", "normal", "elite", "boss",
];
const actualKinds = Array.from({ length: ENCOUNTERS_PER_RUN }, (_, offset) =>
  expeditionEncounter(offset + 1).kind);
assert.equal(ENCOUNTERS_PER_RUN, 12, "the map has twelve encounters");
assert.deepEqual(actualKinds, expectedKinds, "the three-act normal/elite/boss layout is unchanged");

for (const expected of [
  "data-map-index",
  "data-map-kind",
  "data-map-status",
  "aria-current",
  "map-kind-badge",
  "map-legend",
  "unreached",
]) {
  assert.ok(map.includes(expected), `renderMap() exposes ${expected}`);
}
assert.ok(map.includes("composeEncounter(step, state.run.difficulty, encounterOptions()).kind"),
  "map kind comes from the same encounter composer as the current encounter");
assert.ok(map.includes('step < index ? "done" : step === index ? "current" : "unreached"'),
  "map status follows the run encounter index");
assert.ok(!styles.includes(".map-node.kind-elite { border-color:"),
  "elite kind does not own a competing full node border");
assert.ok(!styles.includes(".map-node.kind-boss { border-color:"),
  "boss kind does not own a competing full node border");
assert.ok(styles.includes(".map-node.current {"), "current location owns the strong map border");
assert.ok(styles.includes("border: 2px solid var(--gold)"), "current location uses the gold border");

console.log("ecology-map smoke: PASS (12 nodes, 6 normal, 3 elite, 3 boss; current-only emphasis)");
