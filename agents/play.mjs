import { createInterface } from "node:readline/promises";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { createRun } from "../core/run.mjs";
import { renderObservation } from "../core/render.mjs";
import { describeRun } from "../core/metrics.mjs";
import { PREDICTIONS, WORRY_CATEGORIES, UPDATE_KINDS, MARKER_KINDS } from "../core/arc.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));

const path = args.session;
if (!path) {
  console.error(`使い方: node agents/play.mjs --session=<保存先> [--seed=<n>] [--player=<id>]

エージェントが見ているものと完全に同じ画面で遊ぶモードです。
表示は core/render.mjs をエージェント用CLIと共有しているため、差分は出ません。

操作:
  p <部品ID> <枠>   駆動列へ置く（例: p p3 2）
  r <枠>            外す
  s <枠> <枠>       入れ替える
  x <部品ID>        分解して修復材◆1
  h                 修復材1でHP+5
  f                 戦う（予測と不安を聞かれます）
  t <1-3>           報酬を取る    k  報酬を全部見送る
  m                 今の気持ちを記録
  q                 中断（次回同じセッションで再開）`);
  process.exit(2);
}

const session = existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : { seed: Number(args.seed ?? Math.floor(Math.random() * 100000)), playerId: args.player || "human", startedAt: new Date().toISOString(), actions: [], survey: null };

function persist() {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(session, null, 2));
}

let run = createRun({ seed: session.seed, playerId: session.playerId });
session.actions.forEach(action => run.act(action));

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function choose(label, options) {
  console.log(`\n${label}`);
  options.forEach((option, i) => console.log(`  ${i + 1}. ${option}`));
  while (true) {
    const answer = (await rl.question("> ")).trim();
    const index = Number(answer) - 1;
    if (options[index]) return options[index];
    console.log("番号で選んでください。");
  }
}

async function apply(action) {
  const result = run.act(action);
  if (!result.ok) {
    console.log(`\n✗ ${result.error}`);
    return false;
  }
  session.actions.push(action);
  persist();
  return true;
}

console.log(`\nseed ${session.seed} / player ${session.playerId} / 保存先 ${path}`);
console.log("コマンド一覧は ? で表示します。\n");

while (true) {
  console.log("\n" + "─".repeat(72));
  console.log(renderObservation(run.observe()));

  if (run.done) {
    console.log("\nアンケートに答えてください。");
    const replay = await choose("もう一度遊びたいか（1=まったく 〜 5=すぐにでも）", ["1", "2", "3", "4", "5"]);
    const settledAt = (await rl.question("勝敗が実質決まったと感じた戦闘番号（なければ「なし」）\n> ")).trim() || "なし";
    const bestMoment = (await rl.question("一番良かった瞬間\n> ")).trim();
    const friction = (await rl.question("退屈・理不尽だったところ\n> ")).trim();
    const pivot = await choose("方針転換はあったか", ["あった", "なかった"]);
    const runStory = (await rl.question("このランを一言で\n> ")).trim();
    const survey = { replay: Number(replay), settledAt, bestMoment, friction, pivot, runStory };
    session.survey = survey;
    session.trace = run.finish(survey);
    session.metrics = describeRun(session.trace);
    persist();
    console.log(`\n記録しました: ${path}`);
    if (args.showMetrics) console.log(JSON.stringify(session.metrics, null, 2));
    break;
  }

  const input = (await rl.question("\n> ")).trim();
  const [command, ...rest] = input.split(/\s+/);

  if (command === "q") { persist(); console.log("中断しました。同じ --session で再開できます。"); break; }
  if (command === "?" || !command) {
    console.log("p <部品ID> <枠> / r <枠> / s <枠> <枠> / x <部品ID> / h / f / t <1-3> / k / m / q");
    continue;
  }
  if (command === "p") await apply({ type: "place", partId: rest[0], slot: rest[1] });
  else if (command === "r") await apply({ type: "remove", slot: rest[0] });
  else if (command === "s") await apply({ type: "swap", slotA: rest[0], slotB: rest[1] });
  else if (command === "x") await apply({ type: "scrapPart", partId: rest[0] });
  else if (command === "h") await apply({ type: "repair" });
  else if (command === "k") {
    const reason = (await rl.question("見送る理由\n> ")).trim();
    await apply({ type: "skipAll", reason });
  } else if (command === "t") {
    const reason = (await rl.question("選んだ理由\n> ")).trim();
    const update = await choose("この報酬で何が変わったか", UPDATE_KINDS);
    const updateText = (await rl.question("具体的に（任意）\n> ")).trim();
    await apply({ type: "take", choice: rest[0], reason, update, updateText });
  } else if (command === "m") {
    const kind = await choose("今の気持ち", MARKER_KINDS);
    const note = (await rl.question("ひとこと（任意）\n> ")).trim();
    await apply({ type: "mark", kind, note });
  } else if (command === "f") {
    const prediction = await choose("この戦闘の予想（結果を見る前に）", PREDICTIONS);
    const worry = await choose("いま一番不安なこと", WORRY_CATEGORIES);
    const worryText = (await rl.question("なぜそう思うか\n> ")).trim();
    await apply({ type: "battle", prediction, worry, worryText });
  } else console.log("不明なコマンドです。? で一覧。");
}

rl.close();
