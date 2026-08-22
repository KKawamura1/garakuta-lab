const DEVICE_KEY = "garakuta-lab-device-id";
const SCHEMA_VERSION = 4;
// 同じルールでも、遊んだ画面が違えば体験は別物になる（PHASEで実証された）。
// ルールセットと画面の両方をバージョン文字列へ入れて、集計時に混ざらないようにする。
// 遊べるルールセットは必ずここに載せる。載せ忘れると game_version が "unknown-play" になり、
// **どのゲームの記録か分からなくなる**（法則機関の最初の4ランで実際に起きた）。
// analysis/smoke-sync.mjs が、遊ぶ画面が持つ全ルールセットを照合している。
const RULESET_VERSION = { arc: "arc-0.1", bus: "bus-0.3", phase: "phase-0.1", relay: "relay-0.1", laws: "laws-0.1" };
const HEADS = { "agent-view": "av", play: "play" };

const MARKER_LABELS = {
  hit: "きた！", insight: "ひらめいた", choice: "迷う",
  payoff: "うまくいった", friction: "つらい", unclear: "わからない"
};

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// 本編と同じ /api/runs へ、同じ列構成で入れる。
// game_version で分離できるので、集計側は同じパイプラインを使える。
export function buildPayload(session) {
  const trace = session.trace;
  const events = trace.events || [];
  const startedAt = session.startedAt || null;
  const started = startedAt ? new Date(startedAt).getTime() : null;

  const moments = events.filter(event => event.type === "emotion_marked").map(event => ({
    seq: event.seq,
    at: event.at || null,
    elapsedMs: event.at && started ? Math.max(0, new Date(event.at).getTime() - started) : 0,
    kind: event.kind,
    label: MARKER_LABELS[event.kind] || event.kind,
    phase: event.phase || "",
    note: event.note || ""
  }));

  const lastBattle = [...events].reverse().find(event => event.type === "battle_predicted");

  // 終わったランを ended_at なしで入れると、エクスポートの
  // WHERE ended_at IS NOT NULL に弾かれ、保存されているのに取り出せなくなる。
  // 古い版で終えたセッションには endedAt が無いので、必ず何かで埋める。
  const lastAt = [...(session.actions || [])].reverse().map(action => action.at).find(Boolean);
  const endedAt = session.endedAt || lastAt || new Date().toISOString();

  return {
    runId: session.runId,
    telemetryRunId: session.runId,
    deviceId: deviceId(),
    schemaVersion: SCHEMA_VERSION,
    // 対の試行は**普通のランと混ぜてはいけない**（3戦しかなく、片方はわざと条件を破っている）。
    // 版の文字列で分離できるようにする。laws-0.1:t3-play のようになる。
    gameVersion: `${RULESET_VERSION[String(session.ruleset || "arc").toLowerCase()] || "unknown"}`
      + `${session.trial ? `:${session.trial.id}` : ""}-${HEADS[session.head] || "av"}`,
    startedAt,
    endedAt,
    outcome: { won: Boolean(trace.won), reached: trace.reached, hp: trace.finalHp },
    build: lastBattle?.build || [],
    stats: {
      ...(session.metrics || {}), seed: session.seed, actionCount: session.actions.length,
      // 試した並びの回数。これまで観測できていなかった「探索そのもの」の量（P11）。
      previewCount: session.actions.filter(a => a && a.type === "preview").length,
      // ランをまたいで残る値。何ラン目かを後から復元できるようにする。
      bestsAtEnd: session.bests || null,
      // 対のどちら側だったか。**答えの「1本目/2本目」を側へ翻訳するのに要る。**
      trial: session.trial
        ? { id: session.trial.id, trialId: session.trial.trialId, stage: session.trial.stage,
            side: session.trial.side, order: (session.trial.order || []).join(">") }
        : null
    },
    answers: session.survey || {},
    client: {
      language: navigator.language,
      viewport: `${innerWidth}x${innerHeight}`,
      standalone: matchMedia("(display-mode: standalone)").matches,
      seed: session.seed,
      ruleset: trace.ruleset,
      head: session.head || "agent-view"
    },
    events,
    moments
  };
}

export async function sendRun(session) {
  if (!session.trace) return { ok: false, error: "ランが終わっていません" };
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(session))
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) return { ok: false, error: body.error || `HTTP ${response.status}` };
  return { ok: true, runId: body.runId };
}
