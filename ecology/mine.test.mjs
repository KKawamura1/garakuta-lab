// ecology/mine.test.mjs — Gate F.
//
// The bar R5 sets is deliberately low and deliberately not about fun: two or
// more distinct chain shapes, the same result for the same input, and errors
// that stay visible.

import assert from "node:assert/strict";
import { MINING_VERSION } from "./schema.mjs";
import { simulateBattle } from "./engine.mjs";
import { enumerateBuilds, fingerprintEventChain, mineBuilds } from "./mine.mjs";
import { FIXTURE_CONTENT } from "./fixture-content.mjs";
import { CORE_BATTLE, MINING_POOL } from "./fixtures.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const mined = mineBuilds(MINING_POOL, FIXTURE_CONTENT);

// ---- shape (§16 F) -------------------------------------------------------------

equal(mined.miningVersion, MINING_VERSION);
equal(mined.buildsEvaluated, enumerateBuilds(MINING_POOL).length);
equal(mined.battlesEvaluated, mined.buildsEvaluated * MINING_POOL.battles.length);
check(Array.isArray(mined.errors), "errors is a list");
equal(mined.errors.length, 0, "the fixture pool runs clean");

for (const buildResult of mined.buildResults) {
  check(typeof buildResult.buildId === "string", "a build id");
  for (const key of [
    "wins",
    "roundsUsed",
    "hpLost",
    "equipmentWear",
    "actionPointsUnused",
    "reactionPointsUnused",
  ]) {
    check(Number.isSafeInteger(buildResult.performance[key]), `performance.${key} is an integer`);
  }
  check(Object.keys(buildResult.eventHistogram).length > 0, "the histogram is filled");
  check(buildResult.chainFingerprints.length > 0, "the build produced chains");
}

// ---- the actual pass condition --------------------------------------------------

check(mined.uniqueChainFingerprints.length >= 2, "at least two distinct chain shapes appeared");

// ---- determinism -----------------------------------------------------------------

equal(
  JSON.stringify(mineBuilds(MINING_POOL, FIXTURE_CONTENT)),
  JSON.stringify(mined),
  "the same pool mines to the same result",
);

// ---- what a fingerprint keeps and drops ------------------------------------------

{
  const joined = mined.uniqueChainFingerprints.join("\n");
  for (const instanceId of ["mine_ally", "mine_equipment", "m_husk", "m_marker"]) {
    check(!joined.includes(instanceId), `fingerprints drop the instance id ${instanceId}`);
  }
  check(!/\bevt_\d+/.test(joined), "fingerprints drop event ids");
  check(joined.includes("opposing_side"), "fingerprints keep the target relation");
  check(joined.includes("counter_blow_rule") || joined.includes("guard_step_rule"), "and the rule definition");
  check(joined.includes("strike") || joined.includes("bulwark"), "and the skill definition");
  check(/:\d+(>|$)/.test(joined), "and the causal depth");
}

{
  // Two runs of one battle fingerprint identically; a different loadout does not.
  const result = simulateBattle(CORE_BATTLE, FIXTURE_CONTENT);
  assert.deepEqual(fingerprintEventChain(result), fingerprintEventChain(simulateBattle(CORE_BATTLE, FIXTURE_CONTENT)));
  checks += 1;

  const variant = structuredClone(CORE_BATTLE);
  variant.allies[0].tactics = [{ activeSkillId: "bulwark", useWhen: [] }];
  const changed = fingerprintEventChain(simulateBattle(variant, FIXTURE_CONTENT));
  check(
    JSON.stringify(changed) !== JSON.stringify(fingerprintEventChain(result)),
    "a different loadout gives different chains",
  );
}

// ---- errors are reported, not hidden ---------------------------------------------

{
  // idle_shuffle costs nothing and is always usable, so every battle it appears
  // in ends in the event cap. The mining run must say so rather than skip it.
  const brokenPool = structuredClone(MINING_POOL);
  brokenPool.activeSkillIds = ["strike", "idle_shuffle"];
  brokenPool.reactiveSkillIds = ["counter_blow"];
  brokenPool.equipmentIds = ["worn_greaves"];
  brokenPool.characterIds = ["warden"];
  const withErrors = mineBuilds(brokenPool, FIXTURE_CONTENT);
  check(withErrors.errors.length > 0, "the failing build is reported");
  equal(withErrors.buildsEvaluated, 2, "both builds were attempted");
  check(
    withErrors.errors.every((entry) => entry.buildId.includes("idle_shuffle")),
    "the error names the build that failed",
  );
  check(withErrors.errors[0].diagnostics !== null, "and carries the engine diagnostics");
  equal(withErrors.errors[0].name, "EcologyRuntimeError");
  check(
    withErrors.battlesEvaluated < withErrors.buildsEvaluated * brokenPool.battles.length,
    "a failed battle is not counted as evaluated",
  );
  // The surviving build still reports its chains.
  const good = withErrors.buildResults.find((entry) => entry.buildId.includes("strike"));
  check(good.chainFingerprints.length > 0, "the healthy build still produced chains");
}

console.log(`mine.test.mjs: ${checks} checks passed`);

