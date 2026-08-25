import { ACTIONS, VERSION, summary } from "./engine.mjs";

export const ECHO_SCHEMA_VERSION = 4;
export const ECHO_GAME_VERSION = `${VERSION}-ghost`;

const MARKER_LABELS = {
  spark: "閃き",
  hesitate: "迷い",
  surge: "勢い",
  worry: "不安",
  bored: "退屈"
};

function nowIso() {
  return new Date().toISOString();
}

function newRunId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureTelemetry(state, now = nowIso()) {
  state.telemetry ||= { runId: newRunId(), startedAt: now, events: [], sentAt: null, error: null };
  state.telemetry.events ||= [];
  return state;
}

export function recordTelemetry(state, event, at = nowIso()) {
  ensureTelemetry(state, at);
  const events = state.telemetry.events;
  const seq = events.length ? events[events.length - 1].seq + 1 : 1;
  const entry = { seq, at, ...event };
  events.push(entry);
  return entry;
}

function clientFor(state) {
  const width = typeof innerWidth === "number" ? innerWidth : null;
  const height = typeof innerHeight === "number" ? innerHeight : null;
  return {
    language: typeof navigator !== "undefined" ? navigator.language : null,
    viewport: width && height ? `${width}x${height}` : null,
    standalone: typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
    seed: state.seed,
    ruleset: ECHO_GAME_VERSION,
    head: "echo"
  };
}

export function buildEchoPayload(state, options = {}) {
  ensureTelemetry(state);
  const events = state.telemetry.events || [];
  const moments = events
    .filter(event => event.type === "emotion_marked")
    .map(event => ({
      seq: event.seq,
      at: event.at || null,
      elapsedMs: event.at && state.telemetry.startedAt
        ? Math.max(0, new Date(event.at).getTime() - new Date(state.telemetry.startedAt).getTime())
        : 0,
      kind: event.kind,
      label: MARKER_LABELS[event.kind] || event.kind,
      phase: event.phase || "",
      note: event.note || ""
    }));
  const result = summary(state);
  return {
    runId: state.telemetry.runId,
    telemetryRunId: state.telemetry.runId,
    deviceId: options.deviceId || "echo-test-device",
    schemaVersion: ECHO_SCHEMA_VERSION,
    gameVersion: ECHO_GAME_VERSION,
    startedAt: state.telemetry.startedAt || null,
    endedAt: state.endedAt || null,
    outcome: {
      won: result.won,
      reached: result.stages,
      hp: null,
      reason: result.reason
    },
    build: ACTIONS.map(action => ({ actionId: action.id, name: action.name })),
    stats: {
      seed: state.seed,
      stages: result.stages,
      score: result.score,
      heat: result.heat,
      plan: result.plan,
      previousScore: result.previousScore,
      actionCount: events.filter(event => event.type === "action_chosen").length,
      rewriteCount: events.filter(event => event.echo === "rewrite").length,
      echoCount: events.filter(event => event.echo === "echo").length
    },
    answers: state.survey || {},
    client: clientFor(state),
    events,
    moments
  };
}

export async function sendEchoTelemetry(state) {
  ensureTelemetry(state);
  try {
    const { deviceIdForRun, sendPayload } = await import("../agent-view/sync.js");
    const result = await sendPayload(buildEchoPayload(state, { deviceId: deviceIdForRun() }));
    if (result.ok) {
      state.telemetry.sentAt = nowIso();
      state.telemetry.error = null;
    } else {
      state.telemetry.error = result.error || "送信に失敗しました";
    }
    return result;
  } catch (error) {
    state.telemetry.error = error?.message || "送信モジュールを読み込めませんでした";
    return { ok: false, error: state.telemetry.error };
  }
}
