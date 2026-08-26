import assert from "node:assert/strict";
import { SCRAP_MODULES, CHALLENGES, createGame, getModule, simulateStage } from "../emberline/engine.mjs";

const starter = "wheel";
const scrapIds = SCRAP_MODULES.map(module => module.id);
const failures = [];

function check(name, pass, detail) {
  if (pass) return { name, pass: true, detail };
  failures.push({ name, detail });
  return { name, pass: false, detail };
}

function signature(result) {
  return [result.progress, result.force, result.guard, result.spark, result.heat, result.damage, result.cleared].join("/");
}

function permutations(items) {
  if (items.length <= 1) return [items];
  const output = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    permutations(rest).forEach(tail => output.push([item, ...tail]));
  });
  return output;
}

const orderSet = [starter, "coil", "bellows", "mirror"];
const orderResults = permutations(orderSet).map(order => simulateStage(order, CHALLENGES[0]));
const gate1 = check(
  "1. 同じ材料の順序差",
  new Set(orderResults.map(signature)).size >= 2,
  `${new Set(orderResults.map(signature)).size} distinct outcomes from ${orderResults.length} orders`
);

const seeded = createGame(12);
const firstOffers = seeded.offersByStage[0];
const choiceResults = firstOffers.map(moduleId => simulateStage([starter, moduleId, null, null], CHALLENGES[0]));
const gate2 = check(
  "2. 選択後の判断",
  new Set(choiceResults.map(signature)).size >= 2,
  `${new Set(choiceResults.map(signature)).size} distinct outcomes from the first offer`
);

function combinations(maxLength) {
  const output = [[]];
  for (const id of scrapIds) {
    const existing = [...output];
    existing.forEach(items => {
      if (items.length < maxLength) output.push([...items, id]);
    });
  }
  return output;
}

const candidateSets = combinations(3);
function successfulSets(challenge) {
  return candidateSets.filter(items => simulateStage([starter, ...items], challenge).cleared);
}
const multiSolutionCounts = CHALLENGES.map(challenge => ({
  id: challenge.id,
  count: successfulSets(challenge).length,
  examples: successfulSets(challenge).slice(0, 3)
}));
const gate3 = check(
  "3. 複数解法",
  multiSolutionCounts.every(entry => entry.count >= 2),
  multiSolutionCounts.map(entry => `${entry.id}:${entry.count}`).join(", ")
);

const contexts = [];
for (const challenge of CHALLENGES) {
  const successes = successfulSets(challenge);
  for (const moduleId of scrapIds) {
    if (successes.some(items => items.includes(moduleId))) contexts.push(`${moduleId}@${challenge.id}`);
  }
}
const usesByModule = Object.fromEntries(scrapIds.map(id => [id, contexts.filter(context => context.startsWith(`${id}@`)).length]));
const gate4 = check(
  "4. 再解釈",
  Object.values(usesByModule).every(count => count >= 2),
  Object.entries(usesByModule).map(([id, count]) => `${id}:${count}`).join(", ")
);

const explanation = simulateStage([starter, "coil", "bellows", "mirror"], CHALLENGES[0]);
const gate5 = check(
  "5. 結果説明",
  explanation.log.length > 0 && explanation.log.every(entry => typeof entry.text === "string" && entry.text.length > 0),
  `${explanation.log.length} non-empty causal log entries`
);

const results = [gate1, gate2, gate3, gate4, gate5];
const passed = results.filter(result => result.pass).length;
console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
if (passed < 3 || failures.length) {
  if (passed < 3) process.exitCode = 1;
}
