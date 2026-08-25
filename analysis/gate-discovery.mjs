#!/usr/bin/env node

// EXP-02 の A〜D を、PUZZLES の固定表に対して機械的に実行する。
// ゲーム規則・問題表・UIのコードは変更しない。Bは意味を読まない表示得点だけの探索、
// Cは全列挙、Dは事前登録された出題順による選択である。

import fs from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { makeSimulate, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { makeRng } from "../core/rng.mjs";
import { PUZZLES } from "../core/puzzle-table.mjs";

const require = createRequire(import.meta.url);
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const jsonArg = process.argv.includes("--json");
const skipBrowser = process.argv.includes("--skip-browser");
const CYCLES = 3;
const HUGE = 1e9;
const START_COUNT = 20;
const CHECK_BUDGET = 20;
const SEARCH_SEED = 20260823;

const fail = (message) => { throw new Error(message); };
const enemyOf = (cap) => ({ name: "試験体", hp: HUGE, atk: 0, atkPeriod: 99, cap, floor: 0, cycleCap: 0, regen: 0 });

function permutations(multiset) {
  const sorted = [...multiset].sort();
  const result = [];
  const used = new Array(sorted.length).fill(false);
  const current = [];
  const visit = () => {
    if (current.length === sorted.length) { result.push([...current]); return; }
    let previous = null;
    for (let i = 0; i < sorted.length; i += 1) {
      if (used[i] || sorted[i] === previous) continue;
      previous = sorted[i];
      used[i] = true;
      current.push(sorted[i]);
      visit();
      current.pop();
      used[i] = false;
    }
  };
  visit();
  return result;
}

function arrangementSpace(pool) {
  const result = [];
  const seen = new Set();
  const choose = (start, picked) => {
    if (picked.length === SLOT_COUNT) {
      for (const order of permutations(picked)) {
        const key = order.join(",");
        if (!seen.has(key)) { seen.add(key); result.push(order); }
      }
      return;
    }
    for (let i = start; i < pool.length; i += 1) choose(i + 1, [...picked, pool[i]]);
  };
  choose(0, []);
  return result;
}

function score(puzzle, order) {
  let cache = scoreCaches.get(puzzle);
  if (!cache) {
    cache = { simulate: makeSimulate(puzzle.laws), values: new Map() };
    scoreCaches.set(puzzle, cache);
  }
  const key = order.join(",");
  if (cache.values.has(key)) return cache.values.get(key);
  const simulate = cache.simulate;
  const result = simulate({
    slots: order.map((type, index) => ({ id: `gate-${index}`, type })),
    hp: 999, maxHp: 999, enemy: enemyOf(puzzle.cap), rng: makeRng(1)
  });
  const value = (result.log || [])
    .filter((event) => event.cycle <= CYCLES && event.damage)
    .reduce((total, event) => total + event.damage, 0);
  cache.values.set(key, value);
  return value;
}

const scoreCaches = new WeakMap();

function counts(values) {
  const map = new Map();
  for (const value of values) map.set(value, (map.get(value) || 0) + 1);
  return map;
}

function oneSlotDistance(a, b) {
  let different = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) different += 1;
  return different;
}

function initialOrder(space, rng) {
  return [...space[Math.floor(rng() * space.length)]];
}

// 画面得点だけを見て、1回に1枠だけ変える固定探索器。
// 候補の評価は1回の表示確認として数える。候補順は、seedで固定した順序。
function searchOnlyScore(puzzle, space, seed) {
  const rng = makeRng(seed);
  const starts = [];
  let solved = 0;
  let totalChecks = 0;
  const trials = [];

  for (let start = 0; start < START_COUNT; start += 1) {
    let current = initialOrder(space, rng);
    let currentScore = score(puzzle, current);
    let checks = 0;
    let solvedThisStart = currentScore >= puzzle.target;
    const path = [{ score: currentScore, order: current.join(",") }];

    while (!solvedThisStart && checks < CHECK_BUDGET) {
      const neighbors = space
        .filter((candidate) => oneSlotDistance(current, candidate) === 1)
        .map((candidate, index) => ({ candidate, index, tie: rng() }));
      neighbors.sort((a, b) => a.tie - b.tie || a.index - b.index);
      if (!neighbors.length) break;

      // その時点で最も高い候補を、残り予算の範囲で比較する。
      let bestCandidate = null;
      let bestScore = currentScore;
      for (const neighbor of neighbors) {
        if (checks >= CHECK_BUDGET) break;
        const candidateScore = score(puzzle, neighbor.candidate);
        checks += 1;
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestCandidate = neighbor.candidate;
        }
      }
      if (!bestCandidate) break;
      current = [...bestCandidate];
      currentScore = bestScore;
      path.push({ score: currentScore, order: current.join(",") });
      solvedThisStart = currentScore >= puzzle.target;
    }
    if (solvedThisStart) solved += 1;
    totalChecks += checks;
    starts.push({ start: start + 1, checks, solved: solvedThisStart, best: currentScore, path });
  }
  trials.push(...starts);
  return { solved, starts: START_COUNT, totalChecks, trials, threshold: 10, pass: solved < 10 };
}

