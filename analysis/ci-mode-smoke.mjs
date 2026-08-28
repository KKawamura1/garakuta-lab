import fs from "node:fs";

const checkAll = fs.readFileSync("analysis/check-all.sh", "utf8");
const workflow = fs.readFileSync(".github/workflows/exhaustive-checks.yml", "utf8");

for (const marker of [
  "analysis/scrapline-balance-smoke.mjs|analysis/scrapline-seed-regression.mjs",
  "RUN_EXHAUSTIVE",
  "fast_smoke_files",
]) {
  if (!checkAll.includes(marker)) throw new Error(`check-all mode guard missing: ${marker}`);
}

if (!workflow.includes("RUN_EXHAUSTIVE=1 bash analysis/check-all.sh")) {
  throw new Error("exhaustive workflow does not restore the full check path");
}

console.log("CI mode smoke: fast and exhaustive paths are both wired");
