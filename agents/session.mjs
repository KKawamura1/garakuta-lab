import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { ARC } from "../core/arc.mjs";
import { BUS } from "../core/bus.mjs";

const RULESETS = { arc: ARC, bus: BUS };
import { renderObservation as render } from "../core/render.mjs";

const RULES = `【ガラクタ・ラボ / ARC 0.1 遊び方】
- 拾った部品で機械を組み、6戦を勝ち抜く。操作は構築のみで、戦闘は自動。
- 駆動列は5枠。戦闘では毎巡回、枠1から枠5へ順に部品が作動する。
- 部品が作動した後、敵が反撃する。装甲が反撃を肩代わりし、余りはHPへ通る。装甲は巡回をまたいで残る。
- 資源は電力・熱・装甲の3種。戦闘開始時はすべて0で、戦闘が終わると消える。
- 部品はすべて単独でも動く。特定の組合せが必須になるレシピはない。
- 勝利するとHPが3回復し、ランダムな3候補から1個だけ拾える。全部見送ると修復材◆2になる。
- 予備部品を分解すると◆1。◆1を使うとHPが5回復する。
- 敵の装甲は各攻撃のダメージを減らす（最低1は通る）。12巡回で決着しなければ引き分け扱いで敗北。
- 目標は勝つことだが、報告してほしいのは勝敗ではなく、あなたが何を予想し、何に困り、何で認識が変わったか。`;

function usage() {
  console.log(`使い方:
  node agents/session.mjs rules  [--ruleset=arc|bus]
  node agents/session.mjs brief  [--ruleset=arc|bus]   ← 全部品・全敵・全数値を先に見せる
  node agents/session.mjs start --session=<path> --seed=<n> [--player=<id>] [--ruleset=arc|bus]
  node agents/session.mjs show --session=<path>
  node agents/session.mjs act --session=<path> --json='{"type":"place","partId":"p1","slot":1}'
  node agents/session.mjs finish --session=<path> --json='{"replay":3,"bestMoment":"...","pivot":"あった","runStory":"..."}'
オプション: --raw でJSON出力`);
}

function parseArgs(argv) {
  const args = { _: [] };
  argv.forEach(item => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
    if (match) args[match[1]] = match[2] === undefined ? true : match[2];
    else args._.push(item);
  });
  return args;
}

function load(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function save(path, session) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(session, null, 2));
}

function rebuild(session) {
  const ruleset = RULESETS[String(session.ruleset || "arc").toLowerCase()] || ARC;
  const run = createRun({ seed: session.seed, playerId: session.playerId, ruleset });
  session.actions.forEach(action => run.act(action));
  return run;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

function rulesetOf(name) {
  const ruleset = RULESETS[String(name || "arc").toLowerCase()];
  if (!ruleset) { console.error(`未知のルールセット: ${name}（${Object.keys(RULESETS).join(", ")}）`); process.exit(2); }
  return ruleset;
}

if (command === "rules") {
  console.log(rulesetOf(args.ruleset).rules);
  process.exit(0);
}

// 完全情報の事前提示。初見ではなく「一通り知っている人」の条件を作るために使う。
// 通常のプレイ中は将来の敵も未取得の部品も見えないので、これは明示的に別条件である。
if (command === "brief") {
  const ruleset = rulesetOf(args.ruleset);
  console.log(ruleset.rules);
  console.log("");
  console.log("■ 全部品（このランで出うるものすべて）");
  Object.values(ruleset.PARTS).forEach(part => {
    const cost = part.cost === undefined ? "" : `帯${part.cost} `;
    console.log(`  ${part.icon} ${part.name}${part.rare ? "（レア）" : ""}  ${cost}${part.short}`);
    console.log(`      ${part.desc}`);
  });
  console.log("");
  console.log("■ 全6戦の敵（出現順）");
  ruleset.ENEMIES.forEach((enemy, i) => {
    const view = ruleset.enemyView ? ruleset.enemyView(enemy) : { hp: enemy.hp, atk: enemy.atk, armor: enemy.armor || 0 };
    const shown = Object.entries(view).filter(([k, v]) => !["name", "trait"].includes(k) && v !== null && v !== undefined)
      .map(([k, v]) => `${k}=${v}`).join(" ");
    console.log(`  ${i + 1}. ${enemy.name}  ${shown}`);
    console.log(`      ${enemy.trait}`);
  });
  console.log("");
  console.log(`■ 数値: 初期HP ${ruleset.MAX_HP} / 稼働枠 ${ruleset.SLOT_COUNT} / 初期部品 ${ruleset.START_PARTS}個 / 報酬 ${ruleset.REWARD_CHOICES}候補から1個`);
  console.log(`  勝利でHP+${ruleset.WIN_HEAL} / 修復材1でHP+${ruleset.REPAIR_HP} / レア出現率 ${Math.round(ruleset.RARE_RATE * 100)}%`);
  console.log(`  報酬候補と初期部品は毎回ランダムに抽選される。どの部品が来るかは事前には分からない。`);
  process.exit(0);
}

if (!command || !args.session) {
  usage();
  process.exit(command ? 2 : 0);
}

if (command === "start") {
  const seed = Number(args.seed);
  if (!Number.isFinite(seed)) { console.error("--seed=<number> が必要です"); process.exit(2); }
  const session = { seed, playerId: args.player || "agent", ruleset: String(args.ruleset || "arc").toLowerCase(), startedAt: new Date().toISOString(), actions: [], survey: null };
  save(args.session, session);
  const run = rebuild(session);
  console.log(rulesetOf(session.ruleset).rules);
  console.log("");
  console.log(render(run.observe()));
  process.exit(0);
}

const session = load(args.session);
const run = rebuild(session);

if (command === "show") {
  console.log(args.raw ? JSON.stringify(run.observe(), null, 2) : render(run.observe()));
  process.exit(0);
}

if (command === "act") {
  let action;
  try { action = JSON.parse(args.json); } catch (_) { console.error("--json= が不正なJSONです"); process.exit(2); }
  const result = run.act(action);
  if (!result.ok) {
    console.log(`✗ 行動は却下されました: ${result.error}`);
    console.log("");
    console.log(render(result.observation));
    process.exit(1);
  }
  session.actions.push(action);
  save(args.session, session);
  console.log(args.raw ? JSON.stringify(result, null, 2) : render(result.observation, `✓ ${action.type} を実行しました。`));
  process.exit(0);
}

if (command === "finish") {
  if (!run.done) { console.error("ランがまだ終わっていません"); process.exit(2); }
  let survey = {};
  if (args.json) {
    try { survey = JSON.parse(args.json); } catch (_) { console.error("--json= が不正なJSONです"); process.exit(2); }
  }
  const replay = Number(survey.replay);
  if (!Number.isInteger(replay) || replay < 1 || replay > 5) {
    console.error("finish には --json='{\"replay\":1〜5, ...}' が必要です。replay が読めないまま記録すると欠測になります。");
    process.exit(2);
  }
  if (!String(survey.settledAt || "").trim()) {
    console.error("finish には settledAt（勝敗が実質決まったと感じた戦闘番号、なければ \"なし\"）が必要です。");
    process.exit(2);
  }
  const trace = run.finish(survey);
  session.survey = survey;
  session.trace = trace;
  session.metrics = describeRun(trace);
  save(args.session, session);
  console.log(`記録しました: ${args.session}`);
  if (args.showMetrics) console.log(JSON.stringify(session.metrics, null, 2));
  process.exit(0);
}

usage();
process.exit(2);
