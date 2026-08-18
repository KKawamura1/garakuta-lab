import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";

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
  node agents/session.mjs rules
  node agents/session.mjs start --session=<path> --seed=<n> [--player=<id>]
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
  const run = createRun({ seed: session.seed, playerId: session.playerId });
  session.actions.forEach(action => run.act(action));
  return run;
}

function padEnd(text, width) {
  let size = 0;
  for (const char of text) size += /[　-ヿ一-鿿＀-￯]/.test(char) ? 2 : 1;
  return text + " ".repeat(Math.max(1, width - size));
}

function renderPart(part, prefix = "") {
  return `${prefix}${padEnd(`${part.icon} ${part.name}`, 18)}${padEnd(part.short, 14)}${part.desc}`;
}

function render(observation, extra = "") {
  const o = observation;
  const lines = [];
  lines.push(`[${o.ruleset} / seed ${o.seed}] 第${o.battleNumber}戦 / 全${o.totalBattles}戦   HP ${o.hp}/${o.maxHp}   修復材 ◆${o.scrap}   段階:${o.phase}`);
  if (o.upcomingEnemy) {
    const e = o.upcomingEnemy;
    lines.push(`次の敵：${e.name}  HP${e.hp} 攻撃${e.atk} 装甲${e.armor}`);
    lines.push(`  特徴：${e.trait}`);
  }
  lines.push("");
  lines.push("駆動列（枠1から順に作動）");
  o.slots.forEach(slot => {
    lines.push(slot.part ? `  ${slot.slot} ${renderPart(slot.part)}` : `  ${slot.slot} （空き）`);
  });
  lines.push("");
  lines.push(`予備部品（${o.inventory.length}個）`);
  if (!o.inventory.length) lines.push("  なし");
  o.inventory.forEach(part => lines.push(`  [${part.id}] ${renderPart(part)}`));

  if (o.offer) {
    lines.push("");
    lines.push("■ 報酬候補（1個だけ取得、または全部見送り）");
    o.offer.forEach(item => lines.push(`  ${item.choice}. ${renderPart(item.part)}`));
  }

  if (o.lastBattle) {
    const b = o.lastBattle;
    lines.push("");
    lines.push(`直前の戦闘：${b.enemy} に${b.won ? "勝利" : "敗北"}（${b.cycles}巡 / HP ${b.hpBefore}→${b.hpAfter} / 敵残HP ${b.enemyHpLeft}）`);
    lines.push(`  予想「${b.prediction}」→ 実際は ${({ better: "予想より良い", expected: "予想どおり", worse: "予想より悪い" })[b.surprise]}`);
    b.contributions.forEach(c => {
      const parts = [
        c.damage ? `攻撃${c.damage}` : "", c.shield ? `装甲${c.shield}` : "",
        c.powerMade ? `発電${c.powerMade}` : "", c.powerSpent ? `電力消費${c.powerSpent}` : "",
        c.heatMade ? `発熱${c.heatMade}` : "", c.heatCooled ? `冷却${c.heatCooled}` : "",
        c.healing ? `回復${c.healing}` : ""
      ].filter(Boolean).join(" ");
      lines.push(`    ${padEnd(c.name, 14)}${c.activations}回作動  ${parts}`);
    });
    lines.push(`    余り 電力${b.leftoverPower} 熱${b.leftoverHeat} 装甲${b.leftoverShield}`);
  }

  if (o.done) {
    lines.push("");
    lines.push(o.won ? "■ ラン終了：全6戦を突破した。" : `■ ラン終了：第${o.battleNumber}戦で停止した。`);
    lines.push("  finish コマンドでアンケートを送って終了してください。");
  } else {
    lines.push("");
    lines.push(`可能な行動: ${o.legalActions.map(a => a.type).join(" / ")}`);
    if (o.phase === "build") {
      lines.push(`  battle には prediction（負けそう|ギリギリ|勝てそう|圧勝）と worry（装甲|火力|電力|熱|速度|選択肢|なし）と worryText が必須。`);
    } else {
      lines.push(`  take には choice と reason と update（confirmed|revalued_existing|new_plan|none）と updateText が必須。`);
    }
  }
  if (extra) lines.push("", extra);
  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

if (command === "rules") {
  console.log(RULES);
  process.exit(0);
}

if (!command || !args.session) {
  usage();
  process.exit(command ? 2 : 0);
}

if (command === "start") {
  const seed = Number(args.seed);
  if (!Number.isFinite(seed)) { console.error("--seed=<number> が必要です"); process.exit(2); }
  const session = { seed, playerId: args.player || "agent", startedAt: new Date().toISOString(), actions: [], survey: null };
  save(args.session, session);
  const run = rebuild(session);
  console.log(RULES);
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
  const trace = run.finish(survey);
  session.survey = survey;
  session.trace = trace;
  session.metrics = describeRun(trace);
  save(args.session, session);
  console.log(`記録しました: ${args.session}`);
  console.log(JSON.stringify(session.metrics, null, 2));
  process.exit(0);
}

usage();
process.exit(2);
