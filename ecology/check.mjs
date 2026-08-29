// ecology/check.mjs — §17.
//
// Runs each suite in its own process and checks the exit code, not the words it
// printed. A suite that prints PASS and exits 1 fails here.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SUITES = [
  "schema.test.mjs",
  "engine.test.mjs",
  "termination.test.mjs",
  "mine.test.mjs",
];

let failed = 0;
for (const suite of SUITES) {
  const path = fileURLToPath(new URL(suite, import.meta.url));
  const run = spawnSync(process.execPath, [path], { stdio: "inherit" });
  if (run.status === 0) continue;
  failed += 1;
  console.error(`FAIL ${suite} (exit code ${run.status === null ? run.signal : run.status})`);
}

if (failed > 0) {
  console.error(`ecology: ${failed} of ${SUITES.length} suites failed.`);
  process.exit(1);
}
console.log(`ecology: ${SUITES.length} suites passed.`);
