import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { createRun } from "../core/run.mjs";
import { describeRun } from "../core/metrics.mjs";
import { localSearchPolicy } from "../agents/policies.mjs";

// agent-view/sync.js はブラウザ前提なので、最小限のグローバルを与えて読み込む。
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value))
};
Object.defineProperty(globalThis, "navigator", { value: { language: "ja-JP" }, configurable: true });
globalThis.innerWidth = 390;
globalThis.innerHeight = 844;
globalThis.matchMedia = () => ({ matches: false });

const { buildPayload, uuid } = await import("../agent-view/sync.js");

const run = createRun({ seed: 4242, playerId: "human-agent-view" });
const policy = localSearchPolicy();
let guard = 0;
let marked = false;
const actions = [];
const apply = action => { const result = run.act(action); assert.ok(result.ok, `行動が拒否された: ${result.error}`); actions.push(action); };
while (!run.done && guard < 400) {
  guard += 1;
  const observation = run.observe();
  if (observation.phase === "reward") {
    if (!marked) { apply({ type: "mark", kind: "insight", note: "テスト" }); marked = true; }
    apply(policy.reward(observation));
    continue;
  }
  policy.build(observation).forEach(apply);
  apply(policy.battle(run.observe()));
}

// ラン終了後は行動を受け付けない。感情マーカーはプレイ中にしか残せない。
assert.equal(run.act({ type: "mark", kind: "hit", note: "後から" }).ok, false);

const survey = { replay: 3, settledAt: "5", bestMoment: "テスト", friction: "", pivot: "あった", runStory: "" };
const trace = run.finish(survey);
const session = {
  runId: uuid(), seed: 4242, playerId: "human-agent-view",
  startedAt: new Date(Date.now() - 60000).toISOString(), endedAt: new Date().toISOString(),
  actions, survey, trace, metrics: describeRun(trace)
};

const payload = buildPayload(session);

// functions/api/runs.js の validPayload と同じ条件を、送信側でも満たすことを固定する。
assert.equal(typeof payload.runId, "string");
assert.ok(payload.runId.length >= 8 && payload.runId.length <= 80, "runId は8〜80文字");
assert.equal(payload.telemetryRunId, payload.runId, "schemaVersion>=2 では telemetryRunId が一致する必要がある");
assert.ok(typeof payload.deviceId === "string" && payload.deviceId.length >= 8 && payload.deviceId.length <= 80);
assert.ok(Number.isInteger(payload.schemaVersion));
assert.ok(typeof payload.gameVersion === "string" && payload.gameVersion.length <= 40, "gameVersion は40文字以内");
assert.ok(Array.isArray(payload.events) && payload.events.length <= 2000);
assert.ok(Array.isArray(payload.moments) && payload.moments.length <= 200);
assert.ok(payload.events.length > 0, "イベントが入っている");
assert.equal(payload.moments.length, 1, "感情マーカーが moments へ写る");
assert.equal(payload.moments[0].kind, "insight");
assert.ok(payload.moments[0].label, "moments には表示用ラベルが要る");
assert.equal(payload.outcome.reached, trace.reached);
assert.equal(payload.answers.replay, 3);
assert.equal(payload.client.seed, 4242, "seed を残さないと再生できない");
assert.equal(payload.stats.seed, 4242);
assert.notEqual(payload.gameVersion, "arc-0.1", "本編と同じ game_version にすると集計で混ざる");

// 同じルールでも画面が違えば体験は別物になる。バージョン文字列で分かれていること。
const played = buildPayload({ ...session, ruleset: "phase", head: "play" });
const viewed = buildPayload({ ...session, ruleset: "phase", head: "agent-view" });
assert.notEqual(played.gameVersion, viewed.gameVersion, "画面が違えば game_version も違う");
assert.equal(played.client.head, "play");
assert.equal(viewed.client.head, "agent-view");

assert.ok(payload.endedAt, "終わったランは必ず endedAt を持つ（無いとエクスポートに出ない）");

// 新しいルールセットを足したら、必ずバージョン表に載せる。
// 載せ忘れると gameVersion が "unknown-play" になり、集計でどのゲームか分からなくなる
// （実際に一度、位相のランが agentview のまま記録された）。
// **遊ぶ画面が出せるルールセットを全部照合する。** 1つでも版表に無ければ unknown になり、
// どのゲームの記録か分からなくなる（法則機関の最初の4ランがそうなった）。
const head = readFileSync("play/app.js", "utf8");
const served = new Set(["laws"]);
const match = head.match(/const RULESETS = \{([^}]*)\}/);
if (match) match[1].split(",").forEach(part => {
  const key = part.split(":")[0].trim();
  if (key) served.add(key);
});
served.forEach(name => {
  const payload = buildPayload({ ...session, ruleset: name, head: "play" });
  assert.ok(!/unknown/.test(payload.gameVersion),
    `${name} が版表に無い（gameVersion=${payload.gameVersion}）。agent-view/sync.js の RULESET_VERSION へ足すこと`);
});

// 古い版で終えたセッション（endedAt を持たない）でも埋まること。
const legacy = buildPayload({ ...session, endedAt: undefined });
assert.ok(legacy.endedAt, "endedAt が無いセッションでも補完される");

const size = Buffer.byteLength(JSON.stringify(payload));
assert.ok(size < 750000, `本文は750KB未満（実測 ${size}）`);

console.log(`sync smoke: 送信ペイロードがAPIの検証条件を満たす（${payload.events.length}イベント / ${size}バイト） OK`);
