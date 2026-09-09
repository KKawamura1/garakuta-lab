import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const problems = [];
const core = readFileSync("core/build.mjs", "utf8");
const stamp = readFileSync("analysis/stamp.mjs", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

if (!core.includes("build.generated.mjs") || !core.includes('"unbuilt"')) {
  problems.push("core/build.mjs が生成sidecarとローカルfallbackを持っていない");
}
if (!core.includes("CONTENT_CONTRACT_VERSION") || !core.includes("FINGERPRINT")) {
  problems.push("content fingerprintがsource-controlled loaderに残っていない");
}
for (const required of ["CF_PAGES_COMMIT_SHA", "GITHUB_SHA", "BUILD_METADATA_OUTPUT", "build.generated.mjs"]) {
  if (!stamp.includes(required)) problems.push("stamp.mjs に " + required + " がない");
}
if (stamp.includes("new Date()") || stamp.includes("../core/build.mjs")) {
  problems.push("stamp.mjs が時刻またはtracked core/build.mjsへ書き込んでいる");
}
if (!gitignore.includes("/core/build.generated.mjs")) {
  problems.push("生成sidecarが.gitignoreにない");
}
if (packageJson.scripts?.build !== "node analysis/stamp.mjs") {
  problems.push("Pages build command用のnpm scriptがない");
}

const expected = "0123456789abcdef0123456789abcdef01234567";
const tempDir = mkdtempSync("/tmp/exp18-build-metadata-");
try {
  const outputPath = join(tempDir, "build.generated.mjs");
  execFileSync(process.execPath, ["analysis/stamp.mjs"], {
    env: {
      ...process.env,
      CF_PAGES_COMMIT_SHA: expected,
      GITHUB_SHA: "should-not-win",
      BUILD_METADATA_OUTPUT: outputPath,
    },
    stdio: "pipe",
  });
  const generated = readFileSync(outputPath, "utf8");
  if (!generated.includes('export const BUILD = "' + expected + '";')) {
    problems.push("CF_PAGES_COMMIT_SHAからbuild IDを生成できない");
  }
  if (generated.includes("new Date()") || generated.includes(" / ")) {
    problems.push("生成sidecarに時刻由来のbuild IDが残っている");
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (problems.length) {
  console.error("build metadata smoke: NG");
  for (const problem of problems) console.error("- " + problem);
  process.exit(1);
}
console.log("build metadata smoke: ok");
