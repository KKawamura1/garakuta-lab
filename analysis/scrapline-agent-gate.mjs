#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const mode = process.argv[2] ?? "--quick";

if (!["--quick", "--full"].includes(mode) || process.argv.length > 3) {
  console.error("usage: node analysis/scrapline-agent-gate.mjs [--quick|--full]");
  process.exit(2);
}

const quickChecks = [
  "analysis/scrapline-smoke.mjs",
  "analysis/scrapline-physics-smoke.mjs",
  "analysis/scrapline-reward-smoke.mjs",
  "analysis/scrapline-run-policy-smoke.mjs",
  "analysis/scrapline-run-diversity-smoke.mjs",
  "analysis/scrapline-presentation-smoke.mjs",
  "analysis/scrapline-telemetry-smoke.mjs",
];
const fullChecks = [
  ...quickChecks,
  "analysis/scrapline-seed-regression.mjs",
  "analysis/scrapline-balance-smoke.mjs",
];
const checks = mode === "--full" ? fullChecks : quickChecks;
const results = [];

for (const file of checks) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [file], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const passed = run.status === 0;
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
  const elapsedMs = Date.now() - started;

  results.push({ file, passed, exitCode: run.status, elapsedMs });
  console.log(`${passed ? "PASS" : "FAIL"} ${file} (${elapsedMs}ms)`);
  if (!passed && output) console.error(output);
}

const failed = results.filter((result) => !result.passed);
const summary = {
  schema: 1,
  mode: mode.slice(2),
  passed: failed.length === 0,
  checks: results.length,
  failed: failed.map((result) => result.file),
  elapsedMs: results.reduce((sum, result) => sum + result.elapsedMs, 0),
};

console.log(`SCRAPLINE_AGENT_GATE ${JSON.stringify(summary)}`);
process.exit(summary.passed ? 0 : 1);

