import { GAME_VERSION, summary, visibleMemories } from "./engine.mjs";

export const SCHEMA_VERSION = 4;
const DEVICE_KEY = "tomori-device-id";
const QUEUE_KEY = "tomori-pending-payloads";

function now() {
  return new Date().toISOString();
}

function ensure(state) {
  state.telemetry ||= { runId: state.runId, startedAt: state.startedAt, events: [], sentAt: null, error: null };
  state.telemetry.events ||= [];
  return state.telemetry;
}

function deviceId() {
  if (typeof localStorage === "undefined") return "tomori-test-device";
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = "tomori-device-" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}

export function record(state, event, at = now()) {
  const trace = ensure(state);
  const events = trace.events;
  const seq = events.length ? events[events.length - 1].seq + 1 : 1;
  const entry = { seq, at, ...event };
  events.push(entry);
  return entry;
}

function queued() {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveQueue(items) {
  if (typeof localStorage !== "undefined") localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-5)));
}

function clientInfo(seed) {
  return {
    language: typeof navigator !== "undefined" ? navigator.language : null,
    viewport: typeof innerWidth === "number" && typeof innerHeight === "number" ? innerWidth + "x" + innerHeight : null,
    standalone: typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
    seed,
    ruleset: GAME_VERSION,
    head: "tomori"
  };
}

export function buildPayload(state) {
  const trace = ensure(state);
  const result = summary(state);
  const events = trace.events || [];
  const moments = events.filter(event => event.type === "emotion_marked").map(event => ({
    seq: event.seq,
    at: event.at || null,
    elapsedMs: event.at && trace.startedAt ? Math.max(0, new Date(event.at).getTime() - new Date(trace.startedAt).getTime()) : 0,
    kind: event.kind,
    label: event.label || event.kind,
    phase: event.phase || "",
    note: event.note || ""
  }));
  return {
    runId: state.runId,
    telemetryRunId: state.runId,
    deviceId: deviceId(),
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    startedAt: state.startedAt || trace.startedAt || null,
    endedAt: state.endedAt || now(),
    outcome: { won: result.won, reached: result.reached, hp: 0, reason: result.reason },
    build: result.memories.map(memory => ({ day: memory.day, trait: memory.trait, name: memory.name, actionId: memory.actionId })),
    stats: {
      seed: state.seed,
      name: state.name,
      origin: state.origin,
      dayCount: result.reached,
      counts: result.counts,
      memories: visibleMemories(state),
      ending: result.ending,
      actionCount: events.filter(event => event.type === "action_chosen").length,
      emotionCount: moments.length
    },
    answers: state.survey || {},
    client: clientInfo(state.seed),
    events,
    moments
  };
}

async function post(payload) {
  const response = await fetch("../api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  let body = null;
  try { body = await response.json(); } catch { /* response body is optional */ }
  return { ok: response.ok, status: response.status, body, error: response.ok ? null : (body?.error || "記録を保存できませんでした") };
}

export async function send(state) {
  ensure(state);
  const payload = buildPayload(state);
  try {
    const pending = queued();
    for (const item of pending) {
      const result = await post(item);
      if (!result.ok) throw new Error(result.error || "保留中の記録を送れませんでした");
    }
    const result = await post(payload);
    if (!result.ok) throw new Error(result.error || "記録を保存できませんでした");
    saveQueue([]);
    state.telemetry.sentAt = now();
    state.telemetry.error = null;
    return result;
  } catch (error) {
    const items = queued().filter(item => item.runId !== payload.runId);
    items.push(payload);
    saveQueue(items);
    state.telemetry.error = error?.message || "記録を保存できませんでした";
    return { ok: false, error: state.telemetry.error, queued: true };
  }
}
