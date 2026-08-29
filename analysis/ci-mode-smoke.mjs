// push ごとの検査と、週次・手動の全量検査。**両方が配線されたままか**を見張る。
//
// 速い検査だけを毎回走らせる仕組みは、二通りの壊れ方をする。
//   1. 外した検査がどこでも走らなくなる（週次の経路が切れる、名前が変わって死ぬ）
//   2. 逆に、重い検査が毎pushへ戻ってきて待ち時間が伸びる
// どちらも黙って起きるので、ここで落とす。

import fs from "node:fs";

const checkAll = fs.readFileSync("analysis/check-all.sh", "utf8");
const workflow = fs.readFileSync(".github/workflows/exhaustive-checks.yml", "utf8");
const fail = (message) => {
  throw new Error(`CI mode smoke: ${message}`);
};

// 速い経路と全量経路の両方が存在すること。
for (const marker of ["RUN_EXHAUSTIVE", "fast_smoke_files", "SLOW_CHECKS"]) {
  if (!checkAll.includes(marker)) fail(`check-all mode guard missing: ${marker}`);
}
if (!workflow.includes("RUN_EXHAUSTIVE=1 bash analysis/check-all.sh")) {
  fail("exhaustive workflow does not restore the full check path");
}
if (!/workflow_dispatch/.test(workflow) || !/schedule:/.test(workflow)) {
  fail("exhaustive workflow must stay both manually runnable and scheduled");
}

// 毎pushから外した検査の一覧を、実際に check-all.sh から読む。
const block = checkAll.match(/SLOW_CHECKS=\(([\s\S]*?)\n\)/);
if (!block) fail("SLOW_CHECKS list not found");
const slowChecks = block[1]
  .split("\n")
  .map((line) => line.replace(/#.*$/, "").trim())
  .filter((line) => line.length > 0);

if (slowChecks.length === 0) fail("SLOW_CHECKS is empty");

for (const path of slowChecks) {
  // 消えたファイルが並んでいると、外したつもりの検査がどこにも無いことになる。
  if (!fs.existsSync(path)) fail(`SLOW_CHECKS names a file that does not exist: ${path}`);
  // 全量経路が拾うのは analysis/*smoke*.mjs と *seed-regression*.mjs だけ。
  // ここから外れたものは、除外しても全量でも走らない。
  if (!/^analysis\/.*(smoke|seed-regression).*\.mjs$/.test(path)) {
    fail(`SLOW_CHECKS entry is outside the exhaustive glob: ${path}`);
  }
}

// 予算の見張りが残っていること。**「1分以内」は散文だと守られない。**
if (!checkAll.includes("FAST_CHECK_BUDGET_MS")) fail("the fast check budget guard is gone");
if (!/FAST_CHECK_BUDGET_MS[\s\S]*?exit 1/.test(checkAll)) {
  fail("the fast check budget no longer fails the run");
}

console.log(
  `CI mode smoke: fast and exhaustive paths are both wired (${slowChecks.length} checks deferred)`,
);
