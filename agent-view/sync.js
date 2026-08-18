const DEVICE_KEY = "garakuta-lab-device-id";
const SCHEMA_VERSION = 4;
const GAME_VERSION = "arc-0.1-agentview";

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

  return {
    runId: session.runId,
    telemetryRunId: session.runId,
    deviceId: deviceId(),
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    startedAt,
    endedAt: session.endedAt || null,
    outcome: { won: Boolean(trace.won), reached: trace.reached, hp: trace.finalHp },
    build: lastBattle?.build || [],
    stats: { ...(session.metrics || {}), seed: session.seed, actionCount: session.actions.length },
    answers: session.survey || {},
    client: {
      language: navigator.language,
      viewport: `${innerWidth}x${innerHeight}`,
      standalone: matchMedia("(display-mode: standalone)").matches,
      seed: session.seed,
      ruleset: trace.ruleset,
      head: "agent-view"
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