function enumerate(puzzle, space) {
  const values = space.map((order) => ({ order, value: score(puzzle, order) }));
  const best = Math.max(...values.map((entry) => entry.value));
  const solutions = values.filter((entry) => entry.value >= puzzle.target);
  const solutionSets = new Set(solutions.map((entry) => [...counts(entry.order)].sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => `${type}×${count}`).join(" / ")));
  return {
    space: space.length,
    best,
    target: puzzle.target,
    gap: best - puzzle.target,
    solutionCount: solutions.length,
    solutionRate: solutions.length / space.length,
    solutionSetCount: solutionSets.size,
    solutionOrderCount: solutions.length,
    pass: solutions.length > 0 && (solutions.length / space.length) <= 0.2
  };
}

async function browserGate() {
  try {
    const { chromium } = require("playwright");
    const executablePath = chromium.executablePath();
    if (!fs.existsSync(executablePath)) {
      return { passed: false, errors: [`browser executable not found: ${executablePath}`] };
    }
    const port = 8962;
    const server = spawn("python3", ["-m", "http.server", String(port)], { stdio: "ignore", detached: true });
    const stop = () => { try { process.kill(-server.pid); } catch (_) {} };
    await new Promise((resolve) => setTimeout(resolve, 700));
    const errors = [];
    let passed = true;
    const browser = await chromium.launch({ executablePath });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(`http://localhost:${port}/puzzle/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    for (let i = 0; i < PUZZLES.length; i += 1) {
      const puzzle = PUZZLES[i];
      for (let slot = 0; slot < puzzle.answer.length; slot += 1) {
        const name = PARTS[puzzle.answer[slot]].name;
        const unused = page.locator(".pool button").filter({ hasText: name }).filter({ hasNot: page.locator(".used") });
        const button = (await unused.count()) ? unused.first() : page.locator(".pool button").filter({ hasText: name }).first();
        await button.click();
        await page.locator(".rack button").nth(slot).click();
      }
      const now = Number((await page.locator(".goal .now").innerText()).trim());
      if (now < puzzle.target) passed = false;
      if (i < PUZZLES.length - 1) {
        await page.getByRole("button", { name: "次の問題へ" }).click();
        await page.waitForTimeout(150);
      }
    }
    await page.locator("#menuButton").click();
    const howButton = page.locator("#howBtn");
    const surveyButton = page.locator("#surveyBtn");
    if (!(await howButton.count()) || !(await surveyButton.count())) passed = false;
    await howButton.click();
    const how = await page.locator("#howBody").innerText();
    if (!(how.includes("位相") && how.includes("法則が2つ") && how.includes("勝ち負けはない"))) passed = false;
    await page.locator("#closeHow").click();
    await page.locator("#markButton").click();
    await page.locator("#markNote").fill("gate");
    await page.locator("#markChoices button").filter({ hasText: "ひらめいた" }).click();
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("garakuta-puzzle")) || "{}");
    if (!(saved.marks || []).length) passed = false;
    await browser.close();
    stop();
    return { passed: passed && errors.length === 0, errors: errors.slice(0, 5) };
  } catch (error) {
    return { passed: false, errors: [`browser unavailable: ${error.message}`] };
  }
}

async function main() {
  if (!PUZZLES.length) fail("問題が無い");
  const a = { core: [], browser: null, pass: true };
  for (const [index, puzzle] of PUZZLES.entries()) {
    const space = arrangementSpace(puzzle.pool);
    const got = score(puzzle, puzzle.answer);
    const have = counts(puzzle.pool);
    const need = counts(puzzle.answer);
    const available = [...need.entries()].every(([type, count]) => (have.get(type) || 0) >= count);
    const checks = {
      answerMatchesBest: got === puzzle.best,
      answerReachesTarget: got >= puzzle.target,
      naiveBelowTarget: puzzle.naive < puzzle.target,
      spaceAtLeast400: space.length >= 400,
      answerAvailable: available,
    };
    const pass = Object.values(checks).every(Boolean);
    a.core.push({ problem: index + 1, name: puzzle.name, checks, pass, measuredBest: got, space: space.length });
    a.pass &&= pass;
  }
  a.browser = skipBrowser
    ? { passed: false, errors: ["browser gate skipped by --skip-browser"] }
    : await browserGate();
  a.pass &&= a.browser.passed;

  const b = [];
  const c = [];
  for (const [index, puzzle] of PUZZLES.entries()) {
    const space = arrangementSpace(puzzle.pool);
    const search = searchOnlyScore(puzzle, space, SEARCH_SEED + index * 1009);
    const enumeration = enumerate(puzzle, space);
    b.push({ problem: index + 1, name: puzzle.name, ...search });
    c.push({ problem: index + 1, name: puzzle.name, ...enumeration });
  }
  const passedProblems = PUZZLES
    .map((puzzle, index) => index + 1)
    .filter((problem) => a.browser.passed && a.core[problem - 1].pass && b[problem - 1].pass && c[problem - 1].pass);
  const d = { passedProblems, selectedProblems: passedProblems.slice(0, 3), pass: passedProblems.length >= 3 };
  const result = { experiment: "EXP-02_DISCOVERY", version: "0.1", seed: SEARCH_SEED, gateA: a, gateB: b, gateC: c, gateD: d };
  const report = makeReport(result);
  if (outputArg) fs.writeFileSync(outputArg.slice("--output=".length), report);
  process.stdout.write(jsonArg ? `${JSON.stringify(result, null, 2)}\n` : report);
  if (!d.pass) process.exitCode = 2;
}

function makeReport(result) {
  const lines = [];
  lines.push("# EXP-02 DISCOVERY 自動ゲート結果");
  lines.push("");
  lines.push("ゲーム規則・問題表・人間向け画面は変更せず、A〜Dのみを固定表へ実行した。");
  lines.push(`探索seed: ${result.seed} / 初期状態: ${START_COUNT} / 1初期状態あたり表示確認: ${CHECK_BUDGET}`);
  lines.push("");
  lines.push("## Gate A: 正しさ");
  lines.push("");
  lines.push("| 問題 | 表の最良一致 | 目標到達 | 足し算では未到達 | 空間≥400 | 手持ちから解を作れる | 判定 |");
  lines.push("|---:|---|---|---|---|---|---|");
  for (const row of result.gateA.core) {
    const c = row.checks;
    lines.push(`| ${row.problem} ${row.name} | ${c.answerMatchesBest ? "OK" : "NG"} | ${c.answerReachesTarget ? "OK" : "NG"} | ${c.naiveBelowTarget ? "OK" : "NG"} | ${c.spaceAtLeast400 ? "OK" : "NG"} | ${c.answerAvailable ? "OK" : "NG"} | ${row.pass ? "PASS" : "FAIL"} |`);
  }
  lines.push(`\nブラウザ実測: ${result.gateA.browser.passed ? "PASS" : "FAIL"}${result.gateA.browser.errors.length ? `（${result.gateA.browser.errors.join(" / ")}）` : ""}`);
  lines.push("");
  lines.push("## Gate B: 表示得点だけの固定探索");
  lines.push("");
  lines.push("10/20以上で解けた問題はFAIL（人間テスト候補から除外）。");
  lines.push("");
  lines.push("| 問題 | 解けた初期状態 | 試行数 | 上限 | 判定 |");
  lines.push("|---:|---:|---:|---:|---|");
  for (const row of result.gateB) lines.push(`| ${row.problem} ${row.name} | ${row.solved}/${row.starts} | ${row.totalChecks} | ${CHECK_BUDGET} | ${row.pass ? "PASS" : "FAIL"} |`);
  lines.push("");
  lines.push("## Gate C: 解の太さ（全列挙）");
  lines.push("");
  lines.push("| 問題 | 全配置 | 目標達成配置 | 達成率 | 最良 | 最良−目標 | 解部品集合数 | 判定 |");
  lines.push("|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const row of result.gateC) lines.push(`| ${row.problem} ${row.name} | ${row.space} | ${row.solutionCount} | ${(row.solutionRate * 100).toFixed(2)}% | ${row.best} | ${row.gap} | ${row.solutionSetCount} | ${row.pass ? "PASS" : "FAIL"} |`);
  lines.push("");
  lines.push("## Gate D: 出題選択");
  lines.push("");
  lines.push(`A〜C通過問題: ${result.gateD.passedProblems.join(", ") || "なし"}`);
  lines.push(`選定（既存順の先頭3問）: ${result.gateD.selectedProblems.join(", ") || "なし"}`);
  lines.push(`総合: ${result.gateD.pass ? "PASS（人間向け導線へ進める）" : "FAIL（人間向け実装・デプロイを停止）"}`);
  lines.push("");
  lines.push("## 探索器の定義");
  lines.push("");
  lines.push("各問題20初期状態を固定seedで生成し、現在配置から1枠だけ異なる候補を同点順固定で評価する。1初期状態あたり表示得点の確認は最大20回。法則名・部品効果・目標との差は探索器へ渡していない。");
  lines.push("");
  lines.push("この票はゲート結果のみを記録する。人間テストの結論や次の実験設計はSol側に残す。");
  return `${lines.join("\n")}\n`;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
