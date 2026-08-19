import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { localSearchPolicy } from "../agents/policies.mjs";

// 同じシードを遊んだ複数のプレイヤー（人間・エージェント）を横に並べる。
// 主観の申告（settledAt / pivot / replay）と、報酬経路の全探索が示す客観を突き合わせる。

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
  return match ? [match[1], match[2] === undefined ? true : match[2]] : [item, true];
}));

const DEFENSIVE = ["即席装甲機", "吸着ドリル", "装甲プリズム"];

function loadSessions(paths) {
  const files = [];
  paths.filter(Boolean).forEach(path => {
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory()) {
      readdirSync(path).filter(n => n.endsWith(".json")).forEach(n => files.push(join(path, n)));
    } else files.push(path);
  });
  // 1ファイルに1セッションでも、完了ランをまとめた配列でも受け取れる。
  return files.flatMap(file => {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((data, i) => ({ file: list.length > 1 ? `${file}#${i + 1}` : file, data }));
  });
}

// 行動列だけを持つセッション（人間側の貼り付け）でも、再生して trace を作る。
function traceOf(session) {
  if (session.trace) return session.trace;
  const run = createRun({ seed: session.seed, playerId: session.playerId || "human" });
  session.actions.forEach(action => run.act(action));
  return run.finish(session.survey || {});
}

function decisionsOf(trace) {
  return trace.events.filter(e => e.type === "reward_chosen" || e.type === "reward_scrapped")
    .map(e => (e.type === "reward_scrapped" ? 0 : (e.offered.indexOf(e.chosen) + 1)));
}

function playPath(seed, decisions) {
  const run = createRun({ seed, playerId: "probe" });
  const policy = localSearchPolicy();
  let rewardIndex = 0;
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") {
      if (rewardIndex >= decisions.length) return { pending: true };
      const decision = decisions[rewardIndex];
      rewardIndex += 1;
      run.act(decision === 0
        ? { type: "skipAll", reason: "p" }
        : { type: "take", choice: decision, reason: "p", update: "none", updateText: "" });
      continue;
    }
    policy.build(observation).forEach(action => run.act(action));
    run.act(policy.battle(run.observe()));
  }
  return { pending: false, won: run.trace().won };
}

function anyWinFrom(seed, prefix) {
  const stack = [prefix];
  while (stack.length) {
    const decisions = stack.pop();
    const result = playPath(seed, decisions);
    if (result.pending) { [0, 1, 2, 3].forEach(d => stack.push([...decisions, d])); continue; }
    if (result.won) return true;
  }
  return false;
}

// その人の選択列に沿って、勝ち筋が最後に残っていた時点を返す。
function objectiveSettledPoint(seed, decisions) {
  for (let k = 0; k <= decisions.length; k += 1) {
    if (!anyWinFrom(seed, decisions.slice(0, k))) return k;
  }
  return null;
}

const seed = Number(args.seed);
if (!Number.isFinite(seed)) { console.error("--seed=<n> が必要です"); process.exit(2); }

const sessions = loadSessions([args.dir, args.human, args.dir2]).filter(s => Number(s.data.seed) === seed);
if (!sessions.length) { console.error(`seed ${seed} のセッションが見つかりません`); process.exit(2); }

const rows = sessions.map(({ file, data }) => {
  const trace = traceOf(data);
  const metrics = describeRun(trace);
  const survey = data.survey || {};
  const builds = trace.events.filter(e => e.type === "battle_predicted");
  const finalBuild = builds[builds.length - 1]?.build?.filter(Boolean) || [];
  const decisions = decisionsOf(trace);
  const settledAtIndex = objectiveSettledPoint(seed, decisions);
  return {
    プレイヤー: data.playerId || file,
    結果: trace.won ? `勝利 HP${trace.finalHp}` : `第${trace.reached}戦で敗北`,
    replay: survey.replay ?? null,
    "決着点(申告)": survey.settledAt ?? "—",
    "決着点(客観)": settledAtIndex === null ? "最後まで勝ち筋あり" : (settledAtIndex === 0 ? "開始時点で消滅" : `第${settledAtIndex}報酬の後に消滅`),
    "方針転換(申告)": survey.pivot ?? "—",
    "方針転換(機械)": metrics.pivotRate,
    最終構成の防御部品: finalBuild.filter(n => DEFENSIVE.includes(n)).join("・") || "なし",
    出力首位: metrics.gateRanking[0]?.name ?? "—",
    不安の並び: builds.map(e => e.worry).join(","),
    感情マーカー: metrics.markerTotal,
    問題の連鎖: metrics.problemChainRate,
    警告: metrics.warnings.map(w => w.code).join(",") || "なし"
  };
});

console.log(`seed ${seed}: ${rows.length}人のプレイを比較\n`);
console.table(rows);
